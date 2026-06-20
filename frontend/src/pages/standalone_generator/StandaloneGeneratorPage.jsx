import { useNavigate, useParams } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './StandaloneGeneratorPage.css'
import { pickLatestGeneratorJob } from '../../services/generatorJobs'
import { makeWorkflowEntry, rememberWorkflowEntry } from '../../utils/workflowNavigation.js'

const AVA_GENERATOR_ACTIVE_JOBS_KEY = 'ava:active-jobs:v1'

function readAvaGeneratorActiveJobs() {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(AVA_GENERATOR_ACTIVE_JOBS_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}


// AVA_GENERATOR_CANCEL_SAFE_V84: remove canceled generator jobs from local notifier queue.
function removeAvaGeneratorJobById(jobId) {
  if (typeof window === 'undefined') return
  const clean = String(jobId || '').replace(/^generator(-mmaudio)?:/, '').trim()
  if (!clean) return
  try {
    const next = readAvaGeneratorActiveJobs().filter((item) => {
      const id = String(item?.id || '').trim()
      const jid = String(item?.jobId || item?.job_id || '').trim()
      return id !== `generator:${clean}` && id !== `generator-mmaudio:${clean}` && jid !== clean
    })
    window.localStorage.setItem(AVA_GENERATOR_ACTIVE_JOBS_KEY, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent('ava:global-jobs-changed'))
  } catch {}
}


// AVA_GENERATOR_COMPACT_JOB_FIX_V1
function compactAvaGeneratorGlobalJob(job = {}) {
  if (!job || typeof job !== 'object') return null
  const projectId = String(job.projectId || '').trim()
  const stage = String(job.stage || 'generator').trim() || 'generator'
  const jobId = String(job.jobId || job.job_id || job.id || '').replace(/^generator:/, '').trim()
  const id = String(job.id || job.key || (jobId ? `generator:${jobId}` : '')).trim()
  const pagePath = String(job.pagePath || job.to || (projectId ? `/app/projects/${projectId}/generator` : '/app/workspace/generator')).trim()
  const resultUrl = String(
    job.resultUrl || job.videoUrl || job.video_url || job.resultVideoUrl || job.result_video_url ||
    job.videoApiPath || job.video_api_path || job.apiPath || job.api_path || ''
  ).trim()
  const statusEndpoint = String(job.statusEndpoint || '').trim()
  if (!id && !jobId && !statusEndpoint) return null

  return {
    id: id || (jobId ? `generator:${jobId}` : statusEndpoint),
    key: String(job.key || id || (jobId ? `generator:${jobId}` : statusEndpoint)).trim(),
    source: String(job.source || 'standalone_generator'),
    kind: String(job.kind || 'generator_video'),
    stage,
    projectId,
    workspaceMode: projectId ? false : !!job.workspaceMode,
    jobId,
    job_id: jobId,
    status: String(job.status || ''),
    statusEndpoint,
    pagePath,
    to: String(job.to || pagePath),
    route: String(job.route || ''),
    title: String(job.title || ''),
    toastTitle: String(job.toastTitle || job.title || ''),
    message: String(job.message || ''),
    sceneId: String(job.sceneId || ''),
    resultUrl,
    apiPath: String(job.apiPath || job.api_path || job.videoApiPath || job.video_api_path || ''),
    assetId: String(job.assetId || job.asset_id || job.videoAssetId || job.video_asset_id || ''),
    creditCost: Number(job.creditCost || 0) || 0,
    creditCharged: !!job.creditCharged,
    createdAt: String(job.createdAt || new Date().toISOString()),
    updatedAt: String(job.updatedAt || new Date().toISOString()),
  }
}

function compactAvaGeneratorGlobalJobs(jobs = []) {
  const seen = new Set()
  return (Array.isArray(jobs) ? jobs : [])
    .map(compactAvaGeneratorGlobalJob)
    .filter(Boolean)
    .filter((job) => {
      const key = job.key || job.id || job.jobId || job.statusEndpoint
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 10)
}

function purgeGeneratorHeavyLocalStorageForQuota() {
  if (typeof window === 'undefined') return
  const keys = [
    'ava:standalone_generator:v6',
    'ava:standalone_generator:v5',
    'ava:standalone_generator:v4',
    'ava:standalone_generator:gallery:v1',
    'ava:standalone_generator:media:v1',
  ]
  for (const key of keys) {
    try { window.localStorage.removeItem(key) } catch {}
  }
}

function writeAvaGeneratorActiveJobs(jobs) {
  if (typeof window === 'undefined') return
  const compactJobs = compactAvaGeneratorGlobalJobs(jobs)
  try {
    window.localStorage.setItem(AVA_GENERATOR_ACTIVE_JOBS_KEY, JSON.stringify(compactJobs))
    window.dispatchEvent(new CustomEvent('ava:jobs-changed'))
  } catch (error) {
    try {
      purgeGeneratorHeavyLocalStorageForQuota()
      window.localStorage.setItem(AVA_GENERATOR_ACTIVE_JOBS_KEY, JSON.stringify(compactJobs.slice(0, 5)))
      window.dispatchEvent(new CustomEvent('ava:jobs-changed'))
      console.warn('[GENERATOR ACTIVE JOB SAVE RECOVERED AFTER PURGE]', error)
    } catch (retryError) {
      console.warn('[GENERATOR ACTIVE JOB SAVE FAILED]', retryError)
    }
  }
}

function upsertGlobalJob(job = {}) {
  if (!job?.id) return null
  const now = new Date().toISOString()
  const jobs = readAvaGeneratorActiveJobs()
  const index = jobs.findIndex((item) => item.id === job.id || item.key === job.id)
  const projectId = String(job.projectId || '').trim()
  const stage = job.stage || 'generator'
  const pagePath = job.pagePath || (projectId ? `/app/projects/${projectId}/generator` : '/app/workspace/generator')
  const nextJob = {
    ...(index >= 0 ? jobs[index] : {}),
    ...job,
    key: job.key || job.id,
    id: job.id,
    projectId,
    stage,
    to: job.to || pagePath,
    pagePath,
    workspaceMode: !projectId,
    updatedAt: now,
    createdAt: job.createdAt || (index >= 0 ? jobs[index].createdAt : now),
  }
  if (index >= 0) jobs[index] = nextJob
  else jobs.unshift(nextJob)
  writeAvaGeneratorActiveJobs(jobs)
  return nextJob
}

function removeAvaGeneratorActiveJobsMatching({ refs = [], jobIds = [], projectId = '' } = {}) {
  if (typeof window === 'undefined') return
  const cleanRefs = new Set((Array.isArray(refs) ? refs : []).map((item) => String(item || '').trim()).filter(Boolean))
  const cleanJobIds = new Set((Array.isArray(jobIds) ? jobIds : []).map((item) => String(item || '').replace(/^generator-mmaudio:/, '').replace(/^mmaudio:/, '').replace(/^generator:/, '').trim()).filter(Boolean))
  const cleanProjectId = String(projectId || '').trim()
  if (!cleanRefs.size && !cleanJobIds.size && !cleanProjectId) return

  const jobs = readAvaGeneratorActiveJobs()
  const nextJobs = jobs.filter((job = {}) => {
    const jobProjectId = String(job.projectId || job.project_id || '').trim()
    if (cleanProjectId && jobProjectId && jobProjectId !== cleanProjectId) return true
    if (cleanProjectId && !cleanRefs.size && !cleanJobIds.size) {
      const jobPath = String(job.pagePath || job.to || '')
      const jobProjectMatches = jobProjectId === cleanProjectId || jobPath.includes(`/app/projects/${cleanProjectId}/generator`)
      return !(jobProjectMatches && String(job.stage || '').replace(/_/g, '-') === 'generator')
    }

    const jobId = String(job.jobId || job.job_id || job.id || '').replace(/^generator-mmaudio:/, '').replace(/^mmaudio:/, '').replace(/^generator:/, '').trim()
    if (jobId && cleanJobIds.has(jobId)) return false

    const jobRefs = [
      job.resultUrl, job.videoUrl, job.video_url, job.resultVideoUrl, job.result_video_url,
      job.apiPath, job.api_path, job.videoApiPath, job.video_api_path,
    ].map((value) => String(value || '').trim()).filter(Boolean)
    return !jobRefs.some((value) => cleanRefs.has(value))
  })

  if (nextJobs.length !== jobs.length) writeAvaGeneratorActiveJobs(nextJobs)
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

function cleanGeneratorProjectId(value = '') {
  const text = String(value || '').trim()
  if (!text) return ''
  const lowered = text.toLowerCase()
  if (lowered === 'none' || lowered === 'null' || lowered === 'undefined') return ''
  return text
}

function generatorProjectIdFromPath(pathname = '') {
  const path = String(pathname || (typeof window !== 'undefined' ? window.location.pathname : '') || '')
  const match = path.match(/\/app\/projects\/([^/]+)/)
  return cleanGeneratorProjectId(match?.[1] || '')
}


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
  const jobId = String(job.jobId || job.job_id || job.id || '').replace(/^generator:/, '').trim()
  const resultUrl = String(
    job.resultUrl || job.result_url || job.resultVideoUrl || job.result_video_url ||
    job.videoUrl || job.video_url || job.videoApiPath || job.video_api_path ||
    job.apiPath || job.api_path || ''
  ).trim()
  return {
    id: String(job.id || (jobId ? `generator:${jobId}` : '') || ''),
    key: String(job.key || job.id || (jobId ? `generator:${jobId}` : '') || ''),
    jobId,
    job_id: jobId,
    projectId: String(job.projectId || ''),
    stage: String(job.stage || 'generator'),
    pagePath: String(job.pagePath || ''),
    to: String(job.to || ''),
    status: String(job.status || job.video_status || ''),
    statusEndpoint: String(job.statusEndpoint || ''),
    statusBase: String(job.statusBase || ''),
    resultUrl,
    videoUrl: resultUrl,
    apiPath: String(job.apiPath || job.api_path || job.videoApiPath || job.video_api_path || ''),
    assetId: String(job.assetId || job.asset_id || job.videoAssetId || job.video_asset_id || ''),
    route: String(job.route || ''),
    kind: String(job.kind || ''),
    title: String(job.title || ''),
    updatedAt: String(job.updatedAt || ''),
    createdAt: String(job.createdAt || ''),
  }
}

function createLightGeneratorDraft(draft = {}) {
  return {
    route: draft.route || 'i2v',
    aspect: draft.aspect || '16:9',
    prompt: draft.prompt || '',
    negativePrompt: draft.negativePrompt || '',
    imageQuality: draft.imageQuality || TXT2IMG_DEFAULT_QUALITY,
    durationSec: draft.durationSec || 5,

    resultUrl: isBlockedGeneratorPreviewUrl(draft.resultUrl || '') ? '' : (draft.resultUrl || ''),
    statusText: draft.statusText || '',
    job: isBlockedGeneratorPreviewUrl(draft?.job?.resultUrl || draft?.job?.videoUrl || '') ? null : compactGeneratorJob(draft.job),

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
  { value: '9:16', label: '9:16', shape: 'vertical', width: 720, height: 1280 },
  { value: '16:9', label: '16:9', shape: 'horizontal', width: 1280, height: 720 },
  { value: '1:1', label: '1:1', shape: 'square', width: 1024, height: 1024 },
]

function generatorRenderSize(routeInfo, aspectInfo) {
  if (routeInfo?.kind !== 'image') {
    return {
      width: Number(aspectInfo?.width) || 1280,
      height: Number(aspectInfo?.height) || 720,
    }
  }

  const aspectValue = String(aspectInfo?.value || '16:9')
  if (aspectValue === '9:16') return { width: 1296, height: 2304 }
  if (aspectValue === '1:1') return { width: 2048, height: 2048 }
  return { width: 2304, height: 1296 }
}

const ROUTES = [
  { value: 'txt2img', label: 'Фото по описанию', shortLabel: 'фото', kind: 'image', needsStart: false, needsEnd: false, needsAudio: false, maxDuration: null, endpoint: '/clip/video/start', statusBase: '/clip/video/status/', help: 'Генерация картинки по описанию через text to image.json. Для 16:9 отправляем 2304×1296.' },
  { value: 'i2v', label: 'Фото → видео', shortLabel: 'фото→видео', kind: 'video', needsStart: true, needsEnd: false, needsAudio: false, maxDuration: 8, endpoint: '/clip/video/start', statusBase: '/clip/video/status/', help: 'Обычное видео: итог до 8 секунд. Генерация идёт с +1 сек запаса.' },
  { value: 'ia2v', label: 'Липсинк', shortLabel: 'липсинк', kind: 'video', needsStart: true, needsEnd: false, needsAudio: true, maxDuration: 10, maxAudioDuration: 15, endpoint: '/clip/video/start', statusBase: '/clip/video/status/', help: 'Lip-sync: итог до 10 сек, аудио до 15 сек. Видео идёт с +1 сек запаса.' },
  { value: 'ia2v_instrumental', label: 'Липсинк инструмента', shortLabel: 'инструмент', kind: 'video', needsStart: true, needsEnd: false, needsAudio: true, maxDuration: 10, maxAudioDuration: 15, endpoint: '/clip/video/start', statusBase: '/clip/video/status/', help: 'Инструментальный lip-sync: фото + audio драйвит игру/движение инструмента. Итог до 10 сек, аудио до 15 сек.' },
  { value: 'i2v_sound', label: 'Видео со звуком', shortLabel: 'звук', kind: 'video', needsStart: true, needsEnd: false, needsAudio: false, maxDuration: 8, endpoint: '/clip/video/start', statusBase: '/clip/video/status/', help: 'Звук/речь описываем в prompt. Аудио-файл не нужен.' },
  { value: 'i2v_text', label: 'Видео с речью', shortLabel: 'речь', kind: 'video', needsStart: true, needsEnd: false, needsAudio: false, maxDuration: 8, endpoint: '/clip/video/start', statusBase: '/clip/video/status/', help: 'Короткая речь/звук задаётся в prompt. Аудио-файл не нужен.' },
  { value: 'first_last', label: 'Первый-последний кадр', shortLabel: 'first-last', kind: 'video', needsStart: true, needsEnd: true, needsAudio: false, maxDuration: 8, endpoint: '/clip/video/start', statusBase: '/clip/video/status/', help: 'Нужны Start и End. Генерация идёт с +1 сек запаса.' },
  { value: 'first_last_sound', label: 'Первый-последний кадр со звуком', shortLabel: 'first-last+звук', kind: 'video', needsStart: true, needsEnd: true, needsAudio: false, maxDuration: 8, endpoint: '/clip/video/start', statusBase: '/clip/video/status/', help: 'Нужны Start и End. Звук/речь описываем в prompt.' },
]

const DEFAULT_NEGATIVE = 'identity drift, deformed body, bad hands, extra limbs, warped face, melting objects, text, logo, watermark, subtitles, flicker, jitter, unstable camera, broken geometry'

const GENERATOR_FALLBACK_CREDITS = {
  txt2img: 1,
  i2v: 1,
  ia2v: 1,
  ia2v_instrumental: 2,
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
    ia2v_instrumental: ['ia2v_instrumental', 'ia2v-instrumental', 'instrumental', 'instrument', 'instrument_lipsync', 'instrument-lipsync'],
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
  for (const key of ['balance', 'creditBalance', 'credit_balance', 'credits', 'credits_balance', 'amount']) {
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

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    if (!blob) return resolve('')
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('blob read failed'))
    reader.readAsDataURL(blob)
  })
}

async function readUrlAsDataUrl(url) {
  const cleanUrl = normalizeUrl(url)
  if (!cleanUrl) return ''
  if (cleanUrl.startsWith('data:')) return cleanUrl
  const response = await fetch(cleanUrl, isGeneratorAssetFileRef(cleanUrl) ? { headers: authHeaders() } : undefined)
  if (!response.ok) throw new Error(`frame image download failed: ${response.status}`)
  const blob = await response.blob()
  return readBlobAsDataUrl(blob)
}

function extractLastFrameFromVideoInBrowser(url) {
  return new Promise((resolve, reject) => {
    const cleanUrl = normalizeUrl(url)
    if (!cleanUrl) return reject(new Error('missing video url'))
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'auto'
    video.playsInline = true
    let done = false
    const fail = (message) => {
      if (done) return
      done = true
      try { video.removeAttribute('src'); video.load?.() } catch {}
      reject(new Error(message))
    }
    const finish = () => {
      if (done) return
      try {
        const width = Math.max(2, video.videoWidth || 1280)
        const height = Math.max(2, video.videoHeight || 720)
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
        done = true
        try { video.removeAttribute('src'); video.load?.() } catch {}
        resolve(dataUrl)
      } catch (error) {
        fail(error?.message || 'browser frame capture failed')
      }
    }
    video.onerror = () => fail('browser could not load source video')
    video.onloadedmetadata = () => {
      const duration = Number(video.duration || 0)
      const target = Number.isFinite(duration) && duration > 0.2 ? Math.max(0, duration - 0.12) : 0
      try { video.currentTime = target } catch { finish() }
    }
    video.onseeked = finish
    video.src = cleanUrl
    video.load?.()
    window.setTimeout(() => fail('browser frame capture timeout'), 12000)
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
  // Important:
  // - For images, imageUrl is the final asset.
  // - For videos, videoUrl/video_url is usually the trimmed final asset.
  // - resultUrl can point to the raw Comfy output before trim, so keep it as fallback.
  return (
    data.imageUrl || data.image_url || data.outputImageUrl || data.output_image_url ||
    data.resultImageUrl || data.result_image_url || data.imageApiPath || data.image_api_path ||
    data.videoUrl || data.video_url || data.outputVideoUrl || data.output_video_url ||
    data.resultVideoUrl || data.result_video_url || data.videoApiPath || data.video_api_path ||
    data.resultUrl || data.result_url || ''
  )
}

function pickMmaudioOutputUrl(data) {
  if (!data || typeof data !== 'object') return ''

  const sourceCandidates = [
    data.sourceVideoUrl,
    data.source_video_url,
    data.inputVideoUrl,
    data.input_video_url,
    data.videoSourceUrl,
    data.video_source_url,
  ].map((value) => normalizeUrl(value || '')).filter(Boolean)

  const candidates = [
    data.mmaudioVideoUrl,
    data.mmaudio_video_url,
    data.mmaudioResultUrl,
    data.mmaudio_result_url,
    data.resultUrl,
    data.result_url,
    data.videoUrl,
    data.video_url,
    data.outputVideoUrl,
    data.output_video_url,
  ].map((value) => normalizeUrl(value || '')).filter(Boolean)

  const picked = candidates.find((url) => !sourceCandidates.includes(url))
  return picked || ''
}


function normalizeUrl(value) {
  const s = String(value || '').trim()
  if (!s) return ''
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('blob:') || s.startsWith('data:')) return s
  if (s.startsWith('/')) return `${API_BASE}${s}`
  return s
}

function isGeneratorAssetFileRef(value = '') {
  const raw = String(value || '').trim()
  if (!raw) return false
  if (raw.startsWith('/assets/') || raw.startsWith('/api/assets/')) return true
  try {
    const parsed = new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
    return /\/(?:api\/)?assets\/[^/]+\/file/i.test(parsed.pathname || '')
  } catch {
    return false
  }
}

async function fetchGeneratorAssetBlobUrl(value = '') {
  const cleanUrl = normalizeUrl(value)
  if (!cleanUrl) return ''
  const response = await fetch(cleanUrl, { headers: authHeaders() })
  if (!response.ok) throw new Error(`asset preview failed: ${response.status}`)
  const blob = await response.blob()
  return URL.createObjectURL(blob)
}


function isBlockedGeneratorPreviewUrl(url) {
  const value = String(url || '').trim()
  if (!value) return false
  try {
    const parsed = new URL(value, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
    const host = String(parsed.hostname || '').toLowerCase()
    const path = String(parsed.pathname || '')
    if ((host === 'localhost' || host === '127.0.0.1') && path.startsWith('/static/assets/')) return true
    if (path.startsWith('/static/assets/board_videos/')) return true
    if (path.startsWith('/static/assets/board_assembly/')) return true
  } catch {
    if (value.startsWith('/static/assets/board_videos/')) return true
    if (value.startsWith('/static/assets/board_assembly/')) return true
  }
  return false
}

function isGeneratorImageUrl(url) {
  const value = String(url || '').trim()
  if (!value) return false
  if (/^data:image\//i.test(value)) return true
  return /\.(png|jpe?g|webp)(\?|#|$)/i.test(value)
}

function normalizeGeneratorGalleryItem(item) {
  if (!item || typeof item !== 'object') return null
  const url = normalizeUrl(item.url || item.videoUrl || item.imageUrl || item.resultUrl || '')
  if (!url || isBlockedGeneratorPreviewUrl(url)) return null
  const isImage = isGeneratorImageUrl(url)
  return {
    ...item,
    url,
    kind: isImage ? 'image' : (item.kind || 'video'),
  }
}


function generatorComparableRef(...values) {
  const canonical = generatorCanonicalApiPath(...values)
  if (canonical) return canonical
  for (const value of values) {
    const raw = normalizeUrl(value || '')
    if (raw) return raw
  }
  return ''
}

function generatorGalleryTombstoneRef(...values) {
  const assetId = generatorAssetIdFromRef(...values)
  if (assetId) return `asset:${assetId}`
  return generatorComparableRef(...values)
}

function generatorCleanJobId(value = '') {
  return String(value || '').replace(/^generator-mmaudio:/, '').replace(/^mmaudio:/, '').replace(/^generator:/, '').trim()
}

function upsertGeneratorGalleryResult(items = [], url = '', meta = {}) {
  const cleanUrl = normalizeUrl(url)
  if (!cleanUrl || isBlockedGeneratorPreviewUrl(cleanUrl)) {
    return Array.isArray(items) ? items.map(normalizeGeneratorGalleryItem).filter(Boolean).slice(0, GENERATOR_GALLERY_HARD_LIMIT) : []
  }
  const canonicalUrl = generatorCanonicalApiPath(cleanUrl) || cleanUrl
  const key = generatorComparableRef(canonicalUrl)
  const current = createGeneratorGalleryItem(canonicalUrl, {
    ...meta,
    apiPath: meta.apiPath || meta.api_path || generatorCanonicalApiPath(canonicalUrl),
    assetId: meta.assetId || meta.asset_id || generatorAssetIdFromRef(canonicalUrl),
  })
  const old = Array.isArray(items) ? items.map(normalizeGeneratorGalleryItem).filter(Boolean) : []
  const withoutDuplicate = old.filter((item) => generatorComparableRef(item.apiPath || item.api_path || item.url) !== key)
  // Gallery order is left-to-right: oldest -> newest.
  // Keep existing items in their original order and append the completed result to the right.
  return [...withoutDuplicate, current].slice(-GENERATOR_GALLERY_HARD_LIMIT)
}

function pickGeneratorCreditBalance(value) {
  if (!value || typeof value !== 'object') return null

  for (const key of ['balance', 'creditBalance', 'credit_balance', 'credits_balance', 'credits', 'amount']) {
    const raw = value?.[key]
    if (raw === 0 || raw) {
      const numberValue = Number(raw)
      if (Number.isFinite(numberValue)) return numberValue
    }
  }

  if (value.user && typeof value.user === 'object') {
    const fromUser = pickGeneratorCreditBalance(value.user)
    if (fromUser !== null) return fromUser
  }

  if (value.creditChargeResult && typeof value.creditChargeResult === 'object') {
    const fromCharge = pickGeneratorCreditBalance(value.creditChargeResult)
    if (fromCharge !== null) return fromCharge
  }

  return null
}

function notifyGeneratorCreditBalance(payload, source = 'generator') {
  if (typeof window === 'undefined') return

  const balance = pickGeneratorCreditBalance(payload)
  if (balance === null) return

  const detail = {
    balance,
    credits_balance: balance,
    creditBalance: balance,
    source,
    summary: payload,
  }

  window.dispatchEvent(new CustomEvent('ava:credits-updated', { detail }))
  window.dispatchEvent(new CustomEvent('ava:credits-changed', { detail }))
}

function guessGeneratorDownloadName(url, kind = 'image') {
  const fallbackExt = kind === 'image' ? '.png' : '.mp4'
  try {
    if (String(url || '').startsWith('data:image/jpeg')) return `ava_image_${Date.now()}.jpg`
    if (String(url || '').startsWith('data:image/webp')) return `ava_image_${Date.now()}.webp`
    if (String(url || '').startsWith('data:image/')) return `ava_image_${Date.now()}.png`

    const parsed = new URL(String(url || ''), window.location.href)
    const rawName = decodeURIComponent((parsed.pathname.split('/').pop() || '').trim())
    if (rawName && rawName.includes('.')) return rawName
  } catch {
    // ignore
  }
  return `${kind === 'image' ? 'ava_image' : 'ava_video'}_${Date.now()}${fallbackExt}`
}

async function downloadGeneratorAsset(url, kind = 'image') {
  const cleanUrl = normalizeUrl(url)
  if (!cleanUrl) throw new Error('empty asset url')

  const filename = guessGeneratorDownloadName(cleanUrl, kind)
  let objectUrl = ''

  try {
    if (cleanUrl.startsWith('data:')) {
      objectUrl = cleanUrl
    } else {
      const response = await fetch(cleanUrl, isGeneratorAssetFileRef(cleanUrl) ? { headers: authHeaders() } : undefined)
      if (!response.ok) throw new Error(`download failed: ${response.status}`)
      const blob = await response.blob()
      objectUrl = URL.createObjectURL(blob)
    }

    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()

    if (objectUrl && objectUrl !== cleanUrl && objectUrl.startsWith('blob:')) {
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500)
    }
  } catch (error) {
    window.open(cleanUrl, '_blank', 'noopener,noreferrer')
    throw error
  }
}

function statusLooksDone(status = '') {
  const s = String(status || '').toLowerCase()
  return ['completed', 'done', 'ready', 'success'].some((x) => s.includes(x))
}

function statusLooksFailed(status = '') {
  const s = String(status || '').toLowerCase()
  return ['failed', 'error', 'blocked', 'missing', 'not_found'].some((x) => s.includes(x))
}

function generatorJobStatusValue(job = {}) {
  return String(job?.status || job?.rawStatus || job?.video_status || job?.videoStatus || '').trim()
}

function generatorJobLooksActive(job = {}) {
  const jobId = String(job?.jobId || job?.job_id || '').replace(/^generator:/, '').trim()
  if (!jobId) return false
  const status = generatorJobStatusValue(job).toLowerCase()
  if (statusLooksDone(status) || statusLooksFailed(status)) return false
  if (!status) return true
  return ['queued', 'pending', 'running', 'processing', 'submitted', 'started', 'in_progress', 'created'].some((item) => status.includes(item))
}

function generatorMmaudioJobId(job = {}) {
  return String(job?.jobId || job?.job_id || job?.id || '')
    .replace(/^generator-mmaudio:/, '')
    .replace(/^mmaudio:/, '')
    .trim()
}

function generatorSnapshotCompletedMmaudioIds(snapshot = {}) {
  const ids = Array.isArray(snapshot?.completedMmaudioJobIds) ? snapshot.completedMmaudioJobIds : []
  const lastId = snapshot?.lastCompletedMmaudioJobId || snapshot?.last_completed_mmaudio_job_id || ''
  return new Set([...ids, lastId].map((item) => String(item || '').replace(/^generator-mmaudio:/, '').replace(/^mmaudio:/, '').trim()).filter(Boolean))
}

function generatorSnapshotHasCompletedMmaudioJob(snapshot = {}, jobId = '') {
  const cleanJobId = String(jobId || '').replace(/^generator-mmaudio:/, '').replace(/^mmaudio:/, '').trim()
  if (!cleanJobId) return false
  if (generatorSnapshotCompletedMmaudioIds(snapshot).has(cleanJobId)) return true
  const snapshotStatus = String(snapshot?.mmaudioStatus || snapshot?.mmaudio_status || '').toLowerCase()
  const snapshotJobId = generatorMmaudioJobId(snapshot?.mmaudioJob || {})
  return statusLooksDone(snapshotStatus) && (!snapshotJobId || snapshotJobId === cleanJobId)
}

function generatorStatusBaseFromJob(job = {}, fallback = '') {
  const jobId = String(job?.jobId || job?.job_id || '').replace(/^generator:/, '').trim()
  const direct = String(job?.statusBase || '').trim()
  if (direct) return direct
  const endpoint = String(job?.statusEndpoint || '').trim()
  if (endpoint && jobId && endpoint.endsWith(jobId)) return endpoint.slice(0, -jobId.length)
  return String(fallback || '').trim()
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
const GENERATOR_GALLERY_HARD_LIMIT = 30
const TXT2IMG_DEFAULT_QUALITY = 'ultra'
const TXT2IMG_QUALITY_OPTIONS = [
  { value: 'high', payloadValue: 'high', label: 'Высокое', hint: 'быстрее · 1 кред.' },
  { value: 'ultra', payloadValue: 'max', label: 'Ультра', hint: 'лучшее · 2 кред.' },
]

function readGeneratorGalleryDraft() {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(GENERATOR_GALLERY_KEY) || '[]')
    return Array.isArray(parsed)
      ? parsed.map(normalizeGeneratorGalleryItem).filter(Boolean).slice(0, GENERATOR_GALLERY_HARD_LIMIT)
      : []
  } catch {
    return []
  }
}

function writeGeneratorGalleryDraft(items) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(GENERATOR_GALLERY_KEY, JSON.stringify(dedupeGeneratorGalleryItems(items)))
  } catch (error) {
    console.warn('[GENERATOR GALLERY SAVE FAILED]', error)
  }
}

function createGeneratorGalleryItem(url, meta = {}) {
  const now = new Date().toISOString()
  return {
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    url,
    apiPath: meta.apiPath || meta.api_path || generatorCanonicalApiPath(url),
    api_path: meta.apiPath || meta.api_path || generatorCanonicalApiPath(url),
    assetId: meta.assetId || meta.asset_id || generatorAssetIdFromRef(url),
    asset_id: meta.assetId || meta.asset_id || generatorAssetIdFromRef(url),
    label: meta.label || 'Видео',
    route: meta.route || '',
    kind: meta.kind || 'video',
    durationSec: meta.durationSec || meta.duration_sec || meta.targetDurationSec || meta.target_duration_sec || 0,
    createdAt: now,
  }
}

function generatorGalleryIdentity(value = '') {
  const canonical = generatorCanonicalApiPath(value)
  return canonical || normalizeUrl(value || '')
}

function mergeGeneratorGalleryItem(list, url, meta = {}) {
  const cleanUrl = normalizeUrl(url || '')
  if (!cleanUrl) return Array.isArray(list) ? list : []
  const nextItem = createGeneratorGalleryItem(cleanUrl, meta)
  const nextIdentity = generatorGalleryIdentity(nextItem.apiPath || nextItem.url)
  const oldItems = Array.isArray(list) ? list : []
  const withoutDuplicate = oldItems.filter((item) => {
    const itemIdentity = generatorGalleryIdentity(item?.apiPath || item?.api_path || item?.url || '')
    return itemIdentity && nextIdentity ? itemIdentity !== nextIdentity : normalizeUrl(item?.url || '') !== cleanUrl
  })
  // Gallery order is left-to-right: oldest -> newest.
  // Existing cards keep their order; the new result is appended to the right.
  return [...withoutDuplicate, nextItem].slice(-GENERATOR_GALLERY_HARD_LIMIT)
}


// AVA_GENERATOR_GALLERY_DEDUPE_V83
// One completed generator job may be observed by both the page poller and the
// shell watcher. Keep only one feed card per backend asset/API path/job result.
function dedupeGeneratorGalleryItems(items = []) {
  const seen = new Set()
  const output = []
  for (const rawItem of (Array.isArray(items) ? items : [])) {
    const item = normalizeGeneratorGalleryItem(rawItem)
    if (!item) continue
    const key = generatorGalleryTombstoneRef(item.apiPath, item.api_path, item.assetId, item.asset_id, item.url) || item.id || item.url
    if (key && seen.has(key)) continue
    if (key) seen.add(key)
    output.push(item)
  }
  return output.slice(-GENERATOR_GALLERY_HARD_LIMIT)
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


// AVA_ASSEMBLY_GENERATOR_TIMELINE_DURATION_V3:
// Generator gallery clips should enter Montage with their visible target duration.
// Older gallery cards may not have duration metadata; Generator default is 3 sec, not 6 sec.
function getGeneratorAssemblyVideoDuration(item = {}, fallback = 3) {
  const raw = Number(
    item.targetDurationSec
    || item.target_duration_sec
    || item.trimToDurationSec
    || item.trim_to_duration_sec
    || item.durationSec
    || item.duration_sec
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
    const duration = getGeneratorAssemblyVideoDuration(item, 3)
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
      video_asset_id: item.assetId || item.asset_id || generatorAssetIdFromRef(item.url),
      videoAssetId: item.assetId || item.asset_id || generatorAssetIdFromRef(item.url),
      video_api_path: item.apiPath || item.api_path || generatorCanonicalApiPath(item.url),
      videoApiPath: item.apiPath || item.api_path || generatorCanonicalApiPath(item.url),
      mmaudio_video_url: isMmaudio ? item.url : '',
      mmaudioVideoUrl: isMmaudio ? item.url : '',
      duration_sec: duration,
      durationSec: duration,
      target_duration_sec: duration,
      targetDurationSec: duration,
      assembly_duration_source: item.durationSec || item.duration_sec || item.targetDurationSec || item.target_duration_sec || item.trimToDurationSec || item.trim_to_duration_sec ? 'generator_gallery_metadata' : 'generator_default_3s',
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
        apiPath: item.apiPath || item.api_path || generatorCanonicalApiPath(item.url),
        assetId: item.assetId || item.asset_id || generatorAssetIdFromRef(item.url),
        label: item.label || '',
        route: item.route || '',
        kind: item.kind || '',
        durationSec: getGeneratorAssemblyVideoDuration(item, 3),
        durationSource: item.durationSec || item.duration_sec || item.targetDurationSec || item.target_duration_sec || item.trimToDurationSec || item.trim_to_duration_sec ? 'generator_gallery_metadata' : 'generator_default_3s',
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

async function saveGeneratorHandoffBoardSnapshot(board = {}, projectId = '') {
  const safeProjectId = String(projectId || '').trim()
  const endpoint = safeProjectId ? `${API_BASE}/projects/${safeProjectId}/snapshots/board` : `${API_BASE}/workspace/snapshots/board`
  const response = await fetch(endpoint, {
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

function assemblyFinalUrlFromSnapshot(snapshot = {}) {
  const data = snapshot?.data || snapshot?.snapshot?.data || snapshot || {}
  return normalizeUrl(
    data.finalVideoUrl || data.final_video_url || data.finalUrl || data.final_url ||
    data.assemblyUrl || data.assembly_url || data.outputUrl || data.output_url ||
    data.downloadUrl || data.download_url || data.resultUrl || data.result_url ||
    data.assemblyApiPath || data.assembly_api_path || data.finalVideoApiPath || data.final_video_api_path ||
    data.videoApiPath || data.video_api_path || data.videoUrl || data.video_url || ''
  )
}

function assemblySceneRefsFromSnapshot(snapshot = {}) {
  const data = snapshot?.data || snapshot?.snapshot?.data || snapshot || {}
  const board = data.board || data.boardSnapshot || data.board_snapshot || {}
  const scenes = (Array.isArray(data.scenes) && data.scenes.length ? data.scenes : null)
    || (Array.isArray(data.boardScenes) && data.boardScenes.length ? data.boardScenes : null)
    || (Array.isArray(data.board_scenes) && data.board_scenes.length ? data.board_scenes : null)
    || (Array.isArray(board.scenes) ? board.scenes : [])
  return scenes.map((scene) => generatorComparableRef(
    scene?.mmaudioVideoApiPath,
    scene?.mmaudio_video_api_path,
    scene?.videoApiPath,
    scene?.video_api_path,
    scene?.url,
    scene?.videoUrl,
    scene?.video_url,
    scene?.apiPath,
    scene?.api_path,
    scene?.assetId,
    scene?.asset_id,
    scene?.id,
    scene?.scene_id,
  )).filter(Boolean)
}

function sameAssemblySceneRefs(left = [], right = []) {
  if (!left.length || !right.length || left.length !== right.length) return false
  return left.every((item, index) => item === right[index])
}

async function fetchExistingBoardAssemblySnapshot(projectId = '') {
  const safeProjectId = String(projectId || '').trim()
  const endpoint = safeProjectId ? `${API_BASE}/projects/${safeProjectId}/snapshots/board_assembly` : `${API_BASE}/workspace/snapshots/board_assembly`
  try {
    const response = await fetch(endpoint, { headers: authHeaders() })
    if (!response.ok) return null
    const data = await response.json().catch(() => null)
    return data?.snapshot?.data || data?.data || data?.snapshot || data || null
  } catch {
    return null
  }
}

async function saveGeneratorHandoffAssemblySnapshot(board = {}, projectId = '') {
  // AVA_ASSEMBLY_SOURCE_OF_TRUTH_V6:
  // Generator → Montage handoff writes board_assembly immediately, so another
  // computer opens the same scene list without relying on browser localStorage.
  // AVA_ASSEMBLY_FINAL_RESULT_TRANSFER_V7:
  // Do not wipe an already completed montage result when re-entering montage from Generator
  // with the same clip list. Only mark the old MP4 dirty when the clip refs changed.
  const scenes = Array.isArray(board?.scenes) ? board.scenes : []
  const existingAssembly = await fetchExistingBoardAssemblySnapshot(projectId)
  const existingFinalUrl = assemblyFinalUrlFromSnapshot(existingAssembly || {})
  const currentRefs = assemblySceneRefsFromSnapshot({ scenes })
  const existingRefs = assemblySceneRefsFromSnapshot(existingAssembly || {})
  const preserveExistingFinal = Boolean(existingFinalUrl && sameAssemblySceneRefs(currentRefs, existingRefs))
  const snapshot = {
    stage: 'board_assembly',
    source: 'standalone_generator_handoff',
    schema: 'ava_board_assembly_snapshot_v2',
    reason: 'generator_handoff_source_of_truth_v6',
    projectId: projectId || '',
    updatedAt: new Date().toISOString(),
    board,
    boardSnapshot: board,
    board_snapshot: board,
    boardVersion: board?.boardVersion || board?.board_version || '',
    board_version: board?.board_version || board?.boardVersion || '',
    boardSource: board?.source || 'standalone_generator',
    board_source: board?.source || 'standalone_generator',
    sourceNodeId: board?.sourceNodeId || board?.source_node_id || 'standalone_generator',
    source_node_id: board?.source_node_id || board?.sourceNodeId || 'standalone_generator',
    generatorHandoff: board?.generatorHandoff || null,
    generator_handoff: board?.generatorHandoff || null,
    boardAudio: board?.audio || null,
    board_audio: board?.audio || null,
    audio: board?.audio || null,
    scenes,
    boardScenes: scenes,
    board_scenes: scenes,
    items: scenes.map((scene, index) => ({
      id: scene.id || scene.scene_id || `generator_scene_${index + 1}`,
      scene_id: scene.scene_id || scene.id || `generator_scene_${index + 1}`,
      title: scene.title || scene.text || `Видео ${index + 1}`,
      route: scene.route || 'i2v',
      start: scene.start ?? scene.start_sec ?? 0,
      start_sec: scene.start_sec ?? scene.start ?? 0,
      end: scene.end ?? scene.end_sec ?? 0,
      end_sec: scene.end_sec ?? scene.end ?? 0,
      duration: scene.durationSec ?? scene.duration_sec ?? 0,
      duration_sec: scene.duration_sec ?? scene.durationSec ?? 0,
      videoUrl: scene.videoUrl || scene.video_url || '',
      video_url: scene.video_url || scene.videoUrl || '',
      videoApiPath: scene.videoApiPath || scene.video_api_path || '',
      video_api_path: scene.video_api_path || scene.videoApiPath || '',
      hasVideo: Boolean(scene.videoApiPath || scene.video_api_path || scene.videoUrl || scene.video_url),
      hasMmaudio: Boolean(scene.mmaudioVideoApiPath || scene.mmaudio_video_api_path || scene.mmaudioVideoUrl || scene.mmaudio_video_url),
      raw: scene,
    })),
    audioMode: 'scene_only',
    audio_mode: 'scene_only',
    preferMmaudio: true,
    prefer_mmaudio: true,
    skipMissing: false,
    skip_missing: false,
    originalVolume: 0,
    sceneVolume: 100,
    musicVolume: 15,
    musicLoop: true,
    musicFadeOut: true,
    watermarkDefaultVersion: 'wm_defaults_v2_ava_studio_top_right_corners_35_28',
    watermark: { enabled: true, text: 'ava studio', position: 'top_right', opacityPercent: 35, size: 28, motion: 'corners' },
    selectedSceneId: scenes[0]?.id || scenes[0]?.scene_id || '',
    finalVideoUrl: preserveExistingFinal ? existingFinalUrl : '',
    final_video_url: preserveExistingFinal ? existingFinalUrl : '',
    finalUrl: preserveExistingFinal ? existingFinalUrl : '',
    final_url: preserveExistingFinal ? existingFinalUrl : '',
    assemblyUrl: preserveExistingFinal ? existingFinalUrl : '',
    assembly_url: preserveExistingFinal ? existingFinalUrl : '',
    outputUrl: preserveExistingFinal ? existingFinalUrl : '',
    output_url: preserveExistingFinal ? existingFinalUrl : '',
    downloadUrl: preserveExistingFinal ? existingFinalUrl : '',
    download_url: preserveExistingFinal ? existingFinalUrl : '',
    resultUrl: preserveExistingFinal ? existingFinalUrl : '',
    result_url: preserveExistingFinal ? existingFinalUrl : '',
    finalDirty: Boolean(existingFinalUrl && !preserveExistingFinal),
    final_dirty: Boolean(existingFinalUrl && !preserveExistingFinal),
    assemblyJob: preserveExistingFinal ? null : (existingAssembly?.assemblyJob || existingAssembly?.job || null),
    job: preserveExistingFinal ? null : (existingAssembly?.assemblyJob || existingAssembly?.job || null),
  }
  const safeProjectId = String(projectId || '').trim()
  const endpoint = safeProjectId ? `${API_BASE}/projects/${safeProjectId}/snapshots/board_assembly` : `${API_BASE}/workspace/snapshots/board_assembly`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      data: snapshot,
      client_version: 'generator-to-board-assembly-v6',
      guard_mode: 'replace',
    }),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `board_assembly snapshot save failed ${response.status}`)
  }
  return response.json().catch(() => null)
}

function generatorAssetIdFromRef(...values) {
  for (const value of values) {
    const raw = String(value || '').trim()
    if (!raw) continue
    if (raw.startsWith('asset_')) return raw
    const match = raw.match(/\/(?:api\/)?assets\/([^/]+)\/file/i)
    if (match?.[1]) return decodeURIComponent(match[1])
  }
  return ''
}

function generatorAssetApiPath(assetId = '') {
  const safeAssetId = String(assetId || '').trim()
  return safeAssetId ? `/assets/${safeAssetId}/file` : ''
}


function generatorAssetThumbApiPath(assetId = '') {
  const safeAssetId = String(assetId || '').trim()
  return safeAssetId ? `/assets/${safeAssetId}/thumb` : ''
}

async function fetchGeneratorAssetThumbBlobUrl(value = '') {
  // AVA_GENERATOR_HISTORY_THUMBNAILS_V12B:
  // History cards must fetch a tiny protected thumbnail, not the full MP4.
  const assetId = generatorAssetIdFromRef(value)
  const thumbApiPath = generatorAssetThumbApiPath(assetId)
  if (!thumbApiPath) return ''
  const response = await fetch(`${API_BASE}${thumbApiPath}`, { headers: authHeaders() })
  if (!response.ok) throw new Error(`asset thumb failed: ${response.status}`)
  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

function generatorCanonicalApiPath(...values) {
  const assetId = generatorAssetIdFromRef(...values)
  if (assetId) return generatorAssetApiPath(assetId)
  for (const value of values) {
    const raw = String(value || '').trim()
    if (!raw) continue
    if (raw.startsWith('/assets/')) return raw
    try {
      const parsed = new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
      const match = parsed.pathname.match(/\/api\/assets\/([^/]+)\/file/i) || parsed.pathname.match(/\/assets\/([^/]+)\/file/i)
      if (match?.[1]) return generatorAssetApiPath(decodeURIComponent(match[1]))
    } catch {
      // ignore
    }
  }
  return ''
}



async function deleteGeneratorAssetByRef(...values) {
  const assetId = generatorAssetIdFromRef(...values)
  if (!assetId) return { skipped: true, reason: 'no_asset_id' }
  try {
    const result = await fetchJson(`/assets/${encodeURIComponent(assetId)}`, { method: 'DELETE' })
    console.log('[GENERATOR FEED ASSET DELETED V83]', { assetId, result })
    return result
  } catch (error) {
    console.warn('[GENERATOR FEED ASSET DELETE FAILED V83]', { assetId, error: error?.message || error })
    return { skipped: true, error: String(error?.message || error) }
  }
}

function deleteGeneratorAssetsByRefs(values = [], reason = 'generator_cleanup') {
  const seen = new Set()
  for (const value of (Array.isArray(values) ? values : [])) {
    const assetId = generatorAssetIdFromRef(value)
    if (!assetId || seen.has(assetId)) continue
    seen.add(assetId)
    deleteGeneratorAssetByRef(assetId).catch((error) => {
      console.warn('[GENERATOR FEED ASSET DELETE ASYNC FAILED V83]', { reason, assetId, error: error?.message || error })
    })
  }
}

function generatorResultRefs(data = {}, fallbackUrl = '') {
  const apiPath = generatorCanonicalApiPath(
    data?.videoAssetId, data?.video_asset_id, data?.imageAssetId, data?.image_asset_id,
    data?.assetId, data?.asset_id, data?.videoApiPath, data?.video_api_path,
    data?.imageApiPath, data?.image_api_path, data?.resultVideoApiPath, data?.result_video_api_path,
    data?.resultImageApiPath, data?.result_image_api_path, fallbackUrl, data?.videoUrl, data?.video_url,
    data?.imageUrl, data?.image_url, data?.resultUrl, data?.result_url
  )
  const assetId = generatorAssetIdFromRef(apiPath, fallbackUrl, data?.assetId, data?.asset_id, data?.videoAssetId, data?.video_asset_id, data?.imageAssetId, data?.image_asset_id)
  return { assetId, apiPath, url: apiPath || fallbackUrl || '' }
}

async function uploadGeneratorMediaAsset(file, { projectId = '', kind = 'image', stage = 'generator_media' } = {}) {
  if (!file) return null
  const form = new FormData()
  form.append('file', file)
  if (projectId) form.append('project_id', projectId)
  form.append('kind', kind)
  form.append('stage', stage)
  const response = await fetch(`${API_BASE}/assets/media`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `generator media upload failed ${response.status}`)
  }
  const data = await response.json().catch(() => ({}))
  const assetId = data.assetId || data.asset_id || data.id || ''
  const apiPath = data.apiPath || data.api_path || data.url || generatorAssetApiPath(assetId)
  return {
    ...data,
    assetId,
    asset_id: assetId,
    apiPath,
    api_path: apiPath,
    url: apiPath || data.url || '',
  }
}

async function loadGeneratorProjectSnapshot(projectId = '') {
  const safeProjectId = String(projectId || '').trim()
  if (!safeProjectId) return null
  const response = await fetch(`${API_BASE}/projects/${safeProjectId}/snapshots/generator`, {
    headers: authHeaders(),
  })
  if (!response.ok) return null
  const data = await response.json().catch(() => null)
  return data?.snapshot?.data || null
}

async function saveGeneratorProjectSnapshot(projectId = '', snapshot = {}, guardMode = 'safe_merge') {
  const safeProjectId = String(projectId || '').trim()
  if (!safeProjectId) return null
  const response = await fetch(`${API_BASE}/projects/${safeProjectId}/snapshots/generator`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      data: snapshot,
      guard_mode: guardMode,
      client_version: 'generator-project-snapshot-v1',
    }),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `generator snapshot save failed ${response.status}`)
  }
  return response.json().catch(() => null)
}


