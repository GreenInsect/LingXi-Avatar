import { useState, useRef, useCallback } from 'react'

export function useVoiceRecord({ onResult }) {
  const [recording, setRecording] = useState(false)
  const mediaRef = useRef(null)
  const chunksRef = useRef([])

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const mr = new MediaRecorder(stream)
      mediaRef.current = mr

      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        // Browser Speech Recognition preferred; fallback to placeholder
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
          // handled separately
        } else {
          onResult?.('（语音已录制，请配置ASR服务后使用语音识别功能）')
        }
      }

      mr.start()
      setRecording(true)
    } catch {
      alert('麦克风权限被拒绝，请在浏览器设置中允许访问麦克风')
    }
  }, [onResult])

  const stop = useCallback(() => {
    mediaRef.current?.stop()
    setRecording(false)
  }, [])

  const toggle = useCallback(() => {
    recording ? stop() : start()
  }, [recording, start, stop])

  return { recording, toggle }
}

// Web Speech Recognition (Chrome/Edge only)
export function useSpeechRecognition({ onResult, onError }) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  const supported = !!SpeechRecognition
  const recRef = useRef(null)
  const [listening, setListening] = useState(false)

  const start = useCallback(() => {
    if (!supported) { onError?.('浏览器不支持语音识别，建议使用 Chrome'); return }
    const rec = new SpeechRecognition()
    rec.lang = 'zh-CN'
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = e => {
      const text = e.results[0][0].transcript
      onResult?.(text)
    }
    rec.onerror = () => onError?.('语音识别失败，请重试')
    rec.onend = () => setListening(false)
    recRef.current = rec
    rec.start()
    setListening(true)
  }, [supported, onResult, onError])

  const stop = useCallback(() => {
    recRef.current?.stop()
    setListening(false)
  }, [])

  return { listening, supported, start, stop }
}
