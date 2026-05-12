/**
 * src/main/ipc/index.js
 *
 * Registers all IPC handlers for the main process.
 * Called once from main/index.js after the BrowserWindow is created.
 *
 * Each handler corresponds to a channel exposed via src/preload/index.js.
 * Naming convention: '<domain>:<action>'
 *
 * Upstream : main/index.js calls registerIpcHandlers(mainWindow).
 * Downstream: Each handler delegates to a specific module (flow, camera,
 *             layout, print, payment, coupon) and never contains business
 *             logic itself — it is a pure routing layer.
 */

import { ipcMain, app } from 'electron'
import { readdirSync, readFileSync } from 'fs'
import path from 'path'
import flow, { STATES } from '../../core/FlowController.js'
import camera from '../../modules/camera/CameraAdapter.js'
import layout from '../../modules/layout/LayoutEngine.js'
import print from '../../modules/print/PrintService.js'
import payment from '../../modules/payment/PaymentService.js'
import coupon from '../../modules/coupon/CouponService.js'
import db from '../../modules/db/Database.js'
import { ASSETS_DIR } from '../../shared/paths.js'
import { DEFAULT_SESSION_CONFIG } from '../../shared/sessionConfig.js'

const FRAMES_DIR = path.join(ASSETS_DIR, 'frames')

export function registerIpcHandlers(mainWindow) {
  // Push all state changes to the renderer via a one-way event
  flow.on('stateChanged', (payload) => {
    mainWindow.webContents.send('flow:stateChanged', payload)
  })

  // ── Flow ──────────────────────────────────────────────────────────────────

  ipcMain.handle('flow:getState', () => {
    const state = flow.getState()
    const data = flow.getSessionData()
    console.log(
      '[getState]', state,
      '| photos:', data.photos?.length ?? 0,
      '| frame:', data.framePath ? '✓' : '✗',
      '| filter:', data.selectedFilter ?? 'none'
    )
    return { state, data }
  })

  ipcMain.handle('flow:transition', (_, nextState, data) => {
    console.log(
      '[transition →]', nextState,
      '| keys:', data ? Object.keys(data).join(', ') : '{}'
    )
    flow.transition(nextState, data)
  })

  ipcMain.handle('flow:reset', () => {
    console.log('[reset] returning to IDLE')
    flow.reset()
  })

  // ── Template selection ────────────────────────────────────────────────────
  // Stores the chosen template + device config into sessionData, then
  // transitions to COUPON_INPUT or PAYMENT_PENDING based on config flag.

  // Coupon is now handled inline on the payment screen — always go straight to
  // PAYMENT_PENDING.  The renderer's PaymentPage calls payment:create once the
  // user taps "Pay" (with or without a coupon code).
  ipcMain.handle('flow:selectTemplate', (_, { templateId, framePath, config }) => {
    const mergedConfig = { ...DEFAULT_SESSION_CONFIG, ...config }
    console.log('[selectTemplate]', templateId, '| mode:', mergedConfig.shootMode,
                '| shots:', mergedConfig.totalShots)
    flow.transition(STATES.PAYMENT_PENDING, { templateId, framePath, config: mergedConfig })
  })

  // ── Assets ────────────────────────────────────────────────────────────────

  ipcMain.handle('assets:listFrames', () => {
    const files = readdirSync(FRAMES_DIR).filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
    return files.map((f) => ({
      id: f,
      name: f.replace(/\.[^.]+$/, ''),
      path: path.join(FRAMES_DIR, f)
    }))
  })

  // Reads any local file and returns a base64 data URL.
  // Required because the renderer runs in a sandboxed browser context
  // that cannot access file:// paths via Canvas or <img>.
  ipcMain.handle('fs:readAsDataUrl', (_, filePath) => {
    const buf = readFileSync(filePath)
    const ext = path.extname(filePath).slice(1).toLowerCase()
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg'
    return `data:${mime};base64,${buf.toString('base64')}`
  })

  // ── Coupon ────────────────────────────────────────────────────────────────

  ipcMain.handle('coupon:validate', (_, { code, basePrice }) => {
    const result = coupon.validate(code, basePrice)
    console.log('[coupon:validate]', code, '→', result.valid ? result.message : 'invalid')
    return result
  })

  // ── Payment ───────────────────────────────────────────────────────────────

  ipcMain.handle('payment:create', async (_, { amount, couponCode, coupon }) => {
    const order = await payment.createOrder(amount)
    const sessionData = flow.getSessionData()
    db.createOrder(order.orderId, sessionData.templateId)

    // mergeData — do NOT transition: we are already in PAYMENT_PENDING.
    // mergeData emits stateChanged so the renderer receives orderId + qrCodeUrl.
    flow.mergeData({
      orderId:     order.orderId,
      qrCodeUrl:   order.qrCodeUrl,
      finalAmount: amount,
      couponCode:  couponCode ?? null,
      coupon:      coupon ?? null
    })
    console.log('[payment:create] order', order.orderId, 'amount', amount)
    return order
  })

  ipcMain.handle('payment:poll', async (_, orderId) => {
    const status = await payment.pollStatus(orderId)
    if (status === 'success') {
      flow.transition(STATES.PAYMENT_SUCCESS)
      db.updateOrder(orderId, { state: 'PAID' })
    }
    return status
  })

  // ── Camera ────────────────────────────────────────────────────────────────
  // In dev (Mac / non-packaged): use mock photos from data/captures/
  // In production (packaged Windows): use real digiCamControl

  ipcMain.handle('camera:capture', async () => {
    const imgPath = app.isPackaged
      ? await camera.capture()
      : await camera.captureMock()
    console.log('[camera:capture]', imgPath)
    return imgPath
  })

  // ── Layout ────────────────────────────────────────────────────────────────
  // Compositing is done in the renderer via browser Canvas.
  // Main process only writes the resulting base64 JPEG to disk.

  ipcMain.handle('layout:save', (_, { base64Data }) => {
    return layout.saveComposed(base64Data)
  })

  // ── Print ─────────────────────────────────────────────────────────────────

  ipcMain.handle('print:print', async (_, { imagePath, printerName }) => {
    await print.print(imagePath, printerName)
  })
}
