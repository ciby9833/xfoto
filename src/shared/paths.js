import { app } from 'electron'
import path from 'path'

// Assets (read-only): frame images, fonts, etc.
// - dev:      {project}/assets/
// - packaged: {installDir}/resources/assets/
export const ASSETS_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(process.cwd(), 'assets')

// Vendor (read-only): bundled third-party binaries (digiCamControl, etc.)
// - dev:      {project}/vendor/
// - packaged: {installDir}/resources/vendor/
export const VENDOR_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'vendor')
  : path.join(process.cwd(), 'vendor')

// Data (writable): photos, output files, SQLite DB
// - dev:      {project}/data/
// - packaged: %APPDATA%/xfoto/data/  (Windows)
// NOTE: app.getPath requires app.ready — always call via getDataDir()
let _dataDir = null
export function getDataDir() {
  if (_dataDir) return _dataDir
  _dataDir = app.isPackaged
    ? path.join(app.getPath('userData'), 'data')
    : path.join(process.cwd(), 'data')
  return _dataDir
}
