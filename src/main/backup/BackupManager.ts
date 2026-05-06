import { join } from 'path'
import { getDb } from '../db'
import type { ISourceProvider, PageNode } from './providers/ISourceProvider'
import type { IStorage } from './storage/IStorage'

/** Sanitize a page title to be safe as a directory/file name. */
function sanitizeName(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
}

export type BackupProgress = {
  type: 'page'
  title: string
  path: string
}

export class BackupManager {
  constructor(
    private readonly provider: ISourceProvider,
    private readonly storage: IStorage
  ) {}

  async run(onProgress?: (event: BackupProgress) => void): Promise<number> {
    const db = getDb()
    const stmt = db.prepare(
      `INSERT INTO sync_jobs (started_at, status) VALUES (?, 'running')`
    )
    const jobId = Number(stmt.run(new Date().toISOString()).lastInsertRowid)

    try {
      const rootPages = await this.provider.fetchRootPages()
      let count = 0

      for (const page of rootPages) {
        count += await this.processNode(page, '', jobId, onProgress)
      }

      db.prepare(
        `UPDATE sync_jobs SET finished_at = ?, status = 'success' WHERE id = ?`
      ).run(new Date().toISOString(), jobId)

      return count
    } catch (err) {
      db.prepare(
        `UPDATE sync_jobs SET finished_at = ?, status = 'failed', error = ? WHERE id = ?`
      ).run(new Date().toISOString(), String(err), jobId)
      throw err
    }
  }

  private async processNode(
    node: PageNode,
    parentPath: string,
    jobId: number,
    onProgress?: (event: BackupProgress) => void
  ): Promise<number> {
    const db = getDb()
    const dirName = sanitizeName(node.title)
    const dirPath = parentPath ? join(parentPath, dirName) : dirName

    await this.storage.ensureDir(dirPath)

    if (node.markdownContent) {
      const filePath = join(dirPath, 'root.md')
      await this.storage.writeFile(filePath, node.markdownContent)

      db.prepare(
        `INSERT INTO sync_job_pages (job_id, notion_id, title, local_path, status)
         VALUES (?, ?, ?, ?, 'ok')`
      ).run(jobId, node.id, node.title, filePath)

      onProgress?.({ type: 'page', title: node.title, path: filePath })
    }

    let count = node.markdownContent ? 1 : 0
    for (const child of node.children) {
      count += await this.processNode(child, dirPath, jobId, onProgress)
    }

    return count
  }
}
