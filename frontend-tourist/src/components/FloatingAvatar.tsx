import { useState, useEffect, useRef, useCallback, CSSProperties } from 'react'
import { useChat } from '../hooks/useChat'
import { useSpeechRecognition } from '../hooks/useVoiceRecord'
import { useMouthAnimation } from '../hooks/useMouthAnimation'
import { useResponsive } from '../hooks/useResponsive'
import type { AvatarEmotion, ChatMessage, MouthShape } from '../types'
import type { AvatarManifest, ExpressionLayer, ParameterOverride } from '../live2d/avatarManifest.ts'
import {
  getAvatarNeutralExpressionId,
  resolveExpressionByKeyword,
} from '../live2d/avatarManifest.ts';

// ── Emotion config ────────────────────────────────────────────
interface EmotionConfig { emoji: string; label: string }

const EMOTIONS: Record<AvatarEmotion, EmotionConfig> = {
  happy: { emoji: '😊', label: '开心' },
  enthusiastic: { emoji: '😄', label: '热情' },
  curious: { emoji: '🤔', label: '好奇' },
  gentle: { emoji: '😌', label: '温柔' },
  professional: { emoji: '😎', label: '专业' },
  surprised: { emoji: '😲', label: '惊喜' },
}

const QUICK_QUESTIONS = [
  '景区有什么好玩的？', '门票多少钱？', '推荐一条游览路线',
  '九龙灌浴几点表演？', '祥符禅寺历史介绍', '灵山梵宫怎么参观？',
]

function getMessageDisplayContent(msg: ChatMessage, guideName: string) {
  if (msg.role !== 'assistant' || !msg.content.includes('很高兴为您服务！')) {
    return msg.content
  }

  return msg.content
    .replace(/^您好！我是灵山胜境数字导游\s*[^，。\n!?！？]+(?:[，。]\s*)?/, `您好！我是灵山胜境数字导游 ${guideName}。`)
    .replace(/^您好！我是灵山胜境AI导游[^，。\n!?！？]*(?:[，。]\s*)?/, `您好！我是灵山胜境数字导游 ${guideName}。`)
}

// ── Message Bubble ────────────────────────────────────────────
function Bubble({ msg, guideName }: { msg: ChatMessage; guideName: string }) {
  const isUser = msg.role === 'user'
  const content = getMessageDisplayContent(msg, guideName)
  if (!isUser && !content) return null

  const time = new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      animation: 'fadeUp 0.24s ease',
    }}>
      <div style={{ maxWidth: '84%', display: 'grid', gap: 4 }}>
        <div style={{
          padding: '10px 13px',
          fontSize: 13,
          lineHeight: 1.65,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          borderRadius: isUser ? '15px 15px 5px 15px' : '15px 15px 15px 5px',
          background: isUser
            ? 'linear-gradient(135deg, rgba(61,122,94,0.95), rgba(76,143,113,0.86))'
            : 'linear-gradient(180deg, rgba(255,252,245,0.98), rgba(248,240,225,0.96))',
          color: isUser ? 'white' : 'var(--ink)',
          border: isUser ? '1px solid rgba(61,122,94,0.18)' : '1px solid rgba(201,168,76,0.24)',
          boxShadow: isUser
            ? '0 8px 18px rgba(61,122,94,0.18)'
            : '0 8px 20px rgba(91,67,37,0.08)',
        }}>
          {content}
        </div>
        <div style={{
          fontSize: 10,
          color: 'rgba(26,15,10,0.38)',
          textAlign: isUser ? 'right' : 'left',
          padding: '0 3px',
        }}>
          {time}
        </div>
      </div>
    </div>
  )
}

function Typing() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', animation: 'fadeIn 0.2s ease' }}>
      <div style={{
        padding: '11px 14px',
        borderRadius: '15px 15px 15px 5px',
        background: 'rgba(255,252,245,0.96)',
        border: '1px solid rgba(201,168,76,0.22)',
        display: 'flex',
        gap: 5,
        boxShadow: '0 8px 20px rgba(91,67,37,0.07)',
      }}>
        {[0, 0.15, 0.3].map((d, i) => (
          <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--jade)', animation: 'pulse 1.1s ease infinite', animationDelay: `${d}s` }} />
        ))}
      </div>
    </div>
  )
}

