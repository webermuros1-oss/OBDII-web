// Minimal TypeScript declarations for sql.js (no official @types package)
declare module 'sql.js' {
  export interface QueryExecResult {
    columns: string[]
    values: SqlValue[][]
  }

  export type SqlValue = string | number | null | Uint8Array

  export interface Database {
    run(sql: string, params?: SqlValue[]): Database
    exec(sql: string, params?: SqlValue[]): QueryExecResult[]
    prepare(sql: string): Statement
    export(): Uint8Array
    close(): void
    getRowsModified(): number
  }

  export interface Statement {
    run(params?: SqlValue[]): Database
    step(): boolean
    get(params?: SqlValue[]): SqlValue[]
    all(params?: SqlValue[]): SqlValue[][]
    free(): boolean
    reset(): void
    bind(params?: SqlValue[]): boolean
    getAsObject(params?: SqlValue[]): Record<string, SqlValue>
    freemem(): void
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database
  }

  export interface SqlJsConfig {
    locateFile?: (filename: string, prefix?: string) => string
  }

  function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>
  export default initSqlJs
}
