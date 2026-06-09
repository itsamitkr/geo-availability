# OT Cloud Services — Geo Availability

An interactive SPA dashboard for visualising OpenText cloud service deployments across regions and geographies.

> **Alpha** — actively under development, not GA. Data and features are subject to change without notice.

**Live:** https://ot-geo-availability.web.app  
**GitHub:** https://github.com/itsamitkr/geo-availability

---

## Overview

The dashboard aggregates data from 9 business-unit tabs in the source Excel file into a single unified view. It provides:

- A **globe/map view** showing where services are deployed, clustered by geography
- A **data table** with sorting, per-column filtering, and pagination
- **Global filters** by category and cloud provider, with faceted counts
- **Global search** across all fields
- **Session-only row editing** for cloud region, city, account ID, and status
- **Light / dark theme** toggle

---

## Features

### Map
- MapLibre GL with CARTO tile styles (dark-matter / Positron)
- Globe projection at low zoom, full tile detail on zoom-in
- Dot size scales with service count at each location
- Hover tooltip showing services, providers, and category breakdown
- Click a point to filter the table by that location's dominant category
- Floating legend (bottom-left) — clickable to toggle category filters
- Resizable split: drag the handle between map and table to resize

### Filter bar
- **Category** chips: Content, CyberSecurity Ent, Observability & Service Mgmt, Experience, Analytics AI & LegalTech, Business Network, ADM, CyberSecurity SMB, Portfolio
- **Provider** chips: AWS, Azure, GCP, OpenText
- Counts on each chip update based on the other active filters (faceted search)
- Clicking a map point pulses the matching category chip
- "Clear all" appears when any filter is active

### Table
- 731 rows across 9 categories, 24+ columns
- Striped rows, bold headers
- Column visibility toggle and column-level filters via toolbar
- Pagination in the toolbar header (25 / 50 / 100 rows per page)
- Edit pencil on each row opens a modal to modify: Cloud Provider Region, City, Account ID, Status — changes are session-only (no backend)

---

## Tech Stack

| Layer | Library |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| UI | Material UI v6 (MUI) |
| Data grid | MUI X DataGrid |
| Map | MapLibre GL + react-map-gl v8 |
| Map tiles | CARTO (no API key required) |
| Data parsing | xlsx (build-time script) |
| Hosting | Firebase Hosting |

---

## Project Structure

```
├── scripts/
│   ├── parse-excel.ts      # Build-time: reads Excel → tableData.json + geoData.json
│   └── geoLookup.ts        # Region/city → lat/lng lookup tables
├── src/
│   ├── App.tsx             # Root: theme, filters, layout, drag-to-resize
│   ├── components/
│   │   ├── MapView.tsx     # MapLibre globe, legend, tooltip
│   │   └── ServiceTable.tsx # DataGrid, custom toolbar, edit modal
│   ├── constants.ts        # Category/provider colours, helpers
│   ├── data/
│   │   ├── tableData.json  # Generated — 731 service rows
│   │   └── geoData.json    # Generated — 68 geo clusters
│   └── types/
│       └── index.ts        # RowData, GeoPoint types
├── firebase.json           # Firebase Hosting config
└── .firebaserc             # Firebase project: ot-geo-availability
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Install & run

```bash
npm install
npm run dev
```

### Regenerate data from source Excel

Place the source file at `raw/OT Cloud Services Geo Availability.xlsx`, then:

```bash
npm run parse-data
```

This regenerates `src/data/tableData.json` and `src/data/geoData.json`.

### Build & deploy

```bash
npm run build
firebase deploy --only hosting
```

---

## Data Sources

The dashboard reads the following tabs from the source Excel file:

| Tab | Category label |
|---|---|
| Content | Content |
| CyberSecurity Ent | CyberSecurity Ent |
| Observability & Service Mmgt | Observability & Service Mmgt |
| Experience | Experience |
| Analytics, AI, and LegalTech | Analytics, AI, and LegalTech |
| Business Network | Business Network |
| ADM | ADM |
| CyberSecurity SMB | CyberSecurity SMB |
| Portfolio | Portfolio |

Geo-coordinates are resolved from cloud provider region codes (e.g. `us-east-1`, `eastus`, `us-central1`) with city/country fallback and country-centroid as a last resort.
