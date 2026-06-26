import { getDatabase, saveDatabase } from './database'
import type {
  SessionDTO,
  SessionDetailDTO,
  SnapshotDTO,
  LiveDataDTO,
  DTCCodeDTO,
} from '../../src/types/obd'

export function createSession(port: string): number {
  const db = getDatabase()
  const now = new Date().toISOString()

  // Insert the session row
  db.run('INSERT INTO sessions (started_at, port) VALUES (?, ?)', [now, port])

  // Retrieve the last inserted rowid
  const result = db.exec('SELECT last_insert_rowid()')
  const id = result[0].values[0][0] as number

  saveDatabase()
  return id
}

export function endSession(id: number): void {
  const db = getDatabase()
  const now = new Date().toISOString()
  db.run('UPDATE sessions SET ended_at = ? WHERE id = ?', [now, id])
  saveDatabase()
}

export function updateSessionVIN(id: number, vin: string): void {
  const db = getDatabase()
  db.run('UPDATE sessions SET vin = ? WHERE id = ?', [vin, id])
  saveDatabase()
}

export function addSnapshot(sessionId: number, data: LiveDataDTO[]): void {
  const db = getDatabase()
  const now = new Date().toISOString()
  db.run(
    'INSERT INTO snapshots (session_id, timestamp, data_json) VALUES (?, ?, ?)',
    [sessionId, now, JSON.stringify(data)],
  )
  // Snapshots are saved in bulk — caller must invoke saveDatabase() or rely on
  // periodic saves to avoid blocking the polling loop
}

export function addDTCEvent(sessionId: number, dtcs: DTCCodeDTO[]): void {
  const db = getDatabase()
  const now = new Date().toISOString()
  for (const dtc of dtcs) {
    db.run(
      `INSERT INTO dtc_events
        (session_id, timestamp, code, category, description, description_es, is_pending, is_permanent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        now,
        dtc.code,
        dtc.category,
        dtc.description,
        dtc.descriptionEs,
        dtc.isPending ? 1 : 0,
        dtc.isPermanent ? 1 : 0,
      ],
    )
  }
  saveDatabase()
}

export function markDTCsCleared(sessionId: number): void {
  const db = getDatabase()
  const now = new Date().toISOString()
  db.run(
    'UPDATE dtc_events SET cleared = 1, cleared_at = ? WHERE session_id = ? AND cleared = 0',
    [now, sessionId],
  )
  saveDatabase()
}

export function getSessions(): SessionDTO[] {
  const db = getDatabase()

  // sql.js exec() does not support parameterized queries, only plain SQL
  const results = db.exec(`
    SELECT
      s.id,
      s.started_at,
      s.ended_at,
      s.port,
      COUNT(DISTINCT d.id) AS dtc_count,
      COUNT(DISTINCT sn.id) AS snapshot_count
    FROM sessions s
    LEFT JOIN dtc_events d ON d.session_id = s.id
    LEFT JOIN snapshots sn ON sn.session_id = s.id
    GROUP BY s.id
    ORDER BY s.started_at DESC
  `)

  if (!results.length || !results[0].values.length) return []

  return results[0].values.map((row) => {
    const id = row[0] as number
    const startedAt = row[1] as string
    const endedAt = row[2] as string | null
    const port = row[3] as string
    const dtcCount = row[4] as number
    const snapshotCount = row[5] as number

    let durationSeconds = 0
    if (startedAt && endedAt) {
      durationSeconds = Math.round(
        (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000,
      )
    } else if (startedAt) {
      durationSeconds = Math.round(
        (Date.now() - new Date(startedAt).getTime()) / 1000,
      )
    }

    return {
      id,
      startedAt,
      endedAt: endedAt ?? null,
      port,
      dtcCount,
      snapshotCount,
      durationSeconds,
    } satisfies SessionDTO
  })
}

export function getSessionDetail(id: number): SessionDetailDTO | null {
  const db = getDatabase()

  // Use prepared statement for parameterized query
  const sessionStmt = db.prepare(`
    SELECT
      s.id, s.started_at, s.ended_at, s.port,
      COUNT(DISTINCT d.id) AS dtc_count,
      COUNT(DISTINCT sn.id) AS snapshot_count
    FROM sessions s
    LEFT JOIN dtc_events d ON d.session_id = s.id
    LEFT JOIN snapshots sn ON sn.session_id = s.id
    WHERE s.id = ?
    GROUP BY s.id
  `)

  sessionStmt.bind([id])
  if (!sessionStmt.step()) {
    sessionStmt.free()
    return null
  }

  const sessionRow = sessionStmt.get()
  sessionStmt.free()

  const sid = sessionRow[0] as number
  const startedAt = sessionRow[1] as string
  const endedAt = sessionRow[2] as string | null
  const port = sessionRow[3] as string
  const dtcCount = sessionRow[4] as number
  const snapshotCount = sessionRow[5] as number

  let durationSeconds = 0
  if (startedAt && endedAt) {
    durationSeconds = Math.round(
      (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000,
    )
  } else if (startedAt) {
    durationSeconds = Math.round(
      (Date.now() - new Date(startedAt).getTime()) / 1000,
    )
  }

  // Get DTCs for this session
  const dtcStmt = db.prepare(`
    SELECT code, category, description, description_es, is_pending, is_permanent
    FROM dtc_events
    WHERE session_id = ?
    ORDER BY timestamp ASC
  `)
  dtcStmt.bind([id])

  const dtcs: DTCCodeDTO[] = []
  while (dtcStmt.step()) {
    const row = dtcStmt.get()
    dtcs.push({
      code: row[0] as string,
      category: (row[1] as string) as DTCCodeDTO['category'],
      description: (row[2] as string | null) ?? '',
      descriptionEs: (row[3] as string | null) ?? '',
      isPending: row[4] === 1,
      isPermanent: row[5] === 1,
    })
  }
  dtcStmt.free()

  // Get snapshots for this session
  const snapStmt = db.prepare(`
    SELECT id, session_id, timestamp, data_json
    FROM snapshots
    WHERE session_id = ?
    ORDER BY timestamp ASC
  `)
  snapStmt.bind([id])

  const snapshots: SnapshotDTO[] = []
  while (snapStmt.step()) {
    const row = snapStmt.get()
    const snapId = row[0] as number
    const snapSessionId = row[1] as number
    const timestamp = row[2] as string
    const dataJson = row[3] as string

    let data: LiveDataDTO[] = []
    try {
      data = JSON.parse(dataJson)
    } catch {
      data = []
    }

    snapshots.push({
      id: snapId,
      sessionId: snapSessionId,
      timestamp,
      data,
    })
  }
  snapStmt.free()

  return {
    id: sid,
    startedAt,
    endedAt: endedAt ?? null,
    port,
    dtcCount,
    snapshotCount,
    durationSeconds,
    dtcs,
    snapshots,
  } satisfies SessionDetailDTO
}

export function deleteSession(id: number): void {
  const db = getDatabase()
  db.run('DELETE FROM dtc_events WHERE session_id = ?', [id])
  db.run('DELETE FROM snapshots WHERE session_id = ?', [id])
  db.run('DELETE FROM sessions WHERE id = ?', [id])
  saveDatabase()
}
