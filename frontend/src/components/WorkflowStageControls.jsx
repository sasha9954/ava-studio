// AVA_BOARD_MANUAL_SCENE_CLEAR_PROGRESS_V129I: clearer destructive clear progress indicator.
import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2, X } from 'lucide-react'
import { apiRequest } from '../services/apiClient.js'
import { clearStorageByMatchers, clearWorkflowEntry, readWorkflowEntry, stagePath, markWorkflowStageCleared } from '../utils/workflowNavigation.js'
import '../styles/ava-workflow-controls.css'
import { AVA_BOARD_ASSEMBLY_CLEARED_KEY } from '../utils/workflowNavigation.js'

function deleteIndexedDbIfAvailable(dbName = '') {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB || !dbName) {
      resolve(false)
      return
    }

    try {
      const request = window.indexedDB.deleteDatabase(dbName)
      request.onsuccess = () => resolve(true)
      request.onerror = () => resolve(false)
      request.onblocked = () => {
        console.warn('[WORKFLOW CLEAR] IndexedDB delete blocked', { dbName })
        resolve(false)
      }
    } catch {
      resolve(false)
    }
  })
}

function normalizeStageList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

export default function WorkflowStageControls({
  stageKey,
  stageLabel,
  clearLabel = 'Очистить',
  clearStages = [],
  clearStorageMatchers = [],
  clearDescription = 'Будет безвозвратно очищено состояние этой страницы и удалены связанные файлы с сервера. Восстановлению не подлежит.',
  compact = false,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const { projectId } = useParams()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState('')

  const entry = useMemo(
    () => readWorkflowEntry(stageKey, location.state),
    [stageKey, location.state]
  )

  const returnPath = entry?.fromPath || (entry?.from ? stagePath(entry.from, projectId || entry.projectId || '') : '')
  const returnLabel = entry?.fromLabel || ''
  const normalizedClearStages = normalizeStageList(clearStages)

  async function clearNow() {
    setClearing(true)
    setError('')

    try {
      clearStorageByMatchers(clearStorageMatchers)
      clearWorkflowEntry(stageKey)
      markWorkflowStageCleared(stageKey, { reason: 'user_clear_stage_controls' })

      if (stageKey === 'board_assembly' && typeof window !== 'undefined') {
        window.localStorage.setItem(AVA_BOARD_ASSEMBLY_CLEARED_KEY, JSON.stringify({
          at: Date.now(),
          reason: 'user_clear_board_assembly',
        }))
      }


      if (stageKey === 'podcast') {
        clearStorageByMatchers([
          ...clearStorageMatchers,
          'podcast_audio_composer_v30',
          'podcast_audio_composer',
          'podcast_audio',
          'ava_podcast',
        ])
        await deleteIndexedDbIfAvailable('podcast_audio_composer_assets_v1')
        await deleteIndexedDbIfAvailable('ava_podcast_audio_persist_v1')
      }

      for (const stage of normalizedClearStages) {
        const endpoint = projectId
          ? `/projects/${projectId}/snapshots/${stage}`
          : `/workspace/snapshots/${stage}`

        await apiRequest(endpoint, {
          method: 'POST',
          body: JSON.stringify({
            data: {},
            guard_mode: 'replace',
            client_version: 'workflow-stage-controls-clear-v1',
          }),
        })
      }

      window.setTimeout(() => window.location.reload(), 120)
    } catch (err) {
      setError(err?.message || 'Не удалось очистить')
      setClearing(false)
    }
  }

  return (
    <div className={`avaWorkflowControls ${compact ? 'isCompact' : ''}`}>
      <div className="avaWorkflowControlsInfo">
        <span>{stageLabel || 'Рабочая страница'}</span>
        <small>{entry ? `Открыто из: ${returnLabel}` : 'Открыто отдельно'}</small>
      </div>

      <div className="avaWorkflowControlsActions">
        {entry?.enteredByUserClick && returnPath ? (
          <button type="button" className="avaWorkflowBackButton" onClick={() => navigate(returnPath)}>
            <ArrowLeft size={15} /> Вернуться в {returnLabel}
          </button>
        ) : null}

        <button type="button" className="avaWorkflowClearButton" onClick={() => setConfirmOpen(true)}>
          <Trash2 size={15} /> {clearLabel}
        </button>
      </div>

      {confirmOpen ? (
        <div className="avaWorkflowConfirmOverlay" onMouseDown={() => !clearing && setConfirmOpen(false)}>
          <section className="avaWorkflowConfirmModal" onMouseDown={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="avaWorkflowConfirmClose"
              onClick={() => setConfirmOpen(false)}
              disabled={clearing}
              aria-label="Закрыть"
            >
              <X size={16} />
            </button>

            <div className="avaWorkflowConfirmIcon"><Trash2 size={24} /></div>
            <p className="avaWorkflowEyebrow">DESTRUCTIVE CLEAR</p>
            <h3>{clearLabel}?</h3>
            <p>{clearDescription}</p>

            {normalizedClearStages.length ? (
              <div className={`avaWorkflowClearScope ${clearing ? 'isClearingV129I' : ''}`}>
                <span>Snapshot: {normalizedClearStages.join(', ')}</span>
                {clearing ? <i className="avaWorkflowScopePulseV129I" aria-hidden="true" /> : null}
              </div>
            ) : (
              <div className={`avaWorkflowClearScope ${clearing ? 'isClearingV129I' : ''}`}>
                <span>Локальное состояние и связанные серверные файлы этого этапа</span>
                {clearing ? <i className="avaWorkflowScopePulseV129I" aria-hidden="true" /> : null}
              </div>
            )}

            {error ? <div className="avaWorkflowError">{error}</div> : null}

            <div className="avaWorkflowConfirmActions">
              <button type="button" className="avaWorkflowCancel" onClick={() => setConfirmOpen(false)} disabled={clearing}>
                Отмена
              </button>
              <button type="button" className="avaWorkflowDanger" onClick={clearNow} disabled={clearing}>
                {clearing ? (
                  <>
                    <span className="avaWorkflowButtonSpinnerV129I" aria-hidden="true" />
                    Очищаю…
                  </>
                ) : 'Да, удалить безвозвратно'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
