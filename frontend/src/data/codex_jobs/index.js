export const WORKFLOW_PRESETS = [
  {
    id: "video_first_documentary",
    label: "Видео-сначала: документалка",
    steps: [
      "01_video_inventory",
      "02_visual_sequence",
      "03_script_under_video",
      "04_tts_manual_timing",
      "05_retime_to_tts",
      "06_video_match_board",
    ],
  },
  {
    id: "video_first_lipsync",
    label: "Видео-сначала + lip-sync",
    steps: [
      "01_visual_sequence_with_lipsync_slots",
      "02_script_broll_and_lipsync",
      "03_generate_lipsync_assets",
      "04_tts_manual_timing",
      "05_retime_and_insert_lipsync",
      "06_video_match_board",
    ],
  },
  { id: "music_clip", label: "Музыкальный клип", steps: ["01_concept", "02_beat_map", "03_sequence", "04_final_match"] },
  { id: "story_voiceover", label: "История с диктором", steps: ["01_story_outline", "02_script", "03_tts_manual_timing", "04_video_match"] },
  { id: "existing_montage_retime", label: "Ретайм готового монтажа", steps: ["01_import_assets", "02_manual_timing", "03_retime_board"] },
];


export const WORKFLOW_STEP_LABELS = {
  "01_video_inventory": "01 · Анализ видео",
  "02_visual_sequence": "02 · Нарезка лучших моментов",
  "03_script_under_video": "03 · Текст под сцены",
  "04_tts_manual_timing": "04 · Озвучка / Manual Timing",
  "05_retime_to_tts": "05 · Ретайм под озвучку",
  "06_video_match_board": "06 · Video Match Board",

  "01_visual_sequence_with_lipsync_slots": "01 · Нарезка + lip-sync слоты",
  "02_script_broll_and_lipsync": "02 · Текст для b-roll и lip-sync",
  "03_generate_lipsync_assets": "03 · Создать lip-sync сцены",
  "05_retime_and_insert_lipsync": "05 · Ретайм + вставка lip-sync",
};

export const CODEX_JOB_TEMPLATES = {
  video_first_documentary: {
    "01_video_inventory": {
      task: "analyze_full_source_video_and_build_clean_shot_inventory",
      goal: "Проанализировать весь source video и собрать clean source shots inventory без грязных монтажных элементов.",
      constraints: [
        "Обязательно проанализируй source video от начала до конца, без пропусков.",
        "Найди и выдели clean source shots: законченные, визуально чистые, монтажно пригодные отрезки.",
        "Строго запрещено использовать overlay / subscribe / dirty cuts / титры-интро / графические плашки.",
        "Выбирай лучшие чистые моменты по читаемости, композиции и монтажному потенциалу.",
      ],
      required_outputs: [
        "clean_source_shots_v1",
        "quality_notes_v1",
      ],
    },
    "02_visual_sequence": {
      task: "compose_visual_sequence_from_clean_shots",
      goal: "Собрать visual_sequence_board_v1 только из лучших clean source shots и проверить ритм через silent preview.",
      constraints: [
        "Используй только clean source shots из предыдущего шага.",
        "Сначала собери visual_sequence_board_v1 и сделай silent preview для проверки визуального ритма.",
        "Только после silent preview переходи к написанию voiceover_script под выбранные сцены.",
        "Главный принцип: Не текст ищет кадры. Кадры рождают текст.",
      ],
      required_outputs: [
        "visual_sequence_board_v1",
        "silent_preview_plan_v1",
        "voiceover_script_by_scene_v1",
      ],
    },
    "03_script_under_video": {
      task: "write_voiceover_script_under_locked_visual_sequence",
      goal: "Написать voiceover script под уже выбранные сцены visual sequence board без пересборки визуала от текста.",
    },
    "05_retime_to_tts": {
      task: "retime_video_match_board",
      goal: "Синхронизировать video match board с утверждённым TTS/manual timing.",
    },
  },
  video_first_lipsync: {
    "01_visual_sequence_with_lipsync_slots": {
      task: "build_visual_sequence_with_reserved_lipsync_slots",
      goal: "Собрать visual sequence с заранее выделенными слотами под lip-sync и clean b-roll вокруг них.",
    },
    "02_script_broll_and_lipsync": {
      task: "write_script_for_broll_and_lipsync_slots",
      goal: "Подготовить сценарий, который учитывает b-roll секции и целевые lip-sync слоты.",
    },
    "05_retime_and_insert_lipsync": {
      task: "retime_and_insert_lipsync",
      goal: "Ретаймить и встроить lip-sync ассеты в целевые сегменты.",
    },
  },
};

export function getPresetById(id) {
  return WORKFLOW_PRESETS.find((preset) => preset.id === id) || WORKFLOW_PRESETS[0];
}

export function getCodexJobTemplate(workflowPreset, step) {
  const template = CODEX_JOB_TEMPLATES?.[workflowPreset]?.[step] || {};
  return {
    schema: "photostudio_codex_job_v1",
    workflow_preset: workflowPreset,
    current_step: step,
    expected_output: "JSON пригодный для следующего шага в Codex",
    instructions: [
      "Не текст ищет кадры. Кадры рождают текст.",
      "Сохраняй совместимость со схемами current_project_state и video_match_board.",
    ],
    ...template,
  };
}
