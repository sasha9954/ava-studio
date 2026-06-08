/* AVA_BOARD_TIMING_DURATION_LOCK_V38: Timing-imported Board scenes have locked duration independent of route. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
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
import { isWorkflowStageCleared, clearWorkflowStageClearedMarker, clearWorkflowEntry, readWorkflowEntry, makeWorkflowEntry, rememberWorkflowEntry } from '../utils/workflowNavigation.js'
import '../styles/ava-board.css'

const STAGE = 'board'
const BOARD_VERSION = 'ava_board_foundation_v1'
const AVA_GLOBAL_JOBS_KEY = 'ava:active-jobs:v1'
const AVA_COMPLETED_JOBS_KEY = 'ava:completed-jobs:v1'
const AVA_BOARD_SEEN_COMPLETED_JOBS_KEY = 'ava:board:seen-completed-jobs:v1'
const AVA_OPEN_BOARD_SCENE_KEY = 'ava:open-board-scene:v1'

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

const ROUTE_OPTIONS = [
  { value: 'ia2v', label: 'ia2v lip-sync', hint: 'Фото + audio slice сцены' },
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
  lip_sync: 'image-lipsink-video-music.json',
  first_last: 'last-first cadr-NO sound.json',
  first_last_sound: 'last-first cadr-sound.json',
}

function boardWorkflowKeyForRoute(route, fallbackWorkflowKey = '') {
  const routeKey = String(route || 'i2v')
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
    refKeys: ['video_api_path', 'videoApiPath', 'video_url', 'videoUrl', 'resultUrl', 'result_url'],
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
    refKeys: ['first_image_api_path', 'firstImageApiPath', 'first_frame_api_path', 'firstFrameApiPath', 'first_frame_url', 'firstFrameUrl', 'start_image_api_path', 'startImageApiPath'],
  })

  next = canonicalizeSceneAssetFields(next, {
    assetKeys: ['last_image_asset_id', 'lastImageAssetId', 'last_frame_asset_id', 'lastFrameAssetId', 'end_image_asset_id', 'endImageAssetId'],
    apiKeys: ['last_image_api_path', 'lastImageApiPath', 'last_frame_api_path', 'lastFrameApiPath', 'end_image_api_path', 'endImageApiPath'],
    urlKeys: ['last_frame_url', 'lastFrameUrl', 'last_image_url', 'lastImageUrl', 'end_image_url', 'endImageUrl'],
    refKeys: ['last_image_api_path', 'lastImageApiPath', 'last_frame_api_path', 'lastFrameApiPath', 'last_frame_url', 'lastFrameUrl', 'end_image_api_path', 'endImageApiPath'],
  })

  return next
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
      safeScene.mediaUrl,
      safeScene.media_url,
      safeScene.resultUrl,
      safeScene.result_url,
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

function stripBoardDurableRuntimePayload(value, key = '') {
  if (Array.isArray(value)) return value.map((item) => stripBoardDurableRuntimePayload(item, key))
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && /^(data:|blob:)/i.test(value)) return ''
    return value
  }

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
    stripped[field] = stripBoardDurableRuntimePayload(fieldValue, field)
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
    const canonicalBoardData = canonicalizeBoardMediaRefs(boardData)
    const payload = {
      ...sanitizeBoardDurableBackup(canonicalBoardData),
      boardVersion: canonicalBoardData?.boardVersion || BOARD_VERSION,
      durableSavedAt: new Date().toISOString(),
      updatedAt: canonicalBoardData?.updatedAt || new Date().toISOString(),
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

function chooseBoardDataForLoad(serverBoardData = {}, localBoardData = null) {
  if (!localBoardData || !Array.isArray(localBoardData.scenes)) return serverBoardData || {};

  const serverScenes = asArray(serverBoardData?.scenes);
  const localScenes = asArray(localBoardData?.scenes);
  if (!serverScenes.length && localScenes.length) return localBoardData;
  if (localScenes.length > serverScenes.length) return localBoardData;
  if (boardHasManualScenes(localBoardData) && !boardHasManualScenes(serverBoardData)) return localBoardData;

  const serverUpdated = Date.parse(serverBoardData?.updatedAt || serverBoardData?.durableSavedAt || '') || 0;
  const localUpdated = Date.parse(localBoardData?.updatedAt || localBoardData?.durableSavedAt || '') || 0;
  if (localUpdated > serverUpdated) return localBoardData;

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
      mmaudio_job_id: data?.jobId || data?.job_id || job.jobId || '',
      mmaudio_status_endpoint: job.statusEndpoint || '',
      mmaudio_error: '',
      mmaudio_result: data,
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

function storyboardSceneColor(scene, index = 0) {
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

  if (blockKey) {
    if (Number.isFinite(blockNumber)) {
      return 185 + ((blockNumber * 47) % 150)
    }
    return storyboardStableHueFromText(`block:${blockKey}`, index)
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

function normalizeAudioSliceStatus(rawScene = {}, savedScene = {}) {
  const status = asText(savedScene?.audio_slice_status || rawScene?.audio_slice_status || 'not_extracted')
  const hasServerSlice = Boolean(
    savedScene?.audio_slice_url ||
    savedScene?.audioSliceUrl ||
    savedScene?.audio_slice_api_path ||
    savedScene?.audioSliceApiPath ||
    rawScene?.audio_slice_url ||
    rawScene?.audioSliceUrl ||
    rawScene?.audio_slice_api_path ||
    rawScene?.audioSliceApiPath
  )

  if (status === 'ready' && !hasServerSlice) return 'not_extracted'
  return status || 'not_extracted'
}

function normalizeBoardScene(rawScene, index, phrases, savedScene = {}) {
  const start = toNumber(rawScene?.start_sec ?? rawScene?.start, 0)
  const end = toNumber(rawScene?.end_sec ?? rawScene?.end, start)
  const id = asText(rawScene?.scene_id || rawScene?.id || savedScene?.scene_id || savedScene?.id || `seg_${String(index + 1).padStart(2, '0')}`)

  const phraseIds = getScenePhraseIds(rawScene, phrases)
  const sceneText = collectSceneText(rawScene, phrases)
  const translated = asText(rawScene?.translated_text_ru) || collectByField(rawScene, phrases, ['translation_ru', 'text_ru', 'ruText'])
  const meaning = asText(rawScene?.meaning_hint_ru || rawScene?.meaningText) || collectByField(rawScene, phrases, ['meaning_hint_ru', 'meaningText', 'meaning_ru'])
  const route = asText(savedScene?.route || rawScene?.route) || 'i2v'
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
    rawScene?.format ||
    rawScene?.aspect_ratio ||
    rawScene?.aspectRatio
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
    audio_slice_url: savedScene?.audio_slice_url || rawScene?.audio_slice_url || '',
    audio_slice_status: normalizeAudioSliceStatus(rawScene, savedScene),
    previous_frame_status: savedScene?.previous_frame_status || rawScene?.previous_frame_status || 'empty',
  }
}

function buildBoardFromTiming(timingData = {}, boardData = {}) {
  const timing = timingData?.manualTiming || timingData?.manual_timing || timingData || {}
  const existing = boardData?.board || boardData || {}
  const phrases = buildPhraseList(timing)
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

  const finalScenes = scenes.length ? [...scenes, ...extraBoardScenes] : fallbackScenes
  const timingAudio = boardAudioFromTiming(timing)
  const audio = boardAudioHasAsset(existing.audio) ? existing.audio : (timingAudio || existing.audio || {
    name: timing.audioName || timing.audio_name || '',
    assetId: timing.audioAssetId || timing.audio_asset_id || '',
    assetApiPath: timing.audioApiPath || timing.asset_api_path || '',
    durationSec: timing.audioDurationSec || timing.audio_duration_sec || 0,
  })

  const pendingOpenSceneIdForBuild = typeof sessionStorage !== 'undefined'
    ? asText(sessionStorage.getItem(AVA_OPEN_BOARD_SCENE_KEY))
    : ''
  const selectedId = pendingOpenSceneIdForBuild || asText(existing.selectedSceneId) || finalScenes[0]?.id || ''
  return {
    ...emptyBoard,
    ...existing,
    boardVersion: BOARD_VERSION,
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

function scenePreviewVideoUrl(scene) {
  if (!scene || isVideoBusyStatus(scene.video_status)) return ''
  return normalizeBoardMediaUrl(
    scene.mmaudio_video_api_path ||
    scene.mmaudioVideoApiPath ||
    scene.mmaudio_video_url ||
    scene.mmaudioVideoUrl ||
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
  if (!scene || isVideoBusyStatus(scene.video_status)) return ''
  return boardProtectedAssetApiPath(
    scene.mmaudio_video_api_path ||
    scene.mmaudioVideoApiPath ||
    scene.video_api_path ||
    scene.videoApiPath ||
    scene.resultVideoApiPath ||
    scene.result_video_api_path ||
    ''
  )
}

function sceneStaticVideoCandidate(scene) {
  if (!scene || isVideoBusyStatus(scene.video_status)) return ''
  const values = [
    scene.mmaudio_video_url,
    scene.mmaudioVideoUrl,
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

function scenePreviewVideoLabel(scene) {
  if (!scene) return 'empty'
  const status = String(scene.video_status || '').toLowerCase()
  if (isVideoBusyStatus(status)) {
    if (status === 'starting') return 'отправляется'
    if (status === 'queued') return 'в очереди'
    if (status === 'preparing' || status === 'submitting') return 'подготовка'
    return 'видео делается'
  }
  if (scene.mmaudio_video_url || scene.mmaudioVideoUrl) return 'mmaudio ready'
  return scene.video_status || 'empty'
}

function normalizeLoadedBoardVideoStatuses(boardData = {}) {
  const scenes = asSceneArray(boardData.scenes)
  if (!scenes.length) return boardData

  const resetWhenNoServerJob = new Set(['starting', 'preparing', 'submitting', 'running', 'queued_no_prompt_id'])
  let changed = false

  const nextScenes = scenes.map((scene) => {
    const status = String(scene?.video_status || '').toLowerCase()
    const hasServerJob = Boolean(scene?.video_job_id || scene?.video_status_endpoint)
    const hasVideo = Boolean(sceneMediaFieldValue(scene, 'video', 'apiPath') || sceneMediaFieldValue(scene, 'video', 'url') || scene?.video_name || scene?.videoName)

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



function sceneStatus(scene) {
  const status = String(scene?.video_status || '').toLowerCase()
  const hasPrompt = Boolean(asText(scene?.video_prompt))
  const hasImage = Boolean(
    sceneMediaFieldValue(scene, 'image', 'apiPath') || sceneMediaFieldValue(scene, 'first', 'apiPath') || sceneMediaFieldValue(scene, 'last', 'apiPath') ||
    sceneMediaFieldValue(scene, 'image', 'url') || sceneMediaFieldValue(scene, 'first', 'url') || sceneMediaFieldValue(scene, 'last', 'url') ||
    scene?.image_data_url || scene?.start_image_data_url || scene?.end_image_data_url ||
    scene?.image_name || scene?.first_frame_name || scene?.last_frame_name
  )
  const hasVideo = Boolean(sceneMediaFieldValue(scene, 'video', 'apiPath') || sceneMediaFieldValue(scene, 'video', 'url') || scene?.video_name || scene?.videoName)

  if (status === 'starting') return { label: 'отправляется', className: 'isRunning' }
  if (status === 'queued') return { label: 'в очереди', className: 'isRunning' }
  if (status === 'preparing' || status === 'submitting') return { label: 'подготовка', className: 'isRunning' }
  if (status === 'running') return { label: 'видео делается', className: 'isRunning' }
  if (status === 'error') return { label: 'ошибка видео', className: 'isError' }
  if (hasVideo || status === 'ready') return { label: 'видео готово', className: 'isReady' }
  if (hasImage) return { label: 'кадр готов', className: 'isImage' }
  if (hasPrompt) return { label: 'промт готов', className: 'isPrompt' }
  return { label: 'черновик', className: 'isDraft' }
}

function videoButtonState(scene) {
  const status = String(scene?.video_status || '').toLowerCase()
  const hasVideo = Boolean(sceneMediaFieldValue(scene, 'video', 'apiPath') || sceneMediaFieldValue(scene, 'video', 'url') || scene?.video_name || scene?.videoName)

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
  if (hasVideo || status === 'ready') {
    return { className: 'isReady', label: 'Сделать заново', sublabel: 'готово · можно перегенерить' }
  }
  return { className: '', label: 'Сделать видео', sublabel: 'POST video/start' }
}


function ImageSlot({ title, subtitle, value, name, onSelect, onClear }) {
  const [imageLoading, setImageLoading] = useState(Boolean(value))
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setImageFailed(false)
    setImageLoading(Boolean(value))
  }, [value])

  return (
    <div className="avaBoardImageSlot">
      <div className="avaBoardImageSlotHeader">
        <div>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
        {name && <small>{name}</small>}
      </div>
      <div className={`avaBoardImagePreview ${imageLoading ? 'isLoadingMedia' : ''} ${imageFailed ? 'isMissingMedia' : ''}`}>
        {value ? (
          <>
            {!imageFailed ? (
              <img
                src={value}
                alt={title}
                onLoad={() => setImageLoading(false)}
                onError={() => { setImageLoading(false); setImageFailed(true) }}
              />
            ) : null}
            {imageLoading ? (
              <div className="avaMediaLoadingOverlay avaBoardMediaSpinnerOverlayV15">
                {/* AVA_BOARD_MEDIA_LOADING_SPINNERS_V15: small loader for restored image assets */}
                <span className="avaBoardTinyMediaSpinner" aria-hidden="true" />
                <span className="avaBoardMediaLoaderText">Загружаем фото…</span>
              </div>
            ) : null}
            {imageFailed ? (
              <div className="avaMediaLoadingOverlay isMissing">
                <ImageIcon size={30} />
                <span>Фото не найдено</span>
              </div>
            ) : null}
          </>
        ) : <div><ImageIcon size={30} /><span>Нет изображения</span></div>}
      </div>
      <div className="avaBoardSlotActions">
        <label className="avaBoardSmallButton">
          <UploadCloud size={14} /> Загрузить
          <input type="file" accept="image/*" onChange={onSelect} />
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

