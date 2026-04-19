import { spots, history as historyData } from '../data/lingshan'
import type { PageId, Spot } from '../types'

const HERO_FEATURES = [
  { icon: '🗿', text: '世界最高露天铜佛' },
  { icon: '🎭', text: '佛教艺术东方卢浮宫' },
  { icon: '🌏', text: '世界佛教论坛永久会址' },
  { icon: '⛩️', text: '千年祥符禅寺' },
]

interface HomePageProps { onNavigate: (p: PageId) => void }

export default function HomePage({ onNavigate }: HomePageProps) {
  const featured = spots.filter(s => ['LS-011', 'LS-013', 'LS-006', 'LS-014'].includes(s.id))

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      {/* Hero */}
      <section style={{
        minHeight: '70vh',
        background: `radial-gradient(ellipse 90% 60% at 50% 100%, rgba(61,122,94,0.18) 0%, transparent 70%),
          radial-gradient(ellipse 60% 40% at 15% 60%, rgba(201,168,76,0.12) 0%, transparent 55%),
          linear-gradient(168deg, #e8dfc8 0%, #f4ead8 40%, #ece0c8 100%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '60px 24px', position: 'relative', overflow: 'hidden',
      }}>
        <svg style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%', opacity: 0.1 }}
          viewBox="0 0 1440 300" preserveAspectRatio="xMidYMax slice">
          <path d="M0,300 L0,180 Q120,100 240,150 Q380,200 520,80 Q660,0 800,90 Q940,180 1080,100 Q1220,20 1440,130 L1440,300 Z" fill="#3d7a5e" />
          <path d="M0,300 L0,220 Q200,180 360,210 Q520,240 700,160 Q880,80 1060,170 Q1240,250 1440,200 L1440,300 Z" fill="#4e9b78" />
        </svg>
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 2, animation: 'fadeUp 0.7s ease' }}>
          <div style={{ fontSize: 12, color: 'var(--jade)', letterSpacing: 3, marginBottom: 16, textTransform: 'uppercase' }}>
            National AAAAA Scenic Area · 国家5A级旅游景区
          </div>
          <h1 style={{ fontFamily: "'Ma Shan Zheng',cursive", fontSize: 'clamp(48px,8vw,88px)', color: 'var(--ink)', letterSpacing: 8, lineHeight: 1, marginBottom: 16, textShadow: '0 2px 20px rgba(201,168,76,0.2)' }}>
            灵山胜境
          </h1>
          <div style={{ fontSize: 'clamp(14px,2vw,18px)', color: 'rgba(26,15,10,0.55)', letterSpacing: 3, marginBottom: 8 }}>
            东方佛国 · 太湖佛国
          </div>
          <div style={{ width: 60, height: 2, background: 'linear-gradient(90deg,transparent,var(--gold),transparent)', margin: '20px auto' }} />
          <p style={{ fontSize: 15, color: 'var(--ink2)', lineHeight: 2, maxWidth: 580, margin: '0 auto 36px', letterSpacing: 0.3 }}>
            坐落于江苏省无锡市太湖西北部马山镇，占地约30万平方米，三山环抱，太湖碧波，是佛教文化、自然山水与人文艺术的完美融合之地。
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 36 }}>
            {HERO_FEATURES.map(f => (
              <div key={f.text} style={{ padding: '8px 18px', borderRadius: 24, background: 'rgba(255,252,245,0.7)', backdropFilter: 'blur(8px)', border: '1px solid var(--border)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 7, color: 'var(--ink2)' }}>
                <span>{f.icon}</span>{f.text}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
            <button onClick={() => onNavigate('spots')} style={{ padding: '12px 32px', borderRadius: 28, background: 'linear-gradient(135deg, var(--gold), #a07830)', color: 'white', fontSize: 14, letterSpacing: 1, boxShadow: '0 4px 20px rgba(201,168,76,0.4)', border: 'none', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
              onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.transform = 'translateY(-2px)'; b.style.boxShadow = '0 8px 28px rgba(201,168,76,0.5)' }}
              onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.transform = 'none'; b.style.boxShadow = '0 4px 20px rgba(201,168,76,0.4)' }}
            >探索景点</button>
            <button onClick={() => onNavigate('routes')} style={{ padding: '12px 32px', borderRadius: 28, background: 'transparent', color: 'var(--jade)', fontSize: 14, letterSpacing: 1, border: '1px solid var(--jade2)', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--jade-pale)'}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
            >游览路线</button>
          </div>
        </div>
      </section>

      {/* Featured spots */}
      <section style={{ padding: '60px 32px', maxWidth: 1200, margin: '0 auto' }}>
        <SectionTitle title="核心景点" sub="Core Attractions" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 20, marginTop: 32 }}>
          {featured.map((spot, i) => <SpotCard key={spot.id} spot={spot} index={i} onClick={() => onNavigate('spots')} />)}
        </div>
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <button onClick={() => onNavigate('spots')} style={{ padding: '10px 28px', borderRadius: 24, border: '1px solid var(--border)', background: 'transparent', color: 'var(--jade)', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--jade-pale)'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
          >查看全部景点 →</button>
        </div>
      </section>

      {/* Quick info */}
      <section style={{ background: 'rgba(61,122,94,0.05)', borderTop: '1px solid var(--border2)', borderBottom: '1px solid var(--border2)', padding: '48px 32px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
          {([
            { icon: '⏰', title: '开放时间', lines: ['夏季（4-10月）08:00–18:00', '冬季（11-3月）08:30–17:00'] },
            { icon: '🎫', title: '门票价格', lines: ['成人票 ¥210', '半价票 ¥105（学生/老人）', '免费：6岁以下/70岁以上'] },
            { icon: '📍', title: '景区位置', lines: ['江苏省无锡市马山镇', '太湖西北部，秦履峰南麓', '驾车可达，有停车场'] },
          ] as const).map(item => (
            <div key={item.title} style={{ textAlign: 'center', padding: '24px', background: 'rgba(255,252,245,0.7)', borderRadius: 16, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{item.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 10, letterSpacing: 0.5 }}>{item.title}</div>
              {item.lines.map(l => <div key={l} style={{ fontSize: 12, color: 'rgba(26,15,10,0.55)', lineHeight: 2 }}>{l}</div>)}
            </div>
          ))}
        </div>
      </section>

      {/* History preview */}
      <section style={{ padding: '60px 32px', maxWidth: 900, margin: '0 auto' }}>
        <SectionTitle title="千年传承" sub="A Thousand Years of History" />
        <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column' }}>
          {historyData.slice(0, 4).map((h, i) => (
            <div key={i} style={{ display: 'flex', gap: 20, alignItems: 'flex-start', paddingBottom: 24, animation: `fadeUp 0.4s ease ${i * 0.1}s both` }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--gold-pale)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{h.icon}</div>
                {i < 3 && <div style={{ width: 1, flex: 1, minHeight: 24, background: 'var(--border)', marginTop: 4 }} />}
              </div>
              <div style={{ paddingTop: 6 }}>
                <div style={{ fontSize: 12, color: 'var(--gold)', letterSpacing: 0.5, marginBottom: 4 }}>{h.year}</div>
                <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.7 }}>{h.event}</div>
              </div>
            </div>
          ))}
          <button onClick={() => onNavigate('history')} style={{ alignSelf: 'flex-start', marginLeft: 56, fontSize: 12, color: 'var(--jade)', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }}>
            查看完整历史 →
          </button>
        </div>
      </section>
      <div style={{ height: 80 }} />
    </div>
  )
}

function SectionTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <h2 style={{ fontFamily: "'Ma Shan Zheng',cursive", fontSize: 32, color: 'var(--ink)', letterSpacing: 3 }}>{title}</h2>
      <div style={{ fontSize: 11, color: 'var(--jade)', letterSpacing: 2.5, textTransform: 'uppercase', marginTop: 4 }}>{sub}</div>
      <div style={{ width: 48, height: 2, background: 'linear-gradient(90deg,transparent,var(--gold),transparent)', margin: '12px auto 0' }} />
    </div>
  )
}

function SpotCard({ spot, index, onClick }: { spot: Spot; index: number; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ background: 'rgba(255,252,245,0.88)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.25s', animation: `fadeUp 0.45s ease ${index * 0.08}s both` }}
      onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(-4px)'; d.style.boxShadow = 'var(--shadow-lg)' }}
      onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'none'; d.style.boxShadow = 'none' }}
    >
      <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52, background: 'linear-gradient(135deg, var(--gold-pale), var(--jade-pale))', borderBottom: '1px solid var(--border)' }}>{spot.icon}</div>
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', letterSpacing: 0.5 }}>{spot.name}</div>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: spot.tagColor + '18', color: spot.tagColor, border: `1px solid ${spot.tagColor}30` }}>{spot.tag}</span>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(26,15,10,0.55)', lineHeight: 1.7 }}>{spot.brief}</div>
        <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {spot.highlights.slice(0, 2).map(h => (
            <span key={h} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 8, background: 'var(--jade-pale)', color: 'var(--jade)', border: '1px solid var(--border2)' }}>{h}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
