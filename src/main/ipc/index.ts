import { ipcMain, dialog, BrowserWindow } from 'electron'
import { getAllSettings, setSetting, type Settings } from '../db/settings'
import { BackupManager } from '../backup/BackupManager'
import { NotionProvider } from '../backup/providers/NotionProvider'
import { FileStorage } from '../backup/storage/FileStorage'
import { getDb } from '../db'
import { Scheduler } from '../scheduler/Scheduler'

let scheduler: Scheduler

export function registerIpcHandlers(): void {
  scheduler = new Scheduler()

  // Settings
  ipcMain.handle('settings:get', () => getAllSettings())

  ipcMain.handle('settings:set', (_event, key: keyof Settings, value: Settings[typeof key]) => {
    setSetting(key, value)
    if (key === 'scheduleEnabled' || key === 'scheduleCron') {
      scheduler.reschedule()
    }
  })

  // File picker for backup root path
  ipcMain.handle('dialog:selectDirectory', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // Manual backup trigger
  ipcMain.handle('backup:run', async (event) => {
    const settings = getAllSettings()
    if (!settings.notionToken) throw new Error('Notion API token is not configured.')
    if (!settings.backupRootPath) throw new Error('Backup root directory is not configured.')

    const manager = new BackupManager(
      new NotionProvider(settings.notionToken),
      new FileStorage(settings.backupRootPath)
    )

    const count = await manager.run((progress) => {
      event.sender.send('backup:progress', progress)
    })

    return { count }
  })

  // Sync history
  ipcMain.handle('backup:history', () => {
    return getDb()
      .prepare(
        `SELECT id, started_at, finished_at, status, error
         FROM sync_jobs ORDER BY id DESC LIMIT 50`
      )
      .all()
  })
}
