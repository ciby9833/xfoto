/**
 * src/middleware/errorHandler.js
 *
 * Global Express error handler — must be registered LAST in app.js.
 * Catches any error thrown inside route handlers (including async ones when
 * wrapped with the asyncWrap helper below).
 *
 * Returns JSON errors in a consistent shape:
 *   { error: "message", code?: "MACHINE_READABLE_CODE" }
 *
 * Upstream : any route that throws or calls next(err)
 * Downstream: HTTP client (Electron app or admin panel)
 */

export function errorHandler(err, req, res, _next) {
  const status = err.status ?? err.statusCode ?? 500
  const message = err.message ?? 'Internal server error'
  if (status >= 500) console.error('[ERROR]', req.method, req.path, err)
  res.status(status).json({ error: message, code: err.code ?? undefined })
}

/**
 * Wraps an async route handler so thrown errors propagate to errorHandler.
 * Usage:  router.get('/path', wrap(async (req, res) => { ... }))
 */
export function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}

/** Throw this to return a specific HTTP status code with a message. */
export class HttpError extends Error {
  constructor(status, message, code) {
    super(message)
    this.status = status
    this.code   = code
  }
}
