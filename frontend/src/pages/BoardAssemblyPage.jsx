import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Clapperboard, Download, Music, RefreshCcw, SlidersHorizontal, UploadCloud, Volume2, Wand2 } from 'lucide-react'
import { useProjects } from '../context/ProjectContext.jsx'
import '../styles/ava-board.css'

const AUDIO_MODES = [
  {
    value: 'original_only',
    title: 'Только оригинальное аудио',
    text: 'Финальный ролик идёт под master audio / оригинальную озвучку. Звук из сцен выключен.',
  },
  {
    value: 'scene_only',
    title: 'Только звук сцен',
    text: 'Использовать звук, который уже лежит внутри сцен: i2v sound, first-last sound или MMAudio.',
  },
  {
    value: 'original_plus_scene',
    title: 'Оригинал + звук сцен',
    text: 'Оригинальное аудио остаётся главным, а звук сцен добавляется тихим слоем сверху.',
  },
  {
    value: 'music_plus_scene',
    title: 'Музыка + звук сцен',
    text: 'Фоновая музыка становится основной дорожкой, а звук сцен подмешивается сверху. Без оригинального audio.',
  },
  {
    value: 'original_plus_music_scene',
    title: 'Оригинал + музыка + звук сцен',
    text: 'Для документалок и историй: master audio + фоновая музыка + scene ambience.',
  },
]

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function formatTime(seconds) {
  const safe = Math.max(0, toNumber(seconds, 0))
  const mins = String(Math.floor(safe / 60)).padStart(2, '0')
  const secs = String(Math.floor(safe % 60)).padStart(2, '0')
  const ms = String(Math.floor((safe - Math.floor(safe)) * 1000)).padStart(3, '0')
  return `${mins}:${secs}.${ms}`
}

function durationOf(scene) {
  const direct = toNumber(scene?.duration_sec ?? scene?.durationSec, 0)
  if (direct > 0) return direct
  return Math.max(0, toNumber(scene?.end_sec ?? scene?.end, 0) - toNumber(scene?.start_sec ?? scene?.start, 0))
}

function sceneVideoUrl(scene, preferMmaudio = true) {
  if (preferMmaudio && (scene?.mmaudio_video_url || scene?.mmaudioVideoUrl)) {
    return scene.mmaudio_video_url || scene.mmaudioVideoUrl
  }
  return scene?.video_url || scene?.videoUrl || ''
}

function sceneHasSound(scene) {
  return Boolean(
    scene?.mmaudio_video_url ||
    scene?.mmaudioVideoUrl ||
    scene?.audio_slice_url ||
    scene?.sound_prompt ||
    scene?.route === 'i2v_sound' ||
    scene?.route === 'first_last_sound'
  )
}

function sceneTitle(scene, index) {
  return scene?.title || scene?.id || scene?.scene_id || `seg_${String(index + 1).padStart(2, '0')}`
}

function normalizeBoard(raw = {}) {
  const board = raw?.board || raw || {}
  return {
    ...board,
    scenes: asArray(board.scenes),
    audio: board.audio || null,
  }
}

function buildSceneItems(board, preferMmaudio = true) {
  return asArray(board.scenes).map((scene, index) => {
    const videoUrl = sceneVideoUrl(scene, preferMmaudio)
    const hasBaseVideo = Boolean(scene?.video_url || scene?.videoUrl)
    const hasMmaudio = Boolean(scene?.mmaudio_video_url || scene?.mmaudioVideoUrl)
    const hasVideo = Boolean(videoUrl)
    const hasSound = sceneHasSound(scene)
    const duration = durationOf(scene)
    return {
      id: scene?.id || scene?.scene_id || `seg_${String(index + 1).padStart(2, '0')}`,
      index,
      title: sceneTitle(scene, index),
      videoUrl,
      hasVideo,
      hasBaseVideo,
      hasMmaudio,
      hasSound,
      duration,
      route: scene?.route || 'i2v',
      start: toNumber(scene?.start_sec ?? scene?.start, 0),
      end: toNumber(scene?.end_sec ?? scene?.end, 0),
      raw: scene,
    }
  })
}

