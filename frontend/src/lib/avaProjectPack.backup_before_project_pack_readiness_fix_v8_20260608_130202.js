// AVA_PROJECT_MODES_PACK_V1
import { buildCodexTaskForMode, buildModeContract, normalizeProjectMode } from './projectModes.js'

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function asText(value = '') {
  return String(value || '').trim()
}

function firstText(...values) {
  for (const value of values) {
    const text = asText(value)
    if (text) return text
  }
  return ''
}

function sceneIdOf(scene = {}, index = 0) {
  return firstText(scene.scene_id, scene.sceneId, scene.id) || `seg_${String(index + 1).padStart(2, '0')}`
}

function sceneRoute(scene = {}) {
  return firstText(scene.route, scene.mode, scene.generation_route) || 'i2v'
}

function audioAssetFromManualTiming(manualTiming = {}) {
  const audio = manualTiming.audio || manualTiming.audio_file || manualTiming.sourceAudio || {}
  const assetId = firstText(audio.asset_id, audio.assetId, manualTiming.audio_asset_id, manualTiming.audioAssetId, manualTiming.asset_id, manualTiming.assetId)
  const apiPath = firstText(audio.asset_api_path, audio.assetApiPath, audio.api_path, audio.apiPath, manualTiming.audio_api_path, manualTiming.audioApiPath)
  const name = firstText(audio.name, audio.filename, manualTiming.audio_name, manualTiming.audioName)
  const duration = Number(audio.duration_sec ?? audio.durationSec ?? manualTiming.audio_duration_sec ?? manualTiming.duration_sec ?? manualTiming.duration ?? 0) || 0
  if (!assetId && !apiPath && !name && !duration) return null
  return { name, asset_id: assetId, asset_api_path: apiPath, duration_sec: duration }
}

function timingScenesFromManualTiming(manualTiming = {}) {
  const sourceScenes = asArray(manualTiming.scenes || manualTiming.segments || manualTiming.timelineScenes)
  return sourceScenes.map((scene, index) => ({
    scene_id: sceneIdOf(scene, index),
    start: Number(scene.start ?? scene.start_sec ?? scene.startSec ?? 0) || 0,
    end: Number(scene.end ?? scene.end_sec ?? scene.endSec ?? 0) || 0,
    duration: Number(scene.duration ?? scene.duration_sec ?? scene.durationSec ?? 0) || 0,
    source_phrase_ids: asArray(scene.source_phrase_ids || scene.sourcePhraseIds),
    route: sceneRoute(scene),
    text: firstText(scene.text, scene.scene_word_text, scene.lyrics_text, scene.original_text, scene.originalText),
    original_text: firstText(scene.original_text, scene.originalText, scene.text, scene.scene_word_text),
    translation: firstText(scene.translation, scene.translation_ru, scene.translated_text_ru, scene.ruText, scene.translationText),
    meaning: firstText(scene.meaning, scene.meaning_hint_ru, scene.meaningText),
    locked: Boolean(scene.timing_locked || scene.timingLocked || scene.duration_locked || scene.durationLocked),
    raw: scene,
  }))
}

function productionScenesFromBoard(board = {}, timingScenes = []) {
  const sourceScenes = asArray(board.scenes || board.board_scenes || board.boardScenes)
  const fallbackScenes = sourceScenes.length ? sourceScenes : timingScenes
  return fallbackScenes.map((scene, index) => {
    const prompts = scene.prompts || {}
    const positive = firstText(scene.positive_prompt, scene.video_prompt, scene.prompt_positive, prompts.positive, prompts.video_positive)
    const negative = firstText(scene.negative_prompt, scene.prompt_negative, prompts.negative, prompts.video_negative)
    return {
      scene_id: sceneIdOf(scene, index),
      route: sceneRoute(scene),
      planned_photo_filename: firstText(scene.planned_photo_filename, scene.photo_filename, scene.image_name, scene.first_frame_name),
      photo_prompt_positive: firstText(scene.photo_prompt_positive, scene.image_prompt, scene.imagePrompt, positive),
      photo_prompt_negative: firstText(scene.photo_prompt_negative, negative),
      video_motion_prompt: firstText(scene.video_motion_prompt, scene.motion_prompt, scene.motionPrompt, scene.video_prompt),
      video_motion_negative: firstText(scene.video_motion_negative, scene.motion_negative, negative),
      lipsync_motion_prompt: firstText(scene.lipsync_motion_prompt, scene.lip_sync_prompt, scene.ia2v_prompt),
      positive_prompt: positive,
      negative_prompt: negative,
      video_prompt: firstText(scene.video_prompt, positive),
      prompt_positive: firstText(scene.prompt_positive, positive),
      prompt_negative: firstText(scene.prompt_negative, negative),
      viewer_should_understand: firstText(scene.viewer_should_understand, scene.viewerShouldUnderstand, scene.meaning, scene.meaning_hint_ru),
      readability_check: firstText(scene.readability_check, scene.readabilityCheck),
    }
  })
}

function inferStatus({ audio, timingScenes, productionScenes }) {
  if (productionScenes.length && productionScenes.some((scene) => scene.positive_prompt || scene.video_prompt)) return 'prompts_ready'
  if (timingScenes.length) return 'timing_ready'
  if (audio) return 'audio_loaded'
  return 'created'
}

