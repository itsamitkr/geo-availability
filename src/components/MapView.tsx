import { useCallback, useMemo, useRef, useState } from 'react'
import Map, {
  Source,
  Layer,
  type MapRef,
  type MapLayerMouseEvent,
} from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection, Point } from 'geojson'
import type { GeoPoint } from '../types'
import { CATEGORY_COLORS, CATEGORY_ORDER, dominantCategory, hexToRgba } from '../constants'

const MAP_STYLE_DARK  = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const MAP_STYLE_LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

const TOOLTIP_W = 290
const TOOLTIP_H = 280
const GAP       = 14

function tooltipStyle(cursorX: number, cursorY: number, mapRect: DOMRect): React.CSSProperties {
  let left = cursorX + GAP
  if (left + TOOLTIP_W > mapRect.right - 4) left = cursorX - TOOLTIP_W - GAP
  left = Math.max(mapRect.left + 4, left)

  let top = cursorY - TOOLTIP_H - GAP
  if (top < mapRect.top + 4) top = cursorY + GAP + 16
  top = Math.min(mapRect.bottom - TOOLTIP_H - 4, top)

  return { position: 'fixed', left, top, zIndex: 9999, pointerEvents: 'none', width: TOOLTIP_W }
}

interface HoverInfo { point: GeoPoint; cursorX: number; cursorY: number }

interface Props {
  points:           GeoPoint[]
  selectedCategory: string | null
  selectedProvider: string | null
  onSelectCategory: (cat: string | null) => void
  isDark:           boolean
}

