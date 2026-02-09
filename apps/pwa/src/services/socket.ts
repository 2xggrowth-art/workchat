import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function initSocket(token: string): Socket {
  if (socket?.connected) return socket

  const wsUrl = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000'

  socket = io(wsUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  })

  socket.on('connect', () => console.log('[Socket] Connected:', socket?.id))
  socket.on('disconnect', (reason) => console.log('[Socket] Disconnected:', reason))

  return socket
}

export function getSocket(): Socket | null {
  return socket
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export function joinChat(chatId: string): void {
  socket?.connected && socket.emit('join_chat', { chatId })
}

export function leaveChat(chatId: string): void {
  socket?.connected && socket.emit('leave_chat', { chatId })
}

export function emitTyping(chatId: string): void {
  socket?.connected && socket.emit('typing', { chatId })
}
