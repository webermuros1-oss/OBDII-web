import type { LiveDataDTO, OBDError } from '../../src/types/obd'
import { ELM327 } from './elm327'
import { PIDS, parseRawResponse } from './pids'

export class OBDScanner {
  private intervalMs = 250
  private timer: NodeJS.Timeout | null = null
  private elm: ELM327
  private activePIDs: string[] = []
  private onData: (data: LiveDataDTO) => void
  private onError: (err: OBDError) => void
  private running = false

  constructor(
    elm: ELM327,
    onData: (d: LiveDataDTO) => void,
    onError: (e: OBDError) => void,
  ) {
    this.elm = elm
    this.onData = onData
    this.onError = onError
  }

  start(pids: string[]): void {
    if (this.running) {
      this.stop()
    }

    // Only include PIDs that we have definitions for
    this.activePIDs = pids.filter((pid) => PIDS[pid.toUpperCase()] !== undefined)
      .map((pid) => pid.toUpperCase())

    if (this.activePIDs.length === 0) {
      this.onError({
        code: 'UNSUPPORTED_PID',
        message: 'No supported PIDs provided for polling',
      })
      return
    }

    this.running = true
    this.scheduleNext()
  }

  stop(): void {
    this.running = false
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  setInterval(ms: number): void {
    this.intervalMs = ms
  }

  private scheduleNext(): void {
    if (!this.running) return
    this.timer = setTimeout(() => {
      this.poll().finally(() => {
        if (this.running) {
          this.scheduleNext()
        }
      })
    }, this.intervalMs)
  }

  private async poll(): Promise<void> {
    if (!this.elm.isOpen()) {
      this.onError({
        code: 'NOT_CONNECTED',
        message: 'ELM327 port is not open',
      })
      this.stop()
      return
    }

    for (const pid of this.activePIDs) {
      if (!this.running) break

      const definition = PIDS[pid]
      if (!definition) continue

      try {
        const raw = await this.elm.query(pid)
        const bytes = parseRawResponse(raw, pid)

        if (bytes === null) {
          this.onError({
            code: 'NO_RESPONSE',
            message: `No data for PID ${pid}`,
            raw,
          })
          continue
        }

        const value = definition.parse(bytes)

        const dataPoint: LiveDataDTO = {
          pid,
          name: definition.name,
          value,
          unit: definition.unit,
          min: definition.min,
          max: definition.max,
          timestamp: Date.now(),
        }

        this.onData(dataPoint)
      } catch (e) {
        this.onError({
          code: 'SERIAL_ERROR',
          message: `Error querying PID ${pid}: ${String(e)}`,
        })
      }
    }
  }
}
