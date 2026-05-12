/**
 * src/routes/devices.js
 *
 * Device registration and per-device config.
 *
 * POST   /api/devices/register        — First-time registration, returns JWT
 * GET    /api/devices/me/config        — Get this device's effective config + frames
 * PUT    /api/devices/me/config        — Push config override (admin-set via panel)
 * POST   /api/devices/me/heartbeat     — Update last_seen_at
 * GET    /api/devices                  — (Admin) List all devices
 *
 * Upstream : src/index.js (mounted at /api)
 * Downstream: Device model, JWT
 */

import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Device } from '../models/Device.js'
import { Frame }  from '../models/Frame.js'
import { deviceAuth } from '../middleware/deviceAuth.js'
import { wrap, HttpError } from '../middleware/errorHandler.js'
import { env } from '../config/env.js'
import { storage } from '../config/storage.js'

const router = Router()

// ── Register ─────────────────────────────────────────────────────────────────
// Called once when a kiosk is first set up.
// Body: { name, location, secret }  — secret is a shared installation password
router.post('/register', wrap(async (req, res) => {
  const { name, location, secret } = req.body
  if (!name || !secret) throw new HttpError(400, 'name and secret are required')

  const secretHash = await bcrypt.hash(secret, 10)
  const device     = await Device.create({ name, location, secretHash })

  const token = jwt.sign({ sub: device.id, name: device.name }, env.JWT_SECRET, { expiresIn: '10y' })
  res.status(201).json({ deviceId: device.id, token })
}))

// ── Get effective config + available frames ───────────────────────────────────
router.get('/me/config', deviceAuth, wrap(async (req, res) => {
  const [configOverride, frames] = await Promise.all([
    Device.getEffectiveConfig(req.device.id),
    Device.getFrames(req.device.id)
  ])
  await Device.updateLastSeen(req.device.id)

  // Attach public URLs to frames
  const framesWithUrls = frames.map((f) => ({
    ...f,
    fileUrl:      storage.publicUrl(f.file_key),
    thumbnailUrl: f.thumbnail_key ? storage.publicUrl(f.thumbnail_key) : null
  }))

  res.json({ config: configOverride, frames: framesWithUrls })
}))

// ── Heartbeat ─────────────────────────────────────────────────────────────────
router.post('/me/heartbeat', deviceAuth, wrap(async (req, res) => {
  await Device.updateLastSeen(req.device.id)
  res.json({ ok: true })
}))

// ── List all devices (admin) ──────────────────────────────────────────────────
router.get('/', wrap(async (_req, res) => {
  const devices = await Device.findAll()
  res.json(devices)
}))

// ── Update config (admin) ─────────────────────────────────────────────────────
router.put('/:id/config', wrap(async (req, res) => {
  const device = await Device.updateConfig(req.params.id, req.body)
  if (!device) throw new HttpError(404, 'Device not found')
  res.json(device)
}))

export default router
