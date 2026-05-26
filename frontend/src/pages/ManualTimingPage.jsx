import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Clock3, Pause, Play, RotateCcw, Save, StepBack, StepForward, Undo2, UploadCloud } from 'lucide-react'
import { useProjects } from '../context/ProjectContext.jsx'
import { fetchProtectedBlobUrl, uploadAudioAsset } from '../services/apiClient.js'

const STAGE = 'manual_timing'
const DRAFT_VERSION = 'manual_timing_single_timeline_v2_audio_upload'

const emptyDraft = {
  timingDraftVersion: DRAFT_VERSION,
  audioName: '',
  audioAssetId: '',
  audioApiPath: '',
  audioUrl: '',
  audioSizeBytes: 0,
  audioDurationSec: 0,
  scenesCount: 1,
  selectedSceneIndex: 0,
  stepSec: 0.5,
  notes: '',
  updatedAt: null,
}

function normalizeDraft(data) {
  const parsedStep = Number(data?.stepSec)
  const parsedDuration = Number(data?.audioDurationSec)
  return {
    ...emptyDraft,
    ...(data || {}),
    timingDraftVersion: data?.timingDraftVersion || DRAFT_VERSION,
    audioName: data?.audioName || data?.audio_name || '',
    audioAssetId: data?.audioAssetId || data?.audio_asset_id || data?.asset_id || '',
    audioApiPath: data?.audioApiPath || data?.asset_api_path || '',
    audioUrl: data?.audioUrl || data?.asset_url || '',
    audioSizeBytes: Number.isFinite(Number(data?.audioSizeBytes)) ? Math.max(0, Number(data.audioSizeBytes)) : Number(data?.audio_size_bytes) || 0,
    audioDurationSec: Number.isFinite(parsedDuration) ? Math.max(0, parsedDuration) : 0,
    scenesCount: Number.isFinite(Number(data?.scenesCount)) ? Math.max(1, Number(data.scenesCount)) : 1,
    selectedSceneIndex: Number.isFinite(Number(data?.selectedSceneIndex)) ? Math.max(0, Number(data.selectedSceneIndex)) : 0,
    stepSec: Number.isFinite(parsedStep) ? Math.max(0.05, parsedStep) : 0.5,
  }
}

function formatTime(seconds, withMs = false) {
  const numeric = Math.max(0, Number(seconds) || 0)
  const safe = Math.floor(numeric)
  const mins = String(Math.floor(safe / 60)).padStart(2, '0')
  const secs = String(safe % 60).padStart(2, '0')
  if (!withMs) return `${mins}:${secs}`
  const ms = String(Math.floor((numeric - safe) * 1000)).padStart(3, '0')
  return `${mins}:${secs}.${ms}`
}

