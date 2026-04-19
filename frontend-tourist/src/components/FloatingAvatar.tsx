import { useState, useEffect, useRef, useCallback, CSSProperties } from 'react'
import { useChat } from '../hooks/useChat'
import { useSpeechRecognition } from '../hooks/useVoiceRecord'
import type { AvatarEmotion, ChatMessage } from '../types'
import type { AvatarManifest, ExpressionLayer, ParameterOverride } from '../live2d/avatarManifest.ts'
import {
  createAssistantResponse, createSystemPrompt,
} from '../lib/llm.ts';

// ── Emotion config ────────────────────────────────────────────
interface EmotionConfig { emoji: string; label: string; mouth: number }

const EMOTIONS: Record<AvatarEmotion, EmotionConfig> = {
  happy: { emoji: '😊', label: '开心', mouth: 8 },
  enthusiastic: { emoji: '😄', label: '热情', mouth: 11 },
  curious: { emoji: '🤔', label: '好奇', mouth: 2 },
  gentle: { emoji: '😌', label: '温柔', mouth: 6 },
  professional: { emoji: '😎', label: '专业', mouth: 4 },
  surprised: { emoji: '😲', label: '惊喜', mouth: 9 },
}

const QUICK_QUESTIONS = [
  '景区有什么好玩的？', '门票多少钱？', '推荐一条游览路线',
  '九龙灌浴几点表演？', '祥符禅寺历史介绍', '灵山梵宫怎么参观？',
]

// ── SVG Avatar Face ───────────────────────────────────────────
interface AvatarFaceProps { emotion?: AvatarEmotion; size?: number }

function AvatarFace({ emotion = 'happy', size = 52 }: AvatarFaceProps) {
  const cfg = EMOTIONS[emotion] ?? EMOTIONS.happy
  const cy = 96
  const ctrl = cfg.mouth
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" style={{ display: 'block' }}>
      <defs>
        <radialGradient id="sg2" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#f7d0a8" />
          <stop offset="100%" stopColor="#e8a878" />
        </radialGradient>
        <linearGradient id="bg2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4a8c6e" />
          <stop offset="100%" stopColor="#2d6b52" />
        </linearGradient>
      </defs>
      <ellipse cx="80" cy="135" rx="38" ry="34" fill="url(#bg2)" />
      <path d="M55,110 Q80,102 105,110 L108,122 Q80,116 52,122 Z" fill="#c8a96e" opacity="0.6" />
      <rect x="73" y="105" width="14" height="10" rx="5" fill="url(#sg2)" />
      <ellipse cx="80" cy="68" rx="34" ry="36" fill="url(#sg2)" />
      <path d="M46,68 Q48,36 80,32 Q112,36 114,68 Q108,50 80,48 Q52,50 46,68 Z" fill="#1a0f06" />
      <ellipse cx="80" cy="34" rx="11" ry="7" fill="#1a0f06" />
      <circle cx="80" cy="27" r="4.5" fill="#c8a96e" />
      <ellipse cx="64" cy="64" rx="8" ry="6" fill="white" />
      <ellipse cx="96" cy="64" rx="8" ry="6" fill="white" />
      <ellipse cx="65" cy="65" rx="4.5" ry="4.5" fill="#2c1a0a" />
      <ellipse cx="97" cy="65" rx="4.5" ry="4.5" fill="#2c1a0a" />
      <circle cx="66.5" cy="64" r="1.5" fill="white" />
      <circle cx="98.5" cy="64" r="1.5" fill="white" />
      <path d="M55,56 Q62,52 68,54" stroke="#3d2010" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M92,54 Q98,52 105,56" stroke="#3d2010" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M77,76 Q80,80 83,76" stroke="#c0927a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d={`M64,${cy} Q80,${cy + ctrl} 96,${cy}`} stroke="#c0392b" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="52" cy="73" rx="8" ry="4" fill="rgba(255,120,100,0.13)" />
      <ellipse cx="108" cy="73" rx="8" ry="4" fill="rgba(255,120,100,0.13)" />
    </svg>
  )
}

