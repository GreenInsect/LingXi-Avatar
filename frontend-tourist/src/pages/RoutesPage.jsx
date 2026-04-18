import { useState } from 'react'
import { routes } from '../data/lingshan'

export default function RoutesPage() {
  const [active, setActive] = useState(routes[0].id)
  const route = routes.find(r => r.id === active)

  return (
    <div style={{ height:'100%', overflowY:'auto' }}>
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'36px 28px' }}>
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <h2 style={{ fontFamily:"'Ma Shan Zheng',cursive", fontSize:32, color:'var(--ink)', letterSpacing:3 }}>游览路线推荐</h2>
          <div style={{ fontSize:11, color:'var(--jade)', letterSpacing:2.5, textTransform:'uppercase', marginTop:4 }}>Recommended Routes</div>
          <div style={{ width:48, height:2, background:'linear-gradient(90deg,transparent,var(--gold),transparent)', margin:'12px auto 0' }} />
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:14, justifyContent:'center', marginBottom:36 }}>
          {routes.map(r => (
            <button
              key={r.id}
              onClick={() => setActive(r.id)}
              style={{
                padding:'10px 24px', borderRadius:24, fontSize:14,
                background: active===r.id ? r.gradient : 'transparent',
                color: active===r.id ? 'white' : 'var(--ink2)',
                border:`1px solid ${active===r.id ? 'transparent' : 'var(--border)'}`,
                cursor:'pointer', transition:'all 0.22s',
                boxShadow: active===r.id ? '0 4px 16px rgba(0,0,0,0.15)' : 'none',
                fontFamily:"'Noto Sans SC',sans-serif",
                letterSpacing:0.5,
              }}
            >
              {r.icon} {r.name}
            </button>
          ))}
        </div>

        {/* Route detail */}
        {route && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, animation:'fadeUp 0.3s ease' }}>
            {/* Left: info */}
            <div>
              <div style={{
                background:'rgba(255,252,245,0.9)', borderRadius:16, padding:'28px',
                border:'1px solid var(--border)', marginBottom:20,
              }}>
                <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:16 }}>
                  <span style={{ fontSize:36 }}>{route.icon}</span>
                  <div>
                    <div style={{ fontSize:20, color:'var(--ink)', fontFamily:"'Ma Shan Zheng',cursive", letterSpacing:1 }}>{route.name}</div>
                    <div style={{ display:'flex', gap:12, marginTop:6 }}>
                      <span style={{ fontSize:12, color:'var(--jade)' }}>⏱ {route.duration}</span>
                      <span style={{ fontSize:12, color:'var(--gold)' }}>📊 难度：{route.difficulty}</span>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize:14, color:'rgba(26,15,10,0.6)', lineHeight:1.8, borderTop:'1px solid var(--border)', paddingTop:14 }}>
                  {route.desc}
                </div>
              </div>

              {/* Tips */}
              <div style={{ background:'var(--jade-pale)', borderRadius:14, padding:'20px', border:'1px solid var(--border2)' }}>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--jade)', marginBottom:12, letterSpacing:0.5 }}>💡 游览贴士</div>
                {route.tips.map((t, i) => (
                  <div key={i} style={{ display:'flex', gap:8, marginBottom:8, fontSize:13, color:'var(--ink)', lineHeight:1.7 }}>
                    <span style={{ color:'var(--gold)', flexShrink:0 }}>•</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: step timeline */}
            <div style={{ background:'rgba(255,252,245,0.9)', borderRadius:16, padding:'28px', border:'1px solid var(--border)' }}>
              <div style={{ fontSize:14, fontWeight:600, color:'var(--ink)', marginBottom:20, letterSpacing:0.5 }}>📍 路线详情</div>
              <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                {route.steps.map((step, i) => (
                  <div key={i} style={{ display:'flex', gap:14, alignItems:'flex-start', paddingBottom:i < route.steps.length-1 ? 20 : 0 }}>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                      <div style={{
                        width:32, height:32, borderRadius:'50%',
                        background: i===0 || i===route.steps.length-1 ? route.gradient : 'var(--gold-pale)',
                        border:`2px solid ${i===0||i===route.steps.length-1 ? 'transparent' : 'var(--border)'}`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:12, fontWeight:700,
                        color: i===0||i===route.steps.length-1 ? 'white' : 'var(--gold)',
                      }}>{i+1}</div>
                      {i < route.steps.length-1 && (
                        <div style={{ width:2, height:20, background:'var(--border)', marginTop:2 }} />
                      )}
                    </div>
                    <div style={{
                      paddingTop:6, fontSize:14, color:'var(--ink)',
                      fontWeight: i===0||i===route.steps.length-1 ? 600 : 400,
                    }}>{step}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <div style={{ height:60 }} />
    </div>
  )
}
