import { useState, useEffect, useCallback } from 'react'
import type { SyncJob, BackupProgress } from '../../../shared/types'

type RunState = 'idle' | 'running' | 'success' | 'error'

export default function BackupJobs({ workspaceId }: { workspaceId: number }) {
  const [runState, setRunState] = useState<RunState>('idle')
  const [message, setMessage] = useState('')
  const [log, setLog] = useState<Extract<BackupProgress, { type: 'page' }>[]>([])
  const [history, setHistory] = useState<SyncJob[]>([])

  const loadHistory = useCallback(async () => {
    const jobs = await window.api.backup.history(workspaceId)
    setHistory(jobs)
  }, [workspaceId])

  useEffect(() => {
    setRunState('idle')
    setMessage('')
    setLog([])
    loadHistory()
  }, [loadHistory])

  async function handleRun() {
    setRunState('running')
    setLog([])
    setMessage('')

    const unsub = window.api.backup.onProgress(workspaceId, (event) => {
      if (event.type === 'start') {
        loadHistory()
      } else if (event.type === 'page') {
        setLog((prev) => [...prev, event])
      }
    })

    try {
      const result = await window.api.backup.run(workspaceId)
      setMessage(`Backup complete — ${result.count} page(s) saved.`)
      setRunState('success')
      loadHistory()
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : String(err))
      setRunState('error')
    } finally {
      unsub()
    }
  }

  return (
    <div className="page">
      <h1>Backup Jobs</h1>

      <section className="card">
        <h2>Manual Backup</h2>
        <button onClick={handleRun} disabled={runState === 'running'} className="btn-primary">
          {runState === 'running' ? 'Running…' : 'Run Backup Now'}
        </button>
        {message && (
          <p className={`status-message ${runState === 'error' ? 'error' : 'success'}`}>
            {message}
          </p>
        )}
        {log.length > 0 && (
          <ul className="progress-log">
            {log.map((e, i) => (
              <li key={i}>{e.title}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Backup History</h2>
        {history.length === 0 ? (
          <p className="muted">No backups yet.</p>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Started</th>
                <th>Finished</th>
                <th>Status</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {history.map((job) => (
                <tr key={job.id}>
                  <td>{new Date(job.started_at).toLocaleString()}</td>
                  <td>{job.finished_at ? new Date(job.finished_at).toLocaleString() : '—'}</td>
                  <td className={`status-${job.status}`}>{job.status}</td>
                  <td>{job.error ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
