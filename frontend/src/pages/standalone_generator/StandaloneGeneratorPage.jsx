import { useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './StandaloneGeneratorPage.css'
import { pickLatestGeneratorJob, upsertGlobalJob } from '../../services/generatorJobs'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

const GENERATOR_SETTINGS_KEY = 'ava:standalone_generator:settings:v1'
const GENERATOR_LEGACY_DRAFT_KEYS = [
  'ava:standalone_generator:v6',
  'ava:standalone_generator:v5',
  'ava:standalone_generator:v4',
]

function readLocalJson(key) {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function readGeneratorSettingsDraft() {
  return readLocalJson(GENERATOR_SETTINGS_KEY) || {}
}

function readAnyGeneratorDraft() {
  if (typeof window === 'undefined') return {}
  for (const key of GENERATOR_LEGACY_DRAFT_KEYS) {
    const parsed = readLocalJson(key)
    if (parsed) return parsed
  }
  return {}
}

function writeGeneratorSettingsDraft(draft) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(GENERATOR_SETTINGS_KEY, JSON.stringify(draft || {}))
  } catch (error) {
    console.warn('[GENERATOR SETTINGS SAVE FAILED]', error)
  }
}

function clearGeneratorSettingsDraft() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(GENERATOR_SETTINGS_KEY)
  } catch {
    // ignore
  }
}


const GENERATOR_DRAFT_KEY = 'ava:standalone_generator:v6'
const GENERATOR_DRAFT_KEYS = [
  GENERATOR_DRAFT_KEY,
  'ava:standalone_generator:v5',
  'ava:standalone_generator:v4',
]

function readGeneratorDraft() {
  if (typeof window === 'undefined') return null
  for (const key of GENERATOR_DRAFT_KEYS) {
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') return parsed
    } catch {
      // ignore broken draft key
    }
  }
  return null
}


function compactGeneratorJob(job) {
  if (!job || typeof job !== 'object') return job || null
  return {
    id: job.id || '',
    jobId: job.jobId || job.job_id || '',
    job_id: job.job_id || job.jobId || '',
    status: job.status || '',
    statusEndpoint: job.statusEndpoint || '',
    statusBase: job.statusBase || '',
    resultUrl: job.resultUrl || job.videoUrl || job.video_url || '',
    videoUrl: job.videoUrl || job.video_url || '',
    route: job.route || '',
    kind: job.kind || '',
    title: job.title || '',
    updatedAt: job.updatedAt || '',
    createdAt: job.createdAt || '',
  }
}

function createLightGeneratorDraft(draft = {}) {
  return {
    route: draft.route || 'i2v',
    aspect: draft.aspect || '16:9',
    prompt: draft.prompt || '',
    negativePrompt: draft.negativePrompt || '',
    durationSec: draft.durationSec || 5,

    resultUrl: draft.resultUrl || '',
    statusText: draft.statusText || '',
    job: compactGeneratorJob(draft.job),

    audioName: draft.audioName || '',
    audioDurationSec: draft.audioDurationSec || 0,

    mmaudioPrompt: draft.mmaudioPrompt || '',
    mmaudioNegativePrompt: draft.mmaudioNegativePrompt || '',
    mmaudioResultUrl: draft.mmaudioResultUrl || '',
    mmaudioStatus: draft.mmaudioStatus || '',
    mmaudioJob: compactGeneratorJob(draft.mmaudioJob),
  }
}

function purgeHeavyGeneratorDraftKeys() {
  if (typeof window === 'undefined') return
  for (const key of ['ava:standalone_generator:v6', 'ava:standalone_generator:v5', 'ava:standalone_generator:v4']) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // ignore
    }
  }
}

function writeGeneratorDraft(draft) {
  if (typeof window === 'undefined') return
  const lightDraft = createLightGeneratorDraft(draft)
  try {
    window.localStorage.setItem(GENERATOR_DRAFT_KEY, JSON.stringify(lightDraft))
  } catch (error) {
    try {
      purgeHeavyGeneratorDraftKeys()
      window.localStorage.setItem(GENERATOR_DRAFT_KEY, JSON.stringify(lightDraft))
    } catch (retryError) {
      console.warn('[GENERATOR DRAFT SAVE FAILED]', retryError)
    }
  }
}

function clearGeneratorDraft() {
  if (typeof window === 'undefined') return
  purgeHeavyGeneratorDraftKeys()
  for (const key of GENERATOR_DRAFT_KEYS) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // ignore
    }
  }
}


const EXTRA_TAIL_SEC = 1

const ASPECTS = [
  { value: '9:16', label: '9:16', width: 720, height: 1280 },
  { value: '16:9', label: '16:9', width: 1280, height: 720 },
  { value: '1:1', label: '1:1', width: 1024, height: 1024 },
]

const ROUTES = [
  { value: 'txt2img', label: 'Фото по описанию', shortLabel: 'фото', kind: 'image', needsStart: false, needsEnd: false, needsAudio: false, maxDuration: null, endpoint: null, statusBase: null, notReady: true, help: 'UI готов. Модель изображения подключим позже.' },
  { value: 'i2v', label: 'Фото → видео', shortLabel: 'фото→видео', kind: 'video', needsStart: true, needsEnd: false, needsAudio: false, maxDuration: 8, endpoint: '/api/clip/video/start', statusBase: '/api/clip/video/status/', help: 'Обычное видео: итог до 8 секунд. Генерация идёт с +1 сек запаса.' },
  { value: 'ia2v', label: 'Липсинк', shortLabel: 'липсинк', kind: 'video', needsStart: true, needsEnd: false, needsAudio: true, maxDuration: 10, maxAudioDuration: 15, endpoint: '/api/clip/video/start', statusBase: '/api/clip/video/status/', help: 'Lip-sync: итог до 10 сек, аудио до 15 сек. Видео идёт с +1 сек запаса.' },
  { value: 'i2v_sound', label: 'Видео со звуком', shortLabel: 'звук', kind: 'video', needsStart: true, needsEnd: false, needsAudio: false, maxDuration: 8, endpoint: '/api/clip/video/start', statusBase: '/api/clip/video/status/', help: 'Звук/речь описываем в prompt. Аудио-файл не нужен.' },
  { value: 'i2v_text', label: 'Видео с речью', shortLabel: 'речь', kind: 'video', needsStart: true, needsEnd: false, needsAudio: false, maxDuration: 8, endpoint: '/api/clip/video/start', statusBase: '/api/clip/video/status/', help: 'Короткая речь/звук задаётся в prompt. Аудио-файл не нужен.' },
  { value: 'first_last', label: 'Первый-последний кадр', shortLabel: 'first-last', kind: 'video', needsStart: true, needsEnd: true, needsAudio: false, maxDuration: 8, endpoint: '/api/clip/video/start', statusBase: '/api/clip/video/status/', help: 'Нужны Start и End. Генерация идёт с +1 сек запаса.' },
  { value: 'first_last_sound', label: 'Первый-последний кадр со звуком', shortLabel: 'first-last+звук', kind: 'video', needsStart: true, needsEnd: true, needsAudio: false, maxDuration: 8, endpoint: '/api/clip/video/start', statusBase: '/api/clip/video/status/', help: 'Нужны Start и End. Звук/речь описываем в prompt.' },
]

const DEFAULT_NEGATIVE = 'identity drift, deformed body, bad hands, extra limbs, warped face, melting objects, text, logo, watermark, subtitles, flicker, jitter, unstable camera, broken geometry'

const GENERATOR_FALLBACK_CREDITS = {
  txt2img: 1,
  i2v: 1,
  ia2v: 1,
  i2v_sound: 1,
  i2v_text: 1,
  first_last: 1,
  first_last_sound: 1,
  mmaudio: 1,
}

function normalizeCreditCost(value, fallback = 1) {
  const n = Number(value)
  if (Number.isFinite(n) && n >= 0) return n
  return fallback
}

function findCostInObject(value) {
  if (!value || typeof value !== 'object') return null
  for (const key of ['creditCost', 'credit_cost', 'credits', 'cost', 'amount', 'price']) {
    if (Number.isFinite(Number(value[key]))) return Number(value[key])
  }
  return null
}

function routeTariffAliases(routeValue) {
  const aliases = {
    txt2img: ['txt2img', 'text_to_image', 'image_from_text', 'image_text', 'text-image', 'image'],
    i2v: ['i2v', 'image_to_video', 'image-video', 'ltx_i2v'],
    ia2v: ['ia2v', 'lip_sync', 'lipsync', 'lip-sync', 'i2v_audio', 'audio_to_video'],
    i2v_sound: ['i2v_sound', 'image-video-golos-zvuk', 'sound', 'video_sound'],
    i2v_text: ['i2v_text', 'video_text', 'speech', 'voice'],
    first_last: ['first_last', 'first-last', 'fl', 'first_last_frame'],
    first_last_sound: ['first_last_sound', 'first-last-sound', 'fl_sound'],
    mmaudio: ['mmaudio', 'mmaudio_sound_design', 'board_mmaudio', 'sound_design'],
  }
  return aliases[routeValue] || [routeValue]
}

