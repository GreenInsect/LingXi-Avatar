import type {
  ChatApiResponse,
  SendMessageParams,
} from '../types'

const BASE = '/api'

function makeRequestId(prefix: string): string {
  const randomPart = Math.random().toString(16).slice(2, 10)
  return `${prefix}-${Date.now()}-${randomPart}`
}

async function readResponseText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return ''
  }
}

interface StreamCallbacks {
  onSession?: (sessionId: string) => void
  onToken?: (content: string) => void
  onDone?: (data: ChatApiResponse) => void
}

function buildMessagePayload(params: SendMessageParams) {
  return {
    message: params.message,
    session_id: params.sessionId,
    input_type: params.inputType ?? 'text',
    location: params.location ?? null,
    interests: params.interests?.join(',') ?? '',
    with_audio: params.withAudio ?? true,
    image_base64: params.imageBase64 ?? null,
    image_mime_type: params.imageMimeType ?? 'image/jpeg',
    avatar_id: params.avatarId ?? null,
    avatar_name: params.avatarName ?? null,
    avatar_personality: params.avatarPersonality ?? null,
    avatar_voice_id: params.avatarVoiceId ?? null,
  }
}

function parseSseEvent(raw: string): { event: string; data: string } | null {
  let event = 'message'
  const dataLines: string[] = []

  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
  }

  if (dataLines.length === 0) return null
  return { event, data: dataLines.join('\n') }
}

export async function newSession(): Promise<string> {
  const requestId = makeRequestId('new-session')
  const startedAt = performance.now()
  console.info('[api] newSession start', { requestId })

  const res = await fetch(`${BASE}/chat/new-session`, {
    method: 'POST',
    headers: { 'X-Request-ID': requestId },
  })

  if (!res.ok) {
    const body = await readResponseText(res)
    console.error('[api] newSession failed', {
      requestId,
      status: res.status,
      durationMs: Math.round(performance.now() - startedAt),
      body,
      responseRequestId: res.headers.get('x-request-id'),
    })
    throw new Error(`newSession HTTP ${res.status}: ${body || res.statusText}`)
  }

  const data = await res.json()
  console.info('[api] newSession done', {
    requestId,
    sessionId: data.session_id,
    durationMs: Math.round(performance.now() - startedAt),
    responseRequestId: res.headers.get('x-request-id'),
  })
  return data.session_id as string
}

export async function sendMessage(params: SendMessageParams): Promise<ChatApiResponse> {
  const requestId = makeRequestId('chat-message')
  const startedAt = performance.now()
  const payload = buildMessagePayload(params)

  console.info('[api] sendMessage start', {
    requestId,
    sessionId: params.sessionId,
    inputType: payload.input_type,
    withAudio: payload.with_audio,
    hasImage: Boolean(payload.image_base64),
    avatarId: payload.avatar_id,
    avatarName: payload.avatar_name,
    messageChars: payload.message.length,
  })

  const res = await fetch(`${BASE}/chat/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await readResponseText(res)
    console.error('[api] sendMessage http failed', {
      requestId,
      sessionId: params.sessionId,
      status: res.status,
      statusText: res.statusText,
      durationMs: Math.round(performance.now() - startedAt),
      responseRequestId: res.headers.get('x-request-id'),
      body,
    })
    throw new Error(`sendMessage HTTP ${res.status}: ${body || res.statusText}`)
  }

  const data = await res.json() as ChatApiResponse
  console.info('[api] sendMessage done', {
    requestId,
    sessionId: data.session_id,
    intent: data.intent,
    knowledgeUsed: data.knowledge_used,
    replyChars: data.reply?.length ?? 0,
    hasAudio: Boolean(data.audio_base64),
    mouthShapes: data.mouth_shapes?.length ?? 0,
    agentSteps: data.agent_steps,
    durationMs: Math.round(performance.now() - startedAt),
    responseRequestId: res.headers.get('x-request-id'),
  })
  return data
}

export async function sendMessageStream(
  params: SendMessageParams,
  callbacks: StreamCallbacks = {},
): Promise<ChatApiResponse> {
  const requestId = makeRequestId('chat-stream')
  const startedAt = performance.now()
  const payload = buildMessagePayload(params)

  console.info('[api] sendMessageStream start', {
    requestId,
    sessionId: params.sessionId,
    inputType: payload.input_type,
    withAudio: payload.with_audio,
    hasImage: Boolean(payload.image_base64),
    avatarId: payload.avatar_id,
    avatarName: payload.avatar_name,
    messageChars: payload.message.length,
  })

  const res = await fetch(`${BASE}/chat/message/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok || !res.body) {
    const body = await readResponseText(res)
    console.error('[api] sendMessageStream http failed', {
      requestId,
      sessionId: params.sessionId,
      status: res.status,
      statusText: res.statusText,
      durationMs: Math.round(performance.now() - startedAt),
      responseRequestId: res.headers.get('x-request-id'),
      body,
    })
    throw new Error(`sendMessageStream HTTP ${res.status}: ${body || res.statusText}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalData: ChatApiResponse | null = null
  let tokenCount = 0

  const handleRawEvent = (raw: string) => {
    const parsed = parseSseEvent(raw)
    if (!parsed) return

    let data: any
    try {
      data = JSON.parse(parsed.data)
    } catch (error) {
      console.warn('[api] sendMessageStream ignored invalid json event', { requestId, event: parsed.event, error })
      return
    }

    if (parsed.event === 'session' && data.session_id) {
      callbacks.onSession?.(data.session_id)
      return
    }
    if (parsed.event === 'token') {
      const content = String(data.content ?? '')
      tokenCount += 1
      callbacks.onToken?.(content)
      return
    }
    if (parsed.event === 'done') {
      finalData = data as ChatApiResponse
      callbacks.onDone?.(finalData)
      return
    }
    if (parsed.event === 'error') {
      throw new Error(data.message || 'Stream failed')
    }
  }

  while (true) {
    const { value, done } = await reader.read()
    if (value) {
      buffer += decoder.decode(value, { stream: !done })
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''
      for (const eventText of events) {
        if (eventText.trim()) handleRawEvent(eventText)
      }
    }
    if (done) break
  }

  if (buffer.trim()) handleRawEvent(buffer)
  if (!finalData) throw new Error('Stream ended without done event')

  console.info('[api] sendMessageStream done', {
    requestId,
    sessionId: finalData.session_id,
    intent: finalData.intent,
    knowledgeUsed: finalData.knowledge_used,
    replyChars: finalData.reply?.length ?? 0,
    hasAudio: Boolean(finalData.audio_base64),
    mouthShapes: finalData.mouth_shapes?.length ?? 0,
    tokenCount,
    durationMs: Math.round(performance.now() - startedAt),
    responseRequestId: res.headers.get('x-request-id'),
  })

  return finalData
}