function formatBytes(bytes) {
  const size = Number(bytes) || 0
  if (!size) return '0 KB'
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function buildScenes(count, duration) {
  const safeCount = Math.max(1, Number(count) || 1)
  const safeDuration = Math.max(0, Number(duration) || 0)
  const layoutDuration = safeDuration > 0 ? safeDuration : safeCount
  return Array.from({ length: safeCount }).map((_, index) => {
    const start = (layoutDuration / safeCount) * index
    const end = (layoutDuration / safeCount) * (index + 1)
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

function clampCursor(value, duration) {
  return Math.min(Math.max(0, Number(value) || 0), Math.max(0, Number(duration) || 0))
}

export default function ManualTimingPage() {
  const { projectId } = useParams()
  const { activeProject, loadStage, saveStage, loadWorkspaceStage, saveWorkspaceStage } = useProjects()
  const workspaceMode = !projectId
  const [draft, setDraft] = useState(emptyDraft)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showDev, setShowDev] = useState(false)
  const [playingMode, setPlayingMode] = useState(null)
  const [cursorSec, setCursorSec] = useState(0)
  const [audioSrc, setAudioSrc] = useState('')
  const audioRef = useRef(null)
  const fileInputRef = useRef(null)

  const hasAudio = Boolean(draft.audioAssetId || draft.audioApiPath || draft.audioUrl)
  const scenes = useMemo(() => buildScenes(draft.scenesCount, draft.audioDurationSec), [draft.scenesCount, draft.audioDurationSec])
  const selectedScene = scenes[Math.min(draft.selectedSceneIndex, scenes.length - 1)] || scenes[0]
  const scopeTitle = workspaceMode ? 'Рабочая область' : activeProject?.name || 'Проект'
  const cursorPct = draft.audioDurationSec > 0 ? Math.min(100, Math.max(0, (cursorSec / draft.audioDurationSec) * 100)) : 0

  useEffect(() => {
    let active = true
    async function loadDraft() {
      setLoading(true)
      setStatus('загрузка snapshot…')
      try {
        const data = workspaceMode ? await loadWorkspaceStage(STAGE) : await loadStage(projectId, STAGE)
        if (!active) return
        const normalized = normalizeDraft(data)
        setDraft(normalized)
        setCursorSec(0)
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

  useEffect(() => {
    let cancelled = false
    let objectUrl = ''

    async function loadAudioBlob() {
      setAudioSrc('')
      if (!draft.audioApiPath) return
      try {
        objectUrl = await fetchProtectedBlobUrl(draft.audioApiPath)
        if (!cancelled) setAudioSrc(objectUrl)
      } catch (err) {
        if (!cancelled) setStatus(`ошибка аудио: ${err.message}`)
      }
    }

    loadAudioBlob()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [draft.audioApiPath])

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
  }, [draft.audioName, draft.audioAssetId, draft.audioApiPath, draft.audioSizeBytes, draft.audioDurationSec, draft.scenesCount, draft.selectedSceneIndex, draft.stepSec, draft.notes])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return undefined

    function handleTimeUpdate() {
      const current = audio.currentTime || 0
      setCursorSec(current)
      if (playingMode === 'scene' && selectedScene && current >= selectedScene.end) {
        audio.pause()
        audio.currentTime = selectedScene.end
        setCursorSec(selectedScene.end)
        setPlayingMode(null)
      }
    }

    function handleEnded() {
      setPlayingMode(null)
      setCursorSec(audio.duration || 0)
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [playingMode, selectedScene?.start, selectedScene?.end])

  function stopAudio(nextCursor = cursorSec) {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = clampCursor(nextCursor, draft.audioDurationSec)
    }
    setCursorSec(clampCursor(nextCursor, draft.audioDurationSec))
    setPlayingMode(null)
  }

  function updateDraft(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function selectScene(sceneIndex) {
    const nextScene = scenes[Math.min(sceneIndex, scenes.length - 1)] || scenes[0]
    stopAudio(nextScene?.start || 0)
    updateDraft('selectedSceneIndex', sceneIndex)
  }

  async function handleAudioUpload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    stopAudio(0)
    setStatus('загрузка аудио…')
    try {
      const result = await uploadAudioAsset({ file, projectId: workspaceMode ? null : projectId, stage: STAGE })
      const duration = Math.max(0, Number(result.audio_duration_sec) || 0)
      const nextDraft = {
        ...draft,
        audioName: result.audio_name || file.name,
        audioAssetId: result.asset_id || '',
        audioApiPath: result.asset_api_path || '',
        audioUrl: result.asset_url || '',
        audioSizeBytes: result.audio_size_bytes || file.size || 0,
        audioDurationSec: duration,
        scenesCount: 1,
        selectedSceneIndex: 0,
      }
      setDraft(nextDraft)
      setCursorSec(0)
      await saveDraft(nextDraft, 'audio_upload')
      setStatus('аудио загружено')
    } catch (err) {
      setStatus(`ошибка загрузки аудио: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  async function handleLoadedMetadata() {
    const audio = audioRef.current
    const duration = Number(audio?.duration)
    if (!Number.isFinite(duration) || duration <= 0) return
    if (Math.abs(duration - Number(draft.audioDurationSec || 0)) < 0.05) return
    const nextDraft = { ...draft, audioDurationSec: Number(duration.toFixed(3)) }
    setDraft(nextDraft)
    await saveDraft(nextDraft, 'audio_metadata_duration')
  }

  async function toggleScenePlay() {
    const audio = audioRef.current
    if (!audio || !hasAudio) return
    if (playingMode === 'scene') {
      stopAudio(audio.currentTime || selectedScene.start)
      return
    }
    setPlayingMode('scene')
    audio.currentTime = selectedScene.start
    setCursorSec(selectedScene.start)
    try {
      await audio.play()
    } catch (err) {
      setPlayingMode(null)
      setStatus(`ошибка проигрывания: ${err.message}`)
    }
  }

  async function toggleAllPlay() {
    const audio = audioRef.current
    if (!audio || !hasAudio) return
    if (playingMode === 'all') {
      stopAudio(audio.currentTime || 0)
      return
    }
    setPlayingMode('all')
    audio.currentTime = 0
    setCursorSec(0)
    try {
      await audio.play()
    } catch (err) {
      setPlayingMode(null)
      setStatus(`ошибка проигрывания: ${err.message}`)
    }
  }

  return (
    <div className="avaPage avaTimingFlatPage">
      <audio ref={audioRef} src={audioSrc} preload="metadata" onLoadedMetadata={handleLoadedMetadata} />
      <input ref={fileInputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm" hidden onChange={handleAudioUpload} />

      <div className="avaTimingFlatHeader">
        <div>
          <p><Clock3 size={15} /> STAGE 3.3 · audio upload foundation</p>
          <h2>Тайминг · Клип / Music video</h2>
          <span>ASR → song structure → Clip Pass</span>
        </div>
        <div className="avaTimingHeaderActions">
          <button className="avaSoftButton" type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading || loading}>
            <UploadCloud size={16} /> {uploading ? 'Загрузка…' : 'Загрузить аудио'}
          </button>
          <button className="avaPrimaryButton" type="button" onClick={() => saveDraft(draft, 'button_save')} disabled={saving || loading}>
            <Save size={16} /> {saving ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </div>

      <div className="avaTimingPillLine">
        <span>Файл: <b>{draft.audioName || 'аудио не выбрано'}</b></span>
        <span>Размер: <b>{formatBytes(draft.audioSizeBytes)}</b></span>
        <span>Длительность: <b>{draft.audioDurationSec ? formatTime(draft.audioDurationSec) : '00:00'}</b></span>
        <span>Курсор: <b>{formatTime(cursorSec, true)}</b></span>
        <span>Сцен: <b>{scenes.length}</b></span>
        <span>Статус: <b>{status}</b></span>
        <span>Режим: <b>{scopeTitle}</b></span>
      </div>

      {!hasAudio && (
        <div className="avaTimingAudioWarning">
          Аудио не выбрано. Загрузите mp3/wav, чтобы проверить проигрывание выбранной сцены и всего файла.
        </div>
      )}

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
          <div className="avaTimingCursorLabel" style={{ left: `${cursorPct}%` }}>{formatTime(cursorSec, true)}</div>
          <div className="avaTimingWaveLong">
            {Array.from({ length: 180 }).map((_, index) => <i key={index} style={{ '--h': `${14 + ((index * 19) % 74)}%` }} />)}
          </div>
          <div className="avaTimingPlayhead" style={{ left: `${cursorPct}%` }} />
          <div className="avaTimingSegmentsRow">
            {scenes.map((scene) => (
              <button key={scene.id} type="button" style={{ width: scene.width }} className={scene.index === selectedScene.index ? 'isActive' : ''} onClick={() => selectScene(scene.index)}>
                <b>{scene.title}</b>
                <small>{formatTime(scene.start)} → {formatTime(scene.end)}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="avaTimingToolRail">
          <button className={`avaTimingBigPlay ${playingMode === 'scene' ? 'isPlaying' : ''}`} type="button" onClick={toggleScenePlay} title="Прослушать выбранную сцену" disabled={!hasAudio || !audioSrc}>
            {playingMode === 'scene' ? <Pause size={24} /> : <Play size={26} />}
          </button>
          <button className={`avaTimingPlayAll ${playingMode === 'all' ? 'isPlaying' : ''}`} type="button" onClick={toggleAllPlay} disabled={!hasAudio || !audioSrc}>▶ всё</button>

          <button className="avaTimingIconButton" type="button" disabled title="Назад на шаг"><StepBack size={15} /></button>
          <label className="avaTimingStepControl" title="Шаг перемещения">
            шаг
            <input type="number" min="0.05" step="0.05" value={draft.stepSec ?? 0.5} onChange={(event) => updateDraft('stepSec', Number(event.target.value) || 0.5)} />
          </label>
          <button className="avaTimingIconButton" type="button" disabled title="Вперёд на шаг"><StepForward size={15} /></button>

          <button type="button" disabled>✂ Разрезать</button>
          <button type="button" disabled>🔗 Соединить</button>
          <button type="button" disabled>+ Смысловой блок</button>
          <button type="button" disabled>тишина после</button>
          <button type="button" disabled>тишина до</button>
          <button className="isReset" type="button" disabled><RotateCcw size={15} /> сброс</button>
          <button type="button" disabled><Undo2 size={15} /> вернуть</button>
          <button className="avaTimingDevButton" type="button" onClick={() => setShowDev((value) => !value)}>{showDev ? 'Скрыть dev' : 'dev'}</button>
        </div>

        {showDev && (
          <div className="avaTimingDevLine">
            <label>audio <input value={draft.audioName} onChange={(event) => updateDraft('audioName', event.target.value)} placeholder="example.mp3" /></label>
            <label>duration <input type="number" min="0" value={draft.audioDurationSec} onChange={(event) => updateDraft('audioDurationSec', Number(event.target.value))} /></label>
            <label>scenes <input type="number" min="1" value={draft.scenesCount} onChange={(event) => updateDraft('scenesCount', Number(event.target.value))} /></label>
          </div>
        )}
      </section>
    </div>
  )
}
