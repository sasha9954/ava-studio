import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Clock3, Pause, Play, RotateCcw, Save, StepBack, StepForward, Undo2, UploadCloud } from 'lucide-react'
import { useProjects } from '../context/ProjectContext.jsx'
import { fetchProtectedBlobUrl, uploadAudioAsset } from '../services/apiClient.js'

const STAGE = 'manual_timing'
const DRAFT_VERSION = 'manual_timing_single_timeline_v4_micro_nudge'
const MIN_SCENE_SEC = 0.18
const MAX_UNDO = 30

const emptyDraft = {
  timingDraftVersion: DRAFT_VERSION,
  audioName: '',
  audioAssetId: '',
  audioApiPath: '',
  audioUrl: '',
  audioSizeBytes: 0,
  audioDurationSec: 0,
  scenesCount: 1,
  scenes: [],
  selectedSceneIndex: 0,
  stepSec: 0.5,
  notes: '',
  updatedAt: null,
}

function formatSceneId(index) {
  return `seg_${String(index + 1).padStart(2, '0')}`
}

function makeScene(index, start, end, extra = {}) {
  return {
    ...extra,
    id: formatSceneId(index),
    index,
    title: formatSceneId(index),
    start: Number(start.toFixed(3)),
    end: Number(end.toFixed(3)),
  }
}

function renumberScenes(items) {
  return items.map((scene, index) => makeScene(index, scene.start, scene.end, scene))
}

function makeSingleScene(duration) {
  const safeDuration = Math.max(0, Number(duration) || 0)
  return [makeScene(0, 0, safeDuration)]
}

function buildEvenScenes(count, duration) {
  const safeCount = Math.max(1, Number(count) || 1)
  const safeDuration = Math.max(0, Number(duration) || 0)
  const layoutDuration = safeDuration > 0 ? safeDuration : safeCount
  return Array.from({ length: safeCount }).map((_, index) => {
    const start = (layoutDuration / safeCount) * index
    const end = (layoutDuration / safeCount) * (index + 1)
    return makeScene(index, start, end)
  })
}

function normalizeScenes(data, duration) {
  const safeDuration = Math.max(0, Number(duration) || 0)
  const rawScenes = Array.isArray(data?.scenes) ? data.scenes : []

  if (rawScenes.length) {
    const maxEnd = Math.max(safeDuration, ...rawScenes.map((scene) => Number(scene?.end) || 0), 1)
    const cleaned = rawScenes
      .map((scene) => {
        const start = Math.max(0, Number(scene?.start) || 0)
        const end = Math.max(start, Number(scene?.end) || 0)
        const limit = safeDuration > 0 ? safeDuration : maxEnd
        return {
          ...scene,
          start: Math.min(start, limit),
          end: Math.min(end, limit),
        }
      })
      .filter((scene) => scene.end - scene.start > 0.01)
      .sort((a, b) => a.start - b.start)

    if (cleaned.length) return renumberScenes(cleaned)
  }

  if (Number(data?.scenesCount) > 1) return buildEvenScenes(data.scenesCount, safeDuration)
  return makeSingleScene(safeDuration)
}

