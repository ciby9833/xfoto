/**
 * src/config/storage.js
 *
 * File storage abstraction — local disk (dev) or S3/R2 (production).
 * All code that reads/writes files goes through this module so switching
 * storage backends requires changing only the env var STORAGE_DRIVER.
 *
 * API:
 *   storage.save(key, buffer, mimeType)  → void
 *   storage.publicUrl(key)               → string  (permanent public URL)
 *   storage.signedUrl(key, ttlSeconds)   → string  (time-limited download URL)
 *   storage.delete(key)                  → void
 *
 * Upstream : .env STORAGE_DRIVER, S3_* variables
 * Downstream: StorageService, routes/frames.js, routes/downloads.js
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand }
  from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { env } from './env.js'

const __dir = dirname(fileURLToPath(import.meta.url))
const LOCAL_DIR = join(__dir, '../../uploads')

// ── Local driver ─────────────────────────────────────────────────────────────
const local = {
  async save(key, buffer) {
    const dest = join(LOCAL_DIR, key)
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, buffer)
  },
  publicUrl(key) {
    // In dev, Express serves /uploads/* statically
    return `/uploads/${key}`
  },
  async signedUrl(key, _ttl) {
    return `/uploads/${key}`   // No expiry in dev
  },
  async delete(key) {
    const dest = join(LOCAL_DIR, key)
    if (existsSync(dest)) unlinkSync(dest)
  }
}

// ── S3/R2 driver ──────────────────────────────────────────────────────────────
let s3Client = null
function getS3() {
  if (!s3Client) {
    s3Client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      credentials: {
        accessKeyId:     env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY
      }
    })
  }
  return s3Client
}

const s3 = {
  async save(key, buffer, mimeType = 'application/octet-stream') {
    await getS3().send(new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key:    key,
      Body:   buffer,
      ContentType: mimeType
    }))
  },
  publicUrl(key) {
    return `${env.S3_PUBLIC_BASE_URL}/${key}`
  },
  async signedUrl(key, ttlSeconds = 86400) {
    return getSignedUrl(getS3(), new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key:    key
    }), { expiresIn: ttlSeconds })
  },
  async delete(key) {
    await getS3().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }))
  }
}

export const storage = env.STORAGE_DRIVER === 's3' ? s3 : local
