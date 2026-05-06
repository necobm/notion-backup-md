import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { applyMigrations } from './migrations'

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.')
  return db
}

export function initDatabase(): void {
  const dbPath = join(app.getPath('userData'), 'notion-backup.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  applyMigrations(db)
}
