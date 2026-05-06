import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useMatch } from 'react-router-dom'
import WorkspaceView from './pages/WorkspaceView'
import type { Workspace } from '../../shared/types'

export default function App() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  const navigate = useNavigate()
  const match = useMatch('/workspace/:workspaceId/*')
  const activeWorkspaceId = match?.params.workspaceId

  useEffect(() => {
    window.api.workspace.list().then((list) => {
      setWorkspaces(list)
      setLoading(false)
    })
  }, [])

  async function handleCreate() {
    const name = newName.trim()
    setCreating(false)
    setNewName('')
    if (!name) return
    const ws = await window.api.workspace.create(name)
    setWorkspaces((prev) => [...prev, ws])
    navigate(`/workspace/${ws.id}/backup`)
  }

  async function handleRename(id: number) {
    const name = editName.trim()
    setEditingId(null)
    if (!name) return
    await window.api.workspace.rename(id, name)
    setWorkspaces((prev) => prev.map((w) => (w.id === id ? { ...w, name } : w)))
  }

  async function handleDelete(ws: Workspace) {
    if (
      !window.confirm(
        `Delete workspace "${ws.name}"? All backup history and settings will be lost.`
      )
    )
      return
    const remaining = workspaces.filter((w) => w.id !== ws.id)
    await window.api.workspace.delete(ws.id)
    setWorkspaces(remaining)
    if (activeWorkspaceId === String(ws.id)) {
      navigate(remaining.length > 0 ? `/workspace/${remaining[0].id}/backup` : '/')
    }
  }

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="app-title">Notion Backup</div>
        <div className="workspace-list">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className={`workspace-item${activeWorkspaceId === String(ws.id) ? ' active' : ''}`}
            >
              {editingId === ws.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(ws.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  onBlur={() => handleRename(ws.id)}
                  className="workspace-name-input"
                />
              ) : (
                <>
                  <span
                    className="workspace-name"
                    onClick={() => navigate(`/workspace/${ws.id}/backup`)}
                    onDoubleClick={() => {
                      setEditingId(ws.id)
                      setEditName(ws.name)
                    }}
                  >
                    {ws.name}
                  </span>
                  <button
                    className="workspace-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(ws)
                    }}
                    title="Delete workspace"
                  >
                    ×
                  </button>
                </>
              )}
            </div>
          ))}
          {creating && (
            <div className="workspace-item creating">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate()
                  if (e.key === 'Escape') {
                    setCreating(false)
                    setNewName('')
                  }
                }}
                onBlur={handleCreate}
                placeholder="Workspace name…"
                className="workspace-name-input"
              />
            </div>
          )}
        </div>
        <button className="new-workspace-btn" onClick={() => setCreating(true)}>
          + New workspace
        </button>
      </nav>
      <main className="content">
        <Routes>
          <Route path="/workspace/:workspaceId/*" element={<WorkspaceView />} />
          <Route
            path="/"
            element={
              loading ? null : workspaces.length > 0 ? (
                <Navigate to={`/workspace/${workspaces[0].id}/backup`} replace />
              ) : (
                <div className="page">
                  <p className="muted">Create a workspace to get started.</p>
                </div>
              )
            }
          />
        </Routes>
      </main>
    </div>
  )
}
