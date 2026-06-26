import type { OBDAPI } from '../../src/types/obd'

declare global {
  interface Window {
    obd: OBDAPI
  }
}
