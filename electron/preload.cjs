const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('watchtower', {
  sensors: () => ipcRenderer.invoke('sensors:scan'),
  network: () => ipcRenderer.invoke('network:scan'),
  ai: {
    status: () => ipcRenderer.invoke('ai:status'),
    setKey: (k) => ipcRenderer.invoke('ai:setKey', k),
    explainPlace: (d) => ipcRenderer.invoke('ai:explainPlace', d),
    removeKey: () => ipcRenderer.invoke('ai:removeKey'),
    test: () => ipcRenderer.invoke('ai:test'),
    ask: (question, context, history) => ipcRenderer.invoke('ai:ask', { question, context, history }),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch),
    clearData: () => ipcRenderer.invoke('data:clear'),
  },
  appIcon: (exePath) => ipcRenderer.invoke('app:icon', exePath),
  openPrivacySettings: (cap) => ipcRenderer.invoke('settings:open', cap),
});
