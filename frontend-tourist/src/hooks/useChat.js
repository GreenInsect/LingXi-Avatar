import { useState, useCallback, useRef } from 'react'
import { sendMessage, newSession } from '../services/api'

export function useChat(sessionId, setSessionId) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [avatarEmotion, setAvatarEmotion] = useState('happy')
  const audioRef = useRef(null)

  const addMessage = useCallback((role, content, extra = {}) => {
    setMessages(prev => [...prev, {
      id: Date.now() + Math.random(),
      role, content,
      timestamp: new Date().toISOString(),
      ...extra,
    }])
  }, [])

  const playAudio = useCallback((base64) => {
    if (!base64) return
    const src = `data:audio/mp3;base64,${base64}`
    if (audioRef.current) {
      audioRef.current.pause()
    }
    const audio = new Audio(src)
    audioRef.current = audio
    audio.play().catch(() => {})
    return audio
  }, [])

  const send = useCallback(async ({
    text,
    inputType = 'text',
    location,
    interests,
  }) => {
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
      setAvatarEmotion(data.avatar_emotion || 'happy')

      if (data.audio_base64) {
        playAudio(data.audio_base64)
      }

      return data
    } catch (err) {
      addMessage('assistant', '抱歉，遇到了一点问题，请稍后再试～ 😅', { emotion: 'gentle' })
      throw err
    } finally {
      setLoading(false)
    }
  }, [sessionId, loading, addMessage, playAudio, setSessionId])

  return { messages, loading, avatarEmotion, send, addMessage, playAudio }
}
