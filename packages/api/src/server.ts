import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import crypto from 'crypto'
import { Server as SocketServer } from 'socket.io'

import { authRoutes } from './routes/auth'
import { userRoutes } from './routes/users'
import { chatRoutes } from './routes/chats'
import { messageRoutes } from './routes/messages'
import { taskRoutes } from './routes/tasks'
import { uploadRoutes } from './routes/upload'
import { orgRoutes } from './routes/org'
import { setupSocketHandlers } from './socket'
import { errorHandler } from './middleware/errorHandler'
import { startScheduler, stopScheduler } from './services/scheduler'
import { execSync } from 'child_process'

const PORT = parseInt(process.env.PORT || '3000', 10)
const HOST = process.env.HOST || '0.0.0.0'
const corsOrigins = process.env.NODE_ENV === 'production'
  ? (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(s => s.trim())
  : [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5177',
    ]

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  })

  // Register plugins
  await fastify.register(cors, {
    origin: corsOrigins,
    credentials: true,
  })

  await fastify.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })

  await fastify.register(cookie)

  const jwtSecret = process.env.JWT_SECRET
    || (process.env.NODE_ENV === 'production'
      ? (() => { throw new Error('JWT_SECRET environment variable is required in production') })()
      : crypto.randomBytes(32).toString('hex'))

  await fastify.register(jwt, {
    secret: jwtSecret,
    sign: {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    },
  })

  await fastify.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB max
    },
  })

  if (process.env.NODE_ENV === 'production') {
    await fastify.register(rateLimit, {
      max: 200,
      timeWindow: '1 minute',
      keyGenerator: (request) => {
        if (request.url?.includes('/api/auth/') && request.body) {
          const body = request.body as { phone?: string }
          if (body.phone) {
            return `phone:${body.phone}`
          }
        }
        return request.ip
      },
    })
  }

  // Global error handler
  fastify.setErrorHandler(errorHandler)

  // Health check
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  // Register routes
  await fastify.register(authRoutes, { prefix: '/api/auth' })
  await fastify.register(userRoutes, { prefix: '/api/users' })
  await fastify.register(chatRoutes, { prefix: '/api/chats' })
  await fastify.register(messageRoutes, { prefix: '/api' })  // Routes already have /chats/:id/messages paths
  await fastify.register(taskRoutes, { prefix: '/api/tasks' })
  await fastify.register(uploadRoutes, { prefix: '/api/upload' })
  await fastify.register(orgRoutes, { prefix: '/api/org' })

  return fastify
}

async function runMigrations() {
  try {
    console.log('Running Prisma migrations...')
    execSync('npx prisma migrate deploy', {
      cwd: '/app/packages/database',
      stdio: 'inherit',
      timeout: 30000,
    })
    console.log('Migrations completed.')

    if (process.env.SEED_DB === 'true') {
      console.log('Seeding database...')
      execSync('npx prisma db seed', {
        cwd: '/app/packages/database',
        stdio: 'inherit',
        timeout: 60000,
      })
      console.log('Seeding completed.')
    }
  } catch (err) {
    console.error('Migration/seed failed:', err)
    // Don't crash — server might still work with existing schema
  }
}

async function start() {
  // Run migrations before starting server (production only)
  if (process.env.NODE_ENV === 'production') {
    await runMigrations()
  }

  const fastify = await buildServer()

  // Setup Socket.io with Fastify's server
  const io = new SocketServer(fastify.server, {
    cors: {
      origin: corsOrigins,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  })

  // Attach io to fastify for use in routes
  fastify.decorate('io', io)

  // Setup socket handlers
  setupSocketHandlers(io, fastify)

  try {
    await fastify.listen({ port: PORT, host: HOST })
    // Start cron scheduler after server is listening
    startScheduler(io)

    console.log(`
╔════════════════════════════════════════════╗
║         WorkChat API Server                ║
╠════════════════════════════════════════════╣
║  🚀 Server running on http://${HOST}:${PORT}    ║
║  📡 WebSocket ready                        ║
║  ⏰ Scheduler active                       ║
║  🌍 Environment: ${process.env.NODE_ENV || 'development'}           ║
╚════════════════════════════════════════════╝
    `)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...')
  stopScheduler()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...')
  stopScheduler()
  process.exit(0)
})
