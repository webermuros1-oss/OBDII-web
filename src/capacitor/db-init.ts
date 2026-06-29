import { initDatabase } from './db-bridge'

/**
 * setupDatabase — llamar desde main.tsx antes de renderizar React.
 *
 * Crea la conexión SQLite y las tablas si aún no existen.
 * Lanza un error si la inicialización falla para que el caller pueda
 * mostrar una pantalla de error en lugar de silenciar el problema.
 */
export async function setupDatabase(): Promise<void> {
  await initDatabase()
}
