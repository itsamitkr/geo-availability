import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DataGrid,
  GridColDef,
  GridColumnVisibilityModel,
  GridToolbarColumnsButton,
  GridToolbarContainer,
  GridToolbarFilterButton,
} from '@mui/x-data-grid'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Select,
  TablePagination,
  TextField,
  Tooltip,
  Typography,
  useTheme,
  type SelectChangeEvent,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import type { RowData } from '../types'

// ── Type augmentation ─────────────────────────────────────────────────────
declare module '@mui/x-data-grid' {
  interface ToolbarPropsOverrides {
    paginationModel:    PaginationModel
    onPaginationChange: (m: PaginationModel) => void
    totalRows:          number
  }
}

type PaginationModel = { page: number; pageSize: number }

// ── Chip helpers ──────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, 'success' | 'warning' | 'default' | 'error'> = {
  live:          'success',
  'in progress': 'warning',
  planned:       'default',
  deprecated:    'error',
}

const STATUS_OPTIONS = ['Live', 'In Progress', 'Planned', 'Deprecated', 'TBD', '']

function CategoryChip({ value }: { value: string }) {
  const COLOR_MAP: Record<string, 'primary' | 'error' | 'info' | 'success' | 'secondary' | 'warning' | 'default'> = {
    'Content':                       'primary',
    'CyberSecurity Ent':             'error',
    'Observability & Service Mmgt':  'info',
    'Experience':                    'success',
    'Analytics, AI, and LegalTech':  'secondary',
    'Business Network':              'warning',
    'ADM':                           'default',
    'CyberSecurity SMB':             'error',
    'Portfolio':                     'primary',
  }
  return (
    <Chip
      label={value}
      color={COLOR_MAP[value] ?? 'default'}
      size="small"
      variant="outlined"
      sx={{ fontSize: '0.7rem', '& .MuiChip-label': { fontWeight: 700 } }}
    />
  )
}

function StatusChip({ value }: { value: string }) {
  if (!value) return null
  const key = Object.keys(STATUS_COLORS).find(k => value.toLowerCase().includes(k))
  return <Chip label={value} color={STATUS_COLORS[key ?? ''] ?? 'default'} size="small" sx={{ fontSize: '0.7rem' }} />
}

// ── Custom toolbar ────────────────────────────────────────────────────────

