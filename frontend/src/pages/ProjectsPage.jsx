import { Link } from 'react-router-dom'
import { FolderKanban, Plus } from 'lucide-react'
import { useProjects } from '../context/ProjectContext.jsx'

export default function ProjectsPage() {
  const { projects, activeProject, openProject, loadingProjects } = useProjects()

  return (
    <div className="avaPage">
      <div className="avaSectionHeader">
        <div>
          <h2>Мои проекты</h2>
          <p>Все сохранения будут привязаны к аккаунту и выбранному проекту.</p>
        </div>
        <Link className="avaPrimaryButton" to="/app/projects/new"><Plus size={17} /> Создать проект</Link>
      </div>

      {loadingProjects && <div className="avaInfoBox">Загрузка проектов…</div>}

      {!loadingProjects && projects.length === 0 && (
        <div className="avaEmptyState">
          <FolderKanban size={44} />
          <h3>Проектов пока нет</h3>
          <p>Создай первый проект, чтобы начать собирать тайминг, доску и видео.</p>
          <Link className="avaPrimaryButton" to="/app/projects/new">Создать первый проект</Link>
        </div>
      )}

      <div className="avaProjectGrid">
        {projects.map((project) => (
          <button key={project.id} className={`avaProjectCard ${activeProject?.id === project.id ? 'isActive' : ''}`} onClick={() => openProject(project)}>
            <span>{project.type}</span>
            <h3>{project.name}</h3>
            <p>{project.description || 'Описание пока не добавлено'}</p>
            <small>{project.format} · {project.status} · {new Date(project.updated_at).toLocaleString()}</small>
          </button>
        ))}
      </div>
    </div>
  )
}
