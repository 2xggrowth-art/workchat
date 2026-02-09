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
    const response = await api.post('/api/chats', {
      type: 'DIRECT',
      name: '',
      memberIds: [userId],
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
}))
