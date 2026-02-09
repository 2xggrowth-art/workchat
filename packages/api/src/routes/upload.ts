import { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../middleware/auth'
import { extname } from 'path'
import {
  uploadFile,
  getFileUrl,
  useS3,
  getLocalFilePath,
  getLocalFileStream,
  getLocalFileStat,
} from '../services/storage'

// Allowed upload mime types
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/mp4', 'audio/x-m4a',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

// Max file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024

// Simple mime type lookup
const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.aac': 'audio/aac',
  '.m4a': 'audio/x-m4a',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

function getMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase()
  return MIME_TYPES[ext] || 'application/octet-stream'
}

export const uploadRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/upload - Upload a file
   * Uploads to MinIO S3 if configured, otherwise falls back to local filesystem.
   */
  fastify.post('/', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const data = await request.file()

    if (!data) {
      return reply.status(400).send({
        success: false,
        error: { code: 'NO_FILE', message: 'No file uploaded' },
      })
    }

    // Read file into buffer
    const chunks: Buffer[] = []
    for await (const chunk of data.file) {
      chunks.push(chunk as Buffer)
    }
    const buffer = Buffer.concat(chunks)

    if (buffer.length === 0) {
      return reply.status(400).send({
        success: false,
        error: { code: 'EMPTY_FILE', message: 'Uploaded file is empty' },
      })
    }

    if (buffer.length > MAX_FILE_SIZE) {
      return reply.status(400).send({
        success: false,
        error: { code: 'FILE_TOO_LARGE', message: 'File exceeds maximum size of 50MB' },
      })
    }

    const contentType = data.mimetype || getMimeType(data.filename)

    if (!ALLOWED_MIME_TYPES.has(contentType)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_FILE_TYPE', message: `File type '${contentType}' is not allowed` },
      })
    }

    const { key } = await uploadFile(buffer, data.filename, contentType)
    const fileUrl = await getFileUrl(key)

    return {
      success: true,
      data: {
        key,
        filename: data.filename,
        originalName: data.filename,
        mimetype: contentType,
        url: fileUrl,
      },
    }
  })

  /**
   * GET /api/upload/file/:key - Get file URL or serve file
   * For S3: redirects to a presigned URL
   * For local: serves the file directly
   */
  fastify.get('/file/*', async (request, reply) => {
    const { '*': key } = request.params as { '*': string }

    if (!key) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_KEY', message: 'File key is required' },
      })
    }

    // Prevent directory traversal
    if (key.includes('..')) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_KEY', message: 'Invalid file key' },
      })
    }

    if (useS3) {
      const url = await getFileUrl(key)
      return reply.redirect(302, url)
    }

    // Local fallback: serve file from disk
    const filepath = getLocalFilePath(key)
    if (!filepath) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'File not found' },
      })
    }

    const stat = getLocalFileStat(filepath)
    const mimeType = getMimeType(key)

    reply.header('Content-Type', mimeType)
    reply.header('Content-Length', stat.size)
    reply.header('Cache-Control', 'public, max-age=31536000')

    return reply.send(getLocalFileStream(filepath))
  })

  /**
   * GET /api/upload/url/:key - Get presigned URL for a file
   * Returns JSON with the URL instead of redirecting
   */
  fastify.get('/url/*', async (request, reply) => {
    const { '*': key } = request.params as { '*': string }

    if (!key) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_KEY', message: 'File key is required' },
      })
    }

    if (key.includes('..')) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_KEY', message: 'Invalid file key' },
      })
    }

    const url = await getFileUrl(key)

    return {
      success: true,
      data: { url },
    }
  })

  /**
   * Legacy: GET /api/upload/:filename - Serve uploaded file (backward compat for old local uploads)
   */
  fastify.get('/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string }

    // Prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_FILENAME', message: 'Invalid filename' },
      })
    }

    // Try to find in local uploads root (legacy flat structure)
    const filepath = getLocalFilePath(filename)
    if (!filepath) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'File not found' },
      })
    }

    const stat = getLocalFileStat(filepath)
    const mimeType = getMimeType(filename)

    reply.header('Content-Type', mimeType)
    reply.header('Content-Length', stat.size)
    reply.header('Cache-Control', 'public, max-age=31536000')

    return reply.send(getLocalFileStream(filepath))
  })
}
