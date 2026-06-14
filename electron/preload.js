const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  query: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
  exec: (sql) => ipcRenderer.invoke('db:exec', sql)
})
