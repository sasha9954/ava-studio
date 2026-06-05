import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Clapperboard, Download, Music, RefreshCcw, SlidersHorizontal, UploadCloud, Volume2, Wand2 } from 'lucide-react'
import { useProjects } from '../context/ProjectContext.jsx'
import { apiRequest, buildApiUrl, fetchProtectedBlobUrl, getApiOrigin, normalizeAssetFileUrl, registerStaticMediaAsset, uploadAudioAsset } from '../services/apiClient.js'
import '../styles/ava-board.css'
import WorkflowStageControls from '../components/WorkflowStageControls.jsx'
import { AVA_BOARD_ASSEMBLY_CLEARED_KEY } from '../utils/workflowNavigation.js'

const AUDIO_MODES = [
  {
    value: 'original_only',
    title: 'Только оригинальное аудио',
    text: 'Финальный ролик идёт под master audio / оригинальную озвучку. Звук из сцен выключен.',
  },
  {
    value: 'scene_only',
    title: 'Только звук сцен',
    text: 'Использовать звук, который уже лежит внутри сцен: i2v sound, first-last sound или MMAudio.',
  },
  {
    value: 'original_plus_scene',
    title: 'Оригинал + звук сцен',
    text: 'Оригинальное аудио остаётся главным, а звук сцен добавляется тихим слоем сверху.',
  },
  {
    value: 'music_plus_scene',
    title: 'Музыка + звук сцен',
    text: 'Фоновая музыка становится основной дорожкой, а звук сцен подмешивается сверху. Без оригинального audio.',
  },
  {
    value: 'original_plus_music_scene',
    title: 'Оригинал + музыка + звук сцен',
    text: 'Для документалок и историй: master audio + фоновая музыка + scene ambience.',
  },
]
function assemblySettingsKey(projectId = '') {
  return projectId
    ? `ava:board-assembly:${projectId}:settings:v1`
    : 'ava:board-assembly:workspace:settings:v1'
}

function isBoardAssemblyCleared() {
  try {
    return Boolean(localStorage.getItem(AVA_BOARD_ASSEMBLY_CLEARED_KEY) || sessionStorage.getItem(AVA_BOARD_ASSEMBLY_CLEARED_KEY))
  } catch {
    return false
  }
}

function clearBoardAssemblyClearedMarker() {
  try {
    localStorage.removeItem(AVA_BOARD_ASSEMBLY_CLEARED_KEY)
    sessionStorage.removeItem(AVA_BOARD_ASSEMBLY_CLEARED_KEY)
  } catch {
    // ignore
  }
}

function emptyBoardAssemblySource() {
  return {
    source: 'board_assembly_cleared',
    boardVersion: 'board_assembly_cleared_v1',
    scenes: [],
    audio: null,
    updatedAt: new Date().toISOString(),
  }
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function readAssemblySettings(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}') || {}
  } catch (error) {
    return {}
  }
}

function writeAssemblySettings(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    // ignore localStorage quota/privacy errors
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function formatTime(seconds) {
  const safe = Math.max(0, toNumber(seconds, 0))
  const mins = String(Math.floor(safe / 60)).padStart(2, '0')
  const secs = String(Math.floor(safe % 60)).padStart(2, '0')
  const ms = String(Math.floor((safe - Math.floor(safe)) * 1000)).padStart(3, '0')
  return `${mins}:${secs}.${ms}`
}

function durationOf(scene) {
  const direct = toNumber(scene?.duration_sec ?? scene?.durationSec, 0)
  if (direct > 0) return direct
  return Math.max(0, toNumber(scene?.end_sec ?? scene?.end, 0) - toNumber(scene?.start_sec ?? scene?.start, 0))
}

function isLocalBrowserPath(value = '') {
  const raw = String(value || '').trim()
  return /^[a-zA-Z]:[\\/]/.test(raw) || raw.startsWith('\\\\') || raw.startsWith('file:')
}

function normalizePlayableVideoUrl(value = '') {
  const raw = String(value || '').trim()
  if (!raw || isLocalBrowserPath(raw)) return ''
  const apiOrigin = getApiOrigin()
  if (/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::(?:8000|8010))?(\/static\/.*)$/i.test(raw)) {
    return raw.replace(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::(?:8000|8010))?/i, apiOrigin)
  }
  if (/^https?:\/\//i.test(raw) || raw.startsWith('blob:') || raw.startsWith('data:')) return raw
  if (raw.startsWith('/static/')) return `${apiOrigin}${raw}`
  if (raw.startsWith('static/')) return `${apiOrigin}/${raw}`
  if (raw.startsWith('/assets/')) return buildApiUrl(raw)
  if (raw.startsWith('/api/')) return buildApiUrl(raw)
  if (raw.startsWith('/')) return buildApiUrl(raw)
  return buildApiUrl(raw)
}

function pickSceneVideoApiPath(scene = {}, preferMmaudio = true) {
  if (preferMmaudio) {
    const mmaudioPath = scene?.mmaudio_video_api_path || scene?.mmaudioVideoApiPath || scene?.mmaudio_result?.video_api_path || scene?.mmaudioResult?.videoApiPath
    if (mmaudioPath) return String(mmaudioPath).trim()
  }
  return String(
    scene?.video_api_path ||
    scene?.videoApiPath ||
    scene?.result_video_api_path ||
    scene?.resultVideoApiPath ||
    scene?.video_result?.video_api_path ||
    scene?.videoResult?.videoApiPath ||
    ''
  ).trim()
}

function pickSceneVideoJobId(scene = {}, preferMmaudio = true) {
  if (preferMmaudio) {
    const mmaudioJobId = scene?.mmaudio_video_job_id || scene?.mmaudioVideoJobId || scene?.mmaudio_job_id || scene?.mmaudioJobId
    if (mmaudioJobId) return String(mmaudioJobId).trim()
  }
  return String(scene?.video_job_id || scene?.videoJobId || scene?.job_id || scene?.jobId || '').trim()
}

function pickSceneVideoStatusEndpoint(scene = {}, preferMmaudio = true) {
  if (preferMmaudio) {
    const mmaudioStatus = scene?.mmaudio_video_status_endpoint || scene?.mmaudioVideoStatusEndpoint || scene?.mmaudio_status_endpoint || scene?.mmaudioStatusEndpoint
    if (mmaudioStatus) return String(mmaudioStatus).trim()
  }
  return String(scene?.video_status_endpoint || scene?.videoStatusEndpoint || scene?.status_endpoint || scene?.statusEndpoint || '').trim()
}


function assemblyStableHueFromText(value, fallbackIndex = 0) {
  const text = String(value || '').trim()
  if (!text) return 185 + ((Number(fallbackIndex || 0) * 47) % 150)
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i)
    hash |= 0
  }
  return 185 + (Math.abs(hash) % 150)
}