function avaGeneratorRouteProjectIdFallback() {
  if (typeof window === 'undefined') return ''
  try {
    const match = String(window.location?.pathname || '').match(/\/app\/projects\/([^/]+)\/generator(?:\/|$)?/i)
    return match?.[1] ? decodeURIComponent(match[1]) : ''
  } catch {
    return ''
  }
}

export default function StandaloneGeneratorPage() {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const routeProjectId = cleanGeneratorProjectId(projectId) || generatorProjectIdFromPath()
  const generatorPagePath = routeProjectId ? `/app/projects/${routeProjectId}/generator` : '/app/workspace/generator'
  useEffect(() => {
    console.log('[GENERATOR PROJECT CONTEXT]', { routeProjectId, pathname: typeof window !== 'undefined' ? window.location.pathname : '' })
  }, [routeProjectId])
  const [route, setRoute] = useState(() => readGeneratorSettingsDraft().route || readAnyGeneratorDraft().route || 'i2v')
  const [aspect, setAspect] = useState(() => readGeneratorSettingsDraft().aspect || readAnyGeneratorDraft().aspect || '16:9')
  const [durationSec, setDurationSec] = useState(() => Number(readGeneratorSettingsDraft().durationSec || readAnyGeneratorDraft().durationSec || 5))
  const [prompt, setPrompt] = useState(() => readGeneratorSettingsDraft().prompt || readAnyGeneratorDraft().prompt || 'Slow cinematic push-in, natural grounded motion, preserve identity and environment, realistic lighting.')
  const [negativePrompt, setNegativePrompt] = useState(() => readGeneratorSettingsDraft().negativePrompt || readAnyGeneratorDraft().negativePrompt || DEFAULT_NEGATIVE)
  const [imageQuality, setImageQuality] = useState(() => readGeneratorSettingsDraft().imageQuality || readAnyGeneratorDraft().imageQuality || TXT2IMG_DEFAULT_QUALITY)
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
  const [generatorCanceling, setGeneratorCanceling] = useState(false)
  const [rawResponse, setRawResponse] = useState(null)
  const [generatedVideos, setGeneratedVideos] = useState(() => dedupeGeneratorGalleryItems(routeProjectId ? [] : readGeneratorGalleryDraft()))
  const generatedVideosRef = useRef(dedupeGeneratorGalleryItems(routeProjectId ? [] : readGeneratorGalleryDraft()))
  useEffect(() => {
    generatedVideosRef.current = dedupeGeneratorGalleryItems(generatedVideos)
  }, [generatedVideos])
  const [generatorSnapshotLoading, setGeneratorSnapshotLoading] = useState(() => Boolean(routeProjectId))
  const generatorPreviewObjectUrlsRef = useRef({})
  const [generatorAssetPreviewMap, setGeneratorAssetPreviewMap] = useState({})
  const generatorHistoryThumbObjectUrlsRef = useRef({})
  const [generatorHistoryThumbPreviewMap, setGeneratorHistoryThumbPreviewMap] = useState({})

  const ensureGeneratorHistoryThumbPreview = useCallback((value = '') => {
    const canonical = generatorCanonicalApiPath(value) || String(value || '').trim()
    if (!canonical || !isGeneratorAssetFileRef(canonical)) return
    if (generatorHistoryThumbObjectUrlsRef.current[canonical]) return
    fetchGeneratorAssetThumbBlobUrl(canonical)
      .then((objectUrl) => {
        if (!objectUrl) return
        generatorHistoryThumbObjectUrlsRef.current[canonical] = objectUrl
        setGeneratorHistoryThumbPreviewMap((old) => ({ ...old, [canonical]: objectUrl }))
      })
      .catch((error) => {
        console.warn('[GENERATOR HISTORY THUMB FAILED V12B]', { ref: canonical, error: error?.message || error })
      })
  }, [])

  useEffect(() => () => {
    Object.values(generatorHistoryThumbObjectUrlsRef.current || {}).forEach((url) => {
      if (String(url || '').startsWith('blob:')) {
        try { URL.revokeObjectURL(url) } catch {}
      }
    })
    generatorHistoryThumbObjectUrlsRef.current = {}
  }, [])


  const ensureGeneratorAssetPreview = useCallback((value = '') => {
    const canonical = generatorCanonicalApiPath(value) || String(value || '').trim()
    if (!canonical || !isGeneratorAssetFileRef(canonical)) return
    if (generatorPreviewObjectUrlsRef.current[canonical]) return
    fetchGeneratorAssetBlobUrl(canonical)
      .then((objectUrl) => {
        if (!objectUrl) return
        generatorPreviewObjectUrlsRef.current[canonical] = objectUrl
        setGeneratorAssetPreviewMap((old) => ({ ...old, [canonical]: objectUrl }))
      })
      .catch((error) => {
        console.warn('[GENERATOR ASSET PREVIEW FAILED]', { ref: canonical, error: error?.message || error })
      })
  }, [])

  const generatorPreviewUrl = useCallback((value = '') => {
    const raw = String(value || '').trim()
    if (!raw) return ''
    if (!isGeneratorAssetFileRef(raw)) return normalizeUrl(raw)
    const canonical = generatorCanonicalApiPath(raw) || raw
    // AVA_GENERATOR_DIRECT_ASSET_PREVIEW_V4:
    // History cards may stream direct URLs so the page does not fetch every video as a blob.
    return generatorAssetPreviewMap[canonical] || normalizeUrl(raw)
  }, [generatorAssetPreviewMap])

  const generatorAssetBlobPreviewUrl = useCallback((value = '') => {
    const raw = String(value || '').trim()
    if (!raw || !isGeneratorAssetFileRef(raw)) return ''
    const canonical = generatorCanonicalApiPath(raw) || raw
    return generatorPreviewObjectUrlsRef.current[canonical] || generatorAssetPreviewMap[canonical] || ''
  }, [generatorAssetPreviewMap])

  useEffect(() => () => {
    Object.values(generatorPreviewObjectUrlsRef.current || {}).forEach((url) => {
      if (String(url || '').startsWith('blob:')) {
        try { URL.revokeObjectURL(url) } catch {}
      }
    })
    generatorPreviewObjectUrlsRef.current = {}
  }, [])

  const visibleHistoryItems = useMemo(() => (generatedVideos || []).map(normalizeGeneratorGalleryItem).filter(Boolean), [generatedVideos])
  const historyImageCount = useMemo(() => visibleHistoryItems.filter((item) => normalizeGeneratorGalleryItem(item)?.kind === 'image').length, [visibleHistoryItems])
  const historyVideoCount = useMemo(() => visibleHistoryItems.filter((item) => normalizeGeneratorGalleryItem(item)?.kind !== 'image').length, [visibleHistoryItems])
  const historyLimit = GENERATOR_GALLERY_LIMIT
  const historyOverflowCount = Math.max(0, visibleHistoryItems.length - historyLimit)
  const historyIsOverLimit = historyOverflowCount > 0

  const chargeAudit = useMemo(() => {
    const status = rawResponse?.status || job?.status || ''
    return {
      cost: rawResponse?.creditCost ?? null,
      charged: rawResponse?.creditCharged,
      mode: rawResponse?.creditChargeMode || '',
      balance: rawResponse?.creditBalance,
      status,
    }
  }, [rawResponse, job?.status])

  useEffect(() => {
    if (!Array.isArray(generatedVideos) || !generatedVideos.length) return
    const cleaned = dedupeGeneratorGalleryItems(generatedVideos)
    const before = JSON.stringify(generatedVideos)
    const after = JSON.stringify(cleaned)
    if (before === after) return
    generatedVideosRef.current = cleaned
    setGeneratedVideos(cleaned)
  }, [generatedVideos])

  const [selectedGalleryVideoUrl, setSelectedGalleryVideoUrl] = useState('')
  const [imageActionMenuId, setImageActionMenuId] = useState('')
  const [frameExtractBusy, setFrameExtractBusy] = useState(false)
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
  const [cancelGenerationBusy, setCancelGenerationBusy] = useState(false)
  const pollingRef = useRef(null)
  const submitGenerationInFlightRef = useRef(false)
  const mmaudioPollingRef = useRef(null)
  const audioRef = useRef(null)
  const rememberedGalleryUrlsRef = useRef(new Set())
  const restoredGalleryAutoAddSkipRef = useRef(new Set())
  const generatorSnapshotHydratedRef = useRef(false)
  const generatorSnapshotSaveTimerRef = useRef(null)
  const pendingGeneratorResumeJobRef = useRef(null)
  const activeGeneratorPollTokenRef = useRef('')
  const completedGeneratorJobsRef = useRef(new Set())
  const pendingMmaudioResumeJobRef = useRef(null)
  const activeMmaudioPollTokenRef = useRef('')
  const completedMmaudioJobsRef = useRef(new Set())
  const deletedGeneratorGalleryRefsRef = useRef(new Set())
  const deletedMmaudioJobIdsRef = useRef(new Set())
  const generatorPollingSnapshotThrottleRef = useRef({ video: 0, mmaudio: 0 })
  useEffect(() => {
    let cancelled = false

    async function loadGeneratorTariffsAndCredits() {
      try {
        const [tariffsResult, creditsResult] = await Promise.allSettled([
          fetchJson('/clip/ltx/tariffs'),
          fetchJson('/credits/summary'),
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

  useEffect(() => {
    let cancelled = false
    generatorSnapshotHydratedRef.current = false
    setGeneratorSnapshotLoading(Boolean(routeProjectId))

    async function restoreProjectGeneratorSnapshot() {
      if (!routeProjectId) {
        generatorSnapshotHydratedRef.current = true
        setGeneratorSnapshotLoading(false)
        return
      }
      try {
        const snapshot = await loadGeneratorProjectSnapshot(routeProjectId)
        if (cancelled || !snapshot || typeof snapshot !== 'object') {
          generatorSnapshotHydratedRef.current = true
          return
        }

        if (snapshot.route) setRoute(snapshot.route)
        if (snapshot.aspect) setAspect(snapshot.aspect)
        if (snapshot.prompt) setPrompt(snapshot.prompt)
        if (snapshot.negativePrompt) setNegativePrompt(snapshot.negativePrompt)
        if (snapshot.imageQuality) setImageQuality(snapshot.imageQuality)
        if (snapshot.durationSec) setDurationSec(Number(snapshot.durationSec) || 5)

        const media = snapshot.media || {}
        const startRef = media.startImageApiPath || media.startImageUrl || snapshot.startPersistedDataUrl || ''
        const endRef = media.endImageApiPath || media.endImageUrl || snapshot.endPersistedDataUrl || ''
        const audioRefValue = media.audioApiPath || media.audioUrl || snapshot.audioPersistedDataUrl || ''

        if (startRef) {
          setStartPersistedDataUrl(startRef)
          setStartPreview(normalizeUrl(startRef))
        }
        if (endRef) {
          setEndPersistedDataUrl(endRef)
          setEndPreview(normalizeUrl(endRef))
        }
        if (audioRefValue) {
          setAudioPersistedDataUrl(audioRefValue)
          setAudioPreviewUrl(normalizeUrl(audioRefValue))
        }
        if (media.audioName || snapshot.audioName) setAudioName(media.audioName || snapshot.audioName || '')
        if (media.audioDurationSec || snapshot.audioDurationSec) setAudioDurationSec(Number(media.audioDurationSec || snapshot.audioDurationSec) || 0)

        const deletedGalleryRefs = new Set((Array.isArray(snapshot.deletedGalleryRefs) ? snapshot.deletedGalleryRefs : []).map((item) => String(item || '').trim()).filter(Boolean))
        const deletedMmaudioJobIds = new Set((Array.isArray(snapshot.deletedMmaudioJobIds) ? snapshot.deletedMmaudioJobIds : []).map(generatorCleanJobId).filter(Boolean))
        deletedGeneratorGalleryRefsRef.current = deletedGalleryRefs
        deletedMmaudioJobIdsRef.current = deletedMmaudioJobIds
        generatorSnapshotCompletedMmaudioIds(snapshot).forEach((jobId) => completedMmaudioJobsRef.current.add(jobId))

        const gallery = (Array.isArray(snapshot.gallery) ? snapshot.gallery : [])
          .map(normalizeGeneratorGalleryItem)
          .filter(Boolean)
          .filter((item) => !deletedGalleryRefs.has(generatorGalleryTombstoneRef(item.apiPath, item.api_path, item.url)))
        setGeneratedVideos(gallery)

        const resultRef = snapshot.result?.apiPath || snapshot.result?.url || snapshot.resultUrl || ''
        const restoredSkipKeys = new Set()
        if (resultRef && !deletedGalleryRefs.has(generatorGalleryTombstoneRef(resultRef))) {
          const restoredResultUrl = generatorCanonicalApiPath(resultRef) || normalizeUrl(resultRef)
          restoredSkipKeys.add(`${route === 'txt2img' ? 'image' : 'video'}:${normalizeUrl(restoredResultUrl)}`)
          setResultUrl(restoredResultUrl)
        } else {
          setResultUrl('')
        }
        const restoredJob = compactGeneratorJob(snapshot.job)
        if (generatorJobLooksActive(restoredJob)) {
          setJob(restoredJob)
          setBusy(true)
          setStatusText(generatorJobStatusValue(restoredJob) || snapshot.statusText || 'running')
          pendingGeneratorResumeJobRef.current = restoredJob
          window.setTimeout(() => {
            if (cancelled) return
            const resumeJob = pendingGeneratorResumeJobRef.current
            if (!generatorJobLooksActive(resumeJob)) return
            const resumeJobId = String(resumeJob.jobId || resumeJob.job_id || '').replace(/^generator:/, '').trim()
            const resumeStatusBase = generatorStatusBaseFromJob(resumeJob, routeInfo?.statusBase)
            if (!resumeJobId || !resumeStatusBase) return
            console.log('[GENERATOR ACTIVE JOB RESUME]', { projectId: routeProjectId, jobId: resumeJobId, statusBase: resumeStatusBase })
            pendingGeneratorResumeJobRef.current = null
            pollStatus(resumeJobId, resumeStatusBase)
          }, 350)
        } else {
          setJob(null)
          if (snapshot.statusText) setStatusText(snapshot.statusText)
        }

        if (snapshot.mmaudioPrompt) setMmaudioPrompt(snapshot.mmaudioPrompt)
        if (snapshot.mmaudioNegativePrompt) setMmaudioNegativePrompt(snapshot.mmaudioNegativePrompt)
        if (snapshot.mmaudioResultUrl && !deletedGalleryRefs.has(generatorGalleryTombstoneRef(snapshot.mmaudioResultUrl))) {
          const restoredMmaudioUrl = generatorCanonicalApiPath(snapshot.mmaudioResultUrl) || normalizeUrl(snapshot.mmaudioResultUrl)
          restoredSkipKeys.add(`mmaudio:${normalizeUrl(restoredMmaudioUrl)}`)
          setMmaudioResultUrl(restoredMmaudioUrl)
        } else {
          setMmaudioResultUrl('')
        }
        restoredGalleryAutoAddSkipRef.current = restoredSkipKeys

        const restoredMmaudioJob = compactGeneratorJob(snapshot.mmaudioJob)
        const restoredMmaudioJobId = generatorMmaudioJobId(restoredMmaudioJob)
        if (restoredMmaudioJobId && generatorSnapshotHasCompletedMmaudioJob(snapshot, restoredMmaudioJobId)) {
          completedMmaudioJobsRef.current.add(restoredMmaudioJobId)
          setMmaudioJob(null)
          setMmaudioBusy(false)
          setMmaudioStatus(snapshot.mmaudioStatus || 'completed')
        } else if (generatorJobLooksActive(restoredMmaudioJob)) {
          setMmaudioJob(restoredMmaudioJob)
          setMmaudioBusy(true)
          setMmaudioStatus(generatorJobStatusValue(restoredMmaudioJob) || snapshot.mmaudioStatus || 'running')
          pendingMmaudioResumeJobRef.current = restoredMmaudioJob
          window.setTimeout(() => {
            if (cancelled) return
            const resumeJob = pendingMmaudioResumeJobRef.current
            if (!generatorJobLooksActive(resumeJob)) return
            const resumeJobId = String(resumeJob.jobId || resumeJob.job_id || '').replace(/^generator-mmaudio:/, '').replace(/^mmaudio:/, '').trim()
            if (!resumeJobId) return
            console.log('[GENERATOR MMAUDIO ACTIVE JOB RESUME]', { projectId: routeProjectId, jobId: resumeJobId })
            pendingMmaudioResumeJobRef.current = null
            pollMmaudioStatus(resumeJobId, resumeJob)
          }, 450)
        } else {
          setMmaudioJob(null)
          if (snapshot.mmaudioStatus) setMmaudioStatus(snapshot.mmaudioStatus)
        }

        console.log('[GENERATOR PROJECT SNAPSHOT RESTORED]', { projectId: routeProjectId, gallery: gallery.length, resultRef })
      } catch (error) {
        console.warn('[GENERATOR PROJECT SNAPSHOT RESTORE FAILED]', error)
      } finally {
        if (!cancelled) {
          generatorSnapshotHydratedRef.current = true
          setGeneratorSnapshotLoading(false)
        }
      }
    }

    restoreProjectGeneratorSnapshot()
    return () => {
      cancelled = true
    }
  }, [routeProjectId])

  const routeInfo = useMemo(() => ROUTES.find((item) => item.value === route) || ROUTES[0], [route])

  // V167A: lip-sync and instrumental lip-sync duration follows uploaded audio,
  // so the manual duration slider is hidden and the state stays synced.
  useEffect(() => {
    if (!routeInfo?.needsAudio) return
    const maxDurationV167A = Number(routeInfo?.maxDuration || 10) || 10
    const audioSecV167A = Number(audioDurationSec || 0)
    if (!Number.isFinite(audioSecV167A) || audioSecV167A <= 0) return
    const nextDurationV167A = Math.max(1, Math.min(maxDurationV167A, Math.round(audioSecV167A * 10) / 10))
    if (Math.abs(Number(durationSec || 0) - nextDurationV167A) > 0.05) {
      setDurationSec(nextDurationV167A)
    }
  }, [routeInfo?.needsAudio, routeInfo?.maxDuration, audioDurationSec, durationSec])

  // V167A: <audio> cannot send Authorization headers. For protected /api/assets audio,
  // fetch the file as a blob with authHeaders() and play the blob URL.
  useEffect(() => {
    if (!routeInfo?.needsAudio) return
    const ref = audioPersistedDataUrl || audioPreviewUrl
    if (!ref || !isGeneratorAssetFileRef(ref)) return
    if (String(audioPreviewUrl || '').startsWith('blob:')) return

    let cancelledV167A = false
    fetchGeneratorAssetBlobUrl(ref)
      .then((blobUrlV167A) => {
        if (cancelledV167A || !blobUrlV167A) return
        setAudioPreviewUrl((current) => {
          if (String(current || '').startsWith('blob:')) return current
          return blobUrlV167A
        })
      })
      .catch((errorV167A) => {
        console.warn('[GENERATOR AUDIO PREVIEW RESTORE FAILED V167A]', errorV167A)
      })

    return () => {
      cancelledV167A = true
    }
  }, [routeInfo?.needsAudio, audioPersistedDataUrl])
  const generatedVideoItems = useMemo(() => (
    (Array.isArray(generatedVideos) ? generatedVideos : [])
      .filter((item) => item?.url && item.kind !== 'image')
      .slice(0, GENERATOR_GALLERY_LIMIT)
  ), [generatedVideos])
  const currentCreditCost = useMemo(() => {
    const baseCost = extractRouteCreditCostFromTariffs(ltxTariffs, routeInfo.value)
    if (routeInfo.kind === 'image') {
      return imageQuality === 'ultra' ? Math.max(baseCost, 2) : Math.max(1, Math.min(baseCost, 1))
    }
    return baseCost
  }, [ltxTariffs, routeInfo.value, routeInfo.kind, imageQuality])
  const mmaudioCreditCost = useMemo(() => extractRouteCreditCostFromTariffs(ltxTariffs, 'mmaudio'), [ltxTariffs])
  const creditBalance = useMemo(() => extractCreditBalance(creditSummary), [creditSummary])
  const updateCreditSummaryFromJobResponse = useCallback((data) => {
    if (!data || typeof data !== 'object') return false

    const directBalance = extractCreditBalance(data)
    const chargeBalance = extractCreditBalance(data.creditChargeResult)
    const userBalance = extractCreditBalance(data.user)
    const nextBalance = directBalance ?? chargeBalance ?? userBalance

    if (nextBalance == null) return false

    setCreditSummary((old) => ({
      ...(old && typeof old === 'object' ? old : {}),
      ...(data && typeof data === 'object' ? data : {}),
      balance: nextBalance,
      creditBalance: nextBalance,
      credits_balance: nextBalance,
      updatedAt: new Date().toISOString(),
    }))
    notifyGeneratorCreditBalance({ ...data, balance: nextBalance, creditBalance: nextBalance, credits_balance: nextBalance }, 'job_response')
    return true
  }, [])

  const refreshCreditSummaryNow = useCallback(async (reason = '') => {
    try {
      const latest = await fetchJson('/credits/summary')
      setCreditSummary(latest)
      notifyGeneratorCreditBalance(latest, 'credits_summary')
      return latest
    } catch (error) {
      console.warn('[GENERATOR CREDIT REFRESH FAILED]', reason, error)
      return null
    }
  }, [])

  const aspectInfo = useMemo(() => ASPECTS.find((item) => item.value === aspect) || ASPECTS[1], [aspect])
  const renderSize = useMemo(() => generatorRenderSize(routeInfo, aspectInfo), [routeInfo, aspectInfo])
  const selectedImageQuality = useMemo(
    () => TXT2IMG_QUALITY_OPTIONS.find((item) => item.value === imageQuality) || TXT2IMG_QUALITY_OPTIONS[TXT2IMG_QUALITY_OPTIONS.length - 1],
    [imageQuality]
  )
  const imageQualityPayloadValue = selectedImageQuality?.payloadValue || selectedImageQuality?.value || TXT2IMG_DEFAULT_QUALITY
  const hasEndThumb = !!(endPreview || routeInfo.needsEnd)
  const latestGalleryItem = useMemo(() => (visibleHistoryItems.length ? visibleHistoryItems[visibleHistoryItems.length - 1] : null), [visibleHistoryItems])
  const displayedResultUrl = selectedGalleryVideoUrl || latestGalleryItem?.url || mmaudioResultUrl || resultUrl
  // AVA_GENERATOR_LATEST_RESULT_PREVIEW_V6:
  // The main player should always show the latest completed item from the feed
  // unless the user explicitly clicked another history card. This keeps MMAudio
  // completion visible after restore/toast instead of falling back to the silent video.
  const displayedGalleryItem = useMemo(() => {
    const displayed = normalizeUrl(displayedResultUrl || '')
    return (Array.isArray(generatedVideos) ? generatedVideos : []).find((item) => {
      const url = normalizeUrl(item?.url || '')
      return url && displayed && url === displayed
    }) || latestGalleryItem || null
  }, [generatedVideos, displayedResultUrl, latestGalleryItem])
  const displayedResultIsImage = !!displayedResultUrl && (
    displayedGalleryItem?.kind === 'image'
    || (routeInfo.kind === 'image' && !mmaudioResultUrl)
    || /\.(png|jpe?g|webp)(\?|$)/i.test(String(displayedResultUrl || ''))
  )
  const previousVideoForFrame = normalizeUrl(generatedVideoItems[0]?.url || (!displayedResultIsImage && !isBlockedGeneratorPreviewUrl(selectedGalleryVideoUrl || resultUrl || mmaudioResultUrl || displayedResultUrl) ? (selectedGalleryVideoUrl || resultUrl || mmaudioResultUrl || displayedResultUrl) : '') || '')
  const startPreviewRef = startPreview || startPersistedDataUrl
  const endPreviewRef = endPreview || endPersistedDataUrl
  const startPreviewNeedsAuth = !!startPreviewRef && isGeneratorAssetFileRef(startPreviewRef)
  const endPreviewNeedsAuth = !!endPreviewRef && isGeneratorAssetFileRef(endPreviewRef)
  const startPreviewBlobUrl = startPreviewNeedsAuth ? generatorAssetBlobPreviewUrl(startPreviewRef) : ''
  const endPreviewBlobUrl = endPreviewNeedsAuth ? generatorAssetBlobPreviewUrl(endPreviewRef) : ''
  const startPreviewDisplayUrl = startPreviewNeedsAuth ? startPreviewBlobUrl : generatorPreviewUrl(startPreviewRef)
  const endPreviewDisplayUrl = endPreviewNeedsAuth ? endPreviewBlobUrl : generatorPreviewUrl(endPreviewRef)
  const startPreviewIsLoading = !!startPreviewRef && startPreviewNeedsAuth && !startPreviewDisplayUrl
  const endPreviewIsLoading = !!endPreviewRef && endPreviewNeedsAuth && !endPreviewDisplayUrl
  const startThumbUrl = startPreviewDisplayUrl || (!startPreviewNeedsAuth ? startPreview : '')
  const endThumbUrl = endPreviewDisplayUrl || (!endPreviewNeedsAuth ? endPreview : '')
  // AVA_GENERATOR_INPUT_THUMB_AUTH_LOADING_V6:
  // Restored Start/End frames may be protected assets. Show a spinner while the
  // authenticated blob preview is being prepared instead of a broken image.
  const displayedResultIsProtectedAsset = !!displayedResultUrl && isGeneratorAssetFileRef(displayedResultUrl)
  const displayedResultBlobPreviewUrl = displayedResultIsProtectedAsset ? generatorAssetBlobPreviewUrl(displayedResultUrl) : ''
  // AVA_GENERATOR_MAIN_VIDEO_AUTH_BLOB_V5:
  // Main result preview must use an authenticated blob for /api/assets/.../file.
  // A plain <video src="/api/assets/..."> cannot carry Authorization headers and can show a black 0:00 player.
  // We still avoid prefetching every history card; only the selected/main result is hydrated as blob.
  const displayedResultPreviewUrl = displayedResultIsProtectedAsset ? displayedResultBlobPreviewUrl : generatorPreviewUrl(displayedResultUrl)

  useEffect(() => {
    if (!displayedResultUrl || !displayedResultIsProtectedAsset) return
    ensureGeneratorAssetPreview(displayedResultUrl)
  }, [displayedResultUrl, displayedResultIsProtectedAsset, ensureGeneratorAssetPreview])

  // AVA_GENERATOR_RESTORE_SMALL_INPUT_SPINNER_V3B:
  // Assembly timeline patch v3 touched this file and accidentally brought back the
  // large history loader text inside Start/End input thumbnails. Keep only the compact spinner.

  const generatorHistoryPreviewNode = useCallback((item = {}) => {
    const kind = String(item?.kind || '').toLowerCase() === 'image' ? 'image' : 'video'
    const sourceRef = item?.apiPath || item?.api_path || item?.url || item?.videoUrl || item?.imageUrl || ''
    const canonical = generatorCanonicalApiPath(sourceRef) || String(sourceRef || '').trim()
    const previewUrl = kind === 'image'
      ? generatorPreviewUrl(sourceRef)
      : (generatorHistoryThumbPreviewMap[canonical] || '')
    if (!previewUrl) {
      return (
        <span
          className="avaGeneratorHistoryLoading"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            width: '100%',
            minHeight: 72,
            padding: 8,
            fontSize: 12,
            lineHeight: 1.25,
            color: 'rgba(255,255,255,0.72)',
            textAlign: 'center',
          }}
        >
          <i className="avaGeneratorMmaudioHeaderSpinner" aria-hidden="true" />
          <span>{kind === 'image' ? 'Загрузка фото…' : 'Кадр видео…'}</span>
        </span>
      )
    }
    return <img src={previewUrl} alt={item?.label || item?.title || 'result'} />
  }, [generatorPreviewUrl, generatorHistoryThumbPreviewMap])

  useEffect(() => {
    // AVA_GENERATOR_HISTORY_THUMBNAILS_V12B: warm only tiny history thumbnails.
    visibleHistoryItems.forEach((item) => {
      const kind = String(item?.kind || '').toLowerCase() === 'image' ? 'image' : 'video'
      if (kind === 'image') return
      const sourceRef = item?.apiPath || item?.api_path || item?.url || item?.videoUrl || ''
      if (sourceRef && isGeneratorAssetFileRef(sourceRef)) ensureGeneratorHistoryThumbPreview(sourceRef)
    })
  }, [visibleHistoryItems, ensureGeneratorHistoryThumbPreview])

  useEffect(() => {
    // AVA_GENERATOR_HISTORY_AUTH_THUMBS_V6B:
    // Do not download every protected video as a blob during page restore. That made
    // Generator look empty/slow on F5. Warm the latest/current result first; the feed
    // can lazily prepare previews as the user clicks or the browser streams direct URLs.
    const warmRefs = [displayedResultUrl, latestGalleryItem?.url, latestGalleryItem?.apiPath, latestGalleryItem?.api_path]
      .filter(Boolean)
      .slice(0, 3)
    warmRefs.forEach((ref) => {
      if (isGeneratorAssetFileRef(ref)) ensureGeneratorAssetPreview(ref)
    })
  }, [displayedResultUrl, latestGalleryItem, ensureGeneratorAssetPreview])

  useEffect(() => {
    // AVA_GENERATOR_DIRECT_ASSET_PREVIEW_V4:
    // Only warm up small start/end images. Do not prefetch result/history videos as
    // blobs; video tags can stream direct asset URLs and load much faster.
    [startPersistedDataUrl, startPreview, endPersistedDataUrl, endPreview]
      .filter(Boolean)
      .forEach((ref) => {
        if (isGeneratorAssetFileRef(ref)) ensureGeneratorAssetPreview(ref)
      })
  }, [startPersistedDataUrl, startPreview, endPersistedDataUrl, endPreview, ensureGeneratorAssetPreview])

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

    setGeneratedVideos((old) => mergeGeneratorGalleryItem(old, cleanUrl, meta))
  }, [])

  const saveGeneratorSnapshot = useCallback((reason = 'autosave', overrides = {}) => {
    if (!routeProjectId) return
    const cleanReason = String(reason || '')
    if (!generatorSnapshotHydratedRef.current && reason === 'autosave') return
    if (reason === 'autosave' && busy) return
    // AVA_GENERATOR_POLLING_SNAPSHOT_THROTTLE_V4:
    // Job state is already persisted on start and completion. Polling writes every
    // 2.2s made Generator restores and MMAudio feel much slower, so only keep a
    // sparse heartbeat in the project snapshot.
    if (cleanReason === 'job_polling' || cleanReason === 'mmaudio_job_polling') {
      const bucket = cleanReason === 'mmaudio_job_polling' ? 'mmaudio' : 'video'
      const now = Date.now()
      const lastAt = Number(generatorPollingSnapshotThrottleRef.current?.[bucket] || 0)
      if (now - lastAt < 20000) return
      generatorPollingSnapshotThrottleRef.current = {
        ...(generatorPollingSnapshotThrottleRef.current || {}),
        [bucket]: now,
      }
    }
    if (generatorSnapshotSaveTimerRef.current) clearTimeout(generatorSnapshotSaveTimerRef.current)

    const run = async () => {
      const hasOverride = (key) => Object.prototype.hasOwnProperty.call(overrides, key)
      const snapshotResultUrl = hasOverride('resultUrl') ? overrides.resultUrl : resultUrl
      const snapshotResultData = hasOverride('resultData') ? overrides.resultData : rawResponse
      const snapshotJob = hasOverride('job') ? overrides.job : job
      const resultRefs = generatorResultRefs(snapshotResultData || snapshotJob || {}, snapshotResultUrl || '')
      const media = hasOverride('media') ? (overrides.media || {}) : {
        startImageUrl: normalizeUrl(startPersistedDataUrl || startPreview || ''),
        startImageApiPath: generatorCanonicalApiPath(startPersistedDataUrl, startPreview),
        startImageAssetId: generatorAssetIdFromRef(startPersistedDataUrl, startPreview),
        endImageUrl: normalizeUrl(endPersistedDataUrl || endPreview || ''),
        endImageApiPath: generatorCanonicalApiPath(endPersistedDataUrl, endPreview),
        endImageAssetId: generatorAssetIdFromRef(endPersistedDataUrl, endPreview),
        audioUrl: normalizeUrl(audioPersistedDataUrl || audioPreviewUrl || ''),
        audioApiPath: generatorCanonicalApiPath(audioPersistedDataUrl, audioPreviewUrl),
        audioAssetId: generatorAssetIdFromRef(audioPersistedDataUrl, audioPreviewUrl),
        audioName,
        audioDurationSec,
      }
      const completedResultUrl = resultRefs.url || normalizeUrl(snapshotResultUrl || '')
      const baseGallery = dedupeGeneratorGalleryItems(Array.isArray(overrides.gallery) ? overrides.gallery : generatedVideosRef.current)
      const gallery = (reason === 'generator_completed' && completedResultUrl)
        ? upsertGeneratorGalleryResult(baseGallery, completedResultUrl, {
            kind: routeInfo.kind === 'image' ? 'image' : 'video',
            label: routeInfo?.label || (routeInfo.kind === 'image' ? 'Фото' : 'Фото → видео'),
            route,
            durationSec: routeInfo.kind === 'image' ? 0 : targetDurationSec,
            apiPath: resultRefs.apiPath,
            assetId: resultRefs.assetId,
          })
        : dedupeGeneratorGalleryItems(baseGallery)

      const snapshot = {
        stage: 'generator',
        source: 'standalone_generator',
        schema: 'ava_generator_snapshot_v1',
        projectId: routeProjectId,
        updatedAt: new Date().toISOString(),
        reason,
        route,
        aspect,
        prompt,
        negativePrompt,
        imageQuality,
        durationSec,
        targetDurationSec,
        generationDurationSec,
        media,
        gallery,
        result: {
          url: completedResultUrl,
          apiPath: resultRefs.apiPath || generatorCanonicalApiPath(completedResultUrl),
          assetId: resultRefs.assetId || generatorAssetIdFromRef(completedResultUrl),
          kind: routeInfo.kind === 'image' ? 'image' : 'video',
        },
        resultUrl: completedResultUrl,
        job: compactGeneratorJob(snapshotJob),
        statusText: overrides.statusText || statusText,
        rawResponse: null,
        mmaudioPrompt,
        mmaudioNegativePrompt,
        mmaudioResultUrl: overrides.mmaudioResultUrl !== undefined ? overrides.mmaudioResultUrl : mmaudioResultUrl,
        mmaudioJob: compactGeneratorJob(overrides.mmaudioJob !== undefined ? overrides.mmaudioJob : mmaudioJob),
        mmaudioStatus: overrides.mmaudioStatus || mmaudioStatus,
        lastCompletedMmaudioJobId: overrides.lastCompletedMmaudioJobId !== undefined
          ? String(overrides.lastCompletedMmaudioJobId || '')
          : ([...completedMmaudioJobsRef.current].slice(-1)[0] || ''),
        completedMmaudioJobIds: Array.isArray(overrides.completedMmaudioJobIds)
          ? overrides.completedMmaudioJobIds.map(generatorCleanJobId).filter(Boolean).slice(-30)
          : [...completedMmaudioJobsRef.current].map(generatorCleanJobId).filter(Boolean).slice(-30),
        deletedGalleryRefs: Array.isArray(overrides.deletedGalleryRefs)
          ? overrides.deletedGalleryRefs.map((item) => String(item || '').trim()).filter(Boolean).slice(-120)
          : [...deletedGeneratorGalleryRefsRef.current].map((item) => String(item || '').trim()).filter(Boolean).slice(-120),
        deletedMmaudioJobIds: Array.isArray(overrides.deletedMmaudioJobIds)
          ? overrides.deletedMmaudioJobIds.map(generatorCleanJobId).filter(Boolean).slice(-120)
          : [...deletedMmaudioJobIdsRef.current].map(generatorCleanJobId).filter(Boolean).slice(-120),
      }

      try {
        const snapshotGuardMode = ['gallery_remove', 'gallery_clear', 'clear_draft', 'generator_completed', 'generator_completed_direct', 'mmaudio_completed'].some((item) => String(reason || '').startsWith(item)) ? 'replace' : 'safe_merge'
        await saveGeneratorProjectSnapshot(routeProjectId, snapshot, snapshotGuardMode)
        console.log('[GENERATOR PROJECT SNAPSHOT SAVED]', { projectId: routeProjectId, reason, gallery: gallery.length, result: snapshot.result })
      } catch (error) {
        console.warn('[GENERATOR PROJECT SNAPSHOT SAVE FAILED]', { reason, error: error?.message || error })
      }
    }

    // AVA_GENERATOR_EXIT_SAFE_SNAPSHOT_V3:
    // Critical job/media/result updates must be written immediately, not through a
    // zero-delay timer that can be cancelled when the user leaves the Generator.
    const immediateReasons = ['generator_completed', 'generator_completed_direct', 'media_upload', 'gallery_remove', 'gallery_clear', 'clear_draft', 'job_started', 'mmaudio_job_started', 'mmaudio_completed', 'mmaudio_failed']
    if (immediateReasons.some((item) => String(reason || '').startsWith(item))) {
      run()
      return
    }

    const delay = 700
    generatorSnapshotSaveTimerRef.current = setTimeout(run, delay)
  }, [
    routeProjectId, rawResponse, job, resultUrl, startPersistedDataUrl, startPreview, endPersistedDataUrl, endPreview,
    audioPersistedDataUrl, audioPreviewUrl, audioName, audioDurationSec, route, aspect, prompt, negativePrompt,
    imageQuality, durationSec, targetDurationSec, generationDurationSec, routeInfo.kind, statusText, mmaudioPrompt, mmaudioNegativePrompt,
    mmaudioResultUrl, mmaudioJob, mmaudioStatus,
  ])


  const saveCompletedGeneratorResultNow = useCallback(async (completedUrl = '', completedData = {}, completedJobId = '', completedGalleryOverride = null) => {
    const cleanCompletedUrl = normalizeUrl(completedUrl)
    if (!routeProjectId || !cleanCompletedUrl) return

    const refs = generatorResultRefs(completedData || {}, cleanCompletedUrl)
    const canonicalUrl = refs.apiPath || cleanCompletedUrl
    const canonicalKey = generatorCanonicalApiPath(canonicalUrl) || canonicalUrl
    const resultKind = routeInfo?.kind === 'image' ? 'image' : 'video'

    const completedItem = createGeneratorGalleryItem(normalizeUrl(canonicalUrl), {
      kind: resultKind,
      label: routeInfo?.label || (resultKind === 'image' ? 'Фото' : 'Видео'),
      route,
      durationSec: resultKind === 'image' ? 0 : targetDurationSec,
      apiPath: refs.apiPath || generatorCanonicalApiPath(canonicalUrl),
      assetId: refs.assetId || generatorAssetIdFromRef(canonicalUrl),
    })

    const existingGallery = dedupeGeneratorGalleryItems(Array.isArray(completedGalleryOverride) ? completedGalleryOverride : generatedVideosRef.current)
    const nextGallery = dedupeGeneratorGalleryItems([
      ...existingGallery.filter((item) => {
        const itemKey = generatorGalleryTombstoneRef(item?.apiPath, item?.api_path, item?.assetId, item?.asset_id, item?.url) || generatorCanonicalApiPath(item?.apiPath, item?.api_path, item?.url) || normalizeUrl(item?.url || '')
        return itemKey !== (generatorGalleryTombstoneRef(completedItem.apiPath, completedItem.api_path, completedItem.assetId, completedItem.asset_id, completedItem.url) || canonicalKey)
      }),
      completedItem,
    ])

    generatedVideosRef.current = nextGallery
    setGeneratedVideos(nextGallery)

    const media = {
      startImageUrl: normalizeUrl(startPersistedDataUrl || startPreview || ''),
      startImageApiPath: generatorCanonicalApiPath(startPersistedDataUrl, startPreview),
      startImageAssetId: generatorAssetIdFromRef(startPersistedDataUrl, startPreview),
      endImageUrl: normalizeUrl(endPersistedDataUrl || endPreview || ''),
      endImageApiPath: generatorCanonicalApiPath(endPersistedDataUrl, endPreview),
      endImageAssetId: generatorAssetIdFromRef(endPersistedDataUrl, endPreview),
      audioUrl: normalizeUrl(audioPersistedDataUrl || audioPreviewUrl || ''),
      audioApiPath: generatorCanonicalApiPath(audioPersistedDataUrl, audioPreviewUrl),
      audioAssetId: generatorAssetIdFromRef(audioPersistedDataUrl, audioPreviewUrl),
      audioName,
      audioDurationSec,
    }

    const snapshot = {
      stage: 'generator',
      source: 'standalone_generator',
      schema: 'ava_generator_snapshot_v1',
      projectId: routeProjectId,
      updatedAt: new Date().toISOString(),
      reason: 'generator_completed_direct_v10',
      route,
      aspect,
      prompt,
      negativePrompt,
      imageQuality,
      durationSec,
      targetDurationSec,
      generationDurationSec,
      media,
      gallery: nextGallery,
      result: {
        url: refs.url || normalizeUrl(canonicalUrl),
        apiPath: refs.apiPath || generatorCanonicalApiPath(canonicalUrl),
        assetId: refs.assetId || generatorAssetIdFromRef(canonicalUrl),
        kind: resultKind,
      },
      resultUrl: refs.url || normalizeUrl(canonicalUrl),
      job: null,
      statusText: 'completed',
      rawResponse: null,
      mmaudioPrompt,
      mmaudioNegativePrompt,
      mmaudioResultUrl,
      mmaudioJob: compactGeneratorJob(mmaudioJob),
      mmaudioStatus,
      lastCompletedJobId: String(completedJobId || completedData?.jobId || completedData?.job_id || ''),
      lastCompletedMmaudioJobId: [...completedMmaudioJobsRef.current].slice(-1)[0] || '',
      completedMmaudioJobIds: [...completedMmaudioJobsRef.current].map(generatorCleanJobId).filter(Boolean).slice(-30),
      deletedGalleryRefs: [...deletedGeneratorGalleryRefsRef.current].map((item) => String(item || '').trim()).filter(Boolean).slice(-120),
      deletedMmaudioJobIds: [...deletedMmaudioJobIdsRef.current].map(generatorCleanJobId).filter(Boolean).slice(-120),
    }

    try {
      await saveGeneratorProjectSnapshot(routeProjectId, snapshot, 'replace')
      console.log('[GENERATOR COMPLETED SNAPSHOT SAVED DIRECT]', {
        projectId: routeProjectId,
        resultRef: snapshot.result?.apiPath || snapshot.resultUrl,
        gallery: nextGallery.length,
        jobId: completedJobId,
      })
    } catch (error) {
      console.warn('[GENERATOR COMPLETED SNAPSHOT SAVE FAILED DIRECT]', error?.message || error)
    }
  }, [
    routeProjectId, startPersistedDataUrl, startPreview, endPersistedDataUrl, endPreview,
    audioPersistedDataUrl, audioPreviewUrl, audioName, audioDurationSec, routeInfo?.kind, routeInfo?.label,
    route, aspect, prompt, negativePrompt, imageQuality, durationSec, targetDurationSec, generationDurationSec,
    mmaudioPrompt, mmaudioNegativePrompt, mmaudioResultUrl, mmaudioJob, mmaudioStatus,
  ])

  useEffect(() => {
    if (routeProjectId) return
    writeGeneratorGalleryDraft(generatedVideos)
  }, [generatedVideos, routeProjectId])

  useEffect(() => {
    saveGeneratorSnapshot('autosave')
    return () => {
      if (generatorSnapshotSaveTimerRef.current) clearTimeout(generatorSnapshotSaveTimerRef.current)
    }
  }, [saveGeneratorSnapshot])

  // AVA_GENERATOR_GALLERY_SOT_V1:
  // resultUrl/mmaudioResultUrl are preview pointers only. They must not auto-create
  // feed cards after delete/F5; completed handlers are the only allowed gallery writers.

  const openGeneratedVideo = useCallback((item) => {
    if (!item?.url) return
    setImageActionMenuId('')
    setSelectedGalleryVideoUrl(item.url)
    setStatusText('просмотр из ленты')
  }, [])

  const removeGeneratedVideo = useCallback((event, item) => {
    event?.stopPropagation?.()
    const removedKey = generatorComparableRef(item?.apiPath || item?.api_path || item?.url)
    const removedTombstoneRef = generatorGalleryTombstoneRef(item?.apiPath, item?.api_path, item?.assetId, item?.asset_id, item?.url)
    if (!item?.id && !removedKey && !removedTombstoneRef) return

    const resultKey = generatorComparableRef(resultUrl)
    const mmaudioKey = generatorComparableRef(mmaudioResultUrl)
    const selectedKey = generatorComparableRef(selectedGalleryVideoUrl)
    const shouldClearResult = !!removedKey && removedKey === resultKey
    const shouldClearMmaudio = !!removedKey && removedKey === mmaudioKey
    const shouldClearSelected = (!!removedKey && removedKey === selectedKey) || selectedGalleryVideoUrl === item?.url
    const removedJobId = generatorCleanJobId(item?.jobId || item?.job_id || (shouldClearMmaudio ? mmaudioJob?.jobId || mmaudioJob?.job_id : ''))

    if (removedTombstoneRef) deletedGeneratorGalleryRefsRef.current.add(removedTombstoneRef)
    deleteGeneratorAssetByRef(item?.assetId, item?.asset_id, item?.apiPath, item?.api_path, item?.url).catch(() => {})
    if (shouldClearMmaudio && removedJobId) deletedMmaudioJobIdsRef.current.add(removedJobId)
    if (shouldClearMmaudio && removedJobId) completedMmaudioJobsRef.current.delete(removedJobId)

    const deletedGalleryRefs = [...deletedGeneratorGalleryRefsRef.current].slice(-120)
    const deletedMmaudioJobIds = [...deletedMmaudioJobIdsRef.current].slice(-120)
    const completedMmaudioJobIds = [...completedMmaudioJobsRef.current].slice(-30)

    setGeneratedVideos((old) => {
      const nextGallery = (Array.isArray(old) ? old : []).filter((video) => {
        const sameId = item?.id && video?.id === item.id
        const sameRef = removedKey && generatorComparableRef(video?.apiPath || video?.api_path || video?.url) === removedKey
        const sameTombstone = removedTombstoneRef && generatorGalleryTombstoneRef(video?.apiPath, video?.api_path, video?.assetId, video?.asset_id, video?.url) === removedTombstoneRef
        return !(sameId || sameRef || sameTombstone)
      })
      generatedVideosRef.current = nextGallery
      saveGeneratorSnapshot('gallery_remove', {
        gallery: nextGallery,
        resultUrl: shouldClearResult ? '' : resultUrl,
        resultData: shouldClearResult ? null : rawResponse,
        job: shouldClearResult ? null : job,
        statusText: shouldClearResult ? 'удалено из ленты' : statusText,
        mmaudioResultUrl: shouldClearMmaudio ? '' : mmaudioResultUrl,
        mmaudioJob: shouldClearMmaudio ? null : mmaudioJob,
        mmaudioStatus: shouldClearMmaudio ? '' : mmaudioStatus,
        lastCompletedMmaudioJobId: shouldClearMmaudio ? '' : undefined,
        completedMmaudioJobIds,
        deletedGalleryRefs,
        deletedMmaudioJobIds,
      })
      return nextGallery
    })

    const refsForActiveJobs = [
      removedKey,
      item?.url, item?.apiPath, item?.api_path, item?.videoUrl, item?.video_url,
      resultUrl, mmaudioResultUrl,
    ].map((value) => String(value || '').trim()).filter(Boolean)
    removeAvaGeneratorActiveJobsMatching({ refs: refsForActiveJobs, jobIds: removedJobId ? [removedJobId] : [], projectId: routeProjectId })

    if (shouldClearResult) setResultUrl('')
    if (shouldClearMmaudio) {
      setMmaudioResultUrl('')
      setMmaudioJob(null)
      setMmaudioStatus('')
    }
    if (shouldClearSelected) setSelectedGalleryVideoUrl('')
    setImageActionMenuId('')
    setStatusText('удалено из ленты')
  }, [job, mmaudioJob, mmaudioResultUrl, mmaudioStatus, rawResponse, resultUrl, routeProjectId, saveGeneratorSnapshot, selectedGalleryVideoUrl, statusText])

  const useImageResultAsFrame = useCallback(async (event, item, target = 'start') => {
    event?.stopPropagation?.()
    event?.preventDefault?.()

    const cleanUrl = normalizeUrl(item?.url || '')
    if (!cleanUrl) {
      setError('Не нашёл URL картинки в ленте.')
      return
    }

    setError('')
    setImageActionMenuId('')
    setSelectedGalleryVideoUrl('')
    setResultUrl('')
    setStatusText(target === 'end' ? 'ставлю картинку во 2-й кадр...' : 'ставлю картинку в 1-й кадр...')

    try {
      const imageDataUrl = await readUrlAsDataUrl(cleanUrl)
      if (!imageDataUrl) throw new Error('image data is empty')

      const mediaDraft = readGeneratorMediaDraft()

      if (target === 'end') {
        setRoute('first_last')
        setEndFile(null)
        setEndPersistedDataUrl(imageDataUrl)
        setEndPreview(imageDataUrl)
        await writeGeneratorMediaToDb({
          ...mediaDraft,
          endPersistedDataUrl: imageDataUrl,
          endFrameSource: 'generator_history_image',
          endFrameImageUrl: cleanUrl,
        })
        setStatusText('картинка из ленты поставлена как End / 2-й кадр')
        return
      }

      if (route === 'txt2img') setRoute('i2v')
      setStartFile(null)
      setStartPersistedDataUrl(imageDataUrl)
      setStartPreview(imageDataUrl)
      await writeGeneratorMediaToDb({
        ...mediaDraft,
        startPersistedDataUrl: imageDataUrl,
        startFrameSource: 'generator_history_image',
        startFrameImageUrl: cleanUrl,
      })
      setStatusText('картинка из ленты поставлена как Start / 1-й кадр')
    } catch (exc) {
      setError(`Не удалось поставить картинку в кадр: ${String(exc?.message || exc)}`)
      setStatusText('ошибка установки картинки в кадр')
    }
  }, [route])

  const takeLastFrameFromPreviousVideo = useCallback(async (eventOrUrl = '') => {
    eventOrUrl?.stopPropagation?.()
    eventOrUrl?.preventDefault?.()

    const overrideUrl = typeof eventOrUrl === 'string' ? eventOrUrl : ''
    const sourceVideoUrl = normalizeUrl(overrideUrl || previousVideoForFrame)
    if (!sourceVideoUrl) {
      setError('Сначала нужно получить или выбрать видео в нижней ленте.')
      setStatusText('нет видео в ленте')
      return
    }

    setError('')
    setFrameExtractBusy(true)
    setStatusText('беру последний кадр из последнего видео в ленте...')

    try {
      const sceneId = `generator_prev_frame_${Date.now()}`
      const staticIndex = sourceVideoUrl.indexOf('/static/')
      const videoApiPath = staticIndex >= 0 ? sourceVideoUrl.slice(staticIndex) : ''
      let imageRef = ''
      let imageDataUrl = ''
      let imageName = 'last-frame.jpg'

      try {
        const data = await fetchJson('/clip/video/extract-last-frame', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scene_id: sceneId,
            sceneId,
            source: 'standalone_generator',
            video_url: sourceVideoUrl,
            videoUrl: sourceVideoUrl,
            video_api_path: videoApiPath,
            videoApiPath: videoApiPath,
          }),
        })
        imageRef = normalizeUrl(data?.imageApiPath || data?.image_api_path || data?.imageUrl || data?.image_url || '')
        imageName = data?.imageName || data?.image_name || imageName
        if (!imageRef) throw new Error('backend не вернул image_url')
        imageDataUrl = await readUrlAsDataUrl(imageRef)
      } catch (backendError) {
        console.warn('[GENERATOR LAST FRAME BACKEND FAILED, TRY BROWSER]', backendError)
        setStatusText('backend не взял кадр, пробую через браузер...')
        imageDataUrl = await extractLastFrameFromVideoInBrowser(sourceVideoUrl)
        imageRef = sourceVideoUrl
      }

      if (!imageDataUrl || !imageDataUrl.startsWith('data:image/')) {
        throw new Error('не удалось получить dataUrl последнего кадра')
      }

      setStartFile(null)
      setStartPersistedDataUrl(imageDataUrl)
      setStartPreview(imageDataUrl)
      await writeGeneratorMediaToDb({
        ...readGeneratorMediaDraft(),
        startPersistedDataUrl: imageDataUrl,
        startFrameSource: 'previous_video_last_frame',
        startFrameSourceVideoUrl: sourceVideoUrl,
        startFrameImageUrl: imageRef,
        startFrameName: imageName,
      })
      setStatusText('последний кадр поставлен как Start image')
    } catch (exc) {
      setError(`Не удалось взять последний кадр: ${String(exc?.message || exc)}`)
      setStatusText('ошибка извлечения кадра')
    } finally {
      setFrameExtractBusy(false)
    }
  }, [previousVideoForFrame])

  const goToVideoMontageFromGenerator = useCallback(() => {
    const clips = (Array.isArray(generatedVideoItems) ? generatedVideoItems : [])
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
    const clips = (Array.isArray(generatedVideoItems) ? generatedVideoItems : [])
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
      await saveGeneratorHandoffBoardSnapshot(boardSnapshot, routeProjectId)
      await saveGeneratorHandoffAssemblySnapshot(boardSnapshot, routeProjectId)
      setMontageConfirmOpen(false)

      rememberWorkflowEntry(makeWorkflowEntry({
      from: 'standalone_generator',
      to: 'board_assembly',
      fromPath: generatorPagePath,
      toPath: routeProjectId ? `/app/projects/${routeProjectId}/board-assembly` : '/app/workspace/board-assembly',
      source: 'standalone_generator_handoff',
    }))

    navigate(routeProjectId ? `/app/projects/${routeProjectId}/board-assembly` : '/app/workspace/board-assembly', {
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
  }, [generatedVideoItems, navigate, routeProjectId, generatorPagePath])



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
    if (routeProjectId) return
    const data = readGeneratorDraft()
    if (!data) return

    try {
      if (data.route) setRoute(data.route)
      if (data.aspect) setAspect(data.aspect)
      if (data.prompt) setPrompt(data.prompt)
      if (data.negativePrompt) setNegativePrompt(data.negativePrompt)
      if (data.imageQuality) setImageQuality(data.imageQuality)
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
  }, [routeProjectId])


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
      imageQuality,
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
    imageQuality,
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
    if (routeProjectId) return
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
  }, [routeProjectId])

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
    if (busy || job?.jobId || job?.job_id) {
      setError('Сначала дождись окончания генерации или нажми «Отменить генерацию». Режим не переключаю, чтобы не отправить лишние jobs.')
      return
    }
    const value = String(nextRoute || '')
    console.log('[GEN ROUTE CHANGE]', value)
    setRoute(value)
    setError('')
    setStatusText('готов к тесту')
    setJob(null)
    setResultUrl('')
    setSelectedGalleryVideoUrl('')
    setImageActionMenuId('')
    setRawResponse(null)
    setMmaudioOpen(false)
    setMmaudioBusy(false)
    setMmaudioStatus('')
    setMmaudioResultUrl('')
    setMmaudioError('')
    setMmaudioJob(null)
    setMmaudioRawResponse(null)
  }, [busy, job])

  const handleStartFile = useCallback(async (file) => {
    setStartFile(file || null)
    if (!file) {
      setStartPreview('')
      setStartPersistedDataUrl('')
      saveGeneratorSnapshot('media_upload')
      return
    }
    setError('')
    setStatusText('загружаю стартовое фото в assets...')
    try {
      const uploaded = await uploadGeneratorMediaAsset(file, { projectId: routeProjectId, kind: 'image', stage: 'generator_images' })
      const apiPath = uploaded?.apiPath || uploaded?.api_path || uploaded?.url || ''
      if (apiPath) {
        setStartPersistedDataUrl(apiPath)
        setStartPreview(URL.createObjectURL(file))
        await writeGeneratorMediaToDb({ ...readGeneratorMediaDraft(), startPersistedDataUrl: apiPath, startImageAssetId: uploaded.assetId || uploaded.asset_id || '' })
        saveGeneratorSnapshot('media_upload', {
          mediaUploaded: true,
          media: {
            startImageUrl: normalizeUrl(apiPath),
            startImageApiPath: generatorCanonicalApiPath(apiPath),
            startImageAssetId: uploaded.assetId || uploaded.asset_id || generatorAssetIdFromRef(apiPath),
            endImageUrl: normalizeUrl(endPersistedDataUrl || endPreview || ''),
            endImageApiPath: generatorCanonicalApiPath(endPersistedDataUrl, endPreview),
            endImageAssetId: generatorAssetIdFromRef(endPersistedDataUrl, endPreview),
            audioUrl: normalizeUrl(audioPersistedDataUrl || audioPreviewUrl || ''),
            audioApiPath: generatorCanonicalApiPath(audioPersistedDataUrl, audioPreviewUrl),
            audioAssetId: generatorAssetIdFromRef(audioPersistedDataUrl, audioPreviewUrl),
            audioName,
            audioDurationSec,
          },
        })
        setStatusText('стартовое фото сохранено в проект')
        return
      }
    } catch (error) {
      console.warn('[GENERATOR START IMAGE ASSET UPLOAD FAILED]', error)
      setStatusText('asset upload не удался, сохраняю локально')
    }
    const persisted = await readImageFileAsPersistedDataUrl(file)
    setStartPersistedDataUrl(persisted)
    setStartPreview(persisted || URL.createObjectURL(file))
    if (persisted) writeGeneratorMediaToDb({ ...readGeneratorMediaDraft(), startPersistedDataUrl: persisted })
  }, [routeProjectId, saveGeneratorSnapshot, endPersistedDataUrl, endPreview, audioPersistedDataUrl, audioPreviewUrl, audioName, audioDurationSec])

  const handleEndFile = useCallback(async (file) => {
    setEndFile(file || null)
    if (!file) {
      setEndPreview('')
      setEndPersistedDataUrl('')
      saveGeneratorSnapshot('media_upload')
      return
    }
    setError('')
    setStatusText('загружаю второй кадр в assets...')
    try {
      const uploaded = await uploadGeneratorMediaAsset(file, { projectId: routeProjectId, kind: 'image', stage: 'generator_images' })
      const apiPath = uploaded?.apiPath || uploaded?.api_path || uploaded?.url || ''
      if (apiPath) {
        setEndPersistedDataUrl(apiPath)
        setEndPreview(URL.createObjectURL(file))
        await writeGeneratorMediaToDb({ ...readGeneratorMediaDraft(), endPersistedDataUrl: apiPath, endImageAssetId: uploaded.assetId || uploaded.asset_id || '' })
        saveGeneratorSnapshot('media_upload', {
          mediaUploaded: true,
          media: {
            startImageUrl: normalizeUrl(startPersistedDataUrl || startPreview || ''),
            startImageApiPath: generatorCanonicalApiPath(startPersistedDataUrl, startPreview),
            startImageAssetId: generatorAssetIdFromRef(startPersistedDataUrl, startPreview),
            endImageUrl: normalizeUrl(apiPath),
            endImageApiPath: generatorCanonicalApiPath(apiPath),
            endImageAssetId: uploaded.assetId || uploaded.asset_id || generatorAssetIdFromRef(apiPath),
            audioUrl: normalizeUrl(audioPersistedDataUrl || audioPreviewUrl || ''),
            audioApiPath: generatorCanonicalApiPath(audioPersistedDataUrl, audioPreviewUrl),
            audioAssetId: generatorAssetIdFromRef(audioPersistedDataUrl, audioPreviewUrl),
            audioName,
            audioDurationSec,
          },
        })
        setStatusText('второй кадр сохранён в проект')
        return
      }
    } catch (error) {
      console.warn('[GENERATOR END IMAGE ASSET UPLOAD FAILED]', error)
      setStatusText('asset upload не удался, сохраняю локально')
    }
    const persisted = await readImageFileAsPersistedDataUrl(file)
    setEndPersistedDataUrl(persisted)
    setEndPreview(persisted || URL.createObjectURL(file))
    if (persisted) writeGeneratorMediaToDb({ ...readGeneratorMediaDraft(), endPersistedDataUrl: persisted })
  }, [routeProjectId, saveGeneratorSnapshot, startPersistedDataUrl, startPreview, audioPersistedDataUrl, audioPreviewUrl, audioName, audioDurationSec])

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
    if ((route === 'ia2v' || route === 'ia2v_instrumental') && sec > 15.05) {
      setAudioFile(null)
      setAudioName('')
      setAudioDurationSec(sec)
      setAudioPreviewUrl('')
      setAudioPersistedDataUrl('')
      setIsAudioPlaying(false)
      setError(`Для lip-sync аудио должно быть не длиннее 15 сек. Сейчас: ${sec.toFixed(2)} сек.`)
      return
    }
    setAudioFile(file)
    setAudioName(file?.name || '')
    setAudioDurationSec(sec)
    const localAudioPreviewUrlV167A = URL.createObjectURL(file)
    setAudioPreviewUrl(localAudioPreviewUrlV167A)
    setStatusText('загружаю аудио в assets...')
    try {
      const uploaded = await uploadGeneratorMediaAsset(file, { projectId: routeProjectId, kind: 'audio', stage: 'generator_audio' })
      const apiPath = uploaded?.apiPath || uploaded?.api_path || uploaded?.url || ''
      if (apiPath) {
        setAudioPersistedDataUrl(apiPath)
        try {
          const protectedPreviewUrlV167A = await fetchGeneratorAssetBlobUrl(apiPath)
          if (protectedPreviewUrlV167A) setAudioPreviewUrl(protectedPreviewUrlV167A)
        } catch (previewErrorV167A) {
          console.warn('[GENERATOR AUDIO PREVIEW BLOB FAILED V167A]', previewErrorV167A)
          setAudioPreviewUrl(localAudioPreviewUrlV167A)
        }
        await writeGeneratorMediaToDb({ ...readGeneratorMediaDraft(), audioPersistedDataUrl: apiPath, audioName: file?.name || '', audioDurationSec: sec, audioAssetId: uploaded.assetId || uploaded.asset_id || '' })
        saveGeneratorSnapshot('media_upload', {
          mediaUploaded: true,
          media: {
            startImageUrl: normalizeUrl(startPersistedDataUrl || startPreview || ''),
            startImageApiPath: generatorCanonicalApiPath(startPersistedDataUrl, startPreview),
            startImageAssetId: generatorAssetIdFromRef(startPersistedDataUrl, startPreview),
            endImageUrl: normalizeUrl(endPersistedDataUrl || endPreview || ''),
            endImageApiPath: generatorCanonicalApiPath(endPersistedDataUrl, endPreview),
            endImageAssetId: generatorAssetIdFromRef(endPersistedDataUrl, endPreview),
            audioUrl: normalizeUrl(apiPath),
            audioApiPath: generatorCanonicalApiPath(apiPath),
            audioAssetId: uploaded.assetId || uploaded.asset_id || generatorAssetIdFromRef(apiPath),
            audioName: file?.name || '',
            audioDurationSec: sec,
          },
        })
        setStatusText('аудио сохранено в проект')
        return
      }
    } catch (error) {
      console.warn('[GENERATOR AUDIO ASSET UPLOAD FAILED]', error)
      setStatusText('asset upload не удался, сохраняю локально')
    }
    const audioDataUrlForPersist = await readFileAsDataUrl(file)
    setAudioPersistedDataUrl(audioDataUrlForPersist)
    setAudioPreviewUrl(audioDataUrlForPersist || URL.createObjectURL(file))
    if (audioDataUrlForPersist) writeGeneratorMediaToDb({ ...readGeneratorMediaDraft(), audioPersistedDataUrl: audioDataUrlForPersist, audioName: file?.name || '', audioDurationSec: sec })
  }, [route, audioPreviewUrl, routeProjectId, saveGeneratorSnapshot, startPersistedDataUrl, startPreview, endPersistedDataUrl, endPreview])

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

  const downloadGeneratedImage = useCallback(async (event, url = displayedResultUrl) => {
    event?.stopPropagation?.()
    event?.preventDefault?.()

    const cleanUrl = normalizeUrl(url || '')
    if (!cleanUrl) {
      setError('Нет картинки для скачивания.')
      return
    }

    try {
      setStatusText('скачиваю изображение...')
      await downloadGeneratorAsset(cleanUrl, 'image')
      setStatusText('изображение отправлено на скачивание')
    } catch (error) {
      setError(`Не удалось скачать изображение: ${String(error?.message || error)}`)
    }
  }, [displayedResultUrl])

  const pollStatus = useCallback((jobId, statusBase) => {
    const cleanJobId = String(jobId || '').trim()
    if (!cleanJobId || !statusBase) return
    if (pollingRef.current) clearInterval(pollingRef.current)

    const pollToken = `${cleanJobId}:${Date.now()}:${Math.random().toString(16).slice(2)}`
    activeGeneratorPollTokenRef.current = pollToken
    let tickCount = 0
    let tickInFlight = false
    let stopped = false

    const stopPollingRun = () => {
      stopped = true
      if (pollingRef.current) clearInterval(pollingRef.current)
      pollingRef.current = null
    }

    const tick = async () => {
      if (stopped || tickInFlight || activeGeneratorPollTokenRef.current !== pollToken) return
      tickInFlight = true
      tickCount += 1
      if (tickCount > 180) {
        stopPollingRun()
        setBusy(false)
        setJob(null)
        setStatusText('polling остановлен по таймауту')
        tickInFlight = false
        return
      }
      try {
        const data = await fetchJson(`${statusBase}${cleanJobId}`)
        if (stopped || activeGeneratorPollTokenRef.current !== pollToken) return

        updateCreditSummaryFromJobResponse(data)
        setRawResponse(data)
        const polledStatus = data.status || data.video_status || 'running'
        const polledJob = compactGeneratorJob({
          ...data,
          jobId: cleanJobId,
          projectId: routeProjectId,
          pagePath: generatorPagePath,
          stage: 'generator',
          status: polledStatus,
          statusBase,
          statusEndpoint: `${statusBase}${cleanJobId}`,
          route,
        })
        const resultKind = routeInfo?.kind === 'image' ? 'image' : 'video'
        const pickedResultUrl = normalizeUrl(pickVideoUrl(data))
        const resultAssetUrl = isBlockedGeneratorPreviewUrl(pickedResultUrl) ? '' : pickedResultUrl
        const refs = resultAssetUrl ? generatorResultRefs(data, resultAssetUrl) : { apiPath: '', assetId: '', url: '' }
        const completionKey = cleanJobId
        const isCompletedPoll = statusLooksDone(polledStatus) || Boolean(resultAssetUrl)
        const isFailedPoll = statusLooksFailed(polledStatus)

        if (isCompletedPoll && completionKey && completedGeneratorJobsRef.current.has(completionKey)) {
          stopPollingRun()
          setBusy(false)
          setJob(null)
          return
        }

        if (isCompletedPoll && completionKey) {
          completedGeneratorJobsRef.current.add(completionKey)
          stopPollingRun()
          setBusy(false)
          setJob(null)
        } else {
          setJob((old) => compactGeneratorJob({ ...(old || {}), ...(polledJob || {}), ...data, jobId: cleanJobId }))
        }
        setStatusText(polledStatus)

        if (!resultAssetUrl && !isCompletedPoll && !isFailedPoll && generatorJobLooksActive(polledJob)) {
          saveGeneratorSnapshot('job_polling', { job: polledJob, statusText: polledStatus })
        }

        if (resultAssetUrl) {
          const canonicalResultUrl = refs.apiPath || resultAssetUrl
          const resultMeta = {
            kind: resultKind,
            label: routeInfo?.label || (resultKind === 'image' ? 'Фото' : 'Видео'),
            route,
            durationSec: resultKind === 'image' ? 0 : targetDurationSec,
            apiPath: refs.apiPath || generatorCanonicalApiPath(canonicalResultUrl),
            assetId: refs.assetId || generatorAssetIdFromRef(canonicalResultUrl),
          }
          setSelectedGalleryVideoUrl('')
          setImageActionMenuId('')
          setResultUrl(normalizeUrl(canonicalResultUrl))
          const nextGallery = dedupeGeneratorGalleryItems(mergeGeneratorGalleryItem(generatedVideosRef.current, canonicalResultUrl, resultMeta))
          generatedVideosRef.current = nextGallery
          setGeneratedVideos(nextGallery)
          saveGeneratorSnapshot('generator_completed', { resultUrl: canonicalResultUrl, resultData: data, job: null, statusText: 'completed', gallery: nextGallery })
          await saveCompletedGeneratorResultNow(canonicalResultUrl, data, cleanJobId, nextGallery)
        }

        if (cleanJobId) {
          upsertGlobalJob({
            id: `generator:${cleanJobId}`,
            source: 'standalone_generator',
            credit_cost_hint: currentCreditCost,
            creditCostHint: currentCreditCost,
            client_credit_cost: currentCreditCost,
            kind: resultKind,
            title: resultKind === 'image' ? 'Фото' : 'Видео',
            toastTitle: resultKind === 'image' ? 'Фото готово' : 'Видео готово',
            toastMessage: 'Генерация завершена. Перейти в генератор?',
            pagePath: generatorPagePath,
            projectId: routeProjectId,
            stage: 'generator',
            jobId: cleanJobId,
            status: isCompletedPoll ? 'done' : (polledStatus || 'running'),
            rawStatus: polledStatus || 'running',
            statusBase,
            statusEndpoint: `${statusBase}${cleanJobId}`,
            resultUrl: resultAssetUrl || '',
            apiPath: refs.apiPath || generatorCanonicalApiPath(resultAssetUrl),
            assetId: refs.assetId || generatorAssetIdFromRef(resultAssetUrl),
            response: data,
          })
        }

        if (isCompletedPoll) {
          updateCreditSummaryFromJobResponse(data)
          refreshCreditSummaryNow('generator_completed')
          try { window.dispatchEvent(new CustomEvent('ava:credits-changed', { detail: data })) } catch {}
          return
        }

        if (isFailedPoll) {
          stopPollingRun()
          setBusy(false)
          setJob(null)
        }
      } catch (exc) {
        setError(String(exc?.message || exc))
        setBusy(false)
        stopPollingRun()
      } finally {
        tickInFlight = false
      }
    }

    tick()
    pollingRef.current = setInterval(tick, 2200)
  }, [refreshCreditSummaryNow, updateCreditSummaryFromJobResponse, currentCreditCost, routeInfo?.kind, routeInfo?.label, route, targetDurationSec, generatorPagePath, routeProjectId, saveGeneratorSnapshot, saveCompletedGeneratorResultNow])

  useEffect(() => {
    // Hotfix: do not restore old generator jobs from global storage.
    // Old jobs may contain localhost/static URLs and pending status endpoints;
    // restoring them causes endless polling/toasts. New jobs still work locally.
    try {
      const latest = pickLatestGeneratorJob()
      if (latest?.jobId) console.log('[GENERATOR RESTORE DISABLED]', { jobId: latest.jobId })
    } catch {}
  }, [])

  const pollMmaudioStatus = useCallback((jobId, restoredJob = null) => {
    const cleanJobId = String(jobId || '').replace(/^generator-mmaudio:/, '').replace(/^mmaudio:/, '').trim()
    if (!cleanJobId) return

    if (mmaudioPollingRef.current) clearInterval(mmaudioPollingRef.current)

    const pollToken = `mmaudio:${cleanJobId}:${Date.now()}`
    activeMmaudioPollTokenRef.current = pollToken
    let stopped = false
    let tickInFlight = false

    const stopMmaudioPollingRun = () => {
      stopped = true
      if (mmaudioPollingRef.current) clearInterval(mmaudioPollingRef.current)
      mmaudioPollingRef.current = null
      if (activeMmaudioPollTokenRef.current === pollToken) activeMmaudioPollTokenRef.current = ''
    }

    const tick = async () => {
      if (stopped || tickInFlight || activeMmaudioPollTokenRef.current !== pollToken) return
      tickInFlight = true
      try {
        const data = await fetchJson(`/clip/mmaudio/status/${cleanJobId}`)
        if (stopped || activeMmaudioPollTokenRef.current !== pollToken) return

        updateCreditSummaryFromJobResponse(data)
        setMmaudioRawResponse(data)

        const polledStatus = data.status || data.audio_status || data.video_status || 'running'
        const video = pickMmaudioOutputUrl(data)
        const isCompletedPoll = statusLooksDone(polledStatus) || Boolean(video)
        const isFailedPoll = statusLooksFailed(polledStatus)
        const canonicalVideo = video ? (generatorCanonicalApiPath(video) || normalizeUrl(video)) : ''
        const nextJob = compactGeneratorJob({
          ...(restoredJob || {}),
          ...data,
          id: `generator-mmaudio:${cleanJobId}`,
          key: `generator-mmaudio:${cleanJobId}`,
          jobId: cleanJobId,
          job_id: cleanJobId,
          projectId: routeProjectId,
          stage: 'generator',
          kind: 'mmaudio',
          source: 'standalone_generator_mmaudio',
          pagePath: generatorPagePath,
          to: generatorPagePath,
          status: isCompletedPoll ? 'completed' : (polledStatus || 'running'),
          rawStatus: polledStatus || 'running',
          statusBase: '/clip/mmaudio/status/',
          statusEndpoint: `/clip/mmaudio/status/${cleanJobId}`,
          resultUrl: canonicalVideo || '',
          videoUrl: canonicalVideo || '',
          apiPath: generatorCanonicalApiPath(canonicalVideo),
          assetId: generatorAssetIdFromRef(canonicalVideo),
          updatedAt: new Date().toISOString(),
        })

        setMmaudioJob(nextJob)
        setMmaudioStatus(polledStatus || 'running')

        if (!isCompletedPoll && !isFailedPoll) {
          saveGeneratorSnapshot('mmaudio_job_polling', { mmaudioJob: nextJob, mmaudioStatus: polledStatus || 'running' })
          return
        }

        if (isCompletedPoll) {
          if (completedMmaudioJobsRef.current.has(cleanJobId)) {
            stopMmaudioPollingRun()
            setMmaudioBusy(false)
            setMmaudioJob(null)
            return
          }
          completedMmaudioJobsRef.current.add(cleanJobId)
          updateCreditSummaryFromJobResponse(data)
          refreshCreditSummaryNow('mmaudio_completed')
          try { window.dispatchEvent(new CustomEvent('ava:credits-changed', { detail: data })) } catch {}

          if (canonicalVideo) {
            const refs = generatorResultRefs(data, canonicalVideo)
            const mmaudioMeta = {
              kind: 'mmaudio',
              label: 'MMAudio',
              route: 'mmaudio',
              durationSec: targetDurationSec,
              apiPath: refs.apiPath || generatorCanonicalApiPath(canonicalVideo),
              assetId: refs.assetId || generatorAssetIdFromRef(canonicalVideo),
            }
            rememberedGalleryUrlsRef.current.add(`mmaudio:${normalizeUrl(canonicalVideo)}`)
            setSelectedGalleryVideoUrl(canonicalVideo)
            setImageActionMenuId('')
            setMmaudioResultUrl(canonicalVideo)
            setGeneratedVideos((old) => {
              const nextGallery = upsertGeneratorGalleryResult(old, canonicalVideo, mmaudioMeta)
              const completedMmaudioJobIds = [...completedMmaudioJobsRef.current].map(generatorCleanJobId).filter(Boolean).slice(-30)
              saveGeneratorSnapshot('mmaudio_completed', {
                gallery: nextGallery,
                mmaudioResultUrl: canonicalVideo,
                mmaudioJob: null,
                mmaudioStatus: 'completed',
                lastCompletedMmaudioJobId: cleanJobId,
                completedMmaudioJobIds,
              })
              return nextGallery
            })
          } else {
            saveGeneratorSnapshot('mmaudio_completed', {
              mmaudioJob: null,
              mmaudioStatus: 'completed',
              lastCompletedMmaudioJobId: cleanJobId,
              completedMmaudioJobIds: [cleanJobId],
            })
          }

          stopMmaudioPollingRun()
          setMmaudioBusy(false)
          setMmaudioJob(null)
          setMmaudioStatus('completed')
          return
        }

        if (isFailedPoll) {
          saveGeneratorSnapshot('mmaudio_failed', { mmaudioJob: null, mmaudioStatus: polledStatus || 'failed' })
          stopMmaudioPollingRun()
          setMmaudioBusy(false)
          setMmaudioJob(null)
        }
      } catch (exc) {
        setMmaudioError(String(exc?.message || exc))
        setMmaudioBusy(false)
        stopMmaudioPollingRun()
      } finally {
        tickInFlight = false
      }
    }

    tick()
    mmaudioPollingRef.current = setInterval(tick, 2200)
  }, [generatorPagePath, refreshCreditSummaryNow, routeProjectId, saveGeneratorSnapshot, targetDurationSec, updateCreditSummaryFromJobResponse])

  const submitMmaudio = useCallback(async () => {
    setMmaudioError('')
    setMmaudioRawResponse(null)
    setMmaudioResultUrl('')
    setMmaudioStatus('')
    setMmaudioJob(null)
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
        project_id: routeProjectId,
        projectId: routeProjectId,
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
      const data = await fetchJson('/clip/mmaudio/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setMmaudioRawResponse(data)
      const jobId = String(data.jobId || data.job_id || data.id || '').trim()
      const startedStatus = data.status || 'queued'
      const startedJob = compactGeneratorJob({
        ...data,
        id: jobId ? `generator-mmaudio:${jobId}` : '',
        key: jobId ? `generator-mmaudio:${jobId}` : '',
        jobId,
        job_id: jobId,
        projectId: routeProjectId,
        stage: 'generator',
        kind: 'mmaudio',
        source: 'standalone_generator_mmaudio',
        pagePath: generatorPagePath,
        to: generatorPagePath,
        status: startedStatus,
        rawStatus: startedStatus,
        statusBase: '/clip/mmaudio/status/',
        statusEndpoint: jobId ? `/clip/mmaudio/status/${jobId}` : '',
        route: 'mmaudio',
      })
      if (jobId) completedMmaudioJobsRef.current.delete(jobId)
      setMmaudioJob(startedJob)
      setMmaudioStatus(startedStatus)
      if (jobId) {
        saveGeneratorSnapshot('mmaudio_job_started', {
          resultUrl,
          gallery: generatedVideos,
          mmaudioResultUrl: '',
          mmaudioJob: startedJob,
          mmaudioStatus: startedStatus,
          media: {
            startImageUrl: normalizeUrl(startPersistedDataUrl || startPreview || ''),
            startImageApiPath: generatorCanonicalApiPath(startPersistedDataUrl, startPreview),
            startImageAssetId: generatorAssetIdFromRef(startPersistedDataUrl, startPreview),
            endImageUrl: normalizeUrl(endPersistedDataUrl || endPreview || ''),
            endImageApiPath: generatorCanonicalApiPath(endPersistedDataUrl, endPreview),
            endImageAssetId: generatorAssetIdFromRef(endPersistedDataUrl, endPreview),
            audioUrl: normalizeUrl(audioPersistedDataUrl || audioPreviewUrl || ''),
            audioApiPath: generatorCanonicalApiPath(audioPersistedDataUrl, audioPreviewUrl),
            audioAssetId: generatorAssetIdFromRef(audioPersistedDataUrl, audioPreviewUrl),
            audioName,
            audioDurationSec,
          },
        })
        upsertGlobalJob({
          id: `generator-mmaudio:${jobId}`,
          key: `generator-mmaudio:${jobId}`,
          source: 'standalone_generator_mmaudio',
          kind: 'mmaudio',
          title: 'MMAudio',
          toastTitle: 'MMAudio готово',
          toastMessage: 'Звук готов. Перейти в генератор?',
          pagePath: generatorPagePath,
          to: generatorPagePath,
          projectId: routeProjectId,
          stage: 'generator',
          sceneId,
          jobId,
          status: startedStatus,
          rawStatus: startedStatus,
          statusBase: '/clip/mmaudio/status/',
          statusEndpoint: `/clip/mmaudio/status/${jobId}`,
          route: 'mmaudio',
        })
      }
      const video = pickMmaudioOutputUrl(data)
      if (video) {
        const canonicalVideo = generatorCanonicalApiPath(video) || normalizeUrl(video)
        rememberedGalleryUrlsRef.current.add(`mmaudio:${normalizeUrl(canonicalVideo)}`)
        setSelectedGalleryVideoUrl(canonicalVideo)
        setImageActionMenuId('')
        setMmaudioResultUrl(canonicalVideo)
        setMmaudioBusy(false)
        setMmaudioStatus(data.status || 'ready')
      }
      if (jobId) pollMmaudioStatus(jobId, startedJob)
      else setMmaudioBusy(false)
    } catch (exc) {
      setMmaudioError(String(exc?.message || exc))
      setMmaudioBusy(false)
    }
  }, [aspectInfo.value, durationSec, generatorPagePath, mmaudioCreditCost, mmaudioPrompt, mmaudioNegativePrompt, pollMmaudioStatus, resultUrl, routeProjectId, saveGeneratorSnapshot, generatedVideos, startPersistedDataUrl, startPreview, endPersistedDataUrl, endPreview, audioPersistedDataUrl, audioPreviewUrl, audioName, audioDurationSec])

  const submitGeneration = useCallback(async () => {
    if (submitGenerationInFlightRef.current || busy || job?.jobId || job?.job_id) {
      setStatusText('уже идёт генерация — новый запрос не отправлен')
      return
    }
    submitGenerationInFlightRef.current = true
    setError('')
    setSelectedGalleryVideoUrl('')
    setImageActionMenuId('')
    setResultUrl('')
    setMmaudioResultUrl('')
    setMmaudioRawResponse(null)
    setMmaudioJob(null)
    setMmaudioError('')
    setRawResponse(null)

    if (routeInfo.needsStart && !startFile && !startPersistedDataUrl && !startPreview) {
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

      // AVA_LAST_FRAME_V4_GENERATOR_NO_POST_WITHOUT_START
      if (includeStart && !startDataUrl) {
        throw new Error('Стартовое изображение пустое: видео не отправлено.')
      }
      if (includeStart && String(startDataUrl).startsWith('blob:')) {
        throw new Error('Стартовое изображение было временным blob и потеряно. Загрузите фото заново или возьмите кадр из ленты.')
      }
      if (includeEnd && !endDataUrl) {
        throw new Error('Последний кадр пустой: first-last не отправлен.')
      }

      const startRef = String(startDataUrl || '')
      const endRef = String(endDataUrl || '')
      const startIsDataUrl = startRef.startsWith('data:')
      const endIsDataUrl = endRef.startsWith('data:')
      const startImageUrlForBackend = startRef && !startIsDataUrl ? startRef : ''
      const endImageUrlForBackend = endRef && !endIsDataUrl ? endRef : ''
      const startImageDataUrlForBackend = startIsDataUrl ? startRef : ''
      const endImageDataUrlForBackend = endIsDataUrl ? endRef : ''
      const activeJobMediaSnapshot = {
        startImageUrl: normalizeUrl(startImageUrlForBackend || startImageDataUrlForBackend || startPersistedDataUrl || startPreview || ''),
        startImageApiPath: generatorCanonicalApiPath(startImageUrlForBackend || startPersistedDataUrl || '', startPreview),
        startImageAssetId: generatorAssetIdFromRef(startImageUrlForBackend, startPersistedDataUrl, startPreview),
        endImageUrl: normalizeUrl(endImageUrlForBackend || endImageDataUrlForBackend || endPersistedDataUrl || endPreview || ''),
        endImageApiPath: generatorCanonicalApiPath(endImageUrlForBackend || endPersistedDataUrl || '', endPreview),
        endImageAssetId: generatorAssetIdFromRef(endImageUrlForBackend, endPersistedDataUrl, endPreview),
        audioUrl: normalizeUrl(audioDataUrl || audioPersistedDataUrl || audioPreviewUrl || ''),
        audioApiPath: generatorCanonicalApiPath(audioPersistedDataUrl, audioPreviewUrl),
        audioAssetId: generatorAssetIdFromRef(audioPersistedDataUrl, audioPreviewUrl),
        audioName,
        audioDurationSec,
      }

      const sceneId = `generator_${Date.now()}`
      const effectiveProjectId = routeProjectId || generatorProjectIdFromPath()
      const payload = {
        scene_id: sceneId,
        sceneId,
        project_id: effectiveProjectId || undefined,
        projectId: effectiveProjectId || undefined,
        workspaceMode: !effectiveProjectId,
        route,
        image_quality: routeInfo.kind === 'image' ? imageQualityPayloadValue : undefined,
        imageQuality: routeInfo.kind === 'image' ? imageQualityPayloadValue : undefined,
        txt2img_quality: routeInfo.kind === 'image' ? imageQualityPayloadValue : undefined,
        txt2imgQuality: routeInfo.kind === 'image' ? imageQualityPayloadValue : undefined,
        quality: routeInfo.kind === 'image' ? imageQualityPayloadValue : undefined,
        image_url: startImageUrlForBackend,
        imageUrl: startImageUrlForBackend,
        image_data_url: startImageDataUrlForBackend,
        imageDataUrl: startImageDataUrlForBackend,
        start_image_url: startImageUrlForBackend,
        startImageUrl: startImageUrlForBackend,
        start_image_data_url: startImageDataUrlForBackend,
        startImageDataUrl: startImageDataUrlForBackend,
        end_image_url: endImageUrlForBackend,
        endImageUrl: endImageUrlForBackend,
        end_image_data_url: endImageDataUrlForBackend,
        endImageDataUrl: endImageDataUrlForBackend,
        audio_data_url: audioDataUrl,
        audioDataUrl: audioDataUrl,
        video_prompt: prompt,
        videoPrompt: prompt,
        positive_prompt: prompt,
        positivePrompt: prompt,
        negative_prompt: negativePrompt,
        negativePrompt: negativePrompt,
        width: Number(renderSize.width) || 1280,
        height: Number(renderSize.height) || 720,

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
      setStatusText(routeInfo.kind === 'image' ? `отправляю картинку ${renderSize.width}×${renderSize.height}` : `отправляю в backend: ${generationDurationSec.toFixed(1)} сек → итог ${targetDurationSec.toFixed(1)} сек`)
      const data = await fetchJson(routeInfo.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setRawResponse(data)
      const jobId = data.jobId || data.job_id || data.id
      const startedStatus = data.status || 'queued'
      const startedJob = compactGeneratorJob({
        ...data,
        jobId,
        projectId: effectiveProjectId,
        pagePath: generatorPagePath,
        stage: 'generator',
        status: startedStatus,
        statusBase: routeInfo.statusBase,
        statusEndpoint: jobId ? `${routeInfo.statusBase}${jobId}` : '',
        route,
      })
      if (jobId) completedGeneratorJobsRef.current.delete(String(jobId).trim())
      setJob(startedJob)
      setStatusText(startedStatus)
      if (jobId && generatorJobLooksActive(startedJob)) {
        saveGeneratorSnapshot('job_started', { job: startedJob, statusText: startedStatus, media: activeJobMediaSnapshot })
      }
      const pickedVideo = normalizeUrl(pickVideoUrl(data))
      const video = isBlockedGeneratorPreviewUrl(pickedVideo) ? '' : pickedVideo
      const refs = video ? generatorResultRefs(data, video) : { apiPath: '', assetId: '', url: '' }
      if (video) {
        const refs = generatorResultRefs(data, video)
        const canonicalVideo = refs.apiPath || video
        const resultKind = routeInfo?.kind === 'image' ? 'image' : 'video'
        const resultMeta = {
          kind: resultKind,
          label: routeInfo?.label || (resultKind === 'image' ? 'Фото' : 'Видео'),
          route,
          durationSec: resultKind === 'image' ? 0 : targetDurationSec,
          apiPath: refs.apiPath || generatorCanonicalApiPath(canonicalVideo),
          assetId: refs.assetId || generatorAssetIdFromRef(canonicalVideo),
        }
        setSelectedGalleryVideoUrl('')
        setImageActionMenuId('')
        setResultUrl(normalizeUrl(canonicalVideo))
        if (jobId) completedGeneratorJobsRef.current.add(String(jobId).trim())
        setGeneratedVideos((old) => {
          const nextGallery = mergeGeneratorGalleryItem(old, canonicalVideo, resultMeta)
          saveGeneratorSnapshot('generator_completed', { resultUrl: canonicalVideo, resultData: data, job: null, statusText: 'completed', gallery: nextGallery })
          return nextGallery
        })
        setJob(null)
        setBusy(false)
        await saveCompletedGeneratorResultNow(canonicalVideo, data, jobId || '')
      }
      if (jobId) {
        upsertGlobalJob({
          id: `generator:${jobId}`,
          source: 'standalone_generator',
          kind: routeInfo.kind === 'image' ? 'image' : 'video',
          title: routeInfo.label,
          toastTitle: routeInfo.kind === 'image' ? 'Фото готово' : 'Видео готово',
          toastMessage: 'Генерация завершена. Перейти в генератор?',
          pagePath: generatorPagePath,
          projectId: effectiveProjectId || routeProjectId,
          stage: 'generator',
          jobId,
          status: startedStatus,
          rawStatus: startedStatus,
          statusBase: routeInfo.statusBase,
          statusEndpoint: `${routeInfo.statusBase}${jobId}`,
          route,
          aspect,
          targetDurationSec,
          generationDurationSec,
          resultUrl: video || '',
          apiPath: refs.apiPath || generatorCanonicalApiPath(video),
          assetId: refs.assetId || generatorAssetIdFromRef(video),
        })
      }
      submitGenerationInFlightRef.current = false
      if (jobId) pollStatus(jobId, routeInfo.statusBase)
      else setBusy(false)
    } catch (exc) {
      submitGenerationInFlightRef.current = false
      setError(String(exc?.message || exc))
      setBusy(false)
    }
  }, [audioDurationSec, audioFile, audioPersistedDataUrl, audioPreviewUrl, aspectInfo.value, currentCreditCost, renderSize.height, renderSize.width, endFile, endPersistedDataUrl, endPreview, generationDurationSec, negativePrompt, pollStatus, prompt, route, routeInfo, startFile, startPersistedDataUrl, startPreview, targetDurationSec, generatorPagePath, routeProjectId, saveGeneratorSnapshot, saveCompletedGeneratorResultNow, busy, job])

  const cancelGeneration = useCallback(async () => {
    const activeJob = compactGeneratorJob(job || rawResponse || {})
    const cleanJobId = String(activeJob?.jobId || activeJob?.job_id || activeJob?.id || '').replace(/^generator:/, '').trim()

    if (cancelGenerationInFlightRef.current) return
    if (!cleanJobId) {
      setStatusText('отмена невозможна: нет активного job id')
      setError('Генерация уже могла быть отправлена, но UI ещё не получил job id. Дождись появления job id или прерви очередь в ComfyUI.')
      return
    }

    cancelGenerationInFlightRef.current = true
    setGeneratorCanceling(true)
    setError('')
    setStatusText('отменяю генерацию на сервере...')

    try {
      const data = await fetchJson(`/clip/video/cancel/${encodeURIComponent(cleanJobId)}`, { method: 'POST' })
      setRawResponse(data)
      if (pollingRef.current) clearInterval(pollingRef.current)
      pollingRef.current = null
      activeGeneratorPollTokenRef.current = ''
      pendingGeneratorResumeJobRef.current = null
      completedGeneratorJobsRef.current.add(cleanJobId)
      removeAvaGeneratorActiveJobsMatching({ jobIds: [cleanJobId], projectId: routeProjectId })
      setJob(null)
      setBusy(false)
      const queueDeleted = Boolean(data?.comfy?.queueDeleteOk)
      const interrupted = Boolean(data?.comfy?.interruptOk)
      const status = queueDeleted || interrupted
        ? 'отменено на сервере / очередь Comfy очищена'
        : 'job помечен отменённым, но Comfy не подтвердил остановку'
      setStatusText(status)
      saveGeneratorSnapshot('job_canceled', { job: null, statusText: status, canceledJobId: cleanJobId, cancelResult: data })
    } catch (exc) {
      const msg = String(exc?.message || exc)
      setError(`Отмена не подтверждена сервером: ${msg}`)
      setStatusText('отмена не подтверждена — Comfy может продолжать генерацию')
    } finally {
      cancelGenerationInFlightRef.current = false
      setGeneratorCanceling(false)
    }
  }, [job, rawResponse, routeProjectId, saveGeneratorSnapshot])

  const clearDraft = useCallback(() => {
    if (busy || generatorJobLooksActive(job) || submitGenerationInFlightRef.current || generatorCanceling) {
      setStatusText('Сначала отмените активную генерацию — очистка заблокирована')
      return
    }
    const ok = window.confirm('Безвозвратно очистить ленту, текущий результат, медиа и связанные файлы генератора на сервере?')
    if (!ok) return
    // AVA_GENERATOR_CLEAR_DESTRUCTIVE_DELETE_V83
    // Generator Clear is destructive: remove visible feed results and uploaded media assets.
    if (pollingRef.current) clearInterval(pollingRef.current)
    if (mmaudioPollingRef.current) clearInterval(mmaudioPollingRef.current)
    pollingRef.current = null
    mmaudioPollingRef.current = null
    activeGeneratorPollTokenRef.current = ''
    activeMmaudioPollTokenRef.current = ''
    setBusy(false)
    deleteGeneratorAssetsByRefs([
      ...dedupeGeneratorGalleryItems(generatedVideosRef.current).flatMap((item) => [item.assetId, item.asset_id, item.apiPath, item.api_path, item.url]),
      resultUrl,
      mmaudioResultUrl,
      startPersistedDataUrl,
      endPersistedDataUrl,
      audioPersistedDataUrl,
    ], 'generator_clear')
    clearGeneratorDraft()
    writeGeneratorGalleryDraft([])
    deletedGeneratorGalleryRefsRef.current = new Set()
    deletedMmaudioJobIdsRef.current = new Set()
    completedMmaudioJobsRef.current = new Set()
    setGeneratedVideos([])
    saveGeneratorSnapshot('gallery_clear', {
      gallery: [],
      media: {},
      resultUrl: '',
      resultData: null,
      job: null,
      statusText: 'очищено',
      mmaudioResultUrl: '',
      mmaudioJob: null,
      mmaudioStatus: '',
      lastCompletedMmaudioJobId: '',
      completedMmaudioJobIds: [],
      deletedGalleryRefs: [],
      deletedMmaudioJobIds: [],
    })
    removeAvaGeneratorActiveJobsMatching({ projectId: routeProjectId })
    setJob(null)
    setResultUrl('')
    setSelectedGalleryVideoUrl('')
    setImageActionMenuId('')
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
  }, [routeProjectId, saveGeneratorSnapshot, resultUrl, mmaudioResultUrl, startPersistedDataUrl, endPersistedDataUrl, audioPersistedDataUrl])

  const durationMax = routeInfo.maxDuration || 1

  const generatorActionLocked = Boolean(busy || generatorJobLooksActive(job) || submitGenerationInFlightRef.current)
  const generatorCanCancel = Boolean(generatorActionLocked && (job?.jobId || job?.job_id || rawResponse?.jobId || rawResponse?.job_id || rawResponse?.id))

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
                <select className="avaGeneratorSelect" value={route} onChange={(event) => handleRouteChange(event.target.value)} disabled={generatorActionLocked || generatorCanceling}>
                  {ROUTES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              <div>
                <label className="avaGeneratorLabel">Формат</label>
                <div className="avaGeneratorAspectTabs">
                  {ASPECTS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={`avaGeneratorAspectBtn ${aspect === item.value ? 'isActive' : ''}`}
                      onClick={() => setAspect(item.value)}
                      disabled={generatorActionLocked || generatorCanceling}
                      title={item.value === '16:9' ? 'Горизонтальный формат' : (item.value === '9:16' ? 'Вертикальный формат' : 'Квадратный формат')}
                    >
                      <span className={`avaGeneratorAspectPreview is-${item.shape || 'horizontal'}`}>
                        <b>{item.label}</b>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {routeInfo.kind === 'video' ? (
              <div className={`avaGeneratorDurationBlock ${routeInfo.needsAudio ? 'isAudioLockedV167A' : ''}`}>
                <div className="avaGeneratorDurationHeader">
                  <span>Итоговая длительность</span>
                  <strong>{targetDurationSec.toFixed(1)} сек</strong>
                </div>
                {routeInfo.needsAudio ? (
                  <div className="avaGeneratorAudioLockedDurationV167A">
                    <span>Длительность берётся из аудио</span>
                    <strong>{audioDurationSec > 0 ? `${audioDurationSec.toFixed(2)} сек` : 'загрузи audio'}</strong>
                  </div>
                ) : (
                  <input className="avaGeneratorRange" type="range" min="1" max={durationMax} step="0.5" value={durationSec} onChange={(event) => setDurationSec(Number(event.target.value))} disabled={generatorActionLocked || generatorCanceling} />
                )}
                <div className="avaGeneratorCompactHint">{routeInfo.needsAudio ? 'Липсинк: фото + audio, без ручного слайдера.' : (routeInfo.needsEnd ? 'Нужны Start и End кадры.' : (routeInfo.kind === 'image' ? 'Генерация фото по prompt.' : 'Нужно стартовое фото.'))}</div>
              </div>
            ) : null}
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
            {routeInfo.kind === 'image' ? (
              <div className="avaGeneratorQualityBox">
                <span>Качество фото</span>
                <div className="avaGeneratorQualityTabs">
                  {TXT2IMG_QUALITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`avaGeneratorQualityBtn ${imageQuality === option.value ? 'isActive' : ''}`}
                      onClick={() => setImageQuality(option.value)}
                      disabled={generatorActionLocked || generatorCanceling}
                    >
                      <strong>{option.label}</strong>
                      <small>{option.hint}</small>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              tariffError ? <em title={tariffError}>тариф fallback</em> : <em>тариф доски</em>
            )}
          </div>

          {montageConfirmOpen && typeof document !== 'undefined' ? createPortal((
                  <div
                    className={`avaGeneratorConfirmOverlay isPortalV169A ${montageConfirmBusy ? 'isBusyV169A' : ''}`}
                    role="presentation"
                    onMouseDown={() => {
                      if (!montageConfirmBusy) cancelVideoMontageHandoff()
                    }}
                  >
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
                        Будет передано <strong>{Math.min(10, generatedVideoItems.length)}</strong> видео из нижней ленты.
                        Текущий монтажник и Board snapshot будут очищены и заменены этими видео.
                      </p>

                      {montageConfirmBusy ? (
                        <div className="avaGeneratorMontageProgressV169A" aria-live="polite">
                          <span className="avaGeneratorMontageSpinnerV169A" aria-hidden="true" />
                          <div>
                            <strong>Готовлю переход в монтажник</strong>
                            <small>Сохраняю видео из ленты, очищаю старый монтаж и открываю Assembly...</small>
                          </div>
                          <div className="avaGeneratorMontageProgressBarV169A"><i /></div>
                        </div>
                      ) : null}

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
                ), document.body) : null}

      {routeInfo.kind !== 'image' && generatedVideoItems.length ? (
            <div className="avaGeneratorToMontageBox">
              <div>
                <span>VIDEO MONTAGE</span>
                <strong>Собрать монтаж из ленты</strong>
                <p>Передаст {generatedVideoItems.length} видео в монтажник в порядке ленты.</p>
              </div>
              <button type="button" onClick={goToVideoMontageFromGenerator}>
                Перейти в видео монтаж
              </button>
            </div>
          ) : null}

          <div className="avaGeneratorActions">
            <button className="avaGeneratorPrimary" onClick={submitGeneration} disabled={generatorActionLocked || generatorCanceling || !routeInfo.endpoint}>
              {generatorActionLocked ? 'Генерация...' : '▶ Сгенерировать'}
            </button>
            {routeInfo.needsStart ? (
              <button
                type="button"
                className="avaGeneratorSecondary avaGeneratorFrameQuickAction"
                onClick={takeLastFrameFromPreviousVideo}
                disabled={frameExtractBusy || busy || !previousVideoForFrame}
                title={previousVideoForFrame ? 'Взять последний кадр из последнего/выбранного видео в ленте' : 'Сначала сгенерируй видео'}
              >
                {frameExtractBusy ? '⏳ Кадр...' : '↳ Кадр из ленты'}
              </button>
            ) : null}
            {(busy || job?.jobId || job?.job_id) ? (
              <button className="avaGeneratorSecondary" onClick={cancelGeneration} disabled={cancelGenerationBusy}>
                {cancelGenerationBusy ? 'Отменяю...' : 'Отменить генерацию'}
              </button>
            ) : null}
            <button className="avaGeneratorGhost" onClick={clearDraft}>Очистить</button>
          </div>

          {error ? <div className="avaGeneratorError">{error}</div> : null}
          <div className="avaGeneratorStatus">Статус: <strong>{statusText}</strong></div>
        </div>

        <div className={`avaGeneratorPanel avaGeneratorMediaPanel ${routeInfo.kind === 'image' ? 'isImageMode' : ''}`}>
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
                <input type="file" accept="audio/*,video/mp4,video/quicktime,.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm,.mp4,.mov" onChange={(event) => handleAudioFile(event.target.files?.[0])} />
                <span>Аудио для lip-sync</span>
                <strong title={audioName || ''}>{audioName || 'загрузить аудио'}</strong>
                {audioDurationSec > 0 ? <em>{formatSec(audioDurationSec)}</em> : null}
              </label>
            ) : null}
</div>

          <div className="avaGeneratorStageGrid">
            <div className="avaGeneratorThumbsCol">
              <button type="button" className="avaGeneratorThumbCard avaGeneratorThumbInteractive" onClick={() => openZoom(startThumbUrl, startFile?.name || 'Start image')} disabled={!startThumbUrl || startPreviewIsLoading}>
                <div className="avaGeneratorThumbPreview">
                  {startPreviewIsLoading ? (
                    <span
                      className="avaGeneratorInputThumbLoadingV7"
                      aria-label="Загрузка стартового кадра"
                      title="Загрузка стартового кадра"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        height: '100%',
                        minHeight: 120,
                      }}
                    >
                      <i
                        className="avaGeneratorMmaudioHeaderSpinner"
                        aria-hidden="true"
                        style={{ width: 24, height: 24, flex: '0 0 24px' }}
                      />
                    </span>
                  ) : startThumbUrl ? (
                    <>
                      <img src={startThumbUrl} alt="start" />
                      <div className="avaGeneratorZoomOverlay"><span>⌕</span><em>Увеличить</em></div>
                    </>
                  ) : <span>start</span>}
                </div>
                <div className="avaGeneratorThumbMeta">
                  <strong>Start</strong>
                  <span title={startFile?.name || ''}>{startFile?.name || (startPreviewIsLoading ? 'загружаем кадр...' : (startThumbUrl ? 'кадр из ленты' : 'Нет изображения'))}</span>
                </div>
              </button>

              {routeInfo.needsEnd ? (
                <button type="button" className="avaGeneratorThumbCard avaGeneratorThumbInteractive" onClick={() => openZoom(endThumbUrl, endFile?.name || 'End image')} disabled={!endThumbUrl || endPreviewIsLoading}>
                  <div className="avaGeneratorThumbPreview">
                    {endPreviewIsLoading ? (
                      <span
                        className="avaGeneratorInputThumbLoadingV7"
                        aria-label="Загрузка финального кадра"
                        title="Загрузка финального кадра"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '100%',
                          height: '100%',
                          minHeight: 120,
                        }}
                      >
                        <i
                          className="avaGeneratorMmaudioHeaderSpinner"
                          aria-hidden="true"
                          style={{ width: 24, height: 24, flex: '0 0 24px' }}
                        />
                      </span>
                    ) : endThumbUrl ? (
                      <>
                        <img src={endThumbUrl} alt="end" />
                        <div className="avaGeneratorZoomOverlay"><span>⌕</span><em>Увеличить</em></div>
                      </>
                    ) : <span>end</span>}
                  </div>
                  <div className="avaGeneratorThumbMeta">
                    <strong>End</strong>
                    <span title={endFile?.name || ''}>{endFile?.name || (endPreviewIsLoading ? 'загружаем кадр...' : (endThumbUrl ? 'кадр из ленты' : 'Нет финального кадра'))}</span>
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
                {generatorSnapshotLoading ? (
                  <div className="avaGeneratorCanvasState isBusy">
                    <div className="avaGeneratorSpinner" />
                    <strong>Загружаем проект</strong>
                    <span>Восстанавливаем ленту, медиа и активные задачи из project snapshot.</span>
                  </div>
                ) : busy ? (
                  <div className="avaGeneratorCanvasState isBusy">
                    <div className="avaGeneratorSpinner" />
                    <strong>Идёт генерация</strong>
                    <span>{statusText || 'running'}</span>

                  </div>
                ) : displayedResultUrl && displayedResultIsImage && displayedResultPreviewUrl ? (
                  <div className="avaGeneratorImageResultWrap">
                    <button type="button" className="avaGeneratorImageResultButton" onClick={() => openZoom(displayedResultPreviewUrl || displayedResultUrl, 'Generated image')}>
                      <img className="avaGeneratorResultImage" src={displayedResultPreviewUrl || displayedResultUrl} alt="generated result" />
                      <div className="avaGeneratorZoomOverlay"><span>⌕</span><em>Увеличить</em></div>
                    </button>
                    <button
                      type="button"
                      className="avaGeneratorImageDownloadBtn"
                      onClick={(event) => downloadGeneratedImage(event, displayedResultUrl)}
                      title="Скачать изображение"
                    >
                      ⇩
                    </button>
                  </div>
                ) : displayedResultUrl && displayedResultIsProtectedAsset && !displayedResultPreviewUrl ? (
                  <div className="avaGeneratorCanvasState isBusy">
                    <div className="avaGeneratorSpinner" />
                    <strong>Подгружаем видео</strong>
                    <span>Готовим защищённый asset-preview с авторизацией.</span>
                  </div>
                ) : displayedResultUrl && !isBlockedGeneratorPreviewUrl(displayedResultUrl) ? (
                  <video className="avaGeneratorVideo" src={displayedResultPreviewUrl || generatorPreviewUrl(displayedResultUrl)} controls playsInline preload="metadata" />
                ) : displayedResultUrl && isBlockedGeneratorPreviewUrl(displayedResultUrl) ? (
                  <div className="avaGeneratorCanvasState isPlaceholder">
                    <strong>Старый static-result заблокирован</strong>
                    <span>Очисти старый результат и сгенерируй новое видео. Прямой localhost/static preview отключён.</span>
                  </div>
                ) : routeInfo.kind === 'image' ? (
                  <div className="avaGeneratorCanvasState isPlaceholder">
                    <strong>Картинка по описанию</strong>
                    <span>Напиши prompt и отправь. Стандарт 16:9 — 2304×1296.</span>
                  </div>
                ) : (
                  <div className="avaGeneratorCanvasState">
                    <strong>Результат появится здесь</strong>
                    <span>Когда генерация запустится, процесс и итог будут видны в этом поле.</span>
                  </div>
                )}
                  {mmaudioBusy ? (
                    <div className="avaGeneratorMmaudioCanvasOverlay" role="status" aria-live="polite">
                      <div className="avaGeneratorMmaudioCanvasSpinner" />
                      <strong>Генерация звука</strong>
                      <span>{mmaudioStatus || 'preparing'}</span>
                    </div>
                  ) : null}
              </div>

              {canUseMmaudio ? (
                <div className={`avaGeneratorMmaudioPanel ${mmaudioOpen ? 'isOpen' : ''}`}>
                  <button type="button" className="avaGeneratorMmaudioToggle" onClick={() => setMmaudioOpen((value) => !value)}>
                    <span>✨ MMAudio / добавить звук · {formatCreditCost(mmaudioCreditCost)}</span>
                    <em className={mmaudioBusy ? 'isBusy' : ''}>
                      {mmaudioBusy ? <i className="avaGeneratorMmaudioHeaderSpinner" aria-hidden="true" /> : null}
                      {mmaudioBusy ? `генерация звука идёт... ${mmaudioStatus || ''}` : mmaudioResultUrl ? 'звук готов' : 'открыть настройки'}
                    </em>
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
                        <button type="button" className="avaGeneratorMmaudioSend" onClick={submitMmaudio} disabled={mmaudioBusy || !resultUrl}>
                          {mmaudioBusy ? `Ждём: ${mmaudioStatus || 'preparing'}` : mmaudioResultUrl ? '⚡ Перегенерировать звук' : '⚡ Отправить в MMAudio'}
                        </button>
                        {mmaudioResultUrl ? <span className="avaGeneratorMmaudioReady">результат вернулся в preview</span> : null}
                      </div>
                       {mmaudioBusy ? (
                          <div className="avaGeneratorMmaudioProgress" role="status" aria-live="polite">
                            <span className="avaGeneratorMmaudioSpinner" />
                            <div>
                              <strong>Генерация звука идёт...</strong>
                              <em>{mmaudioStatus || 'preparing'}</em>
                            </div>
                          </div>
                        ) : null}
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
    
      {generatorSnapshotLoading && !generatedVideos.length ? (
        <section className="avaGeneratorHistoryPanel">
          <div className="avaGeneratorHistoryHeader">
            <div>
              <p>RECENT RESULTS</p>
              <h2>Загружаем ленту проекта…</h2>
            </div>
          </div>
          <div className="avaGeneratorCanvasState isBusy" style={{ minHeight: 120 }}>
            <div className="avaGeneratorSpinner" />
            <strong>Синхронизируем gallery</strong>
            <span>Берём результаты из backend project snapshot, не из localStorage.</span>
          </div>
        </section>
      ) : generatedVideos.length ? (
<section className="avaGeneratorHistoryPanel">
          <div className="avaGeneratorHistoryHeader">
            <div>
              <p>RECENT RESULTS</p>
              <h2>Последние результаты</h2>
            </div>

          </div>
          {historyIsOverLimit ? (
            <div className="avaGeneratorHistoryLimitNotice" role="alert">
              <div className="avaGeneratorHistoryLimitIcon">!</div>
              <div className="avaGeneratorHistoryLimitBody">
                <strong>Лимит ленты превышен</strong>
                <p>
                  В ленте сейчас <b>{visibleHistoryItems.length}</b> файлов. Лимит — <b>{historyLimit}</b>.
                  Удалите <b>{historyOverflowCount}</b> лишн. файл{historyOverflowCount === 1 ? '' : 'а'}, чтобы лента снова была чистой.
                </p>
                <div className="avaGeneratorHistoryLimitStats">
                  <span>Фото <b>{historyImageCount}</b></span>
                  <span>Видео <b>{historyVideoCount}</b></span>
                  <span>Всего <b>{visibleHistoryItems.length}/{historyLimit}</b></span>
                </div>
              </div>
            </div>
          ) : null}

          <div className="avaGeneratorHistoryScroller">
            {visibleHistoryItems.map((item, index) => (
              <article
                key={item.id}
                className={`avaGeneratorHistoryCard ${normalizeUrl(displayedResultUrl || '') === normalizeUrl(item.url || '') ? 'isActive' : ''}`}
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
                  {item.kind === 'image' ? (
                    generatorHistoryPreviewNode(item)
                  ) : (
                    <>
                      {generatorHistoryPreviewNode(item)}
                      <div className="avaGeneratorHistoryPlay">▶</div>
                    </>
                  )}
                </div>

                <div className="avaGeneratorHistoryMeta">
                  <strong>{item.label || 'Видео'} #{index + 1}</strong>
                  <span>{item.kind === 'image' ? 'картинка' : item.kind === 'mmaudio' ? 'со звуком' : 'видео'} · {formatGeneratorGalleryTime(item.createdAt)}</span>
                  {item.kind === 'image' ? (
                    <div className="avaGeneratorHistoryImageActions">
                      <button
                        type="button"
                        className="avaGeneratorHistoryImagePlus"
                        onClick={(event) => {
                          event.stopPropagation()
                          setImageActionMenuId((oldId) => oldId === item.id ? '' : item.id)
                        }}
                        title="Использовать картинку как кадр"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="avaGeneratorHistoryImageDownload"
                        onClick={(event) => downloadGeneratedImage(event, item.url || '')}
                        title="Скачать картинку"
                      >
                        ⇩
                      </button>
                      {imageActionMenuId === item.id ? (
                        <div className="avaGeneratorHistoryImageMenu" onClick={(event) => event.stopPropagation()}>
                          <button type="button" onClick={(event) => useImageResultAsFrame(event, item, 'start')}>В 1-й кадр</button>
                          <button type="button" onClick={(event) => useImageResultAsFrame(event, item, 'end')}>Во 2-й кадр</button>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="avaGeneratorHistoryUseFrame"
                      onClick={(event) => { event.stopPropagation(); takeLastFrameFromPreviousVideo(item.url || '') }}
                      disabled={frameExtractBusy || busy}
                      title="Поставить последний кадр этого видео в Start"
                    >
                      ↳ кадр в Start
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

</main>
  )
}
