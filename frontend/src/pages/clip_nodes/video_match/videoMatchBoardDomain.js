import { getAccountScopedStorageKey } from "../manualProjectBackup.js";

export const VIDEO_MATCH_BOARD_ACTIVE_PROJECT_KEY = "VIDEO_MATCH_BOARD_ACTIVE_PROJECT_KEY";
export const VIDEO_MATCH_BOARD_ACTIVE_PROJECT_ID_KEY = "VIDEO_MATCH_BOARD_ACTIVE_PROJECT_ID_KEY";
export const VIDEO_MATCH_BOARD_SCHEMA_V1 = "video_match_board_v1";
export const VIDEO_MATCH_BOARD_SCHEMA_V2 = "video_match_board_v2";
export const VIDEO_MATCH_BOARD_SCHEMA_PHOTOSTUDIO_V2 = "photostudio_video_match_board_v2";

export const VIDEO_MATCH_BOARD_V2_SOURCE_BINDING_RULES = {
  schema: "video_match_board_v2_source_binding_contract_v81",
  import_schema_for_video_match_board: VIDEO_MATCH_BOARD_SCHEMA_V2,
  stable_source_video_id: "V1",
  required_root_fields: ["sourceVideos", "segments"],
  required_candidate_fields: ["sourceVideoId", "source_video_id", "sourceVideoStartSec", "sourceVideoEndSec"],
  required_selected_scene_fields: ["selectedCandidateId", "selectedSourceVideoId", "selectedSourceStartSec", "selectedSourceEndSec"],
  ui_rule_after_import: "Bind/upload the real source video file to V1 before MP4 assembly.",
  backend_rule: "MP4 assembly needs a backend-uploaded path/asset; a local Windows path from JSON is a reference only.",
};

function isBlobUrl(value = "") {
  return String(value || "").trim().startsWith("blob:");
}

export function buildVideoMatchImportSignature(project = {}) {
  const source = project && typeof project === "object" ? project : {};
  const sourceVideoPath = String(
    source?.sourceVideo?.path
    || source?.source_video?.path
    || source?.sourceVideoPath
    || "",
  ).trim();
  const segments = Array.isArray(source.matchSegments) ? source.matchSegments : [];
  const first = segments[0] || {};
  const last = segments[Math.max(0, segments.length - 1)] || {};
  const audioDuration = toFiniteNumber(source?.audioPreviewMeta?.duration_sec ?? source?.timingContext?.audioDurationSec, 0).toFixed(3);
  const sourceVideoFilename = String(source?.sourceVideo?.filename || source?.source_video?.filename || "").trim();
  const firstId = String(first.id || first.audioSceneId || first.audio_scene_id || "").trim();
  const lastId = String(last.id || last.audioSceneId || last.audio_scene_id || "").trim();
  const firstTargetT0 = toFiniteNumber(first.targetStartSec ?? first.target_t0, 0).toFixed(3);
  const lastTargetT1 = toFiniteNumber(last.targetEndSec ?? last.target_t1, 0).toFixed(3);
  return [
    `schema:${String(source.schema || "").trim()}`,
    `status:${String(source.status || "").trim()}`,
    `segments:${segments.length}`,
    `first:${firstId}`,
    `last:${lastId}`,
    `target0:${firstTargetT0}`,
    `target1:${lastTargetT1}`,
    `audioDuration:${audioDuration}`,
    `sourcePath:${sourceVideoPath}`,
    `sourceFile:${sourceVideoFilename}`,
  ].join("|");
}

function getVideoMatchBoardAccountScopedStorageKey(baseKey = "") {
  return getAccountScopedStorageKey(baseKey);
}

export function getVideoMatchBoardNodeStorageKey(nodeId = "") {
  return getVideoMatchBoardAccountScopedStorageKey(`video_match_board:node:${String(nodeId || "default").trim() || "default"}`);
}

export function getVideoMatchBoardLastGoodStorageKey(nodeId = "") {
  return getVideoMatchBoardAccountScopedStorageKey(`video_match_board:last_good:${String(nodeId || "default").trim() || "default"}`);
}

export function getVideoMatchBoardEmergencyStorageKey(nodeId = "") {
  return getVideoMatchBoardAccountScopedStorageKey(`video_match_board:emergency:${String(nodeId || "default").trim() || "default"}`);
}

export function getVideoMatchBoardStoragePrefix() {
  return getVideoMatchBoardAccountScopedStorageKey("video_match_board:");
}

function getVideoMatchBoardActiveProjectStorageKey() {
  return getVideoMatchBoardAccountScopedStorageKey(VIDEO_MATCH_BOARD_ACTIVE_PROJECT_KEY);
}

function getVideoMatchBoardActiveProjectIdStorageKey() {
  return getVideoMatchBoardAccountScopedStorageKey(VIDEO_MATCH_BOARD_ACTIVE_PROJECT_ID_KEY);
}

export function safeReadVideoMatchJson(key) {
  try {
    const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}

function isQuotaStorageError(error) {
  const name = String(error?.name || "");
  const message = String(error?.message || "");
  return name.includes("QuotaExceeded") || message.includes("QuotaExceeded") || name === "NS_ERROR_DOM_QUOTA_REACHED";
}

function removeOldVideoMatchKeysForQuota(currentKey = "") {
  const removed = [];
  try {
    const prefix = getVideoMatchBoardStoragePrefix();
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && key.startsWith(prefix) && key !== currentKey) keys.push(key);
    }
    keys.sort((a, b) => {
      const score = (key) => {
        if (key.includes(":emergency:")) return 0;
        if (key.includes(":last_good:")) return 1;
        if (key.includes("ACTIVE_PROJECT")) return 2;
        return 3;
      };
      return score(a) - score(b);
    });
    keys.forEach((key) => {
      try {
        localStorage.removeItem(key);
        removed.push(key);
      } catch {}
    });
  } catch {}
  if (removed.length) console.warn("[VIDEO MATCH STORAGE QUOTA CLEANUP]", { currentKey, removed });
  return removed;
}

function safeWriteJson(key, value) {
  let serialized = "";
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    console.error("[VIDEO MATCH PROJECT SAVE ERROR]", { key, error, reason: "json_stringify_failed" });
    return { ok: false, error };
  }

  try {
    localStorage.setItem(key, serialized);
    try { sessionStorage.removeItem(key); } catch {}
    return { ok: true, bytes: serialized.length, storage: "localStorage" };
  } catch (error) {
    if (isQuotaStorageError(error)) {
      removeOldVideoMatchKeysForQuota(key);
      try {
        localStorage.setItem(key, serialized);
        try { sessionStorage.removeItem(key); } catch {}
        console.warn("[VIDEO MATCH STORAGE QUOTA RETRY_OK]", { key, bytes: serialized.length });
        return { ok: true, bytes: serialized.length, storage: "localStorage_after_cleanup" };
      } catch (retryError) {
        try {
          sessionStorage.setItem(key, serialized);
          console.warn("[VIDEO MATCH STORAGE SESSION_FALLBACK_OK]", {
            key,
            bytes: serialized.length,
            localStorageError: String(retryError?.message || retryError),
          });
          return { ok: true, bytes: serialized.length, storage: "sessionStorage", localStorageError: retryError };
        } catch (sessionError) {
          console.error("[VIDEO MATCH PROJECT SAVE ERROR]", { key, error: sessionError, localStorageError: retryError });
          return { ok: false, error: sessionError };
        }
      }
    }
    console.error("[VIDEO MATCH PROJECT SAVE ERROR]", { key, error });
    return { ok: false, error };
  }
}

function getVideoMatchProjectStorageDebugStats(project = {}) {
  const source = project && typeof project === "object" ? project : {};
  const matchSegmentsCount = Array.isArray(source.matchSegments) ? source.matchSegments.length : 0;
  const videoBlocksCount = Array.isArray(source.videoBlocks) ? source.videoBlocks.length : 0;
  const timingSegmentsCount = Array.isArray(source?.timingContext?.segments) ? source.timingContext.segments.length : 0;
  const audioMapSegmentsCount = Array.isArray(source?.audioMap?.segments) ? source.audioMap.segments.length : 0;
  return {
    matchSegmentsCount,
    videoBlocksCount,
    timingSegmentsCount,
    audioMapSegmentsCount,
    hasJsonInput: Boolean(source.jsonInput),
    jsonInputLength: String(source.jsonInput || "").length,
  };
}

function slimTimingSegments(rawSegments = []) {
  return buildTimingSegmentsFromVideoMatchSegments(rawSegments);
}

function createVideoMatchStorageSlimProject(project = {}) {
  const source = project && typeof project === "object" ? project : {};
  const timingContext = source?.timingContext && typeof source.timingContext === "object" ? source.timingContext : {};
  const audioMap = source?.audioMap && typeof source.audioMap === "object" ? source.audioMap : {};
  const audioMix = source?.audioMix && typeof source.audioMix === "object" ? source.audioMix : {};
  const sourceVideoUrl = String(source.sourceVideoUrl || "");
  const audioPreviewUrl = String(source.audioPreviewUrl || "");
  const backgroundAudioUrl = String(audioMix.backgroundAudioUrl || "");
  return {
    ...source,
    jsonInput: "",
    jsonInputPreview: String(source.jsonInputPreview || source.jsonInput || "").slice(0, 2000),
    jsonInputClearedAfterImport: true,
    assembledPreview: null,
    sourceVideoUrl: sourceVideoUrl.startsWith("blob:") ? "" : sourceVideoUrl,
    audioPreviewUrl: audioPreviewUrl.startsWith("blob:") ? "" : audioPreviewUrl,
    audioMix: {
      ...audioMix,
      backgroundAudioUrl: backgroundAudioUrl.startsWith("blob:") ? "" : backgroundAudioUrl,
    },
    timingContext: {
      ...timingContext,
      segments: slimTimingSegments(timingContext.segments),
      timingScenes: slimTimingSegments(timingContext.timingScenes),
    },
    audioMap: {
      ...audioMap,
      segments: slimTimingSegments(audioMap.segments),
    },
  };
}

function logVideoMatchSanitizeCheck(nodeId = "", storageKey = "", project = {}) {
  const sourceVideoUrl = String(project?.sourceVideoUrl || "").trim();
  const audioPreviewUrl = String(project?.audioPreviewUrl || "").trim();
  console.info("[VIDEO MATCH STORAGE SANITIZE CHECK]", {
    nodeId,
    storageKey,
    hasSourceBlob: isBlobUrl(sourceVideoUrl),
    hasAudioBlob: isBlobUrl(audioPreviewUrl),
    previewSourceNeedsReload: Boolean(project?.previewSourceNeedsReload),
    audioPreviewNeedsReload: Boolean(project?.audioPreviewNeedsReload),
  });
}

