import { ipcMain } from 'electron'
import { getSessions, getSessionDetail, deleteSession } from '../db/sessions'
import { ok, err } from '../obd/dto/connection.dto'

export function registerSessionHandlers(): void {
  ipcMain.handle('session:getAll', async () => {
    try {
      return ok(getSessions())
    } catch (e) {
      return err('DB_ERROR', String(e))
    }
  })

  ipcMain.handle('session:getOne', async (_, id: number) => {
    try {
      const session = getSessionDetail(id)
      if (!session) {
        return err('DB_ERROR', `Session ${id} not found`)
      }
      return ok(session)
    } catch (e) {
      return err('DB_ERROR', String(e))
    }
  })

  ipcMain.handle('session:delete', async (_, id: number) => {
    try {
      deleteSession(id)
      return ok(undefined)
    } catch (e) {
      return err('DB_ERROR', String(e))
    }
  })
}
