import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@workchat/database'
import { ChatType, ChatMemberRole } from '@workchat/shared'
import { authenticate } from '../middleware/auth'
import { NotFoundError, ForbiddenError, AppError } from '../middleware/errorHandler'

// Validation schemas
const userIdParamsSchema = z.object({
  id: z.string(),
})

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  emoji: z.string().max(10).optional().nullable(),
})

const searchSchema = z.object({
  query: z.string().min(1).max(100),
})

const phoneSearchSchema = z.object({
  phone: z.string().min(1).max(20),
})

const startChatSchema = z.object({
  userId: z.string(),
})

const matchContactsSchema = z.object({
  phones: z.array(z.string()).min(1).max(500),
})

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/users - Search users by name or phone (excludes self)
   */
  fastify.get('/', {
    preHandler: [authenticate],
  }, async (request) => {
    const queryParam = (request.query as Record<string, string>).query
    const currentUserId = request.user.id

    // Look up current user to get orgId
    const currentUser = await prisma.user.findUnique({ where: { id: currentUserId } })
    if (!currentUser) throw new NotFoundError('User')

    const whereClause: any = {
      status: 'ACTIVE',
      orgId: currentUser.orgId,
      id: { not: currentUserId },
    }

    if (queryParam) {
      whereClause.OR = [
        { name: { contains: queryParam, mode: 'insensitive' } },
        { phone: { contains: queryParam } },
      ]
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        phone: true,
        name: true,
        avatarUrl: true,
        emoji: true,
        createdAt: true,
      },
      take: 50,
      orderBy: { name: 'asc' },
    })

    return {
      success: true,
      data: users,
    }
  })

  /**
   * GET /api/users/search-phone - Search user by exact phone number (WhatsApp-style)
   */
  fastify.get('/search-phone', {
    preHandler: [authenticate],
  }, async (request) => {
    const { phone } = phoneSearchSchema.parse(request.query)
    const currentUserId = request.user.id

    // Look up current user to get orgId
    const currentUser = await prisma.user.findUnique({ where: { id: currentUserId } })
    if (!currentUser) throw new NotFoundError('User')

    // Normalize phone number
    const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`

    const user = await prisma.user.findFirst({
      where: {
        phone: normalizedPhone,
        status: 'ACTIVE',
        orgId: currentUser.orgId,
      },
      select: {
        id: true,
        phone: true,
        name: true,
        avatarUrl: true,
        emoji: true,
        createdAt: true,
      },
    })

    if (!user || user.id === currentUserId) {
      return {
        success: true,
        data: null,
        message: user?.id === currentUserId ? 'This is your own number' : 'User not found',
      }
    }

    return {
      success: true,
      data: user,
    }
  })

  /**
   * POST /api/users/start-chat - Start or get existing direct chat with a user
   * Returns existing chat if one exists, creates new one otherwise
   */
  fastify.post('/start-chat', {
    preHandler: [authenticate],
  }, async (request) => {
    const { userId: targetUserId } = startChatSchema.parse(request.body)
    const currentUserId = request.user.id

    if (targetUserId === currentUserId) {
      throw new ForbiddenError('Cannot start chat with yourself')
    }

    // Look up current user to get orgId
    const currentUser = await prisma.user.findUnique({ where: { id: currentUserId } })
    if (!currentUser) throw new NotFoundError('User')

    // Verify target user exists and is in same org
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        phone: true,
        name: true,
        avatarUrl: true,
        orgId: true,
        status: true,
      },
    })

    if (!targetUser) {
      throw new NotFoundError('User')
    }
    if (targetUser.orgId !== currentUser.orgId) {
      throw new AppError('User not found in your organization', 404, 'NOT_FOUND')
    }
    if (targetUser.status !== 'ACTIVE') {
      throw new AppError('User is not active', 400, 'USER_NOT_ACTIVE')
    }

    // Check if direct chat already exists between these two users
    const existingChat = await prisma.chat.findFirst({
      where: {
        type: ChatType.DIRECT,
        AND: [
          { members: { some: { userId: currentUserId } } },
          { members: { some: { userId: targetUserId } } },
        ],
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
    })

    if (existingChat) {
      const lastMessage = existingChat.messages[0] || null
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
        },
        isNew: false,
      }
    }

    // Create new direct chat
    const newChat = await prisma.chat.create({
      data: {
        type: ChatType.DIRECT,
        name: targetUser.name, // Chat name shows target user's name
        createdBy: currentUserId,
        orgId: currentUser.orgId,
        members: {
          createMany: {
            data: [
              { userId: currentUserId, role: ChatMemberRole.OWNER },
              { userId: targetUserId, role: ChatMemberRole.OWNER },
            ],
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
              },
            },
          },
        },
      },
    })

    // Emit socket event to notify the other user
    fastify.io.to(`user:${targetUserId}`).emit('chat_created', { chat: newChat })

    return {
      success: true,
      data: {
        id: newChat.id,
        type: newChat.type,
        name: newChat.name,
        createdBy: newChat.createdBy,
        createdAt: newChat.createdAt,
        members: newChat.members.map((m) => ({
          userId: m.userId,
          user: m.user,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
        lastMessage: null,
      },
      isNew: true,
    }
  })

  /**
   * POST /api/users/match-contacts - Find WorkChat users from phone contacts
   * Used to sync contacts and show which contacts are on WorkChat
   */
  fastify.post('/match-contacts', {
    preHandler: [authenticate],
  }, async (request) => {
    const { phones } = matchContactsSchema.parse(request.body)
    const currentUserId = request.user.id

    // Look up current user to get orgId
    const currentUser = await prisma.user.findUnique({ where: { id: currentUserId } })
    if (!currentUser) throw new NotFoundError('User')

    // Normalize phone numbers (add + prefix if missing)
    const normalizedPhones = phones.map((phone) => {
      const cleaned = phone.replace(/[\s\-()]/g, '')
      return cleaned.startsWith('+') ? cleaned : `+${cleaned}`
    })

    // Find users matching these phone numbers (exclude self, same org only)
    const users = await prisma.user.findMany({
      where: {
        phone: { in: normalizedPhones },
        status: 'ACTIVE',
        orgId: currentUser.orgId,
        id: { not: currentUserId },
      },
      select: {
        id: true,
        phone: true,
        name: true,
        avatarUrl: true,
        emoji: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    })

    return {
      success: true,
      data: users,
    }
  })

  /**
   * GET /api/users/:id - Get user details
   */
  fastify.get('/:id', {
    preHandler: [authenticate],
  }, async (request) => {
    const { id } = userIdParamsSchema.parse(request.params)

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        phone: true,
        name: true,
        avatarUrl: true,
        emoji: true,
        createdAt: true,
      },
    })

    if (!user) {
      throw new NotFoundError('User')
    }

    return {
      success: true,
      data: user,
    }
  })

  /**
   * PATCH /api/users/:id - Update user (self only)
   */
  fastify.patch('/:id', {
    preHandler: [authenticate],
  }, async (request) => {
    const { id } = userIdParamsSchema.parse(request.params)
    const body = updateUserSchema.parse(request.body)

    // Users can only update themselves
    if (request.user.id !== id) {
      throw new ForbiddenError('You can only update your own profile')
    }

    const user = await prisma.user.update({
      where: { id },
      data: body,
      select: {
        id: true,
        phone: true,
        name: true,
        avatarUrl: true,
        emoji: true,
        createdAt: true,
      },
    })

    return {
      success: true,
      data: user,
    }
  })
}
