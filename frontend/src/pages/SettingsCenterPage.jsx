import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, HardDrive, RefreshCw, ShieldCheck, Trash2, UserRound, Workflow, X, XCircle, Zap } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useProjects } from '../context/ProjectContext.jsx'
import { apiRequest } from '../services/apiClient.js'

function StatCard({ label, value }) {
  return <div className="avaSettingsStatCard"><strong>{value}</strong><span>{label}</span></div>
}

function SystemCheckRow({ item }) {
  const Icon = item.ok ? CheckCircle2 : XCircle
  return <div className={`avaSystemCheckRow ${item.ok ? 'isOk' : 'isBad'}`}><Icon size={16} /><strong>{item.label}</strong><span>{item.message}</span></div>
}

export default function SettingsCenterPage() {
  const { user, logout, refreshUser } = useAuth()
  const { clearWorkspace, exitProject } = useProjects()
  const [summary, setSummary] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checks, setChecks] = useState([])
  const [checking, setChecking] = useState(false)
  const [showClear, setShowClear] = useState(false)

  async function loadSummary() {
    setLoading(true)
    setError('')
    try {
      setSummary(await apiRequest('/storage/summary'))
      setStatus('Данные обновлены')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadSummary() }, [])

  async function runSystemCheck() {
    setChecking(true)
    const next = []
    async function check(label, path) {
      try { await apiRequest(path); next.push({ label, ok: true, message: 'OK' }) }
      catch (err) { next.push({ label, ok: false, message: err.message }) }
    }
    await check('Backend /health', '/health')
    await check('Auth /me', '/auth/me')
    await check('Storage summary', '/storage/summary')
    await check('Workspace current', '/workspace/current')
    await check('Credits summary', '/credits/summary')
    await check('Jobs list', '/jobs')
    setChecks(next)
    setChecking(false)
    setStatus(next.every((item) => item.ok) ? 'Система OK' : 'Есть ошибки проверки')
  }

  async function confirmClearWorkspace() {
    setLoading(true)
    setError('')
    try {
      await clearWorkspace()
      setShowClear(false)
      await loadSummary()
      setStatus('Workspace очищен')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function downloadBackup() {
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
    <div className="avaPage avaSettingsPageV2">
      <div className="avaSectionHeader">
        <div><h2>Настройки / Service Center</h2><p>Аккаунт, workspace, storage, jobs, backup и проверка системы.</p></div>
        <div className="avaSettingsHeaderActions">
          <button className="avaSecondaryButton" type="button" onClick={runSystemCheck} disabled={checking}><ShieldCheck size={16} /> {checking ? 'Проверяем…' : 'Проверить систему'}</button>
          <button className="avaSecondaryButton" type="button" onClick={loadSummary} disabled={loading}><RefreshCw size={16} /> Обновить данные</button>
        </div>
      </div>

      {error && <div className="avaError">{error}</div>}
      {status && <div className="avaInfoBox">{status}</div>}

      {checks.length > 0 && <section className="avaPanel avaSettingsPanel"><p className="avaEyebrow"><ShieldCheck size={15} /> system check</p><h3>Проверка системы</h3><div className="avaSystemCheckList">{checks.map((item) => <SystemCheckRow key={item.label} item={item} />)}</div></section>}

      <div className="avaSettingsGrid">
        <section className="avaPanel avaSettingsPanel"><p className="avaEyebrow"><UserRound size={15} /> account</p><h3>{user?.name}</h3><p>{user?.email}</p><div className="avaSettingsMiniList"><span>Credits</span><strong>{user?.credits_balance ?? 0}</strong><span>Created</span><strong>{user?.created_at ? new Date(user.created_at).toLocaleString() : '—'}</strong></div><div className="avaSettingsActionRow"><button className="avaSecondaryButton" type="button" onClick={refreshUser}>Обновить аккаунт</button><button className="avaSecondaryButton" type="button" onClick={handleLogout}>Выйти из аккаунта</button></div></section>
        <section className="avaPanel avaSettingsPanel"><p className="avaEyebrow"><HardDrive size={15} /> storage</p><h3>Storage status</h3><div className="avaSettingsMiniList"><span>Env</span><strong>{summary?.env || '—'}</strong><span>DB size</span><strong>{summary?.db_size_mb ?? 0} MB</strong><span>Storage path</span><strong>{summary?.storage_path || '—'}</strong></div><button className="avaPrimaryButton" type="button" onClick={downloadBackup}><Download size={16} /> Скачать backup JSON</button></section>
      </div>

      <div className="avaSettingsStatsGrid"><StatCard label="Мои проекты" value={counts.user_projects ?? 0} /><StatCard label="Удалённые проекты" value={counts.user_deleted_projects ?? 0} /><StatCard label="Workspace snapshots" value={counts.user_workspace_snapshots ?? 0} /><StatCard label="Project snapshots" value={counts.user_project_snapshots ?? 0} /><StatCard label="Jobs" value={counts.user_jobs ?? 0} /><StatCard label="Credits ledger" value={counts.user_credits_ledger ?? 0} /></div>

      <div className="avaSettingsGrid">
        <section className="avaPanel avaSettingsPanel"><p className="avaEyebrow"><Workflow size={15} /> workspace drafts</p><h3>Рабочая область</h3><p>Workspace — быстрые черновики без проекта. Проекты не очищаются автоматически.</p><div className="avaSettingsList">{(summary?.workspaces || []).map((workspace) => <div className="avaSettingsListItem" key={workspace.id}><strong>{workspace.name}</strong><span>{workspace.status} · snapshots {workspace.snapshots_count} · TTL {workspace.ttl_days} дня</span><small>{workspace.updated_at ? new Date(workspace.updated_at).toLocaleString() : '—'}</small></div>)}{(summary?.workspaces || []).length === 0 && <p>Workspace ещё не создан.</p>}</div><button className="avaDangerButton" type="button" onClick={() => setShowClear(true)} disabled={loading}><Trash2 size={16} /> Очистить workspace</button></section>
        <section className="avaPanel avaSettingsPanel"><p className="avaEyebrow"><Zap size={15} /> jobs recovery</p><h3>Последние jobs</h3><div className="avaSettingsList">{(summary?.jobs || []).map((job) => <div className="avaSettingsListItem" key={job.id}><strong>{job.stage} · {job.status}</strong><span>cost {job.cost} · charged {String(job.charged)} · refunded {String(job.refunded)}</span><small>{job.id}</small></div>)}{(summary?.jobs || []).length === 0 && <p>Jobs пока нет.</p>}</div></section>
      </div>

      <section className="avaPanel avaSettingsPanel"><p className="avaEyebrow">projects preview</p><h3>Последние проекты</h3><div className="avaSettingsList">{(summary?.projects_preview || []).map((project) => <div className="avaSettingsListItem" key={project.id}><strong>{project.name}</strong><span>{project.status} · {project.format} · snapshots {project.snapshots_count}</span><small>{project.updated_at ? new Date(project.updated_at).toLocaleString() : '—'}</small></div>)}{(summary?.projects_preview || []).length === 0 && <p>Проектов пока нет.</p>}</div></section>

      {showClear && <div className="avaModalOverlay" role="presentation" onMouseDown={() => !loading && setShowClear(false)}><div className="avaConfirmModal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><button className="avaModalClose" type="button" onClick={() => setShowClear(false)} disabled={loading}><X size={18} /></button><div className="avaConfirmIcon"><AlertTriangle size={26} /></div><p className="avaEyebrow">workspace cleanup</p><h3>Очистить workspace?</h3><p>Будут удалены только workspace snapshots текущего аккаунта. Проекты, credits, jobs и backup не трогаются.</p><div className="avaModalActions"><button className="avaDangerButton" type="button" onClick={confirmClearWorkspace} disabled={loading}><Trash2 size={16} /> {loading ? 'Очищаем…' : 'Очистить workspace'}</button><button className="avaSecondaryButton" type="button" onClick={() => setShowClear(false)} disabled={loading}>Отмена</button></div></div></div>}
    </div>
  )
}
