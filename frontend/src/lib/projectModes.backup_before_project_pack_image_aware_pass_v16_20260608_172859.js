// AVA_PROJECT_PACK_MMAUDIO_SOUND_V10: optional scene sound / MMAudio prompt guidelines.
// AVA_PROJECT_PACK_PROMPT_GUIDELINES_V9
// Single registry for Ava project modes, contracts, mode-level prompt guidelines, and Codex task defaults.

export const DEFAULT_PROJECT_MODE_ID = 'manual_general_v1'

export const SOUND_PRODUCTION_FIELDS = [
  'sound_design_needed',
  'sound_role',
  'mmaudio_prompt',
  'mmaudio_negative_prompt',
  'scene_ambience_prompt',
  'foley_prompt',
  'sound_notes',
]

export const PRODUCTION_FIELDS_TO_FILL = [
  'photo_prompt_positive',
  'photo_prompt_negative',
  'video_motion_prompt',
  'video_motion_negative',
  'lipsync_motion_prompt',
  'positive_prompt',
  'negative_prompt',
  'video_prompt',
  'prompt_positive',
  'prompt_negative',
]

const COMMON_NEGATIVE_PROMPT_GUIDELINES = {
  goal: 'Prevent identity drift, broken continuity, unreadable actions, and unwanted generated artifacts.',
  must_include: [
    'no text overlays unless explicitly requested',
    'no watermark, logo, subtitles, meme captions',
    'no identity drift',
    'no distorted face/hands/body',
    'no random object changes',
    'no style jump between scenes',
  ],
}

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
      prompt_guidelines: {
        photo_prompt: {
          goal: 'Create a clear still frame for the scene idea, mood and visual continuity.',
          must_include: ['scene meaning', 'main subject', 'consistent visual style', 'cinematic composition'],
          avoid: ['random unrelated images', 'style changes every scene', 'unclear scene purpose'],
        },
        video_motion_prompt: {
          goal: 'Animate the still with controlled motion that supports scene meaning.',
          must_include: ['stable subject identity', 'controlled camera movement', 'motion related to the scene'],
          avoid: ['camera chaos', 'identity drift', 'random actions unrelated to timing'],
        },
        negative_prompt: COMMON_NEGATIVE_PROMPT_GUIDELINES,
        lipsync_prompt: {
          usage: 'Only for explicitly selected lip-sync scenes.',
          must_include: ['same character identity', 'clear mouth visibility', 'natural performance'],
        },
        still_generation: {
          goal: 'Generate stills that are ready to become video starts.',
          must_include: ['stable identity', 'clear composition', 'matching aspect ratio'],
        },
        sound_design_prompt: {
          usage: 'Optional scene sound layer. Use only if it helps scene clarity or atmosphere.',
          goal: 'Support the scene with subtle ambience, foley, or environment sound without becoming mandatory.',
          sound_roles: ['ambience', 'foley', 'environment', 'transition'],
          must_include: ['clear sound role', 'subtle level', 'matches scene location and action'],
          avoid: ['unrequested music', 'dialogue unless explicitly needed', 'noisy clutter', 'sound that fights narration or master audio'],
        },
        video_generation: {
          goal: 'Preserve the still and add only controlled motion.',
          must_include: ['do not change subject identity', 'do not change scene layout', 'keep motion readable'],
        },
      },
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
    id: 'recipe_process_v1',
    version: 1,
    label_ru: 'Готовка / рецепт',
    label_en: 'Recipe Process',
    description_ru: 'Каждая сцена показывает понятный шаг рецепта: ингредиенты, подготовка, готовка, финал.',
    contract_ref: 'recipe_process_readability_v1',
    enabled: true,
    beta: false,
    scene_fields: ['recipe_step', 'visual_action', 'viewer_should_understand', 'readability_check'],
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
      prompt_guidelines: {
        photo_prompt: {
          goal: 'Create a clear still frame showing the exact recipe step.',
          must_include: ['current cooking step', 'main ingredient or tool of the step', 'clear readable action', 'consistent location', 'consistent props', 'realistic food'],
          avoid: ['beautiful but unclear food shots', 'random studio kitchen', 'wrong ingredients', 'unreadable process', 'fake plastic food'],
        },
        video_motion_prompt: {
          goal: 'Animate the still with small realistic cooking motion.',
          must_include: ['one clear action only', 'gentle camera movement', 'small food/process movement', 'steam/fire/sizzle if appropriate', 'preserve ingredient continuity'],
          avoid: ['chaotic camera movement', 'food morphing', 'ingredients changing randomly', 'impossible cooking actions'],
        },
        negative_prompt: {
          ...COMMON_NEGATIVE_PROMPT_GUIDELINES,
          avoid: ['wrong ingredients', 'fake plastic food', 'impossible cooking process', 'random kitchen change', 'food morphing'],
        },
        lipsync_prompt: {
          usage: 'Only for intro/outro or explicit host speaking scenes.',
          must_include: ['same host identity', 'mouth clearly visible', 'natural speaking expression', 'no hand covering mouth', 'not every recipe step should be lip-sync'],
        },
        still_generation: {
          goal: 'Generate stills that make the cooking process readable before any motion.',
          must_include: ['same kitchen/yard/fire setup', 'same tools and props', 'same ingredients', 'one recipe step per still'],
        },
        sound_design_prompt: {
          usage: 'Optional but useful for process readability when scene sound is requested.',
          goal: 'Support the readable cooking process with realistic scene sound.',
          sound_roles: ['cooking_sound', 'foley', 'ambience', 'environment'],
          useful_sounds: ['fire crackle', 'pan sizzle', 'knife on board', 'food handling', 'subtle outdoor ambience'],
          must_include: ['sound supports the current cooking step', 'realistic foley', 'subtle ambience', 'do not overwhelm narration'],
          avoid: ['music inside sound prompt', 'dialogue unless explicitly needed', 'random kitchen noise', 'overpowering narration'],
        },
        video_generation: {
          goal: 'Turn each still into a small readable cooking action.',
          must_include: ['one action only', 'stable ingredients', 'no process jump', 'no random added food'],
        },
      },
    },
    codex_task_defaults: {
      task_type: 'recipe_storyboard_prompts_and_generated_stills',
      do_not_change_timing: true,
      do_not_require_source_video: true,
      core_instruction: 'Create a production-ready recipe storyboard and prompt pack. Every scene must show one clear cooking step in correct order.',
      mode_prompt_ru: 'Это режим готовки/рецепта. Каждая сцена должна быть понятным шагом процесса, а не просто красивым кадром.',
      expected_outputs: ['storyboard_locked.md', 'storyboard_locked.json', 'prompts_pack.json', 'board_import_ready.json', 'generated_stills_manifest.json', 'contact_sheet_labeled.jpg', 'validation_report.json'],
    },
  },
  {
    id: 'lyric_meaning_remix_v1',
    version: 1,
    label_ru: 'Клип: подмена смысла',
    label_en: 'Lyric Meaning Remix',
    description_ru: 'Берём эмоциональный смысл строк песни/ASR и переносим в неожиданный сюжетный мир.',
    contract_ref: 'lyric_meaning_remix_v1',
    enabled: true,
    beta: false,
    scene_fields: ['idea_fn', 'idea_meaning', 'idea_story', 'idea_anchor', 'viewer_should_understand', 'readability_check'],
    progression: ['setup', 'hint', 'deepen', 'reveal', 'aftermath'],
    mode_contract: {
      contract_ref: 'lyric_meaning_remix_v1',
      label_ru: 'Клип: подмена смысла',
      core_rule: 'Take emotional meaning from lyric/ASR segment and translate it into selected story world instead of following lyrics literally.',
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
      prompt_guidelines: {
        photo_prompt: {
          goal: 'Create a still that supports the central idea, emotional meaning, and reveal logic.',
          must_include: ['story world', 'main character/object continuity', 'emotional meaning of the line', 'visual idea anchor', 'correct reveal stage'],
          avoid: ['literal lyric illustration', 'random beautiful shots', 'revealing the twist too early', 'meme-like comedy if tone is serious', 'unclear central idea'],
        },
        video_motion_prompt: {
          goal: 'Animate the still to strengthen emotion and idea readability.',
          must_include: ['subtle cinematic motion', 'emotion-driven action', 'viewer understanding progression', 'preserve reveal timing'],
          avoid: ['chaotic movement', 'overacting', 'random symbolic objects', 'visuals that break the twist'],
        },
        negative_prompt: {
          ...COMMON_NEGATIVE_PROMPT_GUIDELINES,
          avoid: ['literal lyric illustration', 'unclear central idea', 'wrong reveal timing', 'random symbols'],
        },
        lipsync_prompt: {
          usage: 'For selected singing/speaking scenes only.',
          must_include: ['same character identity', 'mouth clearly visible', 'emotion matching the song line', 'natural performance'],
        },
        still_generation: {
          goal: 'Generate stills that make the meaning-remix idea readable across the sequence.',
          must_include: ['same heroine/object identity', 'same world/location', 'correct reveal stage', 'emotional continuity'],
        },
        sound_design_prompt: {
          usage: 'Optional subtle layer only when it supports story world, reveal, or emotional environment.',
          goal: 'Support the story world/reveal without competing with the song.',
          sound_roles: ['ambience', 'dramatic_texture', 'foley', 'transition'],
          useful_sounds: ['station ambience', 'rain', 'distant train', 'kiosk atmosphere', 'paper bag rustle'],
          must_include: ['subtle layer', 'matches story world', 'supports reveal or emotion'],
          avoid: ['sound competing with song', 'foreground dialogue', 'random loud effects', 'sound revealing twist too early'],
        },
        video_generation: {
          goal: 'Animate stills so the viewer understands the emotional progression and twist.',
          must_include: ['preserve reveal timing', 'stable identity', 'emotion-led motion', 'no random gag collapse'],
        },
      },
    },
    codex_task_defaults: {
      task_type: 'lyric_meaning_remix_storyboard',
      do_not_change_timing: true,
      do_not_require_source_video: true,
      core_instruction: 'For each timing segment, derive emotional meaning from lyric/ASR text and translate it into the selected story world instead of following lyrics literally.',
      mode_prompt_ru: 'Это режим подмены смысла. Нельзя иллюстрировать слова буквально. Нужно перенести эмоциональный смысл в выбранный сюжетный мир.',
      expected_outputs: ['storyboard_locked.md', 'prompts_pack.json', 'board_import_ready.json', 'generated_stills_manifest.json', 'contact_sheet_labeled.jpg', 'validation_report.json'],
    },
  },
  {
    id: 'music_visual_story_v1',
    version: 1,
    label_ru: 'Музыкальный клип',
    label_en: 'Music Visual Story',
    description_ru: 'Визуальная история по музыке/ритму/эмоции, без обязательной подмены смысла.',
    contract_ref: 'music_visual_story_v1',
    enabled: false,
    beta: true,
    scene_fields: ['music_section', 'emotional_energy', 'visual_motif', 'camera_energy', 'viewer_should_feel'],
    mode_contract: {
      contract_ref: 'music_visual_story_v1',
      label_ru: 'Музыкальный клип',
      core_rule: 'Build a visual story from rhythm, emotion, energy and musical sections without necessarily creating a twist.',
      scene_fields: ['music_section', 'emotional_energy', 'visual_motif', 'camera_energy', 'viewer_should_feel'],
      prompt_guidelines: {
        photo_prompt: {
          goal: 'Create visually strong frames matching the mood and section of the music.',
          must_include: ['music mood', 'character or visual motif continuity', 'section energy', 'clear visual style', 'cinematic composition'],
          avoid: ['random unrelated images', 'too literal lyric interpretation', 'style changes every scene'],
        },
        video_motion_prompt: {
          goal: 'Animate according to rhythm and energy.',
          must_include: ['camera motion matching musical energy', 'stable subject identity', 'rhythmic but controlled movement', 'visual continuity between scenes'],
          avoid: ['camera chaos', 'identity drift', 'motion unrelated to music energy'],
        },
        negative_prompt: COMMON_NEGATIVE_PROMPT_GUIDELINES,
        lipsync_prompt: {
          usage: 'Optional, usually 2–4 selected lip-sync scenes per minute if needed.',
          must_include: ['clear mouth', 'song performance emotion', 'same character identity', 'not too many lip-sync scenes'],
        },
        still_generation: { goal: 'Generate cohesive music-video stills with consistent identity, motif and style.' },
        sound_design_prompt: {
          usage: 'Optional only if explicitly requested. Master music is primary.',
          goal: 'Add texture without competing with the master music.',
          sound_roles: ['dramatic_texture', 'transition', 'subtle ambience'],
          must_include: ['texture only', 'low prominence', 'supports rhythm/mood'],
          avoid: ['competing foreground audio', 'extra music layer', 'dialogue unless needed', 'sound clutter'],
        },
        video_generation: { goal: 'Animate stills according to musical rhythm and energy without identity drift.' },
      },
    },
    codex_task_defaults: {
      task_type: 'music_visual_storyboard',
      do_not_change_timing: true,
      do_not_require_source_video: true,
      core_instruction: 'Build a visual story from rhythm, emotion, energy and musical sections.',
      expected_outputs: ['storyboard_locked.md', 'prompts_pack.json', 'board_import_ready.json', 'validation_report.json'],
    },
  },
  {
    id: 'video_first_documentary_v1',
    version: 1,
    label_ru: 'Документалка из видео',
    label_en: 'Video-first Documentary',
    description_ru: 'Сначала анализ реального видео, потом история/озвучка/нарезка только из реально видимого.',
    contract_ref: 'video_first_documentary_v1',
    enabled: false,
    beta: true,
    mode_contract: {
      contract_ref: 'video_first_documentary_v1',
      label_ru: 'Документалка из видео',
      core_rule: 'Use real source footage as truth. Do not invent visuals that are not present in the source video.',
      rules_ru: ['source_video обязателен.', 'Не придумывать кадры, которых нет в видео.', 'Сначала inventory/source shots, потом story/timing/match.'],
      prompt_guidelines: {
        photo_prompt: {
          goal: 'Usually not for generating fake stills; use source video frames/contact sheets/proof frames.',
          must_include: ['source frame reference', 'real visible objects', 'shot id', 'timecode'],
          avoid: ['invented locations', 'invented people', 'fake events'],
        },
        video_motion_prompt: {
          goal: 'For generated inserts only, clearly separated from source footage.',
          must_include: ['generated insert reason', 'style matching documentary', 'do not pretend generated insert is source footage'],
        },
        negative_prompt: COMMON_NEGATIVE_PROMPT_GUIDELINES,
        lipsync_prompt: { usage: 'Only if explicitly generating/intercutting a talking subject, never pretend it came from source footage.' },
        still_generation: { goal: 'Prefer proof frames from source footage. Generated stills must be clearly marked as generated inserts.' },
        sound_design_prompt: {
          usage: 'Optional for inserts/reconstruction only. Source video sound is primary when available.',
          goal: 'Support documentary inserts without faking reality carelessly.',
          sound_roles: ['documentary_bed', 'ambience', 'foley', 'environment'],
          must_include: ['source sound priority', 'mark generated/reconstructed sound clearly', 'natural documentary tone'],
          avoid: ['fake reality presented as source truth', 'overdramatic sound', 'invented events', 'music unless explicitly requested'],
        },
        video_generation: { goal: 'Use source-shot integrity and do not invent documentary evidence.' },
        matching_rules: {
          must_include: ['source_shot_id', 'no_internal_cut', 'distance_to_nearest_cut_sec', 'visual verification', 'top candidate list'],
          avoid: ['selecting clips across source cuts', 'using a visually wrong moment because text matches', 'changing locked timing without permission'],
        },
      },
    },
    codex_task_defaults: {
      task_type: 'video_first_documentary_inventory_and_match',
      do_not_change_timing: true,
      do_not_require_source_video: false,
      source_video_required: true,
      core_instruction: 'Analyze source video first and build documentary storyboard/video match only from visible material.',
      expected_outputs: ['source_shots.json', 'contact_sheets', 'video_match_board_v2.json', 'validation_report.json'],
    },
  },
  {
    id: 'product_ad_v1',
    version: 1,
    label_ru: 'Реклама / продукт',
    label_en: 'Product Ad',
    description_ru: 'Сцены раскрывают продукт, пользу, детали, желание.',
    contract_ref: 'product_ad_v1',
    enabled: false,
    beta: true,
    scene_fields: ['product_role', 'benefit', 'proof_or_desire', 'visual_detail', 'call_to_action_stage'],
    mode_contract: {
      contract_ref: 'product_ad_v1',
      label_ru: 'Реклама / продукт',
      core_rule: 'Product must remain the hero. Every scene should increase desire, clarity or trust.',
      scene_fields: ['product_role', 'benefit', 'proof_or_desire', 'visual_detail', 'call_to_action_stage'],
      prompt_guidelines: {
        photo_prompt: {
          goal: 'Show product clearly with benefit, detail, use case or emotional value.',
          must_include: ['product identity', 'clear product visibility', 'use case', 'benefit', 'consistent brand style if provided'],
          avoid: ['product hidden', 'wrong product', 'unreadable object', 'random lifestyle shot with no product purpose'],
        },
        video_motion_prompt: {
          goal: 'Show product use/detail/transformation with controlled motion.',
          must_include: ['product remains stable', 'clear action', 'camera motion supports product', 'no deformation'],
          avoid: ['product morphing', 'logo/text drift', 'random hands covering product'],
        },
        negative_prompt: { ...COMMON_NEGATIVE_PROMPT_GUIDELINES, avoid: ['product morphing', 'wrong product', 'logo/text drift'] },
        lipsync_prompt: { usage: 'Only for presenter/testimonial scenes where speaking is explicitly needed.' },
        still_generation: { goal: 'Generate product-readable stills where the product remains the hero.' },
        sound_design_prompt: {
          usage: 'Optional for product handling, tactile detail, clean object sounds.',
          goal: 'Increase clarity, trust, or desire while keeping product the hero.',
          sound_roles: ['foley', 'product_handling', 'ambience', 'transition'],
          must_include: ['clean tactile sound', 'product action clarity', 'controlled level'],
          avoid: ['noisy clutter', 'sounds hiding the product moment', 'random music', 'harsh distracting effects'],
        },
        video_generation: { goal: 'Animate without product deformation or brand drift.' },
      },
    },
  },
  {
    id: 'story_monologue_v1',
    version: 1,
    label_ru: 'История / монолог',
    label_en: 'Story / Monologue',
    description_ru: 'Озвучка/текст главный, сцены поддерживают смысл и настроение.',
    contract_ref: 'story_monologue_v1',
    enabled: false,
    beta: true,
    scene_fields: ['monologue_meaning', 'emotional_state', 'visual_memory', 'atmosphere', 'viewer_should_feel'],
    mode_contract: {
      contract_ref: 'story_monologue_v1',
      label_ru: 'История / монолог',
      core_rule: 'Voice/text meaning is primary. Visuals should support mood, memory, atmosphere and emotional arc.',
      scene_fields: ['monologue_meaning', 'emotional_state', 'visual_memory', 'atmosphere', 'viewer_should_feel'],
      prompt_guidelines: {
        photo_prompt: {
          goal: 'Create a still that supports the narrated meaning or emotional memory.',
          must_include: ['emotional meaning', 'story context', 'visual metaphor only if clear', 'consistent tone'],
          avoid: ['over-literal illustration', 'random cinematic shots', 'unclear metaphor'],
        },
        video_motion_prompt: {
          goal: 'Use restrained cinematic motion to support narration.',
          must_include: ['slow controlled movement', 'mood continuity', 'no distracting action'],
          avoid: ['excessive action', 'fast cuts if monologue is calm', 'visuals that overpower voice'],
        },
        negative_prompt: COMMON_NEGATIVE_PROMPT_GUIDELINES,
        lipsync_prompt: { usage: 'Only if the monologue speaker is visible and explicitly speaking.' },
        still_generation: { goal: 'Generate stills that support narration without overpowering it.' },
        sound_design_prompt: {
          usage: 'Optional atmosphere layer under narration.',
          goal: 'Support mood, memory, atmosphere, and emotional arc without overpowering voice.',
          sound_roles: ['ambience', 'environment', 'dramatic_texture'],
          useful_sounds: ['room tone', 'rain', 'train', 'distant city', 'wind', 'quiet nature'],
          must_include: ['stay under narration', 'slow subtle atmosphere', 'matches emotional state'],
          avoid: ['sound overpowering voice', 'busy foley', 'fast loud effects', 'extra dialogue'],
        },
        video_generation: { goal: 'Use restrained motion aligned to narration.' },
      },
    },
  },
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
    prompt_guidelines: mode.mode_contract?.prompt_guidelines || {},
  }
}

