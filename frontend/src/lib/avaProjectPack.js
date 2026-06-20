// AVA_CODEX_OUTPUT_MIRROR_V78: mirror Codex root scene prompt/still fields into production.scenes for Board import.
// AVA_PROJECT_PACK_PATCH_SCOPE_POLICY_V18: task_scope/update_policy/project_state_summary patch-only contract.
// AVA_FINAL_PROMPT_SANITIZER_IMAGE_AWARE_V17: final generation prompt fields and sanitizer validation.
// AVA_PROJECT_PACK_IMAGE_AWARE_PASS_V16: image-aware video prompt pass workflow/readiness/per-scene fields.
// AVA_PROJECT_PACK_NORMALIZED_SCENES_V15
// Unified Project Pack exporter: one normalized scene split is mirrored into root scenes[], timing.scenes[], and production.scenes[].
import { buildCodexTaskForMode, buildModeContract, normalizeProjectMode, projectModeCatalogForPack, projectTypeForMode } from './projectModes.js'

import { buildCookingPromptMemoryV1, buildCookingPromptWorkflowNotesV1, shouldEmbedCookingPromptMemory } from './cookingPromptMemory.js'
const PROMPT_POSITIVE_KEYS = ['photo_prompt_positive', 'video_motion_prompt']
const PROMPT_NEGATIVE_KEYS = ['photo_prompt_negative', 'video_motion_negative', 'negative_prompt', 'prompt_negative']
const IMAGE_AWARE_VIDEO_PROMPT_FIELDS_TO_UPDATE = [
  'video_motion_prompt',
  'video_motion_negative',
  'positive_prompt',
  'negative_prompt',
  'video_prompt',
  'prompt_positive',
  'prompt_negative',
  'lipsync_motion_prompt',
]