function normalizeDraft(data) {
  const parsedStep = Number(data?.stepSec)
  const parsedDuration = Number(data?.audioDurationSec)
  const duration = Number.isFinite(parsedDuration) ? Math.max(0, parsedDuration) : 0
  const scenes = normalizeScenes(data || {}, duration)
  const selectedIndex = Number.isFinite(Number(data?.selectedSceneIndex)) ? Number(data.selectedSceneIndex) : 0

  return {
    ...emptyDraft,
    ...(data || {}),
    timingDraftVersion: data?.timingDraftVersion || DRAFT_VERSION,
    audioName: data?.audioName || data?.audio_name || '',
    audioAssetId: data?.audioAssetId || data?.audio_asset_id || data?.asset_id || '',
    audioApiPath: data?.audioApiPath || data?.asset_api_path || '',
    audioUrl: data?.audioUrl || data?.asset_url || '',
    audioSizeBytes: Number.isFinite(Number(data?.audioSizeBytes)) ? Math.max(0, Number(data.audioSizeBytes)) : Number(data?.audio_size_bytes) || 0,
    audioDurationSec: duration,
    scenes,
    scenesCount: scenes.length,
    selectedSceneIndex: Math.min(Math.max(0, selectedIndex), scenes.length - 1),
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

function clampCursor(value, duration) {
  return Math.min(Math.max(0, Number(value) || 0), Math.max(0, Number(duration) || 0))
}

function findSceneIndexAtTime(scenes, time) {
  const at = Number(time) || 0
  const found = scenes.findIndex((scene) => at >= scene.start && at <= scene.end)
  return found >= 0 ? found : Math.max(0, scenes.length - 1)
}

function sceneHue(index) {
  return 185 + ((index * 47) % 150)
}

export default function ManualTimingPage() {
  const { projectId } = useParams()
  const { activeProject, loadStage, saveStage, loadWorkspaceStage, saveWorkspaceStage } = useProjects()
  const workspaceMode = !projectId
  const [draft, setDraft] = useState(emptyDraft)
  const [history, setHistory] = useState([])
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
  const scenes = useMemo(() => normalizeScenes(draft, draft.audioDurationSec), [draft.scenes, draft.scenesCount, draft.audioDurationSec])
  const selectedScene = scenes[Math.min(draft.selectedSceneIndex, scenes.length - 1)] || scenes[0] || makeScene(0, 0, 0)
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
        setHistory([])
        setCursorSec(normalized.scenes?.[normalized.selectedSceneIndex]?.start || 0)
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
    const quiet = reason === 'autosave'
    if (!quiet) {
      setSaving(true)
      setStatus('сохранение…')
    }
    const normalized = normalizeDraft(nextDraft)
    const payload = { ...normalized, timingDraftVersion: DRAFT_VERSION, updatedAt: new Date().toISOString(), saveReason: reason }
    try {
      if (workspaceMode) await saveWorkspaceStage(STAGE, payload)
      else await saveStage(projectId, STAGE, payload, 'replace')
      setDraft(payload)
      if (!quiet) setStatus('сохранено')
    } catch (err) {
      setStatus(`ошибка сохранения: ${err.message}`)
    } finally {
      if (!quiet) setSaving(false)
    }
  }

  useEffect(() => {
    if (loading) return undefined
    const timer = window.setTimeout(() => saveDraft(draft, 'autosave'), 900)
    return () => window.clearTimeout(timer)
  }, [draft.audioName, draft.audioAssetId, draft.audioApiPath, draft.audioSizeBytes, draft.audioDurationSec, draft.scenes, draft.selectedSceneIndex, draft.stepSec, draft.notes])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return undefined

    function handleEnded() {
      setPlayingMode(null)
      setCursorSec(audio.duration || draft.audioDurationSec || 0)
    }

    audio.addEventListener('ended', handleEnded)
    return () => {
      audio.removeEventListener('ended', handleEnded)
    }
  }, [draft.audioDurationSec])

  useEffect(() => {
    if (!playingMode) return undefined
    let frameId = 0

    function tick() {
      const audio = audioRef.current
      if (!audio) return
      const current = audio.currentTime || 0

      if (playingMode === 'scene' && selectedScene && current >= selectedScene.end - 0.01) {
        audio.pause()
        audio.currentTime = selectedScene.end
        setCursorSec(selectedScene.end)
        setPlayingMode(null)
        return
      }

      setCursorSec(current)
      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [playingMode, selectedScene?.start, selectedScene?.end])

  function stopAudio(nextCursor = cursorSec) {
    const next = clampCursor(nextCursor, draft.audioDurationSec)
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = next
    }
    setCursorSec(next)
    setPlayingMode(null)
  }

  function updateDraft(key, value) {
    setDraft((prev) => normalizeDraft({ ...prev, [key]: value }))
  }

  function pushHistorySnapshot() {
    setHistory((items) => [...items.slice(-MAX_UNDO + 1), normalizeDraft(draft)])
  }

  function applyDraftChange(nextDraft, message, nextCursor = cursorSec) {
    const normalized = normalizeDraft(nextDraft)
    stopAudio(nextCursor)
    setDraft(normalized)
    setStatus(message)
  }

  function selectScene(sceneIndex) {
    const nextScene = scenes[Math.min(sceneIndex, scenes.length - 1)] || scenes[0]
    stopAudio(nextScene?.start || 0)
    setDraft((prev) => normalizeDraft({ ...prev, selectedSceneIndex: sceneIndex }))
  }

  function seekTimeline(event) {
    if (!hasAudio || draft.audioDurationSec <= 0) return
    if (event.target.closest('button')) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left + event.currentTarget.scrollLeft
    const totalWidth = event.currentTarget.scrollWidth || rect.width
    const at = clampCursor((x / totalWidth) * draft.audioDurationSec, draft.audioDurationSec)
    const sceneIndex = findSceneIndexAtTime(scenes, at)
    stopAudio(at)
    setDraft((prev) => normalizeDraft({ ...prev, selectedSceneIndex: sceneIndex }))
    setStatus(`курсор: ${formatTime(at, true)}`)
  }

  function nudgeSelectedScene(deltaForSelected) {
    if (!hasAudio || scenes.length <= 1) {
      setStatus('нужны минимум две сцены')
      return
    }

    const index = Math.min(draft.selectedSceneIndex, scenes.length - 1)
    const selected = scenes[index]
    const step = Math.abs(Number(draft.stepSec) || 0.5)
    const direction = deltaForSelected >= 0 ? 1 : -1
    const nextScenes = scenes.map((scene) => ({ ...scene }))
    let boundary = selected.end
    let message = ''

    pushHistorySnapshot()

    if (index < scenes.length - 1) {
      const next = nextScenes[index + 1]
      const minBoundary = selected.start + MIN_SCENE_SEC
      const maxBoundary = next.end - MIN_SCENE_SEC
      const currentBoundary = nextScenes[index].end
      boundary = Math.min(maxBoundary, Math.max(minBoundary, currentBoundary + direction * step))
      nextScenes[index].end = boundary
      next.start = boundary
      message = direction > 0 ? `+${step}s к ${selected.title}` : `-${step}s от ${selected.title}`
    } else {
      const previous = nextScenes[index - 1]
      const minBoundary = previous.start + MIN_SCENE_SEC
      const maxBoundary = selected.end - MIN_SCENE_SEC
      const currentBoundary = nextScenes[index].start
      boundary = Math.min(maxBoundary, Math.max(minBoundary, currentBoundary - direction * step))
      previous.end = boundary
      nextScenes[index].start = boundary
      message = direction > 0 ? `+${step}s к ${selected.title}` : `-${step}s от ${selected.title}`
    }

    const normalizedScenes = renumberScenes(nextScenes)
    applyDraftChange({ ...draft, scenes: normalizedScenes, scenesCount: normalizedScenes.length, selectedSceneIndex: index }, message, boundary)
  }

  function splitAtCursor() {
    if (!hasAudio || draft.audioDurationSec <= 0) {
      setStatus('сначала загрузите аудио')
      return
    }
    const at = clampCursor(cursorSec, draft.audioDurationSec)
    const sceneIndex = findSceneIndexAtTime(scenes, at)
    const scene = scenes[sceneIndex]
    if (!scene || at - scene.start < MIN_SCENE_SEC || scene.end - at < MIN_SCENE_SEC) {
      setStatus('разрез слишком близко к краю сцены')
      return
    }

    pushHistorySnapshot()
    const nextScenes = renumberScenes([
      ...scenes.slice(0, sceneIndex),
      { ...scene, start: scene.start, end: at },
      { start: at, end: scene.end },
      ...scenes.slice(sceneIndex + 1),
    ])
    applyDraftChange({ ...draft, scenes: nextScenes, scenesCount: nextScenes.length, selectedSceneIndex: sceneIndex + 1 }, 'сцена разрезана', at)
  }

  function mergeSelectedWithNext() {
    if (scenes.length <= 1) {
      setStatus('соединять нечего')
      return
    }
    const index = Math.min(draft.selectedSceneIndex, scenes.length - 1)
    if (index >= scenes.length - 1) {
      setStatus('выберите сцену перед следующей')
      return
    }

    pushHistorySnapshot()
    const merged = { ...scenes[index], start: scenes[index].start, end: scenes[index + 1].end }
    const nextScenes = renumberScenes([
      ...scenes.slice(0, index),
      merged,
      ...scenes.slice(index + 2),
    ])
    applyDraftChange({ ...draft, scenes: nextScenes, scenesCount: nextScenes.length, selectedSceneIndex: index }, 'сцены соединены', merged.start)
  }

  function resetScenes() {
    if (!hasAudio || draft.audioDurationSec <= 0) {
      setStatus('сначала загрузите аудио')
      return
    }
    pushHistorySnapshot()
    const nextScenes = makeSingleScene(draft.audioDurationSec)
    applyDraftChange({ ...draft, scenes: nextScenes, scenesCount: 1, selectedSceneIndex: 0 }, 'разметка сброшена', 0)
  }

  function undoLastChange() {
    setHistory((items) => {
      const previous = items[items.length - 1]
      if (!previous) {
        setStatus('нет действий для возврата')
        return items
      }
      const restored = normalizeDraft(previous)
      const nextCursor = restored.scenes?.[restored.selectedSceneIndex]?.start || 0
      stopAudio(nextCursor)
      setDraft(restored)
      setStatus('возвращено')
      return items.slice(0, -1)
    })
  }

  function markSemanticBlock() {
    pushHistorySnapshot()
    const index = Math.min(draft.selectedSceneIndex, scenes.length - 1)
    const nextScenes = scenes.map((scene, sceneIndex) => (
      sceneIndex === index ? { ...scene, semanticBlock: !scene.semanticBlock } : scene
    ))
    applyDraftChange({ ...draft, scenes: nextScenes, selectedSceneIndex: index }, nextScenes[index]?.semanticBlock ? 'смысловой блок отмечен' : 'смысловой блок снят', selectedScene.start)
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
      const nextScenes = makeSingleScene(duration)
      const nextDraft = normalizeDraft({
        ...draft,
        audioName: result.audio_name || file.name,
        audioAssetId: result.asset_id || '',
        audioApiPath: result.asset_api_path || '',
        audioUrl: result.asset_url || '',
        audioSizeBytes: result.audio_size_bytes || file.size || 0,
        audioDurationSec: duration,
        scenes: nextScenes,
        scenesCount: nextScenes.length,
        selectedSceneIndex: 0,
      })
      setHistory([])
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
    const nextScenes = scenes.length === 1 ? makeSingleScene(duration) : scenes
    const nextDraft = normalizeDraft({ ...draft, audioDurationSec: Number(duration.toFixed(3)), scenes: nextScenes, scenesCount: nextScenes.length })
    setDraft(nextDraft)
    await saveDraft(nextDraft, 'audio_metadata_duration')
  }

  async function toggleScenePlay() {
    const audio = audioRef.current
    if (!audio || !hasAudio) return
    if (playingMode === 'scene') {
      const pausedAt = clampCursor(audio.currentTime || cursorSec, draft.audioDurationSec)
      audio.pause()
      setCursorSec(pausedAt)
      setPlayingMode(null)
      return
    }
    const current = clampCursor(audio.currentTime || cursorSec, draft.audioDurationSec)
    const canResumeInsideScene = current > selectedScene.start + 0.01 && current < selectedScene.end - 0.01
    const startAt = canResumeInsideScene ? current : selectedScene.start
    setPlayingMode('scene')
    audio.currentTime = startAt
    setCursorSec(startAt)
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
      const pausedAt = clampCursor(audio.currentTime || cursorSec, draft.audioDurationSec)
      audio.pause()
      setCursorSec(pausedAt)
      setPlayingMode(null)
      return
    }
    const current = clampCursor(audio.currentTime || cursorSec, draft.audioDurationSec)
    const canResumeInsideTrack = current > 0.01 && current < draft.audioDurationSec - 0.01
    const startAt = canResumeInsideTrack ? current : 0
    setPlayingMode('all')
    audio.currentTime = startAt
    setCursorSec(startAt)
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
          <p><Clock3 size={15} /> STAGE 3.4 · basic timing controls</p>
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

        <div className="avaTimingTimelineScale" onClick={seekTimeline} onDoubleClick={splitAtCursor}>
          <div className="avaTimingCursorLabel" style={{ left: `${cursorPct}%` }}>{formatTime(cursorSec, true)}</div>
          <div className="avaTimingWaveLong">
            {Array.from({ length: 180 }).map((_, index) => <i key={index} style={{ '--h': `${14 + ((index * 19) % 74)}%` }} />)}
          </div>
          <div className="avaTimingPlayhead" style={{ left: `${cursorPct}%` }} />
          <div className="avaTimingSegmentsRow">
            {scenes.map((scene) => {
              const sceneWidth = draft.audioDurationSec > 0 ? `${Math.max(0.5, ((scene.end - scene.start) / draft.audioDurationSec) * 100)}%` : `${100 / scenes.length}%`
              return (
                <button
                  key={`${scene.id}-${scene.start}-${scene.end}`}
                  type="button"
                  style={{ width: sceneWidth, '--scene-hue': sceneHue(scene.index) }}
                  className={`${scene.index === selectedScene.index ? 'isActive' : ''} ${scene.semanticBlock ? 'isSemantic' : ''}`}
                  onClick={() => selectScene(scene.index)}
                >
                  <b>{scene.title}</b>
                  <small>{formatTime(scene.start)} → {formatTime(scene.end)}</small>
                </button>
              )
            })}
          </div>
        </div>

        <div className="avaTimingToolRail">
          <button className={`avaTimingBigPlay ${playingMode === 'scene' ? 'isPlaying' : ''}`} type="button" onClick={toggleScenePlay} title="Прослушать выбранную сцену" disabled={!hasAudio || !audioSrc}>
            {playingMode === 'scene' ? <Pause size={24} /> : <Play size={26} />}
          </button>
          <button className={`avaTimingPlayAll ${playingMode === 'all' ? 'isPlaying' : ''}`} type="button" onClick={toggleAllPlay} disabled={!hasAudio || !audioSrc}>▶ всё</button>

          <button className="avaTimingIconButton" type="button" onClick={() => nudgeSelectedScene(-Math.abs(Number(draft.stepSec) || 0.5))} disabled={!hasAudio || scenes.length <= 1} title="Отнять шаг от текущей сцены и отдать соседней"><StepBack size={15} /></button>
          <label className="avaTimingStepControl" title="Шаг микро-доводки границы выбранной сцены">
            шаг
            <input type="number" min="0.05" step="0.05" value={draft.stepSec ?? 0.5} onChange={(event) => updateDraft('stepSec', Number(event.target.value) || 0.5)} />
          </label>
          <button className="avaTimingIconButton" type="button" onClick={() => nudgeSelectedScene(Math.abs(Number(draft.stepSec) || 0.5))} disabled={!hasAudio || scenes.length <= 1} title="Добавить шаг к текущей сцене за счёт соседней"><StepForward size={15} /></button>

          <button type="button" onClick={splitAtCursor} disabled={!hasAudio}>✂ Разрезать</button>
          <button type="button" onClick={mergeSelectedWithNext} disabled={scenes.length <= 1}>🔗 Соединить</button>
          <button type="button" onClick={markSemanticBlock} disabled={!hasAudio}>+ Смысловой блок</button>
          <button type="button" disabled title="Следующий этап: виртуальная тишина с source map">тишина после</button>
          <button type="button" disabled title="Следующий этап: виртуальная тишина с source map">тишина до</button>
          <button className="isReset" type="button" onClick={resetScenes} disabled={!hasAudio}><RotateCcw size={15} /> сброс</button>
          <button type="button" onClick={undoLastChange} disabled={!history.length}><Undo2 size={15} /> вернуть</button>
          <button className="avaTimingDevButton" type="button" onClick={() => setShowDev((value) => !value)}>{showDev ? 'Скрыть dev' : 'dev'}</button>
        </div>

        {showDev && (
          <div className="avaTimingDevLine">
            <label>audio <input value={draft.audioName} onChange={(event) => updateDraft('audioName', event.target.value)} placeholder="example.mp3" /></label>
            <label>duration <input type="number" min="0" value={draft.audioDurationSec} onChange={(event) => updateDraft('audioDurationSec', Number(event.target.value))} /></label>
            <label>scenes <input type="number" min="1" value={draft.scenesCount} onChange={(event) => {
              const count = Number(event.target.value) || 1
              const nextScenes = buildEvenScenes(count, draft.audioDurationSec)
              pushHistorySnapshot()
              applyDraftChange({ ...draft, scenes: nextScenes, scenesCount: nextScenes.length, selectedSceneIndex: 0 }, 'сцены пересчитаны', 0)
            }} /></label>
          </div>
        )}
      </section>
    </div>
  )
}
