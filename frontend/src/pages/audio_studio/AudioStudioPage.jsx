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
import './AudioStudioPage.css'

const STAGE = 'audio_studio'
const VERSION = 'V204D3'
const AVA_AUDIO_REFRESH_FROM_BOARD_MODAL_V204D3 = true
const DEFAULT_NEGATIVE = 'музыка, речь, голоса, гул, hiss, шум'


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
  const sourceVideo = scene.sourceVideo || {}
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
  return {
    ...scene,
    variants: normalizedVariants,
    selectedVariantId,
    appliedVariantId,
    status: appliedVariantId ? 'applied' : (normalizedVariants.some(isRealMmaudioVariantV204B6) ? 'variants' : (hasSource ? 'ready' : 'no_video')),
  }
}

function sanitizeAudioSnapshot(snapshot = {}) {
  return {
    ...snapshot,
    scenes: asArray(snapshot.scenes).map(sanitizeAudioScene),
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
    const volume = toNumber(scene.mmaudio_volume ?? scene.mmaudioVolume ?? scene.audio_studio_mmaudio_volume ?? scene.audioStudioMmaudioVolume, 100)
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
    mmaudioVolume: 100,
    selectedVariantId: '',
    appliedVariantId: '',
    variants: [],
    manualScene: true,
    createdInAudioStudio: true,
    createdAt: nowIso(),
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
  if (!scene.sourceVideo?.apiPath && !scene.sourceVideo?.url) return 'нет видео'
  if (scene.jobId) return 'генерация'
  if (scene.appliedVariantId) return 'мма'
  if (asArray(scene.variants).some((variant) => !variant?.sourceBaseline && variant.kind !== 'source_video')) return 'есть варианты'
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

function PreviewAudio({ source = '', title = 'Аудио тайминга', className = '' }) {
  const [blobUrl, setBlobUrl] = useState('')
  const [error, setError] = useState('')
  const audioRef = useRef(null)
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
      <audio ref={audioRef} className={className} src={src} title={title} controls preload="auto" />
    </div>
  )
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
      mmaudioVolume: Number(scene.mmaudioVolume ?? 100),
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
  const pollRef = useRef(null)
  const snapshotRef = useRef(snapshot)
  const initialLoadDoneRefV204B = useRef(false)
  const didLoadRef = useRef(false)
  const autosaveTimerRef = useRef(null)
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
    pollRef.current = setInterval(tick, 2200)
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
            ? { ...scene, status: 'variants', jobId: '', jobStatus: '', selectedVariantId: variantId, mmaudioVolume: variant.volume, variants: uniqueVariantsV204B4([variant, ...asArray(scene.variants)]).slice(0, 48) }
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
        const appliedVolume = Number(variant.volume ?? scene.mmaudioVolume ?? 100)
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
      else await saveStage(projectId, 'board', nextBoard, 'safe_merge')
      setStatus('Вариант применён: видео сцены обновлено в Доске и готово для монтажки')
    } catch (err) {
      setStatus(`Вариант применён в Audio Studio, но Доска не обновилась: ${err?.message || err}`)
    }
  }, [loadStage, loadWorkspaceStage, projectId, saveStage, saveWorkspaceStage, workspaceMode])

  const applySelectedVariant = useCallback(async () => {
    if (!selectedScene || !selectedVariant) {
      setStatus('Сначала выбери вариант в нижней ленте')
      return
    }
    if (selectedVariant?.sourceBaseline || selectedVariant?.kind === 'source_video') {
      setStatus('Это исходник из Доски. Сгенерируй MMAudio и применяй уже MMAudio-вариант.')
      return
    }

    const applyId = selectedVariant.id
    const selectedRef = normalizeRef(firstText(selectedVariant.apiPath, selectedVariant.url))
    if (!selectedRef.apiPath && !selectedRef.url) {
      setError('У выбранного MMAudio-варианта нет video asset. Применить нечего.')
      return
    }

    setApplyingVariantId(applyId)
    setError('')
    setStatus('Применяю MMAudio вариант…')
    try {
      const volume = Math.max(0, Math.min(150, Number(selectedScene.mmaudioVolume ?? selectedVariant.volume ?? 100) || 0))
      setStatus(volume === 100 ? 'Применяю MMAudio вариант…' : `Применяю MMAudio вариант и запекаю громкость ${volume}%…`)
      const rawMedia = variantRawMediaRefV204C3({ ...selectedVariant, ...selectedRef })
      const appliedMedia = await bakeMmaudioVariantVolumeV204C3({
        variant: { ...selectedVariant, ...selectedRef },
        scene: selectedScene,
        volume,
        projectId,
      })
      const originalMedia = sceneOriginalSourceVideoV204B7(selectedScene)
      const nextVariant = {
        ...selectedVariant,
        rawUrl: firstText(selectedVariant.rawUrl, rawMedia.url),
        rawApiPath: firstText(selectedVariant.rawApiPath, rawMedia.apiPath),
        rawAssetId: firstText(selectedVariant.rawAssetId, rawMedia.assetId),
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
        ...snapshotRef.current,
        scenes: asArray(snapshotRef.current.scenes).map((scene) => {
          if (cleanId(scene.id) !== cleanId(selectedScene.id)) return scene
          const sceneOriginal = sceneOriginalSourceVideoV204B7(scene)
          const preservedOriginal = firstText(sceneOriginal.apiPath, sceneOriginal.url) ? sceneOriginal : originalMedia
          return {
            ...scene,
            status: 'applied',
            appliedVariantId: selectedVariant.id,
            selectedVariantId: selectedVariant.id,
            mmaudioVolume: volume,

            // Important UX: after Apply, the left/source preview becomes the applied MMAudio video immediately.
            // The true original is preserved below and used for future generations.
            sourceVideo: appliedMedia,
            currentVideo: appliedMedia,
            mmaudioAppliedVideo: appliedMedia,
            originalSourceVideo: preservedOriginal,
            mmaudioOriginalSourceVideo: preservedOriginal,
            mmaudio_source_video_api_path: preservedOriginal.apiPath || '',
            mmaudioSourceVideoApiPath: preservedOriginal.apiPath || '',
            mmaudio_source_video_url: preservedOriginal.url || preservedOriginal.apiPath || '',
            mmaudioSourceVideoUrl: preservedOriginal.url || preservedOriginal.apiPath || '',
            mmaudio_source_video_asset_id: preservedOriginal.assetId || '',
            mmaudioSourceVideoAssetId: preservedOriginal.assetId || '',

            variants: uniqueVariantsV204B4(asArray(scene.variants).map((variant) => cleanId(variant.id) === cleanId(selectedVariant.id)
              ? nextVariant
              : { ...variant, applied: false })),
          }
        }),
      })

      // Save Audio Studio first so F5 keeps the applied card and the updated left/source preview.
      await saveSnapshot(next, 'apply_variant_visible_v204b7')
      await syncAppliedToBoard({ ...selectedScene, sourceVideo: appliedMedia, originalSourceVideo: originalMedia }, nextVariant)
      setStatus(volume === 100 ? 'MMAudio вариант применён: левое видео обновлено, Доска записана для монтажки' : `MMAudio вариант применён: громкость ${volume}% запечена в видео, Доска записана для монтажки`)
    } catch (err) {
      setError(`Не удалось применить вариант: ${err?.message || err}`)
    } finally {
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

  const sourceVideoRef = firstText(selectedScene?.sourceVideo?.apiPath, selectedScene?.sourceVideo?.url)
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
  const activeVolume = Math.max(0, Math.min(100, Number(selectedScene?.mmaudioVolume ?? selectedVariant?.volume ?? 100) || 100))
  const selectedTimingAudioRefV204E10 = audioStudioTimingAudioRefV204E10(selectedScene || {})
  const selectedTimingAudioReadyV204E10 = Boolean(selectedTimingAudioRefV204E10)
  const selectedTimingAudioPreparingV204E10 = Boolean(selectedScene && cleanId(timingAudioPreparingSceneIdV204E10) === cleanId(selectedScene.id || selectedScene.sceneId))

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

      {error ? <div className="avaAudioAlert isError"><X size={16} /> {error}</div> : null}
      {status ? <div className="avaAudioAlert"><CheckCircle2 size={16} /> {status}</div> : null}

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
          <div className="avaAudioEmptyActionsV204C6">
            <button type="button" onClick={refreshFromBoard}><RefreshCcw size={16} /> Взять сцены из Доски</button>
            <button type="button" className="isSceneAddV204C6" onClick={addManualSceneV204C6}>+ сцена</button>
          </div>
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
              <button type="button" onClick={applySelectedVariant} disabled={!selectedVariant || selectedVariant?.sourceBaseline || selectedVariant?.kind === 'source_video' || Boolean(applyingVariantId)}>{isApplyingSelected ? <span className="avaAudioApplySpinnerV204B3" /> : <CheckCircle2 size={16} />} {isApplyingSelected ? 'Применяю…' : 'Применить'}</button>
              <button
                type="button"
                className={`avaAudioTimingReadyButtonV204E10 ${selectedTimingAudioReadyV204E10 ? 'isReady' : ''} ${selectedTimingAudioPreparingV204E10 ? 'isLoading' : ''}`}
                onClick={prepareSelectedTimingAudioV204E10}
                disabled={!selectedScene || selectedTimingAudioReadyV204E10 || selectedTimingAudioPreparingV204E10}
                title={selectedTimingAudioReadyV204E10 ? 'Аудио сцены уже привязано и сохранено' : 'Аудио сцены не привязано. Нажми, чтобы подготовить его заранее.'}
              >
                {selectedTimingAudioReadyV204E10 ? <CheckCircle2 size={14} /> : <AudioLines size={14} />}
                {selectedTimingAudioPreparingV204E10 ? 'готовлю аудио…' : selectedTimingAudioReadyV204E10 ? 'аудио сцены' : 'нет аудио'}
              </button>

              <button
                type="button"
                onClick={previewTimingAudioMmaudioMixV204E10}
                disabled={!selectedResultRef || selectedTimingAudioPreparingV204E10}
                title="Одновременно проиграть аудио сцены из тайминга и выбранный MMAudio-вариант с текущей громкостью"
              >
                <Play size={16} /> {mixPreviewPlayingV204E7 ? 'Стоп микс' : 'Прослушать микс'}
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
