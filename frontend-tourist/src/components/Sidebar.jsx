const NAV = [
  { id:'home',      icon:'🏠', label:'景区首页' },
  { id:'spots',     icon:'📍', label:'核心景点' },
  { id:'routes',    icon:'🗺️', label:'游览路线' },
  { id:'nianhewan', icon:'🌸', label:'拈花湾小镇' },
  { id:'info',      icon:'ℹ️', label:'游览指南' },
  { id:'history',   icon:'📜', label:'历史文化' },
]

export default function Sidebar({ open, activePage, onNavigate }) {
  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          onClick={() => onNavigate(activePage)}
          style={{
            position:'fixed', inset:0, zIndex:149,
            background:'rgba(26,15,10,0.25)',
            backdropFilter:'blur(2px)',
            animation:'fadeIn 0.2s ease',
          }}
        />
      )}

      {/* Drawer */}
      <div style={{
        position:'fixed', top:'var(--nav-h)', left:0,
        width:'var(--sidebar-w)', height:'calc(100vh - var(--nav-h))',
        background:'rgba(250,245,236,0.97)',
        backdropFilter:'blur(20px)',
        borderRight:'1px solid var(--border)',
        zIndex:150,
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition:'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        display:'flex', flexDirection:'column',
        boxShadow: open ? '4px 0 32px rgba(26,15,10,0.12)' : 'none',
        overflowY:'auto',
      }}>
        <div style={{ padding:'20px 16px' }}>
          <div style={{ fontSize:10, color:'rgba(26,15,10,0.38)', letterSpacing:1.5, textTransform:'uppercase', marginBottom:10, paddingLeft:10 }}>
            景区导航
          </div>
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display:'flex', alignItems:'center', gap:12,
                width:'100%', padding:'11px 14px', borderRadius:10,
                marginBottom:4, textAlign:'left',
                background: activePage===item.id ? 'var(--gold-pale)' : 'transparent',
                color: activePage===item.id ? 'var(--gold)' : 'var(--ink)',
                border: `1px solid ${activePage===item.id ? 'rgba(201,168,76,0.3)' : 'transparent'}`,
                fontSize:13, letterSpacing:0.3,
                transition:'all 0.18s',
              }}
              onMouseEnter={e => { if(activePage!==item.id){ e.currentTarget.style.background='var(--gold-pale)' }}}
              onMouseLeave={e => { if(activePage!==item.id){ e.currentTarget.style.background='transparent' }}}
            >
              <span style={{ fontSize:17, width:24, textAlign:'center' }}>{item.icon}</span>
              <span style={{ fontFamily:"'Noto Sans SC',sans-serif" }}>{item.label}</span>
              {activePage===item.id && <span style={{ marginLeft:'auto', color:'var(--gold)', fontSize:14 }}>›</span>}
            </button>
          ))}
        </div>

        {/* Bottom info */}
        <div style={{ marginTop:'auto', padding:'16px', borderTop:'1px solid var(--border)' }}>
          <div style={{ fontSize:11, color:'rgba(26,15,10,0.45)', lineHeight:1.8 }}>
            <div>📍 江苏省无锡市马山镇</div>
            <div>⏰ 08:00–18:00（夏季）</div>
            <div>🎫 成人票 210元</div>
          </div>
        </div>
      </div>
    </>
  )
}
