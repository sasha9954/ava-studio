// AVA_PROJECT_PACK_READINESS_FIX_V8
import { buildCodexTaskForMode, buildModeContract, normalizeProjectMode } from './projectModes.js'

const PROMPT_POSITIVE_KEYS = ['positive_prompt', 'video_prompt', 'prompt_positive']
const PROMPT_NEGATIVE_KEYS = ['negative_prompt', 'prompt_negative']

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function asText(value = '') {
  return String(value ?? '').trim()
}

function firstText(...values) {
  for (const value of values) {
    const text = asText(value)
    if (text) return text
  }
  return ''
}

function firstNumber(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue
    const num = Number(value)
    if (Number.isFinite(num) && num > 0) return num
  }
  return 0
}

function sceneIdOf(scene = {}, index = 0) {
  return firstText(scene.scene_id, scene.sceneId, scene.id) || `seg_${String(index + 1).padStart(2, '0')}`
}

function sceneRoute(scene = {}) {
  return firstText(scene.route, scene.mode, scene.generation_route, scene.renderMode) || 'i2v'
}

function isIa2vRoute(route = '') {
  const value = String(route || '').toLowerCase()
  return value === 'ia2v' || value === 'lip_sync' || value === 'lipsync' || value === 'lip-sync' || value.includes('ia2v')
}

function extractAudioDuration(manualTiming = {}, board = {}, summary = {}) {
  const audio = asObject(manualTiming.audio || manualTiming.audio_file || manualTiming.sourceAudio)
  const validationSummary = asObject(manualTiming.validation?.summary || board.validation?.summary || summary)
  return firstNumber(
    audio.duration_sec,
    audio.durationSec,
    manualTiming.audio_duration_sec,
    manualTiming.audioDurationSec,
    manualTiming.duration_sec,
    manualTiming.durationSec,
    manualTiming.duration,
    board.audio_duration_sec,
    board.audioDurationSec,
    validationSummary.audio_duration_sec,
    validationSummary.audioDurationSec,
    summary.audio_duration_sec,
    summary.audioDurationSec
  )
}

function audioAssetFromManualTiming(manualTiming = {}, board = {}, summary = {}) {
  const audio = asObject(manualTiming.audio || manualTiming.audio_file || manualTiming.sourceAudio)
  const assetId = firstText(
    audio.asset_id,
    audio.assetId,
    manualTiming.audio_asset_id,
    manualTiming.audioAssetId,
    manualTiming.asset_id,
    manualTiming.assetId,
    board.audio_asset_id,
    board.audioAssetId
  )
  const apiPath = firstText(
    audio.asset_api_path,
    audio.assetApiPath,
    audio.api_path,
    audio.apiPath,
    manualTiming.audio_api_path,
    manualTiming.audioApiPath,
    board.audio_api_path,
    board.audioApiPath
  )
  const name = firstText(audio.name, audio.filename, manualTiming.audio_name, manualTiming.audioName, board.audio_name, board.audioName)
  const duration = extractAudioDuration(manualTiming, board, summary)
  if (!assetId && !apiPath && !name && !duration) return null
  return { name, asset_id: assetId, asset_api_path: apiPath, duration_sec: duration }
}

function getProjectFormat(project = {}, manualTiming = {}, board = {}) {
  return firstText(
    project.format,
    project.aspect_ratio,
    project.aspectRatio,
    project.output_format,
    project.outputFormat,
    manualTiming.format,
    manualTiming.aspect_ratio,
    manualTiming.aspectRatio,
    manualTiming.output_format,
    manualTiming.outputFormat,
    board.format,
    board.aspect_ratio,
    board.aspectRatio,
    board.output_format,
    board.outputFormat
  )
}

