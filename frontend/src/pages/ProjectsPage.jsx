import { Link, useNavigate } from 'react-router-dom'
import { FolderKanban, Plus, Trash2 } from 'lucide-react'
import { useProjects } from '../context/ProjectContext.jsx'
import { getProjectCardStyle, getProjectTheme } from '../utils/projectTheme.js'

export default function ProjectsPage() {
  const { projects, activeProject, openProject, deleteProject, loadingProjects } = useProjects()
  const navigate = useNavigate()

  async function handleOpenProject(project) {
    await openProject(project)
    navigate('/app/dashboard')
  }

  async function handleDeleteProject(event, project) {
    event.stopPropagation()
    const ok = window.confirm(`Удалить проект “${project.name}”? Он исчезнет из списка проектов.`)
    if (!ok) return
    await deleteProject(project.id)
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
                onClick={(event) => handleDeleteProject(event, project)}
                title="Удалить проект"
                aria-label={`Удалить проект ${project.name}`}
              >
                <Trash2 size={15} />
              </button>
            </button>
          )
        })}
      </div>
    </div>
  )
}