import { io, Socket } from 'socket.io-client'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import { api } from './api'

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000'

class SocketService {
  private socket: Socket | null = null
  private listeners: Map<string, Set<(data: any) => void>> = new Map()
  private pendingChatJoins: Set<string> = new Set()
  private isConnecting: boolean = false

  async connect() {
    if (this.socket?.connected) {
      if (__DEV__) console.log('[Socket] Already connected')
      return
    }

    if (this.isConnecting) {
      if (__DEV__) console.log('[Socket] Connection already in progress')
      return
    }

    const token = await AsyncStorage.getItem('workchat-token')
    if (!token) {
      if (__DEV__) console.log('[Socket] No token, skipping connection')
      return
    }

    this.isConnecting = true
    if (__DEV__) console.log('[Socket] Connecting to:', API_URL)

    this.socket = io(API_URL, {
      auth: { token },
      transports: ['polling', 'websocket'], // Start with polling, upgrade to websocket
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
      forceNew: true,
    })

    this.socket.on('connect', async () => {
      if (__DEV__) console.log('[Socket] Connected:', this.socket?.id)
      this.isConnecting = false

      // Join ALL user's chats so we receive notifications for all of them
      try {
        const response = await api.get('/api/chats')
        const chats = response.data.data || []
        if (__DEV__) console.log('[Socket] Joining all user chats:', chats.length)
        chats.forEach((chat: { id: string }) => {
          this.socket?.emit('join_chat', { chatId: chat.id })
        })
      } catch (error) {
        if (__DEV__) console.log('[Socket] Failed to fetch chats for auto-join:', error)
      }

      // Also join any pending chat rooms (for the currently open chat)
      this.pendingChatJoins.forEach((chatId) => {
        if (__DEV__) console.log('[Socket] Auto-joining pending chat:', chatId)
        this.socket?.emit('join_chat', { chatId })
      })
    })

    this.socket.on('disconnect', (reason) => {
      if (__DEV__) console.log('[Socket] Disconnected:', reason)
    })

    this.socket.on('connect_error', (error) => {
      if (__DEV__) console.log('[Socket] Connection error:', error.message)
      this.isConnecting = false
    })

    // Set up event forwarding
    this.socket.on('new_message', (data) => {
      if (__DEV__) console.log('[Socket] New message received:', data.message?.id)
      this.emit('new_message', data)
    })

    this.socket.on('message_converted_to_task', (data) => {
      if (__DEV__) console.log('[Socket] Message converted to task:', data.messageId)
      this.emit('message_converted_to_task', data)
    })

    this.socket.on('chat_created', (data) => {
      if (__DEV__) console.log('[Socket] Chat created:', data.chat?.id)
      this.emit('chat_created', data)
    })

    this.socket.on('task_status_changed', (data) => {
      if (__DEV__) console.log('[Socket] Task status changed:', data.taskId)
      this.emit('task_status_changed', data)
    })

    this.socket.on('user_typing', (data) => {
      this.emit('user_typing', data)
    })

    this.socket.on('user_online', (data) => {
      this.emit('user_online', data)
    })

    this.socket.on('user_offline', (data) => {
      this.emit('user_offline', data)
    })
  }

  disconnect() {
    if (this.socket) {
      if (__DEV__) console.log('[Socket] Disconnecting')
      this.socket.disconnect()
      this.socket = null
    }
  }

  joinChat(chatId: string) {
    // Add to pending joins in case socket isn't connected yet
    this.pendingChatJoins.add(chatId)

    if (this.socket?.connected) {
      if (__DEV__) console.log('[Socket] Joining chat:', chatId)
      this.socket.emit('join_chat', { chatId })
    } else {
      if (__DEV__) console.log('[Socket] Not connected, queued join for chat:', chatId)
      // Try to connect if not already
      this.connect()
    }
  }

  leaveChat(chatId: string) {
    this.pendingChatJoins.delete(chatId)

    if (this.socket?.connected) {
      if (__DEV__) console.log('[Socket] Leaving chat:', chatId)
      this.socket.emit('leave_chat', { chatId })
    }
  }

  sendTyping(chatId: string, isTyping: boolean) {
    if (this.socket?.connected) {
      this.socket.emit('typing', { chatId, isTyping })
    }
  }

  // Event subscription system
  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback)
    }
  }

  off(event: string, callback: (data: any) => void) {
    this.listeners.get(event)?.delete(callback)
  }

  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        callback(data)
      } catch (error) {
        console.error('[Socket] Error in listener:', error)
      }
    })
  }

  isConnected() {
    return this.socket?.connected || false
  }
}

export const socketService = new SocketService()
