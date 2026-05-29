import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE, fetchJson } from "../../services/api.js";
import {
  getDefaultVideoMatchBoardProject,
  getDefaultVideoMatchAudioMix,
  getVideoMatchProjectStats,
  buildVideoBlocksFromMatchSegments,
  parseVideoMatchBoardJson,
  normalizeVideoMatchTimingContext,
  persistVideoMatchBoardProject,
  readVideoMatchBoardProjectForNode,
  normalizeVideoMatchSourceVideo,
  shouldSkipVideoMatchPersistToProtectMaterials,
  buildVideoMatchImportSignature,
  clearVideoMatchBoardProjectStorage,
  getVideoMatchBoardNodeStorageKey,
  getVideoMatchBoardLastGoodStorageKey,
  safeReadVideoMatchJson,
  writeVideoMatchEmergencyProject,
  sanitizeVideoMatchProjectForStorage,
} from "../clip_nodes/video_match/videoMatchBoardDomain.js";
import "./VideoMatchBoardPage.css";
import { WORKFLOW_PRESETS, getPresetById } from "../../data/codex_jobs/index.js";

const DEFAULT_WORKFLOW_PRESET = "video_first_documentary";
const DEFAULT_WORKFLOW_STEP = "01_video_inventory";
const DEFAULT_WORKFLOW_STEP_FOR_MANIFEST = "auto_or_unspecified";
function getVideoMatchAuthHeaders(extra = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("ava_token") : "";
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function readVideoMatchJsonResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return { message: text.slice(0, 500) };
  }
}

function getVideoMatchApiErrorMessage(data, response, fallback = "video match request failed") {
  const detail = data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  if (detail && typeof detail === "object") {
    const msg = detail.message || detail.code || JSON.stringify(detail);
    if (msg) return String(msg);
  }
  if (data?.message) return String(data.message);
  if (data?.code) return String(data.code);
  if (response?.status) return `${fallback} (${response.status})`;
  return fallback;
}


function formatSec(value) {
  const sec = Number(value || 0);
  if (!Number.isFinite(sec) || sec < 0) return "0.00";
  return sec.toFixed(2);
}


function isTruthyFlag(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value === null || value === undefined || value === "") return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "off", ""].includes(normalized)) return false;
  }
  return false;
}

function toOptionalFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function getCandidateKey(item = {}) {
  return String(item?.id || item?.candidateId || item?.candidate_id || "").trim();
}

function getSegmentKey(item = {}) {
  return String(item?.id || item?.audioSceneId || item?.audio_scene_id || item?.scene_id || "").trim();
}

function getMarkerTone(block = {}) {
  const route = String(block?.route || "").trim().toLowerCase();
  const sourceKind = String(block?.sourceKind || block?.source_kind || "").trim().toLowerCase();
  const sceneType = String(block?.scene_type || block?.sceneType || "").trim().toLowerCase();
  const candidateType = String(block?.candidateType || block?.candidate_type || "").trim().toLowerCase();
  const matchRole = String(block?.video_match_role || block?.videoMatchRole || block?.role || "").trim().toLowerCase();
  const isLipsync = route === "ia2v"
    || isTruthyFlag(block?.lip_sync_required)
    || isTruthyFlag(block?.lipSyncRequired)
    || isTruthyFlag(block?.reservedGeneratedLipsync)
    || isTruthyFlag(block?.reserved_generated_lipsync)
    || isTruthyFlag(block?.manual_lipsync_override)
    || sourceKind.includes("lipsync")
    || sourceKind.includes("lip_sync")
    || sceneType.includes("lipsync")
    || sceneType.includes("lip_sync")
    || candidateType === "generated_lipsync_insert"
    || matchRole.includes("lipsync")
    || matchRole.includes("lip_sync");
  if (isLipsync) return "lipsync";
  if (matchRole === "reserved_intro" || sceneType === "reserved_intro" || sourceKind === "reserved_intro") return "intro";
  return "broll";
}

function isLipSyncScene(block = {}) {
  return getMarkerTone(block) === "lipsync";
}

function getEffectiveForceMuteVideoAudio(block, segment, candidate) {
  const explicit = candidate?.forceMuteVideoAudio
    ?? candidate?.force_mute_video_audio
    ?? block?.forceMuteVideoAudio
    ?? block?.force_mute_video_audio;
  if (explicit !== undefined && explicit !== null) return isTruthyFlag(explicit);
  return isLipSyncScene(segment) && isOverrideCandidate(candidate);
}

function getSceneOrderMarkerLeft(index, total) {
  if (!total || total <= 1) return 0;
  return (index / (total - 1)) * 100;
}

function getBlockLeft(block, duration) {
  const dur = Number(duration || 0);
  if (!Number.isFinite(dur) || dur <= 0) return 0;
  return Math.max(0, Math.min(100, (getBlockClipRange(block).clipStart / dur) * 100));
}

function getBlockWidth(block, duration) {
  const dur = Number(duration || 0);
  if (!Number.isFinite(dur) || dur <= 0) return 0;
  const { clipStart, clipEnd } = getBlockClipRange(block);
  return Math.max(0.8, Math.min(100, ((clipEnd - clipStart) / dur) * 100));
}

function getValidDurationSec(value) {
  const duration = Number(value || 0);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function getBlockTargetStart(block = {}) {
  return Number(block?.targetStartSec ?? block?.target_t0 ?? 0) || 0;
}

function getBlockTargetEnd(block = {}) {
  const start = getBlockTargetStart(block);
  const end = Number(block?.targetEndSec ?? block?.target_t1 ?? start) || start;
  return Math.max(start, end);
}

function getBlockSourceStart(block = {}) {
  return Number(block?.sourceVideoStartSec ?? block?.video_t0 ?? 0) || 0;
}

function getBlockSourceEnd(block = {}) {
  const start = getBlockSourceStart(block);
  const end = Number(block?.sourceVideoEndSec ?? block?.video_t1 ?? start) || start;
  return Math.max(start, end);
}
function getBlockClipRange(block = {}) {
  const clipStartRaw = toOptionalFiniteNumber(block?.clipSourceStartSec ?? block?.clip_source_start_sec);
  const clipEndRaw = toOptionalFiniteNumber(block?.clipSourceEndSec ?? block?.clip_source_end_sec);
  const hasClipStart = clipStartRaw !== null;
  const hasClipEnd = clipEndRaw !== null;
  const sourceStart = hasClipStart ? clipStartRaw : getBlockSourceStart(block);
  const sourceEnd = hasClipEnd ? clipEndRaw : getBlockSourceEnd(block);
  const segmentDuration = Math.max(0, getBlockTargetEnd(block) - getBlockTargetStart(block));
  const clipStart = Math.max(0, sourceStart);
  const safeSourceEnd = (hasClipEnd ? sourceEnd > clipStart : sourceEnd >= clipStart)
    ? sourceEnd
    : clipStart + segmentDuration;
  const clipEnd = Math.max(clipStart, Math.min(safeSourceEnd, clipStart + segmentDuration));
  return { clipStart, clipEnd };
}

function findAssemblyBlockByAudioTime(blocks = [], audioTimeSec = 0, fallbackIndex = 0) {
  if (!Array.isArray(blocks) || blocks.length === 0) return { block: null, index: -1 };
  const currentTime = Number(audioTimeSec || 0);
  const index = blocks.findIndex((block) => currentTime >= getBlockTargetStart(block) && currentTime < getBlockTargetEnd(block));
  if (index >= 0) return { block: blocks[index], index };
  const safeFallback = Math.max(0, Math.min(blocks.length - 1, Number(fallbackIndex || 0)));
  return { block: blocks[safeFallback] || blocks[0], index: safeFallback };
}

function getAudioTimelineOffsetSec(project = {}) {
  const explicit = Number(project?.audioMap?.leading_inserted_silence_sec ?? project?.timingContext?.leadingInsertedSilenceSec ?? 0);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const segments = Array.isArray(project?.matchSegments) ? project.matchSegments : [];
  const derived = segments.reduce((maxOffset, segment) => {
    const direct = Number(segment?.audio_timeline_offset_sec ?? segment?.audioTimelineOffsetSec ?? 0);
    if (Number.isFinite(direct) && direct > maxOffset) return direct;
    const target = Number(segment?.target_t0 ?? segment?.targetStartSec ?? 0);
    const source = Number(segment?.source_audio_t0 ?? segment?.sourceAudioStartSec ?? 0);
    if (Number.isFinite(target) && Number.isFinite(source)) return Math.max(maxOffset, Math.max(0, target - source));
    return maxOffset;
  }, 0);
  return Number.isFinite(derived) && derived > 0 ? derived : 0;
}

function resolveOutputUrl(outputUrl = "") {
  const raw = String(outputUrl || "").trim();
  if (!raw) return "";
  if (raw.startsWith("/")) return `${API_BASE}${raw}`;
  return raw;
}


function getVideoNodeAuthHeaders(extraHeaders = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("ava_token") : "";
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extraHeaders || {}),
  };
}

function makeVideoNodeWorkspacePayload(project = {}, nodeId = "default") {
  const sanitizedProject = sanitizeVideoMatchProjectForStorage({
    ...(project && typeof project === "object" ? project : {}),
    nodeId,
    sourceNodeId: String(project?.sourceNodeId || nodeId),
    jsonInput: "",
    assembledPreview: null,
  });
  return {
    schema: "ava_video_node_workspace_snapshot_v1",
    stage: "video_node",
    savedAt: Date.now(),
    nodeId,
    stats: getVideoMatchProjectStats(sanitizedProject),
    project: sanitizedProject,
  };
}

function pickVideoNodeWorkspaceProject(snapshotResponse = {}) {
  const data = snapshotResponse?.snapshot?.data || snapshotResponse?.data || null;
  if (!data || typeof data !== "object") return null;
  const project = data.project && typeof data.project === "object" ? data.project : data;
  if (!project || typeof project !== "object") return null;
  const stats = getVideoMatchProjectStats(project);
  const hasUsefulState = Number(stats.matchSegmentsCount || 0) > 0
    || Number(stats.videoBlocksCount || 0) > 0
    || Boolean(project.sourceVideoPath || project?.sourceVideo?.path || project.sourceVideoUrl || project.importSignature);
  return hasUsefulState ? project : null;
}

async function fetchVideoNodeWorkspaceProject() {
  const response = await fetch(`${API_BASE}/api/workspace/snapshots/video_node`, {
    method: "GET",
    headers: getVideoNodeAuthHeaders(),
  });
  if (!response.ok) throw new Error(`workspace snapshot load failed ${response.status}`);
  const data = await response.json().catch(() => null);
  return pickVideoNodeWorkspaceProject(data || {});
}

async function saveVideoNodeWorkspaceProject(project = {}, nodeId = "default") {
  const payload = makeVideoNodeWorkspacePayload(project, nodeId);
  const response = await fetch(`${API_BASE}/api/workspace/snapshots/video_node`, {
    method: "POST",
    headers: getVideoNodeAuthHeaders(),
    body: JSON.stringify({
      data: payload,
      client_version: "video-node-f5-patch05",
      guard_mode: "replace",
    }),
  });
  if (!response.ok) throw new Error(`workspace snapshot save failed ${response.status}`);
  return response.json().catch(() => null);
}


// AVA_PATCH06_TAKE_FROM_BOARD: Video Node can pull generated clips from Board scene-to-scene.
function pickSnapshotData(snapshotResponse = {}) {
  return snapshotResponse?.snapshot?.data || snapshotResponse?.data || snapshotResponse || null;
}

function pickBoardSnapshotFromResponse(snapshotResponse = {}) {
  const data = pickSnapshotData(snapshotResponse);
  if (!data || typeof data !== "object") return null;
  if (Array.isArray(data.scenes)) return data;
  if (data.board && Array.isArray(data.board.scenes)) return data.board;
  if (data.project && Array.isArray(data.project.scenes)) return data.project;
  if (data.data && Array.isArray(data.data.scenes)) return data.data;
  return data;
}

function normalizeSceneMatchKey(value = "") {
  return String(value || "").trim().toLowerCase();
}

function boardSceneKeys(scene = {}) {
  const values = [
    scene.id,
    scene.scene_id,
    scene.sceneId,
    scene.audio_scene_id,
    scene.audioSceneId,
    scene.segmentId,
    scene.segment_id,
    scene.timingSceneId,
    scene.timing_scene_id,
    scene.user_scene_label,
    scene.userSceneLabel,
  ];
  return Array.from(new Set(values.map(normalizeSceneMatchKey).filter(Boolean)));
}

function boardSceneVideoInfo(scene = {}) {
  const videoResult = scene.video_result || scene.videoResult || {};
  const mmaudioResult = scene.mmaudio_result || scene.mmaudioResult || {};
  const preferredResult = scene.mmaudio_video_url || scene.mmaudioVideoUrl ? mmaudioResult : videoResult;
  const videoUrl = String(
    scene.mmaudio_video_url
    || scene.mmaudioVideoUrl
    || scene.video_url
    || scene.videoUrl
    || scene.result_video_url
    || scene.resultVideoUrl
    || preferredResult.videoUrl
    || preferredResult.video_url
    || videoResult.videoUrl
    || videoResult.video_url
    || ""
  ).trim();
  const videoApiPath = String(
    scene.mmaudio_video_api_path
    || scene.mmaudioVideoApiPath
    || scene.video_api_path
    || scene.videoApiPath
    || preferredResult.videoApiPath
    || preferredResult.video_api_path
    || videoResult.videoApiPath
    || videoResult.video_api_path
    || ""
  ).trim();
  const localPath = String(
    scene.mmaudio_local_path
    || scene.mmaudioLocalPath
    || scene.video_local_path
    || scene.videoLocalPath
    || preferredResult.localPath
    || preferredResult.local_path
    || preferredResult.outputPath
    || preferredResult.output_path
    || videoResult.localPath
    || videoResult.local_path
    || videoResult.outputPath
    || videoResult.output_path
    || ""
  ).trim();
  const videoName = String(
    scene.mmaudio_video_name
    || scene.mmaudioVideoName
    || scene.video_name
    || scene.videoName
    || preferredResult.videoName
    || preferredResult.video_name
    || videoResult.videoName
    || videoResult.video_name
    || "board_clip.mp4"
  ).trim();
  const durationSec = toOptionalFiniteNumber(
    scene.mmaudio_duration_sec
    ?? scene.mmaudioDurationSec
    ?? scene.video_duration_sec
    ?? scene.videoDurationSec
    ?? preferredResult.durationSec
    ?? preferredResult.duration_sec
    ?? videoResult.durationSec
    ?? videoResult.duration_sec
  );
  if (!videoUrl && !videoApiPath && !localPath) return null;
  return { videoUrl, videoApiPath, localPath, videoName, durationSec };
}

function extractBoardGeneratedClips(boardSnapshot = {}) {
  const board = pickBoardSnapshotFromResponse(boardSnapshot);
  const scenes = Array.isArray(board?.scenes) ? board.scenes : [];
  return scenes
    .map((scene, index) => {
      const video = boardSceneVideoInfo(scene);
      if (!video) return null;
      const keys = boardSceneKeys(scene);
      const sceneId = String(scene.id || scene.scene_id || scene.audio_scene_id || scene.audioSceneId || `scene_${index + 1}`).trim();
      return {
        id: sceneId,
        sceneId,
        audioSceneId: String(scene.audio_scene_id || scene.audioSceneId || sceneId).trim(),
        keys,
        route: String(scene.route || scene.video_route || "").trim(),
        title: String(scene.title || scene.user_scene_label || scene.text || sceneId).trim(),
        videoUrl: video.videoUrl || video.videoApiPath || "",
        videoApiPath: video.videoApiPath || "",
        localPath: video.localPath || "",
        videoName: video.videoName || "board_clip.mp4",
        durationSec: video.durationSec,
        source: "board_snapshot",
        updatedAt: scene.video_ready_at || scene.mmaudio_ready_at || board.updatedAt || board.savedAt || "",
      };
    })
    .filter(Boolean);
}

function findBoardClipForSegment(segment = {}, boardClips = []) {
  if (!segment || !Array.isArray(boardClips) || !boardClips.length) return null;
  const segmentKeys = [
    segment.id,
    segment.audioSceneId,
    segment.audio_scene_id,
    segment.scene_id,
    segment.sceneId,
    segment.segmentId,
    segment.segment_id,
    segment.user_scene_label,
    segment.userSceneLabel,
  ].map(normalizeSceneMatchKey).filter(Boolean);
  if (!segmentKeys.length) return null;
  return boardClips.find((clip) => (clip.keys || []).some((key) => segmentKeys.includes(key))) || null;
}

function isBoardClipCandidate(candidate = {}) {
  const candidateType = String(candidate?.candidateType || candidate?.candidate_type || "").trim().toLowerCase();
  const sourceKind = String(candidate?.sourceKind || candidate?.source_kind || "").trim().toLowerCase();
  return candidateType === "board_clip" || sourceKind === "board_generated_clip" || Boolean(candidate?.boardClip || candidate?.board_clip);
}

function buildBoardClipCandidate(segment = {}, boardClip = {}) {
  const segmentId = getSegmentKey(segment);
  const targetDuration = Math.max(0.01, Number(segment?.targetEndSec || segment?.target_t1 || 0) - Number(segment?.targetStartSec || segment?.target_t0 || 0));
  const durationSec = Math.max(0.01, Number(boardClip?.durationSec || 0) || targetDuration);
  const candidateId = `${segmentId}_board_${String(boardClip?.sceneId || "clip").replace(/[^a-zA-Z0-9_-]+/g, "_")}_${Date.now()}`;
  return {
    id: candidateId,
    candidateId,
    candidate_id: candidateId,
    candidateType: "board_clip",
    candidate_type: "board_clip",
    sourceKind: "override_video",
    source_kind: "override_video",
    boardClip: true,
    board_clip: true,
    boardSceneId: boardClip.sceneId || "",
    board_scene_id: boardClip.sceneId || "",
    boardAudioSceneId: boardClip.audioSceneId || "",
    board_audio_scene_id: boardClip.audioSceneId || "",
    overrideVideoPath: boardClip.localPath || "",
    override_video_path: boardClip.localPath || "",
    overrideVideoUrl: boardClip.videoUrl || boardClip.videoApiPath || "",
    override_video_url: boardClip.videoUrl || boardClip.videoApiPath || "",
    overrideDurationSec: durationSec,
    override_duration_sec: durationSec,
    sourceVideoStartSec: 0,
    sourceVideoEndSec: durationSec,
    video_t0: 0,
    video_t1: durationSec,
    fit_mode: "board_generated_clip",
    useRealSourceClip: false,
    use_real_source_clip: false,
    route: segment.route || boardClip.route || "",
    lip_sync_required: isLipSyncScene(segment),
    lipSyncRequired: isLipSyncScene(segment),
    reservedGeneratedLipsync: isLipSyncScene(segment),
    reserved_generated_lipsync: isLipSyncScene(segment),
    forceMuteVideoAudio: true,
    force_mute_video_audio: true,
    reservedPlaceholder: false,
    reserved_placeholder: false,
    requiresOverrideVideo: false,
    requires_override_video: false,
    confidence: 1,
    matchReason: `Видео взято из Доски: ${boardClip.title || boardClip.sceneId || segmentId}`,
    match_reason: `Видео взято из Доски: ${boardClip.title || boardClip.sceneId || segmentId}`,
    visualType: "board_generated_clip",
    visual_type: "board_generated_clip",
    shotType: "generated",
    shot_type: "generated",
    warnings: boardClip.localPath ? [] : ["board_clip_without_local_path_preview_only"],
  };
}

async function fetchBoardGeneratedClipsFromWorkspace() {
  const response = await fetch(`${API_BASE}/api/workspace/snapshots/board`, {
    method: "GET",
    headers: getVideoNodeAuthHeaders(),
  });
  if (!response.ok) throw new Error(`board snapshot load failed ${response.status}`);
  const data = await response.json().catch(() => null);
  return extractBoardGeneratedClips(data || {});
}

