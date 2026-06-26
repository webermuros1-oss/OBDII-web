import initSqlJs, { Database } from 'sql.js'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

let db: Database | null = null
let dbPath: string | null = null

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

export async function initDatabase(): Promise<void> {
  const wasmPath = path.join(
    app.getAppPath(),
    'node_modules',
    'sql.js',
    'dist',
    'sql-wasm.wasm',
  )

  const SQL = await initSqlJs({
    locateFile: () => wasmPath,
  })

  const userData = app.getPath('userData')
  dbPath = path.join(userData, 'obdii.db')

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  // Create tables if they don't exist
  db.run(SCHEMA_SQL)

  // Persist initial state
  saveDatabase()
}

export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export function closeDatabase(): void {
  if (db) {
    saveDatabase()
    db.close()
    db = null
  }
}

export function saveDatabase(): void {
  if (!db || !dbPath) return
  const data = db.export()
  fs.writeFileSync(dbPath, Buffer.from(data))
}
