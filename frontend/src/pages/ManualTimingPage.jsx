import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Clock3, Pause, Play, RotateCcw, Save, StepBack, StepForward, Undo2, UploadCloud } from 'lucide-react'
import { useProjects } from '../context/ProjectContext.jsx'
import { fetchProtectedBlobUrl, uploadAudioAsset } from '../services/apiClient.js'

const STAGE = 'manual_timing'
const DRAFT_VERSION = 'manual_timing_single_timeline_v6_handoff_manifest'
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
  storyBlocks: [],
  roles: [],
  speechSegments: [],
  silentSegments: [],
  handoffSource: '',
  historySnapshots: [],
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
    storyBlocks: Array.isArray(data?.storyBlocks) ? data.storyBlocks : [],
    roles: Array.isArray(data?.roles) ? data.roles : [],
    speechSegments: Array.isArray(data?.speechSegments) ? data.speechSegments : [],
    silentSegments: Array.isArray(data?.silentSegments) ? data.silentSegments : [],
    handoffSource: data?.handoffSource || data?.source || '',
    historySnapshots: Array.isArray(data?.historySnapshots) ? data.historySnapshots.slice(-MAX_UNDO) : [],
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

function normalizeRoleLabel(value, fallback = 'РЛЬ') {
  const raw = String(value || fallback).trim()
  if (!raw) return fallback
  return raw.slice(0, 3).toUpperCase()
}

function normalizeRoleList(inputRoles = [], speechSegments = []) {
  const roles = Array.isArray(inputRoles) ? inputRoles : []
  const byId = new Map()

  roles.forEach((role, index) => {
    const roleId = String(role.role_id || role.roleId || role.id || role.key || role.name || `role_${index + 1}`)
    const name = role.name || role.title || role.label || roleId
    byId.set(roleId, {
      roleId,
      id: roleId,
      name,
      label: normalizeRoleLabel(role.label || role.short || name, roleId),
      color: Number(role.color ?? role.hue ?? sceneHue(index + 3)),
    })
  })

  ;(Array.isArray(speechSegments) ? speechSegments : []).forEach((segment, index) => {
    const roleId = String(segment.role_id || segment.roleId || segment.role || segment.speaker || segment.speaker_id || 'voice')
    if (!byId.has(roleId)) {
      byId.set(roleId, {
        roleId,
        id: roleId,
        name: segment.role_name || segment.speaker_name || roleId,
        label: normalizeRoleLabel(segment.label || segment.role_label || segment.role_name || segment.speaker || roleId, roleId),
        color: sceneHue(index + 5),
      })
    }
  })

  return Array.from(byId.values())
}

function normalizeSpeechSegments(inputSegments = []) {
  if (!Array.isArray(inputSegments)) return []
  return inputSegments
    .map((segment, index) => {
      const start = Number(segment.start ?? segment.start_sec ?? segment.t0 ?? segment.from ?? 0)
      const end = Number(segment.end ?? segment.end_sec ?? segment.t1 ?? segment.to ?? start)
      const roleId = String(segment.role_id || segment.roleId || segment.role || segment.speaker || segment.speaker_id || 'voice')
      return {
        id: segment.id || segment.segment_id || `speech_${String(index + 1).padStart(3, '0')}`,
        start: Math.max(0, start),
        end: Math.max(start, end),
        roleId,
        role_id: roleId,
        label: segment.label || segment.role_label || '',
        text: segment.text || segment.originalText || segment.original_text || segment.transcript || '',
        ruText: segment.ruText || segment.text_ru || segment.translation_ru || '',
      }
    })
    .filter((segment) => segment.end - segment.start > 0.01)
    .sort((a, b) => a.start - b.start)
}

