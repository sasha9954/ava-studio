import { useEffect, useMemo, useState } from 'react'
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
  const { loadStage, saveStage, markWorkspaceSaved } = useProjects()
  const [note, setNote] = useState('')
  const [status, setStatus] = useState('')
  const [title, description] = labels[stage] || ['Модуль', '']
  const workspaceMode = !projectId

  const workspaceKey = useMemo(() => `ava_workspace_${stage}`, [stage])

  useEffect(() => {
    let active = true
    async function load() {
      if (workspaceMode) {
        const raw = localStorage.getItem(workspaceKey)
        const data = raw ? JSON.parse(raw) : {}
        if (active) setNote(data.note || '')
        return
      }

      const data = await loadStage(projectId, stage)
      if (active) setNote(data.note || '')
    }
    load().catch((err) => setStatus(err.message))
    return () => { active = false }
  }, [projectId, stage, workspaceKey, workspaceMode])

  useEffect(() => {
    if (!workspaceMode) return undefined
    const timer = window.setTimeout(() => {
      localStorage.setItem(workspaceKey, JSON.stringify({ note, workspace_saved_at: new Date().toISOString() }))
      markWorkspaceSaved()
      if (note.trim()) setStatus('Автосохранено в рабочую область')
    }, 700)

    return () => window.clearTimeout(timer)
  }, [markWorkspaceSaved, note, workspaceKey, workspaceMode])

  async function save() {
    setStatus('Сохраняем…')

    if (workspaceMode) {
      localStorage.setItem(workspaceKey, JSON.stringify({ note, workspace_saved_at: new Date().toISOString() }))
      markWorkspaceSaved()
      setStatus('Сохранено в рабочую область браузера')
      return
    }

    const result = await saveStage(projectId, stage, { note, placeholder_saved_at: new Date().toISOString() })
    setStatus(result.saved ? 'Сохранено в snapshot проекта' : `Не перезаписано: ${result.reason}`)
  }

  return (
    <div className="avaPage avaNarrowPage">
      <div className="avaPanel">
        <p className="avaEyebrow">{workspaceMode ? 'workspace draft' : stage}</p>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="avaInfoBox">
          {workspaceMode
            ? 'Сейчас это рабочая область без проекта. На Stage 2 черновики будут сохраняться на backend и чиститься системой через 2–3 дня.'
            : 'Сейчас это безопасная заглушка проекта. На следующих этапах сюда по одному подключаются реальные модули из старого проекта.'}
        </div>
        <label>
          Заметка для теста autosave
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={workspaceMode ? 'Напиши что угодно — рабочая область сохранит это после F5.' : 'Напиши что угодно и сохрани — это ляжет в project snapshot.'}
          />
        </label>
        <button className="avaPrimaryButton" onClick={save}><Save size={16} /> Сохранить snapshot</button>
        {status && <p className="avaTinyStatus">{status}</p>}
      </div>
    </div>
  )
}