// ── 情绪 → Live2D 表情回退映射（当 LLM 不可用时）─────────────
function emotionToExpressionFallback(
  avatar: AvatarManifest,
  emotion: string,
): { expressionMix: ExpressionLayer[]; parameterOverrides: ParameterOverride[] } {
  const keywordMap: Record<string, string[]> = {
    happy:         ['happy', 'smile', 'joy', '开心', '笑', 'cheerful', 'laugh'],
    enthusiastic:  ['happy', 'excited', 'enthusiastic', '热情', 'excited', 'starry_eyes'],
    curious:       ['curious', 'question', 'wonder', '好奇', '疑', 'think'],
    gentle:        ['gentle', 'calm', 'soft', '温柔', 'peaceful', 'mellow'],
    professional:  ['neutral', 'calm', 'serious', '专业', '认真', 'composed'],
    surprised:     ['surprised', 'shock', 'amaze', '惊喜', '惊', 'stun', 'dizzy'],
  };

  const keywords = keywordMap[emotion] || [emotion];
  const neutralId = getAvatarNeutralExpressionId(avatar);

  // 在角色表情目录中按关键词匹配
  for (const keyword of keywords) {
    const expr = avatar.expressions.find(e =>
      e.id !== 'neutral' && e.kind === 'emotion' && (
        e.id.toLowerCase().includes(keyword.toLowerCase()) ||
        (e.label && e.label.includes(keyword)) ||
        e.aliases?.some(a => a.toLowerCase().includes(keyword.toLowerCase()))
      )
    );
    if (expr) {
      return { expressionMix: [{ key: expr.id, weight: 1 }], parameterOverrides: [] };
    }
  }

  // 没有任何匹配 → 回到中性表情
  return { expressionMix: [{ key: neutralId, weight: 1 }], parameterOverrides: [] };
}

function buildAvatarPersonalityPrompt(avatar: AvatarManifest) {
  const traits = avatar.persona?.traits?.join(', ') || 'friendly'
  const rules = avatar.persona?.styleRules?.join(' ') || ''
  return [
    avatar.summary,
    `tone: ${avatar.persona?.tone || 'warm and clear'}`,
    `traits: ${traits}`,
    rules,
  ].filter(Boolean).join('\n')
}

