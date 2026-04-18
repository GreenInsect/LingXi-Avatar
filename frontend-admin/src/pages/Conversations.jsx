import { useState, useEffect } from 'react'
import { Card, CardHeader, CardBody, Button } from '../components/UI'
import { getConversationList } from '../services/api'

export default function Conversations() {
  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = async (p = page) => {
    setLoading(true)
    try {
      const d = await getConversationList(p)
      setData(d)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(page) }, [page])

  const sessions = data?.data || []
  const total = data?.total || 0

  const scoreColor = (s) => s >= 75 ? 'var(--green)' : s >= 50 ? 'var(--gold)' : 'var(--red)'

  return (
    <div style={{ animation: 'fadeUp 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          共 <span style={{ color: 'var(--accent)', fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>{total}</span> 个会话记录
        </div>
        <Button variant="ghost" size="sm" onClick={() => load(page)}>🔄 刷新</Button>
      </div>

      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['会话ID', '消息数', '开始时间', '结束时间', '情感评分'].map(h => (
                  <th key={h} style={{
                    padding: '11px 16px', textAlign: 'left',
                    fontSize: 10, color: 'var(--text-mute)',
                    textTransform: 'uppercase', letterSpacing: 0.7,
                    fontWeight: 500,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array(8).fill(0).map((_, i) => (
                  <tr key={i}>
                    {Array(5).fill(0).map((_, j) => (
                      <td key={j} style={{ padding: '14px 16px' }}>
                        <div className="skeleton" style={{ height: 16, width: j === 0 ? 140 : j === 1 ? 50 : j === 4 ? 60 : 120 }} />
                      </td>
                    ))}
                  </tr>
                ))
                : sessions.length === 0
                  ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-mute)', fontSize: 13 }}>
                        暂无对话记录，游客开始交互后将自动显示
                      </td>
                    </tr>
                  )
                  : sessions.map((s, i) => (
                    <tr key={s.session_id} style={{ borderBottom: '1px solid var(--border)', animation: `fadeUp 0.25s ease ${i * 0.04}s both` }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '13px 16px', fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--text-dim)' }}>
                        {s.session_id.substring(0, 18)}…
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{
                          padding: '2px 9px', borderRadius: 10,
                          background: 'var(--surface3)', fontSize: 12,
                          color: 'var(--text)',
                        }}>{s.msg_count} 条</span>
                      </td>
                      <td style={{ padding: '13px 16px', color: 'var(--text-dim)', fontSize: 12 }}>
                        {new Date(s.start_time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '13px 16px', color: 'var(--text-dim)', fontSize: 12 }}>
                        {new Date(s.end_time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ color: scoreColor(s.avg_sentiment), fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>
                          {s.avg_sentiment}%
                        </span>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
          <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading}>
            ← 上一页
          </Button>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'DM Mono, monospace' }}>
            第 {page} 页 · 共 {Math.ceil(total / 15)} 页
          </span>
          <Button variant="ghost" size="sm" onClick={() => setPage(p => p + 1)} disabled={sessions.length < 15 || loading}>
            下一页 →
          </Button>
        </div>
      </Card>
    </div>
  )
}