export function sanitizeVideoMatchProjectForStorage(project = {}) {
  const source = project && typeof project === "object" ? project : {};
  const sourceVideoUrl = String(source.sourceVideoUrl || "").trim();
  const audioPreviewUrl = String(source.audioPreviewUrl || "").trim();
  const backgroundAudioUrl = String(source?.audioMix?.backgroundAudioUrl || "").trim();
  const removedSourceBlob = isBlobUrl(sourceVideoUrl);
  const removedAudioBlob = isBlobUrl(audioPreviewUrl);
  const removedBackgroundBlob = isBlobUrl(backgroundAudioUrl);
  return {
    ...source,
    sourceVideoUrl: removedSourceBlob ? "" : sourceVideoUrl,
    audioPreviewUrl: removedAudioBlob ? "" : audioPreviewUrl,
    audioMix: getDefaultVideoMatchAudioMix({
      ...(source.audioMix || {}),
      backgroundAudioUrl: removedBackgroundBlob ? "" : backgroundAudioUrl,
      backgroundAudioNeedsReload: Boolean(source?.audioMix?.backgroundAudioNeedsReload || removedBackgroundBlob),
    }),
    previewSourceNeedsReload: Boolean(source.previewSourceNeedsReload || removedSourceBlob),
    audioPreviewNeedsReload: Boolean(source.audioPreviewNeedsReload || removedAudioBlob),
  };
}

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toNullableFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function clamp01(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(1, num));
}

export function getDefaultVideoMatchAudioMix(extra = {}) {
  return {
    originalVideoAudioMode: ["keep", "duck", "mute"].includes(String(extra.originalVideoAudioMode || ""))
      ? String(extra.originalVideoAudioMode)
      : "duck",
    originalVideoVolume: clamp01(extra.originalVideoVolume, 0.10),
    backgroundAudioUrl: String(extra.backgroundAudioUrl || ""),
    backgroundAudioPath: String(extra.backgroundAudioPath || ""),
    backgroundAudioFilename: String(extra.backgroundAudioFilename || ""),
    backgroundAudioVolume: clamp01(extra.backgroundAudioVolume, 0.6),
    backgroundAudioNeedsReload: toBool(extra.backgroundAudioNeedsReload),
    narrationVolume: clamp01(extra.narrationVolume, 1.0),
  };
}

function toBool(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value === null || value === undefined || value === "") return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n", ""].includes(normalized)) return false;
  }
  return false;
}

function isVideoMatchInsertedSilenceSegment(segment = {}) {
  return Boolean(segment?.is_silence)
    || Boolean(segment?.manual_intro_slot)
    || String(segment?.source_kind || "").toLowerCase() === "silence"
    || String(segment?.scene_type || "").toLowerCase() === "reserved_intro"
    || String(segment?.video_match_role || "").toLowerCase() === "reserved_intro"
    || String(segment?.translated_text_ru || "").trim() === "[тишина]"
    || String(segment?.original_text || "").trim() === "[тишина]";
}

function buildTimingSegmentsFromVideoMatchSegments(rawSegments = []) {
  return (Array.isArray(rawSegments) ? rawSegments : []).map((segment, index) => {
    const id = String(
      segment?.audio_scene_id
      || segment?.scene_id
      || segment?.id
      || `seg_${String(index + 1).padStart(2, "0")}`,
    ).trim();
    const targetStart = toFiniteNumber(
      segment?.target_t0
      ?? segment?.targetStartSec
      ?? segment?.start_sec
      ?? segment?.startSec,
      0,
    );
    const targetEnd = toFiniteNumber(
      segment?.target_t1
      ?? segment?.targetEndSec
      ?? segment?.end_sec
      ?? segment?.endSec,
      targetStart,
    );
    const duration = toFiniteNumber(
      segment?.duration_sec
      ?? segment?.durationSec
      ?? Math.max(0, targetEnd - targetStart),
      Math.max(0, targetEnd - targetStart),
    );
    const isSilence = isVideoMatchInsertedSilenceSegment(segment);
    const safeSourcePhraseIds = isSilence
      ? []
      : (Array.isArray(segment?.source_phrase_ids) ? segment.source_phrase_ids : []);
    const translatedTextRu = isSilence
      ? (String(segment?.translated_text_ru || "").trim() || "[тишина]")
      : String(segment?.translated_text_ru || "");
    const videoMatchRole = isSilence && String(segment?.video_match_role || "").trim() === "reserved_intro"
      ? "reserved_intro"
      : String(segment?.video_match_role || "");
    return {
      id,
      scene_id: String(segment?.scene_id || id),
      audio_scene_id: String(segment?.audio_scene_id || id),
      start_sec: targetStart,
      end_sec: targetEnd,
      target_t0: targetStart,
      target_t1: targetEnd,
      targetStartSec: targetStart,
      targetEndSec: targetEnd,
      duration_sec: duration,
      durationSec: duration,
      text: String(segment?.text || segment?.original_text || ""),
      original_text: String(segment?.original_text || segment?.text || ""),
      translated_text_ru: translatedTextRu,
      meaning_hint_ru: String(segment?.meaning_hint_ru || ""),
      source_phrase_ids: safeSourcePhraseIds,
      is_silence: isSilence,
      contains_vocal: isSilence ? false : Boolean(segment?.contains_vocal),
      source_kind: isSilence ? "silence" : String(segment?.source_kind || "audio"),
      route: String(segment?.route || ""),
      lip_sync_required: isSilence ? false : Boolean(segment?.lip_sync_required),
      audio_required: isSilence ? false : Boolean(segment?.audio_required),
      audio_slice_required: isSilence ? false : Boolean(segment?.audio_slice_required),
      video_match_role: videoMatchRole,
      user_scene_label: String(segment?.user_scene_label || ""),
      user_scene_tags: Array.isArray(segment?.user_scene_tags) ? segment.user_scene_tags : [],
      section: String(segment?.section || ""),
      speaker: String(segment?.speaker || ""),
      voice: String(segment?.voice || ""),
      notes: String(segment?.notes || ""),
    };
  });
}

function getLeadingInsertedSilenceSecFromTimingSegments(timingSegments = []) {
  let total = 0;
  for (const segment of (Array.isArray(timingSegments) ? timingSegments : [])) {
    if (!isVideoMatchInsertedSilenceSegment(segment)) break;
    total += toFiniteNumber(
      segment?.duration_sec ?? segment?.durationSec ?? Math.max(0, Number(segment?.target_t1 || 0) - Number(segment?.target_t0 || 0)),
      0,
    );
  }
  return Number(total.toFixed(3));
}

export function normalizeVideoMatchSourceVideo(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const sourceVideo = source.sourceVideo && typeof source.sourceVideo === "object"
    ? source.sourceVideo
    : (source.source_video && typeof source.source_video === "object" ? source.source_video : {});
  const path = String(
    sourceVideo.path
    || source.sourceVideoPath
    || source.source_video_path
    || source.source_video?.path
    || "",
  ).trim();
  const filename = String(
    sourceVideo.filename
    || sourceVideo.name
    || source.sourceVideoFilename
    || source.source_video?.filename
    || "",
  ).trim();
  const durationSec = Number(
    sourceVideo.durationSec
    || sourceVideo.duration_sec
    || source.sourceVideoDurationSec
    || source.source_video?.duration_sec
    || 0,
  );
  return {
    ...sourceVideo,
    path,
    filename,
    name: filename,
    durationSec,
    duration_sec: durationSec,
  };
}

export function normalizeVideoMatchTimingContext(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const audio = source.audio && typeof source.audio === "object" ? source.audio : {};
  const sourceAudioUrl = String(source.sourceAudioUrl || source.audioUrl || audio.url || "").trim();
  const audioDurationRaw = Number(source.audioDurationSec ?? source.audio_duration_sec ?? audio.duration_sec ?? audio.durationSec ?? 0);
  const timingScenes = Array.isArray(source.timingScenes)
    ? source.timingScenes
    : (Array.isArray(source.scenes) ? source.scenes : []);
  const segments = Array.isArray(source.segments)
    ? source.segments
    : (Array.isArray(source.audioSegments) ? source.audioSegments : []);
  const leadingInsertedSilenceSec = toFiniteNumber(
    source.leadingInsertedSilenceSec ?? source.leading_inserted_silence_sec,
    0,
  );
  return {
    sourceAudioUrl,
    audioDurationSec: Number.isFinite(audioDurationRaw) && audioDurationRaw > 0 ? Number(audioDurationRaw.toFixed(3)) : 0,
    timingScenes,
    segments,
    leadingInsertedSilenceSec,
    leading_inserted_silence_sec: leadingInsertedSilenceSec,
    manualTimingSeed: source.manualTimingSeed || source.manual_timing_seed || null,
    sourceOfTruth: String(source.sourceOfTruth || source.source_of_truth || ""),
    podcastEditManifest: source.podcastEditManifest || source.podcast_edit_manifest || null,
    composerEditManifest: source.composerEditManifest || source.composer_edit_manifest || null,
    sourceNodeId: String(source.sourceNodeId || source.nodeId || "").trim(),
    updatedAt: source.updatedAt || source.updated_at || Date.now(),
  };
}

export function buildVideoMatchTimingContextFromManualTimingNodeData(data = {}, nodeId = "") {
  const source = data && typeof data === "object" ? data : {};
  const audio = source.audio && typeof source.audio === "object" ? source.audio : {};
  const directorBoard = source.director_board && typeof source.director_board === "object" ? source.director_board : {};
  return normalizeVideoMatchTimingContext({
    sourceAudioUrl: audio.url || source.sourceAudioUrl || "",
    audioDurationSec: audio.duration_sec ?? audio.durationSec ?? source.audioDurationSec ?? 0,
    timingScenes: Array.isArray(source.scenes) ? source.scenes : [],
    segments: Array.isArray(source.segments) ? source.segments : (Array.isArray(source.markers) ? source.markers : []),
    podcastEditManifest: source.podcastEditManifest || source.podcast_edit_manifest || directorBoard.podcastEditManifest || directorBoard.podcast_edit_manifest || null,
    composerEditManifest: source.composerEditManifest || source.composer_edit_manifest || directorBoard.composerEditManifest || directorBoard.composer_edit_manifest || null,
    sourceNodeId: nodeId,
    updatedAt: source.updatedAt || Date.now(),
  });
}


