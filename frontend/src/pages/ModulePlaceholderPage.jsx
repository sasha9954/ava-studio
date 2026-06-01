import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Play, RotateCcw, Save, XCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useProjects } from '../context/ProjectContext.jsx'
import { completeJob, createJob, failJob, listJobs } from '../services/jobsApi.js'

const labels = {
  manual_timing: ['Тайминг', 'Сюда подключаем старый Manual Timing как project/workspace-scoped page.'],
  podcast: ['Подкаст', 'Сюда подключаем Podcast Composer.'],
  board: ['Доска', 'Сюда подключаем Board для генерации сцен по частям.'],
  board_assembly: ['Сборка видео из Доски', 'Отдельная сборка готовых сцен из Доски. Это не Video Node.'],
  video_node: ['Video Node', 'Отдельная ветка для готовой нарезки видео+аудио и Video Match JSON.'],
  generator: ['Генератор', 'Быстрые тесты i2v / ia2v / first-last / image+audio.'],
}

function InsufficientCreditsModal({ onClose }) {
  return (
    <div className="avaModalOverlay" role="presentation" onMouseDown={onClose}>
      <div className="avaConfirmModal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <button className="avaModalClose" type="button" onClick={onClose} aria-label="Закрыть">
          <XCircle size={18} />
        </button>
        <div className="avaConfirmIcon"><AlertTriangle size={26} /></div>
        <p className="avaEyebrow">credits required</p>
        <h3>Недостаточно кредитов</h3>
        <p>Пополните ваш счёт, чтобы запустить генерацию. После пополнения можно вернуться и повторить запуск.</p>
        <div className="avaModalActions">
          <Link className="avaPrimaryButton" to="/app/credits">Пополнить счёт</Link>
          <button className="avaSecondaryButton" type="button" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  )
}

