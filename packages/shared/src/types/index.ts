// ============================================
// USER TYPES
// ============================================

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
}

export interface User {
  id: string
  phone: string
  name: string
  avatarUrl: string | null
  role: UserRole
  isApproved: boolean
  createdAt: Date
}

// ============================================
// CHAT MEMBER ROLES (WhatsApp-style)
// ============================================

export enum ChatMemberRole {
  OWNER = 'OWNER',   // Group creator - full control
  ADMIN = 'ADMIN',   // Promoted by owner - can manage members
  MEMBER = 'MEMBER', // Regular member
}

// ============================================
// CHAT TYPES
// ============================================

export enum ChatType {
  DIRECT = 'DIRECT',
  GROUP = 'GROUP',
}

export interface ChatMember {
  userId: string
  user: User
  role: ChatMemberRole
  joinedAt: Date
}

export interface Chat {
  id: string
  type: ChatType
  name: string
  members: ChatMember[]
  lastMessage: Message | null
  unreadCount: number
  createdAt: Date
}

export interface ChatWithoutMembers {
  id: string
  type: ChatType
  name: string
  createdBy: string
  createdAt: Date
}

// ============================================
// MESSAGE TYPES
// ============================================

export enum MessageType {
  TEXT = 'TEXT',
  AUDIO = 'AUDIO',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  FILE = 'FILE',
}

export interface Message {
  id: string
  chatId: string
  senderId: string
  sender: User
  content: string | null
  type: MessageType
  fileUrl: string | null
  replyToId: string | null
  replyTo: Message | null
  isTask: boolean
  task: Task | null
  createdAt: Date
}

export interface MessageWithoutRelations {
  id: string
  chatId: string
  senderId: string
  content: string | null
  type: MessageType
  fileUrl: string | null
  replyToId: string | null
  isTask: boolean
  createdAt: Date
}

// ============================================
// TASK TYPES
// ============================================

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  APPROVED = 'APPROVED',
  REOPENED = 'REOPENED',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export interface TaskStep {
  id: string
  taskId: string
  order: number
  content: string
  isMandatory: boolean
  proofRequired: boolean
  completedAt: Date | null
}

export interface TaskProof {
  id: string
  taskId: string
  stepId: string | null
  userId: string
  user?: User
  type: MessageType
  url: string
  createdAt: Date
}

export interface Task {
  id: string
  messageId: string
  title: string
  ownerId: string
  owner: User
  status: TaskStatus
  priority: TaskPriority
  dueDate: Date | null
  isRecurring: boolean
  recurringRule: string | null
  approvalRequired: boolean
  steps: TaskStep[]
  proofs: TaskProof[]
  createdById: string
  createdBy?: User
  createdAt: Date
  completedAt: Date | null
  approvedAt: Date | null
}

export interface TaskWithoutRelations {
  id: string
  messageId: string
  title: string
  ownerId: string
  status: TaskStatus
  priority: TaskPriority
  dueDate: Date | null
  isRecurring: boolean
  recurringRule: string | null
  approvalRequired: boolean
  createdById: string
  createdAt: Date
  completedAt: Date | null
  approvedAt: Date | null
}

// ============================================
// TASK ACTIVITY TYPES
// ============================================

export enum TaskActivityAction {
  CREATED = 'CREATED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  STEP_COMPLETED = 'STEP_COMPLETED',
  PROOF_UPLOADED = 'PROOF_UPLOADED',
  APPROVED = 'APPROVED',
  REOPENED = 'REOPENED',
}

export interface TaskActivity {
  id: string
  taskId: string
  userId: string
  user?: User
  action: TaskActivityAction
  details: Record<string, unknown> | null
  createdAt: Date
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

// PIN Authentication
export interface RegisterRequest {
  phone: string
  name: string
  pin: string
}

export interface LoginRequest {
  phone: string
  pin: string
}

export interface AuthResponse {
  user: User
  accessToken: string
  refreshToken: string
}

export interface CreateChatRequest {
  type: ChatType
  name: string
  memberIds: string[]
}

export interface SendMessageRequest {
  content?: string
  type: MessageType
  fileUrl?: string
  replyToId?: string
}

export interface ConvertToTaskRequest {
  title?: string
  ownerId: string
  dueDate?: string
  priority?: TaskPriority
  steps?: Array<{
    content: string
    isMandatory?: boolean
    proofRequired?: boolean
  }>
  approvalRequired?: boolean
  isRecurring?: boolean
  recurringRule?: string
}

export interface UpdateTaskStatusRequest {
  status: TaskStatus
}

export interface UploadProofRequest {
  stepId?: string
  type: MessageType
  url: string
}

// Group Management
export interface AddMembersRequest {
  userIds: string[]
}

export interface PromoteMemberRequest {
  userId: string
}

export interface UpdateGroupRequest {
  name?: string
  avatarUrl?: string
}

// ============================================
// PAGINATION TYPES
// ============================================

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    cursor: string | null
    hasMore: boolean
    total?: number
  }
}

export interface PaginationParams {
  cursor?: string
  limit?: number
}

// ============================================
// SOCKET EVENT TYPES
// ============================================

export interface SocketEvents {
  // Client to server
  join_chat: { chatId: string }
  leave_chat: { chatId: string }
  send_message: { chatId: string; message: SendMessageRequest }
  typing: { chatId: string; isTyping: boolean }
  mark_read: { chatId: string; messageId: string }

  // Server to client
  new_message: { chatId: string; message: Message }
  message_converted_to_task: { chatId: string; message: Message }
  task_status_changed: { chatId: string; task: Task }
  user_typing: { chatId: string; userId: string; isTyping: boolean }
  user_online: { userId: string }
  user_offline: { userId: string }
  member_added: { chatId: string; member: ChatMember }
  member_removed: { chatId: string; userId: string }
  member_role_changed: { chatId: string; userId: string; newRole: ChatMemberRole }
}
