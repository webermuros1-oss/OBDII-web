import { useEffect } from 'react'
import { useOBDStore } from '../store/obdStore'

export function useOBDConnection() {
  const { setConnectionStatus, setLastError } = useOBDStore()

  useEffect(() => {
    const unsubStatus = window.obd.onConnectionStatus((status) => setConnectionStatus(status))
    const unsubError = window.obd.onOBDError((err) => setLastError(err))
    return () => {
      unsubStatus()
      unsubError()
    }
  }, [])

  const listPorts = () => window.obd.listPorts()

  const connect = (port: string, baudRate: 9600 | 38400 | 115200) =>
    window.obd.connect({ port, baudRate })

  const autoConnect = async (port: string): Promise<boolean> => {
    for (const baud of [38400, 115200, 9600] as const) {
      const result = await window.obd.connect({ port, baudRate: baud })
      if (result.ok) return true
      await window.obd.disconnect()
    }
    return false
  }

  const disconnect = () => window.obd.disconnect()

  return { listPorts, connect, autoConnect, disconnect }
}
