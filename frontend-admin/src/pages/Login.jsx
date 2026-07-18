import { useState } from 'react'
import { Button, FormField, Input, Spinner } from '../components/UI'
import { loginAdmin, setAdminSession } from '../services/api'

export default function Login({ onLogin, showToast }) {
  const [form, setForm] = useState({ username: 'admin', password: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async event => {
    event.preventDefault()
    if (!form.username.trim() || !form.password) {
      setError('请输入用户名和密码')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const session = await loginAdmin({
        username: form.username.trim(),
        password: form.password,
      })
      setAdminSession(session)
      showToast?.('登录成功', 'success')
      onLogin?.(session)
    } catch (error) {
      const message = error?.status === 404
        ? '后端登录接口未加载，请重启后端服务'
        : error?.status === 401
          ? '用户名或密码错误'
          : '登录失败，请检查后端服务'
      setError(message)
      showToast?.(message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      padding: 24,
      background: 'radial-gradient(circle at 20% 20%, rgba(79,142,247,0.16), transparent 28%), var(--bg)',
    }}>
      <form
        onSubmit={handleSubmit}
        style={{
          width: 'min(420px, 100%)',
          background: 'var(--surface)',
          border: '1px solid var(--border2)',
          borderRadius: 12,
          padding: 28,
          boxShadow: '0 24px 80px rgba(0,0,0,0.42)',
          animation: 'fadeUp 0.28s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            display: 'grid',
            placeItems: 'center',
            fontSize: 20,
          }}>
            管
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', fontFamily: 'Syne, sans-serif' }}>
              管理员登录
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 3 }}>
              智慧导游系统管理后台
            </div>
          </div>
        </div>

        <FormField label="用户名">
          <Input
            autoFocus
            autoComplete="username"
            value={form.username}
            onChange={event => setForm(current => ({ ...current, username: event.target.value }))}
            placeholder="请输入管理员用户名"
          />
        </FormField>

        <FormField label="密码">
          <Input
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
            placeholder="请输入管理员密码"
          />
        </FormField>

        {error && (
          <div style={{
            margin: '2px 0 14px',
            padding: '9px 11px',
            borderRadius: 8,
            border: '1px solid rgba(239,68,68,0.24)',
            background: 'rgba(239,68,68,0.08)',
            color: 'var(--red)',
            fontSize: 12,
          }}>
            {error}
          </div>
        )}

        <Button
          disabled={submitting}
          style={{ width: '100%', justifyContent: 'center', minHeight: 40 }}
        >
          {submitting ? <Spinner size={14} /> : null}
          {submitting ? '登录中' : '登录'}
        </Button>
      </form>
    </div>
  )
}