function assemblySceneColor(scene, index = 0) {
  const blockKey = String(
    scene?.blockId ??
    scene?.block_id ??
    scene?.semanticBlockId ??
    scene?.semantic_block_id ??
    scene?.blockTitle ??
    scene?.block_title ??
    scene?.storyBlockId ??
    scene?.story_block_id ??
    ''
  ).trim()

  const blockNumber = Number(
    scene?.blockIndex ??
    scene?.block_index ??
    scene?.blockNumber ??
    scene?.block_number
  )

  if (blockKey) {
    if (Number.isFinite(blockNumber)) return 185 + ((blockNumber * 47) % 150)
    return assemblyStableHueFromText(`block:${blockKey}`, index)
}

  const direct = Number(
    scene?.blockColor ??
    scene?.block_color ??
    scene?.blockHue ??
    scene?.block_hue ??
    scene?.color ??
    scene?.sceneColor ??
    scene?.scene_color ??
    scene?.hue
  )
  if (Number.isFinite(direct)) return direct

  return 185 + ((Number(index || 0) * 47) % 150)
}

function assemblySceneBlockLabel(scene = {}) {
  return String(
    scene.blockTitle ??
    scene.block_title ??
    scene.storyBlockTitle ??
    scene.story_block_title ??
    scene.blockLabel ??
    scene.block_label ??
    scene.blockId ??
    scene.block_id ??
    scene.semanticBlockId ??
    scene.semantic_block_id ??
    ''
  ).trim()
}

function AvaAssemblyLoading({ title = 'Загрузка видео монтажа…', subtitle = 'Подключаем сцены, видео, звук и блоки.' }) {
  return (
    <div className="avaPage avaStoryboardLoadingPage">
      <section className="avaLoadingHero">
        <div className="avaLoadingCard">
          <div className="avaLoadingOrb"><Clapperboard size={28} /></div>
          <p className="avaEyebrow">Ava Studio pipeline</p>
          <h2>{title}</h2>
          <p>{subtitle}</p>
          <div className="avaLoadingPipeline" aria-hidden="true">
            <span className="isDone">Timing</span>
            <i />
            <span className="isActive">Board</span>
            <i />
            <span>Media</span>
            <i />
            <span>Montage</span>
          </div>
        </div>
        <div className="avaLoadingStatusPanel" aria-hidden="true">
            <div className="avaLoadingStatusCard isDone">
              <span>01</span>
              <strong>Timing</strong>
              <small>таймкоды и блоки получены</small>
            </div>
            <div className="avaLoadingStatusCard isActive">
              <span>02</span>
              <strong>Storyboard</strong>
              <small>сцены и промты загружаются</small>
            </div>
            <div className="avaLoadingStatusCard">
              <span>03</span>
              <strong>Media</strong>
              <small>проверяем видео и звук</small>
            </div>
            <div className="avaLoadingStatusCard">
              <span>04</span>
              <strong>Ready</strong>
              <small>готовим доску к работе</small>
            </div>
          </div>
      </section>
    </div>
  )
}

function sceneVideoUrl(scene, preferMmaudio = true) {
  const apiPath = pickSceneVideoApiPath(scene, preferMmaudio)
  if (apiPath) return normalizePlayableVideoUrl(apiPath)
  if (preferMmaudio) {
    const mmaudioUrl = scene?.mmaudio_video_url || scene?.mmaudioVideoUrl || scene?.mmaudio_result?.video_url || scene?.mmaudioResult?.videoUrl
    const normalizedMmaudioUrl = normalizePlayableVideoUrl(mmaudioUrl)
    if (normalizedMmaudioUrl) return normalizedMmaudioUrl
  }
  return normalizePlayableVideoUrl(
    scene?.video_url ||
    scene?.videoUrl ||
    scene?.result_video_url ||
    scene?.resultVideoUrl ||
    scene?.video_result?.video_url ||
    scene?.videoResult?.videoUrl ||
    ''
  )
}

function sceneVideoAssetApiPath(scene, preferMmaudio = true) {
  const asset = normalizeAssetFileUrl(pickSceneVideoApiPath(scene, preferMmaudio))
  return asset.assetId ? asset.apiPath : ''
}

function sceneHasSound(scene) {
  return Boolean(
    scene?.mmaudio_video_api_path ||
    scene?.mmaudioVideoApiPath ||
    scene?.mmaudio_video_url ||
    scene?.mmaudioVideoUrl ||
    scene?.audio_slice_url ||
    scene?.sound_prompt ||
    scene?.route === 'i2v_sound' ||
    scene?.route === 'first_last_sound'
  )
}

function sceneTitle(scene, index) {
  return scene?.title || scene?.id || scene?.scene_id || `seg_${String(index + 1).padStart(2, '0')}`
}

function boardOriginalAudio(board = {}) {
  const audio = board?.audio || board?.sourceAudio || board?.timingAudio || board?.originalAudio || {}
  return {
    url: audio.assetApiPath || audio.audioAssetApiPath || audio.apiPath || audio.url || audio.src || audio.audioUrl || audio.audio_url || '',
    assetId: audio.assetId || audio.asset_id || audio.audioAssetId || audio.audio_asset_id || '',
    name: audio.name || audio.fileName || audio.filename || audio.audioName || '',
  }
}

function normalizeBoard(raw = {}) {
  const board = raw?.board || raw || {}
  return {
    ...board,
    scenes: asArray(board.scenes),
    audio: board.audio || null,
  }
}


function isGeneratorAssemblyBoard(board = {}) {
  return Boolean(
    board?.source === 'standalone_generator' ||
    board?.sourceNodeId === 'standalone_generator' ||
    board?.generatorHandoff?.source === 'standalone_generator' ||
    board?.generatorHandoff?.target === 'board_assembly'
  )
}

function buildSceneItems(board, preferMmaudio = true) {
  return asArray(board.scenes).map((scene, index) => {
    const videoApiPath = pickSceneVideoApiPath(scene, preferMmaudio)
    const videoAssetApiPath = sceneVideoAssetApiPath(scene, preferMmaudio)
    const videoJobId = pickSceneVideoJobId(scene, preferMmaudio)
    const videoStatusEndpoint = pickSceneVideoStatusEndpoint(scene, preferMmaudio)
    const videoUrl = sceneVideoUrl(scene, preferMmaudio)
    const hasBaseVideo = Boolean(scene?.video_api_path || scene?.videoApiPath || scene?.video_url || scene?.videoUrl)
    const hasMmaudio = Boolean(scene?.mmaudio_video_api_path || scene?.mmaudioVideoApiPath || scene?.mmaudio_video_url || scene?.mmaudioVideoUrl)
    const hasVideo = Boolean(videoUrl)
    const hasSound = sceneHasSound(scene)
    const duration = durationOf(scene)
    return {
      id: scene?.id || scene?.scene_id || `seg_${String(index + 1).padStart(2, '0')}`,
      index,
      title: sceneTitle(scene, index),
      videoUrl,
      video_url: videoUrl,
      videoApiPath,
      video_api_path: videoApiPath,
      videoAssetApiPath,
      video_asset_api_path: videoAssetApiPath,
      videoJobId,
      video_job_id: videoJobId,
      videoStatusEndpoint,
      video_status_endpoint: videoStatusEndpoint,
      hasVideo,
      hasBaseVideo,
      hasMmaudio,
      hasSound,
      duration,
      route: scene?.route || 'i2v',
      hue: assemblySceneColor(scene, index),
      blockLabel: assemblySceneBlockLabel(scene),
      start: toNumber(scene?.start_sec ?? scene?.start, 0),
      end: toNumber(scene?.end_sec ?? scene?.end, 0),
      raw: scene,
    }
  })
}