function hasVideoMatchSourceVideoMetadata(sourceVideo = {}) {
  if (!sourceVideo || typeof sourceVideo !== "object") return false;
  return Boolean(String(sourceVideo.filename || "").trim())
    || Number(sourceVideo.duration_sec || sourceVideo.durationSec || 0) > 0
    || Number(sourceVideo.size || 0) > 0
    || Boolean(String(sourceVideo.type || sourceVideo.mimeType || "").trim());
}

function countVideoMatchCandidates(segments = []) {
  if (!Array.isArray(segments)) return 0;
  return segments.reduce((total, segment) => total + (Array.isArray(segment?.candidates) ? segment.candidates.length : 0), 0);
}

function hasVideoMatchTimingContext(timingContext = {}) {
  if (!timingContext || typeof timingContext !== "object") return false;
  return Boolean(String(timingContext.sourceAudioUrl || timingContext.audioUrl || "").trim())
    || Number(timingContext.audioDurationSec || timingContext.audio_duration_sec || 0) > 0
    || (Array.isArray(timingContext.timingScenes) && timingContext.timingScenes.length > 0)
    || (Array.isArray(timingContext.scenes) && timingContext.scenes.length > 0)
    || (Array.isArray(timingContext.segments) && timingContext.segments.length > 0)
    || Boolean(timingContext.podcastEditManifest || timingContext.composerEditManifest);
}

export function getVideoMatchProjectStats(project = {}) {
  const source = project && typeof project === "object" ? project : {};
  const matchSegments = Array.isArray(source.matchSegments) ? source.matchSegments : [];
  const videoBlocks = Array.isArray(source.videoBlocks) ? source.videoBlocks : [];
  const hasJsonInput = String(source.jsonInput || "").trim().length > 0;
  const matchSegmentsCount = matchSegments.length;
  const videoBlocksCount = videoBlocks.length;
  const candidatesTotal = countVideoMatchCandidates(matchSegments);
  const hasSourceVideoMetadata = hasVideoMatchSourceVideoMetadata(source.sourceVideo);
  const hasSourceVideoUrl = String(source.sourceVideoUrl || "").trim().length > 0;
  const hasTimingContext = hasVideoMatchTimingContext(source.timingContext);
  const materialScore = [
    hasJsonInput ? 20 : 0,
    matchSegmentsCount * 10,
    videoBlocksCount * 8,
    candidatesTotal * 4,
    hasSourceVideoMetadata ? 12 : 0,
    hasSourceVideoUrl ? 3 : 0,
    hasTimingContext ? 6 : 0,
  ].reduce((sum, value) => sum + value, 0);
  return {
    hasJsonInput,
    matchSegmentsCount,
    videoBlocksCount,
    candidatesTotal,
    hasSourceVideoMetadata,
    hasSourceVideoUrl,
    hasTimingContext,
    materialScore,
  };
}

function hasAnyVideoMatchMaterials(stats = {}) {
  return Boolean(stats.hasJsonInput)
    || Number(stats.matchSegmentsCount || 0) > 0
    || Number(stats.videoBlocksCount || 0) > 0
    || Number(stats.candidatesTotal || 0) > 0
    || Boolean(stats.hasSourceVideoMetadata)
    || Boolean(stats.hasTimingContext);
}

export function shouldSkipVideoMatchPersistToProtectMaterials(nextProject = {}, existingProject = {}, options = {}) {
  if (options?.explicitReset || options?.forceReplace || options?.allowMaterialLoss || options?.forceReplaceImportedJson) return false;
  if (!existingProject || typeof existingProject !== "object") return false;
  const nextStats = getVideoMatchProjectStats(nextProject);
  const existingStats = getVideoMatchProjectStats(existingProject);
  if (!hasAnyVideoMatchMaterials(existingStats)) return false;
  const nextSourcePath = String(
    nextProject?.sourceVideo?.path
    || nextProject?.sourceVideoPath
    || nextProject?.source_video?.path
    || "",
  ).trim();
  const existingSourcePath = String(
    existingProject?.sourceVideo?.path
    || existingProject?.sourceVideoPath
    || existingProject?.source_video?.path
    || "",
  ).trim();
  if (nextSourcePath) return false;
  if (String(existingSourcePath).startsWith("blob:") && nextSourcePath && !String(nextSourcePath).startsWith("blob:")) return false;

  const losesMaterials = (existingStats.hasJsonInput && !nextStats.hasJsonInput)
    || Number(nextStats.matchSegmentsCount || 0) < Number(existingStats.matchSegmentsCount || 0)
    || Number(nextStats.videoBlocksCount || 0) < Number(existingStats.videoBlocksCount || 0)
    || Number(nextStats.candidatesTotal || 0) < Number(existingStats.candidatesTotal || 0)
    || (existingStats.hasSourceVideoMetadata && !nextStats.hasSourceVideoMetadata)
    || (existingStats.hasTimingContext && !nextStats.hasTimingContext);
  const materiallyPoorer = Number(nextStats.materialScore || 0) < Number(existingStats.materialScore || 0);
  const onlyBlobUrlWasCleared = existingStats.hasSourceVideoUrl
    && !nextStats.hasSourceVideoUrl
    && String(existingProject?.sourceVideoUrl || "").startsWith("blob:")
    && !losesMaterials;

  if (!onlyBlobUrlWasCleared && (losesMaterials || materiallyPoorer)) {
    console.warn("[VIDEO MATCH PERSIST SKIPPED PROTECT_MATERIALS]", {
      nodeId: nextProject?.nodeId || existingProject?.nodeId || "",
      nextStats,
      existingStats,
      options,
    });
    return true;
  }
  return false;
}

export function getDefaultVideoMatchBoardProject(nodeId = "", extra = {}) {
  const safeNodeId = String(nodeId || "default").trim() || "default";
  const now = Date.now();
  const defaultAudioMix = getDefaultVideoMatchAudioMix(extra.audioMix || {});
  return {
    projectId: `video_match_board_${safeNodeId}`,
    schema: VIDEO_MATCH_BOARD_SCHEMA_V2,
    nodeId: safeNodeId,
    sourceNodeId: safeNodeId,
    sourceVideo: { filename: "", duration_sec: 0 },
    sourceVideoUrl: "",
    sourceVideos: [],
    timingContext: normalizeVideoMatchTimingContext(extra.timingContext || {}),
    matchSegments: [],
    videoBlocks: [],
    selectedSegmentId: "",
    selectedCandidateId: "",
    selectedBlockId: "",
    jsonInput: "",
    jsonError: "",
    audioMix: defaultAudioMix,
    createdAt: now,
    updatedAt: now,
    ...extra,
    audioMix: getDefaultVideoMatchAudioMix({
      ...(extra.audioMix || {}),
    }),
  };
}

export function normalizeVideoMatchCandidate(candidate = {}, segment = {}, sourceVideoUrl = "", index = 0) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const segmentId = String(segment.id || segment.audioSceneId || segment.audio_scene_id || `segment_${String(index + 1).padStart(3, "0")}`).trim();
  const id = String(source.id || source.candidateId || source.candidate_id || source.candidate_id || `${segmentId}_candidate_${String(index + 1).padStart(2, "0")}`).trim();
  const sourceVideoId = String(source.sourceVideoId || source.source_video_id || source.source_id || source.sourceId || segment.sourceVideoId || segment.source_video_id || segment.selectedSourceVideoId || segment.selected_source_video_id || "V1").trim() || "V1";
  const warnings = Array.isArray(source.warnings) ? source.warnings.map((warning) => String(warning || "").trim()).filter(Boolean) : [];
  const sourceCandidateStartSec = toFiniteNumber(source.source_video_start_sec ?? source.sourceVideoStartSec ?? source.video_t0, 0);
  const sourceCandidateEndSec = toFiniteNumber(source.source_video_end_sec ?? source.sourceVideoEndSec ?? source.video_t1, 0);
  const clipSourceStartSec = toNullableFiniteNumber(source.clip_source_start_sec ?? source.clipSourceStartSec);
  const clipSourceEndSec = toNullableFiniteNumber(source.clip_source_end_sec ?? source.clipSourceEndSec);
  const sourceKind = String(source.sourceKind || source.source_kind || "").trim().toLowerCase();
  const status = String(source.status || "").trim().toLowerCase();
  const role = String(source.role || "").trim().toLowerCase();
  const candidateType = String(source.candidateType || source.candidate_type || "").trim().toLowerCase();
  const reservedGeneratedLipsync = toBool(source.reservedGeneratedLipsync ?? source.reserved_generated_lipsync)
    || sourceKind === "reserved_generated_lipsync"
    || status === "reserved_generated_lipsync"
    || role === "reserved_generated_lipsync"
    || candidateType === "generated_lipsync_insert";
  return {
    id,
    candidateId: id,
    segmentId,
    sourceVideoId,
    source_video_id: sourceVideoId,
    sourceVideoLabel: String(source.sourceVideoLabel || source.source_video_label || source.video_label || "").trim(),
    source_video_label: String(source.source_video_label || source.sourceVideoLabel || source.video_label || "").trim(),
    sourceVideoFilename: String(source.sourceVideoFilename || source.source_video_filename || source.filename || "").trim(),
    source_video_filename: String(source.source_video_filename || source.sourceVideoFilename || source.filename || "").trim(),
    sourceVideoPath: String(source.sourceVideoPath || source.source_video_path || "").trim(),
    source_video_path: String(source.source_video_path || source.sourceVideoPath || "").trim(),
    videoStartSec: toFiniteNumber(source.video_t0 ?? source.videoStartSec ?? source.sourceVideoStartSec ?? source.source_video_start_sec, 0),
    videoEndSec: toFiniteNumber(source.video_t1 ?? source.videoEndSec ?? source.sourceVideoEndSec ?? source.source_video_end_sec, 0),
    sourceVideoStartSec: clipSourceStartSec ?? toFiniteNumber(source.video_t0 ?? source.videoStartSec ?? source.sourceVideoStartSec ?? source.source_video_start_sec, 0),
    sourceVideoEndSec: clipSourceEndSec ?? toFiniteNumber(source.video_t1 ?? source.videoEndSec ?? source.sourceVideoEndSec ?? source.source_video_end_sec, 0),
    sourceCandidateStartSec,
    sourceCandidateEndSec,
    clipSourceStartSec,
    clipSourceEndSec,
    clip_source_start_sec: clipSourceStartSec,
    clip_source_end_sec: clipSourceEndSec,
    fitMode: String(source.fit_mode || source.fitMode || "").trim(),
    confidence: toNullableFiniteNumber(source.confidence),
    matchReason: String(source.match_reason || source.matchReason || source.visual_reason_ru || "").trim(),
    visualType: String(source.visual_type || source.visualType || source.visual_role || "").trim(),
    shotType: String(source.shot_type || source.shotType || source.shot_role || "").trim(),
    emotion: String(source.emotion || "").trim(),
    action: String(source.action || "").trim(),
    containsFace: toBool(source.contains_face ?? source.containsFace),
    mouthVisible: toBool(source.mouth_visible ?? source.mouthVisible),
    lipSyncCandidate: toBool(source.lip_sync_candidate ?? source.lipSyncCandidate),
    dialoguePresent: toBool(source.dialogue_present ?? source.dialoguePresent),
    motionLevel: String(source.motion_level || source.motionLevel || "").trim(),
    cameraMotion: String(source.camera_motion || source.cameraMotion || source.motion_type || "").trim(),
    thumbnail: String(source.thumbnail || "").trim(),
    warnings,
    candidateType,
    sourceKind,
    status,
    role,
    overrideVideoPath: String(source.overrideVideoPath || source.override_video_path || "").trim(),
    overrideVideoUrl: String(source.overrideVideoUrl || source.override_video_url || "").trim(),
    overrideDurationSec: toNullableFiniteNumber(source.overrideDurationSec ?? source.override_duration_sec),
    sourceVideoUrl: String(source.sourceVideoUrl || sourceVideoUrl || "").trim(),
    reservedGeneratedLipsync,
    reserved_generated_lipsync: reservedGeneratedLipsync,
    useRealSourceClip: reservedGeneratedLipsync ? false : toBool(source.useRealSourceClip ?? source.use_real_source_clip),
    use_real_source_clip: reservedGeneratedLipsync ? false : toBool(source.useRealSourceClip ?? source.use_real_source_clip),
    visualFamily: String(source.visualFamily || source.visual_family || "").trim(),
    visual_family: String(source.visual_family || source.visualFamily || "").trim(),
    sourceUsageKey: String(source.sourceUsageKey || source.source_usage_key || "").trim(),
    source_usage_key: String(source.source_usage_key || source.sourceUsageKey || "").trim(),
    cleanCutStatus: String(source.cleanCutStatus || source.clean_cut_status || "").trim(),
    clean_cut_status: String(source.clean_cut_status || source.cleanCutStatus || "").trim(),
    eventAnchor: String(source.eventAnchor || source.event_anchor || "").trim(),
    event_anchor: String(source.event_anchor || source.eventAnchor || "").trim(),
    selectedIsReused: toBool(source.selectedIsReused ?? source.selected_is_reused),
    selected_is_reused: toBool(source.selectedIsReused ?? source.selected_is_reused),
    selectedReuseReason: String(source.selectedReuseReason || source.selected_reuse_reason || "").trim(),
    selected_reuse_reason: String(source.selected_reuse_reason || source.selectedReuseReason || "").trim(),
    forceMuteVideoAudio: source.forceMuteVideoAudio ?? source.force_mute_video_audio,
    force_mute_video_audio: source.force_mute_video_audio ?? source.forceMuteVideoAudio,
    originalVideoVolume: clamp01(source.originalVideoVolume ?? source.original_video_volume, 0.10),
    original_video_volume: clamp01(source.original_video_volume ?? source.originalVideoVolume, 0.10),
    ls_id: String(source.ls_id || source.lip_id || "").trim(),
    lip_id: String(source.lip_id || source.ls_id || "").trim(),
    sourceVideoReferenceOnly: source.sourceVideoReferenceOnly || source.source_video_reference_only || {},
    source_video_reference_only: source.source_video_reference_only || source.sourceVideoReferenceOnly || {},
  };
}


