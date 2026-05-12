/**
 * src/renderer/src/utils/canvasComposite.js
 *
 * Shared Canvas compositing helpers used by both PreviewPage (preview render)
 * and RenderingPage (full-resolution output).
 *
 * Callers pass a canvas element, slot definitions, photo data-URLs, a frame
 * data-URL and a filter CSS string.  The function returns a Promise that
 * resolves when the canvas has been fully drawn.
 *
 * Upstream : PreviewPage (preview scale), RenderingPage (full scale)
 * Downstream: Pure Canvas operations — no IPC calls.
 */

import { FILTER_PRESETS } from '../../../shared/sessionConfig.js'

/** Load an Image from a data URL (rejects on error). */
export function loadImg(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = dataUrl
  })
}

/**
 * Draw src image into (x, y, w, h) using CSS object-fit:cover semantics.
 * Crops the centre of the source image to exactly fill the destination rect.
 */
export function drawCover(ctx, img, x, y, w, h) {
  const imgRatio  = img.width / img.height
  const slotRatio = w / h
  let sx, sy, sw, sh
  if (imgRatio > slotRatio) {
    sh = img.height; sw = sh * slotRatio
    sx = (img.width - sw) / 2; sy = 0
  } else {
    sw = img.width; sh = sw / slotRatio
    sx = 0; sy = (img.height - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

/**
 * Composite a full photo strip onto `canvas`.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} opts
 * @param {Array<{x,y,w,h}>}   opts.slots         - Slot rectangles in canvas coordinates
 * @param {string[]}           opts.slotPhotos     - Data URL per slot (index matches slots[])
 * @param {string|null}        opts.frameDataUrl   - Frame image data URL (drawn first)
 * @param {string}             [opts.filterKey]    - Key from FILTER_PRESETS (default 'none')
 * @returns {Promise<void>}
 */
export async function drawComposite(canvas, { slots, slotPhotos, frameDataUrl, filterKey = 'none' }) {
  const ctx = canvas.getContext('2d')
  const W = canvas.width
  const H = canvas.height

  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  // 1. Draw frame (opaque, no filter)
  if (frameDataUrl) {
    try {
      const frameImg = await loadImg(frameDataUrl)
      ctx.filter = 'none'
      ctx.drawImage(frameImg, 0, 0, W, H)
    } catch (e) {
      console.warn('[composite] frame load failed:', e.message)
    }
  }

  // 2. Draw each photo clipped to its slot
  const filterCss = FILTER_PRESETS[filterKey]?.css ?? 'none'
  for (let i = 0; i < slots.length; i++) {
    const dataUrl = slotPhotos[i]
    if (!dataUrl) continue
    const { x, y, w, h } = slots[i]
    try {
      const img = await loadImg(dataUrl)
      ctx.save()
      ctx.beginPath()
      ctx.rect(x, y, w, h)
      ctx.clip()
      ctx.filter = filterCss
      drawCover(ctx, img, x, y, w, h)
      ctx.filter = 'none'
      ctx.restore()
    } catch (e) {
      console.warn(`[composite] slot ${i} failed:`, e.message)
    }
  }
}
