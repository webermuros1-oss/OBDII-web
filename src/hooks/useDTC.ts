import { useOBDStore } from '../store/obdStore'

export function useDTC() {
  const { setDTCResult, setDTCLoading } = useOBDStore()

  const readDTCs = async () => {
    setDTCLoading(true)
    const result = await window.obd.readDTCs()
    setDTCLoading(false)
    if (result.ok) setDTCResult(result.data)
    return result
  }

  const clearDTCs = async () => {
    const result = await window.obd.clearDTCs()
    if (result.ok) setDTCResult(null)
    return result
  }

  return { readDTCs, clearDTCs }
}
