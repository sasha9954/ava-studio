import { Link, useNavigate } from 'react-router-dom'
import { FolderKanban, Plus } from 'lucide-react'
import { useProjects } from '../context/ProjectContext.jsx'

export default function ProjectsPage() {
  const { projects, activeProject, openProject, loadingProjects } = useProjects()
  const navigate = useNavigate()

  async function handleOpenProject(project) {
    await openProject(project)
    navigate('/app/dashboard')
  }

  return (
    <div className="avaPage">
      <div className="avaSectionHeader">
        <div>
          <h2>Мои проекты</h2>
          <p>Проекты привязаны только к текущему аккаунту. Открой проект — и UI перейдёт в проектный режим.</p>
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
        {projects.map((project) => (
          <button key={project.id} className={`avaProjectCard ${activeProject?.id === project.id ? 'isActive' : ''}`} onClick={() => handleOpenProject(project)}>
            <span>{project.type}</span>
            <h3>{project.name}</h3>
            <p>{project.description || 'Описание пока не добавлено'}</p>
            <small>{project.format} · {project.status} · {new Date(project.updated_at).toLocaleString()}</small>
            <em className="avaProjectOpenHint">Открыть проект</em>
          </button>
        ))}
      </div>
    </div>
  )
}