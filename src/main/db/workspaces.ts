import { getDb } from '.'
import type { Workspace } from '../../shared/types'
export type { Workspace }

export function listWorkspaces(): Workspace[] {
  return getDb()
    .prepare('SELECT id, name, created_at FROM workspaces ORDER BY id ASC')
    .all() as Workspace[]
}

export function createWorkspace(name: string): Workspace {
  const db = getDb()
  const result = db.prepare('INSERT INTO workspaces (name) VALUES (?)').run(name)
  return db
    .prepare('SELECT id, name, created_at FROM workspaces WHERE id = ?')
    .get(result.lastInsertRowid) as Workspace
}

export function renameWorkspace(id: number, name: string): void {
  getDb().prepare('UPDATE workspaces SET name = ? WHERE id = ?').run(name, id)
}

export function deleteWorkspace(id: number): void {
  const db = getDb()
  const tx = db.transaction(() => {
    db.prepare(
      `DELETE FROM sync_job_pages WHERE job_id IN (SELECT id FROM sync_jobs WHERE workspace_id = ?)`
    ).run(id)
    db.prepare('DELETE FROM sync_jobs WHERE workspace_id = ?').run(id)
    db.prepare('DELETE FROM settings WHERE workspace_id = ?').run(id)
    db.prepare('DELETE FROM workspaces WHERE id = ?').run(id)
  })
  tx()
}
