/* AVA_VIDEO_NODE_CANDIDATES_PERSIST_V33: persist visible candidates across computers by restoring/saving candidate totals and ids. */
/* AVA_VIDEO_NODE_TAKE_BOARD_BUTTON_FEEDBACK_V32 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { API_BASE, buildApiUrl, fetchJson } from "../../services/api.js";
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
/* AVA_VIDEO_NODE_SIMPLE_SLOT_CANDIDATE_FLOW_V24: scene slots stay fixed; add variants without applying; checkmark applies selected candidate and preview/assembly uses it. */
/* AVA_VIDEO_NODE_SCENE_SLOT_APPLY_PREVIEW_V25: scene click and assembly use the selected candidate, not the original source by accident. */
import { WORKFLOW_PRESETS, getPresetById } from "../../data/codex_jobs/index.js";
import WorkflowStageControls from "../../components/WorkflowStageControls.jsx";

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


const VIDEO_MATCH_SOURCE_COLORS = {
  src_01: "#facc15",
  src_02: "#38bdf8",
  src_03: "#34d399",
  src_04: "#a78bfa",
  src_05: "#fb7185",
  board: "#a855f7",
  ls: "#a855f7",
  upload: "#fb923c",
  override: "#fb923c",
  user_override: "#fb923c",
};

function getVideoNodeSourceVideoId(item = {}) {
  return String(
    item?.sourceVideoId
    || item?.source_video_id
    || item?.sourceId
    || item?.source_id
    || item?.source_video?.id
    || "src_01"
  ).trim() || "src_01";
}

function getVideoNodeSourceColor(sourceId = "src_01") {
  const normalized = String(sourceId || "src_01").trim().toLowerCase();
  return VIDEO_MATCH_SOURCE_COLORS[normalized] || VIDEO_MATCH_SOURCE_COLORS[String(sourceId || "src_01").trim()] || VIDEO_MATCH_SOURCE_COLORS.src_01;
}

function getVideoNodeSourceShortLabel(sourceId = "src_01") {
  const raw = String(sourceId || "src_01").trim();
  const lowered = raw.toLowerCase();
  if (lowered === "board" || lowered === "ls") return "BOARD";
  if (lowered === "upload" || lowered === "override" || lowered === "user_override") return "UPLOAD";
  const match = raw.match(/(\d+)/);
  return match ? `V${Number(match[1])}` : raw.toUpperCase();
}

function getVideoNodeSelectedCandidate(segment = {}, candidates = []) {
  const list = Array.isArray(candidates) ? candidates : (Array.isArray(segment?.candidates) ? segment.candidates : []);
  const selectedCandidateId = String(segment?.selectedCandidateId || segment?.selected_candidate_id || "").trim();
  return list.find((candidate) => getCandidateKey(candidate) === selectedCandidateId) || list[0] || null;
}

function getVideoNodeHomeCandidate(segment = {}, candidates = []) {
  const list = Array.isArray(candidates) ? candidates : (Array.isArray(segment?.candidates) ? segment.candidates : []);
  return list.find((candidate) => !isBoardClipCandidate(candidate) && !isOverrideCandidate(candidate)) || list[0] || null;
}

function getVideoNodeCandidateVisualSourceId(candidate = {}) {
  if (isBoardClipCandidate(candidate)) return "board";
  if (isOverrideCandidate(candidate)) return "upload";
  return getVideoNodeSourceVideoId(candidate);
}

function getVideoNodeSegmentSourceVideoId(segment = {}, candidates = []) {
  const selectedCandidate = getVideoNodeSelectedCandidate(segment, candidates);
  return getVideoNodeCandidateVisualSourceId(selectedCandidate || segment);
}

function getVideoNodeTimelineLaneSourceId(segment = {}, candidates = []) {
  const explicit = String(segment?.timelineSourceVideoId || segment?.timeline_source_video_id || "").trim();
  if (explicit && !["board", "ls", "upload", "override", "user_override"].includes(explicit.toLowerCase())) return explicit;
  const homeCandidate = getVideoNodeHomeCandidate(segment, candidates);
  const homeSource = getVideoNodeSourceVideoId(homeCandidate || segment);
  return ["board", "ls", "upload", "override", "user_override"].includes(String(homeSource || "").toLowerCase()) ? "src_01" : homeSource;
}

function getVideoNodeTimelineSourceRange(segment = {}, candidates = []) {
  const homeCandidate = getVideoNodeHomeCandidate(segment, candidates) || segment;
  const start = Number(homeCandidate?.sourceVideoStartSec ?? homeCandidate?.video_t0 ?? homeCandidate?.source_video_start_sec ?? 0) || 0;
  const rawEnd = Number(homeCandidate?.sourceVideoEndSec ?? homeCandidate?.video_t1 ?? homeCandidate?.source_video_end_sec ?? start) || start;
  const fallbackDuration = Math.max(0.05, Number((segment?.targetEndSec ?? segment?.target_t1 ?? 0) - (segment?.targetStartSec ?? segment?.target_t0 ?? 0)) || 0.1);
  const end = rawEnd > start ? rawEnd : start + fallbackDuration;
  return { start: Math.max(0, start), end: Math.max(start + 0.05, end) };
}



function normalizeVideoNodeSourceEntry(entry = {}, index = 0) {
  const source = entry && typeof entry === "object" ? entry : {};
  const id = String(source.id || source.sourceVideoId || source.source_video_id || `src_${String(index + 1).padStart(2, "0")}`).trim();
  return {
    ...source,
    id,
    sourceVideoId: id,
    source_video_id: id,
    label: String(source.label || source.sourceVideoLabel || source.source_video_label || `Видео ${index + 1}`).trim(),
    filename: String(source.filename || source.name || source.fileName || "").trim(),
    name: String(source.name || source.filename || source.fileName || "").trim(),
    path: String(source.path || source.sourceVideoPath || source.source_video_path || "").trim(),
    duration_sec: Number(source.duration_sec || source.durationSec || 0) || 0,
    durationSec: Number(source.durationSec || source.duration_sec || 0) || 0,
    previewUrl: String(source.previewUrl || source.preview_url || source.url || "").trim(),
    sourceVideoUrl: String(source.sourceVideoUrl || source.source_video_url || source.previewUrl || source.preview_url || "").trim(),
    backendPath: String(source.backendPath || source.backend_path || "").trim(),
    sourceVideoPathForAssembly: String(source.sourceVideoPathForAssembly || source.source_video_path_for_assembly || source.backendPath || source.backend_path || "").trim(),
    assetId: String(source.assetId || source.asset_id || "").trim(),
    asset_id: String(source.asset_id || source.assetId || "").trim(),
    assetApiPath: String(source.assetApiPath || source.asset_api_path || "").trim(),
    asset_api_path: String(source.asset_api_path || source.assetApiPath || "").trim(),
    serverPath: String(source.serverPath || source.server_path || "").trim(),
    server_path: String(source.server_path || source.serverPath || "").trim(),
    localPath: String(source.localPath || source.local_path || "").trim(),
    local_path: String(source.local_path || source.localPath || "").trim(),
    color: source.color || getVideoNodeSourceColor(id),
  };
}

function normalizeVideoNodeSourceFilename(value = "") {
  return String(value || "").trim().toLowerCase().replace(/\\/g, "/").split("/").pop();
}

function getVideoNodeSourceSlotIndex(source = {}, fallbackIndex = 0) {
  const item = source && typeof source === "object" ? source : {};
  const raw = String(
    item.slot
    || item.slotId
    || item.slot_id
    || item.sourceVideoId
    || item.source_video_id
    || item.id
    || item.label
    || ""
  ).trim();
  const rawMatch = raw.match(/(?:src[_-]?|v)?0*(\d+)/i);
  if (rawMatch) return Math.max(1, Number(rawMatch[1]) || 1);
  const filename = normalizeVideoNodeSourceFilename(item.filename || item.name || item.fileName || "");
  const fileMatch = filename.match(/^0*(\d+)(?:\.[a-z0-9]+)?$/i);
  if (fileMatch) return Math.max(1, Number(fileMatch[1]) || 1);
  return Math.max(1, Number(fallbackIndex || 0) + 1);
}

function getVideoNodeSourceAssemblyPathValue(source = {}) {
  const item = source && typeof source === "object" ? source : {};
  const raw = String(
    item.sourceVideoPathForAssembly
    || item.source_video_path_for_assembly
    || item.backendPath
    || item.backend_path
    || item.serverPath
    || item.server_path
    || item.sourcePath
    || item.source_path
    || item.localPath
    || item.local_path
    || item.path
    || item.sourceVideoPath
    || item.source_video_path
    || ""
  ).trim();
  if (/^(blob:|data:)/i.test(raw)) return "";
  return raw;
}

function pickUploadedVideoNodeSourceFields(source = {}) {
  const item = source && typeof source === "object" ? source : {};
  const path = getVideoNodeSourceAssemblyPathValue(item);
  const picked = {};
  [
    "assetId", "asset_id", "assetApiPath", "asset_api_path",
    "serverPath", "server_path", "backendPath", "backend_path",
    "sourcePath", "source_path", "localPath", "local_path",
    "path", "sourceVideoPath", "source_video_path",
    "sourceVideoPathForAssembly", "source_video_path_for_assembly",
    "previewUrl", "preview_url", "sourceVideoUrl", "source_video_url", "url",
    "width", "height", "fps", "duration_sec", "durationSec",
    "has_audio_stream", "size", "type",
  ].forEach((field) => {
    const value = item[field];
    if (value !== undefined && value !== null && String(value).trim() !== "") picked[field] = value;
  });
  if (path) {
    picked.path = path;
    picked.backendPath = path;
    picked.backend_path = path;
    picked.sourceVideoPathForAssembly = path;
    picked.source_video_path_for_assembly = path;
    picked.sourceVideoPath = path;
    picked.source_video_path = path;
  }
  return picked;
}

function buildVideoNodeUploadedSourceRegistry(project = {}, currentSources = []) {
  const rawSources = [
    ...(Array.isArray(currentSources) ? currentSources : []),
    ...(Array.isArray(project?.sourceVideos) ? project.sourceVideos : []),
    ...(Array.isArray(project?.source_videos) ? project.source_videos : []),
    {
      id: "src_01",
      sourceVideoId: "src_01",
      source_video_id: "src_01",
      filename: project?.sourceVideo?.filename || project?.source_video?.filename || "",
      name: project?.sourceVideo?.name || project?.source_video?.name || "",
      path: project?.sourceVideoPathForAssembly || project?.uploadedSourceVideoPath || project?.sourceVideo?.backendPath || project?.sourceVideo?.path || project?.source_video?.path || "",
      backendPath: project?.sourceVideoPathForAssembly || project?.uploadedSourceVideoPath || project?.sourceVideo?.backendPath || "",
      sourceVideoPathForAssembly: project?.sourceVideoPathForAssembly || project?.uploadedSourceVideoPath || project?.sourceVideo?.backendPath || "",
      previewUrl: project?.sourceVideoUrl || "",
      sourceVideoUrl: project?.sourceVideoUrl || "",
      duration_sec: project?.sourceVideo?.duration_sec || project?.source_video?.duration_sec || 0,
      width: project?.sourceVideo?.width || 0,
      height: project?.sourceVideo?.height || 0,
      fps: project?.sourceVideo?.fps || 0,
    },
  ];

  const byId = new Map();
  const bySlot = new Map();
  const byFilename = new Map();
  rawSources.map(normalizeVideoNodeSourceEntry).forEach((source, index) => {
    const picked = pickUploadedVideoNodeSourceFields(source);
    const hasUploadedMaterial = Boolean(getVideoNodeSourceAssemblyPathValue(picked) || picked.assetId || picked.asset_id || picked.assetApiPath || picked.asset_api_path || picked.previewUrl || picked.sourceVideoUrl);
    if (!hasUploadedMaterial) return;
    const normalized = normalizeVideoNodeSourceEntry({ ...source, ...picked }, index);
    const id = String(normalized.id || normalized.sourceVideoId || normalized.source_video_id || "").trim();
    const slot = getVideoNodeSourceSlotIndex(normalized, index);
    const filename = normalizeVideoNodeSourceFilename(normalized.filename || normalized.name || "");
    if (id && !byId.has(id)) byId.set(id, normalized);
    if (slot && !bySlot.has(slot)) bySlot.set(slot, normalized);
    if (filename && !byFilename.has(filename)) byFilename.set(filename, normalized);
  });
  return { byId, bySlot, byFilename };
}

function mergeImportedVideoNodeSourceWithUploaded(importedSource = {}, uploadedSource = null, index = 0) {
  const imported = normalizeVideoNodeSourceEntry(importedSource, index);
  if (!uploadedSource) return imported;
  const uploaded = normalizeVideoNodeSourceEntry(uploadedSource, index);
  const uploadedFields = pickUploadedVideoNodeSourceFields(uploaded);
  const merged = {
    ...uploaded,
    ...imported,
    label: imported.label || uploaded.label,
    color: imported.color || uploaded.color || getVideoNodeSourceColor(imported.id || uploaded.id),
    duration_sec: Number(imported.duration_sec || imported.durationSec || 0) || Number(uploaded.duration_sec || uploaded.durationSec || 0) || 0,
    durationSec: Number(imported.durationSec || imported.duration_sec || 0) || Number(uploaded.durationSec || uploaded.duration_sec || 0) || 0,
    width: Number(imported.width || 0) || Number(uploaded.width || 0) || 0,
    height: Number(imported.height || 0) || Number(uploaded.height || 0) || 0,
    fps: Number(imported.fps || 0) || Number(uploaded.fps || 0) || 0,
    ...uploadedFields,
  };
  const id = imported.id || uploaded.id || `src_${String(index + 1).padStart(2, "0")}`;
  return normalizeVideoNodeSourceEntry({ ...merged, id, sourceVideoId: id, source_video_id: id }, index);
}

function mergeImportedVideoNodeSourcesWithUploaded(importedSources = [], project = {}, currentSources = []) {
  const registry = buildVideoNodeUploadedSourceRegistry(project, currentSources);
  const sourceList = Array.isArray(importedSources) && importedSources.length
    ? importedSources
    : (Array.isArray(currentSources) ? currentSources : []);
  return sourceList.slice(0, 5).map((source, index) => {
    const imported = normalizeVideoNodeSourceEntry(source, index);
    const id = String(imported.id || imported.sourceVideoId || imported.source_video_id || "").trim();
    const slot = getVideoNodeSourceSlotIndex(imported, index);
    const filename = normalizeVideoNodeSourceFilename(imported.filename || imported.name || "");
    const match = (id && registry.byId.get(id))
      || (slot && registry.bySlot.get(slot))
      || (filename && registry.byFilename.get(filename))
      || null;
    return mergeImportedVideoNodeSourceWithUploaded(imported, match, index);
  });
}

function mergeVideoNodeSourceEntry(existing = [], nextEntry = {}) {
  const normalizedExisting = (Array.isArray(existing) ? existing : []).map(normalizeVideoNodeSourceEntry);
  const next = normalizeVideoNodeSourceEntry(nextEntry, normalizedExisting.length);
  const found = normalizedExisting.some((item) => item.id === next.id);
  const list = found
    ? normalizedExisting.map((item) => item.id === next.id ? { ...item, ...next } : item)
    : [...normalizedExisting, next];
  return list.slice(0, 5);
}

