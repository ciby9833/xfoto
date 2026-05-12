// Patches @electron/node-gyp to recognize Visual Studio 2026 (version 18).
// node-gyp v12+ already includes this fix; @electron/node-gyp lags behind.
// This script is run as part of `postinstall` via npm scripts.

const fs = require('fs')
const path = require('path')

const target = path.join(
  __dirname, '..', 'node_modules', '@electron', 'node-gyp', 'lib', 'find-visualstudio.js'
)

if (!fs.existsSync(target)) {
  console.log('patch-electron-node-gyp: target not found, skipping')
  process.exit(0)
}

let src = fs.readFileSync(target, 'utf8')

const needsPatch = src.includes('return this.findNewVS([2019, 2022])') ||
  !src.includes('versionYear = 2026')

if (!needsPatch) {
  console.log('patch-electron-node-gyp: already patched, skipping')
  process.exit(0)
}

src = src.replace(
  'return this.findVSFromSpecifiedLocation([2019, 2022])',
  'return this.findVSFromSpecifiedLocation([2019, 2022, 2026])'
)
src = src.replace(
  'return this.findNewVSUsingSetupModule([2019, 2022])',
  'return this.findNewVSUsingSetupModule([2019, 2022, 2026])'
)
src = src.replace(
  'return this.findNewVS([2019, 2022])',
  'return this.findNewVS([2019, 2022, 2026])'
)
src = src.replace(
  `    if (ret.versionMajor === 17) {
      ret.versionYear = 2022
      return ret
    }
    this.log.silly('- unsupported version:', ret.versionMajor)`,
  `    if (ret.versionMajor === 17) {
      ret.versionYear = 2022
      return ret
    }
    if (ret.versionMajor === 18) {
      ret.versionYear = 2026
      return ret
    }
    this.log.silly('- unsupported version:', ret.versionMajor)`
)
src = src.replace(
  `    } else if (versionYear === 2022) {
      return 'v143'
    }
    this.log.silly('- invalid versionYear:', versionYear)`,
  `    } else if (versionYear === 2022) {
      return 'v143'
    } else if (versionYear === 2026) {
      return 'v145'
    }
    this.log.silly('- invalid versionYear:', versionYear)`
)

fs.writeFileSync(target, src, 'utf8')
console.log('patch-electron-node-gyp: patched @electron/node-gyp for VS2026 support')
