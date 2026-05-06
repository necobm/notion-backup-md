import { contextBridge, ipcRenderer } from 'electron'
import type { Settings, BackupProgress, SyncJob, Workspace } from '../shared/types'
export type { Settings, BackupProgress, SyncJob, Workspace }

const api = {
  workspace: {
    list: (): Promise<Workspace[]> => ipcRenderer.invoke('workspace:list'),
    create: (name: string): Promise<Workspace> => ipcRenderer.invoke('workspace:create', name),
    rename: (id: number, name: string): Promise<void> =>
      ipcRenderer.invoke('workspace:rename', id, name),
    delete: (id: number): Promise<void> => ipcRenderer.invoke('workspace:delete', id)
  },
  settings: {
    get: (workspaceId: number): Promise<Settings> =>
      ipcRenderer.invoke('settings:get', workspaceId),
    set: <K extends keyof Settings>(
      workspaceId: number,
      key: K,
      value: Settings[K]
    ): Promise<void> => ipcRenderer.invoke('settings:set', workspaceId, key, value)
  },
  dialog: {
    selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectDirectory')
  },
  backup: {
    run: (workspaceId: number): Promise<{ count: number }> =>
      ipcRenderer.invoke('backup:run', workspaceId),
    history: (workspaceId: number): Promise<SyncJob[]> =>
      ipcRenderer.invoke('backup:history', workspaceId),
    onProgress: (workspaceId: number, cb: (event: BackupProgress) => void) => {
      const channel = `backup:progress:${workspaceId}`
      const listener = (_: Electron.IpcRendererEvent, data: BackupProgress) => cb(data)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