function getReferenceRangeSec(reference = {}) {
  const source = reference && typeof reference === "object" ? reference : {};
  return {
    start: toFiniteNumber(source.source_video_start_sec ?? source.sourceVideoStartSec ?? source.video_t0, 0),
    end: toFiniteNumber(source.source_video_end_sec ?? source.sourceVideoEndSec ?? source.video_t1, 0),
  };
}

export function normalizeVideoMatchSegment(segment = {}, index = 0, sourceVideoUrl = "") {
  const source = segment && typeof segment === "object" ? segment : {};
  const audioSceneId = String(source.audio_scene_id || source.audioSceneId || source.id || `segment_${String(index + 1).padStart(3, "0")}`).trim();
  const storySceneId = String(source.story_scene_id ?? source.storySceneId ?? "").trim();
  const id = audioSceneId || `segment_${String(index + 1).padStart(3, "0")}`;
  const segmentSourceVideoId = String(source.sourceVideoId || source.source_video_id || source.selectedSourceVideoId || source.selected_source_video_id || "V1").trim() || "V1";
  const baseSegment = { id, audioSceneId, storySceneId, sourceVideoId: segmentSourceVideoId, source_video_id: segmentSourceVideoId };
  const rawCandidates = Array.isArray(source.candidates) ? source.candidates : [];
  const rawSelectedCandidate = source.selected_candidate && typeof source.selected_candidate === "object"
    ? source.selected_candidate
    : (source.selectedCandidate && typeof source.selectedCandidate === "object" ? source.selectedCandidate : {});
  const route = String(source.route || "").trim().toLowerCase();
  const lipSyncRequired = toBool(source.lip_sync_required);
  const reservedGeneratedLipsync = toBool(source.reserved_generated_lipsync ?? source.reservedGeneratedLipsync)
    || String(source.video_match_role || "").trim().toLowerCase() === "reserved_generated_lipsync"
    || (route === "ia2v" && lipSyncRequired);
  const useRealSourceClip = toBool(source.use_real_source_clip ?? source.useRealSourceClip);
  const sourceVisualReference = source.source_visual_reference || source.sourceVisualReference || {};
  const candidates = rawCandidates.map((candidate, candidateIndex) => normalizeVideoMatchCandidate(candidate, baseSegment, sourceVideoUrl, candidateIndex));
  if (reservedGeneratedLipsync && candidates.length === 0) {
    const generatedInsertId = String(rawSelectedCandidate.generated_insert_id || rawSelectedCandidate.generatedInsertId || `${audioSceneId}_generated_lipsync`).trim();
    candidates.push(normalizeVideoMatchCandidate({
      id: generatedInsertId,
      candidateType: "generated_lipsync_insert",
      reserved_generated_lipsync: true,
      reservedGeneratedLipsync: true,
      use_real_source_clip: false,
      useRealSourceClip: false,
      source_video_reference_only: rawSelectedCandidate.source_video_reference_only || rawSelectedCandidate.sourceVideoReferenceOnly || sourceVisualReference || {},
      sourceVideoReferenceOnly: rawSelectedCandidate.sourceVideoReferenceOnly || rawSelectedCandidate.source_video_reference_only || sourceVisualReference || {},
      sourceVideoStartSec: getReferenceRangeSec(rawSelectedCandidate.source_video_reference_only || rawSelectedCandidate.sourceVideoReferenceOnly || sourceVisualReference).start,
      sourceVideoEndSec: getReferenceRangeSec(rawSelectedCandidate.source_video_reference_only || rawSelectedCandidate.sourceVideoReferenceOnly || sourceVisualReference).end,
      visual_type: rawSelectedCandidate.visual_type || source.visual_type || source.visual_role || "",
    }, baseSegment, sourceVideoUrl, 0));
  }
  const rawSelectedCandidateId = String(
    source.selected_candidate_id
    ?? source.selectedCandidateId
    ?? source.selected_candidate?.candidate_id
    ?? source.selected_candidate?.id
    ?? source.selectedCandidate?.candidate_id
    ?? source.selectedCandidate?.id
    ?? "",
  ).trim();
  const normalizedSelectedCandidate = rawSelectedCandidateId
    ? normalizeVideoMatchCandidate({ ...rawSelectedCandidate, id: rawSelectedCandidateId, candidate_id: rawSelectedCandidateId }, baseSegment, sourceVideoUrl, candidates.length)
    : null;
  if (normalizedSelectedCandidate && !candidates.some((candidate) => candidate.id === normalizedSelectedCandidate.id)) {
    candidates.push(normalizedSelectedCandidate);
  }
  const selectedCandidateId = candidates.some((candidate) => candidate.id === rawSelectedCandidateId)
    ? rawSelectedCandidateId
    : (candidates[0]?.id || rawSelectedCandidateId);
  const selectedCandidate = candidates.find((candidate) => candidate.id === selectedCandidateId) || null;
  const finalReservedGeneratedLipsync = reservedGeneratedLipsync || Boolean(selectedCandidate?.reservedGeneratedLipsync);
  return {
    id,
    audioSceneId,
    audio_scene_id: audioSceneId,
    storySceneId,
    story_scene_id: storySceneId,
    sourceVideoId: segmentSourceVideoId,
    source_video_id: segmentSourceVideoId,
    selectedSourceVideoId: String(source.selectedSourceVideoId || source.selected_source_video_id || segmentSourceVideoId).trim() || segmentSourceVideoId,
    selected_source_video_id: String(source.selected_source_video_id || source.selectedSourceVideoId || segmentSourceVideoId).trim() || segmentSourceVideoId,
    selectedSourceStartSec: toNullableFiniteNumber(source.selectedSourceStartSec ?? source.selected_source_start_sec),
    selected_source_start_sec: toNullableFiniteNumber(source.selected_source_start_sec ?? source.selectedSourceStartSec),
    selectedSourceEndSec: toNullableFiniteNumber(source.selectedSourceEndSec ?? source.selected_source_end_sec),
    selected_source_end_sec: toNullableFiniteNumber(source.selected_source_end_sec ?? source.selectedSourceEndSec),
    targetStartSec: toFiniteNumber(source.target_t0 ?? source.targetStartSec, 0),
    targetEndSec: toFiniteNumber(source.target_t1 ?? source.targetEndSec, 0),
    text: String(source.text || "").trim(),
    mood: String(source.mood || "").trim(),
    visualNeed: String(source.visual_need || source.visualNeed || "").trim(),
    reservedGeneratedLipsync: finalReservedGeneratedLipsync,
    reserved_generated_lipsync: finalReservedGeneratedLipsync,
    useRealSourceClip,
    use_real_source_clip: useRealSourceClip,
    sourceVisualReference,
    source_visual_reference: sourceVisualReference,
    visualFamily: String(source.visualFamily || source.visual_family || "").trim(),
    visual_family: String(source.visual_family || source.visualFamily || "").trim(),
    sourceUsageKey: String(source.sourceUsageKey || source.source_usage_key || "").trim(),
    source_usage_key: String(source.source_usage_key || source.sourceUsageKey || "").trim(),
    cleanCutStatus: String(source.cleanCutStatus || source.clean_cut_status || "").trim(),
    clean_cut_status: String(source.clean_cut_status || source.cleanCutStatus || "").trim(),
    eventAnchor: String(source.eventAnchor || source.event_anchor || "").trim(),
    event_anchor: String(source.event_anchor || source.eventAnchor || "").trim(),
    route,
    lip_sync_required: lipSyncRequired,
    audio_required: toBool(source.audio_required),
    audio_slice_required: toBool(source.audio_slice_required),
    video_match_role: String(source.video_match_role || "").trim(),
    manual_lipsync_override: toBool(source.manual_lipsync_override),
    user_scene_label: String(source.user_scene_label || "").trim(),
    user_scene_tags: Array.isArray(source.user_scene_tags) ? source.user_scene_tags : [],
    scene_type: String(source.scene_type || "").trim(),
    reserved_for_user_override: toBool(source.reserved_for_user_override),
    reserved_reason: String(source.reserved_reason || "").trim(),
    codex_broll_match_allowed: toBool(source.codex_broll_match_allowed),
    selectedIsReused: toBool(source.selectedIsReused ?? source.selected_is_reused),
    selected_is_reused: toBool(source.selectedIsReused ?? source.selected_is_reused),
    selectedReuseReason: String(source.selectedReuseReason || source.selected_reuse_reason || "").trim(),
    selected_reuse_reason: String(source.selected_reuse_reason || source.selectedReuseReason || "").trim(),
    selectedCandidateRaw: rawSelectedCandidate,
    selected_candidate: rawSelectedCandidate,
    selectedCandidateId,
    selected_candidate_id: selectedCandidateId,
    candidates,
  };
}

