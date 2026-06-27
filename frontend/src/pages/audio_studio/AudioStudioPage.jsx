import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  AudioLines,
  CheckCircle2,
  Film,
  Headphones,
  Play,
  RefreshCcw,
  Save,
  Sparkles,
  Trash2,
  UploadCloud,
  Volume2,
  WandSparkles,
  X,
} from 'lucide-react'
import { useProjects } from '../../context/ProjectContext.jsx'
import { apiRequest, buildApiUrl, fetchProtectedBlobUrl, normalizeAssetFileUrl, uploadMediaAsset } from '../../services/apiClient.js'
import './AudioStudioPage.css'

const STAGE = 'audio_studio'
const VERSION = 'V204A3'
const DEFAULT_NEGATIVE = 'музыка, речь, голоса, гул, hiss, шум'

function cleanId(value = '') {
  return String(value || '').trim()
}

function isRealProjectId(value = '') {
  return /^p_[a-z0-9]+$/i.test(cleanId(value))
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function nowIso() {
  return new Date().toISOString()
}

function makeId(prefix = 'as') {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`
  return `${prefix}_${String(random).replace(/[^a-z0-9_\-]/gi, '_')}`
}

function normalizeRef(value = '') {
  const raw = cleanId(value)
  if (!raw) return { url: '', apiPath: '', assetId: '' }
  const normalized = normalizeAssetFileUrl(raw)
  const apiPath = normalized.apiPath || (raw.startsWith('/assets/') ? raw : raw.startsWith('/api/assets/') ? raw.slice(4) : '')
  const assetId = normalized.assetId || (apiPath.match(/\/assets\/([^/]+)\/file/i)?.[1] || '')
  return {
    url: normalized.url || raw,
    apiPath,
    assetId,
  }
}

function firstText(...values) {
  for (const value of values) {
    const text = cleanId(value)
    if (text) return text
  }
  return ''
}

function stableHueFromText(value, fallbackIndex = 0) {
  const text = cleanId(value)
  if (!text) return 185 + ((Number(fallbackIndex || 0) * 47) % 150)
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i)
    hash |= 0
  }
  return 185 + (Math.abs(hash) % 150)
}

function normalizeSceneCssColor(value = '', fallbackIndex = 0) {
  const raw = cleanId(value)
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toUpperCase()
  if (/^#[0-9a-f]{3}$/i.test(raw)) return `#${raw.slice(1).split('').map((ch) => ch + ch).join('')}`.toUpperCase()
  if (/^rgba?\(/i.test(raw) || /^hsla?\(/i.test(raw) || /^color-mix\(/i.test(raw)) return raw
  const hslMatch = raw.match(/^hsla?\(\s*([0-9.]+)/i)
  if (hslMatch) return raw
  const numeric = Number(raw)
  if (Number.isFinite(numeric)) return `hsl(${numeric}, 82%, 52%)`
  return `hsl(${stableHueFromText(raw, fallbackIndex)}, 82%, 52%)`
}

function sceneCleanId(scene = {}, index = 0) {
  return firstText(scene.scene_id, scene.sceneId, scene.id, scene.title, `seg_${String(index + 1).padStart(2, '0')}`)
}

function blockSceneIds(block = {}) {
  return [
    ...asArray(block.scene_ids),
    ...asArray(block.sceneIds),
    ...asArray(block.scenes).map((item) => typeof item === 'string' ? item : firstText(item?.id, item?.scene_id, item?.sceneId)),
  ].map((item) => cleanId(item)).filter(Boolean)
}

function boardBlockForScene(board = {}, scene = {}, index = 0) {
  const sceneId = sceneCleanId(scene, index)
  const blockId = firstText(scene.blockId, scene.block_id, scene.semanticBlockId, scene.semantic_block_id)
  const blocks = [
    ...asArray(board.storyBlocks),
    ...asArray(board.story_blocks),
    ...asArray(board.timing?.storyBlocks),
    ...asArray(board.timing?.story_blocks),
  ]
  if (blockId) {
    const exact = blocks.find((block) => cleanId(firstText(block.id, block.blockId, block.block_id)) === blockId)
    if (exact) return exact
  }
  return blocks.find((block) => {
    const ids = blockSceneIds(block)
    if (ids.includes(sceneId)) return true
    const indexes = [...asArray(block.sceneIndexes), ...asArray(block.scene_indexes)].map((item) => Number(item)).filter(Number.isFinite)
    return indexes.includes(Number(index))
  }) || null
}

function sceneColor(scene = {}, index = 0, board = {}) {
  const block = boardBlockForScene(board, scene, index)
  const raw = firstText(
    block?.color,
    block?.blockColor,
    block?.block_color,
    block?.sceneColor,
    block?.scene_color,
    scene.blockColor,
    scene.block_color,
    scene.semanticBlockColor,
    scene.semantic_block_color,
    scene.color,
    scene.timelineColor,
    scene.cardColor,
    scene.sceneColor,
    scene.scene_color,
    scene.user_scene_color,
    scene.blockHue,
    scene.block_hue,
    scene.hue,
  )
  return normalizeSceneCssColor(raw || `scene:${index}`, index)
}

function boardSourceVideoRef(scene = {}) {
  return firstText(
    scene.video_api_path,
    scene.videoApiPath,
    scene.video_url,
    scene.videoUrl,
    scene.output_video_api_path,
    scene.outputVideoApiPath,
    scene.result_video_api_path,
    scene.resultVideoApiPath,
    scene.mmaudio_source_video_api_path,
    scene.mmaudioSourceVideoApiPath,
    scene.mmaudio_video_api_path,
    scene.mmaudioVideoApiPath,
    scene.mmaudio_video_url,
    scene.mmaudioVideoUrl,
  )
}

function boardAppliedMmaudioRef(scene = {}) {
  return firstText(
    scene.mmaudio_video_api_path,
    scene.mmaudioVideoApiPath,
    scene.mmaudio_video_url,
    scene.mmaudioVideoUrl,
  )
}

function durationOf(scene = {}) {
  const start = toNumber(scene.start_sec ?? scene.start, 0)
  const explicit = toNumber(scene.duration_sec ?? scene.durationSec, 0)
  if (explicit > 0) return explicit
  const end = toNumber(scene.end_sec ?? scene.end, 0)
  return Math.max(0, end - start)
}

function compactLabel(text = '', fallback = '') {
  const clean = cleanId(text || fallback)
  return clean.length > 42 ? `${clean.slice(0, 39)}…` : clean
}

function pickMmaudioOutputUrl(data = {}) {
  return firstText(
    data.video_api_path,
    data.videoApiPath,
    data.asset_api_path,
    data.assetApiPath,
    data.output_api_path,
    data.outputApiPath,
    data.result_video_api_path,
    data.resultVideoApiPath,
    data.mmaudio_video_api_path,
    data.mmaudioVideoApiPath,
    data.video_url,
    data.videoUrl,
    data.result_url,
    data.resultUrl,
    data.output_url,
    data.outputUrl,
    data.mmaudio_video_url,
    data.mmaudioVideoUrl,
    data.url,
  )
}

function statusLooksDone(value = '') {
  const status = cleanId(value).toLowerCase()
  return ['done', 'ready', 'complete', 'completed', 'success', 'succeeded', 'finished'].some((item) => status.includes(item))
}

function statusLooksFailed(value = '') {
  const status = cleanId(value).toLowerCase()
  return ['fail', 'failed', 'error', 'canceled', 'cancelled', 'blocked'].some((item) => status.includes(item))
}

function withUiTimeout(promise, ms = 12000, label = 'request') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}: timeout ${ms}ms`)), ms)),
  ])
}

function makeMediaRefFromUpload(data = {}) {
  const ref = normalizeRef(firstText(data.asset_api_path, data.assetApiPath, data.asset_url, data.assetUrl, data.url))
  return {
    url: ref.url || firstText(data.assetUrl, data.asset_url),
    apiPath: ref.apiPath || firstText(data.assetApiPath, data.asset_api_path),
    assetId: ref.assetId || firstText(data.assetId, data.asset_id),
    name: firstText(data.originalName, data.original_name, data.name, data.audio_name),
    durationSec: toNumber(data.durationSec ?? data.duration_sec, 0),
  }
}

function buildAudioScenesFromBoard(board = {}) {
  const scenes = asArray(board.scenes || board.board_scenes || board.boardScenes)
  return scenes.map((scene, index) => {
    const sceneId = firstText(scene.scene_id, scene.sceneId, scene.id) || `seg_${String(index + 1).padStart(2, '0')}`
    const startSec = toNumber(scene.start_sec ?? scene.start, 0)
    const dur = durationOf(scene)
    const endSec = toNumber(scene.end_sec ?? scene.end, startSec + dur)
    const sourceRef = normalizeRef(boardSourceVideoRef(scene))
    const appliedRefRaw = boardAppliedMmaudioRef(scene)
    const appliedRef = normalizeRef(appliedRefRaw)
    const importedAppliedVariantId = appliedRefRaw ? `board_mmaudio_${sceneId}` : ''
    const prompt = firstText(scene.mmaudio_prompt, scene.mmaudioPrompt, scene.sound_prompt, scene.soundPrompt)
    const negativePrompt = firstText(scene.mmaudio_negative_prompt, scene.mmaudioNegativePrompt, scene.negative_sound_prompt, scene.negativeSoundPrompt, DEFAULT_NEGATIVE)
    const volume = toNumber(scene.mmaudio_volume ?? scene.mmaudioVolume ?? scene.audio_studio_mmaudio_volume ?? scene.audioStudioMmaudioVolume, 100)
    const variants = importedAppliedVariantId ? [{
      id: importedAppliedVariantId,
      kind: 'mmaudio_video',
      label: 'из Board',
      url: appliedRef.url,
      apiPath: appliedRef.apiPath,
      assetId: appliedRef.assetId,
      prompt,
      negativePrompt,
      volume,
      createdAt: firstText(scene.mmaudio_updated_at, scene.mmaudioUpdatedAt, scene.updatedAt) || nowIso(),
      fromBoard: true,
      applied: true,
    }] : []
    return {
      id: sceneId,
      sceneId,
      index,
      title: firstText(scene.title, scene.user_scene_label, scene.userSceneLabel, scene.label, sceneId) || `Сцена ${index + 1}`,
      color: sceneColor(scene, index, board),
      blockId: firstText(scene.blockId, scene.block_id, scene.semanticBlockId, scene.semantic_block_id),
      blockTitle: firstText(scene.blockTitle, scene.block_title, scene.semanticBlockTitle, scene.semantic_block_title),
      status: sourceRef.apiPath || sourceRef.url ? (variants.length ? 'applied' : 'ready') : 'no_video',
      startSec,
      endSec,
      durationSec: dur || Math.max(0, endSec - startSec),
      route: firstText(scene.route, scene.video_route, scene.videoRoute),
      sourceVideo: {
        url: sourceRef.url,
        apiPath: sourceRef.apiPath,
        assetId: sourceRef.assetId,
        name: firstText(scene.video_name, scene.videoName, scene.output_name, scene.outputName),
      },
      prompt,
      negativePrompt,
      mmaudioVolume: volume,
      selectedVariantId: importedAppliedVariantId,
      appliedVariantId: importedAppliedVariantId,
      variants,
      boardRaw: scene,
    }
  })
}

function buildAudioSnapshotFromBoard(board = {}, { projectId = '', source = 'board_import_v204a' } = {}) {
  const scenes = buildAudioScenesFromBoard(board)
  return {
    version: VERSION,
    schema: 'ava_audio_studio_scene_snapshot_v1',
    stage: STAGE,
    source,
    importedFrom: 'board',
    projectId: projectId || '',
    selectedSceneId: cleanId(board.selectedSceneId || board.selected_scene_id) || scenes[0]?.id || '',
    scenes,
    stableAudio: { enabled: false, status: 'soon' },
    queue: { enabled: false, items: [] },
    updatedAt: nowIso(),
  }
}

function mergeAudioWithFreshBoard(audio = {}, board = {}, projectId = '') {
  const fresh = buildAudioSnapshotFromBoard(board, { projectId, source: 'board_refresh_merge_v204a' })
  const oldScenes = new Map(asArray(audio.scenes).map((scene) => [cleanId(scene.id || scene.sceneId), scene]))
  const scenes = asArray(fresh.scenes).map((freshScene) => {
    const old = oldScenes.get(cleanId(freshScene.id || freshScene.sceneId))
    if (!old) return freshScene
    const oldVariants = asArray(old.variants)
    const oldById = new Map(oldVariants.map((variant) => [cleanId(variant.id), variant]))
    const mergedVariants = [
      ...oldVariants,
      ...asArray(freshScene.variants).filter((variant) => !oldById.has(cleanId(variant.id))),
    ]
    return {
      ...freshScene,
      prompt: old.prompt || freshScene.prompt,
      negativePrompt: old.negativePrompt || freshScene.negativePrompt,
      mmaudioVolume: toNumber(old.mmaudioVolume, freshScene.mmaudioVolume || 100),
      selectedVariantId: old.selectedVariantId || freshScene.selectedVariantId,
      appliedVariantId: old.appliedVariantId || freshScene.appliedVariantId,
      variants: mergedVariants,
      status: old.appliedVariantId ? 'applied' : (mergedVariants.length ? 'variants' : freshScene.status),
    }
  })
  return {
    ...audio,
    ...fresh,
    scenes,
    selectedSceneId: audio.selectedSceneId || fresh.selectedSceneId || scenes[0]?.id || '',
    updatedAt: nowIso(),
  }
}

function sceneStatusLabel(scene = {}) {
  if (!scene.sourceVideo?.apiPath && !scene.sourceVideo?.url) return 'нет видео'
  if (scene.jobId) return 'генерация'
  if (scene.appliedVariantId) return 'мма'
  if (asArray(scene.variants).length) return 'есть варианты'
  return 'готово'
}

function variantRef(variant = {}) {
  return firstText(variant.apiPath, variant.url)
}

function PreviewVideo({ source = '', title = '', className = '', volume = 1, controls = true }) {
  const [blobUrl, setBlobUrl] = useState('')
  const [error, setError] = useState('')
  const videoRef = useRef(null)
  const cleanSource = cleanId(source)

  useEffect(() => {
    let alive = true
    let objectUrl = ''
    setError('')
    setBlobUrl('')
    if (!cleanSource) return undefined

    const shouldFetch = /\/(api\/)?assets\/[^/]+\/file/i.test(cleanSource)
    if (!shouldFetch) return undefined

    fetchProtectedBlobUrl(cleanSource)
      .then((url) => {
        if (!alive) return
        objectUrl = url
        setBlobUrl(url)
      })
      .catch((err) => {
        if (alive) setError(String(err?.message || err))
      })

    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [cleanSource])

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = Math.max(0, Math.min(1.5, Number(volume) || 0))
  }, [volume, blobUrl, cleanSource])

  const shouldFetch = /\/(api\/)?assets\/[^/]+\/file/i.test(cleanSource)
  const src = shouldFetch ? blobUrl : (cleanSource ? buildApiUrl(cleanSource) : '')

  if (!cleanSource) {
    return <div className={`avaAudioPreviewEmpty ${className}`}>Нет видео</div>
  }
  if (shouldFetch && !blobUrl && !error) {
    return <div className={`avaAudioPreviewEmpty ${className}`}>Загружаю preview…</div>
  }
  if (error) {
    return <div className={`avaAudioPreviewEmpty isError ${className}`}>Preview недоступен: {error}</div>
  }
  return <video ref={videoRef} className={className} src={src} title={title} controls={controls} playsInline />
}

function SceneStrip({ scenes, selectedSceneId, onSelect }) {
  return (
    <div className="avaAudioSceneStrip" aria-label="Сцены Audio Studio">
      {asArray(scenes).map((scene, index) => {
        const active = cleanId(scene.id) === cleanId(selectedSceneId)
        return (
          <button
            key={scene.id || index}
            type="button"
            className={`avaAudioScenePill ${active ? 'isActive' : ''} ${scene.appliedVariantId ? 'isApplied' : ''}`}
            style={{ '--scene-color': scene.color || '#62d8ff' }}
            onClick={() => onSelect(scene.id)}
          >
            <strong>{scene.title || `сцена${index + 1}`}</strong>
            <span>{sceneStatusLabel(scene)}</span>
          </button>
        )
      })}
    </div>
  )
}

function VariantCard({ variant, active, applied, onSelect, onDelete }) {
  return (
    <button type="button" className={`avaAudioVariantCard ${active ? 'isActive' : ''} ${applied ? 'isApplied' : ''}`} onClick={onSelect}>
      <span className="avaAudioVariantThumb">
        <PreviewVideo source={variantRef(variant)} title={variant.label || 'variant'} controls={false} className="avaAudioVariantVideo" />
      </span>
      <strong>{variant.label || 'вариант'}</strong>
      <small>{compactLabel(variant.prompt, 'без prompt')}</small>
      {applied ? <em><CheckCircle2 size={12} /> применено</em> : null}
      <span
        role="button"
        tabIndex={0}
        className="avaAudioVariantDelete"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onDelete()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            event.stopPropagation()
            onDelete()
          }
        }}
        title="Удалить вариант"
      >
        <X size={14} />
      </span>
    </button>
  )
}

export default function AudioStudioPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { projectId: routeProjectId } = useParams()
  const {
    loadStage,
    saveStage,
    loadWorkspaceStage,
    saveWorkspaceStage,
    syncActiveProjectFromRoute,
  } = useProjects()

  const projectId = isRealProjectId(routeProjectId) ? routeProjectId : ''
  const workspaceMode = !projectId
  const pagePath = projectId ? `/app/projects/${projectId}/audio-studio` : '/app/workspace/audio-studio'
  const routeLoadKey = `${pagePath}|${location.key || 'direct'}`
  const boardPath = projectId ? `/app/projects/${projectId}/board` : '/app/workspace/board'
  const assemblyPath = projectId ? `/app/projects/${projectId}/board-assembly` : '/app/workspace/board-assembly'

  const [snapshot, setSnapshot] = useState(() => ({ version: VERSION, stage: STAGE, scenes: [], selectedSceneId: '', stableAudio: { enabled: false } }))
  const [loading, setLoading] = useState(true)
  const [loadMessage, setLoadMessage] = useState('Загружаю Audio Studio…')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [generatingSceneId, setGeneratingSceneId] = useState('')
  const [uploading, setUploading] = useState(false)
  const pollRef = useRef(null)
  const snapshotRef = useRef(snapshot)
  const didLoadRef = useRef(false)
  const autosaveTimerRef = useRef(null)
  const projectApiRef = useRef({ loadStage, saveStage, loadWorkspaceStage, saveWorkspaceStage })

  useEffect(() => { snapshotRef.current = snapshot }, [snapshot])
  useEffect(() => {
    projectApiRef.current = { loadStage, saveStage, loadWorkspaceStage, saveWorkspaceStage }
  }, [loadStage, saveStage, loadWorkspaceStage, saveWorkspaceStage])

  const selectedScene = useMemo(() => {
    const scenes = asArray(snapshot.scenes)
    return scenes.find((scene) => cleanId(scene.id) === cleanId(snapshot.selectedSceneId)) || scenes[0] || null
  }, [snapshot])

  const selectedVariant = useMemo(() => {
    if (!selectedScene) return null
    return asArray(selectedScene.variants).find((variant) => cleanId(variant.id) === cleanId(selectedScene.selectedVariantId)) || null
  }, [selectedScene])

  const appliedVariant = useMemo(() => {
    if (!selectedScene) return null
    return asArray(selectedScene.variants).find((variant) => cleanId(variant.id) === cleanId(selectedScene.appliedVariantId)) || null
  }, [selectedScene])

  const saveSnapshot = useCallback(async (nextSnapshot, reason = 'save') => {
    const payload = {
      ...nextSnapshot,
      version: VERSION,
      stage: STAGE,
      updatedAt: nowIso(),
      lastSaveReason: reason,
    }
    setSnapshot(payload)
    snapshotRef.current = payload
    setSaving(true)
    try {
      const { saveWorkspaceStage: saveWorkspaceStageFn, saveStage: saveStageFn } = projectApiRef.current
      if (workspaceMode) await saveWorkspaceStageFn(STAGE, payload)
      else await saveStageFn(projectId, STAGE, payload, 'safe_merge')
      setStatus('Audio Studio сохранена')
    } finally {
      setSaving(false)
    }
  }, [projectId, workspaceMode])

  const persistSnapshotSilently = useCallback(async (nextSnapshot, reason = 'autosave_v204a3') => {
    const payload = {
      ...nextSnapshot,
      version: VERSION,
      stage: STAGE,
      updatedAt: nowIso(),
      lastSaveReason: reason,
    }
    try {
      const { saveWorkspaceStage: saveWorkspaceStageFn, saveStage: saveStageFn } = projectApiRef.current
      if (workspaceMode) await saveWorkspaceStageFn(STAGE, payload)
      else await saveStageFn(projectId, STAGE, payload, 'safe_merge')
      return true
    } catch (err) {
      console.warn('[AUDIO STUDIO AUTOSAVE V204A3]', err)
      return false
    }
  }, [projectId, workspaceMode])

  useEffect(() => {
    if (loading || !didLoadRef.current) return undefined
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(() => {
      persistSnapshotSilently(snapshotRef.current, 'autosave_v204a3')
    }, 850)
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    }
  }, [snapshot, loading, persistSnapshotSilently])

  const patchScene = useCallback((sceneId, patcher) => {
    setSnapshot((current) => {
      const scenes = asArray(current.scenes).map((scene) => {
        if (cleanId(scene.id) !== cleanId(sceneId)) return scene
        return typeof patcher === 'function' ? patcher(scene) : { ...scene, ...patcher }
      })
      const next = { ...current, scenes, updatedAt: nowIso() }
      snapshotRef.current = next
      return next
    })
  }, [])

  const patchSelectedScene = useCallback((patcher) => {
    if (!selectedScene?.id) return
    patchScene(selectedScene.id, patcher)
  }, [patchScene, selectedScene?.id])

  useEffect(() => {
    if (projectId && syncActiveProjectFromRoute) syncActiveProjectFromRoute(projectId, 'audio_studio_route')
  }, [projectId, syncActiveProjectFromRoute])

  useEffect(() => {
    let alive = true
    async function load() {
      didLoadRef.current = false
      setLoading(true)
      setLoadMessage('Открываю Audio Studio…')
      setError('')
      try {
        const stateBoard = location.state?.board && typeof location.state.board === 'object' ? location.state.board : null
        const forceImport = Boolean(location.state?.forceImportFromBoard || stateBoard)
        setLoadMessage(forceImport ? 'Переношу сцены из Доски…' : 'Читаю snapshot Audio Studio…')
        const audioData = await withUiTimeout(
          workspaceMode ? projectApiRef.current.loadWorkspaceStage(STAGE) : projectApiRef.current.loadStage(projectId, STAGE),
          12000,
          'load audio_studio snapshot',
        ).catch((err) => {
          console.warn('[AUDIO STUDIO LOAD SNAPSHOT V204A3]', err)
          return {}
        })
        let next = audioData && typeof audioData === 'object' ? audioData : {}
        let shouldPersist = false

        if (forceImport && stateBoard) {
          next = mergeAudioWithFreshBoard(next, stateBoard, projectId)
          shouldPersist = true
          setStatus(`Сцены перенесены из Доски: ${asArray(next.scenes).length}`)
        } else {
          setLoadMessage(asArray(next.scenes).length ? 'Сверяю цвета и статусы сцен с Доской…' : 'Audio Studio пустая — беру сцены из Доски…')
          const boardData = await withUiTimeout(
            workspaceMode ? projectApiRef.current.loadWorkspaceStage('board') : projectApiRef.current.loadStage(projectId, 'board'),
            12000,
            'load board snapshot',
          ).catch((err) => {
            console.warn('[AUDIO STUDIO LOAD BOARD V204A3]', err)
            return {}
          })
          if (asArray(boardData?.scenes).length) {
            next = asArray(next.scenes).length
              ? mergeAudioWithFreshBoard(next, boardData, projectId)
              : buildAudioSnapshotFromBoard(boardData, { projectId, source: 'board_auto_import_v204a3' })
            shouldPersist = true
            setStatus(asArray(audioData?.scenes).length
              ? `Цвета и статусы сцен обновлены из Доски: ${asArray(next.scenes).length}`
              : `Авто-импорт из Доски: ${asArray(next.scenes).length} сцен`)
          }
        }

        if (!next.version) next.version = VERSION
        if (!next.stage) next.stage = STAGE
        if (!next.selectedSceneId && asArray(next.scenes).length) next.selectedSceneId = next.scenes[0].id
        if (shouldPersist) {
          setLoadMessage('Сохраняю Audio Studio, чтобы F5 держал сцены…')
          await persistSnapshotSilently(next, forceImport ? 'board_import_persist_v204a3' : 'board_auto_import_persist_v204a3')
        }
        if (alive) {
          setSnapshot(next)
          snapshotRef.current = next
          didLoadRef.current = true
        }
      } catch (err) {
        if (alive) setError(`Не удалось загрузить Audio Studio: ${err?.message || err}`)
      } finally {
        if (alive) {
          setLoading(false)
          setLoadMessage('')
        }
      }
    }
    load()
    return () => { alive = false }
  // V204A3: initial load is keyed only by the route/navigation entry.
  // ProjectContext save updates lastSavedAt and recreates API functions; if those
  // are dependencies here, Audio Studio enters a GET/POST reload loop.
  }, [routeLoadKey])

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
  }, [])

  const refreshFromBoard = useCallback(async () => {
    setError('')
    try {
      const boardData = workspaceMode ? await loadWorkspaceStage('board') : await loadStage(projectId, 'board')
      if (!asArray(boardData?.scenes).length) {
        setStatus('В Доске нет сцен для переноса')
        return
      }
      const next = mergeAudioWithFreshBoard(snapshotRef.current, boardData, projectId)
      await saveSnapshot(next, 'refresh_from_board_v204a')
      setStatus(`Обновлено из Доски: ${asArray(next.scenes).length} сцен`)
    } catch (err) {
      setError(`Не удалось обновить из Доски: ${err?.message || err}`)
    }
  }, [loadStage, loadWorkspaceStage, projectId, saveSnapshot, workspaceMode])

  const uploadSceneVideo = useCallback(async (file) => {
    if (!file || !selectedScene) return
    setUploading(true)
    setError('')
    try {
      const data = await uploadMediaAsset({ file, projectId: projectId || null, kind: 'video', stage: STAGE })
      const media = makeMediaRefFromUpload(data)
      const next = {
        ...snapshotRef.current,
        scenes: asArray(snapshotRef.current.scenes).map((scene) => cleanId(scene.id) === cleanId(selectedScene.id)
          ? { ...scene, sourceVideo: media, status: 'ready' }
          : scene),
      }
      await saveSnapshot(next, 'upload_scene_video_v204a')
      setStatus('Видео сцены загружено')
    } catch (err) {
      setError(`Не удалось загрузить видео: ${err?.message || err}`)
    } finally {
      setUploading(false)
    }
  }, [projectId, saveSnapshot, selectedScene])

  const updateSelectedField = useCallback((key, value) => {
    patchSelectedScene((scene) => ({ ...scene, [key]: value }))
  }, [patchSelectedScene])

  const updateSelectedVolume = useCallback((value) => {
    const volume = Math.max(0, Math.min(150, Number(value) || 0))
    patchSelectedScene((scene) => ({
      ...scene,
      mmaudioVolume: volume,
      variants: asArray(scene.variants).map((variant) => cleanId(variant.id) === cleanId(scene.selectedVariantId)
        ? { ...variant, volume }
        : variant),
    }))
  }, [patchSelectedScene])

  const pollMmaudioJob = useCallback((jobId, sceneId, startedVariantSeed = {}) => {
    const cleanJobId = cleanId(jobId)
    if (!cleanJobId) return
    if (pollRef.current) clearInterval(pollRef.current)
    let stopped = false
    let inFlight = false
    let ticks = 0
    const stop = () => {
      stopped = true
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = null
    }
    const tick = async () => {
      if (stopped || inFlight) return
      inFlight = true
      ticks += 1
      try {
        const data = await apiRequest(`/clip/mmaudio/status/${cleanJobId}`)
        const polledStatus = firstText(data.status, data.audio_status, data.video_status, 'running')
        const output = pickMmaudioOutputUrl(data)
        const done = statusLooksDone(polledStatus) || Boolean(output)
        const failed = statusLooksFailed(polledStatus)
        patchScene(sceneId, (scene) => ({ ...scene, status: done ? 'variants' : polledStatus, jobStatus: polledStatus }))
        if (!done && !failed && ticks < 240) return

        stop()
        setGeneratingSceneId('')
        if (failed || !output) {
          patchScene(sceneId, (scene) => ({ ...scene, jobId: '', jobStatus: '', status: 'error' }))
          setError(`MMAudio завершился без результата: ${polledStatus}`)
          return
        }

        const ref = normalizeRef(output)
        const variantId = makeId('mmaudio')
        const variant = {
          id: variantId,
          kind: 'mmaudio_video',
          label: `v${asArray(snapshotRef.current.scenes.find((s) => cleanId(s.id) === cleanId(sceneId))?.variants).length + 1}`,
          url: ref.url,
          apiPath: ref.apiPath,
          assetId: ref.assetId,
          prompt: startedVariantSeed.prompt || '',
          negativePrompt: startedVariantSeed.negativePrompt || '',
          volume: startedVariantSeed.volume ?? 100,
          jobId: cleanJobId,
          rawMode: true,
          steps: 25,
          cfg: 3,
          createdAt: nowIso(),
          response: data,
        }
        const next = {
          ...snapshotRef.current,
          scenes: asArray(snapshotRef.current.scenes).map((scene) => {
            if (cleanId(scene.id) !== cleanId(sceneId)) return scene
            return {
              ...scene,
              status: 'variants',
              jobId: '',
              jobStatus: '',
              selectedVariantId: variantId,
              mmaudioVolume: variant.volume,
              variants: [variant, ...asArray(scene.variants)].slice(0, 24),
            }
          }),
        }
        await saveSnapshot(next, 'mmaudio_completed_v204a')
        setStatus('MMAudio готово — вариант добавлен в ленту')
        try { window.dispatchEvent(new CustomEvent('ava:credits-changed', { detail: data })) } catch {}
      } catch (err) {
        stop()
        setGeneratingSceneId('')
        setError(`Polling MMAudio остановлен: ${err?.message || err}`)
        patchScene(sceneId, (scene) => ({ ...scene, jobId: '', jobStatus: '', status: 'error' }))
      } finally {
        inFlight = false
      }
    }
    tick()
    pollRef.current = setInterval(tick, 2200)
  }, [patchScene, saveSnapshot])

  const submitMmaudio = useCallback(async () => {
    if (!selectedScene) return
    const sceneId = selectedScene.id
    const sourceVideo = firstText(selectedScene.sourceVideo?.apiPath, selectedScene.sourceVideo?.url)
    const prompt = cleanId(selectedScene.prompt)
    const negativePrompt = cleanId(selectedScene.negativePrompt || DEFAULT_NEGATIVE)
    if (!sourceVideo) {
      setError('У выбранной сцены нет видео. Перенеси из Доски или загрузи видео слева.')
      return
    }
    if (!prompt) {
      setError('Введите короткий RAW prompt. Например: испуг, дыхание, ключи, шорох куртки, без фона')
      return
    }
    setError('')
    setGeneratingSceneId(sceneId)
    patchScene(sceneId, (scene) => ({ ...scene, status: 'starting', jobStatus: 'отправляю в MMAudio…' }))
    try {
      const payload = {
        scene_id: sceneId,
        sceneId,
        source: 'audio_studio_mmaudio_v204a',
        stage: STAGE,
        project_id: projectId || '',
        projectId: projectId || '',
        route: 'mmaudio',
        mmaudio_mode: 'raw',
        mmaudioMode: 'raw',
        mmaudio_preset: 'raw',
        mmaudioPreset: 'raw',
        raw_mode: true,
        rawMode: true,
        mmaudio_steps: 25,
        mmaudioSteps: 25,
        steps: 25,
        mmaudio_cfg: 3,
        mmaudioCfg: 3,
        cfg: 3,
        video_url: sourceVideo,
        videoUrl: sourceVideo,
        input_video_url: sourceVideo,
        inputVideoUrl: sourceVideo,
        source_video_url: sourceVideo,
        sourceVideoUrl: sourceVideo,
        sound_prompt: prompt,
        soundPrompt: prompt,
        prompt,
        positive_prompt: prompt,
        negative_prompt: negativePrompt,
        negativePrompt,
        negative_sound_prompt: negativePrompt,
        negativeSoundPrompt: negativePrompt,
        duration_sec: selectedScene.durationSec || 5,
        durationSec: selectedScene.durationSec || 5,
        target_duration_sec: selectedScene.durationSec || 5,
        targetDurationSec: selectedScene.durationSec || 5,
      }
      const data = await apiRequest('/clip/mmaudio/start', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      const jobId = firstText(data.jobId, data.job_id, data.id)
      const output = pickMmaudioOutputUrl(data)
      patchScene(sceneId, (scene) => ({ ...scene, jobId, jobStatus: firstText(data.status, 'queued'), status: firstText(data.status, 'queued') }))
      if (output && !jobId) {
        const ref = normalizeRef(output)
        const variantId = makeId('mmaudio')
        const variant = {
          id: variantId,
          kind: 'mmaudio_video',
          label: `v${asArray(selectedScene.variants).length + 1}`,
          url: ref.url,
          apiPath: ref.apiPath,
          assetId: ref.assetId,
          prompt,
          negativePrompt,
          volume: selectedScene.mmaudioVolume || 100,
          rawMode: true,
          steps: 25,
          cfg: 3,
          createdAt: nowIso(),
          response: data,
        }
        const next = {
          ...snapshotRef.current,
          scenes: asArray(snapshotRef.current.scenes).map((scene) => cleanId(scene.id) === cleanId(sceneId)
            ? { ...scene, status: 'variants', jobId: '', jobStatus: '', selectedVariantId: variantId, variants: [variant, ...asArray(scene.variants)].slice(0, 24) }
            : scene),
        }
        await saveSnapshot(next, 'mmaudio_completed_direct_v204a')
        setGeneratingSceneId('')
        setStatus('MMAudio готово — вариант добавлен в ленту')
        return
      }
      if (jobId) {
        pollMmaudioJob(jobId, sceneId, { prompt, negativePrompt, volume: selectedScene.mmaudioVolume || 100 })
      } else {
        setGeneratingSceneId('')
        throw new Error('MMAudio не вернул job_id')
      }
    } catch (err) {
      setGeneratingSceneId('')
      patchScene(sceneId, (scene) => ({ ...scene, jobId: '', jobStatus: '', status: 'error' }))
      setError(`Не удалось отправить в MMAudio: ${err?.message || err}`)
    }
  }, [patchScene, pollMmaudioJob, projectId, selectedScene])

  const syncAppliedToBoard = useCallback(async (scene, variant) => {
    const ref = normalizeRef(firstText(variant.apiPath, variant.url))
    if (!scene?.id || !ref.apiPath && !ref.url) return
    try {
      const boardData = workspaceMode ? await loadWorkspaceStage('board') : await loadStage(projectId, 'board')
      const scenes = asArray(boardData.scenes).map((boardScene) => {
        const boardSceneId = firstText(boardScene.scene_id, boardScene.sceneId, boardScene.id)
        if (cleanId(boardSceneId) !== cleanId(scene.id)) return boardScene
        return {
          ...boardScene,
          mmaudio_video_url: ref.url || ref.apiPath,
          mmaudioVideoUrl: ref.url || ref.apiPath,
          mmaudio_video_api_path: ref.apiPath,
          mmaudioVideoApiPath: ref.apiPath,
          mmaudio_video_asset_id: ref.assetId,
          mmaudioVideoAssetId: ref.assetId,
          has_sound: true,
          hasSound: true,
          mmaudio_prompt: variant.prompt || scene.prompt || '',
          mmaudioPrompt: variant.prompt || scene.prompt || '',
          mmaudio_negative_prompt: variant.negativePrompt || scene.negativePrompt || '',
          mmaudioNegativePrompt: variant.negativePrompt || scene.negativePrompt || '',
          mmaudio_volume: Number(variant.volume ?? scene.mmaudioVolume ?? 100),
          mmaudioVolume: Number(variant.volume ?? scene.mmaudioVolume ?? 100),
          audio_studio_applied_variant_id: variant.id,
          audioStudioAppliedVariantId: variant.id,
          audio_studio_updated_at: nowIso(),
          audioStudioUpdatedAt: nowIso(),
        }
      })
      const nextBoard = { ...boardData, scenes, selectedSceneId: boardData.selectedSceneId || scene.id, updatedAt: nowIso() }
      if (workspaceMode) await saveWorkspaceStage('board', nextBoard)
      else await saveStage(projectId, 'board', nextBoard, 'safe_merge')
      setStatus('Вариант применён и записан в Доску для монтажки')
    } catch (err) {
      setStatus(`Вариант применён в Audio Studio, но Доска не обновилась: ${err?.message || err}`)
    }
  }, [loadStage, loadWorkspaceStage, projectId, saveStage, saveWorkspaceStage, workspaceMode])

  const applySelectedVariant = useCallback(async () => {
    if (!selectedScene || !selectedVariant) {
      setStatus('Сначала выбери вариант в нижней ленте')
      return
    }
    const volume = Number(selectedScene.mmaudioVolume ?? selectedVariant.volume ?? 100)
    const nextVariant = { ...selectedVariant, volume, applied: true }
    const next = {
      ...snapshotRef.current,
      scenes: asArray(snapshotRef.current.scenes).map((scene) => {
        if (cleanId(scene.id) !== cleanId(selectedScene.id)) return scene
        return {
          ...scene,
          status: 'applied',
          appliedVariantId: selectedVariant.id,
          selectedVariantId: selectedVariant.id,
          mmaudioVolume: volume,
          variants: asArray(scene.variants).map((variant) => cleanId(variant.id) === cleanId(selectedVariant.id)
            ? nextVariant
            : { ...variant, applied: false }),
        }
      }),
    }
    await saveSnapshot(next, 'apply_variant_v204a')
    await syncAppliedToBoard(selectedScene, nextVariant)
  }, [saveSnapshot, selectedScene, selectedVariant, syncAppliedToBoard])

  const deleteVariant = useCallback(async (variantId) => {
    if (!selectedScene || !variantId) return
    const next = {
      ...snapshotRef.current,
      scenes: asArray(snapshotRef.current.scenes).map((scene) => {
        if (cleanId(scene.id) !== cleanId(selectedScene.id)) return scene
        const variants = asArray(scene.variants).filter((variant) => cleanId(variant.id) !== cleanId(variantId))
        const selectedGone = cleanId(scene.selectedVariantId) === cleanId(variantId)
        const appliedGone = cleanId(scene.appliedVariantId) === cleanId(variantId)
        return {
          ...scene,
          variants,
          selectedVariantId: selectedGone ? (variants[0]?.id || '') : scene.selectedVariantId,
          appliedVariantId: appliedGone ? '' : scene.appliedVariantId,
          status: appliedGone ? (variants.length ? 'variants' : 'ready') : scene.status,
        }
      }),
    }
    await saveSnapshot(next, 'delete_variant_v204a')
  }, [saveSnapshot, selectedScene])

  const selectVariant = useCallback((variantId) => {
    if (!selectedScene) return
    patchSelectedScene((scene) => {
      const variant = asArray(scene.variants).find((item) => cleanId(item.id) === cleanId(variantId))
      return {
        ...scene,
        selectedVariantId: variantId,
        mmaudioVolume: Number(variant?.volume ?? scene.mmaudioVolume ?? 100),
      }
    })
  }, [patchSelectedScene, selectedScene])

  const saveNow = useCallback(() => saveSnapshot(snapshotRef.current, 'manual_save_v204a'), [saveSnapshot])

  const sourceVideoRef = firstText(selectedScene?.sourceVideo?.apiPath, selectedScene?.sourceVideo?.url)
  const selectedResultRef = selectedVariant ? variantRef(selectedVariant) : ''
  const activeVolume = Number(selectedScene?.mmaudioVolume ?? selectedVariant?.volume ?? 100)
  const isGeneratingSelected = generatingSceneId && cleanId(generatingSceneId) === cleanId(selectedScene?.id)

  if (loading) {
    return (
      <div className="avaAudioStudioPage">
        <div className="avaAudioLoading">
          <div className="avaAudioLoadingOrb"><AudioLines size={26} /></div>
          <strong>{loadMessage || 'Загружаю Audio Studio…'}</strong>
          <span>Сцены, цвета, варианты и статусы поднимаются из snapshot.</span>
          <div className="avaAudioLoadingBar"><i /></div>
        </div>
      </div>
    )
  }

  return (
    <div className="avaAudioStudioPage">
      <header className="avaAudioHero">
        <div>
          <p className="avaAudioEyebrow"><Sparkles size={15} /> Ava Audio Studio · {VERSION}</p>
          <h1>Аудио студия</h1>
          <p>Сцены из Доски, MMAudio RAW Foley, варианты по каждой сцене и применение лучшего результата для монтажки.</p>
        </div>
        <div className="avaAudioHeroActions">
          <button type="button" onClick={() => navigate(boardPath)}><ArrowLeft size={16} /> В Доску</button>
          <button type="button" onClick={refreshFromBoard}><RefreshCcw size={16} /> Обновить из Доски</button>
          <button type="button" onClick={saveNow} disabled={saving}><Save size={16} /> {saving ? 'Сохраняю…' : 'Сохранить'}</button>
          <button type="button" className="isPrimary" onClick={() => navigate(assemblyPath)}><Film size={16} /> В монтажку</button>
        </div>
      </header>

      {error ? <div className="avaAudioAlert isError"><X size={16} /> {error}</div> : null}
      {status ? <div className="avaAudioAlert"><CheckCircle2 size={16} /> {status}</div> : null}

      <SceneStrip scenes={snapshot.scenes} selectedSceneId={selectedScene?.id} onSelect={(sceneId) => setSnapshot((current) => {
        const next = { ...current, selectedSceneId: sceneId, updatedAt: nowIso() }
        snapshotRef.current = next
        return next
      })} />

      {!asArray(snapshot.scenes).length ? (
        <section className="avaAudioEmptyState">
          <Headphones size={42} />
          <h2>Пока нет сцен</h2>
          <p>Открой Доску и нажми “В Audio Studio”, либо обнови импорт из сохранённой Доски.</p>
          <button type="button" onClick={refreshFromBoard}><RefreshCcw size={16} /> Взять сцены из Доски</button>
        </section>
      ) : (
        <main className="avaAudioWorkbench">
          <section className="avaAudioPanel avaAudioVideoPanel">
            <div className="avaAudioPanelTitle">
              <span><Film size={17} /> Исходное видео</span>
              <small>{selectedScene?.durationSec ? `${Number(selectedScene.durationSec).toFixed(1)} сек` : 'duration —'}</small>
            </div>
            <PreviewVideo source={sourceVideoRef} title="Исходная сцена" className="avaAudioMainVideo" />
            <div className="avaAudioPanelActions">
              <label className="avaAudioUploadButton">
                <UploadCloud size={15} /> {uploading ? 'Загружаю…' : 'Загрузить видео'}
                <input type="file" accept="video/*" disabled={uploading} onChange={(event) => uploadSceneVideo(event.target.files?.[0])} />
              </label>
            </div>
          </section>

          <section className="avaAudioPanel avaAudioPromptPanel">
            <div className="avaAudioModeSwitch">
              <button type="button" className="isActive"><AudioLines size={15} /> MMAudio RAW</button>
              <button type="button" disabled>Stable Audio скоро</button>
            </div>

            <label className="avaAudioField">
              <span>Prompt</span>
              <textarea
                value={selectedScene?.prompt || ''}
                placeholder="испуг, дыхание, ключи, шорох куртки, без фона"
                onChange={(event) => updateSelectedField('prompt', event.target.value)}
              />
            </label>
            <label className="avaAudioField">
              <span>Negative prompt</span>
              <textarea
                value={selectedScene?.negativePrompt || DEFAULT_NEGATIVE}
                placeholder={DEFAULT_NEGATIVE}
                onChange={(event) => updateSelectedField('negativePrompt', event.target.value)}
              />
            </label>
            <div className="avaAudioHint">
              Формула RAW Foley: <b>эмоция + 2–4 реальных звука + “без фона”</b>. Не писать ambience / room tone / background.
            </div>
            <div className="avaAudioPromptActions">
              <button type="button" className="isPrimary" onClick={submitMmaudio} disabled={Boolean(generatingSceneId) || !selectedScene}>
                <WandSparkles size={16} /> {isGeneratingSelected ? 'Генерится…' : 'Генерить'}
              </button>
              <button type="button" onClick={applySelectedVariant} disabled={!selectedVariant}><CheckCircle2 size={16} /> Применить</button>
              <button type="button" onClick={() => {
                const video = document.querySelector('.avaAudioResultVideo')
                if (video?.play) video.play()
              }} disabled={!selectedResultRef}><Play size={16} /> Прослушать сцену</button>
            </div>
            {selectedScene?.jobStatus ? <p className="avaAudioJobStatus">{selectedScene.jobStatus}</p> : null}
          </section>

          <section className="avaAudioPanel avaAudioResultPanel">
            <div className="avaAudioPanelTitle">
              <span><Headphones size={17} /> Готовый результат</span>
              <small>{appliedVariant ? 'применён вариант' : selectedVariant ? 'просмотр варианта' : 'нет варианта'}</small>
            </div>
            <PreviewVideo source={selectedResultRef} title="MMAudio результат" className="avaAudioMainVideo avaAudioResultVideo" volume={activeVolume / 100} />
            <label className="avaAudioVolume">
              <span><Volume2 size={15} /> Громкость MMAudio <b>{activeVolume}%</b></span>
              <input type="range" min="0" max="150" value={activeVolume} onChange={(event) => updateSelectedVolume(event.target.value)} />
            </label>
            <p className="avaAudioVolumeNote">Исходный звук сцены не меняем. В монтажку уходит только эта громкость MMAudio.</p>
          </section>
        </main>
      )}

      {selectedScene ? (
        <section className="avaAudioVariantsRail">
          <div className="avaAudioRailTitle">
            <h3>Варианты сцены</h3>
            <span>{asArray(selectedScene.variants).length} сохранено · удаляются только через X</span>
          </div>
          <div className="avaAudioVariantList">
            {asArray(selectedScene.variants).length ? asArray(selectedScene.variants).map((variant) => (
              <VariantCard
                key={variant.id}
                variant={variant}
                active={cleanId(variant.id) === cleanId(selectedScene.selectedVariantId)}
                applied={cleanId(variant.id) === cleanId(selectedScene.appliedVariantId)}
                onSelect={() => selectVariant(variant.id)}
                onDelete={() => deleteVariant(variant.id)}
              />
            )) : (
              <div className="avaAudioNoVariants">Пока нет вариантов. Сгенерируй MMAudio для этой сцены.</div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  )
}
