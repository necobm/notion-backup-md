import { ipcMain, dialog, BrowserWindow } from 'electron'
import { getAllSettings, setSetting, type Settings } from '../db/settings'
import { listWorkspaces, createWorkspace, renameWorkspace, deleteWorkspace } from '../db/workspaces'
import { BackupManager } from '../backup/BackupManager'
import { NotionProvider } from '../backup/providers/NotionProvider'
import { FileStorage } from '../backup/storage/FileStorage'
import { getDb } from '../db'
import { Scheduler } from '../scheduler/Scheduler'

export function registerIpcHandlers(scheduler: Scheduler): void {
  // Workspaces
  ipcMain.handle('workspace:list', () => listWorkspaces())

  ipcMain.handle('workspace:create', (_event, name: string) => createWorkspace(name))

  ipcMain.handle('workspace:rename', (_event, id: number, name: string) =>
    renameWorkspace(id, name)
  )

  ipcMain.handle('workspace:delete', (_event, id: number) => {
    deleteWorkspace(id)
    scheduler.stop(id)
  })

  // Settings
  ipcMain.handle('settings:get', (_event, workspaceId: number) => getAllSettings(workspaceId))

  ipcMain.handle(
    'settings:set',
    (_event, workspaceId: number, key: keyof Settings, value: Settings[typeof key]) => {
      setSetting(workspaceId, key, value)
      if (key === 'scheduleEnabled' || key === 'scheduleCron') {
        scheduler.reschedule(workspaceId)
      }
    }
  )

  // File picker for backup root path
  ipcMain.handle('dialog:selectDirectory', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // Manual backup trigger
  ipcMain.handle('backup:run', async (event, workspaceId: number) => {
    const settings = getAllSettings(workspaceId)
    if (!settings.notionToken) throw new Error('Notion API token is not configured.')
    if (!settings.backupRootPath) throw new Error('Backup root directory is not configured.')

    const manager = new BackupManager(
      workspaceId,
      new NotionProvider(settings.notionToken),
      new FileStorage(settings.backupRootPath)
    )

    const count = await manager.run((progress) => {
      event.sender.send(`backup:progress:${workspaceId}`, progress)
    })

    return { count }
  })

  // Sync history
  ipcMain.handle('backup:history', (_event, workspaceId: number) => {
    return getDb()
      .prepare(
        `SELECT id, started_at, finished_at, status, error
         FROM sync_jobs WHERE workspace_id = ? ORDER BY id DESC LIMIT 50`
      )
      .all(workspaceId)
  })
}
