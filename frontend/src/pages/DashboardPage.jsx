import { Link } from 'react-router-dom'
import { AudioLines, Brain, Clapperboard, Film, FolderPlus, GalleryHorizontalEnd, GitBranch, Scissors, Sparkles } from 'lucide-react'
import { useProjects } from '../context/ProjectContext.jsx'

const cards = [
  { stage: 'manual_timing', title: 'Тайминг', icon: AudioLines, text: 'Разбей аудио на сцены, фразы и смысловые блоки.', route: 'timing', status: 'workspace ready', metric: 'Аудио: пока нет' },
  { stage: 'podcast', title: 'Подкаст', icon: Scissors, text: 'Собери роли, реплики, паузы и финальное аудио.', route: 'podcast', status: 'workspace ready', metric: 'Роли: 0' },
  { stage: 'board', title: 'Доска', icon: GalleryHorizontalEnd, text: 'Сцены, кадры, промты, изображения и видео по частям.', route: 'board', status: 'soon integration', metric: 'Сцены: 0' },
  { stage: 'board_assembly', title: 'Сборка видео', icon: Clapperboard, text: 'Склей сгенерированные сцены Доски в полный ролик.', route: 'board-assembly', status: 'separate from Video Node', metric: 'Видео: 0' },
  { stage: 'video_node', title: 'Video Node', icon: GitBranch, text: 'Готовая нарезка видео+аудио и Video Match JSON.', route: 'video-node', status: 'different workflow', metric: 'Кандидаты: 0' },
  { stage: 'generator', title: 'Генератор', icon: Film, text: 'Быстрые тесты i2v, ia2v, first-last и image+audio.', route: 'generator', status: 'standalone', metric: 'Тесты: 0' },
]

export default function DashboardPage() {
  const { activeProject } = useProjects()

  return (
    <div className="avaPage">
      <section className="avaHeroPanel">
        <div>
          <p className="avaEyebrow"><Sparkles size={15} /> Stage 2 direction</p>
          <h2>Главная рабочая панель</h2>
          <p>
            Начинай сразу в рабочей области — черновики автосохраняются. Для долгой работы создай или открой проект.
          </p>
          <div className="avaHeroActions">
            <Link className="avaPrimaryButton" to="/app/projects/new"><FolderPlus size={17} /> Создать проект</Link>
            <Link className="avaSecondaryButton" to="/app/projects">Мои проекты</Link>
          </div>
        </div>
        <div className="avaHeroBrain"><Brain size={92} /></div>
      </section>

      <div className="avaSectionHeader">
        <h3>Модули ava-studio</h3>
        <span>{activeProject ? `Проектный режим: ${activeProject.name}` : 'Рабочая область: можно начать без проекта'}</span>
      </div>

      <div className="avaModuleGrid">
        {cards.map((card) => {
          const Icon = card.icon
          const to = activeProject ? `/app/projects/${activeProject.id}/${card.route}` : `/app/workspace/${card.route}`
          return (
            <Link key={card.stage} to={to} className="avaModuleCard avaProjectLinkedModule">
              <div className="avaModuleIcon"><Icon size={24} /></div>
              <div>
                <h4>{card.title}</h4>
                <p>{card.text}</p>
              </div>
              {activeProject && <div className="avaModuleMetric">{card.metric}</div>}
              <span className="avaModuleStatus">{card.status}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