interface FloatingAvatarProps {
  open: boolean; onToggle: () => void;
  selectedAvatar: AvatarManifest;
  selectedAvatarId: string;
  avatarOptions: AvatarManifest[];
  onAvatarChange: (avatarId: string) => void;
  onAvatarUpdate: (data: {
    expressionMix: ExpressionLayer[],
    parameterOverrides: ParameterOverride[]
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

export default function FloatingAvatar({
  open,
  onToggle,
  onAvatarUpdate,
  selectedAvatar,
  selectedAvatarId,
  avatarOptions,
  onAvatarChange,
}: FloatingAvatarProps) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [emotion, setEmotion] = useState<AvatarEmotion>('happy')
  const [speaking, setSpeaking] = useState(false)
  const [text, setText] = useState('')
  const [showQuick, setShowQuick] = useState(true)
  const [voiceError, setVoiceError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const playbackTimerRef = useRef<number | null>(null)

  const { messages, loading, send, addMessage } = useChat({ sessionId, setSessionId })
  const { start: startMouth, stop: stopMouth } = useMouthAnimation();
  const { isMobile } = useResponsive()
  const guideName = selectedAvatar.name?.trim() || selectedAvatar.id

  // 保持当前表情引用，嘴型动画回调中使用
  const currentExpressionRef = useRef<{ expressionMix: ExpressionLayer[] }>({
    expressionMix: [{ key: getAvatarNeutralExpressionId(selectedAvatar), weight: 1 }],
  });

  useEffect(() => {
    if (open && messages.length === 0) {
      const timer = window.setTimeout(() => {
        addMessage('assistant', `您好！我是灵山胜境数字导游 ${guideName}。\n\n很高兴为您服务！我可以介绍景区历史、推荐游览路线、解答门票咨询等。请问有什么需要帮助的吗？`, { emotion: 'happy' })
      }, 400)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [open, messages.length, addMessage, guideName])

  useEffect(() => {
    currentExpressionRef.current = {
      expressionMix: [{ key: getAvatarNeutralExpressionId(selectedAvatar), weight: 1 }],
    }
    setEmotion('happy')
    stopMouth()
  }, [selectedAvatar, stopMouth])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const clearPlaybackTimer = useCallback(() => {
    if (playbackTimerRef.current !== null) {
      window.clearTimeout(playbackTimerRef.current)
      playbackTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      clearPlaybackTimer()
      stopMouth()
    }
  }, [clearPlaybackTimer, stopMouth])

  const handleSend = useCallback(async (customText?: string, inputType: 'text' | 'voice' = 'text') => {
    const msg = (customText ?? text).trim()
    if (!msg || loading) return
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setShowQuick(false)
    setSpeaking(true)
    clearPlaybackTimer()
    try {
      const res = await send({
        text: msg,
        inputType,
        location: '灵山胜境景区内',
        avatarId: selectedAvatar.id,
        avatarName: guideName,
        avatarPersonality: buildAvatarPersonalityPrompt(selectedAvatar),
      })
      const data = res as LingshanResponse | undefined;
      if (data?.avatar_emotion) setEmotion(data.avatar_emotion)
      if (!data) {
        setSpeaking(false)
        return;
      }
      // 从 useChat 返回的 emotions 直接驱动 Live2D 表情
      const resData = res as (LingshanResponse & { emotions: string[]; mouth_shapes: MouthShape[] }) | undefined;
      const emotions = resData?.emotions || [];

      let expressionMix: ExpressionLayer[];
      if (emotions.length > 0) {
        const expressionId = resolveExpressionByKeyword(selectedAvatar, emotions[0]);
        if (expressionId) {
          expressionMix = [{ key: expressionId, weight: 1 }];
        } else {
          expressionMix = emotionToExpressionFallback(selectedAvatar, data.avatar_emotion || 'happy').expressionMix;
        }
      } else {
        expressionMix = emotionToExpressionFallback(selectedAvatar, data.avatar_emotion || 'happy').expressionMix;
      }
      currentExpressionRef.current = { expressionMix };

      // 立即推送表情到 Live2D
      onAvatarUpdate({ expressionMix, parameterOverrides: [] });

      // 嘴型动画：优先用浏览器 audio 真实时长，否则用帧数/30fps 估算
      const mouthShapes = resData?.mouth_shapes || [];
      const audioEl = (res as any)?.audioEl as HTMLAudioElement | undefined;
      const browserAudioDur = (audioEl?.duration && !isNaN(audioEl.duration) && audioEl.duration > 0)
        ? audioEl.duration
        : 0;
      const apiAudioDur = Number(data.audio_duration ?? 0);
      const mouthFrameDur = mouthShapes.length > 0 ? mouthShapes.length / 30 : 0;
      const realDur = browserAudioDur > 0
        ? browserAudioDur
        : (apiAudioDur > 0 ? apiAudioDur : mouthFrameDur);

      console.info('[avatar] playback sync start', {
        sessionId: data.session_id,
        hasAudio: Boolean(audioEl),
        browserAudioDur,
        apiAudioDur,
        mouthShapes: mouthShapes.length,
        mouthFrameDur: Number(mouthFrameDur.toFixed(2)),
        syncDuration: Number(realDur.toFixed(2)),
      });

      if (mouthShapes.length > 0 && realDur > 0) {
        stopMouth();
        startMouth(mouthShapes, realDur, (mouthParams) => {
          onAvatarUpdate({
            expressionMix: currentExpressionRef.current.expressionMix,
            parameterOverrides: [
              { id: 'ParamMouthOpenY', value: mouthParams.mouthOpenY },
              { id: 'ParamMouthForm', value: mouthParams.mouthForm },
            ],
          });
        });
      }

      let playbackClosed = false;
      const closeMouthAndStopSpeaking = () => {
        if (playbackClosed) return;
        playbackClosed = true;
        clearPlaybackTimer();
        stopMouth();
        setSpeaking(false);
        onAvatarUpdate({
          expressionMix: currentExpressionRef.current.expressionMix,
          parameterOverrides: [
            { id: 'ParamMouthOpenY', value: 0.04 },
            { id: 'ParamMouthForm', value: 0 },
          ],
        });
        console.info('[avatar] playback sync done', {
          sessionId: data.session_id,
          endedBy: audioEl ? 'audio-ended-or-timeout' : 'timer',
        });
      };

      if (audioEl) {
        audioEl.addEventListener('ended', closeMouthAndStopSpeaking, { once: true });
      }
      if (realDur > 0) {
        playbackTimerRef.current = window.setTimeout(
          closeMouthAndStopSpeaking,
          Math.ceil((realDur + 0.5) * 1000),
        );
      } else if (!audioEl) {
        playbackTimerRef.current = window.setTimeout(closeMouthAndStopSpeaking, 1500);
      }
    } catch {
      setSpeaking(false)
      /* send failed, already handled in useChat */
    }
  }, [text, loading, send, selectedAvatar, guideName, onAvatarUpdate, startMouth, stopMouth, clearPlaybackTimer])

  const { listening, supported, start, stop } = useSpeechRecognition({
    onResult: (t) => { setText(t); setTimeout(() => handleSend(t, 'voice'), 150) },
    onError: (msg) => { setVoiceError(msg); setTimeout(() => setVoiceError(''), 3000) },
  })

  const btnStyle: CSSProperties = {
    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.2s', cursor: 'pointer',
  }

  // ── 收起时什么都不渲染（由 Live2D 数字人点击打开）───────────
  if (!open) return null;

  // ── Expanded panel ────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed',
      right: isMobile ? 8 : 20,
      bottom: isMobile ? 8 : 20,
      left: isMobile ? 8 : 'auto',
      width: isMobile ? 'auto' : 'min(390px, calc(100vw - 32px))',
      height: isMobile ? 'min(640px, calc(100dvh - 16px))' : 'min(640px, calc(100vh - 40px))',
      zIndex: 500,
      display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(180deg, rgba(255,252,245,0.98), rgba(247,238,222,0.97))',
      backdropFilter: 'blur(22px)',
      borderRadius: isMobile ? 14 : 18,
      boxShadow: '0 24px 70px rgba(26,15,10,0.22), 0 8px 24px rgba(61,122,94,0.10)',
      border: '1px solid rgba(201,168,76,0.28)',
      overflow: 'hidden',
      animation: 'bubblePop 0.32s cubic-bezier(0.34,1.56,0.64,1)',
      transformOrigin: 'bottom right',
    }}>
      {/* Header */}
      <div style={{
        padding: isMobile ? '12px 12px 10px' : '14px 15px 12px',
        flexShrink: 0,
        background: 'linear-gradient(135deg, rgba(61,122,94,0.13), rgba(201,168,76,0.13))',
        borderBottom: '1px solid rgba(201,168,76,0.22)',
        display: 'grid',
        gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: 'rgba(26,15,10,0.52)', letterSpacing: 0.8, fontWeight: 700 }}>
              灵山胜境数字导游
            </div>
            <div style={{
              marginTop: 2,
              fontSize: isMobile ? 18 : 20,
              fontWeight: 800,
              color: 'var(--ink)',
              lineHeight: 1.1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {guideName}
            </div>
          </div>
          <select
            value={selectedAvatarId}
            onChange={event => onAvatarChange(event.target.value)}
            aria-label="选择数字人"
            title="选择数字人"
            style={{
              width: isMobile ? 108 : 122,
              height: 34,
              borderRadius: 10,
              border: '1px solid rgba(61,122,94,0.22)',
              background: 'rgba(255,252,245,0.86)',
              color: 'var(--ink)',
              outline: 'none',
              padding: '0 10px',
              fontSize: isMobile ? 11 : 12,
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(26,15,10,0.06)',
            }}
          >
            {avatarOptions.map(avatar => (
              <option key={avatar.id} value={avatar.id}>{avatar.name || avatar.id}</option>
            ))}
          </select>
          <button onClick={onToggle} title="关闭" style={{
            width: isMobile ? 32 : 34, height: isMobile ? 32 : 34, borderRadius: 10,
            background: 'rgba(26,15,10,0.07)', color: 'var(--ink)',
            fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.18s', border: '1px solid rgba(26,15,10,0.04)', cursor: 'pointer',
          }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(26,15,10,0.13)'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(26,15,10,0.07)'}
          >×</button>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          fontSize: 11,
          color: 'rgba(26,15,10,0.58)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            <span style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: speaking || loading ? 'var(--gold)' : 'var(--jade)',
              boxShadow: speaking || loading ? '0 0 0 5px rgba(201,168,76,0.14)' : '0 0 0 5px rgba(61,122,94,0.12)',
              animation: speaking || loading ? 'pulse 1s ease infinite' : 'none',
              flexShrink: 0,
            }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {speaking ? '语音讲解中' : loading ? '正在整理回答' : '在线服务中'}
            </span>
          </div>
          <div style={{ color: 'rgba(61,122,94,0.82)', fontWeight: 700 }}>
            {EMOTIONS[emotion]?.emoji} {EMOTIONS[emotion]?.label}
          </div>
        </div>
      </div>

      {/* Speaking waveform */}
      {(speaking || loading) && (
        <div style={{
          display: 'flex',
          gap: 3,
          padding: '7px 16px',
          justifyContent: 'center',
          background: 'rgba(61,122,94,0.055)',
          borderBottom: '1px solid rgba(61,122,94,0.08)',
          flexShrink: 0,
        }}>
          {[6, 12, 18, 14, 8, 20, 12, 7].map((h, i) => (
            <div key={i} style={{ width: 3, height: h, background: 'var(--jade)', borderRadius: 2, animation: `wave 0.7s ease-in-out infinite`, animationDelay: `${i * 0.08}s` }} />
          ))}
        </div>
      )}

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: isMobile ? '13px 12px 12px' : '16px 15px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: 'linear-gradient(180deg, rgba(255,252,245,0.44), rgba(244,234,216,0.30))',
      }}>
        {messages.map(msg => <Bubble key={msg.id} msg={msg} guideName={guideName} />)}
        {loading && <Typing />}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick questions */}
      {showQuick && messages.length <= 1 && (
        <div style={{
          padding: isMobile ? '9px 10px 8px' : '10px 12px 8px',
          borderTop: '1px solid rgba(201,168,76,0.18)',
          display: 'flex',
          gap: 7,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          flexShrink: 0,
          background: 'rgba(255,252,245,0.70)',
        }}>
          {QUICK_QUESTIONS.map(q => (
            <button key={q} onClick={() => handleSend(q)} style={{
              flexShrink: 0,
              padding: '7px 11px',
              borderRadius: 10,
              border: '1px solid rgba(201,168,76,0.26)',
              background: 'rgba(255,252,245,0.9)',
              fontSize: 11,
              color: 'var(--ink2)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.18s',
              boxShadow: '0 4px 12px rgba(26,15,10,0.04)',
            }}
              onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'rgba(61,122,94,0.92)'; b.style.color = 'white'; b.style.borderColor = 'rgba(61,122,94,0.92)' }}
              onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'rgba(255,252,245,0.9)'; b.style.color = 'var(--ink2)'; b.style.borderColor = 'rgba(201,168,76,0.26)' }}
            >{q}</button>
          ))}
        </div>
      )}

      {/* Voice error */}
      {voiceError && (
        <div style={{
          padding: '6px 14px', fontSize: 11, color: 'var(--red)',
          background: 'rgba(181,52,30,0.06)', textAlign: 'center',
          animation: 'fadeIn 0.2s ease',
        }}>{voiceError}</div>
      )}

      {/* Input */}
      <div style={{
        padding: isMobile ? '9px 10px 10px' : '11px 13px 13px',
        borderTop: '1px solid rgba(201,168,76,0.22)',
        background: 'linear-gradient(180deg, rgba(255,252,245,0.86), rgba(250,245,236,0.98))',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          gap: 8,
          alignItems: 'flex-end',
          padding: 6,
          borderRadius: 16,
          background: 'rgba(255,252,245,0.94)',
          border: '1px solid rgba(201,168,76,0.22)',
          boxShadow: '0 10px 24px rgba(26,15,10,0.08)',
        }}>
          <button
            onClick={listening ? stop : start}
            title={supported ? (listening ? '停止录音' : '语音输入') : '浏览器不支持'}
            style={{
              ...btnStyle,
              width: 36,
              height: 36,
              border: `1px solid ${listening ? 'rgba(181,52,30,0.28)' : 'rgba(61,122,94,0.18)'}`,
              background: listening ? 'rgba(181,52,30,0.08)' : 'rgba(61,122,94,0.08)',
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
            placeholder={listening ? '正在聆听...' : `向 ${guideName} 提问...`}
            rows={1}
            style={{
              flex: 1,
              padding: '8px 6px 7px',
              border: 'none',
              borderRadius: 10,
              background: 'transparent',
              fontSize: 13, color: 'var(--ink)', outline: 'none',
              resize: 'none', maxHeight: 72, lineHeight: 1.5,
              transition: 'border-color 0.2s', fontFamily: 'inherit',
            }}
          />

          <button
            onClick={() => void handleSend()}
            disabled={!text.trim() || loading}
            style={{
              ...btnStyle,
              width: 36,
              height: 36,
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