// AVA_PROJECT_PACK_UNIVERSAL_TASK_CONTRACT_V75
const AVA_UNIVERSAL_TASK_PIPELINE_V75 = [
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

function buildUniversalTaskContractV75(projectMode = {}) {
  return {
    version: 'ava_universal_task_contract_v1',
    mode_id: projectMode.id || 'manual_general_v1',
    rule: 'This JSON is an instruction/contract for the selected project mode, not a place to store every possible mode.',
    selected_mode_only: true,
    worker_flow: AVA_UNIVERSAL_TASK_PIPELINE_V75,
    user_folder_inputs: [
      'audio file / audio asset',
      'timing JSON / ava_project_pack_v1',
      'user task / description',
      'visual cards: character, location, product, ingredient, prop, source-video frames depending on selected mode',
      'generated stills when moving to image review/video prompts',
      'board JSON snapshot when patching an existing board',
    ],
    ask_questions_if: [
      'required cards are missing',
      'story/world/task is too vague',
      'route/lip-sync expectations are unclear',
      'still images are missing but final video prompts are requested',
      'source video is required by selected mode but missing',
    ],
  }
}

function buildStillFirstWorkflowV75(projectMode = {}) {
  return {
    required: true,
    rule: 'First create/review still images. Only after selected stills exist, write image-aware video prompts.',
    selected_mode_id: projectMode.id || 'manual_general_v1',
    stages: [
      'still_plan_patch',
      'photo_prompt_patch',
      'generated_stills_manifest',
      'image_review_patch',
      'board_import_patch_with_final_video_prompts',
    ],
    do_not_change_during_still_pass: ['scene_id', 'start', 'end', 'duration', 'route', 'scene order'],
  }
}

function buildBoardSnapshotContractV75() {
  return {
    version: 'ava_board_snapshot_contract_v1',
    role: 'Board JSON is a full production snapshot and repair file. It should keep all fields so existing media and manual work are not lost.',
    use_cases: [
      'patch translations/meaning after Board work already started',
      'patch prompts after some scenes are generated',
      'add or edit MMAudio/sound prompts',
      'restore Board state',
      'import safe changes by scene_id without rebuilding timing',
    ],
    full_snapshot_import: {
      purpose: 'restore full Board state',
      warning: 'may replace current Board snapshot',
    },
    safe_patch_import: {
      match_by: 'scene_id',
      can_update: [
        'text/translation/meaning fields',
        'photo/video/negative/lipsync prompts',
        'MMAudio and sound prompts',
        'story block labels/colors if needed',
      ],
      must_not_touch: [
        'scene_id',
        'start/end/duration',
        'route unless explicitly requested',
        'generated media urls/assets',
        'job ids/status/queue',
        'audio source and audio slice boundaries unless explicitly requested',
      ],
    },
  }
}

function buildImageReviewContractV75() {
  return {
    version: 'ava_image_review_contract_v1',
    rule: 'Every still candidate must be approved or rejected before final video prompts are treated as ready.',
    per_candidate_fields: [
      'scene_id',
      'candidate_id',
      'approved',
      'reject_reason',
      'visible_content_summary',
      'card_match_check',
      'continuity_check',
      'must_show_check',
      'must_not_show_check',
      'safe_motion_notes',
    ],
    reject_if: [
      'wrong identity/card',
      'wrong location/world',
      'missing required object/action',
      'extra duplicate props or impossible objects',
      'future step appears too early',
      'unsafe for requested route/motion',
    ],
  }
}


const IMAGE_AWARE_WORKFLOW_STAGES = [
  'scene_split',
  'storyboard_prompts',
  'stills_generation_or_import',
  'image_aware_video_prompt_pass',
  'video_generation',
]


// AVA_CODEX_OUTPUT_MIRROR_FIELDS_V78
// These fields may be created by Codex either in root scenes[] or production.scenes[].
// Mirror them both ways so Board import sees the same data whichever array it reads.
const AVA_CODEX_OUTPUT_MIRROR_FIELDS_V78 = [
  'photo_prompt_positive',
  'photo_prompt_negative',
  'approved_still_path',
  'approved_still_url',
  'approved_still_filename',
  'approved_still_notes',
  'approved_still_review',
  'visible_content_summary',
  'safe_motion_plan',
  'unsafe_motion_avoid',
  'video_motion_prompt',
  'video_motion_negative',
  'positive_prompt',
  'negative_prompt',
  'video_prompt',
  'prompt_positive',
  'prompt_negative',
  'final_video_prompt',
  'final_negative_prompt',
  'final_lipsync_prompt',
  'final_prompt_ready',
  'prompt_validation',
  'lipsync_motion_prompt',
  'lipsync_photo_rules',
  'speaking_frame_confirmed',
  'camera_framing',
  'continuity_notes',
  'props_required',
  'ingredients_required',
  'location_required',
  'character_required',
  'review_status',
  'image_aware_prompt_status',
  'image_aware_video_prompt_updated',
  'image_aware_prompt_notes',
  'sound_design_needed',
  'sound_role',
  'mmaudio_prompt',
  'mmaudio_negative_prompt',
  'scene_ambience_prompt',
  'foley_prompt',
  'sound_notes',
]

function avaCodexMirrorValuePresentV78(value) {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return true
}

function avaCodexMirrorSceneFieldsV78(scene = {}) {
  const out = {}
  AVA_CODEX_OUTPUT_MIRROR_FIELDS_V78.forEach((field) => {
    const value = scene[field]
    if (avaCodexMirrorValuePresentV78(value)) out[field] = value
  })
  return out
}

const SOUND_FIELDS_TO_FILL = [
  'sound_design_needed',
  'sound_role',
  'mmaudio_prompt',
  'mmaudio_negative_prompt',
  'scene_ambience_prompt',
  'foley_prompt',
  'sound_notes',
]
const PRODUCTION_FIELDS_TO_FILL = [
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
  'approved_still_path',
  'approved_still_url',
  'approved_still_filename',
  'approved_still_notes',
  'visible_content_summary',
  'safe_motion_plan',
  'image_aware_prompt_status',
  'image_aware_video_prompt_updated',
  'final_video_prompt',
  'final_negative_prompt',
  'final_lipsync_prompt',
  'final_prompt_ready',
  'speaking_frame_confirmed',
  ...SOUND_FIELDS_TO_FILL,
]

const HEX_PALETTE = [
  '#B100FF',
  '#00B7FF',
  '#FF7A00',
  '#38D973',
  '#FF4FB8',
  '#7C5CFF',
  '#00D1B2',
  '#FFC24B',
  '#FF5A5F',
  '#5EC8FF',
  '#A3E635',
  '#F472B6',
  '#F59E0B',
  '#22D3EE',
  '#C084FC',
  '#34D399',
]


const AVA_PATCH_SCOPE_ALLOWED_UPDATES_V18 = [
  'final_video_prompt',
  'final_negative_prompt',
  'final_lipsync_prompt',
  'video_motion_prompt',
  'video_motion_negative',
  'positive_prompt',
  'negative_prompt',
  'video_prompt',
  'prompt_positive',
  'prompt_negative',
  'lipsync_motion_prompt',
  'visible_content_summary',
  'safe_motion_plan',
  'unsafe_motion_avoid',
  'image_aware_prompt_status',
  'image_aware_video_prompt_updated',
  'final_prompt_ready',
  'prompt_validation',
]

const AVA_PATCH_SCOPE_LOCKED_FIELDS_V18 = [
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
  'audio',
  'audio_slice',
  'actual_still_image',
  'video_result',
  'mmaudio_result',
  'blockId',
  'blockTitle',
  'color',
  'storyBlocks',
  'story_blocks',
  'scene_block_map',
]

function sceneHasVideoResultV18(scene = {}) {
  return Boolean(firstText(
    scene.video_asset_id,
    scene.videoAssetId,
    scene.video_api_path,
    scene.videoApiPath,
    scene.video_url,
    scene.videoUrl,
    scene.resultVideoUrl,
    scene.result_video_url,
    scene.result_video_api_path,
    scene.resultVideoApiPath,
    scene.video_result?.video_url,
    scene.videoResult?.videoUrl
  ))
}

function sceneHasMmaudioResultV18(scene = {}) {
  return Boolean(firstText(
    scene.mmaudio_asset_id,
    scene.mmaudioAssetId,
    scene.mmaudio_api_path,
    scene.mmaudioApiPath,
    scene.mmaudio_url,
    scene.mmaudioUrl,
    scene.mmaudio_video_asset_id,
    scene.mmaudioVideoAssetId,
    scene.mmaudio_video_api_path,
    scene.mmaudioVideoApiPath,
    scene.mmaudio_video_url,
    scene.mmaudioVideoUrl,
    scene.mmaudio_result?.url,
    scene.mmaudioResult?.url
  ))
}

function sceneHasAudioSliceV18(scene = {}) {
  return Boolean(firstText(
    scene.audio_slice_asset_id,
    scene.audioSliceAssetId,
    scene.audio_slice_api_path,
    scene.audioSliceApiPath,
    scene.audio_slice_url,
    scene.audioSliceUrl,
    scene.audio_slice_name,
    scene.audioSliceName
  ))
}

function sceneMediaStatusV18(scene = {}) {
  return {
    still: hasStill(scene) ? 'ready' : 'missing',
    video: sceneHasVideoResultV18(scene) ? 'done' : (firstText(scene.video_error, scene.videoError) ? 'failed' : 'missing'),
    mmaudio: sceneHasMmaudioResultV18(scene) ? 'done' : (firstText(scene.mmaudio_error, scene.mmaudioError) ? 'failed' : 'missing'),
    audio_slice: sceneHasAudioSliceV18(scene) ? 'ready' : 'missing',
  }
}

function scenePromptStatusV18(scene = {}) {
  const draftReady = hasRealPrompt(scene) ? 'ready' : 'missing'
  const imageAware = imageAwarePromptUpdated(scene)
    ? 'updated'
    : (hasStill(scene) ? 'needs_review' : 'needs_still')
  const finalReady = scene.final_prompt_ready === true || scene.prompt_validation?.final_prompt_ready === true
    ? 'ready'
    : (hasStill(scene) ? 'not_ready' : 'needs_still')
  return {
    draft_prompt: draftReady,
    image_aware_prompt: imageAware,
    final_prompt: finalReady,
  }
}

function sceneAllowedNextActionV18(scene = {}) {
  const media = sceneMediaStatusV18(scene)
  const prompt = scenePromptStatusV18(scene)
  if (media.mmaudio === 'done') return 'do_not_regenerate_mmaudio_unless_user_requests'
  if (media.video === 'done') return 'do_not_touch_video_unless_user_requests'
  if (prompt.final_prompt !== 'ready') return 'update_final_video_prompt_only'
  if (media.still !== 'ready') return 'import_or_generate_still'
  return 'ready_for_video_generation'
}

function sceneProtectedExistingOutputsV18(scene = {}) {
  const media = sceneMediaStatusV18(scene)
  return {
    still: media.still === 'ready',
    video: media.video === 'done',
    mmaudio: media.mmaudio === 'done',
  }
}

function buildTaskScopeV18(readiness = {}, currentGoal = '') {
  return {
    mode: 'patch_missing_only',
    current_goal: currentGoal || readiness.current_blocker || readiness.next_action || 'image_aware_video_prompt_pass',
    do_not_rebuild_project: true,
    do_not_overwrite_existing_media: true,
    do_not_change_timing: true,
    do_not_change_scene_ids: true,
    do_not_change_routes: true,
    do_not_change_audio: true,
    do_not_change_existing_videos: true,
    do_not_change_existing_mmaudio: true,
    preserve_user_edits: true,
    allowed_updates: AVA_PATCH_SCOPE_ALLOWED_UPDATES_V18,
    locked_fields: AVA_PATCH_SCOPE_LOCKED_FIELDS_V18,
  }
}

function buildUpdatePolicyV18() {
  return {
    default_mode: 'patch_missing_only',
    overwrite_existing_media: false,
    overwrite_existing_videos: false,
    overwrite_existing_audio: false,
    overwrite_existing_mmaudio: false,
    overwrite_existing_prompts: 'only_if_status_needs_review_or_not_ready',
    preserve_user_edits: true,
    preserve_generated_results: true,
    allow_full_rebuild: false,
    requires_explicit_user_permission_for: [
      'changing timing',
      'changing scene ids',
      'changing routes',
      'deleting media',
      'replacing videos',
      'replacing mmaudio',
      'regenerating stills',
    ],
  }
}

function buildProjectStateSummaryV18({ audio = null, normalizedScenes = [], productionScenes = [], readiness = {} } = {}) {
  const audioReady = Boolean(audio && Number(audio.duration_sec || audio.durationSec || 0) > 0)
  const sceneSplitReady = normalizedScenes.length > 0
  const storyboardReady = productionScenes.some((scene) => hasRealPrompt(scene) || scene.viewer_should_understand || scene.recipe_step || scene.visual_action)
  const stillsReady = productionScenes.some((scene) => scene.has_still === true || sceneMediaStatusV18(scene).still === 'ready')
  const videoDoneCount = productionScenes.filter((scene) => sceneMediaStatusV18(scene).video === 'done').length
  const mmaudioDoneCount = productionScenes.filter((scene) => sceneMediaStatusV18(scene).mmaudio === 'done').length
  const imageAwareReady = readiness.image_aware_video_prompts_ready === true
  return {
    audio_ready: audioReady,
    scene_split_ready: sceneSplitReady,
    storyboard_ready: storyboardReady,
    stills_ready: stillsReady,
    image_aware_video_prompts_ready: imageAwareReady,
    video_generation_started: videoDoneCount > 0,
    video_generation_partial: videoDoneCount > 0 && videoDoneCount < productionScenes.length,
    mmaudio_generation_partial: mmaudioDoneCount > 0 && mmaudioDoneCount < productionScenes.length,
    next_recommended_action: imageAwareReady
      ? 'Video generation can continue. Do not change timing, media or existing results.'
      : 'Run image-aware video prompt pass only for scenes whose final prompts are not ready or need review.',
    do_not_restart_from: ['audio', 'asr', 'scene_split', 'storyboard', 'stills_generation'],
  }
}

function buildAssistantInstructionsV18() {
  return {
    for_chatgpt: [
      'Read task_scope and update_policy before making changes.',
      'Do not rebuild the project unless explicitly requested.',
      'Patch only fields listed in allowed_updates.',
      'Never change locked_fields.',
      'If final prompts are dirty, rewrite only final prompt fields.',
      'If media already exists, do not overwrite it.',
      'When the task is Video Match, create video_match_board_v2 with sourceVideos/V1 contract for direct Video Match Board import.',
      'For Video Match, source video path alone is not enough: candidates must reference sourceVideoId/source_video_id and the UI must bind the real file to V1 before assembly.',
    ],
    for_codex: [
      'Treat this JSON as a project state patch request, not a full generation request.',
      'Do not recalculate timing.',
      'Do not rename scene_id.',
      'Do not change route.',
      'Do not overwrite images, videos, audio slices, or MMAudio unless replace_existing=true.',
      'Only update fields allowed by task_scope.allowed_updates.',
      'Return a patched JSON with the same scene count and same scene ids.',
      'If producing Video Match output, return video_match_board_v2, not ava_project_pack_v1, and include sourceVideos plus sourceVideoId/source_video_id = V1 on every candidate.',
    ],
    output_requirements: [
      'Return patched ava_project_pack_v1 JSON.',
      'For Video Match direct import, also return video_match_board_v2.json with stable V1 source binding.',
      'Include a patch_report describing what fields were changed.',
      'Include validation_report.',
      'Do not create a new project id.',
      'Do not create new scene ids.',
    ],
  }
}


function buildVideoMatchBoardV2SourceBindingContractV81() {
  return {
    schema: 'video_match_board_v2_source_binding_contract_v81',
    purpose: 'Prevent Video Match import/assembly errors by requiring stable source video IDs and backend file binding.',
    import_schema_for_video_match_board: 'video_match_board_v2',
    do_not_import_as: ['ava_project_pack_v1'],
    stable_source_video_id: 'V1',
    required_root_fields: [
      'schema: video_match_board_v2',
      'sourceVideos[] with id/sourceVideoId/source_video_id = V1',
      'segments[] with target_t0/target_t1 and selected_candidate_id',
      'segments[].candidates[] with sourceVideoId/source_video_id = V1',
      'segments[].candidates[].sourceVideoStartSec/sourceVideoEndSec',
    ],
    required_candidate_fields: [
      'sourceVideoId',
      'source_video_id',
      'sourceVideoStartSec',
      'sourceVideoEndSec',
      'sourceVideoDurationSec',
      'confidence',
      'match_reason or selected_reason',
    ],
    required_scene_selected_fields: [
      'selectedCandidateId or selected_candidate_id',
      'selectedSourceVideoId: V1',
      'selectedSourceStartSec',
      'selectedSourceEndSec',
      'target_t0',
      'target_t1',
      'duration',
    ],
    ui_rule_after_import: 'After importing the JSON, bind/upload the real source video file to V1 in the UI once before MP4 assembly.',
    backend_rule: 'The browser preview may use blob URLs, but MP4 assembly requires a backend-uploaded file path/asset. If V1 is not bound, assembly can fail with source_video_not_found.',
    codex_rule: 'Codex must return a video_match_board_v2 file for Video Match Board, plus manifests, not only ava_project_pack_v1.',
    source_selection_rule: 'Use the episode as a visual bank; do not cut equal grid segments; select source ranges by phrase endings, beat strength, main hero visibility, fights, pressure and emotional intensity.',
  };
}

function buildPatchReportTemplateV18() {
  return {
    mode: 'patch_missing_only',
    updated_fields: [],
    unchanged_locked_fields: ['scene_id', 'timing', 'route', 'audio', 'media'],
    scenes_updated: [],
    scenes_skipped: [],
    warnings: [],
    validation_passed: false,
  }
}


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

function round3(value = 0) {
  return Number((Number(value || 0)).toFixed(3))
}

function sceneIdOf(scene = {}, index = 0) {
  return firstText(scene.id, scene.scene_id, scene.sceneId) || `seg_${String(index + 1).padStart(2, '0')}`
}

function normalizeHexColor(value = '', fallbackIndex = 0) {
  const raw = String(value || '').trim()
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toUpperCase()
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw.slice(1).split('').map((ch) => ch + ch).join('')}`.toUpperCase()
  }

  const numeric = Number(raw)
  if (Number.isFinite(numeric)) {
    return HEX_PALETTE[Math.abs(Math.floor(numeric)) % HEX_PALETTE.length]
  }

  if (/^hsl/i.test(raw) || /^rgb/i.test(raw)) return HEX_PALETTE[Math.abs(fallbackIndex) % HEX_PALETTE.length]
  return HEX_PALETTE[Math.abs(fallbackIndex) % HEX_PALETTE.length]
}

function isIa2vRoute(route = '') {
  const value = String(route || '').toLowerCase()
  return value === 'ia2v' || value.includes('lip') || value.includes('ia2v')
}

function sceneRoute(scene = {}, modeId = 'manual_general_v1', index = 0, total = 0) {
  if (modeId === 'recipe_process_v1' && total > 1) {
    if (index === 0 || index === total - 1) return 'ia2v'
    return 'i2v'
  }
  return firstText(scene.route, scene.planned_route, scene.plannedRoute, scene.mode, scene.generation_route, scene.renderMode) || 'i2v'
}


// AVA_PROJECT_FORMAT_CONTRACT_V177A:
// Format is locked from project_context/project and must be visible to Codex, Board and generation.
function buildSceneRouteContractV177A(route = 'i2v') {
  const selected = firstText(route, 'i2v') || 'i2v'
  const lower = String(selected || '').toLowerCase()
  const audioDriven = lower === 'ia2v' || lower.includes('lip') || lower.includes('sound')
  const instrumentDriven = lower.includes('instrument') || lower.includes('guitar') || lower.includes('drum')
  const modelFamily = lower.includes('first_last') ? 'first_last' : (audioDriven ? 'ia2v' : 'i2v')
  return {
    selected,
    board_route: selected,
    model: selected,
    model_family: modelFamily,
    needs_audio_slice: Boolean(audioDriven),
    needs_face_visible: Boolean(audioDriven && !instrumentDriven),
    needs_instrument_visible: Boolean(instrumentDriven),
    still_requirements: instrumentDriven
      ? ['visible instrument', 'visible hands', 'performance pose', 'safe motion potential']
      : audioDriven
        ? ['clear face', 'visible mouth', 'stable identity', 'safe lip-sync framing']
        : ['clear readable action', 'safe motion potential', 'stable subject/layout'],
    codex_rule: instrumentDriven
      ? 'For instrument lip-sync scenes, storyboard stills must show instrument, hands and performance pose.'
      : audioDriven
        ? 'For lip-sync scenes, storyboard stills must show clear face and visible mouth.'
        : 'For i2v scenes, storyboard stills should be readable b-roll/action with safe motion.',
  }
}

function sceneTextLooksLabelOnlyV177A(scene = {}) {
  const text = firstText(scene.original_text, scene.scene_word_text, scene.lyrics_text, scene.text, scene.translated_text_ru)
  const label = firstText(scene.speakerLabel, scene.speaker_label, scene.roleLabel, scene.role_label, scene.blockTitle, scene.block_title)
  const normalized = String(text || '').trim().toLowerCase()
  if (!normalized) return true
  if (label && normalized === String(label).trim().toLowerCase()) return true
  return ['диктор', 'дед', 'ведущий', 'narrator', 'host', 'speaker', 'voice'].includes(normalized)
}

function buildSceneTextContractV177A(scene = {}) {
  const speaker = firstText(scene.speakerLabel, scene.speaker_label, scene.roleLabel, scene.role_label, scene.blockTitle, scene.block_title)
  const original = firstText(scene.original_text, scene.originalText, scene.scene_word_text, scene.lyrics_text, scene.text)
  const translation = firstText(scene.translated_text_ru, scene.translation_ru, scene.translation, scene.ruText, original)
  const meaning = firstText(scene.meaning_hint_ru, scene.meaningText, scene.meaning_ru, scene.meaning)
  const labelOnly = sceneTextLooksLabelOnlyV177A({ ...scene, original_text: original, translated_text_ru: translation })
  return {
    asr_original: original,
    asr_ru: firstText(scene.asr_ru, translation, original),
    translation_ru: translation,
    meaning_ru: meaning,
    lyrics_or_dialogue: firstText(scene.lyrics_text, original),
    speaker_label: speaker,
    status: labelOnly ? 'label_only' : 'text_ready',
    needs_asr_or_manual_text: Boolean(labelOnly),
  }
}

function buildSceneSourceContractV177A(scene = {}, start = 0, end = 0) {
  const existing = asObject(scene.scene_source || scene.sceneSource)
  const kind = firstText(existing.kind, scene.source_kind, scene.composer_source_kind, scene.is_silence ? 'silence' : '', scene.composer_block_type === 'phrase' ? 'inserted_audio' : '', 'main_audio')
  return {
    ...existing,
    kind,
    is_main_audio: kind === 'main_audio',
    is_inserted_audio: kind === 'inserted_audio',
    is_silence: kind === 'silence',
    composer_block_id: firstText(existing.composer_block_id, scene.composer_block_id, scene.blockId, scene.block_id),
    composer_block_type: firstText(existing.composer_block_type, scene.composer_block_type),
    source_audio_id: firstText(existing.source_audio_id, scene.composer_source_audio_id, scene.source_audio_id, 'main'),
    source_audio_name: firstText(existing.source_audio_name, scene.composer_source_audio_name, scene.source_audio_name),
    saved_clip_id: firstText(existing.saved_clip_id, scene.saved_clip_id, scene.composer_saved_clip_id),
    saved_clip_label: firstText(existing.saved_clip_label, scene.saved_clip_label, scene.composer_saved_clip_label),
    final_audio_start_sec: Number(existing.final_audio_start_sec ?? scene.final_audio_start_sec ?? start),
    final_audio_end_sec: Number(existing.final_audio_end_sec ?? scene.final_audio_end_sec ?? end),
  }
}

function buildSceneRequirementsContractV177A(scene = {}, routeContract = {}) {
  return {
    needs_photo_prompt: true,
    needs_video_prompt: true,
    needs_lipsync: Boolean(routeContract.needs_face_visible || String(routeContract.selected || '').toLowerCase().includes('lip')),
    needs_instrument_lipsync: Boolean(routeContract.needs_instrument_visible),
    needs_audio_slice: Boolean(routeContract.needs_audio_slice),
    needs_translation: false,
    needs_meaning: false,
    needs_character_card: Boolean(routeContract.needs_face_visible),
    needs_instrument_card: Boolean(routeContract.needs_instrument_visible),
    ...(asObject(scene.scene_requirements || scene.sceneRequirements)),
  }
}

function buildBoardCardContractV177A(scene = {}, route = 'i2v', color = '') {
  const speaker = firstText(scene.speakerLabel, scene.speaker_label, scene.roleLabel, scene.role_label, scene.blockTitle, scene.block_title)
  const textPreview = firstText(scene.translated_text_ru, scene.original_text, scene.scene_word_text, scene.lyrics_text, speaker)
  return {
    title: firstText(scene.blockTitle, scene.block_title, scene.title, speaker),
    speaker_label: speaker,
    route_label: route,
    text_preview: textPreview,
    translation_preview: firstText(scene.translated_text_ru, textPreview),
    color,
  }
}

function buildSceneTextStatsV177A(normalizedScenes = []) {
  const total = normalizedScenes.length
  const labelOnly = normalizedScenes.filter((scene) => scene.scene_text?.status === 'label_only' || sceneTextLooksLabelOnlyV177A(scene)).length
  const real = Math.max(0, total - labelOnly)
  return { total, labelOnly, real }
}

function buildPipelineStateContractV177A({ audio = null, normalizedScenes = [], sceneTextStats = {} } = {}) {
  const audioReady = Boolean(audio)
  const sceneSplitReady = normalizedScenes.length > 0
  const textReady = Boolean(sceneTextStats.real > 0 && sceneTextStats.labelOnly === 0)
  const blocked = Boolean(audioReady && sceneSplitReady && !textReady)
  return {
    current_stage: sceneSplitReady ? 'scene_split_ready' : 'input_validation',
    audio_ready: audioReady,
    asr_ready: textReady,
    real_scene_text_ready: textReady,
    translation_ready: textReady,
    scene_split_ready: sceneSplitReady,
    route_map_ready: sceneSplitReady,
    board_import_ready: sceneSplitReady,
    codex_storyboard_ready: Boolean(sceneSplitReady && textReady),
    blocked,
    blocker_reason: blocked ? 'Scenes exist, but text is only labels/placeholders. Run ASR or fill real scene text before Codex storyboard.' : '',
    next_required_action: blocked ? 'run_asr_or_fill_scene_text' : (sceneSplitReady ? 'codex_storyboard' : 'create_scene_split'),
    allowed_actions: blocked ? ['review_scenes', 'review_routes', 'board_import', 'run_asr_or_fill_scene_text'] : ['review_scenes', 'review_routes', 'board_import', 'codex_storyboard'],
    forbidden_actions: blocked ? ['codex_storyboard', 'photo_prompts', 'video_generation'] : [],
  }
}

function buildAsrStateContractV177A({ audio = null, sceneTextStats = {} } = {}) {
  const ready = Boolean(sceneTextStats.total > 0 && sceneTextStats.labelOnly === 0)
  return {
    required: Boolean(audio),
    ready,
    asr_type_required: 'auto: vocal_asr for songs, speech_asr for stories/podcast',
    main_asr_done: ready,
    vocal_asr_done: false,
    word_level_ready: ready,
    phrase_level_ready: ready,
    segments_count: ready ? sceneTextStats.total : 0,
    words_count: 0,
    scene_text_ready_count: sceneTextStats.real || 0,
    quality: ready ? 'scene_text_ready' : 'missing',
    source: ready ? 'scene_text' : 'none',
    blocker_if_missing: 'Audio exists but ASR is missing. For songs run vocal ASR; for narrator/story run speech ASR before automatic scene split.',
  }
}

function buildTranslationStateContractV177A(sceneTextStats = {}) {
  const ready = Boolean(sceneTextStats.total > 0 && sceneTextStats.labelOnly === 0)
  return {
    required: true,
    ready,
    translated_scene_count: ready ? sceneTextStats.total : 0,
    meaning_scene_count: ready ? sceneTextStats.total : 0,
    real_text_scene_count: sceneTextStats.real || 0,
    label_only_scene_count: sceneTextStats.labelOnly || 0,
    total_scene_count: sceneTextStats.total || 0,
    quality: ready ? 'scene_text_ready' : 'placeholder_labels_only',
    needs_translation_pass: false,
    needs_meaning_pass: false,
    blocker_if_placeholder_only: 'Scene text is only speaker/block labels. Run ASR or fill real scene text before Codex storyboard.',
  }
}

function buildCodexTasksContractV177A(pipelineState = {}, format = '16:9') {
  const blocked = !pipelineState.codex_storyboard_ready
  const formatRule = `Use project_context.format and scene.format as locked output format (${format}). For 9:16 write vertical prompts, for 16:9 write horizontal prompts, for 1:1 write square prompts. Do not change aspect ratio.`
  return [
    {
      task_id: 'codex_storyboard_v1',
      status: blocked ? 'blocked' : 'ready',
      blocked_reason: blocked ? pipelineState.blocker_reason : '',
      instruction: 'Create storyboard cards for each scene without changing scene_id, timing, route/model, audio, existing media, or format.',
      format_rule: formatRule,
      must_obey: [
        'Use route/model_route for each scene.',
        'Use project_context.format and scene.format as locked output format.',
        'For 9:16 scenes, create vertical composition prompts.',
        'For ia2v/lip-sync scenes, still must show a clear face and visible mouth.',
        'For instrument_lipsync scenes, still must show instrument, hands and performance pose.',
        'For i2v scenes, create safe readable b-roll/action stills.',
        'Do not write final image-aware video prompts before stills are generated/imported.',
      ],
      expected_outputs: ['storyboard_locked.json', 'entity_cards.json', 'validation_report.json'],
    },
    {
      task_id: 'codex_photo_prompts_v1',
      status: blocked ? 'blocked_until_storyboard_ready' : 'blocked_until_storyboard_reviewed',
      instruction: 'Create photo prompts from approved storyboard only. Preserve timing, scene ids, routes, roles and format.',
      format_rule: formatRule,
      expected_outputs: ['prompts_pack.json', 'board_import_ready.json', 'validation_report.json'],
    },
    {
      task_id: 'codex_image_aware_video_prompts_v1',
      status: 'blocked_until_stills_approved',
      instruction: 'Rewrite video prompts based only on actual approved stills. Do not invent invisible objects or change route/timing/story/format.',
      format_rule: formatRule,
      expected_outputs: ['board_patch_image_aware_prompts.json', 'validation_report.json'],
    },
  ]
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

function extractAudioDuration(manualTiming = {}, board = {}, summary = {}, assets = {}) {
  const audio = asObject(manualTiming.audio || manualTiming.audio_file || manualTiming.sourceAudio)
  const validationSummary = asObject(manualTiming.validation?.summary || board.validation?.summary || summary)
  return firstNumber(
    manualTiming.durationSec,
    manualTiming.duration_sec,
    manualTiming.audioDurationSec,
    manualTiming.audio_duration_sec,
    manualTiming.audio?.durationSec,
    manualTiming.audio?.duration_sec,
    board.audioDurationSec,
    board.audio_duration_sec,
    board.audio?.durationSec,
    board.audio?.duration_sec,
    assets.audio?.durationSec,
    assets.audio?.duration_sec,
    audio.durationSec,
    audio.duration_sec,
    validationSummary.audioDurationSec,
    validationSummary.audio_duration_sec,
    summary.audioDurationSec,
    summary.audio_duration_sec
  )
}

function audioAssetFromSources(manualTiming = {}, board = {}, summary = {}) {
  const audio = asObject(manualTiming.audio || manualTiming.audio_file || manualTiming.sourceAudio || board.audio || summary.audio)
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
  const duration = extractAudioDuration(manualTiming, board, summary, { audio })
  if (!assetId && !apiPath && !name && !duration) return null
  return {
    name,
    asset_id: assetId,
    assetId,
    asset_api_path: apiPath,
    assetApiPath: apiPath,
    duration_sec: duration,
    durationSec: duration,
  }
}

function sourceSceneArray(manualTiming = {}, board = {}) {
  const rootScenes = asArray(manualTiming.scenes)
  if (rootScenes.length) return rootScenes
  const timingScenes = asArray(manualTiming.timing?.scenes)
  if (timingScenes.length) return timingScenes
  const boardScenes = asArray(board.scenes || board.board_scenes || board.boardScenes)
  if (boardScenes.length) return boardScenes
  const productionScenes = asArray(board.production?.scenes || manualTiming.production?.scenes)
  if (productionScenes.length) return productionScenes
  return []
}

function storyBlocksFromSources(manualTiming = {}, board = {}, scenes = []) {
  // AVA_SEMANTIC_BLOCKS_CANON_V69B:
  // Current scene assignments are the source of truth. This removes stale duplicate
  // storyBlocks when the user re-groups scenes with Ctrl+click in Manual Timing.
  const existing = asArray(manualTiming.storyBlocks || manualTiming.story_blocks || board.storyBlocks || board.story_blocks)
  const existingById = new Map()
  existing.forEach((block, index) => {
    const id = firstText(block.id, block.blockId, block.block_id)
    if (!id) return
    existingById.set(id, {
      index,
      title: firstText(block.title, block.blockTitle, block.block_title, block.label),
      color: normalizeHexColor(block.color || block.blockColor || block.block_color, index),
    })
  })

  const byId = new Map()
  ;(Array.isArray(scenes) ? scenes : []).forEach((scene, index) => {
    const id = firstText(scene.blockId, scene.block_id)
    if (!id) return
    const sceneId = sceneIdOf(scene, index)
    const existingBlock = existingById.get(id) || {}
    const title = firstText(scene.blockTitle, scene.block_title, existingBlock.title, id)
    const color = normalizeHexColor(scene.blockColor || scene.block_color || scene.color || scene.sceneColor || existingBlock.color, byId.size)

    if (!byId.has(id)) {
      byId.set(id, {
        id,
        title,
        color,
        scene_ids: [],
        sceneIds: [],
        sceneIndexes: [],
        start: Number(scene.start ?? scene.start_sec ?? 0),
        end: Number(scene.end ?? scene.end_sec ?? 0),
        blockId: id,
        block_id: id,
        blockTitle: title,
        block_title: title,
        blockColor: color,
        block_color: color,
      })
    }

    const block = byId.get(id)
    if (!block.scene_ids.includes(sceneId)) block.scene_ids.push(sceneId)
    if (!block.sceneIds.includes(sceneId)) block.sceneIds.push(sceneId)
    if (!block.sceneIndexes.includes(index)) block.sceneIndexes.push(index)
    block.start = Math.min(Number(block.start || 0), Number(scene.start ?? scene.start_sec ?? block.start ?? 0))
    block.end = Math.max(Number(block.end || 0), Number(scene.end ?? scene.end_sec ?? block.end ?? 0))
    block.duration = round3(Math.max(0, Number(block.end || 0) - Number(block.start || 0)))
  })

  const canonical = Array.from(byId.values()).filter((block) => block.scene_ids.length)
  if (canonical.length) return canonical

  return existing.map((block, index) => {
    const color = normalizeHexColor(block.color || block.blockColor || block.block_color, index)
    const id = firstText(block.id, block.blockId, block.block_id) || `block_${String(index + 1).padStart(2, '0')}`
    const title = firstText(block.title, block.blockTitle, block.block_title, block.label) || `Block ${index + 1}`
    return {
      ...block,
      id,
      blockId: id,
      block_id: id,
      title,
      blockTitle: title,
      block_title: title,
      color,
      blockColor: color,
      block_color: color,
    }
  })
}

function buildColorMaps(storyBlocks = [], scenes = []) {
  const blockColor = new Map()
  storyBlocks.forEach((block, index) => {
    const id = firstText(block.blockId, block.block_id, block.id)
    if (!id) return
    blockColor.set(id, normalizeHexColor(block.color || block.blockColor || block.block_color, index))
  })

  scenes.forEach((scene, index) => {
    const id = firstText(scene.blockId, scene.block_id)
    if (!id || blockColor.has(id)) return
    blockColor.set(id, normalizeHexColor(scene.color || scene.sceneColor || scene.blockColor || scene.block_color, index))
  })

  return blockColor
}

function promptValues(scene = {}) {
  const prompts = asObject(scene.prompts)
  return {
    photo: firstText(scene.photo_prompt_positive, scene.photoPromptPositive, scene.image_prompt, scene.imagePrompt, prompts.photo_positive, prompts.image_positive),
    videoMotion: firstText(scene.video_motion_prompt, scene.videoMotionPrompt, scene.motion_prompt, scene.motionPrompt, prompts.video_motion),
    photoNegative: firstText(scene.photo_prompt_negative, scene.photoPromptNegative, prompts.photo_negative),
    videoMotionNegative: firstText(scene.video_motion_negative, scene.videoMotionNegative, prompts.video_motion_negative),
    lipsync: firstText(scene.lipsync_motion_prompt, scene.lipsyncMotionPrompt, scene.lip_sync_prompt, scene.ia2v_prompt),
    positive: firstText(scene.positive_prompt, scene.prompt_positive, scene.video_prompt, prompts.positive, prompts.video_positive),
    negative: firstText(scene.negative_prompt, scene.prompt_negative, prompts.negative, prompts.video_negative),
  }
}

function hasRealPrompt(scene = {}) {
  const prompts = promptValues(scene)
  return Boolean(prompts.photo || prompts.videoMotion)
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
    scene.still_url,
    scene.stillUrl,
    scene.approved_still_path,
    scene.approved_still_url,
    scene.approvedStillPath,
    scene.approvedStillUrl
  ))
}

function sceneSoundNeeded(scene = {}) {
  if (scene.sound_design_needed === true || scene.soundDesignNeeded === true) return true
  if (scene.mmaudio_requested === true || scene.scene_sound_requested === true) return true
  return Boolean(firstText(scene.mmaudio_prompt, scene.scene_ambience_prompt, scene.foley_prompt, scene.sound_notes, scene.sound_role))
}

function hasSoundPrompt(scene = {}) {
  return Boolean(firstText(scene.mmaudio_prompt, scene.scene_ambience_prompt, scene.foley_prompt))
}

function productionByIdFromSources(manualTiming = {}, board = {}) {
  const rows = [
    ...asArray(manualTiming.production?.scenes),
    ...asArray(board.production?.scenes),
    ...asArray(board.scenes),
  ]
  const map = new Map()
  rows.forEach((scene, index) => {
    const id = sceneIdOf(scene, index)
    if (id && !map.has(id)) map.set(String(id), scene)
  })
  return map
}

function normalizeScenesOnce({ projectModeId = 'manual_general_v1', manualTiming = {}, board = {}, audioDurationSec = 0, projectFormat = '' } = {}) {
  const source = sourceSceneArray(manualTiming, board)
  const productionById = productionByIdFromSources(manualTiming, board)
  const storyBlocks = storyBlocksFromSources(manualTiming, board, source)
  const blockColorMap = buildColorMaps(storyBlocks, source)
  const total = source.length
  const sceneFormatV177A = getProjectFormat({ format: projectFormat }, manualTiming, board) || '16:9'

  if (!source.length && audioDurationSec > 0) {
    source.push({ id: 'seg_01', scene_id: 'seg_01', start: 0, end: audioDurationSec, duration: audioDurationSec, route: 'i2v' })
  }

  return source.map((scene, index) => {
    const id = sceneIdOf(scene, index)
    const production = productionById.get(String(id)) || {}
    const start = round3(Number(scene.start ?? scene.start_sec ?? scene.startSec ?? scene.target_t0 ?? production.start ?? production.start_sec ?? production.target_t0 ?? 0) || 0)
    const rawEnd = Number(scene.end ?? scene.end_sec ?? scene.endSec ?? scene.target_t1 ?? production.end ?? production.end_sec ?? production.target_t1 ?? 0) || 0
    const rawDuration = Number(scene.duration ?? scene.duration_sec ?? scene.durationSec ?? production.duration ?? production.duration_sec ?? 0) || 0
    const end = round3(rawEnd > start ? rawEnd : (rawDuration > 0 ? start + rawDuration : Math.min(Number(audioDurationSec || 0), start + 1)))
    const duration = round3(Math.max(0, end - start))
    const route = sceneRoute({ ...production, ...scene }, projectModeId, index, total)
    const routeContractV177A = buildSceneRouteContractV177A(route)
    const blockId = firstText(scene.blockId, scene.block_id, production.blockId, production.block_id) || `block_${String(index + 1).padStart(2, '0')}`
    const blockTitle = firstText(scene.blockTitle, scene.block_title, production.blockTitle, production.block_title, scene.recipe_step, production.recipe_step) || blockId
    const color = blockColorMap.has(blockId)
      ? blockColorMap.get(blockId)
      : normalizeHexColor(firstText(scene.color, scene.sceneColor, scene.blockColor, production.color, production.sceneColor, production.blockColor), index)

    return {
      ...production,
      ...scene,
      id,
      scene_id: id,
      index,
      start,
      end,
      duration,
      start_sec: start,
      end_sec: end,
      duration_sec: duration,
      target_t0: start,
      target_t1: end,
      format: sceneFormatV177A,
      aspect_ratio: sceneFormatV177A,
      output_format: sceneFormatV177A,
      route,
      planned_route: firstText(scene.planned_route, scene.plannedRoute, production.planned_route, route),
      model_route: routeContractV177A,
      route_contract: routeContractV177A,
      route_requirements: routeContractV177A,
      scene_text: buildSceneTextContractV177A({ ...production, ...scene }),
      scene_source: buildSceneSourceContractV177A({ ...production, ...scene }, start, end),
      scene_requirements: buildSceneRequirementsContractV177A({ ...production, ...scene }, routeContractV177A),
      board_card: buildBoardCardContractV177A({ ...production, ...scene }, route, color),
      scene_word_text: firstText(scene.scene_word_text, scene.text, scene.lyrics_text, production.scene_word_text, production.text),
      lyrics_text: firstText(scene.lyrics_text, scene.scene_word_text, production.lyrics_text, production.scene_word_text),
      original_text: firstText(scene.original_text, scene.originalText, production.original_text, production.originalText),
      translated_text_ru: firstText(scene.translated_text_ru, scene.translation, scene.translation_ru, scene.ruText, production.translated_text_ru, production.translation),
      meaning_hint_ru: firstText(scene.meaning_hint_ru, scene.meaning, scene.meaningText, production.meaning_hint_ru, production.meaning),
      blockId,
      block_id: blockId,
      blockTitle,
      block_title: blockTitle,
      // AVA_PACK_BLOCK_COLOR_CANON_V72:
      // All aliases are the same exact semantic block color. This prevents
      // stale block_color/user_scene_color from leaking into Board.
      color,
      blockColor: color,
      block_color: color,
      sceneColor: color,
      scene_color: color,
      user_scene_color: color,
      timelineColor: color,
      cardColor: color,
      recipe_step: projectModeId === 'recipe_process_v1' ? firstText(scene.recipe_step, production.recipe_step, blockTitle) : firstText(scene.recipe_step, production.recipe_step),
      idea_fn: projectModeId === 'lyric_meaning_remix_v1' ? firstText(scene.idea_fn, production.idea_fn) : firstText(scene.idea_fn, production.idea_fn),
      idea_meaning: firstText(scene.idea_meaning, production.idea_meaning),
      idea_story: firstText(scene.idea_story, production.idea_story),
      idea_anchor: firstText(scene.idea_anchor, production.idea_anchor),
      visual_action: firstText(scene.visual_action, production.visual_action),
      viewer_should_understand: firstText(scene.viewer_should_understand, production.viewer_should_understand, scene.meaning, production.meaning),
      readability_check: firstText(scene.readability_check, production.readability_check),
      locked: scene.locked !== false,
      do_not_change_scene_id: true,
      do_not_change_start_end_duration: true,
    }
  }).filter((scene) => scene.end > scene.start)
}


function actualStillImageFromScene(scene = {}) {
  const assetId = firstText(
    scene.actual_still_image?.asset_id,
    scene.actualStillImage?.assetId,
    scene.image_asset_id,
    scene.imageAssetId,
    scene.still_asset_id,
    scene.stillAssetId,
    scene.photo_asset_id,
    scene.photoAssetId
  )
  const url = firstText(
    scene.actual_still_image?.url,
    scene.actualStillImage?.url,
    scene.image_url,
    scene.imageUrl,
    scene.photo_url,
    scene.photoUrl,
    scene.start_image_url,
    scene.startImageUrl,
    scene.generated_still_url,
    scene.generatedStillUrl,
    scene.still_url,
    scene.stillUrl,
    scene.approved_still_url,
    scene.approvedStillUrl,
    scene.approved_still_path,
    scene.approvedStillPath
  )
  const filename = firstText(
    scene.actual_still_image?.filename,
    scene.actualStillImage?.filename,
    scene.image_filename,
    scene.imageFilename,
    scene.photo_filename,
    scene.photoFilename,
    scene.planned_photo_filename,
    scene.approved_still_filename,
    scene.approvedStillFilename,
    scene.approved_still_path,
    scene.approvedStillPath
  )
  return {
    asset_id: assetId,
    url,
    filename,
    source: firstText(scene.actual_still_image?.source, scene.actualStillImage?.source, scene.still_source, 'generated_or_imported'),
  }
}

function imageAwarePromptUpdated(scene = {}) {
  return scene.image_aware_video_prompt_updated === true ||
    scene.imageAwareVideoPromptUpdated === true ||
    scene.final_prompt_ready === true ||
    scene.finalPromptReady === true ||
    ['updated', 'locked', 'ready', 'approved'].includes(String(scene.image_aware_prompt_status || scene.imageAwarePromptStatus || scene.review_status || '').toLowerCase())
}


function rootScenesFromNormalized(normalizedScenes = [], modeId = 'manual_general_v1') {
  return normalizedScenes.map((scene) => {
    const out = {
      id: scene.id,
      scene_id: scene.scene_id,
      start: scene.start,
      end: scene.end,
      duration: scene.duration,
      start_sec: scene.start_sec,
      end_sec: scene.end_sec,
      duration_sec: scene.duration_sec,
      target_t0: scene.target_t0,
      target_t1: scene.target_t1,
      format: scene.format,
      aspect_ratio: scene.aspect_ratio || scene.format,
      output_format: scene.output_format || scene.format,
      route: scene.route,
      planned_route: scene.planned_route,
      scene_word_text: scene.scene_word_text,
      lyrics_text: scene.lyrics_text,
      original_text: scene.original_text,
      translated_text_ru: scene.translated_text_ru,
      meaning_hint_ru: scene.meaning_hint_ru,
      blockId: scene.blockId,
      block_id: scene.block_id || scene.blockId,
      blockTitle: scene.blockTitle,
      block_title: scene.block_title || scene.blockTitle,
      blockColor: scene.blockColor || scene.color,
      block_color: scene.block_color || scene.blockColor || scene.color,
      color: scene.color,
      visual_action: scene.visual_action,
      viewer_should_understand: scene.viewer_should_understand,
      readability_check: scene.readability_check,
      ...avaCodexMirrorSceneFieldsV78(scene),
      locked: true,
      do_not_change_scene_id: true,
      do_not_change_start_end_duration: true,
    }
    if (modeId === 'recipe_process_v1') out.recipe_step = scene.recipe_step
    if (modeId === 'lyric_meaning_remix_v1') out.idea_fn = scene.idea_fn
    return out
  })
}

function timingScenesFromNormalized(normalizedScenes = []) {
  return normalizedScenes.map((scene, index) => ({
    scene_id: scene.scene_id,
    index,
    start: scene.start,
    end: scene.end,
    duration: scene.duration,
    format: scene.format,
    aspect_ratio: scene.aspect_ratio || scene.format,
    output_format: scene.output_format || scene.format,
    route: scene.route,
    text: scene.scene_word_text || scene.lyrics_text || scene.original_text || '',
    original_text: scene.original_text || scene.scene_word_text || '',
    translation: scene.translated_text_ru || '',
    meaning: scene.meaning_hint_ru || scene.viewer_should_understand || '',
    note: firstText(scene.note, scene.recipe_step, scene.idea_fn, scene.viewer_should_understand),
    blockId: scene.blockId,
    blockTitle: scene.blockTitle,
    color: scene.color,
    locked: true,
    do_not_change_scene_id: true,
    do_not_change_start_end_duration: true,
  }))
}


function stripPlanningLabelsV17(prompt = '') {
  return String(prompt || '')
    .replace(/\bScene action\s*:\s*/gi, '')
    .replace(/\bViewer must understand\s*:\s*/gi, '')
    .replace(/\bMotion\s*:\s*/gi, '')
    .replace(/\bRecipe step\s*:\s*/gi, '')
    .replace(/\breadability_check\s*:\s*/gi, '')
    .replace(/\bscene_word_text\s*:\s*/gi, '')
    .replace(/\btranslated_text_ru\s*:\s*/gi, '')
    .replace(/\bmeaning_hint_ru\s*:\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function validateFinalGenerationPromptV17(prompt = '', scene = {}) {
  const text = String(prompt || '')
  const unsafe = Array.isArray(scene.unsafe_motion_avoid) ? scene.unsafe_motion_avoid : []
  const unsafeHits = unsafe
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((item) => new RegExp(`\\b${item.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'i').test(text))
  const hasServiceLabels = /\b(Scene action|Viewer must understand|Motion|Recipe step)\s*:|Зритель|Сцена|Девушка|Сковорода сначала/i.test(text)
  const hasPlanningFields = /\b(scene_action|viewer_should_understand|visual_action|motion_hint|planning|readability_check|scene_word_text|translated_text_ru|meaning_hint_ru)\b/i.test(text)
  const hasNonEnglishText = /[\u0400-\u04FF]/.test(text)
  const hasForbiddenGenericMotion = unsafeHits.length > 0
  const finalPromptReady = Boolean(text.trim()) && !hasServiceLabels && !hasPlanningFields && !hasNonEnglishText && !hasForbiddenGenericMotion
  return {
    has_service_labels: hasServiceLabels,
    has_non_english_text: hasNonEnglishText,
    has_planning_fields_in_final_prompt: hasPlanningFields,
    has_forbidden_generic_motion: hasForbiddenGenericMotion,
    unsafe_motion_hits: unsafeHits,
    final_prompt_ready: finalPromptReady,
  }
}

