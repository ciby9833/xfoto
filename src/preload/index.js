import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('xfoto', {
  // Flow
  getState: () => ipcRenderer.invoke('flow:getState'),
  transition: (state, data) => ipcRenderer.invoke('flow:transition', state, data),
  reset: () => ipcRenderer.invoke('flow:reset'),
  onStateChanged: (cb) => {
    ipcRenderer.on('flow:stateChanged', (_, payload) => cb(payload))
    return () => ipcRenderer.removeAllListeners('flow:stateChanged')
  },

  // Assets
  listFrames: () => ipcRenderer.invoke('assets:listFrames'),
  readAsDataUrl: (filePath) => ipcRenderer.invoke('fs:readAsDataUrl', filePath),

  // Payment
  createPayment: (opts) => ipcRenderer.invoke('payment:create', opts),
  pollPayment: (orderId) => ipcRenderer.invoke('payment:poll', orderId),

  // Camera
  capture: () => ipcRenderer.invoke('camera:capture'),

  // Layout — compositing done in renderer, main only saves to disk
  saveComposed: (opts) => ipcRenderer.invoke('layout:save', opts),

  // Print
  print: (opts) => ipcRenderer.invoke('print:print', opts)
})
