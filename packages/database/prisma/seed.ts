import { PrismaClient, UserRole, UserStatus, ChatType, MessageType, TaskStatus, TaskPriority } from '@prisma/client'
import { hash } from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Clean existing data
  await prisma.taskActivity.deleteMany()
  await prisma.taskProof.deleteMany()
  await prisma.taskStep.deleteMany()
  await prisma.task.deleteMany()
  await prisma.messageRead.deleteMany()
  await prisma.message.deleteMany()
  await prisma.chatMember.deleteMany()
  await prisma.chat.deleteMany()
  await prisma.refreshToken.deleteMany()
  await prisma.user.deleteMany()
  await prisma.organization.deleteMany()

  console.log('🧹 Cleaned existing data')

  // Hash PINs
  const pinHash = await hash('1234', 12)
  const superAdminPinHash = await hash('1111', 12)

  // ============================================
  // CREATE ORGANIZATION
  // ============================================

  const org = await prisma.organization.create({
    data: {
      name: 'Demo Company',
      orgCode: 'WRK-1234',
    },
  })
  console.log('🏢 Created Organization:', org.name, `(Code: ${org.orgCode})`)

  // ============================================
  // CREATE USERS
  // ============================================

  const superAdmin = await prisma.user.create({
    data: {
      phone: '+918660310636',
      password: superAdminPinHash,
      name: 'Arsalan',
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      orgId: org.id,
    },
  })
  console.log('👑 Created Super Admin:', superAdmin.name)

  const admin1 = await prisma.user.create({
    data: {
      phone: '+9999999998',
      password: pinHash,
      name: 'Rajesh Kumar',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      orgId: org.id,
    },
  })

  const admin2 = await prisma.user.create({
    data: {
      phone: '+9999999997',
      password: pinHash,
      name: 'Priya Sharma',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      orgId: org.id,
    },
  })
  console.log('👔 Created 2 Admins')

  const staff1 = await prisma.user.create({
    data: {
      phone: '+9999999996',
      password: pinHash,
      name: 'Amit Patel',
      role: UserRole.STAFF,
      status: UserStatus.ACTIVE,
      approvedBy: admin1.id,
      orgId: org.id,
    },
  })

  const staff2 = await prisma.user.create({
    data: {
      phone: '+9999999995',
      password: pinHash,
      name: 'Sneha Gupta',
      role: UserRole.STAFF,
      status: UserStatus.ACTIVE,
      approvedBy: admin1.id,
      orgId: org.id,
    },
  })

  const staff3 = await prisma.user.create({
    data: {
      phone: '+9999999994',
      password: pinHash,
      name: 'Rahul Singh',
      role: UserRole.STAFF,
      status: UserStatus.ACTIVE,
      approvedBy: admin2.id,
      orgId: org.id,
    },
  })

  const staff4 = await prisma.user.create({
    data: {
      phone: '+9999999993',
      password: pinHash,
      name: 'Neha Verma',
      role: UserRole.STAFF,
      status: UserStatus.ACTIVE,
      approvedBy: admin2.id,
      orgId: org.id,
    },
  })

  const staff5 = await prisma.user.create({
    data: {
      phone: '+9999999992',
      password: pinHash,
      name: 'Vikram Joshi',
      role: UserRole.STAFF,
      status: UserStatus.ACTIVE,
      approvedBy: admin2.id,
      orgId: org.id,
    },
  })
  console.log('👷 Created 5 Staff members')

  // ============================================
  // CREATE CHATS
  // ============================================

  // Direct chat: Admin1 <-> Staff1
  const directChat1 = await prisma.chat.create({
    data: {
      type: ChatType.DIRECT,
      name: 'Amit Patel',
      createdBy: admin1.id,
      orgId: org.id,
      members: {
        createMany: {
          data: [
            { userId: admin1.id, role: 'OWNER' },
            { userId: staff1.id, role: 'MEMBER' },
          ],
        },
      },
    },
  })

  // Direct chat: Admin2 <-> Staff2
  const directChat2 = await prisma.chat.create({
    data: {
      type: ChatType.DIRECT,
      name: 'Sneha Gupta',
      createdBy: admin2.id,
      orgId: org.id,
      members: {
        createMany: {
          data: [
            { userId: admin2.id, role: 'OWNER' },
            { userId: staff2.id, role: 'MEMBER' },
          ],
        },
      },
    },
  })

  // Direct chat: Admin1 <-> Staff3
  const directChat3 = await prisma.chat.create({
    data: {
      type: ChatType.DIRECT,
      name: 'Rahul Singh',
      createdBy: admin1.id,
      orgId: org.id,
      members: {
        createMany: {
          data: [
            { userId: admin1.id, role: 'OWNER' },
            { userId: staff3.id, role: 'MEMBER' },
          ],
        },
      },
    },
  })
  console.log('💬 Created 3 Direct chats')

  // Group chat: Operations Team
  const groupChat1 = await prisma.chat.create({
    data: {
      type: ChatType.GROUP,
      name: 'Operations Team',
      createdBy: admin1.id,
      orgId: org.id,
      members: {
        createMany: {
          data: [
            { userId: admin1.id, role: 'OWNER' },
            { userId: admin2.id, role: 'MEMBER' },
            { userId: staff1.id, role: 'MEMBER' },
            { userId: staff2.id, role: 'MEMBER' },
            { userId: staff3.id, role: 'MEMBER' },
          ],
        },
      },
    },
  })

  // Group chat: Warehouse Staff
  const groupChat2 = await prisma.chat.create({
    data: {
      type: ChatType.GROUP,
      name: 'Warehouse Staff',
      createdBy: admin2.id,
      orgId: org.id,
      members: {
        createMany: {
          data: [
            { userId: admin2.id, role: 'OWNER' },
            { userId: staff4.id, role: 'MEMBER' },
            { userId: staff5.id, role: 'MEMBER' },
          ],
        },
      },
    },
  })
  console.log('👥 Created 2 Group chats')

  // ============================================
  // CREATE MESSAGES
  // ============================================

  // Messages in Operations Team group
  const msg1 = await prisma.message.create({
    data: {
      chatId: groupChat1.id,
      senderId: admin1.id,
      content: 'Good morning team! Let\'s discuss today\'s tasks.',
      type: MessageType.TEXT,
    },
  })

  const msg2 = await prisma.message.create({
    data: {
      chatId: groupChat1.id,
      senderId: staff1.id,
      content: 'Good morning sir!',
      type: MessageType.TEXT,
    },
  })

  const msg3 = await prisma.message.create({
    data: {
      chatId: groupChat1.id,
      senderId: admin1.id,
      content: 'Amit, I need you to complete the inventory count for Section A today.',
      type: MessageType.TEXT,
      isTask: true,
    },
  })

  // Create task for msg3
  const task1 = await prisma.task.create({
    data: {
      messageId: msg3.id,
      title: 'Complete inventory count for Section A',
      ownerId: staff1.id,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdById: admin1.id,
      steps: {
        createMany: {
          data: [
            { order: 1, content: 'Count items in Aisle 1', isMandatory: true },
            { order: 2, content: 'Count items in Aisle 2', isMandatory: true },
            { order: 3, content: 'Upload photo of completed count sheet', isMandatory: true, proofRequired: true },
          ],
        },
      },
    },
  })

  await prisma.taskActivity.create({
    data: {
      taskId: task1.id,
      userId: admin1.id,
      action: 'CREATED',
      details: { title: task1.title },
    },
  })

  await prisma.taskActivity.create({
    data: {
      taskId: task1.id,
      userId: staff1.id,
      action: 'STATUS_CHANGED',
      details: { from: 'PENDING', to: 'IN_PROGRESS' },
    },
  })

  const msg4 = await prisma.message.create({
    data: {
      chatId: groupChat1.id,
      senderId: staff1.id,
      content: 'Started working on it, will update soon.',
      type: MessageType.TEXT,
      replyToId: msg3.id,
    },
  })

  // More messages and another task
  const msg5 = await prisma.message.create({
    data: {
      chatId: groupChat1.id,
      senderId: admin1.id,
      content: 'Sneha, please prepare the daily report by 5 PM.',
      type: MessageType.TEXT,
      isTask: true,
    },
  })

  const task2 = await prisma.task.create({
    data: {
      messageId: msg5.id,
      title: 'Prepare daily report',
      ownerId: staff2.id,
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      dueDate: new Date(Date.now() + 8 * 60 * 60 * 1000),
      createdById: admin1.id,
      steps: {
        createMany: {
          data: [
            { order: 1, content: 'Collect data from all departments', isMandatory: true },
            { order: 2, content: 'Create report document', isMandatory: true },
            { order: 3, content: 'Upload report PDF', isMandatory: true, proofRequired: true },
          ],
        },
      },
    },
  })

  await prisma.taskActivity.create({
    data: {
      taskId: task2.id,
      userId: admin1.id,
      action: 'CREATED',
      details: { title: task2.title },
    },
  })

  // Messages in Direct Chat 1
  await prisma.message.create({
    data: {
      chatId: directChat1.id,
      senderId: admin1.id,
      content: 'Hi Amit, how\'s the inventory count going?',
      type: MessageType.TEXT,
    },
  })

  await prisma.message.create({
    data: {
      chatId: directChat1.id,
      senderId: staff1.id,
      content: 'Almost done with Aisle 1, starting Aisle 2 now.',
      type: MessageType.TEXT,
    },
  })

  // Completed task in Warehouse group
  const msg8 = await prisma.message.create({
    data: {
      chatId: groupChat2.id,
      senderId: admin2.id,
      content: 'Neha, please organize the new stock that arrived today.',
      type: MessageType.TEXT,
      isTask: true,
    },
  })

  const task3 = await prisma.task.create({
    data: {
      messageId: msg8.id,
      title: 'Organize new stock',
      ownerId: staff4.id,
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      dueDate: new Date(Date.now() - 2 * 60 * 60 * 1000),
      createdById: admin2.id,
      completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      steps: {
        createMany: {
          data: [
            { order: 1, content: 'Unpack all boxes', isMandatory: true, completedAt: new Date() },
            { order: 2, content: 'Sort by category', isMandatory: true, completedAt: new Date() },
            { order: 3, content: 'Place on designated shelves', isMandatory: true, completedAt: new Date() },
          ],
        },
      },
    },
  })

  await prisma.taskActivity.create({
    data: { taskId: task3.id, userId: admin2.id, action: 'CREATED', details: { title: task3.title } },
  })
  await prisma.taskActivity.create({
    data: { taskId: task3.id, userId: staff4.id, action: 'STATUS_CHANGED', details: { from: 'PENDING', to: 'IN_PROGRESS' } },
  })
  await prisma.taskActivity.create({
    data: { taskId: task3.id, userId: staff4.id, action: 'STATUS_CHANGED', details: { from: 'IN_PROGRESS', to: 'COMPLETED' } },
  })

  // Approved task
  const msg9 = await prisma.message.create({
    data: {
      chatId: groupChat2.id,
      senderId: admin2.id,
      content: 'Vikram, clean the storage area thoroughly.',
      type: MessageType.TEXT,
      isTask: true,
    },
  })

  const task4 = await prisma.task.create({
    data: {
      messageId: msg9.id,
      title: 'Clean storage area',
      ownerId: staff5.id,
      status: TaskStatus.APPROVED,
      priority: TaskPriority.LOW,
      dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      createdById: admin2.id,
      completedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
      approvedAt: new Date(Date.now() - 18 * 60 * 60 * 1000),
      steps: {
        createMany: {
          data: [
            { order: 1, content: 'Sweep the floor', isMandatory: true, completedAt: new Date() },
            { order: 2, content: 'Mop with disinfectant', isMandatory: true, completedAt: new Date() },
            { order: 3, content: 'Take before/after photos', isMandatory: false, proofRequired: true, completedAt: new Date() },
          ],
        },
      },
    },
  })

  const task4Steps = await prisma.taskStep.findMany({ where: { taskId: task4.id } })
  await prisma.taskProof.create({
    data: {
      taskId: task4.id,
      stepId: task4Steps[2].id,
      userId: staff5.id,
      type: MessageType.IMAGE,
      url: 'https://example.com/proof/storage-cleaned.jpg',
      note: 'Storage area after cleaning',
    },
  })

  await prisma.taskActivity.create({
    data: { taskId: task4.id, userId: admin2.id, action: 'CREATED', details: { title: task4.title } },
  })
  await prisma.taskActivity.create({
    data: { taskId: task4.id, userId: staff5.id, action: 'PROOF_UPLOADED', details: { stepId: task4Steps[2].id } },
  })
  await prisma.taskActivity.create({
    data: { taskId: task4.id, userId: staff5.id, action: 'STATUS_CHANGED', details: { from: 'IN_PROGRESS', to: 'COMPLETED' } },
  })
  await prisma.taskActivity.create({
    data: { taskId: task4.id, userId: admin2.id, action: 'APPROVED', details: {} },
  })

  // Reopened task
  const msg10 = await prisma.message.create({
    data: {
      chatId: directChat3.id,
      senderId: admin1.id,
      content: 'Rahul, check and fix the broken shelf in aisle 3.',
      type: MessageType.TEXT,
      isTask: true,
    },
  })

  const task5 = await prisma.task.create({
    data: {
      messageId: msg10.id,
      title: 'Fix broken shelf in aisle 3',
      ownerId: staff3.id,
      status: TaskStatus.REOPENED,
      priority: TaskPriority.URGENT,
      dueDate: new Date(Date.now() + 4 * 60 * 60 * 1000),
      createdById: admin1.id,
      steps: {
        createMany: {
          data: [
            { order: 1, content: 'Assess the damage', isMandatory: true, completedAt: new Date() },
            { order: 2, content: 'Get required materials', isMandatory: true },
            { order: 3, content: 'Fix the shelf', isMandatory: true },
            { order: 4, content: 'Upload photo of fixed shelf', isMandatory: true, proofRequired: true },
          ],
        },
      },
    },
  })

  await prisma.taskActivity.create({
    data: { taskId: task5.id, userId: admin1.id, action: 'CREATED', details: { title: task5.title } },
  })
  await prisma.taskActivity.create({
    data: { taskId: task5.id, userId: admin1.id, action: 'REOPENED', details: { reason: 'Shelf not properly secured, needs re-fixing' } },
  })

  console.log('📝 Created messages and tasks')
  console.log('')
  console.log('✅ Seed completed successfully!')
  console.log('')
  console.log('📋 Summary:')
  console.log(`   - 1 Organization: ${org.name} (Code: ${org.orgCode})`)
  console.log('   - 1 Super Admin (phone: +918660310636)')
  console.log('   - 2 Admins (phones: 9999999998, 9999999997)')
  console.log('   - 5 Staff members (phones: 9999999996 to 9999999992)')
  console.log('   - 3 Direct chats')
  console.log('   - 2 Group chats')
  console.log('   - 5 Tasks (various statuses)')
  console.log('')
  console.log('🔑 Users created with pre-set PINs')
  console.log(`🏢 Org Code: ${org.orgCode}`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