export function normalizeVideoBlock(match = {}, sourceVideoUrl = "") {
  const id = String(match.id || match.candidateId || `match_${Date.now()}`).trim();
  const sceneType = String(match.scene_type || match.sceneType || "").trim().toLowerCase();
  const matchRole = String(match.video_match_role || match.videoMatchRole || "").trim().toLowerCase();
  const sourceKind = String(match.sourceKind || match.source_kind || "").trim().toLowerCase();
  const candidateType = String(match.candidateType || match.candidate_type || "").trim().toLowerCase();
  const lipSyncRequired = toBool(match.lip_sync_required ?? match.lipSyncRequired);
  const reservedGeneratedLipsync = toBool(match.reservedGeneratedLipsync ?? match.reserved_generated_lipsync)
    || sceneType.includes("lipsync")
    || sceneType.includes("lip_sync")
    || matchRole.includes("lipsync")
    || matchRole.includes("lip_sync")
    || sourceKind.includes("lipsync")
    || sourceKind.includes("lip_sync")
    || candidateType === "generated_lipsync_insert";
  const isLipSyncScene = String(match.route || "").trim().toLowerCase() === "ia2v"
    || lipSyncRequired
    || reservedGeneratedLipsync
    || toBool(match.manual_lipsync_override);
  const isOverride = sourceKind === "override_video" || Boolean(match.overrideVideoPath || match.override_video_path || match.overrideVideoUrl || match.override_video_url);
  const explicitForceMute = match.forceMuteVideoAudio ?? match.force_mute_video_audio;
  const forceMuteVideoAudio = explicitForceMute !== undefined && explicitForceMute !== null
    ? toBool(explicitForceMute)
    : Boolean(isLipSyncScene && isOverride);
  return {
    id,
    segmentId: String(match.segmentId || match.audioSceneId || match.audio_scene_id || "").trim(),
    candidateId: String(match.candidateId || match.id || "").trim(),
    audioSceneId: String(match.audio_scene_id || match.audioSceneId || match.segmentId || "").trim(),
    storySceneId: String(match.story_scene_id ?? match.storySceneId ?? "").trim(),
    story_scene_id: String(match.story_scene_id ?? match.storySceneId ?? "").trim(),
    sourceVideoId: String(match.sourceVideoId || match.source_video_id || match.sourceId || match.source_id || "").trim(),
    source_video_id: String(match.source_video_id || match.sourceVideoId || match.source_id || match.sourceId || "").trim(),
    sourceVideoLabel: String(match.sourceVideoLabel || match.source_video_label || "").trim(),
    source_video_label: String(match.source_video_label || match.sourceVideoLabel || "").trim(),
    sourceVideoFilename: String(match.sourceVideoFilename || match.source_video_filename || "").trim(),
    source_video_filename: String(match.source_video_filename || match.sourceVideoFilename || "").trim(),
    sourceVideoPath: String(match.sourceVideoPath || match.source_video_path || "").trim(),
    source_video_path: String(match.source_video_path || match.sourceVideoPath || "").trim(),
    targetStartSec: toFiniteNumber(match.target_t0 ?? match.targetStartSec, 0),
    targetEndSec: toFiniteNumber(match.target_t1 ?? match.targetEndSec, 0),
    sourceVideoStartSec: toFiniteNumber(match.video_t0 ?? match.sourceVideoStartSec ?? match.videoStartSec, 0),
    sourceVideoEndSec: toFiniteNumber(match.video_t1 ?? match.sourceVideoEndSec ?? match.videoEndSec, 0),
    sourceCandidateStartSec: toNullableFiniteNumber(match.sourceCandidateStartSec ?? match.source_candidate_start_sec),
    sourceCandidateEndSec: toNullableFiniteNumber(match.sourceCandidateEndSec ?? match.source_candidate_end_sec),
    clipSourceStartSec: toNullableFiniteNumber(match.clipSourceStartSec ?? match.clip_source_start_sec),
    clipSourceEndSec: toNullableFiniteNumber(match.clipSourceEndSec ?? match.clip_source_end_sec),
    clip_source_start_sec: toNullableFiniteNumber(match.clipSourceStartSec ?? match.clip_source_start_sec),
    clip_source_end_sec: toNullableFiniteNumber(match.clipSourceEndSec ?? match.clip_source_end_sec),
    visualFamily: String(match.visualFamily || match.visual_family || "").trim(),
    visual_family: String(match.visual_family || match.visualFamily || "").trim(),
    sourceUsageKey: String(match.sourceUsageKey || match.source_usage_key || "").trim(),
    source_usage_key: String(match.source_usage_key || match.sourceUsageKey || "").trim(),
    cleanCutStatus: String(match.cleanCutStatus || match.clean_cut_status || "").trim(),
    clean_cut_status: String(match.clean_cut_status || match.cleanCutStatus || "").trim(),
    eventAnchor: String(match.eventAnchor || match.event_anchor || "").trim(),
    event_anchor: String(match.event_anchor || match.eventAnchor || "").trim(),
    selectedIsReused: toBool(match.selectedIsReused ?? match.selected_is_reused),
    selected_is_reused: toBool(match.selectedIsReused ?? match.selected_is_reused),
    selectedReuseReason: String(match.selectedReuseReason || match.selected_reuse_reason || "").trim(),
    selected_reuse_reason: String(match.selected_reuse_reason || match.selectedReuseReason || "").trim(),
    sourceVideoUrl: String(match.sourceVideoUrl || sourceVideoUrl || "").trim(),
    matchReason: String(match.match_reason || match.matchReason || "").trim(),
    confidence: toNullableFiniteNumber(match.confidence),
    route: String(match.route || "").trim(),
    lip_sync_required: lipSyncRequired,
    lipSyncRequired,
    reservedGeneratedLipsync,
    reserved_generated_lipsync: reservedGeneratedLipsync,
    manual_lipsync_override: toBool(match.manual_lipsync_override),
    video_match_role: String(match.video_match_role || match.videoMatchRole || "").trim(),
    videoMatchRole: String(match.videoMatchRole || match.video_match_role || "").trim(),
    scene_type: String(match.scene_type || match.sceneType || "").trim(),
    sceneType: String(match.sceneType || match.scene_type || "").trim(),
    candidateType: String(match.candidateType || match.candidate_type || "").trim(),
    sourceKind: String(match.sourceKind || match.source_kind || "").trim(),
    overrideVideoPath: String(match.overrideVideoPath || match.override_video_path || "").trim(),
    overrideVideoUrl: String(match.overrideVideoUrl || match.override_video_url || "").trim(),
    forceMuteVideoAudio,
    force_mute_video_audio: forceMuteVideoAudio,
    originalVideoVolume: clamp01(match.originalVideoVolume ?? match.original_video_volume, 0.10),
    original_video_volume: clamp01(match.original_video_volume ?? match.originalVideoVolume, 0.10),
    ls_id: String(match.ls_id || match.lip_id || "").trim(),
    lip_id: String(match.lip_id || match.ls_id || "").trim(),
  };
}

