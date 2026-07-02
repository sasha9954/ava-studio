import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useProjects } from '../context/ProjectContext.jsx'
import { apiRequest } from '../services/apiClient.js'
import { DEFAULT_RULE_PACKS_V207A } from '../content/rules/defaultRulePacks.js'

const STAGE = 'rules_packs'
const SCHEMA = 'ava_rules_packs_v1'
const CLIENT_VERSION = 'rules-packs-v207a'

function nowIso() {
  return new Date().toISOString()
}

function formatDate(value = '') {
  if (!value) return 'ещё не сохранено'
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return String(value)
  }
}

function formatBytes(value = 0) {
  const bytes = Number(value || 0)
  if (!bytes) return '0 Б'
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(2)} МБ`
}

function base64ToBlob(base64 = '', type = 'application/zip') {
  const binary = atob(String(base64 || ''))
  const chunks = []
  for (let i = 0; i < binary.length; i += 8192) {
    const slice = binary.slice(i, i + 8192)
    const bytes = new Uint8Array(slice.length)
    for (let j = 0; j < slice.length; j += 1) bytes[j] = slice.charCodeAt(j)
    chunks.push(bytes)
  }
  return new Blob(chunks, { type })
}

function downloadBase64(base64, filename) {
  const blob = base64ToBlob(base64)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename || 'ava_rules_pack.zip'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 500)
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const raw = String(reader.result || '')
      resolve(raw.includes(',') ? raw.split(',').pop() : raw)
    }
    reader.onerror = () => reject(reader.error || new Error('Не удалось прочитать файл'))
    reader.readAsDataURL(file)
  })
}

function templatePack(id) {
  const template = DEFAULT_RULE_PACKS_V207A[id]
  if (!template) return null
  const base64 = String(template.base64 || '')
  const bytes = base64 ? base64ToBlob(base64).size : 0
  return {
    id: template.id,
    title: template.title,
    subtitle: template.subtitle,
    filename: template.filename,
    originalFilename: template.originalFilename || template.filename,
    kind: template.kind,
    status: template.status,
    version: Number(template.version || 1),
    size: bytes,
    base64,
    updatedAt: template.starterUpdatedAt || '',
    starterUpdatedAt: template.starterUpdatedAt || '',
    history: [
      {
        version: Number(template.version || 1),
        filename: template.filename,
        updatedAt: template.starterUpdatedAt || '',
        note: 'Стартовый ZIP-шаблон',
        size: bytes,
      },
    ],
  }
}

function buildDefaultData() {
  const packs = {}
  Object.keys(DEFAULT_RULE_PACKS_V207A).forEach((id) => {
    packs[id] = templatePack(id)
  })
  return {
    schema: SCHEMA,
    updatedAt: '',
    packs,
  }
}

function mergeWithDefaults(data = {}) {
  const defaults = buildDefaultData()
  const incomingPacks = data && typeof data === 'object' && data.packs && typeof data.packs === 'object'
    ? data.packs
    : {}
  return {
    ...defaults,
    ...(data && typeof data === 'object' ? data : {}),
    schema: SCHEMA,
    packs: {
      ...defaults.packs,
      ...incomingPacks,
    },
  }
}

function localStorageKey(projectId = '') {
  return projectId ? `ava_rules_packs_project_${projectId}` : 'ava_rules_packs_workspace'
}

function safeJsonParse(raw = '') {
  try { return JSON.parse(raw) } catch { return null }
}

export default function RulesPackPage() {
  const { projectId = '', packId = 'director-shooting' } = useParams()
  const { activeProject } = useProjects()
  const fileInputRef = useRef(null)
  const [data, setData] = useState(() => buildDefaultData())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const endpoint = useMemo(() => (
    projectId ? `/projects/${projectId}/snapshots/${STAGE}` : `/workspace/snapshots/${STAGE}`
  ), [projectId])

  const currentPack = data.packs?.[packId] || templatePack('director-shooting')
  const template = DEFAULT_RULE_PACKS_V207A[packId] || DEFAULT_RULE_PACKS_V207A['director-shooting']
  const backTo = '/app/dashboard'
  const scopeLabel = projectId
    ? `Проект: ${activeProject?.id === projectId ? activeProject?.name : projectId}`
    : 'Рабочая область'

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      setStatus('Загружаю ZIP-правила…')
      try {
        const response = await apiRequest(endpoint)
        const snapshotData = response?.snapshot?.data || {}
        const nextData = mergeWithDefaults(snapshotData)
        if (!mounted) return
        setData(nextData)
        try { localStorage.setItem(localStorageKey(projectId), JSON.stringify(nextData)) } catch {}
        setStatus(snapshotData?.schema ? 'Загружено из проекта.' : 'Пока используется стартовый ZIP-шаблон.')
      } catch (err) {
        const cached = safeJsonParse(localStorage.getItem(localStorageKey(projectId)) || '')
        if (!mounted) return
        if (cached?.schema === SCHEMA) {
          setData(mergeWithDefaults(cached))
          setStatus('Backend snapshot недоступен, открыта локальная копия.')
        } else {
          setData(buildDefaultData())
          setStatus('Backend snapshot недоступен, открыт стартовый шаблон.')
        }
        setError(String(err?.message || err))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [endpoint, projectId])

  const saveData = useCallback(async (nextData, message = 'Сохранено') => {
    setSaving(true)
    setError('')
    const payload = {
      ...nextData,
      schema: SCHEMA,
      updatedAt: nowIso(),
    }
    try {
      const response = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          data: payload,
          client_version: CLIENT_VERSION,
          guard_mode: 'replace',
        }),
      })
      const savedData = response?.snapshot?.data || payload
      const merged = mergeWithDefaults(savedData)
      setData(merged)
      try { localStorage.setItem(localStorageKey(projectId), JSON.stringify(merged)) } catch {}
      setStatus(message)
    } catch (err) {
      setData(payload)
      try { localStorage.setItem(localStorageKey(projectId), JSON.stringify(payload)) } catch {}
      setError(String(err?.message || err))
      setStatus('Сохранено локально, но backend snapshot не принял данные.')
    } finally {
      setSaving(false)
    }
  }, [endpoint, projectId])

  const saveCurrent = useCallback(() => saveData(data, 'Текущий ZIP зафиксирован в проекте.'), [data, saveData])

  const downloadCurrent = useCallback(() => {
    if (!currentPack?.base64) return
    downloadBase64(currentPack.base64, currentPack.filename || 'ava_rules_pack.zip')
    setStatus(`Скачан ZIP: ${currentPack.filename}`)
  }, [currentPack])

  const uploadZip = useCallback(async (file) => {
    if (!file) return
    if (!String(file.name || '').toLowerCase().endsWith('.zip')) {
      setError('Нужен именно .zip файл.')
      return
    }
    setError('')
    setStatus('Читаю ZIP…')
    try {
      const base64 = await fileToBase64(file)
      const previous = data.packs?.[packId] || templatePack(packId)
      const nextVersion = Number(previous?.version || 0) + 1
      const updatedAt = nowIso()
      const nextPack = {
        ...previous,
        id: packId,
        title: template.title,
        subtitle: template.subtitle,
        filename: file.name,
        originalFilename: file.name,
        version: nextVersion,
        size: file.size,
        base64,
        updatedAt,
        status: packId === 'video-node' ? 'DRAFT / обновлено пользователем' : 'WORK IN PROGRESS / обновлено пользователем',
        history: [
          ...(Array.isArray(previous?.history) ? previous.history : []),
          {
            version: nextVersion,
            filename: file.name,
            updatedAt,
            note: 'Пользователь загрузил обновлённый ZIP',
            size: file.size,
          },
        ].slice(-30),
      }
      const nextData = mergeWithDefaults({
        ...data,
        packs: {
          ...(data.packs || {}),
          [packId]: nextPack,
        },
      })
      await saveData(nextData, `Загружен и сохранён ZIP: ${file.name}`)
    } catch (err) {
      setError(String(err?.message || err))
      setStatus('ZIP не загружен.')
    }
  }, [data, packId, saveData, template])

  const resetToTemplate = useCallback(async () => {
    const starter = templatePack(packId)
    if (!starter) return
    const previous = data.packs?.[packId]
    const nextVersion = Number(previous?.version || 0) + 1
    const updatedAt = nowIso()
    const nextPack = {
      ...starter,
      version: nextVersion,
      updatedAt,
      history: [
        ...(Array.isArray(previous?.history) ? previous.history : starter.history || []),
        {
          version: nextVersion,
          filename: starter.filename,
          updatedAt,
          note: 'Сброс к стартовому ZIP-шаблону',
          size: starter.size,
        },
      ].slice(-30),
    }
    const nextData = mergeWithDefaults({
      ...data,
      packs: {
        ...(data.packs || {}),
        [packId]: nextPack,
      },
    })
    await saveData(nextData, 'Сброшено к стартовому ZIP и сохранено.')
  }, [data, packId, saveData])

  const copyInstruction = useCallback(async () => {
    const text = `${template.testInstruction}\n\nТекущий ZIP: ${currentPack?.filename || ''}\nВерсия: v${currentPack?.version || 1}\nПоследнее обновление: ${formatDate(currentPack?.updatedAt)}`
    try {
      await navigator.clipboard.writeText(text)
      setStatus('Инструкция для теста скопирована.')
    } catch {
      setError('Не удалось скопировать через clipboard. Можно выделить текст вручную в браузере.')
    }
  }, [currentPack, template])

  if (!DEFAULT_RULE_PACKS_V207A[packId]) {
    return (
      <div className="avaPage avaRulesPackPage">
        <div className="avaRulesPackHero">
          <Link to={backTo} className="avaRulesBack">← На главную</Link>
          <h2>Раздел правил не найден</h2>
          <p>Открой один из рабочих ZIP-разделов.</p>
          <div className="avaRulesPackActions">
            <Link to="/app/rules/director-shooting">Режиссёрская съёмка</Link>
            <Link to="/app/rules/video-node">Video Node правила</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="avaPage avaRulesPackPage">
      <section className={`avaRulesPackHero is-${packId === 'video-node' ? 'videoNode' : 'director'}`}>
        <Link to={backTo} className="avaRulesBack">← На главную</Link>
        <p className="avaRulesEyebrow">ZIP-хранилище правил · {scopeLabel}</p>
        <h2>{currentPack.title}</h2>
        <p>{currentPack.subtitle}</p>
        <div className="avaRulesMetaRow">
          <span>Версия v{currentPack.version || 1}</span>
          <span>Обновлено: {formatDate(currentPack.updatedAt)}</span>
          <span>{formatBytes(currentPack.size)}</span>
        </div>
      </section>

      <section className="avaRulesPackWorkspace">
        <div className="avaRulesCurrentCard">
          <div>
            <p>Текущий архив</p>
            <h3>{currentPack.filename}</h3>
            <small>{currentPack.status}</small>
          </div>
          <div className="avaRulesPackActions">
            <button type="button" onClick={downloadCurrent} disabled={loading || !currentPack?.base64}>⬇ Скачать ZIP</button>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={saving}>⬆ Загрузить обновлённый ZIP</button>
            <button type="button" onClick={saveCurrent} disabled={saving}>💾 Сохранить в проекте</button>
            <button type="button" onClick={resetToTemplate} disabled={saving}>↺ Сбросить к стартовому ZIP</button>
            <button type="button" onClick={copyInstruction}>⧉ Скопировать инструкцию для теста</button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              uploadZip(file)
            }}
          />
        </div>

        <div className="avaRulesStatusCard">
          <h3>Рабочий порядок</h3>
          <ol>
            <li>Перед тестом скачай ZIP.</li>
            <li>Распакуй и работай с файлами локально.</li>
            <li>После теста внеси заметки, ошибки, удачные правила.</li>
            <li>Запакуй обратно ZIP и загрузи сюда.</li>
            <li>Ava сохранит ZIP, дату, версию и историю в snapshot проекта.</li>
          </ol>
          {status && <p className="avaRulesStatus is-ok">{saving ? 'Сохраняю… ' : ''}{status}</p>}
          {error && <p className="avaRulesStatus is-error">{error}</p>}
        </div>
      </section>

      <section className="avaRulesHistoryPanel">
        <div className="avaRulesHistoryHeader">
          <h3>История обновлений</h3>
          <span>Последние 30 записей</span>
        </div>
        <div className="avaRulesHistoryList">
          {(Array.isArray(currentPack.history) ? [...currentPack.history].reverse() : []).map((item, index) => (
            <div key={`${item.version}-${item.filename}-${index}`}>
              <strong>v{item.version || 1}</strong>
              <span>{formatDate(item.updatedAt)} · {formatBytes(item.size)}</span>
              <p>{item.note || 'Обновление ZIP'} — {item.filename}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
