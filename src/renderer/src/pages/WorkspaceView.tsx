import { useParams, NavLink, Routes, Route, Navigate } from 'react-router-dom'
import BackupJobs from './BackupJobs'
import Settings from './Settings'

export default function WorkspaceView() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const id = Number(workspaceId)

  return (
    <div className="workspace-view">
      <div className="workspace-tabs">
        <NavLink
          to={`/workspace/${id}/backup`}
          end
          className={({ isActive }) => `workspace-tab${isActive ? ' active' : ''}`}
        >
          Backup Jobs
        </NavLink>
        <NavLink
          to={`/workspace/${id}/settings`}
          end
          className={({ isActive }) => `workspace-tab${isActive ? ' active' : ''}`}
        >
          Settings
        </NavLink>
      </div>
      <Routes>
        <Route index element={<Navigate to={`/workspace/${id}/backup`} replace />} />
        <Route path="backup" element={<BackupJobs workspaceId={id} />} />
        <Route path="settings" element={<Settings workspaceId={id} />} />
      </Routes>
    </div>
  )
}
