/**
 * src/routes/frames.js
 *
 * Frame template management.
 *
 * GET  /api/frames           — List all active frames (device sees its own subset)
 * POST /api/frames           — Upload a new frame (multipart: file + metadata)
 * PUT  /api/frames/:id       — Update metadata (name, slots, price, sort order)
 * DELETE /api/frames/:id     — Delete frame + its storage files
 *
 * Upload pipeline:
 *   1. Multer buffers the PNG file in memory
 *   2. sharp generates a 200×320 thumbnail
 *   3. Both saved via storage driver (local or S3)
 *   4. Frame record inserted into DB
 *
 * Upstream : src/index.js
 * Downstream: Frame model, storage, sharp
 */

import { Router } from 'express'
import multer   from 'multer'
import sharp    from 'sharp'
import { Frame } from '../models/Frame.js'
import { storage } from '../config/storage.js'
import { wrap, HttpError } from '../middleware/errorHandler.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

// ── List frames ───────────────────────────────────────────────────────────────
router.get('/', wrap(async (_req, res) => {
  const frames = await Frame.findAll()
  const withUrls = frames.map((f) => ({
    ...f,
    fileUrl:      storage.publicUrl(f.file_key),
    thumbnailUrl: f.thumbnail_key ? storage.publicUrl(f.thumbnail_key) : null
  }))
  res.json(withUrls)
}))

// ── Upload frame ──────────────────────────────────────────────────────────────
// Form fields: name, canvasWidth?, canvasHeight?, slotDefinitions (JSON), priceOverride?
router.post('/', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'file is required')
  const { name, canvasWidth, canvasHeight, slotDefinitions, priceOverride } = req.body
  if (!name) throw new HttpError(400, 'name is required')

  const ext       = req.file.originalname.split('.').pop().toLowerCase() || 'png'
  const fileKey   = `frames/${Date.now()}.${ext}`
  const thumbKey  = `frames/thumb_${Date.now()}.jpg`

  // Save original
  await storage.save(fileKey, req.file.buffer, req.file.mimetype)

  // Generate thumbnail
  const thumbBuf = await sharp(req.file.buffer)
    .resize(200, 320, { fit: 'inside' })
    .jpeg({ quality: 85 })
    .toBuffer()
  await storage.save(thumbKey, thumbBuf, 'image/jpeg')

  const frame = await Frame.create({
    name,
    fileKey,
    thumbnailKey:  thumbKey,
    canvasWidth:   canvasWidth  ? parseInt(canvasWidth)  : 887,
    canvasHeight:  canvasHeight ? parseInt(canvasHeight) : 1774,
    slotDefinitions: slotDefinitions ? JSON.parse(slotDefinitions) : [],
    priceOverride:   priceOverride ? parseInt(priceOverride) : null
  })

  res.status(201).json({
    ...frame,
    fileUrl:      storage.publicUrl(fileKey),
    thumbnailUrl: storage.publicUrl(thumbKey)
  })
}))

// ── Update frame metadata ─────────────────────────────────────────────────────
router.put('/:id', wrap(async (req, res) => {
  const frame = await Frame.update(req.params.id, req.body)
  if (!frame) throw new HttpError(404, 'Frame not found')
  res.json(frame)
}))

// ── Delete frame ──────────────────────────────────────────────────────────────
router.delete('/:id', wrap(async (req, res) => {
  const deleted = await Frame.delete(req.params.id)
  if (!deleted) throw new HttpError(404, 'Frame not found')
  // Clean up storage files
  await Promise.allSettled([
    storage.delete(deleted.file_key),
    deleted.thumbnail_key ? storage.delete(deleted.thumbnail_key) : null
  ])
  res.json({ ok: true })
}))

export default router
