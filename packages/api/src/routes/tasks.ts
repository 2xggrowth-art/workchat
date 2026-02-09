import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@workchat/database'
import { TaskStatus, ChatMemberRole, canTransitionTo, isOverdue } from '@workchat/shared'
import { authenticate, getChatMemberRole } from '../middleware/auth'
import { NotFoundError, ForbiddenError, ValidationError } from '../middleware/errorHandler'

// Validation schemas
const taskIdParamsSchema = z.object({
  id: z.string(),
})

const stepIdParamsSchema = z.object({
  id: z.string(),
  stepId: z.string(),
})

const taskFilterSchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  ownerId: z.string().optional(),
  chatId: z.string().optional(),
  isOverdue: z.coerce.boolean().optional(),
})

const updateStatusSchema = z.object({
  status: z.nativeEnum(TaskStatus),
})

const uploadProofSchema = z.object({
  stepId: z.string().optional(),
  type: z.enum(['TEXT', 'AUDIO', 'IMAGE', 'VIDEO', 'FILE']),
  url: z.string().url(),
  note: z.string().max(500).optional(),
})

export const taskRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/tasks - List tasks (filtered by chat membership)
   * Users can see tasks in chats they are members of
   */
  fastify.get('/', {
    preHandler: [authenticate],
  }, async (request) => {
    const filters = taskFilterSchema.parse(request.query)
    const userId = request.user.id

    // Get all chats user is a member of
    const userChats = await prisma.chatMember.findMany({
      where: { userId },
      select: { chatId: true, role: true },
    })

    const chatIds = userChats.map((c) => c.chatId)

    // Build where clause
    const where: any = {
      message: {
        chatId: { in: chatIds },
      },
    }

    if (filters.status) {
      where.status = filters.status
    }

    if (filters.chatId) {
      // Verify user is member of specified chat
      if (!chatIds.includes(filters.chatId)) {
        return {
          success: true,
          data: [],
        }
      }
      where.message.chatId = filters.chatId
    }

    if (filters.ownerId) {
      where.ownerId = filters.ownerId
    }

    // Get tasks
    let tasks = await prisma.task.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        message: {
          select: {
            chatId: true,
            content: true,
          },
        },
        steps: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { proofs: true },
        },
      },
      orderBy: [
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
    })

    // Filter overdue if requested
    if (filters.isOverdue) {
      tasks = tasks.filter((task) =>
        task.status !== TaskStatus.APPROVED &&
        task.status !== TaskStatus.COMPLETED &&
        isOverdue(task.dueDate)
      )
    }

    return {
      success: true,
      data: tasks.map((task) => ({
        id: task.id,
        messageId: task.messageId,
        chatId: task.message.chatId,
        title: task.title,
        ownerId: task.ownerId,
        owner: task.owner,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        isRecurring: task.isRecurring,
        recurringRule: task.recurringRule,
        tags: task.tags,
        sopInstructions: task.sopInstructions,
        approvalRequired: task.approvalRequired,
        steps: task.steps,
        proofCount: task._count.proofs,
        createdById: task.createdById,
        createdBy: task.createdBy,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
        approvedAt: task.approvedAt,
        isOverdue: isOverdue(task.dueDate) &&
          task.status !== TaskStatus.APPROVED &&
          task.status !== TaskStatus.COMPLETED,
      })),
    }
  })

  /**
   * GET /api/tasks/:id - Get task details
   */
  fastify.get('/:id', {
    preHandler: [authenticate],
  }, async (request) => {
    const { id } = taskIdParamsSchema.parse(request.params)
    const userId = request.user.id

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            phone: true,
            name: true,
            avatarUrl: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        message: {
          select: {
            chatId: true,
            content: true,
            type: true,
          },
        },
        steps: {
          orderBy: { order: 'asc' },
        },
        proofs: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!task) {
      throw new NotFoundError('Task')
    }

    // Check if user is a member of the chat
    const memberRole = await getChatMemberRole(userId, task.message.chatId)
    if (!memberRole) {
      throw new ForbiddenError('You are not a member of this chat')
    }

    return {
      success: true,
      data: {
        id: task.id,
        messageId: task.messageId,
        chatId: task.message.chatId,
        messageContent: task.message.content,
        title: task.title,
        ownerId: task.ownerId,
        owner: task.owner,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        isRecurring: task.isRecurring,
        recurringRule: task.recurringRule,
        tags: task.tags,
        sopInstructions: task.sopInstructions,
        approvalRequired: task.approvalRequired,
        steps: task.steps,
        proofs: task.proofs,
        activities: task.activities,
        createdById: task.createdById,
        createdBy: task.createdBy,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
        approvedAt: task.approvedAt,
        isOverdue: isOverdue(task.dueDate) &&
          task.status !== TaskStatus.APPROVED &&
          task.status !== TaskStatus.COMPLETED,
      },
    }
  })

  /**
   * PATCH /api/tasks/:id/status - Update task status
   * - IN_PROGRESS: owner can set
   * - COMPLETED: owner can set (after completing mandatory steps)
   * - APPROVED/REOPENED: group admin (OWNER/ADMIN) can set
   */
  fastify.patch('/:id/status', {
    preHandler: [authenticate],
  }, async (request) => {
    const { id } = taskIdParamsSchema.parse(request.params)
    const { status: newStatus } = updateStatusSchema.parse(request.body)
    const userId = request.user.id

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        message: { select: { chatId: true } },
        steps: true,
      },
    })

    if (!task) {
      throw new NotFoundError('Task')
    }

    // Get user's role in the chat
    const memberRole = await getChatMemberRole(userId, task.message.chatId)
    if (!memberRole) {
      throw new ForbiddenError('You are not a member of this chat')
    }

    const isOwner = task.ownerId === userId
    const isGroupAdmin = memberRole === ChatMemberRole.OWNER || memberRole === ChatMemberRole.ADMIN

    // COMPLETED can only be set by task owner
    if (newStatus === TaskStatus.COMPLETED && !isOwner) {
      throw new ForbiddenError('Only the task owner can mark it as completed')
    }

    // APPROVED and REOPENED can only be set by group admin
    if ((newStatus === TaskStatus.APPROVED || newStatus === TaskStatus.REOPENED) && !isGroupAdmin) {
      throw new ForbiddenError('Only group admins can approve or reopen tasks')
    }

    // IN_PROGRESS can be set by task owner or group admin
    if (newStatus === TaskStatus.IN_PROGRESS && !isOwner && !isGroupAdmin) {
      throw new ForbiddenError('You do not have permission to update this task')
    }

    // Check if transition is allowed
    if (!canTransitionTo(task.status as TaskStatus, newStatus)) {
      throw new ValidationError(
        `Cannot transition from ${task.status} to ${newStatus}`
      )
    }

    // If completing, check all mandatory steps
    if (newStatus === TaskStatus.COMPLETED) {
      const incompleteMandatory = task.steps.filter(
        (s) => s.isMandatory && !s.completedAt
      )
      if (incompleteMandatory.length > 0) {
        throw new ValidationError(
          `Complete all mandatory steps before marking as completed. Missing: ${incompleteMandatory.map((s) => s.content).join(', ')}`
        )
      }
    }

    // Update task
    const updatedTask = await prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id },
        data: {
          status: newStatus,
          ...(newStatus === TaskStatus.COMPLETED && { completedAt: new Date() }),
          ...(newStatus === TaskStatus.APPROVED && { approvedAt: new Date() }),
          ...(newStatus === TaskStatus.REOPENED && { completedAt: null }),
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          steps: { orderBy: { order: 'asc' } },
        },
      })

      // Create activity
      await tx.taskActivity.create({
        data: {
          taskId: id,
          userId,
          action: newStatus === TaskStatus.APPROVED ? 'APPROVED' :
                  newStatus === TaskStatus.REOPENED ? 'REOPENED' : 'STATUS_CHANGED',
          details: { from: task.status, to: newStatus },
        },
      })

      return updated
    })

    // Emit socket event
    fastify.io.to(`chat:${task.message.chatId}`).emit('task_status_changed', {
      chatId: task.message.chatId,
      task: {
        id: updatedTask.id,
        messageId: updatedTask.messageId,
        status: updatedTask.status,
        completedAt: updatedTask.completedAt,
        approvedAt: updatedTask.approvedAt,
      },
    })

    return {
      success: true,
      data: updatedTask,
    }
  })

  /**
   * POST /api/tasks/:id/steps/:stepId/complete - Mark step as completed
   */
  fastify.post('/:id/steps/:stepId/complete', {
    preHandler: [authenticate],
  }, async (request) => {
    const { id, stepId } = stepIdParamsSchema.parse(request.params)
    const userId = request.user.id

    const task = await prisma.task.findUnique({
      where: { id },
    })

    if (!task) {
      throw new NotFoundError('Task')
    }

    // Only owner can complete steps
    if (task.ownerId !== userId) {
      throw new ForbiddenError('Only the task owner can complete steps')
    }

    const step = await prisma.taskStep.update({
      where: { id: stepId },
      data: {
        completedAt: new Date(),
        completedById: userId,
      },
    })

    // Create activity
    await prisma.taskActivity.create({
      data: {
        taskId: id,
        userId,
        action: 'STEP_COMPLETED',
        details: { stepId, stepContent: step.content },
      },
    })

    return {
      success: true,
      data: step,
    }
  })

  /**
   * POST /api/tasks/:id/proof - Upload proof for task
   */
  fastify.post('/:id/proof', {
    preHandler: [authenticate],
  }, async (request) => {
    const { id } = taskIdParamsSchema.parse(request.params)
    const body = uploadProofSchema.parse(request.body)
    const userId = request.user.id

    const task = await prisma.task.findUnique({
      where: { id },
      include: { message: { select: { chatId: true } } },
    })

    if (!task) {
      throw new NotFoundError('Task')
    }

    // Verify user is member of chat
    const memberRole = await getChatMemberRole(userId, task.message.chatId)
    if (!memberRole) {
      throw new ForbiddenError('You are not a member of this chat')
    }

    // Create proof
    const proof = await prisma.taskProof.create({
      data: {
        taskId: id,
        stepId: body.stepId || null,
        userId,
        type: body.type as any,
        url: body.url,
        note: body.note || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Create activity
    await prisma.taskActivity.create({
      data: {
        taskId: id,
        userId,
        action: 'PROOF_UPLOADED',
        details: { proofId: proof.id, stepId: body.stepId },
      },
    })

    return {
      success: true,
      data: proof,
    }
  })

  /**
   * POST /api/tasks/:id/approve - Approve a completed task (group admin only)
   */
  fastify.post('/:id/approve', {
    preHandler: [authenticate],
  }, async (request) => {
    const { id } = taskIdParamsSchema.parse(request.params)
    const userId = request.user.id

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        message: { select: { chatId: true } },
        steps: true,
      },
    })

    if (!task) {
      throw new NotFoundError('Task')
    }

    // Check if user is group admin
    const memberRole = await getChatMemberRole(userId, task.message.chatId)
    if (!memberRole || (memberRole !== ChatMemberRole.OWNER && memberRole !== ChatMemberRole.ADMIN)) {
      throw new ForbiddenError('Only group admins can approve tasks')
    }

    // Check if task is completed
    if (task.status !== TaskStatus.COMPLETED) {
      throw new ValidationError('Can only approve completed tasks')
    }

    // Update task
    const updatedTask = await prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id },
        data: {
          status: TaskStatus.APPROVED,
          approvedAt: new Date(),
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          steps: { orderBy: { order: 'asc' } },
        },
      })

      // Create activity
      await tx.taskActivity.create({
        data: {
          taskId: id,
          userId,
          action: 'APPROVED',
          details: { from: task.status, to: TaskStatus.APPROVED },
        },
      })

      return updated
    })

    // Emit socket event
    fastify.io.to(`chat:${task.message.chatId}`).emit('task_status_changed', {
      chatId: task.message.chatId,
      task: {
        id: updatedTask.id,
        messageId: updatedTask.messageId,
        status: updatedTask.status,
        completedAt: updatedTask.completedAt,
        approvedAt: updatedTask.approvedAt,
      },
    })

    return {
      success: true,
      data: updatedTask,
    }
  })

  /**
   * POST /api/tasks/:id/reopen - Reopen a task (group admin only)
   */
  fastify.post('/:id/reopen', {
    preHandler: [authenticate],
  }, async (request) => {
    const { id } = taskIdParamsSchema.parse(request.params)
    const userId = request.user.id

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        message: { select: { chatId: true } },
      },
    })

    if (!task) {
      throw new NotFoundError('Task')
    }

    // Check if user is group admin
    const memberRole = await getChatMemberRole(userId, task.message.chatId)
    if (!memberRole || (memberRole !== ChatMemberRole.OWNER && memberRole !== ChatMemberRole.ADMIN)) {
      throw new ForbiddenError('Only group admins can reopen tasks')
    }

    // Check if task is completed
    if (task.status !== TaskStatus.COMPLETED) {
      throw new ValidationError('Can only reopen completed tasks')
    }

    // Update task
    const updatedTask = await prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id },
        data: {
          status: TaskStatus.REOPENED,
          completedAt: null,
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          steps: { orderBy: { order: 'asc' } },
        },
      })

      // Create activity
      await tx.taskActivity.create({
        data: {
          taskId: id,
          userId,
          action: 'REOPENED',
          details: { from: task.status, to: TaskStatus.REOPENED },
        },
      })

      return updated
    })

    // Emit socket event
    fastify.io.to(`chat:${task.message.chatId}`).emit('task_status_changed', {
      chatId: task.message.chatId,
      task: {
        id: updatedTask.id,
        messageId: updatedTask.messageId,
        status: updatedTask.status,
        completedAt: updatedTask.completedAt,
        approvedAt: updatedTask.approvedAt,
      },
    })

    return {
      success: true,
      data: updatedTask,
    }
  })
}
