import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@workchat/database'
import { ChatType, ChatMemberRole } from '@workchat/shared'
import { authenticate, requireChatMember, requireGroupAdmin, requireGroupOwner, getChatMemberRole } from '../middleware/auth'
import { NotFoundError, ForbiddenError } from '../middleware/errorHandler'

// Validation schemas
const chatIdParamsSchema = z.object({
  id: z.string(),
})

const createChatSchema = z.object({
  type: z.nativeEnum(ChatType),
  name: z.string().min(1).max(100).optional(),
  memberIds: z.array(z.string()).optional().default([]),
})

const addMembersSchema = z.object({
  userIds: z.array(z.string()).min(1),
})

const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional().nullable(),
})

export const chatRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/chats - List user's chats with last message
   */
  fastify.get('/', {
    preHandler: [authenticate],
  }, async (request) => {
    const userId = request.user.id

    const chats = await prisma.chat.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                phone: true,
                name: true,
                avatarUrl: true,
                emoji: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    // Get unread counts for all chats in one query
    const chatIds = chats.map((c) => c.id)
    const unreadCounts = await prisma.$queryRaw<{ chat_id: string; count: bigint }[]>`
      SELECT m.chat_id, COUNT(m.id)::bigint as count
      FROM messages m
      WHERE m.chat_id = ANY(${chatIds})
        AND m.sender_id != ${userId}
        AND NOT EXISTS (
          SELECT 1 FROM message_reads mr
          WHERE mr.message_id = m.id AND mr.user_id = ${userId}
        )
      GROUP BY m.chat_id
    `

    // Create a map of chat_id -> unread count
    const unreadMap = new Map(
      unreadCounts.map((r) => [r.chat_id, Number(r.count)])
    )

    // Transform to include lastMessage and unreadCount
    const transformedChats = chats.map((chat) => {
      const lastMessage = chat.messages[0] || null
      return {
        id: chat.id,
        type: chat.type,
        name: chat.name,
        createdBy: chat.createdBy,
        createdAt: chat.createdAt,
        members: chat.members.map((m) => ({
          userId: m.userId,
          user: m.user,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              type: lastMessage.type,
              senderId: lastMessage.senderId,
              senderName: lastMessage.sender.name,
              createdAt: lastMessage.createdAt,
            }
          : null,
        unreadCount: unreadMap.get(chat.id) || 0,
      }
    })

    return {
      success: true,
      data: transformedChats,
    }
  })

  /**
   * POST /api/chats - Create a new chat (any authenticated user)
   * Creator becomes OWNER automatically
   */
  fastify.post('/', {
    preHandler: [authenticate],
  }, async (request) => {
    const body = createChatSchema.parse(request.body)
    const userId = request.user.id

    // Only ADMIN and SUPER_ADMIN can create chats
    const currentUser = await prisma.user.findUnique({ where: { id: userId } })
    if (!currentUser || currentUser.role === 'STAFF') {
      throw new ForbiddenError('Only admins can create chats')
    }

    // Ensure creator is included in members
    const memberIds = [...new Set([userId, ...body.memberIds])]

    // For direct chats, both users are OWNER
    // For group chats, creator is OWNER, others are MEMBER
    const isDirectChat = body.type === ChatType.DIRECT && memberIds.length === 2

    // Prevent duplicate DIRECT chats between same two users
    if (isDirectChat) {
      const otherUserId = memberIds.find(id => id !== userId)!
      const existingChat = await prisma.chat.findFirst({
        where: {
          type: 'DIRECT',
          AND: [
            { members: { some: { userId } } },
            { members: { some: { userId: otherUserId } } },
          ],
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, phone: true, name: true, avatarUrl: true },
              },
            },
          },
        },
      })
      if (existingChat) {
        return {
          success: true,
          data: {
            id: existingChat.id,
            type: existingChat.type,
            name: existingChat.name,
            createdBy: existingChat.createdBy,
            createdAt: existingChat.createdAt,
            members: existingChat.members.map((m) => ({
              userId: m.userId,
              user: m.user,
              role: m.role,
              joinedAt: m.joinedAt,
            })),
          },
        }
      }
    }

    // Auto-generate name for direct chats if not provided
    let chatName = body.name || ''
    if (isDirectChat && !chatName) {
      const otherUserId = memberIds.find(id => id !== userId)
      if (otherUserId) {
        const otherUser = await prisma.user.findUnique({ where: { id: otherUserId }, select: { name: true } })
        chatName = otherUser?.name || 'Direct Chat'
      }
    }

    const chat = await prisma.chat.create({
      data: {
        type: body.type,
        name: chatName,
        createdBy: userId,
        members: {
          createMany: {
            data: memberIds.map((id, index) => ({
              userId: id,
              // For direct chats: both are OWNER
              // For group chats: creator (index 0) is OWNER, rest are MEMBER
              role: isDirectChat ? ChatMemberRole.OWNER : (index === 0 ? ChatMemberRole.OWNER : ChatMemberRole.MEMBER),
            })),
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                phone: true,
                name: true,
                avatarUrl: true,
                emoji: true,
              },
            },
          },
        },
      },
    })

    // Emit socket event to notify members
    const io = fastify.io
    memberIds.forEach((memberId) => {
      if (memberId !== userId) {
        io.to(`user:${memberId}`).emit('chat_created', { chat })
      }
    })

    return {
      success: true,
      data: {
        id: chat.id,
        type: chat.type,
        name: chat.name,
        createdBy: chat.createdBy,
        createdAt: chat.createdAt,
        members: chat.members.map((m) => ({
          userId: m.userId,
          user: m.user,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
      },
    }
  })

  /**
   * GET /api/chats/:id - Get chat details
   */
  fastify.get('/:id', {
    preHandler: [authenticate, requireChatMember('id')],
  }, async (request) => {
    const { id } = chatIdParamsSchema.parse(request.params)

    const chat = await prisma.chat.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                phone: true,
                name: true,
                avatarUrl: true,
                emoji: true,
              },
            },
          },
        },
      },
    })

    if (!chat) {
      throw new NotFoundError('Chat')
    }

    return {
      success: true,
      data: {
        id: chat.id,
        type: chat.type,
        name: chat.name,
        createdBy: chat.createdBy,
        createdAt: chat.createdAt,
        members: chat.members.map((m) => ({
          userId: m.userId,
          user: m.user,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
      },
    }
  })

  /**
   * PATCH /api/chats/:id - Update chat info (OWNER/ADMIN only)
   */
  fastify.patch('/:id', {
    preHandler: [authenticate, requireChatMember('id'), requireGroupAdmin],
  }, async (request) => {
    const { id } = chatIdParamsSchema.parse(request.params)
    const body = updateGroupSchema.parse(request.body)

    const chat = await prisma.chat.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                phone: true,
                name: true,
                avatarUrl: true,
                emoji: true,
              },
            },
          },
        },
      },
    })

    // Emit socket event
    fastify.io.to(`chat:${id}`).emit('chat_updated', { chat })

    return {
      success: true,
      data: {
        id: chat.id,
        type: chat.type,
        name: chat.name,
        createdBy: chat.createdBy,
        createdAt: chat.createdAt,
        members: chat.members.map((m) => ({
          userId: m.userId,
          user: m.user,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
      },
    }
  })

  /**
   * POST /api/chats/:id/members - Add members to chat (OWNER/ADMIN only)
   */
  fastify.post('/:id/members', {
    preHandler: [authenticate, requireChatMember('id'), requireGroupAdmin],
  }, async (request) => {
    const { id } = chatIdParamsSchema.parse(request.params)
    const body = addMembersSchema.parse(request.body)

    const chat = await prisma.chat.findUnique({
      where: { id },
      include: { members: true },
    })

    if (!chat) {
      throw new NotFoundError('Chat')
    }

    // Filter out users who are already members
    const existingMemberIds = new Set(chat.members.map((m) => m.userId))
    const newMemberIds = body.userIds.filter((id) => !existingMemberIds.has(id))

    if (newMemberIds.length === 0) {
      return {
        success: true,
        data: { message: 'All users are already members', addedCount: 0 },
      }
    }

    // Add new members
    await prisma.chatMember.createMany({
      data: newMemberIds.map((userId) => ({
        chatId: id,
        userId,
        role: ChatMemberRole.MEMBER,
      })),
    })

    // Get updated member info
    const newMembers = await prisma.chatMember.findMany({
      where: {
        chatId: id,
        userId: { in: newMemberIds },
      },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    })

    // Emit socket events
    const io = fastify.io
    newMembers.forEach((member) => {
      io.to(`chat:${id}`).emit('member_added', {
        chatId: id,
        member: {
          userId: member.userId,
          user: member.user,
          role: member.role,
          joinedAt: member.joinedAt,
        },
      })
    })

    return {
      success: true,
      data: {
        message: 'Members added successfully',
        addedCount: newMemberIds.length,
        members: newMembers.map((m) => ({
          userId: m.userId,
          user: m.user,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
      },
    }
  })

  /**
   * DELETE /api/chats/:id/members/:userId - Remove member from chat (OWNER/ADMIN only)
   * ADMIN can only remove MEMBER, OWNER can remove anyone except themselves
   */
  fastify.delete('/:id/members/:userId', {
    preHandler: [authenticate, requireChatMember('id'), requireGroupAdmin],
  }, async (request) => {
    const params = z.object({
      id: z.string(),
      userId: z.string(),
    }).parse(request.params)

    const actorRole = (request as any).memberRole as ChatMemberRole

    // Get target member's role
    const targetMember = await prisma.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId: params.id,
          userId: params.userId,
        },
      },
    })

    if (!targetMember) {
      throw new NotFoundError('Chat member')
    }

    // OWNER cannot remove themselves
    if (targetMember.role === ChatMemberRole.OWNER && params.userId === request.user.id) {
      throw new ForbiddenError('Owner cannot remove themselves from the chat')
    }

    // ADMIN can only remove MEMBER
    if (actorRole === ChatMemberRole.ADMIN && targetMember.role !== ChatMemberRole.MEMBER) {
      throw new ForbiddenError('Admins can only remove regular members')
    }

    await prisma.chatMember.delete({
      where: {
        chatId_userId: {
          chatId: params.id,
          userId: params.userId,
        },
      },
    })

    // Emit socket event
    fastify.io.to(`chat:${params.id}`).emit('member_removed', {
      chatId: params.id,
      userId: params.userId,
    })

    return {
      success: true,
      data: { message: 'Member removed successfully' },
    }
  })

  /**
   * POST /api/chats/:id/members/:userId/promote - Promote member to ADMIN (OWNER only)
   */
  fastify.post('/:id/members/:userId/promote', {
    preHandler: [authenticate, requireChatMember('id'), requireGroupOwner],
  }, async (request) => {
    const params = z.object({
      id: z.string(),
      userId: z.string(),
    }).parse(request.params)

    const member = await prisma.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId: params.id,
          userId: params.userId,
        },
      },
    })

    if (!member) {
      throw new NotFoundError('Chat member')
    }

    if (member.role === ChatMemberRole.OWNER) {
      throw new ForbiddenError('Cannot promote owner')
    }

    if (member.role === ChatMemberRole.ADMIN) {
      return {
        success: true,
        data: { message: 'User is already an admin' },
      }
    }

    await prisma.chatMember.update({
      where: {
        chatId_userId: {
          chatId: params.id,
          userId: params.userId,
        },
      },
      data: { role: ChatMemberRole.ADMIN },
    })

    // Emit socket event
    fastify.io.to(`chat:${params.id}`).emit('member_role_changed', {
      chatId: params.id,
      userId: params.userId,
      newRole: ChatMemberRole.ADMIN,
    })

    return {
      success: true,
      data: { message: 'Member promoted to admin' },
    }
  })

  /**
   * POST /api/chats/:id/members/:userId/demote - Demote admin to MEMBER (OWNER only)
   */
  fastify.post('/:id/members/:userId/demote', {
    preHandler: [authenticate, requireChatMember('id'), requireGroupOwner],
  }, async (request) => {
    const params = z.object({
      id: z.string(),
      userId: z.string(),
    }).parse(request.params)

    const member = await prisma.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId: params.id,
          userId: params.userId,
        },
      },
    })

    if (!member) {
      throw new NotFoundError('Chat member')
    }

    if (member.role === ChatMemberRole.OWNER) {
      throw new ForbiddenError('Cannot demote owner')
    }

    if (member.role === ChatMemberRole.MEMBER) {
      return {
        success: true,
        data: { message: 'User is already a regular member' },
      }
    }

    await prisma.chatMember.update({
      where: {
        chatId_userId: {
          chatId: params.id,
          userId: params.userId,
        },
      },
      data: { role: ChatMemberRole.MEMBER },
    })

    // Emit socket event
    fastify.io.to(`chat:${params.id}`).emit('member_role_changed', {
      chatId: params.id,
      userId: params.userId,
      newRole: ChatMemberRole.MEMBER,
    })

    return {
      success: true,
      data: { message: 'Admin demoted to member' },
    }
  })

  /**
   * POST /api/chats/:id/leave - Leave chat (any member)
   * If OWNER leaves, ownership transfers to oldest ADMIN or oldest MEMBER
   */
  fastify.post('/:id/leave', {
    preHandler: [authenticate, requireChatMember('id')],
  }, async (request) => {
    const { id } = chatIdParamsSchema.parse(request.params)
    const userId = request.user.id
    const memberRole = (request as any).memberRole as ChatMemberRole

    const chat = await prisma.chat.findUnique({
      where: { id },
      include: {
        members: {
          orderBy: { joinedAt: 'asc' },
        },
      },
    })

    if (!chat) {
      throw new NotFoundError('Chat')
    }

    // If only one member, delete the chat
    if (chat.members.length === 1) {
      await prisma.chat.delete({ where: { id } })
      return {
        success: true,
        data: { message: 'Chat deleted (last member left)' },
      }
    }

    // If OWNER is leaving, transfer ownership
    if (memberRole === ChatMemberRole.OWNER) {
      // Find next owner: first ADMIN, or oldest MEMBER
      const nextOwner = chat.members.find(
        (m) => m.userId !== userId && m.role === ChatMemberRole.ADMIN
      ) || chat.members.find(
        (m) => m.userId !== userId
      )

      if (nextOwner) {
        await prisma.chatMember.update({
          where: {
            chatId_userId: {
              chatId: id,
              userId: nextOwner.userId,
            },
          },
          data: { role: ChatMemberRole.OWNER },
        })

        // Emit role change event
        fastify.io.to(`chat:${id}`).emit('member_role_changed', {
          chatId: id,
          userId: nextOwner.userId,
          newRole: ChatMemberRole.OWNER,
        })
      }
    }

    // Remove the member
    await prisma.chatMember.delete({
      where: {
        chatId_userId: {
          chatId: id,
          userId,
        },
      },
    })

    // Emit member removed event
    fastify.io.to(`chat:${id}`).emit('member_removed', {
      chatId: id,
      userId,
    })

    return {
      success: true,
      data: { message: 'Left chat successfully' },
    }
  })

  /**
   * POST /api/chats/:id/mark-read - Mark all messages in chat as read
   */
  fastify.post('/:id/mark-read', {
    preHandler: [authenticate, requireChatMember('id')],
  }, async (request) => {
    const { id } = chatIdParamsSchema.parse(request.params)
    const userId = request.user.id

    // Get all unread messages in this chat (not sent by current user)
    const unreadMessages = await prisma.message.findMany({
      where: {
        chatId: id,
        senderId: { not: userId },
        readBy: {
          none: { userId },
        },
      },
      select: { id: true },
    })

    if (unreadMessages.length === 0) {
      return {
        success: true,
        data: { markedCount: 0 },
      }
    }

    // Create read receipts for all unread messages
    await prisma.messageRead.createMany({
      data: unreadMessages.map((m) => ({
        messageId: m.id,
        userId,
      })),
      skipDuplicates: true,
    })

    // Emit socket event to notify other users that messages were read
    fastify.io.to(`chat:${id}`).emit('messages_read', {
      chatId: id,
      userId,
      readAt: new Date().toISOString(),
    })

    return {
      success: true,
      data: { markedCount: unreadMessages.length },
    }
  })

  /**
   * GET /api/chats/:id/summary - Get chat task summary (OWNER/ADMIN only)
   */
  fastify.get('/:id/summary', {
    preHandler: [authenticate, requireChatMember('id'), requireGroupAdmin],
  }, async (request) => {
    const { id } = chatIdParamsSchema.parse(request.params)

    // Get task statistics for this chat
    const tasks = await prisma.task.findMany({
      where: {
        message: {
          chatId: id,
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Get chat members
    const chatMembers = await prisma.chatMember.findMany({
      where: { chatId: id },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    })

    // Get users who sent messages in the last 24h
    const activeUsers = await prisma.message.findMany({
      where: {
        chatId: id,
        createdAt: { gte: twentyFourHoursAgo },
      },
      select: { senderId: true },
      distinct: ['senderId'],
    })

    const activeUserIds = new Set(activeUsers.map((m) => m.senderId))
    const noActivityUsers = chatMembers
      .filter((m) => !activeUserIds.has(m.userId))
      .map((m) => m.user)

    const summary = {
      total: tasks.length,
      byStatus: {
        pending: tasks.filter((t) => t.status === 'PENDING').length,
        inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
        completed: tasks.filter((t) => t.status === 'COMPLETED').length,
        approved: tasks.filter((t) => t.status === 'APPROVED').length,
        reopened: tasks.filter((t) => t.status === 'REOPENED').length,
      },
      overdue: tasks.filter(
        (t) =>
          t.dueDate &&
          t.dueDate < now &&
          t.status !== 'APPROVED' &&
          t.status !== 'COMPLETED'
      ).length,
      noActivityUsers,
      byOwner: Object.values(
        tasks.reduce((acc, task) => {
          const ownerId = task.ownerId
          if (!acc[ownerId]) {
            acc[ownerId] = {
              owner: task.owner,
              total: 0,
              pending: 0,
              overdue: 0,
            }
          }
          acc[ownerId].total++
          if (task.status === 'PENDING') acc[ownerId].pending++
          if (
            task.dueDate &&
            task.dueDate < now &&
            task.status !== 'APPROVED' &&
            task.status !== 'COMPLETED'
          ) {
            acc[ownerId].overdue++
          }
          return acc
        }, {} as Record<string, any>)
      ),
    }

    return {
      success: true,
      data: summary,
    }
  })
}
