import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Clock3, FileAudio, Plus, Save, Scissors, ShieldCheck } from 'lucide-react'
import { useProjects } from '../context/ProjectContext.jsx'

const STAGE = 'manual_timing'
const DRAFT_VERSION = 'manual_timing_timeline_shell_v1'

const emptyDraft = {
  timingDraftVersion: DRAFT_VERSION,
  audioName: '',
  audioDurationSec: 90,
  scenesCount: 6,
  selectedSceneIndex: 0,
  notes: '',
  updatedAt: null,
}

function normalizeDraft(data) {
  return {
    ...emptyDraft,
    ...(data || {}),
    timingDraftVersion: data?.timingDraftVersion || DRAFT_VERSION,
    audioDurationSec: Number.isFinite(Number(data?.audioDurationSec)) ? Math.max(1, Number(data.audioDurationSec)) : 90,
    scenesCount: Number.isFinite(Number(data?.scenesCount)) ? Math.max(1, Number(data.scenesCount)) : 6,
    selectedSceneIndex: Number.isFinite(Number(data?.selectedSceneIndex)) ? Math.max(0, Number(data.selectedSceneIndex)) : 0,
  }
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0))
  const mins = String(Math.floor(safe / 60)).padStart(2, '0')
  const secs = String(safe % 60).padStart(2, '0')
  return `${mins}:${secs}`
}

function buildSceneSegments(count, duration) {
  const safeCount = Math.max(1, Number(count) || 1)
  const safeDuration = Math.max(1, Number(duration) || 1)
  return Array.from({ length: safeCount }).map((_, index) => {
    const start = (safeDuration / safeCount) * index
    const end = (safeDuration / safeCount) * (index + 1)
    return {
      id: `scene_${String(index + 1).padStart(3, '0')}`,
      index,
      title: `Сцена ${index + 1}`,
      start,
      end,
      width: `${100 / safeCount}%`,
    }
  })
}

export default function ManualTimingPage() {
  const { projectId } = useParams()
  const { activeProject, loadStage, saveStage, loadWorkspaceStage, saveWorkspaceStage } = useProjects()
  const workspaceMode = !projectId
  const [draft, setDraft] = useState(emptyDraft)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadedAt, setLoadedAt] = useState(null)
  const [showJson, setShowJson] = useState(false)

  const scopeLabel = useMemo(() => {
    if (workspaceMode) return 'Рабочая область'
    return activeProject?.name ? `Проект: ${activeProject.name}` : `Проект: ${projectId}`
  }, [workspaceMode, activeProject, projectId])

  const scenes = useMemo(() => buildSceneSegments(draft.scenesCount, draft.audioDurationSec), [draft.scenesCount, draft.audioDurationSec])
  const selectedScene = scenes[Math.min(draft.selectedSceneIndex, scenes.length - 1)] || scenes[0]

  useEffect(() => {
    let active = true
    async function loadDraft() {
      setLoading(true)
      setStatus(workspaceMode ? 'Загружаем workspace timing…' : 'Загружаем project timing…')
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
      if (workspaceMode) await saveWorkspaceStage(STAGE, payload)
      else await saveStage(projectId, STAGE, payload, 'replace')
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
    const timer = window.setTimeout(() => saveDraft(draft, 'autosave'), 1000)
    return () => window.clearTimeout(timer)
  }, [draft.audioName, draft.audioDurationSec, draft.scenesCount, draft.selectedSceneIndex, draft.notes])

  function updateDraft(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="avaPage avaTimingPage avaTimingTimelineFirst">
      <div className="avaSectionHeader avaTimingTopHeader">
        <div>
          <p className="avaEyebrow"><Clock3 size={15} /> stage 3.2 timeline-first shell</p>
          <h2>Manual Timing</h2>
          <p>Главная зона — длинная аудио-дорожка. Сцены размечаются прямо на таймлайне.</p>
        </div>
        <button className="avaPrimaryButton" type="button" onClick={() => saveDraft(draft, 'button_save')} disabled={saving || loading}>
          <Save size={16} /> {saving ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </div>

      <section className="avaPanel avaTimingMainPanel">
        <div className="avaTimingMainHead">
          <div>
            <p className="avaEyebrow"><ShieldCheck size={15} /> {scopeLabel}</p>
            <h3>{draft.audioName || 'Аудио ещё не загружено'}</h3>
            <span>{formatTime(draft.audioDurationSec)} · {scenes.length} сцен · {workspaceMode ? 'workspace save' : 'project save'}</span>
          </div>
          <div className="avaTimingStatusPills">
            <span>{DRAFT_VERSION}</span>
            <span>{saving ? 'saving…' : 'autosave ready'}</span>
            <span>{loadedAt ? `loaded ${new Date(loadedAt).toLocaleTimeString()}` : 'not loaded'}</span>
          </div>
        </div>

        <div className="avaLongTimeline">
          <div className="avaLongWave">
            {Array.from({ length: 120 }).map((_, index) => <i key={index} style={{ '--h': `${18 + ((index * 23) % 70)}%` }} />)}
          </div>
          <div className="avaTimelineScenes">
            {scenes.map((scene) => (
              <button key={scene.id} type="button" style={{ width: scene.width }} className={scene.index === selectedScene.index ? 'isActive' : ''} onClick={() => updateDraft('selectedSceneIndex', scene.index)}>
                <strong>{scene.title}</strong>
                <span>{formatTime(scene.start)}–{formatTime(scene.end)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="avaTimingControlsBar">
          <button className="avaGhostButton" type="button" disabled><FileAudio size={15} /> Загрузить аудио позже</button>
          <button className="avaGhostButton" type="button" disabled><Scissors size={15} /> Разрезать позже</button>
          <button className="avaGhostButton" type="button" disabled><Plus size={15} /> Добавить сцену позже</button>
          <button className="avaGhostButton" type="button" onClick={() => setShowJson((value) => !value)}>{showJson ? 'Скрыть JSON' : 'Показать JSON'}</button>
        </div>
      </section>

      <section className="avaPanel avaTimingCompactPanel">
        <div className="avaTimingSelectedScene">
          <p className="avaEyebrow">selected scene</p>
          <h3>{selectedScene.title}</h3>
          <span>{formatTime(selectedScene.start)}–{formatTime(selectedScene.end)}</span>
          <p>Позже здесь будут слова выбранной сцены, ASR-фразы, перевод и предупреждения об обрезке.</p>
        </div>

        <div className="avaTimingDraftFields">
          <label>
            Audio name / временно до upload
            <input value={draft.audioName} onChange={(event) => updateDraft('audioName', event.target.value)} placeholder="example.mp3" />
          </label>
          <label>
            Duration sec
            <input type="number" min="1" value={draft.audioDurationSec} onChange={(event) => updateDraft('audioDurationSec', Number(event.target.value))} />
          </label>
          <label>
            Scenes
            <input type="number" min="1" value={draft.scenesCount} onChange={(event) => updateDraft('scenesCount', Number(event.target.value))} />
          </label>
        </div>
      </section>

      <section className="avaPanel avaTimingNotesPanel">
        <label>
          Notes / заметка по таймингу
          <textarea value={draft.notes} onChange={(event) => updateDraft('notes', event.target.value)} placeholder="Что важно помнить по разметке…" />
        </label>
        {status && <p className="avaTinyStatus">{status}</p>}
      </section>

      {showJson && (
        <section className="avaPanel avaTimingPanel">
          <p className="avaEyebrow">snapshot JSON</p>
          <pre className="avaTimingPreview compact">{JSON.stringify(draft, null, 2)}</pre>
        </section>
      )}
    </div>
  )
}