function CustomToolbar({ paginationModel, onPaginationChange, totalRows }: {
  paginationModel:    PaginationModel
  onPaginationChange: (m: PaginationModel) => void
  totalRows:          number
}) {
  const { palette } = useTheme()
  const isDark = palette.mode === 'dark'
  const sub    = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'
  const dim    = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'

  return (
    <GridToolbarContainer
      sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 1, py: 0, minHeight: 44,
        borderBottom: `1px solid ${border}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <GridToolbarColumnsButton />
        <GridToolbarFilterButton />
      </Box>

      <TablePagination
        component="div"
        count={totalRows}
        page={paginationModel.page}
        rowsPerPage={paginationModel.pageSize}
        rowsPerPageOptions={[25, 50, 100]}
        onPageChange={(_, page) => onPaginationChange({ ...paginationModel, page })}
        onRowsPerPageChange={e => onPaginationChange({ page: 0, pageSize: parseInt(e.target.value, 10) })}
        sx={{
          border: 'none',
          '& .MuiTablePagination-toolbar':      { minHeight: 'auto', px: 0 },
          '& .MuiTablePagination-spacer':        { display: 'none' },
          '& .MuiTablePagination-selectLabel':   { fontSize: '0.72rem', color: dim },
          '& .MuiTablePagination-displayedRows': { fontSize: '0.72rem', color: sub },
          '& .MuiTablePagination-select':        { fontSize: '0.72rem', color: sub },
          '& .MuiIconButton-root': {
            color: sub,
            '&:hover': { color: isDark ? '#fff' : '#000', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
            '&.Mui-disabled': { color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' },
            padding: '4px',
          },
        }}
      />
    </GridToolbarContainer>
  )
}

// ── Column visibility defaults ─────────────────────────────────────────────

const DEFAULT_VISIBILITY: GridColumnVisibilityModel = {
  // Secondary deployment columns — hidden by default
  'City (Secondary)':               false,
  'State/Province (Secondary)':     false,
  'Country (Secondary)':            false,
  'Landing Zone (Secondary)':       false,
  'Account ID (Secondary)':         false,
  'Deployment Status (Secondary)':  false,
  'Target Quarter (Secondary)':     false,
  // Infrastructure / DR — hidden by default
  'Data Backup Region':             false,
  'Disaster Recovery Region':       false,
}

// ── Edit modal ─────────────────────────────────────────────────────────────

interface EditValues { region: string; city: string; accountId: string; status: string }

function EditModal({ row, values, onChange, onSave, onClose }: {
  row:      RowData
  values:   EditValues
  onChange: (f: keyof EditValues, v: string) => void
  onSave:   () => void
  onClose:  () => void
}) {
  const { palette } = useTheme()
  const isDark = palette.mode === 'dark'

  const bg      = isDark ? '#111827'                 : '#ffffff'
  const fg      = isDark ? '#ffffff'                 : '#0d1526'
  const sub     = isDark ? 'rgba(255,255,255,0.5)'   : 'rgba(0,0,0,0.55)'
  const dim     = isDark ? 'rgba(255,255,255,0.35)'  : 'rgba(0,0,0,0.4)'
  const border  = isDark ? 'rgba(255,255,255,0.07)'  : 'rgba(0,0,0,0.1)'
  const focus   = isDark ? '#4fc3f7'                 : '#1565c0'

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      color: fg,
      fontSize: '0.85rem',
      '& fieldset':             { borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.2)' },
      '&:hover fieldset':       { borderColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)' },
      '&.Mui-focused fieldset': { borderColor: focus },
    },
    '& .MuiInputBase-input::placeholder': { color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)', opacity: 1 },
    '& .MuiSelect-icon': { color: sub },
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { backgroundColor: bg, color: fg, backgroundImage: 'none' } }}>
      <DialogTitle sx={{ borderBottom: `1px solid ${border}`, pb: 1.5 }}>
        <Typography variant="subtitle1" fontWeight={700} color={fg}>Edit Service</Typography>
        <Typography variant="caption" sx={{ color: sub, display: 'block', mt: 0.25 }}>
          {row['Cloud Service']} &middot; {row['Business Unit']}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: '20px !important', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          {(['Cloud Provider Region', 'City (Primary)', 'Account ID (Primary)'] as const).map((label, i) => {
            const field = (['region', 'city', 'accountId'] as const)[i]
            return (
              <Box key={label}>
                <Typography variant="caption" sx={{ color: sub, mb: 0.5, display: 'block' }}>{label}</Typography>
                <TextField fullWidth size="small" value={values[field]} onChange={e => onChange(field, e.target.value)} sx={fieldSx} />
              </Box>
            )
          })}

          <Box>
            <Typography variant="caption" sx={{ color: sub, mb: 0.5, display: 'block' }}>Status (Primary)</Typography>
            <Select fullWidth size="small" value={values.status} displayEmpty
              onChange={(e: SelectChangeEvent) => onChange('status', e.target.value)}
              sx={{ ...fieldSx, '& .MuiSelect-select': { py: '8.5px', color: fg } }}>
              {STATUS_OPTIONS.map(s => (
                <MenuItem key={s} value={s} sx={{ fontSize: '0.85rem' }}>
                  {s || <em style={{ opacity: 0.5 }}>— not set —</em>}
                </MenuItem>
              ))}
            </Select>
          </Box>
        </Box>

        <Divider sx={{ borderColor: border }} />

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          {([['Category', row.category], ['Cloud Provider', row['Cloud Provider']], ['Country', row['Country (Primary)']], ['Cloud Service', row['Cloud Service']]] as [string, string][])
            .map(([label, val]) => (
              <Box key={label}>
                <Typography variant="caption" sx={{ color: dim, display: 'block' }}>{label}</Typography>
                <Typography variant="body2" sx={{ color: sub, fontSize: '0.8rem' }}>{val || '—'}</Typography>
              </Box>
            ))}
        </Box>
      </DialogContent>

      <DialogActions sx={{ borderTop: `1px solid ${border}`, px: 3, py: 1.5, gap: 1 }}>
        <Button onClick={onClose} size="small" sx={{ color: sub }}>Cancel</Button>
        <Button onClick={onSave} size="small" variant="contained" disableElevation
          sx={{ backgroundColor: focus, '&:hover': { backgroundColor: isDark ? '#1976d2' : '#1976d2' } }}>
          Save changes
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── ServiceTable ──────────────────────────────────────────────────────────

interface Props { rows: RowData[] }

export function ServiceTable({ rows }: Props) {
  const { palette } = useTheme()
  const isDark = palette.mode === 'dark'

  const [columnVisibility, setColumnVisibility] = useState<GridColumnVisibilityModel>(DEFAULT_VISIBILITY)
  const [paginationModel,  setPaginationModel]  = useState<PaginationModel>({ page: 0, pageSize: 25 })
  const [editingRow,       setEditingRow]       = useState<RowData | null>(null)
  const [editValues,       setEditValues]       = useState<EditValues>({ region: '', city: '', accountId: '', status: '' })
  const [overrides,        setOverrides]        = useState<Record<number, Partial<RowData>>>({})

  useEffect(() => {
    setPaginationModel(prev => ({ ...prev, page: 0 }))
  }, [rows])

  const displayRows = useMemo(
    () => rows.map(r => ({ ...r, ...overrides[r.id] })),
    [rows, overrides],
  )

  const handleEditOpen = useCallback((row: RowData) => {
    const merged = { ...row, ...overrides[row.id] }
    setEditingRow(row)
    setEditValues({
      region:    merged['Cloud Provider Region'],
      city:      merged['City (Primary)'],
      accountId: merged['Account ID (Primary)'],
      status:    merged['Status (Primary)'],
    })
  }, [overrides])

  const handleSave = useCallback(() => {
    if (!editingRow) return
    setOverrides(prev => ({
      ...prev,
      [editingRow.id]: {
        ...prev[editingRow.id],
        'Cloud Provider Region': editValues.region,
        'City (Primary)':        editValues.city,
        'Account ID (Primary)':  editValues.accountId,
        'Status (Primary)':      editValues.status,
      },
    }))
    setEditingRow(null)
  }, [editingRow, editValues])

  const editIconColor  = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'
  const editIconHover  = isDark ? '#4fc3f7' : '#1565c0'
  const editIconHoverBg = isDark ? 'rgba(79,195,247,0.1)' : 'rgba(21,101,192,0.08)'

  const columns = useMemo<GridColDef<RowData>[]>(() => [
    { field: 'category',                      headerName: 'Category',                    width: 200, renderCell: p => <CategoryChip value={p.value as string} /> },
    { field: 'Business Unit',                 headerName: 'Business Unit',               width: 160 },
    { field: 'Cloud Service',                 headerName: 'Cloud Service',               width: 200 },
    { field: 'Cloud Provider',                headerName: 'Cloud Provider',              width: 140 },
    { field: 'Cloud Provider Type',           headerName: 'Provider Type',               width: 130 },
    { field: 'Cloud Provider Region',         headerName: 'Provider Region',             width: 160 },
    { field: 'City (Primary)',                headerName: 'City (Primary)',              width: 130 },
    { field: 'State/Province (Primary)',      headerName: 'State (Primary)',             width: 130 },
    { field: 'Country (Primary)',             headerName: 'Country (Primary)',           width: 140 },
    { field: 'Cloud Domain',                  headerName: 'Cloud Domain',                width: 150 },
    { field: 'Landing Zone (Primary)',        headerName: 'Landing Zone (Primary)',      width: 190 },
    { field: 'Account ID (Primary)',          headerName: 'Account ID (Primary)',        width: 170 },
    { field: 'Status (Primary)',              headerName: 'Status (Primary)',            width: 150, renderCell: p => <StatusChip value={p.value as string} /> },
    { field: 'Target Quarter (Primary)',      headerName: 'Target Quarter (Primary)',    width: 170 },
    { field: 'Data Backup Region',            headerName: 'Data Backup Region',          width: 170 },
    { field: 'Disaster Recovery Region',      headerName: 'DR Region',                   width: 140 },
    { field: 'City (Secondary)',              headerName: 'City (Secondary)',            width: 130 },
    { field: 'State/Province (Secondary)',    headerName: 'State (Secondary)',           width: 140 },
    { field: 'Country (Secondary)',           headerName: 'Country (Secondary)',         width: 150 },
    { field: 'Landing Zone (Secondary)',      headerName: 'Landing Zone (Secondary)',    width: 200 },
    { field: 'Account ID (Secondary)',        headerName: 'Account ID (Secondary)',      width: 180 },
    { field: 'Deployment Status (Secondary)', headerName: 'Deployment Status',           width: 170, renderCell: p => <StatusChip value={p.value as string} /> },
    { field: 'Target Quarter (Secondary)',    headerName: 'Target Quarter (Secondary)', width: 180 },
    { field: 'Sovereignty Levels',            headerName: 'Sovereignty Levels',          width: 160 },
    {
      field: '__edit',
      headerName: '',
      width: 48,
      sortable: false, filterable: false, disableColumnMenu: true, resizable: false,
      renderCell: params => (
        <Tooltip title="Edit" placement="left">
          <IconButton size="small"
            onClick={e => { e.stopPropagation(); handleEditOpen(params.row as RowData) }}
            sx={{ color: editIconColor, '&:hover': { color: editIconHover, backgroundColor: editIconHoverBg } }}>
            <EditIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      ),
    },
  ], [handleEditOpen, editIconColor, editIconHover, editIconHoverBg])

  const headerBg    = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'
  const rowHover    = isDark ? 'rgba(79,195,247,0.07)'  : 'rgba(21,101,192,0.07)'
  const cellBorder  = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'
  const stripeEven  = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <DataGrid
        rows={displayRows}
        columns={columns}
        columnVisibilityModel={columnVisibility}
        onColumnVisibilityModelChange={setColumnVisibility}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pageSizeOptions={[25, 50, 100]}
        slots={{ toolbar: CustomToolbar }}
        slotProps={{
          toolbar: {
            paginationModel,
            onPaginationChange: setPaginationModel,
            totalRows: displayRows.length,
          },
        }}
        hideFooter
        disableRowSelectionOnClick
        density="compact"
        initialState={{
          sorting: { sortModel: [{ field: 'category', sort: 'asc' }] },
        }}
        sx={{
          flex: 1,
          border: 'none',
          '& .MuiDataGrid-toolbarContainer':   { p: 0 },
          '& .MuiDataGrid-columnHeaders':       { backgroundColor: headerBg },
          '& .MuiDataGrid-columnHeaderTitle':   { fontWeight: 800, fontSize: '0.78rem', letterSpacing: '0.02em' },
          '& .MuiDataGrid-row:nth-of-type(even)': { backgroundColor: stripeEven },
          '& .MuiDataGrid-row:hover':           { backgroundColor: `${rowHover} !important` },
          '& .MuiDataGrid-cell':                { borderColor: cellBorder },
          '& [data-field="__edit"]':            { justifyContent: 'center' },
        }}
      />

      {editingRow && (
        <EditModal
          row={editingRow} values={editValues}
          onChange={(f, v) => setEditValues(prev => ({ ...prev, [f]: v }))}
          onSave={handleSave}
          onClose={() => setEditingRow(null)}
        />
      )}
    </Box>
  )
}
