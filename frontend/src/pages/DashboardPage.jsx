import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AudioLines, Brain, Clapperboard, Film, FolderPlus, GalleryHorizontalEnd, GitBranch, Scissors, Sparkles } from 'lucide-react'
import { useProjects } from '../context/ProjectContext.jsx'
import { apiRequest } from '../services/apiClient.js'

const cards = [
  { stage: 'manual_timing', title: 'Тайминг', icon: AudioLines, text: 'Разбей аудио на сцены, фразы и смысловые блоки.', route: 'timing', status: 'workspace ready' },
  { stage: 'podcast', title: 'Подкаст', icon: Scissors, text: 'Собери роли, реплики, паузы и финальное аудио.', route: 'podcast', status: 'workspace ready' },
  { stage: 'board', title: 'Доска', icon: GalleryHorizontalEnd, text: 'Сцены, кадры, промты, изображения и видео по частям.', route: 'board', status: 'soon integration' },
  { stage: 'board_assembly', title: 'Сборка видео', icon: Clapperboard, text: 'Склей сгенерированные сцены Доски в полный ролик.', route: 'board-assembly', status: 'separate from Video Node' },
  { stage: 'video_node', title: 'Video Node', icon: GitBranch, text: 'Готовая нарезка видео+аудио и Video Match JSON.', route: 'video-node', status: 'different workflow' },
  { stage: 'generator', title: 'Генератор', icon: Film, text: 'Быстрые тесты i2v, ia2v, first-last и image+audio.', route: 'generator', status: 'standalone' },
]

function formatMetric(stage, summary) {
  const data = summary?.[stage]
  if (!data) return 'Нет данных'

  if (stage === 'manual_timing') {
    return data.audio_loaded ? `Аудио есть · сцен ${data.scenes_count} · фраз ${data.phrases_count}` : 'Аудио: пока нет'
  }

  if (stage === 'podcast') {
    return data.audio_loaded ? `Аудио есть · ролей ${data.roles_count}` : `Роли: ${data.roles_count}`
  }

  if (stage === 'board') {
    return `Сцен ${data.scenes_count} · фото ${data.images_count} · видео ${data.videos_count}`
  }

  if (stage === 'board_assembly') {
    return data.final_video_ready ? 'Финальное видео готово' : `Готовых видео: ${data.ready_videos_count}`
  }

  if (stage === 'video_node') {
    return data.final_video_ready ? 'Финальное видео готово' : `Сегментов ${data.segments_count} · кандидатов ${data.candidates_count}`
  }

  if (stage === 'generator') {
    return `Jobs ${data.jobs_count} · готово ${data.completed_count}`
  }

  return 'Нет данных'
}

export default function DashboardPage() {
  const { activeProject } = useProjects()
  const [summary, setSummary] = useState(null)
  const [summaryStatus, setSummaryStatus] = useState('')

  useEffect(() => {
    let active = true

    async function loadSummary() {
      if (!activeProject) {
        setSummary(null)
        setSummaryStatus('')
        return
      }

      setSummaryStatus('Загружаем данные проекта…')
      try {
        const data = await apiRequest(`/projects/${activeProject.id}/summary`)
        if (!active) return
        setSummary(data.summary || {})
        setSummaryStatus('')
      } catch (err) {
        if (!active) return
        setSummaryStatus(`Summary недоступен: ${err.message}`)
      }
    }

    loadSummary()
    return () => { active = false }
  }, [activeProject])

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
      {summaryStatus && <div className="avaTinyStatus">{summaryStatus}</div>}

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
              {activeProject && <div className="avaModuleMetric">{formatMetric(card.stage, summary)}</div>}
              <span className="avaModuleStatus">{card.status}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
