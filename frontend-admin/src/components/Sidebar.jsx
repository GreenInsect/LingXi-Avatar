const NAV = [
  { id: 'dashboard',     icon: '◈', label: '数据大屏' },
  { id: 'report',        icon: '◉', label: '感受度报告' },
  { id: 'conversations', icon: '◎', label: '对话记录' },
  { id: 'knowledge',     icon: '◐', label: '知识库管理' },
  { id: 'avatar',        icon: '◑', label: '数字人配置' },
]

export default function Sidebar({ activePage, onNavigate }) {
  return (
    <nav style={{
      width: 210, flexShrink: 0,
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      position: 'fixed', top: 0, left: 0, height: '100vh',
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, marginBottom: 10,
          background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20,
        }}>🌸</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'Syne, sans-serif', letterSpacing: 0.3 }}>
          智慧导游系统
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 3, letterSpacing: 0.5 }}>
          ADMIN CONSOLE v1.0
        </div>
      </div>

      {/* Nav groups */}
      <div style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        <div style={{ fontSize: 9, color: 'var(--text-mute)', letterSpacing: 1.5, textTransform: 'uppercase', padding: '8px 12px 6px' }}>
          数据总览
        </div>
        {NAV.slice(0, 3).map(item => (
          <NavItem key={item.id} {...item} active={activePage === item.id} onClick={() => onNavigate(item.id)} />
        ))}

        <div style={{ fontSize: 9, color: 'var(--text-mute)', letterSpacing: 1.5, textTransform: 'uppercase', padding: '16px 12px 6px' }}>
          内容管理
        </div>
        {NAV.slice(3).map(item => (
          <NavItem key={item.id} {...item} active={activePage === item.id} onClick={() => onNavigate(item.id)} />
        ))}
      </div>

      {/* Status footer */}
      <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10, color: 'var(--text-mute)', marginBottom: 6 }}>系统状态</div>
        <div style={{ fontSize: 11, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 2s infinite' }} />
          AI服务在线
        </div>
        <div style={{ fontSize: 11, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 2s infinite 0.5s' }} />
          知识库就绪
        </div>
      </div>
    </nav>
  )
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '9px 14px', borderRadius: 8,
        margin: '2px 0', border: 'none', textAlign: 'left',
        fontSize: 13, cursor: 'pointer',
        background: active ? 'rgba(79,142,247,0.1)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-dim)',
        outline: active ? '1px solid rgba(79,142,247,0.2)' : 'none',
        transition: 'all 0.15s',
        fontFamily: 'Noto Sans SC, sans-serif',
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)' } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)' } }}
    >
      <span style={{ fontSize: 14, width: 18, textAlign: 'center', fontFamily: 'monospace' }}>{icon}</span>
      {label}
    </button>
  )
}
