// AVA_COOKING_PROMPT_MEMORY_V83: reusable outdoor cooking i2v_sound prompt memory and preservation helpers.

export const COOKING_PROMPT_MEMORY_PRESET_ID = 'outdoor_cooking_i2v_sound'

const AUDIO_BAN_PHRASES = [
  'no speech',
  'no voiceover',
  'no human vocals',
  'no dialogue',
  'no narration',
  'no singing',
  'no background music',
  'no soundtrack',
  'no cinematic score',
  'no drums',
  'no melody',
  'no artificial sound design',
  'no electronic ambience',
]

const AUDIO_RULE_TEXT = 'natural diegetic scene sounds only; no music, no voice, no soundtrack'
const AUDIO_BAN_TEXT = 'No speech, no voiceover, no human vocals, no dialogue, no narration, no singing, no background music, no soundtrack, no cinematic score, no drums, no melody, no artificial sound design, no electronic ambience.'

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function asText(value = '') {
  return String(value || '').trim()
}

function compactText(...values) {
  return values.map(asText).filter(Boolean).join(' ').trim()
}

function includesAny(text = '', words = []) {
  const haystack = asText(text).toLowerCase()
  return words.some((word) => haystack.includes(String(word || '').toLowerCase()))
}

function hasAudioBan(text = '') {
  const lower = asText(text).toLowerCase()
  return AUDIO_BAN_PHRASES.every((phrase) => lower.includes(phrase))
}

export function ensureCookingAudioBan(text = '') {
  const base = asText(text)
  if (hasAudioBan(base)) return base
  if (!base) return AUDIO_BAN_TEXT
  return `${base}${/[.!?]$/.test(base) ? '' : '.'} ${AUDIO_BAN_TEXT}`.trim()
}

