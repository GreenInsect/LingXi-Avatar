import { useState, useCallback, useRef } from 'react'
import { sendMessage, newSession } from '../services/api'
import type { ChatMessage, AvatarEmotion } from '../types'

interface UseChatParams {
  sessionId: string | null
  setSessionId: (id: string) => void
}

interface SendParams {
  text: string
  inputType?: 'text' | 'voice'
  location?: string | null
  interests?: string[]
}

interface UseChatReturn {
  messages: ChatMessage[]
  loading: boolean
  avatarEmotion: AvatarEmotion
  send: (params: SendParams) => Promise<unknown>
  addMessage: (role: ChatMessage['role'], content: string, extra?: Partial<ChatMessage>) => void
  playAudio: (base64: string) => HTMLAudioElement | undefined
}

export function useChat({ sessionId, setSessionId }: UseChatParams): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [avatarEmotion, setAvatarEmotion] = useState<AvatarEmotion>('happy')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const addMessage = useCallback(
    (role: ChatMessage['role'], content: string, extra: Partial<ChatMessage> = {}) => {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          role,
          content,
          timestamp: new Date().toISOString(),
          ...extra,
        } as ChatMessage,
      ])
    },
    [],
  )

  const playAudio = useCallback((base64: string): HTMLAudioElement | undefined => {
    if (!base64) return undefined
    const src = `data:audio/mp3;base64,${base64}`
    if (audioRef.current) audioRef.current.pause()
    const audio = new Audio(src)
    audioRef.current = audio
    audio.play().catch(() => {})
    return audio
  }, [])

  const send = useCallback(
    async ({ text, inputType = 'text', location, interests }: SendParams) => {
      if (!text.trim() || loading) return

      let sid = sessionId
      if (!sid) {
        sid = await newSession()
        setSessionId(sid)
      }

      addMessage('user', text, { inputType })
      setLoading(true)

      try {
        const data = await sendMessage({
          message: text,
          sessionId: sid,
          inputType,
          location,
          interests,
          withAudio: true,
        })

        addMessage('assistant', data.reply, {
          emotion: data.avatar_emotion,
          knowledgeUsed: data.knowledge_used,
        })
        setAvatarEmotion(data.avatar_emotion ?? 'happy')

        if (data.audio_base64) playAudio(data.audio_base64)

        return data
      } catch {
        addMessage('assistant', '抱歉，遇到了一点问题，请稍后再试～ 😅', { emotion: 'gentle' })
        throw new Error('Send failed')
      } finally {
        setLoading(false)
      }
    },
    [sessionId, loading, addMessage, playAudio, setSessionId],
  )

  return { messages, loading, avatarEmotion, send, addMessage, playAudio }
}
