const BASE = import.meta.env.VITE_ADMIN_API_BASE || '/api'
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_ADMIN_API_TIMEOUT_MS || 120000)

function makeRequestId(prefix = 'admin-api') {
  const randomPart = Math.random().toString(16).slice(2, 10)
  return `${prefix}-${Date.now()}-${randomPart}`
}

async function readResponseText(res) {
  try {
    return await res.text()
  } catch {
    return ''
  }
}

function describeBody(body) {
  if (!body) return { bodyType: 'empty' }
  if (body instanceof FormData) {
    return {
      bodyType: 'form-data',
      fields: Array.from(body.keys()),
    }
  }
  if (typeof body === 'string') {
    return {
      bodyType: 'string',
      bodyChars: body.length,
    }
  }
  return { bodyType: typeof body }
}

async function request(path, options = {}) {
  const requestId = makeRequestId()
  const startedAt = performance.now()
  const method = options.method || 'GET'
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  const headers = {
    'X-Request-ID': requestId,
    ...(options.headers || {}),
  }

  console.info('[admin-api] request start', {
    requestId,
    method,
    path,
    base: BASE,
    timeoutMs: REQUEST_TIMEOUT_MS,
    ...describeBody(options.body),
  })

  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      method,
      headers,
      signal: controller.signal,
    })

    const responseRequestId = res.headers.get('x-request-id')
    const bodyText = await readResponseText(res)
    const durationMs = Math.round(performance.now() - startedAt)

    if (!res.ok) {
      console.error('[admin-api] request failed', {
        requestId,
        responseRequestId,
        method,
        path,
        status: res.status,
        statusText: res.statusText,
        durationMs,
        body: bodyText,
      })
      throw new Error(`${method} ${path} HTTP ${res.status}: ${bodyText || res.statusText}`)
    }

    console.info('[admin-api] request done', {
      requestId,
      responseRequestId,
      method,
      path,
      status: res.status,
      durationMs,
      bodyChars: bodyText.length,
    })

    if (!bodyText) return null

    try {
      return JSON.parse(bodyText)
    } catch (error) {
      console.error('[admin-api] invalid json response', {
        requestId,
        method,
        path,
        durationMs,
        body: bodyText,
        error,
      })
      throw new Error(`${method} ${path} returned invalid JSON`)
    }
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt)
    if (error?.name === 'AbortError') {
      console.error('[admin-api] request timeout', {
        requestId,
        method,
        path,
        timeoutMs: REQUEST_TIMEOUT_MS,
        durationMs,
      })
      throw new Error(`${method} ${path} timeout after ${REQUEST_TIMEOUT_MS}ms`)
    }

    console.error('[admin-api] request error', {
      requestId,
      method,
      path,
      durationMs,
      error,
    })
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

function jsonOptions(method, payload) {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }
}

// ── Analytics ──────────────────────────────────────────────
export function getDashboard() {
  return request('/analytics/dashboard')
}

export function getSentimentReport(days = 7) {
  return request(`/analytics/sentiment-report?days=${encodeURIComponent(days)}`)
}

export function getConversationList(page = 1, pageSize = 15) {
  return request(`/analytics/conversation-list?page=${encodeURIComponent(page)}&page_size=${encodeURIComponent(pageSize)}`)
}

// ── Knowledge ──────────────────────────────────────────────
export function getKnowledgeList() {
  return request('/admin/knowledge/list')
}

export function addKnowledge(payload) {
  return request('/admin/knowledge/add', jsonOptions('POST', payload))
}

export function uploadKnowledgeFile(file, category = 'general') {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('category', category)
  return request('/admin/knowledge/upload', { method: 'POST', body: fd })
}

export function deleteKnowledge(id) {
  return request(`/admin/knowledge/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// ── Avatar ─────────────────────────────────────────────────
export function getAvatarList() {
  return request('/admin/avatar/list')
}

export function createAvatar(payload) {
  return request('/admin/avatar/create', jsonOptions('POST', payload))
}

export function updateAvatar(id, payload) {
  return request(`/admin/avatar/${encodeURIComponent(id)}`, jsonOptions('PUT', payload))
}

export function activateAvatar(id) {
  return request(`/admin/avatar/${encodeURIComponent(id)}/activate`, { method: 'PUT' })
}

export function getVoices() {
  return request('/admin/voices')
}
