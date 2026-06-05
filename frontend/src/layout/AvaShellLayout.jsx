import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, FolderKanban, Home, LogOut, PlusCircle, Settings, UserRound, WalletCards } from 'lucide-react'
import avaLogoUrl from '../assets/ava_logo.jpg'
import { useAuth } from '../context/AuthContext.jsx'
import { useProjects } from '../context/ProjectContext.jsx'
import { getProjectTheme } from '../utils/projectTheme.js'
import { apiRequest } from '../services/apiClient.js'
import GlobalJobNotifier from '../components/GlobalJobNotifier.jsx'

const navItems = [
  { to: '/app/dashboard', label: 'Главная', icon: Home },
  { to: '/app/projects', label: 'Мои проекты', icon: FolderKanban },
  { to: '/app/projects/new', label: 'Создать проект', icon: PlusCircle },
  { to: '/app/account', label: 'Кабинет', icon: UserRound },
  { to: '/app/credits', label: 'Пополнить счёт', icon: WalletCards },
]

const SIDEBAR_OPEN_KEY = 'ava_sidebar_open'
const AVA_GLOBAL_JOBS_KEY = 'ava:active-jobs:v1'
const AVA_COMPLETED_JOBS_KEY = 'ava:completed-jobs:v1'
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

function avaCompletedJobAlreadyRemembered(key = '') {
  const cleanKey = String(key || '').trim()
  if (!cleanKey) return false
  return readAvaCompletedJobs().some((saved) => String(saved?.key || '').trim() === cleanKey)
}

function rememberCompletedAvaJob(job = {}, data = {}) {
  const key = job.key || `${job.kind || 'job'}:${job.jobId || job.statusEndpoint || Date.now()}`
  const item = {
    key,
    kind: job.kind || 'video',
    sceneId: job.sceneId || '',
    projectId: job.projectId || '',
    workspaceMode: Boolean(job.workspaceMode),
    statusEndpoint: job.statusEndpoint || '',
    jobId: job.jobId || '',
    to: job.to || '',
    pagePath: job.pagePath || job.to || '',
    stage: job.stage || avaStageFromPath(job.to || job.pagePath || '') || 'board',
    data,
    completedAt: new Date().toISOString(),
  }

  const jobs = readAvaCompletedJobs().filter((saved) => saved.key !== key)
  writeAvaCompletedJobs([...jobs, item].slice(-30))
}

function normalizeAvaEndpoint(endpoint) {
  const value = String(endpoint || '')
  return value.startsWith('/api/') ? value.slice(4) : value
}

