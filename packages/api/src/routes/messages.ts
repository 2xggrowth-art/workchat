import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@workchat/database'
import { MessageType, TaskPriority, ChatMemberRole } from '@workchat/shared'
import { authenticate, getChatMemberRole } from '../middleware/auth'
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../middleware/errorHandler'

// Validation schemas
const chatIdParamsSchema = z.object({
  id: z.string(),
})

const messageIdParamsSchema = z.object({
  id: z.string(),
})

const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
})

const sendMessageSchema = z.object({
  content: z.string().max(5000).optional(),
  type: z.nativeEnum(MessageType).default(MessageType.TEXT),
  fileUrl: z.string().url().optional(),
  replyToId: z.string().optional(),
  duration: z.number().int().positive().optional(),
}).refine(
  (data) => data.content || data.fileUrl,
  { message: 'Either content or fileUrl is required' }
)

const searchMessagesSchema = z.object({
  q: z.string().min(1).max(200),
})

const editMessageSchema = z.object({
  content: z.string().min(1).max(5000),
})

const convertToTaskSchema = z.object({
  title: z.string().max(200).optional(),
  ownerId: z.string(),
  dueDate: z.string().datetime().optional(),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  steps: z.array(z.object({
    content: z.string(),
    isMandatory: z.boolean().default(true),
    proofRequired: z.boolean().default(false),
  })).optional(),
  approvalRequired: z.boolean().default(true),
  isRecurring: z.boolean().default(false),
  recurringRule: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  sopInstructions: z.string().optional(),
})

