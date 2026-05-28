import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Brain, ChevronLeft, ChevronRight, FolderKanban, Home, LogOut, PlusCircle, Settings, WalletCards, UserRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useProjects } from '../context/ProjectContext.jsx'
import { getProjectTheme } from '../utils/projectTheme.js'
import { apiRequest } from '../services/apiClient.js'

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

function avaJobVideoUrl(kind, data) {
  if (kind === 'mmaudio') {
    return data?.mmaudioVideoUrl || data?.mmaudio_video_url || data?.videoUrl || data?.video_url || ''
  }
  return data?.videoUrl || data?.video_url || data?.resultVideoUrl || data?.result_video_url || ''
}

function avaJobIsError(status) {
  return ['error', 'failed', 'output_download_failed', 'output_finalize_failed', 'completed_without_video_output'].includes(String(status || '').toLowerCase())
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
  const videoUrl = data?.videoUrl || data?.video_url || data?.resultVideoUrl || data?.result_video_url || ''
  const videoApiPath = data?.videoApiPath || data?.video_api_path || ''
  return {
    video_url: videoUrl,
    video_api_path: videoApiPath,
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

function mmaudioPatchFromJobData(data = {}, job = {}) {
  const videoUrl = data?.mmaudioVideoUrl || data?.mmaudio_video_url || data?.videoUrl || data?.video_url || ''
  return {
    mmaudio_status: 'ready',
    mmaudio_video_url: videoUrl,
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
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem(SIDEBAR_OPEN_KEY) === '1')
  const [globalToasts, setGlobalToasts] = useState([])
  const toastDedupeRef = useRef(new Map())
  const pollingJobsRef = useRef(new Set())
  const projectTheme = useMemo(() => getProjectTheme(activeProject, projects), [activeProject, projects])

  useEffect(() => {
    localStorage.setItem(SIDEBAR_OPEN_KEY, sidebarOpen ? '1' : '0')
  }, [sidebarOpen])

  function pushGlobalToast(detail = {}) {
    const type = detail.type || 'info'
    const title = detail.title || (type === 'error' ? 'Ошибка' : type === 'success' ? 'Готово' : 'Уведомление')
    const message = detail.message || ''
    const sceneId = detail.sceneId || ''
    const to = detail.to || ''

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
      ? `${jobToastGroup}:${sceneId || message}`
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
    const explicitTo = String(toast?.to || '')
    const projectId = String(toast?.projectId || '')

    if (explicitTo.includes('/app/projects/') && explicitTo.includes('/board')) return explicitTo
    if (explicitTo.includes('/app/workspace/board')) return explicitTo
    if (projectId) return `/app/projects/${projectId}/board`

    return '/app/workspace/board'
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
  }, [])

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
          <span className="avaBrandIcon"><Brain size={24} /></span>
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
          <div className="avaTopbarLeft">
            <p>{activeProject ? `Проект открыт · ${activeProject.format}` : 'Рабочая область'}</p>
            <h1>{activeProject ? activeProject.name : 'ava-studio'}</h1>
          </div>
          <div className="avaTopbarRight">
            <span className="avaModePill">{activeProject ? 'project mode' : 'workspace mode'}</span>
            <span className="avaSavePill">{lastSavedAt ? 'Сохранено' : 'autosave ready'}</span>
            <span className="avaCreditPill">{user?.credits_balance ?? 0} credits</span>
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
    </div>
  )
}
