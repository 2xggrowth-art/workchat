import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@workchat/database'
import { authenticate } from '../middleware/auth'
import { AppError, ForbiddenError } from '../middleware/errorHandler'
import { generateOrgCode } from '@workchat/shared/utils'
import { INVITE_LINK_BASE } from '@workchat/shared/constants'

export const orgRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/org/settings - Get org name, code, invite link (Admin/Super Admin)
   */
  fastify.get('/settings', { preHandler: [authenticate] }, async (request) => {
    const currentUser = await prisma.user.findUnique({ where: { id: request.user.id }, include: { org: true } })
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN')) {
      throw new ForbiddenError('Admin access required')
    }
    const org = currentUser.org
    return {
      success: true,
      data: {
        id: org.id,
        name: org.name,
        orgCode: org.orgCode,
        inviteLink: `${INVITE_LINK_BASE}/${org.orgCode.replace('-', '')}`,
        createdAt: org.createdAt,
      },
    }
  })

  /**
   * POST /api/org/regenerate-code - Regenerate org code (Super Admin only)
   */
  fastify.post('/regenerate-code', { preHandler: [authenticate] }, async (request) => {
    const currentUser = await prisma.user.findUnique({ where: { id: request.user.id } })
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('Super Admin access required')
    }
    // Generate unique code
    let newCode = generateOrgCode()
    let exists = await prisma.organization.findUnique({ where: { orgCode: newCode } })
    while (exists) {
      newCode = generateOrgCode()
      exists = await prisma.organization.findUnique({ where: { orgCode: newCode } })
    }
    const org = await prisma.organization.update({
      where: { id: currentUser.orgId },
      data: { orgCode: newCode },
    })
    return {
      success: true,
      data: { orgCode: org.orgCode, inviteLink: `${INVITE_LINK_BASE}/${org.orgCode.replace('-', '')}` },
    }
  })

  /**
   * GET /api/org/members - List all org members with role & status (Admin/Super Admin)
   */
  fastify.get('/members', { preHandler: [authenticate] }, async (request) => {
    const currentUser = await prisma.user.findUnique({ where: { id: request.user.id } })
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN')) {
      throw new ForbiddenError('Admin access required')
    }
    const members = await prisma.user.findMany({
      where: { orgId: currentUser.orgId },
      select: { id: true, phone: true, name: true, role: true, status: true, createdAt: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    })
    return { success: true, data: members }
  })

  /**
   * POST /api/org/promote/:id - Promote Staff -> Admin
   */
  fastify.post('/promote/:id', { preHandler: [authenticate] }, async (request) => {
    const currentUser = await prisma.user.findUnique({ where: { id: request.user.id } })
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN')) {
      throw new ForbiddenError('Admin access required')
    }
    const { id } = request.params as { id: string }
    const target = await prisma.user.findUnique({ where: { id } })
    if (!target || target.orgId !== currentUser.orgId) throw new AppError('User not found', 404, 'NOT_FOUND')
    if (target.role === 'SUPER_ADMIN') throw new ForbiddenError('Cannot promote Super Admin')
    if (target.role === 'ADMIN') throw new AppError('User is already an Admin', 400, 'ALREADY_ADMIN')
    await prisma.user.update({ where: { id }, data: { role: 'ADMIN' } })
    return { success: true, data: { message: `${target.name} promoted to Admin` } }
  })

  /**
   * POST /api/org/demote/:id - Demote Admin -> Staff
   */
  fastify.post('/demote/:id', { preHandler: [authenticate] }, async (request) => {
    const currentUser = await prisma.user.findUnique({ where: { id: request.user.id } })
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN')) {
      throw new ForbiddenError('Admin access required')
    }
    const { id } = request.params as { id: string }
    const target = await prisma.user.findUnique({ where: { id } })
    if (!target || target.orgId !== currentUser.orgId) throw new AppError('User not found', 404, 'NOT_FOUND')
    if (target.role === 'SUPER_ADMIN') throw new ForbiddenError('Cannot demote Super Admin')
    if (target.role === 'STAFF') throw new AppError('User is already Staff', 400, 'ALREADY_STAFF')
    await prisma.user.update({ where: { id }, data: { role: 'STAFF' } })
    return { success: true, data: { message: `${target.name} demoted to Staff` } }
  })

  /**
   * POST /api/org/suspend/:id - Suspend a user
   */
  fastify.post('/suspend/:id', { preHandler: [authenticate] }, async (request) => {
    const currentUser = await prisma.user.findUnique({ where: { id: request.user.id } })
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN')) {
      throw new ForbiddenError('Admin access required')
    }
    const { id } = request.params as { id: string }
    const target = await prisma.user.findUnique({ where: { id } })
    if (!target || target.orgId !== currentUser.orgId) throw new AppError('User not found', 404, 'NOT_FOUND')
    if (target.role === 'SUPER_ADMIN') throw new ForbiddenError('Cannot suspend Super Admin')
    await prisma.user.update({ where: { id }, data: { status: 'SUSPENDED' } })
    return { success: true, data: { message: `${target.name} suspended` } }
  })

  /**
   * POST /api/org/activate/:id - Reactivate suspended user
   */
  fastify.post('/activate/:id', { preHandler: [authenticate] }, async (request) => {
    const currentUser = await prisma.user.findUnique({ where: { id: request.user.id } })
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN')) {
      throw new ForbiddenError('Admin access required')
    }
    const { id } = request.params as { id: string }
    const target = await prisma.user.findUnique({ where: { id } })
    if (!target || target.orgId !== currentUser.orgId) throw new AppError('User not found', 404, 'NOT_FOUND')
    if (target.status === 'ACTIVE') throw new AppError('User is already active', 400, 'ALREADY_ACTIVE')
    await prisma.user.update({ where: { id }, data: { status: 'ACTIVE' } })
    return { success: true, data: { message: `${target.name} activated` } }
  })
}
