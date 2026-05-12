/**
 * src/index.js
 *
 * xfoto backend — Express server entry point.
 *
 * Route tree:
 *   /api/devices/*    — device registration + config
 *   /api/frames/*     — frame template management
 *   /api/payments/*   — payment creation + polling + webhooks
 *   /api/coupons/*    — coupon validation + admin CRUD
 *   /api/orders/*     — order status + photo upload + download code
 *   /api/downloads/*  — download code resolution (QR scan target)
 *   /uploads/*        — static file serving in local-storage dev mode
 *   /health           — health check
 *
 * Upstream : process.env (via src/config/env.js)
 * Downstream: all route modules, DB pool, storage driver
 */

import express   from 'express'
import cors      from 'cors'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { env }            from './config/env.js'
import { testConnection } from './config/db.js'
import { errorHandler }   from './middleware/errorHandler.js'
import devicesRouter   from './routes/devices.js'
import framesRouter    from './routes/frames.js'
import paymentsRouter  from './routes/payments.js'
import couponsRouter   from './routes/coupons.js'
import ordersRouter    from './routes/orders.js'
import downloadsRouter from './routes/downloads.js'

const __dir = dirname(fileURLToPath(import.meta.url))
const app   = express()

// ── Global middleware ─────────────────────────────────────────────────────────
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Serve uploaded files in dev (in production, S3/R2 serves them directly)
if (env.STORAGE_DRIVER === 'local') {
  app.use('/uploads', express.static(join(__dir, '../uploads')))
  console.log('[server] local storage: serving /uploads statically')
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/devices',   devicesRouter)
app.use('/api/frames',    framesRouter)
app.use('/api/payments',  paymentsRouter)
app.use('/api/coupons',   couponsRouter)
app.use('/api/orders',    ordersRouter)
app.use('/api/downloads', downloadsRouter)

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({
  status: 'ok',
  env:    env.NODE_ENV,
  storage: env.STORAGE_DRIVER,
  payment: env.PAYMENT_DRIVER
}))

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

// ── Error handler (must be last) ──────────────────────────────────────────────
app.use(errorHandler)

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  await testConnection()
  app.listen(env.PORT, () => {
    console.log(`[server] xfoto backend running on http://localhost:${env.PORT}`)
    console.log(`[server] env=${env.NODE_ENV} | storage=${env.STORAGE_DRIVER} | payment=${env.PAYMENT_DRIVER}`)
  })
}

start().catch((err) => {
  console.error('[server] startup failed:', err.message)
  process.exit(1)
})