function sanitizeFinalGenerationPromptV17(prompt = '') {
  return stripPlanningLabelsV17(prompt)
}


function productionScenesFromNormalized(normalizedScenes = [], modeId = 'manual_general_v1') {
  return normalizedScenes.map((scene, index) => {
    const prompts = promptValues(scene)
    const hasPrompt = hasRealPrompt(scene)
    const finalVideoPrompt = sanitizeFinalGenerationPromptV17(firstText(scene.final_video_prompt, scene.finalVideoPrompt, scene.video_motion_prompt, scene.videoMotionPrompt, scene.positive_prompt, scene.prompt_positive, scene.video_prompt))
    const finalNegativePrompt = sanitizeFinalGenerationPromptV17(firstText(scene.final_negative_prompt, scene.finalNegativePrompt, scene.video_motion_negative, scene.videoMotionNegative, scene.negative_prompt, scene.prompt_negative))
    const finalLipsyncPrompt = sanitizeFinalGenerationPromptV17(firstText(scene.final_lipsync_prompt, scene.finalLipsyncPrompt, scene.lipsync_motion_prompt, scene.lipsyncMotionPrompt))
    const promptValidation = validateFinalGenerationPromptV17(finalVideoPrompt, scene)
    const imageAwareUpdated = imageAwarePromptUpdated(scene)
    return {
      scene_id: scene.scene_id,
      id: scene.id,
      index,
      start: scene.start,
      end: scene.end,
      duration: scene.duration,
      start_sec: scene.start_sec,
      end_sec: scene.end_sec,
      duration_sec: scene.duration_sec,
      target_t0: scene.target_t0,
      target_t1: scene.target_t1,
      format: scene.format,
      aspect_ratio: scene.aspect_ratio || scene.format,
      output_format: scene.output_format || scene.format,
      route: scene.route,
      planned_route: scene.planned_route,
      blockId: scene.blockId,
      blockTitle: scene.blockTitle,
      color: scene.color,
      sceneColor: scene.color,
      user_scene_color: scene.color,
      blockColor: scene.color,
      timelineColor: scene.color,
      cardColor: scene.color,
      recipe_step: modeId === 'recipe_process_v1' ? scene.recipe_step : firstText(scene.recipe_step),
      idea_fn: modeId === 'lyric_meaning_remix_v1' ? scene.idea_fn : firstText(scene.idea_fn),
      visual_action: scene.visual_action || '',
      viewer_should_understand: scene.viewer_should_understand || '',
      readability_check: scene.readability_check || '',
      source_text: firstText(scene.scene_word_text, scene.lyrics_text, scene.original_text),
      translated_text_ru: scene.translated_text_ru || '',
      scene_action: firstText(scene.scene_action, scene.sceneAction, scene.visual_action),
      motion_hint: firstText(scene.motion_hint, scene.motionHint),
      planned_photo_filename: firstText(scene.planned_photo_filename, scene.photo_filename, scene.image_name, scene.first_frame_name),
      final_video_prompt: finalVideoPrompt,
      final_negative_prompt: finalNegativePrompt,
      final_lipsync_prompt: finalLipsyncPrompt,
      final_prompt_language: 'en',
      final_prompt_source: imageAwareUpdated ? 'image_aware_pass' : 'draft_sanitized',
      final_prompt_ready: Boolean(promptValidation.final_prompt_ready && imageAwareUpdated),
      prompt_validation: promptValidation,
      photo_prompt_positive: prompts.photo,
      photo_prompt_negative: prompts.photoNegative,
      video_motion_prompt: finalVideoPrompt || prompts.videoMotion,
      video_motion_negative: finalNegativePrompt || prompts.videoMotionNegative,
      lipsync_motion_prompt: finalLipsyncPrompt || prompts.lipsync,
      positive_prompt: finalVideoPrompt || prompts.positive,
      negative_prompt: finalNegativePrompt || prompts.negative,
      video_prompt: finalVideoPrompt || firstText(scene.video_prompt, prompts.positive),
      prompt_positive: finalVideoPrompt || firstText(scene.prompt_positive, prompts.positive),
      prompt_negative: finalNegativePrompt || firstText(scene.prompt_negative, prompts.negative),
      has_prompt: hasPrompt,
      has_still: hasStill(scene),
      sound_design_needed: sceneSoundNeeded(scene),
      sound_role: firstText(scene.sound_role, scene.soundRole),
      mmaudio_prompt: firstText(scene.mmaudio_prompt, scene.mmaudioPrompt),
      mmaudio_negative_prompt: firstText(scene.mmaudio_negative_prompt, scene.mmaudioNegativePrompt),
      scene_ambience_prompt: firstText(scene.scene_ambience_prompt, scene.sceneAmbiencePrompt, scene.ambience_prompt),
      foley_prompt: firstText(scene.foley_prompt, scene.foleyPrompt),
      sound_notes: firstText(scene.sound_notes, scene.soundNotes),
      media_status: sceneMediaStatusV18(scene),
      prompt_status: scenePromptStatusV18(scene),
      allowed_next_action: sceneAllowedNextActionV18(scene),
      protected_existing_outputs: sceneProtectedExistingOutputsV18(scene),
      actual_still_image: actualStillImageFromScene(scene),
      image_aware_prompt_status: firstText(scene.image_aware_prompt_status, scene.imageAwarePromptStatus) || (hasStill(scene) ? 'needs_review' : 'needs_still'),
      image_aware_video_prompt_updated: imageAwarePromptUpdated(scene),
      image_aware_prompt_notes: firstText(scene.image_aware_prompt_notes, scene.imageAwarePromptNotes),
      visible_content_summary: firstText(scene.visible_content_summary, scene.visibleContentSummary),
      safe_motion_plan: firstText(scene.safe_motion_plan, scene.safeMotionPlan),
      unsafe_motion_avoid: Array.isArray(scene.unsafe_motion_avoid) ? scene.unsafe_motion_avoid : (Array.isArray(scene.unsafeMotionAvoid) ? scene.unsafeMotionAvoid : []),
      ...avaCodexMirrorSceneFieldsV78(scene),
      final_video_prompt: finalVideoPrompt || firstText(scene.final_video_prompt, scene.finalVideoPrompt, scene.video_motion_prompt, scene.videoMotionPrompt, scene.positive_prompt, scene.prompt_positive, scene.video_prompt),
      final_negative_prompt: finalNegativePrompt || firstText(scene.final_negative_prompt, scene.finalNegativePrompt, scene.video_motion_negative, scene.videoMotionNegative, scene.negative_prompt, scene.prompt_negative),
      final_lipsync_prompt: finalLipsyncPrompt || firstText(scene.final_lipsync_prompt, scene.finalLipsyncPrompt, scene.lipsync_motion_prompt, scene.lipsyncMotionPrompt),
      final_prompt_ready: Boolean(scene.final_prompt_ready === true || scene.finalPromptReady === true || (promptValidation.final_prompt_ready && imageAwareUpdated)),
    }
  })
}

