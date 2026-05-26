import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Save } from 'lucide-react'
import { useProjects } from '../context/ProjectContext.jsx'

const labels = {
  manual_timing: ['Тайминг', 'Сюда подключаем старый Manual Timing как project/workspace-scoped page.'],
  podcast: ['Подкаст', 'Сюда подключаем Podcast Composer.'],
  board: ['Доска', 'Сюда подключаем Board для генерации сцен по частям.'],
  board_assembly: ['Сборка видео из Доски', 'Отдельная сборка готовых сцен из Доски. Это не Video Node.'],
  video_node: ['Video Node', 'Отдельная ветка для готовой нарезки видео+аудио и Video Match JSON.'],
  generator: ['Генератор', 'Быстрые тесты i2v / ia2v / first-last / image+audio.'],
}

export default function ModulePlaceholderPage({ stage }) {
  const { projectId } = useParams()
  const { loadStage, saveStage, loadWorkspaceStage, saveWorkspaceStage } = useProjects()
  const [note, setNote] = useState('')
  const [status, setStatus] = useState('')
  const [title, description] = labels[stage] || ['Модуль', '']
  const workspaceMode = !projectId

  useEffect(() => {
    let active = true
    async function load() {
      setStatus(workspaceMode ? 'Загружаем backend workspace…' : 'Загружаем project snapshot…')
      const data = workspaceMode ? await loadWorkspaceStage(stage) : await loadStage(projectId, stage)
      if (!active) return
      setNote(data.note || '')
      setStatus('')
    }
    load().catch((err) => setStatus(err.message))
    return () => { active = false }
  }, [projectId, stage, workspaceMode])

  useEffect(() => {
    if (!workspaceMode) return undefined
    const timer = window.setTimeout(async () => {
      try {
        await saveWorkspaceStage(stage, { note, workspace_saved_at: new Date().toISOString() })
        if (note.trim()) setStatus('Автосохранено в backend workspace')
      } catch (err) {
        setStatus(`Workspace autosave error: ${err.message}`)
      }
    }, 900)

    return () => window.clearTimeout(timer)
  }, [note, saveWorkspaceStage, stage, workspaceMode])

  async function save() {
    setStatus('Сохраняем…')

    if (workspaceMode) {
      const result = await saveWorkspaceStage(stage, { note, workspace_saved_at: new Date().toISOString() })
      setStatus(result.saved ? 'Сохранено в backend workspace' : 'Workspace не сохранён')
      return
    }

    const result = await saveStage(projectId, stage, { note, placeholder_saved_at: new Date().toISOString() })
    setStatus(result.saved ? 'Сохранено в snapshot проекта' : `Не перезаписано: ${result.reason}`)
  }

  return (
    <div className="avaPage avaNarrowPage">
      <div className="avaPanel">
        <p className="avaEyebrow">{workspaceMode ? 'backend workspace draft' : stage}</p>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="avaInfoBox">
          {workspaceMode
            ? 'Рабочая область теперь сохраняется на backend и привязана к аккаунту. Это база для будущих черновиков и восстановления после F5/перезахода.'
            : 'Сейчас это безопасная заглушка проекта. На следующих этапах сюда по одному подключаются реальные модули из старого проекта.'}
        </div>
        <label>
          Заметка для теста autosave
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={workspaceMode ? 'Напиши что угодно — backend workspace сохранит это после F5 и перезахода.' : 'Напиши что угодно и сохрани — это ляжет в project snapshot.'}
          />
        </label>
        <button className="avaPrimaryButton" onClick={save}><Save size={16} /> Сохранить snapshot</button>
        {status && <p className="avaTinyStatus">{status}</p>}
      </div>
    </div>
  )
}
