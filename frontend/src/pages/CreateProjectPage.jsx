import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjects } from '../context/ProjectContext.jsx'

export default function CreateProjectPage() {
  const { createProject } = useProjects()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', type: 'clip', format: '16:9', description: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const project = await createProject(form)
      navigate(`/app/projects/${project.id}/timing`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="avaPage avaNarrowPage">
      <form className="avaPanel" onSubmit={submit}>
        <p className="avaEyebrow">Новый проект</p>
        <h2>Создать проект</h2>
        <p>Проект будет хранить все этапы: аудио, тайминг, доску, видео, сборку и генератор.</p>
        {error && <div className="avaError">{error}</div>}
        <label>Название проекта<input value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Например: Greenland clip" required /></label>
        <label>Тип проекта
          <select value={form.type} onChange={(e) => setField('type', e.target.value)}>
            <option value="clip">Клип</option>
            <option value="documentary">Документалка</option>
            <option value="podcast">Подкаст</option>
            <option value="video_match">Video Match</option>
            <option value="test">Тест генерации</option>
            <option value="empty">Пустой проект</option>
          </select>
        </label>
        <label>Формат
          <select value={form.format} onChange={(e) => setField('format', e.target.value)}>
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
            <option value="1:1">1:1</option>
          </select>
        </label>
        <label>Описание<textarea value={form.description} onChange={(e) => setField('description', e.target.value)} placeholder="Кратко: что это за видео/проект" /></label>
        <button className="avaPrimaryButton" disabled={loading}>{loading ? 'Создаём…' : 'Создать и открыть'}</button>
      </form>
    </div>
  )
}
