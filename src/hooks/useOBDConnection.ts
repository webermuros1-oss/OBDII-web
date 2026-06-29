import { useEffect } from 'react'
import { useOBDStore } from '../store/obdStore'
import { obd } from '../lib/obd'

export function useOBDConnection() {
  const { setConnectionStatus, setLastError } = useOBDStore()

  useEffect(() => {
    const unsubStatus = obd.onConnectionStatus((status) => setConnectionStatus(status))
    const unsubError = obd.onOBDError((err) => setLastError(err))
    return () => {
      unsubStatus()
      unsubError()
    }
  }, [])

  const listDevices = () => obd.listPorts()
  const autoConnect = async (address: string): Promise<boolean> => {
    const result = await obd.connect({ port: address, baudRate: 38400 })
    if (result.ok) return true
    await obd.disconnect()
    return false
  }
  const disconnect = () => obd.disconnect()

  return { listDevices, autoConnect, disconnect }
}
