/* AVA_BOARD_TRIM_COMPACT_LAYOUT_V201E: compact media actions + trim before duration slider. */
/* AVA_BOARD_TRIM_COMPACT_TIMEPICKER_V201D: compact video player time picker for Assembly trim IN/OUT. */
/* AVA_BOARD_IMAGE_CACHE_AUTOSLICE_V200W: clear cached image spinner and auto-cut audio slice before manual ia2v start. */
/* AVA_BOARD_TIMING_IMPORT_LOADING_V162A: no empty-board flicker during Timing -> Board import. */
/* AVA_BOARD_BATCH_READY_UI_WINS_V148A: server video refs beat stale polling/runtime busy state. */
/* AVA_BOARD_SERVER_BATCH_AUTOSLICE_V147A: server batch auto-cuts audio slices for ia2v/lip-sync scenes. */
/* AVA_BOARD_REVIEW_CLEAR_EVENT_TIMESTAMP_V136D: clear review writes explicit cleared_at token. */
/* AVA_BOARD_SIMPLE_BAD_REVIEW_FLOW_V136A: direct manual bad/clear review flow; bad badge wins over ready until regeneration. */
// AVA_BOARD_READY_VIDEO_WINS_BUSY_STATUS_V133E: current ready video refs must beat stale queued/running poll state.
/* AVA_BOARD_REVIEW_CLEAR_ON_IMAGE_CHANGE_V133B: image replacement must clear stale bad/posmotri review state. */
/* AVA_BOARD_MANUAL_SCENE_IMMEDIATE_COLORS_V133A: manual scenes get their final per-scene color immediately, before F5/rehydrate. */
/* AVA_BOARD_REVIEW_ACCEPT_PERSIST_V132Z: posmotri/bad accepted state is explicit and survives F5/server preserve. */
/* AVA_BOARD_REVIEW_TOGGLE_ACCEPT_POSMOTRI_V132X: clicking orange posmotri accepts/clears review instead of jumping to bad. */
/* AVA_BOARD_RELOAD_SAVE_GUARD_V132W: prevent F5/re-enter from losing server video refs; merge backend snapshot again after Board build and protect durable cache writes. */
/* AVA_BOARD_RELOAD_VIDEO_REHYDRATE_V132T: after F5/re-enter always merge server video/result/review refs over stale local durable cache. */
/* AVA_BOARD_STATUS_REHYDRATE_COMBINED_V132V: fixes V132U syntax issue, V132S isError crash, and combines V132S status flow with V132T reload video rehydrate. */
/* AVA_BOARD_BATCH_STATUS_FLOW_V132S: precise Board server-batch states: submitting -> running/queued -> ready. */
/* AVA_BOARD_BATCH_READY_WITHOUT_VIDEO_GUARD_V143B: completed batch scenes without real video refs stay busy, not falsely ready. */
/* AVA_BOARD_BATCH_BUSY_REVIEW_V132R: server batch immediately marks scenes busy and keeps old preview overlay during bad-review regeneration. */
/* AVA_BOARD_MEDIA_STATUS_INDICATORS_V132O: UI-only media indicators for image restore/upload and video regeneration review. */
/* AVA_BOARD_IMAGE_UPLOAD_FORCE_COMMIT_V132N4: manual image uploads force asset refs into scene snapshot and clear stale video/review state. */
/* AVA_BOARD_REVIEW_READY_PLUS_LOOK_V132F: video-ready badge stays green while review badge shows bad/posmotri; needs_review beats stale bad flags. */
/* AVA_BOARD_REVIEW_BAD_READY_LABEL_SPLIT_V132E: main video badge stays green ready; review badge shows bad/посмотри. */
/* AVA_BOARD_BAD_REVIEW_STATUS_PRIORITY_V132D2: review status has priority over generic video-ready labels and F5 normalization. */
/* AVA_BOARD_BAD_REVIEW_SERVER_BATCH_QUEUE_V132A: red bad-review videos are queued by server batch instead of skipped as ready. */
/* AVA_BOARD_MANUAL_DURATION_REHYDRATE_SELECTED_V131S: selected scene duration slider is rehydrated from loaded board data after F5. */
/* AVA_BOARD_SERVER_BATCH_VIDEO_EPOCH_READY_V131O: server batch video refs are bound to current image epoch and marked ready. */
/* AVA_BOARD_SERVER_BATCH_REFRESH_UI_V131N_FIX: repairs malformed chooseBoardDataForLoad after v131n. */
/* AVA_BOARD_SERVER_BATCH_REFRESH_UI_V131N: F5/server-snapshot refresh for backend video batch results. */
/* AVA_BOARD_DELETE_DIRECT_REPLACE_V129U: direct replace-save image delete, no safe_merge restore. */
/* AVA_BOARD_MEDIA_DELETE_BACKEND_GUARD_V129T: comprehensive delete/reset aliases + stale poll skip. */
/* AVA_BOARD_DELETE_MEDIA_HARD_V129S: hard clear image/delete path, stale video poll guard, import progress. */
/* AVA_BOARD_STILLS_IMMEDIATE_PREVIEW_V129Q: immediate image overwrite preview + prefetch. */
/* AVA_BOARD_VIDEO_READY_STALE_AFTER_STILLS_V129P: stale ready videos ignored after still replacement. */
/* AVA_BOARD_STILLS_CACHE_RACE_V129O: image preview cache + stale save race guard. */
/* AVA_BOARD_STILLS_OVERWRITE_DELETE_V129N: immediate still preview, hard video-ref clear, replace-save delete. */
/* AVA_BOARD_STILLS_OVERWRITE_V129M: numbered packet still import + manual/packet photo overwrite. */
/* AVA_BOARD_MANUAL_SCENE_DELETE_PROGRESS_V129K: safe manual -scene delete + clear progress polish. */
/* AVA_BOARD_MANUAL_SCENE_DELETE_REFERENCE_V129J: fix undefined -scene handler after v129i. */
/* AVA_BOARD_MANUAL_SCENE_CLEAR_PROGRESS_V129I: manual -scene button + clear progress UI. */
/* AVA_BOARD_DEFAULT_COLLAPSE_TRANSLATION_V129H: collapse Translation/Sense panel by default for direct/manual Board entry only. */
/* AVA_BOARD_MANUAL_LIPSYNC_HIDE_SLIDER_V129G: force-hide direct/manual Board ia2v duration slider. */
/* AVA_BOARD_MANUAL_LIPSYNC_UPLOAD_V129A: standalone Board lip-sync audio upload + F5 runtime player. */
/* AVA_BOARD_STOP_QUEUE_HARD_RESET_MODAL_POLISH_V114: stop queue also clears active/stuck jobs. */
/* AVA_BOARD_AUTO_GENERATE_CONFIRM_MODAL_V111: preflight confirm modal for Board auto generate all. */
/* AVA_BOARD_FRONTEND_AUTO_MANUAL_RUNNER_TOPBAR_V110B: move auto manual runner to top toolbar special mode area. */
/* AVA_BOARD_FRONTEND_AUTO_MANUAL_RUNNER_V110: frontend-only auto runner over manual Board video queue. */
/* AVA_BOARD_SELECTED_SCENE_ACCENT_MATCH_CARDS_V62: workspace hue matches scene card hue. */
/* AVA_BOARD_SELECTED_SCENE_ACCENT_RGB_V61: robust selected scene RGB accent. */
/* AVA_BOARD_SELECTED_SCENE_ACCENT_V60C: selected scene color accents Board workspace. */
/* AVA_BOARD_TIMING_DURATION_LOCK_V38: Timing-imported Board scenes have locked duration independent of route. */
/* AVA_BOARD_STILLS_CLEAR_VIDEO_IMMEDIATE_V129R: clear stale videos immediately on still changes and hide stale previews. */
/* AVA_BOARD_BATCH_PHOTO_LOADING_STATUS_V144B: stable photo loading/photo ready labels for packet/zip still imports; first uploaded scene stays ready while the rest loads. */
import { useEffect, useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  AudioLines,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  FileJson,
  Film,
  Image as ImageIcon,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  Save,
  Scissors,
  Sparkles,
  Trash2,
  UploadCloud,
  Volume2,
} from 'lucide-react'
import { useProjects } from '../context/ProjectContext.jsx'
import { apiRequest, buildApiUrl, fetchProtectedBlobUrl, getApiOrigin, normalizeAssetFileUrl, normalizeStaticMediaUrl, registerStaticMediaAsset, uploadMediaAsset } from '../services/apiClient.js'
import WorkflowStageControls from '../components/WorkflowStageControls.jsx'
import { applyCookingPromptMemoryToBoard } from '../lib/cookingPromptMemory.js'
import { isWorkflowStageCleared, clearWorkflowStageClearedMarker, clearWorkflowEntry, readWorkflowEntry, makeWorkflowEntry, rememberWorkflowEntry } from '../utils/workflowNavigation.js'
import '../styles/ava-board.css'

const STAGE = 'board'
const BOARD_VERSION = 'ava_board_foundation_v1'
const AVA_GLOBAL_JOBS_KEY = 'ava:active-jobs:v1'
const AVA_COMPLETED_JOBS_KEY = 'ava:completed-jobs:v1'
const AVA_BOARD_SEEN_COMPLETED_JOBS_KEY = 'ava:board:seen-completed-jobs:v1'
const AVA_OPEN_BOARD_SCENE_KEY = 'ava:open-board-scene:v1'
const AVA_BOARD_STALE_BATCH_UNBLOCK_VERSION = 'v150a' // AVA_BOARD_STALE_BATCH_UNBLOCK_V150A
const AVA_TIMING_TO_BOARD_CONSUMED_PREFIX_V146 = 'ava:timing-to-board-consumed:v146:'

function readAvaGlobalJobs() {
  try {
    return JSON.parse(localStorage.getItem(AVA_GLOBAL_JOBS_KEY) || '[]')
  } catch (error) {
    return []
  }
}

function writeAvaGlobalJobs(jobs) {
  try {
    localStorage.setItem(AVA_GLOBAL_JOBS_KEY, JSON.stringify(Array.isArray(jobs) ? jobs : []))
    window.dispatchEvent(new CustomEvent('ava:jobs-changed'))
  } catch (error) {
    // ignore storage errors
  }
}


function timingToBoardEntryKeyV146(entry = {}) {
  const source = String(entry?.source || '')
  if (source !== 'manual_timing_to_board_confirmed_v16') return ''
  const from = String(entry?.from || '')
  const to = String(entry?.to || '')
  if (from !== 'manual_timing' || to !== 'board') return ''
  return [
    source,
    from,
    to,
    String(entry?.projectId || ''),
    String(entry?.createdAt || ''),
  ].join('|')
}

function isTimingToBoardEntryConsumedV146(entry = {}) {
  if (typeof window === 'undefined') return false
  const key = timingToBoardEntryKeyV146(entry)
  if (!key) return false
  try {
    const storageKey = `${AVA_TIMING_TO_BOARD_CONSUMED_PREFIX_V146}${key}`
    return Boolean(
      window.sessionStorage.getItem(storageKey) ||
      window.localStorage.getItem(storageKey)
    )
  } catch (error) {
    return false
  }
}

function markTimingToBoardEntryConsumedV146(entry = {}) {
  if (typeof window === 'undefined') return
  const key = timingToBoardEntryKeyV146(entry)
  if (!key) return
  try {
    const storageKey = `${AVA_TIMING_TO_BOARD_CONSUMED_PREFIX_V146}${key}`
    const value = JSON.stringify({ at: Date.now(), source: 'AVA_TIMING_TO_BOARD_CONSUME_ONCE_V146' })
    window.sessionStorage.setItem(storageKey, value)
    window.localStorage.setItem(storageKey, value)
  } catch (error) {
    // ignore storage errors
  }
}

const ROUTE_OPTIONS = [
  { value: 'ia2v', label: 'ia2v lip-sync', hint: 'Фото + audio slice сцены' },
  { value: 'ia2v_instrumental', label: 'ia2v instrumental', hint: 'Фото + audio slice сцены, инструмент/объект вместо лица' },
  { value: 'i2v', label: 'i2v', hint: 'Фото → видео без аудио' },
  { value: 'i2v_sound', label: 'i2v sound', hint: 'Фото → видео со звуком из prompt' },
  { value: 'i2v_text', label: 'i2v text', hint: 'Фото → видео + голос/звук из prompt' },
  { value: 'first_last', label: 'first-last', hint: 'Первый и последний кадр' },
  { value: 'first_last_sound', label: 'first-last sound', hint: 'Первый/последний кадр + звук' },
]

const BOARD_ROUTE_WORKFLOW_MAP = {
  i2v: 'image-video.json',
  i2v_text: 'image-video-golos-zvuk.json',
  i2v_sound: 'image-video-golos-zvuk.json',
  ia2v: 'image-lipsink-video-music.json',
  ia2v_lipsync: 'image-lipsink-video-music.json',
  ia2v_instrumental: 'image-lipsink-video-music.json',
  lip_sync: 'image-lipsink-video-music.json',
  first_last: 'last-first cadr-NO sound.json',
  first_last_sound: 'last-first cadr-sound.json',
}


function normalizeBoardRouteValueV154A(value = '') {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return ''
  if (raw === 'ia2v_instrumental' || raw === 'ia2v-instrumental' || raw === 'ia2v instrumental' || raw === 'instrumental' || raw === 'instrument') return 'ia2v_instrumental'
  if (raw === 'ia2v_lipsync' || raw === 'ia2v-lipsync' || raw === 'ia2v lip-sync' || raw === 'ia2v lipsync' || raw === 'lip_sync' || raw === 'lipsync' || raw === 'lip-sync') return 'ia2v'
  if (raw === 'first-last') return 'first_last'
  if (raw === 'first-last-sound' || raw === 'first_last sound') return 'first_last_sound'
  if (raw === 'i2v sound' || raw === 'i2v-sound') return 'i2v_sound'
  if (raw === 'i2v text' || raw === 'i2v-text') return 'i2v_text'
  return raw
}

function isBoardAudioDrivenRouteV154A(value = '') {
  return ['ia2v', 'ia2v_lipsync', 'lip_sync', 'lipsync', 'ia2v_instrumental'].includes(normalizeBoardRouteValueV154A(value))
}

function boardRouteFromTimingOrSavedV154A(rawScene = {}, savedScene = {}) {
  const rawRoute = normalizeBoardRouteValueV154A(
    rawScene?.route || rawScene?.planned_route || rawScene?.plannedRoute || rawScene?.video_route || rawScene?.videoRoute || ''
  )
  const savedRoute = normalizeBoardRouteValueV154A(
    savedScene?.route || savedScene?.planned_route || savedScene?.plannedRoute || savedScene?.video_route || savedScene?.videoRoute || ''
  )

  // Timing -> Board must carry explicit scene route choices from Timing.
  // But ordinary F5/open should not let empty/auto Timing route erase an edited Board route.
  if (rawRoute && rawRoute !== 'auto') return rawRoute
  if (savedRoute && savedRoute !== 'auto') return savedRoute
  return rawRoute || savedRoute || 'i2v'
}

function boardWorkflowKeyForRoute(route, fallbackWorkflowKey = '') {
  const routeKey = normalizeBoardRouteValueV154A(route) || 'i2v'
  // Route is the source of truth. Do not allow a stale scene.workflow_key
  // from another route to override sound/no-sound workflows.
  return BOARD_ROUTE_WORKFLOW_MAP[routeKey] || fallbackWorkflowKey || BOARD_ROUTE_WORKFLOW_MAP.i2v
}

const FORMAT_OPTIONS = [
  { value: '16:9', label: '16:9 горизонтально' },
  { value: '9:16', label: '9:16 вертикально' },
  { value: '1:1', label: '1:1 квадрат' },
  { value: '4:5', label: '4:5 соцсети' },
  { value: '21:9', label: '21:9 кино' },
]


const AVA_BOARD_DURABLE_PREFIX = 'ava:board:durable:v1';

function normalizeBoardMediaUrl(value = '') {
  const raw = asText(value)
  if (!raw) return ''
  const apiOrigin = getApiOrigin()
  if (/^https?:\/\/localhost:8000(\/|$)/i.test(raw)) {
    return raw.replace(/^https?:\/\/localhost:8000/i, apiOrigin)
  }
  if (raw.startsWith('/static/')) return buildApiUrl(raw)
  if (raw.startsWith('/api/')) return buildApiUrl(raw)
  if (raw.startsWith('/assets/')) return buildApiUrl(raw)
  if (/^(https?:|blob:|data:)/i.test(raw)) return raw
  if (raw.startsWith('/')) return buildApiUrl(raw)
  return raw
}

function boardProtectedAssetApiPath(value = '') {
  const asset = normalizeAssetFileUrl(value)
  return asset.assetId ? asset.apiPath : ''
}

function boardStaticMediaUrl(value = '') {
  const normalized = normalizeStaticMediaUrl(value)
  return normalized && normalized.includes('/static/assets/') ? normalized : ''
}

function isProtectedBoardAssetApiPath(value = '') {
  return Boolean(boardProtectedAssetApiPath(value))
}

function boardAudioHasAsset(audio = {}) {
  return Boolean(
    audio?.assetId ||
    audio?.asset_id ||
    audio?.audioAssetId ||
    audio?.audio_asset_id ||
    audio?.assetApiPath ||
    audio?.asset_api_path ||
    audio?.audioApiPath ||
    audio?.audio_api_path
  )
}

function boardNormalizeAudioObjectV194A(audio = {}, fallback = {}) {
  const source = audio && typeof audio === 'object' ? audio : {}
  const extra = fallback && typeof fallback === 'object' ? fallback : {}
  const assetId = firstTextValue(
    source.assetId, source.asset_id, source.audioAssetId, source.audio_asset_id,
    extra.assetId, extra.asset_id, extra.audioAssetId, extra.audio_asset_id,
  )
  const assetApiPath = firstTextValue(
    source.assetApiPath, source.asset_api_path, source.audioApiPath, source.audio_api_path,
    extra.assetApiPath, extra.asset_api_path, extra.audioApiPath, extra.audio_api_path,
    boardCanonicalAssetApiPath(assetId),
  )
  const name = firstTextValue(source.name, source.audioName, source.audio_name, extra.name, extra.audioName, extra.audio_name)
  const durationSec = toNumber(
    source.durationSec ?? source.duration_sec ?? source.audioDurationSec ?? source.audio_duration_sec
      ?? extra.durationSec ?? extra.duration_sec ?? extra.audioDurationSec ?? extra.audio_duration_sec,
    0,
  )
  if (!assetId && !assetApiPath) return null
  return {
    ...extra,
    ...source,
    name,
    audioName: name,
    audio_name: name,
    assetId,
    asset_id: assetId,
    audioAssetId: assetId,
    audio_asset_id: assetId,
    assetApiPath,
    asset_api_path: assetApiPath,
    audioApiPath: assetApiPath,
    audio_api_path: assetApiPath,
    durationSec,
    duration_sec: durationSec,
    audioDurationSec: durationSec,
    audio_duration_sec: durationSec,
  }
}

function boardAudioFromTiming(timing = {}) {
  const audio = timing.audio && typeof timing.audio === 'object' ? timing.audio : {}
  const assetId = audio.assetId || audio.asset_id || timing.audioAssetId || timing.audio_asset_id || ''
  const assetApiPath = audio.assetApiPath || audio.asset_api_path || timing.audioApiPath || timing.audio_api_path || ''
  const name = audio.name || audio.audioName || timing.audioName || timing.audio_name || ''
  const durationSec = audio.durationSec || audio.duration_sec || timing.audioDurationSec || timing.audio_duration_sec || 0
  if (!assetId && !assetApiPath) return null
  return {
    ...audio,
    name,
    assetId,
    asset_id: assetId,
    assetApiPath,
    asset_api_path: assetApiPath,
    durationSec,
    duration_sec: durationSec,
  }
}

function boardAssetApiPathFromRef(...values) {
  for (const value of values) {
    const raw = asText(value)
    if (!raw) continue
    if (raw.startsWith('asset_')) return `/assets/${raw}/file`
    const asset = normalizeAssetFileUrl(raw)
    if (asset.assetId) return asset.apiPath || `/assets/${asset.assetId}/file`
  }
  return ''
}

function firstTextValue(...values) {
  for (const value of values) {
    const text = asText(value)
    if (text) return text
  }
  return ''
}


function boardAssetIdFromRef(...values) {
  for (const value of values) {
    const raw = asText(value)
    if (!raw) continue
    if (raw.startsWith('asset_')) return raw
    const asset = normalizeAssetFileUrl(raw)
    if (asset.assetId) return asset.assetId
  }
  return ''
}

function boardCanonicalAssetApiPath(assetId = '') {
  const safeAssetId = asText(assetId)
  return safeAssetId ? `/assets/${safeAssetId}/file` : ''
}


// AVA_BOARD_FALSE_VIDEO_READY_GUARD_V143A2:
// Keep still-image refs out of video refs. Generic resultUrl/mediaUrl can point to
// uploaded photos, so they must not make a scene look like "видео готово".
function boardRefFingerprintV143A2(value = '') {
  const raw = asText(value)
  if (!raw) return ''
  if (raw.startsWith('asset_')) return raw.toLowerCase()
  const asset = normalizeAssetFileUrl(raw)
  if (asset.assetId) return String(asset.assetId).toLowerCase()
  return raw.trim().toLowerCase()
}

function boardSceneImageRefFingerprintsV143A2(scene = {}) {
  const values = [
    scene?.image_asset_id, scene?.imageAssetId,
    scene?.image_api_path, scene?.imageApiPath,
    scene?.image_url, scene?.imageUrl,
    scene?.first_image_asset_id, scene?.firstImageAssetId,
    scene?.first_frame_asset_id, scene?.firstFrameAssetId,
    scene?.start_image_asset_id, scene?.startImageAssetId,
    scene?.first_image_api_path, scene?.firstImageApiPath,
    scene?.first_frame_api_path, scene?.firstFrameApiPath,
    scene?.start_image_api_path, scene?.startImageApiPath,
    scene?.first_image_url, scene?.firstImageUrl,
    scene?.first_frame_url, scene?.firstFrameUrl,
    scene?.start_image_url, scene?.startImageUrl,
    scene?.last_image_asset_id, scene?.lastImageAssetId,
    scene?.last_frame_asset_id, scene?.lastFrameAssetId,
    scene?.end_image_asset_id, scene?.endImageAssetId,
    scene?.last_image_api_path, scene?.lastImageApiPath,
    scene?.last_frame_api_path, scene?.lastFrameApiPath,
    scene?.end_image_api_path, scene?.endImageApiPath,
    scene?.last_image_url, scene?.lastImageUrl,
    scene?.last_frame_url, scene?.lastFrameUrl,
    scene?.end_image_url, scene?.endImageUrl,
    scene?.resultUrl, scene?.result_url,
    scene?.mediaUrl, scene?.media_url,
  ]
  return new Set(values.map(boardRefFingerprintV143A2).filter(Boolean))
}

function boardSceneVideoRefFingerprintsV143A2(scene = {}) {
  const values = [
    scene?.video_asset_id, scene?.videoAssetId,
    scene?.video_api_path, scene?.videoApiPath,
    scene?.video_url, scene?.videoUrl,
    scene?.result_video_asset_id, scene?.resultVideoAssetId,
    scene?.result_video_api_path, scene?.resultVideoApiPath,
    scene?.result_video_url, scene?.resultVideoUrl,
    scene?.video_result?.video_asset_id, scene?.videoResult?.videoAssetId,
    scene?.video_result?.video_api_path, scene?.videoResult?.videoApiPath,
    scene?.video_result?.video_url, scene?.videoResult?.videoUrl,
  ]
  return values.map(boardRefFingerprintV143A2).filter(Boolean)
}

function boardSceneVideoLooksLikeImageEchoV143A2(scene = {}) {
  const imageRefs = boardSceneImageRefFingerprintsV143A2(scene)
  if (!imageRefs.size) return false
  return boardSceneVideoRefFingerprintsV143A2(scene).some((value) => imageRefs.has(value))
}

function boardDropImageEchoVideoRefsV143A2(scene = {}) {
  if (!scene || typeof scene !== 'object' || !boardSceneVideoLooksLikeImageEchoV143A2(scene)) return scene
  const next = { ...scene }
  ;[
    'video_asset_id', 'videoAssetId',
    'video_api_path', 'videoApiPath',
    'video_url', 'videoUrl',
    'video_static_url', 'videoStaticUrl',
    'video_path', 'videoPath',
    'result_video_asset_id', 'resultVideoAssetId',
    'result_video_api_path', 'resultVideoApiPath',
    'result_video_url', 'resultVideoUrl',
    'video_name', 'videoName',
    'original_video_url', 'originalVideoUrl',
    'video_ready_at', 'videoReadyAt',
    'video_source_image_mutation_epoch', 'videoSourceImageMutationEpoch',
    'video_source_image_mutation_at', 'videoSourceImageMutationAt',
  ].forEach((key) => { next[key] = '' })
  next.video_result = null
  next.videoResult = null
  if (!isVideoBusyStatus(next.video_status || next.videoStatus)) {
    next.video_status = ''
    next.videoStatus = ''
    next.video_error = ''
    next.videoError = ''
    next.video_job_id = ''
    next.videoJobId = ''
    next.video_status_endpoint = ''
    next.videoStatusEndpoint = ''
    next.video_queue_position = 0
    next.videoQueuePosition = 0
  }
  return next
}

function canonicalizeSceneAssetFields(scene = {}, config = {}) {
  const next = { ...scene }
  const assetId = boardAssetIdFromRef(...(config.assetKeys || []).map((key) => next?.[key]), ...(config.refKeys || []).map((key) => next?.[key]))
  if (!assetId) return next

  const assetApiPath = boardCanonicalAssetApiPath(assetId)
  for (const key of config.assetKeys || []) next[key] = assetId
  for (const key of config.apiKeys || []) next[key] = assetApiPath
  for (const key of config.urlKeys || []) next[key] = assetApiPath
  return next
}

function canonicalizeBoardSceneMediaRefs(scene = {}) {
  let next = { ...scene }

  next = canonicalizeSceneAssetFields(next, {
    assetKeys: ['video_asset_id', 'videoAssetId'],
    apiKeys: ['video_api_path', 'videoApiPath'],
    urlKeys: ['video_url', 'videoUrl'],
    refKeys: [
      'video_asset_id', 'videoAssetId',
      'video_api_path', 'videoApiPath',
      'video_url', 'videoUrl',
      'result_video_asset_id', 'resultVideoAssetId',
      'result_video_api_path', 'resultVideoApiPath',
      'result_video_url', 'resultVideoUrl',
    ],
  })

  next = canonicalizeSceneAssetFields(next, {
    assetKeys: ['mmaudio_video_asset_id', 'mmaudioVideoAssetId'],
    apiKeys: ['mmaudio_video_api_path', 'mmaudioVideoApiPath'],
    urlKeys: ['mmaudio_video_url', 'mmaudioVideoUrl'],
    refKeys: ['mmaudio_video_api_path', 'mmaudioVideoApiPath', 'mmaudio_video_url', 'mmaudioVideoUrl'],
  })

  next = canonicalizeSceneAssetFields(next, {
    assetKeys: ['image_asset_id', 'imageAssetId'],
    apiKeys: ['image_api_path', 'imageApiPath'],
    urlKeys: ['image_url', 'imageUrl'],
    refKeys: ['image_api_path', 'imageApiPath', 'image_url', 'imageUrl', 'resultUrl', 'result_url'],
  })

  next = canonicalizeSceneAssetFields(next, {
    assetKeys: ['first_image_asset_id', 'firstImageAssetId', 'first_frame_asset_id', 'firstFrameAssetId', 'start_image_asset_id', 'startImageAssetId'],
    apiKeys: ['first_image_api_path', 'firstImageApiPath', 'first_frame_api_path', 'firstFrameApiPath', 'start_image_api_path', 'startImageApiPath'],
    urlKeys: ['first_frame_url', 'firstFrameUrl', 'first_image_url', 'firstImageUrl', 'start_image_url', 'startImageUrl'],
    refKeys: ['first_image_api_path', 'firstImageApiPath', 'first_image_url', 'firstImageUrl', 'first_frame_api_path', 'firstFrameApiPath', 'first_frame_url', 'firstFrameUrl', 'start_image_api_path', 'startImageApiPath', 'start_image_url', 'startImageUrl'],
  })

  next = canonicalizeSceneAssetFields(next, {
    assetKeys: ['last_image_asset_id', 'lastImageAssetId', 'last_frame_asset_id', 'lastFrameAssetId', 'end_image_asset_id', 'endImageAssetId'],
    apiKeys: ['last_image_api_path', 'lastImageApiPath', 'last_frame_api_path', 'lastFrameApiPath', 'end_image_api_path', 'endImageApiPath'],
    urlKeys: ['last_frame_url', 'lastFrameUrl', 'last_image_url', 'lastImageUrl', 'end_image_url', 'endImageUrl'],
    refKeys: ['last_image_api_path', 'lastImageApiPath', 'last_image_url', 'lastImageUrl', 'last_frame_api_path', 'lastFrameApiPath', 'last_frame_url', 'lastFrameUrl', 'end_image_api_path', 'endImageApiPath', 'end_image_url', 'endImageUrl'],
  })

  // AVA_BOARD_MANUAL_LIPSYNC_F5_AUDIO_V129C:
  // Audio slices are server assets too. Canonicalize them just like image/video refs
  // so manual lip-sync audio survives F5 and is sent to /clip/video/start as /assets/<id>/file.
  next = canonicalizeSceneAssetFields(next, {
    assetKeys: [
      'audio_slice_asset_id', 'audioSliceAssetId',
      'audio_asset_id', 'audioAssetId',
      'manual_lipsync_audio_asset_id', 'manualLipSyncAudioAssetId',
    ],
    apiKeys: [
      'audio_slice_api_path', 'audioSliceApiPath',
      'audio_api_path', 'audioApiPath',
      'manual_lipsync_audio_api_path', 'manualLipSyncAudioApiPath',
    ],
    urlKeys: [
      'audio_slice_url', 'audioSliceUrl',
      'audio_url', 'audioUrl',
      'manual_lipsync_audio_url', 'manualLipSyncAudioUrl',
    ],
    refKeys: [
      'audio_slice_asset_id', 'audioSliceAssetId',
      'audio_asset_id', 'audioAssetId',
      'manual_lipsync_audio_asset_id', 'manualLipSyncAudioAssetId',
      'audio_slice_api_path', 'audioSliceApiPath',
      'audio_slice_url', 'audioSliceUrl',
      'audio_api_path', 'audioApiPath',
      'audio_url', 'audioUrl',
      'manual_lipsync_audio_api_path', 'manualLipSyncAudioApiPath',
      'manual_lipsync_audio_url', 'manualLipSyncAudioUrl',
    ],
  })

  return boardDropImageEchoVideoRefsV143A2(next)
}

function canonicalizeBoardMediaRefs(boardData = {}) {
  if (!boardData || typeof boardData !== 'object') return boardData
  const scenes = Array.isArray(boardData.scenes)
    ? asSceneArray(boardData.scenes).map((scene) => canonicalizeBoardSceneMediaRefs(scene))
    : boardData.scenes
  return { ...boardData, scenes }
}

function normalizeMediaRef(input, context = {}) {
  const fallback = {
    assetId: null,
    assetApiPath: null,
    imageUrl: null,
    videoUrl: null,
    runtimeUrl: null,
  }
  if (!input || typeof input !== 'object') {
    console.warn('[MEDIA NULL FALLBACK]', {
      sceneId: context.sceneId || '',
      field: context.field || context.slot || '',
      type: input === null ? 'null' : typeof input,
    })
    return fallback
  }
  return {
    ...fallback,
    ...input,
    assetId: input.assetId || input.asset_id || null,
    assetApiPath: input.assetApiPath || input.asset_api_path || null,
    imageUrl: input.imageUrl || input.image_url || input.url || null,
    videoUrl: input.videoUrl || input.video_url || input.url || null,
    runtimeUrl: input.runtimeUrl || input.runtime_url || null,
  }
}

function safeMediaObject(value, context = {}) {
  if (value && typeof value === 'object') return value
  normalizeMediaRef(value, context)
  return {}
}

function sceneMediaFieldValue(scene = {}, slot = 'image', kind = 'apiPath') {
  if (!isPlainObject(scene)) return ''
  const safeScene = safeMediaObject(scene, { sceneId: scene?.id || scene?.scene_id || '', slot, field: 'scene' })
  if (slot === 'video') {
    if (kind === 'apiPath') {
      return boardAssetApiPathFromRef(
        safeScene.mmaudio_video_api_path,
        safeScene.mmaudioVideoApiPath,
        safeScene.mmaudio_video_asset_id,
        safeScene.mmaudioVideoAssetId,
        safeScene.video_api_path,
        safeScene.videoApiPath,
        safeScene.video_asset_id,
        safeScene.videoAssetId,
        safeScene.resultVideoApiPath,
        safeScene.result_video_api_path,
        safeScene.video_result?.video_api_path,
        safeScene.videoResult?.videoApiPath
      )
    }
    return firstTextValue(
      safeScene.mmaudio_video_url,
      safeScene.mmaudioVideoUrl,
      safeScene.video_url,
      safeScene.videoUrl,
      safeScene.resultVideoUrl,
      safeScene.result_video_url,
      safeScene.video_result?.video_url,
      safeScene.videoResult?.videoUrl
    )
  }

  if (slot === 'first') {
    if (kind === 'apiPath') {
      return boardAssetApiPathFromRef(
        safeScene.first_image_api_path,
        safeScene.firstImageApiPath,
        safeScene.first_image_asset_id,
        safeScene.firstImageAssetId,
        safeScene.first_frame_api_path,
        safeScene.firstFrameApiPath,
        safeScene.first_frame_asset_id,
        safeScene.firstFrameAssetId,
        safeScene.start_image_api_path,
        safeScene.startImageApiPath,
        safeScene.start_image_asset_id,
        safeScene.startImageAssetId,
        safeScene.image_api_path,
        safeScene.imageApiPath,
        safeScene.image_asset_id,
        safeScene.imageAssetId
      )
    }
    return firstTextValue(
      safeScene.first_frame_url,
      safeScene.firstFrameUrl,
      safeScene.first_image_url,
      safeScene.firstImageUrl,
      safeScene.start_image_url,
      safeScene.startImageUrl,
      safeScene.image_url,
      safeScene.imageUrl,
      safeScene.mediaUrl,
      safeScene.media_url
    )
  }

  if (slot === 'last') {
    if (kind === 'apiPath') {
      return boardAssetApiPathFromRef(
        safeScene.last_image_api_path,
        safeScene.lastImageApiPath,
        safeScene.last_image_asset_id,
        safeScene.lastImageAssetId,
        safeScene.last_frame_api_path,
        safeScene.lastFrameApiPath,
        safeScene.last_frame_asset_id,
        safeScene.lastFrameAssetId,
        safeScene.end_image_api_path,
        safeScene.endImageApiPath,
        safeScene.end_image_asset_id,
        safeScene.endImageAssetId
      )
    }
    return firstTextValue(
      safeScene.last_frame_url,
      safeScene.lastFrameUrl,
      safeScene.last_image_url,
      safeScene.lastImageUrl,
      safeScene.end_image_url,
      safeScene.endImageUrl
    )
  }

  if (kind === 'apiPath') {
    return boardAssetApiPathFromRef(
      safeScene.image_api_path,
      safeScene.imageApiPath,
      safeScene.image_asset_id,
      safeScene.imageAssetId,
      safeScene.first_image_api_path,
      safeScene.firstImageApiPath,
      safeScene.first_image_asset_id,
      safeScene.firstImageAssetId,
      safeScene.first_frame_api_path,
      safeScene.firstFrameApiPath
    )
  }
  return firstTextValue(
    safeScene.image_url,
    safeScene.imageUrl,
    safeScene.mediaUrl,
    safeScene.media_url,
    safeScene.resultUrl,
    safeScene.result_url,
    safeScene.first_frame_url,
    safeScene.firstFrameUrl,
    safeScene.start_image_url,
    safeScene.startImageUrl
  )
}

const BOARD_MEDIA_REF_KEYS = [
  'video_asset_id', 'videoAssetId', 'video_api_path', 'videoApiPath', 'video_url', 'videoUrl',
  'mmaudio_video_asset_id', 'mmaudioVideoAssetId', 'mmaudio_video_api_path', 'mmaudioVideoApiPath', 'mmaudio_video_url', 'mmaudioVideoUrl',
  'image_asset_id', 'imageAssetId', 'image_api_path', 'imageApiPath', 'image_url', 'imageUrl',
  'first_image_asset_id', 'firstImageAssetId', 'first_image_api_path', 'firstImageApiPath', 'first_frame_api_path', 'firstFrameApiPath', 'first_frame_url', 'firstFrameUrl',
  'last_image_asset_id', 'lastImageAssetId', 'last_image_api_path', 'lastImageApiPath', 'last_frame_api_path', 'lastFrameApiPath', 'last_frame_url', 'lastFrameUrl',
]

function isEmptyMediaRefValue(value) {
  return value === '' || value === null || value === undefined
}

function mergePreserveMediaRefs(prevScene = {}, nextScene = {}) {
  const merged = { ...(nextScene || {}) }
  for (const key of BOARD_MEDIA_REF_KEYS) {
    if (!isEmptyMediaRefValue(prevScene?.[key]) && isEmptyMediaRefValue(merged[key])) {
      merged[key] = prevScene[key]
    }
  }
  return merged
}

function sceneStaticMediaCandidate(scene = {}, slot = 'video') {
  const value = sceneMediaFieldValue(scene, slot, 'url')
  return boardStaticMediaUrl(value)
}

// AVA_BOARD_DURABLE_RUNTIME_CYCLE_GUARD_V135J:
// Durable/local save sanitizing must never crash the UI if a circular/deep runtime
// object accidentally gets into board state. Keep media refs, drop unsafe runtime loops.
function stripBoardDurableRuntimePayload(value, key = '', seen = new WeakSet()) {
  if (Array.isArray(value)) {
    if (seen.has(value)) return []
    seen.add(value)
    return value.map((item) => stripBoardDurableRuntimePayload(item, key, seen))
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && /^(data:|blob:)/i.test(value)) return ''
    return value
  }

  if (seen.has(value)) return {}
  seen.add(value)

  const stripped = {}
  for (const [field, fieldValue] of Object.entries(value)) {
    const lower = String(field || '').toLowerCase()
    if (
      lower.includes('image_data_url') ||
      lower.includes('imagedataurl') ||
      lower.includes('base64') ||
      lower === 'raw' ||
      lower === 'payload'
    ) {
      continue
    }
    if (typeof fieldValue === 'string' && /^(data:|blob:)/i.test(fieldValue)) {
      stripped[field] = ''
      continue
    }
    stripped[field] = stripBoardDurableRuntimePayload(fieldValue, field, seen)
  }
  return stripped
}

function sanitizeBoardDurableBackup(boardData = {}) {
  return stripBoardDurableRuntimePayload(boardData)
}

function boardSaveVerifyScene(boardData = {}) {
  const scenes = asArray(boardData.scenes)
  return scenes.find((scene) => (
    scene?.video_asset_id || scene?.videoAssetId ||
    scene?.video_api_path || scene?.videoApiPath ||
    scene?.image_asset_id || scene?.imageAssetId ||
    scene?.image_api_path || scene?.imageApiPath
  )) || scenes[0] || {}
}

function boardDurableKey({ projectId = '', workspaceMode = true } = {}) {
  const projectPart = workspaceMode ? 'workspace' : `project:${String(projectId || 'unknown')}`;
  return `${AVA_BOARD_DURABLE_PREFIX}:${projectPart}`;
}

function readBoardDurableBackup(key = '') {
  if (!key || typeof localStorage === 'undefined') return null;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.scenes)) return null;
    return parsed;
  } catch (error) {
    console.warn('[BOARD DURABLE] read failed', { key, error });
    return null;
  }
}

function writeBoardDurableBackup(key = '', boardData = {}) {
  if (!key || typeof localStorage === 'undefined') return;

  try {
    // AVA_BOARD_DURABLE_VIDEO_REF_GUARD_V132W:
    // Never let an autosave/reload paint with fewer video refs overwrite a richer durable cache.
    // The project snapshot still remains source of truth, but this prevents the next Board entry
    // from booting from a locally stripped copy before server rehydrate finishes.
    const canonicalBoardData = applyCookingPromptMemoryToBoard(canonicalizeBoardMediaRefs(boardData))
    const existingDurableV132W = readBoardDurableBackup(key)
    let durableSourceV132W = canonicalBoardData
    try {
      if (existingDurableV132W && Array.isArray(existingDurableV132W.scenes)) {
        const existingScoreV132W = boardVideoStateScoreV131N(existingDurableV132W)
        const incomingScoreV132W = boardVideoStateScoreV131N(canonicalBoardData)
        if (existingScoreV132W > incomingScoreV132W) {
          durableSourceV132W = boardMergeServerVideoStateV131N(canonicalBoardData, existingDurableV132W)
          console.log('[BOARD DURABLE VIDEO REFS PRESERVED V132W]', {
            existingScore: existingScoreV132W,
            incomingScore: incomingScoreV132W,
          })
        }
      }
    } catch (guardErrorV132W) {
      console.warn('[BOARD DURABLE VIDEO REF GUARD V132W] skipped', guardErrorV132W)
    }
    const payload = {
      ...sanitizeBoardDurableBackup(durableSourceV132W),
      boardVersion: durableSourceV132W?.boardVersion || BOARD_VERSION,
      durableSavedAt: new Date().toISOString(),
      updatedAt: durableSourceV132W?.updatedAt || new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    console.warn('[BOARD DURABLE] write failed', { key, error });
  }
}

function removeBoardDurableBackup(key = '') {
  if (!key || typeof localStorage === 'undefined') return;

  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function boardSceneIdentity(scene = {}) {
  return asText(scene.scene_id || scene.id);
}

function boardHasManualScenes(boardData = {}) {
  return asArray(boardData?.scenes).some((scene) => (
    scene?.source === 'manual_board_scene' ||
    scene?.importedFrom === 'manual_board'
  ));
}

function boardLooksTimingImported(boardData = {}) {
  const existing = boardData?.board || boardData || {};
  if (existing?.importedFrom === 'manual_timing' || existing?.source === 'manual_timing') return true;
  return asArray(existing?.scenes).some((scene) => (
    scene?.importedFrom === 'manual_timing' ||
    scene?.source === 'manual_timing' ||
    scene?.blockTitle ||
    scene?.block_id ||
    asArray(scene?.source_phrase_ids).length > 0
  ));
}

function boardDataForStandaloneEntry(boardData = {}) {
  const existing = boardData?.board || boardData || {};
  const scenes = asArray(existing?.scenes);

  const manualScenes = scenes.filter((scene) => (
    scene?.source === 'manual_board_scene' ||
    scene?.importedFrom === 'manual_board'
  ));

  if (manualScenes.length) {
    const selectedId = existing.selectedSceneId || existing.selected_scene_id || '';
    const selectedStillExists = manualScenes.some((scene) => (
      (scene.id || scene.scene_id) === selectedId
    ));

    return {
      ...existing,
      importedFrom: 'manual_board',
      source: existing.source || 'manual_board',
      scenes: manualScenes,
      selectedSceneId: selectedStillExists ? selectedId : (manualScenes[0]?.id || manualScenes[0]?.scene_id || ''),
    };
  }

  if (boardLooksTimingImported(existing)) {
    return {
      ...emptyBoard,
      source: 'standalone_board',
      importedFrom: 'standalone_board',
      updatedAt: new Date().toISOString(),
    };
  }

  return existing;
}


// AVA_BOARD_SERVER_BATCH_REFRESH_UI_V131N:
// Server batch now owns "Сгенерировать все". These helpers make loaded/polled
// server snapshots win over stale local durable cache when they contain newer
// video/job/batch state. This fixes F5 wiping "queued/ready" badges and videos
// not appearing in Board until manual reopen.
const BOARD_SERVER_BATCH_ACTIVE_STATUSES_V131N = new Set(['queued', 'running', 'starting', 'preparing', 'submitting', 'queued_no_prompt_id'])

function boardSceneVideoStateScoreV131N(scene = {}) {
  if (!scene || typeof scene !== 'object') return 0
  let score = 0
  if (scene.video_asset_id || scene.videoAssetId || scene.video_api_path || scene.videoApiPath || scene.video_url || scene.videoUrl) score += 1000
  // AVA_BOARD_RELOAD_VIDEO_REHYDRATE_V132T: score backend result refs and review marks too, otherwise stale local durable cache may hide the returned video after F5.
  if (scene.result_video_asset_id || scene.resultVideoAssetId || scene.result_video_api_path || scene.resultVideoApiPath || scene.result_video_url || scene.resultVideoUrl || scene.result_url || scene.resultUrl) score += 1000
  const reviewStatusV132T = String(scene.video_review_status || scene.videoReviewStatus || scene.review_status || scene.reviewStatus || '').toLowerCase()
  if (['needs_review', 'review', 'check', 'посмотри', 'на проверку'].includes(reviewStatusV132T)) score += 650
  if (['bad', 'poor', 'reject', 'rejected', 'плохое', 'плохая'].includes(reviewStatusV132T)) score += 320
  if (scene.video_result || scene.videoResult) score += 300
  if (scene.video_job_id || scene.videoJobId || scene.video_status_endpoint || scene.videoStatusEndpoint) score += 100
  const status = String(scene.video_status || scene.videoStatus || '').toLowerCase()
  if (['ready', 'completed', 'done', 'success'].includes(status)) score += 500
  if (BOARD_SERVER_BATCH_ACTIVE_STATUSES_V131N.has(status)) score += 80
  const queuePosition = Number(scene.video_queue_position || scene.videoQueuePosition || 0)
  if (queuePosition > 0) score += 10
  return score
}

function boardVideoStateScoreV131N(boardData = {}) {
  const scenes = asArray(boardData?.scenes)
  let score = scenes.reduce((sum, scene) => sum + boardSceneVideoStateScoreV131N(scene), 0)
  const queue = boardData?.video_queue || boardData?.videoQueue || {}
  const batch = boardData?.video_batch || boardData?.videoBatch || boardData?.board_video_batch || boardData?.boardVideoBatch || {}
  const queueWaiting = asArray(queue.waitingSceneIds || queue.waiting_scene_ids)
  const batchWaiting = asArray(batch.waitingSceneIds || batch.waiting_scene_ids || batch.queued || batch.queuedSceneIds || batch.queued_scene_ids)
  score += queueWaiting.length * 15
  score += batchWaiting.length * 15
  const status = String(batch.status || batch.batch_status || batch.video_status || '').toLowerCase()
  if (BOARD_SERVER_BATCH_ACTIVE_STATUSES_V131N.has(status)) score += 250
  if (batch.batchId || batch.batch_id || batch.id) score += 80
  return score
}

const BOARD_SERVER_VIDEO_KEYS_V131N = [
  'video_url', 'videoUrl',
  'video_api_path', 'videoApiPath',
  'video_asset_id', 'videoAssetId',
  'video_static_url', 'videoStaticUrl',
  'video_path', 'videoPath',
  'video_result', 'videoResult',
  'video_status', 'videoStatus',
  'video_error', 'videoError',
  'video_job_id', 'videoJobId',
  'video_status_endpoint', 'videoStatusEndpoint',
  'video_queue_position', 'videoQueuePosition',
  'video_queue_source', 'videoQueueSource',
  'video_review', 'videoReview',
  'video_review_state', 'videoReviewState',
  'last_video_job_id', 'lastVideoJobId',
  'result_video_url', 'resultVideoUrl',
  'result_video_api_path', 'resultVideoApiPath',
  'result_video_asset_id', 'resultVideoAssetId',
  // AVA_BOARD_RELOAD_VIDEO_REHYDRATE_V132T: keep review/status/source binding from server snapshot.
  'video_review_status', 'videoReviewStatus',
  'review_status', 'reviewStatus',
  'video_review_updated_at', 'videoReviewUpdatedAt',
  'video_review_reason', 'videoReviewReason',
  'video_review_regenerate_from_bad', 'videoReviewRegenerateFromBad',
  'video_source_image_mutation_epoch', 'videoSourceImageMutationEpoch',
  'video_source_image_mutation_at', 'videoSourceImageMutationAt',
  'video_ready_at', 'videoReadyAt',
  'video_name', 'videoName',
  // AVA_BOARD_SERVER_CLEAR_WINS_V200I: keep backend stale/orphan clear markers.
  'video_interrupted_reason', 'videoInterruptedReason',
  'video_runtime_status_v136i', 'videoRuntimeStatusV136I',
  'video_runtime_job_id_v136i', 'videoRuntimeJobIdV136I',
  'video_runtime_status_endpoint_v136i', 'videoRuntimeStatusEndpointV136I',
]

function boardMergeServerVideoStateV131N(baseBoard = {}, serverBoard = {}) {
  if (!serverBoard || !Array.isArray(serverBoard.scenes)) return baseBoard || {}
  const baseScenes = asArray(baseBoard?.scenes)
  const serverScenes = asArray(serverBoard?.scenes)
  if (!baseScenes.length) return serverBoard || {}

  const serverById = new Map(serverScenes.map((scene) => [asText(scene?.id || scene?.scene_id), scene]))
  let changed = false
  const scenes = baseScenes.map((scene) => {
    const id = asText(scene?.id || scene?.scene_id)
    const serverScene = serverById.get(id)
    if (!serverScene) return scene

    const serverScore = boardSceneVideoStateScoreV131N(serverScene)
    const localScore = boardSceneVideoStateScoreV131N(scene)
    const hasServerVideoRefV132T = Boolean(
      serverScene.video_asset_id || serverScene.videoAssetId ||
      serverScene.video_api_path || serverScene.videoApiPath ||
      serverScene.video_url || serverScene.videoUrl ||
      serverScene.result_video_asset_id || serverScene.resultVideoAssetId ||
      serverScene.result_video_api_path || serverScene.resultVideoApiPath ||
      serverScene.result_video_url || serverScene.resultVideoUrl ||
      serverScene.result_url || serverScene.resultUrl
    )
    const serverReviewStatusV132T = String(serverScene.video_review_status || serverScene.videoReviewStatus || serverScene.review_status || serverScene.reviewStatus || '').toLowerCase()
    const hasServerReviewStatusV132T = ['bad', 'poor', 'reject', 'rejected', 'плохое', 'плохая', 'needs_review', 'review', 'check', 'посмотри', 'на проверку'].includes(serverReviewStatusV132T)
    // AVA_BOARD_SERVER_CLEAR_WINS_V200I:
    // V200H can clear an orphaned job in the saved server snapshot. That cleaned
    // server scene has a LOWER score than the stale local scene because the job id
    // and running status were removed. Without this explicit rule the UI keeps
    // showing "видео делается" until a hard manual reset.
    const localStatusV200I = String(scene.video_status || scene.videoStatus || '').toLowerCase()
    const serverStatusV200I = String(serverScene.video_status || serverScene.videoStatus || '').toLowerCase()
    const localHasJobV200I = Boolean(scene.video_job_id || scene.videoJobId || scene.video_status_endpoint || scene.videoStatusEndpoint)
    const serverHasJobV200I = Boolean(serverScene.video_job_id || serverScene.videoJobId || serverScene.video_status_endpoint || serverScene.videoStatusEndpoint)
    const serverClearReasonV200I = String(
      serverScene.video_interrupted_reason || serverScene.videoInterruptedReason ||
      serverScene.video_error || serverScene.videoError ||
      serverScene.video_result?.error || serverScene.videoResult?.error || ''
    ).toLowerCase()
    const serverLooksClearedV200I = localHasJobV200I &&
      BOARD_SERVER_BATCH_ACTIVE_STATUSES_V131N.has(localStatusV200I) &&
      !serverHasJobV200I &&
      !BOARD_SERVER_BATCH_ACTIVE_STATUSES_V131N.has(serverStatusV200I) &&
      (
        serverClearReasonV200I.includes('stale') ||
        serverClearReasonV200I.includes('orphan') ||
        serverClearReasonV200I.includes('not_live') ||
        serverClearReasonV200I.includes('v200h') ||
        serverClearReasonV200I.includes('board_video_job_orphaned')
      )
    const shouldCopy = serverLooksClearedV200I || serverScore > localScore || hasServerVideoRefV132T || hasServerReviewStatusV132T
    if (!shouldCopy) return scene

    const next = { ...scene }
    for (const key of BOARD_SERVER_VIDEO_KEYS_V131N) {
      if (Object.prototype.hasOwnProperty.call(serverScene, key)) {
        next[key] = serverScene[key]
      }
    }

    // AVA_BOARD_SERVER_BATCH_VIDEO_EPOCH_READY_V131O:
    // Backend server batch may register a fresh video asset without the frontend-only
    // video_source_image_mutation_epoch marker. Board then treats the new video as
    // stale and keeps the card badge at "кадр обновлён" after F5/refresh.
    // When server snapshot brings a real video ref, bind it to the current image epoch
    // and mark it ready so the UI can show the returned video immediately.
    const hasServerVideoRefV131O = Boolean(
      serverScene.video_asset_id || serverScene.videoAssetId ||
      serverScene.video_api_path || serverScene.videoApiPath ||
      serverScene.video_url || serverScene.videoUrl ||
      serverScene.result_video_asset_id || serverScene.resultVideoAssetId ||
      serverScene.result_video_api_path || serverScene.resultVideoApiPath ||
      serverScene.result_video_url || serverScene.resultVideoUrl
    )
    if (serverLooksClearedV200I) {
      next.video_status = serverScene.video_status || ''
      next.videoStatus = serverScene.videoStatus || serverScene.video_status || ''
      next.video_job_id = ''
      next.videoJobId = ''
      next.video_status_endpoint = ''
      next.videoStatusEndpoint = ''
      next.video_queue_position = 0
      next.videoQueuePosition = 0
      next.video_queue_source = ''
      next.videoQueueSource = ''
      next.video_runtime_status_v136i = ''
      next.videoRuntimeStatusV136I = ''
      next.video_runtime_job_id_v136i = ''
      next.videoRuntimeJobIdV136I = ''
      next.video_runtime_status_endpoint_v136i = ''
      next.videoRuntimeStatusEndpointV136I = ''
      next.video_error = serverScene.video_error || serverScene.videoError || serverClearReasonV200I || 'stale_job_cleared_by_server_v200i'
      next.videoError = next.video_error
      next.video_interrupted_reason = serverScene.video_interrupted_reason || serverScene.videoInterruptedReason || next.video_error
      next.videoInterruptedReason = next.video_interrupted_reason
      next.video_updated_at = serverScene.video_updated_at || serverScene.videoUpdatedAt || new Date().toISOString()
      next.videoUpdatedAt = next.video_updated_at
      console.log('[BOARD SERVER CLEAR APPLIED V200I]', {
        sceneId: id,
        previousStatus: localStatusV200I,
        reason: next.video_interrupted_reason || next.video_error || '',
      })
    }

    if (hasServerVideoRefV131O) {
      const imageEpochV131O = Number(
        next.image_mutation_epoch ?? next.imageMutationEpoch ??
        serverScene.image_mutation_epoch ?? serverScene.imageMutationEpoch ??
        0
      )
      const hasVideoEpochV131O = Boolean(
        next.video_source_image_mutation_epoch ||
        next.videoSourceImageMutationEpoch ||
        serverScene.video_source_image_mutation_epoch ||
        serverScene.videoSourceImageMutationEpoch
      )
      if (imageEpochV131O > 0 && !hasVideoEpochV131O) {
        next.video_source_image_mutation_epoch = imageEpochV131O
        next.videoSourceImageMutationEpoch = imageEpochV131O
      }
      const nowV131O = new Date().toISOString()
      if (!next.video_source_image_mutation_at && !next.videoSourceImageMutationAt) {
        const imageAtV131O = next.image_mutation_at || next.imageMutationAt || serverScene.image_mutation_at || serverScene.imageMutationAt || nowV131O
        next.video_source_image_mutation_at = imageAtV131O
        next.videoSourceImageMutationAt = imageAtV131O
      }
      // AVA_BOARD_BATCH_READY_UI_WINS_V148A:
      // A backend server-batch result/video ref is authoritative. Old browser pollers or
      // runtime batch overlays may still carry queued/running job fields for the same scene;
      // if those fields win, the UI keeps showing “видео делается” even though the asset is saved.
      next.video_status = 'ready'
      next.videoStatus = 'ready'
      next.video_job_id = ''
      next.videoJobId = ''
      next.video_status_endpoint = ''
      next.videoStatusEndpoint = ''
      next.video_queue_position = 0
      next.videoQueuePosition = 0
      next.video_error = ''
      next.videoError = ''
      next.video_queue_source = ''
      next.videoQueueSource = ''
      next.video_runtime_status_v136i = ''
      next.videoRuntimeStatusV136I = ''
      next.video_runtime_job_id_v136i = ''
      next.videoRuntimeJobIdV136I = ''
      next.video_runtime_status_endpoint_v136i = ''
      next.videoRuntimeStatusEndpointV136I = ''
      next.video_ready_at = next.video_ready_at || next.videoReadyAt || nowV131O
      next.videoReadyAt = next.videoReadyAt || next.video_ready_at || nowV131O
    }

    changed = true
    return canonicalizeBoardSceneMediaRefs(next)
  })

  const nextBoard = {
    ...(baseBoard || {}),
    scenes,
    video_queue: serverBoard.video_queue || serverBoard.videoQueue || baseBoard.video_queue || baseBoard.videoQueue || {},
    videoQueue: serverBoard.videoQueue || serverBoard.video_queue || baseBoard.videoQueue || baseBoard.video_queue || {},
    video_batch: serverBoard.video_batch || serverBoard.videoBatch || serverBoard.board_video_batch || serverBoard.boardVideoBatch || baseBoard.video_batch || baseBoard.videoBatch || {},
    videoBatch: serverBoard.videoBatch || serverBoard.video_batch || serverBoard.boardVideoBatch || serverBoard.board_video_batch || baseBoard.videoBatch || baseBoard.video_batch || {},
    board_video_batch: serverBoard.board_video_batch || serverBoard.video_batch || serverBoard.videoBatch || baseBoard.board_video_batch || baseBoard.video_batch || {},
    boardVideoBatch: serverBoard.boardVideoBatch || serverBoard.videoBatch || serverBoard.video_batch || baseBoard.boardVideoBatch || baseBoard.videoBatch || {},
    updatedAt: serverBoard.updatedAt || baseBoard.updatedAt || new Date().toISOString(),
  }

  if (!changed && boardVideoStateScoreV131N(serverBoard) <= boardVideoStateScoreV131N(baseBoard)) return baseBoard || {}
  return nextBoard
}

// AVA_BOARD_STALE_JOB_UI_V200E:
// Server-batch refresh polling must be active-only. The old score-based test returned true
// for any board that already had videos/job history, causing endless /board/video-batch/status
// + /snapshots/board calls after F5 even when no backend batch was running.
function boardServerBatchActiveInfoV200E(boardData = {}) {
  // AVA_BOARD_SERVER_BATCH_STALE_POINTERS_V200G:
  // Old snapshots can keep activeJobId/activeSceneId even after backend restart.
  // Do not treat those stale pointers as an active backend batch unless the batch
  // status itself is active. This stops endless /board/video-batch/status + snapshot
  // refresh after F5 when no real server batch is running.
  const queue = boardData?.video_queue || boardData?.videoQueue || {}
  const batch = boardData?.video_batch || boardData?.videoBatch || boardData?.board_video_batch || boardData?.boardVideoBatch || {}
  const status = String(batch.status || batch.batch_status || batch.video_status || queue.status || queue.batch_status || '').toLowerCase()
  const activeStatuses = BOARD_SERVER_BATCH_ACTIVE_STATUSES_V131N
  const terminalStatuses = new Set([
    '', 'idle', 'ready', 'done', 'completed', 'success', 'error', 'failed',
    'canceled', 'cancelled', 'stopped', 'interrupted', 'interrupted_after_backend_reload',
    'orphaned_after_reload', 'backend_reload_orphaned_batch_v150a',
  ])
  if (activeStatuses.has(status)) return true
  if (terminalStatuses.has(status)) return false

  const queueWaiting = asArray(queue.waitingSceneIds || queue.waiting_scene_ids)
  const batchWaiting = asArray(batch.waitingSceneIds || batch.waiting_scene_ids || batch.queued || batch.queuedSceneIds || batch.queued_scene_ids)
  const activeSceneId = asText(batch.activeSceneId || batch.active_scene_id || queue.activeSceneId || queue.active_scene_id)
  const activeJobId = asText(batch.activeJobId || batch.active_job_id || queue.activeJobId || queue.active_job_id)
  const activeEndpoint = asText(batch.activeStatusEndpoint || batch.active_status_endpoint || queue.activeStatusEndpoint || queue.active_status_endpoint)
  return Boolean(status && (queueWaiting.length || batchWaiting.length || activeSceneId || activeJobId || activeEndpoint))
}

function boardServerBatchPollTokenV200E(boardData = {}) {
  const queue = boardData?.video_queue || boardData?.videoQueue || {}
  const batch = boardData?.video_batch || boardData?.videoBatch || boardData?.board_video_batch || boardData?.boardVideoBatch || {}
  const waiting = [
    ...asArray(queue.waitingSceneIds || queue.waiting_scene_ids),
    ...asArray(batch.waitingSceneIds || batch.waiting_scene_ids || batch.queued || batch.queuedSceneIds || batch.queued_scene_ids),
  ].map((item) => asText(item)).filter(Boolean).join(',')
  return [
    asText(batch.batchId || batch.batch_id || batch.id),
    String(batch.status || batch.batch_status || batch.video_status || '').toLowerCase(),
    asText(batch.activeSceneId || batch.active_scene_id || queue.activeSceneId || queue.active_scene_id),
    asText(batch.activeJobId || batch.active_job_id || queue.activeJobId || queue.active_job_id),
    asText(batch.activeStatusEndpoint || batch.active_status_endpoint || queue.activeStatusEndpoint || queue.active_status_endpoint),
    waiting,
  ].join('|')
}

function boardNeedsServerBatchRefreshV131N(boardData = {}) {
  return boardServerBatchActiveInfoV200E(boardData)
}


// AVA_BOARD_F5_IMAGE_REHYDRATE_V145A:
// F5/load previously rehydrated server video state only. If local durable backup
// was newer but had empty image refs, the first autosave could overwrite the
// project Board snapshot with scenes that no longer contained uploaded stills.
const BOARD_IMAGE_STATE_KEYS_V145A = [
  'image_asset_id', 'imageAssetId', 'image_api_path', 'imageApiPath', 'image_url', 'imageUrl',
  'image_name', 'imageName', 'image_status', 'imageStatus', 'mediaUrl', 'media_url',
  'first_frame_asset_id', 'firstFrameAssetId', 'first_frame_api_path', 'firstFrameApiPath', 'first_frame_url', 'firstFrameUrl', 'first_frame_name', 'firstFrameName',
  'first_image_asset_id', 'firstImageAssetId', 'first_image_api_path', 'firstImageApiPath', 'first_image_url', 'firstImageUrl', 'first_image_name', 'firstImageName',
  'start_image_asset_id', 'startImageAssetId', 'start_image_api_path', 'startImageApiPath', 'start_image_url', 'startImageUrl', 'start_image_name', 'startImageName',
  'last_frame_asset_id', 'lastFrameAssetId', 'last_frame_api_path', 'lastFrameApiPath', 'last_frame_url', 'lastFrameUrl', 'last_frame_name', 'lastFrameName',
  'last_image_asset_id', 'lastImageAssetId', 'last_image_api_path', 'lastImageApiPath', 'last_image_url', 'lastImageUrl', 'last_image_name', 'lastImageName',
  'end_image_asset_id', 'endImageAssetId', 'end_image_api_path', 'endImageApiPath', 'end_image_url', 'endImageUrl', 'end_image_name', 'endImageName',
  'image_mutation_at', 'imageMutationAt', 'image_mutation_epoch', 'imageMutationEpoch',
  'start_image_mutation_epoch', 'startImageMutationEpoch', 'first_image_mutation_epoch', 'firstImageMutationEpoch',
  'last_image_mutation_epoch', 'lastImageMutationEpoch', 'end_image_mutation_epoch', 'endImageMutationEpoch',
  'source_image_changed_at', 'sourceImageChangedAt', 'video_source_image_debug', 'videoSourceImageDebug',
]

const BOARD_IMAGE_REF_KEYS_V145A = BOARD_IMAGE_STATE_KEYS_V145A.filter((key) => (
  key.toLowerCase().includes('asset') ||
  key.toLowerCase().includes('api') ||
  key.toLowerCase().endsWith('url') ||
  key === 'mediaUrl' ||
  key === 'media_url'
))

function boardSceneImageMutationEpochV145A(scene = {}) {
  let best = 0
  for (const key of [
    'image_mutation_epoch', 'imageMutationEpoch',
    'start_image_mutation_epoch', 'startImageMutationEpoch',
    'first_image_mutation_epoch', 'firstImageMutationEpoch',
    'last_image_mutation_epoch', 'lastImageMutationEpoch',
    'end_image_mutation_epoch', 'endImageMutationEpoch',
  ]) {
    const value = Number(scene?.[key] || 0)
    if (Number.isFinite(value) && value > best) best = value
  }
  return best
}

function boardSceneHasUploadingImageV145A(scene = {}) {
  return Boolean(scene?.image_uploading_v129q || scene?.imageUploadingV129Q)
}

function boardSceneImageStateScoreV145A(scene = {}) {
  if (!scene || typeof scene !== 'object') return 0
  let score = 0
  for (const key of BOARD_IMAGE_REF_KEYS_V145A) {
    const value = asText(scene?.[key])
    if (!value || value.startsWith('blob:') || value.startsWith('data:')) continue
    const lowered = key.toLowerCase()
    score += (lowered.includes('asset') || lowered.includes('api')) ? 4 : 2
  }
  if (asText(scene?.image_status || scene?.imageStatus)) score += 1
  if (boardSceneImageMutationEpochV145A(scene)) score += 1
  return score
}

function boardImageStateScoreV145A(boardData = {}) {
  return asSceneArray(boardData?.scenes).reduce((total, scene) => total + boardSceneImageStateScoreV145A(scene), 0)
}

function boardMergeServerImageStateV145A(baseBoard = {}, serverBoard = {}) {
  const baseScenes = asSceneArray(baseBoard?.scenes)
  const serverScenes = asSceneArray(serverBoard?.scenes)
  if (!baseScenes.length || !serverScenes.length) return baseBoard || {}

  const serverById = new Map(serverScenes.map((scene) => [asText(scene?.scene_id || scene?.id), scene]).filter(([id]) => id))
  let changed = false
  const scenes = baseScenes.map((scene) => {
    const sceneId = asText(scene?.scene_id || scene?.id)
    const serverScene = serverById.get(sceneId)
    if (!serverScene || boardSceneHasUploadingImageV145A(scene)) return scene

    const localScore = boardSceneImageStateScoreV145A(scene)
    const serverScore = boardSceneImageStateScoreV145A(serverScene)
    if (!serverScore || serverScore <= localScore) return scene

    const localEpoch = boardSceneImageMutationEpochV145A(scene)
    const serverEpoch = boardSceneImageMutationEpochV145A(serverScene)
    if (localEpoch && serverEpoch && localEpoch > serverEpoch) return scene

    const next = { ...scene }
    for (const key of BOARD_IMAGE_STATE_KEYS_V145A) {
      const value = serverScene?.[key]
      if (value === undefined || value === null || value === '') continue
      next[key] = value
    }
    changed = true
    return canonicalizeBoardSceneMediaRefs(next)
  })

  if (!changed) return baseBoard || {}
  return {
    ...(baseBoard || {}),
    scenes,
    updatedAt: baseBoard?.updatedAt || serverBoard?.updatedAt || new Date().toISOString(),
  }
}


function chooseBoardDataForLoad(serverBoardData = {}, localBoardData = null) {
  if (!localBoardData || !Array.isArray(localBoardData.scenes)) return serverBoardData || {};

  const serverScenes = asArray(serverBoardData?.scenes);
  const localScenes = asArray(localBoardData?.scenes);
  if (!serverScenes.length && localScenes.length) return localBoardData;

  if (localScenes.length > serverScenes.length) {
    const merged = boardMergeServerImageStateV145A(
      boardMergeServerVideoStateV131N(localBoardData, serverBoardData),
      serverBoardData
    )
    return (
      boardVideoStateScoreV131N(merged) > boardVideoStateScoreV131N(localBoardData) ||
      boardImageStateScoreV145A(merged) > boardImageStateScoreV145A(localBoardData)
    ) ? merged : localBoardData;
  }

  if (boardHasManualScenes(localBoardData) && !boardHasManualScenes(serverBoardData)) {
    const merged = boardMergeServerImageStateV145A(
      boardMergeServerVideoStateV131N(localBoardData, serverBoardData),
      serverBoardData
    )
    return (
      boardVideoStateScoreV131N(merged) > boardVideoStateScoreV131N(localBoardData) ||
      boardImageStateScoreV145A(merged) > boardImageStateScoreV145A(localBoardData)
    ) ? merged : localBoardData;
  }

  const serverVideoScore = boardVideoStateScoreV131N(serverBoardData)
  const localVideoScore = boardVideoStateScoreV131N(localBoardData)
  const serverImageScore = boardImageStateScoreV145A(serverBoardData)
  const localImageScore = boardImageStateScoreV145A(localBoardData)

  if (serverVideoScore > localVideoScore || serverImageScore > localImageScore) {
    return boardMergeServerImageStateV145A(
      boardMergeServerVideoStateV131N(localBoardData, serverBoardData),
      serverBoardData
    )
  }

  const serverUpdated = Date.parse(serverBoardData?.updatedAt || serverBoardData?.durableSavedAt || '') || 0;
  const localUpdated = Date.parse(localBoardData?.updatedAt || localBoardData?.durableSavedAt || '') || 0;
  if (localUpdated > serverUpdated) {
    // AVA_BOARD_RELOAD_IMAGE_REHYDRATE_V145A: local prompt edits may be newer,
    // but server video/image result refs must still rehydrate after F5/re-enter.
    const mergedV145A = boardMergeServerImageStateV145A(
      boardMergeServerVideoStateV131N(localBoardData, serverBoardData),
      serverBoardData
    )
    const serverScoreV132T = boardVideoStateScoreV131N(serverBoardData)
    const serverImageScoreV145A = boardImageStateScoreV145A(serverBoardData)
    if ((serverScoreV132T > 0 || serverImageScoreV145A > 0) && mergedV145A && Array.isArray(mergedV145A.scenes)) return mergedV145A
    return localBoardData
  }

  return serverBoardData || {};
}


const emptyBoard = {
  boardVersion: BOARD_VERSION,
  source: 'board',
  importedFrom: '',
  updatedAt: null,
  audio: null,
  roles: [],
  speechSegments: [],
  audioPhrases: [],
  missingSpeechHints: [],
  storyBlocks: [],
  scenes: [],
  selectedSceneId: '',
  notes: '',
}


function readAvaCompletedJobs() {
  try {
    return JSON.parse(localStorage.getItem(AVA_COMPLETED_JOBS_KEY) || '[]')
  } catch (error) {
    return []
  }
}

function writeAvaCompletedJobs(jobs) {
  try {
    localStorage.setItem(AVA_COMPLETED_JOBS_KEY, JSON.stringify(Array.isArray(jobs) ? jobs : []))
    window.dispatchEvent(new CustomEvent('ava:completed-jobs-changed'))
  } catch (error) {
    // ignore storage errors
  }
}

function readBoardSeenCompletedJobIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(AVA_BOARD_SEEN_COMPLETED_JOBS_KEY) || '[]')
    return new Set(Array.isArray(parsed) ? parsed.map((item) => asText(item)).filter(Boolean) : [])
  } catch (error) {
    return new Set()
  }
}

function writeBoardSeenCompletedJobIds(ids) {
  try {
    localStorage.setItem(AVA_BOARD_SEEN_COMPLETED_JOBS_KEY, JSON.stringify(Array.from(ids || []).slice(-80)))
  } catch (error) {
    // ignore storage errors
  }
}

function isGeneratorSceneId(sceneId = '') {
  return asText(sceneId).startsWith('generator_')
}

function completedJobMatchesBoard(job = {}, { projectId = '', workspaceMode = true } = {}) {
  const data = job.data || {}
  const jobProjectId = String(job.projectId || job.project_id || data.projectId || data.project_id || '')
  if (workspaceMode) return !jobProjectId
  return Boolean(jobProjectId) && jobProjectId === String(projectId || '')
}

function boardCompletedJobSkipReason(job = {}, context = {}) {
  const data = job.data || {}
  const sceneId = asText(job.sceneId || job.scene_id || data.sceneId || data.scene_id)
  const jobProjectId = asText(job.projectId || job.project_id || data.projectId || data.project_id)
  if (isGeneratorSceneId(sceneId)) return 'generator scene'
  if (!context.workspaceMode && !jobProjectId) return 'projectId null'
  if (!completedJobMatchesBoard(job, context)) return 'project mismatch'
  return ''
}

function completedJobVideoUrl(kind, data = {}) {
  if (kind === 'mmaudio') {
    const assetApiPath = boardAssetApiPathFromRef(
      data?.mmaudioVideoAssetId,
      data?.mmaudio_video_asset_id,
      data?.assetId,
      data?.asset_id,
      data?.mmaudioVideoApiPath,
      data?.mmaudio_video_api_path,
      data?.videoApiPath,
      data?.video_api_path
    )
    return assetApiPath || data?.mmaudioVideoApiPath || data?.mmaudio_video_api_path || data?.videoApiPath || data?.video_api_path || data?.mmaudioVideoUrl || data?.mmaudio_video_url || data?.videoUrl || data?.video_url || ''
  }
  const assetApiPath = boardAssetApiPathFromRef(
    data?.videoAssetId,
    data?.video_asset_id,
    data?.assetId,
    data?.asset_id,
    data?.videoApiPath,
    data?.video_api_path,
    data?.resultVideoApiPath,
    data?.result_video_api_path
  )
  return assetApiPath || data?.videoApiPath || data?.video_api_path || data?.resultVideoApiPath || data?.result_video_api_path || data?.videoUrl || data?.video_url || data?.resultVideoUrl || data?.result_video_url || ''
}

function completedJobPatch(job = {}) {
  const data = job.data || {}
  const kind = job.kind || 'video'

  if (kind === 'mmaudio') {
    const videoUrl = completedJobVideoUrl(kind, data)
    if (!videoUrl) return null
    const assetId = boardAssetIdFromRef(data?.mmaudioVideoAssetId, data?.mmaudio_video_asset_id, data?.assetId, data?.asset_id, videoUrl)
    const assetApiPath = boardCanonicalAssetApiPath(assetId) || boardAssetApiPathFromRef(videoUrl, data?.mmaudioVideoApiPath, data?.mmaudio_video_api_path)

    return {
      mmaudio_status: 'ready',
      mmaudio_video_asset_id: assetId,
      mmaudioVideoAssetId: assetId,
      mmaudio_video_api_path: assetApiPath || data?.mmaudioVideoApiPath || data?.mmaudio_video_api_path || data?.videoApiPath || data?.video_api_path || '',
      mmaudioVideoApiPath: assetApiPath || data?.mmaudioVideoApiPath || data?.mmaudio_video_api_path || data?.videoApiPath || data?.video_api_path || '',
      mmaudio_video_url: assetApiPath || videoUrl,
      mmaudioVideoUrl: assetApiPath || videoUrl,
      mmaudio_video_name: data?.mmaudioVideoName || data?.mmaudio_video_name || data?.videoName || data?.video_name || 'mmaudio.mp4',
                  mmaudioVideoName: data?.mmaudioVideoName || data?.mmaudio_video_name || data?.videoName || data?.video_name || 'mmaudio.mp4',
mmaudio_job_id: data?.jobId || data?.job_id || job.jobId || '',
      mmaudio_status_endpoint: job.statusEndpoint || '',
      mmaudio_error: '',
            mmaudioError: '',
      mmaudio_result: data,
            mmaudioResult: data,
      mmaudio_ready_at: data?.completedAt || job.completedAt || new Date().toISOString(),
    }
  }

  const videoUrl = completedJobVideoUrl(kind, data)
  if (!videoUrl) return null
  const assetId = boardAssetIdFromRef(data?.videoAssetId, data?.video_asset_id, data?.assetId, data?.asset_id, videoUrl)
  const assetApiPath = boardCanonicalAssetApiPath(assetId) || boardAssetApiPathFromRef(videoUrl, data?.videoApiPath, data?.video_api_path)

  return {
    video_url: assetApiPath || videoUrl,
    videoUrl: assetApiPath || videoUrl,
    video_asset_id: assetId,
    videoAssetId: assetId,
    video_api_path: assetApiPath || data?.videoApiPath || data?.video_api_path || '',
    videoApiPath: assetApiPath || data?.videoApiPath || data?.video_api_path || '',
    video_name: data?.videoName || data?.video_name || 'video.mp4',
    original_video_url: data?.originalVideoUrl || data?.original_video_url || '',
    video_status: 'ready',
    video_job_id: data?.jobId || data?.job_id || job.jobId || '',
    video_status_endpoint: job.statusEndpoint || '',
    video_error: '',
    video_result: data,
    video_ready_at: data?.completedAt || job.completedAt || new Date().toISOString(),
  }
}

function applyCompletedJobsToBoard(boardData = {}, context = {}) {
  const jobs = readAvaCompletedJobs()
  if (!jobs.length || !Array.isArray(boardData.scenes)) {
    return { board: boardData, usedKeys: [] }
  }

  const usedKeys = []
  const matchingJobs = []
  for (const job of jobs) {
    const reason = boardCompletedJobSkipReason(job, context)
    if (reason) {
      const key = job.key || job.jobId || job.job_id || ''
      if (key) usedKeys.push(key)
      console.warn('[BOARD JOB COMPLETED SKIP]', {
        reason,
        jobId: job.jobId || job.job_id || '',
        projectId: job.projectId || job.project_id || '',
        sceneId: job.sceneId || job.scene_id || '',
      })
      continue
    }
    matchingJobs.push(job)
  }
  if (!matchingJobs.length) return { board: boardData, usedKeys }

  let changed = false
  const scenes = boardData.scenes.map((scene) => {
    const sceneId = scene?.id || scene?.scene_id
    const sceneJobs = matchingJobs.filter((job) => asText(job.sceneId || job.scene_id || job.data?.sceneId || job.data?.scene_id) === asText(sceneId))
    if (!sceneJobs.length) return scene

    let nextScene = scene
    for (const job of sceneJobs) {
      const patch = completedJobPatch(job)
      if (!patch) continue

      nextScene = canonicalizeBoardSceneMediaRefs({
        ...nextScene,
        ...patch,
      })
      usedKeys.push(job.key)
      changed = true
    }

    return nextScene
  })

  if (!changed) return { board: boardData, usedKeys }

  return {
    board: {
      ...boardData,
      scenes,
      updatedAt: new Date().toISOString(),
    },
    usedKeys,
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function asSceneArray(value) {
  return asArray(value).filter((scene) => isPlainObject(scene))
}

function asText(value) {
  return String(value || '').trim()
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

function formatRange(scene) {
  if (!scene) return '00:00.000 → 00:00.000'
  return `${formatTime(scene.start)} → ${formatTime(scene.end)}`
}

function durationOf(scene) {
  return Math.max(0, toNumber(scene.end, 0) - toNumber(scene.start, 0))
}

// AVA_BOARD_TIMING_DURATION_LOCK_V38:
// Duration lock belongs to the scene data, not to the route used to open Board.
// A Timing-imported scene must keep its timing duration even after F5, direct Board entry,
// cross-computer restore, or notification-based navigation.
function formatBoardDurationShort(seconds) {
  const value = Math.max(0, toNumber(seconds, 0))
  if (!value) return '0'
  return value.toFixed(2).replace(/\.?0+$/, '')
}

function boardSceneTimingLockInfo(sceneArg = {}) {
  // AVA_BOARD_TIMING_DURATION_LOCK_NULL_GUARD_V38B:
  // selectedScene can be null while Board is hydrating. Never read .source from null.
  const scene = sceneArg || {}
  const source = asText(scene.source || scene.importedFrom || scene.durationSource || scene.duration_source)
  const sourcePhraseIds = asArray(scene.source_phrase_ids || scene.sourcePhraseIds)
  const audioSceneId = asText(scene.audio_scene_id || scene.audioSceneId)
  const manualBoardScene = (
    source === 'manual_board' ||
    source === 'manual_board_scene' ||
    scene.source === 'manual_board_scene' ||
    scene.importedFrom === 'manual_board'
  )

  const explicitLocked = (
    scene.timingLocked === true ||
    scene.timing_locked === true ||
    scene.durationLocked === true ||
    scene.duration_locked === true ||
    scene.durationSource === 'timing' ||
    scene.duration_source === 'timing' ||
    scene.durationSource === 'manual_timing' ||
    scene.duration_source === 'manual_timing'
  )

  const timingLike = (
    source.includes('manual_timing') ||
    source.includes('timing_to_board') ||
    sourcePhraseIds.length > 0 ||
    Boolean(audioSceneId)
  )

  const locked = !manualBoardScene && (explicitLocked || timingLike)

  const start = toNumber(scene.timing_start_sec ?? scene.timingStartSec ?? scene.start_sec ?? scene.start, 0)
  const end = toNumber(scene.timing_end_sec ?? scene.timingEndSec ?? scene.end_sec ?? scene.end, start)
  const storedDuration = toNumber(scene.timing_duration_sec ?? scene.timingDurationSec ?? scene.duration_sec ?? scene.duration, 0)
  const rangeDuration = Math.max(0, end - start)
  const duration = Number((rangeDuration || storedDuration || 0).toFixed(3))

  return {
    locked,
    start,
    end: Number((rangeDuration ? end : start + duration).toFixed(3)),
    duration,
  }
}

function boardSceneGenerationDuration(scene = {}) {
  const lock = boardSceneTimingLockInfo(scene)
  if (lock.locked && lock.duration > 0) return lock.duration
  return Math.max(
    0,
    Number(durationOf(scene) || scene.duration_sec || scene.duration || 0)
  )
}


function isFirstLastRoute(route) {
  return String(route || '').startsWith('first_last')
}

function normalizePhrase(raw, index = 0) {
  const phraseId = asText(raw?.phrase_id || raw?.id || `phr_${String(index + 1).padStart(3, '0')}`)
  const start = toNumber(raw?.start_sec ?? raw?.start, 0)
  const end = toNumber(raw?.end_sec ?? raw?.end, start)
  return {
    ...raw,
    phrase_id: phraseId,
    id: raw?.id || phraseId,
    start,
    end,
    start_sec: start,
    end_sec: end,
    text_original: asText(raw?.text_original || raw?.original_text || raw?.originalText || raw?.text_en || raw?.text),
    translation_ru: asText(raw?.translation_ru || raw?.text_ru || raw?.ruText),
    meaning_hint_ru: asText(raw?.meaning_hint_ru || raw?.meaningText || raw?.meaning_ru),
    label: asText(raw?.label || raw?.role_label || raw?.roleLabel || ''),
    words: asArray(raw?.words),
  }
}


// AVA_BOARD_ASSEMBLY_VIDEO_TRIM_V201A:
// Select an IN/OUT range of a ready scene video for final Assembly only.
// Never touch master audio. Never show/apply it for Timing-imported boards or audio-driven ia2v/lip-sync/instrumental scenes.
const AVA_BOARD_VIDEO_TRIM_MIN_SEC_V201A = 0.08

function boardSceneAudioDrivenTrimLockedV201A(scene = {}) {
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

function boardSceneVideoDurationForTrimV201A(scene = {}) {
  const direct = toNumber(
    scene?.assemblyVideoDurationSec ?? scene?.assembly_video_duration_sec ??
    scene?.videoDurationSec ?? scene?.video_duration_sec ??
    scene?.videoMetadataDurationSec ?? scene?.video_metadata_duration_sec ?? 0,
    0,
  )
  if (direct > 0) return Number(direct.toFixed(3))
  return 0
}

function boardSceneVideoTrimRangeV201A(scene = {}) {
  const duration = boardSceneVideoDurationForTrimV201A(scene)
  const enabled = Boolean(scene?.assemblyVideoTrimEnabled || scene?.assembly_video_trim_enabled)
  const fallbackEnd = duration > 0 ? duration : 0
  const rawStart = toNumber(scene?.assemblyVideoTrimStartSec ?? scene?.assembly_video_trim_start_sec, 0)
  const rawEnd = toNumber(scene?.assemblyVideoTrimEndSec ?? scene?.assembly_video_trim_end_sec, fallbackEnd)
  const start = duration > 0 ? Math.max(0, Math.min(duration, rawStart)) : 0
  const end = duration > 0 ? Math.max(0, Math.min(duration, rawEnd > 0 ? rawEnd : duration)) : 0
  const safeEnd = duration > 0 && end <= start ? Math.min(duration, start + AVA_BOARD_VIDEO_TRIM_MIN_SEC_V201A) : end
  return {
    enabled,
    duration,
    start: Number(start.toFixed(3)),
    end: Number(safeEnd.toFixed(3)),
    clipDuration: Number(Math.max(0, safeEnd - start).toFixed(3)),
  }
}

function formatBoardTrimSecondsV201A(value) {
  const num = Number(value || 0)
  if (!Number.isFinite(num)) return '0.00'
  return num.toFixed(2)
}


function buildPhraseList(timing = {}) {
  const audioPhrases = asArray(timing.audio_phrases || timing.audioPhrases).map(normalizePhrase)
  const speechSegments = asArray(timing.speechSegments || timing.speech_segments).map(normalizePhrase)
  const byId = new Map()
  ;[...audioPhrases, ...speechSegments].forEach((phrase, index) => {
    const id = phrase.phrase_id || phrase.id || `phr_${index + 1}`
    byId.set(id, { ...(byId.get(id) || {}), ...phrase, phrase_id: id })
  })
  return Array.from(byId.values()).sort((a, b) => a.start - b.start)
}

function getScenePhraseIds(scene, phrases) {
  const explicit = asArray(scene?.source_phrase_ids || scene?.sourcePhraseIds)
    .map((item) => asText(item))
    .filter(Boolean)
  if (explicit.length) return explicit

  const start = toNumber(scene?.start_sec ?? scene?.start, 0)
  const end = toNumber(scene?.end_sec ?? scene?.end, start)
  return phrases
    .filter((phrase) => phrase.end > start && phrase.start < end)
    .map((phrase) => phrase.phrase_id)
}

function phraseWordsInScene(phrase, scene) {
  const words = asArray(phrase.words)
  if (!words.length) return ''
  const start = toNumber(scene?.start_sec ?? scene?.start, 0)
  const end = toNumber(scene?.end_sec ?? scene?.end, start)
  const selected = words
    .filter((word) => {
      const wordStart = toNumber(word.start_sec ?? word.start, 0)
      const wordEnd = toNumber(word.end_sec ?? word.end, wordStart)
      return wordEnd > start && wordStart < end
    })
    .map((word) => asText(word.word || word.text))
    .filter(Boolean)
  return selected.join(' ')
}

function collectSceneText(scene, phrases) {
  const explicit = asText(scene.scene_word_text || scene.lyrics_text || scene.text || scene.original_text)
  if (explicit) return explicit

  const phraseIds = new Set(getScenePhraseIds(scene, phrases))
  const parts = phrases
    .filter((phrase) => phraseIds.has(phrase.phrase_id))
    .map((phrase) => phraseWordsInScene(phrase, scene) || phrase.text_original)
    .filter(Boolean)
  return parts.join(' ')
}

function collectByField(scene, phrases, fieldNames, fallback = '') {
  const phraseIds = new Set(getScenePhraseIds(scene, phrases))
  const parts = phrases
    .filter((phrase) => phraseIds.has(phrase.phrase_id))
    .map((phrase) => {
      for (const field of fieldNames) {
        const value = asText(phrase[field])
        if (value) return value
      }
      return ''
    })
    .filter(Boolean)
  return parts.join(' ').trim() || fallback
}

function deriveRoleLabels(scene, phrases) {
  const explicit = asArray(scene?.roleLabels || scene?.role_labels)
    .map((item) => asText(item))
    .filter(Boolean)
  if (explicit.length) return Array.from(new Set(explicit))

  const phraseIds = new Set(getScenePhraseIds(scene, phrases))
  const labels = phrases
    .filter((phrase) => phraseIds.has(phrase.phrase_id))
    .map((phrase) => asText(phrase.label || phrase.role_label || phrase.roleLabel))
    .filter(Boolean)
  return Array.from(new Set(labels))
}

function storyboardRouteLabel(route) {
  const value = String(route || 'i2v')
  const map = {
    ia2v: 'ia2v lip-sync',
    ia2v_instrumental: 'ia2v instrumental',
    i2v: 'i2v',
    i2v_sound: 'i2v sound',
    i2v_text: 'i2v text',
    first_last: 'first-last',
    first_last_sound: 'first-last sound',
  }
  return map[value] || value
}

function storyboardStableHueFromText(value, fallbackIndex = 0) {
  const text = String(value || '').trim()
  if (!text) return 185 + ((Number(fallbackIndex || 0) * 47) % 150)
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i)
    hash |= 0
  }
  return 185 + (Math.abs(hash) % 150)
}

function storyboardNumericHueV67(value) {
  if (value === null || value === undefined || value === '') return NaN
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
  const raw = String(value || '').trim()
  if (!raw) return NaN
  const direct = Number(raw)
  if (Number.isFinite(direct)) return direct
  const hslMatch = raw.match(/hsla?\(\s*([0-9.]+)/i)
  if (hslMatch) {
    const parsed = Number(hslMatch[1])
    if (Number.isFinite(parsed)) return parsed
  }
  // If a hex/css color somehow arrives, keep it stable but convert to a hue-like numeric value.
  if (raw.startsWith('#')) return storyboardStableHueFromText(`hex:${raw}`, 0)
  return NaN
}

function storyboardSceneColor(scene, index = 0) {
  // AVA_BOARD_TIMING_SCENE_COLORS_V67B:
  // Timing-imported scenes must keep their own per-scene color. The old logic used
  // blockId/blockTitle first, so many imported scenes collapsed into one color.
  const direct = storyboardNumericHueV67(
    scene?.sceneColor ??
    scene?.scene_color ??
    scene?.color ??
    scene?.blockColor ??
    scene?.block_color ??
    scene?.blockHue ??
    scene?.block_hue ??
    scene?.hue
  )
  if (Number.isFinite(direct)) return direct

  const looksTimingScene = Boolean(
    scene?.source_phrase_ids ||
    scene?.sourcePhraseIds ||
    scene?.phrase_id ||
    scene?.phraseId ||
    scene?.scene_word_text ||
    scene?.lyrics_text ||
    scene?.translated_text_ru ||
    scene?.meaning_hint_ru ||
    scene?.phrases
  )
  if (looksTimingScene) return 185 + ((Number(index || 0) * 47) % 150)

  const blockKey = String(
    scene?.blockId ??
    scene?.block_id ??
    scene?.semanticBlockId ??
    scene?.semantic_block_id ??
    scene?.blockTitle ??
    scene?.block_title ??
    ''
  ).trim()

  const blockNumber = Number(
    scene?.blockIndex ??
    scene?.block_index ??
    scene?.blockNumber ??
    scene?.block_number
  )

  const isManualBoardBlockV133A = ['manual', 'manual_board', 'manual board', 'ручные сцены', 'ручная сцена'].includes(blockKey.toLowerCase())
  if (blockKey && !isManualBoardBlockV133A) {
    if (Number.isFinite(blockNumber)) {
      return 185 + ((blockNumber * 47) % 150)
    }
    return storyboardStableHueFromText(`block:${blockKey}`, index)
  }

  return 185 + ((Number(index || 0) * 47) % 150)
}

function storyboardHexColorV69(value = '', fallbackIndex = 0) {
  const raw = String(value || '').trim()
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toUpperCase()
  if (/^#[0-9a-f]{3}$/i.test(raw)) return `#${raw.slice(1).split('').map((ch) => ch + ch).join('')}`.toUpperCase()
  const num = Number(raw)
  if (Number.isFinite(num)) return `hsl(${num}, 82%, 52%)`
  return `hsl(${storyboardSceneColor({}, fallbackIndex)}, 82%, 52%)`
}
function storyboardCssColorV69(scene = {}, index = 0) {
  const blockValue = scene.blockColor || scene.block_color || scene.color || scene.sceneColor || scene.scene_color || scene.user_scene_color || scene.timelineColor || scene.cardColor || ''
  if (String(blockValue || '').trim()) return storyboardHexColorV69(blockValue, index)
  return `hsl(${storyboardSceneColor(scene, index)}, 82%, 52%)`
}



function storyboardExactCssColorV70(value = '', fallbackIndex = 0) {
  const raw = String(value || '').trim()
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toUpperCase()
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw.slice(1).split('').map((ch) => ch + ch).join('')}`.toUpperCase()
  }
  if (/^rgba?\(/i.test(raw) || /^hsla?\(/i.test(raw) || /^color-mix\(/i.test(raw)) return raw
  const numeric = Number(raw)
  if (Number.isFinite(numeric)) return `hsl(${numeric}, 82%, 52%)`
  return `hsl(${storyboardSceneColor({}, fallbackIndex)}, 82%, 52%)`
}

function storyboardSceneBlockCssColorV70(scene = {}, index = 0) {
  // AVA_BOARD_EXACT_BLOCK_COLORS_V70:
  // Exact block hex from Timing wins over hue hashing. This keeps Board visually
  // identical to Manual Timing semantic blocks.
  return storyboardExactCssColorV70(
    scene.blockColor ||
    scene.block_color ||
    scene.semanticBlockColor ||
    scene.semantic_block_color ||
    scene.color ||
    scene.user_scene_color ||
    scene.timelineColor ||
    scene.cardColor ||
    scene.sceneColor ||
    scene.scene_color ||
    '',
    index
  )
}

function storyboardSceneCardInlineStyleV70(scene = {}, index = 0) {
  const exactColor = storyboardSceneBlockCssColorV70(scene, index)
  const hue = storyboardSceneColor(scene, index)
  const hasBlock = Boolean(
    scene.blockId ||
    scene.block_id ||
    scene.semanticBlockId ||
    scene.semantic_block_id ||
    scene.blockTitle ||
    scene.block_title
  )

  const style = {
    '--scene-hue': hue,
    '--scene-block-color': exactColor,
  }

  if (hasBlock) {
    style.borderColor = exactColor
    style.background = `linear-gradient(135deg, color-mix(in srgb, ${exactColor} 54%, transparent), rgba(10,16,34,.82) 68%), rgba(255,255,255,.035)`
    style.boxShadow = `inset 0 0 0 1px color-mix(in srgb, ${exactColor} 58%, transparent), 0 12px 34px rgba(0,0,0,.22)`
  }

  return style
}


function storyboardCleanSceneIdV71(scene = {}, index = 0) {
  return String(scene.id || scene.scene_id || scene.sceneId || scene.title || `seg_${String(index + 1).padStart(2, '0')}`).trim()
}

function storyboardSceneIdInBlockV71(block = {}, sceneId = '', index = -1) {
  const id = String(sceneId || '').trim()
  const sceneIds = [
    ...(Array.isArray(block.scene_ids) ? block.scene_ids : []),
    ...(Array.isArray(block.sceneIds) ? block.sceneIds : []),
    ...(Array.isArray(block.scenes) ? block.scenes.map((item) => typeof item === 'string' ? item : (item?.id || item?.scene_id || item?.sceneId)) : []),
  ].map((item) => String(item || '').trim()).filter(Boolean)

  if (id && sceneIds.includes(id)) return true

  const indexes = [
    ...(Array.isArray(block.sceneIndexes) ? block.sceneIndexes : []),
    ...(Array.isArray(block.scene_indexes) ? block.scene_indexes : []),
  ].map((item) => Number(item)).filter(Number.isFinite)

  return Number.isFinite(Number(index)) && indexes.includes(Number(index))
}

function storyboardBlockColorFromStoryBlocksV71(scene = {}, index = 0, boardState = {}) {
  // AVA_SEMANTIC_BLOCK_COLORS_CANON_V72:
  // Exact blockId match must win over old scene_ids membership.
  // Before this, stale blocks like block_01_host_intro with scene_ids:['seg_01']
  // could override the new block_mq... that actually owns seg_01..seg_03.
  const sceneId = storyboardCleanSceneIdV71(scene, index)
  const blockId = String(scene.blockId || scene.block_id || scene.semanticBlockId || scene.semantic_block_id || '').trim()
  const blocks = [
    ...(Array.isArray(boardState.storyBlocks) ? boardState.storyBlocks : []),
    ...(Array.isArray(boardState.story_blocks) ? boardState.story_blocks : []),
    ...(Array.isArray(boardState.timing?.storyBlocks) ? boardState.timing.storyBlocks : []),
    ...(Array.isArray(boardState.timing?.story_blocks) ? boardState.timing.story_blocks : []),
  ]

  const exactById = blockId
    ? blocks.find((block) => {
        const id = String(block.id || block.blockId || block.block_id || '').trim()
        return id && id === blockId
      })
    : null

  const matched = exactById || blocks.find((block) => storyboardSceneIdInBlockV71(block, sceneId, index))
  if (!matched) return ''

  return matched.color || matched.blockColor || matched.block_color || matched.sceneColor || matched.scene_color || ''
}

function storyboardSceneBlockCssColorV71(scene = {}, index = 0, boardState = {}) {
  // AVA_SEMANTIC_BLOCK_COLORS_CANON_V72:
  // canonical storyBlock/blockColor wins. stale user_scene_color is last.
  return storyboardExactCssColorV70(
    storyboardBlockColorFromStoryBlocksV71(scene, index, boardState) ||
    scene.blockColor ||
    scene.block_color ||
    scene.semanticBlockColor ||
    scene.semantic_block_color ||
    scene.color ||
    scene.timelineColor ||
    scene.cardColor ||
    scene.sceneColor ||
    scene.scene_color ||
    scene.user_scene_color ||
    '',
    index
  )
}

function storyboardSceneCardInlineStyleV71(scene = {}, index = 0, boardState = {}) {
  const exactColor = storyboardSceneBlockCssColorV71(scene, index, boardState)
  const hue = storyboardSceneColor(scene, index)
  const hasBlock = Boolean(
    storyboardBlockColorFromStoryBlocksV71(scene, index, boardState) ||
    scene.blockId ||
    scene.block_id ||
    scene.semanticBlockId ||
    scene.semantic_block_id ||
    scene.blockTitle ||
    scene.block_title
  )

  const style = {
    '--scene-hue': hue,
    '--scene-block-color': exactColor,
  }

  if (hasBlock) {
    style.borderColor = exactColor
    style.background = `linear-gradient(135deg, color-mix(in srgb, ${exactColor} 48%, transparent), rgba(10,16,34,.86) 70%), rgba(255,255,255,.035)`
    style.boxShadow = `inset 0 5px 0 ${exactColor}, inset 0 0 0 1px color-mix(in srgb, ${exactColor} 70%, transparent), 0 12px 34px rgba(0,0,0,.22)`
  }

  return style
}

function normalizeAudioSliceStatus(rawScene = {}, savedScene = {}) {
  const status = asText(
    savedScene?.audio_slice_status ||
    savedScene?.audioSliceStatus ||
    savedScene?.manual_lipsync_audio_status ||
    savedScene?.manualLipSyncAudioStatus ||
    rawScene?.audio_slice_status ||
    rawScene?.audioSliceStatus ||
    rawScene?.manual_lipsync_audio_status ||
    rawScene?.manualLipSyncAudioStatus ||
    'not_extracted'
  )

  const hasServerSlice = Boolean(
    savedScene?.audio_slice_asset_id ||
    savedScene?.audioSliceAssetId ||
    savedScene?.audio_asset_id ||
    savedScene?.audioAssetId ||
    savedScene?.manual_lipsync_audio_asset_id ||
    savedScene?.manualLipSyncAudioAssetId ||
    savedScene?.audio_slice_url ||
    savedScene?.audioSliceUrl ||
    savedScene?.audio_slice_api_path ||
    savedScene?.audioSliceApiPath ||
    savedScene?.audio_url ||
    savedScene?.audioUrl ||
    savedScene?.audio_api_path ||
    savedScene?.audioApiPath ||
    savedScene?.manual_lipsync_audio_url ||
    savedScene?.manualLipSyncAudioUrl ||
    savedScene?.manual_lipsync_audio_api_path ||
    savedScene?.manualLipSyncAudioApiPath ||
    rawScene?.audio_slice_asset_id ||
    rawScene?.audioSliceAssetId ||
    rawScene?.audio_asset_id ||
    rawScene?.audioAssetId ||
    rawScene?.manual_lipsync_audio_asset_id ||
    rawScene?.manualLipSyncAudioAssetId ||
    rawScene?.audio_slice_url ||
    rawScene?.audioSliceUrl ||
    rawScene?.audio_slice_api_path ||
    rawScene?.audioSliceApiPath ||
    rawScene?.audio_url ||
    rawScene?.audioUrl ||
    rawScene?.audio_api_path ||
    rawScene?.audioApiPath ||
    rawScene?.manual_lipsync_audio_url ||
    rawScene?.manualLipSyncAudioUrl ||
    rawScene?.manual_lipsync_audio_api_path ||
    rawScene?.manualLipSyncAudioApiPath
  )

  if (status === 'ready' && !hasServerSlice) return 'not_extracted'
  if (hasServerSlice && (!status || status === 'not_extracted' || status === 'empty')) return 'ready'
  return status || 'not_extracted'
}



// AVA_PROJECT_FORMAT_CONTRACT_V177A:
// Project format is the source of truth for Timing -> Board import and Board export.
// This keeps 9:16 projects vertical across all scenes, prompts, and video generation size.
function boardProjectFormatV177A(...sources) {
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue
    const value = firstTextValue(
      source.project_context?.format,
      source.project_context?.aspect_ratio,
      source.project_context?.output_format,
      source.project?.format,
      source.project?.aspect_ratio,
      source.project?.output_format,
      source.format,
      source.aspect_ratio,
      source.aspectRatio,
      source.output_format,
      source.outputFormat
    )
    if (value) return value
  }
  return ''
}

function boardApplyFormatToSceneV177A(scene = {}, format = '') {
  const nextFormat = firstTextValue(format, scene.format, scene.aspect_ratio, scene.aspectRatio, scene.output_format, scene.outputFormat) || '16:9'
  return {
    ...scene,
    format: nextFormat,
    aspect_ratio: nextFormat,
    output_format: nextFormat,
    format_contract: {
      ...(scene.format_contract || {}),
      locked: true,
      format: nextFormat,
      aspect_ratio: nextFormat,
      output_format: nextFormat,
      prompt_rule: nextFormat === '9:16'
        ? 'Use vertical 9:16 composition in photo and video prompts.'
        : nextFormat === '1:1'
          ? 'Use square 1:1 composition in photo and video prompts.'
          : 'Use horizontal 16:9 composition in photo and video prompts.',
    },
  }
}

function boardApplyFormatContractV177A(board = {}) {
  const scenes = asSceneArray(board.scenes)
  const rootFormat = boardProjectFormatV177A(board, scenes[0]) || '16:9'
  return {
    ...board,
    format: rootFormat,
    aspect_ratio: rootFormat,
    output_format: rootFormat,
    project_context: {
      ...(board.project_context || {}),
      format: rootFormat,
      aspect_ratio: rootFormat,
      output_format: rootFormat,
    },
    format_contract: {
      ...(board.format_contract || {}),
      locked: true,
      source_of_truth: 'project_context.format',
      format: rootFormat,
      aspect_ratio: rootFormat,
      output_format: rootFormat,
      codex_rule: 'Use project_context.format and scene.format as locked output format. For 9:16 write vertical prompts, for 16:9 write horizontal prompts, for 1:1 write square prompts. Do not change aspect ratio.',
    },
    board_import_contract: {
      ...(board.board_import_contract || {}),
      schema: board.board_import_contract?.schema || 'ava_board_import_contract_v2',
      board_can_read: true,
      prompt_format_rule: 'Photo/video prompts must match project_context.format. 9:16 = vertical composition, 16:9 = horizontal composition, 1:1 = square composition.',
    },
    scenes: scenes.map((scene) => boardApplyFormatToSceneV177A(scene, rootFormat)),
  }
}

function normalizeBoardScene(rawScene, index, phrases, savedScene = {}) {

// AVA_PROJECT_FORMAT_CONTEXT_BRIDGE_V177B:
// Board transition loads the raw manual_timing snapshot, which may not contain
// project_context even though the project itself was created as 9:16/16:9.
// Use the active project record as a safe source of truth before Timing -> Board import.
function boardCleanFormatValueV177B(value = '') {
  const clean = String(value || '').trim()
  return /^(9:16|16:9|1:1|4:5)$/i.test(clean) ? clean : ''
}

function boardProjectFormatFromContextV177C(projectId = '', activeProject = null, projects = []) {
  const cleanProjectId = String(projectId || '').trim()
  const matchingProject = Array.isArray(projects)
    ? projects.find((project) => String(project?.id || '') === cleanProjectId)
    : null
  return boardCleanFormatValueV177B(boardProjectFormatV177A(activeProject, matchingProject))
}

function boardInjectProjectFormatIntoTimingV177C(timingData = {}, projectFormat = '') {
  const lockedFormat = boardCleanFormatValueV177B(projectFormat) || boardCleanFormatValueV177B(boardProjectFormatV177A(timingData))
  if (!lockedFormat || !timingData || typeof timingData !== 'object') return timingData

  const applySceneFormat = (scene = {}) => boardApplyFormatToSceneV177A(scene, lockedFormat)
  const next = {
    ...timingData,
    format: lockedFormat,
    aspect_ratio: lockedFormat,
    output_format: lockedFormat,
    project: {
      ...(timingData.project || {}),
      format: lockedFormat,
      aspect_ratio: lockedFormat,
      output_format: lockedFormat,
    },
    project_context: {
      ...(timingData.project_context || {}),
      format: lockedFormat,
      aspect_ratio: lockedFormat,
      output_format: lockedFormat,
    },
    format_contract: {
      ...(timingData.format_contract || {}),
      locked: true,
      source_of_truth: 'active_project.format/project_context.format',
      format: lockedFormat,
      aspect_ratio: lockedFormat,
      output_format: lockedFormat,
      codex_rule: 'Use project_context.format and scene.format as locked output format. For 9:16 write vertical prompts, for 16:9 write horizontal prompts, for 1:1 write square prompts. Do not change aspect ratio.',
    },
  }

  if (Array.isArray(next.scenes)) next.scenes = next.scenes.map(applySceneFormat)
  if (Array.isArray(next.production?.scenes)) {
    next.production = {
      ...next.production,
      scenes: next.production.scenes.map(applySceneFormat),
    }
  }
  if (Array.isArray(next.timing?.scenes)) {
    next.timing = {
      ...next.timing,
      format: lockedFormat,
      aspect_ratio: lockedFormat,
      output_format: lockedFormat,
      scenes: next.timing.scenes.map(applySceneFormat),
    }
  }

  for (const key of ['manualTiming', 'manual_timing']) {
    if (next[key] && typeof next[key] === 'object') {
      next[key] = {
        ...next[key],
        format: lockedFormat,
        aspect_ratio: lockedFormat,
        output_format: lockedFormat,
        scenes: Array.isArray(next[key].scenes) ? next[key].scenes.map(applySceneFormat) : next[key].scenes,
      }
    }
  }

  return next
}


  const start = toNumber(rawScene?.start_sec ?? rawScene?.start, 0)
  const end = toNumber(rawScene?.end_sec ?? rawScene?.end, start)
  const id = asText(rawScene?.scene_id || rawScene?.id || savedScene?.scene_id || savedScene?.id || `seg_${String(index + 1).padStart(2, '0')}`)

  const phraseIds = getScenePhraseIds(rawScene, phrases)
  const sceneText = collectSceneText(rawScene, phrases)
  const translated = asText(rawScene?.translated_text_ru) || collectByField(rawScene, phrases, ['translation_ru', 'text_ru', 'ruText'])
  const meaning = asText(rawScene?.meaning_hint_ru || rawScene?.meaningText) || collectByField(rawScene, phrases, ['meaning_hint_ru', 'meaningText', 'meaning_ru'])
  const route = boardRouteFromTimingOrSavedV154A(rawScene, savedScene)
  const sceneHueValue = storyboardSceneColor({ ...(rawScene || {}), ...(savedScene || {}) }, index)

  const timingNote = asText(rawScene?.note || rawScene?.scene_note || rawScene?.memo || rawScene?.comment)
  const savedNote = asText(savedScene?.note)
  const blockId = asText(rawScene?.blockId || rawScene?.block_id || savedScene?.blockId || savedScene?.block_id)
  const blockTitle = asText(rawScene?.blockTitle || rawScene?.block_title || savedScene?.blockTitle || savedScene?.block_title)

  const imageDataUrl = asText(savedScene?.image_data_url || savedScene?.imageDataUrl || rawScene?.image_data_url || rawScene?.imageDataUrl)
  const startImageDataUrl = asText(savedScene?.start_image_data_url || savedScene?.startImageDataUrl || rawScene?.start_image_data_url || rawScene?.startImageDataUrl || imageDataUrl)
  const endImageDataUrl = asText(savedScene?.end_image_data_url || savedScene?.endImageDataUrl || rawScene?.end_image_data_url || rawScene?.endImageDataUrl)

  const rawImageUrl = sceneMediaFieldValue({ ...(rawScene || {}), ...(savedScene || {}) }, 'image', 'url')
  const rawFirstFrameUrl = sceneMediaFieldValue({ ...(rawScene || {}), ...(savedScene || {}) }, 'first', 'url')
  const rawLastFrameUrl = sceneMediaFieldValue({ ...(rawScene || {}), ...(savedScene || {}) }, 'last', 'url')

  const imageUrl = rawImageUrl.startsWith('blob:') && imageDataUrl ? imageDataUrl : rawImageUrl
  const firstFrameUrl = rawFirstFrameUrl.startsWith('blob:') && startImageDataUrl ? startImageDataUrl : rawFirstFrameUrl
  const lastFrameUrl = rawLastFrameUrl.startsWith('blob:') && endImageDataUrl ? endImageDataUrl : rawLastFrameUrl
  const sceneFormat = asText(
    savedScene?.format ||
    savedScene?.aspect_ratio ||
    savedScene?.aspectRatio ||
    savedScene?.output_format ||
    savedScene?.outputFormat ||
    rawScene?.format ||
    rawScene?.aspect_ratio ||
    rawScene?.aspectRatio ||
    rawScene?.output_format ||
    rawScene?.outputFormat
  ) || '16:9'

  return {
    ...savedScene,
    ...rawScene,
    id,
    scene_id: id,
    title: asText(savedScene?.title || rawScene?.title) || id,
    index,
    start,
    end,
    start_sec: start,
    end_sec: end,
    duration_sec: toNumber(rawScene?.duration_sec, Math.max(0, end - start)),
    route,
    format: sceneFormat,
    aspect_ratio: sceneFormat,
    blockId,
    block_id: blockId,
    blockTitle,
    block_title: blockTitle,
    blockColor: sceneHueValue,
    block_color: sceneHueValue,
    color: sceneHueValue,
    sceneColor: sceneHueValue,
    roleLabels: deriveRoleLabels(rawScene, phrases),
    source_phrase_ids: phraseIds,
    scene_word_text: sceneText,
    lyrics_text: asText(rawScene?.lyrics_text) || sceneText,
    translated_text_ru: translated,
    meaning_hint_ru: meaning,
    phrase_cut_warning: Boolean(rawScene?.phrase_cut_warning || rawScene?.phraseCutWarning),
    note: savedNote || timingNote,
    // AVA_STAGE78_STRICT_VISIBLE_VIDEO_PROMPT: Board visible textarea is the source of truth.
    // positive_prompt is only a legacy alias and must not override video_prompt.
    video_prompt: asText(savedScene?.video_prompt || rawScene?.video_prompt || savedScene?.positive_prompt || rawScene?.positive_prompt || meaning),
    positive_prompt: asText(savedScene?.video_prompt || rawScene?.video_prompt || savedScene?.positive_prompt || rawScene?.positive_prompt || meaning),
    negative_prompt: asText(savedScene?.negative_prompt || rawScene?.negative_prompt || 'text, watermark, logo, distorted face, extra limbs, low quality'),
    sound_prompt: asText(savedScene?.sound_prompt || rawScene?.sound_prompt),
    image_status: savedScene?.image_status || rawScene?.image_status || 'empty',
    video_status: savedScene?.video_status || rawScene?.video_status || 'empty',
    /* AVA_BOARD_REVIEW_MERGE_PRIORITY_V132R: raw/server needs_review must beat stale local bad after regeneration. */
    video_review_status: boardSceneVideoReviewStatus({ ...(savedScene || {}), ...(rawScene || {}) }),
    videoReviewStatus: boardSceneVideoReviewStatus({ ...(savedScene || {}), ...(rawScene || {}) }),
    image_url: imageUrl,
    imageUrl,
    image_api_path: sceneMediaFieldValue({ ...(rawScene || {}), ...(savedScene || {}) }, 'image', 'apiPath'),
    imageApiPath: sceneMediaFieldValue({ ...(rawScene || {}), ...(savedScene || {}) }, 'image', 'apiPath'),
    image_data_url: imageDataUrl,
    image_name: savedScene?.image_name || rawScene?.image_name || '',
    first_frame_url: firstFrameUrl,
    firstFrameUrl: firstFrameUrl,
    first_image_api_path: sceneMediaFieldValue({ ...(rawScene || {}), ...(savedScene || {}) }, 'first', 'apiPath'),
    firstImageApiPath: sceneMediaFieldValue({ ...(rawScene || {}), ...(savedScene || {}) }, 'first', 'apiPath'),
    start_image_data_url: startImageDataUrl,
    first_frame_name: savedScene?.first_frame_name || rawScene?.first_frame_name || '',
    last_frame_url: lastFrameUrl,
    lastFrameUrl: lastFrameUrl,
    last_image_api_path: sceneMediaFieldValue({ ...(rawScene || {}), ...(savedScene || {}) }, 'last', 'apiPath'),
    lastImageApiPath: sceneMediaFieldValue({ ...(rawScene || {}), ...(savedScene || {}) }, 'last', 'apiPath'),
    end_image_data_url: endImageDataUrl,
    last_frame_name: savedScene?.last_frame_name || rawScene?.last_frame_name || '',
    video_url: sceneMediaFieldValue({ ...(rawScene || {}), ...(savedScene || {}) }, 'video', 'url'),
    videoUrl: sceneMediaFieldValue({ ...(rawScene || {}), ...(savedScene || {}) }, 'video', 'url'),
    video_api_path: sceneMediaFieldValue({ ...(rawScene || {}), ...(savedScene || {}) }, 'video', 'apiPath'),
    videoApiPath: sceneMediaFieldValue({ ...(rawScene || {}), ...(savedScene || {}) }, 'video', 'apiPath'),
    video_name: savedScene?.video_name || savedScene?.videoName || rawScene?.video_name || rawScene?.videoName || '',
    original_video_url: savedScene?.original_video_url || savedScene?.originalVideoUrl || rawScene?.original_video_url || rawScene?.originalVideoUrl || '',
    video_result: savedScene?.video_result || savedScene?.videoResult || rawScene?.video_result || rawScene?.videoResult || null,
    audio_slice_url: firstTextValue(
      savedScene?.audio_slice_url,
      savedScene?.audioSliceUrl,
      savedScene?.audio_slice_api_path,
      savedScene?.audioSliceApiPath,
      savedScene?.audio_url,
      savedScene?.audioUrl,
      savedScene?.audio_api_path,
      savedScene?.audioApiPath,
      savedScene?.manual_lipsync_audio_url,
      savedScene?.manualLipSyncAudioUrl,
      savedScene?.manual_lipsync_audio_api_path,
      savedScene?.manualLipSyncAudioApiPath,
      rawScene?.audio_slice_url,
      rawScene?.audioSliceUrl,
      rawScene?.audio_slice_api_path,
      rawScene?.audioSliceApiPath,
      rawScene?.audio_url,
      rawScene?.audioUrl,
      rawScene?.audio_api_path,
      rawScene?.audioApiPath,
      rawScene?.manual_lipsync_audio_url,
      rawScene?.manualLipSyncAudioUrl,
      rawScene?.manual_lipsync_audio_api_path,
      rawScene?.manualLipSyncAudioApiPath
    ),
    audioSliceUrl: firstTextValue(
      savedScene?.audioSliceUrl,
      savedScene?.audio_slice_url,
      savedScene?.audioSliceApiPath,
      savedScene?.audio_slice_api_path,
      savedScene?.audioUrl,
      savedScene?.audio_url,
      savedScene?.audioApiPath,
      savedScene?.audio_api_path,
      savedScene?.manualLipSyncAudioUrl,
      savedScene?.manual_lipsync_audio_url,
      savedScene?.manualLipSyncAudioApiPath,
      savedScene?.manual_lipsync_audio_api_path,
      rawScene?.audioSliceUrl,
      rawScene?.audio_slice_url,
      rawScene?.audioSliceApiPath,
      rawScene?.audio_slice_api_path,
      rawScene?.audioUrl,
      rawScene?.audio_url,
      rawScene?.audioApiPath,
      rawScene?.audio_api_path,
      rawScene?.manualLipSyncAudioUrl,
      rawScene?.manual_lipsync_audio_url,
      rawScene?.manualLipSyncAudioApiPath,
      rawScene?.manual_lipsync_audio_api_path
    ),
    audio_slice_api_path: firstTextValue(savedScene?.audio_slice_api_path, savedScene?.audioSliceApiPath, savedScene?.audio_slice_url, savedScene?.audioSliceUrl, rawScene?.audio_slice_api_path, rawScene?.audioSliceApiPath, rawScene?.audio_slice_url, rawScene?.audioSliceUrl),
    audioSliceApiPath: firstTextValue(savedScene?.audioSliceApiPath, savedScene?.audio_slice_api_path, savedScene?.audioSliceUrl, savedScene?.audio_slice_url, rawScene?.audioSliceApiPath, rawScene?.audio_slice_api_path, rawScene?.audioSliceUrl, rawScene?.audio_slice_url),
    audio_slice_asset_id: firstTextValue(savedScene?.audio_slice_asset_id, savedScene?.audioSliceAssetId, savedScene?.audio_asset_id, savedScene?.audioAssetId, savedScene?.manual_lipsync_audio_asset_id, savedScene?.manualLipSyncAudioAssetId, rawScene?.audio_slice_asset_id, rawScene?.audioSliceAssetId, rawScene?.audio_asset_id, rawScene?.audioAssetId, rawScene?.manual_lipsync_audio_asset_id, rawScene?.manualLipSyncAudioAssetId),
    audioSliceAssetId: firstTextValue(savedScene?.audioSliceAssetId, savedScene?.audio_slice_asset_id, savedScene?.audioAssetId, savedScene?.audio_asset_id, savedScene?.manualLipSyncAudioAssetId, savedScene?.manual_lipsync_audio_asset_id, rawScene?.audioSliceAssetId, rawScene?.audio_slice_asset_id, rawScene?.audioAssetId, rawScene?.audio_asset_id, rawScene?.manualLipSyncAudioAssetId, rawScene?.manual_lipsync_audio_asset_id),
    audio_slice_name: firstTextValue(savedScene?.audio_slice_name, savedScene?.audioSliceName, savedScene?.manual_lipsync_audio_name, savedScene?.manualLipSyncAudioName, rawScene?.audio_slice_name, rawScene?.audioSliceName, rawScene?.manual_lipsync_audio_name, rawScene?.manualLipSyncAudioName),
    audioSliceName: firstTextValue(savedScene?.audioSliceName, savedScene?.audio_slice_name, savedScene?.manualLipSyncAudioName, savedScene?.manual_lipsync_audio_name, rawScene?.audioSliceName, rawScene?.audio_slice_name, rawScene?.manualLipSyncAudioName, rawScene?.manual_lipsync_audio_name),
    audio_slice_duration: toNumber(savedScene?.audio_slice_duration ?? savedScene?.audioSliceDuration ?? savedScene?.manual_lipsync_audio_duration ?? savedScene?.manualLipSyncAudioDuration ?? rawScene?.audio_slice_duration ?? rawScene?.audioSliceDuration ?? rawScene?.manual_lipsync_audio_duration ?? rawScene?.manualLipSyncAudioDuration, 0),
    audioSliceDuration: toNumber(savedScene?.audioSliceDuration ?? savedScene?.audio_slice_duration ?? savedScene?.manualLipSyncAudioDuration ?? savedScene?.manual_lipsync_audio_duration ?? rawScene?.audioSliceDuration ?? rawScene?.audio_slice_duration ?? rawScene?.manualLipSyncAudioDuration ?? rawScene?.manual_lipsync_audio_duration, 0),
    audio_slice_status: normalizeAudioSliceStatus(rawScene, savedScene),
    audioSliceStatus: normalizeAudioSliceStatus(rawScene, savedScene),
    audio_slice_error: firstTextValue(savedScene?.audio_slice_error, savedScene?.audioSliceError, rawScene?.audio_slice_error, rawScene?.audioSliceError),
    audioSliceError: firstTextValue(savedScene?.audioSliceError, savedScene?.audio_slice_error, rawScene?.audioSliceError, rawScene?.audio_slice_error),
    previous_frame_status: savedScene?.previous_frame_status || rawScene?.previous_frame_status || 'empty',
  }
}

function buildBoardFromTiming(timingData = {}, boardData = {}) {
  const timing = timingData?.manualTiming || timingData?.manual_timing || timingData || {}
  const existing = boardData?.board || boardData || {}
  const phrases = buildPhraseList(timing)
  const projectFormatV177A = boardProjectFormatV177A(timingData, timing, existing)
  const savedScenes = new Map(asSceneArray(existing.scenes)
    .map((scene) => [asText(scene.scene_id || scene.id), scene]))
  const sourceScenes = asSceneArray(timing.scenes)
  const scenes = sourceScenes.map((scene, index) => {
    const id = asText(scene.scene_id || scene.id || `seg_${String(index + 1).padStart(2, '0')}`)
    const savedScene = savedScenes.get(id) || {}
    return mergePreserveMediaRefs(savedScene, normalizeBoardScene(scene, index, phrases, savedScene))
  })

  const existingScenes = asSceneArray(existing.scenes)
  const fallbackScenes = existingScenes.map((scene, index) => mergePreserveMediaRefs(scene, normalizeBoardScene(scene, index, phrases, scene)))

  // AVA09B_KEEP_EXTRA_BOARD_SCENES:
  // Timing may be the source for imported scenes, but manual Board scenes must survive F5.
  // If timing.scenes exist, append saved Board scenes whose ids are not present in Timing.
  const timingSceneIds = new Set(scenes.map((scene) => asText(scene.scene_id || scene.id)))
  const extraBoardScenes = scenes.length
    ? existingScenes
        .filter((scene) => {
          const id = asText(scene.scene_id || scene.id)
          return id && !timingSceneIds.has(id)
        })
        .map((scene, offset) => mergePreserveMediaRefs(scene, normalizeBoardScene(scene, scenes.length + offset, phrases, scene)))
    : []

  const rawFinalScenes = scenes.length ? [...scenes, ...extraBoardScenes] : fallbackScenes
  const finalScenes = (sourceScenes.length && projectFormatV177A)
    ? rawFinalScenes.map((scene) => boardApplyFormatToSceneV177A(scene, projectFormatV177A))
    : rawFinalScenes
  const rootFormatV177A = boardProjectFormatV177A({ format: projectFormatV177A }, existing, finalScenes[0]) || '16:9'
  const timingAudio = boardAudioFromTiming(timing)
  const existingAudio = boardNormalizeAudioObjectV194A(existing.audio, existing) || boardAudioFromTiming(existing)
  const fallbackAudio = boardNormalizeAudioObjectV194A({}, {
    name: timing.audioName || timing.audio_name || '',
    assetId: timing.audioAssetId || timing.audio_asset_id || '',
    assetApiPath: timing.audioApiPath || timing.asset_api_path || '',
    durationSec: timing.audioDurationSec || timing.audio_duration_sec || 0,
  })
  const audio = timingAudio || existingAudio || fallbackAudio || null

  const pendingOpenSceneIdForBuild = typeof sessionStorage !== 'undefined'
    ? asText(sessionStorage.getItem(AVA_OPEN_BOARD_SCENE_KEY))
    : ''
  const selectedId = pendingOpenSceneIdForBuild || asText(existing.selectedSceneId) || finalScenes[0]?.id || ''
  return {
    ...emptyBoard,
    ...existing,
    boardVersion: BOARD_VERSION,
    format: rootFormatV177A,
    aspect_ratio: rootFormatV177A,
    output_format: rootFormatV177A,
    project_context: {
      ...(existing.project_context || {}),
      format: rootFormatV177A,
      aspect_ratio: rootFormatV177A,
      output_format: rootFormatV177A,
    },
    format_contract: {
      ...(existing.format_contract || {}),
      locked: true,
      source_of_truth: 'project_context.format',
      format: rootFormatV177A,
      aspect_ratio: rootFormatV177A,
      output_format: rootFormatV177A,
      codex_rule: 'Use project_context.format and scene.format as locked output format. For 9:16 write vertical prompts, for 16:9 write horizontal prompts, for 1:1 write square prompts. Do not change aspect ratio.',
    },
    importedFrom: sourceScenes.length ? 'manual_timing' : existing.importedFrom || '',
    audio,
    roles: asArray(timing.roles || existing.roles),
    speechSegments: asArray(timing.speechSegments || timing.speech_segments || existing.speechSegments),
    audioPhrases: phrases,
    missingSpeechHints: asArray(timing.missingSpeechHints || timing.missing_speech_hints || existing.missingSpeechHints),
    storyBlocks: asArray(timing.storyBlocks || timing.story_blocks || existing.storyBlocks),
    scenes: finalScenes,
    selectedSceneId: finalScenes.some((scene) => scene.id === selectedId) ? selectedId : finalScenes[0]?.id || '',
    updatedAt: new Date().toISOString(),
  }
}


function isVideoBusyStatus(status) {
  return ['starting', 'queued', 'preparing', 'submitting', 'running'].includes(String(status || '').toLowerCase())
}

// AVA_BOARD_VIDEO_STATUS_LABELS_V130F:
// Backend/Comfy can legitimately return status=queued after /clip/video/start.
// In Board UI, queued WITH a server job means generation was already submitted,
// so show it as "видео делается". Only queued WITHOUT a job is the local waiting queue.
function boardSceneHasServerVideoJobV130F(scene) {
  return Boolean(scene?.video_job_id || scene?.videoJobId || scene?.video_status_endpoint || scene?.videoStatusEndpoint)
}

function boardSceneVideoUiStatusV130F(scene) {
  // AVA_BOARD_BAD_REGEN_RUNTIME_STATUS_V136I:
  // Runtime-only bad-review regeneration status must win over old ready video refs.
  // This lets cards/preview show отправляется/в очереди/видео делается while keeping
  // queued/submitting out of the persisted project snapshot.
  const runtimeStatusV136I = String(
    scene?.video_runtime_status_v136i ||
    scene?.videoRuntimeStatusV136I ||
    ''
  ).toLowerCase()
  if (runtimeStatusV136I && isVideoBusyStatus(runtimeStatusV136I)) return runtimeStatusV136I

  const rawStatus = String(scene?.video_status || scene?.videoStatus || '').toLowerCase()
  const queueSourceV136I = String(scene?.video_queue_source || scene?.videoQueueSource || '').toLowerCase()
  const badRegenActiveJobV136I = Boolean(
    isVideoBusyStatus(rawStatus) &&
    boardSceneHasServerVideoJobV130F(scene) &&
    (
      scene?.video_review_regenerate_from_bad ||
      scene?.videoReviewRegenerateFromBad ||
      scene?.video_batch_active_v132r ||
      scene?.videoBatchActiveV132R ||
      queueSourceV136I.includes('bad_review') ||
      queueSourceV136I.includes('regeneration')
    )
  )
  if (badRegenActiveJobV136I) {
    return rawStatus === 'queued' ? 'running' : rawStatus
  }

  // AVA_BOARD_READY_VIDEO_WINS_BUSY_STATUS_V133E:
  // Old local polling can briefly write queued/running after the server already saved a video.
  // A current video ref must win, otherwise preview is hidden and UI shows "в очереди".
  if (typeof boardSceneHasCurrentVideoResultV129P === 'function' && boardSceneHasCurrentVideoResultV129P(scene)) return 'ready'
  if (rawStatus === 'queued' && boardSceneHasServerVideoJobV130F(scene)) return 'running'
  return rawStatus
}




function boardSceneBusyVideoLabelV132P(scene = {}) {
  const status = String(boardSceneVideoUiStatusV130F(scene) || '').toLowerCase()
  // AVA_BOARD_BATCH_STATUS_FLOW_V132S:
  // submitting/starting/preparing = request is being sent/prepared;
  // queued without server job = waiting turn;
  // queued with server job is normalized by boardSceneVideoUiStatusV130F to running.
  if (status === 'starting' || status === 'submitting' || status === 'preparing') return 'отправляется'
  if (status === 'queued') return 'в очереди'
  if (status === 'running' || status === 'processing') return 'видео делается'
  return ''
}

function scenePreviewVideoUrl(scene) {
  if (!scene) return ''

  // AVA_BOARD_STILLS_CLEAR_VIDEO_IMMEDIATE_V129R:
  // A video produced before the current image mutation must not be shown, even if
  // old job polling or a stale snapshot still contains video refs after F5.
  if (typeof boardVideoMatchesCurrentImageV129P === 'function' && !boardVideoMatchesCurrentImageV129P(scene)) return ''
  if (boardSceneVideoLooksLikeImageEchoV143A2(scene)) return ''

  const mmaudioVideo = (
    scene.mmaudio_video_api_path ||
    scene.mmaudioVideoApiPath ||
    scene.mmaudio_video_url ||
    scene.mmaudioVideoUrl ||
    ''
  )
  if (mmaudioVideo) return normalizeBoardMediaUrl(mmaudioVideo)

  if (isVideoBusyStatus(scene.video_status || scene.videoStatus) && !boardVideoBusyCanKeepPreviewV132O(scene)) return ''

  return normalizeBoardMediaUrl(
    scene.video_api_path ||
    scene.videoApiPath ||
    scene.video_url ||
    scene.videoUrl ||
    scene.resultVideoApiPath ||
    scene.result_video_api_path ||
    scene.resultVideoUrl ||
    scene.result_video_url ||
    ''
  )
}


function scenePreviewAssetApiPath(scene) {
  if (!scene) return ''

  // AVA_BOARD_STILLS_CLEAR_VIDEO_IMMEDIATE_V129R:
  // Do not fetch protected video preview for stale video refs after image replacement.
  if (typeof boardVideoMatchesCurrentImageV129P === 'function' && !boardVideoMatchesCurrentImageV129P(scene)) return ''
  if (boardSceneVideoLooksLikeImageEchoV143A2(scene)) return ''

  const mmaudioAssetPath = (
    scene.mmaudio_video_api_path ||
    scene.mmaudioVideoApiPath ||
    ''
  )
  if (mmaudioAssetPath) return boardProtectedAssetApiPath(mmaudioAssetPath)

  if (isVideoBusyStatus(scene.video_status || scene.videoStatus) && !boardVideoBusyCanKeepPreviewV132O(scene)) return ''

  return boardProtectedAssetApiPath(
    scene.video_api_path ||
    scene.videoApiPath ||
    scene.resultVideoApiPath ||
    scene.result_video_api_path ||
    ''
  )
}


function sceneStaticVideoCandidate(scene) {
  if (!scene) return ''

  // AVA_BOARD_STILLS_CLEAR_VIDEO_IMMEDIATE_V129R: stale video belongs to an older source image.
  if (typeof boardVideoMatchesCurrentImageV129P === 'function' && !boardVideoMatchesCurrentImageV129P(scene)) return ''

  const mmaudioValues = [
    scene.mmaudio_video_url,
    scene.mmaudioVideoUrl,
  ]
  for (const value of mmaudioValues) {
    const staticUrl = boardStaticMediaUrl(value)
    if (staticUrl) return staticUrl
  }

  if (isVideoBusyStatus(scene.video_status || scene.videoStatus) && !boardVideoBusyCanKeepPreviewV132O(scene)) return ''

  const values = [
    scene.video_url,
    scene.videoUrl,
    scene.resultVideoUrl,
    scene.result_video_url,
    scene.video_result?.video_url,
    scene.videoResult?.videoUrl,
  ]
  for (const value of values) {
    const staticUrl = boardStaticMediaUrl(value)
    if (staticUrl) return staticUrl
  }
  return ''
}

// AVA_BOARD_VIDEO_READY_STALE_AFTER_STILLS_V129P:
// A video result is only ready if it belongs to the current image.  Still import/manual upload
// stamps image_mutation_epoch.  Old videos without a matching video_source_image_mutation_epoch
// must not show as "видео готово" and must not be skipped by auto generation.
function boardImageMutationEpochForVideoV129P(scene = {}) {
  const direct = Number(scene?.image_mutation_epoch ?? scene?.imageMutationEpoch ?? 0)
  if (Number.isFinite(direct) && direct > 0) return direct
  const parsed = Date.parse(scene?.image_mutation_at || scene?.imageMutationAt || '') || 0
  return parsed
}

function boardVideoSourceImageEpochV129P(scene = {}) {
  const direct = Number(scene?.video_source_image_mutation_epoch ?? scene?.videoSourceImageMutationEpoch ?? 0)
  if (Number.isFinite(direct) && direct > 0) return direct
  const parsed = Date.parse(scene?.video_source_image_mutation_at || scene?.videoSourceImageMutationAt || '') || 0
  return parsed
}

function boardVideoMatchesCurrentImageV129P(scene = {}) {
  const imageEpoch = boardImageMutationEpochForVideoV129P(scene)
  if (!imageEpoch) return true
  const videoEpoch = boardVideoSourceImageEpochV129P(scene)
  return Boolean(videoEpoch && videoEpoch >= imageEpoch)
}

// AVA_BOARD_MEDIA_STATUS_INDICATORS_V132O:
// UI-only helpers. They do not change persistence; they only explain what the user is waiting for.
function boardSceneDirectVideoPreviewRefV132O(scene = {}) {
  return asText(
    scene?.mmaudio_video_api_path ||
    scene?.mmaudioVideoApiPath ||
    scene?.mmaudio_video_url ||
    scene?.mmaudioVideoUrl ||
    sceneMediaFieldValue(scene, 'video', 'apiPath') ||
    sceneMediaFieldValue(scene, 'video', 'url') ||
    scene?.video_api_path ||
    scene?.videoApiPath ||
    scene?.video_url ||
    scene?.videoUrl ||
    scene?.result_video_api_path ||
    scene?.resultVideoApiPath ||
    scene?.result_video_asset_id ||
    scene?.resultVideoAssetId ||
    scene?.result_video_api_path ||
    scene?.resultVideoApiPath ||
    scene?.result_video_url ||
    scene?.resultVideoUrl ||
    scene?.video_result?.video_api_path ||
    scene?.videoResult?.videoApiPath ||
    scene?.video_result?.video_url ||
    scene?.videoResult?.videoUrl ||
    ''
  )
}

function boardVideoBusyCanKeepPreviewV132O(scene = {}) {
  const status = boardSceneVideoUiStatusV130F(scene)
  if (!isVideoBusyStatus(status)) return false
  if (!boardVideoMatchesCurrentImageV129P(scene)) return false
  if (!boardSceneDirectVideoPreviewRefV132O(scene)) return false
  const queueSource = String(scene?.video_queue_source || scene?.videoQueueSource || '').toLowerCase()
  const reviewStatus = boardSceneVideoReviewStatus(scene)
  return Boolean(
    reviewStatus === 'bad' ||
    reviewStatus === 'needs_review' ||
    boardVideoWasBadBeforeRegenerate(scene) ||
    queueSource.includes('bad_review') ||
    queueSource.includes('regeneration')
  )
}

function boardSceneImageSlotUiStateV132O(scene = {}, slot = 'image', previewUrl = '', runtimeMedia = {}) {
  if (!scene) return { busy: false, busyLabel: '', busyHint: '', statusLabel: '', statusClassName: '' }
  const safeSlot = ['image', 'first', 'last'].includes(slot) ? slot : 'image'
  const preview = asText(previewUrl)
  const apiPath = sceneMediaFieldValue(scene, safeSlot, 'apiPath')
  const url = sceneMediaFieldValue(scene, safeSlot, 'url')
  const name = asText(
    safeSlot === 'last'
      ? (scene?.last_frame_name || scene?.lastFrameName || scene?.last_image_name || scene?.lastImageName || scene?.end_image_name || scene?.endImageName)
      : safeSlot === 'first'
        ? (scene?.first_frame_name || scene?.firstFrameName || scene?.first_image_name || scene?.firstImageName || scene?.start_image_name || scene?.startImageName || scene?.image_name || scene?.imageName)
        : (scene?.image_name || scene?.imageName || scene?.first_frame_name || scene?.firstFrameName)
  )
  const dataUrl = asText(
    safeSlot === 'last'
      ? (scene?.end_image_data_url || scene?.endImageDataUrl || scene?.last_image_data_url || scene?.lastImageDataUrl)
      : safeSlot === 'first'
        ? (scene?.start_image_data_url || scene?.startImageDataUrl || scene?.first_image_data_url || scene?.firstImageDataUrl || scene?.image_data_url || scene?.imageDataUrl)
        : (scene?.image_data_url || scene?.imageDataUrl || scene?.start_image_data_url || scene?.startImageDataUrl)
  )
  const slotStatus = String(
    safeSlot === 'last'
      ? (scene?.last_frame_status || scene?.lastFrameStatus || scene?.image_status || scene?.imageStatus || '')
      : safeSlot === 'first'
        ? (scene?.first_frame_status || scene?.firstFrameStatus || scene?.image_status || scene?.imageStatus || '')
        : (scene?.image_status || scene?.imageStatus || scene?.first_frame_status || scene?.firstFrameStatus || '')
  ).toLowerCase()
  const cleared = Boolean(
    safeSlot === 'last'
      ? runtimeMedia?.lastClearedV129O
      : safeSlot === 'first'
        ? runtimeMedia?.firstClearedV129O
        : runtimeMedia?.imageClearedV129O
  )
  const hasProtectedRef = Boolean(
    (apiPath && isProtectedBoardAssetApiPath(apiPath)) ||
    (url && isProtectedBoardAssetApiPath(url))
  )
  const hasImageRef = Boolean(preview || apiPath || url || dataUrl || name)
  const assetReady = slotStatus.includes('asset_ready') || slotStatus.includes('server_frame_ready') || slotStatus.includes('ready')
  const uploadFlag = Boolean(scene?.image_uploading_v129q || scene?.imageUploadingV129Q) && !assetReady
  const savingFlag = Boolean(scene?.mediaMutationReplaceSave || scene?.forceReplaceSave) && !assetReady
  const uploading = !assetReady && (uploadFlag || slotStatus.includes('upload') || slotStatus.includes('local_pending') || slotStatus.includes('local_preview'))
  const extracting = slotStatus.includes('extracting') || slotStatus.includes('from_previous_video')
  const failed = slotStatus.includes('error') || slotStatus.includes('failed')
  const restoring = hasProtectedRef && !preview && !cleared

  if (failed) {
    return { busy: false, busyLabel: '', busyHint: '', statusLabel: 'ошибка кадра', statusClassName: 'isError' }
  }
  if (extracting) {
    return { busy: true, busyLabel: 'Берём кадр…', busyHint: 'Извлекаем последний кадр из предыдущего видео.', statusLabel: 'извлекаем', statusClassName: 'isBusy' }
  }
  if (uploading && preview) {
    return { busy: true, busyLabel: 'Загружаем фото…', busyHint: 'Preview уже на экране, asset пишется в проект.', statusLabel: 'загружаем', statusClassName: 'isBusy' }
  }
  if (uploading || savingFlag) {
    return { busy: true, busyLabel: 'Загружаем фото…', busyHint: 'Готовим preview и asset для snapshot.', statusLabel: 'загружаем', statusClassName: 'isBusy' }
  }
  if (restoring) {
    return { busy: true, busyLabel: 'Подгружаем…', busyHint: 'Восстанавливаем protected asset после F5.', statusLabel: 'подгружаем', statusClassName: 'isBusy' }
  }
  if (hasImageRef) {
    return { busy: false, busyLabel: '', busyHint: '', statusLabel: 'фото готово', statusClassName: 'isReady' }
  }
  return { busy: false, busyLabel: '', busyHint: '', statusLabel: '', statusClassName: '' }
}

function boardSceneVideoUiIndicatorV132O(scene = {}, { previewLoading = false, hasPreview = false, loadError = '' } = {}) {
  if (!scene) {
    return { headerLabel: 'empty', className: 'isEmpty', showSpinner: false, overlay: false, overlayTitle: '', overlayHint: '', emptyTitle: 'Видео ещё не создано', emptyHint: '' }
  }
  if (loadError) {
    return { headerLabel: 'preview error', className: 'isError', showSpinner: false, overlay: false, overlayTitle: '', overlayHint: '', emptyTitle: 'Видео preview недоступно', emptyHint: loadError }
  }
  if (previewLoading) {
    return { headerLabel: 'подгружаем видео', className: 'isLoading', showSpinner: true, overlay: false, overlayTitle: '', overlayHint: '', emptyTitle: 'Загружаем видео…', emptyHint: 'Получаем protected asset preview.' }
  }

  const status = boardSceneVideoUiStatusV130F(scene)
  const busy = isVideoBusyStatus(status)
  const keepOldPreview = boardVideoBusyCanKeepPreviewV132O(scene)
  const reviewInfo = boardSceneVideoReviewInfo(scene)
  const hasCurrentVideo = boardSceneHasCurrentVideoResultV129P(scene)
  const staleVideo = boardSceneRawVideoRefsV129P(scene) && !boardVideoMatchesCurrentImageV129P(scene)

  if (busy) {
    const byStatus = status === 'starting'
      ? { headerLabel: 'видео отправлено', title: 'Видео отправлено…', hint: 'Создаём job и ждём ответ сервера.' }
      : status === 'queued'
        ? { headerLabel: 'видео делается', title: 'Видео делается…', hint: scene?.video_queue_position ? `Позиция #${scene.video_queue_position}` : 'Ждём свободный слот генерации.' }
        : (status === 'preparing' || status === 'submitting')
          ? { headerLabel: 'видео делается', title: 'Видео делается…', hint: 'Передаём фото, аудио и prompt на backend/Comfy.' }
          : { headerLabel: 'видео делается', title: 'Видео делается…', hint: scene?.video_job_id ? `job · ${scene.video_job_id}` : 'Сервер генерирует видео.' }
    if (keepOldPreview && hasPreview) {
      return {
        headerLabel: 'перегенерация',
        className: 'isRegenerating',
        showSpinner: true,
        overlay: true,
        overlayTitle: 'Перегенерация…',
        overlayHint: 'Старое видео оставлено на экране, ждём новый результат.',
        emptyTitle: byStatus.title,
        emptyHint: byStatus.hint,
      }
    }
    return { headerLabel: byStatus.headerLabel, className: 'isBusy', showSpinner: true, overlay: false, overlayTitle: '', overlayHint: '', emptyTitle: byStatus.title, emptyHint: byStatus.hint }
  }

  if (reviewInfo.status === 'needs_review') {
    return { headerLabel: 'посмотри', className: 'isReview', showSpinner: false, overlay: false, overlayTitle: '', overlayHint: '', emptyTitle: 'Видео готово — посмотри', emptyHint: 'Это результат после перегенерации плохого видео.' }
  }
  if (reviewInfo.status === 'bad') {
    return { headerLabel: 'плохое', className: 'isBad', showSpinner: false, overlay: false, overlayTitle: '', overlayHint: '', emptyTitle: 'Видео помечено плохим', emptyHint: 'Оно попадёт в перегенерацию.' }
  }
  if (hasCurrentVideo) {
    return { headerLabel: 'видео готово', className: 'isReady', showSpinner: false, overlay: false, overlayTitle: '', overlayHint: '', emptyTitle: 'Видео готово', emptyHint: '' }
  }
  if (staleVideo) {
    return { headerLabel: 'нужно новое видео', className: 'isStale', showSpinner: false, overlay: false, overlayTitle: '', overlayHint: '', emptyTitle: 'Видео очищено после замены фото', emptyHint: 'Нужно отправить сцену на генерацию заново.' }
  }
  return { headerLabel: 'empty', className: 'isEmpty', showSpinner: false, overlay: false, overlayTitle: '', overlayHint: '', emptyTitle: 'Видео ещё не создано', emptyHint: '' }
}

function boardSceneRawVideoRefsV129P(scene = {}) {
  if (boardSceneVideoLooksLikeImageEchoV143A2(scene)) return false
  return Boolean(
    sceneMediaFieldValue(scene, 'video', 'apiPath') ||
    sceneMediaFieldValue(scene, 'video', 'url') ||
    scene?.video_api_path ||
    scene?.videoApiPath ||
    scene?.video_url ||
    scene?.videoUrl ||
    scene?.video_asset_id ||
    scene?.videoAssetId ||
    scene?.mmaudio_video_api_path ||
    scene?.mmaudioVideoApiPath ||
    scene?.mmaudio_video_url ||
    scene?.mmaudioVideoUrl ||
    scene?.mmaudio_video_asset_id ||
    scene?.mmaudioVideoAssetId ||
    scene?.result_video_api_path ||
    scene?.resultVideoApiPath ||
    scene?.result_video_url ||
    scene?.resultVideoUrl ||
    scene?.result_video_asset_id ||
    scene?.resultVideoAssetId ||
    scene?.video_result?.video_api_path ||
    scene?.videoResult?.videoApiPath ||
    scene?.video_result?.video_url ||
    scene?.videoResult?.videoUrl ||
    scene?.video_result?.video_asset_id ||
    scene?.videoResult?.videoAssetId
  )
}

function boardSceneHasCurrentVideoResultV129P(scene = {}) {
  return boardSceneRawVideoRefsV129P(scene) && boardVideoMatchesCurrentImageV129P(scene)
}


function boardSceneCanShowVideoReviewV133B(scene = {}) {
  // AVA_BOARD_REVIEW_CLEAR_ON_IMAGE_CHANGE_V133B:
  // Do not show "посмотри" for a scene that only has a fresh still and no current video.
  if (!scene) return false
  if (typeof boardSceneHasCurrentVideoResultV129P === 'function') {
    return Boolean(boardSceneHasCurrentVideoResultV129P(scene))
  }
  return Boolean(
    scene?.video_api_path || scene?.videoApiPath ||
    scene?.video_url || scene?.videoUrl ||
    scene?.result_video_api_path || scene?.resultVideoApiPath ||
    scene?.result_video_url || scene?.resultVideoUrl ||
    scene?.video_asset_id || scene?.videoAssetId
  )
}

function scenePreviewVideoLabel(scene) {
  if (!scene) return 'empty'
  const reviewStatusPreviewV132D2 = boardSceneVideoReviewStatus(scene)
  // AVA_BOARD_REVIEW_BAD_READY_LABEL_SPLIT_V132E: preview readiness label stays ready; review badge handles bad/посмотри.
  const videoMatchesImage = boardVideoMatchesCurrentImageV129P(scene)
  const mmaudioStatus = String(scene.mmaudio_status || scene.mmaudioStatus || '').toLowerCase()
  if (['starting', 'queued', 'preparing', 'running'].includes(mmaudioStatus)) return 'MMAudio делается'
  if (videoMatchesImage && (
    scene.mmaudio_video_api_path ||
    scene.mmaudioVideoApiPath ||
    scene.mmaudio_video_url ||
    scene.mmaudioVideoUrl
  )) return 'mmaudio ready'

  const status = boardSceneVideoUiStatusV130F(scene)
  if (isVideoBusyStatus(status)) {
    if (status === 'starting') return 'отправляется'
    if (status === 'queued') return 'в очереди'
    if (status === 'preparing' || status === 'submitting') return 'отправляется'
    return 'видео делается'
  }
  if ((status === 'ready' || boardSceneRawVideoRefsV129P(scene)) && !videoMatchesImage) return 'stale image'
  if (boardSceneHasCurrentVideoResultV129P(scene)) return 'ready'
  return isVideoBusyStatus(status) ? (scene.video_status || scene.videoStatus || 'running') : 'empty'
}


function normalizeLoadedBoardVideoStatuses(boardData = {}) {
  const scenes = asSceneArray(boardData.scenes)
  if (!scenes.length) return boardData

  const resetWhenNoServerJob = new Set(['starting', 'preparing', 'submitting', 'running', 'queued_no_prompt_id'])
  let changed = false

  const nextScenes = scenes.map((scene) => {
    const status = String(scene?.video_status || '').toLowerCase()
    const hasServerJob = Boolean(scene?.video_job_id || scene?.video_status_endpoint)
    const hasVideo = boardSceneHasCurrentVideoResultV129P(scene)
    const reviewStatusV132D2 = boardSceneVideoReviewStatus(scene)
    const badReviewRegenerationV132D2 = Boolean(
      reviewStatusV132D2 === 'bad' ||
      scene?.video_review_regenerate_from_bad ||
      scene?.videoReviewRegenerateFromBad ||
      String(scene?.video_queue_source || scene?.videoQueueSource || '').toLowerCase() === 'bad_review_regeneration'
    )
    // AVA_BOARD_BAD_REVIEW_STATUS_PRIORITY_V132D2:
    // Bad-review regeneration keeps the old video visible while a new video is queued/running.
    // Do not normalize it back to ready on F5 just because hasVideo is true.
    if (hasVideo && badReviewRegenerationV132D2 && (reviewStatusV132D2 === 'needs_review' || scene?.video_ready_at || scene?.videoReadyAt || !hasServerJob)) {
      // AVA_BOARD_FINISHED_BAD_REGEN_READY_V132W:
      // After F5/re-enter a completed bad-regeneration can still carry old queue flags.
      // If the video ref is present and review says needs_review/posmotri, show it as ready.
      changed = true
      return {
        ...scene,
        video_status: 'ready',
        videoStatus: 'ready',
        video_error: '',
        videoError: '',
        video_job_id: '',
        videoJobId: '',
        video_status_endpoint: '',
        videoStatusEndpoint: '',
        status_endpoint: '',
        statusEndpoint: '',
        job_id: '',
        jobId: '',
        video_queue_position: 0,
        videoQueuePosition: 0,
        video_review_status: reviewStatusV132D2 === 'needs_review' ? 'needs_review' : (scene?.video_review_status || scene?.videoReviewStatus || ''),
        videoReviewStatus: reviewStatusV132D2 === 'needs_review' ? 'needs_review' : (scene?.videoReviewStatus || scene?.video_review_status || ''),
        review_status: reviewStatusV132D2 === 'needs_review' ? 'needs_review' : (scene?.review_status || scene?.reviewStatus || ''),
        reviewStatus: reviewStatusV132D2 === 'needs_review' ? 'needs_review' : (scene?.reviewStatus || scene?.review_status || ''),
        video_review_regenerate_from_bad: false,
        videoReviewRegenerateFromBad: false,
        video_review_regenerate_reason: '',
        videoReviewRegenerateReason: '',
      }
    }

    if (hasVideo && isVideoBusyStatus(status) && badReviewRegenerationV132D2) {
      return scene
    }

    if (hasVideo && isVideoBusyStatus(status)) {
      changed = true
      return {
        ...scene,
        video_status: 'ready',
        video_job_id: '',
        video_status_endpoint: '',
        video_error: '',
        video_queue_position: 0,
      }
    }

    if (status === 'queued' && !hasServerJob) {
      changed = true
      return {
        ...scene,
        video_status: '',
        video_error: '',
        video_queue_position: 0,
      }
    }

    if (resetWhenNoServerJob.has(status) && !hasServerJob) {
      changed = true
      return {
        ...scene,
        video_status: '',
        video_job_id: '',
        video_status_endpoint: '',
        video_error: '',
        video_queue_position: 0,
      }
    }

    return scene
  })

  if (!changed) return boardData
  return {
    ...boardData,
    scenes: nextScenes,
    updatedAt: new Date().toISOString(),
  }
}

// AVA_BOARD_IMPORT_PROMPT_OVERRIDE_V199A:
// When importing an Ava Board JSON, visible prompt fields from the imported file
// must win over the currently saved Board text. Media refs are still preserved
// by normalize/mergePreserveMediaRefs; this helper only replaces text metadata.
const BOARD_FORMAT_RULE_TEXT_V199A = /(?:Use the structured project format settings|structured project format|project_context\.format|Do not change aspect ratio|Photo\/video prompts must match|prompt_format_rule)/i

function boardLooksLikeFormatRuleTextV199A(value = '') {
  const text = asText(value)
  if (!text) return false
  return BOARD_FORMAT_RULE_TEXT_V199A.test(text)
}

function boardCleanImportedPromptTextV199A(value = '') {
  const text = asText(value)
  if (!text) return ''
  if (boardLooksLikeFormatRuleTextV199A(text)) return ''
  return text
    .replace(/^\s*(?:Vertical|Horizontal|Square)\s+(?:9:16|16:9|1:1|4:5)\s*(?:composition|format)?\s*[:.,;\-–—]*\s*/i, '')
    .replace(/^\s*(?:Use\s+)?(?:vertical|horizontal|square)\s+(?:9:16|16:9|1:1|4:5)\s*(?:composition|format)?\s*[:.,;\-–—]*\s*/i, '')
    .trim()
}

function boardImportedSceneTextPatchV199A(importedScene = {}) {
  const videoPrompt = boardCleanImportedPromptTextV199A(firstTextValue(
    importedScene.video_prompt,
    importedScene.videoPrompt,
    importedScene.positive_prompt,
    importedScene.positivePrompt,
    importedScene.prompt
  ))
  const negativePrompt = boardCleanImportedPromptTextV199A(firstTextValue(
    importedScene.negative_prompt,
    importedScene.negativePrompt,
    importedScene.video_motion_negative,
    importedScene.videoMotionNegative,
    importedScene.final_negative_prompt,
    importedScene.finalNegativePrompt
  ))
  const soundPrompt = boardCleanImportedPromptTextV199A(firstTextValue(
    importedScene.sound_prompt,
    importedScene.soundPrompt,
    importedScene.mmaudio_prompt,
    importedScene.mmaudioPrompt
  ))
  const blockId = boardCleanImportedPromptTextV199A(firstTextValue(importedScene.blockId, importedScene.block_id))
  const blockTitle = boardCleanImportedPromptTextV199A(firstTextValue(importedScene.blockTitle, importedScene.block_title))

  const patch = {
    blockId,
    block_id: blockId,
    blockTitle,
    block_title: blockTitle,
    prompt_import_source_v199a: 'json_import_visible_prompt_fields',
  }

  // Imported prompts intentionally override old Board prompts, even with empty strings
  // when the imported file was cleaned. This is what removes stale format-rule text.
  patch.video_prompt = videoPrompt
  patch.positive_prompt = videoPrompt
  patch.prompt = videoPrompt

  patch.negative_prompt = negativePrompt
  patch.negativePrompt = negativePrompt
  patch.video_motion_negative = negativePrompt
  patch.videoMotionNegative = negativePrompt
  patch.final_negative_prompt = negativePrompt
  patch.finalNegativePrompt = negativePrompt

  patch.sound_prompt = soundPrompt
  patch.soundPrompt = soundPrompt

  return patch
}

function boardApplyImportedPromptTextFieldsV199A(nextBoard = {}, importedJson = {}) {
  const timing = importedJson?.manualTiming || importedJson?.manual_timing || importedJson || {}
  const importedScenes = asSceneArray(timing.scenes)
  if (!importedScenes.length || !Array.isArray(nextBoard?.scenes)) return nextBoard

  const importedById = new Map(importedScenes.map((scene, index) => {
    const id = asText(scene?.scene_id || scene?.id || `seg_${String(index + 1).padStart(2, '0')}`)
    return [id, scene]
  }))

  let changed = false
  const scenes = nextBoard.scenes.map((scene) => {
    const id = asText(scene?.scene_id || scene?.id)
    const importedScene = importedById.get(id)
    if (!importedScene) return scene
    changed = true
    return {
      ...scene,
      ...boardImportedSceneTextPatchV199A(importedScene),
    }
  })

  if (!changed) return nextBoard
  return {
    ...nextBoard,
    scenes,
    prompt_import_applied_v199a: true,
    promptImportAppliedV199A: true,
    updatedAt: new Date().toISOString(),
  }
}

function sceneStatus(scene) {
  const reviewStatusPriorityV132D2 = boardSceneVideoReviewStatus(scene)
  const rawVideoStatusPriorityV132D2 = boardSceneVideoUiStatusV130F(scene)
  if (isVideoBusyStatus(rawVideoStatusPriorityV132D2)) {
    if (rawVideoStatusPriorityV132D2 === 'starting') return { label: 'отправляется', className: 'isRunning' }
    if (rawVideoStatusPriorityV132D2 === 'queued') return { label: 'в очереди', className: 'isRunning' }
    if (rawVideoStatusPriorityV132D2 === 'preparing' || rawVideoStatusPriorityV132D2 === 'submitting') return { label: 'отправляется', className: 'isRunning' }
    return { label: 'видео делается', className: 'isRunning' }
  }
  // AVA_BOARD_REVIEW_BAD_READY_LABEL_SPLIT_V132E:
  // Main card badge stays about video readiness. Review state is shown by the separate review badge.
  const status = boardSceneVideoUiStatusV130F(scene)
  const hasPrompt = Boolean(asText(scene?.video_prompt))
  const rawImageStatusV144B = String(scene?.image_status || scene?.imageStatus || scene?.first_frame_status || scene?.firstFrameStatus || '').toLowerCase()
  const imageAssetReadyV144B = rawImageStatusV144B.includes('asset_ready') || rawImageStatusV144B.includes('server_frame_ready') || rawImageStatusV144B === 'ready'
  const imageUploadingV144B = !imageAssetReadyV144B && Boolean(
    scene?.image_uploading_v129q || scene?.imageUploadingV129Q ||
    rawImageStatusV144B.includes('upload') || rawImageStatusV144B.includes('local_pending') || rawImageStatusV144B.includes('local_preview')
  )
  const hasImage = Boolean(
    sceneMediaFieldValue(scene, 'image', 'apiPath') || sceneMediaFieldValue(scene, 'first', 'apiPath') || sceneMediaFieldValue(scene, 'last', 'apiPath') ||
    sceneMediaFieldValue(scene, 'image', 'url') || sceneMediaFieldValue(scene, 'first', 'url') || sceneMediaFieldValue(scene, 'last', 'url') ||
    scene?.image_data_url || scene?.start_image_data_url || scene?.end_image_data_url ||
    scene?.image_name || scene?.first_frame_name || scene?.last_frame_name
  )
  const hasCurrentVideo = boardSceneHasCurrentVideoResultV129P(scene)
  const hasStaleVideo = boardSceneRawVideoRefsV129P(scene) && !boardVideoMatchesCurrentImageV129P(scene)

  if (imageUploadingV144B) return { label: 'фото грузится', className: 'isRunning' }
  if (status === 'starting') return { label: 'отправляется', className: 'isRunning' }
  if (status === 'queued') return { label: 'в очереди', className: 'isRunning' }
  if (status === 'preparing' || status === 'submitting') return { label: 'отправляется', className: 'isRunning' }
  if (status === 'running') return { label: 'видео делается', className: 'isRunning' }
  if (status === 'error') return { label: 'ошибка видео', className: 'isError' }
  if (reviewStatusPriorityV132D2 === 'bad') return { label: 'плохое', className: 'isBad' }
  if (reviewStatusPriorityV132D2 === 'needs_review') return { label: 'посмотри', className: 'isReview' }
  if (hasCurrentVideo) return { label: 'видео готово', className: 'isReady' }
  if (hasImage && hasPrompt) return { label: 'промт+фото', className: 'isPrompt' }
  if (hasPrompt) return { label: 'промт готов', className: 'isPrompt' }
  if (hasImage) return { label: 'фото готово', className: 'isImage' }
  return { label: 'черновик', className: 'isDraft' }
}

function videoButtonState(scene) {
  const reviewStatusButtonV132D2 = boardSceneVideoReviewStatus(scene)
  // AVA_BOARD_REVIEW_BAD_READY_LABEL_SPLIT_V132E: keep video button behavior separate from review badge.
  const status = boardSceneVideoUiStatusV130F(scene)
  const hasCurrentVideo = boardSceneHasCurrentVideoResultV129P(scene)
  const hasStaleVideo = boardSceneRawVideoRefsV129P(scene) && !boardVideoMatchesCurrentImageV129P(scene)

  if (status === 'starting') {
    return { className: 'isBusy', label: 'Отправляем видео', sublabel: 'создаём job…' }
  }
  if (status === 'queued' || status === 'preparing') {
    return { className: 'isBusy', label: 'В очереди', sublabel: scene?.video_job_id ? `job · ${scene.video_job_id}` : 'ожидает генерацию' }
  }
  if (status === 'running') {
    return { className: 'isBusy', label: 'Видео делается', sublabel: scene?.video_job_id ? `job · ${scene.video_job_id}` : 'Comfy генерирует…' }
  }
  if (status === 'error') {
    return { className: 'isError', label: 'Ошибка видео', sublabel: scene?.video_error || 'можно попробовать снова' }
  }
  if (status === 'blocked_missing_comfy_base_url') {
    return { className: 'isBlocked', label: 'Видео заблокировано', sublabel: 'нужен COMFY_BASE_URL' }
  }
  if (hasCurrentVideo) {
    return { className: 'isReady', label: 'Сделать заново', sublabel: 'готово · можно перегенерить' }
  }
  if (hasStaleVideo) {
    return { className: '', label: 'Сделать видео', sublabel: 'фото заменено · нужно новое видео' }
  }
  return { className: '', label: 'Сделать видео', sublabel: 'POST video/start' }
}




// AVA_BOARD_VIDEO_REVIEW_FLAGS_V130J:
// AVA_BOARD_VIDEO_REVIEW_LAYOUT_GATE_V130K:
// AVA_BOARD_VIDEO_REVIEW_META_RIGHT_V130L:
// Independent review layer for generated videos. It must not be mixed with video_status.
//   none          -> no review mark
//   bad           -> red mark, should be regenerated by "Сгенерировать все"
//   needs_review  -> orange mark after regenerating a bad video; user should watch it again
function boardSceneVideoReviewStatus(scene = {}) {
  // AVA_BOARD_REVIEW_READY_PLUS_LOOK_V132F:
  // After bad-video regeneration backend writes needs_review. If old bad helper
  // flags are still present in the scene object, needs_review must win so UI shows
  // orange "посмотри", not red "плохое".
  const explicitReviewV132F = String(
    scene?.video_review_status ||
    scene?.videoReviewStatus ||
    scene?.review_status ||
    scene?.reviewStatus ||
    ''
  ).toLowerCase().trim()
  if (['needs_review', 'review', 'check', 'посмотри', 'на проверку'].includes(explicitReviewV132F)) return 'needs_review'
  const raw = asText(
    scene?.video_review_status ||
    scene?.videoReviewStatus ||
    scene?.review_status ||
    scene?.reviewStatus ||
    ''
  ).toLowerCase()
  if (['bad', 'poor', 'reject', 'rejected', 'плохое', 'плохая'].includes(raw)) return 'bad'
  if (['needs_review', 'review', 'check', 'посмотри', 'на проверку'].includes(raw)) return 'needs_review'
  return ''
}

function boardSceneVideoReviewInfo(scene = {}) {
  const status = boardSceneVideoReviewStatus(scene)
  if (status === 'bad') {
    return {
      status,
      className: 'isBad',
      label: 'плохое',
      shortLabel: 'плохое',
      title: 'Видео помечено плохим. Оно попадёт на перегенерацию.',
      square: '■',
    }
  }
  if (status === 'needs_review') {
    return {
      status,
      className: 'isReview',
      label: 'посмотри',
      shortLabel: 'посмотри',
      title: 'Видео было перегенерировано. Один клик — принять/снять посмотри; если плохо — пометь плохим отдельно.',
      square: '■',
    }
  }
  return {
    status: '',
    className: 'isNeutral',
    label: '',
    shortLabel: '',
    title: 'Пометить видео как плохое для перегенерации.',
    square: '□',
  }
}

function boardSceneCanReviewVideo(scene = {}) {
  return boardSceneHasCurrentVideoResultV129P(scene)
}

function boardSceneHasBadVideoReview(scene = {}) {
  return boardSceneCanReviewVideo(scene) && boardSceneVideoReviewStatus(scene) === 'bad'
}

function boardBadReviewForceRegenerateAllowedV157A(scene = {}) {
  // AVA_BOARD_BAD_REGEN_FORCE_START_V159A:
  // A red "плохое" review is an explicit command to replace the old video.
  // Stale job ids/status endpoints from the previous generation must not block Generate All.
  try {
    if (typeof boardSceneHasBadVideoReview === 'function' && boardSceneHasBadVideoReview(scene)) return true
  } catch (error) {}
  const rawReview = String(
    scene?.video_review_status || scene?.videoReviewStatus ||
    scene?.video_review_state || scene?.videoReviewState ||
    scene?.review_status || scene?.reviewStatus ||
    scene?.video_quality_status || scene?.videoQualityStatus ||
    scene?.quality_status || scene?.qualityStatus ||
    scene?.status || ''
  ).toLowerCase()
  return Boolean(
    scene?.video_review_bad || scene?.videoReviewBad ||
    scene?.bad_video || scene?.badVideo ||
    rawReview === 'bad' || rawReview.includes('bad') || rawReview.includes('плох') || rawReview.includes('не ок')
  )
}

function boardBadReviewForceRegenerateAllowedV156A(scene = {}) {
  // AVA_BOARD_BAD_REGEN_FORCE_START_V159A: keep old V156 call sites alive,
  // but never let old job/status fields block a red bad-review regeneration.
  return boardBadReviewForceRegenerateAllowedV157A(scene)
}

function boardSceneNeedsVideoReview(scene = {}) {
  return boardSceneCanReviewVideo(scene) && boardSceneVideoReviewStatus(scene) === 'needs_review'
}



function boardVideoReviewPatch(status = '', reason = 'manual') {
  const safeStatus = ['bad', 'needs_review'].includes(String(status || '').toLowerCase())
    ? String(status || '').toLowerCase()
    : ''
  const nowV136D = new Date().toISOString()
  if (!safeStatus) {
    return {
      video_review_status: '',
      videoReviewStatus: '',
      review_status: '',
      reviewStatus: '',
      video_review_reason: '',
      videoReviewReason: '',
      video_review_updated_at: '',
      videoReviewUpdatedAt: '',
      video_review_clear_reason: reason || 'manual_review_clear_v136d',
      videoReviewClearReason: reason || 'manual_review_clear_v136d',
      video_review_cleared_at: nowV136D,
      videoReviewClearedAt: nowV136D,
      video_review_clear_token_v136d: `review_clear_v136d_${nowV136D}_${Math.random().toString(36).slice(2, 8)}`,
      videoReviewClearTokenV136D: `review_clear_v136d_${nowV136D}_${Math.random().toString(36).slice(2, 8)}`,
      video_review_regenerate_from_bad: false,
      videoReviewRegenerateFromBad: false,
      video_review_regenerate_reason: '',
      videoReviewRegenerateReason: '',
      bad_video_review: false,
      badVideoReview: false,
      video_review_bad: false,
      videoReviewBad: false,
    }
  }
  return {
    video_review_status: safeStatus,
    videoReviewStatus: safeStatus,
    review_status: safeStatus,
    reviewStatus: safeStatus,
    video_review_updated_at: nowV136D,
    videoReviewUpdatedAt: nowV136D,
    video_review_reason: reason,
    videoReviewReason: reason,
    video_review_clear_reason: '',
    videoReviewClearReason: '',
    video_review_cleared_at: '',
    videoReviewClearedAt: '',
  }
}


function boardVideoReviewRegenerateFlagPatch(wasBad = false, reason = '') {
  return {
    video_review_regenerate_from_bad: Boolean(wasBad),
    videoReviewRegenerateFromBad: Boolean(wasBad),
    video_review_regenerate_reason: reason,
    videoReviewRegenerateReason: reason,
  }
}

function boardVideoWasBadBeforeRegenerate(scene = {}) {
  return Boolean(scene?.video_review_regenerate_from_bad || scene?.videoReviewRegenerateFromBad)
}

function ImageSlot({ title, subtitle, value, name, onSelect, onClear, busy = false, busyLabel = '', busyHint = '', statusLabel = '', statusClassName = '' }) {
  const imageRefV200W = useRef(null)
  const [imageLoading, setImageLoading] = useState(Boolean(value))
  const [imageFailed, setImageFailed] = useState(false)
  const [imageZoomOpenV202C, setImageZoomOpenV202C] = useState(false)
  const showBusyOverlay = Boolean(busy || imageLoading)
  const loaderText = busyLabel || (imageLoading ? 'Загружаем фото…' : 'Подгружаем…')

  useEffect(() => {
    setImageZoomOpenV202C(false)
    setImageFailed(false)
    if (!value) {
      setImageLoading(false)
      return undefined
    }

    setImageLoading(true)
    let cancelled = false
    let rafId = 0
    let timerId = 0

    const checkCachedImageV200W = () => {
      if (cancelled) return
      const imageNode = imageRefV200W.current
      if (!imageNode) return
      if (!imageNode.complete) return
      if (imageNode.naturalWidth > 0 || imageNode.naturalHeight > 0) {
        setImageLoading(false)
        setImageFailed(false)
      } else {
        setImageLoading(false)
        setImageFailed(true)
      }
    }

    try {
      rafId = window.requestAnimationFrame(checkCachedImageV200W)
      timerId = window.setTimeout(checkCachedImageV200W, 450)
    } catch {
      timerId = window.setTimeout(checkCachedImageV200W, 0)
    }

    return () => {
      cancelled = true
      try { if (rafId) window.cancelAnimationFrame(rafId) } catch {}
      try { if (timerId) window.clearTimeout(timerId) } catch {}
    }
  }, [value])

  return (
    <div className={`avaBoardImageSlot ${busy ? 'isBusyV132O' : ''}`}>
      <div className="avaBoardImageSlotHeader">
        <div>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
        <div className="avaBoardImageSlotMetaV132O">
          {statusLabel ? <small className={`avaBoardImageSlotStatusV132O ${statusClassName || ''}`}>{statusLabel}</small> : null}
          {name && <small>{name}</small>}
        </div>
      </div>
      <div className={`avaBoardImagePreview ${showBusyOverlay ? 'isLoadingMedia' : ''} ${imageFailed ? 'isMissingMedia' : ''}`}>
        {value ? (
          <>
            {!imageFailed ? (
              <img
                ref={imageRefV200W}
                key={value}
                src={value}
                alt={title}
                loading="eager"
                decoding="async"
                onLoad={() => { setImageLoading(false); setImageFailed(false) }}
                onError={() => { setImageLoading(false); setImageFailed(true) }}
              />
            ) : null}
            {showBusyOverlay ? (
              <div className="avaMediaLoadingOverlay avaBoardMediaSpinnerOverlayV15 avaBoardImageStatusOverlayV132O">
                {/* AVA_BOARD_MEDIA_STATUS_INDICATORS_V132O: image restore/upload/save overlay */}
                <span className="avaBoardTinyMediaSpinner" aria-hidden="true" />
                <span className="avaBoardMediaLoaderText">{loaderText}</span>
                {busyHint ? <small>{busyHint}</small> : null}
              </div>
            ) : null}
            {!showBusyOverlay && !imageFailed ? (
              <button
                type="button"
                className="avaBoardImageZoomHotspotV202C"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setImageZoomOpenV202C(true)
                }}
                title="Увеличить фото"
                aria-label="Увеличить фото"
              >
                <span className="avaBoardImageZoomBadgeV202C" aria-hidden="true">⌕</span>
              </button>
            ) : null}
            {imageFailed ? (
              <div className="avaMediaLoadingOverlay isMissing">
                <ImageIcon size={30} />
                <span>Фото не найдено</span>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div><ImageIcon size={30} /><span>{busy ? 'Подгружаем изображение…' : 'Нет изображения'}</span></div>
            {showBusyOverlay ? (
              <div className="avaMediaLoadingOverlay avaBoardMediaSpinnerOverlayV15 avaBoardImageStatusOverlayV132O">
                {/* AVA_BOARD_MEDIA_STATUS_INDICATORS_V132O: protected asset may exist before blob URL is ready */}
                <span className="avaBoardTinyMediaSpinner" aria-hidden="true" />
                <span className="avaBoardMediaLoaderText">{loaderText}</span>
                {busyHint ? <small>{busyHint}</small> : null}
              </div>
            ) : null}
          </>
        )}
      </div>
      {/* AVA_BOARD_IMAGE_ZOOM_HOTSPOT_V202C: hover photo -> loupe, click -> centered lightbox, click anywhere -> close. */}
      {value && imageZoomOpenV202C ? (
        <div
          className="avaBoardImageLightboxV202C"
          role="button"
          tabIndex={0}
          onClick={() => setImageZoomOpenV202C(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setImageZoomOpenV202C(false)
            }
          }}
          title="Нажми в любом месте, чтобы закрыть"
        >
          <img src={value} alt={title} onClick={(event) => event.stopPropagation()} />
        </div>
      ) : null}

      <div className="avaBoardSlotActions">
        <label className="avaBoardSmallButton" title="Ручная замена фото в этой сцене — имя файла может быть любым">
          <UploadCloud size={14} /> Загрузить
          <input type="file" accept="image/png,image/jpeg,image/webp,image/*" onChange={onSelect} />
        </label>
        <button type="button" onClick={onClear}>Удалить</button>
      </div>
    </div>
  )
}


function boardAssemblyVideoRef(scene = {}) {
  return String(
    scene.mmaudio_video_api_path || scene.mmaudioVideoApiPath ||
    scene.video_api_path || scene.videoApiPath ||
    scene.mmaudio_video_url || scene.mmaudioVideoUrl ||
    scene.video_url || scene.videoUrl || ''
  ).trim()
}

function buildBoardAssemblySnapshotFromBoard(board = {}, { projectId = '', source = 'board_to_assembly_confirmed' } = {}) {
  const now = new Date().toISOString()
  const scenes = asSceneArray(board.scenes).map((scene, index) => {
    const start = toNumber(scene.start_sec ?? scene.start, 0)
    const duration = durationOf(scene)
    const end = toNumber(scene.end_sec ?? scene.end, start + duration)
    const hue = scene.sceneColor ?? scene.scene_color ?? scene.blockHue ?? scene.block_hue ?? scene.color ?? scene.hue ?? ''
    return canonicalizeBoardSceneMediaRefs({
      ...scene,
      id: scene.id || scene.scene_id || `seg_${String(index + 1).padStart(2, '0')}`,
      scene_id: scene.scene_id || scene.id || `seg_${String(index + 1).padStart(2, '0')}`,
      index,
      start,
      start_sec: start,
      end,
      end_sec: end,
      duration_sec: duration,
      durationSec: duration,
      sceneColor: hue,
      scene_color: hue,
      blockId: scene.blockId ?? scene.block_id ?? '',
      block_id: scene.block_id ?? scene.blockId ?? '',
      blockTitle: scene.blockTitle ?? scene.block_title ?? '',
      block_title: scene.block_title ?? scene.blockTitle ?? '',
    })
  })
  const items = scenes.map((scene, index) => {
    const start = toNumber(scene.start_sec ?? scene.start, 0)
    const duration = durationOf(scene)
    const end = toNumber(scene.end_sec ?? scene.end, start + duration)
    const videoRef = boardAssemblyVideoRef(scene)
    return {
      id: scene.id || scene.scene_id || `seg_${String(index + 1).padStart(2, '0')}`,
      scene_id: scene.scene_id || scene.id || `seg_${String(index + 1).padStart(2, '0')}`,
      sceneId: scene.scene_id || scene.id || `seg_${String(index + 1).padStart(2, '0')}`,
      title: scene.title || scene.id || scene.scene_id || `Сцена ${index + 1}`,
      route: scene.route || 'i2v',
      start_sec: start,
      start,
      end_sec: end,
      end,
      duration_sec: duration,
      durationSec: duration,
      video_url: scene.video_url || scene.videoUrl || scene.mmaudio_video_url || scene.mmaudioVideoUrl || videoRef,
      videoUrl: scene.videoUrl || scene.video_url || scene.mmaudioVideoUrl || scene.mmaudio_video_url || videoRef,
      video_api_path: scene.video_api_path || scene.videoApiPath || scene.mmaudio_video_api_path || scene.mmaudioVideoApiPath || '',
      videoApiPath: scene.videoApiPath || scene.video_api_path || scene.mmaudioVideoApiPath || scene.mmaudio_video_api_path || '',
      hasVideo: Boolean(videoRef),
      has_video: Boolean(videoRef),
      hasSound: Boolean(scene.mmaudio_video_api_path || scene.mmaudioVideoApiPath || scene.mmaudio_video_url || scene.mmaudioVideoUrl || scene.has_sound || scene.hasSound),
      has_sound: Boolean(scene.mmaudio_video_api_path || scene.mmaudioVideoApiPath || scene.mmaudio_video_url || scene.mmaudioVideoUrl || scene.has_sound || scene.hasSound),
      blockId: scene.blockId ?? scene.block_id ?? '',
      block_id: scene.block_id ?? scene.blockId ?? '',
      blockTitle: scene.blockTitle ?? scene.block_title ?? '',
      block_title: scene.block_title ?? scene.blockTitle ?? '',
      sceneColor: scene.sceneColor ?? scene.scene_color ?? scene.blockHue ?? scene.block_hue ?? scene.color ?? scene.hue ?? '',
      scene_color: scene.scene_color ?? scene.sceneColor ?? scene.block_hue ?? scene.blockHue ?? scene.color ?? scene.hue ?? '',
      raw: scene,
    }
  })
  const audio = board.audio || board.sourceAudio || board.timingAudio || board.originalAudio || null
  const selectedSceneId = board.selectedSceneId || scenes[0]?.id || scenes[0]?.scene_id || ''
  return {
    stage: 'board_assembly',
    schema: 'ava_board_assembly_snapshot_v8',
    source,
    importedFrom: 'board',
    projectId: projectId || '',
    boardVersion: board.boardVersion || board.board_version || BOARD_VERSION,
    board: { ...board, scenes, audio, selectedSceneId },
    boardSnapshot: { ...board, scenes, audio, selectedSceneId },
    scenes,
    boardScenes: scenes,
    items,
    readyItems: items,
    selectedSceneId,
    audio,
    sourceAudio: audio,
    timingAudio: audio,
    originalAudio: audio,
    audioMode: 'original_plus_scene',
    preferMmaudio: true,
    skipMissing: false,
    originalVolume: 100,
    sceneVolume: 25,
    musicVolume: 15,
    watermark: {
      enabled: true,
      text: 'ava studio',
      position: 'top_right',
      opacityPercent: 35,
      size: 28,
      motion: 'corners',
    },
    finalVideoUrl: '',
    finalUrl: '',
    assemblyUrl: '',
    outputUrl: '',
    resultUrl: '',
    assemblyJob: null,
    finalDirty: false,
    updatedAt: now,
  }
}



function cleanBoardSceneMediaForTimingImportV14B(scene = {}) {
  // AVA_TIMING_TO_BOARD_CLEAN_IMPORT_V14B:
  // Timing -> Board is a destructive replacement. Keep timing/notes/blocks/colors,
  // but never preserve old Board media, audio slices, video jobs or generated clips.
  return {
    ...scene,
    start_image_url: '',
    startImageUrl: '',
    start_image_api_path: '',
    startImageApiPath: '',
    first_frame_url: '',
    firstFrameUrl: '',
    first_image_api_path: '',
    firstImageApiPath: '',
    first_frame_name: '',
    last_frame_url: '',
    lastFrameUrl: '',
    last_image_api_path: '',
    lastImageApiPath: '',
    end_image_url: '',
    endImageUrl: '',
    end_image_api_path: '',
    endImageApiPath: '',
    last_frame_name: '',
    image_url: '',
    imageUrl: '',
    image_api_path: '',
    imageApiPath: '',
    image_name: '',
    imageName: '',
    video_url: '',
    videoUrl: '',
    video_api_path: '',
    videoApiPath: '',
    video_name: '',
    videoName: '',
    original_video_url: '',
    originalVideoUrl: '',
    video_result: null,
    videoResult: null,
    video_status: '',
    videoStatus: '',
    video_job_id: '',
    videoJobId: '',
    video_status_endpoint: '',
    videoStatusEndpoint: '',
    video_error: '',
    videoError: '',
    video_queue_position: 0,
    video_review_status: '',
    videoReviewStatus: '',
    review_status: '',
    reviewStatus: '',
    video_review_regenerate_from_bad: false,
    videoReviewRegenerateFromBad: false,
    audio_slice_url: '',
    audioSliceUrl: '',
    audio_slice_name: '',
    audioSliceName: '',
    audio_slice_duration: 0,
    audioSliceDuration: 0,
    audio_slice_status: '',
    previous_frame_status: 'empty',
    mmaudio_status: '',
    mmaudioStatus: '',
    mmaudio_job_id: '',
    mmaudioJobId: '',
    mmaudio_status_endpoint: '',
    mmaudioStatusEndpoint: '',
    mmaudio_video_url: '',
    mmaudioVideoUrl: '',
    mmaudio_video_api_path: '',
    mmaudioVideoApiPath: '',
    mmaudio_error: '',
    mmaudioError: '',
  }
}

function buildCleanBoardFromTimingV14B(timingData = {}) {
  const next = buildBoardFromTiming(timingData, {
    ...emptyBoard,
    boardVersion: BOARD_VERSION,
    source: 'timing_to_board_imported_v14b',
    importedFrom: 'manual_timing',
    scenes: [],
    audio: null,
    selectedSceneId: '',
  })
  const cleanScenes = asSceneArray(next.scenes).map((scene) => {
    const cleanScene = cleanBoardSceneMediaForTimingImportV14B(scene)
    const start = toNumber(cleanScene.start_sec ?? cleanScene.start, 0)
    const end = toNumber(cleanScene.end_sec ?? cleanScene.end, start)
    const duration = Number((Math.max(0, end - start) || toNumber(cleanScene.duration_sec ?? cleanScene.duration, 0)).toFixed(3))
    return {
      ...cleanScene,
      source: cleanScene.source || 'manual_timing',
      importedFrom: 'manual_timing',
      timingLocked: true,
      timing_locked: true,
      durationLocked: true,
      duration_locked: true,
      durationSource: 'manual_timing',
      duration_source: 'manual_timing',
      timing_start_sec: start,
      timingStartSec: start,
      timing_end_sec: end,
      timingEndSec: end,
      timing_duration_sec: duration,
      timingDurationSec: duration,
      duration_sec: duration,
      duration: duration,
      end_sec: Number((start + duration).toFixed(3)),
      end: Number((start + duration).toFixed(3)),
    }
  })
  return {
    ...emptyBoard,
    ...next,
    source: 'timing_to_board_imported_v14b',
    importedFrom: 'manual_timing',
    scenes: cleanScenes,
    selectedSceneId: cleanScenes[0]?.id || cleanScenes[0]?.scene_id || next.selectedSceneId || '',
    updatedAt: new Date().toISOString(),
  }
}


function selectedSceneAccentColorV60C(scene = {}) {
  return scene?.sceneColor || scene?.scene_color || scene?.blockColor || scene?.block_color || scene?.color || scene?.hue || '#8b5cf6'
}


// AVA_BOARD_SELECTED_SCENE_ACCENT_RGB_V61: robust scene accent color variables for Board UI.
function sceneAccentColorValueV61(scene = {}) {
  return scene?.sceneColor || scene?.scene_color || scene?.blockColor || scene?.block_color || scene?.color || scene?.hue || '#8b5cf6'
}

function sceneAccentRgbV61(scene = {}) {
  const raw = String(sceneAccentColorValueV61(scene) || '#8b5cf6').trim()
  const hex = raw.match(/^#?([0-9a-f]{6})$/i)
  if (hex) {
    const value = hex[1]
    return `${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)}`
  }

  const shortHex = raw.match(/^#?([0-9a-f]{3})$/i)
  if (shortHex) {
    const value = shortHex[1].split('').map((ch) => ch + ch).join('')
    return `${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)}`
  }

  const rgb = raw.match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i)
  if (rgb) return `${Math.round(Number(rgb[1]))}, ${Math.round(Number(rgb[2]))}, ${Math.round(Number(rgb[3]))}`

  const hsl = raw.match(/hsla?\(\s*([0-9.]+)(?:deg)?\s*,\s*([0-9.]+)%\s*,\s*([0-9.]+)%/i)
  if (hsl) {
    const h = ((Number(hsl[1]) % 360) + 360) % 360
    const s = Math.max(0, Math.min(1, Number(hsl[2]) / 100))
    const l = Math.max(0, Math.min(1, Number(hsl[3]) / 100))
    const c = (1 - Math.abs(2 * l - 1)) * s
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
    const m = l - c / 2
    let r = 0
    let g = 0
    let b = 0
    if (h < 60) [r, g, b] = [c, x, 0]
    else if (h < 120) [r, g, b] = [x, c, 0]
    else if (h < 180) [r, g, b] = [0, c, x]
    else if (h < 240) [r, g, b] = [0, x, c]
    else if (h < 300) [r, g, b] = [x, 0, c]
    else [r, g, b] = [c, 0, x]
    return `${Math.round((r + m) * 255)}, ${Math.round((g + m) * 255)}, ${Math.round((b + m) * 255)}`
  }

  return '139, 92, 246'
}


// AVA_PROJECT_FORMAT_RUNTIME_SCOPE_V177C:
// Keep project format helpers in BoardPage module scope. Vite can build even when
// a helper is inserted in a nested scope, but the BoardPage component then fails
// at runtime. These helpers are intentionally self-contained and only touch
// format/aspect_ratio/output_format metadata.
function boardCleanFormatValueV177C(value = '') {
  const clean = String(value || '').trim()
  return /^(9:16|16:9|1:1|4:5)$/i.test(clean) ? clean : ''
}

function boardPromptRuleForFormatV177C(format = '') {
  const locked = boardCleanFormatValueV177C(format) || '16:9'
  if (locked === '9:16') return 'Use vertical 9:16 composition in photo and video prompts.'
  if (locked === '1:1') return 'Use square 1:1 composition in photo and video prompts.'
  if (locked === '4:5') return 'Use vertical 4:5 composition in photo and video prompts.'
  return 'Use horizontal 16:9 composition in photo and video prompts.'
}

function boardReadFormatFromObjectV177C(value = null) {
  if (!value || typeof value !== 'object') return ''
  return (
    boardCleanFormatValueV177C(value.format) ||
    boardCleanFormatValueV177C(value.aspect_ratio) ||
    boardCleanFormatValueV177C(value.aspectRatio) ||
    boardCleanFormatValueV177C(value.output_format) ||
    boardCleanFormatValueV177C(value.outputFormat) ||
    boardReadFormatFromObjectV177C(value.project_context) ||
    boardReadFormatFromObjectV177C(value.project)
  )
}

function boardProjectFormatFromContextV177C(projectId = '', activeProject = null, projects = []) {
  const cleanProjectId = String(projectId || '').trim()
  const matchingProject = Array.isArray(projects)
    ? projects.find((project) => String(project?.id || '') === cleanProjectId)
    : null
  return boardReadFormatFromObjectV177C(activeProject) || boardReadFormatFromObjectV177C(matchingProject) || ''
}

function boardApplyFormatToSceneV177C(scene = {}, format = '') {
  const locked = boardCleanFormatValueV177C(format) || boardReadFormatFromObjectV177C(scene)
  if (!locked || !scene || typeof scene !== 'object') return scene
  return {
    ...scene,
    format: locked,
    aspect_ratio: locked,
    output_format: locked,
    format_contract: {
      ...(scene.format_contract || {}),
      locked: true,
      format: locked,
      aspect_ratio: locked,
      output_format: locked,
      prompt_rule: boardPromptRuleForFormatV177C(locked),
    },
  }
}

function boardInjectProjectFormatIntoTimingV177C(timingData = {}, projectFormat = '') {
  const locked = boardCleanFormatValueV177C(projectFormat) || boardReadFormatFromObjectV177C(timingData)
  if (!locked || !timingData || typeof timingData !== 'object') return timingData

  const applySceneFormat = (scene = {}) => boardApplyFormatToSceneV177C(scene, locked)
  const next = {
    ...timingData,
    format: locked,
    aspect_ratio: locked,
    output_format: locked,
    project: {
      ...(timingData.project || {}),
      format: locked,
      aspect_ratio: locked,
      output_format: locked,
    },
    project_context: {
      ...(timingData.project_context || {}),
      format: locked,
      aspect_ratio: locked,
      output_format: locked,
    },
    format_contract: {
      ...(timingData.format_contract || {}),
      locked: true,
      source_of_truth: 'active_project.format/project_context.format',
      format: locked,
      aspect_ratio: locked,
      output_format: locked,
      codex_rule: 'Use project_context.format and scene.format as locked output format. For 9:16 write vertical prompts, for 16:9 write horizontal prompts, for 1:1 write square prompts. Do not change aspect ratio.',
    },
  }

  if (Array.isArray(next.scenes)) next.scenes = next.scenes.map(applySceneFormat)
  if (Array.isArray(next.production?.scenes)) {
    next.production = {
      ...next.production,
      scenes: next.production.scenes.map(applySceneFormat),
    }
  }
  if (Array.isArray(next.timing?.scenes)) {
    next.timing = {
      ...next.timing,
      format: locked,
      aspect_ratio: locked,
      output_format: locked,
      scenes: next.timing.scenes.map(applySceneFormat),
    }
  }

  for (const key of ['manualTiming', 'manual_timing']) {
    if (next[key] && typeof next[key] === 'object') {
      next[key] = {
        ...next[key],
        format: locked,
        aspect_ratio: locked,
        output_format: locked,
        scenes: Array.isArray(next[key].scenes) ? next[key].scenes.map(applySceneFormat) : next[key].scenes,
      }
    }
  }

  return next
}

// AVA_BOARD_SPEED_CACHE_NOOP_V200C:
// UI-only scene selection must not dirty/save the whole board.
// This fingerprint is used only for autosave de-dupe; real saves still use the full board payload.
function boardStripAutosaveUiOnlyV200C(value) {
  const volatileKeys = new Set([
    'selectedSceneId',
    'selected_scene_id',
    'updatedAt',
    'updated_at',
    'lastSavedAt',
    'last_saved_at',
    'clientUpdatedAt',
    'client_updated_at',
    'lastAutoSaveAt',
    'last_auto_save_at',
  ])
  if (Array.isArray(value)) return value.map((item) => boardStripAutosaveUiOnlyV200C(item))
  if (value && typeof value === 'object') {
    const next = {}
    Object.entries(value).forEach(([key, item]) => {
      if (volatileKeys.has(String(key))) return
      next[key] = boardStripAutosaveUiOnlyV200C(item)
    })
    return next
  }
  return value
}

function boardAutosaveFingerprintV200C(value) {
  try {
    return JSON.stringify(boardStripAutosaveUiOnlyV200C(value || {}))
  } catch {
    return `${Date.now()}:${Math.random()}`
  }
}

export default function BoardPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const boardWorkflowEntry = useMemo(() => {
    const entry = readWorkflowEntry('board', location.state)
    // AVA_TIMING_TO_BOARD_CONSUME_ONCE_V146:
    // Browser history can keep location.state after F5. If we already consumed
    // this Timing -> Board handoff, ignore it and open Board as a normal Board.
    if (isTimingToBoardEntryConsumedV146(entry)) {
      clearWorkflowEntry('board')
      return null
    }
    return entry
  }, [location.state])
  const openedFromTiming = boardWorkflowEntry?.from === 'manual_timing'
  const workspaceMode = !projectId
  const { loadStage, saveStage, loadWorkspaceStage, saveWorkspaceStage, activeProject, projects } = useProjects()
  const activeProjectFormatV177B = useMemo(() => boardProjectFormatFromContextV177C(projectId, activeProject, projects), [projectId, activeProject, projects])
  const [board, setBoard] = useState(emptyBoard)
  const [manualSceneDurationSec, setManualSceneDurationSec] = useState(6)
  const [assemblyVideoTrimOpenV201A, setAssemblyVideoTrimOpenV201A] = useState(false)
  const selectedVideoElementRefV201D = useRef(null)
  const [assemblyVideoTrimTimeV201D, setAssemblyVideoTrimTimeV201D] = useState(0)
  const [assemblyVideoTrimPlayingV201D, setAssemblyVideoTrimPlayingV201D] = useState(false)


    const [showTimingToBoardConfirm, setShowTimingToBoardConfirm] = useState(false)
  const [timingToBoardImporting, setTimingToBoardImporting] = useState(false)

  useEffect(() => {
    // AVA_TIMING_TO_BOARD_CONSUME_ONCE_V146:
    // Timing -> Board is allowed to replace Board exactly once per confirmed click.
    // F5/direct reload must not repeat the destructive import from Manual Timing.
    if (!openedFromTiming) return
    const entrySource = String(boardWorkflowEntry?.source || '')
    if (entrySource === 'manual_timing_to_board_confirmed_v16') {
      if (isTimingToBoardEntryConsumedV146(boardWorkflowEntry)) {
        clearWorkflowEntry('board')
        setShowTimingToBoardConfirm(false)
        setStatus('Доска открыта без повторного переноса из Тайминга.')
        return
      }
      markTimingToBoardEntryConsumedV146(boardWorkflowEntry)
      clearWorkflowEntry('board')
      confirmTimingToBoardImportV14B()
      return
    }
    clearWorkflowEntry('board')
    setShowTimingToBoardConfirm(false)
    setStatus('Открыта Доска. Повторное окно переноса из Тайминга отключено после перезагрузки.')
  }, [openedFromTiming, boardWorkflowEntry?.source, boardWorkflowEntry?.createdAt])

function isBoardVideoDoneStatus(status) {
    return ['completed', 'done', 'ready', 'success'].includes(String(status || '').toLowerCase())
  }

  function isBoardVideoErrorStatus(status) {
    return ['error', 'failed', 'queued_no_prompt_id', 'output_download_failed', 'output_finalize_failed', 'completed_without_video_output'].includes(String(status || '').toLowerCase())
  }

  function isBoardVideoBlockedStatus(status) {
    return String(status || '').toLowerCase().startsWith('blocked_')
  }

  function isBoardVideoStaleJobStatus(status, data = {}) {
    // AVA_BOARD_STALE_JOB_CODES_V200H: backend can return orphan/stale codes, not only BOARD_VIDEO_JOB_NOT_FOUND.
    const normalized = String(status || '').toLowerCase()
    const code = String(data?.code || data?.error?.code || '').toUpperCase()
    const errorText = String(data?.error || data?.detail || '').toLowerCase()
    return normalized === 'not_found' ||
      normalized === 'orphaned' ||
      normalized === 'stale' ||
      code === 'BOARD_VIDEO_JOB_NOT_FOUND' ||
      code.includes('BOARD_VIDEO_JOB_ORPHANED') ||
      code.includes('BOARD_VIDEO_JOB_STALE') ||
      errorText.includes('orphan') ||
      errorText.includes('stale_job')
  }

  function resetStaleVideoJobPatch(data = {}) {
    const reason = data?.error || data?.detail || data?.code || 'stale_job_reset_v200h'
    return {
      video_status: '',
      videoStatus: '',
      video_job_id: '',
      videoJobId: '',
      video_status_endpoint: '',
      videoStatusEndpoint: '',
      video_error: reason,
      videoError: reason,
      video_queue_position: 0,
      videoQueuePosition: 0,
      video_result: data || null,
      videoResult: data || null,
      video_interrupted_reason: reason,
      videoInterruptedReason: reason,
      video_updated_at: new Date().toISOString(),
      videoUpdatedAt: new Date().toISOString(),
    }
  }

  function boardVideoUrlFromStatus(data) {
    return data?.videoApiPath || data?.video_api_path || data?.resultVideoApiPath || data?.result_video_api_path || data?.videoUrl || data?.video_url || data?.resultVideoUrl || data?.result_video_url || ''
  }

  function sceneVideoInputProblems(scene) {
    const route = normalizeBoardRouteValueV154A(scene?.route || 'i2v')
    const isFirstLast = isFirstLastRoute(route)
    const isLipSync = isBoardAudioDrivenRouteV154A(route)

    const startImage = isFirstLast
      ? (sceneMediaFieldValue(scene, 'first', 'apiPath') || sceneMediaFieldValue(scene, 'first', 'url') || sceneMediaFieldValue(scene, 'image', 'apiPath') || sceneMediaFieldValue(scene, 'image', 'url') || scene?.start_image_data_url || scene?.startImageDataUrl || scene?.image_data_url || scene?.imageDataUrl || '')
      : (sceneMediaFieldValue(scene, 'image', 'apiPath') || sceneMediaFieldValue(scene, 'image', 'url') || sceneMediaFieldValue(scene, 'first', 'apiPath') || sceneMediaFieldValue(scene, 'first', 'url') || scene?.image_data_url || scene?.imageDataUrl || scene?.start_image_data_url || scene?.startImageDataUrl || '')

    const endImage = isFirstLast
      ? (sceneMediaFieldValue(scene, 'last', 'apiPath') || sceneMediaFieldValue(scene, 'last', 'url') || scene?.end_image_data_url || scene?.endImageDataUrl || '')
      : ''

    const audioSlice = manualLipSyncAudioSourceV129A(scene)

    const problems = []
    if (!startImage) problems.push('нет первого/основного кадра')
    if (isFirstLast && !endImage) problems.push('нет последнего кадра')
    if (isLipSync && !audioSlice) problems.push('нет audio slice для ia2v')
    return problems
  }

  function showSceneVideoInputError(scene, problems) {
    const message = problems.length ? problems.join(', ') : 'недостаточно данных для генерации'
    localVideoQueueRef.current = localVideoQueueRef.current.filter((sceneId) => sceneId !== scene.id)
    updateScene(scene.id, {
      video_status: 'error',
      video_error: message,
      video_queue_position: 0,
    })
    setStatus(`Сцена ${scene.id} не отправлена: ${message}`)
  }

  function removeInvalidScenesFromLocalQueue() {
    const invalidIds = []
    localVideoQueueRef.current = localVideoQueueRef.current.filter((sceneId) => {
      const scene = asSceneArray(boardRef.current?.scenes).find((item) => item.id === sceneId)
      if (!scene) return false
      const problems = sceneVideoInputProblems(scene)
      if (problems.length) {
        invalidIds.push({ scene, problems })
        return false
      }
      return true
    })
    invalidIds.forEach(({ scene, problems }) => showSceneVideoInputError(scene, problems))
    return invalidIds.length
  }


  
function sceneVideoActionState(scene) {
  // AVA_BOARD_ACTION_LABEL_FLOW_V132S:
  // Full replacement because the first V132S repair accidentally removed const isError,
  // causing runtime ReferenceError after page load.
  const rawVideoStatus = String(scene?.video_status || scene?.videoStatus || '').toLowerCase()
  const videoStatus = String(boardSceneVideoUiStatusV130F(scene) || rawVideoStatus || '').toLowerCase()
  const hasVideo = boardSceneHasCurrentVideoResultV129P(scene)
  const hasServerJob = Boolean(
    scene?.video_job_id || scene?.videoJobId ||
    scene?.video_status_endpoint || scene?.videoStatusEndpoint
  )
  const problems = sceneVideoInputProblems(scene)
  const hasInputProblems = problems.length > 0
  const submittingStatuses = ['starting', 'preparing', 'submitting']
  const activeStatuses = ['running', 'processing', 'queued_no_prompt_id']
  // AVA_BOARD_STALE_BATCH_UNBLOCK_V150A: stale snapshot statuses without a live job
  // must not keep the button disabled after backend reload or after an interrupted batch.
  const isSubmittingRawV150A = submittingStatuses.includes(rawVideoStatus) || submittingStatuses.includes(videoStatus)
  const isRunningRawV150A = activeStatuses.includes(rawVideoStatus) || activeStatuses.includes(videoStatus) || rawVideoStatus === 'queued'
  const isSubmitting = isSubmittingRawV150A && (hasServerJob || boardVideoActiveStampFreshV150A(scene))
  const isRunning = isRunningRawV150A && hasServerJob
  const isActiveServerJob = isSubmitting || isRunning
  const isLocalQueued = rawVideoStatus === 'queued' && !hasServerJob && !hasInputProblems && boardVideoActiveStampFreshV150A(scene)
  const isBlocked = rawVideoStatus === 'blocked_missing_comfy_base_url' || videoStatus === 'blocked_missing_comfy_base_url'
  const isError = rawVideoStatus === 'error' || rawVideoStatus === 'failed' || videoStatus === 'error' || videoStatus === 'failed'
  const actionBusyLabelV132S = isSubmitting ? 'Отправляется' : 'Видео делается'

  return {
    className: `avaBoardWorkflowButton isVideo ${isActiveServerJob ? 'isBusy' : isLocalQueued ? 'isQueued' : isBlocked ? 'isBlocked' : isError ? 'isError' : ''}`.trim(),
    label: isLocalQueued ? 'В очереди' : isActiveServerJob ? actionBusyLabelV132S : 'Сделать видео',
    hint: isLocalQueued
      ? `ждёт очередь${scene?.video_queue_position ? ` · #${scene.video_queue_position}` : ''}`
      : isActiveServerJob
        ? (isSubmitting ? 'отправляем на backend…' : (hasServerJob ? 'job выполняется…' : 'ожидаем backend…'))
        : isBlocked
          ? 'нужен COMFY_BASE_URL'
          : isError
            ? (scene?.video_error || scene?.videoError || 'ошибка')
            : hasInputProblems
              ? `нужно: ${problems.join(', ')}`
              : hasVideo
                ? 'готово · можно заново'
                : (scene?.workflow_key || scene?.workflowKey || 'workflow будет выбран автоматически'),
    disabled: isActiveServerJob || isLocalQueued,
  }
}

  // AVA_BOARD_STALE_BATCH_UNBLOCK_V150A:
  // After backend reload the persisted Board snapshot may still contain queued/running
  // statuses from a server batch whose in-memory runner died. Those stale fields must
  // not block "Сгенерить все" forever. A scene is busy only when it has a real backend
  // job/status endpoint, or a very fresh submit/prep status from the current browser click.
  function boardVideoActiveStampFreshV150A(scene = {}) {
    const stamp = Date.parse(
      scene?.video_updated_at || scene?.videoUpdatedAt ||
      scene?.video_started_at || scene?.videoStartedAt ||
      scene?.updatedAt || scene?.updated_at || ''
    )
    if (!Number.isFinite(stamp) || stamp <= 0) return false
    return (Date.now() - stamp) < (90 * 1000) // V200A: no-job submit/start grace window
  }

  function boardSceneHasBackendVideoJobV150A(scene = {}) {
    return Boolean(asText(
      scene?.video_job_id || scene?.videoJobId ||
      scene?.video_status_endpoint || scene?.videoStatusEndpoint ||
      scene?.server_batch_job_id || scene?.serverBatchJobId || ''
    ))
  }

  function isBoardVideoActiveWorkerStatus(scene) {
    const status = String(scene?.video_status || scene?.videoStatus || '').toLowerCase()
    const hasBackendJob = boardSceneHasBackendVideoJobV150A(scene)
    if (status === 'queued') return hasBackendJob
    if (['running', 'processing', 'queued_no_prompt_id'].includes(status)) return hasBackendJob
    if (['starting', 'preparing', 'submitting'].includes(status)) return hasBackendJob || boardVideoActiveStampFreshV150A(scene)
    return false
  }


  // AVA_BOARD_MANUAL_QUEUE_STALE_LOCK_V200A:
  // Manual scene queue can get stuck when a scene remains "starting" but /clip/video/start
  // did not return a job_id. Such stale local locks must not block the next queued scene.
  function boardManualQueueStaleNoJobV200A(scene = {}) {
    const status = String(scene?.video_status || scene?.videoStatus || '').toLowerCase()
    if (!['starting', 'preparing', 'submitting', 'running', 'processing', 'queued_no_prompt_id'].includes(status)) return false
    if (boardSceneHasBackendVideoJobV150A(scene)) return false
    const stamp = Date.parse(
      scene?.video_started_at || scene?.videoStartedAt ||
      scene?.video_updated_at || scene?.videoUpdatedAt ||
      scene?.updatedAt || scene?.updated_at || ''
    )
    if (!Number.isFinite(stamp) || stamp <= 0) return true
    return (Date.now() - stamp) > (90 * 1000)
  }

  function boardClearStaleManualQueueLocksV200A(currentBoard = boardRef.current, reason = 'stale_manual_start_without_job_v200a') {
    const scenes = asSceneArray(currentBoard?.scenes)
    const staleIds = scenes
      .filter((scene) => boardManualQueueStaleNoJobV200A(scene))
      .map((scene) => asText(scene?.id || scene?.scene_id))
      .filter(Boolean)
    if (!staleIds.length) return false

    const staleSet = new Set(staleIds)
    localVideoQueueRef.current = (localVideoQueueRef.current || []).filter((id) => !staleSet.has(asText(id)))
    setBoard((current) => {
      let changed = false
      const nextScenes = asSceneArray(current?.scenes).map((scene) => {
        const id = asText(scene?.id || scene?.scene_id)
        if (!staleSet.has(id)) return scene
        const hasVideo = boardSceneHasCurrentVideoResultV129P(scene)
        changed = true
        return canonicalizeBoardSceneMediaRefs({
          ...scene,
          video_status: hasVideo ? 'ready' : 'error',
          videoStatus: hasVideo ? 'ready' : 'error',
          video_error: hasVideo ? '' : reason,
          videoError: hasVideo ? '' : reason,
          video_job_id: '',
          videoJobId: '',
          video_status_endpoint: '',
          videoStatusEndpoint: '',
          server_batch_job_id: '',
          serverBatchJobId: '',
          server_batch_status_endpoint: '',
          serverBatchStatusEndpoint: '',
          video_queue_position: 0,
          videoQueuePosition: 0,
          video_queue_source: '',
          videoQueueSource: '',
          video_batch_active_v132r: false,
          videoBatchActiveV132R: false,
          video_interrupted_reason: reason,
          videoInterruptedReason: reason,
          video_updated_at: new Date().toISOString(),
          videoUpdatedAt: new Date().toISOString(),
        })
      })
      if (!changed) return current
      const waitingIds = boardMergeWaitingSceneIdsV57B({ ...current, scenes: nextScenes }, localVideoQueueRef.current || [])
      return {
        ...current,
        scenes: nextScenes,
        video_queue: {
          ...(current.video_queue || {}),
          activeSceneId: '',
          activeJobId: '',
          activeStatusEndpoint: '',
          waitingSceneIds: waitingIds,
          waiting_scene_ids: waitingIds,
          source: reason,
          updatedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      }
    })
    setStatus(`Снята зависшая отправка: ${staleIds.join(', ')}`)
    console.warn('[BOARD MANUAL QUEUE STALE LOCK CLEAR V200A]', { staleIds, reason })
    return true
  }

  function activeBoardVideoScene(currentBoard) {
    // AVA_BOARD_MANUAL_QUEUE_STALE_LOCK_V200A:
    // Do not treat old "starting/submitting" without job_id as active forever.
    return asArray(currentBoard?.scenes).find((scene) => {
      if (boardManualQueueStaleNoJobV200A(scene)) return false
      if (isBoardVideoActiveWorkerStatus(scene)) return true
      const status = String(scene?.video_status || scene?.videoStatus || '').toLowerCase()
      const hasServerJob = boardSceneHasBackendVideoJobV150A(scene)
      if (status === 'queued' && hasServerJob) return true
      return false
    }) || null
  }



  // AVA_BOARD_QUEUE_HARD_SINGLE_ACTIVE_V61:
  // A runtime guard for the small gap between "we decided to start a queued scene"
  // and React/backend state showing a real active job. Without it, F5 restore + poll completion
  // can submit two Board videos at almost the same time.
  function boardVideoQueueStartInFlight() {
    const sceneId = asText(localVideoQueueStartLockRef.current)
    if (!sceneId) return ''
    const startedAt = Number(localVideoQueueStartLockAtRef.current || 0)
    if (startedAt && Date.now() - startedAt > 45000) {
      localVideoQueueStartLockRef.current = ''
      localVideoQueueStartLockAtRef.current = 0
      return ''
    }
    return sceneId
  }

  function boardBeginVideoQueueStart(sceneId) {
    const safeSceneId = asText(sceneId)
    if (!safeSceneId) return false
    const existing = boardVideoQueueStartInFlight()
    if (existing && existing !== safeSceneId) return false
    localVideoQueueStartLockRef.current = safeSceneId
    localVideoQueueStartLockAtRef.current = Date.now()
    return true
  }

  function boardReleaseVideoQueueStart(sceneId = '') {
    const safeSceneId = asText(sceneId)
    if (!safeSceneId || localVideoQueueStartLockRef.current === safeSceneId) {
      localVideoQueueStartLockRef.current = ''
      localVideoQueueStartLockAtRef.current = 0
    }
  }

  function boardHasActiveVideoOrStartLock(currentBoard = boardRef.current) {
    if (activeBoardVideoScene(currentBoard)) return true
    if (boardVideoQueueStartInFlight()) return true
    return Boolean(activeVideoPollsRef.current?.size)
  }

  // AVA_BOARD_QUEUE_RESTORE_NO_UPDATE_PATCH_V57B:
  // Persist/rebuild queue from scene statuses. Does not touch v56 regenerate fix.
  function boardQueuedWaitingSceneIdsV57B(boardData = {}) {
    return asSceneArray(boardData?.scenes)
      .filter((scene) => {
        const id = asText(scene?.id || scene?.scene_id)
        const status = String(scene?.video_status || scene?.videoStatus || '').toLowerCase()
        const hasJob = Boolean(scene?.video_job_id || scene?.videoJobId || scene?.video_status_endpoint || scene?.videoStatusEndpoint)
        return id && status === 'queued' && !hasJob
      })
      .map((scene, index) => ({
        id: asText(scene?.id || scene?.scene_id),
        position: Number(scene?.video_queue_position ?? scene?.videoQueuePosition ?? 0) || (index + 1),
        index,
      }))
      .sort((a, b) => (a.position - b.position) || (a.index - b.index))
      .map((item) => item.id)
  }

  function boardQueueSnapshotWaitingIdsV59(boardData = {}, runtimeIds = []) {
    const previousQueue = boardData?.video_queue || boardData?.videoQueue || {}
    const rawIds = [
      ...(Array.isArray(runtimeIds) ? runtimeIds : []),
      ...(Array.isArray(previousQueue.waitingSceneIds) ? previousQueue.waitingSceneIds : []),
      ...(Array.isArray(previousQueue.waiting_scene_ids) ? previousQueue.waiting_scene_ids : []),
      ...boardQueuedWaitingSceneIdsV57B(boardData),
    ]
    const scenes = asSceneArray(boardData?.scenes)
    const ordered = []

    for (const rawId of rawIds) {
      const safeId = asText(rawId)
      if (!safeId || ordered.includes(safeId)) continue

      const scene = scenes.find((item) => asText(item?.id || item?.scene_id) === safeId)
      if (!scene) continue

      const status = String(scene?.video_status || scene?.videoStatus || '').toLowerCase()
      const hasJob = Boolean(scene?.video_job_id || scene?.videoJobId || scene?.video_status_endpoint || scene?.videoStatusEndpoint)
      const hasVideoResult = Boolean(
        scene?.video_api_path || scene?.videoApiPath ||
        scene?.video_url || scene?.videoUrl ||
        scene?.video_name || scene?.videoName ||
        scene?.video_asset_id || scene?.videoAssetId
      )
      const isWorkerStatus = ['starting', 'preparing', 'submitting', 'running', 'queued_no_prompt_id'].includes(status)
      const isBadStatus = ['error', 'failed', 'blocked_missing_comfy_base_url', 'blocked_missing_audio_slice', 'blocked_missing_prompt'].includes(status)

      // Waiting queue means: scene exists, has no finished video, has no active server job,
      // and is not a known broken/blocked item. Empty status is allowed here because F5 cleanup
      // is exactly what can erase the visible queued badge before restore runs.
      if (hasJob || hasVideoResult || isWorkerStatus || isBadStatus) continue
      ordered.push(safeId)
    }

    return ordered
  }

  function boardMergeWaitingSceneIdsV57B(boardData = {}, runtimeIds = []) {
    // AVA_BOARD_QUEUE_F5_KEEP_PERSISTED_WAITING_IDS_V59:
    // Keep persisted board.video_queue.waitingSceneIds even if queued scene badges were erased by F5 cleanup.
    return boardQueueSnapshotWaitingIdsV59(boardData, runtimeIds)
  }

  function boardWithVideoQueueSnapshotV57B(boardData = {}, options = {}) {
    const previousQueue = boardData?.video_queue || boardData?.videoQueue || {}
    const activeScene = activeBoardVideoScene(boardData)
    const waitingSceneIds = boardMergeWaitingSceneIdsV57B(
      boardData,
      Array.isArray(options.waitingSceneIds) ? options.waitingSceneIds : (previousQueue.waitingSceneIds || previousQueue.waiting_scene_ids || localVideoQueueRef.current || [])
    )
    return {
      ...boardData,
      video_queue: {
        activeSceneId: asText(activeScene?.id || activeScene?.scene_id),
        activeJobId: asText(activeScene?.video_job_id || activeScene?.videoJobId),
        activeStatusEndpoint: asText(activeScene?.video_status_endpoint || activeScene?.videoStatusEndpoint),
        waitingSceneIds,
        updatedAt: new Date().toISOString(),
        source: options.reason || 'queue_restore_v57B',
      },
    }
  }


  function syncQueuedSceneBadges() {
    const queuedIds = [...localVideoQueueRef.current]
    setBoard((current) => {
      let changed = false
      const scenes = current.scenes.map((scene) => {
        if (!queuedIds.includes(scene.id)) return scene
        if (scene.video_job_id) return scene

        const nextPosition = queuedIds.indexOf(scene.id) + 1
        if (scene.video_status === 'queued' && scene.video_queue_position === nextPosition) return scene

        changed = true
        return {
          ...scene,
          video_status: 'queued',
          video_queue_position: nextPosition,
        }
      })

      if (!changed) return current

      return {
        ...current,
        scenes,
        updatedAt: new Date().toISOString(),
      }
    })
  }

  // AVA_BOARD_QUEUE_FINISH_STOP_V130H:
  // Keep the working video pipeline untouched, but make the frontend queue finish cleanly.
  // A completed scene is removed from the waiting queue, stale queued badges are cleaned,
  // and the next scene starts only after the ready patch has had time to land in Board state.
  function finishBoardVideoQueueStepV130H(sceneId = '', jobId = '', reason = 'completed') {
    const safeSceneId = asText(sceneId)
    const safeJobId = asText(jobId)
    if (safeSceneId) {
      localVideoQueueRef.current = (localVideoQueueRef.current || []).filter((id) => asText(id) !== safeSceneId)
    }

    window.setTimeout(() => {
      const currentBoard = boardRef.current || {}
      const waitingIds = boardMergeWaitingSceneIdsV57B(currentBoard, localVideoQueueRef.current || [])
        .filter((id) => asText(id) && asText(id) !== safeSceneId)
      localVideoQueueRef.current = waitingIds

      let nextBoardForSave = null
      setBoard((current) => {
        let changed = false
        const scenesNext = asSceneArray(current.scenes).map((scene) => {
          const id = asText(scene?.id || scene?.scene_id)
          const status = String(scene?.video_status || scene?.videoStatus || '').toLowerCase()
          const hasJob = Boolean(scene?.video_job_id || scene?.videoJobId || scene?.video_status_endpoint || scene?.videoStatusEndpoint)
          const hasReadyVideo = boardSceneHasVideoResultForAuto(scene)
          const isWaiting = waitingIds.includes(id)
          const waitingPosition = isWaiting ? waitingIds.indexOf(id) + 1 : 0

          if (id === safeSceneId && hasReadyVideo) {
            const patch = {
              ...scene,
              video_status: 'ready',
              videoStatus: 'ready',
              video_error: '',
              videoError: '',
              video_job_id: '',
              videoJobId: '',
              video_status_endpoint: '',
              videoStatusEndpoint: '',
              video_queue_position: 0,
              videoQueuePosition: 0,
              video_queue_source: '',
              videoQueueSource: '',
            }
            changed = true
            return canonicalizeBoardSceneMediaRefs(patch)
          }

          if (!isWaiting && status === 'queued' && !hasJob) {
            changed = true
            return {
              ...scene,
              video_status: hasReadyVideo ? 'ready' : '',
              videoStatus: hasReadyVideo ? 'ready' : '',
              video_error: '',
              videoError: '',
              video_queue_position: 0,
              videoQueuePosition: 0,
              video_queue_source: '',
              videoQueueSource: '',
            }
          }

          if (isWaiting && !hasJob) {
            if (status === 'queued' && Number(scene?.video_queue_position || scene?.videoQueuePosition || 0) === waitingPosition) return scene
            changed = true
            return {
              ...scene,
              video_status: 'queued',
              videoStatus: 'queued',
              video_queue_position: waitingPosition,
              videoQueuePosition: waitingPosition,
              video_queue_source: scene?.video_queue_source || scene?.videoQueueSource || 'queue_waiting_v130h',
              videoQueueSource: scene?.videoQueueSource || scene?.video_queue_source || 'queue_waiting_v130h',
            }
          }

          return scene
        })

        const queueChanged = JSON.stringify(current?.video_queue?.waitingSceneIds || []) !== JSON.stringify(waitingIds)
        if (!changed && !queueChanged) return current

        nextBoardForSave = {
          ...current,
          scenes: scenesNext,
          video_queue: {
            ...(current.video_queue || {}),
            waitingSceneIds: waitingIds,
            waiting_scene_ids: waitingIds,
            updatedAt: new Date().toISOString(),
            source: `queue_finish_${reason}_v130h`,
          },
          updatedAt: new Date().toISOString(),
        }
        return nextBoardForSave
      })

      window.setTimeout(() => {
        if (nextBoardForSave) saveBoard(nextBoardForSave, true)

        const afterBoard = nextBoardForSave || boardRef.current || {}
        const activeScene = activeBoardVideoScene(afterBoard)
        const activeSceneId = asText(activeScene?.id || activeScene?.scene_id)
        const activeJobId = asText(activeScene?.video_job_id || activeScene?.videoJobId || '')
        const activeIsJustFinished = safeSceneId && activeSceneId === safeSceneId && (!safeJobId || activeJobId === safeJobId)
        const hasActive = Boolean(activeScene && !activeIsJustFinished) || Boolean(boardVideoQueueStartInFlight()) || Boolean(activeVideoPollsRef.current?.size)

        setAutoVideoQueueState((current) => {
          if (waitingIds.length || hasActive) {
            return {
              ...current,
              active: true,
              queued: waitingIds.length,
            }
          }
          return {
            ...current,
            active: false,
            total: 0,
            queued: 0,
          }
        })

        if (waitingIds.length) {
          window.setTimeout(processNextQueuedBoardVideo, 350)
        } else if (!hasActive) {
          setStatus('Очередь видео завершена')
          console.log('[BOARD VIDEO QUEUE FINISHED V130H]', { sceneId: safeSceneId, jobId: safeJobId, reason })
        }
      }, 0)
    }, 900)
  }


  function boardServerBatchIsActiveV131M(boardData = null) {
    // AVA_BOARD_SERVER_BATCH_BLOCK_LEGACY_FRONTEND_V131M:
    // While backend owns "Сгенерировать все", the browser must not run the old local queue,
    // direct /clip/video/start, or old status pollers. Otherwise Comfy gets duplicate prompts.
    const source = boardData || boardRef.current || board || {}
    const batch = source.video_batch || source.videoBatch || source.board_video_batch || source.boardVideoBatch || {}
    const status = String(batch.status || batch.batch_status || batch.video_status || '').toLowerCase()
    const windowFlag = typeof window !== 'undefined' && Boolean(window.__AVA_BOARD_SERVER_VIDEO_BATCH_ACTIVE__)
    return windowFlag || ['queued', 'running', 'starting', 'preparing', 'submitting'].includes(status)
  }

  function processNextQueuedBoardVideo() {
    // AVA_BOARD_SERVER_BATCH_BLOCK_LEGACY_FRONTEND_V131M: do not let old local queue start /clip/video/start while server batch is active.
    if (boardServerBatchIsActiveV131M()) {
      console.log('[BOARD SERVER BATCH FRONTEND GUARD V131M] block processNextQueuedBoardVideo')
      return
    }

    const currentBoard = boardRef.current
    boardClearStaleManualQueueLocksV200A(currentBoard)

    // AVA_BOARD_QUEUE_HARD_SINGLE_ACTIVE_V61:
    // Only one Board video may be submitted at a time. The check includes:
    // - active scene status/job in Board state
    // - POST/start lock before React state catches up
    // - active status polling already running in the browser
    if (boardHasActiveVideoOrStartLock(currentBoard)) return

    // Runtime queue is lost after F5; rebuild it from persisted board.video_queue + visible queued badges.
    if (!localVideoQueueRef.current.length) {
      localVideoQueueRef.current = boardMergeWaitingSceneIdsV57B(currentBoard, [])
    } else {
      localVideoQueueRef.current = boardMergeWaitingSceneIdsV57B(currentBoard, localVideoQueueRef.current)
    }

    while (localVideoQueueRef.current.length) {
      if (boardHasActiveVideoOrStartLock(boardRef.current)) return

      const nextId = localVideoQueueRef.current.shift()
      const scene = asSceneArray(boardRef.current?.scenes || currentBoard?.scenes).find((item) => item.id === nextId || item.scene_id === nextId)
      if (!scene) continue

      const inputProblems = sceneVideoInputProblems(scene)
      if (inputProblems.length) {
        showSceneVideoInputError(scene, inputProblems)
        continue
      }

      if (!boardBeginVideoQueueStart(nextId)) return
      syncQueuedSceneBadges()
      setBoard((current) => ({ ...current, selectedSceneId: nextId }))
      setStatus(`Запускаем из очереди: ${nextId}`)
      window.setTimeout(() => {
        Promise.resolve(markVideoPlanned(scene)).finally(() => {
          // Give updateSceneAndSave/poll start time to put the scene into starting/queued/running state.
          window.setTimeout(() => {
            boardReleaseVideoQueueStart(nextId)
            if (!boardHasActiveVideoOrStartLock(boardRef.current)) {
              window.setTimeout(processNextQueuedBoardVideo, 350)
            }
          }, 1600)
        })
      }, 120)
      return
    }
  }

  function requestSceneVideoQueue() {
    // AVA_BOARD_SERVER_BATCH_BLOCK_LEGACY_FRONTEND_V131M: manual scene start is blocked while backend server batch is active.
    if (boardServerBatchIsActiveV131M()) {
      setStatus('Серверная очередь активна: локальный запуск сцены заблокирован.')
      console.log('[BOARD SERVER BATCH FRONTEND GUARD V131M] block requestSceneVideoQueue')
      return
    }

    if (!selectedScene) return

    const selectedStatus = String(selectedScene.video_status || '').toLowerCase()
    const selectedHasServerJob = Boolean(selectedScene.video_job_id || selectedScene.video_status_endpoint)
    const selectedIsLocalQueued = (selectedStatus === 'queued' && !selectedHasServerJob) || localVideoQueueRef.current.includes(selectedScene.id)
    const selectedIsBusy = isBoardVideoActiveWorkerStatus(selectedScene) || (selectedStatus === 'queued' && selectedHasServerJob) // V200A stale no-job status does not block manual queue

    const selectedForceBadRegenV156A = boardBadReviewForceRegenerateAllowedV156A(selectedScene)
    if ((selectedIsBusy || selectedIsLocalQueued) && !selectedForceBadRegenV156A) {
      setStatus(selectedIsLocalQueued ? `Сцена ${selectedScene.id} уже в очереди` : `Сцена ${selectedScene.id} уже генерируется`)
      return
    }

    localVideoQueueRef.current = localVideoQueueRef.current.filter((sceneId) => sceneId !== selectedScene.id)
    if (selectedForceBadRegenV156A) clearBadRegenRuntimeStatusesV136I([selectedScene.id])

    const inputProblems = sceneVideoInputProblems(selectedScene)
    if (inputProblems.length) {
      showSceneVideoInputError(selectedScene, inputProblems)
      return
    }

    const currentBoard = boardRef.current
    const activeScene = activeBoardVideoScene(currentBoard)
    const sceneId = selectedScene.id
    const inFlightSceneId = boardVideoQueueStartInFlight()
    const shouldQueueBehindActive = Boolean(
      (activeScene && activeScene.id !== sceneId) ||
      (inFlightSceneId && inFlightSceneId !== sceneId) ||
      activeVideoPollsRef.current?.size
    )

    if (shouldQueueBehindActive) {
      if (!localVideoQueueRef.current.includes(sceneId)) {
        localVideoQueueRef.current.push(sceneId)
        syncQueuedSceneBadges()
      }
      const queuedPosition = localVideoQueueRef.current.indexOf(sceneId) + 1
      updateSceneAndSave(sceneId, boardVideoQueuedRegenerateResetPatch(queuedPosition, 'video_queued_for_regenerate'))
      setStatus(`Сцена ${sceneId} поставлена в очередь`)
      pushBoardToast({ type: 'info', title: 'Сцена в очереди', message: `Сцена ${sceneId} ждёт генерацию`, sceneId })
      return
    }

    if (!boardBeginVideoQueueStart(sceneId)) {
      if (!localVideoQueueRef.current.includes(sceneId)) {
        localVideoQueueRef.current.push(sceneId)
        syncQueuedSceneBadges()
      }
      const queuedPosition = localVideoQueueRef.current.indexOf(sceneId) + 1
      updateSceneAndSave(sceneId, boardVideoQueuedRegenerateResetPatch(queuedPosition, 'video_queued_for_regenerate'))
      setStatus(`Сцена ${sceneId} поставлена в очередь`)
      return
    }

    Promise.resolve(markVideoPlanned(selectedScene)).finally(() => {
      window.setTimeout(() => {
        boardReleaseVideoQueueStart(sceneId)
        if (!boardHasActiveVideoOrStartLock(boardRef.current)) {
          window.setTimeout(processNextQueuedBoardVideo, 350)
        }
      }, 1600)
    })
  }


  // AVA_BOARD_FRONTEND_AUTO_MANUAL_RUNNER_V110:
  // Auto queue is frontend-only and reuses the same manual scene queue used by
  // "Сделать видео". It must not create a second backend queue system.

  function boardSceneHasVideoResultForAuto(scene) {
    if (!scene) return false
    return boardSceneHasCurrentVideoResultV129P(scene)
  }




  // AVA_BOARD_SERVER_BATCH_AUTOSLICE_V147A:
  // "Сгенерировать все" is backend-owned. IA2V/lip-sync scenes should not be
  // rejected just because the per-scene audio slice is not cut yet. If Board has
  // the original Timing audio asset and the scene has start/end, backend will cut
  // the MP3 slice right before queueing the scene.
  function boardCanServerAutoSliceAudioForSceneV147A(scene = {}) {
    if (!isIa2vRoute(scene?.route)) return false
    if (manualLipSyncAudioSourceV129A(scene)) return true
    const sourcePayload = boardAudioSourcePayloadForBackend()
    const hasSourceAudio = Boolean(
      sourcePayload.audio_url ||
      sourcePayload.audio_asset_id ||
      sourcePayload.audio_asset_api_path ||
      sourcePayload.project_id ||
      sourcePayload.projectId
    )
    const start = toNumber(scene?.start_sec ?? scene?.start ?? scene?.scene_start_sec ?? scene?.sceneStartSec, 0)
    const end = toNumber(scene?.end_sec ?? scene?.end ?? scene?.scene_end_sec ?? scene?.sceneEndSec, start)
    // AVA_BOARD_SERVER_BATCH_AUTOSLICE_PROJECT_FALLBACK_V201A:
    // Server batch endpoint has project_id in the URL and can find the master/mixed
    // audio from project assets even when the browser Board state no longer has a
    // root audio object. Do not block the whole batch in UI with "нет audio slice".
    return hasSourceAudio && end > start
  }

  function boardSceneAutoVideoProblems(scene) {
    let problems = [...sceneVideoInputProblems(scene)]
    if (boardCanServerAutoSliceAudioForSceneV147A(scene)) {
      problems = problems.filter((problem) => !/audio\s*slice|audio[_\s-]*slice|лип-?sync/i.test(String(problem || '')))
    }
    const promptText = asText(scene?.video_prompt || scene?.videoPrompt || '')
    if (!promptText) problems.push('нет video prompt')
    return [...new Set(problems.filter(Boolean))]
  }


  // AVA_BOARD_AUTO_GENERATE_CONFIRM_MODAL_V111:
  // Preflight plan before starting auto generation.

  // AVA_BOARD_BAD_REGEN_QUEUE_FIX_V158A: local compatibility helper kept for old V156 call sites.
  function boardBadReviewForceRegenerateAllowedV156A(scene = {}) {
    // AVA_BOARD_BAD_REGEN_FORCE_START_V159A: keep old V156 call sites alive,
    // but never let old job/status fields block a red bad-review regeneration.
    return boardBadReviewForceRegenerateAllowedV157A(scene)
  }

  function makeAllScenesVideoQueuePlan() {
    const currentBoard = boardRef.current || board
    const scenes = asSceneArray(currentBoard?.scenes)
    const queuedIds = new Set(localVideoQueueRef.current || [])
    const ready = []
    const regenerate = []
    const valid = []
    const busy = []
    const invalid = []
    const alreadyQueued = []

    scenes.forEach((scene) => {
      const sceneId = asText(scene?.id || scene?.scene_id)
      if (!sceneId) return

      const markedBadForReview = boardSceneHasBadVideoReview(scene)
      const forceBadRegenerateV157A = boardBadReviewForceRegenerateAllowedV157A(scene)

      if (boardSceneHasVideoResultForAuto(scene) && !markedBadForReview && !forceBadRegenerateV157A) {
        ready.push({ sceneId, route: scene?.route || '', label: scene?.title || scene?.label || '' })
        return
      }

      if (isBoardVideoActiveWorkerStatus(scene) && !markedBadForReview && !forceBadRegenerateV157A) {
        busy.push({ sceneId, route: scene?.route || '', status: scene?.video_status || scene?.videoStatus || '' })
        return
      }

      if (queuedIds.has(sceneId) && !forceBadRegenerateV157A) {
        alreadyQueued.push({ sceneId, route: scene?.route || '' })
        return
      }

      const problems = boardSceneAutoVideoProblems(scene)
      if (problems.length) {
        invalid.push({ sceneId, route: scene?.route || '', problems })
        return
      }

      if (markedBadForReview) {
        regenerate.push({ sceneId, route: scene?.route || '', label: scene?.title || scene?.label || '', force: forceBadRegenerateV157A })
      }
      valid.push({ sceneId, route: scene?.route || '', regenerate: markedBadForReview, forceBadRegenerate: forceBadRegenerateV157A })
    })

    return {
      total: scenes.length,
      valid,
      ready,
      regenerate,
      busy,
      alreadyQueued,
      invalid,
      validCount: valid.length,
      readyCount: ready.length,
      regenerateCount: regenerate.length,
      busyCount: busy.length,
      alreadyQueuedCount: alreadyQueued.length,
      invalidCount: invalid.length,
      createdAt: new Date().toISOString(),
    }
  }

  function openAllScenesVideoQueueConfirm(event = null) {
    event?.preventDefault?.()
    event?.stopPropagation?.()

    // AVA_BOARD_WORKSPACE_SERVER_QUEUE_GUARD_V193B:
    // "Сгенерировать все" is server-owned and only works in a Project Board.
    // In workspace/import preview mode it must not open the confirm modal or mutate queue UI.
    if (workspaceMode || !projectId) {
      setStatus('Серверная очередь доступна только внутри проекта.')
      pushBoardToast({
        type: 'warning',
        title: 'Серверная очередь',
        message: 'Открой проект, чтобы backend мог сам вести очередь генерации.',
        dedupeKey: 'board:server_batch:no_project_v193b',
      })
      return
    }

    const plan = makeAllScenesVideoQueuePlan()
    setAutoVideoQueueConfirm({ open: true, plan })

    if (!plan.validCount) {
      setStatus(`Проверка автоочереди: новых сцен нет. Готово: ${plan.readyCount}, не хватает данных: ${plan.invalidCount}.`)
    } else {
      setStatus(`Проверка автоочереди: к запуску ${plan.validCount}, готово ${plan.readyCount}, не хватает данных ${plan.invalidCount}.`)
    }
  }

  function closeAllScenesVideoQueueConfirm() {
    setAutoVideoQueueConfirm({ open: false, plan: null })
  }

  function confirmAllScenesVideoQueueStart(event = null) {
    event?.preventDefault?.()
    event?.stopPropagation?.()

    const plan = autoVideoQueueConfirm.plan || makeAllScenesVideoQueuePlan()
    if (!plan.validCount) {
      setStatus('Автоочередь не запущена: нет подходящих сцен.')
      setAutoVideoQueueConfirm({ open: false, plan: null })
      return
    }

    setAutoVideoQueueConfirm({ open: false, plan: null })
    window.setTimeout(() => requestAllScenesVideoQueue(), 0)
  }

  async function requestAllScenesVideoQueue(event = null) {
    // AVA_BOARD_SERVER_BATCH_ENSURE_IMAGE_ASSETS_V131C:
    // Server-owned batch cannot use browser-only previews. Before calling the backend batch
    // endpoint, make sure every visible start image has a durable /assets/.../file reference.
    event?.preventDefault?.()
    event?.stopPropagation?.()

    const currentBoard = boardRef.current || board
    let scenes = asSceneArray(currentBoard?.scenes)

    // AVA_BOARD_SERVER_BATCH_IDENTITY_FALLBACK_V131D:
    // Some local BoardPage versions do not have boardSceneIdentityV127K.
    // Server batch needs only a stable scene id, so use direct scene fields.
    const serverBatchSceneIdV131D = (scene = {}) => String(
      scene?.id ||
      scene?.scene_id ||
      scene?.sceneId ||
      scene?.seg_id ||
      scene?.segment_id ||
      ''
    ).trim()

    if (!scenes.length) {
      setStatus('Нет сцен для серверной очереди.')
      return
    }

    if (workspaceMode || !projectId) {
      setStatus('Серверная очередь доступна только внутри проекта.')
      pushBoardToast({
        type: 'warning',
        title: 'Серверная очередь',
        message: 'Открой проект, чтобы backend мог сам вести очередь генерации.',
        dedupeKey: 'board:server_batch:no_project',
      })
      return
    }

    // AVA_BOARD_WORKSPACE_SERVER_QUEUE_GUARD_V193B:
    // Only after projectId is confirmed, mark the server queue as active.
    if (typeof window !== 'undefined') window.__AVA_BOARD_SERVER_VIDEO_BATCH_ACTIVE__ = true
    localVideoQueueRef.current = []

    async function ensureSceneStartAsset(scene = {}) {
      const sceneId = serverBatchSceneIdV131D(scene)
      if (!sceneId) return scene

      const existingApiPath = (
        sceneMediaFieldValue(scene, 'image', 'apiPath') ||
        sceneMediaFieldValue(scene, 'first', 'apiPath') ||
        scene?.image_api_path ||
        scene?.imageApiPath ||
        scene?.first_image_api_path ||
        scene?.firstImageApiPath ||
        scene?.first_frame_api_path ||
        scene?.firstFrameApiPath ||
        scene?.start_image_api_path ||
        scene?.startImageApiPath ||
        ''
      )

      if (existingApiPath && !String(existingApiPath).startsWith('blob:') && !String(existingApiPath).startsWith('data:')) {
        return scene
      }

      const runtimeMedia = runtimeSceneMediaUrls?.[sceneId] || {}
      const previewRef = asText(
        runtimeMedia.image ||
        runtimeMedia.first ||
        sceneMediaFieldValue(scene, 'image', 'url') ||
        sceneMediaFieldValue(scene, 'first', 'url') ||
        scene?.image_data_url ||
        scene?.imageDataUrl ||
        scene?.start_image_data_url ||
        scene?.startImageDataUrl ||
        scene?.first_image_data_url ||
        scene?.firstImageDataUrl ||
        scene?.first_frame_data_url ||
        scene?.firstFrameDataUrl ||
        ''
      )

      const existingAssetId = asText(
        scene?.image_asset_id ||
        scene?.imageAssetId ||
        scene?.first_image_asset_id ||
        scene?.firstImageAssetId ||
        scene?.first_frame_asset_id ||
        scene?.firstFrameAssetId ||
        scene?.start_image_asset_id ||
        scene?.startImageAssetId ||
        ''
      )
      if (existingAssetId) {
        const assetApiPath = boardCanonicalAssetApiPath(existingAssetId)
        return {
          ...scene,
          image_asset_id: existingAssetId,
          imageAssetId: existingAssetId,
          image_api_path: assetApiPath,
          imageApiPath: assetApiPath,
          image_url: assetApiPath,
          imageUrl: assetApiPath,
          first_image_asset_id: existingAssetId,
          firstImageAssetId: existingAssetId,
          first_image_api_path: assetApiPath,
          firstImageApiPath: assetApiPath,
          first_frame_api_path: assetApiPath,
          firstFrameApiPath: assetApiPath,
          first_frame_url: assetApiPath,
          firstFrameUrl: assetApiPath,
          start_image_asset_id: existingAssetId,
          startImageAssetId: existingAssetId,
          start_image_api_path: assetApiPath,
          startImageApiPath: assetApiPath,
          start_image_url: assetApiPath,
          startImageUrl: assetApiPath,
          image_status: 'ready',
          imageStatus: 'ready',
        }
      }

      if (!previewRef) return scene

      let uploaded = null
      const fileName = asText(scene?.image_name || scene?.imageName || scene?.first_frame_name || scene?.firstFrameName || scene?.start_image_name || scene?.startImageName || `${sceneId}.png`)

      if (previewRef.startsWith('/assets/') || previewRef.startsWith('/api/assets/') || previewRef.includes('/assets/')) {
        const assetId = boardAssetIdFromRef(previewRef)
        if (assetId) {
          const assetApiPath = boardCanonicalAssetApiPath(assetId)
          return {
            ...scene,
            image_asset_id: assetId,
            imageAssetId: assetId,
            image_api_path: assetApiPath,
            imageApiPath: assetApiPath,
            image_url: assetApiPath,
            imageUrl: assetApiPath,
            first_image_asset_id: assetId,
            firstImageAssetId: assetId,
            first_image_api_path: assetApiPath,
            firstImageApiPath: assetApiPath,
            first_frame_api_path: assetApiPath,
            firstFrameApiPath: assetApiPath,
            first_frame_url: assetApiPath,
            firstFrameUrl: assetApiPath,
            start_image_asset_id: assetId,
            startImageAssetId: assetId,
            start_image_api_path: assetApiPath,
            startImageApiPath: assetApiPath,
            start_image_url: assetApiPath,
            startImageUrl: assetApiPath,
            image_status: 'ready',
            imageStatus: 'ready',
          }
        }
      }

      if (previewRef.startsWith('data:') || previewRef.startsWith('blob:')) {
        const response = await fetch(previewRef)
        const blob = await response.blob()
        const file = new File([blob], fileName, { type: blob.type || 'image/png' })
        uploaded = await uploadMediaAsset({
          file,
          projectId: workspaceMode ? null : projectId,
          kind: 'image',
          stage: 'board_images',
        })
      } else {
        const staticUrl = boardStaticMediaUrl(previewRef)
        if (staticUrl) {
          uploaded = await registerStaticMediaAsset({
            url: staticUrl,
            projectId: workspaceMode ? null : projectId,
            kind: 'image',
            stage: 'board_images',
            originalName: fileName,
            sceneId,
          })
        }
      }

      const assetId = uploaded?.asset_id || uploaded?.assetId || ''
      const assetApiPath = uploaded?.asset_api_path || uploaded?.assetApiPath || (assetId ? boardCanonicalAssetApiPath(assetId) : '')
      if (!assetId || !assetApiPath) return scene

      return {
        ...scene,
        image_asset_id: assetId,
        imageAssetId: assetId,
        image_api_path: assetApiPath,
        imageApiPath: assetApiPath,
        image_url: assetApiPath,
        imageUrl: assetApiPath,
        first_image_asset_id: assetId,
        firstImageAssetId: assetId,
        first_image_api_path: assetApiPath,
        firstImageApiPath: assetApiPath,
        first_frame_asset_id: assetId,
        firstFrameAssetId: assetId,
        first_frame_api_path: assetApiPath,
        firstFrameApiPath: assetApiPath,
        first_frame_url: assetApiPath,
        firstFrameUrl: assetApiPath,
        start_image_asset_id: assetId,
        startImageAssetId: assetId,
        start_image_api_path: assetApiPath,
        startImageApiPath: assetApiPath,
        start_image_url: assetApiPath,
        startImageUrl: assetApiPath,
        image_status: 'ready',
        imageStatus: 'ready',
        image_name: fileName,
        imageName: fileName,
        first_frame_name: fileName,
        firstFrameName: fileName,
        start_image_name: fileName,
        startImageName: fileName,
        server_batch_image_asset_ready_v131c: true,
      }
    }

    try {
      setStatus('Серверная очередь: проверяю, что кадры сохранены в assets...')
      const ensuredScenes = []
      let changedImages = false
      for (const scene of scenes) {
        const ensured = await ensureSceneStartAsset(scene)
        ensuredScenes.push(ensured)
        if (JSON.stringify(ensured) !== JSON.stringify(scene)) changedImages = true
      }

      if (changedImages) {
        const ensuredById = new Map(ensuredScenes.map((scene) => [serverBatchSceneIdV131D(scene), scene]))
        const nextBoard = {
          ...currentBoard,
          scenes: scenes.map((scene) => ensuredById.get(serverBatchSceneIdV131D(scene)) || scene),
          updatedAt: new Date().toISOString(),
        }
        scenes = asSceneArray(nextBoard.scenes)
        boardRef.current = nextBoard
        setBoard(nextBoard)
        await saveBoard(nextBoard, true)
      } else {
        scenes = ensuredScenes
      }
    } catch (error) {
      console.warn('[BOARD SERVER BATCH] ensure image assets failed', error)
      setStatus(`Не удалось подготовить кадры для сервера: ${error?.message || error}`)
      pushBoardToast({
        type: 'error',
        title: 'Кадры не подготовлены',
        message: error?.message || String(error),
        dedupeKey: `board:server_batch:ensure_images:${Date.now()}`,
      })
      return
    }

    const addedIds = []
    const skippedReadyIds = []
    const skippedBusyIds = []
    const invalidItems = []

    scenes.forEach((scene) => {
      const sceneId = serverBatchSceneIdV131D(scene)
      if (!sceneId) return

      const markedBadForReviewV132A = boardSceneHasBadVideoReview(scene)
      const forceBadRegenerateV157A = boardBadReviewForceRegenerateAllowedV157A(scene)
      const forceBadRegenV156A = boardBadReviewForceRegenerateAllowedV156A(scene)
      // AVA_BOARD_BAD_REVIEW_SERVER_BATCH_QUEUE_V132A:
      // Ready videos normally skip server batch, but a red "плохое" review mark means
      // this scene is intentionally selected for regeneration.
      if (boardSceneHasVideoResultForAuto(scene) && !markedBadForReviewV132A && !forceBadRegenerateV157A) {
        skippedReadyIds.push(sceneId)
        return
      }

      if (isBoardVideoActiveWorkerStatus(scene) && !(forceBadRegenerateV157A || forceBadRegenV156A)) {
        skippedBusyIds.push(sceneId)
        return
      }

      const problems = boardSceneAutoVideoProblems(scene)
      if (problems.length) {
        invalidItems.push({ sceneId, problems })
        return
      }

      addedIds.push(sceneId)
    })

    const invalidText = invalidItems.length
      ? ` · пропущено без данных: ${invalidItems.length} (${invalidItems.slice(0, 4).map((item) => `${item.sceneId}: ${item.problems.join('/')}`).join('; ')}${invalidItems.length > 4 ? '…' : ''})`
      : ''

    if (!addedIds.length) {
      console.warn('[BOARD BAD REGEN QUEUE NO POST V158A]', {
        skippedReadyIds,
        skippedBusyIds,
        invalidItems,
        badSceneIds: scenes.filter((scene) => boardBadReviewForceRegenerateAllowedV157A(scene)).map((scene) => serverBatchSceneIdV131D(scene)),
        plan: makeAllScenesVideoQueuePlan(),
      })
      console.warn('[BOARD SERVER BATCH NO SCENES V150A]', {
        skippedReadyIds,
        skippedBusyIds,
        invalidItems,
        staleHint: 'If busy > 0 but backend status is idle/orphaned, stale queued/running state was blocking the start.'
      })
      setStatus(`Серверная очередь: новых сцен нет. Готово: ${skippedReadyIds.length}, занято: ${skippedBusyIds.length}, без данных: ${invalidItems.length}`)
      pushBoardToast({
        type: invalidItems.length ? 'warning' : 'info',
        title: 'Серверная очередь',
        message: `Новых сцен для запуска нет. Готово: ${skippedReadyIds.length}, занято: ${skippedBusyIds.length}, без данных: ${invalidItems.length}`,
        dedupeKey: 'board:server_batch:none',
      })
      return
    }

    // AVA_BOARD_SERVER_BATCH_NO_LEGACY_FRONT_QUEUE_V131I: server owns the batch; keep old browser queue stopped.
    autoVideoQueueStopRef.current = true
    localVideoQueueRef.current = []
    setAutoVideoQueueState({
      active: false,
      serverBatchActive: true,
      total: addedIds.length,
      queued: addedIds.length,
      skippedReady: skippedReadyIds.length,
      invalid: invalidItems.length,
    })

    setStatus(`Серверная очередь: отправляю ${addedIds.length} сцен на backend...${invalidText}`)

    // AVA_BOARD_BAD_REGEN_RUNTIME_STATUS_V136I:
    // Do not write submitting/queued/running into scene snapshot here. The backend gets clean
    // scene data, while Board cards/preview get an immediate runtime-only overlay.
    const serverBatchStartedAtV136I = new Date().toISOString()
    const scenesByIdV136I = new Map(scenes.map((scene) => [serverBatchSceneIdV131D(scene), scene]))

    // AVA_BOARD_BAD_REGEN_FORCE_START_V156A: For red bad scenes, clear stale persisted busy/job fields only in
    // the payload sent to backend. The visible Board keeps the old preview through
    // runtime overlay until the new result arrives.
    const addedIdSetV156A = new Set(addedIds)
    const batchPayloadScenesV156A = scenes.map((scene) => {
      const sceneId = serverBatchSceneIdV131D(scene)
      const forceBadRegen = addedIdSetV156A.has(sceneId) && (boardBadReviewForceRegenerateAllowedV156A(scene) || boardBadReviewForceRegenerateAllowedV157A(scene))
      if (!forceBadRegen) return scene
      return {
        ...scene,
        video_status: '',
        videoStatus: '',
        video_error: '',
        videoError: '',
        video_job_id: '',
        videoJobId: '',
        video_status_endpoint: '',
        videoStatusEndpoint: '',
        status_endpoint: '',
        statusEndpoint: '',
        job_id: '',
        jobId: '',
        video_queue_position: 0,
        videoQueuePosition: 0,
        video_queue_source: 'bad_review_regeneration_force_start_v156a',
        videoQueueSource: 'bad_review_regeneration_force_start_v156a',
        video_review_regenerate_from_bad: true,
        videoReviewRegenerateFromBad: true,
        video_review_regenerate_reason: 'force_start_bad_review_v156a',
        videoReviewRegenerateReason: 'force_start_bad_review_v156a',
      }
    })

    patchBadRegenRuntimeStatusesV136I(addedIds.map((sceneId, index) => {
      const sourceScene = scenesByIdV136I.get(sceneId) || {}
      return {
        sceneId,
        status: 'submitting',
        queuePosition: index + 1,
        fromBad: boardSceneHasBadVideoReview(sourceScene),
        startedAt: serverBatchStartedAtV136I,
        source: 'server_batch_submitting_runtime_v136i',
      }
    }))

    const serverBatchAudioSourceV147A = boardAudioSourcePayloadForBackend()

    apiRequest(`/projects/${projectId}/board/video-batch/start`, {
      method: 'POST',
      body: JSON.stringify({
        mode: 'overwrite',
        overwrite: true,
        source: 'board_page_server_batch_v131e_autoslice_v147a',
        sceneIds: addedIds,
        scene_ids: addedIds,
        audio: currentBoard?.audio || board?.audio || null,
        board_audio: currentBoard?.audio || board?.audio || null,
        ...serverBatchAudioSourceV147A,
        scenes: batchPayloadScenesV156A,
      }),
    }).then((result) => {
      if (!result || result.ok === false) {
        const invalid = Array.isArray(result?.invalid) ? result.invalid : []
        const invalidText = invalid.length
          ? ` · ${invalid.slice(0, 3).map((item) => `${item.sceneId || item.scene_id}: ${(item.problems || []).join('/')}`).join('; ')}`
          : ''
        throw new Error(result?.detail || result?.status || `server_batch_start_rejected${invalidText}`)
      }
      // AVA_BOARD_BATCH_START_RESULT_GUARD_V152A:
      // /board/video-batch/start returns HTTP 200 even when backend could not queue
      // anything (for example autoslice failed because master audio asset is 404).
      // Do not convert that response into fake running/queued runtime badges.
      const batchStartOkV152A = result?.ok === true && Boolean(result?.batchId || result?.batch_id)
      if (!batchStartOkV152A) {
        clearBadRegenRuntimeStatusesV136I(addedIds)
        if (typeof window !== 'undefined') window.__AVA_BOARD_SERVER_VIDEO_BATCH_ACTIVE__ = false

        const nextBoardV152A = result?.board || result?.snapshot?.data || null
        if (nextBoardV152A && Array.isArray(nextBoardV152A.scenes)) {
          boardRef.current = nextBoardV152A
          setBoard(nextBoardV152A)
          reconcileBadRegenRuntimeWithBoardV136I(nextBoardV152A, { sceneIds: addedIds })
        }

        const autoFailedV152A = Array.isArray(result?.autoAudioSliceFailed)
          ? result.autoAudioSliceFailed
          : (Array.isArray(result?.auto_audio_slice_failed) ? result.auto_audio_slice_failed : [])
        const invalidV152A = Array.isArray(result?.invalid) ? result.invalid : []
        const failedAudioTextV152A = autoFailedV152A.length
          ? autoFailedV152A.slice(0, 3).map((item) => `${item?.sceneId || item?.scene_id || 'scene'}: ${item?.error || 'audio slice failed'}`).join('; ')
          : ''
        const invalidTextV152A = invalidV152A.length
          ? invalidV152A.slice(0, 3).map((item) => `${item?.sceneId || item?.scene_id || 'scene'}: ${(item?.problems || []).join('/')}`).join('; ')
          : ''
        const reasonV152A = failedAudioTextV152A
          ? `audio slice не создан: ${failedAudioTextV152A}`
          : (invalidTextV152A ? `не хватает данных: ${invalidTextV152A}` : (result?.status || 'backend ничего не поставил в очередь'))

        setAutoVideoQueueState({
          active: false,
          serverBatchActive: false,
          total: 0,
          queued: 0,
          skippedReady: skippedReadyIds.length,
          invalid: invalidV152A.length || invalidItems.length || autoFailedV152A.length,
        })
        setStatus(`Серверная очередь не запущена: ${reasonV152A}`)
        pushBoardToast({
          type: 'warning',
          title: 'Серверная очередь не запущена',
          message: reasonV152A,
          dedupeKey: `board:server_batch:not_started_v152a:${Date.now()}`,
        })
        console.warn('[BOARD SERVER BATCH NOT STARTED V152A]', { result, addedIds, autoFailedV152A, invalidV152A })
        return
      }

      // AVA_BOARD_BAD_REGEN_RUNTIME_STATUS_V136I:
      // Backend accepted the batch. Keep accepted queue order runtime-only; do not patch
      // Board scenes with queued/running fields and do not save this state to snapshot.
      const batchAcceptedAtV136I = new Date().toISOString()
      const batchIdV136I = result?.batchId || result?.batch_id || ''
      patchBadRegenRuntimeStatusesV136I(addedIds.map((sceneId, index) => {
        const sourceScene = scenesByIdV136I.get(sceneId) || {}
        return {
          sceneId,
          status: index === 0 ? 'running' : 'queued',
          queuePosition: index + 1,
          batchId: batchIdV136I,
          fromBad: boardSceneHasBadVideoReview(sourceScene),
          startedAt: serverBatchStartedAtV136I,
          updatedAt: batchAcceptedAtV136I,
          source: 'server_batch_accepted_runtime_v136i',
        }
      }))

      // AVA_BOARD_BATCH_ACCEPTED_MARKER_V200M:
      // Start the live batch poller immediately from local accepted state. Some start
      // responses do not round-trip the freshly saved board_video_batch back to the
      // browser quickly enough, while runtime statuses are intentionally not persisted.
      const acceptedBatchMarkerV200M = {
        status: 'running',
        batch_id: batchIdV136I,
        batchId: batchIdV136I,
        active_scene_id: addedIds[0] || '',
        activeSceneId: addedIds[0] || '',
        waiting_scene_ids: addedIds.slice(1),
        waitingSceneIds: addedIds.slice(1),
        queued_scene_ids: addedIds,
        queuedSceneIds: addedIds,
        bad_review_scene_ids: addedIds.filter((sceneId) => boardSceneHasBadVideoReview(scenesByIdV136I.get(sceneId) || {})),
        badReviewSceneIds: addedIds.filter((sceneId) => boardSceneHasBadVideoReview(scenesByIdV136I.get(sceneId) || {})),
        updated_at: batchAcceptedAtV136I,
        updatedAt: batchAcceptedAtV136I,
        source: 'frontend_batch_accepted_marker_v200m',
      }
      setBoard((current) => {
        const base = current || boardRef.current || board || {}
        const next = {
          ...base,
          board_video_batch: { ...(base.board_video_batch || base.video_batch || {}), ...acceptedBatchMarkerV200M },
          boardVideoBatch: { ...(base.boardVideoBatch || base.videoBatch || {}), ...acceptedBatchMarkerV200M },
          video_batch: { ...(base.video_batch || base.board_video_batch || {}), ...acceptedBatchMarkerV200M },
          videoBatch: { ...(base.videoBatch || base.boardVideoBatch || {}), ...acceptedBatchMarkerV200M },
        }
        boardRef.current = next
        return next
      })

      const nextBoard = result?.board || result?.snapshot?.data || null
      if (nextBoard && Array.isArray(nextBoard.scenes)) {
        const mergedStartBoardV200M = boardMergeServerVideoStateV131N(
          { ...(boardRef.current || board || {}), board_video_batch: acceptedBatchMarkerV200M, boardVideoBatch: acceptedBatchMarkerV200M, video_batch: acceptedBatchMarkerV200M, videoBatch: acceptedBatchMarkerV200M },
          nextBoard
        )
        boardRef.current = mergedStartBoardV200M
        setBoard(mergedStartBoardV200M)
        reconcileBadRegenRuntimeWithBoardV136I(mergedStartBoardV200M, { sceneIds: addedIds })
      }

      setAutoVideoQueueState({
        active: false,
        serverBatchActive: true,
        total: addedIds.length,
        queued: addedIds.length,
        skippedReady: skippedReadyIds.length,
        invalid: invalidItems.length,
      })

      setStatus(`Серверная очередь запущена: ${addedIds.length} сцен · batch ${result?.batchId || result?.batch_id || ''}`)
      pushBoardToast({
        type: 'info',
        title: 'Серверная очередь запущена',
        message: `Backend сам сделает ${addedIds.length} сцен. Можно уходить из Board.`,
        dedupeKey: `board:server_batch:start:${result?.batchId || Date.now()}`,
      })

      if (typeof notifyTelegramBoardEvent === 'function') {

      notifyTelegramBoardEvent({
        event: 'server_video_batch_start',
        counts: {
          queued: addedIds.length,
          skippedReady: skippedReadyIds.length,
          invalid: invalidItems.length,
          sceneIds: addedIds,
          batchId: result?.batchId || result?.batch_id || '',
        },
      })

      }
    }).catch((error) => {
      console.warn('[BOARD SERVER BATCH] start failed', error)
      clearBadRegenRuntimeStatusesV136I(addedIds)
      // server_batch_start_failed_release_v131m
      if (typeof window !== 'undefined') window.__AVA_BOARD_SERVER_VIDEO_BATCH_ACTIVE__ = false
      setAutoVideoQueueState((current) => ({ ...(current || {}), active: false, serverBatchActive: false, queued: 0 }))
      setStatus(`Серверная очередь не запущена: ${error?.message || error}`)
      pushBoardToast({
        type: 'error',
        title: 'Серверная очередь не запущена',
        message: error?.message || String(error),
        dedupeKey: `board:server_batch:error:${Date.now()}`,
      })
    })
  }

    function stopAllScenesVideoQueue(event = null) {
    // AVA_BOARD_SERVER_BATCH_BLOCK_LEGACY_FRONTEND_V131M: user stop releases frontend guard too.
    if (typeof window !== 'undefined') window.__AVA_BOARD_SERVER_VIDEO_BATCH_ACTIVE__ = false

    event?.preventDefault?.()
    event?.stopPropagation?.()

    autoVideoQueueStopRef.current = true
    clearBadRegenRuntimeStatusesV136I()

    if (!workspaceMode && projectId) {
      apiRequest(`/projects/${projectId}/board/video-batch/stop`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'user_stop_from_board_page_v131b' }),
      }).catch((error) => console.warn('[BOARD SERVER BATCH] stop failed', error))
    }

    const currentBoard = boardRef.current || board
    const waitingIds = boardMergeWaitingSceneIdsV57B(currentBoard, localVideoQueueRef.current || [])
    const stoppedSet = new Set(waitingIds.map((id) => asText(id)).filter(Boolean))
    localVideoQueueRef.current = []

    let nextBoardForSave = null
    let clearedWaitingCount = 0
    let activeKeptCount = 0

    setBoard((current) => {
      let changed = false
      const scenesNext = asSceneArray(current.scenes).map((scene) => {
        const sceneId = asText(scene?.id || scene?.scene_id)
        const videoStatus = String(scene?.video_status || scene?.videoStatus || '').toLowerCase()
        const hasJob = Boolean(scene?.video_job_id || scene?.videoJobId || scene?.video_status_endpoint || scene?.videoStatusEndpoint)
        const hasReadyVideo = boardSceneHasVideoResultForAuto(scene)
        const waitingOnly = stoppedSet.has(sceneId) || (videoStatus === 'queued' && !hasJob)

        // V200X: User stop must also release manual single-scene jobs that got stuck
        // in starting/running after F5 or after a terminal backend status without video.
        // Preserve already-ready video refs, but clear job ids/endpoints and busy badges.
        if (hasJob || ['queued', 'starting', 'preparing', 'submitting', 'running', 'processing', 'queued_no_prompt_id'].includes(videoStatus)) {
          activeKeptCount += 1
          changed = true
          const nextMedia = { ...(scene.media || {}) }
          if (nextMedia.video && typeof nextMedia.video === 'object') {
            nextMedia.video = {
              ...nextMedia.video,
              status: hasReadyVideo ? 'ready' : '',
              error: '',
              jobId: '',
              job_id: '',
              statusEndpoint: '',
              status_endpoint: '',
              progress: 0,
            }
          }
          return {
            ...scene,
            media: nextMedia,
            video_status: hasReadyVideo ? 'ready' : '',
            videoStatus: hasReadyVideo ? 'ready' : '',
            video_error: '',
            videoError: '',
            video_job_id: '',
            videoJobId: '',
            video_prompt_id: '',
            videoPromptId: '',
            video_status_endpoint: '',
            videoStatusEndpoint: '',
            video_queue_position: 0,
            videoQueuePosition: 0,
            video_queue_source: '',
            videoQueueSource: '',
            video_interrupted_reason: 'user_stop_clear_manual_job_v200x',
            videoInterruptedReason: 'user_stop_clear_manual_job_v200x',
            video_updated_at: new Date().toISOString(),
            videoUpdatedAt: new Date().toISOString(),
            video_progress: 0,
            videoProgress: 0,
          }
        }

        if (!waitingOnly) return scene

        clearedWaitingCount += 1
        changed = true
        const nextMedia = { ...(scene.media || {}) }
        if (nextMedia.video && typeof nextMedia.video === 'object') {
          nextMedia.video = {
            ...nextMedia.video,
            status: hasReadyVideo ? 'ready' : '',
            error: '',
            jobId: '',
            job_id: '',
            statusEndpoint: '',
            status_endpoint: '',
            progress: 0,
          }
        }

        return {
          ...scene,
          media: nextMedia,
          video_status: hasReadyVideo ? 'ready' : '',
          videoStatus: hasReadyVideo ? 'ready' : '',
          video_error: '',
          videoError: '',
          video_job_id: '',
          videoJobId: '',
          video_prompt_id: '',
          videoPromptId: '',
          video_status_endpoint: '',
          videoStatusEndpoint: '',
          video_queue_position: 0,
          videoQueuePosition: 0,
          video_queue_source: '',
          videoQueueSource: '',
          video_updated_at: new Date().toISOString(),
          videoUpdatedAt: new Date().toISOString(),
          video_progress: 0,
          videoProgress: 0,
        }
      })

      const queueChanged = Boolean((current.video_queue || {}).waitingSceneIds?.length || (current.video_queue || {}).waiting_scene_ids?.length)
      if (!changed && !queueChanged) return current

      nextBoardForSave = {
        ...current,
        scenes: scenesNext,
        video_queue: {
          ...(current.video_queue || {}),
          waitingSceneIds: [],
          waiting_scene_ids: [],
          updatedAt: new Date().toISOString(),
          source: 'stop_waiting_queue_keep_active_v130h',
        },
        updatedAt: new Date().toISOString(),
      }
      return nextBoardForSave
    })

    window.setTimeout(() => {
      if (nextBoardForSave) saveBoard(nextBoardForSave, true)
      const activeScene = activeBoardVideoScene(nextBoardForSave || boardRef.current || {})
      setAutoVideoQueueState((current) => ({
        ...current,
        active: Boolean(activeScene),
        queued: 0,
        total: Boolean(activeScene) ? current.total : 0,
      }))
    }, 0)

    const message = activeKeptCount
      ? `Очередь остановлена. Ожидающие сцены очищены: ${clearedWaitingCount}. Активные/зависшие job сброшены: ${activeKeptCount}.`
      : `Очередь остановлена. Ожидающие сцены очищены: ${clearedWaitingCount}.`
    setStatus(message)
    pushBoardToast({
      type: activeKeptCount ? 'info' : 'warning',
      title: 'Очередь остановлена',
      message,
      dedupeKey: `board:auto_queue:stop_waiting_v130h:${clearedWaitingCount}:${activeKeptCount}`,
    })
  }

  function boardVideoPatchFromStatus(data, endpoint, jobId) {
    const fallbackVideoUrl = boardVideoUrlFromStatus(data)
    const assetId = boardAssetIdFromRef(
      data?.videoAssetId,
      data?.video_asset_id,
      data?.assetId,
      data?.asset_id,
      data?.videoApiPath,
      data?.video_api_path,
      fallbackVideoUrl
    )
    const assetApiPath = boardCanonicalAssetApiPath(assetId) || boardAssetApiPathFromRef(data?.videoApiPath, data?.video_api_path, fallbackVideoUrl)
    const videoUrl = assetApiPath || fallbackVideoUrl
    return {
      video_url: videoUrl,
      videoUrl: videoUrl,
      video_asset_id: assetId,
      videoAssetId: assetId,
      video_api_path: assetApiPath || data?.videoApiPath || data?.video_api_path || '',
      videoApiPath: assetApiPath || data?.videoApiPath || data?.video_api_path || '',
      video_name: data?.videoName || data?.video_name || (videoUrl ? 'video.mp4' : ''),
      original_video_url: data?.originalVideoUrl || data?.original_video_url || '',
      video_status: 'ready',
      video_job_id: data?.jobId || data?.job_id || jobId || '',
      video_status_endpoint: endpoint,
      video_error: '',
      video_result: data || null,
      video_ready_at: new Date().toISOString(),
    }
  }

  async function boardVideoPatchFromStatusWithAsset(data, endpoint, jobId, sceneId) {
    const patch = canonicalizeBoardSceneMediaRefs(boardVideoPatchFromStatus(data, endpoint, jobId))
    const staticUrl = boardStaticMediaUrl(patch.video_api_path || patch.video_url)
    if (!isProtectedBoardAssetApiPath(patch.video_api_path || patch.videoUrl || patch.video_url) && staticUrl) {
      try {
        const asset = await registerStaticMediaAsset({
          url: staticUrl,
          projectId: workspaceMode ? null : projectId,
          kind: 'video',
          stage: 'board_videos',
          originalName: patch.video_name || data?.videoName || data?.video_name || 'board-video.mp4',
          sceneId,
        })
        const assetId = asset.asset_id || asset.assetId || ''
        const assetApiPath = asset.asset_api_path || asset.assetApiPath || ''
        if (assetId && assetApiPath) {
          patch.video_asset_id = assetId
          patch.videoAssetId = assetId
          patch.video_api_path = assetApiPath
          patch.videoApiPath = assetApiPath
          patch.video_url = assetApiPath
          patch.videoUrl = assetApiPath
          console.log('[BOARD VIDEO ASSET RESTORE]', { sceneId, assetId, apiPath: assetApiPath, sourceField: 'completed_static_video', success: true })
        }
      } catch (error) {
        console.warn('[BOARD VIDEO STATIC REGISTER]', { sceneId, staticUrl, success: false, error: error?.message || error })
      }
    }
    return canonicalizeBoardSceneMediaRefs(patch)
  }

  function markBoardJobSeen(jobId = '') {
    const safeJobId = asText(jobId)
    if (!safeJobId) return
    const nextSeen = new Set(seenCompletedJobIdsRef.current)
    nextSeen.add(safeJobId)
    seenCompletedJobIdsRef.current = nextSeen
    writeBoardSeenCompletedJobIds(nextSeen)
    console.log('[BOARD JOB SEEN]', { jobId: safeJobId })
  }

  function boardCompletedStatusSkipReason({ responseSceneId = '', responseProjectId = '', expectedSceneId = '' } = {}) {
    const statusSceneId = asText(responseSceneId || expectedSceneId)
    const statusProjectId = asText(responseProjectId)
    if (isGeneratorSceneId(statusSceneId)) return 'generator scene'
    // V200X: Some manual /clip/video/status responses can omit projectId even when
    // the job belongs to the current scene. Do not drop a completed video only for
    // missing projectId; still block explicit mismatches.
    if (!workspaceMode && statusProjectId && statusProjectId !== asText(projectId)) return 'project mismatch'
    if (statusSceneId && expectedSceneId && statusSceneId !== expectedSceneId) return 'scene mismatch'
    return ''
  }

  function boardVideoPollStillCurrentV129P(sceneId = '', endpoint = '', jobId = '') {
    const liveScene = asSceneArray(boardRef.current?.scenes).find((scene) => asText(scene?.id || scene?.scene_id) === asText(sceneId))
    if (!liveScene) return { ok: false, reason: 'scene_missing' }

    const imageEpoch = boardImageMutationEpochForVideoV129P(liveScene)
    if (!imageEpoch) return { ok: true, reason: '' }

    const liveJobId = asText(liveScene.video_job_id || liveScene.videoJobId || '')
    const liveEndpoint = asText(liveScene.video_status_endpoint || liveScene.videoStatusEndpoint || '')
    const liveStatus = String(liveScene.video_status || liveScene.videoStatus || '').toLowerCase()
    const normalizeEndpoint = (value = '') => asText(value).replace(/^\/api\//, '/').replace(/^api\//, '/')
    const expectedEndpoint = normalizeEndpoint(endpoint)
    const actualEndpoint = normalizeEndpoint(liveEndpoint)

    // If the still image changed and the live scene no longer carries this exact job,
    // an old poll callback must not write old completed video refs back into the scene.
    if (!liveJobId && !liveEndpoint) return { ok: false, reason: 'image_changed_job_cleared' }
    if (jobId && liveJobId && liveJobId !== asText(jobId)) return { ok: false, reason: 'image_changed_job_mismatch' }
    if (expectedEndpoint && actualEndpoint && expectedEndpoint !== actualEndpoint) return { ok: false, reason: 'image_changed_endpoint_mismatch' }
    if (!['starting', 'queued', 'preparing', 'submitting', 'running', 'queued_no_prompt_id'].includes(liveStatus)) {
      return { ok: false, reason: `image_changed_status_${liveStatus || 'empty'}` }
    }
    return { ok: true, reason: '' }
  }


  function pollBoardVideoJob(sceneId, statusEndpoint, jobId) {
    const endpoint = statusEndpoint || (jobId ? `/clip/video/status/${jobId}` : '')
    if (!sceneId || !endpoint) return
    const currentScene = asSceneArray(boardRef.current?.scenes).find((scene) => asText(scene?.id || scene?.scene_id) === asText(sceneId))
    if (currentScene && (
      String(currentScene.video_status || currentScene.videoStatus || '').toLowerCase() === 'ready' ||
      (typeof boardSceneHasCurrentVideoResultV129P === 'function' && boardSceneHasCurrentVideoResultV129P(currentScene))
    )) return
    if (jobId && seenCompletedJobIdsRef.current.has(jobId)) {
      console.log('[BOARD JOB SEEN]', { jobId, skipPoll: true })
      return
    }

    const normalizedEndpoint = endpoint.startsWith('/api/')
      ? endpoint.slice(4)
      : endpoint

    const pollKey = jobId ? `video:${jobId}` : `video:${normalizedEndpoint}`
    if (activeVideoPollsRef.current.has(pollKey)) return
    activeVideoPollsRef.current.add(pollKey)

    const finishPoll = () => {
      activeVideoPollsRef.current.delete(pollKey)
      boardReleaseVideoQueueStart(sceneId)
    }

    let attempt = 0
    const maxAttempts = 240

    const tick = async () => {
      // AVA_BOARD_SERVER_BATCH_BLOCK_LEGACY_FRONTEND_V131M: old browser pollers must stop while backend server batch is active.
      if (boardServerBatchIsActiveV131M()) {
        console.log('[BOARD SERVER BATCH FRONTEND GUARD V131M] stop old poll')
        finishPoll()
        return
      }
      attempt += 1
      try {
        const prePollCurrentV129R = boardVideoPollStillCurrentV129P(sceneId, normalizedEndpoint, jobId)
        if (!prePollCurrentV129R.ok) {
          finishPoll()
          console.warn('[BOARD VIDEO POLL PRE-SKIP AFTER IMAGE CHANGE]', { sceneId, jobId, endpoint: normalizedEndpoint, reason: prePollCurrentV129R.reason })
          markBoardJobSeen(jobId || '')
          window.setTimeout(processNextQueuedBoardVideo, 650)
          return
        }

        const data = await apiRequest(normalizedEndpoint)
        // AVA_BOARD_DELETE_MEDIA_HARD_V129S: once image/media was deleted or replaced, old boardjob polling must not resurrect stale video refs.
        const liveSceneForPollV129S = asSceneArray(boardRef.current?.scenes).find((scene) => asText(scene?.id || scene?.scene_id) === asText(sceneId))
        const liveJobIdForPollV129S = asText(liveSceneForPollV129S?.video_job_id || liveSceneForPollV129S?.videoJobId)
        if (jobId && liveJobIdForPollV129S !== asText(jobId)) {
          console.log('[BOARD VIDEO POLL STALE SKIP V129S]', { sceneId, jobId, liveJobId: liveJobIdForPollV129S })
          finishPoll()
          return
        }

        const status = data?.status || data?.video_status || 'running'
        const videoUrl = boardVideoUrlFromStatus(data)

        const pollCurrentV129P = boardVideoPollStillCurrentV129P(sceneId, normalizedEndpoint, jobId)
        if (!pollCurrentV129P.ok) {
          finishPoll()
          console.warn('[BOARD VIDEO POLL STALE AFTER IMAGE CHANGE]', { sceneId, jobId, endpoint: normalizedEndpoint, reason: pollCurrentV129P.reason })
          markBoardJobSeen(jobId || data?.jobId || data?.job_id || '')
          window.setTimeout(processNextQueuedBoardVideo, 650)
          return
        }

        if (isBoardVideoStaleJobStatus(status, data)) {
          finishPoll()
          // AVA_BOARD_STALE_JOB_RESET_SAVE_V200H: persist stale-job cleanup immediately.
          updateSceneAndSave(sceneId, resetStaleVideoJobPatch(data))
          markBoardJobSeen(jobId || data?.jobId || data?.job_id || '')
          setStatus(`Старый video job не найден: ${sceneId}. Статус сброшен.`)
          pushBoardToast({
            type: 'info',
            title: 'Статус видео сброшен',
            message: `Сцена ${sceneId}: старый job не найден на backend`,
            sceneId,
            dedupeKey: `video:${jobId || sceneId}:not_found_reset`,
          })
          window.setTimeout(processNextQueuedBoardVideo, 650)
          return
        }

        if (isBoardVideoBlockedStatus(status)) {
          finishPoll()
          const blockedError = typeof data?.error === 'string' ? data.error : (data?.detail || status)
          updateSceneForVideoJob(sceneId, jobId, {
            video_status: status,
            video_error: blockedError,
            video_job_id: '',
            video_status_endpoint: '',
            video_queue_position: 0,
            video_result: data || null,
          })
          setStatus(`Видео заблокировано: ${blockedError}`)
          pushBoardToast({ type: 'warning', title: 'Видео заблокировано', message: `Сцена ${sceneId}: ${blockedError}`, sceneId })
          window.setTimeout(processNextQueuedBoardVideo, 650)
          return
        }

        if (videoUrl) {
          finishPoll()
          const responseSceneId = asText(data?.sceneId || data?.scene_id || sceneId)
          const responseProjectId = asText(data?.projectId || data?.project_id || '')
          const skipReason = boardCompletedStatusSkipReason({
            responseSceneId,
            responseProjectId,
            expectedSceneId: sceneId,
          })
          if (skipReason) {
            console.warn('[BOARD JOB COMPLETED SKIP]', {
              reason: skipReason,
              jobId: data?.jobId || data?.job_id || jobId || '',
              projectId: responseProjectId,
              sceneId: responseSceneId,
              resultUrl: videoUrl,
            })
            markBoardJobSeen(data?.jobId || data?.job_id || jobId || '')
            updateSceneForVideoJob(sceneId, jobId, {
              video_status: 'completed_skipped',
              video_error: skipReason,
              video_job_id: '',
              video_status_endpoint: '',
              video_queue_position: 0,
              video_result: data || null,
            })
            window.setTimeout(processNextQueuedBoardVideo, 650)
            return
          }
          console.log('[BOARD JOB COMPLETED APPLY]', {
            jobId: data?.jobId || data?.job_id || jobId || '',
            projectId: responseProjectId,
            sceneId: responseSceneId,
            resultUrl: videoUrl,
          })
          const readyPatch = await boardVideoPatchFromStatusWithAsset(data, endpoint, jobId, sceneId)
          const liveSceneForReadyV129P = asSceneArray(boardRef.current?.scenes).find((scene) => asText(scene?.id || scene?.scene_id) === asText(sceneId)) || {}
          const readyImageEpochV129P = boardImageMutationEpochForVideoV129P(liveSceneForReadyV129P)
          if (readyImageEpochV129P) {
            readyPatch.video_source_image_mutation_epoch = readyImageEpochV129P
            readyPatch.videoSourceImageMutationEpoch = readyImageEpochV129P
            readyPatch.video_source_image_mutation_at = liveSceneForReadyV129P.image_mutation_at || liveSceneForReadyV129P.imageMutationAt || new Date(readyImageEpochV129P).toISOString()
            readyPatch.videoSourceImageMutationAt = readyPatch.video_source_image_mutation_at
          }
          readyPatch.video_status = 'ready'
          readyPatch.video_job_id = ''
          readyPatch.video_status_endpoint = ''
          readyPatch.video_queue_position = 0
          const wasBadReviewRegenerationV130J = boardVideoWasBadBeforeRegenerate(liveSceneForReadyV129P) || boardSceneHasBadVideoReview(liveSceneForReadyV129P)
          Object.assign(readyPatch, boardVideoReviewRegenerateFlagPatch(false, 'completed'))
          if (wasBadReviewRegenerationV130J) {
            Object.assign(readyPatch, boardVideoReviewPatch('needs_review', 'bad_video_regenerated'))
          }
          updateSceneAndSave(sceneId, readyPatch)
          markBoardJobSeen(data?.jobId || data?.job_id || jobId || '')
          setStatus(`Видео готово: ${sceneId}`)
          pushBoardToast({ type: 'success', title: 'Видео готово', message: `Сцена ${sceneId}`, sceneId })
          finishBoardVideoQueueStepV130H(sceneId, data?.jobId || data?.job_id || jobId || '', 'completed_ready')
          return
        }

        if (isBoardVideoDoneStatus(status)) {
          finishPoll()
          updateSceneAndSave(sceneId, {
            video_status: 'error',
            videoStatus: 'error',
            video_error: 'completed_without_video_url',
            videoError: 'completed_without_video_url',
            video_job_id: '',
            videoJobId: '',
            video_status_endpoint: '',
            videoStatusEndpoint: '',
            video_queue_position: 0,
            videoQueuePosition: 0,
            video_result: data || null,
            videoResult: data || null,
            video_updated_at: new Date().toISOString(),
            videoUpdatedAt: new Date().toISOString(),
          })
          setStatus('Comfy завершил job, но backend не вернул video_url')
          pushBoardToast({ type: 'error', title: 'Видео без результата', message: `Сцена ${sceneId}: backend не вернул video_url`, sceneId })
          finishBoardVideoQueueStepV130H(sceneId, jobId || '', 'completed_without_video_url_v200a')
          window.setTimeout(processNextQueuedBoardVideo, 650)
          return
        }

        if (isBoardVideoErrorStatus(status)) {
          finishPoll()
          updateSceneAndSave(sceneId, {
            video_status: 'error',
            videoStatus: 'error',
            video_error: data?.error || data?.detail || status,
            videoError: data?.error || data?.detail || status,
            video_job_id: '',
            videoJobId: '',
            video_status_endpoint: '',
            videoStatusEndpoint: '',
            video_queue_position: 0,
            videoQueuePosition: 0,
            video_result: data || null,
            videoResult: data || null,
            video_updated_at: new Date().toISOString(),
            videoUpdatedAt: new Date().toISOString(),
          })
          setStatus(`Видео не собрано: ${data?.error || data?.detail || status}`)
          pushBoardToast({ type: 'error', title: 'Видео не собрано', message: `Сцена ${sceneId}: ${data?.error || data?.detail || status}`, sceneId })
          finishBoardVideoQueueStepV130H(sceneId, jobId || '', 'video_error_status_v200a')
          window.setTimeout(processNextQueuedBoardVideo, 650)
          return
        }

        const rawRunningStatusV130F = String(status || '').toLowerCase()
        const normalizedRunningStatus = rawRunningStatusV130F === 'queued'
          ? 'running'
          : ['preparing', 'submitting', 'running', 'starting'].includes(rawRunningStatusV130F)
            ? rawRunningStatusV130F
            : 'running'

        updateSceneForVideoJob(sceneId, jobId, {
          video_status: normalizedRunningStatus,
          video_job_id: data?.jobId || data?.job_id || jobId || '',
          video_status_endpoint: endpoint,
          video_url: '',
          video_name: '',
          video_result: null,
        })

        if (attempt < maxAttempts) {
          window.setTimeout(tick, 2500)
        } else {
          finishPoll()
          updateSceneForVideoJob(sceneId, jobId, {
            video_status: 'error',
            video_error: 'poll_timeout',
          })
          setStatus('Видео слишком долго не отвечает: poll_timeout')
          pushBoardToast({ type: 'error', title: 'Видео зависло', message: `Сцена ${sceneId}: poll_timeout`, sceneId })
          window.setTimeout(processNextQueuedBoardVideo, 650)
        }
      } catch (error) {
        console.error('[Board] video status polling failed', error)
        if (attempt < maxAttempts) {
          window.setTimeout(tick, 4000)
        } else {
          finishPoll()
          updateSceneForVideoJob(sceneId, jobId, {
            video_status: 'error',
            video_error: error?.message || 'poll_failed',
          })
          setStatus(`Ошибка проверки видео: ${error?.message || 'poll_failed'}`)
          pushBoardToast({ type: 'error', title: 'Ошибка проверки видео', message: `Сцена ${sceneId}: ${error?.message || 'poll_failed'}`, sceneId })
          window.setTimeout(processNextQueuedBoardVideo, 650)
        }
      }
    }

    window.setTimeout(tick, 1200)
  }

  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [boardToasts, setBoardToasts] = useState([])
  const [assemblyConfirmOpen, setAssemblyConfirmOpen] = useState(false)
  const [assemblyConfirmBusy, setAssemblyConfirmBusy] = useState(false)
  const [assemblyConfirmError, setAssemblyConfirmError] = useState('')
  const [saving, setSaving] = useState(false)
  const [bulkStillsImporting, setBulkStillsImporting] = useState(false)
  const [playback, setPlayback] = useState(null)
  const [collapsedPanels, setCollapsedPanels] = useState(() => ({ translation: !openedFromTiming }))
  const [audioSrc, setAudioSrc] = useState('')
  const [selectedVideoBlobUrl, setSelectedVideoBlobUrl] = useState('')
  const [selectedVideoLoadError, setSelectedVideoLoadError] = useState('')
  const [runtimeSceneMediaUrls, setRuntimeSceneMediaUrls] = useState({})
  const [badRegenRuntimeStatus, setBadRegenRuntimeStatus] = useState({})
  const [mmaudioOpen, setMmaudioOpen] = useState(false)
  const audioRef = useRef(null)
  const manualLipSyncAudioInputRefV129A = useRef(null)
  const importRef = useRef(null)
  const stillFilesImportRef = useRef(null)
  const stillZipImportRef = useRef(null)
  const boardRef = useRef(board)
  const skipNextBoardAutosaveRefV145A = useRef(false)
  const localVideoQueueRef = useRef([])
  const localVideoQueueStartLockRef = useRef('')
  const localVideoQueueStartLockAtRef = useRef(0)
  const [autoVideoQueueState, setAutoVideoQueueState] = useState({
    active: false,
    total: 0,
    queued: 0,
    skippedReady: 0,
    invalid: 0,
  })
  const [autoVideoQueueConfirm, setAutoVideoQueueConfirm] = useState({
    open: false,
    plan: null,
  })
  const [manualLipSyncAudioUploadingV129A, setManualLipSyncAudioUploadingV129A] = useState({})
  const [manualLipSyncAudioPreviewUrlsV129A, setManualLipSyncAudioPreviewUrlsV129A] = useState({})
  const autoVideoQueueStopRef = useRef(false)
  const activeVideoPollsRef = useRef(new Set())
  const staticAssetRepairRef = useRef(new Set())
  const imageBlobUrlCacheRefV129O = useRef(new Map())
  const videoBlobUrlCacheRefV200C = useRef(new Map())
  const lastBoardAutosaveFingerprintRefV200C = useRef('')
  const badRegenRuntimeStatusRef = useRef({})
  const seenCompletedJobIdsRef = useRef(readBoardSeenCompletedJobIds())
  const sceneStripRef = useRef(null)
  const sceneCardRefs = useRef(new Map())

  const badRegenRuntimeActiveStatusesV136I = new Set(['starting', 'preparing', 'submitting', 'queued', 'running', 'processing'])

  function setBadRegenRuntimeStatusMapV136I(nextMap = {}) {
    badRegenRuntimeStatusRef.current = nextMap
    setBadRegenRuntimeStatus(nextMap)
  }

  function patchBadRegenRuntimeStatusesV136I(entries = []) {
    const safeEntries = asArray(entries).filter((entry) => asText(entry?.sceneId || entry?.scene_id || entry?.id))
    if (!safeEntries.length) return
    const now = new Date().toISOString()
    const nextMap = { ...(badRegenRuntimeStatusRef.current || {}) }
    safeEntries.forEach((entry) => {
      const sceneId = asText(entry.sceneId || entry.scene_id || entry.id)
      const status = String(entry.status || 'submitting').toLowerCase()
      if (!badRegenRuntimeActiveStatusesV136I.has(status)) {
        delete nextMap[sceneId]
        return
      }
      // AVA_BOARD_BAD_REGEN_STICKY_RUNTIME_V136K:
      // Once a runtime overlay is known to come from a bad-review regeneration,
      // keep that flag sticky. Some refresh/status payloads do not repeat the
      // bad-review reason, and downgrading fromBad=false lets old ready snapshots
      // erase the live queued/running badge.
      const previousFromBadV136K = Boolean(nextMap[sceneId]?.fromBad)
      const incomingFromBadV136K = entry.fromBad ?? entry.from_bad
      nextMap[sceneId] = {
        ...(nextMap[sceneId] || {}),
        sceneId,
        status,
        queuePosition: Number(entry.queuePosition || entry.queue_position || 0) || 0,
        batchId: asText(entry.batchId || entry.batch_id || nextMap[sceneId]?.batchId || ''),
        jobId: asText(entry.jobId || entry.job_id || nextMap[sceneId]?.jobId || ''),
        statusEndpoint: asText(entry.statusEndpoint || entry.status_endpoint || nextMap[sceneId]?.statusEndpoint || ''),
        fromBad: Boolean(previousFromBadV136K || incomingFromBadV136K),
        startedAt: asText(entry.startedAt || entry.started_at || nextMap[sceneId]?.startedAt || now),
        updatedAt: now,
        source: entry.source || 'bad_regen_runtime_v136i',
      }
    })
    setBadRegenRuntimeStatusMapV136I(nextMap)
  }

  function clearBadRegenRuntimeStatusesV136I(sceneIds = []) {
    const current = badRegenRuntimeStatusRef.current || {}
    const ids = asArray(sceneIds).map((id) => asText(id)).filter(Boolean)
    if (!ids.length) {
      if (Object.keys(current).length) setBadRegenRuntimeStatusMapV136I({})
      return
    }
    let changed = false
    const nextMap = { ...current }
    ids.forEach((sceneId) => {
      if (Object.prototype.hasOwnProperty.call(nextMap, sceneId)) {
        delete nextMap[sceneId]
        changed = true
      }
    })
    if (changed) setBadRegenRuntimeStatusMapV136I(nextMap)
  }

  function boardBatchRuntimePollActiveV200M() {
    // AVA_BOARD_BATCH_RUNTIME_POLL_GATE_V200M:
    // Bad-video regeneration uses runtime-only queued/running badges so autosave
    // does not persist transient state. Therefore the server-batch refresh poller
    // must also run while these runtime badges exist, even if the saved board_batch
    // object is missing/stale in the current React board.
    return Object.keys(badRegenRuntimeStatusRef.current || {}).length > 0
  }

  function boardBatchRefreshShouldRunV200M() {
    if (workspaceMode || !projectId) return false
    return Boolean(
      boardServerBatchActiveInfoV200E(boardRef.current || board) ||
      autoVideoQueueState?.serverBatchActive ||
      boardBatchRuntimePollActiveV200M()
    )
  }

  function reconcileBadRegenRuntimeWithBoardV136I(boardData = {}, options = {}) {
    const current = badRegenRuntimeStatusRef.current || {}
    const currentIds = Object.keys(current)
    if (!currentIds.length) return
    const onlyIds = new Set(asArray(options.sceneIds || options.scene_ids).map((id) => asText(id)).filter(Boolean))
    const scenesById = new Map(asSceneArray(boardData?.scenes).map((scene) => [asText(scene?.id || scene?.scene_id), scene]))
    if (!scenesById.size) return

    let changed = false
    const nextMap = { ...current }
    currentIds.forEach((sceneId) => {
      if (onlyIds.size && !onlyIds.has(sceneId)) return
      const scene = scenesById.get(sceneId)
      if (!scene) return
      const status = String(scene?.video_status || scene?.videoStatus || '').toLowerCase()
      const hasServerJob = Boolean(scene?.video_job_id || scene?.videoJobId || scene?.video_status_endpoint || scene?.videoStatusEndpoint)
      const reviewStatus = boardSceneVideoReviewStatus(scene)
      const hasCurrentVideo = boardSceneHasCurrentVideoResultV129P(scene)
      const runtimeWasBad = Boolean(nextMap[sceneId]?.fromBad)
      // AVA_BOARD_BAD_REGEN_STICKY_RUNTIME_V136K:
      // During server bad-review regeneration the project snapshot can still carry
      // the old ready video refs + the old red bad mark until backend binds the new
      // result and writes needs_review. Do not let that stale ready snapshot clear
      // the runtime queued/running overlay.
      const stillBadRegenPendingV136K = Boolean(
        runtimeWasBad &&
        reviewStatus === 'bad' &&
        !isBoardVideoErrorStatus(status)
      )
      const doneOrFailed = Boolean(
        isBoardVideoErrorStatus(status) ||
        reviewStatus === 'needs_review' ||
        (!stillBadRegenPendingV136K && (
          isBoardVideoDoneStatus(status) ||
          (hasCurrentVideo && !isVideoBusyStatus(status) && status !== 'queued_no_prompt_id')
        ))
      )
      if (doneOrFailed) {
        delete nextMap[sceneId]
        changed = true
        return
      }
      if (hasServerJob && badRegenRuntimeActiveStatusesV136I.has(status)) {
        nextMap[sceneId] = {
          ...(nextMap[sceneId] || {}),
          status: status === 'queued' ? 'running' : status,
          jobId: asText(scene?.video_job_id || scene?.videoJobId || nextMap[sceneId]?.jobId || ''),
          statusEndpoint: asText(scene?.video_status_endpoint || scene?.videoStatusEndpoint || nextMap[sceneId]?.statusEndpoint || ''),
          queuePosition: Number(scene?.video_queue_position || scene?.videoQueuePosition || nextMap[sceneId]?.queuePosition || 0) || 0,
          updatedAt: new Date().toISOString(),
        }
        changed = true
      }
    })
    if (changed) setBadRegenRuntimeStatusMapV136I(nextMap)
  }

  // AVA_BOARD_BAD_REGEN_F5_RUNTIME_REHYDRATE_V136J:
  // F5 clears React runtime state, but the backend server batch can keep rendering.
  // Rebuild only the UI overlay from the live batch/status endpoint; never persist these fields.
  const badRegenRuntimeBatchActiveStatusesV136J = new Set(['queued', 'running', 'starting', 'preparing', 'submitting', 'processing'])

  function boardBatchSceneIdsV136J(value) {
    return asArray(value).map((id) => asText(id)).filter(Boolean)
  }

  function boardBatchFreshEnoughV136J(batch = {}) {
    const stamp = Date.parse(
      batch?.updatedAt ||
      batch?.updated_at ||
      batch?.createdAt ||
      batch?.created_at ||
      ''
    )
    if (!Number.isFinite(stamp) || stamp <= 0) return true
    return (Date.now() - stamp) < (12 * 60 * 60 * 1000)
  }

  function rehydrateBadRegenRuntimeFromServerBatchV136J(batchData = {}, boardData = {}, options = {}) {
    const batch = (batchData && typeof batchData === 'object') ? batchData : {}
    const batchStatus = String(batch?.status || batch?.batch_status || '').toLowerCase()
    const batchId = asText(batch?.batchId || batch?.batch_id || '')
    const activeSceneId = asText(batch?.activeSceneId || batch?.active_scene_id || '')
    const activeJobId = asText(batch?.activeJobId || batch?.active_job_id || '')
    const activeStatusEndpoint = asText(batch?.activeStatusEndpoint || batch?.active_status_endpoint || '')
    const waitingIds = boardBatchSceneIdsV136J(batch?.waitingSceneIds || batch?.waiting_scene_ids)
    const completedIds = new Set(boardBatchSceneIdsV136J(batch?.completedSceneIds || batch?.completed_scene_ids))
    const failedIds = new Set(boardBatchSceneIdsV136J(batch?.failedSceneIds || batch?.failed_scene_ids))
    const badReviewIds = new Set(boardBatchSceneIdsV136J(batch?.badReviewSceneIds || batch?.bad_review_scene_ids))
    const allBatchIds = Array.from(new Set([
      activeSceneId,
      ...waitingIds,
      ...Array.from(completedIds),
      ...Array.from(failedIds),
      ...Array.from(badReviewIds),
    ].filter(Boolean)))

    const hasActiveBatch = Boolean(
      badRegenRuntimeBatchActiveStatusesV136J.has(batchStatus) ||
      activeSceneId ||
      activeJobId ||
      activeStatusEndpoint ||
      waitingIds.length
    )

    if (!hasActiveBatch) {
      if (allBatchIds.length) clearBadRegenRuntimeStatusesV136I(allBatchIds)
      return false
    }

    if (!boardBatchFreshEnoughV136J(batch)) {
      console.warn('[BOARD BAD REGEN F5 RUNTIME REHYDRATE V136J] stale batch ignored', {
        batchId,
        status: batchStatus,
        updatedAt: batch?.updatedAt || batch?.updated_at || '',
      })
      return false
    }

    const scenesById = new Map(asSceneArray(boardData?.scenes).map((scene) => [asText(scene?.id || scene?.scene_id), scene]))
    const entries = []

    const addEntry = (sceneId, status, queuePosition = 0) => {
      const safeSceneId = asText(sceneId)
      if (!safeSceneId || failedIds.has(safeSceneId)) return
      const scene = scenesById.get(safeSceneId) || {}
      // AVA_BOARD_BATCH_READY_WITHOUT_VIDEO_GUARD_V143B:
      // Server batch may report a scene as completed before the fresh video ref is visible in
      // the merged board snapshot. Keep that scene in runtime busy state instead of letting a
      // stale persisted ready/status badge show "видео готово" without an actual video file.
      const completedWithoutVideoV143B = Boolean(
        completedIds.has(safeSceneId) &&
        !(typeof boardSceneHasCurrentVideoResultV129P === 'function' && boardSceneHasCurrentVideoResultV129P(scene))
      )
      if (completedIds.has(safeSceneId) && !completedWithoutVideoV143B) return
      const queueSource = String(scene?.video_queue_source || scene?.videoQueueSource || '').toLowerCase()
      const fromBad = Boolean(
        badReviewIds.has(safeSceneId) ||
        boardSceneHasBadVideoReview(scene) ||
        scene?.video_review_regenerate_from_bad ||
        scene?.videoReviewRegenerateFromBad ||
        queueSource.includes('bad_review') ||
        queueSource.includes('regeneration')
      )
      // AVA_BOARD_BATCH_READY_UI_WINS_V148A:
      // If the scene already has a video matching the current source image, do not apply
      // a stale server-batch runtime overlay (“running/queued”). Exception: bad-review
      // regeneration intentionally keeps the old video visible while a new one renders.
      const hasCurrentVideoForRuntimeV148A = Boolean(
        typeof boardSceneHasCurrentVideoResultV129P === 'function' && boardSceneHasCurrentVideoResultV129P(scene)
      )
      if (hasCurrentVideoForRuntimeV148A && !fromBad) return
      entries.push({
        sceneId: safeSceneId,
        status,
        queuePosition,
        batchId,
        jobId: safeSceneId === activeSceneId ? activeJobId : '',
        statusEndpoint: safeSceneId === activeSceneId ? activeStatusEndpoint : '',
        fromBad,
        source: options.source || 'server_batch_f5_rehydrate_v136j',
      })
    }

    if (activeSceneId) addEntry(activeSceneId, 'running', 0)
    waitingIds.forEach((sceneId, index) => {
      addEntry(sceneId, sceneId === activeSceneId ? 'running' : 'queued', index + 1)
    })
    // AVA_BOARD_BATCH_READY_WITHOUT_VIDEO_GUARD_V143B:
    // A completed scene without a current video ref is not ready for the UI yet.
    // This prevents "видео готово" from jumping onto the next queued scene after the
    // previous scene completes; once the video ref is merged, the normal ready path wins.
    Array.from(completedIds).forEach((sceneId) => {
      const safeSceneId = asText(sceneId)
      if (!safeSceneId || entries.some((entry) => entry.sceneId === safeSceneId)) return
      const scene = scenesById.get(safeSceneId) || {}
      const hasCurrentVideoV143B = Boolean(
        typeof boardSceneHasCurrentVideoResultV129P === 'function' && boardSceneHasCurrentVideoResultV129P(scene)
      )
      if (!hasCurrentVideoV143B) addEntry(safeSceneId, 'running', 0)
    })
    if (!entries.length && activeSceneId && activeJobId) addEntry(activeSceneId, 'running', 0)

    if (entries.length) {
      patchBadRegenRuntimeStatusesV136I(entries)
      console.log('[BOARD BAD REGEN F5 RUNTIME REHYDRATE V136J]', {
        source: options.source || '',
        batchId,
        status: batchStatus,
        activeSceneId,
        activeJobId,
        waitingIds,
        entries: entries.map((entry) => ({ sceneId: entry.sceneId, status: entry.status, fromBad: entry.fromBad })),
      })
    }

    const doneIds = [...Array.from(completedIds), ...Array.from(failedIds)]
    const doneIdsToClearV136K = doneIds.filter((sceneId) => {
      const safeSceneId = asText(sceneId)
      const scene = scenesById.get(safeSceneId) || {}
      const reviewStatus = boardSceneVideoReviewStatus(scene)
      const runtime = badRegenRuntimeStatusRef.current?.[safeSceneId]
      // AVA_BOARD_BATCH_READY_WITHOUT_VIDEO_GUARD_V143B:
      // Keep the runtime overlay for completed scenes until the actual video ref is present.
      if (completedIds.has(safeSceneId)) {
        const hasCurrentVideoV143B = Boolean(
          typeof boardSceneHasCurrentVideoResultV129P === 'function' && boardSceneHasCurrentVideoResultV129P(scene)
        )
        if (!hasCurrentVideoV143B) return false
      }
      const keepUntilReviewUpdate = Boolean(
        runtime?.fromBad &&
        reviewStatus === 'bad' &&
        !failedIds.has(safeSceneId)
      )
      if (keepUntilReviewUpdate) {
        // AVA_BOARD_BATCH_COMPLETED_RUNTIME_CLEAR_V200L:
        // The scene already has the fresh video. Do not keep the runtime overlay
        // as "видео делается" only because a stale bad review mark has not yet
        // been replaced by needs_review/посмотри in the local React state.
        const hasCurrentVideoForCompletedV200L = Boolean(
          typeof boardSceneHasCurrentVideoResultV129P === 'function' &&
          boardSceneHasCurrentVideoResultV129P(scene)
        )
        if (completedIds.has(safeSceneId) && hasCurrentVideoForCompletedV200L) {
          console.log('[BOARD BAD REGEN RUNTIME CLEARED V200L] completed video is present', {
            batchId,
            sceneId: safeSceneId,
            reviewStatus,
          })
          return true
        }
        console.log('[BOARD BAD REGEN STICKY RUNTIME V136K] keep completed scene until review updates', {
          batchId,
          sceneId: safeSceneId,
          reviewStatus,
        })
        return false
      }
      return true
    })
    if (doneIdsToClearV136K.length) clearBadRegenRuntimeStatusesV136I(doneIdsToClearV136K)
    return Boolean(entries.length)
  }

  function boardSceneWithBadRegenRuntimeV136I(scene = {}) {
    const sceneId = asText(scene?.id || scene?.scene_id)
    const runtime = sceneId ? (badRegenRuntimeStatus?.[sceneId] || badRegenRuntimeStatusRef.current?.[sceneId]) : null
    const runtimeStatus = String(runtime?.status || '').toLowerCase()
    if (!runtime || !badRegenRuntimeActiveStatusesV136I.has(runtimeStatus)) return scene
    const queuePosition = Number(runtime.queuePosition || 0) || Number(scene?.video_queue_position || scene?.videoQueuePosition || 0) || 0
    return {
      ...scene,
      video_runtime_status_v136i: runtimeStatus,
      videoRuntimeStatusV136I: runtimeStatus,
      video_runtime_batch_id_v136i: runtime.batchId || '',
      videoRuntimeBatchIdV136I: runtime.batchId || '',
      video_runtime_from_bad_v136i: Boolean(runtime.fromBad),
      videoRuntimeFromBadV136I: Boolean(runtime.fromBad),
      video_runtime_updated_at_v136i: runtime.updatedAt || '',
      videoRuntimeUpdatedAtV136I: runtime.updatedAt || '',
      video_runtime_status_endpoint_v136i: runtime.statusEndpoint || '',
      videoRuntimeStatusEndpointV136I: runtime.statusEndpoint || '',
      video_runtime_job_id_v136i: runtime.jobId || '',
      videoRuntimeJobIdV136I: runtime.jobId || '',
      video_queue_position: queuePosition,
      videoQueuePosition: queuePosition,
      video_queue_source: runtime.fromBad
        ? `runtime_bad_review_regeneration_${runtimeStatus}_v136i`
        : (scene?.video_queue_source || scene?.videoQueueSource || `runtime_server_batch_${runtimeStatus}_v136i`),
      videoQueueSource: runtime.fromBad
        ? `runtime_bad_review_regeneration_${runtimeStatus}_v136i`
        : (scene?.videoQueueSource || scene?.video_queue_source || `runtime_server_batch_${runtimeStatus}_v136i`),
    }
  }

  const selectedSceneBase = useMemo(() => {
    const scenes = asSceneArray(board.scenes)
    const selectedIdV200E = asText(board.selectedSceneId || board.selected_scene_id)
    return scenes.find((scene) => asText(scene.id || scene.scene_id || scene.sceneId) === selectedIdV200E) || scenes[0] || null
  }, [board.scenes, board.selectedSceneId, board.selected_scene_id])

  const selectedScene = useMemo(
    () => boardSceneWithBadRegenRuntimeV136I(selectedSceneBase),
    [selectedSceneBase, badRegenRuntimeStatus]
  )

  const selectedSceneDurationLock = useMemo(() => boardSceneTimingLockInfo(selectedScene), [selectedScene])

  useEffect(() => {
    // AVA_BOARD_MANUAL_DURATION_REHYDRATE_SELECTED_V131S:
    // After F5/direct Board entry the duration slider state starts from its React default (6)
    // until the user clicks a scene. Rehydrate it from the selected scene whenever Board data
    // is loaded/refreshed so the visible slider matches the currently selected scene.
    if (!selectedScene || selectedSceneDurationLock.locked) return
    const nextDuration = Number(durationOf(selectedScene) || selectedScene.duration_sec || selectedScene.duration || 0)
    if (!Number.isFinite(nextDuration) || nextDuration <= 0) return
    const safeDuration = Math.max(2, Math.min(12, Number(nextDuration.toFixed(3))))
    setManualSceneDurationSec((current) => (
      Math.abs(Number(current || 0) - safeDuration) > 0.001 ? safeDuration : current
    ))
  }, [
    selectedScene?.id,
    selectedScene?.scene_id,
    selectedScene?.start,
    selectedScene?.start_sec,
    selectedScene?.end,
    selectedScene?.end_sec,
    selectedScene?.duration,
    selectedScene?.duration_sec,
    selectedSceneDurationLock.locked,
  ])
  const selectedSceneTimingLocked = Boolean(selectedSceneDurationLock.locked)
  const selectedSceneLockedDurationLabel = formatBoardDurationShort(selectedSceneDurationLock.duration)
  // AVA_BOARD_HIDE_MANUAL_ADD_FOR_TIMING_V65B:
  // Manual scene tools are only for standalone Board. Timing-imported boards must not
  // show '+ Сцена' after F5/direct entry because adding scenes can break the locked timing map.
  const manualSceneToolsEnabled = useMemo(() => {
    // AVA_BOARD_MANUAL_TOOLS_STANDALONE_FIX_V65C:
    // Pure manual boards may still have start/end/duration/blockTitle-like fields,
    // so do not classify them as Timing-imported only because of scene timing data.
    const scenes = asSceneArray(board.scenes)
    const isManualScene = (scene = {}) => (
      scene?.source === 'manual_board_scene' ||
      scene?.importedFrom === 'manual_board' ||
      scene?.source_kind === 'manual_board_scene' ||
      scene?.sourceKind === 'manual_board_scene' ||
      scene?.scene_type === 'manual_board_scene' ||
      scene?.sceneType === 'manual_board_scene' ||
      scene?.manual === true ||
      scene?.isManual === true
    )
    const hasScenes = scenes.length > 0
    const allScenesManual = hasScenes && scenes.every(isManualScene)
    const boardSource = String(board.source || board.importedFrom || board.source_kind || board.sourceKind || '').toLowerCase()
    const boardSaysManual = ['manual_board', 'standalone_board', 'manual'].includes(boardSource)

    if (allScenesManual || (boardSaysManual && !boardLooksTimingImported(board))) return true
    return !boardLooksTimingImported(board)
  }, [board])

  // AVA_BOARD_RETURN_TO_TIMING_V66B:
  // Show return only for Timing-imported boards. For standalone/manual boards,
  // manualSceneToolsEnabled stays true and this button remains hidden.

  // AVA_BOARD_MANUAL_LIPSYNC_HIDE_SLIDER_V129F:
  // In standalone/manual Board, ia2v is lip-sync and its duration is driven by uploaded audio.
  // Keep Timing-imported boards unchanged: they still use locked Timing duration / audio slice flow.
  const selectedSceneManualLipSyncRouteV129F = Boolean(
    manualSceneToolsEnabled &&
    selectedScene &&
    (() => {
      const routeText = String(selectedScene?.route || '').trim().toLowerCase()
      return (
        routeText === 'ia2v' ||
        routeText === 'ia2v_lipsync' ||
        routeText === 'lip_sync' ||
        routeText === 'lipsync' ||
        routeText.includes('ia2v') ||
        Boolean(selectedScene?.lip_sync_required || selectedScene?.lipSyncRequired)
      )
    })()
  )

  const selectedAssemblyVideoTrimAudioLockedV201A = Boolean(selectedScene && boardSceneAudioDrivenTrimLockedV201A(selectedScene))
  const selectedAssemblyVideoTrimCanUseV201A = Boolean(
    manualSceneToolsEnabled &&
    selectedScene &&
    !selectedSceneTimingLocked &&
    !selectedAssemblyVideoTrimAudioLockedV201A
  )
  const selectedAssemblyVideoTrimRangeV201A = useMemo(
    () => boardSceneVideoTrimRangeV201A(selectedScene || {}),
    [
      selectedScene?.id,
      selectedScene?.scene_id,
      selectedScene?.assemblyVideoDurationSec,
      selectedScene?.assembly_video_duration_sec,
      selectedScene?.assemblyVideoTrimEnabled,
      selectedScene?.assembly_video_trim_enabled,
      selectedScene?.assemblyVideoTrimStartSec,
      selectedScene?.assembly_video_trim_start_sec,
      selectedScene?.assemblyVideoTrimEndSec,
      selectedScene?.assembly_video_trim_end_sec,
    ],
  )

  const timingReturnButtonEnabled = !manualSceneToolsEnabled



  const selectedIndex = useMemo(() => {
    if (!selectedScene) return -1
    const selectedIdV200E = asText(selectedScene.id || selectedScene.scene_id || selectedScene.sceneId)
    return asSceneArray(board.scenes).findIndex((scene) => asText(scene.id || scene.scene_id || scene.sceneId) === selectedIdV200E)
  }, [board.scenes, selectedScene])


  useEffect(() => {
    // AVA_BOARD_MANUAL_LIPSYNC_UPLOAD_V129A:
    // Audio elements cannot send Authorization headers, so after F5 we fetch the
    // protected asset once and play it through a runtime blob URL. This blob is
    // never saved into the board snapshot.
    if (!manualSceneToolsEnabled || !selectedScene || !isIa2vRoute(selectedScene.route)) return undefined
    const sceneId = manualLipSyncSceneIdV129A(selectedScene)
    const source = manualLipSyncAudioSourceV129A(selectedScene)
    if (!sceneId || !source) return undefined
    if (manualLipSyncAudioPreviewUrlsV129A[sceneId]) return undefined

    let cancelled = false
    fetchProtectedBlobUrl(source)
      .then((blobUrl) => {
        if (cancelled || !blobUrl) return
        setManualLipSyncAudioPreviewUrlsV129A((current) => current[sceneId] ? current : { ...current, [sceneId]: blobUrl })
      })
      .catch((error) => {
        console.warn('[Board] manual lip-sync audio preview restore failed', error)
      })

    return () => {
      cancelled = true
    }
  }, [
    manualSceneToolsEnabled,
    selectedScene?.id,
    selectedScene?.scene_id,
    selectedScene?.route,
    selectedScene?.audio_slice_url,
    selectedScene?.audioSliceUrl,
    selectedScene?.audio_slice_api_path,
    selectedScene?.audioSliceApiPath,
    selectedScene?.audio_slice_asset_id,
    selectedScene?.audioSliceAssetId,
    selectedScene?.manual_lipsync_audio_url,
    selectedScene?.manualLipSyncAudioUrl,
  ])


  // AVA_BOARD_SELECTED_SCENE_STRIP_FOCUS_V63:
  // After F5/re-enter the selected scene can be restored in Scene Brain while
  // the horizontal strip stays visually at seg_01. Keep the strip focused on
  // the actual selected scene card.
  useEffect(() => {
    if (loading || !selectedScene?.id) return undefined
    const timer = window.setTimeout(() => {
      const node = sceneCardRefs.current.get(selectedScene.id)
      if (!node) return
      try {
        node.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' })
      } catch {
        node.scrollIntoView(false)
      }
    }, 120)
    return () => window.clearTimeout(timer)
  }, [loading, selectedScene?.id, board.scenes?.length])

  const previousScene = useMemo(() => {
    if (selectedIndex <= 0) return null
    return asSceneArray(board.scenes)[selectedIndex - 1] || null
  }, [board.scenes, selectedIndex])

  const blockScenes = useMemo(() => {
    if (!selectedScene?.blockId) return selectedScene ? [selectedScene] : []
    return asSceneArray(board.scenes).filter((scene) => scene.blockId && scene.blockId === selectedScene.blockId)
  }, [board.scenes, selectedScene])

  useEffect(() => {
    boardRef.current = board
  }, [board])

  // cleanup stale queued scenes without local queue
  useEffect(() => {
    if (loading) return

    // AVA_BOARD_QUEUE_F5_RESTORE_BEFORE_CLEANUP_V58:
    // On F5 localVideoQueueRef is empty. Rebuild it from persisted queued scenes
    // before stale-cleanup, otherwise waiting scenes are cleared and queue never continues.
    const restoredWaitingIds = boardMergeWaitingSceneIdsV57B(
      board,
      board?.video_queue?.waitingSceneIds ||
        board?.videoQueue?.waitingSceneIds ||
        board?.video_queue?.waiting_scene_ids ||
        board?.videoQueue?.waiting_scene_ids ||
        localVideoQueueRef.current ||
        []
    )
    if (restoredWaitingIds.length) {
      localVideoQueueRef.current = restoredWaitingIds
    }

    // AVA_BOARD_QUEUE_F5_KEEP_PERSISTED_WAITING_IDS_V59:
    // Cleanup must protect IDs from the persisted queue snapshot, not only the runtime ref.
    const queuedIds = new Set(boardMergeWaitingSceneIdsV57B(board, localVideoQueueRef.current))
    if (queuedIds.size) {
      localVideoQueueRef.current = Array.from(queuedIds)
    }
    const staleQueued = asSceneArray(board.scenes).filter((scene) => (
      scene.video_status === 'queued' &&
      !scene.video_job_id &&
      !queuedIds.has(scene.id)
    ))
    if (!staleQueued.length) return
    setBoard((current) => ({
      ...current,
      scenes: current.scenes.map((scene) => {
        if (!staleQueued.some((item) => item.id === scene.id)) return scene
        const problems = sceneVideoInputProblems(scene)
        if (problems.length) {
          return {
            ...scene,
            video_status: 'error',
            video_error: problems.join(', '),
            video_queue_position: 0,
          }
        }
        return {
          ...scene,
          video_status: '',
          video_queue_position: 0,
        }
      }),
      updatedAt: new Date().toISOString(),
    }))
  }, [loading, board.scenes])

  useEffect(() => {
    let active = true
    let keepLoadingForTimingImportV162A = false
    async function load() {
      setLoading(true)
      setStatus('Загружаем Storyboard и данные Manual Timing…')
      try {
        const durableKey = boardDurableKey({ projectId, workspaceMode })
        const localBoardData = readBoardDurableBackup(durableKey)

        if (isWorkflowStageCleared('board')) {
          removeBoardDurableBackup(durableKey)
          const clearedBoard = {
            ...emptyBoard,
            source: 'board_cleared',
            importedFrom: 'standalone_board',
            updatedAt: new Date().toISOString(),
          }
          if (!active) return
          setBoard(clearedBoard)
          setStatus('Доска очищена. Нажми “+ Сцена” или “Обновить с тайминга”.')
          setLoading(false)
          return
        }

        // AVA_TIMING_TO_BOARD_NO_EMPTY_OVERWRITE_V36:
        // When Timing already confirmed replacement, the separate import effect below is the source of truth.
        // Do not load/paint/save the old Board here, otherwise first transfer can end as an empty Board.
        if (openedFromTiming && String(boardWorkflowEntry?.source || '') === 'manual_timing_to_board_confirmed_v16') {
          keepLoadingForTimingImportV162A = true
          setStatus('Переносим свежий Тайминг в Доску…')
          setLoading(true)
          return
        }

        const serverBoardData = workspaceMode ? await loadWorkspaceStage(STAGE) : await loadStage(projectId, STAGE)
        const rawBoardData = chooseBoardDataForLoad(serverBoardData, localBoardData)
        const boardData = openedFromTiming || !workspaceMode ? rawBoardData : boardDataForStandaloneEntry(rawBoardData)

        // AVA_BOARD_AUDIO_AUTHORITY_V194B:
        // Do not merge Timing scenes automatically here, but always read the current master audio from Manual Timing.
        // This keeps old scene splits/photos while replacing dead old audio refs from imported packs.
        let timingData = {}
        try {
          const timingStageDataV194B = workspaceMode ? await loadWorkspaceStage('manual_timing') : await loadStage(projectId, 'manual_timing')
          const recoveredAudioV194B = boardAudioFromTiming(timingStageDataV194B?.manualTiming || timingStageDataV194B?.manual_timing || timingStageDataV194B || {})
          if (recoveredAudioV194B) {
            timingData = {
              manualTiming: {
                audio: recoveredAudioV194B,
                audioAssetId: recoveredAudioV194B.assetId || recoveredAudioV194B.asset_id || '',
                audioApiPath: recoveredAudioV194B.assetApiPath || recoveredAudioV194B.asset_api_path || '',
                audioName: recoveredAudioV194B.name || recoveredAudioV194B.audioName || '',
                audioDurationSec: recoveredAudioV194B.durationSec || recoveredAudioV194B.audioDurationSec || 0,
              },
            }
            console.log('[BOARD AUDIO AUTHORITY V194B]', {
              assetId: recoveredAudioV194B.assetId || recoveredAudioV194B.asset_id || '',
              apiPath: recoveredAudioV194B.assetApiPath || recoveredAudioV194B.asset_api_path || '',
              name: recoveredAudioV194B.name || recoveredAudioV194B.audioName || '',
            })
          }
        } catch (timingAudioRestoreErrorV194B) {
          console.warn('[BOARD AUDIO AUTHORITY V194B] failed to load Manual Timing audio', timingAudioRestoreErrorV194B)
        }

        if (!active) return
        // AVA09D2_STANDALONE_BOARD_DOES_NOT_PULL_TIMING
        let nextBoard = buildBoardFromTiming(timingData, boardData)
        if (!workspaceMode) {
          nextBoard = {
            ...nextBoard,
            source: nextBoard.source === 'standalone_board' ? 'project_board' : (nextBoard.source || 'project_board'),
          }
        }
        const hydratedCompleted = applyCompletedJobsToBoard(nextBoard, { projectId: projectId || '', workspaceMode })
        nextBoard = hydratedCompleted.board
        // AVA_BOARD_LOAD_FORCE_SERVER_VIDEO_REHYDRATE_V132W:
        // buildBoardFromTiming/normalization can rebuild scene objects from older local data.
        // On project Board entry, merge backend video/result/review refs again after the rebuild.
        if (!workspaceMode && serverBoardData && Array.isArray(serverBoardData.scenes) && boardVideoStateScoreV131N(serverBoardData) > 0) {
          const beforeScoreV132W = boardVideoStateScoreV131N(nextBoard)
          nextBoard = boardMergeServerVideoStateV131N(nextBoard, serverBoardData)
          const afterScoreV132W = boardVideoStateScoreV131N(nextBoard)
          if (afterScoreV132W >= beforeScoreV132W) {
            writeBoardDurableBackup(durableKey, nextBoard)
          }
          console.log('[BOARD LOAD SERVER VIDEO REHYDRATE V132W]', {
            beforeScore: beforeScoreV132W,
            afterScore: afterScoreV132W,
            serverScore: boardVideoStateScoreV131N(serverBoardData),
          })
        }

        if (!workspaceMode && serverBoardData && Array.isArray(serverBoardData.scenes) && boardImageStateScoreV145A(serverBoardData) > 0) {
          const beforeScoreV145A = boardImageStateScoreV145A(nextBoard)
          nextBoard = boardMergeServerImageStateV145A(nextBoard, serverBoardData)
          const afterScoreV145A = boardImageStateScoreV145A(nextBoard)
          if (afterScoreV145A >= beforeScoreV145A) {
            writeBoardDurableBackup(durableKey, nextBoard)
          }
          console.log('[BOARD LOAD SERVER IMAGE REHYDRATE V145A]', {
            beforeScore: beforeScoreV145A,
            afterScore: afterScoreV145A,
            serverScore: boardImageStateScoreV145A(serverBoardData),
          })
        }
        nextBoard = normalizeLoadedBoardVideoStatuses(nextBoard)
        if (hydratedCompleted.usedKeys.length) {
          const used = new Set(hydratedCompleted.usedKeys)
          writeAvaCompletedJobs(readAvaCompletedJobs().filter((job) => !used.has(job.key)))
          setStatus(`Подтянуты готовые job: ${hydratedCompleted.usedKeys.length}`)
        }
        const pendingOpenSceneId = sessionStorage.getItem(AVA_OPEN_BOARD_SCENE_KEY) || ''
        if (pendingOpenSceneId && nextBoard.scenes.some((scene) => scene.id === pendingOpenSceneId || scene.scene_id === pendingOpenSceneId)) {
          nextBoard = { ...nextBoard, selectedSceneId: pendingOpenSceneId }
          sessionStorage.removeItem(AVA_OPEN_BOARD_SCENE_KEY)
        }
        skipNextBoardAutosaveRefV145A.current = true
        setBoard(nextBoard)
        rehydrateBadRegenRuntimeFromServerBatchV136J(
          nextBoard?.board_video_batch || nextBoard?.boardVideoBatch || {},
          nextBoard,
          { source: 'initial_snapshot_load_v136j' }
        )
        if (!workspaceMode && projectId) {
          apiRequest(`/projects/${projectId}/board/video-batch/status`)
            .then((batchStatusDataV136J) => {
              if (!active) return
              rehydrateBadRegenRuntimeFromServerBatchV136J(
                batchStatusDataV136J?.batch || batchStatusDataV136J?.board_video_batch || {},
                boardRef.current || nextBoard,
                { source: 'initial_status_endpoint_v136j' }
              )
              const boardFromInitialBatchV200I = batchStatusDataV136J?.board || batchStatusDataV136J?.snapshot || batchStatusDataV136J?.board_snapshot || null
              if (boardFromInitialBatchV200I && Array.isArray(boardFromInitialBatchV200I.scenes)) {
                setBoard((current) => {
                  const merged = boardMergeServerVideoStateV131N(current || boardRef.current || nextBoard, boardFromInitialBatchV200I)
                  if (merged === current) return current
                  writeBoardDurableBackup(durableKey, merged)
                  return merged
                })
              }
            })
            .catch((error) => console.warn('[BOARD BAD REGEN F5 RUNTIME REHYDRATE V136J] initial status failed', error))
        }
        setStatus(openedFromTiming
          ? 'Открыта старая Доска. Подтверди перенос из Тайминга, чтобы заменить сцены и аудио.'
          : (nextBoard.scenes.length ? 'Storyboard загружен' : 'Сцен пока нет — импортируй JSON или вернись в Тайминг')) // AVA_TIMING_TO_BOARD_CONFIRM_STATUS_V14B
      } catch (err) {
        if (!active) return
        setStatus(`Ошибка загрузки Storyboard: ${err.message}`)
      } finally {
        if (active && !keepLoadingForTimingImportV162A) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [projectId, workspaceMode])

  useEffect(() => {
    // AVA_BOARD_SERVER_BATCH_REFRESH_UI_V131N:
    // While backend server batch is rendering, Board must periodically pull the project
    // snapshot and merge server video refs/statuses into React state. This is deliberately
    // independent from old /clip/video/status browser pollers.
    if (workspaceMode || !projectId) return undefined
    if (!boardBatchRefreshShouldRunV200M()) return undefined

    let cancelled = false
    let timer = null

    const tick = async () => {
      try {
        let batchStatusDataV136J = null
        try {
          batchStatusDataV136J = await apiRequest(`/projects/${projectId}/board/video-batch/status`)
        } catch (statusErrorV136J) {
          console.warn('[BOARD BAD REGEN F5 RUNTIME REHYDRATE V136J] status endpoint failed', statusErrorV136J)
        }

        // AVA_BOARD_BATCH_STATUS_BOARD_APPLY_V200I:
        // If backend cleaned stale jobs inside /board/video-batch/status, use that
        // returned board immediately instead of waiting for another snapshot pass.
        const boardFromBatchStatusV200I = batchStatusDataV136J?.board || batchStatusDataV136J?.snapshot || batchStatusDataV136J?.board_snapshot || null
        const serverBoardData = (boardFromBatchStatusV200I && Array.isArray(boardFromBatchStatusV200I.scenes))
          ? boardFromBatchStatusV200I
          : await loadStage(projectId, STAGE)
        if (cancelled || !serverBoardData || !Array.isArray(serverBoardData.scenes)) return
        const orphanCleanedV200E = Boolean(
          batchStatusDataV136J?.orphanCleaned ||
          batchStatusDataV136J?.orphan_cleaned ||
          String((batchStatusDataV136J?.batch || batchStatusDataV136J?.board_video_batch || {}).status || '').includes('interrupted_after_backend_reload')
        )
        if (orphanCleanedV200E) {
          boardRef.current = serverBoardData
          setBoard(serverBoardData)
          writeBoardDurableBackup(boardDurableKey({ projectId, workspaceMode }), serverBoardData)
          console.log('[BOARD SERVER BATCH ORPHAN MERGE V200E]', { projectId })
          return
        }
        rehydrateBadRegenRuntimeFromServerBatchV136J(
          batchStatusDataV136J?.batch || batchStatusDataV136J?.board_video_batch || serverBoardData?.board_video_batch || serverBoardData?.boardVideoBatch || {},
          serverBoardData,
          { source: 'server_batch_refresh_status_v136j' }
        )
        reconcileBadRegenRuntimeWithBoardV136I(serverBoardData)
        const serverScore = boardVideoStateScoreV131N(serverBoardData)
        const localScore = boardVideoStateScoreV131N(boardRef.current || board)
        const batchForMergeV200L = batchStatusDataV136J?.batch || batchStatusDataV136J?.board_video_batch || serverBoardData?.board_video_batch || serverBoardData?.boardVideoBatch || {}
        const batchStatusForMergeV200L = String(batchForMergeV200L?.status || batchForMergeV200L?.batch_status || '').toLowerCase()
        // AVA_BOARD_BATCH_DONE_RUNTIME_CLEAR_V200M:
        // Server has finished or canceled the batch. Runtime-only badges must not
        // continue to paint cards as "видео делается" / "в очереди" after backend
        // already wrote the final board snapshot.
        const batchDoneV200M = ['finished', 'finished_with_errors', 'failed', 'error', 'canceled', 'cancelled', 'stopped'].includes(batchStatusForMergeV200L)
        if (batchDoneV200M) {
          const idsToClearV200M = Array.from(new Set([
            ...asArray(batchForMergeV200L?.completedSceneIds || batchForMergeV200L?.completed_scene_ids),
            ...asArray(batchForMergeV200L?.failedSceneIds || batchForMergeV200L?.failed_scene_ids),
            ...asArray(batchForMergeV200L?.waitingSceneIds || batchForMergeV200L?.waiting_scene_ids),
            ...asArray(batchForMergeV200L?.queuedSceneIds || batchForMergeV200L?.queued_scene_ids),
            batchForMergeV200L?.activeSceneId || batchForMergeV200L?.active_scene_id,
            ...Object.keys(badRegenRuntimeStatusRef.current || {}),
          ].map((id) => asText(id)).filter(Boolean)))
          if (idsToClearV200M.length) clearBadRegenRuntimeStatusesV136I(idsToClearV200M)
          setAutoVideoQueueState((current) => current?.serverBatchActive
            ? { ...(current || {}), active: false, serverBatchActive: false, queued: 0 }
            : current
          )
          if (typeof window !== 'undefined') window.__AVA_BOARD_SERVER_VIDEO_BATCH_ACTIVE__ = false
        }
        const batchHasLiveStateV200L = Boolean(
          boardNeedsServerBatchRefreshV131N(serverBoardData) ||
          badRegenRuntimeBatchActiveStatusesV136J.has(batchStatusForMergeV200L) ||
          ['finished', 'finished_with_errors', 'canceled', 'cancelled'].includes(batchStatusForMergeV200L) ||
          asArray(batchForMergeV200L?.completedSceneIds || batchForMergeV200L?.completed_scene_ids).length ||
          asArray(batchForMergeV200L?.failedSceneIds || batchForMergeV200L?.failed_scene_ids).length
        )
        // AVA_BOARD_BATCH_LIVE_STATUS_MERGE_V200L:
        // During server-batch regeneration the backend snapshot is authoritative even when
        // the score heuristic is equal/lower because the local scene may still contain
        // old runtime queued/running overlays or an old bad review event.
        if (batchHasLiveStateV200L || serverScore > localScore) {
          setBoard((current) => {
            const merged = boardMergeServerVideoStateV131N(current || boardRef.current || board, serverBoardData)
            if (merged === current) return current
            writeBoardDurableBackup(boardDurableKey({ projectId, workspaceMode }), merged)
            return merged
          })
        }
      } catch (error) {
        console.warn('[BOARD SERVER BATCH REFRESH V131N] failed', error)
      } finally {
        if (!cancelled && boardBatchRefreshShouldRunV200M()) timer = window.setTimeout(tick, 2500)
      }
    }

    timer = window.setTimeout(tick, 1800)
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [projectId, workspaceMode, loadStage, boardServerBatchPollTokenV200E(board)])


  useEffect(() => {
    let cancelled = false
    let objectUrl = ''
    async function loadAudio() {
      setAudioSrc('')
      const apiPath = board.audio?.assetApiPath || board.audio?.asset_api_path || board.audioApiPath || ''
      if (!apiPath) return
      try {
        objectUrl = await fetchProtectedBlobUrl(apiPath)
        if (!cancelled) setAudioSrc(objectUrl)
      } catch (err) {
        if (!cancelled) {
          setStatus(`Аудио preview недоступен: ${err.message}`)
          // AVA_BOARD_AUDIO_PREVIEW_FALLBACK_V194B:
          // If a stale imported audio ref 404s, recover from the current Manual Timing master audio.
          if (!workspaceMode && projectId) {
            try {
              const timingStageDataV194B = await loadStage(projectId, 'manual_timing')
              const recoveredAudioV194B = boardAudioFromTiming(timingStageDataV194B?.manualTiming || timingStageDataV194B?.manual_timing || timingStageDataV194B || {})
              const recoveredApiPathV194B = recoveredAudioV194B?.assetApiPath || recoveredAudioV194B?.asset_api_path || ''
              if (recoveredApiPathV194B && recoveredApiPathV194B !== apiPath) {
                setBoard((current) => ({
                  ...current,
                  audio: recoveredAudioV194B,
                  audioAssetId: recoveredAudioV194B.assetId || recoveredAudioV194B.asset_id || '',
                  audio_asset_id: recoveredAudioV194B.assetId || recoveredAudioV194B.asset_id || '',
                  audioApiPath: recoveredApiPathV194B,
                  audio_api_path: recoveredApiPathV194B,
                  audioName: recoveredAudioV194B.name || recoveredAudioV194B.audioName || '',
                  audio_name: recoveredAudioV194B.name || recoveredAudioV194B.audioName || '',
                  audioDurationSec: recoveredAudioV194B.durationSec || recoveredAudioV194B.audioDurationSec || 0,
                  audio_duration_sec: recoveredAudioV194B.durationSec || recoveredAudioV194B.audioDurationSec || 0,
                  updatedAt: new Date().toISOString(),
                }))
                console.log('[BOARD AUDIO PREVIEW FALLBACK V194B]', { from: apiPath, to: recoveredApiPathV194B })
              }
            } catch (fallbackErrorV194B) {
              console.warn('[BOARD AUDIO PREVIEW FALLBACK V194B] failed', fallbackErrorV194B)
            }
          }
        }
      }
    }
    loadAudio()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [board.audio?.assetApiPath, board.audio?.asset_api_path, board.audioApiPath])

  useEffect(() => {
    if (loading) return undefined
    const slots = [
      { slot: 'video', kind: 'video', stage: 'board_videos' },
      { slot: 'image', kind: 'image', stage: 'board_images' },
      { slot: 'first', kind: 'image', stage: 'board_images' },
      { slot: 'last', kind: 'image', stage: 'board_images' },
    ]
    const candidates = asSceneArray(board.scenes).flatMap((scene) => slots.map((def) => ({
      ...def,
      scene,
      staticUrl: sceneStaticMediaCandidate(scene, def.slot),
      apiPath: sceneMediaFieldValue(scene, def.slot, 'apiPath'),
    })))
      .filter(({ staticUrl, apiPath }) => staticUrl && !isProtectedBoardAssetApiPath(apiPath))
      .slice(0, 8)
    if (!candidates.length) return undefined

    let cancelled = false
    async function repair() {
      console.log('[BOARD MEDIA RESTORE START]', { count: candidates.length })
      const patchesBySceneId = {}
      for (const { scene, staticUrl, slot, kind, stage } of candidates) {
        const sceneId = scene.id || scene.scene_id
        const key = `${sceneId}:${slot}:${staticUrl}`
        if (staticAssetRepairRef.current.has(key)) continue
        staticAssetRepairRef.current.add(key)
        try {
          console.log(kind === 'video' ? '[BOARD VIDEO STATIC REGISTER]' : '[BOARD IMAGE STATIC REGISTER]', { sceneId, slot, sourceField: 'staticUrl', staticUrl })
          const asset = await registerStaticMediaAsset({
            url: staticUrl,
            projectId: workspaceMode ? null : projectId,
            kind,
            stage,
            originalName: scene.video_name || scene.videoName || scene.mmaudio_video_name || scene.mmaudioVideoName || scene.image_name || scene.first_frame_name || scene.last_frame_name || '',
            sceneId,
          })
          if (cancelled) return
          const assetId = asset.asset_id || asset.assetId || ''
          const assetApiPath = asset.asset_api_path || asset.assetApiPath || ''
          const patch = slot === 'video' && (scene.mmaudio_video_url || scene.mmaudioVideoUrl)
            ? {
                mmaudio_video_asset_id: assetId,
                mmaudioVideoAssetId: assetId,
                mmaudio_video_api_path: assetApiPath,
                mmaudioVideoApiPath: assetApiPath,
              }
            : slot === 'video' ? {
                video_asset_id: assetId,
                videoAssetId: assetId,
                video_api_path: assetApiPath,
                videoApiPath: assetApiPath,
                video_url: assetApiPath,
                videoUrl: assetApiPath,
              }
            : slot === 'first' ? {
                first_image_asset_id: assetId,
                firstImageAssetId: assetId,
                first_image_api_path: assetApiPath,
                firstImageApiPath: assetApiPath,
                first_frame_api_path: assetApiPath,
                firstFrameApiPath: assetApiPath,
              }
            : slot === 'last' ? {
                last_image_asset_id: assetId,
                lastImageAssetId: assetId,
                last_image_api_path: assetApiPath,
                lastImageApiPath: assetApiPath,
                last_frame_api_path: assetApiPath,
                lastFrameApiPath: assetApiPath,
              }
            : {
                image_asset_id: assetId,
                imageAssetId: assetId,
                image_api_path: assetApiPath,
                imageApiPath: assetApiPath,
              }
          patchesBySceneId[sceneId] = {
            ...(patchesBySceneId[sceneId] || {}),
            ...patch,
          }
          console.log('[BOARD MEDIA RESTORE DONE]', { sceneId, slot, assetId, apiPath: assetApiPath, sourceField: 'staticUrl', success: true })
        } catch (error) {
          console.warn('[BOARD MEDIA RESTORE DONE]', { sceneId, slot, sourceField: 'staticUrl', success: false, error: error?.message || error })
        }
      }
      if (cancelled || !Object.keys(patchesBySceneId).length) return
      let nextBoardForSave = null
      setBoard((current) => {
        const scenes = asSceneArray(current.scenes).map((scene) => {
          const sceneId = scene.id || scene.scene_id
          const patch = patchesBySceneId[sceneId]
          if (!patch) return scene
          return mergePreserveMediaRefs(scene, { ...scene, ...patch })
        })
        nextBoardForSave = {
          ...current,
          scenes,
          updatedAt: new Date().toISOString(),
        }
        return nextBoardForSave
      })
      window.setTimeout(() => {
        if (nextBoardForSave) saveBoard(nextBoardForSave, true)
      }, 0)
    }
    repair()
    return () => { cancelled = true }
  }, [loading, board.scenes, projectId, workspaceMode])

  const selectedPreviewAssetApiPath = scenePreviewAssetApiPath(selectedScene)

  useEffect(() => {
    let cancelled = false
    setSelectedVideoLoadError('')
    if (!selectedPreviewAssetApiPath) {
      setSelectedVideoBlobUrl('')
      return undefined
    }

    const cacheKey = boardAssetApiPathFromRef(selectedPreviewAssetApiPath) || selectedPreviewAssetApiPath
    const cachedUrl = videoBlobUrlCacheRefV200C.current.get(cacheKey)
    if (cachedUrl) {
      setSelectedVideoBlobUrl(cachedUrl)
      return undefined
    }

    setSelectedVideoBlobUrl('')

    async function loadVideoBlob() {
      try {
        const objectUrl = await fetchProtectedBlobUrl(selectedPreviewAssetApiPath)
        if (cancelled) {
          URL.revokeObjectURL(objectUrl)
          return
        }
        videoBlobUrlCacheRefV200C.current.set(cacheKey, objectUrl)
        setSelectedVideoBlobUrl(objectUrl)
      } catch (error) {
        if (!cancelled) {
          const message = error?.message || 'asset_fetch_failed'
          setSelectedVideoLoadError(message)
          setStatus(`Видео preview недоступен: ${message}`)
        }
      }
    }
    loadVideoBlob()
    return () => {
      cancelled = true
      // AVA_BOARD_SPEED_CACHE_NOOP_V200C: keep cached video blobs across scene switches.
      // Revoke only when the Board page is closed.
    }
  }, [selectedPreviewAssetApiPath])

  useEffect(() => {
    return () => {
      videoBlobUrlCacheRefV200C.current.forEach((objectUrl) => {
        try { URL.revokeObjectURL(objectUrl) } catch { /* ignore */ }
      })
      videoBlobUrlCacheRefV200C.current.clear()
    }
  }, [])



  // AVA_BOARD_RESTORE_NO_GLOBAL_ASSET_WARM_V200J:
  // Do not blob-prefetch every image/first/last asset for every scene on Board F5.
  // That burst created many OPTIONS /api/assets/... preflights and made restore feel frozen.
  // Only the selected-scene image restore effect below is allowed to fetch protected blobs.
  useEffect(() => {
    return undefined
  }, [loading, board.scenes])

  useEffect(() => {
    let cancelled = false
    const sceneId = selectedScene?.id || selectedScene?.scene_id || ''
    if (!sceneId) return undefined

    async function loadSelectedImageBlobs() {
      const runtime = runtimeSceneMediaUrls[sceneId] || {}
      // AVA_BOARD_SELECTED_IMAGE_RESTORE_SKIP_READY_V200J:
      // During F5 the selected scene can be restored twice while Board and Timing snapshots race.
      // Do not refetch protected blobs if the runtime preview is already present.
      if (runtime.image || runtime.first || runtime.last) return
      const entries = [
        { slot: 'image', apiPath: sceneMediaFieldValue(selectedScene, 'image', 'apiPath'), cleared: runtime.imageClearedV129O },
        { slot: 'first', apiPath: sceneMediaFieldValue(selectedScene, 'first', 'apiPath'), cleared: runtime.firstClearedV129O },
        { slot: 'last', apiPath: sceneMediaFieldValue(selectedScene, 'last', 'apiPath'), cleared: runtime.lastClearedV129O },
      ].filter((entry) => entry.apiPath && !entry.cleared)

      if (!entries.length) return
      const next = {}
      for (const entry of entries) {
        try {
          const cacheKey = boardAssetApiPathFromRef(entry.apiPath) || entry.apiPath
          const cached = imageBlobUrlCacheRefV129O.current.get(cacheKey)
          if (cached) {
            next[entry.slot] = cached
            continue
          }
          console.log('[BOARD IMAGE ASSET RESTORE]', { sceneId, slot: entry.slot, apiPath: entry.apiPath, sourceField: 'apiPath', cache: 'miss' })
          const objectUrl = await fetchProtectedBlobUrl(entry.apiPath)
          imageBlobUrlCacheRefV129O.current.set(cacheKey, objectUrl)
          next[entry.slot] = objectUrl
        } catch (error) {
          console.warn('[BOARD MEDIA RESTORE DONE]', { sceneId, slot: entry.slot, apiPath: entry.apiPath, sourceField: 'apiPath', success: false, error: error?.message || error })
        }
      }
      if (!cancelled && Object.keys(next).length) {
        setRuntimeSceneMediaUrls((current) => ({
          ...current,
          [sceneId]: {
            ...(current[sceneId] || {}),
            ...next,
          },
        }))
        console.log('[BOARD MEDIA RESTORE DONE]', { sceneId, slots: Object.keys(next), success: true, cache: 'v129o' })
      }
    }

    loadSelectedImageBlobs()
    return () => {
      cancelled = true
      // Do not revoke cached image blob URLs on scene switch. Re-fetching every scene
      // was the reason photos appeared to load again and again.
    }
  }, [
    selectedScene?.id,
    selectedScene?.scene_id,
    selectedScene?.image_api_path,
    selectedScene?.imageApiPath,
    selectedScene?.first_image_api_path,
    selectedScene?.firstImageApiPath,
    selectedScene?.last_image_api_path,
    selectedScene?.lastImageApiPath,
    runtimeSceneMediaUrls[selectedScene?.id || selectedScene?.scene_id || '']?.imageClearedV129O,
    runtimeSceneMediaUrls[selectedScene?.id || selectedScene?.scene_id || '']?.firstClearedV129O,
    runtimeSceneMediaUrls[selectedScene?.id || selectedScene?.scene_id || '']?.lastClearedV129O,
  ])

  useEffect(() => {
    if (loading) return undefined

    // AVA09C_FAST_LOCAL_BOARD_BACKUP_EFFECT:
    // local backup must be immediate; backend save can still be delayed.
    writeBoardDurableBackup(boardDurableKey({ projectId, workspaceMode }), {
      ...board,
      boardVersion: BOARD_VERSION,
      updatedAt: board?.updatedAt || new Date().toISOString(),
    })

    const autosaveFingerprintV200C = boardAutosaveFingerprintV200C(board)

    if (skipNextBoardAutosaveRefV145A.current) {
      skipNextBoardAutosaveRefV145A.current = false
      lastBoardAutosaveFingerprintRefV200C.current = autosaveFingerprintV200C
      console.log('[BOARD F5 INITIAL AUTOSAVE SKIPPED V145A]', { projectId: projectId || '', workspaceMode })
      return undefined
    }

    if (lastBoardAutosaveFingerprintRefV200C.current === autosaveFingerprintV200C) {
      console.log('[BOARD AUTOSAVE UI-ONLY SKIPPED V200C]', { projectId: projectId || '', workspaceMode })
      return undefined
    }

    const timer = window.setTimeout(() => {
      saveBoard(board, true).then(() => {
        lastBoardAutosaveFingerprintRefV200C.current = autosaveFingerprintV200C
      })
    }, 900)
    return () => window.clearTimeout(timer)
  }, [loading, board, projectId, workspaceMode])


  // AVA_BOARD_QUEUE_RESTORE_NO_UPDATE_PATCH_V57B:
  // Restore waiting queue after F5/re-enter. If active job is gone/finished and waiting scenes remain,
  // start exactly one queued scene.
  useEffect(() => {
    if (loading) return undefined

    const waitingIds = boardMergeWaitingSceneIdsV57B(
      board,
      board?.video_queue?.waitingSceneIds ||
        board?.videoQueue?.waitingSceneIds ||
        board?.video_queue?.waiting_scene_ids ||
        board?.videoQueue?.waiting_scene_ids ||
        localVideoQueueRef.current ||
        []
    )

    if (waitingIds.length) {
      localVideoQueueRef.current = waitingIds
      // AVA_BOARD_QUEUE_F5_KEEP_PERSISTED_WAITING_IDS_V59:
      // Restore visible "В очереди" badges immediately after F5, even while another job is active.
      syncQueuedSceneBadges()
    }

    if (!waitingIds.length || activeBoardVideoScene(board)) return undefined

    const timer = window.setTimeout(() => {
      const liveBoard = boardRef.current
      if (activeBoardVideoScene(liveBoard)) return
      localVideoQueueRef.current = boardMergeWaitingSceneIdsV57B(liveBoard, localVideoQueueRef.current)
      syncQueuedSceneBadges()
      processNextQueuedBoardVideo()
    }, 350)

    return () => window.clearTimeout(timer)
  }, [loading, board])

  useEffect(() => {
    if (loading) return undefined
    board.scenes.forEach((scene) => {
      const status = String(scene.video_status || scene.videoStatus || '').toLowerCase()
      if (!['queued', 'preparing', 'submitting', 'running', 'starting', 'queued_no_prompt_id'].includes(status)) return
      const sceneIdV200E = asText(scene.id || scene.scene_id || scene.sceneId)
      const jobIdV200E = asText(scene.video_job_id || scene.videoJobId)
      const endpoint = scene.video_status_endpoint || scene.videoStatusEndpoint || (jobIdV200E ? `/api/clip/video/status/${jobIdV200E}` : '')
      if (!sceneIdV200E || !endpoint) return
      pollBoardVideoJob(sceneIdV200E, endpoint, jobIdV200E)
    })
    return undefined
    // run only after initial load or project switch; polling updates scene statuses itself
  }, [loading, projectId, workspaceMode])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return undefined
    function handleTimeUpdate() {
      if (!playback) return
      if (audio.currentTime >= playback.end) {
        audio.pause()
        setPlayback(null)
      }
    }
    function handleEnded() {
      setPlayback(null)
    }
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [playback])


  // AVA_BOARD_SAVE_ACTIVE_JOB_SANITIZE_V55:
  // Final saveBoard gate: an active video job must never be saved with old generated video refs.
  // This fixes ready-scene regeneration where preserve/canonicalize layers restored previous video.
  function sanitizeBoardActiveVideoJobsForSaveV55(boardData = {}) {
    const scenes = asSceneArray(boardData?.scenes)
    if (!scenes.length) return boardData

    let changed = false
    const activeStatuses = new Set(['starting', 'queued', 'preparing', 'submitting', 'running', 'queued_no_prompt_id'])
    const clearGeneratedRefs = (scene) => {
      const status = String(scene?.video_status || scene?.videoStatus || '').toLowerCase()
      const hasJob = Boolean(scene?.video_job_id || scene?.videoJobId || scene?.video_status_endpoint || scene?.videoStatusEndpoint)
      if (!hasJob || !activeStatuses.has(status)) return scene

      const next = {
        ...scene,

        video_asset_id: '',
        videoAssetId: '',
        video_api_path: '',
        videoApiPath: '',
        video_url: '',
        videoUrl: '',
        video_name: '',
        videoName: '',
        video_result: null,
        videoResult: null,

        result_url: '',
        resultUrl: '',
        result_video_url: '',
        resultVideoUrl: '',
        result_video_api_path: '',
        resultVideoApiPath: '',
        result_video_asset_id: '',
        resultVideoAssetId: '',
        result_video_name: '',
        resultVideoName: '',

        original_video_url: '',
        originalVideoUrl: '',
        video_ready_at: '',
        videoReadyAt: '',

        mmaudio_video_asset_id: '',
        mmaudioVideoAssetId: '',
        mmaudio_video_api_path: '',
        mmaudioVideoApiPath: '',
        mmaudio_video_url: '',
        mmaudioVideoUrl: '',
        mmaudio_video_name: '',
        mmaudioVideoName: '',
        mmaudio_result: null,
        mmaudioResult: null,
        mmaudio_result_video_url: '',
        mmaudioResultVideoUrl: '',
        mmaudio_result_video_api_path: '',
        mmaudioResultVideoApiPath: '',
        mmaudio_result_video_asset_id: '',
        mmaudioResultVideoAssetId: '',
        mmaudio_ready_at: '',
        mmaudioReadyAt: '',
        mmaudio_source_video_url: '',
        mmaudioSourceVideoUrl: '',
        mmaudio_source_video_api_path: '',
        mmaudioSourceVideoApiPath: '',
        mmaudio_reset_reason: 'active_video_save_sanitize_v55',
        mmaudioResetReason: 'active_video_save_sanitize_v55',
      }

      if (
        scene.video_asset_id || scene.videoAssetId ||
        scene.video_api_path || scene.videoApiPath ||
        scene.video_url || scene.videoUrl ||
        scene.video_name || scene.videoName ||
        scene.resultUrl || scene.result_url || scene.resultVideoUrl || scene.result_video_url ||
        scene.mmaudio_video_api_path || scene.mmaudioVideoApiPath ||
        scene.mmaudio_video_url || scene.mmaudioVideoUrl
      ) {
        changed = true
      }
      return next
    }

    const nextScenes = scenes.map(clearGeneratedRefs)
    if (!changed) return boardData
    return {
      ...boardData,
      scenes: nextScenes,
      updatedAt: new Date().toISOString(),
    }
  }


  // AVA_BOARD_REPLACE_SAVE_ACTIVE_VIDEO_JOBS_V56:
  // Project saveStage(..., 'safe_merge') can preserve old media refs from the previous snapshot.
  // For active video regeneration, payload already contains a full Board snapshot, so use replace
  // to prevent backend safe_merge from restoring stale video_api_path/video_asset_id.
  function boardHasActiveVideoJobsForReplaceSaveV56(boardData = {}) {
    const activeStatuses = new Set(['starting', 'queued', 'preparing', 'submitting', 'running', 'queued_no_prompt_id'])
    return asSceneArray(boardData?.scenes).some((scene) => {
      const status = String(scene?.video_status || scene?.videoStatus || '').toLowerCase()
      const hasJob = Boolean(scene?.video_job_id || scene?.videoJobId || scene?.video_status_endpoint || scene?.videoStatusEndpoint)
      const resetReason = String(scene?.video_reset_reason || scene?.videoResetReason || '').toLowerCase()
      const isExplicitRegeneration = Boolean(
        scene?.video_regeneration_started_v155a ||
        scene?.videoRegenerationStartedV155A ||
        scene?.video_review_regenerate_from_bad ||
        scene?.videoReviewRegenerateFromBad ||
        resetReason.includes('regenerate') ||
        resetReason.includes('regeneration') ||
        resetReason.includes('restarting')
      )
      return activeStatuses.has(status) && (hasJob || isExplicitRegeneration || status === 'starting')
    })
  }

  // AVA_BOARD_STILLS_CACHE_RACE_V129O:
  // Image media changes can race with old polling/status saves.  When a newer
  // image mutation exists in live board state, force every save payload to carry
  // that newer image/delete state instead of an older delayed snapshot.
  const BOARD_IMAGE_MUTATION_KEYS_V129O = [
    'image_mutation_at', 'imageMutationAt', 'image_mutation_epoch', 'imageMutationEpoch',
    'image_deleted_v129o', 'imageDeletedV129O', 'first_image_deleted_v129o', 'firstImageDeletedV129O',
    'last_image_deleted_v129o', 'lastImageDeletedV129O', 'mediaMutationReplaceSave', 'saveMode',
  ]

  const BOARD_IMAGE_MEDIA_AND_RESULT_KEYS_V129O = [
    'image_url', 'imageUrl', 'image_name', 'imageName', 'image_data_url', 'imageDataUrl',
    'image_asset_id', 'imageAssetId', 'image_api_path', 'imageApiPath', 'image_status', 'imageStatus',
    'mediaUrl', 'media_url',
    'first_frame_url', 'firstFrameUrl', 'first_frame_name', 'firstFrameName', 'first_frame_api_path', 'firstFrameApiPath',
    'first_image_url', 'firstImageUrl', 'first_image_name', 'firstImageName', 'first_image_asset_id', 'firstImageAssetId', 'first_image_api_path', 'firstImageApiPath',
    'start_image_url', 'startImageUrl', 'start_image_name', 'startImageName', 'start_image_data_url', 'startImageDataUrl', 'start_image_asset_id', 'startImageAssetId', 'start_image_api_path', 'startImageApiPath',
    'last_frame_url', 'lastFrameUrl', 'last_frame_name', 'lastFrameName', 'last_frame_api_path', 'lastFrameApiPath',
    'last_image_url', 'lastImageUrl', 'last_image_name', 'lastImageName', 'last_image_asset_id', 'lastImageAssetId', 'last_image_api_path', 'lastImageApiPath',
    'end_image_url', 'endImageUrl', 'end_image_name', 'endImageName', 'end_image_data_url', 'endImageDataUrl', 'end_image_asset_id', 'endImageAssetId', 'end_image_api_path', 'endImageApiPath',
    'video_status', 'videoStatus', 'video_error', 'videoError', 'video_job_id', 'videoJobId', 'video_status_endpoint', 'videoStatusEndpoint', 'video_queue_position', 'videoQueuePosition',
    'video_url', 'videoUrl', 'video_api_path', 'videoApiPath', 'video_name', 'videoName', 'video_asset_id', 'videoAssetId', 'video_result', 'videoResult', 'video_ready_at', 'videoReadyAt',
    'original_video_url', 'originalVideoUrl', 'result_url', 'resultUrl', 'result_video_url', 'resultVideoUrl', 'result_video_api_path', 'resultVideoApiPath', 'result_video_asset_id', 'resultVideoAssetId', 'result_video_name', 'resultVideoName',
    'mmaudio_status', 'mmaudioStatus', 'mmaudio_error', 'mmaudioError', 'mmaudio_job_id', 'mmaudioJobId', 'mmaudio_status_endpoint', 'mmaudioStatusEndpoint',
    'mmaudio_video_url', 'mmaudioVideoUrl', 'mmaudio_video_api_path', 'mmaudioVideoApiPath', 'mmaudio_video_name', 'mmaudioVideoName', 'mmaudio_video_asset_id', 'mmaudioVideoAssetId',
    'mmaudio_result_video_url', 'mmaudioResultVideoUrl', 'mmaudio_result_video_api_path', 'mmaudioResultVideoApiPath', 'mmaudio_result_video_asset_id', 'mmaudioResultVideoAssetId',
    'mmaudio_result', 'mmaudioResult', 'mmaudio_ready_at', 'mmaudioReadyAt', 'mmaudio_source_video_url', 'mmaudioSourceVideoUrl', 'mmaudio_source_video_api_path', 'mmaudioSourceVideoApiPath',
    'mmaudio_reset_reason', 'mmaudioResetReason', 'video_source_image_debug',
    ...BOARD_IMAGE_MUTATION_KEYS_V129O,
  ]

  function boardImageMutationEpochV129O(scene = {}) {
    const direct = Number(scene?.image_mutation_epoch ?? scene?.imageMutationEpoch ?? 0)
    if (Number.isFinite(direct) && direct > 0) return direct
    const parsed = Date.parse(scene?.image_mutation_at || scene?.imageMutationAt || '') || 0
    return parsed
  }

  function boardCopyImageMutationStateV129O(target = {}, source = {}) {
    const next = { ...(target || {}) }
    for (const key of BOARD_IMAGE_MEDIA_AND_RESULT_KEYS_V129O) {
      if (Object.prototype.hasOwnProperty.call(source || {}, key)) next[key] = source[key]
    }
    return next
  }

  function boardProtectRecentImageMutationsForSaveV129O(nextBoard = {}, liveBoard = {}) {
    const nextScenes = asSceneArray(nextBoard?.scenes)
    const liveScenes = asSceneArray(liveBoard?.scenes)
    if (!nextScenes.length || !liveScenes.length) return nextBoard

    const liveById = new Map(liveScenes.map((scene) => [asText(scene?.id || scene?.scene_id), scene]))
    let changed = false
    const scenes = nextScenes.map((scene) => {
      const sceneId = asText(scene?.id || scene?.scene_id)
      const live = liveById.get(sceneId)
      if (!live) return scene
      const liveEpoch = boardImageMutationEpochV129O(live)
      const sceneEpoch = boardImageMutationEpochV129O(scene)
      if (!liveEpoch || liveEpoch <= sceneEpoch) return scene
      changed = true
      return canonicalizeBoardSceneMediaRefs(boardCopyImageMutationStateV129O(scene, live))
    })

    if (!changed) return nextBoard
    return {
      ...nextBoard,
      scenes,
      mediaMutationReplaceSave: true,
      saveMode: 'replace_media_race_guard_v129o',
      updatedAt: new Date().toISOString(),
    }
  }


  async function saveBoard(nextBoard = board, quiet = false) {
    const sourceBoardForSaveV129O = boardProtectRecentImageMutationsForSaveV129O(nextBoard, boardRef.current)
    const canonicalBoardBaseV57B = sanitizeBoardActiveVideoJobsForSaveV55(canonicalizeBoardMediaRefs(sourceBoardForSaveV129O))
    const canonicalBoard = boardWithVideoQueueSnapshotV57B(canonicalBoardBaseV57B, { reason: 'saveBoard_v57B' })
    const useReplaceForActiveVideoJobsV56 = boardHasActiveVideoJobsForReplaceSaveV56(canonicalBoard)
    // AVA_BOARD_MEDIA_DELETE_BACKEND_GUARD_V129T: any explicit image/media reset must bypass backend safe_merge preservation.
    const useReplaceForMediaResetV129T = asSceneArray(canonicalBoard?.scenes).some((scene) => (
      scene?.media_reset_generation_v129s ||
      scene?.mediaResetGenerationV129S ||
      scene?.media_reset_generation_v129t ||
      scene?.mediaResetGenerationV129T ||
      scene?.image_delete_reason_v129s ||
      scene?.imageDeleteReasonV129S ||
      scene?.image_delete_reason_v129t ||
      scene?.imageDeleteReasonV129T ||
      scene?.source_image_changed_at ||
      scene?.sourceImageChangedAt
    ))
    // AVA_BOARD_DELETE_MEDIA_HARD_V129S: media delete/replacement must be saved with replace; safe_merge can preserve old image/video refs.
    const useReplaceForMediaResetV129S = asSceneArray(canonicalBoard?.scenes).some((scene) => (
      scene?.media_reset_generation_v129s ||
      scene?.mediaResetGenerationV129S ||
      scene?.source_image_changed_at ||
      scene?.sourceImageChangedAt ||
      scene?.video_stale_after_image_change_v129p ||
      scene?.videoStaleAfterImageChangeV129P
    ))
    const useReplaceForMediaMutationV129N = Boolean(
      canonicalBoard?.mediaMutationReplaceSave ||
      canonicalBoard?.forceReplaceSave ||
      String(canonicalBoard?.saveMode || '').includes('media_mutation') ||
      String(canonicalBoard?.saveMode || '').includes('replace_media')
    )
    const {
      mediaMutationReplaceSave: _mediaMutationReplaceSaveV129N,
      forceReplaceSave: _forceReplaceSaveV129N,
      saveMode: _saveModeV129N,
      ...canonicalBoardForPayloadV129N
    } = canonicalBoard
    const payload = {
      ...sanitizeBoardDurableBackup(canonicalBoardForPayloadV129N),
      boardVersion: BOARD_VERSION,
      source: workspaceMode ? (canonicalBoard.source || 'board') : (canonicalBoard.source === 'standalone_board' ? 'project_board' : (canonicalBoard.source || 'project_board')),
      updatedAt: new Date().toISOString(),
    }
    // AVA09B_WRITE_LOCAL_BEFORE_BACKEND_SAVE
    writeBoardDurableBackup(boardDurableKey({ projectId, workspaceMode }), payload)
    try {
      if (!quiet) {
        setSaving(true)
        setStatus('Сохраняем Storyboard…')
      }
      const boardGuardModeV145A = (useReplaceForActiveVideoJobsV56 || useReplaceForMediaMutationV129N || useReplaceForMediaResetV129T || useReplaceForMediaResetV129S) ? 'replace' : 'safe_merge'
      const saveResult = workspaceMode
        ? await saveWorkspaceStage(STAGE, payload)
        : await saveStage(projectId, STAGE, payload, boardGuardModeV145A)
      const verifyScene = boardSaveVerifyScene(payload)
      console.log('[BOARD SAVE VERIFY]', {
        projectId: projectId || '',
        sceneId: verifyScene?.scene_id || verifyScene?.id || '',
        video_asset_id: verifyScene?.video_asset_id || verifyScene?.videoAssetId || '',
        video_api_path: verifyScene?.video_api_path || verifyScene?.videoApiPath || '',
        image_asset_id: verifyScene?.image_asset_id || verifyScene?.imageAssetId || '',
        image_api_path: verifyScene?.image_api_path || verifyScene?.imageApiPath || '',
        savedToProject: Boolean(saveResult?.saved),
      })
      for (const scene of asSceneArray(payload.scenes)) {
        const sceneId = scene?.scene_id || scene?.id || ''
        const assetId = scene?.video_asset_id || scene?.videoAssetId || ''
        const assetApiPath = scene?.video_api_path || scene?.videoApiPath || ''
        if (!assetId && !isProtectedBoardAssetApiPath(assetApiPath)) continue
        const savedScene = asArray(saveResult?.snapshot?.data?.scenes).find((item) => asText(item?.scene_id || item?.id) === asText(sceneId))
        console.log('[BOARD ASSET LINK SAVED]', {
          projectId: projectId || '',
          sceneId,
          assetId,
          assetApiPath,
          stage: STAGE,
          existsInAvaDb: Boolean(savedScene && (
            (assetId && (savedScene.video_asset_id === assetId || savedScene.videoAssetId === assetId)) ||
            (assetApiPath && (savedScene.video_api_path === assetApiPath || savedScene.videoApiPath === assetApiPath))
          )),
        })
      }
      if (!quiet) setStatus('Storyboard сохранён')
    } catch (err) {
      setStatus(`Ошибка сохранения Доски: ${err.message}`)
    } finally {
      if (!quiet) setSaving(false)
    }
  }


  // AVA_BOARD_CLEAR_GENERATED_REFS_ON_SCENE_PATCH_V54:
  // Last safety gate before canonicalize/save. If a scene patch starts or resumes a video job,
  // old generated video/MMAudio refs from the previous result must be removed from the same scene object.
  function boardIsActiveVideoPatchV54(scene = {}, patch = {}) {
    const status = String(
      patch?.video_status ??
      patch?.videoStatus ??
      scene?.video_status ??
      scene?.videoStatus ??
      ''
    ).toLowerCase()
    const hasJob = Boolean(
      patch?.video_job_id ||
      patch?.videoJobId ||
      patch?.video_status_endpoint ||
      patch?.videoStatusEndpoint ||
      scene?.video_job_id ||
      scene?.videoJobId ||
      scene?.video_status_endpoint ||
      scene?.videoStatusEndpoint
    )
    return hasJob && ['starting', 'queued', 'preparing', 'submitting', 'running', 'queued_no_prompt_id'].includes(status)
  }

  function boardClearGeneratedRefsForActiveVideoPatchV54(scene = {}, patch = {}) {
    if (!boardIsActiveVideoPatchV54(scene, patch)) return scene
    return {
      ...scene,

      video_asset_id: '',
      videoAssetId: '',
      video_api_path: '',
      videoApiPath: '',
      video_url: '',
      videoUrl: '',
      video_name: '',
      videoName: '',
      video_result: null,
      videoResult: null,
      result_url: '',
      resultUrl: '',
      result_video_url: '',
      resultVideoUrl: '',
      result_video_api_path: '',
      resultVideoApiPath: '',
      result_video_asset_id: '',
      resultVideoAssetId: '',
      result_video_name: '',
      resultVideoName: '',
      original_video_url: '',
      originalVideoUrl: '',
      video_ready_at: '',
      videoReadyAt: '',

      mmaudio_video_asset_id: '',
      mmaudioVideoAssetId: '',
      mmaudio_video_api_path: '',
      mmaudioVideoApiPath: '',
      mmaudio_video_url: '',
      mmaudioVideoUrl: '',
      mmaudio_video_name: '',
      mmaudioVideoName: '',
      mmaudio_result: null,
      mmaudioResult: null,
      mmaudio_result_video_url: '',
      mmaudioResultVideoUrl: '',
      mmaudio_result_video_api_path: '',
      mmaudioResultVideoApiPath: '',
      mmaudio_result_video_asset_id: '',
      mmaudioResultVideoAssetId: '',
      mmaudio_ready_at: '',
      mmaudioReadyAt: '',
      mmaudio_source_video_url: '',
      mmaudioSourceVideoUrl: '',
      mmaudio_source_video_api_path: '',
      mmaudioSourceVideoApiPath: '',
      mmaudio_reset_reason: 'active_video_patch_v54',
      mmaudioResetReason: 'active_video_patch_v54',
    }
  }

  function updateScene(sceneId, patch) {
    setBoard((current) => {
      let changed = false
      const entries = Object.entries(patch || {})

      const scenes = current.scenes.map((scene) => {
        if (scene.id !== sceneId) return scene

        const hasFieldChange = entries.some(([key, value]) => !Object.is(scene?.[key], value))
        if (!hasFieldChange) return scene

        changed = true
        return canonicalizeBoardSceneMediaRefs(boardClearGeneratedRefsForActiveVideoPatchV54({ ...scene, ...patch }, patch))
      })

      if (!changed) return current

      return {
        ...current,
        scenes,
        updatedAt: new Date().toISOString(),
      }
    })
  }

  function updateSceneAndSave(sceneId, patch) {
    let nextBoardForSave = null
    setBoard((current) => {
      let changed = false
      const entries = Object.entries(patch || {})
      const scenes = current.scenes.map((scene) => {
        if (scene.id !== sceneId && scene.scene_id !== sceneId) return scene
        const nextScene = canonicalizeBoardSceneMediaRefs(boardClearGeneratedRefsForActiveVideoPatchV54({ ...scene, ...patch }, patch))
        const hasFieldChange = entries.some(([key]) => !Object.is(scene?.[key], nextScene?.[key]))
        if (!hasFieldChange) return scene
        changed = true
        return nextScene
      })
      if (!changed) return current
      nextBoardForSave = {
        ...current,
        scenes,
        updatedAt: new Date().toISOString(),
      }
      return nextBoardForSave
    })
    window.setTimeout(() => {
      if (nextBoardForSave) saveBoard(nextBoardForSave, true)
    }, 0)
  }

  function updateSceneForVideoJob(sceneId, jobId, patch) {
    setBoard((current) => ({
      ...current,
      scenes: current.scenes.map((scene) => {
        if (scene.id !== sceneId && scene.scene_id !== sceneId) return scene
        const currentJobId = scene.video_job_id || scene.videoJobId || ''
        if (jobId && currentJobId && currentJobId !== jobId) {
          return scene
        }
        // AVA_BOARD_BATCH_READY_UI_WINS_V148A:
        // Browser polling can lag behind the backend batch runner. If the server snapshot
        // already merged a real current video into this scene, do not let a later
        // running/queued poll response clear those refs and put the card back to busy.
        const patchStatusV148A = String(patch?.video_status || patch?.videoStatus || '').toLowerCase()
        const patchBusyV148A = ['starting', 'queued', 'preparing', 'submitting', 'running', 'queued_no_prompt_id'].includes(patchStatusV148A)
        const patchHasVideoV148A = Boolean(
          patch?.video_asset_id || patch?.videoAssetId ||
          patch?.video_api_path || patch?.videoApiPath ||
          patch?.video_url || patch?.videoUrl ||
          patch?.result_video_asset_id || patch?.resultVideoAssetId ||
          patch?.result_video_api_path || patch?.resultVideoApiPath ||
          patch?.result_video_url || patch?.resultVideoUrl
        )
        const sceneHasCurrentVideoV148A = Boolean(
          typeof boardSceneHasCurrentVideoResultV129P === 'function' && boardSceneHasCurrentVideoResultV129P(scene)
        )
        if (patchBusyV148A && sceneHasCurrentVideoV148A && !patchHasVideoV148A) {
          console.log('[BOARD BATCH READY UI WINS V148A] ignore stale busy poll patch', { sceneId, jobId, patchStatus: patchStatusV148A })
          return scene
        }
        return canonicalizeBoardSceneMediaRefs(boardClearGeneratedRefsForActiveVideoPatchV54({ ...scene, ...patch }, patch))
      }),
      updatedAt: new Date().toISOString(),
    }))
  }



  function boardProjectPagePath() {
    return (!workspaceMode && projectId)
      ? `/app/projects/${projectId}/board`
      : '/app/workspace/board'
  }

  function pushBoardToast({ type = 'info', title = '', message = '', sceneId = '', dedupeKey = '' } = {}) {
    const to = boardProjectPagePath()
    window.dispatchEvent(new CustomEvent('ava:notify', {
      detail: {
        type,
        title,
        message,
        sceneId,
        projectId: workspaceMode ? '' : (projectId || ''),
        stage: 'board',
        to,
        pagePath: to,
        dedupeKey,
        source: 'board-page',
      },
    }))
  }

  function dismissBoardToast(toastId) {
    setBoardToasts((current) => current.filter((toast) => toast.id !== toastId))
  }


  function registerAvaGlobalJob({ kind = 'video', sceneId = '', jobId = '', statusEndpoint = '' } = {}) {
    if (!jobId || !statusEndpoint) return
    if (!workspaceMode && (!projectId || isGeneratorSceneId(sceneId))) {
      console.warn('[BOARD JOB COMPLETED SKIP]', {
        reason: !projectId ? 'projectId null' : 'generator scene',
        jobId,
        projectId: projectId || '',
        sceneId,
      })
      return
    }

    const key = `${kind}:${jobId}`
    const nextJob = {
      key,
      kind,
      sceneId,
      jobId,
      statusEndpoint,
      projectId: projectId || '',
      workspaceMode,
      stage: 'board',
      to: boardProjectPagePath(),
      pagePath: boardProjectPagePath(),
      createdAt: new Date().toISOString(),
    }

        // AVA_BOARD_POLISH_BUTTONS_MMAUDIO_V58: normalize Board video/MMAudio global job notification metadata.
    const isMmaudioJobV58 = kind === 'mmaudio'
    Object.assign(nextJob, {
      source: nextJob.source || 'board',
      stage: nextJob.stage || 'board',
      title: nextJob.title || (isMmaudioJobV58 ? 'MMAudio' : 'Видео'),
      label: nextJob.label || (isMmaudioJobV58 ? 'MMAudio' : 'Видео'),
      toastTitle: nextJob.toastTitle || (isMmaudioJobV58 ? 'MMAudio готово' : 'Видео готово'),
      toastMessage: nextJob.toastMessage || (isMmaudioJobV58
        ? `Сцена ${sceneId}: звук готов. Перейти в доску?`
        : `Сцена ${sceneId}: видео готово. Перейти в доску?`),
      to: nextJob.to || boardProjectPagePath(),
      pagePath: nextJob.pagePath || boardProjectPagePath(),
      projectId: nextJob.projectId || projectId || '',
      sceneId: nextJob.sceneId || sceneId,
      route: nextJob.route || (isMmaudioJobV58 ? 'mmaudio' : ''),
    })

const jobs = readAvaGlobalJobs().filter((job) => job.key !== key)
    writeAvaGlobalJobs([...jobs, nextJob].slice(-12))
    // AVA_BOARD_POLISH_BUTTONS_MMAUDIO_V58: wake GlobalJobNotifier immediately after board job registration.
    try {
      window.dispatchEvent(new CustomEvent('ava:global-jobs-changed'))
    } catch {}
  }


  async function confirmBoardToAssemblyHandoff() {
    if (assemblyConfirmBusy) return
    const scenes = asSceneArray(board.scenes)
    if (!scenes.length) {
      setAssemblyConfirmError('В Доске нет сцен для монтажника.')
      return
    }
    setAssemblyConfirmBusy(true)
    setAssemblyConfirmError('')
    try {
      const currentBoard = {
        ...board,
        source: workspaceMode ? (board.source || 'board') : (board.source === 'standalone_board' ? 'project_board' : (board.source || 'project_board')),
        updatedAt: new Date().toISOString(),
      }
      await saveBoard(currentBoard, true)
      const assemblySnapshot = buildBoardAssemblySnapshotFromBoard(currentBoard, {
        projectId: projectId || '',
        source: 'board_to_assembly_confirmed_v8',
      })
      if (workspaceMode) {
        await saveWorkspaceStage('board_assembly', assemblySnapshot)
      } else {
        await saveStage(projectId, 'board_assembly', assemblySnapshot, 'replace')
      }
      const toPath = projectId ? `/app/projects/${projectId}/board-assembly` : '/app/workspace/board-assembly'
      const fromPath = projectId ? `/app/projects/${projectId}/board` : '/app/workspace/board'
      rememberWorkflowEntry(makeWorkflowEntry({
        from: 'board',
        to: 'board_assembly',
        fromPath,
        toPath,
        projectId: projectId || '',
        source: 'board_to_assembly_confirmed_v8',
      }))
      try {
        localStorage.removeItem('ava:board-assembly:cleared:v1')
        sessionStorage.removeItem('ava:board-assembly:cleared:v1')
      } catch {}
      setAssemblyConfirmOpen(false)
      navigate(toPath, {
        state: {
          workflowEntry: makeWorkflowEntry({
            from: 'board',
            to: 'board_assembly',
            fromPath,
            toPath,
            projectId: projectId || '',
            source: 'board_to_assembly_confirmed_v8',
          }),
          source: 'board',
          board: assemblySnapshot.board,
          forceReplace: true,
        },
      })
    } catch (error) {
      console.warn('[BOARD TO ASSEMBLY HANDOFF FAILED]', error)
      setAssemblyConfirmError(`Не удалось перенести в монтажник: ${error?.message || error}`)
    } finally {
      setAssemblyConfirmBusy(false)
    }
  }


  async function confirmTimingToBoardImportV14B() {
    if (timingToBoardImporting) return
    setTimingToBoardImporting(true)
    setLoading(true) // AVA_BOARD_TIMING_IMPORT_LOADING_V162A
    setStatus('Переносим свежий Тайминг в Доску…')
    try {
      const timingData = workspaceMode ? await loadWorkspaceStage('manual_timing') : await loadStage(projectId, 'manual_timing')
      const timingDataWithProjectFormatV177B = boardInjectProjectFormatIntoTimingV177C(timingData, activeProjectFormatV177B)
      const nextBoard = buildCleanBoardFromTimingV14B(timingDataWithProjectFormatV177B)
      if (!asSceneArray(nextBoard.scenes).length) {
        setStatus('В Тайминге нет сцен для переноса в Доску')
        return
      }
      setBoard(nextBoard)
      if (workspaceMode) {
        await saveWorkspaceStage(STAGE, nextBoard, 'replace')
      } else {
        await saveStage(projectId, STAGE, nextBoard, 'replace')
      }
      markTimingToBoardEntryConsumedV146(boardWorkflowEntry)
      clearWorkflowEntry('board')
      setShowTimingToBoardConfirm(false)
      setStatus(`Доска заменена свежим Таймингом: ${asSceneArray(nextBoard.scenes).length} сцен`)
    } catch (err) {
      setStatus(`Не удалось перенести Тайминг в Доску: ${err?.message || err}`)
    } finally {
      setTimingToBoardImporting(false)
      setLoading(false)
    }
  }

  function cancelTimingToBoardImportV14B() {
    clearWorkflowEntry('board')
    setShowTimingToBoardConfirm(false)
    setStatus('Переход из Тайминга отменён. Старая Доска оставлена без изменений.')
  }

  async function refreshFromTiming() {
    // AVA_TIMING_TO_BOARD_REFRESH_CONFIRM_V14B:
    // Explicit Timing refresh is destructive, so ask first in the same style.
    setShowTimingToBoardConfirm(true)
    setStatus('Подтверди замену Доски свежим Таймингом.')
  }

  function returnToTimingFromBoardV66B() {
    const toPath = workspaceMode ? '/app/workspace/timing' : `/app/projects/${projectId}/timing`
    const fromPath = workspaceMode ? '/app/workspace/board' : `/app/projects/${projectId}/board`
    const entry = makeWorkflowEntry({
      from: 'board',
      to: 'manual_timing',
      fromPath,
      toPath,
      projectId: projectId || '',
      source: 'board_return_to_timing_v66b',
    })
    rememberWorkflowEntry(entry)
    navigate(toPath, {
      state: {
        workflowEntry: entry,
        returnFromBoard: true,
        boardSceneId: selectedScene?.id || board.selectedSceneId || '',
      },
    })
  }

  function selectScene(sceneId) {
    const nextSceneId = asText(sceneId)
    if (!nextSceneId) return
    setBoard((current) => {
      const currentSceneId = asText(current?.selectedSceneId || current?.selected_scene_id)
      const scene = asSceneArray(current.scenes).find((item) => asText(item.id || item.scene_id) === nextSceneId)
      if (scene) {
        const sceneDuration = durationOf(scene)
        if (sceneDuration > 0) setManualSceneDurationSec(sceneDuration)
      }
      if (currentSceneId === nextSceneId) return current
      return { ...current, selectedSceneId: nextSceneId }
    })
  }


  function manualSceneHueV133A(index = 0) {
    // AVA_BOARD_MANUAL_SCENE_IMMEDIATE_COLORS_V133A:
    // Same hue formula as normalized/reloaded Board scenes, but applied immediately on + Scene.
    const n = Number(index || 0)
    return 185 + (((Number.isFinite(n) ? n : 0) * 47) % 150)
  }

  function createManualScene() {
    if (!manualSceneToolsEnabled) {
      setStatus('Добавление ручных сцен отключено: эта доска привязана к таймингу.')
      return
    }
    // AVA09D2_MANUAL_SCENE_CLEARS_MARKER_AND_SAVES
    // AVA09C_CLEAR_BOARD_MARKER_ON_MANUAL_SCENE
    clearWorkflowStageClearedMarker('board')
    const safeDuration = Math.max(2, Math.min(12, toNumber(manualSceneDurationSec, 6)))
    let createdId = ''
    let boardToPersist = null

    setBoard((current) => {
      const scenes = Array.isArray(current.scenes) ? current.scenes : []
      const usedIds = new Set(scenes.map((scene) => asText(scene.id || scene.scene_id)))
      let nextIndex = scenes.length + 1
      let nextId = `seg_${String(nextIndex).padStart(2, '0')}`

      while (usedIds.has(nextId)) {
        nextIndex += 1
        nextId = `seg_${String(nextIndex).padStart(2, '0')}`
      }

      const lastEnd = scenes.reduce((maxValue, scene) => {
        const value = toNumber(scene.end_sec ?? scene.end, maxValue)
        return Math.max(maxValue, value)
      }, 0)

      const start = Number(lastEnd.toFixed(3))
      const end = Number((start + safeDuration).toFixed(3))
      const format = current.format || current.aspect_ratio || '16:9'
      const titleNumber = scenes.length + 1
      const manualSceneColorV133A = manualSceneHueV133A(scenes.length)
      createdId = nextId

      const nextScene = {
        id: nextId,
        scene_id: nextId,
        title: `Сцена ${titleNumber}`,
        index: scenes.length,
        source: 'manual_board_scene',
        importedFrom: 'manual_board',
        timingLocked: false,
        timing_locked: false,
        durationLocked: false,
        duration_locked: false,
        durationSource: 'manual_board',
        duration_source: 'manual_board',
        start,
        end,
        start_sec: start,
        end_sec: end,
        duration_sec: safeDuration,
        route: 'i2v',
        workflow_key: boardWorkflowKeyForRoute('i2v'),
        format,
        aspect_ratio: format,
        blockId: '',
        block_id: '',
        blockTitle: 'Manual',
        block_title: 'Manual',
        // AVA_BOARD_MANUAL_SCENE_IMMEDIATE_COLORS_V133A:
        // Do not wait for F5/normalizeBoardScene to derive final card/workspace color.
        blockColor: manualSceneColorV133A,
        block_color: manualSceneColorV133A,
        color: manualSceneColorV133A,
        sceneColor: manualSceneColorV133A,
        scene_color: manualSceneColorV133A,
        user_scene_color: manualSceneColorV133A,
        timelineColor: manualSceneColorV133A,
        cardColor: manualSceneColorV133A,
        roleLabels: [],
        source_phrase_ids: [],
        scene_word_text: '',
        lyrics_text: '',
        translated_text_ru: '',
        meaning_hint_ru: '',
        phrase_cut_warning: false,
        note: '',
        video_prompt: '',
        positive_prompt: '',
        negative_prompt: 'text, watermark, logo, distorted face, extra limbs, low quality',
        sound_prompt: '',
        image_status: 'empty',
        video_status: 'empty',
        image_url: '',
        image_data_url: '',
        image_name: '',
        first_frame_url: '',
        start_image_data_url: '',
        first_frame_name: '',
        last_frame_url: '',
        end_image_data_url: '',
        last_frame_name: '',
        video_url: '',
        video_api_path: '',
        video_name: '',
        original_video_url: '',
        video_result: null,
        audio_slice_url: '',
        audio_slice_status: 'not_required',
        previous_frame_status: 'empty',
        createdAt: new Date().toISOString(),
      }

      const nextBoard = {
        ...current,
        source: current.source || 'board',
        importedFrom: current.importedFrom || 'manual_board',
        scenes: [...scenes, nextScene],
        selectedSceneId: nextId,
        updatedAt: new Date().toISOString(),
      }

      boardToPersist = nextBoard
      // AVA09B_WRITE_LOCAL_INSIDE_CREATE_MANUAL_SCENE
      writeBoardDurableBackup(boardDurableKey({ projectId, workspaceMode }), nextBoard)
      return nextBoard
    })

    window.setTimeout(() => {
      // AVA09A_IMMEDIATE_SAVE_MANUAL_SCENE:
      // autosave is still active, but this prevents losing a new scene on quick F5.
      if (boardToPersist) saveBoard(boardToPersist, true)
      setStatus(createdId ? `Добавлена ${createdId} · ${safeDuration} сек` : `Добавлена сцена · ${safeDuration} сек`)
    }, 0)
  }

  function deleteLastManualSceneV129K() {
    if (!manualSceneToolsEnabled) {
      setStatus('Удаление ручных сцен отключено: эта доска привязана к таймингу.')
      return
    }

    const sceneIdV129K = (scene = {}, index = -1) => {
      const raw = scene?.id || scene?.scene_id || scene?.sceneId || scene?.sceneID || scene?.uid || scene?.key || ''
      const fallback = index >= 0 ? `seg_${String(index + 1).padStart(2, '0')}` : ''
      return String(raw || fallback || '').trim()
    }

    const currentBoard = boardRef.current || board || {}
    const scenes = Array.isArray(currentBoard.scenes) ? currentBoard.scenes : []

    if (!scenes.length) {
      setStatus('Нет сцен для удаления.')
      return
    }

    const lastIndex = scenes.length - 1
    const lastScene = scenes[lastIndex] || {}
    const removedSceneId = sceneIdV129K(lastScene, lastIndex)
    const isManual = (
      lastScene?.source === 'manual_board_scene' ||
      lastScene?.importedFrom === 'manual_board' ||
      lastScene?.source_kind === 'manual_board_scene' ||
      lastScene?.sourceKind === 'manual_board_scene' ||
      lastScene?.scene_type === 'manual_board_scene' ||
      lastScene?.sceneType === 'manual_board_scene' ||
      lastScene?.durationSource === 'manual_board' ||
      lastScene?.duration_source === 'manual_board' ||
      lastScene?.manual === true ||
      lastScene?.isManual === true
    )

    if (!isManual) {
      setStatus('Последняя сцена не ручная. Удаление остановлено, чтобы не снести тайминг.')
      return
    }

    const nextScenes = scenes.slice(0, -1).map((scene, index) => ({
      ...scene,
      index,
    }))

    const previousSelectedId = String(currentBoard.selectedSceneId || currentBoard.selected_scene_id || '').trim()
    const previousSelectedStillExists = Boolean(previousSelectedId) && nextScenes.some((scene, index) => sceneIdV129K(scene, index) === previousSelectedId)
    const fallbackSelectedId = sceneIdV129K(nextScenes[nextScenes.length - 1] || {}, nextScenes.length - 1)
    const nextSelectedId = previousSelectedStillExists ? previousSelectedId : fallbackSelectedId

    const nextBoard = {
      ...currentBoard,
      scenes: nextScenes,
      selectedSceneId: nextSelectedId,
      selected_scene_id: nextSelectedId,
      updatedAt: new Date().toISOString(),
    }

    boardRef.current = nextBoard
    setBoard(nextBoard)

    try {
      writeBoardDurableBackup(boardDurableKey({ projectId, workspaceMode }), nextBoard)
    } catch {}

    if (removedSceneId) {
      try {
        setRuntimeSceneMediaUrls((current) => {
          const next = { ...current }
          delete next[removedSceneId]
          return next
        })
      } catch {}
      try {
        localVideoQueueRef.current = Array.isArray(localVideoQueueRef.current)
          ? localVideoQueueRef.current.filter((sceneId) => String(sceneId || '').trim() !== removedSceneId)
          : []
      } catch {}
      try {
        activeVideoPollsRef.current?.delete?.(removedSceneId)
      } catch {}
    }

    try {
      saveBoard(nextBoard, true)
    } catch {}

    setStatus(removedSceneId ? `Удалена последняя сцена: ${removedSceneId}` : 'Удалена последняя сцена.')
  }





  // AVA_BOARD_MANUAL_TIMING_SLIDER_CONTIGUOUS_V130G:
  // Keep only manual Board scenes contiguous when duration slider changes.
  // Example: 0-4, 4-8, 8-14. Timing-import locked scenes are not rewritten.
  function isManualBoardTimingSceneV130G(scene = {}) {
    return (
      scene?.source === 'manual_board_scene' ||
      scene?.importedFrom === 'manual_board' ||
      scene?.source === 'manual_board' ||
      scene?.durationSource === 'manual_board' ||
      scene?.duration_source === 'manual_board'
    )
  }

  function manualSceneDurationForContiguousV130G(scene = {}) {
    const stored = toNumber(scene?.duration_sec ?? scene?.duration, 0)
    if (stored > 0) return Number(stored.toFixed(3))
    const start = toNumber(scene?.start_sec ?? scene?.start, 0)
    const end = toNumber(scene?.end_sec ?? scene?.end, start)
    return Number(Math.max(0.1, end - start || 4).toFixed(3))
  }

  function normalizeManualSceneTimingsV130G(scenesInput = []) {
    let cursor = 0
    return asSceneArray(scenesInput).map((scene, index) => {
      const lockedInfo = boardSceneTimingLockInfo(scene)
      const rawStart = toNumber(scene?.start_sec ?? scene?.start, cursor)
      const rawDuration = manualSceneDurationForContiguousV130G(scene)
      const rawEnd = toNumber(scene?.end_sec ?? scene?.end, rawStart + rawDuration)

      if (!isManualBoardTimingSceneV130G(scene) || lockedInfo.locked) {
        cursor = Math.max(cursor, rawEnd)
        return scene
      }

      const start = Number(cursor.toFixed(3))
      const end = Number((start + rawDuration).toFixed(3))
      cursor = end

      return {
        ...scene,
        index,
        start,
        start_sec: start,
        end,
        end_sec: end,
        duration: rawDuration,
        duration_sec: rawDuration,
        timing_contiguous_v130g: true,
        timingContiguousV130G: true,
      }
    })
  }

  function manualSceneTimingsChangedV130G(beforeScenes = [], afterScenes = []) {
    const before = asSceneArray(beforeScenes)
    const after = asSceneArray(afterScenes)
    if (before.length !== after.length) return true
    return before.some((scene, index) => {
      const next = after[index] || {}
      return (
        toNumber(scene?.start_sec ?? scene?.start, 0) !== toNumber(next?.start_sec ?? next?.start, 0) ||
        toNumber(scene?.end_sec ?? scene?.end, 0) !== toNumber(next?.end_sec ?? next?.end, 0) ||
        toNumber(scene?.duration_sec ?? scene?.duration, 0) !== toNumber(next?.duration_sec ?? next?.duration, 0)
      )
    })
  }


function rememberSelectedSceneVideoDurationV201A(rawDuration) {
    const duration = Number(rawDuration || 0)
    if (!Number.isFinite(duration) || duration <= 0) return
    const safeDuration = Number(duration.toFixed(3))
    const selectedId = asText(selectedScene?.id || selectedScene?.scene_id || selectedScene?.sceneId)
    if (!selectedId) return
    if (!selectedAssemblyVideoTrimCanUseV201A) return
    const oldDuration = boardSceneVideoDurationForTrimV201A(selectedScene || {})
    if (Math.abs(Number(oldDuration || 0) - safeDuration) <= 0.02) return

    const currentRange = boardSceneVideoTrimRangeV201A(selectedScene || {})
    const nextEnd = currentRange.enabled
      ? Math.max(AVA_BOARD_VIDEO_TRIM_MIN_SEC_V201A, Math.min(safeDuration, currentRange.end || safeDuration))
      : safeDuration
    updateSceneAndSave(selectedId, {
      assemblyVideoDurationSec: safeDuration,
      assembly_video_duration_sec: safeDuration,
      videoDurationSec: safeDuration,
      video_duration_sec: safeDuration,
      assemblyVideoTrimEndSec: Number(nextEnd.toFixed(3)),
      assembly_video_trim_end_sec: Number(nextEnd.toFixed(3)),
      assemblyVideoTrimUpdatedAt: new Date().toISOString(),
      assembly_video_trim_updated_at: new Date().toISOString(),
    })
  }

  function updateSelectedAssemblyVideoTrimV201A(patch = {}) {
    const selectedId = asText(selectedScene?.id || selectedScene?.scene_id || selectedScene?.sceneId)
    if (!selectedId) return
    if (!selectedAssemblyVideoTrimCanUseV201A) {
      setStatus(selectedAssemblyVideoTrimAudioLockedV201A
        ? 'Обрезка заблокирована для ia2v/lip-sync/instrumental: это готовый audio-driven клип.'
        : 'Обрезка недоступна для сцен из Тайминга.')
      return
    }

    const current = boardSceneVideoTrimRangeV201A(selectedScene || {})
    const duration = Number(current.duration || 0)
    if (!Number.isFinite(duration) || duration <= 0) {
      setStatus('Длина видео ещё не определена. Открой preview/дождись загрузки metadata.')
      return
    }

    const minGap = Math.min(AVA_BOARD_VIDEO_TRIM_MIN_SEC_V201A, Math.max(0.02, duration / 2))
    let enabled = patch.enabled !== undefined ? Boolean(patch.enabled) : true
    let start = patch.startSec !== undefined ? Number(patch.startSec) : Number(current.start || 0)
    let end = patch.endSec !== undefined ? Number(patch.endSec) : Number(current.end || duration)
    start = Number.isFinite(start) ? Math.max(0, Math.min(duration, start)) : 0
    end = Number.isFinite(end) ? Math.max(0, Math.min(duration, end)) : duration

    if (patch.edge === 'start' && start > end - minGap) start = Math.max(0, end - minGap)
    if (patch.edge === 'end' && end < start + minGap) end = Math.min(duration, start + minGap)
    if (end <= start) end = Math.min(duration, start + minGap)

    start = Number(start.toFixed(3))
    end = Number(end.toFixed(3))
    const clipDuration = Number(Math.max(minGap, end - start).toFixed(3))

    updateSceneAndSave(selectedId, {
      assemblyVideoTrimEnabled: enabled,
      assembly_video_trim_enabled: enabled,
      assemblyVideoTrimStartSec: start,
      assembly_video_trim_start_sec: start,
      assemblyVideoTrimEndSec: end,
      assembly_video_trim_end_sec: end,
      assemblyVideoTrimDurationSec: clipDuration,
      assembly_video_trim_duration_sec: clipDuration,
      assemblyVideoDurationSec: duration,
      assembly_video_duration_sec: duration,
      assemblyVideoTrimUpdatedAt: new Date().toISOString(),
      assembly_video_trim_updated_at: new Date().toISOString(),
    })
    setStatus(enabled
      ? `Обрезка для сборки: ${formatBoardTrimSecondsV201A(start)}–${formatBoardTrimSecondsV201A(end)} сек`
      : 'Обрезка видео для сборки выключена')
  }

  function resetSelectedAssemblyVideoTrimV201A() {
    const selectedId = asText(selectedScene?.id || selectedScene?.scene_id || selectedScene?.sceneId)
    if (!selectedId) return
    const duration = boardSceneVideoDurationForTrimV201A(selectedScene || {})
    updateSceneAndSave(selectedId, {
      assemblyVideoTrimEnabled: false,
      assembly_video_trim_enabled: false,
      assemblyVideoTrimStartSec: 0,
      assembly_video_trim_start_sec: 0,
      assemblyVideoTrimEndSec: duration || null,
      assembly_video_trim_end_sec: duration || null,
      assemblyVideoTrimDurationSec: duration || null,
      assembly_video_trim_duration_sec: duration || null,
      assemblyVideoTrimUpdatedAt: new Date().toISOString(),
      assembly_video_trim_updated_at: new Date().toISOString(),
    })
    setStatus('Обрезка видео для сборки сброшена')
  }

function syncAssemblyVideoTrimTimeFromPlayerV201D(video) {
    const node = video || selectedVideoElementRefV201D.current
    const time = Number(node?.currentTime || 0)
    const safe = Number((Number.isFinite(time) ? Math.max(0, time) : 0).toFixed(3))
    setAssemblyVideoTrimTimeV201D(safe)
    return safe
  }

  function toggleSelectedAssemblyVideoTrimPlayerV201D() {
    const node = selectedVideoElementRefV201D.current
    if (!node) {
      setStatus('Видео ещё не готово для точной обрезки.')
      return
    }
    syncAssemblyVideoTrimTimeFromPlayerV201D(node)
    if (node.ended) {
      try { node.currentTime = 0 } catch (_) {}
      setAssemblyVideoTrimTimeV201D(0)
    }
    if (node.paused) {
      const playPromise = node.play()
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
          setAssemblyVideoTrimPlayingV201D(false)
          setStatus(`Видео не запустилось: ${error?.message || 'play_failed'}`)
        })
      }
      setAssemblyVideoTrimPlayingV201D(true)
    } else {
      node.pause()
      syncAssemblyVideoTrimTimeFromPlayerV201D(node)
      setAssemblyVideoTrimPlayingV201D(false)
    }
  }

  function setSelectedAssemblyVideoTrimEdgeFromPlayerV201D(edge) {
    const node = selectedVideoElementRefV201D.current
    const current = syncAssemblyVideoTrimTimeFromPlayerV201D(node)
    if (edge === 'start') {
      updateSelectedAssemblyVideoTrimV201A({ startSec: current, edge: 'start', enabled: true })
      return
    }
    updateSelectedAssemblyVideoTrimV201A({ endSec: current, edge: 'end', enabled: true })
  }

function updateSelectedSceneDuration(nextValue) {
    const safeDuration = Math.max(2, Math.min(12, toNumber(nextValue, 6)))
    setManualSceneDurationSec(safeDuration)

    let boardToPersist = null
    let blockedByTimingLock = false

    setBoard((current) => {
      const scenes = asSceneArray(current.scenes)
      const selectedId = asText(current.selectedSceneId || current.selected_scene_id)

      if (!selectedId || !scenes.length) return current
      const selectedSceneForLock = scenes.find((scene) => asText(scene.id || scene.scene_id) === selectedId)
      if (boardSceneTimingLockInfo(selectedSceneForLock).locked) {
        blockedByTimingLock = true
        return current
      }

      const nextScenesRaw = scenes.map((scene) => {
        const id = asText(scene.id || scene.scene_id)
        if (id !== selectedId) return scene

        const start = toNumber(scene.start_sec ?? scene.start, 0)
        const end = Number((start + safeDuration).toFixed(3))

        return {
          ...scene,
          duration_sec: safeDuration,
          duration: safeDuration,
          end_sec: end,
          end,
          timing_contiguous_v130g_reason: 'selected_duration_changed',
          timingContiguousV130GReason: 'selected_duration_changed',
          updatedAt: new Date().toISOString(),
        }
      })

      const nextScenes = normalizeManualSceneTimingsV130G(nextScenesRaw)

      const nextBoard = {
        ...current,
        scenes: nextScenes,
        updatedAt: new Date().toISOString(),
        manual_timing_contiguous_v130g: true,
        manualTimingContiguousV130G: true,
      }

      boardToPersist = nextBoard
      try {
        writeBoardDurableBackup(boardDurableKey({ projectId, workspaceMode }), nextBoard)
      } catch {}
      return nextBoard
    })

    window.setTimeout(() => {
      if (blockedByTimingLock) {
        setStatus('Длительность зафиксирована из Тайминга. Рычаг отключён для этой сцены.')
        return
      }
      if (boardToPersist) {
        saveBoard(boardToPersist, true)
        setStatus('Длительность сцены сохранена, ручной тайминг выровнен')
      }
    }, 0)
  }

  // AVA_BOARD_MANUAL_TIMING_REPAIR_EXISTING_GAPS_V130G:
  // On load, repair older manual-board snapshots that already contain gaps.
  useEffect(() => {
    if (!manualSceneToolsEnabled) return
    const currentBoard = boardRef.current || board || {}
    const scenes = asSceneArray(currentBoard.scenes)
    if (!scenes.length) return
    if (!scenes.some((scene) => isManualBoardTimingSceneV130G(scene))) return

    const normalizedScenes = normalizeManualSceneTimingsV130G(scenes)
    if (!manualSceneTimingsChangedV130G(scenes, normalizedScenes)) return

    const nextBoard = {
      ...currentBoard,
      scenes: normalizedScenes,
      updatedAt: new Date().toISOString(),
      manual_timing_contiguous_v130g: true,
      manualTimingContiguousV130G: true,
    }
    boardRef.current = nextBoard
    setBoard(nextBoard)
    try {
      writeBoardDurableBackup(boardDurableKey({ projectId, workspaceMode }), nextBoard)
    } catch {}
    window.setTimeout(() => {
      saveBoard(nextBoard, true)
      setStatus('Тайминг ручных сцен выровнен без разрывов')
      console.log('[BOARD MANUAL TIMING NORMALIZED V130G]', normalizedScenes.map((scene) => ({
        id: scene.id || scene.scene_id,
        start: scene.start_sec ?? scene.start,
        end: scene.end_sec ?? scene.end,
        duration: scene.duration_sec ?? scene.duration,
      })))
    }, 0)
  }, [manualSceneToolsEnabled, board?.scenes?.length, projectId, workspaceMode])



  function togglePanel(panelKey) {
    setCollapsedPanels((current) => ({
      ...current,
      [panelKey]: !current?.[panelKey],
    }))
  }

  function playRange(start, end, label) {
    const audio = audioRef.current
    if (!audio || !audioSrc) {
      setStatus('Аудио preview пока недоступен')
      return
    }
    const safeStart = Math.max(0, toNumber(start, 0))
    const safeEnd = Math.max(safeStart + 0.05, toNumber(end, safeStart + 0.05))
    audio.pause()
    audio.currentTime = safeStart
    setPlayback({ start: safeStart, end: safeEnd, label })
    audio.play().catch((err) => setStatus(`Не удалось проиграть аудио: ${err.message}`))
  }

  function togglePause() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) audio.play().catch((err) => setStatus(err.message))
    else audio.pause()
  }

  function playSelectedScene() {
    if (!selectedScene) return
    playRange(selectedScene.start, selectedScene.end, selectedScene.id)
  }

  function playSelectedBlock() {
    if (!blockScenes.length) return playSelectedScene()
    const start = Math.min(...blockScenes.map((scene) => scene.start))
    const end = Math.max(...blockScenes.map((scene) => scene.end))
    playRange(start, end, selectedScene?.blockTitle || selectedScene?.blockId || 'block')
  }

  function playAllAudio() {
    const duration = toNumber(board.audio?.durationSec || board.audioDurationSec, Math.max(...board.scenes.map((scene) => scene.end), 0))
    playRange(0, duration, 'all')
  }

  function speak(text) {
    const clean = asText(text)
    if (!clean) {
      setStatus('Нет русского текста для озвучки')
      return
    }
    if (!window.speechSynthesis) {
      setStatus('Browser TTS недоступен')
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.lang = 'ru-RU'
    utterance.rate = 0.92
    const voices = window.speechSynthesis.getVoices?.() || []
    const voice = voices.find((item) => /Google.*Russian|ru-RU|Russian/i.test(`${item.name} ${item.lang}`))
    if (voice) utterance.voice = voice
    window.speechSynthesis.speak(utterance)
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(reader.error || new Error('file_reader_failed'))
      reader.readAsDataURL(file)
    })
  }

  function sceneDataFieldByUrlField(fieldUrl) {
    const map = {
      image_url: 'image_data_url',
      first_frame_url: 'start_image_data_url',
      last_frame_url: 'end_image_data_url',
    }
    return map[String(fieldUrl || '')] || ''
  }

  function mediaSlotByUrlField(fieldUrl) {
    if (fieldUrl === 'first_frame_url') return 'first'
    if (fieldUrl === 'last_frame_url') return 'last'
    return 'image'
  }

  function staleVideoPatch(reason = 'source_media_changed') {
    return {
      video_url: '',
      video_api_path: '',
      video_name: '',
      original_video_url: '',
      video_result: null,
      video_ready_at: '',
      video_job_id: '',
      video_status_endpoint: '',
      video_status: reason,
      video_error: '',
    }
  }

  // AVA_BOARD_REGENERATE_CLEANUP_V45:
  // When user regenerates a scene that already has a ready video, clear the old
  // video/MMAudio result first. Otherwise active detection can still see an old
  // video_api_path/videoUrl and treat the scene as already completed.
  function boardVideoRegenerateResetPatch(reason = 'video_regenerate') {
    return {
      ...staleVideoPatch(reason),

      video_status: 'starting',
      videoStatus: 'starting',
      video_error: '',
      videoError: '',

      // AVA_BOARD_VIDEO_REGENERATE_RESET_REASON_V155A:
      // Explicitly tell backend snapshot merge that this is an intentional
      // regeneration start, so old bound video/review refs must not be restored.
      video_reset_reason: reason,
      videoResetReason: reason,
      video_regeneration_started_v155a: true,
      videoRegenerationStartedV155A: true,

      video_job_id: '',
      videoJobId: '',
      video_status_endpoint: '',
      videoStatusEndpoint: '',
      video_queue_position: 0,
      videoQueuePosition: 0,

      video_url: '',
      videoUrl: '',
      video_api_path: '',
      videoApiPath: '',
      video_name: '',
      videoName: '',
      video_asset_id: '',
      videoAssetId: '',
      video_result: null,
      videoResult: null,
      resultVideoUrl: '',
      // AVA_BOARD_WIDEN_REGENERATE_CLEANUP_V50:
      // Clear every old result reference, not only video_url/video_api_path.
      result_url: '',
      resultUrl: '',
      result_video_url: '',
      resultVideoUrl: '',
      result_video_api_path: '',
      resultVideoApiPath: '',
      result_video_asset_id: '',
      resultVideoAssetId: '',
      result_video_name: '',
      resultVideoName: '',
      original_video_url: '',
      originalVideoUrl: '',
      video_ready_at: '',
      videoReadyAt: '',

      // Old MMAudio belongs to the old base video, so it must be removed when
      // the base video is regenerated.
      mmaudio_status: '',
      mmaudioStatus: '',
      mmaudio_error: '',
      mmaudioError: '',
      mmaudio_job_id: '',
      mmaudioJobId: '',
      mmaudio_status_endpoint: '',
      mmaudioStatusEndpoint: '',
      mmaudio_video_url: '',
      mmaudioVideoUrl: '',
      mmaudio_video_api_path: '',
      mmaudioVideoApiPath: '',
      mmaudio_video_name: '',
      mmaudio_video_asset_id: '',
      mmaudioVideoAssetId: '',
      mmaudio_result_video_url: '',
      mmaudioResultVideoUrl: '',
      mmaudio_result_video_api_path: '',
      mmaudioResultVideoApiPath: '',
      mmaudio_result_video_asset_id: '',
      mmaudioResultVideoAssetId: '',
      mmaudioVideoName: '',
      mmaudio_result: null,
      mmaudioResult: null,
      mmaudio_ready_at: '',
      mmaudioReadyAt: '',
      mmaudio_source_video_url: '',
      mmaudioSourceVideoUrl: '',
      mmaudio_source_video_api_path: '',
      mmaudioSourceVideoApiPath: '',
      mmaudio_reset_reason: 'base_video_restarting',
      mmaudioResetReason: 'base_video_restarting',
    }
  }

  // AVA_BOARD_REGENERATE_QUEUE_BUTTON_V46:
  // If a ready scene is queued for regeneration while another scene is active,
  // clear the old video immediately and show a true queued state on card/button.
  function boardVideoQueuedRegenerateResetPatch(queuePosition = 0, reason = 'video_queued_for_regenerate') {
    return {
      ...boardVideoRegenerateResetPatch(reason),
      video_status: 'queued',
      videoStatus: 'queued',
      video_error: '',
      videoError: '',
      video_job_id: '',
      videoJobId: '',
      video_status_endpoint: '',
      videoStatusEndpoint: '',
      video_queue_position: queuePosition,
      videoQueuePosition: queuePosition,
    }
  }


  // AVA_BOARD_REGENERATE_CLEANUP_V45:
  // When MMAudio is launched again for the same scene, clear the old MMAudio
  // result/job first, but keep the base video and scene media intact.
  function boardMmaudioRegenerateResetPatch(reason = 'mmaudio_regenerate') {
    return {
      mmaudio_status: '',
      mmaudioStatus: '',
      mmaudio_error: '',
      mmaudioError: '',
      mmaudio_job_id: '',
      mmaudioJobId: '',
      mmaudio_status_endpoint: '',
      mmaudioStatusEndpoint: '',
      mmaudio_video_url: '',
      mmaudioVideoUrl: '',
      mmaudio_video_api_path: '',
      mmaudioVideoApiPath: '',
      mmaudio_video_name: '',
      mmaudio_video_asset_id: '',
      mmaudioVideoAssetId: '',
      mmaudio_result_video_url: '',
      mmaudioResultVideoUrl: '',
      mmaudio_result_video_api_path: '',
      mmaudioResultVideoApiPath: '',
      mmaudio_result_video_asset_id: '',
      mmaudioResultVideoAssetId: '',
      mmaudioVideoName: '',
      mmaudio_result: null,
      mmaudioResult: null,
      mmaudio_ready_at: '',
      mmaudioReadyAt: '',
      mmaudio_source_video_url: '',
      mmaudioSourceVideoUrl: '',
      mmaudio_source_video_api_path: '',
      mmaudioSourceVideoApiPath: '',
      mmaudio_reset_reason: reason,
      mmaudioResetReason: reason,
    }
  }


  // AVA_BOARD_BULK_STILL_IMPORT_V85:
  // Batch-import still images into scenes by filename: seg_01.png -> scene seg_01.
  // Supports both selected image files and ZIP archives, using the same asset fields as manual upload.
  function boardStillImportBasename(fileName = '') {
    return String(fileName || '')
      .split(/[\\/]/)
      .pop()
      .replace(/\.[^.]+$/, '')
      .trim()
      .toLowerCase()
  }

  function boardStillImportSceneAliases(scene = {}, index = 0) {
    const rawIds = [scene?.id, scene?.scene_id, scene?.sceneId, scene?.seg_id, scene?.segment_id, `seg_${String(index + 1).padStart(2, '0')}`]
      .map((value) => boardStillImportBasename(value))
      .filter(Boolean)
    const aliases = new Set(rawIds)
    for (const raw of rawIds) {
      const numberMatch = raw.match(/(?:seg|scene|sc)?[_\-\s]*(\d{1,4})$/i)
      if (numberMatch) {
        const n = String(Number(numberMatch[1])).padStart(2, '0')
        aliases.add(`seg_${n}`)
        aliases.add(`sc_${n}`)
        aliases.add(`scene_${n}`)
        aliases.add(n)
      }
    }
    return Array.from(aliases)
  }

  function boardStillImportSceneIdForFile(fileName = '', scenes = []) {
    const base = boardStillImportBasename(fileName)
    if (!base) return ''
    const aliasToSceneId = new Map()
    asSceneArray(scenes).forEach((scene, index) => {
      const sceneId = asText(scene?.id || scene?.scene_id || `seg_${String(index + 1).padStart(2, '0')}`)
      boardStillImportSceneAliases(scene, index).forEach((alias) => aliasToSceneId.set(alias, sceneId))
    })
    if (aliasToSceneId.has(base)) return aliasToSceneId.get(base)

    const numberMatch = base.match(/(?:^|[_\-\s])(seg|scene|sc)?[_\-\s]*(\d{1,4})(?:$|[_\-\s])/i) || base.match(/^(\d{1,4})$/)
    const rawNumber = numberMatch ? (numberMatch[2] || numberMatch[1]) : ''
    if (rawNumber) {
      const n = String(Number(rawNumber)).padStart(2, '0')
      for (const candidate of [`seg_${n}`, `sc_${n}`, `scene_${n}`, n]) {
        if (aliasToSceneId.has(candidate)) return aliasToSceneId.get(candidate)
      }
    }
    return ''
  }

  function boardStillImportImageMime(fileName = '') {
    const lower = String(fileName || '').toLowerCase()
    if (lower.endsWith('.png')) return 'image/png'
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
    if (lower.endsWith('.webp')) return 'image/webp'
    return 'image/png'
  }

  function boardStillImportIsImageFile(file = {}) {
    const name = String(file?.name || '')
    const type = String(file?.type || '')
    return type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(name)
  }

  function boardStillImportPacketNumberV129M(fileName = '') {
    const base = boardStillImportBasename(fileName)
    if (!base) return 0
    const match = base.match(/^(?:seg|scene|sc)?[_\-\s]*(\d{1,4})$/i) || base.match(/^(\d{1,4})$/)
    if (!match) return 0
    const number = Number(match[1])
    return Number.isFinite(number) && number > 0 ? number : 0
  }

  function boardStillImportSceneIdForPacketFileV129M(fileName = '', scenes = []) {
    const number = boardStillImportPacketNumberV129M(fileName)
    if (!number) return ''
    // Prefer the existing scene-id alias mapper for seg_05.png / scene_05.png,
    // then fall back to plain scene order for 1.png / 2.png.
    const aliasSceneId = boardStillImportSceneIdForFile(fileName, scenes)
    if (aliasSceneId) return aliasSceneId
    const scene = asSceneArray(scenes)[number - 1]
    return asText(scene?.id || scene?.scene_id || '')
  }

  function boardSceneImageClearPatchForSlotV129M(slot = 'image') {
    if (slot === 'last') {
      return {
        last_frame_url: '',
        lastFrameUrl: '',
        last_frame_name: '',
        lastFrameName: '',
        last_frame_api_path: '',
        lastFrameApiPath: '',
        last_image_url: '',
        lastImageUrl: '',
        last_image_name: '',
        lastImageName: '',
        last_image_asset_id: '',
        lastImageAssetId: '',
        last_image_api_path: '',
        lastImageApiPath: '',
        end_image_url: '',
        endImageUrl: '',
        end_image_name: '',
        endImageName: '',
        end_image_data_url: '',
        endImageDataUrl: '',
        end_image_asset_id: '',
        endImageAssetId: '',
        end_image_api_path: '',
        endImageApiPath: '',
      }
    }

    return {
      image_url: '',
      imageUrl: '',
      image_name: '',
      imageName: '',
      image_data_url: '',
      imageDataUrl: '',
      image_asset_id: '',
      imageAssetId: '',
      image_api_path: '',
      imageApiPath: '',
      mediaUrl: '',
      media_url: '',
      first_frame_url: '',
      firstFrameUrl: '',
      first_frame_name: '',
      firstFrameName: '',
      first_frame_api_path: '',
      firstFrameApiPath: '',
      first_image_url: '',
      firstImageUrl: '',
      first_image_name: '',
      firstImageName: '',
      first_image_asset_id: '',
      firstImageAssetId: '',
      first_image_api_path: '',
      firstImageApiPath: '',
      start_image_url: '',
      startImageUrl: '',
      start_image_name: '',
      startImageName: '',
      start_image_data_url: '',
      startImageDataUrl: '',
      start_image_asset_id: '',
      startImageAssetId: '',
      start_image_api_path: '',
      startImageApiPath: '',
    }
  }

  function boardGeneratedVideoClearPatchV129N(reason = 'source_image_media_changed_v129n') {
    return {
      video_status: '',
      videoStatus: '',
      video_error: '',
      videoError: '',
      video_job_id: '',
      videoJobId: '',
      video_status_endpoint: '',
      videoStatusEndpoint: '',
      video_queue_position: 0,
      videoQueuePosition: 0,

      video_url: '',
      videoUrl: '',
      video_api_path: '',
      videoApiPath: '',
      video_name: '',
      videoName: '',
      video_asset_id: '',
      videoAssetId: '',
      video_result: null,
      videoResult: null,
      video_ready_at: '',
      videoReadyAt: '',
      original_video_url: '',
      originalVideoUrl: '',

      // AVA_BOARD_REVIEW_CLEAR_ON_IMAGE_CHANGE_V133B:
      // A review belongs to the old video. When the source photo/frame changes,
      // bad/needs_review/posmotri must not survive into the new still state.
      video_review_status: '',
      videoReviewStatus: '',
      video_review_reason: '',
      videoReviewReason: '',
      video_review_cleared_at: new Date().toISOString(),
      videoReviewClearedAt: new Date().toISOString(),
      video_review_clear_reason: 'source_image_changed_v133b',
      videoReviewClearReason: 'source_image_changed_v133b',
      video_review_clear_token_v133b: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      videoReviewClearTokenV133B: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      video_review_reset_on_image_change_v133b: true,
      videoReviewResetOnImageChangeV133B: true,
      video_review_accept_token_v132z: '',
      videoReviewAcceptTokenV132Z: '',

      result_url: '',
      resultUrl: '',
      result_video_url: '',
      resultVideoUrl: '',
      result_video_api_path: '',
      resultVideoApiPath: '',
      result_video_asset_id: '',
      resultVideoAssetId: '',
      result_video_name: '',
      resultVideoName: '',

      mmaudio_status: '',
      mmaudioStatus: '',
      mmaudio_error: '',
      mmaudioError: '',
      mmaudio_job_id: '',
      mmaudioJobId: '',
      mmaudio_status_endpoint: '',
      mmaudioStatusEndpoint: '',
      mmaudio_video_url: '',
      mmaudioVideoUrl: '',
      mmaudio_video_api_path: '',
      mmaudioVideoApiPath: '',
      mmaudio_video_name: '',
      mmaudioVideoName: '',
      mmaudio_video_asset_id: '',
      mmaudioVideoAssetId: '',
      mmaudio_result_video_url: '',
      mmaudioResultVideoUrl: '',
      mmaudio_result_video_api_path: '',
      mmaudioResultVideoApiPath: '',
      mmaudio_result_video_asset_id: '',
      mmaudioResultVideoAssetId: '',
      mmaudio_result: null,
      mmaudioResult: null,
      mmaudio_ready_at: '',
      mmaudioReadyAt: '',
      mmaudio_source_video_url: '',
      mmaudioSourceVideoUrl: '',
      mmaudio_source_video_api_path: '',
      mmaudioSourceVideoApiPath: '',
      mmaudio_reset_reason: reason,
      mmaudioResetReason: reason,
    }
  }

  function boardImageReplacePatchV129M({ slot = 'image', fileName = '', assetId = '', assetApiPath = '', reason = 'image_replaced' } = {}) {
    const mutationAt = new Date().toISOString()
    const mutationEpoch = Date.now()
    const patch = {
      ...staleVideoPatch(reason),
      ...boardGeneratedVideoClearPatchV129N(reason),
      ...boardSceneImageClearPatchForSlotV129M(slot),
      image_status: 'asset_ready',
      imageStatus: 'asset_ready',
      image_mutation_at: mutationAt,
      imageMutationAt: mutationAt,
      image_mutation_epoch: mutationEpoch,
      imageMutationEpoch: mutationEpoch,
      image_deleted_v129o: false,
      imageDeletedV129O: false,
      first_image_deleted_v129o: false,
      firstImageDeletedV129O: false,
      last_image_deleted_v129o: false,
      lastImageDeletedV129O: false,
    }

    if (slot === 'last') {
      Object.assign(patch, {
        last_frame_url: assetApiPath,
        lastFrameUrl: assetApiPath,
        last_frame_name: fileName,
        lastFrameName: fileName,
        last_frame_api_path: assetApiPath,
        lastFrameApiPath: assetApiPath,
        last_image_url: assetApiPath,
        lastImageUrl: assetApiPath,
        last_image_name: fileName,
        lastImageName: fileName,
        last_image_asset_id: assetId,
        lastImageAssetId: assetId,
        last_image_api_path: assetApiPath,
        lastImageApiPath: assetApiPath,
        end_image_url: assetApiPath,
        endImageUrl: assetApiPath,
        end_image_name: fileName,
        endImageName: fileName,
        end_image_data_url: '',
        endImageDataUrl: '',
        end_image_asset_id: assetId,
        endImageAssetId: assetId,
        end_image_api_path: assetApiPath,
        endImageApiPath: assetApiPath,
      })
      return patch
    }

    Object.assign(patch, {
      image_url: assetApiPath,
      imageUrl: assetApiPath,
      image_name: fileName,
      imageName: fileName,
      image_data_url: '',
      imageDataUrl: '',
      image_asset_id: assetId,
      imageAssetId: assetId,
      image_api_path: assetApiPath,
      imageApiPath: assetApiPath,
      mediaUrl: assetApiPath,
      media_url: assetApiPath,
      first_frame_url: assetApiPath,
      firstFrameUrl: assetApiPath,
      first_frame_name: fileName,
      firstFrameName: fileName,
      first_frame_api_path: assetApiPath,
      firstFrameApiPath: assetApiPath,
      first_image_url: assetApiPath,
      firstImageUrl: assetApiPath,
      first_image_name: fileName,
      firstImageName: fileName,
      first_image_asset_id: assetId,
      firstImageAssetId: assetId,
      first_image_api_path: assetApiPath,
      firstImageApiPath: assetApiPath,
      start_image_url: assetApiPath,
      startImageUrl: assetApiPath,
      start_image_name: fileName,
      startImageName: fileName,
      start_image_data_url: '',
      startImageDataUrl: '',
      start_image_asset_id: assetId,
      startImageAssetId: assetId,
      start_image_api_path: assetApiPath,
      startImageApiPath: assetApiPath,
    })
    return patch
  }


  // AVA_BOARD_STILLS_IMMEDIATE_PREVIEW_V129Q:
  // Apply a local "new image selected" state to Board immediately, before asset upload.
  // This removes old image/video refs from the live scene at once, so old photos do not flash back
  // while /api/assets/media is still uploading.
  function boardImageImmediatePreviewPatchV129Q({ slot = 'image', fileName = '', reason = 'image_local_preview_v129q' } = {}) {
    const mutationAt = new Date().toISOString()
    const mutationEpoch = Date.now()
    const patch = {
      ...boardGeneratedVideoClearPatchV129N(reason),
      ...boardSceneImageClearPatchForSlotV129M(slot),
      image_status: 'uploading',
      imageStatus: 'uploading',
      image_mutation_at: mutationAt,
      imageMutationAt: mutationAt,
      image_mutation_epoch: mutationEpoch,
      imageMutationEpoch: mutationEpoch,
      image_deleted_v129o: false,
      imageDeletedV129O: false,
      first_image_deleted_v129o: false,
      firstImageDeletedV129O: false,
      last_image_deleted_v129o: false,
      lastImageDeletedV129O: false,
      image_uploading_v129q: true,
      imageUploadingV129Q: true,
      mediaMutationReplaceSave: true,
      saveMode: 'local_preview_media_mutation_v129q',
      video_source_image_debug: {
        reason,
        fileName,
        at: mutationAt,
      },
    }

    if (slot === 'last') {
      Object.assign(patch, {
        last_frame_name: fileName,
        lastFrameName: fileName,
        last_image_name: fileName,
        lastImageName: fileName,
        end_image_name: fileName,
        endImageName: fileName,
      })
      return patch
    }

    Object.assign(patch, {
      image_name: fileName,
      imageName: fileName,
      first_frame_name: fileName,
      firstFrameName: fileName,
      first_image_name: fileName,
      firstImageName: fileName,
      start_image_name: fileName,
      startImageName: fileName,
    })
    return patch
  }

  function applyBoardImagePreviewPatchV129Q(sceneId = '', patch = {}) {
    const safeSceneId = asText(sceneId)
    if (!safeSceneId) return
    let nextBoardForImmediateSave = null
    setBoard((current) => {
      let changed = false
      const nextScenes = asSceneArray(current.scenes).map((scene) => {
        const id = asText(scene.id || scene.scene_id)
        if (id !== safeSceneId) return scene
        changed = true
        return canonicalizeBoardSceneMediaRefs({ ...scene, ...patch })
      })
      if (!changed) return current
      const nextBoard = {
        ...current,
        scenes: nextScenes,
        updatedAt: new Date().toISOString(),
        mediaMutationReplaceSave: true,
        forceReplaceSave: true,
        saveMode: 'local_preview_media_mutation_v129r',
      }
      nextBoardForImmediateSave = nextBoard
      writeBoardDurableBackup(boardDurableKey({ projectId, workspaceMode }), nextBoard)
      return nextBoard
    })

    // AVA_BOARD_STILLS_CLEAR_VIDEO_IMMEDIATE_V129R:
    // Save the cleared video refs immediately, before /api/assets/media finishes. If user presses F5
    // during upload, old video refs must already be gone from the project snapshot.
    window.setTimeout(() => {
      if (nextBoardForImmediateSave) saveBoard(nextBoardForImmediateSave, true)
    }, 0)
  }

  function setBoardRuntimeImagePreviewV129Q(sceneId = '', slot = 'image', dataUrl = '') {
    const safeSceneId = asText(sceneId)
    if (!safeSceneId) return
    setRuntimeSceneMediaUrls((current) => {
      const prev = current[safeSceneId] || {}
      const nextForScene = { ...prev }
      if (slot === 'last') {
        nextForScene.last = dataUrl
        nextForScene.lastClearedV129O = false
      } else {
        nextForScene.image = dataUrl
        nextForScene.first = dataUrl
        nextForScene.imageClearedV129O = false
        nextForScene.firstClearedV129O = false
      }
      return { ...current, [safeSceneId]: nextForScene }
    })
  }




  function buildBoardStillImportPatch({ fileName = '', assetId = '', assetApiPath = '' } = {}) {
    return {
      ...boardImageReplacePatchV129M({
        slot: 'image',
        fileName,
        assetId,
        assetApiPath,
        reason: 'bulk_still_import_image_replaced_v129m',
      }),
      video_source_image_debug: {
        reason: 'bulk_still_import_replace_v129m',
        fileName,
        assetId,
        assetApiPath,
        at: new Date().toISOString(),
      },
    }
  }

  async function importBoardStillFiles(filesInput = [], sourceLabel = 'files') {
    const files = Array.from(filesInput || []).filter(boardStillImportIsImageFile)
    if (!files.length) {
      setStatus('Нет изображений для импорта кадров')
      pushBoardToast({ type: 'warning', title: 'Импорт кадров', message: 'Не найдено PNG/JPG/WEBP файлов' })
      return
    }

    const scenes = asSceneArray(boardRef.current?.scenes)
    if (!scenes.length) {
      setStatus('Нет сцен для импорта кадров')
      pushBoardToast({ type: 'warning', title: 'Импорт кадров', message: 'Сначала создай или импортируй сцены' })
      return
    }

    const jobs = []
    const invalidFiles = []
    const duplicateSceneIds = []
    const usedSceneIds = new Set()

    files.forEach((file, order) => {
      const packetNumber = boardStillImportPacketNumberV129M(file.name)
      const sceneId = boardStillImportSceneIdForPacketFileV129M(file.name, scenes)
      if (!packetNumber || !sceneId) {
        invalidFiles.push(file.name)
        return
      }
      if (usedSceneIds.has(sceneId)) {
        duplicateSceneIds.push(`${file.name} → ${sceneId}`)
        return
      }
      usedSceneIds.add(sceneId)
      jobs.push({ file, order, sceneId, packetNumber })
    })

    if (invalidFiles.length || duplicateSceneIds.length) {
      const invalidText = invalidFiles.slice(0, 5).join(', ')
      const duplicateText = duplicateSceneIds.slice(0, 5).join(', ')
      const details = [
        invalidFiles.length ? `без номера/вне диапазона: ${invalidText}${invalidFiles.length > 5 ? ` +${invalidFiles.length - 5}` : ''}` : '',
        duplicateSceneIds.length ? `дубли: ${duplicateText}${duplicateSceneIds.length > 5 ? ` +${duplicateSceneIds.length - 5}` : ''}` : '',
      ].filter(Boolean).join('; ')
      setStatus(`Импорт кадров остановлен: ${details}`)
      pushBoardToast({
        type: 'warning',
        title: 'Импорт кадров',
        message: files.length === 1
          ? 'Для одного фото с любым именем используй кнопку “Загрузить” в самой карточке Фото / Start image.'
          : `Пакет/ZIP должен быть по номерам сцен: 1.png, 2.png, seg_01.png... ${details}`,
      })
      return
    }

    setBulkStillsImporting(true)
    setStatus(`Импорт кадров: ${jobs.length}/${scenes.length} · сразу показываем preview, потом сохраняем assets`)

    const results = []

    try {
      for (let jobIndex = 0; jobIndex < jobs.length; jobIndex += 1) {
        const job = jobs[jobIndex]
        const { file, sceneId } = job
        setStatus(`Импорт кадров: ${jobIndex + 1}/${jobs.length} · очищаем старое видео · ${file.name}`)
        const dataUrl = await readFileAsDataUrl(file)

        // v129q: update live Board immediately. Do not wait for asset upload; old photo/video refs
        // must disappear right away, otherwise old snapshots/polls can flash old media back.
        setBoardRuntimeImagePreviewV129Q(sceneId, 'image', dataUrl)
        applyBoardImagePreviewPatchV129Q(sceneId, boardImageImmediatePreviewPatchV129Q({
          slot: 'image',
          fileName: file.name,
          reason: 'bulk_still_local_preview_v129q',
        }))

        const uploaded = await uploadMediaAsset({
          file,
          projectId: workspaceMode ? null : projectId,
          kind: 'image',
          stage: 'board_images',
        })
        const assetId = uploaded.asset_id || uploaded.assetId || ''
        const assetApiPath = uploaded.asset_api_path || uploaded.assetApiPath || (assetId ? `/assets/${assetId}/file` : '')
        if (!assetId || !assetApiPath) throw new Error(`image_asset_upload_missing_asset_id:${file.name}`)

        // AVA_BOARD_BATCH_PHOTO_LOADING_STATUS_V144B:
        // As soon as one packet/ZIP image asset is uploaded, commit it to that scene immediately.
        // Do not wait for the whole packet, otherwise the first scene can briefly fall back
        // from local preview to prompt/draft until the last file finishes.
        const readyPatchV144B = buildBoardStillImportPatch({ fileName: file.name, assetId, assetApiPath })
        let nextBoardForReadySaveV144B = null
        setBoard((current) => {
          let changed = false
          const nextScenes = asSceneArray(current.scenes).map((scene) => {
            const itemSceneId = asText(scene.id || scene.scene_id)
            if (itemSceneId !== sceneId) return scene
            changed = true
            return canonicalizeBoardSceneMediaRefs({
              ...scene,
              ...readyPatchV144B,
            })
          })
          if (!changed) return current
          nextBoardForReadySaveV144B = {
            ...current,
            scenes: nextScenes,
            updatedAt: new Date().toISOString(),
            mediaMutationReplaceSave: true,
            saveMode: 'packet_image_asset_ready_v144b',
          }
          writeBoardDurableBackup(boardDurableKey({ projectId, workspaceMode }), nextBoardForReadySaveV144B)
          return nextBoardForReadySaveV144B
        })
        window.setTimeout(() => {
          if (nextBoardForReadySaveV144B) saveBoard(nextBoardForReadySaveV144B, true)
        }, 0)

        results.push({ sceneId, fileName: file.name, assetId, assetApiPath })
        console.log('[BOARD STILL IMPORT REPLACE]', { sourceLabel, sceneId, fileName: file.name, assetId, assetApiPath })
      }

      const resultBySceneId = new Map(results.map((item) => [item.sceneId, item]))
      let nextBoardForSave = null
      setBoard((current) => {
        const nextScenes = asSceneArray(current.scenes).map((scene) => {
          const sceneId = asText(scene.id || scene.scene_id)
          const result = resultBySceneId.get(sceneId)
          if (!result) return scene
          return canonicalizeBoardSceneMediaRefs({
            ...scene,
            ...buildBoardStillImportPatch({ fileName: result.fileName, assetId: result.assetId, assetApiPath: result.assetApiPath }),
          })
        })
        nextBoardForSave = {
          ...current,
          scenes: nextScenes,
          updatedAt: new Date().toISOString(),
          mediaMutationReplaceSave: true,
          saveMode: 'replace_media_mutation_v129n',
          stills_import_last_result: {
            source: sourceLabel,
            imported: results.length,
            replaced: results.length,
            packetMode: 'numbered_scene_order_v129n',
            at: new Date().toISOString(),
          },
        }
        return nextBoardForSave
      })

      window.setTimeout(() => {
        if (nextBoardForSave) saveBoard(nextBoardForSave, true)
      }, 0)

      setStatus(`Импорт кадров: заменено ${results.length}/${scenes.length}. Старые видео refs очищены, F5 держит asset refs.`)
      pushBoardToast({
        type: 'success',
        title: 'Импорт кадров',
        message: `Заменено фото в сценах: ${results.length}/${scenes.length}`,
      })
      console.log('[BOARD STILL IMPORT REPLACE SUMMARY]', { sourceLabel, filesFound: files.length, imported: results.length, snapshotSaved: true, replaceSave: true })
    } catch (error) {
      console.error('[BOARD STILL IMPORT FAILED]', error)
      setStatus(`Ошибка импорта кадров: ${error?.message || 'unknown error'}`)
      pushBoardToast({ type: 'error', title: 'Импорт кадров не выполнен', message: error?.message || 'unknown error' })
    } finally {
      setBulkStillsImporting(false)
    }
  }



  async function importBoardStillFilesFromInput(event) {
    const files = event.target.files ? Array.from(event.target.files) : []
    event.target.value = ''
    await importBoardStillFiles(files, 'selected_files')
  }

  async function importBoardStillZipFromInput(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBulkStillsImporting(true)
    setStatus(`Читаем ZIP кадров: ${file.name}`)
    try {
      const zip = await JSZip.loadAsync(file)
      const imageEntries = Object.values(zip.files).filter((entry) => !entry.dir && /\.(png|jpe?g|webp)$/i.test(entry.name || ''))
      const files = []
      for (const entry of imageEntries) {
        const safeName = String(entry.name || '').split(/[\\/]/).pop()
        if (!safeName || safeName.includes('..')) continue
        const blob = await entry.async('blob')
        files.push(new File([blob], safeName, { type: boardStillImportImageMime(safeName) }))
      }
      setBulkStillsImporting(false)
      await importBoardStillFiles(files, `zip:${file.name}`)
    } catch (error) {
      console.error('[BOARD STILL ZIP IMPORT FAILED]', error)
      setStatus(`Ошибка ZIP импорта: ${error?.message || 'unknown error'}`)
      pushBoardToast({ type: 'error', title: 'ZIP импорт кадров', message: error?.message || 'unknown error' })
      setBulkStillsImporting(false)
    }
  }


  // AVA_BOARD_IMAGE_UPLOAD_FORCE_COMMIT_V132N4:
  // Strong manual image upload patch. It is applied after the image asset is uploaded,
  // before saving the Board snapshot. It writes the new asset/apiPath into every known
  // image field for the selected slot and clears stale video/review/job state.
  function buildImageUploadForceCommitPatchV132N4({
    fieldUrl = '',
    fieldName = '',
    statusField = '',
    mediaSlot = 'image',
    fileName = '',
    assetId = '',
    assetApiPath = '',
    dataUrl = '',
    reason = 'manual_image_asset_ready_v132n4',
  } = {}) {
    const imageMutationEpochV132N4 = Date.now()
    const imageSourceV132N4 = assetApiPath || dataUrl || ''
    const patch = {
      image_mutation_epoch: imageMutationEpochV132N4,
      imageMutationEpoch: imageMutationEpochV132N4,
      image_mutation_at: new Date().toISOString(),
      imageMutationAt: new Date().toISOString(),

      video_asset_id: '',
      videoAssetId: '',
      video_api_path: '',
      videoApiPath: '',
      video_url: '',
      videoUrl: '',
      video_static_url: '',
      videoStaticUrl: '',
      result_video_asset_id: '',
      resultVideoAssetId: '',
      result_video_api_path: '',
      resultVideoApiPath: '',
      result_video_url: '',
      resultVideoUrl: '',
      video_source_image_asset_id: '',
      videoSourceImageAssetId: '',
      video_source_image_api_path: '',
      videoSourceImageApiPath: '',
      video_source_image_url: '',
      videoSourceImageUrl: '',
      video_source_image_mutation_epoch: '',
      videoSourceImageMutationEpoch: '',
      video_source_bound_at: '',
      videoSourceBoundAt: '',

      video_status: '',
      videoStatus: '',
      video_error: '',
      videoError: '',
      video_job_id: '',
      videoJobId: '',
      video_status_endpoint: '',
      videoStatusEndpoint: '',
      video_queue_position: null,
      videoQueuePosition: null,
      video_queue_source: '',
      videoQueueSource: '',

      video_review_status: '',
      videoReviewStatus: '',
      review_status: '',
      reviewStatus: '',
      video_review_reason: '',
      videoReviewReason: '',
      review_reason: '',
      reviewReason: '',
      video_review_regenerate_from_bad: false,
      videoReviewRegenerateFromBad: false,
      video_review_regenerate_reason: '',
      videoReviewRegenerateReason: '',
      bad_video_review: false,
      badVideoReview: false,
      video_review_bad: false,
      videoReviewBad: false,
      video_bad: false,
      videoBad: false,
      is_bad_video: false,
      isBadVideo: false,

      image_asset_committed_v132n4: true,
      imageAssetCommittedV132N4: true,
      image_replace_reason_v132n4: reason,
      imageReplaceReasonV132N4: reason,
    }

    if (fieldUrl) patch[fieldUrl] = imageSourceV132N4
    if (fieldName) patch[fieldName] = fileName
    if (statusField) patch[statusField] = assetApiPath ? 'asset_ready' : (dataUrl ? 'local_pending' : '')

    const dataField = sceneDataFieldByUrlField(fieldUrl)
    if (dataField) patch[dataField] = assetApiPath ? '' : dataUrl

    if (mediaSlot === 'last') {
      Object.assign(patch, {
        last_frame_url: imageSourceV132N4,
        lastFrameUrl: imageSourceV132N4,
        last_frame_name: fileName,
        lastFrameName: fileName,
        last_frame_api_path: assetApiPath,
        lastFrameApiPath: assetApiPath,
        last_frame_asset_id: assetId,
        lastFrameAssetId: assetId,

        last_image_url: imageSourceV132N4,
        lastImageUrl: imageSourceV132N4,
        last_image_name: fileName,
        lastImageName: fileName,
        last_image_asset_id: assetId,
        lastImageAssetId: assetId,
        last_image_api_path: assetApiPath,
        lastImageApiPath: assetApiPath,

        end_image_url: imageSourceV132N4,
        endImageUrl: imageSourceV132N4,
        end_image_name: fileName,
        endImageName: fileName,
        end_image_data_url: assetApiPath ? '' : dataUrl,
        endImageDataUrl: assetApiPath ? '' : dataUrl,
        end_image_asset_id: assetId,
        endImageAssetId: assetId,
        end_image_api_path: assetApiPath,
        endImageApiPath: assetApiPath,

        last_image_mutation_epoch: imageMutationEpochV132N4,
        lastImageMutationEpoch: imageMutationEpochV132N4,
      })
      return patch
    }

    Object.assign(patch, {
      image_url: imageSourceV132N4,
      imageUrl: imageSourceV132N4,
      image_name: fileName,
      imageName: fileName,
      image_data_url: assetApiPath ? '' : dataUrl,
      imageDataUrl: assetApiPath ? '' : dataUrl,
      image_asset_id: assetId,
      imageAssetId: assetId,
      image_api_path: assetApiPath,
      imageApiPath: assetApiPath,
      mediaUrl: imageSourceV132N4,
      media_url: imageSourceV132N4,

      first_frame_url: imageSourceV132N4,
      firstFrameUrl: imageSourceV132N4,
      first_frame_name: fileName,
      firstFrameName: fileName,
      first_frame_api_path: assetApiPath,
      firstFrameApiPath: assetApiPath,
      first_frame_asset_id: assetId,
      firstFrameAssetId: assetId,

      first_image_url: imageSourceV132N4,
      firstImageUrl: imageSourceV132N4,
      first_image_name: fileName,
      firstImageName: fileName,
      first_image_asset_id: assetId,
      firstImageAssetId: assetId,
      first_image_api_path: assetApiPath,
      firstImageApiPath: assetApiPath,

      start_image_url: imageSourceV132N4,
      startImageUrl: imageSourceV132N4,
      start_image_name: fileName,
      startImageName: fileName,
      start_image_data_url: assetApiPath ? '' : dataUrl,
      startImageDataUrl: assetApiPath ? '' : dataUrl,
      start_image_asset_id: assetId,
      startImageAssetId: assetId,
      start_image_api_path: assetApiPath,
      startImageApiPath: assetApiPath,

      start_image_mutation_epoch: imageMutationEpochV132N4,
      startImageMutationEpoch: imageMutationEpochV132N4,
      first_image_mutation_epoch: imageMutationEpochV132N4,
      firstImageMutationEpoch: imageMutationEpochV132N4,
    })

    return patch
  }

  async function setSceneFile(scene, fieldUrl, fieldName, statusField, event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const sceneId = asText(scene?.id || scene?.scene_id)
    if (!sceneId) return

    const mediaSlot = mediaSlotByUrlField(fieldUrl)

    try {
      setStatus(`Фото сцены: очищаем старое видео и готовим preview · ${file.name}`)
      const dataUrl = await readFileAsDataUrl(file)
      // v129q: hard-switch the selected scene to the new local preview immediately.
      // This prevents the old asset image from flashing while /api/assets/media uploads.
      setBoardRuntimeImagePreviewV129Q(sceneId, mediaSlot, dataUrl)
      applyBoardImagePreviewPatchV129Q(sceneId, boardImageImmediatePreviewPatchV129Q({
        slot: mediaSlot,
        fileName: file.name,
        reason: `manual_image_local_preview_${fieldUrl}_v129q`,
      }))

      setStatus(`Фото сцены: загружаем asset · ${file.name}`)
      const uploaded = await uploadMediaAsset({
        file,
        projectId: workspaceMode ? null : projectId,
        kind: 'image',
        stage: 'board_images',
      })
      const assetId = uploaded.asset_id || uploaded.assetId || ''
      const assetApiPath = uploaded.asset_api_path || uploaded.assetApiPath || (assetId ? `/assets/${assetId}/file` : '')
      if (!assetId || !assetApiPath) throw new Error('image_asset_upload_missing_asset_id')

      const patch = {
        ...boardImageReplacePatchV129M({
          slot: mediaSlot,
          fileName: file.name,
          assetId,
          assetApiPath,
          reason: `manual_image_replaced_${fieldUrl}_v129n`,
        }),
        [fieldUrl]: assetApiPath,
        [fieldName]: file.name,
        [statusField]: 'asset_ready',
        video_source_image_debug: {
          reason: `manual_image_replace_${fieldUrl}_v129n`,
          fileName: file.name,
          assetId,
          assetApiPath,
          at: new Date().toISOString(),
        },
      }

      const dataField = sceneDataFieldByUrlField(fieldUrl)
      if (dataField) patch[dataField] = ''

      Object.assign(patch, buildImageUploadForceCommitPatchV132N4({
        fieldUrl,
        fieldName,
        statusField,
        mediaSlot,
        fileName: file.name,
        assetId,
        assetApiPath,
        dataUrl,
        reason: `manual_image_replaced_${fieldUrl}_v132n4`,
      }))

      let nextBoardForSave = null
      setBoard((current) => {
        let changed = false
        const nextScenes = asSceneArray(current.scenes).map((item) => {
          const itemId = asText(item.id || item.scene_id)
          if (itemId !== sceneId) return item
          changed = true
          return canonicalizeBoardSceneMediaRefs({ ...item, ...patch })
        })
        if (!changed) return current
        nextBoardForSave = {
          ...current,
          scenes: nextScenes,
          updatedAt: new Date().toISOString(),
          mediaMutationReplaceSave: true,
          saveMode: 'replace_media_mutation_v129n',
        }
        return nextBoardForSave
      })

      window.setTimeout(() => {
        if (nextBoardForSave) saveBoard(nextBoardForSave, true)
      }, 0)

      console.log('[BOARD IMAGE ASSET COMMITTED V132N4]', { sceneId, slot: mediaSlot, fileName: file.name, assetId, assetApiPath, sourceField: fieldUrl, success: true })
      console.log('[BOARD IMAGE MANUAL REPLACE]', { sceneId, slot: mediaSlot, assetId, apiPath: assetApiPath, sourceField: fieldUrl, success: true, replaceSave: true })
      setStatus(`Фото сцены заменено: ${file.name}; старые video refs очищены, F5 сохранит asset ref`)
    } catch (error) {
      console.error('[Board] setSceneFile failed', error)
      setStatus(`Не удалось загрузить изображение: ${error?.message || 'unknown error'}`)
      pushBoardToast({ type: 'error', title: 'Фото не загружено', message: error?.message || 'unknown error' })
    }
  }




  function clearSceneFile(scene, fields) {
    // AVA_BOARD_DELETE_DIRECT_REPLACE_V129U:
    // This path must be destructive. It must not call saveBoard/safe_merge,
    // because safe_merge/preserve can resurrect the old image/video refs.
    const sceneId = asText(scene?.id || scene?.scene_id || scene?.sceneId || '')
    if (!sceneId) {
      setStatus('Не удалось удалить фото: sceneId пустой')
      return
    }

    const safeFields = Array.isArray(fields) ? fields.map((field) => String(field || '')) : []
    const deleteLastSlot = safeFields.some((field) => field === 'last_frame_url' || field === 'end_image_url')
    const resetToken = `image_delete_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const now = new Date().toISOString()

    const clearImageAndVideoPatch = {
      // Markers for frontend/backend race guards.
      media_reset_generation_v129s: resetToken,
      mediaResetGenerationV129S: resetToken,
      media_reset_generation_v129t: resetToken,
      mediaResetGenerationV129T: resetToken,
      media_reset_generation_v129u: resetToken,
      mediaResetGenerationV129U: resetToken,
      image_delete_reason_v129s: 'manual_delete_button',
      imageDeleteReasonV129S: 'manual_delete_button',
      image_delete_reason_v129t: 'manual_delete_button',
      imageDeleteReasonV129T: 'manual_delete_button',
      image_delete_reason_v129u: 'manual_delete_direct_replace',
      imageDeleteReasonV129U: 'manual_delete_direct_replace',
      source_image_changed_at: now,
      sourceImageChangedAt: now,
      video_stale_after_image_change_v129p: true,
      videoStaleAfterImageChangeV129P: true,

      // Main/start image refs. In ia2v, image and first frame are aliases and must be cleared together.
      image_url: '',
      imageUrl: '',
      image_api_path: '',
      imageApiPath: '',
      image_asset_id: '',
      imageAssetId: '',
      image_name: '',
      imageName: '',
      image_status: '',
      imageStatus: '',
      image_data_url: '',
      imageDataUrl: '',
      mediaUrl: '',
      media_url: '',

      first_frame_url: '',
      firstFrameUrl: '',
      first_frame_api_path: '',
      firstFrameApiPath: '',
      first_frame_asset_id: '',
      firstFrameAssetId: '',
      first_frame_name: '',
      firstFrameName: '',
      start_image_url: '',
      startImageUrl: '',
      start_image_api_path: '',
      startImageApiPath: '',
      start_image_asset_id: '',
      startImageAssetId: '',
      start_image_data_url: '',
      startImageDataUrl: '',
      first_image_url: '',
      firstImageUrl: '',
      first_image_api_path: '',
      firstImageApiPath: '',
      first_image_asset_id: '',
      firstImageAssetId: '',
      first_image_name: '',
      firstImageName: '',

      // Last frame refs too. If this was a first-last scene, Delete should be final for the visible slot;
      // clearing all image slots is safer in manual Board because stale aliases have been leaking across slots.
      last_frame_url: '',
      lastFrameUrl: '',
      last_frame_api_path: '',
      lastFrameApiPath: '',
      last_frame_asset_id: '',
      lastFrameAssetId: '',
      last_frame_name: '',
      lastFrameName: '',
      end_image_url: '',
      endImageUrl: '',
      end_image_api_path: '',
      endImageApiPath: '',
      end_image_asset_id: '',
      endImageAssetId: '',
      end_image_data_url: '',
      endImageDataUrl: '',
      last_image_url: '',
      lastImageUrl: '',
      last_image_api_path: '',
      lastImageApiPath: '',
      last_image_asset_id: '',
      lastImageAssetId: '',
      last_image_name: '',
      lastImageName: '',

      // Generated video refs and active job refs. These must die before upload/save finishes.
      video_status: '',
      videoStatus: '',
      video_error: '',
      videoError: '',
      video_job_id: '',
      videoJobId: '',
      video_status_endpoint: '',
      videoStatusEndpoint: '',
      video_queue_position: 0,
      videoQueuePosition: 0,
      video_url: '',
      videoUrl: '',
      video_api_path: '',
      videoApiPath: '',
      video_asset_id: '',
      videoAssetId: '',
      video_name: '',
      videoName: '',
      original_video_url: '',
      originalVideoUrl: '',
      video_result: null,
      videoResult: null,
      video_ready_at: '',
      videoReadyAt: '',
      result_url: '',
      resultUrl: '',
      result_video_url: '',
      resultVideoUrl: '',
      result_video_api_path: '',
      resultVideoApiPath: '',
      result_video_asset_id: '',
      resultVideoAssetId: '',
      result_video_name: '',
      resultVideoName: '',
      video_source_image_asset_id: '',
      videoSourceImageAssetId: '',
      video_source_image_api_path: '',
      videoSourceImageApiPath: '',

      // MMAudio belongs to old base video.
      mmaudio_status: '',
      mmaudioStatus: '',
      mmaudio_error: '',
      mmaudioError: '',
      mmaudio_job_id: '',
      mmaudioJobId: '',
      mmaudio_status_endpoint: '',
      mmaudioStatusEndpoint: '',
      mmaudio_video_url: '',
      mmaudioVideoUrl: '',
      mmaudio_video_api_path: '',
      mmaudioVideoApiPath: '',
      mmaudio_video_asset_id: '',
      mmaudioVideoAssetId: '',
      mmaudio_video_name: '',
      mmaudioVideoName: '',
      mmaudio_result: null,
      mmaudioResult: null,
      mmaudio_result_video_url: '',
      mmaudioResultVideoUrl: '',
      mmaudio_result_video_api_path: '',
      mmaudioResultVideoApiPath: '',
      mmaudio_result_video_asset_id: '',
      mmaudioResultVideoAssetId: '',
      mmaudio_ready_at: '',
      mmaudioReadyAt: '',
      mmaudio_source_video_url: '',
      mmaudioSourceVideoUrl: '',
      mmaudio_source_video_api_path: '',
      mmaudioSourceVideoApiPath: '',
      mmaudio_reset_reason: 'image_deleted_direct_replace_v129u',
      mmaudioResetReason: 'image_deleted_direct_replace_v129u',
    }

    let nextBoardForReplace = null
    setRuntimeSceneMediaUrls((current) => {
      const next = { ...(current || {}) }
      delete next[sceneId]
      return next
    })
    setSelectedVideoBlobUrl('')
    setSelectedVideoLoadError('')
    setStatus('Удаляем фото и старое видео…')

    setBoard((current) => {
      const nextScenes = asSceneArray(current.scenes).map((item) => {
        const itemId = asText(item?.id || item?.scene_id || item?.sceneId || '')
        if (itemId !== sceneId) return item
        return {
          ...item,
          ...clearImageAndVideoPatch,
          updatedAt: now,
        }
      })
      nextBoardForReplace = {
        ...current,
        scenes: nextScenes,
        selectedSceneId: current.selectedSceneId || sceneId,
        updatedAt: now,
        last_media_delete_v129u: { sceneId, fields: safeFields, resetToken, at: now },
      }
      try {
        writeBoardDurableBackup(boardDurableKey({ projectId, workspaceMode }), nextBoardForReplace)
      } catch (error) {
        console.warn('[BOARD IMAGE DELETE DIRECT REPLACE V129U] local durable save failed', error)
      }
      return nextBoardForReplace
    })

    window.setTimeout(async () => {
      if (!nextBoardForReplace) return
      const payload = {
        ...sanitizeBoardDurableBackup(canonicalizeBoardMediaRefs(nextBoardForReplace)),
        boardVersion: BOARD_VERSION,
        source: workspaceMode ? (nextBoardForReplace.source || 'board') : (nextBoardForReplace.source === 'standalone_board' ? 'project_board' : (nextBoardForReplace.source || 'project_board')),
        updatedAt: new Date().toISOString(),
      }
      try {
        console.log('[BOARD IMAGE DELETE DIRECT REPLACE V129U]', {
          sceneId,
          fields: safeFields,
          resetToken,
          imageRefsLeft: asSceneArray(payload.scenes).filter((item) => (
            item.image_asset_id || item.imageAssetId || item.image_api_path || item.imageApiPath ||
            item.first_image_asset_id || item.firstImageAssetId || item.first_image_api_path || item.firstImageApiPath ||
            item.last_image_asset_id || item.lastImageAssetId || item.last_image_api_path || item.lastImageApiPath
          )).length,
          videoRefsLeft: asSceneArray(payload.scenes).filter((item) => (
            item.video_asset_id || item.videoAssetId || item.video_api_path || item.videoApiPath || item.video_url || item.videoUrl
          )).length,
        })
        if (workspaceMode) {
          await saveWorkspaceStage(STAGE, payload)
        } else {
          await saveStage(projectId, STAGE, payload, 'replace')
        }
        setStatus('Фото удалено. Старое видео очищено.')
      } catch (error) {
        console.error('[BOARD IMAGE DELETE DIRECT REPLACE V129U] save failed', error)
        setStatus(`Ошибка удаления фото: ${error?.message || 'save_failed'}`)
      }
    }, 0)
  }



function boardAudioSourcePayloadForBackend() {
    const sourceBoard = boardRef.current || board || {}
    const sourceAudio = sourceBoard.audio || board.audio || {}
    const projectIdForAudioV201A = projectId || sourceBoard.project_id || sourceBoard.projectId || board.project_id || board.projectId || ''
    return {
      project_id: projectIdForAudioV201A,
      projectId: projectIdForAudioV201A,
      audio_url: sourceAudio?.url || sourceAudio?.src || sourceBoard.audioUrl || sourceBoard.audio_url || board.audioUrl || board.audio_url || '',
      audio_asset_id: sourceAudio?.assetId || sourceAudio?.asset_id || sourceBoard.audioAssetId || sourceBoard.audio_asset_id || board.audioAssetId || board.audio_asset_id || '',
      audio_asset_api_path: sourceAudio?.assetApiPath || sourceAudio?.asset_api_path || sourceBoard.audioApiPath || sourceBoard.audio_api_path || board.audioApiPath || board.audio_api_path || '',
    }
  }

  function isIa2vRoute(route) {
    return isBoardAudioDrivenRouteV154A(route)
  }


  // AVA_BOARD_MANUAL_LIPSYNC_UPLOAD_V129A:
  // Standalone/manual Board gets its own per-scene audio asset upload.
  // Timing-imported Board keeps the existing slice-audio flow unchanged.
  function manualLipSyncSceneIdV129A(scene = {}) {
    return asText(scene?.id || scene?.scene_id || scene?.sceneId || '')
  }

  function manualLipSyncAudioAssetIdV129A(scene = {}) {
    return asText(
      scene?.audio_slice_asset_id ||
      scene?.audioSliceAssetId ||
      scene?.manual_lipsync_audio_asset_id ||
      scene?.manualLipSyncAudioAssetId ||
      boardAssetIdFromRef(
        scene?.audio_slice_api_path,
        scene?.audioSliceApiPath,
        scene?.audio_slice_url,
        scene?.audioSliceUrl,
        scene?.manual_lipsync_audio_url,
        scene?.manualLipSyncAudioUrl
      ) ||
      ''
    )
  }

  function manualLipSyncAudioSourceV129A(scene = {}) {
    const direct = asText(
      scene?.audio_slice_api_path ||
      scene?.audioSliceApiPath ||
      scene?.audio_slice_url ||
      scene?.audioSliceUrl ||
      scene?.manual_lipsync_audio_api_path ||
      scene?.manualLipSyncAudioApiPath ||
      scene?.manual_lipsync_audio_url ||
      scene?.manualLipSyncAudioUrl ||
      ''
    )

    // Generation must use a server asset/static ref, never a runtime blob/data URL.
    if (direct && !direct.startsWith('blob:') && !direct.startsWith('data:')) return direct

    const assetId = manualLipSyncAudioAssetIdV129A(scene)
    return assetId ? `/assets/${assetId}/file` : ''
  }

  function manualLipSyncAudioPreviewUrlV129A(scene = {}) {
    const sceneId = manualLipSyncSceneIdV129A(scene)
    if (sceneId && manualLipSyncAudioPreviewUrlsV129A[sceneId]) {
      return manualLipSyncAudioPreviewUrlsV129A[sceneId]
    }
    return ''
  }

  function clearMissingAudioVideoErrorPatchV129A(scene = {}) {
    const status = String(scene?.video_status || '').toLowerCase()
    const error = String(scene?.video_error || '')
    if (status !== 'error') return {}
    if (!/audio[_\s-]*slice|missing[_\s-]*audio|нет\s+audio/i.test(error)) return {}
    return {
      video_status: '',
      video_error: '',
      video_start_warnings: [],
    }
  }

  async function markAudioSlicePlanned() {
    if (!selectedScene) return

    if (!isIa2vRoute(selectedScene.route)) {
      setStatus('Audio slice нужен только для ia2v / lip-sync режима.')
      return
    }

    const start = toNumber(selectedScene.start, 0)
    const end = toNumber(selectedScene.end, start)
    if (!(end > start)) {
      setStatus('У сцены нет корректных ручных границ start/end.')
      return
    }

    const sourcePayload = boardAudioSourcePayloadForBackend()
    if (!sourcePayload.audio_url && !sourcePayload.audio_asset_id && !sourcePayload.audio_asset_api_path) {
      updateScene(selectedScene.id, {
        audio_slice_status: 'error',
        audio_slice_error: 'missing_board_audio_source',
      })
      setStatus('В Board нет исходного audio asset. Нажми “Обновить” или проверь audio.assetApiPath.')
      return
    }

    updateScene(selectedScene.id, {
      audio_slice_status: 'extracting',
      audio_slice_error: '',
    })

    try {
      setStatus(`POST /api/manual-clip/slice-audio · ${selectedScene.id}`)

      const data = await apiRequest('/manual-clip/slice-audio', {
        method: 'POST',
        body: JSON.stringify({
          ...sourcePayload,
          scene_id: selectedScene.id,
          start_sec: start,
          end_sec: end,
          duration_sec: Math.max(0, end - start),
          format: 'mp3',
        }),
      })

      const audioSliceUrl = data.audio_slice_url || data.audioSliceUrl || ''
      const audioSliceName = data.audio_slice_name || data.audioSliceName || ''

      updateScene(selectedScene.id, {
        audio_slice_status: 'ready',
        audio_slice_url: audioSliceUrl,
        audio_slice_api_path: data.audio_slice_api_path || data.audioSliceApiPath || '',
        audio_slice_name: audioSliceName,
        audio_slice_mime: data.mimeType || 'audio/mpeg',
        audio_slice_start: data.startSec ?? start,
        audio_slice_end: data.endSec ?? end,
        audio_slice_duration: data.durationSec ?? Math.max(0, end - start),
        audio_slice_source: data.source || 'manual_scene_range_server_mp3',
        audio_slice_source_asset_api_path: sourcePayload.audio_asset_api_path,
        audio_slice_error: '',
      })

      setStatus(`Audio slice готов: ${audioSliceName || audioSliceUrl || selectedScene.id}`)
    } catch (error) {
      console.error('[Board] backend audio slice failed', error)
      updateScene(selectedScene.id, {
        audio_slice_status: 'error',
        audio_slice_error: error?.message || 'slice_audio_failed',
      })
      setStatus(`Не удалось изъять аудио: ${error?.message || 'unknown error'}`)
    }
  }


  function canAutoExtractSceneAudioSliceV200W(scene = {}) {
    if (!isIa2vRoute(scene?.route)) return false
    if (manualLipSyncAudioSourceV129A(scene)) return false
    const start = toNumber(scene?.start_sec ?? scene?.start ?? scene?.scene_start_sec ?? scene?.sceneStartSec, 0)
    const end = toNumber(scene?.end_sec ?? scene?.end ?? scene?.scene_end_sec ?? scene?.sceneEndSec, start)
    if (!(end > start)) return false
    const sourcePayload = boardAudioSourcePayloadForBackend()
    // AVA_BOARD_MANUAL_AUTOSLICE_PROJECT_FALLBACK_V201A:
    // /manual-clip/slice-audio can resolve master audio from project assets when project_id is sent.
    return Boolean(
      sourcePayload.audio_url ||
      sourcePayload.audio_asset_id ||
      sourcePayload.audio_asset_api_path ||
      sourcePayload.project_id ||
      sourcePayload.projectId
    )
  }

  function audioSliceReadyPatchFromServerV200W(data = {}, scene = {}) {
    const sceneId = manualLipSyncSceneIdV129A(scene)
    const start = toNumber(scene?.start_sec ?? scene?.start ?? scene?.scene_start_sec ?? scene?.sceneStartSec, 0)
    const end = toNumber(scene?.end_sec ?? scene?.end ?? scene?.scene_end_sec ?? scene?.sceneEndSec, start)
    const audioSliceUrl = asText(data.audio_slice_url || data.audioSliceUrl || data.audio_slice_api_path || data.audioSliceApiPath || '')
    const audioSliceApiPath = asText(data.audio_slice_api_path || data.audioSliceApiPath || audioSliceUrl || '')
    const audioSliceName = asText(data.audio_slice_name || data.audioSliceName || `${sceneId || 'scene'}_audio_slice.mp3`)
    const duration = toNumber(data.durationSec ?? data.duration_sec ?? data.audio_slice_duration ?? data.audioSliceDuration ?? Math.max(0, end - start), Math.max(0, end - start))
    return {
      audio_slice_status: 'ready',
      audioSliceStatus: 'ready',
      audio_slice_url: audioSliceUrl,
      audioSliceUrl: audioSliceUrl,
      audio_slice_api_path: audioSliceApiPath,
      audioSliceApiPath: audioSliceApiPath,
      audio_slice_name: audioSliceName,
      audioSliceName: audioSliceName,
      audio_slice_mime: data.mimeType || data.mime_type || 'audio/mpeg',
      audioSliceMime: data.mimeType || data.mime_type || 'audio/mpeg',
      audio_slice_start: data.startSec ?? data.start_sec ?? start,
      audioSliceStart: data.startSec ?? data.start_sec ?? start,
      audio_slice_end: data.endSec ?? data.end_sec ?? end,
      audioSliceEnd: data.endSec ?? data.end_sec ?? end,
      audio_slice_duration: duration,
      audioSliceDuration: duration,
      audio_slice_source: data.source || 'manual_video_start_auto_slice_v200w',
      audioSliceSource: data.source || 'manual_video_start_auto_slice_v200w',
      audio_slice_error: '',
      audioSliceError: '',
    }
  }

  async function ensureAudioSliceForManualVideoStartV200W(scene = {}) {
    if (!canAutoExtractSceneAudioSliceV200W(scene)) return scene

    const sceneId = manualLipSyncSceneIdV129A(scene)
    const start = toNumber(scene?.start_sec ?? scene?.start ?? scene?.scene_start_sec ?? scene?.sceneStartSec, 0)
    const end = toNumber(scene?.end_sec ?? scene?.end ?? scene?.scene_end_sec ?? scene?.sceneEndSec, start)
    const sourcePayload = boardAudioSourcePayloadForBackend()

    updateSceneAndSave(sceneId, {
      audio_slice_status: 'extracting',
      audioSliceStatus: 'extracting',
      audio_slice_error: '',
      audioSliceError: '',
    })
    setStatus(`Авто-изъятие audio slice для lip-sync · ${sceneId}`)
    pushBoardToast({
      type: 'info',
      title: 'Audio slice',
      message: `Сцена ${sceneId}: режем аудио из Тайминга перед генерацией.`,
      sceneId,
      dedupeKey: `board:auto_slice_v200w:${sceneId}`,
    })

    try {
      const data = await apiRequest('/manual-clip/slice-audio', {
        method: 'POST',
        body: JSON.stringify({
          ...sourcePayload,
          scene_id: sceneId,
          sceneId,
          start_sec: start,
          startSec: start,
          end_sec: end,
          endSec: end,
          duration_sec: Math.max(0, end - start),
          durationSec: Math.max(0, end - start),
          format: 'mp3',
          source: 'board_manual_video_start_auto_slice_v200w',
        }),
      })
      const patch = audioSliceReadyPatchFromServerV200W(data, scene)
      updateSceneAndSave(sceneId, patch)
      setStatus(`Audio slice готов автоматически · ${sceneId}`)
      return { ...scene, ...patch }
    } catch (error) {
      console.error('[Board] auto audio slice before video failed V200W', error)
      const message = error?.message || 'auto_slice_audio_failed'
      updateSceneAndSave(sceneId, {
        audio_slice_status: 'error',
        audioSliceStatus: 'error',
        audio_slice_error: message,
        audioSliceError: message,
      })
      throw error
    }
  }

  async function uploadManualLipSyncAudioFromInputV129A(event) {
    const file = event?.target?.files?.[0]
    if (event?.target) event.target.value = ''
    if (!file || !selectedScene) return

    if (!manualSceneToolsEnabled || !isIa2vRoute(selectedScene.route)) {
      setStatus('Ручная загрузка audio доступна только в обычной Board lip-sync сцене.')
      return
    }

    const sceneId = manualLipSyncSceneIdV129A(selectedScene)
    if (!sceneId) {
      setStatus('Сначала выбери сцену для audio.')
      return
    }

    const fileName = file.name || 'audio'
    const looksAudio = /^audio\//i.test(file.type || '') || /\.(mp3|wav|m4a|aac|ogg|oga|webm|flac)$/i.test(fileName)
    if (!looksAudio) {
      setStatus('Нужен audio файл: mp3/wav/m4a/aac/ogg/webm/flac.')
      return
    }

    let localPreviewUrl = ''
    try {
      localPreviewUrl = URL.createObjectURL(file)
      setManualLipSyncAudioPreviewUrlsV129A((current) => {
        const previous = current[sceneId]
        if (previous && previous.startsWith('blob:') && previous !== localPreviewUrl) {
          try { URL.revokeObjectURL(previous) } catch {}
        }
        return { ...current, [sceneId]: localPreviewUrl }
      })
    } catch {}

    setManualLipSyncAudioUploadingV129A((current) => ({ ...current, [sceneId]: true }))
    updateSceneAndSave(sceneId, {
      ...clearMissingAudioVideoErrorPatchV129A(selectedScene),
      audio_slice_status: 'uploading',
      audioSliceStatus: 'uploading',
      audio_slice_name: fileName,
      audioSliceName: fileName,
      audio_slice_error: '',
      audioSliceError: '',
    })

    try {
      setStatus(`Загружаем audio для lip-sync · ${sceneId}`)
      const uploaded = await uploadMediaAsset({
        file,
        projectId: workspaceMode ? null : projectId,
        kind: 'audio',
        stage: 'board_manual_lipsync_audio',
      })

      const assetId = asText(uploaded.asset_id || uploaded.assetId || '')
      const assetApiPath = asText(uploaded.asset_api_path || uploaded.assetApiPath || (assetId ? `/assets/${assetId}/file` : ''))
      if (!assetId || !assetApiPath) throw new Error('audio_asset_upload_missing_asset_id')

      const duration = Number(uploaded.duration_sec || uploaded.durationSec || uploaded.audio_duration_sec || 0) || 0
      updateSceneAndSave(sceneId, {
        ...clearMissingAudioVideoErrorPatchV129A(selectedScene),
        audio_slice_status: 'ready',
        audioSliceStatus: 'ready',
        audio_slice_url: assetApiPath,
        audioSliceUrl: assetApiPath,
        audio_slice_api_path: assetApiPath,
        audioSliceApiPath: assetApiPath,
        audio_slice_asset_id: assetId,
        audioSliceAssetId: assetId,
        manual_lipsync_audio_url: assetApiPath,
        manualLipSyncAudioUrl: assetApiPath,
        manual_lipsync_audio_api_path: assetApiPath,
        manualLipSyncAudioApiPath: assetApiPath,
        manual_lipsync_audio_asset_id: assetId,
        manualLipSyncAudioAssetId: assetId,
        audio_slice_name: fileName,
        audioSliceName: fileName,
        manual_lipsync_audio_name: fileName,
        manualLipSyncAudioName: fileName,
        audio_slice_mime: uploaded.mime_type || uploaded.mimeType || file.type || 'audio/mpeg',
        audioSliceMime: uploaded.mime_type || uploaded.mimeType || file.type || 'audio/mpeg',
        audio_slice_duration: duration,
        audioSliceDuration: duration,
        manual_lipsync_audio_duration: duration,
        manualLipSyncAudioDuration: duration,
        audio_slice_source: 'manual_upload_asset_v129a',
        audioSliceSource: 'manual_upload_asset_v129a',
        audio_slice_error: '',
        audioSliceError: '',
      })
      setStatus(`Audio для lip-sync готово: ${fileName}`)
    } catch (error) {
      console.error('[Board] manual lip-sync audio upload failed', error)
      updateSceneAndSave(sceneId, {
        audio_slice_status: 'error',
        audioSliceStatus: 'error',
        audio_slice_error: error?.message || 'manual_lipsync_audio_upload_failed',
        audioSliceError: error?.message || 'manual_lipsync_audio_upload_failed',
      })
      setStatus(`Audio не загрузилось: ${error?.message || 'unknown error'}`)
      pushBoardToast({ type: 'error', title: 'Audio lip-sync', message: error?.message || 'manual_lipsync_audio_upload_failed', sceneId })
    } finally {
      setManualLipSyncAudioUploadingV129A((current) => ({ ...current, [sceneId]: false }))
    }
  }

  function clearManualLipSyncAudioV129A() {
    if (!selectedScene) return
    const sceneId = manualLipSyncSceneIdV129A(selectedScene)
    if (!sceneId) return

    setManualLipSyncAudioPreviewUrlsV129A((current) => {
      const previous = current[sceneId]
      if (previous && previous.startsWith('blob:')) {
        try { URL.revokeObjectURL(previous) } catch {}
      }
      const next = { ...current }
      delete next[sceneId]
      return next
    })

    updateSceneAndSave(sceneId, {
      audio_slice_status: '',
      audioSliceStatus: '',
      audio_slice_url: '',
      audioSliceUrl: '',
      audio_slice_api_path: '',
      audioSliceApiPath: '',
      audio_slice_asset_id: '',
      audioSliceAssetId: '',
      manual_lipsync_audio_url: '',
      manualLipSyncAudioUrl: '',
      manual_lipsync_audio_api_path: '',
      manualLipSyncAudioApiPath: '',
      manual_lipsync_audio_asset_id: '',
      manualLipSyncAudioAssetId: '',
      audio_slice_name: '',
      audioSliceName: '',
      manual_lipsync_audio_name: '',
      manualLipSyncAudioName: '',
      audio_slice_duration: 0,
      audioSliceDuration: 0,
      manual_lipsync_audio_duration: 0,
      manualLipSyncAudioDuration: 0,
      audio_slice_source: '',
      audioSliceSource: '',
      audio_slice_error: '',
      audioSliceError: '',
    })
    setStatus(`Audio lip-sync очищено · ${sceneId}`)
  }

async function takePreviousLastFrame(event = null) {
    event?.preventDefault?.()
    event?.stopPropagation?.()

    if (!selectedScene) {
      setStatus('Сначала выбери сцену, куда поставить кадр.')
      return
    }
    if (!previousScene) {
      setStatus('Для первой сцены нет предыдущего видео.')
      return
    }

    const sourceLabel = previousScene.title || previousScene.id
    const videoUrl = (
      scenePreviewVideoUrl(previousScene) ||
      previousScene.mmaudio_video_url || previousScene.mmaudioVideoUrl ||
      previousScene.resultVideoUrl || previousScene.result_video_url ||
      previousScene.video_url || previousScene.videoUrl || ''
    )
    const videoApiPath = (
      previousScene.mmaudio_video_api_path || previousScene.mmaudioVideoApiPath ||
      previousScene.video_api_path || previousScene.videoApiPath || ''
    )
    const hasPreviousVideo = Boolean(videoUrl || videoApiPath)

    setStatus(`Нажали “Взять последний кадр”: источник ${sourceLabel}`)

    if (hasPreviousVideo) {
      updateScene(selectedScene.id, {
        ...staleVideoPatch('source_frame_changed'),
        first_frame_status: 'extracting_from_previous_video',
        first_frame_source_scene_id: previousScene.id,
        first_frame_source: 'previous_video_last_frame',
        first_frame_error: '',
      })

      try {
        setStatus(`Извлекаем последний кадр из видео предыдущей сцены: ${sourceLabel}`)
        const data = await apiRequest('/clip/video/extract-last-frame', {
          method: 'POST',
          body: JSON.stringify({
            scene_id: `${selectedScene.id}_from_${previousScene.id}`,
            sceneId: `${selectedScene.id}_from_${previousScene.id}`,
            source_scene_id: previousScene.id,
            sourceSceneId: previousScene.id,
            video_url: videoUrl,
            videoUrl,
            video_api_path: videoApiPath,
            videoApiPath,
          }),
        })

        let imageUrl = data.imageUrl || data.image_url || data.imageApiPath || data.image_api_path || ''
        let imageApiPath = data.imageApiPath || data.image_api_path || ''
        let imageAssetId = data.imageAssetId || data.image_asset_id || data.assetId || data.asset_id || ''
        const imageName = data.imageName || data.image_name || `last-frame-from-${previousScene.id}.jpg`
        if (!imageUrl) throw new Error('extract_last_frame_returned_no_image_url')
        const staticImageUrl = boardStaticMediaUrl(imageApiPath || imageUrl)
        if (!imageAssetId && staticImageUrl) {
          try {
            const asset = await registerStaticMediaAsset({
              url: staticImageUrl,
              projectId: workspaceMode ? null : projectId,
              kind: 'image',
              stage: 'board_images',
              originalName: imageName,
              sceneId: selectedScene.id,
            })
            imageAssetId = asset.asset_id || asset.assetId || ''
            imageApiPath = asset.asset_api_path || asset.assetApiPath || imageApiPath
            imageUrl = imageApiPath || imageUrl
            console.log('[BOARD IMAGE STATIC REGISTER]', { sceneId: selectedScene.id, assetId: imageAssetId, apiPath: imageApiPath, sourceField: 'extract_last_frame', success: Boolean(imageAssetId) })
          } catch (error) {
            console.warn('[BOARD IMAGE STATIC REGISTER]', { sceneId: selectedScene.id, staticUrl: staticImageUrl, sourceField: 'extract_last_frame', success: false, error: error?.message || error })
          }
        }

        updateSceneAndSave(selectedScene.id, {
          ...staleVideoPatch('source_frame_changed'),
          // AVA_LAST_FRAME_V4_BOARD_VISIBLE_IMAGE
          first_frame_url: imageUrl,
          first_frame_api_path: imageApiPath,
          first_image_asset_id: imageAssetId,
          firstImageAssetId: imageAssetId,
          first_image_api_path: imageApiPath,
          firstImageApiPath: imageApiPath,
          start_image_url: imageUrl,
          startImageUrl: imageUrl,
          start_image_data_url: '',
          startImageDataUrl: '',
          first_frame_name: imageName,
          image_url: imageUrl,
          image_api_path: imageApiPath,
          image_asset_id: imageAssetId,
          imageAssetId: imageAssetId,
          imageApiPath: imageApiPath,
          image_data_url: '',
          imageDataUrl: '',
          image_name: imageName,
          first_frame_status: 'extracted_from_previous_video',
          first_frame_source_scene_id: previousScene.id,
          first_frame_source: 'previous_video_last_frame',
          first_frame_error: '',
          image_status: 'server_frame_ready',
        })
        setStatus(`Готово: последний кадр из предыдущего видео поставлен в Фото/Start: ${selectedScene.id}`)
      } catch (error) {
        console.error('[Board] extract previous last frame failed', error)
        updateScene(selectedScene.id, {
          first_frame_status: 'error',
          first_frame_source_scene_id: previousScene.id,
          first_frame_source: 'previous_video_last_frame',
          first_frame_error: error?.message || 'extract_last_frame_failed',
        })
        setStatus(`Не удалось взять последний кадр из видео: ${error?.message || 'extract_last_frame_failed'}`)
      }
      return
    }

    const url = previousScene.last_frame_url || previousScene.end_image_url || previousScene.image_url || previousScene.first_frame_url || previousScene.start_image_url || ''
    const dataUrl = previousScene.end_image_data_url || previousScene.image_data_url || previousScene.start_image_data_url || ''
    const previewUrl = url || dataUrl
    const name = previousScene.last_frame_name || previousScene.image_name || previousScene.first_frame_name || `frame-from-${previousScene.id}`

    if (previewUrl) {
      updateScene(selectedScene.id, {
        ...staleVideoPatch('source_frame_changed'),
        // AVA_LAST_FRAME_V4_BOARD_FALLBACK_VISIBLE
        first_frame_url: previewUrl,
        start_image_url: previewUrl,
        startImageUrl: previewUrl,
        start_image_data_url: dataUrl || (String(previewUrl).startsWith('data:') ? previewUrl : selectedScene.start_image_data_url || ''),
        startImageDataUrl: dataUrl || (String(previewUrl).startsWith('data:') ? previewUrl : selectedScene.startImageDataUrl || ''),
        first_frame_name: name,
        image_url: previewUrl,
        image_data_url: dataUrl || (String(previewUrl).startsWith('data:') ? previewUrl : selectedScene.image_data_url || ''),
        imageDataUrl: dataUrl || (String(previewUrl).startsWith('data:') ? previewUrl : selectedScene.imageDataUrl || ''),
        image_name: name,
        first_frame_status: 'copied_from_previous_frame_fallback',
        first_frame_source_scene_id: previousScene.id,
        first_frame_source: 'previous_scene_frame_fallback_no_video',
        image_status: 'local_preview',
      })
      setStatus(`У предыдущей сцены нет видео, взят доступный кадр: ${sourceLabel}`)
      return
    }

    updateScene(selectedScene.id, {
      first_frame_status: 'waiting_previous_media',
      first_frame_source_scene_id: previousScene.id,
      first_frame_source: 'previous_scene_missing_media',
    })
    setStatus('В предыдущей сцене пока нет видео/кадра, поэтому взять последний кадр нельзя.')
  }


    function readBlobAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(reader.error || new Error('file_reader_failed'))
      reader.readAsDataURL(blob)
    })
  }

  async function boardMediaRefForBackend(url, fallbackDataUrl = '') {
    const value = String(url || '')
    const storedDataUrl = String(fallbackDataUrl || '')

    if (storedDataUrl.startsWith('data:')) {
      return { url: '', dataUrl: storedDataUrl }
    }

    if (!value) return { url: '', dataUrl: '' }

    if (value.startsWith('data:')) {
      return { url: '', dataUrl: value }
    }

    if (value.startsWith('blob:')) {
      try {
        const response = await fetch(value)
        if (!response.ok) {
          throw new Error(`blob_fetch_${response.status}`)
        }
        const blob = await response.blob()
        const dataUrl = await readBlobAsDataUrl(blob)
        return { url: '', dataUrl }
      } catch (error) {
        throw new Error(
          'Фото этой сцены было сохранено как временный blob и уже потеряно браузером. Нажми “Заменить фото” для этой сцены и выбери изображение заново, потом снова “Сделать видео”.'
        )
      }
    }

    return { url: value, dataUrl: '' }
  }

async function markVideoPlanned(sceneOverride = null) {
    // AVA_BOARD_SERVER_BATCH_BLOCK_LEGACY_FRONTEND_V131M: this function sends /clip/video/start; backend batch must be the only starter.
    if (boardServerBatchIsActiveV131M()) {
      console.log('[BOARD SERVER BATCH FRONTEND GUARD V131M] block markVideoPlanned')
      return
    }

    // AVA_BOARD_PERSIST_MARK_VIDEO_PLANNED_V51: persist start/job/error scene patches so F5 can restore active regeneration.

    let sceneToStart = sceneOverride || selectedScene
    if (!sceneToStart) return
    const requestSceneId = asText(sceneToStart.id || sceneToStart.scene_id)
    const reviewWasBadBeforeRegenerateV130J = boardSceneHasBadVideoReview(sceneToStart)
    if (!workspaceMode && !projectId) {
      const message = 'Нет projectId, видео не будет сохранено в проект'
      setStatus(message)
      pushBoardToast({ type: 'error', title: 'Видео не отправлено', message, sceneId: requestSceneId })
      window.setTimeout(processNextQueuedBoardVideo, 650)
      return
    }
    if (!requestSceneId || (!workspaceMode && isGeneratorSceneId(requestSceneId))) {
      const message = 'Некорректный sceneId, видео не будет сохранено в проект'
      setStatus(message)
      pushBoardToast({ type: 'error', title: 'Видео не отправлено', message, sceneId: requestSceneId })
      window.setTimeout(processNextQueuedBoardVideo, 650)
      return
    }
    try {
      sceneToStart = await ensureAudioSliceForManualVideoStartV200W(sceneToStart)
    } catch (error) {
      const message = `Audio slice не создан: ${error?.message || 'unknown error'}`
      showSceneVideoInputError(sceneToStart, [message])
      pushBoardToast({ type: 'error', title: 'Audio slice', message, sceneId: requestSceneId })
      window.setTimeout(processNextQueuedBoardVideo, 650)
      return
    }

    const inputProblems = sceneVideoInputProblems(sceneToStart)
    if (inputProblems.length) {
      showSceneVideoInputError(sceneToStart, inputProblems)
      window.setTimeout(processNextQueuedBoardVideo, 650)
      return
    }

    localVideoQueueRef.current = localVideoQueueRef.current.filter((sceneId) => sceneId !== requestSceneId)
    window.setTimeout(() => syncQueuedSceneBadges(), 0)

    const route = normalizeBoardRouteValueV154A(sceneToStart.route || 'i2v')
    const isFirstLast = isFirstLastRoute(route)
    const isLipSync = isBoardAudioDrivenRouteV154A(route)

    const durationLockForGeneration = boardSceneTimingLockInfo(sceneToStart)
    const targetDuration = Math.max(
      0.1,
      Number((durationLockForGeneration.locked ? durationLockForGeneration.duration : 0) || durationOf(sceneToStart) || sceneToStart.duration_sec || sceneToStart.duration || 0)
    )

    const formatValue = String(sceneToStart.format || sceneToStart.aspect_ratio || board.format || '16:9')
    const size = formatValue === '9:16'
      ? { width: 720, height: 1280 }
      : formatValue === '1:1'
        ? { width: 1024, height: 1024 }
        : formatValue === '4:5'
          ? { width: 1024, height: 1280 }
          : { width: 1280, height: 720 }
    const workflowMap = BOARD_ROUTE_WORKFLOW_MAP

    const imageUrl = isFirstLast
      ? (sceneMediaFieldValue(sceneToStart, 'first', 'apiPath') || sceneMediaFieldValue(sceneToStart, 'first', 'url') || sceneMediaFieldValue(sceneToStart, 'image', 'apiPath') || sceneMediaFieldValue(sceneToStart, 'image', 'url') || '')
      : (sceneMediaFieldValue(sceneToStart, 'image', 'apiPath') || sceneMediaFieldValue(sceneToStart, 'image', 'url') || sceneMediaFieldValue(sceneToStart, 'first', 'apiPath') || sceneMediaFieldValue(sceneToStart, 'first', 'url') || '')

    const endImageUrl = isFirstLast
      ? (sceneMediaFieldValue(sceneToStart, 'last', 'apiPath') || sceneMediaFieldValue(sceneToStart, 'last', 'url') || '')
      : ''

    const audioSliceUrl = manualLipSyncAudioSourceV129A(sceneToStart)

    const warnings = []
    if (!imageUrl) warnings.push('missing_start_image')
    if (isFirstLast && !endImageUrl) warnings.push('missing_last_frame')
    if (isLipSync && !audioSliceUrl) warnings.push('missing_audio_slice')

    // AVA_LAST_FRAME_V4_BOARD_NO_POST_WITHOUT_MEDIA
    if (warnings.length) {
      const labels = warnings.map((item) => item === 'missing_start_image' ? 'нет фото/start image' : item === 'missing_last_frame' ? 'нет последнего кадра' : item === 'missing_audio_slice' ? 'нет audio slice для ia2v' : item)
      showSceneVideoInputError(sceneToStart, labels)
      window.setTimeout(processNextQueuedBoardVideo, 650)
      return
    }

    updateSceneAndSave(requestSceneId, {
      ...boardVideoRegenerateResetPatch('video_restarting'),
      video_status: 'starting',
      videoStatus: 'starting',
      video_started_at: new Date().toISOString(),
      videoStartedAt: new Date().toISOString(),
      video_updated_at: new Date().toISOString(),
      videoUpdatedAt: new Date().toISOString(),
      video_error: '',
      video_start_warnings: warnings,
      video_url: '',
      video_api_path: '',
      video_name: '',
      original_video_url: '',
      mmaudioVideoUrl: '',
      mmaudioVideoName: '',
      resultVideoUrl: '',
      result_video_url: '',
      videoUrl: '',
      videoName: '',
      video_result: null,
      video_ready_at: '',
      video_queue_position: 0,
      mmaudio_status: '',
      mmaudio_error: '',
      mmaudio_video_url: '',
      mmaudio_video_name: '',
      mmaudio_result: null,
      mmaudio_ready_at: '',
      mmaudio_source_video_url: '',
      mmaudio_source_video_api_path: '',
      mmaudio_reset_reason: 'base_video_restarting',
      ...boardVideoReviewRegenerateFlagPatch(reviewWasBadBeforeRegenerateV130J, reviewWasBadBeforeRegenerateV130J ? 'manual_or_queue_regenerate_bad_review' : ''),
      ...(reviewWasBadBeforeRegenerateV130J ? boardVideoReviewPatch('', 'bad_video_regeneration_started') : {}),
    })

    try {
      setStatus(`POST /api/clip/video/start · ${requestSceneId}`)

      // AVA_STAGE515_IMAGE_START_SYNC
      // Important: ia2v exact node 269 uses start_image_* when it exists.
      // After replacing the visible image, old start_image_data_url could remain in state,
      // so Comfy received the previous photo while the UI showed the new one.
      const imageDataUrlForBackend = sceneToStart.image_data_url || sceneToStart.imageDataUrl || ''
      const startDataUrlForBackend = sceneToStart.start_image_data_url || sceneToStart.startImageDataUrl || ''
      const selectedImageIsFirstFrame = Boolean(
        imageUrl
        && (imageUrl === sceneToStart.first_frame_url || imageUrl === sceneToStart.start_image_url || imageUrl === sceneToStart.startImageUrl)
      )
      const chosenImageDataUrlForBackend = selectedImageIsFirstFrame
        ? (startDataUrlForBackend || imageDataUrlForBackend)
        : imageDataUrlForBackend

      const imageMediaForBackend = await boardMediaRefForBackend(imageUrl, chosenImageDataUrlForBackend)
      const startMediaForBackend = isFirstLast
        ? await boardMediaRefForBackend(imageUrl, startDataUrlForBackend || chosenImageDataUrlForBackend)
        : imageMediaForBackend
      const endMediaForBackend = await boardMediaRefForBackend(endImageUrl, sceneToStart.end_image_data_url || sceneToStart.endImageDataUrl || '')


      // AVA_STAGE78_STRICT_VISIBLE_VIDEO_PROMPT: send ONLY what is currently in the visible Board prompt fields.
      // Do not fallback to old Manual Timing / translation prompts.
      const finalVisibleVideoPromptForBackend = asText(sceneToStart.video_prompt)
      const finalVisibleNegativePromptForBackend = asText(sceneToStart.negative_prompt)

      console.log('[BOARD VIDEO PAYLOAD STRICT]', {
        sceneId: requestSceneId,
        route,
        finalVisibleVideoPromptForBackend,
        finalVisibleNegativePromptForBackend,
        ignoredLegacyPositivePrompt: asText(sceneToStart.positive_prompt),
        ignoredMeaningHint: asText(sceneToStart.meaning_hint_ru),
      })
      console.log('[BOARD GENERATE REQUEST CONTEXT]', {
        projectId: projectId || '',
        sceneId: requestSceneId,
        route,
      })

      const data = await apiRequest('/clip/video/start', {
        method: 'POST',
        body: JSON.stringify({
          scene_id: requestSceneId,
          sceneId: requestSceneId,
          project_id: projectId || '',
          projectId: projectId || '',
          route,
          workflow_key: boardWorkflowKeyForRoute(route, sceneToStart.workflow_key),
          image_url: imageMediaForBackend.url,
          image_data_url: imageMediaForBackend.dataUrl,
          start_image_url: startMediaForBackend.url || imageMediaForBackend.url,
          start_image_data_url: startMediaForBackend.dataUrl || imageMediaForBackend.dataUrl,
          end_image_url: endMediaForBackend.url,
          end_image_data_url: endMediaForBackend.dataUrl,
          audio_slice_url: audioSliceUrl,
          video_prompt: finalVisibleVideoPromptForBackend,
          videoPrompt: finalVisibleVideoPromptForBackend,
          positive_prompt: finalVisibleVideoPromptForBackend,
          positivePrompt: finalVisibleVideoPromptForBackend,
          prompt: finalVisibleVideoPromptForBackend,
          negative_prompt: finalVisibleNegativePromptForBackend,
          negativePrompt: finalVisibleNegativePromptForBackend,
          width: size.width,
          height: size.height,
          format: formatValue,
          duration_sec: targetDuration,
          target_duration_sec: targetDuration,
          scene_start_sec: durationLockForGeneration.locked ? durationLockForGeneration.start : sceneToStart.start,
          scene_end_sec: durationLockForGeneration.locked ? durationLockForGeneration.end : sceneToStart.end,
          warnings,
          source: 'ava_board_stage_510g2',
        }),
      })

      const jobId = data.jobId || data.job_id || ''
      const rawStartStatusV130F = String(data.status || 'queued').toLowerCase()
      const status = rawStartStatusV130F === 'queued' ? 'running' : (rawStartStatusV130F || 'running')

      updateSceneAndSave(requestSceneId, {
        // AVA_BOARD_CLEAR_OLD_VIDEO_DURING_RUNNING_V52: keep new job, but remove old ready video refs during regeneration.
        ...boardVideoRegenerateResetPatch('video_start_job_saved'),
        video_status: status,
        videoStatus: status,
        video_started_at: new Date().toISOString(),
        videoStartedAt: new Date().toISOString(),
        video_updated_at: new Date().toISOString(),
        videoUpdatedAt: new Date().toISOString(),
        video_job_id: jobId,
        videoJobId: jobId,
        video_status_endpoint: data.statusEndpoint || (jobId ? `/api/clip/video/status/${jobId}` : ''),
        workflow_key: data.workflowKey || boardWorkflowKeyForRoute(route, sceneToStart.workflow_key),
        workflow_exists: data.workflowExists,
        target_duration_sec: data.targetDurationSec,
        generation_duration_sec: data.generationDurationSec,
        trim_to_duration_sec: data.trimToDurationSec,
        plus_one_second_applied: Boolean(data.plusOneSecondApplied),
        video_start_warnings: warnings,
        video_error: '',
        ...boardVideoReviewRegenerateFlagPatch(reviewWasBadBeforeRegenerateV130J, reviewWasBadBeforeRegenerateV130J ? 'job_started_from_bad_review' : ''),
      })

      const videoStatusEndpoint = data.statusEndpoint || (jobId ? `/api/clip/video/status/${jobId}` : '')
      setStatus(`Video job: ${status} · ${jobId || 'no job id'}`)
      registerAvaGlobalJob({ kind: 'video', sceneId: requestSceneId, jobId, statusEndpoint: videoStatusEndpoint })
      pollBoardVideoJob(requestSceneId, videoStatusEndpoint, jobId)
    } catch (error) {
      console.error('[Board] /clip/video/start failed', error)
      boardReleaseVideoQueueStart(requestSceneId)
      updateSceneAndSave(requestSceneId, {
        video_status: 'error',
        videoStatus: 'error',
        video_error: error?.message || 'video_start_failed',
        videoError: error?.message || 'video_start_failed',
        video_job_id: '',
        videoJobId: '',
        video_status_endpoint: '',
        videoStatusEndpoint: '',
        video_queue_position: 0,
        videoQueuePosition: 0,
        video_queue_source: '',
        videoQueueSource: '',
        video_updated_at: new Date().toISOString(),
        videoUpdatedAt: new Date().toISOString(),
      })
      setStatus(error?.message || 'Не удалось отправить видео')
      pushBoardToast({ type: 'error', title: 'Видео не отправлено', message: `Сцена ${requestSceneId}: ${error?.message || 'video_start_failed'}`, sceneId: requestSceneId })
      window.setTimeout(() => finishBoardVideoQueueStepV130H(requestSceneId, '', 'video_start_failed_v200a'), 650)
    }
  }


  function mmaudioVideoUrlFromStatus(data) {
    return data?.mmaudioVideoApiPath || data?.mmaudio_video_api_path || data?.videoApiPath || data?.video_api_path || data?.mmaudioVideoUrl || data?.mmaudio_video_url || data?.videoUrl || data?.video_url || ''
  }

  function sceneMainPreviewVideoUrl(scene) {
    const baseVideo = normalizeBoardMediaUrl(scene?.video_api_path || scene?.videoApiPath || scene?.video_url || scene?.videoUrl || '')
    const mmaudioVideo = normalizeBoardMediaUrl(scene?.mmaudio_video_api_path || scene?.mmaudioVideoApiPath || scene?.mmaudio_video_url || scene?.mmaudioVideoUrl || '')

    if (!mmaudioVideo) return baseVideo
    if (!baseVideo) return mmaudioVideo

    const baseReadyAt = Date.parse(scene?.video_ready_at || scene?.videoReadyAt || '')
    const mmaudioReadyAt = Date.parse(scene?.mmaudio_ready_at || scene?.mmaudioReadyAt || '')

    if (Number.isFinite(baseReadyAt) && Number.isFinite(mmaudioReadyAt)) {
      return mmaudioReadyAt >= baseReadyAt ? mmaudioVideo : baseVideo
    }

    return scene?.mmaudio_status === 'ready' ? mmaudioVideo : baseVideo
  }

  function sceneMainPreviewStatus(scene) {
    const shownUrl = sceneMainPreviewVideoUrl(scene)
    const baseVideo = scene?.video_url || scene?.videoUrl || ''
    const mmaudioVideo = scene?.mmaudio_video_url || scene?.mmaudioVideoUrl || ''

    if (shownUrl && mmaudioVideo && shownUrl === mmaudioVideo) return 'mmaudio ready'
    return scene?.video_status || (baseVideo ? 'ready' : 'empty')
  }

  function pollMmaudioJob(sceneId, statusEndpoint, jobId) {
    const endpoint = statusEndpoint || (jobId ? `/clip/mmaudio/status/${jobId}` : '')
    if (!sceneId || !endpoint) return

    const normalizedEndpoint = endpoint.startsWith('/api/')
      ? endpoint.slice(4)
      : endpoint

    let attempt = 0
    const maxAttempts = 240

    const tick = async () => {
      attempt += 1
      try {
        const data = await apiRequest(normalizedEndpoint)
        const status = data?.status || data?.mmaudio_status || 'running'
        const videoUrl = mmaudioVideoUrlFromStatus(data)

        if (videoUrl) {
          let assetPatch = {}
          const staticUrl = boardStaticMediaUrl(videoUrl)
          if (staticUrl) {
            try {
              const asset = await registerStaticMediaAsset({
                url: staticUrl,
                projectId: workspaceMode ? null : projectId,
                kind: 'video',
                stage: 'board_videos',
                originalName: data?.mmaudioVideoName || data?.mmaudio_video_name || data?.videoName || data?.video_name || 'mmaudio.mp4',
                sceneId,
              })
              const assetId = asset.asset_id || asset.assetId || ''
              const assetApiPath = asset.asset_api_path || asset.assetApiPath || ''
              if (assetId && assetApiPath) {
                assetPatch = {
                  mmaudio_video_asset_id: assetId,
                  mmaudioVideoAssetId: assetId,
                  mmaudio_video_api_path: assetApiPath,
                  mmaudioVideoApiPath: assetApiPath,
                  mmaudio_video_url: assetApiPath,
                  mmaudioVideoUrl: assetApiPath,
                }
                console.log('[BOARD VIDEO ASSET RESTORE]', { sceneId, assetId, apiPath: assetApiPath, sourceField: 'mmaudio_static_video', success: true })
              }
            } catch (error) {
              console.warn('[BOARD VIDEO STATIC REGISTER]', { sceneId, staticUrl, sourceField: 'mmaudio_static_video', success: false, error: error?.message || error })
            }
          }
          updateSceneAndSave(sceneId, {
            // AVA_BOARD_FOCUS_AND_MMAUDIO_PREVIEW_V63:
            // MMAudio is not a base-video regeneration. Preserve the base video,
            // clear stale busy status, and show the sound-added video immediately.
            video_status: 'ready',
            videoStatus: 'ready',
            video_error: '',
            videoError: '',
            video_queue_position: 0,
            videoQueuePosition: 0,
            mmaudio_status: 'ready',
            mmaudio_video_url: videoUrl,
            mmaudioVideoUrl: videoUrl,
            mmaudio_video_name: data?.mmaudioVideoName || data?.mmaudio_video_name || data?.videoName || data?.video_name || 'mmaudio.mp4',
            mmaudio_job_id: data?.jobId || data?.job_id || jobId || '',
            mmaudioJobId: data?.jobId || data?.job_id || jobId || '',
            mmaudio_status_endpoint: endpoint,
            mmaudioStatusEndpoint: endpoint,
            mmaudio_error: '',
            mmaudio_result: data,
            mmaudio_ready_at: new Date().toISOString(),
            mmaudioReadyAt: new Date().toISOString(),
            ...assetPatch,
          })
          setStatus(`MMAudio готово: ${sceneId}`)
          pushBoardToast({ type: 'success', title: 'MMAudio готово', message: `Сцена ${sceneId}: звук добавлен`, sceneId })
          return
        }

        if (['error', 'failed', 'output_download_failed', 'output_finalize_failed', 'completed_without_video_output'].includes(String(status).toLowerCase())) {
          updateScene(sceneId, {
            mmaudio_status: 'error',
            mmaudio_error: data?.error || data?.detail || status,
            mmaudio_job_id: data?.jobId || data?.job_id || jobId || '',
            mmaudio_status_endpoint: endpoint,
          })
          setStatus(`MMAudio не собрано: ${data?.error || data?.detail || status}`)
          pushBoardToast({ type: 'error', title: 'MMAudio не собрано', message: `Сцена ${sceneId}: ${data?.error || data?.detail || status}`, sceneId })
          return
        }

        updateScene(sceneId, {
          mmaudio_status: status === 'queued' ? 'queued' : 'running',
          mmaudio_job_id: data?.jobId || data?.job_id || jobId || '',
          mmaudio_status_endpoint: endpoint,
        })

        if (attempt < maxAttempts) window.setTimeout(tick, 2500)
        else {
          updateScene(sceneId, { mmaudio_status: 'error', mmaudio_error: 'poll_timeout' })
          setStatus('MMAudio слишком долго не отвечает: poll_timeout')
          pushBoardToast({ type: 'error', title: 'MMAudio зависло', message: `Сцена ${sceneId}: poll_timeout`, sceneId })
        }
      } catch (error) {
        console.error('[Board] MMAudio status polling failed', error)
        if (attempt < maxAttempts) window.setTimeout(tick, 4000)
        else {
          updateScene(sceneId, { mmaudio_status: 'error', mmaudio_error: error?.message || 'mmaudio_poll_failed' })
          setStatus(`Ошибка проверки MMAudio: ${error?.message || 'mmaudio_poll_failed'}`)
          pushBoardToast({ type: 'error', title: 'Ошибка проверки MMAudio', message: `Сцена ${sceneId}: ${error?.message || 'mmaudio_poll_failed'}`, sceneId })
        }
      }
    }

    window.setTimeout(tick, 1200)
  }

  async function startMmaudioForSelectedScene() {
    if (!selectedScene) return
    const sourceVideoApiPath = selectedScene.video_api_path || selectedScene.videoApiPath || ''
    const sourceVideo = sourceVideoApiPath ? '' : (selectedScene.video_url || selectedScene.videoUrl || '')
    if (!sourceVideo && !sourceVideoApiPath) {
      updateScene(selectedScene.id, { mmaudio_status: 'error', mmaudio_error: 'Сначала нужно готовое видео' })
      setStatus('MMAudio: сначала нужно готовое видео')
      pushBoardToast({ type: 'warning', title: 'MMAudio недоступно', message: 'Сначала нужно готовое видео', sceneId: selectedScene.id })
      return
    }

    updateScene(selectedScene.id, {
      ...boardMmaudioRegenerateResetPatch('mmaudio_restarting'),
      mmaudio_status: 'starting',
      mmaudio_error: '',
      mmaudio_video_url: '',
      mmaudio_video_name: '',
      mmaudio_source_video_url: sourceVideo,
      mmaudio_source_video_api_path: sourceVideoApiPath,
      mmaudio_source_preferred: sourceVideoApiPath ? 'video_api_path' : 'video_url',
      mmaudio_result: null,
    })

    try {
      setStatus(`POST /api/clip/mmaudio/start · ${selectedScene.id}`)
      const data = await apiRequest('/clip/mmaudio/start', {
        method: 'POST',
        body: JSON.stringify({
          scene_id: selectedScene.id,
          project_id: projectId || '',
          video_url: sourceVideo,
          video_api_path: sourceVideoApiPath,
          prompt: selectedScene.mmaudio_prompt || selectedScene.sound_prompt || selectedScene.video_prompt || '',
          negative_prompt: selectedScene.mmaudio_negative_prompt || 'music, soundtrack, narration, speech, human voice, distorted audio, clipping, harsh noise, unrelated sounds, repeated loop',
          duration_sec: durationOf(selectedScene),
          workflow_key: selectedScene.mmaudio_workflow_key || 'mmaudio-sound-design.json',
        }),
      })

      const jobId = data.jobId || data.job_id || ''
      const nextStatus = data.status || 'queued'
      updateScene(selectedScene.id, {
        mmaudio_status: nextStatus,
        mmaudio_job_id: jobId,
        mmaudio_status_endpoint: data.statusEndpoint || (jobId ? `/api/clip/mmaudio/status/${jobId}` : ''),
        mmaudio_workflow_key: data.workflowKey || 'mmaudio-sound-design.json',
        mmaudio_error: '',
      })
      const mmaudioStatusEndpoint = data.statusEndpoint || (jobId ? `/api/clip/mmaudio/status/${jobId}` : '')
      setStatus(`MMAudio job: ${nextStatus} · ${jobId || 'no job id'}`)
      registerAvaGlobalJob({ kind: 'mmaudio', sceneId: selectedScene.id, jobId, statusEndpoint: mmaudioStatusEndpoint })
      pollMmaudioJob(selectedScene.id, mmaudioStatusEndpoint, jobId)
    } catch (error) {
      console.error('[Board] /clip/mmaudio/start failed', error)
      updateScene(selectedScene.id, { mmaudio_status: 'error', mmaudio_error: error?.message || 'mmaudio_start_failed' })
      setStatus(error?.message || 'Не удалось отправить MMAudio')
      pushBoardToast({ type: 'error', title: 'MMAudio не отправлен', message: `Сцена ${selectedScene.id}: ${error?.message || 'mmaudio_start_failed'}`, sceneId: selectedScene.id })
    }
  }


async function importTimingJson(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const json = JSON.parse(await file.text())
      const jsonWithProjectFormatV177B = boardInjectProjectFormatIntoTimingV177C(json, boardProjectFormatV177A(json, { format: activeProjectFormatV177B }))
      let nextBoard = buildBoardFromTiming(jsonWithProjectFormatV177B, board)
      nextBoard = applyCookingPromptMemoryToBoard(nextBoard, { sourceBoard: json, force: Boolean(json?.cooking_prompt_memory_v1) })
      nextBoard = boardApplyImportedPromptTextFieldsV199A(nextBoard, json)
      setBoard(nextBoard)
      setStatus(`Импортировано сцен: ${nextBoard.scenes.length}`)
    } catch (err) {
      setStatus(`Ошибка импорта JSON: ${err.message}`)
    }
  }

  function stopBoardActionEvent(event) {
    event?.preventDefault?.()
    event?.stopPropagation?.()
  }


  
  // AVA_BOARD_REVIEW_IMMEDIATE_SAVE_V136G:
  // Review marks are tiny state changes, but the old path saved them through the
  // generic delayed Board autosave. If the user clicks several marks and presses
  // F5 immediately, the last click can be lost. Keep this path synchronous:
  // update boardRef/current UI, write durable backup, and start saveBoard now.
  function setSceneVideoReviewStatus(sceneId, status = '', reason = 'manual') {
    const safeSceneId = asText(sceneId)
    if (!safeSceneId) return

    const safeStatus = ['bad', 'needs_review'].includes(String(status || '').toLowerCase())
      ? String(status || '').toLowerCase()
      : ''
    const eventAtV136G = new Date().toISOString()
    const finalReasonV136G = safeStatus
      ? (safeStatus === 'bad' ? 'manual_bad_toggle_v136g' : 'manual_needs_review_v136g')
      : 'manual_review_clear_v136g'

    const patch = {
      ...boardVideoReviewPatch(safeStatus, finalReasonV136G),
      ...(safeStatus
        ? {
            video_review_updated_at: eventAtV136G,
            videoReviewUpdatedAt: eventAtV136G,
            video_review_clear_reason: '',
            videoReviewClearReason: '',
            video_review_cleared_at: '',
            videoReviewClearedAt: '',
            video_review_regenerate_from_bad: Boolean(safeStatus === 'bad'),
            videoReviewRegenerateFromBad: Boolean(safeStatus === 'bad'),
            bad_video_review: Boolean(safeStatus === 'bad'),
            badVideoReview: Boolean(safeStatus === 'bad'),
            video_review_bad: Boolean(safeStatus === 'bad'),
            videoReviewBad: Boolean(safeStatus === 'bad'),
          }
        : {
            video_review_status: '',
            videoReviewStatus: '',
            review_status: '',
            reviewStatus: '',
            video_review_reason: '',
            videoReviewReason: '',
            review_reason: '',
            reviewReason: '',
            video_review_updated_at: '',
            videoReviewUpdatedAt: '',
            video_review_clear_reason: finalReasonV136G,
            videoReviewClearReason: finalReasonV136G,
            video_review_cleared_at: eventAtV136G,
            videoReviewClearedAt: eventAtV136G,
            video_review_regenerate_from_bad: false,
            videoReviewRegenerateFromBad: false,
            video_review_regenerate_reason: '',
            videoReviewRegenerateReason: '',
            bad_video_review: false,
            badVideoReview: false,
            video_review_bad: false,
            videoReviewBad: false,
          }),
    }

    const currentBoardV136G = boardRef.current || board || {}
    const currentScenesV136G = asSceneArray(currentBoardV136G.scenes)
    let changedV136G = false
    const nextScenesV136G = currentScenesV136G.map((scene) => {
      if (asText(scene?.id || scene?.scene_id) !== safeSceneId) return scene
      const nextScene = canonicalizeBoardSceneMediaRefs(
        boardClearGeneratedRefsForActiveVideoPatchV54({ ...scene, ...patch }, patch)
      )
      const hasFieldChange = Object.keys(patch).some((key) => !Object.is(scene?.[key], nextScene?.[key]))
      if (!hasFieldChange) return scene
      changedV136G = true
      return nextScene
    })

    const label = safeStatus === 'bad' ? 'плохое' : safeStatus === 'needs_review' ? 'посмотри' : 'метка снята'
    if (!changedV136G) {
      setStatus(`Review: ${safeSceneId} · ${label}`)
      return
    }

    const nextBoardV136G = {
      ...currentBoardV136G,
      scenes: nextScenesV136G,
      updatedAt: eventAtV136G,
      reviewImmediateSaveV136G: true,
      reviewImmediateSaveSceneIdV136G: safeSceneId,
      reviewImmediateSaveEventAtV136G: eventAtV136G,
    }

    boardRef.current = nextBoardV136G
    setBoard(nextBoardV136G)
    writeBoardDurableBackup(
      boardDurableKey({ projectId, workspaceMode }),
      sanitizeBoardDurableBackup(nextBoardV136G)
    )
    setStatus(`Review: ${safeSceneId} · ${label} · сохраняем…`)

    Promise.resolve(saveBoard(nextBoardV136G, true))
      .then(() => setStatus(`Review: ${safeSceneId} · ${label} сохранено`))
      .catch((err) => {
        console.warn('[BOARD REVIEW IMMEDIATE SAVE V136G FAILED]', err)
        setStatus(`Review: ${safeSceneId} · ${label} · ошибка сохранения: ${err?.message || err}`)
      })
  }

  
  
  function toggleSceneVideoReview(scene, event = null) {
    stopBoardActionEvent(event)
    const sceneId = asText(scene?.id || scene?.scene_id)
    if (!sceneId) return
    if (!boardSceneCanReviewVideo(scene)) {
      setStatus(`Review: ${sceneId} · сначала нужно готовое видео`)
      return
    }

    // AVA_BOARD_REVIEW_TOGGLE_ACCEPT_POSMOTRI_V132X + AVA_BOARD_REVIEW_ACCEPT_PERSIST_V132Z:
    // good <-> bad, and orange posmotri -> accepted/good in one click.
    const current = boardSceneVideoReviewStatus(scene)
    const next = current === 'bad' ? '' : current === 'needs_review' ? '' : 'bad'
    const reason = current === 'needs_review'
      ? 'manual_needs_review_clear_v136d'
      : next
        ? 'manual_bad_toggle_v136d'
        : 'manual_review_clear_v136d'
    setSceneVideoReviewStatus(sceneId, next, reason)
  }

  function exportBoardJson(event) {
    stopBoardActionEvent(event)
    const payload = boardApplyFormatContractV177A({ ...sanitizeBoardDurableBackup(applyCookingPromptMemoryToBoard(board)), exportedAt: new Date().toISOString() })
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ava_board_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  function openSelectedSceneVideo(event) {
    stopBoardActionEvent(event)
    const url = selectedPreviewVideoUrl
    if (!url) return
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function downloadSelectedSceneVideo(event) {
    stopBoardActionEvent(event)
    const url = selectedPreviewVideoUrl
    if (!url) return
    const link = document.createElement('a')
    const glue = url.includes('?') ? '&' : '?'
    link.href = `${url}${glue}download=1`
    link.download = selectedScene?.video_name || selectedScene?.videoName || selectedScene?.mmaudio_video_name || selectedScene?.mmaudioVideoName || 'ava-board-video.mp4'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const firstLastMode = isFirstLastRoute(selectedScene?.route)
  const selectedEffectiveFormat = selectedScene?.format || selectedScene?.aspect_ratio || board.format || '16:9'
  const selectedPreviewVideoLoading = Boolean(selectedPreviewAssetApiPath && !selectedVideoBlobUrl && !selectedVideoLoadError)
  const selectedPreviewVideoUrl = selectedPreviewAssetApiPath ? selectedVideoBlobUrl : scenePreviewVideoUrl(selectedScene)
  const selectedSceneIdForMediaV129O = selectedScene?.id || selectedScene?.scene_id || ''
  const selectedRuntimeMedia = runtimeSceneMediaUrls[selectedSceneIdForMediaV129O] || {}
  const boardSlotPreviewUrlV129O = (scene, slot, runtimeMedia = {}) => {
    if (!scene) return ''
    const clearFlag = slot === 'last'
      ? runtimeMedia.lastClearedV129O
      : (slot === 'first' ? runtimeMedia.firstClearedV129O : runtimeMedia.imageClearedV129O)
    if (clearFlag) return ''
    if (Object.prototype.hasOwnProperty.call(runtimeMedia, slot)) return runtimeMedia[slot] || ''

    const apiPath = sceneMediaFieldValue(scene, slot, 'apiPath')
    if (apiPath && isProtectedBoardAssetApiPath(apiPath)) {
      return imageBlobUrlCacheRefV129O.current.get(apiPath) || ''
    }

    const url = sceneMediaFieldValue(scene, slot, 'url')
    if (url && isProtectedBoardAssetApiPath(url)) {
      const api = boardAssetApiPathFromRef(url)
      return imageBlobUrlCacheRefV129O.current.get(api) || ''
    }

    return normalizeBoardMediaUrl(url)
  }
  const selectedImagePreviewUrl = selectedScene ? boardSlotPreviewUrlV129O(selectedScene, 'image', selectedRuntimeMedia) : ''
  const selectedFirstImagePreviewUrl = selectedScene ? boardSlotPreviewUrlV129O(selectedScene, 'first', selectedRuntimeMedia) : ''
  const selectedLastImagePreviewUrl = selectedScene ? boardSlotPreviewUrlV129O(selectedScene, 'last', selectedRuntimeMedia) : ''
  const selectedFirstSlotPreviewUrlV132O = selectedFirstImagePreviewUrl || selectedImagePreviewUrl
  const selectedImageSlotStateV132O = boardSceneImageSlotUiStateV132O(selectedScene, 'image', selectedImagePreviewUrl, selectedRuntimeMedia)
  const selectedFirstImageSlotStateV132O = boardSceneImageSlotUiStateV132O(selectedScene, 'first', selectedFirstSlotPreviewUrlV132O, selectedRuntimeMedia)
  const selectedLastImageSlotStateV132O = boardSceneImageSlotUiStateV132O(selectedScene, 'last', selectedLastImagePreviewUrl, selectedRuntimeMedia)
  const selectedVideoIndicatorV132O = boardSceneVideoUiIndicatorV132O(selectedScene, {
    previewLoading: selectedPreviewVideoLoading,
    hasPreview: Boolean(selectedPreviewVideoUrl),
    loadError: selectedVideoLoadError,
  })
  const boardScenes = asSceneArray(board.scenes).map((scene) => boardSceneWithBadRegenRuntimeV136I(scene))
  const readiness = {
    total: boardScenes.length,
    prompts: boardScenes.filter((scene) => asText(scene.video_prompt)).length,
    images: boardScenes.filter((scene) => sceneMediaFieldValue(scene, 'image', 'apiPath') || sceneMediaFieldValue(scene, 'first', 'apiPath') || sceneMediaFieldValue(scene, 'last', 'apiPath') || sceneMediaFieldValue(scene, 'image', 'url') || sceneMediaFieldValue(scene, 'first', 'url') || sceneMediaFieldValue(scene, 'last', 'url') || scene.image_name || scene.first_frame_name || scene.last_frame_name).length,
    videos: boardScenes.filter((scene) => boardSceneHasCurrentVideoResultV129P(scene)).length,
  }
  const badVideoReviewScenes = boardScenes.filter((scene) => boardSceneHasBadVideoReview(scene))
  const needsVideoReviewScenes = boardScenes.filter((scene) => boardSceneNeedsVideoReview(scene))

  if (loading) {
    return (
      <div className="avaPage avaStoryboardLoadingPage isAvaStudioWaveLoading">
        <section className="avaLoadingHero avaStudioLoadingHero">
          <div className="avaLoadingCard avaStudioLoadingCard">
            <div className="avaLoadingOrb"><Film size={28} /></div>
            <p className="avaEyebrow"><Sparkles size={14} /> Ava Studio pipeline</p>
            <h2>{openedFromTiming && String(boardWorkflowEntry?.source || '') === 'manual_timing_to_board_confirmed_v16' ? 'Переносим Тайминг в Доску…' : 'Загрузка Storyboard…'}</h2>
            <p>{status || (openedFromTiming ? 'Сохраняем сцены, цвета, блоки и главное аудио из Тайминга.' : 'Проверяем сцены, промты, видео, звук, блоки и готовим доску к работе.')}</p>
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
              <small>{openedFromTiming && String(boardWorkflowEntry?.source || '') === 'manual_timing_to_board_confirmed_v16' ? 'Страница откроется уже с готовыми сценами' : 'Синхронизируем тайминг, сцены и медиа'}</small>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="avaPage avaBoardPage">
      <audio ref={audioRef} src={audioSrc || undefined} preload="metadata" />

      <WorkflowStageControls
        stageKey="board"
        stageLabel="Доска"
        clearLabel="Очистить доску"
        clearStages={['board']}
        clearStorageMatchers={['ava:open-board-scene', 'ava_board', 'board:']}
        clearDescription="Очистит snapshot доски и временные ключи доски. Видео/assets на диске не удаляются."
      />


      {boardToasts.length > 0 && (
        <div className="avaBoardToastStack" role="status" aria-live="polite">
          {boardToasts.map((toast) => (
            <div key={toast.id} className={`avaBoardToast is-${toast.type || 'info'}`}>
              <div className="avaBoardToastBody">
                <strong>{toast.title}</strong>
                {toast.message && <span>{toast.message}</span>}
              </div>
              {toast.sceneId && (
                <button type="button" onClick={() => selectScene(toast.sceneId)}>
                  Открыть
                </button>
              )}
              <button type="button" className="avaBoardToastClose" onClick={() => dismissBoardToast(toast.id)}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {assemblyConfirmOpen && (
        <div className="avaBoardAssemblyConfirmOverlay" role="presentation" onMouseDown={() => !assemblyConfirmBusy && setAssemblyConfirmOpen(false)}>
          <div className="avaBoardAssemblyConfirmCard" role="dialog" aria-modal="true" aria-label="Переход в монтажник" onMouseDown={(event) => event.stopPropagation()}>
            <div className="avaBoardAssemblyConfirmIcon"><Film size={26} /></div>
            <div className="avaBoardAssemblyConfirmText">
              <p className="avaEyebrow">Ava Studio pipeline</p>
              <h3>{badVideoReviewScenes.length ? 'Есть видео с меткой “плохое”' : 'Перенести Доску в монтажник?'}</h3>
              {badVideoReviewScenes.length ? (
                <>
                  <p>В Доске есть сцены, помеченные как плохие. Лучше вернуться, снять метку после проверки или перегенерировать эти видео.</p>
                  <div className="avaBoardAssemblyBadReviewList">
                    {badVideoReviewScenes.map((scene) => (
                      <span key={`assembly-bad-${scene.id || scene.scene_id}`}>{scene.id || scene.scene_id}</span>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p>Текущая монтажка будет заменена данными из Доски: сцены, цвета блоков, тайминги, готовые видео, MMAudio и исходное audio из Timing.</p>
                  {needsVideoReviewScenes.length ? <span>Есть видео со статусом “посмотри”: {needsVideoReviewScenes.map((scene) => scene.id || scene.scene_id).join(', ')}. Можно перейти, если они уже устраивают.</span> : <span>Если хочешь сохранить старую сборку из Генератора — нажми “Отмена”.</span>}
                </>
              )}
              {assemblyConfirmError ? <b>{assemblyConfirmError}</b> : null}
            </div>
            <div className="avaBoardAssemblyConfirmActions">
              <button type="button" onClick={() => setAssemblyConfirmOpen(false)} disabled={assemblyConfirmBusy}>{badVideoReviewScenes.length ? 'Вернуться' : 'Отмена'}</button>
              <button type="button" className="isPrimary" onClick={confirmBoardToAssemblyHandoff} disabled={assemblyConfirmBusy || !asSceneArray(board.scenes).length || badVideoReviewScenes.length}>
                {assemblyConfirmBusy ? 'Переносим…' : badVideoReviewScenes.length ? 'Сначала решить плохие' : 'Да, перейти'}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="avaBoardHeader">
        <div>
          <p className="avaEyebrow"><Sparkles size={15} /> Stage 5.1 storyboard foundation</p>
          <h2>Storyboard</h2>
          <p>Горизонтальная лента сцен, смысл, video prompts и медиа. Генерацию подключим следующим этапом.</p>
        </div>
        <div className="avaBoardHeaderActions">
          {timingReturnButtonEnabled && (
            <button
              type="button"
              className="avaBoardHeaderButton avaBoardActionRefresh"
              onClick={returnToTimingFromBoardV66B}
              title="Вернуться в Manual Timing, чтобы поправить сцены или тайминги"
            >
              <ArrowLeft size={15} /> Вернуться в Тайминг
            </button>
          )}

          <button
            type="button"
            className="avaBoardHeaderButton avaBoardActionRefresh"
            onClick={() => {
              try {
                localStorage.removeItem('ava:board:cleared:v1')
                sessionStorage.removeItem('ava:board:cleared:v1')
              } catch {
                // ignore
              }
              refreshFromTiming()
            }}
          >
            <RefreshCcw size={15} /> Обновить с тайминга
          </button>

          <button
            type="button"
            className="avaBoardHeaderLink avaBoardActionMontage"
            onClick={(event) => {
              stopBoardActionEvent(event)
              setAssemblyConfirmError('')
              setAssemblyConfirmOpen(true)
            }}
          >
            <Film size={15} /> В монтаж
          </button>



          <button
            type="button"
            className="avaBoardHeaderButton avaBoardActionJson avaBoardActionImport"
            onClick={(event) => {
              stopBoardActionEvent(event)
              importRef.current?.click()
            }}
          >
            <FileJson size={15} /> Импорт
          </button>

          <button
            type="button"
            className="avaBoardHeaderButton avaBoardActionJson avaBoardActionExport"
            onClick={exportBoardJson}
          >
            <FileJson size={15} /> Экспорт
          </button>
        </div>
        <div className="avaBoardStillImportTools" data-ava-patch="AVA_BOARD_STILL_BUTTONS_ROUTE_PROJECT_V86B">
        <div className="avaBoardStillQueueTools" data-ava-patch="AVA_BOARD_FRONTEND_AUTO_MANUAL_RUNNER_TOPBAR_V110B">
          <button
            type="button"
            className={`avaBoardHeaderButton avaBoardActionGenerateAllScenes ${autoVideoQueueState.active ? 'isActive' : ''} ${(workspaceMode || !projectId) ? 'isDisabled' : ''}`}
            disabled={workspaceMode || !projectId}
            onClick={(event) => {
              stopBoardActionEvent(event)
              openAllScenesVideoQueueConfirm(event)
            }}
            title={(workspaceMode || !projectId)
              ? 'Серверная очередь доступна только внутри проекта. Открой проект и запускай генерацию там.'
              : 'Спецрежим: поставить в очередь все сцены без готового видео. Использует backend-серверную очередь.'}
          >
            <Sparkles size={15} /> Сгенерировать все
          </button>

          <button
            type="button"
            className="avaBoardHeaderButton avaBoardActionStopGenerateAllScenes"
            onClick={(event) => {
              stopBoardActionEvent(event)
              stopAllScenesVideoQueue(event)
            }}
            title="Остановить спецрежим. Уже запущенный job не отменяется, очищается только ожидание."
          >
            <Pause size={15} /> Стоп очередь
          </button>

          <div className={`avaBoardStillQueueBadge ${autoVideoQueueState.active ? 'isActive' : ''}`}>
            {autoVideoQueueState.active
              ? `в очереди ${localVideoQueueRef.current.length}`
              : 'спецрежим'}
          </div>
        </div>
<button
            type="button"
            className="avaBoardHeaderButton avaBoardActionJson avaBoardActionStillImport"
            disabled={bulkStillsImporting || !boardScenes.length}
            onClick={(event) => {
              stopBoardActionEvent(event)
              stillFilesImportRef.current?.click()
            }}
            title="Пакетная замена кадров: файлы должны быть по номерам сцен — 1.png, 2.png, seg_01.png. Старые фото в этих сценах будут заменены."
          >
            <UploadCloud size={15} /> {bulkStillsImporting ? 'Импорт...' : 'Кадры'}
          </button>
<button
            type="button"
            className="avaBoardHeaderButton avaBoardActionJson avaBoardActionStillImportZip"
            disabled={bulkStillsImporting || !boardScenes.length}
            onClick={(event) => {
              stopBoardActionEvent(event)
              stillZipImportRef.current?.click()
            }}
            title="ZIP замена кадров: внутри должны быть 1.png, 2.png, seg_01.png. Старые фото в этих сценах будут заменены."
          >
            <UploadCloud size={15} /> {bulkStillsImporting ? 'ZIP...' : 'ZIP кадров'}
          </button>
        </div>

      </section>      {/* AVA09G_HIDE_AVA08Z_BOARD_ADD_SCENE_TOP_BUTTON */}
      {manualSceneToolsEnabled ? (
      <section className="avaBoardManualSceneTopBar">
        <div className="avaBoardManualSceneInfo">
          <strong>Ручные сцены</strong>
          <span>Добавляй сцены без тайминга — они встанут в конец доски.</span>
        </div>

        <div className="avaBoardManualSceneActionsV129I">
          <button
            type="button"
            className="avaBoardRemoveLastSceneButtonV129I"
            onClick={deleteLastManualSceneV129K}
            disabled={!manualSceneToolsEnabled || !boardScenes.length}
            title="Удалить последнюю ручную сцену"
          >
            − Сцена
          </button>
          <button type="button" className="avaBoardAddSceneButton" onClick={createManualScene}>
            + Сцена
          </button>
        </div>
      </section>
      ) : null}


      {autoVideoQueueConfirm.open ? (
        <div
          className="avaBoardAutoQueueConfirmOverlay"
          role="dialog"
          aria-modal="true"
          aria-label="Проверка пакетной генерации"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeAllScenesVideoQueueConfirm()
          }}
        >
          <div className="avaBoardAutoQueueConfirmCard">
            <div className="avaBoardAutoQueueConfirmGlow" />
            <div className="avaBoardAutoQueueConfirmHeader">
              <div>
                <span className="avaBoardAutoQueueEyebrow">Спецрежим Board</span>
                <h3>Пакетная генерация сцен</h3>
                <p>Проверили фото, video prompts, готовые видео и обязательные audio slice для lip-sync.</p>
              </div>
              <button
                type="button"
                className="avaBoardAutoQueueClose"
                onClick={closeAllScenesVideoQueueConfirm}
                title="Отмена"
              >
                ×
              </button>
            </div>

            <div className="avaBoardAutoQueueStats">
              <div className="avaBoardAutoQueueStat isLaunch">
                <strong>{autoVideoQueueConfirm.plan?.validCount || 0}</strong>
                <span>к запуску</span>
              </div>
              <div className="avaBoardAutoQueueStat isReady">
                <strong>{autoVideoQueueConfirm.plan?.readyCount || 0}</strong>
                <span>уже готово</span>
              </div>
              <div className="avaBoardAutoQueueStat isBadReview">
                <strong>{autoVideoQueueConfirm.plan?.regenerateCount || 0}</strong>
                <span>на переген</span>
              </div>
              <div className="avaBoardAutoQueueStat isBusy">
                <strong>{(autoVideoQueueConfirm.plan?.busyCount || 0) + (autoVideoQueueConfirm.plan?.alreadyQueuedCount || 0)}</strong>
                <span>уже в работе</span>
              </div>
              <div className={`avaBoardAutoQueueStat ${(autoVideoQueueConfirm.plan?.invalidCount || 0) ? 'isWarn' : 'isOk'}`}>
                <strong>{autoVideoQueueConfirm.plan?.invalidCount || 0}</strong>
                <span>не хватает</span>
              </div>
            </div>

            <div className="avaBoardAutoQueueDetails">
              <div className="avaBoardAutoQueueColumn isLaunch">
                <strong>Будут запущены</strong>
                <div className="avaBoardAutoQueueSceneList">
                  {(autoVideoQueueConfirm.plan?.valid || []).length ? (
                    (autoVideoQueueConfirm.plan?.valid || []).slice(0, 16).map((item) => (
                      <span key={`auto-valid-${item.sceneId}`}>{item.sceneId}</span>
                    ))
                  ) : (
                    <em>Нет сцен для запуска</em>
                  )}
                  {(autoVideoQueueConfirm.plan?.valid || []).length > 16 ? (
                    <small>+ ещё {(autoVideoQueueConfirm.plan?.valid || []).length - 16}</small>
                  ) : null}
                </div>
              </div>

              <div className="avaBoardAutoQueueColumn isBadReview">
                <strong>На перегенерацию</strong>
                <div className="avaBoardAutoQueueSceneList">
                  {(autoVideoQueueConfirm.plan?.regenerate || []).length ? (
                    (autoVideoQueueConfirm.plan?.regenerate || []).slice(0, 16).map((item) => (
                      <span key={`auto-regen-${item.sceneId}`}>{item.sceneId}</span>
                    ))
                  ) : (
                    <em>Нет плохих видео</em>
                  )}
                  {(autoVideoQueueConfirm.plan?.regenerate || []).length > 16 ? (
                    <small>+ ещё {(autoVideoQueueConfirm.plan?.regenerate || []).length - 16}</small>
                  ) : null}
                </div>
              </div>

              <div className="avaBoardAutoQueueColumn isReady">
                <strong>Пропускаем готовые</strong>
                <div className="avaBoardAutoQueueSceneList">
                  {(autoVideoQueueConfirm.plan?.ready || []).length ? (
                    (autoVideoQueueConfirm.plan?.ready || []).slice(0, 16).map((item) => (
                      <span key={`auto-ready-${item.sceneId}`}>{item.sceneId}</span>
                    ))
                  ) : (
                    <em>Готовых ещё нет</em>
                  )}
                  {(autoVideoQueueConfirm.plan?.ready || []).length > 16 ? (
                    <small>+ ещё {(autoVideoQueueConfirm.plan?.ready || []).length - 16}</small>
                  ) : null}
                </div>
              </div>

              <div className="avaBoardAutoQueueColumn isWarn">
                <strong>Не хватает данных</strong>
                <div className="avaBoardAutoQueueIssueList">
                  {(autoVideoQueueConfirm.plan?.invalid || []).length ? (
                    (autoVideoQueueConfirm.plan?.invalid || []).slice(0, 10).map((item) => (
                      <div key={`auto-invalid-${item.sceneId}`} className="avaBoardAutoQueueIssue">
                        <span>{item.sceneId}</span>
                        <small>{(item.problems || []).join(' · ')}</small>
                      </div>
                    ))
                  ) : (
                    <em>Все обязательные данные на месте</em>
                  )}
                  {(autoVideoQueueConfirm.plan?.invalid || []).length > 10 ? (
                    <small>+ ещё {(autoVideoQueueConfirm.plan?.invalid || []).length - 10}</small>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="avaBoardAutoQueueFooter">
              <div className="avaBoardAutoQueueHint">
                Очередь использует тот же ручной механизм «Сделать видео»: одна сцена → job → ready → следующая.
              </div>
              <div className="avaBoardAutoQueueActions">
                <button
                  type="button"
                  className="avaBoardAutoQueueCancel"
                  onClick={closeAllScenesVideoQueueConfirm}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="avaBoardAutoQueueContinue"
                  disabled={!autoVideoQueueConfirm.plan?.validCount}
                  onClick={confirmAllScenesVideoQueueStart}
                >
                  Продолжить · {autoVideoQueueConfirm.plan?.validCount || 0}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <input ref={importRef} className="avaHiddenInput" type="file" accept="application/json,.json" onChange={importTimingJson} />
      <input ref={stillFilesImportRef} className="avaHiddenInput" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={importBoardStillFilesFromInput} />
      <input ref={stillZipImportRef} className="avaHiddenInput" type="file" accept=".zip,application/zip,application/x-zip-compressed" onChange={importBoardStillZipFromInput} />

      {showTimingToBoardConfirm ? (
        <div className="avaBoardTimingConfirmOverlay" role="dialog" aria-modal="true">
          <div className="avaBoardTimingConfirmCard">
            <div className="avaBoardTimingConfirmGlow" />
            <div className="avaBoardTimingConfirmBadge">Timing → Board</div>
            <h3>Перенести Тайминг в Доску?</h3>
            <p>
              Сейчас в Доске могут быть старые сцены, видео и аудио. Если продолжить, Доска будет очищена
              и заменена свежими сценами, цветами, блоками и главным аудио из Тайминга.
            </p>
            <div className="avaBoardTimingConfirmWarning">
              Старые видео/кадры Доски будут отвязаны от сцен. Загруженные asset-файлы на диске не удаляются.
            </div>
            {timingToBoardImporting ? (
              <div className="avaBoardTimingConfirmProgressV162A" role="status" aria-live="polite">
                <div><span /></div>
                <small>Заменяем Доску свежими сценами из Тайминга…</small>
              </div>
            ) : null}
            <div className="avaBoardTimingConfirmActions">
              <button type="button" className="avaBoardTimingConfirmSecondary" onClick={cancelTimingToBoardImportV14B} disabled={timingToBoardImporting}>
                Оставить старую Доску
              </button>
              <button type="button" className="avaBoardTimingConfirmPrimary" onClick={confirmTimingToBoardImportV14B} disabled={timingToBoardImporting}>
                {timingToBoardImporting ? <span className="avaBoardTimingButtonSpinV162A" aria-hidden="true" /> : null}
                {timingToBoardImporting ? 'Переносим…' : 'Да, заменить Доску'}
              </button>
            </div>
          </div>
        </div>
      ) : null}{/* AVA_TIMING_TO_BOARD_CONFIRM_MODAL_V14B */}


      <section ref={sceneStripRef} className="avaBoardSceneStrip" aria-label="Сцены">
        {boardScenes.map((scene, index) => {
          const statusInfo = sceneStatus(scene)
          const reviewInfo = boardSceneVideoReviewInfo(scene)
          const sceneIdV200E = asText(scene.id || scene.scene_id || scene.sceneId)
          const selectedIdV200E = asText(selectedScene?.id || selectedScene?.scene_id || selectedScene?.sceneId)
          const active = selectedIdV200E === sceneIdV200E
          return (
            <button
              key={sceneIdV200E || scene.id}
              type="button"
              className={`avaBoardSceneCard ${active ? 'isActive' : ''} ${scene.blockId ? 'hasBlock' : ''}`}
              ref={(node) => {
                if (node) sceneCardRefs.current.set(sceneIdV200E, node)
                else sceneCardRefs.current.delete(sceneIdV200E)
              }}
              style={storyboardSceneCardInlineStyleV71(scene, index, board)}
              onClick={() => selectScene(sceneIdV200E)}
            >
              <div className="avaBoardSceneCardTop">
                <strong>{scene.title || scene.id}</strong>
                <span className={`avaBoardStatusBadge ${statusInfo.className}`}>{statusInfo.label}</span>
              </div>
              <span>{formatRange(scene)}</span>
              <small>{(typeof routeLabel === 'function' ? routeLabel(scene.route) : scene.route) || 'i2v'} · {durationOf(scene).toFixed(2)} c</small>
              <div className="avaBoardSceneBadges">
                {scene.roleLabels?.map((label) => <em key={label}>{label}</em>)}
                {scene.phrase_cut_warning && <em className="isWarn">срез</em>}
                {scene.blockTitle && <em>{scene.blockTitle}</em>}
                {boardSceneCanReviewVideo(scene) && boardSceneCanShowVideoReviewV133B(scene) ? (
                  <span
                    role="button"
                    tabIndex={0}
                    className={`avaBoardVideoReviewToggle ${reviewInfo.className}`}
                    title={reviewInfo.title}
                    onClick={(event) => toggleSceneVideoReview(scene, event)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') toggleSceneVideoReview(scene, event)
                    }}
                  >
                    <i>{reviewInfo.square}</i>{reviewInfo.label ? <em>{reviewInfo.label}</em> : null}
                  </span>
                ) : null}
              </div>
            </button>
          )
        })}
        {boardScenes.length === 0 && (
          <div className="avaBoardEmptyStrip">
            Нет сцен. Вернись в Manual Timing или импортируй JSON.
          </div>
        )}
      </section>

      <div className="avaBoardReadiness">
        <span>Сцен: <strong>{readiness.total}</strong></span>
        <span>Видео prompt: <strong>{readiness.prompts}</strong></span>
        <span>Фото: <strong>{readiness.images}</strong></span>
        <span>Видео: <strong>{readiness.videos}</strong></span>
        {status && <span className="avaBoardStatusText">{status}</span>}
      </div>

      {selectedScene ? (
        <section className="avaBoardWorkspace" style={{ '--scene-hue': storyboardSceneColor(selectedScene, Math.max(0, boardScenes.findIndex((scene) => scene.id === selectedScene?.id))) }}>
          <div className="avaBoardBrainPanel">
            <div className="avaBoardSceneTitleRow">
              <div>
                <p className="avaEyebrow">scene brain</p>
                <h3>{selectedScene.title || selectedScene.id}</h3>
                <span><Clock3 size={14} /> {formatRange(selectedScene)} · {durationOf(selectedScene).toFixed(2)} c</span>
              </div>
              <div className="avaBoardSceneMiniMeta">
                <span>#{selectedIndex + 1} из {boardScenes.length}</span>
                <span>{selectedScene.source_phrase_ids?.join(', ') || 'phrases: —'}</span>
                {boardSceneCanReviewVideo(selectedScene) && boardSceneCanShowVideoReviewV133B(selectedScene) ? (() => {
                  const reviewInfo = boardSceneVideoReviewInfo(selectedScene)
                  return (
                    <button
                      type="button"
                      className={`avaBoardVideoReviewHeaderToggle avaBoardVideoReviewMetaToggle ${reviewInfo.className}`}
                      title={reviewInfo.title}
                      onClick={(event) => toggleSceneVideoReview(selectedScene, event)}
                    >
                      <i>{reviewInfo.square}</i><span>{reviewInfo.label || 'оценка'}</span>
                    </button>
                  )
                })() : null}
              </div>
            </div>

            <section className={`avaBoardTranslationPanel ${collapsedPanels.translation ? 'isCollapsed' : ''}`}>
              <div className="avaBoardSectionHead">
                <div>
                  <p className="avaEyebrow">translation / sense</p>
                  <h3>Текст сцены</h3>
                </div>
                <div className="avaBoardSectionHeadActions">
                  <span>к этому блоку вернёмся позже</span>
                  <button
                    type="button"
                    className="avaBoardSectionToggle"
                    onClick={() => togglePanel('translation')}
                    aria-expanded={!collapsedPanels.translation}
                  >
                    {collapsedPanels.translation ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                    {collapsedPanels.translation ? 'Развернуть' : 'Свернуть'}
                  </button>
                </div>
              </div>

              {!collapsedPanels.translation && (
                <>
                  <div className="avaBoardTextGrid">
                    <div className="avaBoardTextCard">
                      <strong>Оригинал</strong>
                      <p>{selectedScene.scene_word_text || 'Оригинального текста пока нет'}</p>
                    </div>
                    <div className="avaBoardTextCard">
                      <strong>Перевод</strong>
                      <p>{selectedScene.translated_text_ru || 'Перевода пока нет'}</p>
                    </div>
                    <div className="avaBoardTextCard isMeaning">
                      <strong>Смысл для кадра</strong>
                      <p>{selectedScene.meaning_hint_ru || 'Смысловой подсказки пока нет'}</p>
                    </div>
                  </div>

                  <div className="avaBoardListenPanel">
                    <div className="avaBoardListenGroup isOriginalAudio">
                      <span>Оригинальное аудио</span>
                      <button type="button" onClick={playSelectedScene}><Play size={15} /> сцена</button>
                      <button type="button" onClick={playSelectedBlock}><AudioLines size={15} /> блок</button>
                      <button type="button" onClick={playAllAudio}><Play size={15} /> всё аудио</button>
                      {playback && <em>plays: {playback.label}</em>}
                    </div>

                    <div className="avaBoardListenGroup isRussianTts">
                      <span>Русская озвучка браузером</span>
                      <button
                        type="button"
                        className="isTranslation"
                        onClick={() => speak(selectedScene.translated_text_ru)}
                        disabled={!selectedScene.translated_text_ru}
                      >
                        <Volume2 size={15} /> перевод
                      </button>
                      <button
                        type="button"
                        className="isSense"
                        onClick={() => speak(selectedScene.meaning_hint_ru)}
                        disabled={!selectedScene.meaning_hint_ru}
                      >
                        <Volume2 size={15} /> смысл кадра
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>

            <section className="avaBoardGenerationPanel">
              <div className="avaBoardSectionHead">
                <div>
                  <p className="avaEyebrow">video setup</p>
                  <h3>Настройки видео</h3>
                </div>
                <span>{selectedScene.route || 'i2v'} · {selectedEffectiveFormat}</span>
              </div>

              <div className="avaBoardSetupGrid">
                <label className="avaBoardSelectField">
                  <span>Режим видео</span>
                  <select
                    value={normalizeBoardRouteValueV154A(selectedScene.route) || 'i2v'}
                    onChange={(event) => {
                      const nextRoute = event.target.value
                      updateScene(selectedScene.id, {
                        route: nextRoute,
                        workflow_key: boardWorkflowKeyForRoute(nextRoute),
                      })
                    }}
                  >
                    {ROUTE_OPTIONS.map((route) => (
                      <option key={route.value} value={route.value}>{route.label}</option>
                    ))}
                  </select>
                  <small>{ROUTE_OPTIONS.find((route) => route.value === normalizeBoardRouteValueV154A(selectedScene.route))?.hint || 'Выбери режим генерации видео'}</small>
                </label>

                <label className="avaBoardSelectField">
                  <span>Разрешение / формат</span>
                  <select
                    value={selectedEffectiveFormat}
                    onChange={(event) => updateScene(selectedScene.id, {
                      format: event.target.value,
                      aspect_ratio: event.target.value,
                    })}
                  >
                    {FORMAT_OPTIONS.map((format) => (
                      <option key={format.value} value={format.value}>{format.label}</option>
                    ))}
                  </select>
                  <small>Формат применяется к выбранной сцене. Формат проекта не меняется автоматически.</small>
                </label>
              </div>

              <div className="avaBoardVideoPromptGrid">
                <label className="avaBoardWideField">
                  Positive video prompt
                  <textarea
                    value={selectedScene.video_prompt || ''}
                    onChange={(event) => {
                      const value = event.target.value
                      updateScene(selectedScene.id, {
                        video_prompt: value,
                        videoPrompt: value,
                        positive_prompt: value,
                        positivePrompt: value,
                        prompt: value,
                      })
                    }}
                    placeholder="Визуал, движение камеры, действие, звук, реплика и кто говорит — всё сюда"
                  />
                </label>

                <label className="avaBoardWideField">
                  Negative prompt
                  <textarea
                    value={selectedScene.negative_prompt || ''}
                    onChange={(event) => updateScene(selectedScene.id, { negative_prompt: event.target.value })}
                    placeholder="Запреты: text, watermark, logo, плохие лица, лишние конечности..."
                  />
                </label>
              </div>

              <label className="avaBoardNoteField">
                Заметка сцены
                <textarea
                  value={selectedScene.note || ''}
                  onChange={(event) => updateScene(selectedScene.id, { note: event.target.value })}
                  placeholder="Ручная заметка для себя / следующего этапа"
                />
              </label>
            </section>
          </div>

          <aside className="avaBoardMediaPanel">
            <div className="avaBoardMediaHeader">
              <div>
                <p className="avaEyebrow">media studio</p>
                <h3>{firstLastMode ? 'First / Last кадры' : 'Фото и видео'}</h3>
              </div>
              <span>{selectedScene.route} · {selectedEffectiveFormat}</span>
            </div>

            {firstLastMode ? (
              <div className="avaBoardFirstLastGrid">
                <ImageSlot
                  key={`${selectedSceneIdForMediaV129O}:first`}
                  title="Первый кадр"
                  subtitle="start frame"
                  value={selectedFirstSlotPreviewUrlV132O}
                  name={selectedScene.first_frame_name}
                  busy={selectedFirstImageSlotStateV132O.busy}
                  busyLabel={selectedFirstImageSlotStateV132O.busyLabel}
                  busyHint={selectedFirstImageSlotStateV132O.busyHint}
                  statusLabel={selectedFirstImageSlotStateV132O.statusLabel}
                  statusClassName={selectedFirstImageSlotStateV132O.statusClassName}
                  onSelect={(event) => setSceneFile(selectedScene, 'first_frame_url', 'first_frame_name', 'image_status', event)}
                  onClear={() => clearSceneFile(selectedScene, ['first_frame_url', 'first_frame_name'])}
                />
                <ImageSlot
                  key={`${selectedSceneIdForMediaV129O}:last`}
                  title="Последний кадр"
                  subtitle="end frame"
                  value={selectedLastImagePreviewUrl}
                  name={selectedScene.last_frame_name}
                  busy={selectedLastImageSlotStateV132O.busy}
                  busyLabel={selectedLastImageSlotStateV132O.busyLabel}
                  busyHint={selectedLastImageSlotStateV132O.busyHint}
                  statusLabel={selectedLastImageSlotStateV132O.statusLabel}
                  statusClassName={selectedLastImageSlotStateV132O.statusClassName}
                  onSelect={(event) => setSceneFile(selectedScene, 'last_frame_url', 'last_frame_name', 'image_status', event)}
                  onClear={() => clearSceneFile(selectedScene, ['last_frame_url', 'last_frame_name'])}
                />
              </div>
            ) : (
              <ImageSlot
                key={`${selectedSceneIdForMediaV129O}:image`}
                title="Фото / Start image"
                subtitle="основной кадр для i2v / ia2v"
                value={selectedImagePreviewUrl}
                name={selectedScene.image_name}
                busy={selectedImageSlotStateV132O.busy}
                busyLabel={selectedImageSlotStateV132O.busyLabel}
                busyHint={selectedImageSlotStateV132O.busyHint}
                statusLabel={selectedImageSlotStateV132O.statusLabel}
                statusClassName={selectedImageSlotStateV132O.statusClassName}
                onSelect={(event) => setSceneFile(selectedScene, 'image_url', 'image_name', 'image_status', event)}
                onClear={() => clearSceneFile(selectedScene, ['image_url', 'image_name'])}
              />
            )}

            <div className="avaBoardVideoPreview">
              <div className="avaBoardVideoHeader">
                <strong><Film size={16} /> Видео preview</strong>
                <span className={`avaBoardVideoHeaderStatusV132O ${selectedVideoIndicatorV132O.className || ''}`}>
                  {selectedVideoIndicatorV132O.showSpinner ? <i className="avaBoardTinyMediaSpinner isGold" aria-hidden="true" /> : null}
                  {selectedVideoIndicatorV132O.headerLabel || scenePreviewVideoLabel(selectedScene)}
                </span>
              </div>
              {selectedPreviewVideoUrl && !selectedVideoLoadError ? (
                <>
                  <div className="avaBoardVideoFrameV64">
                    <video
                    ref={selectedVideoElementRefV201D}
                    key={selectedPreviewAssetApiPath || selectedPreviewVideoUrl}
                    src={selectedPreviewVideoUrl}
                    controls
                    preload="metadata"
                    playsInline
                    onTimeUpdate={(event) => syncAssemblyVideoTrimTimeFromPlayerV201D(event.currentTarget)}
                    onPlay={() => setAssemblyVideoTrimPlayingV201D(true)}
                    onPause={(event) => { syncAssemblyVideoTrimTimeFromPlayerV201D(event.currentTarget); setAssemblyVideoTrimPlayingV201D(false) }}
                    onEnded={(event) => { syncAssemblyVideoTrimTimeFromPlayerV201D(event.currentTarget); setAssemblyVideoTrimPlayingV201D(false) }}
                    onLoadedMetadata={(event) => {
                      const duration = event.currentTarget?.duration || 0
                      console.log('[BOARD VIDEO ELEMENT LOADED]', {
                        sceneId: selectedScene?.id || selectedScene?.scene_id || '',
                        src: selectedPreviewVideoUrl,
                        duration,
                      })
                      rememberSelectedSceneVideoDurationV201A(duration)
                      setAssemblyVideoTrimTimeV201D(Number((event.currentTarget?.currentTime || 0).toFixed(3)))
                      if (!duration) setSelectedVideoLoadError('video_duration_0')
                    }}
                    onError={(event) => {
                      const errorCode = event.currentTarget?.error?.code || ''
                      setSelectedVideoLoadError(String(errorCode || 'video_element_error'))
                      console.warn('[BOARD VIDEO ELEMENT ERROR]', {
                        sceneId: selectedScene?.id || selectedScene?.scene_id || '',
                        src: selectedPreviewVideoUrl,
                        errorCode,
                      })
                    }}
                  />

                    {['starting', 'queued', 'preparing', 'running'].includes(String(selectedScene.mmaudio_status || selectedScene.mmaudioStatus || '').toLowerCase()) && (
                      <div className="avaBoardVideoMmaudioOverlayV64">
                        {/* AVA_BOARD_MMAUDIO_BUSY_VIDEO_OVERLAY_V64 */}
                        <span className="avaBoardTinyMediaSpinner isGold" aria-hidden="true" />
                        <div>
                          <strong>MMAudio делается</strong>
                          <small>Старое видео остаётся на экране, новый звук собирается в ComfyLab.</small>
                        </div>
                      </div>
                    )}

                    {selectedVideoIndicatorV132O.overlay ? (
                      <div className={`avaBoardVideoStatusOverlayV132O ${selectedVideoIndicatorV132O.className || ''}`}>
                        {/* AVA_BOARD_MEDIA_STATUS_INDICATORS_V132O: keep old preview visible during bad-review regeneration */}
                        <span className="avaBoardTinyMediaSpinner isGold" aria-hidden="true" />
                        <div>
                          <strong>{selectedVideoIndicatorV132O.overlayTitle}</strong>
                          <small>{selectedVideoIndicatorV132O.overlayHint}</small>
                        </div>
                      </div>
                    ) : null}
                  </div>
                   <div className="avaBoardVideoActions">
                     {boardSceneCanReviewVideo(selectedScene) && boardSceneCanShowVideoReviewV133B(selectedScene) ? (() => {
                       const reviewInfo = boardSceneVideoReviewInfo(selectedScene)
                       return (
                         <button
                           type="button"
                           className={`avaBoardVideoReviewAction ${reviewInfo.className}`}
                           title={reviewInfo.title}
                           onClick={(event) => toggleSceneVideoReview(selectedScene, event)}
                         >
                           <i>{reviewInfo.square}</i> {reviewInfo.label || 'пометить плохим'}
                         </button>
                       )
                     })() : null}
                   </div>
                </>
              ) : selectedPreviewVideoLoading ? (
                <div className="avaBoardVideoEmpty isBusy avaBoardMediaSpinnerOverlayV15">
                  {/* AVA_BOARD_VIDEO_PREVIEW_LOADING_SPINNER_V15 */}
                  <span className="avaBoardTinyMediaSpinner isGold" aria-hidden="true" />
                  <span>{selectedVideoIndicatorV132O.emptyTitle}</span>
                  <small>{selectedVideoIndicatorV132O.emptyHint}</small>
                </div>
              ) : selectedVideoLoadError ? (
                <div className="avaBoardVideoEmpty isError">
                  <Film size={34} />
                  <span>Видео preview недоступно</span>
                  <small>{selectedVideoLoadError}</small>
                </div>
              ) : (
                <div className={`avaBoardVideoEmpty ${selectedVideoIndicatorV132O.showSpinner ? 'isBusy isGeneratingVideoV15' : ''}`}>
                  {/* AVA_BOARD_MEDIA_STATUS_INDICATORS_V132O: explicit video queue/generation status */}
                  {selectedVideoIndicatorV132O.showSpinner ? (
                    <span className="avaBoardTinyMediaSpinner isGold" aria-hidden="true" />
                  ) : (
                    <Film size={34} />
                  )}
                  <span>{selectedVideoIndicatorV132O.emptyTitle}</span>
                  {selectedVideoIndicatorV132O.emptyHint ? (
                    <small>{selectedVideoIndicatorV132O.emptyHint}</small>
                  ) : null}
                </div>
              )}
            </div>            {!selectedSceneTimingLocked && manualSceneToolsEnabled && selectedScene ? (
              <section className={`avaBoardAssemblyVideoTrimPanelV201A ${selectedAssemblyVideoTrimCanUseV201A ? '' : 'isLocked'} ${selectedAssemblyVideoTrimRangeV201A.enabled ? 'isEnabled' : ''}`}>
                <button
                  type="button"
                  className="avaBoardAssemblyVideoTrimSummaryV201A"
                  onClick={() => setAssemblyVideoTrimOpenV201A((value) => !value)}
                >
                  <span>✂ Обрезка видео в сборке</span>
                  <strong>
                    {selectedAssemblyVideoTrimCanUseV201A
                      ? (selectedAssemblyVideoTrimRangeV201A.enabled
                        ? `${formatBoardTrimSecondsV201A(selectedAssemblyVideoTrimRangeV201A.start)}–${formatBoardTrimSecondsV201A(selectedAssemblyVideoTrimRangeV201A.end)} · итог ${formatBoardTrimSecondsV201A(selectedAssemblyVideoTrimRangeV201A.clipDuration)} сек`
                        : `выкл · видео ${selectedAssemblyVideoTrimRangeV201A.duration ? `${formatBoardTrimSecondsV201A(selectedAssemblyVideoTrimRangeV201A.duration)} сек` : 'ждём metadata'}`)
                      : (selectedAssemblyVideoTrimAudioLockedV201A ? 'заблокировано для ia2v/lip-sync' : 'недоступно')}
                  </strong>
                  <i>{assemblyVideoTrimOpenV201A ? '˄' : '˅'}</i>
                </button>

                {assemblyVideoTrimOpenV201A ? (
                  <div className="avaBoardAssemblyVideoTrimBodyV201A">
                    {selectedAssemblyVideoTrimCanUseV201A ? (
                      <>
                        <div className="avaBoardAssemblyVideoTrimCompactV201D">
                          <div className="avaBoardAssemblyVideoTrimCompactPlayerV201D">
                            <button
                              type="button"
                              className="avaBoardAssemblyVideoTrimPlayV201D"
                              disabled={!selectedAssemblyVideoTrimRangeV201A.duration}
                              onClick={toggleSelectedAssemblyVideoTrimPlayerV201D}
                            >
                              {assemblyVideoTrimPlayingV201D ? '⏸' : '⏪'}
                            </button>
                            <div className="avaBoardAssemblyVideoTrimClockV201D">
                              <span>видео</span>
                              <strong>{formatBoardTrimSecondsV201A(assemblyVideoTrimTimeV201D)}</strong>
                            </div>
                          </div>

                          <div className="avaBoardAssemblyVideoTrimPickersV201D">
                            <button
                              type="button"
                              disabled={!selectedAssemblyVideoTrimRangeV201A.duration}
                              onClick={() => setSelectedAssemblyVideoTrimEdgeFromPlayerV201D('start')}
                            >
                              Взять текущее как начало
                            </button>
                            <button
                              type="button"
                              disabled={!selectedAssemblyVideoTrimRangeV201A.duration}
                              onClick={() => setSelectedAssemblyVideoTrimEdgeFromPlayerV201D('end')}
                            >
                              Взять текущее как конец
                            </button>
                            <strong>{formatBoardTrimSecondsV201A(selectedAssemblyVideoTrimRangeV201A.start)}</strong>
                            <strong>{formatBoardTrimSecondsV201A(selectedAssemblyVideoTrimRangeV201A.end || selectedAssemblyVideoTrimRangeV201A.duration || 0)}</strong>
                          </div>

                          <div className="avaBoardAssemblyVideoTrimMiniActionsV201D">
                            <button
                              type="button"
                              disabled={!selectedAssemblyVideoTrimRangeV201A.duration}
                              onClick={() => updateSelectedAssemblyVideoTrimV201A({ startSec: 0, endSec: selectedAssemblyVideoTrimRangeV201A.duration, enabled: false })}
                            >
                              всё
                            </button>
                            <button type="button" onClick={resetSelectedAssemblyVideoTrimV201A}>сброс</button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="avaBoardAssemblyVideoTrimLockV201A">
                        <strong>Обрезка заблокирована 🔒</strong>
                        <small>{selectedAssemblyVideoTrimAudioLockedV201A
                          ? 'ia2v / lip-sync / instrumental считаем готовым синхронизированным клипом. Его не режем.'
                          : 'Сцена привязана к Manual Timing.'}</small>
                      </div>
                    )}
                  </div>
                ) : null}
              </section>
            ) : null}            {/* AVA_BOARD_TIMING_DURATION_LOCK_V38: lock duration by scene data, not by entry route. */}
            {selectedSceneTimingLocked ? (
              <section className="avaBoardSceneDurationPanel isTimingLocked">
                <div className="avaBoardDurationLocked">
                  <Clock3 size={15} />
                  <div>
                    <span>Длительность из Тайминга: <strong>{selectedSceneLockedDurationLabel} сек</strong> 🔒</span>
                    <small>Генерация и сборка используют start/end этой сцены. Рычаг отключён, даже если открыть Доску напрямую.</small>
                  </div>
                </div>
              </section>
            ) : (
              <section className={`avaBoardSceneDurationPanel ${manualSceneToolsEnabled && selectedScene && isIa2vRoute(selectedScene.route) ? 'isManualLipSyncHiddenV129G' : ''}`}>
                <label className="avaBoardDurationSlider">
                  <span>Длительность сцены: <strong>{manualSceneDurationSec} сек</strong></span>
                  <input
                    type="range"
                    min="2"
                    max="12"
                    step="0.5"
                    value={manualSceneDurationSec}
                    onChange={(event) => updateSelectedSceneDuration(Number(event.target.value))}
                  />
                </label>
              </section>
            )}




            <div className="avaBoardSceneWorkflowPanel">
              <div className="avaBoardWorkflowHead">
                <strong>Действия сцены</strong>
                <span>{selectedScene.route} · {selectedEffectiveFormat}</span>
              </div>

              <div className="avaBoardWorkflowButtons">
                {selectedIndex > 0 && (
                  <button
                    type="button"
                    className={`avaBoardWorkflowButton isFrame ${selectedScene.first_frame_url ? 'isReady' : selectedScene.first_frame_status ? 'isPlanned' : ''}`}
                    onClick={(event) => {
                      stopBoardActionEvent(event)
                      takePreviousLastFrame()
                    }}
                    title={previousScene ? 'Взять последний кадр из видео предыдущей сцены' : 'Нет предыдущей сцены'}
                  >
                    <ImageIcon size={16} />
                    <span>Взять последний кадр</span>
                    <small>{selectedScene.first_frame_url ? 'кадр в первом окне' : selectedScene.first_frame_status === 'extracting_from_previous_video' ? 'извлекаем…' : selectedScene.first_frame_status === 'error' ? (selectedScene.first_frame_error || 'ошибка кадра') : selectedScene.first_frame_status === 'extracted_from_previous_video' ? 'из видео предыдущей сцены' : 'из предыдущей сцены'}</small>
                  </button>
                )}

                {isIa2vRoute(selectedScene.route) && manualSceneToolsEnabled ? (() => {
                  const manualAudioSceneId = manualLipSyncSceneIdV129A(selectedScene)
                  const manualAudioUploading = Boolean(manualLipSyncAudioUploadingV129A[manualAudioSceneId])
                  const manualAudioPreviewUrl = manualLipSyncAudioPreviewUrlV129A(selectedScene)
                  const manualAudioReady = Boolean(manualLipSyncAudioSourceV129A(selectedScene))
                  const manualAudioDuration = Number(selectedScene.audio_slice_duration || selectedScene.audioSliceDuration || selectedScene.manual_lipsync_audio_duration || selectedScene.manualLipSyncAudioDuration || 0)
                  const manualAudioName = selectedScene.audio_slice_name || selectedScene.audioSliceName || selectedScene.manual_lipsync_audio_name || selectedScene.manualLipSyncAudioName || 'audio'
                  return (
                    <div className="avaBoardManualLipSyncAudioPanelV129A">
                      <input
                        ref={manualLipSyncAudioInputRefV129A}
                        type="file"
                        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.oga,.webm,.flac"
                        className="avaBoardHiddenFileInputV129A"
                        onChange={uploadManualLipSyncAudioFromInputV129A}
                      />
                      <button
                        type="button"
                        className={`avaBoardWorkflowButton isAudio ${manualAudioReady ? 'isReady' : manualAudioUploading || selectedScene.audio_slice_status === 'uploading' ? 'isBusy' : selectedScene.audio_slice_status === 'error' ? 'isError' : ''}`}
                        title={manualAudioName}
                        onClick={(event) => {
                          stopBoardActionEvent(event)
                          manualLipSyncAudioInputRefV129A.current?.click()
                        }}
                        disabled={manualAudioUploading}
                      >
                        {manualAudioUploading ? <span className="avaBoardButtonSpinnerV15" aria-hidden="true" /> : <AudioLines size={16} />}
                        <span>{manualAudioReady ? 'Заменить аудио' : 'Загрузить аудио'}</span>
                        <small>{manualAudioUploading ? 'загружаем asset…' : manualAudioReady ? (manualAudioDuration > 0 ? `audio готов · ${manualAudioDuration.toFixed(2)}с` : 'audio готов') : selectedScene.audio_slice_status === 'error' ? (selectedScene.audio_slice_error || 'ошибка audio') : 'для lip-sync'}</small>
                      </button>
                      {manualAudioReady && (
                        <div className="avaBoardManualLipSyncPlayerV129A">
                          {manualAudioPreviewUrl ? (
                            <audio controls src={manualAudioPreviewUrl} preload="metadata" />
                          ) : (
                            <small>Плеер восстанавливает audio asset…</small>
                          )}
                          <button
                            type="button"
                            className="avaBoardMiniGhostButtonV129A"
                            onClick={(event) => {
                              stopBoardActionEvent(event)
                              clearManualLipSyncAudioV129A()
                            }}
                          >
                            Очистить
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })() : isIa2vRoute(selectedScene.route) ? (
                  <button
                    type="button"
                    className={`avaBoardWorkflowButton isAudio ${selectedScene.audio_slice_status === 'ready' ? 'isReady' : selectedScene.audio_slice_status === 'extracting' ? 'isBusy' : selectedScene.audio_slice_status === 'error' ? 'isError' : ''}`}
                    title={selectedScene.audio_slice_name || selectedScene.audio_slice_url || "audio slice"}
                    onClick={(event) => {
                      stopBoardActionEvent(event)
                      if (bulkStillsImporting) {
                        setStatus('Дождись окончания загрузки фото, потом режь audio slice.')
                        pushBoardToast({ type: 'warning', title: 'Audio slice', message: 'Фото ещё грузятся. Дождись “фото готово” на сценах.' })
                        return
                      }
                      markAudioSlicePlanned()
                    }}
                    disabled={bulkStillsImporting || selectedScene.audio_slice_status === 'extracting'}
                  >
                    <Scissors size={16} />
                    <span>{selectedScene.audio_slice_status === 'ready' ? 'Аудио изъято' : selectedScene.audio_slice_status === 'extracting' ? 'Извлекаем аудио…' : 'Изъять аудио'}</span>
                    <small>{selectedScene.audio_slice_status === 'ready' ? ((Number(selectedScene.audio_slice_duration || 0) > 0) ? `MP3 готов · ${Number(selectedScene.audio_slice_duration || 0).toFixed(2)}с` : 'MP3 готов') : selectedScene.audio_slice_status === 'extracting' ? 'режем из master audio…' : selectedScene.audio_slice_status === 'error' ? 'ошибка slice' : 'можно заранее · иначе авто перед видео'}</small>
                  </button>
                ) : null}

                <button
                  type="button"
                  className={sceneVideoActionState(selectedScene).className}
                  onClick={(event) => {
                    stopBoardActionEvent(event)
                    requestSceneVideoQueue()
                  }}
                  disabled={sceneVideoActionState(selectedScene).disabled}
                >
                  {sceneVideoActionState(selectedScene).disabled ? (
                    <span className="avaBoardButtonSpinnerV15" aria-hidden="true" />
                  ) : (
                    <Film size={16} />
                  )}
                  <span>{sceneVideoActionState(selectedScene).label}</span>
                  <small>{sceneVideoActionState(selectedScene).hint}</small>
                </button>
              </div>

                {/* Stage 76 — MMAudio prompt drawer */}
                {['i2v', 'first_last'].includes(selectedScene.route) && (() => {
                  const mmaudioStatus = String(selectedScene.mmaudio_status || selectedScene.mmaudioStatus || '').toLowerCase()
                  const mmaudioBusy = ['starting', 'queued', 'preparing', 'running'].includes(mmaudioStatus)
                  const mmaudioReady = mmaudioStatus === 'ready' || Boolean(selectedScene.mmaudio_video_url || selectedScene.mmaudioVideoUrl)
                  const mmaudioError = mmaudioStatus === 'error'
                  const hasSourceVideo = Boolean(
                    selectedScene.video_api_path ||
                    selectedScene.videoApiPath ||
                    selectedScene.video_url ||
                    selectedScene.videoUrl
                  )
                  const title = mmaudioBusy ? 'MMAudio делается' : mmaudioReady ? 'MMAudio готово' : 'MMAudio'
                  const hint = mmaudioBusy
                    ? (mmaudioStatus === 'queued' ? 'в очереди ComfyLab…' : 'ComfyLab выполняет job…')
                    : mmaudioReady
                      ? 'звуковая версия готова'
                      : hasSourceVideo
                        ? 'открыть sound prompt'
                        : 'сначала сделай видео'
                  const panelClassName = `avaBoardMmaudioPanel ${mmaudioOpen ? 'isOpen' : ''} ${mmaudioBusy ? 'isBusy' : ''} ${mmaudioReady ? 'isReady' : ''} ${mmaudioError ? 'isError' : ''}`.trim()

                  return (
                    <div className={panelClassName}>
                      <button
                        type="button"
                        className="avaBoardMmaudioToggle isMagic"
                        onClick={(event) => {
                          stopBoardActionEvent(event)
                          setMmaudioOpen((value) => !value)
                        }}
                        title="MMAudio sound design через ComfyLab"
                      >
                        <Sparkles size={16} />
                        <span>{title}</span>
                        <small>{hint}</small>
                        {mmaudioOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>

                      {mmaudioOpen && (
                        <div className="avaBoardMmaudioBox">
                          <label className="avaBoardWideField">
                            Positive sound prompt
                            <textarea
                              value={selectedScene.mmaudio_prompt || ''}
                              onChange={(event) => updateScene(selectedScene.id, { mmaudio_prompt: event.target.value })}
                              placeholder="Например: quiet African savannah ambience, warm wind through dry grass, distant insects, soft natural wildlife documentary sound"
                            />
                          </label>

                          <label className="avaBoardWideField">
                            Negative sound prompt
                            <textarea
                              value={selectedScene.mmaudio_negative_prompt || ''}
                              onChange={(event) => updateScene(selectedScene.id, { mmaudio_negative_prompt: event.target.value })}
                              placeholder="music, soundtrack, narration, speech, human voice, distorted audio, clipping, harsh noise, repeated loop"
                            />
                          </label>

                          <div className="avaBoardMmaudioActions">
                            <button
                              type="button"
                              onClick={(event) => {
                                stopBoardActionEvent(event)
                                startMmaudioForSelectedScene()
                              }}
                              disabled={mmaudioBusy || !hasSourceVideo}
                            >
                              <Volume2 size={15} />
                              {mmaudioBusy ? 'Отправлено…' : 'Отправить MMAudio'}
                            </button>
                            <span>{hasSourceVideo ? 'ComfyLab · mmaudio-sound-design.json · 1 кредит после успеха' : 'Сначала сделай базовое видео для этой сцены'}</span>
                          </div>

                          {mmaudioError && (
                            <p className="avaBoardMmaudioError">{selectedScene.mmaudio_error || selectedScene.mmaudioError || 'MMAudio ошибка'}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })()}
            </div>

            <div className="avaBoardHintBox">
              {firstLastMode ? (
                <><CheckCircle2 size={16} /> Для first-last нужны первый и последний кадр. Первый можно взять из предыдущей сцены.</>
              ) : isIa2vRoute(selectedScene.route) ? (
                <><AlertTriangle size={16} /> Для ia2v используем audio slice сцены; ASR не управляет таймингом.</>
              ) : (
                <><CheckCircle2 size={16} /> Генерация будет подключена после foundation UI.</>
              )}
            </div>
          </aside>
        </section>
      ) : (
        <section className="avaBoardNoScene">
          <h3>Сцен пока нет</h3>
          <p>Открой Manual Timing, сделай экспорт/сохранение сцен или импортируй JSON вручную.</p>
          <Link className="avaPrimaryButton" to={workspaceMode ? '/app/workspace/timing' : `/app/projects/${projectId}/timing`}>Открыть Тайминг</Link>
        </section>
      )}
    </div>
  )
}



