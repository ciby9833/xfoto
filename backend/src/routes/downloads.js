/**
 * src/routes/downloads.js
 *
 * GET /api/downloads/:code   — Resolve a download code → redirect to signed URL
 *
 * This is the URL embedded in the Done-screen QR code.
 * Browser (user's phone) scans → hits this endpoint → redirected to the image file.
 *
 * Upstream : src/index.js
 * Downstream: Download model, storage
 */

import { Router } from 'express'
import { Download } from '../models/Download.js'
import { storage }  from '../config/storage.js'
import { wrap, HttpError } from '../middleware/errorHandler.js'

const router = Router()

router.get('/:code', wrap(async (req, res) => {
  const record = await Download.findByCode(req.params.code)

  if (!record) {
    throw new HttpError(404, '下载码无效')
  }
  if (new Date() > new Date(record.expires_at)) {
    throw new HttpError(410, '下载码已过期')
  }

  await Download.incrementUsed(record.id)

  const url = await storage.signedUrl(record.photo_key, 3600)  // 1h access
  res.redirect(302, url)
}))

export default router
