// AVA_ASSEMBLY_TRANSITION_VISUAL_MODE_V196E: choose xfade or fade-to-black for timing-safe transitions.
// AVA_ASSEMBLY_TWO_TRANSITION_MODES_V134G: two mutually-exclusive transition modes: shorten vs preserve timing.
// AVA_ASSEMBLY_FORCE_POST_XFADE_PAYLOAD_V134F: send transition checkbox as the real backend switch.
// AVA_ASSEMBLY_FORCE_TRANSITION_PAYLOAD_V134E: send transition checkbox to backend even when UI says mode is blocked.
// AVA_ASSEMBLY_COMPACT_TRANSITIONS_V134B: compact right-panel transition control, safe after stats initialization.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, Clapperboard, Download, ExternalLink, Music, RefreshCcw, SlidersHorizontal, UploadCloud, Volume2, Wand2 } from 'lucide-react'
import { useProjects } from '../context/ProjectContext.jsx'
import { apiRequest, buildApiUrl, fetchProtectedBlobUrl, getApiOrigin, getAuthHeaders, normalizeAssetFileUrl, registerStaticMediaAsset, uploadAudioAsset } from '../services/apiClient.js'
import '../styles/ava-board.css'
import WorkflowStageControls from '../components/WorkflowStageControls.jsx'
import { AVA_BOARD_ASSEMBLY_CLEARED_KEY, clearWorkflowEntry, readWorkflowEntry } from '../utils/workflowNavigation.js'


const TRANSITION_VISUAL_MODES_V196E = [
  {
    value: 'fade_to_black',
    title: 'fade-to-black',
    text: 'Безопасный переход через затемнение. Не двигает lip-sync.',
  },
  {
    value: 'xfade',
    title: 'xfade',
    text: 'Красивый xfade с freeze-handle ручками. Тестовый режим для lip-sync.',
  },
]

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
    value: 'original_plus_music',
    title: 'Оригинал + музыка',
    text: 'Оригинальное/master audio + фоновая музыка. Звук сцен выключен полностью.',
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


function normalizeAssemblyLocalUiSettingsV197F(raw = {}) {
  const hasAudioModeV197F = AUDIO_MODES.some((mode) => mode.value === raw.audioMode)
  const audioMode = hasAudioModeV197F ? raw.audioMode : ''
  const hasTransitionVisualModeV197F = ['xfade', 'fade_to_black'].includes(raw.transitionVisualModeV196E)
  const transitionVisualModeV196E = hasTransitionVisualModeV197F ? raw.transitionVisualModeV196E : ''
  const hasSmoothTransitionsTimingEnabledV197F = Object.prototype.hasOwnProperty.call(raw, 'smoothTransitionsTimingEnabledV134G')
  const hasSmoothTransitionTimingDurationV197F = raw.smoothTransitionTimingDurationSecV134G !== undefined || raw.smoothTransitionDurationSecV134G !== undefined
  const smoothTransitionsTimingEnabledV134G = Boolean(raw.smoothTransitionsTimingEnabledV134G)
  const smoothTransitionTimingDurationSecV134G = clampNumber(
    raw.smoothTransitionTimingDurationSecV134G ?? raw.smoothTransitionDurationSecV134G,
    0.1,
    3,
    0.5,
  )
  return {
    uiLocalVersionV197F: 'assembly_ui_local_v200n',
    hasAudioModeV197F,
    audioMode,
    hasSmoothTransitionsTimingEnabledV197F,
    smoothTransitionsTimingEnabledV134G,
    hasSmoothTransitionTimingDurationV197F,
    smoothTransitionTimingDurationSecV134G,
    hasTransitionVisualModeV197F,
    transitionVisualModeV196E,
    hasOriginalVolumeV200N: Object.prototype.hasOwnProperty.call(raw, 'originalVolume'),
    originalVolume: clampNumber(raw.originalVolume, 0, 150, 100),
    hasSceneVolumeV200N: Object.prototype.hasOwnProperty.call(raw, 'sceneVolume'),
    sceneVolume: clampNumber(raw.sceneVolume, 0, 150, 25),
    hasMusicVolumeV200N: Object.prototype.hasOwnProperty.call(raw, 'musicVolume'),
    musicVolume: clampNumber(raw.musicVolume, 0, 150, 15),
    hasStauEnabledV204H3: Object.prototype.hasOwnProperty.call(raw, 'stauEnabledV204H3') || Object.prototype.hasOwnProperty.call(raw, 'stauEnabled'),
    stauEnabledV204H3: raw.stauEnabledV204H3 ?? raw.stauEnabled ?? true,
    hasStauVolumeV204H3: Object.prototype.hasOwnProperty.call(raw, 'stauVolumeV204H3') || Object.prototype.hasOwnProperty.call(raw, 'stauVolume'),
    stauVolumeV204H3: clampNumber(raw.stauVolumeV204H3 ?? raw.stauVolume, 0, 150, 30),
  }
}

function readAssemblyLocalUiSettingsV197F(key) {
  return normalizeAssemblyLocalUiSettingsV197F(readAssemblySettings(key))
}

function writeAssemblyLocalUiSettingsV197F(key, value) {
  const normalized = normalizeAssemblyLocalUiSettingsV197F(value)
  writeAssemblySettings(key, normalized)
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

// AVA_ASSEMBLY_FORMAT_WATERMARK_V195A: project format controls final MP4 size and watermark preview.
function normalizeAssemblyAspectRatioV195A(board = {}, scenes = []) {
  const sceneList = asArray(scenes)
  const firstScene = sceneList[0]?.raw || sceneList[0] || asArray(board?.scenes)[0] || {}
  const candidates = [
    board?.aspectRatio,
    board?.aspect_ratio,
    board?.outputFormat,
    board?.output_format,
    board?.format,
    board?.project?.aspectRatio,
    board?.project?.aspect_ratio,
    board?.project?.format,
    board?.projectContext?.aspectRatio,
    board?.projectContext?.aspect_ratio,
    board?.projectContext?.format,
    board?.project_context?.aspectRatio,
    board?.project_context?.aspect_ratio,
    board?.project_context?.format,
    board?.formatContract?.aspectRatio,
    board?.formatContract?.aspect_ratio,
    board?.formatContract?.format,
    board?.format_contract?.aspectRatio,
    board?.format_contract?.aspect_ratio,
    board?.format_contract?.format,
    firstScene?.aspectRatio,
    firstScene?.aspect_ratio,
    firstScene?.outputFormat,
    firstScene?.output_format,
    firstScene?.format,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)

  for (const raw of candidates) {
    const value = raw.replace(/\s+/g, '')
    if (value.includes('9:16') || value.includes('916') || value.includes('vertical') || value.includes('portrait')) return '9:16'
    if (value.includes('1:1') || value.includes('11') || value.includes('square')) return '1:1'
    if (value.includes('16:9') || value.includes('169') || value.includes('horizontal') || value.includes('landscape')) return '16:9'
    const match = value.match(/(\d{3,4})[x×:](\d{3,4})/)
    if (match) {
      const width = Number(match[1])
      const height = Number(match[2])
      if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
        if (height > width * 1.2) return '9:16'
        if (width > height * 1.2) return '16:9'
        return '1:1'
      }
    }
  }

  const width = Number(board?.width || board?.videoWidth || board?.video_width || board?.targetWidth || board?.target_width || 0)
  const height = Number(board?.height || board?.videoHeight || board?.video_height || board?.targetHeight || board?.target_height || 0)
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    if (height > width * 1.2) return '9:16'
    if (width > height * 1.2) return '16:9'
    return '1:1'
  }
  return '16:9'
}

function assemblyOutputSpecV195A(board = {}, scenes = []) {
  const aspectRatio = normalizeAssemblyAspectRatioV195A(board, scenes)
  if (aspectRatio === '9:16') {
    return {
      aspectRatio,
      outputFormat: '9:16',
      width: 720,
      height: 1280,
      label: '9:16 · 720×1280',
      previewClass: 'isFormat916',
    }
  }
  if (aspectRatio === '1:1') {
    return {
      aspectRatio,
      outputFormat: '1:1',
      width: 1024,
      height: 1024,
      label: '1:1 · 1024×1024',
      previewClass: 'isFormat11',
    }
  }
  return {
    aspectRatio: '16:9',
    outputFormat: '16:9',
    width: 1280,
    height: 720,
    label: '16:9 · 1280×720',
    previewClass: 'isFormat169',
  }
}

function durationOf(scene) {
  const direct = toNumber(scene?.duration_sec ?? scene?.durationSec, 0)
  if (direct > 0) return direct
  return Math.max(0, toNumber(scene?.end_sec ?? scene?.end, 0) - toNumber(scene?.start_sec ?? scene?.start, 0))
}


// AVA_BOARD_ASSEMBLY_VIDEO_TRIM_V201A:
// Assembly may trim only ordinary free/manual Board videos. Timing boards and audio-driven routes are locked.
function assemblyBoardTimingLockedForTrimV201A(board = {}, scene = {}) {
  const boardSource = String(board?.source || board?.importedFrom || board?.source_kind || board?.sourceKind || '').toLowerCase()
  const sceneSource = String(scene?.source || scene?.importedFrom || scene?.durationSource || scene?.duration_source || '').toLowerCase()
  if (board?.boardTimingLocked === true || board?.timingLocked === true || board?.importedFrom === 'manual_timing') return true
  if (scene?.timingLocked === true || scene?.timing_locked === true || scene?.durationSource === 'timing' || scene?.duration_source === 'timing') return true
  if (boardSource.includes('manual_timing') || boardSource.includes('timing_to_board')) return true
  if (sceneSource.includes('manual_timing') || sceneSource.includes('timing_to_board')) return true
  if (Array.isArray(scene?.source_phrase_ids) && scene.source_phrase_ids.length) return true
  if (Array.isArray(scene?.sourcePhraseIds) && scene.sourcePhraseIds.length) return true
  return false
}

function assemblySceneAudioDrivenTrimLockedV201A(scene = {}) {
  const route = String(scene?.route || scene?.planned_route || scene?.plannedRoute || scene?.model_route || scene?.modelRoute || '').trim().toLowerCase()
  // V201B: trim is locked only for ia2v / lip-sync / instrumental / explicit audio-slice scenes.
  // Generic clips with embedded audio are allowed: Assembly trims the ready video asset as one piece.
  if (
    route.includes('ia2v') ||
    route.includes('lip') ||
    route.includes('sync') ||
    route.includes('instrument')
  ) return true
  return Boolean(
    scene?.lip_sync_required || scene?.lipSyncRequired ||
    scene?.audio_slice_asset_id || scene?.audioSliceAssetId ||
    scene?.audio_slice_api_path || scene?.audioSliceApiPath ||
    scene?.manual_lipsync_audio_asset_id || scene?.manualLipSyncAudioAssetId ||
    scene?.manual_lipsync_audio_api_path || scene?.manualLipSyncAudioApiPath
  )
}

function assemblyVideoTrimForSceneV201A(board = {}, scene = {}) {
  if (assemblyBoardTimingLockedForTrimV201A(board, scene)) return null
  if (assemblySceneAudioDrivenTrimLockedV201A(scene)) return null
  if (!(scene?.assemblyVideoTrimEnabled || scene?.assembly_video_trim_enabled)) return null
  const sourceDuration = toNumber(scene?.assemblyVideoDurationSec ?? scene?.assembly_video_duration_sec ?? scene?.videoDurationSec ?? scene?.video_duration_sec, 0)
  const rawStart = toNumber(scene?.assemblyVideoTrimStartSec ?? scene?.assembly_video_trim_start_sec, 0)
  const rawEnd = toNumber(scene?.assemblyVideoTrimEndSec ?? scene?.assembly_video_trim_end_sec, sourceDuration)
  if (!Number.isFinite(sourceDuration) || sourceDuration <= 0) return null
  const start = Math.max(0, Math.min(sourceDuration, rawStart))
  const end = Math.max(0, Math.min(sourceDuration, rawEnd))
  const duration = end - start
  if (!Number.isFinite(duration) || duration < 0.05) return null
  return {
    enabled: true,
    startSec: Number(start.toFixed(3)),
    endSec: Number(end.toFixed(3)),
    durationSec: Number(duration.toFixed(3)),
    sourceDurationSec: Number(sourceDuration.toFixed(3)),
  }
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
    <div className="avaPage avaStoryboardLoadingPage isAvaStudioWaveLoading isAssemblyAudioLoading">
      <section className="avaLoadingHero avaStudioLoadingHero avaAssemblyLoadingHero">
        <div className="avaLoadingCard avaStudioLoadingCard avaAssemblyLoadingCard">
          <div className="avaLoadingOrb"><Clapperboard size={28} /></div>
          <p className="avaEyebrow">Ava Studio montage</p>
          <h2>{title}</h2>
          <p>{subtitle}</p>
          <div className="avaStudioWaveLoader" aria-hidden="true">
            <div className="avaStudioWaveTrack">
              <span className="avaStudioMovingNote">♪</span>
              <i style={{ '--bar': 0 }} />
              <i style={{ '--bar': 1 }} />
              <i style={{ '--bar': 2 }} />
              <i style={{ '--bar': 3 }} />
              <i style={{ '--bar': 4 }} />
              <i style={{ '--bar': 5 }} />
              <i style={{ '--bar': 6 }} />
              <i style={{ '--bar': 7 }} />
              <i style={{ '--bar': 8 }} />
            </div>
            <div className="avaStudioLoadingLine"><span /></div>
            <small>Синхронизируем сцены и медиа</small>
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
    scene?.hasSound ||
    scene?.has_sound ||
    scene?.hasMmaudio ||
    scene?.has_mmaudio ||
    scene?.mmaudio_video_api_path ||
    scene?.mmaudioVideoApiPath ||
    scene?.mmaudio_video_url ||
    scene?.mmaudioVideoUrl ||
    scene?.mmaudio_result?.video_api_path ||
    scene?.mmaudioResult?.videoApiPath ||
    scene?.mmaudio_status === 'ready' ||
    scene?.mmaudioStatus === 'ready' ||
    scene?.audio_slice_url ||
    scene?.audioSliceUrl ||
    scene?.audio_slice_api_path ||
    scene?.audioSliceApiPath ||
    scene?.sound_prompt ||
    scene?.soundPrompt ||
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
    audio: board.audio || raw?.audio || null,
  }
}


