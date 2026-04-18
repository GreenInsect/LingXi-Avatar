const BASE = '/api'

export async function newSession() {
  const res = await fetch(`${BASE}/chat/new-session`, { method: 'POST' })
  const data = await res.json()
  return data.session_id
}

export async function sendMessage({ message, sessionId, inputType = 'text', location, interests, withAudio = true }) {
  const res = await fetch(`${BASE}/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      session_id: sessionId,
      input_type: inputType,
      location,
      interests: interests?.join(',') || '',
      with_audio: withAudio,
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function getChatHistory(sessionId) {
  const res = await fetch(`${BASE}/chat/history/${sessionId}`)
  return res.json()
}

export async function getActiveAvatar() {
  const res = await fetch(`${BASE}/admin/avatar/list`)
  const data = await res.json()
  return data.avatars?.find(a => a.is_active) || data.avatars?.[0] || null
}
