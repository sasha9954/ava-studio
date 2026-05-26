import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AudioLines, Clock3, FileAudio, FileJson, ListChecks, MessageSquareText, Play, Save, Scissors, ShieldCheck, UploadCloud, WandSparkles } from 'lucide-react'
import { useProjects } from '../context/ProjectContext.jsx'

const STAGE = 'manual_timing'
const DRAFT_VERSION = 'manual_timing_ui_shell_v1'

const emptyDraft = {
  timingDraftVersion: DRAFT_VERSION,
  audioName: '',
  audioDurationSec: 0,
  scenesCount: 0,
  selectedSceneId: 'scene_001',
  notes: '',
  updatedAt: null,
  uiShellReady: true,
}

const demoScenes = [
  { id: 'scene_001', title: 'Сцена 1', time: '00:00–00:08', status: 'draft' },
  { id: 'scene_002', title: 'Сцена 2', time: '00:08–00:16', status: 'empty' },
  { id: 'scene_003', title: 'Сцена 3', time: '00:16–00:24', status: 'empty' },
]

function normalizeDraft(data) {
  return {
    ...emptyDraft,
    ...(data || {}),
    timingDraftVersion: data?.timingDraftVersion || DRAFT_VERSION,
    audioDurationSec: Number.isFinite(Number(data?.audioDurationSec)) ? Number(data.audioDurationSec) : 0,
    scenesCount: Number.isFinite(Number(data?.scenesCount)) ? Number(data.scenesCount) : 0,
    selectedSceneId: data?.selectedSceneId || 'scene_001',
  }
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

  const scopeLabel = useMemo(() => {
    if (workspaceMode) return 'Рабочая область без проекта'
    return activeProject?.name ? `Проект: ${activeProject.name}` : `Проект: ${projectId}`
  }, [workspaceMode, activeProject, projectId])

  const selectedScene = demoScenes.find((scene) => scene.id === draft.selectedSceneId) || demoScenes[0]

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
    const timer = window.setTimeout(() => saveDraft(draft, 'autosave'), 1200)
    return () => window.clearTimeout(timer)
  }, [draft.audioName, draft.audioDurationSec, draft.scenesCount, draft.notes, draft.selectedSceneId])

  function updateDraft(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="avaPage avaTimingPage">
      <div className="avaSectionHeader">
        <div>
          <p className="avaEyebrow"><Clock3 size={15} /> stage 3.2 manual timing ui shell</p>
          <h2>Manual Timing</h2>
          <p>Новая чистая оболочка для старого тайминга: без лишнего, с backend snapshot и готовыми зонами для переноса.</p>
        </div>
        <button className="avaPrimaryButton" type="button" onClick={() => saveDraft(draft, 'button_save')} disabled={saving || loading}>
          <Save size={16} /> {saving ? 'Сохраняем…' : 'Сохранить snapshot'}
        </button>
      </div>

      <div className="avaTimingHero avaTimingHeroCompact">
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

      <div className="avaTimingWorkbench">
        <section className="avaPanel avaTimingPanel avaTimingAudioPanel">
          <div className="avaTimingPanelHeader">
            <div>
              <p className="avaEyebrow"><FileAudio size={15} /> audio source</p>
              <h3>Аудио</h3>
            </div>
            <button className="avaGhostButton" type="button" disabled><UploadCloud size={15} /> загрузка позже</button>
          </div>
          <label>
            Имя аудио / пока тестовое поле
            <input value={draft.audioName} onChange={(event) => updateDraft('audioName', event.target.value)} placeholder="example_song.mp3" />
          </label>
          <label>
            Duration sec / тестовая длительность
            <input type="number" min="0" value={draft.audioDurationSec} onChange={(event) => updateDraft('audioDurationSec', Number(event.target.value))} />
          </label>
          <div className="avaTimingMiniStatusGrid">
            <span>source</span><strong>{draft.audioName || 'не выбран'}</strong>
            <span>duration</span><strong>{draft.audioDurationSec || 0}s</strong>
            <span>save</span><strong>{saving ? 'saving…' : 'autosave ready'}</strong>
          </div>
        </section>

        <section className="avaPanel avaTimingPanel avaTimingTimelinePanel">
          <div className="avaTimingPanelHeader">
            <div>
              <p className="avaEyebrow"><AudioLines size={15} /> timeline</p>
              <h3>Таймлайн</h3>
            </div>
            <button className="avaGhostButton" type="button" disabled><Play size={15} /> player later</button>
          </div>
          <div className="avaTimingFakeWave">
            {Array.from({ length: 42 }).map((_, index) => <span key={index} style={{ '--h': `${18 + ((index * 17) % 62)}%` }} />)}
          </div>
          <div className="avaTimingSceneStrip">
            {demoScenes.map((scene) => (
              <button key={scene.id} type="button" className={scene.id === draft.selectedSceneId ? 'isActive' : ''} onClick={() => updateDraft('selectedSceneId', scene.id)}>
                {scene.title}<small>{scene.time}</small>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="avaTimingBottomGrid">
        <section className="avaPanel avaTimingPanel">
          <p className="avaEyebrow"><ListChecks size={15} /> scenes</p>
          <h3>Сцены</h3>
          <label>
            Количество сцен / тест
            <input type="number" min="0" value={draft.scenesCount} onChange={(event) => updateDraft('scenesCount', Number(event.target.value))} />
          </label>
          <div className="avaTimingSceneList">
            {demoScenes.map((scene) => (
              <button key={scene.id} type="button" className={scene.id === draft.selectedSceneId ? 'isActive' : ''} onClick={() => updateDraft('selectedSceneId', scene.id)}>
                <strong>{scene.title}</strong><span>{scene.time}</span><small>{scene.status}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="avaPanel avaTimingPanel">
          <p className="avaEyebrow"><MessageSquareText size={15} /> inspector</p>
          <h3>Инспектор сцены</h3>
          <div className="avaTimingInspectorCard">
            <strong>{selectedScene.title}</strong>
            <span>{selectedScene.time}</span>
            <p>Здесь позже будут слова сцены, ASR-фразы, перевод, warning об обрезанных фразах и управление выбранной сценой.</p>
          </div>
          <label>
            Notes / заметка
            <textarea value={draft.notes} onChange={(event) => updateDraft('notes', event.target.value)} placeholder="Что важно помнить по таймингу…" />
          </label>
        </section>

        <section className="avaPanel avaTimingPanel">
          <p className="avaEyebrow"><FileJson size={15} /> handoff</p>
          <h3>Экспорт / связь</h3>
          <div className="avaTimingActionStack">
            <button className="avaGhostButton" type="button" disabled><Scissors size={15} /> Split позже</button>
            <button className="avaGhostButton" type="button" disabled><WandSparkles size={15} /> ASR позже</button>
            <button className="avaGhostButton" type="button" disabled><FileJson size={15} /> Export to Board позже</button>
          </div>
          <pre className="avaTimingPreview compact">{JSON.stringify(draft, null, 2)}</pre>
        </section>
      </div>

      {status && <p className="avaTinyStatus">{status}</p>}
    </div>
  )
}
