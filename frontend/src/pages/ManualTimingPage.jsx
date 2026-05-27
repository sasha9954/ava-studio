import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Clock3, Pause, Play, RotateCcw, Save, StepBack, StepForward, Undo2, UploadCloud } from 'lucide-react'
import { useProjects } from '../context/ProjectContext.jsx'
import { fetchProtectedBlobUrl, transcribeAudioAsset, translateAsrSegments, uploadAudioAsset } from '../services/apiClient.js'

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
    vocalAudioName: data?.vocalAudioName || data?.vocal_audio_name || '',
    vocalAudioAssetId: data?.vocalAudioAssetId || data?.vocal_audio_asset_id || '',
    vocalAudioApiPath: data?.vocalAudioApiPath || data?.vocal_audio_api_path || '',
    vocalAudioSizeBytes: Number(data?.vocalAudioSizeBytes || data?.vocal_audio_size_bytes || 0),
    vocalAudioDurationSec: Number(data?.vocalAudioDurationSec || data?.vocal_audio_duration_sec || 0),
    vocalOffsetSec: Number(data?.vocalOffsetSec || data?.vocal_offset_sec || 0),
    scenes,
    storyBlocks: Array.isArray(data?.storyBlocks) ? data.storyBlocks : [],
    roles: Array.isArray(data?.roles) ? data.roles : [],
    speechSegments: normalizeSpeechSegments(data?.speechSegments || data?.speech_segments || []),
    audioPhrases: Array.isArray(data?.audioPhrases) ? data.audioPhrases : Array.isArray(data?.audio_phrases) ? data.audio_phrases : [],
    missingSpeechHints: normalizeMissingSpeechHints(data?.missingSpeechHints || data?.missing_speech_hints || []),
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
    text: wordText || compactText(segment?.text || segment?.originalText || segment?.original_text || ''),
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
  const storedBasis = compactText(scene?.asr_scene_word_text || '')
  const storedTranslationRu = compactText(scene?.translated_text_ru || scene?.translation_ru || scene?.text_ru || '')
  const storedMeaningRu = compactText(scene?.meaning_hint_ru || scene?.meaning_ru || scene?.meaningText || '')
  const canUseSceneSliceTranslation = Boolean(
    scene?.asr_scene_translation_source === 'scene_slice'
    && storedBasis
    && sceneWordText
    && storedBasis.toLowerCase() === sceneWordText.toLowerCase()
  )

  return {
    source_phrase_ids: [...new Set(sourcePhraseIds)],
    scene_word_text: sceneWordText,
    lyrics_text: sceneWordText,
    translated_text_ru: canUseSceneSliceTranslation && storedTranslationRu ? storedTranslationRu : phraseTranslationRu,
    meaning_hint_ru: canUseSceneSliceTranslation && storedMeaningRu ? storedMeaningRu : phraseMeaningRu,
    phrase_cut_warning: sceneItems.some((item) => item.clipped.isPartial),
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
  const [uploadingVocal, setUploadingVocal] = useState(false)
  const [asrRunning, setAsrRunning] = useState(false)
  const [translationRunning, setTranslationRunning] = useState(false)
  const [showSceneTranslator, setShowSceneTranslator] = useState(true)
  const [translationTtsPlayingId, setTranslationTtsPlayingId] = useState('')
  const [translatorPlayingId, setTranslatorPlayingId] = useState('')
  const [missingPhraseEditor, setMissingPhraseEditor] = useState(null)
  const [asrVisualOffsetSec, setAsrVisualOffsetSec] = useState(0)
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
  const translatorPreviewRangeRef = useRef(null)
  const fileInputRef = useRef(null)
  const jsonInputRef = useRef(null)

  const hasAudio = Boolean(draft.audioAssetId || draft.audioApiPath || draft.audioUrl)
  const scenes = useMemo(() => normalizeScenes(draft, draft.audioDurationSec), [draft.scenes, draft.scenesCount, draft.audioDurationSec])
  const selectedScene = scenes[Math.min(draft.selectedSceneIndex, scenes.length - 1)] || scenes[0] || makeScene(0, 0, 0)
  const scopeTitle = workspaceMode ? 'Рабочая область' : activeProject?.name || 'Проект'
  const cursorPct = draft.audioDurationSec > 0 ? Math.min(100, Math.max(0, (cursorSec / draft.audioDurationSec) * 100)) : 0
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



  useEffect(() => {
    return () => {
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
    stopAudio(nextScene?.start || 0)
    stopTranslationTts()
    setDraft((prev) => normalizeDraft({ ...prev, selectedSceneIndex: sceneIndex }))
  }

  function handleSceneClick(event, sceneIndex) {
    // handleSceneClick render guard
    if (!event || typeof event.stopPropagation !== 'function') {
      return (nextEvent) => handleSceneClick(nextEvent, sceneIndex)
    }

    event?.stopPropagation?.()
    if (event?.ctrlKey || event?.metaKey) {
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
      setStatus('аудио загружено')
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
    const assetId = useVocalStem ? sourceDraft.vocalAudioAssetId : sourceDraft.audioAssetId

    if (!assetId) {
      setStatus(useVocalStem ? 'сначала загрузите vocal stem' : 'сначала загрузите аудио')
      return
    }
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
      setStatus(`ошибка ASR: ${err.message}`)
    } finally {
      setAsrRunning(false)
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
          ...speechExport,
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

  async function importTimingJson(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const raw = JSON.parse(await file.text())
      const root = raw.manualTiming || raw.manual_timing || raw
      const manifest = raw.podcast_edit_manifest || root.podcast_edit_manifest || raw.manifest || root.manifest || {}
      const rawSpeech = root.speechSegments || root.speech_segments || root.audio_phrases || root.asr_phrases || manifest.speechSegments || manifest.speech_segments || manifest.audio_phrases || manifest.asr_phrases || manifest.segments || []
      const speechSegments = typeof normalizeSpeechSegments === 'function' ? normalizeSpeechSegments(rawSpeech) : []
      const defaultClipPassRole = (root.audio_phrases || manifest.audio_phrases) ? [{ roleId: 'narrator', id: 'narrator', name: 'Диктор', label: 'ДИК', color: 220 }] : []
      const roles = typeof normalizeRoleList === 'function' ? normalizeRoleList(root.roles || manifest.roles || defaultClipPassRole, speechSegments) : (root.roles || manifest.roles || defaultClipPassRole)
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
        audioPhrases: Array.isArray(root.audio_phrases) ? root.audio_phrases : Array.isArray(root.audioPhrases) ? root.audioPhrases : speechSegments,
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
      setStatus(root.audio_phrases || manifest.audio_phrases ? `JSON импортирован: audio_phrases импортированы как ASR-карта · ${speechSegments.length} фраз` : `JSON импортирован: ролей ${roles.length}, речевых сегментов ${speechSegments.length}`)
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

  async function toggleScenePlay() {
    const audio = audioRef.current
    if (!audio || !hasAudio) return
    translatorPreviewRangeRef.current = null
    setTranslatorPlayingId('')
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

      const response = await fetch(sourceUrl)
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
            {selectedSceneSpeechExport.phrase_cut_warning && <em>фраза разрезана — проверь границу</em>}
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
                <strong>{selectedSceneSpeechExport.scene_word_text || '—'}</strong>
              </div>
              <div>
                <span>перевод</span>
                <strong>{selectedSceneSpeechExport.translated_text_ru || 'перевода пока нет'}</strong>
              </div>
              <div>
                <span>смысл</span>
                <strong>{selectedSceneSpeechExport.meaning_hint_ru || 'смысл пока не заполнен'}</strong>
              </div>
            </div>

            <div className="avaTimingTranslationTtsBar">
              <button
                type="button"
                className={translationTtsPlayingId === `scene-translation-${selectedScene.id}` ? 'isPlaying' : ''}
                onClick={() => speakTranslationText(selectedSceneSpeechExport.translated_text_ru, `scene-translation-${selectedScene.id}`)}
                disabled={!selectedSceneSpeechExport.translated_text_ru}
                title="Озвучить русский перевод выбранной сцены браузерным голосом"
              >
                {translationTtsPlayingId === `scene-translation-${selectedScene.id}` ? '■ стоп' : '🔊 перевод сцены'}
              </button>
              <button
                type="button"
                className={translationTtsPlayingId === `scene-meaning-${selectedScene.id}` ? 'isPlaying' : ''}
                onClick={() => speakTranslationText(selectedSceneSpeechExport.meaning_hint_ru, `scene-meaning-${selectedScene.id}`)}
                disabled={!selectedSceneSpeechExport.meaning_hint_ru}
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
                  return (
                    <div key={segmentKey} className={`avaTimingSpeechItem ${clipped.isPartial ? 'isPartialCut' : ''}`}>
                      <div className="avaTimingSpeechItemTop">
                        <span>{label} · {formatTime(clipStart, true)} → {formatTime(clipEnd, true)}{clipped.isPartial ? ' · частично' : ''}</span>
                      </div>
                      <p>{clipped.text || segment.text || '...'}</p>
                      {clipped.ruText && (
                        <div className="avaTimingSpeechTranslationLine">
                          <em>{clipped.ruText}</em>
                          <button
                            type="button"
                            className={translationTtsPlayingId === `phrase-translation-${segmentKey}` ? 'isPlaying' : ''}
                            onClick={() => speakTranslationText(clipped.ruText, `phrase-translation-${segmentKey}`)}
                            title="Озвучить русский перевод этой ASR-фразы"
                          >
                            {translationTtsPlayingId === `phrase-translation-${segmentKey}` ? '■' : '🔊'}
                          </button>
                        </div>
                      )}
                      {clipped.meaningText && <small>{clipped.meaningText}</small>}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p>ASR-фразы для выбранной сцены пока не найдены. Используйте блок “ASR / разметка речи” под плеером.</p>
            )}
          </div>
        )}

        <div className="avaTimingTimelineScale" onClick={seekTimeline} onDoubleClick={splitAtCursor}>
          <div className="avaTimingCursorLabel" style={{ left: `${cursorPct}%` }}>{formatTime(cursorSec, true)}</div>
          <div className="avaTimingWaveLong">
            {Array.from({ length: 180 }).map((_, index) => <i key={index} style={{ '--h': `${14 + ((index * 19) % 74)}%` }} />)}
          </div>
          <div className="avaTimingPlayhead" style={{ left: `${cursorPct}%` }} />
  
          {(draft.speechSegments || []).length > 0 && (
            <div className="avaTimingAsrPhraseMap">
              {(draft.speechSegments || []).map((segment) => {
                const visualStart = Math.max(0, Number(segment.start || 0) + asrVisualOffsetSec)
                const left = draft.audioDurationSec > 0 ? Math.max(0, (visualStart / draft.audioDurationSec) * 100) : 0
                const width = draft.audioDurationSec > 0 ? Math.max(0.12, ((segment.end - segment.start) / draft.audioDurationSec) * 100) : 0.4
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
                const left = draft.audioDurationSec > 0 ? Math.max(0, (visualGapStart / draft.audioDurationSec) * 100) : 0
                const width = draft.audioDurationSec > 0 ? Math.max(0.8, ((gap.end - gap.start) / draft.audioDurationSec) * 100) : 2
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

        <div className="avaTimingSegmentsRow">
            {scenes.map((scene) => {
              const sceneWidth = draft.audioDurationSec > 0 ? `${Math.max(0.5, ((scene.end - scene.start) / draft.audioDurationSec) * 100)}%` : `${100 / scenes.length}%`
              const roleLabels = getSceneRoleLabels(scene)
              return (
                <button
                  key={`${scene.id}-${scene.start}-${scene.end}`}
                  type="button"
                  style={{ width: sceneWidth, '--scene-hue': sceneBlockHue(scene, scene.index) }}
                  className={`${scene.index === selectedScene.index ? 'isActive' : ''} ${scene.blockId ? 'hasBlock' : ''} ${blockSelection.includes(scene.index) ? 'isBlockPicked' : ''} ${scene.note ? 'hasNote' : ''}`}
                  onClick={(event) => handleSceneClick(event, scene.index)}
                  onDoubleClick={(event) => {
                    event?.stopPropagation?.()
                    openSceneEditor(scene.index)
                  }}
                
                  title={getSceneTooltip(scene)}>
                  <b>{scene.blockTitle || scene.title}</b>
                  <small>{scene.route && scene.route !== 'auto' ? `${scene.route} · ` : ''}{formatTime(scene.start)} → {formatTime(scene.end)}</small>
                  {roleLabels.length > 0 && <em>{roleLabels.join(' / ')}</em>}
                </button>
              )
            })}
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
              <button type="button" onClick={() => {
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
              <button type="button" onClick={() => runAudioAsr('speech')} disabled={!hasAudio || !draft.audioAssetId || asrRunning}>
                {asrRunning ? 'ASR…' : 'ASR диктор · 1 кредит'}
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
                  accept="audio/*"
                  onChange={handleVocalUpload}
                />
                <button
                  type="button"
                  onClick={runVocalStemAsrExact}
                  disabled={asrRunning}
                >
                  {asrRunning ? 'ASR vocal…' : 'ASR vocal stem точно · 1 кредит'}
                </button>
                <button type="button"
                  disabled={!draft.vocalAudioAssetId || asrRunning}>
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
