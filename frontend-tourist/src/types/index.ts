// ── Chat ──────────────────────────────────────────────────────
export type AvatarEmotion =
  | 'happy' | 'enthusiastic' | 'curious'
  | 'gentle' | 'professional' | 'surprised'

export type MessageRole = 'user' | 'assistant'

export interface ChatMessage {
  id: number
  role: MessageRole
  content: string
  timestamp: string
  emotion?: AvatarEmotion
  knowledgeUsed?: boolean
  inputType?: 'text' | 'voice'
}

export interface VisitorEmotion {
  emotion: string
  sentiment_score: number
  intensity: 'low' | 'medium' | 'high'
}

export interface ChatApiResponse {
  session_id: string
  reply: string
  avatar_emotion: AvatarEmotion
  audio_base64?: string
  audio_duration?: number
  visitor_emotion: VisitorEmotion
  knowledge_used: boolean
  intent: string
  agent_steps: string[]
  timestamp: string
}

export interface SendMessageParams {
  message: string
  sessionId: string
  inputType?: 'text' | 'voice'
  location?: string | null
  interests?: string[]
  withAudio?: boolean
  imageBase64?: string | null
  imageMimeType?: string
}

// ── Data models ───────────────────────────────────────────────
export type PageId =
  | 'home' | 'spots' | 'routes'
  | 'nianhewan' | 'info' | 'history'

export type SpotCategory =
  | 'landmark' | 'performance' | 'temple'
  | 'culture' | 'worship' | 'nature'

export interface Spot {
  id: string
  name: string
  tag: string
  tagColor: string
  icon: string
  brief: string
  desc: string
  highlights: string[]
  openTime: string
  category: SpotCategory
}

export interface Route {
  id: string
  name: string
  icon: string
  duration: string
  difficulty: string
  color: string
  gradient: string
  desc: string
  steps: string[]
  tips: string[]
}

export interface Ticket {
  type: string
  price: string
  desc: string
  icon: string
}

export interface Tip {
  icon: string
  title: string
  content: string
}

export interface DiningItem {
  name: string
  price: string
  desc: string
  icon: string
}

export interface HistoryEvent {
  year: string
  event: string
  icon: string
}

export interface NianheWanSpot {
  id: string
  name: string
  icon: string
  brief: string
  desc: string
  openTime: string
}

export interface AvatarConfig {
  name: string
  personality: string
  voice_id?: string
}
