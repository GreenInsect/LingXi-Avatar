import { useState, useEffect } from 'react'

const PAGE_TITLES = {
  dashboard:     '数据大屏',
  report:        '游客感受度报告',
  conversations: '对话记录',
  knowledge:     '知识库管理',
  avatar:        '数字人配置',
}

export default function Topbar({ activePage }) {
  const [time, setTime] = useState('')

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }))
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <header style={{
      height: 58,
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 26px', gap: 12,
      position: 'sticky', top: 0, zIndex: 50,
    }}>
      <h1 style={{
        fontSize: 17, fontWeight: 700, color: 'var(--text)',
        fontFamily: 'Syne, sans-serif',
      }}>
        {PAGE_TITLES[activePage] || '控制台'}
      </h1>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Live badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 20,
          background: 'rgba(16,185,129,0.08)',
          border: '1px solid rgba(16,185,129,0.2)',
          fontSize: 11, color: 'var(--green)',
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--green)', animation: 'pulse 2s ease infinite',
          }} />
          实时数据
        </div>

        {/* Time */}
        <div style={{
          fontSize: 11, color: 'var(--text-mute)',
          fontFamily: 'DM Mono, monospace', letterSpacing: 0.3,
        }}>
          {time}
        </div>
      </div>
    </header>
  )
}
