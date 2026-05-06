// Shared types used across main, preload, and renderer.
// This file must have NO imports so it can be safely included in all tsconfig projects.

export type Settings = {
  notionToken: string
  backupRootPath: string
  scheduleEnabled: boolean
  scheduleCron: string // e.g. "0 2 * * *" (daily at 2am)
}

export type BackupProgress =
  | { type: 'start'; jobId: number }
  | { type: 'page'; title: string; path: string }

export type SyncJob = {
  id: number
  started_at: string
  finished_at: string | null
  status: 'running' | 'success' | 'failed'
  error: string | null
}

export type Workspace = {
  id: number
  name: string
  created_at: string
}
