// AVA_CREATE_PROJECT_MODE_ONLY_V4: creation mode UI uses Clip / Recipe / Meaning remix only.
// AVA_PROJECT_MODES_PACK_V1
// Single registry for Ava project modes. Keep mode labels/contracts here.

export const DEFAULT_PROJECT_MODE_ID = 'manual_general_v1'

export const PROJECT_MODES = [
  {
    id: 'manual_general_v1',
    version: 1,
    label_ru: 'Клип',
    label_en: 'Clip',
    description_ru: 'Обычный клип / ручная раскадровка, промты и монтаж.',
    contract_ref: 'manual_general_v1',
    enabled: true,
    beta: false,
    scene_fields: ['viewer_should_understand', 'readability_check'],
    progression: ['setup', 'develop', 'finish'],
    mode_contract: {
      contract_ref: 'manual_general_v1',
      label_ru: 'Клип',
      core_rule: 'Use existing timing, scene notes, prompts and media for a general clip without special mode logic.',
      rules_ru: [
        'Не менять тайминг без просьбы пользователя.',
        'Сохранять scene_id/start/end/duration.',
        'Использовать существующие prompts/notes/media.',
      ],
      prompt_hint_ru: 'Обычный клип без специальной логики режима.',
    },
    codex_task_defaults: {
      task_type: 'manual_general_storyboard_or_board_pack',
      do_not_change_timing: true,
      do_not_require_source_video: true,
      core_instruction: 'Use existing timing, scene notes, prompts and media to prepare a consistent Board/Codex task.',
      mode_prompt_ru: 'Обычный клип без специальной логики режима.',
      expected_outputs: ['storyboard_locked.json', 'prompts_pack.json', 'board_import_ready.json', 'validation_report.json'],
    },
  },
  {
    id: 'lyric_meaning_remix_v1',
    version: 1,
    label_ru: 'Клип: подмена смысла',
    label_en: 'Music clip: meaning remix',
    description_ru: 'Берём эмоциональный смысл строк песни/ASR и переносим в неожиданный сюжетный мир.',
    contract_ref: 'lyric_meaning_remix_v1',
    enabled: true,
    beta: false,
    scene_fields: ['idea_fn', 'idea_meaning', 'idea_story', 'idea_anchor', 'viewer_should_understand', 'readability_check'],
    progression: ['setup', 'hint', 'deepen', 'reveal', 'aftermath'],
    mode_contract: {
      contract_ref: 'lyric_meaning_remix_v1',
      label_ru: 'Клип: подмена смысла',
      core_rule: 'Take the emotional meaning of each lyric/ASR segment and translate it into the selected story world instead of following lyrics literally.',
      scene_fields: ['idea_fn', 'idea_meaning', 'idea_story', 'idea_anchor', 'viewer_should_understand', 'readability_check'],
      progression: ['setup', 'hint', 'deepen', 'reveal', 'aftermath'],
      rules_ru: [
        'Не следовать словам буквально.',
        'Брать эмоциональный смысл строки.',
        'Переносить смысл в выбранный story_world.',
        'Идея клипа должна читаться от начала до конца.',
        'Если сцена красивая, но не помогает понять идею, сцену переписать.',
        'Reveal не должен быть слишком рано и не должен быть непонятным.',
      ],
      prompt_hint_ru: 'Сцены должны переносить смысл песни в другой сюжетный мир, а не иллюстрировать слова буквально.',
    },
    codex_task_defaults: {
      task_type: 'lyric_meaning_remix_storyboard',
      do_not_change_timing: true,
      do_not_require_source_video: true,
      core_instruction: 'For each timing segment, derive emotional meaning from lyric/ASR text and translate it into the selected story world. Preserve reveal logic.',
      mode_prompt_ru: 'Это режим подмены смысла. Нельзя иллюстрировать слова буквально. Нужно перенести эмоциональный смысл в выбранный сюжетный мир.',
      expected_outputs: ['storyboard_locked.md', 'prompts_pack.json', 'board_import_ready.json', 'generated_stills_manifest.json', 'contact_sheet_labeled.jpg', 'validation_report.json'],
    },
  },
  {
    id: 'recipe_process_v1',
    version: 1,
    label_ru: 'Готовка / рецепт',
    label_en: 'Cooking / recipe',
    description_ru: 'Каждая сцена показывает понятный шаг рецепта: ингредиенты, подготовка, готовка, финал.',
    contract_ref: 'recipe_process_readability_v1',
    enabled: true,
    beta: false,
    scene_fields: ['recipe_step', 'viewer_should_understand', 'visual_action', 'readability_check'],
    progression: ['hook', 'ingredients', 'prep', 'fire_setup', 'cook', 'finish', 'outro'],
    mode_contract: {
      contract_ref: 'recipe_process_readability_v1',
      label_ru: 'Готовка / рецепт',
      core_rule: 'Each scene must show one clear cooking step in correct order. Beauty is secondary to readable process.',
      scene_fields: ['recipe_step', 'viewer_should_understand', 'visual_action', 'readability_check'],
      progression: ['hook', 'ingredients', 'prep', 'fire_setup', 'cook', 'finish', 'outro'],
      rules_ru: [
        'Каждая сцена = один понятный шаг рецепта.',
        'Нельзя делать красивую, но непонятную сцену.',
        'Если есть lip-sync ведущего, карта персонажа нужна для этих сцен.',
        'Середина обычно i2v/b-roll: руки, продукты, огонь, сковорода, процесс.',
        'Не показывать говорящего ведущего в каждой сцене, если это не требуется.',
      ],
      prompt_hint_ru: 'Зритель должен понимать процесс готовки: что происходит, зачем и что будет дальше.',
    },
    codex_task_defaults: {
      task_type: 'storyboard_prompts_and_generated_stills',
      do_not_change_timing: true,
      do_not_require_source_video: true,
      core_instruction: 'Create a production-ready recipe storyboard and prompt pack. Every scene must show one clear cooking step.',
      mode_prompt_ru: 'Это режим готовки/рецепта. Каждая сцена должна быть понятным шагом процесса, а не просто красивым кадром.',
      expected_outputs: ['storyboard_locked.md', 'storyboard_locked.json', 'prompts_pack.json', 'board_import_ready.json', 'generated_stills_manifest.json', 'contact_sheet_labeled.jpg', 'validation_report.json'],
    },
  },
  {
    id: 'video_first_documentary_v1',
    version: 1,
    label_ru: 'Документалка из видео',
    label_en: 'Video-first documentary',
    description_ru: 'Сначала анализ реального видео, потом история/озвучка/нарезка только из реально видимого.',
    contract_ref: 'video_first_documentary_v1',
    enabled: false,
    beta: true,
    mode_contract: {
      contract_ref: 'video_first_documentary_v1',
      label_ru: 'Документалка из видео',
      core_rule: 'Source video is required. Analyze real visible footage first, then build story and edits only from visible evidence.',
      rules_ru: ['source_video обязателен.', 'Не придумывать кадры, которых нет в видео.', 'Сначала inventory/source shots, потом story/timing/match.'],
      prompt_hint_ru: 'Это video-first documentary: исходное видео обязательно.',
    },
    codex_task_defaults: {
      task_type: 'video_first_documentary_inventory_and_match',
      do_not_change_timing: true,
      source_video_required: true,
      core_instruction: 'Analyze source video first and build documentary storyboard/video match only from visible material.',
      mode_prompt_ru: 'Это документалка из исходного видео. Source video обязателен.',
      expected_outputs: ['source_shots.json', 'contact_sheets', 'video_match_board_v2.json', 'validation_report.json'],
    },
  },
  { id: 'music_visual_story_v1', version: 1, label_ru: 'Музыкальный клип', label_en: 'Music visual story', description_ru: 'Визуальная история по музыке/ритму/эмоции, без обязательной подмены смысла.', contract_ref: 'music_visual_story_v1', enabled: false, beta: true },
  { id: 'product_ad_v1', version: 1, label_ru: 'Реклама / продукт', label_en: 'Product ad', description_ru: 'Сцены раскрывают продукт, пользу, детали, желание.', contract_ref: 'product_ad_v1', enabled: false, beta: true },
  { id: 'story_monologue_v1', version: 1, label_ru: 'История / монолог', label_en: 'Story / monologue', description_ru: 'Озвучка/текст главный, сцены поддерживают смысл и настроение.', contract_ref: 'story_monologue_v1', enabled: false, beta: true },
]

