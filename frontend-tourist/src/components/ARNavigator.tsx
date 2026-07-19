import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useResponsive } from '../hooks/useResponsive'
import type { Spot } from '../types'

type CapabilityState = 'idle' | 'searching' | 'ready' | 'denied' | 'unavailable' | 'manual'

type DeviceOrientationEventWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

interface ARNavigatorProps {
  target: Spot
  initialPosition?: [number, number] | null
  onGuideOpen?: () => void
  onOverlayChange?: (active: boolean) => void
  onClose: () => void
}

export default function ARNavigator({
  target,
  initialPosition = null,
  onGuideOpen,
  onOverlayChange,
  onClose,
}: ARNavigatorProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const watchRef = useRef<number | null>(null)
  const { isMobile, isTablet } = useResponsive()

  const [sessionStarted, setSessionStarted] = useState(false)
  const [cameraState, setCameraState] = useState<CapabilityState>('idle')
  const [locationState, setLocationState] = useState<CapabilityState>(initialPosition ? 'ready' : 'idle')
  const [orientationState, setOrientationState] = useState<CapabilityState>('idle')
  const [gps, setGps] = useState<[number, number] | null>(initialPosition)
  const [heading, setHeading] = useState(0)
  const [manualHeading, setManualHeading] = useState(0)
  const [startError, setStartError] = useState('')

  const hasTargetCoords = Boolean(target.coords)
  const currentHeading = orientationState === 'ready' ? heading : manualHeading

  const bearing = gps && target.coords
    ? computeBearing(gps[1], gps[0], target.coords[1], target.coords[0])
    : 0
  const relativeBearing = normalizeRelativeDegrees(bearing - currentHeading)
  const distance = gps && target.coords
    ? haversine(gps[1], gps[0], target.coords[1], target.coords[0])
    : null
  const arrowLeft = 50 + clamp(relativeBearing, -90, 90) / 90 * (isMobile ? 34 : 28)
  const isAligned = Math.abs(relativeBearing) <= 12
  const externalMapUrl = useMemo(() => {
    const [lng, lat] = target.coords ?? [120.1006, 31.4258]
    return `https://uri.amap.com/navigation?to=${lng},${lat},${encodeURIComponent(target.name)}&mode=walk&policy=1&src=lingshan&coordinate=gaode&callnative=1`
  }, [target.coords, target.name])

  useEffect(() => {
    onOverlayChange?.(true)
    return () => onOverlayChange?.(false)
  }, [onOverlayChange])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const stopLocationWatch = useCallback(() => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      setCameraState('unavailable')
      return
    }

    setCameraState('searching')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }
      setCameraState('ready')
    } catch {
      setCameraState('denied')
    }
  }, [])

  const startLocationWatch = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationState('unavailable')
      return
    }

    stopLocationWatch()
    setLocationState('searching')
    watchRef.current = navigator.geolocation.watchPosition(
      pos => {
        setGps([pos.coords.longitude, pos.coords.latitude])
        setLocationState('ready')
      },
      err => {
        setLocationState(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable')
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    )
  }, [stopLocationWatch])

  const requestOrientation = useCallback(async () => {
    if (!('DeviceOrientationEvent' in window)) {
      setOrientationState('manual')
      return
    }

    const OrientationEvent = window.DeviceOrientationEvent as DeviceOrientationEventWithPermission
    try {
      if (typeof OrientationEvent.requestPermission === 'function') {
        const permission = await OrientationEvent.requestPermission()
        if (permission !== 'granted') {
          setOrientationState('manual')
          return
        }
      }
      setOrientationState('ready')
    } catch {
      setOrientationState('manual')
    }
  }, [])

  const startSession = useCallback(async () => {
    if (!hasTargetCoords) {
      setStartError('该景点暂无坐标')
      return
    }

    setStartError('')
    setSessionStarted(true)
    startLocationWatch()
    await requestOrientation()
    await startCamera()
  }, [hasTargetCoords, requestOrientation, startCamera, startLocationWatch])

  useEffect(() => {
    if (!sessionStarted || orientationState !== 'ready') return

    let receivedHeading = false
    const handler = (event: DeviceOrientationEvent) => {
      const compassHeading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading
      const nextHeading = typeof compassHeading === 'number'
        ? compassHeading
        : typeof event.alpha === 'number'
          ? 360 - event.alpha
          : null

      if (nextHeading === null || Number.isNaN(nextHeading)) return
      receivedHeading = true
      setHeading(normalizeDegrees(nextHeading))
    }

    window.addEventListener('deviceorientation', handler, true)
    const fallbackTimer = window.setTimeout(() => {
      if (!receivedHeading) setOrientationState('manual')
    }, 2500)

    return () => {
      window.clearTimeout(fallbackTimer)
      window.removeEventListener('deviceorientation', handler, true)
    }
  }, [orientationState, sessionStarted])

  useEffect(() => {
    return () => {
      stopCamera()
      stopLocationWatch()
    }
  }, [stopCamera, stopLocationWatch])

  const statusItems = [
    { label: '摄像头', state: cameraState },
    { label: '定位', state: locationState },
    { label: '方向', state: orientationState === 'manual' ? 'manual' : orientationState },
  ]

  const statusText = cameraState === 'ready'
    ? '实景模式'
    : cameraState === 'searching'
      ? '正在打开摄像头'
      : '指南针模式'

  const directionText = !gps
    ? '等待定位'
    : isAligned
      ? '正前方'
      : relativeBearing > 0
        ? `向右 ${Math.abs(relativeBearing).toFixed(0)}°`
        : `向左 ${Math.abs(relativeBearing).toFixed(0)}°`

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 700,
      background: '#090b0a',
      color: 'white',
      overflow: 'hidden',
      fontFamily: "'Noto Sans SC', sans-serif",
    }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: cameraState === 'ready' ? 1 : 0,
          transition: 'opacity 0.35s ease',
        }}
      />

      <div style={{
        position: 'absolute',
        inset: 0,
        background: cameraState === 'ready'
          ? 'linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.08) 35%, rgba(0,0,0,0.72))'
          : 'radial-gradient(circle at 50% 30%, rgba(61,122,94,0.42), rgba(9,11,10,0.96) 58%)',
      }} />

      {!sessionStarted && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isMobile ? 18 : 32,
          background: 'rgba(9,11,10,0.72)',
          zIndex: 4,
        }}>
          <div style={{
            width: 'min(460px, 100%)',
            border: '1px solid rgba(255,255,255,0.16)',
            borderRadius: 18,
            background: 'rgba(18,22,20,0.92)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.36)',
            padding: isMobile ? 18 : 24,
          }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.62)', letterSpacing: 1, textTransform: 'uppercase' }}>
              AR Guide
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <span style={{ fontSize: 28 }}>{target.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{target.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.68)', marginTop: 4 }}>{target.tag}</div>
              </div>
            </div>
            <div style={{
              marginTop: 18,
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
              gap: 8,
            }}>
              {['摄像头', '定位', '方向'].map(item => (
                <div key={item} style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.78)',
                  fontSize: 12,
                  textAlign: 'center',
                }}>{item}</div>
              ))}
            </div>
            {startError && <div style={{ marginTop: 12, color: '#ffb4a8', fontSize: 12 }}>{startError}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={startSession}
                disabled={!hasTargetCoords}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 12,
                  background: hasTargetCoords ? 'var(--jade)' : 'rgba(255,255,255,0.16)',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: hasTargetCoords ? 'pointer' : 'not-allowed',
                }}
              >
                开启 AR 导航
              </button>
              <button
                onClick={onGuideOpen}
                style={{
                  width: isMobile ? 82 : 96,
                  borderRadius: 12,
                  border: '1px solid rgba(232,207,136,0.38)',
                  color: 'white',
                  fontSize: 13,
                  fontWeight: 800,
                  background: 'rgba(232,207,136,0.16)',
                }}
              >
                数字导游
              </button>
              <button
                onClick={onClose}
                style={{
                  width: 70,
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white',
                  fontSize: 13,
                  background: 'rgba(255,255,255,0.08)',
                }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {sessionStarted && (
        <>
          <div style={{
            position: 'absolute',
            top: `calc(${isMobile ? 12 : 18}px + env(safe-area-inset-top))`,
            left: isMobile ? 12 : 18,
            right: isMobile ? 12 : 18,
            zIndex: 3,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 850, textShadow: '0 2px 12px rgba(0,0,0,0.45)' }}>
                {target.name}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {statusItems.map(item => (
                  <span key={item.label} style={{
                    padding: '5px 9px',
                    borderRadius: 999,
                    background: statusColor(item.state),
                    border: '1px solid rgba(255,255,255,0.14)',
                    fontSize: 11,
                    fontWeight: 700,
                    backdropFilter: 'blur(10px)',
                  }}>
                    {item.label} · {stateLabel(item.state)}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                onClick={onGuideOpen}
                aria-label="打开数字导游"
                style={{
                  minWidth: isMobile ? 70 : 92,
                  height: 42,
                  borderRadius: 999,
                  background: 'rgba(232,207,136,0.18)',
                  border: '1px solid rgba(232,207,136,0.34)',
                  color: 'white',
                  fontSize: isMobile ? 12 : 13,
                  fontWeight: 850,
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 10px 28px rgba(0,0,0,0.2)',
                }}
              >
                {isMobile ? '导游' : '数字导游'}
              </button>
              <button
                onClick={onClose}
                aria-label="关闭 AR 导航"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.46)',
                  border: '1px solid rgba(255,255,255,0.24)',
                  color: 'white',
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                x
              </button>
            </div>
          </div>

          <div style={{
            position: 'absolute',
            top: isMobile ? '38%' : '42%',
            left: `${arrowLeft}%`,
            transform: `translate(-50%, -50%) rotate(${relativeBearing.toFixed(1)}deg)`,
            transition: 'left 0.28s ease, transform 0.28s ease',
            zIndex: 2,
            filter: 'drop-shadow(0 12px 22px rgba(0,0,0,0.36))',
          }}>
            <svg width={isMobile ? 86 : 108} height={isMobile ? 120 : 148} viewBox="0 0 90 132">
              <path d="M45 4 12 76l29-13v65h8V63l29 13L45 4Z" fill={isAligned ? '#e8cf88' : '#4e9b78'} stroke="white" strokeWidth="3" />
              <circle cx="45" cy="58" r="10" fill="rgba(255,255,255,0.9)" />
            </svg>
          </div>

          {isAligned && (
            <div style={{
              position: 'absolute',
              top: isMobile ? '25%' : '28%',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 2,
              padding: '8px 16px',
              borderRadius: 999,
              background: 'rgba(0,0,0,0.54)',
              border: '1px solid rgba(255,255,255,0.2)',
              backdropFilter: 'blur(12px)',
              fontSize: 13,
              fontWeight: 800,
              whiteSpace: 'nowrap',
            }}>
              {target.icon} {target.name}
            </div>
          )}

          <div style={{
            position: 'absolute',
            left: isMobile ? 12 : 18,
            right: isMobile ? 12 : 18,
            bottom: `calc(${isMobile ? 14 : 18}px + env(safe-area-inset-bottom))`,
            zIndex: 3,
            display: 'grid',
            gridTemplateColumns: isMobile || isTablet ? '1fr' : '1fr 220px',
            gap: 12,
            alignItems: 'end',
          }}>
            <div style={{
              borderRadius: 18,
              background: 'rgba(12,15,14,0.78)',
              border: '1px solid rgba(255,255,255,0.16)',
              backdropFilter: 'blur(16px)',
              padding: isMobile ? 14 : 16,
              boxShadow: '0 18px 54px rgba(0,0,0,0.3)',
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
                textAlign: 'center',
              }}>
                <Metric label="方向" value={directionText} />
                <Metric label="距离" value={distance != null ? formatDistance(distance) : '--'} />
                <Metric label="模式" value={statusText} />
              </div>

              {orientationState !== 'ready' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={() => setManualHeading(v => normalizeDegrees(v - 15))} style={manualButtonStyle}>左校准</button>
                  <button onClick={() => setManualHeading(bearing)} disabled={!gps} style={{ ...manualButtonStyle, opacity: gps ? 1 : 0.5 }}>对准目标</button>
                  <button onClick={() => setManualHeading(v => normalizeDegrees(v + 15))} style={manualButtonStyle}>右校准</button>
                </div>
              )}
            </div>

            <a
              href={externalMapUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 48,
                borderRadius: 14,
                background: 'rgba(255,255,255,0.92)',
                color: '#1a0f0a',
                fontSize: 14,
                fontWeight: 800,
                boxShadow: '0 14px 34px rgba(0,0,0,0.28)',
              }}
            >
              打开地图导航
            </a>
          </div>
        </>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.56)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, color: 'white', fontWeight: 850, whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  )
}

