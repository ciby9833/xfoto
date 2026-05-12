// Phase 1: stub — filters will be applied on the renderer side via Canvas
// Phase 3: add OpenCV / MediaPipe beauty processing here

class ImageEngine {
  applyFilter(imagePath, filterName) {
    // TODO: implement server-side filter processing
    return Promise.resolve(imagePath)
  }
}

export default new ImageEngine()
