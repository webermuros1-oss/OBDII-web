import { SerialPort } from 'serialport'

export class ELM327 {
  private port: SerialPort | null = null
  private buffer = ''
  private resolveQueue: Array<{ resolve: (val: string) => void; reject: (err: Error) => void }> = []

  async open(path: string, baudRate: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const sp = new SerialPort({ path, baudRate, autoOpen: false })
      sp.open((err) => {
        if (err) {
          reject(new Error(`Failed to open port ${path}: ${err.message}`))
          return
        }
        this.port = sp
        this.buffer = ''

        sp.on('data', (chunk: Buffer) => {
          this.buffer += chunk.toString('ascii')
          // Check if we have a complete response (ends with '>')
          if (this.buffer.includes('>')) {
            const response = this.buffer
            this.buffer = ''
            const pending = this.resolveQueue.shift()
            if (pending) {
              pending.resolve(response)
            }
          }
        })

        sp.on('error', (error: Error) => {
          const pending = this.resolveQueue.shift()
          if (pending) {
            pending.reject(error)
          }
        })

        resolve()
      })
    })
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.port || !this.port.isOpen) {
        this.port = null
        resolve()
        return
      }
      this.port.close((err) => {
        this.port = null
        this.buffer = ''
        // Drain queue with error
        while (this.resolveQueue.length > 0) {
          const pending = this.resolveQueue.shift()
          if (pending) pending.reject(new Error('Port closed'))
        }
        if (err) {
          reject(new Error(`Failed to close port: ${err.message}`))
        } else {
          resolve()
        }
      })
    })
  }

  async initialize(): Promise<void> {
    // Wait for ELM327 to be ready
    await this.delay(500)

    // ATZ — reset
    await this.sendCommand('ATZ\r', 3000)
    await this.delay(500)

    // ATE0 — echo off
    await this.sendCommand('ATE0\r', 1000)
    // ATL0 — linefeeds off
    await this.sendCommand('ATL0\r', 1000)
    // ATS0 — spaces off
    await this.sendCommand('ATS0\r', 1000)
    // ATH1 — headers on
    await this.sendCommand('ATH1\r', 1000)
    // ATSP0 — auto protocol
    await this.sendCommand('ATSP0\r', 1000)
  }

  async sendCommand(cmd: string, timeoutMs = 1000): Promise<string> {
    if (!this.port || !this.port.isOpen) {
      throw new Error('Port is not open')
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.resolveQueue.findIndex((q) => q.resolve === resolve)
        if (idx !== -1) this.resolveQueue.splice(idx, 1)
        reject(new Error(`Timeout waiting for response to: ${cmd.trim()}`))
      }, timeoutMs)

      this.resolveQueue.push({
        resolve: (val: string) => {
          clearTimeout(timer)
          resolve(val)
        },
        reject: (err: Error) => {
          clearTimeout(timer)
          reject(err)
        },
      })

      this.port!.write(cmd, 'ascii', (err) => {
        if (err) {
          const idx = this.resolveQueue.findIndex((q) => q.reject === reject)
          if (idx !== -1) this.resolveQueue.splice(idx, 1)
          clearTimeout(timer)
          reject(new Error(`Write error: ${err.message}`))
        }
      })
    })
  }

  async query(pid: string): Promise<string> {
    // Mode 01: current data
    return this.sendCommand(`01 ${pid}\r`, 2000)
  }

  async readDTCs(): Promise<string> {
    // Mode 03: stored DTCs
    return this.sendCommand('03\r', 5000)
  }

  async clearDTCs(): Promise<string> {
    // Mode 04: clear DTCs
    return this.sendCommand('04\r', 5000)
  }

  async readPendingDTCs(): Promise<string> {
    // Mode 07: pending DTCs
    return this.sendCommand('07\r', 5000)
  }

  async readPermanentDTCs(): Promise<string> {
    // Mode 0A: permanent DTCs
    return this.sendCommand('0A\r', 5000)
  }

  async getVIN(): Promise<string> {
    // Mode 09 PID 02: VIN
    return this.sendCommand('0902\r', 5000)
  }

  isOpen(): boolean {
    return this.port !== null && this.port.isOpen
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
