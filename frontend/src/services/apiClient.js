const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, '')
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '')

export function getApiBaseUrl() {
  return API_BASE_URL
}

export function getApiOrigin() {
  return API_ORIGIN
}

export function normalizeAssetFileUrl(value = '') {
  const raw = String(value || '').trim()
  if (!raw) return { url: '', assetId: '', apiPath: '' }

  let pathname = raw
  let search = ''
  let hash = ''
  let isLocalhostAssetUrl = false

  try {
    const parsed = new URL(raw, typeof window !== 'undefined' ? window.location.origin : API_ORIGIN)
    pathname = parsed.pathname || raw
    search = parsed.search || ''
    hash = parsed.hash || ''
    isLocalhostAssetUrl = ['localhost', '127.0.0.1'].includes(String(parsed.hostname || '').toLowerCase())
  } catch {
    pathname = raw.split('?')[0].split('#')[0]
  }

  const match = pathname.match(/\/(?:api\/)?assets\/([^/]+)\/file/i)
  const assetId = match?.[1] ? decodeURIComponent(match[1]) : ''
  if (!assetId) return { url: raw, assetId: '', apiPath: '' }

  const apiPath = pathname.startsWith('/api/assets/') ? pathname.slice(4) : pathname.startsWith('/assets/') ? pathname : ''
  let url = raw
  if (raw.startsWith('/') || isLocalhostAssetUrl) {
    const nextPath = pathname.startsWith('/api/assets/') ? pathname : `/api${pathname}`
    url = `${API_ORIGIN}${nextPath}${search}${hash}`
  }

  if (url !== raw) {
    console.log('[AUDIO ASSET URL NORMALIZED]', { from: raw, to: url, assetId })
  }
  if (assetId) {
    console.log('[AUDIO ASSET RESTORE]', { assetId, apiPath, url })
  }

  return { url, assetId, apiPath }
}

export function normalizeStaticMediaUrl(value = '') {
  const raw = String(value || '').trim()
  if (!raw) return ''

  try {
    const parsed = new URL(raw, typeof window !== 'undefined' ? window.location.origin : API_ORIGIN)
    const pathname = parsed.pathname || ''
    if (!pathname.startsWith('/static/assets/')) return raw
    const isLocalhost = ['localhost', '127.0.0.1'].includes(String(parsed.hostname || '').toLowerCase())
    if (raw.startsWith('/static/assets/') || isLocalhost) {
      const normalized = `${API_ORIGIN}${pathname}${parsed.search || ''}${parsed.hash || ''}`
      if (normalized !== raw) console.log('[AUDIO SOURCE NORMALIZED BEFORE FETCH]', { from: raw, to: normalized })
      return normalized
    }
    return raw
  } catch {
    if (raw.startsWith('/static/assets/')) {
      const normalized = `${API_ORIGIN}${raw}`
      console.log('[AUDIO SOURCE NORMALIZED BEFORE FETCH]', { from: raw, to: normalized })
      return normalized
    }
    return raw
  }
}

export function buildApiUrl(path = '') {
  const raw = String(path || '').trim()
  if (!raw) return API_BASE_URL
  const assetUrl = normalizeAssetFileUrl(raw)
  if (assetUrl.assetId && assetUrl.url) return assetUrl.url
  const staticUrl = normalizeStaticMediaUrl(raw)
  if (staticUrl && staticUrl !== raw) return staticUrl
  if (/^(https?:|blob:|data:)/i.test(raw)) return raw
  if (raw.startsWith('/api/')) return `${API_ORIGIN}${raw}`
  if (raw.startsWith('/static/')) return `${API_ORIGIN}${raw}`
  if (raw.startsWith('/assets/')) return `${API_BASE_URL}${raw}`
  if (raw.startsWith('/')) return `${API_BASE_URL}${raw}`
  return `${API_BASE_URL}/${raw}`
}

function getToken() {
  return localStorage.getItem('ava_token')
}

function extractApiCreditBalance(value) {
  if (!value || typeof value !== 'object') return null

  for (const key of ['balance', 'creditBalance', 'credit_balance', 'credits_balance', 'credits', 'amount']) {
    const raw = value?.[key]
    if (raw === 0 || raw) {
      const numberValue = Number(raw)
      if (Number.isFinite(numberValue)) return numberValue
    }
  }

  if (value.user && typeof value.user === 'object') return extractApiCreditBalance(value.user)
  if (value.creditChargeResult && typeof value.creditChargeResult === 'object') return extractApiCreditBalance(value.creditChargeResult)
  return null
}

function notifyApiCreditBalance(payload, source = '') {
  if (typeof window === 'undefined') return

  const balance = extractApiCreditBalance(payload)
  if (balance === null) return

  window.dispatchEvent(new CustomEvent('ava:credits-updated', {
    detail: {
      balance,
      credits_balance: balance,
      creditBalance: balance,
      source,
      summary: payload,
    },
  }))
}

export function getAuthHeaders(extraHeaders = {}) {
  const token = getToken()
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  }
}

