import { Server as SocketServer, Socket } from 'socket.io'
import { FastifyInstance } from 'fastify'
import { prisma } from '@workchat/database'

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string
    phone: string
    name: string
  }
}

export function setupSocketHandlers(io: SocketServer, fastify: FastifyInstance) {
  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token ||
                    socket.handshake.headers.authorization?.replace('Bearer ', '')

      if (!token) {
        return next(new Error('Authentication required'))
      }

      // Verify JWT
      const decoded = fastify.jwt.verify<{
        id: string
        phone: string
        name: string
      }>(token)

      socket.user = decoded
      next()
    } catch (error) {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.user!
    console.log(`📱 User connected: ${user.name} (${user.id})`)

    // Emit online status
    socket.broadcast.emit('user_online', { userId: user.id })

    // Join user's personal room for notifications
    socket.join(`user:${user.id}`)

    // Handle joining a chat room
    socket.on('join_chat', async ({ chatId }: { chatId: string }) => {
      // Verify user is a member of the chat
      const membership = await prisma.chatMember.findUnique({
        where: {
          chatId_userId: { chatId, userId: user.id },
        },
      })

      if (membership) {
        socket.join(`chat:${chatId}`)
        console.log(`👤 ${user.name} joined chat:${chatId}`)
      }
    })

    // Handle leaving a chat room
    socket.on('leave_chat', ({ chatId }: { chatId: string }) => {
      socket.leave(`chat:${chatId}`)
      console.log(`👤 ${user.name} left chat:${chatId}`)
    })

    // Handle typing indicator
    socket.on('typing', async ({ chatId, isTyping }: { chatId: string; isTyping: boolean }) => {
      // Verify user is a member of the chat before broadcasting
      const membership = await prisma.chatMember.findUnique({
        where: {
          chatId_userId: { chatId, userId: user.id },
        },
      })

      if (!membership) return

      socket.to(`chat:${chatId}`).emit('user_typing', {
        chatId,
        userId: user.id,
        userName: user.name,
        isTyping,
      })
    })

    // Handle sending a message via socket (alternative to REST)
    socket.on('send_message', async ({
      chatId,
      content,
      type = 'TEXT',
      fileUrl,
      replyToId,
      duration,
    }: {
      chatId: string
      content?: string
      type?: string
      fileUrl?: string
      replyToId?: string
      duration?: number
    }) => {
      try {
        // Verify user is a member
        const membership = await prisma.chatMember.findUnique({
          where: {
            chatId_userId: { chatId, userId: user.id },
          },
        })

        if (!membership) {
          socket.emit('error', { message: 'Not a member of this chat' })
          return
        }

        // Create message
        const message = await prisma.message.create({
          data: {
            chatId,
            senderId: user.id,
            content: content || null,
            type: type as any,
            fileUrl: fileUrl || null,
            replyToId: replyToId || null,
            duration: duration || null,
          },
          include: {
            sender: {
              select: {
                id: true,
                phone: true,
                name: true,
                avatarUrl: true,
                emoji: true,
              },
            },
            replyTo: {
              select: {
                id: true,
                content: true,
                type: true,
                senderId: true,
                sender: { select: { name: true } },
              },
            },
          },
        })

        // Update chat's updatedAt
        await prisma.chat.update({
          where: { id: chatId },
          data: { updatedAt: new Date() },
        })

        // Broadcast to chat room
        io.to(`chat:${chatId}`).emit('new_message', {
          chatId,
          message: {
            id: message.id,
            chatId: message.chatId,
            senderId: message.senderId,
            sender: message.sender,
            content: message.content,
            type: message.type,
            fileUrl: message.fileUrl,
            duration: message.duration,
            replyToId: message.replyToId,
            replyTo: message.replyTo,
            isTask: message.isTask,
            task: null,
            readByCount: 0,
            editedAt: message.editedAt,
            deletedAt: message.deletedAt,
            deletedForEveryone: message.deletedForEveryone,
            isStarred: false,
            isPinned: false,
            createdAt: message.createdAt,
          },
        })
      } catch (error) {
        console.error('Error sending message via socket:', error)
        socket.emit('error', { message: 'Failed to send message' })
      }
    })

    // Handle editing a message
    socket.on('edit_message', async ({
      messageId,
      content,
    }: {
      messageId: string
      content: string
    }) => {
      try {
        const message = await prisma.message.findUnique({
          where: { id: messageId },
        })

        if (!message || message.senderId !== user.id || message.type !== 'TEXT') {
          socket.emit('error', { message: 'Cannot edit this message' })
          return
        }

        const updated = await prisma.message.update({
          where: { id: messageId },
          data: { content, editedAt: new Date() },
          include: {
            sender: {
              select: { id: true, phone: true, name: true, avatarUrl: true, emoji: true },
            },
            replyTo: {
              select: {
                id: true, content: true, type: true, senderId: true,
                sender: { select: { name: true } },
              },
            },
          },
        })

        io.to(`chat:${message.chatId}`).emit('message_edited', {
          chatId: message.chatId,
          message: {
            id: updated.id,
            chatId: updated.chatId,
            senderId: updated.senderId,
            sender: updated.sender,
            content: updated.content,
            type: updated.type,
            fileUrl: updated.fileUrl,
            duration: updated.duration,
            replyToId: updated.replyToId,
            replyTo: updated.replyTo,
            isTask: updated.isTask,
            task: null,
            readByCount: 0,
            editedAt: updated.editedAt,
            deletedAt: updated.deletedAt,
            deletedForEveryone: updated.deletedForEveryone,
            createdAt: updated.createdAt,
          },
        })
      } catch (error) {
        console.error('Error editing message via socket:', error)
        socket.emit('error', { message: 'Failed to edit message' })
      }
    })

    // Handle deleting a message for me
    socket.on('delete_message_for_me', async ({
      messageId,
      chatId,
    }: {
      messageId: string
      chatId: string
    }) => {
      try {
        const message = await prisma.message.findUnique({
          where: { id: messageId },
        })

        if (!message || message.chatId !== chatId) {
          socket.emit('error', { message: 'Message not found' })
          return
        }

        // Verify chat membership
        const membership = await prisma.chatMember.findUnique({
          where: { chatId_userId: { chatId, userId: user.id } },
        })
        if (!membership) {
          socket.emit('error', { message: 'Not a member of this chat' })
          return
        }

        if (message.isTask) {
          socket.emit('error', { message: 'Task messages cannot be deleted' })
          return
        }

        await prisma.messageDeletedFor.upsert({
          where: { messageId_userId: { messageId, userId: user.id } },
          create: { messageId, userId: user.id },
          update: {},
        })

        // Only notify the sender's socket
        socket.emit('message_deleted_for_me', { chatId, messageId })
      } catch (error) {
        console.error('Error deleting message for me via socket:', error)
        socket.emit('error', { message: 'Failed to delete message' })
      }
    })

    // Handle deleting a message for everyone
    socket.on('delete_message_for_everyone', async ({
      messageId,
      chatId,
    }: {
      messageId: string
      chatId: string
    }) => {
      try {
        const message = await prisma.message.findUnique({
          where: { id: messageId },
        })

        if (!message || message.chatId !== chatId) {
          socket.emit('error', { message: 'Message not found' })
          return
        }

        if (message.senderId !== user.id) {
          socket.emit('error', { message: 'You can only delete your own messages for everyone' })
          return
        }

        if (message.isTask) {
          socket.emit('error', { message: 'Task messages cannot be deleted' })
          return
        }

        if (message.deletedForEveryone) {
          socket.emit('error', { message: 'Message is already deleted' })
          return
        }

        const ONE_HOUR_MS = 60 * 60 * 1000
        if (Date.now() - new Date(message.createdAt).getTime() > ONE_HOUR_MS) {
          socket.emit('error', { message: 'Can only delete messages within 1 hour' })
          return
        }

        const deletedAt = new Date()
        await prisma.message.update({
          where: { id: messageId },
          data: { deletedAt, deletedForEveryone: true, content: null, fileUrl: null },
        })

        // Broadcast to all chat members
        io.to(`chat:${chatId}`).emit('message_deleted_for_everyone', {
          chatId,
          messageId,
          deletedAt: deletedAt.toISOString(),
        })
      } catch (error) {
        console.error('Error deleting message for everyone via socket:', error)
        socket.emit('error', { message: 'Failed to delete message' })
      }
    })

    // Handle starring/unstarring a message (per-user)
    socket.on('star_message', async ({
      messageId,
      chatId,
    }: {
      messageId: string
      chatId: string
    }) => {
      try {
        const message = await prisma.message.findUnique({
          where: { id: messageId },
        })

        if (!message || message.chatId !== chatId) {
          socket.emit('error', { message: 'Message not found' })
          return
        }

        const membership = await prisma.chatMember.findUnique({
          where: { chatId_userId: { chatId, userId: user.id } },
        })
        if (!membership) {
          socket.emit('error', { message: 'Not a member of this chat' })
          return
        }

        // Toggle star
        const existing = await prisma.messageStarred.findUnique({
          where: { messageId_userId: { messageId, userId: user.id } },
        })

        if (existing) {
          await prisma.messageStarred.delete({ where: { id: existing.id } })
          socket.emit('message_unstarred', { chatId, messageId })
        } else {
          await prisma.messageStarred.create({
            data: { messageId, userId: user.id },
          })
          socket.emit('message_starred', { chatId, messageId })
        }
      } catch (error) {
        console.error('Error starring message via socket:', error)
        socket.emit('error', { message: 'Failed to star message' })
      }
    })

    // Handle pinning/unpinning a message (chat-level, broadcast to all)
    socket.on('pin_message', async ({
      messageId,
      chatId,
    }: {
      messageId: string
      chatId: string
    }) => {
      try {
        const message = await prisma.message.findUnique({
          where: { id: messageId },
          include: { chat: true },
        })

        if (!message || message.chatId !== chatId) {
          socket.emit('error', { message: 'Message not found' })
          return
        }

        const membership = await prisma.chatMember.findUnique({
          where: { chatId_userId: { chatId, userId: user.id } },
        })
        if (!membership) {
          socket.emit('error', { message: 'Not a member of this chat' })
          return
        }

        // In GROUP chats, only ADMIN/OWNER can pin
        if (message.chat.type === 'GROUP' && membership.role === 'MEMBER') {
          socket.emit('error', { message: 'Only admins can pin messages in group chats' })
          return
        }

        if (message.deletedForEveryone) {
          socket.emit('error', { message: 'Cannot pin a deleted message' })
          return
        }

        // Toggle pin
        const existing = await prisma.messagePinned.findUnique({
          where: { messageId },
        })

        if (existing) {
          await prisma.messagePinned.delete({ where: { id: existing.id } })
          io.to(`chat:${chatId}`).emit('message_unpinned', { chatId, messageId })
        } else {
          await prisma.messagePinned.create({
            data: { messageId, chatId, pinnedBy: user.id },
          })
          io.to(`chat:${chatId}`).emit('message_pinned', { chatId, messageId })
        }
      } catch (error) {
        console.error('Error pinning message via socket:', error)
        socket.emit('error', { message: 'Failed to pin message' })
      }
    })

    // Handle marking message as read (single message)
    socket.on('mark_read', async ({
      chatId,
      messageId,
    }: {
      chatId: string
      messageId: string
    }) => {
      try {
        // Persist the read receipt to database
        await prisma.messageRead.upsert({
          where: {
            messageId_userId: { messageId, userId: user.id },
          },
          create: {
            messageId,
            userId: user.id,
          },
          update: {},
        })

        // Broadcast read receipt to chat
        socket.to(`chat:${chatId}`).emit('message_read', {
          chatId,
          messageId,
          userId: user.id,
          readAt: new Date().toISOString(),
        })
      } catch (error) {
        console.error('Error marking message as read:', error)
      }
    })

    // Handle marking all messages in a chat as read
    socket.on('mark_chat_read', async ({ chatId }: { chatId: string }) => {
      try {
        // Get all unread messages in this chat (not sent by current user)
        const unreadMessages = await prisma.message.findMany({
          where: {
            chatId,
            senderId: { not: user.id },
            readBy: {
              none: { userId: user.id },
            },
          },
          select: { id: true },
        })

        if (unreadMessages.length > 0) {
          // Create read receipts for all unread messages
          await prisma.messageRead.createMany({
            data: unreadMessages.map((m) => ({
              messageId: m.id,
              userId: user.id,
            })),
            skipDuplicates: true,
          })

          // Emit event to update other users (and chat list unread count)
          const readUpToMessageId = unreadMessages[unreadMessages.length - 1]?.id
          socket.to(`chat:${chatId}`).emit('messages_read', {
            chatId,
            userId: user.id,
            readUpToMessageId,
            count: unreadMessages.length,
            readAt: new Date().toISOString(),
          })

          // Emit to self to update unread count in chat list
          socket.emit('unread_updated', {
            chatId,
            unreadCount: 0,
          })
        }
      } catch (error) {
        console.error('Error marking chat as read:', error)
      }
    })

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`📱 User disconnected: ${user.name} (${user.id})`)
      socket.broadcast.emit('user_offline', { userId: user.id })
    })
  })

  console.log('🔌 Socket.io handlers initialized')
}
