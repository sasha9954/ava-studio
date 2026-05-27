const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

export function getApiBaseUrl() {
  return API_BASE_URL
}

function getToken() {
  return localStorage.getItem('ava_token')
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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  const text = await response.text()
  const data = text ? JSON.parse(text) : null

  if (!response.ok) {
    const message = data?.detail || data?.message || `API error ${response.status}`
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message))
  }
  return data
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

export async function fetchProtectedBlobUrl(apiPath) {
  if (!apiPath) return ''
  const response = await fetch(`${API_BASE_URL}${apiPath}`, {
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

export async function transcribeAudioAsset({ assetId, language = '', roleId = 'narrator', roleLabel = 'ДИК', mode = 'speech', vadFilter = null }) {
  return apiRequest('/asr/transcribe', {
    method: 'POST',
    body: JSON.stringify({
      asset_id: assetId,
      language,
      role_id: roleId,
      role_label: roleLabel,
      mode,
      vad_filter: vadFilter,
    }),
  })
}