function timingScenesFromManualTiming(manualTiming = {}) {
  const sourceScenes = asArray(manualTiming.scenes || manualTiming.segments || manualTiming.timelineScenes)
  return sourceScenes.map((scene, index) => {
    const start = Number(scene.start ?? scene.start_sec ?? scene.startSec ?? 0) || 0
    const end = Number(scene.end ?? scene.end_sec ?? scene.endSec ?? 0) || 0
    const duration = Number(scene.duration ?? scene.duration_sec ?? scene.durationSec ?? Math.max(0, end - start)) || 0
    return {
      scene_id: sceneIdOf(scene, index),
      index,
      start,
      end,
      duration,
      source_phrase_ids: asArray(scene.source_phrase_ids || scene.sourcePhraseIds),
      route: sceneRoute(scene),
      text: firstText(scene.text, scene.scene_word_text, scene.lyrics_text, scene.original_text, scene.originalText),
      original_text: firstText(scene.original_text, scene.originalText, scene.text, scene.scene_word_text),
      translation: firstText(scene.translation, scene.translation_ru, scene.translated_text_ru, scene.ruText, scene.translationText),
      meaning: firstText(scene.meaning, scene.meaning_hint_ru, scene.meaningText, scene.viewer_should_understand),
      note: firstText(scene.note, scene.scene_note, scene.user_note),
      blockId: firstText(scene.blockId, scene.block_id),
      blockTitle: firstText(scene.blockTitle, scene.block_title, scene.blockName),
      color: firstText(scene.color, scene.sceneColor, scene.scene_color, scene.blockColor, scene.block_color),
      locked: true,
      do_not_change_scene_id: true,
      do_not_change_start_end_duration: true,
    }
  })
}

function promptValues(scene = {}) {
  const prompts = asObject(scene.prompts)
  const positive = firstText(scene.positive_prompt, scene.video_prompt, scene.prompt_positive, prompts.positive, prompts.video_positive)
  const negative = firstText(scene.negative_prompt, scene.prompt_negative, prompts.negative, prompts.video_negative)
  return { positive, negative }
}

function hasPrompt(scene = {}) {
  const { positive, negative } = promptValues(scene)
  return Boolean(positive || negative || firstText(scene.photo_prompt_positive, scene.video_motion_prompt, scene.lipsync_motion_prompt))
}

function hasStill(scene = {}) {
  return Boolean(firstText(
    scene.image_url,
    scene.imageUrl,
    scene.photo_url,
    scene.photoUrl,
    scene.start_image_url,
    scene.startImageUrl,
    scene.generated_still_url,
    scene.generatedStillUrl,
    scene.video_asset_id && scene.video_url
  ))
}

function productionScenesFromBoard(board = {}, timingScenes = [], modeId = 'manual_general_v1') {
  const sourceScenes = asArray(board.scenes || board.board_scenes || board.boardScenes)
  const fallbackScenes = sourceScenes.length ? sourceScenes : timingScenes

  return fallbackScenes.map((scene, index) => {
    const matchingTiming = timingScenes.find((item) => item.scene_id === sceneIdOf(scene, index)) || timingScenes[index] || {}
    const { positive, negative } = promptValues(scene)
    const meaning = firstText(scene.viewer_should_understand, scene.viewerShouldUnderstand, scene.meaning, scene.meaning_hint_ru, matchingTiming.meaning)
    const note = firstText(scene.note, scene.scene_note, matchingTiming.note, matchingTiming.blockTitle)

    const base = {
      scene_id: sceneIdOf(scene, index),
      index,
      start: Number(scene.start ?? matchingTiming.start ?? 0) || 0,
      end: Number(scene.end ?? matchingTiming.end ?? 0) || 0,
      duration: Number(scene.duration ?? scene.duration_sec ?? scene.durationSec ?? matchingTiming.duration ?? 0) || 0,
      route: sceneRoute(scene),
      blockId: firstText(scene.blockId, scene.block_id, matchingTiming.blockId),
      blockTitle: firstText(scene.blockTitle, scene.block_title, scene.blockName, matchingTiming.blockTitle),
      color: firstText(scene.color, scene.sceneColor, scene.scene_color, scene.blockColor, scene.block_color, matchingTiming.color),
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
      viewer_should_understand: meaning,
      readability_check: firstText(scene.readability_check, scene.readabilityCheck),
      has_prompt: hasPrompt(scene),
      has_still: hasStill(scene),
    }

    if (modeId === 'recipe_process_v1') {
      return {
        ...base,
        recipe_step: firstText(scene.recipe_step, scene.recipeStep, note, matchingTiming.blockTitle),
        visual_action: firstText(scene.visual_action, scene.visualAction),
        viewer_should_understand: meaning,
        readability_check: firstText(scene.readability_check, scene.readabilityCheck, 'The viewer must clearly understand this recipe step.'),
      }
    }

    if (modeId === 'lyric_meaning_remix_v1') {
      return {
        ...base,
        idea_fn: firstText(scene.idea_fn, scene.ideaFn),
        idea_meaning: firstText(scene.idea_meaning, scene.ideaMeaning, matchingTiming.meaning),
        idea_story: firstText(scene.idea_story, scene.ideaStory),
        idea_anchor: firstText(scene.idea_anchor, scene.ideaAnchor),
      }
    }

    return base
  })
}

