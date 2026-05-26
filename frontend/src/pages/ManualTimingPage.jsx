import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Clock3, FileAudio, ListChecks, Save, ShieldCheck } from 'lucide-react'
import { useProjects } from '../context/ProjectContext.jsx'

const STAGE = 'manual_timing'
const DRAFT_VERSION = 'manual_timing_wrapper_v1'

const emptyDraft = {
  timingDraftVersion: DRAFT_VERSION,
  audioName: '',
  scenesCount: 0,
  notes: '',
  updatedAt: null,
}

function normalizeDraft(data) {
  return {
    ...emptyDraft,
    ...(data || {}),
    timingDraftVersion: data?.timingDraftVersion || DRAFT_VERSION,
    scenesCount: Number.isFinite(Number(data?.scenesCount)) ? Number(data.scenesCount) : 0,
  }
}

export default function ManualTimingPage() {
  const { projectId } = useParams()
  const {
    activeProject,
    loadStage,
    saveStage,
    loadWorkspaceStage,
    saveWorkspaceStage,
  } = useProjects()
  const workspaceMode = !projectId
  const [draft, setDraft] = useState(emptyDraft)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadedAt, setLoadedAt] = useState(null)

  const scopeLabel = useMemo(() => {
    if (workspaceMode) return 'Рабочая область без проекта'
    return activeProject?.name ? `Проект: ${activeProject.name}` : `Проект: ${projectId}`
  }, [workspaceMode, activeProject, projectId])

  useEffect(() => {
    let active = true
    async function loadDraft() {
      setLoading(true)
      setStatus(workspaceMode ? 'Загружаем workspace timing snapshot…' : 'Загружаем project timing snapshot…')
      try {
        const data = workspaceMode ? await loadWorkspaceStage(STAGE) : await loadStage(projectId, STAGE)
        if (!active) return
        setDraft(normalizeDraft(data))
        setLoadedAt(new Date().toISOString())
        setStatus('Timing snapshot загружен')
      } catch (err) {
        if (!active) return
        setStatus(`Ошибка загрузки: ${err.message}`)
      } finally {
        if (active) setLoading(false)
      }
    }
    loadDraft()
    return () => { active = false }
  }, [projectId, workspaceMode])

  async function saveDraft(nextDraft = draft, reason = 'manual_save') {
    setSaving(true)
    setStatus('Сохраняем timing snapshot…')
    const payload = {
      ...nextDraft,
      timingDraftVersion: DRAFT_VERSION,
      updatedAt: new Date().toISOString(),
      saveReason: reason,
    }

    try {
      if (workspaceMode) {
        await saveWorkspaceStage(STAGE, payload)
      } else {
        await saveStage(projectId, STAGE, payload, 'replace')
      }
      setDraft(payload)
      setStatus('Timing snapshot сохранён')
    } catch (err) {
      setStatus(`Ошибка сохранения: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (loading) return undefined
    const timer = window.setTimeout(() => {
      saveDraft(draft, 'autosave')
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [draft.audioName, draft.scenesCount, draft.notes])

  function updateDraft(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="avaPage avaTimingPage">
      <div className="avaSectionHeader">
        <div>
          <p className="avaEyebrow"><Clock3 size={15} /> stage 3.1 manual timing wrapper</p>
          <h2>Manual Timing</h2>
          <p>Безопасный контейнер перед переносом старого тайминга: contract, snapshot, autosave, F5 recovery.</p>
        </div>
        <button className="avaPrimaryButton" type="button" onClick={() => saveDraft(draft, 'button_save')} disabled={saving || loading}>
          <Save size={16} /> {saving ? 'Сохраняем…' : 'Сохранить snapshot'}
        </button>
      </div>

      <div className="avaTimingHero">
        <div>
          <p className="avaEyebrow"><ShieldCheck size={15} /> scope</p>
          <h3>{scopeLabel}</h3>
          <p>{workspaceMode ? 'Snapshot сохраняется в backend workspace текущего аккаунта.' : 'Snapshot сохраняется внутри выбранного проекта.'}</p>
        </div>
        <div className="avaTimingContract">
          <span>contract</span>
          <strong>{DRAFT_VERSION}</strong>
          <small>{loadedAt ? `loaded ${new Date(loadedAt).toLocaleTimeString()}` : 'not loaded'}</small>
        </div>
      </div>

      <div className="avaTimingGrid">
        <section className="avaPanel avaTimingPanel">
          <p className="avaEyebrow"><FileAudio size={15} /> audio placeholder</p>
          <h3>Аудио</h3>
          <label>
            Audio name / тестовое имя файла
            <input
              value={draft.audioName}
              onChange={(event) => updateDraft('audioName', event.target.value)}
              placeholder="example_song.mp3"
            />
          </label>
          <div className="avaTimingInfoBox">
            На этом шаге файл ещё не загружаем. Проверяем только контракт сохранения перед настоящим audio upload.
          </div>
        </section>

        <section className="avaPanel avaTimingPanel">
          <p className="avaEyebrow"><ListChecks size={15} /> timing draft</p>
          <h3>Сцены</h3>
          <label>
            Scenes count / тестовое количество сцен
            <input
              type="number"
              min="0"
              value={draft.scenesCount}
              onChange={(event) => updateDraft('scenesCount', Number(event.target.value))}
            />
          </label>
          <label>
            Notes / заметка
            <textarea
              value={draft.notes}
              onChange={(event) => updateDraft('notes', event.target.value)}
              placeholder="Проверка F5 recovery, workspace/project mode, autosave…"
            />
          </label>
        </section>
      </div>

      <section className="avaPanel avaTimingPanel">
        <p className="avaEyebrow">snapshot preview</p>
        <h3>Текущий contract JSON</h3>
        <pre className="avaTimingPreview">{JSON.stringify(draft, null, 2)}</pre>
        {status && <p className="avaTinyStatus">{status}</p>}
      </section>
    </div>
  )
}
