// AVA_AUDIO_STUDIO_PREVIEW_NOTES_PRESERVE_NEWLINES_V211N: installed
// AVA_AUDIO_STUDIO_PREVIEW_NOTES_NATIVE_MULTILINE_V211M: installed
// AVA_AUDIO_STUDIO_PREVIEW_NOTES_REAL_MULTILINE_EDITOR_V211L: installed
// AVA_AUDIO_STUDIO_PREVIEW_NOTES_ENTER_NEWLINE_V211K: installed
// AVA_AUDIO_STUDIO_RESTORE_SCENESTRIP_V211J: installed
// AVA_AUDIO_STUDIO_NOTES_TEXTAREA_LAYOUT_V211I: installed
// AVA_AUDIO_STUDIO_GLOBAL_NOTES_PANEL_V211H: installed
// AVA_AUDIO_STUDIO_FULL_PREVIEW_MAP_BUILD_V211F: installed
// AVA_AUDIO_STUDIO_PREVIEW_FULL_PROJECT_MAP_V211E: installed
// AVA_AUDIO_STUDIO_PREVIEW_MAP_NOTES_V211D: installed
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  AudioLines,
  CheckCircle2,
  Download,
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
// V204G13_STAU_VOLUME_DRAFT_APPLY_PREVIEW
import './AudioStudioPage.css'
const DEFAULT_STABLE_AUDIO_VOLUME_PERCENT_V204G14 = 30
const DEFAULT_STAU_VOLUME_PERCENT_V204G15 = 30
const DEFAULT_MMAUDIO_VOLUME_PERCENT_V204G15 = 7
// V204G19_DEFINE_MISSING_VOLUME_CONSTANTS - shared audio defaults restored after backup merge
const DEFAULT_MMAUDIO_VOLUME_PERCENT_V204G14 = 7
const DEFAULT_STAU_VOLUME_PERCENT_V204G14 = 30


const STAGE = 'audio_studio'
const VERSION = 'V204D3'
const AVA_AUDIO_REFRESH_FROM_BOARD_MODAL_V204D3 = true
const DEFAULT_NEGATIVE = 'музыка, речь, голоса, гул, hiss, шум'
const DEFAULT_MMAUDIO_VOLUME_PERCENT_V204G18 = 7
const DEFAULT_STAU_VOLUME_PERCENT_V204G18 = 30


function isInterruptedPlayErrorV204E11(err) {
  const message = String(err?.message || err || '').toLowerCase()
  return err?.name === 'AbortError'
    || message.includes('interrupted by a call to pause')
    || message.includes('interrupted by a new load request')
}

function clampMediaVolumeV204E10A(value, fallback = 1) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.min(1, n))
}



// V204H10C_SAFE_UI_VOLUME_NO_SILENCE
// UI media volume must accept both units:
//   0.07 / 0.30  => fraction
//   7 / 30       => percent from sliders
// Never let an undefined/NaN value mute the player.
function normalizeAudioStudioUiVolume01V204H10C(value, fallback = 1) {
  const raw = Number(value)
  const fbRaw = Number(fallback)
  let safe = Number.isFinite(raw) ? raw : (Number.isFinite(fbRaw) ? fbRaw : 1)
  if (safe > 1.5) safe = safe / 100
  safe = Math.max(0, Math.min(1, safe))
  if (!Number.isFinite(safe)) safe = 1
  return safe
}

function setAudioStudioMediaVolumeV204H10(node, volume01, fallback = 1) {
  const safe = normalizeAudioStudioUiVolume01V204H10C(volume01, fallback)
  if (!node) return safe
  try {
    node.muted = false
    node.defaultMuted = false
    node.volume = safe
    node.dataset.avaUiVolumeV204H10 = String(Math.round(safe * 1000) / 10)
    // Deliberately noisy only when devtools console is open; helps verify slider effect.
    if (typeof console !== 'undefined' && console.debug) {
      console.debug('[AUDIO STUDIO UI VOLUME V204H10C]', {
        tag: node.tagName,
        title: node.title || '',
        volume01: safe,
        volumePercent: Math.round(safe * 1000) / 10,
        muted: node.muted,
        src: node.currentSrc || node.src || '',
      })
    }
  } catch (_err) {}
  return safe
}

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


// V211N_PREVIEW_NOTES_RAW_TEXT
// Notes must preserve trailing spaces/newlines. Do NOT use firstText() here,
// because firstText() goes through cleanId() and trims the text.
function previewNotesTextV211N(...values) {
  for (const value of values) {
    if (typeof value === 'string') return value
    if (value !== undefined && value !== null) return String(value)
  }
  return ''
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
    // Prefer the original video preserved by Audio Studio/MMAudio apply.
    // Do not accidentally use an already-applied MMAudio result as the next source video.
    scene.mmaudio_source_video_api_path,
    scene.mmaudioSourceVideoApiPath,
    scene.mmaudio_source_video_url,
    scene.mmaudioSourceVideoUrl,
    scene.original_video_api_path,
    scene.originalVideoApiPath,
    scene.original_video_url,
    scene.originalVideoUrl,
    scene.source_video_api_path,
    scene.sourceVideoApiPath,
    scene.source_video_url,
    scene.sourceVideoUrl,
    scene.input_video_api_path,
    scene.inputVideoApiPath,
    scene.input_video_url,
    scene.inputVideoUrl,
    scene.video_api_path,
    scene.videoApiPath,
    scene.video_url,
    scene.videoUrl,
    scene.output_video_api_path,
    scene.outputVideoApiPath,
    scene.result_video_api_path,
    scene.resultVideoApiPath,
  )
}

function boardSourceAudioRef(scene = {}) {
  return firstText(
    scene.audio_slice_api_path,
    scene.audioSliceApiPath,
    scene.audio_slice_url,
    scene.audioSliceUrl,
    scene.timing_audio_api_path,
    scene.timingAudioApiPath,
    scene.timing_audio_url,
    scene.timingAudioUrl,
    scene.source_audio_api_path,
    scene.sourceAudioApiPath,
    scene.source_audio_url,
    scene.sourceAudioUrl,
    scene.original_audio_api_path,
    scene.originalAudioApiPath,
    scene.original_audio_url,
    scene.originalAudioUrl,
    scene.audio_api_path,
    scene.audioApiPath,
    scene.audio_url,
    scene.audioUrl,
    scene.audio_asset_api_path,
    scene.audioAssetApiPath,
    scene.lip_sync_audio_api_path,
    scene.lipSyncAudioApiPath,
    scene.lip_sync_audio_url,
    scene.lipSyncAudioUrl,
    scene.voice_audio_api_path,
    scene.voiceAudioApiPath,
    scene.voice_audio_url,
    scene.voiceAudioUrl,
  )
}

function boardSourceAudioRefV204E5A(scene = {}) {
  if (typeof boardSourceAudioRefV204E4 === 'function') return boardSourceAudioRefV204E4(scene)
  if (typeof boardSourceAudioRefV204E3 === 'function') return boardSourceAudioRefV204E3(scene)
  return firstText(
    scene.audio_slice_api_path,
    scene.audioSliceApiPath,
    scene.audio_slice_url,
    scene.audioSliceUrl,
    scene.timing_audio_api_path,
    scene.timingAudioApiPath,
    scene.timing_audio_url,
    scene.timingAudioUrl,
    scene.source_audio_api_path,
    scene.sourceAudioApiPath,
    scene.source_audio_url,
    scene.sourceAudioUrl,
    scene.original_audio_api_path,
    scene.originalAudioApiPath,
    scene.original_audio_url,
    scene.originalAudioUrl,
    scene.audio_api_path,
    scene.audioApiPath,
    scene.audio_url,
    scene.audioUrl,
    scene.lip_sync_audio_api_path,
    scene.lipSyncAudioApiPath,
    scene.lip_sync_audio_url,
    scene.lipSyncAudioUrl,
    scene.voice_audio_api_path,
    scene.voiceAudioApiPath,
    scene.voice_audio_url,
    scene.voiceAudioUrl,
  )
}

function boardSourceAudioRefV204E7(scene = {}) {
  if (typeof boardSourceAudioRefV204E5A === 'function') return boardSourceAudioRefV204E5A(scene)
  if (typeof boardSourceAudioRefV204E4 === 'function') return boardSourceAudioRefV204E4(scene)
  if (typeof boardSourceAudioRef === 'function') return boardSourceAudioRef(scene)
  return firstText(
    scene.audio_slice_api_path,
    scene.audioSliceApiPath,
    scene.audio_slice_url,
    scene.audioSliceUrl,
    scene.timing_audio_api_path,
    scene.timingAudioApiPath,
    scene.timing_audio_url,
    scene.timingAudioUrl,
    scene.source_audio_api_path,
    scene.sourceAudioApiPath,
    scene.source_audio_url,
    scene.sourceAudioUrl,
    scene.original_audio_api_path,
    scene.originalAudioApiPath,
    scene.original_audio_url,
    scene.originalAudioUrl,
    scene.audio_api_path,
    scene.audioApiPath,
    scene.audio_url,
    scene.audioUrl,
    scene.lip_sync_audio_api_path,
    scene.lipSyncAudioApiPath,
    scene.lip_sync_audio_url,
    scene.lipSyncAudioUrl,
    scene.voice_audio_api_path,
    scene.voiceAudioApiPath,
    scene.voice_audio_url,
    scene.voiceAudioUrl,
  )
}

