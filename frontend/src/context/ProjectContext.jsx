import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../services/apiClient.js'
import { useAuth } from './AuthContext.jsx'

const ProjectContext = createContext(null)
const ACTIVE_PROJECT_KEY = 'ava_active_project_id'

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
      setProjects(data.projects || [])
      const savedId = localStorage.getItem(ACTIVE_PROJECT_KEY)
      const selected = data.projects?.find((p) => p.id === savedId) || data.projects?.[0] || null
      setActiveProject(selected)
      if (selected) localStorage.setItem(ACTIVE_PROJECT_KEY, selected.id)
    } finally {
      setLoadingProjects(false)
    }
  }

  useEffect(() => {
    if (token) refreshProjects()
    else {
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
    localStorage.setItem(ACTIVE_PROJECT_KEY, data.project.id)
    await refreshProjects()
    return data.project
  }

  async function openProject(project) {
    setActiveProject(project)
    localStorage.setItem(ACTIVE_PROJECT_KEY, project.id)
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

  const value = useMemo(() => ({
    projects,
    activeProject,
    loadingProjects,
    lastSavedAt,
    refreshProjects,
    createProject,
    openProject,
    loadStage,
    saveStage,
  }), [projects, activeProject, loadingProjects, lastSavedAt])

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProjects() {
  const value = useContext(ProjectContext)
  if (!value) throw new Error('useProjects must be used inside ProjectProvider')
  return value
}
