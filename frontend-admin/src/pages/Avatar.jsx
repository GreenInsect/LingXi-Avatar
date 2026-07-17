import { useState, useEffect } from 'react'
import { Card, CardHeader, CardBody, Button, FormField, Input, Textarea, Select, Spinner } from '../components/UI'
import { getAvatarList, createAvatar, updateAvatar, activateAvatar, getVoices } from '../services/api'

const AVATAR_PRESETS = {
  lingxi: {
    icon: '🌿',
    label: 'Lingxi',
    name: 'Lingxi',
    accent: '#34d399',
    summary: '项目新增主数字人，温柔清晰，适合灵山胜境默认导览服务。',
    personality: '温柔清晰、真诚可靠、文化感强，适合作为灵山胜境主数字导游，能够自然讲解景区文化、路线、门票和游览建议。',
    greeting: '您好！我是灵山胜境数字导游 Lingxi，很高兴为您服务！请问您想了解什么？',
    modelPath: 'live2D/lingxi/lingxi.model3.json',
  },
  yumi: {
    icon: '✨',
    label: 'Yumi',
    name: 'Yumi',
    accent: '#4f8ef7',
    summary: '默认数字导游，温柔明亮，适合景区常规讲解与问答。',
    personality: '温柔明亮、亲和可靠、表达丰富，适合担任默认景区数字导游，回答清晰自然，并能主动照顾游客情绪。',
    greeting: '您好！我是灵山胜境数字导游 Yumi，很高兴为您服务！请问您想了解什么？',
    modelPath: 'live2D/yumi/yumi.model3.json',
    mobileModelPath: 'live2D/yumi/yumi.mobile.model3.json',
  },
  strawberryBunny: {
    icon: '🍓',
    label: '草莓兔兔',
    name: '草莓兔兔',
    accent: '#f472b6',
    summary: '甜美亲切，适合亲子游客与轻松互动场景。',
    personality: '甜美亲切、活泼可爱、语气柔和，适合亲子游客、轻松问答和温暖陪伴式讲解。',
    greeting: '您好！我是灵山胜境数字导游草莓兔兔，今天想带您甜甜地逛一逛景区～',
    modelPath: 'live2D/草莓兔兔 试用/草莓兔兔  试用.model3.json',
  },
  bingtang: {
    icon: '🧊',
    label: '冰糖',
    name: '冰糖',
    accent: '#22d3ee',
    summary: '干练自信，适合重点讲解、活动主持和高信息密度问答。',
    personality: '干练自信、表达利落、镜头感强，适合进行重点景点讲解、活动主持和高信息密度问答。',
    greeting: '您好！我是灵山胜境数字导游冰糖，接下来由我为您清晰介绍景区亮点。',
    modelPath: 'live2D/免费模型冰糖/免费模型冰糖.model3.json',
  },
  ellen: {
    icon: '🐱',
    label: 'Ellen',
    name: 'Ellen',
    accent: '#a78bfa',
    summary: '轻松俏皮，适合年轻游客互动和轻快讲解。',
    personality: '轻松俏皮、反应灵动、表达自然，适合年轻游客互动、趣味问答和轻快的景区介绍。',
    greeting: '您好！我是灵山胜境数字导游 Ellen，想了解景点、路线还是门票信息呢？',
    modelPath: 'live2D/免费模型艾莲/免费模型艾莲.model3.json',
  },
  rabbitHole: {
    icon: '🎭',
    label: 'Rabbit Hole',
    name: 'Rabbit Hole',
    accent: '#fb7185',
    summary: '表演感更强，适合趣味活动与夸张情绪演出。',
    personality: '活泼调皮、戏剧感强、反应夸张，适合趣味活动、互动演出和更有记忆点的游客交流。',
    greeting: '您好！我是 Rabbit Hole，今天带您用更有趣的方式认识灵山胜境！',
    modelPath: 'live2D/兔子洞/兔子洞ldd.model3.json',
  },
  fuxuan: {
    icon: '🔮',
    label: 'Fu Xuan',
    name: 'Fu Xuan',
    accent: '#c084fc',
    summary: '沉稳理性，适合文化、历史和路线规划类讲解。',
    personality: '沉稳理性、表达精准、节奏从容，适合文化历史讲解、路线规划和需要可信度的服务场景。',
    greeting: '您好！我是灵山胜境数字导游 Fu Xuan，我会为您准确介绍景区文化与游览建议。',
    modelPath: 'live2D/符玄/符玄.model3.json',
  },
  huohuo: {
    icon: '🍃',
    label: 'Huo Huo',
    name: 'Huo Huo',
    accent: '#34d399',
    summary: '温柔谨慎，适合安抚型服务和陪伴式讲解。',
    personality: '温柔谨慎、真诚耐心、语气柔和，适合解答游客困惑、安抚情绪和陪伴式景区导览。',
    greeting: '您好！我是灵山胜境数字导游 Huo Huo，我会耐心陪您了解景区信息。',
    modelPath: 'live2D/藿藿/藿藿.model3.json',
  },
}