export const messageRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/chats/:id/messages - Get messages for a chat (paginated)
   */
  fastify.get('/chats/:id/messages', {
    preHandler: [authenticate],
  }, async (request) => {
    const { id: chatId } = chatIdParamsSchema.parse(request.params)
    const { cursor, limit } = paginationSchema.parse(request.query)
    const userId = request.user.id

    // Check if user is a member
    const membership = await prisma.chatMember.findUnique({
      where: {
        chatId_userId: { chatId, userId },
      },
    })

    if (!membership) {
      throw new ForbiddenError('You are not a member of this chat')
    }

    // Build query
    const messages = await prisma.message.findMany({
      where: {
        chatId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
        deletedFor: { none: { userId } },
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
            deletedForEveryone: true,
            sender: {
              select: { name: true },
            },
          },
        },
        task: {
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
            steps: {
              orderBy: { order: 'asc' },
            },
          },
        },
        _count: {
          select: { readBy: true },
        },
        starredBy: {
          where: { userId },
          select: { id: true },
        },
        pinnedIn: {
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // Take one extra to check for more
    })

    const hasMore = messages.length > limit
    const data = hasMore ? messages.slice(0, -1) : messages

    return {
      success: true,
      data: data.map((msg) => ({
        id: msg.id,
        chatId: msg.chatId,
        senderId: msg.senderId,
        sender: msg.sender,
        content: msg.deletedForEveryone ? null : msg.content,
        type: msg.type,
        fileUrl: msg.deletedForEveryone ? null : msg.fileUrl,
        duration: msg.duration,
        replyToId: msg.replyToId,
        replyTo: msg.replyTo,
        isTask: msg.isTask,
        task: msg.task,
        readByCount: msg._count.readBy,
        editedAt: msg.editedAt,
        deletedAt: msg.deletedAt,
        deletedForEveryone: msg.deletedForEveryone,
        isStarred: msg.starredBy.length > 0,
        isPinned: !!msg.pinnedIn,
        createdAt: msg.createdAt,
      })),
      meta: {
        cursor: data.length > 0 ? data[data.length - 1]!.createdAt.toISOString() : null,
        hasMore,
      },
    }
  })

  /**
   * POST /api/chats/:id/messages - Send a message to a chat
   */
  fastify.post('/chats/:id/messages', {
    preHandler: [authenticate],
  }, async (request) => {
    const { id: chatId } = chatIdParamsSchema.parse(request.params)
    const body = sendMessageSchema.parse(request.body)
    const userId = request.user.id

    // Check if user is a member
    const membership = await prisma.chatMember.findUnique({
      where: {
        chatId_userId: { chatId, userId },
      },
    })

    if (!membership) {
      throw new ForbiddenError('You are not a member of this chat')
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        chatId,
        senderId: userId,
        content: body.content || null,
        type: body.type,
        fileUrl: body.fileUrl || null,
        replyToId: body.replyToId || null,
        duration: body.duration || null,
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
            sender: {
              select: { name: true },
            },
          },
        },
      },
    })

    // Update chat's updatedAt
    await prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    })

    // Emit socket event
    fastify.io.to(`chat:${chatId}`).emit('new_message', {
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

    return {
      success: true,
      data: {
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
    }
  })

  /**
   * GET /api/chats/:id/messages/search?q=keyword - Search messages in a chat
   */
  fastify.get('/chats/:id/messages/search', {
    preHandler: [authenticate],
  }, async (request) => {
    const { id: chatId } = chatIdParamsSchema.parse(request.params)
    const { q } = searchMessagesSchema.parse(request.query)
    const userId = request.user.id

    // Check if user is a member
    const membership = await prisma.chatMember.findUnique({
      where: {
        chatId_userId: { chatId, userId },
      },
    })

    if (!membership) {
      throw new ForbiddenError('You are not a member of this chat')
    }

    const messages = await prisma.message.findMany({
      where: {
        chatId,
        content: { contains: q, mode: 'insensitive' },
        deletedForEveryone: false,
        deletedFor: { none: { userId } },
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
            deletedForEveryone: true,
            sender: {
              select: { name: true },
            },
          },
        },
        task: {
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
            steps: {
              orderBy: { order: 'asc' },
            },
          },
        },
        _count: {
          select: { readBy: true },
        },
        starredBy: {
          where: { userId },
          select: { id: true },
        },
        pinnedIn: {
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return {
      success: true,
      data: messages.map((msg) => ({
        id: msg.id,
        chatId: msg.chatId,
        senderId: msg.senderId,
        sender: msg.sender,
        content: msg.content,
        type: msg.type,
        fileUrl: msg.fileUrl,
        duration: msg.duration,
        replyToId: msg.replyToId,
        replyTo: msg.replyTo,
        isTask: msg.isTask,
        task: msg.task,
        readByCount: msg._count.readBy,
        editedAt: msg.editedAt,
        deletedAt: msg.deletedAt,
        deletedForEveryone: msg.deletedForEveryone,
        isStarred: msg.starredBy.length > 0,
        isPinned: !!msg.pinnedIn,
        createdAt: msg.createdAt,
      })),
    }
  })

  /**
   * PATCH /api/messages/:id - Edit a sent message (sender only, TEXT messages only)
   */
  fastify.patch('/messages/:id', {
    preHandler: [authenticate],
  }, async (request) => {
    const { id: messageId } = messageIdParamsSchema.parse(request.params)
    const { content } = editMessageSchema.parse(request.body)
    const userId = request.user.id

    const message = await prisma.message.findUnique({
      where: { id: messageId },
    })

    if (!message) {
      throw new NotFoundError('Message')
    }

    if (message.senderId !== userId) {
      throw new ForbiddenError('You can only edit your own messages')
    }

    if (message.type !== 'TEXT') {
      throw new ForbiddenError('Only text messages can be edited')
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        content,
        editedAt: new Date(),
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
            deletedForEveryone: true,
            sender: { select: { name: true } },
          },
        },
      },
    })

    // Broadcast edit to all users in the chat
    fastify.io.to(`chat:${message.chatId}`).emit('message_edited', {
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

    return {
      success: true,
      data: {
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
    }
  })

  /**
   * POST /api/messages/:id/convert-to-task - Convert a message to a task (Group Admin only)
   * Only OWNER or ADMIN of the chat can create tasks
   */
  fastify.post('/messages/:id/convert-to-task', {
    preHandler: [authenticate],
  }, async (request) => {
    const { id: messageId } = messageIdParamsSchema.parse(request.params)
    const body = convertToTaskSchema.parse(request.body)
    const userId = request.user.id

    // Get message
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        chat: {
          include: {
            members: true,
          },
        },
      },
    })

    if (!message) {
      throw new NotFoundError('Message')
    }

    // Check if user has app-level ADMIN or SUPER_ADMIN role
    const currentUser = await prisma.user.findUnique({ where: { id: userId } })
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN')) {
      throw new ForbiddenError('Only admins can convert messages to tasks')
    }

    // Also verify user is a member of this chat
    const memberRole = await getChatMemberRole(userId, message.chatId)
    if (!memberRole) {
      throw new ForbiddenError('You are not a member of this chat')
    }

    // Check if already a task
    if (message.isTask) {
      throw new ConflictError('Message is already a task')
    }

    // Check if owner is a chat member
    const isOwnerMember = message.chat.members.some((m) => m.userId === body.ownerId)
    if (!isOwnerMember) {
      throw new ValidationError('Owner must be a member of this chat')
    }

    // Create task
    const title = body.title || message.content?.slice(0, 200) || 'Untitled Task'

    const result = await prisma.$transaction(async (tx) => {
      // Update message
      const updatedMessage = await tx.message.update({
        where: { id: messageId },
        data: { isTask: true },
      })

      // Create task
      const task = await tx.task.create({
        data: {
          messageId,
          title,
          ownerId: body.ownerId,
          priority: body.priority,
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
          approvalRequired: body.approvalRequired,
          isRecurring: body.isRecurring,
          recurringRule: body.recurringRule || null,
          tags: body.tags,
          sopInstructions: body.sopInstructions || null,
          createdById: userId,
          steps: body.steps ? {
            createMany: {
              data: body.steps.map((step, index) => ({
                order: index + 1,
                content: step.content,
                isMandatory: step.isMandatory,
                proofRequired: step.proofRequired,
              })),
            },
          } : undefined,
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          steps: {
            orderBy: { order: 'asc' },
          },
        },
      })

      // Create activity
      await tx.taskActivity.create({
        data: {
          taskId: task.id,
          userId,
          action: 'CREATED',
          details: { title: task.title },
        },
      })

      return { message: updatedMessage, task }
    })

    // Emit socket event
    fastify.io.to(`chat:${message.chatId}`).emit('message_converted_to_task', {
      chatId: message.chatId,
      messageId,
      task: result.task,
    })

    return {
      success: true,
      data: {
        id: message.id,
        chatId: message.chatId,
        senderId: message.senderId,
        content: message.content,
        type: message.type,
        fileUrl: message.fileUrl,
        replyToId: message.replyToId,
        isTask: true,
        task: result.task,
        createdAt: message.createdAt,
      },
    }
  })

  /**
   * POST /api/messages/:id/delete - Delete a message (for me or for everyone)
   */
  const deleteMessageSchema = z.object({
    mode: z.enum(['for_me', 'for_everyone']),
  })

  fastify.post('/messages/:id/delete', {
    preHandler: [authenticate],
  }, async (request) => {
    const { id: messageId } = messageIdParamsSchema.parse(request.params)
    const { mode } = deleteMessageSchema.parse(request.body)
    const userId = request.user.id

    const message = await prisma.message.findUnique({
      where: { id: messageId },
    })

    if (!message) {
      throw new NotFoundError('Message')
    }

    // Check chat membership
    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: message.chatId, userId } },
    })
    if (!membership) {
      throw new ForbiddenError('You are not a member of this chat')
    }

    // Task messages cannot be deleted
    if (message.isTask) {
      throw new ForbiddenError('Task messages cannot be deleted')
    }

    if (mode === 'for_me') {
      await prisma.messageDeletedFor.upsert({
        where: { messageId_userId: { messageId, userId } },
        create: { messageId, userId },
        update: {},
      })

      return { success: true, data: { messageId, mode: 'for_me' } }
    }

    // mode === 'for_everyone'
    if (message.senderId !== userId) {
      throw new ForbiddenError('You can only delete your own messages for everyone')
    }

    if (message.deletedForEveryone) {
      throw new ConflictError('Message is already deleted for everyone')
    }

    const ONE_HOUR_MS = 60 * 60 * 1000
    if (Date.now() - new Date(message.createdAt).getTime() > ONE_HOUR_MS) {
      throw new ForbiddenError('You can only delete messages for everyone within 1 hour of sending')
    }

    const deletedAt = new Date()
    await prisma.message.update({
      where: { id: messageId },
      data: { deletedAt, deletedForEveryone: true, content: null, fileUrl: null },
    })

    // Broadcast to all chat members
    fastify.io.to(`chat:${message.chatId}`).emit('message_deleted_for_everyone', {
      chatId: message.chatId,
      messageId,
      deletedAt: deletedAt.toISOString(),
    })

    return { success: true, data: { messageId, mode: 'for_everyone', deletedAt } }
  })

  /**
   * POST /api/messages/:id/star - Toggle star/bookmark on a message
   */
  fastify.post('/messages/:id/star', {
    preHandler: [authenticate],
  }, async (request) => {
    const { id: messageId } = messageIdParamsSchema.parse(request.params)
    const userId = request.user.id

    const message = await prisma.message.findUnique({
      where: { id: messageId },
    })

    if (!message) {
      throw new NotFoundError('Message')
    }

    // Check chat membership
    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: message.chatId, userId } },
    })
    if (!membership) {
      throw new ForbiddenError('You are not a member of this chat')
    }

    // Toggle: check if already starred
    const existing = await prisma.messageStarred.findUnique({
      where: { messageId_userId: { messageId, userId } },
    })

    if (existing) {
      await prisma.messageStarred.delete({ where: { id: existing.id } })
      return { success: true, data: { messageId, starred: false } }
    }

    await prisma.messageStarred.create({
      data: { messageId, userId },
    })

    return { success: true, data: { messageId, starred: true } }
  })

  /**
   * GET /api/chats/:id/starred - Get starred messages for a chat (per-user)
   */
  fastify.get('/chats/:id/starred', {
    preHandler: [authenticate],
  }, async (request) => {
    const { id: chatId } = chatIdParamsSchema.parse(request.params)
    const userId = request.user.id

    // Check membership
    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
    })
    if (!membership) {
      throw new ForbiddenError('You are not a member of this chat')
    }

    const starred = await prisma.messageStarred.findMany({
      where: {
        userId,
        message: { chatId, deletedForEveryone: false, deletedFor: { none: { userId } } },
      },
      include: {
        message: {
          include: {
            sender: {
              select: { id: true, phone: true, name: true, avatarUrl: true, emoji: true },
            },
            replyTo: {
              select: {
                id: true, content: true, type: true, senderId: true, deletedForEveryone: true,
                sender: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { starredAt: 'desc' },
    })

    return {
      success: true,
      data: starred.map((s) => ({
        id: s.message.id,
        chatId: s.message.chatId,
        senderId: s.message.senderId,
        sender: s.message.sender,
        content: s.message.content,
        type: s.message.type,
        fileUrl: s.message.fileUrl,
        replyToId: s.message.replyToId,
        replyTo: s.message.replyTo,
        isTask: s.message.isTask,
        editedAt: s.message.editedAt,
        isStarred: true,
        isPinned: false,
        createdAt: s.message.createdAt,
        starredAt: s.starredAt,
      })),
    }
  })

  /**
   * POST /api/messages/:id/pin - Toggle pin on a message (admins/owners in groups, anyone in direct)
   */
  fastify.post('/messages/:id/pin', {
    preHandler: [authenticate],
  }, async (request) => {
    const { id: messageId } = messageIdParamsSchema.parse(request.params)
    const userId = request.user.id

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { chat: true },
    })

    if (!message) {
      throw new NotFoundError('Message')
    }

    // Check chat membership
    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: message.chatId, userId } },
    })
    if (!membership) {
      throw new ForbiddenError('You are not a member of this chat')
    }

    // In GROUP chats, only ADMIN/OWNER can pin
    if (message.chat.type === 'GROUP' && membership.role === 'MEMBER') {
      throw new ForbiddenError('Only admins and owners can pin messages in group chats')
    }

    // Cannot pin deleted messages
    if (message.deletedForEveryone) {
      throw new ForbiddenError('Cannot pin a deleted message')
    }

    // Toggle: check if already pinned
    const existing = await prisma.messagePinned.findUnique({
      where: { messageId },
    })

    if (existing) {
      await prisma.messagePinned.delete({ where: { id: existing.id } })

      // Broadcast unpin to all chat members
      fastify.io.to(`chat:${message.chatId}`).emit('message_unpinned', {
        chatId: message.chatId,
        messageId,
      })

      return { success: true, data: { messageId, pinned: false } }
    }

    await prisma.messagePinned.create({
      data: { messageId, chatId: message.chatId, pinnedBy: userId },
    })

    // Broadcast pin to all chat members
    fastify.io.to(`chat:${message.chatId}`).emit('message_pinned', {
      chatId: message.chatId,
      messageId,
    })

    return { success: true, data: { messageId, pinned: true } }
  })

  /**
   * GET /api/chats/:id/pinned - Get pinned messages for a chat (visible to all members)
   */
  fastify.get('/chats/:id/pinned', {
    preHandler: [authenticate],
  }, async (request) => {
    const { id: chatId } = chatIdParamsSchema.parse(request.params)
    const userId = request.user.id

    // Check membership
    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
    })
    if (!membership) {
      throw new ForbiddenError('You are not a member of this chat')
    }

    const pinned = await prisma.messagePinned.findMany({
      where: { chatId },
      include: {
        message: {
          include: {
            sender: {
              select: { id: true, phone: true, name: true, avatarUrl: true, emoji: true },
            },
            replyTo: {
              select: {
                id: true, content: true, type: true, senderId: true, deletedForEveryone: true,
                sender: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { pinnedAt: 'desc' },
    })

    return {
      success: true,
      data: pinned.map((p) => ({
        id: p.message.id,
        chatId: p.message.chatId,
        senderId: p.message.senderId,
        sender: p.message.sender,
        content: p.message.content,
        type: p.message.type,
        fileUrl: p.message.fileUrl,
        replyToId: p.message.replyToId,
        replyTo: p.message.replyTo,
        isTask: p.message.isTask,
        editedAt: p.message.editedAt,
        isStarred: false,
        isPinned: true,
        createdAt: p.message.createdAt,
        pinnedAt: p.pinnedAt,
      })),
    }
  })
}
