import { useState, useEffect, useRef } from 'react'
import { Card, CardHeader, CardBody, Button, FormField, Input, Textarea, Select, Badge, Spinner } from '../components/UI'
import { getKnowledgeList, addKnowledge, uploadKnowledgeFile, deleteKnowledge } from '../services/api'

const CAT_OPTIONS = [
  { value: 'history',    label: '历史沿革', color: 'var(--gold)' },
  { value: 'culture',    label: '文化特色', color: '#a78bfa' },
  { value: 'route',      label: '游览路线', color: 'var(--green)' },
  { value: 'faq',        label: '常见问题', color: 'var(--accent)' },
  { value: 'attraction', label: '景点介绍', color: 'var(--red)' },
  { value: 'general',    label: '通用',     color: 'var(--text-dim)' },
]

function catColor(c) { return CAT_OPTIONS.find(o => o.value === c)?.color || 'var(--text-dim)' }
function catLabel(c) { return CAT_OPTIONS.find(o => o.value === c)?.label || c }

export default function Knowledge({ showToast }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ title: '', category: 'history', content: '' })
  const fileRef = useRef(null)

  const load = async () => {
    setLoading(true)
    try {
      const d = await getKnowledgeList()
      const all = [
        ...(d.builtin_docs || []).map(x => ({ ...x, isBuiltin: true })),
        ...(d.custom_docs || []).map(x => ({ ...x, isBuiltin: false })),
      ]
      setDocs(all)
    } catch {
      showToast('加载知识库失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      showToast('请填写标题和内容', 'error'); return
    }
    setSubmitting(true)
    try {
      await addKnowledge(form)
      showToast('✅ 知识文档添加成功', 'success')
      setForm({ title: '', category: 'history', content: '' })
      load()
    } catch {
      showToast('添加失败，请检查后端服务', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpload = async (file) => {
    if (!file) return
    setSubmitting(true)
    try {
      const d = await uploadKnowledgeFile(file, 'general')
      showToast('✅ ' + d.message, 'success')
      load()
    } catch {
      showToast('上传失败', 'error')
    } finally {
      setSubmitting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('确认删除此文档？')) return
    try {
      await deleteKnowledge(id)
      showToast('文档已删除', 'success')
      load()
    } catch {
      showToast('删除失败', 'error')
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 18, animation: 'fadeUp 0.3s ease' }}>
      {/* Left: Add form + Upload */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <CardHeader title="添加知识文档" icon="📝" />
          <CardBody>
            <FormField label="文档标题">
              <Input placeholder="如：主要景点介绍" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </FormField>
            <FormField label="知识类别">
              <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </FormField>
            <FormField label="知识内容">
              <Textarea
                placeholder="输入景区相关知识内容..."
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                style={{ minHeight: 120 }}
              />
            </FormField>
            <Button onClick={handleAdd} disabled={submitting} style={{ width: '100%', justifyContent: 'center' }}>
              {submitting ? <Spinner size={14} /> : '✅'} 添加到知识库
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="批量上传文档" icon="📂" subtitle="支持 .txt / .md 格式" />
          <CardBody>
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                border: '2px dashed var(--border2)', borderRadius: 10,
                padding: '28px 20px', textAlign: 'center',
                cursor: 'pointer', transition: 'border-color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border2)'}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>点击选择文件</div>
              <div style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 4 }}>景区讲解词、历史文献、常见问答等</div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md"
              style={{ display: 'none' }}
              onChange={e => handleUpload(e.target.files[0])}
            />
          </CardBody>
        </Card>
      </div>

      {/* Right: Doc list */}
      <Card style={{ display: 'flex', flexDirection: 'column' }}>
        <CardHeader
          title="知识库文档列表"
          icon="📋"
          subtitle={`共 ${docs.length} 篇文档`}
          action={<Button variant="ghost" size="sm" onClick={load}>🔄 刷新</Button>}
        />
        <CardBody style={{ flex: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 200px)', paddingTop: 10 }}>
          {loading
            ? Array(5).fill(0).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 64, marginBottom: 10, borderRadius: 8 }} />
            ))
            : docs.length === 0
              ? <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-mute)', fontSize: 13 }}>暂无文档</div>
              : docs.map((doc, i) => (
                <div
                  key={doc.id || doc.category + i}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '11px 12px', borderRadius: 8,
                    background: 'var(--surface2)', marginBottom: 8,
                    border: '1px solid transparent', transition: 'border-color 0.15s',
                    animation: `fadeUp 0.25s ease ${i * 0.03}s both`,
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                >
                  <Badge color={catColor(doc.category)}>{catLabel(doc.category)}</Badge>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {doc.title}
                      {doc.isBuiltin && (
                        <span style={{ fontSize: 9, color: 'var(--text-mute)', background: 'var(--surface3)', padding: '1px 6px', borderRadius: 8 }}>内置</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {(doc.content || '').substring(0, 80)}…
                    </div>
                  </div>
                  {!doc.isBuiltin && (
                    <Button variant="danger" size="sm" onClick={() => handleDelete(doc.id)} style={{ flexShrink: 0 }}>
                      删除
                    </Button>
                  )}
                </div>
              ))
          }
        </CardBody>
      </Card>
    </div>
  )
}