export default function BoardAssemblyPage() {
  const { projectId } = useParams()
  const workspaceMode = !projectId
  const { loadStage, loadWorkspaceStage } = useProjects()

  const [board, setBoard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [selectedSceneId, setSelectedSceneId] = useState('')
  const [audioMode, setAudioMode] = useState('original_plus_scene')
  const [preferMmaudio, setPreferMmaudio] = useState(true)
  const [skipMissing, setSkipMissing] = useState(false)
  const [originalVolume, setOriginalVolume] = useState(100)
  const [sceneVolume, setSceneVolume] = useState(25)
  const [musicVolume, setMusicVolume] = useState(15)
  const [musicFile, setMusicFile] = useState(null)
  const [musicLoop, setMusicLoop] = useState(true)
  const [musicFadeOut, setMusicFadeOut] = useState(true)

  const boardRoute = projectId ? `/app/projects/${projectId}/board` : '/app/workspace/board'
  const sceneItems = useMemo(() => buildSceneItems(board || {}, preferMmaudio), [board, preferMmaudio])
  const selectedItem = sceneItems.find((item) => item.id === selectedSceneId) || sceneItems[0] || null

  const stats = useMemo(() => {
    const total = sceneItems.length
    const ready = sceneItems.filter((item) => item.hasVideo).length
    const withSound = sceneItems.filter((item) => item.hasSound || item.hasMmaudio).length
    const missing = total - ready
    const duration = sceneItems.reduce((sum, item) => sum + item.duration, 0)
    const hasOriginalAudio = Boolean(board?.audio?.assetId || board?.audio?.assetApiPath || board?.audio?.url || board?.audio?.src)
    return { total, ready, withSound, missing, duration, hasOriginalAudio }
  }, [sceneItems, board])

  const warnings = useMemo(() => {
    const list = []
    if (!stats.total) list.push('В Board пока нет сцен.')
    if (stats.missing > 0) list.push(`Нет видео у сцен: ${stats.missing}. Вернись в доску и перегенерируй.`)
    if (!stats.hasOriginalAudio && ['original_only', 'original_plus_scene', 'original_plus_music_scene'].includes(audioMode)) {
      list.push('В Board не найдено оригинальное audio. Для этого режима понадобится master audio.')
    }
    if (['scene_only', 'music_plus_scene'].includes(audioMode) && stats.withSound === 0) {
      list.push('В сценах не найден звук. Используй MMAudio или i2v sound на нужных сценах.')
    }
    if (['music_plus_scene', 'original_plus_music_scene'].includes(audioMode) && !musicFile) {
      list.push('Фоновая музыка пока не загружена. Можно собрать без неё или загрузить MP3/WAV.')
    }
    return list
  }, [stats, audioMode, musicFile])

  async function loadBoardSnapshot() {
    setLoading(true)
    setStatus('Загружаем Board snapshot…')
    try {
      const data = workspaceMode
        ? await loadWorkspaceStage('board')
        : await loadStage(projectId, 'board')

      const nextBoard = normalizeBoard(data)
      setBoard(nextBoard)
      const firstSceneId = nextBoard.scenes?.[0]?.id || nextBoard.scenes?.[0]?.scene_id || ''
      setSelectedSceneId((current) => current || firstSceneId)
      setStatus(nextBoard.scenes?.length ? 'Board snapshot загружен' : 'В Board нет сцен')
    } catch (error) {
      setStatus(`Не удалось загрузить Board: ${error?.message || 'unknown_error'}`)
      setBoard({ scenes: [] })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBoardSnapshot()
  }, [projectId])

  function handleMusicSelect(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    setMusicFile(file || null)
  }

  if (loading) {
    return <div className="avaPage"><div className="avaPanel">Загрузка видео монтажа…</div></div>
  }

  return (
    <div className="avaPage avaAssemblyPage">
      <section className="avaAssemblyHeader">
        <div>
          <p className="avaEyebrow"><Clapperboard size={15} /> Stage 6.1 video montage foundation</p>
          <h2>Видео монтаж</h2>
          <p>Сборка готовых сцен из Board в финальный ролик. Длительность сцен не подгоняем здесь — это делается в Доске при генерации.</p>
        </div>
        <div className="avaAssemblyHeaderActions">
          <Link className="avaSecondaryButton" to={boardRoute}><ArrowLeft size={16} /> Вернуться в доску</Link>
          <button type="button" onClick={loadBoardSnapshot}><RefreshCcw size={15} /> Обновить из Board</button>
          <button type="button" disabled><Wand2 size={15} /> Собрать preview</button>
          <button type="button" className="avaBoardPrimary" disabled><Download size={15} /> Собрать MP4</button>
        </div>
      </section>

      <section className="avaAssemblyStats">
        <span>Сцен: <strong>{stats.total}</strong></span>
        <span>Видео готово: <strong>{stats.ready}/{stats.total}</strong></span>
        <span>Со звуком: <strong>{stats.withSound}</strong></span>
        <span>Длина: <strong>{formatTime(stats.duration)}</strong></span>
        <span>Оригинал audio: <strong>{stats.hasOriginalAudio ? 'есть' : 'нет'}</strong></span>
        {status && <span className="avaBoardStatusText">{status}</span>}
      </section>

      <section className="avaAssemblyWorkspace">
        <div className="avaAssemblySceneRail">
          <div className="avaBoardSectionHead">
            <div>
              <p className="avaEyebrow">scene strip</p>
              <h3>Сцены для сборки</h3>
            </div>
            <span>{skipMissing ? 'без пустых' : 'все сцены'}</span>
          </div>

          <div className="avaAssemblySceneList">
            {sceneItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`avaAssemblySceneItem ${selectedItem?.id === item.id ? 'isActive' : ''} ${item.hasVideo ? 'isReady' : 'isMissing'}`}
                onClick={() => setSelectedSceneId(item.id)}
              >
                <strong>{item.title}</strong>
                <span>{formatTime(item.start)} → {formatTime(item.end || item.start + item.duration)}</span>
                <small>{item.route} · {item.hasVideo ? 'video' : 'нет видео'}{item.hasMmaudio ? ' · MMAudio' : item.hasSound ? ' · sound' : ''}</small>
              </button>
            ))}
            {!sceneItems.length && <div className="avaInfoBox">Сцен нет. Вернись в Board или Manual Timing.</div>}
          </div>
        </div>

        <div className="avaAssemblyPreviewPanel">
          <div className="avaBoardSectionHead">
            <div>
              <p className="avaEyebrow">preview</p>
              <h3>{selectedItem?.title || 'Сцена не выбрана'}</h3>
            </div>
            <span>{selectedItem?.hasMmaudio ? 'MMAudio версия' : selectedItem?.hasVideo ? 'base video' : 'missing'}</span>
          </div>

          <div className="avaAssemblyPreview">
            {selectedItem?.videoUrl ? (
              <video src={selectedItem.videoUrl} controls />
            ) : (
              <div className="avaAssemblyEmptyPreview">
                <Clapperboard size={42} />
                <strong>Нет видео для этой сцены</strong>
                <span>Вернись в доску и перегенерируй сцену.</span>
                <Link className="avaSecondaryButton" to={boardRoute}>Вернуться в доску</Link>
              </div>
            )}
          </div>

          <div className="avaAssemblyWarnings">
            <h4>Проверка перед сборкой</h4>
            {warnings.length ? warnings.map((warning) => <p key={warning}>⚠ {warning}</p>) : <p>Готово к тестовой сборке.</p>}
          </div>

          <div className="avaAssemblyInlineMixer">
            <div className="avaBoardSectionHead">
              <div>
                <p className="avaEyebrow"><Volume2 size={14} /> volume mix</p>
                <h3>Громкость финального аудио</h3>
              </div>
              <span>{AUDIO_MODES.find((mode) => mode.value === audioMode)?.title || 'режим аудио'}</span>
            </div>
            <div className="avaAssemblyVolumeBox isInline">
              <label>
                <span><Volume2 size={14} /> Оригинал: {originalVolume}%</span>
                <input type="range" min="0" max="150" value={originalVolume} onChange={(event) => setOriginalVolume(Number(event.target.value))} />
              </label>
              <label>
                <span><Volume2 size={14} /> Звук сцен: {sceneVolume}%</span>
                <input type="range" min="0" max="150" value={sceneVolume} onChange={(event) => setSceneVolume(Number(event.target.value))} />
              </label>
              <label>
                <span><Music size={14} /> Музыка: {musicVolume}%</span>
                <input type="range" min="0" max="150" value={musicVolume} onChange={(event) => setMusicVolume(Number(event.target.value))} />
              </label>
            </div>
          </div>

        </div>

        <aside className="avaAssemblySettings">
          <div className="avaBoardSectionHead">
            <div>
              <p className="avaEyebrow"><SlidersHorizontal size={14} /> audio mix</p>
              <h3>Режим аудио</h3>
            </div>
          </div>

          <label className="avaAssemblySelectLabel">
            <span>Режим аудио</span>
            <select value={audioMode} onChange={(event) => setAudioMode(event.target.value)}>
              {AUDIO_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>{mode.title}</option>
              ))}
            </select>
          </label>

          <div className="avaAssemblyModeHint">
            <strong>{AUDIO_MODES.find((mode) => mode.value === audioMode)?.title || 'Режим аудио'}</strong>
            <span>{AUDIO_MODES.find((mode) => mode.value === audioMode)?.text || ''}</span>
          </div>

          <label className="avaAssemblyCheck">
            <input type="checkbox" checked={preferMmaudio} onChange={(event) => setPreferMmaudio(event.target.checked)} />
            Использовать MMAudio-версию, если есть
          </label>

          <label className="avaAssemblyCheck">
            <input type="checkbox" checked={skipMissing} onChange={(event) => setSkipMissing(event.target.checked)} />
            Пропускать сцены без видео
          </label>

          <div className="avaAssemblyMusicBox">
            <strong>Фоновая музыка</strong>
            <p>{musicFile ? musicFile.name : 'MP3/WAV пока не выбран'}</p>
            <label className="avaBoardSmallButton">
              <UploadCloud size={14} /> Загрузить музыку
              <input type="file" accept="audio/*" onChange={handleMusicSelect} />
            </label>
            <label className="avaAssemblyCheck">
              <input type="checkbox" checked={musicLoop} onChange={(event) => setMusicLoop(event.target.checked)} />
              Зациклить музыку до конца ролика
            </label>
            <label className="avaAssemblyCheck">
              <input type="checkbox" checked={musicFadeOut} onChange={(event) => setMusicFadeOut(event.target.checked)} />
              Плавное затухание в конце
            </label>
          </div>
        </aside>
      </section>
    </div>
  )
}
