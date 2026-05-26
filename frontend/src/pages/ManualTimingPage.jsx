import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Clock3, Pause, Play, RotateCcw, Save, StepBack, StepForward, Undo2 } from 'lucide-react'
import { useProjects } from '../context/ProjectContext.jsx'

const STAGE = 'manual_timing'
const DRAFT_VERSION = 'manual_timing_single_timeline_v1'

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

function buildScenes(count, duration) {
  const safeCount = Math.max(1, Number(count) || 1)
  const safeDuration = Math.max(1, Number(duration) || 1)
  return Array.from({ length: safeCount }).map((_, index) => {
    const start = (safeDuration / safeCount) * index
    const end = (safeDuration / safeCount) * (index + 1)
    return {
      id: `seg_${String(index + 1).padStart(2, '0')}`,
      index,
      title: `seg_${String(index + 1).padStart(2, '0')}`,
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
  const [showDev, setShowDev] = useState(false)
  const [isPlayingScene, setIsPlayingScene] = useState(false)
  const [isPlayingAll, setIsPlayingAll] = useState(false)

  const scenes = useMemo(() => buildScenes(draft.scenesCount, draft.audioDurationSec), [draft.scenesCount, draft.audioDurationSec])
  const selectedScene = scenes[Math.min(draft.selectedSceneIndex, scenes.length - 1)] || scenes[0]
  const scopeTitle = workspaceMode ? 'Рабочая область' : activeProject?.name || 'Проект'

  useEffect(() => {
    let active = true
    async function loadDraft() {
      setLoading(true)
      setStatus('загрузка snapshot…')
      try {
        const data = workspaceMode ? await loadWorkspaceStage(STAGE) : await loadStage(projectId, STAGE)
        if (!active) return
        setDraft(normalizeDraft(data))
        setStatus('snapshot загружен')
      } catch (err) {
        if (!active) return
        setStatus(`ошибка загрузки: ${err.message}`)
      } finally {
        if (active) setLoading(false)
      }
    }
    loadDraft()
    return () => { active = false }
  }, [projectId, workspaceMode])

  async function saveDraft(nextDraft = draft, reason = 'manual_save') {
    setSaving(true)
    setStatus('сохранение…')
    const payload = { ...nextDraft, timingDraftVersion: DRAFT_VERSION, updatedAt: new Date().toISOString(), saveReason: reason }
    try {
      if (workspaceMode) await saveWorkspaceStage(STAGE, payload)
      else await saveStage(projectId, STAGE, payload, 'replace')
      setDraft(payload)
      setStatus('сохранено')
    } catch (err) {
      setStatus(`ошибка сохранения: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (loading) return undefined
    const timer = window.setTimeout(() => saveDraft(draft, 'autosave'), 900)
    return () => window.clearTimeout(timer)
  }, [draft.audioName, draft.audioDurationSec, draft.scenesCount, draft.selectedSceneIndex, draft.notes])

  function updateDraft(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function toggleScenePlay() {
    setIsPlayingScene((value) => !value)
    setIsPlayingAll(false)
  }

  function toggleAllPlay() {
    setIsPlayingAll((value) => !value)
    setIsPlayingScene(false)
  }

  return (
    <div className="avaPage avaTimingFlatPage">
      <div className="avaTimingFlatHeader">
        <div>
          <p><Clock3 size={15} /> STAGE 3.2 · single timeline shell</p>
          <h2>Тайминг · Клип / Music video</h2>
          <span>ASR → song structure → Clip Pass</span>
        </div>
        <button className="avaPrimaryButton" type="button" onClick={() => saveDraft(draft, 'button_save')} disabled={saving || loading}>
          <Save size={16} /> {saving ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </div>

      <div className="avaTimingPillLine">
        <span>Файл: <b>{draft.audioName || 'аудио не выбрано'}</b></span>
        <span>Длительность: <b>{formatTime(draft.audioDurationSec)}</b></span>
        <span>Курсор: <b>00:00</b></span>
        <span>Сцен: <b>{scenes.length}</b></span>
        <span>Статус: <b>{status}</b></span>
        <span>Режим: <b>{scopeTitle}</b></span>
      </div>

      <section className="avaTimingEditorPanel">
        <div className="avaTimingAsrStrip">
          <div>
            <strong>ASR / перевод · {selectedScene.title}</strong>
            <span>{formatTime(selectedScene.start)} → {formatTime(selectedScene.end)}</span>
          </div>
          <button type="button" disabled>скрыть перевод</button>
        </div>

        <div className="avaTimingSceneTextBox">
          <strong>Слова сцены / оригинал</strong>
          <p>Здесь позже будет оригинальная фраза выбранной сцены и русский перевод.</p>
        </div>

        <div className="avaTimingTimelineScale">
          <div className="avaTimingCursorLabel">00:00.000</div>
          <div className="avaTimingWaveLong">
            {Array.from({ length: 180 }).map((_, index) => <i key={index} style={{ '--h': `${14 + ((index * 19) % 74)}%` }} />)}
          </div>
          <div className="avaTimingSegmentsRow">
            {scenes.map((scene) => (
              <button key={scene.id} type="button" style={{ width: scene.width }} className={scene.index === selectedScene.index ? 'isActive' : ''} onClick={() => updateDraft('selectedSceneIndex', scene.index)}>
                <b>{scene.title}</b>
                <small>{formatTime(scene.start)} → {formatTime(scene.end)}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="avaTimingToolRail">
          <div className="avaTimingPlayCluster">
            <button className={`avaTimingBigPlay ${isPlayingScene ? 'isPlaying' : ''}`} type="button" onClick={toggleScenePlay} title="Прослушать выбранную сцену">
              {isPlayingScene ? <Pause size={24} /> : <Play size={26} />}
            </button>
            <button className={`avaTimingPlayAll ${isPlayingAll ? 'isPlaying' : ''}`} type="button" onClick={toggleAllPlay}>▶ всё</button>
          </div>

          <div className="avaTimingToolGroup">
            <button type="button" disabled><StepBack size={15} /> назад</button>
            <button type="button" disabled>шаг 0.5</button>
            <button type="button" disabled><StepForward size={15} /></button>
          </div>

          <div className="avaTimingToolGroup">
            <button type="button" disabled>✂ Разрезать</button>
            <button type="button" disabled>🔗 Соединить</button>
            <button type="button" disabled>+ Смысловой блок</button>
          </div>

          <div className="avaTimingToolGroup">
            <button type="button" disabled>тишина после</button>
            <button type="button" disabled>тишина до</button>
            <button className="isReset" type="button" disabled><RotateCcw size={15} /> сброс</button>
            <button type="button" disabled><Undo2 size={15} /> вернуть</button>
          </div>

          <button className="avaTimingDevButton" type="button" onClick={() => setShowDev((value) => !value)}>{showDev ? 'Скрыть dev' : 'dev'}</button>
        </div>

        {showDev && (
          <div className="avaTimingDevLine">
            <label>audio <input value={draft.audioName} onChange={(event) => updateDraft('audioName', event.target.value)} placeholder="example.mp3" /></label>
            <label>duration <input type="number" min="1" value={draft.audioDurationSec} onChange={(event) => updateDraft('audioDurationSec', Number(event.target.value))} /></label>
            <label>scenes <input type="number" min="1" value={draft.scenesCount} onChange={(event) => updateDraft('scenesCount', Number(event.target.value))} /></label>
          </div>
        )}
      </section>
    </div>
  )
}
