/* AVA_CREATE_PROJECT_REDIRECT_DASHBOARD_V11: after project creation return to main dashboard, not Board. */
/* AVA_CREATE_PROJECT_MODE_DROPDOWN_V5: project mode is a compact dropdown, no separate type picker and no mode cards. */
/* AVA_CREATE_PROJECT_MODE_ONLY_V4: replace project type selector with project mode picker only. */
/* AVA_PROJECT_MODE_PICKER_COMPACT_V3: compact mode cards, no long descriptions/contracts in UI. */
/* AVA_PROJECT_MODE_PICKER_UI_V2: styled project mode cards instead of plain select. */
/* AVA_PROJECT_MODES_PACK_V1: project mode selector on create project. */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Monitor, Smartphone, Square } from 'lucide-react'
import { useProjects } from '../context/ProjectContext.jsx'
import { createProjectModes, isProjectModeSelectable, normalizeProjectMode } from '../lib/projectModes.js'

const formatOptions = [
  { value: '16:9', title: 'Горизонталь', hint: '16:9', icon: Monitor },
  { value: '9:16', title: 'Вертикаль', hint: '9:16', icon: Smartphone },
  { value: '1:1', title: 'Квадрат', hint: '1:1', icon: Square },
]

export default function CreateProjectPage() {
  const { createProject } = useProjects()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', type: 'clip', format: '16:9', description: '', projectModeId: 'manual_general_v1' })
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
      const payload = { ...form, type: 'clip', project_mode: normalizeProjectMode(form.projectModeId) }
      delete payload.projectModeId
      const project = await createProject(payload)
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
        <label className="avaProjectModeDropdownV5">Режим проекта
          <select value={form.projectModeId} onChange={(e) => setField('projectModeId', e.target.value)}>
            {/* AVA_PROJECT_MODES_CREATE_LIST_V74 */}
            {createProjectModes().map((mode) => {
              const selectable = isProjectModeSelectable(mode)
              return (
                <option key={mode.id} value={mode.id} disabled={!selectable}>
                  {mode.label_ru}{selectable ? '' : ' — скоро'}
                </option>
              )
            })}
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