// ── Message Bubble ────────────────────────────────────────────
function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  const time = new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return (
    <div style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', gap: 6, animation: 'fadeUp 0.3s ease' }}>
      <div style={{
        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
        background: isUser
          ? 'linear-gradient(135deg,var(--gold),var(--gold-light))'
          : 'linear-gradient(135deg,var(--jade),var(--jade2))',
      }}>
        {isUser ? '👤' : '🌸'}
      </div>
      <div style={{ maxWidth: '80%' }}>
        <div style={{
          padding: '8px 12px', fontSize: 13, lineHeight: 1.65,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          borderRadius: isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
          background: isUser
            ? 'linear-gradient(135deg,rgba(61,122,94,0.82),rgba(61,122,94,0.65))'
            : 'rgba(255,252,245,0.95)',
          color: isUser ? 'white' : 'var(--ink)',
          border: isUser ? 'none' : '1px solid rgba(201,168,76,0.2)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          {msg.content}
        </div>
        <div style={{ fontSize: 9, color: 'rgba(26,15,10,0.35)', marginTop: 3, textAlign: isUser ? 'right' : 'left', padding: '0 4px' }}>
          {time}
        </div>
      </div>
    </div>
  )
}

function Typing() {
  return (
    <div style={{ display: 'flex', gap: 6, animation: 'fadeIn 0.2s ease' }}>
      <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,var(--jade),var(--jade2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🌸</div>
      <div style={{ padding: '10px 14px', borderRadius: '4px 14px 14px 14px', background: 'rgba(255,252,245,0.95)', border: '1px solid rgba(201,168,76,0.2)', display: 'flex', gap: 4 }}>
        {[0, 0.15, 0.3].map((d, i) => (
          <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--jade)', animation: 'pulse 1.1s ease infinite', animationDelay: `${d}s` }} />
        ))}
      </div>
    </div>
  )
}

// ── Main floating component ───────────────────────────────────
interface FloatingAvatarProps {
  open: boolean; onToggle: () => void;
  selectedAvatar: AvatarManifest;
  onAvatarUpdate: (data: {
    expressionMix: any[],
    parameterOverrides: any[]
  }) => void;
}

interface LingshanResponse {
  reply: string;               // AI 回复的文本
  avatar_emotion: AvatarEmotion; // 对应图片中的 "enthusiastic"
  audio_base64: string;        // 语音数据
  audio_duration: number;      // 语音时长
  intent: string;              // 意图分析，如 "qa"
  session_id: string;
  agent_steps: Array<string>;
  knowledge_used: Boolean;
  timestamp: string;
  visitor_emotion: { emotion: string, sentiment_score: number, intensity: string };
}

export default function FloatingAvatar({ open, onToggle, onAvatarUpdate, selectedAvatar }: FloatingAvatarProps) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [emotion, setEmotion] = useState<AvatarEmotion>('happy')
  const [speaking, setSpeaking] = useState(false)
  const [text, setText] = useState('')
  const [showQuick, setShowQuick] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { messages, loading, send, addMessage } = useChat({ sessionId, setSessionId })

  useEffect(() => {
    if (open && messages.length === 0) {
      setTimeout(() => {
        addMessage('assistant', '您好！我是灵山胜境AI导游小慧 🌸\n\n很高兴为您服务！我可以为您介绍景区历史、推荐游览路线、解答门票咨询等。请问有什么需要帮助的吗？', { emotion: 'happy' })
      }, 400)
    }
  }, [open]) // eslint-disable-line

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setSpeaking(false), 1500)
      return () => clearTimeout(t)
    }
  }, [loading])

  const handleSend = useCallback(async (customText?: string, inputType: 'text' | 'voice' = 'text') => {
    const msg = (customText ?? text).trim()
    if (!msg || loading) return
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setShowQuick(false)
    setSpeaking(true)
    try {
      const res = await send({ text: msg, inputType, location: '灵山胜境景区内' })
      const data = res as LingshanResponse | undefined;
      if (data?.avatar_emotion) setEmotion(data.avatar_emotion)
      // console.log('Avatar update data:', res);
      if (!data) {
        console.error("后端未返回有效数据");
        return;
      }
      const avatarControl = await createAssistantResponse({
        avatar: selectedAvatar,
        history: [{ id: crypto.randomUUID(), role: 'assistant', content: data.reply }],
        systemPrompt: createSystemPrompt(selectedAvatar),
      });
      console.log('Avatar control data: avatarControl == ', avatarControl);
      onAvatarUpdate({
        expressionMix: avatarControl.expressionMix,
        parameterOverrides: avatarControl.parameterOverrides
      });
    } catch { /* silent */ }
  }, [text, loading, send])

  // ── 改进后的 handleSend ───────────────────────────────────────────
  // const handleSend = useCallback(async (customText?: string, inputType: 'text' | 'voice' = 'text') => {
  //   const msg = (customText ?? text).trim();

  //   // 1. 基础拦截
  //   if (!msg || loading) return;

  //   // 2. 清理状态 & UI 反馈
  //   setText('');
  //   if (textareaRef.current) textareaRef.current.style.height = 'auto';
  //   setShowQuick(false);
  //   setSpeaking(true);

  //   // 在此处可以先设置一个“思考”表情（可选）
  //   // setEmotion('curious'); 

  //   try {
  //     // 3. 调用 useChat 钩子中的 send 方法
  //     // 假设 res 的结构符合：{ reply: string, expressionMix: [], parameterOverrides: [], avatar_emotion?: string }
  //     const response = await send({
  //       text: msg,
  //       inputType,
  //       location: '灵山胜境景区内'
  //     });

  //     // 4. 驱动数字人表情与参数 (同步 handleSubmit 的逻辑)
  //     if (response) {
  //       // 如果后端返回了具体的表情标识符 (happy, curious 等)
  //       if (response.avatar_emotion) {
  //         setEmotion(response.avatar_emotion as AvatarEmotion);
  //       }

  //       // 如果你的 Live2D 引擎需要 ExpressionMix 和 ParameterOverrides
  //       // 注意：这里需要确保父组件或全局状态能接收这些值
  //       // 假设这些 set 函数是通过 Props 传进来或在外部定义的
  //       // setActiveExpressionMix(response.expressionMix);
  //       // setActiveParameterOverrides(response.parameterOverrides);
  //     }

  //   } catch (error: any) {
  //     // 5. 错误分类处理 (同步 handleSubmit 的逻辑)
  //     console.error("AI 响应失败:", error);

  //     let errorContent = '网络连接好像开小差了，请稍后再试。';
  //     let errorMeta = 'connection failed';

  //     // 恢复中性表情
  //     setEmotion('gentle');

  //     // 根据不同错误类型定制提示 (假设 error 包含 status 或特定类型)
  //     if (error.name === 'LlmConfigurationError' || error.status === 401) {
  //       errorContent = '导游小慧的秘钥配置似乎有问题，请检查后台设置。';
  //       errorMeta = 'settings required';
  //     } else if (error.status === 404) {
  //       errorContent = '找不到 AI 服务地址，请检查接口配置。';
  //     }

  //     // 将错误消息添加到聊天记录中 (手动调用 addMessage)
  //     addMessage('assistant', errorContent, { meta: errorMeta, emotion: 'gentle' });

  //   } finally {
  //     // 无论成败，最后结束说话动画和加载状态
  //     // loading 状态由 useChat 钩子内部维护
  //     setTimeout(() => setSpeaking(false), 2000); // 延迟一点点关闭，更自然
  //   }
  // }, [text, loading, send, addMessage]);

  const { listening, supported, start, stop } = useSpeechRecognition({
    onResult: (t) => { setText(t); setTimeout(() => handleSend(t, 'voice'), 150) },
    onError: () => { },
  })

  const btnStyle: CSSProperties = {
    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.2s', cursor: 'pointer',
  }

  // ── Collapsed bubble ──────────────────────────────────────────
  if (!open) {
    return (
      <div style={{ position: 'fixed', right: 28, bottom: 28, zIndex: 500, cursor: 'pointer' }} onClick={onToggle}>
        {[1, 2].map(i => (
          <div key={i} style={{
            position: 'absolute', inset: -8 * i, borderRadius: '50%',
            border: '1px solid rgba(201,168,76,0.3)',
            animation: `ripple 2.4s ease-out ${i * 0.6}s infinite`, pointerEvents: 'none',
          }} />
        ))}
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--gold), #a07830)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 28px rgba(201,168,76,0.45), 0 2px 8px rgba(0,0,0,0.15)',
          fontSize: 30, animation: 'float 3.5s ease-in-out infinite', position: 'relative',
          transition: 'transform 0.2s',
        }}
          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.08)'}
          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'}
        >
          🤖
          <div style={{
            position: 'absolute', right: 'calc(100% + 12px)', top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(26,15,10,0.85)', color: 'white',
            padding: '6px 12px', borderRadius: 20, fontSize: 12, whiteSpace: 'nowrap',
            pointerEvents: 'none', backdropFilter: 'blur(8px)',
          }}>
            AI导游小慧
            <div style={{ position: 'absolute', right: -5, top: '50%', transform: 'translateY(-50%)', width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '5px solid rgba(26,15,10,0.85)' }} />
          </div>
        </div>
      </div>
    )
  }

  // ── Expanded panel ────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', right: 20, bottom: 20,
      width: 360, height: 580, zIndex: 500,
      display: 'flex', flexDirection: 'column',
      background: 'rgba(250,245,236,0.97)', backdropFilter: 'blur(20px)',
      borderRadius: 20,
      boxShadow: '0 20px 60px rgba(26,15,10,0.18), 0 4px 16px rgba(26,15,10,0.1)',
      border: '1px solid var(--border)', overflow: 'hidden',
      animation: 'bubblePop 0.32s cubic-bezier(0.34,1.56,0.64,1)',
      transformOrigin: 'bottom right',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', flexShrink: 0,
        background: 'linear-gradient(135deg, rgba(201,168,76,0.12), rgba(61,122,94,0.08))',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%', overflow: 'hidden',
            border: '2px solid rgba(201,168,76,0.35)', background: 'var(--warm)',
            animation: speaking ? 'none' : 'float 4s ease-in-out infinite',
          }}>
            <AvatarFace emotion={emotion} size={44} />
          </div>
          {speaking && (
            <div style={{ position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: '50%', background: 'var(--jade)', border: '2px solid white', animation: 'pulse 0.8s ease infinite' }} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', letterSpacing: 0.5 }}>AI导游小慧</div>
          <div style={{ fontSize: 10, color: 'var(--jade)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--jade)', animation: 'pulse 2s infinite' }} />
            灵山胜境 · 在线服务中
          </div>
        </div>
        <div style={{ fontSize: 18, transition: 'all 0.4s' }}>{EMOTIONS[emotion]?.emoji}</div>
        <button onClick={onToggle} style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'rgba(26,15,10,0.07)', color: 'var(--ink)',
          fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.18s', border: 'none', cursor: 'pointer',
        }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(26,15,10,0.14)'}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(26,15,10,0.07)'}
        >✕</button>
      </div>

      {/* Speaking waveform */}
      {(speaking || loading) && (
        <div style={{ display: 'flex', gap: 3, padding: '6px 16px', justifyContent: 'center', background: 'rgba(61,122,94,0.04)', flexShrink: 0 }}>
          {[6, 12, 18, 14, 8, 20, 12, 7].map((h, i) => (
            <div key={i} style={{ width: 3, height: h, background: 'var(--jade)', borderRadius: 2, animation: `wave 0.7s ease-in-out infinite`, animationDelay: `${i * 0.08}s` }} />
          ))}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map(msg => <Bubble key={msg.id} msg={msg} />)}
        {loading && <Typing />}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick questions */}
      {showQuick && messages.length <= 1 && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0 }}>
          {QUICK_QUESTIONS.map(q => (
            <button key={q} onClick={() => handleSend(q)} style={{
              flexShrink: 0, padding: '5px 11px', borderRadius: 16,
              border: '1px solid var(--border)', background: 'rgba(255,252,245,0.8)',
              fontSize: 11, color: 'var(--ink2)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.18s',
            }}
              onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'var(--gold)'; b.style.color = 'white'; b.style.borderColor = 'var(--gold)' }}
              onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'rgba(255,252,245,0.8)'; b.style.color = 'var(--ink2)'; b.style.borderColor = 'var(--border)' }}
            >{q}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', background: 'rgba(250,245,236,0.95)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <button
            onClick={listening ? stop : start}
            title={supported ? (listening ? '停止录音' : '语音输入') : '浏览器不支持'}
            style={{
              ...btnStyle,
              border: `1px solid ${listening ? 'var(--red)' : 'var(--border)'}`,
              background: listening ? 'rgba(181,52,30,0.08)' : 'rgba(255,252,245,0.8)',
              fontSize: 16,
              animation: listening ? 'recordPulse 1s ease infinite' : 'none',
              opacity: supported ? 1 : 0.5,
            }}
          >
            {listening ? '⏹️' : '🎤'}
          </button>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => {
              setText(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 72)}px`
            }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() } }}
            placeholder={listening ? '正在聆听...' : '向小慧提问...（Enter发送）'}
            rows={1}
            style={{
              flex: 1, padding: '9px 13px',
              border: '1px solid var(--border)', borderRadius: 20,
              background: 'rgba(255,252,245,0.85)',
              fontSize: 13, color: 'var(--ink)', outline: 'none',
              resize: 'none', maxHeight: 72, lineHeight: 1.5,
              transition: 'border-color 0.2s', fontFamily: 'inherit',
            }}
            onFocus={e => (e.target as HTMLTextAreaElement).style.borderColor = 'var(--jade)'}
            onBlur={e => (e.target as HTMLTextAreaElement).style.borderColor = 'var(--border)'}
          />

          <button
            onClick={() => void handleSend()}
            disabled={!text.trim() || loading}
            style={{
              ...btnStyle,
              border: 'none',
              background: (!text.trim() || loading) ? 'rgba(61,122,94,0.35)' : 'linear-gradient(135deg,var(--jade),var(--jade2))',
              color: 'white', fontSize: 16,
              cursor: (!text.trim() || loading) ? 'not-allowed' : 'pointer',
              boxShadow: (!text.trim() || loading) ? 'none' : '0 2px 10px rgba(61,122,94,0.35)',
            }}
          >
            {loading
              ? <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              : '➤'}
          </button>
        </div>
      </div>
    </div>
  )
}
