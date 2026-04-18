import { useState, useEffect } from 'react'
import { Card, CardHeader, CardBody, Button, FormField, Input, Textarea, Select, Spinner } from '../components/UI'
import { getAvatarList, createAvatar, updateAvatar, activateAvatar, getVoices } from '../services/api'

const AVATAR_ICONS = { guide_female: '🌸', guide_male: '👨', ancient: '🏮', modern: '💼' }
const AVATAR_TYPE_NAMES = { guide_female: '女性导游', guide_male: '男性导游', ancient: '古装形象', modern: '现代商务' }

const DEFAULT_FORM = {
  name: '小慧',
  avatar_type: 'guide_female',
  personality: '热情友善、知识渊博、善于沟通，具有亲和力，善于将历史故事娓娓道来',
  greeting: '您好！我是景区AI导游小慧，很高兴为您服务！请问您想了解什么？',
  voice_id: 'zh-CN-XiaoxiaoNeural',
}

export default function Avatar({ showToast }) {
  const [avatars, setAvatars] = useState([])
  const [voices, setVoices] = useState([])
  const [form, setForm] = useState(DEFAULT_FORM)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [av, vo] = await Promise.all([getAvatarList(), getVoices()])
      setAvatars(av.avatars || [])
      setVoices(vo.voices || [])
      const active = av.avatars?.find(a => a.is_active) || av.avatars?.[0]
      if (active) { setForm({ ...DEFAULT_FORM, ...active }); setEditingId(active.id) }
    } catch {
      showToast('加载配置失败，请确认后端服务', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editingId) {
        await updateAvatar(editingId, form)
      } else {
        const d = await createAvatar(form)
        setEditingId(d.id)
      }
      showToast('✅ 配置已保存', 'success')
      load()
    } catch {
      showToast('保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleActivate = async () => {
    if (!editingId) { showToast('请先保存配置', 'error'); return }
    try {
      await activateAvatar(editingId)
      showToast(`✅ 已激活：${form.name}`, 'success')
      load()
    } catch {
      showToast('激活失败', 'error')
    }
  }

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 18, animation: 'fadeUp 0.3s ease' }}>
      {/* Preview card */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card style={{ background: 'linear-gradient(145deg, var(--surface), rgba(79,142,247,0.04))' }}>
          <CardHeader title="当前数字人预览" icon="🤖" />
          <CardBody style={{ textAlign: 'center', paddingTop: 24, paddingBottom: 24 }}>
            <div style={{
              width: 100, height: 100, borderRadius: '50%', margin: '0 auto 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 52,
              background: 'linear-gradient(135deg, var(--surface2), rgba(79,142,247,0.1))',
              border: '2px solid rgba(79,142,247,0.25)',
            }}>
              {AVATAR_ICONS[form.avatar_type] || '🌸'}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Syne, sans-serif', marginBottom: 6 }}>{form.name}</div>
            <div style={{
              display: 'inline-block', padding: '3px 12px', borderRadius: 20,
              background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.2)',
              fontSize: 12, color: 'var(--accent)', marginBottom: 12,
            }}>
              {AVATAR_TYPE_NAMES[form.avatar_type] || form.avatar_type}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-mute)', lineHeight: 1.6, marginBottom: 18 }}>
              {form.personality?.substring(0, 60)}…
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Button onClick={handleActivate} variant="success" size="sm">✅ 激活上线</Button>
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving ? <Spinner size={12} /> : '💾'} 保存
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Avatars list */}
        <Card>
          <CardHeader title="已有配置" icon="📋" subtitle={`共 ${avatars.length} 个`} />
          <CardBody style={{ paddingTop: 8 }}>
            {loading
              ? [1,2].map(i => <div key={i} className="skeleton" style={{ height: 48, marginBottom: 8, borderRadius: 8 }} />)
              : avatars.map(a => (
                <div
                  key={a.id}
                  onClick={() => { setForm({ ...DEFAULT_FORM, ...a }); setEditingId(a.id) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 8, marginBottom: 6,
                    background: editingId === a.id ? 'rgba(79,142,247,0.1)' : 'var(--surface2)',
                    border: `1px solid ${editingId === a.id ? 'rgba(79,142,247,0.25)' : 'transparent'}`,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 20 }}>{AVATAR_ICONS[a.avatar_type] || '🌸'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-mute)' }}>{AVATAR_TYPE_NAMES[a.avatar_type]}</div>
                  </div>
                  {a.is_active && (
                    <span style={{ fontSize: 10, color: 'var(--green)', background: 'rgba(16,185,129,0.1)', padding: '2px 7px', borderRadius: 10, border: '1px solid rgba(16,185,129,0.2)' }}>
                      在线
                    </span>
                  )}
                </div>
              ))
            }
          </CardBody>
        </Card>
      </div>

      {/* Config form */}
      <Card>
        <CardHeader title="数字人参数配置" icon="⚙️" subtitle="修改后点击保存生效" />
        <CardBody>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <FormField label="导游名称">
              <Input value={form.name} onChange={set('name')} placeholder="如：小慧" />
            </FormField>
            <FormField label="形象类型">
              <Select value={form.avatar_type} onChange={set('avatar_type')}>
                <option value="guide_female">🌸 女性导游（默认）</option>
                <option value="guide_male">👨 男性导游</option>
                <option value="ancient">🏮 古装形象</option>
                <option value="modern">💼 现代商务</option>
              </Select>
            </FormField>
          </div>

          <FormField label="语音音色">
            <Select value={form.voice_id} onChange={set('voice_id')}>
              {voices.length > 0
                ? voices.map(v => (
                  <option key={v.id} value={v.id}>{v.name}（{v.style}）</option>
                ))
                : <>
                  <option value="zh-CN-XiaoxiaoNeural">晓晓（温柔亲切）</option>
                  <option value="zh-CN-XiaohanNeural">晓涵（活泼开朗）</option>
                  <option value="zh-CN-YunxiNeural">云希（阳光活力）</option>
                  <option value="zh-CN-YunjianNeural">云健（磁性稳重）</option>
                  <option value="zh-CN-YunyangNeural">云扬（专业播报）</option>
                </>
              }
            </Select>
          </FormField>

          <FormField label="性格特质描述">
            <Textarea
              value={form.personality}
              onChange={set('personality')}
              placeholder="描述数字人的性格特点..."
              style={{ minHeight: 80 }}
            />
          </FormField>

          <FormField label="欢迎语">
            <Textarea
              value={form.greeting}
              onChange={set('greeting')}
              placeholder="游客进入时的第一句话..."
              style={{ minHeight: 70 }}
            />
          </FormField>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <Button onClick={handleSave} disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
              {saving ? <Spinner size={14} /> : '💾'} 保存配置
            </Button>
            <Button variant="ghost" onClick={() => { setForm(DEFAULT_FORM); setEditingId(null) }}>
              重置
            </Button>
          </div>

          {/* Prompt preview */}
          <div style={{
            marginTop: 20, padding: '14px 16px',
            background: 'var(--surface2)', borderRadius: 10,
            border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-mute)', marginBottom: 8 }}>预览：AI System Prompt 片段</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7, fontFamily: 'DM Mono, monospace' }}>
              你是<span style={{ color: 'var(--accent)' }}>{form.name}</span>，智慧景区的AI数字人导游。<br />
              性格特质：<span style={{ color: 'var(--gold)' }}>{form.personality?.substring(0, 40)}…</span>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