const AVATAR_OPTIONS = Object.entries(AVATAR_PRESETS).map(([id, preset]) => ({ id, ...preset }))
const LEGACY_AVATAR_TYPES = new Set(['guide_female', 'guide_male', 'ancient', 'modern'])

const DEFAULT_FORM = {
  name: AVATAR_PRESETS.lingxi.name,
  avatar_type: 'lingxi',
  personality: AVATAR_PRESETS.lingxi.personality,
  greeting: AVATAR_PRESETS.lingxi.greeting,
  voice_id: 'Cherry',
}

function getAvatarMeta(avatarType) {
  return AVATAR_PRESETS[avatarType] || {
    icon: '◐',
    label: avatarType || '自定义数字人',
    name: avatarType || '自定义数字人',
    accent: '#94a3b8',
    summary: '自定义配置，暂未绑定游客端内置 Live2D 角色。',
    personality: DEFAULT_FORM.personality,
    greeting: DEFAULT_FORM.greeting,
    modelPath: '未绑定',
  }
}

function isLegacyXiaohui(config = {}) {
  return LEGACY_AVATAR_TYPES.has(config.avatar_type)
    || config.name === '小慧'
    || String(config.greeting || '').includes('小慧')
}

function normalizeAvatarConfig(config) {
  if (!config) return { ...DEFAULT_FORM }
  if (isLegacyXiaohui(config)) {
    return {
      id: config.id,
      is_active: config.is_active,
      created_at: config.created_at,
      ...DEFAULT_FORM,
      voice_id: config.voice_id || DEFAULT_FORM.voice_id,
    }
  }

  const preset = AVATAR_PRESETS[config.avatar_type]
  return {
    ...(preset ? {
      name: preset.name,
      avatar_type: config.avatar_type,
      personality: preset.personality,
      greeting: preset.greeting,
      voice_id: DEFAULT_FORM.voice_id,
    } : DEFAULT_FORM),
    ...config,
  }
}

function applyPresetToForm(form, avatarType) {
  const preset = AVATAR_PRESETS[avatarType]
  if (!preset) return { ...form, avatar_type: avatarType }
  return {
    ...form,
    avatar_type: avatarType,
    name: preset.name,
    personality: preset.personality,
    greeting: preset.greeting,
  }
}

