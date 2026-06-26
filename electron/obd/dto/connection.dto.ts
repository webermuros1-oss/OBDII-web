export type {
  PortInfoDTO,
  ConnectDTO,
  ConnectionStatus,
  Result,
  OBDError,
  ErrorCode
} from '../../../src/types/obd'

import type { ErrorCode, OBDError, Result } from '../../../src/types/obd'

export function ok<T>(data: T): Result<T> {
  return { ok: true, data }
}

export function err(code: ErrorCode, message: string, raw?: string): { ok: false; error: OBDError } {
  return { ok: false, error: { code, message, raw } }
}
