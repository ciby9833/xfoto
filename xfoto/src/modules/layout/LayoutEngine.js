import fs from 'fs'
import path from 'path'
import { getDataDir } from '../../shared/paths.js'

class LayoutEngine {
  saveComposed(base64Data) {
    const outputDir = path.join(getDataDir(), 'output')
    fs.mkdirSync(outputDir, { recursive: true })
    const buffer = Buffer.from(base64Data.replace(/^data:image\/\w+;base64,/, ''), 'base64')
    const outPath = path.join(outputDir, `final_${Date.now()}.jpg`)
    fs.writeFileSync(outPath, buffer)
    return outPath
  }
}

export default new LayoutEngine()
