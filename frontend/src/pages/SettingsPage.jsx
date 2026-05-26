import { useEffect, useState } from 'react'
import { Download, HardDrive, RefreshCw, Trash2, UserRound, Workflow, Zap } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useProjects } from '../context/ProjectContext.jsx'
import { apiRequest } from '../services/apiClient.js'

function StatCard({ label, value, hint }) {
  return (
    <div className="avaSettingsStatCard">
      <strong>{value}</strong>
      <span>{label}</span>
      {hint && <small>{hint}</small>}
    </div>
  )
}

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const { clearWorkspace, refreshProjects, exitProject } = useProjects()
  const [summary, setSummary] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function loadSummary() {
    setLoading(true)
    setError('')
    try {
      const data = await apiRequest('/storage/summary')
      setSummary(data)
      setStatus('Данные обновлены')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSummary()
  }, [])

  async function handleClearWorkspace() {
    const ok = window.confirm('Очистить текущую рабочую область? Проекты не будут затронуты.')
    if (!ok) return
    setLoading(true)
    setError('')
    try {
      await clearWorkspace()
      await loadSummary()
      setStatus('Workspace очищен')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function downloadBackup() {
    setError('')
    try {
      const backup = await apiRequest('/storage/backup')
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `ava-studio-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setStatus('Backup JSON скачан')
    } catch (err) {
      setError(err.message)
    }
  }

  function handleLogout() {
    exitProject()
    logout()
    window.location.href = '/'
  }

  const counts = summary?.counts || {}

  return (
    <div className="avaPage">
      <div className="avaSectionHeader">
        <div>
          <h2>Настройки / Service Center</h2>
          <p>Служебный центр: аккаунт, workspace, storage, jobs и backup.</p>
        </div>
        <button className="avaSecondaryButton" type="button" onClick={loadSummary} disabled={loading}>
          <RefreshCw size={16} /> Обновить данные
        </button>
      </div>

      {error && <div className="avaError">{error}</div>}
      {status && <div className="avaInfoBox">{status}</div>}

      <div className="avaSettingsGrid">
        <section className="avaPanel avaSettingsPanel">
          <p className="avaEyebrow"><UserRound size={15} /> account</p>
          <h3>{user?.name}</h3>
          <p>{user?.email}</p>
          <div className="avaSettingsMiniList">
            <span>Credits</span><strong>{user?.credits_balance ?? 0}</strong>
            <span>Created</span><strong>{user?.created_at ? new Date(user.created_at).toLocaleString() : '—'}</strong>
          </div>
          <button className="avaSecondaryButton" type="button" onClick={handleLogout}>Выйти из аккаунта</button>
        </section>

        <section className="avaPanel avaSettingsPanel">
          <p className="avaEyebrow"><HardDrive size={15} /> storage</p>
          <h3>Storage status</h3>
          <div className="avaSettingsMiniList">
            <span>Env</span><strong>{summary?.env || '—'}</strong>
            <span>DB size</span><strong>{summary?.db_size_mb ?? 0} MB</strong>
            <span>Storage path</span><strong>{summary?.storage_path || '—'}</strong>
          </div>
          <button className="avaPrimaryButton" type="button" onClick={downloadBackup}>
            <Download size={16} /> Скачать backup JSON
          </button>
        </section>
      </div>

      <div className="avaSettingsStatsGrid">
        <StatCard label="Мои проекты" value={counts.user_projects ?? 0} />
        <StatCard label="Удалённые проекты" value={counts.user_deleted_projects ?? 0} />
        <StatCard label="Workspace snapshots" value={counts.user_workspace_snapshots ?? 0} />
        <StatCard label="Project snapshots" value={counts.user_project_snapshots ?? 0} />
        <StatCard label="Jobs" value={counts.user_jobs ?? 0} />
        <StatCard label="Credits ledger" value={counts.user_credits_ledger ?? 0} />
      </div>

      <div className="avaSettingsGrid">
        <section className="avaPanel avaSettingsPanel">
          <p className="avaEyebrow"><Workflow size={15} /> workspace drafts</p>
          <h3>Рабочая область</h3>
          <p>Workspace — быстрые черновики без проекта. Проекты не очищаются автоматически.</p>
          <div className="avaSettingsList">
            {(summary?.workspaces || []).map((workspace) => (
              <div className="avaSettingsListItem" key={workspace.id}>
                <strong>{workspace.name}</strong>
                <span>{workspace.status} · snapshots {workspace.snapshots_count} · TTL {workspace.ttl_days} дня</span>
                <small>{workspace.updated_at ? new Date(workspace.updated_at).toLocaleString() : '—'}</small>
              </div>
            ))}
            {(summary?.workspaces || []).length === 0 && <p>Workspace ещё не создан.</p>}
          </div>
          <button className="avaDangerButton" type="button" onClick={handleClearWorkspace} disabled={loading}>
            <Trash2 size={16} /> Очистить workspace
          </button>
        </section>

        <section className="avaPanel avaSettingsPanel">
          <p className="avaEyebrow"><Zap size={15} /> jobs recovery</p>
          <h3>Последние jobs</h3>
          <div className="avaSettingsList">
            {(summary?.jobs || []).map((job) => (
              <div className="avaSettingsListItem" key={job.id}>
                <strong>{job.stage} · {job.status}</strong>
                <span>cost {job.cost} · charged {String(job.charged)} · refunded {String(job.refunded)}</span>
                <small>{job.id}</small>
              </div>
            ))}
            {(summary?.jobs || []).length === 0 && <p>Jobs пока нет.</p>}
          </div>
        </section>
      </div>

      <section className="avaPanel avaSettingsPanel">
        <p className="avaEyebrow">projects preview</p>
        <h3>Последние проекты</h3>
        <div className="avaSettingsList">
          {(summary?.projects_preview || []).map((project) => (
            <div className="avaSettingsListItem" key={project.id}>
              <strong>{project.name}</strong>
              <span>{project.status} · {project.format} · snapshots {project.snapshots_count}</span>
              <small>{project.updated_at ? new Date(project.updated_at).toLocaleString() : '—'}</small>
            </div>
          ))}
          {(summary?.projects_preview || []).length === 0 && <p>Проектов пока нет.</p>}
        </div>
      </section>
    </div>
  )
}
