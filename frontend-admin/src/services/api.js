const BASE = '/api'

// ── Analytics ──────────────────────────────────────────────
export async function getDashboard() {
  const res = await fetch(`${BASE}/analytics/dashboard`)
  if (!res.ok) throw new Error('dashboard fetch failed')
  return res.json()
}

export async function getSentimentReport(days = 7) {
  const res = await fetch(`${BASE}/analytics/sentiment-report?days=${days}`)
  if (!res.ok) throw new Error('report fetch failed')
  return res.json()
}

export async function getConversationList(page = 1, pageSize = 15) {
  const res = await fetch(`${BASE}/analytics/conversation-list?page=${page}&page_size=${pageSize}`)
  if (!res.ok) throw new Error('conversation list failed')
  return res.json()
}

// ── Knowledge ──────────────────────────────────────────────
export async function getKnowledgeList() {
  const res = await fetch(`${BASE}/admin/knowledge/list`)
  if (!res.ok) throw new Error('knowledge list failed')
  return res.json()
}

export async function addKnowledge(payload) {
  const res = await fetch(`${BASE}/admin/knowledge/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('add knowledge failed')
  return res.json()
}

export async function uploadKnowledgeFile(file, category = 'general') {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('category', category)
  const res = await fetch(`${BASE}/admin/knowledge/upload`, { method: 'POST', body: fd })
  if (!res.ok) throw new Error('upload failed')
  return res.json()
}

export async function deleteKnowledge(id) {
  const res = await fetch(`${BASE}/admin/knowledge/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('delete failed')
  return res.json()
}

// ── Avatar ─────────────────────────────────────────────────
export async function getAvatarList() {
  const res = await fetch(`${BASE}/admin/avatar/list`)
  if (!res.ok) throw new Error('avatar list failed')
  return res.json()
}

export async function createAvatar(payload) {
  const res = await fetch(`${BASE}/admin/avatar/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('create avatar failed')
  return res.json()
}

export async function updateAvatar(id, payload) {
  const res = await fetch(`${BASE}/admin/avatar/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('update avatar failed')
  return res.json()
}

export async function activateAvatar(id) {
  const res = await fetch(`${BASE}/admin/avatar/${id}/activate`, { method: 'PUT' })
  if (!res.ok) throw new Error('activate failed')
  return res.json()
}

export async function getVoices() {
  const res = await fetch(`${BASE}/admin/voices`)
  if (!res.ok) throw new Error('voices failed')
  return res.json()
}
