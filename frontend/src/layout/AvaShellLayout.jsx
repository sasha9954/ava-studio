/* AVA_SHELL_BOARD_JOB_SERVER_BATCH_GUARD_V209Q: AvaShell must not persist stale Board global jobs while server batch owns Board. */
/* AVA_PROJECT_NEW_ID_GUARD_V12: ignore reserved route id 'new' in shell project routing helpers. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
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
const AVA_GENERATOR_SNAPSHOT_DISCOVERY_MS = 0

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

function avaGeneratorMmaudioJobId(job = {}) {
  return String(job?.jobId || job?.job_id || job?.id || '')
    .replace(/^generator-mmaudio:/, '')
    .replace(/^mmaudio:/, '')
    .trim()
}

function avaGeneratorMmaudioCompletionKey(jobOrId = {}) {
  const jobId = typeof jobOrId === 'string' ? String(jobOrId || '').replace(/^generator-mmaudio:/, '').replace(/^mmaudio:/, '').trim() : avaGeneratorMmaudioJobId(jobOrId)
  return jobId ? `generator-mmaudio:${jobId}` : ''
}

function avaGeneratorMmaudioAlreadyRemembered(jobOrId = {}) {
  const jobId = typeof jobOrId === 'string' ? String(jobOrId || '').replace(/^generator-mmaudio:/, '').replace(/^mmaudio:/, '').trim() : avaGeneratorMmaudioJobId(jobOrId)
  if (!jobId) return false
  return avaCompletedJobAlreadyRemembered(`generator-mmaudio:${jobId}`) || avaCompletedJobAlreadyRemembered(`mmaudio:${jobId}`) || avaCompletedJobAlreadyRemembered(jobId)
}

function avaSnapshotCompletedMmaudioJobIds(snapshot = {}) {
  const ids = Array.isArray(snapshot?.completedMmaudioJobIds) ? snapshot.completedMmaudioJobIds : []
  const lastId = snapshot?.lastCompletedMmaudioJobId || snapshot?.last_completed_mmaudio_job_id || ''
  return new Set([...ids, lastId].map((item) => String(item || '').replace(/^generator-mmaudio:/, '').replace(/^mmaudio:/, '').trim()).filter(Boolean))
}

function avaSnapshotHasCompletedMmaudioJob(snapshot = {}, jobId = '') {
  const cleanJobId = String(jobId || '').replace(/^generator-mmaudio:/, '').replace(/^mmaudio:/, '').trim()
  if (!cleanJobId) return false
  if (avaSnapshotCompletedMmaudioJobIds(snapshot).has(cleanJobId)) return true
  const snapshotStatus = String(snapshot?.mmaudioStatus || snapshot?.mmaudio_status || '').toLowerCase()
  const snapshotJobId = avaGeneratorMmaudioJobId(snapshot?.mmaudioJob || {})
  return avaJobStatusLooksDone(snapshotStatus) && (!snapshotJobId || snapshotJobId === cleanJobId)
}

function normalizeAvaEndpoint(endpoint) {
  const value = String(endpoint || '')
  return value.startsWith('/api/') ? value.slice(4) : value
}

function avaShellIsRealProjectId(value = '') {
  const id = String(value || '').trim()
  return /^p_[a-z0-9]+$/i.test(id)
}

function avaProjectIdFromPath(path = '') {
  const value = String(path || (typeof window !== 'undefined' ? window.location.pathname : '') || '')
  const match = value.match(/\/app\/projects\/([^/]+)/)
  const rawProjectId = match?.[1] ? decodeURIComponent(match[1]) : ''
  return avaShellIsRealProjectId(rawProjectId) ? rawProjectId : ''
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
  // AVA_SHELL_CANCEL_TERMINAL_V203L:
  // Canceled/cancel_requested jobs are terminal and must be removed from shell polling.
  return normalized.startsWith('blocked_') || ['error', 'failed', 'queued_no_prompt_id', 'output_download_failed', 'output_finalize_failed', 'completed_without_video_output', 'canceled', 'cancelled', 'cancel_requested'].includes(normalized)
}

function avaJobIsStale(status, data = {}) {
  const normalized = String(status || '').toLowerCase()
  const code = String(data?.code || data?.error?.code || '').toUpperCase()
  return normalized === 'not_found' || code === 'BOARD_VIDEO_JOB_NOT_FOUND' || code === 'BOARD_MMAUDIO_JOB_NOT_FOUND'
}

// AVA_SHELL_STALE_GENERATOR_JOB_AGE_V203L:
// Local active jobs can survive backend restart/F5 and then poll forever.
function avaJobAgeMsV203L(job = {}) {
  const stamps = [job?.updatedAt, job?.updated_at, job?.createdAt, job?.created_at, job?.startedAt, job?.started_at]
    .map((value) => {
      const raw = String(value || '').trim()
      if (!raw) return null
      const t = Date.parse(raw)
      return Number.isFinite(t) ? t : null
    })
    .filter((value) => value !== null)
  if (!stamps.length) return Number.POSITIVE_INFINITY
  return Math.max(0, Date.now() - Math.min(...stamps))
}


function avaJobStatusLooksDone(status = '') {
  const normalized = String(status || '').toLowerCase()
  if (!normalized) return false
  return ['completed', 'complete', 'ready', 'done', 'success', 'succeeded', 'finished'].some((item) => normalized.includes(item))
}

function avaGeneratorJobLooksActive(job = {}) {
  const jobId = String(job?.jobId || job?.job_id || '').replace(/^generator-mmaudio:/, '').replace(/^mmaudio:/, '').replace(/^generator:/, '').trim()
  if (!jobId) return false
  const status = String(job?.status || job?.rawStatus || job?.lastStatus || '').toLowerCase()
  if (avaJobStatusLooksDone(status) || avaJobIsError(status) || avaJobIsStale(status, job)) return false
  if (!status) return true
  return ['queued', 'pending', 'running', 'processing', 'submitted', 'started', 'in_progress', 'created'].some((item) => status.includes(item))
}

function avaShellProjectIdFromProject(project = {}) {
  const id = String(project?.id || project?.project_id || project?.projectId || project?.key || '').trim()
  return avaShellIsRealProjectId(id) ? id : ''
}

function avaShellProjectIds({ activeProject = null } = {}) {
  const ids = new Set()
  const pathProjectId = avaProjectIdFromPath()
  if (pathProjectId) ids.add(pathProjectId)
  const activeId = avaShellProjectIdFromProject(activeProject)
  if (activeId) ids.add(activeId)
  return [...ids]
}

function avaGeneratorGalleryComparableRef(item = {}) {
  const assetId = avaAssetIdFromRef(item?.assetId, item?.asset_id, item?.apiPath, item?.api_path, item?.url)
  if (assetId) return `asset:${assetId}`
  return String(item?.apiPath || item?.api_path || item?.url || '').trim()
}

function avaGeneratorGalleryItemFromMmaudio(data = {}, job = {}) {
  const url = avaJobVideoUrl('mmaudio', data)
  const assetId = avaAssetIdFromRef(url, data?.assetId, data?.asset_id, data?.mmaudioVideoAssetId, data?.mmaudio_video_asset_id)
  const apiPath = avaAssetApiPath(assetId) || data?.mmaudioVideoApiPath || data?.mmaudio_video_api_path || data?.videoApiPath || data?.video_api_path || url
  return {
    label: 'MMAudio',
    title: 'MMAudio',
    kind: 'mmaudio',
    route: 'mmaudio',
    url: apiPath || url,
    apiPath: apiPath || url,
    assetId,
    durationSec: data?.durationSec || data?.duration_sec || job?.durationSec || job?.duration_sec || null,
    jobId: data?.jobId || data?.job_id || job?.jobId || job?.job_id || '',
    createdAt: new Date().toISOString(),
  }
}


function avaShellJobIsGenerator(job = {}) {
  const stage = String(job?.stage || avaStageFromPath(job?.to || job?.pagePath || '') || '').replace(/_/g, '-').toLowerCase()
  const source = String(job?.source || '').toLowerCase()
  return stage === 'generator' || stage === 'standalone-generator' || source === 'standalone_generator'
}

function avaGeneratorGalleryItemFromCompleted(data = {}, job = {}) {
  const url = avaJobVideoUrl(job?.kind || 'video', data)
  const assetId = avaAssetIdFromRef(
    url,
    data?.assetId,
    data?.asset_id,
    data?.videoAssetId,
    data?.video_asset_id,
    data?.resultVideoAssetId,
    data?.result_video_asset_id
  )
  const apiPath = avaAssetApiPath(assetId) || data?.videoApiPath || data?.video_api_path || data?.resultVideoApiPath || data?.result_video_api_path || url
  const kind = job?.kind === 'image' ? 'image' : 'video'
  return {
    label: job?.title || job?.label || (kind === 'image' ? 'Фото' : 'Видео'),
    title: job?.title || job?.label || (kind === 'image' ? 'Фото' : 'Видео'),
    kind,
    route: job?.route || data?.route || '',
    url: apiPath || url,
    apiPath: apiPath || url,
    assetId,
    durationSec: data?.durationSec || data?.duration_sec || job?.targetDurationSec || job?.target_duration_sec || job?.durationSec || job?.duration_sec || null,
    jobId: data?.jobId || data?.job_id || job?.jobId || job?.job_id || '',
    createdAt: new Date().toISOString(),
  }
}

function normalizeGeneratorMmaudioJobForShell(job = {}, projectId = '') {
  const jobId = String(job?.jobId || job?.job_id || job?.id || '').replace(/^generator-mmaudio:/, '').replace(/^mmaudio:/, '').trim()
  if (!jobId) return null
  const cleanProjectId = String(projectId || job?.projectId || job?.project_id || '').trim()
  const pagePath = job?.pagePath || job?.to || (cleanProjectId ? `/app/projects/${cleanProjectId}/generator` : '/app/workspace/generator')
  return {
    ...job,
    id: `generator-mmaudio:${jobId}`,
    key: `generator-mmaudio:${jobId}`,
    source: job?.source || 'standalone_generator_mmaudio',
    kind: 'mmaudio',
    title: job?.title || 'MMAudio',
    projectId: cleanProjectId,
    project_id: cleanProjectId,
    stage: 'generator',
    pagePath,
    to: pagePath,
    workspaceMode: !cleanProjectId,
    jobId,
    job_id: jobId,
    status: job?.status || job?.rawStatus || 'running',
    rawStatus: job?.rawStatus || job?.status || 'running',
    statusBase: job?.statusBase || '/clip/mmaudio/status/',
    statusEndpoint: job?.statusEndpoint || `/clip/mmaudio/status/${jobId}`,
    route: 'mmaudio',
  }
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
  const { projects, activeProject, lastSavedAt, exitProject, syncActiveProjectFromRoute } = useProjects()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem(SIDEBAR_OPEN_KEY) !== '0')
  const [globalToasts, setGlobalToasts] = useState([])
  const toastDedupeRef = useRef(new Map())
  const pollingJobsRef = useRef(new Set())
  const generatorSnapshotDiscoveryRef = useRef({ lastAt: 0, inFlight: false })
  const creditsRefreshInFlightRef = useRef(null)
  const creditsRefreshLastAtRefV200J = useRef(0)
  const [shellCreditBalance, setShellCreditBalance] = useState(null)
  const [shellCreditsRefreshing, setShellCreditsRefreshing] = useState(false)
  const routeProjectId = useMemo(() => avaProjectIdFromPath(location.pathname), [location.pathname])

  useEffect(() => {
    // AVA_PROJECT_ROUTE_ACTIVE_SYNC_V40D:
    // A direct project URL must activate the shell/sidebar project context too.
    if (!routeProjectId) return
    if (typeof syncActiveProjectFromRoute === 'function') {
      syncActiveProjectFromRoute(routeProjectId, 'shell_route')
    }
  }, [routeProjectId, projects.length, syncActiveProjectFromRoute])

  const routeProject = useMemo(() => {
    if (!routeProjectId) return null
    return projects.find((project) => String(project?.id || '') === routeProjectId) || null
  }, [projects, routeProjectId])

  // AVA_BOARD_STILL_BUTTONS_ROUTE_PROJECT_V86B: routeProjectId wins over stale activeProject during hard reload.
  // Prevents the shell from briefly rendering the previously active project
  // (wrong name/color) before syncActiveProjectFromRoute finishes.
  const effectiveActiveProject = useMemo(() => {
    if (routeProjectId) {
      if (routeProject) return routeProject
      const activeProjectId = String(activeProject?.id || activeProject?.project_id || activeProject?.projectId || '').trim()
      if (activeProject && activeProjectId === routeProjectId) return activeProject
      return {
        id: routeProjectId,
        name: `Проект ${routeProjectId.slice(-6)}`,
        format: 'project',
        routeSynced: true,
      }
    }
    if (activeProject) return activeProject
    return null
  }, [activeProject, routeProject, routeProjectId])

  const projectTheme = useMemo(() => getProjectTheme(effectiveActiveProject, projects), [effectiveActiveProject, projects])

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
      // AVA_CREDITS_EVENT_NO_SUMMARY_SPAM_V200J:
      // F5 + Board job polling can emit many credit events. They already contain the
      // current balance, so summary refetches must be throttled.
      const now = Date.now()
      if (reason !== 'shell_mount' && now - creditsRefreshLastAtRefV200J.current < 8000) return
      creditsRefreshLastAtRefV200J.current = now
      refreshShellCredits(reason)
    }

    runRefresh('shell_mount')

    const onCreditsChanged = (event) => {
      const nextBalance = extractAvaCreditBalance(event?.detail)
      if (nextBalance !== null) {
        setShellCreditBalance(nextBalance)
        return
      }
      runRefresh('ava_credits_changed_missing_balance')
    }
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

    const timer = window.setInterval(() => runRefresh('soft_interval'), 60000)

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

    // AVA_GENERATOR_TOAST_JOB_DEDUPE_V83:
    // Job completion toasts must dedupe by the concrete job key when one is provided.
    // The broader video:ready group is only a fallback.
    const dedupeKey = detail.dedupeKey
      || (jobToastGroup
        ? `${jobToastGroup}:${projectId || 'workspace'}:${sceneId || message}`
        : `${type}:${title}:${message}:${sceneId}`)

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
    const toastProjectId = String(toast?.projectId || avaProjectIdFromPath(toast?.to || toast?.pagePath || '') || '').trim()
    if (toastProjectId && typeof syncActiveProjectFromRoute === 'function') {
      syncActiveProjectFromRoute(toastProjectId, 'toast_open')
    }

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


  function avaShellBoardBatchIsActiveV209Q(boardData = {}) {
    // AVA_SHELL_BOARD_JOB_SERVER_BATCH_GUARD_V209Q:
    // The Board page/server batch owns Board snapshot writes while a batch is active.
    // Shell global-job watcher may still see old direct jobs, but must not persist them.
    const batch = boardData?.video_batch || boardData?.videoBatch || boardData?.board_video_batch || boardData?.boardVideoBatch || {}
    const queue = boardData?.video_queue || boardData?.videoQueue || {}
    const status = String(
      batch.status || batch.batch_status || batch.video_status ||
      queue.status || queue.batch_status || ''
    ).toLowerCase()
    const active = new Set(['queued', 'running', 'starting', 'preparing', 'submitting', 'processing'])
    const terminal = new Set([
      '', 'idle', 'ready', 'done', 'completed', 'success', 'finished', 'finished_with_errors',
      'error', 'failed', 'canceled', 'cancelled', 'stopped', 'interrupted',
      'interrupted_after_backend_reload', 'orphaned_after_reload', 'backend_reload_orphaned_batch_v150a',
    ])
    if (active.has(status)) return true
    if (terminal.has(status)) return false
    const waiting = [
      ...(Array.isArray(queue.waitingSceneIds) ? queue.waitingSceneIds : []),
      ...(Array.isArray(queue.waiting_scene_ids) ? queue.waiting_scene_ids : []),
      ...(Array.isArray(batch.waitingSceneIds) ? batch.waitingSceneIds : []),
      ...(Array.isArray(batch.waiting_scene_ids) ? batch.waiting_scene_ids : []),
      ...(Array.isArray(batch.queuedSceneIds) ? batch.queuedSceneIds : []),
      ...(Array.isArray(batch.queued_scene_ids) ? batch.queued_scene_ids : []),
    ]
    return Boolean(status && (
      waiting.length ||
      batch.activeSceneId || batch.active_scene_id || queue.activeSceneId || queue.active_scene_id ||
      batch.activeJobId || batch.active_job_id || queue.activeJobId || queue.active_job_id ||
      batch.activeStatusEndpoint || batch.active_status_endpoint || queue.activeStatusEndpoint || queue.active_status_endpoint
    ))
  }

  function avaShellBoardSceneRejectsJobV209Q(scene = {}, jobId = '') {
    const safeJobId = String(jobId || '').trim()
    if (!safeJobId || !scene || typeof scene !== 'object') return false

    const liveJobId = String(scene.video_job_id || scene.videoJobId || scene.job_id || scene.jobId || '').trim()
    const liveEndpoint = String(scene.video_status_endpoint || scene.videoStatusEndpoint || scene.status_endpoint || scene.statusEndpoint || '').trim()
    const status = String(scene.video_status || scene.videoStatus || scene.status || '').toLowerCase()
    const active = new Set(['queued', 'running', 'starting', 'preparing', 'submitting', 'processing', 'queued_no_prompt_id'])

    if (liveJobId && liveJobId !== safeJobId) return true
    if (liveEndpoint && !liveEndpoint.includes(safeJobId)) return true
    if (active.has(status) && !liveJobId && !liveEndpoint) return true

    const hasReadyVideo = Boolean(
      scene.video_asset_id || scene.videoAssetId ||
      scene.video_api_path || scene.videoApiPath ||
      scene.video_url || scene.videoUrl ||
      scene.result_video_asset_id || scene.resultVideoAssetId ||
      scene.result_video_api_path || scene.resultVideoApiPath ||
      scene.result_video_url || scene.resultVideoUrl
    )
    // If the scene already has a saved video and no live job points to this job, this is
    // probably an old global job finishing late. Do not let it overwrite server-batch result.
    if (hasReadyVideo && !liveJobId && !liveEndpoint) return true
    return false
  }

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

      if (String(job?.stage || '').toLowerCase() === 'board' && job.kind !== 'mmaudio' && avaShellBoardBatchIsActiveV209Q(boardData)) {
        console.log('[AVA SHELL BOARD JOB PERSIST SKIPPED V209Q]', {
          reason: 'active_server_batch',
          projectId: job?.projectId || '',
          sceneId,
          jobId: job?.jobId || job?.job_id || '',
        })
        return
      }

      const targetSceneV209Q = scenes.find((scene) => (scene?.id || scene?.scene_id) === sceneId) || null
      if (String(job?.stage || '').toLowerCase() === 'board' && job.kind !== 'mmaudio' && avaShellBoardSceneRejectsJobV209Q(targetSceneV209Q, job?.jobId || job?.job_id || '')) {
        console.log('[AVA SHELL BOARD JOB PERSIST SKIPPED V209Q]', {
          reason: 'scene_does_not_accept_job',
          projectId: job?.projectId || '',
          sceneId,
          jobId: job?.jobId || job?.job_id || '',
          liveJobId: targetSceneV209Q?.video_job_id || targetSceneV209Q?.videoJobId || '',
          liveEndpoint: targetSceneV209Q?.video_status_endpoint || targetSceneV209Q?.videoStatusEndpoint || '',
        })
        return
      }

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

  async function discoverGeneratorMmaudioJobsFromSnapshots(existingJobs = []) {
    const existingKeys = new Set((Array.isArray(existingJobs) ? existingJobs : []).map((job) => String(job?.key || job?.id || '').trim()).filter(Boolean))
    const discovered = []
    const projectIds = avaShellProjectIds({ activeProject: effectiveActiveProject })

    for (const projectId of projectIds) {
      try {
        const response = await apiRequest(`/projects/${projectId}/snapshots/generator`)
        const snapshot = response?.snapshot?.data || response?.data || {}
        const mmaudioJob = normalizeGeneratorMmaudioJobForShell(snapshot?.mmaudioJob, projectId)
        const mmaudioJobId = avaGeneratorMmaudioJobId(mmaudioJob)
        if (!mmaudioJob || !mmaudioJobId) continue
        if (avaSnapshotHasCompletedMmaudioJob(snapshot, mmaudioJobId) || avaGeneratorMmaudioAlreadyRemembered(mmaudioJob)) {
          await clearStaleGeneratorMmaudioSnapshotJob(projectId, mmaudioJobId, snapshot?.mmaudioStatus || 'completed')
          continue
        }
        if (!avaGeneratorJobLooksActive(mmaudioJob)) continue
        const key = String(mmaudioJob.key || mmaudioJob.id || '').trim()
        if (!key || existingKeys.has(key)) continue
        existingKeys.add(key)
        discovered.push(mmaudioJob)
      } catch (error) {
        // Snapshot discovery is best-effort; normal global job polling still works.
      }
    }

    if (discovered.length) {
      const nextJobs = [...discovered, ...(Array.isArray(existingJobs) ? existingJobs : [])]
      writeAvaGlobalJobs(nextJobs)
      console.log('[AvaShell] discovered generator MMAudio jobs from snapshots', discovered.map((job) => job.jobId))
      return nextJobs
    }

    return Array.isArray(existingJobs) ? existingJobs : []
  }

  async function persistFinishedGeneratorMmaudioSnapshot(job = {}, data = {}) {
    const projectId = String(job?.projectId || job?.project_id || avaProjectIdFromPath(job?.to || job?.pagePath || '') || '').trim()
    if (!projectId) return

    const videoUrl = avaJobVideoUrl('mmaudio', data)
    if (!videoUrl) return

    const endpoint = `/projects/${projectId}/snapshots/generator`

    try {
      const response = await apiRequest(endpoint)
      const currentData = response?.snapshot?.data || response?.data || {}
      const oldGallery = Array.isArray(currentData.gallery) ? currentData.gallery : []
      const newItem = avaGeneratorGalleryItemFromMmaudio(data, job)
      const newKey = avaGeneratorGalleryComparableRef(newItem)
      const cleanJobId = avaGeneratorMmaudioJobId(job)
      const deletedGalleryRefs = new Set((Array.isArray(currentData.deletedGalleryRefs) ? currentData.deletedGalleryRefs : []).map((item) => String(item || '').trim()).filter(Boolean))
      const deletedMmaudioJobIds = new Set((Array.isArray(currentData.deletedMmaudioJobIds) ? currentData.deletedMmaudioJobIds : []).map((item) => String(item || '').replace(/^generator-mmaudio:/, '').replace(/^mmaudio:/, '').trim()).filter(Boolean))

      // AVA_GENERATOR_MMAUDIO_TOMBSTONE_GUARD_V1:
      // If the user hard-deleted a Generator feed card, the Shell watcher must not
      // re-inject the completed MMAudio result from an old global job.
      if ((newKey && deletedGalleryRefs.has(newKey)) || (cleanJobId && deletedMmaudioJobIds.has(cleanJobId))) {
        await clearStaleGeneratorMmaudioSnapshotJob(projectId, cleanJobId, 'completed')
        return
      }

      const nextGallery = [
        ...oldGallery.filter((item) => avaGeneratorGalleryComparableRef(item) !== newKey),
        newItem,
      ].slice(-80)

      const oldCompletedIds = Array.isArray(currentData.completedMmaudioJobIds) ? currentData.completedMmaudioJobIds : []
      const completedMmaudioJobIds = cleanJobId
        ? [...oldCompletedIds.filter((item) => String(item || '').replace(/^generator-mmaudio:/, '').replace(/^mmaudio:/, '').trim() !== cleanJobId), cleanJobId].slice(-30)
        : oldCompletedIds

      const nextData = {
        ...currentData,
        gallery: nextGallery,
        mmaudioResultUrl: newItem.apiPath || newItem.url || videoUrl,
        mmaudioJob: null,
        mmaudioStatus: 'completed',
        lastCompletedMmaudioJobId: cleanJobId || currentData.lastCompletedMmaudioJobId || '',
        completedMmaudioJobIds,
        updatedAt: new Date().toISOString(),
      }

      await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          data: nextData,
          guard_mode: 'replace',
          client_version: 'ava-shell-generator-mmaudio-v1',
        }),
      })
    } catch (error) {
      console.warn('[AvaShell] failed to persist finished Generator MMAudio snapshot', error)
    }
  }



  async function persistFinishedGeneratorSnapshot(job = {}, data = {}) {
    const projectId = String(job?.projectId || job?.project_id || avaProjectIdFromPath(job?.to || job?.pagePath || '') || '').trim()
    if (!projectId) return

    const videoUrl = avaJobVideoUrl(job?.kind || 'video', data)
    if (!videoUrl) return

    const endpoint = `/projects/${projectId}/snapshots/generator`

    try {
      const response = await apiRequest(endpoint)
      const currentData = response?.snapshot?.data || response?.data || {}
      const oldGallery = Array.isArray(currentData.gallery) ? currentData.gallery : []
      const newItem = avaGeneratorGalleryItemFromCompleted(data, job)
      const newKey = avaGeneratorGalleryComparableRef(newItem)
      const cleanJobId = String(job?.jobId || job?.job_id || data?.jobId || data?.job_id || '').replace(/^generator:/, '').trim()
      const deletedGalleryRefs = new Set((Array.isArray(currentData.deletedGalleryRefs) ? currentData.deletedGalleryRefs : []).map((item) => String(item || '').trim()).filter(Boolean))

      // AVA_GENERATOR_COMPLETED_SNAPSHOT_GUARD_V2:
      // Normal Generator jobs can finish while the user is on another page. The Shell
      // watcher must write the completed video into the Generator snapshot/gallery,
      // but must not resurrect feed cards that were hard-deleted.
      if (newKey && deletedGalleryRefs.has(newKey)) {
        const nextData = {
          ...currentData,
          job: null,
          statusText: 'completed',
          updatedAt: new Date().toISOString(),
        }
        await apiRequest(endpoint, {
          method: 'POST',
          body: JSON.stringify({
            data: nextData,
            guard_mode: 'replace',
            client_version: 'ava-shell-generator-completed-tombstone-v2',
          }),
        })
        return
      }

      const nextGallery = [
        ...oldGallery.filter((item) => avaGeneratorGalleryComparableRef(item) !== newKey),
        newItem,
      ].slice(-80)

      const cleanResultUrl = newItem.apiPath || newItem.url || videoUrl
      const nextData = {
        ...currentData,
        gallery: nextGallery,
        result: {
          ...(currentData.result || {}),
          url: cleanResultUrl,
          apiPath: newItem.apiPath || cleanResultUrl,
          assetId: newItem.assetId || avaAssetIdFromRef(cleanResultUrl),
          kind: newItem.kind || (job?.kind === 'image' ? 'image' : 'video'),
        },
        resultUrl: cleanResultUrl,
        job: null,
        statusText: 'completed',
        lastCompletedJobId: cleanJobId || currentData.lastCompletedJobId || '',
        updatedAt: new Date().toISOString(),
      }

      await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          data: nextData,
          guard_mode: 'replace',
          client_version: 'ava-shell-generator-completed-v2',
        }),
      })
      console.log('[AvaShell] persisted finished Generator snapshot', { projectId, jobId: cleanJobId, resultUrl: cleanResultUrl, gallery: nextGallery.length })
    } catch (error) {
      console.warn('[AvaShell] failed to persist finished Generator snapshot', error)
    }
  }

  async function clearStaleGeneratorMmaudioSnapshotJob(projectId = '', jobId = '', status = 'completed') {
    const cleanProjectId = String(projectId || '').trim()
    const cleanJobId = String(jobId || '').replace(/^generator-mmaudio:/, '').replace(/^mmaudio:/, '').trim()
    if (!cleanProjectId || !cleanJobId) return

    const endpoint = `/projects/${cleanProjectId}/snapshots/generator`
    try {
      const response = await apiRequest(endpoint)
      const currentData = response?.snapshot?.data || response?.data || {}
      const currentJobId = avaGeneratorMmaudioJobId(currentData?.mmaudioJob || {})
      if (currentJobId && currentJobId !== cleanJobId) return
      const oldCompletedIds = Array.isArray(currentData.completedMmaudioJobIds) ? currentData.completedMmaudioJobIds : []
      const completedMmaudioJobIds = [...oldCompletedIds.filter((item) => String(item || '').replace(/^generator-mmaudio:/, '').replace(/^mmaudio:/, '').trim() !== cleanJobId), cleanJobId].slice(-30)
      await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          data: {
            ...currentData,
            mmaudioJob: null,
            mmaudioStatus: status || 'completed',
            lastCompletedMmaudioJobId: cleanJobId,
            completedMmaudioJobIds,
            updatedAt: new Date().toISOString(),
          },
          guard_mode: 'replace',
          client_version: 'ava-shell-generator-mmaudio-stale-clear-v1',
        }),
      })
    } catch (error) {
      console.warn('[AvaShell] failed to clear stale Generator MMAudio job', error)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function checkGlobalJobs() {
      // AVA_GENERATOR_SHELL_POLL_THROTTLE_V4:
      // Do not scan project snapshots from AvaShell. Generator writes active jobs to
      // localStorage immediately, and that is enough for exit/enter/F5 resume. Snapshot
      // discovery across projects caused repeated /snapshots/generator GET storms and
      // made Generator/MMAudio restore feel very slow.
      let jobs = readAvaGlobalJobs()
      if (AVA_GENERATOR_SNAPSHOT_DISCOVERY_MS > 0) {
        const discovery = generatorSnapshotDiscoveryRef.current || { lastAt: 0, inFlight: false }
        const now = Date.now()
        if (!discovery.inFlight && now - Number(discovery.lastAt || 0) >= AVA_GENERATOR_SNAPSHOT_DISCOVERY_MS) {
          discovery.inFlight = true
          discovery.lastAt = now
          generatorSnapshotDiscoveryRef.current = discovery
          try {
            jobs = await discoverGeneratorMmaudioJobsFromSnapshots(jobs)
          } finally {
            discovery.inFlight = false
            generatorSnapshotDiscoveryRef.current = discovery
          }
        }
      }
      if (!jobs.length) return

      const nextJobs = []
      let changed = false

      for (const job of jobs) {
        const key = job.key || job.jobId || job.statusEndpoint
        if (!key || !job.statusEndpoint) continue
        // AVA_SHELL_DROP_STALE_GENERATOR_JOBS_V203L:
        // Do not keep old Generator jobs polling forever from the shell.
        if (avaShellJobIsGenerator(job) && avaJobAgeMsV203L(job) > 20 * 60 * 1000) {
          changed = true
          continue
        }
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
              if (job.kind === 'mmaudio' && String(job.stage || '').replace(/_/g, '-') === 'generator') {
                await persistFinishedGeneratorMmaudioSnapshot(job, data)
              } else if (avaShellJobIsGenerator(job)) {
                await persistFinishedGeneratorSnapshot(job, data)
              }
              continue
            }
            rememberCompletedAvaJob(job, data)
            if (job.kind === 'mmaudio' && String(job.stage || '').replace(/_/g, '-') === 'generator') {
              await persistFinishedGeneratorMmaudioSnapshot(job, data)
            } else if (avaShellJobIsGenerator(job)) {
              await persistFinishedGeneratorSnapshot(job, data)
            } else {
              await persistFinishedJobToBoardSnapshot(job, data)
            }
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
  }, [refreshShellCredits, activeProject])

  function handleLogout() {
    logout()
    navigate('/')
  }

  function handleExitProject() {
    exitProject()
    navigate('/app/dashboard')
  }

  const shellModeClass = effectiveActiveProject ? 'isProjectMode' : 'isWorkspaceMode'
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

        <div className="avaSidebarProject" title={effectiveActiveProject?.name || 'Рабочая область'}>
          <span>{effectiveActiveProject ? `Проектный режим · ${projectTheme.name}` : 'Рабочая область'}</span>
          <strong>{effectiveActiveProject?.name || 'без проекта'}</strong>
          <small>{effectiveActiveProject?.format || 'автосохранение черновиков'}</small>
        </div>

        <NavLink className={({ isActive }) => `avaGhostButton ${isActive ? 'isActive' : ''}`} to="/app/settings" title="Настройки / Service Center">
          <Settings size={16} /> <span className="avaSidebarText">Настройки</span>
        </NavLink>
      </aside>

      <main className="avaMain">
        <header className="avaTopbar">
          <div className={`avaTopbarLeft ${effectiveActiveProject ? '' : 'isWorkspaceOnly'}`}>
            {effectiveActiveProject && <p>{`Проект открыт · ${effectiveActiveProject.format}`}</p>}
            <h1>{effectiveActiveProject ? effectiveActiveProject.name : 'ava-studio'}</h1>
          </div>
          <div className="avaTopbarRight">
            <span className="avaModePill">{effectiveActiveProject ? 'project mode' : 'workspace mode'}</span>
            <span className="avaSavePill">{lastSavedAt ? 'Сохранено' : 'autosave ready'}</span>
            <span className={`avaCreditPill ${shellCreditsRefreshing ? 'isRefreshing' : ''}`} title={shellCreditsRefreshing ? 'Обновляю баланс...' : 'Баланс кредитов'}>
                {displayCreditBalance !== null && displayCreditBalance !== undefined ? `${displayCreditBalance} credits` : 'credits'}
              </span>
            {effectiveActiveProject && (
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