function audioStudioBoardAudioRefV204E8(scene = {}) {
  if (typeof boardSourceAudioRefV204E7 === 'function') return boardSourceAudioRefV204E7(scene)
  if (typeof boardSourceAudioRefV204E5A === 'function') return boardSourceAudioRefV204E5A(scene)
  if (typeof boardSourceAudioRef === 'function') return boardSourceAudioRef(scene)
  return firstText(
    scene.audio_slice_api_path,
    scene.audioSliceApiPath,
    scene.audio_slice_url,
    scene.audioSliceUrl,
    scene.timing_audio_api_path,
    scene.timingAudioApiPath,
    scene.timing_audio_url,
    scene.timingAudioUrl,
    scene.source_audio_api_path,
    scene.sourceAudioApiPath,
    scene.source_audio_url,
    scene.sourceAudioUrl,
    scene.original_audio_api_path,
    scene.originalAudioApiPath,
    scene.original_audio_url,
    scene.originalAudioUrl,
    scene.audio_api_path,
    scene.audioApiPath,
    scene.audio_url,
    scene.audioUrl,
    scene.lip_sync_audio_api_path,
    scene.lipSyncAudioApiPath,
    scene.lip_sync_audio_url,
    scene.lipSyncAudioUrl,
    scene.voice_audio_api_path,
    scene.voiceAudioApiPath,
    scene.voice_audio_url,
    scene.voiceAudioUrl,
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

function mediaRefObjectV204B7(refLike = {}, fallbackName = '') {
  const ref = normalizeRef(firstText(refLike.apiPath, refLike.api_path, refLike.url, refLike.videoUrl, refLike.video_url))
  return {
    url: ref.url || firstText(refLike.url, refLike.videoUrl, refLike.video_url, refLike.apiPath, refLike.api_path),
    apiPath: ref.apiPath || firstText(refLike.apiPath, refLike.api_path),
    assetId: ref.assetId || firstText(refLike.assetId, refLike.asset_id),
    name: firstText(refLike.name, refLike.videoName, refLike.video_name, refLike.label, fallbackName),
  }
}

function variantMediaRefV204B7(variant = {}) {
  return mediaRefObjectV204B7(variant, 'mmaudio_applied.mp4')
}

function sceneOriginalSourceVideoV204B7(scene = {}) {
  const originalObj = scene.originalSourceVideo || scene.mmaudioOriginalSourceVideo || scene.mmaudioSourceVideo || scene.sourceOriginalVideo || null
  const original = firstText(
    originalObj?.apiPath,
    originalObj?.url,
    scene.original_source_video_api_path,
    scene.originalSourceVideoApiPath,
    scene.original_source_video_url,
    scene.originalSourceVideoUrl,
    scene.mmaudio_source_video_api_path,
    scene.mmaudioSourceVideoApiPath,
    scene.mmaudio_source_video_url,
    scene.mmaudioSourceVideoUrl,
    scene.sourceVideo?.apiPath,
    scene.sourceVideo?.url,
  )
  return mediaRefObjectV204B7(originalObj || { apiPath: original, url: original }, 'original_scene_video')
}

function sourceVideoForMmaudioV204B7(scene = {}) {
  const original = sceneOriginalSourceVideoV204B7(scene)
  return firstText(original.apiPath, original.url, scene.sourceVideo?.apiPath, scene.sourceVideo?.url)
}


function variantRawMediaRefV204C3(variant = {}) {
  return mediaRefObjectV204B7({
    apiPath: firstText(
      variant.rawApiPath,
      variant.raw_api_path,
      variant.originalApiPath,
      variant.original_api_path,
      variant.sourceApiPath,
      variant.source_api_path,
      variant.apiPath,
      variant.api_path,
    ),
    url: firstText(
      variant.rawUrl,
      variant.raw_url,
      variant.originalUrl,
      variant.original_url,
      variant.sourceUrl,
      variant.source_url,
      variant.url,
      variant.videoUrl,
      variant.video_url,
    ),
    assetId: firstText(
      variant.rawAssetId,
      variant.raw_asset_id,
      variant.originalAssetId,
      variant.original_asset_id,
      variant.assetId,
      variant.asset_id,
    ),
    name: firstText(variant.name, variant.videoName, variant.video_name, 'mmaudio_raw.mp4'),
  }, 'mmaudio_raw.mp4')
}

function variantAppliedMediaRefV204C3(variant = {}) {
  const appliedVideo = variant.appliedVideo || variant.applied_video || null
  return mediaRefObjectV204B7({
    apiPath: firstText(
      appliedVideo?.apiPath,
      appliedVideo?.api_path,
      variant.appliedApiPath,
      variant.applied_api_path,
      variant.bakedApiPath,
      variant.baked_api_path,
      variant.volumeBakedApiPath,
      variant.volume_baked_api_path,
      variant.apiPath,
      variant.api_path,
    ),
    url: firstText(
      appliedVideo?.url,
      variant.appliedUrl,
      variant.applied_url,
      variant.bakedUrl,
      variant.baked_url,
      variant.volumeBakedUrl,
      variant.volume_baked_url,
      variant.url,
      variant.videoUrl,
      variant.video_url,
    ),
    assetId: firstText(
      appliedVideo?.assetId,
      appliedVideo?.asset_id,
      variant.appliedAssetId,
      variant.applied_asset_id,
      variant.bakedAssetId,
      variant.baked_asset_id,
      variant.assetId,
      variant.asset_id,
    ),
    name: firstText(appliedVideo?.name, variant.appliedName, variant.name, 'mmaudio_applied.mp4'),
  }, 'mmaudio_applied.mp4')
}



// V211Y2_MMAUDIO_F5_RESTORE_SAFE
// Restore an already-applied MMAudio video after F5. Some snapshots keep the
// selected/applied variant asset but lose sourceVideo/currentVideo, so the UI
// shows "no video" even though /api/assets/.../file still exists.
function sceneAppliedMmaudioVariantV211Y2(scene = {}) {
  const appliedId = cleanId(
    scene.appliedVariantId
    || scene.applied_variant_id
    || scene.audioStudioAppliedVariantId
    || scene.audio_studio_applied_variant_id
  )
  const variants = asArray(scene.variants)
  if (appliedId) {
    const exact = variants.find((variant) => cleanId(variant?.id || variant?.variantId || variant?.variant_id) === appliedId)
    if (exact) return exact
  }
  return variants.find((variant) => variant?.applied === true && isRealMmaudioVariantV204B6(variant)) || null
}

function sceneAppliedMmaudioMediaV211Y2(scene = {}) {
  const directVideo = scene.mmaudioAppliedVideo || scene.mmaudio_applied_video || scene.currentVideo || scene.current_video || null
  const direct = mediaRefObjectV204B7({
    apiPath: firstText(
      directVideo?.apiPath,
      directVideo?.api_path,
      scene.mmaudio_video_api_path,
      scene.mmaudioVideoApiPath,
      scene.applied_video_api_path,
      scene.appliedVideoApiPath,
      scene.video_api_path,
      scene.videoApiPath,
    ),
    url: firstText(
      directVideo?.url,
      scene.mmaudio_video_url,
      scene.mmaudioVideoUrl,
      scene.applied_video_url,
      scene.appliedVideoUrl,
      scene.video_url,
      scene.videoUrl,
    ),
    assetId: firstText(
      directVideo?.assetId,
      directVideo?.asset_id,
      scene.mmaudio_video_asset_id,
      scene.mmaudioVideoAssetId,
      scene.applied_video_asset_id,
      scene.appliedVideoAssetId,
      scene.video_asset_id,
      scene.videoAssetId,
    ),
    name: firstText(directVideo?.name, scene.mmaudio_video_name, scene.mmaudioVideoName, 'mmaudio_applied.mp4'),
  }, 'mmaudio_applied.mp4')
  if (direct.apiPath || direct.url || direct.assetId) return direct

  const variant = sceneAppliedMmaudioVariantV211Y2(scene)
  if (!variant) return { url: '', apiPath: '', assetId: '', name: 'mmaudio_applied.mp4' }
  return variantAppliedMediaRefV204C3(variant)
}

function rehydrateAppliedMmaudioSceneV211Y2(scene = {}) {
  const appliedId = cleanId(
    scene.appliedVariantId
    || scene.applied_variant_id
    || scene.audioStudioAppliedVariantId
    || scene.audio_studio_applied_variant_id
  )
  if (!appliedId) return scene
  const media = sceneAppliedMmaudioMediaV211Y2(scene)
  const mediaRef = firstText(media.apiPath, media.url)
  if (!mediaRef && !media.assetId) return scene
  const sourceVideo = mediaRef || media.apiPath || media.url
  return {
    ...scene,
    sourceVideo: media,
    currentVideo: media,
    mmaudioAppliedVideo: media,
    video_url: sourceVideo,
    videoUrl: sourceVideo,
    video_api_path: media.apiPath || '',
    videoApiPath: media.apiPath || '',
    video_asset_id: media.assetId || '',
    videoAssetId: media.assetId || '',
    mmaudio_video_url: sourceVideo,
    mmaudioVideoUrl: sourceVideo,
    mmaudio_video_api_path: media.apiPath || '',
    mmaudioVideoApiPath: media.apiPath || '',
    mmaudio_video_asset_id: media.assetId || '',
    mmaudioVideoAssetId: media.assetId || '',
    has_mmaudio: true,
    hasMmaudio: true,
    has_sound: true,
    hasSound: true,
    mmaudio_status: 'applied',
    mmaudioStatus: 'applied',
    audio_studio_status: 'mmaudio_applied',
    audioStudioStatus: 'mmaudio_applied',
    appliedVariantId: appliedId,
    selectedVariantId: cleanId(scene.selectedVariantId) || appliedId,
    status: 'applied',
    variants: asArray(scene.variants).map((variant) => {
      const id = cleanId(variant?.id || variant?.variantId || variant?.variant_id)
      if (id !== appliedId) return { ...variant, selected: false, applied: false }
      return {
        ...variant,
        selected: true,
        applied: true,
        appliedVideo: variant.appliedVideo || media,
        appliedApiPath: variant.appliedApiPath || media.apiPath || '',
        appliedUrl: variant.appliedUrl || sourceVideo || '',
        appliedAssetId: variant.appliedAssetId || media.assetId || '',
      }
    }),
  }
}

async function bakeMmaudioVariantVolumeV204C3({ variant = {}, scene = {}, volume = 100, projectId = '' } = {}) {
  const rawMedia = variantRawMediaRefV204C3(variant)
  const percent = Math.max(0, Math.min(150, Number(volume) || 0))
  if (!rawMedia.apiPath && !rawMedia.url && !rawMedia.assetId) {
    throw new Error('У выбранного MMAudio-варианта нет raw video asset для применения громкости.')
  }

  if (Math.abs(percent - 100) < 0.01) {
    return {
      ...rawMedia,
      volumeBaked: false,
      volumeBakedPercent: 100,
      rawUrl: rawMedia.url || '',
      rawApiPath: rawMedia.apiPath || '',
      rawAssetId: rawMedia.assetId || '',
    }
  }

  const data = await apiRequest('/clip/mmaudio/apply-volume', {
    method: 'POST',
    body: JSON.stringify({
      source: 'audio_studio_apply_volume_v204c3',
      project_id: projectId || '',
      projectId: projectId || '',
      scene_id: firstText(scene.id, scene.sceneId, scene.scene_id),
      sceneId: firstText(scene.id, scene.sceneId, scene.scene_id),
      volume_percent: percent,
      volumePercent: percent,
      video_api_path: rawMedia.apiPath || '',
      videoApiPath: rawMedia.apiPath || '',
      video_url: rawMedia.apiPath ? '' : (rawMedia.url || ''),
      videoUrl: rawMedia.apiPath ? '' : (rawMedia.url || ''),
      asset_id: rawMedia.assetId || '',
      assetId: rawMedia.assetId || '',
    }),
  })

  const ref = normalizeRef(firstText(
    data.video_api_path,
    data.videoApiPath,
    data.asset_api_path,
    data.assetApiPath,
    data.video_url,
    data.videoUrl,
    data.url,
  ))

  if (!ref.apiPath && !ref.url) {
    throw new Error('Backend не вернул volume-adjusted video asset.')
  }

  return {
    url: ref.url,
    apiPath: ref.apiPath,
    assetId: ref.assetId || firstText(data.asset_id, data.assetId),
    name: firstText(data.video_name, data.videoName, data.name, `mmaudio_volume_${percent}.mp4`),
    volumeBaked: true,
    volumeBakedPercent: percent,
    rawUrl: rawMedia.url || '',
    rawApiPath: rawMedia.apiPath || '',
    rawAssetId: rawMedia.assetId || '',
  }
}


function mediaCompareKey(refLike = {}) {
  const ref = normalizeRef(firstText(
    refLike.apiPath,
    refLike.api_path,
    refLike.assetApiPath,
    refLike.asset_api_path,
    refLike.url,
    refLike.videoUrl,
    refLike.video_url,
  ))
  return {
    assetId: cleanId(ref.assetId || refLike.assetId || refLike.asset_id),
    apiPath: cleanId(ref.apiPath || refLike.apiPath || refLike.api_path).replace(/^\/api/i, ''),
    url: cleanId(ref.url || refLike.url),
  }
}

function sameMediaRef(left = {}, right = {}) {
  const a = mediaCompareKey(left)
  const b = mediaCompareKey(right)
  if (a.assetId && b.assetId && a.assetId === b.assetId) return true
  if (a.apiPath && b.apiPath && a.apiPath === b.apiPath) return true
  if (a.url && b.url && a.url === b.url) return true
  return false
}

function isBoardBaselineVariant(scene = {}, variant = {}) {
  if (!variant?.fromBoard) return false
  if (!scene?.sourceVideo) return false
  return sameMediaRef(scene.sourceVideo, variant)
}

function boardSourceVariantForSceneV204B4(scene = {}) {
  // V204B8: the baseline card must represent the true original Board scene,
  // not the currently applied MMAudio video shown in the left/source preview.
  const originalRef = (typeof sceneOriginalSourceVideoV204B7 === 'function') ? sceneOriginalSourceVideoV204B7(scene) : null
  const sourceVideo = firstText(originalRef?.apiPath, originalRef?.url)
    ? originalRef
    : (scene.sourceVideo || {})
  if (!sourceVideo?.apiPath && !sourceVideo?.url) return null
  const sceneId = firstText(scene.id, scene.sceneId, scene.scene_id, 'scene') || 'scene'
  const sourceRef = normalizeRef(firstText(sourceVideo.apiPath, sourceVideo.url))
  return {
    id: `board_source_${sceneId}`,
    kind: 'source_video',
    label: 'из Доски',
    url: sourceRef.url || sourceVideo.url || sourceVideo.apiPath || '',
    apiPath: sourceRef.apiPath || sourceVideo.apiPath || '',
    assetId: sourceRef.assetId || sourceVideo.assetId || '',
    prompt: scene.prompt || '',
    negativePrompt: scene.negativePrompt || DEFAULT_NEGATIVE,
    volume: 100,
    createdAt: scene.importedAt || scene.updatedAt || nowIso(),
    fromBoard: true,
    sourceBaseline: true,
    applied: false,
  }
}

function variantDedupeKeyV204B4(variant = {}) {
  if (variant?.sourceBaseline || variant?.kind === 'source_video' || variant?.fromBoardBaseline) {
    return `source-baseline:${cleanId(variant.id) || 'board_source'}`
  }
  const id = cleanId(variant.id)
  if (id) return `id:${id}`
  const ref = mediaCompareKey(variant)
  if (ref.assetId) return `asset:${ref.assetId}`
  if (ref.apiPath) return `api:${ref.apiPath}`
  if (ref.url) return `url:${ref.url}`
  return `random:${Math.random()}`
}

function uniqueVariantsV204B4(input = []) {
  const seen = new Set()
  const out = []
  asArray(input).forEach((variant) => {
    if (!variant || typeof variant !== 'object') return
    const key = variantDedupeKeyV204B4(variant)
    if (seen.has(key)) return
    seen.add(key)
    out.push(variant)
  })
  return out
}

function isFakeAppliedFromBoardV204B6(variant = {}) {
  if (!variant || typeof variant !== 'object') return false
  if (variant.sourceBaseline || variant.kind === 'source_video') return false
  const label = cleanId(variant.label).toLowerCase()
  // These cards were generated by old V204B4/B5 Board import, not by a new Audio Studio generation.
  // They made the UI show "applied" even when the user did not explicitly apply a fresh variant.
  return Boolean(variant.fromBoard && !variant.jobId && !variant.rawMode && (label.includes('board') || label.includes('доск')))
}

function isRealMmaudioVariantV204B6(variant = {}) {
  if (!variant || typeof variant !== 'object') return false
  if (variant.sourceBaseline || variant.kind === 'source_video') return false
  if (isFakeAppliedFromBoardV204B6(variant)) return false
  return variant.kind === 'mmaudio_video' || Boolean(variant.jobId || variant.rawMode || variant.assetId || variant.apiPath || variant.url)
}

function realMmaudioVariantCountV204B4(scene = {}) {
  return asArray(scene.variants).filter(isRealMmaudioVariantV204B6).length
}

function nextMmaudioVariantLabelV204B4(scene = {}) {
  return `v${realMmaudioVariantCountV204B4(scene) + 1}`
}

function mmaudioVariantOrderNumberV204C5(variant = {}, fallback = 9999) {
  const direct = Number(variant.variantIndex ?? variant.variant_index ?? variant.attempt ?? variant.number)
  if (Number.isFinite(direct) && direct > 0) return direct
  const label = cleanId(variant.label)
  const match = label.match(/^v\s*(\d+)/i)
  if (match) {
    const parsed = Number(match[1])
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return fallback
}

function normalizeMmaudioVariantLabelsV204C5(input = []) {
  let counter = 0
  return asArray(input).map((variant) => {
    if (!isRealMmaudioVariantV204B6(variant)) return variant
    counter += 1
    const label = /^v\s*\d+/i.test(cleanId(variant.label)) ? `v${counter}` : (variant.label || `v${counter}`)
    return {
      ...variant,
      label,
      variantIndex: counter,
      variant_index: counter,
      timelineOrder: counter,
      timeline_order: counter,
    }
  })
}

function sortAudioVariantsV204C5(input = []) {
  const indexed = asArray(input).map((variant, index) => ({ variant, index }))
  indexed.sort((left, right) => {
    const a = left.variant || {}
    const b = right.variant || {}
    const aSource = Boolean(a.sourceBaseline || a.kind === 'source_video' || a.fromBoardBaseline)
    const bSource = Boolean(b.sourceBaseline || b.kind === 'source_video' || b.fromBoardBaseline)
    if (aSource !== bSource) return aSource ? -1 : 1

    const aReal = isRealMmaudioVariantV204B6(a)
    const bReal = isRealMmaudioVariantV204B6(b)
    if (aReal && bReal) {
      const byNumber = mmaudioVariantOrderNumberV204C5(a, left.index + 1) - mmaudioVariantOrderNumberV204C5(b, right.index + 1)
      if (byNumber) return byNumber
      const aTime = Date.parse(a.createdAt || a.created_at || '') || 0
      const bTime = Date.parse(b.createdAt || b.created_at || '') || 0
      if (aTime !== bTime) return aTime - bTime
    }
    return left.index - right.index
  })
  return normalizeMmaudioVariantLabelsV204C5(indexed.map((item) => item.variant))
}

function sanitizeAudioScene(scene = {}) {
  const appliedMmaudioMediaV211Y2 = sceneAppliedMmaudioMediaV211Y2(scene)
  const sourceVideo = firstText(appliedMmaudioMediaV211Y2.apiPath, appliedMmaudioMediaV211Y2.url)
    ? appliedMmaudioMediaV211Y2
    : (scene.sourceVideo || scene.currentVideo || scene.mmaudioAppliedVideo || {})
  const boardSourceVariant = boardSourceVariantForSceneV204B4(scene)
  const realVariants = asArray(scene.variants)
    .filter(isRealMmaudioVariantV204B6)
    .map((variant) => ({ ...variant, sourceBaseline: false, applied: false }))

  const variants = sortAudioVariantsV204C5(uniqueVariantsV204B4([
    boardSourceVariant,
    ...realVariants,
  ].filter(Boolean)))

  const variantIds = new Set(variants.map((variant) => cleanId(variant.id)).filter(Boolean))
  let appliedVariantId = variantIds.has(cleanId(scene.appliedVariantId)) ? cleanId(scene.appliedVariantId) : ''
  const appliedVariant = variants.find((variant) => cleanId(variant.id) === appliedVariantId)
  if (!appliedVariant || appliedVariant?.sourceBaseline || appliedVariant?.kind === 'source_video' || isFakeAppliedFromBoardV204B6(appliedVariant)) {
    appliedVariantId = ''
  }

  let selectedVariantId = variantIds.has(cleanId(scene.selectedVariantId)) ? cleanId(scene.selectedVariantId) : ''
  if (!selectedVariantId || isFakeAppliedFromBoardV204B6(variants.find((variant) => cleanId(variant.id) === selectedVariantId))) {
    selectedVariantId = appliedVariantId || variants.find(isRealMmaudioVariantV204B6)?.id || boardSourceVariant?.id || ''
  }

  const normalizedVariants = variants.map((variant) => ({
    ...variant,
    applied: Boolean(appliedVariantId && cleanId(variant.id) === cleanId(appliedVariantId)),
  }))
  const hasSource = Boolean(sourceVideo?.apiPath || sourceVideo?.url)
  const normalizedSceneV211Y2 = {
    ...scene,
    sourceVideo,
    currentVideo: appliedVariantId ? sourceVideo : (scene.currentVideo || scene.current_video || sourceVideo),
    mmaudioAppliedVideo: appliedVariantId ? sourceVideo : (scene.mmaudioAppliedVideo || scene.mmaudio_applied_video || null),
    variants: normalizedVariants,
    selectedVariantId,
    appliedVariantId,
    status: appliedVariantId ? 'applied' : (normalizedVariants.some(isRealMmaudioVariantV204B6) ? 'variants' : (hasSource ? 'ready' : 'no_video')),
  }
  return rehydrateAppliedMmaudioSceneV211Y2(normalizedSceneV211Y2)
}


// V204H18_STAU_EXPLICIT_CHOICE_RESET
function stableAudioVariantIdV204H18(variant = {}) {
  return cleanId(variant?.id || variant?.variantId || variant?.variant_id)
}

function normalizeStableAudioBlockSelectionV204H18(block = {}) {
  const stableAudio = block?.stableAudio || block?.stable_audio || {}
  const variants = asArray(stableAudio.variants)
  const explicitSelectedId = cleanId(
    stableAudio.selectedVariantId
    || stableAudio.selected_variant_id
    || block.selectedStableAudioVariantId
    || block.selected_stable_audio_variant_id
  )
  const appliedId = cleanId(stableAudio.appliedVariantId || stableAudio.applied_variant_id)
  const selectedId = explicitSelectedId || appliedId
  const selectedExists = Boolean(selectedId && variants.some((variant) => stableAudioVariantIdV204H18(variant) === selectedId))
  const normalizedVariants = variants.map((variant) => {
    const id = stableAudioVariantIdV204H18(variant)
    const isSelected = Boolean(selectedExists && id === selectedId)
    const isApplied = Boolean(appliedId && id === appliedId)
    return {
      ...variant,
      id: firstText(variant.id, variant.variantId, variant.variant_id, id),
      variantId: firstText(variant.variantId, variant.id, variant.variant_id, id),
      selected: isSelected,
      applied: isApplied,
    }
  })
  return {
    ...block,
    stableAudio: {
      ...stableAudio,
      variants: normalizedVariants,
      selectedVariantId: selectedExists ? selectedId : '',
      selected_variant_id: selectedExists ? selectedId : '',
    },
  }
}

function sanitizeAudioSnapshot(snapshot = {}) {
  const stableBlocks = asArray(snapshot.stableBlocks).map((block) => {
    const stableAudio = block?.stableAudio || {}
    const selectedId = cleanId(stableAudio.selectedVariantId || stableAudio.selected_variant_id)
    const appliedId = cleanId(stableAudio.appliedVariantId || stableAudio.applied_variant_id)
    const variants = normalizeStableAudioVariantsSingleSelectedV204H14(stableAudio.variants, selectedId, appliedId)
    const finalSelectedId = selectedId || stableAudioVariantIdV204H14(variants.find((variant) => variant?.selected === true))
    return {
      ...block,
      stableAudio: {
        ...stableAudio,
        selectedVariantId: finalSelectedId,
        selected_variant_id: finalSelectedId,
        variants,
      },
    }
  })
  return {
    ...snapshot,
    scenes: asArray(snapshot.scenes).map(sanitizeAudioScene),
    stableBlocks,
  }
}

function audioSnapshotSafeBackupKeyV204B9(projectId = '') {
  return `ava_audio_studio_safe_snapshot_v204b9_${cleanId(projectId) || 'workspace'}`
}

function audioSnapshotScoreV204B9(snapshot = {}) {
  const scenes = asArray(snapshot.scenes)
  let score = scenes.length
  scenes.forEach((scene) => {
    const variants = asArray(scene.variants)
    const realVariants = variants.filter(isRealMmaudioVariantV204B6)
    score += realVariants.length * 20
    if (cleanId(scene.appliedVariantId)) score += 80
    if (scene.sourceVideo?.apiPath || scene.sourceVideo?.url) score += 2
  })
  return score
}

function readAudioSnapshotSafeBackupV204B9(projectId = '') {
  try {
    const raw = localStorage.getItem(audioSnapshotSafeBackupKeyV204B9(projectId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (!asArray(parsed.scenes).length) return null
    return parsed
  } catch {
    return null
  }
}

function rememberAudioSnapshotSafeBackupV204B9(snapshot = {}, projectId = '') {
  try {
    const clean = sanitizeAudioSnapshot(snapshot)
    if (audioSnapshotScoreV204B9(clean) <= 0) return
    localStorage.setItem(audioSnapshotSafeBackupKeyV204B9(projectId), JSON.stringify({
      ...clean,
      localSafeBackupVersion: 'V204B9',
      localSafeBackupAt: nowIso(),
    }))
  } catch {
    // ignore browser storage errors
  }
}

function forgetAudioSnapshotSafeBackupV204B9(projectId = '') {
  try {
    localStorage.removeItem(audioSnapshotSafeBackupKeyV204B9(projectId))
  } catch {
    // ignore browser storage errors
  }
}

function chooseSaferAudioSnapshotV204B9(serverSnapshot = {}, localSnapshot = null) {
  if (!localSnapshot) return { snapshot: serverSnapshot, usedLocal: false }
  const serverScore = audioSnapshotScoreV204B9(serverSnapshot)
  const localScore = audioSnapshotScoreV204B9(localSnapshot)
  if (localScore > serverScore) return { snapshot: localSnapshot, usedLocal: true, serverScore, localScore }
  return { snapshot: serverSnapshot, usedLocal: false, serverScore, localScore }
}

function durationOf(scene = {}) {
  const start = toNumber(scene.start_sec ?? scene.start, 0)
  const explicit = toNumber(scene.duration_sec ?? scene.durationSec, 0)
  if (explicit > 0) return explicit
  const end = toNumber(scene.end_sec ?? scene.end, 0)
  return Math.max(0, end - start)
}

function stableBlockSceneIdsV204F4(block = {}) {
  const raw = block?.sceneIds ?? block?.scene_ids ?? block?.scenes ?? []
  return asArray(raw).map((item) => cleanId(
    typeof item === 'string'
      ? item
      : (item?.id || item?.sceneId || item?.scene_id)
  )).filter(Boolean)
}


function stableBlockSceneIdsEqualV204H2(left = [], right = []) {
  const a = asArray(left).map(cleanId).filter(Boolean).join('|')
  const b = asArray(right).map(cleanId).filter(Boolean).join('|')
  return a === b
}

function exportStableBlockForAudioStudioV204H2(block = {}, index = 0) {
  const sceneIds = stableBlockSceneIdsV204F4(block)
  const stableAudio = block?.stableAudio || {}
  const applied = block?.appliedStableAudio
    || block?.applied_stable_audio
    || stableAudio.appliedAudio
    || stableAudio.applied_audio
    || null
  return {
    ...block,
    id: cleanId(block?.id) || `stable_block_export_${index + 1}`,
    sceneIds,
    scene_ids: sceneIds,
    startSec: toNumber(block?.startSec ?? block?.start_sec, 0),
    start_sec: toNumber(block?.startSec ?? block?.start_sec, 0),
    endSec: toNumber(block?.endSec ?? block?.end_sec, 0),
    end_sec: toNumber(block?.endSec ?? block?.end_sec, 0),
    durationSec: toNumber(block?.durationSec ?? block?.duration_sec, 0),
    duration_sec: toNumber(block?.durationSec ?? block?.duration_sec, 0),
    stableAudio: {
      ...stableAudio,
      variants: asArray(stableAudio.variants),
    },
    appliedStableAudio: applied,
    applied_stable_audio: applied,
    assemblyReady: Boolean(applied || block?.assemblyReady || block?.assembly_ready),
    assembly_ready: Boolean(applied || block?.assemblyReady || block?.assembly_ready),
  }
}

function stableBlockTimelineFromScenesV204F4(scenes = []) {
  const list = asArray(scenes)
  if (!list.length) return { startSec: 0, endSec: 0, durationSec: 0, requestDurationSec: 0 }
  const starts = list.map((scene) => toNumber(scene.startSec ?? scene.start_sec ?? scene.start, 0))
  const ends = list.map((scene) => {
    const start = toNumber(scene.startSec ?? scene.start_sec ?? scene.start, 0)
    const end = toNumber(scene.endSec ?? scene.end_sec ?? scene.end, 0)
    const duration = toNumber(scene.durationSec ?? scene.duration_sec, 0)
    return end > start ? end : start + duration
  })
  const startSec = Math.min(...starts)
  const endSec = Math.max(...ends)
  const durationSec = Math.max(0, endSec - startSec)
  return {
    startSec,
    endSec,
    durationSec,
    requestDurationSec: durationSec > 0 ? Math.ceil(durationSec + 1) : 0,
  }
}

// V204F7_STABLE_AUDIO_CONTROLS_SHELL
const STABLE_AUDIO_DEFAULT_NEGATIVE_V204F7 = 'vocals, lyrics, speech, dialogue, singing, gunshots, bullets, explosions, glass breaking, debris sounds, footsteps, sirens, city traffic, silence, sudden ending, short cutoff, distortion'


function stableAudioVariantRefV204G6(variant = {}) {
  return firstText(
    variant.assetApiPath,
    variant.asset_api_path,
    variant.audioApiPath,
    variant.audio_api_path,
    variant.apiPath,
    variant.api_path,
    variant.url,
    variant.assetUrl,
    variant.asset_url,
    variant.audioUrl,
    variant.audio_url,
  )
}

// V204H14_STAU_SINGLE_VARIANT_SOURCE
// Stable Audio must have exactly one selected variant. Preview/apply must use
// that exact variant + its own volume, never all variants and never the first stale one.
function stableAudioVariantIdV204H14(variant = {}) {
  return cleanId(variant?.id || variant?.variantId || variant?.variant_id || '')
}

function stableAudioVariantCreatedMsV204H14(variant = {}) {
  const raw = firstText(variant?.createdAt, variant?.created_at, variant?.updatedAt, variant?.updated_at)
  const ms = raw ? Date.parse(raw) : NaN
  return Number.isFinite(ms) ? ms : 0
}

function normalizeStableAudioVariantsSingleSelectedV204H14(variants = [], selectedId = '', appliedId = '') {
  const list = asArray(variants).filter(Boolean)
  const cleanSelected = cleanId(selectedId)
  const cleanApplied = cleanId(appliedId)
  const ids = new Set(list.map(stableAudioVariantIdV204H14).filter(Boolean))
  const fallback = list.length
    ? [...list].sort((a, b) => stableAudioVariantCreatedMsV204H14(b) - stableAudioVariantCreatedMsV204H14(a))[0]
    : null
  const finalSelected = ids.has(cleanSelected) ? cleanSelected : stableAudioVariantIdV204H14(fallback)
  return list.map((variant) => {
    const id = stableAudioVariantIdV204H14(variant)
    return {
      ...variant,
      id: id || variant.id,
      variantId: id || variant.variantId,
      selected: Boolean(finalSelected && id === finalSelected),
      applied: Boolean(cleanApplied && id === cleanApplied),
    }
  })
}

function pickStableAudioVariantStrictV204H14(variants = [], selectedId = '') {
  const list = asArray(variants).filter(Boolean)
  const cleanSelected = cleanId(selectedId)
  if (cleanSelected) {
    const exact = list.find((variant) => stableAudioVariantIdV204H14(variant) === cleanSelected)
    if (exact) return exact
  }
  const flagged = list.find((variant) => variant?.selected === true)
  if (flagged) return flagged
  return list.length
    ? [...list].sort((a, b) => stableAudioVariantCreatedMsV204H14(b) - stableAudioVariantCreatedMsV204H14(a))[0]
    : null
}


function stableAudioModeApiValueV204F7(value = 'Music') {
  const clean = cleanId(value).toLowerCase()
  if (
    clean === 'sfx' ||
    clean === 'soundfx' ||
    clean === 'sound_fx' ||
    clean === 'sound effects' ||
    clean === 'soundeffects' ||
    clean === 'effects' ||
    clean === 'effect' ||
    clean === 'fx' ||
    clean === 'сфх' ||
    clean === 'эффекты' ||
    clean === 'звуковые эффекты'
  ) return 'SFX'
  if (clean === 'instrument' || clean === 'instrumental' || clean === 'инструмент' || clean === 'инструментал') return 'Instrument'
  return 'Music'
}

function stableAudioModeUiLabelV204F7(value = 'Music') {
  const mode = stableAudioModeApiValueV204F7(value)
  if (mode === 'SFX') return 'SFX'
  return mode === 'Instrument' ? 'Instrumental' : 'Music'
}

function stableAudioVolumeV204F7(value, fallback = DEFAULT_STAU_VOLUME_PERCENT_V204G14) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.min(100, Math.round(n)))
}

function stableAudioFadeV204F7(value, fallback = 0.35) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.min(5, Math.round(n * 100) / 100))
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


function audioStudioTimingAudioRefV204E10(scene = {}) {
  const raw = scene?.boardRaw || {}
  const rawRef = typeof boardSourceAudioRef === 'function' ? boardSourceAudioRef(raw) : ''
  return firstText(
    scene?.sourceAudio?.apiPath,
    scene?.sourceAudio?.url,
    scene?.audio?.apiPath,
    scene?.audio?.url,
    scene?.audioApiPath,
    scene?.audioUrl,
    scene?.audio_slice_api_path,
    scene?.audioSliceApiPath,
    scene?.audio_slice_url,
    scene?.audioSliceUrl,
    scene?.timing_audio_api_path,
    scene?.timingAudioApiPath,
    scene?.timing_audio_url,
    scene?.timingAudioUrl,
    rawRef,
    raw?.audio_slice_api_path,
    raw?.audioSliceApiPath,
    raw?.audio_slice_url,
    raw?.audioSliceUrl,
    raw?.timing_audio_api_path,
    raw?.timingAudioApiPath,
    raw?.timing_audio_url,
    raw?.timingAudioUrl,
    raw?.audio_api_path,
    raw?.audioApiPath,
    raw?.audio_url,
    raw?.audioUrl,
  )
}

function audioStudioTimingRangeV204E10(scene = {}) {
  const start = toNumber(scene?.startSec ?? scene?.start_sec ?? scene?.start, 0)
  const explicitEnd = scene?.endSec ?? scene?.end_sec ?? scene?.end
  const duration = toNumber(scene?.durationSec ?? scene?.duration_sec, 0)
  const end = explicitEnd !== undefined && explicitEnd !== null && explicitEnd !== ''
    ? toNumber(explicitEnd, start + duration)
    : start + duration
  return { start, end, durationSec: Math.max(0, end - start) }
}

function audioStudioSourceAudioFromSliceResponseV204E10(data = {}, scene = {}) {
  const apiPath = firstText(data.audioSliceApiPath, data.audio_slice_api_path, data.apiPath, data.asset_api_path, data.url)
  const url = firstText(data.audioSliceUrl, data.audio_slice_url, data.assetUrl, data.asset_url, apiPath)
  const ref = normalizeRef(firstText(apiPath, url))
  return {
    url,
    apiPath,
    assetId: ref.assetId,
    name: firstText(data.audioSliceName, data.audio_slice_name, data.name, 'timing_audio.mp3'),
    startSec: toNumber(data.startSec ?? data.start_sec ?? scene?.startSec ?? scene?.start_sec, 0),
    endSec: toNumber(data.endSec ?? data.end_sec ?? scene?.endSec ?? scene?.end_sec, 0),
    durationSec: toNumber(data.durationSec ?? data.duration_sec ?? scene?.durationSec ?? scene?.duration_sec, 0),
    source: 'audio_studio_timing_preload_v204e10',
    createdAt: nowIso(),
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
    const sourceAudioRefV204E10 = normalizeRef(audioStudioTimingAudioRefV204E10({ boardRaw: scene }))
    const sourceAudioRefV204E9 = normalizeRef(boardSourceAudioRef(scene))
    const sourceAudioRefV204E8 = normalizeRef(audioStudioBoardAudioRefV204E8(scene))
    const sourceAudioRefV204E7 = normalizeRef(boardSourceAudioRefV204E7(scene))
    const sourceAudioRefV204E5A = normalizeRef(boardSourceAudioRefV204E5A(scene))
    const sourceAudioRef = normalizeRef(boardSourceAudioRef(scene))
    const prompt = firstText(scene.mmaudio_prompt, scene.mmaudioPrompt, scene.sound_prompt, scene.soundPrompt)
    const negativePrompt = firstText(scene.mmaudio_negative_prompt, scene.mmaudioNegativePrompt, scene.negative_sound_prompt, scene.negativeSoundPrompt, DEFAULT_NEGATIVE)
    const volume = toNumber(scene.mmaudio_volume ?? scene.mmaudioVolume ?? scene.audio_studio_mmaudio_volume ?? scene.audioStudioMmaudioVolume, DEFAULT_MMAUDIO_VOLUME_PERCENT_V204G14)
    const variants = []
    if (sourceRef.apiPath || sourceRef.url) {
      variants.push({
        id: `board_source_${sceneId}`,
        kind: 'source_video',
        label: 'из Доски',
        url: sourceRef.url,
        apiPath: sourceRef.apiPath,
        assetId: sourceRef.assetId,
        prompt,
        negativePrompt,
        volume: 100,
        createdAt: firstText(scene.updatedAt, scene.updated_at) || nowIso(),
        fromBoard: true,
        sourceBaseline: true,
        applied: false,
      })
    }
    return {
      id: sceneId,
      sceneId,
      index,
      title: firstText(scene.title, scene.user_scene_label, scene.userSceneLabel, scene.label, sceneId) || `Сцена ${index + 1}`,
      color: sceneColor(scene, index, board),
      blockId: firstText(scene.blockId, scene.block_id, scene.semanticBlockId, scene.semantic_block_id),
      blockTitle: firstText(scene.blockTitle, scene.block_title, scene.semanticBlockTitle, scene.semantic_block_title),
      status: sourceRef.apiPath || sourceRef.url ? 'ready' : 'no_video',
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
      sourceAudio: {
        url: sourceAudioRef.url,
        apiPath: sourceAudioRef.apiPath,
        assetId: sourceAudioRef.assetId,
        name: firstText(scene.audio_name, scene.audioName, scene.audio_slice_name, scene.audioSliceName, 'timing_audio'),
      },
      prompt,
      negativePrompt,
      mmaudioVolume: volume,
      selectedVariantId: variants[0]?.id || '',
      appliedVariantId: '',
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

function manualSceneColorV204C8(index = 0, seed = '') {
  const palette = [
    '#22D3EE', // cyan
    '#A855F7', // violet
    '#F97316', // orange
    '#10B981', // emerald
    '#F43F5E', // rose
    '#3B82F6', // blue
    '#EAB308', // yellow
    '#EC4899', // pink
    '#14B8A6', // teal
    '#8B5CF6', // purple
    '#84CC16', // lime
    '#EF4444', // red
  ]
  const hue = Math.abs(Math.round(stableHueFromText(seed || `manual:${index}`, index)))
  const idx = (hue + (Number(index || 0) * 7)) % palette.length
  return palette[idx]
}

function buildManualAudioSceneV204C6(index = 0) {
  const number = Number(index || 0) + 1
  const id = `manual_${String(number).padStart(2, '0')}_${Date.now().toString(36)}`
  return {
    id,
    sceneId: id,
    index,
    title: `Сцена ${number}`,
    color: manualSceneColorV204C8(index, id),
    blockId: '',
    blockTitle: 'Audio Studio',
    status: 'no_video',
    startSec: 0,
    endSec: 6,
    durationSec: 6,
    route: 'audio_studio_manual',
    sourceVideo: { url: '', apiPath: '', assetId: '', name: '' },
    sourceAudio: { url: '', apiPath: '', assetId: '', name: '' },
    prompt: '',
    negativePrompt: DEFAULT_NEGATIVE,
    mmaudioVolume: DEFAULT_MMAUDIO_VOLUME_PERCENT_V204G14,
    selectedVariantId: '',
    appliedVariantId: '',
    variants: [],
    manualScene: true,
    createdInAudioStudio: true,
    createdAt: nowIso(),
  }
}


// AVA_AUDIO_STUDIO_DROP_STALE_MMA_ON_BOARD_MEDIA_CHANGE_V212M:
// When Board video/image is regenerated, old MMAudio variants belong to the old source video.
// Do not carry old applied MMAudio back into Assembly via Audio Studio.
function mergeAudioWithFreshBoard(audio = {}, board = {}, projectId = '') {
  const fresh = buildAudioSnapshotFromBoard(board, { projectId, source: 'board_refresh_merge_v204a' })
  const oldScenes = new Map(asArray(audio.scenes).map((scene) => [cleanId(scene.id || scene.sceneId), scene]))
  let droppedStaleMma = 0
  const scenes = asArray(fresh.scenes).map((freshScene) => {
    const old = oldScenes.get(cleanId(freshScene.id || freshScene.sceneId))
    if (!old) return freshScene

    const oldOriginalSource = sceneOriginalSourceVideoV204B7(old)
    const oldOriginalHasRef = Boolean(firstText(oldOriginalSource.apiPath, oldOriginalSource.url, oldOriginalSource.assetId))
    const freshSourceHasRef = Boolean(firstText(freshScene.sourceVideo?.apiPath, freshScene.sourceVideo?.url, freshScene.sourceVideo?.assetId))
    const sourceChanged = Boolean(oldOriginalHasRef && freshSourceHasRef && !sameMediaRef(oldOriginalSource, freshScene.sourceVideo || {}))

    const oldVariants = asArray(old.variants)
    const oldById = new Map(oldVariants.map((variant) => [cleanId(variant.id), variant]))
    const mergedVariants = sourceChanged
      ? asArray(freshScene.variants)
      : [
          ...oldVariants,
          ...asArray(freshScene.variants).filter((variant) => !oldById.has(cleanId(variant.id))),
        ]

    if (sourceChanged && (old.appliedVariantId || old.audioStudioAppliedVariantId || oldVariants.some(isRealMmaudioVariantV204B6))) {
      droppedStaleMma += 1
    }

    return {
      ...freshScene,
      prompt: old.prompt || freshScene.prompt,
      negativePrompt: old.negativePrompt || freshScene.negativePrompt,
      mmaudioVolume: toNumber(old.mmaudioVolume, freshScene.mmaudioVolume ?? DEFAULT_MMAUDIO_VOLUME_PERCENT_V204G14),
      selectedVariantId: sourceChanged ? (freshScene.selectedVariantId || mergedVariants[0]?.id || '') : (old.selectedVariantId || freshScene.selectedVariantId),
      appliedVariantId: sourceChanged ? '' : (old.appliedVariantId || freshScene.appliedVariantId),
      audioStudioAppliedVariantId: sourceChanged ? '' : (old.audioStudioAppliedVariantId || freshScene.audioStudioAppliedVariantId || ''),
      audio_studio_applied_variant_id: sourceChanged ? '' : (old.audio_studio_applied_variant_id || freshScene.audio_studio_applied_variant_id || ''),
      currentVideo: sourceChanged ? freshScene.sourceVideo : (old.currentVideo || freshScene.currentVideo || freshScene.sourceVideo),
      mmaudioAppliedVideo: sourceChanged ? null : (old.mmaudioAppliedVideo || old.mmaudio_applied_video || null),
      mmaudio_applied_video: sourceChanged ? null : (old.mmaudio_applied_video || old.mmaudioAppliedVideo || null),
      mmaudio_video_url: sourceChanged ? '' : (old.mmaudio_video_url || old.mmaudioVideoUrl || ''),
      mmaudioVideoUrl: sourceChanged ? '' : (old.mmaudioVideoUrl || old.mmaudio_video_url || ''),
      mmaudio_video_api_path: sourceChanged ? '' : (old.mmaudio_video_api_path || old.mmaudioVideoApiPath || ''),
      mmaudioVideoApiPath: sourceChanged ? '' : (old.mmaudioVideoApiPath || old.mmaudio_video_api_path || ''),
      mmaudio_video_asset_id: sourceChanged ? '' : (old.mmaudio_video_asset_id || old.mmaudioVideoAssetId || ''),
      mmaudioVideoAssetId: sourceChanged ? '' : (old.mmaudioVideoAssetId || old.mmaudio_video_asset_id || ''),
      has_mmaudio: sourceChanged ? false : Boolean(old.has_mmaudio || old.hasMmaudio),
      hasMmaudio: sourceChanged ? false : Boolean(old.hasMmaudio || old.has_mmaudio),
      mmaudio_status: sourceChanged ? '' : (old.mmaudio_status || old.mmaudioStatus || ''),
      mmaudioStatus: sourceChanged ? '' : (old.mmaudioStatus || old.mmaudio_status || ''),
      audio_studio_status: sourceChanged ? '' : (old.audio_studio_status || old.audioStudioStatus || ''),
      audioStudioStatus: sourceChanged ? '' : (old.audioStudioStatus || old.audio_studio_status || ''),
      variants: mergedVariants,
      status: sourceChanged ? (mergedVariants.length ? 'ready' : freshScene.status) : (old.appliedVariantId ? 'applied' : (mergedVariants.length ? 'variants' : freshScene.status)),
      staleMmaudioDroppedV212M: sourceChanged,
    }
  })
  if (droppedStaleMma) console.warn('[AUDIO STUDIO DROP STALE MMA ON BOARD MEDIA CHANGE V212M]', { droppedStaleMma })
  return {
    ...audio,
    ...fresh,
    scenes,
    selectedSceneId: audio.selectedSceneId || fresh.selectedSceneId || scenes[0]?.id || '',
    staleMmaudioDroppedCountV212M: droppedStaleMma,
    updatedAt: nowIso(),
  }
}



function isManualAudioSceneV204C7(scene = {}) {
  const route = cleanId(scene.route).toLowerCase()
  const id = cleanId(scene.id || scene.sceneId).toLowerCase()
  return Boolean(
    scene.manualScene ||
    scene.createdInAudioStudio ||
    route === 'audio_studio_manual' ||
    id.startsWith('manual_')
  )
}

function isBoardAudioSceneV204C7(scene = {}) {
  const route = cleanId(scene.route).toLowerCase()
  return Boolean(
    scene.boardRaw ||
    scene.fromBoard ||
    scene.importedFrom === 'board' ||
    scene.source === 'board' ||
    (route && route !== 'audio_studio_manual' && !isManualAudioSceneV204C7(scene))
  )
}

function canUseManualSceneControlsV204C7(snapshot = {}) {
  const scenes = asArray(snapshot.scenes)
  if (!scenes.length) return true
  const importedFrom = cleanId(snapshot.importedFrom).toLowerCase()
  const source = cleanId(snapshot.source).toLowerCase()
  if (importedFrom === 'board' || source.includes('board_import') || source.includes('board_refresh')) return false
  if (scenes.some(isBoardAudioSceneV204C7)) return false
  return scenes.every(isManualAudioSceneV204C7)
}

function sceneStatusLabel(scene = {}) {
  const appliedMediaV211Y2 = sceneAppliedMmaudioMediaV211Y2(scene)
  const hasVideoV211Y2 = Boolean(
    scene.sourceVideo?.apiPath || scene.sourceVideo?.url
    || scene.currentVideo?.apiPath || scene.currentVideo?.url
    || scene.mmaudioAppliedVideo?.apiPath || scene.mmaudioAppliedVideo?.url
    || appliedMediaV211Y2.apiPath || appliedMediaV211Y2.url
  )
  if (!hasVideoV211Y2) return 'нет видео'
  if (scene.jobId) return 'генерация'
  if (scene.appliedVariantId) return 'мма'
  if (asArray(scene.variants).some((variant) => !variant?.sourceBaseline && variant.kind !== 'source_video')) return 'есть варианты'
  return 'готово'
}

function variantRef(variant = {}) {
  return firstText(variant.apiPath, variant.url)
}

function audioStudioSceneVideoRefV204F2(scene = {}) {
  const appliedMediaV211Y2 = sceneAppliedMmaudioMediaV211Y2(scene)
  const appliedRefV211Y2 = firstText(appliedMediaV211Y2.apiPath, appliedMediaV211Y2.url)
  if (cleanId(scene?.appliedVariantId || scene?.audioStudioAppliedVariantId) && appliedRefV211Y2) return appliedRefV211Y2
  return firstText(
    scene?.currentVideo?.apiPath,
    scene?.currentVideo?.url,
    scene?.mmaudioAppliedVideo?.apiPath,
    scene?.mmaudioAppliedVideo?.url,
    scene?.sourceVideo?.apiPath,
    scene?.sourceVideo?.url,
    scene?.videoApiPath,
    scene?.videoUrl,
    scene?.video?.apiPath,
    scene?.video?.url,
    scene?.apiPath,
    scene?.url,
    scene?.boardRaw ? boardSourceVideoRef(scene.boardRaw) : '',
  )
}

// V211E_PREVIEW_FULL_PROJECT_MAP
function pickFullProjectPreviewVideoV211E(data = {}) {
  if (!data || typeof data !== 'object') return null
  const direct = firstText(
    data.finalVideoApiPath,
    data.final_video_api_path,
    data.finalVideoUrl,
    data.final_video_url,
    data.finalUrl,
    data.final_url,
    data.outputVideoApiPath,
    data.output_video_api_path,
    data.outputVideoUrl,
    data.output_video_url,
    data.assembledVideoApiPath,
    data.assembled_video_api_path,
    data.assembledVideoUrl,
    data.assembled_video_url,
    data.videoApiPath,
    data.video_api_path,
    data.videoUrl,
    data.video_url,
    data.apiPath,
    data.assetApiPath,
    data.url,
  )
  if (direct) {
    const ref = normalizeRef(direct)
    return {
      apiPath: ref.apiPath || direct,
      url: ref.url || direct,
      assetId: ref.assetId || firstText(data.assetId, data.asset_id, data.finalVideoAssetId, data.final_video_asset_id),
      durationSec: toNumber(data.durationSec ?? data.duration_sec ?? data.finalDurationSec ?? data.final_duration_sec, 0),
      source: 'board_assembly_direct_v211e',
      createdAt: firstText(data.updatedAt, data.createdAt) || nowIso(),
    }
  }

  const candidates = []
  const visit = (value, depth = 0) => {
    if (!value || depth > 5) return
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1))
      return
    }
    if (typeof value !== 'object') return
    const refText = firstText(value.apiPath, value.api_path, value.assetApiPath, value.asset_api_path, value.url, value.videoUrl, value.video_url)
    const kind = cleanId(value.kind || value.type || value.stage || value.source).toLowerCase()
    if (refText && (/\.mp4($|\?)/i.test(refText) || /\/assets\/[^/]+\/file/i.test(refText) || kind.includes('video') || kind.includes('assembly'))) {
      const ref = normalizeRef(refText)
      candidates.push({
        apiPath: ref.apiPath || refText,
        url: ref.url || refText,
        assetId: ref.assetId || firstText(value.assetId, value.asset_id),
        durationSec: toNumber(value.durationSec ?? value.duration_sec, 0),
        source: 'board_assembly_scan_v211e',
        createdAt: firstText(value.updatedAt, value.createdAt) || nowIso(),
      })
    }
    Object.values(value).forEach((item) => visit(item, depth + 1))
  }
  visit(data, 0)
  return candidates.find((item) => firstText(item.apiPath, item.url)) || null
}


// V204H7_AUDIO_STUDIO_BLOCK_PREVIEW_CLEAN_MIX
// Before auto-playing a freshly built block preview, stop every other local
// audio/video element in Audio Studio. Otherwise the STAU asset player or an
// old scene preview can keep playing and sound like an extra stuck drum layer.
function pauseAudioStudioMediaV204H7(exceptNode = null) {
  try {
    const nodes = Array.from(document.querySelectorAll('video, audio'))
    nodes.forEach((node) => {
      if (!node || node === exceptNode) return
      try { node.pause() } catch (_err) {}
    })
  } catch (_err) {}
}

function PreviewVideo({ source = '', title = '', className = '', volume = 1, controls = true, autoPlayKey = '', onTimeUpdate = null }) {
  const [blobUrl, setBlobUrl] = useState('')
  const [error, setError] = useState('')
  const videoRef = useRef(null)
  const cleanSource = cleanId(source)
  const uiVolumeV204H10 = normalizeAudioStudioUiVolume01V204H10C(volume, 1)
  const applyPreviewVideoVolumeV204H10 = useCallback((node = videoRef.current) => {
    return setAudioStudioMediaVolumeV204H10(node, uiVolumeV204H10, 1)
  }, [uiVolumeV204H10])

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
    applyPreviewVideoVolumeV204H10()
  }, [applyPreviewVideoVolumeV204H10, blobUrl, cleanSource])

  // V204H10_PREVIEW_VIDEO_VOLUME_EFFECT
  useEffect(() => {
    applyPreviewVideoVolumeV204H10()
  }, [applyPreviewVideoVolumeV204H10, blobUrl, cleanSource])

  const shouldFetch = /\/(api\/)?assets\/[^/]+\/file/i.test(cleanSource)
  const src = shouldFetch ? blobUrl : (cleanSource ? buildApiUrl(cleanSource) : '')
  const autoPlayKeyV204G9 = cleanId(autoPlayKey)

  // V204G9_STABLE_PREVIEW_FLOW_CLEANUP
  // Autoplay is only triggered by a fresh button-click result. Restored previews after F5
  // remain visible but do not unexpectedly start playing in the wrong tab/panel.
  useEffect(() => {
    if (!autoPlayKeyV204G9 || !src || !videoRef.current) return undefined
    let cancelled = false
    const playOnce = () => {
      if (cancelled || !videoRef.current) return
      try {
        const node = videoRef.current
        pauseAudioStudioMediaV204H7(node)
        applyPreviewVideoVolumeV204H10(node)
        node.currentTime = 0
        const promise = node.play()
        if (promise && typeof promise.catch === 'function') promise.catch(() => {})
      } catch (_err) {
        // Browser may block autoplay with sound; the video remains ready for manual play.
      }
    }
    const timers = [80, 240, 650].map((ms) => window.setTimeout(playOnce, ms))
    return () => {
      cancelled = true
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [autoPlayKeyV204G9, src])

  if (!cleanSource) {
    return <div className={`avaAudioPreviewEmpty ${className}`}>Нет видео</div>
  }
  if (shouldFetch && !blobUrl && !error) {
    return <div className={`avaAudioPreviewEmpty ${className}`}>Загружаю preview…</div>
  }
  if (error) {
    return <div className={`avaAudioPreviewEmpty isError ${className}`}>Preview недоступен: {error}</div>
  }
  return (
    <video
      ref={videoRef}
      className={className}
      src={src || undefined}
      title={title}
      controls={controls}
      playsInline
      onLoadedMetadata={() => applyPreviewVideoVolumeV204H10()}
      onCanPlay={() => applyPreviewVideoVolumeV204H10()}
      onPlay={() => applyPreviewVideoVolumeV204H10()}
      onTimeUpdate={onTimeUpdate || undefined}
    />
  )
}

function PreviewAudio({ source = '', title = 'Аудио тайминга', className = '', volume = 1 }) {
  const [blobUrl, setBlobUrl] = useState('')
  const [error, setError] = useState('')
  const audioRef = useRef(null)
  const cleanSource = cleanId(source)
  const uiVolumeV204H10 = normalizeAudioStudioUiVolume01V204H10C(volume, 1)
  const applyPreviewAudioVolumeV204H10 = useCallback((node = audioRef.current) => {
    return setAudioStudioMediaVolumeV204H10(node, uiVolumeV204H10, 1)
  }, [uiVolumeV204H10])

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

  const shouldFetch = /\/(api\/)?assets\/[^/]+\/file/i.test(cleanSource)
  const src = shouldFetch ? blobUrl : (cleanSource ? buildApiUrl(cleanSource) : '')

  if (!cleanSource) {
    return (
      <div className="avaAudioTimingAudioBoxV204E3 isMissing">
        <span>Аудио тайминга</span>
        <small>не найдено в сцене — обнови импорт из Доски</small>
      </div>
    )
  }
  if (shouldFetch && !blobUrl && !error) {
    return (
      <div className="avaAudioTimingAudioBoxV204E3 isLoading">
        <span>Аудио тайминга</span>
        <small>загружаю…</small>
      </div>
    )
  }
  if (error) {
    return (
      <div className="avaAudioTimingAudioBoxV204E3 isError">
        <span>Аудио тайминга</span>
        <small>{error}</small>
      </div>
    )
  }
  return (
    <div className="avaAudioTimingAudioBoxV204E3">
      <span>Аудио тайминга</span>
      <audio
        ref={audioRef}
        className={className}
        src={src}
        title={title}
        controls
        preload="auto"
        onLoadedMetadata={() => applyPreviewAudioVolumeV204H10()}
        onCanPlay={() => applyPreviewAudioVolumeV204H10()}
        onPlay={() => applyPreviewAudioVolumeV204H10()}
      />
    </div>
  )
}


// V211H_GLOBAL_PREVIEW_NOTES_PANEL
function parsePreviewNotesRowsV211H(notesText = '') {
  return String(notesText || '')
    .split(/\r?\n/g)
    .map((raw, index) => {
      const line = String(raw || '').trim()
      if (!line) return null
      const match = line.match(/^(\d+)(?:\s*[-–—]\s*(\d+))?\s+(.+)$/)
      const start = match ? Math.max(1, Number(match[1]) || 1) : 0
      const end = match ? Math.max(start, Number(match[2] || match[1]) || start) : 0
      const body = match ? match[3].trim() : line
      const lower = body.toLowerCase()
      const kind = lower.includes('мма') || lower.includes('mma')
        ? 'MMA'
        : (lower.includes('sfx') || lower.includes('сфх') ? 'SFX' : (lower.includes('стейбл') || lower.includes('stable') || lower.includes('stau') ? 'STAU' : 'NOTE'))
      return { id: `global_note_${index}`, line, start, end, body, kind }
    })
    .filter(Boolean)
}

function AudioStudioGlobalNotesPanelV211H({ notesText = '', onOpenPreview = null }) {
  const cleanNotes = String(notesText || '')
  const rows = parsePreviewNotesRowsV211H(cleanNotes)
  return (
    <div className={`avaAudioGlobalNotesPanelV211H isTextareaV211I ${cleanNotes.trim() ? 'hasNotes' : 'isEmpty'}`}>
      <div className="avaAudioGlobalNotesHeadV211H">
        <div>
          <strong>Заметки из Preview / Разметка</strong>
          <span>{rows.length ? `${rows.length} строк · общий список для MMAudio и Stable` : 'пока пусто · пиши в Preview / Разметка'}</span>
        </div>
        {onOpenPreview ? (
          <button type="button" onClick={onOpenPreview}>
            <Film size={14} /> Открыть разметку
          </button>
        ) : null}
      </div>
      <textarea
        className="avaAudioGlobalNotesTextareaV211I"
        value={cleanNotes}
        readOnly
        spellCheck={false}
        placeholder={`1-4 аплодисменты бурные стейбл
5 смех мма
12-16 аплодисменты обычные стейбл`}
      />
    </div>
  )
}


// V211J_RESTORE_SCENESTRIP
function SceneStrip({ scenes, selectedSceneId, onSelect, stableMode = false, stableBlockSceneIds = [], stableBlockColor = '', stableBlocks = [] }) {
  const stableBlockIdList = asArray(stableBlockSceneIds).map(cleanId).filter(Boolean)
  const stableBlockIds = new Set(stableBlockIdList)
  const stableBlockOrder = new Map(stableBlockIdList.map((sceneId, index) => [sceneId, index + 1]))

  const savedStableSceneByIdV204F6 = new Map()
  if (stableMode) {
    asArray(stableBlocks).forEach((block, blockIndex) => {
      const blockNumber = blockIndex + 1
      stableBlockSceneIdsV204F4(block).forEach((sceneId, sceneIndex) => {
        const id = cleanId(sceneId)
        if (id && !savedStableSceneByIdV204F6.has(id)) {
          savedStableSceneByIdV204F6.set(id, { block, blockNumber, sceneIndex: sceneIndex + 1 })
        }
      })
    })
  }

  return (
    <div className="avaAudioSceneStrip" aria-label="Сцены Audio Studio">
      {asArray(scenes).map((scene, index) => {
        const sceneId = cleanId(scene.id || scene.sceneId)
        const active = sceneId === cleanId(selectedSceneId)
        const inStableBlock = stableMode && stableBlockIds.has(sceneId)
        const savedStableInfoV204F6 = stableMode ? savedStableSceneByIdV204F6.get(sceneId) : null
        const stableIndex = savedStableInfoV204F6?.blockNumber || stableBlockOrder.get(sceneId)
        const sceneStableColorV204F6 = inStableBlock && stableBlockColor
          ? stableBlockColor
          : (savedStableInfoV204F6?.block?.color || scene.color || '#62d8ff')
        return (
          <button
            key={scene.id || index}
            type="button"
            className={`avaAudioScenePill ${active ? 'isActive' : ''} ${scene.appliedVariantId ? 'isApplied' : ''} ${savedStableInfoV204F6 ? 'isSavedStableBlockV204F6' : ''} ${inStableBlock ? 'isStableBlockV204F1' : ''}`}
            style={{ '--scene-color': sceneStableColorV204F6 }}
            onClick={(event) => onSelect(scene.id || scene.sceneId, event)}
          >
            {stableMode && stableIndex ? <em className="avaAudioStablePillIndexV204F3">{stableIndex}</em> : null}
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


function audioJsonFileStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
}

function sceneImportKey(scene = {}, index = 0) {
  return firstText(scene.id, scene.sceneId, scene.scene_id, scene.segId, scene.seg_id, scene.key, `index_${index}`)
}

function normalizeImportedSceneItem(item, index = 0) {
  if (typeof item === 'string') {
    return { index, prompt: item }
  }
  if (!item || typeof item !== 'object') return null
  return {
    ...item,
    id: firstText(item.id, item.sceneId, item.scene_id, item.segId, item.seg_id, item.key),
    sceneId: firstText(item.sceneId, item.scene_id, item.id, item.segId, item.seg_id, item.key),
    index: Number.isFinite(Number(item.index ?? item.sceneIndex ?? item.scene_index ?? item.order))
      ? Number(item.index ?? item.sceneIndex ?? item.scene_index ?? item.order)
      : index,
    prompt: firstText(item.prompt, item.mmaudio_prompt, item.mmaudioPrompt, item.sound_prompt, item.soundPrompt, item.foley_prompt, item.foleyPrompt),
    negativePrompt: firstText(item.negativePrompt, item.negative_prompt, item.mmaudio_negative_prompt, item.mmaudioNegativePrompt, item.negative_sound_prompt, item.negativeSoundPrompt),
    mmaudioVolume: item.mmaudioVolume ?? item.mmaudio_volume ?? item.volume ?? item.mmaudioGain ?? item.mmaudio_gain,
    variants: Array.isArray(item.variants) ? item.variants : null,
  }
}

function extractImportedScenes(payload = {}) {
  if (Array.isArray(payload)) return payload.map(normalizeImportedSceneItem).filter(Boolean)
  if (!payload || typeof payload !== 'object') return []
  const direct = payload.scenes || payload.audioScenes || payload.scenePrompts || payload.prompts || payload.mmaudioPrompts
  if (Array.isArray(direct)) return direct.map(normalizeImportedSceneItem).filter(Boolean)

  const keyed = payload.byScene || payload.scenesById || payload.promptsByScene || payload.prompts_by_scene
  if (keyed && typeof keyed === 'object' && !Array.isArray(keyed)) {
    return Object.entries(keyed).map(([key, value], index) => {
      if (typeof value === 'string') return normalizeImportedSceneItem({ id: key, sceneId: key, prompt: value, index }, index)
      if (value && typeof value === 'object') return normalizeImportedSceneItem({ id: key, sceneId: key, ...value, index }, index)
      return null
    }).filter(Boolean)
  }
  return []
}

function buildAudioStudioExportPayload(snapshot = {}, projectId = '') {
  return {
    schema: 'ava_audio_studio_import_export_v1',
    version: VERSION,
    stage: STAGE,
    projectId: projectId || '',
    exportedAt: nowIso(),
    note: 'Full Audio Studio page JSON. For prompt-only import use schema ava_audio_studio_prompt_plan_v1 with scenes[].prompt.',
    selectedSceneId: snapshot.selectedSceneId || '',
    stableAudio: snapshot.stableAudio || {},
    stableBlocks: asArray(snapshot.stableBlocks).map(exportStableBlockForAudioStudioV204H2),
    appliedStableAudioBlocks: asArray(snapshot.stableBlocks)
      .map(exportStableBlockForAudioStudioV204H2)
      .filter((block) => block.appliedStableAudio || block.applied_stable_audio || block.assemblyReady || block.assembly_ready),
    scenes: asArray(snapshot.scenes).map((scene, index) => ({
      id: scene.id || scene.sceneId || `seg_${String(index + 1).padStart(2, '0')}`,
      sceneId: scene.sceneId || scene.id || `seg_${String(index + 1).padStart(2, '0')}`,
      index: Number.isFinite(Number(scene.index)) ? Number(scene.index) : index,
      title: scene.title || `Сцена ${index + 1}`,
      color: scene.color || '',
      startSec: Number(scene.startSec || 0),
      endSec: Number(scene.endSec || 0),
      durationSec: Number(scene.durationSec || 0),
      route: scene.route || '',
      prompt: scene.prompt || '',
      negativePrompt: scene.negativePrompt || DEFAULT_NEGATIVE,
      mmaudioVolume: Number(scene.mmaudioVolume ?? DEFAULT_MMAUDIO_VOLUME_PERCENT_V204G14),
      selectedVariantId: scene.selectedVariantId || '',
      appliedVariantId: scene.appliedVariantId || '',
      sourceVideo: scene.sourceVideo || {},
      sourceAudio: scene.sourceAudio || {},
      variants: asArray(scene.variants),
    })),
  }
}

function applyAudioStudioImportedJson(current = {}, imported = {}, projectId = '') {
  const importedScenes = extractImportedScenes(imported)
  const importedSchema = cleanId(imported?.schema).toLowerCase()
  const importMode = cleanId(imported?.importMode || imported?.mode).toLowerCase()
  const replaceVariants = importedSchema.includes('import_export')
    || importedSchema.includes('scene_snapshot')
    || importMode.includes('full')
    || Boolean(imported?.replaceVariants)
  const replaceSceneMeta = replaceVariants || Boolean(imported?.replaceSceneMeta)

  if (!importedScenes.length && Array.isArray(imported?.scenes) && !asArray(current.scenes).length) {
    return {
      snapshot: {
        ...current,
        ...imported,
        version: VERSION,
        stage: STAGE,
        projectId: projectId || imported.projectId || '',
        updatedAt: nowIso(),
      },
      stats: { matched: 0, imported: asArray(imported.scenes).length, mode: 'full_empty_restore' },
    }
  }

  const byId = new Map()
  const byIndex = new Map()
  importedScenes.forEach((item, index) => {
    const normalized = normalizeImportedSceneItem(item, index)
    if (!normalized) return
    const id = cleanId(normalized.id || normalized.sceneId)
    if (id) byId.set(id, normalized)
    if (Number.isFinite(Number(normalized.index))) byIndex.set(Number(normalized.index), normalized)
  })

  let matched = 0
  const scenes = asArray(current.scenes).map((scene, index) => {
    const keys = [scene.id, scene.sceneId, scene.scene_id, scene.segId, scene.seg_id].map(cleanId).filter(Boolean)
    let importedScene = null
    for (const key of keys) {
      if (byId.has(key)) {
        importedScene = byId.get(key)
        break
      }
    }
    if (!importedScene) importedScene = byIndex.get(Number(scene.index ?? index))
    if (!importedScene) return scene
    matched += 1

    const hasPrompt = Object.prototype.hasOwnProperty.call(importedScene, 'prompt') && cleanId(importedScene.prompt)
    const hasNegative = Object.prototype.hasOwnProperty.call(importedScene, 'negativePrompt') && cleanId(importedScene.negativePrompt)
    const hasVolume = importedScene.mmaudioVolume !== undefined && importedScene.mmaudioVolume !== null && importedScene.mmaudioVolume !== ''
    const volume = hasVolume ? Math.max(0, Math.min(150, Number(importedScene.mmaudioVolume) || 0)) : scene.mmaudioVolume
    const importedVariants = Array.isArray(importedScene.variants) ? importedScene.variants : null
    const variants = sortAudioVariantsV204C5(replaceVariants && importedVariants ? importedVariants : asArray(scene.variants))
    const nextAppliedId = replaceVariants ? (importedScene.appliedVariantId || scene.appliedVariantId || '') : scene.appliedVariantId
    const nextSelectedId = replaceVariants ? (importedScene.selectedVariantId || nextAppliedId || variants[0]?.id || '') : scene.selectedVariantId

    return {
      ...scene,
      ...(replaceSceneMeta ? {
        title: importedScene.title || scene.title,
        color: importedScene.color || scene.color,
        startSec: importedScene.startSec ?? scene.startSec,
        endSec: importedScene.endSec ?? scene.endSec,
        durationSec: importedScene.durationSec ?? scene.durationSec,
        route: importedScene.route || scene.route,
        sourceVideo: importedScene.sourceVideo || scene.sourceVideo,
        sourceAudio: importedScene.sourceAudio || scene.sourceAudio,
      } : {}),
      prompt: hasPrompt ? importedScene.prompt : scene.prompt,
      negativePrompt: hasNegative ? importedScene.negativePrompt : scene.negativePrompt,
      mmaudioVolume: volume,
      variants,
      selectedVariantId: nextSelectedId,
      appliedVariantId: nextAppliedId,
      status: nextAppliedId ? 'applied' : (variants.length ? 'variants' : scene.status),
      importedAt: nowIso(),
    }
  })

  return {
    snapshot: {
      ...current,
      selectedSceneId: imported.selectedSceneId || current.selectedSceneId || scenes[0]?.id || '',
      stableAudio: imported.stableAudio && replaceVariants ? imported.stableAudio : current.stableAudio,
      stableBlocks: Array.isArray(imported.stableBlocks) && replaceVariants ? asArray(imported.stableBlocks) : asArray(current.stableBlocks),
      appliedStableAudioBlocks: Array.isArray(imported.appliedStableAudioBlocks) && replaceVariants ? asArray(imported.appliedStableAudioBlocks) : asArray(current.appliedStableAudioBlocks),
      queue: imported.queue && replaceVariants ? imported.queue : current.queue,
      scenes,
      version: VERSION,
      stage: STAGE,
      projectId: projectId || current.projectId || imported.projectId || '',
      updatedAt: nowIso(),
      lastImportAt: nowIso(),
    },
    stats: { matched, imported: importedScenes.length, mode: replaceVariants ? 'full' : 'prompts' },
  }
}


// V204G12B_STAU_VOLUME100_DRAG_SAVE
// V204G7B_STAU_AUDIO_BLOB_PLAYER_DELETE
function StableAudioAssetPlayerV204G7B({ source = '', title = 'STAU', className = '', volumePercent = DEFAULT_STAU_VOLUME_PERCENT_V204G18 }) {
  const audioRef = useRef(null)
  const [blobUrl, setBlobUrl] = useState('')
  const [error, setError] = useState('')
  const cleanSource = cleanId(source)
  const safeVolume = stableAudioVolumeV204F7(volumePercent, DEFAULT_STAU_VOLUME_PERCENT_V204G18)
  const uiVolumeV204H10 = normalizeAudioStudioUiVolume01V204H10C(safeVolume / 100, DEFAULT_STAU_VOLUME_PERCENT_V204G18 / 100)
  const applyStableAudioPlayerVolumeV204H10 = useCallback((node = audioRef.current) => {
    return setAudioStudioMediaVolumeV204H10(node, uiVolumeV204H10, DEFAULT_STAU_VOLUME_PERCENT_V204G18 / 100)
  }, [uiVolumeV204H10])

  useEffect(() => {
    applyStableAudioPlayerVolumeV204H10()
  }, [applyStableAudioPlayerVolumeV204H10, blobUrl, cleanSource])

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

  const shouldFetch = /\/(api\/)?assets\/[^/]+\/file/i.test(cleanSource)
  const src = shouldFetch ? blobUrl : (cleanSource ? buildApiUrl(cleanSource) : '')

  if (!cleanSource) return <div className="avaAudioStableAudioEmptyV204G7B">нет audio asset</div>
  if (shouldFetch && !blobUrl && !error) return <div className="avaAudioStableAudioEmptyV204G7B isLoading">загружаю STAU…</div>
  if (error) return <div className="avaAudioStableAudioEmptyV204G7B isError">STAU недоступен: {error}</div>
  return (
    <audio
      ref={audioRef}
      controls
      preload="metadata"
      src={src || undefined}
      title={title}
      className={className}
      onLoadedMetadata={() => applyStableAudioPlayerVolumeV204H10()}
      onCanPlay={() => applyStableAudioPlayerVolumeV204H10()}
      onPlay={() => applyStableAudioPlayerVolumeV204H10()}
    />
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
  const [applyingVariantId, setApplyingVariantId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [clearConfirmOpenV204C8, setClearConfirmOpenV204C8] = useState(false)
  const [clearingAllV204C8, setClearingAllV204C8] = useState(false)
  const [refreshBoardConfirmOpenV204D3, setRefreshBoardConfirmOpenV204D3] = useState(false)
  const [refreshingFromBoardV204D3, setRefreshingFromBoardV204D3] = useState(false)
  const [audioStudioModeV204F1, setAudioStudioModeV204F1] = useState('mmaudio')
  const [stableManualSelectionV204F2, setStableManualSelectionV204F2] = useState([])
  const [stableDraftBlockTitleV204F3, setStableDraftBlockTitleV204F3] = useState('')
  const [activeStableBlockIdV204F4, setActiveStableBlockIdV204F4] = useState('')
  const [stableDraftPromptV204F7, setStableDraftPromptV204F7] = useState('')
  const [stableDraftNegativePromptV204F7, setStableDraftNegativePromptV204F7] = useState(STABLE_AUDIO_DEFAULT_NEGATIVE_V204F7)
  const [stableDraftModeV204F7, setStableDraftModeV204F7] = useState('Music')
  const [stableDraftVolumeV204F7, setStableDraftVolumeV204F7] = useState(16)
  const [stableDraftFadeInSecV204F7, setStableDraftFadeInSecV204F7] = useState(0.35)
  const [stableDraftFadeOutSecV204F7, setStableDraftFadeOutSecV204F7] = useState(0.8)
  // V204G1_STABLE_BLOCK_PREVIEW_MP4
  const [stableBlockPreviewVideoV204G1, setStableBlockPreviewVideoV204G1] = useState(null)
  const [stableBlockPreviewLoadingV204G1, setStableBlockPreviewLoadingV204G1] = useState(false)
  // V204G6_STABLE_AUDIO_GENERATE_VARIANTS
  const [stableAudioGeneratingV204G6, setStableAudioGeneratingV204G6] = useState(false)
  const [stableAudioApplyingV204H1, setStableAudioApplyingV204H1] = useState(false)
  // V204G13_STAU_VOLUME_DRAFT_APPLY_PREVIEW: slider is local until preview/apply
  const [stableAudioVolumeDraftsV204G13, setStableAudioVolumeDraftsV204G13] = useState({})
  // V204H13_AUDIO_SELECTION_LIVE_REFS: Build/Apply must use latest clicked variant and latest slider value immediately.
  const stableAudioSelectedVariantIdLiveRefV204H13 = useRef('')
  // AVA_AUDIO_STUDIO_STABLE_BLOCK_SELECTION_LOGIC_V211V: selected STAU variant belongs to one Stable block.
  const stableAudioSelectedVariantBlockIdLiveRefV211V = useRef('')
  const stableAudioVolumeDraftsLiveRefV204H13 = useRef({})
  const mmaudioSelectedVariantIdLiveRefV204H13 = useRef('')
  const mmaudioVolumeLiveRefV204H13 = useRef(DEFAULT_MMAUDIO_VOLUME_PERCENT_V204G14)
  const mmaudioBusyRefV211Y2 = useRef(false)
  // V204G4_STABLE_PREVIEW_BUTTON_UI_RECOVERY
  const [stableBlockPreviewUiPhaseV204G4, setStableBlockPreviewUiPhaseV204G4] = useState('idle')
  const [stableBlockPreviewUiNonceV204G4, setStableBlockPreviewUiNonceV204G4] = useState(0)
  // V204G9_STABLE_PREVIEW_FLOW_CLEANUP
  const [stableBlockPreviewPlayKeyV204G9, setStableBlockPreviewPlayKeyV204G9] = useState('')
  // V211D_PREVIEW_MAP_NOTES: live time for scene-number overlay in Preview / Разметка.
  const [previewMapCurrentTimeV211D, setPreviewMapCurrentTimeV211D] = useState(0)
  const previewMapNotesTextareaRefV211M = useRef(null)
  // V211E_PREVIEW_FULL_PROJECT_MAP: full assembly video used as a scene-number map.
  const [previewFullProjectLoadingV211E, setPreviewFullProjectLoadingV211E] = useState(false)
  // V204G8B_PREVIEW_BUTTON_RESET_NO_ANCHOR
  useEffect(() => {
    if (stableBlockPreviewUiPhaseV204G4 !== 'ready') return undefined
    const timer = window.setTimeout(() => {
      setStableBlockPreviewUiPhaseV204G4((phase) => (phase === 'ready' ? 'idle' : phase))
    }, 1600)
    return () => window.clearTimeout(timer)
  }, [stableBlockPreviewUiPhaseV204G4])


  const pollRef = useRef(null)
  const snapshotRef = useRef(snapshot)
  const initialLoadDoneRefV204B = useRef(false)
  const didLoadRef = useRef(false)
  const autosaveTimerRef = useRef(null)
  // AVA_AUDIO_STUDIO_STABLE_AUDIO_FAST_SUBMIT_V211S
  // While Stable Audio is being submitted/waited, do not let the 850ms generic
  // autosave start extra /snapshots/audio_studio POSTs. Those saves were
  // competing with the generate request and made STAU feel like it was sent late.
  const stableAudioGenerateBusyRefV211S = useRef(false)
  // AVA_AUDIO_STUDIO_STABLE_PREVIEW_FAST_422_V211T
  // Guard Stable block preview build from double-clicks and from autosave races.
  const stablePreviewBlockBusyRefV211T = useRef(false)
  const importInputRefV204B2 = useRef(null)
  const timingAudioPreparePromisesRefV204E10 = useRef({})
  const timingAudioPlaybackRefV204E10 = useRef(null)
  const timingAudioPlaybackBlobUrlRefV204E10 = useRef('')
  const timingAudioPlaybackStopTimerRefV204E10 = useRef(null)
  const timingAudioAutoWarmKeyRefV204E10 = useRef('')
  const [timingAudioPreparingSceneIdV204E10, setTimingAudioPreparingSceneIdV204E10] = useState('')
  const [timingAudioMixPlayingV204E10, setTimingAudioMixPlayingV204E10] = useState(false)
  const timingSliceAudioRefV204E9 = useRef(null)
  const timingSliceBlobUrlRefV204E9 = useRef('')
  const timingSliceStopTimerRefV204E9 = useRef(null)
  const [timingSliceMixPlayingV204E9, setTimingSliceMixPlayingV204E9] = useState(false)
  const [timingSliceMixPreparingV204E9, setTimingSliceMixPreparingV204E9] = useState(false)
  const timingMixAudioNodeRefV204E8 = useRef(null)
  const timingMixBlobUrlRefV204E8 = useRef('')
  const timingMixStopTimerRefV204E8 = useRef(null)
  const [timingMixPlayingV204E8, setTimingMixPlayingV204E8] = useState(false)
  const [timingMixPreparingV204E8, setTimingMixPreparingV204E8] = useState(false)
  const mixTimingAudioRefV204E7 = useRef(null)
  const mixPlaybackTimerRefV204E7 = useRef(null)
  const [mixTimingAudioSrcV204E7, setMixTimingAudioSrcV204E7] = useState('')
  const [mixPreviewPlayingV204E7, setMixPreviewPlayingV204E7] = useState(false)
  const mixPreviewNodesRefV204E5A = useRef([])
  const projectApiRef = useRef({ loadStage, saveStage, loadWorkspaceStage, saveWorkspaceStage })

  useEffect(() => { snapshotRef.current = snapshot }, [snapshot])
  // AUDIO_STUDIO_STOP_MIX_V204E10
  useEffect(() => () => {
    try { timingAudioPlaybackRefV204E10.current?.pause?.() } catch {}
    if (timingAudioPlaybackStopTimerRefV204E10.current) clearTimeout(timingAudioPlaybackStopTimerRefV204E10.current)
    if (timingAudioPlaybackBlobUrlRefV204E10.current) {
      try { URL.revokeObjectURL(timingAudioPlaybackBlobUrlRefV204E10.current) } catch {}
    }
  }, [])

  // AUDIO_STUDIO_STOP_TIMING_SLICE_MIX_V204E9
  useEffect(() => () => {
    try { timingSliceAudioRefV204E9.current?.pause?.() } catch {}
    if (timingSliceStopTimerRefV204E9.current) clearTimeout(timingSliceStopTimerRefV204E9.current)
    if (timingSliceBlobUrlRefV204E9.current) {
      try { URL.revokeObjectURL(timingSliceBlobUrlRefV204E9.current) } catch {}
    }
  }, [])

  // AUDIO_STUDIO_STOP_TIMING_SLICE_MIX_V204E8
  useEffect(() => () => {
    try { timingMixAudioNodeRefV204E8.current?.pause?.() } catch {}
    if (timingMixStopTimerRefV204E8.current) clearTimeout(timingMixStopTimerRefV204E8.current)
    if (timingMixBlobUrlRefV204E8.current) {
      try { URL.revokeObjectURL(timingMixBlobUrlRefV204E8.current) } catch {}
    }
  }, [])

  // AUDIO_STUDIO_STOP_MIX_BUTTON_PLAYER_V204E7
  useEffect(() => () => {
    try { mixTimingAudioRefV204E7.current?.pause?.() } catch {}
    if (mixPlaybackTimerRefV204E7.current) clearTimeout(mixPlaybackTimerRefV204E7.current)
  }, [])

  // AUDIO_STUDIO_STOP_HIDDEN_MIX_V204E5A
  useEffect(() => () => {
    asArray(mixPreviewNodesRefV204E5A.current).forEach((item) => {
      try { item?.node?.pause?.() } catch {}
      try { if (item?.blobUrl) URL.revokeObjectURL(item.blobUrl) } catch {}
    })
    mixPreviewNodesRefV204E5A.current = []
  }, [])

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

  // V204H13_AUDIO_SELECTION_LIVE_REFS: keep latest MMAudio choice visible to Apply even on immediate clicks.
  mmaudioSelectedVariantIdLiveRefV204H13.current = cleanId(selectedScene?.selectedVariantId || selectedVariant?.id || mmaudioSelectedVariantIdLiveRefV204H13.current || '')
  mmaudioVolumeLiveRefV204H13.current = Math.max(0, Math.min(150, Number(selectedScene?.mmaudioVolume ?? selectedVariant?.volume ?? mmaudioVolumeLiveRefV204H13.current ?? DEFAULT_MMAUDIO_VOLUME_PERCENT_V204G14) || DEFAULT_MMAUDIO_VOLUME_PERCENT_V204G14))

  const appliedVariant = useMemo(() => {
    if (!selectedScene) return null
    return asArray(selectedScene.variants).find((variant) => cleanId(variant.id) === cleanId(selectedScene.appliedVariantId)) || null
  }, [selectedScene])

  const manualSceneControlsVisibleV204C7 = useMemo(() => canUseManualSceneControlsV204C7(snapshot), [snapshot])

  const saveSnapshot = useCallback(async (nextSnapshot, reason = 'save') => {
    const cleanSnapshot = sanitizeAudioSnapshot(nextSnapshot)
    const payload = {
      ...cleanSnapshot,
      version: VERSION,
      stage: STAGE,
      updatedAt: nowIso(),
      lastSaveReason: reason,
    }
    rememberAudioSnapshotSafeBackupV204B9(payload, projectId || 'workspace')
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
    // AVA_AUDIO_STUDIO_STAU_APPLY_ASSEMBLY_FAST_PREVIEW_V211X
    // While Stable block preview is assembling, skip noisy autosaves/UI saves.
    // The final preview save and explicit Apply save are allowed.
    const reasonTextV211X = String(reason || '')
    if (stablePreviewBlockBusyRefV211T.current && !['stable_block_preview_v204g5', 'stable_audio_variant_applied_v204h1'].includes(reasonTextV211X)) {
      console.info('[AUDIO STUDIO SNAPSHOT SKIPPED DURING STABLE PREVIEW V211X]', { reason })
      return false
    }
    if ((stableAudioGenerateBusyRefV211S.current || stablePreviewBlockBusyRefV211T.current) && reasonTextV211X.startsWith('autosave_')) {
      console.info('[AUDIO STUDIO AUTOSAVE SKIPPED DURING STAU/PREVIEW V211T]', { reason })
      return false
    }
    const payload = {
      ...nextSnapshot,
      version: VERSION,
      stage: STAGE,
      updatedAt: nowIso(),
      lastSaveReason: reason,
    }
    rememberAudioSnapshotSafeBackupV204B9(payload, projectId || 'workspace')
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
    if (stableAudioGenerateBusyRefV211S.current || stablePreviewBlockBusyRefV211T.current) return undefined
    if (mmaudioBusyRefV211Y2?.current) {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
      console.info('[AUDIO STUDIO MMAUDIO AUTOSAVE SKIPPED V211Y2]', { reason: 'mmaudio_busy' })
      return undefined
    }
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(() => {
      persistSnapshotSilently(sanitizeAudioSnapshot(snapshotRef.current), 'autosave_v204b8')
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
      if (!initialLoadDoneRefV204B.current) setLoading(true)
      setLoadMessage('Открываю Audio Studio…')
      setError('')
      try {
        const stateBoard = location.state?.board && typeof location.state.board === 'object' ? location.state.board : null
        const requestedForceImportV204B7 = Boolean(location.state?.forceImportFromBoard && stateBoard)
        const importTokenV204B7 = firstText(
          location.state?.workflowEntry?.id,
          location.state?.workflowEntry?.createdAt,
          stateBoard?.updatedAt,
          stateBoard?.source,
          location.state?.source,
          'board_import'
        )
        const consumedKeyV204B7 = `ava_audio_studio_import_consumed_${projectId || 'workspace'}_${importTokenV204B7}`
        let importAlreadyConsumedV204B7 = false
        try { importAlreadyConsumedV204B7 = sessionStorage.getItem(consumedKeyV204B7) === '1' } catch {}
        const forceImport = requestedForceImportV204B7 && !importAlreadyConsumedV204B7
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
        if (!forceImport) {
          const localSafeSnapshotV204B9 = readAudioSnapshotSafeBackupV204B9(projectId || 'workspace')
          const safeChoiceV204B9 = chooseSaferAudioSnapshotV204B9(next, localSafeSnapshotV204B9)
          if (safeChoiceV204B9.usedLocal) {
            next = safeChoiceV204B9.snapshot
            shouldPersist = true
            console.warn('[AUDIO STUDIO SAFE SNAPSHOT RESTORE V204B9]', {
              serverScore: safeChoiceV204B9.serverScore,
              localScore: safeChoiceV204B9.localScore,
            })
            setStatus('Audio Studio восстановлена из локального safe-backup: сохранены варианты и применённые MMAudio')
          }
        }

        if (forceImport && stateBoard) {
          next = buildAudioSnapshotFromBoard(stateBoard, { projectId, source: 'board_reset_import_v204b8' })
          next.boardImportToken = importTokenV204B7
          next.boardImportConsumedAt = nowIso()
          shouldPersist = true
          try { sessionStorage.setItem(consumedKeyV204B7, '1') } catch {}
          try {
            navigate(location.pathname, {
              replace: true,
              state: { workflowEntry: location.state?.workflowEntry || null, source: 'audio_studio_loaded' },
            })
          } catch {}
          forgetAudioSnapshotSafeBackupV204B9(projectId || 'workspace')
          setStatus(`Audio Studio очищена и заново перенесена из Доски: ${asArray(next.scenes).length} сцен`)
        } else if (asArray(next.scenes).length) {
          // V204B8: on regular open/F5, Audio Studio snapshot is the source of truth.
          // Do not auto-merge with Board here: Board may still contain old/current scene refs and
          // that was wiping generated variants/applied state after F5.
          setLoadMessage('Восстанавливаю сохранённую Audio Studio…')
          setStatus(`Audio Studio восстановлена из snapshot: ${asArray(next.scenes).length} сцен`)
          shouldPersist = false
        } else {
          // V204B9: never auto-import Board on normal open/F5.
          // Coming back from Assembly or browser refresh must not wipe Audio Studio variants.
          setLoadMessage('Audio Studio пустая — жду явный импорт из Доски…')
          next = {
            version: VERSION,
            schema: 'ava_audio_studio_scene_snapshot_v1',
            stage: STAGE,
            source: 'empty_audio_studio_no_auto_board_import_v204b9',
            projectId: projectId || '',
            selectedSceneId: '',
            scenes: [],
            stableAudio: { enabled: false, status: 'soon' },
            queue: { enabled: false, items: [] },
            updatedAt: nowIso(),
          }
          shouldPersist = false
          setStatus('Audio Studio пустая. Нажми “Обновить из Доски”, если нужно заново перенести сцены.')
        }

        next = sanitizeAudioSnapshot(next)
        if (!next.version) next.version = VERSION
        if (!next.stage) next.stage = STAGE
        if (!next.selectedSceneId && asArray(next.scenes).length) next.selectedSceneId = next.scenes[0].id
        if (shouldPersist) {
          setLoadMessage('Сохраняю Audio Studio, чтобы F5 держал сцены…')
          await persistSnapshotSilently(sanitizeAudioSnapshot(next), forceImport ? 'board_import_persist_v204b8' : 'board_auto_import_empty_audio_v204b8')
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

  const refreshFromBoard = useCallback(() => {
    setError('')
    setRefreshBoardConfirmOpenV204D3(true)
    setStatus('Подтверди обновление Audio Studio из Доски.')
  }, [])

  const confirmRefreshFromBoardV204D3 = useCallback(async () => {
    if (refreshingFromBoardV204D3) return
    setRefreshingFromBoardV204D3(true)
    setError('')
    setStatus('Обновляю Audio Studio из Доски…')
    try {
      const boardData = workspaceMode ? await loadWorkspaceStage('board') : await loadStage(projectId, 'board')
      if (!asArray(boardData?.scenes).length) {
        setStatus('В Доске нет сцен для переноса')
        return
      }
      const next = buildAudioSnapshotFromBoard(boardData, { projectId, source: 'board_manual_reset_import_v204d3' })
      await saveSnapshot(next, 'refresh_from_board_reset_v204d3')
      setRefreshBoardConfirmOpenV204D3(false)
      setStatus(`Audio Studio очищена и заново перенесена из Доски: ${asArray(next.scenes).length} сцен`)
    } catch (err) {
      setError(`Не удалось обновить из Доски: ${err?.message || err}`)
    } finally {
      setRefreshingFromBoardV204D3(false)
    }
  }, [loadStage, loadWorkspaceStage, projectId, refreshingFromBoardV204D3, saveSnapshot, workspaceMode])


  const performClearAllAudioStudioV204C8 = useCallback(async () => {
    setClearingAllV204C8(true)
    setError('')
    try {
      forgetAudioSnapshotSafeBackupV204B9(projectId || 'workspace')
      const next = {
        version: VERSION,
        schema: 'ava_audio_studio_scene_snapshot_v1',
        stage: STAGE,
        source: 'manual_clear_v204c8',
        projectId: projectId || '',
        selectedSceneId: '',
        scenes: [],
        stableAudio: { enabled: false, status: 'soon' },
        queue: { enabled: false, items: [] },
        updatedAt: nowIso(),
      }
      await saveSnapshot(next, 'clear_all_audio_studio_v204c8')
      setStatus('Audio Studio очищена')
      setClearConfirmOpenV204C8(false)
    } catch (err) {
      setError(`Не удалось очистить Audio Studio: ${err?.message || err}`)
    } finally {
      setClearingAllV204C8(false)
    }
  }, [projectId, saveSnapshot])

  const clearAllAudioStudioV204B5 = useCallback(() => {
    setError('')
    setClearConfirmOpenV204C8(true)
  }, [])

  const addManualSceneV204C6 = useCallback(async () => {
    if (typeof canUseManualSceneControlsV204C7 === 'function' && !canUseManualSceneControlsV204C7(snapshotRef.current || {})) {
      setError('Ручные сцены доступны только в пустой/ручной Audio Studio. Если пришёл из Доски — сначала нажми “Очистить всё”.')
      return
    }
    setError('')
    try {
      const current = sanitizeAudioSnapshot(snapshotRef.current || {})
      const scenes = asArray(current.scenes)
      const scene = buildManualAudioSceneV204C6(scenes.length)
      const next = sanitizeAudioSnapshot({
        ...current,
        source: 'manual_scene_added_v204c8a',
        projectId: projectId || current.projectId || '',
        scenes: [...scenes, scene],
        selectedSceneId: scene.id,
        updatedAt: nowIso(),
      })
      await saveSnapshot(next, 'manual_scene_added_v204c8a')
      setStatus(`Добавлена ${scene.title}. Загрузи видео слева и генерируй MMAudio.`)
    } catch (err) {
      setError(`Не удалось добавить сцену: ${err?.message || err}`)
    }
  }, [projectId, saveSnapshot])

  const deleteSelectedSceneV204C6 = useCallback(async () => {
    if (!selectedScene) return
    if (typeof canUseManualSceneControlsV204C7 === 'function' && !canUseManualSceneControlsV204C7(snapshotRef.current || {})) {
      setError('Удаление сцен вручную скрыто для импорта из Доски, чтобы не смешать Board и ручные сцены.')
      return
    }
    setError('')
    try {
      const current = sanitizeAudioSnapshot(snapshotRef.current || {})
      const scenes = asArray(current.scenes)
      const selectedId = cleanId(selectedScene.id)
      const selectedIndex = Math.max(0, scenes.findIndex((scene) => cleanId(scene.id) === selectedId))
      const remaining = scenes.filter((scene) => cleanId(scene.id) !== selectedId).map((scene, index) => ({
        ...scene,
        index,
      }))
      const nextSelected = remaining[Math.min(selectedIndex, Math.max(0, remaining.length - 1))]?.id || ''
      const next = sanitizeAudioSnapshot({
        ...current,
        source: 'manual_scene_deleted_v204c8a',
        scenes: remaining,
        selectedSceneId: nextSelected,
        updatedAt: nowIso(),
      })
      await saveSnapshot(next, 'manual_scene_deleted_v204c8a')
      setStatus(`Сцена удалена. Осталось сцен: ${remaining.length}`)
    } catch (err) {
      setError(`Не удалось удалить сцену: ${err?.message || err}`)
    }
  }, [saveSnapshot, selectedScene])

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
      mmaudioBusyRefV211Y2.current = false
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
        if (output) console.info('[AUDIO STUDIO MMAUDIO RESULT ATTACH V204B1]', { sceneId, mode: 'poll', output })
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
          label: nextMmaudioVariantLabelV204B4(snapshotRef.current.scenes.find((s) => cleanId(s.id) === cleanId(sceneId))),
          url: ref.url,
          apiPath: ref.apiPath,
          assetId: ref.assetId,
          rawUrl: ref.url,
          rawApiPath: ref.apiPath,
          rawAssetId: ref.assetId,
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
              variants: sortAudioVariantsV204C5(uniqueVariantsV204B4([...asArray(scene.variants), variant])).slice(0, 48),
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
    pollRef.current = setInterval(tick, 1100)
  }, [patchScene, saveSnapshot])

  const submitMmaudio = useCallback(async () => {
    if (!selectedScene) return
    const sceneId = selectedScene.id
    const sourceVideo = sourceVideoForMmaudioV204B7(selectedScene)
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
    mmaudioBusyRefV211Y2.current = true
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    pauseAudioStudioMediaV204H7()
    console.info('[AUDIO STUDIO MMAUDIO FAST SUBMIT V211Y2]', { sceneId, durationSec: selectedScene.durationSec || 5 })
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
      if (output) console.info('[AUDIO STUDIO MMAUDIO RESULT ATTACH V204B1]', { sceneId, mode: 'direct', output })
      patchScene(sceneId, (scene) => ({ ...scene, jobId, jobStatus: firstText(data.status, 'queued'), status: firstText(data.status, 'queued') }))
      if (output && !jobId) {
        const ref = normalizeRef(output)
        const variantId = makeId('mmaudio')
        const variant = {
          id: variantId,
          kind: 'mmaudio_video',
          label: nextMmaudioVariantLabelV204B4(selectedScene),
          url: ref.url,
          apiPath: ref.apiPath,
          assetId: ref.assetId,
          prompt,
          negativePrompt,
          volume: selectedScene.mmaudioVolume ?? DEFAULT_MMAUDIO_VOLUME_PERCENT_V204G14,
          rawMode: true,
          steps: 25,
          cfg: 3,
          createdAt: nowIso(),
          response: data,
        }
        const next = {
          ...snapshotRef.current,
          scenes: asArray(snapshotRef.current.scenes).map((scene) => cleanId(scene.id) === cleanId(sceneId)
            ? { ...scene, status: 'variants', jobId: '', jobStatus: '', selectedVariantId: variantId, mmaudioVolume: variant.volume, variants: uniqueVariantsV204B4([variant, ...asArray(scene.variants)]).slice(0, 48) }
            : scene),
        }
        await saveSnapshot(next, 'mmaudio_completed_direct_v204a')
        mmaudioBusyRefV211Y2.current = false
        setGeneratingSceneId('')
        setStatus('MMAudio готово — вариант добавлен в ленту')
        return
      }
      if (jobId) {
        pollMmaudioJob(jobId, sceneId, { prompt, negativePrompt, volume: selectedScene.mmaudioVolume ?? DEFAULT_MMAUDIO_VOLUME_PERCENT_V204G14 })
      } else {
        setGeneratingSceneId('')
        throw new Error('MMAudio не вернул job_id')
      }
    } catch (err) {
      mmaudioBusyRefV211Y2.current = false
      setGeneratingSceneId('')
      patchScene(sceneId, (scene) => ({ ...scene, jobId: '', jobStatus: '', status: 'error' }))
      setError(`Не удалось отправить в MMAudio: ${err?.message || err}`)
    }
  }, [patchScene, pollMmaudioJob, projectId, selectedScene])

  const syncAppliedToBoard = useCallback(async (scene, variant) => {
    const appliedMediaV204C3 = variantAppliedMediaRefV204C3(variant)
    const ref = normalizeRef(firstText(appliedMediaV204C3.apiPath, appliedMediaV204C3.url, variant.apiPath, variant.url))
    if (!ref.apiPath && !ref.url) return
    try {
      const boardData = workspaceMode ? await loadWorkspaceStage('board') : await loadStage(projectId, 'board')
      const scenes = asArray(boardData.scenes).map((boardScene) => {
        const boardSceneId = firstText(boardScene.scene_id, boardScene.sceneId, boardScene.id)
        if (cleanId(boardSceneId) !== cleanId(scene.id)) return boardScene

        const originalRef = normalizeRef(boardSourceVideoRef(boardScene))
        const originalUrl = firstText(originalRef.url, originalRef.apiPath)
        const appliedUrl = ref.url || ref.apiPath
        const appliedVolume = Number(variant.volume ?? scene.mmaudioVolume ?? DEFAULT_MMAUDIO_VOLUME_PERCENT_V204G14)
        const appliedAt = nowIso()

        return {
          ...boardScene,

          // Preserve the true original scene video before making the applied MMAudio result visible in Board.
          // Future Audio Studio imports use this first, so MMAudio is not stacked on top of old MMAudio.
          mmaudio_source_video_url: originalUrl,
          mmaudioSourceVideoUrl: originalUrl,
          mmaudio_source_video_api_path: originalRef.apiPath || '',
          mmaudioSourceVideoApiPath: originalRef.apiPath || '',
          mmaudio_source_video_asset_id: originalRef.assetId || '',
          mmaudioSourceVideoAssetId: originalRef.assetId || '',

          // Make the applied result visible to Board/Assembly as the current scene video.
          video_url: appliedUrl,
          videoUrl: appliedUrl,
          video_api_path: ref.apiPath || '',
          videoApiPath: ref.apiPath || '',
          output_video_url: appliedUrl,
          outputVideoUrl: appliedUrl,
          output_video_api_path: ref.apiPath || '',
          outputVideoApiPath: ref.apiPath || '',
          result_video_url: appliedUrl,
          resultVideoUrl: appliedUrl,
          result_video_api_path: ref.apiPath || '',
          resultVideoApiPath: ref.apiPath || '',

          // Dedicated MMAudio fields for Assembly and status badges.
          mmaudio_video_url: appliedUrl,
          mmaudioVideoUrl: appliedUrl,
          mmaudio_video_api_path: ref.apiPath || '',
          mmaudioVideoApiPath: ref.apiPath || '',
          mmaudio_video_asset_id: ref.assetId || '',
          mmaudioVideoAssetId: ref.assetId || '',
          has_sound: true,
          hasSound: true,
          has_mmaudio: true,
          hasMmaudio: true,
          mmaudio_status: 'applied',
          mmaudioStatus: 'applied',
          audio_studio_status: 'mmaudio_applied',
          audioStudioStatus: 'mmaudio_applied',
          mmaudio_prompt: variant.prompt || scene.prompt || '',
          mmaudioPrompt: variant.prompt || scene.prompt || '',
          mmaudio_negative_prompt: variant.negativePrompt || scene.negativePrompt || '',
          mmaudioNegativePrompt: variant.negativePrompt || scene.negativePrompt || '',
          mmaudio_volume: appliedVolume,
          mmaudioVolume: appliedVolume,
          audio_studio_applied_variant_id: variant.id,
          audioStudioAppliedVariantId: variant.id,
          audio_studio_updated_at: appliedAt,
          audioStudioUpdatedAt: appliedAt,
          updatedAt: appliedAt,
        }
      })
      const nextBoard = { ...boardData, scenes, selectedSceneId: boardData.selectedSceneId || scene.id, updatedAt: nowIso() }
      if (workspaceMode) await saveWorkspaceStage('board', nextBoard)
      else await saveStage(projectId, 'board', nextBoard, 'replace')
      setStatus('Вариант применён: видео сцены обновлено в Доске и готово для монтажки')
    } catch (err) {
      setStatus(`Вариант применён в Audio Studio, но Доска не обновилась: ${err?.message || err}`)
    }
  }, [loadStage, loadWorkspaceStage, projectId, saveStage, saveWorkspaceStage, workspaceMode])

  const applySelectedVariant = useCallback(async () => {
    // V204H13_AUDIO_SELECTION_LIVE_REFS: Apply must use latest clicked MMAudio variant/slider immediately.
    const currentSnapshotV204H13 = sanitizeAudioSnapshot(snapshotRef.current || {})
    const selectedSceneIdV204H13 = cleanId(selectedScene?.id || currentSnapshotV204H13.selectedSceneId)
    const sceneForApplyV204H13 = asArray(currentSnapshotV204H13.scenes).find((scene) => cleanId(scene.id) === selectedSceneIdV204H13) || selectedScene || null
    const liveVariantIdV204H13 = cleanId(sceneForApplyV204H13?.selectedVariantId || mmaudioSelectedVariantIdLiveRefV204H13.current || selectedVariant?.id)
    const variantForApplyV204H13 = asArray(sceneForApplyV204H13?.variants).find((variant) => cleanId(variant.id) === liveVariantIdV204H13) || selectedVariant || null

    if (!sceneForApplyV204H13 || !variantForApplyV204H13) {
      setStatus('Сначала выбери вариант в нижней ленте')
      return
    }
    if (variantForApplyV204H13?.sourceBaseline || variantForApplyV204H13?.kind === 'source_video') {
      setStatus('Это исходник из Доски. Сгенерируй MMAudio и применяй уже MMAudio-вариант.')
      return
    }

    const applyId = variantForApplyV204H13.id
    const selectedRef = normalizeRef(firstText(variantForApplyV204H13.apiPath, variantForApplyV204H13.url))
    if (!selectedRef.apiPath && !selectedRef.url) {
      setError('У выбранного MMAudio-варианта нет video asset. Применить нечего.')
      return
    }

    setApplyingVariantId(applyId)
    setError('')
    mmaudioBusyRefV211Y2.current = true
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    pauseAudioStudioMediaV204H7()
    console.info('[AUDIO STUDIO MMAUDIO APPLY FAST V211Y2]', { sceneId: sceneForApplyV204H13.id, variantId: variantForApplyV204H13.id })
    setStatus('Применяю MMAudio вариант…')
    try {
      const volume = Math.max(0, Math.min(150, Number(mmaudioVolumeLiveRefV204H13.current ?? sceneForApplyV204H13.mmaudioVolume ?? variantForApplyV204H13.volume ?? DEFAULT_MMAUDIO_VOLUME_PERCENT_V204G14) || 0))
      setStatus(volume === 100 ? 'Применяю MMAudio вариант…' : `Применяю MMAudio вариант и запекаю громкость ${volume}%…`)
      const rawMedia = variantRawMediaRefV204C3({ ...variantForApplyV204H13, ...selectedRef })
      const appliedMedia = await bakeMmaudioVariantVolumeV204C3({
        variant: { ...variantForApplyV204H13, ...selectedRef },
        scene: sceneForApplyV204H13,
        volume,
        projectId,
      })
      const originalMedia = sceneOriginalSourceVideoV204B7(sceneForApplyV204H13)
      const nextVariant = {
        ...variantForApplyV204H13,
        rawUrl: firstText(variantForApplyV204H13.rawUrl, rawMedia.url),
        rawApiPath: firstText(variantForApplyV204H13.rawApiPath, rawMedia.apiPath),
        rawAssetId: firstText(variantForApplyV204H13.rawAssetId, rawMedia.assetId),
        appliedVideo: appliedMedia,
        appliedUrl: appliedMedia.url || appliedMedia.apiPath || '',
        appliedApiPath: appliedMedia.apiPath || '',
        appliedAssetId: appliedMedia.assetId || '',
        volume,
        volumeBaked: Boolean(appliedMedia.volumeBaked),
        volumeBakedPercent: appliedMedia.volumeBakedPercent ?? volume,
        applied: true,
      }

      const next = sanitizeAudioSnapshot({
        ...currentSnapshotV204H13,
        scenes: asArray(currentSnapshotV204H13.scenes).map((scene) => {
          if (cleanId(scene.id) !== cleanId(sceneForApplyV204H13.id)) return scene
          const sceneOriginal = sceneOriginalSourceVideoV204B7(scene)
          const preservedOriginal = firstText(sceneOriginal.apiPath, sceneOriginal.url) ? sceneOriginal : originalMedia
          return {
            ...scene,
            status: 'applied',
            appliedVariantId: variantForApplyV204H13.id,
            selectedVariantId: variantForApplyV204H13.id,
            mmaudioVolume: volume,

            sourceVideo: appliedMedia,
            currentVideo: appliedMedia,
            mmaudioAppliedVideo: appliedMedia,
            video_url: appliedMedia.url || appliedMedia.apiPath || '',
            videoUrl: appliedMedia.url || appliedMedia.apiPath || '',
            video_api_path: appliedMedia.apiPath || '',
            videoApiPath: appliedMedia.apiPath || '',
            video_asset_id: appliedMedia.assetId || '',
            videoAssetId: appliedMedia.assetId || '',
            mmaudio_video_url: appliedMedia.url || appliedMedia.apiPath || '',
            mmaudioVideoUrl: appliedMedia.url || appliedMedia.apiPath || '',
            mmaudio_video_api_path: appliedMedia.apiPath || '',
            mmaudioVideoApiPath: appliedMedia.apiPath || '',
            mmaudio_video_asset_id: appliedMedia.assetId || '',
            mmaudioVideoAssetId: appliedMedia.assetId || '',
            has_mmaudio: true,
            hasMmaudio: true,
            has_sound: true,
            hasSound: true,
            mmaudio_status: 'applied',
            mmaudioStatus: 'applied',
            audio_studio_status: 'mmaudio_applied',
            audioStudioStatus: 'mmaudio_applied',
            audio_studio_applied_variant_id: variantForApplyV204H13.id,
            audioStudioAppliedVariantId: variantForApplyV204H13.id,
            originalSourceVideo: preservedOriginal,
            mmaudioOriginalSourceVideo: preservedOriginal,
            mmaudio_source_video_api_path: preservedOriginal.apiPath || '',
            mmaudioSourceVideoApiPath: preservedOriginal.apiPath || '',
            mmaudio_source_video_url: preservedOriginal.url || preservedOriginal.apiPath || '',
            mmaudioSourceVideoUrl: preservedOriginal.url || preservedOriginal.apiPath || '',
            mmaudio_source_video_asset_id: preservedOriginal.assetId || '',
            mmaudioSourceVideoAssetId: preservedOriginal.assetId || '',

            variants: uniqueVariantsV204B4(asArray(scene.variants).map((variant) => cleanId(variant.id) === cleanId(variantForApplyV204H13.id)
              ? { ...nextVariant, selected: true }
              : { ...variant, selected: false, applied: false })),
          }
        }),
      })

      await saveSnapshot(next, 'apply_variant_visible_v204h13')
      await syncAppliedToBoard({ ...sceneForApplyV204H13, sourceVideo: appliedMedia, originalSourceVideo: originalMedia }, nextVariant)
      console.info('[AUDIO STUDIO MMAUDIO APPLY LIVE PICK V204H13]', { sceneId: sceneForApplyV204H13.id, variantId: variantForApplyV204H13.id, volumePercent: volume, ref: firstText(selectedRef.apiPath, selectedRef.url) })
      setStatus(volume === 100 ? 'MMAudio вариант применён: левое видео обновлено, Доска записана для монтажки' : `MMAudio вариант применён: громкость ${volume}% запечена в видео, Доска записана для монтажки`)
    } catch (err) {
      setError(`Не удалось применить вариант: ${err?.message || err}`)
    } finally {
      mmaudioBusyRefV211Y2.current = false
      setApplyingVariantId('')
    }
  }, [projectId, saveSnapshot, selectedScene, selectedVariant, syncAppliedToBoard])

  const deleteVariant = useCallback(async (variantId) => {
    if (!selectedScene || !variantId) return
    const next = {
      ...snapshotRef.current,
      scenes: asArray(snapshotRef.current.scenes).map((scene) => {
        if (cleanId(scene.id) !== cleanId(selectedScene.id)) return scene
        const variants = sortAudioVariantsV204C5(asArray(scene.variants).filter((variant) => cleanId(variant.id) !== cleanId(variantId)))
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
    const id = cleanId(variantId)
    mmaudioSelectedVariantIdLiveRefV204H13.current = id
    patchSelectedScene((scene) => {
      const variant = asArray(scene.variants).find((item) => cleanId(item.id) === id)
      const volume = Number(variant?.volume ?? scene.mmaudioVolume ?? DEFAULT_MMAUDIO_VOLUME_PERCENT_V204G14)
      mmaudioVolumeLiveRefV204H13.current = Math.max(0, Math.min(150, volume || DEFAULT_MMAUDIO_VOLUME_PERCENT_V204G14))
      console.info('[AUDIO STUDIO MMAUDIO SELECT LIVE V204H13]', { sceneId: scene.id, variantId: id, volumePercent: mmaudioVolumeLiveRefV204H13.current })
      return {
        ...scene,
        selectedVariantId: id,
        mmaudioVolume: mmaudioVolumeLiveRefV204H13.current,
        variants: asArray(scene.variants).map((item) => ({
          ...item,
          selected: cleanId(item.id) === id,
        })),
      }
    })
  }, [patchSelectedScene, selectedScene])

  const saveNow = useCallback(() => saveSnapshot(snapshotRef.current, 'manual_save_v204a'), [saveSnapshot])

  const exportAudioStudioJsonV204B2 = useCallback(() => {
    try {
      const payload = buildAudioStudioExportPayload(sanitizeAudioSnapshot(snapshotRef.current), projectId)
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `ava_audio_studio_${projectId || 'workspace'}_${audioJsonFileStamp()}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 500)
      setStatus('Экспорт JSON готов — файл скачан')
    } catch (err) {
      setError(`Не удалось экспортировать JSON: ${err?.message || err}`)
    }
  }, [projectId])

  const importAudioStudioJsonV204B2 = useCallback(async (file) => {
    if (!file) return
    setError('')
    try {
      const text = await file.text()
      const imported = JSON.parse(text)
      const { snapshot: next, stats } = applyAudioStudioImportedJson(snapshotRef.current, imported, projectId)
      await saveSnapshot(sanitizeAudioSnapshot(next), 'import_json_v204b3')
      setStatus(`Импорт JSON: обновлено сцен ${stats.matched} из ${stats.imported} · режим ${stats.mode}`)
    } catch (err) {
      setError(`Не удалось импортировать JSON: ${err?.message || err}`)
    } finally {
      if (importInputRefV204B2.current) importInputRefV204B2.current.value = ''
    }
  }, [projectId, saveSnapshot])

  const selectedAppliedMmaudioMediaV211Y2 = sceneAppliedMmaudioMediaV211Y2(selectedScene || {})
  const sourceVideoRef = firstText(
    cleanId(selectedScene?.appliedVariantId || selectedScene?.audioStudioAppliedVariantId) ? firstText(selectedAppliedMmaudioMediaV211Y2.apiPath, selectedAppliedMmaudioMediaV211Y2.url) : '',
    selectedScene?.currentVideo?.apiPath,
    selectedScene?.currentVideo?.url,
    selectedScene?.mmaudioAppliedVideo?.apiPath,
    selectedScene?.mmaudioAppliedVideo?.url,
    selectedScene?.sourceVideo?.apiPath,
    selectedScene?.sourceVideo?.url,
  )
  const sourceAudioRefForMixV204E5A = firstText(
    selectedScene?.sourceAudio?.apiPath,
    selectedScene?.sourceAudio?.url,
    selectedScene?.audio?.apiPath,
    selectedScene?.audio?.url,
    selectedScene?.audioApiPath,
    selectedScene?.audioUrl,
    selectedScene?.boardRaw ? boardSourceAudioRefV204E5A(selectedScene.boardRaw) : '',
    sourceVideoRef,
  )
  const sourceAudioRef = firstText(
    selectedScene?.sourceAudio?.apiPath,
    selectedScene?.sourceAudio?.url,
    boardSourceAudioRef(selectedScene?.boardRaw || {}),
  )
  const selectedResultRef = selectedVariant ? variantRef(selectedVariant) : ''
  const activeVolume = Math.max(0, Math.min(100, Number(selectedScene?.mmaudioVolume ?? selectedVariant?.volume ?? DEFAULT_MMAUDIO_VOLUME_PERCENT_V204G14) || DEFAULT_MMAUDIO_VOLUME_PERCENT_V204G14))
  const selectedTimingAudioRefV204E10 = audioStudioTimingAudioRefV204E10(selectedScene || {})
  const selectedTimingAudioReadyV204E10 = Boolean(selectedTimingAudioRefV204E10)
  const selectedTimingAudioPreparingV204E10 = Boolean(selectedScene && cleanId(timingAudioPreparingSceneIdV204E10) === cleanId(selectedScene.id || selectedScene.sceneId))

  const stableBlocksV204F4 = useMemo(() => asArray(snapshot.stableBlocks), [snapshot.stableBlocks])

  const stableSceneBlockByIdV204F4 = useMemo(() => {
    const map = new Map()
    stableBlocksV204F4.forEach((block) => {
      stableBlockSceneIdsV204F4(block).forEach((sceneId) => {
        if (sceneId && !map.has(sceneId)) map.set(sceneId, block)
      })
    })
    return map
  }, [stableBlocksV204F4])

  const selectedSavedStableBlockV204F4 = useMemo(() => {
    const activeId = cleanId(activeStableBlockIdV204F4)
    if (activeId) {
      const active = stableBlocksV204F4.find((block) => cleanId(block.id) === activeId)
      if (active) return active
    }
    const selectedId = cleanId(selectedScene?.id || selectedScene?.sceneId)
    return selectedId ? (stableSceneBlockByIdV204F4.get(selectedId) || null) : null
  }, [activeStableBlockIdV204F4, selectedScene, stableBlocksV204F4, stableSceneBlockByIdV204F4])

  const selectedStableBlockNumberV204F9 = useMemo(() => {
    const id = cleanId(selectedSavedStableBlockV204F4?.id)
    if (!id) return 0
    const index = stableBlocksV204F4.findIndex((block) => cleanId(block.id) === id)
    return index >= 0 ? index + 1 : 0
  }, [selectedSavedStableBlockV204F4, stableBlocksV204F4])


  // V204G5_PERSIST_STABLE_BLOCK_PREVIEW_AFTER_F5
  useEffect(() => {
    const preview = selectedSavedStableBlockV204F4?.previewVideo || selectedSavedStableBlockV204F4?.stablePreviewVideo || selectedSavedStableBlockV204F4?.stableAudio?.previewVideo || null
    const previewRef = firstText(preview?.apiPath, preview?.assetApiPath, preview?.asset_api_path, preview?.url, preview?.assetUrl, preview?.asset_url)
    if (!previewRef) {
      setStableBlockPreviewVideoV204G1(null)
      if (typeof setStableBlockPreviewUiPhaseV204G4 === 'function') setStableBlockPreviewUiPhaseV204G4('idle')
      return
    }
    setStableBlockPreviewVideoV204G1({
      ...preview,
      apiPath: firstText(preview?.apiPath, preview?.assetApiPath, preview?.asset_api_path, previewRef),
      url: firstText(preview?.url, preview?.assetUrl, preview?.asset_url),
      assetId: firstText(preview?.assetId, preview?.asset_id),
      restoredAfterF5V204G5: true,
    })
    if (typeof setStableBlockPreviewUiPhaseV204G4 === 'function') setStableBlockPreviewUiPhaseV204G4('idle')
  }, [selectedSavedStableBlockV204F4])

  const selectedStableBlockScenesV204F1 = useMemo(() => {
    const scenes = asArray(snapshot.scenes)
    const byId = new Map(scenes.map((scene) => [cleanId(scene.id || scene.sceneId), scene]))
    const manualIds = asArray(stableManualSelectionV204F2).map(cleanId).filter(Boolean)
    if (audioStudioModeV204F1 === 'stable' && manualIds.length) {
      const manualScenes = manualIds.map((sceneId) => byId.get(sceneId)).filter(Boolean)
      if (manualScenes.length) return manualScenes
    }
    const savedIds = stableBlockSceneIdsV204F4(selectedSavedStableBlockV204F4)
    if (audioStudioModeV204F1 === 'stable' && savedIds.length) {
      const savedScenes = savedIds.map((sceneId) => byId.get(sceneId)).filter(Boolean)
      if (savedScenes.length) return savedScenes
    }
    if (!selectedScene) return []
    const selectedId = cleanId(selectedScene.id || selectedScene.sceneId)
    const selectedBlockId = cleanId(selectedScene.blockId || selectedScene.block_id || selectedScene.semanticBlockId || selectedScene.semantic_block_id)
    const selectedColor = cleanId(selectedScene.color)
    const matched = scenes.filter((scene) => {
      const sceneId = cleanId(scene.id || scene.sceneId)
      if (sceneId === selectedId) return true
      const blockId = cleanId(scene.blockId || scene.block_id || scene.semanticBlockId || scene.semantic_block_id)
      if (selectedBlockId && blockId && blockId === selectedBlockId) return true
      if (!selectedBlockId && selectedColor && cleanId(scene.color) === selectedColor) return true
      return false
    })
    return matched.length ? matched : [selectedScene]
  }, [audioStudioModeV204F1, snapshot.scenes, selectedScene, selectedSavedStableBlockV204F4, stableManualSelectionV204F2])

  const selectedStableBlockSceneIdsV204F1 = useMemo(() => (
    selectedStableBlockScenesV204F1.map((scene) => cleanId(scene.id || scene.sceneId)).filter(Boolean)
  ), [selectedStableBlockScenesV204F1])

  const selectedStableBlockDurationV204F1 = useMemo(() => {
    const scenes = selectedStableBlockScenesV204F1
    if (!scenes.length) return 0
    const starts = scenes.map((scene) => toNumber(scene.startSec ?? scene.start_sec ?? scene.start, 0))
    const ends = scenes.map((scene) => {
      const start = toNumber(scene.startSec ?? scene.start_sec ?? scene.start, 0)
      const end = toNumber(scene.endSec ?? scene.end_sec ?? scene.end, 0)
      const duration = toNumber(scene.durationSec ?? scene.duration_sec, 0)
      return end > start ? end : start + duration
    })
    return Math.max(0, Math.max(...ends) - Math.min(...starts))
  }, [snapshot.scenes])

  const selectedStableBlockRequestDurationV204F1 = selectedStableBlockDurationV204F1 > 0
    ? Math.ceil(selectedStableBlockDurationV204F1 + 1)
    : 0

  const selectedStableBlockTitleV204F1 = firstText(
    selectedSavedStableBlockV204F4?.title,
    stableManualSelectionV204F2.length ? 'Ручной Stable-блок' : '',
    selectedScene?.blockTitle,
    selectedScene?.block_title,
    selectedScene?.semanticBlockTitle,
    selectedScene?.semantic_block_title,
    selectedStableBlockScenesV204F1.length > 1 ? `Блок ${selectedStableBlockScenesV204F1[0]?.title || selectedStableBlockScenesV204F1[0]?.id || ''}` : selectedScene?.title,
    'Stable Audio block'
  )

  const selectedStableBlockColorV204F3 = firstText(
    selectedSavedStableBlockV204F4?.color,
    selectedStableBlockScenesV204F1[0]?.color,
    selectedStableBlockScenesV204F1[0]?.blockColor,
    selectedStableBlockScenesV204F1[0]?.block_color,
    selectedScene?.color,
    '#62d8ff'
  )

  const stableDisplayBlockTitleV204F3 = firstText(stableDraftBlockTitleV204F3, selectedStableBlockTitleV204F1)

  // V204F3_STABLE_BLOCK_TITLE_COLOR
  // V204F4_STABLE_BLOCKS_AUTOSAVE
  const stableSavedBlockActiveV204F4 = audioStudioModeV204F1 === 'stable' && Boolean(selectedSavedStableBlockV204F4?.id)
  const stableManualSelectionActiveV204F2 = audioStudioModeV204F1 === 'stable' && asArray(stableManualSelectionV204F2).length > 0

  const buildStableBlockSnapshotV204F4 = useCallback((baseSnapshot = {}, sceneIds = [], preferredBlockId = '', titleValue = '', selectedSceneId = '') => {
    const cleanSnapshot = sanitizeAudioSnapshot(baseSnapshot)
    const scenes = asArray(cleanSnapshot.scenes)
    const idSet = new Set(asArray(sceneIds).map(cleanId).filter(Boolean))
    const blockScenes = scenes.filter((scene) => idSet.has(cleanId(scene.id || scene.sceneId)))
    if (!blockScenes.length) {
      return {
        snapshot: { ...cleanSnapshot, selectedSceneId: selectedSceneId || cleanSnapshot.selectedSceneId, updatedAt: nowIso() },
        block: null,
      }
    }

    const orderedSceneIds = blockScenes.map((scene) => cleanId(scene.id || scene.sceneId)).filter(Boolean)
    const preferredId = cleanId(preferredBlockId)
    const existingBlocks = asArray(cleanSnapshot.stableBlocks)
    const existingBlock = existingBlocks.find((block) => cleanId(block.id) === preferredId)
      || existingBlocks.find((block) => stableBlockSceneIdsV204F4(block).some((sceneId) => idSet.has(sceneId)))
      || null
    const blockId = cleanId(existingBlock?.id || preferredId || `stable_block_${orderedSceneIds[0] || Date.now()}`)
    const firstScene = blockScenes[0] || {}
    const timeline = stableBlockTimelineFromScenesV204F4(blockScenes)
    const blockColor = firstText(firstScene.color, existingBlock?.color, firstScene.blockColor, firstScene.block_color, '#62d8ff')
    const blockTitle = firstText(
      titleValue,
      existingBlock?.title,
      blockScenes.length > 1 ? `Блок ${firstScene.title || firstScene.id || orderedSceneIds[0] || ''}` : (firstScene.title || firstScene.id),
      'Stable Audio block'
    )
    let existingStableAudioV204F7 = existingBlock?.stableAudio || {}
    const existingSceneIdsV204H2 = existingBlock ? stableBlockSceneIdsV204F4(existingBlock) : []
    const stableBlockSceneSetChangedV204H2 = Boolean(existingBlock) && !stableBlockSceneIdsEqualV204H2(existingSceneIdsV204H2, orderedSceneIds)
    if (stableBlockSceneSetChangedV204H2) {
      existingStableAudioV204F7 = { enabled: true }
    }
    const draftModeForBlockV204F7 = stableAudioModeApiValueV204F7(stableDraftModeV204F7 || existingStableAudioV204F7.mode || existingBlock?.mode || 'Music')
    const draftVolumeForBlockV204F7 = stableAudioVolumeV204F7(stableDraftVolumeV204F7, existingStableAudioV204F7.volume ?? 100)
    const draftFadeInForBlockV204F7 = stableAudioFadeV204F7(stableDraftFadeInSecV204F7, existingStableAudioV204F7.fadeInSec ?? 0.35)
    const draftFadeOutForBlockV204F7 = stableAudioFadeV204F7(stableDraftFadeOutSecV204F7, existingStableAudioV204F7.fadeOutSec ?? 0.8)

    const updatedBlock = {
      ...existingBlock,
      id: blockId,
      title: blockTitle,
      color: blockColor,
      source: 'manual_ctrl_click_v204f4',
      sceneIds: orderedSceneIds,
      startSec: timeline.startSec,
      endSec: timeline.endSec,
      durationSec: timeline.durationSec,
      requestDurationSec: timeline.requestDurationSec,
      mode: draftModeForBlockV204F7,
      prompt: firstText(stableDraftPromptV204F7, existingStableAudioV204F7.prompt, existingBlock?.prompt),
      negativePrompt: firstText(stableDraftNegativePromptV204F7, existingStableAudioV204F7.negativePrompt, existingBlock?.negativePrompt, STABLE_AUDIO_DEFAULT_NEGATIVE_V204F7),
      volume: draftVolumeForBlockV204F7,
      fadeInSec: draftFadeInForBlockV204F7,
      fadeOutSec: draftFadeOutForBlockV204F7,
      stableAudio: {
        enabled: true,
        ...existingStableAudioV204F7,
        mode: draftModeForBlockV204F7,
        prompt: firstText(stableDraftPromptV204F7, existingStableAudioV204F7.prompt, existingBlock?.prompt),
        negativePrompt: firstText(stableDraftNegativePromptV204F7, existingStableAudioV204F7.negativePrompt, existingBlock?.negativePrompt, STABLE_AUDIO_DEFAULT_NEGATIVE_V204F7),
        volume: draftVolumeForBlockV204F7,
        fadeInSec: draftFadeInForBlockV204F7,
        fadeOutSec: draftFadeOutForBlockV204F7,
        exactDurationSec: timeline.durationSec,
        requestDurationSec: timeline.requestDurationSec,
        variants: asArray(existingStableAudioV204F7.variants),
      },
      updatedAt: nowIso(),
    }

    if (stableBlockSceneSetChangedV204H2) {
      delete updatedBlock.appliedStableAudio
      delete updatedBlock.applied_stable_audio
      delete updatedBlock.appliedStableAudioRef
      delete updatedBlock.applied_stable_audio_ref
      delete updatedBlock.appliedStableAudioVariantId
      delete updatedBlock.applied_stable_audio_variant_id
      delete updatedBlock.previewVideo
      delete updatedBlock.stablePreviewVideo
      updatedBlock.status = 'stable_block_membership_changed_v204h2'
      updatedBlock.stableAudioApplied = false
      updatedBlock.stable_audio_applied = false
      updatedBlock.assemblyReady = false
      updatedBlock.assembly_ready = false
      updatedBlock.stableAudio = {
        ...(updatedBlock.stableAudio || {}),
        enabled: true,
        status: 'empty',
        variants: [],
        selectedVariantId: '',
        selected_variant_id: '',
        appliedVariantId: '',
        applied_variant_id: '',
        appliedAudio: null,
        applied_audio: null,
        appliedVariant: null,
        applied_variant: null,
        assembly: null,
        updatedAt: nowIso(),
      }
    }

    const otherBlocks = existingBlocks.map((block) => {
      if (cleanId(block.id) === blockId) return null
      const remainingIds = stableBlockSceneIdsV204F4(block).filter((sceneId) => !idSet.has(sceneId))
      if (!remainingIds.length) return null
      if (remainingIds.length === stableBlockSceneIdsV204F4(block).length) return block
      const remainingSet = new Set(remainingIds)
      const remainingScenes = scenes.filter((scene) => remainingSet.has(cleanId(scene.id || scene.sceneId)))
      const remainingTimeline = stableBlockTimelineFromScenesV204F4(remainingScenes)
      return {
        ...block,
        sceneIds: remainingIds,
        startSec: remainingTimeline.startSec,
        endSec: remainingTimeline.endSec,
        durationSec: remainingTimeline.durationSec,
        requestDurationSec: remainingTimeline.requestDurationSec,
        updatedAt: nowIso(),
      }
    }).filter(Boolean)

    const next = {
      ...cleanSnapshot,
      selectedSceneId: selectedSceneId || cleanSnapshot.selectedSceneId || orderedSceneIds[0],
      stableBlocks: [...otherBlocks, updatedBlock],
      stableAudio: {
        ...(cleanSnapshot.stableAudio || {}),
        enabled: true,
      },
      updatedAt: nowIso(),
    }
    return { snapshot: next, block: updatedBlock }
  }, [stableDraftFadeInSecV204F7, stableDraftFadeOutSecV204F7, stableDraftModeV204F7, stableDraftNegativePromptV204F7, stableDraftPromptV204F7, stableDraftVolumeV204F7])

  const commitStableManualBlockV204F4 = useCallback((sceneIds = [], preferredBlockId = '', titleValue = '', selectedSceneId = '') => {
    const { snapshot: next, block } = buildStableBlockSnapshotV204F4(snapshotRef.current || {}, sceneIds, preferredBlockId, titleValue, selectedSceneId)
    if (!block) return null
    snapshotRef.current = next
    setSnapshot(next)
    persistSnapshotSilently(next, 'stable_block_saved_v204f4')
    setActiveStableBlockIdV204F4(block.id)
    setStableManualSelectionV204F2([])
    setStableDraftBlockTitleV204F3(block.title || '')
    return block
  }, [buildStableBlockSnapshotV204F4, persistSnapshotSilently])

  const updateStableBlockTitleV204F4 = useCallback((value) => {
    setStableDraftBlockTitleV204F3(value)
  }, [])

  const handleSceneStripSelectV204F2 = useCallback((sceneId, event) => {
    const cleanSceneId = cleanId(sceneId)
    const isStableMultiClick = (audioStudioModeV204F1 === 'stable' || audioStudioModeV204F1 === 'preview') && (event?.ctrlKey || event?.metaKey)
    if (isStableMultiClick && cleanSceneId) {
      const currentIds = asArray(stableManualSelectionV204F2).map(cleanId).filter(Boolean)
      const savedIds = stableBlockSceneIdsV204F4(selectedSavedStableBlockV204F4)
      const seedIds = currentIds.length ? currentIds : savedIds
      const exists = seedIds.includes(cleanSceneId)
      const nextIds = exists ? seedIds.filter((id) => id !== cleanSceneId) : [...seedIds, cleanSceneId]
      if (!nextIds.length) {
        setActiveStableBlockIdV204F4('')
        setStableManualSelectionV204F2([])
        setStatus('Stable Audio: ручной выбор пустой')
      } else {
        setActiveStableBlockIdV204F4(activeStableBlockIdV204F4 || selectedSavedStableBlockV204F4?.id || '')
        setStableManualSelectionV204F2(nextIds)
        setStatus(`Stable Audio: выбрано ${nextIds.length} сцен. Нажми “Сделать блок”, чтобы закрепить.`)
      }
      setSnapshot((current) => {
        const next = { ...current, selectedSceneId: cleanSceneId, updatedAt: nowIso() }
        snapshotRef.current = next
        return next
      })
      return
    }

    if ((audioStudioModeV204F1 === 'stable' || audioStudioModeV204F1 === 'preview') && cleanSceneId) {
      const savedBlock = stableSceneBlockByIdV204F4.get(cleanSceneId)
      if (savedBlock) {
        setActiveStableBlockIdV204F4(savedBlock.id || '')
        setStableManualSelectionV204F2([])
        setStableDraftBlockTitleV204F3(savedBlock.title || '')
        setStatus(`Stable Audio: выбран блок “${savedBlock.title || savedBlock.id || ''}”`)
      } else {
        setActiveStableBlockIdV204F4('')
        if (asArray(stableManualSelectionV204F2).length) setStableManualSelectionV204F2([])
        setStableDraftBlockTitleV204F3('')
      }
    }

    setSnapshot((current) => {
      const next = { ...current, selectedSceneId: cleanSceneId, updatedAt: nowIso() }
      snapshotRef.current = next
      return next
    })
  }, [activeStableBlockIdV204F4, audioStudioModeV204F1, selectedSavedStableBlockV204F4, stableManualSelectionV204F2, stableSceneBlockByIdV204F4])

  const clearStableManualSelectionV204F2 = useCallback(() => {
    setActiveStableBlockIdV204F4('')
    setStableManualSelectionV204F2([])
    setStableDraftBlockTitleV204F3('')
    setStatus('Stable Audio: ручной выбор блока сброшен. Сохранённые блоки не удалены.')
  }, [])

  // V204F5_STABLE_BLOCK_MAKE_BUTTON
  const saveStableDraftBlockV204F5 = useCallback(() => {
    const ids = Array.from(new Set(asArray(selectedStableBlockSceneIdsV204F1).map(cleanId).filter(Boolean)))
    if (!ids.length) {
      setError('Нет сцен для Stable-блока.')
      return
    }
    const preferredBlockId = activeStableBlockIdV204F4 || selectedSavedStableBlockV204F4?.id || `stable_block_${ids[0]}`
    const titleValue = firstText(stableDraftBlockTitleV204F3, selectedStableBlockTitleV204F1, `Stable-блок ${ids[0]}`)
    const block = commitStableManualBlockV204F4(ids, preferredBlockId, titleValue, ids[0])
    if (!block) {
      setError('Не удалось закрепить Stable-блок.')
      return
    }
    setStatus(`Stable Audio: блок “${block.title || block.id}” сохранён (${stableBlockSceneIdsV204F4(block).length} сцен)`)
  }, [activeStableBlockIdV204F4, commitStableManualBlockV204F4, selectedSavedStableBlockV204F4, selectedStableBlockSceneIdsV204F1, selectedStableBlockTitleV204F1, stableDraftBlockTitleV204F3])

  // V204F6_STABLE_BLOCK_CREATE_DISASSEMBLE
  const disassembleStableBlockV204F6 = useCallback(() => {
    const block = selectedSavedStableBlockV204F4
    const blockId = cleanId(block?.id)
    if (!blockId) {
      clearStableManualSelectionV204F2()
      return
    }
    const current = sanitizeAudioSnapshot(snapshotRef.current || {})
    const removedIds = stableBlockSceneIdsV204F4(block)
    const next = {
      ...current,
      stableBlocks: asArray(current.stableBlocks).filter((item) => cleanId(item.id) !== blockId),
      appliedStableAudioBlocks: asArray(current.appliedStableAudioBlocks).filter((item) => cleanId(item.blockId || item.block_id) !== blockId),
      assemblyStableAudioBlocks: asArray(current.assemblyStableAudioBlocks).filter((item) => cleanId(item.blockId || item.block_id) !== blockId),
      updatedAt: nowIso(),
    }
    snapshotRef.current = next
    setSnapshot(next)
    persistSnapshotSilently(next, 'stable_block_disassembled_v204f6')
    setActiveStableBlockIdV204F4('')
    setStableManualSelectionV204F2([])
    setStableDraftBlockTitleV204F3('')
    stableAudioSelectedVariantIdLiveRefV204H13.current = '' // V204H18 clear stale STAU selected id
    stableAudioVolumeDraftsLiveRefV204H13.current = {} // V204H18 clear stale STAU volume drafts
    setStableAudioVolumeDraftsV204G13({})
    // V204G9_STABLE_PREVIEW_FLOW_CLEANUP - clear preview on disassemble V204G9
    setStableBlockPreviewVideoV204G1(null)
    setStableBlockPreviewLoadingV204G1(false)
    setStableBlockPreviewUiPhaseV204G4('idle')
    setStableBlockPreviewPlayKeyV204G9('')
    setStatus(`Stable Audio: блок разобран, сцены снова отдельно (${removedIds.length}); STAU-привязка очищена`) // stable_block_disassembled_cleanup_v204h2
  }, [clearStableManualSelectionV204F2, persistSnapshotSilently, selectedSavedStableBlockV204F4])

  // V204F7_STABLE_AUDIO_CONTROLS_SHELL
  const selectedStableBlockIdV204F7 = cleanId(selectedSavedStableBlockV204F4?.id)

  useEffect(() => {
    const block = selectedSavedStableBlockV204F4 || null
    const stableAudio = block?.stableAudio || {}
    setStableDraftPromptV204F7(firstText(stableAudio.prompt, block?.prompt, ''))
    setStableDraftNegativePromptV204F7(firstText(stableAudio.negativePrompt, block?.negativePrompt, STABLE_AUDIO_DEFAULT_NEGATIVE_V204F7))
    setStableDraftModeV204F7(stableAudioModeApiValueV204F7(stableAudio.mode || block?.mode || 'Music'))
    setStableDraftVolumeV204F7(stableAudioVolumeV204F7(stableAudio.volume ?? block?.volume ?? 100))
    setStableDraftFadeInSecV204F7(stableAudioFadeV204F7(stableAudio.fadeInSec ?? block?.fadeInSec ?? 0.35))
    setStableDraftFadeOutSecV204F7(stableAudioFadeV204F7(stableAudio.fadeOutSec ?? block?.fadeOutSec ?? 0.8))
  }, [selectedStableBlockIdV204F7])

  const patchStableBlockSettingsV204F7 = useCallback((patch = {}, reason = 'stable_audio_settings_v204f7') => {
    const blockId = cleanId(selectedSavedStableBlockV204F4?.id)
    if (!blockId) return
    const current = sanitizeAudioSnapshot(snapshotRef.current || {})
    const nextBlocks = asArray(current.stableBlocks).map((block) => {
      if (cleanId(block.id) !== blockId) return block
      const stableAudio = {
        enabled: true,
        ...(block.stableAudio || {}),
        ...patch,
        mode: stableAudioModeApiValueV204F7(patch.mode || block.stableAudio?.mode || block.mode || 'Music'),
        volume: stableAudioVolumeV204F7(patch.volume ?? block.stableAudio?.volume ?? block.volume ?? 100),
        fadeInSec: stableAudioFadeV204F7(patch.fadeInSec ?? block.stableAudio?.fadeInSec ?? block.fadeInSec ?? 0.35),
        fadeOutSec: stableAudioFadeV204F7(patch.fadeOutSec ?? block.stableAudio?.fadeOutSec ?? block.fadeOutSec ?? 0.8),
        exactDurationSec: toNumber(block.durationSec, selectedStableBlockDurationV204F1),
        requestDurationSec: toNumber(block.requestDurationSec, selectedStableBlockRequestDurationV204F1),
        updatedAt: nowIso(),
      }
      return {
        ...block,
        ...patch,
        mode: stableAudio.mode,
        prompt: stableAudio.prompt,
        negativePrompt: stableAudio.negativePrompt,
        volume: stableAudio.volume,
        fadeInSec: stableAudio.fadeInSec,
        fadeOutSec: stableAudio.fadeOutSec,
        stableAudio,
        updatedAt: nowIso(),
      }
    })
    const next = { ...current, stableBlocks: nextBlocks, updatedAt: nowIso() }
    snapshotRef.current = next
    setSnapshot(next)
    // V211S: do not save immediately on every Stable prompt/mode/volume/fade edit.
    // The generic debounced autosave handles it once; direct save here doubled POSTs
    // and sometimes queued before /stable-audio/generate.
  }, [selectedSavedStableBlockV204F4, selectedStableBlockDurationV204F1, selectedStableBlockRequestDurationV204F1])

  const updateStablePromptV204F7 = useCallback((value) => {
    setStableDraftPromptV204F7(value)
    patchStableBlockSettingsV204F7({ prompt: value }, 'stable_audio_prompt_v204f7')
  }, [patchStableBlockSettingsV204F7])

  const updateStableNegativePromptV204F7 = useCallback((value) => {
    setStableDraftNegativePromptV204F7(value)
    patchStableBlockSettingsV204F7({ negativePrompt: value }, 'stable_audio_negative_v204f7')
  }, [patchStableBlockSettingsV204F7])

  const updateStableModeV204F7 = useCallback((value) => {
    const mode = stableAudioModeApiValueV204F7(value)
    setStableDraftModeV204F7(mode)
    patchStableBlockSettingsV204F7({ mode }, 'stable_audio_mode_v204f7')
  }, [patchStableBlockSettingsV204F7])

  const updateStableVolumeV204F7 = useCallback((value) => {
    const volume = stableAudioVolumeV204F7(value, DEFAULT_STAU_VOLUME_PERCENT_V204G18)
    setStableDraftVolumeV204F7(volume)
    patchStableBlockSettingsV204F7({ volume }, 'stable_audio_volume_v204f7')
  }, [patchStableBlockSettingsV204F7])

  const updateStableFadeInV204F7 = useCallback((value) => {
    const fadeInSec = stableAudioFadeV204F7(value, 0.35)
    setStableDraftFadeInSecV204F7(fadeInSec)
    patchStableBlockSettingsV204F7({ fadeInSec }, 'stable_audio_fade_in_v204f7')
  }, [patchStableBlockSettingsV204F7])

  const updateStableFadeOutV204F7 = useCallback((value) => {
    const fadeOutSec = stableAudioFadeV204F7(value, 0.8)
    setStableDraftFadeOutSecV204F7(fadeOutSec)
    patchStableBlockSettingsV204F7({ fadeOutSec }, 'stable_audio_fade_out_v204f7')
  }, [patchStableBlockSettingsV204F7])

  // V204G10_ENABLE_STABLE_GENERATE_ON_BLOCK
  const stableDefaultPromptV204G10 = useMemo(() => {
    const seconds = Math.max(1, Math.ceil(toNumber(selectedStableBlockRequestDurationV204F1, selectedStableBlockDurationV204F1 + 1 || 10)))
    const title = cleanId(stableDisplayBlockTitleV204F3) || 'this video block'
    return `${seconds}-second continuous instrumental tension bed for ${title}, cinematic pulse, controlled background energy, no vocals, no lyrics`
  }, [selectedStableBlockDurationV204F1, selectedStableBlockRequestDurationV204F1, stableDisplayBlockTitleV204F3])

  const stableEffectivePromptV204G10 = cleanId(stableDraftPromptV204F7) || stableDefaultPromptV204G10

  // V204F8_STABLE_AUDIO_SIMPLE_GENERATE_UI
  const buildStableAudioRequestPayloadV204F7 = useCallback(() => ({
    blockId: selectedSavedStableBlockV204F4?.id || '',
    title: stableDisplayBlockTitleV204F3,
    sceneIds: selectedStableBlockSceneIdsV204F1,
    startSec: toNumber(selectedSavedStableBlockV204F4?.startSec, 0),
    endSec: toNumber(selectedSavedStableBlockV204F4?.endSec, selectedStableBlockDurationV204F1),
    durationSec: selectedStableBlockDurationV204F1,
    requestDurationSec: selectedStableBlockRequestDurationV204F1,
    mode: stableAudioModeApiValueV204F7(stableDraftModeV204F7),
    modeLabel: stableAudioModeUiLabelV204F7(stableDraftModeV204F7),
    prompt: stableEffectivePromptV204G10,
    negativePrompt: stableDraftNegativePromptV204F7,
  }), [selectedSavedStableBlockV204F4, selectedStableBlockDurationV204F1, selectedStableBlockRequestDurationV204F1, selectedStableBlockSceneIdsV204F1, stableDisplayBlockTitleV204F3, stableDraftModeV204F7, stableDraftNegativePromptV204F7, stableEffectivePromptV204G10])

  const stableAudioVariantsV204G6 = asArray(selectedSavedStableBlockV204F4?.stableAudio?.variants)
  const selectedStableAudioVariantIdV204G6 = firstText(
    selectedSavedStableBlockV204F4?.stableAudio?.selectedVariantId,
    selectedSavedStableBlockV204F4?.stableAudio?.selected_variant_id,
    selectedSavedStableBlockV204F4?.stableAudio?.appliedVariantId,
    selectedSavedStableBlockV204F4?.stableAudio?.applied_variant_id,
  )
  const selectedStableAudioVariantV204G6 = stableAudioVariantsV204G6.find((variant) => cleanId(variant.id || variant.variantId) === cleanId(selectedStableAudioVariantIdV204G6)) || stableAudioVariantsV204G6[0] || null

  // V204H14_STAU_SINGLE_VARIANT_SOURCE: sync live ref from stableAudio.selectedVariantId;
  // do not mutate it every render from a stale memo/first variant.
  const selectedStableAudioBlockIdV204H14 = cleanId(selectedSavedStableBlockV204F4?.id || activeStableBlockIdV204F4 || '')
  const selectedStableAudioVariantStateIdV204H14 = cleanId(selectedStableAudioVariantIdV204G6 || selectedStableAudioVariantV204G6?.id || selectedStableAudioVariantV204G6?.variantId || '')
  useEffect(() => {
    stableAudioSelectedVariantIdLiveRefV204H13.current = selectedStableAudioVariantStateIdV204H14
    stableAudioSelectedVariantBlockIdLiveRefV211V.current = selectedStableAudioBlockIdV204H14
  }, [selectedStableAudioBlockIdV204H14, selectedStableAudioVariantStateIdV204H14])

  const selectedStableAudioVariantIdForUiV211V = cleanId(
    selectedStableAudioVariantIdV204G6
    || (cleanId(stableAudioSelectedVariantBlockIdLiveRefV211V.current) === selectedStableAudioBlockIdV204H14 ? stableAudioSelectedVariantIdLiveRefV204H13.current : '')
    || (stableAudioVariantsV204G6.length === 1 ? stableAudioVariantIdV204H18(stableAudioVariantsV204G6[0]) : '')
  )

  const selectedStableAudioAppliedV204H1 = cleanId(selectedSavedStableBlockV204F4?.stableAudio?.appliedVariantId || selectedSavedStableBlockV204F4?.stableAudio?.applied_variant_id) === selectedStableAudioVariantIdForUiV211V

  const submitStableAudioBlockV204F7 = useCallback(async () => {
    if (!selectedSavedStableBlockV204F4?.id) {
      setError('Сначала выбери сцены и нажми “Создать блок”.')
      return
    }
    const payload = {
      ...buildStableAudioRequestPayloadV204F7(),
      project_id: projectId,
      projectId,
      block: selectedSavedStableBlockV204F4,
      workflowKey: 'Stable_Audio_3_Medium_CLEAN.json',
      workflow_key: 'Stable_Audio_3_Medium_CLEAN.json',
      source: 'audio_studio_stable_audio_generate_v204g6',
    }
    setError('')
    stableAudioGenerateBusyRefV211S.current = true
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    pauseAudioStudioMediaV204H7()
    setStableAudioGeneratingV204G6(true)
    // V204G7B_STAU_AUDIO_BLOB_PLAYER_DELETE - keep right preview UI out of generation state
    setStableBlockPreviewLoadingV204G1(false)
    setStatus(`Stable Audio: отправляю запрос в Comfy… ${payload.modeLabel} · ${payload.requestDurationSec} сек`)
    console.info('[AUDIO STUDIO STABLE FAST SUBMIT V211S]', {
      blockId: payload.blockId,
      mode: payload.mode,
      durationSec: payload.durationSec,
      requestDurationSec: payload.requestDurationSec,
    })
    try {
      const data = await apiRequest('/audio-studio/stable-audio/generate', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      const variantRaw = data.variant || data.stableAudioVariant || data.stable_audio_variant
      if (!variantRaw) throw new Error('Backend не вернул Stable Audio variant.')
      const variantIdV204H14 = firstText(variantRaw.id, variantRaw.variantId, `stau_${Date.now()}`)
      const variant = {
        ...variantRaw,
        id: variantIdV204H14,
        variantId: variantIdV204H14,
        // V211Z_STABLE_AUDIO_SFX_VARIANT_LABEL: keep UI mode label separate from workflow choice.
        mode: stableAudioModeApiValueV204F7(variantRaw.mode || payload.mode),
        modeLabel: variantRaw.modeLabel || payload.modeLabel || stableAudioModeUiLabelV204F7(payload.mode),
        volume: stableAudioVolumeV204F7(variantRaw.volume ?? selectedSavedStableBlockV204F4?.stableAudio?.volume ?? DEFAULT_STAU_VOLUME_PERCENT_V204G14),
        selected: true,
        applied: false,
      }
      const blockId = cleanId(selectedSavedStableBlockV204F4.id)
      stableAudioSelectedVariantIdLiveRefV204H13.current = variantIdV204H14
      stableAudioSelectedVariantBlockIdLiveRefV211V.current = blockId
      setActiveStableBlockIdV204F4(blockId)
      const current = sanitizeAudioSnapshot(snapshotRef.current || {})
      const nextBlocks = asArray(current.stableBlocks).map((block) => {
        if (cleanId(block.id) !== blockId) return block
        const oldStableAudio = block.stableAudio || {}
        const oldVariants = asArray(oldStableAudio.variants)
        // V204H18: new result becomes the only selected STAU; old variants stay available but not selected.
        const filtered = oldVariants
          .filter((item) => cleanId(item.id || item.variantId || item.variant_id) !== cleanId(variant.id || variant.variantId))
          .map((item) => ({ ...item, selected: false }))
        const appliedIdV204H14 = cleanId(oldStableAudio.appliedVariantId || oldStableAudio.applied_variant_id)
        const normalizedVariantsV204H14 = normalizeStableAudioVariantsSingleSelectedV204H14([variant, ...filtered], variant.id, appliedIdV204H14)
        const stableAudio = {
          ...oldStableAudio,
          enabled: true,
          mode: stableAudioModeApiValueV204F7(payload.mode),
          prompt: stableEffectivePromptV204G10,
          volume: variant.volume,
          selectedVariantId: variant.id,
          selected_variant_id: variant.id,
          variants: normalizedVariantsV204H14,
          updatedAt: nowIso(),
        }
        return {
          ...block,
          mode: stableAudio.mode,
          prompt: stableEffectivePromptV204G10,
          stableAudio,
          updatedAt: nowIso(),
        }
      })
      const next = { ...current, stableBlocks: nextBlocks, stableAudio: { ...(current.stableAudio || {}), enabled: true }, updatedAt: nowIso() }
      snapshotRef.current = next
      setSnapshot(next)
      persistSnapshotSilently(next, 'stable_audio_variant_generated_v204g6')
      // V204H11_STAU_KEEP_PREVIEW_ON_AUDIO_READY
      // Stable Audio generation must not touch the right video preview. It only adds
      // an audio asset/variant below. The video preview is rebuilt strictly by the
      // explicit “Собрать блок” action, otherwise the browser reloads the preview
      // when a STAU audio asset appears.
      setStableBlockPreviewLoadingV204G1(false)
      setStatus(`Stable Audio готов: ${variant.modeLabel || payload.modeLabel} · ${variant.finalDurationSec || payload.durationSec} сек. Ниже можно прослушать, выставить громкость и нажать “Применить”. Правый preview не пересобирался — нажми “Собрать блок”, когда нужно обновить видео с этим STAU.`)
    } catch (err) {
      setError(`Stable Audio не сгенерировался: ${err?.message || err}`)
      console.warn('[AUDIO STUDIO STABLE AUDIO GENERATE FAILED V204G6]', err)
    } finally {
      stableAudioGenerateBusyRefV211S.current = false
      setStableAudioGeneratingV204G6(false)
    }
  }, [buildStableAudioRequestPayloadV204F7, persistSnapshotSilently, projectId, selectedSavedStableBlockV204F4, stableEffectivePromptV204G10])

  // V204G13_STAU_VOLUME_DRAFT_APPLY_PREVIEW
  const stableAudioVolumeDraftKeyV204G13 = useCallback((blockId, variantId) => `${cleanId(blockId)}::${cleanId(variantId)}`, [])

  const stableAudioVariantVolumeForUiV204G13 = useCallback((variant = null) => {
    const blockId = cleanId(selectedSavedStableBlockV204F4?.id)
    const variantId = cleanId(variant?.id || variant?.variantId)
    const draftKey = stableAudioVolumeDraftKeyV204G13(blockId, variantId)
    const draftValue = Object.prototype.hasOwnProperty.call(stableAudioVolumeDraftsV204G13, draftKey) ? stableAudioVolumeDraftsV204G13[draftKey] : undefined
    return stableAudioVolumeV204F7(
      draftValue ?? variant?.volume ?? selectedSavedStableBlockV204F4?.stableAudio?.volume ?? selectedSavedStableBlockV204F4?.volume ?? 100,
      100,
    )
  }, [selectedSavedStableBlockV204F4, stableAudioVolumeDraftKeyV204G13, stableAudioVolumeDraftsV204G13])

  const previewStableAudioBlockV204F7 = useCallback(async () => {
    // V204H18 require saved Stable block: manual/ghost selection must not pull old STAU memory.
    if (!stableSavedBlockActiveV204F4 || !selectedSavedStableBlockV204F4?.id) {
      setError('Сначала создай Stable-блок. После “Разобрать” старое STAU очищено и не используется.')
      return
    }
    if (!selectedStableBlockSceneIdsV204F1.length) {
      setError('Нет сцен для preview блока.')
      return
    }
    if (!selectedStableBlockScenesV204F1.length) {
      setError('Нет сцен блока для preview.')
      return
    }

    if (stablePreviewBlockBusyRefV211T.current) {
      console.info('[AUDIO STUDIO STABLE PREVIEW DOUBLE CLICK SKIPPED V211T]')
      return
    }
    stablePreviewBlockBusyRefV211T.current = true
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    setError('')
    pauseAudioStudioMediaV204H7()
    setStableBlockPreviewLoadingV204G1(true)
    setStableBlockPreviewUiPhaseV204G4('loading')
    setStatus(`Собираю блок: ${selectedStableBlockScenesV204F1.length} сцен · видео + Timing audio + MMAudio${selectedStableAudioVariantV204G6 ? ' + STAU' : ''}…`)
    console.info('[AUDIO STUDIO STABLE PREVIEW FAST SUBMIT V211T]', {
      sceneCount: selectedStableBlockScenesV204F1.length,
      blockId: selectedSavedStableBlockV204F4?.id || '',
      includeStableAudio: Boolean(selectedStableAudioVariantV204G6),
    })

    try {
      const preparedScenes = []
      for (const scene of selectedStableBlockScenesV204F1) {
        const sceneId = cleanId(scene.id || scene.sceneId)

        // V204H7: make block preview respect the user's MMAudio slider even if
        // the selected/applied scene video was not re-baked yet. If the current
        // sourceVideo is already baked at the same percent, backend keeps it at
        // 100% to avoid double-lowering.
        const variantsV204H7 = asArray(scene.variants)
        const appliedVariantIdV204H7 = cleanId(scene.appliedVariantId || scene.applied_variant_id)
        const appliedVariantV204H7 = variantsV204H7.find((variant) => cleanId(variant.id || variant.variantId) === appliedVariantIdV204H7) || null
        const hasAppliedMmaudioV204H7 = Boolean(appliedVariantV204H7 && !(appliedVariantV204H7.sourceBaseline || appliedVariantV204H7.kind === 'source_video'))
        const sceneMmaudioVolumeV204H7 = Math.max(0, Math.min(150, Number(scene.mmaudioVolume ?? scene.mmaudio_volume ?? appliedVariantV204H7?.volume ?? DEFAULT_MMAUDIO_VOLUME_PERCENT_V204G14) || DEFAULT_MMAUDIO_VOLUME_PERCENT_V204G14))
        const currentVideoV204H7 = scene.sourceVideo || scene.currentVideo || scene.mmaudioAppliedVideo || {}
        const bakedPercentRawV204H7 = Number(currentVideoV204H7.volumeBakedPercent ?? currentVideoV204H7.volume_baked_percent ?? appliedVariantV204H7?.volumeBakedPercent ?? appliedVariantV204H7?.volume_baked_percent ?? NaN)
        const alreadyBakedV204H7 = Boolean(currentVideoV204H7.volumeBaked || currentVideoV204H7.volume_baked || appliedVariantV204H7?.volumeBaked || appliedVariantV204H7?.volume_baked)
          && Number.isFinite(bakedPercentRawV204H7)
          && Math.abs(bakedPercentRawV204H7 - sceneMmaudioVolumeV204H7) <= 0.51
        const previewVideoAudioVolumePercentV204H7 = hasAppliedMmaudioV204H7 ? (alreadyBakedV204H7 ? 100 : sceneMmaudioVolumeV204H7) : 100

        let timingRef = audioStudioTimingAudioRefV204E10(scene)
        if (!timingRef) {
          timingRef = await prepareTimingAudioForSceneV204E10(scene, { reason: 'stable_block_preview_v204g1', silent: false })
        }
        preparedScenes.push({
          ...scene,
          sceneId,
          scene_id: sceneId,
          sourceAudio: timingRef ? { ...(scene.sourceAudio || {}), apiPath: timingRef, url: timingRef } : scene.sourceAudio,
          timingAudioReadyV204E10: Boolean(timingRef),
          previewVideoAudioVolumePercentV204H7,
          preview_video_audio_volume_percent_v204h7: previewVideoAudioVolumePercentV204H7,
          previewMmaudioVolumePercentV204H7: sceneMmaudioVolumeV204H7,
          preview_mmaudio_volume_percent_v204h7: sceneMmaudioVolumeV204H7,
          previewVideoAudioAlreadyBakedV204H7: alreadyBakedV204H7,
          preview_video_audio_already_baked_v204h7: alreadyBakedV204H7,
        })
      }
      const safePreparedScenesV211T = preparedScenes.filter((scene) => scene && typeof scene === 'object' && !Array.isArray(scene))
      if (safePreparedScenesV211T.length !== preparedScenes.length) {
        console.warn('[AUDIO STUDIO STABLE PREVIEW BAD SCENES DROPPED V211T]', {
          before: preparedScenes.length,
          after: safePreparedScenesV211T.length,
        })
      }
      if (!safePreparedScenesV211T.length) {
        throw new Error('Нет валидных сцен для сборки Stable-блока. Обнови из Доски и создай блок заново.')
      }
      // V204H13_AUDIO_SELECTION_LIVE_REFS: Build must use the latest clicked STAU variant
      // and latest slider value, not stale memo state / first generated audio.
      // V204H18_STAU_EXPLICIT_CHOICE_RESET: Build uses one explicit selected STAU only.
      const latestSnapshotForStablePreviewV204H18 = sanitizeAudioSnapshot(snapshotRef.current || {})
      const latestBlockIdForStablePreviewV204H18 = cleanId(selectedSavedStableBlockV204F4?.id || activeStableBlockIdV204F4 || buildStableAudioRequestPayloadV204F7().blockId)
      const latestBlockForStablePreviewV204H18 = asArray(latestSnapshotForStablePreviewV204H18.stableBlocks).find((block) => cleanId(block.id) === latestBlockIdForStablePreviewV204H18) || null
      const latestStableAudioForPreviewV204H18 = latestBlockForStablePreviewV204H18?.stableAudio || {}
      const latestVariantsForPreviewV204H18 = asArray(latestStableAudioForPreviewV204H18.variants)
      const liveStableVariantIdForPreviewV211V = cleanId(stableAudioSelectedVariantBlockIdLiveRefV211V.current) === latestBlockIdForStablePreviewV204H18
        ? stableAudioSelectedVariantIdLiveRefV204H13.current
        : ''
      const explicitSelectedStableIdV204H18 = cleanId(
        liveStableVariantIdForPreviewV211V
        || latestStableAudioForPreviewV204H18.selectedVariantId
        || latestStableAudioForPreviewV204H18.selected_variant_id
        || latestStableAudioForPreviewV204H18.appliedVariantId
        || latestStableAudioForPreviewV204H18.applied_variant_id
        || (latestVariantsForPreviewV204H18.length === 1 ? stableAudioVariantIdV204H18(latestVariantsForPreviewV204H18[0]) : '')
      )
      const stablePreviewVariantV204G6 = explicitSelectedStableIdV204H18
        ? latestVariantsForPreviewV204H18.find((variant) => cleanId(variant.id || variant.variantId || variant.variant_id) === explicitSelectedStableIdV204H18) || null
        : null
      const stablePreviewVariantIdV204H18 = cleanId(stablePreviewVariantV204G6?.id || stablePreviewVariantV204G6?.variantId || stablePreviewVariantV204G6?.variant_id)
      const stablePreviewDraftKeyV204H18 = stableAudioVolumeDraftKeyV204G13(latestBlockIdForStablePreviewV204H18, stablePreviewVariantIdV204H18)
      const stablePreviewDraftVolumeV204H18 = Object.prototype.hasOwnProperty.call(stableAudioVolumeDraftsLiveRefV204H13.current, stablePreviewDraftKeyV204H18)
        ? stableAudioVolumeDraftsLiveRefV204H13.current[stablePreviewDraftKeyV204H18]
        : undefined
      const stablePreviewVolumeV204H18 = stablePreviewVariantV204G6 ? stableAudioVolumeV204F7(
        stablePreviewDraftVolumeV204H18
        ?? stablePreviewVariantV204G6?.volume
        ?? latestStableAudioForPreviewV204H18.volume
        ?? DEFAULT_STAU_VOLUME_PERCENT_V204G14,
        DEFAULT_STAU_VOLUME_PERCENT_V204G14,
      ) : 0
      const stablePreviewRefV204G6 = stablePreviewVariantV204G6 ? stableAudioVariantRefV204G6(stablePreviewVariantV204G6 || {}) : ''
      const stablePreviewAudioPayloadV204G6 = stablePreviewRefV204G6 ? {
        ...stablePreviewVariantV204G6,
        ref: stablePreviewRefV204G6,
        apiPath: firstText(stablePreviewVariantV204G6?.apiPath, stablePreviewVariantV204G6?.api_path, stablePreviewVariantV204G6?.assetApiPath, stablePreviewVariantV204G6?.asset_api_path, stablePreviewRefV204G6),
        volume: stablePreviewVolumeV204H18,
        volumePercent: stablePreviewVolumeV204H18,
        volume_percent: stablePreviewVolumeV204H18,
        uiVolumePercentV204H18: stablePreviewVolumeV204H18,
        selectedVariantId: stablePreviewVariantIdV204H18,
        selected_variant_id: stablePreviewVariantIdV204H18,
      } : null
      console.info('[AUDIO STUDIO STABLE BLOCK LOGIC V211V]', {
        logic: 'block = selected scenes video + Timing audio slices + applied MMAudio + selected STAU variant',
        blockId: latestBlockIdForStablePreviewV204H18,
        sceneCount: preparedScenes.length,
        selectedVariantId: stablePreviewVariantIdV204H18,
        includeStableAudio: Boolean(stablePreviewRefV204G6),
      })
      console.info('[AUDIO STUDIO STAU PREVIEW SINGLE PICK V204H18]', {
        blockId: latestBlockIdForStablePreviewV204H18,
        selectedVariantId: stablePreviewVariantIdV204H18,
        ref: stablePreviewRefV204G6,
        volumePercent: stablePreviewVolumeV204H18,
        includeStableAudio: Boolean(stablePreviewRefV204G6),
        selectedFlags: latestVariantsForPreviewV204H18.filter((variant) => Boolean(variant?.selected)).map((variant) => cleanId(variant.id || variant.variantId || variant.variant_id)),
      })

      const payload = {
        ...buildStableAudioRequestPayloadV204F7(),
        project_id: projectId,
        projectId,
        block: selectedSavedStableBlockV204F4 || null,
        scenes: safePreparedScenesV211T,
        includeStableAudio: Boolean(stablePreviewRefV204G6),
        include_stable_audio: Boolean(stablePreviewRefV204G6),
        stableAudio: stablePreviewAudioPayloadV204G6,
        stable_audio: stablePreviewAudioPayloadV204G6,
        stableAudioSelectedVariantIdV204H18: stablePreviewAudioPayloadV204G6?.selectedVariantId || '',
        // V211X: preview block is a listening/check render, final Assembly stays full quality.
        draftQuality: 'fast',
        draft_quality: 'fast',
        fastPreview: true,
        fast_preview: true,
        source: 'audio_studio_stable_block_preview_v204g1',
      }

      console.info('[AUDIO STUDIO STABLE BLOCK PREVIEW REQUEST V204G1]', payload)
      const data = await apiRequest('/audio-studio/stable-preview/block', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      const previewVideo = {
        apiPath: firstText(data.previewVideoApiPath, data.preview_video_api_path, data.assetApiPath, data.asset_api_path, data.apiPath, data.api_path),
        url: firstText(data.previewVideoUrl, data.preview_video_url, data.assetUrl, data.asset_url, data.url),
        assetId: firstText(data.previewVideoAssetId, data.preview_video_asset_id, data.assetId, data.asset_id),
        durationSec: toNumber(data.durationSec ?? data.duration_sec, selectedStableBlockDurationV204F1),
        sceneCount: toNumber(data.sceneCount ?? data.scene_count, selectedStableBlockScenesV204F1.length),
        createdAt: nowIso(),
      }
      if (!firstText(previewVideo.apiPath, previewVideo.url)) {
        throw new Error('Backend не вернул preview video.')
      }
      setStableBlockPreviewVideoV204G1(previewVideo)
      setStableBlockPreviewLoadingV204G1(false)
      setStableBlockPreviewUiPhaseV204G4('ready')
      setStableBlockPreviewPlayKeyV204G9(`${firstText(previewVideo.assetId, previewVideo.apiPath, previewVideo.url)}:${Date.now()}`)

      // V204G5_PERSIST_STABLE_BLOCK_PREVIEW_AFTER_F5
      const stablePreviewSnapshotV204G5 = {
        kind: 'video',
        stage: 'audio_studio',
        source: 'stable_block_preview_v204g5',
        apiPath: firstText(previewVideo.apiPath, previewVideo.url),
        assetApiPath: firstText(previewVideo.apiPath, previewVideo.url),
        url: firstText(previewVideo.url, previewVideo.apiPath),
        assetId: firstText(previewVideo.assetId),
        durationSec: previewVideo.durationSec,
        sceneCount: previewVideo.sceneCount,
        createdAt: previewVideo.createdAt || nowIso(),
      }
      const previewBlockIdV204G5 = cleanId(selectedSavedStableBlockV204F4?.id || payload.blockId || payload.block_id)
      if (previewBlockIdV204G5) {
        const currentSnapshotV204G5 = snapshotRef.current || snapshot
        const nextBlocksV204G5 = asArray(currentSnapshotV204G5.stableBlocks).map((block) => {
          if (cleanId(block?.id) !== previewBlockIdV204G5) return block
          return {
            ...block,
            previewVideo: stablePreviewSnapshotV204G5,
            stablePreviewVideo: stablePreviewSnapshotV204G5,
            updatedAt: nowIso(),
          }
        })
        const nextSnapshotV204G5 = { ...currentSnapshotV204G5, stableBlocks: nextBlocksV204G5, updatedAt: nowIso() }
        snapshotRef.current = nextSnapshotV204G5
        setSnapshot(nextSnapshotV204G5)
        persistSnapshotSilently(nextSnapshotV204G5, 'stable_block_preview_v204g5')
      }
      setStatus(`Блок собран: ${previewVideo.sceneCount || selectedStableBlockScenesV204F1.length} сцен · ${previewVideo.durationSec ? previewVideo.durationSec.toFixed(2) : selectedStableBlockDurationV204F1.toFixed(2)} сек · ${stablePreviewRefV204G6 ? 'Timing + MMAudio + STAU' : 'Timing + MMAudio'}`)
    } catch (err) {
      setStableBlockPreviewLoadingV204G1(false)
      setStableBlockPreviewUiPhaseV204G4('error')
      setError(`Не удалось собрать preview блока: ${err?.message || err}`)
      console.warn('[AUDIO STUDIO STABLE BLOCK PREVIEW FAILED V204G1]', err)
    } finally {
      stablePreviewBlockBusyRefV211T.current = false
      setStableBlockPreviewLoadingV204G1(false)
    }
  // V204G1A_FIX_PREVIEW_TDZ
  // Do not put prepareTimingAudioForSceneV204E10 in this dependency array here:
  // in the current file it is declared lower in the component, and reading it during render
  // triggers the JS temporal-dead-zone crash before Audio Studio can mount.
  }, [buildStableAudioRequestPayloadV204F7, persistSnapshotSilently, projectId, selectedSavedStableBlockV204F4, selectedStableAudioVariantV204G6, selectedStableBlockDurationV204F1, selectedStableBlockSceneIdsV204F1, selectedStableBlockScenesV204F1, stableAudioVariantVolumeForUiV204G13])

  const updateStableAudioVariantVolumeV204G6 = useCallback((variantId, value) => {
    const blockId = cleanId(selectedSavedStableBlockV204F4?.id || activeStableBlockIdV204F4)
    const id = cleanId(variantId)
    if (!blockId || !id) return
    const volume = stableAudioVolumeV204F7(value, DEFAULT_STAU_VOLUME_PERCENT_V204G18)
    const key = stableAudioVolumeDraftKeyV204G13(blockId, id)

    stableAudioSelectedVariantIdLiveRefV204H13.current = id
    stableAudioSelectedVariantBlockIdLiveRefV211V.current = blockId
    setActiveStableBlockIdV204F4(blockId)
    stableAudioVolumeDraftsLiveRefV204H13.current = { ...stableAudioVolumeDraftsLiveRefV204H13.current, [key]: volume }
    setStableAudioVolumeDraftsV204G13((prev) => ({ ...prev, [key]: volume }))

    const current = sanitizeAudioSnapshot(snapshotRef.current || {})
    const nextBlocks = asArray(current.stableBlocks).map((block) => {
      if (cleanId(block.id) !== blockId) return block
      const stableAudio = block.stableAudio || {}
      const nextVariants = asArray(stableAudio.variants).map((variant) => {
        const variantKey = cleanId(variant.id || variant.variantId || variant.variant_id)
        const isTarget = variantKey === id
        return { ...variant, selected: isTarget, volume: isTarget ? volume : variant.volume, updatedAt: isTarget ? nowIso() : variant.updatedAt }
      })
      return {
        ...block,
        volume,
        stableAudio: {
          ...stableAudio,
          volume,
          selectedVariantId: id,
          selected_variant_id: id,
          variants: nextVariants,
          updatedAt: nowIso(),
        },
        updatedAt: nowIso(),
      }
    })
    const next = { ...current, stableBlocks: nextBlocks, updatedAt: nowIso() }
    snapshotRef.current = next
    setSnapshot(next)
    console.info('[AUDIO STUDIO STAU VOLUME LIVE V204H18]', { blockId, variantId: id, volumePercent: volume })
  }, [activeStableBlockIdV204F4, selectedSavedStableBlockV204F4, stableAudioVolumeDraftKeyV204G13])

  const selectStableAudioVariantV204G6 = useCallback((variantId) => {
    const blockId = cleanId(selectedSavedStableBlockV204F4?.id || activeStableBlockIdV204F4)
    const id = cleanId(variantId)
    if (!blockId || !id) return
    stableAudioSelectedVariantIdLiveRefV204H13.current = id
    stableAudioSelectedVariantBlockIdLiveRefV211V.current = blockId
    setActiveStableBlockIdV204F4(blockId)
    const current = sanitizeAudioSnapshot(snapshotRef.current || {})
    const nextBlocks = asArray(current.stableBlocks).map((block) => {
      if (cleanId(block.id) !== blockId) return block
      const stableAudio = block.stableAudio || {}
      const nextVariants = asArray(stableAudio.variants).map((variant) => {
        const variantKey = cleanId(variant.id || variant.variantId || variant.variant_id)
        return { ...variant, selected: variantKey === id }
      })
      const chosen = nextVariants.find((variant) => cleanId(variant.id || variant.variantId || variant.variant_id) === id) || null
      return {
        ...block,
        stableAudio: {
          ...stableAudio,
          volume: stableAudioVolumeV204F7(chosen?.volume ?? stableAudio.volume ?? block.volume ?? DEFAULT_STAU_VOLUME_PERCENT_V204G14, DEFAULT_STAU_VOLUME_PERCENT_V204G14),
          selectedVariantId: id,
          selected_variant_id: id,
          variants: nextVariants,
          updatedAt: nowIso(),
        },
        updatedAt: nowIso(),
      }
    })
    const next = { ...current, stableBlocks: nextBlocks, updatedAt: nowIso() }
    snapshotRef.current = next
    setSnapshot(next)
    persistSnapshotSilently(next, 'stable_audio_variant_select_v204h18')
    setStatus('STAU вариант выбран в сборку. Теперь “Собрать блок” возьмёт только его.')
    console.info('[AUDIO STUDIO STAU SELECT SINGLE V204H18]', { blockId, variantId: id })
  }, [activeStableBlockIdV204F4, persistSnapshotSilently, selectedSavedStableBlockV204F4])

  const removeStableAudioVariantV204G7B = useCallback((variantId) => {
    const blockId = cleanId(selectedSavedStableBlockV204F4?.id)
    const id = cleanId(variantId)
    if (!blockId || !id) return
    const current = sanitizeAudioSnapshot(snapshotRef.current || {})
    const nextBlocks = asArray(current.stableBlocks).map((block) => {
      if (cleanId(block.id) !== blockId) return block
      const stableAudio = block.stableAudio || {}
      const variants = asArray(stableAudio.variants).filter((variant) => cleanId(variant.id || variant.variantId) !== id)
      const selectedId = cleanId(stableAudio.selectedVariantId || stableAudio.selected_variant_id)
      const appliedId = cleanId(stableAudio.appliedVariantId || stableAudio.applied_variant_id)
      const replacement = variants[0] || null
      const nextStableAudio = {
        ...stableAudio,
        variants,
        selectedVariantId: selectedId === id ? cleanId(replacement?.id || replacement?.variantId) : stableAudio.selectedVariantId,
        selected_variant_id: selectedId === id ? cleanId(replacement?.id || replacement?.variantId) : stableAudio.selected_variant_id,
        appliedVariantId: appliedId === id ? '' : stableAudio.appliedVariantId,
        applied_variant_id: appliedId === id ? '' : stableAudio.applied_variant_id,
        updatedAt: nowIso(),
      }
      return { ...block, stableAudio: nextStableAudio, updatedAt: nowIso() }
    })
    const next = { ...current, stableBlocks: nextBlocks, updatedAt: nowIso() }
    snapshotRef.current = next
    setSnapshot(next)
    persistSnapshotSilently(next, 'stable_audio_variant_delete_v204g7b')
    setStatus('Stable Audio вариант удалён из блока.')
  }, [persistSnapshotSilently, selectedSavedStableBlockV204F4])

  const applyStableAudioBlockV204F7 = useCallback(async () => {
    if (stableAudioApplyingV204H1) return

    const blockId = cleanId(selectedSavedStableBlockV204F4?.id || activeStableBlockIdV204F4)
    const current = sanitizeAudioSnapshot(snapshotRef.current || {})
    const targetBlock = asArray(current.stableBlocks).find((block) => cleanId(block.id) === blockId) || selectedSavedStableBlockV204F4 || null
    const targetStableAudio = targetBlock?.stableAudio || selectedSavedStableBlockV204F4?.stableAudio || {}
    const variants = asArray(targetStableAudio.variants)
    const liveStableVariantIdForApplyV211V = cleanId(stableAudioSelectedVariantBlockIdLiveRefV211V.current) === blockId
      ? stableAudioSelectedVariantIdLiveRefV204H13.current
      : ''
    const preferredVariantId = cleanId(
      liveStableVariantIdForApplyV211V
      || selectedStableAudioVariantV204G6?.id
      || selectedStableAudioVariantV204G6?.variantId
      || targetStableAudio.selectedVariantId
      || targetStableAudio.selected_variant_id
      || targetStableAudio.appliedVariantId
      || targetStableAudio.applied_variant_id,
    )
    const variant = preferredVariantId
      ? variants.find((item) => cleanId(item.id || item.variantId || item.variant_id) === preferredVariantId) || null
      : null
    const variantId = cleanId(variant?.id || variant?.variantId)
    const ref = stableAudioVariantRefV204G6(variant || {})

    if (!blockId || !targetBlock) {
      setError('Карта строится по всем сценам Audio Studio.')
      return
    }
    if (!variantId || !ref) {
      setError('Сначала сгенерируй Stable Audio вариант.')
      return
    }

    const defaultStauVolumeV204H1 = typeof DEFAULT_STAU_VOLUME_PERCENT_V204G14 !== 'undefined' ? DEFAULT_STAU_VOLUME_PERCENT_V204G14 : 30
    const draftKeyForApplyV204H13 = stableAudioVolumeDraftKeyV204G13(blockId, variantId)
    const draftVolumeForApplyV204H13 = Object.prototype.hasOwnProperty.call(stableAudioVolumeDraftsLiveRefV204H13.current, draftKeyForApplyV204H13)
      ? stableAudioVolumeDraftsLiveRefV204H13.current[draftKeyForApplyV204H13]
      : undefined
    const volume = stableAudioVolumeV204F7(
      draftVolumeForApplyV204H13
      ?? variant?.volume
      ?? targetStableAudio.volume
      ?? targetBlock?.volume
      ?? stableDraftVolumeV204F7
      ?? defaultStauVolumeV204H1,
      defaultStauVolumeV204H1,
    )
    const appliedAt = nowIso()
    const sceneIds = stableBlockSceneIdsV204F4(targetBlock)
    const durationSec = toNumber(targetBlock?.durationSec ?? targetBlock?.duration_sec, selectedStableBlockDurationV204F1)
    const startSec = toNumber(targetBlock?.startSec ?? targetBlock?.start_sec, 0)
    const endSec = toNumber(targetBlock?.endSec ?? targetBlock?.end_sec, startSec + durationSec)
    const appliedAudioRef = {
      id: `stau_apply_${variantId}`,
      kind: 'stable_audio_block_bed',
      source: 'audio_studio_stable_apply_v204h1',
      blockId,
      block_id: blockId,
      variantId,
      variant_id: variantId,
      ref,
      apiPath: firstText(variant?.apiPath, variant?.api_path, variant?.assetApiPath, variant?.asset_api_path, ref),
      url: firstText(variant?.url, variant?.assetUrl, variant?.asset_url, ref),
      assetId: firstText(variant?.assetId, variant?.asset_id),
      volume,
      volumePercent: volume,
      mode: stableAudioModeApiValueV204F7(variant?.mode || targetStableAudio.mode || targetBlock?.mode || stableDraftModeV204F7 || 'Music'),
      prompt: firstText(variant?.prompt, targetStableAudio.prompt, targetBlock?.prompt, stableDraftPromptV204F7),
      sceneIds,
      scene_ids: sceneIds,
      startSec,
      start_sec: startSec,
      endSec,
      end_sec: endSec,
      durationSec,
      duration_sec: durationSec,
      exactDurationSec: durationSec,
      exact_duration_sec: durationSec,
      appliedAt,
      applied_at: appliedAt,
      assemblyReady: true,
      assembly_ready: true,
      sendToAssembly: true,
      send_to_assembly: true,
    }

    setError('')
    setStableAudioApplyingV204H1(true)
    setStatus(`Применяю Stable Audio к блоку: ${sceneIds.length || 0} сцен · громкость ${volume}%…`)

    try {
      const nextBlocks = asArray(current.stableBlocks).map((block) => {
        if (cleanId(block.id) !== blockId) return block
        const stableAudio = block.stableAudio || {}
        const baseVariants = asArray(stableAudio.variants)
        const variantsForApply = baseVariants.some((item) => cleanId(item.id || item.variantId) === variantId)
          ? baseVariants
          : [{ ...(variant || {}), id: variantId, variantId }, ...baseVariants]
        const nextVariants = variantsForApply.map((item) => {
          const isTarget = cleanId(item.id || item.variantId) === variantId
          return {
            ...item,
            selected: isTarget,
            applied: isTarget,
            volume: isTarget ? volume : item.volume,
            updatedAt: isTarget ? appliedAt : item.updatedAt,
          }
        })
        const nextStableAudio = {
          ...stableAudio,
          enabled: true,
          status: 'applied',
          volume,
          selectedVariantId: variantId,
          selected_variant_id: variantId,
          appliedVariantId: variantId,
          applied_variant_id: variantId,
          appliedAt,
          applied_at: appliedAt,
          appliedVolume: volume,
          applied_volume: volume,
          appliedVariant: { ...(variant || {}), volume, selected: true, applied: true, updatedAt: appliedAt },
          applied_variant: { ...(variant || {}), volume, selected: true, applied: true, updatedAt: appliedAt },
          appliedAudio: appliedAudioRef,
          applied_audio: appliedAudioRef,
          assembly: {
            layer: 'stable_audio_block_bed',
            ref,
            volume,
            sceneIds,
            startSec,
            endSec,
            durationSec,
            variantId,
            appliedAt,
          },
          variants: nextVariants,
          updatedAt: appliedAt,
        }
        return {
          ...block,
          status: 'stable_audio_applied',
          volume,
          stableAudioApplied: true,
          stable_audio_applied: true,
          appliedStableAudioVariantId: variantId,
          applied_stable_audio_variant_id: variantId,
          appliedStableAudioRef: ref,
          applied_stable_audio_ref: ref,
          appliedStableAudio: appliedAudioRef,
          applied_stable_audio: appliedAudioRef,
          stableAudio: nextStableAudio,
          updatedAt: appliedAt,
        }
      })

      const appliedBlocksForAssemblyV211X = nextBlocks
        .filter((block) => Boolean(block?.appliedStableAudio || block?.applied_stable_audio || block?.stableAudio?.appliedAudio || block?.stableAudio?.applied_audio))
        .map((block) => ({
          ...block,
          assemblyReady: true,
          assembly_ready: true,
          sendToAssembly: true,
          send_to_assembly: true,
        }))

      const next = {
        ...current,
        stableBlocks: nextBlocks,
        appliedStableAudioBlocks: appliedBlocksForAssemblyV211X,
        applied_stable_audio_blocks: appliedBlocksForAssemblyV211X,
        assemblyStableAudioBlocks: appliedBlocksForAssemblyV211X,
        stableAudioBlocks: appliedBlocksForAssemblyV211X,
        stable_audio_blocks: appliedBlocksForAssemblyV211X,
        stauBlocks: appliedBlocksForAssemblyV211X,
        stau_blocks: appliedBlocksForAssemblyV211X,
        stableAudio: {
          ...(current.stableAudio || {}),
          enabled: true,
          updatedAt: appliedAt,
          appliedBlockCountV211X: appliedBlocksForAssemblyV211X.length,
        },
        updatedAt: appliedAt,
      }
      console.info('[AUDIO STUDIO STAU APPLY ASSEMBLY SNAPSHOT V211X]', {
        projectId,
        blockId,
        variantId,
        sceneCount: sceneIds.length,
        appliedBlockCount: appliedBlocksForAssemblyV211X.length,
        ref,
        volumePercent: volume,
      })
      snapshotRef.current = next
      setSnapshot(next)
      await Promise.resolve(persistSnapshotSilently(next, 'stable_audio_variant_applied_v204h1'))
      await new Promise((resolve) => setTimeout(resolve, 180))
      setStatus(`Stable Audio применён к блоку “${targetBlock.title || stableDisplayBlockTitleV204F3 || blockId}” · ${sceneIds.length || 0} сцен · ${volume}% · готово для монтажки`)
    } catch (err) {
      setError(`Stable Audio не применился: ${err?.message || err}`)
      console.warn('[AUDIO STUDIO STABLE AUDIO APPLY FAILED V204H1]', err)
    } finally {
      setStableAudioApplyingV204H1(false)
    }
  }, [activeStableBlockIdV204F4, persistSnapshotSilently, selectedSavedStableBlockV204F4, selectedStableAudioVariantV204G6, selectedStableBlockDurationV204F1, stableAudioApplyingV204H1, stableAudioVariantVolumeForUiV204G13, stableDisplayBlockTitleV204F3, stableDraftModeV204F7, stableDraftPromptV204F7, stableDraftVolumeV204F7])

  // V204F2_STABLE_BLOCK_VISUAL_CTRL_SELECT  // V204F2_STABLE_BLOCK_VISUAL_CTRL_SELECT
  const timingAudioRefForMixV204E9 = firstText(
    selectedScene?.sourceAudio?.apiPath,
    selectedScene?.sourceAudio?.url,
    selectedScene?.audio?.apiPath,
    selectedScene?.audio?.url,
    selectedScene?.audioApiPath,
    selectedScene?.audioUrl,
    selectedScene?.boardRaw ? boardSourceAudioRef(selectedScene.boardRaw) : '',
  )

  const timingAudioSourceRefV204E8 = firstText(
    selectedScene?.sourceAudio?.apiPath,
    selectedScene?.sourceAudio?.url,
    selectedScene?.audio?.apiPath,
    selectedScene?.audio?.url,
    selectedScene?.audioApiPath,
    selectedScene?.audioUrl,
    selectedScene?.boardRaw ? audioStudioBoardAudioRefV204E8(selectedScene.boardRaw) : '',
    typeof sourceAudioRefForMixV204E5A !== 'undefined' ? sourceAudioRefForMixV204E5A : '',
    typeof sourceAudioRef === 'string' ? sourceAudioRef : '',
  )

  const mixTimingSourceRefV204E7 = firstText(
    selectedScene?.sourceAudio?.apiPath,
    selectedScene?.sourceAudio?.url,
    selectedScene?.audio?.apiPath,
    selectedScene?.audio?.url,
    selectedScene?.audioApiPath,
    selectedScene?.audioUrl,
    selectedScene?.boardRaw ? boardSourceAudioRefV204E7(selectedScene.boardRaw) : '',
    typeof sourceAudioRefForMixV204E5A !== 'undefined' ? sourceAudioRefForMixV204E5A : '',
    typeof sourceAudioRef === 'string' ? sourceAudioRef : '',
    sourceVideoRef,
  )

  useEffect(() => {
    let alive = true
    let objectUrl = ''
    const clean = cleanId(mixTimingSourceRefV204E7)
    setMixTimingAudioSrcV204E7('')
    setMixPreviewPlayingV204E7(false)

    if (mixPlaybackTimerRefV204E7.current) {
      clearTimeout(mixPlaybackTimerRefV204E7.current)
      mixPlaybackTimerRefV204E7.current = null
    }

    if (!clean) return undefined

    const setUrl = (url, blob = '') => {
      if (!alive) return
      objectUrl = blob
      setMixTimingAudioSrcV204E7(url)
    }

    if (/^(blob:|data:|https?:)/i.test(clean)) {
      setUrl(clean)
      return undefined
    }

    if (/\/(api\/)?assets\/[^/]+\/file/i.test(clean)) {
      fetchProtectedBlobUrl(clean)
        .then((url) => setUrl(url, url))
        .catch((err) => {
          console.warn('[AUDIO STUDIO MIX TIMING AUDIO LOAD FAILED V204E7]', err)
          if (alive) setMixTimingAudioSrcV204E7('')
        })
    } else {
      setUrl(buildApiUrl(clean))
    }

    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [mixTimingSourceRefV204E7])


  const selectedIsApplied = Boolean(selectedVariant && appliedVariant && cleanId(selectedVariant.id) === cleanId(appliedVariant.id))
  // V204E10_AUDIO_STUDIO_PRELOAD_TIMING_AUDIO:
  // Prepare and cache per-scene Timing audio once, then keep the ref in Audio Studio snapshot.
  const prepareTimingAudioForSceneV204E10 = useCallback(async (scene, options = {}) => {
    const target = scene || selectedScene
    const sceneId = cleanId(target?.id || target?.sceneId)
    if (!target || !sceneId) throw new Error('Нет сцены для подготовки аудио.')

    const existing = audioStudioTimingAudioRefV204E10(target)
    if (existing) return existing

    if (timingAudioPreparePromisesRefV204E10.current[sceneId]) {
      return timingAudioPreparePromisesRefV204E10.current[sceneId]
    }

    const { start, end, durationSec } = audioStudioTimingRangeV204E10(target)
    if (!(end > start)) {
      throw new Error(`У сцены нет корректного диапазона start/end: ${start}–${end}`)
    }

    const promise = (async () => {
      if (!options.silent) setStatus(`Готовлю аудио тайминга ${sceneId}…`)
      setTimingAudioPreparingSceneIdV204E10(sceneId)

      console.log('[AUDIO STUDIO TIMING AUDIO PRELOAD REQUEST V204E10]', {
        projectId,
        sceneId,
        start,
        end,
        durationSec,
        reason: options.reason || 'manual',
      })

      const data = await apiRequest('/manual-clip/slice-audio', {
        method: 'POST',
        body: JSON.stringify({
          project_id: projectId,
          projectId,
          scene_id: sceneId,
          sceneId,
          start_sec: start,
          startSec: start,
          end_sec: end,
          endSec: end,
          duration_sec: durationSec,
          durationSec,
          format: 'mp3',
          source: options.reason || 'audio_studio_preload_v204e10',
        }),
      })

      const sourceAudio = audioStudioSourceAudioFromSliceResponseV204E10(data, target)
      const ref = firstText(sourceAudio.apiPath, sourceAudio.url)
      if (!ref) throw new Error('Backend не вернул audio slice.')

      const current = sanitizeAudioSnapshot(snapshotRef.current || {})
      const next = {
        ...current,
        scenes: asArray(current.scenes).map((item) => cleanId(item.id || item.sceneId) === sceneId
          ? { ...item, sourceAudio, timingAudioReadyV204E10: true, updatedAt: nowIso() }
          : item),
        selectedSceneId: current.selectedSceneId || sceneId,
        updatedAt: nowIso(),
      }

      snapshotRef.current = next
      setSnapshot(next)
      await saveSnapshot(sanitizeAudioSnapshot(next), 'audio_studio_timing_audio_preload_v204e10')

      if (!options.silent) setStatus(`Аудио сцены ${sceneId} готово`)
      console.log('[AUDIO STUDIO TIMING AUDIO PRELOAD READY V204E10]', { sceneId, ref })
      return ref
    })()

    timingAudioPreparePromisesRefV204E10.current[sceneId] = promise

    try {
      return await promise
    } finally {
      delete timingAudioPreparePromisesRefV204E10.current[sceneId]
      setTimingAudioPreparingSceneIdV204E10((currentId) => cleanId(currentId) === sceneId ? '' : currentId)
    }
  }, [projectId, saveSnapshot, selectedScene])

  const prepareSelectedTimingAudioV204E10 = useCallback(async () => {
    if (!selectedScene) return
    setError('')
    try {
      await prepareTimingAudioForSceneV204E10(selectedScene, { reason: 'manual_audio_ready_button_v204e10', silent: false })
    } catch (err) {
      setError(`Не удалось подготовить аудио сцены: ${err?.message || err}`)
    }
  }, [prepareTimingAudioForSceneV204E10, selectedScene])

  // Background warm-up: one at a time, cached in the snapshot. Current scene first, then the rest.
  useEffect(() => {
    const scenes = asArray(snapshot.scenes)
    if (!scenes.length || !projectId) return undefined

    const pending = scenes.filter((scene) => !audioStudioTimingAudioRefV204E10(scene))
    if (!pending.length) return undefined

    const selectedId = cleanId(selectedScene?.id || selectedScene?.sceneId)
    const ordered = [
      ...pending.filter((scene) => cleanId(scene.id || scene.sceneId) === selectedId),
      ...pending.filter((scene) => cleanId(scene.id || scene.sceneId) !== selectedId),
    ]

    const key = ordered.map((scene) => cleanId(scene.id || scene.sceneId)).join('|')
    if (!key || timingAudioAutoWarmKeyRefV204E10.current === key) return undefined
    timingAudioAutoWarmKeyRefV204E10.current = key

    let cancelled = false
    ;(async () => {
      for (const scene of ordered) {
        if (cancelled) return
        try {
          await prepareTimingAudioForSceneV204E10(scene, { reason: 'auto_preload_audio_studio_v204e10', silent: true })
        } catch (err) {
          console.warn('[AUDIO STUDIO TIMING AUDIO AUTO PRELOAD FAILED V204E10]', cleanId(scene.id || scene.sceneId), err)
          return
        }
      }
    })()

    return () => { cancelled = true }
  }, [projectId, selectedScene?.id, selectedScene?.sceneId, snapshot.scenes, prepareTimingAudioForSceneV204E10])

  const previewTimingAudioMmaudioMixV204E10 = useCallback(async () => {
    setError('')

    const stopMixV204E10 = () => {
      try { timingAudioPlaybackRefV204E10.current?.pause?.() } catch {}
      const rightVideo = document.querySelector('.avaAudioResultPanel video.avaAudioResultVideo') || document.querySelector('.avaAudioResultPanel video')
      try { rightVideo?.pause?.() } catch {}
      if (timingAudioPlaybackStopTimerRefV204E10.current) {
        clearTimeout(timingAudioPlaybackStopTimerRefV204E10.current)
        timingAudioPlaybackStopTimerRefV204E10.current = null
      }
      if (timingAudioPlaybackBlobUrlRefV204E10.current) {
        try { URL.revokeObjectURL(timingAudioPlaybackBlobUrlRefV204E10.current) } catch {}
        timingAudioPlaybackBlobUrlRefV204E10.current = ''
      }
      timingAudioPlaybackRefV204E10.current = null
      setTimingAudioMixPlayingV204E10(false)
    }

    if (timingAudioMixPlayingV204E10) {
      stopMixV204E10()
      setStatus('Микс остановлен')
      return
    }

    if (!selectedScene) {
      setError('Нет выбранной сцены.')
      return
    }

    const rightVideo = document.querySelector('.avaAudioResultPanel video.avaAudioResultVideo') || document.querySelector('.avaAudioResultPanel video')
    if (!rightVideo || !selectedResultRef) {
      setError('Нет правого MMAudio-варианта для микса.')
      return
    }

    const resolvePlayableAudioUrlV204E10 = async (ref) => {
      const clean = cleanId(ref)
      if (!clean) return { url: '', blobUrl: '' }
      if (/^(blob:|data:|https?:)/i.test(clean)) return { url: clean, blobUrl: '' }
      if (/\/(api\/)?assets\/[^/]+\/file/i.test(clean)) {
        const blobUrl = await fetchProtectedBlobUrl(clean)
        return { url: blobUrl, blobUrl }
      }
      return { url: buildApiUrl(clean), blobUrl: '' }
    }

    try {
      stopMixV204E10()

      const timingRef = firstText(
        audioStudioTimingAudioRefV204E10(selectedScene),
        await prepareTimingAudioForSceneV204E10(selectedScene, { reason: 'mix_button_missing_audio_v204e10', silent: false }),
      )

      const playable = await resolvePlayableAudioUrlV204E10(timingRef)
      if (!playable.url) throw new Error('Нет playable URL для аудио сцены.')

      const timingAudio = new Audio(playable.url)
      timingAudio.preload = 'auto'
      timingAudio.volume = 1
      timingAudio.currentTime = 0
      timingAudio.onended = () => setTimingAudioMixPlayingV204E10(false)

      timingAudioPlaybackRefV204E10.current = timingAudio
      timingAudioPlaybackBlobUrlRefV204E10.current = playable.blobUrl || ''

      const mmaudioGain = clampMediaVolumeV204E10A(Number(activeVolume) / 100, 1)
      try { rightVideo.pause?.() } catch {}
      try { rightVideo.currentTime = 0 } catch {}
      try { rightVideo.muted = false } catch {}
      try { rightVideo.volume = clampMediaVolumeV204E10A(mmaudioGain, 1) } catch {}

      console.log('[AUDIO STUDIO MIX PLAY V204E10]', {
        sceneId: selectedScene.id || selectedScene.sceneId,
        timingRef,
        timingUrl: playable.url,
        rightVideoSrc: rightVideo.currentSrc || rightVideo.src || '',
        mmaudioGain,
        audioWasReady: Boolean(selectedTimingAudioRefV204E10),
      })

      setStatus(`Прослушивание микса: аудио сцены 100% + MMAudio ${Math.round(mmaudioGain * 100)}%`)

      const safePlayLayerV204E11 = async (node, label, required = false) => {
        try {
          await node.play()
          return true
        } catch (playErr) {
          if (isInterruptedPlayErrorV204E11(playErr)) {
            console.warn('[AUDIO STUDIO MIX PLAY INTERRUPTED V204E11]', label, playErr)
            return false
          }
          if (required) throw playErr
          console.warn('[AUDIO STUDIO MIX OPTIONAL PLAY FAILED V204E11]', label, playErr)
          return false
        }
      }

      // Start both layers from the same click. Timing is the important layer; MMAudio is allowed to recover on the next click if browser interrupted it.
      const [timingStarted, mmaudioStarted] = await Promise.all([
        safePlayLayerV204E11(timingAudio, 'timing-audio', true),
        safePlayLayerV204E11(rightVideo, 'right-mmaudio-video', false),
      ])

      if (!timingStarted && !mmaudioStarted) {
        throw new Error('Браузер остановил оба слоя прослушивания.')
      }

      setTimingAudioMixPlayingV204E10(true)
      const stopAfterMs = Math.max(1500, Math.ceil(toNumber(selectedScene.durationSec, 5) * 1000) + 700)
      timingAudioPlaybackStopTimerRefV204E10.current = setTimeout(() => {
        setTimingAudioMixPlayingV204E10(false)
        timingAudioPlaybackStopTimerRefV204E10.current = null
      }, stopAfterMs)
    } catch (err) {
      stopMixV204E10()
      setError(`Не удалось запустить микс: ${err?.message || err}`)
      console.warn('[AUDIO STUDIO MIX FAILED V204E10]', err)
    }
  }, [activeVolume, prepareTimingAudioForSceneV204E10, selectedResultRef, selectedScene, selectedTimingAudioRefV204E10, timingAudioMixPlayingV204E10])


  // V211D_PREVIEW_MAP_NOTES
  const previewMapDataV211D = snapshot.previewMapV211D || {}
  const previewMapNotesV211D = previewNotesTextV211N(previewMapDataV211D.notes, snapshot.previewNotesV211D)
  const previewMapParsedRowsV211D = useMemo(() => {
    return String(previewMapNotesV211D || '')
      .split(/\r?\n/g)
      .map((raw, index) => {
        const line = raw.trim()
        if (!line) return null
        const match = line.match(/^(\d+)(?:\s*[-–—]\s*(\d+))?\s+(.+)$/)
        const start = match ? Math.max(1, Number(match[1]) || 1) : 0
        const end = match ? Math.max(start, Number(match[2] || match[1]) || start) : 0
        const text = match ? match[3].trim() : line
        const lower = text.toLowerCase()
        const kind = lower.includes('мма') || lower.includes('mma')
          ? 'MMA'
          : (lower.includes('sfx') || lower.includes('сфх') ? 'SFX' : (lower.includes('стейбл') || lower.includes('stable') || lower.includes('stau') ? 'STAU' : 'NOTE'))
        return { id: `note_${index}`, line, start, end, text, kind }
      })
      .filter(Boolean)
  }, [previewMapNotesV211D])

  const previewMapTimelineRowsV211D = useMemo(() => {
    return asArray(snapshot.scenes).map((scene, index) => {
      const rawStart = scene.startSec ?? scene.start_sec ?? scene.start
      const duration = Math.max(0.01, toNumber(scene.durationSec ?? scene.duration_sec, durationOf(scene), 0))
      const start = toNumber(rawStart, index === 0 ? 0 : null)
      const fallbackStart = index === 0 ? 0 : asArray(snapshot.scenes).slice(0, index).reduce((sum, item) => sum + Math.max(0, toNumber(item.durationSec ?? item.duration_sec, durationOf(item), 0)), 0)
      const safeStart = Number.isFinite(start) ? start : fallbackStart
      const explicitEnd = scene.endSec ?? scene.end_sec ?? scene.end
      const end = explicitEnd !== undefined && explicitEnd !== null && explicitEnd !== '' ? toNumber(explicitEnd, safeStart + duration) : safeStart + duration
      const number = Number(scene.index ?? index)
      return {
        scene,
        index,
        sceneId: firstText(scene.id, scene.sceneId, scene.scene_id, `seg_${String(index + 1).padStart(2, '0')}`),
        displayNumber: Number.isFinite(number) ? number + 1 : index + 1,
        start: safeStart,
        end: Math.max(safeStart + 0.01, end),
        duration: Math.max(0.01, end - safeStart),
      }
    })
  }, [snapshot.scenes])

  const previewMapCurrentSceneV211D = useMemo(() => {
    const rows = previewMapTimelineRowsV211D
    if (!rows.length) return null
    const t = Math.max(0, Number(previewMapCurrentTimeV211D) || 0)
    return rows.find((row) => t >= row.start && t < row.end) || rows[rows.length - 1]
  }, [previewMapCurrentTimeV211D, previewMapTimelineRowsV211D])

  const previewMapVideoV211D = previewMapDataV211D.fullVideo || previewMapDataV211D.fullProjectVideo || previewMapDataV211D.previewVideo || null
  const previewMapVideoSourceV211D = firstText(
    previewMapVideoV211D?.apiPath,
    previewMapVideoV211D?.assetApiPath,
    previewMapVideoV211D?.url,
    sourceVideoRef,
  )
  const previewMapVideoLabelV211D = previewMapVideoV211D
    ? `полное видео · ${toNumber(previewMapVideoV211D.durationSec, previewMapTimelineRowsV211D.at(-1)?.end || 0).toFixed(2)} сек`
    : 'полное preview ещё не выбрано'
  const previewMapBlockLabelV211D = `полная карта · ${asArray(snapshot.scenes).length} сцен`

  const updatePreviewMapNotesV211D = useCallback((value) => {
    setSnapshot((current) => {
      const next = {
        ...current,
        previewMapV211D: {
          ...(current.previewMapV211D || {}),
          notes: value,
          updatedAt: nowIso(),
        },
        previewNotesV211D: value,
        updatedAt: nowIso(),
      }
      snapshotRef.current = next
      return next
    })
  }, [])


  // V211M_NATIVE_PREVIEW_NOTES_MULTILINE
  const insertPreviewMapLineBreakV211M = useCallback((node = previewMapNotesTextareaRefV211M.current) => {
    if (!node) return
    const value = String(node.value || '')
    const start = Number.isFinite(node.selectionStart) ? node.selectionStart : value.length
    const end = Number.isFinite(node.selectionEnd) ? node.selectionEnd : value.length
    const lineBreak = String.fromCharCode(10)
    const nextValue = `${value.slice(0, start)}${lineBreak}${value.slice(end)}`
    updatePreviewMapNotesV211D(nextValue)
    window.requestAnimationFrame(() => {
      try {
        node.focus()
        node.selectionStart = start + 1
        node.selectionEnd = start + 1
      } catch (_err) {}
    })
  }, [updatePreviewMapNotesV211D])

  useEffect(() => {
    const handler = (event) => {
      const node = event.target
      if (!node || node.getAttribute?.('data-preview-notes-editor-v211m') !== '1') return
      const isEnter = event.key === 'Enter' || event.code === 'Enter' || event.code === 'NumpadEnter'
      if (!isEnter) return
      event.preventDefault()
      event.stopPropagation()
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation()
      insertPreviewMapLineBreakV211M(node)
    }

    window.addEventListener('keydown', handler, true)
    document.addEventListener('keydown', handler, true)
    return () => {
      window.removeEventListener('keydown', handler, true)
      document.removeEventListener('keydown', handler, true)
    }
  }, [insertPreviewMapLineBreakV211M])

  const savePreviewMapNotesV211D = useCallback(async () => {
    const current = snapshotRef.current || snapshot
    const next = {
      ...current,
      previewMapV211D: {
        ...(current.previewMapV211D || {}),
        notes: previewNotesTextV211N(current.previewMapV211D?.notes, current.previewNotesV211D),
        blockId: cleanId(selectedSavedStableBlockV204F4?.id || activeStableBlockIdV204F4),
        blockTitle: firstText(selectedSavedStableBlockV204F4?.title, stableDraftBlockTitleV204F3),
        fullVideo: previewMapVideoV211D || current.previewMapV211D?.fullVideo || current.previewMapV211D?.previewVideo || null,
        previewVideo: previewMapVideoV211D || current.previewMapV211D?.previewVideo || null,
        updatedAt: nowIso(),
      },
      previewNotesV211D: previewNotesTextV211N(current.previewMapV211D?.notes, current.previewNotesV211D),
      updatedAt: nowIso(),
    }
    await saveSnapshot(next, 'preview_map_notes_v211d')
    setStatus('Preview-разметка сохранена')
  }, [activeStableBlockIdV204F4, previewMapVideoV211D, saveSnapshot, selectedSavedStableBlockV204F4, snapshot, stableDraftBlockTitleV204F3])


  const loadFullProjectPreviewV211E = useCallback(async () => {
    setPreviewFullProjectLoadingV211E(true)
    setError('')
    try {
      const data = workspaceMode
        ? await loadWorkspaceStage('board_assembly')
        : await loadStage(projectId, 'board_assembly')
      const picked = pickFullProjectPreviewVideoV211E(data || {})
      if (!picked || !firstText(picked.apiPath, picked.url)) {
        setStatus('Полное видео ещё не найдено. Сначала собери проект в монтажке, потом вернись в Preview / Разметка.')
        return
      }
      const current = snapshotRef.current || snapshot
      const next = {
        ...current,
        previewMapV211D: {
          ...(current.previewMapV211D || {}),
          notes: previewNotesTextV211N(current.previewMapV211D?.notes, current.previewNotesV211D),
          fullVideo: picked,
          fullProjectVideo: picked,
          source: 'board_assembly_full_project_v211e',
          updatedAt: nowIso(),
        },
        previewNotesV211D: previewNotesTextV211N(current.previewMapV211D?.notes, current.previewNotesV211D),
        updatedAt: nowIso(),
      }
      snapshotRef.current = next
      setSnapshot(next)
      await persistSnapshotSilently(next, 'preview_full_project_video_v211e')
      setPreviewMapCurrentTimeV211D(0)
      setStatus('Полное preview-видео найдено и сохранено в Audio Studio. После F5 оно откроется без пересборки.')
    } catch (err) {
      setError(`Не удалось подтянуть полное видео из монтажки: ${err?.message || err}`)
    } finally {
      setPreviewFullProjectLoadingV211E(false)
    }
  }, [loadStage, loadWorkspaceStage, persistSnapshotSilently, projectId, snapshot, workspaceMode])


  // V211F_FULL_PROJECT_PREVIEW_MAP_BUILD
  const buildFullPreviewMapV211F = useCallback(async () => {
    const current = sanitizeAudioSnapshot(snapshotRef.current || snapshot || {})
    const allScenes = asArray(current.scenes)
    if (!allScenes.length) {
      setStatus('Нет сцен для карты. Сначала обнови Audio Studio из Доски.')
      return
    }

    setError('')
    setStableBlockPreviewLoadingV204G1(true)
    setStableBlockPreviewUiPhaseV204G4('loading')
    setStatus(`Собираю карту сцен: ${allScenes.length} сцен · черновое качество…`)

    try {
      const preparedScenes = []
      for (const scene of allScenes) {
        if (!scene || typeof scene !== 'object' || Array.isArray(scene)) {
          console.warn('[AUDIO STUDIO FULL PREVIEW BAD SCENE SKIP V211V]', { valueType: typeof scene })
          continue
        }
        let timingRef = audioStudioTimingAudioRefV204E10(scene)
        try {
          // Function exists lower in this component. Do not put it into deps: this file already avoids TDZ for it.
          if (!timingRef && typeof prepareTimingAudioForSceneV204E10 === 'function') {
            timingRef = await prepareTimingAudioForSceneV204E10(scene, { reason: 'full_preview_map_v211v', silent: true })
          }
        } catch (sliceErr) {
          console.warn('[AUDIO STUDIO FULL PREVIEW TIMING SLICE WARN V211V]', {
            sceneId: firstText(scene?.id, scene?.sceneId, scene?.scene_id),
            error: String(sliceErr?.message || sliceErr),
          })
        }
        const sourceAudioBaseV211V = scene.sourceAudio && typeof scene.sourceAudio === 'object' && !Array.isArray(scene.sourceAudio)
          ? scene.sourceAudio
          : {}
        preparedScenes.push(timingRef ? {
          ...scene,
          sourceAudio: { ...sourceAudioBaseV211V, apiPath: timingRef, url: timingRef },
          timingAudioReadyV204E10: true,
        } : { ...scene })
      }
      if (!preparedScenes.length) {
        throw new Error('Нет валидных сцен для карты. Нажми “Обновить из Доски” и попробуй снова.')
      }

      const sceneIds = preparedScenes.map((scene, index) => firstText(scene.id, scene.sceneId, scene.scene_id, `seg_${String(index + 1).padStart(2, '0')}`))
      const startSec = Math.min(...preparedScenes.map((scene) => toNumber(scene.startSec ?? scene.start_sec ?? scene.start, 0)))
      const endSec = Math.max(...preparedScenes.map((scene) => {
        const start = toNumber(scene.startSec ?? scene.start_sec ?? scene.start, 0)
        const end = toNumber(scene.endSec ?? scene.end_sec ?? scene.end, 0)
        const duration = toNumber(scene.durationSec ?? scene.duration_sec, durationOf(scene), 0)
        return end > start ? end : start + duration
      }))
      const durationSec = Math.max(0, endSec - startSec)
      const cacheKey = sceneIds.map((sceneId, index) => {
        const scene = preparedScenes[index] || {}
        return [
          sceneId,
          firstText(scene.sourceVideo?.apiPath, scene.sourceVideo?.url, scene.videoApiPath, scene.videoUrl, scene.boardRaw ? boardSourceVideoRef(scene.boardRaw) : ''),
          toNumber(scene.startSec ?? scene.start_sec ?? scene.start, 0).toFixed(3),
          toNumber(scene.endSec ?? scene.end_sec ?? scene.end, 0).toFixed(3),
          toNumber(scene.durationSec ?? scene.duration_sec, durationOf(scene), 0).toFixed(3),
          firstText(scene.appliedVariantId, scene.mmaudioVideoApiPath, scene.mmaudio_video_api_path),
        ].join('@')
      }).join('|')

      const payload = {
        project_id: projectId || '',
        projectId: projectId || '',
        blockId: 'preview_map_full_project_v211f',
        block_id: 'preview_map_full_project_v211f',
        block: {
          id: 'preview_map_full_project_v211f',
          title: 'Карта сцен всего проекта',
          sceneIds,
          scene_ids: sceneIds,
          startSec,
          endSec,
          durationSec,
          requestDurationSec: Math.ceil(durationSec || 0),
          color: '#22D3EE',
        },
        scenes: preparedScenes,
        includeStableAudio: false,
        include_stable_audio: false,
        stableAudio: null,
        stable_audio: null,
        previewMap: true,
        preview_map: true,
        draftQuality: 'low',
        draft_quality: 'low',
        source: 'audio_studio_full_preview_map_v211f',
      }

      console.info('[AUDIO STUDIO FULL PREVIEW MAP REQUEST V211F]', {
        projectId,
        sceneCount: preparedScenes.length,
        durationSec,
        cacheKeyPreview: cacheKey.slice(0, 160),
      })

      const data = await apiRequest('/audio-studio/stable-preview/block', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      const previewVideo = {
        apiPath: firstText(data.previewVideoApiPath, data.preview_video_api_path, data.assetApiPath, data.asset_api_path, data.apiPath, data.api_path),
        url: firstText(data.previewVideoUrl, data.preview_video_url, data.assetUrl, data.asset_url, data.url),
        assetId: firstText(data.previewVideoAssetId, data.preview_video_asset_id, data.assetId, data.asset_id),
        durationSec: toNumber(data.durationSec ?? data.duration_sec, durationSec),
        sceneCount: toNumber(data.sceneCount ?? data.scene_count, preparedScenes.length),
        cacheKey,
        source: 'audio_studio_full_preview_map_v211f',
        createdAt: nowIso(),
      }

      if (!firstText(previewVideo.apiPath, previewVideo.url)) {
        throw new Error('Backend не вернул full preview video.')
      }

      setStableBlockPreviewVideoV204G1(previewVideo)
      setStableBlockPreviewLoadingV204G1(false)
      setStableBlockPreviewUiPhaseV204G4('ready')
      setStableBlockPreviewPlayKeyV204G9(`${firstText(previewVideo.assetId, previewVideo.apiPath, previewVideo.url)}:${Date.now()}`)

      const next = {
        ...current,
        previewMapV211D: {
          ...(current.previewMapV211D || {}),
          fullPreviewVideo: previewVideo,
          fullVideo: previewVideo,
          projectPreviewVideo: previewVideo,
          previewVideo,
          cacheKey,
          sceneCount: preparedScenes.length,
          durationSec: previewVideo.durationSec,
          updatedAt: nowIso(),
        },
        updatedAt: nowIso(),
      }
      snapshotRef.current = next
      setSnapshot(next)
      persistSnapshotSilently(next, 'full_preview_map_v211f')

      console.info('[AUDIO STUDIO FULL PREVIEW MAP READY V211F]', {
        projectId,
        sceneCount: previewVideo.sceneCount,
        durationSec: previewVideo.durationSec,
        ref: firstText(previewVideo.apiPath, previewVideo.url),
      })
      setStatus(`Карта сцен собрана: ${previewVideo.sceneCount || preparedScenes.length} сцен · ${Number(previewVideo.durationSec || durationSec).toFixed(2)} сек`)
    } catch (err) {
      setStableBlockPreviewLoadingV204G1(false)
      setStableBlockPreviewUiPhaseV204G4('error')
      setError(`Не удалось собрать карту сцен: ${err?.message || err}`)
      console.warn('[AUDIO STUDIO FULL PREVIEW MAP FAILED V211F]', err)
    } finally {
      setStableBlockPreviewLoadingV204G1(false)
    }
  // V211F: prepareTimingAudioForSceneV204E10 is intentionally omitted from deps to avoid the existing TDZ pattern in this file.
  }, [persistSnapshotSilently, projectId, snapshot])

  const isGeneratingSelected = generatingSceneId && cleanId(generatingSceneId) === cleanId(selectedScene?.id)
  const isApplyingSelected = Boolean(applyingVariantId && cleanId(applyingVariantId) === cleanId(selectedVariant?.id))

  if (loading) {
    return (
      <div className="avaAudioStudioPage">
      <audio
        ref={mixTimingAudioRefV204E7}
        src={mixTimingAudioSrcV204E7}
        preload="auto"
        style={{ display: 'none' }}
      />
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
      {clearConfirmOpenV204C8 ? (
        <div className="avaAudioModalBackdropV204C8" role="presentation">
          <section className="avaAudioConfirmModalV204C8" role="dialog" aria-modal="true" aria-labelledby="avaAudioClearTitleV204C8">
            <button
              type="button"
              className="avaAudioModalCloseV204C8"
              onClick={() => setClearConfirmOpenV204C8(false)}
              disabled={clearingAllV204C8}
              title="Отмена"
            >
              <X size={16} />
            </button>
            <div className="avaAudioModalIconV204C8"><Trash2 size={22} /></div>
            <h2 id="avaAudioClearTitleV204C8">Очистить Audio Studio?</h2>
            <p>
              Будут удалены все сцены, prompt-поля, MMAudio-варианты, applied-выбор и локальная история этой страницы.
              Доска не изменится.
            </p>
            <div className="avaAudioModalNoticeV204C8">
              После очистки включится ручной режим: можно добавить свою сцену, загрузить видео и отправить результат в монтажку.
            </div>
            <div className="avaAudioModalActionsV204C8">
              <button type="button" onClick={() => setClearConfirmOpenV204C8(false)} disabled={clearingAllV204C8}>
                Отмена
              </button>
              <button type="button" className="isDanger" onClick={performClearAllAudioStudioV204C8} disabled={clearingAllV204C8}>
                {clearingAllV204C8 ? <span className="avaAudioModalSpinnerV204C8" /> : <Trash2 size={15} />}
                {clearingAllV204C8 ? 'Очищаю…' : 'Да, очистить всё'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {refreshBoardConfirmOpenV204D3 ? (
        <div
          className="avaAudioRefreshBoardBackdropV204D3"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !refreshingFromBoardV204D3) setRefreshBoardConfirmOpenV204D3(false)
          }}
        >
          <section className={`avaAudioRefreshBoardModalV204D3 ${refreshingFromBoardV204D3 ? 'isBusy' : ''}`} role="dialog" aria-modal="true" aria-labelledby="avaAudioRefreshBoardTitleV204D3" onMouseDown={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="avaAudioModalCloseV204C8"
              onClick={() => setRefreshBoardConfirmOpenV204D3(false)}
              disabled={refreshingFromBoardV204D3}
              title="Отмена"
            >
              <X size={16} />
            </button>
            <div className="avaAudioRefreshBoardSweepV204D3" />
            <div className="avaAudioRefreshBoardIconV204D3">
              {refreshingFromBoardV204D3 ? <span className="avaAudioModalSpinnerV204C8" /> : <RefreshCcw size={23} />}
            </div>
            <h2 id="avaAudioRefreshBoardTitleV204D3">
              {refreshingFromBoardV204D3 ? 'Обновляем Audio Studio…' : 'Обновить Audio Studio из Доски?'}
            </h2>
            <p>
              Это очистит текущие prompt-поля, MMAudio-варианты и applied-выбор Audio Studio,
              а затем заново перенесёт сцены из текущей Доски.
            </p>
            <div className="avaAudioRefreshBoardStepsV204D3">
              <span className={refreshingFromBoardV204D3 ? 'isActive' : ''}>1 · читаем Доску</span>
              <span className={refreshingFromBoardV204D3 ? 'isActive' : ''}>2 · очищаем варианты</span>
              <span className={refreshingFromBoardV204D3 ? 'isActive' : ''}>3 · переносим сцены</span>
            </div>
            <div className="avaAudioRefreshBoardNoticeV204D3">
              Текущая Audio Studio будет заменена свежими сценами из Доски. Сама Доска не изменится.
            </div>
            <div className="avaAudioModalActionsV204C8">
              <button type="button" onClick={() => setRefreshBoardConfirmOpenV204D3(false)} disabled={refreshingFromBoardV204D3}>
                Отмена
              </button>
              <button type="button" className="isRefreshBoardV204D3" onClick={confirmRefreshFromBoardV204D3} disabled={refreshingFromBoardV204D3}>
                {refreshingFromBoardV204D3 ? <span className="avaAudioModalSpinnerV204C8" /> : <RefreshCcw size={15} />}
                {refreshingFromBoardV204D3 ? 'Обновляю…' : 'Да, обновить из Доски'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <header className="avaAudioHero">
        <div>
          <p className="avaAudioEyebrow"><Sparkles size={15} /> Ava Audio Studio · {VERSION}</p>
          <h1>Аудио студия</h1>
          <p>Сцены из Доски, MMAudio RAW Foley, варианты по каждой сцене и применение лучшего результата для монтажки.</p>
        </div>
        <div className="avaAudioHeroActions">
          <button type="button" onClick={() => navigate(boardPath)}><ArrowLeft size={16} /> В Доску</button>
          <button type="button" onClick={refreshFromBoard}><RefreshCcw size={16} /> Обновить из Доски</button>
          <input
            ref={importInputRefV204B2}
            type="file"
            accept="application/json,.json"
            className="avaAudioJsonInputV204B2"
            onChange={(event) => importAudioStudioJsonV204B2(event.target.files?.[0])}
          />
          <button type="button" className="isImportV204B2" onClick={() => importInputRefV204B2.current?.click()}><UploadCloud size={16} /> Импорт</button>
          <button type="button" className="isExportV204B2" onClick={exportAudioStudioJsonV204B2}><Download size={16} /> Экспорт</button>
          <button type="button" className="isDangerV204B5" onClick={clearAllAudioStudioV204B5}><Trash2 size={16} /> Очистить всё</button>
          <button
              type="button"
              className="isPrimary"
              onClick={() => navigate(assemblyPath, {
                state: {
                  source: 'audio_studio_to_assembly_v204c4',
                  fromAudioStudio: true,
                  forceBoard: true,
                  forceReplace: true,
                  requestedAt: nowIso(),
                },
              })}
              title="Перейти в монтажку и принудительно подтянуть свежую Доску с применёнными MMAudio-видео"
            >
              <Film size={16} /> В монтажку
            </button>
        </div>
      </header>

      <div className="avaAudioAlertsSlotV204F6" aria-live="polite">
        {error ? <div className="avaAudioAlert isError"><X size={16} /> {error}</div> : (status ? <div className="avaAudioAlert"><CheckCircle2 size={16} /> {status}</div> : null)}
      </div>

      {manualSceneControlsVisibleV204C7 ? (
        <section className="avaAudioManualSceneBarV204C7">
          <div>
            <strong>Ручные сцены</strong>
            <span>Для самостоятельного видео: добавь сцену, загрузи ролик, сделай MMAudio и отправь в монтажку.</span>
          </div>
          <div className="avaAudioManualSceneActionsV204C7">
            <button type="button" className="isSceneAddV204C6" onClick={addManualSceneV204C6}>+ сцена</button>
            <button type="button" className="isSceneRemoveV204C6" onClick={deleteSelectedSceneV204C6} disabled={!selectedScene}>− сцена</button>
          </div>
        </section>
      ) : null}

      <SceneStrip
        scenes={snapshot.scenes}
        selectedSceneId={selectedScene?.id || selectedScene?.sceneId}
        stableMode={audioStudioModeV204F1 === 'stable' || audioStudioModeV204F1 === 'preview'}
        stableBlockSceneIds={selectedStableBlockSceneIdsV204F1}
        stableBlockColor={selectedStableBlockColorV204F3}
        stableBlocks={stableBlocksV204F4}
        onSelect={handleSceneStripSelectV204F2}
      />

      {!asArray(snapshot.scenes).length ? (
        <section className="avaAudioEmptyState">
          <Headphones size={42} />
          <h2>Пока нет сцен</h2>
          <p>Открой Доску и нажми “В Audio Studio”, либо обнови импорт из сохранённой Доски.</p>
          <div className="avaAudioEmptyActionsV204C6">
            <button type="button" onClick={refreshFromBoard}><RefreshCcw size={16} /> Взять сцены из Доски</button>
            <button type="button" className="isSceneAddV204C6" onClick={addManualSceneV204C6}>+ сцена</button>
          </div>
        </section>
      ) : (
        <main className={`avaAudioWorkbench ${audioStudioModeV204F1 === 'stable' ? 'isStableAudioV204F1' : ''} ${audioStudioModeV204F1 === 'preview' ? 'isPreviewMapV211D' : ''}`}>
          {audioStudioModeV204F1 === 'mmaudio' ? (
            <>
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
                  <button type="button" className="isActive" onClick={() => setAudioStudioModeV204F1('mmaudio')}><AudioLines size={15} /> MMAudio RAW</button>
                  <button type="button" onClick={() => setAudioStudioModeV204F1('stable')}><Sparkles size={15} /> Stable Audio</button>
                  <button type="button" onClick={() => setAudioStudioModeV204F1('preview')}><Film size={15} /> Preview / Разметка</button>
                </div>

                <AudioStudioGlobalNotesPanelV211H
                  notesText={previewNotesTextV211N(snapshot.previewMapV211D?.notes, snapshot.previewNotesV211D)}
                  onOpenPreview={() => setAudioStudioModeV204F1('preview')}
                />

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
                  <button type="button" onClick={applySelectedVariant} disabled={!selectedVariant || selectedVariant?.sourceBaseline || selectedVariant?.kind === 'source_video' || Boolean(applyingVariantId)}>{isApplyingSelected ? <span className="avaAudioApplySpinnerV204B3" /> : <CheckCircle2 size={16} />} {isApplyingSelected ? 'Применяю…' : 'Применить'}</button>
                  <button
                    type="button"
                    className={`avaAudioTimingReadyButtonV204E10 ${selectedTimingAudioReadyV204E10 ? 'isReady' : ''} ${selectedTimingAudioPreparingV204E10 ? 'isLoading' : ''}`}
                    onClick={prepareSelectedTimingAudioV204E10}
                    disabled={!selectedScene || selectedTimingAudioReadyV204E10 || selectedTimingAudioPreparingV204E10}
                    title={selectedTimingAudioReadyV204E10 ? 'Аудио сцены уже привязано и сохранено' : 'Аудио сцены не привязано. Нажми, чтобы подготовить его заранее.'}
                  >
                    {selectedTimingAudioReadyV204E10 ? <CheckCircle2 size={14} /> : <AudioLines size={14} />}
                    {selectedTimingAudioPreparingV204E10 ? 'готовлю тайминг…' : selectedTimingAudioReadyV204E10 ? 'тайминг аудио' : 'нет тайминга'}
                  </button>

                  <button
                    type="button"
                    onClick={previewTimingAudioMmaudioMixV204E10}
                    disabled={!selectedResultRef || selectedTimingAudioPreparingV204E10}
                    title="Одновременно проиграть тайминг-аудио сцены и выбранный MMAudio-вариант с текущей громкостью"
                  >
                    <Play size={16} /> {timingAudioMixPlayingV204E10 ? 'Стоп микс' : 'Прослушать микс'}
                  </button>
                </div>
                {selectedScene?.jobStatus ? <p className="avaAudioJobStatus">{selectedScene.jobStatus}</p> : null}
              </section>

              <section className="avaAudioPanel avaAudioResultPanel">
                <div className="avaAudioPanelTitle">
                  <span><Headphones size={17} /> Готовый результат</span>
                  <small>{selectedIsApplied ? 'применён вариант' : selectedVariant ? 'просмотр варианта' : 'нет варианта'}</small>
                </div>
                <PreviewVideo source={selectedResultRef} title="MMAudio результат" className="avaAudioMainVideo avaAudioResultVideo" volume={clampMediaVolumeV204E10A(activeVolume / 100, 1)} />
                <label className="avaAudioVolume">
                  <span><Volume2 size={15} /> Громкость MMAudio <b>{activeVolume}%</b></span>
                  <input type="range" min="0" max="150" value={activeVolume} onChange={(event) => updateSelectedVolume(event.target.value)} />
                </label>
                <p className="avaAudioVolumeNote">Прослушивание: кнопка при необходимости нарезает аудио тайминга сцены, запускает его на 100% и следом запускает правый MMAudio с этой громкостью. При “Применить” громкость MMAudio запекается для монтажки.</p>
              </section>
            </>
          ) : audioStudioModeV204F1 === 'preview' ? (
            <>
              <section className="avaAudioPanel avaAudioPreviewMapNotesPanelV211D">
                <div className="avaAudioModeSwitch">
                  <button type="button" onClick={() => setAudioStudioModeV204F1('mmaudio')}><AudioLines size={15} /> MMAudio RAW</button>
                  <button type="button" onClick={() => setAudioStudioModeV204F1('stable')}><Sparkles size={15} /> Stable Audio</button>
                  <button type="button" className="isActive" onClick={() => setAudioStudioModeV204F1('preview')}><Film size={15} /> Preview / Разметка</button>
                </div>
                <div className="avaAudioPanelTitle">
                  <span><Save size={17} /> Заметки по звуку</span>
                  <small>{previewMapParsedRowsV211D.length ? `${previewMapParsedRowsV211D.length} строк` : 'свободная разметка'}</small>
                </div>
                <label className="avaAudioField avaAudioPreviewMapFieldV211D">
                  <span>Пиши диапазоны как человек</span>
                  <textarea
                    ref={previewMapNotesTextareaRefV211M}
                    data-preview-notes-editor-v211m="1"
                    value={previewMapNotesV211D}
                    placeholder={`1-4 аплодисменты бурные стейбл\n5 смех мма\n12-16 аплодисменты обычные стейбл\n26 смех мма`}
                    onChange={(event) => updatePreviewMapNotesV211D(event.target.value)}
                    onBeforeInput={(event) => {
                      event.stopPropagation()
                      const nativeEvent = event.nativeEvent || {}
                      if (nativeEvent.inputType !== 'insertLineBreak') return
                      event.preventDefault()
                      const node = event.currentTarget
                      const value = node.value || ''
                      const start = Number.isFinite(node.selectionStart) ? node.selectionStart : value.length
                      const end = Number.isFinite(node.selectionEnd) ? node.selectionEnd : value.length
                      const lineBreak = String.fromCharCode(10)
                      const nextValue = `${value.slice(0, start)}${lineBreak}${value.slice(end)}`
                      updatePreviewMapNotesV211D(nextValue)
                      window.requestAnimationFrame(() => {
                        try {
                          node.focus()
                          node.selectionStart = start + 1
                          node.selectionEnd = start + 1
                        } catch (_err) {}
                      })
                    }}
                    onKeyDownCapture={(event) => {
                      event.stopPropagation()
                      if (event.key !== 'Enter') return
                      event.preventDefault()
                      const node = event.currentTarget
                      const value = node.value || ''
                      const start = Number.isFinite(node.selectionStart) ? node.selectionStart : value.length
                      const end = Number.isFinite(node.selectionEnd) ? node.selectionEnd : value.length
                      const lineBreak = String.fromCharCode(10)
                      const nextValue = `${value.slice(0, start)}${lineBreak}${value.slice(end)}`
                      updatePreviewMapNotesV211D(nextValue)
                      window.requestAnimationFrame(() => {
                        try {
                          node.focus()
                          node.selectionStart = start + 1
                          node.selectionEnd = start + 1
                        } catch (_err) {}
                      })
                    }}
                    onKeyDown={(event) => event.stopPropagation()}
                    onKeyUp={(event) => event.stopPropagation()}
                    onPaste={(event) => event.stopPropagation()}
                    spellCheck={false}
                  />
                </label>
                <div className="avaAudioPreviewMapActionsV211D">
                  <button type="button" onClick={() => insertPreviewMapLineBreakV211M()} title="Вставить новую строку в заметки">
                    ↵ Новая строка
                  </button>
                  <button type="button" className="isPrimary" onClick={savePreviewMapNotesV211D}>
                    <Save size={16} /> Сохранить заметки
                  </button>
                </div>
                <div className="avaAudioPreviewMapHintV211D">
                  Эти заметки сохраняются в Audio Studio snapshot и переживают F5. Это просто карта всего видео: смотришь полный клип, а номер сцены показывается поверх плеера.
                </div>
              </section>

              <section className="avaAudioPanel avaAudioPreviewMapVideoPanelV211D">
                <div className="avaAudioPanelTitle">
                  <span><Film size={17} /> Полное preview видео</span>
                  <small>{previewMapVideoLabelV211D}</small>
                </div>
                <div className="avaAudioPreviewMapVideoWrapV211D">
                  <PreviewVideo
                    source={previewMapVideoSourceV211D}
                    title="Полное preview-видео проекта"
                    className="avaAudioMainVideo avaAudioPreviewMapVideoV211D"
                    autoPlayKey={stableBlockPreviewPlayKeyV204G9}
                    onTimeUpdate={(event) => setPreviewMapCurrentTimeV211D(event.currentTarget?.currentTime || 0)}
                  />
                  <div className="avaAudioPreviewMapOverlayV211D">
                    <strong>{previewMapCurrentSceneV211D ? previewMapCurrentSceneV211D.displayNumber : '—'}</strong>
                    <span>{previewMapCurrentSceneV211D ? previewMapCurrentSceneV211D.sceneId : 'нет сцены'}</span>
                    <small>{previewMapCurrentSceneV211D ? `${previewMapCurrentSceneV211D.start.toFixed(1)}–${previewMapCurrentSceneV211D.end.toFixed(1)}с` : '00.0–00.0с'}</small>
                  </div>
                </div>
                <div className="avaAudioPreviewMapBuildRowV211D">
                  <button
                    type="button"
                    className={`avaAudioStablePreviewActionV204G4 ${previewFullProjectLoadingV211E ? 'isLoading' : ''}`}
                    onClick={loadFullProjectPreviewV211E}
                    disabled={previewFullProjectLoadingV211E}
                    title="Подтянуть полную сборку из монтажки и сохранить её как Preview / Разметка. После F5 не пересобирается."
                  >
                    {previewFullProjectLoadingV211E ? <span className="avaAudioStablePreviewSpinnerV204G4" aria-hidden="true" /> : <Play size={16} />}
                    <span>{previewFullProjectLoadingV211E ? 'Собираю карту сцен…' : previewMapVideoV211D ? 'Обновить полное видео' : 'Собрать карту сцен'}</span>
                  </button>
                  <button type="button" onClick={() => navigate(assemblyPath)}>
                    <Film size={16} /> В монтажку
                  </button>
                </div>
                <div className="avaAudioPreviewMapHintV211D">
                  Используется полная сборка из монтажки. Номер текущей сцены считается по таймингу Audio Studio и показывается поверх плеера.
                </div>
              </section>

              <section className="avaAudioPanel avaAudioPreviewMapParsedPanelV211D">
                <div className="avaAudioPanelTitle">
                  <span><AudioLines size={17} /> Карта проекта</span>
                  <small>{previewMapBlockLabelV211D}</small>
                </div>
                <div className="avaAudioPreviewMapSceneMiniRailV211D">
                  {previewMapTimelineRowsV211D.length ? previewMapTimelineRowsV211D.map((row) => (
                    <button
                      key={row.sceneId}
                      type="button"
                      className={previewMapCurrentSceneV211D?.sceneId === row.sceneId ? 'isActive' : ''}
                      onClick={() => handleSceneStripSelectV204F2(row.sceneId)}
                    >
                      <strong>{row.displayNumber}</strong>
                      <span>{row.sceneId}</span>
                    </button>
                  )) : <div className="avaAudioPreviewMapEmptyV211D">Нет выбранного блока</div>}
                </div>
                <div className="avaAudioPreviewMapParsedListV211D">
                  {previewMapParsedRowsV211D.length ? previewMapParsedRowsV211D.map((row) => (
                    <article key={row.id} className={`is${row.kind}`}>
                      <strong>{row.start ? `${row.start}${row.end && row.end !== row.start ? `–${row.end}` : ''}` : 'note'}</strong>
                      <span>{row.text}</span>
                      <em>{row.kind}</em>
                    </article>
                  )) : (
                    <div className="avaAudioPreviewMapEmptyV211D">
                      Пример: <b>12-16 аплодисменты обычные стейбл</b>
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="avaAudioPanel avaAudioStableBlocksPanelV204F1">
                <div className="avaAudioPanelTitle">
                  <span><AudioLines size={17} /> Stable-блок</span>
                  <small>{selectedStableBlockScenesV204F1.length} сцен</small>
                </div>
                <div className="avaAudioStableBlockSummaryV204F1" style={{ '--stable-block-color': selectedStableBlockColorV204F3 }}>
                  <strong>{stableDisplayBlockTitleV204F3}</strong>
                  <span>{selectedStableBlockDurationV204F1 ? `${selectedStableBlockDurationV204F1.toFixed(2)} сек · запрос ${selectedStableBlockRequestDurationV204F1} сек` : 'тайминг блока —'}</span>
                  <label className="avaAudioStableBlockTitleFieldV204F3">
                    <span>Название блока</span>
                    <input
                      type="text"
                      value={stableDraftBlockTitleV204F3}
                      placeholder={selectedStableBlockTitleV204F1}
                      onChange={(event) => updateStableBlockTitleV204F4(event.target.value)}
                    />
                  </label>
                  <div className="avaAudioStableBlockColorNoteV204F3">
                    <i /> <span>цвет блока автоматически взят от первой сцены</span>
                  </div>
                </div>
                <div className="avaAudioStableBlockHintV204F1">
                  {stableSavedBlockActiveV204F4
                    ? 'Сохранённый Stable-блок выбран. Ctrl+click меняет состав, “Обновить блок” закрепляет, “Разобрать” возвращает сцены отдельно.'
                    : (stableManualSelectionActiveV204F2
                      ? 'Ручной выбор готов. Нажми “Создать блок”, чтобы сохранить название, общий цвет, сцены и точный тайминг.'
                      : 'Клик по сцене показывает её блок. Ctrl+click собирает новый Stable-блок как в Timing: выбрал сцены → назвал → создал.') }
                </div>
                <div className="avaAudioStableManualActionsV204F2">
                  <span>{stableSavedBlockActiveV204F4 ? `блок: ${stableBlockSceneIdsV204F4(selectedSavedStableBlockV204F4).length} сцен` : (stableManualSelectionActiveV204F2 ? `выбрано: ${stableManualSelectionV204F2.length} сцен` : 'Ctrl+click — выбрать сцены')}</span>
                  <button
                    type="button"
                    className="isPrimaryV204F5"
                    onClick={saveStableDraftBlockV204F5}
                    disabled={!selectedStableBlockSceneIdsV204F1.length}
                    title="Сохранить текущие сцены как Stable-блок в snapshot"
                  >
                    {stableSavedBlockActiveV204F4 ? 'Обновить блок' : 'Создать блок'}
                  </button>
                  <button
                    type="button"
                    className={stableSavedBlockActiveV204F4 ? 'isDangerV204F6' : ''}
                    onClick={stableSavedBlockActiveV204F4 ? disassembleStableBlockV204F6 : clearStableManualSelectionV204F2}
                    disabled={!stableManualSelectionActiveV204F2 && !stableSavedBlockActiveV204F4}
                    title={stableSavedBlockActiveV204F4 ? 'Удалить Stable-блок: сцены останутся, но больше не будут привязаны к этому STAU-блоку' : 'Отменить ручной выбор'}
                  >
                    {stableSavedBlockActiveV204F4 ? 'Разобрать' : 'Отмена'}
                  </button>
                </div>
                <div className="avaAudioStableBlockSceneListV204F1">
                  {selectedStableBlockScenesV204F1.map((scene, index) => {
                    const sceneVideoRefV204F2 = audioStudioSceneVideoRefV204F2(scene)
                    return (
                      <button
                        key={scene.id || scene.sceneId || index}
                        type="button"
                        className={`avaAudioStableBlockSceneButtonV204F1 ${cleanId(scene.id || scene.sceneId) === cleanId(selectedScene?.id || selectedScene?.sceneId) ? 'isActive' : ''}`}
                        style={{ '--scene-color': selectedStableBlockColorV204F3 }}
                        onClick={() => setSnapshot((current) => {
                          const next = { ...current, selectedSceneId: scene.id || scene.sceneId, updatedAt: nowIso() }
                          snapshotRef.current = next
                          return next
                        })}
                      >
                        <span className="avaAudioStableBlockSceneThumbV204F2">
                          <em className="avaAudioStableBlockSceneIndexV204F3">{selectedStableBlockNumberV204F9 || index + 1}</em>
                          <PreviewVideo source={sceneVideoRefV204F2} title={scene.title || scene.id || `seg_${index + 1}`} controls={false} className="avaAudioStableBlockSceneVideoV204F2" />
                        </span>
                        <span className="avaAudioStableBlockSceneMetaV204F2">
                          <strong>{scene.title || scene.id || `seg_${index + 1}`}</strong>
                          <small>{toNumber(scene.durationSec ?? scene.duration_sec, durationOf(scene)).toFixed(1)} сек · {scene.appliedVariantId ? 'MMAudio применён' : 'без applied MMAudio'}</small>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>

              <section className="avaAudioPanel avaAudioStablePromptPanelV204F1">
                <div className="avaAudioModeSwitch">
                  <button type="button" onClick={() => setAudioStudioModeV204F1('mmaudio')}><AudioLines size={15} /> MMAudio RAW</button>
                  <button type="button" className="isActive" onClick={() => setAudioStudioModeV204F1('stable')}><Sparkles size={15} /> Stable Audio</button>
                  <button type="button" onClick={() => setAudioStudioModeV204F1('preview')}><Film size={15} /> Preview / Разметка</button>
                </div>
                <AudioStudioGlobalNotesPanelV211H
                  notesText={previewNotesTextV211N(snapshot.previewMapV211D?.notes, snapshot.previewNotesV211D)}
                  onOpenPreview={() => setAudioStudioModeV204F1('preview')}
                />
                <label className="avaAudioField avaAudioStableFieldV204F7">
                  <span>Stable prompt</span>
                  <textarea
                    value={stableDraftPromptV204F7}
                    placeholder={`${selectedStableBlockRequestDurationV204F1 || 13}-second continuous instrumental action tension bed, dark cinematic pulse, no vocals, no lyrics`}
                    onChange={(event) => updateStablePromptV204F7(event.target.value)}
                  />
                </label>
                <div className="avaAudioStableModeRowV204F7 isSimpleV204F8">
                  <span>Модель для генерации</span>
                  <div>
                    <button type="button" className={stableAudioModeApiValueV204F7(stableDraftModeV204F7) === 'Music' ? 'isActive' : ''} onClick={() => updateStableModeV204F7('Music')}>Music</button>
                    <button type="button" className={stableAudioModeApiValueV204F7(stableDraftModeV204F7) === 'Instrument' ? 'isActive' : ''} onClick={() => updateStableModeV204F7('Instrument')}>Instrumental</button>

                    <button type="button" className={stableAudioModeApiValueV204F7(stableDraftModeV204F7) === 'SFX' ? 'isActive' : ''} onClick={() => updateStableModeV204F7('SFX')}>SFX</button>
                  </div>
                </div>
                <div className="avaAudioStableSimpleNoteV204F8">
                  <strong>Длина считается автоматически.</strong>
                  <span>{selectedStableBlockDurationV204F1 ? `Блок ${selectedStableBlockDurationV204F1.toFixed(2)} сек → в Stable Audio уйдёт ${selectedStableBlockRequestDurationV204F1 || '—'} сек, после генерации система подрежет аудио обратно под тайминг блока.` : 'Сначала создай или выбери Stable-блок.'}</span>
                </div>
                <div className="avaAudioStableActionRowV204F7 isSimpleV204F8">
                  <button type="button" className="isPrimary" onClick={submitStableAudioBlockV204F7} disabled={!stableSavedBlockActiveV204F4 || stableAudioGeneratingV204G6}>
                    {stableAudioGeneratingV204G6 ? <span className="avaAudioStablePreviewSpinnerV204G3A" aria-hidden="true" /> : <WandSparkles size={16} />} {stableAudioGeneratingV204G6 ? 'Генерирую Stable…' : 'Сгенерировать Stable'}
                  </button>
                  <button
                    type="button"
                    className={`avaAudioStablePreviewActionV204G4 ${stableBlockPreviewUiPhaseV204G4 === 'loading' ? 'isLoading' : ''} ${stableBlockPreviewUiPhaseV204G4 === 'ready' ? 'isReady' : ''} ${stableBlockPreviewUiPhaseV204G4 === 'error' ? 'isError' : ''}`}
                    onClick={previewStableAudioBlockV204F7}
                    disabled={!stableSavedBlockActiveV204F4 || !selectedStableBlockScenesV204F1.length || stableBlockPreviewUiPhaseV204G4 === 'loading'}
                    title="Собрать выбранный Stable-блок: видео всех сцен блока + Timing audio всех сцен + applied MMAudio + выбранный STAU"
                  >
                    {stableBlockPreviewUiPhaseV204G4 === 'loading' ? <span className="avaAudioStablePreviewSpinnerV204G4" aria-hidden="true" /> : <Play size={16} />}
                    <span>{stableBlockPreviewUiPhaseV204G4 === 'loading' ? 'Собираю блок…' : stableBlockPreviewUiPhaseV204G4 === 'ready' ? 'Блок собран' : 'Собрать блок'}</span>
                  </button>
                  <button
                    type="button"
                    className={`avaAudioStableApplyActionV204H1 ${stableAudioApplyingV204H1 ? 'isLoading' : ''} ${selectedStableAudioAppliedV204H1 ? 'isApplied' : ''}`}
                    onClick={applyStableAudioBlockV204F7}
                    disabled={stableAudioApplyingV204H1 || !stableSavedBlockActiveV204F4 || !stableAudioVariantRefV204G6(selectedStableAudioVariantV204G6 || {})}
                    title="Привязать выбранный Stable Audio вариант к таймингу блока и подготовить его для монтажки"
                  >
                    {stableAudioApplyingV204H1 ? <span className="avaAudioStablePreviewSpinnerV204G4" aria-hidden="true" /> : <CheckCircle2 size={16} />}
                    {stableAudioApplyingV204H1 ? 'Применяю…' : selectedStableAudioAppliedV204H1 ? 'Применено' : 'Применить'}
                  </button>
                </div>
              </section>

              <section className="avaAudioPanel avaAudioStablePreviewPanelV204F1">
                <div className="avaAudioPanelTitle">
                  <span><Film size={17} /> Собранный блок</span>
                  <small>Timing + MMAudio + STAU</small>
                </div>
                <PreviewVideo
                  source={firstText(stableBlockPreviewVideoV204G1?.apiPath, stableBlockPreviewVideoV204G1?.url, sourceVideoRef)}
                  title={stableBlockPreviewVideoV204G1 ? 'Собранный Stable-блок' : 'Выбранная сцена блока'}
                  className="avaAudioMainVideo"
                  autoPlayKey={stableBlockPreviewPlayKeyV204G9}
                />
                <div className="avaAudioStablePreviewNoteV204F1">
                  {stableBlockPreviewVideoV204G1
                    ? `Сейчас справа собранный блок: ${stableBlockPreviewVideoV204G1.sceneCount || selectedStableBlockScenesV204F1.length} сцен · Timing audio + applied MMAudio${selectedStableAudioVariantV204G6 ? ' + STAU' : ''}.`
                    : 'Нажми “Собрать блок”: backend соберёт MP4 из всех сцен блока с Timing audio, applied MMAudio и выбранным STAU, если он есть.'}
                </div>
              </section>
            </>
          )}
        </main>
      )}

      {selectedScene && audioStudioModeV204F1 === 'mmaudio' ? (
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

      {selectedScene && audioStudioModeV204F1 === 'stable' ? (
        <section className="avaAudioStableVariantsRailV204F1 avaAudioStableVariantsRailV204G6">
          <div className="avaAudioRailTitle">
            <h3>Stable Audio варианты блока</h3>
            <span>{stableAudioVariantsV204G6.length ? `${stableAudioVariantsV204G6.length} вариантов · выбери, громкость, preview, применить` : 'появятся после генерации Stable Audio'}</span>
          </div>
          {stableAudioVariantsV204G6.length ? (
            <div className="avaAudioStableVariantListV204G6">
              {stableAudioVariantsV204G6.map((variant, index) => {
                const variantId = cleanId(variant.id || variant.variantId || `stable_${index}`)
                const pickedVariantIdV211V = cleanId(selectedStableAudioVariantIdForUiV211V || stableAudioSelectedVariantIdLiveRefV204H13.current)
                const active = pickedVariantIdV211V === variantId
                const applied = cleanId(selectedSavedStableBlockV204F4?.stableAudio?.appliedVariantId || selectedSavedStableBlockV204F4?.stableAudio?.applied_variant_id) === variantId
                const ref = stableAudioVariantRefV204G6(variant)
                const volume = stableAudioVariantVolumeForUiV204G13(variant)
                return (
                  <article key={variantId} className={`avaAudioStableVariantCardV204G6 ${active ? 'isActive isPickedForBuildV204H18' : ''} ${applied ? 'isApplied' : ''}`}>
                    <button
                      type="button"
                      className="avaAudioStableVariantDeleteV204G7B"
                      onClick={(event) => {
                        event.stopPropagation()
                        removeStableAudioVariantV204G7B(variantId)
                      }}
                      title="Удалить этот Stable Audio вариант из блока"
                    >
                      <X size={14} />
                    </button>
                    <button type="button" className="avaAudioStableVariantPickV204G6" onClick={() => selectStableAudioVariantV204G6(variantId)}>
                      <strong>{variant.label || `v${index + 1}`}</strong>
                      <span>{variant.modeLabel || stableAudioModeUiLabelV204F7(variant.mode)} · {toNumber(variant.finalDurationSec ?? variant.exactDurationSec, selectedStableBlockDurationV204F1).toFixed(2)} сек {applied ? '· ПРИМЕНЁН' : ''}</span>
                    </button>
                    {active ? <div className="avaAudioStableSelectedBadgeV204H18">✓ ВЫБРАНО ДЛЯ СБОРКИ</div> : null}
                    {ref ? <StableAudioAssetPlayerV204G7B source={ref} title={`STAU ${variant.label || `v${index + 1}`}`} className="avaAudioStableAudioPlayerV204G6" volumePercent={volume} /> : <div className="avaAudioStableNoAudioV204G6">нет audio asset</div>}
                    <label className="avaAudioStableVolumeV204G6">
                      <span>Громкость STAU: {volume}%</span>
                      <input type="range" min="0" max="100" step="1" value={volume} onChange={(event) => updateStableAudioVariantVolumeV204G6(variantId, event.target.value)} />
                    </label>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="avaAudioStableVariantPlaceholderV204F1">
              После генерации здесь появится audio player результата и громкость STAU. Эта громкость попадёт в “Собрать блок” и фиксируется кнопкой “Применить”.
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
