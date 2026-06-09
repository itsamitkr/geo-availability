import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AppBar,
  Box,
  Chip,
  CssBaseline,
  IconButton,
  InputAdornment,
  InputBase,
  Toolbar,
  Tooltip,
  Typography,
  ThemeProvider,
  createTheme,
  alpha,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import { MapView } from './components/MapView'
import { ServiceTable } from './components/ServiceTable'
import tableData from './data/tableData.json'
import geoData from './data/geoData.json'
import {
  CATEGORY_COLORS,
  CATEGORY_ORDER,
  PROVIDER_COLORS,
  PROVIDERS,
  hexToRgba,
} from './constants'
import type { GeoPoint, RowData } from './types'

function buildTheme(mode: 'light' | 'dark') {
  return createTheme({
    palette: {
      mode,
      primary:    { main: mode === 'dark' ? '#4fc3f7' : '#1565c0' },
      secondary:  { main: '#1565c0' },
      background: mode === 'dark'
        ? { default: '#0a0e1a', paper: '#111827' }
        : { default: '#f0f4f8', paper: '#ffffff' },
      text: mode === 'dark'
        ? { primary: '#ffffff', secondary: 'rgba(255,255,255,0.6)' }
        : { primary: '#0d1526', secondary: '#546e7a' },
    },
    typography: { fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif' },
    shape: { borderRadius: 8 },
  })
}

// ── Filter chip ───────────────────────────────────────────────────────────

function FilterChip({
  label, color, active, dimmed, isDark, count, pulsing, onClick,
}: {
  label: string; color: string; active: boolean; dimmed: boolean
  isDark: boolean; count?: number; pulsing?: boolean; onClick: () => void
}) {
  const bgDimmed = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
  const fgDimmed = isDark ? 'rgba(255,255,255,0.3)'  : 'rgba(0,0,0,0.25)'

  return (
    <Chip
      size="small"
      onClick={onClick}
      label={
        <Box component="span" sx={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
          <span>{label}</span>
          {count != null && (
            <Box component="span" sx={{ fontSize: '0.6rem', fontWeight: 400, opacity: dimmed ? 0.5 : 0.65 }}>
              {count}
            </Box>
          )}
        </Box>
      }
      sx={{
        fontSize: '0.7rem',
        height: 24,
        flexShrink: 0,
        backgroundColor: dimmed ? bgDimmed : hexToRgba(color, active ? 0.9 : isDark ? 0.22 : 0.75),
        color: dimmed ? fgDimmed : '#fff',
        fontWeight: active ? 700 : 400,
        border: active ? `1.5px solid ${color}` : '1.5px solid transparent',
        cursor: 'pointer',
        // Glow ring fades in instantly, fades out over 0.7s when pulsing clears
        transition: 'all 0.18s, box-shadow 0.7s ease-out',
        boxShadow: pulsing
          ? `0 0 0 3px ${hexToRgba(color, 0.55)}, 0 0 14px ${hexToRgba(color, 0.3)}`
          : 'none',
        '&:hover': { backgroundColor: hexToRgba(color, 0.85), color: '#fff' },
        '& .MuiChip-label': { px: '8px' },
      }}
    />
  )
}

// ── App ───────────────────────────────────────────────────────────────────

export default function App() {
  const rows   = tableData as RowData[]
  const points = geoData as GeoPoint[]

  // ── Theme ──────────────────────────────────────────────────────────────
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light')
  const theme  = useMemo(() => buildTheme(themeMode), [themeMode])
  const isDark = themeMode === 'dark'

  // ── Filters ────────────────────────────────────────────────────────────
  const [searchTerm,     setSearchTerm]     = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [providerFilter, setProviderFilter] = useState<string | null>(null)
  const [pulsingChip,    setPulsingChip]    = useState<string | null>(null)

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return rows.filter(r => {
      if (categoryFilter && r.category !== categoryFilter) return false
      if (providerFilter && r['Cloud Provider'] !== providerFilter) return false
      if (term) return Object.values(r).some(v => typeof v === 'string' && v.toLowerCase().includes(term))
      return true
    })
  }, [rows, categoryFilter, providerFilter, searchTerm])

  // Faceted counts: each axis is counted after the OTHER axis's filter + search
  const categoryCounts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return rows.reduce((acc, r) => {
      if (providerFilter && r['Cloud Provider'] !== providerFilter) return acc
      if (term && !Object.values(r).some(v => typeof v === 'string' && v.toLowerCase().includes(term))) return acc
      acc[r.category] = (acc[r.category] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)
  }, [rows, providerFilter, searchTerm])

  const providerCounts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return rows.reduce((acc, r) => {
      if (categoryFilter && r.category !== categoryFilter) return acc
      if (term && !Object.values(r).some(v => typeof v === 'string' && v.toLowerCase().includes(term))) return acc
      acc[r['Cloud Provider']] = (acc[r['Cloud Provider']] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)
  }, [rows, categoryFilter, searchTerm])

  const anyActive = !!(categoryFilter ?? providerFilter ?? searchTerm.trim())

  // When a map point is clicked, set filter + pulse the corresponding chip
  const handleMapCategorySelect = useCallback((cat: string | null) => {
    setCategoryFilter(prev => {
      if (cat && cat !== prev) {
        setPulsingChip(cat)
        setTimeout(() => setPulsingChip(null), 1400)
      }
      return cat
    })
  }, [])

  // ── Resizable map / table split ────────────────────────────────────────
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef   = useRef(false)
  const [mapHeightPx, setMapHeightPx] = useState(() => Math.round(window.innerHeight * 0.45))

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingRef.current = true
    document.body.style.cursor    = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !mapContainerRef.current) return
      const rect = mapContainerRef.current.getBoundingClientRect()
      const newH = e.clientY - rect.top
      setMapHeightPx(Math.max(150, Math.min(window.innerHeight * 0.78, newH)))
    }
    const onUp = () => {
      if (!isDraggingRef.current) return
      isDraggingRef.current         = false
      document.body.style.cursor    = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',   onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup',   onUp)
    }
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────
  const borderMuted = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)'

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{
        display: 'flex', flexDirection: 'column', height: '100vh',
        background: isDark
          ? 'linear-gradient(180deg,#0a0e1a 0%,#0d1526 100%)'
          : 'linear-gradient(180deg,#e8f0fe 0%,#f0f4f8 100%)',
        overflow: 'hidden',
      }}>

        {/* ── AppBar ─────────────────────────────────────────────── */}
        <AppBar position="static" elevation={0} sx={{
          background: isDark ? 'rgba(10,14,26,0.9)' : 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${borderMuted}`,
          color: isDark ? '#fff' : '#0d1526',
        }}>
          <Toolbar sx={{ gap: 2, minHeight: '52px !important' }}>
            <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1, letterSpacing: '-0.3px', whiteSpace: 'nowrap', color: 'inherit' }}>
              OT Cloud Services &mdash; Geo Availability
            </Typography>

            <Box sx={{
              display: 'flex', alignItems: 'center',
              backgroundColor: isDark ? alpha('#fff', 0.07) : alpha('#000', 0.05),
              borderRadius: 2,
              border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.12)',
              px: 1.5, py: 0.4, minWidth: 240,
              '&:focus-within': {
                border: isDark ? '1px solid rgba(79,195,247,0.5)' : '1px solid rgba(21,101,192,0.5)',
                backgroundColor: isDark ? alpha('#fff', 0.09) : alpha('#000', 0.07),
              },
            }}>
              <SearchIcon sx={{ fontSize: 16, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', mr: 1 }} />
              <InputBase
                placeholder="Search services, regions, countries…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                sx={{
                  fontSize: '0.8rem',
                  color: isDark ? '#fff' : '#0d1526',
                  '& input::placeholder': { color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)', opacity: 1 },
                }}
                endAdornment={
                  searchTerm
                    ? <InputAdornment position="end">
                        <Box component="span" onClick={() => setSearchTerm('')}
                          sx={{ fontSize: '0.7rem', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', cursor: 'pointer', '&:hover': { color: isDark ? '#fff' : '#000' } }}>
                          ✕
                        </Box>
                      </InputAdornment>
                    : null
                }
              />
            </Box>

            <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
              <IconButton
                size="small"
                onClick={() => setThemeMode(m => m === 'dark' ? 'light' : 'dark')}
                sx={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)', '&:hover': { color: isDark ? '#fff' : '#000' } }}
              >
                {isDark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>

        {/* ── Alpha banner ───────────────────────────────────────── */}
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 1, px: 2, py: '5px', flexShrink: 0,
          backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(180,83,9,0.07)',
          borderBottom: isDark ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(180,83,9,0.2)',
        }}>
          <Box component="span" sx={{
            fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em',
            px: '6px', py: '1px', borderRadius: '4px',
            backgroundColor: isDark ? 'rgba(245,158,11,0.25)' : 'rgba(180,83,9,0.15)',
            color: isDark ? '#fbbf24' : '#92400e',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}>
            Alpha
          </Box>
          <Typography variant="caption" sx={{
            fontSize: '0.7rem',
            color: isDark ? 'rgba(251,191,36,0.75)' : 'rgba(120,53,15,0.8)',
            letterSpacing: '0.01em',
          }}>
            Actively under development, not GA. Data and features are subject to change without notice.
          </Typography>
        </Box>

        {/* ── Filter bar ─────────────────────────────────────────── */}
        <Box sx={{
          display: 'flex', flexDirection: 'column', flexShrink: 0,
          background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.03)',
          borderBottom: `1px solid ${borderMuted}`,
        }}>
          {/* Row 1: Category */}
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 0.75,
            px: 2, pt: 0.75, pb: 0.5, overflowX: 'auto',
            '&::-webkit-scrollbar': { height: 3 },
            '&::-webkit-scrollbar-thumb': { background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)', borderRadius: 2 },
          }}>
            <Typography variant="caption" sx={{ color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)', whiteSpace: 'nowrap', flexShrink: 0, width: 62 }}>
              Category
            </Typography>
            {CATEGORY_ORDER.map(cat => (
              <FilterChip
                key={cat} label={cat}
                color={CATEGORY_COLORS[cat] ?? '#546e7a'}
                active={categoryFilter === cat}
                dimmed={categoryFilter !== null && categoryFilter !== cat}
                isDark={isDark}
                count={categoryCounts[cat] ?? 0}
                pulsing={pulsingChip === cat}
                onClick={() => setCategoryFilter(p => p === cat ? null : cat)}
              />
            ))}
          </Box>

          {/* Row 2: Provider + Clear all */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 2, pt: 0.5, pb: 0.75 }}>
            <Typography variant="caption" sx={{ color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)', whiteSpace: 'nowrap', flexShrink: 0, width: 62 }}>
              Provider
            </Typography>
            {PROVIDERS.map(p => (
              <FilterChip
                key={p} label={p}
                color={PROVIDER_COLORS[p] ?? '#546e7a'}
                active={providerFilter === p}
                dimmed={providerFilter !== null && providerFilter !== p}
                isDark={isDark}
                count={providerCounts[p] ?? 0}
                onClick={() => setProviderFilter(prev => prev === p ? null : p)}
              />
            ))}
            {anyActive && (
              <>
                <Box sx={{ flex: 1 }} />
                <Chip
                  label="Clear all" size="small"
                  onClick={() => { setCategoryFilter(null); setProviderFilter(null); setSearchTerm('') }}
                  sx={{
                    fontSize: '0.68rem', height: 24, flexShrink: 0,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                    color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                    border: `1.5px solid ${borderMuted}`,
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: 'rgba(255,80,80,0.15)', color: isDark ? '#ff8080' : '#c62828', borderColor: '#ff5555' },
                  }}
                />
              </>
            )}
          </Box>
        </Box>

        {/* ── Map ────────────────────────────────────────────────── */}
        <Box
          ref={mapContainerRef}
          sx={{ flex: `0 0 ${mapHeightPx}px`, position: 'relative', overflow: 'hidden' }}
        >
          <MapView
            points={points}
            selectedCategory={categoryFilter}
            selectedProvider={providerFilter}
            onSelectCategory={handleMapCategorySelect}
            isDark={isDark}
          />
        </Box>

        {/* ── Drag handle ─────────────────────────────────────────── */}
        <Box
          onMouseDown={handleDragStart}
          sx={{
            height: 8, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'row-resize',
            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)',
            borderTop: `1px solid ${borderMuted}`,
            borderBottom: `1px solid ${borderMuted}`,
            transition: 'background-color 0.15s',
            '&:hover': {
              backgroundColor: isDark ? 'rgba(79,195,247,0.12)' : 'rgba(21,101,192,0.08)',
              '& > div': { backgroundColor: isDark ? 'rgba(79,195,247,0.6)' : 'rgba(21,101,192,0.4)' },
            },
          }}
        >
          <Box sx={{ width: 36, height: 3, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)', transition: 'background-color 0.15s' }} />
        </Box>

        {/* ── Table ──────────────────────────────────────────────── */}
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', p: 1.5 }}>
          <ServiceTable rows={filteredRows} />
        </Box>

      </Box>
    </ThemeProvider>
  )
}
