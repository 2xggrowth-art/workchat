import { TaskStatus, ChatMemberRole } from '../types'

// ============================================
// TASK STATUS COLORS
// ============================================

export const TASK_STATUS_COLORS: Record<TaskStatus | 'OVERDUE', string> = {
  [TaskStatus.PENDING]: '#3B82F6',      // Blue
  [TaskStatus.IN_PROGRESS]: '#EAB308',  // Yellow
  [TaskStatus.COMPLETED]: '#22C55E',    // Green
  [TaskStatus.APPROVED]: '#22C55E',     // Green (same as completed)
  [TaskStatus.REOPENED]: '#A855F7',     // Purple
  OVERDUE: '#EF4444',                   // Red
}

export const TASK_STATUS_LABELS: Record<TaskStatus | 'OVERDUE', string> = {
  [TaskStatus.PENDING]: 'Pending',
  [TaskStatus.IN_PROGRESS]: 'In Progress',
  [TaskStatus.COMPLETED]: 'Completed',
  [TaskStatus.APPROVED]: 'Approved',
  [TaskStatus.REOPENED]: 'Reopened',
  OVERDUE: 'Overdue',
}

// ============================================
// ALLOWED STATUS TRANSITIONS
// ============================================

export const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.PENDING]: [TaskStatus.IN_PROGRESS],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.COMPLETED],
  [TaskStatus.COMPLETED]: [TaskStatus.APPROVED, TaskStatus.REOPENED],
  [TaskStatus.APPROVED]: [], // Terminal state
  [TaskStatus.REOPENED]: [TaskStatus.IN_PROGRESS],
}

// ============================================
// GROUP PERMISSIONS (WhatsApp-style)
// ============================================

export type GroupPermission =
  | 'add_members'
  | 'remove_members'
  | 'promote_to_admin'
  | 'demote_admin'
  | 'edit_group_info'
  | 'create_tasks'
  | 'assign_task_owner'
  | 'approve_task'
  | 'reopen_task'
  | 'send_message'
  | 'complete_own_task'
  | 'view_group_summary'

export const GROUP_PERMISSIONS: Record<ChatMemberRole, GroupPermission[]> = {
  [ChatMemberRole.OWNER]: [
    'add_members',
    'remove_members',
    'promote_to_admin',
    'demote_admin',
    'edit_group_info',
    'create_tasks',
    'assign_task_owner',
    'approve_task',
    'reopen_task',
    'send_message',
    'complete_own_task',
    'view_group_summary',
  ],
  [ChatMemberRole.ADMIN]: [
    'add_members',
    'remove_members',
    'edit_group_info',
    'create_tasks',
    'assign_task_owner',
    'approve_task',
    'reopen_task',
    'send_message',
    'complete_own_task',
    'view_group_summary',
  ],
  [ChatMemberRole.MEMBER]: [
    'send_message',
    'complete_own_task',
  ],
}

// ============================================
// APP CONSTANTS
// ============================================

export const APP_NAME = 'WorkChat'

export const MESSAGE_TYPES_WITH_FILE = ['AUDIO', 'IMAGE', 'VIDEO', 'FILE'] as const

export const MAX_FILE_SIZES = {
  IMAGE: 10 * 1024 * 1024,    // 10MB
  VIDEO: 50 * 1024 * 1024,    // 50MB
  AUDIO: 10 * 1024 * 1024,    // 10MB
  FILE: 25 * 1024 * 1024,     // 25MB
}

export const ALLOWED_FILE_TYPES = {
  IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  VIDEO: ['video/mp4', 'video/quicktime', 'video/webm'],
  AUDIO: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'],
  FILE: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
}

export const PAGINATION_DEFAULT_LIMIT = 50

export const JWT_ACCESS_TOKEN_EXPIRY = '15m'
export const JWT_REFRESH_TOKEN_EXPIRY = '7d'

// ============================================
// WHATSAPP-INSPIRED COLORS
// ============================================

export const COLORS = {
  // Brand
  primary: '#25D366',
  primaryDark: '#128C7E',
  teal: '#075E54',

  // Light mode
  light: {
    background: '#FFFFFF',
    surface: '#F0F2F5',
    bubbleSent: '#DCF8C6',
    bubbleReceived: '#FFFFFF',
    text: '#111B21',
    textSecondary: '#667781',
    border: '#E5E7EB',
  },

  // Dark mode
  dark: {
    background: '#111B21',
    surface: '#202C33',
    bubbleSent: '#005C4B',
    bubbleReceived: '#202C33',
    text: '#E9EDEF',
    textSecondary: '#8696A0',
    border: '#233138',
  },

  // Chat
  chatBackground: '#ECE5DD',
  chatBackgroundDark: '#0B141A',

  // Status
  online: '#25D366',
  offline: '#8696A0',
  typing: '#25D366',

  // Read receipts
  tickDefault: '#8696A0',
  tickRead: '#53BDEB',
}
