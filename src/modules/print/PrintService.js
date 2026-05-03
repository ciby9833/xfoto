import { exec } from 'child_process'

class PrintService {
  print(imagePath, printerName = '') {
    // Skip on non-Windows (dev on Mac)
    if (process.platform !== 'win32') {
      console.log('[Print] skipped on non-Windows, file:', imagePath)
      return Promise.resolve()
    }
    return new Promise((resolve, reject) => {
      const target = printerName ? `"${printerName}"` : ''
      const cmd = `SumatraPDF.exe -print-to ${target} -print-settings "fit" "${imagePath}"`
      exec(cmd, (err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  }
}

export default new PrintService()
