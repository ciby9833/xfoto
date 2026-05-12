/**
 * src/middleware/deviceAuth.js
 *
 * JWT authentication for kiosk devices.
 * Devices receive a token on first registration (POST /api/devices/register).
 * Every subsequent API call must include it:  Authorization: Bearer <token>
 *
 * On success, sets req.device = { id, name } and calls next().
 * On failure, returns 401.
 *
 * Upstream : routes that require device identity
 * Downstream: route handlers that read req.device
 */

import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

export function deviceAuth(req, res, next) {
  const header = req.headers['authorization'] ?? ''
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization header' })
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET)
    req.device = { id: payload.sub, name: payload.name }
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}
