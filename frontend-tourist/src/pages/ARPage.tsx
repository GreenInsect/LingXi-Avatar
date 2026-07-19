import { useMemo, useState } from 'react'
import ARNavigator from '../components/ARNavigator'
import { spots } from '../data/lingshan'
import { useResponsive } from '../hooks/useResponsive'
import type { Spot } from '../types'

const arSpots = spots.filter(spot => spot.coords)

interface ARPageProps {
  onOpenAvatar: () => void
  onAROverlayChange: (active: boolean) => void
}

export default function ARPage({ onOpenAvatar, onAROverlayChange }: ARPageProps) {
  const { isMobile, isTablet } = useResponsive()
  const [selectedId, setSelectedId] = useState(arSpots[0]?.id ?? '')
  const [arOpen, setArOpen] = useState(false)

  const selectedSpot = useMemo(
    () => arSpots.find(spot => spot.id === selectedId) ?? arSpots[0],
    [selectedId],
  )

  if (!selectedSpot) {
    return (
      <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--ink2)' }}>
        暂无可用 AR 景点
      </div>
    )
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'linear-gradient(180deg, var(--cream), #f4ead8)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: isMobile ? '22px 14px 90px' : '34px 28px 70px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile || isTablet ? '1fr' : '0.95fr 1.05fr',
          gap: isMobile ? 14 : 24,
          alignItems: 'stretch',
        }}>
          <section style={{
            borderRadius: 18,
            background: 'rgba(255,252,245,0.92)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow)',
            padding: isMobile ? 18 : 26,
          }}>
            <div style={{ fontSize: 12, color: 'var(--jade)', letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 8 }}>
              AR Navigation
            </div>
            <h2 style={{ fontSize: isMobile ? 26 : 34, lineHeight: 1.16, color: 'var(--ink)', marginBottom: 12 }}>
              AR 实景导览
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(26,15,10,0.62)', lineHeight: 1.9, marginBottom: 20 }}>
              选择目标景点后开启导览，系统会根据当前位置、方向和景点坐标给出实景方向指引，数字导游会浮在 AR 画面上方，可随时提问。
            </p>

            <div style={{
              borderRadius: 16,
              padding: isMobile ? 16 : 20,
              background: 'linear-gradient(135deg, rgba(61,122,94,0.12), rgba(201,168,76,0.12))',
              border: '1px solid rgba(61,122,94,0.18)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 44 }}>{selectedSpot.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>{selectedSpot.name}</div>
                  <div style={{ fontSize: 12, color: selectedSpot.tagColor, marginTop: 4 }}>{selectedSpot.tag}</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'rgba(26,15,10,0.65)', lineHeight: 1.8, marginTop: 14 }}>
                {selectedSpot.brief}
              </div>
              <button
                onClick={() => setArOpen(true)}
                style={{
                  width: '100%',
                  minHeight: 48,
                  borderRadius: 14,
                  marginTop: 18,
                  background: 'var(--jade)',
                  color: 'white',
                  fontSize: 15,
                  fontWeight: 800,
                  boxShadow: '0 12px 28px rgba(61,122,94,0.24)',
                }}
              >
                开启 AR 导览
              </button>
            </div>
          </section>

          <section style={{
            borderRadius: 18,
            background: 'rgba(255,252,245,0.9)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow)',
            padding: isMobile ? 14 : 18,
            minHeight: 360,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 14,
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>选择 AR 目标</div>
                <div style={{ fontSize: 11, color: 'rgba(26,15,10,0.48)', marginTop: 3 }}>{arSpots.length} 个可导航景点</div>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 150 : 180}px, 1fr))`,
              gap: 10,
              maxHeight: isMobile ? 'none' : 520,
              overflowY: isMobile ? 'visible' : 'auto',
              paddingRight: isMobile ? 0 : 4,
            }}>
              {arSpots.map(spot => (
                <ARSpotButton
                  key={spot.id}
                  spot={spot}
                  active={spot.id === selectedSpot.id}
                  onClick={() => setSelectedId(spot.id)}
                />
              ))}
            </div>
          </section>
        </div>
      </div>

      {arOpen && (
        <ARNavigator
          target={selectedSpot}
          onGuideOpen={onOpenAvatar}
          onOverlayChange={onAROverlayChange}
          onClose={() => setArOpen(false)}
        />
      )}
    </div>
  )
}

function ARSpotButton({ spot, active, onClick }: { spot: Spot; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        minHeight: 116,
        borderRadius: 14,
        padding: 14,
        textAlign: 'left',
        background: active ? 'var(--gold-pale)' : 'rgba(255,255,255,0.58)',
        border: `1px solid ${active ? 'rgba(201,168,76,0.48)' : 'rgba(201,168,76,0.16)'}`,
        boxShadow: active ? '0 10px 28px rgba(201,168,76,0.15)' : 'none',
        transition: 'transform 0.18s ease, border-color 0.18s ease, background 0.18s ease',
      }}
      onMouseEnter={event => { event.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={event => { event.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 24 }}>{spot.icon}</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>{spot.name}</span>
      </div>
      <div style={{
        display: 'inline-flex',
        padding: '2px 8px',
        borderRadius: 999,
        background: `${spot.tagColor}18`,
        color: spot.tagColor,
        fontSize: 11,
        marginBottom: 8,
      }}>
        {spot.tag}
      </div>
      <div style={{ fontSize: 12, color: 'rgba(26,15,10,0.58)', lineHeight: 1.6 }}>
        {spot.brief}
      </div>
    </button>
  )
}
