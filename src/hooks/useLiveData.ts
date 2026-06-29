import { useEffect } from 'react'
import { useOBDStore } from '../store/obdStore'
import { obd } from '../lib/obd'

const DEFAULT_PIDS = ['0C', '0D', '05', '11', '04', '0F', '2F', '0E']

export function useLiveData() {
  const { updateLiveData, setIsPolling } = useOBDStore()

  useEffect(() => {
    const unsub = obd.onLiveData((data) => updateLiveData(data))
    return unsub
  }, [])

  const startPolling = async (pids = DEFAULT_PIDS) => {
    const result = await obd.startPolling(pids)
    if (result.ok) setIsPolling(true)
    return result
  }

  const stopPolling = async () => {
    const result = await obd.stopPolling()
    if (result.ok) setIsPolling(false)
    return result
  }

  return { startPolling, stopPolling }
}
