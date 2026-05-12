/**
 * src/config/env.js
 *
 * Centralised environment variable access.
 * Throws on startup if required variables are missing so errors appear early.
 *
 * Upstream : .env file loaded by dotenv in src/index.js
 * Downstream: every module that needs config values imports from here
 */

import 'dotenv/config'

function require_(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env variable: ${name}`)
  return v
}

export const env = {
  NODE_ENV:       process.env.NODE_ENV ?? 'development',
  PORT:           parseInt(process.env.PORT ?? '3000', 10),
  DATABASE_URL:   require_('DATABASE_URL'),
  JWT_SECRET:     require_('JWT_SECRET'),

  // Storage: 'local' (dev) or 's3' (production)
  STORAGE_DRIVER: process.env.STORAGE_DRIVER ?? 'local',
  S3_ENDPOINT:    process.env.S3_ENDPOINT,
  S3_REGION:      process.env.S3_REGION ?? 'auto',
  S3_BUCKET:      process.env.S3_BUCKET,
  S3_ACCESS_KEY_ID:     process.env.S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
  S3_PUBLIC_BASE_URL:   process.env.S3_PUBLIC_BASE_URL,

  // Payment: 'mock' | 'xendit' | 'midtrans'
  PAYMENT_DRIVER: process.env.PAYMENT_DRIVER ?? 'mock',
  XENDIT_SECRET_KEY:    process.env.XENDIT_SECRET_KEY,
  MIDTRANS_SERVER_KEY:  process.env.MIDTRANS_SERVER_KEY,
  MIDTRANS_IS_PRODUCTION: process.env.MIDTRANS_IS_PRODUCTION === 'true',

  // Download codes
  DOWNLOAD_CODE_TTL_HOURS: parseInt(process.env.DOWNLOAD_CODE_TTL_HOURS ?? '24', 10)
}
