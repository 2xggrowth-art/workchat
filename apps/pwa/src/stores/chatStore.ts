import { create } from 'zustand'
import { Chat, Message } from '../types'
import { api } from '../services/api'

interface ChatState {
  chats: Chat[]
  currentChat: Chat | null
  messages: Record<string, Message[]>
  loading: boolean
  fetchChats: () => Promise<void>
  setCurrentChat: (chat: Chat | null) => void
  fetchMessages: (chatId: string) => Promise<void>
  addMessage: (chatId: string, message: Message) => void
  updateMessage: (chatId: string, message: Message) => void
  createDirectChat: (userId: string) => Promise<Chat>
  createGroupChat: (name: string, memberIds: string[]) => Promise<Chat>
  editMessage: (messageId: string, chatId: string, content: string) => Promise<void>
  deleteMessageForMe: (messageId: string, chatId: string) => Promise<void>
  deleteMessageForEveryone: (messageId: string, chatId: string) => Promise<void>
  removeMessage: (chatId: string, messageId: string) => void
  markMessageDeletedForEveryone: (chatId: string, messageId: string) => void
  starMessage: (messageId: string, chatId: string) => Promise<void>
  toggleMessageStar: (chatId: string, messageId: string, starred: boolean) => void
  pinMessage: (messageId: string, chatId: string) => Promise<void>
  toggleMessagePin: (chatId: string, messageId: string, pinned: boolean) => void
}

export const useChatStore = create<ChatState>()((set, get) => ({
  chats: [],
  currentChat: null,
  messages: {},
  loading: false,

  fetchChats: async () => {
    set({ loading: true })
    try {
      const response = await api.get('/api/chats')
      set({ chats: response.data.data, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  setCurrentChat: (chat) => set({ currentChat: chat }),

  fetchMessages: async (chatId: string) => {
    try {
      const response = await api.get(`/api/chats/${chatId}/messages`)
      const msgs = (response.data.data || []).reverse()
      set((state) => ({
        messages: { ...state.messages, [chatId]: msgs },
      }))
    } catch {
      // ignore
    }
  },

  addMessage: (chatId, message) => {
    set((state) => {
      const existing = state.messages[chatId] || []
      if (existing.find((m) => m.id === message.id)) return state
      return {
        messages: { ...state.messages, [chatId]: [...existing, message] },
      }
    })
  },

  updateMessage: (chatId, message) => {
    set((state) => {
      const existing = state.messages[chatId] || []
      return {
        messages: {
          ...state.messages,
          [chatId]: existing.map((m) => (m.id === message.id ? message : m)),
        },
      }
    })
  },

  createDirectChat: async (userId: string) => {
    const response = await api.post('/api/users/start-chat', {
      userId,
    })
    const chat = response.data.data
    set((state) => ({ chats: [chat, ...state.chats] }))
    return chat
  },

  createGroupChat: async (name: string, memberIds: string[]) => {
    const response = await api.post('/api/chats', {
      type: 'GROUP',
      name,
      memberIds,
    })
    const chat = response.data.data
    set((state) => ({ chats: [chat, ...state.chats] }))
    return chat
  },

  editMessage: async (messageId: string, chatId: string, content: string) => {
    const response = await api.patch(`/api/messages/${messageId}`, { content })
    const updatedMsg = response.data.data
    get().updateMessage(chatId, updatedMsg)
  },

  deleteMessageForMe: async (messageId: string, chatId: string) => {
    await api.post(`/api/messages/${messageId}/delete`, { mode: 'for_me' })
    get().removeMessage(chatId, messageId)
  },

  deleteMessageForEveryone: async (messageId: string, chatId: string) => {
    await api.post(`/api/messages/${messageId}/delete`, { mode: 'for_everyone' })
    get().markMessageDeletedForEveryone(chatId, messageId)
  },

  removeMessage: (chatId: string, messageId: string) => {
    set((state) => {
      const existing = state.messages[chatId] || []
      return {
        messages: {
          ...state.messages,
          [chatId]: existing.filter((m) => m.id !== messageId),
        },
      }
    })
  },

  markMessageDeletedForEveryone: (chatId: string, messageId: string) => {
    set((state) => {
      const existing = state.messages[chatId] || []
      return {
        messages: {
          ...state.messages,
          [chatId]: existing.map((m) =>
            m.id === messageId
              ? { ...m, content: null, fileUrl: null, deletedForEveryone: true, deletedAt: new Date().toISOString() }
              : m
          ),
        },
      }
    })
  },

  starMessage: async (messageId: string, chatId: string) => {
    const response = await api.post(`/api/messages/${messageId}/star`)
    const { starred } = response.data.data
    get().toggleMessageStar(chatId, messageId, starred)
  },

  toggleMessageStar: (chatId: string, messageId: string, starred: boolean) => {
    set((state) => {
      const existing = state.messages[chatId] || []
      return {
        messages: {
          ...state.messages,
          [chatId]: existing.map((m) =>
            m.id === messageId ? { ...m, isStarred: starred } : m
          ),
        },
      }
    })
  },

  pinMessage: async (messageId: string, chatId: string) => {
    const response = await api.post(`/api/messages/${messageId}/pin`)
    const { pinned } = response.data.data
    get().toggleMessagePin(chatId, messageId, pinned)
  },

  toggleMessagePin: (chatId: string, messageId: string, pinned: boolean) => {
    set((state) => {
      const existing = state.messages[chatId] || []
      return {
        messages: {
          ...state.messages,
          [chatId]: existing.map((m) =>
            m.id === messageId ? { ...m, isPinned: pinned } : m
          ),
        },
      }
    })
  },
}))
