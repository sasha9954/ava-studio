import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Monitor, Smartphone, Square } from 'lucide-react'
import { useProjects } from '../context/ProjectContext.jsx'

const formatOptions = [
  { value: '16:9', title: 'Горизонталь', hint: '16:9', icon: Monitor },
  { value: '9:16', title: 'Вертикаль', hint: '9:16', icon: Smartphone },
  { value: '1:1', title: 'Квадрат', hint: '1:1', icon: Square },
]

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
      await createProject(form)
      navigate('/app/dashboard')
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

        <div className="avaFieldBlock">
          <span className="avaFieldLabel">Формат</span>
          <div className="avaFormatGrid" role="group" aria-label="Формат проекта">
            {formatOptions.map((option) => {
              const Icon = option.icon
              const active = form.format === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`avaFormatOption ${active ? 'isActive' : ''}`}
                  onClick={() => setField('format', option.value)}
                >
                  <Icon size={20} />
                  <strong>{option.title}</strong>
                  <small>{option.hint}</small>
                </button>
              )
            })}
          </div>
        </div>

        <label>Описание<textarea value={form.description} onChange={(e) => setField('description', e.target.value)} placeholder="Кратко: что это за видео/проект" /></label>
        <button className="avaPrimaryButton" disabled={loading}>{loading ? 'Создаём…' : 'Создать и открыть'}</button>
      </form>
    </div>
  )
}