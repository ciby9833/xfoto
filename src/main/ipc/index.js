import { ipcMain, app } from 'electron'
import { readdirSync, readFileSync } from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import flow, { STATES } from '../../core/FlowController.js'
import camera from '../../modules/camera/CameraAdapter.js'
import layout from '../../modules/layout/LayoutEngine.js'
import print from '../../modules/print/PrintService.js'
import payment from '../../modules/payment/PaymentService.js'
import db from '../../modules/db/Database.js'
import { ASSETS_DIR } from '../../shared/paths.js'

// Resolved after app is ready (ASSETS_DIR is safe at import time)
const FRAMES_DIR = path.join(ASSETS_DIR, 'frames')

export function registerIpcHandlers(mainWindow) {
  // Push state changes to the renderer
  flow.on('stateChanged', (payload) => {
    mainWindow.webContents.send('flow:stateChanged', payload)
  })

  // ── Flow ──────────────────────────────────────────────
  ipcMain.handle('flow:getState', () => {
    const state = flow.getState()
    const data = flow.getSessionData()
    console.log('[getState]', state, 'photos:', data.photos?.length ?? 'none', 'framePath:', !!data.framePath)
    return { state, data }
  })

  ipcMain.handle('flow:transition', (_, nextState, data) => {
    console.log('[transition →]', nextState, 'data keys:', data ? Object.keys(data) : '{}')
    if (data?.photos) console.log('  photos count:', data.photos.length, data.photos)
    flow.transition(nextState, data)
  })

  ipcMain.handle('flow:reset', () => {
    flow.reset()
  })

  // ── Assets ────────────────────────────────────────────
  ipcMain.handle('assets:listFrames', () => {
    const files = readdirSync(FRAMES_DIR).filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
    return files.map((f) => ({
      id: f,
      name: f.replace(/\.[^.]+$/, ''),
      fileUrl: pathToFileURL(path.join(FRAMES_DIR, f)).href,
      path: path.join(FRAMES_DIR, f)
    }))
  })

  // Read any local file and return as base64 data URL (for Canvas in renderer)
  ipcMain.handle('fs:readAsDataUrl', (_, filePath) => {
    const buf = readFileSync(filePath)
    const ext = path.extname(filePath).slice(1).toLowerCase()
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg'
    return `data:${mime};base64,${buf.toString('base64')}`
  })

  // ── Payment ───────────────────────────────────────────
  ipcMain.handle('payment:create', async (_, { amount, templateId, framePath }) => {
    const order = await payment.createOrder(amount)
    db.createOrder(order.orderId, templateId)
    flow.transition(STATES.PAYMENT_PENDING, {
      orderId: order.orderId,
      qrCodeUrl: order.qrCodeUrl,
      templateId,
      framePath
    })
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

  // ── Camera ────────────────────────────────────────────
  ipcMain.handle('camera:capture', async () => {
    // app.isPackaged = true only when running as a built installer — never in npm run dev
    const imgPath = app.isPackaged ? await camera.capture() : await camera.captureMock()
    return imgPath
  })

  // ── Layout ────────────────────────────────────────────
  // Compositing happens in the renderer via browser Canvas;
  // main process only saves the resulting base64 to disk
  ipcMain.handle('layout:save', (_, { base64Data }) => {
    return layout.saveComposed(base64Data)
  })

  // ── Print ─────────────────────────────────────────────
  ipcMain.handle('print:print', async (_, { imagePath, printerName }) => {
    await print.print(imagePath, printerName)
  })
}
