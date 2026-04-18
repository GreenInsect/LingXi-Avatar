import { nianhewan, tickets, tips, dining, openInfo, history as historyData } from '../data/lingshan'

// ── 拈花湾 ─────────────────────────────────────────────────
export function NianheWanPage() {
  return (
    <div style={{ height:'100%', overflowY:'auto' }}>
      {/* Hero banner */}
      <div style={{
        padding:'50px 28px 40px',
        background:'linear-gradient(160deg, #e8e0d0 0%, #ddd5c2 50%, #d0c8b0 100%)',
        textAlign:'center', position:'relative', overflow:'hidden',
      }}>
        <div style={{ position:'absolute', inset:0, opacity:0.06, backgroundImage:'radial-gradient(circle, #3d7a5e 1px, transparent 1px)', backgroundSize:'24px 24px' }} />
        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ fontSize:12, color:'var(--jade)', letterSpacing:3, marginBottom:12, textTransform:'uppercase' }}>
            Nianhewan Zen Town
          </div>
          <h2 style={{ fontFamily:"'Ma Shan Zheng',cursive", fontSize:42, color:'var(--ink)', letterSpacing:4, marginBottom:12 }}>
            拈花湾禅意小镇
          </h2>
          <p style={{ fontSize:14, color:'rgba(26,15,10,0.6)', maxWidth:560, margin:'0 auto', lineHeight:2 }}>
            与灵山胜境比邻而居，以"禅意·慢生活"为核心，融合禅意建筑、自然花海、非遗手作与特色演艺，
            白天花海漫步，夜间灯光秀如梦如幻，是感受禅意生活的绝佳之地。
          </p>
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:'0 auto', padding:'40px 28px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:20 }}>
          {nianhewan.map((item, i) => (
            <div
              key={item.id}
              style={{
                background:'rgba(255,252,245,0.9)', borderRadius:14, border:'1px solid var(--border)',
                padding:'22px', animation:`fadeUp 0.4s ease ${i*0.07}s both`,
                transition:'all 0.22s',
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow='var(--shadow-lg)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow='none'}
            >
              <div style={{ fontSize:36, marginBottom:10 }}>{item.icon}</div>
              <h3 style={{ fontSize:17, color:'var(--ink)', letterSpacing:0.5, marginBottom:8, fontFamily:"'Ma Shan Zheng',cursive" }}>{item.name}</h3>
              <div style={{ fontSize:12, color:'var(--jade)', marginBottom:10, fontWeight:500 }}>{item.brief}</div>
              <div style={{ fontSize:13, color:'rgba(26,15,10,0.6)', lineHeight:1.8, marginBottom:14 }}>{item.desc}</div>
              <div style={{ display:'flex', gap:6, alignItems:'center', fontSize:11, color:'var(--jade)', background:'var(--jade-pale)', padding:'7px 12px', borderRadius:8, border:'1px solid var(--border2)' }}>
                <span>⏰</span><span>{item.openTime}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ height:60 }} />
    </div>
  )
}

// ── 游览指南 ───────────────────────────────────────────────
export function InfoPage() {
  return (
    <div style={{ height:'100%', overflowY:'auto' }}>
      <div style={{ maxWidth:1000, margin:'0 auto', padding:'40px 28px' }}>
        <div style={{ textAlign:'center', marginBottom:40 }}>
          <h2 style={{ fontFamily:"'Ma Shan Zheng',cursive", fontSize:32, color:'var(--ink)', letterSpacing:3 }}>游览指南</h2>
          <div style={{ fontSize:11, color:'var(--jade)', letterSpacing:2.5, textTransform:'uppercase', marginTop:4 }}>Visitor Guide</div>
          <div style={{ width:48, height:2, background:'linear-gradient(90deg,transparent,var(--gold),transparent)', margin:'12px auto 0' }} />
        </div>

        {/* Tickets */}
        <Section title="🎫 门票价格" color="var(--gold)">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14 }}>
            {tickets.map(t => (
              <div key={t.type} style={{ background:'rgba(255,252,245,0.9)', borderRadius:12, border:'1px solid var(--border)', padding:'18px' }}>
                <div style={{ fontSize:24, marginBottom:8 }}>{t.icon}</div>
                <div style={{ fontSize:14, fontWeight:600, color:'var(--ink)', marginBottom:4 }}>{t.type}</div>
                <div style={{ fontSize:20, color:'var(--gold)', fontWeight:700, marginBottom:8, fontFamily:"'Syne',sans-serif" }}>{t.price}</div>
                <div style={{ fontSize:11, color:'rgba(26,15,10,0.55)', lineHeight:1.7 }}>{t.desc}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Open time */}
        <Section title="⏰ 开放时间" color="var(--jade)">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <InfoBlock icon="☀️" title="夏季" content={openInfo.summer} />
            <InfoBlock icon="❄️" title="冬季" content={openInfo.winter} />
          </div>
          <div style={{ marginTop:14, padding:'12px 16px', background:'var(--gold-pale)', borderRadius:10, border:'1px solid var(--border)', fontSize:13, color:'var(--ink)', lineHeight:1.8 }}>
            💡 {openInfo.tip}
          </div>
        </Section>

        {/* Dining */}
        <Section title="🍜 餐饮推荐" color="var(--red)">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))', gap:14 }}>
            {dining.map(d => (
              <div key={d.name} style={{ background:'rgba(255,252,245,0.9)', borderRadius:12, border:'1px solid var(--border)', padding:'18px' }}>
                <div style={{ fontSize:24, marginBottom:8 }}>{d.icon}</div>
                <div style={{ fontSize:14, fontWeight:600, color:'var(--ink)', marginBottom:4 }}>{d.name}</div>
                <div style={{ fontSize:16, color:'var(--red)', fontWeight:600, marginBottom:8 }}>{d.price}</div>
                <div style={{ fontSize:12, color:'rgba(26,15,10,0.55)', lineHeight:1.7 }}>{d.desc}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Tips */}
        <Section title="💡 实用贴士" color="var(--jade)">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14 }}>
            {tips.map(t => (
              <div key={t.title} style={{ display:'flex', gap:12, background:'rgba(255,252,245,0.9)', borderRadius:12, border:'1px solid var(--border)', padding:'16px' }}>
                <div style={{ fontSize:24, flexShrink:0 }}>{t.icon}</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--ink)', marginBottom:4 }}>{t.title}</div>
                  <div style={{ fontSize:12, color:'rgba(26,15,10,0.55)', lineHeight:1.7 }}>{t.content}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
      <div style={{ height:60 }} />
    </div>
  )
}

// ── 历史文化 ───────────────────────────────────────────────
export function HistoryPage() {
  const CULTURE = [
    { title:'佛教文化深度传承', icon:'🙏', content:'灵山胜境以"小灵山"佛教渊源为根基，融合了汉传佛教与藏传佛教文化精髓，形成了独特的佛教文化体系。景区内的祥符禅寺作为千年古刹，保留了古井、银杏等历史遗存，见证了佛教在此地的千年传承。' },
    { title:'传统艺术与现代科技', icon:'🎨', content:'灵山胜境将传统佛教艺术与现代建筑技术、数字科技完美结合，灵山梵宫融合菩提伽耶塔风格与中国石窟艺术，内部汇集东阳木雕、敦煌壁画、扬州漆器、景泰蓝须弥灯等多种传统工艺，同时运用光学、声学等现代科技。' },
    { title:'世界佛教交流平台', icon:'🌏', content:'灵山胜境作为世界佛教论坛永久会址，已成功举办多届世界佛教论坛，成为全球佛教徒交流的重要平台，促进了不同佛教流派、不同文化背景之间的对话与融合。' },
    { title:'玄奘法师与小灵山', icon:'📜', content:'唐贞观年间，玄奘法师西行取经归来，见马山"层峦丛翠，曲水净秀，山形酷似印度灵鹫山"，遂将《大般若经》中的"灵鹫胜境"之名赐予此地，命名为"小灵山"，由大弟子窥基法师在此建庵住持道场。' },
  ]

  return (
    <div style={{ height:'100%', overflowY:'auto' }}>
      <div style={{ maxWidth:1000, margin:'0 auto', padding:'40px 28px' }}>
        <div style={{ textAlign:'center', marginBottom:40 }}>
          <h2 style={{ fontFamily:"'Ma Shan Zheng',cursive", fontSize:32, color:'var(--ink)', letterSpacing:3 }}>历史文化</h2>
          <div style={{ fontSize:11, color:'var(--jade)', letterSpacing:2.5, textTransform:'uppercase', marginTop:4 }}>History & Culture</div>
          <div style={{ width:48, height:2, background:'linear-gradient(90deg,transparent,var(--gold),transparent)', margin:'12px auto 0' }} />
        </div>

        {/* Timeline */}
        <Section title="🕰️ 千年发展历程">
          <div style={{ display:'flex', flexDirection:'column' }}>
            {historyData.map((h, i) => (
              <div key={i} style={{ display:'flex', gap:20, alignItems:'flex-start', paddingBottom:i<historyData.length-1?28:0, animation:`fadeUp 0.4s ease ${i*0.08}s both` }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                  <div style={{ width:40, height:40, borderRadius:'50%', background:'var(--gold-pale)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>{h.icon}</div>
                  {i < historyData.length-1 && <div style={{ width:1, flex:1, minHeight:28, background:'var(--border)', marginTop:4 }} />}
                </div>
                <div style={{ paddingTop:8 }}>
                  <div style={{ fontSize:13, color:'var(--gold)', letterSpacing:0.5, marginBottom:5, fontWeight:500 }}>{h.year}</div>
                  <div style={{ fontSize:14, color:'var(--ink)', lineHeight:1.8 }}>{h.event}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Culture sections */}
        <Section title="🏛️ 文化内涵">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {CULTURE.map((c, i) => (
              <div key={c.title} style={{ background:'rgba(255,252,245,0.9)', borderRadius:12, border:'1px solid var(--border)', padding:'20px', animation:`fadeUp 0.4s ease ${i*0.08}s both` }}>
                <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:10 }}>
                  <span style={{ fontSize:24 }}>{c.icon}</span>
                  <span style={{ fontSize:14, fontWeight:600, color:'var(--ink)', letterSpacing:0.3 }}>{c.title}</span>
                </div>
                <div style={{ fontSize:13, color:'rgba(26,15,10,0.62)', lineHeight:1.9 }}>{c.content}</div>
              </div>
            ))}
          </div>
        </Section>
      </div>
      <div style={{ height:60 }} />
    </div>
  )
}

function Section({ title, color, children }) {
  return (
    <div style={{ marginBottom:36 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
        <div style={{ width:3, height:18, borderRadius:2, background: color||'var(--gold)' }} />
        <div style={{ fontSize:16, fontWeight:600, color:'var(--ink)', letterSpacing:0.5 }}>{title}</div>
      </div>
      {children}
    </div>
  )
}

function InfoBlock({ icon, title, content }) {
  return (
    <div style={{ background:'rgba(255,252,245,0.9)', borderRadius:12, border:'1px solid var(--border)', padding:'16px' }}>
      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:6 }}>
        <span style={{ fontSize:18 }}>{icon}</span>
        <span style={{ fontSize:13, fontWeight:600, color:'var(--ink)' }}>{title}</span>
      </div>
      <div style={{ fontSize:13, color:'rgba(26,15,10,0.6)', lineHeight:1.7 }}>{content}</div>
    </div>
  )
}
