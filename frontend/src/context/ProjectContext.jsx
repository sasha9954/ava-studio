import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../services/apiClient.js'
import { useAuth } from './AuthContext.jsx'

const ProjectContext = createContext(null)
const ACTIVE_PROJECT_SESSION_KEY = 'ava_active_project_id'

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
    const response = await apiRequest(`/projects/${projectId}/snapshots/${stage}`, {
      method: 'POST',
      body: JSON.stringify({ data, guard_mode: guardMode, client_version: 'ava-shell-v0.1' }),
    })
    if (response.saved) setLastSavedAt(new Date().toISOString())
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
    markWorkspaceSaved,
  }), [projects, activeProject, loadingProjects, lastSavedAt])

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProjects() {
  const value = useContext(ProjectContext)
  if (!value) throw new Error('useProjects must be used inside ProjectProvider')
  return value
}