function avaProjectIdFromPath(path = '') {
  const value = String(path || (typeof window !== 'undefined' ? window.location.pathname : '') || '')
  const match = value.match(/\/app\/projects\/([^/]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : ''
}

function avaStageFromPath(path = '') {
  const value = String(path || '')
  if (value.includes('/board-assembly')) return 'board-assembly'
  if (value.includes('/generator')) return 'generator'
  if (value.includes('/video-node') || value.includes('/video-match-board')) return 'video-node'
  if (value.includes('/podcast')) return 'podcast'
  if (value.includes('/timing')) return 'timing'
  if (value.includes('/board')) return 'board'
  return ''
}

function avaStageRoute(stage = '') {
  const normalized = String(stage || '').replace(/_/g, '-')
  if (normalized === 'board-assembly') return 'board-assembly'
  if (normalized === 'standalone-generator') return 'generator'
  if (normalized === 'video-node' || normalized === 'video-match-board') return 'video-node'
  if (normalized === 'podcast') return 'podcast'
  if (normalized === 'manual-timing' || normalized === 'timing') return 'timing'
  return 'board'
}

function avaToastDestination({ to = '', projectId = '', stage = '' } = {}) {
  const explicitTo = String(to || '').trim()
  const explicitProjectId = String(projectId || avaProjectIdFromPath(explicitTo) || avaProjectIdFromPath()).trim()
  const targetStage = avaStageRoute(stage || avaStageFromPath(explicitTo) || 'board')

  if (explicitTo.startsWith('/app/projects/')) return explicitTo

  if (explicitProjectId) {
    return `/app/projects/${explicitProjectId}/${targetStage}`
  }

  if (explicitTo.startsWith('/app/workspace/')) return explicitTo
  return `/app/workspace/${targetStage}`
}

function avaAssetIdFromRef(...values) {
  for (const value of values) {
    const raw = String(value || '').trim()
    if (!raw) continue
    if (raw.startsWith('asset_')) return raw
    const match = raw.match(/\/(?:api\/)?assets\/([^/]+)\/file/i)
    if (match?.[1]) return decodeURIComponent(match[1])
  }
  return ''
}

function avaAssetApiPath(assetId = '') {
  const safeAssetId = String(assetId || '').trim()
  return safeAssetId ? `/assets/${safeAssetId}/file` : ''
}

function avaJobVideoUrl(kind, data) {
  if (kind === 'mmaudio') {
    const assetId = avaAssetIdFromRef(
      data?.mmaudioVideoAssetId,
      data?.mmaudio_video_asset_id,
      data?.assetId,
      data?.asset_id,
      data?.mmaudioVideoApiPath,
      data?.mmaudio_video_api_path,
      data?.videoApiPath,
      data?.video_api_path,
      data?.mmaudioVideoUrl,
      data?.mmaudio_video_url
    )
    return avaAssetApiPath(assetId) || data?.mmaudioVideoApiPath || data?.mmaudio_video_api_path || data?.videoApiPath || data?.video_api_path || data?.mmaudioVideoUrl || data?.mmaudio_video_url || data?.videoUrl || data?.video_url || ''
  }
  const assetId = avaAssetIdFromRef(
    data?.videoAssetId,
    data?.video_asset_id,
    data?.assetId,
    data?.asset_id,
    data?.videoApiPath,
    data?.video_api_path,
    data?.resultVideoApiPath,
    data?.result_video_api_path,
    data?.videoUrl,
    data?.video_url
  )
  return avaAssetApiPath(assetId) || data?.videoApiPath || data?.video_api_path || data?.resultVideoApiPath || data?.result_video_api_path || data?.videoUrl || data?.video_url || data?.resultVideoUrl || data?.result_video_url || ''
}

function avaJobIsError(status) {
  const normalized = String(status || '').toLowerCase()
  return normalized.startsWith('blocked_') || ['error', 'failed', 'queued_no_prompt_id', 'output_download_failed', 'output_finalize_failed', 'completed_without_video_output'].includes(normalized)
}

function avaJobIsStale(status, data = {}) {
  const normalized = String(status || '').toLowerCase()
  const code = String(data?.code || data?.error?.code || '').toUpperCase()
  return normalized === 'not_found' || code === 'BOARD_VIDEO_JOB_NOT_FOUND' || code === 'BOARD_MMAUDIO_JOB_NOT_FOUND'
}


function boardSnapshotEndpointForJob(job = {}) {
  const explicitProjectId = job.projectId || ''
  if (explicitProjectId) return `/projects/${explicitProjectId}/snapshots/board`

  const path = String(job.to || '')
  const match = path.match(/\/app\/projects\/([^/]+)\/board/)
  if (match?.[1]) return `/projects/${match[1]}/snapshots/board`

  return '/workspace/snapshots/board'
}

function videoPatchFromJobData(data = {}, job = {}) {
  const assetId = avaAssetIdFromRef(data?.videoAssetId, data?.video_asset_id, data?.assetId, data?.asset_id, data?.videoApiPath, data?.video_api_path, data?.videoUrl, data?.video_url)
  const assetApiPath = avaAssetApiPath(assetId)
  const videoUrl = assetApiPath || data?.videoApiPath || data?.video_api_path || data?.videoUrl || data?.video_url || data?.resultVideoUrl || data?.result_video_url || ''
  const videoApiPath = assetApiPath || data?.videoApiPath || data?.video_api_path || ''
  return {
    video_url: videoUrl,
    videoUrl: videoUrl,
    video_asset_id: assetId,
    videoAssetId: assetId,
    video_api_path: videoApiPath,
    videoApiPath: videoApiPath,
    video_name: data?.videoName || data?.video_name || (videoUrl ? 'video.mp4' : ''),
    original_video_url: data?.originalVideoUrl || data?.original_video_url || '',
    video_status: 'ready',
    video_job_id: data?.jobId || data?.job_id || job.jobId || '',
    video_status_endpoint: job.statusEndpoint || '',
    video_error: '',
    video_result: data || null,
    video_ready_at: new Date().toISOString(),
  }
}

function extractAvaCreditBalance(value) {
  if (!value || typeof value !== 'object') return null

  for (const key of ['balance', 'creditBalance', 'credit_balance', 'credits_balance', 'credits', 'amount']) {
    const raw = value?.[key]
    if (raw === 0 || raw) {
      const numberValue = Number(raw)
      if (Number.isFinite(numberValue)) return numberValue
    }
  }

  if (value.user && typeof value.user === 'object') return extractAvaCreditBalance(value.user)
  if (value.creditChargeResult && typeof value.creditChargeResult === 'object') return extractAvaCreditBalance(value.creditChargeResult)

  return null
}

function mmaudioPatchFromJobData(data = {}, job = {}) {
  const assetId = avaAssetIdFromRef(data?.mmaudioVideoAssetId, data?.mmaudio_video_asset_id, data?.assetId, data?.asset_id, data?.mmaudioVideoApiPath, data?.mmaudio_video_api_path, data?.videoApiPath, data?.video_api_path, data?.mmaudioVideoUrl, data?.mmaudio_video_url)
  const assetApiPath = avaAssetApiPath(assetId)
  const videoUrl = assetApiPath || data?.mmaudioVideoApiPath || data?.mmaudio_video_api_path || data?.videoApiPath || data?.video_api_path || data?.mmaudioVideoUrl || data?.mmaudio_video_url || data?.videoUrl || data?.video_url || ''
  return {
    mmaudio_status: 'ready',
    mmaudio_video_asset_id: assetId,
    mmaudioVideoAssetId: assetId,
    mmaudio_video_api_path: assetApiPath || data?.mmaudioVideoApiPath || data?.mmaudio_video_api_path || data?.videoApiPath || data?.video_api_path || '',
    mmaudioVideoApiPath: assetApiPath || data?.mmaudioVideoApiPath || data?.mmaudio_video_api_path || data?.videoApiPath || data?.video_api_path || '',
    mmaudio_video_url: videoUrl,
    mmaudioVideoUrl: videoUrl,
    mmaudio_video_name: data?.mmaudioVideoName || data?.mmaudio_video_name || data?.videoName || data?.video_name || (videoUrl ? 'mmaudio.mp4' : ''),
    mmaudio_job_id: data?.jobId || data?.job_id || job.jobId || '',
    mmaudio_status_endpoint: job.statusEndpoint || '',
    mmaudio_error: '',
    mmaudio_result: data || null,
    mmaudio_ready_at: new Date().toISOString(),
  }
}


export default function AvaShellLayout() {
  const { user, logout } = useAuth()
  const { projects, activeProject, lastSavedAt, exitProject } = useProjects()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem(SIDEBAR_OPEN_KEY) !== '0')
  const [globalToasts, setGlobalToasts] = useState([])
  const toastDedupeRef = useRef(new Map())
  const pollingJobsRef = useRef(new Set())
  const creditsRefreshInFlightRef = useRef(null)
  const [shellCreditBalance, setShellCreditBalance] = useState(null)
  const [shellCreditsRefreshing, setShellCreditsRefreshing] = useState(false)
  const projectTheme = useMemo(() => getProjectTheme(activeProject, projects), [activeProject, projects])

  const displayCreditBalance = useMemo(() => {
    const live = Number(shellCreditBalance)
    if (Number.isFinite(live)) return live

    const fromUser = extractAvaCreditBalance(user)
    return fromUser
  }, [shellCreditBalance, user])

  const refreshShellCredits = useCallback(async (reason = '') => {
    // AVA_LOCAL_CREDIT_SUMMARY_LOOP_FIX:
    // Do not allow overlapping /credits/summary requests. Before this guard,
    // refreshShellCredits dispatched ava:user-updated, while the same component
    // listened to ava:user-updated and triggered refreshShellCredits again. That
    // created an infinite summary request loop and made pages look frozen.
    if (creditsRefreshInFlightRef.current) return creditsRefreshInFlightRef.current

    setShellCreditsRefreshing(true)
    const request = apiRequest('/credits/summary')
      .then((summary) => {
        const nextBalance = extractAvaCreditBalance(summary)
        if (nextBalance !== null) setShellCreditBalance(nextBalance)
        return summary
      })
      .catch((error) => {
        console.warn('[AvaShell] credits refresh failed', reason, error)
        return null
      })
      .finally(() => {
        creditsRefreshInFlightRef.current = null
        setShellCreditsRefreshing(false)
      })

    creditsRefreshInFlightRef.current = request
    return request
  }, [])


  useEffect(() => {
    localStorage.setItem(SIDEBAR_OPEN_KEY, sidebarOpen ? '1' : '0')
  }, [sidebarOpen])

  // PATCH_07BA_SYNC_USER_BALANCE: keep topbar balance stable from auth user too.
  useEffect(() => {
    const nextBalance = extractAvaCreditBalance(user)
    if (nextBalance !== null) setShellCreditBalance(nextBalance)
  }, [user])


  // PATCH_07BB_DIRECT_CREDIT_EVENT: update topbar instantly from credits summary/generator.
  useEffect(() => {
    function handleDirectCreditUpdate(event) {
      const nextBalance = extractAvaCreditBalance(event?.detail)
      if (nextBalance !== null) setShellCreditBalance(nextBalance)
    }

    window.addEventListener('ava:credits-updated', handleDirectCreditUpdate)
    return () => window.removeEventListener('ava:credits-updated', handleDirectCreditUpdate)
  }, [])

  // PATCH_07BA_LIVE_CREDITS: keep topbar credits fresh without F5.
  useEffect(() => {
    let alive = true

    const runRefresh = (reason) => {
      if (!alive) return
      refreshShellCredits(reason)
    }

    runRefresh('shell_mount')

    const onCreditsChanged = () => runRefresh('ava_credits_changed')
    const onUserUpdated = (event) => {
      const nextBalance = extractAvaCreditBalance(event?.detail)
      if (nextBalance !== null) setShellCreditBalance(nextBalance)
      // Do not call runRefresh here: ava:user-updated can be emitted by a
      // credits refresh itself, so re-fetching here creates a summary loop.
    }
    const onFocus = () => runRefresh('window_focus')
    const onStorage = (event) => {
      if (!event?.key || String(event.key).includes('credit') || String(event.key).includes('user')) {
        runRefresh('storage')
      }
    }

    window.addEventListener('ava:credits-changed', onCreditsChanged)
    window.addEventListener('ava:user-updated', onUserUpdated)
    window.addEventListener('focus', onFocus)
    window.addEventListener('storage', onStorage)

    const timer = window.setInterval(() => runRefresh('soft_interval'), 15000)

    return () => {
      alive = false
      window.removeEventListener('ava:credits-changed', onCreditsChanged)
      window.removeEventListener('ava:user-updated', onUserUpdated)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('storage', onStorage)
      window.clearInterval(timer)
    }
  }, [refreshShellCredits])

  function pushGlobalToast(detail = {}) {
    const type = detail.type || 'info'
    const title = detail.title || (type === 'error' ? 'Ошибка' : type === 'success' ? 'Готово' : 'Уведомление')
    const message = detail.message || ''
    const sceneId = detail.sceneId || ''
    const rawTo = detail.to || detail.pagePath || ''
    const projectId = String(detail.projectId || avaProjectIdFromPath(rawTo) || avaProjectIdFromPath()).trim()
    const stage = String(detail.stage || detail.targetStage || avaStageFromPath(rawTo) || 'board').trim()
    const to = avaToastDestination({ to: rawTo, projectId, stage })

    const normalizedTitle = String(title || '').toLowerCase()
    let jobToastGroup = ''

    if (normalizedTitle.includes('mmaudio') && normalizedTitle.includes('готов')) {
      jobToastGroup = 'mmaudio:ready'
    } else if (normalizedTitle.includes('mmaudio') && (normalizedTitle.includes('ошиб') || normalizedTitle.includes('не собра') || normalizedTitle.includes('завис'))) {
      jobToastGroup = 'mmaudio:error'
    } else if (normalizedTitle.includes('видео') && normalizedTitle.includes('готов')) {
      jobToastGroup = 'video:ready'
    } else if (normalizedTitle.includes('видео') && (normalizedTitle.includes('ошиб') || normalizedTitle.includes('не собра') || normalizedTitle.includes('завис') || normalizedTitle.includes('без результата'))) {
      jobToastGroup = 'video:error'
    }

    const dedupeKey = jobToastGroup
      ? `${jobToastGroup}:${projectId || 'workspace'}:${sceneId || message}`
      : (detail.dedupeKey || `${type}:${title}:${message}:${sceneId}`)

    const now = Date.now()
    const lastShownAt = toastDedupeRef.current.get(dedupeKey) || 0
    if (now - lastShownAt < 15000) return
    toastDedupeRef.current.set(dedupeKey, now)

    const toastId = `global_toast_${now}_${Math.random().toString(16).slice(2)}`
    const nextToast = {
      id: toastId,
      type,
      title,
      message,
      sceneId,
      projectId,
      stage,
      to,
    }

    setGlobalToasts((current) => [...current.slice(-3), nextToast])

    window.setTimeout(() => {
      setGlobalToasts((current) => current.filter((toast) => toast.id !== toastId))
    }, type === 'error' ? 9000 : 6500)
  }

  function dismissGlobalToast(toastId) {
    setGlobalToasts((current) => current.filter((toast) => toast.id !== toastId))
  }

  function globalToastDestination(toast) {
    return avaToastDestination({
      to: toast?.to || toast?.pagePath || '',
      projectId: toast?.projectId || '',
      stage: toast?.stage || 'board',
    })
  }

  function prepareGlobalToastOpen(toast) {
    if (toast?.sceneId) {
      try {
        sessionStorage.setItem(AVA_OPEN_BOARD_SCENE_KEY, toast.sceneId)
      } catch (error) {
        // ignore session storage errors
      }
    }
  }

  function openGlobalToast(toast, event = null) {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }

    const destination = globalToastDestination(toast)
    prepareGlobalToastOpen(toast)
    dismissGlobalToast(toast.id)

    // Use React Router first; if it does not move after a short tick, hard navigate.
    try {
      navigate(destination)
      window.setTimeout(() => {
        if (window.location.pathname !== destination) {
          window.location.assign(destination)
        }
      }, 120)
    } catch (error) {
      window.location.assign(destination)
    }
  }

  useEffect(() => {
    function handleNotify(event) {
      pushGlobalToast(event.detail || {})
    }

    window.addEventListener('ava:notify', handleNotify)
    return () => window.removeEventListener('ava:notify', handleNotify)
  }, [])

  async function persistFinishedJobToBoardSnapshot(job, data) {
    const sceneId = job?.sceneId || ''
    if (!sceneId) return

    const patch = job.kind === 'mmaudio'
      ? mmaudioPatchFromJobData(data, job)
      : videoPatchFromJobData(data, job)

    const hasResult = job.kind === 'mmaudio'
      ? Boolean(patch.mmaudio_video_url)
      : Boolean(patch.video_url)

    if (!hasResult) return

    const endpoint = boardSnapshotEndpointForJob(job)

    try {
      const current = await apiRequest(endpoint)
      const boardData = current?.snapshot?.data || {}
      const scenes = Array.isArray(boardData.scenes) ? boardData.scenes : []

      let changed = false
      const nextScenes = scenes.map((scene) => {
        const id = scene?.id || scene?.scene_id
        if (id !== sceneId) return scene

        changed = true
        return {
          ...scene,
          ...patch,
        }
      })

      if (!changed) return

      const nextBoard = {
        ...boardData,
        scenes: nextScenes,
        updatedAt: new Date().toISOString(),
      }

      await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          data: nextBoard,
          guard_mode: endpoint.startsWith('/workspace/') ? 'replace' : 'safe_merge',
          client_version: 'ava-shell-global-job-v1',
        }),
      })
    } catch (error) {
      console.warn('[AvaShell] failed to persist finished job to Board snapshot', error)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function checkGlobalJobs() {
      const jobs = readAvaGlobalJobs()
      if (!jobs.length) return

      const nextJobs = []
      let changed = false

      for (const job of jobs) {
        const key = job.key || job.jobId || job.statusEndpoint
        if (!key || !job.statusEndpoint) continue
        if (pollingJobsRef.current.has(key)) {
          nextJobs.push(job)
          continue
        }

        pollingJobsRef.current.add(key)

        try {
          const data = await apiRequest(normalizeAvaEndpoint(job.statusEndpoint))
          if (cancelled) return

          const status = data?.status || data?.video_status || data?.mmaudio_status || 'running'
          const resultUrl = avaJobVideoUrl(job.kind, data)

          if (resultUrl) {
            changed = true
            const alreadyRemembered = avaCompletedJobAlreadyRemembered(key)
            const nextBalance = extractAvaCreditBalance(data)
            if (nextBalance !== null) setShellCreditBalance(nextBalance)
            refreshShellCredits('global_job_done')
            try { window.dispatchEvent(new CustomEvent('ava:credits-changed', { detail: data })) } catch {}
            if (alreadyRemembered) {
              continue
            }
            rememberCompletedAvaJob(job, data)
            await persistFinishedJobToBoardSnapshot(job, data)
            pushGlobalToast({
              type: 'success',
              title: job.kind === 'mmaudio' ? 'MMAudio готово' : 'Видео готово',
              message: `Сцена ${job.sceneId || ''}`.trim(),
              sceneId: job.sceneId || '',
              projectId: job.projectId || '',
              to: job.to || '',
              dedupeKey: `${job.kind}:${key}:done`,
            })
          } else if (avaJobIsStale(status, data)) {
            // Backend stores Board jobs in memory. After backend restart old job ids are gone;
            // remove them from the global watcher instead of polling forever.
            changed = true
          } else if (avaJobIsError(status)) {
            changed = true
            pushGlobalToast({
              type: 'error',
              title: job.kind === 'mmaudio' ? 'MMAudio не собрано' : 'Видео не собрано',
              message: `Сцена ${job.sceneId || ''}: ${data?.error || data?.detail || status}`.trim(),
              sceneId: job.sceneId || '',
              projectId: job.projectId || '',
              to: job.to || '',
              dedupeKey: `${job.kind}:${key}:error`,
            })
          } else {
            nextJobs.push({ ...job, lastStatus: status, updatedAt: new Date().toISOString() })
          }
        } catch (error) {
          nextJobs.push(job)
        } finally {
          pollingJobsRef.current.delete(key)
        }
      }

      if (changed || nextJobs.length !== jobs.length) {
        writeAvaGlobalJobs(nextJobs)
      }
    }

    checkGlobalJobs()
    const timer = window.setInterval(checkGlobalJobs, 3500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [refreshShellCredits])

  function handleLogout() {
    logout()
    navigate('/')
  }

  function handleExitProject() {
    exitProject()
    navigate('/app/dashboard')
  }

  const shellModeClass = activeProject ? 'isProjectMode' : 'isWorkspaceMode'
  const sidebarClass = sidebarOpen ? 'isSidebarOpen' : 'isSidebarClosed'

  return (
    <div className={`avaShell ${shellModeClass} ${sidebarClass}`} style={projectTheme.style}>
      {globalToasts.length > 0 && (
        <div className="avaGlobalToastStack" role="status" aria-live="polite">
          {globalToasts.map((toast) => (
            <div key={toast.id} className={`avaGlobalToast is-${toast.type || 'info'}`}>
              <div className="avaGlobalToastBody">
                <strong>{toast.title}</strong>
                {toast.message && <span>{toast.message}</span>}
              </div>
              {(toast.to || toast.sceneId) && (
                <a
                  className="avaGlobalToastOpen"
                  href={globalToastDestination(toast)}
                  onMouseDown={() => prepareGlobalToastOpen(toast)}
                  onClick={(event) => openGlobalToast(toast, event)}
                >
                  Открыть
                </a>
              )}
              <button type="button" className="avaGlobalToastClose" onClick={() => dismissGlobalToast(toast.id)}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <aside className="avaSidebar" aria-label="Основное меню ava-studio">
        <button
          className="avaSidebarToggle"
          type="button"
          onClick={() => setSidebarOpen((value) => !value)}
          title={sidebarOpen ? 'Свернуть меню' : 'Открыть меню'}
          aria-label={sidebarOpen ? 'Свернуть меню' : 'Открыть меню'}
        >
          {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>

        <Link to="/app/dashboard" className="avaBrand" title="ava-studio">
          <span className="avaBrandIcon avaBrandLogoIcon"><img src={avaLogoUrl} alt="" /></span>
          <span className="avaSidebarText">
            <strong>ava-studio</strong>
            <em>AI video workflow</em>
          </span>
        </Link>

        <nav className="avaNav">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                className={({ isActive }) => `avaNavItem ${isActive ? 'isActive' : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="avaSidebarProject" title={activeProject?.name || 'Рабочая область'}>
          <span>{activeProject ? `Проектный режим · ${projectTheme.name}` : 'Рабочая область'}</span>
          <strong>{activeProject?.name || 'без проекта'}</strong>
          <small>{activeProject?.format || 'автосохранение черновиков'}</small>
        </div>

        <NavLink className={({ isActive }) => `avaGhostButton ${isActive ? 'isActive' : ''}`} to="/app/settings" title="Настройки / Service Center">
          <Settings size={16} /> <span className="avaSidebarText">Настройки</span>
        </NavLink>
      </aside>

      <main className="avaMain">
        <header className="avaTopbar">
          <div className={`avaTopbarLeft ${activeProject ? '' : 'isWorkspaceOnly'}`}>
            {activeProject && <p>{`Проект открыт · ${activeProject.format}`}</p>}
            <h1>{activeProject ? activeProject.name : 'ava-studio'}</h1>
          </div>
          <div className="avaTopbarRight">
            <span className="avaModePill">{activeProject ? 'project mode' : 'workspace mode'}</span>
            <span className="avaSavePill">{lastSavedAt ? 'Сохранено' : 'autosave ready'}</span>
            <span className={`avaCreditPill ${shellCreditsRefreshing ? 'isRefreshing' : ''}`} title={shellCreditsRefreshing ? 'Обновляю баланс...' : 'Баланс кредитов'}>
                {displayCreditBalance !== null && displayCreditBalance !== undefined ? `${displayCreditBalance} credits` : 'credits'}
              </span>
            {activeProject && (
              <button className="avaExitProjectButton" type="button" onClick={handleExitProject}>
                Выйти из проекта
              </button>
            )}
            <button className="avaUserPill" onClick={handleLogout} title="Выйти из аккаунта">
              {user?.name || user?.email || 'User'} <LogOut size={15} />
            </button>
          </div>
        </header>
        <section className="avaContent">
          <Outlet />
        </section>
      </main>
          <GlobalJobNotifier />
</div>
  )
}
