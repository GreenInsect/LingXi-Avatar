import { useState } from 'react'
import { Card, CardHeader, CardBody, Button, Spinner } from '../components/UI'
import { getSentimentReport } from '../services/api'

const SENTIMENT_MAP = {
  positive: { label: '😊 积极正向', color: 'var(--green)' },
  neutral:  { label: '😐 基本中立', color: 'var(--gold)' },
  negative: { label: '😟 需要改善', color: 'var(--red)' },
}

export default function Report({ showToast }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [days, setDays] = useState(7)

  const load = async () => {
    setLoading(true)
    try {
      const d = await getSentimentReport(days)
      setData(d)
      showToast('报告已生成', 'success')
    } catch {
      showToast('报告生成失败，请检查后端服务', 'error')
    } finally {
      setLoading(false)
    }
  }

  const sentiment = data ? SENTIMENT_MAP[data.overall_sentiment] : null

  return (
    <div style={{ animation: 'fadeUp 0.3s ease' }}>
      {/* Header actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>基于AI对游客对话的深度情感分析</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            style={{ padding: '7px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12 }}
          >
            <option value={7}>近7天</option>
            <option value={14}>近14天</option>
            <option value={30}>近30天</option>
          </select>
          <Button onClick={load} disabled={loading}>
            {loading ? <Spinner size={14} /> : '🔄'} 生成报告
          </Button>
        </div>
      </div>

      {!data && !loading && (
        <div style={{
          padding: '60px 24px', textAlign: 'center',
          color: 'var(--text-mute)', fontSize: 13,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <div>点击「生成报告」按钮，AI将分析近期游客对话，生成深度洞察报告</div>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-dim)' }}>
          <Spinner size={32} color="var(--accent)" />
          <div style={{ marginTop: 14, fontSize: 13 }}>AI正在分析游客对话，生成洞察报告...</div>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Score cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
            <Card accent="var(--accent)">
              <CardBody>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>综合满意度评分</div>
                <div style={{
                  fontSize: 52, fontWeight: 800, fontFamily: 'Syne, sans-serif',
                  background: 'linear-gradient(135deg, var(--accent), var(--cyan))',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  {data.satisfaction_score ?? '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 4 }}>满分 100 分</div>
              </CardBody>
            </Card>

            <Card accent={sentiment?.color}>
              <CardBody>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>整体情感倾向</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: sentiment?.color, marginTop: 10 }}>
                  {sentiment?.label ?? '—'}
                </div>
              </CardBody>
            </Card>

            <Card accent="var(--cyan)">
              <CardBody>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>分析样本量</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--cyan)', fontFamily: 'Syne, sans-serif', marginTop: 6 }}>
                  {data.stats?.total_interactions ?? '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 4 }}>条游客对话</div>
              </CardBody>
            </Card>
          </div>

          {/* Insight rows */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <Card>
              <CardHeader title="游客主要关注点" icon="🎯" />
              <CardBody style={{ paddingTop: 10 }}>
                {(data.top_interests || []).map((item, i) => (
                  <InsightItem key={i} icon="🎯" text={item} index={i} />
                ))}
                {(!data.top_interests || data.top_interests.length === 0) && (
                  <div style={{ fontSize: 12, color: 'var(--text-mute)' }}>暂无数据</div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="服务优化建议" icon="💡" />
              <CardBody style={{ paddingTop: 10 }}>
                {(data.suggestions || []).map((item, i) => (
                  <InsightItem key={i} icon="💡" text={item} index={i} color="var(--gold)" />
                ))}
                {(!data.suggestions || data.suggestions.length === 0) && (
                  <div style={{ fontSize: 12, color: 'var(--text-mute)' }}>暂无建议</div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Emotion breakdown */}
          {data.emotion_breakdown && (
            <Card>
              <CardHeader title="情感细分分布" icon="📊" />
              <CardBody>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10 }}>
                  {Object.entries(data.emotion_breakdown).map(([k, v]) => {
                    const pct = Math.round(v * 100)
                    const colors = { happy:'#10b981', curious:'#4f8ef7', neutral:'#94a3b8', confused:'#f97316', disappointed:'#ef4444' }
                    const names = { happy:'开心', curious:'好奇', neutral:'平静', confused:'困惑', disappointed:'失望' }
                    return (
                      <div key={k} style={{ textAlign: 'center', padding: '12px 8px', background: 'var(--surface2)', borderRadius: 10 }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: colors[k] || 'var(--text)', fontFamily: 'Syne, sans-serif' }}>
                          {pct}%
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{names[k] || k}</div>
                      </div>
                    )
                  })}
                </div>
              </CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function InsightItem({ icon, text, index, color = 'var(--accent)' }) {
  return (
    <div style={{
      display: 'flex', gap: 10, padding: '9px 12px',
      background: 'var(--surface2)', borderRadius: 8, marginBottom: 8,
      fontSize: 13, lineHeight: 1.5, animation: `fadeUp 0.3s ease ${index * 0.07}s both`,
    }}>
      <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
      <span style={{ color: 'var(--text)' }}>{text}</span>
    </div>
  )
}
