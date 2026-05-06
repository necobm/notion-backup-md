import cron from 'node-cron'
import { getSetting } from '../db/settings'
import { BackupManager } from '../backup/BackupManager'
import { NotionProvider } from '../backup/providers/NotionProvider'
import { FileStorage } from '../backup/storage/FileStorage'

export class Scheduler {
  private task: cron.ScheduledTask | null = null

  start(): void {
    this.reschedule()
  }

  stop(): void {
    this.task?.stop()
    this.task = null
  }

  /** Call this after the user changes schedule settings in the UI. */
  reschedule(): void {
    this.task?.stop()
    this.task = null

    const enabled = getSetting('scheduleEnabled')
    if (!enabled) return

    const cronExpr = getSetting('scheduleCron')
    if (!cron.validate(cronExpr)) return

    this.task = cron.schedule(cronExpr, () => this.runBackup())
  }

  private async runBackup(): Promise<void> {
    const token = getSetting('notionToken')
    const rootPath = getSetting('backupRootPath')
    if (!token || !rootPath) return

    const manager = new BackupManager(new NotionProvider(token), new FileStorage(rootPath))
    await manager.run()
  }
}
