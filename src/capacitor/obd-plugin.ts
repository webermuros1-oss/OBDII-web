import { registerPlugin } from '@capacitor/core'

// ─── Data shapes coming from / going to the native plugin ───────────────────

export interface OBDDevice {
  address: string
  name: string
}

export interface OBDNativePlugin {
  /** List all Bluetooth-bonded devices visible to the OS. */
  listDevices(): Promise<{ devices: OBDDevice[] }>

  /** Open an RFCOMM socket to the given MAC address and run the ELM327 init sequence. */
  connect(opts: { address: string }): Promise<{ ok: boolean; error?: string }>

  /** Close the current RFCOMM socket and stop polling if active. */
  disconnect(): Promise<{ ok: boolean }>

  /**
   * Send an AT / OBD command and wait for the ELM327 prompt `>`.
   * The caller is responsible for appending `\r` if needed.
   */
  sendCommand(opts: { command: string }): Promise<{
    ok: boolean
    response?: string
    error?: string
  }>

  /**
   * Start a continuous polling loop for the supplied PIDs.
   * Each PID result is emitted as a `liveData` event.
   */
  startPolling(opts: { pids: string[] }): Promise<{ ok: boolean }>

  /** Stop the polling loop started by `startPolling`. */
  stopPolling(): Promise<{ ok: boolean }>

  /**
   * Register a listener for a plugin event.
   * Returns a handle whose `remove()` method unregisters the listener.
   */
  addListener(
    event: 'connectionStatus',
    cb: (data: { status: 'connecting' | 'connected' | 'disconnected' | 'error' }) => void
  ): Promise<{ remove: () => void }>

  addListener(
    event: 'liveData',
    cb: (data: {
      pid: string
      name: string
      value: number
      unit: string
      min: number
      max: number
      timestamp: number
    }) => void
  ): Promise<{ remove: () => void }>

  addListener(
    event: 'obdError',
    cb: (data: { code: string; message: string }) => void
  ): Promise<{ remove: () => void }>

  // Overload for arbitrary events (required by CapacitorPlugin contract)
  addListener(event: string, cb: (data: unknown) => void): Promise<{ remove: () => void }>
}

// ─── Singleton registered with the Capacitor bridge ────────────────────────

export const OBDNative = registerPlugin<OBDNativePlugin>('OBDPlugin')
