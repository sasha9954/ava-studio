// AVA_FINAL_PROMPT_SANITIZER_IMAGE_AWARE_V17: final generation prompt sanitizer rules.
// AVA_PROJECT_PACK_IMAGE_AWARE_PASS_V16: mode-level image-aware video prompt pass guidelines.
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
    visible_in_create: true,
    selectable: true,
    display_order: 10,
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
        final_generation_prompt: {
          goal: 'Final generation prompts must be clean English prompts for the video model, not planning text.',
          must_include: ['actual visible content', 'safe motion only', 'current scene step only', 'no service labels', 'English final prompt'],
          avoid: ['Scene action:', 'Viewer must understand:', 'Motion:', 'Recipe step:', 'Russian text', 'planning field names', 'generic actions from other steps', 'objects not visible in the still'],
          sanitizer_required: true,
        },
        image_aware_video_prompt_pass: {
          required_after_stills: true,
          goal: 'Rewrite final video prompts after real still images exist, so video generation matches the actual image content.',
          must_include: ['actual visible subject', 'safe motion based on the still', 'locked scene meaning', 'stable framing and continuity'],
          avoid: ['objects not visible in the still', 'actions from another recipe/story step', 'camera moves that contradict the still framing', 'turning b-roll into lip-sync', 'changing route or timing'],
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
    visible_in_create: true,
    selectable: true,
    display_order: 20,
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
        final_generation_prompt: {
          goal: 'Final generation prompts must be clean English prompts for the video model, not planning text.',
          must_include: ['actual visible content', 'safe motion only', 'current scene step only', 'no service labels', 'English final prompt'],
          avoid: ['Scene action:', 'Viewer must understand:', 'Motion:', 'Recipe step:', 'Russian text', 'planning field names', 'generic actions from other steps', 'objects not visible in the still'],
          sanitizer_required: true,
        },
        image_aware_video_prompt_pass: {
          required_after_stills: true,
          goal: 'Rewrite final recipe video prompts after real still images exist, so each video animates only the current visible recipe step.',
          recipe_process_v1_final_prompt_rules: [
            'Final video prompt must describe only what is visible in the still.',
            'Ingredient overview scenes must not start cooking.',
            'Prep scenes must not jump to pan/fire/frying.',
            'Cooking scenes must not jump to the next ingredient unless that ingredient is visible in the still.',
            'Finished dish scenes must not add hands, herbs, seasoning, stirring or plating unless visible.',
            'Lip-sync scenes must prioritize visible mouth movement and not describe cooking action.',
            'Do not include Russian scene text or translation in final generation prompt.',
            'Do not include service labels such as Scene action, Viewer must understand, Motion.',
          ],
          must_include: ['actual visible food/tools', 'one safe motion based on the still', 'locked recipe_step', 'viewer_should_understand', 'stable framing and continuity'],
          avoid: ['pan/fire/steam/sizzling in prep-only stills unless visible', 'starting cooking in ingredient overview scenes', 'jumping to next recipe step', 'hands/knife/pan if not visible', 'turning b-roll into lip-sync'],
          recipe_process_v1_image_aware_rules: [
            'Each final video prompt must animate only the current recipe step visible in the still.',
            'Ingredient overview scenes must not start cooking.',
            'Prep scenes must not jump to pan/fire/frying.',
            'Cooking scenes must not jump to serving/final dish.',
            'If a still shows only ingredients on a table, prompt must say: no pan, no fire, no hands, no cooking starts yet.',
            'If a still shows cutting on a board, prompt must say: no pan, no fire, no frying, no next step.',
            'If a still shows food already in a pan, animate only small bubbling, steam, gentle stirring if visible/appropriate.',
            'For host lip-sync scenes, prioritize visible mouth movement over environment motion.',
          ],
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
    label_ru: 'Подмена смысла',
    label_en: 'Lyric Meaning Remix',
    description_ru: 'Берём эмоциональный смысл строк песни/ASR и переносим в неожиданный сюжетный мир.',
    contract_ref: 'lyric_meaning_remix_v1',
    enabled: true,
    beta: false,
    visible_in_create: true,
    selectable: true,
    display_order: 30,
    scene_fields: ['idea_fn', 'idea_meaning', 'idea_story', 'idea_anchor', 'viewer_should_understand', 'readability_check'],
    progression: ['setup', 'hint', 'deepen', 'reveal', 'aftermath'],
    mode_contract: {
      contract_ref: 'lyric_meaning_remix_v1',
      label_ru: 'Подмена смысла',
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
        final_generation_prompt: {
          goal: 'Final generation prompts must be clean English prompts for the video model, not planning text.',
          must_include: ['actual visible content', 'safe motion only', 'current scene step only', 'no service labels', 'English final prompt'],
          avoid: ['Scene action:', 'Viewer must understand:', 'Motion:', 'Recipe step:', 'Russian text', 'planning field names', 'generic actions from other steps', 'objects not visible in the still'],
          sanitizer_required: true,
        },
        image_aware_video_prompt_pass: {
          required_after_stills: true,
          goal: 'Rewrite final video prompts after real still images exist, so video generation matches the actual image content and preserves story-world/reveal logic.',
          must_include: ['actual visible subject', 'safe motion based on the still', 'locked scene meaning', 'stable framing and continuity'],
          avoid: ['objects not visible in the still', 'actions from another recipe/story step', 'camera moves that contradict the still framing', 'turning b-roll into lip-sync', 'changing route or timing'],
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
        final_generation_prompt: {
          goal: 'Final generation prompts must be clean English prompts for the video model, not planning text.',
          must_include: ['actual visible content', 'safe motion only', 'current scene step only', 'no service labels', 'English final prompt'],
          avoid: ['Scene action:', 'Viewer must understand:', 'Motion:', 'Recipe step:', 'Russian text', 'planning field names', 'generic actions from other steps', 'objects not visible in the still'],
          sanitizer_required: true,
        },
        image_aware_video_prompt_pass: {
          required_after_stills: true,
          goal: 'Rewrite final video prompts after real still images exist, so video generation matches the actual image content while keeping master music primary.',
          must_include: ['actual visible subject', 'safe motion based on the still', 'locked scene meaning', 'stable framing and continuity'],
          avoid: ['objects not visible in the still', 'actions from another recipe/story step', 'camera moves that contradict the still framing', 'turning b-roll into lip-sync', 'changing route or timing'],
        },
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
    id: 'podcast_audio_v1',
    version: 1,
    label_ru: 'Подкаст',
    label_en: 'Podcast',
    description_ru: 'Подкаст/разговор: голос главный, визуал и звук поддерживают темы, главы и атмосферу.',
    contract_ref: 'podcast_audio_v1',
    enabled: true,
    beta: false,
    visible_in_create: true,
    selectable: true,
    display_order: 50,
    scene_fields: ['podcast_topic', 'speaker_role', 'chapter_meaning', 'visual_support', 'audio_focus'],
    progression: ['intro', 'topic_setup', 'discussion', 'example', 'conclusion'],
    mode_contract: {
      contract_ref: 'podcast_audio_v1',
      label_ru: 'Подкаст',
      core_rule: 'Voice/dialogue is primary. Visuals must support podcast chapters, topic clarity and speaker continuity without distracting from speech.',
      scene_fields: ['podcast_topic', 'speaker_role', 'chapter_meaning', 'visual_support', 'audio_focus'],
      progression: ['intro', 'topic_setup', 'discussion', 'example', 'conclusion'],
      rules_ru: [
        'Голос/разговор — главный источник смысла.',
        'Не перегружать кадры действием, если оно отвлекает от речи.',
        'Поддерживать стабильность ведущих/гостей, студии или визуального мира.',
        'Если есть talking-head/lip-sync, лицо и рот должны быть хорошо видны.',
        'MMAudio/звук должен быть тихим слоем под голосом, если не задано иначе.',
      ],
      prompt_hint_ru: 'Подкаст: визуал должен помогать понять тему и главу разговора, не спорить с голосом.',
      prompt_guidelines: {
        photo_prompt: {
          goal: 'Create a still that supports the podcast topic, speaker identity, studio/world and chapter meaning.',
          must_include: ['speaker or topic visual anchor', 'consistent studio/location or visual style', 'chapter meaning', 'clean composition'],
          avoid: ['busy distracting action', 'random unrelated stock-like visuals', 'visuals that overpower speech'],
        },
        video_motion_prompt: {
          goal: 'Animate with restrained motion suitable for a podcast or narrated discussion.',
          must_include: ['subtle camera movement', 'stable speaker identity if present', 'calm visual support', 'no distracting action'],
          avoid: ['chaotic movement', 'overacting', 'fast action unrelated to topic'],
        },
        negative_prompt: COMMON_NEGATIVE_PROMPT_GUIDELINES,
        lipsync_prompt: {
          usage: 'For visible speaker/talking-head scenes only.',
          must_include: ['same speaker identity', 'clear mouth visibility', 'natural conversational expression', 'no hand covering mouth'],
        },
        still_generation: { goal: 'Generate podcast-support stills with consistent speaker/location/style.' },
        final_generation_prompt: {
          goal: 'Final generation prompts must be clean English prompts for the video model, not planning text.',
          must_include: ['actual visible content', 'safe motion only', 'current scene step only', 'no service labels', 'English final prompt'],
          avoid: ['Scene action:', 'Viewer must understand:', 'Motion:', 'Recipe step:', 'Russian text', 'planning field names', 'generic actions from other steps', 'objects not visible in the still'],
          sanitizer_required: true,
        },
        image_aware_video_prompt_pass: {
          required_after_stills: true,
          goal: 'Rewrite final video prompts after real stills exist, matching visible podcast stills and preserving topic/speaker continuity.',
          must_include: ['actual visible subject', 'safe motion based on the still', 'locked chapter meaning', 'stable framing and continuity'],
          avoid: ['objects not visible in the still', 'actions from another topic', 'turning b-roll into lip-sync', 'changing route or timing'],
        },
        sound_design_prompt: {
          usage: 'Optional subtle layer under speech.',
          goal: 'Support podcast chapter atmosphere without overpowering voice.',
          sound_roles: ['room_tone', 'studio_ambience', 'subtle_transition', 'topic_texture'],
          must_include: ['stay under speech', 'low prominence', 'matches room/topic'],
          avoid: ['loud music', 'extra dialogue', 'busy foley', 'sound that fights narration'],
        },
        video_generation: { goal: 'Animate stills calmly and keep speech as the main focus.' },
      },
    },
    codex_task_defaults: {
      task_type: 'podcast_storyboard_prompts',
      do_not_change_timing: true,
      do_not_require_source_video: true,
      core_instruction: 'Create podcast-support still prompts and image-aware video prompts while preserving voice/dialogue as the main source of meaning.',
      mode_prompt_ru: 'Это режим подкаста. Голос главный, визуал и звук только поддерживают тему и главы.',
      expected_outputs: ['storyboard_locked.md', 'prompts_pack.json', 'board_import_ready.json', 'generated_stills_manifest.json', 'validation_report.json'],
    },
  },
  {
    id: 'video_first_documentary_v1',
    version: 1,
    label_ru: 'Документалка',
    label_en: 'Video-first Documentary',
    description_ru: 'Сначала анализ реального видео, потом история/озвучка/нарезка только из реально видимого.',
    contract_ref: 'video_first_documentary_v1',
    enabled: false,
    beta: true,
    visible_in_create: true,
    selectable: false,
    disabled_reason_ru: 'Скоро',
    display_order: 60,
    mode_contract: {
      contract_ref: 'video_first_documentary_v1',
      label_ru: 'Документалка',
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
        final_generation_prompt: {
          goal: 'Final generation prompts must be clean English prompts for the video model, not planning text.',
          must_include: ['actual visible content', 'safe motion only', 'current scene step only', 'no service labels', 'English final prompt'],
          avoid: ['Scene action:', 'Viewer must understand:', 'Motion:', 'Recipe step:', 'Russian text', 'planning field names', 'generic actions from other steps', 'objects not visible in the still'],
          sanitizer_required: true,
        },
        image_aware_video_prompt_pass: {
          required_after_stills: true,
          goal: 'Rewrite final video prompts after real still images exist, so video generation matches the actual source/insertion still without inventing documentary evidence.',
          must_include: ['actual visible subject', 'safe motion based on the still', 'locked scene meaning', 'stable framing and continuity'],
          avoid: ['objects not visible in the still', 'actions from another recipe/story step', 'camera moves that contradict the still framing', 'turning b-roll into lip-sync', 'changing route or timing'],
        },
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
    visible_in_create: true,
    selectable: false,
    disabled_reason_ru: 'Скоро',
    display_order: 70,
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
        final_generation_prompt: {
          goal: 'Final generation prompts must be clean English prompts for the video model, not planning text.',
          must_include: ['actual visible content', 'safe motion only', 'current scene step only', 'no service labels', 'English final prompt'],
          avoid: ['Scene action:', 'Viewer must understand:', 'Motion:', 'Recipe step:', 'Russian text', 'planning field names', 'generic actions from other steps', 'objects not visible in the still'],
          sanitizer_required: true,
        },
        image_aware_video_prompt_pass: {
          required_after_stills: true,
          goal: 'Rewrite final video prompts after real still images exist, so video generation matches the actual product still and keeps product identity stable.',
          must_include: ['actual visible subject', 'safe motion based on the still', 'locked scene meaning', 'stable framing and continuity'],
          avoid: ['objects not visible in the still', 'actions from another recipe/story step', 'camera moves that contradict the still framing', 'turning b-roll into lip-sync', 'changing route or timing'],
        },
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
    label_ru: 'История',
    label_en: 'Story',
    description_ru: 'История/монолог: озвучка или текст главный, сцены поддерживают смысл, настроение и эмоциональную дугу.',
    contract_ref: 'story_monologue_v1',
    enabled: true,
    beta: false,
    visible_in_create: true,
    selectable: true,
    display_order: 40,
    scene_fields: ['monologue_meaning', 'emotional_state', 'visual_memory', 'atmosphere', 'viewer_should_feel'],
    mode_contract: {
      contract_ref: 'story_monologue_v1',
      label_ru: 'История',
      core_rule: 'Voice/text meaning is primary. Visuals should support mood, memory, atmosphere and emotional arc.',
      scene_fields: ['monologue_meaning', 'emotional_state', 'visual_memory', 'atmosphere', 'viewer_should_feel'],
      rules_ru: [
        'Озвучка/текст — главный источник смысла.',
        'Кадры должны поддерживать настроение, память, атмосферу и эмоциональную дугу.',
        'Не перегружать сцену лишним действием, если монолог спокойный.',
        'Не менять тайминг и scene_id без явной просьбы.',
      ],
      prompt_hint_ru: 'История/монолог: визуал поддерживает голос, а не спорит с ним.',
      prompt_guidelines: {
        photo_prompt: {
          goal: 'Create a still that supports the narrated meaning or emotional memory.',
          must_include: ['emotional meaning', 'story context', 'visual memory or atmosphere', 'consistent tone'],
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
        final_generation_prompt: {
          goal: 'Final generation prompts must be clean English prompts for the video model, not planning text.',
          must_include: ['actual visible content', 'safe motion only', 'current scene step only', 'no service labels', 'English final prompt'],
          avoid: ['Scene action:', 'Viewer must understand:', 'Motion:', 'Recipe step:', 'Russian text', 'planning field names', 'generic actions from other steps', 'objects not visible in the still'],
          sanitizer_required: true,
        },
        image_aware_video_prompt_pass: {
          required_after_stills: true,
          goal: 'Rewrite final video prompts after real still images exist, so video generation matches the actual still while staying under narration and preserving mood.',
          must_include: ['actual visible subject', 'safe motion based on the still', 'locked scene meaning', 'stable framing and continuity'],
          avoid: ['objects not visible in the still', 'camera moves that contradict the still framing', 'changing route or timing'],
        },
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
    codex_task_defaults: {
      task_type: 'story_monologue_storyboard',
      do_not_change_timing: true,
      do_not_require_source_video: true,
      core_instruction: 'Build a visual story from narration/text meaning. Keep visuals under the voice and preserve timing.',
      mode_prompt_ru: 'Это режим истории/монолога. Голос/текст главный, визуал поддерживает смысл и настроение.',
      expected_outputs: ['storyboard_locked.md', 'prompts_pack.json', 'board_import_ready.json', 'generated_stills_manifest.json', 'validation_report.json'],
    },
  },
]


// AVA_MODE_CONTRACTS_UNIVERSAL_WORKFLOW_V75
// These objects are mode-level guidance, not concrete scenario content.
// The concrete project comes from: user task, audio, timing JSON, cards folder,
// selected aspect ratio, storyBlocks, and scene list.
export const UNIVERSAL_STAGE_PIPELINE_V75 = [
  'input_validation',
  'questions_if_missing',
  'still_planning',
  'photo_prompt_pass',
  'still_generation_or_import',
  'image_review_and_reject',
  'image_aware_video_prompt_pass',
  'board_import_patch',
  'video_generation',
]

export const UNIVERSAL_INPUT_FOLDER_CONTRACT_V75 = {
  rule: 'The worker reads the project folder as source of truth: audio, timing JSON, cards, generated stills, and board snapshot/patch files when present.',
  expected_items: [
    'audio file or audio asset reference',
    'timing JSON / ava_project_pack_v1',
    'user task / project description',
    'character cards if characters are used',
    'location cards if location continuity matters',
    'object/prop/product/ingredient cards depending on selected mode',
    'generated stills folder after still generation',
    'board JSON snapshot when patching an existing Board',
  ],
  ask_if_missing: [
    'required visual cards are missing for scenes that depend on identity or continuity',
    'project task is too vague',
    'route/lip-sync expectations are unclear',
    'still images are missing but video prompts are requested',
  ],
}

export const UNIVERSAL_STILL_FIRST_POLICY_V75 = {
  rule: 'Do not write final video prompts before still images are generated or imported and reviewed.',
  stages: [
    'write still plan',
    'write photo prompts',
    'generate/import stills',
    'review stills against cards and scene intent',
    'select/approve stills',
    'write image-aware video prompts based on the actual selected stills',
  ],
  locked_during_still_pass: [
    'scene_id',
    'start',
    'end',
    'duration',
    'route',
    'story block order',
  ],
}

export const UNIVERSAL_IMAGE_REVIEW_POLICY_V75 = {
  rule: 'Every generated/imported still must be checked before video prompts are finalized.',
  review_fields: [
    'candidate_id',
    'scene_id',
    'approved',
    'reject_reason',
    'visible_content_summary',
    'continuity_check',
    'card_match_check',
    'must_show_check',
    'must_not_show_check',
    'safe_motion_notes',
  ],
  reject_if: [
    'wrong character/person/product/ingredient',
    'wrong location or broken world continuity',
    'extra duplicated props that break the scene',
    'missing required object/action',
    'shows a future recipe/story step too early',
    'image framing contradicts intended video route',
    'bad anatomy, broken hands/face, unreadable object',
  ],
}

export const BOARD_SNAPSHOT_PATCH_POLICY_V75 = {
  role: 'Board JSON is a full production snapshot, not the main scenario source.',
  keep_all_fields: true,
  use_cases: [
    'repair translations/meaning after some scenes are already generated',
    'patch photo/video prompts without losing media',
    'add or edit MMAudio/sound prompts',
    'preserve generated images/videos/jobs while updating text fields',
    'restore Board state',
  ],
  safe_patch_mode: {
    match_by: 'scene_id',
    can_update: [
      'scene_word_text',
      'original_text',
      'translated_text_ru',
      'meaning_hint_ru',
      'viewer_should_understand',
      'visual_action',
      'readability_check',
      'photo_prompt_positive',
      'photo_prompt_negative',
      'video_motion_prompt',
      'video_motion_negative',
      'positive_prompt',
      'negative_prompt',
      'video_prompt',
      'prompt_positive',
      'prompt_negative',
      'lipsync_motion_prompt',
      'final_video_prompt',
      'final_negative_prompt',
      'final_lipsync_prompt',
      'sound_design_needed',
      'sound_role',
      'mmaudio_prompt',
      'mmaudio_negative_prompt',
      'scene_ambience_prompt',
      'foley_prompt',
      'sound_notes',
      'storyBlocks',
      'blockId',
      'blockTitle',
      'blockColor',
    ],
    do_not_touch: [
      'scene_id',
      'id',
      'start',
      'end',
      'duration',
      'start_sec',
      'end_sec',
      'duration_sec',
      'target_t0',
      'target_t1',
      'route',
      'planned_route',
      'image/video/media URLs',
      'asset ids',
      'generated results',
      'job ids',
      'queue status',
      'audio file',
      'audio slice boundaries unless explicitly requested',
    ],
  },
}

export const MODE_BEHAVIOR_PROFILES_V75 = {
  manual_general_v1: {
    short_label_ru: 'Клип',
    primary_goal: 'Create a coherent clip/storyboard from timing, cards, references, scene notes and user direction.',
    focus: ['visual continuity', 'performance', 'mood', 'scene meaning', 'controlled motion'],
    card_usage: ['character cards when identity matters', 'location cards when world continuity matters', 'style/reference cards if provided'],
    still_rules: ['one readable scene idea per still', 'avoid random beautiful frames without scene purpose'],
    review_focus: ['identity continuity', 'style continuity', 'scene purpose readability', 'safe motion potential'],
    sound_role: 'Optional ambience/foley/MMAudio only if it supports the scene and does not fight master audio.',
  },
  recipe_process_v1: {
    short_label_ru: 'Готовка / рецепт',
    primary_goal: 'Show a readable step-by-step process in correct order. Process clarity beats beauty.',
    focus: ['one cooking step per scene', 'ingredient continuity', 'prop/tool continuity', 'no premature future steps', 'no duplicate impossible cookware'],
    card_usage: ['character/host card for lip-sync or visible host', 'location card for same kitchen/yard/table', 'ingredient cards', 'prop/tool/cookware cards'],
    still_rules: ['show only the current recipe step', 'do not show pan/fire/cooked result before the step requires it', 'keep ingredient and prop counts stable'],
    review_focus: ['right ingredients', 'right step', 'no extra pan/bowl/knife', 'same table/location', 'no cooked result too early'],
    sound_role: 'Optional cooking foley/MMAudio: sizzle, fire, knife, food handling, ambience; must support current step.',
  },
  lyric_meaning_remix_v1: {
    short_label_ru: 'Подмена смысла',
    primary_goal: 'Translate emotional meaning of lyrics/ASR into a selected story world without illustrating words literally.',
    focus: ['emotion-to-story translation', 'story world', 'reveal timing', 'central idea readability', 'not literal lyrics'],
    card_usage: ['character/object/location cards define the alternative story world', 'style cards maintain the remix world'],
    still_rules: ['each still advances the alternate idea or reveal', 'do not reveal twist too early', 'do not add random symbols'],
    review_focus: ['does this still support the central idea', 'does reveal timing make sense', 'is it too literal', 'is identity/world consistent'],
    sound_role: 'Usually master music is primary; optional subtle texture only if it supports story world/reveal.',
  },
  story_monologue_v1: {
    short_label_ru: 'История',
    primary_goal: 'Support narration/text meaning with restrained visuals, mood, memory and emotional arc.',
    focus: ['narration meaning', 'emotion', 'atmosphere', 'visual memory', 'not overpowering voice'],
    card_usage: ['character/location cards if the story has recurring people/places', 'object cards if an object is a memory anchor'],
    still_rules: ['visuals support the spoken meaning', 'do not over-literalize every phrase', 'keep a consistent emotional tone'],
    review_focus: ['does it support the narration', 'is mood correct', 'does it distract from voice', 'is metaphor clear enough'],
    sound_role: 'Optional low ambience/texture under narration; never overpower voice.',
  },
  podcast_audio_v1: {
    short_label_ru: 'Подкаст',
    primary_goal: 'Voice/dialogue is primary. Visuals support topic chapters, speakers and studio/world continuity.',
    focus: ['speaker continuity', 'topic clarity', 'chapter structure', 'calm support visuals', 'audio-first thinking'],
    card_usage: ['speaker cards for talking-head/lip-sync', 'studio/location card', 'topic/object cards if visual examples are needed'],
    still_rules: ['do not overload frames with action', 'make chapter/topic understandable', 'keep speakers and setting consistent'],
    review_focus: ['speaker identity', 'mouth visibility for talking-head scenes', 'topic support', 'visual not distracting'],
    sound_role: 'Room tone/studio ambience/very subtle transitions only; voice remains dominant.',
  },
  video_first_documentary_v1: {
    short_label_ru: 'Документалка',
    primary_goal: 'Use real source footage as truth. Do not invent documentary evidence.',
    focus: ['source-shot integrity', 'visual inventory', 'proof frames', 'no invented footage', 'video match after timing'],
    card_usage: ['source video/contact sheets/proof frames are primary', 'generated cards only for clearly marked inserts'],
    still_rules: ['prefer source frames; generated stills must be marked as inserts', 'do not fake real events'],
    review_focus: ['visible in source', 'no internal cut', 'candidate matches narration', 'proof frame verifies selection'],
    sound_role: 'Source sound is primary when available; generated sound for inserts only.',
  },
  product_ad_v1: {
    short_label_ru: 'Реклама / продукт',
    primary_goal: 'Product remains the hero. Every scene increases clarity, desire, trust or proof.',
    focus: ['product identity', 'benefit', 'use case', 'detail', 'brand/visual continuity'],
    card_usage: ['product card is mandatory', 'brand/style card if available', 'location/use-case card if relevant'],
    still_rules: ['product visible and readable', 'do not hide or deform product', 'do not drift logo/text'],
    review_focus: ['product matches card', 'benefit is clear', 'product not deformed', 'no wrong logo/text'],
    sound_role: 'Optional tactile/product handling foley; clean and controlled.',
  },
}

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

// AVA_PROJECT_MODES_CREATE_LIST_V74
export function enabledProjectModes() {
  return PROJECT_MODES.filter((mode) => mode.enabled)
}

export function createProjectModes() {
  return PROJECT_MODES
    .filter((mode) => mode.enabled || mode.visible_in_create)
    .slice()
    .sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999))
}

export function isProjectModeSelectable(mode = {}) {
  return mode.enabled !== false && mode.selectable !== false
}


// AVA_PROJECT_MODE_CATALOG_V76
export function projectModeCatalogForPack() {
  const visibleModes = (typeof createProjectModes === 'function' ? createProjectModes() : PROJECT_MODES)
    .map((mode) => ({
      id: mode.id,
      label_ru: mode.label_ru,
      label_en: mode.label_en,
      enabled: Boolean(mode.enabled),
      beta: Boolean(mode.beta),
      selectable: mode.selectable !== false && mode.enabled !== false,
      disabled_reason_ru: mode.disabled_reason_ru || '',
      display_order: mode.display_order ?? 999,
      contract_ref: mode.contract_ref,
    }))

  return {
    active_modes: PROJECT_MODES
      .filter((mode) => mode.enabled && mode.selectable !== false)
      .map((mode) => mode.id),
    visible_modes: visibleModes,
    visible_disabled_modes: visibleModes
      .filter((mode) => !mode.selectable)
      .map((mode) => ({
        id: mode.id,
        label_ru: mode.label_ru,
        disabled_reason_ru: mode.disabled_reason_ru || 'Скоро',
        beta: Boolean(mode.beta),
        contract_ref: mode.contract_ref,
      })),
  }
}

export function projectTypeForMode(modeId = DEFAULT_PROJECT_MODE_ID) {
  const map = {
    manual_general_v1: 'clip',
    recipe_process_v1: 'recipe',
    lyric_meaning_remix_v1: 'meaning_remix',
    story_monologue_v1: 'story',
    podcast_audio_v1: 'podcast',
    video_first_documentary_v1: 'documentary',
    product_ad_v1: 'product_ad',
    music_visual_story_v1: 'music_visual_story',
  }
  return map[modeId] || 'clip'
}


export function buildModeContract(modeId = DEFAULT_PROJECT_MODE_ID) {
  const mode = getProjectMode(modeId)
  const behavior = MODE_BEHAVIOR_PROFILES_V75[mode.id] || MODE_BEHAVIOR_PROFILES_V75[DEFAULT_PROJECT_MODE_ID]
  return {
    contract_ref: mode.contract_ref,
    label_ru: mode.label_ru,
    core_rule: mode.mode_contract?.core_rule || behavior?.primary_goal || 'Use existing project data.',
    scene_fields: mode.mode_contract?.scene_fields || mode.scene_fields || [],
    progression: mode.mode_contract?.progression || mode.progression || [],
    rules_ru: mode.mode_contract?.rules_ru || [],
    prompt_hint_ru: mode.mode_contract?.prompt_hint_ru || '',
    prompt_guidelines: mode.mode_contract?.prompt_guidelines || {},
    // AVA_MODE_CONTRACTS_UNIVERSAL_WORKFLOW_V75
    mode_behavior_profile: behavior,
    universal_stage_pipeline: UNIVERSAL_STAGE_PIPELINE_V75,
    input_folder_contract: UNIVERSAL_INPUT_FOLDER_CONTRACT_V75,
    still_first_policy: UNIVERSAL_STILL_FIRST_POLICY_V75,
    image_review_policy: UNIVERSAL_IMAGE_REVIEW_POLICY_V75,
    board_snapshot_patch_policy: BOARD_SNAPSHOT_PATCH_POLICY_V75,
    // AVA_MODE_CONTRACTS_UNIVERSAL_WORKFLOW_V75
    behavior_profile: behavior,
    universal_stage_pipeline: UNIVERSAL_STAGE_PIPELINE_V75,
    input_folder_contract: UNIVERSAL_INPUT_FOLDER_CONTRACT_V75,
    still_first_policy: UNIVERSAL_STILL_FIRST_POLICY_V75,
    image_review_policy: UNIVERSAL_IMAGE_REVIEW_POLICY_V75,
    board_snapshot_patch_policy: BOARD_SNAPSHOT_PATCH_POLICY_V75,
    output_strategy: {
      rule: 'Return stage-appropriate JSON patches, not a full rewritten project unless explicitly requested.',
      still_plan_patch: ['scene_id', 'must_show', 'must_not_show', 'continuity_anchors', 'photo_prompt_positive', 'photo_prompt_negative'],
      image_review_patch: ['scene_id', 'candidate_id', 'approved', 'reject_reason', 'visible_content_summary', 'safe_motion_notes'],
      board_import_patch: ['scene_id', 'selected_still', 'video_motion_prompt', 'negative_prompt', 'lipsync_motion_prompt', 'mmaudio_prompt', 'sound_notes'],
    },
  }
}

export function buildCodexTaskForMode(modeId = DEFAULT_PROJECT_MODE_ID, context = {}) {
  const mode = getProjectMode(modeId)
  const defaults = mode.codex_task_defaults || getDefaultProjectMode().codex_task_defaults
  const behavior = MODE_BEHAVIOR_PROFILES_V75[mode.id] || MODE_BEHAVIOR_PROFILES_V75[DEFAULT_PROJECT_MODE_ID]
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
    final_generation_prompt: {
          goal: 'Final generation prompts must be clean English prompts for the video model, not planning text.',
          must_include: ['actual visible content', 'safe motion only', 'current scene step only', 'no service labels', 'English final prompt'],
          avoid: ['Scene action:', 'Viewer must understand:', 'Motion:', 'Recipe step:', 'Russian text', 'planning field names', 'generic actions from other steps', 'objects not visible in the still'],
          sanitizer_required: true,
        },
        image_aware_video_prompt_pass: {
      required_after_stills: true,
      required_before_video_generation: true,
      rule: 'After real still images are generated or imported, rewrite final video prompts from actual visible content before video generation.',
    },
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
