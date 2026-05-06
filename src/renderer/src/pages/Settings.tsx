import { useState, useEffect } from 'react'
import type { Settings } from '../../../main/db/settings'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.api.settings.get().then(setSettings)
  }, [])

  async function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    await window.api.settings.set(key, value)
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function pickDirectory() {
    const path = await window.api.dialog.selectDirectory()
    if (path) update('backupRootPath', path)
  }

  if (!settings) return <p>Loading…</p>

  return (
    <div className="page">
      <h1>Settings</h1>

      <section className="card">
        <h2>Notion API</h2>
        <label className="field-label">
          Integration Token
          <input
            type="password"
            value={settings.notionToken}
            onChange={(e) => update('notionToken', e.target.value)}
            placeholder="secret_…"
            className="field-input"
          />
        </label>
        <p className="hint">
          Create an internal integration at notion.so/my-integrations and copy its token here.
        </p>
      </section>

      <section className="card">
        <h2>Backup Destination</h2>
        <label className="field-label">
          Root Directory
          <div className="dir-picker">
            <input
              type="text"
              value={settings.backupRootPath}
              readOnly
              placeholder="No directory selected"
              className="field-input"
            />
            <button onClick={pickDirectory} className="btn-secondary">Browse…</button>
          </div>
        </label>
      </section>

      <section className="card">
        <h2>Scheduled Backup</h2>
        <label className="field-label toggle-label">
          <input
            type="checkbox"
            checked={settings.scheduleEnabled}
            onChange={(e) => update('scheduleEnabled', e.target.checked)}
          />
          Enable scheduled backup
        </label>
        {settings.scheduleEnabled && (
          <label className="field-label">
            Cron Expression
            <input
              type="text"
              value={settings.scheduleCron}
              onChange={(e) => update('scheduleCron', e.target.value)}
              className="field-input"
            />
            <span className="hint">E.g. <code>0 2 * * *</code> = daily at 2 AM</span>
          </label>
        )}
      </section>

      {saved && <p className="status-message success">Settings saved.</p>}
    </div>
  )
}