export default function BoardPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const boardWorkflowEntry = useMemo(() => readWorkflowEntry('board', location.state), [location.state])
  const openedFromTiming = boardWorkflowEntry?.from === 'manual_timing'
  const workspaceMode = !projectId
  const { loadStage, saveStage, loadWorkspaceStage, saveWorkspaceStage } = useProjects()
  const [board, setBoard] = useState(emptyBoard)
  const [manualSceneDurationSec, setManualSceneDurationSec] = useState(6)


    const [showTimingToBoardConfirm, setShowTimingToBoardConfirm] = useState(false)
  const [timingToBoardImporting, setTimingToBoardImporting] = useState(false)

  useEffect(() => {
    // AVA_TIMING_TO_BOARD_NO_RELOAD_MODAL_V16:
    // The destructive question is shown in Timing before navigation. Board must not
    // show it again on F5, because that could erase freshly edited Board work.
    if (!openedFromTiming) return
    const entrySource = String(boardWorkflowEntry?.source || '')
    if (entrySource === 'manual_timing_to_board_confirmed_v16') {
      confirmTimingToBoardImportV14B()
      return
    }
    clearWorkflowEntry('board')
    setShowTimingToBoardConfirm(false)
    setStatus('Открыта Доска. Повторное окно переноса из Тайминга отключено после перезагрузки.')
  }, [openedFromTiming, boardWorkflowEntry?.source])

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
    const normalized = String(status || '').toLowerCase()
    const code = String(data?.code || data?.error?.code || '').toUpperCase()
    return normalized === 'not_found' || code === 'BOARD_VIDEO_JOB_NOT_FOUND'
  }

  function resetStaleVideoJobPatch(data = {}) {
    return {
      video_status: '',
      video_job_id: '',
      video_status_endpoint: '',
      video_error: '',
      video_queue_position: 0,
      video_result: data || null,
    }
  }

  function boardVideoUrlFromStatus(data) {
    return data?.videoApiPath || data?.video_api_path || data?.resultVideoApiPath || data?.result_video_api_path || data?.videoUrl || data?.video_url || data?.resultVideoUrl || data?.result_video_url || ''
  }

  function sceneVideoInputProblems(scene) {
    const route = String(scene?.route || 'i2v')
    const isFirstLast = isFirstLastRoute(route)
    const isLipSync = ['ia2v', 'ia2v_lipsync', 'lip_sync'].includes(route)

    const startImage = isFirstLast
      ? (sceneMediaFieldValue(scene, 'first', 'apiPath') || sceneMediaFieldValue(scene, 'first', 'url') || sceneMediaFieldValue(scene, 'image', 'apiPath') || sceneMediaFieldValue(scene, 'image', 'url') || scene?.start_image_data_url || scene?.startImageDataUrl || scene?.image_data_url || scene?.imageDataUrl || '')
      : (sceneMediaFieldValue(scene, 'image', 'apiPath') || sceneMediaFieldValue(scene, 'image', 'url') || sceneMediaFieldValue(scene, 'first', 'apiPath') || sceneMediaFieldValue(scene, 'first', 'url') || scene?.image_data_url || scene?.imageDataUrl || scene?.start_image_data_url || scene?.startImageDataUrl || '')

    const endImage = isFirstLast
      ? (sceneMediaFieldValue(scene, 'last', 'apiPath') || sceneMediaFieldValue(scene, 'last', 'url') || scene?.end_image_data_url || scene?.endImageDataUrl || '')
      : ''

    const audioSlice = scene?.audio_slice_url || scene?.audioSliceUrl || ''

    const problems = []
    if (!startImage) problems.push('нет первого/основного кадра')
    if (isFirstLast && !endImage) problems.push('нет последнего кадра')
    if (isLipSync && !audioSlice) problems.push('нет audio slice для lip-sync')
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
    // AVA_BOARD_RESTORE_NATIVE_ACTION_BUTTON_V48: queued/running states use the native action-state shape below.


    const videoStatus = String(scene?.video_status || '').toLowerCase()
    const hasVideo = Boolean(sceneMediaFieldValue(scene, 'video', 'apiPath') || sceneMediaFieldValue(scene, 'video', 'url') || scene?.video_name || scene?.videoName)
    const hasServerJob = Boolean(scene?.video_job_id || scene?.video_status_endpoint)
    const problems = sceneVideoInputProblems(scene)
    const hasInputProblems = problems.length > 0
    const isLocalQueued = videoStatus === 'queued' && !hasServerJob && !hasInputProblems
    const isBusy = !hasVideo && (
      ['starting', 'preparing', 'submitting', 'running', 'queued_no_prompt_id'].includes(videoStatus) ||
      (videoStatus === 'queued' && hasServerJob)
    )

    return {
      className: `avaBoardWorkflowButton isVideo ${isBusy ? 'isBusy' : isLocalQueued ? 'isQueued' : videoStatus === 'blocked_missing_comfy_base_url' ? 'isBlocked' : videoStatus === 'error' ? 'isError' : ''}`.trim(),
      label: isLocalQueued ? 'В очереди' : isBusy ? 'Видео делается' : 'Сделать видео',
      hint: isLocalQueued
        ? `ждёт очередь${scene?.video_queue_position ? ` · #${scene.video_queue_position}` : ''}`
        : isBusy
          ? 'job выполняется…'
          : videoStatus === 'blocked_missing_comfy_base_url'
            ? 'нужен COMFY_BASE_URL'
            : videoStatus === 'error'
              ? (scene?.video_error || 'ошибка')
              : hasInputProblems
                ? `нужно: ${problems.join(', ')}`
                : hasVideo
                  ? 'готово · можно заново'
                  : (scene?.workflow_key || 'workflow будет выбран автоматически'),
      disabled: isBusy || isLocalQueued,
    }
  }

  function isBoardVideoActiveWorkerStatus(scene) {
    const status = String(scene?.video_status || '').toLowerCase()
    return ['starting', 'preparing', 'submitting', 'running', 'queued_no_prompt_id'].includes(status) || (status === 'queued' && Boolean(scene?.video_job_id || scene?.video_status_endpoint))
  }

  function activeBoardVideoScene(currentBoard) {
    return asArray(currentBoard?.scenes).find((scene) => {
      const status = String(scene?.video_status || '').toLowerCase()
      const hasVideoResult = Boolean(scene?.video_api_path || scene?.videoApiPath || scene?.video_url || scene?.videoUrl || scene?.video_name || scene?.videoName)
      const hasServerJob = Boolean(scene?.video_job_id || scene?.video_status_endpoint)

      // AVA_BOARD_CLEAR_OLD_VIDEO_DURING_RUNNING_V52:
      // A real active job/status must win over stale ready video refs from a previous generation.
      if (['starting', 'preparing', 'submitting', 'running', 'queued_no_prompt_id'].includes(status)) return true
      if (status === 'queued' && hasServerJob) return true
      if (hasVideoResult) return false
      return false
    }) || null
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

  function boardMergeWaitingSceneIdsV57B(boardData = {}, runtimeIds = []) {
    const validIds = new Set(boardQueuedWaitingSceneIdsV57B(boardData))
    const ordered = []
    for (const id of runtimeIds || []) {
      const safeId = asText(id)
      if (safeId && validIds.has(safeId) && !ordered.includes(safeId)) ordered.push(safeId)
    }
    for (const id of validIds) {
      if (!ordered.includes(id)) ordered.push(id)
    }
    return ordered
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

  function processNextQueuedBoardVideo() {
    const currentBoard = boardRef.current
    // AVA_BOARD_QUEUE_RESTORE_NO_UPDATE_PATCH_V57B:
    // Runtime queue is lost after F5; rebuild it from persisted queued scenes.
    if (!localVideoQueueRef.current.length) {
      localVideoQueueRef.current = boardQueuedWaitingSceneIdsV57B(currentBoard)
    }
    if (activeBoardVideoScene(currentBoard)) return

    while (localVideoQueueRef.current.length) {
      const nextId = localVideoQueueRef.current.shift()
      const scene = asSceneArray(boardRef.current?.scenes || currentBoard?.scenes).find((item) => item.id === nextId)
      if (!scene) continue

      const inputProblems = sceneVideoInputProblems(scene)
      if (inputProblems.length) {
        showSceneVideoInputError(scene, inputProblems)
        continue
      }

      syncQueuedSceneBadges()
      setBoard((current) => ({ ...current, selectedSceneId: nextId }))
      setStatus(`Запускаем из очереди: ${nextId}`)
      window.setTimeout(() => {
        markVideoPlanned(scene)
      }, 120)
      return
    }
  }

  function requestSceneVideoQueue() {
    if (!selectedScene) return

    const selectedStatus = String(selectedScene.video_status || '').toLowerCase()
    const selectedHasServerJob = Boolean(selectedScene.video_job_id || selectedScene.video_status_endpoint)
    const selectedIsLocalQueued = (selectedStatus === 'queued' && !selectedHasServerJob) || localVideoQueueRef.current.includes(selectedScene.id)
    const selectedIsBusy = ['starting', 'preparing', 'submitting', 'running', 'queued_no_prompt_id'].includes(selectedStatus) || (selectedStatus === 'queued' && selectedHasServerJob)

    if (selectedIsBusy || selectedIsLocalQueued) {
      setStatus(selectedIsLocalQueued ? `Сцена ${selectedScene.id} уже в очереди` : `Сцена ${selectedScene.id} уже генерируется`)
      return
    }

    localVideoQueueRef.current = localVideoQueueRef.current.filter((sceneId) => sceneId !== selectedScene.id)

    const inputProblems = sceneVideoInputProblems(selectedScene)
    if (inputProblems.length) {
      showSceneVideoInputError(selectedScene, inputProblems)
      return
    }

    const currentBoard = boardRef.current
    const activeScene = activeBoardVideoScene(currentBoard)
    const sceneId = selectedScene.id

    if (activeScene && activeScene.id !== sceneId) {
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

    markVideoPlanned(selectedScene)
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
    if (!workspaceMode && !statusProjectId) return 'projectId null'
    if (!workspaceMode && statusProjectId !== asText(projectId)) return 'project mismatch'
    if (statusSceneId && expectedSceneId && statusSceneId !== expectedSceneId) return 'scene mismatch'
    return ''
  }

  function pollBoardVideoJob(sceneId, statusEndpoint, jobId) {
    const endpoint = statusEndpoint || (jobId ? `/clip/video/status/${jobId}` : '')
    if (!sceneId || !endpoint) return
    const currentScene = asSceneArray(boardRef.current?.scenes).find((scene) => asText(scene?.id || scene?.scene_id) === asText(sceneId))
    if (currentScene && String(currentScene.video_status || '').toLowerCase() === 'ready') return
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
    }

    let attempt = 0
    const maxAttempts = 240

    const tick = async () => {
      attempt += 1
      try {
        const data = await apiRequest(normalizedEndpoint)
        const status = data?.status || data?.video_status || 'running'
        const videoUrl = boardVideoUrlFromStatus(data)

        if (isBoardVideoStaleJobStatus(status, data)) {
          finishPoll()
          updateSceneForVideoJob(sceneId, jobId, resetStaleVideoJobPatch(data))
          setStatus(`Старый video job не найден: ${sceneId}. Статус сброшен.`)
          pushBoardToast({
            type: 'info',
            title: 'Статус видео сброшен',
            message: `Сцена ${sceneId}: старый job не найден на backend`,
            sceneId,
            dedupeKey: `video:${jobId || sceneId}:not_found_reset`,
          })
          window.setTimeout(processNextQueuedBoardVideo, 80)
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
          window.setTimeout(processNextQueuedBoardVideo, 80)
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
            window.setTimeout(processNextQueuedBoardVideo, 80)
            return
          }
          console.log('[BOARD JOB COMPLETED APPLY]', {
            jobId: data?.jobId || data?.job_id || jobId || '',
            projectId: responseProjectId,
            sceneId: responseSceneId,
            resultUrl: videoUrl,
          })
          const readyPatch = await boardVideoPatchFromStatusWithAsset(data, endpoint, jobId, sceneId)
          readyPatch.video_status = 'ready'
          readyPatch.video_job_id = ''
          readyPatch.video_status_endpoint = ''
          readyPatch.video_queue_position = 0
          updateSceneAndSave(sceneId, readyPatch)
          markBoardJobSeen(data?.jobId || data?.job_id || jobId || '')
          setStatus(`Видео готово: ${sceneId}`)
          pushBoardToast({ type: 'success', title: 'Видео готово', message: `Сцена ${sceneId}`, sceneId })
          window.setTimeout(processNextQueuedBoardVideo, 80)
          return
        }

        if (isBoardVideoDoneStatus(status)) {
          finishPoll()
          updateScene(sceneId, {
            video_status: 'error',
            video_error: 'completed_without_video_url',
            video_job_id: data?.jobId || data?.job_id || jobId || '',
            video_status_endpoint: endpoint,
            video_result: data || null,
          })
          setStatus('Comfy завершил job, но backend не вернул video_url')
          pushBoardToast({ type: 'error', title: 'Видео без результата', message: `Сцена ${sceneId}: backend не вернул video_url`, sceneId })
          window.setTimeout(processNextQueuedBoardVideo, 80)
          return
        }

        if (isBoardVideoErrorStatus(status)) {
          finishPoll()
          updateScene(sceneId, {
            video_status: 'error',
            video_error: data?.error || data?.detail || status,
            video_job_id: data?.jobId || data?.job_id || jobId || '',
            video_status_endpoint: endpoint,
            video_queue_position: 0,
          })
          setStatus(`Видео не собрано: ${data?.error || data?.detail || status}`)
          pushBoardToast({ type: 'error', title: 'Видео не собрано', message: `Сцена ${sceneId}: ${data?.error || data?.detail || status}`, sceneId })
          window.setTimeout(processNextQueuedBoardVideo, 80)
          return
        }

        const normalizedRunningStatus = ['queued', 'preparing', 'submitting', 'running', 'starting'].includes(String(status || '').toLowerCase())
          ? String(status || '').toLowerCase()
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
          window.setTimeout(processNextQueuedBoardVideo, 80)
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
          window.setTimeout(processNextQueuedBoardVideo, 80)
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
  const [playback, setPlayback] = useState(null)
  const [collapsedPanels, setCollapsedPanels] = useState({ translation: false })
  const [audioSrc, setAudioSrc] = useState('')
  const [selectedVideoBlobUrl, setSelectedVideoBlobUrl] = useState('')
  const [selectedVideoLoadError, setSelectedVideoLoadError] = useState('')
  const [runtimeSceneMediaUrls, setRuntimeSceneMediaUrls] = useState({})
  const [mmaudioOpen, setMmaudioOpen] = useState(false)
  const audioRef = useRef(null)
  const importRef = useRef(null)
  const boardRef = useRef(board)
  const localVideoQueueRef = useRef([])
  const activeVideoPollsRef = useRef(new Set())
  const staticAssetRepairRef = useRef(new Set())
  const seenCompletedJobIdsRef = useRef(readBoardSeenCompletedJobIds())

  const selectedScene = useMemo(() => {
    const scenes = asSceneArray(board.scenes)
    return scenes.find((scene) => scene.id === board.selectedSceneId) || scenes[0] || null
  }, [board.scenes, board.selectedSceneId])

  const selectedSceneDurationLock = useMemo(() => boardSceneTimingLockInfo(selectedScene), [selectedScene])
  const selectedSceneTimingLocked = Boolean(selectedSceneDurationLock.locked)
  const selectedSceneLockedDurationLabel = formatBoardDurationShort(selectedSceneDurationLock.duration)

  const selectedIndex = useMemo(() => {
    if (!selectedScene) return -1
    return asSceneArray(board.scenes).findIndex((scene) => scene.id === selectedScene.id)
  }, [board.scenes, selectedScene])

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
    const queuedIds = new Set(localVideoQueueRef.current)
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
          setStatus('Переносим свежий Тайминг в Доску…')
          setLoading(false)
          return
        }

        const serverBoardData = workspaceMode ? await loadWorkspaceStage(STAGE) : await loadStage(projectId, STAGE)
        const rawBoardData = chooseBoardDataForLoad(serverBoardData, localBoardData)
        const boardData = openedFromTiming || !workspaceMode ? rawBoardData : boardDataForStandaloneEntry(rawBoardData)

        // AVA_TIMING_TO_BOARD_NO_AUTO_MERGE_V14B:
        // Navigation from Timing only opens a confirm dialog. The old Board is not merged.
        const timingData = {}

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
        nextBoard = normalizeLoadedBoardVideoStatuses(hydratedCompleted.board)
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
        setBoard(nextBoard)
        setStatus(openedFromTiming
          ? 'Открыта старая Доска. Подтверди перенос из Тайминга, чтобы заменить сцены и аудио.'
          : (nextBoard.scenes.length ? 'Storyboard загружен' : 'Сцен пока нет — импортируй JSON или вернись в Тайминг')) // AVA_TIMING_TO_BOARD_CONFIRM_STATUS_V14B
      } catch (err) {
        if (!active) return
        setStatus(`Ошибка загрузки Storyboard: ${err.message}`)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [projectId, workspaceMode])

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
        if (!cancelled) setStatus(`Аудио preview недоступен: ${err.message}`)
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
    let objectUrl = ''
    setSelectedVideoBlobUrl('')
    setSelectedVideoLoadError('')
    if (!selectedPreviewAssetApiPath) return undefined

    async function loadVideoBlob() {
      try {
        objectUrl = await fetchProtectedBlobUrl(selectedPreviewAssetApiPath)
        if (!cancelled) setSelectedVideoBlobUrl(objectUrl)
      } catch (error) {
        if (!cancelled) {
          setStatus(`Видео preview недоступен: ${error?.message || 'asset_fetch_failed'}`)
        }
      }
    }
    loadVideoBlob()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [selectedPreviewAssetApiPath])

  useEffect(() => {
    let cancelled = false
    const objectUrls = []
    const sceneId = selectedScene?.id || selectedScene?.scene_id || ''
    if (!sceneId) return undefined

    async function loadSelectedImageBlobs() {
      const entries = [
        { slot: 'image', apiPath: sceneMediaFieldValue(selectedScene, 'image', 'apiPath') },
        { slot: 'first', apiPath: sceneMediaFieldValue(selectedScene, 'first', 'apiPath') },
        { slot: 'last', apiPath: sceneMediaFieldValue(selectedScene, 'last', 'apiPath') },
      ].filter((entry) => entry.apiPath)

      if (!entries.length) return
      const next = {}
      for (const entry of entries) {
        try {
          console.log('[BOARD IMAGE ASSET RESTORE]', { sceneId, slot: entry.slot, apiPath: entry.apiPath, sourceField: 'apiPath' })
          const objectUrl = await fetchProtectedBlobUrl(entry.apiPath)
          objectUrls.push(objectUrl)
          next[entry.slot] = objectUrl
        } catch (error) {
          console.warn('[BOARD MEDIA RESTORE DONE]', { sceneId, slot: entry.slot, apiPath: entry.apiPath, sourceField: 'apiPath', success: false, error: error?.message || error })
        }
      }
      if (!cancelled) {
        setRuntimeSceneMediaUrls((current) => ({
          ...current,
          [sceneId]: {
            ...(current[sceneId] || {}),
            ...next,
          },
        }))
        console.log('[BOARD MEDIA RESTORE DONE]', { sceneId, slots: Object.keys(next), success: true })
      }
    }

    loadSelectedImageBlobs()
    return () => {
      cancelled = true
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [selectedScene?.id, selectedScene?.image_api_path, selectedScene?.first_image_api_path, selectedScene?.last_image_api_path])

  useEffect(() => {
    if (loading) return undefined

    // AVA09C_FAST_LOCAL_BOARD_BACKUP_EFFECT:
    // local backup must be immediate; backend save can still be delayed.
    writeBoardDurableBackup(boardDurableKey({ projectId, workspaceMode }), {
      ...board,
      boardVersion: BOARD_VERSION,
      updatedAt: board?.updatedAt || new Date().toISOString(),
    })

    const timer = window.setTimeout(() => saveBoard(board, true), 900)
    return () => window.clearTimeout(timer)
  }, [loading, board, projectId, workspaceMode])


  // AVA_BOARD_QUEUE_RESTORE_NO_UPDATE_PATCH_V57B:
  // Restore waiting queue after F5/re-enter. If active job is gone/finished and waiting scenes remain,
  // start exactly one queued scene.
  useEffect(() => {
    const waitingIds = boardMergeWaitingSceneIdsV57B(board, board?.video_queue?.waitingSceneIds || [])
    if (waitingIds.length) {
      localVideoQueueRef.current = waitingIds
    }
    if (!waitingIds.length || activeBoardVideoScene(board)) return undefined

    const timer = window.setTimeout(() => {
      const liveBoard = boardRef.current
      if (activeBoardVideoScene(liveBoard)) return
      localVideoQueueRef.current = boardMergeWaitingSceneIdsV57B(liveBoard, localVideoQueueRef.current)
      processNextQueuedBoardVideo()
    }, 350)

    return () => window.clearTimeout(timer)
  }, [board])

  useEffect(() => {
    if (loading) return undefined
    board.scenes.forEach((scene) => {
      const status = String(scene.video_status || '').toLowerCase()
      if (!['queued', 'preparing', 'submitting', 'running', 'starting', 'queued_no_prompt_id'].includes(status)) return
      const endpoint = scene.video_status_endpoint || (scene.video_job_id ? `/api/clip/video/status/${scene.video_job_id}` : '')
      if (!endpoint) return
      pollBoardVideoJob(scene.id, endpoint, scene.video_job_id)
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
      return hasJob && activeStatuses.has(status)
    })
  }

  async function saveBoard(nextBoard = board, quiet = false) {
    const canonicalBoardBaseV57B = sanitizeBoardActiveVideoJobsForSaveV55(canonicalizeBoardMediaRefs(nextBoard))
    const canonicalBoard = boardWithVideoQueueSnapshotV57B(canonicalBoardBaseV57B, { reason: 'saveBoard_v57B' })
    const useReplaceForActiveVideoJobsV56 = boardHasActiveVideoJobsForReplaceSaveV56(canonicalBoard)
    const payload = {
      ...sanitizeBoardDurableBackup(canonicalBoard),
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
      const saveResult = workspaceMode
        ? await saveWorkspaceStage(STAGE, payload)
        : await saveStage(projectId, STAGE, payload, useReplaceForActiveVideoJobsV56 ? 'replace' : 'safe_merge')
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
        const currentJobId = scene.video_job_id || ''
        if (jobId && currentJobId && currentJobId !== jobId) {
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
    setStatus('Переносим свежий Тайминг в Доску…')
    try {
      const timingData = workspaceMode ? await loadWorkspaceStage('manual_timing') : await loadStage(projectId, 'manual_timing')
      const nextBoard = buildCleanBoardFromTimingV14B(timingData)
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
      clearWorkflowEntry('board')
      setShowTimingToBoardConfirm(false)
      setStatus(`Доска заменена свежим Таймингом: ${asSceneArray(nextBoard.scenes).length} сцен`)
    } catch (err) {
      setStatus(`Не удалось перенести Тайминг в Доску: ${err?.message || err}`)
    } finally {
      setTimingToBoardImporting(false)
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

  function selectScene(sceneId) {
    setBoard((current) => {
      const scene = asSceneArray(current.scenes).find((item) => asText(item.id || item.scene_id) === asText(sceneId))
      if (scene) {
        const sceneDuration = durationOf(scene)
        if (sceneDuration > 0) setManualSceneDurationSec(sceneDuration)
      }
      return { ...current, selectedSceneId: sceneId }
    })
  }

  function createManualScene() {
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

      const nextScenes = scenes.map((scene) => {
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
          updatedAt: new Date().toISOString(),
        }
      })

      const nextBoard = {
        ...current,
        scenes: nextScenes,
        updatedAt: new Date().toISOString(),
      }

      boardToPersist = nextBoard
      if (typeof writeBoardDurableBackup === 'function') {
        writeBoardDurableBackup(boardDurableKey({ projectId, workspaceMode }), nextBoard)
      }
      return nextBoard
    })

    window.setTimeout(() => {
      if (blockedByTimingLock) {
        setStatus('Длительность зафиксирована из Тайминга. Рычаг отключён для этой сцены.')
        return
      }
      if (boardToPersist) saveBoard(boardToPersist, true)
    }, 0)
  }


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


  async function setSceneFile(scene, fieldUrl, fieldName, statusField, event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const dataUrl = await readFileAsDataUrl(file)
      const uploaded = await uploadMediaAsset({
        file,
        projectId: workspaceMode ? null : projectId,
        kind: 'image',
        stage: 'board_images',
      })
      const assetId = uploaded.asset_id || uploaded.assetId || ''
      const assetApiPath = uploaded.asset_api_path || uploaded.assetApiPath || ''
      if (!assetId || !assetApiPath) throw new Error('image_asset_upload_missing_asset_id')
      const mediaSlot = mediaSlotByUrlField(fieldUrl)
      const dataField = sceneDataFieldByUrlField(fieldUrl)
      const patch = {
        ...staleVideoPatch('source_image_changed'),
        [fieldUrl]: assetApiPath,
        [fieldName]: file.name,
        [statusField]: 'asset_ready',
      }
      if (dataField) patch[dataField] = ''
      if (mediaSlot === 'first') {
        patch.first_image_asset_id = assetId
        patch.firstImageAssetId = assetId
        patch.first_image_api_path = assetApiPath
        patch.firstImageApiPath = assetApiPath
        patch.first_frame_api_path = assetApiPath
        patch.firstFrameApiPath = assetApiPath
      } else if (mediaSlot === 'last') {
        patch.last_image_asset_id = assetId
        patch.lastImageAssetId = assetId
        patch.last_image_api_path = assetApiPath
        patch.lastImageApiPath = assetApiPath
        patch.last_frame_api_path = assetApiPath
        patch.lastFrameApiPath = assetApiPath
      } else {
        patch.image_asset_id = assetId
        patch.imageAssetId = assetId
        patch.image_api_path = assetApiPath
        patch.imageApiPath = assetApiPath
      }

      // AVA_STAGE515_CLEAR_STALE_VIDEO_ON_IMAGE_CHANGE
      // Keep image_url and first_frame_url synchronized for ia2v.
      // Otherwise a stale start_image_data_url can override the newly uploaded image.
      if (fieldUrl === 'image_url') {
        patch.first_frame_url = assetApiPath
        patch.first_frame_name = file.name
        patch.start_image_url = assetApiPath
        patch.startImageUrl = assetApiPath
        patch.start_image_data_url = ''
        patch.startImageDataUrl = ''
        patch.first_image_asset_id = assetId
        patch.firstImageAssetId = assetId
        patch.first_image_api_path = assetApiPath
        patch.firstImageApiPath = assetApiPath
      }
      if (fieldUrl === 'first_frame_url') {
        patch.image_url = assetApiPath
        patch.image_name = file.name
        patch.image_data_url = ''
        patch.imageDataUrl = ''
        patch.image_asset_id = assetId
        patch.imageAssetId = assetId
        patch.image_api_path = assetApiPath
        patch.imageApiPath = assetApiPath
      }

      Object.assign(patch, {
        video_url: '',
        video_api_path: '',
        video_name: '',
        original_video_url: '',
        video_result: null,
        video_ready_at: '',
        video_job_id: '',
        video_status_endpoint: '',
        video_error: '',
        video_status: '',
        video_source_image_debug: {
          reason: `image_changed_${fieldUrl}`,
          fileName: file.name,
          at: new Date().toISOString(),
        },
      })

      updateSceneAndSave(scene.id, patch)
      setRuntimeSceneMediaUrls((current) => ({
        ...current,
        [scene.id]: {
          ...(current[scene.id] || {}),
          [mediaSlot]: dataUrl,
          ...(fieldUrl === 'image_url' ? { first: dataUrl } : {}),
          ...(fieldUrl === 'first_frame_url' ? { image: dataUrl } : {}),
        },
      }))
      console.log('[BOARD IMAGE ASSET RESTORE]', { sceneId: scene.id, slot: mediaSlot, assetId, apiPath: assetApiPath, sourceField: fieldUrl, success: true })
      setStatus(`Фото сцены сохранено: ${file.name}; старое видео очищено`)
    } catch (error) {
      console.error('[Board] setSceneFile failed', error)
      setStatus(`Не удалось прочитать изображение: ${error?.message || 'unknown error'}`)
    }
  }

  function clearSceneFile(scene, fields) {
    const patch = staleVideoPatch('source_image_removed')
    fields.forEach((field) => {
      patch[field] = ''
      const dataField = sceneDataFieldByUrlField(field)
      if (dataField) patch[dataField] = ''
      const slot = mediaSlotByUrlField(field)
      if (slot === 'first') {
        patch.first_image_asset_id = ''
        patch.firstImageAssetId = ''
        patch.first_image_api_path = ''
        patch.firstImageApiPath = ''
        patch.first_frame_api_path = ''
        patch.firstFrameApiPath = ''
      } else if (slot === 'last') {
        patch.last_image_asset_id = ''
        patch.lastImageAssetId = ''
        patch.last_image_api_path = ''
        patch.lastImageApiPath = ''
        patch.last_frame_api_path = ''
        patch.lastFrameApiPath = ''
      } else {
        patch.image_asset_id = ''
        patch.imageAssetId = ''
        patch.image_api_path = ''
        patch.imageApiPath = ''
      }
    })
    // AVA_STAGE515_CLEAR_STALE_VIDEO_ON_IMAGE_CLEAR
    if (fields.includes('image_url') || fields.includes('first_frame_url') || fields.includes('last_frame_url')) {
      Object.assign(patch, {
        video_url: '',
        video_api_path: '',
        video_name: '',
        original_video_url: '',
        video_result: null,
        video_ready_at: '',
        video_job_id: '',
        video_status_endpoint: '',
        video_error: '',
        video_status: '',
      })
    }
    updateScene(scene.id, patch)
  }

function boardAudioSourcePayloadForBackend() {
    return {
      audio_url: board.audio?.url || board.audio?.src || board.audioUrl || board.audio_url || '',
      audio_asset_id: board.audio?.assetId || board.audio?.asset_id || board.audioAssetId || board.audio_asset_id || '',
      audio_asset_api_path: board.audio?.assetApiPath || board.audio?.asset_api_path || board.audioApiPath || board.audio_api_path || '',
    }
  }

  function isIa2vRoute(route) {
    return ['ia2v', 'ia2v_lipsync', 'lip_sync'].includes(String(route || ''))
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
    // AVA_BOARD_PERSIST_MARK_VIDEO_PLANNED_V51: persist start/job/error scene patches so F5 can restore active regeneration.

    const sceneToStart = sceneOverride || selectedScene
    if (!sceneToStart) return
    const requestSceneId = asText(sceneToStart.id || sceneToStart.scene_id)
    if (!workspaceMode && !projectId) {
      const message = 'Нет projectId, видео не будет сохранено в проект'
      setStatus(message)
      pushBoardToast({ type: 'error', title: 'Видео не отправлено', message, sceneId: requestSceneId })
      window.setTimeout(processNextQueuedBoardVideo, 80)
      return
    }
    if (!requestSceneId || (!workspaceMode && isGeneratorSceneId(requestSceneId))) {
      const message = 'Некорректный sceneId, видео не будет сохранено в проект'
      setStatus(message)
      pushBoardToast({ type: 'error', title: 'Видео не отправлено', message, sceneId: requestSceneId })
      window.setTimeout(processNextQueuedBoardVideo, 80)
      return
    }
    const inputProblems = sceneVideoInputProblems(sceneToStart)
    if (inputProblems.length) {
      showSceneVideoInputError(sceneToStart, inputProblems)
      window.setTimeout(processNextQueuedBoardVideo, 80)
      return
    }

    localVideoQueueRef.current = localVideoQueueRef.current.filter((sceneId) => sceneId !== requestSceneId)
    window.setTimeout(() => syncQueuedSceneBadges(), 0)

    const route = String(sceneToStart.route || 'i2v')
    const isFirstLast = isFirstLastRoute(route)
    const isLipSync = ['ia2v', 'ia2v_lipsync', 'lip_sync'].includes(route)

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

    const audioSliceUrl = sceneToStart.audio_slice_url || sceneToStart.audioSliceUrl || ''

    const warnings = []
    if (!imageUrl) warnings.push('missing_start_image')
    if (isFirstLast && !endImageUrl) warnings.push('missing_last_frame')
    if (isLipSync && !audioSliceUrl) warnings.push('missing_audio_slice')

    // AVA_LAST_FRAME_V4_BOARD_NO_POST_WITHOUT_MEDIA
    if (warnings.length) {
      const labels = warnings.map((item) => item === 'missing_start_image' ? 'нет фото/start image' : item === 'missing_last_frame' ? 'нет последнего кадра' : item === 'missing_audio_slice' ? 'нет audio slice для lip-sync' : item)
      showSceneVideoInputError(sceneToStart, labels)
      window.setTimeout(processNextQueuedBoardVideo, 80)
      return
    }

    updateSceneAndSave(requestSceneId, {
      ...boardVideoRegenerateResetPatch('video_restarting'),
      video_status: 'starting',
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
      const status = data.status || 'queued'

      updateSceneAndSave(requestSceneId, {
        // AVA_BOARD_CLEAR_OLD_VIDEO_DURING_RUNNING_V52: keep new job, but remove old ready video refs during regeneration.
        ...boardVideoRegenerateResetPatch('video_start_job_saved'),
        video_status: status,
        video_job_id: jobId,
        video_status_endpoint: data.statusEndpoint || (jobId ? `/api/clip/video/status/${jobId}` : ''),
        workflow_key: data.workflowKey || boardWorkflowKeyForRoute(route, sceneToStart.workflow_key),
        workflow_exists: data.workflowExists,
        target_duration_sec: data.targetDurationSec,
        generation_duration_sec: data.generationDurationSec,
        trim_to_duration_sec: data.trimToDurationSec,
        plus_one_second_applied: Boolean(data.plusOneSecondApplied),
        video_start_warnings: warnings,
        video_error: '',
      })

      const videoStatusEndpoint = data.statusEndpoint || (jobId ? `/api/clip/video/status/${jobId}` : '')
      setStatus(`Video job: ${status} · ${jobId || 'no job id'}`)
      registerAvaGlobalJob({ kind: 'video', sceneId: requestSceneId, jobId, statusEndpoint: videoStatusEndpoint })
      pollBoardVideoJob(requestSceneId, videoStatusEndpoint, jobId)
    } catch (error) {
      console.error('[Board] /clip/video/start failed', error)
      updateSceneAndSave(requestSceneId, {
        video_status: 'error',
        video_error: error?.message || 'video_start_failed',
      })
      setStatus(error?.message || 'Не удалось отправить видео')
      pushBoardToast({ type: 'error', title: 'Видео не отправлено', message: `Сцена ${requestSceneId}: ${error?.message || 'video_start_failed'}`, sceneId: requestSceneId })
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
          // AVA_BOARD_CLEAR_OLD_VIDEO_DURING_RUNNING_V52: running poll must not preserve stale ready video refs.
          ...boardVideoRegenerateResetPatch('video_poll_running'),
            mmaudio_status: 'ready',
            mmaudio_video_url: videoUrl,
            mmaudioVideoUrl: videoUrl,
            mmaudio_video_name: data?.mmaudioVideoName || data?.mmaudio_video_name || data?.videoName || data?.video_name || 'mmaudio.mp4',
            mmaudio_job_id: data?.jobId || data?.job_id || jobId || '',
            mmaudio_status_endpoint: endpoint,
            mmaudio_error: '',
            mmaudio_result: data,
            mmaudio_ready_at: new Date().toISOString(),
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
      const nextBoard = buildBoardFromTiming(json, board)
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

  function exportBoardJson(event) {
    stopBoardActionEvent(event)
    const payload = { ...sanitizeBoardDurableBackup(board), exportedAt: new Date().toISOString() }
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
  const selectedRuntimeMedia = runtimeSceneMediaUrls[selectedScene?.id || selectedScene?.scene_id || ''] || {}
  const selectedImagePreviewUrl = selectedScene ? (selectedRuntimeMedia.image || normalizeBoardMediaUrl(sceneMediaFieldValue(selectedScene, 'image', 'url'))) : ''
  const selectedFirstImagePreviewUrl = selectedScene ? (selectedRuntimeMedia.first || normalizeBoardMediaUrl(sceneMediaFieldValue(selectedScene, 'first', 'url'))) : ''
  const selectedLastImagePreviewUrl = selectedScene ? (selectedRuntimeMedia.last || normalizeBoardMediaUrl(sceneMediaFieldValue(selectedScene, 'last', 'url'))) : ''
  const boardScenes = asSceneArray(board.scenes)
  const readiness = {
    total: boardScenes.length,
    prompts: boardScenes.filter((scene) => asText(scene.video_prompt)).length,
    images: boardScenes.filter((scene) => sceneMediaFieldValue(scene, 'image', 'apiPath') || sceneMediaFieldValue(scene, 'first', 'apiPath') || sceneMediaFieldValue(scene, 'last', 'apiPath') || sceneMediaFieldValue(scene, 'image', 'url') || sceneMediaFieldValue(scene, 'first', 'url') || sceneMediaFieldValue(scene, 'last', 'url') || scene.image_name || scene.first_frame_name || scene.last_frame_name).length,
    videos: boardScenes.filter((scene) => sceneMediaFieldValue(scene, 'video', 'apiPath') || sceneMediaFieldValue(scene, 'video', 'url') || scene.video_name).length,
  }

  if (loading) {
    return (
      <div className="avaPage avaStoryboardLoadingPage isAvaStudioWaveLoading">
        <section className="avaLoadingHero avaStudioLoadingHero">
          <div className="avaLoadingCard avaStudioLoadingCard">
            <div className="avaLoadingOrb"><Film size={28} /></div>
            <p className="avaEyebrow"><Sparkles size={14} /> Ava Studio pipeline</p>
            <h2>Загрузка Storyboard...</h2>
            <p>Проверяем сцены, промты, видео, звук, блоки и готовим доску к работе.</p>
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
              <small>Синхронизируем тайминг, сцены и медиа</small>
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
              <h3>Перенести Доску в монтажник?</h3>
              <p>Текущая монтажка будет заменена данными из Доски: сцены, цвета блоков, тайминги, готовые видео, MMAudio и исходное audio из Timing.</p>
              <span>Если хочешь сохранить старую сборку из Генератора — нажми “Отмена”.</span>
              {assemblyConfirmError ? <b>{assemblyConfirmError}</b> : null}
            </div>
            <div className="avaBoardAssemblyConfirmActions">
              <button type="button" onClick={() => setAssemblyConfirmOpen(false)} disabled={assemblyConfirmBusy}>Отмена</button>
              <button type="button" className="isPrimary" onClick={confirmBoardToAssemblyHandoff} disabled={assemblyConfirmBusy || !asSceneArray(board.scenes).length}>
                {assemblyConfirmBusy ? 'Переносим…' : 'Да, перейти'}
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
      </section>      {/* AVA09G_HIDE_AVA08Z_BOARD_ADD_SCENE_TOP_BUTTON */}
      {!openedFromTiming ? (
      <section className="avaBoardManualSceneTopBar">
        <div className="avaBoardManualSceneInfo">
          <strong>Ручные сцены</strong>
          <span>Добавляй сцены без тайминга — они встанут в конец доски.</span>
        </div>

        <button type="button" className="avaBoardAddSceneButton" onClick={createManualScene}>
          + Сцена
        </button>
      </section>
      ) : null}

      <input ref={importRef} className="avaHiddenInput" type="file" accept="application/json,.json" onChange={importTimingJson} />

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
            <div className="avaBoardTimingConfirmActions">
              <button type="button" className="avaBoardTimingConfirmSecondary" onClick={cancelTimingToBoardImportV14B} disabled={timingToBoardImporting}>
                Оставить старую Доску
              </button>
              <button type="button" className="avaBoardTimingConfirmPrimary" onClick={confirmTimingToBoardImportV14B} disabled={timingToBoardImporting}>
                {timingToBoardImporting ? 'Переносим…' : 'Да, заменить Доску'}
              </button>
            </div>
          </div>
        </div>
      ) : null}{/* AVA_TIMING_TO_BOARD_CONFIRM_MODAL_V14B */}


      <section className="avaBoardSceneStrip" aria-label="Сцены">
        {boardScenes.map((scene, index) => {
          const statusInfo = sceneStatus(scene)
          const active = selectedScene?.id === scene.id
          return (
            <button
              key={scene.id}
              type="button"
              className={`avaBoardSceneCard ${active ? 'isActive' : ''} ${scene.blockId ? 'hasBlock' : ''}`}
              style={{ '--scene-hue': storyboardSceneColor(scene, index) }}
              onClick={() => selectScene(scene.id)}
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
        <section className="avaBoardWorkspace">
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
                    value={selectedScene.route || 'i2v'}
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
                  <small>{ROUTE_OPTIONS.find((route) => route.value === selectedScene.route)?.hint || 'Выбери режим генерации видео'}</small>
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
                  title="Первый кадр"
                  subtitle="start frame"
                  value={selectedFirstImagePreviewUrl || selectedImagePreviewUrl}
                  name={selectedScene.first_frame_name}
                  onSelect={(event) => setSceneFile(selectedScene, 'first_frame_url', 'first_frame_name', 'image_status', event)}
                  onClear={() => clearSceneFile(selectedScene, ['first_frame_url', 'first_frame_name'])}
                />
                <ImageSlot
                  title="Последний кадр"
                  subtitle="end frame"
                  value={selectedLastImagePreviewUrl}
                  name={selectedScene.last_frame_name}
                  onSelect={(event) => setSceneFile(selectedScene, 'last_frame_url', 'last_frame_name', 'image_status', event)}
                  onClear={() => clearSceneFile(selectedScene, ['last_frame_url', 'last_frame_name'])}
                />
              </div>
            ) : (
              <ImageSlot
                title="Фото / Start image"
                subtitle="основной кадр для i2v / ia2v"
                value={selectedImagePreviewUrl || selectedFirstImagePreviewUrl}
                name={selectedScene.image_name}
                onSelect={(event) => setSceneFile(selectedScene, 'image_url', 'image_name', 'image_status', event)}
                onClear={() => clearSceneFile(selectedScene, ['image_url', 'image_name'])}
              />
            )}

            <div className="avaBoardVideoPreview">
              <div className="avaBoardVideoHeader">
                <strong><Film size={16} /> Видео preview</strong>
                <span>{scenePreviewVideoLabel(selectedScene)}</span>
              </div>
              {selectedPreviewVideoUrl && !selectedVideoLoadError ? (
                <>
                  <video
                    key={selectedPreviewVideoUrl}
                    src={selectedPreviewVideoUrl}
                    controls
                    preload="metadata"
                    playsInline
                    onLoadedMetadata={(event) => {
                      const duration = event.currentTarget?.duration || 0
                      console.log('[BOARD VIDEO ELEMENT LOADED]', {
                        sceneId: selectedScene?.id || selectedScene?.scene_id || '',
                        src: selectedPreviewVideoUrl,
                        duration,
                      })
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
                  <div className="avaBoardVideoActions">
                    <button type="button" onClick={openSelectedSceneVideo}>Смотреть видео</button>
                    <button type="button" onClick={downloadSelectedSceneVideo}>Скачать видео</button>
                  </div>
                </>
              ) : selectedPreviewVideoLoading ? (
                <div className="avaBoardVideoEmpty isBusy avaBoardMediaSpinnerOverlayV15">
                  {/* AVA_BOARD_VIDEO_PREVIEW_LOADING_SPINNER_V15 */}
                  <span className="avaBoardTinyMediaSpinner isGold" aria-hidden="true" />
                  <span>Загружаем видео</span>
                  <small>Получаем protected asset preview.</small>
                </div>
              ) : selectedVideoLoadError ? (
                <div className="avaBoardVideoEmpty isError">
                  <Film size={34} />
                  <span>Видео preview недоступно</span>
                  <small>{selectedVideoLoadError}</small>
                </div>
              ) : (
                <div className={`avaBoardVideoEmpty ${isVideoBusyStatus(selectedScene.video_status) ? 'isBusy isGeneratingVideoV15' : ''}`}>
                  {/* AVA_BOARD_VIDEO_GENERATION_SPINNER_V15 */}
                  {isVideoBusyStatus(selectedScene.video_status) ? (
                    <span className="avaBoardTinyMediaSpinner isGold" aria-hidden="true" />
                  ) : (
                    <Film size={34} />
                  )}
                  <span>{isVideoBusyStatus(selectedScene.video_status) ? sceneStatus(selectedScene).label : 'Видео ещё не создано'}</span>
                  {isVideoBusyStatus(selectedScene.video_status) && (
                    <small>Генерация активна: ждём новый результат.</small>
                  )}
                </div>
              )}
            </div>            {/* AVA_BOARD_TIMING_DURATION_LOCK_V38: lock duration by scene data, not by entry route. */}
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
              <section className="avaBoardSceneDurationPanel">
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

                {isIa2vRoute(selectedScene.route) && (
                  <button
                    type="button"
                    className={`avaBoardWorkflowButton isAudio ${selectedScene.audio_slice_status === 'ready' ? 'isReady' : selectedScene.audio_slice_status === 'extracting' ? 'isBusy' : selectedScene.audio_slice_status === 'error' ? 'isError' : ''}`}
                  title={selectedScene.audio_slice_name || selectedScene.audio_slice_url || "audio slice"}
                    onClick={(event) => {
                      stopBoardActionEvent(event)
                      markAudioSlicePlanned()
                    }}
                  >
                    <Scissors size={16} />
                    <span>Изъять аудио</span>
                    <small>{selectedScene.audio_slice_status === 'ready' ? ((Number(selectedScene.audio_slice_duration || 0) > 0) ? `MP3 готов · ${Number(selectedScene.audio_slice_duration || 0).toFixed(2)}с` : 'MP3 готов') : selectedScene.audio_slice_status === 'extracting' ? 'режем через backend…' : selectedScene.audio_slice_status === 'error' ? 'ошибка slice' : 'POST slice-audio'}</small>
                  </button>
                )}

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
              ) : selectedScene.route === 'ia2v' ? (
                <><AlertTriangle size={16} /> Для lip-sync используем ручной отрезок сцены; ASR не управляет таймингом.</>
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