function doesVideoMatchPatchDirtyAssembly(patch = {}) {
  if (!patch || typeof patch !== "object") return false;
  const dirtyKeys = [
    "sourceVideo", "source_video", "sourceVideoUrl", "sourceVideoPath", "sourceVideoPathForAssembly",
    "uploadedSourceVideoPath", "sourceVideos", "source_videos",
    "audioPreviewUrl", "audioPreviewMeta", "audioPreviewBackendUrl", "assembleAudioPath",
    "audioPathForAssembly", "timingContext", "audioMap", "audioMix",
    "matchSegments", "videoBlocks", "selectedCandidateId", "selectedBlockId", "selectedSegmentId",
    "importSignature", "importedAt",
  ];
  return dirtyKeys.some((key) => Object.prototype.hasOwnProperty.call(patch, key));
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

function isVideoNodeLocalBrowserPath(value = "") {
  const raw = String(value || "").trim();
  return /^[a-zA-Z]:[\\/]/.test(raw) || raw.startsWith("\\\\") || raw.startsWith("file:");
}

function normalizePlayableVideoUrl(outputUrl = "") {
  const raw = String(outputUrl || "").trim();
  if (!raw || isVideoNodeLocalBrowserPath(raw)) return "";
  if (/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::(?:8000|8010))?(\/static\/.*)$/i.test(raw)) {
    return raw.replace(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::(?:8000|8010))?/i, API_BASE);
  }
  if (/^https?:\/\//i.test(raw) || raw.startsWith("blob:") || raw.startsWith("data:")) return raw;
  if (raw.startsWith("/static/")) return `${API_BASE}${raw}`;
  if (raw.startsWith("static/")) return `${API_BASE}/${raw}`;
  if (raw.startsWith("/assets/")) return buildApiUrl(raw);
  if (raw.startsWith("/api/")) return buildApiUrl(raw);
  if (raw.startsWith("/")) return buildApiUrl(raw);
  return buildApiUrl(raw);
}

function resolveOutputUrl(outputUrl = "") {
  return normalizePlayableVideoUrl(outputUrl);
}

function isVideoNodeProtectedAssetUrl(url = "") {
  const raw = String(url || "").trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw, typeof window !== "undefined" ? window.location.href : "http://localhost");
    return parsed.pathname.includes("/api/assets/") || parsed.pathname.startsWith("/assets/");
  } catch {
    return raw.startsWith("/assets/") || raw.startsWith("/api/assets/");
  }
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

async function fetchVideoNodeWorkspaceProject(projectId = "") {
  const endpoint = projectId
    ? `${API_BASE}/api/projects/${projectId}/snapshots/video_node`
    : `${API_BASE}/api/workspace/snapshots/video_node`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: getVideoNodeAuthHeaders(),
  });
  if (!response.ok) throw new Error(`workspace snapshot load failed ${response.status}`);
  const data = await response.json().catch(() => null);
  return pickVideoNodeWorkspaceProject(data || {});
}

