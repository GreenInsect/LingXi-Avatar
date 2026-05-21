import type {
  ChatApiResponse,
  SendMessageParams,
} from '../types'

const BASE = '/api'

export async function newSession(): Promise<string> {
  const res = await fetch(`${BASE}/chat/new-session`, { method: 'POST' })
  const data = await res.json()
  return data.session_id as string
}

export async function sendMessage(params: SendMessageParams): Promise<ChatApiResponse> {
  const res = await fetch(`${BASE}/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: params.message,
      session_id: params.sessionId,
      input_type: params.inputType ?? 'text',
      location: params.location ?? null,
      interests: params.interests?.join(',') ?? '',
      with_audio: params.withAudio ?? true,
      image_base64: params.imageBase64 ?? null,
      image_mime_type: params.imageMimeType ?? 'image/jpeg',
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<ChatApiResponse>
}
