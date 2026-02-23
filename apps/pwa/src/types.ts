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
  emoji: string | null
  role: UserRole
  isApproved: boolean
  createdAt: string
}

export enum ChatType {
  DIRECT = 'DIRECT',
  GROUP = 'GROUP',
}

export enum ChatMemberRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export interface ChatMember {
  userId: string
  user: User
  role: ChatMemberRole
  joinedAt: string
}

export interface Chat {
  id: string
  type: ChatType
  name: string
  members: ChatMember[]
  lastMessage: Message | null
  unreadCount: number
  createdAt: string
}

export enum MessageType {
  TEXT = 'TEXT',
  AUDIO = 'AUDIO',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  FILE = 'FILE',
}

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
  completedAt: string | null
}

export interface Task {
  id: string
  messageId: string
  title: string
  ownerId: string
  owner: User
  status: TaskStatus
  priority: TaskPriority
  dueDate: string | null
  isRecurring: boolean
  recurringRule: string | null
  approvalRequired: boolean
  tags: string[]
  sopInstructions: string | null
  steps: TaskStep[]
  proofs?: Array<{
    id: string
    type: string
    url: string
    user?: User
    createdAt: string
  }>
  activities?: Array<{
    id: string
    action: string
    user?: User
    details?: any
    createdAt: string
  }>
  createdById: string
  createdBy?: User
  createdAt: string
  completedAt: string | null
  approvedAt: string | null
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
  readBy?: string[]
  editedAt: string | null
  deletedAt: string | null
  deletedForEveryone: boolean
  isStarred?: boolean
  isPinned?: boolean
  createdAt: string
}

export interface TaskActivity {
  id: string
  taskId: string
  userId: string
  user?: User
  action: string
  details: Record<string, unknown> | null
  createdAt: string
}
