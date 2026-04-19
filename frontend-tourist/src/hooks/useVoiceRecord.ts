import { useState, useRef, useCallback } from 'react'

// Augment Window for webkit Speech API
declare global {
  interface Window {
    webkitSpeechRecognition?: typeof SpeechRecognition
  }
}

// ── useVoiceRecord ────────────────────────────────────────────
interface UseVoiceRecordParams {
  onResult?: (text: string) => void
}

interface UseVoiceRecordReturn {
  recording: boolean
  toggle: () => void
}

export function useVoiceRecord({ onResult }: UseVoiceRecordParams): UseVoiceRecordReturn {
  const [recording, setRecording] = useState(false)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const mr = new MediaRecorder(stream)
      mediaRef.current = mr

      mr.ondataavailable = (e: BlobEvent) => chunksRef.current.push(e.data)
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
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

// ── useSpeechRecognition ──────────────────────────────────────
interface UseSpeechRecognitionParams {
  onResult?: (text: string) => void
  onError?: (msg: string) => void
}

interface UseSpeechRecognitionReturn {
  listening: boolean
  supported: boolean
  start: () => void
  stop: () => void
}

export function useSpeechRecognition({
  onResult,
  onError,
}: UseSpeechRecognitionParams): UseSpeechRecognitionReturn {
  const SpeechRecognitionClass =
    (window.SpeechRecognition ?? window.webkitSpeechRecognition) as
      | typeof SpeechRecognition
      | undefined
  const supported = Boolean(SpeechRecognitionClass)
  const recRef = useRef<SpeechRecognition | null>(null)
  const [listening, setListening] = useState(false)

  const start = useCallback(() => {
    if (!supported || !SpeechRecognitionClass) {
      onError?.('浏览器不支持语音识别，建议使用 Chrome')
      return
    }
    const rec = new SpeechRecognitionClass()
    rec.lang = 'zh-CN'
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[0][0].transcript
      onResult?.(text)
    }
    rec.onerror = () => onError?.('语音识别失败，请重试')
    rec.onend = () => setListening(false)
    recRef.current = rec
    rec.start()
    setListening(true)
  }, [supported, SpeechRecognitionClass, onResult, onError])

  const stop = useCallback(() => {
    recRef.current?.stop()
    setListening(false)
  }, [])

  return { listening, supported, start, stop }
}
