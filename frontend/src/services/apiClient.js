const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

export function getApiBaseUrl() {
  return API_BASE_URL
}

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('ava_token')
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
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
