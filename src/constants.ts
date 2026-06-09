export const CATEGORY_ORDER = [
  'Content',
  'CyberSecurity Ent',
  'Observability & Service Mmgt',
  'Experience',
  'Analytics, AI, and LegalTech',
  'Business Network',
  'ADM',
  'CyberSecurity SMB',
  'Portfolio',
] as const

export const CATEGORY_COLORS: Record<string, string> = {
  'Content':                       '#1565c0',
  'CyberSecurity Ent':             '#c62828',
  'Observability & Service Mmgt':  '#00838f',
  'Experience':                    '#2e7d32',
  'Analytics, AI, and LegalTech':  '#6a1b9a',
  'Business Network':              '#e65100',
  'ADM':                           '#546e7a',
  'CyberSecurity SMB':             '#e53935',
  'Portfolio':                     '#0277bd',
}

export const PROVIDER_COLORS: Record<string, string> = {
  AWS:      '#FF9900',
  Azure:    '#0078D4',
  GCP:      '#4285F4',
  OpenText: '#00B398',
}

export const PROVIDERS = ['AWS', 'Azure', 'GCP', 'OpenText'] as const

export function dominantCategory(byCategory: Record<string, number>): string {
  return (
    CATEGORY_ORDER.find(c => byCategory[c]) ??
    Object.keys(byCategory)[0] ??
    'Portfolio'
  )
}

export function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}