function extractRouteCreditCostFromTariffs(tariffs, routeValue) {
  const fallback = GENERATOR_FALLBACK_CREDITS[routeValue] ?? 1
  const aliases = routeTariffAliases(routeValue).map((x) => String(x).toLowerCase())

  function matchObject(obj) {
    if (!obj || typeof obj !== 'object') return null

    for (const alias of aliases) {
      if (Object.prototype.hasOwnProperty.call(obj, alias)) {
        const direct = obj[alias]
        if (Number.isFinite(Number(direct))) return Number(direct)
        const nested = findCostInObject(direct)
        if (nested != null) return nested
      }
    }

    const joined = [
      obj.route,
      obj.mode,
      obj.key,
      obj.workflowKey,
      obj.workflow_key,
      obj.action,
      obj.action_type,
      obj.type,
      obj.name,
      obj.label,
    ].filter(Boolean).join(' ').toLowerCase()

    if (aliases.some((alias) => joined.includes(alias))) {
      const cost = findCostInObject(obj)
      if (cost != null) return cost
    }

    return null
  }

  function walk(value, depth = 0) {
    if (depth > 5 || value == null) return null

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = walk(item, depth + 1)
        if (found != null) return found
      }
      return null
    }

    if (typeof value === 'object') {
      const direct = matchObject(value)
      if (direct != null) return direct

      for (const key of Object.keys(value)) {
        const keyLower = key.toLowerCase()
        if (aliases.some((alias) => keyLower.includes(alias))) {
          const cost = Number.isFinite(Number(value[key])) ? Number(value[key]) : findCostInObject(value[key])
          if (cost != null) return cost
        }
      }

      for (const item of Object.values(value)) {
        const found = walk(item, depth + 1)
        if (found != null) return found
      }
    }

    return null
  }

  return normalizeCreditCost(walk(tariffs), fallback)
}

function formatCreditCost(value) {
  const n = normalizeCreditCost(value, 1)
  return `${n} ${n === 1 ? 'кредит' : 'кред.'}`
}

function extractCreditBalance(summary) {
  if (!summary || typeof summary !== 'object') return null
  for (const key of ['balance', 'creditBalance', 'credits', 'amount']) {
    if (Number.isFinite(Number(summary[key]))) return Number(summary[key])
  }
  if (summary.wallet && typeof summary.wallet === 'object') return extractCreditBalance(summary.wallet)
  if (summary.user && typeof summary.user === 'object') return extractCreditBalance(summary.user)
  return null
}


function authHeaders(extra = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('ava_token') : ''
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

async function fetchJson(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
  const response = await fetch(url, {
    ...options,
    headers: authHeaders(options.headers || {}),
  })
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }
  if (!response.ok) {
    const detail = data?.detail || data?.error || data?.raw || response.statusText
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  return data
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('')
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('file read failed'))
    reader.readAsDataURL(file)
  })
}

function readImageFileAsPersistedDataUrl(file, maxSide = 960, quality = 0.72) {
  return new Promise((resolve) => {
    if (!file) return resolve('')
    if (!String(file.type || '').startsWith('image/')) {
      readFileAsDataUrl(file).then(resolve).catch(() => resolve(''))
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const raw = String(reader.result || '')
      const img = new Image()
      img.onload = () => {
        try {
          const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1))
          const width = Math.max(1, Math.round((img.width || 1) * scale))
          const height = Math.max(1, Math.round((img.height || 1) * scale))
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', quality))
        } catch {
          resolve(raw)
        }
      }
      img.onerror = () => resolve(raw)
      img.src = raw
    }
    reader.onerror = () => resolve('')
    reader.readAsDataURL(file)
  })
}


function pickVideoUrl(data = {}) {
  return (
    data.videoUrl || data.video_url || data.outputVideoUrl || data.output_video_url ||
    data.resultVideoUrl || data.result_video_url || data.videoApiPath || data.video_api_path || ''
  )
}

function normalizeUrl(value) {
  const s = String(value || '').trim()
  if (!s) return ''
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('blob:') || s.startsWith('data:')) return s
  if (s.startsWith('/')) return `${API_BASE}${s}`
  return s
}

function statusLooksDone(status = '') {
  const s = String(status || '').toLowerCase()
  return ['completed', 'done', 'ready', 'success'].some((x) => s.includes(x))
}

function statusLooksFailed(status = '') {
  const s = String(status || '').toLowerCase()
  return ['failed', 'error', 'blocked', 'missing', 'not_found'].some((x) => s.includes(x))
}

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value || '')
  }
}

function getAudioDurationSec(file) {
  return new Promise((resolve) => {
    if (!file) return resolve(0)
    const url = URL.createObjectURL(file)
    const audio = document.createElement('audio')
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      const value = Number(audio.duration || 0)
      URL.revokeObjectURL(url)
      resolve(Number.isFinite(value) ? value : 0)
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(0)
    }
    audio.src = url
  })
}

function formatSec(sec) {
  const n = Number(sec || 0)
  if (!Number.isFinite(n) || n <= 0) return ''
  return `${n.toFixed(2)} сек`
}


const GENERATOR_GALLERY_KEY = 'ava:standalone_generator:gallery:v1'
const GENERATOR_GALLERY_LIMIT = 10

function readGeneratorGalleryDraft() {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(GENERATOR_GALLERY_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((item) => item?.url).slice(0, GENERATOR_GALLERY_LIMIT) : []
  } catch {
    return []
  }
}

function writeGeneratorGalleryDraft(items) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(GENERATOR_GALLERY_KEY, JSON.stringify(Array.isArray(items) ? items.slice(0, GENERATOR_GALLERY_LIMIT) : []))
  } catch (error) {
    console.warn('[GENERATOR GALLERY SAVE FAILED]', error)
  }
}

function createGeneratorGalleryItem(url, meta = {}) {
  const now = new Date().toISOString()
  return {
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    url,
    label: meta.label || 'Видео',
    route: meta.route || '',
    kind: meta.kind || 'video',
    durationSec: meta.durationSec || meta.duration_sec || meta.targetDurationSec || meta.target_duration_sec || 0,
    createdAt: now,
  }
}

function formatGeneratorGalleryTime(value) {
  if (!value) return ''
  try {
    const date = new Date(value)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}


const GENERATOR_MEDIA_KEY = 'ava:standalone_generator:media:v1'

function readGeneratorMediaDraft() {
  if (typeof window === 'undefined') return {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem(GENERATOR_MEDIA_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeGeneratorMediaDraft(draft) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(GENERATOR_MEDIA_KEY, JSON.stringify(draft || {}))
  } catch (error) {
    console.warn('[GENERATOR MEDIA SAVE FAILED]', error)
  }
}

function clearGeneratorMediaDraft() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(GENERATOR_MEDIA_KEY)
  } catch {
    // ignore
  }
}


const GENERATOR_MEDIA_DB = 'ava_standalone_generator_media_v1'
const GENERATOR_MEDIA_STORE = 'media'
const GENERATOR_MEDIA_RECORD_KEY = 'current'

function openGeneratorMediaDb() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB unavailable'))
      return
    }

    const request = window.indexedDB.open(GENERATOR_MEDIA_DB, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(GENERATOR_MEDIA_STORE)) {
        db.createObjectStore(GENERATOR_MEDIA_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'))
  })
}

async function readGeneratorMediaFromDb() {
  try {
    const db = await openGeneratorMediaDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(GENERATOR_MEDIA_STORE, 'readonly')
      const store = tx.objectStore(GENERATOR_MEDIA_STORE)
      const request = store.get(GENERATOR_MEDIA_RECORD_KEY)
      request.onsuccess = () => resolve(request.result || {})
      request.onerror = () => reject(request.error || new Error('IndexedDB read failed'))
      tx.oncomplete = () => db.close()
      tx.onerror = () => {
        try { db.close() } catch {}
      }
    })
  } catch (error) {
    console.warn('[GENERATOR MEDIA IDB READ FAILED]', error)
    return {}
  }
}

async function writeGeneratorMediaToDb(draft = {}) {
  try {
    const db = await openGeneratorMediaDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(GENERATOR_MEDIA_STORE, 'readwrite')
      const store = tx.objectStore(GENERATOR_MEDIA_STORE)
      store.put({ ...(draft || {}), updatedAt: new Date().toISOString() }, GENERATOR_MEDIA_RECORD_KEY)
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => {
        try { db.close() } catch {}
        reject(tx.error || new Error('IndexedDB write failed'))
      }
    })
  } catch (error) {
    console.warn('[GENERATOR MEDIA IDB SAVE FAILED]', error)
  }
}