export function getProjectMode(id = DEFAULT_PROJECT_MODE_ID) {
  return PROJECT_MODES.find((mode) => mode.id === id) || PROJECT_MODES.find((mode) => mode.id === DEFAULT_PROJECT_MODE_ID)
}

export function getDefaultProjectMode() {
  return getProjectMode(DEFAULT_PROJECT_MODE_ID)
}

export function normalizeProjectMode(projectMode = DEFAULT_PROJECT_MODE_ID) {
  const rawId = typeof projectMode === 'string' ? projectMode : (projectMode?.id || projectMode?.project_mode_id || DEFAULT_PROJECT_MODE_ID)
  const mode = getProjectMode(rawId)
  return {
    id: mode.id,
    label_ru: mode.label_ru,
    label_en: mode.label_en,
    version: mode.version || 1,
    contract_ref: mode.contract_ref,
    enabled: Boolean(mode.enabled),
    beta: Boolean(mode.beta),
  }
}

export function normalizeProjectRecord(project = {}) {
  if (!project || typeof project !== 'object') return project
  return {
    ...project,
    project_mode: normalizeProjectMode(project.project_mode || project.projectMode || project.project_mode_id || project.projectModeId || DEFAULT_PROJECT_MODE_ID),
  }
}

export function enabledProjectModes() {
  return PROJECT_MODES.filter((mode) => mode.enabled)
}