async function saveVideoNodeWorkspaceProject(project = {}, nodeId = "default", projectId = "") {
  const payload = makeVideoNodeWorkspacePayload(project, nodeId);
  const endpoint = projectId
    ? `${API_BASE}/api/projects/${projectId}/snapshots/video_node`
    : `${API_BASE}/api/workspace/snapshots/video_node`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: getVideoNodeAuthHeaders(),
    body: JSON.stringify({
      data: payload,
      client_version: "video-node-f5-patch05",
      guard_mode: "safe_merge",
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
  const hasMmaudioVideo = Boolean(
    scene.mmaudio_video_api_path
    || scene.mmaudioVideoApiPath
    || scene.mmaudio_video_url
    || scene.mmaudioVideoUrl
    || mmaudioResult.videoApiPath
    || mmaudioResult.video_api_path
    || mmaudioResult.videoUrl
    || mmaudioResult.video_url
  );
  const preferredResult = hasMmaudioVideo ? mmaudioResult : videoResult;
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
  const rawVideoUrl = String(
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
  const videoUrl = normalizePlayableVideoUrl(videoApiPath || rawVideoUrl);
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
        videoUrl: video.videoUrl || normalizePlayableVideoUrl(video.videoApiPath) || "",
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
  const overrideVideoUrl = normalizePlayableVideoUrl(boardClip.videoApiPath || boardClip.videoUrl || "");
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
    overrideVideoUrl,
    override_video_url: overrideVideoUrl,
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

async function fetchBoardGeneratedClipsFromWorkspace(projectId = "") {
  // AVA_VIDEO_NODE_BOARD_BUTTON_AND_CANDIDATES_V31:
  // Prefer the current project board snapshot, then fall back to workspace snapshot.
  const endpoints = [];
  const cleanProjectId = String(projectId || "").trim();
  if (cleanProjectId) {
    endpoints.push(`${API_BASE}/api/projects/${encodeURIComponent(cleanProjectId)}/snapshots/board`);
  }
  endpoints.push(`${API_BASE}/api/workspace/snapshots/board`);

  const collected = [];
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: getVideoNodeAuthHeaders(),
      });
      if (!response.ok) {
        lastError = new Error(`board snapshot load failed ${response.status}`);
        continue;
      }
      const data = await response.json().catch(() => null);
      const clips = extractBoardGeneratedClips(data || {});
      if (Array.isArray(clips) && clips.length) collected.push(...clips);
    } catch (error) {
      lastError = error;
    }
  }

  const seen = new Set();
  const unique = [];
  for (const clip of collected) {
    const key = [
      clip.sceneId,
      clip.videoApiPath,
      clip.videoUrl,
      clip.localPath,
      clip.title,
    ].map((item) => String(item || "").trim()).filter(Boolean).join("|");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(clip);
  }

  if (unique.length) return unique;
  if (lastError) throw lastError;
  return [];
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

const AUDIO_EXPORT_EXTENSIONS = [".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"];

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
  if (code === "AUDIO_PATH_REQUIRED") return "Загрузите аудио через +Аудио: файл должен сохраниться на backend для MP4-сборки.";
  if (code === "AUDIO_PATH_NOT_FOUND") return "Файл не найден по указанному пути к аудио.";
  if (code === "AUDIO_PATH_INVALID_EXT") return "Неподдерживаемый формат аудио. Используйте .mp3, .wav, .m4a или .aac.";
  if (["AUDIO_PATH_PREVIEW_ONLY", "AUDIO_PATH_NOT_LOCAL", "AUDIO_PATH_TRUNCATED"].includes(code)) {
    return "Аудио не готово для MP4. Нажмите +Аудио ещё раз, чтобы файл загрузился на backend.";
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
  const { projectId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const nodeId = String(searchParams.get("nodeId") || location.state?.nodeId || "default").trim() || "default";
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const backgroundAudioRef = useRef(null);
  const playbackRef = useRef(null);
  const sceneExactPreviewStopTimerRef = useRef(null);
  const sceneAutoPreviewStopTimerRef = useRef(null);
  const assemblyAudioSyncTimerRef = useRef(null);
  const assemblyAudioSwitchingBlockRef = useRef("");
  const activeVideoSourceKindRef = useRef("source");
  const objectUrlRef = useRef("");
  const sourceVideoObjectUrlByIdRef = useRef({});
  const audioObjectUrlRef = useRef("");
  const backgroundAudioObjectUrlRef = useRef("");
  const overrideVideoObjectUrlRef = useRef("");
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
  const [activeSourceVideoId, setActiveSourceVideoId] = useState("src_01");
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
  const audioLoadMessageTone = useMemo(() => {
    const value = String(audioLoadMessage || "").toLowerCase();
    if (!value) return "";
    if (value.includes("готово") || value.includes("загружено на backend") || value.includes("ready")) return "isSuccess";
    if (value.includes("загружаю") || value.includes("upload")) return "isInfo";
    return "isError";
  }, [audioLoadMessage]);

  useEffect(() => {
    const value = String(audioLoadMessage || "").toLowerCase();
    if (!(value.includes("готово") || value.includes("загружено на backend") || value.includes("ready"))) return undefined;
    const timer = window.setTimeout(() => setAudioLoadMessage(""), 3600);
    return () => window.clearTimeout(timer);
  }, [audioLoadMessage]);
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
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const refreshBoardGeneratedClips = useCallback(async (reason = "auto") => {
    try {
      const clips = await fetchBoardGeneratedClipsFromWorkspace(projectId);
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
  const sourceVideos = useMemo(() => {
    const fromProject = Array.isArray(project.sourceVideos)
      ? project.sourceVideos
      : (Array.isArray(project.source_videos) ? project.source_videos : []);
    const normalized = fromProject.map(normalizeVideoNodeSourceEntry);
    const primaryEntry = normalizeVideoNodeSourceEntry({
      id: "src_01",
      label: "Видео 1",
      filename: project.sourceVideo?.filename || project.source_video?.filename || "source.mp4",
      name: project.sourceVideo?.name || project.sourceVideo?.filename || project.source_video?.filename || "source.mp4",
      path: project.sourceVideo?.path || project.source_video?.path || project.sourceVideoPath || "",
      duration_sec: project.sourceVideo?.duration_sec || project.source_video?.duration_sec || 0,
      previewUrl: sourceVideoUrl,
      sourceVideoUrl,
      backendPath: project.sourceVideo?.backendPath || project.uploadedSourceVideoPath || project.sourceVideoPathForAssembly || "",
      sourceVideoPathForAssembly: project.sourceVideoPathForAssembly || project.uploadedSourceVideoPath || project.sourceVideo?.backendPath || "",
    }, 0);
    const list = normalized.some((item) => item.id === "src_01")
      ? normalized.map((item) => item.id === "src_01" ? { ...primaryEntry, ...item, previewUrl: item.previewUrl || primaryEntry.previewUrl, sourceVideoUrl: item.sourceVideoUrl || primaryEntry.sourceVideoUrl } : item)
      : [primaryEntry, ...normalized];
    return list.slice(0, 5);
  }, [project.sourceVideos, project.source_videos, project.sourceVideo, project.source_video, project.sourceVideoPath, project.uploadedSourceVideoPath, project.sourceVideoPathForAssembly, sourceVideoUrl]);
  const audioPreviewUrl = String(project.audioPreviewUrl || "");

  const isVideoNodeSourceLoaded = (source = {}) => {
    const normalized = normalizeVideoNodeSourceEntry(source);
    return Boolean(
      normalized.previewUrl ||
      normalized.sourceVideoUrl ||
      normalized.url ||
      normalized.backendPath ||
      normalized.sourceVideoPathForAssembly ||
      normalized.source_video_path_for_assembly ||
      normalized.backend_path
    );
  };

  const getNextAvailableVideoSourceId = () => {
    const normalizedSources = (Array.isArray(sourceVideos) ? sourceVideos : []).map(normalizeVideoNodeSourceEntry);
    for (let index = 1; index <= 5; index += 1) {
      const id = `src_${String(index).padStart(2, "0")}`;
      const existing = normalizedSources.find((source) => source.id === id || source.sourceVideoId === id || source.source_video_id === id);
      if (!existing || !isVideoNodeSourceLoaded(existing)) return id;
    }
    return "";
  };

  const getLoadedVideoSourceCount = () => {
    return (Array.isArray(sourceVideos) ? sourceVideos : [])
      .map(normalizeVideoNodeSourceEntry)
      .filter(isVideoNodeSourceLoaded)
      .length;
  };

  const onNextSourceVideoFileChange = async (file, event = null) => {
    if (!file) return;
    const nextSourceId = getNextAvailableVideoSourceId();
    if (!nextSourceId) {
      setSourceVideoLoadMessage("Лимит: уже загружено 5 исходных видео. Замену/удаление источника добавим отдельной кнопкой.");
      if (event?.target) event.target.value = "";
      return;
    }

    setSourceVideoLoadMessage(`Загружаю ${getVideoNodeSourceShortLabel(nextSourceId)}...`);
    try {
      await onVideoFileChange(file, nextSourceId);
    } finally {
      if (event?.target) event.target.value = "";
    }
  };

  const runtimeSourceVideoUrlRef = useRef(String(initialProject?.sourceVideoUrl || "").startsWith("blob:") ? String(initialProject?.sourceVideoUrl || "") : "");
  const runtimeAudioPreviewUrlRef = useRef(String(initialProject?.audioPreviewUrl || "").startsWith("blob:") ? String(initialProject?.audioPreviewUrl || "") : "");
  const effectiveAudioPreviewUrl = String(
    project.audioPreviewUrl
    || runtimeAudioPreviewUrlRef.current
    || project.audioPreviewBackendUrl
    || project.audioPreviewMeta?.backendUrl
    || project.audioPreviewMeta?.url
    || ""
  );


  const useAudioPreview = Boolean(project.useAudioPreview);
  const wantsAssembleWithAudio = useAudioPreview;
  const uploadedAssemblyAudioPath = String(
    project?.audioPathForAssembly
    || project?.audioPreviewMeta?.backendPath
    || project?.timingContext?.sourceAudioPath
    || project?.assembleAudioPath
    || assembleAudioPath
    || ""
  ).trim();
  const resolvedAssembleAudioPath = /(^|[\\/])path[\\/]to[\\/]|practice_30/i.test(uploadedAssemblyAudioPath) ? "" : uploadedAssemblyAudioPath;
  const assembleAudioPathValidation = validateAssembleAudioPath(resolvedAssembleAudioPath);
  const isAssembleAudioPathValid = assembleAudioPathValidation.ok;
  const audioPathInputError = wantsAssembleWithAudio && !isAssembleAudioPathValid;
  const timelineDuration = videoDurationSec || Number(project?.sourceVideo?.duration_sec || 0) || 0;
  const effectiveAudioDurationSec = audioDurationSec || Number(project?.audioPreviewMeta?.duration_sec || 0) || 0;
  const assemblyDurationSec = Math.max(0, ...assemblyBlocks.map((block) => getBlockTargetEnd(block)));
  const assembledPreviewOutputUrl = resolveOutputUrl(assembledPreview?.outputUrl || "");
  const assemblyDirty = Boolean(project?.assemblyDirty);
  const hasReadyMp4Preview = Boolean(assembledPreview?.ok && assembledPreviewOutputUrl);
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
    const shouldMarkAssemblyDirty = hasReadyMp4Preview
      && !persistOptions.keepAssemblyClean
      && patch.assemblyDirty !== false
      && doesVideoMatchPatchDirtyAssembly(patch);
    const nextPatch = shouldMarkAssemblyDirty ? { ...patch, assemblyDirty: true } : patch;
    setProject((prev) => persistVideoMatchBoardProject({ ...prev, ...(nextPatch || {}), nodeId, sourceNodeId: nodeId }, persistOptions));
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
    setAssembleAudioPath(String(initialProject?.audioPathForAssembly || initialProject?.audioPreviewMeta?.backendPath || initialProject?.timingContext?.sourceAudioPath || initialProject?.assembleAudioPath || initialProject?.audioPath || ""));
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

    fetchVideoNodeWorkspaceProject(projectId)
      .then((workspaceProject) => {
        if (cancelled || !workspaceProject) return;
        const currentStats = getVideoMatchProjectStats(project);
        const backendStats = getVideoMatchProjectStats(workspaceProject);
        const currentUpdatedAt = Number(project?.updatedAt || 0);
        const backendUpdatedAt = Number(workspaceProject?.updatedAt || workspaceProject?.savedAt || 0);
        const shouldRestore = Number(backendStats.matchSegmentsCount || 0) > Number(currentStats.matchSegmentsCount || 0)
          || Number(backendStats.candidatesTotal || 0) > Number(currentStats.candidatesTotal || 0)
          || Number(backendStats.videoBlocksCount || 0) > Number(currentStats.videoBlocksCount || 0)
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
        setAssembleAudioPath(String(restoredProject?.audioPathForAssembly || restoredProject?.audioPreviewMeta?.backendPath || restoredProject?.timingContext?.sourceAudioPath || restoredProject?.assembleAudioPath || restoredProject?.audioPath || ""));
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
  }, [nodeId, projectId]);

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
      selectedSegmentId: String(payload?.project?.selectedSegmentId || ""),
      selectedCandidateId: String(payload?.project?.selectedCandidateId || ""),
      candidatesTotal: Number(payload?.stats?.candidatesTotal || 0),
      candidateIds: (Array.isArray(payload?.project?.matchSegments) ? payload.project.matchSegments : []).map((segment) => [
        String(segment?.id || segment?.audioSceneId || segment?.audio_scene_id || ""),
        String(segment?.selectedCandidateId || segment?.selected_candidate_id || ""),
        ...(Array.isArray(segment?.candidates) ? segment.candidates.map((candidate) => String(candidate?.id || candidate?.candidateId || candidate?.candidate_id || "")) : []),
      ].join(":")).join("|"),
      updatedAt: Number(payload?.project?.updatedAt || 0),
    });
    if (signature === backendSaveSignatureRef.current) return () => {};
    backendSaveSignatureRef.current = signature;

    if (backendSaveTimerRef.current) clearTimeout(backendSaveTimerRef.current);
    backendSaveTimerRef.current = setTimeout(() => {
      saveVideoNodeWorkspaceProject(project, nodeId, projectId)
        .then(() => console.info("[VIDEO MATCH BACKEND WORKSPACE SAVED]", { nodeId, projectId, stats }))
        .catch((error) => console.warn("[VIDEO MATCH BACKEND WORKSPACE SAVE_FAILED]", { nodeId, projectId, error: String(error?.message || error) }));
    }, 700);

    return () => {
      if (backendSaveTimerRef.current) clearTimeout(backendSaveTimerRef.current);
    };
  }, [nodeId, project, projectId]);

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

  const stopAssemblyAudioSyncTimer = () => {
    if (assemblyAudioSyncTimerRef.current) {
      clearInterval(assemblyAudioSyncTimerRef.current);
      assemblyAudioSyncTimerRef.current = null;
    }
    assemblyAudioSwitchingBlockRef.current = "";
  };

  const clearSceneAutoPreviewStopTimer = () => {
    if (sceneAutoPreviewStopTimerRef.current) {
      clearTimeout(sceneAutoPreviewStopTimerRef.current);
      sceneAutoPreviewStopTimerRef.current = null;
    }
  };

  const clearSceneExactPreviewStopTimer = () => {
    if (sceneExactPreviewStopTimerRef.current) {
      clearTimeout(sceneExactPreviewStopTimerRef.current);
      sceneExactPreviewStopTimerRef.current = null;
    }
  };

  const stopPlayback = () => {
    stopAssemblyAudioSyncTimer();
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


  const getSourceVideoEntryById = (sourceVideoId = "src_01") => {
    const safeId = String(sourceVideoId || "src_01").trim() || "src_01";
    return sourceVideos.find((item) => item.id === safeId || item.sourceVideoId === safeId || item.source_video_id === safeId)
      || sourceVideos[0]
      || null;
  };

  const getSourceVideoRuntimeUrl = (sourceVideoId = "src_01") => {
    const safeId = String(sourceVideoId || "src_01").trim() || "src_01";
    const fromRef = String(sourceVideoObjectUrlByIdRef.current?.[safeId] || "").trim();
    if (fromRef) return fromRef;
    const entry = getSourceVideoEntryById(safeId);
    const fromEntry = String(entry?.previewUrl || entry?.sourceVideoUrl || entry?.url || "").trim();
    if (fromEntry) return fromEntry;
    return safeId === "src_01" ? sourceVideoUrl : "";
  };

  const onRemoveSourceVideo = (sourceVideoId = "src_01") => {
    const safeId = String(sourceVideoId || "src_01").trim() || "src_01";
    if (sourceVideoObjectUrlByIdRef.current?.[safeId]) {
      try { URL.revokeObjectURL(sourceVideoObjectUrlByIdRef.current[safeId]); } catch {}
      sourceVideoObjectUrlByIdRef.current = { ...(sourceVideoObjectUrlByIdRef.current || {}), [safeId]: "" };
    }
    if (safeId === "src_01") {
      if (objectUrlRef.current) {
        try { URL.revokeObjectURL(objectUrlRef.current); } catch {}
        objectUrlRef.current = "";
      }
      runtimeSourceVideoUrlRef.current = "";
    }
    const clearedSources = (Array.isArray(sourceVideos) ? sourceVideos : [])
      .map((source, index) => {
        const normalized = normalizeVideoNodeSourceEntry(source, index);
        if (String(normalized.id || normalized.sourceVideoId || normalized.source_video_id || "") !== safeId) return normalized;
        return normalizeVideoNodeSourceEntry({
          id: safeId,
          sourceVideoId: safeId,
          source_video_id: safeId,
          label: normalized.label || getVideoNodeSourceShortLabel(safeId),
          color: normalized.color || getVideoNodeSourceColor(safeId),
          filename: normalized.filename || normalized.name || `${getVideoNodeSourceSlotIndex(normalized, index)}.mp4`,
          name: normalized.name || normalized.filename || `${getVideoNodeSourceSlotIndex(normalized, index)}.mp4`,
          needsRelink: true,
        }, index);
      });
    const patch = {
      sourceVideos: clearedSources,
      source_videos: clearedSources,
      jsonError: "",
    };
    if (safeId === "src_01") {
      Object.assign(patch, {
        sourceVideoUrl: "",
        sourceVideoPathForAssembly: "",
        uploadedSourceVideoPath: "",
        sourceVideo: {
          ...(project.sourceVideo || {}),
          path: "",
          backendPath: "",
          sourceVideoPathForAssembly: "",
        },
        source_video: {
          ...(project.source_video || {}),
          path: "",
        },
      });
    }
    patchProject(patch, { lastGood: false });
    setSourceVideoLoadMessage(`${getVideoNodeSourceShortLabel(safeId)} отвязан. Нажмите "Привязать файл", чтобы вернуть backend path для MP4.`);
    if (activeSourceVideoId === safeId) setActiveSourceVideoId("src_01");
  };

  const activeSourceVideoUrl = getSourceVideoRuntimeUrl(activeSourceVideoId) || sourceVideoUrl;

  const switchPreviewToSourceVideoId = (sourceVideoId = "src_01", startSec = 0) => {
    const safeSourceVideoId = String(sourceVideoId || "src_01").trim() || "src_01";
    if (!safeSourceVideoId.startsWith("src_")) return false;

    setActiveSourceVideoId(safeSourceVideoId);

    const expectedSrc = getSourceVideoRuntimeUrl(safeSourceVideoId);
    if (!expectedSrc || !videoRef.current) return Boolean(expectedSrc);

    const video = videoRef.current;
    const currentSrc = String(video.currentSrc || video.src || "");
    const shouldSwap = currentSrc !== expectedSrc;

    try {
      if (shouldSwap) {
        safePauseVideo(video, "switch_preview_source");
        video.src = expectedSrc;
        video.load();
        const jump = () => {
          try {
            video.currentTime = Math.max(0, Number(startSec || 0));
            setCurrentTimeSec(video.currentTime || Math.max(0, Number(startSec || 0)));
          } catch {}
          video.removeEventListener("loadedmetadata", jump);
          video.removeEventListener("canplay", jump);
        };
        video.addEventListener("loadedmetadata", jump, { once: true });
        video.addEventListener("canplay", jump, { once: true });
        window.setTimeout(jump, 80);
      } else {
        video.currentTime = Math.max(0, Number(startSec || 0));
        setCurrentTimeSec(video.currentTime || Math.max(0, Number(startSec || 0)));
      }
      updateVideoDiagnostics(`switch_preview_${safeSourceVideoId}`);
    } catch (error) {
      console.warn("[VIDEO MATCH SWITCH SOURCE FAILED]", { safeSourceVideoId, startSec, error });
    }
    return true;
  };

  const switchPreviewToBlockSource = (block = {}) => {
    const sourceVideoId = getVideoNodeSourceVideoId(block);
    if (!String(sourceVideoId || "").startsWith("src_")) return false;
    const range = getBlockClipRange(block);
    return switchPreviewToSourceVideoId(sourceVideoId, range.clipStart);
  };


  const restoreSourceVideoElement = (sourceVideoId = "src_01") => {
    const safeSourceVideoId = String(sourceVideoId || "src_01").trim() || "src_01";
    setActiveSourceVideoId(safeSourceVideoId);
    const expectedSrc = getSourceVideoRuntimeUrl(safeSourceVideoId);
    if (!videoRef.current || !expectedSrc) return false;
    activeVideoSourceKindRef.current = "source";

    const video = videoRef.current;
    const currentSrc = String(video.currentSrc || video.src || "");
    const resolvedExpectedSrc = (() => {
      try { return new URL(expectedSrc, window.location.href).href; } catch { return expectedSrc; }
    })();

    if (currentSrc !== expectedSrc && currentSrc !== resolvedExpectedSrc) {
      safePauseVideo(video, "restore_source_video_element");
      video.src = expectedSrc;
      try { video.load(); } catch {}
    }
    return true;
  };

  const getOverrideBlockEndSec = (block = {}) => {
    const overrideDuration = Number(block?.overrideDurationSec || 0);
    const sourceEnd = getBlockSourceEnd(block);
    const targetDuration = Math.max(0, getBlockTargetEnd(block) - getBlockTargetStart(block));
    const baseEnd = Math.max(0, overrideDuration || sourceEnd);
    return targetDuration > 0 ? Math.min(baseEnd, targetDuration) : baseEnd;
  };

  const isBenignVideoPlayInterruption = (error) => {
    const message = String(error?.message || error || "").toLowerCase();
    const name = String(error?.name || "").toLowerCase();
    return name === "aborterror"
      || message.includes("interrupted by a new load request")
      || message.includes("the play() request was interrupted")
      || message.includes("play() request was interrupted")
      || message.includes("new load request");
  };

  const getVideoNodePreviewSourceUrlById = (sourceVideoId = "") => {
    const requestedId = String(sourceVideoId || "").trim();
    const fallbackId = requestedId || "src_01";
    let entry = null;
    try {
      entry = typeof getSourceVideoEntryById === "function" ? getSourceVideoEntryById(fallbackId) : null;
    } catch {
      entry = null;
    }
    const fromEntry = String(
      entry?.previewUrl
      || entry?.preview_url
      || entry?.sourceVideoUrl
      || entry?.source_video_url
      || entry?.url
      || ""
    ).trim();
    if (fromEntry) return fromEntry;

    const listEntry = (Array.isArray(sourceVideos) ? sourceVideos : [])
      .find((source) => {
        const id = String(source?.id || source?.sourceVideoId || source?.source_video_id || "").trim();
        return id === fallbackId;
      });
    const fromList = String(
      listEntry?.previewUrl
      || listEntry?.preview_url
      || listEntry?.sourceVideoUrl
      || listEntry?.source_video_url
      || listEntry?.url
      || ""
    ).trim();
    if (fromList) return fromList;

    if (fallbackId === "src_01") {
      return String(sourceVideoUrl || runtimeSourceVideoUrlRef.current || project.sourceVideoUrl || "").trim();
    }
    return String(sourceVideoUrl || runtimeSourceVideoUrlRef.current || project.sourceVideoUrl || "").trim();
  };

  const fetchVideoNodeOverridePreviewUrl = async (url = "") => {
    const resolvedUrl = resolveOutputUrl(url);
    if (!resolvedUrl) return "";
    if (!isVideoNodeProtectedAssetUrl(resolvedUrl)) return resolvedUrl;
    const response = await fetch(resolvedUrl, {
      method: "GET",
      credentials: "include",
      headers: getVideoMatchAuthHeaders(),
    });
    if (!response.ok) throw new Error(`asset preview fetch failed ${response.status}`);
    const blob = await response.blob();
    if (overrideVideoObjectUrlRef.current) {
      try { URL.revokeObjectURL(overrideVideoObjectUrlRef.current); } catch {}
      overrideVideoObjectUrlRef.current = "";
    }
    const blobUrl = URL.createObjectURL(blob);
    overrideVideoObjectUrlRef.current = blobUrl;
    return blobUrl;
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
    try {
      const playableOverrideUrl = await fetchVideoNodeOverridePreviewUrl(overrideUrl);
      if (!playableOverrideUrl) return false;
      logVideoPlayerAction("src_change", "override_src_set", { src: overrideUrl, playable: playableOverrideUrl.startsWith("blob:") ? "blob" : "direct", sceneId: block?.id || "" });
      videoRef.current.src = playableOverrideUrl;
      videoRef.current.currentTime = 0;
      videoRef.current.load();
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
      if (isBenignVideoPlayInterruption(error)) {
        console.info("[VIDEO MATCH OVERRIDE PLAY INTERRUPTED QUIETLY]", { message: String(error?.message || error), sceneId: block?.id || "" });
        return false;
      }
      patchProject({ jsonError: `Не удалось запустить override video: ${String(error?.message || error)}` }, { lastGood: false });
      return false;
    }
  };

  const playSourceRange = async (start = 0, end = 0, { muted = false, sourceVideoId = "src_01" } = {}) => {
    const safeSourceVideoId = String(sourceVideoId || "src_01").trim() || "src_01";
    const expectedSrc = getSourceVideoRuntimeUrl(safeSourceVideoId);

    if (!expectedSrc || !videoRef.current) {
      console.warn("[VIDEO MATCH SOURCE PREVIEW MISSING]", { sourceVideoId: safeSourceVideoId });
      showMissingSourceVideoMessage();
      return false;
    }

    const video = videoRef.current;
    setActiveSourceVideoId(safeSourceVideoId);
    activeVideoSourceKindRef.current = "source";
    applyPreviewVideoAudioMix(Boolean(muted));

    const startSec = Math.max(0, Number(start || 0));
    const endSec = Math.max(startSec + 0.05, Number(end || startSec + 0.05));

    const currentSrc = String(video.currentSrc || video.src || "");
    const resolvedExpectedSrc = (() => {
      try { return new URL(expectedSrc, window.location.href).href; } catch { return expectedSrc; }
    })();

    try {
      safePauseVideo(video, "scene_exact_prepare_source");
      if (currentSrc !== expectedSrc && currentSrc !== resolvedExpectedSrc) {
        video.src = expectedSrc;
        video.load();
      }

      await new Promise((resolve) => {
        if (Number(video.readyState || 0) >= 1) return resolve();
        const done = () => {
          video.removeEventListener("loadedmetadata", done);
          video.removeEventListener("canplay", done);
          resolve();
        };
        video.addEventListener("loadedmetadata", done, { once: true });
        video.addEventListener("canplay", done, { once: true });
        window.setTimeout(done, 900);
      });

      try {
        const duration = Number(video.duration || 0);
        const safeStart = duration > 0 && startSec >= duration ? Math.max(0, duration - (endSec - startSec)) : startSec;
        video.currentTime = safeStart;
        setCurrentTimeSec(safeStart);
      } catch {}

      logVideoPlayerAction("seek", "scene_exact_source_seek", {
        currentTime: Number(video.currentTime || 0),
        sourceVideoId: safeSourceVideoId,
      });

      const playPromise = video.play();
      if (playPromise && typeof playPromise.then === "function") await playPromise;

      logVideoPlayerAction("play", "scene_exact_source_play", {
        sourceVideoId: safeSourceVideoId,
        endSec,
      });
      return true;
    } catch (error) {
      const message = String(error?.message || error);
      if (message.includes("interrupted by a call to pause") || message.includes("interrupted by a new load request")) {
        console.info("[VIDEO MATCH SOURCE PLAY INTERRUPTED QUIETLY]", { message, sourceVideoId: safeSourceVideoId });
        return false;
      }
      patchProject({ jsonError: `Не удалось запустить video player: ${message}` }, { lastGood: false });
      return false;
    }
  };

  const playAudioFrom = async (start = 0) => {
    const resolvedAudioUrl = String(
      project.audioPreviewUrl
      || runtimeAudioPreviewUrlRef.current
      || project.audioPreviewBackendUrl
      || project.audioPreviewMeta?.backendUrl
      || project.audioPreviewMeta?.url
      || effectiveAudioPreviewUrl
      || ""
    ).trim();

    if (!resolvedAudioUrl || !audioRef.current) {
      console.warn("[VIDEO MATCH AUDIO PLAY MISSING]", {
        hasProjectAudioPreviewUrl: Boolean(project.audioPreviewUrl),
        hasRuntimeAudioPreviewUrl: Boolean(runtimeAudioPreviewUrlRef.current),
        hasBackendAudioUrl: Boolean(project.audioPreviewBackendUrl || project.audioPreviewMeta?.backendUrl),
      });
      showMissingAudioMessage();
      return false;
    }

    const audio = audioRef.current;
    const currentSrc = String(audio.currentSrc || audio.src || "");
    const expectedSrc = (() => {
      try { return new URL(resolvedAudioUrl, window.location.href).href; } catch { return resolvedAudioUrl; }
    })();

    try {
      if (currentSrc !== resolvedAudioUrl && currentSrc !== expectedSrc) {
        audio.pause();
        audio.src = resolvedAudioUrl;
        audio.load();
      }

      await new Promise((resolve) => {
        if (Number(audio.readyState || 0) >= 1) return resolve();
        const done = () => {
          audio.removeEventListener("loadedmetadata", done);
          audio.removeEventListener("canplay", done);
          resolve();
        };
        audio.addEventListener("loadedmetadata", done, { once: true });
        audio.addEventListener("canplay", done, { once: true });
        window.setTimeout(done, 900);
      });

      const timelineSec = Math.max(0, Number(start || 0));
      // Video Match targetStartSec/targetEndSec are already in the loaded master audio timeline.
      // Do NOT subtract getAudioTimelineOffsetSec() here, otherwise every scene can seek back to 0.
      const sourceAudioSec = timelineSec;
      audio.currentTime = sourceAudioSec;
      setAudioCurrentTimeSec(timelineSec);
      audio.volume = Number(project.audioMix?.narrationVolume ?? 1.0);

      if (backgroundAudioRef.current && project.audioMix?.backgroundAudioUrl) {
        backgroundAudioRef.current.currentTime = sourceAudioSec;
        backgroundAudioRef.current.volume = Number(project.audioMix?.backgroundAudioVolume ?? 0.6);
        try { await backgroundAudioRef.current.play(); } catch {}
      }

      console.info("[VIDEO MATCH AUDIO DIRECT TIMELINE PATCH ACTIVE]", {
        timelineSec,
        sourceAudioSec,
      });
      console.info("[VIDEO MATCH AUDIO PLAY TRY]", {
        timelineSec,
        sourceAudioSec,
        src: String(audio.currentSrc || audio.src || ""),
        readyState: Number(audio.readyState || 0),
        duration: Number(audio.duration || 0),
      });

      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === "function") await playPromise;

      console.info("[VIDEO MATCH AUDIO PLAY OK]", {
        currentTime: Number(audio.currentTime || 0),
        duration: Number(audio.duration || 0),
      });
      return true;
    } catch (error) {
      console.warn("[VIDEO MATCH AUDIO PLAY FAILED]", {
        message: String(error?.message || error),
        name: String(error?.name || ""),
        src: String(audio.currentSrc || audio.src || ""),
        readyState: Number(audio.readyState || 0),
      });
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
      : await playSourceRange(start, end, { muted: shouldMute, sourceVideoId: getVideoNodeSourceVideoId(block) });
    if (!didPlay) setIsPlaybackActive(false);
    return didPlay;
  };

  const startAudioSyncedBlock = async (block = {}, reason = "scene_click") => {
    if (!block) return false;

    clearSceneExactPreviewStopTimer();

    const targetStart = Math.max(0, Number(getBlockTargetStart(block) || 0));
    const targetEnd = Math.max(targetStart + 0.05, Number(getBlockTargetEnd(block) || 0));
    const sceneDuration = Math.max(0.05, targetEnd - targetStart);

    const sourceVideoId = typeof getVideoNodeSourceVideoId === "function"
      ? getVideoNodeSourceVideoId(block)
      : String(block.sourceVideoId || block.source_video_id || "src_01");

    const range = getBlockClipRange(block);
    let clipStart = Math.max(0, Number(range.clipStart || 0));
    let clipEnd = Math.max(clipStart + 0.05, Math.min(Number(range.clipEnd || clipStart + sceneDuration), clipStart + sceneDuration));

    const sourceEntry = (typeof getSourceVideoEntryById === "function" ? getSourceVideoEntryById(sourceVideoId) : null) || {};
    const sourceDuration = Number(sourceEntry.duration_sec || sourceEntry.durationSec || 0);
    if (sourceDuration > 0) {
      if (clipStart >= sourceDuration) {
        const oldStart = clipStart;
        clipStart = Math.max(0, sourceDuration - sceneDuration);
        clipEnd = Math.min(sourceDuration, clipStart + sceneDuration);
        setSourceVideoLoadMessage(`Preview: таймкод сцены был за пределами ${getVideoNodeSourceShortLabel(sourceVideoId)} (${formatSec(oldStart)} > ${formatSec(sourceDuration)}), временно сдвинул к концу видео.`);
      } else if (clipEnd > sourceDuration) {
        clipEnd = sourceDuration;
        clipStart = Math.max(0, clipEnd - sceneDuration);
      } else {
        setSourceVideoLoadMessage("");
      }
    }

    const previewBlock = {
      ...block,
      sourceVideoId,
      source_video_id: sourceVideoId,
      sourceVideoStartSec: clipStart,
      source_video_start_sec: clipStart,
      clipSourceStartSec: clipStart,
      clip_source_start_sec: clipStart,
      sourceVideoEndSec: clipEnd,
      source_video_end_sec: clipEnd,
      clipSourceEndSec: clipEnd,
      clip_source_end_sec: clipEnd,
    };

    playbackRef.current = {
      mode: "audio_range",
      blocks: [previewBlock],
      index: 0,
      targetEnd,
      end: clipEnd,
      currentBlockId: String(previewBlock.id || previewBlock.audioSceneId || previewBlock.segmentId || ""),
      reason,
    };

    onSelectBlock(previewBlock);
    setIsAssemblyPlaying(false);
    setIsPlaybackActive(true);

    const shouldMute = isTruthyFlag(previewBlock?.forceMuteVideoAudio ?? previewBlock?.force_mute_video_audio);
    const hasAudioForPreview = Boolean(effectiveAudioPreviewUrl || audioPreviewUrl || project.audioPreviewBackendUrl || project.audioPreviewMeta?.backendUrl || runtimeAudioPreviewUrlRef.current);

    console.info("[VIDEO MATCH SCENE EXACT PREVIEW START]", {
      reason,
      blockId: previewBlock.id || "",
      sourceVideoId,
      targetStart,
      targetEnd,
      clipStart,
      clipEnd,
      sceneDuration,
      hasAudioForPreview,
    });

    const didStartVideo = (isOverrideBlock(previewBlock) && previewBlock.overrideVideoUrl)
      ? await playOverrideRange(previewBlock, { muted: shouldMute })
      : await playSourceRange(clipStart, clipEnd, { muted: shouldMute, sourceVideoId });

    let didStartAudio = false;
    if (hasAudioForPreview && audioRef.current) {
      didStartAudio = await playAudioFrom(targetStart);
    } else if (audioRef.current) {
      audioRef.current.pause();
    }

    if (!didStartVideo && !didStartAudio) {
      setIsPlaybackActive(false);
      return false;
    }

    sceneExactPreviewStopTimerRef.current = window.setTimeout(() => {
      const playback = playbackRef.current;
      if (!playback || playback.currentBlockId !== String(previewBlock.id || previewBlock.audioSceneId || previewBlock.segmentId || "")) return;
      if (videoRef.current) {
        safePauseVideo(videoRef.current, "scene_exact_preview_stop");
        try { videoRef.current.currentTime = clipEnd; } catch {}
        setCurrentTimeSec(clipEnd);
      }
      if (audioRef.current) audioRef.current.pause();
      if (backgroundAudioRef.current) backgroundAudioRef.current.pause();
      playbackRef.current = null;
      setIsPlaybackActive(false);
      setIsAssemblyPlaying(false);
    }, Math.max(100, Math.round(sceneDuration * 1000) + 160));

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

  const syncAssemblyAudioPlaybackNow = (reason = "tick") => {
    const playback = playbackRef.current;
    if (!playback || playback.mode !== "assembly_audio") return;
    if (!audioRef.current) return;

    const blocks = Array.isArray(playback.blocks) ? playback.blocks : [];
    if (!blocks.length) return;

    const offsetSec = getAudioTimelineOffsetSec(project);
    const timelineAudioTime = Number(audioRef.current.currentTime || 0) + offsetSec;
    const lastTargetEnd = Number(playback.targetEnd || getBlockTargetEnd(blocks[blocks.length - 1]) || 0);

    if (lastTargetEnd > 0 && timelineAudioTime >= lastTargetEnd) {
      console.info("[VIDEO MATCH ASSEMBLY AUDIO DONE]", { reason, timelineAudioTime, lastTargetEnd });
      stopPlayback();
      return;
    }

    const found = findAssemblyBlockByAudioTime(blocks, timelineAudioTime, playback.index);
    if (!found?.block) return;

    const nextBlock = found.block;
    const nextBlockId = String(nextBlock.id || "");
    if (found.index === playback.index && nextBlockId === playback.currentBlockId) return;
    if (assemblyAudioSwitchingBlockRef.current === nextBlockId) return;

    playbackRef.current = {
      ...playback,
      index: found.index,
      currentBlockId: nextBlockId,
    };

    onSelectBlock(nextBlock);

    const nextShouldMute = isTruthyFlag(nextBlock?.forceMuteVideoAudio ?? nextBlock?.force_mute_video_audio);
    assemblyAudioSwitchingBlockRef.current = nextBlockId;

    const clearSwitchGuard = () => {
      if (assemblyAudioSwitchingBlockRef.current === nextBlockId) {
        assemblyAudioSwitchingBlockRef.current = "";
      }
    };

    console.info("[VIDEO MATCH ASSEMBLY AUDIO SWITCH]", {
      reason,
      blockId: nextBlockId,
      index: found.index,
      timelineAudioTime,
      sourceVideoId: typeof getVideoNodeSourceVideoId === "function" ? getVideoNodeSourceVideoId(nextBlock) : "",
    });

    if (isOverrideBlock(nextBlock) && nextBlock.overrideVideoUrl) {
      Promise.resolve(playOverrideRange(nextBlock, { muted: nextShouldMute })).finally(clearSwitchGuard);
      return;
    }

    const range = getBlockClipRange(nextBlock);
    const sourceVideoId = typeof getVideoNodeSourceVideoId === "function"
      ? getVideoNodeSourceVideoId(nextBlock)
      : "src_01";
    Promise.resolve(playSourceRange(range.clipStart, range.clipEnd, {
      muted: nextShouldMute,
      sourceVideoId,
    })).finally(clearSwitchGuard);
  };

  const startAssemblyAudioSyncTimer = () => {
    stopAssemblyAudioSyncTimer();
    syncAssemblyAudioPlaybackNow("start_now");
    assemblyAudioSyncTimerRef.current = window.setInterval(() => {
      syncAssemblyAudioPlaybackNow("timer");
    }, 120);
    window.setTimeout(() => syncAssemblyAudioPlaybackNow("start_timeout"), 80);
  };


  const buildSelectedBlockForSegmentV25 = (segment = {}) => {
    const segmentKey = getSegmentKey(segment);
    const candidates = Array.isArray(segment.candidates) ? segment.candidates : [];
    const selectedCandidate = getVideoNodeSelectedCandidate(segment, candidates);
    const candidateKey = getCandidateKey(selectedCandidate || {});
    const existingExact = assemblyBlocks.find((block) => getSegmentKey(block) === segmentKey && getCandidateKey(block) === candidateKey);
    if (existingExact) return existingExact;
    const rebuilt = buildVideoBlocksFromMatchSegments([{
      ...segment,
      selectedCandidateId: candidateKey || segment.selectedCandidateId || segment.selected_candidate_id || "",
      selected_candidate_id: candidateKey || segment.selected_candidate_id || segment.selectedCandidateId || "",
      selectedCandidate: selectedCandidate || segment.selectedCandidate,
      selected_candidate: selectedCandidate || segment.selected_candidate,
    }], sourceVideoUrl);
    return rebuilt[0] || assemblyBlocks.find((block) => getSegmentKey(block) === segmentKey) || segment;
  };

  const onSelectSegmentAndPreviewV25 = (segment = {}, reason = "scene_click") => {
    const segmentKey = getSegmentKey(segment);
    const block = buildSelectedBlockForSegmentV25(segment);
    const candidateKey = getCandidateKey(block) || String(segment.selectedCandidateId || segment.selected_candidate_id || "").trim();
    patchProject({
      selectedSegmentId: segmentKey,
      selectedCandidateId: candidateKey,
      selectedBlockId: block?.id || "",
    }, { lastGood: false });
    void startAudioSyncedBlock(block, reason);
  };

  const onSelectBlockAndPreview = (block = {}, reason = "scene_click") => {
    if (!block) return;
    void startAudioSyncedBlock(block, reason);
  };

  const playAssemblyFromBlock = async (startBlock = null) => {
    if (!assemblyBlocks.length) return;
    const hasAnySourceForAssemblyPreview = Boolean(
      ((typeof activeSourceVideoUrl !== "undefined") && activeSourceVideoUrl)
      || sourceVideoUrl
      || (Array.isArray(sourceVideos) && sourceVideos.some((source) => {
        try {
          return typeof isVideoNodeSourceLoaded === "function"
            ? isVideoNodeSourceLoaded(source)
            : Boolean(source?.previewUrl || source?.sourceVideoUrl || source?.url);
        } catch {
          return Boolean(source?.previewUrl || source?.sourceVideoUrl || source?.url);
        }
      }))
    );
    if (typeof restoreSourceVideoElement === "function") {
      try { restoreSourceVideoElement(getVideoNodeSourceVideoId(startBlock || assemblyBlocks[0] || {})); } catch { restoreSourceVideoElement(); }
    }
    if (!hasAnySourceForAssemblyPreview || !videoRef.current) {
      showMissingSourceVideoMessage();
      return;
    }
    const rawIndex = assemblyBlocks.findIndex((block) => block.id === startBlock?.id);
    const startIndex = rawIndex >= 0 ? rawIndex : 0;
    const firstBlock = assemblyBlocks[startIndex] || assemblyBlocks[0];
    onSelectBlock(firstBlock);

    if (useAudioPreview) {
      if (!effectiveAudioPreviewUrl || !audioRef.current) {
        showMissingAudioMessage();
        return;
      }

      playbackRef.current = {
        mode: "assembly_audio",
        blocks: assemblyBlocks,
        index: startIndex,
        targetEnd: getBlockTargetEnd(assemblyBlocks[assemblyBlocks.length - 1]),
        currentBlockId: "",
      };
      setIsAssemblyPlaying(true);
      setIsPlaybackActive(true);

      const targetStart = getBlockTargetStart(firstBlock);
      const didStartAudio = await playAudioFrom(targetStart);

      if (!didStartAudio) {
        setIsAssemblyPlaying(false);
        setIsPlaybackActive(false);
        if (videoRef.current) safePauseVideo(videoRef.current, "assembly_audio_start_failed_pause_video");
        return;
      }

      startAssemblyAudioSyncTimer();

      const firstShouldMute = isTruthyFlag(firstBlock?.forceMuteVideoAudio ?? firstBlock?.force_mute_video_audio);
      const firstSourceVideoId = typeof getVideoNodeSourceVideoId === "function"
        ? getVideoNodeSourceVideoId(firstBlock)
        : "src_01";

      window.setTimeout(() => {
        const latestPlayback = playbackRef.current;
        if (!latestPlayback || latestPlayback.mode !== "assembly_audio") return;

        if (isOverrideBlock(firstBlock) && firstBlock.overrideVideoUrl) {
          void playOverrideRange(firstBlock, { muted: firstShouldMute });
          return;
        }

        const firstRange = getBlockClipRange(firstBlock);
        void playSourceRange(firstRange.clipStart, firstRange.clipEnd, {
          muted: firstShouldMute,
          sourceVideoId: firstSourceVideoId,
        });
      }, 0);

      console.info("[VIDEO MATCH ASSEMBLY AUDIO-FIRST STARTED]", {
        firstBlockId: firstBlock?.id || "",
        targetStart,
        firstSourceVideoId,
      });

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
      : await playSourceRange(getBlockClipRange(firstBlock).clipStart, getBlockClipRange(firstBlock).clipEnd, { muted: firstShouldMute, sourceVideoId: getVideoNodeSourceVideoId(firstBlock) });
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
          void playSourceRange(getBlockClipRange(nextBlock).clipStart, getBlockClipRange(nextBlock).clipEnd, { muted: nextShouldMute, sourceVideoId: getVideoNodeSourceVideoId(nextBlock) });
        }
        return;
      }
      stopAssemblyAudioSyncTimer();
      playbackRef.current = null;
      setIsAssemblyPlaying(false);
      setIsPlaybackActive(false);
    }
  };

  const onAudioTimeUpdate = () => {
    const current = Number(audioRef.current?.currentTime || 0);
    // Video Match preview uses direct master-audio time.
    // targetStartSec/targetEndSec from JSON are already in the same audio file.
    const timelineAudioTime = current;
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

    if (playback.mode === "assembly_audio") {
      syncAssemblyAudioPlaybackNow("audio_timeupdate");
      return;
    }

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
        void playSourceRange(getBlockClipRange(found.block).clipStart, getBlockClipRange(found.block).clipEnd, { muted: foundShouldMute, sourceVideoId: getVideoNodeSourceVideoId(found.block) });
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

  // AVA_VIDEO_NODE_SLOT_CANDIDATE_FLOW_V24: only ✓ applies a candidate to the fixed scene slot.
  const onSelectCandidate = (segmentId = "", candidateId = "") => {
    const targetSegmentKey = String(segmentId || "").trim();
    const targetCandidateKey = String(candidateId || "").trim();
    const nextSegments = matchSegments.map((segment) => {
      if (getSegmentKey(segment) !== targetSegmentKey) return segment;
      const candidates = Array.isArray(segment.candidates) ? segment.candidates : [];
      const selectedCandidate = candidates.find((candidate) => getCandidateKey(candidate) === targetCandidateKey) || null;
      return {
        ...segment,
        selectedCandidateId: targetCandidateKey,
        selected_candidate_id: targetCandidateKey,
        selectedCandidate: selectedCandidate || undefined,
        selected_candidate: selectedCandidate || undefined,
      };
    });
    const nextBlocks = buildVideoBlocksFromMatchSegments(nextSegments, sourceVideoUrl);
    const targetSegmentAfterSelect = nextSegments.find((segment) => getSegmentKey(segment) === targetSegmentKey) || null;
    const selectedCandidateAfterSelect = targetSegmentAfterSelect
      ? (Array.isArray(targetSegmentAfterSelect.candidates) ? targetSegmentAfterSelect.candidates : []).find((candidate) => getCandidateKey(candidate) === targetCandidateKey)
      : null;
    const rebuiltSelectedBlock = targetSegmentAfterSelect
      ? (buildVideoBlocksFromMatchSegments([{
          ...targetSegmentAfterSelect,
          selectedCandidateId: targetCandidateKey,
          selected_candidate_id: targetCandidateKey,
          selectedCandidate: selectedCandidateAfterSelect || targetSegmentAfterSelect.selectedCandidate,
          selected_candidate: selectedCandidateAfterSelect || targetSegmentAfterSelect.selected_candidate,
        }], sourceVideoUrl)[0] || null)
      : null;
    const nextBlock = nextBlocks.find((block) => getSegmentKey(block) === targetSegmentKey && getCandidateKey(block) === targetCandidateKey)
      || rebuiltSelectedBlock
      || nextBlocks.find((block) => getSegmentKey(block) === targetSegmentKey)
      || nextBlocks[0]
      || null;
    patchProject({
      matchSegments: nextSegments,
      videoBlocks: nextBlocks,
      selectedSegmentId: targetSegmentKey,
      selectedCandidateId: targetCandidateKey,
      selectedBlockId: nextBlock?.id || "",
      jsonError: "",
    });
    if (nextBlock) {
      window.setTimeout(() => {
        console.info("[VIDEO MATCH CANDIDATE AUTO PREVIEW]", { segmentId: targetSegmentKey, candidateId: targetCandidateKey, blockId: nextBlock?.id || "" });
        void startAudioSyncedBlock(nextBlock, "candidate_select");
      }, 45);
    }
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
    const previewSourceVideoId = getVideoNodeSourceVideoId(candidateBlock || candidate || segment);
    restoreSourceVideoElement(previewSourceVideoId);
    const segmentDuration = Math.max(0, Number(segment?.targetEndSec || 0) - Number(segment?.targetStartSec || 0));
    const start = Math.max(0, getBlockSourceStart(candidate));
    const end = Math.max(start, Math.min(getBlockSourceEnd(candidate), start + segmentDuration));
    playbackRef.current = { mode: "video_range", end, blocks: [], index: 0, currentBlockId: candidateKey };
    setIsAssemblyPlaying(false);
    setIsPlaybackActive(true);
    if (audioRef.current) audioRef.current.pause();
    patchProject({ selectedSegmentId: segmentKey, selectedCandidateId: candidateKey }, { lastGood: false });
    const didPlay = await playSourceRange(start, end, { muted: shouldMutePreview, sourceVideoId: previewSourceVideoId });
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
        const oldCandidates = Array.isArray(segment.candidates) ? segment.candidates : [];
        const currentCandidateId = String(segment.selectedCandidateId || segment.selected_candidate_id || getCandidateKey(oldCandidates[0]) || "").trim();
        const currentSelectedCandidate = oldCandidates.find((candidate) => getCandidateKey(candidate) === currentCandidateId) || segment.selectedCandidate || segment.selected_candidate || null;
        return {
          ...segment,
          candidates: [...oldCandidates, overrideCandidate],
          selectedCandidateId: currentCandidateId,
          selected_candidate_id: currentCandidateId,
          selectedCandidate: currentSelectedCandidate || undefined,
          selected_candidate: currentSelectedCandidate || undefined,
        };
      });
      const nextBlocks = buildVideoBlocksFromMatchSegments(nextSegments, sourceVideoUrl);
      const selectedStill = nextBlocks.find((block) => getSegmentKey(block) === segmentId && getCandidateKey(block) === (selectedSegment?.selectedCandidateId || selectedSegment?.selected_candidate_id))
        || nextBlocks.find((block) => getSegmentKey(block) === segmentId)
        || null;
      patchProject({
        matchSegments: nextSegments,
        videoBlocks: nextBlocks,
        selectedSegmentId: segmentId,
        selectedCandidateId: project.selectedCandidateId || selectedSegment?.selectedCandidateId || selectedSegment?.selected_candidate_id || "",
        selectedBlockId: selectedStill?.id || project.selectedBlockId || "",
        jsonError: "Загружен новый вариант. Нажмите ✓ на кандидате, чтобы применить его к сцене.",
      }, { lastGood: false });
      setPreviewCandidateId(candidateId);
    } catch (error) {
      patchProject({ jsonError: `Не удалось загрузить override: ${String(error?.message || error)}` }, { lastGood: false });
    }
  };

  // AVA_VIDEO_NODE_BOARD_BUTTON_AND_CANDIDATES_V31: +Взять с доски stays enabled and refreshes Board before adding a candidate.
  const onUseBoardClipForSelectedSegment = async () => {
    if (!selectedSegment) return;
    const segmentId = getSegmentKey(selectedSegment);
    if (!segmentId) return;

    let boardClip = selectedBoardClip;
    if (!boardClip) {
      setBoardGeneratedClipsStatus("Проверяю Доску для этой сцены...");
      const freshClips = await refreshBoardGeneratedClips("manual_take_from_board");
      boardClip = findBoardClipForSegment(selectedSegment, freshClips);
    }

    if (!boardClip) {
      patchProject({
        jsonError: "Для этой сцены нет готового видео на Доске. Проверь, что в Доске у этой же scene_id есть готовое видео.",
      }, { lastGood: false });
      setBoardGeneratedClipsStatus("В Доске не найдено видео для выбранной сцены.");
      return;
    }

    const boardCandidate = buildBoardClipCandidate(selectedSegment, boardClip);
    const nextSegments = matchSegments.map((segment) => {
      if (getSegmentKey(segment) !== segmentId) return segment;
      const oldCandidates = Array.isArray(segment.candidates) ? segment.candidates : [];
      const baseCandidates = oldCandidates.filter((candidate) => !isBoardClipCandidate(candidate));
      const currentCandidateId = String(segment.selectedCandidateId || segment.selected_candidate_id || getCandidateKey(baseCandidates[0] || oldCandidates[0]) || "").trim();
      const currentSelectedCandidate = baseCandidates.find((candidate) => getCandidateKey(candidate) === currentCandidateId)
        || oldCandidates.find((candidate) => getCandidateKey(candidate) === currentCandidateId)
        || segment.selectedCandidate
        || segment.selected_candidate
        || null;
      return {
        ...segment,
        candidates: [...baseCandidates, boardCandidate],
        selectedCandidateId: currentCandidateId,
        selected_candidate_id: currentCandidateId,
        selectedCandidate: currentSelectedCandidate || undefined,
        selected_candidate: currentSelectedCandidate || undefined,
      };
    });

    const nextBlocks = buildVideoBlocksFromMatchSegments(nextSegments, sourceVideoUrl);
    const selectedStill = nextBlocks.find((block) => getSegmentKey(block) === segmentId && getCandidateKey(block) === (selectedSegment?.selectedCandidateId || selectedSegment?.selected_candidate_id))
      || nextBlocks.find((block) => getSegmentKey(block) === segmentId)
      || null;

    patchProject({
      matchSegments: nextSegments,
      videoBlocks: nextBlocks,
      selectedSegmentId: segmentId,
      selectedCandidateId: project.selectedCandidateId || selectedSegment?.selectedCandidateId || selectedSegment?.selected_candidate_id || "",
      selectedBlockId: selectedStill?.id || project.selectedBlockId || "",
      jsonError: "",
    }, { lastGood: false });

    setPreviewCandidateId(boardCandidate.id);
    setBoardGeneratedClipsStatus(`Добавлен вариант с Доски: ${boardClip.sceneId || segmentId}. Нажмите ✓ на кандидате, чтобы применить.`);
    console.info("[VIDEO MATCH TAKE_FROM_BOARD_ADDED_CANDIDATE_V31]", { segmentId, boardClip, candidateId: boardCandidate.id, hasLocalPath: Boolean(boardCandidate.overrideVideoPath) });
  };

  const onVideoFileChange = async (file, sourceVideoId = "src_01") => {
    if (!file) return;
    const normalizedSourceId = String(sourceVideoId || "src_01").trim() || "src_01";

    // VIDEO MATCH SOURCE 2 UPLOAD: keep the old single-source path untouched for src_01.
    if (normalizedSourceId !== "src_01") {
      if (sourceVideoObjectUrlByIdRef.current?.[normalizedSourceId]) {
        try { URL.revokeObjectURL(sourceVideoObjectUrlByIdRef.current[normalizedSourceId]); } catch {}
      }
      const url = URL.createObjectURL(file);
      sourceVideoObjectUrlByIdRef.current = {
        ...(sourceVideoObjectUrlByIdRef.current || {}),
        [normalizedSourceId]: url,
      };
      setSourceVideoLoadMessage("");
      stopPlayback();

      const localEntry = normalizeVideoNodeSourceEntry({
        id: normalizedSourceId,
        label: normalizedSourceId === "src_02" ? "Видео 2" : getVideoNodeSourceShortLabel(normalizedSourceId),
        filename: file.name || `${normalizedSourceId}.mp4`,
        name: file.name || `${normalizedSourceId}.mp4`,
        previewUrl: url,
        sourceVideoUrl: url,
        duration_sec: 0,
        type: file.type || "video/mp4",
        size: file.size || 0,
      });

      patchProject({
        sourceVideos: mergeVideoNodeSourceEntry(sourceVideos, localEntry),
        jsonError: "",
      }, { lastGood: false });

      if (videoRef.current) {
        safePauseVideo(videoRef.current, "video_file_change_secondary");
        videoRef.current.src = url;
        videoRef.current.currentTime = 0;
        videoRef.current.load();
        updateVideoDiagnostics(`file_selected_${normalizedSourceId}`);
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("nodeId", nodeId);
      formData.append("sourceVideoId", normalizedSourceId);

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
        const backendEntry = normalizeVideoNodeSourceEntry({
          ...localEntry,
          previewUrl: backendSourceVideoUrl || url,
          sourceVideoUrl: backendSourceVideoUrl || url,
          path: String(data.sourceVideoPathForAssembly || ""),
          backendPath: String(data.sourceVideoPathForAssembly || ""),
          sourceVideoPathForAssembly: String(data.sourceVideoPathForAssembly || ""),
          filename: data.filename || file.name || `${normalizedSourceId}.mp4`,
          name: data.filename || file.name || `${normalizedSourceId}.mp4`,
          duration_sec: Number(data.duration_sec || 0),
          durationSec: Number(data.duration_sec || 0),
          width: Number(data.width || 0),
          height: Number(data.height || 0),
          fps: Number(data.fps || 0),
          has_audio_stream: Boolean(data.has_audio_stream),
        });
        patchProject({
          sourceVideos: mergeVideoNodeSourceEntry(sourceVideos, backendEntry),
          source_videos: mergeVideoNodeSourceEntry(sourceVideos, backendEntry),
          jsonError: "",
        }, { lastGood: true });
        setSourceVideoLoadMessage(`${getVideoNodeSourceShortLabel(normalizedSourceId)} загружено: ${backendEntry.filename}`);
      } catch (error) {
        setSourceVideoLoadMessage(`${getVideoNodeSourceShortLabel(normalizedSourceId)} играет в preview, но НЕ загрузилось на backend: ${String(error?.message || error)}`);
      }
      return;
    }

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
      const backendEntry = normalizeVideoNodeSourceEntry({
        id: "src_01",
        sourceVideoId: "src_01",
        source_video_id: "src_01",
        label: "Видео 1",
        filename: data.filename || file.name || "source.mp4",
        name: data.filename || file.name || "source.mp4",
        previewUrl: backendSourceVideoUrl || url,
        sourceVideoUrl: backendSourceVideoUrl || url,
        source_video_url: backendSourceVideoUrl || url,
        path: String(data.sourceVideoPathForAssembly || ""),
        backendPath: String(data.sourceVideoPathForAssembly || ""),
        backend_path: String(data.sourceVideoPathForAssembly || ""),
        sourceVideoPathForAssembly: String(data.sourceVideoPathForAssembly || ""),
        source_video_path_for_assembly: String(data.sourceVideoPathForAssembly || ""),
        durationSec: Number(data.duration_sec || 0),
        duration_sec: Number(data.duration_sec || 0),
        width: Number(data.width || 0),
        height: Number(data.height || 0),
        fps: Number(data.fps || 0),
        has_audio_stream: Boolean(data.has_audio_stream),
        type: file.type || "video/mp4",
        size: file.size || 0,
      });
      const mergedSources = mergeVideoNodeSourceEntry(sourceVideos, backendEntry);
      patchProject({
        sourceVideoUrl: String(backendSourceVideoUrl || ""),
        sourceVideoPathForAssembly: String(data.sourceVideoPathForAssembly || ""),
        uploadedSourceVideoPath: String(data.sourceVideoPathForAssembly || ""),
        sourceVideos: mergedSources,
        source_videos: mergedSources,
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

  const onAudioFileChange = async (file) => {
    if (!file) return;
    if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current);
    const url = URL.createObjectURL(file);
    audioObjectUrlRef.current = url;
    runtimeAudioPreviewUrlRef.current = url;
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = url;
        audioRef.current.load();
      } catch (error) {
        console.warn("[VIDEO MATCH AUDIO LOCAL_BIND_FAILED]", { error });
      }
    }
    setAudioDurationSec(0);
    setAudioCurrentTimeSec(0);
    setAudioLoadMessage("Загружаю аудио на backend для MP4-сборки...");
    setAssembleAudioPath("");
    const baseAudioMeta = {
      filename: file.name || "audio.mp3",
      duration_sec: 0,
      type: file.type || "audio/mpeg",
      size: file.size || 0,
    };
    patchProject({
      audioPreviewUrl: url,
      audioPreviewMeta: baseAudioMeta,
      assembleAudioPath: "",
      audioPathForAssembly: "",
      useAudioPreview: true,
    });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("nodeId", nodeId);
    try {
      const response = await fetch(`${API_BASE}/api/video-match/audio-upload`, {
        method: "POST",
        credentials: "include",
        headers: getVideoMatchAuthHeaders(),
        body: formData,
      });
      const data = await readVideoMatchJsonResponse(response);
      if (!response.ok || !data?.ok) throw new Error(getVideoMatchApiErrorMessage(data, response, "audio upload failed"));
      const backendAudioPath = String(data.audioPathForAssembly || data.audioPath || "").trim();
      const rawAudioUrl = String(data.audioUrl || "").trim();
      const backendAudioUrl = rawAudioUrl
        ? (rawAudioUrl.startsWith("http") ? rawAudioUrl : `${API_BASE}${rawAudioUrl}`)
        : "";
      const backendDuration = Number(data.durationSec || data.duration_sec || 0) || 0;
      if (!backendAudioPath) throw new Error("audio upload response missing audioPathForAssembly");
      setAssembleAudioPath(backendAudioPath);
      patchProject({
        assembleAudioPath: backendAudioPath,
        audioPathForAssembly: backendAudioPath,
        audioPreviewUrl: String(runtimeAudioPreviewUrlRef.current || project.audioPreviewUrl || backendAudioUrl || ""),
        audioPreviewBackendUrl: backendAudioUrl,
        audioPreviewMeta: {
          ...baseAudioMeta,
          backendPath: backendAudioPath,
          backendUrl: backendAudioUrl,
          duration_sec: backendDuration || 0,
        },
        timingContext: {
          ...(project.timingContext || {}),
          sourceAudioPath: backendAudioPath,
          sourceAudioFilename: data.filename || file.name || "audio.mp3",
          sourceAudioDurationSec: backendDuration || Number(project.timingContext?.audioDurationSec || 0) || 0,
        },
        useAudioPreview: true,
      });
      setAudioLoadMessage("Аудио загружено на backend и готово для MP4-сборки.");
    } catch (error) {
      setAssembleAudioPath("");
      patchProject({ assembleAudioPath: "", audioPathForAssembly: "" }, { lastGood: false });
      setAudioLoadMessage(`Аудио играет в preview, но НЕ загрузилось на backend для MP4: ${String(error?.message || error)}`);
    }
  };

  const onBackgroundAudioFileChange = async (file) => {
    if (!file) return;

    const localUrl = URL.createObjectURL(file);
    console.info("[VIDEO MATCH BACKGROUND AUDIO UPLOAD START]", { filename: file?.name || "" });
    patchProject({
      audioMix: getDefaultVideoMatchAudioMix({
        ...(project.audioMix || {}),
        backgroundAudioFilename: String(file.name || "background.mp3"),
        backgroundAudioUrl: localUrl,
        backgroundAudioPath: backgroundAudioPathForAssembly,
        backgroundAudioBackendUrl: "",
        backgroundAudioNeedsReload: false,
        backgroundAudioStatus: "uploading",
      }),
    }, { lastGood: false });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("nodeId", nodeId);

    try {
      const response = await fetch(`${API_BASE}/api/video-match/audio-upload`, {
        method: "POST",
        credentials: "include",
        headers: getVideoMatchAuthHeaders(),
        body: formData,
      });
      const data = await readVideoMatchJsonResponse(response);
      if (!response.ok || !data?.ok) throw new Error(getVideoMatchApiErrorMessage(data, response, "background audio upload failed"));

      const backendPath = String(data.audioPathForAssembly || data.audioPath || "").trim();
      const rawUrl = String(data.audioUrl || "").trim();
      const backendUrl = rawUrl ? (rawUrl.startsWith("http") ? rawUrl : `${API_BASE}${rawUrl}`) : "";
      if (!backendPath) throw new Error("background audio upload response missing audioPathForAssembly");

      patchProject({
        audioMix: getDefaultVideoMatchAudioMix({
          ...(project.audioMix || {}),
          backgroundAudioFilename: String(data.filename || file.name || "background.mp3"),
          backgroundAudioUrl: localUrl,
          backgroundAudioPath: backendPath,
          backgroundAudioBackendUrl: backendUrl,
          backgroundAudioNeedsReload: false,
          backgroundAudioStatus: "ready",
        }),
      }, { lastGood: false });
      console.info("[VIDEO MATCH BACKGROUND AUDIO READY]", { filename: data.filename || file.name, backendPath, backendUrl });
    } catch (error) {
      patchProject({
        audioMix: getDefaultVideoMatchAudioMix({
          ...(project.audioMix || {}),
          backgroundAudioFilename: String(file.name || "background.mp3"),
          backgroundAudioUrl: localUrl,
          backgroundAudioPath: "",
          backgroundAudioBackendUrl: "",
          backgroundAudioNeedsReload: true,
          backgroundAudioStatus: "upload_failed",
        }),
      }, { lastGood: false });
      console.warn("[VIDEO MATCH BACKGROUND AUDIO UPLOAD FAILED]", { message: String(error?.message || error) });
    }
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
    const importedSourceList = Array.isArray(result.sourceVideos)
      ? result.sourceVideos
      : (Array.isArray(result.source_videos) ? result.source_videos : []);
    const mergedSourceVideos = mergeImportedVideoNodeSourcesWithUploaded(importedSourceList, project, sourceVideos);
    const primaryMergedSource = mergedSourceVideos.find((source) => String(source.id || source.sourceVideoId || source.source_video_id || "") === "src_01")
      || mergedSourceVideos[0]
      || {};
    const primaryMergedPath = getVideoNodeSourceAssemblyPathValue(primaryMergedSource);
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
      sourceVideoUrl: String(primaryMergedSource.sourceVideoUrl || primaryMergedSource.previewUrl || runtimeSourceVideoUrlRef.current || project.sourceVideoUrl || ""),
      audioPreviewUrl: String(runtimeAudioPreviewUrlRef.current || project.audioPreviewUrl || ""),
      audioPreviewMeta: project.audioPreviewMeta || {},
      useAudioPreview: project.useAudioPreview,
      sourceVideo: {
        ...normalizedSourceVideo,
        ...(primaryMergedPath ? {
          path: primaryMergedPath,
          backendPath: primaryMergedPath,
          sourceVideoPathForAssembly: primaryMergedPath,
        } : {}),
        filename: primaryMergedSource.filename || normalizedSourceVideo.filename || "source.mp4",
        name: primaryMergedSource.name || primaryMergedSource.filename || normalizedSourceVideo.name || normalizedSourceVideo.filename || "source.mp4",
        duration_sec: Number(normalizedSourceVideo.duration_sec || primaryMergedSource.duration_sec || 0),
        durationSec: Number(normalizedSourceVideo.durationSec || normalizedSourceVideo.duration_sec || primaryMergedSource.durationSec || primaryMergedSource.duration_sec || 0),
        width: Number(primaryMergedSource.width || normalizedSourceVideo.width || 0),
        height: Number(primaryMergedSource.height || normalizedSourceVideo.height || 0),
        fps: Number(primaryMergedSource.fps || normalizedSourceVideo.fps || 0),
      },
      sourceVideos: mergedSourceVideos,
      source_videos: mergedSourceVideos,
      source_video: {
        ...(project.source_video || {}),
        path: primaryMergedPath || normalizedPath,
        filename: primaryMergedSource.filename || normalizedSourceVideo.filename || "source.mp4",
        duration_sec: Number(jsonDurationSec.toFixed(3)),
      },
      sourceVideoPath: primaryMergedPath || normalizedPath,
      sourceVideoPathForAssembly: primaryMergedPath || "",
      uploadedSourceVideoPath: primaryMergedPath || "",
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
      assemblyDirty: hasReadyMp4Preview ? true : Boolean(project.assemblyDirty),
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

  const getVideoNodeSourcePathForAssembly = (source = {}) => {
    const item = source && typeof source === "object" ? source : {};
    return String(
      item.sourceVideoPathForAssembly
      || item.source_video_path_for_assembly
      || item.backendPath
      || item.backend_path
      || item.path
      || item.sourceVideoPath
      || item.source_video_path
      || ""
    ).trim();
  };

  const getVideoNodeSourceUrlForAssembly = (source = {}) => {
    const item = source && typeof source === "object" ? source : {};
    return String(
      item.sourceVideoUrl
      || item.source_video_url
      || item.previewUrl
      || item.preview_url
      || item.url
      || ""
    ).trim();
  };

  const getVideoNodeSourcePathOrUrlForAssembly = (source = {}) => {
    const item = source && typeof source === "object" ? source : {};
    return String(
      item.sourceVideoPathForAssembly
      || item.source_video_path_for_assembly
      || item.backendPath
      || item.backend_path
      || item.path
      || item.sourceVideoPath
      || item.source_video_path
      || item.sourceVideoUrl
      || item.source_video_url
      || item.previewUrl
      || item.preview_url
      || item.url
      || ""
    ).trim();
  };

  const getVideoMatchDownloadUrl = (url = "") => {
    const raw = String(url || "").trim();
    if (!raw) return "";
    const glue = raw.includes("?") ? "&" : "?";
    return `${raw}${glue}download=1`;
  };

  const getVideoMatchMainAudioPathForAssembly = () => String(
    project.audioPathForAssembly
    || project.audio_path_for_assembly
    || project.assembleAudioPath
    || project.assemble_audio_path
    || project.audioPreviewMeta?.audioPathForAssembly
    || project.audioPreviewMeta?.audio_path_for_assembly
    || project.audioPreviewMeta?.backendPath
    || project.audioPreviewMeta?.backend_path
    || project.audioPreviewMeta?.path
    || ""
  ).trim();

  const hasVideoMatchMainAudioForAssembly = () => Boolean(getVideoMatchMainAudioPathForAssembly());

  const getVideoMatchBackgroundAudioPathForAssembly = () => String(
    project.audioMix?.backgroundAudioPath
    || project.audioMix?.background_audio_path
    || project.audioMix?.backgroundAudioPathForAssembly
    || project.audioMix?.background_audio_path_for_assembly
    || project.audioMix?.backgroundBackendPath
    || project.audioMix?.background_backend_path
    || ""
  ).trim();

  const hasVideoMatchBackgroundAudioForAssembly = () => Boolean(getVideoMatchBackgroundAudioPathForAssembly());

  const onAssembleMp4 = async () => {
    if (!assemblyBlocks.length) return;
    const backgroundAudioPathForAssembly = getVideoMatchBackgroundAudioPathForAssembly();
    const includeBackgroundAudioForAssembly = Boolean(backgroundAudioPathForAssembly);
    const mainAudioRequestedForAssembly = Boolean(
      (typeof includeAudio !== "undefined" ? includeAudio : false)
      || project.includeAudio
      || project.include_audio
    );
    const sourceVideosForAssembly = (Array.isArray(sourceVideos) ? sourceVideos : [])
      .map(normalizeVideoNodeSourceEntry)
      .map((source) => ({
        ...source,
        id: String(source.id || source.sourceVideoId || source.source_video_id || "").trim(),
        sourceVideoId: String(source.sourceVideoId || source.id || source.source_video_id || "").trim(),
        source_video_id: String(source.source_video_id || source.id || source.sourceVideoId || "").trim(),
        path: getVideoNodeSourcePathForAssembly(source),
        backendPath: getVideoNodeSourcePathForAssembly(source),
        backend_path: getVideoNodeSourcePathForAssembly(source),
        sourceVideoPathForAssembly: getVideoNodeSourcePathForAssembly(source),
        source_video_path_for_assembly: getVideoNodeSourcePathForAssembly(source),
        sourceVideoUrl: getVideoNodeSourceUrlForAssembly(source),
        source_video_url: getVideoNodeSourceUrlForAssembly(source),
      }));
    const sourcePathById = Object.fromEntries(sourceVideosForAssembly.map((source) => [String(source.id || source.sourceVideoId || source.source_video_id || ""), getVideoNodeSourcePathForAssembly(source)]));
    const anySourceVideoPath = sourceVideosForAssembly.map(getVideoNodeSourcePathForAssembly).find(Boolean) || "";
    const sourceVideoPath = String(
      project?.sourceVideoPathForAssembly
      || project?.uploadedSourceVideoPath
      || project?.sourceVideo?.backendPath
      || project?.sourceVideo?.path
      || project?.source_video?.path
      || project?.sourceVideoPath
      || project?.source_video_path
      || anySourceVideoPath
      || "",
    ).trim();
    const isProxySource = isProxySourcePath(sourceVideoPath);
    if (!sourceVideoPath) {
      setAssembleError("Для MP4 нужно заново загрузить видео через +Видео: backend path не найден для V1/V2/V3.");
      console.log("[VIDEO MATCH ASSEMBLY MISSING SOURCE]", {
        sourceVideo: project.sourceVideo,
        source_video: project.source_video,
        sourceVideoPath: project.sourceVideoPath,
        keys: Object.keys(project || {}),
      });
      return;
    }
    if (wantsAssembleWithAudio && !isAssembleAudioPathValid) {
      setAssembleError("Для Создать MP4 нажмите +Аудио: файл должен загрузиться на backend автоматически. Ручной путь больше не нужен.");
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
        const blockSourceVideoId = typeof getVideoNodeSourceVideoId === "function" ? getVideoNodeSourceVideoId(block) : String(block.sourceVideoId || block.source_video_id || "src_01");
        const blockSourceEntry = getSourceVideoEntryById(blockSourceVideoId) || {};
        const blockSourceVideoPath = String(
          getVideoNodeSourcePathForAssembly(blockSourceEntry)
          || sourcePathById[blockSourceVideoId]
          || (blockSourceVideoId === "src_01" ? sourceVideoPath : "")
          || block.sourceVideoPath
          || block.source_video_path
          || ""
        ).trim();
        return {
          ...block,
          sourceVideoId: blockSourceVideoId,
          source_video_id: blockSourceVideoId,
          sourceVideoPath: blockSourceVideoPath,
          source_video_path: blockSourceVideoPath,
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
          sourceVideos: sourceVideosForAssembly,
          source_videos: sourceVideosForAssembly,
          sourceVideo: project?.sourceVideo || {},
          source_video: project?.source_video || {},
          includeAudio: wantsAssembleWithAudio,
          includeBackgroundAudio: Boolean(backgroundAudioPathForAssembly),
          audioPath: wantsAssembleWithAudio ? resolvedAssembleAudioPath : "",
          audioUrl: project?.timingContext?.sourceAudioUrl || "",
          outputFormat: "16:9",
          previewQuality: "720p",
          audioMix: {
            ...getDefaultVideoMatchAudioMix(project.audioMix || {}),
            backgroundAudioPath: "",
            backgroundAudioVolume: Number(project.audioMix?.backgroundAudioVolume ?? 0.6),
            backgroundAudioFilename: String(project.audioMix?.backgroundAudioFilename || ""),
          },
          blocks: assemblyBlocksForExport.map((block) => {
            const forceMuteVideoAudio = isTruthyFlag(block.forceMuteVideoAudio ?? block.force_mute_video_audio);
            return ({
              id: block.id,
              audioSceneId: block.audioSceneId || block.segmentId || "",
              sourceVideoId: block.sourceVideoId || block.source_video_id || "",
              source_video_id: block.source_video_id || block.sourceVideoId || "",
              sourceVideoPath: block.sourceVideoPath || block.source_video_path || "",
              source_video_path: block.source_video_path || block.sourceVideoPath || "",
              sourceVideoUrl: block.sourceVideoUrl || block.source_video_url || "",
              source_video_url: block.source_video_url || block.sourceVideoUrl || "",
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
      patchProject({ assemblyDirty: false, lastAssemblyAt: Date.now() }, { lastGood: false, keepAssemblyClean: true });
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
  const sourceVideoPathsForAssembly = (Array.isArray(sourceVideos) ? sourceVideos : [])
    .map((source) => ({ source, path: getVideoNodeSourcePathForAssembly(source) }))
    .filter((item) => Boolean(item.path));
  const anySourceVideoPathForAssembly = sourceVideoPathsForAssembly[0]?.path || "";
  const hasAnySourceVideoPathForAssembly = Boolean(sourceVideoPathForAssembly || anySourceVideoPathForAssembly);
  const sourceRelinkWarnings = (Array.isArray(sourceVideos) ? sourceVideos : [])
    .slice(0, 5)
    .map((source, index) => {
      const normalized = normalizeVideoNodeSourceEntry(source, index);
      const sourceId = String(normalized.id || normalized.sourceVideoId || normalized.source_video_id || `src_${String(index + 1).padStart(2, "0")}`).trim();
      const hasBlocksForSource = assemblyBlocks.some((block) => getVideoNodeSourceVideoId(block) === sourceId);
      const hasJsonIdentity = Boolean(normalized.filename || normalized.name || normalized.label || hasBlocksForSource);
      if (!hasJsonIdentity || getVideoNodeSourcePathForAssembly(normalized)) return "";
      const slot = getVideoNodeSourceSlotIndex(normalized, index);
      const filename = normalized.filename || normalized.name || `${slot}.mp4`;
      return `Нужно привязать файл ${filename} к V${slot}`;
    })
    .filter(Boolean);
  const effectiveSourceVideoPathForMp4 = String(
    sourceVideoPathForAssembly
    || anySourceVideoPathForAssembly
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

      {/* AVA_PATCH_VIDEO_MATCH_CLEAR_MODAL_V9_START */}
      {resetConfirmOpen ? (
        <div className="videoMatchModalOverlay" role="dialog" aria-modal="true" aria-label="Очистить Video Match Node" onMouseDown={() => setResetConfirmOpen(false)}>
          <div className="videoMatchResetModal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="videoMatchResetModalTop">
              <span className="videoMatchResetModalIcon">🧹</span>
              <div>
                <h3>Очистить Video Match Node?</h3>
                <p>Удалится текущая доска, candidates и черновая сборка. Это действие не отправляет ничего в генерацию.</p>
              </div>
            </div>
            <div className="videoMatchResetModalWarn">Лучше сначала экспортировать пакет/JSON, если этот board ещё нужен.</div>
            <div className="videoMatchResetModalActions">
              <button className="videoMatchModalCancelBtn" type="button" onClick={() => setResetConfirmOpen(false)}>Отмена</button>
              <button className="videoMatchModalDangerBtn" type="button" onClick={() => { setResetConfirmOpen(false); clearNodeState(); }}>Очистить</button>
            </div>
          </div>
        </div>
      ) : null}
      {/* AVA_PATCH_VIDEO_MATCH_CLEAR_MODAL_V9_END */}
      <div className="videoMatchHeader">
        <div>
          <h1>Video Match Board</h1>
          <p>Компактная доска подбора фрагментов большого видео под аудио-карту.</p>
        </div>
        <div className="videoMatchHeaderActions">
          <button className="videoMatchTopClearBtn" type="button" onClick={() => setResetConfirmOpen(true)} title="Очистить текущую доску">
            <span className="videoMatchTopClearIcon">🧹</span>
            <span>Очистить</span>
          </button>
          <button className="videoMatchBackMenuBtn" type="button" onClick={() => navigate(-1)} title="Вернуться к предыдущему экрану">
            <span className="videoMatchBackMenuIcon">←</span>
            <span>Назад в меню</span>
          </button>
        </div>
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
              <label className="clipSB_btn clipSB_btnPrimary videoMatchUploadBtn videoMatchBtnAddVideo">
                + Видео
                <input type="file" accept="video/*" hidden onChange={(event) => onNextSourceVideoFileChange(event.target.files?.[0], event)} />
              </label>
              <label className="clipSB_btn clipSB_btnSecondary videoMatchUploadBtn videoMatchBtnUploadAudio">
                + Аудио
                <input type="file" accept="audio/*" hidden onChange={(event) => onAudioFileChange(event.target.files?.[0])} />
              </label>
            </div>
          </div>

          <div className="videoMatchVideoBox">
            {activeSourceVideoUrl ? (
              <video
                ref={videoRef}
                src={activeSourceVideoUrl}
                controls
                preload="metadata"
                playsInline
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
            src={effectiveAudioPreviewUrl || undefined}
            onLoadedMetadata={onLoadedAudioMetadata}
            onTimeUpdate={onAudioTimeUpdate}
            onEnded={onAudioEnded}
            onError={onAudioError}
            preload="metadata"
          />
          {sourceVideoLoadMessage ? <div className="videoMatchError">{sourceVideoLoadMessage}</div> : null}
          {audioLoadMessage ? <div className={`videoMatchAudioNotice ${audioLoadMessageTone || "isInfo"}`}>{audioLoadMessage}</div> : null}

          <div className="videoMatchTimelineMeta">
            <span>{getSourceVideoEntryById(activeSourceVideoId)?.filename || getSourceVideoEntryById(activeSourceVideoId)?.name || project.sourceVideo?.filename || "source.mp4"}</span>
            <span>{formatSec(currentTimeSec)} / {formatSec(timelineDuration)} с</span>
          </div>
          <div className="videoMatchSourceCountHint">Исходные видео: {getLoadedVideoSourceCount()}/5 · цвета назначаются автоматически по порядку загрузки</div>
          <div className="videoMatchSourceLanes" aria-label="source video lanes">
            {sourceVideos.slice(0, 5).map((source, index) => (
              <button
                key={source.id || index}
                type="button"
                className="videoMatchSourceLaneChip"
                style={{ "--source-color": getVideoNodeSourceColor(source.id) }}
                onClick={() => {
                  const url = getSourceVideoRuntimeUrl(source.id);
                  if (url && videoRef.current) {
                    safePauseVideo(videoRef.current, "source_lane_chip");
                    setActiveSourceVideoId(source.id);
                    videoRef.current.src = url;
                    videoRef.current.currentTime = 0;
                    videoRef.current.load();
                  }
                }}
                title={`${source.id}: ${source.path || source.filename || "не задан"}`}
              >
                <span className="videoMatchSourceLaneDot" />
                <b>{getVideoNodeSourceShortLabel(source.id)}</b>
                <span>{source.filename || (index === 0 ? "source.mp4" : "не загружено")}</span>
              </button>
            ))}
          </div>
          <div className="videoMatchSourceRelinkGrid" aria-label="source video relink actions">
            {sourceVideos.slice(0, 5).map((source, index) => {
              const normalizedSource = normalizeVideoNodeSourceEntry(source, index);
              const sourceId = String(normalizedSource.id || normalizedSource.sourceVideoId || normalizedSource.source_video_id || `src_${String(index + 1).padStart(2, "0")}`).trim();
              const hasBackendPath = Boolean(getVideoNodeSourcePathForAssembly(normalizedSource));
              return (
                <div key={`actions_${sourceId || index}`} className={`videoMatchSourceRelinkCard ${hasBackendPath ? "isLinked" : "needsRelink"}`} style={{ "--source-color": getVideoNodeSourceColor(sourceId) }}>
                  <span className="videoMatchSourceRelinkTitle">{getVideoNodeSourceShortLabel(sourceId)} · {normalizedSource.filename || normalizedSource.name || `${getVideoNodeSourceSlotIndex(normalizedSource, index)}.mp4`}</span>
                  <div className="videoMatchSourceRelinkActions">
                    <label className="videoMatchSourceLaneAction">
                      Заменить
                      <input type="file" accept="video/*" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void onVideoFileChange(file, sourceId); }} />
                    </label>
                    <label className="videoMatchSourceLaneAction">
                      Привязать файл
                      <input type="file" accept="video/*" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void onVideoFileChange(file, sourceId); }} />
                    </label>
                    <button className="videoMatchSourceLaneAction" type="button" onClick={() => onRemoveSourceVideo(sourceId)}>Удалить</button>
                  </div>
                </div>
              );
            })}
          </div>
          {sourceRelinkWarnings.length ? <div className="videoMatchWarnings">{sourceRelinkWarnings.join("; ")}</div> : null}
          <div className="videoMatchSourceSceneLanes" aria-label="source video scene lanes">
            {sourceVideos.slice(0, 5).map((source, sourceIndex) => {
              const sourceId = String(source.id || source.sourceVideoId || source.source_video_id || `src_${String(sourceIndex + 1).padStart(2, "0")}`).trim();
              const laneSegments = matchSegments.filter((segment) => {
                const candidates = Array.isArray(segment.candidates) ? segment.candidates : [];
                return getVideoNodeTimelineLaneSourceId(segment, candidates) === sourceId;
              });
              const laneRanges = laneSegments.map((segment) => getVideoNodeTimelineSourceRange(segment, Array.isArray(segment.candidates) ? segment.candidates : []));
              const laneDuration = Math.max(
                Number(source.duration_sec || source.durationSec || 0) || 0,
                ...laneRanges.map((range) => Number(range.end || 0)),
                1,
              );
              return (
                <div
                  key={sourceId}
                  className="videoMatchSourceSceneLane"
                  style={{ "--source-color": getVideoNodeSourceColor(sourceId) }}
                >
                  <div className="videoMatchSourceSceneLaneHead">
                    <span className="videoMatchSourceLaneDot" />
                    <b>{getVideoNodeSourceShortLabel(sourceId)}</b>
                    <span>{source.filename || source.name || source.label || (sourceIndex === 0 ? "source.mp4" : "не загружено")}</span>
                    <small>{laneSegments.length ? `${laneSegments.length} сцен` : "нет сцен"}</small>
                  </div>
                  <div className="videoMatchSourceSceneLaneTrack">
                    {laneSegments.length === 0 ? <span className="videoMatchSourceSceneLaneEmpty">Codex пока не выбрал сцен из этого источника</span> : null}
                    {laneSegments.map((segment, segmentIndex) => {
                      const candidates = Array.isArray(segment.candidates) ? segment.candidates : [];
                      const selectedCandidate = getVideoNodeSelectedCandidate(segment, candidates);
                      const activeVisualSourceId = getVideoNodeCandidateVisualSourceId(selectedCandidate || segment);
                      const segmentKey = getSegmentKey(segment);
                      const activeBlock = assemblyBlocks.find((block) => getSegmentKey(block) === segmentKey) || segment;
                      const { start: safeStart, end: safeEnd } = getVideoNodeTimelineSourceRange(segment, candidates);
                      const left = Math.max(0, Math.min(98, (safeStart / laneDuration) * 100));
                      const width = Math.max(4.2, Math.min(60, ((safeEnd - safeStart) / laneDuration) * 100));
                      const isSelected = activeBlock.id === project.selectedBlockId || segmentKey === project.selectedSegmentId;
                      const isBoardApplied = isBoardClipCandidate(selectedCandidate);
                      const isUploadApplied = !isBoardApplied && isOverrideCandidate(selectedCandidate);
                      return (
                        <button
                          key={`${sourceId}_${segmentKey}_${segmentIndex}`}
                          type="button"
                          className={`videoMatchSourceScenePill ${isSelected ? "isSelected" : ""} ${isLipSyncScene(activeBlock) ? "isLipSync" : ""} ${isBoardApplied ? "isBoardApplied" : ""} ${isUploadApplied ? "isUploadApplied" : ""}`}
                          style={{ left: `${left}%`, width: `${width}%`, "--source-color": getVideoNodeSourceColor(activeVisualSourceId) }}
                          onClick={() => onSelectSegmentAndPreviewV25(segment, "source_lane_click")}
                          title={`${segment.audioSceneId || segment.id || segmentKey} · выбран ${getVideoNodeSourceShortLabel(activeVisualSourceId)} · source ${formatSec(safeStart)}–${formatSec(safeEnd)}с · final ${formatSec(getBlockTargetStart(activeBlock))}–${formatSec(getBlockTargetEnd(activeBlock))}с`}
                        >
                          <span>{segment.audioSceneId || segment.id || `seg_${String(segmentIndex + 1).padStart(2, "0")}`}</span>
                          {isBoardApplied ? <i title="Клип с Доски">B</i> : null}
                          {isUploadApplied ? <i title="Клип с компьютера">U</i> : null}
                          {!isBoardApplied && !isUploadApplied && isLipSyncScene(activeBlock) ? <i>LS</i> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
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
                    style={{ left: `${markerLeft}%`, "--source-color": getVideoNodeSourceColor(getVideoNodeSourceVideoId(block)) }}
                    onClick={() => onSelectBlockAndPreview(block, "scene_click")}
                    title={`${block.audioSceneId || block.segmentId || block.id}: source ${formatSec(block.sourceVideoStartSec)}–${formatSec(block.sourceVideoEndSec)}с / final ${formatSec(getBlockTargetStart(block))}–${formatSec(getBlockTargetEnd(block))}с`}
                  >
                    {markerTone === "lipsync" ? <span className="videoMatchLsBadge">LS</span> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="videoMatchAudioRow">
            {/* PATCH18AJ: hidden old 'Аудио подключается автоматически' checkbox; audio inclusion is automatic by backend path */}
            <span>{project.audioPreviewMeta?.filename || "аудио не загружено"}</span>
            <span>{formatSec(audioCurrentTimeSec)} / {formatSec(effectiveAudioDurationSec)} с</span>
          </div>
          <div className="videoMatchScenePreviewHint">▶ Клик по сцене = точный preview: видео + аудио этого сегмента, затем автостоп.</div>
<div className="videoMatchAudioSimpleNotice">🎧 Простая логика: основной MP3 включается, если он загружен на backend; фон включается, если он загружен на backend. Галка больше не решает сборку.</div>
          <div className="videoMatchAudioStatusBadges">
            {(activeSourceVideoUrl || sourceVideoUrl)
              ? <span className="videoMatchAudioStatusBadge isOk">✅ Видео для предпросмотра загружено</span>
              : <span className="videoMatchAudioStatusBadge isWarn">⚠️ Видео для предпросмотра не загружено</span>}
            {hasAnySourceVideoPathForAssembly
              ? <span className="videoMatchAudioStatusBadge isOk">✅ Видео для MP4-сборки загружено</span>
              : (jsonSourceVideoPath
                ? <span className="videoMatchAudioStatusBadge isWarn">⚠️ MP4 использует путь из JSON</span>
                : <span className="videoMatchAudioStatusBadge isWarn">⚠️ MP4 source path не задан</span>)}
            {isAssemblyUsingProxySource ? <span className="videoMatchAudioStatusBadge isWarn">⚠️ MP4 использует proxy video</span> : null}
            {(effectiveAudioPreviewUrl || project.audioPreviewMeta?.filename)
              ? <span className="videoMatchAudioStatusBadge isOk">✅ Аудио для предпросмотра загружено</span>
              : <span className="videoMatchAudioStatusBadge isWarn">⚠️ Аудио для предпросмотра не загружено</span>}
            {wantsAssembleWithAudio ? (
              isAssembleAudioPathValid
                ? <span className="videoMatchAudioStatusBadge isOk">✅ Аудио для MP4 готово</span>
                : <span className={`videoMatchAudioStatusBadge ${resolvedAssembleAudioPath ? "isError" : "isWarn"}`}>{resolvedAssembleAudioPath ? "❌ Аудио не готово для MP4" : "⚠️ Нажмите +Аудио для MP4"}</span>
            ) : (
              <span className="videoMatchAudioStatusBadge isWarn">⚠️ {"Собрать без аудио"}</span>
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
                className={`videoMatchStripSegment ${block.id === project.selectedBlockId ? "isSelected" : ""} ${block.id === currentPlayingBlockId ? "isCurrent" : ""} ${isAssemblyPlaying && block.id === project.selectedBlockId ? "isPlaying" : ""} ${isOverrideBlock(block) ? "isOverride" : ""} ${isBoardClipCandidate(block) ? "isBoardApplied" : ""} ${isLipSyncScene(block) ? "isLipSync" : ""}`}
                style={{ "--strip-color-index": index % 8, "--source-color": getVideoNodeSourceColor(getVideoNodeCandidateVisualSourceId(block)) }}
                onClick={() => onSelectBlockAndPreview(block, "scene_click")}
                title={`${block.audioSceneId || block.segmentId}: video ${formatSec(block.sourceVideoStartSec)}–${formatSec(block.sourceVideoEndSec)}с · candidate ${block.candidateId || block.id}`}
              >
                <span>{block.audioSceneId || block.segmentId || `seg_${String(index + 1).padStart(2, "0")}`}</span>
                {isLipSyncScene(block) ? <span className="videoMatchLsBadge">LS</span> : null}
              </button>
            ))}
          </div>
          <div className="videoMatchActions videoMatchPlaybackActions">
            {/* PATCH18Q: manual preview button removed; click scene to preview */}
            {/* PATCH18P: live preview assembly hidden; use Создать MP4 instead */}
            {/* PATCH18Q: manual preview button removed; click scene to preview */}
            {/* PATCH18AJ: Stop button hidden; scene preview auto-stops */}
            <button className={`clipSB_btn clipSB_btnSecondary ${wantsAssembleWithAudio ? "videoMatchBtnMp4WithAudio" : "videoMatchBtnMp4NoAudio"} videoMatchCreateMp4MagicBtn ${hasReadyMp4Preview ? "isHiddenAfterMp4" : ""}`} type="button" disabled={!assemblyBlocks.length || isAssemblingMp4 || (wantsAssembleWithAudio && !isAssembleAudioPathValid)} onClick={onAssembleMp4}>{isAssemblingMp4 ? "Собираем MP4..." : "✨ Создать MP4"}</button>
            {/* PATCH18AK: selected clip technical label hidden */}
          </div>
          <div className="videoMatchContextRows">
            <div className={`videoMatchAutoAudioBox ${isAssembleAudioPathValid ? "isReady" : "isMissing"}`}>
              <div className="videoMatchAutoAudioTitle">
                {isAssembleAudioPathValid ? "✓ Аудио готово для MP4-сборки" : "⚠ MP4-аудио не подготовлено"}
              </div>
              <div className="videoMatchAutoAudioText">
                {isAssembleAudioPathValid
                  ? "Файл уже загружен на backend через +Аудио. Ручной путь больше не нужен."
                  : "Нажмите +Аудио и выберите mp3/wav/m4a — система сама сохранит файл для сборки."}
              </div>
              {isAssembleAudioPathValid ? <div className="videoMatchAssemblyAudioPathHint">{resolvedAssembleAudioPath}</div> : null}
            </div>
            <details className="videoMatchAudioMixDetails">
              <summary>
                {project.audioMix?.backgroundAudioFilename
                  ? `▸ Аудио микс · фон будет подмешан в MP4`
                  : `▸ Аудио микс · звук видео: ${project.audioMix?.originalVideoAudioMode === "keep" ? "оставить" : project.audioMix?.originalVideoAudioMode === "mute" ? "выключить" : "приглушить"} ${Math.round(Number(project.audioMix?.originalVideoVolume ?? 0.10) * 100)}% · фон: ${Math.round(Number(project.audioMix?.backgroundAudioVolume ?? 0.6) * 100)}%`}
              </summary>
              <div className="videoMatchAudioMixCompact">
              <div className="videoMatchAudioMixPurpose">
                🎧 Этот блок применяется при кнопке <b>Создать MP4</b>: основной MP3 остаётся главным, фон тихо подмешивается сверху, звук исходных видео можно приглушить или выключить.
              </div>
              
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
                🎵 Фоновая музыка:
                <span className="clipSB_btn clipSB_btnSecondary videoMatchAudioMixUploadBtn">
                  Загрузить фон для MP4
                  <input type="file" accept="audio/*" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void onBackgroundAudioFileChange(file); }} />
                </span>
                <input type="range" min="0" max="1" step="0.01" value={Number(project.audioMix?.backgroundAudioVolume ?? 0.6)} onChange={(event) => patchProject({
                  audioMix: getDefaultVideoMatchAudioMix({
                    ...(project.audioMix || {}),
                    backgroundAudioVolume: Number(event.target.value),
                  }),
                }, { lastGood: false })} />
                <span>{Math.round(Number(project.audioMix?.backgroundAudioVolume ?? 0.6) * 100)}%</span>
              </label>
              <div className="videoMatchAudioMixMeta">
                {project.audioMix?.backgroundAudioFilename
                  ? `фон: ${project.audioMix.backgroundAudioFilename} · будет подмешан в MP4 · громкость ${Math.round(Number(project.audioMix?.backgroundAudioVolume ?? 0.6) * 100)}%`
                  : "Фон не загружен. Если загрузить фон, он будет подмешан в финальный MP4."}
              </div>
              {project.audioMix?.backgroundAudioPath ? <div className="videoMatchAudioMixReady">✓ Фон загружен на backend и готов для MP4</div> : null}
              {project.audioMix?.backgroundAudioStatus === "uploading" ? <div className="videoMatchAudioMixUploading">Загружаю фон на backend...</div> : null}
              {project.audioMix?.backgroundAudioNeedsReload ? <div className="videoMatchError videoMatchAudioNotice">Фон нужно загрузить заново</div> : null}
              </div>
            </details>
            {assembleError ? <div className="videoMatchError">{assembleError}</div> : null}
            {assembleWarning ? <div className="videoMatchWarnings">{assembleWarning}</div> : null}
            {assembledPreview?.ok && assembledPreviewOutputUrl ? (
              <div className="videoMatchReadyMp4Panel">
                <div className="videoMatchReadyMp4Header">
                  <div>
                    <div className="videoMatchReadyMp4Eyebrow">MP4 готов</div>
                    <strong>Готовый черновик собран</strong>
                    <span>{assemblyDirty ? "Есть изменения после последней сборки." : "Откройте результат или скачайте файл для проверки монтажа."}</span>
                  </div>
                  <span className="videoMatchReadyMp4Pulse">✓</span>
                </div>
                <div className="videoMatchReadyMp4Actions">
                  <button
                    className="videoMatchReadyMp4Button"
                    type="button"
                    onClick={() => { console.info("[VIDEO MATCH OPEN INLINE MP4]", { url: assembledPreviewOutputUrl }); window.open(assembledPreviewOutputUrl, "_blank", "noopener,noreferrer"); }}
                  >
                    ✨ Смотреть готовый MP4
                  </button>
                  <a
                    className="videoMatchReadyMp4Download"
                    href={getVideoMatchDownloadUrl(assembledPreviewOutputUrl)}
                    download
                  >
                    ⬇ Скачать MP4
                  </a>
                  <button
                    className={`videoMatchReadyMp4Rebuild ${assemblyDirty ? "isDirty" : ""}`}
                    type="button"
                    disabled={!assemblyBlocks.length || isAssemblingMp4 || (wantsAssembleWithAudio && !isAssembleAudioPathValid)}
                    onClick={onAssembleMp4}
                  >
                    {isAssemblingMp4 ? "Собираем..." : (assemblyDirty ? "Пересобрать MP4" : "Пересобрать")}
                  </button>
                </div>
                {assemblyDirty ? <div className="videoMatchAssemblyDirtyNotice">Есть изменения после последней сборки</div> : null}
                {assembledPreview.warning ? <div className="videoMatchWarnings videoMatchReadyMp4Warning">warning: {assembledPreview.warning}</div> : null}
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
          <button
            className={`clipSB_btn clipSB_btnSecondary videoMatchOverrideUploadBtn videoMatchTakeBoardBtnV32 ${String(boardGeneratedClipsStatus || "").includes("Проверяю") ? "isChecking" : ""} ${String(boardGeneratedClipsStatus || "").includes("Добавлен вариант") ? "isAdded" : ""} ${(String(boardGeneratedClipsStatus || "").includes("не найден") || String(boardGeneratedClipsStatus || "").includes("нет готов")) ? "isMissing" : ""}`}
            type="button"
            disabled={!selectedSegment}
            title={selectedSegment ? (selectedBoardClip ? `Взять видео из Доски: ${selectedBoardClip.sceneId}` : "Проверить Доску и добавить клип этой сцены") : "Сначала выберите сцену"}
            onClick={onUseBoardClipForSelectedSegment}
          >
            {String(boardGeneratedClipsStatus || "").includes("Проверяю") ? "⏳ Проверяю Доску..." : (String(boardGeneratedClipsStatus || "").includes("Добавлен вариант") ? "✓ Вариант добавлен" : "➕ Взять с доски")}
          </button>
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
                          const candidateSourceId = getVideoNodeSourceVideoId(candidate);
                  const isPreviewCandidate = candidateKey === previewCandidateId;
                  const selectedSegmentKey = getSegmentKey(selectedSegment);
                  const candidateBlock = assemblyBlocks.find((block) => {
                    const blockSegmentKey = getSegmentKey(block);
                    const blockCandidateKey = getCandidateKey(block);
                    return blockCandidateKey === candidateKey || (blockSegmentKey === selectedSegmentKey && blockCandidateKey === candidateKey);
                  });
                  const effectiveForceMute = getEffectiveForceMuteVideoAudio(candidateBlock, selectedSegment, candidate);
                  return (
                    <div key={candidate.id} className={`videoMatchCandidateCard ${isCandidateSelected ? "isSelected" : ""} ${isPreviewCandidate ? "isPreview" : ""} ${isOverrideCandidate(candidate) ? "isOverride" : ""} ${isBoardClipCandidate(candidate) ? "isBoardCandidate" : ""}`} data-source-video-id={candidateSourceId} style={{ "--vm-source-color": getVideoNodeSourceColor(getVideoNodeCandidateVisualSourceId(candidate)), "--source-color": getVideoNodeSourceColor(getVideoNodeCandidateVisualSourceId(candidate)) }}>
                      {isBrowserSafeThumbnail(candidate.thumbnail) ? <img src={candidate.thumbnail} alt={`${candidate.id} thumbnail`} /> : null}
                      <div className="videoMatchCandidateBody">
                        <b>{candidate.id}{isCandidateSelected ? " · выбрано" : ""}{isPreviewCandidate ? " · просмотр" : ""}</b>
                        <span>видео: {formatSec(getBlockSourceStart(candidate))}–{formatSec(getBlockSourceEnd(candidate))} · уверенность: {candidate.confidence ?? "—"}</span>
                        {isBoardClipCandidate(candidate) ? <span className="videoMatchCandidateBadge">BOARD</span> : null}
                        {!isBoardClipCandidate(candidate) && isOverrideCandidate(candidate) ? <span className="videoMatchCandidateBadge">UPLOAD</span> : null}
                        {isOverrideCandidate(candidate) ? <small>длина клипа: {formatSec(candidate.overrideDurationSec || candidate.sourceVideoEndSec)}с / цель: {formatSec((selectedSegment?.targetEndSec || 0) - (selectedSegment?.targetStartSec || 0))}с</small> : null}
                        {candidate.matchReason && !String(candidate.matchReason).toLowerCase().includes("ui layout test") ? null : null}
                        {false && candidate.warnings?.length ? <small className="videoMatchWarnings">Предупреждения: {candidate.warnings.join("; ")}</small> : null}
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
            <button className="clipSB_btn clipSB_btnSecondary" type="button" onClick={() => setResetConfirmOpen(true)}>🧹 Очистить</button>
          </div>
          <div className="videoMatchWorkflowStatus">Пакет для ChatGPT сохраняет контекст. Пришлите его в чат — ChatGPT предложит следующий шаг и напишет точное задание Codex.</div>
          <textarea value={jsonInputDraft || project.jsonInputPreview || ""} onChange={(event) => setJsonInputDraft(event.target.value)} placeholder="Вставьте JSON schema video_match_board_v1 или video_match_board_v2..." />
          {project.jsonError ? <div className="videoMatchError">{project.jsonError}</div> : null}
          {importWarnings.length ? <div className="videoMatchWarnings">{importWarnings.join("; ")}</div> : null}
          {pendingImportResult ? <div className="videoMatchWarnings">Импорт ожидает подтверждения замены текущего проекта.</div> : null}
        </details>

        <details className="videoMatchPanel videoMatchDetailsPanel videoMatchRemovedPanel">
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

        <details className="videoMatchPanel videoMatchDetailsPanel videoMatchBlocksPanel videoMatchRemovedPanel">
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
            <div>audioPreviewUrl: {effectiveAudioPreviewUrl ? "есть" : "—"}</div>
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
                const segmentSourceId = getVideoNodeSegmentSourceVideoId(segment, candidates);
                return (
                  <div key={segment.id} className={`videoMatchSegmentCard ${isSegmentSelected ? "isSelected" : ""}`} style={{ "--source-color": getVideoNodeSourceColor(segmentSourceId) }}>
                    <div className="videoMatchSegmentHeader">
                      <div className="videoMatchSegmentTitle">
                        <b>{segment.audioSceneId || segment.id}</b><span className="videoMatchRightSourceBadge">{getVideoNodeSourceShortLabel(segmentSourceId)}</span>
                        <span>Видео: {getVideoNodeSourceShortLabel(segmentSourceId)} · {getSourceVideoEntryById(segmentSourceId)?.filename || getSourceVideoEntryById(segmentSourceId)?.name || "—"}</span>
                        <span>Тайминг сцены: {formatSec(segment.targetStartSec)}–{formatSec(segment.targetEndSec)} c · вариантов: {candidates.length}</span>
                      </div>
                    </div>
                    {segment.text && !String(segment.text).toLowerCase().includes("ui test") ? <p>{segment.text}</p> : null}
                    {segment.visualNeed ? <small className="videoMatchSegmentNeed">Нужно: {segment.visualNeed}</small> : null}
                    {isOpen ? (
                      <div className="videoMatchCandidatesList">
                        {candidates.map((candidate) => {
                          const isCandidateSelected = candidate.id === segment.selectedCandidateId;
                          const candidateSourceId = getVideoNodeSourceVideoId(candidate);
                          const isPreviewCandidate = candidate.id === previewCandidateId;
  return (
                            <div key={candidate.id} className={`videoMatchCandidateCard ${isCandidateSelected ? "isSelected" : ""} ${isPreviewCandidate ? "isPreview" : ""} ${isOverrideCandidate(candidate) ? "isOverride" : ""} ${isBoardClipCandidate(candidate) ? "isBoardCandidate" : ""}`} data-source-video-id={candidateSourceId} style={{ "--vm-source-color": getVideoNodeSourceColor(getVideoNodeCandidateVisualSourceId(candidate)), "--source-color": getVideoNodeSourceColor(getVideoNodeCandidateVisualSourceId(candidate)) }}>
                              {isBrowserSafeThumbnail(candidate.thumbnail) ? <img src={candidate.thumbnail} alt={`${candidate.id} thumbnail`} /> : null}
                              <div className="videoMatchCandidateBody">
                                <b>{segment.audioSceneId || segment.id} · {getVideoNodeSourceShortLabel(candidateSourceId)}{isCandidateSelected ? " · выбрано" : ""}{isPreviewCandidate ? " · просмотр" : ""}</b>
                                <span className="videoMatchCandidateCleanMeta"><b className="videoMatchRightSourceBadge" style={{ "--vm-source-color": getVideoNodeSourceColor(candidateSourceId), "--source-color": getVideoNodeSourceColor(candidateSourceId) }}>{getVideoNodeSourceShortLabel(candidateSourceId)}</b><span>{getSourceVideoEntryById(candidateSourceId)?.filename || getSourceVideoEntryById(candidateSourceId)?.name || candidate.sourceVideoFilename || candidate.source_video_filename || "video"}</span><span>{formatSec(candidate.sourceVideoStartSec)}–{formatSec(candidate.sourceVideoEndSec)} c</span></span>
                                {candidate.matchReason && !String(candidate.matchReason).toLowerCase().includes("ui layout test") ? null : null}
                                {false && candidate.warnings?.length ? <small className="videoMatchWarnings">Предупреждения: {candidate.warnings.join("; ")}</small> : null}
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
                <button key={block.id} type="button" className={`videoMatchBlockCard ${block.id === project.selectedBlockId ? "isSelected" : ""}`} onClick={() => onSelectBlockAndPreview(block, "scene_click")}>
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