async function clearGeneratorMediaDb() {
  try {
    const db = await openGeneratorMediaDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(GENERATOR_MEDIA_STORE, 'readwrite')
      const store = tx.objectStore(GENERATOR_MEDIA_STORE)
      store.delete(GENERATOR_MEDIA_RECORD_KEY)
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => {
        try { db.close() } catch {}
        reject(tx.error || new Error('IndexedDB clear failed'))
      }
    })
  } catch (error) {
    console.warn('[GENERATOR MEDIA IDB CLEAR FAILED]', error)
  }
}


function getGeneratorAssemblyVideoDuration(item = {}, fallback = 6) {
  const raw = Number(
    item.durationSec
    || item.duration_sec
    || item.targetDurationSec
    || item.target_duration_sec
    || item.trimToDurationSec
    || item.trim_to_duration_sec
    || fallback
  )
  return Number.isFinite(raw) && raw > 0 ? Number(raw.toFixed(3)) : fallback
}

function buildBoardAssemblyFromGeneratorVideos(items = []) {
  const safeItems = (Array.isArray(items) ? items : [])
    .filter((item) => item?.url)
    .slice(0, 10)

  let cursor = 0
  const now = Date.now()

  const scenes = safeItems.map((item, index) => {
    const duration = getGeneratorAssemblyVideoDuration(item, 6)
    const start = Number(cursor.toFixed(3))
    const end = Number((cursor + duration).toFixed(3))
    cursor = end

    const id = `generator_scene_${String(index + 1).padStart(2, '0')}`
    const title = String(item.label || item.route || `Видео ${index + 1}`).trim()
    const isMmaudio = String(item.kind || '').toLowerCase() === 'mmaudio'
    const route = String(item.route || item.kind || 'generator_clip').trim()

    return {
      id,
      scene_id: id,
      title,
      text: title,
      prompt: title,
      route,
      source: 'standalone_generator',
      source_kind: 'standalone_generator',
      video_url: item.url,
      videoUrl: item.url,
      video_api_path: String(item.url || '').startsWith('/static/') ? item.url : '',
      videoApiPath: String(item.url || '').startsWith('/static/') ? item.url : '',
      mmaudio_video_url: isMmaudio ? item.url : '',
      mmaudioVideoUrl: isMmaudio ? item.url : '',
      duration_sec: duration,
      durationSec: duration,
      start_sec: start,
      start,
      end_sec: end,
      end,
      has_generated_video: true,
      hasGeneratedVideo: true,
      generated_from: 'standalone_generator',
      generatedFrom: 'standalone_generator',
      blockTitle: 'Standalone Generator',
      blockId: 'standalone_generator',
      blockIndex: 0,
      generatorGalleryId: item.id || '',
      generator_gallery_id: item.id || '',
      createdAt: item.createdAt || now,
    }
  })

  const durationSec = Number(cursor.toFixed(3))

  return {
    schema: 'ava_board_snapshot_v1',
    source: 'standalone_generator',
    sourceNodeId: 'standalone_generator',
    status: 'generator_handoff_ready',
    updatedAt: now,
    savedAt: now,
    durationSec,
    duration_sec: durationSec,
    audio: null,
    scenes,
    generatorHandoff: {
      source: 'standalone_generator',
      target: 'board_assembly',
      count: safeItems.length,
      order: 'left_to_right_gallery_order',
      createdAt: now,
      items: safeItems.map((item) => ({
        id: item.id || '',
        url: item.url || '',
        label: item.label || '',
        route: item.route || '',
        kind: item.kind || '',
        durationSec: item.durationSec || item.duration_sec || 0,
        createdAt: item.createdAt || '',
      })),
    },
  }
}

function clearBoardAssemblyStorageForGeneratorHandoff() {
  if (typeof window === 'undefined') return

  const exactKeys = [
    'ava:board-assembly:workspace:settings:v1',
  ]

  for (const key of exactKeys) {
    try { window.localStorage.removeItem(key) } catch {}
    try { window.sessionStorage.removeItem(key) } catch {}
  }

  const shouldRemove = (key = '') => {
    const lowered = String(key || '').toLowerCase()
    return lowered.includes('board-assembly')
      || lowered.includes('board_assembly')
      || lowered.includes('assemblyjob')
      || lowered.includes('board:assembly')
  }

  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      const keys = []
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index)
        if (key && shouldRemove(key)) keys.push(key)
      }
      keys.forEach((key) => {
        try { storage.removeItem(key) } catch {}
      })
    } catch {
      // ignore
    }
  }

  try {
    window.localStorage.setItem('ava:board-assembly:workspace:settings:v1', JSON.stringify({
      audioMode: 'scene_only',
      preferMmaudio: true,
      skipMissing: false,
      originalVolume: 0,
      sceneVolume: 100,
      musicVolume: 15,
      musicLoop: true,
      musicFadeOut: true,
      musicPanelOpen: false,
      watermarkPanelOpen: false,
      watermarkDefaultVersion: 'wm_defaults_07ap_ava_studio_top_right_corners_35_28',
      watermark: {
        enabled: true,
        text: 'ava studio',
        position: 'top_right',
        opacityPercent: 35,
        size: 28,
        motion: 'corners',
      },
      finalVideoUrl: '',
      finalDirty: false,
      assemblyJob: null,
    }))
  } catch {
    // ignore
  }
}

async function saveGeneratorHandoffBoardSnapshot(board = {}) {
  const response = await fetch(`${API_BASE}/api/workspace/snapshots/board`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      data: board,
      client_version: 'generator-to-board-assembly-v1',
      guard_mode: 'replace',
    }),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `workspace board snapshot save failed ${response.status}`)
  }
  return response.json().catch(() => null)
}

