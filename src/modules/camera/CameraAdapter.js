import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { getDataDir, VENDOR_DIR } from '../../shared/paths.js'

// Bundled digiCamControl portable — no separate installation needed
const DCC_CMD = path.join(VENDOR_DIR, 'digicam', 'CameraControlCmd.exe')

// IMPORTANT: The digiCamControl GUI (CameraControl.exe) must NOT be running
// when this app uses CameraControlCmd.exe — they conflict on the same camera.

function ensureDcc() {
  if (!fs.existsSync(DCC_CMD)) {
    throw new Error(
      `CameraControlCmd.exe not found at:\n  ${DCC_CMD}\n\n` +
      `Please extract digiCamControl portable zip into:\n  ${path.dirname(DCC_CMD)}\n\n` +
      `Download: https://github.com/dukus/digiCamControl/releases/latest`
    )
  }
}

const MOCK_SAMPLES = ['sample1.jpg', 'sample2.jpg', 'sample3.jpg']
let mockIndex = 0

class CameraAdapter {
  capture() {
    return new Promise((resolve, reject) => {
      try { ensureDcc() } catch (e) { return reject(e) }

      const captureDir = path.join(getDataDir(), 'captures')
      fs.mkdirSync(captureDir, { recursive: true })

      const outPath = path.join(captureDir, `photo_${Date.now()}.jpg`)
      // Correct argument order per docs: /filename <path> /capture
      const cmd = `"${DCC_CMD}" /filename "${outPath}" /capture`

      exec(cmd, (err, stdout, stderr) => {
        if (err) return reject(new Error(`Capture failed: ${err.message}\n${stderr}`))
        if (!fs.existsSync(outPath)) {
          return reject(new Error(
            `Capture command exited OK but file not found: ${outPath}\n` +
            `stdout: ${stdout}`
          ))
        }
        resolve(outPath)
      })
    })
  }

  captureMock() {
    const captureDir = path.join(getDataDir(), 'captures')
    fs.mkdirSync(captureDir, { recursive: true })
    const name = MOCK_SAMPLES[mockIndex % MOCK_SAMPLES.length]
    mockIndex++
    const p = path.join(captureDir, name)
    if (!fs.existsSync(p)) {
      return Promise.reject(new Error(
        `Mock sample not found: ${p}\n` +
        `Add sample1.jpg / sample2.jpg / sample3.jpg to data/captures/`
      ))
    }
    return Promise.resolve(p)
  }
}

export default new CameraAdapter()
