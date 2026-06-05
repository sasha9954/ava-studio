import { useCallback, useEffect, useRef, useState } from 'react'
import './GlobalJobNotifier.css'
import {
  getGlobalJobs,
  isDoneStatus,
  isFailedStatus,
  markGlobalJobNotified,
  pickVideoUrl,
  upsertGlobalJob,
} from '../services/generatorJobs'
import { buildApiUrl } from '../services/api.js'

const GLOBAL_JOB_TOAST_AUTO_HIDE_MS = 5000

function authHeaders(extra = {}) {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('ava_token') : ''
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

function normalizeUrl(value) {
  const s = String(value || '').trim()
  if (!s) return ''
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('blob:') || s.startsWith('data:')) return s
  if (s.startsWith('/')) return buildApiUrl(s)
  return s
}

function generatorProjectIdFromPath(path = '') {
  const value = String(path || (typeof window !== 'undefined' ? window.location.pathname : '') || '')
  const match = value.match(/\/app\/projects\/([^/]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : ''
}

function normalizeGlobalJobPagePath(job = {}) {
  const rawPagePath = String(job.pagePath || '')
  const projectId = String(job.projectId || generatorProjectIdFromPath(rawPagePath) || generatorProjectIdFromPath()).trim()

  if (rawPagePath.startsWith('/app/projects/')) return rawPagePath
  if (projectId) return `/app/projects/${projectId}/generator`
  return rawPagePath || '/app/workspace/generator'
}

async function fetchJson(path) {
  const url = buildApiUrl(path)
  const response = await fetch(url, { headers: authHeaders() })
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
  return data || {}
}

export default function GlobalJobNotifier() {
  const [toasts, setToasts] = useState([])
  const pollingRef = useRef(null)
  const toastTimersRef = useRef(new Map())

  const pushToast = useCallback((job) => {
    if (!job?.id) return
    markGlobalJobNotified(job.id)

    if (toastTimersRef.current.has(job.id)) {
      window.clearTimeout(toastTimersRef.current.get(job.id))
    }
    toastTimersRef.current.set(job.id, window.setTimeout(() => {
      markGlobalJobNotified(job.id)
      setToasts((old) => old.filter((toast) => toast.id !== job.id))
      toastTimersRef.current.delete(job.id)
    }, GLOBAL_JOB_TOAST_AUTO_HIDE_MS))

    setToasts((old) => {
      if (old.some((item) => item.id === job.id)) return old
      return [
        ...old,
        {
          id: job.id,
          title: job.toastTitle || 'Готово',
          message: job.toastMessage || 'Генерация завершена. Можно перейти к результату.',
          pagePath: normalizeGlobalJobPagePath(job),
        },
      ].slice(-4)
    })
  }, [])

  const pollOnce = useCallback(async () => {
    const activeJobs = getGlobalJobs().filter((job) => {
      if (!job?.id || !job?.statusEndpoint) return false
      if (job.notified) return false
      if (job.status === 'failed') return false
      return true
    })

    for (const job of activeJobs) {
      try {
        const data = await fetchJson(job.statusEndpoint)
        const status = data.status || data.video_status || data.audio_status || job.status || 'running'
        const resultUrl = normalizeUrl(pickVideoUrl(data) || job.resultUrl || '')
        const done = isDoneStatus(status) || !!resultUrl
        const failed = isFailedStatus(status)

        const updated = upsertGlobalJob({
          ...job,
          status: done ? 'done' : failed ? 'failed' : status,
          rawStatus: status,
          resultUrl,
          response: data,
        })

        if (done && updated && !job.notified) {
          pushToast(updated)
        }
      } catch (error) {
        upsertGlobalJob({
          ...job,
          lastError: String(error?.message || error),
          status: job.status || 'running',
        })
      }
    }
  }, [pushToast])

  useEffect(() => {
    const onStorage = () => pollOnce()
    const onJobsChanged = () => pollOnce()

    window.addEventListener('storage', onStorage)
    window.addEventListener('ava:global-jobs-changed', onJobsChanged)

    pollOnce()
    pollingRef.current = window.setInterval(pollOnce, 2500)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('ava:global-jobs-changed', onJobsChanged)
      if (pollingRef.current) window.clearInterval(pollingRef.current)
      toastTimersRef.current.forEach((timer) => window.clearTimeout(timer))
      toastTimersRef.current.clear()
    }
  }, [pollOnce])

  // PATCH_07AW_AUTO_HIDE_TOASTS: auto close ready notifications after 5 seconds.
  useEffect(() => {
    if (!toasts.length) return undefined

    const timers = toasts.map((toast) => window.setTimeout(() => {
      markGlobalJobNotified(toast.id)
      setToasts((old) => old.filter((item) => item.id !== toast.id))
    }, GLOBAL_JOB_TOAST_AUTO_HIDE_MS))

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [toasts])

  const closeToast = useCallback((id) => {
    markGlobalJobNotified(id)
    if (toastTimersRef.current.has(id)) {
      window.clearTimeout(toastTimersRef.current.get(id))
      toastTimersRef.current.delete(id)
    }
    setToasts((old) => old.filter((toast) => toast.id !== id))
  }, [])

  const goToToast = useCallback((toast) => {
    markGlobalJobNotified(toast.id)
    if (toastTimersRef.current.has(toast.id)) {
      window.clearTimeout(toastTimersRef.current.get(toast.id))
      toastTimersRef.current.delete(toast.id)
    }
    setToasts((old) => old.filter((item) => item.id !== toast.id))
    const path = toast.pagePath || '/app/workspace/generator'
    if (window.location.pathname !== path) window.location.href = path
  }, [])

  if (!toasts.length) return null

  return (
    <div className="avaGlobalJobToasts">
      {toasts.map((toast) => (
        <div className="avaGlobalJobToast" key={toast.id}>
          <div className="avaGlobalJobToastIcon">✓</div>
          <div className="avaGlobalJobToastText">
            <strong>{toast.title}</strong>
            <span>{toast.message}</span>
          </div>
          <div className="avaGlobalJobToastActions">
            <button type="button" onClick={() => goToToast(toast)}>Перейти</button>
            <button type="button" className="isGhost" onClick={() => closeToast(toast.id)}>×</button>
          </div>
        </div>
      ))}
    </div>
  )
}
