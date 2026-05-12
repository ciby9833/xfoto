/**
 * src/preload/index.js
 *
 * Runs in a privileged context (Node + browser) and bridges the renderer to
 * the main process via contextBridge.  The renderer can ONLY call what is
 * explicitly listed here — no direct Node.js or Electron APIs are exposed.
 *
 * Every method maps 1-to-1 to an ipcMain.handle() in main/ipc/index.js.
 *
 * Upstream : main/ipc/index.js registers the matching handlers.
 * Downstream: All renderer pages/components access main-process features
 *             exclusively via window.xfoto.*
 */

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('xfoto', {

  // ── Flow ─────────────────────────────────────────────────────────────────
  /** Returns { state, data } for the current flow step. */
  getState: () => ipcRenderer.invoke('flow:getState'),

  /** Advance or rewind the state machine.  data is merged into sessionData. */
  transition: (state, data) => ipcRenderer.invoke('flow:transition', state, data),

  /** Reset everything to IDLE and clear sessionData. */
  reset: () => ipcRenderer.invoke('flow:reset'),

  /** Register a callback for state-change push events.  Returns an unsubscribe fn. */
  onStateChanged: (cb) => {
    const handler = (_, payload) => cb(payload)
    ipcRenderer.on('flow:stateChanged', handler)
    return () => ipcRenderer.removeListener('flow:stateChanged', handler)
  },

  // ── Template selection ────────────────────────────────────────────────────
  /** Store chosen template + config and transition to COUPON_INPUT or PAYMENT_PENDING. */
  selectTemplate: (opts) => ipcRenderer.invoke('flow:selectTemplate', opts),

  // ── Assets ────────────────────────────────────────────────────────────────
  /** List frame PNG/JPG files from assets/frames/. */
  listFrames: () => ipcRenderer.invoke('assets:listFrames'),

  /** Read a local file and return a base64 data URL (needed for Canvas + img src). */
  readAsDataUrl: (filePath) => ipcRenderer.invoke('fs:readAsDataUrl', filePath),

  // ── Coupon ────────────────────────────────────────────────────────────────
  /** Validate a coupon code.  Returns { valid, discountPercent, finalPrice, message }. */
  validateCoupon: (opts) => ipcRenderer.invoke('coupon:validate', opts),

  // ── Payment ───────────────────────────────────────────────────────────────
  /** Create a payment order.  Transitions to PAYMENT_PENDING internally.
   *  opts: { amount, couponCode?, coupon? } */
  createPayment: (opts) => ipcRenderer.invoke('payment:create', opts),

  /** Poll a payment order by orderId.  Returns 'pending' | 'success' | 'failed'. */
  pollPayment: (orderId) => ipcRenderer.invoke('payment:poll', orderId),

  // ── Camera ────────────────────────────────────────────────────────────────
  /** Trigger one capture.  Returns the local file path of the saved JPEG. */
  capture: () => ipcRenderer.invoke('camera:capture'),

  // ── Layout ────────────────────────────────────────────────────────────────
  /** Save a base64 JPEG (from Canvas) to disk.  Returns the saved file path. */
  saveComposed: (opts) => ipcRenderer.invoke('layout:save', opts),

  // ── Print ─────────────────────────────────────────────────────────────────
  /** Send imagePath to the Windows printer via SumatraPDF. */
  print: (opts) => ipcRenderer.invoke('print:print', opts)
})
