import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../services/apiClient.js'
import { useAuth } from './AuthContext.jsx'

const ProjectContext = createContext(null)
const ACTIVE_PROJECT_SESSION_KEY = 'ava_active_project_id'

function countBoardSceneMediaRefs(data = {}) {
  const scenes = Array.isArray(data?.scenes) ? data.scenes : []
  let boardScenesWithVideoRefs = 0
  let boardScenesWithImageRefs = 0
  for (const scene of scenes) {
    if (!scene || typeof scene !== 'object') continue
    if (
      scene.video_asset_id || scene.videoAssetId ||
      scene.video_api_path || scene.videoApiPath ||
      scene.video_url || scene.videoUrl ||
      scene.mmaudio_video_api_path || scene.mmaudioVideoApiPath
    ) boardScenesWithVideoRefs += 1
    if (
      scene.image_asset_id || scene.imageAssetId ||
      scene.image_api_path || scene.imageApiPath ||
      scene.first_image_asset_id || scene.firstImageAssetId ||
      scene.first_image_api_path || scene.firstImageApiPath ||
      scene.last_image_asset_id || scene.lastImageAssetId ||
      scene.last_image_api_path || scene.lastImageApiPath
    ) boardScenesWithImageRefs += 1
  }
  return { boardScenesWithVideoRefs, boardScenesWithImageRefs }
}

function countRuntimeMediaValues(value, depth = 0) {
  if (!value || depth > 8) return 0
  if (typeof value === 'string') return /^(blob:|data:)/i.test(value) ? 1 : 0
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + countRuntimeMediaValues(item, depth + 1), 0)
  if (typeof value === 'object') return Object.values(value).reduce((sum, item) => sum + countRuntimeMediaValues(item, depth + 1), 0)
  return 0
}

function logProjectSaveMediaRefsSummary(stage, data = {}, scope = 'project') {
  const boardCounts = countBoardSceneMediaRefs(data)
  console.log('[PROJECT SAVE MEDIA REFS SUMMARY]', {
    scope,
    stage,
    ...boardCounts,
    podcastAudioRefs: Number(Boolean(data?.podcast_audio_asset_id || data?.podcastAudioAssetId || data?.audioAssetId || data?.audio_asset_id || data?.audio?.assetId || data?.audio?.asset_id)),
    assemblyRefs: Number(Boolean(data?.assembly_asset_id || data?.assemblyAssetId || data?.assembly_api_path || data?.assemblyApiPath || data?.assemblyUrl || data?.finalVideoUrl)),
    videoNodeRefs: Number(Boolean(data?.sourceVideos?.length || data?.source_videos?.length || data?.assembledPreview || data?.assembly_asset_id || data?.assemblyApiPath)),
    removedRuntimeBlobCount: countRuntimeMediaValues(data),
    preservedAssetRefsCount: 0,
  })
}

export function ProjectProvider({ children }) {
  const { token } = useAuth()
  const [projects, setProjects] = useState([])
  const [activeProject, setActiveProject] = useState(null)
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState(null)

  async function refreshProjects() {
    if (!token) return
    setLoadingProjects(true)
    try {
      const data = await apiRequest('/projects')
      const loadedProjects = data.projects || []
      setProjects(loadedProjects)

      // После обычного входа пользователь не должен автоматически попадать
      // в старый проект. Проектный режим восстанавливаем только в рамках
      // текущей браузерной сессии/F5 через sessionStorage.
      const sessionProjectId = sessionStorage.getItem(ACTIVE_PROJECT_SESSION_KEY)
      const selected = loadedProjects.find((p) => p.id === sessionProjectId) || null
      setActiveProject(selected)
      if (!selected) sessionStorage.removeItem(ACTIVE_PROJECT_SESSION_KEY)
    } finally {
      setLoadingProjects(false)
    }
  }

  useEffect(() => {
    if (token) refreshProjects()
    else {
      sessionStorage.removeItem(ACTIVE_PROJECT_SESSION_KEY)
      setProjects([])
      setActiveProject(null)
    }
  }, [token])

  async function createProject(payload) {
    const data = await apiRequest('/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    setActiveProject(data.project)
    sessionStorage.setItem(ACTIVE_PROJECT_SESSION_KEY, data.project.id)
    await refreshProjects()
    return data.project
  }

  async function openProject(project) {
    setActiveProject(project)
    sessionStorage.setItem(ACTIVE_PROJECT_SESSION_KEY, project.id)
  }

  function exitProject() {
    sessionStorage.removeItem(ACTIVE_PROJECT_SESSION_KEY)
    setActiveProject(null)
  }

  async function deleteProject(projectId) {
    await apiRequest(`/projects/${projectId}`, { method: 'DELETE' })
    if (activeProject?.id === projectId) {
      exitProject()
    }
    await refreshProjects()
  }

  async function loadStage(projectId, stage) {
    const data = await apiRequest(`/projects/${projectId}/snapshots/${stage}`)
    return data.snapshot?.data || {}
  }

  async function saveStage(projectId, stage, data, guardMode = 'safe_merge') {
    logProjectSaveMediaRefsSummary(stage, data, 'project')
    const response = await apiRequest(`/projects/${projectId}/snapshots/${stage}`, {
      method: 'POST',
      body: JSON.stringify({ data, guard_mode: guardMode, client_version: 'ava-shell-v0.1' }),
    })
    if (response.saved) setLastSavedAt(new Date().toISOString())
    return response
  }

  async function loadWorkspaceStage(stage) {
    const data = await apiRequest(`/workspace/snapshots/${stage}`)
    return data.snapshot?.data || {}
  }

  async function saveWorkspaceStage(stage, data) {
    logProjectSaveMediaRefsSummary(stage, data, 'workspace')
    const response = await apiRequest(`/workspace/snapshots/${stage}`, {
      method: 'POST',
      body: JSON.stringify({ data, guard_mode: 'safe_merge', client_version: 'ava-shell-v0.1' }),
    })
    if (response.saved) setLastSavedAt(new Date().toISOString())
    return response
  }

  async function clearWorkspace() {
    const response = await apiRequest('/workspace/current', { method: 'DELETE' })
    setLastSavedAt(new Date().toISOString())
    return response
  }

  function markWorkspaceSaved() {
    setLastSavedAt(new Date().toISOString())
  }

  const value = useMemo(() => ({
    projects,
    activeProject,
    loadingProjects,
    lastSavedAt,
    refreshProjects,
    createProject,
    openProject,
    exitProject,
    deleteProject,
    loadStage,
    saveStage,
    loadWorkspaceStage,
    saveWorkspaceStage,
    clearWorkspace,
    markWorkspaceSaved,
  }), [projects, activeProject, loadingProjects, lastSavedAt])

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProjects() {
  const value = useContext(ProjectContext)
  if (!value) throw new Error('useProjects must be used inside ProjectProvider')
  return value
}
