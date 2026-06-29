import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite'
import type {
  SessionDTO,
  SessionDetailDTO,
  SnapshotDTO,
  LiveDataDTO,
  DTCCodeDTO,
} from '../types/obd'

// ─── Connection singleton ────────────────────────────────────────────────────

const DB_NAME = 'obdii_diagnostics'

const sqlite = new SQLiteConnection(CapacitorSQLite)
let db: SQLiteDBConnection | null = null

// ─── Schema ──────────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  port TEXT NOT NULL,
  protocol TEXT,
  vin TEXT
);

CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  timestamp TEXT NOT NULL,
  data_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dtc_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  timestamp TEXT NOT NULL,
  code TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  description_es TEXT,
  is_pending INTEGER NOT NULL DEFAULT 0,
  is_permanent INTEGER NOT NULL DEFAULT 0,
  cleared INTEGER NOT NULL DEFAULT 0,
  cleared_at TEXT
);
`

// ─── Init / Close ─────────────────────────────────────────────────────────────

export async function initDatabase(): Promise<void> {
  // Check if a connection already exists and reuse it
  const isConn = (await sqlite.isConnection(DB_NAME, false)).result
  if (isConn) {
    db = await sqlite.retrieveConnection(DB_NAME, false)
  } else {
    db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false)
  }

  await db.open()

  // Create tables using individual statements (Capacitor SQLite runs one statement at a time)
  const statements = SCHEMA_SQL
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  for (const stmt of statements) {
    await db.execute(stmt + ';')
  }
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close()
    await sqlite.closeConnection(DB_NAME, false)
    db = null
  }
}

// ─── Internal helper ─────────────────────────────────────────────────────────

function getDb(): SQLiteDBConnection {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export async function createSession(port: string): Promise<number> {
  const conn = getDb()
  const now = new Date().toISOString()

  const result = await conn.run(
    'INSERT INTO sessions (started_at, port) VALUES (?, ?)',
    [now, port],
  )

  const id = result.changes?.lastId
  if (id === undefined || id === null) {
    throw new Error('createSession: failed to retrieve lastId after INSERT')
  }
  return id
}

export async function endSession(id: number): Promise<void> {
  const conn = getDb()
  const now = new Date().toISOString()
  await conn.run('UPDATE sessions SET ended_at = ? WHERE id = ?', [now, id])
}

export async function updateSessionVIN(id: number, vin: string): Promise<void> {
  const conn = getDb()
  await conn.run('UPDATE sessions SET vin = ? WHERE id = ?', [vin, id])
}

export async function getSessions(): Promise<SessionDTO[]> {
  const conn = getDb()

  const result = await conn.query(`
    SELECT
      s.id,
      s.started_at,
      s.ended_at,
      s.port,
      COUNT(DISTINCT d.id)  AS dtc_count,
      COUNT(DISTINCT sn.id) AS snapshot_count
    FROM sessions s
    LEFT JOIN dtc_events d  ON d.session_id  = s.id
    LEFT JOIN snapshots  sn ON sn.session_id = s.id
    GROUP BY s.id
    ORDER BY s.started_at DESC
  `)

  const rows = result.values ?? []

  return rows.map((row) => {
    const startedAt: string = row.started_at
    const endedAt: string | null = row.ended_at ?? null

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
      id: row.id as number,
      startedAt,
      endedAt,
      port: row.port as string,
      dtcCount: (row.dtc_count as number) ?? 0,
      snapshotCount: (row.snapshot_count as number) ?? 0,
      durationSeconds,
    } satisfies SessionDTO
  })
}

export async function getSession(id: number): Promise<SessionDetailDTO | null> {
  const conn = getDb()

  // ── Session header ──────────────────────────────────────────────────────────
  const sessionResult = await conn.query(
    `
    SELECT
      s.id, s.started_at, s.ended_at, s.port,
      COUNT(DISTINCT d.id)  AS dtc_count,
      COUNT(DISTINCT sn.id) AS snapshot_count
    FROM sessions s
    LEFT JOIN dtc_events d  ON d.session_id  = s.id
    LEFT JOIN snapshots  sn ON sn.session_id = s.id
    WHERE s.id = ?
    GROUP BY s.id
    `,
    [id],
  )

  const rows = sessionResult.values ?? []
  if (rows.length === 0) return null

  const sessionRow = rows[0]
  const startedAt: string = sessionRow.started_at
  const endedAt: string | null = sessionRow.ended_at ?? null

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

  // ── DTCs ────────────────────────────────────────────────────────────────────
  const dtcResult = await conn.query(
    `
    SELECT code, category, description, description_es, is_pending, is_permanent
    FROM dtc_events
    WHERE session_id = ?
    ORDER BY timestamp ASC
    `,
    [id],
  )

  const dtcs: DTCCodeDTO[] = (dtcResult.values ?? []).map((row) => ({
    code: row.code as string,
    category: (row.category as string) as DTCCodeDTO['category'],
    description: (row.description as string | null) ?? '',
    descriptionEs: (row.description_es as string | null) ?? '',
    isPending: row.is_pending === 1,
    isPermanent: row.is_permanent === 1,
  }))

  // ── Snapshots ───────────────────────────────────────────────────────────────
  const snapResult = await conn.query(
    `
    SELECT id, session_id, timestamp, data_json
    FROM snapshots
    WHERE session_id = ?
    ORDER BY timestamp ASC
    `,
    [id],
  )

  const snapshots: SnapshotDTO[] = (snapResult.values ?? []).map((row) => {
    let data: LiveDataDTO[] = []
    try {
      data = JSON.parse(row.data_json as string)
    } catch {
      data = []
    }
    return {
      id: row.id as number,
      sessionId: row.session_id as number,
      timestamp: row.timestamp as string,
      data,
    }
  })

  return {
    id: sessionRow.id as number,
    startedAt,
    endedAt,
    port: sessionRow.port as string,
    dtcCount: (sessionRow.dtc_count as number) ?? 0,
    snapshotCount: (sessionRow.snapshot_count as number) ?? 0,
    durationSeconds,
    dtcs,
    snapshots,
  } satisfies SessionDetailDTO
}

export async function deleteSession(id: number): Promise<void> {
  const conn = getDb()
  await conn.run('DELETE FROM dtc_events WHERE session_id = ?', [id])
  await conn.run('DELETE FROM snapshots  WHERE session_id = ?', [id])
  await conn.run('DELETE FROM sessions   WHERE id = ?', [id])
}

// ─── Snapshots ───────────────────────────────────────────────────────────────

export async function saveSnapshot(sessionId: number, data: LiveDataDTO[]): Promise<void> {
  const conn = getDb()
  const now = new Date().toISOString()
  await conn.run(
    'INSERT INTO snapshots (session_id, timestamp, data_json) VALUES (?, ?, ?)',
    [sessionId, now, JSON.stringify(data)],
  )
}

// ─── DTCs ────────────────────────────────────────────────────────────────────

export async function saveDTCs(sessionId: number, dtcs: DTCCodeDTO[]): Promise<void> {
  const conn = getDb()
  const now = new Date().toISOString()
  for (const dtc of dtcs) {
    await conn.run(
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
}

export async function markDTCsCleared(sessionId: number): Promise<void> {
  const conn = getDb()
  const now = new Date().toISOString()
  await conn.run(
    'UPDATE dtc_events SET cleared = 1, cleared_at = ? WHERE session_id = ? AND cleared = 0',
    [now, sessionId],
  )
}
