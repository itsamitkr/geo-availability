export type RowData = {
  id: number
  category: string
  lat: number | null
  lng: number | null
  geoLabel: string
  'Business Unit': string
  'Cloud Service': string
  'Cloud Provider': string
  'Cloud Provider Type': string
  'Cloud Provider Region': string
  'City (Primary)': string
  'State/Province (Primary)': string
  'Country (Primary)': string
  'Cloud Domain': string
  'Landing Zone (Primary)': string
  'Account ID (Primary)': string
  'Status (Primary)': string
  'Target Quarter (Primary)': string
  'Data Backup Region': string
  'Disaster Recovery Region': string
  'City (Secondary)': string
  'State/Province (Secondary)': string
  'Country (Secondary)': string
  'Landing Zone (Secondary)': string
  'Account ID (Secondary)': string
  'Deployment Status (Secondary)': string
  'Target Quarter (Secondary)': string
  'Sovereignty Levels': string
}

export type GeoPoint = {
  lat: number
  lng: number
  label: string
  total: number
  byCategory: Record<string, number>
  providers: string[]
  services: string[]
}