export function buildCookingPromptMemoryV1() {
  return {
    schema: 'ava_cooking_prompt_memory_v1',
    purpose: 'Reusable prompt rules/templates for silent outdoor cooking i2v + natural sound scenes.',
    locked_rules: {
      format: 'silent visual-only outdoor cooking; no lip-sync, no voiceover, no dialogue',
      route_default: 'i2v_sound',
      video_principle: 'Animate only visible objects from the still. Preserve composition, cookware, ingredients, table, fire, lake, and natural background.',
      sound_principle: 'Sound is written directly inside the i2v positive prompt and also duplicated in mmaudio_prompt. Use only diegetic natural scene sounds.',
      absolute_audio_ban: [...AUDIO_BAN_PHRASES],
      physical_logic: [
        'Do not invent actions that are not visible in the still.',
        'If there is no knife, do not add cutting sound or cutting action.',
        'If there is no pan or hot food, do not make frying the main sound.',
        'If there is no fire, do not make campfire crackle the main sound.',
        'If it is a nature-only shot, use lake, wind, grass, birds only.',
        'If hands are cutting, use knife taps, chopping, board contact, ingredient movement.',
        'If food is frying, use oil sizzling, gentle crackle, steam hiss, fire underneath.',
        'If serving or final dish, use soft plate/wood/cloth contact and quiet nature ambience.',
        'No new ingredients, no new cookware, no extra hands, no people added.',
        'No object morphing, no scene cut, no camera shake, no fast zoom.',
      ],
    },
    proven_prompts: {
      working_mmaudio_frying_prompt: 'Generate only realistic natural scene audio for this outdoor cooking shot. Close detailed frying sounds from the pan: hot oil sizzling, light crackling, gentle food frying, subtle steam hiss. Add soft campfire sounds underneath: quiet fire crackle and tiny wood ember pops. Add light environmental ambience in the background: gentle lake waves, soft breeze, distant birds, occasional faint seagull-like calls if appropriate for a lakeside environment. The frying sound should remain the main focus, with fire and nature ambience secondary and quieter. No speech, no voiceover, no human vocals, no background music, no soundtrack, no cinematic score, no drums, no melody, no artificial sound design.',
      working_i2v_video_negative_frying: 'do not change the food, do not add new objects, do not add people, no extra hands, no deformed pan, no melting pan, no food morphing, no camera shake, no fast zoom, no scene cut, no text, no logo, no watermark, no distorted background, no unrealistic fire, no burned food',
    },
    templates: {
      frying_scene_positive_i2v_sound: 'Photorealistic cinematic outdoor cooking shot by a quiet lake. Keep the same composition, same cast iron pan, same food pieces, same stones, fire, lake and forest background. Subtle natural motion only: hot oil bubbling and sizzling around the food, gentle steam rising from the pan, small fire flames flickering under the pan, faint smoke drifting upward, soft sunlight shimmer on the lake water, light wind moving grass in the background. Very slow handheld camera push-in toward the frying pan, shallow depth of field, warm natural evening light, appetizing food texture, documentary outdoor cooking style. Preserve all objects and layout, no new ingredients, no scene change. Natural scene audio inside this shot: close detailed frying sounds from the pan, hot oil sizzling, light crackling, gentle food frying, subtle steam hiss. Add soft campfire sounds underneath: quiet fire crackle and tiny wood ember pops. Add light environmental ambience in the background: gentle lake waves, soft breeze, distant birds. Frying sound is the main focus, fire and nature ambience are secondary and quieter. Use only diegetic natural sound from the scene.',
      cutting_prep_positive_i2v_sound: 'Photorealistic outdoor cooking prep shot by a quiet lakeside. Preserve the exact composition, same hands, same wooden cutting board, same knife, same visible ingredients, same table and natural lake environment. Subtle realistic motion only: hands carefully cut the visible ingredients, small pieces move naturally on the board, the knife makes controlled short cuts, herbs or vegetables shift slightly, light wind moves nearby grass, soft daylight remains stable. Slow minimal camera drift, documentary food preparation style, no scene change, no new objects. Natural scene audio inside this shot: close realistic knife sounds on a wooden cutting board, soft chopping taps, gentle ingredient movement, light hand movement, subtle cloth or wood contact. Background ambience: quiet lake waves, soft breeze, distant birds. Cutting sounds are the main focus, nature ambience is secondary and quieter. Use only natural diegetic sounds.',
      nature_broll_positive_i2v_sound: 'Photorealistic cinematic lakeside nature shot. Preserve the exact landscape, shoreline, grass, water, trees, light and atmosphere from the still. Subtle natural motion only: gentle lake water movement, soft wind moving grass and leaves, faint smoke or warm air drift if visible, sunlight shimmer on the water. Very slow calm camera drift, peaceful documentary nature style, no scene change, no new objects, no people added. Natural scene audio inside this shot: gentle lake waves, soft breeze through grass and leaves, distant birds, occasional faint natural lake ambience. Nature ambience only, quiet and realistic.',
      serving_final_positive_i2v_sound: 'Photorealistic outdoor cooking serving shot by a quiet lake. Preserve the exact final dish, same table, same cookware or plate, same rustic props, same lake background and natural light. Subtle realistic motion only: a hand gently places or adjusts the visible dish or garnish if hands are visible, steam rises softly if the food is hot, light wind moves grass or cloth, lake water shimmers in the background. Slow minimal camera push-in, appetizing documentary food style, no scene change, no new ingredients. Natural scene audio inside this shot: soft plate or wooden board contact, gentle serving sounds, subtle steam hiss if visible, quiet cloth movement if visible. Background ambience: gentle lake waves, soft breeze, distant birds. No active frying unless frying is still visible in the still.',
      universal_negative_i2v_sound: 'Do not change the food, do not add new objects, do not add people, no extra hands, no deformed hands, no deformed cookware, no melting pan, no food morphing, no camera shake, no fast zoom, no hard cut, no scene cut, no text, no logo, no watermark, no distorted background, no unrealistic fire, no burned food. No speech, no voiceover, no human vocals, no dialogue, no narration, no singing, no background music, no soundtrack, no cinematic score, no drums, no melody, no artificial sound design, no electronic ambience.',
    },
    scene_sound_role_map: {
      nature: 'lake waves, breeze, grass/leaves, distant birds only',
      setup_props: 'soft wood/table contact, small cookware movement, nature ambience',
      raw_ingredients: 'soft ingredient handling, wooden board/table contact, quiet nature ambience',
      cutting: 'knife taps on wooden board, ingredient movement, subtle hand/cloth/wood contact, quiet nature ambience',
      fire_heat: 'fire crackle, ember pops, faint smoke, distant lake/wind, no frying unless food is in pan',
      frying: 'oil sizzling and bubbling as main sound, gentle food frying, steam hiss, fire crackle underneath, quiet lake/wind/birds',
      serving: 'plate/wood contact, soft serving movement, cloth movement if visible, quiet nature ambience',
      final_dish: 'quiet final ambience, soft table/plate contact, lake/wind/birds; no active frying unless visible',
    },
  }
}

export function buildCookingPromptWorkflowNotesV1(existingNotes = {}) {
  return {
    ...(existingNotes && typeof existingNotes === 'object' ? existingNotes : {}),
    prompt_memory_embedded: true,
    prompt_memory_schema: 'ava_cooking_prompt_memory_v1',
    prompt_memory_preset: COOKING_PROMPT_MEMORY_PRESET_ID,
    prompt_memory_summary: 'Reusable prompt templates for silent outdoor cooking i2v_sound: frying, cutting/prep, nature b-roll, serving/final dish, with strict no music/no voice audio rules.',
    working_audio_rule: 'Use only diegetic natural sounds: frying, oil, steam, fire, cutting on wood, plate/wood contact, lake waves, wind, birds. Absolutely no music, soundtrack, score, drums, melody, speech, voiceover, or vocals.',
  }
}

