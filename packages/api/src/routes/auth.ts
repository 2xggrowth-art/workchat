import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@workchat/database'
import { authenticate } from '../middleware/auth'
import { AppError, ForbiddenError, UnauthorizedError } from '../middleware/errorHandler'
import crypto from 'crypto'
import bcrypt from 'bcrypt'

// Validation schemas
const registerSchema = z.object({
  phone: z.string().min(10).max(15),
  name: z.string().min(1).max(100),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits'),
  orgCode: z.string().min(3).max(10),
})

const loginSchema = z.object({
  phone: z.string().min(10).max(15),
  pin: z.string().min(1),
})

const refreshSchema = z.object({
  refreshToken: z.string(),
})

// Refresh token expiry: 90 days for WhatsApp-like persistent login
const REFRESH_TOKEN_EXPIRY_DAYS = 90
const BCRYPT_SALT_ROUNDS = 10

// Generate a secure random token
function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex')
}

// Calculate expiry date
function getRefreshTokenExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/auth/register - Register new user with phone + PIN
   */
  fastify.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body)
    const phone = body.phone.startsWith('+') ? body.phone : `+${body.phone}`

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { phone } })
    if (existing) {
      throw new AppError('Phone number already registered', 409, 'USER_EXISTS')
    }

    // Look up organization by orgCode (try exact match first, then with hyphen removed)
    let org = await prisma.organization.findUnique({ where: { orgCode: body.orgCode } })
    if (!org) {
      // Try matching with hyphen stripped (e.g., "WRK4829" matches "WRK-4829")
      const stripped = body.orgCode.replace(/-/g, '')
      const allOrgs = await prisma.organization.findMany({
        where: { orgCode: { not: body.orgCode } },
      })
      org = allOrgs.find((o) => o.orgCode.replace(/-/g, '') === stripped) || null
    }
    if (!org) {
      throw new AppError('Invalid organization code', 400, 'INVALID_ORG_CODE')
    }

    const hashedPassword = await bcrypt.hash(body.pin, BCRYPT_SALT_ROUNDS)

    // All new registrations are STAFF with status PENDING
    await prisma.user.create({
      data: {
        phone,
        name: body.name,
        password: hashedPassword,
        role: 'STAFF',
        status: 'PENDING',
        orgId: org.id,
      },
    })

    return {
      success: true,
      data: { message: 'Registration pending approval' },
    }
  })

  /**
   * POST /api/auth/login - Login with phone + PIN
   */
  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body)
    const phone = body.phone.startsWith('+') ? body.phone : `+${body.phone}`

    const user = await prisma.user.findUnique({ where: { phone } })
    if (!user) {
      throw new UnauthorizedError('Invalid phone number or PIN')
    }

    const pinValid = await bcrypt.compare(body.pin, user.password)
    if (!pinValid) {
      throw new UnauthorizedError('Invalid phone number or PIN')
    }

    if (user.status !== 'ACTIVE') {
      if (user.status === 'PENDING') {
        throw new ForbiddenError('Account pending approval')
      }
      if (user.status === 'SUSPENDED') {
        throw new ForbiddenError('Account suspended')
      }
    }

    // Generate access token
    const accessToken = fastify.jwt.sign({
      id: user.id,
      phone: user.phone,
      name: user.name,
    })

    // Generate and store refresh token
    const refreshToken = generateRefreshToken()
    const expiresAt = getRefreshTokenExpiry()
    const deviceInfo = request.headers['user-agent'] || 'Unknown device'

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        deviceInfo,
        expiresAt,
      },
    })

    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
    })

    return {
      success: true,
      data: {
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          avatarUrl: user.avatarUrl,
          emoji: user.emoji,
          role: user.role,
          status: user.status,
          orgId: user.orgId,
          createdAt: user.createdAt,
        },
        accessToken,
        refreshToken,
      },
    }
  })

  /**
   * POST /api/auth/refresh - Refresh access token
   */
  fastify.post('/refresh', async (request, reply) => {
    const body = refreshSchema.parse(request.body)
    const { refreshToken } = body

    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    })

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      if (tokenRecord) {
        await prisma.refreshToken.delete({ where: { id: tokenRecord.id } })
      }
      throw new UnauthorizedError('Invalid or expired refresh token')
    }

    const user = tokenRecord.user

    const newAccessToken = fastify.jwt.sign({
      id: user.id,
      phone: user.phone,
      name: user.name,
    })

    const newRefreshToken = generateRefreshToken()
    const newExpiresAt = getRefreshTokenExpiry()

    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: {
        token: newRefreshToken,
        expiresAt: newExpiresAt,
        lastUsedAt: new Date(),
      },
    })

    reply.setCookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
    })

    return {
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    }
  })

  /**
   * POST /api/auth/logout - Logout (invalidate refresh token)
   */
  fastify.post('/logout', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const refreshToken = request.cookies.refreshToken || (request.body as any)?.refreshToken

    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      })
    }

    reply.clearCookie('refreshToken', { path: '/api/auth' })

    return {
      success: true,
      data: { message: 'Logged out successfully' },
    }
  })

  /**
   * GET /api/auth/me - Get current user
   */
  fastify.get('/me', {
    preHandler: [authenticate],
  }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.id },
    })

    if (!user) {
      throw new UnauthorizedError('User not found')
    }

    return {
      success: true,
      data: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        avatarUrl: user.avatarUrl,
        emoji: user.emoji,
        role: user.role,
        status: user.status,
        orgId: user.orgId,
        createdAt: user.createdAt,
      },
    }
  })

  /**
   * GET /api/auth/pending-users - List users pending approval (admin only)
   */
  fastify.get('/pending-users', {
    preHandler: [authenticate],
  }, async (request) => {
    // Check admin role
    const currentUser = await prisma.user.findUnique({ where: { id: request.user.id } })
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN')) {
      throw new ForbiddenError('Admin access required')
    }

    const pendingUsers = await prisma.user.findMany({
      where: { status: 'PENDING', orgId: currentUser.orgId },
      select: {
        id: true,
        phone: true,
        name: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return {
      success: true,
      data: pendingUsers,
    }
  })

  /**
   * POST /api/auth/approve-user/:id - Approve a pending user (admin only)
   */
  fastify.post('/approve-user/:id', {
    preHandler: [authenticate],
  }, async (request) => {
    const currentUser = await prisma.user.findUnique({ where: { id: request.user.id } })
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN')) {
      throw new ForbiddenError('Admin access required')
    }

    const { id } = request.params as { id: string }

    const targetUser = await prisma.user.findUnique({ where: { id } })
    if (!targetUser) {
      throw new AppError('User not found', 404, 'NOT_FOUND')
    }
    if (targetUser.orgId !== currentUser.orgId) {
      throw new AppError('User not found', 404, 'NOT_FOUND')
    }
    if (targetUser.status !== 'PENDING') {
      throw new AppError('User is already approved', 400, 'ALREADY_APPROVED')
    }

    const user = await prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE', approvedBy: currentUser.id },
    })

    return {
      success: true,
      data: { message: `User ${user.name} approved` },
    }
  })

  /**
   * POST /api/auth/reject-user/:id - Reject (delete) a pending user (admin only)
   */
  fastify.post('/reject-user/:id', {
    preHandler: [authenticate],
  }, async (request) => {
    const currentUser = await prisma.user.findUnique({ where: { id: request.user.id } })
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN')) {
      throw new ForbiddenError('Admin access required')
    }

    const { id } = request.params as { id: string }

    const targetUser = await prisma.user.findUnique({ where: { id } })
    if (!targetUser) {
      throw new AppError('User not found', 404, 'NOT_FOUND')
    }
    if (targetUser.orgId !== currentUser.orgId) {
      throw new AppError('User not found', 404, 'NOT_FOUND')
    }

    await prisma.user.delete({
      where: { id },
    })

    return {
      success: true,
      data: { message: 'User rejected and removed' },
    }
  })

  /**
   * GET /api/auth/resolve-org/:code - Resolve org code to org name (public, no auth)
   * Used for invite link pre-fill on the registration page
   */
  fastify.get('/resolve-org/:code', async (request) => {
    const { code } = request.params as { code: string }

    // Try exact match first
    let org = await prisma.organization.findUnique({ where: { orgCode: code } })

    if (!org) {
      // Try matching with hyphen inserted (e.g., "WRK4829" -> "WRK-4829")
      const stripped = code.replace(/-/g, '')
      const allOrgs = await prisma.organization.findMany()
      org = allOrgs.find((o) => o.orgCode.replace(/-/g, '') === stripped) || null
    }

    if (!org) {
      throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND')
    }

    return {
      success: true,
      data: {
        name: org.name,
        orgCode: org.orgCode,
      },
    }
  })

  /**
   * Cleanup expired tokens (can be called periodically)
   */
  const cleanupExpiredTokens = async () => {
    await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    })
  }

  // Run cleanup on server start and every 24 hours
  cleanupExpiredTokens().catch((err) => fastify.log.error('Failed to cleanup tokens:', err))
  setInterval(() => {
    cleanupExpiredTokens().catch((err) => fastify.log.error('Failed to cleanup tokens:', err))
  }, 24 * 60 * 60 * 1000)
}
