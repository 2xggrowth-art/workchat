import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import sharp from 'sharp'
import { randomUUID } from 'crypto'
import { extname } from 'path'
import { createWriteStream, mkdirSync, existsSync, createReadStream, statSync, unlinkSync } from 'fs'
import { join } from 'path'

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT
const MINIO_PORT = process.env.MINIO_PORT || '9000'
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin'
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin'
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'workchat'
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true'

const LOCAL_UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

const useS3 = !!MINIO_ENDPOINT

let s3Client: S3Client | null = null

if (useS3) {
  const protocol = MINIO_USE_SSL ? 'https' : 'http'
  s3Client = new S3Client({
    endpoint: `${protocol}://${MINIO_ENDPOINT}:${MINIO_PORT}`,
    region: 'us-east-1',
    credentials: {
      accessKeyId: MINIO_ACCESS_KEY,
      secretAccessKey: MINIO_SECRET_KEY,
    },
    forcePathStyle: true,
  })
}

// Ensure local upload dir exists when using local fallback
if (!useS3 && !existsSync(LOCAL_UPLOAD_DIR)) {
  mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true })
}

function generateKey(originalFilename: string): string {
  const ext = extname(originalFilename).toLowerCase()
  const uuid = randomUUID()
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '/')
  return `${date}/${uuid}${ext}`
}

function isImage(contentType: string): boolean {
  return contentType.startsWith('image/') && !contentType.includes('svg')
}

export async function compressImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer()
}

export async function uploadFile(
  buffer: Buffer,
  originalFilename: string,
  contentType: string
): Promise<{ key: string; url: string }> {
  let fileBuffer = buffer

  // Compress images before upload
  if (isImage(contentType)) {
    try {
      fileBuffer = await compressImage(buffer)
    } catch {
      // If compression fails, use original buffer
      fileBuffer = buffer
    }
  }

  const key = generateKey(originalFilename)

  if (useS3 && s3Client) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: MINIO_BUCKET,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      })
    )

    return { key, url: key }
  }

  // Local fallback
  const dir = join(LOCAL_UPLOAD_DIR, key.substring(0, key.lastIndexOf('/')))
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  const filepath = join(LOCAL_UPLOAD_DIR, key)
  const writeStream = createWriteStream(filepath)
  await new Promise<void>((resolve, reject) => {
    writeStream.write(fileBuffer, (err) => {
      if (err) reject(err)
      else {
        writeStream.end()
        resolve()
      }
    })
  })

  return { key, url: key }
}

export async function getFileUrl(key: string): Promise<string> {
  if (useS3 && s3Client) {
    const command = new GetObjectCommand({
      Bucket: MINIO_BUCKET,
      Key: key,
    })
    return getSignedUrl(s3Client, command, { expiresIn: 3600 })
  }

  // Local fallback: return relative path that the serve route handles
  const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`
  return `${baseUrl}/api/upload/file/${encodeURIComponent(key)}`
}

export async function deleteFile(key: string): Promise<void> {
  if (useS3 && s3Client) {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: MINIO_BUCKET,
        Key: key,
      })
    )
    return
  }

  // Local fallback
  const filepath = join(LOCAL_UPLOAD_DIR, key)
  if (existsSync(filepath)) {
    unlinkSync(filepath)
  }
}

export function getLocalFilePath(key: string): string | null {
  const filepath = join(LOCAL_UPLOAD_DIR, key)
  if (existsSync(filepath)) {
    return filepath
  }
  return null
}

export function getLocalFileStream(filepath: string) {
  return createReadStream(filepath)
}

export function getLocalFileStat(filepath: string) {
  return statSync(filepath)
}

export { useS3 }