export function buildVideoBlocksFromMatchSegments(matchSegments = [], sourceVideoUrl = "") {
  if (!Array.isArray(matchSegments)) return [];
  return matchSegments
    .map((segment, index) => {
      const normalizedSegment = normalizeVideoMatchSegment(segment, index, sourceVideoUrl);
      const selectedCandidate = normalizedSegment.candidates.find((candidate) => candidate.id === normalizedSegment.selectedCandidateId) || normalizedSegment.candidates[0];
      if (!selectedCandidate) return null;
      const isOverride = selectedCandidate.sourceKind === "override_video"
        || selectedCandidate.overrideVideoPath
        || selectedCandidate.overrideVideoUrl;
      return normalizeVideoBlock({
        id: selectedCandidate.id,
        candidateId: selectedCandidate.id,
        segmentId: normalizedSegment.id,
        audioSceneId: normalizedSegment.audioSceneId,
        storySceneId: normalizedSegment.storySceneId,
        story_scene_id: normalizedSegment.story_scene_id,
        targetStartSec: normalizedSegment.targetStartSec,
        targetEndSec: normalizedSegment.targetEndSec,
        sourceVideoStartSec: isOverride ? 0 : selectedCandidate.sourceVideoStartSec,
        sourceVideoEndSec: isOverride
          ? toFiniteNumber(selectedCandidate.overrideDurationSec ?? selectedCandidate.sourceVideoEndSec, selectedCandidate.sourceVideoEndSec)
          : selectedCandidate.sourceVideoEndSec,
        sourceCandidateStartSec: selectedCandidate.sourceCandidateStartSec,
        sourceCandidateEndSec: selectedCandidate.sourceCandidateEndSec,
        clipSourceStartSec: selectedCandidate.clipSourceStartSec,
        clipSourceEndSec: selectedCandidate.clipSourceEndSec,
        sourceVideoUrl: selectedCandidate.sourceVideoUrl || sourceVideoUrl,
        sourceVideoId: selectedCandidate.sourceVideoId || selectedCandidate.source_video_id || normalizedSegment.sourceVideoId || normalizedSegment.source_video_id || "",
        source_video_id: selectedCandidate.source_video_id || selectedCandidate.sourceVideoId || normalizedSegment.source_video_id || normalizedSegment.sourceVideoId || "",
        sourceVideoLabel: selectedCandidate.sourceVideoLabel || selectedCandidate.source_video_label || "",
        source_video_label: selectedCandidate.source_video_label || selectedCandidate.sourceVideoLabel || "",
        sourceVideoFilename: selectedCandidate.sourceVideoFilename || selectedCandidate.source_video_filename || "",
        source_video_filename: selectedCandidate.source_video_filename || selectedCandidate.sourceVideoFilename || "",
        sourceVideoPath: selectedCandidate.sourceVideoPath || selectedCandidate.source_video_path || "",
        source_video_path: selectedCandidate.source_video_path || selectedCandidate.sourceVideoPath || "",
        matchReason: selectedCandidate.matchReason,
        confidence: selectedCandidate.confidence,
        candidateType: selectedCandidate.candidateType,
        sourceKind: isOverride ? "override_video" : selectedCandidate.sourceKind,
        overrideVideoPath: selectedCandidate.overrideVideoPath,
        overrideVideoUrl: selectedCandidate.overrideVideoUrl,
        visualFamily: selectedCandidate.visualFamily || normalizedSegment.visualFamily,
        visual_family: selectedCandidate.visual_family || normalizedSegment.visual_family,
        sourceUsageKey: selectedCandidate.sourceUsageKey || normalizedSegment.sourceUsageKey,
        source_usage_key: selectedCandidate.source_usage_key || normalizedSegment.source_usage_key,
        cleanCutStatus: selectedCandidate.cleanCutStatus || normalizedSegment.cleanCutStatus,
        clean_cut_status: selectedCandidate.clean_cut_status || normalizedSegment.clean_cut_status,
        eventAnchor: selectedCandidate.eventAnchor || normalizedSegment.eventAnchor,
        event_anchor: selectedCandidate.event_anchor || normalizedSegment.event_anchor,
        selectedIsReused: selectedCandidate.selectedIsReused ?? normalizedSegment.selectedIsReused,
        selected_is_reused: selectedCandidate.selected_is_reused ?? normalizedSegment.selected_is_reused,
        selectedReuseReason: selectedCandidate.selectedReuseReason || normalizedSegment.selectedReuseReason,
        selected_reuse_reason: selectedCandidate.selected_reuse_reason || normalizedSegment.selected_reuse_reason,
        originalVideoVolume: selectedCandidate.originalVideoVolume ?? selectedCandidate.original_video_volume ?? normalizedSegment.originalVideoVolume ?? normalizedSegment.original_video_volume,
        original_video_volume: selectedCandidate.original_video_volume ?? selectedCandidate.originalVideoVolume ?? normalizedSegment.original_video_volume ?? normalizedSegment.originalVideoVolume,
        forceMuteVideoAudio: selectedCandidate.forceMuteVideoAudio ?? selectedCandidate.force_mute_video_audio ?? normalizedSegment.forceMuteVideoAudio ?? normalizedSegment.force_mute_video_audio,
        force_mute_video_audio: selectedCandidate.force_mute_video_audio ?? selectedCandidate.forceMuteVideoAudio ?? normalizedSegment.force_mute_video_audio ?? normalizedSegment.forceMuteVideoAudio,
        route: normalizedSegment.route,
        lip_sync_required: normalizedSegment.lip_sync_required,
        lipSyncRequired: normalizedSegment.lipSyncRequired,
        reservedGeneratedLipsync: normalizedSegment.reservedGeneratedLipsync || normalizedSegment.reserved_generated_lipsync || selectedCandidate.reservedGeneratedLipsync || selectedCandidate.reserved_generated_lipsync,
        reserved_generated_lipsync: normalizedSegment.reservedGeneratedLipsync || normalizedSegment.reserved_generated_lipsync || selectedCandidate.reservedGeneratedLipsync || selectedCandidate.reserved_generated_lipsync,
        video_match_role: normalizedSegment.video_match_role,
        videoMatchRole: normalizedSegment.videoMatchRole,
        scene_type: normalizedSegment.scene_type,
        sceneType: normalizedSegment.sceneType,
        manual_lipsync_override: normalizedSegment.manual_lipsync_override,
        ls_id: selectedCandidate.ls_id || selectedCandidate.lip_id || normalizedSegment.ls_id || "",
        lip_id: selectedCandidate.lip_id || selectedCandidate.ls_id || "",
      }, sourceVideoUrl);
    })
    .filter(Boolean);
}

function normalizeV1MatchAsSegment(match = {}, index = 0, sourceVideoUrl = "") {
  const source = match && typeof match === "object" ? match : {};
  const audioSceneId = String(source.audio_scene_id || source.audioSceneId || source.segmentId || `seg_${String(index + 1).padStart(2, "0")}`).trim();
  const candidateId = String(source.id || source.candidate_id || `${audioSceneId}_candidate_01`).trim();
  return normalizeVideoMatchSegment({
    audio_scene_id: audioSceneId,
    target_t0: source.target_t0 ?? source.targetStartSec ?? 0,
    target_t1: source.target_t1 ?? source.targetEndSec ?? 0,
    selected_candidate_id: candidateId,
    candidates: [{
      ...source,
      id: candidateId,
      video_t0: source.video_t0 ?? source.sourceVideoStartSec ?? source.videoStartSec ?? 0,
      video_t1: source.video_t1 ?? source.sourceVideoEndSec ?? source.videoEndSec ?? 0,
    }],
  }, index, sourceVideoUrl);
}


function normalizeVideoMatchSourceVideos(parsed = {}) {
  const rawList = Array.isArray(parsed?.source_videos)
    ? parsed.source_videos
    : (Array.isArray(parsed?.sourceVideos) ? parsed.sourceVideos : []);
  const sourceVideoObject = parsed?.source_video && typeof parsed.source_video === "object"
    ? parsed.source_video
    : (parsed?.sourceVideo && typeof parsed.sourceVideo === "object" ? parsed.sourceVideo : {});
  const fallbackPath = String(parsed?.sourceVideoPath || parsed?.source_video_path || sourceVideoObject?.path || sourceVideoObject?.sourceVideoPath || sourceVideoObject?.source_video_path || "").trim();
  const fallback = Object.keys(sourceVideoObject || {}).length || fallbackPath
    ? [{ id: "V1", sourceVideoId: "V1", source_video_id: "V1", ...sourceVideoObject, path: fallbackPath || sourceVideoObject.path || "" }]
    : [];
  const list = rawList.length ? rawList : fallback;
  return list.slice(0, 5).map((item, index) => {
    const source = item && typeof item === "object" ? item : {};
    const id = String(source.id || source.source_video_id || source.sourceVideoId || `V${String(index + 1)}`).trim() || `V${String(index + 1)}`;
    return {
      id,
      sourceVideoId: id,
      source_video_id: id,
      label: String(source.label || source.source_video_label || source.sourceVideoLabel || `video_${String(index + 1).padStart(2, "0")}`).trim(),
      filename: String(source.filename || source.name || source.fileName || "").trim(),
      path: String(source.path || source.local_path || source.localPath || source.sourceVideoPath || source.source_video_path || source.backendPath || source.backend_path || source.sourceVideoPathForAssembly || source.source_video_path_for_assembly || "").trim(),
      backendPath: String(source.backendPath || source.backend_path || source.sourceVideoPathForAssembly || source.source_video_path_for_assembly || source.path || source.sourceVideoPath || source.source_video_path || "").trim(),
      backend_path: String(source.backend_path || source.backendPath || source.source_video_path_for_assembly || source.sourceVideoPathForAssembly || source.path || source.source_video_path || source.sourceVideoPath || "").trim(),
      sourceVideoPathForAssembly: String(source.sourceVideoPathForAssembly || source.source_video_path_for_assembly || source.backendPath || source.backend_path || source.path || source.sourceVideoPath || source.source_video_path || "").trim(),
      source_video_path_for_assembly: String(source.source_video_path_for_assembly || source.sourceVideoPathForAssembly || source.backend_path || source.backendPath || source.path || source.source_video_path || source.sourceVideoPath || "").trim(),
      previewUrl: String(source.previewUrl || source.preview_url || source.sourceVideoUrl || source.source_video_url || source.url || "").trim(),
      sourceVideoUrl: String(source.sourceVideoUrl || source.source_video_url || source.previewUrl || source.preview_url || source.url || "").trim(),
      source_video_url: String(source.source_video_url || source.sourceVideoUrl || source.preview_url || source.previewUrl || source.url || "").trim(),
      duration_sec: toFiniteNumber(source.duration_sec ?? source.durationSec, 0),
      color: String(source.color || "").trim(),
    };
  });
}

