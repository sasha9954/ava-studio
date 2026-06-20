import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  AudioLines,
  CheckCircle2,
  Clapperboard,
  Film,
  Folder,
  FolderPlus,
  GalleryHorizontalEnd,
  GitBranch,
  Mic2,
  Play,
  Scissors,
  Sparkles,
  WandSparkles,
} from 'lucide-react'
import { useProjects } from '../context/ProjectContext.jsx'
import { apiRequest } from '../services/apiClient.js'

const cards = [
  {
    stage: 'manual_timing',
    title: 'Тайминг',
    icon: AudioLines,
    text: 'Разбей аудио на сцены, фразы и смысловые блоки.',
    route: 'timing',
    status: 'workspace ready',
    tone: 'timing',
    preview: 'waveform',
  },
  {
    stage: 'podcast',
    title: 'Подкаст',
    icon: Mic2,
    text: 'Собери роли, реплики, паузы и финальное аудио.',
    route: 'podcast',
    status: 'workspace ready',
    tone: 'podcast',
    preview: 'podcast',
  },
  {
    stage: 'board',
    title: 'Доска',
    icon: GalleryHorizontalEnd,
    text: 'Сцены, кадры, промты, изображения и видео по частям.',
    route: 'board',
    status: 'foundation UI',
    tone: 'board',
    preview: 'board',
  },
  {
    stage: 'board_assembly',
    title: 'Видео монтаж',
    icon: Clapperboard,
    text: 'Склей готовые сцены Доски, оригинальное аудио, звук сцен и музыку.',
    route: 'board-assembly',
    status: 'assembly UI',
    tone: 'assembly',
    preview: 'assembly',
  },
  {
    stage: 'video_node',
    title: 'Видео нода',
    icon: GitBranch,
    text: 'Готовая нарезка видео+аудио и Video Match JSON.',
    route: 'video-node',
    status: 'Video Match ready',
    tone: 'node',
    preview: 'node',
  },
  {
    stage: 'generator',
    title: 'Генератор',
    icon: Film,
    text: 'Быстрые тесты i2v, ia2v, first-last и image+audio.',
    route: 'generator',
    status: 'standalone',
    tone: 'generator',
    preview: 'generator',
  },
]

const heroScenes = [
  { label: 'Сцена 01', time: '00:06', tone: 'city' },
  { label: 'Сцена 02', time: '00:08', tone: 'portrait' },
  { label: 'Сцена 03', time: '00:07', tone: 'mountain' },
  { label: 'Сцена 04', time: '00:09', tone: 'temple' },
  { label: 'Сцена 05', time: '00:05', tone: 'car' },
]

const pipelineChips = [
  { label: 'AI сценарий', tone: 'green', icon: Sparkles },
  { label: 'Генерация кадров', tone: 'violet', icon: GalleryHorizontalEnd },
  { label: 'Улучшение звука', tone: 'blue', icon: AudioLines },
  { label: 'Авто монтаж', tone: 'orange', icon: Scissors },
]

function formatMetric(stage, summary) {
  const data = summary?.[stage]
  if (!data) return ''

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

  return ''
}

function HeroWaveform() {
  const bars = [20, 36, 54, 74, 42, 68, 92, 58, 32, 72, 48, 88, 60, 36, 70, 96, 52, 28, 64, 84, 44, 34, 76, 55, 39, 66, 90, 50, 25, 62, 78, 46, 33, 72, 58, 40]
  return (
    <div className="avaDashHeroWave" aria-hidden="true">
      {bars.map((height, index) => <span key={`${height}-${index}`} style={{ '--h': `${height}%` }} />)}
    </div>
  )
}

function HeroPipeline() {
  return (
    <div className="avaDashPipeline" aria-hidden="true">
      <div className="avaDashPipelineChips">
        {pipelineChips.map((chip) => {
          const Icon = chip.icon
          return (
            <span key={chip.label} className={`avaDashPipelineChip is-${chip.tone}`}>
              <Icon size={15} /> {chip.label}
            </span>
          )
        })}
      </div>

      <div className="avaDashSceneStrip">
        {heroScenes.map((scene) => (
          <div key={scene.label} className={`avaDashSceneThumb is-${scene.tone}`}>
            <span>{scene.label}</span>
            <small>{scene.time}</small>
          </div>
        ))}
      </div>

      <div className="avaDashTimelineStage">
        <HeroWaveform />
        <div className="avaDashPlayhead"><i /></div>
        <div className="avaDashTrack is-video"><strong>CINEMATIC_SCENE_01.mp4</strong><span /></div>
        <div className="avaDashTrack is-audio"><strong>AMBIENT_SOUND.wav</strong><span /></div>
        <div className="avaDashTrack is-text"><strong>TEXT_OVERLAY_01</strong></div>
      </div>
    </div>
  )
}

