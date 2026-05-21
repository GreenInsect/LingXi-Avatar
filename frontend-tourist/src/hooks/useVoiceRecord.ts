import { useState, useRef, useCallback } from 'react'

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SpeechRecognitionClass = ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) as
    | (new () => any)
    | undefined
  const supported = Boolean(SpeechRecognitionClass)
  const recRef = useRef<any>(null)
  const [listening, setListening] = useState(false)

  const start = useCallback(() => {
    if (!supported || !SpeechRecognitionClass) {
      onError?.('浏览器不支持语音识别，建议使用 Chrome')
      return
    }
    try {
      if (recRef.current) {
        try { recRef.current.stop() } catch { /* ignore */ }
        recRef.current = null
      }
      const rec = new SpeechRecognitionClass()
      rec.lang = 'zh-CN'
      rec.continuous = false
      rec.interimResults = false
      rec.onresult = (e: any) => {
        if (e.results?.length && e.results[0]?.length) {
          const text = e.results[0][0].transcript
          onResult?.(text)
        }
      }
      rec.onerror = (e: any) => {
        if (e.error === 'not-allowed') {
          onError?.('麦克风权限被拒绝，请在浏览器设置中允许访问麦克风')
        } else if (e.error !== 'no-speech') {
          onError?.('语音识别失败，请重试')
        }
      }
      rec.onend = () => setListening(false)
      recRef.current = rec
      rec.start()
      setListening(true)
    } catch (e: any) {
      console.error('语音识别启动失败:', e)
      onError?.(e?.message || '语音识别启动失败，请重试')
    }
  }, [supported, SpeechRecognitionClass, onResult, onError])

  const stop = useCallback(() => {
    try { recRef.current?.stop() } catch { /* ignore */ }
    recRef.current = null
    setListening(false)
  }, [])

  return { listening, supported, start, stop }
}
