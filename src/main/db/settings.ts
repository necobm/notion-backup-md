import { getDb } from '.'
import type { Settings } from '../../shared/types'
export type { Settings }

const DEFAULTS: Settings = {
  notionToken: '',
  backupRootPath: '',
  scheduleEnabled: false,
  scheduleCron: '0 2 * * *'
}

export function getSetting<K extends keyof Settings>(workspaceId: number, key: K): Settings[K] {
  const row = getDb()
    .prepare('SELECT value FROM settings WHERE workspace_id = ? AND key = ?')
    .get(workspaceId, key) as { value: string } | undefined
  if (!row) return DEFAULTS[key]
  const raw = row.value
  if (typeof DEFAULTS[key] === 'boolean') return (raw === 'true') as Settings[K]
  return raw as Settings[K]
}

export function setSetting<K extends keyof Settings>(
  workspaceId: number,
  key: K,
  value: Settings[K]
): void {
  getDb()
    .prepare(
      'INSERT OR REPLACE INTO settings (workspace_id, key, value) VALUES (?, ?, ?)'
    )
    .run(workspaceId, key, String(value))
}

export function getAllSettings(workspaceId: number): Settings {
  return Object.fromEntries(
    (Object.keys(DEFAULTS) as (keyof Settings)[]).map((k) => [k, getSetting(workspaceId, k)])
  ) as Settings
}