export function buildModeContract(modeId = DEFAULT_PROJECT_MODE_ID) {
  const mode = getProjectMode(modeId)
  return {
    contract_ref: mode.contract_ref,
    label_ru: mode.label_ru,
    core_rule: mode.mode_contract?.core_rule || 'Use existing project data.',
    scene_fields: mode.mode_contract?.scene_fields || mode.scene_fields || [],
    progression: mode.mode_contract?.progression || mode.progression || [],
    rules_ru: mode.mode_contract?.rules_ru || [],
    prompt_hint_ru: mode.mode_contract?.prompt_hint_ru || '',
  }
}

export function buildCodexTaskForMode(modeId = DEFAULT_PROJECT_MODE_ID, context = {}) {
  const mode = getProjectMode(modeId)
  const defaults = mode.codex_task_defaults || getDefaultProjectMode().codex_task_defaults
  return {
    ...defaults,
    project_mode_id: mode.id,
    project_mode_label_ru: mode.label_ru,
    contract_ref: mode.contract_ref,
    do_not_change_timing: defaults?.do_not_change_timing !== false,
    full_package_or_ask: {
      rule: 'Codex must not report done unless real still image files are generated and listed.',
      required_outputs: [
        'storyboard_locked.md',
        'storyboard_locked.json',
        'prompts_pack.json',
        'board_import_ready.json',
        'generated_stills_manifest.json',
        'contact_sheet_labeled.jpg',
        'validation_report.json',
        'generated_stills/*',
      ],
      if_stills_fail: [
        'mark status as partial_package',
        'set readiness.can_import_to_board = false or add warning',
        'list missing stills',
        'do not pretend package is complete',
        'ask whether to continue after generation backend is fixed',
      ],
    },
    consistency_rule: {
      core: 'All generated stills must belong to one coherent visual world.',
      common: ['same character identity where character appears', 'same location', 'same lighting/time-of-day', 'same prop continuity', 'same style/realism', 'same camera language'],
      recipe_process_v1: ['same old dacha yard', 'same rustic house', 'same campfire', 'same cast iron pan', 'same prep table', 'same ingredients'],
      lyric_meaning_remix_v1: ['same heroine identity', 'same world/location', 'same emotional tone', 'reveal must be visually readable'],
    },
    context_hint: context?.hint || '',
  }
}
