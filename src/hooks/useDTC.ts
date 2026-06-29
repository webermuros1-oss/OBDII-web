import { useOBDStore } from '../store/obdStore'
import { obd } from '../lib/obd'

export function useDTC() {
  const { setDTCResult, setDTCLoading } = useOBDStore()

  const readDTCs = async () => {
    setDTCLoading(true)
    const result = await obd.readDTCs()
    setDTCLoading(false)
    if (result.ok) setDTCResult(result.data)
    return result
  }

  const clearDTCs = async () => {
    const result = await obd.clearDTCs()
    if (result.ok) setDTCResult(null)
    return result
  }

  return { readDTCs, clearDTCs }
}
