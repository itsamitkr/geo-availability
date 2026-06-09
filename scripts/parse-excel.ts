/**
 * Build-time script: reads OT Cloud Services Geo Availability.xlsx,
 * extracts the 9 target tabs, normalises the two-row merged header,
 * randomly samples 300 rows, anonymises sensitive fields, and writes:
 *   src/data/tableData.json  – flat row array for the DataGrid
 *   src/data/geoData.json    – aggregated geo points for the globe
 *
 * Anonymisation:
 *   - Account ID (Primary/Secondary)  → deterministic token (ACC-0001 …)
 *   - Landing Zone (Primary/Secondary) → first 6 chars + ****
 *   - Cloud Service                   → first 5 chars + **** (OpenText™ exempt)
 *
 * Run with: npm run parse-data
 */

import XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { resolveGeo } from './geoLookup.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.resolve(__dirname, '..')

const XLSX_PATH = path.join(ROOT, 'raw', 'OT Cloud Services Geo Availability.xlsx')
const TABLE_OUT = path.join(ROOT, 'src', 'data', 'tableData.json')
const GEO_OUT   = path.join(ROOT, 'src', 'data', 'geoData.json')

const SAMPLE_SIZE = 300
const SAMPLE_SEED = 20240609   // fixed seed → reproducible sample across re-runs

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

// ── Seeded PRNG (mulberry32) ───────────────────────────────────────────────

function makePRNG(seed: number): () => number {
  let s = seed
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Anonymisation helpers ─────────────────────────────────────────────────

const accountTokens = new Map<string, string>()
let tokenCounter = 1

/** Replace account/org/tenant/payer IDs with stable opaque tokens. */
function tokenize(val: string): string {
  if (!val.trim()) return val
  const key = val.trim().toLowerCase()
  if (!accountTokens.has(key)) {
    accountTokens.set(key, `ACC-${String(tokenCounter++).padStart(4, '0')}`)
  }
  return accountTokens.get(key)!
}

/** Keep first `n` chars of a Landing Zone name, replace the rest with ****. */
function maskLZ(val: string, n = 6): string {
  if (!val.trim() || val.length <= n) return val
  return val.slice(0, n) + '****'
}

/**
 * Mask a Cloud Service name after the first `n` chars.
 * OpenText™-branded services (name contains "opentext") are exempt.
 */
function maskService(val: string, n = 5): string {
  if (!val.trim()) return val
  if (/opentext/i.test(val)) return val
  if (val.length <= n) return val
  return val.slice(0, n) + '****'
}

function anonymise(row: RowData): RowData {
  return {
    ...row,
    'Account ID (Primary)':    tokenize(row['Account ID (Primary)']),
    'Account ID (Secondary)':  tokenize(row['Account ID (Secondary)']),
    'Landing Zone (Primary)':  maskLZ(row['Landing Zone (Primary)']),
    'Landing Zone (Secondary)': maskLZ(row['Landing Zone (Secondary)']),
    'Cloud Service':           maskService(row['Cloud Service']),
  }
}

// ── Sheet parsing ─────────────────────────────────────────────────────────

function isHeaderRow(row: unknown[]): boolean {
  return typeof row[0] === 'string' && row[0].trim().toLowerCase() === 'business unit'
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
    if (isHeaderRow(raw[i] as unknown[])) { headerIdx = i; break }
  }
  if (headerIdx === -1) {
    console.warn(`  Could not find header row in "${sheetName}" — skipping`)
    return []
  }

  const results: RowData[] = []
  for (const row of raw.slice(headerIdx + 1)) {
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
      lat:      geo ? geo.lat  : null,
      lng:      geo ? geo.lng  : null,
      geoLabel: geo?.label ?? '',
    } as unknown as RowData)
  }

  return results
}

// ── Geo aggregation ───────────────────────────────────────────────────────

function buildGeoPoints(rows: RowData[]): GeoPoint[] {
  const buckets = new Map<string, GeoPoint>()

  for (const row of rows) {
    if (row.lat == null || row.lng == null || isNaN(row.lat) || isNaN(row.lng)) continue

    const key = `${row.lat.toFixed(2)},${row.lng.toFixed(2)}`
    if (!buckets.has(key)) {
      buckets.set(key, {
        lat:        row.lat,
        lng:        row.lng,
        label:      row.geoLabel || `${row['City (Primary)']} ${row['Country (Primary)']}`.trim(),
        total:      0,
        byCategory: {},
        providers:  [],
        services:   [],
      })
    }

    const pt = buckets.get(key)!
    pt.total++
    pt.byCategory[row.category] = (pt.byCategory[row.category] ?? 0) + 1
    if (row['Cloud Provider'] && !pt.providers.includes(row['Cloud Provider']))
      pt.providers.push(row['Cloud Provider'])
    if (row['Cloud Service'] && !pt.services.includes(row['Cloud Service']))
      pt.services.push(row['Cloud Service'])
  }

  return Array.from(buckets.values()).sort((a, b) => b.total - a.total)
}

// ── Main ──────────────────────────────────────────────────────────────────

function main() {
  console.log('Reading:', XLSX_PATH)
  const wb = XLSX.readFile(XLSX_PATH)

  // 1. Parse all rows from all sheets
  const allRows: RowData[] = []
  let unresolved = 0
  for (const sheet of TARGET_SHEETS) {
    const category = sheet.trim()
    console.log(`Parsing sheet: "${sheet}"`)
    const rows = parseSheet(wb, sheet, category)
    console.log(`  → ${rows.length} rows`)
    for (const row of rows) {
      if (!row.lat) unresolved++
      allRows.push(row)
    }
  }
  console.log(`\nTotal parsed: ${allRows.length}  (${unresolved} without geo)`)

  // 2. Reproducible random sample
  const rand    = makePRNG(SAMPLE_SEED)
  const sampled = shuffled(allRows, rand).slice(0, SAMPLE_SIZE)
  console.log(`Sampled:      ${sampled.length} rows (seed ${SAMPLE_SEED})`)

  // 3. Anonymise + assign sequential IDs
  const anonymised = sampled.map((row, idx) => anonymise({ ...row, id: idx + 1 }))
  console.log(`Account tokens issued: ${tokenCounter - 1}`)

  // 4. Write outputs
  fs.writeFileSync(TABLE_OUT, JSON.stringify(anonymised, null, 2), 'utf-8')
  console.log('Table data →', TABLE_OUT)

  const geoPoints = buildGeoPoints(anonymised)
  console.log(`Geo points:   ${geoPoints.length}`)
  fs.writeFileSync(GEO_OUT, JSON.stringify(geoPoints, null, 2), 'utf-8')
  console.log('Geo data   →', GEO_OUT)
}

main()
