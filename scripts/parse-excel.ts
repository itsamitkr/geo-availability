/**
 * Build-time script: reads OT Cloud Services Geo Availability.xlsx,
 * extracts the 9 target tabs, normalizes the two-row merged header,
 * and writes:
 *   src/data/tableData.json  – flat row array for the DataGrid
 *   src/data/geoData.json    – aggregated geo points for the globe
 *
 * Run with: npm run parse-data
 */

import XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { resolveGeo } from './geoLookup.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const XLSX_PATH = path.join(ROOT, 'raw', 'OT Cloud Services Geo Availability.xlsx')
const TABLE_OUT  = path.join(ROOT, 'src', 'data', 'tableData.json')
const GEO_OUT    = path.join(ROOT, 'src', 'data', 'geoData.json')

const TARGET_SHEETS = [
  'Content',
  'CyberSecurity Ent',
  'Observability & Service Mmgt',
  'Experience',
  'Analytics, AI, and LegalTech',
  'Business Network',
  'ADM',
  'CyberSecurity SMB ',
  'Portfolio',
] as const

const CANONICAL_COLUMNS = [
  'Business Unit',
  'Cloud Service',
  'Cloud Provider',
  'Cloud Provider Type',
  'Cloud Provider Region',
  'City (Primary)',
  'State/Province (Primary)',
  'Country (Primary)',
  'Cloud Domain',
  'Landing Zone (Primary)',
  'Account ID (Primary)',
  'Status (Primary)',
  'Target Quarter (Primary)',
  'Data Backup Region',
  'Disaster Recovery Region',
  'City (Secondary)',
  'State/Province (Secondary)',
  'Country (Secondary)',
  'Landing Zone (Secondary)',
  'Account ID (Secondary)',
  'Deployment Status (Secondary)',
  'Target Quarter (Secondary)',
  'Sovereignty Levels',
] as const

export type RowData = {
  id: number
  category: string
  lat: number | null
  lng: number | null
  geoLabel: string
} & Record<(typeof CANONICAL_COLUMNS)[number], string>

export type GeoPoint = {
  lat: number
  lng: number
  label: string
  total: number
  byCategory: Record<string, number>
  providers: string[]
  services: string[]
}

function isHeaderRow(row: unknown[]): boolean {
  return (
    typeof row[0] === 'string' &&
    row[0].trim().toLowerCase() === 'business unit'
  )
}

function parseSheet(wb: XLSX.WorkBook, sheetName: string, category: string): RowData[] {
  const ws = wb.Sheets[sheetName]
  if (!ws) {
    console.warn(`  Sheet "${sheetName}" not found — skipping`)
    return []
  }

  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })

  let headerIdx = -1
  for (let i = 0; i < raw.length; i++) {
    if (isHeaderRow(raw[i] as unknown[])) {
      headerIdx = i
      break
    }
  }

  if (headerIdx === -1) {
    console.warn(`  Could not find header row in "${sheetName}" — skipping`)
    return []
  }

  const dataRows = raw.slice(headerIdx + 1)
  const results: RowData[] = []

  for (const row of dataRows) {
    const cells = row as unknown[]
    if (cells.every(c => c === '' || c == null)) continue

    const entry: Record<string, string> = { category }
    CANONICAL_COLUMNS.forEach((col, idx) => {
      const val = cells[idx]
      entry[col] = val != null && val !== '' ? String(val).trim() : ''
    })

    const geo = resolveGeo(
      entry['Cloud Provider Region'] ?? '',
      entry['City (Primary)'] ?? '',
      entry['Country (Primary)'] ?? '',
    )

    results.push({
      ...entry,
      lat: geo ? geo.lat : null,
      lng: geo ? geo.lng : null,
      geoLabel: geo?.label ?? '',
    } as unknown as RowData)
  }

  return results
}

function buildGeoPoints(rows: RowData[]): GeoPoint[] {
  const buckets = new Map<string, GeoPoint>()

  for (const row of rows) {
    if (row.lat == null || row.lng == null) continue

    const lat = row.lat
    const lng = row.lng
    if (isNaN(lat) || isNaN(lng)) continue

    // Round to 2dp so nearby rows share a bucket
    const key = `${lat.toFixed(2)},${lng.toFixed(2)}`

    if (!buckets.has(key)) {
      buckets.set(key, {
        lat,
        lng,
        label: row.geoLabel || `${row['City (Primary)']} ${row['Country (Primary)']}`.trim(),
        total: 0,
        byCategory: {},
        providers: [],
        services: [],
      })
    }

    const pt = buckets.get(key)!
    pt.total++
    pt.byCategory[row.category] = (pt.byCategory[row.category] ?? 0) + 1
    if (row['Cloud Provider'] && !pt.providers.includes(row['Cloud Provider'])) {
      pt.providers.push(row['Cloud Provider'])
    }
    if (row['Cloud Service'] && !pt.services.includes(row['Cloud Service'])) {
      pt.services.push(row['Cloud Service'])
    }
  }

  return Array.from(buckets.values()).sort((a, b) => b.total - a.total)
}

function main() {
  console.log('Reading:', XLSX_PATH)
  const wb = XLSX.readFile(XLSX_PATH)

  const allRows: RowData[] = []
  let id = 1
  let unresolved = 0

  for (const sheet of TARGET_SHEETS) {
    const category = sheet.trim()
    console.log(`Parsing sheet: "${sheet}"`)
    const rows = parseSheet(wb, sheet, category)
    console.log(`  → ${rows.length} data rows`)
    for (const row of rows) {
      if (!row['lat']) unresolved++
      allRows.push({ ...row, id: id++ })
    }
  }

  console.log(`\nTotal rows: ${allRows.length}  (${unresolved} without geo)`)

  fs.writeFileSync(TABLE_OUT, JSON.stringify(allRows, null, 2), 'utf-8')
  console.log('Table data →', TABLE_OUT)

  const geoPoints = buildGeoPoints(allRows)
  console.log(`Geo points: ${geoPoints.length}`)
  fs.writeFileSync(GEO_OUT, JSON.stringify(geoPoints, null, 2), 'utf-8')
  console.log('Geo data  →', GEO_OUT)
}

main()