export async function apiRequest(path, options = {}) {
  const isFormData = options.body instanceof FormData
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers,
  })

  const text = await response.text()
  const data = text ? JSON.parse(text) : null

  if (!response.ok) {
    const message = data?.detail || data?.message || `API error ${response.status}`
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message))
  }

  if (data?.user && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ava:user-updated', { detail: data.user }))
  }

  if (
    typeof window !== 'undefined'
    && (
      String(path || '').includes('/credits/summary')
      || data?.creditBalance !== undefined
      || data?.credit_balance !== undefined
      || data?.credits_balance !== undefined
      || data?.creditCharged !== undefined
      || data?.creditChargeResult !== undefined
    )
  ) {
    notifyApiCreditBalance(data, path)
  }

  return data
}

function makeClientRequestId(prefix = 'req') {
  const randomId = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`
  return `${prefix}_${randomId}`
}

export async function uploadAudioAsset({ file, projectId = null, stage = 'manual_timing' }) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('stage', stage)
  if (projectId) formData.append('project_id', projectId)
  return apiRequest('/assets/audio', {
    method: 'POST',
    body: formData,
  })
}

export async function uploadMediaAsset({ file, projectId = null, kind = 'image', stage = 'board_images' }) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('kind', kind)
  formData.append('stage', stage)
  if (projectId) formData.append('project_id', projectId)
  return apiRequest('/assets/media', {
    method: 'POST',
    body: formData,
  })
}

export async function registerStaticMediaAsset({
  url = '',
  projectId = null,
  kind = 'video',
  stage = 'board',
  originalName = '',
  sceneId = '',
} = {}) {
  const normalizedUrl = normalizeStaticMediaUrl(url)
  if (!normalizedUrl || normalizedUrl === url && !String(url || '').includes('/static/assets/')) {
    throw new Error('Only /static/assets media can be registered')
  }
  return apiRequest('/assets/register-static', {
    method: 'POST',
    body: JSON.stringify({
      url: normalizedUrl,
      project_id: projectId,
      projectId,
      kind,
      stage,
      original_name: originalName,
      originalName,
      scene_id: sceneId,
      sceneId,
    }),
  })
}

export async function fetchProtectedBlobUrl(apiPath) {
  if (!apiPath) return ''
  const assetUrl = normalizeAssetFileUrl(apiPath)
  const response = await fetch(buildApiUrl(assetUrl.apiPath || assetUrl.url || apiPath), {
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    let message = `API error ${response.status}`
    try {
      const data = await response.json()
      message = data?.detail || data?.message || message
    } catch (error) {
      // keep default message
    }
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message))
  }
  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

export async function transcribeAudioAsset({ assetId, projectId = null, language = '', roleId = 'narrator', roleLabel = 'ДИК', mode = 'speech', vadFilter = null }) {
  return apiRequest('/asr/transcribe', {
    method: 'POST',
    body: JSON.stringify({
      asset_id: assetId,
      project_id: projectId,
      client_request_id: makeClientRequestId('asr'),
      language,
      role_id: roleId,
      role_label: roleLabel,
      mode,
      vad_filter: vadFilter,
    }),
  })
}

export async function translateAsrSegments({ speechSegments = [], audioPhrases = [], sourceLanguage = '', targetLanguage = 'ru', projectId = null }) {
  return apiRequest('/asr/translate', {
    method: 'POST',
    body: JSON.stringify({
      speech_segments: speechSegments,
      audio_phrases: audioPhrases,
      project_id: projectId,
      client_request_id: makeClientRequestId('translate'),
      source_language: sourceLanguage,
      target_language: targetLanguage,
      include_meaning: true,
    }),
  })
}



export async function cutAudioAssetRange({
  assetId,
  assetApiPath = '',
  audioUrl = '',
  projectId = null,
  stage = 'manual_timing',
  startSec,
  endSec,
  durationSec,
  label = '',
}) {
  const assetUrl = normalizeAssetFileUrl(audioUrl || assetApiPath || assetId || '')
  const repairedAssetId = assetId || assetUrl.assetId
  const repairedAssetApiPath = assetApiPath || assetUrl.apiPath
  const repairedAudioUrl = assetUrl.url || audioUrl
  if (!repairedAssetId) {
    console.warn('[AUDIO CUT BLOCKED MISSING_ASSET_ID]', { assetId, assetApiPath, audioUrl })
    throw new Error('Missing audio asset_id')
  }
  console.log('[AUDIO CUT REQUEST]', { asset_id: repairedAssetId, asset_api_path: repairedAssetApiPath })
  return apiRequest('/assets/audio/cut-range', {
    method: 'POST',
    body: JSON.stringify({
      asset_id: repairedAssetId,
      assetId: repairedAssetId,
      asset_api_path: repairedAssetApiPath,
      assetApiPath: repairedAssetApiPath,
      audio_url: repairedAudioUrl,
      audioUrl: repairedAudioUrl,
      project_id: projectId,
      projectId,
      stage,
      start_sec: startSec,
      startSec,
      end_sec: endSec,
      endSec,
      duration_sec: durationSec,
      durationSec,
      label,
    }),
  })
}