export default function BoardAssemblyPage() {
  const { projectId } = useParams()
  const workspaceMode = !projectId
  const { loadStage, saveStage, loadWorkspaceStage, saveWorkspaceStage } = useProjects()

  const [board, setBoard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [selectedSceneId, setSelectedSceneId] = useState('')
  const [audioMode, setAudioMode] = useState('original_plus_scene')
  const [preferMmaudio, setPreferMmaudio] = useState(true)
  const [skipMissing, setSkipMissing] = useState(false)
  const [originalVolume, setOriginalVolume] = useState(100)
  const [sceneVolume, setSceneVolume] = useState(25)
  const [musicVolume, setMusicVolume] = useState(15)
  const [musicFile, setMusicFile] = useState(null)
  const [musicAsset, setMusicAsset] = useState(null)
  const [musicPreviewUrl, setMusicPreviewUrl] = useState('')
  const [selectedVideoBlobUrl, setSelectedVideoBlobUrl] = useState('')
  const [selectedVideoLoadError, setSelectedVideoLoadError] = useState('')
  const [musicUploading, setMusicUploading] = useState(false)
  const [musicLoop, setMusicLoop] = useState(true)
  const [musicFadeOut, setMusicFadeOut] = useState(true)
  const [watermarkEnabled, setWatermarkEnabled] = useState(true)
  const [watermarkText, setWatermarkText] = useState('ava studio')
  const [watermarkPosition, setWatermarkPosition] = useState('top_right')
  const [watermarkOpacity, setWatermarkOpacity] = useState(35)
  const [watermarkSize, setWatermarkSize] = useState(28)
  const [watermarkMotion, setWatermarkMotion] = useState('corners')
  const [musicPanelOpen, setMusicPanelOpen] = useState(true)
  const [watermarkPanelOpen, setWatermarkPanelOpen] = useState(true)
  const [assemblyJob, setAssemblyJob] = useState(null)
  const [assemblyRunning, setAssemblyRunning] = useState(false)
  const [finalVideoUrl, setFinalVideoUrl] = useState('')
  const [finalDirty, setFinalDirty] = useState(false)
  const [settingsHydrated, setSettingsHydrated] = useState(false)

  const settingsStorageKey = assemblySettingsKey(projectId || '')

  useEffect(() => {
    let cancelled = false
    const savedSettings = readAssemblySettings(settingsStorageKey)

    setAudioMode(savedSettings.audioMode || 'original_plus_scene')
    setPreferMmaudio(savedSettings.preferMmaudio ?? true)
    setSkipMissing(savedSettings.skipMissing ?? false)
    setOriginalVolume(clampNumber(savedSettings.originalVolume, 0, 150, 100))
    setSceneVolume(clampNumber(savedSettings.sceneVolume, 0, 150, 25))
    setMusicVolume(clampNumber(savedSettings.musicVolume, 0, 150, 15))
    setMusicAsset(savedSettings.musicAsset || null)
    setMusicFile(null)
    setMusicPreviewUrl('')
    setMusicLoop(savedSettings.musicLoop ?? true)
    setMusicFadeOut(savedSettings.musicFadeOut ?? true)

    const shouldApplyWatermarkDefaults = savedSettings.watermarkDefaultVersion !== 'wm_defaults_07an_ava_studio_top_right_wander_35_28'
    const watermark = {
      enabled: true,
      text: 'ava studio',
      position: 'top_right',
      motion: 'corners',
      opacityPercent: 35,
      size: 28,
    }
    setWatermarkEnabled(true)
    setWatermarkText('ava studio')
    setWatermarkPosition('top_right')
    setWatermarkOpacity(35)
    setWatermarkSize(28)
    setWatermarkMotion('corners')
    setMusicPanelOpen(savedSettings.musicPanelOpen ?? true)
    setWatermarkPanelOpen(savedSettings.watermarkPanelOpen ?? true)

    setFinalVideoUrl(normalizePlayableVideoUrl(savedSettings.finalVideoUrl || ''))
    setFinalDirty(Boolean(savedSettings.finalDirty))
    setSelectedSceneId(savedSettings.selectedSceneId || '')
    setAssemblyJob(savedSettings.assemblyJob || null)

    const assetPath = savedSettings.musicAsset?.asset_api_path || ''
    if (assetPath) {
      fetchProtectedBlobUrl(assetPath)
        .then((url) => {
          if (!cancelled) setMusicPreviewUrl(url)
        })
        .catch(() => {
          if (!cancelled) setMusicPreviewUrl('')
        })
    }

    setSettingsHydrated(true)

    return () => {
      cancelled = true
    }
  }, [settingsStorageKey])

  const boardRoute = projectId ? `/app/projects/${projectId}/board` : '/app/workspace/board'
  const sceneItems = useMemo(() => buildSceneItems(board || {}, preferMmaudio), [board, preferMmaudio])
  const selectedItem = sceneItems.find((item) => item.id === selectedSceneId) || sceneItems[0] || null
  const selectedItemVideoAssetApiPath = selectedItem?.videoAssetApiPath || ''

  useEffect(() => {
    let cancelled = false
    let objectUrl = ''
    setSelectedVideoBlobUrl('')
    setSelectedVideoLoadError('')
    if (!selectedItemVideoAssetApiPath) return undefined
    async function loadSelectedVideoBlob() {
      try {
        objectUrl = await fetchProtectedBlobUrl(selectedItemVideoAssetApiPath)
        if (!cancelled) setSelectedVideoBlobUrl(objectUrl)
      } catch (error) {
        const message = error?.message || 'asset_fetch_failed'
        if (!cancelled) {
          setSelectedVideoLoadError(message)
          setStatus(`Видео сцены недоступно: ${message}`)
        }
      }
    }
    loadSelectedVideoBlob()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [selectedItemVideoAssetApiPath])

  const selectedItemPlayableVideoUrl = selectedItemVideoAssetApiPath ? selectedVideoBlobUrl : (selectedItem?.videoUrl || '')
  const selectedItemVideoHydrating = Boolean(
    selectedItem &&
    selectedItemVideoAssetApiPath &&
    !selectedVideoBlobUrl &&
    !selectedVideoLoadError
  )
  const watermarkPreviewStyle = {
    opacity: Math.max(0.05, Math.min(1, watermarkOpacity / 100)),
    fontSize: `${Math.max(10, Math.round(watermarkSize * 0.42))}px`,
  }

  const stats = useMemo(() => {
    const total = sceneItems.length
    const ready = sceneItems.filter((item) => item.hasVideo).length
    const withSound = sceneItems.filter((item) => item.hasSound || item.hasMmaudio).length
    const missing = total - ready
    const duration = sceneItems.reduce((maxEnd, item) => Math.max(maxEnd, item.end || item.start + item.duration || 0), 0)
    const originalAudio = boardOriginalAudio(board || {})
    const hasOriginalAudio = Boolean(originalAudio.url || originalAudio.assetId)
    const canAssemble = total > 0 && (ready > 0 || hasOriginalAudio)
    return { total, ready, withSound, missing, duration, hasOriginalAudio, canAssemble }
  }, [sceneItems, board])

  const warnings = useMemo(() => {
    const list = []
    const generatorAssemblyBoard = isGeneratorAssemblyBoard(board || {})
    if (!stats.total) list.push('В Board пока нет сцен.')
    if (stats.missing > 0) list.push(`Нет видео у ${stats.missing} сцен — они будут собраны как пустые участки / black frame.`)
    if (stats.total > 0 && stats.ready === 0 && !stats.hasOriginalAudio) list.push('Нет master audio и нет готовых video-сцен для сборки.')
    if (!generatorAssemblyBoard && !stats.hasOriginalAudio && ['original_only', 'original_plus_scene', 'original_plus_music_scene'].includes(audioMode)) {
      list.push('В Board не найдено оригинальное audio. Для этого режима понадобится master audio.')
    }
    if (['scene_only', 'music_plus_scene'].includes(audioMode) && stats.withSound === 0) {
      list.push('В сценах не найден звук. Используй MMAudio или i2v sound на нужных сценах.')
    }
    if (['music_plus_scene', 'original_plus_music_scene'].includes(audioMode) && !musicFile) {
      list.push('Фоновая музыка пока не загружена. Можно собрать без неё или загрузить MP3/WAV.')
    }
    return list
  }, [stats, audioMode, musicFile, board])

  async function loadBoardSnapshot() {
    setLoading(true)
    setStatus('Загружаем Board snapshot…')

    if (isBoardAssemblyCleared()) {
      setBoard(emptyBoardAssemblySource())
      setSelectedSceneId('')
      setFinalVideoUrl('')
      setFinalDirty(false)
      setAssemblyJob(null)
      setAssemblyRunning(false)
      setStatus('Монтаж очищен. Нажми “Обновить из Board”, чтобы снова подтянуть сцены.')
      setLoading(false)
      return
    }

    try {
      const data = workspaceMode
        ? await loadWorkspaceStage('board')
        : await loadStage(projectId, 'board')

      const nextBoard = normalizeBoard(data)
      setBoard(nextBoard)
      const firstSceneId = nextBoard.scenes?.[0]?.id || nextBoard.scenes?.[0]?.scene_id || ''
      setSelectedSceneId((current) => current || firstSceneId)

      if (isGeneratorAssemblyBoard(nextBoard)) {
        setAudioMode('scene_only')
        setPreferMmaudio(true)
        setSkipMissing(false)
        setOriginalVolume(0)
        setSceneVolume(100)
        setMusicVolume(15)
        setWatermarkEnabled(false)
        setWatermarkText('')
        setWatermarkPosition('bottom_right')
        setWatermarkOpacity(35)
        setWatermarkSize(28)
        setWatermarkMotion('static')
        setFinalVideoUrl('')
        setFinalDirty(false)
        setAssemblyJob(null)
        setStatus(nextBoard.scenes?.length ? 'Генератор → монтажник: watermark отключён' : 'В ленте генератора нет видео')
      } else {
        setStatus(nextBoard.scenes?.length ? 'Board snapshot загружен' : 'В Board нет сцен')
      }
    } catch (error) {
      setStatus(`Не удалось загрузить Board: ${error?.message || 'unknown_error'}`)
      setBoard({ scenes: [] })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBoardSnapshot()
  }, [projectId])

  useEffect(() => {
    if (!settingsHydrated) return
    if (!finalVideoUrl) return
    setFinalDirty(true)
  }, [
    audioMode,
    preferMmaudio,
    skipMissing,
    originalVolume,
    sceneVolume,
    musicVolume,
    musicAsset,
    musicLoop,
    musicFadeOut,
    watermarkEnabled,
    watermarkText,
    watermarkPosition,
    watermarkOpacity,
    watermarkSize,
  ])


  useEffect(() => {
    if (!settingsHydrated) return

    writeAssemblySettings(settingsStorageKey, {
      audioMode,
      preferMmaudio,
      skipMissing,
      originalVolume,
      sceneVolume,
      musicVolume,
      musicAsset,
      musicLoop,
      musicFadeOut,
      watermarkDefaultVersion: 'wm_defaults_07ap_ava_studio_top_right_corners_35_28',
      watermark: {
        enabled: Boolean(watermarkEnabled && String(watermarkText || '').trim()),
        text: watermarkText,
        position: watermarkPosition,
        opacityPercent: watermarkOpacity,
        size: watermarkSize,
        motion: watermarkMotion,
      },
      selectedSceneId,
      finalVideoUrl: normalizePlayableVideoUrl(finalVideoUrl),
      finalDirty,
      assemblyJob: assemblyJob
        ? {
            jobId: assemblyJob.jobId || assemblyJob.job_id || '',
            job_id: assemblyJob.job_id || assemblyJob.jobId || '',
            status: assemblyJob.status || '',
            statusEndpoint: assemblyJob.statusEndpoint || '',
            videoUrl: normalizePlayableVideoUrl(assemblyJob.videoUrl || assemblyJob.video_url || ''),
            video_url: normalizePlayableVideoUrl(assemblyJob.video_url || assemblyJob.videoUrl || ''),
            videoApiPath: assemblyJob.videoApiPath || assemblyJob.video_api_path || '',
            video_api_path: assemblyJob.video_api_path || assemblyJob.videoApiPath || '',
            videoName: assemblyJob.videoName || assemblyJob.video_name || '',
            video_name: assemblyJob.video_name || assemblyJob.videoName || '',
            audioMode: assemblyJob.audioMode || '',
            watermarkApplied: assemblyJob.watermarkApplied || false,
          }
        : null,
    })
  }, [
    settingsHydrated,
    settingsStorageKey,
    audioMode,
    preferMmaudio,
    skipMissing,
    originalVolume,
    sceneVolume,
    musicVolume,
    musicAsset,
    musicLoop,
    musicFadeOut,
    watermarkEnabled,
    watermarkText,
    watermarkPosition,
    watermarkOpacity,
    watermarkSize,
    watermarkMotion,
    musicPanelOpen,
    watermarkPanelOpen,
    selectedSceneId,
    finalVideoUrl,
    finalDirty,
    assemblyJob,
  ])


  function boardAssemblyVideoUrl(data) {
    return normalizePlayableVideoUrl(
      data?.videoApiPath ||
      data?.video_api_path ||
      data?.resultVideoApiPath ||
      data?.result_video_api_path ||
      data?.videoUrl ||
      data?.video_url ||
      data?.resultVideoUrl ||
      data?.result_video_url ||
      ''
    )
  }

  async function persistBoardAssemblyResult(data = {}, videoUrl = '') {
    const rawUrl = data?.videoApiPath || data?.video_api_path || data?.videoUrl || data?.video_url || videoUrl || ''
    let assemblyAssetId = data?.assemblyAssetId || data?.assembly_asset_id || data?.assetId || data?.asset_id || ''
    let assemblyApiPath = data?.assemblyApiPath || data?.assembly_api_path || data?.videoApiPath || data?.video_api_path || ''
    const normalizedUrl = normalizePlayableVideoUrl(assemblyApiPath || rawUrl)

    if (!assemblyAssetId && normalizedUrl.includes('/static/assets/')) {
      try {
        const asset = await registerStaticMediaAsset({
          url: normalizedUrl,
          projectId: projectId || null,
          kind: 'assembly',
          stage: 'board_assembly',
          originalName: data?.videoName || data?.video_name || 'board-assembly.mp4',
        })
        assemblyAssetId = asset.asset_id || asset.assetId || ''
        assemblyApiPath = asset.asset_api_path || asset.assetApiPath || assemblyApiPath
      } catch (error) {
        console.warn('[BOARD ASSEMBLY STATIC REGISTER]', { url: normalizedUrl, success: false, error: error?.message || error })
      }
    }

    const snapshot = {
      stage: 'board_assembly',
      source: 'board_assembly_result',
      boardVersion: board?.boardVersion || board?.board_version || '',
      assembly_asset_id: assemblyAssetId,
      assemblyAssetId: assemblyAssetId,
      assembly_api_path: assemblyApiPath,
      assemblyApiPath: assemblyApiPath,
      assemblyUrl: assemblyApiPath || normalizedUrl,
      finalVideoUrl: assemblyApiPath || normalizedUrl,
      video_url: assemblyApiPath || normalizedUrl,
      videoUrl: assemblyApiPath || normalizedUrl,
      video_api_path: assemblyApiPath,
      videoApiPath: assemblyApiPath,
      video_name: data?.videoName || data?.video_name || 'board-assembly.mp4',
      videoName: data?.videoName || data?.video_name || 'board-assembly.mp4',
      jobId: data?.jobId || data?.job_id || assemblyJob?.jobId || assemblyJob?.job_id || '',
      job_id: data?.job_id || data?.jobId || assemblyJob?.job_id || assemblyJob?.jobId || '',
      audioMode,
      preferMmaudio,
      skipMissing,
      stats,
      updatedAt: new Date().toISOString(),
    }

    try {
      if (projectId) await saveStage(projectId, 'board_assembly', snapshot, 'safe_merge')
      else await saveWorkspaceStage('board_assembly', snapshot)
      console.log('[BOARD ASSEMBLY RESULT SAVED]', { assemblyAssetId, assemblyApiPath, videoUrl: snapshot.finalVideoUrl })
    } catch (error) {
      console.warn('[BOARD ASSEMBLY RESULT SAVE_FAILED]', { error: error?.message || error })
    }
  }

  function buildAssemblyPayload() {
    const items = sceneItems
      .slice()
      .sort((a, b) => (a.start - b.start) || (a.index - b.index))
      .map((item) => {
        const raw = item.raw || {}
        const usesMmaudioVideo = preferMmaudio && Boolean(raw.mmaudio_video_api_path || raw.mmaudioVideoApiPath || raw.mmaudio_video_url || raw.mmaudioVideoUrl)
        return {
          scene_id: item.id,
          sceneId: item.id,
          title: item.title,
          route: item.route,
          duration_sec: item.duration,
          start_sec: item.start,
          end_sec: item.end,
          video_url: item.videoUrl,
          videoUrl: item.videoUrl,
          video_api_path: item.videoApiPath || '',
          videoApiPath: item.videoApiPath || '',
          video_job_id: item.videoJobId || '',
          videoJobId: item.videoJobId || '',
          video_status_endpoint: item.videoStatusEndpoint || '',
          videoStatusEndpoint: item.videoStatusEndpoint || '',
          source_is_mmaudio: usesMmaudioVideo,
          has_sound: item.hasSound || item.hasMmaudio,
          placeholder: !item.hasVideo,
          missing_video: !item.hasVideo,
        }
      })

    const originalAudio = boardOriginalAudio(board || {})
    const generatorAssemblyBoard = isGeneratorAssemblyBoard(board || {})

    return {
      project_id: projectId || '',
      audio_mode: audioMode,
      original_audio_url: originalAudio.url,
      original_audio_asset_id: originalAudio.assetId,
      original_audio_name: originalAudio.name,
      skip_missing: skipMissing,
      prefer_mmaudio: preferMmaudio,
      width: 1280,
      height: 720,
      fps: 30,
      duration_sec: stats.duration,
      timeline_duration_sec: stats.duration,
      volumes: {
        original: originalVolume / 100,
        scene: sceneVolume / 100,
        music: musicVolume / 100,
      },
      music: {
        name: musicAsset?.audio_name || musicFile?.name || '',
        loop: musicLoop,
        fade_out: musicFadeOut,
        asset_id: musicAsset?.asset_id || '',
        asset_api_path: musicAsset?.asset_api_path || '',
        audio_url: musicAsset?.asset_api_path || '',
        duration_sec: musicAsset?.audio_duration_sec || 0,
      },
      watermark: {
        enabled: false, // export safe-mode: backend drawtext/fontconfig пока отключён
        text: watermarkText,
        position: watermarkPosition,
        opacity: watermarkOpacity / 100,
        size: watermarkSize,
        motion: watermarkMotion,
      },
      items,
    }
  }

  function pollAssemblyJob(statusEndpoint, jobId) {
    const endpoint = statusEndpoint?.startsWith('/api/')
      ? statusEndpoint.slice(4)
      : statusEndpoint

    if (!endpoint) return

    let attempt = 0
    const tick = async () => {
      attempt += 1
      try {
        const data = await apiRequest(endpoint)
        const nextStatus = data?.status || 'running'
        const videoUrl = boardAssemblyVideoUrl(data)

        setAssemblyJob(data || null)

        if (videoUrl) {
          setFinalVideoUrl(videoUrl)
          setFinalDirty(false)
          setAssemblyRunning(false)
          await persistBoardAssemblyResult(data, videoUrl)
          setStatus(`Финальный MP4 готов: ${data?.videoName || data?.video_name || jobId || ''}`)
          return
        }

        if (['error', 'failed'].includes(String(nextStatus).toLowerCase())) {
          setAssemblyRunning(false)
          setStatus(`Ошибка сборки: ${data?.error || data?.detail || nextStatus}`)
          return
        }

        if (attempt < 240) {
          window.setTimeout(tick, 2500)
        } else {
          setAssemblyRunning(false)
          setStatus('Сборка слишком долго не отвечает: poll_timeout')
        }
      } catch (error) {
        if (attempt < 240) {
          window.setTimeout(tick, 4000)
        } else {
          setAssemblyRunning(false)
          setStatus(`Ошибка проверки сборки: ${error?.message || 'assembly_poll_failed'}`)
        }
      }
    }

    window.setTimeout(tick, 900)
  }

  async function startAssembly() {
    if (!stats.canAssemble) {
      setStatus('Нет готовых видео для сборки')
      return
    }

    setAssemblyRunning(true)
    setFinalVideoUrl('')
    setFinalDirty(false)
    setStatus(`Отправляем сборку в FFmpeg… watermark preview: ${watermarkEnabled && String(watermarkText || '').trim() ? 'ON' : 'OFF'} / export OFF`)

    try {
      const payload = buildAssemblyPayload()
      console.log('[BOARD ASSEMBLY FINAL PAYLOAD SUMMARY]', {
        totalItems: payload.items.length,
        videoItems: payload.items.filter((item) => item.video_url || item.video_api_path).length,
        placeholderItems: payload.items.filter((item) => item.placeholder || item.missing_video).length,
        firstItems: payload.items.slice(0, 8).map((item) => ({
          scene_id: item.scene_id,
          start_sec: item.start_sec,
          duration_sec: item.duration_sec,
          placeholder: Boolean(item.placeholder || item.missing_video),
          hasVideo: Boolean(item.video_url || item.video_api_path),
        })),
      })
      console.log('[AVA ASSEMBLY PAYLOAD watermark]', payload.watermark)
      setStatus(`Отправляем сборку в FFmpeg… watermark: ${payload.watermark?.enabled ? 'ON' : 'OFF'}`)
      const data = await apiRequest('/board-assembly/start', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      setAssemblyJob(data)
      setStatus(`Assembly job: ${data?.status || 'queued'} · ${data?.jobId || data?.job_id || ''}`)
      pollAssemblyJob(data?.statusEndpoint || (data?.jobId ? `/api/board-assembly/status/${data.jobId}` : ''), data?.jobId || data?.job_id)
    } catch (error) {
      setAssemblyRunning(false)
      setStatus(error?.message || 'Не удалось отправить сборку')
    }
  }

  function stopAssemblyActionEvent(event) {
    event?.preventDefault?.()
    event?.stopPropagation?.()
  }

  function openVideoExplicitly(event, url) {
    stopAssemblyActionEvent(event)
    const normalizedUrl = normalizePlayableVideoUrl(url)
    if (!normalizedUrl) return
    window.open(normalizedUrl, '_blank', 'noopener,noreferrer')
  }

  function downloadVideoExplicitly(event, url, filename = 'ava-video.mp4') {
    stopAssemblyActionEvent(event)
    const normalizedUrl = normalizePlayableVideoUrl(url)
    if (!normalizedUrl) return
    const link = document.createElement('a')
    link.href = normalizedUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  async function handleMusicSelect(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setMusicFile(file)
    setMusicAsset(null)
    setMusicPreviewUrl('')
    setMusicUploading(true)
    setStatus(`Загружаем музыку: ${file.name}`)

    try {
      const uploaded = await uploadAudioAsset({ file, projectId: projectId || null, stage: 'board_assembly_music' })
      setMusicAsset(uploaded || null)

      const apiPath = uploaded?.asset_api_path || ''
      if (apiPath) {
        const previewUrl = await fetchProtectedBlobUrl(apiPath)
        setMusicPreviewUrl(previewUrl)
      }

      setStatus(`Музыка загружена: ${uploaded?.audio_name || file.name}`)
    } catch (error) {
      setMusicAsset(null)
      setMusicPreviewUrl('')
      setStatus(`Музыка не загружена: ${error?.message || 'upload_failed'}`)
    } finally {
      setMusicUploading(false)
    }
  }

  if (loading) {
    return <AvaAssemblyLoading />
  }



  return (
    <div className="avaPage avaAssemblyPage">
      <WorkflowStageControls
        stageKey="board_assembly"
        stageLabel="Монтажник"
        clearLabel="Очистить монтаж"
        clearStages={[]}
        clearStorageMatchers={['board-assembly', 'board_assembly', 'assemblyjob']}
        clearDescription="Очистит настройки и временный результат монтажника. Сцены и медиа-файлы не удаляются."
      />

      <section className="avaAssemblyHeader">
        <div>
          <p className="avaEyebrow"><Clapperboard size={15} /> Stage 6.1 video montage foundation</p>
          <h2>Видео монтаж</h2>
          <p>Сборка готовых сцен из Board в финальный ролик. Длительность сцен не подгоняем здесь — это делается в Доске при генерации.</p>
        </div>
        <div className="avaAssemblyHeaderActions">
          <button
              type="button"
              onClick={() => {
                clearBoardAssemblyClearedMarker()
                loadBoardSnapshot()
              }}
            ><RefreshCcw size={15} /> Обновить из Board</button>
          <button type="button" disabled><Wand2 size={15} /> Собрать preview</button>
        </div>
      </section>

      <section className="avaAssemblyStats">
        <span>Сцен: <strong>{stats.total}</strong></span>
        <span>Видео готово: <strong>{stats.ready}/{stats.total}</strong></span>
        <span>Со звуком: <strong>{stats.withSound}</strong></span>
        <span>Длина: <strong>{formatTime(stats.duration)}</strong></span>
        <span>Оригинал audio: <strong>{stats.hasOriginalAudio ? 'есть' : 'нет'}</strong></span>
        {status && <span className="avaBoardStatusText">{status}</span>}
        <span className="avaBoardStatusText">Водный знак: {watermarkEnabled && String(watermarkText || '').trim() ? 'preview ON / export OFF' : 'выключен'}</span>
        <span className="avaBoardStatusText">Настройки сохраняются автоматически</span>
      </section>

      <section className="avaAssemblyWorkspace">
        <div className="avaAssemblySceneRail">
          <div className="avaBoardSectionHead">
            <div>
              <p className="avaEyebrow">scene strip</p>
              <h3>Сцены для сборки</h3>
            </div>
            <span>{skipMissing ? 'без пустых' : 'все сцены'}</span>
          </div>

          <div className="avaAssemblySceneList">
            {sceneItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`avaAssemblySceneItem ${selectedItem?.id === item.id ? 'isActive' : ''} ${item.hasVideo ? 'isReady' : 'isMissing'} ${item.blockLabel ? 'hasBlock' : ''}`}
                style={{ '--scene-hue': item.hue }}
                onClick={() => setSelectedSceneId(item.id)}
              >
                <strong>{item.title}</strong>
                <span>{formatTime(item.start)} → {formatTime(item.end || item.start + item.duration)}</span>
                <small>{item.route} · {item.hasVideo ? 'video' : 'нет видео'}{item.hasMmaudio ? ' · MMAudio' : item.hasSound ? ' · sound' : ''}</small>
                {item.blockLabel && <em className="avaAssemblyBlockBadge">{item.blockLabel}</em>}
              </button>
            ))}
            {!sceneItems.length && <div className="avaInfoBox">Сцен нет. Вернись в Board или Manual Timing.</div>}
          </div>
        </div>

        <div className="avaAssemblyPreviewPanel">
          <div className="avaBoardSectionHead">
            <div>
              <p className="avaEyebrow">preview</p>
              <h3>{selectedItem?.title || 'Сцена не выбрана'}</h3>
            </div>
            <span>{selectedItem?.hasMmaudio ? 'MMAudio версия' : selectedItem?.hasVideo ? 'base video' : 'missing'}</span>
          </div>

          <div className="avaAssemblyPreview">
            {selectedItemPlayableVideoUrl ? (
              <div className="avaAssemblyVideoWithWatermark">
                <video src={selectedItemPlayableVideoUrl} controls preload="metadata" playsInline />
                {watermarkEnabled && String(watermarkText || '').trim() && (
                  <span className={`avaAssemblyLiveWatermark ${watermarkPosition}`} style={watermarkPreviewStyle}>
                    {watermarkText}
                  </span>
                )}
                <div className="avaBoardVideoActions">
                  <button type="button" onClick={(event) => openVideoExplicitly(event, selectedItemPlayableVideoUrl)}>Смотреть видео</button>
                  <button type="button" onClick={(event) => downloadVideoExplicitly(event, selectedItemPlayableVideoUrl, `${selectedItem.id || 'scene'}.mp4`)}>Скачать видео</button>
                </div>
              </div>
            ) : selectedItemVideoHydrating ? (
              <div className="avaAssemblyEmptyPreview">
                <RefreshCcw size={42} />
                <strong>Загружаем видео сцены…</strong>
                <span>Проверяем Board snapshot и подгружаем asset-файл. Это может занять несколько секунд.</span>
              </div>
            ) : (
              <div className="avaAssemblyEmptyPreview">
                <Clapperboard size={42} />
                <strong>{selectedVideoLoadError ? 'Видео сцены не загрузилось' : 'Нет видео для этой сцены'}</strong>
                <span>{selectedVideoLoadError ? `Asset fetch: ${selectedVideoLoadError}` : 'Вернись в доску и перегенерируй сцену.'}</span>
                <Link className="avaSecondaryButton" to={boardRoute}>Вернуться в доску</Link>
              </div>
            )}
          </div>

          <div className="avaAssemblyBuildDock">
            <div className="avaAssemblyBuildText">
              <p className="avaEyebrow"><Download size={14} /> export</p>
              <strong>{finalDirty ? 'Нужно пересобрать MP4' : finalVideoUrl ? 'Финальный MP4 готов' : 'Собрать финальный ролик'}</strong>
              <span>
                {assemblyRunning
                  ? 'FFmpeg собирает финальный файл…'
                  : stats.canAssemble
                    ? 'Сцены, звук и музыка уйдут в один MP4. Watermark пока показывается как preview-overlay.'
                    : 'Сначала подготовь хотя бы одну сцену с видео.'}
              </span>
            </div>
            <button type="button" className="avaBoardPrimary avaAssemblyBuildButton" onClick={startAssembly} disabled={assemblyRunning || !stats.canAssemble}>
              <Download size={16} /> {assemblyRunning ? 'Собирается…' : finalDirty ? 'Пересобрать MP4' : 'Собрать MP4'}
            </button>
          </div>

          {finalVideoUrl && finalDirty && (
            <div className="avaAssemblyWarnings">
              <h4>Финальный MP4 устарел</h4>
              <p>Настройки монтажа изменились. Нажми “Пересобрать MP4”, чтобы водный знак/звук попали в скачанный файл.</p>
            </div>
          )}

          {finalVideoUrl && !finalDirty && (
            <div className="avaAssemblyFinalPreview">
              <div className="avaBoardSectionHead">
                <div>
                  <p className="avaEyebrow">final output</p>
                  <h3>Финальный MP4</h3>
                </div>
                <button type="button" onClick={(event) => openVideoExplicitly(event, finalVideoUrl)}>Открыть файл</button>
              </div>
              <div className="avaAssemblyVideoWithWatermark avaAssemblyFinalVideoWithWatermark">
                <video src={finalVideoUrl} controls preload="metadata" playsInline />
                {watermarkEnabled && String(watermarkText || '').trim() && (
                  <span className={`avaAssemblyLiveWatermark ${watermarkPosition}`} style={watermarkPreviewStyle}>
                    {watermarkText}
                  </span>
                )}
                <div className="avaBoardVideoActions">
                  <button type="button" onClick={(event) => openVideoExplicitly(event, finalVideoUrl)}>Смотреть видео</button>
                  <button type="button" onClick={(event) => downloadVideoExplicitly(event, finalVideoUrl, 'ava-board-assembly.mp4')}>Скачать MP4</button>
                </div>
              </div>
              {assemblyJob?.watermarkApplied ? <p>Водный знак запечён в MP4.</p> : watermarkEnabled ? <p>Watermark показан как preview-overlay. В MP4 export он временно отключён, чтобы сборка не падала.</p> : null}
              {false ? <p /> : null}
              {assemblyJob?.draftNote && <p>{assemblyJob.draftNote}</p>}
            </div>
          )}

          <div className="avaAssemblyWarnings">
            <h4>Проверка перед сборкой</h4>
            {warnings.length ? warnings.map((warning) => <p key={warning}>⚠ {warning}</p>) : <p>Готово к тестовой сборке.</p>}
          </div>

          <div className="avaAssemblyInlineMixer">
            <div className="avaBoardSectionHead">
              <div>
                <p className="avaEyebrow"><Volume2 size={14} /> volume mix</p>
                <h3>Громкость финального аудио</h3>
              </div>
              <span>{AUDIO_MODES.find((mode) => mode.value === audioMode)?.title || 'режим аудио'}</span>
            </div>
            <div className="avaAssemblyVolumeBox isInline">
              <label>
                <span><Volume2 size={14} /> Оригинал: {originalVolume}%</span>
                <input type="range" min="0" max="150" value={originalVolume} onChange={(event) => setOriginalVolume(Number(event.target.value))} />
              </label>
              <label>
                <span><Volume2 size={14} /> Звук сцен: {sceneVolume}%</span>
                <input type="range" min="0" max="150" value={sceneVolume} onChange={(event) => setSceneVolume(Number(event.target.value))} />
              </label>
              <label>
                <span><Music size={14} /> Музыка: {musicVolume}%</span>
                <input type="range" min="0" max="150" value={musicVolume} onChange={(event) => setMusicVolume(Number(event.target.value))} />
              </label>
            </div>
          </div>

        </div>

        <aside className="avaAssemblySettings">
          <div className="avaBoardSectionHead">
            <div>
              <p className="avaEyebrow"><SlidersHorizontal size={14} /> audio mix</p>
              <h3>Режим аудио</h3>
            </div>
          </div>

          <label className="avaAssemblySelectLabel">
            <span>Режим аудио</span>
            <select value={audioMode} onChange={(event) => setAudioMode(event.target.value)}>
              {AUDIO_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>{mode.title}</option>
              ))}
            </select>
          </label>

          <div className="avaAssemblyModeHint">
            <strong>{AUDIO_MODES.find((mode) => mode.value === audioMode)?.title || 'Режим аудио'}</strong>
            <span>{AUDIO_MODES.find((mode) => mode.value === audioMode)?.text || ''}</span>
          </div>

          <label className="avaAssemblyCheck">
            <input type="checkbox" checked={preferMmaudio} onChange={(event) => setPreferMmaudio(event.target.checked)} />
            Использовать MMAudio-версию, если есть
          </label>

          <label className="avaAssemblyCheck">
            <input type="checkbox" checked={skipMissing} onChange={(event) => setSkipMissing(event.target.checked)} />
            Пропускать сцены без видео
          </label>

          <div className={`avaAssemblyMusicBox ${musicPanelOpen ? 'isOpen' : 'isCollapsed'}`}>
            <button type="button" className="avaAssemblyPanelToggle" onClick={() => setMusicPanelOpen((value) => !value)}>
              <span>
                <strong>Фоновая музыка</strong>
                <em>{musicAsset ? (musicAsset.audio_name || musicFile?.name || 'загружена') : 'MP3/WAV пока не выбран'}</em>
              </span>
              <b>{musicPanelOpen ? '−' : '+'}</b>
            </button>

            {musicPanelOpen && (
              <div className="avaAssemblyPanelBody">
                <div className={`avaAssemblyMusicStatus ${musicAsset ? 'isReady' : musicUploading ? 'isLoading' : ''}`}>
                  <span>{musicUploading ? 'Загрузка…' : musicAsset ? 'Музыка загружена' : 'Музыка не загружена'}</span>
                  <b>{musicAsset?.audio_name || musicFile?.name || 'MP3/WAV пока не выбран'}</b>
                  {musicAsset?.audio_duration_sec ? <em>{formatTime(musicAsset.audio_duration_sec)}</em> : null}
                </div>

                {musicPreviewUrl && (
                  <audio className="avaAssemblyMusicPlayer" src={musicPreviewUrl} controls preload="metadata" />
                )}

                <label className={`avaBoardSmallButton ${musicUploading ? 'isDisabled' : ''}`}>
                  <UploadCloud size={14} /> {musicUploading ? 'Загружается…' : musicAsset ? 'Заменить музыку' : 'Загрузить музыку'}
                  <input type="file" accept="audio/*" onChange={handleMusicSelect} disabled={musicUploading} />
                </label>
                <label className="avaAssemblyCheck">
                  <input type="checkbox" checked={musicLoop} onChange={(event) => setMusicLoop(event.target.checked)} />
                  Зациклить музыку до конца ролика
                </label>
                <label className="avaAssemblyCheck">
                  <input type="checkbox" checked={musicFadeOut} onChange={(event) => setMusicFadeOut(event.target.checked)} />
                  Плавное затухание в конце
                </label>
              </div>
            )}
          </div>
          <div className={`avaAssemblyWatermarkBox ${watermarkEnabled ? 'isEnabled' : ''} ${watermarkPanelOpen ? 'isOpen' : 'isCollapsed'}`}>
            <div className="avaAssemblyWatermarkHeader">
              <button type="button" className="avaAssemblyPanelToggle isWatermark" onClick={() => setWatermarkPanelOpen((value) => !value)}>
                <span>
                  <strong>Водный знак</strong>
                  <em>{watermarkEnabled ? 'Будет запечён в финальный MP4' : 'Настройки можно подготовить заранее'}</em>
                </span>
                <b>{watermarkPanelOpen ? '−' : '+'}</b>
              </button>
              <button
                type="button"
                className={`avaAssemblyToggleButton ${watermarkEnabled ? 'isOn' : ''}`}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setWatermarkEnabled((value) => !value)
                }}
              >
                {watermarkEnabled ? 'Включён' : 'Выключен'}
              </button>
            </div>

            {watermarkPanelOpen && (
              <div className="avaAssemblyPanelBody">
                <label className="avaAssemblyField">
              <span>Текст водного знака</span>
              <input
                type="text"
                value={watermarkText}
                onChange={(event) => { setWatermarkEnabled(true); setWatermarkText(event.target.value) }}
                placeholder="Ava Studio"
               
              />
            </label>

            <div className="avaAssemblyWatermarkGrid">
              <label className="avaAssemblyField">
                <span>Позиция</span>
                <select value={watermarkPosition} onChange={(event) => { setWatermarkEnabled(true); setWatermarkPosition(event.target.value) }}>
                  <option value="bottom_right">Снизу справа</option>
                  <option value="bottom_left">Снизу слева</option>
                  <option value="top_right">Сверху справа</option>
                  <option value="top_left">Сверху слева</option>
                  <option value="bottom_center">Снизу по центру</option>
                  <option value="top_center">Сверху по центру</option>
                </select>
              </label>

              <div className="avaAssemblyWatermarkPreview">
                <span className={`wm ${watermarkPosition}`}>{watermarkText || 'Ava Studio'}</span>
              </div>
            </div>

                <label className="avaAssemblyField">
                  <span>Движение</span>
                  <select value={watermarkMotion} onChange={(event) => { setWatermarkEnabled(true); setWatermarkMotion(event.target.value) }}>
                    <option value="static">Статично</option>
                    <option value="corners">Блуждать по углам</option>
                  </select>
                </label>

                <div className="avaAssemblyWatermarkSliders">
                  <label>
                    <span>Прозрачность: {watermarkOpacity}%</span>
                    <input type="range" min="5" max="100" value={watermarkOpacity} onChange={(event) => { setWatermarkEnabled(true); setWatermarkOpacity(Number(event.target.value)) }} />
                  </label>
                  <label>
                    <span>Размер: {watermarkSize}px</span>
                    <input type="range" min="14" max="72" value={watermarkSize} onChange={(event) => { setWatermarkEnabled(true); setWatermarkSize(Number(event.target.value)) }} />
                  </label>
                </div>
              </div>
            )}
          </div>

        </aside>
      </section>
    </div>
  )
}