export function parseVideoMatchBoardJson(jsonText = "", sourceVideoUrl = "") {
  let parsed;
  try {
    parsed = JSON.parse(String(jsonText || ""));
  } catch (error) {
    return { ok: false, error: `Невалидный JSON: ${String(error?.message || error)}` };
  }
  if (!parsed || typeof parsed !== "object") return { ok: false, error: "JSON должен быть объектом." };
  const schemaAlias = parsed.schema === VIDEO_MATCH_BOARD_SCHEMA_PHOTOSTUDIO_V2
    ? VIDEO_MATCH_BOARD_SCHEMA_V2
    : parsed.schema;
  if (![VIDEO_MATCH_BOARD_SCHEMA_V1, VIDEO_MATCH_BOARD_SCHEMA_V2].includes(schemaAlias)) {
    return { ok: false, error: `schema должен быть ${VIDEO_MATCH_BOARD_SCHEMA_V1} или ${VIDEO_MATCH_BOARD_SCHEMA_V2}.` };
  }

  let matchSegments = [];
  if (schemaAlias === VIDEO_MATCH_BOARD_SCHEMA_V1) {
    if (!Array.isArray(parsed.matches)) return { ok: false, error: "matches должен быть массивом." };
    matchSegments = parsed.matches.map((match, index) => normalizeV1MatchAsSegment(match, index, sourceVideoUrl));
  } else {
    if (!Array.isArray(parsed.segments)) return { ok: false, error: "segments должен быть массивом." };
    matchSegments = parsed.segments.map((segment, index) => normalizeVideoMatchSegment(segment, index, sourceVideoUrl));
  }

  const videoBlocks = buildVideoBlocksFromMatchSegments(matchSegments, sourceVideoUrl);
  const rawTimingSegments = Array.isArray(parsed?.audio_map?.segments)
    ? parsed.audio_map.segments
    : (Array.isArray(parsed?.audioMap?.segments)
      ? parsed.audioMap.segments
      : (Array.isArray(parsed?.segments) ? parsed.segments : []));
  const timingSegments = buildTimingSegmentsFromVideoMatchSegments(rawTimingSegments);
  const audioDurationSec = toFiniteNumber(
    parsed?.audio_duration_sec
    ?? parsed?.audioDurationSec
    ?? parsed?.audio_map?.duration_sec
    ?? parsed?.audioMap?.durationSec
    ?? timingSegments[timingSegments.length - 1]?.target_t1
    ?? 0,
    0,
  );
  const leadingInsertedSilenceSec = getLeadingInsertedSilenceSecFromTimingSegments(timingSegments);
  const timingContext = normalizeVideoMatchTimingContext({
    ...(parsed?.timingContext || {}),
    sourceAudioUrl: String(parsed?.source_audio?.url || parsed?.audioUrl || parsed?.audio_url || ""),
    audioDurationSec,
    timingScenes: timingSegments,
    segments: timingSegments,
    sourceNodeId: parsed?.sourceNodeId || "",
    manualTimingSeed: parsed?.manual_timing_seed || parsed?.manualTimingSeed || null,
    sourceOfTruth: parsed?.source_of_truth || "video_match_board_v2.segments",
    leadingInsertedSilenceSec,
    leading_inserted_silence_sec: leadingInsertedSilenceSec,
  });
  const audioMap = {
    ...(parsed?.audio_map || parsed?.audioMap || {}),
    source_of_truth: "video_match_board_v2.segments",
    do_not_change_audio_timings: true,
    duration_sec: audioDurationSec,
    audioDurationSec,
    leading_inserted_silence_sec: leadingInsertedSilenceSec,
    leadingInsertedSilenceSec,
    segments: timingSegments,
  };
  return {
    ok: true,
    schema: schemaAlias,
    sourceVideo: normalizeVideoMatchSourceVideo(parsed),
    sourceVideos: normalizeVideoMatchSourceVideos(parsed),
    source_videos: normalizeVideoMatchSourceVideos(parsed),
    source_video: parsed.source_video && typeof parsed.source_video === "object" ? parsed.source_video : {},
    sourceVideoPath: String(parsed.sourceVideoPath || parsed.source_video_path || "").trim(),
    matchSegments,
    videoBlocks,
    timingContext,
    audioMap,
    audioDurationSec,
    video_match_board_v2_import_contract: VIDEO_MATCH_BOARD_V2_SOURCE_BINDING_RULES,
    importWarnings: normalizeVideoMatchSourceVideos(parsed).length ? [] : ["sourceVideos is empty; bind source video V1 before assembly"],
    selectedSegmentId: matchSegments[0]?.id || "",
    selectedCandidateId: matchSegments[0]?.selectedCandidateId || "",
    raw: parsed,
  };
}

export function readVideoMatchBoardProjectForNode(nodeId = "") {
  const safeNodeId = String(nodeId || "").trim();
  const nodeProject = safeReadVideoMatchJson(getVideoMatchBoardNodeStorageKey(safeNodeId));
  const activeProject = safeReadVideoMatchJson(getVideoMatchBoardActiveProjectStorageKey());
  const emergencyProject = safeReadVideoMatchJson(getVideoMatchBoardEmergencyStorageKey(safeNodeId));
  const confirmedImportProject = safeReadVideoMatchJson(getVideoMatchBoardLastGoodStorageKey(safeNodeId));
  const confirmedIsFullProject = Array.isArray(confirmedImportProject?.matchSegments) && confirmedImportProject.matchSegments.length > 0;
  const candidates = [
    ...(confirmedIsFullProject ? [{ key: "confirmed_import", project: confirmedImportProject }] : []),
    { key: "saved", project: nodeProject },
    { key: "active", project: activeProject && !activeProject?.isActivePointer && (!safeNodeId || String(activeProject.nodeId || "") === safeNodeId) ? activeProject : null },
    { key: "emergency", project: emergencyProject },
  ].filter((item) => item.project);
  if (!candidates.length) return null;

  const scoreProject = (project = {}) => {
    const importedAt = Number(project?.importedAt || 0);
    const matchSegmentsCount = Array.isArray(project?.matchSegments) ? project.matchSegments.length : 0;
    const videoBlocksCount = Array.isArray(project?.videoBlocks) ? project.videoBlocks.length : 0;
    const hasImportMeta = Boolean(project?.importSignature) && importedAt > 0;
    const hasBlobPreview = isBlobUrl(project?.sourceVideoUrl) || isBlobUrl(project?.audioPreviewUrl);
    const updatedAt = Number(project?.updatedAt || 0);
    const hasMaterial = matchSegmentsCount > 0 || videoBlocksCount > 0;
    let score = 0;
    if (matchSegmentsCount === 0) score -= 100000;
    score += matchSegmentsCount * 1000;
    score += videoBlocksCount * 100;
    if (hasImportMeta) score += 50000;
    score += importedAt / 1000000;
    score += updatedAt / 1000000000;
    if (hasBlobPreview) score -= 1000;
    return { importedAt, matchSegmentsCount, videoBlocksCount, hasImportMeta, hasBlobPreview, updatedAt, hasMaterial, score };
  };

  const latestConfirmedImport = confirmedImportProject || null;
  const latestConfirmedAt = Number(latestConfirmedImport?.importedAt || 0);
  const latestConfirmedSig = String(latestConfirmedImport?.importSignature || "");
  const rejectedStaleKeys = [];
  const rejectedReasonByKey = {};
  const filtered = candidates.filter((entry) => {
    if (entry.key === "confirmed_import") return true;
    const candidateImportedAt = Number(entry.project?.importedAt || 0);
    const candidateSignature = String(entry.project?.importSignature || "");
    const hasConfirmedImportMeta = Boolean(latestConfirmedSig) && latestConfirmedAt > 0;
    if (!hasConfirmedImportMeta) return true;
    const hasCandidateImportMeta = Boolean(candidateSignature) && candidateImportedAt > 0;
    const candidateSegments = Array.isArray(entry?.project?.matchSegments) ? entry.project.matchSegments.length : 0;
    const confirmedSegments = Array.isArray(latestConfirmedImport?.matchSegments) ? latestConfirmedImport.matchSegments.length : 0;
    const staleBySignatureAndSegments = candidateSignature !== latestConfirmedSig
      && candidateSegments !== confirmedSegments
      && candidateImportedAt <= latestConfirmedAt;
    const staleByBlobOnlyPreview = (isBlobUrl(entry?.project?.sourceVideoUrl) || isBlobUrl(entry?.project?.audioPreviewUrl))
      && candidateSignature !== latestConfirmedSig
      && candidateImportedAt <= latestConfirmedAt;
    const staleBySignatureAndAge = hasCandidateImportMeta && candidateSignature !== latestConfirmedSig && candidateImportedAt < latestConfirmedAt;
    const stale = staleBySignatureAndAge || staleBySignatureAndSegments || staleByBlobOnlyPreview;
    if (stale) {
      rejectedStaleKeys.push(entry.key);
      rejectedReasonByKey[entry.key] = staleByBlobOnlyPreview
        ? "blob_preview_without_newer_import_signature"
        : "signature_mismatch_or_older_than_confirmed_import";
    }
    if (!hasCandidateImportMeta && staleBySignatureAndSegments) return false;
    if (!hasCandidateImportMeta && staleByBlobOnlyPreview) return false;
    return !stale;
  });
  const sorted = [...filtered].sort((a, b) => {
    const A = scoreProject(a.project);
    const B = scoreProject(b.project);
    if (A.score !== B.score) return B.score - A.score;
    if (A.hasImportMeta !== B.hasImportMeta) return A.hasImportMeta ? -1 : 1;
    if (A.importedAt !== B.importedAt) return B.importedAt - A.importedAt;
    if (A.hasMaterial !== B.hasMaterial) return A.hasMaterial ? -1 : 1;
    if (A.matchSegmentsCount !== B.matchSegmentsCount) return B.matchSegmentsCount - A.matchSegmentsCount;
    if (A.videoBlocksCount !== B.videoBlocksCount) return B.videoBlocksCount - A.videoBlocksCount;
    return B.updatedAt - A.updatedAt;
  });
  const picked = sorted[0] || candidates[0];
  const confirmedStats = scoreProject(latestConfirmedImport || {});
  const savedStats = scoreProject(nodeProject || {});
  const activeStats = scoreProject(activeProject || {});
  const emergencyStats = scoreProject(emergencyProject || {});
  const pickedStats = scoreProject(picked.project || {});
  const pickedPath = String(picked.project?.sourceVideo?.path || picked.project?.source_video?.path || picked.project?.sourceVideoPath || "").trim();
  console.info("[VIDEO MATCH HYDRATE PICK]", {
    pickedKey: picked.key,
    pickedSegments: pickedStats.matchSegmentsCount,
    pickedImportedAt: pickedStats.importedAt,
    pickedSignature: picked.project?.importSignature || "",
    confirmedSegments: confirmedStats.matchSegmentsCount,
    confirmedImportedAt: confirmedStats.importedAt,
    confirmedSignature: latestConfirmedImport?.importSignature || "",
    savedSegments: savedStats.matchSegmentsCount,
    savedImportedAt: savedStats.importedAt,
    savedSignature: nodeProject?.importSignature || "",
    activeSegments: activeStats.matchSegmentsCount,
    activeImportedAt: activeStats.importedAt,
    activeSignature: activeProject?.importSignature || "",
    emergencySegments: emergencyStats.matchSegmentsCount,
    emergencyImportedAt: emergencyStats.importedAt,
    emergencySignature: emergencyProject?.importSignature || "",
    rejectedStaleKeys,
    rejectedReasonByKey,
    hasBlobPreview: Boolean(picked?.project?.sourceVideoUrl && isBlobUrl(picked.project.sourceVideoUrl)),
    sourceVideoPath: pickedPath,
  });
  return picked.project;
}

