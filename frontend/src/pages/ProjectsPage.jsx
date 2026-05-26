import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, FolderKanban, Plus, Trash2, X } from 'lucide-react'
import { useProjects } from '../context/ProjectContext.jsx'
import { getProjectCardStyle, getProjectTheme } from '../utils/projectTheme.js'

export default function ProjectsPage() {
  const { projects, activeProject, openProject, deleteProject, loadingProjects } = useProjects()
  const navigate = useNavigate()
  const [projectToDelete, setProjectToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  async function handleOpenProject(project) {
    await openProject(project)
    navigate('/app/dashboard')
  }

  function requestDeleteProject(event, project) {
    event.stopPropagation()
    setProjectToDelete(project)
  }

  async function confirmDeleteProject() {
    if (!projectToDelete) return
    setDeleting(true)
    try {
      await deleteProject(projectToDelete.id)
      setProjectToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  function cancelDeleteProject() {
    if (deleting) return
    setProjectToDelete(null)
  }

  return (
    <div className="avaPage">
      <div className="avaSectionHeader">
        <div>
          <h2>Мои проекты</h2>
          <p>Проекты привязаны только к текущему аккаунту. Цвет помогает не перепутать активную работу.</p>
        </div>
        <Link className="avaPrimaryButton" to="/app/projects/new"><Plus size={17} /> Создать проект</Link>
      </div>

      {loadingProjects && <div className="avaInfoBox">Загрузка проектов…</div>}

      {!loadingProjects && projects.length === 0 && (
        <div className="avaEmptyState">
          <FolderKanban size={44} />
          <h3>Проектов пока нет</h3>
          <p>Можно работать в рабочей области без проекта или создать долгий проект для хранения.</p>
          <Link className="avaPrimaryButton" to="/app/projects/new">Создать первый проект</Link>
        </div>
      )}

      <div className="avaProjectGrid">
        {projects.map((project) => {
          const theme = getProjectTheme(project, projects)
          return (
            <button
              key={project.id}
              className={`avaProjectCard ${activeProject?.id === project.id ? 'isActive' : ''}`}
              style={getProjectCardStyle(project, projects)}
              onClick={() => handleOpenProject(project)}
            >
              <i className="avaProjectColorDot" />
              <span>{project.type} · {theme.name}</span>
              <h3>{project.name}</h3>
              <p>{project.description || 'Описание пока не добавлено'}</p>
              <small>{project.format} · {project.status} · {new Date(project.updated_at).toLocaleString()}</small>
              <em className="avaProjectOpenHint">Открыть проект</em>
              <button
                className="avaProjectDeleteButton"
                type="button"
                onClick={(event) => requestDeleteProject(event, project)}
                title="Удалить проект"
                aria-label={`Удалить проект ${project.name}`}
              >
                <Trash2 size={15} />
              </button>
            </button>
          )
        })}
      </div>

      {projectToDelete && (
        <div className="avaModalOverlay" role="presentation" onMouseDown={cancelDeleteProject}>
          <div
            className="avaConfirmModal"
            style={getProjectCardStyle(projectToDelete, projects)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ava-delete-project-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="avaModalClose" type="button" onClick={cancelDeleteProject} aria-label="Закрыть" disabled={deleting}>
              <X size={18} />
            </button>
            <div className="avaConfirmIcon"><AlertTriangle size={26} /></div>
            <p className="avaEyebrow">Удаление проекта</p>
            <h3 id="ava-delete-project-title">Удалить “{projectToDelete.name}”?</h3>
            <p>
              Проект исчезнет из списка. На этом этапе удаление безопасное: данные помечаются как удалённые,
              а физическую очистку файлов добавим позже через корзину/хранилище.
            </p>
            <div className="avaModalActions">
              <button className="avaDangerButton" type="button" onClick={confirmDeleteProject} disabled={deleting}>
                <Trash2 size={16} /> {deleting ? 'Удаляем…' : 'Удалить'}
              </button>
              <button className="avaSecondaryButton" type="button" onClick={cancelDeleteProject} disabled={deleting}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}