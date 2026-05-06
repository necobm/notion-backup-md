import Database from 'better-sqlite3'

const MIGRATIONS: string[] = [
  // v1 – initial schema
  `
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sync_jobs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at  TEXT NOT NULL,
    finished_at TEXT,
    status      TEXT NOT NULL CHECK(status IN ('running','success','failed')),
    error       TEXT
  );

  CREATE TABLE IF NOT EXISTS sync_job_pages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id      INTEGER NOT NULL REFERENCES sync_jobs(id),
    notion_id   TEXT NOT NULL,
    title       TEXT NOT NULL,
    local_path  TEXT NOT NULL,
    status      TEXT NOT NULL CHECK(status IN ('ok','failed')),
    error       TEXT
  );

  CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);
  INSERT INTO schema_version VALUES (1);
  `
]

export function applyMigrations(db: Database.Database): void {
  const hasVersionTable = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'`)
    .get()

  const currentVersion: number = hasVersionTable
    ? (db.prepare('SELECT version FROM schema_version').get() as { version: number }).version
    : 0

  for (let i = currentVersion; i < MIGRATIONS.length; i++) {
    db.exec(MIGRATIONS[i])
    if (i > 0) {
      db.prepare('UPDATE schema_version SET version = ?').run(i + 1)
    }
  }
}
