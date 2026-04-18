import { useState } from 'react'
import { spots } from '../data/lingshan'

const CATS = [
  { id:'all',         label:'全部景点' },
  { id:'landmark',    label:'地标建筑' },
  { id:'performance', label:'演艺表演' },
  { id:'temple',      label:'千年古刹' },
  { id:'culture',     label:'文化展示' },
  { id:'worship',     label:'祈福圣地' },
  { id:'nature',      label:'自然风光' },
]

export default function SpotsPage() {
  const [cat, setCat] = useState('all')
  const [selected, setSelected] = useState(null)

  const filtered = cat === 'all' ? spots : spots.filter(s => s.category === cat)

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Filter bar */}
      <div style={{
        padding:'14px 28px', borderBottom:'1px solid var(--border)',
        background:'rgba(250,245,236,0.95)', backdropFilter:'blur(10px)',
        display:'flex', gap:8, overflowX:'auto', flexShrink:0,
        scrollbarWidth:'none',
      }}>
        {CATS.map(c => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            style={{
              flexShrink:0, padding:'6px 16px', borderRadius:20, fontSize:13,
              background: cat===c.id ? 'var(--gold)' : 'transparent',
              color: cat===c.id ? 'white' : 'var(--ink2)',
              border:`1px solid ${cat===c.id ? 'var(--gold)' : 'var(--border)'}`,
              transition:'all 0.2s', cursor:'pointer',
              fontFamily:"'Noto Sans SC',sans-serif",
            }}
          >{c.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        {/* Grid */}
        <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:18 }}>
            {filtered.map((spot, i) => (
              <SpotDetailCard
                key={spot.id}
                spot={spot}
                index={i}
                active={selected?.id === spot.id}
                onClick={() => setSelected(selected?.id === spot.id ? null : spot)}
              />
            ))}
          </div>
          <div style={{ height:40 }} />
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{
            width:340, flexShrink:0,
            background:'rgba(250,245,236,0.97)',
            borderLeft:'1px solid var(--border)',
            overflowY:'auto', padding:'24px',
            animation:'slideIn 0.25s ease',
          }}>
            <button
              onClick={() => setSelected(null)}
              style={{ float:'right', fontSize:18, color:'rgba(26,15,10,0.4)', cursor:'pointer', background:'none', border:'none' }}
            >✕</button>
            <div style={{ fontSize:40, marginBottom:12 }}>{selected.icon}</div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
              <h3 style={{ fontSize:20, color:'var(--ink)', fontFamily:"'Ma Shan Zheng',cursive", letterSpacing:1 }}>{selected.name}</h3>
              <span style={{ fontSize:11, padding:'2px 9px', borderRadius:10, background:selected.tagColor+'18', color:selected.tagColor, border:`1px solid ${selected.tagColor}30` }}>{selected.tag}</span>
            </div>

            <div style={{ fontSize:14, color:'rgba(26,15,10,0.65)', lineHeight:1.9, marginBottom:20 }}>{selected.desc}</div>

            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, color:'var(--jade)', letterSpacing:1, marginBottom:8, textTransform:'uppercase' }}>游玩亮点</div>
              {selected.highlights.map(h => (
                <div key={h} style={{ display:'flex', gap:8, alignItems:'flex-start', marginBottom:6 }}>
                  <span style={{ color:'var(--gold)', fontSize:12, marginTop:1 }}>◆</span>
                  <span style={{ fontSize:13, color:'var(--ink)', lineHeight:1.6 }}>{h}</span>
                </div>
              ))}
            </div>

            <div style={{ background:'var(--jade-pale)', borderRadius:10, padding:'12px 14px', border:'1px solid var(--border2)' }}>
              <div style={{ fontSize:11, color:'var(--jade)', marginBottom:4, letterSpacing:0.5 }}>⏰ 开放时间</div>
              <div style={{ fontSize:13, color:'var(--ink)', whiteSpace:'pre-line', lineHeight:1.8 }}>{selected.openTime}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SpotDetailCard({ spot, index, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? 'rgba(201,168,76,0.06)' : 'rgba(255,252,245,0.88)',
        borderRadius:12, border:`1px solid ${active ? 'rgba(201,168,76,0.4)' : 'var(--border)'}`,
        padding:'18px', cursor:'pointer',
        transition:'all 0.22s',
        animation:`fadeUp 0.4s ease ${index*0.05}s both`,
      }}
      onMouseEnter={e => { if(!active) e.currentTarget.style.boxShadow='var(--shadow)' }}
      onMouseLeave={e => { if(!active) e.currentTarget.style.boxShadow='none' }}
    >
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <span style={{ fontSize:28 }}>{spot.icon}</span>
          <div>
            <div style={{ fontSize:15, fontWeight:600, color:'var(--ink)', letterSpacing:0.3 }}>{spot.name}</div>
            <div style={{ fontSize:10, color:'var(--text-mute)', marginTop:1, fontFamily:"'Noto Sans SC',sans-serif" }}>{spot.id}</div>
          </div>
        </div>
        <span style={{ fontSize:10, padding:'2px 9px', borderRadius:10, background:spot.tagColor+'18', color:spot.tagColor, border:`1px solid ${spot.tagColor}30`, flexShrink:0 }}>{spot.tag}</span>
      </div>
      <div style={{ fontSize:13, color:'rgba(26,15,10,0.58)', lineHeight:1.7, marginBottom:12 }}>{spot.brief}</div>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        {spot.highlights.map(h => (
          <span key={h} style={{ fontSize:10, padding:'3px 9px', borderRadius:8, background:'var(--gold-pale)', color:'#8a6020', border:'1px solid var(--border)' }}>{h}</span>
        ))}
      </div>
      <div style={{ marginTop:12, fontSize:11, color:'var(--jade)', display:'flex', alignItems:'center', gap:4 }}>
        <span>⏰</span>
        <span style={{ overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
          {spot.openTime.split('\n')[0]}
        </span>
      </div>
    </div>
  )
}
