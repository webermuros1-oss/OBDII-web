import { app, BrowserWindow, Menu } from 'electron'
import path from 'path'
import { initDatabase, closeDatabase } from './db/database'
import {
  registerConnectionHandlers,
  setMainWindow,
  setConnectionCallbacks,
  getELM327,
} from './ipc/connection.ipc'
import { registerOBDHandlers, setMainWindowOBD, setCurrentSessionId } from './ipc/obd.ipc'
import { registerSessionHandlers } from './ipc/session.ipc'
import { createSession, endSession } from './db/sessions'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null
let currentSessionId: number | null = null

async function createWindow(): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#030712', // gray-950
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: true,
    title: 'OBDII Diagnostics',
  })

  if (isDev) {
    await win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    await win.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  Menu.setApplicationMenu(null)

  win.on('closed', () => {
    mainWindow = null
  })

  return win
}

app.whenReady().then(async () => {
  try {
    await initDatabase()
  } catch (e) {
    console.error('Failed to initialize database:', e)
  }

  // Register all IPC handlers
  registerConnectionHandlers()
  registerOBDHandlers()
  registerSessionHandlers()

  mainWindow = await createWindow()

  // Wire up the window reference into IPC modules
  setMainWindow(mainWindow)
  setMainWindowOBD(mainWindow, null)

  // Hook into connection lifecycle to manage sessions automatically
  setConnectionCallbacks(
    // onConnected — create a new session
    (port: string) => {
      try {
        currentSessionId = createSession(port)
        setCurrentSessionId(currentSessionId)
        setMainWindowOBD(mainWindow!, currentSessionId)
      } catch (e) {
        console.error('Failed to create session:', e)
      }
    },
    // onDisconnected — end the current session
    () => {
      if (currentSessionId !== null) {
        try {
          endSession(currentSessionId)
        } catch (e) {
          console.error('Failed to end session:', e)
        }
        currentSessionId = null
        setCurrentSessionId(null)
        setMainWindowOBD(mainWindow!, null)
      }
    },
  )

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = await createWindow()
      setMainWindow(mainWindow)
      setMainWindowOBD(mainWindow, currentSessionId)
    }
  })
})

app.on('window-all-closed', async () => {
  // End any active session
  if (currentSessionId !== null) {
    try {
      endSession(currentSessionId)
    } catch {
      // Ignore during shutdown
    }
    currentSessionId = null
  }

  // Close ELM327 connection gracefully
  const elm = getELM327()
  if (elm && elm.isOpen()) {
    try {
      await elm.close()
    } catch {
      // Ignore during shutdown
    }
  }

  // Save and close the database
  closeDatabase()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})
