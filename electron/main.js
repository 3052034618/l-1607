const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    title: '快件末端驿站综合调度与运营系统',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

let db = null
try {
  db = require('./database')
} catch (err) {
  console.log('[Electron Main] 加载数据库模块失败，将使用前端 localStorage 模式:', err.message)
  db = null
}

ipcMain.handle('db:query', (event, sql, params = []) => {
  if (!db) {
    return { success: false, error: 'NO_SQLITE', useFallback: true }
  }
  try {
    const stmt = db.prepare(sql)
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return { success: true, data: stmt.all(...params) }
    } else {
      const result = stmt.run(...params)
      return { success: true, data: { lastInsertRowid: result.lastInsertRowid, changes: result.changes } }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('db:exec', (event, sql) => {
  if (!db) {
    return { success: false, error: 'NO_SQLITE', useFallback: true }
  }
  try {
    db.exec(sql)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
