/* AVA_PROJECT_PACK_NORMALIZED_SCENES_V15: import Unified Project Pack split with root/timing/production priority. */
/* AVA_PROJECT_PACK_SCENE_IMPORT_EXPORT_V14: import Unified Project Pack scenes with root/timing/production priority. */
/* AVA_TRANSITION_MODAL_RETURN_ICON_V13C_HANDLER_FIX: return icon uses existing cancel button instead of missing cancelTimingToBoardConfirmV16. */
/* AVA_TRANSITION_MODAL_RETURN_ICON_V13B_FIX: fixed literal escaped newlines from v13 modal return patch. */
/* AVA_TRANSITION_MODAL_RETURN_ICON_V13: transition-confirm modals have a small return icon. */
/* AVA_PROJECT_NEW_ID_GUARD_V12: sanitize route projectId so /projects/new/timing does not call /api/projects/new. */
/* AVA_UNIFIED_TASK_BUTTON_TIMING_V7: Prompt/Video/Codex replaced by one JSX task pack button. */
/* AVA_UNIFIED_TASK_BUTTON_TIMING_V6_ROLLBACK: removed hook-based v6 that caused React hook-order error. */
/* AVA_TIMING_TO_BOARD_INLINE_CONFIRM_V35: remove runtime references to helper funcs by using inline handlers in JSX. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Clock3, Film, Pause, Play, Save, StepBack, StepForward, Trash2, Undo2, UploadCloud } from 'lucide-react'
import { useProjects } from '../context/ProjectContext.jsx'
import { buildApiUrl, cutAudioAssetRange, fetchProtectedBlobUrl, getAuthHeaders, normalizeAssetFileUrl, normalizeStaticMediaUrl, transcribeAudioAsset, translateAsrSegments, uploadAudioAsset } from '../services/apiClient.js'
import WorkflowStageControls from '../components/WorkflowStageControls.jsx'
import { buildAvaProjectPackV1, downloadJsonFile } from '../lib/avaProjectPack.js'
import { isWorkflowStageCleared, clearWorkflowStageClearedMarker, makeWorkflowEntry, navigateWithWorkflowEntry, rememberWorkflowEntry, readWorkflowEntry } from '../utils/workflowNavigation.js'

const STAGE = 'manual_timing'
const DRAFT_VERSION = 'manual_timing_single_timeline_v6_handoff_manifest'
const MIN_SCENE_SEC = 0.18
const MAX_UNDO = 30
const MT_PLAYHEAD_DIAG_STORAGE_KEY = 'ava:mt-playhead-diag'
const MT_BLOCK_DIAG_STORAGE_KEY = 'ava:mt-block-diag'


const AVA_PODCAST_TO_TIMING_KEY_STAGE95 = 'ava:podcast-to-timing:v1'
const AVA_DOWNSTREAM_RESET_KEY_STAGE95 = 'ava:downstream-reset:v1'
const AVA_ACTIVE_JOBS_KEY_STAGE95 = 'ava:active-jobs:v1'
const AVA_COMPLETED_JOBS_KEY_STAGE95 = 'ava:completed-jobs:v1'

const MANUAL_TIMING_VIDEO_FIELD_KEYS = new Set([
  'videoUrl',
  'video_url',
  'resultUrl',
  'result_url',
  'resultVideoUrl',
  'result_video_url',
  'videoApiPath',
  'video_api_path',
  'resultVideoApiPath',
  'result_video_api_path',
  'boardVideoUrl',
  'board_video_url',
  'boardjobId',
  'boardjob_id',
  'boardJobId',
  'board_job_id',
  'mediaPreviewUrl',
  'media_preview_url',
  'previewUrl',
  'preview_url',
  'mediaUrl',
  'media_url',
  'videoPreviewUrl',
  'video_preview_url',
  'videoResult',
  'video_result',
  'mmaudioResult',
  'mmaudio_result',
  'assemblyJob',
  'assembly_job',
  'boardAssembly',
  'board_assembly',
])

function isManualTimingPlayheadDiagEnabled() {
  if (typeof window === 'undefined') return false
  return window.localStorage?.getItem(MT_PLAYHEAD_DIAG_STORAGE_KEY) === '1'
}

function logManualTimingPlayheadDiag(label, payload) {
  if (!isManualTimingPlayheadDiagEnabled()) return
  console.log(label, payload)
}

function isManualTimingBlockDiagEnabled() {
  if (typeof window === 'undefined') return false
  return window.localStorage?.getItem(MT_BLOCK_DIAG_STORAGE_KEY) === '1'
}

function logManualTimingBlockDiag(label, payload) {
  if (!isManualTimingBlockDiagEnabled()) return
  console.log(label, payload)
}

function timeToTimelinePct(timeSec, durationSec) {
  const duration = Number(durationSec) || 0
  if (duration <= 0) return 0
  return Math.min(100, Math.max(0, ((Number(timeSec) || 0) / duration) * 100))
}

function avaManualTimingContainsStaleBoardVideo(value = '') {
  const raw = String(value || '')
  return /board_videos|boardjob_|\/static\/assets\/board_videos/i.test(raw)
}

function avaManualTimingStripVideoRefs(value, depth = 0) {
  if (depth > 24) return value
  if (typeof value === 'string') return avaManualTimingContainsStaleBoardVideo(value) ? '' : value
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => avaManualTimingStripVideoRefs(item, depth + 1))

  const out = {}
  Object.entries(value).forEach(([key, item]) => {
    if (MANUAL_TIMING_VIDEO_FIELD_KEYS.has(key)) return
    if (/video|boardjob|board_video|media_preview|preview_media/i.test(key)) return
    out[key] = avaManualTimingStripVideoRefs(item, depth + 1)
  })
  return out
}


function avaManualTimingIsRealProjectId(value = '') {
  const id = String(value || '').trim()
  return /^p_[a-z0-9]+$/i.test(id)
}

function avaStage16SafeAudioFilename(name = 'ava_audio.mp3') {
  const raw = String(name || 'ava_audio.mp3').trim() || 'ava_audio.mp3'
  const cleaned = raw.replace(/[\\/:*?"<>|]+/g, '_')
  if (/\.(mp3|wav|m4a|aac|ogg|flac|webm)$/i.test(cleaned)) return cleaned
  return `${cleaned}.mp3`
}

async function avaStage16DownloadAudioSource({ source = '', filename = 'ava_audio.mp3', fetchProtectedBlobUrl, getAuthHeaders, setStatus }) {
  const raw = String(source || '').trim()
  if (!raw) throw new Error('empty_audio_source')

  let objectUrl = ''
  let shouldRevoke = false

  if (raw.startsWith('blob:') || raw.startsWith('data:')) {
    objectUrl = raw
  } else if (raw.startsWith('/api/assets/')) {
    objectUrl = await fetchProtectedBlobUrl(raw.replace(/^\/api/, ''))
    shouldRevoke = true
  } else if (raw.startsWith('/assets/')) {
    objectUrl = await fetchProtectedBlobUrl(raw)
    shouldRevoke = true
  } else {
    const response = await fetch(raw, {
      credentials: 'include',
      headers: getAuthHeaders ? getAuthHeaders() : {},
    })
    if (!response.ok) throw new Error(`download_failed_${response.status}`)
    const blob = await response.blob()
    objectUrl = URL.createObjectURL(blob)
    shouldRevoke = true
  }

  const link = document.createElement('a')
  link.href = objectUrl
  link.download = avaStage16SafeAudioFilename(filename)
  document.body.appendChild(link)
  link.click()
  link.remove()

  if (shouldRevoke) {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000)
  }

  setStatus?.(`аудио сохранено: ${avaStage16SafeAudioFilename(filename)}`)
}


function avaStage95JsonReadOnce(key) {
  let value = null
  try {
    const raw = sessionStorage.getItem(key) || localStorage.getItem(key)
    value = raw ? JSON.parse(raw) : null
    sessionStorage.removeItem(key)
    localStorage.removeItem(key)
  } catch {
    value = null
  }
  return value
}

function avaStage95HandoffMatches(handoff = {}, projectId = '') {
  const currentProjectId = String(projectId || '').trim()
  const handoffProjectId = String(handoff.projectId || handoff.project_id || '').trim()
  if (currentProjectId) return currentProjectId === handoffProjectId
  return !handoffProjectId || handoff.workspaceMode === true || handoff.scope === 'workspace'
}




function avaStage118AssetIdFromValue(value = '') {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const direct = raw.match(/(^|[/?:&=])(asset_[A-Za-z0-9_-]+)/)
  if (direct?.[2]) return direct[2]

  const pathMatch = raw.match(/\/(?:api\/)?assets\/([^/]+)\/file/i)
  if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1])

  return ''
}

function avaStage118AsrAssetId(sourceDraft = {}, useVocalStem = false) {
  if (typeof avaStage117AssetIdFromAudioDraft === 'function') {
    const value = avaStage117AssetIdFromAudioDraft(sourceDraft, useVocalStem)
    if (value) return value
  }

  if (useVocalStem) {
    return String(
      sourceDraft.vocalAudioAssetId ||
      avaStage118AssetIdFromValue(sourceDraft.vocalAudioApiPath) ||
      avaStage118AssetIdFromValue(sourceDraft.vocalAudioUrl) ||
      ''
    ).trim()
  }

  const candidates = [
    sourceDraft.audioAssetId,
    sourceDraft.assetId,
    sourceDraft.asset_id,
    sourceDraft.audio_asset_id,
    sourceDraft.audioApiPath,
    sourceDraft.audio_api_path,
    sourceDraft.audioUrl,
    sourceDraft.audio_url,
    sourceDraft.asset_url,
    sourceDraft.url,
  ]

  for (const candidate of candidates) {
    const value = String(candidate || '').trim()
    if (!value) continue
    if (value.startsWith('asset_')) return value
    const parsed = avaStage118AssetIdFromValue(value)
    if (parsed) return parsed
  }

  return ''
}

function avaStage117AssetIdFromValue(value = '') {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const direct = raw.match(/(^|[/?:&=])(asset_[A-Za-z0-9_-]+)/)
  if (direct?.[2]) return direct[2]

  const pathMatch = raw.match(/\/(?:api\/)?assets\/([^/]+)\/file/i)
  if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1])

  return ''
}

function avaStage117AssetIdFromAudioDraft(sourceDraft = {}, useVocalStem = false) {
  if (useVocalStem) {
    return String(
      sourceDraft.vocalAudioAssetId ||
      avaStage117AssetIdFromValue(sourceDraft.vocalAudioApiPath) ||
      avaStage117AssetIdFromValue(sourceDraft.vocalAudioUrl) ||
      ''
    ).trim()
  }

  const candidates = [
    sourceDraft.audioAssetId,
    sourceDraft.assetId,
    sourceDraft.asset_id,
    sourceDraft.audio_asset_id,
    sourceDraft.audioApiPath,
    sourceDraft.audio_api_path,
    sourceDraft.audioUrl,
    sourceDraft.audio_url,
    sourceDraft.asset_url,
    sourceDraft.url,
  ]

  for (const candidate of candidates) {
    const value = String(candidate || '').trim()
    if (!value) continue
    if (value.startsWith('asset_')) return value
    const parsed = avaStage117AssetIdFromValue(value)
    if (parsed) return parsed
  }

  return ''
}

function avaStage116AssetApiPathFromUrl(value = '') {
  const normalized = normalizeAssetFileUrl(value)
  if (normalized.apiPath) return normalized.apiPath
  const raw = String(value || '').trim()
  if (!raw || raw.startsWith('blob:') || raw.startsWith('data:')) return ''

  try {
    const parsed = new URL(raw, window.location.origin)
    const path = String(parsed.pathname || '').trim()
    if (path.startsWith('/api/assets/')) return path.slice(4)
    if (path.startsWith('/assets/')) return path
  } catch {
    // fall back to string checks below
  }

  if (raw.startsWith('/api/assets/')) return raw.slice(4)
  if (raw.startsWith('/assets/')) return raw
  return ''
}

function avaStage116ShouldAuthFetch(value = '') {
  return Boolean(avaStage116AssetApiPathFromUrl(value))
}

function avaStage95AudioUrlToPreview(value = '') {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const normalizedAsset = normalizeAssetFileUrl(raw)
  if (normalizedAsset.assetId && normalizedAsset.url) return normalizedAsset.url
  const normalizedStatic = normalizeStaticMediaUrl(raw)
  if (normalizedStatic !== raw) return normalizedStatic
  if (raw.startsWith('blob:') || raw.startsWith('data:') || /^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith('/api/') || raw.startsWith('/assets/')) return buildApiUrl(raw)
  if (raw.startsWith('/static/')) return buildApiUrl(raw)
  return raw
}

function avaStage95PickHandoffAudio(handoff = {}) {
  return handoff.finalAudio || handoff.final_audio || handoff.audio || {}
}

function avaStage95SceneFromHandoff(scene = {}, index = 0, durationSec = 0) {
  const audioOnlyScene = avaManualTimingStripVideoRefs(scene || {})
  const start = Number(scene.start ?? scene.start_sec ?? scene.t0 ?? 0)
  const end = Number(scene.end ?? scene.end_sec ?? scene.t1 ?? Math.min(durationSec, start + 1))
  return makeScene(index, Math.max(0, start), Math.max(start + 0.05, end), {
    ...audioOnlyScene,
    id: formatSceneId(index),
    title: scene.title || scene.id || formatSceneId(index),
    route: scene.route || 'auto',
    note: scene.note || '',
    blockTitle: scene.blockTitle || scene.block_title || '',
    blockId: scene.blockId || scene.block_id || '',
    blockColor: scene.blockColor || scene.block_color || scene.color || '',
  })
}


function avaStage110PodcastLabelFromBlock(block = {}, index = 0) {
  const isSilence = Boolean(
    block?.is_silence ||
    block?.isSilence ||
    block?.source_kind === 'silence' ||
    block?.sourceKind === 'silence' ||
    block?.type === 'silence' ||
    block?.block_type === 'silence' ||
    block?.source_audio_id === 'silence'
  )

  if (isSilence) {
    return String(block?.label || block?.role_label || block?.speaker_label || block?.badge || 'ТИШ').trim() || 'ТИШ'
  }

  return String(
    block?.roleLabel ||
    block?.role_label ||
    block?.speakerLabel ||
    block?.speaker_label ||
    block?.blockTitle ||
    block?.block_title ||
    block?.label ||
    block?.source_label ||
    block?.sourceLabel ||
    block?.source_audio_name ||
    block?.sourceAudioName ||
    block?.saved_clip_label ||
    block?.inserted_phrase_label ||
    block?.actor_label ||
    block?.type ||
    `Podcast ${index + 1}`
  ).trim()
}

function avaStage110ReadBlockStart(block = {}, fallback = 0) {
  const value =
    block?.timeline_start_sec ??
    block?.timelineStart ??
    block?.timeline_start ??
    block?.start_sec ??
    block?.start ??
    fallback
  return Number(value || 0)
}

function avaStage110ReadBlockEnd(block = {}, start = 0) {
  const raw =
    block?.timeline_end_sec ??
    block?.timelineEnd ??
    block?.timeline_end ??
    block?.end_sec ??
    block?.end
  const direct = Number(raw || 0)
  if (direct > start) return direct
  const duration = Number(block?.duration_sec ?? block?.durationSec ?? block?.duration ?? 0)
  return start + Math.max(0, duration)
}

function avaStage110ForcePodcastBlockScenes(handoff = {}) {
  const manifest =
    handoff.podcast_edit_manifest ||
    handoff.podcastEditManifest ||
    handoff.composer_edit_manifest ||
    handoff.composerEditManifest ||
    {}

  const manifestBlocks = Array.isArray(manifest.blocks) ? manifest.blocks : []
  const directBlocks = Array.isArray(handoff.blocks) ? handoff.blocks : []
  const sourceBlocks = manifestBlocks.length ? manifestBlocks : directBlocks

  if (!sourceBlocks.length) return handoff

  let cursor = 0
  const scenes = sourceBlocks
    .map((block, index) => {
      const start = avaStage110ReadBlockStart(block, cursor)
      const end = avaStage110ReadBlockEnd(block, start)
      cursor = end
      if (!(end > start)) return null

      const isSilence = Boolean(
        block?.is_silence ||
        block?.isSilence ||
        block?.source_kind === 'silence' ||
        block?.sourceKind === 'silence' ||
        block?.type === 'silence' ||
        block?.block_type === 'silence' ||
        block?.source_audio_id === 'silence'
      )
      const label = avaStage110PodcastLabelFromBlock(block, index)
      const sceneId = formatSceneId(index)
      const blockId = String(block?.block_id || block?.blockId || block?.id || `podcast_block_${index + 1}`)

      return {
        id: sceneId,
        scene_id: sceneId,
        title: sceneId,
        index,
        start,
        end,
        start_sec: start,
        end_sec: end,
        duration_sec: Number((end - start).toFixed(3)),
        route: isSilence ? 'i2v_sound' : 'i2v',
        blockId,
        block_id: blockId,
        blockTitle: label,
        block_title: label,
        roleLabel: label,
        role_label: label,
        speakerLabel: label,
        speaker_label: label,
        composer_block_id: blockId,
        composer_block_type: String(block?.type || ''),
        composer_source_kind: String(block?.source_kind || block?.type || ''),
        composer_source_audio_id: String(block?.source_audio_id || block?.sourceAudioId || ''),
        composer_source_audio_name: String(block?.source_audio_name || block?.sourceAudioName || ''),
        composer_saved_clip_id: String(block?.saved_clip_id || block?.savedClipId || ''),
        composer_saved_clip_label: String(block?.saved_clip_label || ''),
        is_silence: isSilence,
        source_kind: isSilence ? 'silence' : (block?.source_kind || block?.type || 'audio'),
        original_text: isSilence ? '[тишина]' : label,
        translated_text_ru: isSilence ? '[тишина]' : label,
        meaning_hint_ru: isSilence
          ? 'Вставленная пользователем тишина из Podcast Composer.'
          : `Фрагмент Podcast: ${label}.`,
        note: isSilence ? 'Тишина из Podcast Composer.' : `Podcast: ${label}`,
      }
    })
    .filter(Boolean)

  if (!scenes.length) return handoff

  console.log('[MANUAL_TIMING_STAGE110_BLOCK_SCENES_FORCED]', {
    inputScenes: Array.isArray(handoff.scenes) ? handoff.scenes.length : 0,
    blockScenes: scenes.length,
    silenceScenes: scenes.filter((scene) => scene.is_silence).length,
    firstScene: scenes[0],
  })

  return {
    ...handoff,
    scenes,
    blocks: sourceBlocks,
    podcast_edit_manifest: { ...manifest, blocks: sourceBlocks },
    composer_edit_manifest: { ...manifest, blocks: sourceBlocks },
  }
}

function avaStage95DraftFromPodcastHandoff(handoff = {}) {
  const cleanHandoff = avaManualTimingStripVideoRefs(handoff || {})
  const audio = avaStage95PickHandoffAudio(cleanHandoff)
  const audioUrl = String(audio.url || audio.audioUrl || audio.audio_url || audio.assetUrl || audio.asset_url || audio.publicUrl || audio.public_url || '').trim()
  const duration = Math.max(0, Number(audio.durationSec || audio.duration_sec || cleanHandoff.finalDurationSec || cleanHandoff.final_duration_sec || 0))
  const rawScenes = Array.isArray(cleanHandoff.scenes) ? cleanHandoff.scenes : []
  const scenes = rawScenes.length
    ? rawScenes.map((scene, index) => avaStage95SceneFromHandoff(scene, index, duration))
    : makeSingleScene(duration)

  return normalizeDraft({
    ...emptyDraft,
    audioName: audio.filename || audio.name || audio.audioName || 'AVA_podcast_audio.mp3',
    audioAssetId: audio.assetId || audio.asset_id || '',
    audioApiPath: audio.assetApiPath || audio.asset_api_path || audio.audioApiPath || audio.audio_api_path || '',
    audioUrl,
    audioSizeBytes: Number(audio.size_bytes || audio.audio_size_bytes || audio.size || 0),
    audioDurationSec: duration,
    scenes,
    scenesCount: scenes.length,
    selectedSceneIndex: 0,
    storyBlocks: [],
    roles: [],
    speechSegments: [],
    audioPhrases: [],
    missingSpeechHints: [],
    silentSegments: [],
    vocalAudioName: '',
    vocalAudioAssetId: '',
    vocalAudioApiPath: '',
    vocalAudioSizeBytes: 0,
    vocalAudioDurationSec: 0,
    vocalOffsetSec: 0,
    handoffSource: 'podcast_audio_composer',
    podcastEditManifest: cleanHandoff.podcast_edit_manifest || cleanHandoff.podcastEditManifest || null,
    podcast_edit_manifest: cleanHandoff.podcast_edit_manifest || cleanHandoff.podcastEditManifest || null,
    podcastBlocks: cleanHandoff.blocks || [],
    podcastActorAudios: cleanHandoff.actorAudios || [],
    historySnapshots: [],
    notes: 'Получено из Podcast / Audio Composer',
  })
}

function avaStage95EmptyBoardSnapshot() {
  return {
    boardVersion: 'ava_board_foundation_v1',
    source: 'board',
    importedFrom: '',
    updatedAt: new Date().toISOString(),
    audio: null,
    roles: [],
    speechSegments: [],
    audioPhrases: [],
    missingSpeechHints: [],
    storyBlocks: [],
    scenes: [],
    selectedSceneId: '',
    notes: '',
    resetReason: 'podcast_new_audio',
  }
}

function avaStage95ClearAssemblyState(projectId = '') {
  try {
    localStorage.removeItem(projectId ? `ava:board-assembly:${projectId}:settings:v1` : 'ava:board-assembly:workspace:settings:v1')
    localStorage.removeItem(AVA_ACTIVE_JOBS_KEY_STAGE95)
    localStorage.removeItem(AVA_COMPLETED_JOBS_KEY_STAGE95)
    localStorage.removeItem(AVA_DOWNSTREAM_RESET_KEY_STAGE95)
    localStorage.removeItem('ava:open-board-scene:v1')
  } catch {}
}


const emptyDraft = {
  timingDraftVersion: DRAFT_VERSION,
  audioName: '',
  audioAssetId: '',
  audioApiPath: '',
  audioUrl: '',
  audioSizeBytes: 0,
  audioDurationSec: 0,
  vocalAudioName: '',
  vocalAudioAssetId: '',
  vocalAudioApiPath: '',
  vocalAudioSizeBytes: 0,
  vocalAudioDurationSec: 0,
  vocalOffsetSec: 0,
  scenesCount: 1,
  scenes: [],
  storyBlocks: [],
  roles: [],
  speechSegments: [],
  audioPhrases: [],
  missingSpeechHints: [],
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
  const rawScenes = Array.isArray(data?.scenes) ? avaManualTimingStripVideoRefs(data.scenes) : []

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

function repairManualTimingAudioAssetFields(data = {}) {
  const audioUrl = String(data?.audioUrl || data?.audio_url || data?.assetUrl || data?.asset_url || data?.url || '').trim()
  const audioApiPath = String(data?.audioApiPath || data?.audio_api_path || data?.asset_api_path || '').trim()
  const assetUrl = normalizeAssetFileUrl(audioUrl || audioApiPath)
  const normalizedStaticUrl = assetUrl.assetId ? '' : normalizeStaticMediaUrl(audioUrl)
  const audioAssetId = String(
    data?.audioAssetId ||
    data?.audio_asset_id ||
    data?.asset_id ||
    data?.assetId ||
    assetUrl.assetId ||
    ''
  ).trim()
  const repaired = {
    audioAssetId,
    audioApiPath: audioApiPath || assetUrl.apiPath || '',
    audioUrl: assetUrl.url || normalizedStaticUrl || audioUrl,
  }
  if (assetUrl.assetId && (!data?.audioAssetId || assetUrl.url !== audioUrl)) {
    console.log('[AUDIO ASSET RESTORE]', repaired)
  }
  return repaired
}

function normalizeDraft(data) {
  const cleanData = avaManualTimingStripVideoRefs(data || {})
  const repairedAudio = repairManualTimingAudioAssetFields(cleanData)
  const parsedStep = Number(cleanData?.stepSec)
  const parsedDuration = Number(cleanData?.audioDurationSec)
  const duration = Number.isFinite(parsedDuration) ? Math.max(0, parsedDuration) : 0
  const scenes = normalizeScenes(cleanData || {}, duration)
  const selectedIndex = Number.isFinite(Number(cleanData?.selectedSceneIndex)) ? Number(cleanData.selectedSceneIndex) : 0

  return {
    ...emptyDraft,
    ...(cleanData || {}),
    timingDraftVersion: cleanData?.timingDraftVersion || DRAFT_VERSION,
    audioName: cleanData?.audioName || cleanData?.audio_name || '',
    audioAssetId: repairedAudio.audioAssetId,
    audioApiPath: repairedAudio.audioApiPath,
    audioUrl: repairedAudio.audioUrl,
    audioSizeBytes: Number.isFinite(Number(cleanData?.audioSizeBytes)) ? Math.max(0, Number(cleanData.audioSizeBytes)) : Number(cleanData?.audio_size_bytes) || 0,
    audioDurationSec: duration,
    vocalAudioName: cleanData?.vocalAudioName || cleanData?.vocal_audio_name || '',
    vocalAudioAssetId: cleanData?.vocalAudioAssetId || cleanData?.vocal_audio_asset_id || '',
    vocalAudioApiPath: cleanData?.vocalAudioApiPath || cleanData?.vocal_audio_api_path || '',
    vocalAudioSizeBytes: Number(cleanData?.vocalAudioSizeBytes || cleanData?.vocal_audio_size_bytes || 0),
    vocalAudioDurationSec: Number(cleanData?.vocalAudioDurationSec || cleanData?.vocal_audio_duration_sec || 0),
    vocalOffsetSec: Number(cleanData?.vocalOffsetSec || cleanData?.vocal_offset_sec || 0),
    scenes,
    storyBlocks: Array.isArray(cleanData?.storyBlocks) ? cleanData.storyBlocks : [],
    roles: Array.isArray(cleanData?.roles) ? cleanData.roles : [],
    speechSegments: normalizeSpeechSegments(cleanData?.speechSegments || cleanData?.speech_segments || []),
    audioPhrases: Array.isArray(cleanData?.audioPhrases) ? cleanData.audioPhrases : Array.isArray(cleanData?.audio_phrases) ? cleanData.audio_phrases : [],
    missingSpeechHints: normalizeMissingSpeechHints(cleanData?.missingSpeechHints || cleanData?.missing_speech_hints || []),
    silentSegments: Array.isArray(cleanData?.silentSegments) ? cleanData.silentSegments : [],
    handoffSource: cleanData?.handoffSource || cleanData?.source || '',
    historySnapshots: Array.isArray(cleanData?.historySnapshots) ? cleanData.historySnapshots.slice(-MAX_UNDO) : [],
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

function sanitizeAudioDownloadName(value) {
  const clean = String(value || 'scene')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  return clean || 'scene'
}

function encodeAudioBufferSliceToWav(audioBuffer, startFrame, frameCount, channelCount = 1) {
  const safeChannelCount = Math.max(1, Math.min(channelCount || 1, audioBuffer.numberOfChannels || 1, 2))
  const safeFrameCount = Math.max(1, frameCount || 1)
  const bytesPerSample = 2
  const blockAlign = safeChannelCount * bytesPerSample
  const byteRate = audioBuffer.sampleRate * blockAlign
  const dataSize = safeFrameCount * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  function writeString(offset, text) {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, safeChannelCount, true)
  view.setUint32(24, audioBuffer.sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let frame = 0; frame < safeFrameCount; frame += 1) {
    const sourceFrame = startFrame + frame
    for (let channel = 0; channel < safeChannelCount; channel += 1) {
      const data = audioBuffer.getChannelData(Math.min(channel, audioBuffer.numberOfChannels - 1))
      const sample = Math.max(-1, Math.min(1, data[sourceFrame] || 0))
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      view.setInt16(offset, intSample, true)
      offset += 2
    }
  }

  return buffer
}

function stableHueFromBlockKey(value, fallbackIndex = 0) {
  const text = String(value || '').trim()
  if (!text) return sceneHue(fallbackIndex)
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i)
    hash |= 0
  }
  return 185 + (Math.abs(hash) % 150)
}

function sceneBlockHue(scene, fallbackIndex = 0) {
  const blockKey = String(
    scene?.blockId ??
    scene?.block_id ??
    scene?.semanticBlockId ??
    scene?.semantic_block_id ??
    scene?.blockTitle ??
    scene?.block_title ??
    ''
  ).trim()

  // Если сцена в блоке, цвет берётся от блока,
  // чтобы все сцены одного блока визуально совпадали.
  if (blockKey) {
    return stableHueFromBlockKey(`block:${blockKey}`, fallbackIndex)
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

  return sceneHue(fallbackIndex)
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

function normalizeMissingSpeechHints(items = []) {

  // AVA_TIMING_TO_BOARD_V16_RUNTIME_FIX_V34: fallback helpers for Timing -> Board confirm.
  // Prevents runtime crash when the V16 button exists but helper functions were not inserted.

  async function confirmTimingToBoardNavigateV16() {
    // AVA_TIMING_TO_BOARD_FORCE_SAVE_BEFORE_NAV_V36: make first transfer use the fresh Timing snapshot.
    await saveDraft(draft, 'timing_to_board_confirm_v36')
    const toPath = projectId ? `/app/projects/${projectId}/board` : '/app/workspace/board'
    try {
      if (typeof setShowTimingToBoardConfirmV16 === 'function') {
        setShowTimingToBoardConfirmV16(false)
      }
    } catch {}
    navigateWithWorkflowEntry(navigate, toPath, makeWorkflowEntry({
      from: 'manual_timing',
      to: 'board',
      fromPath: projectId ? `/app/projects/${projectId}/timing` : '/app/workspace/timing',
      toPath,
      projectId,
      source: 'manual_timing_to_board_confirmed_v16',
    }))
  }


  function cancelTimingToBoardConfirmV16() {
    try {
      if (typeof setShowTimingToBoardConfirmV16 === 'function') {
        setShowTimingToBoardConfirmV16(false)
      }
    } catch {}
    try {
      if (typeof setStatus === 'function') setStatus('Переход в Доску отменён. Тайминг оставлен без изменений.')
    } catch {}
  }


  function openTimingToBoardConfirmV16() {
    try {
      if (typeof setShowTimingToBoardConfirmV16 === 'function') {
        setShowTimingToBoardConfirmV16(true)
        try {
          if (typeof setStatus === 'function') setStatus('Подтверди перенос в Доску: старая Доска будет заменена свежим Таймингом.')
        } catch {}
        return
      }
    } catch {}
    // If the modal state was not added by an older partial patch, keep the app usable:
    // navigate with the confirmed source instead of crashing.
    confirmTimingToBoardNavigateV16()
  }

  return (Array.isArray(items) ? items : [])
    .map((item, index) => {
      const start = Number(item.start ?? item.start_sec ?? 0)
      const end = Number(item.end ?? item.end_sec ?? start)
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
      return {
        id: item.id || `missing_${String(index + 1).padStart(3, '0')}`,
        start,
        end,
        type: item.type || 'audio_activity_without_asr',
        label: item.label || 'проверь звук',
        reason: item.reason || '',
        status: item.status || 'needs_review',
      }
    })
    .filter(Boolean)
}

function normalizeSpeechSegments(inputSegments = []) {
  if (!Array.isArray(inputSegments)) return []
  return inputSegments
    .map((segment, index) => {
      const start = Number(segment.start ?? segment.start_sec ?? segment.t0 ?? segment.from ?? 0)
      const end = Number(segment.end ?? segment.end_sec ?? segment.t1 ?? segment.to ?? start)
      const roleId = String(segment.role_id || segment.roleId || segment.role || segment.speaker || segment.speaker_id || 'voice')
      const text = segment.text || segment.text_original || segment.originalText || segment.original_text || segment.transcript || ''
      const ruText = segment.ruText || segment.text_ru || segment.translation_ru || ''
      const meaningText = segment.meaningText || segment.meaning_hint_ru || segment.meaning_ru || ''
      return {
        id: segment.id || segment.segment_id || segment.phrase_id || `speech_${String(index + 1).padStart(3, '0')}`,
        phrase_id: segment.phrase_id || segment.id || segment.segment_id || '',
        start: Math.max(0, start),
        end: Math.max(start, end),
        roleId,
        role_id: roleId,
        label: segment.label || segment.role_label || '',
        text,
        originalText: segment.originalText || segment.original_text || segment.text_original || text,
        original_text: segment.original_text || segment.text_original || segment.originalText || text,
        text_original: segment.text_original || segment.original_text || segment.originalText || text,
        ruText,
        text_ru: segment.text_ru || ruText,
        translation_ru: segment.translation_ru || ruText,
        meaningText,
        meaning_hint_ru: segment.meaning_hint_ru || segment.meaning_ru || meaningText,
        words: Array.isArray(segment.words) ? segment.words : [],
        source: segment.source || 'import',
        language: segment.language || segment.source_language || '',
        source_language: segment.source_language || segment.language || '',
        confidence: segment.confidence,
        timingSource: segment.timingSource || segment.timing_source || (segment.phrase_id ? 'audio_phrases_gap_aware' : ''),
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

function compactText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function joinUniqueText(parts = []) {
  const seen = new Set()
  return parts
    .map((part) => compactText(part))
    .filter(Boolean)
    .filter((part) => {
      const key = part.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .join(' ')
}

function getWordText(word = {}) {
  return compactText(word.word || word.text || word.token || '')
}

function getWordStart(word = {}) {
  return Number(word.start ?? word.start_sec ?? word.t0 ?? 0)
}

function getWordEnd(word = {}) {
  const start = getWordStart(word)
  return Number(word.end ?? word.end_sec ?? word.t1 ?? start)
}

function clipSegmentTextToScene(scene, segment) {
  const sceneStart = Number(scene?.start || 0)
  const sceneEnd = Math.max(sceneStart, Number(scene?.end || sceneStart))
  const segStart = Number(segment?.start || 0)
  const segEnd = Math.max(segStart, Number(segment?.end || segStart))
  const overlap = Math.max(0, Math.min(sceneEnd, segEnd) - Math.max(sceneStart, segStart))
  const isPartial = overlap > 0.03 && (segStart < sceneStart - 0.035 || segEnd > sceneEnd + 0.035)
  const words = Array.isArray(segment?.words) ? segment.words : []
  const wordsInside = words.filter((word) => {
    const start = getWordStart(word)
    const end = getWordEnd(word)
    const mid = start + ((end - start) / 2)
    return mid >= sceneStart - 0.02 && mid <= sceneEnd + 0.02
  })
  const wordText = joinUniqueText(wordsInside.map(getWordText))
  return {
    text: wordText || (words.length ? '' : compactText(segment?.text || segment?.originalText || segment?.original_text || '')),
    ruText: compactText(segment?.ruText || segment?.text_ru || segment?.translation_ru || ''),
    meaningText: compactText(segment?.meaningText || segment?.meaning_hint_ru || segment?.meaning_ru || ''),
    isPartial,
    hasWords: words.length > 0,
    overlap,
  }
}

function buildSceneSpeechExport(scene, speechSegments = []) {
  const sceneItems = (Array.isArray(speechSegments) ? speechSegments : [])
    .filter((segment) => segmentsOverlap(scene.start, scene.end, segment.start, segment.end))
    .map((segment) => ({ segment, clipped: clipSegmentTextToScene(scene, segment) }))
    .filter((item) => item.clipped.overlap > 0.03)

  const sourcePhraseIds = sceneItems
    .map(({ segment }) => segment.phrase_id || segment.phraseId || segment.id)
    .filter(Boolean)

  const joinMeaningParts = (parts = []) => {
    const seen = new Set()
    return parts
      .map((part) => compactText(part))
      .filter(Boolean)
      .filter((part) => {
        const key = part.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .join(' • ')
  }

  const sceneWordText = joinUniqueText(sceneItems.map((item) => item.clipped.text))
  const phraseTranslationRu = joinUniqueText(sceneItems.map((item) => item.clipped.ruText))
  const phraseMeaningRu = joinMeaningParts(sceneItems.map((item) => item.clipped.meaningText))
  const phraseCutWarning = sceneItems.some((item) => item.clipped.isPartial)
  const storedBasis = compactText(scene?.asr_scene_word_text || '')
  const storedTranslationRu = compactText(scene?.translated_text_ru || scene?.translation_ru || scene?.text_ru || '')
  const storedMeaningRu = compactText(scene?.meaning_hint_ru || scene?.meaning_ru || scene?.meaningText || '')
  const canUseSceneSliceTranslation = Boolean(
    scene?.asr_scene_translation_source === 'scene_slice'
    && storedBasis
    && sceneWordText
    && storedBasis.toLowerCase() === sceneWordText.toLowerCase()
  )
  const sceneTranslatedTextRu = canUseSceneSliceTranslation && storedTranslationRu
    ? storedTranslationRu
    : (phraseCutWarning ? sceneWordText : (phraseTranslationRu || sceneWordText))
  const sceneMeaningHintRu = canUseSceneSliceTranslation && storedMeaningRu
    ? storedMeaningRu
    : (phraseCutWarning ? '' : phraseMeaningRu)

  return {
    source_phrase_ids: [...new Set(sourcePhraseIds)],
    scene_word_text: sceneWordText,
    lyrics_text: sceneWordText,
    translated_text_ru: sceneTranslatedTextRu,
    meaning_hint_ru: sceneMeaningHintRu,
    phrase_cut_warning: phraseCutWarning,
  }
}

function buildSceneDisplayText(scene = {}, speechExport = {}) {
  const sceneWordText = compactText(scene?.scene_word_text || scene?.lyrics_text || speechExport.scene_word_text || '')
  const translatedTextRu = compactText(scene?.translated_text_ru || scene?.translation_ru || scene?.text_ru || speechExport.translated_text_ru || '')
  const meaningHintRu = compactText(scene?.meaning_hint_ru || scene?.meaning_ru || scene?.meaningText || speechExport.meaning_hint_ru || '')
  const phraseCutWarning = Boolean(scene?.phrase_cut_warning || scene?.phraseCutWarning || speechExport.phrase_cut_warning)

  return {
    source_phrase_ids: speechExport.source_phrase_ids || scene?.source_phrase_ids || scene?.sourcePhraseIds || [],
    scene_word_text: sceneWordText,
    lyrics_text: sceneWordText,
    translated_text_ru: translatedTextRu,
    meaning_hint_ru: meaningHintRu,
    phrase_cut_warning: phraseCutWarning,
  }
}

function buildSceneTranslationItems(sceneList = [], speechSegments = []) {
  return (Array.isArray(sceneList) ? sceneList : [])
    .map((scene) => {
      const speechExport = buildSceneSpeechExport(scene, speechSegments)
      const text = compactText(speechExport.scene_word_text)
      if (!text) return null
      return {
        id: scene.id,
        phrase_id: scene.id,
        text,
        text_original: text,
        original_text: text,
        text_en: text,
        source_language: 'auto',
        language: 'auto',
      }
    })
    .filter(Boolean)
}

function applySceneSliceTranslations(sceneList = [], translatedItems = [], speechSegments = []) {
  const translatedById = new Map(
    (Array.isArray(translatedItems) ? translatedItems : [])
      .map((item) => [String(item.phrase_id || item.id || ''), item])
      .filter(([id]) => id)
  )

  return (Array.isArray(sceneList) ? sceneList : []).map((scene) => {
    const speechExport = buildSceneSpeechExport(scene, speechSegments)
    const translated = translatedById.get(String(scene.id))
    const translationRu = compactText(translated?.translation_ru || translated?.text_ru || translated?.ruText || '')
    const meaningRu = compactText(translated?.meaning_hint_ru || translated?.meaning_ru || translated?.meaningText || '')
    if (!translated || (!translationRu && !meaningRu)) return scene
    return {
      ...scene,
      asr_scene_translation_source: 'scene_slice',
      asr_scene_word_text: speechExport.scene_word_text,
      source_phrase_ids: speechExport.source_phrase_ids,
      scene_word_text: speechExport.scene_word_text,
      lyrics_text: speechExport.lyrics_text,
      translated_text_ru: translationRu || speechExport.translated_text_ru,
      meaning_hint_ru: meaningRu || speechExport.meaning_hint_ru,
      phrase_cut_warning: speechExport.phrase_cut_warning,
    }
  })
}

export default function ManualTimingPage() {
  const { projectId: routeProjectId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const manualTimingWorkflowEntry = useMemo(() => readWorkflowEntry('manual_timing', location.state), [location.state])
  const openedFromPodcast = manualTimingWorkflowEntry?.from === 'podcast'
  const { activeProject, loadStage, saveStage, loadWorkspaceStage, saveWorkspaceStage } = useProjects()
  const routeProjectIdClean = avaManualTimingIsRealProjectId(routeProjectId) ? String(routeProjectId || '').trim() : ''
  const activeProjectIdClean = avaManualTimingIsRealProjectId(activeProject?.id) ? String(activeProject.id || '').trim() : ''
  const projectId = routeProjectIdClean || activeProjectIdClean
  const workspaceMode = !projectId
  const [draft, setDraft] = useState(emptyDraft)
  const [history, setHistory] = useState([])
  const historyRef = useRef([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingVocal, setUploadingVocal] = useState(false)
  const [deletingSceneAudio, setDeletingSceneAudio] = useState(false)
  const [asrRunning, setAsrRunning] = useState(false)
  const [asrRunningMode, setAsrRunningMode] = useState('')
  const [translationRunning, setTranslationRunning] = useState(false)
  const [showSceneTranslator, setShowSceneTranslator] = useState(true)
  const [translationTtsPlayingId, setTranslationTtsPlayingId] = useState('')
  const [translatorPlayingId, setTranslatorPlayingId] = useState('')
  const [missingPhraseEditor, setMissingPhraseEditor] = useState(null)
  const [asrVisualOffsetSec, setAsrVisualOffsetSec] = useState(0)
  const [pendingAudioFile, setPendingAudioFile] = useState(null)
  const [showReplaceAudioConfirm, setShowReplaceAudioConfirm] = useState(false)
  const [showTimingToBoardConfirmV16, setShowTimingToBoardConfirmV16] = useState(false)
  const [showDev, setShowDev] = useState(false)
  const [blockSelection, setBlockSelection] = useState([])
  const [blockDraft, setBlockDraft] = useState({ title: '' })
  const [sceneEditor, setSceneEditor] = useState(null)
  const [playingMode, setPlayingMode] = useState(null)
  const [cursorSec, setCursorSec] = useState(0)
  const [audioSrc, setAudioSrc] = useState('')
  const audioRef = useRef(null)
  const translatorPreviewRangeRef = useRef(null)
  const scenePreviewRangeRef = useRef(null)
  const sceneStopTimerRef = useRef(null)
  const currentAudioScopeRef = useRef('')
  const fileInputRef = useRef(null)
  const jsonInputRef = useRef(null)
  const timelineScaleRef = useRef(null)
  const timelineContentRef = useRef(null)
  const segmentsRowRef = useRef(null)

  const hasAudio = Boolean(draft.audioAssetId || draft.audioApiPath || draft.audioUrl)
  const narratorAsrAssetId = avaStage118AsrAssetId(draft, false)
  const vocalAsrAssetId = avaStage118AsrAssetId(draft, true)
  const scenes = useMemo(() => normalizeScenes(draft, draft.audioDurationSec), [draft.scenes, draft.scenesCount, draft.audioDurationSec])
  const selectedScene = scenes[Math.min(draft.selectedSceneIndex, scenes.length - 1)] || scenes[0] || makeScene(0, 0, 0)
  const scopeTitle = workspaceMode ? 'Рабочая область' : activeProject?.name || 'Проект'
  const timelineDurationSec = Math.max(
    Number(draft.audioDurationSec) || 0,
    Number(cursorSec) || 0,
    ...scenes.map((scene) => Number(scene.end) || 0),
  )
  const cursorPct = timeToTimelinePct(cursorSec, timelineDurationSec)
  const roleMap = useMemo(() => new Map((draft.roles || []).map((role) => [role.roleId || role.id, role])), [draft.roles])
  function speechSegmentBelongsToScene(scene, segment) {
    const start = Number(segment?.start || 0)
    const end = Math.max(start, Number(segment?.end || start))
    const sceneStart = Number(scene?.start || 0)
    const sceneEnd = Math.max(sceneStart, Number(scene?.end || sceneStart))
    const mid = start + ((end - start) / 2)
    const pad = 0.035

    if (mid >= sceneStart + pad && mid < sceneEnd - pad) return true

    const overlap = Math.max(0, Math.min(sceneEnd, end) - Math.max(sceneStart, start))
    const duration = Math.max(0.001, end - start)
    return overlap / duration >= 0.62
  }

  const getSceneRoleLabels = (scene) => {
    const found = []
    const addLabel = (value) => {
      const label = normalizeRoleLabel(value || 'ДИК', 'ДИК')
      if (label && !found.includes(label)) found.push(label)
    }

    if (Array.isArray(scene?.roleLabels)) {
      scene.roleLabels.forEach(addLabel)
    }

    ;(draft.speechSegments || []).forEach((segment) => {
      if (!speechSegmentBelongsToScene(scene, segment) && !segmentsOverlap(scene.start, scene.end, segment.start, segment.end)) return
      const roleId = segment.roleId || segment.role_id || segment.role || segment.speaker || 'narrator'
      const role = roleMap.get(roleId)
      addLabel(role?.label || segment.label || segment.role_label || segment.role_name || roleId || 'ДИК')
    })

    return found.slice(0, 3)
  }

  const selectedSpeechSegments = useMemo(() => (
    (draft.speechSegments || []).filter((segment) => speechSegmentBelongsToScene(selectedScene, segment) || segmentsOverlap(selectedScene.start, selectedScene.end, segment.start, segment.end))
  ), [draft.speechSegments, selectedScene.start, selectedScene.end])

  const selectedSceneSpeechExport = useMemo(() => (
    buildSceneSpeechExport(selectedScene, draft.speechSegments || [])
  ), [selectedScene.start, selectedScene.end, draft.speechSegments])

  const selectedSceneDisplayText = useMemo(() => (
    buildSceneDisplayText(selectedScene, selectedSceneSpeechExport)
  ), [selectedScene, selectedSceneSpeechExport])

  function getSceneSelectionId(scene) {
    return String(scene?.id || scene?.scene_id || scene?.title || scene?.index || '')
  }

  function isSceneInBlockSelection(scene, selection = blockSelection) {
    const sceneId = getSceneSelectionId(scene)
    return selection.some((item) => String(item) === sceneId || Number(item) === Number(scene?.index))
  }

  function sortSceneSelectionIds(selection = []) {
    const selected = new Set(selection.map((item) => String(item)))
    return scenes
      .filter((scene) => selected.has(getSceneSelectionId(scene)) || selected.has(String(scene.index)))
      .map(getSceneSelectionId)
  }

  function getSelectedBlockScenes(selection = blockSelection) {
    return scenes.filter((scene) => isSceneInBlockSelection(scene, selection))
  }

  const selectedBlockSceneCount = getSelectedBlockScenes(blockSelection).length

  useEffect(() => {
    if (!isManualTimingPlayheadDiagEnabled()) return

    const timeline = timelineScaleRef.current
    const content = timelineContentRef.current
    const row = segmentsRowRef.current
    const duration = timelineDurationSec
    const contentWidth = content?.scrollWidth || content?.clientWidth || row?.scrollWidth || row?.clientWidth || timeline?.scrollWidth || timeline?.clientWidth || 0
    const viewportWidth = timeline?.clientWidth || 0
    const scrollLeft = timeline?.scrollLeft || 0
    const leftPadding = timeline ? (Number.parseFloat(window.getComputedStyle(timeline).paddingLeft) || 0) : 0
    const pxPerSecond = duration > 0 && contentWidth > 0 ? contentWidth / duration : 0
    const selectedSceneStart = Number(selectedScene?.start) || 0
    const selectedSceneEnd = Math.max(selectedSceneStart, Number(selectedScene?.end) || selectedSceneStart)

    console.log('[MT PLAYHEAD DIAG RENDER]', {
      currentTime: cursorSec,
      audioDuration: Number(draft.audioDurationSec) || 0,
      timelineDuration: duration,
      scrollLeft,
      viewportWidth,
      contentWidth,
      leftPadding,
      pxPerSecond,
      playheadLeftPx: timeToTimelinePct(cursorSec, duration) * contentWidth / 100,
      selectedSceneLeftPx: timeToTimelinePct(selectedSceneStart, duration) * contentWidth / 100,
      selectedSceneRightPx: timeToTimelinePct(selectedSceneEnd, duration) * contentWidth / 100,
      selectedSceneStart,
      selectedSceneEnd,
    })
  }, [cursorSec, draft.audioDurationSec, timelineDurationSec, selectedScene?.id, selectedScene?.start, selectedScene?.end])


  function getSceneTooltip(scene) {
    const phraseLines = (draft.speechSegments || [])
      .filter((segment) => speechSegmentBelongsToScene(scene, segment))
      .map((segment) => `${formatTime(segment.start, true)}-${formatTime(segment.end, true)} ${segment.text || ''}`.trim())

    const gapLines = asrGapSegments
      .filter((gap) => segmentsOverlap(scene.start, scene.end, gap.start, gap.end))
      .map((gap) => `${formatTime(gap.start, true)}-${formatTime(gap.end, true)} возможно есть нераспознанная фраза`)

    const lines = [
      `${scene.title || scene.id}: ${formatTime(scene.start, true)} → ${formatTime(scene.end, true)}`,
      scene.route && scene.route !== 'auto' ? `route: ${scene.route}` : '',
      scene.blockTitle ? `блок: ${scene.blockTitle}` : '',
      scene.note ? `памятка: ${scene.note}` : '',
      phraseLines.length ? `ASR:\n${phraseLines.join('\n')}` : '',
      gapLines.length ? `Проверить:\n${gapLines.join('\n')}` : '',
    ].filter(Boolean)

    return lines.join('\n')
  }

  const asrGapSegments = useMemo(() => {
    const segments = [...(draft.speechSegments || [])]
      .filter((segment) => Number.isFinite(Number(segment.start)) && Number.isFinite(Number(segment.end)))
      .sort((a, b) => Number(a.start) - Number(b.start))

    if (!segments.length || !draft.audioDurationSec) return []

    const gaps = []
    const minGapSec = 0.65
    const maxGapSec = 18
    const introGuardSec = 3
    const outroGuardSec = 2

    for (let index = 0; index < segments.length - 1; index += 1) {
      const currentEnd = Number(segments[index].end || 0)
      const nextStart = Number(segments[index + 1].start || 0)
      const gap = nextStart - currentEnd
      if (gap >= minGapSec && gap <= maxGapSec) {
        gaps.push({
          id: `asr_gap_${index + 1}`,
          start: currentEnd,
          end: nextStart,
          type: 'possible_phrase_gap',
          label: 'проверь',
        })
      }
    }

    const firstStart = Number(segments[0]?.start || 0)
    if (firstStart >= 4 && firstStart <= maxGapSec && firstStart > introGuardSec) {
      gaps.unshift({
        id: 'asr_gap_intro',
        start: 0,
        end: firstStart,
        type: 'possible_intro_phrase_gap',
        label: 'проверь начало',
      })
    }

    const lastEnd = Number(segments[segments.length - 1]?.end || 0)
    const tailGap = Number(draft.audioDurationSec || 0) - lastEnd
    if (tailGap >= minGapSec && tailGap <= maxGapSec && tailGap > outroGuardSec) {
      gaps.push({
        id: 'asr_gap_tail',
        start: lastEnd,
        end: Number(draft.audioDurationSec || 0),
        type: 'possible_tail_phrase_gap',
        label: 'проверь хвост',
      })
    }
    const draftMissingHints = normalizeMissingSpeechHints(draft.missingSpeechHints || [])
    draftMissingHints.forEach((hint) => {
      gaps.push({
        ...hint,
        id: hint.id || `missing_${gaps.length + 1}`,
        label: hint.label || 'проверь звук',
        type: hint.type || 'audio_activity_without_asr',
      })
    })

    return gaps

  }, [draft.speechSegments, draft.audioDurationSec])

  useEffect(() => {
    let active = true
    async function loadDraft() {
      setLoading(true)
      setStatus('загрузка snapshot…')
      try {
        if (isWorkflowStageCleared('manual_timing')) {
          if (!active) return
          historyRef.current = []
          setDraft(emptyDraft)
          setHistory([])
          setBlockSelection([])
          setBlockDraft({ title: '' })
          setSceneEditor(null)
          setCursorSec(0)
          setAudioSrc('')
          setStatus('Тайминг очищен. Загрузи новое аудио или импортируй JSON.')
          setLoading(false)
          return
        }

        const data = workspaceMode ? await loadWorkspaceStage(STAGE) : await loadStage(projectId, STAGE)
        if (!active) return
        let incomingPodcastProject = null
        try {
          const rawPodcastReturn =
            sessionStorage.getItem("ava_manual_timing_podcast_return")
            || localStorage.getItem("ava_manual_timing_podcast_return")
            || sessionStorage.getItem(AVA_PODCAST_TO_TIMING_KEY_STAGE95)
            || localStorage.getItem(AVA_PODCAST_TO_TIMING_KEY_STAGE95)

          incomingPodcastProject = rawPodcastReturn ? JSON.parse(rawPodcastReturn) : null
          if (rawPodcastReturn) {
            sessionStorage.removeItem("ava_manual_timing_podcast_return")
            localStorage.removeItem("ava_manual_timing_podcast_return")
            sessionStorage.removeItem(AVA_PODCAST_TO_TIMING_KEY_STAGE95)
            localStorage.removeItem(AVA_PODCAST_TO_TIMING_KEY_STAGE95)
          }
        } catch {
          incomingPodcastProject = null
        }

        const hasPodcastHandoff = Boolean(incomingPodcastProject?.audio || incomingPodcastProject?.finalAudio || incomingPodcastProject?.final_audio)
        if (hasPodcastHandoff) {
          clearWorkflowStageClearedMarker('manual_timing')
          rememberWorkflowEntry(makeWorkflowEntry({
            from: 'podcast',
            to: 'manual_timing',
            fromPath: projectId ? `/app/projects/${projectId}/podcast` : '/app/workspace/podcast',
            toPath: projectId ? `/app/projects/${projectId}/timing` : '/app/workspace/timing',
            projectId,
            source: 'podcast_to_manual_timing_handoff',
          }))
        }
        let normalized = hasPodcastHandoff
          ? avaStage95DraftFromPodcastHandoff(avaStage110ForcePodcastBlockScenes(incomingPodcastProject))
          : normalizeDraft(data)

        if (hasPodcastHandoff) {
          try {
            if (workspaceMode) {
              await saveWorkspaceStage(STAGE, { ...normalized, updatedAt: new Date().toISOString(), saveReason: 'podcast_handoff_replace_timing' })
              await saveWorkspaceStage('board', avaStage95EmptyBoardSnapshot())
            } else {
              await saveStage(projectId, STAGE, { ...normalized, updatedAt: new Date().toISOString(), saveReason: 'podcast_handoff_replace_timing' }, 'replace')
              await saveStage(projectId, 'board', avaStage95EmptyBoardSnapshot(), 'replace')
            }
            avaStage95ClearAssemblyState(projectId || '')
          } catch (saveError) {
            console.warn('[MANUAL TIMING PODCAST HANDOFF SAVE/CLEAR FAILED]', saveError)
          }
        }

        const loadedHistory = hasPodcastHandoff ? [] : (Array.isArray(normalized.historySnapshots) ? normalized.historySnapshots : [])
        historyRef.current = loadedHistory
        setDraft(normalized)
        setHistory(loadedHistory)
        setBlockSelection([])
        setBlockDraft({ title: '' })
        setSceneEditor(null)
        setCursorSec(normalized.scenes?.[normalized.selectedSceneIndex]?.start || 0)
        setStatus(hasPodcastHandoff ? 'получено новое аудио из Podcast: Timing заменён, Board/Монтаж очищены' : 'snapshot загружен')
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
      const nextAudioScope = [
        draft.audioAssetId || '',
        draft.audioApiPath || '',
        draft.audioUrl || draft.asset_url || '',
      ].join('|')
      if (currentAudioScopeRef.current !== nextAudioScope) {
        currentAudioScopeRef.current = nextAudioScope
        clearSceneStopTimer()
        scenePreviewRangeRef.current = null
        translatorPreviewRangeRef.current = null
        setTranslatorPlayingId('')
        setPlayingMode(null)
        const audio = audioRef.current
        if (audio) {
          audio.pause()
          audio.removeAttribute('src')
          audio.load()
        }
      }
      setAudioSrc('')

      const directUrl = String(draft.audioUrl || draft.asset_url || '').trim()
      const protectedApiPath = String(draft.audioApiPath || '').trim() || avaStage116AssetApiPathFromUrl(directUrl)

      if (!protectedApiPath && !directUrl) return

      try {
        if (protectedApiPath) {
          objectUrl = await fetchProtectedBlobUrl(protectedApiPath)
          if (!cancelled) setAudioSrc(objectUrl)
          return
        }

        const previewUrl = avaStage95AudioUrlToPreview(directUrl)
        if (!cancelled) setAudioSrc(previewUrl)
      } catch (err) {
        // Do not fall back to /api/assets direct URL: <audio> cannot send Authorization,
        // and that causes 401/no playback. Only fall back to public/static urls.
        const previewUrl = avaStage95AudioUrlToPreview(directUrl)
        const isProtectedDirect = avaStage116ShouldAuthFetch(previewUrl)
        if (previewUrl && !isProtectedDirect) {
          if (!cancelled) setAudioSrc(previewUrl)
          return
        }
        if (!cancelled) setStatus(`ошибка аудио: ${err.message}`)
      }
    }

    loadAudioBlob()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [draft.audioApiPath, draft.audioUrl, draft.asset_url])



  useEffect(() => {
    return () => {
      clearSceneStopTimer()
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

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
      if (!quiet) {
        setDraft(payload)
        setStatus('сохранено')
      }
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
      translatorPreviewRangeRef.current = null
      setTranslatorPlayingId('')
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

      if (playingMode === 'translator' && translatorPreviewRangeRef.current) {
        const range = translatorPreviewRangeRef.current
        if (current >= range.end - 0.01) {
          audio.pause()
          audio.currentTime = range.end
          setCursorSec(range.end)
          translatorPreviewRangeRef.current = null
          setTranslatorPlayingId('')
          setPlayingMode(null)
          return
        }
      }

      const sceneRange = scenePreviewRangeRef.current || selectedScene
      if (playingMode === 'scene' && sceneRange && current >= Number(sceneRange.end || 0) - 0.015) {
        clearSceneStopTimer()
        const stopAt = clampCursor(Number(sceneRange.end || current), draft.audioDurationSec)
        audio.pause()
        audio.currentTime = stopAt
        scenePreviewRangeRef.current = null
        setCursorSec(stopAt)
        setPlayingMode(null)
        return
      }

      setCursorSec(current)
      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [playingMode, selectedScene?.start, selectedScene?.end])

  function clearSceneStopTimer() {
    if (sceneStopTimerRef.current) {
      window.clearTimeout(sceneStopTimerRef.current)
      sceneStopTimerRef.current = null
    }
  }

  function stopAudio(nextCursor = cursorSec) {
    clearSceneStopTimer()
    scenePreviewRangeRef.current = null
    const next = clampCursor(nextCursor, draft.audioDurationSec)
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = next
    }
    setCursorSec(next)
    translatorPreviewRangeRef.current = null
    setTranslatorPlayingId('')
    setPlayingMode(null)
  }



  function getTranslationTtsText(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function pickRussianSpeechVoice() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null
    const voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : []
    if (!Array.isArray(voices) || !voices.length) return null
    const ruVoices = voices.filter((voice) => String(voice.lang || '').toLowerCase().startsWith('ru'))
  
  function openTimingToBoardConfirmV16() {
    // AVA_TIMING_TO_BOARD_CONFIRM_ON_TIMING_V16:
    // Ask while user is still in Timing. Board must not show this dialog later on reload.
    setShowTimingToBoardConfirmV16(true)
    setStatus('Подтверди перенос в Доску: старая Доска будет заменена свежим Таймингом.')
  }

  function cancelTimingToBoardConfirmV16() {
    setShowTimingToBoardConfirmV16(false)
    setStatus('Переход в Доску отменён. Тайминг оставлен без изменений.')
  }

  async function confirmTimingToBoardNavigateV16() {
    // AVA_TIMING_TO_BOARD_FORCE_SAVE_BEFORE_NAV_V36: make first transfer use the fresh Timing snapshot.
    await saveDraft(draft, 'timing_to_board_confirm_v36')
    const toPath = projectId ? `/app/projects/${projectId}/board` : '/app/workspace/board'
    setShowTimingToBoardConfirmV16(false)
    navigateWithWorkflowEntry(navigate, toPath, makeWorkflowEntry({
      from: 'manual_timing',
      to: 'board',
      fromPath: projectId ? `/app/projects/${projectId}/timing` : '/app/workspace/timing',
      toPath,
      projectId,
      source: 'manual_timing_to_board_confirmed_v16',
    }))
  }

  return (
      ruVoices.find((voice) => /google/i.test(voice.name || ''))
      || ruVoices.find((voice) => /microsoft|irina|pavel/i.test(voice.name || ''))
      || ruVoices[0]
      || voices.find((voice) => /google/i.test(voice.name || ''))
      || voices[0]
      || null
    )
  }

  function stopTranslationTts() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    setTranslationTtsPlayingId('')
  }

  function speakTranslationText(text, ttsId) {
    const clean = getTranslationTtsText(text)
    if (!clean) {
      setStatus('сначала нужен русский текст для выбранной кнопки')
      return
    }
    if (typeof window === 'undefined' || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance === 'undefined') {
      setStatus('браузерная озвучка недоступна в этом браузере')
      return
    }

    const id = String(ttsId || clean.slice(0, 24))
    if (translationTtsPlayingId === id) {
      stopTranslationTts()
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new window.SpeechSynthesisUtterance(clean)
    utterance.lang = 'ru-RU'
    utterance.rate = 0.92
    utterance.pitch = 1
    utterance.volume = 1
    const voice = pickRussianSpeechVoice()
    if (voice) utterance.voice = voice

    utterance.onend = () => setTranslationTtsPlayingId('')
    utterance.onerror = () => {
      setTranslationTtsPlayingId('')
      setStatus('браузер не смог озвучить перевод')
    }

    setTranslationTtsPlayingId(id)
    window.speechSynthesis.speak(utterance)
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
    const sceneStart = Number(nextScene?.start) || 0
    const sceneEnd = Math.max(sceneStart, Number(nextScene?.end) || sceneStart)
    const audioCurrentTimeBefore = audioRef.current ? audioRef.current.currentTime : null
    stopAudio(sceneStart)
    stopTranslationTts()
    setDraft((prev) => normalizeDraft({ ...prev, selectedSceneIndex: sceneIndex }))
    logManualTimingPlayheadDiag('[MT PLAYHEAD DIAG SELECT]', {
      sceneId: nextScene?.id || nextScene?.title || sceneIndex,
      sceneStart,
      sceneEnd,
      selectedSceneStart: sceneStart,
      audioCurrentTimeBefore,
      audioCurrentTimeAfter: audioRef.current ? audioRef.current.currentTime : sceneStart,
      shouldSeekOnSelect: true,
    })
  }

  function handleSceneClick(event, sceneIndex) {
    // handleSceneClick render guard
    if (!event || typeof event.stopPropagation !== 'function') {
      return (nextEvent) => handleSceneClick(nextEvent, sceneIndex)
    }

    event?.stopPropagation?.()
    if (event?.ctrlKey || event?.metaKey) {
      const nextScene = scenes[Math.min(sceneIndex, scenes.length - 1)] || scenes[0]
      const sceneStart = Number(nextScene?.start) || 0
      logManualTimingPlayheadDiag('[MT PLAYHEAD DIAG SELECT]', {
        sceneId: nextScene?.id || nextScene?.title || sceneIndex,
        sceneStart,
        sceneEnd: Math.max(sceneStart, Number(nextScene?.end) || sceneStart),
        selectedSceneStart: Number(selectedScene?.start) || 0,
        audioCurrentTimeBefore: audioRef.current ? audioRef.current.currentTime : null,
        audioCurrentTimeAfter: audioRef.current ? audioRef.current.currentTime : null,
        shouldSeekOnSelect: false,
      })
      toggleBlockScene(sceneIndex, event)
      return
    }
    selectScene(sceneIndex)
  }

  function seekTimeline(event) {
    if (!hasAudio || timelineDurationSec <= 0) return
    if (event.target.closest('button')) return
    const content = timelineContentRef.current || event.currentTarget
    const rect = content.getBoundingClientRect()
    const x = event.clientX - rect.left
    const totalWidth = content.scrollWidth || rect.width
    const at = clampCursor((x / totalWidth) * timelineDurationSec, timelineDurationSec)
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


  function shiftTimingItemAfterDeletedRange(item, start, end, delta) {
    const itemStart = Number(item?.start ?? item?.start_sec ?? item?.t0 ?? 0)
    const itemEnd = Math.max(itemStart, Number(item?.end ?? item?.end_sec ?? item?.t1 ?? itemStart))
    if (itemEnd <= start + 0.001) return item
    if (itemStart >= end - 0.001) {
      const nextStart = Math.max(0, itemStart - delta)
      const nextEnd = Math.max(nextStart, itemEnd - delta)
      return {
        ...item,
        start: Number(nextStart.toFixed(3)),
        end: Number(nextEnd.toFixed(3)),
        start_sec: item.start_sec !== undefined ? Number(nextStart.toFixed(3)) : item.start_sec,
        end_sec: item.end_sec !== undefined ? Number(nextEnd.toFixed(3)) : item.end_sec,
        t0: item.t0 !== undefined ? Number(nextStart.toFixed(3)) : item.t0,
        t1: item.t1 !== undefined ? Number(nextEnd.toFixed(3)) : item.t1,
      }
    }
    return null
  }

  function shiftTimingListAfterDeletedRange(items = [], start, end, delta) {
    if (!Array.isArray(items)) return []
    return items
      .map((item) => shiftTimingItemAfterDeletedRange(item, start, end, delta))
      .filter(Boolean)
  }

  async function deleteSelectedSceneFromAudio() {
    if (!hasAudio || draft.audioDurationSec <= 0) {
      setStatus('сначала загрузите аудио')
      return
    }

    const index = Math.min(draft.selectedSceneIndex, scenes.length - 1)
    const scene = scenes[index]
    if (!scene) {
      setStatus('выберите сцену для удаления')
      return
    }

    const start = Math.max(0, Number(scene.start || 0))
    const end = Math.min(Number(draft.audioDurationSec || 0), Math.max(start, Number(scene.end || start)))
    const cutLen = end - start
    if (cutLen <= 0.03) {
      setStatus('выбранный отрезок слишком короткий для удаления')
      return
    }

    const nextDuration = Math.max(0, Number(draft.audioDurationSec || 0) - cutLen)
    if (nextDuration < MIN_SCENE_SEC) {
      setStatus('нельзя удалить весь аудиофайл')
      return
    }

    const repairedAudio = repairManualTimingAudioAssetFields(draft)
    if (!repairedAudio.audioAssetId && !repairedAudio.audioApiPath && !repairedAudio.audioUrl) {
      setStatus('нет assetId/audioApiPath для серверного удаления')
      return
    }
    if (!repairedAudio.audioAssetId) {
      console.warn('[AUDIO CUT BLOCKED MISSING_ASSET_ID]', repairedAudio)
      setStatus('нет audio asset_id для удаления: заново передайте audio из Podcast или загрузите файл')
      return
    }
    if (
      repairedAudio.audioAssetId !== draft.audioAssetId ||
      repairedAudio.audioApiPath !== draft.audioApiPath ||
      repairedAudio.audioUrl !== draft.audioUrl
    ) {
      setDraft((prev) => normalizeDraft({ ...prev, ...repairedAudio }))
    }

    setDeletingSceneAudio(true)
    setStatus(`удаляю из аудио: ${formatTime(start, true)} → ${formatTime(end, true)}`)

    try {
      const result = await cutAudioAssetRange({
        assetId: repairedAudio.audioAssetId,
        assetApiPath: repairedAudio.audioApiPath,
        audioUrl: repairedAudio.audioUrl,
        projectId: workspaceMode ? null : projectId,
        stage: STAGE,
        startSec: start,
        endSec: end,
        durationSec: draft.audioDurationSec,
        label: scene.title || scene.id || '',
      })

      const shiftedScenes = scenes
        .map((item, itemIndex) => {
          if (itemIndex === index) return null
          if (Number(item.end || 0) <= start + 0.001) return item
          if (Number(item.start || 0) >= end - 0.001) {
            return {
              ...item,
              start: Math.max(0, Number((Number(item.start || 0) - cutLen).toFixed(3))),
              end: Math.max(0, Number((Number(item.end || 0) - cutLen).toFixed(3))),
            }
          }
          return null
        })
        .filter(Boolean)

      const nextScenes = shiftedScenes.length
        ? renumberScenes(shiftedScenes)
        : makeSingleScene(result.new_duration_sec || nextDuration)

      pushHistorySnapshot()
      const selectedIndex = Math.min(index, nextScenes.length - 1)
      const nextDraft = normalizeDraft({
        ...draft,
        audioName: result.audio_name || result.audioName || draft.audioName,
        audioAssetId: result.asset_id || result.assetId || '',
        audioApiPath: result.asset_api_path || result.assetApiPath || '',
        audioUrl: result.asset_url || result.assetUrl || '',
        audioSizeBytes: result.audio_size_bytes || result.audioSizeBytes || 0,
        audioDurationSec: Number(result.audio_duration_sec || result.audioDurationSec || result.new_duration_sec || nextDuration),
        scenes: nextScenes,
        scenesCount: nextScenes.length,
        selectedSceneIndex: selectedIndex,
        speechSegments: shiftTimingListAfterDeletedRange(draft.speechSegments || [], start, end, cutLen),
        audioPhrases: shiftTimingListAfterDeletedRange(draft.audioPhrases || [], start, end, cutLen),
        missingSpeechHints: shiftTimingListAfterDeletedRange(draft.missingSpeechHints || [], start, end, cutLen),
        silentSegments: shiftTimingListAfterDeletedRange(draft.silentSegments || [], start, end, cutLen),
      })

      stopAudio(nextScenes[selectedIndex]?.start || 0)
      setDraft(nextDraft)
      await saveDraft(nextDraft, 'delete_selected_audio_range')
      setBlockSelection([])
      setStatus(`отрезок удалён из аудио: -${formatTime(cutLen, true)} · новая длительность ${formatTime(nextDraft.audioDurationSec, true)}`)
    } catch (err) {
      console.error('[ManualTiming] delete selected scene from audio failed', err)
      setStatus(`ошибка удаления аудио: ${err.message}`)
    } finally {
      setDeletingSceneAudio(false)
    }
  }



  async function saveCurrentTimingAudio() {
    if (!hasAudio) {
      setStatus('сначала загрузите аудио')
      return
    }

    const filename = avaStage16SafeAudioFilename(
      draft.audioName ||
      draft.audio_name ||
      draft.filename ||
      draft.name ||
      'ava_timing_audio.mp3'
    )

    const repairedAudio = repairManualTimingAudioAssetFields(draft)
    const source = String(
      repairedAudio.audioApiPath ||
      repairedAudio.audioUrl ||
      draft.audio_api_path ||
      draft.audio_url ||
      draft.assetUrl ||
      draft.asset_url ||
      draft.url ||
      ''
    ).trim()

    if (!source) {
      setStatus('не найден путь к текущему аудио')
      return
    }

    try {
      setStatus('сохраняю текущее аудио…')
      await avaStage16DownloadAudioSource({
        source,
        filename,
        fetchProtectedBlobUrl,
        getAuthHeaders,
        setStatus,
      })
    } catch (error) {
      console.error('[ManualTiming] save current audio failed', error)
      setStatus(`не удалось сохранить аудио: ${error?.message || 'ошибка'}`)
    }
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

  function toggleBlockScene(sceneIndex, event = null) {
    const scene = scenes[Math.min(sceneIndex, scenes.length - 1)]
    if (!scene) return
    const sceneId = getSceneSelectionId(scene)
    const beforeSelectedIds = sortSceneSelectionIds(blockSelection)
    stopAudio(scene.start)
    setDraft((prev) => normalizeDraft({ ...prev, selectedSceneIndex: sceneIndex }))
    setBlockDraft((prev) => ({ title: prev.title || scene.blockTitle || '' }))
    setBlockSelection((items) => {
      const exists = items.some((item) => String(item) === sceneId || Number(item) === Number(scene.index))
      const nextRaw = exists
        ? items.filter((item) => String(item) !== sceneId && Number(item) !== Number(scene.index))
        : [...items, sceneId]
      const next = sortSceneSelectionIds(nextRaw)
      setStatus(next.length ? `выбрано сцен для блока: ${next.length}` : 'выбор блока очищен')
      logManualTimingBlockDiag('[MT BLOCK DIAG CTRL_CLICK]', {
        sceneId,
        ctrlKey: Boolean(event?.ctrlKey),
        metaKey: Boolean(event?.metaKey),
        beforeSelectedIds,
        afterSelectedIds: next,
        selectedSceneId: sceneId,
      })
      return next
    })
  }

  function markSemanticBlock() {
    const index = Math.min(draft.selectedSceneIndex, scenes.length - 1)
    const fallbackScene = scenes[index] || selectedScene
    const fallbackId = getSceneSelectionId(fallbackScene)
    const currentSelection = sortSceneSelectionIds(blockSelection)
    logManualTimingBlockDiag('[MT BLOCK DIAG OPEN]', {
      selectedSceneId: fallbackId,
      semanticBlockSelectedSceneIds: currentSelection,
      countUsedForBlock: currentSelection.length || (fallbackId ? 1 : 0),
    })
    setBlockSelection((items) => {
      const next = sortSceneSelectionIds(items.length ? items : [fallbackId])
      setStatus(`выбрано сцен для блока: ${next.length}`)
      return next
    })
    setBlockDraft((prev) => ({ title: prev.title || selectedScene.blockTitle || '' }))
  }

  function applyStoryBlock() {
    const selectedScenesForBlock = getSelectedBlockScenes(blockSelection)
    if (!selectedScenesForBlock.length) {
      setStatus('выберите сцены через Ctrl+клик')
      return
    }
    const existingBlocks = Array.isArray(draft.storyBlocks) ? draft.storyBlocks : []
    const title = (blockDraft.title || '').trim() || `Блок ${existingBlocks.length + 1}`
    const blockId = `block_${Date.now().toString(36)}`
    const blockColor = sceneHue(existingBlocks.length + 8)
    const selectedIds = selectedScenesForBlock.map(getSceneSelectionId)
    const selectedSet = new Set(selectedIds)
    const nextScenes = scenes.map((scene) => (
      selectedSet.has(getSceneSelectionId(scene))
        ? { ...scene, semanticBlock: true, blockId, blockTitle: title, blockColor }
        : scene
    ))
    const selectedScenes = nextScenes.filter((scene) => selectedSet.has(getSceneSelectionId(scene)))
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
    logManualTimingBlockDiag('[MT BLOCK DIAG SAVE]', {
      blockId,
      title,
      sceneIds: selectedScenes.map((scene) => scene.id),
      color: blockColor,
    })
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
    clearWorkflowStageClearedMarker('manual_timing')
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
    setStatus('загрузка аудио… если это видео, сервер извлечёт MP3')
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
        audioPhrases: [],
        missingSpeechHints: [],
        silentSegments: [],
        vocalAudioName: '',
        vocalAudioAssetId: '',
        vocalAudioApiPath: '',
        vocalAudioSizeBytes: 0,
        vocalAudioDurationSec: 0,
        vocalOffsetSec: 0,
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
      setStatus(result.converted_from_video ? 'видео загружено, аудио извлечено в MP3' : 'аудио загружено')
    } catch (err) {
      setStatus(`ошибка загрузки аудио: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }


  async function clearAsrSegments(message = 'ASR очищен') {
    const nextDraft = normalizeDraft({
      ...draft,
      roles: [],
      speechSegments: [],
      audioPhrases: [],
      missingSpeechHints: [],
      handoffSource: '',
      asrMode: '',
      asrSource: '',
    })
    setDraft(nextDraft)
    await saveDraft(nextDraft, 'asr_clear_manual')
    setStatus(message)
  }

  function isAsrIntroHallucination(segment) {
    const text = String(segment?.text || '').toLowerCase()
    const start = Number(segment?.start || 0)
    if (start > 6) return false
    return (
      text.includes('добро пожаловать') ||
      text.includes('наш канал') ||
      text.includes('подписывай') ||
      text.includes('ставьте лайк') ||
      text.includes('thanks for watching') ||
      text.includes('subscribe')
    )
  }

  async function runVocalStemAsrExact() {
    setAsrRunningMode('vocal')
    const sourceDraft = draft
    const vocalAssetId = sourceDraft.vocalAudioAssetId || sourceDraft.vocal_audio_asset_id || ''
    console.log('[AVA VOCAL ASR] click', { vocalAssetId, vocalAudioName: sourceDraft.vocalAudioName })

    if (!vocalAssetId) {
      setStatus('сначала загрузите vocal stem')
      return
    }

    setAsrRunning(true)
    setStatus('ASR vocal stem: speech + VAD…')
    try {
      const clearedDraft = normalizeDraft({
        ...sourceDraft,
        roles: [],
        speechSegments: [],
        audioPhrases: [],
        missingSpeechHints: [],
        handoffSource: '',
        asrMode: '',
        asrSource: '',
      })
      setDraft(clearedDraft)
      await saveDraft(clearedDraft, 'asr_clear_before_vocal_exact')

      const result = await transcribeAudioAsset({
        assetId: vocalAssetId,
        projectId: projectId || activeProject?.id || null,
        roleId: 'vocal',
        roleLabel: 'ВОК',
        mode: 'vocal',
        vadFilter: true,
        language: 'ru',
      })

      const rawSegments = result.speechSegments || result.speech_segments || []
      const nextSegments = rawSegments
        .filter((segment) => !isAsrIntroHallucination(segment))
        .map((segment, index) => ({
          ...segment,
          id: `asr_${String(index + 1).padStart(3, '0')}`,
          roleId: 'vocal',
          role_id: 'vocal',
          label: 'ВОК',
          source: 'asr_vocal_stem',
          asrMode: 'vocal',
        }))

      const nextDraft = normalizeDraft({
        ...sourceDraft,
        roles: [{
          roleId: 'vocal',
          id: 'vocal',
          name: 'Вокал',
          label: 'ВОК',
          color: 42,
        }],
        speechSegments: nextSegments,
        audioPhrases: Array.isArray(result.audio_phrases) ? result.audio_phrases : [],
        missingSpeechHints: normalizeMissingSpeechHints(result.missingSpeechHints || result.missing_speech_hints || []),
        handoffSource: 'asr_vocal_stem',
        asrMode: 'vocal',
        asrSource: 'vocal_stem',
      })

      setDraft(nextDraft)
      await saveDraft(nextDraft, 'asr_vocal_stem_exact')
      setStatus(`ASR vocal stem готово: ${nextSegments.length} фраз · word timestamps`)
    } catch (err) {
      setStatus(`ошибка ASR vocal stem: ${err.message}`)
    } finally {
      setAsrRunning(false)
    setAsrRunningMode('')
    }
  }

  function getDefaultSpeechRole() {
    const roles = Array.isArray(draft.roles) ? draft.roles : []
    const vocal = roles.find((role) => (role.roleId || role.id) === 'vocal' || role.label === 'ВОК')
    const narrator = roles.find((role) => (role.roleId || role.id) === 'narrator' || role.label === 'ДИК')
    const role = vocal || narrator || roles[0] || { roleId: 'vocal', id: 'vocal', label: 'ВОК', name: 'Вокал', color: 42 }
    return {
      roleId: role.roleId || role.id || 'vocal',
      label: role.label || normalizeRoleLabel(role.roleId || role.id || 'vocal'),
      name: role.name || role.label || 'Вокал',
      color: role.color || 42,
    }
  }

  function openMissingPhraseEditor(gap) {
    const role = getDefaultSpeechRole()
    stopAudio(gap.start || 0)
    setCursorSec(gap.start || 0)
    setMissingPhraseEditor({
      id: gap.id || `missing_${Date.now()}`,
      start: Number(gap.start || 0),
      end: Number(gap.end || Math.min((gap.start || 0) + 1.2, draft.audioDurationSec || 0)),
      text: '',
      roleId: role.roleId,
      label: role.label,
      status: 'draft',
    })
    setStatus('проверь оранжевую зону: можно дописать фразу вручную')
  }

  async function saveManualMissingPhrase() {
    const editor = missingPhraseEditor
    if (!editor) return

    const textValue = String(editor.text || '').trim()
    if (!textValue) {
      setStatus('напиши текст фразы перед сохранением')
      return
    }

    const duration = Number(draft.audioDurationSec || 0)
    const start = Math.max(0, Number(editor.start || 0))
    const end = Math.max(start + 0.08, Number(editor.end || start + 1.2))
    const safeEnd = duration > 0 ? Math.min(duration, end) : end
    const roleId = editor.roleId || 'vocal'
    const selectedRole = (draft.roles || []).find((role) => (role.roleId || role.id) === roleId)
    const label = selectedRole?.label || editor.label || normalizeRoleLabel(roleId)

    const existingRoles = Array.isArray(draft.roles) ? draft.roles : []
    const hasRole = existingRoles.some((role) => (role.roleId || role.id) === roleId)
    const roles = hasRole
      ? existingRoles
      : [
          ...existingRoles,
          {
            roleId,
            id: roleId,
            name: label === 'ВОК' ? 'Вокал' : label === 'ДИК' ? 'Диктор' : label,
            label,
            color: roleId === 'vocal' ? 42 : 220,
          },
        ]

    const manualSegment = {
      id: `manual_${Date.now()}`,
      start: Number(start.toFixed(3)),
      end: Number(safeEnd.toFixed(3)),
      roleId,
      role_id: roleId,
      label,
      text: textValue,
      ruText: '',
      source: 'manual_missing_phrase',
      asrMode: draft.asrMode || 'manual',
      manual: true,
      needsReview: false,
    }

    const speechSegments = [
      ...(draft.speechSegments || []),
      manualSegment,
    ].sort((a, b) => Number(a.start || 0) - Number(b.start || 0))

    const nextDraft = normalizeDraft({
      ...draft,
      roles,
      speechSegments,
    })

    setDraft(nextDraft)
    setMissingPhraseEditor(null)
    await saveDraft(nextDraft, 'manual_missing_phrase')
    setStatus(`ручная фраза добавлена: ${formatTime(manualSegment.start, true)} → ${formatTime(manualSegment.end, true)}`)
  }

  function cancelManualMissingPhrase() {
    setMissingPhraseEditor(null)
    setStatus('ручное добавление фразы отменено')
  }

  async function runAudioAsr(mode = 'speech') {
    
    if (mode === 'vocal') return runVocalStemAsrExact()
const useVocalStem = mode === 'vocal'
    const sourceDraft = draft
    const assetId = avaStage117AssetIdFromAudioDraft(sourceDraft, useVocalStem)

    if (!assetId) {
      console.warn('[MANUAL_TIMING_STAGE117_ASR_NO_ASSET_ID]', {
        useVocalStem,
        audioAssetId: sourceDraft.audioAssetId,
        audioApiPath: sourceDraft.audioApiPath,
        audioUrl: sourceDraft.audioUrl,
        vocalAudioAssetId: sourceDraft.vocalAudioAssetId,
        vocalAudioApiPath: sourceDraft.vocalAudioApiPath,
      })
      setStatus(useVocalStem ? 'сначала загрузите vocal stem' : 'ASR не нашёл assetId у аудио. Нужен /api/assets/asset_xxx/file или audioAssetId.')
      return
    }
// AVA_TIMING_ASR_IMMEDIATE_FEEDBACK_V67B:
    // Show ASR progress immediately after click, before clearing/saving the draft.
    // Otherwise user sees a long silent pause and thinks nothing started.
    // AVA_TIMING_ASR_SEPARATE_BUTTON_FEEDBACK_V68:
    // One shared asrRunning flag disables both buttons, but only the clicked mode
    // should show the spinner/gold running state.
    const asrModeForUi = (useVocalStem || mode === 'music') ? 'vocal' : 'speech'
    setAsrRunningMode(asrModeForUi)
    setAsrRunning(true)
    setStatus(useVocalStem ? 'ASR vocal stem запускается…' : mode === 'music' ? 'ASR master запускается…' : 'ASR диктор запускается…')

    const clearedDraft = normalizeDraft({
      ...sourceDraft,
      roles: [],
      speechSegments: [],
      audioPhrases: [],
      missingSpeechHints: [],
      handoffSource: '',
      asrMode: '',
      asrSource: '',
    })
    setDraft(clearedDraft)
    await saveDraft(clearedDraft, 'asr_clear_before_run')

    setAsrVisualOffsetSec(0)
    setAsrRunning(true)
    setStatus(useVocalStem ? 'ASR распознаёт vocal stem…' : mode === 'music' ? 'ASR распознаёт master без VAD…' : 'ASR распознаёт диктора…')
    try {
      console.log('[MANUAL_TIMING_STAGE117_ASR_START]', {
        assetId,
        mode,
        useVocalStem,
        audioApiPath: sourceDraft.audioApiPath,
        audioUrl: sourceDraft.audioUrl,
      })
      const result = await transcribeAudioAsset({
        assetId,
        projectId: projectId || activeProject?.id || null,
        roleId: useVocalStem ? 'vocal' : 'narrator',
        roleLabel: useVocalStem ? 'ВОК' : 'ДИК',
        mode: useVocalStem ? 'vocal' : mode,
        vadFilter: mode === 'speech' ? true : false,
        language: mode === 'speech' ? '' : 'ru',
      })
      const sourceName = useVocalStem ? 'asr_vocal_stem' : 'asr_main_audio'
      const nextSegments = (result.speechSegments || result.speech_segments || []).map((segment) => ({
        ...segment,
        source: sourceName,
      }))
      const nextDraft = normalizeDraft({
        ...sourceDraft,
        roles: result.roles || [],
        speechSegments: nextSegments,
        audioPhrases: Array.isArray(result.audio_phrases) ? result.audio_phrases : [],
        missingSpeechHints: normalizeMissingSpeechHints(result.missingSpeechHints || result.missing_speech_hints || []),
        handoffSource: sourceName,
        asrMode: useVocalStem ? 'vocal' : (result.mode || mode),
        asrSource: useVocalStem ? 'vocal_stem' : 'main_audio',
      })
      setDraft(nextDraft)
      await saveDraft(nextDraft, sourceName)
      setStatus(`ASR готово: ${nextSegments.length} фраз · ${useVocalStem ? 'vocal stem / speech+VAD' : result.mode || mode} · VAD ${result.vad_filter ? 'on' : 'off'}`)
    } catch (err) {
      console.error('[MANUAL_TIMING_STAGE117_ASR_FAILED]', {
        message: err?.message || String(err || ''),
        assetId,
        mode,
        audioApiPath: sourceDraft.audioApiPath,
        audioUrl: sourceDraft.audioUrl,
      })
      setStatus(`ошибка ASR: ${err.message}`)
    } finally {
      setAsrRunning(false)
    setAsrRunningMode('')
    }
  }


  async function runAsrTranslation() {
    const speechSegments = draft.speechSegments || []
    const audioPhrases = draft.audioPhrases || []
    if (!speechSegments.length && !audioPhrases.length) {
      setStatus('сначала сделайте ASR, потом перевод')
      return
    }

    setTranslationRunning(true)
    setStatus('перевод ASR → русский…')
    try {
      const result = await translateAsrSegments({
        speechSegments,
        audioPhrases,
        sourceLanguage: draft.asrLanguage || draft.language || '',
        targetLanguage: 'ru',
        projectId: projectId || activeProject?.id || null,
      })

      const translatedSpeechSegments = result.speechSegments || result.speech_segments || speechSegments
      const translatedAudioPhrases = result.audio_phrases || audioPhrases
      let translatedScenes = scenes
      let sceneSliceMeta = null

      const sceneTranslationItems = buildSceneTranslationItems(scenes, translatedSpeechSegments)
      if (sceneTranslationItems.length) {
        setStatus('перевод ASR → русский… уточняю выбранные сцены')
        const sceneResult = await translateAsrSegments({
          speechSegments: [],
          audioPhrases: sceneTranslationItems,
          sourceLanguage: draft.asrLanguage || draft.language || '',
          targetLanguage: 'ru',
        })
        sceneSliceMeta = sceneResult.translation_meta || null
        translatedScenes = applySceneSliceTranslations(
          scenes,
          sceneResult.audio_phrases || [],
          translatedSpeechSegments,
        )
      }

      const nextDraft = normalizeDraft({
        ...draft,
        scenes: translatedScenes,
        speechSegments: translatedSpeechSegments,
        audioPhrases: translatedAudioPhrases,
        asrTranslationMeta: {
          ...(result.translation_meta || {}),
          scene_slices: sceneSliceMeta,
        },
      })
      setDraft(nextDraft)
      await saveDraft(nextDraft, 'asr_translation_ru')
      const translatedCount = Number(result.translation_meta?.speech?.translated_count || 0) + Number(result.translation_meta?.audio_phrases?.translated_count || 0)
      const copiedCount = Number(result.translation_meta?.speech?.direct_ru_count || 0) + Number(result.translation_meta?.audio_phrases?.direct_ru_count || 0)
      const sceneCount = sceneTranslationItems.length
      setStatus(`перевод готов: ${translatedCount} фраз · ${sceneCount} сцен уточнено · ${copiedCount} уже русский`)
    } catch (err) {
      setStatus(`ошибка перевода: ${err.message}`)
    } finally {
      setTranslationRunning(false)
    }
  }

  function buildExportPayload() {
    return {
      schema: 'ava_manual_timing_handoff_v2',
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
      speech_segments: draft.speechSegments || [],
      audio_phrases: draft.audioPhrases || [],
      missingSpeechHints: asrGapSegments || [],
      missing_speech_hints: asrGapSegments || [],
      silentSegments: draft.silentSegments || [],
      scenes: scenes.map((scene) => {
        const speechExport = buildSceneSpeechExport(scene, draft.speechSegments || [])
        const sceneDisplay = buildSceneDisplayText(scene, speechExport)
        return {
          id: scene.id,
          scene_id: scene.id,
          title: scene.title,
          start: scene.start,
          end: scene.end,
          start_sec: scene.start,
          end_sec: scene.end,
          duration_sec: Number((scene.end - scene.start).toFixed(3)),
          route: scene.route || 'auto',
          note: scene.note || '',
          blockId: scene.blockId || '',
          blockTitle: scene.blockTitle || '',
          block_id: scene.blockId || '',
          block_title: scene.blockTitle || '',
          roleLabels: typeof getSceneRoleLabels === 'function' ? getSceneRoleLabels(scene) : (scene.roleLabels || []),
          ...sceneDisplay,
        }
      }),
      storyBlocks: draft.storyBlocks || [],
      story_blocks: draft.storyBlocks || [],
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

  function buildVideoMatchSeedPayload() {
    const manualTimingSeed = buildExportPayload()
    const audioDurationSec = Number(draft.audioDurationSec || 0)
    const timingScenes = Array.isArray(scenes) ? scenes : []
    const timingSegments = timingScenes.map((scene, index) => {
      const startSec = Number(scene.start ?? scene.start_sec ?? 0)
      const endSec = Number(scene.end ?? scene.end_sec ?? startSec)
      const durationSec = Math.max(0, Number((endSec - startSec).toFixed(3)))
      const sceneId = String(scene.id || scene.scene_id || `seg_${String(index + 1).padStart(3, '0')}`)
      const speechExport = buildSceneSpeechExport(scene, draft.speechSegments || [])
      const sceneDisplay = buildSceneDisplayText(scene, speechExport)
      const roleLabels = typeof getSceneRoleLabels === 'function' ? getSceneRoleLabels(scene) : (scene.roleLabels || [])
      const title = scene.title || `Сцена ${index + 1}`
      const note = scene.note || ''
      const isSilence = Boolean(scene.isSilence || scene.is_silence || scene.silence || String(title || '').trim() === '[тишина]')
      const text = sceneDisplay.scene_word_text || note || title || ''
      const route = String(scene.route || scene.videoRoute || scene.route_key || (isSilence ? 'silence' : 'auto')).trim() || 'auto'
      const routeLower = route.toLowerCase()
      const roleText = Array.isArray(roleLabels) ? roleLabels.join(' ').toLowerCase() : String(roleLabels || '').toLowerCase()
      const looksLikeLipSync = Boolean(
        routeLower.includes('ia2v') ||
        routeLower.includes('lip') ||
        routeLower.includes('talk') ||
        routeLower.includes('dialog') ||
        routeLower.includes('voice') ||
        roleText.includes('ls_') ||
        roleText.includes('дик') ||
        roleText.includes('вед') ||
        roleText.includes('гид') ||
        roleText.includes('рыбак') ||
        roleText.includes('пастор') ||
        roleText.includes('фермер')
      )
      const pendingCandidateId = `${sceneId}_codex_pending_01`
      return {
        id: sceneId,
        scene_id: sceneId,
        audio_scene_id: sceneId,
        index: index + 1,
        start_sec: startSec,
        end_sec: endSec,
        target_t0: startSec,
        target_t1: endSec,
        targetStartSec: startSec,
        targetEndSec: endSec,
        duration_sec: durationSec,
        durationSec,
        title,
        text,
        original_text: sceneDisplay.scene_word_text || '',
        translated_text_ru: sceneDisplay.translated_text_ru || '',
        meaning_hint_ru: sceneDisplay.meaning_hint_ru || '',
        scene_word_text: sceneDisplay.scene_word_text || '',
        lyrics_text: sceneDisplay.lyrics_text || sceneDisplay.scene_word_text || '',
        source_phrase_ids: sceneDisplay.source_phrase_ids || [],
        phrase_cut_warning: Boolean(sceneDisplay.phrase_cut_warning),
        roleLabels,
        role_labels: roleLabels,
        route,
        suggested_video_role: isSilence ? 'silence_gap' : (looksLikeLipSync ? 'reserved_generated_lipsync_or_character_insert' : 'source_video_broll'),
        is_lipsync_candidate: looksLikeLipSync,
        is_silence: isSilence,
        source_kind: isSilence ? 'silence' : 'timing_audio',
        blockId: scene.blockId || '',
        blockTitle: scene.blockTitle || '',
        block_id: scene.blockId || '',
        block_title: scene.blockTitle || '',
        note,
        user_scene_label: title,
        selected_candidate_id: pendingCandidateId,
        candidates: [
          {
            id: pendingCandidateId,
            candidate_id: pendingCandidateId,
            candidateType: 'needs_codex_match',
            candidate_type: 'needs_codex_match',
            sourceKind: isSilence ? 'silence_placeholder' : (looksLikeLipSync ? 'reserved_generated_lipsync' : 'pending_codex_source_window'),
            source_kind: isSilence ? 'silence_placeholder' : (looksLikeLipSync ? 'reserved_generated_lipsync' : 'pending_codex_source_window'),
            video_t0: 0,
            video_t1: durationSec,
            sourceVideoStartSec: 0,
            sourceVideoEndSec: durationSec,
            fit_mode: 'pending_codex',
            confidence: 0,
            match_reason: isSilence
              ? 'Timing silence segment. Preserve this gap or use neutral filler if needed.'
              : looksLikeLipSync
                ? 'Potential lip-sync/dialogue scene. Codex should reserve generated lip-sync if a speaking character is required; source video can be used as background/reference only.'
                : 'Timing seed only. Codex must replace this placeholder with real source-video candidates without changing target timing.',
            codex_replace_required: !isSilence,
            do_not_change_target_timing: true,
          },
        ],
      }
    })

    return {
      schema: 'video_match_board_v2',
      seed_schema: 'manual_timing_to_video_match_job_seed_v1',
      status: 'timing_seed_needs_codex_match',
      source: 'manual_timing',
      exportedAt: new Date().toISOString(),
      source_of_truth: 'manual_timing.scenes',
      do_not_change_audio_timings: true,
      do_not_reanalyze_audio: true,
      timing_locked: true,
      project_id: projectId || activeProject?.id || null,
      sourceNodeId: projectId ? `ava_project_${projectId}_manual_timing` : 'ava_workspace_manual_timing',
      audio_duration_sec: audioDurationSec,
      source_audio: {
        filename: draft.audioName || '',
        name: draft.audioName || '',
        asset_id: draft.audioAssetId || '',
        assetId: draft.audioAssetId || '',
        asset_api_path: draft.audioApiPath || '',
        assetApiPath: draft.audioApiPath || '',
        duration_sec: audioDurationSec,
        durationSec: audioDurationSec,
      },
      source_video: {
        path: '',
        filename: '',
        duration_sec: 0,
        user_must_provide_local_path: true,
        use_original_file_for_final_assembly: true,
        proxy_or_contact_sheet_allowed_for_analysis: true,
      },
      audio_map: {
        source_of_truth: 'manual_timing.scenes',
        do_not_change_audio_timings: true,
        duration_sec: audioDurationSec,
        audioDurationSec,
        segments: timingSegments,
      },
      timingContext: {
        sourceAudioUrl: draft.audioApiPath || draft.audioUrl || '',
        sourceAudioAssetId: draft.audioAssetId || '',
        sourceAudioName: draft.audioName || '',
        audioDurationSec,
        timingScenes: timingSegments,
        segments: timingSegments,
        sourceOfTruth: 'manual_timing.scenes',
        podcastEditManifest: draft.podcastEditManifest || draft.podcast_edit_manifest || null,
        composerEditManifest: draft.composerEditManifest || draft.composer_edit_manifest || null,
        updatedAt: Date.now(),
      },
      manual_timing_seed: manualTimingSeed,
      podcast_edit_manifest: draft.podcastEditManifest || draft.podcast_edit_manifest || null,
      story_blocks: draft.storyBlocks || [],
      roles: draft.roles || [],
      speech_segments: draft.speechSegments || [],
      silent_segments: draft.silentSegments || [],
      segments: timingSegments,
      codex_job_instructions: {
        entrypoint: 'video_match_from_manual_timing_seed',
        goal: 'Use this timing seed and source video to build final video_match_board_v2.',
        strict_rules: [
          'Do not change target_t0/target_t1/duration_sec.',
          'Do not re-run ASR or reinterpret audio timings.',
          'Use source video analysis to replace pending candidates with real source windows.',
          'Analyze the entire source video, not only the first minutes.',
          'For lip-sync/generated insert scenes, reserve generated_lipsync candidates and keep real source only as visual/background reference.',
          'Return final schema video_match_board_v2 with candidates and selected_candidate_id for every segment.',
        ],
      },
    }
  }

  function exportVideoMatchSeedJson() {
    const payload = buildVideoMatchSeedPayload()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const safeName = (draft.audioName || 'manual_timing').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_')
    link.href = url
    link.download = `${safeName}_video_match_seed.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setStatus(`JSON для видео экспортирован: ${payload.segments.length} сцен · тайминги locked`)
  }

  function buildVideoMatchCodexJobPayload() {
    const seed = buildVideoMatchSeedPayload()
    const segments = Array.isArray(seed.segments) ? seed.segments : []
    const lipSyncCandidates = segments.filter((seg) => seg.is_lipsync_candidate)
    const silenceSegments = segments.filter((seg) => seg.is_silence)
    const brollSegments = segments.filter((seg) => !seg.is_silence && !seg.is_lipsync_candidate)
    return {
      schema: 'ava_codex_video_match_job_v1',
      entrypoint: 'video_match_from_manual_timing_seed',
      status: 'ready_for_codex_after_user_answers',
      exportedAt: new Date().toISOString(),
      purpose: 'Codex receives this JSON plus a local source video path, analyzes the real source video, and returns a final importable video_match_board_v2.json.',
      chatgpt_understanding: {
        current_stage: 'final_video_match_after_manual_timing_asr',
        core_rule: 'Не текст ищет кадры. Кадры рождают текст. Но на этом финальном этапе аудио и Manual Timing уже являются locked source of truth.',
        what_is_locked: [
          'assembled audio duration',
          'Manual Timing scene start/end/duration',
          'scene ids',
          'source_phrase_ids',
          'roles and silence markers',
          'podcast_edit_manifest / source-map when present',
        ],
        what_codex_may_choose: [
          'source video windows for b-roll scenes',
          'candidate ranking and selected_candidate_id',
          'reserved generated lip-sync placeholders for speaking character scenes',
          'visual notes, contact sheets and validation report',
        ],
      },
      user_questions_before_codex: [
        {
          id: 'source_video_local_path',
          required: true,
          question_ru: 'Где лежит исходное видео на компьютере? Укажи полный путь, например C:\\Users\\...\\video.mp4.',
          answer: '',
        },
        {
          id: 'workflow_mode',
          required: true,
          default: 'final_match_after_manual_timing',
          options: ['final_match_after_manual_timing', 'video_first_inventory_before_script', 'existing_montage_retime'],
          question_ru: 'Мы делаем финальный match по готовому аудио/Timing или сначала только visual inventory/story?',
          answer: 'final_match_after_manual_timing',
        },
        {
          id: 'story_style',
          required: false,
          default: 'travel_documentary_poetic_realistic',
          question_ru: 'Какой стиль монтажа: документальный, клип, тревел, мрачный, спокойный, динамичный?',
          answer: '',
        },
        {
          id: 'matching_priority',
          required: false,
          default: 'meaning_first_then_visual_beauty',
          options: ['meaning_first_then_visual_beauty', 'visual_beauty_first', 'motion_energy_first', 'chronology_first'],
          question_ru: 'Что важнее: смысл слов, красота кадра, движение/энергия или хронология исходника?',
          answer: '',
        },
        {
          id: 'repeat_policy',
          required: false,
          default: 'avoid_duplicates_unless_necessary',
          options: ['avoid_duplicates_unless_necessary', 'allow_repeats_with_new_crop', 'allow_repeats_freely'],
          question_ru: 'Можно ли повторять один и тот же кусок видео в разных сценах?',
          answer: '',
        },
        {
          id: 'speed_policy',
          required: false,
          default: 'no_speed_change_for_now',
          options: ['no_speed_change_for_now', 'allow_slight_slowmo_or_speedup', 'allow_any_retime_if_natural'],
          question_ru: 'Можно ли ускорять/замедлять исходные кадры ради попадания в длительность сцены?',
          answer: '',
        },
        {
          id: 'lipsync_policy',
          required: false,
          default: 'reserve_generated_lipsync_for_speaking_character_scenes',
          options: ['reserve_generated_lipsync_for_speaking_character_scenes', 'use_only_broll_no_lipsync', 'ask_per_scene'],
          question_ru: 'Если сцена выглядит как речь персонажа, резервировать её под generated lip-sync или искать только b-roll?',
          answer: '',
        },
        {
          id: 'must_use_or_avoid_moments',
          required: false,
          question_ru: 'Есть ли моменты исходного видео, которые обязательно использовать или не использовать?',
          answer: '',
        },
      ],
      inputs: {
        timing_seed_included: true,
        timing_seed_schema: seed.seed_schema,
        source_video: {
          local_path: '',
          filename: '',
          note: 'User must fill local_path before Codex starts. Browser blob URLs are not valid for Codex or backend assembly.',
          analyze_full_video: true,
          use_original_for_final_assembly: true,
          proxy_allowed_for_analysis: true,
        },
        source_audio: seed.source_audio,
      },
      codex_steps: [
        {
          step: '00_validate_inputs',
          do: [
            'Read this JSON as UTF-8 and strip BOM before JSON.parse/json.load if needed.',
            'Verify audio_map.segments exists and has all timing scenes.',
            'Verify source_video.local_path points to a real video file.',
            'If audio_map exists, do not analyze audio again and do not change timing.',
          ],
          safe_stop_if_missing: 'blocked_missing_audio_map_or_source_video_path',
        },
        {
          step: '01_source_video_inventory',
          do: [
            'Analyze the entire source video duration.',
            'Create visual inventory and source shot index.',
            'Detect visual families, weak/duplicate shots, strong cinematic windows, human/context shots, motion/brightness/scene changes.',
            'Create contact sheets if possible for manual review.',
          ],
        },
        {
          step: '02_match_timing_segments',
          do: [
            'For every locked timing segment, pick 2-3 candidate source windows when possible.',
            'Candidate duration should fit target duration or explain fit_mode.',
            'Never change segment target_t0/target_t1/duration_sec.',
            'For silence segments, preserve as silence/filler/neutral visual gap.',
            'For lip-sync candidate scenes, create reserved_generated_lipsync candidate; real video may be background/reference only.',
          ],
        },
        {
          step: '03_write_final_board',
          do: [
            'Return importable video_match_board_v2.json.',
            'Every segment must have selected_candidate_id and candidates.',
            'Use source_video.path from user local path, not browser blob URL.',
            'Preserve scene_id, audio_scene_id, source_phrase_ids, roles, silence markers, block ids and text fields.',
          ],
        },
      ],
      output_requirements: {
        final_import_file: 'video_match_board_v2.json',
        required_extra_files: [
          'visual_inventory.md',
          'source_shot_index.json',
          'contact_sheet_overview.jpg or contact_sheet_overview.md',
          'validation_report.json',
        ],
        video_match_board_v2_must_include: [
          'schema',
          'source_video.path',
          'audio_map.segments',
          'segments[].scene_id',
          'segments[].target_t0',
          'segments[].target_t1',
          'segments[].duration_sec',
          'segments[].candidates[]',
          'segments[].selected_candidate_id',
          'segments[].source_phrase_ids',
          'segments[].roleLabels',
          'segments[].is_silence',
        ],
      },
      validation_rules: [
        'sum of output target durations must match locked manual timing duration within 0.05 sec per segment tolerance.',
        'No invented visual objects in b-roll match reasons unless they are actually visible in source inventory.',
        'No final output with status blocked_missing_audio_map if this JSON has audio_map.segments.',
        'Do not depend on corrupted Cyrillic file path inside imported JSON if user manually provides local source video.',
        'Do not write browser blob: URLs into final persistent JSON.',
      ],
      quick_summary_for_user: {
        total_segments: segments.length,
        broll_segments: brollSegments.length,
        lipsync_or_speaking_candidates: lipSyncCandidates.length,
        silence_segments: silenceSegments.length,
        audio_duration_sec: seed.audio_duration_sec,
        timing_locked: true,
      },
      video_match_seed: seed,
    }
  }

  function exportVideoMatchCodexJobJson() {
    const payload = buildVideoMatchCodexJobPayload()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const safeName = (draft.audioName || 'manual_timing').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_')
    link.href = url
    link.download = `${safeName}_codex_video_job.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setStatus(`Codex JSON экспортирован: ${payload.quick_summary_for_user.total_segments} сцен · нужен путь к source video`)
  }




  function avaManualTimingFirstTextV14(...values) {
    for (const value of values) {
      const text = String(value ?? '').trim()
      if (text) return text
    }
    return ''
  }

  function avaManualTimingFirstPositiveNumberV14(...values) {
    for (const value of values) {
      if (value === null || value === undefined || value === '') continue
      const num = Number(value)
      if (Number.isFinite(num) && num > 0) return num
    }
    return 0
  }

  function avaManualTimingImportSceneIdV14(scene = {}, index = 0) {
    return avaManualTimingFirstTextV14(scene.id, scene.scene_id, scene.sceneId) || formatSceneId(index)
  }

  function avaManualTimingProductionByIdV14(raw = {}, root = {}) {
    const productionScenes = Array.isArray(raw.production?.scenes)
      ? raw.production.scenes
      : Array.isArray(root.production?.scenes)
        ? root.production.scenes
        : []
    const map = new Map()
    productionScenes.forEach((scene, index) => {
      const id = avaManualTimingImportSceneIdV14(scene, index)
      if (id) map.set(String(id), scene)
    })
    return map
  }

  function avaManualTimingPickImportSceneSourceV14(raw = {}, root = {}) {
    const rootScenes = Array.isArray(raw.scenes)
      ? raw.scenes
      : Array.isArray(root.scenes)
        ? root.scenes
        : []
    const timingScenes = Array.isArray(raw.timing?.scenes)
      ? raw.timing.scenes
      : Array.isArray(root.timing?.scenes)
        ? root.timing.scenes
        : []
    const productionScenes = Array.isArray(raw.production?.scenes)
      ? raw.production.scenes
      : Array.isArray(root.production?.scenes)
        ? root.production.scenes
        : []

    if (rootScenes.length) return { scenes: rootScenes, source: 'scenes' }
    if (timingScenes.length) return { scenes: timingScenes, source: 'timing.scenes' }
    if (productionScenes.length) return { scenes: productionScenes, source: 'production.scenes' }
    return { scenes: [], source: '' }
  }

  function avaManualTimingNormalizeImportSceneV14(scene = {}, index = 0, durationSec = 0, productionById = new Map()) {
    const id = avaManualTimingImportSceneIdV14(scene, index)
    const production = productionById.get(String(id)) || {}
    const start = Number(scene.start ?? scene.start_sec ?? scene.startSec ?? scene.target_t0 ?? scene.t0 ?? 0) || 0
    const duration = avaManualTimingFirstPositiveNumberV14(scene.duration, scene.duration_sec, scene.durationSec, production.duration, production.duration_sec)
    const endRaw = Number(scene.end ?? scene.end_sec ?? scene.endSec ?? scene.target_t1 ?? scene.t1 ?? 0) || 0
    const end = endRaw > start ? endRaw : (duration > 0 ? start + duration : Math.min(Number(durationSec || 0), start + 1))
    if (!(end > start)) return null

    const route = avaManualTimingFirstTextV14(scene.route, scene.planned_route, scene.plannedRoute, production.route, production.planned_route) || 'i2v'
    const blockId = avaManualTimingFirstTextV14(scene.blockId, scene.block_id, production.blockId, production.block_id)
    const blockTitle = avaManualTimingFirstTextV14(scene.blockTitle, scene.block_title, production.blockTitle, production.block_title)
    const color = avaManualTimingFirstTextV14(scene.color, scene.scene_color, scene.sceneColor, production.color, production.scene_color, production.sceneColor)

    return {
      ...production,
      ...scene,
      id,
      scene_id: id,
      title: id,
      index,
      start,
      end,
      start_sec: start,
      end_sec: end,
      duration: Number((end - start).toFixed(3)),
      duration_sec: Number((end - start).toFixed(3)),
      target_t0: start,
      target_t1: end,
      route,
      planned_route: avaManualTimingFirstTextV14(scene.planned_route, scene.plannedRoute, production.planned_route, route),
      scene_word_text: avaManualTimingFirstTextV14(scene.scene_word_text, scene.text, production.scene_word_text, production.text),
      lyrics_text: avaManualTimingFirstTextV14(scene.lyrics_text, scene.scene_word_text, production.lyrics_text, production.scene_word_text),
      original_text: avaManualTimingFirstTextV14(scene.original_text, scene.originalText, production.original_text, production.originalText),
      translated_text_ru: avaManualTimingFirstTextV14(scene.translated_text_ru, scene.translation, scene.translation_ru, scene.ruText, production.translated_text_ru, production.translation),
      meaning_hint_ru: avaManualTimingFirstTextV14(scene.meaning_hint_ru, scene.meaning, scene.meaningText, production.meaning_hint_ru, production.meaning),
      blockId,
      block_id: blockId,
      blockTitle,
      block_title: blockTitle,
      color,
      sceneColor: color,
      blockColor: color,
      recipe_step: avaManualTimingFirstTextV14(scene.recipe_step, production.recipe_step),
      idea_fn: avaManualTimingFirstTextV14(scene.idea_fn, production.idea_fn),
      visual_action: avaManualTimingFirstTextV14(scene.visual_action, production.visual_action),
      viewer_should_understand: avaManualTimingFirstTextV14(scene.viewer_should_understand, production.viewer_should_understand),
      readability_check: avaManualTimingFirstTextV14(scene.readability_check, production.readability_check),
      locked: scene.locked !== false,
      do_not_change_scene_id: true,
      do_not_change_start_end_duration: true,
    }
  }

  function avaManualTimingBuildImportScenesV14(raw = {}, root = {}, durationSec = 0) {
    const picked = avaManualTimingPickImportSceneSourceV14(raw, root)
    const productionById = avaManualTimingProductionByIdV14(raw, root)
    const scenes = (Array.isArray(picked.scenes) ? picked.scenes : [])
      .map((scene, index) => avaManualTimingNormalizeImportSceneV14(scene, index, durationSec, productionById))
      .filter(Boolean)
    return { scenes, source: picked.source }
  }


  async function importTimingJson(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    function pickText(...values) {
      for (const value of values) {
        const text = String(value ?? '').trim()
        if (text) return text
      }
      return ''
    }

    function pickPositiveNumber(...values) {
      for (const value of values) {
        if (value === null || value === undefined || value === '') continue
        const num = Number(value)
        if (Number.isFinite(num) && num > 0) return num
      }
      return 0
    }

    function importSceneId(scene = {}, index = 0) {
      return pickText(scene.id, scene.scene_id, scene.sceneId) || formatSceneId(index)
    }

    function pickSceneSource(raw = {}, root = {}) {
      const rootScenes = Array.isArray(raw.scenes) ? raw.scenes : Array.isArray(root.scenes) ? root.scenes : []
      const timingScenes = Array.isArray(raw.timing?.scenes) ? raw.timing.scenes : Array.isArray(root.timing?.scenes) ? root.timing.scenes : []
      const productionScenes = Array.isArray(raw.production?.scenes) ? raw.production.scenes : Array.isArray(root.production?.scenes) ? root.production.scenes : []

      if (rootScenes.length) return { scenes: rootScenes, source: 'scenes' }
      if (timingScenes.length) return { scenes: timingScenes, source: 'timing.scenes' }
      if (productionScenes.length) return { scenes: productionScenes, source: 'production.scenes' }
      return { scenes: [], source: '' }
    }

    function productionById(raw = {}, root = {}) {
      const rows = Array.isArray(raw.production?.scenes)
        ? raw.production.scenes
        : Array.isArray(root.production?.scenes)
          ? root.production.scenes
          : []
      const map = new Map()
      rows.forEach((scene, index) => {
        const id = importSceneId(scene, index)
        if (id) map.set(String(id), scene)
      })
      return map
    }

    function normalizeImportScene(scene = {}, index = 0, durationSec = 0, productionMap = new Map()) {
      const id = importSceneId(scene, index)
      const production = productionMap.get(String(id)) || {}
      const start = Number(scene.start ?? scene.start_sec ?? scene.startSec ?? scene.target_t0 ?? scene.t0 ?? 0) || 0
      const explicitDuration = pickPositiveNumber(scene.duration, scene.duration_sec, scene.durationSec, production.duration, production.duration_sec, production.durationSec)
      const rawEnd = Number(scene.end ?? scene.end_sec ?? scene.endSec ?? scene.target_t1 ?? scene.t1 ?? 0) || 0
      const end = rawEnd > start ? rawEnd : (explicitDuration > 0 ? start + explicitDuration : Math.min(Number(durationSec || 0), start + 1))
      if (!(end > start)) return null

      const route = pickText(scene.route, scene.planned_route, scene.plannedRoute, production.route, production.planned_route) || 'i2v'
      const blockId = pickText(scene.blockId, scene.block_id, production.blockId, production.block_id)
      const blockTitle = pickText(scene.blockTitle, scene.block_title, production.blockTitle, production.block_title)
      const color = pickText(scene.color, scene.sceneColor, scene.scene_color, production.color, production.sceneColor, production.scene_color)

      return {
        ...production,
        ...scene,
        id,
        scene_id: id,
        title: id,
        index,
        start: Number(start.toFixed(3)),
        end: Number(end.toFixed(3)),
        start_sec: Number(start.toFixed(3)),
        end_sec: Number(end.toFixed(3)),
        duration: Number((end - start).toFixed(3)),
        duration_sec: Number((end - start).toFixed(3)),
        target_t0: Number(start.toFixed(3)),
        target_t1: Number(end.toFixed(3)),
        route,
        planned_route: pickText(scene.planned_route, scene.plannedRoute, production.planned_route, route),
        scene_word_text: pickText(scene.scene_word_text, scene.text, production.scene_word_text, production.text),
        lyrics_text: pickText(scene.lyrics_text, scene.scene_word_text, production.lyrics_text, production.scene_word_text),
        original_text: pickText(scene.original_text, scene.originalText, production.original_text, production.originalText),
        translated_text_ru: pickText(scene.translated_text_ru, scene.translation, scene.translation_ru, scene.ruText, production.translated_text_ru, production.translation),
        meaning_hint_ru: pickText(scene.meaning_hint_ru, scene.meaning, scene.meaningText, production.meaning_hint_ru, production.meaning),
        blockId,
        block_id: blockId,
        blockTitle,
        block_title: blockTitle,
        color,
        sceneColor: color,
        blockColor: color,
        recipe_step: pickText(scene.recipe_step, production.recipe_step),
        idea_fn: pickText(scene.idea_fn, production.idea_fn),
        visual_action: pickText(scene.visual_action, production.visual_action),
        viewer_should_understand: pickText(scene.viewer_should_understand, production.viewer_should_understand),
        readability_check: pickText(scene.readability_check, production.readability_check),
        photo_prompt_positive: pickText(production.photo_prompt_positive, scene.photo_prompt_positive),
        photo_prompt_negative: pickText(production.photo_prompt_negative, scene.photo_prompt_negative),
        video_motion_prompt: pickText(production.video_motion_prompt, scene.video_motion_prompt),
        video_motion_negative: pickText(production.video_motion_negative, scene.video_motion_negative),
        lipsync_motion_prompt: pickText(production.lipsync_motion_prompt, scene.lipsync_motion_prompt),
        positive_prompt: pickText(production.positive_prompt, scene.positive_prompt),
        negative_prompt: pickText(production.negative_prompt, scene.negative_prompt),
        video_prompt: pickText(production.video_prompt, scene.video_prompt),
        prompt_positive: pickText(production.prompt_positive, scene.prompt_positive),
        prompt_negative: pickText(production.prompt_negative, scene.prompt_negative),
        sound_design_needed: Boolean(production.sound_design_needed || scene.sound_design_needed),
        sound_role: pickText(production.sound_role, scene.sound_role),
        mmaudio_prompt: pickText(production.mmaudio_prompt, scene.mmaudio_prompt),
        mmaudio_negative_prompt: pickText(production.mmaudio_negative_prompt, scene.mmaudio_negative_prompt),
        scene_ambience_prompt: pickText(production.scene_ambience_prompt, scene.scene_ambience_prompt),
        foley_prompt: pickText(production.foley_prompt, scene.foley_prompt),
        sound_notes: pickText(production.sound_notes, scene.sound_notes),
        locked: scene.locked !== false,
        do_not_change_scene_id: true,
        do_not_change_start_end_duration: true,
      }
    }

    try {
      const raw = JSON.parse(await file.text())
      const root = raw.manualTiming || raw.manual_timing || raw
      const manifest = raw.podcast_edit_manifest || root.podcast_edit_manifest || raw.manifest || root.manifest || {}
      const rawSpeech = root.speechSegments || root.speech_segments || root.audio_phrases || root.asr_phrases || raw.timing?.speech_segments || manifest.speechSegments || manifest.speech_segments || manifest.audio_phrases || manifest.asr_phrases || manifest.segments || []
      const speechSegments = typeof normalizeSpeechSegments === 'function' ? normalizeSpeechSegments(rawSpeech) : []
      const defaultClipPassRole = (root.audio_phrases || manifest.audio_phrases) ? [{ roleId: 'narrator', id: 'narrator', name: 'Диктор', label: 'ДИК', color: 220 }] : []
      const roles = typeof normalizeRoleList === 'function' ? normalizeRoleList(root.roles || manifest.roles || defaultClipPassRole, speechSegments) : (root.roles || manifest.roles || defaultClipPassRole)
      const silentSegments = typeof normalizeSilentSegments === 'function' ? normalizeSilentSegments(root.silentSegments || root.silent_segments || manifest.silentSegments || manifest.silent_segments || []) : []

      const importedDuration = pickPositiveNumber(
        raw.durationSec,
        raw.audio_duration_sec,
        raw.audio?.durationSec,
        raw.audio?.duration_sec,
        raw.assets?.audio?.durationSec,
        raw.assets?.audio?.duration_sec,
        raw.timing?.audioDurationSec,
        raw.timing?.audio_duration_sec,
        root.audioDurationSec,
        root.audio_duration_sec,
        root.audio?.durationSec,
        root.audio?.duration_sec,
        manifest.audioDurationSec,
        manifest.audio_duration_sec,
        draft.audioDurationSec
      )

      const picked = pickSceneSource(raw, root)
      const productionMap = productionById(raw, root)
      const importedScenes = picked.scenes
        .map((scene, index) => normalizeImportScene(scene, index, importedDuration || draft.audioDurationSec, productionMap))
        .filter(Boolean)

      const nextScenes = importedScenes.length
        ? normalizeScenes({ scenes: importedScenes }, importedDuration || draft.audioDurationSec)
        : scenes.length
          ? scenes
          : speechSegments.length
            ? renumberScenes(speechSegments.map((segment) => ({ start: segment.start, end: segment.end })))
            : makeSingleScene(importedDuration || draft.audioDurationSec)

      const nextStoryBlocks = Array.isArray(raw.storyBlocks)
        ? raw.storyBlocks
        : Array.isArray(raw.story_blocks)
          ? raw.story_blocks
          : Array.isArray(root.storyBlocks)
            ? root.storyBlocks
            : Array.isArray(root.story_blocks)
              ? root.story_blocks
              : Array.isArray(draft.storyBlocks)
                ? draft.storyBlocks
                : []

      const nextDraft = normalizeDraft({
        ...draft,
        audioName: root.audioName || root.audio_name || root.audio?.name || raw.audio?.name || raw.assets?.audio?.name || draft.audioName,
        audioAssetId: root.audioAssetId || root.audio_asset_id || root.audio?.assetId || root.audio?.asset_id || raw.assets?.audio?.assetId || raw.assets?.audio?.asset_id || draft.audioAssetId,
        audioApiPath: root.audioApiPath || root.audio_api_path || root.audio?.assetApiPath || root.audio?.asset_api_path || raw.assets?.audio?.assetApiPath || raw.assets?.audio?.asset_api_path || draft.audioApiPath,
        audioDurationSec: importedDuration || draft.audioDurationSec,
        roles,
        speechSegments,
        audioPhrases: Array.isArray(root.audio_phrases) ? root.audio_phrases : Array.isArray(root.audioPhrases) ? root.audioPhrases : Array.isArray(raw.timing?.speech_segments) ? raw.timing.speech_segments : speechSegments,
        silentSegments,
        scenes: nextScenes,
        scenesCount: nextScenes.length,
        storyBlocks: nextStoryBlocks,
        scene_block_map: raw.scene_block_map || root.scene_block_map || draft.scene_block_map,
        handoffSource: raw.status || raw.source || root.source || manifest.source || picked.source || 'json_import',
      })

      pushHistorySnapshot()
      setDraft(nextDraft)
      setCursorSec(nextScenes[0]?.start || 0)
      await saveDraft(nextDraft, 'json_import')
      setStatus(
        importedScenes.length
          ? `JSON импортирован: ${nextScenes.length} сцен · источник ${picked.source || 'unknown'}`
          : (root.audio_phrases || manifest.audio_phrases
            ? `JSON импортирован: audio_phrases импортированы как ASR-карта · ${speechSegments.length} фраз`
            : `JSON импортирован: ролей ${roles.length}, речевых сегментов ${speechSegments.length}`)
      )
    } catch (err) {
      setStatus(`ошибка импорта JSON: ${err.message}`)
    }
  }


  async function handleVocalUpload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!draft.audioAssetId) {
      setStatus('сначала загрузите основное аудио')
      return
    }

    setUploadingVocal(true)
    setStatus('загрузка vocal stem…')
    try {
      const result = await uploadAudioAsset({ file, projectId: workspaceMode ? null : projectId, stage: `${STAGE}_vocal` })
      const duration = Math.max(0, Number(result.audio_duration_sec) || 0)
      const durationDiff = Math.abs(duration - Number(draft.audioDurationSec || 0))
      const nextDraft = normalizeDraft({
        ...draft,
        vocalAudioName: result.audio_name || file.name,
        vocalAudioAssetId: result.asset_id || result.assetId || '',
        vocalAudioApiPath: result.asset_api_path || result.assetApiPath || '',
        vocalAudioSizeBytes: result.audio_size_bytes || result.audioSizeBytes || file.size || 0,
        vocalAudioDurationSec: duration,
        vocalOffsetSec: 0,
      })
      setDraft(nextDraft)
      await saveDraft(nextDraft, 'vocal_upload')
      setStatus(durationDiff > 0.7
        ? `vocal загружен, но длительность отличается на ${durationDiff.toFixed(1)} сек`
        : 'vocal stem загружен поверх основной дорожки'
      )
    } catch (err) {
      setStatus(`ошибка загрузки vocal: ${err.message}`)
    } finally {
      setUploadingVocal(false)
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


  async function toggleTranslatorPreview(startSec, endSec, previewId) {
    const audio = audioRef.current
    if (!audio || !hasAudio || !audioSrc) return
    clearSceneStopTimer()
    scenePreviewRangeRef.current = null

    const start = clampCursor(Number(startSec || 0), draft.audioDurationSec)
    const safeEnd = clampCursor(Number(endSec || start + 0.1), draft.audioDurationSec)
    const end = Math.max(start + 0.08, safeEnd)
    const id = String(previewId || `${start.toFixed(3)}-${end.toFixed(3)}`)

    if (playingMode === 'translator' && translatorPlayingId === id) {
      const pausedAt = clampCursor(audio.currentTime || cursorSec, draft.audioDurationSec)
      audio.pause()
      translatorPreviewRangeRef.current = null
      setTranslatorPlayingId('')
      setCursorSec(pausedAt)
      setPlayingMode(null)
      return
    }

    translatorPreviewRangeRef.current = { start, end, id }
    setTranslatorPlayingId(id)
    setPlayingMode('translator')
    audio.currentTime = start
    setCursorSec(start)

    try {
      await audio.play()
    } catch (err) {
      translatorPreviewRangeRef.current = null
      setTranslatorPlayingId('')
      setPlayingMode(null)
      setStatus(`ошибка проигрывания фразы: ${err.message}`)
    }
  }

  async function toggleScenePlay(event) {
    event?.preventDefault?.()
    event?.stopPropagation?.()
    const audio = audioRef.current
    if (!audio || !hasAudio) return
    clearSceneStopTimer()
    translatorPreviewRangeRef.current = null
    setTranslatorPlayingId('')

    if (playingMode === 'scene') {
      const pausedAt = clampCursor(audio.currentTime || cursorSec, draft.audioDurationSec)
      audio.pause()
      scenePreviewRangeRef.current = null
      setCursorSec(pausedAt)
      setPlayingMode(null)
      return
    }

    const sceneStart = clampCursor(Number(selectedScene?.start || 0), draft.audioDurationSec)
    const sceneEnd = clampCursor(Math.max(sceneStart + 0.05, Number(selectedScene?.end || sceneStart)), draft.audioDurationSec)
    const currentCursor = clampCursor(
      Number.isFinite(Number(cursorSec)) ? Number(cursorSec) : Number(audio.currentTime || 0),
      draft.audioDurationSec,
    )
    const cursorInsideScene = currentCursor > sceneStart + 0.01 && currentCursor < sceneEnd - 0.01
    const startAt = cursorInsideScene ? currentCursor : sceneStart
    const endAt = sceneEnd
    const fixedRange = {
      id: selectedScene?.id || selectedScene?.title || 'scene',
      start: startAt,
      end: endAt,
    }

    scenePreviewRangeRef.current = fixedRange
    setPlayingMode('scene')
    audio.currentTime = startAt
    setCursorSec(startAt)

    try {
      await audio.play()
      clearSceneStopTimer()
      sceneStopTimerRef.current = window.setTimeout(() => {
        const nextAudio = audioRef.current
        const range = scenePreviewRangeRef.current
        if (!nextAudio || !range) return
        const stopAt = clampCursor(Number(range.end || endAt), draft.audioDurationSec)
        nextAudio.pause()
        nextAudio.currentTime = stopAt
        scenePreviewRangeRef.current = null
        sceneStopTimerRef.current = null
        setCursorSec(stopAt)
        setPlayingMode(null)
      }, Math.max(80, Math.round((endAt - startAt) * 1000 + 25)))
    } catch (err) {
      scenePreviewRangeRef.current = null
      clearSceneStopTimer()
      setPlayingMode(null)
      setStatus(`ошибка проигрывания: ${err.message}`)
    }
  }

  async function toggleAllPlay(event) {
    event?.preventDefault?.()
    event?.stopPropagation?.()
    const audio = audioRef.current
    if (!audio || !hasAudio) return
    clearSceneStopTimer()
    scenePreviewRangeRef.current = null
    translatorPreviewRangeRef.current = null
    setTranslatorPlayingId('')
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



  async function downloadSelectedSceneAudio() {
    if (!hasAudio || !selectedScene) {
      setStatus('сначала выбери сцену и загрузи аудио')
      return
    }

    const start = Math.max(0, Number(selectedScene.start) || 0)
    const rawEnd = Math.max(start, Number(selectedScene.end) || start)
    const end = Math.min(Number(draft.audioDurationSec) || rawEnd, rawEnd)

    if (!(end > start) || end - start < 0.05) {
      setStatus('слишком короткий отрезок сцены для скачивания')
      return
    }

    const sourceUrl = audioSrc || audioRef.current?.currentSrc || audioRef.current?.src
    if (!sourceUrl) {
      setStatus('аудио ещё не готово для скачивания')
      return
    }

    let audioContext = null

    try {
      setStatus(`готовлю WAV сцены: ${formatTime(start, true)} → ${formatTime(end, true)}`)

      const fetchOptions = avaStage116ShouldAuthFetch(sourceUrl) ? { headers: getAuthHeaders() } : {}
      const response = await fetch(sourceUrl, fetchOptions)
      if (!response.ok) throw new Error(`audio_fetch_failed_${response.status}`)

      const arrayBuffer = await response.arrayBuffer()
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (!AudioContextClass) throw new Error('web_audio_not_supported')

      audioContext = new AudioContextClass()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0))

      const sampleRate = audioBuffer.sampleRate
      const startFrame = Math.max(0, Math.floor(start * sampleRate))
      const endFrame = Math.min(audioBuffer.length, Math.ceil(end * sampleRate))
      const frameCount = Math.max(1, endFrame - startFrame)
      const channelCount = Math.min(2, Math.max(1, audioBuffer.numberOfChannels || 1))

      const wavBuffer = encodeAudioBufferSliceToWav(audioBuffer, startFrame, frameCount, channelCount)
      const blob = new Blob([wavBuffer], { type: 'audio/wav' })
      const url = URL.createObjectURL(blob)

      const sceneName = sanitizeAudioDownloadName(selectedScene.title || selectedScene.id || 'scene')
      const startName = sanitizeAudioDownloadName(formatTime(start, true))
      const endName = sanitizeAudioDownloadName(formatTime(end, true))

      const link = document.createElement('a')
      link.href = url
      link.download = `${sceneName}_${startName}-${endName}.wav`
      document.body.appendChild(link)
      link.click()
      link.remove()

      window.setTimeout(() => URL.revokeObjectURL(url), 1500)
      setStatus(`скачал WAV сцены: ${selectedScene.title || selectedScene.id}`)
    } catch (error) {
      console.error('[ManualTiming] download selected scene audio failed', error)
      setStatus('не удалось скачать аудио сцены')
    } finally {
      try {
        await audioContext?.close?.()
      } catch {
        // ignore close errors
      }
    }
  }


  async function downloadUnifiedTaskPackV7() {
    try {
      setStatus('Собираем задание…')
      try {
        await saveDraft(draft, 'download_unified_task_pack_v7', true)
      } catch {}

      const projectForPack = activeProject || {
        id: projectId || '',
        name: scopeTitle || 'Ava project',
        project_mode: { id: 'manual_general_v1' },
      }

      const boardSnapshot = projectId
        ? await loadStage(projectId, 'board').catch(() => ({}))
        : await loadWorkspaceStage('board').catch(() => ({}))

      const pack = buildAvaProjectPackV1({
        project: projectForPack,
        manualTiming: draft,
        board: boardSnapshot || {},
        summary: {
          source: 'manual_timing_unified_task_button_v7',
          scenes_count: Array.isArray(draft.scenes) ? draft.scenes.length : 0,
          audio_duration_sec: Number(draft.audioDurationSec || 0),
        },
      })

      downloadJsonFile(pack, 'ava_project_pack_v1.json')
      setStatus(`Скачано задание · режим: ${pack.project_mode?.label_ru || 'Клип'}`)
    } catch (error) {
      console.error('[ManualTiming] unified task pack download failed', error)
      setStatus(`Не удалось скачать задание: ${error?.message || 'unknown_error'}`)
    }
  }

  if (loading) return (
    <div className="avaPage avaTimingFlatPage avaTimingLoadingPage isAvaTimingWaveLoading">
      <div className="avaTimingLoadingShell">
        <div className="avaTimingLoadingMain">
          <div className="avaTimingLoadingIcon"><Clock3 size={32} /></div>
          <p className="avaEyebrow">Storyboard → Timing</p>
          <h1>Загрузка Manual Timing...</h1>
          <p>Возвращаем таймкоды, блоки, аудио и разрезы. Дождись восстановления проекта перед правками.</p>
          <div className="avaTimingWaveLoader" aria-hidden="true">
            <div className="avaTimingWaveTrack">
              <span className="avaTimingMovingNote">♪</span>
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
            <div className="avaTimingLoadingLine"><span /></div>
            <small>{status || 'Синхронизируем аудио, разрезы и блоки'}</small>
          </div>
        </div>
      </div>
    </div>
  )

  function openPodcastComposer() {
    const sourceNodeId = projectId ? `ava_project_${projectId}_manual_timing` : "ava_workspace_manual_timing";
    const scenes = Array.isArray(draft.scenes) ? draft.scenes : [];
    const audioUrl = draft.audioUrl || draft.asset_url || "";
    const handoffProject = {
      nodeId: sourceNodeId,
      sourceNodeId,
      project_runtime_type: "manual_timing",
      project_mode: "podcast_dialogue",
      project_kind: "podcast",
      audio: {
        url: audioUrl,
        audioUrl,
        assetApiPath: draft.audioApiPath || "",
        asset_api_path: draft.audioApiPath || "",
        assetId: draft.audioAssetId || "",
        asset_id: draft.audioAssetId || "",
        filename: draft.audioName || "audio",
        name: draft.audioName || "audio",
        duration_sec: Number(draft.audioDurationSec || 0),
        durationSec: Number(draft.audioDurationSec || 0),
      },
      audio_duration_sec: Number(draft.audioDurationSec || 0),
      roles: Array.isArray(draft.roles) ? draft.roles : [],
      audio_phrases: Array.isArray(draft.audioPhrases) ? draft.audioPhrases : [],
      speech_segments: Array.isArray(draft.speechSegments) ? draft.speechSegments : [],
      story_blocks: Array.isArray(draft.storyBlocks) ? draft.storyBlocks : [],
      markers: scenes.length
        ? [...scenes.map((scene) => Number(scene.start || 0)), Number(scenes[scenes.length - 1]?.end || draft.audioDurationSec || 0)]
        : [0, Number(draft.audioDurationSec || 0)],
      scenes: scenes.map((scene, index) => ({
        ...scene,
        scene_id: scene.id || scene.scene_id || `seg_${String(index + 1).padStart(2, "0")}`,
        index: index + 1,
        start_sec: Number(scene.start ?? scene.start_sec ?? 0),
        end_sec: Number(scene.end ?? scene.end_sec ?? 0),
        duration_sec: Math.max(0, Number(scene.end ?? scene.end_sec ?? 0) - Number(scene.start ?? scene.start_sec ?? 0)),
      })),
      podcast_edit_manifest: draft.podcastEditManifest || draft.podcast_edit_manifest || null,
      updatedAt: Date.now(),
    };

    try {
      localStorage.setItem(`ava_podcast_timing_handoff:${sourceNodeId}`, JSON.stringify(handoffProject));
      sessionStorage.setItem(`ava_podcast_timing_handoff:${sourceNodeId}`, JSON.stringify(handoffProject));
    } catch (error) {
      console.warn("[AVA PODCAST HANDOFF SAVE FAILED]", error);
    }

    const podcastPath = projectId
      ? `/app/projects/${projectId}/podcast?sourceNodeId=${encodeURIComponent(sourceNodeId)}`
      : `/app/workspace/podcast?sourceNodeId=${encodeURIComponent(sourceNodeId)}`;
    rememberWorkflowEntry(makeWorkflowEntry({
      from: 'manual_timing',
      to: 'podcast',
      fromPath: projectId ? `/app/projects/${projectId}/timing` : '/app/workspace/timing',
      toPath: podcastPath,
      projectId,
      source: 'manual_timing_to_podcast_button',
    }));
    window.location.assign(podcastPath);
  }



  // AVA_PROJECT_CONTEXT_TIMING_TO_BOARD_V37: project-safe Timing -> Board handoff.
  function openTimingToBoardConfirmV37() {
    if (loading) {
      setStatus('Тайминг ещё загружается. Подожди пару секунд и повтори переход в Доску.')
      return
    }
    if (!scenes.length) {
      setStatus('Нельзя перейти в Доску: в Тайминге нет сцен. Сначала импортируй/создай разбивку.')
      return
    }
    setShowTimingToBoardConfirmV16(true)
    setStatus(`Подтверди перенос в Доску: ${scenes.length} сцен будут отправлены в проектную Доску.`)
  }

  function cancelTimingToBoardConfirmV37() {
    setShowTimingToBoardConfirmV16(false)
    setStatus('Переход в Доску отменён. Тайминг оставлен без изменений.')
  }

  async function confirmTimingToBoardNavigateV37() {
    if (loading) {
      setStatus('Тайминг ещё загружается. Переход в Доску заблокирован.')
      return
    }
    if (!scenes.length) {
      setStatus('Переход в Доску заблокирован: сцены не загружены. Импортируй JSON или дождись восстановления Тайминга.')
      return
    }

    const sceneSnapshot = scenes.map((scene, index) => ({
      ...scene,
      id: scene.id || scene.scene_id || `seg_${String(index + 1).padStart(2, '0')}`,
      scene_id: scene.scene_id || scene.id || `seg_${String(index + 1).padStart(2, '0')}`,
      start: Number(scene.start ?? scene.start_sec ?? 0),
      end: Number(scene.end ?? scene.end_sec ?? 0),
      start_sec: Number(scene.start_sec ?? scene.start ?? 0),
      end_sec: Number(scene.end_sec ?? scene.end ?? 0),
      duration_sec: Math.max(0, Number(scene.end ?? scene.end_sec ?? 0) - Number(scene.start ?? scene.start_sec ?? 0)),
      durationSec: Math.max(0, Number(scene.end ?? scene.end_sec ?? 0) - Number(scene.start ?? scene.start_sec ?? 0)),
      // AVA_TIMING_TO_BOARD_SCENE_COLORS_V67B:
      // Preserve the exact visual hue used in Manual Timing so Board cards do not collapse to one role/block color.
      sceneColor: scene.sceneColor ?? scene.scene_color ?? scene.color ?? sceneHue(index),
      scene_color: scene.scene_color ?? scene.sceneColor ?? scene.color ?? sceneHue(index),
      color: scene.color ?? scene.sceneColor ?? scene.scene_color ?? sceneHue(index),
    }))

    const nextDraft = {
      ...draft,
      scenes: sceneSnapshot,
      scenesCount: sceneSnapshot.length,
      selectedSceneIndex: Math.min(Number(draft.selectedSceneIndex || 0), Math.max(0, sceneSnapshot.length - 1)),
      audioDurationSec: Number(draft.audioDurationSec || timelineDurationSec || sceneSnapshot[sceneSnapshot.length - 1]?.end || 0),
      updatedAt: Date.now(),
    }

    setShowTimingToBoardConfirmV16(false)
    setStatus(`Сохраняем Тайминг перед переходом в Доску: ${sceneSnapshot.length} сцен…`)
    await saveDraft(nextDraft, 'timing_to_board_confirm_v37')

    const toPath = projectId ? `/app/projects/${projectId}/board` : '/app/workspace/board'
    navigateWithWorkflowEntry(navigate, toPath, makeWorkflowEntry({
      from: 'manual_timing',
      to: 'board',
      fromPath: projectId ? `/app/projects/${projectId}/timing` : '/app/workspace/timing',
      toPath,
      projectId,
      source: 'manual_timing_to_board_confirmed_v16',
    }))
  }


  return (
    <div className="avaPage avaTimingFlatPage">
      <audio ref={audioRef} src={audioSrc || undefined} preload="metadata" onLoadedMetadata={handleLoadedMetadata} />
      <input ref={fileInputRef} type="file" accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm,.mp4,.mov,.mkv,.avi,.m4v" hidden onChange={handleAudioUpload} />
      <input ref={jsonInputRef} type="file" accept="application/json,.json" hidden onChange={importTimingJson} />

      {showTimingToBoardConfirmV16 ? (
        <div className="avaBoardTimingConfirmOverlay" role="dialog" aria-modal="true">
          <div className="avaBoardTimingConfirmCard">
            <div className="avaBoardTimingConfirmGlow" />
            <div className="avaBoardTimingConfirmBadge">Timing → Board</div>
            <div className="avaModalReturnRowV13">
              <button
                className="avaModalReturnIconV13"
                type="button"
                onClick={(event) => {
      event.preventDefault()
      event.stopPropagation()
      const cancelButton = Array.from(document.querySelectorAll('button')).find((button) =>
        String(button?.textContent || '').includes('Оставить старую Доску')
      )
      if (cancelButton && cancelButton !== event.currentTarget) cancelButton.click()
    }}
                title="Вернуться без перехода"
                aria-label="Вернуться без перехода"
              >
                ↩
              </button>
            </div>\n            <h3>Перенести Тайминг в Доску?</h3>
            <p>
              Сейчас в Доске могут быть старые сцены, видео и аудио. Если продолжить, Доска будет очищена
              и заменена свежими сценами, цветами, блоками и главным аудио из Тайминга.
            </p>
            <div className="avaBoardTimingConfirmWarning">
              Старые видео/кадры Доски будут отвязаны от сцен. Загруженные asset-файлы на диске не удаляются.
            </div>
            <div className="avaBoardTimingConfirmActions">
              <button type="button" className="avaBoardTimingConfirmSecondary" onClick={() => {
                  try {
                    if (typeof setShowTimingToBoardConfirmV16 === 'function') setShowTimingToBoardConfirmV16(false)
                  } catch {}
                  try {
                    if (typeof setStatus === 'function') setStatus('Переход в Доску отменён. Тайминг оставлен без изменений.')
                  } catch {}
                }}>
                Оставить старую Доску
              </button>
              <button type="button" className="avaBoardTimingConfirmPrimary" onClick={async () => {
                  // AVA_TIMING_TO_BOARD_FORCE_SAVE_BEFORE_NAV_V36: make first transfer use the fresh Timing snapshot.
                  await saveDraft(draft, 'timing_to_board_confirm_v36')
                  const toPath = projectId ? `/app/projects/${projectId}/board` : '/app/workspace/board'
                  try {
                    if (typeof setShowTimingToBoardConfirmV16 === 'function') setShowTimingToBoardConfirmV16(false)
                  } catch {}
                  navigateWithWorkflowEntry(navigate, toPath, makeWorkflowEntry({
                    from: 'manual_timing',
                    to: 'board',
                    fromPath: projectId ? `/app/projects/${projectId}/timing` : '/app/workspace/timing',
                    toPath,
                    projectId,
                    source: 'manual_timing_to_board_confirmed_v16',
                  }))
                }}>
                Да, заменить Доску
              </button>
            </div>
          </div>
        </div>
      ) : null}{/* AVA_TIMING_TO_BOARD_CONFIRM_MODAL_IN_TIMING_V16 */}


      {/* AVA08D_MANUAL_TIMING_CONTROLS */}
      <WorkflowStageControls
        stageKey="manual_timing"
        stageLabel="Тайминг"
        clearLabel="Очистить тайминг"
        clearStages={['manual_timing']}
        clearStorageMatchers={['manual_timing', 'timing', 'podcast-to-timing', 'downstream-reset']}
        clearDescription="Очистит snapshot тайминга и временные ключи тайминга. Загруженные assets на диске не удаляются."
      />

      <div className="avaTimingFlatHeader">
        <div>
          <p><Clock3 size={15} /> STAGE 3.4 · basic timing controls</p>
          <h2>Тайминг · Клип / Music video</h2>
          <span>ASR → song structure → Clip Pass</span>
        </div>
        <div className="avaTimingHeaderActions">
          <button className="avaSoftButton avaTimingActionButton avaTimingActionAudio" type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading || loading}>
            <UploadCloud size={16} /> {uploading ? 'Загрузка…' : 'Аудио'}
          </button>
          <button className="avaSoftButton avaTimingActionButton avaTimingActionJson" type="button" onClick={() => jsonInputRef.current?.click()} disabled={loading}>Импорт</button>
          <button
            className="avaSoftButton avaTimingActionButton avaTimingActionTaskPackV7"
            type="button"
            onClick={downloadUnifiedTaskPackV7}
            disabled={loading}
            title="Скачать единое задание проекта: режим, contract, timing, readiness и подсказка для Codex/ChatGPT"
          >
            📦 Скачать задание
          </button>

          <button
            className={`avaSoftButton avaTimingActionButton avaTimingActionBoard avaTimingStageLink ${hasAudio ? 'isReadyForBoard' : ''}`}
            type="button"
            onClick={() => {
                  if (typeof setShowTimingToBoardConfirmV16 === 'function') {
                    setShowTimingToBoardConfirmV16(true)
                    try {
                      if (typeof setStatus === 'function') setStatus('Подтверди перенос в Доску: старая Доска будет заменена свежим Таймингом.')
                    } catch {}
                    return
                  }
                  const toPath = projectId ? `/app/projects/${projectId}/board` : '/app/workspace/board'
                  navigateWithWorkflowEntry(navigate, toPath, makeWorkflowEntry({
                    from: 'manual_timing',
                    to: 'board',
                    fromPath: projectId ? `/app/projects/${projectId}/timing` : '/app/workspace/timing',
                    toPath,
                    projectId,
                    source: 'manual_timing_to_board_confirmed_v16',
                  }))
                }}
          >
            <Film size={16} /> В доску
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
            {selectedSceneDisplayText.phrase_cut_warning && <em>фраза разрезана — проверь границу</em>}
          </div>
          <div className="avaTimingAsrStripActions">
            <button type="button" onClick={runAsrTranslation} disabled={translationRunning || asrRunning || !(draft.speechSegments || []).length}>
              {translationRunning ? 'перевод…' : 'Перевести ASR · 1+1'}
            </button>
            <button type="button" onClick={() => setShowSceneTranslator((value) => !value)}>
              {showSceneTranslator ? 'скрыть перевод' : 'показать перевод'}
            </button>
          </div>
        </div>

        {showSceneTranslator && (
          <div className="avaTimingSceneTextBox avaTimingTranslatorBox">
            <div className="avaTimingTranslatorSummary">
              <div>
                <span>слова сцены</span>
                <strong>{selectedSceneDisplayText.scene_word_text || '—'}</strong>
              </div>
              <div>
                <span>перевод</span>
                <strong>{selectedSceneDisplayText.translated_text_ru || 'перевода пока нет'}</strong>
              </div>
              <div>
                <span>смысл</span>
                <strong>{selectedSceneDisplayText.meaning_hint_ru || 'смысл пока не заполнен'}</strong>
              </div>
            </div>

            <div className="avaTimingTranslationTtsBar">
              <button
                type="button"
                className={translationTtsPlayingId === `scene-translation-${selectedScene.id}` ? 'isPlaying' : ''}
                onClick={() => speakTranslationText(selectedSceneDisplayText.translated_text_ru, `scene-translation-${selectedScene.id}`)}
                disabled={!selectedSceneDisplayText.translated_text_ru}
                title="Озвучить русский перевод выбранной сцены браузерным голосом"
              >
                {translationTtsPlayingId === `scene-translation-${selectedScene.id}` ? '■ стоп' : '🔊 перевод сцены'}
              </button>
              <button
                type="button"
                className={translationTtsPlayingId === `scene-meaning-${selectedScene.id}` ? 'isPlaying' : ''}
                onClick={() => speakTranslationText(selectedSceneDisplayText.meaning_hint_ru, `scene-meaning-${selectedScene.id}`)}
                disabled={!selectedSceneDisplayText.meaning_hint_ru}
                title="Озвучить краткий смысл сцены"
              >
                {translationTtsPlayingId === `scene-meaning-${selectedScene.id}` ? '■ стоп' : '🔊 смысл'}
              </button>
              <span>перевод и смысл читаются отдельно · голос берётся из браузера/Chrome</span>
            </div>

            {selectedSpeechSegments.length > 0 ? (
              <div className="avaTimingSpeechList">
                {selectedSpeechSegments.map((segment) => {
                  const role = roleMap.get(segment.roleId || segment.role_id)
                  const label = role?.label || segment.label || normalizeRoleLabel(segment.roleId || segment.role_id || 'voice')
                  const clipped = clipSegmentTextToScene(selectedScene, segment)
                  const segmentKey = String(segment.id || `${segment.start}-${segment.end}`)
                  const segmentStart = Math.max(0, Number(segment.start || 0))
                  const segmentEnd = Math.max(segmentStart + 0.08, Number(segment.end || segmentStart))
                  const clipStart = Math.max(selectedScene.start, segmentStart)
                  const clipEnd = Math.min(selectedScene.end, segmentEnd)
                  const fullPreviewId = `phrase-full-${segmentKey}`
                  const clipPreviewId = `phrase-clip-${segmentKey}`
                  const useSceneScopedPreview = Boolean(selectedSceneDisplayText.phrase_cut_warning)
                  const visibleOriginalText = useSceneScopedPreview ? selectedSceneDisplayText.scene_word_text : (clipped.text || segment.text || '')
                  const visibleTranslationRu = useSceneScopedPreview ? selectedSceneDisplayText.translated_text_ru : clipped.ruText
                  const visibleMeaningRu = useSceneScopedPreview ? selectedSceneDisplayText.meaning_hint_ru : clipped.meaningText
                  return (
                    <div key={segmentKey} className={`avaTimingSpeechItem ${clipped.isPartial ? 'isPartialCut' : ''}`}>
                      <div className="avaTimingSpeechItemTop">
                        <span>{label} · {formatTime(clipStart, true)} → {formatTime(clipEnd, true)}{clipped.isPartial ? ' · частично' : ''}</span>
                      </div>
                      <p>{visibleOriginalText || '...'}</p>
                      {visibleTranslationRu && (
                        <div className="avaTimingSpeechTranslationLine">
                          <em>{visibleTranslationRu}</em>
                          <button
                            type="button"
                            className={translationTtsPlayingId === `phrase-translation-${segmentKey}` ? 'isPlaying' : ''}
                            onClick={() => speakTranslationText(visibleTranslationRu, `phrase-translation-${segmentKey}`)}
                            title="Озвучить русский перевод этой ASR-фразы"
                          >
                            {translationTtsPlayingId === `phrase-translation-${segmentKey}` ? '■' : '🔊'}
                          </button>
                        </div>
                      )}
                      {visibleMeaningRu && <small>{visibleMeaningRu}</small>}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p>ASR-фразы для выбранной сцены пока не найдены. Используйте блок “ASR / разметка речи” под плеером.</p>
            )}
          </div>
        )}

        <div ref={timelineScaleRef} className="avaTimingTimelineScale" onClick={seekTimeline} onDoubleClick={splitAtCursor}>
          <div ref={timelineContentRef} className="avaTimingTimelineContent">
          <div className="avaTimingCursorLabel" style={{ left: `${cursorPct}%` }}>{formatTime(cursorSec, true)}</div>
          <div className="avaTimingWaveLong">
            {Array.from({ length: 180 }).map((_, index) => <i key={index} style={{ '--h': `${14 + ((index * 19) % 74)}%` }} />)}
          </div>
          <div className="avaTimingPlayhead" style={{ left: `${cursorPct}%` }} />
  
          {(draft.speechSegments || []).length > 0 && (
            <div className="avaTimingAsrPhraseMap">
              {(draft.speechSegments || []).map((segment) => {
                const visualStart = Math.max(0, Number(segment.start || 0) + asrVisualOffsetSec)
                const left = timeToTimelinePct(visualStart, timelineDurationSec)
                const width = timelineDurationSec > 0 ? Math.max(0.12, ((segment.end - segment.start) / timelineDurationSec) * 100) : 0.4
                const role = roleMap.get(segment.roleId || segment.role_id)
                const label = role?.label || segment.label || normalizeRoleLabel(segment.roleId || segment.role_id || 'voice')
                return (
                  <button
                    key={segment.id || `${segment.start}-${segment.end}`}
                    type="button"
                    className="avaTimingAsrPhrase"
                    style={{ left: `${left}%`, width: `${width}%`, '--asr-hue': role?.color || 220 }}
                    title={`${label}: ${segment.text || ''}`}
                    onClick={() => {
                      stopAudio(segment.start || 0)
                      setCursorSec(segment.start || 0)
                    }}
                  >
                    <span>{segment.text || label}</span>
                  </button>
                )
              })}

              {asrGapSegments.map((gap) => {
                const visualGapStart = Math.max(0, Number(gap.start || 0) + asrVisualOffsetSec)
                const left = timeToTimelinePct(visualGapStart, timelineDurationSec)
                const width = timelineDurationSec > 0 ? Math.max(0.8, ((gap.end - gap.start) / timelineDurationSec) * 100) : 2
                return (
                  <button
                    key={gap.id}
                    type="button"
                    className="avaTimingAsrGap"
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${gap.label}: ${formatTime(gap.start, true)} → ${formatTime(gap.end, true)}`}
                    onClick={(event) => {
                      event?.stopPropagation?.()
                      openMissingPhraseEditor(gap)
                    }}
                  >
                    <span>{gap.label}</span>
                  </button>
                )
              })}
            </div>
          )}

        <div ref={segmentsRowRef} className="avaTimingSegmentsRow">
            {scenes.map((scene) => {
              const sceneLeft = timelineDurationSec > 0 ? timeToTimelinePct(scene.start, timelineDurationSec) : ((scene.index || 0) / Math.max(1, scenes.length)) * 100
              const sceneWidth = timelineDurationSec > 0 ? Math.max(0.5, ((scene.end - scene.start) / timelineDurationSec) * 100) : (100 / Math.max(1, scenes.length))
              const roleLabels = getSceneRoleLabels(scene)
              const podcastRoleLabel = String(
                scene.roleLabel ||
                scene.role_label ||
                scene.speakerLabel ||
                scene.speaker_label ||
                scene.composer_role_label ||
                scene.composer_block_label ||
                scene.blockTitle ||
                scene.block_title ||
                ''
              ).trim()
              const visibleRoleLabels = podcastRoleLabel ? [podcastRoleLabel] : roleLabels
  return (
                <button
                  key={`${scene.id}-${scene.start}-${scene.end}`}
                  type="button"
                  data-scene-id={scene.id || scene.title || scene.index}
                  style={{ left: `${sceneLeft}%`, width: `${sceneWidth}%`, '--scene-hue': sceneBlockHue(scene, scene.index) }}
                  className={`${scene.index === selectedScene.index ? 'isActive' : ''} ${scene.blockId ? 'hasBlock' : ''} ${isSceneInBlockSelection(scene) ? 'isBlockPicked' : ''} ${scene.note ? 'hasNote' : ''}`}
                  onClick={(event) => handleSceneClick(event, scene.index)}
                  onDoubleClick={(event) => {
                    event?.stopPropagation?.()
                    openSceneEditor(scene.index)
                  }}
                
                  title={getSceneTooltip(scene)}>
                  <b>{scene.title}</b>
                  {visibleRoleLabels.length > 0 && <em className="avaTimingSceneRoleBadge">{visibleRoleLabels.slice(0, 2).join(' / ')}</em>}
                  <small>{scene.route && scene.route !== 'auto' ? `${scene.route} · ` : ''}{formatTime(scene.start)} → {formatTime(scene.end)}</small>
                </button>
              )
            })}
          </div>
          </div>
        </div>

        {missingPhraseEditor && (
          <div className="avaTimingMissingPhraseEditor">
            <div className="avaTimingMissingPhraseHeader">
              <div>
                <strong>Проверить пропущенную фразу</strong>
                <span>
                  {formatTime(missingPhraseEditor.start, true)} → {formatTime(missingPhraseEditor.end, true)}
                </span>
              </div>
              <button type="button" onClick={cancelManualMissingPhrase}>Закрыть</button>
            </div>

            <div className="avaTimingMissingPhraseGrid">
              <label>
                роль
                <select
                  value={missingPhraseEditor.roleId}
                  onChange={(event) => {
                    const role = (draft.roles || []).find((item) => (item.roleId || item.id) === event.target.value)
                    setMissingPhraseEditor((value) => ({
                      ...value,
                      roleId: event.target.value,
                      label: role?.label || normalizeRoleLabel(event.target.value),
                    }))
                  }}
                >
                  {(draft.roles || [{ roleId: 'vocal', id: 'vocal', label: 'ВОК', name: 'Вокал' }]).map((role) => (
                    <option key={role.roleId || role.id} value={role.roleId || role.id}>
                      {role.label || normalizeRoleLabel(role.roleId || role.id)} · {role.name || role.roleId || role.id}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                начало
                <input
                  type="number"
                  step="0.01"
                  value={missingPhraseEditor.start}
                  onChange={(event) => setMissingPhraseEditor((value) => ({ ...value, start: Number(event.target.value || 0) }))}
                />
              </label>

              <label>
                конец
                <input
                  type="number"
                  step="0.01"
                  value={missingPhraseEditor.end}
                  onChange={(event) => setMissingPhraseEditor((value) => ({ ...value, end: Number(event.target.value || 0) }))}
                />
              </label>
            </div>

            <textarea
              value={missingPhraseEditor.text}
              onChange={(event) => setMissingPhraseEditor((value) => ({ ...value, text: event.target.value }))}
              placeholder="Напиши фразу, которую ASR пропустил..."
            />

            <div className="avaTimingMissingPhraseActions">
              <button type="button" onClick={(event) => {
                event?.preventDefault?.()
                event?.stopPropagation?.()
                stopAudio(missingPhraseEditor.start || 0)
                setCursorSec(missingPhraseEditor.start || 0)
                audioRef.current.currentTime = missingPhraseEditor.start || 0
                audioRef.current.play()
                setPlayingMode('missing')
              }}>
                ▶ прослушать
              </button>
              <button type="button" className="isPrimary" onClick={saveManualMissingPhrase}>
                Добавить фразу
              </button>
              <button type="button" onClick={cancelManualMissingPhrase}>Отмена</button>
            </div>
          </div>
        )}

        {selectedBlockSceneCount > 0 && (
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
<button className="isReset" type="button" onClick={deleteSelectedSceneFromAudio} disabled={!hasAudio || deletingSceneAudio || !selectedScene} title="Удалить выбранную сцену из общего аудио и сдвинуть всё дальше влево"><Trash2 size={15} /> {deletingSceneAudio ? 'удаляю…' : 'удалить'}</button>
            <button className="isSaveAudio" type="button" onClick={saveCurrentTimingAudio} disabled={!hasAudio}>💾 сохранить аудио</button>
          <button type="button" onClick={undoLastChange} disabled={!history.length}><Undo2 size={15} /> вернуть</button>

          <button
            className="avaTimingDownloadSceneButton"
            type="button"
            style={{
              '--scene-hue': sceneHue(selectedScene?.index ?? draft.selectedSceneIndex ?? 0),
            }}
            onClick={downloadSelectedSceneAudio}
            disabled={!hasAudio || !selectedScene}
            title={`Скачать аудио выбранной сцены: ${selectedScene?.title || selectedScene?.id || 'сцена'} · ${formatTime(selectedScene?.start || 0, true)} → ${formatTime(selectedScene?.end || 0, true)}`}
          >
            <span className="avaTimingDownloadSceneIcon">♫</span>
            <span className="avaTimingDownloadSceneText">
              <strong>Аудио сцены</strong>
              <small>
                {selectedScene?.title || selectedScene?.id || `seg_${String((draft.selectedSceneIndex || 0) + 1).padStart(2, '0')}`} · WAV
              </small>
            </span>
          </button>
          <button className="avaTimingDevButton" type="button" onClick={() => setShowDev((value) => !value)}>{showDev ? 'Скрыть dev' : 'dev'}</button>
        </div>

        <div className="avaTimingAsrPanel">
          <div className="avaTimingAsrPanelHead">
            <div>
              <strong>ASR / разметка речи</strong>
              <span>Выбери режим: обычный диктор распознаётся по основной дорожке; для песни лучше загрузить отдельный чистый vocal stem.</span>
            </div>
            <div className="avaTimingAsrPanelStats">
              <b>{(draft.speechSegments || []).length}</b>
              <small>фраз</small>
            </div>
          </div>

          <div className="avaTimingAsrModeGrid">
            <div className="avaTimingAsrModeCard isNarrator">
              <div className="avaTimingAsrModeBadge">1</div>
              <div className="avaTimingAsrModeText">
                <strong>Диктор / обычная речь</strong>
                <p>Для подкаста, озвучки, интервью и рассказчика. Берём слова прямо из основного аудио.</p>
              </div>
              <button
                type="button"
                className={(asrRunning && (asrRunningMode === 'speech' || !asrRunningMode)) ? 'avaTimingAsrPrimaryButton isRunning' : 'avaTimingAsrPrimaryButton'}
                onClick={() => runAudioAsr('speech')}
                disabled={!hasAudio || !narratorAsrAssetId || asrRunning}
                title={narratorAsrAssetId ? `ASR asset: ${narratorAsrAssetId}` : 'ASR не нашёл assetId у аудио'}
              >
                {(asrRunning && (asrRunningMode === 'speech' || !asrRunningMode)) ? (
                  <>
                    <span className="avaTimingAsrButtonSpinner" aria-hidden="true" />
                    ASR запускается…
                  </>
                ) : 'ASR диктор · 1 кредит'}
              </button>
            </div>

            <div className="avaTimingAsrModeCard isVocal">
              <div className="avaTimingAsrModeBadge">2</div>
              <div className="avaTimingAsrModeText">
                <strong>Песня / vocal stem</strong>
                <p>Если музыка мешает словам, загрузи чистый vocal stem той же длины. Кнопка ASR vocal stem точно всегда отправляет vocal как speech+VAD: role=ВОК, mode=speech, vad=true.</p>
                {draft.vocalAudioName && (
                  <small className="avaTimingVocalStemInfo">
                    vocal: {draft.vocalAudioName} · {formatTime(draft.vocalAudioDurationSec, true)}
                  </small>
                )}
              </div>
              <div className="avaTimingAsrModeActions">
                <button type="button"
                  disabled={true}>
                  {asrRunning ? 'ASR…' : 'ASR master без VAD отключён'}
                </button>
                <button type="button" onClick={() => document.getElementById('avaTimingVocalStemInput')?.click()} disabled={!hasAudio || uploadingVocal}>
                  {uploadingVocal ? 'Загрузка vocal…' : draft.vocalAudioName ? 'Заменить vocal stem' : 'Загрузить vocal stem'}
                </button>
                <input
                  id="avaTimingVocalStemInput"
                  className="avaHiddenFileInput"
                  type="file"
                  accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm,.mp4,.mov,.mkv,.avi,.m4v"
                  onChange={handleVocalUpload}
                />
                <button
                  type="button"
                  className={(asrRunning && asrRunningMode === 'vocal') ? 'avaTimingAsrPrimaryButton isRunning' : 'avaTimingAsrPrimaryButton'}
                  onClick={runVocalStemAsrExact}
                  disabled={asrRunning}
                >
                  {(asrRunning && asrRunningMode === 'vocal') ? (
                    <>
                      <span className="avaTimingAsrButtonSpinner" aria-hidden="true" />
                      ASR vocal запускается…
                    </>
                  ) : 'ASR vocal stem точно · 1 кредит'}
                </button>
                <button type="button"
                  disabled={!vocalAsrAssetId || asrRunning}
                  title={vocalAsrAssetId ? `vocal asset: ${vocalAsrAssetId}` : 'загрузите vocal stem'}
                >
                  ASR vocal stem точно
                </button>
              </div>
            </div>
          </div>
<div className="avaTimingAsrFooterActions">
            <button
              type="button"
              onClick={runAsrTranslation}
              disabled={translationRunning || asrRunning || !(draft.speechSegments || []).length}
              title="Перевести ASR-фразы в русский текст"
            >
              {translationRunning ? 'перевод…' : 'Перевести ASR'}
            </button>
            <span>Vocal stem нужен только как источник слов. Проверка в Network должна быть: role_id=vocal, role_label=ВОК, mode=speech, vad_filter=true.</span>
          </div>

</div>

</section>
    </div>
  )
}