function collectAssets({ manualTiming = {}, board = {}, summary = {} }) {
  return {
    audio: audioAssetFromSources(manualTiming, board, summary),
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

function buildSceneBlockMap(storyBlocks = [], normalizedScenes = []) {
  const byId = new Map(storyBlocks.map((block) => [firstText(block.blockId, block.block_id, block.id), block]))
  const map = {}
  normalizedScenes.forEach((scene) => {
    const block = byId.get(scene.blockId) || {}
    map[scene.scene_id] = {
      blockId: scene.blockId,
      blockTitle: firstText(scene.blockTitle, block.blockTitle, block.title),
      color: scene.color,
    }
  })
  return map
}

function buildReadiness({ modeId, audio, normalizedScenes, productionScenes, assets }) {
  const missing = []
  const warnings = []
  const next_questions = []
  const next_actions_for_user = []

  const hasAudio = Boolean(audio)
  const hasAudioDuration = Boolean(Number(audio?.duration_sec || audio?.durationSec || 0) > 0)
  const hasScenes = normalizedScenes.length > 0
  const hasNonZeroTiming = normalizedScenes.some((scene) => Number(scene.duration || 0) > 0 || Number(scene.end || 0) > Number(scene.start || 0))
  const hasProductionPrompts = productionScenes.some((scene) => scene.has_prompt === true)
  const hasGeneratedStills = productionScenes.some((scene) => scene.has_still === true)
  const ia2vScenes = normalizedScenes.filter((scene) => isIa2vRoute(scene.route))
  const soundRequestedScenes = productionScenes.filter((scene) => scene.sound_design_needed)
  const soundMissingScenes = soundRequestedScenes.filter((scene) => !hasSoundPrompt(scene))
  const stillScenes = productionScenes.filter((scene) => scene.has_still === true)
  const stillsReady = hasGeneratedStills
  const imageAwareScenes = stillScenes.filter((scene) => imageAwarePromptUpdated(scene))
  const finalPromptReadyScenes = stillScenes.filter((scene) => scene.final_prompt_ready === true)
  const imageAwareVideoPromptsReady = stillsReady && stillScenes.length > 0 && imageAwareScenes.length === stillScenes.length && finalPromptReadyScenes.length === stillScenes.length

  if (!hasAudio) {
    missing.push('assets.audio')
    next_actions_for_user.push('Загрузи аудио в проект и скачай задание заново.')
  }
  if (hasAudio && !hasAudioDuration) {
    missing.push('assets.audio.duration_sec')
    warnings.push('Длительность аудио не найдена в snapshot. Проверь загрузку аудио и пересохрани тайминг.')
  }
  if (!hasScenes || !hasNonZeroTiming) {
    missing.push('timing.scenes')
    next_actions_for_user.push('Сделай ASR / Manual Timing или импортируй готовый scene split.')
  }
  if (ia2vScenes.length && !asArray(assets.character_refs).length) {
    missing.push('assets.character_refs.host')
    next_questions.push({
      id: 'host_character_reference',
      required: true,
      question_ru: 'В проекте есть ia2v/lip-sync сцены. Нужна карта персонажа ведущей. У тебя есть карта персонажа или создать новую?',
      expected_answer: 'provide_image_or_generate',
    })
  }
  if (!hasProductionPrompts) {
    missing.push('production.prompts')
    next_actions_for_user.push('Создай storyboard/prompts/stills по этому заданию или отправь пакет в ChatGPT/Codex.')
  }
  if (!hasGeneratedStills) {
    missing.push('generated_stills')
    warnings.push('Generated stills отсутствуют: это split/partial package, не full package.')
  }
  if (soundMissingScenes.length) {
    missing.push('production.sound_prompts')
  }
  if (hasGeneratedStills && !imageAwareVideoPromptsReady) {
    missing.push('image_aware_video_prompt_pass')
    if (finalPromptReadyScenes.length !== stillScenes.length) missing.push('final_generation_prompts.clean')
    next_actions_for_user.push('Кадры уже есть: сначала обнови video prompts по реальным изображениям.')
  }
  if (modeId === 'recipe_process_v1') {
    next_questions.push({ id: 'recipe_topic', required: true, question_ru: 'Какое блюдо готовим?' })
    next_questions.push({ id: 'location_style', required: false, question_ru: 'Какая локация: дача, кухня, костёр, улица?' })
  }
  if (modeId === 'lyric_meaning_remix_v1') {
    next_questions.push({ id: 'story_world', required: true, question_ru: 'В какой сюжетный мир переносим смысл песни?' })
    next_questions.push({ id: 'twist_object', required: true, question_ru: 'Что является объектом подмены?' })
  }

  const sceneSplitReady = hasAudio && hasAudioDuration && hasScenes && hasNonZeroTiming && !hasProductionPrompts
  const promptsReady = hasAudio && hasAudioDuration && hasScenes && hasProductionPrompts && !hasGeneratedStills
  const videoPromptsReady = hasAudio && hasAudioDuration && hasScenes && hasProductionPrompts && hasGeneratedStills && imageAwareVideoPromptsReady
  const fullPackage = videoPromptsReady
  const stage = videoPromptsReady ? 'video_prompts_ready' : hasGeneratedStills ? 'stills_ready' : promptsReady ? 'prompts_ready' : sceneSplitReady ? 'scene_split_ready' : hasScenes ? 'scene_split_import_ready' : 'created'

  return {
    stage,
    can_continue: hasAudio && hasAudioDuration && hasScenes && hasNonZeroTiming,
    can_import_to_board: hasScenes,
    can_send_to_codex: false,
    can_send_to_codex_for_storyboard_prompts: hasAudio && hasAudioDuration && hasScenes,
    can_generate_stills: hasProductionPrompts && !missing.includes('assets.character_refs.host'),
    stills_ready: stillsReady,
    image_aware_video_prompts_ready: imageAwareVideoPromptsReady,
    can_generate_video: videoPromptsReady,
    can_patch_prompts: !videoPromptsReady && hasScenes,
    can_import_stills: !hasGeneratedStills && hasScenes,
    current_blocker: videoPromptsReady ? '' : 'image_aware_video_prompt_pass',
    next_action: videoPromptsReady ? 'video_generation' : 'patch final video prompts only',
    prompt_only_import_possible: hasProductionPrompts && !hasGeneratedStills,
    full_package: fullPackage,
    missing: Array.from(new Set(missing)),
    warnings: Array.from(new Set(warnings)),
    next_questions,
    next_actions_for_user: Array.from(new Set(next_actions_for_user.concat(['Проверь режим проекта.']))),
    sound_layer_supported: true,
    sound_layer_required: false,
    sound_layer_requested: soundRequestedScenes.length > 0,
    sound_prompts_missing: soundMissingScenes.map((scene) => scene.scene_id),
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
  const projectMode = normalizeProjectMode(
    project.project_mode || project.projectMode || project.project_mode_id || project.projectModeId ||
    manualTiming.project_mode || manualTiming.projectMode || board.project_mode || board.projectMode || summary.project_mode || summary.projectMode
  )
  const modeCatalogV76 = projectModeCatalogForPack()
  const modeContract = buildModeContract(projectMode.id)
  const projectTypeV76 = project.type && project.type !== 'clip' ? project.type : projectTypeForMode(projectMode.id)
  const format = getProjectFormat(project, manualTiming, board)
  const assets = collectAssets({ manualTiming, board, summary })
  const audioDuration = firstNumber(Number(assets.audio?.duration_sec || assets.audio?.durationSec || 0), extractAudioDuration(manualTiming, board, summary, assets))
  if (assets.audio) {
    assets.audio.duration_sec = audioDuration
    assets.audio.durationSec = audioDuration
  }
  if (projectMode.id === 'video_first_documentary_v1') assets.source_video.required = true

  const normalizedScenes = normalizeScenesOnce({ projectModeId: projectMode.id, manualTiming, board, audioDurationSec: audioDuration, projectFormat: format })
  const storyBlocks = storyBlocksFromSources(manualTiming, board, normalizedScenes)
  const rootScenes = rootScenesFromNormalized(normalizedScenes, projectMode.id)
  const timingScenes = timingScenesFromNormalized(normalizedScenes)
  const productionScenes = productionScenesFromNormalized(normalizedScenes, projectMode.id)
  const sceneBlockMap = buildSceneBlockMap(storyBlocks, normalizedScenes)
  const sceneTextStatsV177A = buildSceneTextStatsV177A(normalizedScenes)
  const pipelineStateV177A = buildPipelineStateContractV177A({ audio: assets.audio, normalizedScenes, sceneTextStats: sceneTextStatsV177A })
  const asrStateV177A = buildAsrStateContractV177A({ audio: assets.audio, sceneTextStats: sceneTextStatsV177A })
  const translationStateV177A = buildTranslationStateContractV177A(sceneTextStatsV177A)
  const codexTasksV177A = buildCodexTasksContractV177A(pipelineStateV177A, format)
  const readiness = buildReadiness({ modeId: projectMode.id, audio: assets.audio, normalizedScenes, productionScenes, assets })
  const currentPatchGoalV18 = readiness.image_aware_video_prompts_ready ? 'video_generation' : 'image_aware_video_prompt_pass'
  const projectStateSummaryV18 = buildProjectStateSummaryV18({ audio: assets.audio, normalizedScenes, productionScenes, readiness })
  const taskScopeV18 = buildTaskScopeV18(readiness, currentPatchGoalV18)
  const updatePolicyV18 = buildUpdatePolicyV18()
  const assistantInstructionsV18 = buildAssistantInstructionsV18()

  const cookingPromptMemoryEnabledV84 = shouldEmbedCookingPromptMemory(board, { projectModeId: projectMode.id, force: projectMode.id === 'recipe_process_v1' })
  const cookingPromptMemoryV84 = cookingPromptMemoryEnabledV84 ? buildCookingPromptMemoryV1() : null
  const workflowNotesV84 = cookingPromptMemoryEnabledV84 ? buildCookingPromptWorkflowNotesV1(board.workflow_notes || board.workflowNotes || {}) : null

  const codexTask = {
    ...buildCodexTaskForMode(projectMode.id, { status: readiness.stage }),
    task_type: projectMode.id === 'recipe_process_v1'
      ? 'recipe_storyboard_prompts_and_generated_stills'
      : buildCodexTaskForMode(projectMode.id, { status: readiness.stage })?.task_type,
    expected_outputs: expectedOutputsForMode(projectMode.id),
    video_match_board_v2_import_contract: buildVideoMatchBoardV2SourceBindingContractV81(),
    production_fields_to_fill: PRODUCTION_FIELDS_TO_FILL,
    // AVA_PROJECT_PACK_UNIVERSAL_TASK_CONTRACT_V75
    universal_task_contract: buildUniversalTaskContractV75(projectMode),
    still_first_workflow: buildStillFirstWorkflowV75(projectMode),
    image_review_contract: buildImageReviewContractV75(),
    board_snapshot_contract: buildBoardSnapshotContractV75(),
    sound_layer_supported: true,
    sound_layer_required: false,
    sound_fields_to_fill: SOUND_FIELDS_TO_FILL,
    prompt_memory_preset: (typeof cookingPromptMemoryEnabledV84 !== 'undefined' ? cookingPromptMemoryEnabledV84 : cookingPromptMemoryEnabledV83) ? 'outdoor_cooking_i2v_sound' : '',
    prompt_memory_ref: (typeof cookingPromptMemoryEnabledV84 !== 'undefined' ? cookingPromptMemoryEnabledV84 : cookingPromptMemoryEnabledV83) ? 'cooking_prompt_memory_v1' : '',
      image_aware_video_prompt_pass_required: true,
      image_aware_video_prompt_fields_to_update: IMAGE_AWARE_VIDEO_PROMPT_FIELDS_TO_UPDATE,
      generate_all_precheck: {
        can_generate_video: readiness.can_generate_video,
        requires: ['scene has image', 'scene has final video prompt', 'image_aware_video_prompts_ready == true'],
        warning_if_not_ready: 'Кадры уже есть, но video prompts ещё не обновлены по реальным изображениям. Сначала сделайте image-aware video prompt pass, иначе генерация может уходить в другие действия/объекты.',
        default_action: 'Сначала обновить prompts по кадрам',
        override_action: 'Запустить всё равно',
      },
    image_aware_video_prompt_pass_required: true,
    image_aware_video_prompt_fields_to_update: IMAGE_AWARE_VIDEO_PROMPT_FIELDS_TO_UPDATE,
    full_package_or_ask: true,
  }

  const pack = {
    schema: 'ava_project_pack_v1',
    schema_version: 2,
    schema_aliases: ['ava_project_pack_v2'],
    pipeline_contract_schema: 'ava_project_pipeline_state_v2',
    board_import_contract_schema: 'ava_board_import_contract_v2',
    pack_profile: includeLegacyRaw ? 'debug' : 'compact',
    debug_included: Boolean(includeLegacyRaw),
    status: readiness.stage,
    exported_at: new Date().toISOString(),
    prompt_memory_preset: (typeof cookingPromptMemoryEnabledV84 !== 'undefined' ? cookingPromptMemoryEnabledV84 : cookingPromptMemoryEnabledV83) ? 'outdoor_cooking_i2v_sound' : '',
    cooking_prompt_memory_v1: (typeof cookingPromptMemoryV84 !== 'undefined' ? cookingPromptMemoryV84 : cookingPromptMemoryV83),
    workflow_notes: (typeof workflowNotesV84 !== 'undefined' ? workflowNotesV84 : workflowNotesV83),
    project: {
      id: project.id || project.project_id || '',
      name: project.name || '',
      type: projectTypeV76,
      format,
      aspect_ratio: format,
      output_format: format,
      description: project.description || '',
      status: project.status || '',
    },
    project_context: {
      project_id: project.id || project.project_id || '',
      project_name: project.name || '',
      project_type: projectTypeV76,
      mode_id: projectMode.id,
      mode_label_ru: projectMode.label_ru || projectMode.label || '',
      format,
      aspect_ratio: format,
      output_format: format,
      user_goal: firstText(project.user_goal, project.goal, board.user_goal, board.goal),
      story_idea: firstText(project.story_idea, board.story_idea),
      visual_style: firstText(project.visual_style, board.visual_style),
      language: firstText(project.language, manualTiming.language, board.language, 'auto'),
    },
    format_contract: {
      locked: true,
      source_of_truth: 'project_context.format',
      format,
      aspect_ratio: format,
      output_format: format,
      codex_rule: 'Use project_context.format and scene.format as locked output format. For 9:16 write vertical prompts, for 16:9 write horizontal prompts, for 1:1 write square prompts. Do not change aspect ratio.',
    },
    pipeline_state: pipelineStateV177A,
    asr_state: asrStateV177A,
    translation_state: translationStateV177A,
    board_import_contract: {
      schema: 'ava_board_import_contract_v2',
      board_can_read: true,
      required_scene_fields: ['scene_id', 'start_sec', 'end_sec', 'duration_sec', 'route', 'model_route', 'format', 'aspect_ratio', 'scene_text', 'translated_text_ru', 'meaning_hint_ru', 'blockId', 'blockTitle', 'speakerLabel'],
      locked_fields: ['scene_id', 'start_sec', 'end_sec', 'duration_sec', 'route unless user edits it', 'format/aspect_ratio/output_format from project unless user edits scene format', 'audio asset refs', 'existing media refs'],
      prompt_format_rule: 'Photo/video prompts must match project_context.format. 9:16 = vertical composition, 16:9 = horizontal composition, 1:1 = square composition.',
    },
    codex_tasks: codexTasksV177A,
    workflow_stages: IMAGE_AWARE_WORKFLOW_STAGES,
    universal_workflow_stages: AVA_UNIVERSAL_TASK_PIPELINE_V75,
    production_workflow: {
      stages: IMAGE_AWARE_WORKFLOW_STAGES,
      current_stage: readiness.stage,
    },
    image_aware_video_prompt_pass: {
      required_after_stills: true,
      required_before_video_generation: true,
      description: 'After real still images are generated or imported, rewrite final video prompts based on the actual visible content of each still. Do not change scene_id, timing, route, or story. Only update video prompt fields so they match what is actually visible in each still.',
      inputs_required: ['production.scenes', 'still images or imported scene images'],
      fields_to_update: IMAGE_AWARE_VIDEO_PROMPT_FIELDS_TO_UPDATE,
      fields_locked: ['scene_id', 'start', 'end', 'duration', 'route', 'scene order', 'recipe_step', 'viewer_should_understand', 'story meaning'],
      rules: [
        'Do not ask for objects or actions that are not visible in the still.',
        'Do not describe a close-up if the still is a wide shot.',
        'Do not request knife motion if no knife is visible.',
        'Do not request falling ingredients if the ingredient is already in the pan.',
        'Do not request pan, fire, steam or sizzling in pre-cooking ingredient scenes unless visible in the still.',
        'Do not request cooking action in prep-only scenes.',
        'Do not request a transition to the next recipe step.',
        'For lip-sync scenes with distant face or full-body framing, keep the lip-sync prompt short and prioritize visible mouth movement.',
        'For b-roll scenes, do not turn them into talking-host scenes.',
        'Animate only what is visible and safe to move in the uploaded still.',
      ],
    },
    project_mode: projectMode,
    mode_contract: modeContract,
    prompt_guidelines: modeContract.prompt_guidelines || {},
    video_match_board_v2_import_contract: buildVideoMatchBoardV2SourceBindingContractV81(),
    audio: {
      ...(assets.audio || {}),
      durationSec: audioDuration,
      duration_sec: audioDuration,
    },
    durationSec: audioDuration,
    audio_duration_sec: audioDuration,
    assets: {
      ...assets,
      audio: assets.audio ? {
        ...assets.audio,
        durationSec: audioDuration,
        duration_sec: audioDuration,
      } : null,
    },
    scenes: rootScenes,
    storyBlocks,
    story_blocks: storyBlocks,
    scene_block_map: sceneBlockMap,
    manual_timing_import_ready: {
      applied: rootScenes.length > 0,
      scene_count: rootScenes.length,
      source: 'chatgpt_scene_split',
      import_priority: ['scenes', 'timing.scenes', 'production.scenes'],
      route_logic: projectMode.id === 'recipe_process_v1'
        ? 'seg_01 and last scene are ia2v; all middle scenes are i2v.'
        : 'Use explicit route/planned_route from scenes; fallback route is i2v.',
    },
    task_scope: taskScopeV18,
    update_policy: updatePolicyV18,
    project_state_summary: projectStateSummaryV18,
    assistant_instructions: assistantInstructionsV18,
    patch_report: buildPatchReportTemplateV18(),
    timing: {
      source: 'manual_timing',
      locked: true,
      do_not_change_timing: true,
      do_not_change_scene_id: true,
      do_not_change_start_end_duration: true,
      audio_duration_sec: audioDuration,
      audioDurationSec: audioDuration,
      speech_segments: asArray(manualTiming.speech_segments || manualTiming.speechSegments || manualTiming.phrases || manualTiming.asr_phrases),
      scenes: timingScenes,
    },
    production: {
      source: 'normalized_scenes_v15',
      fields_to_fill: PRODUCTION_FIELDS_TO_FILL,
      sound_fields_to_fill: SOUND_FIELDS_TO_FILL,
      task_scope_mode: taskScopeV18.mode,
      update_policy: updatePolicyV18,
      allowed_patch_updates: AVA_PATCH_SCOPE_ALLOWED_UPDATES_V18,
      locked_patch_fields: AVA_PATCH_SCOPE_LOCKED_FIELDS_V18,
      scenes: productionScenes,
    },
    codex_task: codexTask,
    readiness,
    // AVA_PACK_MODE_REQUIREMENTS_CATALOG_V76
    mode_requirements: {
      active_modes: modeCatalogV76.active_modes,
      visible_modes: modeCatalogV76.visible_modes,
      visible_disabled_modes: modeCatalogV76.visible_disabled_modes,
      selected_mode_id: projectMode.id,
      selected_mode_label_ru: projectMode.label_ru,
      selected_mode_contract_ref: projectMode.contract_ref,
      source_video_required: projectMode.id === 'video_first_documentary_v1',
      character_ref_required_for_ia2v: true,
      prompt_guidelines_required: true,
      sound_layer_supported: true,
      sound_layer_required: false,
    },
    expected_outputs: expectedOutputsForMode(projectMode.id).map((name) => ({ name, created: false, expected: true })),
    validation: {
      do_not_change_timing: true,
      board_import_priority: ['production.scenes', 'timing.scenes'],
      manual_timing_import_priority: ['scenes', 'timing.scenes', 'production.scenes'],
      prompt_positive_priority: [...PROMPT_POSITIVE_KEYS, 'prompts.positive', 'prompts.video_positive'],
      prompt_negative_priority: [...PROMPT_NEGATIVE_KEYS, 'prompts.negative', 'prompts.video_negative'],
      full_package_or_ask: true,
      full_package: readiness.full_package,
      generated_stills_required_for_full_package: true,
      prompt_guidelines_ref: `${projectMode.contract_ref}.prompt_guidelines`,
      sound_design_guidelines_ref: `${projectMode.contract_ref}.prompt_guidelines.sound_design_prompt`,
      cooking_prompt_memory_ref: (typeof cookingPromptMemoryEnabledV84 !== 'undefined' ? cookingPromptMemoryEnabledV84 : cookingPromptMemoryEnabledV83) ? 'cooking_prompt_memory_v1' : '',
      sound_layer_supported: true,
      sound_layer_required: false,
      sound_fields_to_fill: SOUND_FIELDS_TO_FILL,
      summary: {
        ...summary,
        scenes_count: rootScenes.length,
        timing_scenes_count: timingScenes.length,
        production_scenes_count: productionScenes.length,
        story_blocks_count: storyBlocks.length,
        audio_duration_sec: audioDuration,
        audioDurationSec: audioDuration,
      },
    },
  }

  if (includeLegacyRaw) {
    pack.legacy_raw = { project, manualTiming, board }
  }

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
