/**
 * src/routes/orders.js
 *
 * POST /api/orders/:id/photo    — Upload final composited photo + generate download code
 * GET  /api/orders/:id          — Get order details (kiosk polls for status)
 * GET  /api/orders              — (Admin) List orders for this device
 *
 * The kiosk calls POST /api/orders/:id/photo after compositing:
 *   1. Uploads the final JPEG to storage
 *   2. Sets order status to DONE
 *   3. Creates a download_code
 *   4. Returns { downloadCode, downloadUrl }
 *
 * Upstream : src/index.js
 * Downstream: Order model, Download model, storage
 */

import { Router } from 'express'
import multer  from 'multer'
import { Order }    from '../models/Order.js'
import { Download } from '../models/Download.js'
import { storage }  from '../config/storage.js'
import { deviceAuth } from '../middleware/deviceAuth.js'
import { wrap, HttpError } from '../middleware/errorHandler.js'
import { env } from '../config/env.js'

const router  = Router()
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } })

// ── Get order ─────────────────────────────────────────────────────────────────
router.get('/:id', deviceAuth, wrap(async (req, res) => {
  const order = await Order.findById(req.params.id)
  if (!order) throw new HttpError(404, 'Order not found')
  res.json(order)
}))

// ── Upload final photo + generate download code ───────────────────────────────
router.post('/:id/photo', deviceAuth, upload.single('photo'), wrap(async (req, res) => {
  const order = await Order.findById(req.params.id)
  if (!order) throw new HttpError(404, 'Order not found')
  if (!req.file)  throw new HttpError(400, 'photo file is required')

  const photoKey = `photos/${req.params.id}/final.jpg`
  await storage.save(photoKey, req.file.buffer, 'image/jpeg')

  // Update order
  await Order.setFinalPhoto(req.params.id, {
    photoPaths:    [],   // placeholder — full paths stored locally on device
    finalPhotoKey: photoKey
  })

  // Create download code
  const dl = await Download.create(req.params.id, photoKey, env.DOWNLOAD_CODE_TTL_HOURS)

  // Pre-sign a download URL (works for both local and S3)
  const downloadUrl = await storage.signedUrl(photoKey, env.DOWNLOAD_CODE_TTL_HOURS * 3600)

  res.json({
    downloadCode: dl.code,
    downloadUrl,
    expiresAt: dl.expires_at
  })
}))

// ── Admin: list orders ────────────────────────────────────────────────────────
router.get('/', deviceAuth, wrap(async (req, res) => {
  const orders = await Order.listByDevice(req.device.id)
  res.json(orders)
}))

export default router