function toAvatarPayload(form) {
  return {
    name: form.name,
    avatar_type: form.avatar_type,
    voice_id: form.voice_id,
    personality: form.personality,
    greeting: form.greeting,
  }
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
      const normalizedAvatars = (av.avatars || []).map(normalizeAvatarConfig)
      console.debug('[admin-avatar] loaded', {
        count: normalizedAvatars.length,
        active: normalizedAvatars.find(a => a.is_active)?.avatar_type,
      })
      setAvatars(normalizedAvatars)
      setVoices(vo.voices || [])
      const active = normalizedAvatars.find(a => a.is_active) || normalizedAvatars[0]
      if (active) { setForm({ ...DEFAULT_FORM, ...active }); setEditingId(active.id) }
    } catch (error) {
      console.error('[admin-avatar] load failed', error)
      showToast('加载配置失败，请确认后端服务', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = toAvatarPayload(form)
      console.debug('[admin-avatar] save start', { editingId, payload })
      if (editingId) {
        await updateAvatar(editingId, payload)
      } else {
        const d = await createAvatar(payload)
        setEditingId(d.id)
      }
      showToast('✅ 配置已保存', 'success')
      load()
    } catch (error) {
      console.error('[admin-avatar] save failed', error)
      showToast('保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleActivate = async () => {
    if (!editingId) { showToast('请先保存配置', 'error'); return }
    try {
      console.debug('[admin-avatar] activate start', { editingId, name: form.name, avatar_type: form.avatar_type })
      await activateAvatar(editingId)
      showToast(`✅ 已激活：${form.name}`, 'success')
      load()
    } catch (error) {
      console.error('[admin-avatar] activate failed', error)
      showToast('激活失败', 'error')
    }
  }

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))
  const handleAvatarTypeChange = (e) => {
    const avatarType = e.target.value
    console.debug('[admin-avatar] preset selected', { avatarType })
    setForm(f => applyPresetToForm(f, avatarType))
  }
  const currentMeta = getAvatarMeta(form.avatar_type)

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
              {currentMeta.icon}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Syne, sans-serif', marginBottom: 6 }}>{form.name}</div>
            <div style={{
              display: 'inline-block', padding: '3px 12px', borderRadius: 20,
              background: `${currentMeta.accent}18`, border: `1px solid ${currentMeta.accent}40`,
              fontSize: 12, color: currentMeta.accent, marginBottom: 12,
            }}>
              {currentMeta.label}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-mute)', lineHeight: 1.6, marginBottom: 18 }}>
              {currentMeta.summary}
            </div>
            <div style={{
              fontSize: 10, color: 'var(--text-mute)', lineHeight: 1.5,
              background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8,
              padding: '8px 10px', marginBottom: 16, textAlign: 'left', wordBreak: 'break-all',
            }}>
              <div>type: {form.avatar_type}</div>
              <div>model: {currentMeta.modelPath}</div>
              {currentMeta.mobileModelPath && <div>mobile: {currentMeta.mobileModelPath}</div>}
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
                  onClick={() => {
                    const normalized = normalizeAvatarConfig(a)
                    console.debug('[admin-avatar] config selected', { id: normalized.id, avatar_type: normalized.avatar_type })
                    setForm({ ...DEFAULT_FORM, ...normalized })
                    setEditingId(normalized.id)
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 8, marginBottom: 6,
                    background: editingId === a.id ? 'rgba(79,142,247,0.1)' : 'var(--surface2)',
                    border: `1px solid ${editingId === a.id ? 'rgba(79,142,247,0.25)' : 'transparent'}`,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 20 }}>{getAvatarMeta(a.avatar_type).icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-mute)' }}>{getAvatarMeta(a.avatar_type).label}</div>
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
          <FormField label="选择实际 Live2D 数字人">
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 10,
              marginBottom: 4,
            }}>
              {AVATAR_OPTIONS.map(option => {
                const active = form.avatar_type === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      console.debug('[admin-avatar] preset card selected', { avatarType: option.id })
                      setForm(f => applyPresetToForm(f, option.id))
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '11px 12px',
                      borderRadius: 8,
                      border: `1px solid ${active ? `${option.accent}70` : 'var(--border)'}`,
                      background: active ? `${option.accent}12` : 'var(--surface2)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                      <span style={{ fontSize: 17 }}>{option.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{option.label}</span>
                      {option.id === 'lingxi' && (
                        <span style={{
                          marginLeft: 'auto', fontSize: 9, color: 'var(--green)',
                          border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, padding: '1px 6px',
                        }}>默认</span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-mute)', lineHeight: 1.45 }}>{option.summary}</div>
                  </button>
                )
              })}
            </div>
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <FormField label="导游名称">
              <Input value={form.name} onChange={set('name')} placeholder="如：Yumi" />
            </FormField>
            <FormField label="形象类型">
              <Select value={form.avatar_type} onChange={handleAvatarTypeChange}>
                {AVATAR_OPTIONS.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.icon} {option.label}（{option.id}）
                  </option>
                ))}
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
                  <option value="Cherry">晓晓（温柔亲切）</option>
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
            <Button variant="ghost" onClick={() => { console.debug('[admin-avatar] reset to default'); setForm({ ...DEFAULT_FORM }); setEditingId(null) }}>
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