function WaveformPreview() {
  const bars = [34, 70, 44, 82, 55, 38, 76, 90, 51, 62, 28, 70, 47, 92, 58, 43, 74, 39, 85, 52, 31, 69, 81, 45, 63]
  return (
    <div className="avaDashPreviewWaveform" aria-hidden="true">
      {bars.map((height, index) => <span key={`${height}-${index}`} style={{ '--h': `${height}%` }} />)}
      <i className="is-marker-one" />
      <i className="is-marker-two" />
    </div>
  )
}

function PodcastPreview() {
  return (
    <div className="avaDashPodcastPreview" aria-hidden="true">
      {['Ведущий', 'Гость', 'Музыка', 'Эффекты'].map((label, index) => (
        <div key={label}>
          <span>{index === 2 ? '♪' : index === 3 ? '✦' : label[0]}</span>
          <strong>{label}</strong>
          <i />
        </div>
      ))}
    </div>
  )
}

function BoardPreview() {
  return (
    <div className="avaDashBoardPreview" aria-hidden="true">
      <span className="is-shot-one" />
      <span className="is-shot-two" />
      <span className="is-shot-three" />
      <span className="is-shot-four" />
      <em>ФИНАЛЬНАЯ<br />СЦЕНА ↘</em>
    </div>
  )
}

function AssemblyPreview() {
  return (
    <div className="avaDashAssemblyPreview" aria-hidden="true">
      <div className="avaDashFilmstrip">
        <span /><span /><span /><span /><span />
      </div>
      <div className="avaDashAudioLine is-pink" />
      <div className="avaDashAudioLine is-green" />
    </div>
  )
}

function NodePreview() {
  return (
    <div className="avaDashNodePreview" aria-hidden="true">
      <span className="n1">Video In</span>
      <span className="n2">Video In</span>
      <span className="n3">Cut_1</span>
      <span className="n4">Trans_1</span>
      <span className="n5">Audio</span>
      <em>Export JSON</em>
    </div>
  )
}

function GeneratorPreview() {
  return (
    <div className="avaDashGeneratorPreview" aria-hidden="true">
      <div className="avaDashEnergyOrb" />
      <span /><span /><span />
    </div>
  )
}

function ModulePreview({ type }) {
  if (type === 'waveform') return <WaveformPreview />
  if (type === 'podcast') return <PodcastPreview />
  if (type === 'board') return <BoardPreview />
  if (type === 'assembly') return <AssemblyPreview />
  if (type === 'node') return <NodePreview />
  if (type === 'generator') return <GeneratorPreview />
  return null
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

  const workspaceLabel = useMemo(() => {
    if (activeProject) return `Проектный режим: ${activeProject.name}`
    return 'Рабочая область: начать без проекта'
  }, [activeProject])

  return (
    <div className="avaPage avaDashboardV2">
      <section className="avaDashHeroPanel">
        <div className="avaDashHeroCopy">
          <p className="avaDashEyebrow"><Sparkles size={15} /> Добро пожаловать в Ava Studio</p>
          <h2><span>Ava Studio —</span> визуальная студия</h2>
          <p>
            Создавайте истории, которые вдохновляют. От идеи до финального кадра — всё в одном пространстве с поддержкой AI.
          </p>
          <div className="avaDashHeroActions">
            <Link className="avaDashPrimaryButton" to="/app/projects/new"><FolderPlus size={18} /> Создать проект</Link>
            <Link className="avaDashSecondaryButton" to="/app/projects"><Folder size={18} /> Мои проекты</Link>
          </div>
          <div className="avaDashHeroStatus">
            <span><CheckCircle2 size={14} /> Система готова к работе</span>
            <i />
            <span>Все сервисы активны</span>
          </div>
        </div>
        <HeroPipeline />
      </section>

      <div className="avaDashSectionHeader">
        <div>
          <h3><Sparkles size={18} /> Модули Ava Studio</h3>
          {summaryStatus && <p className="avaDashTinyStatus">{summaryStatus}</p>}
        </div>
        <span>{workspaceLabel}</span>
      </div>

      <div className="avaDashModuleGrid">
        {cards.map((card) => {
          const Icon = card.icon
          const to = activeProject ? `/app/projects/${activeProject.id}/${card.route}` : `/app/workspace/${card.route}`
          const metric = formatMetric(card.stage, summary)
          return (
            <Link key={card.stage} to={to} className={`avaDashModuleCard is-${card.tone}`}>
              <div className="avaDashModuleTopline">
                <span className="avaDashModuleIcon"><Icon size={24} /></span>
                <span className="avaDashModuleArrow"><ArrowRight size={18} /></span>
              </div>
              <div className="avaDashModuleText">
                <h4>{card.title}</h4>
                <p>{card.text}</p>
              </div>
              <ModulePreview type={card.preview} />
              <div className="avaDashModuleFooter">
                <span className="avaDashModuleStatus"><CheckCircle2 size={13} /> {card.status}</span>
                {metric && <small>{metric}</small>}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