// AVA_ASSEMBLY_STAU_LAYER_V204H3: Stable Audio block beds from Audio Studio.
function firstAssemblyTextV204H3(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim()
    if (text) return text
  }
  return ''
}

function assemblyStauAppliedAudioV204H3(block = {}) {
  const stableAudio = block?.stableAudio || block?.stable_audio || {}
  return block?.appliedStableAudio
    || block?.applied_stable_audio
    || stableAudio?.appliedAudio
    || stableAudio?.applied_audio
    || stableAudio?.assembly
    || (String(block?.kind || '').includes('stable_audio') ? block : null)
    || null
}

function normalizeAssemblyStauBlockV204H3(raw = {}, index = 0) {
  if (!raw || typeof raw !== 'object') return null
  const applied = assemblyStauAppliedAudioV204H3(raw) || {}
  const stableAudio = raw?.stableAudio || raw?.stable_audio || {}
  const ref = firstAssemblyTextV204H3(
    applied.ref,
    applied.apiPath,
    applied.api_path,
    applied.assetApiPath,
    applied.asset_api_path,
    applied.audioApiPath,
    applied.audio_api_path,
    applied.url,
    raw.ref,
    raw.apiPath,
    raw.api_path,
    raw.assetApiPath,
    raw.asset_api_path,
    raw.audioApiPath,
    raw.audio_api_path,
    raw.url,
  )
  if (!ref) return null
  const sceneIds = asArray(applied.sceneIds || applied.scene_ids || raw.sceneIds || raw.scene_ids)
    .map((item) => String(item || '').trim())
    .filter(Boolean)
  const startSec = toNumber(applied.startSec ?? applied.start_sec ?? raw.startSec ?? raw.start_sec, 0)
  const endSec = toNumber(applied.endSec ?? applied.end_sec ?? raw.endSec ?? raw.end_sec, 0)
  const durationSec = toNumber(
    applied.durationSec ?? applied.duration_sec ?? applied.exactDurationSec ?? applied.exact_duration_sec ?? raw.durationSec ?? raw.duration_sec,
    endSec > startSec ? endSec - startSec : 0,
  )
  const volume = clampNumber(
    applied.volumePercent ?? applied.volume_percent ?? applied.volume ?? stableAudio.appliedVolume ?? stableAudio.applied_volume ?? raw.volume,
    0,
    150,
    30,
  )
  const blockId = firstAssemblyTextV204H3(applied.blockId, applied.block_id, raw.id, raw.blockId, raw.block_id, `stau_block_${index + 1}`)
  const variantId = firstAssemblyTextV204H3(applied.variantId, applied.variant_id, raw.appliedStableAudioVariantId, raw.applied_stable_audio_variant_id, stableAudio.appliedVariantId, stableAudio.applied_variant_id)
  const normalizedApplied = {
    ...applied,
    kind: applied.kind || 'stable_audio_block_bed',
    blockId,
    block_id: blockId,
    variantId,
    variant_id: variantId,
    ref,
    apiPath: firstAssemblyTextV204H3(applied.apiPath, applied.api_path, applied.assetApiPath, applied.asset_api_path, ref),
    url: firstAssemblyTextV204H3(applied.url, ref),
    assetId: firstAssemblyTextV204H3(applied.assetId, applied.asset_id, raw.assetId, raw.asset_id),
    volume,
    volumePercent: volume,
    sceneIds,
    scene_ids: sceneIds,
    startSec,
    start_sec: startSec,
    endSec: endSec || startSec + durationSec,
    end_sec: endSec || startSec + durationSec,
    durationSec,
    duration_sec: durationSec,
    assemblyReady: true,
    assembly_ready: true,
    sendToAssembly: true,
    send_to_assembly: true,
  }
  return {
    ...raw,
    id: blockId,
    blockId,
    block_id: blockId,
    sceneIds,
    scene_ids: sceneIds,
    startSec,
    start_sec: startSec,
    endSec: endSec || startSec + durationSec,
    end_sec: endSec || startSec + durationSec,
    durationSec,
    duration_sec: durationSec,
    volume,
    appliedStableAudio: normalizedApplied,
    applied_stable_audio: normalizedApplied,
    assemblyReady: true,
    assembly_ready: true,
  }
}

