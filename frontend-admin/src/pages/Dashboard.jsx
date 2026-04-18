import { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { Card, CardHeader, CardBody, StatCard } from '../components/UI'
import { getDashboard } from '../services/api'

const EMOTION_COLORS = {
  happy: '#10b981', curious: '#4f8ef7', neutral: '#94a3b8',
  satisfied: '#f59e0b', confused: '#f97316', disappointed: '#ef4444',
}
const EMOTION_CN = {
  happy: '开心', curious: '好奇', neutral: '平静',
  satisfied: '满意', confused: '困惑', disappointed: '失望',
}

const TooltipStyle = {
  contentStyle: { background: '#161e2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#dde6f5' },
  itemStyle: { color: '#4f8ef7' },
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const d = await getDashboard()
      setData(d)
    } catch (e) {
      setError('无法连接后端服务，请确认后端已启动（localhost:5000）')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])

  const emotionEntries = data
    ? Object.entries(data.emotion_distribution || {}).map(([k, v]) => ({
        name: EMOTION_CN[k] || k, value: v, key: k,
      }))
    : []

  const topQuestions = data?.top_questions?.slice(0, 7) || []

  return (
    <div style={{ animation: 'fadeUp 0.3s ease' }}>
      {error && (
        <div style={{
          padding: '12px 18px', marginBottom: 20,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 10, fontSize: 13, color: 'var(--red)',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        <StatCard label="今日服务人次" value={data?.today?.sessions} icon="👥" accent="var(--accent)" loading={loading} change={`本周累计 ${data?.week?.sessions ?? '—'} 人次`} />
        <StatCard label="今日消息数" value={data?.today?.messages} icon="💬" accent="var(--green)" loading={loading} />
        <StatCard label="综合满意度" value={data?.today?.satisfaction ? data.today.satisfaction + '%' : undefined} icon="⭐" accent="var(--gold)" loading={loading} change="基于情感分析" />
        <StatCard label="累计服务总量" value={data?.total?.sessions} icon="🌐" accent="var(--cyan)" loading={loading} />
      </div>

      {/* Charts row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, marginBottom: 14 }}>
        {/* Satisfaction trend */}
        <Card>
          <CardHeader title="近7日满意度趋势" icon="📉" subtitle="基于游客情感评分" />
          <CardBody>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={data?.satisfaction_trend || []} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="satGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f8ef7" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#4f8ef7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-mute)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[50, 100]} tick={{ fontSize: 11, fill: 'var(--text-mute)' }} axisLine={false} tickLine={false} />
                <Tooltip {...TooltipStyle} formatter={v => [v + '%', '满意度']} />
                <Area type="monotone" dataKey="score" stroke="#4f8ef7" strokeWidth={2} fill="url(#satGrad)" dot={{ fill: '#4f8ef7', r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        {/* Emotion distribution */}
        <Card>
          <CardHeader title="游客情感分布" icon="😊" subtitle="近7天" />
          <CardBody style={{ paddingTop: 12 }}>
            {loading
              ? [1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 28, marginBottom: 10 }} />)
              : emotionEntries.length === 0
                ? <div style={{ fontSize: 12, color: 'var(--text-mute)', textAlign: 'center', paddingTop: 40 }}>暂无情感数据</div>
                : emotionEntries.map(({ name, value, key }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 36, fontSize: 11, color: 'var(--text-dim)', textAlign: 'right', flexShrink: 0 }}>{name}</div>
                    <div style={{ flex: 1, height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 4,
                        width: `${value}%`,
                        background: EMOTION_COLORS[key] || 'var(--accent)',
                        transition: 'width 0.8s ease',
                      }} />
                    </div>
                    <div style={{ width: 36, fontSize: 11, color: 'var(--text-dim)', fontFamily: 'DM Mono, monospace' }}>{value}%</div>
                  </div>
                ))
            }
          </CardBody>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Hot questions */}
        <Card>
          <CardHeader title="热门问答关键词" icon="🔥" subtitle="近7天词频排行" />
          <CardBody style={{ paddingTop: 12 }}>
            {loading
              ? [1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 36, marginBottom: 8 }} />)
              : topQuestions.length === 0
                ? <div style={{ fontSize: 12, color: 'var(--text-mute)', textAlign: 'center', paddingTop: 30 }}>暂无数据</div>
                : topQuestions.map((q, i) => (
                  <div key={q.keyword} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', borderRadius: 8,
                    background: 'var(--surface2)', marginBottom: 7,
                  }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700,
                      background: i === 0 ? 'var(--gold)' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : 'var(--surface3)',
                      color: i < 3 ? 'white' : 'var(--text-dim)',
                    }}>{i + 1}</div>
                    <div style={{ flex: 1, fontSize: 13 }}>{q.keyword}</div>
                    <div style={{
                      fontSize: 11, color: 'var(--text-mute)',
                      background: 'var(--surface3)', padding: '2px 8px', borderRadius: 10,
                      fontFamily: 'DM Mono, monospace',
                    }}>{q.count}次</div>
                  </div>
                ))
            }
          </CardBody>
        </Card>

        {/* Realtime + input dist */}
        <Card>
          <CardHeader title="实时运营状态" icon="⚡" />
          <CardBody>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 18 }}>
              {[
                { label: '活跃会话', value: data?.realtime?.active_sessions, color: 'var(--cyan)' },
                { label: '平均响应', value: data?.realtime?.avg_response_time ? data.realtime.avg_response_time + 's' : '—', color: 'var(--green)' },
                { label: '知识命中', value: data?.realtime?.knowledge_hit_rate ? Math.round(data.realtime.knowledge_hit_rate * 100) + '%' : '—', color: 'var(--gold)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  background: 'var(--surface2)', borderRadius: 8,
                  padding: '12px 8px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color, fontFamily: 'Syne, sans-serif' }}>
                    {loading ? '—' : (value ?? '—')}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>📱 输入方式分布</div>
            {data?.input_distribution && (() => {
              const total = Object.values(data.input_distribution).reduce((a, b) => a + b, 0) || 1
              return Object.entries(data.input_distribution).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, width: 50, color: 'var(--text-dim)' }}>{k === 'text' ? '⌨️ 文字' : '🎤 语音'}</span>
                  <div style={{ flex: 1, height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round(v / total * 100)}%`, background: k === 'text' ? 'var(--accent)' : 'var(--pink)', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-mute)', fontFamily: 'DM Mono, monospace', width: 30 }}>
                    {Math.round(v / total * 100)}%
                  </span>
                </div>
              ))
            })()}

            <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, fontSize: 12, color: 'var(--text-dim)' }}>
              本周服务&nbsp;<span style={{ color: 'var(--accent)', fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>{data?.week?.sessions ?? '—'}</span>&nbsp;人次&emsp;
              日均&nbsp;<span style={{ color: 'var(--cyan)', fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>{data?.week?.avg_daily_sessions ?? '—'}</span>&nbsp;人次
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
