import { contextBridge, ipcRenderer } from 'electron'
import type { Settings } from '../main/db/settings'
import type { BackupProgress } from '../main/backup/BackupManager'

export type SyncJob = {
  id: number
  started_at: string
  finished_at: string | null
  status: 'running' | 'success' | 'failed'
  error: string | null
}

const api = {
  settings: {
    get: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
    set: <K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> =>
      ipcRenderer.invoke('settings:set', key, value)
  },
  dialog: {
    selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectDirectory')
  },
  backup: {
    run: (): Promise<{ count: number }> => ipcRenderer.invoke('backup:run'),
    history: (): Promise<SyncJob[]> => ipcRenderer.invoke('backup:history'),
    onProgress: (cb: (event: BackupProgress) => void) => {
      const listener = (_: Electron.IpcRendererEvent, data: BackupProgress) => cb(data)
      ipcRenderer.on('backup:progress', listener)
      return () => ipcRenderer.removeListener('backup:progress', listener)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