export default function ModulePlaceholderPage({ stage }) {
  const { projectId } = useParams()
  const { setCurrentUser } = useAuth()
  const { loadStage, saveStage, loadWorkspaceStage, saveWorkspaceStage } = useProjects()
  const [note, setNote] = useState('')
  const [status, setStatus] = useState('')
  const [jobs, setJobs] = useState([])
  const [jobsStatus, setJobsStatus] = useState('')
  const [showCreditsModal, setShowCreditsModal] = useState(false)
  const [title, description] = labels[stage] || ['Модуль', '']
  const workspaceMode = !projectId

  async function refreshJobs() {
    const data = await listJobs()
    const scoped = (data.jobs || []).filter((job) => {
      if (job.stage !== stage) return false
      if (projectId) return job.project_id === projectId
      return !job.project_id
    })
    setJobs(scoped.slice(0, 6))
  }

  useEffect(() => {
    let active = true
    async function load() {
      setStatus(workspaceMode ? 'Загружаем backend workspace…' : 'Загружаем project snapshot…')
      const data = workspaceMode ? await loadWorkspaceStage(stage) : await loadStage(projectId, stage)
      if (!active) return
      setNote(data.note || '')
      setStatus('')
      await refreshJobs()
    }
    load().catch((err) => setStatus(err.message))
    return () => { active = false }
  }, [projectId, stage, workspaceMode])

  useEffect(() => {
    if (!workspaceMode) return undefined
    const timer = window.setTimeout(async () => {
      try {
        await saveWorkspaceStage(stage, { note, workspace_saved_at: new Date().toISOString() })
        if (note.trim()) setStatus('Автосохранено в backend workspace')
      } catch (err) {
        setStatus(`Workspace autosave error: ${err.message}`)
      }
    }, 900)

    return () => window.clearTimeout(timer)
  }, [note, saveWorkspaceStage, stage, workspaceMode])

  async function save() {
    setStatus('Сохраняем…')

    if (workspaceMode) {
      const result = await saveWorkspaceStage(stage, { note, workspace_saved_at: new Date().toISOString() })
      setStatus(result.saved ? 'Сохранено в backend workspace' : 'Workspace не сохранён')
      return
    }

    const result = await saveStage(projectId, stage, { note, placeholder_saved_at: new Date().toISOString() })
    setStatus(result.saved ? 'Сохранено в snapshot проекта' : `Не перезаписано: ${result.reason}`)
  }

  async function startTestJob() {
    setJobsStatus('Создаём test job и списываем 1 credit…')
    try {
      const result = await createJob({
        stage,
        action_type: 'stage_2_3_test_generation',
        cost: 1,
        project_id: projectId || null,
        workspace: workspaceMode,
        meta: { source: 'ModulePlaceholderPage' },
      })
      setCurrentUser(result.user)
      setJobsStatus(`Job создан: ${result.job.id}`)
      await refreshJobs()
    } catch (err) {
      if (err.message.includes('Недостаточно кредитов') || err.message.includes('402')) {
        setShowCreditsModal(true)
        setJobsStatus('')
      } else {
        setJobsStatus(err.message)
      }
    }
  }

  async function markJobComplete(jobId) {
    setJobsStatus('Завершаем job…')
    const result = await completeJob(jobId, { result_url: 'mock://stage-2-3-result', meta: { completed_from_ui: true } })
    setCurrentUser(result.user)
    setJobsStatus(`Job completed: ${jobId}`)
    await refreshJobs()
  }

  async function markJobFailed(jobId) {
    setJobsStatus('Помечаем job как failed и делаем refund…')
    const result = await failJob(jobId, { reason: 'stage_2_3_test_fail', refund: true, meta: { failed_from_ui: true } })
    setCurrentUser(result.user)
    setJobsStatus(result.ledger_item ? `Job failed + refund: ${jobId}` : `Job failed: ${jobId}`)
    await refreshJobs()
  }

  return (
    <div className="avaPage avaNarrowPage">
      <div className="avaPanel">
        <p className="avaEyebrow">{workspaceMode ? 'backend workspace draft' : stage}</p>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="avaInfoBox">
          {workspaceMode
            ? 'Рабочая область теперь сохраняется на backend и привязана к аккаунту. Это база для будущих черновиков и восстановления после F5/перезахода.'
            : 'Сейчас это безопасная заглушка проекта. На следующих этапах сюда по одному подключаются реальные модули из старого проекта.'}
        </div>
        <label>
          Заметка для теста autosave
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={workspaceMode ? 'Напиши что угодно — backend workspace сохранит это после F5 и перезахода.' : 'Напиши что угодно и сохрани — это ляжет в project snapshot.'}
          />
        </label>
        <button className="avaPrimaryButton" onClick={save}><Save size={16} /> Сохранить snapshot</button>
        {status && <p className="avaTinyStatus">{status}</p>}
      </div>

      {stage === 'generator' && (
        <div className="avaPanel avaJobTestPanel">
          <p className="avaEyebrow">stage 2.3 jobs skeleton</p>
          <h2>Тест job + credits</h2>
          <p>Проверка будущей генерации: backend создаёт job, списывает 1 credit, после F5 job остаётся, failed возвращает credit.</p>
          <button className="avaPrimaryButton" type="button" onClick={startTestJob}>
            <Play size={16} /> Запустить test job за 1 credit
          </button>
          <button className="avaSecondaryButton" type="button" onClick={refreshJobs}>
            <RotateCcw size={16} /> Обновить jobs
          </button>
          {jobsStatus && <p className="avaTinyStatus">{jobsStatus}</p>}
          <div className="avaJobList">
            {jobs.map((job) => (
              <div className="avaJobItem" key={job.id}>
                <strong>{job.id}</strong>
                <span>{job.status} · cost {job.cost}</span>
                <small>{new Date(job.updated_at).toLocaleString()}</small>
                {job.status !== 'completed' && job.status !== 'failed' && (
                  <div className="avaJobActions">
                    <button type="button" onClick={() => markJobComplete(job.id)}><CheckCircle2 size={14} /> complete</button>
                    <button type="button" onClick={() => markJobFailed(job.id)}><XCircle size={14} /> fail + refund</button>
                  </div>
                )}
              </div>
            ))}
            {jobs.length === 0 && <p>Jobs пока нет.</p>}
          </div>
        </div>
      )}

      {showCreditsModal && <InsufficientCreditsModal onClose={() => setShowCreditsModal(false)} />}
    </div>
  )
}
