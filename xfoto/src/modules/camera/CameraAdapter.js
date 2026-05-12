import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { getDataDir, VENDOR_DIR } from '../../shared/paths.js'

// Priority order when looking for CameraControlCmd.exe:
// 1. Bundled portable files in vendor/digicam/  (production — preferred)
// 2. Standard system installation paths          (dev/test convenience)
const DCC_SEARCH_PATHS = [
  path.join(VENDOR_DIR, 'digicam', 'CameraControlCmd.exe'),
  'C:\\Program Files\\digiCamControl\\CameraControlCmd.exe',
  'C:\\Program Files (x86)\\digiCamControl\\CameraControlCmd.exe'
]

// IMPORTANT: digiCamControl GUI must NOT be running when this app captures.
// The GUI and CameraControlCmd.exe conflict on the same USB camera connection.

function findDcc() {
  for (const p of DCC_SEARCH_PATHS) {
    if (fs.existsSync(p)) return p
  }
  throw new Error(
    'CameraControlCmd.exe not found.\n\n' +
    'Option A — Bundle portable files (for production builds):\n' +
    `  Extract digiCamControl portable zip into:\n  ${path.join(VENDOR_DIR, 'digicam')}\n\n` +
    'Option B — Install normally (for quick testing):\n' +
    '  Run digiCamControlsetup_x.x.x.exe and install to default path.\n\n' +
    'Download: https://github.com/dukus/digiCamControl/releases/latest\n' +
    'Searched paths:\n' + DCC_SEARCH_PATHS.map(p => `  ${p}`).join('\n')
  )
}

const MOCK_SAMPLES = ['sample1.jpg', 'sample2.jpg', 'sample3.jpg']
let mockIndex = 0

class CameraAdapter {
  capture() {
    return new Promise((resolve, reject) => {
      let dccPath
      try { dccPath = findDcc() } catch (e) { return reject(e) }

      const captureDir = path.join(getDataDir(), 'captures')
      fs.mkdirSync(captureDir, { recursive: true })

      const outPath = path.join(captureDir, `photo_${Date.now()}.jpg`)
      const cmd = `"${dccPath}" /filename "${outPath}" /capture`

      console.log('[Camera] using:', dccPath)
      console.log('[Camera] cmd:', cmd)

      exec(cmd, (err, stdout, stderr) => {
        if (err) return reject(new Error(`Capture failed: ${err.message}\n${stderr}`))
        if (!fs.existsSync(outPath)) {
          return reject(new Error(
            `Command exited OK but file not found: ${outPath}\nstdout: ${stdout}`
          ))
        }
        console.log('[Camera] captured:', outPath)
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