function collectAssets({ manualTiming = {}, board = {}, summary = {} }) {
  return {
    audio: audioAssetFromManualTiming(manualTiming, board, summary),
    character_refs: asArray(board.character_refs || board.characterRefs || manualTiming.character_refs || manualTiming.characterRefs),
    location_refs: asArray(board.location_refs || board.locationRefs || manualTiming.location_refs || manualTiming.locationRefs),
    source_video: {
      path: firstText(board.source_video_path, board.sourceVideoPath, manualTiming.source_video_path, manualTiming.sourceVideoPath),
      required: false,
      required_only_for_modes: ['video_first_documentary_v1', 'video_match'],
    },
    working_folder: firstText(board.working_folder, board.workingFolder, manualTiming.working_folder, manualTiming.workingFolder),
  }
}

function inferStatus({ audio, timingScenes, hasProductionPrompts, hasGeneratedStills }) {
  if (hasProductionPrompts && hasGeneratedStills) return 'images_ready'
  if (hasProductionPrompts) return 'prompts_ready'
  if (timingScenes.length) return 'timing_ready'
  if (audio) return 'audio_loaded'
  return 'created'
}

function buildReadiness({ modeId, format, audio, timingScenes, productionScenes, assets }) {
  const missing = []
  const warnings = []
  const next_questions = []
  const next_actions_for_user = []

  const hasAudio = Boolean(audio)
  const hasAudioDuration = Boolean(Number(audio?.duration_sec || 0) > 0)
  const hasTimingScenes = timingScenes.length > 0
  const hasNonZeroTiming = timingScenes.some((scene) => Number(scene.duration || 0) > 0 || Number(scene.end || 0) > Number(scene.start || 0))
  const hasProductionPrompts = productionScenes.some(hasPrompt)
  const hasGeneratedStills = productionScenes.some(hasStill)
  const ia2vScenes = [...timingScenes, ...productionScenes].filter((scene) => isIa2vRoute(scene.route))

  if (!hasAudio) {
    missing.push('assets.audio')
    next_actions_for_user.push('Загрузи аудио в проект и скачай задание заново.')
  }

  if (hasAudio && !hasAudioDuration) {
    missing.push('assets.audio.duration_sec')
    warnings.push('Длительность аудио не найдена в snapshot. Проверь загрузку аудио и пересохрани тайминг.')
  }

  if (!hasTimingScenes || !hasNonZeroTiming) {
    missing.push('timing.scenes')
    next_actions_for_user.push('Сделай ASR / Manual Timing и скачай задание заново.')
  }

  if (ia2vScenes.length && !asArray(assets.character_refs).length) {
    missing.push('assets.character_refs.host')
    next_questions.push({
      id: 'host_character_reference',
      required: true,
      question_ru: 'В проекте есть lip-sync сцены. Нужна карта персонажа ведущей. У тебя есть карта персонажа или создать новую?',
      expected_answer: 'provide_image_or_generate',
    })
    next_actions_for_user.push('Добавь карту персонажа ведущей.')
  }

  if (!hasProductionPrompts) {
    missing.push('production.prompts')
    next_actions_for_user.push('Создай storyboard/prompts/stills по этому заданию или отправь пакет в ChatGPT/Codex.')
  }

  if (!hasGeneratedStills) {
    missing.push('generated_stills')
    warnings.push('Generated stills отсутствуют: это partial/timing package, не full package.')
  }

  if (!format) {
    missing.push('project.format')
    next_questions.push({ id: 'project_format', required: true, question_ru: 'Какой формат проекта: 9:16, 16:9 или 1:1?' })
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

  const canContinue = hasAudio && hasAudioDuration && hasTimingScenes && hasNonZeroTiming
  const hardMissingForCodex = ['assets.character_refs.host', 'assets.source_video']
  const canSendToCodex = canContinue && !missing.some((item) => hardMissingForCodex.includes(item))
  const canImportToBoard = hasProductionPrompts

  return {
    stage: inferStatus({ audio, timingScenes, hasProductionPrompts, hasGeneratedStills }),
    can_continue: canContinue,
    can_send_to_codex: canSendToCodex,
    can_import_to_board: canImportToBoard,
    prompt_only_import_possible: canImportToBoard && !hasGeneratedStills,
    full_package: hasProductionPrompts && hasGeneratedStills,
    missing: Array.from(new Set(missing)),
    warnings: Array.from(new Set(warnings)),
    next_questions,
    next_actions_for_user: Array.from(new Set(next_actions_for_user.concat(['Проверь режим проекта.']))),
  }
}

function expectedOutputsForMode(modeId = 'manual_general_v1') {
  if (modeId === 'recipe_process_v1') {
    return ['storyboard_locked.md', 'storyboard_locked.json', 'prompts_pack.json', 'board_import_ready.json', 'generated_stills_manifest.json', 'contact_sheet_labeled.jpg', 'validation_report.json']
  }
  if (modeId === 'lyric_meaning_remix_v1') {
    return ['storyboard_locked.md', 'prompts_pack.json', 'board_import_ready.json', 'generated_stills_manifest.json', 'contact_sheet_labeled.jpg', 'validation_report.json']
  }
  if (modeId === 'video_first_documentary_v1') {
    return ['source_shots.json', 'contact_sheets', 'video_match_board_v2.json', 'validation_report.json']
  }
  return ['storyboard_locked.json', 'prompts_pack.json', 'board_import_ready.json', 'validation_report.json']
}

export function buildAvaProjectPackV1({ project = {}, manualTiming = {}, board = {}, summary = {}, includeLegacyRaw = false } = {}) {
  const projectMode = normalizeProjectMode(project.project_mode || project.projectMode || project.project_mode_id || project.projectModeId)
  const modeContract = buildModeContract(projectMode.id)
  const format = getProjectFormat(project, manualTiming, board)
  const timingScenes = timingScenesFromManualTiming(manualTiming)
  const productionScenes = productionScenesFromBoard(board, timingScenes, projectMode.id)
  const assets = collectAssets({ manualTiming, board, summary })
  if (projectMode.id === 'video_first_documentary_v1') assets.source_video.required = true

  const readiness = buildReadiness({ modeId: projectMode.id, format, audio: assets.audio, timingScenes, productionScenes, assets })
  const codexTask = {
    ...buildCodexTaskForMode(projectMode.id, { status: readiness.stage }),
    expected_outputs: expectedOutputsForMode(projectMode.id),
    full_package_or_ask: true,
  }

  const audioDuration = Number(assets.audio?.duration_sec || 0) || extractAudioDuration(manualTiming, board, summary)

  const pack = {
    schema: 'ava_project_pack_v1',
    pack_profile: includeLegacyRaw ? 'debug' : 'compact',
    debug_included: Boolean(includeLegacyRaw),
    status: readiness.full_package ? readiness.stage : (readiness.stage === 'images_ready' ? 'images_ready' : readiness.stage),
    exported_at: new Date().toISOString(),
    project: {
      id: project.id || project.project_id || '',
      name: project.name || '',
      type: project.type || 'clip',
      format,
      aspect_ratio: format,
      output_format: format,
      description: project.description || '',
      status: project.status || '',
    },
    project_mode: projectMode,
    mode_contract: modeContract,
    assets,
    timing: {
      source: 'manual_timing',
      locked: true,
      do_not_change_timing: true,
      do_not_change_scene_id: true,
      do_not_change_start_end_duration: true,
      audio_duration_sec: audioDuration,
      audioDurationSec: audioDuration,
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
    expected_outputs: expectedOutputsForMode(projectMode.id).map((name) => ({ name, created: false, expected: true })),
    validation: {
      do_not_change_timing: true,
      board_import_priority: ['production.scenes', 'timing.scenes'],
      prompt_positive_priority: [...PROMPT_POSITIVE_KEYS, 'prompts.positive', 'prompts.video_positive'],
      prompt_negative_priority: [...PROMPT_NEGATIVE_KEYS, 'prompts.negative', 'prompts.video_negative'],
      full_package_or_ask: true,
      full_package: readiness.full_package,
      generated_stills_required_for_full_package: true,
      summary: { ...summary, audio_duration_sec: audioDuration },
    },
  }

  if (includeLegacyRaw) pack.legacy_raw = { project, manualTiming, board }

  return pack
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
