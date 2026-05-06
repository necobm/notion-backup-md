// Shared types used across main, preload, and renderer.
// This file must have NO imports so it can be safely included in all tsconfig projects.

export type ScheduleFrequency = 'daily' | 'weekly' | 'custom-days'

export type Settings = {
  notionToken: string
  backupRootPath: string
  scheduleEnabled: boolean
  scheduleCron: string // e.g. "0 2 * * *" (daily at 2am) - legacy, still used internally
  scheduleFrequency: ScheduleFrequency // 'daily', 'weekly', 'custom-days'
  scheduleTime: string // HH:MM format (e.g., "02:00")
  scheduleDays: number[] // Days of week (0=Sunday, 1=Monday, ..., 6=Saturday) for weekly/custom-days
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
