export type LangCode = 'zh' | 'en' | 'ja'
export type UserRole = 'admin' | 'leader' | 'member'
export type UserStatus = 'active' | 'frozen_temp' | 'frozen_perm'
export type RoomStatus = 'active' | 'closed'
export type MsgType = 'text' | 'image' | 'voice_transcript' | 'system'
export type CallStatus = 'active' | 'ended'
export type GlossaryScope = 'global' | 'room'

export interface User {
  id: number; username: string; nickname: string; avatar_url: string | null
  department: string | null; lang_pref: LangCode; role: UserRole
  status: UserStatus; must_change_pw: boolean
  created_at: string; updated_at: string; password_hash: string
}
export interface Room {
  id: number; name: string; description: string | null; creator_id: number
  invite_code: string; status: RoomStatus; created_at: string; closed_at: string | null
}
export interface RoomMember {
  id: number; room_id: number; user_id: number; role: 'leader' | 'member'
  joined_at: string; nickname?: string; avatar_url?: string | null
}
export interface Message {
  id: number; room_id: number; sender_id: number; msg_type: MsgType
  content: string; original_lang: string | null; call_session_id: number | null
  created_at: string; sender_nickname?: string; sender_avatar?: string | null
}
export interface CallSession {
  id: number; room_id: number; started_by: number; started_at: string
  ended_at: string | null; status: CallStatus; participant_count: number
}
export interface Glossary {
  id: number; scope: GlossaryScope; room_id: number | null
  term_zh: string | null; term_en: string | null; term_ja: string | null
  note: string | null; created_by: number; created_at: string; updated_at: string
}
export interface ApiResponse<T = unknown> {
  success: boolean; data?: T
  error?: { code: string; message_i18n: Record<string, string> }; request_id?: string
}