function extractAssemblyStauBlocksV204H3(raw = {}) {
  const data = raw?.data && typeof raw.data === 'object' ? raw.data : (raw || {})
  const candidates = [
    ...asArray(data.appliedStableAudioBlocks),
    ...asArray(data.applied_stable_audio_blocks),
    ...asArray(data.stauBlocks),
    ...asArray(data.stau_blocks),
    ...asArray(data.stableAudioBlocks),
    ...asArray(data.stable_audio_blocks),
    ...asArray(data.stableBlocks).filter((block) => assemblyStauAppliedAudioV204H3(block)),
    ...asArray(data.board?.appliedStableAudioBlocks),
    ...asArray(data.board?.stableBlocks).filter((block) => assemblyStauAppliedAudioV204H3(block)),
    ...asArray(data.boardSnapshot?.appliedStableAudioBlocks),
    ...asArray(data.boardSnapshot?.stableBlocks).filter((block) => assemblyStauAppliedAudioV204H3(block)),
  ]
  const seen = new Set()
  return candidates
    .map((block, index) => normalizeAssemblyStauBlockV204H3(block, index))
    .filter(Boolean)
    .filter((block) => {
      const applied = block.appliedStableAudio || block.applied_stable_audio || {}
      const key = [block.id || block.blockId || '', applied.variantId || applied.variant_id || '', applied.ref || applied.apiPath || '', asArray(block.sceneIds || block.scene_ids).join('|')].join('::')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function mergeAudioStudioStauIntoBoardV204H3(board = {}, audioStudioRaw = {}) {
  const audioStudio = audioStudioRaw?.data && typeof audioStudioRaw.data === 'object' ? audioStudioRaw.data : (audioStudioRaw || {})
  const blocks = extractAssemblyStauBlocksV204H3(audioStudio)
  return {
    ...(board || {}),
    stableAudio: audioStudio.stableAudio || board?.stableAudio || { enabled: Boolean(blocks.length) },
    stableBlocks: blocks,
    appliedStableAudioBlocks: blocks,
    stauBlocks: blocks,
    stau_blocks: blocks,
    audioStudioStableImportedV204H3: Boolean(blocks.length),
    audioStudioStableImportedAtV204H3: new Date().toISOString(),
  }
}

function assemblyStauDefaultVolumeV204H3(blocks = [], fallback = 30) {
  const first = asArray(blocks)[0] || {}
  const applied = first.appliedStableAudio || first.applied_stable_audio || {}
  return clampNumber(applied.volumePercent ?? applied.volume ?? first.volume, 0, 150, fallback)
}


// AVA_ASSEMBLY_SHOW_STAU_BLOCKS_V204H4: visual block grouping in Assembly.
function assemblyStauSceneIdsV204H4(block = {}) {
  const applied = block?.appliedStableAudio || block?.applied_stable_audio || block?.stableAudio?.appliedAudio || block?.stable_audio?.applied_audio || {}
  return asArray(applied.sceneIds || applied.scene_ids || block.sceneIds || block.scene_ids)
    .map((item) => String(item || '').trim())
    .filter(Boolean)
}

function assemblyStauBlockHueV204H4(block = {}, fallback = 185) {
  const rawColor = String(block?.color || block?.blockColor || block?.block_color || block?.stableColor || '').trim()
  const hslMatch = rawColor.match(/hsla?\(\s*([0-9.]+)/i)
  if (hslMatch) return clampNumber(Number(hslMatch[1]), 0, 360, fallback)
  const rawHue = block?.hue ?? block?.blockHue ?? block?.block_hue ?? ''
  if (rawHue !== '') return clampNumber(Number(rawHue), 0, 360, fallback)
  return fallback
}

function assemblyStauBlockTitleV204H4(block = {}, index = 0) {
  return firstAssemblyTextV204H3(block?.title, block?.name, block?.label, `STAU ${index + 1}`)
}

function assemblyStauVisualBlocksV204H4(blocks = []) {
  return asArray(blocks).map((block, index) => {
    const sceneIds = assemblyStauSceneIdsV204H4(block)
    const hue = assemblyStauBlockHueV204H4(block, (185 + index * 34) % 360)
    return {
      ...block,
      visualIndexV204H4: index + 1,
      visualTitleV204H4: assemblyStauBlockTitleV204H4(block, index),
      visualHueV204H4: hue,
      visualSceneIdsV204H4: sceneIds,
    }
  }).filter((block) => block.visualSceneIdsV204H4.length)
}

function assemblyStauBlockBySceneIdV204H4(blocks = []) {
  const map = new Map()
  assemblyStauVisualBlocksV204H4(blocks).forEach((block) => {
    block.visualSceneIdsV204H4.forEach((sceneId) => {
      if (!map.has(sceneId)) map.set(sceneId, block)
    })
  })
  return map
}

function assemblySnapshotScenes(raw = {}) {
  return asArray(raw.scenes).length ? asArray(raw.scenes)
    : asArray(raw.boardScenes).length ? asArray(raw.boardScenes)
      : asArray(raw.readyItems).length ? asArray(raw.readyItems).map((item) => item.raw || item)
        : asArray(raw.items).length ? asArray(raw.items).map((item) => item.raw || item)
          : asArray(raw.board?.scenes).length ? asArray(raw.board.scenes)
            : asArray(raw.boardSnapshot?.scenes)
}

function assemblyHasScenes(raw = {}) {
  return assemblySnapshotScenes(raw).length > 0
}

function assemblyFinalUrlFromSnapshot(raw = {}) {
  // AVA_ASSEMBLY_FINAL_STATIC_URL_V200Q: <video> cannot reliably play protected /api/assets URLs after F5.
  // Prefer static/public result paths for playback, while asset ids/api paths remain saved separately.
  return normalizePlayableVideoUrl(
    raw.finalPlayableUrl || raw.final_playable_url || raw.finalStaticUrl || raw.final_static_url ||
    raw.staticUrl || raw.static_url || raw.publicUrl || raw.public_url || raw.fileUrl || raw.file_url ||
    raw.finalVideoUrl || raw.finalUrl || raw.assemblyUrl || raw.outputUrl || raw.resultUrl || raw.downloadUrl ||
    raw.videoUrl || raw.video_url || raw.videoApiPath || raw.video_api_path || raw.assemblyApiPath || raw.assembly_api_path || ''
  )
}

function boardFromAssemblySnapshot(raw = {}) {
  const sourceBoard = raw.board || raw.boardSnapshot || raw
  const scenes = assemblySnapshotScenes(raw)
  const audio = raw.audio || raw.sourceAudio || raw.timingAudio || raw.originalAudio || sourceBoard.audio || null
  return normalizeBoard({
    ...sourceBoard,
    source: raw.source || sourceBoard.source || 'board_assembly_snapshot',
    importedFrom: raw.importedFrom || sourceBoard.importedFrom || raw.source || '',
    scenes,
    audio,
    stableBlocks: extractAssemblyStauBlocksV204H3(raw),
    appliedStableAudioBlocks: extractAssemblyStauBlocksV204H3(raw),
    stauBlocks: extractAssemblyStauBlocksV204H3(raw),
    selectedSceneId: raw.selectedSceneId || sourceBoard.selectedSceneId || scenes[0]?.id || scenes[0]?.scene_id || '',
  })
}

function assemblyJobIsRunning(job = {}) {
  if (!job) return false
  const status = String(job.status || job.state || '').toLowerCase()
  if (!status) return Boolean(job.jobId || job.job_id)
  return ['queued', 'preparing', 'running', 'submitting', 'starting'].includes(status)
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
  const scenes = asArray(board.scenes)
  const boardTimingLockedV201A = assemblyBoardTimingLockedForTrimV201A(board || {}, scenes[0] || {})
  let freeBoardCursorV201A = 0

  return scenes.map((scene, index) => {
    const videoApiPath = pickSceneVideoApiPath(scene, preferMmaudio)
    const videoAssetApiPath = sceneVideoAssetApiPath(scene, preferMmaudio)
    const videoJobId = pickSceneVideoJobId(scene, preferMmaudio)
    const videoStatusEndpoint = pickSceneVideoStatusEndpoint(scene, preferMmaudio)
    const videoUrl = sceneVideoUrl(scene, preferMmaudio)
    const hasBaseVideo = Boolean(scene?.video_api_path || scene?.videoApiPath || scene?.video_url || scene?.videoUrl)
    const hasMmaudio = Boolean(
      scene?.hasMmaudio ||
      scene?.has_mmaudio ||
      scene?.mmaudio_video_api_path ||
      scene?.mmaudioVideoApiPath ||
      scene?.mmaudio_video_url ||
      scene?.mmaudioVideoUrl ||
      scene?.mmaudio_result?.video_api_path ||
      scene?.mmaudioResult?.videoApiPath ||
      scene?.mmaudio_status === 'ready' ||
      scene?.mmaudioStatus === 'ready'
    )
    const hasVideo = Boolean(videoUrl)
    const hasSound = sceneHasSound(scene)
    const trimV201A = assemblyVideoTrimForSceneV201A(board || {}, scene || {})
    const duration = trimV201A?.durationSec || durationOf(scene)
    const rawStart = toNumber(scene?.start_sec ?? scene?.start, 0)
    const rawEnd = toNumber(scene?.end_sec ?? scene?.end, 0)
    const start = boardTimingLockedV201A ? rawStart : freeBoardCursorV201A
    const end = boardTimingLockedV201A
      ? (rawEnd > rawStart ? rawEnd : rawStart + duration)
      : start + duration
    if (!boardTimingLockedV201A) freeBoardCursorV201A = end

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
      start,
      end,
      assemblyVideoTrim: trimV201A,
      raw: scene,
    }
  })
}



// AVA_ASSEMBLY_OUTPUT_SPEC_V195F
function assemblyFormatTokenV195F(value) {
  // AVA_ASSEMBLY_RESULT_FORMAT_LOCK_V200O
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return ''
  const compact = raw.replace(/\s+/g, '').replace(/_/g, '-')
  if (compact.includes('9:16') || compact.includes('916') || compact.includes('720x1280') || compact.includes('720×1280') || compact.includes('vertical') || compact.includes('portrait')) return '9:16'
  if (compact.includes('1:1') || compact === '11' || compact.includes('1024x1024') || compact.includes('1024×1024') || compact.includes('square')) return '1:1'
  if (compact.includes('16:9') || compact.includes('169') || compact.includes('1280x720') || compact.includes('1280×720') || compact.includes('horizontal') || compact.includes('landscape')) return '16:9'
  const sizeMatchV200O = compact.match(/(\d{3,4})[x×:](\d{3,4})/)
  if (sizeMatchV200O) {
    const w = Number(sizeMatchV200O[1])
    const h = Number(sizeMatchV200O[2])
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      if (h > w * 1.2) return '9:16'
      if (w > h * 1.2) return '16:9'
      return '1:1'
    }
  }
  return ''
}


function assemblyOutputSpecV195F(board = {}, sceneItems = []) {
  // AVA_ASSEMBLY_RESULT_FORMAT_LOCK_V200O
  const scenes = Array.isArray(sceneItems) ? sceneItems : []
  const rawScenes = scenes.map((item) => item?.raw || item || {})
  const nestedCandidatesV200O = []
  const pushObjectV200O = (obj) => {
    if (!obj || typeof obj !== 'object') return
    nestedCandidatesV200O.push(
      obj.format,
      obj.project_format,
      obj.projectFormat,
      obj.aspect_ratio,
      obj.aspectRatio,
      obj.output_format,
      obj.outputFormat,
      obj.resolution,
      obj.orientation,
      obj.video_format,
      obj.videoFormat,
      obj.target_format,
      obj.targetFormat,
      obj.output_size,
      obj.outputSize,
      obj.width && obj.height ? `${obj.width}x${obj.height}` : '',
      obj.output_width && obj.output_height ? `${obj.output_width}x${obj.output_height}` : '',
      obj.outputWidth && obj.outputHeight ? `${obj.outputWidth}x${obj.outputHeight}` : '',
      obj.target_width && obj.target_height ? `${obj.target_width}x${obj.target_height}` : '',
      obj.targetWidth && obj.targetHeight ? `${obj.targetWidth}x${obj.targetHeight}` : '',
    )
  }

  pushObjectV200O(board)
  pushObjectV200O(board?.project)
  pushObjectV200O(board?.project_context)
  pushObjectV200O(board?.projectContext)
  pushObjectV200O(board?.format_contract)
  pushObjectV200O(board?.formatContract)
  rawScenes.forEach((scene) => {
    pushObjectV200O(scene)
    pushObjectV200O(scene?.project)
    pushObjectV200O(scene?.project_context)
    pushObjectV200O(scene?.projectContext)
    pushObjectV200O(scene?.format_contract)
    pushObjectV200O(scene?.formatContract)
  })

  let format = ''
  for (const candidate of nestedCandidatesV200O) {
    format = assemblyFormatTokenV195F(candidate)
    if (format) break
  }
  if (!format) format = '16:9'

  if (format === '9:16') {
    return {
      format: '9:16',
      aspectRatio: '9:16',
      outputFormat: '9:16',
      width: 720,
      height: 1280,
      fitMode: 'cover',
      outputFitMode: 'cover',
      label: '9:16 · 720×1280 · crop',
      className: 'isPortraitV195F',
      previewClass: 'isFormat916',
    }
  }
  if (format === '1:1') {
    return {
      format: '1:1',
      aspectRatio: '1:1',
      outputFormat: '1:1',
      width: 1024,
      height: 1024,
      fitMode: 'cover',
      outputFitMode: 'cover',
      label: '1:1 · 1024×1024',
      className: 'isSquareV195F',
      previewClass: 'isFormat11',
    }
  }
  return {
    format: '16:9',
    aspectRatio: '16:9',
    outputFormat: '16:9',
    width: 1280,
    height: 720,
    fitMode: 'contain',
    outputFitMode: 'contain',
    label: '16:9 · 1280×720',
    className: 'isLandscapeV195F',
    previewClass: 'isFormat169',
  }
}


export default function BoardAssemblyPage() {
  // AVA_ASSEMBLY_BOARD_HANDOFF_SOURCE_OF_TRUTH_V8
  const { projectId } = useParams()
  const location = useLocation()
  const workspaceMode = !projectId
  const { loadStage, saveStage, loadWorkspaceStage, saveWorkspaceStage, projects, activeProject } = useProjects()
  const workflowEntry = useMemo(() => readWorkflowEntry('board_assembly', location.state), [location.state])
  const routeProjectRecordV200O = useMemo(() => {
    const cleanProjectId = String(projectId || '').trim()
    const list = Array.isArray(projects) ? projects : []
    const fromList = list.find((project) => String(project?.id || project?.project_id || project?.projectId || '') === cleanProjectId) || null
    if (fromList) return fromList
    if (String(activeProject?.id || activeProject?.project_id || activeProject?.projectId || '') === cleanProjectId) return activeProject
    return null
  }, [projects, activeProject, projectId])
  // AVA_ASSEMBLY_F5_RESULT_FORMAT_VOLUME_V200N:
  // Route project format is the last-resort source of truth for Assembly output.
  // This keeps 9:16 / 1:1 / 16:9 consistent after Timing -> Board -> Assembly and after F5.
  const routeProjectRecordV200N = useMemo(() => {
    const cleanProjectId = String(projectId || '').trim()
    const fromList = asArray(projects).find((project) => String(project?.id || '') === cleanProjectId) || null
    if (fromList) return fromList
    if (String(activeProject?.id || '') === cleanProjectId) return activeProject
    return null
  }, [projects, activeProject, projectId])
  const entryFromBoard = workflowEntry?.from === 'board'
  const entryFromGenerator = workflowEntry?.from === 'standalone_generator'
  const autosaveTimerRef = useRef(null)
  const resumedAssemblyJobRef = useRef('')
  const assemblyF5HydrateGuardRefV200O = useRef(false)
  const assemblyF5HydrateGuardRefV200N = useRef(false)
  const assemblyVideoBlobUrlCacheRefV200C = useRef(new Map())

  const [board, setBoard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [selectedSceneId, setSelectedSceneId] = useState('')
  const [audioMode, setAudioMode] = useState('original_plus_scene')
  const [preferMmaudio, setPreferMmaudio] = useState(true)
  const [skipMissing, setSkipMissing] = useState(false)
  const [smoothTransitionsEnabledV134B, setSmoothTransitionsEnabledV134B] = useState(false)
  const [smoothTransitionDurationSecV134B, setSmoothTransitionDurationSecV134B] = useState(0.5)
  const [smoothTransitionsTimingEnabledV134G, setSmoothTransitionsTimingEnabledV134G] = useState(false)
  const [smoothTransitionTimingDurationSecV134G, setSmoothTransitionTimingDurationSecV134G] = useState(0.5)
  const [transitionVisualModeV196E, setTransitionVisualModeV196E] = useState('fade_to_black')
  const [originalVolume, setOriginalVolume] = useState(100)
  const [sceneVolume, setSceneVolume] = useState(25)
  const [musicVolume, setMusicVolume] = useState(15)
  const [stauEnabledV204H3, setStauEnabledV204H3] = useState(true)
  const [stauVolumeV204H3, setStauVolumeV204H3] = useState(30)
  const [musicFile, setMusicFile] = useState(null)
  const [musicAsset, setMusicAsset] = useState(null)
  const [musicPreviewUrl, setMusicPreviewUrl] = useState('')
  const [selectedVideoBlobUrl, setSelectedVideoBlobUrl] = useState('')
  const [selectedVideoLoadError, setSelectedVideoLoadError] = useState('')
  const [selectedPreviewVideoLoading, setSelectedPreviewVideoLoading] = useState(false)
  const [finalPreviewVideoLoading, setFinalPreviewVideoLoading] = useState(false)
  const [musicUploading, setMusicUploading] = useState(false)
  const [musicLoop, setMusicLoop] = useState(true)
  const [musicFadeOut, setMusicFadeOut] = useState(true)
  const [watermarkEnabled, setWatermarkEnabled] = useState(true)
  const [watermarkText, setWatermarkText] = useState('ava studio')
  const [watermarkPosition, setWatermarkPosition] = useState('top_right')
  const [watermarkOpacity, setWatermarkOpacity] = useState(35)
  const [watermarkSize, setWatermarkSize] = useState(28)
  const [watermarkMotion, setWatermarkMotion] = useState('corners')
  const [musicPanelOpen, setMusicPanelOpen] = useState(false)
  const [watermarkPanelOpen, setWatermarkPanelOpen] = useState(false)
  const [assemblyJob, setAssemblyJob] = useState(null)
  const [assemblyRunning, setAssemblyRunning] = useState(false)
  const [finalVideoUrl, setFinalVideoUrl] = useState('')
  const [finalVideoMetaV200Q, setFinalVideoMetaV200Q] = useState(null)
  const [finalDirty, setFinalDirty] = useState(false)
  const [settingsHydrated, setSettingsHydrated] = useState(false)

  const settingsStorageKey = assemblySettingsKey(projectId || '')

  useEffect(() => {
    const savedSettings = readAssemblyLocalUiSettingsV197F(settingsStorageKey)

    if (savedSettings.audioMode) setAudioMode(savedSettings.audioMode)
    if (savedSettings.hasOriginalVolumeV200N) setOriginalVolume(savedSettings.originalVolume)
    if (savedSettings.hasSceneVolumeV200N) setSceneVolume(savedSettings.sceneVolume)
    if (savedSettings.hasMusicVolumeV200N) setMusicVolume(savedSettings.musicVolume)
    if (savedSettings.hasStauEnabledV204H3) setStauEnabledV204H3(Boolean(savedSettings.stauEnabledV204H3))
    if (savedSettings.hasStauVolumeV204H3) setStauVolumeV204H3(savedSettings.stauVolumeV204H3)
    setSmoothTransitionsEnabledV134B(false)
    setSmoothTransitionDurationSecV134B(0.5)
    setSmoothTransitionsTimingEnabledV134G(Boolean(savedSettings.smoothTransitionsTimingEnabledV134G))
    setSmoothTransitionTimingDurationSecV134G(savedSettings.smoothTransitionTimingDurationSecV134G)
    if (savedSettings.transitionVisualModeV196E) setTransitionVisualModeV196E(savedSettings.transitionVisualModeV196E)

    setSettingsHydrated(true)
  }, [settingsStorageKey])

  const boardRoute = projectId ? `/app/projects/${projectId}/board` : '/app/workspace/board'
  const audioStudioRoute = projectId ? `/app/projects/${projectId}/audio-studio` : '/app/workspace/audio-studio'
  const sceneItems = useMemo(() => buildSceneItems(board || {}, preferMmaudio), [board, preferMmaudio])
  const selectedItem = sceneItems.find((item) => item.id === selectedSceneId) || sceneItems[0] || null
  const selectedItemVideoAssetApiPath = selectedItem?.videoAssetApiPath || ''
  const stauBlocksV204H3 = useMemo(() => extractAssemblyStauBlocksV204H3(board || {}), [board])
  const stauVisualBlocksV204H4 = useMemo(() => assemblyStauVisualBlocksV204H4(stauBlocksV204H3), [stauBlocksV204H3])
  const stauBlockBySceneIdV204H4 = useMemo(() => assemblyStauBlockBySceneIdV204H4(stauBlocksV204H3), [stauBlocksV204H3])
  const stauLayerActiveV204H3 = Boolean(stauEnabledV204H3 && stauBlocksV204H3.length)
  // AVA_ASSEMBLY_AUDIO_SOURCE_GUARD_V204H5: hide dangerous Board refresh for Audio Studio montage.
  const assemblyFromAudioStudioV204H5 = Boolean(
    location?.state?.fromAudioStudio ||
    String(location?.state?.source || '').includes('audio_studio') ||
    board?.audioStudioStableImportedV204H3 ||
    board?.audioStudioStableImportedAtV204H3 ||
    asArray(board?.appliedStableAudioBlocks).length ||
    asArray(board?.applied_stable_audio_blocks).length ||
    asArray(board?.stauBlocks).length ||
    asArray(board?.stau_blocks).length
  )
  const assemblyOutputSpec = useMemo(() => {
    const projectFormatV200O = assemblyFormatTokenV195F(
      routeProjectRecordV200O?.format ||
      routeProjectRecordV200O?.project_format ||
      routeProjectRecordV200O?.projectFormat ||
      routeProjectRecordV200O?.resolution ||
      routeProjectRecordV200O?.orientation ||
      routeProjectRecordV200O?.output_format ||
      routeProjectRecordV200O?.outputFormat ||
      routeProjectRecordV200O?.aspect_ratio ||
      routeProjectRecordV200O?.aspectRatio ||
      ''
    )
    const boardWithProjectFormatV200O = {
      ...(board || {}),
      format: board?.format || board?.resolution || board?.aspect_ratio || board?.aspectRatio || board?.output_format || board?.outputFormat || projectFormatV200O || '',
      resolution: board?.resolution || board?.format || projectFormatV200O || '',
      output_format: board?.output_format || board?.outputFormat || board?.format || projectFormatV200O || '',
      aspect_ratio: board?.aspect_ratio || board?.aspectRatio || board?.format || projectFormatV200O || '',
      project: { ...(routeProjectRecordV200O || {}), ...(board?.project || {}) },
      projectContext: { ...(routeProjectRecordV200O || {}), ...(board?.projectContext || {}) },
      project_context: { ...(routeProjectRecordV200O || {}), ...(board?.project_context || {}) },
    }
    const spec = assemblyOutputSpecV195F(boardWithProjectFormatV200O, sceneItems)
    console.log('[AVA ASSEMBLY OUTPUT SPEC V200O]', { projectId, projectFormatV200O, spec, boardFormat: boardWithProjectFormatV200O.format })
    return spec
  }, [board, sceneItems, routeProjectRecordV200O, projectId])
  useEffect(() => {
    let cancelled = false
    setSelectedVideoLoadError('')
    if (!selectedItemVideoAssetApiPath) {
      setSelectedVideoBlobUrl('')
      return undefined
    }

    const cacheKey = selectedItemVideoAssetApiPath
    const cachedUrl = assemblyVideoBlobUrlCacheRefV200C.current.get(cacheKey)
    if (cachedUrl) {
      setSelectedVideoBlobUrl(cachedUrl)
      return undefined
    }

    setSelectedVideoBlobUrl('')

    async function loadSelectedVideoBlob() {
      try {
        const objectUrl = await fetchProtectedBlobUrl(selectedItemVideoAssetApiPath)
        if (cancelled) {
          URL.revokeObjectURL(objectUrl)
          return
        }
        assemblyVideoBlobUrlCacheRefV200C.current.set(cacheKey, objectUrl)
        setSelectedVideoBlobUrl(objectUrl)
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
      // AVA_ASSEMBLY_VIDEO_BLOB_CACHE_V200C: keep scene video blobs across assembly item switches.
    }
  }, [selectedItemVideoAssetApiPath])

  useEffect(() => {
    return () => {
      assemblyVideoBlobUrlCacheRefV200C.current.forEach((objectUrl) => {
        try { URL.revokeObjectURL(objectUrl) } catch { /* ignore */ }
      })
      assemblyVideoBlobUrlCacheRefV200C.current.clear()
    }
  }, [])

  const selectedItemPlayableVideoUrl = selectedItemVideoAssetApiPath ? selectedVideoBlobUrl : (selectedItem?.videoUrl || '')
  const selectedItemVideoHydrating = Boolean(
    selectedItem &&
    selectedItemVideoAssetApiPath &&
    !selectedVideoBlobUrl &&
    !selectedVideoLoadError
  )
  useEffect(() => {
    setSelectedPreviewVideoLoading(Boolean(selectedItemPlayableVideoUrl))
  }, [selectedItemPlayableVideoUrl])

  useEffect(() => {
    setFinalPreviewVideoLoading(Boolean(finalVideoUrl && !finalDirty))
  }, [finalVideoUrl, finalDirty])

  useEffect(() => {
    setFinalVideoMetaV200Q(null)
  }, [finalVideoUrl])

  function handleFinalVideoMetadataV200Q(event) {
    const video = event?.currentTarget
    const width = Number(video?.videoWidth || 0)
    const height = Number(video?.videoHeight || 0)
    if (width > 0 && height > 0) {
      const aspect = height > width * 1.18 ? '9:16' : width > height * 1.18 ? '16:9' : '1:1'
      const previewClass = aspect === '9:16' ? 'isFormat916' : aspect === '1:1' ? 'isFormat11' : 'isFormat169'
      setFinalVideoMetaV200Q({
        width,
        height,
        aspect,
        previewClass,
        label: `${aspect} · ${width}×${height}`,
      })
      console.log('[BOARD ASSEMBLY FINAL VIDEO META V200Q]', { width, height, aspect, url: finalVideoUrl })
    }
    setFinalPreviewVideoLoading(false)
  }
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
    const stauCount = stauBlocksV204H3.length
    const stauEnabled = Boolean(stauEnabledV204H3 && stauCount)
    const canAssemble = total > 0 && (ready > 0 || hasOriginalAudio)
    return { total, ready, withSound, missing, duration, hasOriginalAudio, canAssemble, stauCount, stauEnabled }
  }, [sceneItems, board, stauBlocksV204H3, stauEnabledV204H3])

  const smoothTransitionDurationSafeV134B = Number(clampNumber(smoothTransitionDurationSecV134B, 0.1, 3, 0.5).toFixed(1))
  const smoothTransitionsAllowedV134B = Boolean(!stats.hasOriginalAudio && ['scene_only', 'music_plus_scene'].includes(audioMode))
  const smoothTransitionsActiveV134B = Boolean(smoothTransitionsEnabledV134B && smoothTransitionsAllowedV134B)
  const smoothTransitionsHintV134B = smoothTransitionsActiveV134B
    ? `fade ${smoothTransitionDurationSafeV134B.toFixed(1)} сек`
    : smoothTransitionsEnabledV134B
      ? 'сокращает ролик'
      : 'выкл'
  const smoothTransitionTimingDurationSafeV134G = Number(clampNumber(smoothTransitionTimingDurationSecV134G, 0.1, 3, 0.5).toFixed(1))
  const smoothTransitionsTimingActiveV134G = Boolean(smoothTransitionsTimingEnabledV134G)
  const smoothTransitionsTimingHintV134G = smoothTransitionsTimingActiveV134G
    ? `длина сохраняется · ${smoothTransitionTimingDurationSafeV134G.toFixed(1)} сек`
    : 'выкл'
  const assemblyTransitionModeV134G = smoothTransitionsTimingEnabledV134G
    ? 'preserve_timing_v134g'
    : 'off'
  const assemblyTransitionRequestedV134G = Boolean(smoothTransitionsTimingEnabledV134G)
  const assemblyTransitionDurationSafeV134G = smoothTransitionTimingDurationSafeV134G


  function buildAssemblySnapshotForSave({ source = 'board_assembly_autosave_v8', overrides = {} } = {}) {
    const scenes = asArray(board?.scenes)
    const items = sceneItems
      .slice()
      .sort((a, b) => (a.start - b.start) || (a.index - b.index))
      .map((item) => ({
        id: item.id,
        scene_id: item.id,
        sceneId: item.id,
        title: item.title,
        route: item.route,
        start_sec: item.start,
        start: item.start,
        end_sec: item.end,
        end: item.end,
        duration_sec: item.duration,
        durationSec: item.duration,
        video_url: item.videoUrl || '',
        videoUrl: item.videoUrl || '',
        video_api_path: item.videoApiPath || '',
        videoApiPath: item.videoApiPath || '',
        hasVideo: Boolean(item.hasVideo),
        has_video: Boolean(item.hasVideo),
        hasSound: Boolean(item.hasSound || item.hasMmaudio),
        has_sound: Boolean(item.hasSound || item.hasMmaudio),
        blockLabel: item.blockLabel || '',
        hue: item.hue,
        raw: item.raw || {},
      }))
    const finalUrl = normalizePlayableVideoUrl(overrides.finalVideoUrl ?? finalVideoUrl)
    const activeJob = overrides.assemblyJob !== undefined ? overrides.assemblyJob : assemblyJob
    const snapshotStauBlocksV204H3 = overrides.appliedStableAudioBlocks || overrides.stableBlocks || stauBlocksV204H3
    const snapshotStauEnabledV204H3 = overrides.stauEnabledV204H3 ?? overrides.stauEnabled ?? stauEnabledV204H3
    const snapshotStauVolumeV204H3 = overrides.stauVolumeV204H3 ?? overrides.stauVolume ?? stauVolumeV204H3
    return {
      stage: 'board_assembly',
      schema: 'ava_board_assembly_snapshot_v8',
      source,
      projectId: projectId || '',
      boardVersion: board?.boardVersion || board?.board_version || '',
      board: board ? { ...board, scenes } : { scenes: [] },
      boardSnapshot: board ? { ...board, scenes } : { scenes: [] },
      scenes,
      boardScenes: scenes,
      items,
      readyItems: items,
      selectedSceneId: overrides.selectedSceneId ?? selectedSceneId,
      audio: board?.audio || null,
      sourceAudio: board?.sourceAudio || board?.audio || null,
      timingAudio: board?.timingAudio || board?.audio || null,
      originalAudio: board?.originalAudio || board?.audio || null,
      audioMode: overrides.audioMode ?? audioMode,
      preferMmaudio: overrides.preferMmaudio ?? preferMmaudio,
      skipMissing: overrides.skipMissing ?? skipMissing,
      smoothTransitionsEnabledV134B: false,
      smoothTransitionDurationSecV134B: overrides.smoothTransitionDurationSecV134B ?? smoothTransitionDurationSafeV134B,
      smoothTransitionsAllowedV134B: overrides.smoothTransitionsAllowedV134B ?? smoothTransitionsAllowedV134B,
      smoothTransitionsActiveV134B: false,
      smoothTransitionsModeV134B: 'background_video_only_v134b',
      smoothTransitionsTimingEnabledV134G,
      smoothTransitionTimingDurationSecV134G: smoothTransitionTimingDurationSafeV134G,
      assemblyTransitionModeV134G,
      smoothTransitionsTimingEnabledV134G: overrides.smoothTransitionsTimingEnabledV134G ?? smoothTransitionsTimingEnabledV134G,
      smoothTransitionTimingDurationSecV134G: overrides.smoothTransitionTimingDurationSecV134G ?? smoothTransitionTimingDurationSafeV134G,
      assemblyTransitionModeV134G: overrides.assemblyTransitionModeV134G ?? assemblyTransitionModeV134G,
      transitionVisualModeV196E: overrides.transitionVisualModeV196E ?? transitionVisualModeV196E,
      originalVolume: overrides.originalVolume ?? originalVolume,
      sceneVolume: overrides.sceneVolume ?? sceneVolume,
      musicVolume: overrides.musicVolume ?? musicVolume,
      musicAsset: overrides.musicAsset ?? musicAsset,
      musicLoop: overrides.musicLoop ?? musicLoop,
      musicFadeOut: overrides.musicFadeOut ?? musicFadeOut,
      stauEnabledV204H3: Boolean(snapshotStauEnabledV204H3),
      stauEnabled: Boolean(snapshotStauEnabledV204H3),
      stauVolumeV204H3: snapshotStauVolumeV204H3,
      stauVolume: snapshotStauVolumeV204H3,
      stableBlocks: snapshotStauBlocksV204H3,
      appliedStableAudioBlocks: snapshotStauBlocksV204H3,
      stauBlocks: snapshotStauBlocksV204H3,
      stau: {
        enabled: Boolean(snapshotStauEnabledV204H3 && asArray(snapshotStauBlocksV204H3).length),
        volumePercent: snapshotStauVolumeV204H3,
        volume: snapshotStauVolumeV204H3 / 100,
        blocks: snapshotStauBlocksV204H3,
        blockCount: asArray(snapshotStauBlocksV204H3).length,
      },
      outputFormat: assemblyOutputSpec.outputFormat,
      output_format: assemblyOutputSpec.outputFormat,
      aspectRatio: assemblyOutputSpec.aspectRatio,
      aspect_ratio: assemblyOutputSpec.aspectRatio,
      outputWidth: assemblyOutputSpec.width,
      output_width: assemblyOutputSpec.width,
      outputHeight: assemblyOutputSpec.height,
      output_height: assemblyOutputSpec.height,
      watermark: {
        enabled: Boolean(overrides.watermark?.enabled ?? (watermarkEnabled && String(watermarkText || '').trim())),
        text: overrides.watermark?.text ?? watermarkText,
        position: overrides.watermark?.position ?? watermarkPosition,
        opacityPercent: overrides.watermark?.opacityPercent ?? watermarkOpacity,
        size: overrides.watermark?.size ?? watermarkSize,
        motion: overrides.watermark?.motion ?? watermarkMotion,
      },
      finalVideoUrl: finalUrl,
      finalUrl,
      assemblyUrl: finalUrl,
      outputUrl: finalUrl,
      resultUrl: finalUrl,
      downloadUrl: finalUrl,
      finalDirty: overrides.finalDirty ?? finalDirty,
      assemblyJob: activeJob || null,
      job: activeJob || null,
      stats,
      updatedAt: new Date().toISOString(),
      ...overrides,
    }
  }

  async function saveAssemblySnapshotNow({ source = 'board_assembly_autosave_v8', overrides = {}, guardMode = 'replace' } = {}) {
    const snapshot = buildAssemblySnapshotForSave({ source, overrides })
    if (workspaceMode) await saveWorkspaceStage('board_assembly', snapshot)
    else await saveStage(projectId, 'board_assembly', snapshot, guardMode)
    return snapshot
  }

  function applyAssemblySnapshot(raw = {}, { forceBoard = false } = {}) {
    const nextBoard = forceBoard ? normalizeBoard(raw) : boardFromAssemblySnapshot(raw)
    setBoard(nextBoard)
    const nextScenes = asArray(nextBoard.scenes)
    setSelectedSceneId(raw.selectedSceneId || nextBoard.selectedSceneId || nextScenes[0]?.id || nextScenes[0]?.scene_id || '')
    setAudioMode(raw.audioMode || (isGeneratorAssemblyBoard(nextBoard) ? 'scene_only' : 'original_plus_scene'))
    setPreferMmaudio(raw.preferMmaudio ?? true)
    setSkipMissing(raw.skipMissing ?? false)
    setSmoothTransitionsEnabledV134B(Boolean(raw.smoothTransitionsEnabledV134B ?? raw.smoothTransitionsEnabled ?? false))
    setSmoothTransitionDurationSecV134B(clampNumber(raw.smoothTransitionDurationSecV134B ?? raw.smoothTransitionDurationSec, 0.1, 3, 0.5))
    setSmoothTransitionsTimingEnabledV134G(Boolean(raw.smoothTransitionsTimingEnabledV134G ?? false))
    setSmoothTransitionTimingDurationSecV134G(clampNumber(raw.smoothTransitionTimingDurationSecV134G ?? raw.smoothTransitionDurationSecV134G, 0.1, 3, 0.5))
    setOriginalVolume(clampNumber(raw.originalVolume, 0, 150, isGeneratorAssemblyBoard(nextBoard) ? 0 : 100))
    setSceneVolume(clampNumber(raw.sceneVolume, 0, 150, isGeneratorAssemblyBoard(nextBoard) ? 100 : 25))
    setMusicVolume(clampNumber(raw.musicVolume, 0, 150, 15))
    const restoredStauBlocksV204H3 = extractAssemblyStauBlocksV204H3(raw)
    setStauEnabledV204H3(Boolean(raw.stauEnabledV204H3 ?? raw.stauEnabled ?? raw.stau?.enabled ?? restoredStauBlocksV204H3.length))
    setStauVolumeV204H3(clampNumber(raw.stauVolumeV204H3 ?? raw.stauVolume ?? raw.stau?.volumePercent ?? (Number(raw.stau?.volume) * 100), 0, 150, assemblyStauDefaultVolumeV204H3(restoredStauBlocksV204H3, 30)))
    setMusicAsset(raw.musicAsset || null)
    setMusicFile(null)
    setMusicLoop(raw.musicLoop ?? true)
    setMusicFadeOut(raw.musicFadeOut ?? true)
    const watermark = raw.watermark || {}
    setWatermarkEnabled(watermark.enabled ?? true)
    setWatermarkText(watermark.text ?? 'ava studio')
    setWatermarkPosition(watermark.position ?? 'top_right')
    setWatermarkOpacity(clampNumber(watermark.opacityPercent ?? watermark.opacity ?? 35, 0, 100, 35))
    setWatermarkSize(clampNumber(watermark.size, 10, 80, 28))
    const restoredWatermarkMotion = String(watermark.motion || 'corners')
    setWatermarkMotion(['static', 'corners', 'slow_orbit'].includes(restoredWatermarkMotion) ? restoredWatermarkMotion : 'corners')
    setFinalVideoUrl(assemblyFinalUrlFromSnapshot(raw))
    setFinalDirty(Boolean(raw.finalDirty))
    const nextJob = raw.assemblyJob || raw.job || null
    setAssemblyJob(nextJob)
    setAssemblyRunning(assemblyJobIsRunning(nextJob))
  }

  const warnings = useMemo(() => {
    const list = []
    const generatorAssemblyBoard = isGeneratorAssemblyBoard(board || {})
    if (!stats.total) list.push('В Board пока нет сцен.')
    // AVA_BOARD_ASSEMBLY_SKIP_MISSING_WARNING_V202B
    if (stats.missing > 0) {
      list.push(skipMissing
        ? `Нет видео у ${stats.missing} сцен — они будут пропущены, монтаж соберётся только из готовых видео.`
        : `Нет видео у ${stats.missing} сцен — они будут собраны как пустые участки / black frame.`)
    }
    if (stats.total > 0 && stats.ready === 0 && !stats.hasOriginalAudio) list.push('Нет master audio и нет готовых video-сцен для сборки.')
    if (!generatorAssemblyBoard && !stats.hasOriginalAudio && ['original_only', 'original_plus_scene', 'original_plus_music_scene', 'original_plus_music'].includes(audioMode)) {
      list.push('В Board не найдено оригинальное audio. Для этого режима понадобится master audio.')
    }
    if (['scene_only', 'music_plus_scene'].includes(audioMode) && stats.withSound === 0) {
      list.push('В сценах не найден звук. Используй MMAudio или i2v sound на нужных сценах.')
    }
    if (['music_plus_scene', 'original_plus_music_scene', 'original_plus_music'].includes(audioMode) && !musicFile) {
      list.push('Фоновая музыка пока не загружена. Можно собрать без неё или загрузить MP3/WAV.')
    }
    if (stauEnabledV204H3 && !stauBlocksV204H3.length) {
      list.push('STAU включён, но применённых Stable Audio блоков нет. Применить блоки нужно в Audio Studio.')
    }
    return list
  }, [stats, audioMode, musicFile, board, smoothTransitionsEnabledV134B, smoothTransitionsAllowedV134B, stauEnabledV204H3, stauBlocksV204H3])

  // AVA_ASSEMBLY_FORCE_BOARD_IMPORT_V11:
  // Board → Montage must import the *current* Board snapshot as source-of-truth.
  // Normal Montage entry may restore saved board_assembly, but explicit Board entry / Refresh replaces it.

function clearBoardAssemblyWorkflowEntryV200O() {
  try {
    sessionStorage.removeItem('ava:workflow-entry:board_assembly')
  } catch {}
}

  function readBoardAssemblyEntryV11() {
    try {
      return JSON.parse(sessionStorage.getItem('ava:workflow-entry:board_assembly') || '{}') || {}
    } catch {
      return {}
    }
  }

  function boardAssemblyDataV11(raw = {}) {
    return raw?.data || raw || {}
  }

  function boardAssemblyWorkflowEntrySignatureV200Z(entry = {}) {
    return [
      String(entry?.to || 'board_assembly'),
      String(entry?.from || ''),
      String(entry?.projectId || projectId || ''),
      String(entry?.createdAt || ''),
      String(entry?.source || ''),
    ].join(':')
  }

  function boardAssemblyWorkflowEntryConsumedKeyV200Z(entry = {}) {
    return `ava:workflow-entry-consumed:v200z:${boardAssemblyWorkflowEntrySignatureV200Z(entry)}`
  }

  function isBoardAssemblyWorkflowEntryConsumedV200Z(entry = {}) {
    if (typeof window === 'undefined') return false
    if (!entry?.enteredByUserClick || !entry?.createdAt) return false
    try {
      return window.sessionStorage.getItem(boardAssemblyWorkflowEntryConsumedKeyV200Z(entry)) === '1'
    } catch {
      return false
    }
  }

  function markBoardAssemblyWorkflowEntryConsumedV200Z(entry = {}) {
    if (typeof window === 'undefined') return
    if (!entry?.enteredByUserClick || !entry?.createdAt) return
    try {
      window.sessionStorage.setItem(boardAssemblyWorkflowEntryConsumedKeyV200Z(entry), '1')
      console.log('[BOARD ASSEMBLY WORKFLOW ENTRY CONSUMED V200Z]', {
        from: entry?.from,
        to: entry?.to,
        projectId: entry?.projectId || projectId || '',
        createdAt: entry?.createdAt,
        source: entry?.source || '',
      })
    } catch {}
  }

  function boardAssemblyScenesV11(data = {}) {
    const directScenes = asArray(data.scenes)
    if (directScenes.length) return directScenes
    const boardScenes = asArray(data.boardScenes)
    if (boardScenes.length) return boardScenes
    const snapshotScenes = asArray(data.board?.scenes || data.boardSnapshot?.scenes)
    if (snapshotScenes.length) return snapshotScenes
    return []
  }

  function boardAssemblyItemsV11(data = {}) {
    const directItems = asArray(data.items)
    if (directItems.length) return directItems
    const readyItems = asArray(data.readyItems)
    if (readyItems.length) return readyItems
    return []
  }

  function boardFromAssemblySnapshotV11(data = {}) {
    const base = data.boardSnapshot || data.board || data
    const scenes = boardAssemblyScenesV11(data)
    return normalizeBoard({
      ...base,
      source: data.source || base.source || 'board_assembly_snapshot_v11',
      boardVersion: data.boardVersion || data.board_version || base.boardVersion || base.board_version || 'board_assembly_snapshot_v11',
      scenes,
      audio: data.audio || data.sourceAudio || data.timingAudio || data.originalAudio || base.audio || base.sourceAudio || base.timingAudio || null,
      sourceAudio: data.sourceAudio || data.audio || base.sourceAudio || base.audio || null,
      timingAudio: data.timingAudio || base.timingAudio || null,
      originalAudio: data.originalAudio || base.originalAudio || null,
    })
  }

  function buildBoardAssemblySnapshotV11(nextBoard, sourceLabel = 'board_to_assembly_imported_v11') {
    const nextScenes = asArray(nextBoard?.scenes)
    const nextItems = buildSceneItems({ ...nextBoard, scenes: nextScenes }, true)
    const selectedId = nextScenes?.[0]?.id || nextScenes?.[0]?.scene_id || nextItems?.[0]?.id || ''
    const audio = nextBoard?.audio || nextBoard?.sourceAudio || nextBoard?.timingAudio || nextBoard?.originalAudio || null
    const nextStauBlocksV204H3 = extractAssemblyStauBlocksV204H3(nextBoard || {})
    return {
      stage: 'board_assembly',
      source: sourceLabel,
      schema: 'ava_board_assembly_snapshot_v11',
      projectId: projectId || '',
      board: nextBoard,
      boardSnapshot: nextBoard,
      boardVersion: nextBoard?.boardVersion || nextBoard?.board_version || sourceLabel,
      scenes: nextScenes,
      boardScenes: nextScenes,
      items: nextItems,
      readyItems: nextItems,
      selectedSceneId: selectedId,
      audio,
      sourceAudio: nextBoard?.sourceAudio || audio,
      timingAudio: nextBoard?.timingAudio || null,
      originalAudio: nextBoard?.originalAudio || null,
      audioMode: nextBoard?.audioMode || 'original_plus_scene',
      preferMmaudio: true,
      skipMissing: false,
      stauEnabledV204H3: Boolean(stauEnabledV204H3 && nextStauBlocksV204H3.length),
      stauEnabled: Boolean(stauEnabledV204H3 && nextStauBlocksV204H3.length),
      stauVolumeV204H3,
      stauVolume: stauVolumeV204H3,
      stableBlocks: nextStauBlocksV204H3,
      appliedStableAudioBlocks: nextStauBlocksV204H3,
      stauBlocks: nextStauBlocksV204H3,
      stau: {
        enabled: Boolean(stauEnabledV204H3 && nextStauBlocksV204H3.length),
        volumePercent: stauVolumeV204H3,
        volume: stauVolumeV204H3 / 100,
        blocks: nextStauBlocksV204H3,
        blockCount: nextStauBlocksV204H3.length,
      },
      smoothTransitionsEnabledV134B,
      smoothTransitionDurationSecV134B: smoothTransitionDurationSafeV134B,
      smoothTransitionsAllowedV134B,
      smoothTransitionsActiveV134B,
      smoothTransitionsModeV134B: 'background_video_only_v134b',
      musicAsset,
      watermark: {
        enabled: watermarkEnabled,
        text: watermarkText || 'ava studio',
        position: watermarkPosition || 'top_right',
        opacityPercent: watermarkOpacity,
        size: watermarkSize,
        motion: watermarkMotion || 'corners',
      },
      finalVideoUrl: '',
      finalUrl: '',
      assemblyUrl: '',
      outputUrl: '',
      downloadUrl: '',
      resultUrl: '',
      videoUrl: '',
      videoApiPath: '',
      assemblyJob: null,
      job: null,
      updatedAt: new Date().toISOString(),
    }
  }

  async function persistBoardImportToAssemblyV11(nextBoard, sourceLabel = 'board_to_assembly_imported_v11') {
    const snapshot = buildBoardAssemblySnapshotV11(nextBoard, sourceLabel)
    // AVA_ASSEMBLY_PRESERVE_FINAL_ON_BOARD_IMPORT_V200O:
    // A stale Board->Assembly workflow marker after F5 must not wipe the final MP4.
    // Preserve existing result refs and mark them dirty instead of deleting them.
    try {
      const existingRawV200O = workspaceMode ? await loadWorkspaceStage('board_assembly') : await loadStage(projectId, 'board_assembly')
      const existingDataV200O = boardAssemblyDataV11(existingRawV200O)
      const existingFinalV200O = assemblyFinalUrlFromSnapshot(existingDataV200O)
      if (existingFinalV200O) {
        snapshot.finalVideoUrl = existingFinalV200O
        snapshot.finalUrl = existingFinalV200O
        snapshot.assemblyUrl = existingFinalV200O
        snapshot.outputUrl = existingFinalV200O
        snapshot.downloadUrl = existingFinalV200O
        snapshot.resultUrl = existingFinalV200O
        snapshot.videoUrl = existingFinalV200O
        snapshot.video_url = existingFinalV200O
        snapshot.videoApiPath = existingDataV200O.videoApiPath || existingDataV200O.video_api_path || existingDataV200O.assemblyApiPath || existingDataV200O.assembly_api_path || ''
        snapshot.video_api_path = snapshot.videoApiPath
        snapshot.assemblyAssetId = existingDataV200O.assemblyAssetId || existingDataV200O.assembly_asset_id || ''
        snapshot.assembly_asset_id = snapshot.assemblyAssetId
        snapshot.assemblyApiPath = existingDataV200O.assemblyApiPath || existingDataV200O.assembly_api_path || snapshot.videoApiPath || ''
        snapshot.assembly_api_path = snapshot.assemblyApiPath
        snapshot.finalDirty = true
        snapshot.source = `${sourceLabel}_preserved_final_v200o`
        console.log('[AVA ASSEMBLY PRESERVE FINAL ON BOARD IMPORT V200O]', { source: sourceLabel, finalVideoUrl: existingFinalV200O })
      }
    } catch (error) {
      console.warn('[AVA ASSEMBLY PRESERVE FINAL ON BOARD IMPORT V200O FAILED]', error?.message || error)
    }
    try {
      if (projectId) await saveStage(projectId, 'board_assembly', snapshot, 'replace')
      else await saveWorkspaceStage('board_assembly', snapshot)
      console.log('[AVA ASSEMBLY BOARD IMPORT SAVED V11]', {
        source: sourceLabel,
        scenes: snapshot.scenes.length,
        items: snapshot.items.length,
        firstItems: snapshot.items.slice(0, 6).map((item) => ({ id: item.id, videoApiPath: item.videoApiPath || item.video_api_path })),
      })
    } catch (error) {
      console.warn('[AVA ASSEMBLY BOARD IMPORT SAVE FAILED V11]', error?.message || error)
    }
  }

  async function loadBoardSnapshot(options = {}) {
    const forceBoard = Boolean(options.forceBoard)
    const currentAudioStudioAssemblyV204H5 = Boolean(
      board?.audioStudioStableImportedV204H3 ||
      board?.audioStudioStableImportedAtV204H3 ||
      asArray(board?.appliedStableAudioBlocks).length ||
      asArray(board?.applied_stable_audio_blocks).length ||
      asArray(board?.stauBlocks).length ||
      asArray(board?.stau_blocks).length ||
      location?.state?.fromAudioStudio ||
      String(location?.state?.source || '').includes('audio_studio')
    )
    if (forceBoard && currentAudioStudioAssemblyV204H5 && !options.allowAudioStudioBoardRefreshV204H5) {
      setStatus('Монтаж пришёл из Audio Studio. Обновление из Board скрыто, чтобы не потерять STAU-блоки.')
      return
    }
    setLoading(true)
    assemblyF5HydrateGuardRefV200N.current = true
    setStatus(forceBoard ? 'Обновляем монтаж из текущей Доски…' : 'Загружаем монтаж…')

    if (isBoardAssemblyCleared() && !forceBoard) {
      setBoard(emptyBoardAssemblySource())
      setSelectedSceneId('')
      setFinalVideoUrl('')
      setFinalDirty(false)
      setAssemblyJob(null)
      setAssemblyRunning(false)
      setStatus('Монтаж очищен. Нажми “Обновить из Board”, чтобы снова подтянуть сцены.')
      setLoading(false)
      assemblyF5HydrateGuardRefV200N.current = false
      return
    }

    const entry = readBoardAssemblyEntryV11()
    const locationEntryV200N = location?.state?.workflowEntry || null
    const fromBoardEntry = String(entry?.from || '').trim() === 'board' || String(entry?.source || '').includes('board_to_assembly')
    const rawFromCurrentBoardNavigationV200N = Boolean(
      locationEntryV200N?.enteredByUserClick &&
      locationEntryV200N?.to === 'board_assembly' &&
      String(locationEntryV200N?.from || '').trim() === 'board'
    )
    const fromCurrentBoardNavigationV200N = rawFromCurrentBoardNavigationV200N && !isBoardAssemblyWorkflowEntryConsumedV200Z(locationEntryV200N)
    // V204C4: Audio Studio -> Assembly must import the current Board, not restore an old montage job.
    const locationForceBoardV204C4 = Boolean(
      location?.state?.forceBoard ||
      location?.state?.forceReplace ||
      location?.state?.fromAudioStudio ||
      String(location?.state?.source || '').includes('audio_studio_to_assembly')
    )
    const audioStudioForceTokenV204C4 = [
      'audio_to_assembly_v204c4',
      String(projectId || 'workspace'),
      String(location?.state?.requestedAt || ''),
      String(location?.state?.source || ''),
    ].join(':')
    let audioStudioForceConsumedV204C4 = false
    try {
      audioStudioForceConsumedV204C4 = Boolean(
        audioStudioForceTokenV204C4 &&
        window.sessionStorage.getItem(`ava:assembly-force-board:${audioStudioForceTokenV204C4}`) === '1'
      )
    } catch {}
    const fromAudioStudioForceV204C4 = locationForceBoardV204C4 && !audioStudioForceConsumedV204C4
    const shouldImportBoard = forceBoard || fromCurrentBoardNavigationV200N || fromAudioStudioForceV204C4
    const localUiSettingsV197F = readAssemblyLocalUiSettingsV197F(settingsStorageKey)

    try {
      if (!shouldImportBoard) {
        const assemblyRaw = workspaceMode
          ? await loadWorkspaceStage('board_assembly')
          : await loadStage(projectId, 'board_assembly')
        const assemblyData = boardAssemblyDataV11(assemblyRaw)
        const assemblyScenes = boardAssemblyScenesV11(assemblyData)
        const assemblyItems = boardAssemblyItemsV11(assemblyData)
        if (assemblyScenes.length || assemblyItems.length) {
          const restoredBoard = boardFromAssemblySnapshotV11(assemblyData)
          setBoard(restoredBoard)
          const firstSceneId = assemblyData.selectedSceneId || restoredBoard.scenes?.[0]?.id || restoredBoard.scenes?.[0]?.scene_id || assemblyItems?.[0]?.id || ''
          setSelectedSceneId(firstSceneId)
          setAudioMode(localUiSettingsV197F.hasAudioModeV197F ? localUiSettingsV197F.audioMode : (assemblyData.audioMode || assemblyData.audio_mode || audioMode || 'original_plus_scene'))
          setPreferMmaudio(assemblyData.preferMmaudio ?? assemblyData.prefer_mmaudio ?? true)
          setSkipMissing(assemblyData.skipMissing ?? assemblyData.skip_missing ?? false)
          setSmoothTransitionsEnabledV134B(false)
          setSmoothTransitionsTimingEnabledV134G(localUiSettingsV197F.hasSmoothTransitionsTimingEnabledV197F ? localUiSettingsV197F.smoothTransitionsTimingEnabledV134G : Boolean(assemblyData.smoothTransitionsTimingEnabledV134G))
          setSmoothTransitionTimingDurationSecV134G(clampNumber(localUiSettingsV197F.hasSmoothTransitionTimingDurationV197F ? localUiSettingsV197F.smoothTransitionTimingDurationSecV134G : assemblyData.smoothTransitionTimingDurationSecV134G, 0.1, 3, 0.5))
          setTransitionVisualModeV196E(localUiSettingsV197F.hasTransitionVisualModeV197F ? localUiSettingsV197F.transitionVisualModeV196E : (assemblyData.transitionVisualModeV196E || 'fade_to_black'))
          setOriginalVolume(clampNumber(
            assemblyData.originalVolume ?? (Number(assemblyData.volumes?.original) * 100),
            0,
            150,
            localUiSettingsV197F.hasOriginalVolumeV200N ? localUiSettingsV197F.originalVolume : (isGeneratorAssemblyBoard(restoredBoard) ? 0 : 100),
          ))
          setSceneVolume(clampNumber(
            assemblyData.sceneVolume ?? (Number(assemblyData.volumes?.scene) * 100),
            0,
            150,
            localUiSettingsV197F.hasSceneVolumeV200N ? localUiSettingsV197F.sceneVolume : (isGeneratorAssemblyBoard(restoredBoard) ? 100 : 25),
          ))
          setMusicVolume(clampNumber(
            assemblyData.musicVolume ?? (Number(assemblyData.volumes?.music) * 100),
            0,
            150,
            localUiSettingsV197F.hasMusicVolumeV200N ? localUiSettingsV197F.musicVolume : 15,
          ))
          const restoredStauBlocksV204H3 = extractAssemblyStauBlocksV204H3(assemblyData)
          setStauEnabledV204H3(Boolean(assemblyData.stauEnabledV204H3 ?? assemblyData.stauEnabled ?? assemblyData.stau?.enabled ?? restoredStauBlocksV204H3.length))
          setStauVolumeV204H3(clampNumber(
            assemblyData.stauVolumeV204H3 ?? assemblyData.stauVolume ?? assemblyData.stau?.volumePercent ?? (Number(assemblyData.stau?.volume) * 100),
            0,
            150,
            localUiSettingsV197F.hasStauVolumeV204H3 ? localUiSettingsV197F.stauVolumeV204H3 : assemblyStauDefaultVolumeV204H3(restoredStauBlocksV204H3, 30),
          ))
          setMusicLoop(assemblyData.musicLoop ?? assemblyData.music?.loop ?? true)
          setMusicFadeOut(assemblyData.musicFadeOut ?? assemblyData.music?.fade_out ?? true)
          setMusicAsset(assemblyData.musicAsset || null)
          const wm = assemblyData.watermark || {}
          if (Object.keys(wm).length) {
            setWatermarkEnabled(wm.enabled ?? true)
            setWatermarkText(wm.text || 'ava studio')
            setWatermarkPosition(wm.position || 'top_right')
            setWatermarkOpacity(clampNumber(wm.opacityPercent ?? (Number(wm.opacity) * 100), 5, 100, 35))
            setWatermarkSize(clampNumber(wm.size, 10, 96, 28))
            setWatermarkMotion(wm.motion || 'corners')
          }
          const finalUrl = assemblyFinalUrlFromSnapshot(assemblyData)
          const restoredFinalDirtyV200Z = Boolean(assemblyData.finalDirty ?? false)
          const restoredJobV204C4 = finalUrl ? null : (assemblyData.assemblyJob || assemblyData.job || null)
          setFinalVideoUrl(finalUrl)
          setFinalDirty(restoredFinalDirtyV200Z)
          setAssemblyJob(restoredJobV204C4)
          setAssemblyRunning(Boolean(restoredJobV204C4?.jobId || restoredJobV204C4?.job_id) && !finalUrl)
          console.log('[BOARD ASSEMBLY FINAL RESTORED V200Z]', { finalUrl, finalDirty: restoredFinalDirtyV200Z, source: assemblyData.source || '' })
          setStatus(`Монтаж восстановлен из project snapshot: сцен ${assemblyScenes.length || assemblyItems.length}`)
          setLoading(false)
          return
        }
      }

      const data = workspaceMode
        ? await loadWorkspaceStage('board')
        : await loadStage(projectId, 'board')

      let nextBoard = normalizeBoard(data)
      if (fromAudioStudioForceV204C4) {
        try {
          const audioStudioRawV204H3 = workspaceMode ? await loadWorkspaceStage('audio_studio') : await loadStage(projectId, 'audio_studio')
          nextBoard = mergeAudioStudioStauIntoBoardV204H3(nextBoard, audioStudioRawV204H3)
          const importedBlocksV204H3 = extractAssemblyStauBlocksV204H3(nextBoard)
          setStauEnabledV204H3(Boolean(importedBlocksV204H3.length))
          setStauVolumeV204H3(localUiSettingsV197F.hasStauVolumeV204H3 ? localUiSettingsV197F.stauVolumeV204H3 : assemblyStauDefaultVolumeV204H3(importedBlocksV204H3, 30))
          console.log('[AVA ASSEMBLY IMPORT STAU FROM AUDIO STUDIO V204H3]', { blocks: importedBlocksV204H3.length })
        } catch (error) {
          console.warn('[AVA ASSEMBLY IMPORT STAU FROM AUDIO STUDIO FAILED V204H3]', error?.message || error)
          setStauEnabledV204H3(false)
        }
      } else {
        setStauEnabledV204H3(false)
      }
      setBoard(nextBoard)
      const firstSceneId = nextBoard.scenes?.[0]?.id || nextBoard.scenes?.[0]?.scene_id || ''
      setSelectedSceneId(firstSceneId)

      // Board -> Montage is authoritative: replace stale montage items/assets with current Board assets.
      setAudioMode(localUiSettingsV197F.hasAudioModeV197F ? localUiSettingsV197F.audioMode : 'original_plus_scene')
      setPreferMmaudio(true)
      setSkipMissing(false)
      setSmoothTransitionsEnabledV134B(false)
      setSmoothTransitionsTimingEnabledV134G(localUiSettingsV197F.hasSmoothTransitionsTimingEnabledV197F ? localUiSettingsV197F.smoothTransitionsTimingEnabledV134G : false)
      setSmoothTransitionTimingDurationSecV134G(localUiSettingsV197F.hasSmoothTransitionTimingDurationV197F ? localUiSettingsV197F.smoothTransitionTimingDurationSecV134G : 0.5)
      setTransitionVisualModeV196E(localUiSettingsV197F.hasTransitionVisualModeV197F ? localUiSettingsV197F.transitionVisualModeV196E : 'fade_to_black')
      setFinalVideoUrl('')
      setFinalDirty(false)
      setAssemblyJob(null)
      setAssemblyRunning(false)
      setWatermarkEnabled(true)
      setWatermarkText('ava studio')
      setWatermarkPosition('top_right')
      setWatermarkOpacity(35)
      setWatermarkSize(28)
      setWatermarkMotion('corners')
      await persistBoardImportToAssemblyV11(nextBoard, shouldImportBoard ? 'board_to_assembly_imported_v11' : 'board_fallback_imported_v11')
      if (fromCurrentBoardNavigationV200N) markBoardAssemblyWorkflowEntryConsumedV200Z(locationEntryV200N)
      if (fromAudioStudioForceV204C4) {
        try {
          window.sessionStorage.setItem(`ava:assembly-force-board:${audioStudioForceTokenV204C4}`, '1')
          window.history.replaceState({ ...(window.history.state || {}), usr: { source: 'assembly_loaded_from_audio_studio_v204c4' } }, '', location.pathname)
        } catch {}
      }
      clearWorkflowEntry('board_assembly')
      setStatus(nextBoard.scenes?.length ? `Доска: сцен ${nextBoard.scenes.length}${extractAssemblyStauBlocksV204H3(nextBoard).length ? ` · STAU блоков ${extractAssemblyStauBlocksV204H3(nextBoard).length}` : ''}` : 'Board пустой')
    } catch (error) {
      setStatus(`Не удалось загрузить монтаж/Board: ${error?.message || 'unknown_error'}`)
      setBoard({ scenes: [] })
    } finally {
      setLoading(false)
      if (typeof window !== 'undefined') {
        window.setTimeout(() => { assemblyF5HydrateGuardRefV200N.current = false }, 200)
      } else {
        assemblyF5HydrateGuardRefV200N.current = false
      }
    }
  }

  useEffect(() => {
    loadBoardSnapshot()
  }, [projectId, entryFromBoard])

  useEffect(() => {
    if (!settingsHydrated) return
    if (assemblyF5HydrateGuardRefV200N.current) return
    if (!finalVideoUrl) return
    setFinalDirty(true)
  }, [
    preferMmaudio,
    skipMissing,
    originalVolume,
    sceneVolume,
    musicVolume,
    stauEnabledV204H3,
    stauVolumeV204H3,
    stauBlocksV204H3,
    musicAsset,
    musicLoop,
    musicFadeOut,
    watermarkEnabled,
    watermarkText,
    watermarkPosition,
    watermarkOpacity,
    watermarkSize,
    smoothTransitionsEnabledV134B,
    smoothTransitionDurationSecV134B,
  ])


  useEffect(() => {
    if (!settingsHydrated) return
    writeAssemblyLocalUiSettingsV197F(settingsStorageKey, {
      audioMode,
      smoothTransitionsTimingEnabledV134G,
      smoothTransitionTimingDurationSecV134G: smoothTransitionTimingDurationSafeV134G,
      transitionVisualModeV196E,
      originalVolume,
      sceneVolume,
      musicVolume,
      stauEnabledV204H3,
      stauVolumeV204H3,
    })
  }, [
    settingsHydrated,
    settingsStorageKey,
    audioMode,
    smoothTransitionsTimingEnabledV134G,
    smoothTransitionTimingDurationSafeV134G,
    transitionVisualModeV196E,
    originalVolume,
    sceneVolume,
    musicVolume,
    stauEnabledV204H3,
    stauVolumeV204H3,
  ])



  useEffect(() => {
    if (!settingsHydrated || loading || !board) return undefined
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = window.setTimeout(() => {
      saveAssemblySnapshotNow({ source: 'board_assembly_autosave_v8', guardMode: 'replace' }).catch((error) => {
        console.warn('[BOARD ASSEMBLY AUTOSAVE FAILED]', error)
      })
    }, 650)
    return () => {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current)
    }
  }, [
    settingsHydrated,
    loading,
    board,
    selectedSceneId,
    preferMmaudio,
    skipMissing,
    originalVolume,
    sceneVolume,
    musicVolume,
    stauEnabledV204H3,
    stauVolumeV204H3,
    stauBlocksV204H3,
    musicAsset,
    musicLoop,
    musicFadeOut,
    watermarkEnabled,
    watermarkText,
    watermarkPosition,
    watermarkOpacity,
    watermarkSize,
    watermarkMotion,
    finalVideoUrl,
    finalDirty,
    assemblyJob,
  ])

  useEffect(() => {
    if (loading) return
    const job = assemblyJob || null
    const jobId = job?.jobId || job?.job_id || ''
    const statusEndpoint = job?.statusEndpoint || job?.status_endpoint || (jobId ? `/api/board-assembly/status/${jobId}` : '')
    if (!jobId || !statusEndpoint || !assemblyJobIsRunning(job)) return
    if (resumedAssemblyJobRef.current === jobId) return
    resumedAssemblyJobRef.current = jobId
    setAssemblyRunning(true)
    pollAssemblyJob(statusEndpoint, jobId)
  }, [loading, assemblyJob])

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
    // AVA_ASSEMBLY_FINAL_STATIC_URL_V200Q: keep the browser-playable static file URL for preview/F5.
    const rawStaticUrl = data?.finalStaticUrl || data?.final_static_url || data?.staticUrl || data?.static_url || data?.publicUrl || data?.public_url || data?.fileUrl || data?.file_url || data?.videoUrl || data?.video_url || videoUrl || ''
    const rawUrl = rawStaticUrl || data?.videoApiPath || data?.video_api_path || ''
    let assemblyAssetId = data?.assemblyAssetId || data?.assembly_asset_id || data?.assetId || data?.asset_id || ''
    let assemblyApiPath = data?.assemblyApiPath || data?.assembly_api_path || data?.videoApiPath || data?.video_api_path || ''
    const normalizedUrl = normalizePlayableVideoUrl(rawStaticUrl || rawUrl || assemblyApiPath)
    const finalPlayableUrl = normalizedUrl || normalizePlayableVideoUrl(rawUrl) || normalizePlayableVideoUrl(assemblyApiPath)

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
      ...buildAssemblySnapshotForSave({ source: 'board_assembly_result_v8', overrides: { finalVideoUrl: finalPlayableUrl, finalDirty: false, assemblyJob: null } }),
      stage: 'board_assembly',
      source: 'board_assembly_result_v8',
      boardVersion: board?.boardVersion || board?.board_version || '',
      assembly_asset_id: assemblyAssetId,
      assemblyAssetId: assemblyAssetId,
      assembly_api_path: assemblyApiPath,
      assemblyApiPath: assemblyApiPath,
      assemblyUrl: finalPlayableUrl,
      finalVideoUrl: finalPlayableUrl,
      finalUrl: finalPlayableUrl,
      outputUrl: finalPlayableUrl,
      resultUrl: finalPlayableUrl,
      downloadUrl: finalPlayableUrl,
      video_url: finalPlayableUrl,
      videoUrl: finalPlayableUrl,
      final_playable_url: finalPlayableUrl,
      finalPlayableUrl: finalPlayableUrl,
      final_static_url: finalPlayableUrl,
      finalStaticUrl: finalPlayableUrl,
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
      finalDirty: false,
      assemblyJob: null,
      job: null,
      updatedAt: new Date().toISOString(),
    }

    try {
      if (projectId) await saveStage(projectId, 'board_assembly', snapshot, 'replace')
      else await saveWorkspaceStage('board_assembly', snapshot)
      clearBoardAssemblyWorkflowEntryV200O()
      console.log('[BOARD ASSEMBLY RESULT SAVED V200Q]', { assemblyAssetId, assemblyApiPath, finalPlayableUrl, videoUrl: snapshot.finalVideoUrl })
    } catch (error) {
      console.warn('[BOARD ASSEMBLY RESULT SAVE_FAILED]', { error: error?.message || error })
    }
  }

  function buildAssemblyPayload() {
    // AVA_BOARD_ASSEMBLY_SKIP_MISSING_COMPACT_V202B:
    // When "Пропускать сцены без видео" is enabled, send only ready video
    // scenes to backend and compact their timeline. Previously the frontend
    // still sent missing scenes as placeholders, so backend made black gaps and
    // users saw "missing video" even when they wanted to assemble ready 5-10.
    let compactCursorV202B = 0
    const sourceItemsV202B = sceneItems
      .slice()
      .sort((a, b) => (a.start - b.start) || (a.index - b.index))
      .filter((item) => !skipMissing || item.hasVideo)

    const items = sourceItemsV202B
      .map((item) => {
        const raw = item.raw || {}
        const usesMmaudioVideo = preferMmaudio && Boolean(raw.mmaudio_video_api_path || raw.mmaudioVideoApiPath || raw.mmaudio_video_url || raw.mmaudioVideoUrl)
        const assemblyStartV202B = skipMissing ? compactCursorV202B : item.start
        const assemblyEndV202B = skipMissing ? compactCursorV202B + item.duration : item.end
        if (skipMissing) compactCursorV202B = assemblyEndV202B
        return {
          scene_id: item.id,
          sceneId: item.id,
          title: item.title,
          route: item.route,
          duration_sec: item.duration,
          start_sec: assemblyStartV202B,
          end_sec: assemblyEndV202B,
          assembly_video_trim_allowed: Boolean(item.assemblyVideoTrim),
          assemblyVideoTrimAllowed: Boolean(item.assemblyVideoTrim),
          assembly_video_trim_enabled: Boolean(item.assemblyVideoTrim?.enabled),
          assemblyVideoTrimEnabled: Boolean(item.assemblyVideoTrim?.enabled),
          assembly_video_trim_start_sec: item.assemblyVideoTrim?.startSec || 0,
          assemblyVideoTrimStartSec: item.assemblyVideoTrim?.startSec || 0,
          assembly_video_trim_end_sec: item.assemblyVideoTrim?.endSec || 0,
          assemblyVideoTrimEndSec: item.assemblyVideoTrim?.endSec || 0,
          assembly_video_trim_duration_sec: item.assemblyVideoTrim?.durationSec || 0,
          assemblyVideoTrimDurationSec: item.assemblyVideoTrim?.durationSec || 0,
          assembly_video_source_duration_sec: item.assemblyVideoTrim?.sourceDurationSec || 0,
          assemblyVideoSourceDurationSec: item.assemblyVideoTrim?.sourceDurationSec || 0,
          assembly_timing_locked: assemblyBoardTimingLockedForTrimV201A(board || {}, raw || {}),
          assemblyTimingLocked: assemblyBoardTimingLockedForTrimV201A(board || {}, raw || {}),
          assembly_audio_driven_trim_locked: assemblySceneAudioDrivenTrimLockedV201A(raw || {}),
          assemblyAudioDrivenTrimLocked: assemblySceneAudioDrivenTrimLockedV201A(raw || {}),
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
    const lockedAssemblyFormatV200O = assemblyOutputSpec.outputFormat || assemblyOutputSpec.aspectRatio || assemblyOutputSpec.format || '16:9'
    const lockedAssemblyFitModeV200O = assemblyOutputSpec.outputFitMode || assemblyOutputSpec.fitMode || (lockedAssemblyFormatV200O === '9:16' ? 'cover' : 'contain')
    const lockedAssemblyFormatV200N = assemblyOutputSpec.outputFormat || assemblyOutputSpec.aspectRatio || assemblyOutputSpec.format || '16:9'
    const lockedAssemblyFitModeV200N = assemblyOutputSpec.fitMode || (lockedAssemblyFormatV200N === '9:16' ? 'cover' : 'contain')
    const activeStauBlocksV204H3 = stauEnabledV204H3 ? stauBlocksV204H3 : []

    return {
      project_id: projectId || '',
      audio_mode: audioMode,
      original_audio_url: originalAudio.url,
      original_audio_asset_id: originalAudio.assetId,
      original_audio_name: originalAudio.name,
      skip_missing: skipMissing,
      prefer_mmaudio: preferMmaudio,
      width: assemblyOutputSpec.width,
      height: assemblyOutputSpec.height,
      fps: 30,
      aspect_ratio: lockedAssemblyFormatV200O,
      aspectRatio: lockedAssemblyFormatV200O,
      output_format: lockedAssemblyFormatV200O,
      outputFormat: lockedAssemblyFormatV200O,
      output_size_label: assemblyOutputSpec.label,
      fit_mode: lockedAssemblyFitModeV200O,
      fitMode: lockedAssemblyFitModeV200O,
      output_fit_mode: lockedAssemblyFitModeV200O,
      outputFitMode: lockedAssemblyFitModeV200O,
      duration_sec: skipMissing ? compactCursorV202B : stats.duration,
      timeline_duration_sec: skipMissing ? compactCursorV202B : stats.duration,
      volumes: {
        original: originalVolume / 100,
        scene: sceneVolume / 100,
        music: musicVolume / 100,
        stau: stauVolumeV204H3 / 100,
      },
      stau: {
        enabled: Boolean(stauEnabledV204H3 && activeStauBlocksV204H3.length),
        volume: stauVolumeV204H3 / 100,
        volume_percent: stauVolumeV204H3,
        volumePercent: stauVolumeV204H3,
        blocks: activeStauBlocksV204H3,
        block_count: activeStauBlocksV204H3.length,
        blockCount: activeStauBlocksV204H3.length,
        source: 'audio_studio_applied_stable_blocks_v204h3',
      },
      stable_audio_blocks: activeStauBlocksV204H3,
      stableAudioBlocks: activeStauBlocksV204H3,
      applied_stable_audio_blocks: activeStauBlocksV204H3,
      appliedStableAudioBlocks: activeStauBlocksV204H3,
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
        enabled: Boolean(watermarkEnabled && String(watermarkText || '').trim()),
        text: watermarkText,
        position: watermarkPosition,
        opacity: watermarkOpacity / 100,
        size: watermarkSize,
        motion: watermarkMotion,
      },
      transitions: {
        enabled: assemblyTransitionRequestedV134G,
        requestedEnabled: assemblyTransitionRequestedV134G,
        preserveTiming: Boolean(smoothTransitionsTimingEnabledV134G),
        shortenTimeline: Boolean(smoothTransitionsEnabledV134B),
        allowed: true,
        type: 'fade',
        duration_sec: assemblyTransitionDurationSafeV134G,
        durationSec: assemblyTransitionDurationSafeV134G,
        mode: assemblyTransitionModeV134G,
        forceEnabled: assemblyTransitionRequestedV134G,
        forcePayloadV134G: true,
        visualMode: transitionVisualModeV196E,
        visual_mode: transitionVisualModeV196E,
        visualModeV196E: transitionVisualModeV196E,
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
          setAssemblyJob(null)
          await persistBoardAssemblyResult(data, videoUrl)
          setStatus(`Финальный MP4 готов: ${data?.videoName || data?.video_name || jobId || ''}`)
          return
        }

        if (['done', 'ready', 'complete', 'completed', 'success', 'succeeded', 'finished'].includes(String(nextStatus).toLowerCase())) {
          setAssemblyRunning(false)
          setAssemblyJob(null)
          setStatus(`Assembly job завершён без нового video url: ${nextStatus}. Нажми “Собрать preview”, чтобы запустить свежую сборку.`)
          return
        }

        if (['error', 'failed'].includes(String(nextStatus).toLowerCase())) {
          setAssemblyRunning(false)
          setAssemblyJob(null)
          setStatus(`Ошибка сборки: ${data?.error || data?.detail || nextStatus}`)
          return
        }

        if (attempt < 240) {
          window.setTimeout(tick, 2500)
        } else {
          setAssemblyRunning(false)
          setAssemblyJob(null)
          setStatus('Сборка слишком долго не отвечает: poll_timeout')
        }
      } catch (error) {
        if (attempt < 240) {
          window.setTimeout(tick, 4000)
        } else {
          setAssemblyRunning(false)
          setAssemblyJob(null)
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
        smoothTransitions: payload.transitions,
        stau: { enabled: Boolean(payload.stau?.enabled), blocks: payload.stau?.block_count || 0, volume: payload.volumes?.stau },
        transitionPayloadDebugV134E: '[ASSEMBLY TRANSITIONS PAYLOAD V134E]',
        output: `${payload.output_format || payload.aspect_ratio || '16:9'} · ${payload.width}×${payload.height}`,
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

      const startedJob = { ...data, startedAt: new Date().toISOString() }
      setAssemblyJob(startedJob)
      await saveAssemblySnapshotNow({
        source: 'board_assembly_job_started_v8',
        overrides: { assemblyJob: startedJob, job: startedJob, finalVideoUrl: '', finalDirty: false },
        guardMode: 'replace',
      })
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

  // AVA_ASSEMBLY_FORCE_MP4_DOWNLOAD_V13:
  // Cross-origin <a download> often opens the video in the browser instead of saving it.
  // Fetch the final file as a blob on click, then download the object URL.
  async function downloadVideoExplicitly(event, url, filename = 'ava-video.mp4') {
    stopAssemblyActionEvent(event)
    const normalizedUrl = normalizePlayableVideoUrl(url)
    if (!normalizedUrl) return

    const safeFilename = String(filename || 'ava-video.mp4').trim() || 'ava-video.mp4'
    try {
      setStatus(`Готовим скачивание: ${safeFilename}`)
      const needsAuth = /\/api\/assets\//i.test(normalizedUrl) || /\/assets\//i.test(normalizedUrl)
      const response = await fetch(normalizedUrl, {
        headers: needsAuth ? getAuthHeaders() : {},
      })
      if (!response.ok) throw new Error(`download_failed_${response.status}`)
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = safeFilename
      link.rel = 'noopener noreferrer'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 8000)
      setStatus(`MP4 отправлен на скачивание: ${safeFilename}`)
    } catch (error) {
      console.warn('[BOARD ASSEMBLY DOWNLOAD FALLBACK V13]', error)
      setStatus('Не удалось скачать напрямую, открываем видео в новой вкладке')
      window.open(normalizedUrl, '_blank', 'noopener,noreferrer')
    }
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
          <Link className="isAudioStudioBackV204C1" to={audioStudioRoute}><Music size={15} /> Назад в Audio Studio</Link>
          {!assemblyFromAudioStudioV204H5 && (
            <button
              type="button"
              onClick={() => {
                clearBoardAssemblyClearedMarker()
                loadBoardSnapshot({ forceBoard: true })
              }}
            ><RefreshCcw size={15} /> Обновить из Board</button>
          )}
          {assemblyFromAudioStudioV204H5 && (
            <span className="avaAssemblyAudioStudioSourceBadgeV204H5" title="Монтаж открыт из Audio Studio. Обновление из Board скрыто, чтобы не потерять STAU-блоки.">
              <Music size={14} /> из Audio Studio · STAU safe
            </span>
          )}
          <button
              type="button"
              onClick={startAssembly}
              disabled={assemblyRunning || !stats.canAssemble}
              title={assemblyRunning ? 'Сборка уже идёт' : stats.canAssemble ? 'Собрать новый preview из текущих сцен' : 'Нет готовых сцен для сборки'}
            >
              <Wand2 size={15} /> {assemblyRunning ? 'Собираем…' : 'Собрать preview'}
            </button>
        </div>
      </section>

      <section className="avaAssemblyStats">
        <span>Сц: <strong>{stats.total}</strong></span>
        <span>Видео: <strong>{stats.ready}/{stats.total}</strong></span>
        <span>Звук: <strong>{stats.withSound}</strong></span>
        <span>Дл: <strong>{formatTime(stats.duration)}</strong></span>
        <span>Audio: <strong>{stats.hasOriginalAudio ? 'есть' : 'нет'}</strong></span>
        <span>STAU: <strong>{stats.stauCount ? (stats.stauEnabled ? `${stats.stauCount} on` : `${stats.stauCount} off`) : 'нет'}</strong></span>
        <span>Итог: <strong>{assemblyOutputSpec.label}</strong></span>
        {status && <span className="avaBoardStatusText">{status}</span>}
        <span className="avaBoardStatusText">Водн.: {watermarkEnabled && String(watermarkText || '').trim() ? 'ON' : 'off'}</span>
        <span className="avaBoardStatusText">Автосохр.</span>
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

          {/* AVA_ASSEMBLY_STAU_SCENE_COLOR_ONLY_V204H6: STAU block is shown by coloring the scene cards, no extra strip. */}
          <div className="avaAssemblySceneList">
            {sceneItems.map((item) => {
              const stauBlockV204H4 = stauBlockBySceneIdV204H4.get(String(item.id || '').trim())
              const hasStauBlockV204H4 = Boolean(stauBlockV204H4)
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`avaAssemblySceneItem ${selectedItem?.id === item.id ? 'isActive' : ''} ${item.hasVideo ? 'isReady' : 'isMissing'} ${item.blockLabel ? 'hasBlock' : ''} ${hasStauBlockV204H4 ? 'hasStauBlockV204H4' : ''}`}
                  style={{ '--scene-hue': stauBlockV204H4?.visualHueV204H4 ?? item.hue, '--stau-block-hue': stauBlockV204H4?.visualHueV204H4 ?? item.hue }}
                  onClick={() => setSelectedSceneId(item.id)}
                  aria-pressed={selectedItem?.id === item.id}
                  title={hasStauBlockV204H4 ? `${item.title} — ${stauBlockV204H4.visualTitleV204H4}` : (selectedItem?.id === item.id ? `${item.title} — выбрана` : `Выбрать ${item.title}`)}
                >
                  <strong>{item.title}</strong>
                  <span>{formatTime(item.start)} → {formatTime(item.end || item.start + item.duration)}</span>
                  <small>{item.route} · {item.hasVideo ? 'video' : 'нет видео'}{item.hasMmaudio ? ' · MMAudio' : item.hasSound ? ' · sound' : ''}</small>
                  {item.blockLabel && <em className="avaAssemblyBlockBadge">{item.blockLabel}</em>}
                  {hasStauBlockV204H4 && <em className="avaAssemblyStauBadgeV204H4">STAU {stauBlockV204H4.visualIndexV204H4}: {stauBlockV204H4.visualTitleV204H4}</em>}
                  {selectedItem?.id === item.id && <em className="avaAssemblySelectedBadge">выбрано</em>}
                </button>
              )
            })}
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

          <div className={`avaAssemblyPreview ${assemblyOutputSpec.className || ''} `}>
            {selectedItemPlayableVideoUrl ? (
              <div className="avaAssemblyVideoPreviewShellV195C">
                <div className={`avaAssemblyVideoViewportV195C ${assemblyOutputSpec.previewClass}`} title={`Preview crop/output frame: ${assemblyOutputSpec.label}`}>
                <video
                  src={selectedItemPlayableVideoUrl}
                  controls
                  preload="metadata"
                  playsInline
                  onLoadStart={() => setSelectedPreviewVideoLoading(true)}
                  onLoadedData={() => setSelectedPreviewVideoLoading(false)}
                  onCanPlay={() => setSelectedPreviewVideoLoading(false)}
                  onError={() => setSelectedPreviewVideoLoading(false)}
                />
                {selectedPreviewVideoLoading ? (
                  <div className="avaAssemblyMediaOverlay" role="status" aria-live="polite">
                    <RefreshCcw className="avaMediaSpinIcon" size={32} />
                    <strong>Загружаем видео…</strong>
                  </div>
                ) : null}
                {watermarkEnabled && String(watermarkText || '').trim() && (
                  <span className={`avaAssemblyLiveWatermark ${watermarkPosition}`} style={watermarkPreviewStyle}>
                    {watermarkText}
                  </span>
                )}
                </div>
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
                    ? 'Сцены, звук и музыка уйдут в один MP4. Watermark будет запечён в финальный MP4 с учётом формата проекта.'
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

          {finalVideoUrl && (
            <div className={`avaAssemblyFinalPreview ${assemblyOutputSpec.className || ''} `}>
              <div className="avaBoardSectionHead">
                <div>
                  <p className="avaEyebrow">final output</p>
                  <h3>Финальный MP4</h3>
                </div>
                <button type="button" onClick={(event) => openVideoExplicitly(event, finalVideoUrl)}>Открыть файл</button>
              </div>
              <div className="avaAssemblyVideoPreviewShellV195C avaAssemblyFinalPreviewShellV195C">
                <div className={`avaAssemblyVideoViewportV195C avaAssemblyFinalVideoWithWatermark ${finalVideoMetaV200Q?.previewClass || assemblyOutputSpec.previewClass}`} title={`Final output frame: ${finalVideoMetaV200Q?.label || assemblyOutputSpec.label}`}>
                <video
                  key={finalVideoUrl}
                  src={finalVideoUrl}
                  controls
                  preload="metadata"
                  playsInline
                  onLoadStart={() => setFinalPreviewVideoLoading(true)}
                  onLoadedMetadata={handleFinalVideoMetadataV200Q}
                  onLoadedData={() => setFinalPreviewVideoLoading(false)}
                  onCanPlay={() => setFinalPreviewVideoLoading(false)}
                  onError={() => setFinalPreviewVideoLoading(false)}
                />
                {finalPreviewVideoLoading ? (
                  <div className="avaAssemblyMediaOverlay" role="status" aria-live="polite">
                    <RefreshCcw className="avaMediaSpinIcon" size={32} />
                    <strong>Загружаем финальный MP4…</strong>
                  </div>
                ) : null}
                {watermarkEnabled && String(watermarkText || '').trim() && (
                  <span className={`avaAssemblyLiveWatermark ${watermarkPosition}`} style={watermarkPreviewStyle}>
                    {watermarkText}
                  </span>
                )}
                </div>
                <div className="avaBoardVideoActions">
                  <button type="button" onClick={(event) => openVideoExplicitly(event, finalVideoUrl)}>Смотреть видео</button>
                  <button type="button" onClick={(event) => downloadVideoExplicitly(event, finalVideoUrl, 'ava-board-assembly.mp4')}>Скачать MP4</button>
                </div>
              </div>
              {false ? <p /> : null}
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
              <label className={!stauBlocksV204H3.length ? 'isDisabledV204H3' : ''}>
                <span><Music size={14} /> STAU: {stauVolumeV204H3}%</span>
                <input type="range" min="0" max="150" value={stauVolumeV204H3} onChange={(event) => setStauVolumeV204H3(Number(event.target.value))} disabled={!stauBlocksV204H3.length} />
              </label>
            </div>
          </div>

        </div>

        <aside className="avaAssemblySettings">
          <div className="avaBoardSectionHead avaAssemblyAudioModeHeaderV170A">
            <div>
              <p className="avaEyebrow"><SlidersHorizontal size={14} /> audio mix</p>
              <h3>Режимы аудио в видео</h3>
            </div>
          </div>

          <label className="avaAssemblySelectLabel avaAssemblySelectLabelV170A">
            <span>Режимы аудио в видео</span>
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

          <label className="avaAssemblyCheck avaAssemblyStauToggleV204H3">
            <input type="checkbox" checked={stauEnabledV204H3} disabled={!stauBlocksV204H3.length} onChange={(event) => setStauEnabledV204H3(event.target.checked)} />
            STAU слой из Audio Studio {stauBlocksV204H3.length ? `· блоков ${stauBlocksV204H3.length}` : '· нет применённых блоков'}
          </label>

          <label className="avaAssemblyCheck">
            <input type="checkbox" checked={skipMissing} onChange={(event) => setSkipMissing(event.target.checked)} />
            Пропускать сцены без видео
          </label>

          <div className={`avaAssemblyTransitionMini avaAssemblyTransitionMiniTimingV134G isTimingV170A ${smoothTransitionsTimingEnabledV134G ? 'isOn' : ''}`}>
            <div className="avaAssemblyTransitionMiniHead">
              <label>
                <input
                  type="checkbox"
                  checked={smoothTransitionsTimingEnabledV134G}
                  onChange={(event) => {
                    const next = event.target.checked
                    setSmoothTransitionsTimingEnabledV134G(next)
                    if (next) setSmoothTransitionsEnabledV134B(false)
                  }}
                />
                <span>
                  <strong>Сохранять тайминг</strong>
                  <em>{smoothTransitionsTimingHintV134G}</em>
                </span>
              </label>
              <b>{smoothTransitionTimingDurationSafeV134G.toFixed(1)}с</b>
            </div>
            <div className="avaAssemblyTransitionMiniControls">
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={smoothTransitionTimingDurationSafeV134G}
                onChange={(event) => setSmoothTransitionTimingDurationSecV134G(Number(event.target.value))}
              />
              <input
                type="number"
                min="0.1"
                max="3"
                step="0.1"
                value={smoothTransitionTimingDurationSafeV134G}
                onChange={(event) => setSmoothTransitionTimingDurationSecV134G(clampNumber(event.target.value, 0.1, 3, 0.5))}
              />
            </div>
            <label className="avaAssemblyTransitionModeSelectV196E">
              <span>Вид перехода</span>
              <select value={transitionVisualModeV196E} onChange={(event) => setTransitionVisualModeV196E(event.target.value)}>
                {TRANSITION_VISUAL_MODES_V196E.map((mode) => (
                  <option key={mode.value} value={mode.value}>{mode.title}</option>
                ))}
              </select>
              <em>{TRANSITION_VISUAL_MODES_V196E.find((mode) => mode.value === transitionVisualModeV196E)?.text || ''}</em>
            </label>
          </div>

          <div className={`avaAssemblyMusicBox isMusicV170A ${musicPanelOpen ? 'isOpen' : 'isCollapsed'}`}>
            <button type="button" className="avaAssemblyPanelToggle" onClick={() => setMusicPanelOpen((value) => !value)}>
              <span>
                <strong>Фоновая музыка</strong>
                <em>{musicAsset ? (musicAsset.audio_name || musicFile?.name || 'загружена') : 'MP3/WAV пока не выбран'}</em>
              </span>
              <b>{musicPanelOpen ? '−' : '+'}</b>
            </button>

            {musicPanelOpen && (
              <div className="avaAssemblyPanelBody">
                {/* AVA_QUICK_LINKS_MOISES_SUNO_V137M */}
                <div className="avaAssemblyQuickLinksRow">
                  <a
                    className="avaAssemblyQuickLinkButton isSuno"
                    href="https://suno.com"
                    target="_blank"
                    rel="noreferrer"
                    title="Открыть Suno"
                  >
                    <span className="avaAssemblyQuickLinkBadge" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M5 6.5h5.8c1.5 0 2.7 1.2 2.7 2.7 0 1.5-1.2 2.7-2.7 2.7H7.3c-1.5 0-2.7 1.2-2.7 2.7 0 1.5 1.2 2.7 2.7 2.7H19" />
                        <path d="M8 4.8v14.4" />
                        <path d="M16 4.8v14.4" />
                      </svg>
                    </span>
                    <span>Suno</span>
                    <ExternalLink size={11} strokeWidth={2.2} />
                  </a>
                </div>
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
          <div className={`avaAssemblyWatermarkBox isWatermarkV170A ${watermarkEnabled ? 'isEnabled' : ''} ${watermarkPanelOpen ? 'isOpen' : 'isCollapsed'}`}>
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

              <div className={`avaAssemblyWatermarkPreview ${assemblyOutputSpec.previewClass}`} title={`Итоговый кадр: ${assemblyOutputSpec.label}`}>
                <span className={`wm ${watermarkPosition}`}>{watermarkText || 'Ava Studio'}</span>
                <em className="avaAssemblyWatermarkFormatBadge">{assemblyOutputSpec.label}</em>
              </div>
            </div>

                <div className="avaAssemblyField">
                  <span>Движение</span>
                  <div className="avaAssemblyMotionPresetGrid">
                    <button
                      type="button"
                      className={`avaAssemblyMotionPresetButton ${watermarkMotion === 'static' ? 'isActive' : ''}`}
                      onClick={() => { setWatermarkEnabled(true); setWatermarkMotion('static') }}
                    >
                      Статично
                    </button>
                    <button
                      type="button"
                      className={`avaAssemblyMotionPresetButton ${watermarkMotion === 'slow_orbit' ? 'isActive' : ''}`}
                      onClick={() => { setWatermarkEnabled(true); setWatermarkMotion('slow_orbit') }}
                    >
                      Slow круг
                    </button>
                    <button
                      type="button"
                      className={`avaAssemblyMotionPresetButton ${watermarkMotion === 'corners' ? 'isActive' : ''}`}
                      onClick={() => { setWatermarkEnabled(true); setWatermarkMotion('corners') }}
                    >
                      По углам
                    </button>
                  </div>
                </div>

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
