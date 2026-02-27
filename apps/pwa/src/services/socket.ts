import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null
const activeRooms = new Set<string>()

export function initSocket(token: string): Socket {
  if (socket) {
    // Update auth token for future reconnections
    socket.auth = { token }
    if (socket.connected) return socket
    // Socket exists but disconnected — reconnect with new token
    socket.connect()
    return socket
  }

  const wsUrl = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000'

  socket = io(wsUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  })

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket?.id)
    // Rejoin all active rooms after reconnect
    activeRooms.forEach((chatId) => {
      socket?.emit('join_chat', { chatId })
    })
  })

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason)
    // If server forced disconnect, trigger reconnect
    if (reason === 'io server disconnect') {
      socket?.connect()
    }
  })

  socket.on('connect_error', (err) => {
    console.log('[Socket] Connection error:', err.message)
    // If auth error, try refreshing the token
    if (err.message === 'Invalid token' || err.message === 'Authentication required') {
      // Import dynamically to avoid circular dependency
      import('../stores/authStore').then(({ useAuthStore }) => {
        const { refreshToken } = useAuthStore.getState()
        if (refreshToken) {
          useAuthStore.getState().refreshAccessToken()
            .then(() => {
              const newToken = useAuthStore.getState().token
              if (newToken && socket) {
                socket.auth = { token: newToken }
              }
            })
            .catch(() => {
              // Token refresh failed — user will need to re-login
            })
        }
      })
    }
  })

  return socket
}

export function getSocket(): Socket | null {
  return socket
}

export function disconnectSocket(): void {
  if (socket) {
    activeRooms.clear()
    socket.disconnect()
    socket = null
  }
}

export function joinChat(chatId: string): void {
  activeRooms.add(chatId)
  socket?.connected && socket.emit('join_chat', { chatId })
}

export function leaveChat(chatId: string): void {
  activeRooms.delete(chatId)
  socket?.connected && socket.emit('leave_chat', { chatId })
}

export function emitTyping(chatId: string): void {
  socket?.connected && socket.emit('typing', { chatId })
}