function isBrowserSafeThumbnail(thumbnail = "") {
  const raw = String(thumbnail || "").trim();
  if (!raw) return false;
  if (/^[a-zA-Z]:[\\/]/.test(raw)) return false;
  if (raw.includes("\\")) return false;
  return raw.startsWith("http://")
    || raw.startsWith("https://")
    || raw.startsWith("/")
    || raw.startsWith("data:")
    || raw.startsWith("blob:");
}

function isOverrideCandidate(candidate = {}) {
  return candidate?.sourceKind === "override_video" || Boolean(candidate?.overrideVideoUrl || candidate?.overrideVideoPath);
}

function isOverrideBlock(block = {}) {
  return block?.sourceKind === "override_video" || block?.overrideVideoUrl || block?.overrideVideoPath;
}

function getResolvedOverrideUrl(blockOrCandidate = {}) {
  return resolveOutputUrl(blockOrCandidate?.overrideVideoUrl || "");
}

const AUDIO_EXPORT_EXTENSIONS = [".mp3", ".wav", ".m4a", ".aac"];

function validateAssembleAudioPath(rawPath = "") {
  const value = String(rawPath || "").trim();
  if (!value) return { ok: false, code: "AUDIO_PATH_REQUIRED" };
  if (value.endsWith("...")) return { ok: false, code: "AUDIO_PATH_TRUNCATED" };
  const lowered = value.toLowerCase();
  if (lowered.startsWith("blob:") || lowered.startsWith("http://") || lowered.startsWith("https://") || lowered.startsWith("data:")) {
    return { ok: false, code: "AUDIO_PATH_PREVIEW_ONLY" };
  }
  const looksLikeAbsolutePath = /^([a-zA-Z]:[\\/]|\/|~\/)/.test(value);
  if (!looksLikeAbsolutePath) return { ok: false, code: "AUDIO_PATH_NOT_LOCAL" };
  if (!AUDIO_EXPORT_EXTENSIONS.some((ext) => lowered.endsWith(ext))) return { ok: false, code: "AUDIO_PATH_INVALID_EXT" };
  return { ok: true, code: "OK" };
}

function resolveAssembleApiErrorMessage(error) {
  const code = String(
    error?.code
    || error?.detail?.code
    || error?.payload?.code
    || error?.payload?.detail?.code
    || error?.response?.code
    || error?.response?.detail?.code
    || "",
  ).trim();
  if (code === "AUDIO_PATH_REQUIRED") return "Для сборки MP4 с аудио укажите путь к аудиофайлу.";
  if (code === "AUDIO_PATH_NOT_FOUND") return "Файл не найден по указанному пути к аудио.";
  if (code === "AUDIO_PATH_INVALID_EXT") return "Неподдерживаемый формат аудио. Используйте .mp3, .wav, .m4a или .aac.";
  if (["AUDIO_PATH_PREVIEW_ONLY", "AUDIO_PATH_NOT_LOCAL", "AUDIO_PATH_TRUNCATED"].includes(code)) {
    return "Путь к аудио выглядит неверно. Для MP4 с аудио укажите реальный локальный путь.";
  }
  return String(error?.message || error || "Не удалось собрать MP4");
}

function isProxySourcePath(rawPath = "") {
  const normalized = String(rawPath || "").toLowerCase();
  return normalized.includes("proxy") || normalized.includes("_proxy_") || normalized.includes("1280_12fps");
}


function isLikelyTruncatedJson(cleanText = "") {
  if (!cleanText.startsWith("{")) return false;
  return !cleanText.endsWith("}");
}

function computeImportCompatibilityScore(currentProject = {}, incoming = {}) {
  const currentSegments = Array.isArray(currentProject?.matchSegments) ? currentProject.matchSegments.length : 0;
  const incomingSegments = Array.isArray(incoming?.matchSegments) ? incoming.matchSegments.length : 0;
  const currentVideoDuration = Number(currentProject?.sourceVideo?.duration_sec || 0);
  const incomingVideoDuration = Number(incoming?.sourceVideo?.duration_sec || 0);
  const currentAudioDuration = Number(currentProject?.audioPreviewMeta?.duration_sec || currentProject?.timingContext?.audioDurationSec || 0);
  const incomingAudioDuration = Number(incoming?.timingContext?.audioDurationSec || 0);
  const durationDelta = Math.abs(currentVideoDuration - incomingVideoDuration);
  const audioDelta = Math.abs(currentAudioDuration - incomingAudioDuration);
  const segmentDelta = Math.abs(currentSegments - incomingSegments);
  return {
    currentSegments, incomingSegments, currentVideoDuration, incomingVideoDuration,
    currentAudioDuration, incomingAudioDuration,
    mismatch: segmentDelta >= 3 || durationDelta > 10 || audioDelta > 10,
  };
}