export function buildCodexTaskForMode(modeId = DEFAULT_PROJECT_MODE_ID, context = {}) {
  const mode = getProjectMode(modeId)
  const defaults = mode.codex_task_defaults || getDefaultProjectMode().codex_task_defaults
  return {
    ...defaults,
    mode_id: mode.id,
    mode_contract_ref: mode.contract_ref,
    prompt_guidelines_ref: `${mode.contract_ref}.prompt_guidelines`,
    prompt_guidelines: mode.mode_contract?.prompt_guidelines || {},
    production_fields_to_fill: [...PRODUCTION_FIELDS_TO_FILL, ...SOUND_PRODUCTION_FIELDS],
    project_mode_id: mode.id,
    project_mode_label_ru: mode.label_ru,
    contract_ref: mode.contract_ref,
    do_not_change_timing: defaults?.do_not_change_timing !== false,
    sound_layer: {
      supported: true,
      required_by_default: false,
      optional_fields: SOUND_PRODUCTION_FIELDS,
      rule: 'Sound/MMAudio prompts are optional and mode-aware. Fill only if scene sound design is requested.',
    },
    full_package_or_ask: true,
    full_package_contract: {
      rule: 'Codex/ChatGPT must not report DONE unless real still image files are generated and listed.',
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
        'set validation.full_package = false',
        'readiness.missing includes generated_stills',
        'do not pretend package is complete',
        'answer PARTIAL, not DONE',
      ],
    },
    consistency_rule: {
      core: 'All generated stills must belong to one coherent visual world.',
      common: ['same character identity where character appears', 'same location', 'same lighting/time-of-day', 'same prop continuity', 'same style/realism', 'same camera language'],
      recipe_process_v1: ['same cooking location', 'same tools/props', 'same ingredients', 'one readable cooking step per scene'],
      lyric_meaning_remix_v1: ['same heroine/object identity', 'same world/location', 'same emotional tone', 'reveal must be visually readable'],
    },
    context_hint: context?.hint || '',
  }
}
