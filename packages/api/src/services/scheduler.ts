import cron, { ScheduledTask } from 'node-cron'
import { prisma } from '@workchat/database'
import { Server as SocketServer } from 'socket.io'

const tasks: ScheduledTask[] = []

/**
 * Determine if a recurring task needs a new instance based on its rule.
 * Returns true if the time since last creation exceeds the interval.
 */
function needsNewInstance(recurringRule: string, lastCreatedAt: Date): boolean {
  const now = new Date()
  const diffMs = now.getTime() - lastCreatedAt.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)

  switch (recurringRule.toUpperCase()) {
    case 'DAILY':
      return diffHours >= 24
    case 'WEEKLY':
      return diffHours >= 24 * 7
    case 'MONTHLY':
      return diffHours >= 24 * 30
    default:
      return false
  }
}

/**
 * Recurring Task Job - runs daily at midnight.
 * For each recurring task, checks if a new instance should be created
 * and creates one with the same configuration in the same chat.
 */
async function processRecurringTasks(io: SocketServer): Promise<void> {
  console.log('[Scheduler] Running recurring task job...')

  try {
    const recurringTasks = await prisma.task.findMany({
      where: {
        isRecurring: true,
        recurringRule: { not: null },
      },
      include: {
        message: {
          select: {
            chatId: true,
            senderId: true,
            content: true,
          },
        },
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    })

    for (const task of recurringTasks) {
      if (!task.recurringRule) continue

      // Find the most recent instance of this recurring task (by title + owner + chat)
      const latestInstance = await prisma.task.findFirst({
        where: {
          title: task.title,
          ownerId: task.ownerId,
          message: { chatId: task.message.chatId },
        },
        orderBy: { createdAt: 'desc' },
      })

      const referenceDate = latestInstance?.createdAt ?? task.createdAt
      if (!needsNewInstance(task.recurringRule, referenceDate)) {
        continue
      }

      // Create a new message in the chat for the recurring task
      const newMessage = await prisma.message.create({
        data: {
          chatId: task.message.chatId,
          senderId: task.message.senderId,
          content: `[Recurring] ${task.title}`,
          type: 'TEXT',
          isTask: true,
        },
        include: {
          sender: {
            select: {
              id: true,
              phone: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      })

      // Create the new task instance
      const newTask = await prisma.task.create({
        data: {
          messageId: newMessage.id,
          title: task.title,
          ownerId: task.ownerId,
          priority: task.priority,
          dueDate: task.dueDate ? computeNextDueDate(task.recurringRule, task.dueDate) : null,
          isRecurring: true,
          recurringRule: task.recurringRule,
          tags: task.tags,
          sopInstructions: task.sopInstructions,
          approvalRequired: task.approvalRequired,
          createdById: task.createdById,
          steps: task.steps.length > 0
            ? {
                createMany: {
                  data: task.steps.map((step) => ({
                    order: step.order,
                    content: step.content,
                    isMandatory: step.isMandatory,
                    proofRequired: step.proofRequired,
                  })),
                },
              }
            : undefined,
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

      // Create activity record
      await prisma.taskActivity.create({
        data: {
          taskId: newTask.id,
          userId: task.createdById,
          action: 'CREATED',
          details: { title: newTask.title, recurring: true, sourceTaskId: task.id },
        },
      })

      // Update chat's updatedAt
      await prisma.chat.update({
        where: { id: task.message.chatId },
        data: { updatedAt: new Date() },
      })

      // Emit socket events
      io.to(`chat:${task.message.chatId}`).emit('new_message', {
        chatId: task.message.chatId,
        message: {
          id: newMessage.id,
          chatId: newMessage.chatId,
          senderId: newMessage.senderId,
          sender: newMessage.sender,
          content: newMessage.content,
          type: newMessage.type,
          fileUrl: newMessage.fileUrl,
          replyToId: newMessage.replyToId,
          replyTo: null,
          isTask: true,
          task: newTask,
          createdAt: newMessage.createdAt,
        },
      })

      io.to(`chat:${task.message.chatId}`).emit('task_created', {
        chatId: task.message.chatId,
        task: newTask,
      })

      console.log(`[Scheduler] Created recurring task instance: "${newTask.title}" (${newTask.id})`)
    }

    console.log('[Scheduler] Recurring task job completed.')
  } catch (error) {
    console.error('[Scheduler] Error processing recurring tasks:', error)
  }
}

/**
 * Compute next due date based on the recurring rule and the original due date.
 */
function computeNextDueDate(rule: string, originalDueDate: Date): Date {
  const next = new Date(originalDueDate)
  switch (rule.toUpperCase()) {
    case 'DAILY':
      next.setDate(next.getDate() + 1)
      break
    case 'WEEKLY':
      next.setDate(next.getDate() + 7)
      break
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1)
      break
  }
  // If the computed date is in the past, set it relative to now
  const now = new Date()
  if (next < now) {
    const freshNext = new Date(now)
    switch (rule.toUpperCase()) {
      case 'DAILY':
        freshNext.setDate(freshNext.getDate() + 1)
        break
      case 'WEEKLY':
        freshNext.setDate(freshNext.getDate() + 7)
        break
      case 'MONTHLY':
        freshNext.setMonth(freshNext.getMonth() + 1)
        break
    }
    return freshNext
  }
  return next
}

/**
 * Daily Summary Job - runs at 8:00 AM.
 * Compiles task summaries per chat and emits to admin users.
 */
async function generateDailySummary(io: SocketServer): Promise<void> {
  console.log('[Scheduler] Running daily summary job...')

  try {
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Get all chats that have tasks
    const chatsWithTasks = await prisma.chat.findMany({
      where: {
        messages: {
          some: { isTask: true },
        },
      },
      select: { id: true, name: true },
    })

    for (const chat of chatsWithTasks) {
      // Pending tasks per user
      const pendingTasks = await prisma.task.findMany({
        where: {
          message: { chatId: chat.id },
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
        include: {
          owner: { select: { id: true, name: true } },
        },
      })

      // Overdue tasks per user
      const overdueTasks = await prisma.task.findMany({
        where: {
          message: { chatId: chat.id },
          status: { notIn: ['APPROVED', 'COMPLETED'] },
          dueDate: { lt: now },
        },
        include: {
          owner: { select: { id: true, name: true } },
        },
      })

      // Reopened tasks
      const reopenedTasks = await prisma.task.findMany({
        where: {
          message: { chatId: chat.id },
          status: 'REOPENED',
        },
        include: {
          owner: { select: { id: true, name: true } },
        },
      })

      // Users with no activity in last 24h
      const chatMembers = await prisma.chatMember.findMany({
        where: { chatId: chat.id },
        select: { userId: true, user: { select: { id: true, name: true } } },
      })

      const activeUserIds = await prisma.taskActivity.findMany({
        where: {
          task: { message: { chatId: chat.id } },
          createdAt: { gte: twentyFourHoursAgo },
        },
        select: { userId: true },
        distinct: ['userId'],
      })

      const activeSet = new Set(activeUserIds.map((a) => a.userId))
      const inactiveUsers = chatMembers
        .filter((m) => !activeSet.has(m.userId))
        .map((m) => m.user)

      // Group by user
      const pendingByUser: Record<string, { name: string; count: number }> = {}
      for (const t of pendingTasks) {
        if (!pendingByUser[t.ownerId]) {
          pendingByUser[t.ownerId] = { name: t.owner.name, count: 0 }
        }
        pendingByUser[t.ownerId]!.count++
      }

      const overdueByUser: Record<string, { name: string; count: number }> = {}
      for (const t of overdueTasks) {
        if (!overdueByUser[t.ownerId]) {
          overdueByUser[t.ownerId] = { name: t.owner.name, count: 0 }
        }
        overdueByUser[t.ownerId]!.count++
      }

      const summary = {
        chatId: chat.id,
        chatName: chat.name,
        date: now.toISOString(),
        pendingByUser,
        overdueByUser,
        reopenedTasks: reopenedTasks.map((t) => ({
          id: t.id,
          title: t.title,
          ownerName: t.owner.name,
        })),
        inactiveUsers,
        totalPending: pendingTasks.length,
        totalOverdue: overdueTasks.length,
        totalReopened: reopenedTasks.length,
      }

      // Find admin/owner members of this chat to emit the summary to
      const adminMembers = await prisma.chatMember.findMany({
        where: {
          chatId: chat.id,
          role: { in: ['OWNER', 'ADMIN'] },
        },
        select: { userId: true },
      })

      // Emit summary to each admin user's personal room
      for (const admin of adminMembers) {
        io.to(`user:${admin.userId}`).emit('daily_summary', summary)
      }

      console.log(`[Scheduler] Daily summary for chat "${chat.name}": ${pendingTasks.length} pending, ${overdueTasks.length} overdue, ${reopenedTasks.length} reopened`)
    }

    console.log('[Scheduler] Daily summary job completed.')
  } catch (error) {
    console.error('[Scheduler] Error generating daily summary:', error)
  }
}

/**
 * Start all scheduled cron jobs.
 */
export function startScheduler(io: SocketServer): void {
  console.log('[Scheduler] Starting cron jobs...')

  // Recurring task job - runs daily at midnight
  const recurringJob = cron.schedule('0 0 * * *', () => {
    processRecurringTasks(io)
  })
  tasks.push(recurringJob)

  // Daily summary job - runs at 8:00 AM
  const summaryJob = cron.schedule('0 8 * * *', () => {
    generateDailySummary(io)
  })
  tasks.push(summaryJob)

  console.log('[Scheduler] Cron jobs started: recurring tasks (midnight), daily summary (8:00 AM)')
}

/**
 * Stop all scheduled cron jobs gracefully.
 */
export function stopScheduler(): void {
  console.log('[Scheduler] Stopping cron jobs...')
  for (const task of tasks) {
    task.stop()
  }
  tasks.length = 0
  console.log('[Scheduler] All cron jobs stopped.')
}