function sceneLooksLikeCookingSound(scene = {}) {
  const text = compactText(
    scene.route,
    scene.planned_route,
    scene.sound_role,
    scene.visual_action,
    scene.viewer_should_understand,
    scene.video_motion_prompt,
    scene.mmaudio_prompt,
    scene.positive_prompt,
    scene.prompt_positive,
    scene.notes,
    scene.note,
    scene.title,
  )
  return includesAny(text, [
    'i2v_sound', 'cooking', 'outdoor cooking', 'frying', 'sizzling', 'pan', 'fire', 'campfire',
    'knife', 'cutting', 'chopping', 'wooden board', 'lake', 'lakeside', 'ingredients', 'serving',
    'готов', 'готовка', 'жарк', 'сковород', 'огонь', 'кост', 'нож', 'нарез', 'доск', 'озер', 'ингредиент',
  ])
}

export function shouldEmbedCookingPromptMemory(boardData = {}, options = {}) {
  if (options?.force) return true
  const board = boardData?.board || boardData || {}
  if (board?.cooking_prompt_memory_v1) return true
  const preset = asText(board?.prompt_memory_preset || board?.workflow_notes?.prompt_memory_preset || options?.promptMemoryPreset)
  if (preset === COOKING_PROMPT_MEMORY_PRESET_ID) return true
  const mode = asText(board?.project_mode || board?.projectMode || board?.project_mode_id || board?.projectModeId || options?.projectModeId)
  if (mode === 'recipe_process_v1' || mode === COOKING_PROMPT_MEMORY_PRESET_ID) return true
  const boardText = compactText(board?.notes, board?.workflow_notes?.prompt_memory_summary, board?.source, board?.importedFrom)
  if (includesAny(boardText, ['outdoor cooking', 'silent cooking', 'lakeside cooking', 'озеро', 'готовка'])) return true
  return asArray(board?.scenes).some((scene) => {
    const hasSoundLayer = scene?.sound_design_needed === true || asText(scene?.route) === 'i2v_sound' || Boolean(asText(scene?.mmaudio_prompt))
    return hasSoundLayer && sceneLooksLikeCookingSound(scene)
  })
}

function addCookingScenePromptMemory(scene = {}) {
  const next = {
    ...(scene || {}),
    prompt_memory_ref: scene?.prompt_memory_ref || 'cooking_prompt_memory_v1',
    audio_rule: scene?.audio_rule || AUDIO_RULE_TEXT,
  }

  const shouldStrengthenNegative = (
    next.sound_design_needed === true ||
    asText(next.route) === 'i2v_sound' ||
    Boolean(asText(next.mmaudio_prompt)) ||
    sceneLooksLikeCookingSound(next)
  )

  if (shouldStrengthenNegative) {
    next.negative_prompt = ensureCookingAudioBan(next.negative_prompt)
    next.prompt_negative = ensureCookingAudioBan(next.prompt_negative || next.negative_prompt)
    next.video_motion_negative = ensureCookingAudioBan(next.video_motion_negative || next.negative_prompt)
    next.mmaudio_negative_prompt = ensureCookingAudioBan(next.mmaudio_negative_prompt)
  }

  return next
}

export function applyCookingPromptMemoryToBoard(boardData = {}, options = {}) {
  const board = boardData?.board || boardData || {}
  if (!board || typeof board !== 'object') return boardData
  if (!shouldEmbedCookingPromptMemory(board, options)) return boardData

  const next = {
    ...board,
    prompt_memory_preset: board.prompt_memory_preset || COOKING_PROMPT_MEMORY_PRESET_ID,
    cooking_prompt_memory_v1: board.cooking_prompt_memory_v1 || buildCookingPromptMemoryV1(),
    workflow_notes: buildCookingPromptWorkflowNotesV1(board.workflow_notes),
    scenes: asArray(board.scenes).map(addCookingScenePromptMemory),
  }

  const notes = asText(next.notes)
  const marker = 'PROMPT MEMORY / COOKING RULES:'
  if (!notes.includes(marker)) {
    next.notes = `${notes}${notes ? '\n\n' : ''}${marker}\n- Silent visual-only outdoor cooking: no lip-sync, no speech, no voiceover.\n- Sound is written inside i2v prompts and also duplicated in mmaudio_prompt.\n- Use only natural diegetic sounds: frying/oil/steam/fire/cutting/wood/plate/lake/wind/birds.\n- Absolutely no music, soundtrack, cinematic score, drums, melody, vocals, narration, dialogue.\n- Animate only what is visible in the still. If no knife: no cutting. If no pan: no frying. If no fire: no fire crackle as main sound. If nature-only: lake/wind/birds only.`
  }

  if (boardData?.board && boardData !== board) {
    return {
      ...boardData,
      board: next,
    }
  }
  return next
}