function normalizeSilentSegments(inputSegments = []) {
  if (!Array.isArray(inputSegments)) return []
  return inputSegments
    .map((segment, index) => {
      const start = Number(segment.start ?? segment.start_sec ?? segment.t0 ?? 0)
      const end = Number(segment.end ?? segment.end_sec ?? segment.t1 ?? start)
      return {
        id: segment.id || `silence_${String(index + 1).padStart(3, '0')}`,
        start: Math.max(0, start),
        end: Math.max(start, end),
      }
    })
    .filter((segment) => segment.end - segment.start > 0.01)
}

function segmentsOverlap(aStart, aEnd, bStart, bEnd) {
  return Math.min(aEnd, bEnd) - Math.max(aStart, bStart) > 0.03
}

export default function ManualTimingPage() {
  const { projectId } = useParams()
  const { activeProject, loadStage, saveStage, loadWorkspaceStage, saveWorkspaceStage } = useProjects()
  const workspaceMode = !projectId
  const [draft, setDraft] = useState(emptyDraft)
  const [history, setHistory] = useState([])
  const historyRef = useRef([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingAudioFile, setPendingAudioFile] = useState(null)
  const [showReplaceAudioConfirm, setShowReplaceAudioConfirm] = useState(false)
  const [showDev, setShowDev] = useState(false)
  const [blockSelection, setBlockSelection] = useState([])
  const [blockDraft, setBlockDraft] = useState({ title: '' })
  const [sceneEditor, setSceneEditor] = useState(null)
  const [playingMode, setPlayingMode] = useState(null)
  const [cursorSec, setCursorSec] = useState(0)
  const [audioSrc, setAudioSrc] = useState('')
  const audioRef = useRef(null)
  const fileInputRef = useRef(null)
  const jsonInputRef = useRef(null)

  const hasAudio = Boolean(draft.audioAssetId || draft.audioApiPath || draft.audioUrl)
  const scenes = useMemo(() => normalizeScenes(draft, draft.audioDurationSec), [draft.scenes, draft.scenesCount, draft.audioDurationSec])
  const selectedScene = scenes[Math.min(draft.selectedSceneIndex, scenes.length - 1)] || scenes[0] || makeScene(0, 0, 0)
  const scopeTitle = workspaceMode ? 'Рабочая область' : activeProject?.name || 'Проект'
  const cursorPct = draft.audioDurationSec > 0 ? Math.min(100, Math.max(0, (cursorSec / draft.audioDurationSec) * 100)) : 0
  const roleMap = useMemo(() => new Map((draft.roles || []).map((role) => [role.roleId || role.id, role])), [draft.roles])
  const getSceneRoleLabels = (scene) => {
    const found = []
    ;(draft.speechSegments || []).forEach((segment) => {
      if (!segmentsOverlap(scene.start, scene.end, segment.start, segment.end)) return
      const role = roleMap.get(segment.roleId || segment.role_id)
      const label = role?.label || segment.label || normalizeRoleLabel(segment.roleId || segment.role_id || 'voice')
      if (!found.includes(label)) found.push(label)
    })
    return found.slice(0, 3)
  }

  useEffect(() => {
    let active = true
    async function loadDraft() {
      setLoading(true)
      setStatus('загрузка snapshot…')
      try {
        const data = workspaceMode ? await loadWorkspaceStage(STAGE) : await loadStage(projectId, STAGE)
        if (!active) return
        const normalized = normalizeDraft(data)
        const loadedHistory = Array.isArray(normalized.historySnapshots) ? normalized.historySnapshots : []
        historyRef.current = loadedHistory
        setDraft(normalized)
        setHistory(loadedHistory)
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
  }, [draft.audioName, draft.audioAssetId, draft.audioApiPath, draft.audioSizeBytes, draft.audioDurationSec, draft.scenes, draft.storyBlocks, draft.roles, draft.speechSegments, draft.silentSegments, draft.historySnapshots, draft.selectedSceneIndex, draft.stepSec, draft.notes])

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
    const snapshot = normalizeDraft({ ...draft, historySnapshots: [] })
    const nextHistory = [...historyRef.current.slice(-MAX_UNDO + 1), snapshot]
    historyRef.current = nextHistory
    setHistory(nextHistory)
    return nextHistory
  }

  function applyDraftChange(nextDraft, message, nextCursor = cursorSec) {
    const normalized = normalizeDraft({ ...nextDraft, historySnapshots: historyRef.current })
    stopAudio(nextCursor)
    setDraft(normalized)
    setStatus(message)
  }

  function selectScene(sceneIndex) {
    const nextScene = scenes[Math.min(sceneIndex, scenes.length - 1)] || scenes[0]
    stopAudio(nextScene?.start || 0)
    setDraft((prev) => normalizeDraft({ ...prev, selectedSceneIndex: sceneIndex }))
  }

  function handleSceneClick(event, sceneIndex) {
    event.stopPropagation()
    if (event.ctrlKey || event.metaKey) {
      toggleBlockScene(sceneIndex)
      return
    }
    selectScene(sceneIndex)
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
    const previous = historyRef.current[historyRef.current.length - 1]
    if (!previous) {
      setStatus('нет действий для возврата')
      return
    }
    const nextHistory = historyRef.current.slice(0, -1)
    historyRef.current = nextHistory
    setHistory(nextHistory)
    const restored = normalizeDraft({ ...previous, historySnapshots: nextHistory })
    const nextCursor = restored.scenes?.[restored.selectedSceneIndex]?.start || 0
    stopAudio(nextCursor)
    setDraft(restored)
    setStatus('возвращено')
  }

  function toggleBlockScene(sceneIndex) {
    const scene = scenes[Math.min(sceneIndex, scenes.length - 1)]
    if (!scene) return
    stopAudio(scene.start)
    setDraft((prev) => normalizeDraft({ ...prev, selectedSceneIndex: sceneIndex }))
    setBlockDraft((prev) => ({ title: prev.title || scene.blockTitle || '' }))
    setBlockSelection((items) => {
      const exists = items.includes(sceneIndex)
      const next = exists ? items.filter((item) => item !== sceneIndex) : [...items, sceneIndex].sort((a, b) => a - b)
      setStatus(next.length ? `выбрано сцен для блока: ${next.length}` : 'выбор блока очищен')
      return next
    })
  }

  function markSemanticBlock() {
    const index = Math.min(draft.selectedSceneIndex, scenes.length - 1)
    setBlockSelection((items) => {
      const next = items.length ? items : [index]
      setStatus(`выбрано сцен для блока: ${next.length}`)
      return next
    })
    setBlockDraft((prev) => ({ title: prev.title || selectedScene.blockTitle || '' }))
  }

  function applyStoryBlock() {
    if (!blockSelection.length) {
      setStatus('выберите сцены через Ctrl+клик')
      return
    }
    const existingBlocks = Array.isArray(draft.storyBlocks) ? draft.storyBlocks : []
    const title = (blockDraft.title || '').trim() || `Блок ${existingBlocks.length + 1}`
    const blockId = `block_${Date.now().toString(36)}`
    const blockColor = sceneHue(existingBlocks.length + 8)
    const selectedSet = new Set(blockSelection)
    const nextScenes = scenes.map((scene) => (
      selectedSet.has(scene.index)
        ? { ...scene, semanticBlock: true, blockId, blockTitle: title, blockColor }
        : scene
    ))
    const selectedScenes = nextScenes.filter((scene) => selectedSet.has(scene.index))
    const nextBlocks = [
      ...existingBlocks,
      {
        id: blockId,
        title,
        color: blockColor,
        sceneIds: selectedScenes.map((scene) => scene.id),
        sceneIndexes: selectedScenes.map((scene) => scene.index),
        start: selectedScenes[0]?.start ?? 0,
        end: selectedScenes[selectedScenes.length - 1]?.end ?? 0,
      },
    ]
    pushHistorySnapshot()
    applyDraftChange({ ...draft, scenes: nextScenes, storyBlocks: nextBlocks, selectedSceneIndex: selectedScenes[0]?.index ?? 0 }, `блок создан: ${title}`, selectedScenes[0]?.start ?? cursorSec)
    setBlockSelection([])
    setBlockDraft({ title: '' })
  }

  function clearBlockSelection() {
    setBlockSelection([])
    setBlockDraft({ title: '' })
    setStatus('выбор блока очищен')
  }

  function openSceneEditor(sceneIndex) {
    const scene = scenes[Math.min(sceneIndex, scenes.length - 1)]
    if (!scene) return
    stopAudio(scene.start)
    setDraft((prev) => normalizeDraft({ ...prev, selectedSceneIndex: sceneIndex }))
    setSceneEditor({
      sceneIndex,
      note: scene.note || scene.memo || '',
      route: scene.route || 'auto',
    })
    setStatus(`редактирование ${scene.title}`)
  }

  function saveSceneEditor() {
    if (!sceneEditor) return
    const index = Math.min(sceneEditor.sceneIndex, scenes.length - 1)
    const nextScenes = scenes.map((scene, sceneIndex) => (
      sceneIndex === index
        ? { ...scene, note: sceneEditor.note || '', route: sceneEditor.route || 'auto' }
        : scene
    ))
    pushHistorySnapshot()
    applyDraftChange({ ...draft, scenes: nextScenes, selectedSceneIndex: index }, 'памятка сцены сохранена', nextScenes[index]?.start ?? cursorSec)
    setSceneEditor(null)
  }

  async function handleAudioUpload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (hasAudio) {
      stopAudio(0)
      setPendingAudioFile(file)
      setShowReplaceAudioConfirm(true)
      setStatus('ожидает подтверждения замены аудио')
      return
    }

    await uploadPickedAudio(file)
  }

  async function confirmReplaceAudio() {
    const file = pendingAudioFile
    setShowReplaceAudioConfirm(false)
    setPendingAudioFile(null)
    if (!file) return
    await uploadPickedAudio(file)
  }

  function cancelReplaceAudio() {
    setShowReplaceAudioConfirm(false)
    setPendingAudioFile(null)
    setStatus('замена аудио отменена')
  }

  async function uploadPickedAudio(file) {
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
        storyBlocks: [],
        roles: [],
        speechSegments: [],
        silentSegments: [],
        handoffSource: '',
        historySnapshots: [],
        notes: '',
      })
      historyRef.current = []
      setHistory([])
      setBlockSelection([])
      setBlockDraft({ title: '' })
      setSceneEditor(null)
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


  function buildExportPayload() {
    return {
      schema: 'ava_manual_timing_handoff_v1',
      source: 'manual_timing',
      exportedAt: new Date().toISOString(),
      audio: {
        name: draft.audioName,
        assetId: draft.audioAssetId,
        assetApiPath: draft.audioApiPath,
        sizeBytes: draft.audioSizeBytes,
        durationSec: draft.audioDurationSec,
      },
      roles: draft.roles || [],
      speechSegments: draft.speechSegments || [],
      silentSegments: draft.silentSegments || [],
      scenes: scenes.map((scene) => ({
        id: scene.id,
        title: scene.title,
        start: scene.start,
        end: scene.end,
        route: scene.route || 'auto',
        note: scene.note || '',
        blockId: scene.blockId || '',
        blockTitle: scene.blockTitle || '',
        roleLabels: typeof getSceneRoleLabels === 'function' ? getSceneRoleLabels(scene) : (scene.roleLabels || []),
      })),
      storyBlocks: draft.storyBlocks || [],
    }
  }

  function exportTimingJson() {
    const payload = buildExportPayload()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const safeName = (draft.audioName || 'manual_timing').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_')
    link.href = url
    link.download = `${safeName}_manual_timing.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setStatus('JSON экспортирован')
  }

  async function importTimingJson(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const raw = JSON.parse(await file.text())
      const root = raw.manualTiming || raw.manual_timing || raw
      const manifest = raw.podcast_edit_manifest || root.podcast_edit_manifest || raw.manifest || root.manifest || {}
      const rawSpeech = root.speechSegments || root.speech_segments || manifest.speechSegments || manifest.speech_segments || manifest.segments || []
      const speechSegments = typeof normalizeSpeechSegments === 'function' ? normalizeSpeechSegments(rawSpeech) : []
      const roles = typeof normalizeRoleList === 'function' ? normalizeRoleList(root.roles || manifest.roles || [], speechSegments) : (root.roles || manifest.roles || [])
      const silentSegments = typeof normalizeSilentSegments === 'function' ? normalizeSilentSegments(root.silentSegments || root.silent_segments || manifest.silentSegments || manifest.silent_segments || []) : []
      const importedDuration = Number(root.audioDurationSec || root.audio_duration_sec || root.audio?.durationSec || root.audio?.duration_sec || manifest.audioDurationSec || manifest.audio_duration_sec || draft.audioDurationSec || 0)
      const importedScenes = Array.isArray(root.scenes) ? root.scenes : []
      const nextScenes = importedScenes.length
        ? normalizeScenes({ scenes: importedScenes }, importedDuration || draft.audioDurationSec)
        : scenes.length
          ? scenes
          : speechSegments.length
            ? renumberScenes(speechSegments.map((segment) => ({ start: segment.start, end: segment.end })))
            : makeSingleScene(importedDuration || draft.audioDurationSec)

      const nextDraft = normalizeDraft({
        ...draft,
        audioName: root.audioName || root.audio_name || root.audio?.name || draft.audioName,
        audioDurationSec: importedDuration || draft.audioDurationSec,
        roles,
        speechSegments,
        silentSegments,
        scenes: nextScenes,
        scenesCount: nextScenes.length,
        storyBlocks: Array.isArray(root.storyBlocks) ? root.storyBlocks : Array.isArray(root.story_blocks) ? root.story_blocks : draft.storyBlocks,
        handoffSource: raw.source || root.source || manifest.source || 'json_import',
      })

      pushHistorySnapshot()
      setDraft(nextDraft)
      setCursorSec(nextScenes[0]?.start || 0)
      await saveDraft(nextDraft, 'json_import')
      setStatus(`JSON импортирован: ролей ${roles.length}, речевых сегментов ${speechSegments.length}`)
    } catch (err) {
      setStatus(`ошибка импорта JSON: ${err.message}`)
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
      <audio ref={audioRef} src={audioSrc || undefined} preload="metadata" onLoadedMetadata={handleLoadedMetadata} />
      <input ref={fileInputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm" hidden onChange={handleAudioUpload} />
      <input ref={jsonInputRef} type="file" accept="application/json,.json" hidden onChange={importTimingJson} />

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
          <button className="avaSoftButton" type="button" onClick={() => jsonInputRef.current?.click()} disabled={loading}>Импорт JSON</button>
          <button className="avaSoftButton" type="button" onClick={exportTimingJson} disabled={loading}>Экспорт JSON</button>
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
        <span>Речи: <b>{(draft.speechSegments || []).length}</b></span>
        <span>Статус: <b>{status}</b></span>
        <span>Режим: <b>{scopeTitle}</b></span>
      </div>

      {!hasAudio && (
        <div className="avaTimingAudioWarning">
          Аудио не выбрано. Загрузите mp3/wav, чтобы проверить проигрывание выбранной сцены и всего файла.
        </div>
      )}


      {showReplaceAudioConfirm && (
        <div className="avaTimingConfirmOverlay" role="dialog" aria-modal="true">
          <div className="avaTimingConfirmBox">
            <div className="avaTimingConfirmIcon">!</div>
            <div className="avaTimingConfirmText">
              <strong>Заменить аудио?</strong>
              <p>
                Сейчас уже открыт файл <b>{draft.audioName || 'аудио'}</b>. Новая загрузка очистит разрезы,
                смысловые блоки, роли, ASR-фразы, памятки сцен и историю отмены для этой страницы.
              </p>
              {pendingAudioFile && <span>Новый файл: <b>{pendingAudioFile.name}</b></span>}
            </div>
            <div className="avaTimingConfirmActions">
              <button type="button" onClick={cancelReplaceAudio}>Отмена</button>
              <button type="button" className="isDanger" onClick={confirmReplaceAudio}>Да, заменить</button>
            </div>
          </div>
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
              const roleLabels = getSceneRoleLabels(scene)
              return (
                <button
                  key={`${scene.id}-${scene.start}-${scene.end}`}
                  type="button"
                  style={{ width: sceneWidth, '--scene-hue': scene.blockColor || sceneHue(scene.index) }}
                  className={`${scene.index === selectedScene.index ? 'isActive' : ''} ${scene.blockId ? 'hasBlock' : ''} ${blockSelection.includes(scene.index) ? 'isBlockPicked' : ''} ${scene.note ? 'hasNote' : ''}`}
                  onClick={(event) => handleSceneClick(event, scene.index)}
                  onDoubleClick={(event) => {
                    event.stopPropagation()
                    openSceneEditor(scene.index)
                  }}
                >
                  <b>{scene.blockTitle || scene.title}</b>
                  <small>{scene.route && scene.route !== 'auto' ? `${scene.route} · ` : ''}{formatTime(scene.start)} → {formatTime(scene.end)}</small>
                  {roleLabels.length > 0 && <em>{roleLabels.join(' / ')}</em>}
                </button>
              )
            })}
          </div>
        </div>

        {blockSelection.length > 0 && (
          <div className="avaTimingBlockEditor">
            <div>
              <strong>Смысловой блок</strong>
              <span>{blockSelection.length} сцен · Ctrl+клик добавляет/убирает сцены</span>
            </div>
            <input
              value={blockDraft.title}
              onChange={(event) => setBlockDraft({ title: event.target.value })}
              placeholder="Название блока, например: Куплет 1 / Припев / Воспоминание"
            />
            <button type="button" onClick={applyStoryBlock}>Сохранить блок</button>
            <button type="button" onClick={clearBlockSelection}>Отмена</button>
          </div>
        )}

        {sceneEditor && (
          <div className="avaTimingSceneEditor">
            <div>
              <strong>Памятка сцены · {scenes[sceneEditor.sceneIndex]?.title}</strong>
              <span>Двойной клик по сцене открывает это окно</span>
            </div>
            <label>
              route
              <select value={sceneEditor.route} onChange={(event) => setSceneEditor((prev) => ({ ...prev, route: event.target.value }))}>
                <option value="auto">auto</option>
                <option value="i2v">i2v</option>
                <option value="ia2v">ia2v / lip-sync</option>
                <option value="i2v_sound">i2v_sound</option>
                <option value="first_last">first_last</option>
              </select>
            </label>
            <label>
              памятка
              <textarea
                value={sceneEditor.note}
                onChange={(event) => setSceneEditor((prev) => ({ ...prev, note: event.target.value }))}
                placeholder="Например: здесь герой поёт; сделать i2v_sound; нужен крупный план..."
              />
            </label>
            <button type="button" onClick={saveSceneEditor}>Сохранить сцену</button>
            <button type="button" onClick={() => setSceneEditor(null)}>Закрыть</button>
          </div>
        )}

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
<button className="isReset" type="button" onClick={resetScenes} disabled={!hasAudio}><RotateCcw size={15} /> сброс</button>
          <button type="button" onClick={undoLastChange} disabled={!history.length}><Undo2 size={15} /> вернуть</button>
          <button className="avaTimingDevButton" type="button" onClick={() => setShowDev((value) => !value)}>{showDev ? 'Скрыть dev' : 'dev'}</button>
        </div>
</section>
    </div>
  )
}
