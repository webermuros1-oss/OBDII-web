import { ipcMain, BrowserWindow } from 'electron'
import { OBDScanner } from '../obd/scanner'
import { parseDTCResponse } from '../obd/dtc'
import { PIDS } from '../obd/pids'
import { getELM327 } from './connection.ipc'
import { ok, err } from '../obd/dto/connection.dto'
import { addDTCEvent, addSnapshot, markDTCsCleared } from '../db/sessions'
import type { LiveDataDTO, OBDError, DTCCodeDTO } from '../../src/types/obd'

let scanner: OBDScanner | null = null
let mainWindow: BrowserWindow | null = null
let currentSessionId: number | null = null

export function setMainWindowOBD(win: BrowserWindow, sessionId: number | null): void {
  mainWindow = win
  currentSessionId = sessionId
}

export function setCurrentSessionId(sessionId: number | null): void {
  currentSessionId = sessionId
}

export function registerOBDHandlers(): void {
  ipcMain.handle('obd:startPolling', async (_, pids: string[]) => {
    const elm = getELM327()
    if (!elm || !elm.isOpen()) {
      return err('NOT_CONNECTED', 'Not connected to ELM327')
    }

    // Stop existing scanner if running
    if (scanner) {
      scanner.stop()
      scanner = null
    }

    const onData = (data: LiveDataDTO) => {
      mainWindow?.webContents.send('obd:liveData', data)
      if (currentSessionId !== null) {
        addSnapshot(currentSessionId, [data])
      }
    }

    const onError = (e: OBDError) => {
      mainWindow?.webContents.send('obd:error', e)
    }

    scanner = new OBDScanner(elm, onData, onError)
    scanner.start(pids)
    return ok(undefined)
  })

  ipcMain.handle('obd:stopPolling', async () => {
    if (scanner) {
      scanner.stop()
      scanner = null
    }
    return ok(undefined)
  })

  ipcMain.handle('obd:readDTCs', async () => {
    const elm = getELM327()
    if (!elm || !elm.isOpen()) {
      return err('NOT_CONNECTED', 'Not connected to ELM327')
    }

    try {
      const [storedRaw, pendingRaw, permanentRaw] = await Promise.all([
        elm.readDTCs(),
        elm.readPendingDTCs(),
        elm.readPermanentDTCs(),
      ])

      const storedParsed = parseDTCResponse(storedRaw, false, false)
      const pendingParsed = parseDTCResponse(pendingRaw, true, false)
      const permanentParsed = parseDTCResponse(permanentRaw, false, true)

      // Save DTC events to DB if we have a session
      if (currentSessionId !== null) {
        const allDtcs: DTCCodeDTO[] = [...storedParsed, ...pendingParsed, ...permanentParsed]
        if (allDtcs.length > 0) {
          addDTCEvent(currentSessionId, allDtcs)
        }
      }

      const milOn = storedParsed.length > 0

      return ok({
        stored: storedParsed,
        pending: pendingParsed,
        permanent: permanentParsed,
        milOn,
        readyTests: 0,
        incompleteTests: 0,
      })
    } catch (e) {
      return err('PARSE_ERROR', String(e))
    }
  })

  ipcMain.handle('obd:clearDTCs', async () => {
    const elm = getELM327()
    if (!elm || !elm.isOpen()) {
      return err('NOT_CONNECTED', 'Not connected to ELM327')
    }

    try {
      await elm.clearDTCs()

      // Mark DTCs as cleared in DB
      if (currentSessionId !== null) {
        markDTCsCleared(currentSessionId)
      }

      return ok(undefined)
    } catch (e) {
      return err('SERIAL_ERROR', String(e))
    }
  })

  ipcMain.handle('obd:vehicleInfo', async () => {
    const elm = getELM327()
    if (!elm || !elm.isOpen()) {
      return err('NOT_CONNECTED', 'Not connected to ELM327')
    }

    try {
      const vinRaw = await elm.getVIN()
      const vin = parseVIN(vinRaw)

      return ok({
        vin: vin || 'N/D',
        protocol: 'AUTO',
        protocolName: 'Auto-detected',
        supportedPIDs: Object.keys(PIDS),
        ecuCount: 1,
        obdStandard: 'OBD-II',
      })
    } catch (e) {
      return err('PARSE_ERROR', String(e))
    }
  })
}

function parseVIN(raw: string): string {
  // VIN comes in multi-line ISO-TP format, extract ASCII bytes
  // Filter out lines with colons (multi-frame indices like "0:", "1:", etc.)
  const lines = raw.split('\r').filter((l) => {
    const trimmed = l.trim()
    return trimmed.length > 0 && !trimmed.includes(':')
  })

  const bytes = lines.join('').replace(/[^0-9A-Fa-f]/g, '')

  // Convert hex pairs to ASCII characters
  let vin = ''
  for (let i = 0; i < bytes.length - 1; i += 2) {
    const charCode = parseInt(bytes.slice(i, i + 2), 16)
    if (charCode >= 32 && charCode < 127) {
      vin += String.fromCharCode(charCode)
    }
  }

  // VIN is 17 characters — take the last 17 to skip OBD header bytes
  return vin.slice(-17)
}
