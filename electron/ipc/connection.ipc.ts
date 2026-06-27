import { ipcMain, BrowserWindow } from 'electron'
import { SerialPort } from 'serialport'
import { readdirSync } from 'fs'
import { ELM327 } from '../obd/elm327'
import { ok, err } from '../obd/dto/connection.dto'

let elm327: ELM327 | null = null
let mainWindow: BrowserWindow | null = null

// Optional callbacks so main.ts can hook into connection lifecycle for session management
let onConnected: ((port: string) => void) | null = null
let onDisconnected: (() => void) | null = null

export function setMainWindow(win: BrowserWindow): void {
  mainWindow = win
}

export function setConnectionCallbacks(
  connected: (port: string) => void,
  disconnected: () => void,
): void {
  onConnected = connected
  onDisconnected = disconnected
}

export function registerConnectionHandlers(): void {
  ipcMain.handle('obd:listPorts', async () => {
    try {
      const ports = await SerialPort.list()
      const result = ports.map((p) => ({
        path: p.path,
        manufacturer: p.manufacturer,
        pnpId: p.pnpId,
        serialNumber: p.serialNumber,
      }))

      // On macOS, SerialPort.list() misses Bluetooth serial ports — scan /dev/cu.* manually
      if (process.platform === 'darwin') {
        const SKIP = ['debug-console', 'Bluetooth-Incoming-Port']
        const btPorts = readdirSync('/dev')
          .filter((f) => f.startsWith('cu.') && !SKIP.some((s) => f.includes(s)))
          .map((f) => ({ path: `/dev/${f}`, manufacturer: 'Bluetooth' }))
        for (const bp of btPorts) {
          if (!result.find((p) => p.path === bp.path)) {
            result.push(bp)
          }
        }
      }

      return ok(result)
    } catch (e) {
      return err('SERIAL_ERROR', String(e))
    }
  })

  ipcMain.handle('obd:connect', async (_, dto: { port: string; baudRate: number }) => {
    try {
      // Close existing connection if any
      if (elm327 && elm327.isOpen()) {
        await elm327.close()
        onDisconnected?.()
      }

      elm327 = new ELM327()
      mainWindow?.webContents.send('obd:connectionStatus', 'connecting')

      await elm327.open(dto.port, dto.baudRate)
      await elm327.initialize()

      mainWindow?.webContents.send('obd:connectionStatus', 'connected')
      onConnected?.(dto.port)

      return ok(undefined)
    } catch (e) {
      elm327 = null
      mainWindow?.webContents.send('obd:connectionStatus', 'error')
      return err('SERIAL_ERROR', String(e))
    }
  })

  ipcMain.handle('obd:disconnect', async () => {
    try {
      if (elm327 && elm327.isOpen()) {
        await elm327.close()
      }
      elm327 = null
      mainWindow?.webContents.send('obd:connectionStatus', 'disconnected')
      onDisconnected?.()
      return ok(undefined)
    } catch (e) {
      return err('SERIAL_ERROR', String(e))
    }
  })
}

export function getELM327(): ELM327 | null {
  return elm327
}