function buildReadiness({ modeId, audio, timingScenes, productionScenes, assets }) {
  const missing = []
  const warnings = []
  const next_questions = []
  const next_actions_for_user = []

  if (!audio) {
    missing.push('assets.audio')
    next_actions_for_user.push('Загрузи аудио в проект и скачай задание заново.')
  }

  if (!timingScenes.length) {
    missing.push('timing.scenes')
    next_actions_for_user.push('Сделай ASR / Manual Timing и скачай задание заново.')
  }

  const ia2vScenes = [...timingScenes, ...productionScenes].filter((scene) => ['ia2v', 'lip_sync', 'lipsync'].includes(sceneRoute(scene)))
  if (ia2vScenes.length && !asArray(assets.character_refs).length) {
    missing.push('assets.character_refs.host')
    next_questions.push({
      id: 'host_character_reference',
      required: true,
      question_ru: 'В проекте есть lip-sync сцены. Нужна карта персонажа ведущей. У тебя есть карта или создать новую?',
    })
  }

  if (modeId === 'recipe_process_v1') {
    next_questions.push({ id: 'recipe_topic', required: true, question_ru: 'Какое блюдо готовим?' })
    next_questions.push({ id: 'location_style', required: false, question_ru: 'Какая локация: дача, кухня, костёр, улица?' })
  }

  if (modeId === 'lyric_meaning_remix_v1') {
    next_questions.push({ id: 'story_world', required: true, question_ru: 'В какой сюжетный мир переносим смысл песни?' })
    next_questions.push({ id: 'twist_object', required: true, question_ru: 'Что является объектом подмены?' })
  }

  if (modeId === 'video_first_documentary_v1' && !assets.source_video?.path) {
    missing.push('assets.source_video')
    next_actions_for_user.push('Для режима документалки из видео добавь исходное видео и скачай задание заново.')
  }

  const can_continue = Boolean(audio && timingScenes.length)
  return {
    stage: inferStatus({ audio, timingScenes, productionScenes }),
    can_continue,
    can_send_to_codex: can_continue && !missing.includes('assets.source_video'),
    can_import_to_board: productionScenes.length > 0,
    missing,
    warnings,
    next_questions,
    next_actions_for_user,
  }
}

function collectAssets({ manualTiming = {}, board = {} }) {
  return {
    audio: audioAssetFromManualTiming(manualTiming),
    character_refs: asArray(board.character_refs || board.characterRefs || manualTiming.character_refs || manualTiming.characterRefs),
    location_refs: asArray(board.location_refs || board.locationRefs || manualTiming.location_refs || manualTiming.locationRefs),
    source_video: {
      path: firstText(board.source_video_path, board.sourceVideoPath, manualTiming.source_video_path, manualTiming.sourceVideoPath),
      required_only_for_modes: ['video_first_documentary_v1', 'video_match'],
    },
    working_folder: firstText(board.working_folder, board.workingFolder, manualTiming.working_folder, manualTiming.workingFolder),
  }
}

export function buildAvaProjectPackV1({ project = {}, manualTiming = {}, board = {}, summary = {} } = {}) {
  const projectMode = normalizeProjectMode(project.project_mode || project.projectMode || project.project_mode_id || project.projectModeId)
  const modeContract = buildModeContract(projectMode.id)
  const timingScenes = timingScenesFromManualTiming(manualTiming)
  const productionScenes = productionScenesFromBoard(board, timingScenes)
  const assets = collectAssets({ manualTiming, board })
  const status = inferStatus({ audio: assets.audio, timingScenes, productionScenes })
  const readiness = buildReadiness({ modeId: projectMode.id, audio: assets.audio, timingScenes, productionScenes, assets })
  const codexTask = buildCodexTaskForMode(projectMode.id, { status })

  return {
    schema: 'ava_project_pack_v1',
    status,
    exported_at: new Date().toISOString(),
    project: {
      id: project.id || project.project_id || '',
      name: project.name || '',
      type: project.type || '',
      format: project.format || '',
      description: project.description || '',
      status: project.status || '',
    },
    project_mode: projectMode,
    mode_contract: modeContract,
    assets,
    timing: {
      source: 'manual_timing',
      locked: true,
      audio_duration_sec: Number(assets.audio?.duration_sec || manualTiming.audio_duration_sec || manualTiming.duration_sec || 0) || 0,
      speech_segments: asArray(manualTiming.speech_segments || manualTiming.phrases || manualTiming.asr_phrases),
      scenes: timingScenes,
    },
    production: {
      source: productionScenes.length ? 'board_or_timing' : 'empty',
      scenes: productionScenes,
    },
    codex_task: codexTask,
    readiness,
    mode_requirements: {
      active_modes: ['manual_general_v1', 'lyric_meaning_remix_v1', 'recipe_process_v1'],
      source_video_required: projectMode.id === 'video_first_documentary_v1',
      character_ref_required_for_ia2v: true,
    },
    expected_outputs: codexTask.expected_outputs || [],
    validation: {
      do_not_change_timing: true,
      board_import_priority: ['production.scenes', 'timing.scenes'],
      prompt_positive_priority: ['positive_prompt', 'video_prompt', 'prompt_positive', 'prompts.positive', 'prompts.video_positive'],
      prompt_negative_priority: ['negative_prompt', 'prompt_negative', 'prompts.negative', 'prompts.video_negative'],
      full_package_or_ask: true,
      summary,
    },
  }
}

export function downloadJsonFile(data, filename = 'ava_project_pack_v1.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2500)
}
