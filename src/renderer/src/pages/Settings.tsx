import { useState, useEffect } from 'react'
import type { Settings, ScheduleFrequency } from '../../../shared/types'

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
]

export default function SettingsPage({ workspaceId }: { workspaceId: number }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setSettings(null)
    window.api.settings.get(workspaceId).then(setSettings)
  }, [workspaceId])

  async function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    await window.api.settings.set(workspaceId, key, value)
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function pickDirectory() {
    const path = await window.api.dialog.selectDirectory()
    if (path) update('backupRootPath', path)
  }

  function toggleDay(day: number) {
    if (!settings) return
    const currentDays = settings.scheduleDays
    const newDays = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day].sort((a, b) => a - b)
    update('scheduleDays', newDays)
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
          <>
            <label className="field-label">
              Frequency
              <select
                value={settings.scheduleFrequency}
                onChange={(e) => update('scheduleFrequency', e.target.value as ScheduleFrequency)}
                className="field-input"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Once a week</option>
                <option value="custom-days">Custom days</option>
              </select>
            </label>

            {settings.scheduleFrequency === 'weekly' && (
              <label className="field-label">
                Day of the week
                <select
                  value={settings.scheduleDays[0] ?? 1}
                  onChange={(e) => update('scheduleDays', [parseInt(e.target.value, 10)])}
                  className="field-input"
                >
                  {DAYS_OF_WEEK.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {settings.scheduleFrequency === 'custom-days' && (
              <div className="field-label">
                Days of the week
                <div className="day-selector">
                  {DAYS_OF_WEEK.map((day) => (
                    <label key={day.value} className="day-checkbox">
                      <input
                        type="checkbox"
                        checked={settings.scheduleDays.includes(day.value)}
                        onChange={() => toggleDay(day.value)}
                      />
                      <span>{day.label.slice(0, 3)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <label className="field-label">
              Time
              <input
                type="time"
                value={settings.scheduleTime}
                onChange={(e) => update('scheduleTime', e.target.value)}
                className="field-input time-input"
              />
              <span className="hint">Backup will run at this time</span>
            </label>
          </>
        )}
      </section>

      {saved && <p className="status-message success">Settings saved.</p>}
    </div>
  )
}