export function persistVideoMatchBoardProject(project = {}, options = {}) {
  const safeProject = {
    ...getDefaultVideoMatchBoardProject(project?.nodeId || project?.sourceNodeId || "default"),
    ...(project && typeof project === "object" ? project : {}),
    updatedAt: Date.now(),
  };
  const nodeId = String(safeProject.nodeId || safeProject.sourceNodeId || "default").trim() || "default";
  const existingProject = readVideoMatchBoardProjectForNode(nodeId);
  safeProject.nodeId = nodeId;
  safeProject.sourceNodeId = String(safeProject.sourceNodeId || nodeId);
  safeProject.timingContext = normalizeVideoMatchTimingContext(safeProject.timingContext || {});
  safeProject.audioMix = getDefaultVideoMatchAudioMix(safeProject.audioMix || {});
  safeProject.matchSegments = Array.isArray(safeProject.matchSegments)
    ? safeProject.matchSegments.map((segment, index) => normalizeVideoMatchSegment(segment, index, safeProject.sourceVideoUrl))
    : [];
  safeProject.videoBlocks = safeProject.matchSegments.length
    ? buildVideoBlocksFromMatchSegments(safeProject.matchSegments, safeProject.sourceVideoUrl)
    : (Array.isArray(safeProject.videoBlocks) ? safeProject.videoBlocks.map((block) => normalizeVideoBlock(block, safeProject.sourceVideoUrl)) : []);
  const selectedBlock = safeProject.videoBlocks.find((block) => block.id === safeProject.selectedBlockId) || safeProject.videoBlocks[0] || null;
  const selectedSegment = safeProject.matchSegments.find((segment) => segment.id === safeProject.selectedSegmentId)
    || safeProject.matchSegments.find((segment) => segment.id === selectedBlock?.segmentId)
    || safeProject.matchSegments[0]
    || null;
  safeProject.selectedSegmentId = String(selectedSegment?.id || selectedBlock?.segmentId || safeProject.selectedSegmentId || "").trim();
  safeProject.selectedCandidateId = String(selectedBlock?.candidateId || selectedBlock?.id || selectedSegment?.selectedCandidateId || safeProject.selectedCandidateId || "").trim();
  safeProject.selectedBlockId = String(selectedBlock?.id || safeProject.selectedBlockId || "").trim();

  const nextStats = getVideoMatchProjectStats(safeProject);
  const existingStats = getVideoMatchProjectStats(existingProject);
  if (shouldSkipVideoMatchPersistToProtectMaterials(safeProject, existingProject, options)) {
    console.info("[VIDEO MATCH PROJECT SAVE RESULT]", {
      nodeId,
      saveOk: false,
      nextStats,
      existingStats,
      savedStats: existingStats,
      reason: "protect_materials",
    });
    return existingProject;
  }

  const storageProject = sanitizeVideoMatchProjectForStorage(safeProject);
  if (storageProject.sourceVideoUrl !== safeProject.sourceVideoUrl || storageProject.audioPreviewUrl !== safeProject.audioPreviewUrl) {
    console.info("[VIDEO MATCH STORAGE SANITIZED_BLOB_URLS]", {
      nodeId,
      removedSourceBlob: storageProject.sourceVideoUrl !== safeProject.sourceVideoUrl,
      removedAudioBlob: storageProject.audioPreviewUrl !== safeProject.audioPreviewUrl,
    });
  }
  const writeTarget = (key, projectValue, saveTarget = "node") => {
    const serialized = JSON.stringify(projectValue);
    const stats = getVideoMatchProjectStorageDebugStats(projectValue);
    console.info("[VIDEO MATCH STORAGE SIZE DEBUG]", { key, bytes: serialized.length, ...stats, saveTarget });
    let result = safeWriteJson(key, projectValue);
    if (result.ok) return result;
    const quotaExceeded = String(result?.error?.name || "").includes("QuotaExceeded")
      || String(result?.error?.message || "").includes("QuotaExceeded");
    if (!quotaExceeded) return result;
    const slimProject = createVideoMatchStorageSlimProject(projectValue);
    const slimBytes = JSON.stringify(slimProject).length;
    try { localStorage.removeItem(key); } catch {}
    const slimResult = safeWriteJson(key, slimProject);
    console.warn("[VIDEO MATCH STORAGE QUOTA FALLBACK]", {
      key,
      originalBytes: serialized.length,
      slimBytes,
      removedJsonInput: true,
      leanTimingSegments: true,
      saveOk: slimResult.ok,
    });
    return slimResult;
  };
  const isLargeVideoMatchProject = Array.isArray(storageProject.matchSegments) && storageProject.matchSegments.length > 20;
  const activePayload = isLargeVideoMatchProject
    ? {
      nodeId,
      projectId: storageProject.projectId || nodeId,
      importedAt: Number(storageProject.importedAt || 0),
      importSignature: String(storageProject.importSignature || ""),
      importedSegmentsCount: Number(storageProject.importedSegmentsCount || storageProject.matchSegments.length || 0),
      schema: String(storageProject.schema || ""),
      sourceVideoPath: String(storageProject.sourceVideoPath || storageProject?.sourceVideo?.path || ""),
      audioDurationSec: Number(storageProject.audioDurationSec || storageProject?.timingContext?.audioDurationSec || 0),
      isActivePointer: true,
    }
    : storageProject;
  const nodeWriteResult = writeTarget(getVideoMatchBoardNodeStorageKey(nodeId), storageProject, "node");
  const activeWriteResult = writeTarget(getVideoMatchBoardActiveProjectStorageKey(), activePayload, isLargeVideoMatchProject ? "active_pointer" : "active");
  const writeResults = [nodeWriteResult, activeWriteResult];
  logVideoMatchSanitizeCheck(nodeId, getVideoMatchBoardNodeStorageKey(nodeId), storageProject);
  logVideoMatchSanitizeCheck(nodeId, getVideoMatchBoardActiveProjectStorageKey(), activePayload);
  const activeIdWriteResult = safeWriteJson(getVideoMatchBoardActiveProjectIdStorageKey(), String(safeProject.projectId || nodeId));
  if (!activeIdWriteResult?.ok) console.error("[VIDEO MATCH PROJECT SAVE ERROR]", { key: getVideoMatchBoardActiveProjectIdStorageKey(), error: activeIdWriteResult?.error });
  if (options?.lastGood !== false) {
    const key = getVideoMatchBoardLastGoodStorageKey(nodeId);
    const shouldWriteSlimLastGood = Array.isArray(storageProject.matchSegments) && storageProject.matchSegments.length > 20;
    const lastGoodPayload = shouldWriteSlimLastGood
      ? {
        nodeId,
        importedAt: Number(storageProject.importedAt || 0),
        importSignature: String(storageProject.importSignature || ""),
        importedSegmentsCount: Number(storageProject.importedSegmentsCount || (Array.isArray(storageProject.matchSegments) ? storageProject.matchSegments.length : 0)),
        schema: String(storageProject.schema || ""),
        sourceVideoPath: String(storageProject.sourceVideoPath || storageProject?.sourceVideo?.path || ""),
        audioDurationSec: Number(storageProject.audioDurationSec || storageProject?.timingContext?.audioDurationSec || 0),
        hasLastGood: true,
      }
      : storageProject;
    writeResults.push(writeTarget(key, lastGoodPayload, "last_good"));
    logVideoMatchSanitizeCheck(nodeId, key, lastGoodPayload);
  }
  if (options?.emergency) writeResults.push(writeVideoMatchEmergencyProject(nodeId, storageProject));
  const nodeSaveOk = Boolean(nodeWriteResult?.ok);
  const activeOk = Boolean(activeWriteResult?.ok);
  const lastGoodOk = options?.lastGood === false ? true : Boolean(writeResults[2]?.ok);
  if (!activeOk || !lastGoodOk) {
    console.warn("[VIDEO MATCH SECONDARY_SAVE_FAILED]", { nodeId, activeOk, lastGoodOk });
  }
  const saveOk = nodeSaveOk;
  console.info("[VIDEO MATCH PROJECT SAVE RESULT]", {
    nodeId,
    saveOk,
    nextStats,
    existingStats,
    savedStats: getVideoMatchProjectStats(storageProject),
    reason: saveOk ? "saved" : "write_failed",
  });
  return safeProject;
}

export function writeVideoMatchEmergencyProject(nodeId = "", project = {}) {
  const safeNodeId = String(nodeId || project?.nodeId || project?.sourceNodeId || "default").trim() || "default";
  const key = getVideoMatchBoardEmergencyStorageKey(safeNodeId);
  const storageProject = sanitizeVideoMatchProjectForStorage({
    ...(project && typeof project === "object" ? project : {}),
    nodeId: safeNodeId,
    sourceNodeId: String(project?.sourceNodeId || safeNodeId),
    updatedAt: Date.now(),
  });
  logVideoMatchSanitizeCheck(safeNodeId, key, storageProject);
  return safeWriteJson(key, storageProject);
}

export function clearVideoMatchBoardProjectStorage(nodeId = "") {
  const safeNodeId = String(nodeId || "default").trim() || "default";
  const keys = [
    getVideoMatchBoardNodeStorageKey(safeNodeId),
    getVideoMatchBoardLastGoodStorageKey(safeNodeId),
    getVideoMatchBoardEmergencyStorageKey(safeNodeId),
  ];
  const activeKey = getVideoMatchBoardActiveProjectStorageKey();
  const activeIdKey = getVideoMatchBoardActiveProjectIdStorageKey();
  const activeProject = safeReadVideoMatchJson(activeKey);
  if (String(activeProject?.nodeId || "") === safeNodeId) keys.push(activeKey);
  if (String(activeProject?.nodeId || "") === safeNodeId) keys.push(activeIdKey);
  try {
    const prefix = getVideoMatchBoardStoragePrefix();
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(prefix) || keys.includes(key)) continue;
      if (key.includes(`:${safeNodeId}`)) {
        keys.push(key);
        continue;
      }
      const parsed = safeReadVideoMatchJson(key);
      const parsedNodeId = String(parsed?.nodeId || parsed?.sourceNodeId || "").trim();
      if (parsedNodeId && parsedNodeId === safeNodeId) keys.push(key);
    }
  } catch {}
  const removedKeys = [];
  keys.forEach((key) => {
    try { localStorage.removeItem(key); } catch {}
    try { sessionStorage.removeItem(key); } catch {}
    removedKeys.push(key);
  });
  console.info("[VIDEO MATCH STORAGE HARD CLEAR]", { nodeId: safeNodeId, removedKeys });
}