export default function StandaloneGeneratorPage() {
  const navigate = useNavigate()
  const [route, setRoute] = useState(() => readGeneratorSettingsDraft().route || readAnyGeneratorDraft().route || 'i2v')
  const [aspect, setAspect] = useState(() => readGeneratorSettingsDraft().aspect || readAnyGeneratorDraft().aspect || '16:9')
  const [durationSec, setDurationSec] = useState(() => Number(readGeneratorSettingsDraft().durationSec || readAnyGeneratorDraft().durationSec || 5))
  const [prompt, setPrompt] = useState(() => readGeneratorSettingsDraft().prompt || readAnyGeneratorDraft().prompt || 'Slow cinematic push-in, natural grounded motion, preserve identity and environment, realistic lighting.')
  const [negativePrompt, setNegativePrompt] = useState(() => readGeneratorSettingsDraft().negativePrompt || readAnyGeneratorDraft().negativePrompt || DEFAULT_NEGATIVE)
  const [startFile, setStartFile] = useState(null)
  const [endFile, setEndFile] = useState(null)
  const [audioFile, setAudioFile] = useState(null)
  const [audioDurationSec, setAudioDurationSec] = useState(() => Number(readGeneratorMediaDraft().audioDurationSec || 0))
  const [startPreview, setStartPreview] = useState(() => readGeneratorMediaDraft().startPersistedDataUrl || '')
  const [endPreview, setEndPreview] = useState(() => readGeneratorMediaDraft().endPersistedDataUrl || '')
  const [audioName, setAudioName] = useState(() => readGeneratorMediaDraft().audioName || '')
  const [audioPreviewUrl, setAudioPreviewUrl] = useState(() => readGeneratorMediaDraft().audioPersistedDataUrl || '')
  const [startPersistedDataUrl, setStartPersistedDataUrl] = useState(() => readGeneratorMediaDraft().startPersistedDataUrl || '')
  const [endPersistedDataUrl, setEndPersistedDataUrl] = useState(() => readGeneratorMediaDraft().endPersistedDataUrl || '')
  const [audioPersistedDataUrl, setAudioPersistedDataUrl] = useState(() => readGeneratorMediaDraft().audioPersistedDataUrl || '')
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const [zoomImage, setZoomImage] = useState(null)
  const [job, setJob] = useState(null)
  const [statusText, setStatusText] = useState('готов к тесту')
  const [resultUrl, setResultUrl] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [rawResponse, setRawResponse] = useState(null)
  const [generatedVideos, setGeneratedVideos] = useState(() => readGeneratorGalleryDraft())
  const [selectedGalleryVideoUrl, setSelectedGalleryVideoUrl] = useState('')
  const [montageConfirmOpen, setMontageConfirmOpen] = useState(false)
  const [montageConfirmBusy, setMontageConfirmBusy] = useState(false)
  const [montageConfirmError, setMontageConfirmError] = useState('')
  const [ltxTariffs, setLtxTariffs] = useState(null)
  const [creditSummary, setCreditSummary] = useState(null)
  const [tariffError, setTariffError] = useState('')
  const [mmaudioOpen, setMmaudioOpen] = useState(false)
  const [mmaudioPrompt, setMmaudioPrompt] = useState('Realistic sound design matching the motion and scene, natural ambience, no music unless needed.')
  const [mmaudioNegativePrompt, setMmaudioNegativePrompt] = useState('clipping, distorted sound, harsh noise, random music, robotic artifacts, audio desync, low quality sound')
  const [mmaudioBusy, setMmaudioBusy] = useState(false)
  const [mmaudioStatus, setMmaudioStatus] = useState('')
  const [mmaudioError, setMmaudioError] = useState('')
  const [mmaudioJob, setMmaudioJob] = useState(null)
  const [mmaudioResultUrl, setMmaudioResultUrl] = useState('')
  const [mmaudioRawResponse, setMmaudioRawResponse] = useState(null)
  const pollingRef = useRef(null)
  const mmaudioPollingRef = useRef(null)
  const audioRef = useRef(null)
  const rememberedGalleryUrlsRef = useRef(new Set())

  useEffect(() => {
    let cancelled = false

    async function loadGeneratorTariffsAndCredits() {
      try {
        const [tariffsResult, creditsResult] = await Promise.allSettled([
          fetchJson('/api/clip/ltx/tariffs'),
          fetchJson('/api/credits/summary'),
        ])

        if (cancelled) return

        if (tariffsResult.status === 'fulfilled') {
          setLtxTariffs(tariffsResult.value)
        } else {
          setTariffError(String(tariffsResult.reason?.message || tariffsResult.reason || 'tariffs unavailable'))
        }

        if (creditsResult.status === 'fulfilled') {
          setCreditSummary(creditsResult.value)
        }
      } catch (error) {
        if (!cancelled) setTariffError(String(error?.message || error))
      }
    }

    loadGeneratorTariffsAndCredits()
    return () => {
      cancelled = true
    }
  }, [])

  const routeInfo = useMemo(() => ROUTES.find((item) => item.value === route) || ROUTES[0], [route])
  const currentCreditCost = useMemo(() => extractRouteCreditCostFromTariffs(ltxTariffs, routeInfo.value), [ltxTariffs, routeInfo.value])
  const mmaudioCreditCost = useMemo(() => extractRouteCreditCostFromTariffs(ltxTariffs, 'mmaudio'), [ltxTariffs])
  const creditBalance = useMemo(() => extractCreditBalance(creditSummary), [creditSummary])
  const aspectInfo = useMemo(() => ASPECTS.find((item) => item.value === aspect) || ASPECTS[1], [aspect])
  const hasEndThumb = !!(endPreview || routeInfo.needsEnd)
  const displayedResultUrl = selectedGalleryVideoUrl || mmaudioResultUrl || resultUrl
  const canUseMmaudio = !!resultUrl && ['i2v', 'first_last'].includes(route)
  const targetDurationSec = Number(durationSec) || 1
  const generationDurationSec = routeInfo.kind === 'video' ? targetDurationSec + EXTRA_TAIL_SEC : targetDurationSec
  const mediaColumnCount = [routeInfo.needsStart, routeInfo.needsEnd, routeInfo.needsAudio].filter(Boolean).length || 1
  useEffect(() => {
    writeGeneratorMediaDraft({
      audioName,
      audioDurationSec,
    })
  }, [startPersistedDataUrl, endPersistedDataUrl, audioPersistedDataUrl, audioName, audioDurationSec])

  useEffect(() => {
    if (!startPersistedDataUrl && !endPersistedDataUrl && !audioPersistedDataUrl && !audioName) return

    writeGeneratorMediaToDb({
      startPersistedDataUrl,
      endPersistedDataUrl,
      audioPersistedDataUrl,
      audioName,
      audioDurationSec,
    })
  }, [startPersistedDataUrl, endPersistedDataUrl, audioPersistedDataUrl, audioName, audioDurationSec])

  const rememberGeneratedVideo = useCallback((url, meta = {}) => {
    const cleanUrl = normalizeUrl(url)
    if (!cleanUrl) return

    setGeneratedVideos((old) => {
      const withoutDuplicate = old.filter((item) => item.url !== cleanUrl)
      return [
        createGeneratorGalleryItem(cleanUrl, meta),
        ...withoutDuplicate,
      ].slice(0, GENERATOR_GALLERY_LIMIT)
    })
  }, [])

  useEffect(() => {
    writeGeneratorGalleryDraft(generatedVideos)
  }, [generatedVideos])

  useEffect(() => {
    const cleanUrl = normalizeUrl(resultUrl)
    if (!cleanUrl) return
    const key = `video:${cleanUrl}`
    if (rememberedGalleryUrlsRef.current.has(key)) return
    rememberedGalleryUrlsRef.current.add(key)
    rememberGeneratedVideo(cleanUrl, {
      kind: 'video',
      label: routeInfo?.label || 'Видео',
      route,
      durationSec: targetDurationSec,
    })
  }, [resultUrl, rememberGeneratedVideo, route, routeInfo?.label])

  useEffect(() => {
    const cleanUrl = normalizeUrl(mmaudioResultUrl)
    if (!cleanUrl) return
    const key = `mmaudio:${cleanUrl}`
    if (rememberedGalleryUrlsRef.current.has(key)) return
    rememberedGalleryUrlsRef.current.add(key)
    rememberGeneratedVideo(cleanUrl, {
      kind: 'mmaudio',
      label: 'MMAudio',
      route: 'mmaudio',
      durationSec: targetDurationSec,
    })
  }, [mmaudioResultUrl, rememberGeneratedVideo])

  const openGeneratedVideo = useCallback((item) => {
    if (!item?.url) return
    setSelectedGalleryVideoUrl(item.url)
    setStatusText('просмотр из ленты')
  }, [])

  const removeGeneratedVideo = useCallback((event, item) => {
    event?.stopPropagation?.()
    if (!item?.id) return
    setGeneratedVideos((old) => old.filter((video) => video.id !== item.id))
    if (selectedGalleryVideoUrl === item.url) {
      setSelectedGalleryVideoUrl('')
    }
  }, [selectedGalleryVideoUrl])

  const goToVideoMontageFromGenerator = useCallback(() => {
    const clips = (Array.isArray(generatedVideos) ? generatedVideos : [])
      .filter((item) => item?.url)
      .slice(0, 10)

    if (!clips.length) {
      setMontageConfirmError('Сначала сгенерируй хотя бы одно видео.')
      setMontageConfirmOpen(true)
      return
    }

    setMontageConfirmError('')
    setMontageConfirmOpen(true)
  }, [generatedVideos])

  const cancelVideoMontageHandoff = useCallback(() => {
    if (montageConfirmBusy) return
    setMontageConfirmOpen(false)
    setMontageConfirmError('')
  }, [montageConfirmBusy])

  const confirmVideoMontageHandoff = useCallback(async () => {
    const clips = (Array.isArray(generatedVideos) ? generatedVideos : [])
      .filter((item) => item?.url)
      .slice(0, 10)

    if (!clips.length) {
      setMontageConfirmError('Сначала сгенерируй хотя бы одно видео.')
      return
    }

    const boardSnapshot = buildBoardAssemblyFromGeneratorVideos(clips)

    setMontageConfirmBusy(true)
    setMontageConfirmError('')

    try {
      clearBoardAssemblyStorageForGeneratorHandoff()
      await saveGeneratorHandoffBoardSnapshot(boardSnapshot)
      setMontageConfirmOpen(false)

      navigate('/app/workspace/board-assembly', {
        state: {
          source: 'standalone_generator',
          board: boardSnapshot,
          forceReplace: true,
          clearBeforeImport: true,
        },
      })
    } catch (error) {
      console.warn('[GENERATOR BOARD ASSEMBLY HANDOFF SAVE FAILED]', error)
      setMontageConfirmError(`Не удалось подготовить монтажник: ${String(error?.message || error)}`)
    } finally {
      setMontageConfirmBusy(false)
    }
  }, [generatedVideos, navigate])



  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
      if (mmaudioPollingRef.current) clearInterval(mmaudioPollingRef.current)
      if (startPreview?.startsWith('blob:')) URL.revokeObjectURL(startPreview)
      if (endPreview?.startsWith('blob:')) URL.revokeObjectURL(endPreview)
      if (audioPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(audioPreviewUrl)
    }
  }, [startPreview, endPreview, audioPreviewUrl])

  useEffect(() => {
    const data = readGeneratorDraft()
    if (!data) return

    try {
      if (data.route) setRoute(data.route)
      if (data.aspect) setAspect(data.aspect)
      if (data.prompt) setPrompt(data.prompt)
      if (data.negativePrompt) setNegativePrompt(data.negativePrompt)
      if (data.durationSec) setDurationSec(Number(data.durationSec) || 5)

      if (data.resultUrl) setResultUrl(data.resultUrl)
      if (data.job) setJob(data.job)
      if (data.statusText) setStatusText(data.statusText)

      if (data.startPersistedDataUrl) {
        setStartPersistedDataUrl(data.startPersistedDataUrl)
        setStartPreview(data.startPersistedDataUrl)
      }
      if (data.endPersistedDataUrl) {
        setEndPersistedDataUrl(data.endPersistedDataUrl)
        setEndPreview(data.endPersistedDataUrl)
      }
      if (data.audioPersistedDataUrl) {
        setAudioPersistedDataUrl(data.audioPersistedDataUrl)
        setAudioPreviewUrl(data.audioPersistedDataUrl)
      }
      if (data.audioName) setAudioName(data.audioName)
      if (data.audioDurationSec) setAudioDurationSec(Number(data.audioDurationSec) || 0)

      if (data.mmaudioPrompt) setMmaudioPrompt(data.mmaudioPrompt)
      if (data.mmaudioNegativePrompt) setMmaudioNegativePrompt(data.mmaudioNegativePrompt)
      if (data.mmaudioResultUrl) setMmaudioResultUrl(data.mmaudioResultUrl)
      if (data.mmaudioJob) setMmaudioJob(data.mmaudioJob)
      if (data.mmaudioStatus) setMmaudioStatus(data.mmaudioStatus)
    } catch (error) {
      console.warn('[GENERATOR DRAFT LOAD FAILED]', error)
    }
  }, [])


  useEffect(() => {
    const max = routeInfo.maxDuration || 0
    if (max && Number(durationSec) > max) setDurationSec(max)
  }, [routeInfo.maxDuration, durationSec])

  useEffect(() => {
    const draft = {
      route,
      aspect,
      prompt,
      negativePrompt,
      durationSec,

      startPersistedDataUrl,
      endPersistedDataUrl,
      audioPersistedDataUrl,
      audioName,
      audioDurationSec,

      resultUrl,
      job,
      statusText,

      mmaudioPrompt,
      mmaudioResultUrl,
      mmaudioJob,
      mmaudioStatus,
    }

    writeGeneratorDraft(draft)
  }, [
    route,
    aspect,
    prompt,
    negativePrompt,
    durationSec,
    startPersistedDataUrl,
    endPersistedDataUrl,
    audioPersistedDataUrl,
    audioName,
    audioDurationSec,
    resultUrl,
    job,
    statusText,
    mmaudioPrompt,
    mmaudioNegativePrompt,
    mmaudioResultUrl,
    mmaudioJob,
    mmaudioStatus,
  ])


  useEffect(() => {
    const node = audioRef.current
    if (!node) return
    const onEnded = () => setIsAudioPlaying(false)
    const onPause = () => setIsAudioPlaying(false)
    const onPlay = () => setIsAudioPlaying(true)
    node.addEventListener('ended', onEnded)
    node.addEventListener('pause', onPause)
    node.addEventListener('play', onPlay)
    return () => {
      node.removeEventListener('ended', onEnded)
      node.removeEventListener('pause', onPause)
      node.removeEventListener('play', onPlay)
    }
  }, [audioPreviewUrl])

  useEffect(() => {
    let cancelled = false

    async function restoreGeneratorMediaFromDb() {
      const data = await readGeneratorMediaFromDb()
      if (cancelled || !data || typeof data !== 'object') return

      if (data.startPersistedDataUrl) {
        setStartPersistedDataUrl(data.startPersistedDataUrl)
        setStartPreview(data.startPersistedDataUrl)
      }
      if (data.endPersistedDataUrl) {
        setEndPersistedDataUrl(data.endPersistedDataUrl)
        setEndPreview(data.endPersistedDataUrl)
      }
      if (data.audioPersistedDataUrl) {
        setAudioPersistedDataUrl(data.audioPersistedDataUrl)
        setAudioPreviewUrl(data.audioPersistedDataUrl)
      }
      if (data.audioName) setAudioName(data.audioName)
      if (data.audioDurationSec) setAudioDurationSec(Number(data.audioDurationSec) || 0)
    }

    restoreGeneratorMediaFromDb()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    writeGeneratorSettingsDraft({
      route,
      aspect,
      durationSec,
      prompt,
      negativePrompt,
    })
  }, [route, aspect, durationSec, prompt, negativePrompt])

  const handleRouteChange = useCallback((nextRoute) => {
    const value = String(nextRoute || '')
    console.log('[GEN ROUTE CHANGE]', value)
    setRoute(value)
    setError('')
    setStatusText('готов к тесту')
    setJob(null)
    setResultUrl('')
    setRawResponse(null)
    setMmaudioOpen(false)
    setMmaudioBusy(false)
    setMmaudioStatus('')
    setMmaudioResultUrl('')
    setMmaudioError('')
    setMmaudioJob(null)
    setMmaudioRawResponse(null)
  }, [])

  const handleStartFile = useCallback(async (file) => {
    setStartFile(file || null)
    if (!file) {
      setStartPreview('')
      setStartPersistedDataUrl('')
      return
    }
    const persisted = await readImageFileAsPersistedDataUrl(file)
    setStartPersistedDataUrl(persisted)
    setStartPreview(persisted || URL.createObjectURL(file))
    if (persisted) writeGeneratorMediaToDb({ ...readGeneratorMediaDraft(), startPersistedDataUrl: persisted })
  }, [])

  const handleEndFile = useCallback(async (file) => {
    setEndFile(file || null)
    if (!file) {
      setEndPreview('')
      setEndPersistedDataUrl('')
      return
    }
    const persisted = await readImageFileAsPersistedDataUrl(file)
    setEndPersistedDataUrl(persisted)
    setEndPreview(persisted || URL.createObjectURL(file))
    if (persisted) writeGeneratorMediaToDb({ ...readGeneratorMediaDraft(), endPersistedDataUrl: persisted })
  }, [])

  const handleAudioFile = useCallback(async (file) => {

    setError('')
    if (audioPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(audioPreviewUrl)
    if (!file) {
      setAudioFile(null)
      setAudioName('')
      setAudioDurationSec(0)
      setAudioPreviewUrl('')
      setAudioPersistedDataUrl('')
      setIsAudioPlaying(false)
      return
    }
    const sec = await getAudioDurationSec(file)
    if (route === 'ia2v' && sec > 15.05) {
      setAudioFile(null)
      setAudioName('')
      setAudioDurationSec(sec)
      setAudioPreviewUrl('')
      setAudioPersistedDataUrl('')
      setIsAudioPlaying(false)
      setError(`Для lip-sync аудио должно быть не длиннее 15 сек. Сейчас: ${sec.toFixed(2)} сек.`)
      return
    }
    const audioDataUrlForPersist = await readFileAsDataUrl(file)
    setAudioFile(file)
    setAudioName(file?.name || '')
    setAudioDurationSec(sec)
    setAudioPersistedDataUrl(audioDataUrlForPersist)
    setAudioPreviewUrl(audioDataUrlForPersist || URL.createObjectURL(file))
    if (audioDataUrlForPersist) writeGeneratorMediaToDb({ ...readGeneratorMediaDraft(), audioPersistedDataUrl: audioDataUrlForPersist, audioName: file?.name || '', audioDurationSec: sec })
  }, [route, audioPreviewUrl])

  const toggleAudioPreview = useCallback(async () => {
    if (!audioRef.current || !audioPreviewUrl) return
    const node = audioRef.current
    try {
      if (node.paused) {
        await node.play()
        setIsAudioPlaying(true)
      } else {
        node.pause()
        setIsAudioPlaying(false)
      }
    } catch {
      setIsAudioPlaying(false)
    }
  }, [audioPreviewUrl])

  const openZoom = useCallback((src, title) => {
    if (!src) return
    setZoomImage({ src, title: title || '' })
  }, [])

  const closeZoom = useCallback(() => setZoomImage(null), [])

  const pollStatus = useCallback((jobId, statusBase) => {
    if (!jobId || !statusBase) return
    if (pollingRef.current) clearInterval(pollingRef.current)
    const tick = async () => {
      try {
        const data = await fetchJson(`${statusBase}${jobId}`)
        setRawResponse(data)
        setJob((old) => ({ ...(old || {}), ...data }))
        setStatusText(data.status || data.video_status || 'running')
        const video = normalizeUrl(pickVideoUrl(data))
        if (video) setResultUrl(video)
        if (jobId) {
          upsertGlobalJob({
            id: `generator:${jobId}`,
            source: 'standalone_generator',
        credit_cost_hint: currentCreditCost,
        creditCostHint: currentCreditCost,
        client_credit_cost: currentCreditCost,
            kind: 'video',
            title: 'Видео',
            toastTitle: 'Видео готово',
            toastMessage: 'Генерация завершена. Перейти в генератор?',
            pagePath: '/app/workspace/generator',
            jobId,
            status: (statusLooksDone(data.status || data.video_status) || video) ? 'done' : (data.status || data.video_status || 'running'),
            rawStatus: data.status || data.video_status || 'running',
            statusBase,
            statusEndpoint: `${statusBase}${jobId}`,
            resultUrl: video || '',
            response: data,
          })
        }
        if (statusLooksDone(data.status || data.video_status) || video) {
          if (pollingRef.current) clearInterval(pollingRef.current)
          pollingRef.current = null
          setBusy(false)
        }
        if (statusLooksFailed(data.status || data.video_status || data.status)) {
          if (pollingRef.current) clearInterval(pollingRef.current)
          pollingRef.current = null
          setBusy(false)
        }
      } catch (exc) {
        setError(String(exc?.message || exc))
        setBusy(false)
        if (pollingRef.current) clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
    tick()
    pollingRef.current = setInterval(tick, 2200)
  }, [])

  useEffect(() => {
    const latest = pickLatestGeneratorJob()
    if (!latest) return
    if (latest.resultUrl) {
      setResultUrl(latest.resultUrl)
      setStatusText('готово после восстановления')
      setJob(latest)
      return
    }
    if (latest.jobId && latest.statusBase && latest.status !== 'done' && latest.status !== 'failed') {
      setJob(latest)
      setStatusText(latest.rawStatus || latest.status || 'восстановлено после F5')
      pollStatus(latest.jobId, latest.statusBase)
    }
  }, [pollStatus])

  const pollMmaudioStatus = useCallback((jobId) => {
    if (!jobId) return
    if (mmaudioPollingRef.current) clearInterval(mmaudioPollingRef.current)
    const tick = async () => {
      try {
        const data = await fetchJson(`/api/clip/mmaudio/status/${jobId}`)
        setMmaudioRawResponse(data)
        setMmaudioJob((old) => ({ ...(old || {}), ...data }))
        setMmaudioStatus(data.status || data.audio_status || data.video_status || 'running')
        const video = normalizeUrl(pickVideoUrl(data))
        if (video) setMmaudioResultUrl(video)
        if (statusLooksDone(data.status || data.audio_status || data.video_status) || video) {
          if (mmaudioPollingRef.current) clearInterval(mmaudioPollingRef.current)
          mmaudioPollingRef.current = null
          setMmaudioBusy(false)
        }
        if (statusLooksFailed(data.status || data.audio_status || data.video_status)) {
          if (mmaudioPollingRef.current) clearInterval(mmaudioPollingRef.current)
          mmaudioPollingRef.current = null
          setMmaudioBusy(false)
        }
      } catch (exc) {
        setMmaudioError(String(exc?.message || exc))
        setMmaudioBusy(false)
        if (mmaudioPollingRef.current) clearInterval(mmaudioPollingRef.current)
        mmaudioPollingRef.current = null
      }
    }
    tick()
    mmaudioPollingRef.current = setInterval(tick, 2200)
  }, [])

  const submitMmaudio = useCallback(async () => {
    setMmaudioError('')
    setMmaudioRawResponse(null)
    if (!resultUrl) {
      setMmaudioError('Сначала нужно получить видео без звука через i2v или first-last.')
      return
    }
    setMmaudioBusy(true)
    setMmaudioStatus('отправляю видео в MMAudio...')
    try {
      const sceneId = `generator_mmaudio_${Date.now()}`
      const payload = {
        scene_id: sceneId,
        sceneId,
        source: 'standalone_generator_mmaudio',
        credit_cost_hint: mmaudioCreditCost,
        creditCostHint: mmaudioCreditCost,
        client_mmaudio_credit_cost: mmaudioCreditCost,
        route: 'mmaudio',
        video_url: resultUrl,
        videoUrl: resultUrl,
        input_video_url: resultUrl,
        inputVideoUrl: resultUrl,
        source_video_url: resultUrl,
        sourceVideoUrl: resultUrl,
        sound_prompt: mmaudioPrompt,
        soundPrompt: mmaudioPrompt,
        prompt: mmaudioPrompt,
        positive_prompt: mmaudioPrompt,
        negative_prompt: mmaudioNegativePrompt,
        negativePrompt: mmaudioNegativePrompt,
        negative_sound_prompt: mmaudioNegativePrompt,
        negativeSoundPrompt: mmaudioNegativePrompt,
        duration_sec: Number(durationSec) || 5,
        durationSec: Number(durationSec) || 5,
        target_duration_sec: Number(durationSec) || 5,
        targetDurationSec: Number(durationSec) || 5,
        aspect_ratio: aspectInfo.value,
        aspectRatio: aspectInfo.value,
      }
      const data = await fetchJson('/api/clip/mmaudio/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setMmaudioRawResponse(data)
      const jobId = data.jobId || data.job_id || data.id
      setMmaudioJob({ ...data, jobId })
      setMmaudioStatus(data.status || 'queued')
      const video = normalizeUrl(pickVideoUrl(data))
      if (video) setMmaudioResultUrl(video)
      if (jobId) pollMmaudioStatus(jobId)
      else setMmaudioBusy(false)
    } catch (exc) {
      setMmaudioError(String(exc?.message || exc))
      setMmaudioBusy(false)
    }
  }, [aspectInfo.value, durationSec, mmaudioPrompt, mmaudioNegativePrompt, pollMmaudioStatus, resultUrl])

  const submitGeneration = useCallback(async () => {
    setError('')
    setResultUrl('')
    setMmaudioResultUrl('')
    setMmaudioRawResponse(null)
    setMmaudioJob(null)
    setMmaudioError('')
    setRawResponse(null)

    if (routeInfo.notReady) {
      setError('Режим картинки по описанию пока только в UI. Подключим модель позже.')
      return
    }
    if (routeInfo.needsStart && !startFile && !startPersistedDataUrl) {
      setError('Нужно загрузить стартовое изображение.')
      return
    }
    if (routeInfo.needsEnd && !endFile && !endPersistedDataUrl) {
      setError('Для first-last нужен последний кадр.')
      return
    }
    if (routeInfo.needsAudio && !audioFile && !audioPersistedDataUrl) {
      setError('Для ia2v / lip-sync нужно аудио.')
      return
    }
    if (routeInfo.value === 'ia2v' && audioDurationSec > 15.05) {
      setError(`Для lip-sync аудио должно быть не длиннее 15 сек. Сейчас: ${audioDurationSec.toFixed(2)} сек.`)
      return
    }
    if (routeInfo.maxDuration && Number(durationSec) > routeInfo.maxDuration) {
      setError(`Для режима ${routeInfo.label} максимум ${routeInfo.maxDuration} сек.`)
      return
    }

    setBusy(true)
    setStatusText('читаю файлы...')

    try {
      const includeStart = routeInfo.needsStart
      const includeEnd = routeInfo.needsEnd
      const includeAudio = routeInfo.needsAudio

      const [freshStartDataUrl, freshEndDataUrl, freshAudioDataUrl] = await Promise.all([
        readFileAsDataUrl(includeStart ? startFile : null),
        readFileAsDataUrl(includeEnd ? endFile : null),
        readFileAsDataUrl(includeAudio ? audioFile : null),
      ])

      const startDataUrl = includeStart ? (freshStartDataUrl || startPersistedDataUrl || startPreview || '') : ''
      const endDataUrl = includeEnd ? (freshEndDataUrl || endPersistedDataUrl || endPreview || '') : ''
      const audioDataUrl = includeAudio ? (freshAudioDataUrl || audioPersistedDataUrl || audioPreviewUrl || '') : ''
      const sceneId = `generator_${Date.now()}`
      const payload = {
        scene_id: sceneId,
        sceneId,
        route,
        image_data_url: startDataUrl,
        imageDataUrl: startDataUrl,
        start_image_data_url: startDataUrl,
        startImageDataUrl: startDataUrl,
        end_image_data_url: endDataUrl,
        endImageDataUrl: endDataUrl,
        audio_data_url: audioDataUrl,
        audioDataUrl: audioDataUrl,
        video_prompt: prompt,
        videoPrompt: prompt,
        positive_prompt: prompt,
        positivePrompt: prompt,
        negative_prompt: negativePrompt,
        negativePrompt: negativePrompt,
        width: Number(aspectInfo.width) || 1280,
        height: Number(aspectInfo.height) || 720,

        // Visible duration contract: generate target+1s, then backend should trim to target.
        duration_sec: generationDurationSec,
        durationSec: generationDurationSec,
        generation_duration_sec: generationDurationSec,
        generationDurationSec,
        requested_duration_sec: targetDurationSec,
        requestedDurationSec: targetDurationSec,
        target_duration_sec: targetDurationSec,
        targetDurationSec: targetDurationSec,
        trim_to_duration_sec: targetDurationSec,
        trimToDurationSec: targetDurationSec,
        should_trim_to_target: true,
        shouldTrimToTarget: true,
        duration_strategy: 'generate_extra_1s_then_trim',

        source: 'standalone_generator',
        aspect_ratio: aspectInfo.value,
        aspectRatio: aspectInfo.value,
      }
      setStatusText(`отправляю в backend: ${generationDurationSec.toFixed(1)} сек → итог ${targetDurationSec.toFixed(1)} сек`)
      const data = await fetchJson(routeInfo.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setRawResponse(data)
      const jobId = data.jobId || data.job_id || data.id
      setJob({ ...data, jobId })
      setStatusText(data.status || 'queued')
      const video = normalizeUrl(pickVideoUrl(data))
      if (video) setResultUrl(video)
      if (jobId) {
        upsertGlobalJob({
          id: `generator:${jobId}`,
          source: 'standalone_generator',
          kind: 'video',
          title: routeInfo.label,
          toastTitle: 'Видео готово',
          toastMessage: 'Генерация завершена. Перейти в генератор?',
          pagePath: '/app/workspace/generator',
          jobId,
          status: data.status || 'queued',
          rawStatus: data.status || 'queued',
          statusBase: routeInfo.statusBase,
          statusEndpoint: `${routeInfo.statusBase}${jobId}`,
          route,
          aspect,
          targetDurationSec,
          generationDurationSec,
          resultUrl: video || '',
        })
      }
      if (jobId) pollStatus(jobId, routeInfo.statusBase)
      else setBusy(false)
    } catch (exc) {
      setError(String(exc?.message || exc))
      setBusy(false)
    }
  }, [audioDurationSec, audioFile, audioPersistedDataUrl, audioPreviewUrl, aspectInfo.height, aspectInfo.value, aspectInfo.width, currentCreditCost, endFile, endPersistedDataUrl, endPreview, generationDurationSec, negativePrompt, pollStatus, prompt, route, routeInfo, startFile, startPersistedDataUrl, startPreview, targetDurationSec])

  const stopPolling = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current)
    if (mmaudioPollingRef.current) clearInterval(mmaudioPollingRef.current)
    pollingRef.current = null
    mmaudioPollingRef.current = null
    setBusy(false)
    setMmaudioBusy(false)
    setStatusText('polling остановлен')
    setMmaudioStatus('polling остановлен')
  }, [])

  const clearDraft = useCallback(() => {
    clearGeneratorDraft()
    setJob(null)
    setResultUrl('')
    setRawResponse(null)
    setError('')
    setStatusText('очищено')
    setStartFile(null)
    setEndFile(null)
    setAudioFile(null)
    setStartPreview('')
    setEndPreview('')
    setAudioName('')
    setAudioDurationSec(0)
    setAudioPreviewUrl('')
    setIsAudioPlaying(false)
    setZoomImage(null)
    setMmaudioOpen(false)
    setMmaudioPrompt('Realistic sound design matching the motion and scene, natural ambience, no music unless needed.')
    setMmaudioNegativePrompt('clipping, distorted sound, harsh noise, random music, robotic artifacts, audio desync, low quality sound')
    setMmaudioBusy(false)
    setMmaudioStatus('')
    setMmaudioError('')
    setMmaudioJob(null)
    setMmaudioResultUrl('')
    setMmaudioRawResponse(null)
    if (audioRef.current) audioRef.current.pause()
  }, [])

  const durationMax = routeInfo.maxDuration || 1

  return (
    <main className="avaGeneratorPage">
      <section className="avaGeneratorHero">
        <div>
          <p className="avaGeneratorKicker">GENERATOR</p>
          <h1>Генератор</h1>
        </div>
        <div className="avaGeneratorHeroBadges">
          <span>{routeInfo.shortLabel || routeInfo.label}</span>
          <span>{aspect}</span>
          {routeInfo.kind === 'video' ? <span>{targetDurationSec}s + 1s</span> : <span>image</span>}
        </div>
      </section>

      <section className="avaGeneratorGridTwoCol">
        <div className="avaGeneratorPanel avaGeneratorPromptPanel">
          <h2>1. Prompt</h2>

          <label className="avaGeneratorLabel">Positive / motion prompt</label>
          <textarea className="avaGeneratorTextarea" value={prompt} onChange={(event) => setPrompt(event.target.value)} />

          <label className="avaGeneratorLabel">Negative prompt</label>
          <textarea className="avaGeneratorTextarea avaGeneratorTextareaSmall" value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} />

          <div className="avaGeneratorSubpanel">
            <div className="avaGeneratorSettingsTop">
              <div>
                <label className="avaGeneratorLabel">Режим</label>
                <select className="avaGeneratorSelect" value={route} onChange={(event) => handleRouteChange(event.target.value)}>
                  {ROUTES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              <div>
                <label className="avaGeneratorLabel">Формат</label>
                <div className="avaGeneratorAspectTabs">
                  {ASPECTS.map((item) => (
                    <button key={item.value} type="button" className={`avaGeneratorAspectBtn ${aspect === item.value ? 'isActive' : ''}`} onClick={() => setAspect(item.value)}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {routeInfo.kind === 'video' ? (
              <div className="avaGeneratorDurationBlock">
                <div className="avaGeneratorDurationHeader">
                  <span>Итоговая длительность</span>
                  <strong>{targetDurationSec.toFixed(1)} сек</strong>
                </div>
                <input className="avaGeneratorRange" type="range" min="1" max={durationMax} step="0.5" value={durationSec} onChange={(event) => setDurationSec(Number(event.target.value))} />
                <div className="avaGeneratorTrimHint"><strong>Контракт:</strong> генерация {generationDurationSec.toFixed(1)} сек → обрезка до {targetDurationSec.toFixed(1)} сек</div>
                <div className="avaGeneratorHint">{routeInfo.help}</div>
              </div>
            ) : (
              <div className="avaGeneratorHint isPlaceholder">{routeInfo.help}</div>
            )}
          </div>

          <div className="avaGeneratorCostBox">
            <div>
              <span>Стоимость генерации</span>
              <strong>{formatCreditCost(currentCreditCost)}</strong>
            </div>
            <div>
              <span>Баланс</span>
              <strong>{creditBalance == null ? '—' : `${creditBalance} кр.`}</strong>
            </div>
            {tariffError ? <em title={tariffError}>тариф fallback</em> : <em>тариф доски</em>}
          </div>

          {montageConfirmOpen ? (
        <div className="avaGeneratorConfirmOverlay" role="presentation" onMouseDown={cancelVideoMontageHandoff}>
          <section
            className="avaGeneratorConfirmModal"
            role="dialog"
            aria-modal="true"
            aria-label="Подтверждение перехода в монтажник"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="avaGeneratorConfirmIcon">🎬</div>
            <p className="avaGeneratorConfirmEyebrow">VIDEO MONTAGE</p>
            <h2>Передать видео в монтажник?</h2>
            <p className="avaGeneratorConfirmText">
              Будет передано <strong>{Math.min(10, generatedVideos.length)}</strong> видео из нижней ленты.
              Текущий монтажник и Board snapshot будут очищены и заменены этими видео.
            </p>

            {montageConfirmError ? (
              <div className="avaGeneratorConfirmError">{montageConfirmError}</div>
            ) : null}

            <div className="avaGeneratorConfirmActions">
              <button
                type="button"
                className="avaGeneratorConfirmCancel"
                onClick={cancelVideoMontageHandoff}
                disabled={montageConfirmBusy}
              >
                Отмена
              </button>
              <button
                type="button"
                className="avaGeneratorConfirmOk"
                onClick={confirmVideoMontageHandoff}
                disabled={montageConfirmBusy || !generatedVideos.length}
              >
                {montageConfirmBusy ? 'Готовлю…' : 'Да, перейти'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {generatedVideos.length ? (
            <div className="avaGeneratorToMontageBox">
              <div>
                <span>VIDEO MONTAGE</span>
                <strong>Собрать монтаж из ленты</strong>
                <p>Передаст {generatedVideos.length} видео в монтажник в порядке ленты.</p>
              </div>
              <button type="button" onClick={goToVideoMontageFromGenerator}>
                Перейти в видео монтаж
              </button>
            </div>
          ) : null}

          <div className="avaGeneratorActions">
            <button className="avaGeneratorPrimary" onClick={submitGeneration} disabled={busy || routeInfo.notReady}>
              {busy ? 'Генерация...' : routeInfo.notReady ? 'Модель позже' : '▶ Сгенерировать'}
            </button>
            <button className="avaGeneratorSecondary" onClick={stopPolling}>Стоп polling</button>
            <button className="avaGeneratorGhost" onClick={clearDraft}>Очистить</button>
          </div>

          {error ? <div className="avaGeneratorError">{error}</div> : null}
          <div className="avaGeneratorStatus">Статус: <strong>{statusText}</strong></div>
        </div>

        <div className="avaGeneratorPanel avaGeneratorMediaPanel">
          <h2>2. Медиа / Результат</h2>

          <div className="avaGeneratorUploadGrid" data-count={mediaColumnCount}>
            {routeInfo.needsStart ? (
              <label className="avaGeneratorDrop isRequired">
                <input type="file" accept="image/*" onChange={(event) => handleStartFile(event.target.files?.[0])} />
                <span>Стартовое изображение</span>
                <strong title={startFile?.name || ''}>{startFile?.name || 'загрузить фото'}</strong>
              </label>
            ) : null}

            {routeInfo.needsEnd ? (
              <label className="avaGeneratorDrop isRequired">
                <input type="file" accept="image/*" onChange={(event) => handleEndFile(event.target.files?.[0])} />
                <span>Последний кадр</span>
                <strong title={endFile?.name || ''}>{endFile?.name || 'загрузить end frame'}</strong>
              </label>
            ) : null}

            {routeInfo.needsAudio ? (
              <label className="avaGeneratorDrop isRequired">
                <input type="file" accept="audio/*" onChange={(event) => handleAudioFile(event.target.files?.[0])} />
                <span>Аудио для lip-sync</span>
                <strong title={audioName || ''}>{audioName || 'загрузить аудио'}</strong>
                {audioDurationSec > 0 ? <em>{formatSec(audioDurationSec)}</em> : null}
              </label>
            ) : null}

            {routeInfo.kind === 'image' ? (
              <div className="avaGeneratorMediaNotice">Для картинки по описанию сейчас нужен только prompt. Upload подключим позже, если понадобится.</div>
            ) : null}
          </div>

          <div className="avaGeneratorStageGrid">
            <div className="avaGeneratorThumbsCol">
              <button type="button" className="avaGeneratorThumbCard avaGeneratorThumbInteractive" onClick={() => openZoom(startPreview, startFile?.name || 'Start image')} disabled={!startPreview}>
                <div className="avaGeneratorThumbPreview">
                  {startPreview ? (
                    <>
                      <img src={startPreview} alt="start" />
                      <div className="avaGeneratorZoomOverlay"><span>⌕</span><em>Увеличить</em></div>
                    </>
                  ) : <span>start</span>}
                </div>
                <div className="avaGeneratorThumbMeta">
                  <strong>Start</strong>
                  <span title={startFile?.name || ''}>{startFile?.name || 'Нет изображения'}</span>
                </div>
              </button>

              {routeInfo.needsEnd ? (
                <button type="button" className="avaGeneratorThumbCard avaGeneratorThumbInteractive" onClick={() => openZoom(endPreview, endFile?.name || 'End image')} disabled={!endPreview}>
                  <div className="avaGeneratorThumbPreview">
                    {endPreview ? (
                      <>
                        <img src={endPreview} alt="end" />
                        <div className="avaGeneratorZoomOverlay"><span>⌕</span><em>Увеличить</em></div>
                      </>
                    ) : <span>end</span>}
                  </div>
                  <div className="avaGeneratorThumbMeta">
                    <strong>End</strong>
                    <span title={endFile?.name || ''}>{endFile?.name || 'Нет финального кадра'}</span>
                  </div>
                </button>
              ) : null}

              {routeInfo.needsAudio && audioName ? (
                <div className="avaGeneratorThumbCard isAudioCard">
                  <div className="avaGeneratorThumbPreview isAudioIcon"><span>♪</span></div>
                  <div className="avaGeneratorThumbMeta">
                    <div className="avaGeneratorAudioHeader">
                      <strong>Audio</strong>
                      <button type="button" className="avaGeneratorAudioBtn" onClick={toggleAudioPreview} title={isAudioPlaying ? 'Пауза' : 'Прослушать'}>
                        {isAudioPlaying ? '❚❚' : '▶'}
                      </button>
                    </div>
                    <span title={audioName}>{audioName}</span>
                    {audioDurationSec > 0 ? <em>{formatSec(audioDurationSec)}</em> : null}
                    {audioPreviewUrl ? <audio ref={audioRef} src={audioPreviewUrl} preload="metadata" hidden /> : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="avaGeneratorResultCol">
              <div className="avaGeneratorCanvas">
                {routeInfo.kind === 'image' ? (
                  <div className="avaGeneratorCanvasState isPlaceholder">
                    <strong>Режим картинки по описанию</strong>
                    <span>UI готов. Подключим модель позже.</span>
                  </div>
                ) : displayedResultUrl ? (
                  <video className="avaGeneratorVideo" src={displayedResultUrl} controls playsInline />
                ) : busy ? (
                  <div className="avaGeneratorCanvasState isBusy">
                    <div className="avaGeneratorSpinner" />
                    <strong>Идёт генерация</strong>
                    <span>{statusText}</span>
                  </div>
                ) : (
                  <div className="avaGeneratorCanvasState">
                    <strong>Результат появится здесь</strong>
                    <span>Когда генерация запустится, процесс и итог будут видны в этом поле.</span>
                  </div>
                )}
              </div>

              {canUseMmaudio ? (
                <div className={`avaGeneratorMmaudioPanel ${mmaudioOpen ? 'isOpen' : ''}`}>
                  <button type="button" className="avaGeneratorMmaudioToggle" onClick={() => setMmaudioOpen((value) => !value)}>
                    <span>✨ MMAudio / добавить звук · {formatCreditCost(mmaudioCreditCost)}</span>
                    <em>{mmaudioResultUrl ? 'звук готов' : mmaudioBusy ? 'генерация звука...' : 'открыть настройки'}</em>
                  </button>

                  {mmaudioOpen ? (
                    <div className="avaGeneratorMmaudioBody">
                      <label className="avaGeneratorLabel">Sound prompt</label>
                      <textarea className="avaGeneratorTextarea avaGeneratorTextareaSmall" value={mmaudioPrompt} onChange={(event) => setMmaudioPrompt(event.target.value)} />
                      <label className="avaGeneratorLabel">Negative sound prompt</label>
                      <textarea
                        className="avaGeneratorTextarea avaGeneratorTextareaSmall"
                        value={mmaudioNegativePrompt}
                        onChange={(event) => setMmaudioNegativePrompt(event.target.value)}
                      />
                      <div className="avaGeneratorMmaudioActions">
                        <button type="button" className="avaGeneratorMmaudioSend" onClick={submitMmaudio} disabled={mmaudioBusy}>
                          {mmaudioBusy ? 'Отправлено...' : '⚡ Отправить в MMAudio'}
                        </button>
                        {mmaudioResultUrl ? <span className="avaGeneratorMmaudioReady">результат вернулся в preview</span> : null}
                      </div>
                      {mmaudioError ? <div className="avaGeneratorError">{mmaudioError}</div> : null}
                      {mmaudioStatus ? <div className="avaGeneratorStatus">MMAudio: <strong>{mmaudioStatus}</strong></div> : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
{zoomImage ? (
        <div className="avaGeneratorLightbox" onClick={closeZoom} role="presentation">
          <div className="avaGeneratorLightboxContent">
            <img src={zoomImage.src} alt={zoomImage.title || 'preview'} />
            {zoomImage.title ? <div className="avaGeneratorLightboxCaption">{zoomImage.title}</div> : null}
          </div>
        </div>
      ) : null}
    
      {generatedVideos.length ? (
        <section className="avaGeneratorHistoryPanel">
          <div className="avaGeneratorHistoryHeader">
            <div>
              <p>RECENT RESULTS</p>
              <h2>Последние видео</h2>
            </div>
            <span>{generatedVideos.length}/10</span>
          </div>

          <div className="avaGeneratorHistoryScroller">
            {generatedVideos.map((item, index) => (
              <article
                key={item.id}
                className={`avaGeneratorHistoryCard ${selectedGalleryVideoUrl === item.url ? 'isActive' : ''}`}
                onClick={() => openGeneratedVideo(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') openGeneratedVideo(item)
                }}
              >
                <button
                  type="button"
                  className="avaGeneratorHistoryDelete"
                  onClick={(event) => removeGeneratedVideo(event, item)}
                  title="Удалить из ленты"
                >
                  ×
                </button>

                <div className="avaGeneratorHistoryThumb">
                  <video src={item.url} muted playsInline preload="metadata" />
                  <div className="avaGeneratorHistoryPlay">▶</div>
                </div>

                <div className="avaGeneratorHistoryMeta">
                  <strong>{item.label || 'Видео'} #{generatedVideos.length - index}</strong>
                  <span>{item.kind === 'mmaudio' ? 'со звуком' : 'result'} · {formatGeneratorGalleryTime(item.createdAt)}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

</main>
  )
}