const manualButtonStyle: CSSProperties = {
  flex: 1,
  minHeight: 36,
  borderRadius: 10,
  background: 'rgba(255,255,255,0.1)',
  color: 'white',
  fontSize: 12,
  fontWeight: 700,
  border: '1px solid rgba(255,255,255,0.14)',
}

function stateLabel(state: CapabilityState | string): string {
  if (state === 'ready') return '可用'
  if (state === 'searching') return '检测中'
  if (state === 'manual') return '手动'
  if (state === 'denied') return '受限'
  if (state === 'unavailable') return '降级'
  return '待开启'
}

function statusColor(state: CapabilityState | string): string {
  if (state === 'ready') return 'rgba(61,122,94,0.72)'
  if (state === 'searching') return 'rgba(201,168,76,0.64)'
  if (state === 'manual') return 'rgba(41,128,185,0.62)'
  return 'rgba(255,255,255,0.12)'
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360
}

function normalizeRelativeDegrees(value: number): number {
  return ((value + 540) % 360) - 180
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function computeBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = Math.PI / 180
  const toDeg = 180 / Math.PI
  const dLng = (lng2 - lng1) * toRad
  const y = Math.sin(dLng) * Math.cos(lat2 * toRad)
  const x = Math.cos(lat1 * toRad) * Math.sin(lat2 * toRad)
    - Math.sin(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.cos(dLng)
  return normalizeDegrees(Math.atan2(y, x) * toDeg)
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radius = 6371000
  const toRad = Math.PI / 180
  const dLat = (lat2 - lat1) * toRad
  const dLng = (lng2 - lng1) * toRad
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters.toFixed(0)}m`
  return `${(meters / 1000).toFixed(1)}km`
}
