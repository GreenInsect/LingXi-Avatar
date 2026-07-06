import { useState, useCallback, useEffect, useRef } from 'react'
import { sendMessageStream, newSession } from '../services/api'
import type { ChatMessage, AvatarEmotion, ChatApiResponse } from '../types'
import { parseEmotionTags } from '../live2d/avatarManifest.ts'

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

function estimateSpeechDurationSeconds(data: ChatApiResponse, text: string): number {
  const audioDuration = Number(data.audio_duration ?? 0)
  if (Number.isFinite(audioDuration) && audioDuration > 0.2) return audioDuration

  const mouthFrameDuration = (data.mouth_shapes?.length ?? 0) / 30
  if (mouthFrameDuration > 0.2) return mouthFrameDuration

  return Math.max(1.2, Math.min(18, text.length / 5.8))
}

export function useChat({ sessionId, setSessionId }: UseChatParams): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [avatarEmotion, setAvatarEmotion] = useState<AvatarEmotion>('happy')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const revealRafRef = useRef<number | null>(null)

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

  const updateMessage = useCallback((id: number, patch: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(message => (
      message.id === id ? { ...message, ...patch } : message
    )))
  }, [])

  const stopTextReveal = useCallback(() => {
    if (revealRafRef.current !== null) {
      cancelAnimationFrame(revealRafRef.current)
      revealRafRef.current = null
    }
  }, [])

  const revealMessageText = useCallback((id: number, fullText: string, durationSeconds: number) => {
    stopTextReveal()

    const textToReveal = fullText || ''
    if (!textToReveal) {
      updateMessage(id, { content: '' })
      return
    }

    const durationMs = Math.max(650, Math.min(45000, durationSeconds * 1000))
    const startedAt = performance.now()
    let lastChars = -1

    console.info('[chat] text reveal start', {
      messageId: id,
      textChars: textToReveal.length,
      durationMs: Math.round(durationMs),
    })

    updateMessage(id, { content: '' })

    const tick = () => {
      const elapsed = performance.now() - startedAt
      const progress = Math.min(1, elapsed / durationMs)
      const nextChars = progress >= 1
        ? textToReveal.length
        : Math.max(1, Math.floor(textToReveal.length * progress))

      if (nextChars !== lastChars) {
        lastChars = nextChars
        updateMessage(id, { content: textToReveal.slice(0, nextChars) })
      }

      if (progress < 1) {
        revealRafRef.current = requestAnimationFrame(tick)
      } else {
        revealRafRef.current = null
        console.info('[chat] text reveal done', {
          messageId: id,
          textChars: textToReveal.length,
          durationMs: Math.round(performance.now() - startedAt),
        })
      }
    }

    revealRafRef.current = requestAnimationFrame(tick)
  }, [stopTextReveal, updateMessage])

  const playAudio = useCallback((base64: string): HTMLAudioElement | undefined => {
    if (!base64) return undefined
    const src = `data:audio/mp3;base64,${base64}`
    if (audioRef.current) audioRef.current.pause()
    const audio = new Audio(src)
    audioRef.current = audio
    audio.play().catch(error => {
      console.warn('[chat] audio play failed', { error })
    })
    return audio
  }, [])

  useEffect(() => {
    return () => {
      stopTextReveal()
      if (audioRef.current) audioRef.current.pause()
    }
  }, [stopTextReveal])

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

      const startedAt = performance.now()
      console.info('[chat] send start', {
        sessionId: sid,
        inputType,
        textChars: text.length,
        location,
        interests,
      })

      let assistantMessageId: number | null = null
      try {
        assistantMessageId = Date.now() + Math.random()
        addMessage('assistant', '', {
          id: assistantMessageId,
          emotion: 'gentle',
        })

        let streamedReply = ''
        let tokenCount = 0
        const data = await sendMessageStream({
          message: text,
          sessionId: sid,
          inputType,
          location,
          interests,
          withAudio: true,
        }, {
          onToken: token => {
            streamedReply += token
            tokenCount += 1
            if (tokenCount === 1 || tokenCount % 20 === 0) {
              console.info('[chat] stream token buffered', {
                sessionId: sid,
                tokenCount,
                bufferedChars: streamedReply.length,
              })
            }
          },
        })

        // 清洗 [emotion] 标签，提取情绪关键词
        const { cleanText, emotions } = parseEmotionTags(data.reply || streamedReply)
        const revealDuration = estimateSpeechDurationSeconds(data, cleanText)

        updateMessage(assistantMessageId, {
          content: '',
          emotion: data.avatar_emotion,
          knowledgeUsed: data.knowledge_used,
        })
        setAvatarEmotion(data.avatar_emotion ?? 'happy')

        const audioEl = data.audio_base64 ? playAudio(data.audio_base64) : undefined
        revealMessageText(assistantMessageId, cleanText, revealDuration)

        console.info('[chat] send done', {
          sessionId: data.session_id,
          intent: data.intent,
          emotion: data.avatar_emotion,
          knowledgeUsed: data.knowledge_used,
          hasAudio: Boolean(data.audio_base64),
          audioDurationSeconds: data.audio_duration ?? null,
          revealDurationSeconds: Number(revealDuration.toFixed(2)),
          mouthShapes: data.mouth_shapes?.length ?? 0,
          tokenCount,
          durationMs: Math.round(performance.now() - startedAt),
        })

        return { ...data, reply: cleanText, emotions, audioEl }
      } catch (error) {
        console.error('[chat] send failed', {
          sessionId: sid,
          durationMs: Math.round(performance.now() - startedAt),
          error,
        })
        if (assistantMessageId) {
          updateMessage(assistantMessageId, {
            content: '抱歉，遇到了一点问题，请稍后再试～ 😅',
            emotion: 'gentle',
          })
        } else {
          addMessage('assistant', '抱歉，遇到了一点问题，请稍后再试～ 😅', { emotion: 'gentle' })
        }
        throw error instanceof Error ? error : new Error('Send failed')
      } finally {
        setLoading(false)
      }
    },
    [sessionId, loading, addMessage, updateMessage, playAudio, revealMessageText, setSessionId],
  )

  return { messages, loading, avatarEmotion, send, addMessage, playAudio }
}