export function MapView({ points, selectedCategory, selectedProvider, onSelectCategory, isDark }: Props) {
  const mapRef    = useRef<MapRef>(null)
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null)

  const filteredPoints = useMemo(() => points.filter(p => {
    if (selectedCategory && !p.byCategory[selectedCategory]) return false
    if (selectedProvider && !p.providers.includes(selectedProvider)) return false
    return true
  }), [points, selectedCategory, selectedProvider])

  // Categories present in the filtered point set, in canonical order
  const presentCategories = useMemo(() => {
    const seen = new Set<string>()
    filteredPoints.forEach(p => Object.keys(p.byCategory).forEach(c => seen.add(c)))
    return CATEGORY_ORDER.filter(c => seen.has(c))
  }, [filteredPoints])

  const geojson = useMemo<FeatureCollection<Point>>(() => ({
    type: 'FeatureCollection',
    features: filteredPoints.map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        total:      p.total,
        label:      p.label,
        color:      CATEGORY_COLORS[dominantCategory(p.byCategory)] ?? '#546e7a',
        providers:  p.providers.join(' · '),
        services:   [
          ...p.services.slice(0, 4),
          ...(p.services.length > 4 ? [`+${p.services.length - 4} more`] : []),
        ].join(', '),
        byCategory: JSON.stringify(p.byCategory),
        lat: p.lat,
        lng: p.lng,
      },
    })),
  }), [filteredPoints])

  // Re-apply globe projection on every style load (fires on initial load + style switches)
  const onMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    const applyGlobe = () => {
      try { (map as unknown as { setProjection(p: unknown): void }).setProjection({ name: 'globe' }) }
      catch { /* falls back to mercator */ }
    }
    applyGlobe()
    map.on('style.load', applyGlobe)
  }, [])

  const onMouseMove = useCallback((e: MapLayerMouseEvent) => {
    const f = e.features?.[0]
    if (!f) { setHoverInfo(null); return }
    const props = f.properties as Record<string, unknown>
    const geom  = f.geometry as Point
    const { clientX, clientY } = e.originalEvent as MouseEvent
    setHoverInfo({
      cursorX: clientX,
      cursorY: clientY,
      point: {
        lat:        Number(props.lat),
        lng:        Number(props.lng),
        label:      String(props.label),
        total:      Number(props.total),
        providers:  String(props.providers).split(' · '),
        services:   String(props.services).split(', '),
        byCategory: JSON.parse(String(props.byCategory)) as Record<string, number>,
      },
    })
    void geom
  }, [])

  const onMouseMoveRaw = useCallback((e: React.MouseEvent) => {
    setHoverInfo(prev => prev ? { ...prev, cursorX: e.clientX, cursorY: e.clientY } : null)
  }, [])

  const onMouseLeave = useCallback(() => setHoverInfo(null), [])

  const onClick = useCallback((e: MapLayerMouseEvent) => {
    const f = e.features?.[0]
    if (!f) return
    const byCategory = JSON.parse(String((f.properties as Record<string, unknown>).byCategory)) as Record<string, number>
    const cat = dominantCategory(byCategory)
    onSelectCategory(selectedCategory === cat ? null : cat)
  }, [selectedCategory, onSelectCategory])

  const mapRect = mapRef.current?.getContainer().getBoundingClientRect()
    ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight)

  const ttStyle   = hoverInfo ? tooltipStyle(hoverInfo.cursorX, hoverInfo.cursorY, mapRect) : null
  const hp        = hoverInfo?.point
  const accentColor = hp ? (CATEGORY_COLORS[dominantCategory(hp.byCategory)] ?? '#555') : '#555'

  // Theme-aware tooltip colors
  const ttBg      = isDark ? 'rgba(12,16,30,0.97)'    : 'rgba(255,255,255,0.97)'
  const ttColor   = isDark ? '#fff'                    : '#0d1526'
  const ttMuted   = isDark ? 'rgba(255,255,255,0.45)'  : 'rgba(0,0,0,0.45)'
  const ttDim     = isDark ? 'rgba(255,255,255,0.3)'   : 'rgba(0,0,0,0.35)'

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }} onMouseMove={onMouseMoveRaw}>
      <Map
        ref={mapRef}
        mapStyle={isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
        initialViewState={{ longitude: 10, latitude: 20, zoom: 1.5 }}
        style={{ width: '100%', height: '100%' }}
        interactiveLayerIds={['point-circles']}
        onLoad={onMapLoad}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
        attributionControl={false}
        cursor={hoverInfo ? 'pointer' : 'grab'}
      >
        <Source id="geo-points" type="geojson" data={geojson}>
          {/* Glow halo */}
          <Layer
            id="point-glow"
            type="circle"
            paint={{
              'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                0, ['interpolate', ['linear'], ['get', 'total'], 1, 8,  200, 18],
                8, ['interpolate', ['linear'], ['get', 'total'], 1, 18, 200, 42],
              ],
              'circle-color':   ['get', 'color'],
              'circle-opacity': isDark ? 0.15 : 0.25,
              'circle-blur':    isDark ? 1 : 0.8,
            }}
          />
          {/* Solid dot */}
          <Layer
            id="point-circles"
            type="circle"
            paint={{
              'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                0, ['interpolate', ['linear'], ['get', 'total'], 1, 3,  200, 8],
                8, ['interpolate', ['linear'], ['get', 'total'], 1, 7,  200, 22],
              ],
              'circle-color':        ['get', 'color'],
              'circle-opacity':      0.9,
              'circle-stroke-width': isDark ? 1.5 : 2,
              'circle-stroke-color': isDark ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.8)',
            }}
          />
          {/* City labels — appear at zoom 4+ */}
          <Layer
            id="point-labels"
            type="symbol"
            minzoom={4}
            layout={{
              'text-field':         ['get', 'label'],
              'text-size':          11,
              'text-anchor':        'top',
              'text-offset':        [0, 0.9],
              'text-allow-overlap': false,
            }}
            paint={{
              'text-color':      isDark ? '#ffffff' : '#1a1a2e',
              'text-halo-color': isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)',
              'text-halo-width': 1.5,
            }}
          />
        </Source>
      </Map>

      {/* ── Legend ─────────────────────────────────────────────────── */}
      {presentCategories.length > 0 && (
        <div style={{
          position:       'absolute',
          bottom:         16,
          left:           16,
          background:     isDark ? 'rgba(12,16,30,0.88)' : 'rgba(255,255,255,0.92)',
          border:         isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
          borderRadius:   10,
          padding:        '8px 12px',
          backdropFilter: 'blur(10px)',
          boxShadow:      isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.1)',
          minWidth:       140,
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)', marginBottom: 6 }}>
            Categories
          </div>
          {presentCategories.map(cat => {
            const color    = CATEGORY_COLORS[cat] ?? '#546e7a'
            const isActive = selectedCategory === cat
            const isDimmed = selectedCategory !== null && !isActive
            return (
              <div
                key={cat}
                onClick={() => onSelectCategory(isActive ? null : cat)}
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  gap:            7,
                  padding:        '3px 5px',
                  borderRadius:   5,
                  cursor:         'pointer',
                  opacity:        isDimmed ? 0.35 : 1,
                  backgroundColor: isActive ? hexToRgba(color, isDark ? 0.2 : 0.12) : 'transparent',
                  transition:     'all 0.15s',
                }}
              >
                <div style={{
                  width:        10,
                  height:       10,
                  borderRadius: '50%',
                  backgroundColor: color,
                  border:       isActive ? `2px solid ${color}` : '2px solid transparent',
                  boxShadow:    isActive ? `0 0 5px ${hexToRgba(color, 0.6)}` : 'none',
                  flexShrink:   0,
                  transition:   'all 0.15s',
                }} />
                <span style={{
                  fontSize:   11,
                  fontWeight: isActive ? 700 : 400,
                  color:      isDark
                    ? (isDimmed ? 'rgba(255,255,255,0.4)' : '#fff')
                    : (isDimmed ? 'rgba(0,0,0,0.3)' : '#0d1526'),
                  whiteSpace: 'nowrap',
                  transition: 'color 0.15s',
                }}>
                  {cat}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {hoverInfo && ttStyle && hp && (
        <div style={{
          ...ttStyle,
          background:   ttBg,
          border:       `1px solid ${accentColor}`,
          borderRadius: 8,
          padding:      '10px 14px',
          color:        ttColor,
          fontFamily:   'Inter, Roboto, sans-serif',
          fontSize:     12,
          boxShadow:    isDark ? '0 8px 32px rgba(0,0,0,0.65)' : '0 8px 32px rgba(0,0,0,0.18)',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 3, fontSize: 13 }}>
            {hp.label}
          </div>
          <div style={{ color: ttMuted, marginBottom: 8, fontSize: 11 }}>
            {hp.providers.join(' · ')}
          </div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            {hp.total} services
          </div>
          {Object.entries(hp.byCategory)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, count]) => (
              <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ color: CATEGORY_COLORS[cat] ?? '#888', fontSize: 11 }}>{cat}</span>
                <span style={{ color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.7)', fontSize: 11, marginLeft: 16 }}>{count}</span>
              </div>
            ))}
          {hp.services[0] && (
            <div style={{ color: ttDim, marginTop: 6, fontSize: 10 }}>
              {hp.services.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
