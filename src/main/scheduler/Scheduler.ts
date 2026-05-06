import cron from 'node-cron'
import { getSetting } from '../db/settings'
import { listWorkspaces } from '../db/workspaces'
import { BackupManager } from '../backup/BackupManager'
import { NotionProvider } from '../backup/providers/NotionProvider'
import { FileStorage } from '../backup/storage/FileStorage'
import { toCronExpression } from '../utils/cronConverter'

export class Scheduler {
  private tasks: Map<number, cron.ScheduledTask> = new Map()

  start(): void {
    this.rescheduleAll()
  }

  stop(workspaceId?: number): void {
    if (workspaceId !== undefined) {
      this.tasks.get(workspaceId)?.stop()
      this.tasks.delete(workspaceId)
    } else {
      for (const task of this.tasks.values()) task.stop()
      this.tasks.clear()
    }
  }

  rescheduleAll(): void {
    for (const ws of listWorkspaces()) {
      this.reschedule(ws.id)
    }
  }

  /** Call this after the user changes schedule settings for a workspace. */
  reschedule(workspaceId: number): void {
    this.tasks.get(workspaceId)?.stop()
    this.tasks.delete(workspaceId)

    const enabled = getSetting(workspaceId, 'scheduleEnabled')
    if (!enabled) return

    // Get the new schedule settings
    const frequency = getSetting(workspaceId, 'scheduleFrequency')
    const time = getSetting(workspaceId, 'scheduleTime')
    const days = getSetting(workspaceId, 'scheduleDays')

    // Convert to cron expression
    const cronExpr = toCronExpression(frequency, time, days)

    if (!cron.validate(cronExpr)) return

    const task = cron.schedule(cronExpr, () => this.runBackup(workspaceId))
    this.tasks.set(workspaceId, task)
  }

  private async runBackup(workspaceId: number): Promise<void> {
    const token = getSetting(workspaceId, 'notionToken')
    const rootPath = getSetting(workspaceId, 'backupRootPath')
    if (!token || !rootPath) return

    const manager = new BackupManager(
      workspaceId,
      new NotionProvider(token),
      new FileStorage(rootPath)
    )
    await manager.run()
  }
}
