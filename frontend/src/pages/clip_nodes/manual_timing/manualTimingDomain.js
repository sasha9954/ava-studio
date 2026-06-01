import { API_BASE } from "../../../services/api.js";

export const MANUAL_TIMING_PODCAST_DIALOGUE_MODE = "podcast_dialogue";
export const MANUAL_TIMING_PODCAST_DIALOGUE_PROJECT_KIND = "podcast";
export const MANUAL_TIMING_STORY_PROJECT_KIND = "story";
export const MANUAL_TIMING_STORY_VOICEOVER_MODE = "story_voiceover";
export const MANUAL_TIMING_UNKNOWN_STORY_BLOCK = {
  block_id: "podcast_composer",
  id: "podcast_composer",
  title_ru: "Podcast Composer",
  color: 205,
};

function readJson(key) {
  try {
    const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function normalizeStaticUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("blob:") || raw.startsWith("data:")) return raw;
  if (raw.startsWith("/static/")) return `${API_BASE}${raw}`;
  if (raw.startsWith("/api/")) return `${API_BASE}${raw}`;
  if (raw.startsWith("/assets/")) return `${API_BASE}/api${raw}`;
  if (raw.startsWith("static/")) return `${API_BASE}/${raw}`;
  return raw;
}

export function normalizeManualTimingAudio(audio = null) {
  const src = audio && typeof audio === "object" ? audio : {};
  const assetApiPath = src.assetApiPath || src.asset_api_path || src.audioApiPath || "";
  const url = normalizeStaticUrl(src.url || src.asset_url || src.assetUrl || src.public_url || src.publicUrl || src.audioUrl || assetApiPath);
  return {
    ...src,
    url,
    assetApiPath,
    filename: src.filename || src.name || src.audioName || "audio",
    duration_sec: Number(src.duration_sec || src.durationSec || src.audioDurationSec || 0),
    durationSec: Number(src.duration_sec || src.durationSec || src.audioDurationSec || 0),
  };
}

export function readManualTimingProjectForNode(nodeId = "") {
  const safe = String(nodeId || "").trim() || "ava_workspace_manual_timing";
  return (
    readJson(`ava_podcast_timing_handoff:${safe}`) ||
    readJson(`ava_podcast_timing_return:${safe}`) ||
    readJson("ava_manual_timing_podcast_return") ||
    readJson("ava_podcast_timing_handoff:ava_workspace_manual_timing") ||
    null
  );
}

export function persistManualTimingProject(project = {}) {
  const safeProject = project && typeof project === "object" ? project : {};
  const nodeId = String(safeProject.nodeId || safeProject.sourceNodeId || "ava_workspace_manual_timing").trim();
  writeJson(`ava_podcast_timing_return:${nodeId}`, safeProject);
  writeJson("ava_manual_timing_podcast_return", safeProject);
}