export default function VideoMatchBoardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const nodeId = String(searchParams.get("nodeId") || location.state?.nodeId || "default").trim() || "default";
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const backgroundAudioRef = useRef(null);
  const playbackRef = useRef(null);
  const activeVideoSourceKindRef = useRef("source");
  const objectUrlRef = useRef("");
  const audioObjectUrlRef = useRef("");
  const backgroundAudioObjectUrlRef = useRef("");
  const videoPlayTokenRef = useRef(0);
  const overrideUploadInputRef = useRef(null);
  const videoErrorHandledRef = useRef({});
  const audioErrorHandledRef = useRef({});
  const hydrateBlobCleanupRef = useRef({});
  const manuallyClearedNodeRef = useRef(false);
  const backendHydratedRef = useRef(false);
  const backendSaveTimerRef = useRef(null);
  const backendSaveSignatureRef = useRef("");
  const [workflowPreset, setWorkflowPreset] = useState(WORKFLOW_PRESETS[0].id);
  const [workflowStep, setWorkflowStep] = useState(WORKFLOW_PRESETS[0].steps[0]);

  const activePreset = useMemo(() => getPresetById(workflowPreset), [workflowPreset]);
  const nextRecommendedStep = useMemo(() => {
    const index = activePreset.steps.indexOf(workflowStep);
    return index >= 0 && index < activePreset.steps.length - 1 ? activePreset.steps[index + 1] : workflowStep;
  }, [activePreset, workflowStep]);

  const initialProject = useMemo(() => {
    const stateProject = location.state?.project || null;
    const savedProject = readVideoMatchBoardProjectForNode(nodeId);
    const hasStateProject = Boolean(stateProject);
    const stateStats = getVideoMatchProjectStats(stateProject);
    const savedStats = getVideoMatchProjectStats(savedProject);
    let picked = "default";
    let nextProject = getDefaultVideoMatchBoardProject(nodeId);

    const stateHasBlob = String(stateProject?.sourceVideoUrl || "").startsWith("blob:") || String(stateProject?.audioPreviewUrl || "").startsWith("blob:");
    const savedHasBlob = String(savedProject?.sourceVideoUrl || "").startsWith("blob:") || String(savedProject?.audioPreviewUrl || "").startsWith("blob:");
    const stateSignature = String(stateProject?.importSignature || "");
    const savedSignature = String(savedProject?.importSignature || "");
    const stateImportedAt = Number(stateProject?.importedAt || 0);
    const savedImportedAt = Number(savedProject?.importedAt || 0);
    const stateSegments = Number(stateStats.matchSegmentsCount || 0);
    const savedSegments = Number(savedStats.matchSegmentsCount || 0);
    const stateIsStaleVsSaved = Boolean(
      manuallyClearedNodeRef.current
      || (savedProject && (
        (savedSignature && stateSignature && savedSignature !== stateSignature && (savedImportedAt >= stateImportedAt || stateHasBlob))
        || (stateHasBlob && savedSegments >= stateSegments)
        || (savedSegments > stateSegments)
      ))
    );

    if (savedProject && (!stateProject || shouldSkipVideoMatchPersistToProtectMaterials(stateProject, savedProject) || stateIsStaleVsSaved)) {
      picked = "saved";
      nextProject = savedProject;
    } else if (stateProject && !manuallyClearedNodeRef.current) {
      picked = "state";
      nextProject = {
        ...stateProject,
        sourceVideoUrl: String(stateProject?.sourceVideoUrl || "").startsWith("blob:") ? "" : String(stateProject?.sourceVideoUrl || ""),
        audioPreviewUrl: String(stateProject?.audioPreviewUrl || "").startsWith("blob:") ? "" : String(stateProject?.audioPreviewUrl || ""),
      };
    } else if (stateProject && manuallyClearedNodeRef.current) {
      picked = "rejected_state_stale";
    }

    console.info("[VIDEO MATCH PAGE HYDRATE]", {
      nodeId,
      hasStateProject,
      stateSegments,
      savedSegments,
      stateImportedAt,
      savedImportedAt,
      stateSignature,
      savedSignature,
      stateHasBlob,
      savedHasBlob,
      picked,
    });
    return nextProject;
  }, [location.state?.project, nodeId]);

  const [project, setProject] = useState(initialProject);
  const [videoDurationSec, setVideoDurationSec] = useState(Number(initialProject?.sourceVideo?.duration_sec || 0));
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [audioDurationSec, setAudioDurationSec] = useState(Number(initialProject?.audioPreviewMeta?.duration_sec || 0));
  const [audioCurrentTimeSec, setAudioCurrentTimeSec] = useState(0);
  const [sourceVideoLoadMessage, setSourceVideoLoadMessage] = useState("");
  const [videoDiagnostics, setVideoDiagnostics] = useState({
    lastEvent: "init",
    currentSrc: "",
    videoWidth: 0,
    videoHeight: 0,
    duration: 0,
    readyState: 0,
    networkState: 0,
    currentTime: 0,
    errorCode: 0,
    errorMessage: "",
  });
  const [audioLoadMessage, setAudioLoadMessage] = useState("");
  const [previewCandidateId, setPreviewCandidateId] = useState("");
  const [isAssemblyPlaying, setIsAssemblyPlaying] = useState(false);
  const [isPlaybackActive, setIsPlaybackActive] = useState(false);
  const [assembleAudioPath, setAssembleAudioPath] = useState("");
  const [isAssemblingMp4, setIsAssemblingMp4] = useState(false);
  const [assembledPreview, setAssembledPreview] = useState(null);
  const [assembleError, setAssembleError] = useState("");
  const [assembleWarning, setAssembleWarning] = useState("");
  const [importWarnings, setImportWarnings] = useState([]);
  const [pendingImportResult, setPendingImportResult] = useState(null);
  const [stateOrigin, setStateOrigin] = useState(location.state?.project ? "state_restored" : "storage_restored");
  const [jsonInputDraft, setJsonInputDraft] = useState("");
  const [boardGeneratedClips, setBoardGeneratedClips] = useState([]);
  const [boardGeneratedClipsStatus, setBoardGeneratedClipsStatus] = useState("");

  const refreshBoardGeneratedClips = useCallback(async (reason = "auto") => {
    try {
      const clips = await fetchBoardGeneratedClipsFromWorkspace();
      setBoardGeneratedClips(clips);
      setBoardGeneratedClipsStatus(clips.length ? `Клипы с доски: ${clips.length}` : "На доске пока нет готовых видео");
      console.info("[VIDEO MATCH BOARD CLIPS LOADED]", { reason, count: clips.length, clips });
      return clips;
    } catch (error) {
      setBoardGeneratedClipsStatus(`Не удалось прочитать Доску: ${String(error?.message || error)}`);
      console.warn("[VIDEO MATCH BOARD CLIPS LOAD_FAILED]", { reason, error: String(error?.message || error) });
      return [];
    }
  }, []);

  useEffect(() => {
    void refreshBoardGeneratedClips("mount");
  }, [refreshBoardGeneratedClips]);


  useEffect(() => {
    const nextPreset = initialProject?.workflowPreset || WORKFLOW_PRESETS[0].id;
    const preset = getPresetById(nextPreset);
    const nextStep = initialProject?.workflowStep && preset.steps.includes(initialProject.workflowStep)
      ? initialProject.workflowStep
      : preset.steps[0];

    setWorkflowPreset(preset.id);
    setWorkflowStep(nextStep || "");
  }, [initialProject?.workflowPreset, initialProject?.workflowStep]);

  const matchSegments = Array.isArray(project.matchSegments) ? project.matchSegments : [];
  const videoBlocks = Array.isArray(project.videoBlocks) ? project.videoBlocks : [];
  const assemblyBlocks = useMemo(() => [...videoBlocks].sort((a, b) => getBlockTargetStart(a) - getBlockTargetStart(b)), [videoBlocks]);
  const selectedBlock = videoBlocks.find((block) => block.id === project.selectedBlockId) || assemblyBlocks[0] || null;
  const sourceVideoUrl = String(project.sourceVideoUrl || "");
  const audioPreviewUrl = String(project.audioPreviewUrl || "");
  const runtimeSourceVideoUrlRef = useRef(String(initialProject?.sourceVideoUrl || "").startsWith("blob:") ? String(initialProject?.sourceVideoUrl || "") : "");
  const runtimeAudioPreviewUrlRef = useRef(String(initialProject?.audioPreviewUrl || "").startsWith("blob:") ? String(initialProject?.audioPreviewUrl || "") : "");
  const useAudioPreview = Boolean(project.useAudioPreview);
  const wantsAssembleWithAudio = useAudioPreview;
  const resolvedAssembleAudioPath = String(assembleAudioPath || project?.timingContext?.sourceAudioPath || "").trim();
  const assembleAudioPathValidation = validateAssembleAudioPath(resolvedAssembleAudioPath);
  const isAssembleAudioPathValid = assembleAudioPathValidation.ok;
  const audioPathInputError = wantsAssembleWithAudio && !isAssembleAudioPathValid;
  const timelineDuration = videoDurationSec || Number(project?.sourceVideo?.duration_sec || 0) || 0;
  const effectiveAudioDurationSec = audioDurationSec || Number(project?.audioPreviewMeta?.duration_sec || 0) || 0;
  const assemblyDurationSec = Math.max(0, ...assemblyBlocks.map((block) => getBlockTargetEnd(block)));
  const assembledPreviewOutputUrl = resolveOutputUrl(assembledPreview?.outputUrl || "");
  const candidatesTotal = matchSegments.reduce((total, segment) => total + (Array.isArray(segment?.candidates) ? segment.candidates.length : 0), 0);
  const selectedSegment = matchSegments.find((segment) => segment.id === project.selectedSegmentId || segment.audioSceneId === project.selectedSegmentId) || matchSegments[0] || null;
  const selectedSegmentCandidates = Array.isArray(selectedSegment?.candidates) ? selectedSegment.candidates : [];
  const selectedBoardClip = useMemo(() => findBoardClipForSegment(selectedSegment, boardGeneratedClips), [selectedSegment, boardGeneratedClips]);
  const currentPlayingBlockId = videoBlocks.find((block) => {
    const { clipStart, clipEnd } = getBlockClipRange(block);
    return currentTimeSec >= clipStart && currentTimeSec < clipEnd;
  })?.id || "";
  const sourceTimelineMarkers = assemblyBlocks.length ? assemblyBlocks : videoBlocks;
  const selectedMarkerIndex = sourceTimelineMarkers.findIndex((block) => block.id === project.selectedBlockId);
  const markerProgressPercent = sourceTimelineMarkers.length > 1 && selectedMarkerIndex >= 0
    ? getSceneOrderMarkerLeft(selectedMarkerIndex, sourceTimelineMarkers.length)
    : 0;
  const sourceTimelineInnerWidth = Math.max(760, sourceTimelineMarkers.length * 28);

  const patchProject = (patch = {}, persistOptions = {}) => {
    if (!patch || typeof patch !== "object" || !Object.keys(patch).length) {
      console.info("[VIDEO MATCH SAVE SKIPPED_NO_MEANINGFUL_CHANGE]", { nodeId, reason: "empty_patch" });
      return;
    }
    setProject((prev) => persistVideoMatchBoardProject({ ...prev, ...(patch || {}), nodeId, sourceNodeId: nodeId }, persistOptions));
  };

  const updateVideoDiagnostics = useCallback((eventName = "event", extra = {}) => {
    const video = videoRef.current;
    const mediaError = video?.error || null;
    setVideoDiagnostics({
      lastEvent: eventName,
      currentSrc: String(video?.currentSrc || video?.src || ""),
      videoWidth: Number(video?.videoWidth || 0),
      videoHeight: Number(video?.videoHeight || 0),
      duration: Number(video?.duration || 0),
      readyState: Number(video?.readyState || 0),
      networkState: Number(video?.networkState || 0),
      currentTime: Number(video?.currentTime || 0),
      errorCode: Number(extra.errorCode || mediaError?.code || 0),
      errorMessage: String(extra.errorMessage || mediaError?.message || ""),
    });
  }, []);

  const logVideoPlayerAction = useCallback((action, reason = "", extra = {}) => {
    const video = videoRef.current;
    console.info("[VIDEO PLAYER ACTION]", {
      action,
      reason,
      sceneId: String(extra.sceneId || ""),
      src: String(video?.currentSrc || video?.src || ""),
      currentTime: Number(video?.currentTime || 0),
      readyState: Number(video?.readyState || 0),
      paused: Boolean(video?.paused ?? true),
      playToken: Number(videoPlayTokenRef.current || 0),
      ...extra,
    });
  }, []);

  const waitForVideoReady = useCallback((videoEl) => new Promise((resolve, reject) => {
    if (!videoEl) {
      reject(new Error("video_missing"));
      return;
    }
    if (videoEl.readyState >= 2) {
      resolve();
      return;
    }
    const onReady = () => cleanup(() => resolve());
    const onError = () => cleanup(() => reject(new Error("video_load_error")));
    const cleanup = (cb) => {
      videoEl.removeEventListener("loadedmetadata", onReady);
      videoEl.removeEventListener("canplay", onReady);
      videoEl.removeEventListener("error", onError);
      cb();
    };
    videoEl.addEventListener("loadedmetadata", onReady, { once: true });
    videoEl.addEventListener("canplay", onReady, { once: true });
    videoEl.addEventListener("error", onError, { once: true });
  }), []);

  const safePauseVideo = useCallback((videoEl, reason = "") => {
    videoPlayTokenRef.current = (videoPlayTokenRef.current || 0) + 1;
    logVideoPlayerAction("pause", reason);
    if (!videoEl) return;
    try {
      videoEl.pause();
    } catch (error) {
      console.warn("[VIDEO PLAYER PAUSE FAILED]", { reason, error });
    }
  }, [logVideoPlayerAction]);

  const safePlayVideo = useCallback(async (videoEl, reason = "", meta = {}, expectedToken = null) => {
    if (!videoEl) return { ok: false, cancelled: false, reason: "video_missing" };
    const token = Number.isFinite(Number(expectedToken))
      ? Number(expectedToken)
      : ((videoPlayTokenRef.current || 0) + 1);
    if (!Number.isFinite(Number(expectedToken))) videoPlayTokenRef.current = token;
    try {
      if (!videoEl.src) return { ok: false, cancelled: false, reason: "video_src_missing" };
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (videoPlayTokenRef.current !== token) return { ok: false, cancelled: true, reason: "token_cancelled" };
      const playPromise = videoEl.play();
      if (playPromise && typeof playPromise.then === "function") await playPromise;
      if (videoPlayTokenRef.current !== token) return { ok: false, cancelled: true, reason: "token_cancelled" };
      logVideoPlayerAction("play", reason, { ...meta, playToken: token });
      return { ok: true };
    } catch (error) {
      const message = String(error?.message || error || "");
      if (message.includes("interrupted by a call to pause")) {
        console.warn("[VIDEO PLAYER PLAY INTERRUPTED]", {
          reason,
          sceneId: String(meta.sceneId || ""),
          src: String(videoEl?.currentSrc || videoEl?.src || ""),
          currentTime: Number(videoEl?.currentTime || 0),
          playToken: token,
          message,
        });
        return { ok: false, cancelled: true, reason: "interrupted_by_pause", message };
      }
      console.warn("[VIDEO PLAYER PLAY FAILED]", { reason, message });
      return { ok: false, cancelled: false, reason: "play_failed", message };
    }
  }, [logVideoPlayerAction]);

  const getSelectionPatchForBlock = (block = {}) => ({
    selectedBlockId: block?.id || "",
    selectedSegmentId: block?.segmentId || block?.audioSceneId || "",
    selectedCandidateId: block?.candidateId || block?.id || "",
  });

  const onSelectBlock = (block = {}) => {
    patchProject(getSelectionPatchForBlock(block), { lastGood: false });
    const seekTo = Math.max(0, Number(getBlockClipRange(block).clipStart || 0));
    const video = videoRef.current;
    const isActivePlayback = Boolean(playbackRef.current);
    if (!video || !sourceVideoUrl) return;
    if (!isActivePlayback) safePauseVideo(video, "scene_select_prepare_seek");
    const applySeek = () => {
      const duration = Number(video.duration || 0);
      if (duration > 0 && seekTo > duration) {
        const msg = `Сцена начинается за пределами видео (${formatSec(seekTo)} > ${formatSec(duration)}).`;
        setSourceVideoLoadMessage(msg);
        patchProject({ jsonError: msg }, { lastGood: false });
        return;
      }
      video.currentTime = seekTo;
      setCurrentTimeSec(seekTo);
      updateVideoDiagnostics("scene_seek_applied");
    };
    if (Number(video.readyState || 0) >= 1) {
      applySeek();
    } else {
      const onReady = () => {
        video.removeEventListener("loadedmetadata", onReady);
        video.removeEventListener("canplay", onReady);
        applySeek();
      };
      video.addEventListener("loadedmetadata", onReady, { once: true });
      video.addEventListener("canplay", onReady, { once: true });
    }
  };

  useEffect(() => {
    setProject(initialProject);
    setVideoDurationSec(Number(initialProject?.sourceVideo?.duration_sec || 0));
    setAudioDurationSec(Number(initialProject?.audioPreviewMeta?.duration_sec || 0));
    setCurrentTimeSec(0);
    setAudioCurrentTimeSec(0);
    setSourceVideoLoadMessage("");
    setAudioLoadMessage("");
    setPreviewCandidateId("");
    setIsAssemblyPlaying(false);
    setIsPlaybackActive(false);
    setAssembleAudioPath(String(initialProject?.assembleAudioPath || initialProject?.audioPath || ""));
    setAssembledPreview(null);
    setAssembleError("");
    setAssembleWarning("");
    playbackRef.current = null;
  }, [initialProject]);

  useEffect(() => {
    const onBeforeUnload = () => {
      try {
        writeVideoMatchEmergencyProject(nodeId, project);
      } catch {}
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [nodeId, project]);


  useEffect(() => {
    let cancelled = false;
    if (backendHydratedRef.current) return () => {};
    backendHydratedRef.current = true;

    fetchVideoNodeWorkspaceProject()
      .then((workspaceProject) => {
        if (cancelled || !workspaceProject) return;
        const currentStats = getVideoMatchProjectStats(project);
        const backendStats = getVideoMatchProjectStats(workspaceProject);
        const currentUpdatedAt = Number(project?.updatedAt || 0);
        const backendUpdatedAt = Number(workspaceProject?.updatedAt || workspaceProject?.savedAt || 0);
        const shouldRestore = Number(backendStats.matchSegmentsCount || 0) > Number(currentStats.matchSegmentsCount || 0)
          || (Number(backendStats.matchSegmentsCount || 0) > 0 && backendUpdatedAt >= currentUpdatedAt);
        if (!shouldRestore) return;
        const restoredProject = persistVideoMatchBoardProject({
          ...workspaceProject,
          nodeId,
          sourceNodeId: String(workspaceProject?.sourceNodeId || nodeId),
        }, { emergency: true });
        setProject(restoredProject);
        setVideoDurationSec(Number(restoredProject?.sourceVideo?.duration_sec || 0));
        setAudioDurationSec(Number(restoredProject?.audioPreviewMeta?.duration_sec || restoredProject?.timingContext?.audioDurationSec || 0));
        setAssembleAudioPath(String(restoredProject?.assembleAudioPath || restoredProject?.audioPath || ""));
        setStateOrigin("backend_workspace_restored");
        console.info("[VIDEO MATCH BACKEND WORKSPACE RESTORED]", {
          nodeId,
          backendStats,
          currentStats,
        });
      })
      .catch((error) => {
        console.warn("[VIDEO MATCH BACKEND WORKSPACE LOAD_FAILED]", { nodeId, error: String(error?.message || error) });
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  useEffect(() => {
    if (!project || manuallyClearedNodeRef.current) return () => {};
    const stats = getVideoMatchProjectStats(project);
    const hasUsefulState = Number(stats.matchSegmentsCount || 0) > 0
      || Number(stats.videoBlocksCount || 0) > 0
      || Boolean(project.sourceVideoPath || project?.sourceVideo?.path || project.sourceVideoUrl || project.importSignature);
    if (!hasUsefulState) return () => {};

    const payload = makeVideoNodeWorkspacePayload(project, nodeId);
    const signature = JSON.stringify({
      nodeId,
      segments: Number(payload?.stats?.matchSegmentsCount || 0),
      blocks: Number(payload?.stats?.videoBlocksCount || 0),
      sourcePath: String(payload?.project?.sourceVideoPath || payload?.project?.sourceVideo?.path || ""),
      importSignature: String(payload?.project?.importSignature || ""),
      selectedBlockId: String(payload?.project?.selectedBlockId || ""),
      updatedAt: Number(payload?.project?.updatedAt || 0),
    });
    if (signature === backendSaveSignatureRef.current) return () => {};
    backendSaveSignatureRef.current = signature;

    if (backendSaveTimerRef.current) clearTimeout(backendSaveTimerRef.current);
    backendSaveTimerRef.current = setTimeout(() => {
      saveVideoNodeWorkspaceProject(project, nodeId)
        .then(() => console.info("[VIDEO MATCH BACKEND WORKSPACE SAVED]", { nodeId, stats }))
        .catch((error) => console.warn("[VIDEO MATCH BACKEND WORKSPACE SAVE_FAILED]", { nodeId, error: String(error?.message || error) }));
    }, 700);

    return () => {
      if (backendSaveTimerRef.current) clearTimeout(backendSaveTimerRef.current);
    };
  }, [nodeId, project]);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current);
  }, []);

  useEffect(() => {
    if (!String(initialProject?.sourceVideoUrl || "").startsWith("blob:")) return;
    const hydrateKey = `${nodeId}:${String(initialProject?.updatedAt || 0)}`;
    if (hydrateBlobCleanupRef.current[hydrateKey]) return;
    hydrateBlobCleanupRef.current[hydrateKey] = true;
    runtimeSourceVideoUrlRef.current = "";
    setSourceVideoLoadMessage("Видео для предпросмотра недоступно после перезагрузки. Загрузите source video заново. Тайминг и candidates сохранены.");
    console.info("[VIDEO MATCH BLOB PREVIEW CLEARED]", {
      reason: "reload_blob_source_video_unavailable",
      keptSegments: Array.isArray(initialProject?.matchSegments) ? initialProject.matchSegments.length : 0,
      keptSourceVideoPath: String(initialProject?.sourceVideo?.path || initialProject?.source_video?.path || initialProject?.sourceVideoPath || "").trim(),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProject?.sourceVideoUrl, initialProject?.updatedAt, nodeId]);

  useEffect(() => {
    if (!String(initialProject?.audioPreviewUrl || "").startsWith("blob:")) return;
    runtimeAudioPreviewUrlRef.current = "";
    setAudioLoadMessage("Аудио для предпросмотра недоступно после перезагрузки. Загрузите аудио заново. Тайминг сохранён.");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProject?.audioPreviewUrl]);

  const showMissingSourceVideoMessage = () => {
    setSourceVideoLoadMessage("Загрузите source video заново");
    patchProject({ jsonError: "Загрузите source video заново" }, { lastGood: false });
  };

  const showMissingAudioMessage = () => {
    setAudioLoadMessage("Загрузите аудио");
    patchProject({ jsonError: "Загрузите аудио для просмотра с аудио" }, { lastGood: false });
  };

  const stopPlayback = () => {
    playbackRef.current = null;
    setIsAssemblyPlaying(false);
    setIsPlaybackActive(false);
    if (videoRef.current) {
      safePauseVideo(videoRef.current, "stop_playback");
      videoRef.current.muted = false;
    }
    if (audioRef.current) audioRef.current.pause();
    if (backgroundAudioRef.current) backgroundAudioRef.current.pause();
  };

  const applyPreviewVideoAudioMix = (mutedByPlayback = false) => {
    const mode = String(project.audioMix?.originalVideoAudioMode || "duck");
    const configuredVolume = Number(project.audioMix?.originalVideoVolume ?? 0.10);
    const videoVolume = Number.isFinite(configuredVolume)
      ? Math.max(0, Math.min(1, configuredVolume))
      : (mode === "duck" ? 0.25 : 1);
    if (!videoRef.current) return;
    if (mutedByPlayback || mode === "mute") {
      videoRef.current.muted = true;
      videoRef.current.volume = 0;
      return;
    }
    videoRef.current.muted = false;
    videoRef.current.volume = mode === "duck" ? (videoVolume || 0.25) : (videoVolume || 1);
  };

  useEffect(() => {
    if (!videoRef.current) return;
    applyPreviewVideoAudioMix(false);
  }, [
    project?.audioMix?.originalVideoAudioMode,
    project?.audioMix?.originalVideoVolume,
  ]);

  const restoreSourceVideoElement = () => {
    if (!videoRef.current || !sourceVideoUrl) return;
    activeVideoSourceKindRef.current = "source";
    const currentSrc = String(videoRef.current.src || "");
    const expectedSrc = String(sourceVideoUrl || "");
    const resolvedExpectedSrc = (() => {
      try {
        return new URL(expectedSrc, window.location.href).href;
      } catch {
        return expectedSrc;
      }
    })();
    if (currentSrc !== expectedSrc && currentSrc !== resolvedExpectedSrc) {
      videoRef.current.src = sourceVideoUrl;
    }
  };

  const getOverrideBlockEndSec = (block = {}) => {
    const overrideDuration = Number(block?.overrideDurationSec || 0);
    const sourceEnd = getBlockSourceEnd(block);
    const targetDuration = Math.max(0, getBlockTargetEnd(block) - getBlockTargetStart(block));
    const baseEnd = Math.max(0, overrideDuration || sourceEnd);
    return targetDuration > 0 ? Math.min(baseEnd, targetDuration) : baseEnd;
  };

  const playOverrideRange = async (block = {}, { muted = false } = {}) => {
    const overrideUrl = getResolvedOverrideUrl(block);
    if (!overrideUrl || !videoRef.current) return false;
    const requestToken = (videoPlayTokenRef.current || 0) + 1;
    videoPlayTokenRef.current = requestToken;
    activeVideoSourceKindRef.current = "override";
    applyPreviewVideoAudioMix(Boolean(muted));
    safePauseVideo(videoRef.current, "override_before_src_change");
    videoPlayTokenRef.current = requestToken;
    logVideoPlayerAction("src_change", "override_src_set", { src: overrideUrl, sceneId: block?.id || "" });
    videoRef.current.src = overrideUrl;
    videoRef.current.currentTime = 0;
    videoRef.current.load();
    try {
      await waitForVideoReady(videoRef.current);
      if (videoPlayTokenRef.current !== requestToken) {
        console.info("[VIDEO PLAYER REQUEST CANCELLED BEFORE PLAY]", { reason: "token_changed_before_play", sceneId: block?.id || "" });
        return false;
      }
      const result = await safePlayVideo(videoRef.current, "play_override_range", { sceneId: block?.id || "" }, requestToken);
      if (!result.ok) {
        if (result.cancelled) {
          console.info("[VIDEO PLAYER PLAY CANCELLED QUIETLY]", { reason: result.reason, sceneId: block?.id || "" });
          return false;
        }
        throw new Error(result.message || result.reason || "override_play_failed");
      }
      return true;
    } catch (error) {
      patchProject({ jsonError: `Не удалось запустить override video: ${String(error?.message || error)}` }, { lastGood: false });
      return false;
    }
  };

  const playSourceRange = async (start = 0, end = 0, { muted = false } = {}) => {
    if (!sourceVideoUrl || !videoRef.current) {
      showMissingSourceVideoMessage();
      return false;
    }
    const requestToken = (videoPlayTokenRef.current || 0) + 1;
    videoPlayTokenRef.current = requestToken;
    restoreSourceVideoElement();
    activeVideoSourceKindRef.current = "source";
    applyPreviewVideoAudioMix(Boolean(muted));
    safePauseVideo(videoRef.current, "source_seek_before_play");
    videoPlayTokenRef.current = requestToken;
    videoRef.current.currentTime = Math.max(0, Number(start || 0));
    logVideoPlayerAction("seek", "source_range_seek", { currentTime: Number(videoRef.current.currentTime || 0) });
    try {
      await waitForVideoReady(videoRef.current);
      if (videoPlayTokenRef.current !== requestToken) {
        console.info("[VIDEO PLAYER REQUEST CANCELLED BEFORE PLAY]", { reason: "token_changed_before_play" });
        return false;
      }
      const result = await safePlayVideo(videoRef.current, "play_source_range", {}, requestToken);
      if (!result.ok) {
        if (result.cancelled) {
          console.info("[VIDEO PLAYER PLAY CANCELLED QUIETLY]", { reason: result.reason });
          return false;
        }
        throw new Error(result.message || result.reason || "source_play_failed");
      }
      return true;
    } catch (error) {
      patchProject({ jsonError: `Не удалось запустить video player: ${String(error?.message || error)}` }, { lastGood: false });
      return false;
    }
  };

  const playAudioFrom = async (start = 0) => {
    if (!audioPreviewUrl || !audioRef.current) {
      showMissingAudioMessage();
      return false;
    }
    const offsetSec = getAudioTimelineOffsetSec(project);
    const timelineSec = Math.max(0, Number(start || 0));
    const sourceAudioSec = Math.max(0, timelineSec - offsetSec);
    if (timelineSec < offsetSec) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setAudioCurrentTimeSec(0);
      return true;
    }
    audioRef.current.currentTime = sourceAudioSec;
    audioRef.current.volume = Number(project.audioMix?.narrationVolume ?? 1.0);
    if (backgroundAudioRef.current && project.audioMix?.backgroundAudioUrl) {
      backgroundAudioRef.current.currentTime = sourceAudioSec;
      backgroundAudioRef.current.volume = Number(project.audioMix?.backgroundAudioVolume ?? 0.6);
      try {
        await backgroundAudioRef.current.play();
      } catch {
        // no-op for autoplay restrictions
      }
    }
    try {
      await audioRef.current.play();
      return true;
    } catch (error) {
      patchProject({ jsonError: `Не удалось запустить audio player: ${String(error?.message || error)}` }, { lastGood: false });
      return false;
    }
  };

  const startVideoOnlyBlock = async (block = {}) => {
    const isOverride = isOverrideBlock(block) && block.overrideVideoUrl;
    const { clipStart, clipEnd } = getBlockClipRange(block);
    const start = isOverride ? 0 : clipStart;
    const end = isOverride ? getOverrideBlockEndSec(block) : clipEnd;
    playbackRef.current = { mode: isOverride ? "override_video_range" : "video_range", end, blocks: [], index: 0, currentBlockId: block.id || "" };
    if (audioRef.current) audioRef.current.pause();
    setIsAssemblyPlaying(false);
    setIsPlaybackActive(true);
    const shouldMute = isTruthyFlag(block?.forceMuteVideoAudio ?? block?.force_mute_video_audio);
    const didPlay = isOverride
      ? await playOverrideRange(block, { muted: shouldMute })
      : await playSourceRange(start, end, { muted: shouldMute });
    if (!didPlay) setIsPlaybackActive(false);
    return didPlay;
  };

  const startAudioSyncedBlock = async (block = {}) => {
    if (!audioPreviewUrl || !audioRef.current) {
      showMissingAudioMessage();
      return false;
    }
    const targetStart = getBlockTargetStart(block);
    const sourceAudioStart = Number(block?.source_audio_t0 ?? block?.sourceAudioStartSec ?? 0);
    const computedOffset = getAudioTimelineOffsetSec(project);
    if (targetStart > 0 && sourceAudioStart === 0 && computedOffset <= 0) {
      console.warn("BOARD_AUDIO_OFFSET_MISSING", {
        blockId: String(block?.id || block?.audioSceneId || ""),
        targetStart,
        sourceAudioStart,
        computedOffset,
      });
    }
    const targetEnd = getBlockTargetEnd(block);
    playbackRef.current = {
      mode: "audio_range",
      blocks: [block],
      index: 0,
      targetEnd,
      currentBlockId: block.id || "",
    };
    setIsAssemblyPlaying(false);
    setIsPlaybackActive(true);
    const shouldMute = isTruthyFlag(block?.forceMuteVideoAudio ?? block?.force_mute_video_audio);
    const didStartVideo = (isOverrideBlock(block) && block.overrideVideoUrl)
      ? await playOverrideRange(block, { muted: shouldMute })
      : await playSourceRange(getBlockClipRange(block).clipStart, getBlockClipRange(block).clipEnd, { muted: shouldMute });
    if (!didStartVideo) {
      setIsPlaybackActive(false);
      return false;
    }
    const didStartAudio = await playAudioFrom(targetStart);
    if (!didStartAudio) {
      if (videoRef.current) safePauseVideo(videoRef.current, "audio_start_failed_pause_video");
      setIsPlaybackActive(false);
      return false;
    }
    return true;
  };

  const onPlaySelectedBlock = async () => {
    if (!selectedBlock) return;
    onSelectBlock(selectedBlock);
    if (useAudioPreview) {
      await startAudioSyncedBlock(selectedBlock);
      return;
    }
    await startVideoOnlyBlock(selectedBlock);
  };

  const playAssemblyFromBlock = async (startBlock = null) => {
    if (!assemblyBlocks.length) return;
    restoreSourceVideoElement();
    if (!sourceVideoUrl || !videoRef.current) {
      showMissingSourceVideoMessage();
      return;
    }
    const rawIndex = assemblyBlocks.findIndex((block) => block.id === startBlock?.id);
    const startIndex = rawIndex >= 0 ? rawIndex : 0;
    const firstBlock = assemblyBlocks[startIndex] || assemblyBlocks[0];
    onSelectBlock(firstBlock);

    if (useAudioPreview) {
      if (!audioPreviewUrl || !audioRef.current) {
        showMissingAudioMessage();
        return;
      }
      playbackRef.current = {
        mode: "assembly_audio",
        blocks: assemblyBlocks,
        index: startIndex,
        targetEnd: getBlockTargetEnd(assemblyBlocks[assemblyBlocks.length - 1]),
        currentBlockId: firstBlock.id || "",
      };
      setIsAssemblyPlaying(true);
      setIsPlaybackActive(true);
      const firstShouldMute = isTruthyFlag(firstBlock?.forceMuteVideoAudio ?? firstBlock?.force_mute_video_audio);
      const didStartVideo = (isOverrideBlock(firstBlock) && firstBlock.overrideVideoUrl)
        ? await playOverrideRange(firstBlock, { muted: firstShouldMute })
        : await playSourceRange(getBlockClipRange(firstBlock).clipStart, getBlockClipRange(firstBlock).clipEnd, { muted: firstShouldMute });
      if (!didStartVideo) {
        setIsAssemblyPlaying(false);
        setIsPlaybackActive(false);
        return;
      }
      const didStartAudio = await playAudioFrom(getBlockTargetStart(firstBlock));
      if (!didStartAudio) {
        setIsAssemblyPlaying(false);
        setIsPlaybackActive(false);
        if (videoRef.current) safePauseVideo(videoRef.current, "assembly_audio_start_failed_pause_video");
      }
      return;
    }

    playbackRef.current = {
      mode: "assembly_video",
      end: (isOverrideBlock(firstBlock) && firstBlock.overrideVideoUrl) ? getOverrideBlockEndSec(firstBlock) : getBlockClipRange(firstBlock).clipEnd,
      blocks: assemblyBlocks,
      index: startIndex,
      currentBlockId: firstBlock.id || "",
    };
    setIsAssemblyPlaying(true);
    setIsPlaybackActive(true);
    const firstShouldMute = isTruthyFlag(firstBlock?.forceMuteVideoAudio ?? firstBlock?.force_mute_video_audio);
    const didPlay = (isOverrideBlock(firstBlock) && firstBlock.overrideVideoUrl)
      ? await playOverrideRange(firstBlock, { muted: firstShouldMute })
      : await playSourceRange(getBlockClipRange(firstBlock).clipStart, getBlockClipRange(firstBlock).clipEnd, { muted: firstShouldMute });
    if (!didPlay) {
      setIsAssemblyPlaying(false);
      setIsPlaybackActive(false);
    }
  };

  const onTimeUpdate = () => {
    const current = Number(videoRef.current?.currentTime || 0);
    setCurrentTimeSec(current);
    const playback = playbackRef.current;
    if (!playback) return;

    if (playback.mode === "audio_range" || playback.mode === "assembly_audio") {
      const currentBlock = playback.blocks?.[playback.index] || selectedBlock;
      const sourceEnd = (isOverrideBlock(currentBlock) && currentBlock.overrideVideoUrl) ? getOverrideBlockEndSec(currentBlock) : getBlockClipRange(currentBlock).clipEnd;
      if (sourceEnd > 0 && current >= sourceEnd && videoRef.current) {
        safePauseVideo(videoRef.current, "audio_mode_reached_source_end");
        videoRef.current.currentTime = sourceEnd;
        setCurrentTimeSec(sourceEnd);
      }
      return;
    }

    const stopAt = Number(playback?.end || 0);
    if (stopAt > 0 && current >= stopAt) {
      safePauseVideo(videoRef.current, "video_mode_reached_segment_end");
      videoRef.current.currentTime = stopAt;
      setCurrentTimeSec(stopAt);
      const nextIndex = Number(playback?.index || 0) + 1;
      const nextBlock = Array.isArray(playback?.blocks) ? playback.blocks[nextIndex] : null;
      if (nextBlock) {
        playbackRef.current = { ...playback, index: nextIndex, end: getBlockClipRange(nextBlock).clipEnd, currentBlockId: nextBlock.id || "" };
        onSelectBlock(nextBlock);
        const nextShouldMute = isTruthyFlag(nextBlock?.forceMuteVideoAudio ?? nextBlock?.force_mute_video_audio);
        if (isOverrideBlock(nextBlock) && nextBlock.overrideVideoUrl) {
          playbackRef.current = { ...playbackRef.current, mode: "assembly_video", end: getOverrideBlockEndSec(nextBlock) };
          void playOverrideRange(nextBlock, { muted: nextShouldMute });
        } else {
          void playSourceRange(getBlockClipRange(nextBlock).clipStart, getBlockClipRange(nextBlock).clipEnd, { muted: nextShouldMute });
        }
        return;
      }
      playbackRef.current = null;
      setIsAssemblyPlaying(false);
      setIsPlaybackActive(false);
    }
  };

  const onAudioTimeUpdate = () => {
    const current = Number(audioRef.current?.currentTime || 0);
    const offsetSec = getAudioTimelineOffsetSec(project);
    const timelineAudioTime = current + offsetSec;
    setAudioCurrentTimeSec(timelineAudioTime);
    if (backgroundAudioRef.current) {
      const bg = backgroundAudioRef.current;
      const bgDuration = Number(bg.duration || 0);
      const targetBgTime = bgDuration > 0 ? timelineAudioTime % bgDuration : timelineAudioTime;
      if (Math.abs(Number(bg.currentTime || 0) - targetBgTime) > 0.35) {
        bg.currentTime = Math.max(0, targetBgTime);
      }
    }
    const playback = playbackRef.current;
    if (!playback || (playback.mode !== "audio_range" && playback.mode !== "assembly_audio")) return;

    if (playback.mode === "audio_range") {
      const targetEnd = Number(playback.targetEnd || 0);
      if (targetEnd > 0 && timelineAudioTime >= targetEnd) {
        stopPlayback();
      }
      return;
    }

    const blocks = Array.isArray(playback.blocks) ? playback.blocks : [];
    if (!blocks.length) return;
    const lastTargetEnd = Number(playback.targetEnd || getBlockTargetEnd(blocks[blocks.length - 1]));
    if (lastTargetEnd > 0 && timelineAudioTime >= lastTargetEnd) {
      stopPlayback();
      return;
    }

    const found = findAssemblyBlockByAudioTime(blocks, timelineAudioTime, playback.index);
    if (!found.block) return;
    if (found.index !== playback.index || found.block.id !== playback.currentBlockId) {
      playbackRef.current = {
        ...playback,
        index: found.index,
        currentBlockId: found.block.id || "",
      };
      onSelectBlock(found.block);
      const foundShouldMute = isTruthyFlag(found.block?.forceMuteVideoAudio ?? found.block?.force_mute_video_audio);
      if (isOverrideBlock(found.block) && found.block.overrideVideoUrl) {
        void playOverrideRange(found.block, { muted: foundShouldMute });
      } else {
        void playSourceRange(getBlockClipRange(found.block).clipStart, getBlockClipRange(found.block).clipEnd, { muted: foundShouldMute });
      }
    }
  };

  const onAudioEnded = () => {
    const playback = playbackRef.current;
    if (playback?.mode === "audio_range" || playback?.mode === "assembly_audio") stopPlayback();
    if (backgroundAudioRef.current) {
      backgroundAudioRef.current.pause();
      backgroundAudioRef.current.currentTime = 0;
    }
  };

  useEffect(() => {
    const backgroundAudioUrl = String(project?.audioMix?.backgroundAudioUrl || "").trim();
    if (backgroundAudioRef.current) {
      backgroundAudioRef.current.pause();
      backgroundAudioRef.current.src = "";
      backgroundAudioRef.current.load();
    }
    if (backgroundAudioObjectUrlRef.current) {
      URL.revokeObjectURL(backgroundAudioObjectUrlRef.current);
      backgroundAudioObjectUrlRef.current = "";
    }
    if (!backgroundAudioUrl) return;
    const audio = new Audio();
    audio.src = backgroundAudioUrl;
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = Number(project?.audioMix?.backgroundAudioVolume ?? 0.6);
    backgroundAudioRef.current = audio;
    if (backgroundAudioUrl.startsWith("blob:")) backgroundAudioObjectUrlRef.current = backgroundAudioUrl;
    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [project?.audioMix?.backgroundAudioUrl]);

  useEffect(() => {
    if (!backgroundAudioRef.current) return;
    backgroundAudioRef.current.volume = Number(project?.audioMix?.backgroundAudioVolume ?? 0.6);
  }, [project?.audioMix?.backgroundAudioVolume]);

  const onSelectCandidate = (segmentId = "", candidateId = "") => {
    const targetSegmentKey = String(segmentId || "").trim();
    const targetCandidateKey = String(candidateId || "").trim();
    const nextSegments = matchSegments.map((segment) => {
      if (getSegmentKey(segment) !== targetSegmentKey) return segment;
      return {
        ...segment,
        selectedCandidateId: targetCandidateKey,
        selected_candidate_id: targetCandidateKey,
      };
    });
    const nextBlocks = buildVideoBlocksFromMatchSegments(nextSegments, sourceVideoUrl);
    const nextBlock = nextBlocks.find((block) => getSegmentKey(block) === targetSegmentKey && getCandidateKey(block) === targetCandidateKey)
      || nextBlocks.find((block) => getSegmentKey(block) === targetSegmentKey)
      || nextBlocks[0]
      || null;
    patchProject({
      matchSegments: nextSegments,
      videoBlocks: nextBlocks,
      selectedSegmentId: targetSegmentKey,
      selectedCandidateId: targetCandidateKey,
      selectedBlockId: nextBlock?.id || "",
    });
  };

  const onPreviewCandidate = async (segment = {}, candidate = {}) => {
    setPreviewCandidateId(candidate.id || candidate.candidateId || candidate.candidate_id || "");
    if ((candidate?.reservedPlaceholder || candidate?.requiresOverrideVideo || candidate?.requires_override_video || candidate?.reserved_placeholder)
      && !candidate?.overrideVideoPath
      && !candidate?.overrideVideoUrl) {
      patchProject({
        jsonError: "Эта сцена зарезервирована под ваше видео. Нажмите “Заменить видео” и загрузите готовый intro/lip-sync ролик."
      }, { lastGood: false });
      return;
    }
    const candidateKey = getCandidateKey(candidate);
    const segmentKey = getSegmentKey(segment);
    const candidateBlock = assemblyBlocks.find((block) => {
      const blockCandidateKey = getCandidateKey(block);
      const blockSegmentKey = getSegmentKey(block);
      return blockCandidateKey === candidateKey || (blockSegmentKey === segmentKey && getCandidateKey(block) === candidateKey);
    });
    const shouldMutePreview = getEffectiveForceMuteVideoAudio(candidateBlock, segment, candidate);
    if (isOverrideCandidate(candidate) && candidate.overrideVideoUrl && videoRef.current) {
      playbackRef.current = null;
      setIsAssemblyPlaying(false);
      setIsPlaybackActive(true);
      if (audioRef.current) audioRef.current.pause();
      patchProject({ selectedSegmentId: segmentKey, selectedCandidateId: candidateKey }, { lastGood: false });
      const didPlay = await playOverrideRange(candidateBlock || candidate, { muted: shouldMutePreview });
      if (!didPlay) setIsPlaybackActive(false);
      return;
    }
    restoreSourceVideoElement();
    const segmentDuration = Math.max(0, Number(segment?.targetEndSec || 0) - Number(segment?.targetStartSec || 0));
    const start = Math.max(0, getBlockSourceStart(candidate));
    const end = Math.max(start, Math.min(getBlockSourceEnd(candidate), start + segmentDuration));
    playbackRef.current = { mode: "video_range", end, blocks: [], index: 0, currentBlockId: candidateKey };
    setIsAssemblyPlaying(false);
    setIsPlaybackActive(true);
    if (audioRef.current) audioRef.current.pause();
    patchProject({ selectedSegmentId: segmentKey, selectedCandidateId: candidateKey }, { lastGood: false });
    const didPlay = await playSourceRange(start, end, { muted: shouldMutePreview });
    if (!didPlay) setIsPlaybackActive(false);
  };

  const onUploadOverrideVideo = async (file) => {
    if (!file || !selectedSegment) return;
    const segmentId = getSegmentKey(selectedSegment);
    if (!segmentId) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("nodeId", nodeId);
    formData.append("segmentId", segmentId);
    formData.append("candidateType", "user_override");
    try {
      const response = await fetch(`${API_BASE}/api/video-match/override-upload`, {
        method: "POST",
        credentials: "include",
        headers: getVideoMatchAuthHeaders(),
        body: formData,
      });
      const data = await readVideoMatchJsonResponse(response);
      if (!response.ok || !data?.ok) throw new Error(getVideoMatchApiErrorMessage(data, response, "upload failed"));
      const durationSec = Number(data.durationSec || 0);
      const candidateId = `${segmentId}_override_${Date.now()}`;
      const selectedIsLipSync = isLipSyncScene(selectedSegment);
      const nextSegments = matchSegments.map((segment) => {
        if (getSegmentKey(segment) !== segmentId) return segment;
        const overrideCandidate = {
          id: candidateId,
          candidateId,
          candidate_id: candidateId,
          candidateType: "user_override",
          candidate_type: "user_override",
          sourceKind: "override_video",
          source_kind: "override_video",
          overrideVideoPath: data.overrideVideoPath,
          overrideVideoUrl: data.overrideVideoUrl,
          overrideDurationSec: durationSec,
          override_video_path: data.overrideVideoPath,
          override_video_url: data.overrideVideoUrl,
          override_duration_sec: durationSec,
          sourceVideoStartSec: 0,
          sourceVideoEndSec: durationSec,
          video_t0: 0,
          video_t1: durationSec,
          fit_mode: "override",
          useRealSourceClip: false,
          use_real_source_clip: false,
          scene_type: selectedSegment.scene_type || "",
          sceneType: selectedSegment.sceneType || selectedSegment.scene_type || "",
          route: selectedSegment.route || "",
          lip_sync_required: selectedIsLipSync || isTruthyFlag(selectedSegment.lip_sync_required),
          lipSyncRequired: selectedIsLipSync || isTruthyFlag(selectedSegment.lipSyncRequired),
          reservedGeneratedLipsync: selectedIsLipSync || isTruthyFlag(selectedSegment.reservedGeneratedLipsync ?? selectedSegment.reserved_generated_lipsync),
          reserved_generated_lipsync: selectedIsLipSync || isTruthyFlag(selectedSegment.reservedGeneratedLipsync ?? selectedSegment.reserved_generated_lipsync),
          video_match_role: selectedSegment.video_match_role || "",
          videoMatchRole: selectedSegment.videoMatchRole || selectedSegment.video_match_role || "",
          ls_id: selectedSegment.ls_id || selectedSegment.lip_id || "",
          lip_id: selectedSegment.lip_id || selectedSegment.ls_id || "",
          forceMuteVideoAudio: selectedIsLipSync,
          force_mute_video_audio: selectedIsLipSync,
          reservedPlaceholder: false,
          reserved_placeholder: false,
          requiresOverrideVideo: false,
          requires_override_video: false,
          confidence: 1,
          matchReason: "Пользовательская замена видео / lip-sync override.",
          match_reason: "Пользовательская замена видео / lip-sync override.",
          visualType: "user_override",
          visual_type: "user_override",
          shotType: "custom",
          shot_type: "custom",
          warnings: [],
        };
        return {
          ...segment,
          candidates: [...(Array.isArray(segment.candidates) ? segment.candidates : []), overrideCandidate],
          selectedCandidateId: candidateId,
          selected_candidate_id: candidateId,
          selectedCandidate: overrideCandidate,
          selected_candidate: overrideCandidate,
        };
      });
      const nextBlocks = buildVideoBlocksFromMatchSegments(nextSegments, sourceVideoUrl);
      const nextBlock = nextBlocks.find((block) => getSegmentKey(block) === segmentId && getCandidateKey(block) === candidateId) || null;
      patchProject({ matchSegments: nextSegments, videoBlocks: nextBlocks, selectedSegmentId: segmentId, selectedCandidateId: candidateId, selectedBlockId: nextBlock?.id || "", jsonError: "" });
      if (nextBlock?.overrideVideoUrl) setTimeout(() => {
        const shouldMutePreview = isTruthyFlag(nextBlock?.forceMuteVideoAudio ?? nextBlock?.force_mute_video_audio);
        void playOverrideRange(nextBlock, { muted: shouldMutePreview });
      }, 50);
    } catch (error) {
      patchProject({ jsonError: `Не удалось загрузить override: ${String(error?.message || error)}` }, { lastGood: false });
    }
  };

  const onUseBoardClipForSelectedSegment = () => {
    if (!selectedSegment) return;
    const segmentId = getSegmentKey(selectedSegment);
    if (!segmentId) return;
    const boardClip = selectedBoardClip;
    if (!boardClip) {
      patchProject({ jsonError: "Для этой сцены нет готового видео на Доске. Проверь scene_id/audio_scene_id." }, { lastGood: false });
      void refreshBoardGeneratedClips("missing_for_selected_scene");
      return;
    }
    const boardCandidate = buildBoardClipCandidate(selectedSegment, boardClip);
    const nextSegments = matchSegments.map((segment) => {
      if (getSegmentKey(segment) !== segmentId) return segment;
      const oldCandidates = Array.isArray(segment.candidates) ? segment.candidates : [];
      const cleanedCandidates = oldCandidates.filter((candidate) => !isBoardClipCandidate(candidate));
      return {
        ...segment,
        candidates: [...cleanedCandidates, boardCandidate],
        selectedCandidateId: boardCandidate.id,
        selected_candidate_id: boardCandidate.id,
        selectedCandidate: boardCandidate,
        selected_candidate: boardCandidate,
      };
    });
    const nextBlocks = buildVideoBlocksFromMatchSegments(nextSegments, sourceVideoUrl);
    const nextBlock = nextBlocks.find((block) => getSegmentKey(block) === segmentId && getCandidateKey(block) === boardCandidate.id) || null;
    patchProject({
      matchSegments: nextSegments,
      videoBlocks: nextBlocks,
      selectedSegmentId: segmentId,
      selectedCandidateId: boardCandidate.id,
      selectedBlockId: nextBlock?.id || "",
      jsonError: "",
    });
    setBoardGeneratedClipsStatus(`Взято с доски: ${boardClip.sceneId || segmentId}`);
    console.info("[VIDEO MATCH TAKE_FROM_BOARD_APPLIED]", { segmentId, boardClip, candidateId: boardCandidate.id, hasLocalPath: Boolean(boardCandidate.overrideVideoPath) });
    if (nextBlock?.overrideVideoUrl) setTimeout(() => {
      const shouldMutePreview = isTruthyFlag(nextBlock?.forceMuteVideoAudio ?? nextBlock?.force_mute_video_audio);
      void playOverrideRange(nextBlock, { muted: shouldMutePreview });
    }, 80);
  };

  const onVideoFileChange = async (file) => {
    if (!file) return;
    const fallbackJsonPath = String(project?.source_video?.path || project?.sourceVideo?.path || project?.sourceVideoPath || "").trim();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    runtimeSourceVideoUrlRef.current = url;
    setVideoDurationSec(0);
    setCurrentTimeSec(0);
    setSourceVideoLoadMessage("");
    stopPlayback();
    patchProject({
      sourceVideoUrl: url,
      sourceVideo: {
        ...(project.sourceVideo || {}),
        path: fallbackJsonPath,
        filename: file.name || "source.mp4",
        name: file.name || "source.mp4",
        durationSec: 0,
        duration_sec: 0,
        type: file.type || "video/mp4",
        size: file.size || 0,
      },
      source_video: {
        ...(project.source_video || {}),
        path: String(project?.source_video?.path || project?.sourceVideo?.path || project?.sourceVideoPath || "").trim(),
        filename: file.name || "source.mp4",
        duration_sec: 0,
      },
      jsonError: "",
      selectedBlockId: "",
      selectedSegmentId: "",
      selectedCandidateId: "",
    });
    if (videoRef.current) {
      safePauseVideo(videoRef.current, "video_file_change");
      videoRef.current.src = url;
      videoRef.current.currentTime = 0;
      videoRef.current.load();
      updateVideoDiagnostics("file_selected");
    }
    const formData = new FormData();
    formData.append("file", file);
    formData.append("nodeId", nodeId);
    try {
      const response = await fetch(`${API_BASE}/api/video-match/source-upload`, {
        method: "POST",
        credentials: "include",
        headers: getVideoMatchAuthHeaders(),
        body: formData,
      });
      const data = await readVideoMatchJsonResponse(response);
      if (!response.ok || !data?.ok) throw new Error(getVideoMatchApiErrorMessage(data, response, "source upload failed"));
      const rawSourceVideoUrl = String(data.sourceVideoUrl || "");
      const backendSourceVideoUrl = rawSourceVideoUrl
        ? (rawSourceVideoUrl.startsWith("http") ? rawSourceVideoUrl : `${API_BASE}${rawSourceVideoUrl}`)
        : "";
      patchProject({
        sourceVideoUrl: String(backendSourceVideoUrl || ""),
        sourceVideoPathForAssembly: String(data.sourceVideoPathForAssembly || ""),
        uploadedSourceVideoPath: String(data.sourceVideoPathForAssembly || ""),
        sourceVideo: {
          ...(project.sourceVideo || {}),
          path: String(data.sourceVideoPathForAssembly || ""),
          backendPath: String(data.sourceVideoPathForAssembly || ""),
          filename: data.filename || file.name || "source.mp4",
          name: data.filename || file.name || "source.mp4",
          durationSec: Number(data.duration_sec || 0),
          duration_sec: Number(data.duration_sec || 0),
          width: Number(data.width || 0),
          height: Number(data.height || 0),
          fps: Number(data.fps || 0),
          has_audio_stream: Boolean(data.has_audio_stream),
          type: file.type || "video/mp4",
          size: file.size || 0,
        },
      });
      setSourceVideoLoadMessage("");
    } catch (error) {
      setSourceVideoLoadMessage(`Не удалось загрузить source video на backend: ${String(error?.message || error)}`);
    }
  };

  const onAudioFileChange = (file) => {
    if (!file) return;
    if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current);
    const url = URL.createObjectURL(file);
    audioObjectUrlRef.current = url;
    runtimeAudioPreviewUrlRef.current = url;
    setAudioDurationSec(0);
    setAudioCurrentTimeSec(0);
    setAudioLoadMessage("");
    patchProject({
      audioPreviewUrl: url,
      audioPreviewMeta: {
        filename: file.name || "audio.mp3",
        duration_sec: 0,
        type: file.type || "audio/mpeg",
        size: file.size || 0,
      },
      useAudioPreview: true,
    });
  };

  const onLoadedMetadata = () => {
    updateVideoDiagnostics("loadedmetadata");
    setSourceVideoLoadMessage("");
    const duration = Number(videoRef.current?.duration || 0);
    if (!Number.isFinite(duration) || duration <= 0) return;
    if (activeVideoSourceKindRef.current === "override") return;
    setVideoDurationSec(duration);
    const nextDuration = Number(duration.toFixed(3));
    const prevDuration = Number(project?.sourceVideo?.duration_sec || 0);
    if (Math.abs(nextDuration - prevDuration) <= 0.05) {
      console.info("[VIDEO MATCH SAVE SKIPPED_NO_MEANINGFUL_CHANGE]", { nodeId, reason: "video_duration_delta_small" });
      return;
    }
    patchProject({
      sourceVideo: {
        ...(project.sourceVideo || {}),
        duration_sec: nextDuration,
      },
    });
  };

  const onLoadedAudioMetadata = () => {
    setAudioLoadMessage("");
    const duration = Number(audioRef.current?.duration || 0);
    if (!Number.isFinite(duration) || duration <= 0) return;
    setAudioDurationSec(duration);
    patchProject({
      audioPreviewMeta: {
        ...(project.audioPreviewMeta || {}),
        duration_sec: Number(duration.toFixed(3)),
      },
    });
  };

  const onSourceVideoError = () => {
    updateVideoDiagnostics("error");
    const width = Number(videoRef.current?.videoWidth || 0);
    const height = Number(videoRef.current?.videoHeight || 0);
    const fallbackMessage = "Видео не загрузилось в player. Проверьте source URL / CORS / blob / stale state.";
    setSourceVideoLoadMessage((width === 0 && height === 0)
      ? fallbackMessage
      : "Видео недоступно. Если страница перезагружалась, загрузите source video заново.");
    const sourceUrl = String(project.sourceVideoUrl || "");
    if (sourceUrl.startsWith("blob:") && !videoErrorHandledRef.current[sourceUrl]) {
      videoErrorHandledRef.current[sourceUrl] = true;
      runtimeSourceVideoUrlRef.current = "";
    }
  };

  const onAudioError = () => {
    setAudioLoadMessage("Аудио недоступно. Если страница перезагружалась, загрузите аудио заново.");
    const sourceUrl = String(project.audioPreviewUrl || "");
    if (sourceUrl.startsWith("blob:") && !audioErrorHandledRef.current[sourceUrl]) {
      audioErrorHandledRef.current[sourceUrl] = true;
      runtimeAudioPreviewUrlRef.current = "";
    }
  };

  const clearNodeState = (reason = "manual_reset", options = {}) => {
    const keepRuntimeMedia = Boolean(options?.keepRuntimeMedia);
    stopPlayback();
    setImportWarnings([]);
    setPendingImportResult(null);
    setSourceVideoLoadMessage("");
    setAudioLoadMessage("");
    setAssembleError("");
    setAssembledPreview(null);
    setAssembleAudioPath("");
    setCurrentTimeSec(0);
    setAudioCurrentTimeSec(0);
    setVideoDurationSec(0);
    setAudioDurationSec(0);
    manuallyClearedNodeRef.current = true;
    if (!keepRuntimeMedia) {
      if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = ""; }
      if (audioObjectUrlRef.current) { URL.revokeObjectURL(audioObjectUrlRef.current); audioObjectUrlRef.current = ""; }
      runtimeSourceVideoUrlRef.current = "";
      runtimeAudioPreviewUrlRef.current = "";
    }
    const next = getDefaultVideoMatchBoardProject(nodeId);
    if (keepRuntimeMedia) {
      next.sourceVideoUrl = String(project.sourceVideoUrl || runtimeSourceVideoUrlRef.current || "");
      next.audioPreviewUrl = String(project.audioPreviewUrl || runtimeAudioPreviewUrlRef.current || "");
    }
    clearVideoMatchBoardProjectStorage(nodeId);
    setProject(next);
    persistVideoMatchBoardProject(next, { forceReplace: true, allowMaterialLoss: true, explicitReset: true });
    setStateOrigin(reason);
  };

  const applyImportedResult = (result, extraWarnings = [], applyOptions = {}) => {
    const warningText = extraWarnings.filter(Boolean).join("\n");
    setImportWarnings(extraWarnings.filter(Boolean));
    setPendingImportResult(null);
    const safeVideoBlocks = Array.isArray(result.videoBlocks) ? result.videoBlocks : [];
    const safeMatchSegments = Array.isArray(result.matchSegments) ? result.matchSegments : [];
    const jsonDurationSec = getValidDurationSec(result.sourceVideo?.duration_sec);
    const normalizedSourceVideo = normalizeVideoMatchSourceVideo({ ...result, sourceVideo: result.sourceVideo });
    const normalizedPath = String(normalizedSourceVideo.path || "").trim();
    const importedAt = Date.now();
    const incomingAudioMix = Object.prototype.hasOwnProperty.call(result || {}, "audioMix")
      ? getDefaultVideoMatchAudioMix(result.audioMix || {})
      : getDefaultVideoMatchAudioMix(project.audioMix || {});
    const importedTimingContext = result.timingContext
      || normalizeVideoMatchTimingContext({
        audioDurationSec: Number(result?.audioDurationSec || result?.raw?.audio_duration_sec || 0),
        segments: safeMatchSegments,
        timingScenes: safeMatchSegments,
        sourceOfTruth: "video_match_board_v2.matchSegments_fallback",
      });
    const importedAudioMap = result.audioMap || {
      source_of_truth: "video_match_board_v2.segments",
      do_not_change_audio_timings: true,
      duration_sec: Number(importedTimingContext?.audioDurationSec || result?.raw?.audio_duration_sec || 0),
      audioDurationSec: Number(importedTimingContext?.audioDurationSec || result?.raw?.audio_duration_sec || 0),
      leading_inserted_silence_sec: Number(importedTimingContext?.leadingInsertedSilenceSec || 0),
      leadingInsertedSilenceSec: Number(importedTimingContext?.leadingInsertedSilenceSec || 0),
      segments: Array.isArray(importedTimingContext?.segments) ? importedTimingContext.segments : safeMatchSegments,
    };
    const importDraft = {
      ...getDefaultVideoMatchBoardProject(nodeId),
      schema: result.schema,
      audioMix: incomingAudioMix,
      sourceVideoUrl: String(runtimeSourceVideoUrlRef.current || project.sourceVideoUrl || ""),
      audioPreviewUrl: String(runtimeAudioPreviewUrlRef.current || project.audioPreviewUrl || ""),
      audioPreviewMeta: project.audioPreviewMeta || {},
      useAudioPreview: project.useAudioPreview,
      sourceVideo: { ...normalizedSourceVideo },
      source_video: {
        ...(project.source_video || {}),
        path: normalizedPath,
        filename: normalizedSourceVideo.filename || "source.mp4",
        duration_sec: Number(jsonDurationSec.toFixed(3)),
      },
      sourceVideoPath: normalizedPath,
      timingContext: importedTimingContext,
      audioMap: importedAudioMap,
      audioDurationSec: Number(importedTimingContext?.audioDurationSec || result?.audioDurationSec || result?.raw?.audio_duration_sec || 0),
      matchSegments: safeMatchSegments,
      videoBlocks: safeVideoBlocks,
      selectedSegmentId: result.selectedSegmentId,
      selectedCandidateId: result.selectedCandidateId,
      selectedBlockId: safeVideoBlocks[0]?.id || "",
      status: result.raw?.status || result.status || "matched",
      boardMode: result.raw?.board_mode || "",
      jsonInput: "",
      jsonInputPreview: String(project.jsonInput || "").slice(0, 2000),
      jsonInputClearedAfterImport: true,
      jsonError: warningText,
      importedAt,
      sourceNodeId: nodeId,
      nodeId,
    };
    importDraft.importedSegmentsCount = safeMatchSegments.length;
    importDraft.importedSchema = result.schema || "";
    importDraft.importedStatus = result.raw?.status || result.status || "matched";
    importDraft.importSignature = buildVideoMatchImportSignature(importDraft);
    const importedProject = persistVideoMatchBoardProject(importDraft, {
      forceReplace: true,
      allowMaterialLoss: true,
      forceReplaceImportedJson: applyOptions.forceReplaceImportedJson !== false,
      keepRuntimeMedia: true,
      emergency: false,
      lastGood: true,
    });
    setProject(importedProject);
    setJsonInputDraft("");
    setStateOrigin("imported_fresh");
  };

  const replaceVideoMatchProjectWithImportedJson = (importPayload, options = {}) => {
    if (!importPayload?.result) return;
    const keepRuntimeMedia = options.keepRuntimeMedia !== false;
    const oldSegments = matchSegments.length;
    const newSegments = Array.isArray(importPayload?.result?.matchSegments) ? importPayload.result.matchSegments.length : 0;
    console.info("[VIDEO MATCH REPLACE IMPORT START]", { oldSegments, newSegments, keepRuntimeMedia });
    stopPlayback();
    clearVideoMatchBoardProjectStorage(nodeId);
    applyImportedResult(importPayload.result, importPayload.warnings || [], { forceReplaceImportedJson: true });
    const savedProject = readVideoMatchBoardProjectForNode(nodeId);
    const lastGoodProject = safeReadVideoMatchJson(getVideoMatchBoardLastGoodStorageKey(nodeId));
    const savedSegments = Array.isArray(savedProject?.matchSegments) ? savedProject.matchSegments.length : 0;
    const lastGoodSegments = Array.isArray(lastGoodProject?.matchSegments) ? lastGoodProject.matchSegments.length : 0;
    const activeSegments = Array.isArray(project?.matchSegments) ? project.matchSegments.length : 0;
    const nodeSegments = Array.isArray(savedProject?.matchSegments) ? savedProject.matchSegments.length : 0;
    if (savedSegments !== newSegments || lastGoodSegments !== newSegments) {
      setProject((prev) => ({
        ...prev,
        jsonError: `Новый JSON не стал confirmed_import: ожидалось ${newSegments}, last_good ${lastGoodSegments}.`,
      }));
      return;
    }
    setPendingImportResult(null);
    setImportWarnings(importPayload.warnings || []);
    setStateOrigin("imported_replaced");
    console.info("[VIDEO MATCH REPLACE IMPORT SAVED]", {
      savedSegments,
      lastGoodSegments,
      activeSegments,
      nodeSegments,
      importSignature: savedProject?.importSignature || "",
    });
  };

  const forceApplyVideoMatchJsonText = (text = "") => {
    const cleanText = String(text || "").replace(/^﻿/, "").trim();
    if (!cleanText) { patchProject({ jsonError: "JSON пустой" }, { lastGood: false }); return; }
    const result = parseVideoMatchBoardJson(cleanText, sourceVideoUrl);
    if (!result || result.error || result.ok === false) { patchProject({ jsonError: String(result?.error || "JSON parse error") }, { lastGood: false }); return; }
    clearVideoMatchBoardProjectStorage(nodeId);
    applyImportedResult(result, [], { forceReplaceImportedJson: true });
    const savedProject = readVideoMatchBoardProjectForNode(nodeId);
    const savedSegments = Array.isArray(savedProject?.matchSegments) ? savedProject.matchSegments.length : 0;
    const incomingSegments = Array.isArray(result?.matchSegments) ? result.matchSegments.length : 0;
    if (savedSegments !== incomingSegments) {
      patchProject({ jsonError: `Принудительная замена не сохранилась: ожидалось ${incomingSegments}, сохранено ${savedSegments}.` }, { lastGood: false });
    }
  };

  const validateAndApplyVideoMatchJsonText = (text = "") => {
    const cleanText = String(text || "").replace(/^﻿/, "").trim();
    if (!cleanText) { patchProject({ jsonError: "JSON пустой" }, { lastGood: false }); return; }
    if (isLikelyTruncatedJson(cleanText)) { patchProject({ jsonError: "Похоже, JSON обрезан. Вставьте полный файл." }, { lastGood: false }); return; }
    const result = parseVideoMatchBoardJson(cleanText, sourceVideoUrl);
    if (!result || result.error || result.ok === false) { patchProject({ jsonError: String(result?.error || "JSON parse error") }, { lastGood: false }); return; }
    const warnings = [];
    const sourceData = result.raw || {};
    if (!["photostudio_video_match_board_v2", "video_match_board_v2", "video_match_board_v1"].includes(sourceData.schema)) warnings.push(`schema warning: ${sourceData.schema || "unknown"}`);
    if (sourceData.status === "blocked_missing_audio_map") { patchProject({ jsonError: "Это не финальная доска, нужен matched/matched_global_clean/ready/completed" }, { lastGood: false }); return; }
    if (!Array.isArray(sourceData.segments) || sourceData.segments.length === 0) { patchProject({ jsonError: "В JSON нет segments" }, { lastGood: false }); return; }
    if (Number(sourceData.audio_map_segments_count || 0) > 0 && Number(sourceData.audio_map_segments_count) !== sourceData.segments.length) warnings.push("audio_map_segments_count не совпадает с segments.length");
    const missingSelected = sourceData.segments.filter((seg) => !(seg?.selected_candidate_id || seg?.selectedCandidateId || seg?.selected_candidate || seg?.selectedCandidate || seg?.selected_candidate?.candidate_id || seg?.selectedCandidate?.candidate_id)).length;
    if (missingSelected > 0) warnings.push(`у ${missingSelected} segments нет selected_candidate`);
    const mismatch = computeImportCompatibilityScore(project, result);
    if (mismatch.mismatch && (matchSegments.length || videoBlocks.length)) { setPendingImportResult({ result, warnings }); return; }
    applyImportedResult(result, warnings);
  };

  const onApplyJson = () => {
    if (pendingImportResult) {
      replaceVideoMatchProjectWithImportedJson(pendingImportResult, { keepRuntimeMedia: true });
      return;
    }
    const textToApply = String(jsonInputDraft || project.jsonInputPreview || project.jsonInput || "");
    validateAndApplyVideoMatchJsonText(textToApply);
  };

  const onAssembleMp4 = async () => {
    if (!assemblyBlocks.length) return;
    const sourceVideoPath = String(
      project?.sourceVideoPathForAssembly
      || project?.uploadedSourceVideoPath
      || project?.sourceVideo?.backendPath
      || project?.sourceVideo?.path
      || project?.source_video?.path
      || project?.sourceVideoPath
      || project?.source_video_path
      || "",
    ).trim();
    const isProxySource = isProxySourcePath(sourceVideoPath);
    if (!sourceVideoPath) {
      setAssembleError("Для сборки нужен sourceVideo.path из JSON или загрузите source video заново");
      console.log("[VIDEO MATCH ASSEMBLY MISSING SOURCE]", {
        sourceVideo: project.sourceVideo,
        source_video: project.source_video,
        sourceVideoPath: project.sourceVideoPath,
        keys: Object.keys(project || {}),
      });
      return;
    }
    if (wantsAssembleWithAudio && !isAssembleAudioPathValid) {
      setAssembleError("Путь к аудио выглядит неверно. Для MP4 с аудио укажите реальный локальный путь.");
      return;
    }
    setIsAssemblingMp4(true);
    setAssembleError("");
    setAssembleWarning("");
    setAssembledPreview(null);
    try {
      const originalVideoAudioMode = String(project.audioMix?.originalVideoAudioMode || "duck");
      const globalOriginalVideoVolume = originalVideoAudioMode === "mute"
        ? 0
        : Math.max(0, Math.min(1, Number(project.audioMix?.originalVideoVolume ?? 0.10)));
      const assemblyBlocksForExport = assemblyBlocks.map((block) => {
        const { clipStart, clipEnd } = getBlockClipRange(block);
        const forceMuteVideoAudio = isTruthyFlag(block.forceMuteVideoAudio ?? block.force_mute_video_audio);
        const effectiveOriginalVideoVolume = forceMuteVideoAudio ? 0 : globalOriginalVideoVolume;
        return {
          ...block,
          clipSourceStartSec: clipStart,
          clipSourceEndSec: clipEnd,
          sourceVideoStartSec: clipStart,
          sourceVideoEndSec: clipEnd,
          forceMuteVideoAudio,
          force_mute_video_audio: forceMuteVideoAudio,
          effectiveOriginalVideoVolume,
        };
      });
      console.info("[VIDEO MATCH AUDIO VOLUME DEBUG]", assemblyBlocksForExport.map((b) => ({
        id: b.id,
        audioSceneId: b.audioSceneId,
        isLipSync: isLipSyncScene(b),
        forceMuteVideoAudio: b.forceMuteVideoAudio,
        effectiveOriginalVideoVolume: b.effectiveOriginalVideoVolume,
      })));
      const response = await fetchJson("/api/video-match/assemble", {
        method: "POST",
        body: {
          sourceVideoPath,
          sourceVideo: project?.sourceVideo || {},
          source_video: project?.source_video || {},
          includeAudio: wantsAssembleWithAudio,
          audioPath: wantsAssembleWithAudio ? resolvedAssembleAudioPath : "",
          audioUrl: project?.timingContext?.sourceAudioUrl || "",
          outputFormat: "16:9",
          previewQuality: "720p",
          audioMix: getDefaultVideoMatchAudioMix(project.audioMix || {}),
          blocks: assemblyBlocksForExport.map((block) => {
            const forceMuteVideoAudio = isTruthyFlag(block.forceMuteVideoAudio ?? block.force_mute_video_audio);
            return ({
              id: block.id,
              audioSceneId: block.audioSceneId || block.segmentId || "",
              targetStartSec: Number(block.targetStartSec || 0),
              targetEndSec: Number(block.targetEndSec || 0),
              sourceVideoStartSec: Number(block.sourceVideoStartSec || 0),
              sourceVideoEndSec: Number(block.sourceVideoEndSec || 0),
              clipSourceStartSec: Number(block.clipSourceStartSec || 0),
              clipSourceEndSec: Number(block.clipSourceEndSec || 0),
              candidateType: block.candidateType || "",
              sourceKind: block.sourceKind || "",
              overrideVideoPath: block.overrideVideoPath || "",
              overrideVideoUrl: block.overrideVideoUrl || "",
              requiresOverrideVideo: Boolean(block.requiresOverrideVideo || block.requires_override_video),
              reservedPlaceholder: Boolean(block.reservedPlaceholder || block.reserved_placeholder),
              reservedGeneratedLipsync: isTruthyFlag(block.reservedGeneratedLipsync ?? block.reserved_generated_lipsync),
              forceMuteVideoAudio,
              force_mute_video_audio: forceMuteVideoAudio,
              originalVideoVolume: Number(block.effectiveOriginalVideoVolume ?? globalOriginalVideoVolume),
              original_video_volume: Number(block.effectiveOriginalVideoVolume ?? globalOriginalVideoVolume),
            });
          }),
        },
      });
      if (isProxySource) {
        setAssembleWarning("Сборка использует proxy video. Для финального качества загрузите оригинальное видео.");
      }
      setAssembledPreview(response || null);
    } catch (error) {
      setAssembleError(resolveAssembleApiErrorMessage(error));
    } finally {
      setIsAssemblingMp4(false);
    }
  };

  const sampleDurationSec = Math.max(getValidDurationSec(videoDurationSec), 130);
  const timingSegmentsForDebug = Array.isArray(project.timingContext?.segments) && project.timingContext.segments.length
    ? project.timingContext.segments
    : matchSegments;
  const timingScenesForDebug = Array.isArray(project.timingContext?.timingScenes) && project.timingContext.timingScenes.length
    ? project.timingContext.timingScenes
    : timingSegmentsForDebug;
  const jsonSourceVideoPath = String(project?.source_video?.path || project?.sourceVideo?.path || project?.sourceVideoPath || "").trim();
  const sourceVideoPathForAssembly = String(project?.sourceVideoPathForAssembly || project?.uploadedSourceVideoPath || project?.sourceVideo?.backendPath || "").trim();
  const effectiveSourceVideoPathForMp4 = String(
    sourceVideoPathForAssembly
    || project?.sourceVideo?.path
    || project?.source_video?.path
    || project?.sourceVideoPath
    || ""
  ).trim();
  const isAssemblyUsingProxySource = isProxySourcePath(effectiveSourceVideoPathForMp4);
  const sampleJson = JSON.stringify({
    schema: "video_match_board_v2",
    source_video: { filename: "source.mp4", duration_sec: Number(sampleDurationSec.toFixed(3)) },
    segments: [
      {
        audio_scene_id: "seg_01",
        story_scene_id: "story_01",
        target_t0: 0,
        target_t1: 4.8,
        text: "Opening phrase",
        mood: "curious",
        visual_need: "intro establishing shot",
        selected_candidate_id: "seg_01_a",
        candidates: [
          {
            id: "seg_01_a",
            video_t0: 12.4,
            video_t1: 17.2,
            fit_mode: "exact",
            confidence: 0.86,
            match_reason: "Wide intro shot matches the opening mood.",
            visual_type: "intro",
            shot_type: "wide",
            emotion: "calm",
            action: "location reveal",
            contains_face: false,
            mouth_visible: false,
            lip_sync_candidate: false,
            dialogue_present: false,
            motion_level: "low",
            camera_motion: "slow_pan",
            thumbnail: "",
            warnings: [],
          },
          {
            id: "seg_01_b",
            video_t0: 38.0,
            video_t1: 42.8,
            fit_mode: "trim",
            confidence: 0.74,
            match_reason: "Alternate establishing shot with more movement.",
            visual_type: "intro",
            shot_type: "medium",
            emotion: "neutral",
            action: "subject enters frame",
            contains_face: true,
            mouth_visible: false,
            lip_sync_candidate: false,
            dialogue_present: false,
            motion_level: "medium",
            camera_motion: "handheld",
            warnings: ["More motion than requested"],
          },
          {
            id: "seg_01_c",
            video_t0: 41.6,
            video_t1: 46.4,
            fit_mode: "fallback",
            confidence: 0.69,
            match_reason: "Backup wide shot keeps the scene readable if the preferred opening feels too static.",
            visual_type: "intro",
            shot_type: "wide",
            emotion: "calm",
            action: "subject prepares the workspace",
            contains_face: true,
            mouth_visible: false,
            lip_sync_candidate: false,
            dialogue_present: false,
            motion_level: "low",
            camera_motion: "static",
            warnings: ["Less precise match", "Use only if pacing needs a calmer opening"],
          },
        ],
      },
      {
        audio_scene_id: "seg_02",
        story_scene_id: "story_02",
        target_t0: 4.8,
        target_t1: 9.6,
        text: "Second beat",
        mood: "focused",
        visual_need: "detail or reaction shot",
        selected_candidate_id: "seg_02_a",
        candidates: [
          {
            id: "seg_02_a",
            video_t0: 64.2,
            video_t1: 69.0,
            fit_mode: "exact",
            confidence: 0.82,
            match_reason: "Close detail supports the focused narration.",
            visual_type: "detail",
            shot_type: "close_up",
            emotion: "focused",
            action: "hands work on object",
            contains_face: false,
            mouth_visible: false,
            lip_sync_candidate: false,
            dialogue_present: false,
            motion_level: "low",
            camera_motion: "static",
            warnings: [],
          },
          {
            id: "seg_02_b",
            video_t0: 92.5,
            video_t1: 97.3,
            fit_mode: "trim",
            confidence: 0.77,
            match_reason: "Reaction shot can bridge into the next line.",
            visual_type: "reaction",
            shot_type: "close_up",
            emotion: "thoughtful",
            action: "person looks off camera",
            contains_face: true,
            mouth_visible: true,
            lip_sync_candidate: false,
            dialogue_present: false,
            motion_level: "low",
            camera_motion: "static",
            thumbnail: "",
            warnings: ["Mouth is visible; avoid if narration feels lip-synced"],
          },
        ],
      },
    ],
  }, null, 2);


  useEffect(() => {
    const safePreset = getPresetById(workflowPreset);
    if (safePreset.id !== workflowPreset) {
      setWorkflowPreset(safePreset.id);
      setWorkflowStep(safePreset.steps[0] || "");
      return;
    }
    if (!safePreset.steps.includes(workflowStep)) {
      setWorkflowStep(safePreset.steps[0] || "");
    }
  }, [project?.workflowPreset, project?.workflowStep, workflowPreset, workflowStep]);

  useEffect(() => {
    if (!project) return;
    if (project?.workflowPreset === workflowPreset && project?.workflowStep === workflowStep) return;
    patchProject({
      workflowPreset,
      workflowStep,
      workflowUpdatedAt: Date.now(),
    }, { lastGood: false });
  }, [project, workflowPreset, workflowStep]);

  const onExportChatGptPackage = useCallback(async () => {
    const zip = new JSZip();
    const hasMatchSegments = matchSegments.length > 0;
    const hasManualTimingSeed = Boolean(project?.timingContext?.manualTimingSeed);
    const hasTimingSegments = Array.isArray(project?.timingContext?.segments) && project.timingContext.segments.length > 0;

    let autoCurrentStep = "need_workflow_decision";
    let autoNextRecommendedStep = "ask_chatgpt_for_next_codex_job";
    let autoWhatChatGptShouldDoNext = "Review project context and suggest the next Codex job.";

    if (hasMatchSegments) {
      autoCurrentStep = "video_match_board_ready";
      autoNextRecommendedStep = "review_preview_or_fix_pass";
      autoWhatChatGptShouldDoNext = "Review current Video Match Board and suggest either final assembly, fix pass, or next Codex job.";
    } else if (hasManualTimingSeed || hasTimingSegments) {
      autoCurrentStep = "after_manual_timing";
      autoNextRecommendedStep = "retime_to_video_match_board";
      autoWhatChatGptShouldDoNext = "Propose a retime-focused Codex job to build Video Match Board from current manual timing context.";
    }

    const knownFiles = {
      current_manual_timing_seed: project?.timingContext?.manualTimingSeed ? "current_manual_timing_seed.json" : null,
      visual_sequence_board_v1: project?.timingContext?.visualSequenceBoard ? "visual_sequence_board_v1.json" : null,
      voiceover_script_by_scene_v1: project?.timingContext?.voiceoverScript ? "voiceover_script_by_scene_v1.json" : null,
      video_match_board_v2: matchSegments.length ? "video_match_board_v2.json" : null,
      chatgpt_video_first_memory: "CHATGPT_VIDEO_FIRST_MEMORY.md",
      video_first_story_contract: "video_first_story_contract_v1.json",
      ltx_prompt_bank: "ltx_prompt_bank_v1.json",
      warnings_report: importWarnings.length ? "warnings_report.txt" : null,
      validation_report: project?.jsonError ? "validation_report.txt" : null,
    };
    const manifest = {
      schema: "photostudio_chatgpt_workflow_context_v1",
      workflow_preset: project?.workflowPreset || DEFAULT_WORKFLOW_PRESET,
      workflow_step: autoCurrentStep,
      workflow_updated_at: project?.workflowUpdatedAt || null,
      current_step: autoCurrentStep,
      available_workflows: [
        "video_first_documentary",
        "video_first_lipsync",
        "music_clip",
        "story_voiceover",
        "existing_montage_retime",
      ],
      chatgpt_should_explain_options: true,
      chatgpt_instruction: "When user sends this package, briefly explain current state, offer suitable workflow options, then write the next Codex job.",
      next_recommended_step: autoNextRecommendedStep,
      project_id: project?.projectId || nodeId,
      created_at: new Date().toISOString(),
      source_video_path: project?.sourceVideo?.path || project?.sourceVideo?.source_video_path || "",
      source_audio_path: project?.timingContext?.sourceAudioUrl || "",
      source_audio_name: project?.audioPreviewMeta?.filename || "",
      source_audio_duration_sec: Number(project?.audioPreviewMeta?.duration_sec || project?.timingContext?.audioDurationSec || 0),
      known_files: knownFiles,
      rules: [
        "Не текст ищет кадры. Кадры рождают текст.",
        "Сначала visual inventory, потом story.",
        "Персонажи lip-sync появляются только с драматургической функцией.",
        "Сценарий для озвучки пишется с метками персонажей и отдельными репликами.",
      ],
      what_chatgpt_should_do_next: autoWhatChatGptShouldDoNext,
    };
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));
    zip.file("current_project_state.json", JSON.stringify(project, null, 2));
    zip.file("WORKFLOW_INSTRUCTIONS.md", `# Workflow context package for ChatGPT

1. Этот пакет не содержит готового задания Codex. Он содержит контекст проекта.
2. ChatGPT должен сам определить следующий шаг и только потом написать точный Codex job.
3. Если Video Match Board уже есть, предложите: preview, fix pass или final assembly.
4. Если есть только Manual Timing seed/segments, предложите retime job для сборки Video Match Board.
5. Если visual sequence отсутствует, предложите video-first starter job.
6. Если пользователь хочет lip-sync, предложите video-first + lip-sync plan.
7. Главный принцип: Не текст ищет кадры. Кадры рождают текст.
8. Если пользователь строит новый ролик из исходного видео, сначала предложите Stage 1: visual_inventory + story_concept + scene_plan_v1 + lipsync_candidates_v1.
9. Для travel documentary / video-first роликов не писать финальный сценарий до visual inventory.
10. Для многоголосого ролика писать voiceover_main_with_placeholders.txt и character_lines_separate.txt.
11. Для lip-sync сцен планировать 7–8 секунд и отдельные LS_01 ... LS_09 кадры.
12. Финальный video_match_board_v2 делать только после собранного MP3 и Manual Timing / ASR.
`);
    zip.file("CHATGPT_VIDEO_FIRST_MEMORY.md", `# PhotoStudio / Video-first documentary memory

## Главный принцип

Не текст ищет кадры.  
Кадры рождают текст.

Сначала мы смотрим, что реально есть в исходном видео, и только потом пишем историю.

## Почему так

Если сначала придумать историю, а потом искать под неё видео, появляются ошибки:

- Codex придумывает объекты, которых нет в видео;
- Video Match потом ищет несуществующие кадры;
- персонажи появляются случайно;
- b-roll не совпадает с текстом;
- история живёт отдельно от исходного материала.

Правильная логика:

1. Сначала полный анализ исходного видео.
2. Потом visual inventory.
3. Потом интересные visual families / source shots.
4. Потом story concept на основе реального видео.
5. Потом scene_plan_v1.
6. Потом 8–9 lip-sync персонажей.
7. Потом сценарий диктора с метками персонажей.
8. Потом отдельные реплики персонажей.
9. Потом сборка общего аудио.
10. Потом Manual Timing / ASR.
11. Потом финальный video_match_board_v2.

## Workflow

### Stage 1 — Video-first analysis

Codex должен:

- анализировать весь исходный ролик, а не первые минуты;
- делать contact sheets;
- делать visual inventory;
- отмечать сильные кадры;
- отмечать слабые / повторяющиеся кадры;
- разделять material на visual families;
- искать реальные source windows.

Примеры visual families:

- fjord / water / coast
- mountain / cliffs
- road / bridge / route
- village / houses / human traces
- church / cultural marker
- glacier / ice / snow
- northern lights / night
- aerial scenic views
- human context
- weak / duplicate / overlay shots

### Stage 2 — Story from visible material

История пишется только из того, что подтверждено видео.

Нельзя писать:
- ягоды, если их нет;
- лодку, если её нет;
- церковь, если она не найдена;
- людей, если они не подтверждены или не планируются как synthetic lip-sync insert;
- любые достопримечательности, которых нет в visual inventory.

История должна быть travel documentary / poetic documentary / road documentary.

Не сухой туристический обзор.

### Stage 3 — Scene plan

Для ролика около 170–180 секунд:

- b-roll сцены: обычно 3–6 сек;
- lip-sync сцены: 7–8 сек;
- lip-sync сцен: 8–9;
- примерно 3 lip-sync сцены на минуту;
- b-roll должен идти из реального видео;
- lip-sync может быть synthetic character on real background.

Каждая сцена должна иметь:

- scene_id
- type: broll / lip_sync
- approx_start_sec
- approx_end_sec
- approx_duration_sec
- source_video_timecode_start
- source_video_timecode_end
- visual_family
- what_is_shown
- story_function
- notes

### Stage 4 — Lip-sync character plan

Персонажи не вставляются случайно.

Каждый lip-sync персонаж должен иметь функцию:

- кто говорит;
- почему он появляется именно здесь;
- что он подтверждает;
- с каким реальным фоном связан;
- какая мысль у него в истории;
- что идёт до него и после него.

Примеры персонажей:

- молодой местный гид;
- туристка / скалолаз;
- пожилой рыбак;
- женщина из деревни;
- пастор / смотритель церкви;
- водитель / дорожный гид;
- гид у ледника;
- фермер / хозяин дома;
- финальный пожилой местный голос.

Каждый LS должен иметь:

- LS_01 ... LS_09
- character_type
- voice type
- age
- gender
- emotion
- location_context
- story_function
- why_this_person_here
- source background frame
- image_file

### Stage 5 — Voiceover with placeholders

Сценарий для озвучки пишется не как один сплошной текст.

Нужен специальный формат под монтаж аудио:

Главный дикторский сценарий содержит метки персонажей:

[ГИД]
[РЫБАК]
[ТЁТКА]
[ПАСТОР]
[ВОДИТЕЛЬ]
[ГИД_У_ЛЕДНИКА]
[ФЕРМЕР]
[ФИНАЛЬНЫЙ_ГОЛОС]

Пример:

ДИКТОР:
Сначала север кажется просто красивой картинкой: вода, скалы, холодный свет над фьордом. Но чем дольше смотришь, тем яснее понимаешь — здесь всё держится на масштабе.

[ГИД]

ДИКТОР:
После его слов фьорд уже не выглядит просто видом с открытки. Он становится пространством, где человек не главный, но его присутствие всё равно важно.

[ТУРИСТКА]

Ниже отдельно выписываются точные реплики всех персонажей.

Пользователь озвучивает:

- главный сценарий диктором;
- каждого персонажа отдельным голосом.

Потом в аудио главного диктора пользователь вырезает место метки и вставляет голос персонажа.

### Stage 6 — Separate character lines

Для каждого персонажа нужен отдельный блок:

LS_01 / [ГИД]
Голос: мужчина 30–40, спокойный местный гид.
Эмоция: тихое восхищение.
Длительность: 7–8 сек.
Текст:
“Здесь сначала не смотришь на карту. Сначала просто чувствуешь, насколько всё вокруг больше тебя.”

### Stage 7 — Final audio first, then final timing

После сборки общего MP3:

1. загрузить общий MP3 в Manual Timing;
2. сделать ASR;
3. получить фактические фразы и тайминги;
4. только потом делать финальный video_match_board_v2.

До готового аудио нельзя делать финальный match-board.

## Output philosophy

Правильная цепочка:

REAL VIDEO → VISUAL INVENTORY → STORY FROM REAL VIDEO → ROLES → VOICEOVER WITH PLACEHOLDERS → SEPARATE VOICES → ASSEMBLED AUDIO → ASR TIMING → FINAL VIDEO MATCH

Неправильная цепочка:

TEXT FIRST → INVENTED STORY → TRY TO FIND VIDEO → PATCH ERRORS
`);
    zip.file("video_first_story_contract_v1.json", JSON.stringify({
      schema: "video_first_story_contract_v1",
      workflow_name: "PhotoStudio Video-first Travel Documentary",
      core_rule: "Не текст ищет кадры. Кадры рождают текст.",
      stage_order: [
        "visual_inventory",
        "source_shot_index",
        "story_concept",
        "scene_plan_v1",
        "lipsync_candidates_v1",
        "voiceover_with_placeholders",
        "separate_character_lines",
        "assembled_audio",
        "manual_timing_asr",
        "final_video_match_board_v2",
      ],
      rules: {
        do_not_invent_unseen_objects: true,
        story_must_be_based_on_visual_inventory: true,
        broll_from_real_video_only: true,
        synthetic_characters_allowed_for_lipsync: true,
        characters_must_have_story_function: true,
        no_final_asr_before_audio_is_assembled: true,
        no_final_video_match_before_asr_timing: true,
        proxy_video_for_analysis: true,
        original_4k_preferred_for_final_assembly: true,
      },
      target_structure: {
        target_duration_sec: { min: 170, max: 180 },
        broll_duration_sec: { min: 3, max: 6 },
        lipsync_duration_sec: { min: 7, max: 8 },
        lipsync_count_for_3min: { min: 8, max: 9 },
        lipsync_density: "about 3 character scenes per minute",
      },
      required_stage_1_outputs: ["visual_inventory.txt", "story_concept.txt", "scene_plan_v1.json", "lipsync_candidates_v1.json", "lipsync_contact_sheet.jpg", "lipsync_candidates_frames/LS_01.jpg ... LS_09.jpg", "short_summary_for_chatgpt.txt"],
      required_stage_2_outputs: ["voiceover_main_with_placeholders.txt", "character_lines_separate.txt", "voiceover_script_v1.json", "narrator_lines_only.txt", "separate_character_files/LS_01_*.txt ... LS_09_*.txt"],
      placeholder_style: {
        main_script_contains_placeholders: true,
        examples: ["[ГИД]", "[РЫБАК]", "[ТЁТКА]", "[ПАСТОР]", "[ВОДИТЕЛЬ]", "[ГИД_У_ЛЕДНИКА]", "[ФЕРМЕР]", "[ФИНАЛЬНЫЙ_ГОЛОС]"],
        character_lines_written_separately: true,
        audio_editing_logic: "User records main narrator, records each character separately, cuts placeholder locations from main audio, inserts separate character voices, then exports assembled MP3.",
      },
      lipsync_character_rules: {
        must_have_character_type: true,
        must_have_background_from_real_video: true,
        must_have_story_function: true,
        must_explain_why_character_appears_here: true,
        must_explain_what_character_confirms: true,
        must_have_duration_7_8_sec: true,
        must_have_visible_mouth_in_generated_photo: true,
        preferred_shot: "medium close-up or waist-up portrait, mouth visible, expressive face, stable camera",
      },
      final_match_rules: {
        final_video_match_board_after_manual_timing_only: true,
        must_use_asr_segments: true,
        must_preserve_lipsync_blocks: true,
        broll_segments_can_be_retimed: true,
        selected_source_clips_need_clean_windows: true,
        avoid_overlay_shots: true,
        avoid_duplicate_visual_reuse: true,
      },
    }, null, 2));
    zip.file("ltx_prompt_bank_v1.json", JSON.stringify({
      schema: "ltx_prompt_bank_v1",
      purpose: "Compact prompt rules for PhotoStudio LTX video generation modes.",
      modes: {
        i2v: {
          use_for: ["ordinary image-to-video b-roll", "landscape movement", "slow camera push-in", "slow lateral tracking", "restrained walking", "environmental motion"],
          safe_motion: ["very slow push-in", "gentle pull-back", "slow side tracking", "subtle pan", "restrained walk", "light wind", "small natural fabric movement"],
          avoid: ["complex choreography", "dense crowds", "fast action", "aggressive orbit", "extreme pose", "crossed legs", "complex hands", "identity drift"],
          prompt_rule: "Use uploaded image as exact first frame and identity/world anchor. Keep same subject, location, clothing, lighting, background geometry. Use restrained natural motion.",
        },
        ia2v_lipsync: {
          use_for: ["lip-sync performance", "speaking character", "singing character", "short 7-8 second character insert"],
          photo_requirements: ["medium close-up or waist-up", "mouth already slightly open", "visible lips and jaw", "expressive face", "stable readable face angle", "same background/world as planned scene", "not full-body neutral pose"],
          safe_motion: ["clear expressive lip sync", "visible mouth opening on syllables", "natural jaw motion", "subtle cheek tension", "small eyebrow movement", "slight rhythmic head motion", "very slow push-in", "gentle lateral reframe"],
          avoid: ["walking while lip-syncing", "closed mouth source photo", "tiny face in frame", "heavy hand gestures near mouth", "fast camera movement", "distorted mouth", "broken hands", "identity drift"],
          prompt_rule: "For lip-sync, the source image must already look like a speaking/singing moment: mouth visible, emotion readable, medium close-up, stable face angle.",
        },
        first_last: {
          formula: "Anchor A -> Event -> Anchor B",
          use_for: ["directed transformation", "object movement from A to B", "reveal", "collapse", "flood", "material change", "before/after with clear event"],
          not_for: ["lip-sync", "subtle facial emotion only", "complex crowd scenes", "tiny unclear changes", "unrelated beautiful images"],
          thinking_schema: {
            scene_anchor: "What stays the same: place, geometry, identity, lighting logic.",
            state_delta: "What physically changes.",
            bridge_action: "The event verb connecting A and B.",
            motion_vector: "Subject/camera/effect movement.",
            continuity_locks: "What must not drift.",
          },
          prompt_rule: "First and last frames are not two pretty images; they must be a stable scene before and after one understandable event.",
        },
      },
    }, null, 2));
        if (project?.timingContext?.manualTimingSeed) zip.file("current_manual_timing_seed.json", JSON.stringify(project.timingContext.manualTimingSeed, null, 2));
    if (project?.timingContext?.visualSequenceBoard) zip.file("visual_sequence_board_v1.json", JSON.stringify(project.timingContext.visualSequenceBoard, null, 2));
    if (project?.timingContext?.voiceoverScript) zip.file("voiceover_script_by_scene_v1.json", JSON.stringify(project.timingContext.voiceoverScript, null, 2));
    if (matchSegments.length) {
      const exportedBoard = {
        schema: "video_match_board_v2",
        status: project?.status || "exported_context",
        source_video: project?.sourceVideo || project?.source_video || {},
        audio_duration_sec: Number(project?.timingContext?.audioDurationSec || project?.audioPreviewMeta?.duration_sec || audioDurationSec || 0),
        segments: matchSegments,
        export_note: "Context export for ChatGPT, not necessarily final import board",
      };
      zip.file("video_match_board_v2.json", JSON.stringify(exportedBoard, null, 2));
    }
    if (importWarnings.length) zip.file("warnings_report.txt", importWarnings.join("\n"));
    if (project?.jsonError) zip.file("validation_report.txt", String(project.jsonError));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `photostudio_chatgpt_context_${nodeId}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }, [audioDurationSec, importWarnings, matchSegments, nodeId, project]);

  return (
    <div className="videoMatchPage">
      <div className="videoMatchHeader">
        <div>
          <h1>Video Match Board</h1>
          <p>Компактная доска подбора фрагментов большого видео под аудио-карту.</p>
        </div>
        <button className="btn" type="button" onClick={() => navigate(-1)}>Назад в граф</button>
      </div>

      <div className="videoMatchSummaryBar">
        <span>сцен: {matchSegments.length}</span>
        <span>выбрано сцен: {videoBlocks.length}</span>
        <span>вариантов: {candidatesTotal}</span>
        <span>длительность сборки: {formatSec(assemblyDurationSec)} с</span>
        <span>аудио: {project.audioPreviewMeta?.filename || "—"}</span>
      </div>

      <div className="videoMatchTopWorkspace">
        <section className="videoMatchPanel videoMatchPlayerPanel">
          <div className="videoMatchPanelHeader">
            <h2>Исходное видео</h2>
            <div className="videoMatchHeaderButtons">
              <label className="clipSB_btn clipSB_btnPrimary videoMatchUploadBtn videoMatchBtnUploadVideo">
                Загрузить видео
                <input type="file" accept="video/*" hidden onChange={(event) => onVideoFileChange(event.target.files?.[0])} />
              </label>
              <label className="clipSB_btn clipSB_btnSecondary videoMatchUploadBtn videoMatchBtnUploadAudio">
                + Аудио
                <input type="file" accept="audio/*" hidden onChange={(event) => onAudioFileChange(event.target.files?.[0])} />
              </label>
            </div>
          </div>

          <div className="videoMatchVideoBox">
            {sourceVideoUrl ? (
              <video
                ref={videoRef}
                src={sourceVideoUrl}
                controls
                onLoadStart={() => updateVideoDiagnostics("loadstart")}
                onLoadedMetadata={onLoadedMetadata}
                onCanPlay={() => updateVideoDiagnostics("canplay")}
                onPlaying={() => updateVideoDiagnostics("playing")}
                onError={onSourceVideoError}
                onTimeUpdate={onTimeUpdate}
              />
            ) : (
              <div className="videoMatchEmptyVideo">Загрузите видеофайл для просмотра.</div>
            )}
          </div>
          <audio
            ref={audioRef}
            src={audioPreviewUrl || undefined}
            onLoadedMetadata={onLoadedAudioMetadata}
            onTimeUpdate={onAudioTimeUpdate}
            onEnded={onAudioEnded}
            onError={onAudioError}
            preload="metadata"
          />
          {sourceVideoLoadMessage ? <div className="videoMatchError">{sourceVideoLoadMessage}</div> : null}
          {audioLoadMessage ? <div className="videoMatchError videoMatchAudioNotice">{audioLoadMessage}</div> : null}

          <div className="videoMatchTimelineMeta">
            <span>{project.sourceVideo?.filename || "source.mp4"}</span>
            <span>{formatSec(currentTimeSec)} / {formatSec(timelineDuration)} с</span>
          </div>
          <div className="videoMatchTimeline videoMatchTimelineScroller" aria-label="Scene source proof strip">
            <div className="videoMatchTimelineInner" style={{ width: `${sourceTimelineInnerWidth}px` }}>
              <div className="videoMatchTimelineProgress" style={{ width: `${Math.min(100, markerProgressPercent)}%` }} />
              {sourceTimelineMarkers.map((block, index) => {
                const markerTone = getMarkerTone(block);
                const markerLeft = getSceneOrderMarkerLeft(index, sourceTimelineMarkers.length);
                return (
                  <button
                    key={block.id}
                    type="button"
                    className={`videoMatchTimelineMarker tone-${markerTone} ${block.id === project.selectedBlockId ? "isSelected" : ""} ${isAssemblyPlaying && block.id === project.selectedBlockId ? "isPlaying" : ""}`}
                    style={{ left: `${markerLeft}%` }}
                    onClick={() => onSelectBlock(block)}
                    title={`${block.audioSceneId || block.segmentId || block.id}: source ${formatSec(block.sourceVideoStartSec)}–${formatSec(block.sourceVideoEndSec)}с / final ${formatSec(getBlockTargetStart(block))}–${formatSec(getBlockTargetEnd(block))}с`}
                  >
                    {markerTone === "lipsync" ? <span className="videoMatchLsBadge">LS</span> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="videoMatchAudioRow">
            <label className="videoMatchAudioToggle">
              <input
                type="checkbox"
                checked={useAudioPreview}
                onChange={(event) => patchProject({ useAudioPreview: event.target.checked }, { lastGood: false })}
              />
              <span>С аудио</span>
            </label>
            <span>{project.audioPreviewMeta?.filename || "аудио не загружено"}</span>
            <span>{formatSec(audioCurrentTimeSec)} / {formatSec(effectiveAudioDurationSec)} с</span>
          </div>
          <div className="videoMatchAudioStatusBadges">
            {sourceVideoUrl
              ? <span className="videoMatchAudioStatusBadge isOk">✅ Видео для предпросмотра загружено</span>
              : <span className="videoMatchAudioStatusBadge isWarn">⚠️ Видео для предпросмотра не загружено</span>}
            {sourceVideoPathForAssembly
              ? <span className="videoMatchAudioStatusBadge isOk">✅ Видео для MP4-сборки загружено</span>
              : (jsonSourceVideoPath
                ? <span className="videoMatchAudioStatusBadge isWarn">⚠️ MP4 использует путь из JSON</span>
                : <span className="videoMatchAudioStatusBadge isWarn">⚠️ MP4 source path не задан</span>)}
            {isAssemblyUsingProxySource ? <span className="videoMatchAudioStatusBadge isWarn">⚠️ MP4 использует proxy video</span> : null}
            {(audioPreviewUrl || project.audioPreviewMeta?.filename)
              ? <span className="videoMatchAudioStatusBadge isOk">✅ Аудио для предпросмотра загружено</span>
              : <span className="videoMatchAudioStatusBadge isWarn">⚠️ Аудио для предпросмотра не загружено</span>}
            {wantsAssembleWithAudio ? (
              isAssembleAudioPathValid
                ? <span className="videoMatchAudioStatusBadge isOk">✅ Путь к аудио для MP4 указан</span>
                : <span className={`videoMatchAudioStatusBadge ${resolvedAssembleAudioPath ? "isError" : "isWarn"}`}>{resolvedAssembleAudioPath ? "❌ Путь к аудио выглядит неверно" : "⚠️ Путь к аудио для MP4 не указан"}</span>
            ) : (
              <span className="videoMatchAudioStatusBadge isWarn">⚠️ Собрать без аудио</span>
            )}
          </div>

          <div className="videoMatchAssemblyHeader">
            <h2>Черновая сборка</h2>
            <span>длительность: {formatSec(assemblyDurationSec)} с</span>
          </div>
          {assemblyBlocks.length === 0 ? <div className="videoMatchEmptyList videoMatchCompactEmpty">Выбранные варианты появятся здесь как цветная лента сцен.</div> : null}
          <div className="videoMatchBlocksStrip" aria-label="Video blocks strip">
            {assemblyBlocks.map((block, index) => (
              <button
                key={block.id}
                type="button"
                className={`videoMatchStripSegment ${block.id === project.selectedBlockId ? "isSelected" : ""} ${block.id === currentPlayingBlockId ? "isCurrent" : ""} ${isAssemblyPlaying && block.id === project.selectedBlockId ? "isPlaying" : ""} ${block.sourceKind === "override_video" ? "isOverride" : ""} ${isLipSyncScene(block) ? "isLipSync" : ""}`}
                style={{ "--strip-color-index": index % 8 }}
                onClick={() => onSelectBlock(block)}
                title={`${block.audioSceneId || block.segmentId}: video ${formatSec(block.sourceVideoStartSec)}–${formatSec(block.sourceVideoEndSec)}с · candidate ${block.candidateId || block.id}`}
              >
                <span>{block.audioSceneId || block.segmentId || `seg_${String(index + 1).padStart(2, "0")}`}</span>
                {isLipSyncScene(block) ? <span className="videoMatchLsBadge">LS</span> : null}
              </button>
            ))}
          </div>
          <div className="videoMatchActions videoMatchPlaybackActions">
            <button className="clipSB_btn clipSB_btnPrimary videoMatchBtnChunk" type="button" disabled={!selectedBlock} onClick={onPlaySelectedBlock}>▶ Кусок</button>
            <button className="clipSB_btn clipSB_btnPrimary videoMatchBtnAssembly" type="button" disabled={!assemblyBlocks.length} onClick={() => playAssemblyFromBlock(assemblyBlocks[0])}>▶ Сборка</button>
            <button className="clipSB_btn clipSB_btnSecondary videoMatchBtnFromHere" type="button" disabled={!selectedBlock || !assemblyBlocks.length} onClick={() => playAssemblyFromBlock(selectedBlock)}>▶ Отсюда</button>
            <button className="clipSB_btn clipSB_btnSecondary" type="button" disabled={!isPlaybackActive} onClick={stopPlayback}>■ Стоп</button>
            <button className={`clipSB_btn clipSB_btnSecondary ${wantsAssembleWithAudio ? "videoMatchBtnMp4WithAudio" : "videoMatchBtnMp4NoAudio"}`} type="button" disabled={!assemblyBlocks.length || isAssemblingMp4 || (wantsAssembleWithAudio && !isAssembleAudioPathValid)} onClick={onAssembleMp4}>{isAssemblingMp4 ? "Собираем MP4..." : (wantsAssembleWithAudio ? "⬇ MP4 с аудио" : "⬇ MP4 без аудио")}</button>
            <span>{selectedBlock ? `${selectedBlock.id}: ${formatSec(selectedBlock.sourceVideoStartSec)}–${formatSec(selectedBlock.sourceVideoEndSec)} с` : "Кусок не выбран"}</span>
          </div>
          <div className="videoMatchContextRows">
            <label>
              Путь к аудио для сборки
              <input
                type="text"
                value={assembleAudioPath}
                className={audioPathInputError ? "videoMatchInputInvalid" : ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setAssembleAudioPath(value);
                  patchProject({ assembleAudioPath: value }, { lastGood: false });
                }}
                placeholder="C:\\path\\to\\practice_30sec_audio.mp3"
              />
            </label>
            <div className="videoMatchWarnings">
              Для MP4-сборки нужен реальный путь к mp3 на диске. Загруженный через +Аудио blob используется только для предпросмотра.
            </div>
            <details className="videoMatchAudioMixDetails">
              <summary>
                {project.audioMix?.backgroundAudioFilename
                  ? `▸ Аудио микс · фон: ${project.audioMix.backgroundAudioFilename}`
                  : `▸ Аудио микс · видео: ${project.audioMix?.originalVideoAudioMode === "keep" ? "оставить" : project.audioMix?.originalVideoAudioMode === "mute" ? "выключить" : "приглушить"} ${Math.round(Number(project.audioMix?.originalVideoVolume ?? 0.10) * 100)}% · фон: ${Math.round(Number(project.audioMix?.backgroundAudioVolume ?? 0.6) * 100)}%`}
              </summary>
              <div className="videoMatchAudioMixCompact">
              <label>
                🔊 Звук видео:
                <select
                  value={project.audioMix?.originalVideoAudioMode || "duck"}
                  onChange={(event) => patchProject({
                    audioMix: getDefaultVideoMatchAudioMix({
                      ...(project.audioMix || {}),
                      originalVideoAudioMode: event.target.value,
                    }),
                  }, { lastGood: false })}
                >
                  <option value="keep">оставить</option>
                  <option value="duck">приглушить</option>
                  <option value="mute">выключить</option>
                </select>
                <input type="range" min="0" max="1" step="0.01" value={Number(project.audioMix?.originalVideoVolume ?? 0.10)} onChange={(event) => patchProject({
                  audioMix: getDefaultVideoMatchAudioMix({
                    ...(project.audioMix || {}),
                    originalVideoVolume: Number(event.target.value),
                  }),
                }, { lastGood: false })} />
                <span>{Math.round(Number(project.audioMix?.originalVideoVolume ?? 0.10) * 100)}%</span>
              </label>
              <label>
                🎵 Фон:
                <span className="clipSB_btn clipSB_btnSecondary videoMatchAudioMixUploadBtn">
                  Загрузить фон
                  <input type="file" accept="audio/*" hidden onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    patchProject({
                      audioMix: getDefaultVideoMatchAudioMix({
                        ...(project.audioMix || {}),
                        backgroundAudioFilename: String(file.name || ""),
                        backgroundAudioUrl: URL.createObjectURL(file),
                        backgroundAudioPath: "",
                        backgroundAudioNeedsReload: false,
                      }),
                    }, { lastGood: false });
                  }} />
                </span>
                <input type="range" min="0" max="1" step="0.01" value={Number(project.audioMix?.backgroundAudioVolume ?? 0.6)} onChange={(event) => patchProject({
                  audioMix: getDefaultVideoMatchAudioMix({
                    ...(project.audioMix || {}),
                    backgroundAudioVolume: Number(event.target.value),
                  }),
                }, { lastGood: false })} />
                <span>{Math.round(Number(project.audioMix?.backgroundAudioVolume ?? 0.6) * 100)}%</span>
              </label>
              <div className="videoMatchAudioMixMeta">файл: {project.audioMix?.backgroundAudioFilename || "Фон не загружен"}</div>
              {project.audioMix?.backgroundAudioNeedsReload ? <div className="videoMatchError videoMatchAudioNotice">Фон нужно загрузить заново</div> : null}
              </div>
            </details>
            {assembleError ? <div className="videoMatchError">{assembleError}</div> : null}
            {assembleWarning ? <div className="videoMatchWarnings">{assembleWarning}</div> : null}
            {assembledPreview?.ok && assembledPreviewOutputUrl ? (
              <div>
                <a href={assembledPreviewOutputUrl} target="_blank" rel="noreferrer">▶ Смотреть MP4</a>{" "}
                <button
                  className="clipSB_btn clipSB_btnSecondary"
                  type="button"
                  onClick={() => window.open(assembledPreviewOutputUrl, "_blank", "noopener,noreferrer")}
                >
                  ⬇ Скачать MP4
                </button>
                {assembledPreview.warning ? <div className="videoMatchWarnings">warning: {assembledPreview.warning}</div> : null}
              </div>
            ) : null}
          </div>
        </section>

        <aside className="videoMatchPanel videoMatchInspectorPanel">
          <div className="videoMatchPanelHeader">
            <h2>Сцена / Варианты</h2>
            <span>{selectedSegmentCandidates.length} вариантов</span>
          </div>
          <input ref={overrideUploadInputRef} type="file" accept="video/*" hidden onChange={(event) => { onUploadOverrideVideo(event.target.files?.[0]); event.target.value = ""; }} />
          <button className="clipSB_btn clipSB_btnSecondary videoMatchOverrideUploadBtn videoMatchBtnReplaceVideo" type="button" disabled={!selectedSegment} onClick={() => overrideUploadInputRef.current?.click()}>🎭 Заменить видео</button>
          <button className="clipSB_btn clipSB_btnSecondary videoMatchOverrideUploadBtn" type="button" disabled={!selectedSegment || !selectedBoardClip} title={selectedBoardClip ? `Взять видео из Доски: ${selectedBoardClip.sceneId}` : (boardGeneratedClipsStatus || "Для этой сцены нет видео на Доске")} onClick={onUseBoardClipForSelectedSegment}>➕ Взять с доски</button>
          {boardGeneratedClipsStatus ? <div className="videoMatchWarnings">{boardGeneratedClipsStatus}</div> : null}
          {selectedSegment ? (
            <>
              <div className="videoMatchSceneInfo">
                <b>{selectedSegment.audioSceneId || selectedSegment.id}</b>
                <span>story: {selectedSegment.storySceneId || "—"}</span>
                <span>тайминг: {formatSec(selectedSegment.targetStartSec)}–{formatSec(selectedSegment.targetEndSec)} с</span>
                <span>выбрано: {selectedSegment.selectedCandidateId || "—"}</span>
                {isLipSyncScene(selectedSegment) ? <span className="videoMatchSceneLsFlag">LS · lip-sync</span> : null}
                {selectedSegment.text ? <p>{selectedSegment.text}</p> : null}
                {selectedSegment.visualNeed ? <small>Нужно: {selectedSegment.visualNeed}</small> : null}
              </div>
              <h3>Варианты</h3>
              <div className="videoMatchCandidatesList videoMatchInspectorCandidates">
                {selectedSegmentCandidates.map((candidate) => {
                  const candidateKey = getCandidateKey(candidate);
                  const selectedCandidateKey = String(selectedSegment.selectedCandidateId || selectedSegment.selected_candidate_id || "").trim();
                  const isCandidateSelected = candidateKey === selectedCandidateKey;
                  const isPreviewCandidate = candidateKey === previewCandidateId;
                  const selectedSegmentKey = getSegmentKey(selectedSegment);
                  const candidateBlock = assemblyBlocks.find((block) => {
                    const blockSegmentKey = getSegmentKey(block);
                    const blockCandidateKey = getCandidateKey(block);
                    return blockCandidateKey === candidateKey || (blockSegmentKey === selectedSegmentKey && blockCandidateKey === candidateKey);
                  });
                  const effectiveForceMute = getEffectiveForceMuteVideoAudio(candidateBlock, selectedSegment, candidate);
                  return (
                    <div key={candidate.id} className={`videoMatchCandidateCard ${isCandidateSelected ? "isSelected" : ""} ${isPreviewCandidate ? "isPreview" : ""} ${isOverrideCandidate(candidate) ? "isOverride" : ""}`}>
                      {isBrowserSafeThumbnail(candidate.thumbnail) ? <img src={candidate.thumbnail} alt={`${candidate.id} thumbnail`} /> : null}
                      <div className="videoMatchCandidateBody">
                        <b>{candidate.id}{isCandidateSelected ? " · выбрано" : ""}{isPreviewCandidate ? " · просмотр" : ""}</b>
                        <span>видео: {formatSec(getBlockSourceStart(candidate))}–{formatSec(getBlockSourceEnd(candidate))} · уверенность: {candidate.confidence ?? "—"}</span>
                        {isOverrideCandidate(candidate) ? <span className="videoMatchCandidateBadge">свой клип · lip-sync override</span> : null}
                        {isBoardClipCandidate(candidate) ? <span className="videoMatchCandidateBadge">клип с доски</span> : null}
                        {isOverrideCandidate(candidate) ? <small>длина клипа: {formatSec(candidate.overrideDurationSec || candidate.sourceVideoEndSec)}с / цель: {formatSec((selectedSegment?.targetEndSec || 0) - (selectedSegment?.targetStartSec || 0))}с</small> : null}
                        {candidate.matchReason ? <small>{candidate.matchReason}</small> : null}
                        {candidate.warnings?.length ? <small className="videoMatchWarnings">Предупреждения: {candidate.warnings.join("; ")}</small> : null}
                        {isCandidateSelected ? (
                          <label className="videoMatchSceneMuteToggle">
                            <input
                              type="checkbox"
                              checked={effectiveForceMute}
                              onChange={(event) => {
                                const checked = event.target.checked;
                                const targetBlockId = candidateBlock?.id || candidateKey;
                                const targetSegmentId = getSegmentKey(selectedSegment);
                                const targetCandidateId = candidateKey;
                                const nextSegments = (Array.isArray(project.matchSegments) ? project.matchSegments : []).map((segment) => {
                                  if (getSegmentKey(segment) !== targetSegmentId) return segment;
                                  const patchMuteFields = (item) => (item
                                    ? {
                                      ...item,
                                      forceMuteVideoAudio: checked,
                                      force_mute_video_audio: checked,
                                    }
                                    : item);
                                  const nextCandidates = Array.isArray(segment.candidates)
                                    ? segment.candidates.map((item) => (getCandidateKey(item) === targetCandidateId ? patchMuteFields(item) : item))
                                    : segment.candidates;
                                  const nextSelectedCandidate = getCandidateKey(segment.selectedCandidate) === targetCandidateId
                                    ? patchMuteFields(segment.selectedCandidate)
                                    : segment.selectedCandidate;
                                  const nextSelectedCandidateSnake = getCandidateKey(segment.selected_candidate) === targetCandidateId
                                    ? patchMuteFields(segment.selected_candidate)
                                    : segment.selected_candidate;
                                  return {
                                    ...segment,
                                    forceMuteVideoAudio: checked,
                                    force_mute_video_audio: checked,
                                    selectedCandidate: nextSelectedCandidate,
                                    selected_candidate: nextSelectedCandidateSnake,
                                    candidates: nextCandidates,
                                  };
                                });
                                const rebuiltBlocks = buildVideoBlocksFromMatchSegments(nextSegments, sourceVideoUrl);
                                const nextSelectedBlock = rebuiltBlocks.find((block) => (
                                  block.id === targetBlockId
                                  || getCandidateKey(block) === targetCandidateId
                                  || (getSegmentKey(block) === targetSegmentId && getCandidateKey(block) === targetCandidateId)
                                ));
                                patchProject({
                                  videoBlocks: rebuiltBlocks,
                                  matchSegments: nextSegments,
                                  selectedBlockId: nextSelectedBlock?.id || project.selectedBlockId || "",
                                }, { lastGood: false });
                                if (videoRef.current) {
                                  videoRef.current.muted = checked;
                                  videoRef.current.volume = checked ? 0 : 1;
                                }
                              }}
                            />
                            🔇 Без звука в этом клипе
                          </label>
                        ) : null}
                      </div>
                      <div className="videoMatchCandidateActions">
                        <button className="clipSB_btn clipSB_btnSecondary videoMatchIconBtn" type="button" onClick={() => onPreviewCandidate(selectedSegment, candidate)}>▶</button>
                        <button className="clipSB_btn clipSB_btnSecondary videoMatchIconBtn" type="button" disabled={isCandidateSelected} title={isCandidateSelected ? "выбрано" : "Выбрать"} onClick={() => onSelectCandidate(getSegmentKey(selectedSegment), candidateKey)}>✓</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="videoMatchEmptyList">Примените JSON и выберите сцену на strip.</div>
          )}
        </aside>
      </div>

      <div className="videoMatchBelowGrid videoMatchMiniPanels">
        <details className="videoMatchPanel videoMatchDetailsPanel videoMatchJsonPanel">
          <summary>JSON от Codex</summary>
          {pendingImportResult ? (
            <div className="videoMatchReplacePanel">
              <div className="videoMatchReplacePanelTitle">Новый JSON отличается от текущего проекта.</div>
              <div>Сейчас активно: {matchSegments.length} сцены.</div>
              <div>Новый JSON: {Array.isArray(pendingImportResult?.result?.matchSegments) ? pendingImportResult.result.matchSegments.length : 0} сцены.</div>
              <div>Нажмите &quot;Заменить текущий проект новым JSON&quot;.</div>
              <div className="videoMatchReplacePanelActions">
                <button className="clipSB_btn clipSB_btnPrimary" type="button" onClick={() => replaceVideoMatchProjectWithImportedJson(pendingImportResult, { keepRuntimeMedia: true })}>Заменить текущий проект новым JSON</button>
                <button className="clipSB_btn clipSB_btnSecondary" type="button" onClick={() => setPendingImportResult(null)}>Отмена</button>
                <button className="clipSB_btn clipSB_btnSecondary" type="button" onClick={() => { clearNodeState("manual_reset_and_apply"); replaceVideoMatchProjectWithImportedJson(pendingImportResult, { keepRuntimeMedia: true }); }}>Очистить ноду и применить JSON</button>
              </div>
            </div>
          ) : null}
          <div className="videoMatchJsonActions">
            <label className="clipSB_btn clipSB_btnSecondary">📥 Импорт JSON<input type="file" accept="application/json,.json" hidden onChange={async (event) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; const text = await file.text(); setJsonInputDraft(""); patchProject({ jsonInput: "", jsonInputPreview: String(text || "").slice(0, 2000), jsonInputClearedAfterImport: true, jsonError: "" }, { lastGood: false }); validateAndApplyVideoMatchJsonText(text); }} /></label>
            <button className="clipSB_btn clipSB_btnPrimary" type="button" onClick={onApplyJson}>✅ Применить</button>
            <button className="clipSB_btn clipSB_btnSecondary" type="button" onClick={() => forceApplyVideoMatchJsonText(String(jsonInputDraft || project.jsonInputPreview || project.jsonInput || ""))}>⚠️ Заменить проект</button>
            <button className="clipSB_btn clipSB_btnSecondary" type="button" onClick={onExportChatGptPackage}>📤 Пакет для ChatGPT</button>
            <button className="clipSB_btn clipSB_btnSecondary" type="button" onClick={() => { if (window.confirm("Очистить Video Match Node и удалить текущий board/candidates/черновую сборку?")) clearNodeState(); }}>🧹 Очистить</button>
          </div>
          <div className="videoMatchWorkflowStatus">Пакет для ChatGPT сохраняет контекст. Пришлите его в чат — ChatGPT предложит следующий шаг и напишет точное задание Codex.</div>
          <textarea value={jsonInputDraft || project.jsonInputPreview || ""} onChange={(event) => setJsonInputDraft(event.target.value)} placeholder="Вставьте JSON schema video_match_board_v1 или video_match_board_v2..." />
          {project.jsonError ? <div className="videoMatchError">{project.jsonError}</div> : null}
          {importWarnings.length ? <div className="videoMatchWarnings">{importWarnings.join("; ")}</div> : null}
          {pendingImportResult ? <div className="videoMatchWarnings">Импорт ожидает подтверждения замены текущего проекта.</div> : null}
        </details>

        <details className="videoMatchPanel videoMatchDetailsPanel">
          <summary>Аудио-карта</summary>
          <div className="videoMatchContextRows">
            <div>sourceAudioUrl: {project.timingContext?.sourceAudioUrl || "—"}</div>
            <div>audioDurationSec: {formatSec(project.timingContext?.audioDurationSec)}</div>
            <div>timingScenes: {timingScenesForDebug.length}</div>
            <div>segments: {timingSegmentsForDebug.length}</div>
            <div>leadingInsertedSilenceSec: {project.timingContext?.leadingInsertedSilenceSec || project.audioMap?.leading_inserted_silence_sec || 0}</div>
            <div>activeSegments (import): {matchSegments.length}</div>
            <div>podcastEditManifest: {project.timingContext?.podcastEditManifest ? "есть" : "—"}</div>
            <div>composerEditManifest: {project.timingContext?.composerEditManifest ? "есть" : "—"}</div>
          </div>
        </details>

        <details className="videoMatchPanel videoMatchDetailsPanel videoMatchBlocksPanel">
          <summary>Статистика / Debug</summary>
          <div className="videoMatchContextRows">
            <div>board status: {project.status || "—"}</div>
            <div>status matched_global_clean: {String(project.status === "matched_global_clean")}</div>
            <div>сцен: {matchSegments.length}</div>
            <div>вариантов: {candidatesTotal}</div>
            <div>selected candidates count: {matchSegments.filter((segment) => Boolean(segment.selectedCandidateId)).length}</div>
            <div>reserved_generated_lipsync count: {matchSegments.reduce((acc, segment) => acc + ((segment.candidates || []).filter((c) => c?.reserved_generated_lipsync).length), 0)}</div>
            <div>source video duration: {formatSec(project?.sourceVideo?.duration_sec)} с</div>
            <div>JSON source_video.path: {jsonSourceVideoPath || "—"}</div>
            <div>loaded preview video filename: {project?.sourceVideo?.filename || "—"}</div>
            <div>sourceVideoPathForAssembly: {sourceVideoPathForAssembly || "—"}</div>
            <div>actual source path used for MP4: {effectiveSourceVideoPathForMp4 || "—"}</div>
            <div>source resolution used for MP4: {project?.sourceVideo?.width ? `${project.sourceVideo.width}x${project.sourceVideo.height} @ ${project.sourceVideo.fps || 0}fps` : "—"}</div>
            <div>whether source is proxy: {String(isAssemblyUsingProxySource)}</div>
            <div>storage key: {getVideoMatchBoardNodeStorageKey(nodeId)}</div>
            <div>state origin: {stateOrigin}</div>
            <div>video blocks: {videoBlocks.length}</div>
            <div>длительность сборки: {formatSec(assemblyDurationSec)} с</div>
            <div>аудио preview: {project.audioPreviewMeta?.filename || "—"}</div>
            <div>audioPreviewUrl: {project.audioPreviewUrl ? "есть" : "—"}</div>
            <div>selectedSegmentId: {project.selectedSegmentId || "—"}</div>
            <div>selectedCandidateId: {project.selectedCandidateId || "—"}</div>
            <div>selectedBlockId: {project.selectedBlockId || "—"}</div>
            <div>video currentSrc: {videoDiagnostics.currentSrc || "—"}</div>
            <div>video element src: {String(videoRef.current?.src || "—")}</div>
            <div>videoWidth/videoHeight: {videoDiagnostics.videoWidth}x{videoDiagnostics.videoHeight}</div>
            <div>video duration(debug): {formatSec(videoDiagnostics.duration)}</div>
            <div>video readyState/networkState: {videoDiagnostics.readyState}/{videoDiagnostics.networkState}</div>
            <div>video currentTime(debug): {formatSec(videoDiagnostics.currentTime)}</div>
            <div>video last event: {videoDiagnostics.lastEvent}</div>
            <div>video error code/message: {videoDiagnostics.errorCode || 0} / {videoDiagnostics.errorMessage || "—"}</div>
            <div>selected segment id(debug): {selectedSegment?.id || "—"}</div>
            <div>targetStartSec/targetEndSec: {selectedSegment ? `${formatSec(selectedSegment.targetStartSec)} / ${formatSec(selectedSegment.targetEndSec)}` : "—"}</div>
            <div>sourceVideoStartSec/sourceVideoEndSec: {selectedBlock ? `${formatSec(selectedBlock.sourceVideoStartSec)} / ${formatSec(selectedBlock.sourceVideoEndSec)}` : "—"}</div>
            <div>source candidate range: {selectedBlock ? `${formatSec(selectedBlock.sourceCandidateStartSec)} / ${formatSec(selectedBlock.sourceCandidateEndSec)}` : "—"}</div>
            <div>clip_source_start_sec/clip_source_end_sec: {selectedBlock ? `${formatSec(getBlockClipRange(selectedBlock).clipStart)} / ${formatSec(getBlockClipRange(selectedBlock).clipEnd)}` : "—"}</div>
            <div>final clip range: {selectedBlock ? `${formatSec(getBlockClipRange(selectedBlock).clipStart)} / ${formatSec(getBlockClipRange(selectedBlock).clipEnd)}` : "—"}</div>
            <div>visual_family: {selectedSegment?.visual_family || selectedSegment?.visualFamily || "—"}</div>
            <div>source_usage_key: {selectedSegment?.source_usage_key || selectedSegment?.sourceUsageKey || "—"}</div>
            <div>clean_cut_status: {selectedSegment?.clean_cut_status || selectedSegment?.cleanCutStatus || "—"}</div>
            <div>event_anchor: {selectedSegment?.event_anchor || selectedSegment?.eventAnchor || "—"}</div>
            <div>selectedCandidateId(debug): {selectedSegment?.selectedCandidateId || "—"}</div>
            <div>reservedGeneratedLipsync(selected): {String(Boolean(selectedSegment?.reservedGeneratedLipsync || selectedSegment?.reserved_generated_lipsync))}</div>
            <div>useRealSourceClip(selected): {String(Boolean(selectedSegment?.useRealSourceClip ?? selectedSegment?.use_real_source_clip))}</div>
            <div>reserved_generated_lipsync(selected): {selectedSegmentCandidates.filter((candidate) => candidate?.reserved_generated_lipsync).length}</div>
          </div>

          <details className="videoMatchNestedDebug">
            <summary>Segments / candidates</summary>
            {matchSegments.length === 0 ? <div className="videoMatchEmptyList">После применения JSON здесь появятся segments и candidates.</div> : null}
            <div className="videoMatchSegmentsList">
              {matchSegments.map((segment) => {
                const candidates = Array.isArray(segment.candidates) ? segment.candidates : [];
                const isSegmentSelected = segment.id === project.selectedSegmentId;
                const isOpen = segment.id === project.selectedSegmentId;
                return (
                  <div key={segment.id} className={`videoMatchSegmentCard ${isSegmentSelected ? "isSelected" : ""}`}>
                    <div className="videoMatchSegmentHeader">
                      <div className="videoMatchSegmentTitle">
                        <b>{segment.audioSceneId || segment.id}</b>
                        <span>story: {segment.storySceneId || "—"}</span>
                        <span>тайминг {formatSec(segment.targetStartSec)}–{formatSec(segment.targetEndSec)} · выбрано {segment.selectedCandidateId || "—"} · вариантов {candidates.length}</span>
                      </div>
                    </div>
                    {segment.text ? <p>{segment.text}</p> : null}
                    {segment.visualNeed ? <small className="videoMatchSegmentNeed">Нужно: {segment.visualNeed}</small> : null}
                    {isOpen ? (
                      <div className="videoMatchCandidatesList">
                        {candidates.map((candidate) => {
                          const isCandidateSelected = candidate.id === segment.selectedCandidateId;
                          const isPreviewCandidate = candidate.id === previewCandidateId;
  return (
                            <div key={candidate.id} className={`videoMatchCandidateCard ${isCandidateSelected ? "isSelected" : ""} ${isPreviewCandidate ? "isPreview" : ""}`}>
                              {isBrowserSafeThumbnail(candidate.thumbnail) ? <img src={candidate.thumbnail} alt={`${candidate.id} thumbnail`} /> : null}
                              <div className="videoMatchCandidateBody">
                                <b>{candidate.id}{isPreviewCandidate ? " · просмотр" : ""}</b>
                                <span>видео {formatSec(candidate.sourceVideoStartSec)}–{formatSec(candidate.sourceVideoEndSec)} · уверенность {candidate.confidence ?? "—"}</span>
                                {candidate.matchReason ? <small>{candidate.matchReason}</small> : null}
                                {candidate.warnings?.length ? <small className="videoMatchWarnings">Предупреждения: {candidate.warnings.join("; ")}</small> : null}
                                                      </div>
                              <div className="videoMatchCandidateActions">
                                <button className="clipSB_btn clipSB_btnSecondary videoMatchIconBtn" type="button" onClick={() => onPreviewCandidate(segment, candidate)}>▶</button>
                                <button className="clipSB_btn clipSB_btnSecondary videoMatchIconBtn" type="button" disabled={isCandidateSelected} title={isCandidateSelected ? "выбрано" : "Выбрать"} onClick={() => onSelectCandidate(segment.id, candidate.id)}>✓</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </details>

          <details className="videoMatchNestedDebug">
            <summary>Video blocks</summary>
            {videoBlocks.length === 0 ? <div className="videoMatchEmptyList">Выбранные варианты появятся здесь как video blocks.</div> : null}
            <div className="videoMatchBlocksList">
              {videoBlocks.map((block) => (
                <button key={block.id} type="button" className={`videoMatchBlockCard ${block.id === project.selectedBlockId ? "isSelected" : ""}`} onClick={() => onSelectBlock(block)}>
                  <b>{block.id}</b>
                  <span>audio: {block.audioSceneId || "—"} · тайминг {formatSec(block.targetStartSec)}–{formatSec(block.targetEndSec)}</span>
                  <span>видео {formatSec(block.sourceVideoStartSec)}–{formatSec(block.sourceVideoEndSec)} · уверенность {block.confidence ?? "—"}</span>
                  {block.matchReason ? <small>{block.matchReason}</small> : null}
                </button>
              ))}
            </div>
          </details>
        </details>
      </div>
    </div>
  );
}
