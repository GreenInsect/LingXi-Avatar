// ── Card ──────────────────────────────────────────────────
export function Card({ children, style, accent }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      position: 'relative',
      ...style,
    }}>
      {accent && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: accent, borderRadius: '10px 10px 0 0',
        }} />
      )}
      {children}
    </div>
  )
}

// ── CardHeader ────────────────────────────────────────────
export function CardHeader({ title, subtitle, action, icon }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 20px 0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'Syne, sans-serif' }}>
            {title}
          </div>
          {subtitle && <div style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 1 }}>{subtitle}</div>}
        </div>
      </div>
      {action}
    </div>
  )
}

// ── CardBody ──────────────────────────────────────────────
export function CardBody({ children, style }) {
  return <div style={{ padding: '16px 20px', ...style }}>{children}</div>
}

// ── StatCard ──────────────────────────────────────────────
export function StatCard({ label, value, change, icon, accent = 'var(--accent)', loading }) {
  return (
    <Card accent={accent}>
      <CardBody>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
            {label}
          </div>
          <span style={{ fontSize: 20, opacity: 0.25 }}>{icon}</span>
        </div>
        {loading
          ? <div className="skeleton" style={{ height: 36, width: '60%', marginTop: 10 }} />
          : <div style={{
              fontSize: 34, fontWeight: 700, color: 'var(--text)',
              marginTop: 8, lineHeight: 1, fontFamily: 'Syne, sans-serif',
            }}>
              {value ?? '—'}
            </div>
        }
        {change && (
          <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 6 }}>{change}</div>
        )}
      </CardBody>
    </Card>
  )
}

// ── Badge ─────────────────────────────────────────────────
export function Badge({ children, color = 'var(--accent)' }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 9px', borderRadius: 12,
      fontSize: 10, fontWeight: 500,
      background: color + '20',
      color: color,
      border: `1px solid ${color}40`,
    }}>
      {children}
    </span>
  )
}

// ── Button ────────────────────────────────────────────────
export function Button({ children, onClick, variant = 'primary', size = 'md', disabled, style }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    borderRadius: 8, fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.18s', border: '1px solid transparent',
    fontSize: size === 'sm' ? 12 : 13,
    padding: size === 'sm' ? '5px 12px' : '8px 16px',
    opacity: disabled ? 0.5 : 1,
  }
  const variants = {
    primary: { background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' },
    ghost:   { background: 'var(--surface2)', color: 'var(--text)', borderColor: 'var(--border2)' },
    danger:  { background: 'rgba(239,68,68,0.1)', color: 'var(--red)', borderColor: 'rgba(239,68,68,0.25)' },
    success: { background: 'rgba(16,185,129,0.1)', color: 'var(--green)', borderColor: 'rgba(16,185,129,0.25)' },
  }
  return (
    <button onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  )
}

// ── FormField ─────────────────────────────────────────────
export function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, letterSpacing: 0.3 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputBase = {
  width: '100%',
  padding: '9px 12px',
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  fontSize: 13,
  outline: 'none',
  transition: 'border-color 0.2s',
}

export function Input({ style, ...props }) {
  return (
    <input
      style={{ ...inputBase, ...style }}
      onFocus={e => e.target.style.borderColor = 'var(--accent)'}
      onBlur={e => e.target.style.borderColor = 'var(--border)'}
      {...props}
    />
  )
}

export function Textarea({ style, ...props }) {
  return (
    <textarea
      style={{ ...inputBase, resize: 'vertical', minHeight: 90, lineHeight: 1.6, ...style }}
      onFocus={e => e.target.style.borderColor = 'var(--accent)'}
      onBlur={e => e.target.style.borderColor = 'var(--border)'}
      {...props}
    />
  )
}

export function Select({ children, style, ...props }) {
  return (
    <select
      style={{ ...inputBase, ...style }}
      onFocus={e => e.target.style.borderColor = 'var(--accent)'}
      onBlur={e => e.target.style.borderColor = 'var(--border)'}
      {...props}
    >
      {children}
    </select>
  )
}

// ── Spinner ───────────────────────────────────────────────
export function Spinner({ size = 16, color = 'white' }) {
  return (
    <div style={{
      width: size, height: size,
      border: `2px solid ${color}30`,
      borderTopColor: color,
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      display: 'inline-block',
    }} />
  )
}

// ── Toast ─────────────────────────────────────────────────
export function Toast({ message, type = 'default', visible }) {
  const colors = { default: 'var(--accent)', success: 'var(--green)', error: 'var(--red)' }
  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
      padding: '11px 20px',
      background: 'var(--surface2)',
      border: `1px solid ${colors[type]}50`,
      borderLeft: `3px solid ${colors[type]}`,
      borderRadius: 10,
      fontSize: 13, color: 'var(--text)',
      boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
      transform: visible ? 'translateY(0)' : 'translateY(16px)',
      opacity: visible ? 1 : 0,
      transition: 'all 0.28s ease',
      pointerEvents: 'none',
    }}>
      {message}
    </div>
  )
}
