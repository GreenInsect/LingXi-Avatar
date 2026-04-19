import type { PageId } from '../types'

interface NavItem { id: PageId; label: string }

const NAV_ITEMS: NavItem[] = [
  { id: 'home',      label: '首页' },
  { id: 'spots',     label: '景点' },
  { id: 'routes',    label: '路线' },
  { id: 'nianhewan', label: '拈花湾' },
  { id: 'info',      label: '游览指南' },
  { id: 'history',   label: '历史文化' },
]

interface NavbarProps {
  activePage: PageId
  onNavigate: (p: PageId) => void
  onMenuToggle: () => void
  sidebarOpen: boolean
}

export default function Navbar({ activePage, onNavigate, onMenuToggle, sidebarOpen }: NavbarProps) {
  return (
    <header style={{
      height: 'var(--nav-h)', background: 'rgba(250,245,236,0.96)',
      backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 24px', gap: 0,
      position: 'relative', zIndex: 200, boxShadow: '0 1px 16px rgba(26,15,10,0.06)',
      flexShrink: 0,
    }}>
      {/* Hamburger */}
      <button onClick={onMenuToggle} style={{
        width: 40, height: 40, borderRadius: 8, marginRight: 12,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
        background: sidebarOpen ? 'var(--gold-pale)' : 'transparent', transition: 'all 0.2s',
        border: 'none', cursor: 'pointer',
      }}>
        {([0, 1, 2] as const).map(i => (
          <span key={i} style={{
            display: 'block', width: 20, height: 1.5,
            background: 'var(--ink)', borderRadius: 1, transition: 'all 0.25s',
            transform: sidebarOpen
              ? i === 0 ? 'rotate(45deg) translate(4.5px, 4.5px)'
                : i === 1 ? 'scaleX(0)'
                : 'rotate(-45deg) translate(4.5px, -4.5px)'
              : 'none',
          }} />
        ))}
      </button>

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 32 }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--gold), #a07830)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, boxShadow: '0 2px 8px rgba(201,168,76,0.4)',
        }}>🏔️</div>
        <div>
          <div style={{ fontFamily: "'Ma Shan Zheng',cursive", fontSize: 18, letterSpacing: 2, color: 'var(--ink)', lineHeight: 1 }}>灵山胜境</div>
          <div style={{ fontSize: 9, color: 'var(--jade)', letterSpacing: 1.5, textTransform: 'uppercase' }}>Lingshan Scenic Area</div>
        </div>
      </div>

      {/* Nav links */}
      <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
        {NAV_ITEMS.map(item => (
          <button key={item.id} onClick={() => onNavigate(item.id)} style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
            fontFamily: "'Noto Sans SC',sans-serif",
            background: activePage === item.id ? 'var(--gold-pale)' : 'transparent',
            color: activePage === item.id ? 'var(--gold)' : 'var(--ink2)',
            border: `1px solid ${activePage === item.id ? 'rgba(201,168,76,0.35)' : 'transparent'}`,
            transition: 'all 0.2s', letterSpacing: 0.5,
          }}
            onMouseEnter={e => { if (activePage !== item.id) { (e.currentTarget as HTMLButtonElement).style.background = 'var(--gold-pale)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--gold)' } }}
            onMouseLeave={e => { if (activePage !== item.id) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink2)' } }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 12px', borderRadius: 20,
        background: 'rgba(61,122,94,0.08)', border: '1px solid rgba(61,122,94,0.2)',
        fontSize: 11, color: 'var(--jade)', marginLeft: 'auto',
      }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--jade)', animation: 'pulse 2s infinite' }} />
        国家5A级景区
      </div>
    </header>
  )
}
