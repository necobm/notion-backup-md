import { getDb } from '.'

export type Settings = {
  notionToken: string
  backupRootPath: string
  scheduleEnabled: boolean
  scheduleCron: string // e.g. "0 2 * * *" (daily at 2am)
}

const DEFAULTS: Settings = {
  notionToken: '',
  backupRootPath: '',
  scheduleEnabled: false,
  scheduleCron: '0 2 * * *'
}

export function getSetting<K extends keyof Settings>(key: K): Settings[K] {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  if (!row) return DEFAULTS[key]
  const raw = row.value
  if (typeof DEFAULTS[key] === 'boolean') return (raw === 'true') as Settings[K]
  return raw as Settings[K]
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  getDb()
    .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .run(key, String(value))
}

export function getAllSettings(): Settings {
  return Object.fromEntries(
    (Object.keys(DEFAULTS) as (keyof Settings)[]).map((k) => [k, getSetting(k)])
  ) as Settings
}
