/* AVA_BOARD_MEDIA_REDUCER_CONTRACT_V216A
 * Pure Board scene-media reducer.
 * No React state, no network, no localStorage.
 */

const textV216A = (value) => String(value ?? '').trim()
const numberV216A = (value) => {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

const PROMPT_KEYS_V216A = [
  'video_prompt', 'videoPrompt', 'prompt', 'positive_prompt', 'positivePrompt',
  'image_prompt', 'imagePrompt', 'photo_prompt', 'photoPrompt',
  'still_prompt', 'stillPrompt', 'generation_prompt', 'generationPrompt',
  'final_prompt', 'finalPrompt', 'final_video_prompt', 'finalVideoPrompt',
  'prompt_text', 'promptText',
]

const IMAGE_ASSET_KEYS_V216A = [
  'image_asset_id', 'imageAssetId',
  'first_image_asset_id', 'firstImageAssetId',
  'first_frame_asset_id', 'firstFrameAssetId',
  'start_image_asset_id', 'startImageAssetId',
  'last_image_asset_id', 'lastImageAssetId',
  'last_frame_asset_id', 'lastFrameAssetId',
  'end_image_asset_id', 'endImageAssetId',
]

const IMAGE_API_KEYS_V216A = [
  'image_api_path', 'imageApiPath', 'image_url', 'imageUrl',
  'first_image_api_path', 'firstImageApiPath', 'first_image_url', 'firstImageUrl',
  'first_frame_api_path', 'firstFrameApiPath', 'first_frame_url', 'firstFrameUrl',
  'start_image_api_path', 'startImageApiPath', 'start_image_url', 'startImageUrl',
  'last_image_api_path', 'lastImageApiPath', 'last_image_url', 'lastImageUrl',
  'last_frame_api_path', 'lastFrameApiPath', 'last_frame_url', 'lastFrameUrl',
  'end_image_api_path', 'endImageApiPath', 'end_image_url', 'endImageUrl',
]

const VIDEO_REF_KEYS_V216A = [
  'video_asset_id', 'videoAssetId', 'video_api_path', 'videoApiPath', 'video_url', 'videoUrl',
  'result_video_asset_id', 'resultVideoAssetId', 'result_video_api_path', 'resultVideoApiPath',
  'result_video_url', 'resultVideoUrl', 'result_url', 'resultUrl',
  'ready_video_asset_id', 'readyVideoAssetId', 'ready_video_api_path', 'readyVideoApiPath',
  'ready_video_url', 'readyVideoUrl', 'generated_video_asset_id', 'generatedVideoAssetId',
  'generated_video_api_path', 'generatedVideoApiPath', 'generated_video_url', 'generatedVideoUrl',
  'output_video_asset_id', 'outputVideoAssetId', 'output_video_api_path', 'outputVideoApiPath',
  'output_video_url', 'outputVideoUrl', 'video_static_url', 'videoStaticUrl', 'video_path', 'videoPath',
]

const VIDEO_SOURCE_ASSET_KEYS_V216A = [
  'video_source_image_asset_id', 'videoSourceImageAssetId',
  'generation_source_image_asset_id_v216a', 'generationSourceImageAssetIdV216A',
]

const VIDEO_SOURCE_REV_KEYS_V216A = [
  'video_source_revision_v216a', 'videoSourceRevisionV216A',
  'generation_media_revision_v216a', 'generationMediaRevisionV216A',
]

export function boardSceneIdV216A(scene = {}) {
  return textV216A(scene?.id || scene?.scene_id || scene?.sceneId || '')
}

export function boardSceneHasPromptV216A(scene = {}) {
  return PROMPT_KEYS_V216A.some((key) => Boolean(textV216A(scene?.[key])))
}

export function boardSceneMediaRevisionV216A(scene = {}) {
  return Math.max(
    numberV216A(scene?.media_revision_v216a),
    numberV216A(scene?.mediaRevisionV216A),
    numberV216A(scene?.image_revision_v216a),
    numberV216A(scene?.imageRevisionV216A),
    numberV216A(scene?.image_mutation_epoch),
    numberV216A(scene?.imageMutationEpoch),
    numberV216A(scene?.source_image_changed_epoch),
    numberV216A(scene?.sourceImageChangedEpoch),
    0,
  )
}

export function boardSceneImageAssetIdV216A(scene = {}) {
  for (const key of IMAGE_ASSET_KEYS_V216A) {
    const value = textV216A(scene?.[key])
    if (value) return value
  }
  for (const key of IMAGE_API_KEYS_V216A) {
    const value = textV216A(scene?.[key])
    const match = value.match(/(?:^|\/)assets\/(asset_[^/?#]+)(?:\/file)?/i)
    if (match?.[1]) return match[1]
  }
  return ''
}

export function boardSceneImageApiPathV216A(scene = {}) {
  for (const key of IMAGE_API_KEYS_V216A) {
    const value = textV216A(scene?.[key])
    if (value) return value
  }
  const assetId = boardSceneImageAssetIdV216A(scene)
  return assetId ? `/assets/${assetId}/file` : ''
}

export function boardSceneHasVideoRefV216A(scene = {}) {
  if (VIDEO_REF_KEYS_V216A.some((key) => Boolean(textV216A(scene?.[key])))) return true
  return Boolean(scene?.video_result || scene?.videoResult || scene?.output_video || scene?.outputVideo)
}

function nextRevisionV216A(scene = {}, requested = 0) {
  const current = boardSceneMediaRevisionV216A(scene)
  const now = Math.max(numberV216A(requested), Date.now())
  return Math.max(current + 1, now)
}

function clearImagePatchV216A() {
  return {
    image_url: '', imageUrl: '', image_api_path: '', imageApiPath: '', image_asset_id: '', imageAssetId: '', image_name: '', imageName: '', image_data_url: '', imageDataUrl: '', mediaUrl: '', media_url: '',
    first_frame_url: '', firstFrameUrl: '', first_frame_api_path: '', firstFrameApiPath: '', first_frame_asset_id: '', firstFrameAssetId: '', first_frame_name: '', firstFrameName: '',
    start_image_url: '', startImageUrl: '', start_image_api_path: '', startImageApiPath: '', start_image_asset_id: '', startImageAssetId: '', start_image_name: '', startImageName: '', start_image_data_url: '', startImageDataUrl: '',
    first_image_url: '', firstImageUrl: '', first_image_api_path: '', firstImageApiPath: '', first_image_asset_id: '', firstImageAssetId: '', first_image_name: '', firstImageName: '',
    last_frame_url: '', lastFrameUrl: '', last_frame_api_path: '', lastFrameApiPath: '', last_frame_asset_id: '', lastFrameAssetId: '', last_frame_name: '', lastFrameName: '',
    end_image_url: '', endImageUrl: '', end_image_api_path: '', endImageApiPath: '', end_image_asset_id: '', endImageAssetId: '', end_image_name: '', endImageName: '', end_image_data_url: '', endImageDataUrl: '',
    last_image_url: '', lastImageUrl: '', last_image_api_path: '', lastImageApiPath: '', last_image_asset_id: '', lastImageAssetId: '', last_image_name: '', lastImageName: '',
    image_status: '', imageStatus: '', photo_status: '', photoStatus: '',
    image_uploading: false, imageUploading: false, image_uploading_v129q: false, imageUploadingV129Q: false, photo_uploading: false, photoUploading: false,
  }
}

function clearVideoPatchV216A(reason = 'image_changed_v216a') {
  return {
    video: null, videoRef: null, video_ref: null, output_video: null, outputVideo: null,
    video_status: '', videoStatus: '', generation_status: '', generationStatus: '', batch_status: '', batchStatus: '',
    video_error: '', videoError: '', video_job_id: '', videoJobId: '', job_id: '', jobId: '', last_video_job_id: '', lastVideoJobId: '',
    video_status_endpoint: '', videoStatusEndpoint: '', video_queue_position: 0, videoQueuePosition: 0, video_queue_source: '', videoQueueSource: '',
    prompt_id: '', promptId: '', comfy_prompt_id: '', comfyPromptId: '',
    video_url: '', videoUrl: '', video_api_path: '', videoApiPath: '', video_asset_id: '', videoAssetId: '', video_name: '', videoName: '', original_video_url: '', originalVideoUrl: '',
    video_static_url: '', videoStaticUrl: '', video_path: '', videoPath: '', video_result: null, videoResult: null, video_ready_at: '', videoReadyAt: '',
    result_url: '', resultUrl: '', result_video_url: '', resultVideoUrl: '', result_video_api_path: '', resultVideoApiPath: '', result_video_asset_id: '', resultVideoAssetId: '', result_video_name: '', resultVideoName: '',
    ready_video_url: '', readyVideoUrl: '', ready_video_api_path: '', readyVideoApiPath: '', ready_video_asset_id: '', readyVideoAssetId: '',
    generated_video_url: '', generatedVideoUrl: '', generated_video_api_path: '', generatedVideoApiPath: '', generated_video_asset_id: '', generatedVideoAssetId: '',
    output_video_url: '', outputVideoUrl: '', output_video_api_path: '', outputVideoApiPath: '', output_video_asset_id: '', outputVideoAssetId: '',
    video_source_image_asset_id: '', videoSourceImageAssetId: '', video_source_image_api_path: '', videoSourceImageApiPath: '', video_source_image_url: '', videoSourceImageUrl: '',
    video_source_image_mutation_epoch: 0, videoSourceImageMutationEpoch: 0, video_source_image_mutation_at: '', videoSourceImageMutationAt: '',
    video_source_revision_v216a: 0, videoSourceRevisionV216A: 0, generation_media_revision_v216a: 0, generationMediaRevisionV216A: 0,
    generation_source_image_asset_id_v216a: '', generationSourceImageAssetIdV216A: '',
    review_status: '', reviewStatus: '', video_review_status: '', videoReviewStatus: '', video_review_reason: '', videoReviewReason: '', review_reason: '', reviewReason: '',
    pending_review: false, pendingReview: false, review_required: false, reviewRequired: false, needs_review: false, needsReview: false,
    bad_video: false, badVideo: false, video_bad: false, videoBad: false, is_bad_video: false, isBadVideo: false,
    video_review_bad: false, videoReviewBad: false, bad_video_review: false, badVideoReview: false,
    video_review_regenerate_from_bad: false, videoReviewRegenerateFromBad: false, video_review_regenerate_reason: '', videoReviewRegenerateReason: '',
    telegram_review_id: '', telegramReviewId: '', telegram_review_asset_id: '', telegramReviewAssetId: '', telegram_review_status: '', telegramReviewStatus: '',
    board_review_event_id: '', boardReviewEventId: '', review_transient_ui_lock_v213m: false, reviewTransientUiLockV213M: false,
    mmaudio_status: '', mmaudioStatus: '', mmaudio_error: '', mmaudioError: '', mmaudio_job_id: '', mmaudioJobId: '', mmaudio_status_endpoint: '', mmaudioStatusEndpoint: '',
    mmaudio_video_url: '', mmaudioVideoUrl: '', mmaudio_video_api_path: '', mmaudioVideoApiPath: '', mmaudio_video_asset_id: '', mmaudioVideoAssetId: '', mmaudio_video_name: '', mmaudioVideoName: '',
    mmaudio_result: null, mmaudioResult: null, mmaudio_result_video_url: '', mmaudioResultVideoUrl: '', mmaudio_result_video_api_path: '', mmaudioResultVideoApiPath: '', mmaudio_result_video_asset_id: '', mmaudioResultVideoAssetId: '',
    mmaudio_ready_at: '', mmaudioReadyAt: '', mmaudio_source_video_url: '', mmaudioSourceVideoUrl: '', mmaudio_source_video_api_path: '', mmaudioSourceVideoApiPath: '',
    mmaudio_reset_reason: reason, mmaudioResetReason: reason,
    input_not_ready_v213i: false, inputNotReadyV213I: false,
  }
}

function compatibilityResetPatchV216A(revision, at, intent, reason) {
  const token = `${intent}_${revision}`
  return {
    media_revision_v216a: revision, mediaRevisionV216A: revision,
    image_revision_v216a: revision, imageRevisionV216A: revision,
    media_revision_at_v216a: at, mediaRevisionAtV216A: at,
    media_reset_intent_v216a: intent, mediaResetIntentV216A: intent,
    media_authority_v216a: 'board_scene_reducer', mediaAuthorityV216A: 'board_scene_reducer',
    media_reset_generation_v129s: token, mediaResetGenerationV129S: token,
    media_reset_generation_v129t: token, mediaResetGenerationV129T: token,
    media_reset_generation_v129u: token, mediaResetGenerationV129U: token,
    media_reset_generation_v214i: token, mediaResetGenerationV214I: token,
    source_image_changed_at: at, sourceImageChangedAt: at,
    source_image_changed_epoch: revision, sourceImageChangedEpoch: revision,
    image_mutation_at: at, imageMutationAt: at,
    image_mutation_epoch: revision, imageMutationEpoch: revision,
    mediaEditVersionV213G: revision, media_edit_version_v213g: revision,
    image_replace_reason_v214i: reason, imageReplaceReasonV214I: reason,
    image_hard_replace_v214i: intent === 'replace_image', imageHardReplaceV214I: intent === 'replace_image',
    force_regenerate_after_image_replace_v214i: intent === 'replace_image', forceRegenerateAfterImageReplaceV214I: intent === 'replace_image',
    video_stale_after_image_change_v129p: true, videoStaleAfterImageChangeV129P: true,
  }
}

function applyImageSlotV216A(slot, fileName, assetId, apiPath) {
  if (slot === 'last') {
    return {
      last_frame_url: apiPath, lastFrameUrl: apiPath, last_frame_api_path: apiPath, lastFrameApiPath: apiPath, last_frame_asset_id: assetId, lastFrameAssetId: assetId, last_frame_name: fileName, lastFrameName: fileName,
      last_image_url: apiPath, lastImageUrl: apiPath, last_image_api_path: apiPath, lastImageApiPath: apiPath, last_image_asset_id: assetId, lastImageAssetId: assetId, last_image_name: fileName, lastImageName: fileName,
      end_image_url: apiPath, endImageUrl: apiPath, end_image_api_path: apiPath, endImageApiPath: apiPath, end_image_asset_id: assetId, endImageAssetId: assetId, end_image_name: fileName, endImageName: fileName,
      last_image_deleted_v129o: false, lastImageDeletedV129O: false,
    }
  }
  return {
    image_url: apiPath, imageUrl: apiPath, image_api_path: apiPath, imageApiPath: apiPath, image_asset_id: assetId, imageAssetId: assetId, image_name: fileName, imageName: fileName,
    first_frame_url: apiPath, firstFrameUrl: apiPath, first_frame_api_path: apiPath, firstFrameApiPath: apiPath, first_frame_asset_id: assetId, firstFrameAssetId: assetId, first_frame_name: fileName, firstFrameName: fileName,
    first_image_url: apiPath, firstImageUrl: apiPath, first_image_api_path: apiPath, firstImageApiPath: apiPath, first_image_asset_id: assetId, firstImageAssetId: assetId, first_image_name: fileName, firstImageName: fileName,
    start_image_url: apiPath, startImageUrl: apiPath, start_image_api_path: apiPath, startImageApiPath: apiPath, start_image_asset_id: assetId, startImageAssetId: assetId, start_image_name: fileName, startImageName: fileName,
    image_deleted_v129o: false, imageDeletedV129O: false, first_image_deleted_v129o: false, firstImageDeletedV129O: false,
  }
}

export function boardReplaceSceneImageV216A(scene = {}, options = {}) {
  const slot = options.slot === 'last' ? 'last' : 'image'
  const fileName = textV216A(options.fileName)
  const assetId = textV216A(options.assetId)
  const assetApiPath = textV216A(options.assetApiPath) || (assetId ? `/assets/${assetId}/file` : '')
  if (!assetId || !assetApiPath) throw new Error('v216a_replace_image_missing_asset')
  const revision = nextRevisionV216A(scene, options.revision)
  const at = options.at || new Date(revision).toISOString()
  const reason = options.reason || 'replace_image_v216a'
  const hasPrompt = boardSceneHasPromptV216A(scene)
  return {
    ...(scene || {}),
    ...clearImagePatchV216A(),
    ...clearVideoPatchV216A(reason),
    ...compatibilityResetPatchV216A(revision, at, 'replace_image', reason),
    ...applyImageSlotV216A(slot, fileName, assetId, assetApiPath),
    image_status: 'asset_ready', imageStatus: 'asset_ready', photo_status: 'asset_ready', photoStatus: 'asset_ready',
    generation_state_v216a: hasPrompt ? 'photo_prompt_ready' : 'photo_only',
    generationStateV216A: hasPrompt ? 'photo_prompt_ready' : 'photo_only',
    image_delete_tombstone_v214z: '', imageDeleteTombstoneV214Z: '',
    image_delete_tombstone_v214t: '', imageDeleteTombstoneV214T: '',
    manual_image_replace_tombstone_v214t: false, manualImageReplaceTombstoneV214T: false,
    image_deleted_v129o: false, imageDeletedV129O: false,
    updatedAt: at, updated_at: at,
  }
}

export function boardDeleteSceneMediaV216A(scene = {}, options = {}) {
  const revision = nextRevisionV216A(scene, options.revision)
  const at = options.at || new Date(revision).toISOString()
  const reason = options.reason || 'delete_image_v216a'
  const hasPrompt = boardSceneHasPromptV216A(scene)
  return {
    ...(scene || {}),
    ...clearImagePatchV216A(),
    ...clearVideoPatchV216A(reason),
    ...compatibilityResetPatchV216A(revision, at, 'delete_image', reason),
    image_deleted_v129o: true, imageDeletedV129O: true,
    first_image_deleted_v129o: true, firstImageDeletedV129O: true,
    last_image_deleted_v129o: true, lastImageDeletedV129O: true,
    image_delete_reason_v129u: reason, imageDeleteReasonV129U: reason,
    image_delete_tombstone_v214t: `delete_${revision}`, imageDeleteTombstoneV214T: `delete_${revision}`,
    manual_image_replace_tombstone_v214t: true, manualImageReplaceTombstoneV214T: true,
    generation_state_v216a: hasPrompt ? 'prompt_only' : 'empty',
    generationStateV216A: hasPrompt ? 'prompt_only' : 'empty',
    updatedAt: at, updated_at: at,
  }
}

export function boardServerVideoCanApplyV216A(localScene = {}, serverScene = {}) {
  const localRevision = boardSceneMediaRevisionV216A(localScene)
  if (localRevision <= 0) {
    const localImage = boardSceneImageAssetIdV216A(localScene)
    const sourceImage = VIDEO_SOURCE_ASSET_KEYS_V216A.map((key) => textV216A(serverScene?.[key])).find(Boolean) || ''
    return !(localImage && sourceImage && localImage !== sourceImage)
  }

  const localImage = boardSceneImageAssetIdV216A(localScene)
  const serverImage = boardSceneImageAssetIdV216A(serverScene)
  if (localImage && serverImage && localImage !== serverImage) return false

  const sourceImage = VIDEO_SOURCE_ASSET_KEYS_V216A.map((key) => textV216A(serverScene?.[key])).find(Boolean) || ''
  const sourceRevision = VIDEO_SOURCE_REV_KEYS_V216A.map((key) => numberV216A(serverScene?.[key])).find((value) => value > 0) || 0
  const hasVideo = boardSceneHasVideoRefV216A(serverScene)
  const status = textV216A(serverScene?.video_status || serverScene?.videoStatus).toLowerCase()
  const busy = ['starting', 'preparing', 'submitting', 'queued', 'running', 'processing'].includes(status)

  if (hasVideo || busy) {
    if (!localImage) return false
    if (sourceImage && sourceImage !== localImage) return false
    if (sourceRevision && sourceRevision !== localRevision) return false
    if (hasVideo && !sourceImage && !sourceRevision) return false
  }

  const serverRevision = boardSceneMediaRevisionV216A(serverScene)
  if (serverRevision > 0 && serverRevision < localRevision) return false
  return true
}
