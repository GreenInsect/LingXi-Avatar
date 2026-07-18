import { useEffect, useRef, useState } from 'react'
import { spots, routes, scenicInfo } from '../data/lingshan'
import type { Spot, Route } from '../types'

// ================================================================
// 高德地图 API Key — 在此处替换为你的 Key
// 申请地址: https://console.amap.com/dev/key/app
// ================================================================
const AMAP_KEY = 'bc37009fd9f4e652e387802474fec299'

declare global {
  interface Window {
    AMap: any
    AMapUI: any
    _mapLoaded?: boolean
  }
}

const CAT_COLORS: Record<string, string> = {
  landmark: '#c0392b', performance: '#e67e22', temple: '#8e44ad',
  culture: '#2980b9', worship: '#d35400', nature: '#27ae60',
}

const CAT_LABELS: Record<string, string> = {
  landmark: '地标', performance: '演出', temple: '寺庙',
  culture: '文化', worship: '祈福', nature: '自然',
}

export default function MapPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<any>(null)
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null)
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null)
  const [planning, setPlanning] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [searchTips, setSearchTips] = useState<any[]>([])
  const [userPos, setUserPos] = useState<[number, number] | null>(null)
  const [arMode, setArMode] = useState(false)
  const [arTarget, setArTarget] = useState<Spot | null>(null)

  useEffect(() => {
    if (window.AMap && window._mapLoaded) { initMap(); return }
    if (document.querySelector('#amap-script')) return

    const s = document.createElement('script')
    s.id = 'amap-script'
    s.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.PlaceSearch,AMap.AutoComplete,AMap.MarkerCluster,AMap.Driving,AMap.Scale,AMap.ToolBar`
    s.async = true
    s.onload = () => { window._mapLoaded = true; initMap() }
    s.onerror = () => console.warn('高德地图加载失败，请检查 API Key')
    document.head.appendChild(s)
  }, [])

  function initMap() {
    if (!containerRef.current || !window.AMap) return
    const m = new window.AMap.Map(containerRef.current, {
      zoom: 15, center: [120.1006, 31.4258],
      mapStyle: 'amap://styles/light', viewMode: '3D',
    })
    m.addControl(new window.AMap.Scale())
    m.addControl(new window.AMap.ToolBar({ position: 'RT' }))

    const markers = spots.filter(s => s.coords).map(spot => {
      const color = CAT_COLORS[spot.category] || '#c0392b'
      const marker = new window.AMap.Marker({
        position: spot.coords, title: spot.name,
        label: {
          content: `<div style="background:${color};color:#fff;padding:1px 6px;border-radius:3px;font-size:10px;white-space:nowrap">${CAT_LABELS[spot.category] || '景点'}</div>`,
          direction: 'top',
        },
        icon: new window.AMap.Icon({
          image: markerSVG(color), size: [28, 36], imageSize: [28, 36],
        }),
        anchor: 'bottom-center',
      })
      marker.on('click', () => setSelectedSpot(spot))
      return marker
    })
    m.add(markers)
    m.setFitView(null, false, [60, 60, 60, 60])

    if (selectedRoute) drawRoute(m, selectedRoute)

    window.AMap.plugin('AMap.Geolocation', () => {
      const geo = new window.AMap.Geolocation({ enableHighAccuracy: true, timeout: 5000 })
      geo.getCurrentPosition((status: string, result: any) => {
        if (status === 'complete') {
          const pos = [result.position.lng, result.position.lat]
          m.add(new window.AMap.Marker({
            position: pos,
            icon: new window.AMap.Icon({
              image: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="#2196F3" stroke="white" stroke-width="3"/><circle cx="10" cy="10" r="3" fill="white"/></svg>'),
              size: [20, 20], imageSize: [20, 20],
            }),
            zIndex: 999, anchor: 'center',
          }))
        }
      })
    })
    setMap(m)
  }

  function drawRoute(m: any, route: Route) {
    if (!window.AMap) return
    const routeSpots = route.steps
      .map(name => spots.find(s => s.name.includes(name) || name.includes(s.name)))
      .filter(Boolean) as Spot[]
    if (routeSpots.length < 2) return
    m.add(new window.AMap.Polyline({
      path: routeSpots.map(s => s.coords!), strokeColor: route.color,
      strokeWeight: 4, strokeOpacity: 0.7, strokeStyle: 'dashed', showDir: true,
    }))
  }

  async function startNavigation(target: Spot) {
    if (!window.AMap || !target.coords) return
    setPlanning(true)
    window.AMap.plugin('AMap.Geolocation', () => {
      const geo = new window.AMap.Geolocation({ enableHighAccuracy: true, timeout: 5000 })
      geo.getCurrentPosition(async (status: string, result: any) => {
        if (status === 'complete' && map) {
          new window.AMap.Driving({
            policy: 0, map, panel: 'route-panel',
          }).search([result.position.lng, result.position.lat], target.coords, () => {
            setPlanning(false); map.setFitView()
          })
        } else {
          new window.AMap.Driving({
            policy: 0, map, panel: 'route-panel',
          }).search([120.1025, 31.4214], target.coords, () => {
            setPlanning(false); map.setFitView()
          })
        }
      })
    })
  }

  function handleSearch(text: string) {
    setSearchText(text)
    if (!text.trim() || !window.AMap) { setSearchTips([]); return }
    window.AMap.plugin('AMap.AutoComplete', () => {
      const auto = new window.AMap.AutoComplete({
        city: '无锡', citylimit: true,
      })
      auto.search(text, (status: string, result: any) => {
        if (status === 'complete' && result.tips) {
          setSearchTips(result.tips.filter((t: any) => t.location))
        } else {
          setSearchTips([])
        }
      })
    })
  }

  function selectSearchTip(tip: any) {
    if (!map || !tip.location) return
    map.setZoomAndCenter(16, [tip.location.lng, tip.location.lat])
    new window.AMap.Marker({
      position: [tip.location.lng, tip.location.lat],
      title: tip.name,
      map,
    })
    setSearchText('')
    setSearchTips([])
  }

  function locateUser() {
    if (!map || !window.AMap) return
    window.AMap.plugin('AMap.Geolocation', () => {
      const geo = new window.AMap.Geolocation({ enableHighAccuracy: true, timeout: 5000 })
      geo.getCurrentPosition((status: string, result: any) => {
        if (status === 'complete') {
          const pos: [number, number] = [result.position.lng, result.position.lat]
          setUserPos(pos)
          map.setZoomAndCenter(16, pos)
        }
      })
    })
  }

  function handleRouteChange(route: Route) {
    if (selectedRoute?.id === route.id) { setSelectedRoute(null); initMap(); return }
    setSelectedRoute(route)
    if (map) { map.clearMap(); initMap(); setTimeout(() => drawRoute(map, route), 300) }
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* sidebar */}
      <div style={{
        width: 320, background: 'rgba(250,245,236,0.96)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto', flexShrink: 0,
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', position: 'relative' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
            🗺️ 景区导航地图
          </h2>
          <p style={{ fontSize: 11, color: 'var(--ink2)', margin: '4px 0 8px' }}>
            {scenicInfo.name} · 点击景点查看详情和导航
          </p>
          <input
            value={searchText}
            onChange={e => handleSearch(e.target.value)}
            placeholder="搜索地点...（如：灵山大佛）"
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 8,
              border: '1px solid var(--border)', fontSize: 12,
              color: 'var(--ink)', outline: 'none',
              background: 'rgba(255,252,245,0.8)',
              boxSizing: 'border-box',
            }}
            onFocus={e => (e.target as HTMLInputElement).style.borderColor = 'var(--jade)'}
            onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'var(--border)'}
          />
          {searchTips.length > 0 && (
            <div style={{
              position: 'absolute', left: 20, right: 20, top: '100%',
              background: 'white', borderRadius: 8, zIndex: 10,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              maxHeight: 200, overflowY: 'auto',
            }}>
              {searchTips.map((tip, i) => (
                <div key={i} onClick={() => selectSearchTip(tip)}
                  style={{
                    padding: '8px 12px', fontSize: 12, cursor: 'pointer',
                    color: 'var(--ink)', borderBottom: '1px solid #f0f0f0',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--gold-pale)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'white'}
                >
                  <div style={{ fontWeight: 500 }}>{tip.name}</div>
                  {tip.district && <div style={{ fontSize: 10, color: 'var(--ink2)' }}>{tip.district}{tip.address || ''}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
            📍 推荐游览路线
          </div>
          {routes.map(r => (
            <button key={r.id} onClick={() => handleRouteChange(r)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 12px', borderRadius: 8, marginBottom: 4,
                border: `1px solid ${selectedRoute?.id === r.id ? r.color : 'transparent'}`,
                background: selectedRoute?.id === r.id ? `${r.color}14` : 'rgba(255,252,245,0.6)',
                cursor: 'pointer', transition: 'all 0.18s',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{r.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{r.name}</span>
                <span style={{ fontSize: 10, color: 'var(--ink2)', marginLeft: 'auto' }}>{r.duration}</span>
              </div>
            </button>
          ))}
        </div>

        <div style={{ padding: '12px 20px', flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
            📌 景区景点（{spots.filter(s => s.coords).length}）
          </div>
          {[...spots.filter(s => s.coords)]
            .sort((a, b) => selectedSpot?.id === a.id ? -1 : selectedSpot?.id === b.id ? 1 : 0)
            .map(spot => (
            <div key={spot.id} onClick={() => {
              setSelectedSpot(spot)
              if (map && spot.coords) map.setZoomAndCenter(17, spot.coords)
            }} style={{
              padding: '10px 12px', borderRadius: 8, marginBottom: 6, cursor: 'pointer',
              transition: 'all 0.18s',
              background: selectedSpot?.id === spot.id ? 'var(--gold-pale)' : 'rgba(255,252,245,0.6)',
              border: `1px solid ${selectedSpot?.id === spot.id ? 'rgba(201,168,76,0.4)' : 'transparent'}`,
              borderLeft: `3px solid ${CAT_COLORS[spot.category] || '#999'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{spot.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{spot.name}</span>
                <span style={{
                  fontSize: 9, padding: '1px 5px', borderRadius: 3,
                  background: (CAT_COLORS[spot.category] || '#999') + '1a',
                  color: CAT_COLORS[spot.category] || '#999', marginLeft: 'auto',
                }}>{CAT_LABELS[spot.category] || spot.category}</span>
              </div>
              {selectedSpot?.id === spot.id && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink2)', lineHeight: 1.6 }}>
                  <div>{spot.brief}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button onClick={(e) => { e.stopPropagation(); startNavigation(spot) }}
                      disabled={planning}
                      style={{
                        padding: '5px 14px', borderRadius: 14,
                        border: 'none', background: 'var(--jade)', color: 'white',
                        fontSize: 11, cursor: 'pointer', opacity: planning ? 0.6 : 1,
                      }}>{planning ? '路径规划中...' : '🚗 导航至此'}</button>
                    <button onClick={(e) => { e.stopPropagation(); setArTarget(spot); setArMode(true) }}
                      style={{
                        padding: '5px 14px', borderRadius: 14,
                        border: '1px solid var(--jade)', background: 'transparent',
                        color: 'var(--jade)', fontSize: 11, cursor: 'pointer',
                      }}>📷 AR导航</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* map */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <div ref={containerRef} style={{ flex: 1 }} />
        <button onClick={locateUser} title="定位当前位置"
          style={{
            position: 'absolute', right: 16, bottom: 32,
            width: 36, height: 36, borderRadius: '50%',
            border: 'none', background: 'white',
            boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
            cursor: 'pointer', fontSize: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >📍</button>
        <div id="route-panel" style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          maxHeight: 180, overflowY: 'auto',
          background: 'rgba(255,255,255,0.95)', borderTop: '1px solid #ddd',
          display: 'none',
        }} />
        <div style={{
          position: 'absolute', left: 12, top: 12,
          background: 'rgba(255,255,255,0.92)', borderRadius: 8,
          padding: '6px 10px', fontSize: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          display: 'flex', gap: 8, flexWrap: 'wrap',
        }}>
          {Object.entries(CAT_LABELS).map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: CAT_COLORS[key] || '#999' }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* ================================================================
          AR 导航视图
          ================================================================ */}
      {arMode && arTarget && (
        <ARNavigator
          target={arTarget}
          userPos={userPos}
          onClose={() => { setArMode(false); setArTarget(null) }}
        />
      )}
    </div>
  )
}

// ================================================================
// AR 导航组件
// ================================================================
function ARNavigator({ target, userPos, onClose }: {
  target: Spot; userPos: [number, number] | null; onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [heading, setHeading] = useState(0)
  const [camError, setCamError] = useState('')
  const [gps, setGps] = useState<[number, number] | null>(userPos)
  const watchRef = useRef<number>(0)

  // 启动摄像头
  useEffect(() => {
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then(stream => { if (videoRef.current) videoRef.current.srcObject = stream })
      .catch(() => setCamError('无法访问摄像头'))

    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  // 监听设备方向（指南针）
  useEffect(() => {
    const handler = (e: DeviceOrientationEvent) => {
      const h = (e as any).webkitCompassHeading ?? e.alpha ?? 0
      setHeading(360 - h)
    }
    window.addEventListener('deviceorientation', handler)
    return () => window.removeEventListener('deviceorientation', handler)
  }, [])

  // 持续获取 GPS
  useEffect(() => {
    if (!navigator.geolocation) return
    watchRef.current = navigator.geolocation.watchPosition(
      pos => setGps([pos.coords.longitude, pos.coords.latitude]),
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    )
    return () => { if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current) }
  }, [])

  // 计算目标方位
  const bearing = gps && target.coords
    ? computeBearing(gps[1], gps[0], target.coords[1], target.coords[0])
    : 0
  const relativeBearing = ((bearing - heading + 360 + 180) % 360) - 180 // -180 ~ +180
  const distance = gps && target.coords
    ? haversine(gps[1], gps[0], target.coords[1], target.coords[0])
    : null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3,
      background: '#000', display: 'flex', flexDirection: 'column',
    }}>
      {/* 摄像头画布 */}
      <video ref={videoRef} autoPlay playsInline muted
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />

      {/* AR 叠加层 */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {/* 顶部信息栏 */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.7), transparent)',
          padding: '16px 20px 30px',
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
            📷 AR 导航
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 4 }}>
            目标：{target.name}
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 6 }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
              📍 {distance != null ? formatDistance(distance) : '--'}
            </span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
              🧭 {bearing.toFixed(0)}°
            </span>
          </div>
        </div>

        {/* 方向指示箭头 */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: `translate(-50%, -50%) rotate(${relativeBearing.toFixed(1)}deg)`,
          transition: 'transform 0.3s ease',
        }}>
          <svg width="80" height="120" viewBox="0 0 80 120">
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <polygon points="40,0 10,60 40,48 70,60"
              fill="rgba(61,122,94,0.85)" stroke="white" strokeWidth="2" filter="url(#glow)" />
          </svg>
        </div>

        {/* 目标名称标签 */}
        {Math.abs(relativeBearing) < 45 && (
          <div style={{
            position: 'absolute', top: '38%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0,0,0,0.75)', color: 'white',
            padding: '4px 16px', borderRadius: 20, fontSize: 14, fontWeight: 600,
            backdropFilter: 'blur(8px)',
          }}>
            {target.name} {target.icon}
          </div>
        )}

        {/* 底部信息 */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.7), transparent)',
          padding: '30px 20px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        }}>
          <div style={{ color: 'white', fontSize: 11 }}>
            {camError || '手机指向箭头方向前进'}
          </div>
        </div>
      </div>

      {/* 关闭按钮 — 独立于 AR 层级，高于 Live2D */}
      <button onClick={onClose} style={{
        position: 'fixed', top: 16, right: 16, zIndex: 100,
        width: 40, height: 40, borderRadius: '50%',
        border: '2px solid rgba(255,255,255,0.6)', background: 'rgba(0,0,0,0.5)',
        color: 'white', fontSize: 20, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>✕</button>

      {/* 地图小窗 */}
      <div style={{
        position: 'absolute', bottom: 80, right: 12,
        width: 140, height: 140, borderRadius: 12, overflow: 'hidden',
        border: '2px solid rgba(255,255,255,0.5)', zIndex: 100,
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      }}>
        <iframe
          src={`https://m.amap.com/navi/?dest=${target.coords?.[0] ?? 120.1025},${target.coords?.[1] ?? 31.4214}&destName=${encodeURIComponent(target.name)}&key=bc37009fd9f4e652e387802474fec299`}
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      </div>
    </div>
  )
}

// ================================================================
// 工具函数：方位角 & 距离
// ================================================================
function computeBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = Math.PI / 180, toDeg = 180 / Math.PI
  const dLng = (lng2 - lng1) * toRad
  const y = Math.sin(dLng) * Math.cos(lat2 * toRad)
  const x = Math.cos(lat1 * toRad) * Math.sin(lat2 * toRad) - Math.sin(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.cos(dLng)
  return (Math.atan2(y, x) * toDeg + 360) % 360
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000, toRad = Math.PI / 180
  const dLat = (lat2 - lat1) * toRad, dLng = (lng2 - lng1) * toRad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(m: number): string {
  if (m < 1000) return `${m.toFixed(0)}m`
  return `${(m / 1000).toFixed(1)}km`
}

function markerSVG(color: string): string {
  return 'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.3 21.7 0 14 0z" fill="${color}"/><circle cx="14" cy="13" r="6" fill="white" opacity="0.9"/><circle cx="14" cy="13" r="3" fill="${color}" opacity="0.6"/></svg>`)
}
