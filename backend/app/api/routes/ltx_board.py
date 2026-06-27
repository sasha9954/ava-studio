# AVA_BOARD_MASTER_AUDIO_MANUAL_SLICE_V199I: manual slice uses project master/mixed audio fallback, rejects vocal-ASR stems.
# AVA_BOARD_MASTER_AUDIO_FORCE_RECUT_V199G: audio routes always recut from master/mixed song audio; never from vocal-ASR stem.
# AVA_BOARD_MASTER_AUDIO_FORCE_RECUT_V199F: never reuse old per-scene audio slices for lip-sync/instrumental; recut from master mixed song audio only.
# AVA_BOARD_STALE_BATCH_UNBLOCK_V150A: clean orphaned server-batch state after backend reload.
# AVA_TELEGRAM_LIGHT_REVIEW_NO_BLOCK_V149A: send Telegram scene-ready from batch in background.
# AVA_BOARD_BATCH_READY_ACTIVE_CLEAR_V148A: completed batch scene clears active scene/job fields before UI polling.
# AVA_BOARD_SERVER_BATCH_AUTOSLICE_V147A: server batch auto-cuts audio slices for ia2v/lip-sync scenes.
# AVA_TELEGRAM_BOARD_REVIEW_HOOKS_V137A: Board server batch sends Telegram review messages and accepts callback-driven review.
# AVA_TELEGRAM_REGEN_BAD_CONTINUATION_V137E: pass batch source/bad scene ids into Telegram so regen is a continuation.
# AVA_BOARD_BIND_RESULT_TO_CURRENT_IMAGE_V132I: bind returned server-batch video to current scene image after image replacement.
# AVA_BOARD_BAD_REVIEW_FORCE_POSMOTRI_V132G: regenerated bad videos become ready + needs_review/посмотри.
# AVA_BOARD_BAD_REVIEW_RESULT_NEEDS_REVIEW_V132E: regenerated bad video becomes ready + needs_review instead of remaining bad.
# AVA_BOARD_BAD_REVIEW_KEEP_OLD_VIDEO_WHILE_REGEN_V132C: bad review regen keeps old video visible but queued until replacement.
# AVA_BOARD_BAD_REVIEW_NEEDS_REVIEW_PERSIST_V132B: bad-review server batch result persists needs_review after F5/return.\n# AVA_BOARD_BAD_REVIEW_SERVER_BATCH_V132A: bad review scenes regenerate and return as needs_review.
# AVA_BOARD_SERVER_BATCH_REMOVE_TIME_NAME_V131L: direct time.<member> references are replaced with __import__('time').<member>.
# AVA_BOARD_SERVER_BATCH_SAFE_TIME_SLEEP_V131K: replaced __import__('time').sleep with __import__('time').sleep to avoid stale import scope issues.
from __future__ import annotations

import base64
import copy
import json
import mimetypes
import os
import random
import re
import shutil
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.deps import ensure_project_access, get_current_user
from app.core.security import make_id, now_iso
from app.core.config import get_settings
from app.core.storage import store
from app.core.snapshot_media import media_refs_summary, preserve_media_refs
from app.api.routes.telegram import telegram_board_batch_started, telegram_board_scene_ready, telegram_board_batch_finished, telegram_assembly_render_completed


router = APIRouter(tags=["ltx-board"])
print("[BOARD ASSEMBLY PATCH ACTIVE] sparse_placeholders_v2", flush=True)

APP_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = APP_DIR.parent
WORKFLOWS_DIR = APP_DIR / "workflows"
BACKEND_ENV_FILE = BACKEND_DIR / ".env"

BOARD_VIDEO_JOBS: dict[str, dict[str, Any]] = {}
BOARD_MMAUDIO_JOBS: dict[str, dict[str, Any]] = {}
BOARD_ASSEMBLY_JOBS: dict[str, dict[str, Any]] = {}
BOARD_VIDEO_BATCHES: dict[str, dict[str, Any]] = {}
BOARD_VIDEO_BATCH_THREADS: dict[str, threading.Thread] = {}


# AVA_BOARD_VIDEO_JOB_PERSIST_V62:
# Board video jobs used to live only in process memory. If the backend was restarted
# while Comfy was still rendering, the UI kept polling a job that the backend had
# forgotten. Persist a lightweight sanitized copy into storage/jobs so status polling
# can continue after backend restart and still collect Comfy outputs by promptId.
def _board_video_job_sanitize(value: Any, depth: int = 0) -> Any:
    if depth > 8:
        return "[omitted_depth]"
    if isinstance(value, dict):
        result: dict[str, Any] = {}
        for key, item in value.items():
            key_text = str(key)
            key_lower = key_text.lower()
            if "dataurl" in key_lower or "data_url" in key_lower:
                result[key_text] = "[omitted_data_url]"
                continue
            result[key_text] = _board_video_job_sanitize(item, depth + 1)
        return result
    if isinstance(value, list):
        return [_board_video_job_sanitize(item, depth + 1) for item in value[:200]]
    if isinstance(value, str):
        if value.startswith("data:"):
            return "[omitted_data_url]"
        if len(value) > 12000:
            return value[:12000] + "...[truncated]"
    return value


def _board_video_job_store(job_id: str, job: dict[str, Any]) -> None:
    safe_job_id = str(job_id or job.get("jobId") or job.get("job_id") or "").strip()
    if not safe_job_id or not isinstance(job, dict):
        return
    job["jobId"] = job.get("jobId") or safe_job_id
    job["job_id"] = job.get("job_id") or safe_job_id
    BOARD_VIDEO_JOBS[safe_job_id] = job
    safe_job = _board_video_job_sanitize(job)
    safe_job["persistedAt"] = now_iso()

    def op(db):
        jobs = db.setdefault("jobs", {})
        existing_record = jobs.get(safe_job_id) if isinstance(jobs, dict) else None
        existing_data = existing_record.get("data") if isinstance(existing_record, dict) and existing_record.get("type") == "board_video" else existing_record
        next_record = {
            "id": safe_job_id,
            "type": "board_video",
            "status": safe_job.get("status") or safe_job.get("video_status") or "",
            "sceneId": safe_job.get("sceneId") or safe_job.get("scene_id") or "",
            "projectId": safe_job.get("projectId") or safe_job.get("project_id") or "",
            "updated_at": now_iso(),
            "data": safe_job,
        }
        # AVA_BOARD_STALE_JOB_NOOP_V200E:
        # /clip/video/status polls used to rewrite ava_db.json every 2.5s because only
        # updatedAt/historyPreview changed. If the meaningful job state is identical,
        # return a store no-op so storage.update skips the physical JSON write.
        if _board_video_job_fingerprint_v200e(existing_data) == _board_video_job_fingerprint_v200e(safe_job):
            return {
                "id": safe_job_id,
                "status": next_record["status"],
                "reason": "board_video_job_semantic_noop_v200e",
                "_skip_store_write_v200e": True,
                "_skip_store_write_v200c": True,
            }
        jobs[safe_job_id] = next_record
        return jobs[safe_job_id]

    try:
        store.update(op)
    except Exception as exc:
        print(f"[BOARD VIDEO JOB PERSIST] failed job_id={safe_job_id}: {exc}", flush=True)


def _board_video_job_load(job_id: str) -> dict[str, Any] | None:
    safe_job_id = str(job_id or "").strip()
    if not safe_job_id:
        return None
    try:
        record = (store.get_db().get("jobs") or {}).get(safe_job_id)
    except Exception as exc:
        print(f"[BOARD VIDEO JOB LOAD] failed job_id={safe_job_id}: {exc}", flush=True)
        return None
    if not isinstance(record, dict):
        return None
    data = record.get("data") if record.get("type") == "board_video" else record
    if not isinstance(data, dict):
        return None
    data["jobId"] = data.get("jobId") or safe_job_id
    data["job_id"] = data.get("job_id") or safe_job_id
    data["restoredFromStorage"] = True
    BOARD_VIDEO_JOBS[safe_job_id] = data
    return data


# AVA_BOARD_FORCE_CLEAR_RESTORED_STALE_JOB_V200H:
# After F5/backend restart an old boardjob can be loaded from storage and kept as
# "running" even though there is no live backend runner anymore. V200H treats an
# old restored job with no result and no active Comfy prompt as orphaned, returns
# not_found to the browser, and lets the Board clear "видео делается" immediately.
def _board_video_parse_dt_v200h(value: Any):
    if not value:
        return None
    try:
        text = str(value).strip()
        if not text:
            return None
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        dt = datetime.fromisoformat(text)
        if getattr(dt, "tzinfo", None) is not None:
            dt = dt.replace(tzinfo=None)
        return dt
    except Exception:
        return None


def _board_video_age_sec_v200h(job: dict[str, Any]) -> float:
    now_value = datetime.utcnow()
    candidates = [
        job.get("createdAt"), job.get("created_at"),
        job.get("startedAt"), job.get("started_at"),
        job.get("persistedAt"), job.get("persisted_at"),
        job.get("updatedAt"), job.get("updated_at"),
    ]
    ages: list[float] = []
    for value in candidates:
        dt = _board_video_parse_dt_v200h(value)
        if dt is not None:
            ages.append(max(0.0, (now_value - dt).total_seconds()))
    if not ages:
        return 999999.0
    return max(ages)


def _board_video_has_result_v200h(job: dict[str, Any]) -> bool:
    if not isinstance(job, dict):
        return False
    for key in (
        "videoUrl", "video_url", "videoApiPath", "video_api_path",
        "resultVideoUrl", "result_video_url", "resultVideoApiPath", "result_video_api_path",
        "videoAssetId", "video_asset_id", "imageUrl", "image_url",
    ):
        if str(job.get(key) or "").strip():
            return True
    outputs = job.get("outputs")
    return bool(outputs)


def _board_video_status_active_v200h(status: Any) -> bool:
    return str(status or "").strip().lower() in {
        "", "queued", "running", "starting", "preparing", "submitting", "processing", "queued_no_prompt_id"
    }


def _board_video_prompt_active_v200h(job: dict[str, Any]) -> bool | None:
    prompt_id = str(job.get("promptId") or job.get("prompt_id") or "").strip()
    base_url = str(job.get("targetComfyBaseUrl") or job.get("target_comfy_base_url") or "").strip()
    if not prompt_id or not base_url:
        return None
    fn = globals().get("_board_video_prompt_is_active_v200e")
    if callable(fn):
        try:
            return fn(base_url, prompt_id)
        except Exception:
            return None
    return None


def _board_video_should_force_orphan_v200h(job_id: str, job: dict[str, Any], *, was_in_memory: bool = False, source: str = "") -> tuple[bool, str]:
    if not isinstance(job, dict):
        return False, ""
    if _board_video_has_result_v200h(job):
        return False, ""
    status = str(job.get("status") or job.get("video_status") or "").strip().lower()
    if status in {"not_found", "orphaned", "error", "failed", "canceled", "cancelled", "completed_without_video_output", "output_download_failed", "output_finalize_failed"}:
        return True, f"stored_terminal_without_video_{status or 'empty'}_v200h"
    if not _board_video_status_active_v200h(status):
        return False, ""

    restored = bool(job.get("restoredFromStorage") or job.get("restored_from_storage"))
    age_sec = _board_video_age_sec_v200h(job)
    prompt_active = _board_video_prompt_active_v200h(job)

    # If Comfy still explicitly reports the prompt as active, do not kill it.
    if prompt_active is True:
        return False, ""

    # Strong signal: this job was resurrected from storage after backend restart.
    # Old restored jobs are the exact source of the stuck "видео делается" state.
    if restored and not was_in_memory and age_sec >= 20:
        return True, f"restored_boardjob_not_live_age_{int(age_sec)}s_{source or 'status'}_v200h"

    # If the job is old and Comfy does not confirm it as active, stop the UI loop.
    if restored and age_sec >= 120:
        return True, f"old_restored_boardjob_no_active_prompt_age_{int(age_sec)}s_{source or 'status'}_v200h"

    # AVA_BOARD_BATCH_NO_PREMATURE_ORPHAN_V201C:
    # Do not orphan a normal Comfy job only because its prompt disappeared from /queue.
    # Completed prompts disappear from /queue before we fetch /history; the old guard could
    # kill long i2v jobs around 300s, so the server batch moved to the next scene and the
    # finished video was never registered/applied to the Board. For jobs with a promptId,
    # let video_status continue into the /history check below; the V200E/V200F empty-history
    # logic will still orphan truly dead jobs after it verifies there is no output.
    prompt_id_v201c = str(job.get("promptId") or job.get("prompt_id") or "").strip()
    if str(job_id or "").startswith("boardjob_") and age_sec >= 300 and not prompt_id_v201c and prompt_active is not True:
        return True, f"old_boardjob_no_prompt_id_age_{int(age_sec)}s_{source or 'status'}_v201c"

    return False, ""


def _board_video_mark_orphaned_v200h(job_id: str, job: dict[str, Any], *, reason: str, scene_id: str = "", project_id: str = "") -> dict[str, Any]:
    now_value = now_iso()
    job["status"] = "not_found"
    job["video_status"] = "not_found"
    job["code"] = "BOARD_VIDEO_JOB_ORPHANED_V200H"
    job["error"] = reason
    job["orphanedAfterReload"] = True
    job["orphaned_after_reload"] = True
    job["updatedAt"] = now_value
    job["updated_at"] = now_value
    if scene_id:
        job["sceneId"] = job.get("sceneId") or scene_id
        job["scene_id"] = job.get("scene_id") or scene_id
    if project_id:
        job["projectId"] = job.get("projectId") or project_id
        job["project_id"] = job.get("project_id") or project_id
    try:
        _board_video_job_store(job_id, job)
    except Exception as exc:
        print("[BOARD VIDEO JOB ORPHAN STORE ERROR V200H]", {"job_id": job_id, "error": str(exc)}, flush=True)
    print("[BOARD VIDEO JOB FORCE ORPHAN V200H]", {
        "job_id": job_id,
        "scene_id": job.get("sceneId") or job.get("scene_id") or scene_id or "",
        "project_id": job.get("projectId") or job.get("project_id") or project_id or "",
        "reason": reason,
    }, flush=True)
    return {"ok": False, **job}


# AVA_BOARD_STALE_JOB_NOOP_V200E:
# Detect old Board video jobs restored after F5/backend reload that are no longer present
# in Comfy queue/history, and avoid rewriting the JSON store for unchanged running polls.
def _board_video_job_parse_dt_v200e(value: Any) -> datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        parsed = datetime.fromisoformat(raw)
        if parsed.tzinfo is not None:
            parsed = parsed.astimezone().replace(tzinfo=None)
        return parsed
    except Exception:
        return None


def _board_video_job_age_sec_v200e(job: dict[str, Any]) -> float:
    stamps: list[datetime] = []
    for key in ("createdAt", "created_at", "startedAt", "started_at", "submittedAt", "submitted_at", "updatedAt", "updated_at"):
        parsed = _board_video_job_parse_dt_v200e(job.get(key))
        if parsed is not None:
            stamps.append(parsed)
    if not stamps:
        return 10**9
    oldest = min(stamps)
    return max(0.0, (datetime.utcnow() - oldest).total_seconds())


def _board_video_job_fingerprint_v200e(value: Any) -> str:
    volatile = {
        "updatedAt", "updated_at", "persistedAt", "lastCheckedAt", "last_checked_at",
        "historyPreview", "history_preview", "historyError", "history_error",
        "pollCount", "poll_count",
    }

    def clean(item: Any) -> Any:
        if isinstance(item, dict):
            return {str(k): clean(v) for k, v in sorted(item.items(), key=lambda pair: str(pair[0])) if str(k) not in volatile}
        if isinstance(item, list):
            return [clean(v) for v in item]
        return item

    try:
        return json.dumps(clean(value or {}), ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    except Exception:
        return str(clean(value or {}))


def _board_video_prompt_is_active_v200e(base_url: str, prompt_id: str) -> bool | None:
    base = str(base_url or "").strip()
    pid = str(prompt_id or "").strip()
    if not base or not pid:
        return None
    try:
        queue = _comfy_get_json(base, "/queue", timeout=8)
    except Exception:
        return None
    if isinstance(queue, dict) and queue.get("_error"):
        return None
    try:
        return pid in set(_comfy_queue_prompt_ids(queue))
    except Exception:
        return None


# AVA_BOARD_STALE_JOB_FAST_ORPHAN_V200F:
# A restored browser poll can keep a scene stuck as "видео делается" when the original
# Comfy prompt disappeared after F5/backend reload. Keep a short in-memory probe timer
# and clear the stale job once queue/history prove there is no live process.
def _board_video_job_probe_age_sec_v200f(job: dict[str, Any]) -> float:
    started = _board_video_job_parse_dt_v200e(job.get("orphanProbeStartedAtV200F") or job.get("orphan_probe_started_at_v200f"))
    if started is None:
        now_value = now_iso()
        job["orphanProbeStartedAtV200F"] = now_value
        job["orphan_probe_started_at_v200f"] = now_value
        return 0.0
    return max(0.0, (datetime.utcnow() - started).total_seconds())


# AVA_BOARD_STALE_HISTORY_NO_OUTPUT_V200G:
# Some stale Comfy prompts return a non-empty /history/<prompt_id> object, but it
# contains no downloadable outputs. V200E/V200F only orphaned empty history, so the
# browser kept a restored Board job as "running" forever after F5/backend restart.
def _board_video_history_has_any_output_files_v200g(history: Any) -> bool:
    def walk(value: Any) -> bool:
        if isinstance(value, dict):
            filename = value.get("filename") or value.get("file") or value.get("path")
            if isinstance(filename, str) and filename.strip():
                return True
            outputs = value.get("outputs")
            if isinstance(outputs, dict) and outputs:
                if walk(outputs):
                    return True
            for child in value.values():
                if walk(child):
                    return True
        elif isinstance(value, (list, tuple)):
            for child in value:
                if walk(child):
                    return True
        return False

    try:
        return walk(history)
    except Exception:
        return False


def _board_video_should_orphan_v200f(job: dict[str, Any], *, base_url: str, prompt_id: str, history: Any, history_error: bool = False) -> tuple[bool, str]:
    restored = bool(job.get("restoredFromStorage") or job.get("restored_from_storage"))
    if not restored:
        return False, ""

    prompt_active = _board_video_prompt_is_active_v200e(base_url, prompt_id)
    probe_age = _board_video_job_probe_age_sec_v200f(job)
    job_age = _board_video_job_age_sec_v200e(job)
    history_is_error = bool(history_error or (isinstance(history, dict) and "_history_error" in history))
    history_empty = not bool(history) or history_is_error
    history_has_outputs = _board_video_history_has_any_output_files_v200g(history)
    history_nonempty_without_outputs = bool(isinstance(history, dict) and history and not history_is_error and not history_has_outputs)
    prompt_not_active = prompt_active is False
    prompt_unknown = prompt_active is None

    # Strongest signal: the prompt is not in Comfy queue/running, and its history has no output files.
    if history_nonempty_without_outputs and prompt_not_active and probe_age >= 3:
        return True, "restored_history_without_outputs_prompt_not_active_v200g"

    # If queue probing is unavailable, still stop old restored jobs after a short probe window.
    # This avoids keeping a scene stuck as "видео делается" forever when Comfy was restarted.
    if history_nonempty_without_outputs and prompt_unknown and (probe_age >= 12 or job_age >= 180):
        return True, "restored_history_without_outputs_prompt_unknown_v200g"

    if prompt_not_active and history_empty and probe_age >= 3:
        return True, "restored_prompt_missing_from_comfy_queue_history_v200g"
    if history_is_error and probe_age >= 20:
        return True, "restored_comfy_history_unreachable_probe_timeout_v200g"
    if history_empty and probe_age >= 20:
        return True, "restored_empty_history_probe_timeout_v200g"
    if not history_has_outputs and prompt_active is not True and job_age >= 300:
        return True, "restored_old_job_no_outputs_not_active_v200g"
    return False, ""


def _board_video_mark_orphaned_v200e(job_id: str, job: dict[str, Any], *, reason: str, history: Any = None) -> dict[str, Any]:
    now_value = now_iso()
    job["status"] = "not_found"
    job["video_status"] = "not_found"
    job["code"] = "BOARD_VIDEO_JOB_ORPHANED_AFTER_RELOAD"
    job["error"] = reason
    job["orphanedAfterReload"] = True
    job["orphaned_after_reload"] = True
    job["updatedAt"] = now_value
    job["updated_at"] = now_value
    if history is not None:
        job["historyPreview"] = history
    _board_video_job_store(job_id, job)
    print("[BOARD VIDEO JOB ORPHANED V200E]", {
        "job_id": job_id,
        "scene_id": job.get("sceneId") or job.get("scene_id") or "",
        "project_id": job.get("projectId") or job.get("project_id") or "",
        "prompt_id": job.get("promptId") or job.get("prompt_id") or "",
        "reason": reason,
    }, flush=True)
    return {"ok": False, **job}


WORKFLOW_ROUTE_MAP: dict[str, str] = {
    "i2v": "image-video.json",
    "i2v_text": "image-video-golos-zvuk.json",
    "i2v_sound": "image-video-golos-zvuk.json",
    "ia2v": "image-lipsink-video-music.json",
    "ia2v_lipsync": "image-lipsink-video-music.json",
    "ia2v_instrumental": "image-lipsink-video-music.json",
    "lip_sync": "image-lipsink-video-music.json",
    "first_last": "last-first cadr-NO sound.json",
    "first_last_sound": "last-first cadr-sound.json",
    "txt2img": "text to image.json",
    "text_to_image": "text to image.json",
    "image_from_text": "text to image.json",
}

VIDEO_ROUTE_CREDIT_COSTS: dict[str, int] = {
    "ia2v": 2,
    "ia2v_lipsync": 2,
    "ia2v_instrumental": 2,
    "lip_sync": 2,
    "first_last": 2,
    "first_last_sound": 2,
    "txt2img": 1,
    "text_to_image": 1,
    "image_from_text": 1,
    "i2v": 1,
    "i2v_text": 1,
    "i2v_sound": 1,
}

TXT2IMG_QUALITY_CREDIT_COSTS: dict[str, int] = {
    "good": 1,
    "safe": 1,
    "standard": 1,
    "high": 1,
    "ultra": 2,
    "max": 2,
}


def _txt2img_quality_from_value(value: Any) -> str:
    text = str(value or "").strip().lower()
    if text in {"ultra", "max"}:
        return "ultra"
    return "good"


def _txt2img_quality_from_payload(payload: Any) -> str:
    if isinstance(payload, dict):
        return _txt2img_quality_from_value(
            payload.get("image_quality")
            or payload.get("imageQuality")
            or payload.get("txt2img_quality")
            or payload.get("txt2imgQuality")
            or payload.get("quality")
        )

    return _txt2img_quality_from_value(
        getattr(payload, "image_quality", None)
        or getattr(payload, "imageQuality", None)
        or getattr(payload, "txt2img_quality", None)
        or getattr(payload, "txt2imgQuality", None)
        or getattr(payload, "quality", None)
    )


def _video_credit_cost_for_payload(route: str, payload: Any = None) -> int:
    route_value = str(route or "").strip()
    if route_value in {"txt2img", "text_to_image", "image_from_text"}:
        quality = _txt2img_quality_from_payload(payload)
        return int(TXT2IMG_QUALITY_CREDIT_COSTS.get(quality, 1))
    return int(VIDEO_ROUTE_CREDIT_COSTS.get(route_value, 1) or 1)

MMAUDIO_CREDIT_COST = 1

IMAGE_GENERATION_ROUTES = {"txt2img", "text_to_image", "image_from_text"}


def _is_image_generation_route(route: str | None) -> bool:
    return str(route or "").strip() in IMAGE_GENERATION_ROUTES

BOARD_ASSEMBLY_EXPORT_CREDIT_COST = 1
BOARD_ASSEMBLY_MUSIC_CREDIT_COST = 1
BOARD_ASSEMBLY_WATERMARK_CREDIT_COST = 1


class SliceAudioIn(BaseModel):
    audio_url: str | None = None
    audioUrl: str | None = None
    audio_asset_id: str | None = None
    audioAssetId: str | None = None
    project_id: str | None = None
    projectId: str | None = None
    audio_asset_api_path: str | None = None
    audioAssetApiPath: str | None = None
    asset_id: str | None = None
    assetId: str | None = None
    scene_id: str | None = None
    sceneId: str | None = None
    start_sec: float | None = None
    startSec: float | None = None
    end_sec: float | None = None
    endSec: float | None = None
    duration_sec: float | None = None
    durationSec: float | None = None
    format: str = "mp3"


class ExtractLastFrameIn(BaseModel):
    video_url: str | None = None
    videoUrl: str | None = None
    video_api_path: str | None = None
    videoApiPath: str | None = None
    video_path: str | None = None
    videoPath: str | None = None
    scene_id: str | None = None
    sceneId: str | None = None
    source_scene_id: str | None = None
    sourceSceneId: str | None = None


class VideoStartIn(BaseModel):
    scene_id: str | None = None
    sceneId: str | None = None
    project_id: str | None = None
    projectId: str | None = None
    route: str | None = None
    workflow_key: str | None = None
    workflowKey: str | None = None
    image_url: str | None = None
    imageUrl: str | None = None
    image_data_url: str | None = None
    imageDataUrl: str | None = None
    start_image_data_url: str | None = None
    startImageDataUrl: str | None = None
    end_image_data_url: str | None = None
    endImageDataUrl: str | None = None
    audio_data_url: str | None = None
    audioDataUrl: str | None = None
    start_image_url: str | None = None
    startImageUrl: str | None = None
    end_image_url: str | None = None
    endImageUrl: str | None = None
    audio_slice_url: str | None = None
    audioSliceUrl: str | None = None
    video_prompt: str | None = None
    videoPrompt: str | None = None
    positive_prompt: str | None = None
    positivePrompt: str | None = None
    negative_prompt: str | None = None
    negativePrompt: str | None = None
    width: int | None = None
    height: int | None = None
    format: str | None = None
    image_quality: str | None = None
    imageQuality: str | None = None
    txt2img_quality: str | None = None
    txt2imgQuality: str | None = None
    duration_sec: float | None = None
    durationSec: float | None = None
    target_duration_sec: float | None = None
    targetDurationSec: float | None = None
    scene_start_sec: float | None = None
    sceneStartSec: float | None = None
    scene_end_sec: float | None = None
    sceneEndSec: float | None = None


class BoardVideoBatchStartIn(BaseModel):
    mode: str | None = "missing"
    source: str | None = None
    scene_ids: list[str] | None = None
    sceneIds: list[str] | None = None
    scenes: list[dict[str, Any]] | None = None
    overwrite: bool | None = False
    # AVA_BOARD_SERVER_BATCH_AUTOSLICE_V147A: optional root Board audio for auto slicing.
    audio: dict[str, Any] | None = None
    board_audio: dict[str, Any] | None = None
    boardAudio: dict[str, Any] | None = None
    audio_url: str | None = None
    audioUrl: str | None = None
    audio_asset_id: str | None = None
    audioAssetId: str | None = None
    audio_asset_api_path: str | None = None
    audioAssetApiPath: str | None = None
    asset_id: str | None = None
    assetId: str | None = None


class BoardVideoBatchStopIn(BaseModel):
    reason: str | None = None

class MmaudioStartIn(BaseModel):
    scene_id: str | None = None
    sceneId: str | None = None
    project_id: str | None = None
    projectId: str | None = None
    video_url: str | None = None
    videoUrl: str | None = None
    prompt: str | None = None
    negative_prompt: str | None = None
    negativePrompt: str | None = None
    duration_sec: float | None = None
    durationSec: float | None = None
    workflow_key: str | None = None
    workflowKey: str | None = None


def _read_dotenv_value(name: str) -> str:
    if not BACKEND_ENV_FILE.exists():
        return ""
    try:
        for line in BACKEND_ENV_FILE.read_text(encoding="utf-8", errors="ignore").splitlines():
            raw = line.strip()
            if not raw or raw.startswith("#") or "=" not in raw:
                continue
            key, value = raw.split("=", 1)
            if key.strip() == name:
                return value.strip().strip('"').strip("'")
    except Exception:
        return ""
    return ""


def _env(name: str, default: str = "") -> str:
    value = os.getenv(name) or os.getenv(f"AVA_{name}")
    if value:
        return str(value).strip()

    value = _read_dotenv_value(name) or _read_dotenv_value(f"AVA_{name}")
    if value:
        return str(value).strip()

    try:
        settings = get_settings()
        value = getattr(settings, name, "") or getattr(settings, name.lower(), "")
        if value:
            return str(value).strip()
    except Exception:
        pass

    return default



# ---------------------------------------------------------------------
# Stage 7.0B — credit charging helpers.
# Rules:
# - Board video: i2v/i2v_sound/i2v_text = 1, ia2v/lip_sync/first_last = 2.
# - MMAudio = 1.
# - Board Assembly = 1 base + 1 if background music is used + 1 if watermark is used.
# - Preflight checks balance before job starts.
# - Real debit happens only after successful result.
# - Idempotent by user_id + job_id + action_type.
# ---------------------------------------------------------------------

def _ava_credit_public_user(user: dict) -> dict:
    return {
        "id": user.get("id"),
        "name": user.get("name"),
        "email": user.get("email"),
        "created_at": user.get("created_at"),
        "credits_balance": user.get("credits_balance", 0),
    }


def _ava_credit_append_ledger(db: dict, item: dict) -> dict:
    entry = {
        "id": make_id("cl"),
        "created_at": now_iso(),
        **item,
    }
    db["credits_ledger"].append(entry)
    return entry


def _ava_credit_require_balance(user: dict, amount: int) -> None:
    amount = int(amount or 0)
    if amount <= 0:
        return
    if int(user.get("credits_balance", 0) or 0) < amount:
        raise HTTPException(status_code=402, detail="Недостаточно кредитов")


def _ava_credit_attach_job_user(job: dict, user: dict | None) -> None:
    if not isinstance(job, dict) or not isinstance(user, dict):
        return
    user_id = user.get("id")
    if not user_id:
        return
    job.setdefault("userId", user_id)
    job.setdefault("user_id", user_id)
    job.setdefault("creditUserId", user_id)
    job.setdefault("creditCharged", False)


def _ava_credit_ensure_job_owner(job: dict, user: dict) -> None:
    if not isinstance(job, dict):
        return
    job_user_id = job.get("userId") or job.get("user_id") or job.get("creditUserId")
    if not job_user_id:
        _ava_credit_attach_job_user(job, user)
        return
    if job_user_id != user.get("id"):
        raise HTTPException(status_code=404, detail="Job not found")


def _clean_project_id(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in {"none", "null", "undefined"}:
        return None
    return text


def _ava_credit_project_from_job(job: dict) -> str | None:
    return _clean_project_id(job.get("projectId")) or _clean_project_id(job.get("project_id"))


def _ava_credit_existing_debit(db: dict, *, user_id: str, job_id: str, action_type: str) -> dict | None:
    return next((
        item for item in db["credits_ledger"]
        if item.get("user_id") == user_id
        and item.get("job_id") == job_id
        and item.get("action_type") == action_type
        and item.get("amount", 0) < 0
    ), None)


def _ava_credit_charge_job_actions(job: dict, actions: list[dict[str, Any]]) -> dict | None:
    if not actions:
        job["creditCharged"] = False
        job["creditChargeMode"] = "no_charge_actions"
        job["creditCost"] = 0
        return None

    user_id = job.get("userId") or job.get("user_id") or job.get("creditUserId")
    if not user_id:
        job["creditCharged"] = False
        job["creditChargeMode"] = "charge_skipped_missing_user"
        job["creditError"] = "missing_job_user_id"
        return None

    job_id = job.get("jobId") or job.get("job_id") or ""
    project_id = _ava_credit_project_from_job(job)
    total_configured = sum(max(0, int(action.get("amount") or 0)) for action in actions)
    job["creditCost"] = total_configured
    job["creditBreakdown"] = actions

    def op(db):
        current_user = db["users"].get(user_id)
        if not current_user:
            raise HTTPException(status_code=404, detail="Credit user not found")

        pending = []
        existing = []
        for action in actions:
            amount = max(0, int(action.get("amount") or 0))
            action_type = str(action.get("action_type") or "").strip()
            if amount <= 0 or not action_type:
                continue
            found = _ava_credit_existing_debit(db, user_id=user_id, job_id=job_id, action_type=action_type)
            if found:
                existing.append(found)
            else:
                pending.append({**action, "amount": amount, "action_type": action_type})

        amount_to_charge = sum(item["amount"] for item in pending)
        before = int(current_user.get("credits_balance", 0) or 0)
        if before < amount_to_charge:
            raise HTTPException(status_code=402, detail="Недостаточно кредитов")

        balance = before
        charged_items = []
        for action in pending:
            amount = action["amount"]
            after = balance - amount
            current_user["credits_balance"] = after
            current_user["updated_at"] = now_iso()
            ledger_item = _ava_credit_append_ledger(db, {
                "user_id": user_id,
                "project_id": project_id,
                "job_id": job_id,
                "action_type": action["action_type"],
                "amount": -amount,
                "before_balance": balance,
                "after_balance": after,
                "meta": {
                    "source": "board",
                    "label": action.get("label") or "",
                    "route": job.get("route") or job.get("workflowKey") or job.get("audioMode") or "",
                    "scene_id": job.get("sceneId") or job.get("scene_id") or "",
                    "idempotency": "one_job_one_charge_per_action",
                    "charge_timing": "after_success",
                    **(action.get("meta") if isinstance(action.get("meta"), dict) else {}),
                },
            })
            charged_items.append(ledger_item)
            balance = after

        return {
            "ok": True,
            "duplicate": not bool(charged_items),
            "charged": charged_items,
            "existing": existing,
            "balance": current_user.get("credits_balance", 0),
            "user": _ava_credit_public_user(current_user),
            "amountChargedNow": amount_to_charge,
            "amountConfigured": total_configured,
        }

    try:
        result = store.update(op)
        job["creditCharged"] = True
        job["creditChargeMode"] = "charged_after_success" if result.get("amountChargedNow", 0) else "already_charged"
        job["creditBalance"] = result.get("balance")
        job["creditChargeResult"] = result
        if result.get("user"):
            job["user"] = result["user"]
        job.pop("creditError", None)
        return result
    except HTTPException as exc:
        job["creditCharged"] = False
        job["creditChargeMode"] = "charge_failed_after_success"
        job["creditError"] = exc.detail
        job["creditErrorStatus"] = exc.status_code
        return None
    except Exception as exc:
        job["creditCharged"] = False
        job["creditChargeMode"] = "charge_failed_after_success"
        job["creditError"] = str(exc)
        return None


def _ava_credit_video_actions(job: dict) -> list[dict[str, Any]]:
    route = str(job.get("route") or "i2v")
    amount = int(job.get("creditCost") or _video_credit_cost_for_payload(route, job.get("payload") if isinstance(job.get("payload"), dict) else job))
    return [{
        "action_type": f"board_video_{route}",
        "amount": amount,
        "label": f"Board video: {route}",
        "meta": {"kind": "board_video", "route": route},
    }]


def _ava_credit_mmaudio_actions(job: dict) -> list[dict[str, Any]]:
    return [{
        "action_type": "board_mmaudio",
        "amount": MMAUDIO_CREDIT_COST,
        "label": "MMAudio sound design",
        "meta": {"kind": "mmaudio"},
    }]


def _ava_credit_assembly_actions_from_payload(payload: dict) -> list[dict[str, Any]]:
    actions = [{
        "action_type": "board_assembly_export",
        "amount": BOARD_ASSEMBLY_EXPORT_CREDIT_COST,
        "label": "Board Assembly MP4 export",
        "meta": {"kind": "assembly"},
    }]

    music = payload.get("music") if isinstance(payload.get("music"), dict) else {}
    has_music = bool(
        music.get("asset_id")
        or music.get("asset_api_path")
        or music.get("audio_url")
        or music.get("url")
        or payload.get("music_audio_url")
        or payload.get("musicAudioUrl")
    )
    if has_music:
        actions.append({
            "action_type": "board_assembly_music",
            "amount": BOARD_ASSEMBLY_MUSIC_CREDIT_COST,
            "label": "Board Assembly background music",
            "meta": {"kind": "assembly_music"},
        })

    watermark = payload.get("watermark") if isinstance(payload.get("watermark"), dict) else {}
    watermark_enabled = bool(watermark.get("enabled")) and bool(str(watermark.get("text") or "").strip())
    if watermark_enabled:
        actions.append({
            "action_type": "board_assembly_watermark",
            "amount": BOARD_ASSEMBLY_WATERMARK_CREDIT_COST,
            "label": "Board Assembly watermark",
            "meta": {"kind": "assembly_watermark", "motion": watermark.get("motion") or "static"},
        })

    return actions


def _ava_credit_assembly_actions(job: dict) -> list[dict[str, Any]]:
    payload = job.get("payload") if isinstance(job.get("payload"), dict) else {}
    return _ava_credit_assembly_actions_from_payload(payload)


def _ava_credit_charge_video_job_if_ready(job: dict) -> None:
    if job.get("videoUrl") or job.get("video_url") or job.get("imageUrl") or job.get("image_url"):
        _ava_credit_charge_job_actions(job, _ava_credit_video_actions(job))


def _ava_credit_charge_mmaudio_job_if_ready(job: dict) -> None:
    if job.get("mmaudioVideoUrl") or job.get("mmaudio_video_url") or job.get("videoUrl") or job.get("video_url"):
        _ava_credit_charge_job_actions(job, _ava_credit_mmaudio_actions(job))


def _ava_credit_charge_assembly_job_if_ready(job: dict) -> None:
    if job.get("videoUrl") or job.get("video_url"):
        _ava_credit_charge_job_actions(job, _ava_credit_assembly_actions(job))


def _clean_comfy_url(value: str | None) -> str:
    text = str(value or "").strip().rstrip("/")
    if not text:
        return ""
    lowered = text.lower()
    if "remote_comfy_ip" in lowered or "tailscale_ip" in lowered or "<" in text or ">" in text:
        return ""
    return text


def _main_comfy_url() -> str:
    return _clean_comfy_url(
        _env("COMFY_MAIN_BASE_URL")
        or _env("COMFY_LTX_BASE_URL")
        or _env("COMFY_BASE_URL")
    )


def _mmaudio_comfy_url() -> str:
    return _clean_comfy_url(
        _env("COMFY_MMAUDIO_BASE_URL")
        or _env("COMFY_LAB_BASE_URL")
        or _env("COMFY_LAB_URL")
        or _env("MMAUDIO_COMFY_BASE_URL")
    )


def _settings_public_base_url() -> str:
    try:
        settings = get_settings()
        base = str(getattr(settings, "public_base_url", "") or "").rstrip("/")
        # AVA_PUBLIC_BASE_STRIP_API_V203J:
        # public_base_url must be an origin/base, not the /api root.
        # If configured as http://host:8010/api, static URLs became
        # http://host:8010/api/static/... and 404 because static is mounted at /static.
        if base.endswith("/api"):
            base = base[:-4].rstrip("/")
        return base
    except Exception:
        return ""


def _settings_static_path() -> Path:
    try:
        settings = get_settings()
        return Path(getattr(settings, "static_path"))
    except Exception:
        return BACKEND_DIR / "static"


def _settings_storage_path() -> Path:
    try:
        settings = get_settings()
        return Path(getattr(settings, "storage_path"))
    except Exception:
        return BACKEND_DIR / "storage"


def _asset_file_path_from_record(asset: dict[str, Any] | None) -> Path | None:
    if not isinstance(asset, dict):
        return None
    raw = str(asset.get("storage_path") or asset.get("storagePath") or "").strip()
    if not raw:
        return None

    candidates: list[Path] = []
    raw_path = Path(raw)
    candidates.append(raw_path)

    normalized_raw = raw.replace("\\", "/")
    normalized_path = Path(normalized_raw)
    if normalized_path not in candidates:
        candidates.append(normalized_path)

    if not normalized_path.is_absolute():
        candidates.append(BACKEND_DIR / normalized_path)
        candidates.append(_settings_storage_path().parent / normalized_path)

    for candidate in candidates:
        try:
            if candidate.exists() and candidate.is_file():
                return candidate
        except Exception:
            continue
    return candidates[0] if candidates else None


def _guess_output_mime(path: Path, kind: str) -> str:
    guessed = mimetypes.guess_type(str(path))[0]
    if guessed:
        return guessed
    if kind == "image":
        return "image/png"
    if kind == "video":
        return "video/mp4"
    return "application/octet-stream"


def _asset_public_ref(asset: dict[str, Any]) -> dict[str, Any]:
    asset_id = str(asset.get("id") or "")
    api_path = f"/assets/{asset_id}/file"
    base = _settings_public_base_url()
    return {
        "asset_id": asset_id,
        "assetId": asset_id,
        "asset_api_path": api_path,
        "assetApiPath": api_path,
        "asset_url": f"{base}/api{api_path}" if base else f"/api{api_path}",
        "assetUrl": f"{base}/api{api_path}" if base else f"/api{api_path}",
        "kind": asset.get("kind"),
        "stage": asset.get("stage"),
        "project_id": asset.get("project_id"),
        "projectId": asset.get("project_id"),
        "original_name": asset.get("original_name"),
        "originalName": asset.get("original_name"),
        "name": asset.get("original_name"),
        "size_bytes": asset.get("size_bytes", 0),
        "sizeBytes": asset.get("size_bytes", 0),
        "mime_type": asset.get("mime_type"),
        "mimeType": asset.get("mime_type"),
        "duration_sec": asset.get("duration_sec", 0),
        "durationSec": asset.get("duration_sec", 0),
        "width": asset.get("width", 0),
        "height": asset.get("height", 0),
    }


def _register_board_output_asset(
    source_path: Path,
    *,
    job: dict[str, Any],
    kind: str,
    stage: str,
    original_name: str | None = None,
) -> dict[str, Any]:
    if not source_path.exists() or not source_path.is_file():
        return {}

    user_id = str(job.get("userId") or job.get("user_id") or job.get("creditUserId") or "").strip()
    if not user_id:
        return {}

    project_id = _clean_project_id(job.get("projectId")) or _clean_project_id(job.get("project_id"))
    asset_id = make_id("asset")
    suffix = source_path.suffix.lower() or (".png" if kind == "image" else ".mp4")
    scope_dir = Path("projects") / project_id if project_id else Path("workspace")
    target_dir = _settings_storage_path() / "users" / user_id / scope_dir / "assets" / stage
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / f"{asset_id}{suffix}"
    shutil.copy2(source_path, target_path)

    size_bytes = target_path.stat().st_size if target_path.exists() else 0
    if size_bytes <= 0:
        target_path.unlink(missing_ok=True)
        return {}

    asset = {
        "id": asset_id,
        "user_id": user_id,
        "project_id": project_id,
        "stage": stage,
        "kind": kind,
        "original_name": _safe_name(original_name or source_path.name, source_path.name),
        "mime_type": _guess_output_mime(target_path, kind),
        "size_bytes": size_bytes,
        "storage_path": target_path.as_posix(),
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "source_static_path": str(source_path),
        "scene_id": job.get("sceneId") or job.get("scene_id") or "",
    }

    if kind == "video":
        duration = _ffprobe_duration(target_path)
        if duration:
            asset["duration_sec"] = duration
    try:
        # Width/height are optional; keep the job resilient if ffprobe is missing.
        pass
    except Exception:
        pass

    def op(db):
        db.setdefault("assets", {})[asset_id] = asset
        return _asset_public_ref(asset)

    public = store.update(op)
    print("[BOARD OUTPUT ASSET REGISTERED]", {
        "jobId": job.get("jobId"),
        "sceneId": asset.get("scene_id"),
        "assetId": asset_id,
        "apiPath": public.get("asset_api_path"),
        "kind": kind,
        "stage": stage,
    }, flush=True)
    return public


def _workflow_info(path: Path) -> dict[str, Any]:
    exists = path.exists() and path.is_file()
    return {
        "name": path.name,
        "exists": exists,
        "sizeBytes": path.stat().st_size if exists else 0,
        "path": str(path.relative_to(APP_DIR)) if exists else str(path),
    }


def _safe_name(value: str | None, fallback: str = "scene") -> str:
    text = Path(str(value or fallback)).name
    text = re.sub(r'[^\w.()\- ]+', "_", text, flags=re.UNICODE).strip(" .")
    text = re.sub(r"\s+", "_", text)
    return text or fallback


def _asset_by_id(asset_id: str | None) -> dict[str, Any] | None:
    if not asset_id:
        return None
    try:
        return store.get_db().get("assets", {}).get(asset_id)
    except Exception:
        return None


def _asset_id_from_text(value: str | None) -> str | None:
    if not value:
        return None
    match = re.search(r"/assets/([^/]+)/file", value)
    if match:
        return match.group(1)
    if value.startswith("asset_"):
        return value
    return None


def _resolve_local_file(value: str | None = None, *, asset_id: str | None = None) -> Path:
    explicit_asset_id = asset_id or _asset_id_from_text(value)
    asset = _asset_by_id(explicit_asset_id)
    if asset:
        path = _asset_file_path_from_record(asset)
        if path and path.exists() and path.is_file():
            return path

    if not value:
        raise HTTPException(status_code=400, detail="Missing file URL/path")

    raw = str(value).strip()

    # AVA_RESOLVE_API_STATIC_V203J:
    # Support both canonical /static/... and compatibility /api/static/...
    # for extracted frame URLs.
    if raw.startswith("/api/static/"):
        path = _settings_static_path() / raw[len("/api/static/") :]
        if path.exists() and path.is_file():
            return path

    if raw.startswith("/static/"):
        path = _settings_static_path() / raw[len("/static/") :]
        if path.exists() and path.is_file():
            return path

    # AVA_LAST_FRAME_V4_RESOLVE_STATIC_URL
    parsed_url = urllib.parse.urlparse(raw)
    if parsed_url.scheme in {"http", "https"} and parsed_url.path.startswith("/api/static/"):
        path = _settings_static_path() / parsed_url.path[len("/api/static/") :]
        if path.exists() and path.is_file():
            return path

    if parsed_url.scheme in {"http", "https"} and parsed_url.path.startswith("/static/"):
        path = _settings_static_path() / parsed_url.path[len("/static/") :]
        if path.exists() and path.is_file():
            return path

    public_base = _settings_public_base_url()
    if public_base and raw.startswith(public_base):
        tail = raw[len(public_base) :]
        if tail.startswith("/static/"):
            path = _settings_static_path() / tail[len("/static/") :]
            if path.exists() and path.is_file():
                return path
        asset_id_from_url = _asset_id_from_text(tail)
        asset = _asset_by_id(asset_id_from_url)
        if asset:
            path = _asset_file_path_from_record(asset)
            if path and path.exists() and path.is_file():
                return path

    path = Path(raw)
    if path.exists() and path.is_file():
        return path

    raise HTTPException(status_code=404, detail=f"File not found for URL/path: {raw}")


def _local_file_or_download(value: str | None = None, *, asset_id: str | None = None) -> Path:
    try:
        return _resolve_local_file(value, asset_id=asset_id)
    except HTTPException:
        raw = str(value or "").strip()
        if not raw.startswith("http://") and not raw.startswith("https://"):
            raise

        suffix = Path(urllib.parse.urlparse(raw).path).suffix or ".bin"
        tmp = Path(tempfile.gettempdir()) / f"ava_comfy_upload_{uuid4().hex}{suffix}"
        try:
            with urllib.request.urlopen(raw, timeout=30) as response:
                tmp.write_bytes(response.read())
            return tmp
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Cannot download media URL for Comfy upload: {exc}") from exc



def _data_url_to_temp_file(data_url: str | None, *, fallback_ext: str = ".bin") -> Path:
    raw = str(data_url or "").strip()
    if not raw.startswith("data:"):
        raise HTTPException(status_code=400, detail="Invalid data URL")

    try:
        header, payload = raw.split(",", 1)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid data URL format") from exc

    mime = "application/octet-stream"
    if ";" in header:
        mime = header[5:].split(";", 1)[0] or mime
    elif header.startswith("data:"):
        mime = header[5:] or mime

    ext_map = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/webp": ".webp",
        "audio/mpeg": ".mp3",
        "audio/mp3": ".mp3",
        "audio/wav": ".wav",
        "audio/x-wav": ".wav",
    }
    ext = ext_map.get(mime, fallback_ext)

    try:
        data = base64.b64decode(payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Cannot decode data URL") from exc

    tmp = Path(tempfile.gettempdir()) / f"ava_dataurl_{uuid4().hex}{ext}"
    tmp.write_bytes(data)
    return tmp


def _local_file_or_data_url(
    value: str | None = None,
    *,
    data_url: str | None = None,
    asset_id: str | None = None,
    fallback_ext: str = ".bin",
) -> Path:
    if data_url:
        return _data_url_to_temp_file(data_url, fallback_ext=fallback_ext)
    return _local_file_or_download(value, asset_id=asset_id)


def _run_ffmpeg(args: list[str]) -> None:
    exe = shutil.which("ffmpeg")
    if not exe:
        raise HTTPException(status_code=500, detail="ffmpeg_not_found")
    result = subprocess.run([exe, *args], text=True, capture_output=True)
    if result.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail={"code": "ffmpeg_failed", "stderr": (result.stderr or "")[-2000:]},
        )


def _public_static_url(relative_path: str) -> dict[str, str]:
    rel = relative_path.replace("\\", "/").lstrip("/")
    local_path = f"/static/{rel}"
    base = _settings_public_base_url()
    return {
        "url": f"{base}{local_path}" if base else local_path,
        "apiPath": local_path,
        "staticPath": local_path,
    }


def _target_duration(payload: VideoStartIn | MmaudioStartIn) -> float:
    value = (
        getattr(payload, "target_duration_sec", None)
        if getattr(payload, "target_duration_sec", None) is not None
        else getattr(payload, "targetDurationSec", None)
        if getattr(payload, "targetDurationSec", None) is not None
        else getattr(payload, "duration_sec", None)
        if getattr(payload, "duration_sec", None) is not None
        else getattr(payload, "durationSec", None)
    )
    try:
        parsed = float(value or 0)
    except Exception:
        parsed = 0.0
    return max(0.1, parsed)


def _generation_duration(route: str, target_duration: float) -> float:
    route_key = (route or "i2v").strip()
    if route_key in {"i2v", "i2v_text", "i2v_sound", "ia2v", "ia2v_lipsync", "ia2v_instrumental", "lip_sync"}:
        return round(target_duration + 1.0, 3)
    return round(target_duration, 3)


def _video_credit_cost(route: str) -> int:
    route_key = (route or "i2v").strip()
    if route_key.startswith("first_last"):
        return 2
    return int(VIDEO_ROUTE_CREDIT_COSTS.get(route_key, 1))


def _http_json_status(base_url: str) -> dict[str, Any]:
    if not base_url:
        return {"configured": False, "ok": False, "error": "missing_url"}

    target = f"{base_url.rstrip('/')}/system_stats"
    try:
        request = urllib.request.Request(target, headers={"Accept": "application/json"})
        with urllib.request.urlopen(request, timeout=3) as response:
            text = response.read(20000).decode("utf-8", errors="replace")
            try:
                data = json.loads(text)
            except Exception:
                data = {"raw": text[:500]}
            return {
                "configured": True,
                "ok": True,
                "url": base_url,
                "systemStatsUrl": target,
                "statusCode": getattr(response, "status", 200),
                "data": data,
            }
    except urllib.error.HTTPError as exc:
        return {"configured": True, "ok": False, "url": base_url, "systemStatsUrl": target, "statusCode": exc.code, "error": str(exc)}
    except Exception as exc:
        return {"configured": True, "ok": False, "url": base_url, "systemStatsUrl": target, "error": str(exc)}


def _load_workflow(workflow_key: str) -> dict[str, Any]:
    path = WORKFLOWS_DIR / workflow_key
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Workflow not found: {workflow_key}")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Workflow JSON parse failed: {workflow_key}: {exc}") from exc


def _comfy_upload_file(base_url: str, file_path: Path, *, subfolder: str = "ava_studio") -> dict[str, Any]:
    boundary = "----avaStudioBoundary" + uuid4().hex
    filename = _safe_name(file_path.name, "media.bin")
    mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"

    fields: list[tuple[str, str | tuple[str, bytes, str]]] = [
        ("type", "input"),
        ("subfolder", subfolder),
        ("overwrite", "true"),
        ("image", (filename, file_path.read_bytes(), mime)),
    ]

    body = bytearray()
    for name, value in fields:
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        if isinstance(value, tuple):
            fname, data, content_type = value
            body.extend(
                f'Content-Disposition: form-data; name="{name}"; filename="{fname}"\r\n'
                f"Content-Type: {content_type}\r\n\r\n".encode("utf-8")
            )
            body.extend(data)
            body.extend(b"\r\n")
        else:
            body.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode("utf-8"))
    body.extend(f"--{boundary}--\r\n".encode("utf-8"))

    request = urllib.request.Request(
        f"{base_url.rstrip()}/upload/image",
        data=bytes(body),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            raw = response.read().decode("utf-8", errors="replace")
            data = json.loads(raw) if raw else {}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Comfy upload failed for {filename}: {exc}") from exc

    uploaded_name = data.get("name") or filename
    uploaded_subfolder = data.get("subfolder") or subfolder
    uploaded_type = data.get("type") or "input"
    return {
        "filename": uploaded_name,
        "name": uploaded_name,
        "subfolder": uploaded_subfolder,
        "type": uploaded_type,
        "mime": mime,
        "sourcePath": str(file_path),
        "raw": data,
        "comfyInputRef": f"{uploaded_subfolder}/{uploaded_name}" if uploaded_subfolder else uploaded_name,
    }


def _is_api_prompt(workflow: dict[str, Any]) -> bool:
    return all(isinstance(v, dict) and "inputs" in v for v in workflow.values())


def _node_items(workflow: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    if _is_api_prompt(workflow):
        return [(str(k), v) for k, v in workflow.items() if isinstance(v, dict)]
    nodes = workflow.get("nodes")
    if isinstance(nodes, list):
        return [(str(node.get("id", idx)), node) for idx, node in enumerate(nodes) if isinstance(node, dict)]
    return []


def _set_node_input(node: dict[str, Any], key: str, value: Any) -> bool:
    if "inputs" in node and isinstance(node["inputs"], dict):
        node["inputs"][key] = value
        return True
    return False


def _workflow_inspect_data(workflow: dict[str, Any]) -> dict[str, Any]:
    nodes = []
    for node_id, node in _node_items(workflow):
        inputs = node.get("inputs") if isinstance(node.get("inputs"), dict) else {}
        nodes.append({
            "id": node_id,
            "class_type": node.get("class_type") or node.get("type" ) or "",
            "title": node.get("_meta", {}).get("title") or node.get("title") or "",
            "inputKeys": list(inputs.keys()) if isinstance(inputs, dict) else [],
            "inputsPreview": {k: inputs.get(k) for k in list(inputs.keys())[:12]} if isinstance(inputs, dict) else {},
        })
    return {"format": "api_prompt" if _is_api_prompt(workflow) else "ui_workflow_or_unknown", "nodeCount": len(nodes), "nodes": nodes}


def _inject_workflow(
    workflow: dict[str, Any],
    *,
    positive_prompt: str,
    negative_prompt: str,
    width: int,
    height: int,
    target_duration: float,
    generation_duration: float,
    uploaded_image: dict[str, Any] | None,
    uploaded_start: dict[str, Any] | None,
    uploaded_end: dict[str, Any] | None,
    uploaded_audio: dict[str, Any] | None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    # SAFETY RULE:
    # Do not generic-patch workflow links.
    #
    # In Comfy API workflows, many inputs are links like ["node_id", 0].
    # Replacing those links with strings corrupts the graph and causes errors like:
    #   AttributeError: 'str' object has no attribute 'shape'
    #
    # For now we only patch known exact nodes for specific LTX workflows.
    # ia2v exact nodes: image/audio/prompt/size/duration.
    # i2v exact nodes: image/prompt/size/frame-length.
    # first_last exact nodes: start image/end image/prompt/size/duration.
    # Other workflows will get their own exact maps later.
    patched = copy.deepcopy(workflow)

    exact_patches = _apply_known_ltx_node_patches(
        patched,
        positive_prompt=positive_prompt,
        negative_prompt=negative_prompt,
        width=width,
        height=height,
        generation_duration=generation_duration,
        uploaded_image=uploaded_image,
        uploaded_start=uploaded_start,
        uploaded_end=uploaded_end,
        uploaded_audio=uploaded_audio,
    )

    return patched, exact_patches


def _apply_known_ltx_node_patches(
    patched: dict[str, Any],
    *,
    positive_prompt: str,
    negative_prompt: str,
    width: int,
    height: int,
    generation_duration: float,
    uploaded_image: dict[str, Any] | None,
    uploaded_start: dict[str, Any] | None,
    uploaded_end: dict[str, Any] | None,
    uploaded_audio: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    exact_patches: list[dict[str, Any]] = []

    image_ref = (uploaded_image or uploaded_start or {}).get("comfyInputRef") or (uploaded_image or uploaded_start or {}).get("filename")
    start_ref = (uploaded_start or uploaded_image or {}).get("comfyInputRef") or (uploaded_start or uploaded_image or {}).get("filename")
    audio_ref = (uploaded_audio or {}).get("comfyInputRef") or (uploaded_audio or {}).get("filename")

    try:
        i2v_length_frames = max(1, int(round(float(generation_duration) * 24)) + 1)
    except Exception:
        i2v_length_frames = 121

    def patch(node_id: str, key: str, value: Any, reason: str) -> None:
        node = patched.get(node_id)
        if not isinstance(node, dict):
            return
        inputs = node.get("inputs")
        if not isinstance(inputs, dict):
            return
        if key not in inputs:
            return
        inputs[key] = value
        exact_patches.append({
            "nodeId": node_id,
            "input": key,
            "reason": reason,
            "valuePreview": str(value)[:180],
        })

    # Exact text-to-image workflow nodes.
    patch("57:27", "text", positive_prompt, "exact_txt2img_positive_prompt_57_27")
    patch("57:62", "text", negative_prompt, "exact_txt2img_negative_prompt_57_62")
    patch("57:13", "width", int(width), "exact_txt2img_width_57_13")
    patch("57:13", "height", int(height), "exact_txt2img_height_57_13")
    patch("57:3", "seed", int(datetime.utcnow().timestamp() * 1000) % 999999999999999, "exact_txt2img_random_seed_57_3")
    patch("9", "filename_prefix", "ava_text_to_image", "exact_txt2img_output_prefix_9")

    # Exact ia2v LTX 2.3 workflow nodes.
    if start_ref or image_ref:
        patch("269", "image", start_ref or image_ref, "exact_load_image_269")

    if audio_ref:
        patch("276", "audio", audio_ref, "exact_load_audio_276")
        patch("276", "audioUI", "", "exact_clear_audio_ui_276")

    patch("340:319", "value", positive_prompt, "exact_positive_prompt_340_319")
    patch("340:314", "text", negative_prompt, "exact_negative_prompt_340_314")
    patch("340:330", "value", int(width), "exact_width_340_330")
    patch("340:324", "value", int(height), "exact_height_340_324")
    patch("340:331", "value", float(generation_duration), "exact_duration_plus1_340_331")

    # Exact i2v / i2v_sound LTX 2.3 workflow nodes.
    #
    # image-video.json and image-video-golos-zvuk.json:
    #   269.image       = uploaded image
    #   267:266.value   = positive prompt string
    #   267:247.text    = negative prompt
    #   267:257.value   = width
    #   267:258.value   = height
    #   267:225.value   = length in frames
    #
    # The workflow default is 720x1280, so without these exact patches
    # a horizontal 16:9 upload can still render as vertical.
    patch("267:266", "value", positive_prompt, "exact_i2v_positive_prompt_267_266")
    patch("267:247", "text", negative_prompt, "exact_i2v_negative_prompt_267_247")
    patch("267:257", "value", int(width), "exact_i2v_width_267_257")
    patch("267:258", "value", int(height), "exact_i2v_height_267_258")
    patch("267:225", "value", int(i2v_length_frames), "exact_i2v_length_frames_267_225")

    # Exact first_last LTX 2.3 workflow nodes.
    #
    # last-first cadr-NO sound.json:
    #   138.image     = start frame
    #   137.image     = end frame
    #   139:128.text  = positive prompt
    #   139:112.text  = negative prompt
    #   139:113.value = width
    #   139:98.value  = height
    #   139:143.value = duration in seconds
    #
    # This is intentionally exact-only. Do not generic-patch graph links.
    end_ref = (uploaded_end or {}).get("comfyInputRef") or (uploaded_end or {}).get("filename")
    if start_ref:
        patch("138", "image", start_ref, "exact_first_last_start_image_138")
    if end_ref:
        patch("137", "image", end_ref, "exact_first_last_end_image_137")
    patch("139:128", "text", positive_prompt, "exact_first_last_positive_prompt_139_128")
    patch("139:112", "text", negative_prompt, "exact_first_last_negative_prompt_139_112")
    patch("139:113", "value", int(width), "exact_first_last_width_139_113")
    patch("139:98", "value", int(height), "exact_first_last_height_139_98")
    patch("139:143", "value", float(generation_duration), "exact_first_last_duration_139_143")

    return exact_patches


def _submit_prompt(base_url: str, prompt: dict[str, Any]) -> dict[str, Any]:
    body = json.dumps({"prompt": prompt, "client_id": f"ava-studio-{uuid4().hex}"}).encode("utf-8")
    request = urllib.request.Request(
        f"{base_url.rstrip()}/prompt",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            raw = response.read().decode("utf-8", errors="replace")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        err = exc.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=502, detail={"code": "comfy_prompt_failed", "status": exc.code, "body": err[-4000:]}) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Comfy prompt request failed: {exc}") from exc


def _history(base_url: str, prompt_id: str) -> dict[str, Any]:
    try:
        with urllib.request.urlopen(f"{base_url.rstrip()}/history/{urllib.parse.quote(prompt_id)}", timeout=30) as response:
            raw = response.read().decode("utf-8", errors="replace")
            return json.loads(raw) if raw else {}
    except Exception as exc:
        return {"_history_error": str(exc)}


# AVA_GENERATOR_CANCEL_SAFE_V84: real cancel/interrupt helpers for Generator.
def _comfy_post_json(base_url: str, path: str, payload: dict[str, Any] | None = None, *, timeout: int = 12) -> dict[str, Any]:
    body = json.dumps(payload or {}).encode("utf-8")
    request = urllib.request.Request(
        f"{base_url.rstrip()}{path}",
        data=body,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8", errors="replace")
            return json.loads(raw) if raw else {"ok": True}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def _comfy_get_json(base_url: str, path: str, *, timeout: int = 12) -> dict[str, Any]:
    request = urllib.request.Request(f"{base_url.rstrip()}{path}", headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8", errors="replace")
            return json.loads(raw) if raw else {}
    except Exception as exc:
        return {"_error": str(exc)}


def _comfy_queue_prompt_ids(queue_data: Any) -> list[str]:
    ids: list[str] = []

    def walk(value: Any) -> None:
        if isinstance(value, dict):
            for key in ("prompt_id", "promptId"):
                if value.get(key):
                    ids.append(str(value.get(key)))
            for item in value.values():
                walk(item)
        elif isinstance(value, (list, tuple)):
            # Comfy queue rows usually contain prompt id as one of string members.
            for item in value:
                if isinstance(item, str) and len(item) >= 16 and re.fullmatch(r"[0-9a-fA-F\-]+", item):
                    ids.append(item)
                walk(item)

    walk(queue_data)
    deduped: list[str] = []
    seen: set[str] = set()
    for pid in ids:
        if pid not in seen:
            seen.add(pid)
            deduped.append(pid)
    return deduped


def _cancel_comfy_prompt(base_url: str, prompt_id: str | None = None, *, interrupt: bool = True, clear_pending: bool = False) -> dict[str, Any]:
    result: dict[str, Any] = {"baseUrl": base_url, "promptId": prompt_id or "", "queueDelete": None, "interrupt": None, "clearPending": None}
    if not base_url:
        result["error"] = "missing_comfy_base_url"
        return result

    prompt_ids: list[str] = []
    if prompt_id:
        prompt_ids.append(str(prompt_id))

    if clear_pending:
        queue = _comfy_get_json(base_url, "/queue")
        discovered = _comfy_queue_prompt_ids(queue)
        for pid in discovered:
            if pid not in prompt_ids:
                prompt_ids.append(pid)
        if prompt_ids:
            result["clearPending"] = _comfy_post_json(base_url, "/queue", {"delete": prompt_ids})
        else:
            result["clearPending"] = {"ok": True, "deleted": []}
    elif prompt_ids:
        result["queueDelete"] = _comfy_post_json(base_url, "/queue", {"delete": prompt_ids})

    if interrupt:
        result["interrupt"] = _comfy_post_json(base_url, "/interrupt", {})
    return result


def _extract_comfy_outputs(base_url: str, history_data: dict[str, Any]) -> list[dict[str, Any]]:
    outputs: list[dict[str, Any]] = []
    for prompt_id, item in history_data.items():
        if not isinstance(item, dict):
            continue
        for node_id, node_output in (item.get("outputs") or {}).items():
            if not isinstance(node_output, dict):
                continue
            for group_name, files in node_output.items():
                if not isinstance(files, list):
                    continue
                for file_info in files:
                    if not isinstance(file_info, dict):
                        continue
                    filename = file_info.get("filename")
                    if not filename:
                        continue
                    subfolder = file_info.get("subfolder", "")
                    ftype = file_info.get("type", "output")
                    query = urllib.parse.urlencode({"filename": filename, "subfolder": subfolder, "type": ftype})
                    outputs.append({"promptId": prompt_id, "nodeId": node_id, "group": group_name, "filename": filename, "subfolder": subfolder, "type": ftype, "url": f"{base_url.rstrip()}/view?{query}"})
    return outputs


@router.get("/clip/ltx/ping")
def ping() -> dict[str, Any]:
    return {"ok": True, "route": "ltx_board", "workflowsDir": str(WORKFLOWS_DIR), "workflowsDirExists": WORKFLOWS_DIR.exists(), "mainComfyBaseUrlConfigured": bool(_main_comfy_url()), "mmaudioComfyBaseUrlConfigured": bool(_mmaudio_comfy_url())}


@router.get("/clip/ltx/tariffs")
def ltx_tariffs() -> dict[str, Any]:
    return {"ok": True, "videoRouteCreditCosts": VIDEO_ROUTE_CREDIT_COSTS, "txt2imgQualityCreditCosts": TXT2IMG_QUALITY_CREDIT_COSTS, "mmaudioCreditCost": MMAUDIO_CREDIT_COST, "boardAssemblyCreditCosts": {"export": BOARD_ASSEMBLY_EXPORT_CREDIT_COST, "music": BOARD_ASSEMBLY_MUSIC_CREDIT_COST, "watermark": BOARD_ASSEMBLY_WATERMARK_CREDIT_COST}, "chargeMode": "preflight_balance_check_then_charge_after_success"}


@router.get("/clip/ltx/comfy-status")
def comfy_status() -> dict[str, Any]:
    return {"ok": True, "main": {"label": "main_ltx", "expectedPort": 8000, **_http_json_status(_main_comfy_url())}, "mmaudio": {"label": "mmaudio_lab", "expectedPort": 8001, **_http_json_status(_mmaudio_comfy_url())}}


@router.get("/clip/ltx/workflows")
def list_ltx_workflows() -> dict[str, Any]:
    WORKFLOWS_DIR.mkdir(parents=True, exist_ok=True)
    files = sorted(WORKFLOWS_DIR.glob("*.json"))
    workflow_files = [_workflow_info(path) for path in files]
    route_map = {route: {**_workflow_info(WORKFLOWS_DIR / filename), "route": route, "workflowKey": filename} for route, filename in WORKFLOW_ROUTE_MAP.items()}
    main_url = _main_comfy_url()
    mmaudio_url = _mmaudio_comfy_url()
    return {"ok": True, "source": "backend/app/workflows", "workflowsDir": str(WORKFLOWS_DIR), "count": len(workflow_files), "workflows": workflow_files, "routeMap": route_map, "comfyBaseUrlConfigured": bool(main_url), "comfyBaseUrl": main_url, "mainComfyBaseUrlConfigured": bool(main_url), "mainComfyBaseUrl": main_url, "mmaudioComfyBaseUrlConfigured": bool(mmaudio_url), "mmaudioComfyBaseUrl": mmaudio_url, "publicBaseUrl": _settings_public_base_url(), "tariffs": {"videoRouteCreditCosts": VIDEO_ROUTE_CREDIT_COSTS, "mmaudioCreditCost": MMAUDIO_CREDIT_COST}}



@router.get("/clip/ltx/workflow-inspect")
def workflow_inspect_default() -> dict[str, Any]:
    return workflow_inspect("ia2v")


@router.get("/clip/ltx/workflow-inspect/{route}")
def workflow_inspect(route: str) -> dict[str, Any]:
    workflow_key = WORKFLOW_ROUTE_MAP.get(route, route)
    if not workflow_key.endswith(".json"):
        workflow_key = WORKFLOW_ROUTE_MAP.get(route, WORKFLOW_ROUTE_MAP["i2v"])
    workflow = _load_workflow(workflow_key)
    return {"ok": True, "route": route, "workflowKey": workflow_key, **_workflow_inspect_data(workflow)}


@router.post("/manual-clip/slice-audio")
def slice_audio(payload: SliceAudioIn) -> dict[str, Any]:
    start = payload.start_sec if payload.start_sec is not None else payload.startSec
    end = payload.end_sec if payload.end_sec is not None else payload.endSec
    duration = payload.duration_sec if payload.duration_sec is not None else payload.durationSec
    try:
        start_f = max(0.0, float(start or 0))
        if end is not None:
            end_f = max(start_f, float(end))
            duration_f = max(0.05, end_f - start_f)
        else:
            duration_f = max(0.05, float(duration or 0))
            end_f = start_f + duration_f
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid start/end/duration")
    # AVA_BOARD_MASTER_AUDIO_MANUAL_SLICE_V199I:
    # Manual "изъять аудио" must follow the same authority as server batch:
    # use master/mixed song audio, never the vocal-ASR stem. If the Board root
    # audio ref is stale/missing/vocal-only, fall back to project audio assets.
    project_id_for_audio_v199i = str(payload.project_id or payload.projectId or "").strip()
    source_value = payload.audio_url or payload.audioUrl or payload.audio_asset_api_path or payload.audioAssetApiPath
    source_asset_id = payload.audio_asset_id or payload.audioAssetId or payload.asset_id or payload.assetId
    source_path = None
    source_errors_v199i: list[dict[str, str]] = []

    def _manual_slice_source_candidate_v199i() -> dict[str, str]:
        return {
            "source": "manual_slice.payload_v199i",
            "ref": str(source_value or ""),
            "asset_id": str(source_asset_id or ""),
        }

    if source_value or source_asset_id:
        try:
            candidate_v199i = _manual_slice_source_candidate_v199i()
            resolved_v199i = _resolve_local_file(source_value, asset_id=source_asset_id)
            if _board_batch_audio_candidate_is_vocal_only_v199g(candidate_v199i, resolved_v199i):
                source_errors_v199i.append({
                    "source": candidate_v199i.get("source", "manual_slice.payload_v199i"),
                    "ref": candidate_v199i.get("ref", ""),
                    "asset_id": candidate_v199i.get("asset_id", ""),
                    "path": str(resolved_v199i),
                    "error": "vocal_only_asr_stem_rejected_v199i",
                })
                print("[BOARD MANUAL SLICE VOCAL STEM REJECTED V199I]", {
                    "project_id": project_id_for_audio_v199i,
                    "ref": candidate_v199i.get("ref", ""),
                    "asset_id": candidate_v199i.get("asset_id", ""),
                    "path": str(resolved_v199i),
                }, flush=True)
            else:
                source_path = resolved_v199i
        except Exception as exc:
            source_errors_v199i.append({
                "source": "manual_slice.payload_v199i",
                "ref": str(source_value or ""),
                "asset_id": str(source_asset_id or ""),
                "error": str(exc),
            })

    if source_path is None:
        if not project_id_for_audio_v199i:
            first_error_v199i = source_errors_v199i[0].get("error") if source_errors_v199i else "missing_audio_source"
            raise HTTPException(status_code=404, detail=f"No usable master audio source for manual slice; {first_error_v199i}")
        master_path_v199i, master_ref_v199i, master_asset_id_v199i, master_errors_v199i = _board_batch_resolve_master_audio_source_v199g(
            project_id_for_audio_v199i,
            {},
            payload,
        )
        source_path = master_path_v199i
        source_value = master_ref_v199i
        source_asset_id = master_asset_id_v199i
        print("[BOARD MANUAL SLICE MASTER AUDIO SELECTED V199I]", {
            "project_id": project_id_for_audio_v199i,
            "ref": master_ref_v199i,
            "asset_id": master_asset_id_v199i,
            "path": str(master_path_v199i),
            "payload_errors": source_errors_v199i[:6],
            "master_errors": master_errors_v199i[:6],
        }, flush=True)
    static_root = _settings_static_path()
    target_dir = static_root / "assets" / "manual_clip_audio"
    target_dir.mkdir(parents=True, exist_ok=True)
    scene_id = _safe_name(payload.scene_id or payload.sceneId or "scene")
    file_id = uuid4().hex[:12]
    out_name = f"{scene_id}_{start_f:.3f}_{end_f:.3f}_{file_id}.mp3".replace(".", "_", 2)
    out_path = target_dir / out_name
    _run_ffmpeg(["-y", "-ss", f"{start_f:.3f}", "-t", f"{duration_f:.3f}", "-i", str(source_path), "-vn", "-acodec", "libmp3lame", "-ar", "44100", "-ac", "2", "-b:a", "192k", str(out_path)])
    urls = _public_static_url(f"assets/manual_clip_audio/{out_name}")
    return {
        "ok": True,
        "audioSliceUrl": urls["url"],
        "audio_slice_url": urls["url"],
        "audioSliceApiPath": urls["apiPath"],
        "audio_slice_api_path": urls["apiPath"],
        "audioSliceName": out_name,
        "audio_slice_name": out_name,
        "mimeType": "audio/mpeg",
        "startSec": start_f,
        "endSec": end_f,
        "durationSec": duration_f,
        "sourcePath": str(source_path),
        "source": "manual_scene_range_master_audio_v199i",
        "sourceAssetId": source_asset_id or "",
        "source_asset_id": source_asset_id or "",
        "sourceAssetApiPath": source_value or "",
        "source_asset_api_path": source_value or "",
    }


@router.post("/clip/video/extract-last-frame")
def extract_last_frame(payload: ExtractLastFrameIn) -> dict[str, Any]:
    source_value = payload.video_url or payload.videoUrl or getattr(payload, "video_api_path", None) or getattr(payload, "videoApiPath", None) or payload.video_path or payload.videoPath
    source_path = _resolve_local_file(source_value)
    static_root = _settings_static_path()
    target_dir = static_root / "assets" / "board_frames"
    target_dir.mkdir(parents=True, exist_ok=True)
    scene_id = _safe_name(payload.scene_id or payload.sceneId or "scene")
    out_name = f"{scene_id}_last_{uuid4().hex[:12]}.jpg"
    out_path = target_dir / out_name
    try:
        _run_ffmpeg(["-y", "-sseof", "-0.12", "-i", str(source_path), "-frames:v", "1", "-q:v", "2", str(out_path)])
    except HTTPException:
        _run_ffmpeg(["-y", "-sseof", "-1", "-i", str(source_path), "-frames:v", "1", "-q:v", "2", str(out_path)])
    if not out_path.exists() or out_path.stat().st_size <= 0:
        raise HTTPException(status_code=500, detail="extract_last_frame_output_missing_v203j")

    urls = _public_static_url(f"assets/board_frames/{out_name}")
    # AVA_EXTRACT_LAST_FRAME_STATIC_PRIMARY_V203J:
    # Return relative /static path as the primary image URL.
    # This avoids accidental .../api/static/... URLs when public_base_url was configured with /api.
    return {
        "ok": True,
        "imageUrl": urls["apiPath"],
        "image_url": urls["apiPath"],
        "imageApiPath": urls["apiPath"],
        "image_api_path": urls["apiPath"],
        "imageStaticUrl": urls["url"],
        "image_static_url": urls["url"],
        "staticPath": urls["staticPath"],
        "static_path": urls["staticPath"],
        "imageName": out_name,
        "image_name": out_name,
        "sourcePath": str(source_path),
        "sourceSceneId": payload.source_scene_id or payload.sourceSceneId or "",
    }


@router.post("/clip/video/start")
def start_video(payload: VideoStartIn, user: dict = Depends(get_current_user)) -> dict[str, Any]:
    route = (payload.route or "i2v").strip() or "i2v"
    # AVA_BOARD_BATCH_AUDIO_WAV_ROUTE_LOCK_V193A:
    # Route is the source of truth for every built-in Board route. A stale
    # scene.workflow_key from an earlier route must not override the selected
    # route, otherwise image/audio/workflow can get mixed between scenes.
    workflow_key = WORKFLOW_ROUTE_MAP.get(route) or payload.workflow_key or payload.workflowKey or WORKFLOW_ROUTE_MAP["i2v"]
    workflow_path = WORKFLOWS_DIR / workflow_key
    target_duration = _target_duration(payload)
    generation_duration = _generation_duration(route, target_duration)

    # AVA_GENERATOR_STRICT_BACKEND_PREFLIGHT_V203K:
    # Defense-in-depth for Generator/Board direct calls.
    # Missing inputs must not create a job and must not upload anything to Comfy.
    positive_prompt_preflight_v203k = (
        payload.video_prompt or payload.videoPrompt or payload.positive_prompt or payload.positivePrompt or ""
    )
    start_ref_preflight_v203k = (
        payload.start_image_url or payload.startImageUrl or payload.image_url or payload.imageUrl or
        payload.start_image_data_url or payload.startImageDataUrl or payload.image_data_url or payload.imageDataUrl or ""
    )
    end_ref_preflight_v203k = (
        payload.end_image_url or payload.endImageUrl or payload.end_image_data_url or payload.endImageDataUrl or ""
    )
    audio_ref_preflight_v203k = (
        payload.audio_slice_url or payload.audioSliceUrl or payload.audio_data_url or payload.audioDataUrl or ""
    )
    preflight_missing_v203k: list[str] = []
    if not str(positive_prompt_preflight_v203k or "").strip():
        preflight_missing_v203k.append("prompt")
    if (not _is_image_generation_route(route)) and (
        route in {"i2v", "ia2v", "ia2v_lipsync", "ia2v_instrumental", "lip_sync", "i2v_sound", "i2v_text", "first_last", "first_last_sound"}
        or route.startswith("first_last")
    ) and not str(start_ref_preflight_v203k or "").strip():
        preflight_missing_v203k.append("start_image")
    if route.startswith("first_last") and not str(end_ref_preflight_v203k or "").strip():
        preflight_missing_v203k.append("end_image")
    if route.startswith("first_last"):
        start_cmp_v203k = str(start_ref_preflight_v203k or "").strip()
        end_cmp_v203k = str(end_ref_preflight_v203k or "").strip()
        if start_cmp_v203k and end_cmp_v203k and start_cmp_v203k == end_cmp_v203k:
            preflight_missing_v203k.append("different_end_image")
    if route in {"ia2v", "ia2v_lipsync", "ia2v_instrumental", "lip_sync"} and not str(audio_ref_preflight_v203k or "").strip():
        preflight_missing_v203k.append("audio_slice")
    if preflight_missing_v203k:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "generator_preflight_missing_inputs_v203k",
                "route": route,
                "missing": preflight_missing_v203k,
                "message": "Required generator inputs are missing; request was not submitted to Comfy.",
            },
        )

    credit_cost = _video_credit_cost_for_payload(route, payload)
    project_id_for_credit = _clean_project_id(payload.project_id) or _clean_project_id(payload.projectId)
    if project_id_for_credit:
        ensure_project_access(project_id_for_credit, user)
    _ava_credit_require_balance(user, credit_cost)
    job_id = f"boardjob_{uuid4().hex[:14]}"
    now = datetime.utcnow().isoformat() + "Z"
    main_url = _main_comfy_url()
    if not main_url:
        status = "blocked_missing_comfy_base_url"
        job = {"jobId": job_id, "status": status, "createdAt": now, "updatedAt": now, "sceneId": payload.scene_id or payload.sceneId, "projectId": project_id_for_credit, "project_id": project_id_for_credit, "route": route, "workflowKey": workflow_key, "workflowExists": workflow_path.exists(), "targetComfy": "main_ltx", "targetDurationSec": target_duration, "generationDurationSec": generation_duration, "trimToDurationSec": target_duration, "plusOneSecondApplied": generation_duration > target_duration, "creditCost": credit_cost, "creditCharged": False, "imageQuality": _txt2img_quality_from_payload(payload), "image_quality": _txt2img_quality_from_payload(payload), "payload": payload.model_dump()}
        _ava_credit_attach_job_user(job, user)
        _board_video_job_store(job_id, job)
        return {"ok": True, "jobId": job_id, "job_id": job_id, "status": status, "statusEndpoint": f"/api/clip/video/status/{job_id}", **job}
    workflow = _load_workflow(workflow_key)
    start_url = payload.start_image_url or payload.startImageUrl or payload.image_url or payload.imageUrl
    image_url = payload.image_url or payload.imageUrl or start_url
    end_url = payload.end_image_url or payload.endImageUrl
    audio_url = payload.audio_slice_url or payload.audioSliceUrl
    image_data_url = payload.image_data_url or payload.imageDataUrl
    start_data_url = payload.start_image_data_url or payload.startImageDataUrl or image_data_url
    end_data_url = payload.end_image_data_url or payload.endImageDataUrl
    audio_data_url = payload.audio_data_url or payload.audioDataUrl

    # AVA_LAST_FRAME_V4_BLOCK_REQUIRED_MEDIA
    requires_start_image = (not _is_image_generation_route(route)) and (route in {"i2v", "ia2v", "ia2v_lipsync", "ia2v_instrumental", "lip_sync", "i2v_sound", "i2v_text", "first_last", "first_last_sound"} or route.startswith("first_last"))
    requires_end_image = route.startswith("first_last")
    requires_audio_slice = route in {"ia2v", "ia2v_lipsync", "ia2v_instrumental", "lip_sync"}
    missing_media = []
    if requires_start_image and not (start_url or image_url or start_data_url or image_data_url):
        missing_media.append("start_image")
    if requires_end_image and not (end_url or end_data_url):
        missing_media.append("end_image")
    if requires_audio_slice and not (audio_url or audio_data_url):
        missing_media.append("audio_slice")
    if missing_media:
        status = "blocked_missing_required_media"
        job = {
            "jobId": job_id,
            "status": status,
            "createdAt": now,
            "updatedAt": now,
            "sceneId": payload.scene_id or payload.sceneId,
            "projectId": project_id_for_credit,
            "project_id": project_id_for_credit,
            "route": route,
            "workflowKey": workflow_key,
            "workflowExists": workflow_path.exists(),
            "targetComfy": "main_ltx",
            "targetComfyBaseUrl": main_url,
            "targetDurationSec": target_duration,
            "generationDurationSec": generation_duration,
            "trimToDurationSec": target_duration,
            "plusOneSecondApplied": generation_duration > target_duration,
            "creditCost": credit_cost,
            "creditCharged": False,
            "error": {"code": status, "missing": missing_media},
            "payload": payload.model_dump(),
        }
        _ava_credit_attach_job_user(job, user)
        _board_video_job_store(job_id, job)
        return {
            "ok": False,
            "jobId": job_id,
            "job_id": job_id,
            "status": status,
            "statusEndpoint": f"/api/clip/video/status/{job_id}",
            "missing": missing_media,
            **job,
        }

    uploaded_image = _comfy_upload_file(main_url, _local_file_or_data_url(image_url, data_url=image_data_url, fallback_ext='.png'), subfolder=f"ava_{job_id}") if (image_url or image_data_url) else None
    uploaded_start = _comfy_upload_file(main_url, _local_file_or_data_url(start_url, data_url=start_data_url, fallback_ext='.png'), subfolder=f"ava_{job_id}") if ((start_url and start_url != image_url) or (start_data_url and start_data_url != image_data_url)) else uploaded_image
    uploaded_end = _comfy_upload_file(main_url, _local_file_or_data_url(end_url, data_url=end_data_url, fallback_ext='.png'), subfolder=f"ava_{job_id}") if (end_url or end_data_url) else None
    uploaded_audio = _comfy_upload_file(main_url, _local_file_or_data_url(audio_url, data_url=audio_data_url, fallback_ext='.mp3'), subfolder=f"ava_{job_id}") if (audio_url or audio_data_url) else None
    # AVA_STAGE78_STRICT_VISIBLE_VIDEO_PROMPT: for Board video generation, video_prompt/videoPrompt is the source of truth.
    # positive_prompt is only a compatibility alias and must not override the visible Board field.
    positive_prompt = payload.video_prompt or payload.videoPrompt or payload.positive_prompt or payload.positivePrompt or ""
    negative_prompt = payload.negative_prompt or payload.negativePrompt or ""
    # AVA_STAGE76_I2V_TEXT_VOICE_ONLY_NEGATIVE
    if route == "i2v_text":
        voice_only_negative = (
            "background music, soundtrack, score, melody, instruments, drums, beat, "
            "singing, choir, extra voices, random speech, gibberish speech, unrelated voice, "
            "subtitles, captions, text on screen"
        )
        negative_prompt = f"{negative_prompt.strip()}, {voice_only_negative}" if negative_prompt.strip() else voice_only_negative
    width = int(payload.width or 1280)
    height = int(payload.height or 720)
    prompt, patches = _inject_workflow(workflow, positive_prompt=positive_prompt, negative_prompt=negative_prompt, width=width, height=height, target_duration=target_duration, generation_duration=generation_duration, uploaded_image=uploaded_image, uploaded_start=uploaded_start, uploaded_end=uploaded_end, uploaded_audio=uploaded_audio)
    submit_data = _submit_prompt(main_url, prompt)
    prompt_id = submit_data.get("prompt_id") or submit_data.get("promptId")
    status = "queued" if prompt_id else "queued_no_prompt_id"
    job = {"jobId": job_id, "status": status, "createdAt": now, "updatedAt": now, "sceneId": payload.scene_id or payload.sceneId, "projectId": project_id_for_credit, "project_id": project_id_for_credit, "route": route, "workflowKey": workflow_key, "workflowExists": workflow_path.exists(), "targetComfy": "main_ltx", "targetComfyBaseUrl": main_url, "promptId": prompt_id, "promptSubmit": submit_data, "workflowPatches": patches, "uploadedMedia": {"image": uploaded_image, "start": uploaded_start, "end": uploaded_end, "audio": uploaded_audio}, "targetDurationSec": target_duration, "generationDurationSec": generation_duration, "trimToDurationSec": target_duration, "plusOneSecondApplied": generation_duration > target_duration, "comfyBaseUrlConfigured": True, "creditCost": credit_cost, "creditCharged": False, "creditChargeMode": "not_charged_until_result_success", "imageQuality": _txt2img_quality_from_payload(payload), "image_quality": _txt2img_quality_from_payload(payload), "payload": payload.model_dump()}
    _ava_credit_attach_job_user(job, user)
    _board_video_job_store(job_id, job)
    return {"ok": True, "jobId": job_id, "job_id": job_id, "status": status, "statusEndpoint": f"/api/clip/video/status/{job_id}", "sceneId": payload.scene_id or payload.sceneId, "projectId": project_id_for_credit, "project_id": project_id_for_credit, "promptId": prompt_id, "workflowKey": workflow_key, "workflowExists": workflow_path.exists(), "targetComfy": "main_ltx", "targetComfyBaseUrl": main_url, "targetDurationSec": target_duration, "generationDurationSec": generation_duration, "trimToDurationSec": target_duration, "plusOneSecondApplied": generation_duration > target_duration, "creditCost": credit_cost, "creditCharged": False, "creditChargeMode": "preflight_ok_charge_after_success", "workflowPatchCount": len(patches), "uploadedMedia": job["uploadedMedia"], "jobStored": True}



def _is_image_output(file_info: dict[str, Any]) -> bool:
    filename = str(file_info.get("filename") or "").lower()
    group = str(file_info.get("group") or "").lower()
    return (
        filename.endswith((".png", ".jpg", ".jpeg", ".webp"))
        or "image" in group
        or "images" in group
    )


def _is_video_output(file_info: dict[str, Any]) -> bool:
    filename = str(file_info.get("filename") or "").lower()
    group = str(file_info.get("group") or "").lower()
    return (
        filename.endswith((".mp4", ".webm", ".mov", ".mkv", ".avi"))
        or "video" in group
        or "gifs" in group
    )


def _download_comfy_output_to_static(base_url: str, output: dict[str, Any], *, job_id: str) -> dict[str, Any]:
    filename = output.get("filename") or f"{job_id}.mp4"
    subfolder = output.get("subfolder", "")
    ftype = output.get("type", "output")
    suffix = Path(filename).suffix or ".mp4"
    suffix_lower = suffix.lower()
    is_image = suffix_lower in {".png", ".jpg", ".jpeg", ".webp"}

    asset_folder = "board_images" if is_image else "board_videos"
    target_dir = _settings_static_path() / "assets" / asset_folder
    target_dir.mkdir(parents=True, exist_ok=True)

    fallback_name = "image.png" if is_image else "video.mp4"
    raw_name = f"{job_id}_{_safe_name(filename, fallback_name)}"
    if not raw_name.lower().endswith(suffix_lower):
        raw_name += suffix
    out_path = target_dir / raw_name

    query = urllib.parse.urlencode({"filename": filename, "subfolder": subfolder, "type": ftype})
    url = f"{base_url.rstrip()}/view?{query}"

    try:
        with urllib.request.urlopen(url, timeout=180) as response:
            out_path.write_bytes(response.read())
    except Exception as exc:
        kind = "image" if is_image else "video"
        raise HTTPException(status_code=502, detail=f"Cannot download Comfy output {kind}: {exc}") from exc

    urls = _public_static_url(f"assets/{asset_folder}/{out_path.name}")
    result = {
        "localPath": str(out_path),
        "sourceComfyUrl": url,
        "selectedOutputKind": "image" if is_image else "video",
    }

    if is_image:
        result.update({
            "imageUrl": urls["url"],
            "image_url": urls["url"],
            "imageApiPath": urls["apiPath"],
            "image_api_path": urls["apiPath"],
            "imageName": out_path.name,
            "image_name": out_path.name,
            "resultUrl": urls["url"],
            "result_url": urls["url"],
        })
    else:
        result.update({
            "videoUrl": urls["url"],
            "video_url": urls["url"],
            "videoApiPath": urls["apiPath"],
            "video_api_path": urls["apiPath"],
            "videoName": out_path.name,
            "video_name": out_path.name,
            "resultUrl": urls["url"],
            "result_url": urls["url"],
        })

    return result



def _trim_video_to_duration(source_path: Path, *, duration_sec: float, job_id: str) -> dict[str, Any] | None:
    try:
        duration = float(duration_sec or 0)
    except Exception:
        duration = 0.0

    if duration <= 0.1 or not source_path.exists():
        return None

    target_dir = _settings_static_path() / "assets" / "board_videos"
    target_dir.mkdir(parents=True, exist_ok=True)

    out_name = f"{source_path.stem}_trim_{duration:.3f}s.mp4".replace(".", "_", 1)
    out_path = target_dir / out_name

    try:
        _run_ffmpeg(["-y", "-i", str(source_path), "-t", f"{duration:.3f}", "-c", "copy", str(out_path)])
    except Exception:
        try:
            _run_ffmpeg([
                "-y", "-i", str(source_path), "-t", f"{duration:.3f}",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
                "-c:a", "aac", "-b:a", "192k",
                str(out_path),
            ])
        except Exception:
            return None

    urls = _public_static_url(f"assets/board_videos/{out_path.name}")
    return {
        "videoUrl": urls["url"],
        "video_url": urls["url"],
        "videoApiPath": urls["apiPath"],
        "video_api_path": urls["apiPath"],
        "videoName": out_path.name,
        "video_name": out_path.name,
        "localPath": str(out_path),
        "trimmed": True,
        "trimToDurationSec": duration,
    }


def _finalize_video_job_from_outputs(job: dict[str, Any], outputs: list[dict[str, Any]]) -> dict[str, Any] | None:
    base_url = job.get("targetComfyBaseUrl") or _main_comfy_url()
    if not base_url or not outputs:
        return None

    is_image_job = _is_image_generation_route(job.get("route"))
    image_outputs = [item for item in outputs if _is_image_output(item)]
    video_outputs = [item for item in outputs if _is_video_output(item)]

    candidate_outputs = (image_outputs or outputs) if is_image_job else (video_outputs or outputs)

    preferred_node_ids = [str(item) for item in (
        job.get("preferredOutputNodeIds")
        or job.get("preferred_output_node_ids")
        or ([] if not is_image_job else ["9"])
    )]

    chosen = None
    if preferred_node_ids:
        for item in candidate_outputs:
            if str(item.get("nodeId")) in preferred_node_ids:
                chosen = item
                break

    if chosen is None:
        chosen = candidate_outputs[0]

    downloaded = _download_comfy_output_to_static(base_url, chosen, job_id=job.get("jobId", "job"))
    final = downloaded

    if is_image_job or downloaded.get("imageUrl") or downloaded.get("image_url"):
        final["selectedOutput"] = chosen
        final["preferredOutputNodeIds"] = preferred_node_ids
        final["image_status"] = "ready"

        final_path = Path(str(final.get("localPath") or ""))
        asset_ref = _register_board_output_asset(
            final_path,
            job=job,
            kind="image",
            stage="board_images",
            original_name=final.get("imageName") or final.get("image_name") or final_path.name,
        )
        asset_id = asset_ref.get("asset_id") or asset_ref.get("assetId")
        asset_api_path = asset_ref.get("asset_api_path") or asset_ref.get("assetApiPath")
        if asset_id and asset_api_path:
            final.update({
                "staticImageUrl": final.get("imageUrl") or final.get("image_url") or "",
                "static_image_url": final.get("imageUrl") or final.get("image_url") or "",
                "staticImageApiPath": final.get("imageApiPath") or final.get("image_api_path") or "",
                "static_image_api_path": final.get("imageApiPath") or final.get("image_api_path") or "",
                "imageAssetId": asset_id,
                "image_asset_id": asset_id,
                "imageApiPath": asset_api_path,
                "image_api_path": asset_api_path,
                "imageUrl": asset_api_path,
                "image_url": asset_api_path,
                "resultUrl": asset_api_path,
                "result_url": asset_api_path,
            })
        return final

    try:
        trim_duration = float(job.get("trimToDurationSec") or job.get("targetDurationSec") or 0)
    except Exception:
        trim_duration = 0.0

    if trim_duration > 0.1:
        trimmed = _trim_video_to_duration(Path(downloaded["localPath"]), duration_sec=trim_duration, job_id=job.get("jobId", "job"))
        if trimmed:
            final = {**downloaded, **trimmed, "originalVideoUrl": downloaded.get("videoUrl")}

    final["selectedOutput"] = chosen
    final["preferredOutputNodeIds"] = preferred_node_ids

    final_path = Path(str(final.get("localPath") or ""))
    asset_ref = _register_board_output_asset(
        final_path,
        job=job,
        kind="video",
        stage="board_videos",
        original_name=final.get("videoName") or final.get("video_name") or final_path.name,
    )
    asset_id = asset_ref.get("asset_id") or asset_ref.get("assetId")
    asset_api_path = asset_ref.get("asset_api_path") or asset_ref.get("assetApiPath")
    if asset_id and asset_api_path:
        final.update({
            "staticVideoUrl": final.get("videoUrl") or final.get("video_url") or "",
            "static_video_url": final.get("videoUrl") or final.get("video_url") or "",
            "staticVideoApiPath": final.get("videoApiPath") or final.get("video_api_path") or "",
            "static_video_api_path": final.get("videoApiPath") or final.get("video_api_path") or "",
            "videoAssetId": asset_id,
            "video_asset_id": asset_id,
            "videoApiPath": asset_api_path,
            "video_api_path": asset_api_path,
            "videoUrl": asset_api_path,
            "video_url": asset_api_path,
            "resultUrl": asset_api_path,
            "result_url": asset_api_path,
        })

    return final



@router.post("/clip/video/cancel/{job_id}")
def cancel_video_job(job_id: str, user: dict = Depends(get_current_user)) -> dict[str, Any]:
    # AVA_GENERATOR_CANCEL_SAFE_V84: Stop polling was misleading; this endpoint requests real Comfy cancel.
    clean_job_id = str(job_id or "").strip()
    job = BOARD_VIDEO_JOBS.get(clean_job_id)
    if not job:
        # Job may be lost after backend restart, but local Comfy can still have queue items.
        base_url = _main_comfy_url()
        cancel_result = _cancel_comfy_prompt(base_url, None, interrupt=True, clear_pending=True)
        return {"ok": True, "jobId": clean_job_id, "status": "cancel_requested_missing_backend_job", "cancelResult": cancel_result}

    _ava_credit_ensure_job_owner(job, user)
    prompt_id = str(job.get("promptId") or job.get("prompt_id") or "").strip()
    base_url = str(job.get("targetComfyBaseUrl") or _main_comfy_url() or "").strip()
    cancel_result = _cancel_comfy_prompt(base_url, prompt_id, interrupt=True, clear_pending=False)

    job["status"] = "canceled"
    job["video_status"] = "canceled"
    job["cancelRequested"] = True
    job["cancel_requested"] = True
    job["canceledAt"] = datetime.utcnow().isoformat() + "Z"
    job["updatedAt"] = job["canceledAt"]
    job["cancelResult"] = cancel_result
    BOARD_VIDEO_JOBS[clean_job_id] = job
    # AVA_CANCEL_PERSIST_V203L:
    # Persist canceled state so frontend/status polling clears after backend restart too.
    _board_video_job_store(clean_job_id, job)
    return {"ok": True, "jobId": clean_job_id, "job_id": clean_job_id, "status": "canceled", "cancelResult": cancel_result, **job}


@router.post("/clip/video/cancel-active")
def cancel_active_video_jobs(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    # AVA_GENERATOR_CANCEL_SAFE_V84: emergency clear for local Generator backlog after accidental multiple submits.
    base_url = _main_comfy_url()
    cancel_result = _cancel_comfy_prompt(base_url, None, interrupt=True, clear_pending=True)
    canceled_jobs: list[str] = []
    now_cancel = datetime.utcnow().isoformat() + "Z"
    for jid, job in list(BOARD_VIDEO_JOBS.items()):
        try:
            _ava_credit_ensure_job_owner(job, user)
        except Exception:
            continue
        status_text = str(job.get("status") or "").lower()
        if job.get("videoUrl") or job.get("imageUrl") or "completed" in status_text or "ready" in status_text:
            continue
        job["status"] = "canceled"
        job["video_status"] = "canceled"
        job["cancelRequested"] = True
        job["canceledAt"] = now_cancel
        job["updatedAt"] = now_cancel
        # AVA_CANCEL_ACTIVE_PERSIST_V203L:
        _board_video_job_store(jid, job)
        canceled_jobs.append(jid)
    return {"ok": True, "status": "canceled_active_generator_jobs", "canceledJobIds": canceled_jobs, "cancelResult": cancel_result}


@router.get("/clip/video/status/{job_id}")
def video_status(job_id: str, user: dict = Depends(get_current_user)) -> dict[str, Any]:
    was_in_memory_v200h = job_id in BOARD_VIDEO_JOBS
    job = BOARD_VIDEO_JOBS.get(job_id) or _board_video_job_load(job_id)
    if not job:
        return {"ok": False, "status": "not_found", "code": "BOARD_VIDEO_JOB_NOT_FOUND", "jobId": job_id}

    _ava_credit_ensure_job_owner(job, user)

    # AVA_VIDEO_STATUS_TERMINAL_EARLY_V203L:
    # Do not turn canceled/failed/blocked jobs back into running by probing Comfy history.
    terminal_status_v203l = str(job.get("status") or job.get("video_status") or "").strip().lower()
    if (
        terminal_status_v203l.startswith("blocked")
        or terminal_status_v203l in {"canceled", "cancelled", "cancel_requested", "failed", "error", "not_found", "output_download_failed", "output_finalize_failed", "completed_without_video_output"}
    ):
        _board_video_job_store(job_id, job)
        return {"ok": False if terminal_status_v203l not in {"completed", "ready", "done"} else True, **job}

    should_force_orphan_v200h, orphan_reason_v200h = _board_video_should_force_orphan_v200h(job_id, job, was_in_memory=was_in_memory_v200h, source="status")
    if should_force_orphan_v200h:
        return _board_video_mark_orphaned_v200h(job_id, job, reason=orphan_reason_v200h)

    if job.get("videoUrl") or job.get("video_url") or job.get("imageUrl") or job.get("image_url"):
        _ava_credit_charge_video_job_if_ready(job)
        _board_video_job_store(job_id, job)
        return {"ok": True, **job}

    prompt_id = job.get("promptId") or job.get("prompt_id")
    base_url = job.get("targetComfyBaseUrl") or job.get("target_comfy_base_url")
    if prompt_id and base_url:
        history = _history(base_url, prompt_id)
        outputs = _extract_comfy_outputs(base_url, history) if isinstance(history, dict) else []

        if outputs:
            job["outputs"] = outputs
            try:
                final_video = _finalize_video_job_from_outputs(job, outputs)
                if final_video:
                    job.update(final_video)
                    job["status"] = "completed"
                    job["video_status"] = "ready"
                    if job.get("imageUrl") or job.get("image_url"):
                        job["image_status"] = "ready"
                    _ava_credit_charge_video_job_if_ready(job)
                else:
                    job["status"] = "completed_without_video_output"
            except HTTPException as exc:
                job["status"] = "output_download_failed"
                job["error"] = exc.detail
            except Exception as exc:
                job["status"] = "output_finalize_failed"
                job["error"] = str(exc)

            job["updatedAt"] = now_iso()
            job["historyPreview"] = history

        elif isinstance(history, dict) and "_history_error" in history:
            should_orphan_v200f, orphan_reason_v200f = _board_video_should_orphan_v200f(
                job,
                base_url=base_url,
                prompt_id=prompt_id,
                history=history,
                history_error=True,
            )
            if should_orphan_v200f:
                return _board_video_mark_orphaned_v200e(
                    job_id,
                    job,
                    reason=orphan_reason_v200f,
                    history=history,
                )
            job["historyError"] = history["_history_error"]
            job["status"] = "running"
            job["updatedAt"] = now_iso()
            job["historyPreview"] = history
        else:
            # Empty history + prompt missing from Comfy queue/running after enough time means
            # the browser resurrected an old persisted job after F5/backend reload. Without this
            # guard the scene stays "видео делается" forever and every poll writes ava_db.json.
            should_orphan_v200f, orphan_reason_v200f = _board_video_should_orphan_v200f(
                job,
                base_url=base_url,
                prompt_id=prompt_id,
                history=history,
                history_error=False,
            )
            if should_orphan_v200f:
                return _board_video_mark_orphaned_v200e(
                    job_id,
                    job,
                    reason=orphan_reason_v200f,
                    history=history,
                )
            job["status"] = "running"
            job["updatedAt"] = now_iso()
            job["historyPreview"] = history

    _ava_credit_charge_video_job_if_ready(job)
    _board_video_job_store(job_id, job)

    return {"ok": True, **job}




# AVA_BOARD_SERVER_VIDEO_BATCH_QUEUE_V131A:
# Backend-owned Board video queue. The browser/Board page only submits the batch and displays
# the project snapshot. The backend starts scenes, polls Comfy jobs, writes completed videos
# into the Board snapshot, and starts the next scene even when the user is not on Board.
def _board_batch_now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _board_batch_scene_id(scene: dict[str, Any]) -> str:
    return str(scene.get("id") or scene.get("scene_id") or scene.get("sceneId") or "").strip()


def _board_batch_field(scene: dict[str, Any], *names: str, default: Any = None) -> Any:
    for name in names:
        value = scene.get(name)
        if value is not None and value != "":
            return value
    return default


def _board_batch_media_ref(scene: dict[str, Any], names: list[str]) -> str:
    for name in names:
        value = str(scene.get(name) or "").strip()
        if value and not value.startswith("blob:") and not value.startswith("data:"):
            return value
    return ""



# AVA_BOARD_SERVER_BATCH_ASSET_ID_REFS_V131C:
# Server batch accepts restored scenes that have only asset ids but missed apiPath aliases.
def _board_batch_asset_api_path_from_ids(scene: dict[str, Any], names: list[str]) -> str:
    for name in names:
        value = str(scene.get(name) or "").strip()
        if value.startswith("asset_"):
            return f"/assets/{value}/file"
    return ""

def _board_batch_scene_image_ref(scene: dict[str, Any]) -> str:
    ref = _board_batch_media_ref(scene, [
        "image_api_path", "imageApiPath", "image_url", "imageUrl",
        "first_image_api_path", "firstImageApiPath", "first_frame_api_path", "firstFrameApiPath",
        "first_image_url", "firstImageUrl", "first_frame_url", "firstFrameUrl",
        "start_image_api_path", "startImageApiPath", "start_image_url", "startImageUrl",
    ])
    return ref or _board_batch_asset_api_path_from_ids(scene, [
        "image_asset_id", "imageAssetId",
        "first_image_asset_id", "firstImageAssetId",
        "first_frame_asset_id", "firstFrameAssetId",
        "start_image_asset_id", "startImageAssetId",
    ])


def _board_batch_scene_end_image_ref(scene: dict[str, Any]) -> str:
    ref = _board_batch_media_ref(scene, [
        "last_image_api_path", "lastImageApiPath", "last_frame_api_path", "lastFrameApiPath",
        "last_image_url", "lastImageUrl", "last_frame_url", "lastFrameUrl",
        "end_image_api_path", "endImageApiPath", "end_image_url", "endImageUrl",
    ])
    return ref or _board_batch_asset_api_path_from_ids(scene, [
        "last_image_asset_id", "lastImageAssetId",
        "last_frame_asset_id", "lastFrameAssetId",
        "end_image_asset_id", "endImageAssetId",
    ])




# AVA_BOARD_MASTER_AUDIO_FORCE_RECUT_V199F:
# Old per-scene audio slices may have been cut from the vocal-ASR stem.
# For batch generation, audio routes must always recut from the current master/mixed song audio.
def _board_batch_clear_scene_audio_slice_v199f(scene: dict[str, Any]) -> dict[str, Any]:
    patched = dict(scene) if isinstance(scene, dict) else {}
    keys = (
        "audio_slice_status", "audioSliceStatus", "audio_slice_url", "audioSliceUrl",
        "audio_slice_api_path", "audioSliceApiPath", "audio_slice_name", "audioSliceName",
        "audio_slice_mime", "audioSliceMime", "audio_slice_start", "audioSliceStart",
        "audio_slice_end", "audioSliceEnd", "audio_slice_duration", "audioSliceDuration",
        "audio_slice_source", "audioSliceSource", "audio_slice_source_asset_api_path", "audioSliceSourceAssetApiPath",
        "audio_slice_source_asset_id", "audioSliceSourceAssetId", "audio_slice_error", "audioSliceError",
        "manual_lipsync_audio_api_path", "manualLipSyncAudioApiPath",
        "manual_lipsync_audio_url", "manualLipSyncAudioUrl",
        "manual_lipsync_audio_asset_id", "manualLipSyncAudioAssetId",
        "audio_api_path", "audioApiPath", "audio_url", "audioUrl", "audio_asset_id", "audioAssetId",
    )
    for key in keys:
        patched.pop(key, None)
    patched["audio_slice_status"] = "recut_required_from_master_v199f"
    patched["audioSliceStatus"] = "recut_required_from_master_v199f"
    return patched


def _board_batch_text_looks_vocal_only_v199f(*parts: Any) -> bool:
    low = " ".join(str(part or "") for part in parts).lower().replace("\\", "/")
    bad = (
        "manual_timing_vocal", "vocal_stem", "vocal-stem", "vocals_stem", "vocals-stem",
        "asr_vocal", "vocal_asr", "stem_vocal", "isolated_vocal", "voice_only",
        "vocals_only", "/vocals/", "vocal stem", "voice stem",
    )
    return any(item in low for item in bad)


def _board_batch_asset_record_v199f(asset_id: str | None) -> dict[str, Any]:
    aid = str(asset_id or "").strip()
    if not aid:
        return {}
    try:
        db = store.get_db() or {}
        assets = db.get("assets") or {}
        rec = assets.get(aid) if isinstance(assets, dict) else None
        return rec if isinstance(rec, dict) else {}
    except Exception:
        return {}


def _board_batch_asset_record_text_v199f(asset: dict[str, Any] | None) -> str:
    if not isinstance(asset, dict):
        return ""
    keys = (
        "id", "name", "filename", "file_name", "fileName", "original_name", "originalName",
        "display_name", "displayName", "title", "kind", "role", "source", "source_type", "sourceType",
        "path", "file_path", "filePath", "local_path", "localPath", "asset_path", "assetPath",
        "folder", "subfolder", "category", "tag", "label", "purpose", "stage",
    )
    return " ".join(str(asset.get(key) or "") for key in keys).lower().replace("\\", "/")


def _board_batch_audio_candidate_is_vocal_only_v199f(candidate: dict[str, str] | None, resolved_path: Path | None = None) -> bool:
    if not isinstance(candidate, dict):
        return False
    aid = str(candidate.get("asset_id") or "").strip()
    asset = _board_batch_asset_record_v199f(aid)
    return _board_batch_text_looks_vocal_only_v199f(
        candidate.get("source"), candidate.get("ref"), candidate.get("asset_id"), resolved_path,
        _board_batch_asset_record_text_v199f(asset),
    )
def _board_batch_scene_audio_ref(scene: dict[str, Any]) -> str:
    return _board_batch_media_ref(scene, [
        "audio_slice_api_path", "audioSliceApiPath", "audio_slice_url", "audioSliceUrl",
        "manual_lipsync_audio_api_path", "manualLipSyncAudioApiPath",
        "manual_lipsync_audio_url", "manualLipSyncAudioUrl",
        "audio_api_path", "audioApiPath", "audio_url", "audioUrl",
    ])


# AVA_BOARD_SERVER_BATCH_AUTOSLICE_V147A:
# Backend-owned "Сгенерировать все" cuts per-scene audio slices for ia2v/lip-sync
# routes automatically. This mirrors /manual-clip/slice-audio but runs before
# batch validation so the user does not have to press the slice button scene by scene.
def _board_batch_is_audio_slice_route(route: str | None) -> bool:
    value = str(route or "").strip().lower()
    return value in {
        "ia2v", "ia2v_lipsync", "ia2v_instrumental",
        "lip_sync", "lipsync", "instrumental",
        "i2v_audio", "audio2video", "a2v",
    }

def _board_batch_root_audio_source(board_data: dict[str, Any], payload: Any = None) -> tuple[str, str]:
    candidates: list[dict[str, Any]] = []
    if payload is not None:
        for attr in ("audio", "board_audio", "boardAudio"):
            value = getattr(payload, attr, None)
            if isinstance(value, dict):
                candidates.append(value)
        payload_flat = {
            "audio_url": getattr(payload, "audio_url", None),
            "audioUrl": getattr(payload, "audioUrl", None),
            "audio_asset_api_path": getattr(payload, "audio_asset_api_path", None),
            "audioAssetApiPath": getattr(payload, "audioAssetApiPath", None),
            "audio_asset_id": getattr(payload, "audio_asset_id", None),
            "audioAssetId": getattr(payload, "audioAssetId", None),
            "asset_id": getattr(payload, "asset_id", None),
            "assetId": getattr(payload, "assetId", None),
        }
        if any(value for value in payload_flat.values()):
            candidates.append(payload_flat)
    audio = board_data.get("audio") if isinstance(board_data.get("audio"), dict) else {}
    if audio:
        candidates.append(audio)
    candidates.append(board_data)

    for item in candidates:
        if not isinstance(item, dict):
            continue
        source_ref = str(
            item.get("audio_asset_api_path") or item.get("audioAssetApiPath") or
            item.get("assetApiPath") or item.get("asset_api_path") or
            item.get("audio_api_path") or item.get("audioApiPath") or
            item.get("audio_url") or item.get("audioUrl") or
            item.get("url") or item.get("src") or ""
        ).strip()
        asset_id = str(
            item.get("audio_asset_id") or item.get("audioAssetId") or
            item.get("asset_id") or item.get("assetId") or ""
        ).strip()
        if source_ref or asset_id:
            return source_ref, asset_id
    return "", ""



# AVA_BOARD_LIPSYNC_MASTER_AUDIO_V199E: lip-sync/instrumental autoslice must use main mixed song audio, not vocal ASR stem.
# AVA_BOARD_AUTOSLICE_AUDIO_FALLBACK_V151A:
# Batch autoslice must not trust only the first audio ref from the client. A Board
# can keep a stale /assets/<id>/file after reloads or after moving between
# Timing -> Board. Try all reasonable sources and use the first one that really
# exists on disk.
def _board_batch_audio_ref_from_mapping_v151a(item: dict[str, Any] | None) -> tuple[str, str]:
    if not isinstance(item, dict):
        return "", ""
    source_ref = str(
        item.get("audio_asset_api_path") or item.get("audioAssetApiPath") or
        item.get("assetApiPath") or item.get("asset_api_path") or
        item.get("audio_api_path") or item.get("audioApiPath") or
        item.get("manual_lipsync_audio_api_path") or item.get("manualLipSyncAudioApiPath") or
        item.get("audio_url") or item.get("audioUrl") or
        item.get("url") or item.get("src") or ""
    ).strip()
    asset_id = str(
        item.get("audio_asset_id") or item.get("audioAssetId") or
        item.get("manual_lipsync_audio_asset_id") or item.get("manualLipSyncAudioAssetId") or
        item.get("asset_id") or item.get("assetId") or ""
    ).strip()
    parsed_asset_id = _asset_id_from_text(source_ref) or ""
    if not asset_id and parsed_asset_id:
        asset_id = parsed_asset_id
    if asset_id and not source_ref:
        source_ref = f"/assets/{asset_id}/file"
    return source_ref, asset_id


def _board_batch_audio_candidate_add_v151a(
    candidates: list[dict[str, str]],
    seen: set[tuple[str, str]],
    source_ref: str | None,
    asset_id: str | None,
    source: str,
) -> None:
    ref = str(source_ref or "").strip()
    aid = str(asset_id or "").strip()
    parsed = _asset_id_from_text(ref) or ""
    if not aid and parsed:
        aid = parsed
    if aid and not ref:
        ref = f"/assets/{aid}/file"
    if not ref and not aid:
        return
    key = (ref, aid)
    if key in seen:
        return
    seen.add(key)
    candidates.append({"ref": ref, "asset_id": aid, "source": source})




# AVA_BOARD_LIPSYNC_MASTER_AUDIO_V199E:
# Batch lip-sync / instrumental slicing must use the main mixed song audio.
# Never silently use the Manual Timing vocal-ASR stem, because it has words only and no music.
def _board_batch_audio_asset_record_v199e(asset_id: str | None) -> dict[str, Any]:
    aid = str(asset_id or "").strip()
    if not aid:
        return {}
    try:
        db = store.get_db() or {}
        assets = db.get("assets") or {}
        item = assets.get(aid) if isinstance(assets, dict) else None
        return item if isinstance(item, dict) else {}
    except Exception:
        return {}


def _board_batch_audio_record_text_v199e(asset: dict[str, Any] | None) -> str:
    if not isinstance(asset, dict):
        return ""
    fields = []
    for key in (
        "id", "name", "filename", "file_name", "fileName", "original_name", "originalName",
        "display_name", "displayName", "title", "kind", "role", "source", "source_type", "sourceType",
        "path", "file_path", "filePath", "local_path", "localPath", "asset_path", "assetPath",
        "folder", "subfolder", "category", "tag", "label", "purpose", "stage",
    ):
        value = asset.get(key)
        if value is not None:
            fields.append(str(value))
    return " ".join(fields).lower().replace("\\", "/")


def _board_batch_audio_record_is_vocal_only_v199e(asset: dict[str, Any] | None) -> bool:
    low = _board_batch_audio_record_text_v199e(asset)
    if not low:
        return False
    bad_markers = (
        "manual_timing_vocal",
        "vocal_stem",
        "vocal-stem",
        "vocals_stem",
        "vocals-stem",
        "asr_vocal",
        "vocal_asr",
        "stem_vocal",
        "stem/vocal",
        "/vocals/",
        "\\vocals\\",
        "isolated_vocal",
        "voice_only",
        "vocals_only",
        "voice stem",
        "vocal stem",
    )
    if any(marker in low for marker in bad_markers):
        return True
    # Be conservative: a path/name explicitly ending in vocal/vocals is a stem.
    return bool(re.search(r"(^|[/_\\\-\s])(vocal|vocals)([/_\\\-\s.]|$)", low))


def _board_batch_audio_candidate_is_vocal_only_v199e(candidate: dict[str, str] | None, resolved_path: Path | None = None) -> bool:
    if not isinstance(candidate, dict):
        return False
    aid = str(candidate.get("asset_id") or "").strip()
    asset = _board_batch_audio_asset_record_v199e(aid)
    parts = [
        str(candidate.get("source") or ""),
        str(candidate.get("ref") or ""),
        str(candidate.get("asset_id") or ""),
        str(resolved_path or ""),
        _board_batch_audio_record_text_v199e(asset),
    ]
    low = " ".join(parts).lower().replace("\\", "/")
    bad_markers = (
        "manual_timing_vocal",
        "vocal_stem",
        "vocal-stem",
        "asr_vocal",
        "vocal_asr",
        "isolated_vocal",
        "voice_only",
        "vocals_only",
        "/vocals/",
        "vocal stem",
        "voice stem",
    )
    return any(marker in low for marker in bad_markers) or _board_batch_audio_record_is_vocal_only_v199e(asset)


def _board_batch_scene_audio_ref_is_from_vocal_only_v199e(scene: dict[str, Any] | None) -> bool:
    if not isinstance(scene, dict):
        return False
    for key in (
        "audio_slice_source_asset_id", "audioSliceSourceAssetId",
        "audio_source_asset_id", "audioSourceAssetId",
        "source_audio_asset_id", "sourceAudioAssetId",
        "manual_lipsync_audio_asset_id", "manualLipSyncAudioAssetId",
        "audio_asset_id", "audioAssetId",
    ):
        aid = str(scene.get(key) or "").strip()
        if aid and _board_batch_audio_record_is_vocal_only_v199e(_board_batch_audio_asset_record_v199e(aid)):
            return True
    combined = " ".join(str(scene.get(key) or "") for key in (
        "audio_slice_source", "audioSliceSource",
        "audio_slice_url", "audioSliceUrl", "audio_slice_api_path", "audioSliceApiPath",
        "manual_lipsync_audio_url", "manualLipSyncAudioUrl",
        "manual_lipsync_audio_api_path", "manualLipSyncAudioApiPath",
    )).lower().replace("\\", "/")
    return "manual_timing_vocal" in combined or "vocal_stem" in combined or "asr_vocal" in combined


def _board_batch_clear_scene_audio_slice_v199e(scene: dict[str, Any]) -> dict[str, Any]:
    patched = dict(scene) if isinstance(scene, dict) else {}
    keys = (
        "audio_slice_status", "audioSliceStatus", "audio_slice_url", "audioSliceUrl",
        "audio_slice_api_path", "audioSliceApiPath", "audio_slice_name", "audioSliceName",
        "audio_slice_mime", "audioSliceMime", "audio_slice_start", "audioSliceStart",
        "audio_slice_end", "audioSliceEnd", "audio_slice_duration", "audioSliceDuration",
        "audio_slice_source", "audioSliceSource", "audio_slice_source_asset_api_path", "audioSliceSourceAssetApiPath",
        "audio_slice_source_asset_id", "audioSliceSourceAssetId", "audio_slice_error", "audioSliceError",
        "manual_lipsync_audio_api_path", "manualLipSyncAudioApiPath",
        "manual_lipsync_audio_url", "manualLipSyncAudioUrl",
        "manual_lipsync_audio_asset_id", "manualLipSyncAudioAssetId",
        "audio_api_path", "audioApiPath", "audio_url", "audioUrl", "audio_asset_id", "audioAssetId",
    )
    for key in keys:
        patched.pop(key, None)
    patched["audio_slice_status"] = "cleared_vocal_stem_rejected_v199e"
    patched["audioSliceStatus"] = "cleared_vocal_stem_rejected_v199e"
    return patched

def _board_batch_audio_candidate_scan_v151a(
    candidates: list[dict[str, str]],
    seen: set[tuple[str, str]],
    item: dict[str, Any] | None,
    source: str,
) -> None:
    ref, aid = _board_batch_audio_ref_from_mapping_v151a(item)
    _board_batch_audio_candidate_add_v151a(candidates, seen, ref, aid, source)


def _board_batch_root_audio_candidates_v151a(
    project_id: str | None,
    board_data: dict[str, Any],
    payload: Any = None,
) -> list[dict[str, str]]:
    candidates: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()

    # 1) What the frontend explicitly sent in the current batch request.
    if payload is not None:
        for attr in ("audio", "board_audio", "boardAudio"):
            value = getattr(payload, attr, None)
            if isinstance(value, dict):
                _board_batch_audio_candidate_scan_v151a(candidates, seen, value, f"payload.{attr}")
        payload_flat = {
            "audio_url": getattr(payload, "audio_url", None),
            "audioUrl": getattr(payload, "audioUrl", None),
            "audio_asset_api_path": getattr(payload, "audio_asset_api_path", None),
            "audioAssetApiPath": getattr(payload, "audioAssetApiPath", None),
            "audio_asset_id": getattr(payload, "audio_asset_id", None),
            "audioAssetId": getattr(payload, "audioAssetId", None),
            "asset_id": getattr(payload, "asset_id", None),
            "assetId": getattr(payload, "assetId", None),
        }
        _board_batch_audio_candidate_scan_v151a(candidates, seen, payload_flat, "payload.flat")

    # 2) Current Board snapshot root audio.
    audio = board_data.get("audio") if isinstance(board_data.get("audio"), dict) else {}
    _board_batch_audio_candidate_scan_v151a(candidates, seen, audio, "board.audio")
    _board_batch_audio_candidate_scan_v151a(candidates, seen, board_data, "board.root")

    # 3) Manual Timing snapshot is the real authority for the master audio when
    # Board was opened via Timing -> Board. This fixes stale Board audio refs.
    pid = str(project_id or board_data.get("project_id") or board_data.get("projectId") or "").strip()
    db: dict[str, Any] = {}
    try:
        db = store.get_db() or {}
    except Exception:
        db = {}

    if pid:
        project_snapshots = (db.get("snapshots") or {}).get(pid, {}) if isinstance(db, dict) else {}
        for stage in ("manual_timing", "manualTiming", "timing"):
            snap = project_snapshots.get(stage) if isinstance(project_snapshots, dict) else None
            data = snap.get("data") if isinstance(snap, dict) else None
            if not isinstance(data, dict):
                continue
            timing_audio = data.get("audio") if isinstance(data.get("audio"), dict) else {}
            _board_batch_audio_candidate_scan_v151a(candidates, seen, timing_audio, f"snapshot.{stage}.audio")
            _board_batch_audio_candidate_scan_v151a(candidates, seen, data, f"snapshot.{stage}.root")

        # 4) Last-resort: the newest existing audio asset for this project.
        # This is intentionally after explicit refs, so we do not randomly pick
        # another file unless the stored Board/Timing refs are missing/stale.
        try:
            assets = list((db.get("assets") or {}).values())
            audio_assets: list[dict[str, Any]] = []
            for asset in assets:
                if not isinstance(asset, dict):
                    continue
                if str(asset.get("project_id") or asset.get("projectId") or "") != pid:
                    continue
                kind = str(asset.get("kind") or "").lower().strip()
                mime = str(asset.get("mime_type") or asset.get("mimeType") or "").lower().strip()
                if kind != "audio" and not mime.startswith("audio/"):
                    continue
                path = _asset_file_path_from_record(asset)
                try:
                    if not path or not path.exists() or not path.is_file():
                        continue
                except Exception:
                    continue
                audio_assets.append(asset)
            audio_assets.sort(
                key=lambda item: (
                    0 if _board_batch_audio_record_is_vocal_only_v199e(item) else 1,
                    str(item.get("updated_at") or item.get("updatedAt") or item.get("created_at") or item.get("createdAt") or ""),
                ),
                reverse=True,
            )
            for asset in audio_assets[:8]:
                aid = str(asset.get("id") or "").strip()
                if aid:
                    _board_batch_audio_candidate_add_v151a(candidates, seen, f"/assets/{aid}/file", aid, "assets.db.project_audio")
        except Exception as exc:
            print("[BOARD SERVER BATCH AUDIO DB FALLBACK ERROR V151A]", {"project_id": pid, "error": str(exc)}, flush=True)

    return candidates


def _board_batch_resolve_root_audio_source_v151a(
    project_id: str | None,
    board_data: dict[str, Any],
    payload: Any = None,
) -> tuple[Path | None, str, str, list[dict[str, str]]]:
    candidates = _board_batch_root_audio_candidates_v151a(project_id, board_data, payload)
    if not candidates:
        return None, "", "", []

    errors: list[dict[str, str]] = []
    for candidate in candidates:
        ref = candidate.get("ref") or ""
        aid = candidate.get("asset_id") or ""
        source = candidate.get("source") or ""
        try:
            path = _resolve_local_file(ref, asset_id=aid)
            if path and path.exists() and path.is_file():
                if _board_batch_audio_candidate_is_vocal_only_v199e(candidate, path):
                    errors.append({
                        "source": source,
                        "ref": ref,
                        "asset_id": aid,
                        "path": str(path),
                        "error": "vocal_only_asr_stem_rejected_v199e",
                    })
                    print("[BOARD SERVER BATCH VOCAL STEM AUDIO REJECTED V199E]", {
                        "project_id": project_id,
                        "source": source,
                        "ref": ref,
                        "asset_id": aid,
                        "path": str(path),
                        "reason": "lip_sync_requires_main_mixed_song_audio",
                    }, flush=True)
                    continue
                if errors:
                    print("[BOARD SERVER BATCH AUDIO FALLBACK HIT V151A]", {
                        "project_id": project_id,
                        "using": {"source": source, "ref": ref, "asset_id": aid, "path": str(path)},
                        "skipped": errors[:8],
                    }, flush=True)
                print("[BOARD SERVER BATCH MASTER AUDIO SELECTED V199E]", {
                    "project_id": project_id,
                    "source": source,
                    "ref": ref,
                    "asset_id": aid,
                    "path": str(path),
                }, flush=True)
                return path, ref, aid, errors
            errors.append({"source": source, "ref": ref, "asset_id": aid, "error": "resolved_path_missing"})
        except Exception as exc:
            errors.append({"source": source, "ref": ref, "asset_id": aid, "error": str(exc)})

    print("[BOARD SERVER BATCH AUDIO FALLBACK MISS V151A]", {
        "project_id": project_id,
        "candidateCount": len(candidates),
        "errors": errors[:10],
    }, flush=True)
    detail = "No usable audio source for Board batch autoslice"
    if errors:
        detail += "; first_error=" + str(errors[0].get("error") or "unknown")
    raise HTTPException(status_code=404, detail=detail)

def _board_batch_scene_audio_range(scene: dict[str, Any]) -> tuple[float, float, float] | None:
    def num(*keys: str, default: float = 0.0) -> float:
        for key in keys:
            try:
                value = scene.get(key)
                if value is not None and value != "":
                    return float(value)
            except Exception:
                pass
        return default

    start = max(0.0, num("start_sec", "start", "scene_start_sec", "sceneStartSec", default=0.0))
    end = num("end_sec", "end", "scene_end_sec", "sceneEndSec", default=0.0)
    if end > start:
        return start, end, max(0.05, end - start)

    duration = num("target_duration_sec", "targetDurationSec", "duration_sec", "durationSec", "duration", default=0.0)
    if duration > 0:
        return start, start + duration, max(0.05, duration)
    return None




# AVA_BOARD_MASTER_AUDIO_FORCE_RECUT_V199G helpers:
def _board_batch_clear_scene_audio_slice_v199g(scene: dict[str, Any]) -> dict[str, Any]:
    patched = dict(scene) if isinstance(scene, dict) else {}
    keys = (
        "audio_slice_status", "audioSliceStatus", "audio_slice_url", "audioSliceUrl",
        "audio_slice_api_path", "audioSliceApiPath", "audio_slice_name", "audioSliceName",
        "audio_slice_mime", "audioSliceMime", "audio_slice_start", "audioSliceStart",
        "audio_slice_end", "audioSliceEnd", "audio_slice_duration", "audioSliceDuration",
        "audio_slice_source", "audioSliceSource", "audio_slice_source_asset_api_path", "audioSliceSourceAssetApiPath",
        "audio_slice_source_asset_id", "audioSliceSourceAssetId", "audio_slice_error", "audioSliceError",
        "manual_lipsync_audio_api_path", "manualLipSyncAudioApiPath",
        "manual_lipsync_audio_url", "manualLipSyncAudioUrl",
        "manual_lipsync_audio_asset_id", "manualLipSyncAudioAssetId",
        "audio_api_path", "audioApiPath", "audio_url", "audioUrl", "audio_asset_id", "audioAssetId",
    )
    for key in keys:
        patched.pop(key, None)
    patched["audio_slice_status"] = "recut_required_from_master_v199g"
    patched["audioSliceStatus"] = "recut_required_from_master_v199g"
    return patched


def _board_batch_asset_record_v199g(asset_id: str | None) -> dict[str, Any]:
    aid = str(asset_id or "").strip()
    if not aid:
        return {}
    try:
        db = store.get_db() or {}
        assets = db.get("assets") or {}
        rec = assets.get(aid) if isinstance(assets, dict) else None
        return rec if isinstance(rec, dict) else {}
    except Exception:
        return {}


def _board_batch_asset_record_text_v199g(asset: dict[str, Any] | None) -> str:
    if not isinstance(asset, dict):
        return ""
    keys = (
        "id", "name", "filename", "file_name", "fileName", "original_name", "originalName",
        "display_name", "displayName", "title", "kind", "role", "source", "source_type", "sourceType",
        "path", "file_path", "filePath", "local_path", "localPath", "asset_path", "assetPath",
        "folder", "subfolder", "category", "tag", "label", "purpose", "stage",
    )
    return " ".join(str(asset.get(key) or "") for key in keys).lower().replace("\\", "/")


def _board_batch_text_looks_vocal_only_v199g(*parts: Any) -> bool:
    low = " ".join(str(part or "") for part in parts).lower().replace("\\", "/")
    bad = (
        "manual_timing_vocal", "vocal_stem", "vocal-stem", "vocals_stem", "vocals-stem",
        "asr_vocal", "vocal_asr", "stem_vocal", "stem/vocal", "isolated_vocal",
        "voice_only", "vocals_only", "/vocals/", "vocal stem", "voice stem",
    )
    return any(item in low for item in bad)


def _board_batch_audio_candidate_is_vocal_only_v199g(candidate: dict[str, Any] | None, resolved_path: Path | None = None) -> bool:
    if not isinstance(candidate, dict):
        return False
    aid = str(candidate.get("asset_id") or candidate.get("assetId") or "").strip()
    asset = _board_batch_asset_record_v199g(aid)
    return _board_batch_text_looks_vocal_only_v199g(
        candidate.get("source"), candidate.get("ref"), candidate.get("asset_id"), candidate.get("assetId"),
        candidate.get("path"), resolved_path, _board_batch_asset_record_text_v199g(asset),
    )


def _board_batch_master_audio_extra_candidates_v199g(project_id: str | None, board_data: dict[str, Any]) -> list[dict[str, str]]:
    pid = str(project_id or (board_data or {}).get("project_id") or (board_data or {}).get("projectId") or "").strip()
    if not pid:
        return []
    try:
        db = store.get_db() or {}
        assets = list((db.get("assets") or {}).values()) if isinstance(db, dict) else []
    except Exception:
        assets = []
    out: list[dict[str, str]] = []
    for asset in assets:
        if not isinstance(asset, dict):
            continue
        if str(asset.get("project_id") or asset.get("projectId") or "") != pid:
            continue
        kind = str(asset.get("kind") or "").lower().strip()
        mime = str(asset.get("mime_type") or asset.get("mimeType") or "").lower().strip()
        if kind != "audio" and not mime.startswith("audio/"):
            continue
        aid = str(asset.get("id") or "").strip()
        if not aid:
            continue
        try:
            path = _asset_file_path_from_record(asset)
            if not path or not path.exists() or not path.is_file():
                continue
        except Exception:
            continue
        # Keep vocal records in the list for logging/rejection, but sort them last.
        out.append({
            "source": "assets.db.project_audio_v199g",
            "ref": f"/assets/{aid}/file",
            "asset_id": aid,
            "path": str(path),
            "updated": str(asset.get("updated_at") or asset.get("updatedAt") or asset.get("created_at") or asset.get("createdAt") or ""),
        })
    out.sort(key=lambda item: (
        0 if _board_batch_audio_candidate_is_vocal_only_v199g(item, Path(item.get("path") or "")) else 1,
        item.get("updated") or "",
    ), reverse=True)
    return out


def _board_batch_resolve_master_audio_source_v199g(
    project_id: str | None,
    board_data: dict[str, Any],
    payload: Any = None,
) -> tuple[Path | None, str, str, list[dict[str, str]]]:
    candidates: list[dict[str, str]] = []
    try:
        candidates.extend(_board_batch_root_audio_candidates_v151a(project_id, board_data, payload))
    except Exception as exc:
        print("[BOARD SERVER BATCH MASTER AUDIO CANDIDATE ERROR V199G]", {"project_id": project_id, "error": str(exc)}, flush=True)
    candidates.extend(_board_batch_master_audio_extra_candidates_v199g(project_id, board_data))

    seen: set[tuple[str, str]] = set()
    deduped: list[dict[str, str]] = []
    for c in candidates:
        if not isinstance(c, dict):
            continue
        key = (str(c.get("ref") or ""), str(c.get("asset_id") or ""))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(c)

    errors: list[dict[str, str]] = []
    for candidate in deduped:
        ref = str(candidate.get("ref") or "").strip()
        aid = str(candidate.get("asset_id") or "").strip()
        source = str(candidate.get("source") or "").strip()
        try:
            path: Path | None = None
            direct = str(candidate.get("path") or "").strip()
            if direct:
                path = Path(direct)
            if not path or not path.exists() or not path.is_file():
                path = _resolve_local_file(ref, asset_id=aid)
            if path and path.exists() and path.is_file():
                if _board_batch_audio_candidate_is_vocal_only_v199g(candidate, path):
                    errors.append({"source": source, "ref": ref, "asset_id": aid, "path": str(path), "error": "vocal_only_asr_stem_rejected_v199g"})
                    print("[BOARD SERVER BATCH VOCAL STEM AUDIO REJECTED V199G]", {
                        "project_id": project_id,
                        "source": source,
                        "ref": ref,
                        "asset_id": aid,
                        "path": str(path),
                        "reason": "lip_sync_requires_main_mixed_song_audio",
                    }, flush=True)
                    continue
                if errors:
                    print("[BOARD SERVER BATCH AUDIO FALLBACK HIT V199G]", {
                        "project_id": project_id,
                        "using": {"source": source, "ref": ref, "asset_id": aid, "path": str(path)},
                        "skipped": errors[:8],
                    }, flush=True)
                print("[BOARD SERVER BATCH MASTER AUDIO SELECTED V199G]", {
                    "project_id": project_id,
                    "source": source,
                    "ref": ref,
                    "asset_id": aid,
                    "path": str(path),
                }, flush=True)
                return path, ref, aid, errors
            errors.append({"source": source, "ref": ref, "asset_id": aid, "error": "resolved_path_missing"})
        except Exception as exc:
            errors.append({"source": source, "ref": ref, "asset_id": aid, "error": str(exc)})

    print("[BOARD SERVER BATCH MASTER AUDIO MISS V199G]", {
        "project_id": project_id,
        "candidateCount": len(deduped),
        "errors": errors[:12],
    }, flush=True)
    detail = "No usable MASTER/MIXED song audio for lip-sync autoslice. Vocal-ASR stems are rejected. Re-upload the original full song audio."
    if errors:
        detail += "; first_error=" + str(errors[0].get("error") or "unknown")
    raise HTTPException(status_code=404, detail=detail)

def _board_batch_cut_audio_slice_for_scene(scene: dict[str, Any], board_data: dict[str, Any], payload: Any = None, project_id: str | None = None) -> tuple[dict[str, Any], bool]:
    route = str(scene.get("route") or "i2v").strip() or "i2v"
    if not _board_batch_is_audio_slice_route(route):
        return scene, False

    existing_audio_ref_v199g = _board_batch_scene_audio_ref(scene)
    if existing_audio_ref_v199g:
        print("[BOARD SERVER BATCH EXISTING AUDIO SLICE IGNORED V199G]", {
            "scene_id": _board_batch_scene_id(scene),
            "route": route,
            "audio": str(existing_audio_ref_v199g)[:180],
            "reason": "always_recut_audio_routes_from_master_mixed_song_audio",
        }, flush=True)
        scene = _board_batch_clear_scene_audio_slice_v199g(scene)

    audio_source_path_v199g, audio_ref, source_asset_id, audio_source_errors_v199g = _board_batch_resolve_master_audio_source_v199g(project_id, board_data, payload)
    if audio_source_path_v199g is None:
        raise RuntimeError("missing_master_mixed_audio_for_lipsync_v199g")

    range_info = _board_batch_scene_audio_range(scene)
    if not range_info:
        raise RuntimeError("missing_scene_start_end_for_autoslice")

    start_f, end_f, duration_f = range_info
    source_path = audio_source_path_v199g
    static_root = _settings_static_path()
    target_dir = static_root / "assets" / "manual_clip_audio"
    target_dir.mkdir(parents=True, exist_ok=True)
    scene_id = _safe_name(_board_batch_scene_id(scene) or "scene")
    out_name = f"{scene_id}_{start_f:.3f}_{end_f:.3f}_{uuid4().hex[:12]}.wav".replace(".", "_", 2)
    out_path = target_dir / out_name
    _run_ffmpeg([
        "-y",
        "-ss", f"{start_f:.3f}",
        "-t", f"{duration_f:.3f}",
        "-i", str(source_path),
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "44100",
        "-ac", "2",
        str(out_path),
    ])
    urls = _public_static_url(f"assets/manual_clip_audio/{out_name}")
    patched = dict(scene)
    patched.update({
        "audio_slice_status": "ready",
        "audioSliceStatus": "ready",
        "audio_slice_url": urls.get("url") or urls.get("apiPath") or "",
        "audioSliceUrl": urls.get("url") or urls.get("apiPath") or "",
        "audio_slice_api_path": urls.get("apiPath") or urls.get("url") or "",
        "audioSliceApiPath": urls.get("apiPath") or urls.get("url") or "",
        "audio_slice_name": out_name,
        "audioSliceName": out_name,
        "audio_slice_mime": "audio/wav",
        "audioSliceMime": "audio/wav",
        "audio_slice_start": start_f,
        "audioSliceStart": start_f,
        "audio_slice_end": end_f,
        "audioSliceEnd": end_f,
        "audio_slice_duration": duration_f,
        "audioSliceDuration": duration_f,
        "audio_slice_source": "server_batch_master_audio_recut_v199g",
        "audioSliceSource": "server_batch_master_audio_recut_v199g",
        "audio_slice_source_asset_api_path": audio_ref,
        "audioSliceSourceAssetApiPath": audio_ref,
        "audio_slice_source_asset_id": source_asset_id,
        "audioSliceSourceAssetId": source_asset_id,
        "audio_slice_error": "",
        "audioSliceError": "",
    })
    print("[BOARD SERVER BATCH AUTOSLICE WAV V199G]", {
        "project_id": project_id,
        "scene_id": _board_batch_scene_id(scene),
        "route": route,
        "start": start_f,
        "end": end_f,
        "duration": duration_f,
        "audio": patched.get("audio_slice_api_path"),
        "source_ref": audio_ref,
        "source_asset_id": source_asset_id,
    }, flush=True)
    return patched, True

def _board_batch_prepare_auto_audio_slices(
    scenes: list[dict[str, Any]],
    board_data: dict[str, Any],
    payload: Any,
    mode: str,
    project_id: str | None = None,
) -> tuple[list[dict[str, Any]], list[str], list[dict[str, str]]]:
    requested_ids = [str(item or "").strip() for item in ((getattr(payload, "scene_ids", None) or getattr(payload, "sceneIds", None) or []) or [])]
    requested_set = set(requested_ids)
    prepared: list[dict[str, Any]] = []
    auto_sliced: list[str] = []
    failed: list[dict[str, str]] = []

    for scene in scenes:
        if not isinstance(scene, dict):
            prepared.append(scene)
            continue
        scene_id = _board_batch_scene_id(scene)
        if requested_set and scene_id not in requested_set:
            prepared.append(scene)
            continue
        if mode in {"missing", "remaining"} and _board_batch_scene_has_video(scene) and not _board_batch_scene_has_bad_review(scene):
            prepared.append(scene)
            continue
        if not _board_batch_is_audio_slice_route(scene.get("route")):
            prepared.append(scene)
            continue

        existing_audio_ref_v199g = _board_batch_scene_audio_ref(scene)
        if existing_audio_ref_v199g:
            print("[BOARD SERVER BATCH PREPARE OLD AUDIO SLICE RECUT V199G]", {
                "scene_id": scene_id,
                "route": scene.get("route"),
                "audio": str(existing_audio_ref_v199g)[:180],
                "reason": "always_recut_audio_routes_from_master_mixed_song_audio",
            }, flush=True)
            scene = _board_batch_clear_scene_audio_slice_v199g(scene)

        try:
            patched, sliced = _board_batch_cut_audio_slice_for_scene(scene, board_data, payload, project_id=project_id)
            prepared.append(patched)
            if sliced:
                auto_sliced.append(scene_id)
        except Exception as exc:
            err = str(exc) or "auto_audio_slice_failed"
            patched = dict(scene)
            patched.update({
                "audio_slice_status": "error",
                "audioSliceStatus": "error",
                "audio_slice_error": err,
                "audioSliceError": err,
            })
            prepared.append(patched)
            failed.append({"sceneId": scene_id, "error": err})
            print("[BOARD SERVER BATCH AUTOSLICE ERROR V199G]", {"scene_id": scene_id, "error": err}, flush=True)

    if auto_sliced or failed:
        print("[BOARD SERVER BATCH AUTOSLICE V199G]", {
            "autoSliced": auto_sliced,
            "failed": failed,
            "audioSourcePresent": bool(_board_batch_root_audio_source(board_data, payload)[0] or _board_batch_root_audio_source(board_data, payload)[1]),
            "audioFallbackCandidateCountV151A": len(_board_batch_root_audio_candidates_v151a(project_id, board_data, payload)),
        }, flush=True)
    return prepared, auto_sliced, failed

def _board_batch_prompt(scene: dict[str, Any]) -> str:
    return str(
        scene.get("video_prompt") or scene.get("videoPrompt") or
        scene.get("positive_prompt") or scene.get("positivePrompt") or
        scene.get("prompt") or ""
    ).strip()


def _board_batch_negative_prompt(scene: dict[str, Any]) -> str:
    return str(scene.get("negative_prompt") or scene.get("negativePrompt") or "text, watermark, logo, distorted face, extra limbs, low quality").strip()


def _board_batch_duration(scene: dict[str, Any]) -> float:
    for key in ["target_duration_sec", "targetDurationSec", "duration_sec", "durationSec"]:
        try:
            value = float(scene.get(key) or 0)
            if value > 0:
                return value
        except Exception:
            pass
    try:
        start = float(scene.get("start") or scene.get("scene_start_sec") or scene.get("sceneStartSec") or 0)
        end = float(scene.get("end") or scene.get("scene_end_sec") or scene.get("sceneEndSec") or 0)
        if end > start:
            return max(0.05, end - start)
    except Exception:
        pass
    return 4.0


def _board_batch_size(scene: dict[str, Any]) -> tuple[int, int]:
    try:
        width = int(scene.get("width") or scene.get("video_width") or scene.get("videoWidth") or 0)
        height = int(scene.get("height") or scene.get("video_height") or scene.get("videoHeight") or 0)
        if width > 0 and height > 0:
            return width, height
    except Exception:
        pass
    fmt = str(scene.get("format") or scene.get("aspect_ratio") or scene.get("aspectRatio") or "").lower()
    if "9:16" in fmt or "vertical" in fmt:
        return 720, 1280
    return 1280, 720


# AVA_BOARD_SERVER_BATCH_IGNORE_IMAGE_AS_VIDEO_V131E:
# Old Board snapshots sometimes copied the still image asset into video_url/video_api_path while
# video_status stayed empty. That made the server batch think the scene already had a video and
# return "nothing_to_queue". Treat video refs that equal the start-image ref as NOT a completed video.
def _board_batch_scene_has_video(scene: dict[str, Any]) -> bool:
    status = str(scene.get("video_status") or scene.get("videoStatus") or "").strip().lower()
    active_or_empty = {
        "",
        "empty",
        "queued",
        "starting",
        "preparing",
        "submitting",
        "running",
        "queued_no_prompt_id",
        "generating",
        "processing",
    }
    if status in active_or_empty:
        return False

    video_ref = _board_batch_media_ref(scene, [
        "video_api_path", "videoApiPath",
        "video_url", "videoUrl",
        "result_video_api_path", "resultVideoApiPath",
        "result_video_url", "resultVideoUrl",
    ])
    video_asset_id = str(
        scene.get("video_asset_id") or scene.get("videoAssetId") or
        scene.get("result_video_asset_id") or scene.get("resultVideoAssetId") or ""
    ).strip()

    if not video_ref and not video_asset_id and not scene.get("video_name") and not scene.get("videoName"):
        return False

    image_ref = _board_batch_scene_image_ref(scene)
    image_asset_id = str(
        scene.get("image_asset_id") or scene.get("imageAssetId") or
        scene.get("first_image_asset_id") or scene.get("firstImageAssetId") or
        scene.get("first_frame_asset_id") or scene.get("firstFrameAssetId") or
        scene.get("start_image_asset_id") or scene.get("startImageAssetId") or ""
    ).strip()

    if video_ref and image_ref and str(video_ref).strip() == str(image_ref).strip():
        return False
    if video_asset_id and image_asset_id and video_asset_id == image_asset_id:
        return False

    ready_markers = {"ready", "completed", "complete", "done", "success", "succeeded", "finished"}
    if status in ready_markers:
        return True
    if scene.get("video_ready_at") or scene.get("videoReadyAt"):
        return True
    if video_asset_id and not image_asset_id:
        return True
    if video_ref and image_ref and str(video_ref).strip() != str(image_ref).strip():
        return True

    return False

def _board_batch_input_problems(scene: dict[str, Any]) -> list[str]:
    route = str(scene.get("route") or "i2v").strip() or "i2v"
    problems: list[str] = []
    if not _board_batch_prompt(scene):
        problems.append("нет video prompt")
    if route not in {"txt2img", "text_to_image", "image_from_text"} and not _board_batch_scene_image_ref(scene):
        problems.append("нет первого/основного кадра")
    if route.startswith("first_last") and not _board_batch_scene_end_image_ref(scene):
        problems.append("нет последнего кадра")
    if route in {"ia2v", "ia2v_lipsync", "ia2v_instrumental", "lip_sync"} and not _board_batch_scene_audio_ref(scene):
        problems.append("нет audio slice для lip-sync")
    return problems


def _board_batch_video_payload(scene: dict[str, Any], project_id: str) -> VideoStartIn:
    route = str(scene.get("route") or "i2v").strip() or "i2v"
    width, height = _board_batch_size(scene)
    duration = _board_batch_duration(scene)
    start_ref = _board_batch_scene_image_ref(scene)
    end_ref = _board_batch_scene_end_image_ref(scene)
    audio_ref = _board_batch_scene_audio_ref(scene)
    fmt = str(scene.get("format") or scene.get("aspect_ratio") or scene.get("aspectRatio") or ("9:16" if height > width else "16:9")).strip()
    workflow_key = str(WORKFLOW_ROUTE_MAP.get(route) or scene.get("workflow_key") or scene.get("workflowKey") or "")
    print("[BOARD SERVER BATCH START PAYLOAD V193A]", {
        "project_id": project_id,
        "scene_id": _board_batch_scene_id(scene),
        "route": route,
        "workflowKey": workflow_key,
        "image": start_ref,
        "audio": audio_ref,
        "start": scene.get("start") or scene.get("scene_start_sec") or scene.get("sceneStartSec"),
        "end": scene.get("end") or scene.get("scene_end_sec") or scene.get("sceneEndSec"),
        "promptHead": _board_batch_prompt(scene)[:160],
    }, flush=True)
    return VideoStartIn(
        scene_id=_board_batch_scene_id(scene),
        sceneId=_board_batch_scene_id(scene),
        project_id=project_id,
        projectId=project_id,
        route=route,
        workflow_key=workflow_key,
        workflowKey=workflow_key,
        image_url=start_ref,
        imageUrl=start_ref,
        start_image_url=start_ref,
        startImageUrl=start_ref,
        end_image_url=end_ref,
        endImageUrl=end_ref,
        audio_slice_url=audio_ref,
        audioSliceUrl=audio_ref,
        video_prompt=_board_batch_prompt(scene),
        videoPrompt=_board_batch_prompt(scene),
        positive_prompt=_board_batch_prompt(scene),
        positivePrompt=_board_batch_prompt(scene),
        negative_prompt=_board_batch_negative_prompt(scene),
        negativePrompt=_board_batch_negative_prompt(scene),
        width=width,
        height=height,
        format=fmt,
        duration_sec=duration,
        durationSec=duration,
        target_duration_sec=duration,
        targetDurationSec=duration,
        scene_start_sec=float(scene.get("start") or scene.get("scene_start_sec") or scene.get("sceneStartSec") or 0),
        sceneStartSec=float(scene.get("start") or scene.get("scene_start_sec") or scene.get("sceneStartSec") or 0),
        scene_end_sec=float(scene.get("end") or scene.get("scene_end_sec") or scene.get("sceneEndSec") or duration),
        sceneEndSec=float(scene.get("end") or scene.get("scene_end_sec") or scene.get("sceneEndSec") or duration),
    )


def _board_batch_read_snapshot(project_id: str) -> dict[str, Any]:
    db = store.get_db()
    snapshot = (db.get("snapshots") or {}).get(project_id, {}).get("board") or {}
    data = snapshot.get("data") if isinstance(snapshot, dict) else {}
    return copy.deepcopy(data or {})


def _board_batch_save_snapshot(project_id: str, board_data: dict[str, Any], client_version: str = "board-server-video-batch-v131a") -> None:
    def op(db: dict[str, Any]) -> dict[str, Any]:
        db.setdefault("snapshots", {}).setdefault(project_id, {})
        current = db["snapshots"].get(project_id, {}).get("board") or {}
        current_data = current.get("data") if isinstance(current, dict) else {}
        incoming, preserved = preserve_media_refs(current_data or {}, copy.deepcopy(board_data or {}))
        print("[BOARD SERVER BATCH SNAPSHOT]", {
            "project_id": project_id,
            **media_refs_summary(incoming),
            "preservedAssetRefsCount": preserved,
            "client_version": client_version,
        }, flush=True)
        snapshot = {
            "stage": "board",
            "data": incoming,
            "client_version": client_version,
            "updated_at": now_iso(),
        }
        db["snapshots"][project_id]["board"] = snapshot
        if project_id in db.get("projects", {}):
            db["projects"][project_id]["updated_at"] = now_iso()
        return snapshot
    store.update(op)



# AVA_BOARD_BAD_REVIEW_SERVER_BATCH_V132A
# Board review flow:
#   bad          -> red mark: regenerate this video, even if old video refs exist.
#   needs_review -> orange mark after regeneration: user must watch and accept/mark bad again.
def _board_batch_review_status(scene: dict[str, Any] | None) -> str:
    if not isinstance(scene, dict):
        return ""
    raw = str(
        scene.get("video_review_status")
        or scene.get("videoReviewStatus")
        or scene.get("review_status")
        or scene.get("reviewStatus")
        or ""
    ).strip().lower()
    if raw in {"bad", "poor", "reject", "rejected", "плохое", "плохая"}:
        return "bad"
    if raw in {"needs_review", "review", "check", "посмотри", "на проверку"}:
        return "needs_review"
    return ""


def _board_batch_scene_has_bad_review(scene: dict[str, Any] | None) -> bool:
    return _board_batch_review_status(scene) == "bad"


def _board_batch_scene_was_bad_before_regenerate(scene: dict[str, Any] | None) -> bool:
    if not isinstance(scene, dict):
        return False
    return bool(scene.get("video_review_regenerate_from_bad") or scene.get("videoReviewRegenerateFromBad")) or _board_batch_scene_has_bad_review(scene)


def _board_batch_review_patch(status: str = "", reason: str = "manual") -> dict[str, Any]:
    safe_status = str(status or "").strip().lower()
    if safe_status not in {"bad", "needs_review"}:
        safe_status = ""
    now_value = _board_batch_now()
    return {
        "video_review_status": safe_status,
        "videoReviewStatus": safe_status,
        "review_status": safe_status,
        "reviewStatus": safe_status,
        "video_review_updated_at": now_value,
        "videoReviewUpdatedAt": now_value,
        "video_review_reason": reason,
        "videoReviewReason": reason,
    }


def _board_batch_review_regenerate_flag_patch(was_bad: bool = False, reason: str = "") -> dict[str, Any]:
    return {
        "video_review_regenerate_from_bad": bool(was_bad),
        "videoReviewRegenerateFromBad": bool(was_bad),
        "video_review_regenerate_reason": reason,
        "videoReviewRegenerateReason": reason,
    }


def _board_batch_bad_review_start_patch(scene: dict[str, Any] | None = None, was_bad: bool = False) -> dict[str, Any]:
    if not was_bad:
        return _board_batch_review_regenerate_flag_patch(False, "")

    # AVA_BOARD_BAD_REVIEW_KEEP_OLD_VIDEO_WHILE_REGEN_V132C:
    # For "плохое" review regeneration we must NOT remove the old video immediately.
    # The old video stays visible, but the scene is marked queued/running. When the
    # new result returns it replaces this video and becomes needs_review ("посмотри").
    patch: dict[str, Any] = {}
    patch.update(_board_batch_review_patch("bad", "bad_video_regeneration_started"))
    patch.update(_board_batch_review_regenerate_flag_patch(True, "server_batch_regenerate_bad_review"))

    if isinstance(scene, dict):
        for key in (
            "video_asset_id", "videoAssetId",
            "video_api_path", "videoApiPath",
            "video_url", "videoUrl",
            "video_static_url", "videoStaticUrl",
            "video_path", "videoPath",
            "video_name", "videoName",
            "video_result", "videoResult",
            "result_video_asset_id", "resultVideoAssetId",
            "result_video_api_path", "resultVideoApiPath",
            "result_video_url", "resultVideoUrl",
        ):
            if key in scene:
                patch[key] = copy.deepcopy(scene.get(key))

    patch.update({
        "video_status": "queued",
        "videoStatus": "queued",
        "video_queue_source": "bad_review_regeneration",
        "videoQueueSource": "bad_review_regeneration",
        "video_reset_reason": "bad_review_regeneration_started",
        "videoResetReason": "bad_review_regeneration_started",
    })
    return patch


def _board_batch_result_patch(data: dict[str, Any], job: dict[str, Any]) -> dict[str, Any]:
    asset_id = str(data.get("videoAssetId") or data.get("video_asset_id") or data.get("assetId") or data.get("asset_id") or "").strip()
    api_path = str(data.get("videoApiPath") or data.get("video_api_path") or data.get("resultVideoApiPath") or data.get("result_video_api_path") or "").strip()
    url = api_path or str(data.get("videoUrl") or data.get("video_url") or data.get("resultVideoUrl") or data.get("result_video_url") or "").strip()
    return {
        "video_url": url,
        "videoUrl": url,
        "video_api_path": api_path or url,
        "videoApiPath": api_path or url,
        "video_asset_id": asset_id,
        "videoAssetId": asset_id,
        "video_name": data.get("videoName") or data.get("video_name") or "video.mp4",
        "videoName": data.get("videoName") or data.get("video_name") or "video.mp4",
        "original_video_url": data.get("originalVideoUrl") or data.get("original_video_url") or "",
        "originalVideoUrl": data.get("originalVideoUrl") or data.get("original_video_url") or "",
        "video_status": "ready",
        "videoStatus": "ready",
        "video_job_id": "",
        "videoJobId": "",
        "video_status_endpoint": "",
        "videoStatusEndpoint": "",
        "video_queue_position": 0,
        "videoQueuePosition": 0,
        "video_error": "",
        "videoError": "",
        "video_result": data or None,
        "videoResult": data or None,
        "video_ready_at": _board_batch_now(),
        "videoReadyAt": _board_batch_now(),
        "server_batch_job_id": job.get("jobId") or job.get("job_id") or "",
        "serverBatchJobId": job.get("jobId") or job.get("job_id") or "",

        # AVA_BOARD_NEW_VIDEO_CLEAR_STALE_REVIEW_V203C:
        # A fresh completed video must not inherit an old Telegram/manual red "bad" mark.
        # If this result came from bad-review regeneration, the runner below overwrites this
        # to needs_review / "посмотри" after building the result patch.
        "video_review_status": "",
        "videoReviewStatus": "",
        "review_status": "",
        "reviewStatus": "",
        "video_review_reason": "",
        "videoReviewReason": "",
        "review_reason": "",
        "reviewReason": "",
        "video_review_clear_reason": "new_video_result_clear_stale_review_v203c",
        "videoReviewClearReason": "new_video_result_clear_stale_review_v203c",
        "video_review_cleared_at": _board_batch_now(),
        "videoReviewClearedAt": _board_batch_now(),
        "video_review_regenerate_from_bad": False,
        "videoReviewRegenerateFromBad": False,
        "video_review_regenerate_reason": "",
        "videoReviewRegenerateReason": "",
        "bad_video_review": False,
        "badVideoReview": False,
        "video_review_bad": False,
        "videoReviewBad": False,
        "bad_video": False,
        "badVideo": False,
        "video_bad": False,
        "videoBad": False,
        "is_bad_video": False,
        "isBadVideo": False,
        "needs_review": False,
        "needsReview": False,
    }


def _board_batch_job_active_patch(start_data: dict[str, Any], scene: dict[str, Any]) -> dict[str, Any]:
    job_id = str(start_data.get("jobId") or start_data.get("job_id") or "").strip()
    endpoint = start_data.get("statusEndpoint") or (f"/api/clip/video/status/{job_id}" if job_id else "")
    return {
        "video_status": start_data.get("status") or "queued",
        "videoStatus": start_data.get("status") or "queued",
        "video_job_id": job_id,
        "videoJobId": job_id,
        "video_status_endpoint": endpoint,
        "videoStatusEndpoint": endpoint,
        "video_queue_position": 0,
        "videoQueuePosition": 0,
        "video_error": "",
        "videoError": "",
        "video_result": start_data or None,
        "videoResult": start_data or None,
        "video_url": "",
        "videoUrl": "",
        "video_api_path": "",
        "videoApiPath": "",
        "video_asset_id": "",
        "videoAssetId": "",
    }



# AVA_BOARD_MANUAL_QUEUE_STALE_LOCK_V200A:
# Frontend/manual scene queue can leave a scene in starting/submitting/running with no job_id
# when /clip/video/start fails between the UI start mark and the real backend job creation.
# Clear these stale scene locks from snapshot during video-batch/status polling so a stuck
# card cannot block the next manual queued scene forever.
def _board_batch_parse_iso_dt_v200a(value: Any) -> datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        parsed = datetime.fromisoformat(raw)
        if parsed.tzinfo is not None:
            parsed = parsed.astimezone().replace(tzinfo=None)
        return parsed
    except Exception:
        return None


def _board_batch_clear_stale_manual_scene_locks_v200a(
    project_id: str,
    board_data: dict[str, Any],
    *,
    max_age_sec: int = 90,
    reason: str = "stale_manual_start_without_job_v200a",
) -> tuple[dict[str, Any], list[str]]:
    scenes = board_data.get("scenes") if isinstance(board_data.get("scenes"), list) else []
    if not scenes:
        return board_data, []
    now_dt = datetime.utcnow()
    transient = {"starting", "preparing", "submitting", "running", "processing", "queued_no_prompt_id"}
    changed = False
    cleared: list[str] = []
    next_scenes: list[Any] = []
    for scene in scenes:
        if not isinstance(scene, dict):
            next_scenes.append(scene)
            continue
        status = str(scene.get("video_status") or scene.get("videoStatus") or "").strip().lower()
        has_job = bool(
            str(scene.get("video_job_id") or scene.get("videoJobId") or "").strip() or
            str(scene.get("video_status_endpoint") or scene.get("videoStatusEndpoint") or "").strip() or
            str(scene.get("server_batch_job_id") or scene.get("serverBatchJobId") or "").strip() or
            str(scene.get("server_batch_status_endpoint") or scene.get("serverBatchStatusEndpoint") or "").strip()
        )
        if status not in transient or has_job:
            next_scenes.append(scene)
            continue
        stamp = None
        for key in ("video_started_at", "videoStartedAt", "video_updated_at", "videoUpdatedAt", "updatedAt", "updated_at"):
            stamp = _board_batch_parse_iso_dt_v200a(scene.get(key))
            if stamp is not None:
                break
        age = 10**9 if stamp is None else (now_dt - stamp).total_seconds()
        if age < max_age_sec:
            next_scenes.append(scene)
            continue
        scene_id = _board_batch_scene_id(scene)
        has_video = _board_batch_scene_has_video(scene)
        patched = dict(scene)
        patched.update({
            "video_status": "ready" if has_video else "error",
            "videoStatus": "ready" if has_video else "error",
            "video_error": "" if has_video else reason,
            "videoError": "" if has_video else reason,
            "video_job_id": "",
            "videoJobId": "",
            "video_status_endpoint": "",
            "videoStatusEndpoint": "",
            "server_batch_job_id": "",
            "serverBatchJobId": "",
            "server_batch_status_endpoint": "",
            "serverBatchStatusEndpoint": "",
            "video_queue_position": 0,
            "videoQueuePosition": 0,
            "video_queue_source": "",
            "videoQueueSource": "",
            "video_batch_active_v132r": False,
            "videoBatchActiveV132R": False,
            "video_interrupted_reason": reason,
            "videoInterruptedReason": reason,
            "video_updated_at": _board_batch_now(),
            "videoUpdatedAt": _board_batch_now(),
        })
        next_scenes.append(patched)
        changed = True
        if scene_id:
            cleared.append(scene_id)
    if not changed:
        return board_data, []
    board_data["scenes"] = next_scenes
    current_queue = board_data.get("video_queue") if isinstance(board_data.get("video_queue"), dict) else {}
    waiting = [item for item in (current_queue.get("waitingSceneIds") or current_queue.get("waiting_scene_ids") or []) if str(item or "").strip() not in set(cleared)]
    board_data["video_queue"] = {
        **current_queue,
        "activeSceneId": "",
        "activeJobId": "",
        "activeStatusEndpoint": "",
        "waitingSceneIds": waiting,
        "waiting_scene_ids": waiting,
        "source": reason,
        "updatedAt": _board_batch_now(),
    }
    board_data["videoQueue"] = dict(board_data["video_queue"])
    board_data["updatedAt"] = _board_batch_now()
    board_data["updated_at"] = _board_batch_now()
    print("[BOARD MANUAL QUEUE STALE LOCK CLEAR V200A]", {"project_id": project_id, "clearedSceneIds": cleared, "reason": reason}, flush=True)
    return board_data, cleared


def _board_batch_error_patch(status: str, detail: Any = None) -> dict[str, Any]:
    return {
        "video_status": status or "error",
        "videoStatus": status or "error",
        "video_error": str(detail or status or "error"),
        "videoError": str(detail or status or "error"),
        "video_job_id": "",
        "videoJobId": "",
        "video_status_endpoint": "",
        "videoStatusEndpoint": "",
        "video_queue_position": 0,
        "videoQueuePosition": 0,
    }


def _board_batch_update_scene(project_id: str, scene_id: str, patch: dict[str, Any], batch_patch: dict[str, Any] | None = None) -> dict[str, Any]:
    board_data = _board_batch_read_snapshot(project_id)
    scenes = board_data.get("scenes") if isinstance(board_data.get("scenes"), list) else []
    next_scenes = []
    changed = False
    # AVA_BOARD_BATCH_READY_ACTIVE_CLEAR_V148A:
    # If a patch contains a real video result, it is authoritative and must clear any
    # stale job/status fields from previous queue state before the snapshot is saved.
    patch_video_ref_v148a = bool(
        patch.get("video_asset_id") or patch.get("videoAssetId") or
        patch.get("video_api_path") or patch.get("videoApiPath") or
        patch.get("video_url") or patch.get("videoUrl") or
        patch.get("result_video_asset_id") or patch.get("resultVideoAssetId") or
        patch.get("result_video_api_path") or patch.get("resultVideoApiPath") or
        patch.get("result_video_url") or patch.get("resultVideoUrl")
    )
    if patch_video_ref_v148a:
        patch = {
            **patch,
            "video_status": "ready",
            "videoStatus": "ready",
            "video_job_id": "",
            "videoJobId": "",
            "video_status_endpoint": "",
            "videoStatusEndpoint": "",
            "video_queue_position": 0,
            "videoQueuePosition": 0,
            "video_error": "",
            "videoError": "",
            "video_queue_source": "",
            "videoQueueSource": "",
        }
    for scene in scenes:
        if _board_batch_scene_id(scene) == scene_id:
            next_scenes.append({**scene, **patch})
            changed = True
        else:
            next_scenes.append(scene)
    if changed:
        board_data["scenes"] = next_scenes
    if batch_patch is not None:
        current_batch = board_data.get("board_video_batch") if isinstance(board_data.get("board_video_batch"), dict) else {}
        board_data["board_video_batch"] = {**current_batch, **batch_patch, "updatedAt": _board_batch_now(), "updated_at": _board_batch_now()}
        q_patch = batch_patch.get("video_queue") if isinstance(batch_patch.get("video_queue"), dict) else None
        if q_patch is not None:
            current_queue = board_data.get("video_queue") if isinstance(board_data.get("video_queue"), dict) else {}
            board_data["video_queue"] = {**current_queue, **q_patch, "updatedAt": _board_batch_now()}
    board_data["updatedAt"] = _board_batch_now()
    _board_batch_save_snapshot(project_id, board_data)
    return board_data


def _board_batch_start_scene(project_id: str, batch_id: str, scene: dict[str, Any], user: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    scene_id = _board_batch_scene_id(scene)
    payload = _board_batch_video_payload(scene, project_id)
    start_data = start_video(payload, user)
    job_id = str(start_data.get("jobId") or start_data.get("job_id") or "").strip()
    if not job_id:
        raise RuntimeError("video_start_returned_no_job_id")
    _board_batch_update_scene(project_id, scene_id, _board_batch_job_active_patch(start_data, scene), {
        "batch_id": batch_id,
        "batchId": batch_id,
        "status": "running",
        "active_scene_id": scene_id,
        "activeSceneId": scene_id,
        "active_job_id": job_id,
        "activeJobId": job_id,
        "active_status_endpoint": start_data.get("statusEndpoint") or f"/api/clip/video/status/{job_id}",
        "activeStatusEndpoint": start_data.get("statusEndpoint") or f"/api/clip/video/status/{job_id}",
        "video_queue": {
            "activeSceneId": scene_id,
            "activeJobId": job_id,
            "activeStatusEndpoint": start_data.get("statusEndpoint") or f"/api/clip/video/status/{job_id}",
        },
    })
    print("[BOARD SERVER BATCH START SCENE]", {"project_id": project_id, "batch_id": batch_id, "scene_id": scene_id, "job_id": job_id}, flush=True)
    return job_id, start_data


def _board_batch_wait_job(project_id: str, batch_id: str, scene_id: str, job_id: str, user: dict[str, Any], max_attempts: int = 240) -> tuple[str, dict[str, Any]]:
    # AVA_BOARD_COMFY_STALL_WATCHDOG_V203A:
    # ComfyUI can occasionally freeze around LTX model initialization / VAE stage. In that
    # case /history stays empty and the frontend keeps polling Board batch status forever.
    # Use elapsed wall-clock time, not job.updatedAt, because status polling refreshes updatedAt.
    time_mod_v203a = __import__('time')
    try:
        poll_seconds_v203a = max(1.0, float(os.getenv("AVA_BOARD_BATCH_POLL_SEC", "3.5") or 3.5))
    except Exception:
        poll_seconds_v203a = 3.5
    try:
        stall_seconds_v203a = max(120.0, float(os.getenv("AVA_BOARD_BATCH_SCENE_TIMEOUT_SEC", "900") or 900))
    except Exception:
        stall_seconds_v203a = 900.0
    computed_attempts_v203a = max(1, int(stall_seconds_v203a / poll_seconds_v203a))
    if max_attempts == 240:
        max_attempts = computed_attempts_v203a

    started_at_v203a = time_mod_v203a.time()
    last_log_at_v203a = 0.0
    last_data_v203a: dict[str, Any] = {}

    def _timeout_payload_v203a(reason: str, data: dict[str, Any] | None = None) -> tuple[str, dict[str, Any]]:
        job_v203a = BOARD_VIDEO_JOBS.get(job_id) or _board_video_job_load(job_id) or {}
        prompt_id_v203a = job_v203a.get("promptId") or job_v203a.get("prompt_id") or (data or {}).get("promptId") or (data or {}).get("prompt_id")
        base_url_v203a = job_v203a.get("targetComfyBaseUrl") or job_v203a.get("target_comfy_base_url") or (data or {}).get("targetComfyBaseUrl") or (data or {}).get("target_comfy_base_url") or _main_comfy_url()
        cancel_result_v203a: dict[str, Any] = {}
        try:
            if base_url_v203a:
                cancel_result_v203a = _cancel_comfy_prompt(str(base_url_v203a), str(prompt_id_v203a or "") or None, interrupt=True, clear_pending=False)
        except Exception as exc:
            cancel_result_v203a = {"ok": False, "error": str(exc)}

        now_v203a = now_iso()
        job_v203a.update({
            "status": "timeout_stalled_comfy_v203a",
            "video_status": "error",
            "videoStatus": "error",
            "error": reason,
            "video_error": reason,
            "videoError": reason,
            "stalledAt": now_v203a,
            "updatedAt": now_v203a,
            "comfyStallWatchdogV203A": True,
            "cancelResultV203A": cancel_result_v203a,
        })
        try:
            _board_video_job_store(job_id, job_v203a)
        except Exception:
            pass

        payload_v203a = {
            "status": "timeout_stalled_comfy_v203a",
            "video_status": "error",
            "error": reason,
            "jobId": job_id,
            "job_id": job_id,
            "sceneId": scene_id,
            "scene_id": scene_id,
            "projectId": project_id,
            "project_id": project_id,
            "promptId": prompt_id_v203a or "",
            "prompt_id": prompt_id_v203a or "",
            "cancelResult": cancel_result_v203a,
            "cancel_result": cancel_result_v203a,
            "lastStatus": data or last_data_v203a or {},
        }
        print("[BOARD SERVER BATCH COMFY STALL WATCHDOG V203A]", {
            "project_id": project_id,
            "batch_id": batch_id,
            "scene_id": scene_id,
            "job_id": job_id,
            "elapsedSec": round(time_mod_v203a.time() - started_at_v203a, 1),
            "timeoutSec": stall_seconds_v203a,
            "promptId": prompt_id_v203a or "",
            "reason": reason,
            "cancelResult": cancel_result_v203a,
        }, flush=True)
        return "error", payload_v203a

    for attempt in range(1, max_attempts + 1):
        batch = BOARD_VIDEO_BATCHES.get(batch_id) or {}
        if batch.get("cancelRequested"):
            return "canceled", {"status": "canceled"}

        elapsed_v203a = time_mod_v203a.time() - started_at_v203a
        if elapsed_v203a >= stall_seconds_v203a:
            return _timeout_payload_v203a(f"comfy job stalled for {int(elapsed_v203a)}s without video output")

        try:
            data = video_status(job_id, user)
            last_data_v203a = data if isinstance(data, dict) else {}
        except Exception as exc:
            data = {"status": "poll_error", "error": str(exc)}
            last_data_v203a = data

        status_text = str(data.get("status") or data.get("video_status") or "running").lower()
        video_url = data.get("videoUrl") or data.get("video_url") or data.get("videoApiPath") or data.get("video_api_path")
        if video_url:
            return "ready", data
        if status_text.startswith("blocked_") or status_text in {"error", "failed", "queued_no_prompt_id", "output_download_failed", "output_finalize_failed", "completed_without_video_output", "not_found", "timeout_stalled_comfy_v203a"}:
            return "error", data

        if elapsed_v203a - last_log_at_v203a >= 60.0:
            last_log_at_v203a = elapsed_v203a
            print("[BOARD SERVER BATCH WATCHDOG HEARTBEAT V203A]", {
                "project_id": project_id,
                "batch_id": batch_id,
                "scene_id": scene_id,
                "job_id": job_id,
                "attempt": attempt,
                "elapsedSec": round(elapsed_v203a, 1),
                "timeoutSec": stall_seconds_v203a,
                "status": status_text,
                "promptId": data.get("promptId") or data.get("prompt_id") or "",
            }, flush=True)
        time_mod_v203a.sleep(poll_seconds_v203a)

    return _timeout_payload_v203a("board server batch polling timeout watchdog reached", last_data_v203a)


def _board_video_batch_runner(project_id: str, batch_id: str, user: dict[str, Any]) -> None:
    # AVA_BOARD_SERVER_BATCH_LOCAL_TIME_IMPORT_V131H: runner uses __import__('time').sleep while polling Comfy/job status.
    import time
    batch = BOARD_VIDEO_BATCHES.get(batch_id)
    if not isinstance(batch, dict):
        return
    try:
        waiting_ids = list(batch.get("waitingSceneIds") or [])
        completed: list[str] = []
        failed: list[str] = []
        while waiting_ids:
            if batch.get("cancelRequested"):
                batch["status"] = "canceled"
                break
            scene_id = waiting_ids.pop(0)
            board_data = _board_batch_read_snapshot(project_id)
            scenes = board_data.get("scenes") if isinstance(board_data.get("scenes"), list) else []
            scene = next((item for item in scenes if _board_batch_scene_id(item) == scene_id), None)
            if not scene:
                failed.append(scene_id)
                continue
            # AVA_BOARD_BATCH_RECUT_AUDIO_ON_DEMAND_V201B:
            # A browser snapshot can wipe backend-created audio_slice_* refs between
            # batch start and the moment this scene is pulled from the queue. Recut
            # the lip-sync slice right here instead of failing and jumping over ia2v
            # scenes to later i2v scenes.
            if _board_batch_is_audio_slice_route(scene.get("route")) and not _board_batch_scene_audio_ref(scene):
                try:
                    recut_scene_v201b, recut_done_v201b = _board_batch_cut_audio_slice_for_scene(
                        scene,
                        board_data,
                        None,
                        project_id=project_id,
                    )
                    if recut_done_v201b:
                        scene = recut_scene_v201b
                        _board_batch_update_scene(project_id, scene_id, recut_scene_v201b, {
                            "batch_id": batch_id,
                            "batchId": batch_id,
                            "status": "running",
                            "active_scene_id": scene_id,
                            "activeSceneId": scene_id,
                            "waiting_scene_ids": waiting_ids,
                            "waitingSceneIds": waiting_ids,
                            "video_queue": {
                                "activeSceneId": scene_id,
                                "activeJobId": "",
                                "activeStatusEndpoint": "",
                                "waitingSceneIds": waiting_ids,
                                "waiting_scene_ids": waiting_ids,
                            },
                        })
                        print("[BOARD SERVER BATCH RECUT AUDIO ON DEMAND V201B]", {
                            "project_id": project_id,
                            "batch_id": batch_id,
                            "scene_id": scene_id,
                            "route": scene.get("route"),
                            "audio": _board_batch_scene_audio_ref(scene),
                        }, flush=True)
                except Exception as exc:
                    scene = {
                        **scene,
                        "audio_slice_status": "error",
                        "audioSliceStatus": "error",
                        "audio_slice_error": str(exc) or "recut_audio_on_demand_failed_v201b",
                        "audioSliceError": str(exc) or "recut_audio_on_demand_failed_v201b",
                    }
                    print("[BOARD SERVER BATCH RECUT AUDIO ON DEMAND ERROR V201B]", {
                        "project_id": project_id,
                        "batch_id": batch_id,
                        "scene_id": scene_id,
                        "route": scene.get("route"),
                        "error": str(exc),
                    }, flush=True)

            problems = _board_batch_input_problems(scene)
            if problems:
                failed.append(scene_id)
                _board_batch_update_scene(project_id, scene_id, _board_batch_error_patch("error", ", ".join(problems)), {
                    "batch_id": batch_id,
                    "status": "running" if waiting_ids else "finished_with_errors",
                    "failed_scene_ids": failed,
                    "failedSceneIds": failed,
                    "waiting_scene_ids": waiting_ids,
                    "waitingSceneIds": waiting_ids,
                    "video_queue": {"waitingSceneIds": waiting_ids, "waiting_scene_ids": waiting_ids},
                })
                continue

            batch.update({"activeSceneId": scene_id, "waitingSceneIds": waiting_ids, "updatedAt": _board_batch_now()})
            job_id = ""
            try:
                job_id, start_data = _board_batch_start_scene(project_id, batch_id, scene, user)
                batch.update({"activeJobId": job_id, "activeStatusEndpoint": start_data.get("statusEndpoint") or f"/api/clip/video/status/{job_id}"})
            except Exception as exc:
                failed.append(scene_id)
                _board_batch_update_scene(project_id, scene_id, _board_batch_error_patch("error", exc), {
                    "batch_id": batch_id,
                    "status": "running" if waiting_ids else "finished_with_errors",
                    "failed_scene_ids": failed,
                    "failedSceneIds": failed,
                    "waiting_scene_ids": waiting_ids,
                    "waitingSceneIds": waiting_ids,
                    "video_queue": {"activeSceneId": "", "activeJobId": "", "activeStatusEndpoint": "", "waitingSceneIds": waiting_ids, "waiting_scene_ids": waiting_ids},
                })
                batch.update({"activeSceneId": "", "activeJobId": "", "activeStatusEndpoint": "", "updatedAt": _board_batch_now()})
                continue

            result_status, result_data = _board_batch_wait_job(project_id, batch_id, scene_id, job_id, user)
            if result_status == "ready":
                completed.append(scene_id)
                live_board_data_v132b = _board_batch_read_snapshot(project_id)
                live_scenes_v132b = live_board_data_v132b.get("scenes") if isinstance(live_board_data_v132b.get("scenes"), list) else []
                live_scene_for_ready_v132b = next((item for item in live_scenes_v132b if _board_batch_scene_id(item) == scene_id), {}) or {}
                bad_review_ids_v132b = set(batch.get("badReviewSceneIds") or batch.get("bad_review_scene_ids") or [])
                was_bad_review_regeneration_v132a = (
                    scene_id in bad_review_ids_v132b
                    or _board_batch_scene_was_bad_before_regenerate(scene)
                    or _board_batch_scene_was_bad_before_regenerate(live_scene_for_ready_v132b)
                )
                ready_patch_v132a = _board_batch_result_patch(result_data, {"jobId": job_id, "projectId": project_id})

                # AVA_BOARD_BIND_RESULT_TO_CURRENT_IMAGE_V132I:
                # When a scene image is replaced, the new server-batch video result must be
                # bound to that current image. Otherwise the frontend stale-image guard can
                # hide the returned video and show only "кадр готов".
                source_scene_for_video_current_v132i = (
                    live_scene_for_ready_v132b
                    if isinstance(live_scene_for_ready_v132b, dict) and live_scene_for_ready_v132b
                    else scene
                )
                source_map_v132i = {
                    "video_source_image_mutation_epoch": (
                        "image_mutation_epoch", "imageMutationEpoch",
                        "start_image_mutation_epoch", "startImageMutationEpoch",
                        "first_image_mutation_epoch", "firstImageMutationEpoch",
                    ),
                    "videoSourceImageMutationEpoch": (
                        "image_mutation_epoch", "imageMutationEpoch",
                        "start_image_mutation_epoch", "startImageMutationEpoch",
                        "first_image_mutation_epoch", "firstImageMutationEpoch",
                    ),
                    "video_source_image_asset_id": (
                        "image_asset_id", "imageAssetId",
                        "start_image_asset_id", "startImageAssetId",
                        "first_image_asset_id", "firstImageAssetId",
                        "photo_asset_id", "photoAssetId",
                    ),
                    "videoSourceImageAssetId": (
                        "image_asset_id", "imageAssetId",
                        "start_image_asset_id", "startImageAssetId",
                        "first_image_asset_id", "firstImageAssetId",
                        "photo_asset_id", "photoAssetId",
                    ),
                    "video_source_image_api_path": (
                        "image_api_path", "imageApiPath",
                        "start_image_api_path", "startImageApiPath",
                        "first_image_api_path", "firstImageApiPath",
                        "photo_api_path", "photoApiPath",
                    ),
                    "videoSourceImageApiPath": (
                        "image_api_path", "imageApiPath",
                        "start_image_api_path", "startImageApiPath",
                        "first_image_api_path", "firstImageApiPath",
                        "photo_api_path", "photoApiPath",
                    ),
                    "video_source_image_url": (
                        "image_url", "imageUrl",
                        "start_image_url", "startImageUrl",
                        "first_image_url", "firstImageUrl",
                        "photo_url", "photoUrl",
                    ),
                    "videoSourceImageUrl": (
                        "image_url", "imageUrl",
                        "start_image_url", "startImageUrl",
                        "first_image_url", "firstImageUrl",
                        "photo_url", "photoUrl",
                    ),
                }
                if isinstance(source_scene_for_video_current_v132i, dict):
                    for target_key_v132i, source_keys_v132i in source_map_v132i.items():
                        for source_key_v132i in source_keys_v132i:
                            value_v132i = source_scene_for_video_current_v132i.get(source_key_v132i)
                            if value_v132i not in (None, ""):
                                ready_patch_v132a[target_key_v132i] = value_v132i
                                break
                    ready_patch_v132a["video_source_bound_at"] = __import__("time").time()
                    ready_patch_v132a["videoSourceBoundAt"] = ready_patch_v132a["video_source_bound_at"]
                    print("[BOARD SERVER BATCH VIDEO BOUND TO IMAGE V132I]", {
                        "project_id": project_id,
                        "batch_id": batch_id,
                        "scene_id": scene_id,
                        "job_id": job_id,
                        "sourceImageAssetId": ready_patch_v132a.get("video_source_image_asset_id") or ready_patch_v132a.get("videoSourceImageAssetId"),
                        "sourceImageApiPath": ready_patch_v132a.get("video_source_image_api_path") or ready_patch_v132a.get("videoSourceImageApiPath"),
                        "sourceImageEpoch": ready_patch_v132a.get("video_source_image_mutation_epoch") or ready_patch_v132a.get("videoSourceImageMutationEpoch"),
                    }, flush=True)
                ready_patch_v132a.update(_board_batch_review_regenerate_flag_patch(False, "completed"))
                if was_bad_review_regeneration_v132a:
                    # AVA_BOARD_BATCH_POSMOTRI_UPDATED_AT_V200L:
                    # Persist a fresh review timestamp so project snapshot review-event authority
                    # does not resurrect an older Telegram/manual "bad" mark after regeneration.
                    review_now_v200l = now_iso()
                    ready_patch_v132a.update(_board_batch_review_patch("needs_review", "bad_video_regenerated"))
                    # AVA_BOARD_BAD_REVIEW_FORCE_POSMOTRI_BACKEND_V132G:
                    # After a bad video is regenerated, the new result is video-ready
                    # and must be shown as orange "посмотри", not red "плохое".
                    ready_patch_v132a.update({
                        "video_status": "ready",
                        "videoStatus": "ready",
                        "video_review_status": "needs_review",
                        "videoReviewStatus": "needs_review",
                        "review_status": "needs_review",
                        "reviewStatus": "needs_review",
                        "video_review_reason": "bad_video_regenerated",
                        "videoReviewReason": "bad_video_regenerated",
                        "video_review_updated_at": review_now_v200l,
                        "videoReviewUpdatedAt": review_now_v200l,
                        "video_review_regenerate_from_bad": False,
                        "videoReviewRegenerateFromBad": False,
                        "video_review_regenerate_reason": "",
                        "videoReviewRegenerateReason": "",
                        "video_queue_source": "",
                        "videoQueueSource": "",
                        "video_queue_position": None,
                        "videoQueuePosition": None,
                        "video_reset_reason": "",
                        "videoResetReason": "",
                        "bad_video_review": False,
                        "badVideoReview": False,
                        "video_review_bad": False,
                        "videoReviewBad": False,
                        "video_bad": False,
                        "videoBad": False,
                        "is_bad_video": False,
                        "isBadVideo": False,
                    })
                    # AVA_BOARD_BAD_REVIEW_RESULT_NEEDS_REVIEW_V132E:
                    # A regenerated bad video is now a fresh result. Keep the video ready,
                    # but switch review from red "плохое" to orange "посмотри".
                    # Clear all "bad/regenerate" helper flags so UI does not keep showing "плохое".
                    ready_patch_v132a.update({
                        "video_status": "ready",
                        "videoStatus": "ready",
                        "video_review_status": "needs_review",
                        "videoReviewStatus": "needs_review",
                        "review_status": "needs_review",
                        "reviewStatus": "needs_review",
                        "video_review_reason": "bad_video_regenerated",
                        "videoReviewReason": "bad_video_regenerated",
                        "video_review_updated_at": review_now_v200l,
                        "videoReviewUpdatedAt": review_now_v200l,
                        "video_review_regenerate_from_bad": False,
                        "videoReviewRegenerateFromBad": False,
                        "video_review_regenerate_reason": "",
                        "videoReviewRegenerateReason": "",
                        "video_queue_source": "",
                        "videoQueueSource": "",
                        "video_queue_position": None,
                        "videoQueuePosition": None,
                        "video_reset_reason": "",
                        "videoResetReason": "",
                        "bad_video_review": False,
                        "badVideoReview": False,
                        "video_review_bad": False,
                        "videoReviewBad": False,
                        "video_bad": False,
                        "videoBad": False,
                    })
                    print("[BOARD SERVER BATCH REVIEW NEEDS_REVIEW V132B]", {
                        "project_id": project_id,
                        "batch_id": batch_id,
                        "scene_id": scene_id,
                        "job_id": job_id,
                        "reason": "bad_video_regenerated",
                    }, flush=True)
                _board_batch_update_scene(project_id, scene_id, ready_patch_v132a, {
                    "batch_id": batch_id,
                    "batchId": batch_id,
                    "status": "running" if waiting_ids else "finished",
                    # AVA_BOARD_BATCH_READY_ACTIVE_CLEAR_V148A:
                    # The just-finished scene is not active anymore. Leaving it in activeSceneId
                    # makes the frontend runtime overlay show “видео делается” over a ready video
                    # until the next loop/status refresh catches up.
                    "active_scene_id": "",
                    "activeSceneId": "",
                    "active_job_id": "",
                    "activeJobId": "",
                    "active_status_endpoint": "",
                    "activeStatusEndpoint": "",
                    "completed_scene_ids": completed,
                    "completedSceneIds": completed,
                    "failed_scene_ids": failed,
                    "failedSceneIds": failed,
                    "waiting_scene_ids": waiting_ids,
                    "waitingSceneIds": waiting_ids,
                    "video_queue": {
                        "activeSceneId": "",
                        "activeJobId": "",
                        "activeStatusEndpoint": "",
                        "waitingSceneIds": waiting_ids,
                        "waiting_scene_ids": waiting_ids,
                    },
                })
                print("[BOARD SERVER BATCH READY SCENE]", {"project_id": project_id, "batch_id": batch_id, "scene_id": scene_id, "job_id": job_id, "waiting": len(waiting_ids)}, flush=True)
                try:
                    import threading
                    def _telegram_scene_ready_worker_v149a(
                        project_id_v149a=project_id,
                        scene_id_v149a=scene_id,
                        scene_v149a=dict(ready_patch_v132a),
                        job_id_v149a=job_id,
                        batch_id_v149a=batch_id,
                        user_v149a=dict(user),
                    ):
                        try:
                            telegram_board_scene_ready(
                                project_id_v149a,
                                scene_id_v149a,
                                scene=scene_v149a,
                                job_id=job_id_v149a,
                                batch_id=batch_id_v149a,
                                user=user_v149a,
                            )
                        except Exception as exc:
                            print("[TELEGRAM BOARD SCENE READY ASYNC ERROR V149A]", {"project_id": project_id_v149a, "batch_id": batch_id_v149a, "scene_id": scene_id_v149a, "error": str(exc)}, flush=True)
                    threading.Thread(target=_telegram_scene_ready_worker_v149a, daemon=True).start()
                    print("[TELEGRAM BOARD SCENE READY ASYNC V149A]", {"project_id": project_id, "batch_id": batch_id, "scene_id": scene_id}, flush=True)
                except Exception as exc:
                    print("[TELEGRAM BOARD SCENE READY ASYNC START ERROR V149A]", {"project_id": project_id, "batch_id": batch_id, "scene_id": scene_id, "error": str(exc)}, flush=True)
            else:
                failed.append(scene_id)
                _board_batch_update_scene(project_id, scene_id, _board_batch_error_patch(result_data.get("status") or result_status, result_data.get("error") or result_data.get("detail") or result_status), {
                    "batch_id": batch_id,
                    "status": "running" if waiting_ids else "finished_with_errors",
                    "completed_scene_ids": completed,
                    "completedSceneIds": completed,
                    "failed_scene_ids": failed,
                    "failedSceneIds": failed,
                    "waiting_scene_ids": waiting_ids,
                    "waitingSceneIds": waiting_ids,
                    "video_queue": {"activeSceneId": "", "activeJobId": "", "activeStatusEndpoint": "", "waitingSceneIds": waiting_ids, "waiting_scene_ids": waiting_ids},
                })
                batch.update({"activeSceneId": "", "activeJobId": "", "activeStatusEndpoint": "", "updatedAt": _board_batch_now()})

        final_status = "canceled" if batch.get("cancelRequested") else ("finished_with_errors" if failed else "finished")
        batch.update({
            "status": final_status,
            "activeSceneId": "",
            "activeJobId": "",
            "activeStatusEndpoint": "",
            "waitingSceneIds": [],
            "completedSceneIds": completed,
            "failedSceneIds": failed,
            "finishedAt": _board_batch_now(),
            "updatedAt": _board_batch_now(),
        })
        board_data = _board_batch_read_snapshot(project_id)
        current_batch = board_data.get("board_video_batch") if isinstance(board_data.get("board_video_batch"), dict) else {}
        board_data["board_video_batch"] = {**current_batch, **batch, "updatedAt": _board_batch_now(), "updated_at": _board_batch_now()}
        current_queue = board_data.get("video_queue") if isinstance(board_data.get("video_queue"), dict) else {}
        board_data["video_queue"] = {**current_queue, "activeSceneId": "", "activeJobId": "", "activeStatusEndpoint": "", "waitingSceneIds": [], "waiting_scene_ids": [], "source": "server_batch_finished_v131a", "updatedAt": _board_batch_now()}
        board_data["updatedAt"] = _board_batch_now()
        _board_batch_save_snapshot(project_id, board_data, client_version="board-server-video-batch-finished-v131a")
        print("[BOARD SERVER BATCH FINISHED]", {"project_id": project_id, "batch_id": batch_id, "status": final_status, "completed": completed, "failed": failed}, flush=True)
        try:
            telegram_board_batch_finished(
                project_id,
                batch_id=batch_id,
                status=final_status,
                completed=completed,
                failed=failed,
                user=user,
                source=str(batch.get("source") or ""),
                bad_review_scene_ids=list(batch.get("badReviewSceneIds") or batch.get("bad_review_scene_ids") or []),
            )
        except Exception as exc:
            print("[TELEGRAM BOARD BATCH FINISH HOOK ERROR V137A]", {"project_id": project_id, "batch_id": batch_id, "error": str(exc)}, flush=True)
    except Exception as exc:
        batch["status"] = "error"
        batch["error"] = str(exc)
        batch["updatedAt"] = _board_batch_now()
        print("[BOARD SERVER BATCH ERROR]", {"project_id": project_id, "batch_id": batch_id, "error": str(exc)}, flush=True)


def _board_batch_cleanup_orphaned_after_reload_v150a(project_id: str, board_data: dict[str, Any], batch: dict[str, Any]) -> dict[str, Any] | None:
    """Clear a persisted server-batch that has no live in-memory runner after reload.

    Uvicorn --reload kills daemon batch threads. The snapshot can still say queued/running,
    so the frontend keeps rendering "видео делается" / "в очереди" and refuses to POST a
    new batch. If the batch is active in the snapshot but absent from BOARD_VIDEO_BATCHES,
    mark it interrupted and clear transient scene job fields so the user can run again.
    """
    if not isinstance(batch, dict) or not batch:
        return None
    batch_id = str(batch.get("batchId") or batch.get("batch_id") or "").strip()
    status = str(batch.get("status") or batch.get("batch_status") or "").strip().lower()
    active_statuses = {"queued", "running", "starting", "preparing", "submitting", "processing", "cancel_requested"}
    waiting_ids = batch.get("waitingSceneIds") or batch.get("waiting_scene_ids") or []
    active_scene_id = str(batch.get("activeSceneId") or batch.get("active_scene_id") or "").strip()
    active_job_id = str(batch.get("activeJobId") or batch.get("active_job_id") or "").strip()
    active_endpoint = str(batch.get("activeStatusEndpoint") or batch.get("active_status_endpoint") or "").strip()
    looks_active = bool(status in active_statuses or active_scene_id or active_job_id or active_endpoint or waiting_ids)
    if not looks_active:
        return None
    if batch_id and batch_id in BOARD_VIDEO_BATCHES:
        return None

    now_value = _board_batch_now()
    clean_batch = {
        **batch,
        "status": "interrupted_after_backend_reload_v150a",
        "batch_status": "interrupted_after_backend_reload_v150a",
        "orphanedAfterReload": True,
        "orphaned_after_reload": True,
        "activeSceneId": "",
        "active_scene_id": "",
        "activeJobId": "",
        "active_job_id": "",
        "activeStatusEndpoint": "",
        "active_status_endpoint": "",
        "waitingSceneIds": [],
        "waiting_scene_ids": [],
        "updatedAt": now_value,
        "updated_at": now_value,
    }

    transient_statuses = {"queued", "running", "starting", "preparing", "submitting", "processing", "queued_no_prompt_id"}
    scenes = board_data.get("scenes") if isinstance(board_data.get("scenes"), list) else []
    next_scenes: list[dict[str, Any]] = []
    cleared = []
    for scene in scenes:
        if not isinstance(scene, dict):
            next_scenes.append(scene)
            continue
        scene_status = str(scene.get("video_status") or scene.get("videoStatus") or "").strip().lower()
        if scene_status in transient_statuses and not _board_batch_scene_has_video(scene):
            scene_id = _board_batch_scene_id(scene)
            patched = dict(scene)
            patched.update({
                "video_status": "",
                "videoStatus": "",
                "video_job_id": "",
                "videoJobId": "",
                "video_status_endpoint": "",
                "videoStatusEndpoint": "",
                "video_queue_position": 0,
                "videoQueuePosition": 0,
                "video_error": "",
                "videoError": "",
                "video_queue_source": "",
                "videoQueueSource": "",
                "video_interrupted_reason": "backend_reload_orphaned_batch_v150a",
                "videoInterruptedReason": "backend_reload_orphaned_batch_v150a",
            })
            next_scenes.append(patched)
            if scene_id:
                cleared.append(scene_id)
        else:
            next_scenes.append(scene)

    board_data["scenes"] = next_scenes
    board_data["board_video_batch"] = clean_batch
    current_queue = board_data.get("video_queue") if isinstance(board_data.get("video_queue"), dict) else {}
    board_data["video_queue"] = {
        **current_queue,
        "activeSceneId": "",
        "activeJobId": "",
        "activeStatusEndpoint": "",
        "waitingSceneIds": [],
        "waiting_scene_ids": [],
        "source": "orphaned_backend_reload_cleanup_v150a",
        "updatedAt": now_value,
    }
    board_data["updatedAt"] = now_value
    _board_batch_save_snapshot(project_id, board_data, client_version="board-server-batch-orphan-cleanup-v150a")
    print("[BOARD SERVER BATCH ORPHAN CLEANUP V150A]", {
        "project_id": project_id,
        "batch_id": batch_id,
        "old_status": status,
        "clearedSceneIds": cleared,
    }, flush=True)
    return clean_batch


# AVA_BOARD_BATCH_NOT_STARTED_CLEAR_STATE_V152A:
# If batch/start could not queue anything (most often autoslice audio 404), make
# the persisted Board state explicitly idle/failed. This prevents old queued/running
# batch metadata from fooling UI polling after a 200 {ok:false} response.
def _board_batch_clear_not_started_state_v152a(
    board_data: dict[str, Any],
    failed: list[dict[str, str]] | None = None,
    invalid: list[dict[str, Any]] | None = None,
    reason: str = "not_started",
) -> dict[str, Any]:
    now_value = _board_batch_now()
    failed = failed or []
    invalid = invalid or []
    failed_by_id = {str(item.get("sceneId") or item.get("scene_id") or "").strip(): item for item in failed if isinstance(item, dict)}
    invalid_by_id = {str(item.get("sceneId") or item.get("scene_id") or "").strip(): item for item in invalid if isinstance(item, dict)}

    scenes_next: list[dict[str, Any]] = []
    for scene in board_data.get("scenes") if isinstance(board_data.get("scenes"), list) else []:
        if not isinstance(scene, dict):
            scenes_next.append(scene)
            continue
        scene_id = _board_batch_scene_id(scene)
        patch = dict(scene)
        if scene_id in failed_by_id or scene_id in invalid_by_id:
            # Clear only transient video worker state. Keep images/prompts/review notes.
            for key in (
                "video_status", "videoStatus", "video_job_id", "videoJobId",
                "video_status_endpoint", "videoStatusEndpoint", "server_batch_job_id",
                "serverBatchJobId", "server_batch_status_endpoint", "serverBatchStatusEndpoint",
                "video_queue_position", "videoQueuePosition", "video_batch_active_v132r",
                "videoBatchActiveV132R",
            ):
                if key in patch:
                    patch[key] = 0 if "position" in key.lower() else ""
            if scene_id in failed_by_id:
                err = str(failed_by_id[scene_id].get("error") or "audio_slice_failed")
                patch["video_error"] = err
                patch["videoError"] = err
                patch["audio_slice_status"] = patch.get("audio_slice_status") or "error"
                patch["audioSliceStatus"] = patch.get("audioSliceStatus") or "error"
                patch["audio_slice_error"] = patch.get("audio_slice_error") or err
                patch["audioSliceError"] = patch.get("audioSliceError") or err
        scenes_next.append(patch)

    if scenes_next:
        board_data["scenes"] = scenes_next

    clean_batch = {
        "status": "failed" if failed else "idle",
        "batch_status": "failed" if failed else "idle",
        "source": "batch_start_not_queued_v152a",
        "reason": reason,
        "updatedAt": now_value,
        "updated_at": now_value,
        "waitingSceneIds": [],
        "waiting_scene_ids": [],
        "activeSceneId": "",
        "active_scene_id": "",
        "activeJobId": "",
        "active_job_id": "",
        "activeStatusEndpoint": "",
        "active_status_endpoint": "",
        "completedSceneIds": [],
        "completed_scene_ids": [],
        "failedSceneIds": list(failed_by_id.keys()),
        "failed_scene_ids": list(failed_by_id.keys()),
        "invalid": invalid,
        "autoAudioSliceFailed": failed,
        "auto_audio_slice_failed": failed,
    }
    board_data["board_video_batch"] = clean_batch
    board_data["boardVideoBatch"] = clean_batch
    board_data["video_batch"] = clean_batch
    board_data["videoBatch"] = clean_batch
    current_queue = board_data.get("video_queue") if isinstance(board_data.get("video_queue"), dict) else {}
    board_data["video_queue"] = {
        **current_queue,
        "activeSceneId": "",
        "activeJobId": "",
        "activeStatusEndpoint": "",
        "waitingSceneIds": [],
        "waiting_scene_ids": [],
        "source": "batch_start_not_queued_v152a",
        "updatedAt": now_value,
    }
    board_data["updatedAt"] = now_value
    board_data["updated_at"] = now_value
    return board_data


@router.post("/projects/{project_id}/board/video-batch/start")
def start_board_video_batch(project_id: str, payload: BoardVideoBatchStartIn, user: dict = Depends(get_current_user)) -> dict[str, Any]:
    project = ensure_project_access(project_id, user)
    mode = str(payload.mode or "missing").strip().lower()
    incoming_scenes = payload.scenes if isinstance(payload.scenes, list) else None
    board_data = _board_batch_read_snapshot(project_id)
    if incoming_scenes is not None:
        board_data["scenes"] = copy.deepcopy(incoming_scenes)
    scenes = board_data.get("scenes") if isinstance(board_data.get("scenes"), list) else []
    if not scenes:
        raise HTTPException(status_code=400, detail="Board snapshot has no scenes")

    # AVA_BOARD_SERVER_BATCH_AUTOSLICE_V147A:
    # Cut missing per-scene audio slices before input validation. This makes
    # "Сгенерировать все" work for Timing-imported ia2v/lip-sync scenes without
    # pressing the manual audio slice button scene by scene.
    scenes, auto_sliced_scene_ids_v147a, auto_slice_failed_v147a = _board_batch_prepare_auto_audio_slices(scenes, board_data, payload, mode, project_id=project_id)
    board_data["scenes"] = scenes

    requested_ids = [str(item or "").strip() for item in ((payload.scene_ids or payload.sceneIds or []) if (payload.scene_ids or payload.sceneIds) else [])]
    requested_set = set(requested_ids)
    waiting_ids: list[str] = []
    invalid: list[dict[str, Any]] = []
    for scene in scenes:
        scene_id = _board_batch_scene_id(scene)
        if not scene_id:
            continue
        if requested_set and scene_id not in requested_set:
            continue
        if mode in {"missing", "remaining"} and _board_batch_scene_has_video(scene) and not _board_batch_scene_has_bad_review(scene):
            continue
        problems = _board_batch_input_problems(scene)
        if problems:
            invalid.append({"sceneId": scene_id, "problems": problems})
            continue
        waiting_ids.append(scene_id)

    if not waiting_ids:
        reason_v152a = "autoslice_failed" if auto_slice_failed_v147a else "nothing_to_queue"
        board_data = _board_batch_clear_not_started_state_v152a(
            board_data,
            failed=auto_slice_failed_v147a,
            invalid=invalid,
            reason=reason_v152a,
        )
        if auto_sliced_scene_ids_v147a or auto_slice_failed_v147a or invalid:
            _board_batch_save_snapshot(project_id, board_data, client_version="board-server-video-batch-not-started-v152a")
        print("[BOARD SERVER BATCH NOT STARTED V152A]", {
            "project_id": project_id,
            "reason": reason_v152a,
            "invalid": invalid,
            "autoAudioSliceFailed": auto_slice_failed_v147a,
        }, flush=True)
        return {
            "ok": False,
            "status": reason_v152a,
            "queued": [],
            "invalid": invalid,
            "autoAudioSliceSceneIds": auto_sliced_scene_ids_v147a,
            "auto_audio_slice_scene_ids": auto_sliced_scene_ids_v147a,
            "autoAudioSliceFailed": auto_slice_failed_v147a,
            "auto_audio_slice_failed": auto_slice_failed_v147a,
            "board": board_data,
        }

    batch_id = f"boardbatch_{uuid4().hex[:14]}"
    now_value = _board_batch_now()
    waiting_set = set(waiting_ids)
    bad_review_waiting_ids_v132b = [
        _board_batch_scene_id(scene)
        for scene in scenes
        if _board_batch_scene_id(scene) in waiting_set and _board_batch_scene_was_bad_before_regenerate(scene)
    ]
    scenes_next: list[dict[str, Any]] = []
    for scene in scenes:
        scene_id = _board_batch_scene_id(scene)
        if scene_id in waiting_set:
            pos = waiting_ids.index(scene_id) + 1
            scenes_next.append({
                **scene,
                "video_status": "queued",
                "videoStatus": "queued",
                "video_error": "",
                "videoError": "",
                "video_job_id": "",
                "videoJobId": "",
                "video_status_endpoint": "",
                "videoStatusEndpoint": "",
                "video_queue_position": pos,
                "videoQueuePosition": pos,
                "video_queue_source": "server_batch_v131a",
                "videoQueueSource": "server_batch_v131a",
                "video_url": "",
                "videoUrl": "",
                "video_api_path": "",
                "videoApiPath": "",
                "video_asset_id": "",
                "videoAssetId": "",
                "video_name": "",
                "videoName": "",
                "video_result": None,
                "videoResult": None,
                **_board_batch_bad_review_start_patch(scene, _board_batch_scene_has_bad_review(scene)),
            })
        else:
            scenes_next.append(scene)

    batch = {
        "batch_id": batch_id,
        "batchId": batch_id,
        "project_id": project_id,
        "projectId": project_id,
        "status": "queued",
        "source": payload.source or "server_board_video_batch_v131a",
        "mode": mode,
        "waitingSceneIds": waiting_ids,
        "waiting_scene_ids": waiting_ids,
        "badReviewSceneIds": bad_review_waiting_ids_v132b,
        "bad_review_scene_ids": bad_review_waiting_ids_v132b,
        "completedSceneIds": [],
        "completed_scene_ids": [],
        "failedSceneIds": [],
        "failed_scene_ids": [],
        "invalid": invalid,
        "autoAudioSliceSceneIds": auto_sliced_scene_ids_v147a,
        "auto_audio_slice_scene_ids": auto_sliced_scene_ids_v147a,
        "autoAudioSliceFailed": auto_slice_failed_v147a,
        "auto_audio_slice_failed": auto_slice_failed_v147a,
        "activeSceneId": "",
        "activeJobId": "",
        "activeStatusEndpoint": "",
        "createdAt": now_value,
        "updatedAt": now_value,
    }
    BOARD_VIDEO_BATCHES[batch_id] = batch

    board_data["scenes"] = scenes_next
    board_data["board_video_batch"] = batch
    board_data["video_queue"] = {
        **(board_data.get("video_queue") if isinstance(board_data.get("video_queue"), dict) else {}),
        "activeSceneId": "",
        "activeJobId": "",
        "activeStatusEndpoint": "",
        "waitingSceneIds": waiting_ids,
        "waiting_scene_ids": waiting_ids,
        "source": "server_batch_v131a",
        "updatedAt": now_value,
    }
    board_data["updatedAt"] = now_value
    _board_batch_save_snapshot(project_id, board_data, client_version="board-server-video-batch-start-v131a")

    # AVA_BOARD_SERVER_BATCH_LOCAL_THREADING_IMPORT_V131G: keep the import local so this endpoint works even if module-level imports were not patched.
    import threading
    thread = threading.Thread(target=_board_video_batch_runner, args=(project_id, batch_id, dict(user)), daemon=True)
    BOARD_VIDEO_BATCH_THREADS[batch_id] = thread
    thread.start()

    try:
        telegram_board_batch_started(
            project_id,
            waiting_ids,
            skipped_ready=0,
            invalid=len(invalid),
            batch_id=batch_id,
            user=user,
            source=str(payload.source or ""),
            bad_review_scene_ids=bad_review_waiting_ids_v132b,
        )
    except Exception as exc:
        print("[TELEGRAM BOARD BATCH START HOOK ERROR V137A]", {"project_id": project_id, "batch_id": batch_id, "error": str(exc)}, flush=True)

    return {
        "ok": True,
        "status": "queued",
        "batchId": batch_id,
        "batch_id": batch_id,
        "queued": waiting_ids,
        "invalid": invalid,
        "autoAudioSliceSceneIds": auto_sliced_scene_ids_v147a,
        "auto_audio_slice_scene_ids": auto_sliced_scene_ids_v147a,
        "autoAudioSliceFailed": auto_slice_failed_v147a,
        "auto_audio_slice_failed": auto_slice_failed_v147a,
        "board": board_data,
    }



# AVA_BOARD_CLEAR_SNAPSHOT_STALE_SCENE_JOB_V200H:
# The status endpoint tells the browser a stale job is gone, but a saved snapshot can
# still contain scene.video_status="running" + video_job_id. Clear those fields in
# the Board snapshot from the batch-status endpoint so F5 cannot resurrect them.
def _board_batch_clear_snapshot_stale_scene_jobs_v200h(project_id: str, board_data: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    if not isinstance(board_data, dict):
        return board_data, []
    transient = {"queued", "running", "starting", "preparing", "submitting", "processing", "queued_no_prompt_id"}
    scenes = board_data.get("scenes") if isinstance(board_data.get("scenes"), list) else []
    if not scenes:
        return board_data, []

    cleared: list[str] = []
    next_scenes: list[Any] = []
    now_value = _board_batch_now() if callable(globals().get("_board_batch_now")) else now_iso()

    for scene in scenes:
        if not isinstance(scene, dict):
            next_scenes.append(scene)
            continue
        status = str(scene.get("video_status") or scene.get("videoStatus") or "").strip().lower()
        if status not in transient:
            next_scenes.append(scene)
            continue
        has_video = False
        try:
            has_video = bool(_board_batch_scene_has_video(scene))
        except Exception:
            has_video = bool(scene.get("video_url") or scene.get("videoUrl") or scene.get("video_asset_id") or scene.get("videoAssetId"))
        if has_video:
            next_scenes.append(scene)
            continue

        scene_id = str(scene.get("id") or scene.get("scene_id") or scene.get("sceneId") or "").strip()
        job_id = str(scene.get("video_job_id") or scene.get("videoJobId") or "").strip()
        endpoint = str(scene.get("video_status_endpoint") or scene.get("videoStatusEndpoint") or "").strip()
        if not job_id:
            m = re.search(r"/clip/video/status/([^/?#]+)", endpoint)
            if m:
                job_id = m.group(1).strip()
        if not job_id:
            next_scenes.append(scene)
            continue

        was_in_memory = job_id in BOARD_VIDEO_JOBS
        job = BOARD_VIDEO_JOBS.get(job_id) or _board_video_job_load(job_id)
        if not isinstance(job, dict):
            patched = dict(scene)
            patched.update({
                "video_status": "", "videoStatus": "",
                "video_job_id": "", "videoJobId": "",
                "video_status_endpoint": "", "videoStatusEndpoint": "",
                "video_queue_position": 0, "videoQueuePosition": 0,
                "video_error": "stale_job_missing_v200h", "videoError": "stale_job_missing_v200h",
                "video_interrupted_reason": "stale_job_missing_v200h", "videoInterruptedReason": "stale_job_missing_v200h",
                "video_updated_at": now_value, "videoUpdatedAt": now_value,
            })
            next_scenes.append(patched)
            cleared.append(scene_id or job_id)
            continue

        should_clear, reason = _board_video_should_force_orphan_v200h(job_id, job, was_in_memory=was_in_memory, source="batch_snapshot")
        if should_clear:
            _board_video_mark_orphaned_v200h(job_id, job, reason=reason, scene_id=scene_id, project_id=project_id)
            patched = dict(scene)
            patched.update({
                "video_status": "", "videoStatus": "",
                "video_job_id": "", "videoJobId": "",
                "video_status_endpoint": "", "videoStatusEndpoint": "",
                "video_queue_position": 0, "videoQueuePosition": 0,
                "video_error": reason, "videoError": reason,
                "video_interrupted_reason": reason, "videoInterruptedReason": reason,
                "video_updated_at": now_value, "videoUpdatedAt": now_value,
            })
            next_scenes.append(patched)
            cleared.append(scene_id or job_id)
        else:
            next_scenes.append(scene)

    if not cleared:
        return board_data, []

    next_board = dict(board_data)
    next_board["scenes"] = next_scenes
    queue = next_board.get("video_queue") if isinstance(next_board.get("video_queue"), dict) else {}
    next_board["video_queue"] = {
        **queue,
        "activeSceneId": "",
        "activeJobId": "",
        "activeStatusEndpoint": "",
        "waitingSceneIds": [],
        "waiting_scene_ids": [],
        "source": "stale_scene_job_clear_v200h",
        "updatedAt": now_value,
    }
    batch = next_board.get("board_video_batch") if isinstance(next_board.get("board_video_batch"), dict) else {}
    if batch:
        next_board["board_video_batch"] = {
            **batch,
            "activeSceneId": "",
            "active_scene_id": "",
            "activeJobId": "",
            "active_job_id": "",
            "activeStatusEndpoint": "",
            "active_status_endpoint": "",
            "waitingSceneIds": [],
            "waiting_scene_ids": [],
            "status": "idle" if str(batch.get("status") or "").lower() in transient else batch.get("status", ""),
            "updatedAt": now_value,
        }
    next_board["updatedAt"] = now_value
    try:
        _board_batch_save_snapshot(project_id, next_board, client_version="board-stale-scene-job-clear-v200h")
    except Exception as exc:
        print("[BOARD STALE SCENE JOB CLEAR SAVE ERROR V200H]", {"project_id": project_id, "error": str(exc)}, flush=True)
    print("[BOARD STALE SCENE JOB CLEAR V200H]", {"project_id": project_id, "clearedSceneIds": cleared}, flush=True)
    return next_board, cleared

@router.get("/projects/{project_id}/board/video-batch/status")
def board_video_batch_status(project_id: str, user: dict = Depends(get_current_user)) -> dict[str, Any]:
    # AVA_BOARD_BATCH_STATUS_RETURNS_BOARD_V200I
    ensure_project_access(project_id, user)
    board_data = _board_batch_read_snapshot(project_id)
    board_data, cleared_scene_jobs_v200h = _board_batch_clear_snapshot_stale_scene_jobs_v200h(project_id, board_data)
    board_data, stale_scene_ids_v200a = _board_batch_clear_stale_manual_scene_locks_v200a(project_id, board_data)
    if stale_scene_ids_v200a:
        _board_batch_save_snapshot(project_id, board_data, client_version="board-manual-queue-stale-lock-clear-v200a")
    batch = board_data.get("board_video_batch") if isinstance(board_data.get("board_video_batch"), dict) else {}
    batch_id = str(batch.get("batchId") or batch.get("batch_id") or "").strip()
    live = BOARD_VIDEO_BATCHES.get(batch_id) if batch_id else None
    if live is None:
        cleaned = _board_batch_cleanup_orphaned_after_reload_v150a(project_id, board_data, batch)
        if cleaned is not None:
            return {"ok": True, "batch": cleaned, "board_video_batch": cleaned, "orphanCleaned": True, "orphan_cleaned": True, "board": board_data, "clearedSceneIds": cleared_scene_jobs_v200h, "cleared_scene_ids": cleared_scene_jobs_v200h, "client_version": "board-batch-status-returns-board-v200i"}
    return {"ok": True, "batch": live or batch or {}, "board_video_batch": live or batch or {}, "board": board_data, "clearedSceneIds": cleared_scene_jobs_v200h, "cleared_scene_ids": cleared_scene_jobs_v200h, "client_version": "board-batch-status-returns-board-v200i"}


@router.post("/projects/{project_id}/board/video-batch/stop")
def stop_board_video_batch(project_id: str, payload: BoardVideoBatchStopIn | None = None, user: dict = Depends(get_current_user)) -> dict[str, Any]:
    ensure_project_access(project_id, user)
    board_data = _board_batch_read_snapshot(project_id)
    batch = board_data.get("board_video_batch") if isinstance(board_data.get("board_video_batch"), dict) else {}
    batch_id = str(batch.get("batchId") or batch.get("batch_id") or "").strip()
    live = BOARD_VIDEO_BATCHES.get(batch_id) if batch_id else None
    if live is not None:
        live["cancelRequested"] = True
        live["status"] = "cancel_requested"
        live["updatedAt"] = _board_batch_now()
    board_data["board_video_batch"] = {**batch, "status": "cancel_requested", "cancelRequested": True, "stopReason": getattr(payload, "reason", None) if payload else "", "updatedAt": _board_batch_now()}
    q = board_data.get("video_queue") if isinstance(board_data.get("video_queue"), dict) else {}
    board_data["video_queue"] = {**q, "waitingSceneIds": [], "waiting_scene_ids": [], "source": "server_batch_stop_v131a", "updatedAt": _board_batch_now()}

    # V200X: The same UI button is used to clear server queue and manual single-scene
    # /clip/video/start jobs. Clear stuck scene job ids/endpoints in the persisted Board
    # snapshot so F5 does not restore “отправляется/видео делается” forever.
    cleared_scene_ids_v200x: list[str] = []
    busy_statuses_v200x = {"queued", "starting", "preparing", "submitting", "running", "processing", "queued_no_prompt_id"}
    scenes_v200x = board_data.get("scenes") if isinstance(board_data.get("scenes"), list) else []
    for scene_v200x in scenes_v200x:
        if not isinstance(scene_v200x, dict):
            continue
        scene_id_v200x = str(scene_v200x.get("id") or scene_v200x.get("scene_id") or "").strip()
        status_v200x = str(scene_v200x.get("video_status") or scene_v200x.get("videoStatus") or "").lower().strip()
        has_job_v200x = any(str(scene_v200x.get(key) or "").strip() for key in (
            "video_job_id", "videoJobId", "video_status_endpoint", "videoStatusEndpoint",
            "server_batch_job_id", "serverBatchJobId", "server_batch_status_endpoint", "serverBatchStatusEndpoint",
        ))
        if not (has_job_v200x or status_v200x in busy_statuses_v200x):
            continue
        has_video_v200x = any(str(scene_v200x.get(key) or "").strip() for key in (
            "video_asset_id", "videoAssetId", "video_api_path", "videoApiPath", "video_url", "videoUrl",
            "result_video_asset_id", "resultVideoAssetId", "result_video_api_path", "resultVideoApiPath", "result_video_url", "resultVideoUrl",
        ))
        ready_status_v200x = "ready" if has_video_v200x else ""
        for key in ("video_status", "videoStatus"):
            scene_v200x[key] = ready_status_v200x
        for key in (
            "video_job_id", "videoJobId", "video_prompt_id", "videoPromptId",
            "video_status_endpoint", "videoStatusEndpoint", "server_batch_job_id", "serverBatchJobId",
            "server_batch_status_endpoint", "serverBatchStatusEndpoint", "video_queue_source", "videoQueueSource",
            "video_error", "videoError",
        ):
            scene_v200x[key] = ""
        for key in ("video_queue_position", "videoQueuePosition", "video_progress", "videoProgress"):
            scene_v200x[key] = 0
        scene_v200x["video_interrupted_reason"] = "server_stop_clear_manual_job_v200x"
        scene_v200x["videoInterruptedReason"] = "server_stop_clear_manual_job_v200x"
        scene_v200x["video_updated_at"] = _board_batch_now()
        scene_v200x["videoUpdatedAt"] = scene_v200x["video_updated_at"]
        media_v200x = scene_v200x.get("media") if isinstance(scene_v200x.get("media"), dict) else {}
        video_media_v200x = media_v200x.get("video") if isinstance(media_v200x.get("video"), dict) else None
        if video_media_v200x is not None:
            video_media_v200x["status"] = ready_status_v200x
            video_media_v200x["error"] = ""
            video_media_v200x["jobId"] = ""
            video_media_v200x["job_id"] = ""
            video_media_v200x["statusEndpoint"] = ""
            video_media_v200x["status_endpoint"] = ""
            video_media_v200x["progress"] = 0
        if scene_id_v200x:
            cleared_scene_ids_v200x.append(scene_id_v200x)

    if cleared_scene_ids_v200x:
        print("[BOARD VIDEO STOP CLEAR MANUAL JOBS V200X]", {
            "project_id": project_id,
            "clearedSceneIds": cleared_scene_ids_v200x,
            "count": len(cleared_scene_ids_v200x),
        })

    board_data["updatedAt"] = _board_batch_now()
    _board_batch_save_snapshot(project_id, board_data, client_version="board-server-video-batch-stop-v200x")
    return {"ok": True, "status": "cancel_requested", "batchId": batch_id, "clearedSceneIds": cleared_scene_ids_v200x, "cleared_scene_ids": cleared_scene_ids_v200x}





def _mmaudio_words(value: Any) -> set[str]:
    text = str(value or "").lower()
    return set(re.findall(r"[a-zа-яё0-9_]+", text, flags=re.IGNORECASE))


def _mmaudio_seed_from_payload(payload_data: dict[str, Any]) -> int:
    raw = _payload_get(payload_data, "mmaudio_seed", "mmaudioSeed", "seed", default="")
    if str(raw or "").strip():
        try:
            value = int(float(raw))
            if value > 0:
                return value
        except Exception:
            pass
    # MMAudio works better for testing when each run explores a new sample.
    return random.randint(1, 2_147_483_000)


def _mmaudio_append_unique(base: str, extra: str) -> str:
    base_text = str(base or "").strip()
    extra_text = str(extra or "").strip()
    if not extra_text:
        return base_text
    lowered = base_text.lower()
    parts = []
    for chunk in [item.strip() for item in extra_text.split(",") if item.strip()]:
        if chunk.lower() not in lowered:
            parts.append(chunk)
    if not parts:
        return base_text
    return (base_text + ", " if base_text else "") + ", ".join(parts)


# AVA_MMAUDIO_RAW_MODE_HELPER_V203N:
# RAW means node 92 gets exactly the user prompt and exactly the user negative prompt.
# No hidden director prompt, no hidden negative expansion.
def _mmaudio_raw_mode_requested_v203n(payload_data: dict[str, Any], *, raw_prompt: str = "") -> bool:
    mode = str(
        _payload_get(
            payload_data,
            "mmaudio_mode",
            "mmaudioMode",
            "mmaudio_preset",
            "mmaudioPreset",
            "preset",
            "mode",
            default="",
        )
        or ""
    ).strip().lower()
    if mode in {"director", "auto_director", "enhanced", "smart", "legacy", "server_director"}:
        return False
    if mode in {"raw", "exact", "plain", "foley", "short_foley", "clean_foley"}:
        return True

    raw_flag = _payload_get(payload_data, "mmaudio_raw", "mmaudioRaw", "raw_mmaudio", "rawMmaudio", "raw_mode", "rawMode", default=None)
    if raw_flag is not None:
        return str(raw_flag).strip().lower() not in {"0", "false", "no", "off"}

    # Default RAW for short Foley prompts. This is the safe default for current workflow:
    # emotion + 2-4 concrete sounds + no background.
    prompt_text = str(raw_prompt or "").strip()
    return len(prompt_text) <= 240


def _mmaudio_director(payload_data: dict[str, Any], *, video_path: Path | None = None) -> dict[str, Any]:
    raw_prompt = str(
        _payload_get(
            payload_data,
            "sound_prompt",
            "soundPrompt",
            "prompt",
            "positive_prompt",
            "positivePrompt",
            default="",
        )
        or ""
    ).strip()
    raw_negative = str(
        _payload_get(
            payload_data,
            "negative_sound_prompt",
            "negativeSoundPrompt",
            "negative_prompt",
            "negativePrompt",
            default="",
        )
        or ""
    ).strip()

    # AVA_MMAUDIO_RAW_DIRECTOR_RETURN_V203N:
    # In RAW mode do not prepend director text and do not expand negative prompt.
    # Node 92 receives exactly raw_prompt/raw_negative, cfg=3, steps=25.
    if _mmaudio_raw_mode_requested_v203n(payload_data, raw_prompt=raw_prompt):
        seed = _mmaudio_seed_from_payload(payload_data)
        return {
            "profile": "raw",
            "mode": "raw",
            "prompt": raw_prompt,
            "negativePrompt": raw_negative,
            "seed": seed,
            "cfg": 3.0,
            "steps": 25,
            "rawPrompt": raw_prompt,
            "rawNegativePrompt": raw_negative,
            "detected": {
                "rawMode": True,
                "directorDisabled": True,
                "negativeExpansionDisabled": True,
                "node92Exact": True,
                "shortPrompt": len(raw_prompt) <= 240,
            },
        }

    words = _mmaudio_words(raw_prompt)
    short_prompt = len(raw_prompt) <= 28

    profile = "video_sync_natural"
    cfg = 3.0
    steps = 30

    # Hidden backend profiles. UI remains simple.
    is_wind = bool(words & {"wind", "breeze", "air", "ветер", "воздух", "бриз"})
    is_rain = bool(words & {"rain", "raining", "rainfall", "shower", "дождь", "ливень"})
    is_wave = bool(words & {"wave", "waves", "ocean", "sea", "surf", "water", "волна", "волны", "море", "океан", "вода"})
    is_drone = bool(words & {"drone", "propeller", "aerial", "flight", "flying", "дрон", "коптер", "пропеллер", "полет", "полёт"})
    is_city = bool(words & {"city", "street", "traffic", "crowd", "город", "улица", "толпа"})
    is_impact = bool(words & {"hit", "crash", "door", "steps", "footsteps", "engine", "car", "ship", "horn", "удар", "шаги", "машина", "двигатель", "корабль"})

    known_profile_matched = False

    if is_drone:
        known_profile_matched = True
        profile = "real_drone_flight"
        cfg = 3.0
        steps = 34
        if short_prompt:
            raw_prompt = (
                "Realistic drone flight sound synchronized with the visible aerial camera movement. "
                "Soft propeller texture and natural airflow, controlled and not harsh, no piercing tone, no alarm, no cinematic music."
            )
    elif is_rain:
        known_profile_matched = True
        profile = "video_rain_texture"
        cfg = 3.2
        steps = 34
        if short_prompt:
            raw_prompt = (
                "Natural rain sound synchronized with the visible rainfall and surfaces in the video. "
                "Match the rain intensity, distance, and motion shown on screen. Clean realistic rain texture, no music, no voices."
            )
    elif is_wave:
        known_profile_matched = True
        profile = "video_water_waves"
        cfg = 3.2
        steps = 34
        if short_prompt:
            raw_prompt = (
                "Natural ocean wave sound synchronized with the visible water movement. "
                "Match wave size, distance, foam, surf, and impact intensity shown in the video. Realistic water movement only."
            )
    elif is_wind:
        known_profile_matched = True
        profile = "video_wind_air"
        cfg = 2.4
        steps = 34
        if short_prompt:
            raw_prompt = (
                "Natural wind and airflow synchronized with the visible camera movement and scene scale. "
                "Soft realistic air movement, no piercing whistle, no beep, no metallic ringing. "
                "If the video shows aerial movement, add only subtle airflow unless a drone motor is explicitly requested."
            )
    elif is_impact:
        known_profile_matched = True
        profile = "video_action_foley"
        cfg = 3.8
        steps = 34
    elif is_city:
        known_profile_matched = True
        profile = "city_environment"
        cfg = 2.8
        steps = 32

    if not raw_prompt:
        raw_prompt = (
            "Realistic natural sound design matching the visible action in the video. "
            "Clean synchronized environmental audio, no music, no narration, no human voice unless explicitly visible and requested."
        )
    elif short_prompt and not known_profile_matched:
        profile = "open_world_requested_sound"
        cfg = 3.4
        steps = 34
        raw_prompt = (
            f"Requested sound: {raw_prompt}. "
            "Infer the correct realistic sound source from the visible video content. "
            "Synchronize timing, distance, loudness, and intensity to what is actually visible. "
            "If the requested source is visible, make it clear and natural. "
            "If it is not visible, keep it subtle and offscreen, not dominant. "
            "No unrelated sounds, no music, no narration."
        )

    internal_prompt = (
        "Generate realistic synchronized audio for this exact video. "
        "Use the visible motion, objects, surfaces, distance, and event intensity as the source of timing and loudness. "
        "Do not treat the text as a decorative mood; treat it as the requested sound source. "
        "Follow the user sound request first, but keep it physically believable for the video. "
        f"{raw_prompt}"
    )

    guard_negative = (
        "music, soundtrack, score, melody, narration, speech, human voice, singing, "
        "distorted audio, clipping, harsh noise, unrelated sound, repeated loop, robotic audio, "
        "random beeps, camera shutter, accidental clicks, synthetic tone, unrelated mechanical noise"
    )

    if profile == "video_wind_air":
        guard_negative += ", camera shutter, click, clicking, bell, chime, alarm, siren, piercing tone, beep, metallic ringing, heavy motor hum"
    elif profile == "real_drone_flight":
        guard_negative += ", alarm, siren, bell, chime, camera shutter, click, harsh high pitched whine, broken motor, engine roar"
    elif profile == "video_rain_texture":
        guard_negative += ", thunder unless requested, siren, alarm, music, voices, metallic ringing, camera shutter"
    elif profile == "video_water_waves":
        guard_negative += ", storm thunder unless requested, siren, alarm, music, voices, metallic ringing, camera shutter"

    internal_negative = _mmaudio_append_unique(raw_negative, guard_negative)
    seed = _mmaudio_seed_from_payload(payload_data)

    try:
        cfg = float(_payload_get(payload_data, "mmaudio_cfg", "mmaudioCfg", "cfg", default=cfg))
    except Exception:
        pass
    try:
        steps = int(float(_payload_get(payload_data, "mmaudio_steps", "mmaudioSteps", "steps", default=steps)))
    except Exception:
        pass

    cfg = max(1.0, min(float(cfg), 6.0))
    steps = max(12, min(int(steps), 50))

    return {
        "profile": profile,
        "prompt": internal_prompt,
        "negativePrompt": internal_negative,
        "seed": seed,
        "cfg": cfg,
        "steps": steps,
        "rawPrompt": raw_prompt,
        "rawNegativePrompt": raw_negative,
        "detected": {
            "wind": is_wind,
            "rain": is_rain,
            "waves": is_wave,
            "drone": is_drone,
            "city": is_city,
            "action": is_impact,
            "shortPrompt": short_prompt,
            "knownProfileMatched": known_profile_matched,
        },
    }


def _inject_mmaudio_workflow(
    workflow: dict[str, Any],
    *,
    uploaded_video: dict[str, Any] | None,
    prompt: str,
    negative_prompt: str,
    job_id: str,
    seed: int | None = None,
    cfg: float | None = None,
    steps: int | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    # Exact-only MMAudio workflow patch.
    # mmaudio-sound-design.json:
    #   91.video           = uploaded video
    #   92.prompt          = positive sound prompt
    #   92.negative_prompt = negative sound prompt
    #   92.seed            = server-randomized seed
    #   92.cfg             = hidden server profile cfg
    #   92.steps           = hidden server profile steps
    #   97.filename_prefix = output prefix
    patched = copy.deepcopy(workflow)
    patches: list[dict[str, Any]] = []

    def patch(node_id: str, key: str, value: Any, reason: str) -> None:
        node = patched.get(node_id)
        if not isinstance(node, dict):
            return
        inputs = node.get("inputs")
        if not isinstance(inputs, dict):
            return
        if key not in inputs:
            return
        inputs[key] = value
        patches.append({
            "nodeId": node_id,
            "input": key,
            "reason": reason,
            "valuePreview": str(value)[:180],
        })

    video_ref = (uploaded_video or {}).get("comfyInputRef") or (uploaded_video or {}).get("filename")
    if video_ref:
        patch("91", "video", video_ref, "exact_mmaudio_video_91")

    patch("92", "prompt", prompt, "exact_mmaudio_positive_prompt_92")
    patch("92", "negative_prompt", negative_prompt, "exact_mmaudio_negative_prompt_92")
    if seed is not None:
        patch("92", "seed", int(seed), "exact_mmaudio_seed_92")
    if cfg is not None:
        patch("92", "cfg", float(cfg), "exact_mmaudio_cfg_92")
    if steps is not None:
        patch("92", "steps", int(steps), "exact_mmaudio_steps_92")
    patch("97", "filename_prefix", f"MMAudio_sound_design/{job_id}", "exact_mmaudio_output_prefix_97")

    return patched, patches
def _payload_get(payload_data: dict[str, Any], *keys: str, default: Any = None) -> Any:
    for key in keys:
        value = payload_data.get(key)
        if value not in (None, ""):
            return value
    return default


def _payload_float(payload_data: dict[str, Any], *keys: str, default: float = 0.0) -> float:
    value = _payload_get(payload_data, *keys, default=default)
    try:
        return float(value or default)
    except Exception:
        return float(default)


def _run_mmaudio_submit_job(job_id: str) -> None:
    job = BOARD_MMAUDIO_JOBS.get(job_id)
    if not job:
        return

    payload_data = job.get("payload") or {}
    lab_url = job.get("targetComfyBaseUrl") or _mmaudio_comfy_url()
    workflow_key = job.get("workflowKey") or "mmaudio-sound-design.json"

    try:
        job["status"] = "preparing"
        job["updatedAt"] = datetime.utcnow().isoformat() + "Z"

        if not lab_url:
            job["status"] = "blocked_missing_comfy_mmaudio_url"
            job["error"] = "missing COMFY_MMAUDIO_BASE_URL / COMFY_LAB_URL"
            job["updatedAt"] = datetime.utcnow().isoformat() + "Z"
            return

        # Prefer local backend static path. It is safer than making the backend HTTP-fetch itself.
        source_value = _payload_get(payload_data, "video_api_path", "videoApiPath", "video_url", "videoUrl", default="")
        if not source_value:
            job["status"] = "error"
            job["error"] = "missing_mmaudio_video"
            job["updatedAt"] = datetime.utcnow().isoformat() + "Z"
            return

        workflow = _load_workflow(workflow_key)
        video_path = _resolve_local_file(str(source_value))
        uploaded_video = _comfy_upload_file(lab_url, video_path, subfolder=f"ava_{job_id}")

        director = _mmaudio_director(payload_data, video_path=video_path)
        prompt = str(director.get("prompt") or "")
        negative_prompt = str(director.get("negativePrompt") or "")
        mmaudio_seed = int(director.get("seed") or random.randint(1, 2_147_483_000))
        mmaudio_cfg = float(director.get("cfg") or 3.0)
        mmaudio_steps = int(director.get("steps") or 30)

        job["mmaudioDirector"] = director
        job["mmaudioProfile"] = director.get("profile")
        job["mmaudioSeed"] = mmaudio_seed
        job["mmaudioCfg"] = mmaudio_cfg
        job["mmaudioSteps"] = mmaudio_steps
        job["internalPrompt"] = prompt
        job["internalNegativePrompt"] = negative_prompt
        job["mmaudioRawMode"] = bool(director.get("mode") == "raw" or director.get("profile") == "raw")
        job["mmaudioRawModeV203N"] = job["mmaudioRawMode"]

        prompt_graph, patches = _inject_mmaudio_workflow(
            workflow,
            uploaded_video=uploaded_video,
            prompt=prompt,
            negative_prompt=negative_prompt,
            job_id=job_id,
            seed=mmaudio_seed,
            cfg=mmaudio_cfg,
            steps=mmaudio_steps,
        )

        node92_inputs_v203n = {}
        try:
            node92_inputs_v203n = dict(((prompt_graph.get("92") or {}).get("inputs") or {}))
        except Exception:
            node92_inputs_v203n = {}
        # AVA_MMAUDIO_NODE92_FINAL_LOG_V203N:
        print("[MMAUDIO NODE 92 FINAL INPUTS V203N]", {
            "jobId": job_id,
            "rawMode": job.get("mmaudioRawModeV203N"),
            "prompt": node92_inputs_v203n.get("prompt"),
            "negative_prompt": node92_inputs_v203n.get("negative_prompt"),
            "steps": node92_inputs_v203n.get("steps"),
            "cfg": node92_inputs_v203n.get("cfg"),
            "seed": node92_inputs_v203n.get("seed"),
            "videoNode91": ((prompt_graph.get("91") or {}).get("inputs") or {}).get("video"),
        }, flush=True)

        job["status"] = "submitting"
        job["uploadedMedia"] = {"video": uploaded_video}
        job["workflowPatches"] = patches
        job["workflowPatchCount"] = len(patches)
        job["sourceVideoResolvedPath"] = str(video_path)
        job["sourceVideoValue"] = str(source_value)
        job["updatedAt"] = datetime.utcnow().isoformat() + "Z"

        submit_data = _submit_prompt(lab_url, prompt_graph)
        prompt_id = submit_data.get("prompt_id") or submit_data.get("promptId")

        job["promptId"] = prompt_id
        job["promptSubmit"] = submit_data
        job["status"] = "queued" if prompt_id else "queued_no_prompt_id"
        job["updatedAt"] = datetime.utcnow().isoformat() + "Z"

    except HTTPException as exc:
        job["status"] = "error"
        job["error"] = exc.detail
        job["updatedAt"] = datetime.utcnow().isoformat() + "Z"
    except Exception as exc:
        job["status"] = "error"
        job["error"] = str(exc)
        job["updatedAt"] = datetime.utcnow().isoformat() + "Z"


@router.post("/clip/mmaudio/start")
def start_mmaudio(payload: dict[str, Any], user: dict = Depends(get_current_user)) -> dict[str, Any]:
    # Raw dict is intentional here. Pydantic was dropping video_api_path in some local states,
    # so the job got sourceVideoApiPath="" even when the browser sent it correctly.
    payload_data = dict(payload or {})

    lab_url = _mmaudio_comfy_url()
    workflow_key = str(_payload_get(payload_data, "workflow_key", "workflowKey", default="mmaudio-sound-design.json"))
    workflow_path = WORKFLOWS_DIR / workflow_key

    target_duration = max(0.1, _payload_float(payload_data, "target_duration_sec", "targetDurationSec", "duration_sec", "durationSec", default=0.0))
    job_id = f"mmaudio_{uuid4().hex[:14]}"
    now = datetime.utcnow().isoformat() + "Z"

    project_id_for_credit = _clean_project_id(_payload_get(payload_data, "project_id", "projectId", default=""))
    if project_id_for_credit:
        ensure_project_access(project_id_for_credit, user)
    _ava_credit_require_balance(user, MMAUDIO_CREDIT_COST)

    source_video_api_path = str(_payload_get(payload_data, "video_api_path", "videoApiPath", default="") or "")
    source_video_url = str(_payload_get(payload_data, "video_url", "videoUrl", default="") or "")

    job = {
        "jobId": job_id,
        "status": "preparing",
        "createdAt": now,
        "updatedAt": now,
        "sceneId": _payload_get(payload_data, "scene_id", "sceneId", default=""),
        "projectId": project_id_for_credit,
        "project_id": project_id_for_credit,
        "workflowKey": workflow_key,
        "workflowExists": workflow_path.exists(),
        "targetComfy": "mmaudio_lab",
        "targetComfyBaseUrl": lab_url,
        "preferredOutputNodeIds": ["97"],
        "sourceVideoUrl": source_video_url,
        "sourceVideoApiPath": source_video_api_path,
        "targetDurationSec": target_duration,
        "creditCost": MMAUDIO_CREDIT_COST,
        "creditCharged": False,
        "creditChargeMode": "not_charged_until_result_success",
        "payload": payload_data,
        # AVA_MMAUDIO_JOB_RAW_MODE_VERSION_V203N:
        # Endpoint default is RAW for short Foley prompts unless caller explicitly asks for director/enhanced mode.
        "mmaudioDirectorVersion": "raw_v203n_default_short_foley",
    }
    _ava_credit_attach_job_user(job, user)
    BOARD_MMAUDIO_JOBS[job_id] = job

    try:
        import threading
        threading.Thread(target=_run_mmaudio_submit_job, args=(job_id,), daemon=True).start()
    except Exception as exc:
        job["status"] = "error"
        job["error"] = f"thread_start_failed: {exc}"
        job["updatedAt"] = datetime.utcnow().isoformat() + "Z"

    return {
        "ok": True,
        "jobId": job_id,
        "job_id": job_id,
        "status": job["status"],
        "statusEndpoint": f"/api/clip/mmaudio/status/{job_id}",
        "workflowKey": workflow_key,
        "workflowExists": workflow_path.exists(),
        "targetComfy": "mmaudio_lab",
        "targetComfyBaseUrl": lab_url,
        "targetDurationSec": target_duration,
        "creditCost": MMAUDIO_CREDIT_COST,
        "creditCharged": False,
        "workflowPatchCount": 0,
        "uploadedMedia": {},
        "jobStored": True,
        "sourceVideoApiPath": source_video_api_path,
        "sourceVideoUrl": source_video_url,
    }


@router.get("/clip/mmaudio/status/{job_id}")
def mmaudio_status(job_id: str, user: dict = Depends(get_current_user)) -> dict[str, Any]:
    job = BOARD_MMAUDIO_JOBS.get(job_id)
    if not job:
        return {"ok": False, "status": "not_found", "code": "MMAUDIO_JOB_NOT_FOUND", "jobId": job_id}

    _ava_credit_ensure_job_owner(job, user)

    if job.get("mmaudioVideoUrl") or job.get("mmaudio_video_url") or job.get("videoUrl") or job.get("video_url"):
        _ava_credit_charge_mmaudio_job_if_ready(job)

        return {"ok": True, **job}

    prompt_id = job.get("promptId")
    base_url = job.get("targetComfyBaseUrl")
    if prompt_id and base_url:
        history = _history(base_url, prompt_id)
        outputs = _extract_comfy_outputs(base_url, history) if isinstance(history, dict) else []

        if outputs:
            job["outputs"] = outputs
            try:
                final_video = _finalize_video_job_from_outputs(job, outputs)
                if final_video:
                    job.update(final_video)
                    job["mmaudioVideoUrl"] = final_video.get("videoUrl") or final_video.get("video_url")
                    job["mmaudio_video_url"] = final_video.get("video_url") or final_video.get("videoUrl")
                    job["mmaudioVideoName"] = final_video.get("videoName") or final_video.get("video_name")
                    job["mmaudio_video_name"] = final_video.get("video_name") or final_video.get("videoName")
                    job["status"] = "completed"
                    job["mmaudio_status"] = "ready"
                    _ava_credit_charge_mmaudio_job_if_ready(job)
                else:
                    job["status"] = "completed_without_video_output"
            except HTTPException as exc:
                job["status"] = "output_download_failed"
                job["error"] = exc.detail
            except Exception as exc:
                job["status"] = "output_finalize_failed"
                job["error"] = str(exc)

        elif isinstance(history, dict) and "_history_error" in history:
            job["historyError"] = history["_history_error"]
            job["status"] = "running"
        else:
            job["status"] = "running"

        job["updatedAt"] = datetime.utcnow().isoformat() + "Z"
        job["historyPreview"] = history

    _ava_credit_charge_mmaudio_job_if_ready(job)


    return {"ok": True, **job}


@router.post("/clip/mmaudio/apply-volume")
def apply_mmaudio_volume(payload: dict[str, Any], user: dict = Depends(get_current_user)) -> dict[str, Any]:
    # V204C3: bake the chosen Audio Studio MMAudio volume into a new video asset.
    # This turns a per-scene correction like 30% into the new baseline for Assembly.
    payload_data = dict(payload or {})
    project_id = _clean_project_id(_payload_get(payload_data, "project_id", "projectId", default=""))
    if project_id:
        ensure_project_access(project_id, user)

    scene_id = str(_payload_get(payload_data, "scene_id", "sceneId", default="") or "").strip()
    source_api_path = str(_payload_get(payload_data, "video_api_path", "videoApiPath", "source_video_api_path", "sourceVideoApiPath", default="") or "").strip()
    source_url = str(_payload_get(payload_data, "video_url", "videoUrl", "source_video_url", "sourceVideoUrl", default="") or "").strip()
    source_asset_id = str(_payload_get(payload_data, "asset_id", "assetId", "video_asset_id", "videoAssetId", default="") or "").strip()

    try:
        volume_percent = float(_payload_get(payload_data, "volume_percent", "volumePercent", "mmaudio_volume", "mmaudioVolume", default=100) or 100)
    except Exception:
        volume_percent = 100.0
    volume_percent = max(0.0, min(150.0, volume_percent))

    source_ref = source_api_path or source_url
    if not source_ref and not source_asset_id:
        raise HTTPException(status_code=400, detail="Missing MMAudio video asset for volume apply")

    source_path = _resolve_local_file(source_ref, asset_id=source_asset_id or None)
    if not source_path.exists() or not source_path.is_file():
        raise HTTPException(status_code=404, detail="MMAudio source video not found")

    source_asset_id = source_asset_id or (_asset_id_from_text(source_ref) or "")

    if abs(volume_percent - 100.0) < 0.01:
        api_path = f"/assets/{source_asset_id}/file" if source_asset_id else source_api_path
        return {
            "ok": True,
            "videoApiPath": api_path,
            "video_api_path": api_path,
            "videoUrl": api_path or source_url,
            "video_url": api_path or source_url,
            "assetId": source_asset_id,
            "asset_id": source_asset_id,
            "volumeBaked": False,
            "volume_baked": False,
            "volumePercent": 100,
            "volume_percent": 100,
            "sourceVideoPath": str(source_path),
        }

    target_dir = _settings_static_path() / "assets" / "board_videos"
    target_dir.mkdir(parents=True, exist_ok=True)
    safe_scene = _safe_name(scene_id or "scene", "scene")
    safe_stem = _safe_name(source_path.stem, "mmaudio")
    volume_tag = str(int(round(volume_percent))).replace("-", "0")
    out_path = target_dir / f"{safe_stem}_{safe_scene}_mmaudio_vol_{volume_tag}p_{uuid4().hex[:8]}.mp4"

    gain = volume_percent / 100.0
    has_audio = False
    try:
        probe = _ffprobe_json([
            "-v", "error",
            "-select_streams", "a",
            "-show_entries", "stream=index",
            "-of", "json",
            str(source_path),
        ])
        has_audio = bool(probe.get("streams"))
    except Exception:
        has_audio = True

    try:
        if has_audio:
            _run_ffmpeg([
                "-y",
                "-i", str(source_path),
                "-map", "0:v:0?",
                "-map", "0:a:0?",
                "-c:v", "copy",
                "-af", f"volume={gain:.6f}",
                "-c:a", "aac",
                "-b:a", "192k",
                "-movflags", "+faststart",
                str(out_path),
            ])
        else:
            _run_ffmpeg(["-y", "-i", str(source_path), "-c", "copy", str(out_path)])
    except HTTPException:
        if has_audio:
            _run_ffmpeg([
                "-y",
                "-i", str(source_path),
                "-map", "0:v:0?",
                "-map", "0:a:0?",
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-crf", "18",
                "-af", f"volume={gain:.6f}",
                "-c:a", "aac",
                "-b:a", "192k",
                "-movflags", "+faststart",
                str(out_path),
            ])
        else:
            raise

    job_ref = {
        "jobId": f"mmaudio_volume_{uuid4().hex[:10]}",
        "sceneId": scene_id,
        "scene_id": scene_id,
        "projectId": project_id,
        "project_id": project_id,
        "userId": user.get("id"),
        "user_id": user.get("id"),
    }
    asset_ref = _register_board_output_asset(
        out_path,
        job=job_ref,
        kind="video",
        stage="board_videos",
        original_name=out_path.name,
    )

    asset_id = asset_ref.get("asset_id") or asset_ref.get("assetId")
    api_path = asset_ref.get("asset_api_path") or asset_ref.get("assetApiPath")
    asset_url = asset_ref.get("asset_url") or asset_ref.get("assetUrl") or api_path

    if not api_path:
        urls = _public_static_url(f"assets/board_videos/{out_path.name}")
        api_path = urls.get("apiPath") or urls.get("url")
        asset_url = urls.get("url") or api_path

    print("[MMAUDIO APPLY VOLUME BAKED V204C3]", {
        "sceneId": scene_id,
        "source": str(source_path),
        "out": str(out_path),
        "volumePercent": volume_percent,
        "assetId": asset_id,
        "apiPath": api_path,
    }, flush=True)

    return {
        "ok": True,
        "videoApiPath": api_path,
        "video_api_path": api_path,
        "videoUrl": api_path or asset_url,
        "video_url": api_path or asset_url,
        "assetApiPath": api_path,
        "asset_api_path": api_path,
        "assetId": asset_id,
        "asset_id": asset_id,
        "videoName": out_path.name,
        "video_name": out_path.name,
        "volumeBaked": True,
        "volume_baked": True,
        "volumePercent": volume_percent,
        "volume_percent": volume_percent,
        "gain": gain,
        "sourceVideoPath": str(source_path),
        "localPath": str(out_path),
    }



# ---------------------------------------------------------------------
# Board Assembly / Video Montage — FFmpeg draft.
# Stage 6.5 supports the safest first mode: scene video concat with scene audio.
# More advanced master-audio/music mixing will be layered in later stages.
# ---------------------------------------------------------------------

def _ffprobe_json(args: list[str]) -> dict[str, Any]:
    exe = shutil.which("ffprobe")
    if not exe:
        return {}
    result = subprocess.run([exe, *args], text=True, capture_output=True)
    if result.returncode != 0:
        return {}
    try:
        return json.loads(result.stdout or "{}")
    except Exception:
        return {}


def _ffprobe_duration(path: Path) -> float:
    data = _ffprobe_json([
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "json",
        str(path),
    ])
    try:
        return max(0.0, float((data.get("format") or {}).get("duration") or 0))
    except Exception:
        return 0.0


def _ffprobe_has_audio(path: Path) -> bool:
    data = _ffprobe_json([
        "-v", "error",
        "-select_streams", "a",
        "-show_entries", "stream=index",
        "-of", "json",
        str(path),
    ])
    return bool(data.get("streams"))




def _assembly_make_local_player_safe_v196f(
    source_path: Path,
    out_path: Path,
    *,
    fps: int,
    job_id: str,
) -> dict[str, Any]:
    """Final MP4 compatibility pass for Windows/iPhone local players.

    Important: this does NOT use setpts/asetpts and does NOT shift the master audio.
    It only re-encodes the video into a simple CFR H.264 stream with no B-frames,
    copies the already-synced audio stream, and writes a simple faststart MP4.
    V196A changed PTS for both streams and could break browser sync; V196F must not.
    """
    fps_safe = max(1, int(fps or 30))
    duration_before = _ffprobe_duration(source_path)
    has_audio = _ffprobe_has_audio(source_path)
    gop = max(1, fps_safe * 2)

    _log_board_assembly("[BOARD ASSEMBLY LOCAL PLAYER SAFE START V196F]", {
        "job_id": job_id,
        "source": str(source_path),
        "out": str(out_path),
        "fps": fps_safe,
        "durationBeforeSec": duration_before,
        "hasAudio": has_audio,
    })

    args = [
        "-y",
        "-fflags", "+genpts",
        "-i", str(source_path),
        "-map", "0:v:0",
    ]
    if has_audio:
        args.extend(["-map", "0:a:0"])

    args.extend([
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-profile:v", "main",
        "-level", "4.1",
        "-bf", "0",
        "-g", str(gop),
        "-keyint_min", str(gop),
        "-sc_threshold", "0",
        "-r", str(fps_safe),
        "-fps_mode", "cfr",
    ])
    if has_audio:
        # Keep audio exactly as Assembly produced it. Re-encoding AAC can add encoder
        # delay/priming and was the likely cause of V196A making browser sync worse.
        args.extend(["-c:a", "copy"])
    args.extend([
        "-movflags", "+faststart",
        "-avoid_negative_ts", "make_zero",
        "-video_track_timescale", "90000",
        "-muxdelay", "0",
        "-muxpreload", "0",
        str(out_path),
    ])

    _run_ffmpeg(args)
    duration_after = _ffprobe_duration(out_path)
    result = {
        "applied": bool(out_path.exists() and out_path.stat().st_size > 0),
        "reason": "local_player_safe_video_reencode_audio_copy_v196f",
        "durationBeforeSec": duration_before,
        "durationAfterSec": duration_after,
        "durationDeltaSec": round(float(duration_after or 0.0) - float(duration_before or 0.0), 6),
        "audioCopied": bool(has_audio),
        "videoReencoded": True,
        "bframesDisabled": True,
        "fps": fps_safe,
        "videoTrackTimescale": 90000,
    }
    _log_board_assembly("[BOARD ASSEMBLY LOCAL PLAYER SAFE DONE V196F]", {"job_id": job_id, **result})
    return result


def _assembly_item_video_value(item: dict[str, Any]) -> str:
    # AVA_BOARD_ASSEMBLY_RESULT_VIDEO_REFS_BACKEND_V202B:
    # Ready clips can be stored under resultVideo/result_video aliases before
    # normal video_* aliases are rehydrated. Assembly must count and use them.
    result_video = item.get("resultVideo") if isinstance(item.get("resultVideo"), dict) else {}
    video_result = item.get("video_result") if isinstance(item.get("video_result"), dict) else {}
    return str(
        item.get("video_api_path")
        or item.get("videoApiPath")
        or item.get("result_video_api_path")
        or item.get("resultVideoApiPath")
        or video_result.get("video_api_path")
        or video_result.get("videoApiPath")
        or video_result.get("api_path")
        or result_video.get("video_api_path")
        or result_video.get("videoApiPath")
        or result_video.get("api_path")
        or item.get("video_url")
        or item.get("videoUrl")
        or item.get("result_video_url")
        or item.get("resultVideoUrl")
        or video_result.get("video_url")
        or video_result.get("videoUrl")
        or video_result.get("url")
        or result_video.get("video_url")
        or result_video.get("videoUrl")
        or result_video.get("url")
        or item.get("url")
        or ""
    ).strip()


def _assembly_int(value: Any, default: int) -> int:
    try:
        parsed = int(value)
        return parsed if parsed > 0 else default
    except Exception:
        return default


def _assembly_float(value: Any, default: float) -> float:
    try:
        parsed = float(value)
        return parsed if parsed >= 0 else default
    except Exception:
        return default


def _assembly_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    if isinstance(value, (int, float)):
        return value != 0
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}


def _assembly_item_is_placeholder(item: dict[str, Any]) -> bool:
    return (
        _assembly_bool(item.get("placeholder"))
        or _assembly_bool(item.get("missing_video"))
        or _assembly_bool(item.get("missingVideo"))
        or str(item.get("route") or "").strip().lower() in {"black_placeholder", "black_gap", "placeholder"}
    )


def _assembly_item_claims_video(item: dict[str, Any]) -> bool:
    return (
        _assembly_bool(item.get("has_video"))
        or _assembly_bool(item.get("hasVideo"))
        or _assembly_bool(item.get("ready"))
        or _assembly_bool(item.get("isReady"))
        or _assembly_bool(item.get("video_ready"))
        or _assembly_bool(item.get("videoReady"))
        or bool(str(item.get("video_job_id") or item.get("videoJobId") or "").strip())
        or bool(str(item.get("video_status_endpoint") or item.get("videoStatusEndpoint") or "").strip())
    )


def _log_board_assembly(label: str, payload: dict[str, Any]) -> None:
    try:
        print(f"{label} {json.dumps(payload, ensure_ascii=False, default=str)}", flush=True)
    except Exception:
        print(f"{label} {payload}", flush=True)


def _assembly_music_audio_path(payload: dict[str, Any]) -> Path | None:
    music = payload.get("music") if isinstance(payload.get("music"), dict) else {}
    value = str(
        music.get("asset_api_path")
        or music.get("audio_url")
        or music.get("url")
        or payload.get("music_audio_url")
        or payload.get("musicAudioUrl")
        or ""
    ).strip()
    asset_id = str(
        music.get("asset_id")
        or payload.get("music_audio_asset_id")
        or payload.get("musicAudioAssetId")
        or ""
    ).strip()

    if not value and not asset_id:
        return None

    try:
        return _resolve_local_file(value, asset_id=asset_id or None)
    except HTTPException:
        return None


def _assembly_original_audio_path(payload: dict[str, Any]) -> Path | None:
    value = str(
        payload.get("original_audio_url")
        or payload.get("originalAudioUrl")
        or payload.get("master_audio_url")
        or payload.get("masterAudioUrl")
        or ""
    ).strip()
    asset_id = str(
        payload.get("original_audio_asset_id")
        or payload.get("originalAudioAssetId")
        or payload.get("master_audio_asset_id")
        or payload.get("masterAudioAssetId")
        or ""
    ).strip()

    if not value and not asset_id:
        return None

    try:
        return _resolve_local_file(value, asset_id=asset_id or None)
    except HTTPException:
        return None


def _write_concat_file(paths: list[Path], target: Path) -> None:
    def quote_path(path: Path) -> str:
        return str(path).replace("'", "'\\''")

    target.write_text("".join(f"file '{quote_path(path)}'\n" for path in paths), encoding="utf-8")


def _normalize_assembly_clip(
    source_path: Path,
    out_path: Path,
    *,
    width: int,
    height: int,
    fps: int,
    fallback_duration: float,
    audio_volume: float = 1.0,
    fit_mode: str = "contain",
) -> dict[str, Any]:
    source_duration = _ffprobe_duration(source_path)
    target_duration = max(float(fallback_duration or source_duration or 0.0), 0.1)
    has_audio = _ffprobe_has_audio(source_path)
    fit_mode_normalized = str(fit_mode or "contain").strip().lower()

    # V196B: Board timing is the authority. Every generated clip is converted to a fresh
    # CFR intermediate with PTS starting at zero and exact target duration. This prevents
    # scene MP4 B-frames/AAC priming/edit-lists from accumulating drift in Assembly.
    pad_duration = max(0.0, target_duration - float(source_duration or 0.0))
    if fit_mode_normalized in {"cover", "crop", "fill", "center_crop"}:
        scale_chain = (
            f"scale={width}:{height}:force_original_aspect_ratio=increase,"
            f"crop={width}:{height}"
        )
    else:
        scale_chain = (
            f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
            f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2"
        )

    video_chain = (
        f"[0:v]{scale_chain},setsar=1,fps={fps},"
        f"trim=duration={target_duration:.6f},"
        f"tpad=stop_mode=clone:stop_duration={pad_duration:.6f},"
        f"setpts=PTS-STARTPTS,format=yuv420p[v]"
    )

    print("[BOARD ASSEMBLY NORMALIZE EXACT V196B]", {
        "source": str(source_path),
        "out": str(out_path),
        "sourceDurationSec": source_duration,
        "targetDurationSec": target_duration,
        "padDurationSec": pad_duration,
        "fitMode": fit_mode_normalized,
        "audioVolume": audio_volume,
        "hasAudio": has_audio,
    }, flush=True)

    if has_audio and float(audio_volume or 0.0) > 0.0001:
        audio_chain = (
            f"[0:a]volume={max(0.0, float(audio_volume)):.4f},"
            f"aresample=48000,apad,atrim=duration={target_duration:.6f},"
            f"asetpts=PTS-STARTPTS[a]"
        )
        _run_ffmpeg([
            "-y", "-i", str(source_path),
            "-filter_complex", video_chain + ";" + audio_chain,
            "-map", "[v]", "-map", "[a]",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
            "-pix_fmt", "yuv420p",
            "-x264-params", "bframes=0:keyint=60:min-keyint=60:scenecut=0",
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
            "-movflags", "+faststart", "-video_track_timescale", "30000",
            str(out_path),
        ])
    else:
        silence_index = 1
        audio_chain = f"[{silence_index}:a]atrim=duration={target_duration:.6f},asetpts=PTS-STARTPTS[a]"
        _run_ffmpeg([
            "-y", "-i", str(source_path),
            "-f", "lavfi", "-t", f"{target_duration:.6f}",
            "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
            "-filter_complex", video_chain + ";" + audio_chain,
            "-map", "[v]", "-map", "[a]",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
            "-pix_fmt", "yuv420p",
            "-x264-params", "bframes=0:keyint=60:min-keyint=60:scenecut=0",
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
            "-movflags", "+faststart", "-video_track_timescale", "30000",
            str(out_path),
        ])

    normalized_duration = _ffprobe_duration(out_path) or target_duration
    return {
        "sourcePath": str(source_path),
        "normalizedPath": str(out_path),
        "sourceDurationSec": source_duration,
        "targetDurationSecV196B": target_duration,
        "durationSec": normalized_duration,
        "durationDriftSecV196B": normalized_duration - target_duration,
        "hadAudio": has_audio,
        "exactTimingV196B": True,
    }


def _create_black_assembly_clip(
    out_path: Path,
    *,
    width: int,
    height: int,
    fps: int,
    duration: float,
    audio_volume: float = 0.0,
) -> dict[str, Any]:
    safe_duration = max(float(duration or 0.0), 0.1)
    _run_ffmpeg([
        "-y",
        "-f", "lavfi",
        "-t", f"{safe_duration:.3f}",
        "-i", f"color=c=black:s={width}x{height}:r={fps}",
        "-f", "lavfi",
        "-t", f"{safe_duration:.3f}",
        "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-af", f"volume={max(0.0, float(audio_volume)):.4f}",
        "-shortest",
        str(out_path),
    ])
    return {
        "sourcePath": "",
        "normalizedPath": str(out_path),
        "sourceDurationSec": 0.0,
        "durationSec": _ffprobe_duration(out_path) or safe_duration,
        "hadAudio": False,
        "placeholder": True,
    }



def _assembly_scene_audio_volume_for_item(item: dict[str, Any], audio_mode: str, scene_volume: float) -> float:
    """AVA_BOARD_ASSEMBLY_SCENE_AUDIO_ABSOLUTE_V200U.

    Scene videos can contain generated dialogue/SFX. Earlier logic muted IA2V/lip-sync
    scene audio whenever the selected mode referenced original/master audio. If the
    master audio path is missing after restore/import, that makes the final Assembly
    silent even though scene MP4 files have audio. Keep scene audio unless the user
    explicitly selected original_only or the scene explicitly asks to mute it.
    """
    mode = str(audio_mode or "").lower()
    data = item or {}

    if mode in {"original_only", "original_plus_music"}:
        return 0.0

    explicit_mute = _assembly_bool(
        data.get("mute_scene_audio")
        or data.get("muteSceneAudio")
        or data.get("scene_audio_muted")
        or data.get("sceneAudioMuted")
    )
    if explicit_mute:
        return 0.0

    return max(0.0, float(scene_volume))


# AVA_BOARD_ASSEMBLY_SAFE_XFADE_V134D:
# Optional post-concat visual xfade. It never changes the stable plain concat path first.
# Flow: build normal scene_concat_path -> if transitions enabled and allowed, try visual xfade into temp -> replace concat.
# If xfade fails, keep normal concat and finish job.


# AVA_BOARD_ASSEMBLY_PROJECT_AUDIO_FALLBACK_V200R:
# If the Assembly page was restored from board_assembly snapshot, the payload can miss
# original_audio_url even though the project still has master/timing audio in Board or
# Manual Timing snapshots. Recover that top-level project audio here so audio modes like
# original_plus_scene / original_plus_music_scene actually get a real master track.
def _assembly_project_original_audio_path_v200r(payload: dict[str, Any], *, job_id: str = "") -> Path | None:
    project_id = str(payload.get("project_id") or payload.get("projectId") or "").strip()
    if not project_id:
        return None

    def try_resolve(value: Any = "", asset_id: Any = "", *, label: str = "") -> Path | None:
        value_text = str(value or "").strip()
        asset_text = str(asset_id or "").strip()
        if not value_text and not asset_text:
            return None
        try:
            path = _resolve_local_file(value_text, asset_id=asset_text or None)
            if path and path.exists():
                print("[BOARD ASSEMBLY PROJECT AUDIO FALLBACK V200R]", {
                    "job_id": job_id,
                    "project_id": project_id,
                    "label": label,
                    "path": str(path),
                }, flush=True)
                return path
        except Exception as exc:
            print("[BOARD ASSEMBLY PROJECT AUDIO FALLBACK SKIP V200R]", {
                "job_id": job_id,
                "project_id": project_id,
                "label": label,
                "error": str(exc)[:240],
            }, flush=True)
        return None

    url_keys = (
        "assetApiPath", "asset_api_path", "audioAssetApiPath", "audio_asset_api_path",
        "apiPath", "api_path", "url", "src", "audioUrl", "audio_url",
        "sourceAudioUrl", "source_audio_url", "masterAudioUrl", "master_audio_url",
        "fileUrl", "file_url",
    )
    id_keys = (
        "assetId", "asset_id", "audioAssetId", "audio_asset_id",
        "sourceAudioAssetId", "source_audio_asset_id",
        "masterAudioAssetId", "master_audio_asset_id",
    )
    audio_object_keys = (
        "audio", "sourceAudio", "source_audio", "timingAudio", "timing_audio",
        "originalAudio", "original_audio", "masterAudio", "master_audio",
        "mixedAudio", "mixed_audio", "mainAudio", "main_audio", "uploadedAudio", "uploaded_audio",
    )

    def from_dict(obj: Any, *, label: str) -> Path | None:
        if not isinstance(obj, dict):
            return None
        direct_value = ""
        direct_asset = ""
        for key in url_keys:
            if obj.get(key):
                direct_value = obj.get(key)
                break
        for key in id_keys:
            if obj.get(key):
                direct_asset = obj.get(key)
                break
        resolved = try_resolve(direct_value, direct_asset, label=label)
        if resolved:
            return resolved
        return None

    try:
        db = store.get_db() or {}
        snapshots = ((db.get("snapshots") or {}).get(project_id) or {})
    except Exception as exc:
        print("[BOARD ASSEMBLY PROJECT AUDIO FALLBACK DB ERROR V200R]", {
            "job_id": job_id,
            "project_id": project_id,
            "error": str(exc)[:240],
        }, flush=True)
        return None

    # Prefer Board/Manual Timing project-level audio, then existing Assembly snapshot audio.
    for stage in ("board", "manual_timing", "board_assembly"):
        wrapper = snapshots.get(stage) if isinstance(snapshots, dict) else None
        data = wrapper.get("data") if isinstance(wrapper, dict) else wrapper
        if not isinstance(data, dict):
            continue

        resolved = from_dict(data, label=f"{stage}:root")
        if resolved:
            return resolved

        for key in audio_object_keys:
            resolved = from_dict(data.get(key), label=f"{stage}:{key}")
            if resolved:
                return resolved

    print("[BOARD ASSEMBLY PROJECT AUDIO FALLBACK MISS V200R]", {
        "job_id": job_id,
        "project_id": project_id,
    }, flush=True)
    return None


def _assembly_transition_config_v134d(payload: dict[str, Any], audio_mode: str, original_audio_path: Path | None) -> dict[str, Any]:
    transitions = payload.get("transitions") if isinstance(payload.get("transitions"), dict) else {}
    requested = _assembly_bool(
        transitions.get("enabled")
        or transitions.get("requestedEnabled")
        or payload.get("smoothTransitionsEnabledV134B")
        or payload.get("smoothTransitionsEnabled")
    )
    duration = _assembly_float(
        transitions.get("duration_sec")
        or transitions.get("durationSec")
        or payload.get("smoothTransitionDurationSecV134B")
        or payload.get("smoothTransitionDurationSec"),
        0.5,
    )
    duration = max(0.1, min(3.0, float(duration or 0.5)))
    mode = str(audio_mode or "").lower()
    allowed = bool(requested and not original_audio_path and mode in {"scene_only", "music_plus_scene"})
    return {
        "requested": requested,
        "allowed": allowed,
        "applied": False,
        "durationSec": duration,
        "mode": "background_video_only_v134d",
        "reason": "" if allowed else ("" if not requested else "requires_scene_or_music_mode_without_original_audio"),
    }


def _render_assembly_visual_xfade_v134d(paths: list[Path], target: Path, transition_sec: float) -> dict[str, Any]:
    if len(paths) < 2:
        return {"applied": False, "reason": "not_enough_clips"}

    durations = [float(_ffprobe_duration(path) or 0.0) for path in paths]
    if any(value <= 0.1 for value in durations):
        return {"applied": False, "reason": "clip_duration_missing", "durations": durations}

    safe_transition = max(0.1, min(3.0, float(transition_sec or 0.5)))
    max_by_shortest = min(durations) - 0.05
    if max_by_shortest < 0.1:
        return {"applied": False, "reason": "clips_too_short", "durations": durations}
    safe_transition = min(safe_transition, max_by_shortest)

    args = ["-y"]
    for path in paths:
        args.extend(["-i", str(path)])

    filters: list[str] = []
    for index in range(len(paths)):
        filters.append(f"[{index}:v]setpts=PTS-STARTPTS[v{index}]")

    video_label = "v0"
    combined_duration = durations[0]
    for index in range(1, len(paths)):
        next_video_label = f"vxf{index}"
        offset = max(0.0, combined_duration - safe_transition)
        filters.append(
            f"[{video_label}][v{index}]xfade=transition=fade:duration={safe_transition:.3f}:offset={offset:.3f}[{next_video_label}]"
        )
        video_label = next_video_label
        combined_duration = combined_duration + durations[index] - safe_transition

    # Keep a silent audio stream so later assembly/watermark/player steps stay compatible.
    silence_index = len(paths)
    args.extend(["-f", "lavfi", "-t", f"{max(combined_duration, 0.1):.3f}", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000"])

    _run_ffmpeg([
        *args,
        "-filter_complex", ";".join(filters),
        "-map", f"[{video_label}]",
        "-map", f"{silence_index}:a:0",
        "-shortest",
        "-c:v", "libx264",
        "-preset", AVA_BOARD_ASSEMBLY_PRESET,
        "-crf", AVA_BOARD_ASSEMBLY_CRF,
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        str(target),
    ])

    return {
        "applied": True,
        "reason": "visual_xfade_v134d",
        "durationSec": safe_transition,
        "inputDurations": durations,
        "expectedDurationSec": combined_duration,
    }



# AVA_BOARD_ASSEMBLY_TRANSITION_STATUS_DEBUG_V134E:
# Debug helper for assembly transition payload; does not change stable assembly logic.
def _assembly_transition_debug_v134e(payload: dict[str, Any], audio_mode: str, original_audio_path: Path | None, job_id: str) -> dict[str, Any]:
    transitions = payload.get("transitions") if isinstance(payload.get("transitions"), dict) else {}
    requested = _assembly_bool(
        transitions.get("enabled")
        or transitions.get("requestedEnabled")
        or transitions.get("active")
        or payload.get("smoothTransitionsEnabledV134B")
        or payload.get("smoothTransitionsEnabled")
    )
    duration = _assembly_float(
        transitions.get("duration_sec")
        or transitions.get("durationSec")
        or payload.get("smoothTransitionDurationSecV134B")
        or payload.get("smoothTransitionDurationSec"),
        0.5,
    )
    audio_mode_safe = str(audio_mode or "").lower()
    allowed = bool(requested and not original_audio_path and audio_mode_safe in {"scene_only", "music_plus_scene"})
    info = {
        "job_id": job_id,
        "requested": requested,
        "allowed": allowed,
        "durationSec": max(0.1, min(3.0, float(duration or 0.5))),
        "audioMode": audio_mode_safe,
        "hasOriginalAudio": bool(original_audio_path),
        "rawTransitions": transitions,
        "reason": "" if allowed else ("" if not requested else "requires_scene_or_music_mode_without_original_audio"),
    }
    print("[BOARD ASSEMBLY TRANSITION DEBUG V134E]", info)
    return info


# AVA_BOARD_ASSEMBLY_FORCE_POST_XFADE_V134F:
# Apply visual xfade AFTER the stable normal concat, never instead of it.
# If checkbox is off, it only logs. If xfade fails, normal concat stays.
def _assembly_transition_request_v134f(payload: dict[str, Any], original_audio_path: Path | None, job_id: str) -> dict[str, Any]:
    transitions = payload.get("transitions") if isinstance(payload.get("transitions"), dict) else {}
    requested = any(_assembly_bool(value) for value in [
        transitions.get("enabled"),
        transitions.get("requestedEnabled"),
        transitions.get("active"),
        transitions.get("forceEnabled"),
        payload.get("smoothTransitionsEnabledV134B"),
        payload.get("smoothTransitionsEnabled"),
    ])
    duration = _assembly_float(
        transitions.get("duration_sec")
        or transitions.get("durationSec")
        or payload.get("smoothTransitionDurationSecV134B")
        or payload.get("smoothTransitionDurationSec"),
        0.5,
    )
    duration = max(0.1, min(3.0, float(duration or 0.5)))
    preserve_timing = _assembly_bool(transitions.get("preserveTiming")) or "preserve" in str(transitions.get("mode") or "").lower()
    allowed = bool(requested and (preserve_timing or not original_audio_path))
    info = {
        "job_id": job_id,
        "requested": requested,
        "allowed": allowed,
        "preserveTiming": preserve_timing,
        "durationSec": duration,
        "hasOriginalAudio": bool(original_audio_path),
        "rawTransitions": transitions,
        "reason": "" if allowed else ("" if not requested else "blocked_original_audio"),
    }
    print("[BOARD ASSEMBLY TRANSITION REQUEST V134F]", info)
    return info


def _assembly_apply_visual_xfade_v134f(paths: list[Path], target: Path, transition_sec: float, job_id: str) -> dict[str, Any]:
    if len(paths) < 2:
        return {"applied": False, "reason": "not_enough_clips"}

    durations = [float(_ffprobe_duration(path) or 0.0) for path in paths]
    if any(value <= 0.1 for value in durations):
        return {"applied": False, "reason": "clip_duration_missing", "durations": durations}

    safe_transition = max(0.1, min(3.0, float(transition_sec or 0.5)))
    max_by_shortest = min(durations) - 0.05
    if max_by_shortest < 0.1:
        return {"applied": False, "reason": "clips_too_short", "durations": durations}
    safe_transition = min(safe_transition, max_by_shortest)

    expected_duration = durations[0]
    args = ["-y"]
    filters: list[str] = []
    for index, path in enumerate(paths):
        args.extend(["-i", str(path)])
        filters.append(f"[{index}:v]setpts=PTS-STARTPTS[v{index}]")

    video_label = "v0"
    for index in range(1, len(paths)):
        next_label = f"vxf{index}"
        offset = max(0.0, expected_duration - safe_transition)
        filters.append(
            f"[{video_label}][v{index}]xfade=transition=fade:duration={safe_transition:.3f}:offset={offset:.3f}[{next_label}]"
        )
        video_label = next_label
        expected_duration = expected_duration + durations[index] - safe_transition

    silence_index = len(paths)
    args.extend([
        "-f", "lavfi",
        "-t", f"{max(expected_duration, 0.1):.3f}",
        "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
    ])

    temp_target = target.with_name(target.stem + "_xfade_v134f.mp4")
    try:
        _run_ffmpeg([
            *args,
            "-filter_complex", ";".join(filters),
            "-map", f"[{video_label}]",
            "-map", f"{silence_index}:a:0",
            "-shortest",
            "-c:v", "libx264",
            "-preset", AVA_BOARD_ASSEMBLY_PRESET,
            "-crf", AVA_BOARD_ASSEMBLY_CRF,
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            "-movflags", "+faststart",
            str(temp_target),
        ])
        if not temp_target.exists():
            return {"applied": False, "reason": "xfade_output_missing"}
        shutil.copy2(temp_target, target)
        result = {
            "applied": True,
            "reason": "visual_xfade_v134f",
            "durationSec": safe_transition,
            "inputDurations": durations,
            "expectedDurationSec": expected_duration,
            "actualDurationSec": _ffprobe_duration(target) or 0.0,
        }
        print("[BOARD ASSEMBLY XFADE APPLIED V134F]", {"job_id": job_id, **result})
        return result
    finally:
        try:
            temp_target.unlink(missing_ok=True)
        except Exception:
            pass



# AVA_BOARD_ASSEMBLY_PRESERVE_TIMING_XFADE_V134G:
# Timing-safe visual xfade. It preserves total montage duration by adding freeze handles to outgoing clips.
def _assembly_apply_visual_xfade_preserve_timing_v134g(paths: list[Path], target: Path, transition_sec: float, job_id: str) -> dict[str, Any]:
    if len(paths) < 2:
        return {"applied": False, "reason": "not_enough_clips"}

    durations = [float(_ffprobe_duration(path) or 0.0) for path in paths]
    if any(value <= 0.1 for value in durations):
        return {"applied": False, "reason": "clip_duration_missing", "durations": durations}

    safe_transition = max(0.1, min(3.0, float(transition_sec or 0.5)))
    max_by_shortest = min(durations) - 0.05
    if max_by_shortest < 0.1:
        return {"applied": False, "reason": "clips_too_short", "durations": durations}
    safe_transition = min(safe_transition, max_by_shortest)

    original_total = sum(durations)
    adjusted_durations = [
        (duration + safe_transition) if index < len(paths) - 1 else duration
        for index, duration in enumerate(durations)
    ]

    args = ["-y"]
    filters: list[str] = []
    for index, path in enumerate(paths):
        args.extend(["-i", str(path)])
        if index < len(paths) - 1:
            filters.append(
                f"[{index}:v]setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration={safe_transition:.3f}[v{index}]"
            )
        else:
            filters.append(f"[{index}:v]setpts=PTS-STARTPTS[v{index}]")

    video_label = "v0"
    combined_duration = adjusted_durations[0]
    for index in range(1, len(paths)):
        next_label = f"vxfp{index}"
        offset = max(0.0, combined_duration - safe_transition)
        filters.append(
            f"[{video_label}][v{index}]xfade=transition=fade:duration={safe_transition:.3f}:offset={offset:.3f}[{next_label}]"
        )
        video_label = next_label
        combined_duration = combined_duration + adjusted_durations[index] - safe_transition

    silence_index = len(paths)
    args.extend([
        "-f", "lavfi",
        "-t", f"{max(original_total, 0.1):.3f}",
        "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
    ])

    temp_target = target.with_name(target.stem + "_xfade_preserve_v134g.mp4")
    try:
        _run_ffmpeg([
            *args,
            "-filter_complex", ";".join(filters),
            "-map", f"[{video_label}]",
            "-map", f"{silence_index}:a:0",
            "-t", f"{max(original_total, 0.1):.3f}",
            "-shortest",
            "-c:v", "libx264",
            "-preset", AVA_BOARD_ASSEMBLY_PRESET,
            "-crf", AVA_BOARD_ASSEMBLY_CRF,
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            "-movflags", "+faststart",
            str(temp_target),
        ])
        if not temp_target.exists():
            return {"applied": False, "reason": "xfade_preserve_output_missing"}
        shutil.copy2(temp_target, target)
        result = {
            "applied": True,
            "reason": "visual_xfade_preserve_timing_v134g",
            "preserveTiming": True,
            "durationSec": safe_transition,
            "inputDurations": durations,
            "expectedDurationSec": original_total,
            "actualDurationSec": _ffprobe_duration(target) or 0.0,
        }
        print("[BOARD ASSEMBLY XFADE PRESERVE TIMING APPLIED V134G]", {"job_id": job_id, **result})
        return result
    finally:
        try:
            temp_target.unlink(missing_ok=True)
        except Exception:
            pass



# AVA_BOARD_ASSEMBLY_PRESERVE_TIMING_AUDIO_FIX_V134H:
# Override V134G timing-safe xfade to keep the already-built stable concat audio.
# V134G preserved duration visually but used silent audio, so scene audio could disappear after transitions.
def _assembly_apply_visual_xfade_preserve_timing_v134g(paths: list[Path], target: Path, transition_sec: float, job_id: str) -> dict[str, Any]:
    if len(paths) < 2:
        return {"applied": False, "reason": "not_enough_clips"}

    durations = [float(_ffprobe_duration(path) or 0.0) for path in paths]
    if any(value <= 0.1 for value in durations):
        return {"applied": False, "reason": "clip_duration_missing", "durations": durations}

    safe_transition = max(0.1, min(3.0, float(transition_sec or 0.5)))
    max_by_shortest = min(durations) - 0.05
    if max_by_shortest < 0.1:
        return {"applied": False, "reason": "clips_too_short", "durations": durations}
    safe_transition = min(safe_transition, max_by_shortest)

    original_total = sum(durations)
    adjusted_durations = [
        (duration + safe_transition) if index < len(paths) - 1 else duration
        for index, duration in enumerate(durations)
    ]

    # target is the stable normal concat at this point. Keep it as the audio source.
    audio_source = target.with_name(target.stem + "_pre_xfade_audio_v134h.mp4")
    shutil.copy2(target, audio_source)

    args = ["-y"]
    filters: list[str] = []
    for index, path in enumerate(paths):
        args.extend(["-i", str(path)])
        if index < len(paths) - 1:
            filters.append(
                f"[{index}:v]setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration={safe_transition:.3f}[v{index}]"
            )
        else:
            filters.append(f"[{index}:v]setpts=PTS-STARTPTS[v{index}]")

    video_label = "v0"
    combined_duration = adjusted_durations[0]
    for index in range(1, len(paths)):
        next_label = f"vxfp{index}"
        offset = max(0.0, combined_duration - safe_transition)
        filters.append(
            f"[{video_label}][v{index}]xfade=transition=fade:duration={safe_transition:.3f}:offset={offset:.3f}[{next_label}]"
        )
        video_label = next_label
        combined_duration = combined_duration + adjusted_durations[index] - safe_transition

    # Add the original stable concat as final input and preserve its audio.
    audio_input_index = len(paths)
    args.extend(["-i", str(audio_source)])

    temp_target = target.with_name(target.stem + "_xfade_preserve_audio_v134h.mp4")
    try:
        _run_ffmpeg([
            *args,
            "-filter_complex", ";".join(filters),
            "-map", f"[{video_label}]",
            "-map", f"{audio_input_index}:a?",
            "-t", f"{max(original_total, 0.1):.3f}",
            "-shortest",
            "-c:v", "libx264",
            "-preset", AVA_BOARD_ASSEMBLY_PRESET,
            "-crf", AVA_BOARD_ASSEMBLY_CRF,
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            "-movflags", "+faststart",
            str(temp_target),
        ])
        if not temp_target.exists():
            return {"applied": False, "reason": "xfade_preserve_audio_output_missing"}
        shutil.copy2(temp_target, target)
        result = {
            "applied": True,
            "reason": "visual_xfade_preserve_timing_audio_v134h",
            "preserveTiming": True,
            "audioPreserved": True,
            "durationSec": safe_transition,
            "inputDurations": durations,
            "expectedDurationSec": original_total,
            "actualDurationSec": _ffprobe_duration(target) or 0.0,
        }
        print("[BOARD ASSEMBLY XFADE PRESERVE TIMING AUDIO APPLIED V134H]", {"job_id": job_id, **result})
        return result
    finally:
        for tmp in (temp_target, audio_source):
            try:
                tmp.unlink(missing_ok=True)
            except Exception:
                pass




# AVA_BOARD_ASSEMBLY_FREEZE_HANDLE_XFADE_V196E:
# Lip-sync-safe real xfade without dark fade. It creates synthetic handles from freeze frames:
#   prev clip: actual scene + cloned last frame for T/2
#   next clip: cloned first frame for T/2 + actual scene
# Then it applies a normal xfade of T seconds. Output duration remains exactly sum(scene durations),
# and the next clip's real mouth movement begins at the original scene boundary.
def _assembly_apply_visual_freeze_handle_xfade_v196e(paths: list[Path], target: Path, transition_sec: float, job_id: str) -> dict[str, Any]:
    if len(paths) < 2:
        return {"applied": False, "reason": "not_enough_clips"}

    durations = [float(_ffprobe_duration(path) or 0.0) for path in paths]
    if any(value <= 0.1 for value in durations):
        return {"applied": False, "reason": "clip_duration_missing", "durations": durations}

    requested_transition = max(0.05, min(3.0, float(transition_sec or 0.5)))
    max_by_shortest = max(0.05, min(durations) * 0.80)
    safe_transition = min(requested_transition, max_by_shortest)
    half = safe_transition / 2.0
    original_total = sum(durations)

    audio_source = target.with_name(target.stem + "_pre_freeze_handle_xfade_v196e.mp4")
    shutil.copy2(target, audio_source)

    args = ["-y"]
    filters: list[str] = []
    padded_durations: list[float] = []

    print("[BOARD ASSEMBLY FREEZE HANDLE XFADE START V196E]", {
        "job_id": job_id,
        "requestedDurationSec": requested_transition,
        "appliedDurationSec": safe_transition,
        "halfHandleSec": half,
        "inputDurations": durations,
        "expectedDurationSec": original_total,
    }, flush=True)

    for index, path in enumerate(paths):
        args.extend(["-i", str(path)])
        start_pad = half if index > 0 else 0.0
        stop_pad = half if index < len(paths) - 1 else 0.0
        padded_duration = durations[index] + start_pad + stop_pad
        padded_durations.append(padded_duration)
        filters.append(
            f"[{index}:v]setpts=PTS-STARTPTS,"
            f"tpad=start_mode=clone:start_duration={start_pad:.6f}:stop_mode=clone:stop_duration={stop_pad:.6f},"
            f"trim=duration={padded_duration:.6f},setpts=PTS-STARTPTS,format=yuv420p[v{index}]"
        )

    video_label = "v0"
    combined_duration = padded_durations[0]
    for index in range(1, len(paths)):
        next_label = f"vfhxe{index}"
        offset = max(0.0, combined_duration - safe_transition)
        filters.append(
            f"[{video_label}][v{index}]xfade=transition=fade:duration={safe_transition:.6f}:offset={offset:.6f}[{next_label}]"
        )
        video_label = next_label
        combined_duration = combined_duration + padded_durations[index] - safe_transition

    audio_input_index = len(paths)
    args.extend(["-i", str(audio_source)])

    temp_target = target.with_name(target.stem + "_freeze_handle_xfade_v196e.mp4")
    try:
        _run_ffmpeg([
            *args,
            "-filter_complex", ";".join(filters),
            "-map", f"[{video_label}]",
            "-map", f"{audio_input_index}:a?",
            "-t", f"{max(original_total, 0.1):.6f}",
            "-shortest",
            "-c:v", "libx264",
            "-preset", AVA_BOARD_ASSEMBLY_PRESET,
            "-crf", AVA_BOARD_ASSEMBLY_CRF,
            "-pix_fmt", "yuv420p",
            "-x264-params", "bframes=0:keyint=60:min-keyint=60:scenecut=0",
            "-c:a", "aac",
            "-b:a", "192k",
            "-ar", "48000",
            "-ac", "2",
            "-movflags", "+faststart",
            "-video_track_timescale", "30000",
            str(temp_target),
        ])
        if not temp_target.exists():
            return {"applied": False, "reason": "freeze_handle_xfade_output_missing"}
        shutil.copy2(temp_target, target)
        result = {
            "applied": True,
            "reason": "visual_freeze_handle_xfade_preserve_lipsync_v196e",
            "preserveTiming": True,
            "audioPreserved": True,
            "durationSec": safe_transition,
            "requestedDurationSec": requested_transition,
            "halfHandleSec": half,
            "inputDurations": durations,
            "expectedDurationSec": original_total,
            "actualDurationSec": _ffprobe_duration(target) or 0.0,
        }
        print("[BOARD ASSEMBLY FREEZE HANDLE XFADE APPLIED V196E]", {"job_id": job_id, **result}, flush=True)
        return result
    finally:
        for tmp in (temp_target, audio_source):
            try:
                tmp.unlink(missing_ok=True)
            except Exception:
                pass


# AVA_BOARD_ASSEMBLY_LIPSYNC_SAFE_FADE_TRANSITIONS_V196C:
# For master-audio lip-sync timelines, true xfade can reveal mouth movement before/after
# the exact lyric boundary. This mode keeps the exact concat timing and applies per-clip
# fade-in/fade-out to black instead. It gives a soft visual transition without moving the
# next/previous clip in time, so lip-sync remains tied to the master audio.
def _assembly_apply_visual_safe_fades_v196c(paths: list[Path], target: Path, transition_sec: float, job_id: str) -> dict[str, Any]:
    if len(paths) < 2:
        return {"applied": False, "reason": "not_enough_clips"}

    durations = [float(_ffprobe_duration(path) or 0.0) for path in paths]
    if any(value <= 0.1 for value in durations):
        return {"applied": False, "reason": "clip_duration_missing", "durations": durations}

    requested_transition = max(0.05, min(3.0, float(transition_sec or 0.5)))
    # Fade-to-black is not an overlap, but keep it below half of the shortest clip so the
    # center of short lip-sync clips is still visible.
    max_by_shortest = max(0.05, (min(durations) * 0.45))
    safe_transition = min(requested_transition, max_by_shortest)
    original_total = sum(durations)

    fade_dir = target.with_name(target.stem + "_safe_fades_v196c")
    fade_dir.mkdir(parents=True, exist_ok=True)
    faded_paths: list[Path] = []

    print("[BOARD ASSEMBLY SAFE FADE TRANSITIONS START V196C]", {
        "job_id": job_id,
        "requestedDurationSec": requested_transition,
        "appliedDurationSec": safe_transition,
        "inputDurations": durations,
        "expectedDurationSec": original_total,
    }, flush=True)

    try:
        for index, path in enumerate(paths):
            duration = durations[index]
            fade_in = safe_transition if index > 0 else 0.0
            fade_out = safe_transition if index < len(paths) - 1 else 0.0
            out_clip = fade_dir / f"{index + 1:04d}_safe_fade.mp4"

            vf_parts = ["setpts=PTS-STARTPTS", "format=yuv420p"]
            if fade_in > 0.001:
                vf_parts.append(f"fade=t=in:st=0:d={fade_in:.6f}:color=black")
            if fade_out > 0.001:
                fade_out_start = max(0.0, duration - fade_out)
                vf_parts.append(f"fade=t=out:st={fade_out_start:.6f}:d={fade_out:.6f}:color=black")
            vf_parts.append(f"trim=duration={duration:.6f}")
            vf_parts.append("setpts=PTS-STARTPTS")
            vf = ",".join(vf_parts)

            _run_ffmpeg([
                "-y",
                "-i", str(path),
                "-vf", vf,
                "-map", "0:v:0",
                "-map", "0:a?",
                "-t", f"{max(duration, 0.1):.6f}",
                "-c:v", "libx264",
                "-preset", AVA_BOARD_ASSEMBLY_PRESET,
                "-crf", AVA_BOARD_ASSEMBLY_CRF,
                "-pix_fmt", "yuv420p",
                "-x264-params", "bframes=0:keyint=60:min-keyint=60:scenecut=0",
                "-c:a", "aac",
                "-b:a", "192k",
                "-ar", "48000",
                "-ac", "2",
                "-movflags", "+faststart",
                "-video_track_timescale", "30000",
                str(out_clip),
            ])
            faded_paths.append(out_clip)

        concat_file = fade_dir / "concat_safe_fades_v196c.txt"
        _write_concat_file(faded_paths, concat_file)
        temp_target = target.with_name(target.stem + "_safe_fades_v196c.mp4")
        _run_ffmpeg([
            "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", str(concat_file),
            "-c", "copy",
            str(temp_target),
        ])
        if not temp_target.exists():
            return {"applied": False, "reason": "safe_fade_output_missing"}
        shutil.copy2(temp_target, target)
        result = {
            "applied": True,
            "reason": "visual_safe_fade_preserve_lipsync_v196c",
            "preserveTiming": True,
            "audioPreserved": True,
            "durationSec": safe_transition,
            "requestedDurationSec": requested_transition,
            "inputDurations": durations,
            "expectedDurationSec": original_total,
            "actualDurationSec": _ffprobe_duration(target) or 0.0,
        }
        print("[BOARD ASSEMBLY SAFE FADE TRANSITIONS APPLIED V196C]", {"job_id": job_id, **result}, flush=True)
        return result
    finally:
        try:
            if fade_dir.exists():
                shutil.rmtree(fade_dir, ignore_errors=True)
        except Exception:
            pass
        try:
            target.with_name(target.stem + "_safe_fades_v196c.mp4").unlink(missing_ok=True)
        except Exception:
            pass



# AVA_BOARD_ASSEMBLY_TRANSITION_VISUAL_MODE_V196E:
def _assembly_transition_visual_mode_v196e(payload: dict[str, Any]) -> str:
    transitions = payload.get("transitions") if isinstance(payload.get("transitions"), dict) else {}
    raw = (
        transitions.get("visualModeV196E")
        or transitions.get("visualMode")
        or transitions.get("visual_mode")
        or payload.get("transitionVisualModeV196E")
        or payload.get("transitionVisualMode")
        or payload.get("transition_visual_mode")
        or "fade_to_black"
    )
    mode = str(raw or "fade_to_black").strip().lower().replace("-", "_")
    if mode in {"xfade", "crossfade", "cross_fade", "freeze_handle_xfade"}:
        return "xfade"
    return "fade_to_black"



# V199V_STRICT_BOARD_TIMELINE:
# Build the visual montage on the absolute Board timeline instead of trusting each
# generated mp4 duration. Generated i2v/ia2v clips are often 24fps and 2-3 frames
# longer than requested; if those durations are concatenated, lip-sync drifts by
# seconds over a long song. This renderer trims/pads every prepared clip to its
# Board target duration, concatenates inside one filter graph, then applies CFR
# only once at the end so rounding does not accumulate per scene.
def _render_board_strict_timeline_concat_v199v(
    paths: list[Path],
    prepared_items: list[dict[str, Any]],
    target: Path,
    *,
    width: int,
    height: int,
    fps: int,
    job_id: str,
) -> dict[str, Any]:
    if not paths:
        return {"applied": False, "reason": "no_paths"}

    safe_fps = max(1, int(fps or 30))
    args = ["-y"]
    filters: list[str] = []
    labels: list[str] = []
    durations: list[float] = []

    for index, path in enumerate(paths):
        args.extend(["-i", str(path)])
        item = prepared_items[index] if index < len(prepared_items) and isinstance(prepared_items[index], dict) else {}
        start_sec = _assembly_float(item.get("targetStartSec") or item.get("target_start_sec") or item.get("start_sec") or item.get("startSec"), 0.0)
        end_sec = _assembly_float(item.get("targetEndSec") or item.get("target_end_sec") or item.get("end_sec") or item.get("endSec"), 0.0)
        fallback = _assembly_float(item.get("durationSec") or item.get("duration_sec"), 0.0)
        target_duration = end_sec - start_sec if end_sec > start_sec else fallback
        target_duration = max(0.04, float(target_duration or fallback or 0.1))
        durations.append(target_duration)
        label = f"v199v_{index}"
        # tpad before trim makes short clips safe; trim enforces the Board duration.
        filters.append(
            f"[{index}:v:0]"
            f"setpts=PTS-STARTPTS,"
            f"tpad=stop_mode=clone:stop_duration=2.000,"
            f"trim=duration={target_duration:.6f},"
            f"setpts=PTS-STARTPTS"
            f"[{label}]"
        )
        labels.append(f"[{label}]")

    timeline_duration = max(0.1, sum(durations))
    silence_index = len(paths)
    args.extend([
        "-f", "lavfi",
        "-t", f"{timeline_duration:.6f}",
        "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
    ])

    concat_inputs = "".join(labels)
    filters.append(
        f"{concat_inputs}concat=n={len(labels)}:v=1:a=0[v199vcat];"
        f"[v199vcat]"
        f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
        f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,"
        f"setsar=1,"
        f"fps={safe_fps},"
        f"format=yuv420p,"
        f"setpts=PTS-STARTPTS[v199vout]"
    )

    print("[BOARD ASSEMBLY STRICT BOARD TIMELINE START V199V]", {
        "job_id": job_id,
        "items": len(paths),
        "boardTimelineDurationSec": round(timeline_duration, 6),
        "fps": safe_fps,
        "mode": "trim_pad_each_scene_then_global_cfr",
    })

    _run_ffmpeg([
        *args,
        "-filter_complex", ";".join(filters),
        "-map", "[v199vout]",
        "-map", f"{silence_index}:a:0",
        "-t", f"{timeline_duration:.6f}",
        "-c:v", "libx264",
        "-preset", AVA_BOARD_ASSEMBLY_PRESET,
        "-crf", AVA_BOARD_ASSEMBLY_CRF,
        "-pix_fmt", "yuv420p",
        "-r", str(safe_fps),
        "-video_track_timescale", "90000",
        "-c:a", "aac",
        "-b:a", "192k",
        "-ar", "48000",
        "-ac", "2",
        "-movflags", "+faststart",
        str(target),
    ])

    actual = _ffprobe_duration(target) or 0.0
    result = {
        "applied": True,
        "reason": "strict_board_timeline_v199v",
        "items": len(paths),
        "expectedDurationSec": timeline_duration,
        "actualDurationSec": actual,
        "durationDeltaSec": actual - timeline_duration,
        "fps": safe_fps,
    }
    print("[BOARD ASSEMBLY STRICT BOARD TIMELINE DONE V199V]", {"job_id": job_id, **result})
    return result


# V199AB_ABSOLUTE_FRAME_TIMELINE:
# Experimental renderer: place every scene on the absolute Board timeline instead of
# concatenating by summed durations. This is meant to catch/fix internal boundary
# jumps where the final length is correct but a later scene visually appears late.
# It also reads optional per-scene fields for future/manual correction:
#   assembly_visual_offset_sec / visual_offset_sec / video_offset_sec
# Negative offset means: advance visual content inside that scene slot.
def _render_board_absolute_frame_timeline_concat_v199ab(
    paths: list[Path],
    prepared_items: list[dict[str, Any]],
    target: Path,
    *,
    width: int,
    height: int,
    fps: int,
    job_id: str,
) -> dict[str, Any]:
    if not paths:
        return {"applied": False, "reason": "no_paths"}

    safe_fps = max(1, int(fps or 30))
    args = ["-y"]
    filters: list[str] = []
    overlays: list[dict[str, Any]] = []

    for index, path in enumerate(paths):
        args.extend(["-i", str(path)])
        item = prepared_items[index] if index < len(prepared_items) and isinstance(prepared_items[index], dict) else {}
        scene_id = str(item.get("scene_id") or item.get("sceneId") or item.get("id") or f"scene_{index+1:02d}")
        start_sec = _assembly_float(item.get("targetStartSec") or item.get("target_start_sec") or item.get("start_sec") or item.get("startSec"), 0.0)
        end_sec = _assembly_float(item.get("targetEndSec") or item.get("target_end_sec") or item.get("end_sec") or item.get("endSec"), 0.0)
        fallback = _assembly_float(item.get("durationSec") or item.get("duration_sec"), 0.0)
        target_duration = end_sec - start_sec if end_sec > start_sec else fallback
        target_duration = max(0.04, float(target_duration or fallback or 0.1))
        if end_sec <= start_sec:
            end_sec = start_sec + target_duration

        visual_offset = _assembly_float(
            item.get("assembly_visual_offset_sec")
            or item.get("assemblyVisualOffsetSec")
            or item.get("visual_offset_sec")
            or item.get("visualOffsetSec")
            or item.get("video_offset_sec")
            or item.get("videoOffsetSec"),
            0.0,
        )

        # Snap only for audit; placement still uses Board seconds so total timeline stays exact.
        expected_start_frame = int(round(start_sec * safe_fps))
        expected_end_frame = int(round(end_sec * safe_fps))
        expected_frames = max(1, expected_end_frame - expected_start_frame)
        snapped_duration = expected_frames / float(safe_fps)

        overlays.append({
            "index": index,
            "path": path,
            "scene_id": scene_id,
            "start_sec": start_sec,
            "end_sec": end_sec,
            "target_duration": target_duration,
            "visual_offset": visual_offset,
            "expected_start_frame": expected_start_frame,
            "expected_end_frame": expected_end_frame,
            "expected_frames": expected_frames,
            "snapped_duration": snapped_duration,
        })

    if not overlays:
        return {"applied": False, "reason": "no_overlays"}

    timeline_duration = max(0.1, max(float(x["end_sec"]) for x in overlays))
    total_frame_estimate = int(round(timeline_duration * safe_fps))
    silence_index = len(paths)
    args.extend([
        "-f", "lavfi",
        "-t", f"{timeline_duration:.6f}",
        "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
    ])

    # Base canvas. Overlay all scene videos at absolute Board starts.
    filters.append(
        f"color=c=black:s={width}x{height}:r={safe_fps}:d={timeline_duration:.6f},"
        f"format=yuv420p,setpts=PTS-STARTPTS[v199ab_base]"
    )

    print("[BOARD ASSEMBLY ABSOLUTE FRAME TIMELINE START V199AB]", {
        "job_id": job_id,
        "items": len(overlays),
        "boardTimelineDurationSec": round(timeline_duration, 6),
        "fps": safe_fps,
        "totalFrameEstimate": total_frame_estimate,
        "mode": "absolute_overlay_by_board_start_end",
    }, flush=True)

    prev_label = "v199ab_base"
    audit_rows: list[dict[str, Any]] = []
    for row in overlays:
        index = int(row["index"])
        scene_id = str(row["scene_id"])
        start_sec = float(row["start_sec"])
        end_sec = float(row["end_sec"])
        target_duration = float(row["target_duration"])
        visual_offset = float(row["visual_offset"])
        expected_frames = int(row["expected_frames"])
        expected_start_frame = int(row["expected_start_frame"])
        expected_end_frame = int(row["expected_end_frame"])

        content_seek = max(0.0, -visual_offset)
        start_hold = max(0.0, visual_offset)
        raw_label = f"v199ab_raw_{index}"
        label = f"v199ab_{index}"
        out_label = f"v199ab_mix_{index}"

        # Negative visual offset advances content by seeking into the source video.
        # Positive visual offset delays visual motion by cloning the first frame first.
        if start_hold > 0.0005:
            filters.append(
                f"[{index}:v:0]"
                f"setpts=PTS-STARTPTS,"
                f"tpad=start_mode=clone:start_duration={start_hold:.6f}:stop_mode=clone:stop_duration=2.000,"
                f"trim=duration={target_duration:.6f},"
                f"setpts=PTS-STARTPTS"
                f"[{raw_label}]"
            )
        elif content_seek > 0.0005:
            filters.append(
                f"[{index}:v:0]"
                f"setpts=PTS-STARTPTS,"
                f"tpad=stop_mode=clone:stop_duration=2.000,"
                f"trim=start={content_seek:.6f}:duration={target_duration:.6f},"
                f"setpts=PTS-STARTPTS"
                f"[{raw_label}]"
            )
        else:
            filters.append(
                f"[{index}:v:0]"
                f"setpts=PTS-STARTPTS,"
                f"tpad=stop_mode=clone:stop_duration=2.000,"
                f"trim=duration={target_duration:.6f},"
                f"setpts=PTS-STARTPTS"
                f"[{raw_label}]"
            )

        filters.append(
            f"[{raw_label}]"
            f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
            f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,"
            f"setsar=1,"
            f"fps={safe_fps},"
            f"format=yuv420p,"
            f"setpts=PTS-STARTPTS+{start_sec:.6f}/TB"
            f"[{label}]"
        )
        filters.append(
            f"[{prev_label}][{label}]"
            f"overlay=eof_action=pass:shortest=0:enable='between(t,{start_sec:.6f},{end_sec:.6f})'"
            f"[{out_label}]"
        )
        prev_label = out_label
        audit_rows.append({
            "scene_id": scene_id,
            "start_sec": round(start_sec, 6),
            "end_sec": round(end_sec, 6),
            "duration_sec": round(target_duration, 6),
            "start_frame": expected_start_frame,
            "end_frame": expected_end_frame,
            "frames": expected_frames,
            "visual_offset_sec": round(visual_offset, 6),
            "content_seek_sec": round(content_seek, 6),
        })

    audio_labels_v200u: list[str] = []
    audio_audit_v200u: list[dict[str, Any]] = []
    for row_audio_v200u in overlays:
        try:
            audio_index_v200u = int(row_audio_v200u["index"])
            audio_path_v200u = Path(row_audio_v200u["path"])
            if not _ffprobe_has_audio(audio_path_v200u):
                audio_audit_v200u.append({"index": audio_index_v200u, "scene_id": row_audio_v200u.get("scene_id"), "has_audio": False})
                continue
            audio_start_v200u = max(0.0, float(row_audio_v200u["start_sec"]))
            audio_duration_v200u = max(0.04, float(row_audio_v200u["target_duration"]))
            audio_delay_ms_v200u = max(0, int(round(audio_start_v200u * 1000.0)))
            audio_label_v200u = f"v199ab_audio_{audio_index_v200u}"
            filters.append(
                f"[{audio_index_v200u}:a:0]"
                f"aresample=48000,atrim=duration={audio_duration_v200u:.6f},"
                f"asetpts=PTS-STARTPTS,"
                f"adelay={audio_delay_ms_v200u}|{audio_delay_ms_v200u},"
                f"apad,atrim=duration={timeline_duration:.6f},"
                f"asetpts=N/SR/TB"
                f"[{audio_label_v200u}]"
            )
            audio_labels_v200u.append(f"[{audio_label_v200u}]")
            audio_audit_v200u.append({
                "index": audio_index_v200u,
                "scene_id": row_audio_v200u.get("scene_id"),
                "has_audio": True,
                "start_sec": round(audio_start_v200u, 6),
                "duration_sec": round(audio_duration_v200u, 6),
                "delay_ms": audio_delay_ms_v200u,
            })
        except Exception as exc:
            audio_audit_v200u.append({"index": row_audio_v200u.get("index"), "scene_id": row_audio_v200u.get("scene_id"), "error": str(exc)})

    audio_map_v200u = f"{silence_index}:a:0"
    if audio_labels_v200u:
        audio_map_v200u = "[v199ab_audio_mix_v200u]"
        filters.append(
            "".join(audio_labels_v200u)
            + f"amix=inputs={len(audio_labels_v200u)}:duration=longest:dropout_transition=0:normalize=0,"
            + f"atrim=duration={timeline_duration:.6f},asetpts=N/SR/TB[v199ab_audio_mix_v200u]"
        )

    filters.append(f"[{prev_label}]setpts=PTS-STARTPTS,format=yuv420p[v199about]")

    print("[BOARD ASSEMBLY SCENE AUDIO ABSOLUTE MIX V200U]", {
        "job_id": job_id,
        "items": len(overlays),
        "audioInputs": len(audio_labels_v200u),
        "audioMap": audio_map_v200u,
        "timelineDurationSec": round(timeline_duration, 6),
        "rows": audio_audit_v200u,
    }, flush=True)

    # Log compact audit around scene boundaries. Full row list is useful for diagnosing
    # whether late scenes start from accumulated duration or absolute Board time.
    print("[BOARD ASSEMBLY ABSOLUTE FRAME AUDIT V199AB]", {
        "job_id": job_id,
        "fps": safe_fps,
        "rows": audit_rows,
    }, flush=True)

    _run_ffmpeg([
        *args,
        "-filter_complex", ";".join(filters),
        "-map", "[v199about]",
        "-map", audio_map_v200u,
        "-t", f"{timeline_duration:.6f}",
        "-c:v", "libx264",
        "-preset", AVA_BOARD_ASSEMBLY_PRESET,
        "-crf", AVA_BOARD_ASSEMBLY_CRF,
        "-pix_fmt", "yuv420p",
        "-r", str(safe_fps),
        "-video_track_timescale", "90000",
        "-c:a", "aac",
        "-b:a", "192k",
        "-ar", "48000",
        "-ac", "2",
        "-movflags", "+faststart",
        str(target),
    ])

    actual = _ffprobe_duration(target) or 0.0
    result = {
        "applied": True,
        "reason": "absolute_frame_timeline_v199ab",
        "items": len(paths),
        "expectedDurationSec": timeline_duration,
        "actualDurationSec": actual,
        "durationDeltaSec": actual - timeline_duration,
        "fps": safe_fps,
        "totalFrameEstimate": total_frame_estimate,
        "sceneAudioAbsoluteV200U": bool(audio_labels_v200u),
        "sceneAudioInputsV200U": len(audio_labels_v200u),
    }
    if audio_labels_v200u:
        print("[BOARD ASSEMBLY SCENE AUDIO ABSOLUTE APPLIED V200U]", {
            "job_id": job_id,
            "audioInputs": len(audio_labels_v200u),
            "timelineDurationSec": round(timeline_duration, 6),
        }, flush=True)
    print("[BOARD ASSEMBLY ABSOLUTE FRAME TIMELINE DONE V199AB]", {"job_id": job_id, **result}, flush=True)
    return result



def _assembly_output_format_lock_v200o(payload: dict[str, Any], default_width: int = 1280, default_height: int = 720) -> dict[str, Any]:
    """AVA_ASSEMBLY_RESULT_FORMAT_LOCK_V200O: enforce project output format on backend."""
    def token(value: Any) -> str:
        raw = str(value or "").strip().lower().replace(" ", "")
        if not raw:
            return ""
        if "9:16" in raw or "916" in raw or "720x1280" in raw or "720×1280" in raw or "vertical" in raw or "portrait" in raw:
            return "9:16"
        if "1:1" in raw or raw == "11" or "1024x1024" in raw or "1024×1024" in raw or "square" in raw:
            return "1:1"
        if "16:9" in raw or "169" in raw or "1280x720" in raw or "1280×720" in raw or "horizontal" in raw or "landscape" in raw:
            return "16:9"
        match = re.search(r"(\d{3,4})[x×:](\d{3,4})", raw)
        if match:
            w = int(match.group(1))
            h = int(match.group(2))
            if h > w * 1.2:
                return "9:16"
            if w > h * 1.2:
                return "16:9"
            return "1:1"
        return ""

    candidates: list[Any] = [
        payload.get("aspect_ratio"), payload.get("aspectRatio"), payload.get("output_format"), payload.get("outputFormat"), payload.get("format"),
        payload.get("resolution"), payload.get("orientation"), payload.get("project_format"), payload.get("projectFormat"),
        f"{payload.get('width')}x{payload.get('height')}" if payload.get("width") and payload.get("height") else "",
        f"{payload.get('output_width')}x{payload.get('output_height')}" if payload.get("output_width") and payload.get("output_height") else "",
        f"{payload.get('outputWidth')}x{payload.get('outputHeight')}" if payload.get("outputWidth") and payload.get("outputHeight") else "",
    ]

    project_id = str(payload.get("project_id") or payload.get("projectId") or "").strip()
    if project_id:
        try:
            db = store.get_db()
            project = (db.get("projects") or {}).get(project_id) or {}
            board = ((db.get("snapshots") or {}).get(project_id) or {}).get("board") or {}
            objs = [project, board, board.get("project") or {}, board.get("project_context") or {}, board.get("projectContext") or {}, board.get("format_contract") or {}, board.get("formatContract") or {}]
            scenes = board.get("scenes") if isinstance(board.get("scenes"), list) else []
            objs.extend([scene for scene in scenes[:3] if isinstance(scene, dict)])
            for obj in objs:
                if not isinstance(obj, dict):
                    continue
                candidates.extend([
                    obj.get("format"), obj.get("project_format"), obj.get("projectFormat"), obj.get("resolution"), obj.get("orientation"),
                    obj.get("aspect_ratio"), obj.get("aspectRatio"), obj.get("output_format"), obj.get("outputFormat"), obj.get("video_format"), obj.get("videoFormat"),
                    f"{obj.get('width')}x{obj.get('height')}" if obj.get("width") and obj.get("height") else "",
                    f"{obj.get('output_width')}x{obj.get('output_height')}" if obj.get("output_width") and obj.get("output_height") else "",
                    f"{obj.get('outputWidth')}x{obj.get('outputHeight')}" if obj.get("outputWidth") and obj.get("outputHeight") else "",
                    f"{obj.get('target_width')}x{obj.get('target_height')}" if obj.get("target_width") and obj.get("target_height") else "",
                    f"{obj.get('targetWidth')}x{obj.get('targetHeight')}" if obj.get("targetWidth") and obj.get("targetHeight") else "",
                ])
        except Exception as exc:
            print("[BOARD ASSEMBLY FORMAT PROJECT READ V200O ERROR]", {"project_id": project_id, "error": str(exc)}, flush=True)

    aspect = ""
    for candidate in candidates:
        aspect = token(candidate)
        if aspect:
            break

    width = _assembly_int(payload.get("width") or payload.get("output_width") or payload.get("outputWidth"), default_width)
    height = _assembly_int(payload.get("height") or payload.get("output_height") or payload.get("outputHeight"), default_height)
    if aspect == "9:16":
        width, height = 720, 1280
    elif aspect == "1:1":
        width, height = 1024, 1024
    elif aspect == "16:9":
        width, height = 1280, 720
    elif height > width * 1.2:
        aspect = "9:16"
    elif width > height * 1.2:
        aspect = "16:9"
    else:
        aspect = "1:1"

    fit_mode = str(payload.get("fit_mode") or payload.get("fitMode") or payload.get("output_fit_mode") or payload.get("outputFitMode") or ("cover" if aspect in {"9:16", "1:1"} else "contain")).strip().lower()
    if fit_mode not in {"contain", "cover", "crop", "fill", "center_crop"}:
        fit_mode = "cover" if aspect in {"9:16", "1:1"} else "contain"
    if fit_mode in {"crop", "fill", "center_crop"}:
        fit_mode = "cover"
    return {"width": width, "height": height, "aspect_ratio": aspect, "fit_mode": fit_mode}



def _assembly_output_format_lock_v200p(payload: dict[str, Any], raw_items: list[Any] | None = None, default_width: int = 1280, default_height: int = 720) -> dict[str, Any]:
    """AVA_ASSEMBLY_PORTRAIT_PROBE_V200P: lock Assembly canvas to project/real video orientation.

    Important: V200O read the snapshot wrapper instead of snapshot['data'], and frontend
    may still send default 16:9. This helper prefers real project/board/scene format
    contracts and then probes source videos before falling back to payload defaults.
    """
    def token(value: Any) -> str:
        raw = str(value or "").strip().lower().replace(" ", "")
        if not raw:
            return ""
        raw = raw.replace("_", "-")
        if "9:16" in raw or "916" in raw or "720x1280" in raw or "720×1280" in raw or "vertical" in raw or "portrait" in raw or "shorts" in raw or "reels" in raw or "tiktok" in raw:
            return "9:16"
        if "1:1" in raw or raw == "11" or "1024x1024" in raw or "1024×1024" in raw or "square" in raw:
            return "1:1"
        if "16:9" in raw or "169" in raw or "1280x720" in raw or "1280×720" in raw or "horizontal" in raw or "landscape" in raw:
            return "16:9"
        match = re.search(r"(\d{3,4})[x×:](\d{3,4})", raw)
        if match:
            w = int(match.group(1))
            h = int(match.group(2))
            if h > w * 1.18:
                return "9:16"
            if w > h * 1.18:
                return "16:9"
            return "1:1"
        return ""

    def add_obj(candidates: list[Any], obj: Any) -> None:
        if not isinstance(obj, dict):
            return
        keys = [
            "format", "project_format", "projectFormat", "resolution", "orientation",
            "aspect_ratio", "aspectRatio", "output_format", "outputFormat",
            "video_format", "videoFormat", "target_format", "targetFormat",
            "canvas_format", "canvasFormat", "ratio", "projectRatio",
        ]
        for key in keys:
            candidates.append(obj.get(key))
        for a, b in [
            ("width", "height"), ("video_width", "video_height"), ("videoWidth", "videoHeight"),
            ("output_width", "output_height"), ("outputWidth", "outputHeight"),
            ("target_width", "target_height"), ("targetWidth", "targetHeight"),
            ("canvas_width", "canvas_height"), ("canvasWidth", "canvasHeight"),
        ]:
            if obj.get(a) and obj.get(b):
                candidates.append(f"{obj.get(a)}x{obj.get(b)}")

    def choose(candidates: list[Any]) -> str:
        found: list[str] = []
        for candidate in candidates:
            t = token(candidate)
            if t:
                found.append(t)
        # In this app 16:9 is often a default fallback. If any real contract says 9:16,
        # portrait must win over a stale/default 16:9.
        if "9:16" in found:
            return "9:16"
        if "1:1" in found:
            return "1:1"
        if "16:9" in found:
            return "16:9"
        return ""

    project_candidates: list[Any] = []
    payload_candidates: list[Any] = []
    item_candidates: list[Any] = []

    project_id = str(payload.get("project_id") or payload.get("projectId") or "").strip()
    if project_id:
        try:
            db = store.get_db()
            project = (db.get("projects") or {}).get(project_id) or {}
            snapshots = (db.get("snapshots") or {}).get(project_id) or {}
            board_snap = snapshots.get("board") or {}
            manual_snap = snapshots.get("manual_timing") or {}
            assembly_snap = snapshots.get("board_assembly") or {}
            board = board_snap.get("data") if isinstance(board_snap, dict) and isinstance(board_snap.get("data"), dict) else board_snap
            manual = manual_snap.get("data") if isinstance(manual_snap, dict) and isinstance(manual_snap.get("data"), dict) else manual_snap
            assembly = assembly_snap.get("data") if isinstance(assembly_snap, dict) and isinstance(assembly_snap.get("data"), dict) else assembly_snap
            for obj in [
                project,
                project.get("settings") if isinstance(project, dict) else {},
                project.get("format_contract") if isinstance(project, dict) else {},
                project.get("formatContract") if isinstance(project, dict) else {},
                board,
                board.get("project") if isinstance(board, dict) else {},
                board.get("project_context") if isinstance(board, dict) else {},
                board.get("projectContext") if isinstance(board, dict) else {},
                board.get("format_contract") if isinstance(board, dict) else {},
                board.get("formatContract") if isinstance(board, dict) else {},
                manual,
                manual.get("project") if isinstance(manual, dict) else {},
                manual.get("format_contract") if isinstance(manual, dict) else {},
                assembly,
                assembly.get("project") if isinstance(assembly, dict) else {},
            ]:
                add_obj(project_candidates, obj)
            scenes = []
            if isinstance(board, dict):
                for key in ("scenes", "boardScenes", "board_scenes", "segments"):
                    value = board.get(key)
                    if isinstance(value, list) and value:
                        scenes = value
                        break
            for scene in scenes[:12]:
                add_obj(project_candidates, scene)
                if isinstance(scene, dict):
                    add_obj(project_candidates, scene.get("raw"))
                    add_obj(project_candidates, scene.get("format_contract"))
                    add_obj(project_candidates, scene.get("formatContract"))
        except Exception as exc:
            print("[BOARD ASSEMBLY FORMAT PROJECT READ V200P ERROR]", {"project_id": project_id, "error": str(exc)}, flush=True)

    for obj in [payload, payload.get("project") if isinstance(payload, dict) else {}, payload.get("board") if isinstance(payload, dict) else {}, payload.get("boardSnapshot") if isinstance(payload, dict) else {}]:
        add_obj(payload_candidates, obj)
    if isinstance(raw_items, list):
        for item in raw_items[:12]:
            add_obj(item_candidates, item)
            if isinstance(item, dict):
                add_obj(item_candidates, item.get("raw"))
                add_obj(item_candidates, item.get("format_contract"))
                add_obj(item_candidates, item.get("formatContract"))

    aspect = choose(project_candidates) or choose(item_candidates)

    # If project metadata is missing, inspect real input files. This catches vertical scenes
    # even when the frontend sent default 16:9. If sources are already 16:9 with black bars,
    # project/scene format above is still the authoritative fix.
    probe_rows: list[dict[str, Any]] = []
    if not aspect and isinstance(raw_items, list):
        portrait = landscape = square = 0
        for item in raw_items[:10]:
            if not isinstance(item, dict):
                continue
            try:
                video_value = _assembly_item_video_value(item)
                if not video_value:
                    continue
                source_path = _resolve_local_file(video_value)
                w, h = _assembly_probe_video_size_v200p(source_path)
                if w <= 0 or h <= 0:
                    continue
                row = {"scene_id": item.get("scene_id") or item.get("sceneId") or item.get("id"), "width": w, "height": h}
                probe_rows.append(row)
                if h > w * 1.18:
                    portrait += 1
                elif w > h * 1.18:
                    landscape += 1
                else:
                    square += 1
            except Exception:
                continue
        if portrait and portrait >= landscape:
            aspect = "9:16"
        elif square and square > portrait and square >= landscape:
            aspect = "1:1"
        elif landscape:
            aspect = "16:9"
        if probe_rows:
            print("[BOARD ASSEMBLY SOURCE ORIENTATION PROBE V200P]", {"project_id": project_id, "aspect": aspect, "rows": probe_rows[:5]}, flush=True)

    # Payload fallback must be last because many old Assembly payloads default to 16:9.
    if not aspect:
        aspect = choose(payload_candidates)

    width = _assembly_int(payload.get("width") or payload.get("output_width") or payload.get("outputWidth"), default_width)
    height = _assembly_int(payload.get("height") or payload.get("output_height") or payload.get("outputHeight"), default_height)
    if aspect == "9:16":
        width, height = 720, 1280
    elif aspect == "1:1":
        width, height = 1024, 1024
    elif aspect == "16:9":
        width, height = 1280, 720
    elif height > width * 1.18:
        aspect = "9:16"
    elif width > height * 1.18:
        aspect = "16:9"
    else:
        aspect = "1:1"

    fit_mode = str(payload.get("fit_mode") or payload.get("fitMode") or payload.get("output_fit_mode") or payload.get("outputFitMode") or ("cover" if aspect in {"9:16", "1:1"} else "contain")).strip().lower()
    if fit_mode not in {"contain", "cover", "crop", "fill", "center_crop"}:
        fit_mode = "cover" if aspect in {"9:16", "1:1"} else "contain"
    if fit_mode in {"crop", "fill", "center_crop"}:
        fit_mode = "cover"
    if aspect == "9:16" and fit_mode == "contain":
        # For vertical projects, contain keeps old black side bars when scene videos are 16:9.
        fit_mode = "cover"
    return {
        "width": int(width),
        "height": int(height),
        "aspect_ratio": aspect,
        "fit_mode": fit_mode,
        "project_candidates": project_candidates[:20],
        "payload_aspect": payload.get("aspect_ratio") or payload.get("aspectRatio") or payload.get("output_format") or payload.get("outputFormat"),
    }


def _assembly_probe_video_size_v200p(path: Path) -> tuple[int, int]:
    """Return first video stream width/height using ffprobe; safe fallback to (0,0)."""
    try:
        import json as _json
        import subprocess as _subprocess
        cmd = [
            "ffprobe", "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height",
            "-of", "json",
            str(path),
        ]
        proc = _subprocess.run(cmd, capture_output=True, text=True, check=False)
        data = _json.loads(proc.stdout or "{}")
        streams = data.get("streams") or []
        if not streams:
            return 0, 0
        w = int(streams[0].get("width") or 0)
        h = int(streams[0].get("height") or 0)
        return w, h
    except Exception:
        return 0, 0

def _assembly_probe_video_size_v200p(path: Path) -> tuple[int, int]:
    """Return first video stream width/height using ffprobe; safe fallback to (0,0)."""
    try:
        import json as _json
        import subprocess as _subprocess
        cmd = [
            "ffprobe", "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height",
            "-of", "json",
            str(path),
        ]
        proc = _subprocess.run(cmd, capture_output=True, text=True, check=False)
        data = _json.loads(proc.stdout or "{}")
        streams = data.get("streams") or []
        if not streams:
            return 0, 0
        w = int(streams[0].get("width") or 0)
        h = int(streams[0].get("height") or 0)
        return w, h
    except Exception:
        return 0, 0



# AVA_BOARD_ASSEMBLY_VIDEO_TRIM_V201A:
# Backend safety: only payload items explicitly allowed by the frontend can trim, and never Timing/audio-driven scenes.
def _assembly_item_audio_driven_trim_locked_v201a(item: dict[str, Any]) -> bool:
    route = str(
        item.get("route")
        or item.get("planned_route")
        or item.get("plannedRoute")
        or item.get("model_route")
        or item.get("modelRoute")
        or ""
    ).strip().lower()
    # V201B: block trim only for ia2v/lip-sync/instrumental/explicit audio-slice clips.
    # Other clips may contain embedded audio; Assembly trims the video asset as a single ready clip.
    if (
        "ia2v" in route
        or "lip" in route
        or "sync" in route
        or "instrument" in route
    ):
        return True
    return bool(
        _assembly_bool(item.get("lip_sync_required") or item.get("lipSyncRequired"))
        or item.get("audio_slice_asset_id")
        or item.get("audioSliceAssetId")
        or item.get("audio_slice_api_path")
        or item.get("audioSliceApiPath")
        or item.get("manual_lipsync_audio_asset_id")
        or item.get("manualLipSyncAudioAssetId")
        or item.get("manual_lipsync_audio_api_path")
        or item.get("manualLipSyncAudioApiPath")
    )


def _assembly_item_video_trim_v201a(item: dict[str, Any]) -> dict[str, float] | None:
    if not isinstance(item, dict):
        return None
    enabled = _assembly_bool(item.get("assembly_video_trim_enabled") or item.get("assemblyVideoTrimEnabled"))
    allowed = _assembly_bool(item.get("assembly_video_trim_allowed") or item.get("assemblyVideoTrimAllowed"))
    timing_locked = _assembly_bool(item.get("assembly_timing_locked") or item.get("assemblyTimingLocked") or item.get("timingLocked") or item.get("timing_locked"))
    audio_locked = _assembly_bool(item.get("assembly_audio_driven_trim_locked") or item.get("assemblyAudioDrivenTrimLocked")) or _assembly_item_audio_driven_trim_locked_v201a(item)
    if not enabled or not allowed or timing_locked or audio_locked:
        return None

    start = _assembly_float(item.get("assembly_video_trim_start_sec") or item.get("assemblyVideoTrimStartSec"), 0.0)
    end = _assembly_float(item.get("assembly_video_trim_end_sec") or item.get("assemblyVideoTrimEndSec"), 0.0)
    duration = _assembly_float(item.get("assembly_video_trim_duration_sec") or item.get("assemblyVideoTrimDurationSec"), 0.0)
    if end > start:
        duration = end - start
    if start < 0 or duration < 0.05:
        return None
    return {
        "startSec": round(float(start), 6),
        "durationSec": round(float(duration), 6),
        "endSec": round(float(start + duration), 6),
    }


def _assembly_extract_video_trim_v201a(source_path: Path, out_path: Path, trim: dict[str, float], *, job_id: str, scene_id: str) -> Path:
    start = max(0.0, float(trim.get("startSec") or 0.0))
    duration = max(0.05, float(trim.get("durationSec") or 0.0))
    print("[BOARD ASSEMBLY VIDEO TRIM V201A]", {
        "job_id": job_id,
        "scene_id": scene_id,
        "source": str(source_path),
        "out": str(out_path),
        "startSec": round(start, 6),
        "durationSec": round(duration, 6),
    }, flush=True)
    _run_ffmpeg([
        "-y",
        "-i", str(source_path),
        "-ss", f"{start:.6f}",
        "-t", f"{duration:.6f}",
        "-map", "0:v:0",
        "-map", "0:a?",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-ar", "48000",
        "-ac", "2",
        "-movflags", "+faststart",
        str(out_path),
    ])
    return out_path



# AVA_BOARD_ASSEMBLY_VIDEO_TRIM_V201B:
# Server-side authority merge for two-sided Assembly video trim.
# Reason: Montage can restore a stale board_assembly snapshot; the current Board snapshot is the source of trim UI values.
def _assembly_item_scene_id_v201b(item: dict[str, Any]) -> str:
    if not isinstance(item, dict):
        return ""
    return str(item.get("scene_id") or item.get("sceneId") or item.get("id") or item.get("scene_id_text") or "").strip()


def _assembly_board_timing_locked_v201b(board_data: dict[str, Any]) -> bool:
    if not isinstance(board_data, dict):
        return False
    source = str(board_data.get("source") or board_data.get("boardSource") or board_data.get("importedFrom") or board_data.get("source_kind") or board_data.get("sourceKind") or "").lower()
    if board_data.get("boardTimingLocked") is True or board_data.get("timingLocked") is True or board_data.get("manualTimingLocked") is True:
        return True
    if "manual_timing" in source or "timing_to_board" in source or source == "timing":
        return True
    return False


def _assembly_scene_timing_locked_v201b(scene: dict[str, Any]) -> bool:
    if not isinstance(scene, dict):
        return False
    source = str(scene.get("source") or scene.get("importedFrom") or scene.get("durationSource") or scene.get("duration_source") or "").lower()
    if scene.get("timingLocked") is True or scene.get("timing_locked") is True:
        return True
    if source in {"timing", "manual_timing"} or "manual_timing" in source or "timing_to_board" in source:
        return True
    if isinstance(scene.get("source_phrase_ids"), list) and scene.get("source_phrase_ids"):
        return True
    if isinstance(scene.get("sourcePhraseIds"), list) and scene.get("sourcePhraseIds"):
        return True
    return False


def _assembly_scene_trim_payload_from_board_v201b(board_data: dict[str, Any], scene: dict[str, Any]) -> dict[str, Any] | None:
    if not isinstance(scene, dict) or _assembly_board_timing_locked_v201b(board_data) or _assembly_scene_timing_locked_v201b(scene):
        return None
    if not _assembly_bool(scene.get("assemblyVideoTrimEnabled") or scene.get("assembly_video_trim_enabled")):
        return None
    # Keep the original safety rule: never trim ia2v / lip-sync / instrumental / explicit audio-slice scenes.
    if _assembly_item_audio_driven_trim_locked_v201a(scene):
        return None

    source_duration = _assembly_float(
        scene.get("assemblyVideoDurationSec")
        or scene.get("assembly_video_duration_sec")
        or scene.get("videoDurationSec")
        or scene.get("video_duration_sec"),
        0.0,
    )
    start = _assembly_float(scene.get("assemblyVideoTrimStartSec") or scene.get("assembly_video_trim_start_sec"), 0.0)
    end = _assembly_float(scene.get("assemblyVideoTrimEndSec") or scene.get("assembly_video_trim_end_sec"), 0.0)
    if source_duration > 0:
        start = max(0.0, min(source_duration, start))
        end = max(0.0, min(source_duration, end if end > 0 else source_duration))
    duration = end - start if end > start else _assembly_float(scene.get("assemblyVideoTrimDurationSec") or scene.get("assembly_video_trim_duration_sec"), 0.0)
    if start < 0 or duration < 0.05:
        return None
    return {
        "assembly_video_trim_allowed": True,
        "assemblyVideoTrimAllowed": True,
        "assembly_video_trim_enabled": True,
        "assemblyVideoTrimEnabled": True,
        "assembly_video_trim_start_sec": round(float(start), 6),
        "assemblyVideoTrimStartSec": round(float(start), 6),
        "assembly_video_trim_end_sec": round(float(start + duration), 6),
        "assemblyVideoTrimEndSec": round(float(start + duration), 6),
        "assembly_video_trim_duration_sec": round(float(duration), 6),
        "assemblyVideoTrimDurationSec": round(float(duration), 6),
        "assembly_video_source_duration_sec": round(float(source_duration), 6) if source_duration > 0 else 0,
        "assemblyVideoSourceDurationSec": round(float(source_duration), 6) if source_duration > 0 else 0,
        "assembly_timing_locked": False,
        "assemblyTimingLocked": False,
        "assembly_audio_driven_trim_locked": False,
        "assemblyAudioDrivenTrimLocked": False,
    }


def _assembly_payload_merge_board_video_trims_v201b(payload_data: dict[str, Any], project_id: str) -> dict[str, Any]:
    if not isinstance(payload_data, dict) or not project_id:
        return payload_data
    raw_items = payload_data.get("items") or payload_data.get("sceneItems") or []
    if not isinstance(raw_items, list) or not raw_items:
        return payload_data
    try:
        board_data = _board_batch_read_snapshot(project_id)
    except Exception as exc:
        print("[BOARD ASSEMBLY VIDEO TRIM MERGE V201B ERROR]", {"project_id": project_id, "error": str(exc)}, flush=True)
        return payload_data
    if not isinstance(board_data, dict) or _assembly_board_timing_locked_v201b(board_data):
        return payload_data

    scene_map: dict[str, dict[str, Any]] = {}
    for scene in board_data.get("scenes") or []:
        if not isinstance(scene, dict):
            continue
        sid = _assembly_item_scene_id_v201b(scene)
        trim_payload = _assembly_scene_trim_payload_from_board_v201b(board_data, scene)
        if sid and trim_payload:
            scene_map[sid] = trim_payload
    if not scene_map:
        return payload_data

    next_payload = copy.deepcopy(payload_data)
    items = next_payload.get("items") or next_payload.get("sceneItems") or []
    if not isinstance(items, list):
        return payload_data

    trimmed_scene_ids: list[str] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        sid = _assembly_item_scene_id_v201b(item)
        trim_payload = scene_map.get(sid)
        if not trim_payload:
            continue
        item.update(trim_payload)
        item["duration_sec"] = trim_payload["assembly_video_trim_duration_sec"]
        item["durationSec"] = trim_payload["assemblyVideoTrimDurationSec"]
        trimmed_scene_ids.append(sid)

    if not trimmed_scene_ids:
        return payload_data

    # Free/manual Board timeline: after trim, scenes must close the gaps and become sequential.
    # Timing-imported projects are skipped above, so this cannot break Manual Timing sync.
    sorted_items = sorted(
        [(idx, item) for idx, item in enumerate(items) if isinstance(item, dict)],
        key=lambda pair: (_assembly_float(pair[1].get("start_sec") or pair[1].get("startSec") or pair[1].get("start"), float(pair[0])), pair[0]),
    )
    cursor = 0.0
    for _, item in sorted_items:
        duration = _assembly_float(item.get("duration_sec") or item.get("durationSec"), 0.0)
        if duration <= 0:
            start0 = _assembly_float(item.get("start_sec") or item.get("startSec") or item.get("start"), 0.0)
            end0 = _assembly_float(item.get("end_sec") or item.get("endSec") or item.get("end"), 0.0)
            duration = max(0.05, end0 - start0)
        item["start_sec"] = round(cursor, 6)
        item["startSec"] = round(cursor, 6)
        item["start"] = round(cursor, 6)
        cursor += duration
        item["end_sec"] = round(cursor, 6)
        item["endSec"] = round(cursor, 6)
        item["end"] = round(cursor, 6)

    next_payload["items"] = items
    next_payload["sceneItems"] = items
    next_payload["duration_sec"] = round(cursor, 6)
    next_payload["durationSec"] = round(cursor, 6)
    next_payload["timeline_duration_sec"] = round(cursor, 6)
    next_payload["timelineDurationSec"] = round(cursor, 6)
    print("[BOARD ASSEMBLY VIDEO TRIM PAYLOAD MERGE V201B]", {
        "project_id": project_id,
        "trimmedSceneIds": trimmed_scene_ids,
        "count": len(trimmed_scene_ids),
        "timelineDurationSec": round(cursor, 6),
    }, flush=True)
    return next_payload

def _run_board_assembly_job(job_id: str) -> None:
    job = BOARD_ASSEMBLY_JOBS.get(job_id)
    if not job:
        return

    payload = job.get("payload") or {}
    try:
        job["status"] = "running"
        job["updatedAt"] = datetime.utcnow().isoformat() + "Z"

        raw_items = payload.get("items") or payload.get("sceneItems") or []
        if not isinstance(raw_items, list):
            raise HTTPException(status_code=400, detail="items_must_be_list")

        skip_missing = bool(payload.get("skip_missing") or payload.get("skipMissing"))
        audio_mode = str(payload.get("audio_mode") or payload.get("audioMode") or "scene_only")
        volumes = payload.get("volumes") if isinstance(payload.get("volumes"), dict) else {}
        scene_volume = _assembly_float(volumes.get("scene"), 1.0)
        original_volume = _assembly_float(volumes.get("original"), 1.0)
        music_volume = _assembly_float(volumes.get("music"), 1.0)
        original_audio_path = _assembly_original_audio_path(payload)
        if not original_audio_path:
            original_audio_path = _assembly_project_original_audio_path_v200r(payload, job_id=job_id)
        music_audio_path = _assembly_music_audio_path(payload)
        music_payload = payload.get("music") if isinstance(payload.get("music"), dict) else {}
        music_loop = bool(music_payload.get("loop", True))
        music_fade_out = bool(music_payload.get("fade_out", True))
        wants_original_audio = audio_mode in {"original_only", "original_plus_scene", "original_plus_music_scene", "original_plus_music"}
        wants_music_audio = audio_mode in {"music_plus_scene", "original_plus_music_scene", "original_plus_music"}
        transition_debug_v134e = _assembly_transition_debug_v134e(payload, audio_mode, original_audio_path, job_id)

        output_lock_v200p = _assembly_output_format_lock_v200p(payload, raw_items, 1280, 720)
        width = int(output_lock_v200p["width"])
        height = int(output_lock_v200p["height"])
        fps = _assembly_int(payload.get("fps"), 30)
        fit_mode = str(output_lock_v200p["fit_mode"] or "contain").strip().lower()
        _log_board_assembly("[BOARD ASSEMBLY OUTPUT SPEC LOCK V200P]", {
            "job_id": job_id,
            "width": width,
            "height": height,
            "fps": fps,
            "fit_mode": fit_mode,
            "aspect_ratio": output_lock_v200p.get("aspect_ratio"),
            "payload_aspect": output_lock_v200p.get("payload_aspect"),
            "project_id": payload.get("project_id") or payload.get("projectId"),
        })
        work_dir = Path(tempfile.gettempdir()) / f"ava_board_assembly_{job_id}"
        work_dir.mkdir(parents=True, exist_ok=True)

        normalized_paths: list[Path] = []
        prepared_items: list[dict[str, Any]] = []
        missing_items: list[dict[str, Any]] = []

        timeline_items: list[tuple[float, int, dict[str, Any]]] = []
        for index, item in enumerate(raw_items):
            if isinstance(item, dict):
                timeline_items.append((
                    _assembly_float(item.get("start_sec") or item.get("startSec") or item.get("start"), float(index)),
                    index,
                    item,
                ))
        timeline_items.sort(key=lambda value: (value[0], value[1]))

        timeline_cursor = 0.0
        for sequence_index, (target_start, index, item) in enumerate(timeline_items):
            scene_id = str(item.get("scene_id") or item.get("sceneId") or item.get("id") or f"scene_{index + 1}")
            duration = _assembly_float(item.get("duration_sec") or item.get("durationSec"), 0.0)
            if duration <= 0:
                end_sec = _assembly_float(item.get("end_sec") or item.get("endSec") or item.get("end"), 0.0)
                duration = max(0.1, end_sec - max(0.0, target_start))

            # AVA_BOARD_ASSEMBLY_SKIP_MISSING_BACKEND_COMPACT_V202B:
            # In skip-missing mode, ready clips are assembled back-to-back; do not
            # create black timeline gaps from original Board start times.
            if (not skip_missing) and target_start > timeline_cursor + 0.025:
                gap_duration = target_start - timeline_cursor
                gap_path = work_dir / f"{sequence_index + 1:04d}_gap_{timeline_cursor:.3f}_{target_start:.3f}.mp4"
                gap_prepared = _create_black_assembly_clip(
                    gap_path,
                    width=width,
                    height=height,
                    fps=fps,
                    duration=gap_duration,
                    audio_volume=0.0,
                )
                gap_prepared.update({
                    "sceneId": f"gap_before_{scene_id}",
                    "index": index,
                    "title": "timeline gap",
                    "route": "black_gap",
                    "targetStartSec": timeline_cursor,
                    "targetEndSec": target_start,
                    "missingVideo": True,
                })
                normalized_paths.append(gap_path)
                prepared_items.append(gap_prepared)
                timeline_cursor = target_start

            is_placeholder_item = _assembly_item_is_placeholder(item)
            video_value = _assembly_item_video_value(item)
            if skip_missing and (is_placeholder_item or not video_value):
                missing_items.append({"sceneId": scene_id, "reason": "skipped_missing_video_v202b", "skipped": True})
                _log_board_assembly("[BOARD ASSEMBLY SKIP MISSING V202B]", {
                    "scene_id": scene_id,
                    "placeholder": is_placeholder_item,
                    "has_video_url": bool(video_value),
                    "original_start_sec": target_start,
                    "duration_sec": duration,
                })
                continue
            if skip_missing:
                target_start = timeline_cursor

            _log_board_assembly("[BOARD ASSEMBLY ITEM]", {
                "scene_id": scene_id,
                "placeholder": is_placeholder_item,
                "missing_video": _assembly_bool(item.get("missing_video") or item.get("missingVideo")),
                "has_video_url": bool(video_value),
                "start_sec": target_start,
                "duration_sec": duration,
            })

            if is_placeholder_item:
                missing_items.append({"sceneId": scene_id, "reason": "missing_video_url"})
                _log_board_assembly("[BOARD ASSEMBLY PLACEHOLDER ACCEPTED]", {
                    "scene_id": scene_id,
                    "start_sec": target_start,
                    "duration_sec": duration,
                })
                normalized_path = work_dir / f"{index + 1:04d}_{_safe_name(scene_id, 'scene')}_black.mp4"
                prepared = _create_black_assembly_clip(
                    normalized_path,
                    width=width,
                    height=height,
                    fps=fps,
                    duration=duration,
                    audio_volume=0.0,
                )
                prepared.update({
                    "sceneId": scene_id,
                    "index": index,
                    "title": item.get("title") or scene_id,
                    "route": item.get("route") or "black_placeholder",
                    "targetStartSec": target_start,
                    "targetEndSec": target_start + duration,
                    "missingVideo": True,
                })
                normalized_paths.append(normalized_path)
                prepared_items.append(prepared)
                timeline_cursor = max(timeline_cursor, target_start + duration)
                continue

            if not video_value:
                missing_items.append({"sceneId": scene_id, "reason": "missing_video_url"})
                if _assembly_item_claims_video(item):
                    raise HTTPException(status_code=400, detail={"code": "scene_missing_video", "sceneId": scene_id})
                _log_board_assembly("[BOARD ASSEMBLY PLACEHOLDER ACCEPTED]", {
                    "scene_id": scene_id,
                    "start_sec": target_start,
                    "duration_sec": duration,
                })
                normalized_path = work_dir / f"{index + 1:04d}_{_safe_name(scene_id, 'scene')}_black.mp4"
                prepared = _create_black_assembly_clip(
                    normalized_path,
                    width=width,
                    height=height,
                    fps=fps,
                    duration=duration,
                    audio_volume=0.0,
                )
                prepared.update({
                    "sceneId": scene_id,
                    "index": index,
                    "title": item.get("title") or scene_id,
                    "route": item.get("route") or "black_placeholder",
                    "targetStartSec": target_start,
                    "targetEndSec": target_start + duration,
                    "missingVideo": True,
                })
                normalized_paths.append(normalized_path)
                prepared_items.append(prepared)
                timeline_cursor = max(timeline_cursor, target_start + duration)
                continue

            _log_board_assembly("[BOARD ASSEMBLY VIDEO ITEM]", {
                "scene_id": scene_id,
                "video_url": video_value,
                "start_sec": target_start,
                "duration_sec": duration,
            })

            try:
                source_path = _resolve_local_file(video_value)
            except HTTPException as exc:
                missing_items.append({"sceneId": scene_id, "reason": "file_not_found", "video": video_value})
                if _assembly_item_claims_video(item):
                    raise HTTPException(status_code=400, detail={
                        "code": "scene_missing_video",
                        "sceneId": scene_id,
                        "reason": "file_not_found",
                        "video": video_value,
                    })
                raise

            trim_v201a = _assembly_item_video_trim_v201a(item)
            source_for_normalize_v201a = source_path
            if trim_v201a:
                trim_path_v201a = work_dir / f"{index + 1:04d}_{_safe_name(scene_id, 'scene')}_trim_v201a.mp4"
                source_for_normalize_v201a = _assembly_extract_video_trim_v201a(
                    source_path,
                    trim_path_v201a,
                    trim_v201a,
                    job_id=job_id,
                    scene_id=scene_id,
                )
                duration = max(0.05, float(trim_v201a.get("durationSec") or duration or 0.1))

            normalized_path = work_dir / f"{index + 1:04d}_{_safe_name(scene_id, 'scene')}.mp4"
            prepared = _normalize_assembly_clip(
                source_for_normalize_v201a,
                normalized_path,
                width=width,
                height=height,
                fps=fps,
                fallback_duration=duration,
                audio_volume=_assembly_scene_audio_volume_for_item(item, audio_mode, scene_volume),
                fit_mode=fit_mode,
            )
            if trim_v201a:
                prepared["assemblyVideoTrimV201A"] = trim_v201a
                prepared["sourceTrimStartSecV201A"] = trim_v201a.get("startSec")
                prepared["sourceTrimDurationSecV201A"] = trim_v201a.get("durationSec")
            prepared.update({
                "sceneId": scene_id,
                "index": index,
                "title": item.get("title") or scene_id,
                "route": item.get("route") or "",
                "targetStartSec": target_start,
                "targetEndSec": target_start + duration,
                "missingVideo": False,
            })
            normalized_paths.append(normalized_path)
            prepared_items.append(prepared)
            timeline_cursor = max(timeline_cursor, target_start + duration)

        original_audio_duration = _ffprobe_duration(original_audio_path) if original_audio_path else 0.0
        payload_duration = _assembly_float(payload.get("duration_sec") or payload.get("durationSec") or payload.get("timeline_duration_sec") or payload.get("timelineDurationSec"), 0.0)
        # AVA_BOARD_ASSEMBLY_SKIP_MISSING_BACKEND_COMPACT_V202B:
        # Skip-missing output should not be stretched to full original audio length.
        # Frontend sends compact timeline_duration_sec; backend uses it as authority.
        target_timeline_duration = max(timeline_cursor, (0.0 if skip_missing else original_audio_duration), payload_duration)
        if target_timeline_duration > timeline_cursor + 0.025:
            tail_path = work_dir / f"9999_trailing_black_{timeline_cursor:.3f}_{target_timeline_duration:.3f}.mp4"
            tail_prepared = _create_black_assembly_clip(
                tail_path,
                width=width,
                height=height,
                fps=fps,
                duration=target_timeline_duration - timeline_cursor,
                audio_volume=0.0,
            )
            tail_prepared.update({
                "sceneId": "trailing_black",
                "index": len(timeline_items),
                "title": "trailing black",
                "route": "black_gap",
                "targetStartSec": timeline_cursor,
                "targetEndSec": target_timeline_duration,
                "missingVideo": True,
            })
            normalized_paths.append(tail_path)
            prepared_items.append(tail_prepared)
            timeline_cursor = target_timeline_duration

        if not normalized_paths:
            raise HTTPException(status_code=400, detail={"code": "no_ready_videos_for_assembly", "missing": missing_items})

        concat_file = work_dir / "concat.txt"
        _write_concat_file(normalized_paths, concat_file)

        target_dir = _settings_static_path() / "assets" / "board_assembly"
        target_dir.mkdir(parents=True, exist_ok=True)
        scene_concat_path = work_dir / f"{job_id}_scene_concat.mp4"
        if wants_original_audio and original_audio_path and wants_music_audio and music_audio_path:
            suffix = "original_music" if audio_mode == "original_plus_music" else "original_music_scene"
        elif wants_music_audio and music_audio_path:
            suffix = "music_only" if audio_mode == "original_plus_music" else "music_scene"
        elif wants_original_audio and original_audio_path:
            suffix = "original_audio"
        else:
            suffix = "scene_audio_draft"
        out_path = target_dir / f"{job_id}_{suffix}.mp4"

        # V199W: force strict visual timeline for every Board Assembly export.
        # V199V was too narrow: it only ran for audio_mode == "original_only".
        # Current mixed i2v/ia2v projects may still have master/original audio but a different
        # audio_mode flag, so the strict timeline was skipped and drift remained.
        strict_timeline_result_v199v = {"applied": False, "reason": "no_normalized_paths_v199w"}
        if normalized_paths:
            print("[BOARD ASSEMBLY STRICT BOARD TIMELINE FORCE V199W]", {
                "job_id": job_id,
                "audio_mode": audio_mode,
                "wants_original_audio": bool(wants_original_audio),
                "has_original_audio_path": bool(original_audio_path),
                "items": len(normalized_paths),
            })
            strict_timeline_result_v199v = _render_board_absolute_frame_timeline_concat_v199ab(
                normalized_paths,
                prepared_items,
                scene_concat_path,
                width=width,
                height=height,
                fps=fps,
                job_id=job_id,
            )
        else:
            _run_ffmpeg([
                "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", str(concat_file),
                "-c", "copy",
                str(scene_concat_path),
            ])

        # AVA_ASSEMBLY_SKIP_LEGACY_SILENT_XFADE_V140A:
        # There are two transition engines in this file. The older V134D engine renders
        # nice visual xfade but writes a silent audio stream. When music+scene mode is
        # enabled, the later mixer uses scene_concat_path audio as [scenea]; if V134D
        # already replaced scene_concat_path, scenes become silent and only music remains.
        # Prefer the newer V134F/V134G path because V134H preserves timing-mode scene audio.
        transition_request_v134f = _assembly_transition_request_v134f(payload, original_audio_path, job_id)
        # V196E: user can choose the visual transition style for timing-preserve mode.
        # fade_to_black keeps the proven V196C behavior; xfade uses freeze handles to avoid moving lip-sync words.
        try:
            transition_visual_mode_v196e = _assembly_transition_visual_mode_v196e(payload)
            lipsync_routes_v196e = {"ia2v", "ia2v_lipsync", "lip_sync", "lipsync", "vocal"}
            has_lipsync_route_v196e = any(
                isinstance(raw_item_v196e, dict)
                and (
                    str(raw_item_v196e.get("route") or raw_item_v196e.get("planned_route") or raw_item_v196e.get("model_route") or "").strip().lower() in lipsync_routes_v196e
                    or _assembly_bool(raw_item_v196e.get("lip_sync_required") or raw_item_v196e.get("lipSyncRequired"))
                    or _assembly_bool(raw_item_v196e.get("contains_vocal") or raw_item_v196e.get("containsVocal"))
                )
                for raw_item_v196e in raw_items
            )
            if original_audio_path and has_lipsync_route_v196e and transition_request_v134f.get("requested"):
                transition_request_v134f = {
                    **transition_request_v134f,
                    "allowed": True,
                    "preserveTiming": True,
                    "transitionVisualModeV196E": transition_visual_mode_v196e,
                    "freezeHandleXfadeForLipSyncV196E": transition_visual_mode_v196e == "xfade",
                    "freezeHandleXfadeForLipSyncV196D": transition_visual_mode_v196e == "xfade",
                    "safeFadeForLipSyncV196C": transition_visual_mode_v196e != "xfade",
                    "reason": f"{transition_visual_mode_v196e}_for_lipsync_master_audio_v196e",
                }
                print("[BOARD ASSEMBLY TRANSITION VISUAL MODE SELECTED V196E]", {
                    "job_id": job_id,
                    "visualMode": transition_visual_mode_v196e,
                    "hasOriginalAudio": bool(original_audio_path),
                    "hasLipSyncRoute": bool(has_lipsync_route_v196e),
                    "requestedDurationSec": transition_request_v134f.get("durationSec"),
                }, flush=True)
        except Exception as exc:
            print("[BOARD ASSEMBLY TRANSITION VISUAL MODE CHECK ERROR V196E]", {"job_id": job_id, "error": str(exc)}, flush=True)
        transition_result_v134f = dict(transition_request_v134f)
        transition_config_v134d = _assembly_transition_config_v134d(payload, audio_mode, original_audio_path)
        if transition_request_v134f.get("requested"):
            transition_config_v134d = {
                **transition_config_v134d,
                "allowed": False,
                "reason": "skipped_for_audio_safe_v134f_v140a",
                "skippedForV134F": True,
            }
        transition_result_v134d = dict(transition_config_v134d)
        if transition_config_v134d.get("allowed"):
            transition_tmp_v134d = scene_concat_path.with_name(scene_concat_path.stem + "_xfade_v134d.mp4")
            try:
                transition_result_v134d = _render_assembly_visual_xfade_v134d(
                    normalized_paths,
                    transition_tmp_v134d,
                    float(transition_config_v134d.get("durationSec") or 0.5),
                )
                if transition_result_v134d.get("applied") and transition_tmp_v134d.exists():
                    shutil.copy2(transition_tmp_v134d, scene_concat_path)
                    print("[BOARD ASSEMBLY XFADE APPLIED V134D]", {
                        "job_id": job_id,
                        "durationSec": transition_result_v134d.get("durationSec"),
                        "items": len(normalized_paths),
                    })
            except Exception as exc:
                transition_result_v134d = {"applied": False, "reason": f"xfade_failed: {exc}"}
                print("[BOARD ASSEMBLY XFADE SKIPPED V134D]", {
                    "job_id": job_id,
                    "reason": str(exc),
                })
            finally:
                try:
                    transition_tmp_v134d.unlink(missing_ok=True)
                except Exception:
                    pass

        scene_concat_duration = _ffprobe_duration(scene_concat_path) or 0.0

        if transition_request_v134f.get("allowed"):
            try:
                if transition_request_v134f.get("preserveTiming"):
                    if transition_request_v134f.get("freezeHandleXfadeForLipSyncV196E"):
                        if "_assembly_apply_visual_freeze_handle_xfade_v196d" in globals():
                            transition_result_v134f = _assembly_apply_visual_freeze_handle_xfade_v196d(
                                normalized_paths,
                                scene_concat_path,
                                float(transition_request_v134f.get("durationSec") or 0.5),
                                job_id,
                            )
                        else:
                            transition_result_v134f = _assembly_apply_visual_freeze_handle_xfade_v196e(
                                normalized_paths,
                                scene_concat_path,
                                float(transition_request_v134f.get("durationSec") or 0.5),
                                job_id,
                            )
                    elif transition_request_v134f.get("safeFadeForLipSyncV196C"):
                        transition_result_v134f = _assembly_apply_visual_safe_fades_v196c(
                            normalized_paths,
                            scene_concat_path,
                            float(transition_request_v134f.get("durationSec") or 0.5),
                            job_id,
                        )
                    else:
                        transition_result_v134f = _assembly_apply_visual_xfade_preserve_timing_v134g(
                            normalized_paths,
                            scene_concat_path,
                            float(transition_request_v134f.get("durationSec") or 0.5),
                            job_id,
                        )
                else:
                    transition_result_v134f = _assembly_apply_visual_xfade_v134f(
                        normalized_paths,
                        scene_concat_path,
                        float(transition_request_v134f.get("durationSec") or 0.5),
                        job_id,
                    )
                scene_concat_duration = _ffprobe_duration(scene_concat_path) or scene_concat_duration
            except Exception as exc:
                transition_result_v134f = {"applied": False, "reason": f"xfade_failed: {exc}"}
                print("[BOARD ASSEMBLY XFADE SKIPPED V134F]", {"job_id": job_id, "reason": str(exc)})

        use_original_audio = wants_original_audio and bool(original_audio_path)
        use_music_audio = wants_music_audio and bool(music_audio_path)

        if audio_mode == "original_only" and use_original_audio:
            _run_ffmpeg([
                "-y",
                "-i", str(scene_concat_path),
                "-i", str(original_audio_path),
                "-map", "0:v:0",
                "-map", "1:a:0",
                "-c:v", "copy",
                "-c:a", "aac",
                "-b:a", "192k",
                "-af", f"volume={max(0.0, float(original_volume)):.4f}",
                "-shortest",
                str(out_path),
            ])
        elif use_original_audio or use_music_audio:
            mix_args = ["-y", "-i", str(scene_concat_path)]
            input_index = 1
            original_index = None
            music_index = None

            if use_original_audio:
                original_index = input_index
                mix_args.extend(["-i", str(original_audio_path)])
                input_index += 1

            if use_music_audio:
                music_index = input_index
                if music_loop:
                    mix_args.extend(["-stream_loop", "-1"])
                mix_args.extend(["-i", str(music_audio_path)])
                input_index += 1

            filters = ["[0:a]anull[scenea]"]
            labels = ["[scenea]"]

            if original_index is not None:
                filters.append(f"[{original_index}:a]volume={max(0.0, float(original_volume)):.4f}[origina]")
                labels.append("[origina]")

            if music_index is not None:
                music_filter = f"[{music_index}:a]volume={max(0.0, float(music_volume)):.4f}"
                if music_fade_out and scene_concat_duration > 1.0:
                    fade_start = max(0.0, scene_concat_duration - 2.0)
                    music_filter += f",afade=t=out:st={fade_start:.3f}:d=2.000"
                filters.append(music_filter + "[musica]")
                labels.append("[musica]")

            filter_complex = ";".join(filters) + ";" + "".join(labels) + f"amix=inputs={len(labels)}:duration=first:dropout_transition=0[aout]"

            _run_ffmpeg([
                *mix_args,
                "-filter_complex", filter_complex,
                "-map", "0:v:0",
                "-map", "[aout]",
                "-c:v", "copy",
                "-c:a", "aac",
                "-b:a", "192k",
                "-shortest",
                str(out_path),
            ])
        else:
            shutil.copy2(scene_concat_path, out_path)

        # Stage 6.9J force watermark burn-in before public URL
        watermark_payload = payload.get("watermark") if isinstance(payload.get("watermark"), dict) else {}
        watermark_text = str(watermark_payload.get("text") or "").strip()
        watermark_requested = bool(watermark_payload.get("enabled")) and bool(watermark_text)
        watermark_applied = False
        watermark_error = ""

        if watermark_requested:
            watermarked_path = work_dir / f"{job_id}_watermarked_final.mp4"
            try:
                _apply_assembly_watermark(out_path, watermarked_path, watermark_payload)
                if watermarked_path.exists() and watermarked_path.stat().st_size > 0:
                    shutil.copy2(watermarked_path, out_path)
                    watermark_applied = True
                else:
                    watermark_error = "watermarked_output_missing"
                    raise RuntimeError(watermark_error)
            except Exception as exc:
                watermark_error = str(exc)
                raise HTTPException(status_code=500, detail={
                    "code": "watermark_failed",
                    "message": watermark_error,
                    "text": watermark_text,
                    "position": watermark_payload.get("position"),
                    "size": watermark_payload.get("size"),
                    "opacity": watermark_payload.get("opacity"),
                })


        # V199X: if V199V/V199W already built the file on the exact Board timeline,
        # do not run the older V196F reencode pass on top of it. V196F was useful
        # for Windows-safe packaging, but after strict timeline it can re-time the
        # already-correct file by a few frames and bring back end-of-song lip drift.
        local_player_safe_result_v196f = {"applied": False, "reason": "not_run"}
        strict_timeline_applied_v199x = bool((locals().get("strict_timeline_result_v199v") or {}).get("applied"))
        if strict_timeline_applied_v199x:
            local_player_safe_result_v196f = {
                "applied": False,
                "reason": "skipped_after_strict_board_timeline_v199x",
                "strictTimelineApplied": True,
            }
            print("[BOARD ASSEMBLY LOCAL PLAYER SAFE SKIP V199X]", {
                "job_id": job_id,
                "reason": "strict_board_timeline_already_exact",
                "strict_timeline": locals().get("strict_timeline_result_v199v") or {},
            }, flush=True)
        else:
            try:
                local_player_safe_path_v196f = work_dir / f"{job_id}_local_player_safe_v196f.mp4"
                local_player_safe_result_v196f = _assembly_make_local_player_safe_v196f(
                    out_path,
                    local_player_safe_path_v196f,
                    fps=fps,
                    job_id=job_id,
                )
                if local_player_safe_result_v196f.get("applied") and local_player_safe_path_v196f.exists() and local_player_safe_path_v196f.stat().st_size > 0:
                    shutil.copy2(local_player_safe_path_v196f, out_path)
            except Exception as exc:
                local_player_safe_result_v196f = {"applied": False, "reason": f"failed: {exc}"}
                print("[BOARD ASSEMBLY LOCAL PLAYER SAFE ERROR V196F]", {"job_id": job_id, "error": str(exc)}, flush=True)

        urls = _public_static_url(f"assets/board_assembly/{out_path.name}")
        final_duration = _ffprobe_duration(out_path)

        job.update({
            "status": "completed",
            "assembly_status": "ready",
            "audioMode": audio_mode,
            "supportedAudioMode": "original_music_no_scene_audio" if audio_mode == "original_plus_music" else ("music_original_scene_mix" if ((wants_original_audio and original_audio_path) or (wants_music_audio and music_audio_path)) else "scene_audio_concat_draft"),
            "draftNote": "Original/music mixed; scene audio muted." if audio_mode == "original_plus_music" else ("Music/original/scene audio mixed in." if ((wants_original_audio and original_audio_path) or (wants_music_audio and music_audio_path)) else "No original/music audio found; using scene audio from generated videos."),
            "originalAudioFound": bool(original_audio_path),
            "musicAudioFound": bool(music_audio_path),
            "sceneVolume": scene_volume,
            "originalVolume": original_volume,
            "musicVolume": music_volume,
            "watermarkRequested": watermark_requested,
            "watermarkApplied": watermark_applied,
            "watermarkError": watermark_error,
            "watermarkText": watermark_text if watermark_requested else "",
            "localPlayerSafeV196F": locals().get("local_player_safe_result_v196f") or {},
            "watermark": watermark_payload if watermark_requested else {},
            "transitionRequestedV134F": bool(locals().get("transition_request_v134f", {}).get("requested")),
            "transitionAllowedV134F": bool(locals().get("transition_request_v134f", {}).get("allowed")),
            "transitionAppliedV134F": bool(locals().get("transition_result_v134f", {}).get("applied")),
            "transitionPreserveTimingV134G": bool(locals().get("transition_request_v134f", {}).get("preserveTiming")),
            "transitionDurationSecV134F": float(locals().get("transition_result_v134f", {}).get("durationSec") or locals().get("transition_request_v134f", {}).get("durationSec") or 0.0),
            "transitionReasonV134F": locals().get("transition_result_v134f", {}).get("reason") or locals().get("transition_request_v134f", {}).get("reason") or "",
            "transitionRequested": bool(locals().get("transition_config_v134d", {}).get("requested")),
            "transitionAllowed": bool(locals().get("transition_config_v134d", {}).get("allowed")),
            "transitionApplied": bool(locals().get("transition_result_v134d", {}).get("applied")),
            "transitionDurationSec": float(locals().get("transition_result_v134d", {}).get("durationSec") or locals().get("transition_config_v134d", {}).get("durationSec") or 0.0),
            "transitionMode": locals().get("transition_config_v134d", {}).get("mode") or "background_video_only_v134d",
            "transitionReason": locals().get("transition_result_v134d", {}).get("reason") or locals().get("transition_config_v134d", {}).get("reason") or "",
            "videoUrl": urls["url"],
            "video_url": urls["url"],
            "videoApiPath": urls["apiPath"],
            "video_api_path": urls["apiPath"],
            "videoName": out_path.name,
            "video_name": out_path.name,
            "localPath": str(out_path),
            "durationSec": final_duration,
            "preparedItems": prepared_items,
            "missingItems": missing_items,
            "updatedAt": datetime.utcnow().isoformat() + "Z",
        })
        _ava_credit_charge_assembly_job_if_ready(job)
        try:
            assembly_scene_count_v140b = 0
            if isinstance(raw_items, list):
                assembly_scene_count_v140b = sum(1 for item in raw_items if isinstance(item, dict))
            if assembly_scene_count_v140b <= 0:
                assembly_scene_count_v140b = len([item for item in prepared_items if isinstance(item, dict) and not str(item.get("sceneId") or "").startswith("gap_before_")])
            assembly_notice_result_v140b = telegram_assembly_render_completed(
                project_id=str(job.get("project_id") or job.get("projectId") or payload.get("project_id") or payload.get("projectId") or ""),
                assembly_job_id=job_id,
                output_asset_id=str(job.get("output_asset_id") or job.get("outputAssetId") or ""),
                output_api_path=str(urls.get("apiPath") or urls.get("api_path") or ""),
                output_name=str(out_path.name or ""),
                output_path=str(out_path),
                duration_sec=final_duration,
                scene_count=assembly_scene_count_v140b,
            )
            job.update({
                "telegram_notified": bool(assembly_notice_result_v140b.get("telegram_notified") or assembly_notice_result_v140b.get("telegramNotified") or assembly_notice_result_v140b.get("sent")),
                "telegramNotified": bool(assembly_notice_result_v140b.get("telegram_notified") or assembly_notice_result_v140b.get("telegramNotified") or assembly_notice_result_v140b.get("sent")),
                "telegram_notified_at": assembly_notice_result_v140b.get("telegram_notified_at") or assembly_notice_result_v140b.get("telegramNotifiedAt") or "",
                "telegramNotifiedAt": assembly_notice_result_v140b.get("telegram_notified_at") or assembly_notice_result_v140b.get("telegramNotifiedAt") or "",
                "telegram_notification_key": assembly_notice_result_v140b.get("telegram_notification_key") or assembly_notice_result_v140b.get("telegramNotificationKey") or "",
                "telegramNotificationKey": assembly_notice_result_v140b.get("telegram_notification_key") or assembly_notice_result_v140b.get("telegramNotificationKey") or "",
                "telegramNotificationResultV140B": assembly_notice_result_v140b,
            })
        except Exception as exc:
            print("[ASSEMBLY TELEGRAM NOTICE ERROR V140B]", {"job_id": job_id, "error": str(exc)}, flush=True)
            job.update({
                "telegram_notified": False,
                "telegramNotified": False,
                "telegram_notification_error": str(exc),
                "telegramNotificationError": str(exc),
            })
    except HTTPException as exc:
        job["status"] = "error"
        job["error"] = exc.detail
        job["updatedAt"] = datetime.utcnow().isoformat() + "Z"
    except Exception as exc:
        job["status"] = "error"
        job["error"] = str(exc)
        job["updatedAt"] = datetime.utcnow().isoformat() + "Z"


@router.post("/board-assembly/start")
def start_board_assembly(payload: dict[str, Any], user: dict = Depends(get_current_user)) -> dict[str, Any]:
    payload_data = dict(payload or {})
    job_id = f"assembly_{uuid4().hex[:14]}"
    now = datetime.utcnow().isoformat() + "Z"

    project_id_for_credit = _clean_project_id(payload_data.get("project_id")) or _clean_project_id(payload_data.get("projectId"))
    if project_id_for_credit:
        ensure_project_access(project_id_for_credit, user)
        payload_data = _assembly_payload_merge_board_video_trims_v201b(payload_data, project_id_for_credit)

    raw_items = payload_data.get("items") or payload_data.get("sceneItems") or []
    ready_count = 0
    if isinstance(raw_items, list):
        ready_count = sum(1 for item in raw_items if isinstance(item, dict) and _assembly_item_video_value(item))

    assembly_credit_actions = _ava_credit_assembly_actions_from_payload(payload_data)
    assembly_credit_cost = sum(int(action.get("amount") or 0) for action in assembly_credit_actions)
    _ava_credit_require_balance(user, assembly_credit_cost)

    job = {
        "ok": True,
        "jobId": job_id,
        "job_id": job_id,
        "status": "queued",
        "statusEndpoint": f"/api/board-assembly/status/{job_id}",
        "createdAt": now,
        "updatedAt": now,
        "projectId": project_id_for_credit,
        "project_id": project_id_for_credit,
        "audioMode": payload_data.get("audio_mode") or payload_data.get("audioMode") or "scene_only",
        "readyItemsCount": ready_count,
        "creditCost": assembly_credit_cost,
        "creditBreakdown": assembly_credit_actions,
        "creditCharged": False,
        "creditChargeMode": "preflight_ok_charge_after_success",
        "payload": payload_data,
    }
    _ava_credit_attach_job_user(job, user)
    BOARD_ASSEMBLY_JOBS[job_id] = job

    try:
        import threading
        threading.Thread(target=_run_board_assembly_job, args=(job_id,), daemon=True).start()
    except Exception as exc:
        job["status"] = "error"
        job["error"] = f"thread_start_failed: {exc}"
        job["updatedAt"] = datetime.utcnow().isoformat() + "Z"

    return {
        "ok": True,
        "jobId": job_id,
        "job_id": job_id,
        "status": job["status"],
        "statusEndpoint": job["statusEndpoint"],
        "audioMode": job["audioMode"],
        "readyItemsCount": ready_count,
        "creditCost": job.get("creditCost", 0),
        "creditBreakdown": job.get("creditBreakdown", []),
        "creditCharged": False,
        "jobStored": True,
    }



@router.get("/board-assembly/status/{job_id}")
def board_assembly_status(job_id: str, user: dict = Depends(get_current_user)) -> dict[str, Any]:
    job = BOARD_ASSEMBLY_JOBS.get(job_id)
    if not job:
        return {"ok": False, "status": "not_found", "code": "BOARD_ASSEMBLY_JOB_NOT_FOUND", "jobId": job_id}
    _ava_credit_ensure_job_owner(job, user)
    _ava_credit_charge_assembly_job_if_ready(job)
    return {"ok": True, **job}


# ---------------------------------------------------------------------
# Stage 6.9I — robust watermark burn-in.
# This overrides the older drawtext-only implementation with a PNG overlay.
# Reason: ffmpeg drawtext can silently fail/behave differently on Windows fonts.
# ---------------------------------------------------------------------

def _ava_stage69i_watermark_pos(position: str) -> tuple[str, str]:
    pos = str(position or "top_right").lower()
    if pos == "bottom_left":
        return "10", "main_h-overlay_h-18"
    if pos == "top_right":
        return "main_w-overlay_w-10", "8"
    if pos == "top_left":
        return "10", "8"
    if pos == "bottom_center":
        return "(main_w-overlay_w)/2", "main_h-overlay_h-18"
    if pos == "top_center":
        return "(main_w-overlay_w)/2", "8"
    if pos == "bottom_right":
        return "main_w-overlay_w-10", "main_h-overlay_h-18"
    return "main_w-overlay_w-10", "8"


def _ava_stage69i_font(size: int):
    from PIL import ImageFont

    candidates = [
        Path("C:/Windows/Fonts/arialbd.ttf"),
        Path("C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/segoeuib.ttf"),
        Path("C:/Windows/Fonts/segoeui.ttf"),
    ]

    for path in candidates:
        try:
            if path.exists():
                return ImageFont.truetype(str(path), size=size)
        except Exception:
            pass

    try:
        return ImageFont.truetype("arial.ttf", size=size)
    except Exception:
        return ImageFont.load_default()


def _ava_stage69i_make_watermark_png(text: str, target_path: Path, *, size: int, opacity: float) -> None:
    from PIL import Image, ImageDraw

    safe_text = str(text or "").strip()
    if not safe_text:
        raise ValueError("empty_watermark_text")

    size = max(10, min(120, int(size or 28)))
    alpha = max(12, min(255, int(max(0.05, min(1.0, float(opacity or 0.35))) * 255)))

    font = _ava_stage69i_font(size)
    stroke_width = max(1, int(size / 14))
    pad_x = max(2, int(size * 0.08))
    pad_y = max(2, int(size * 0.04))

    probe = Image.new("RGBA", (4, 4), (0, 0, 0, 0))
    draw = ImageDraw.Draw(probe)
    bbox = draw.textbbox((0, 0), safe_text, font=font, stroke_width=stroke_width)

    width = max(1, bbox[2] - bbox[0] + pad_x * 2)
    height = max(1, bbox[3] - bbox[1] + pad_y * 2)

    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.text(
        (pad_x - bbox[0], pad_y - bbox[1]),
        safe_text,
        font=font,
        fill=(255, 255, 255, alpha),
        stroke_width=stroke_width,
        stroke_fill=(0, 0, 0, min(210, max(90, alpha))),
    )

    target_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(target_path)


def _ava_stage69i_drawtext_fallback(src_path: Path, out_path: Path, watermark: dict) -> None:
    text = _assembly_escape_drawtext(str(watermark.get("text") or "").strip())
    size = _assembly_int(watermark.get("size"), 28)
    opacity = max(0.0, min(1.0, _assembly_float(watermark.get("opacity"), 0.35)))
    x, y = _assembly_watermark_position(str(watermark.get("position") or "top_right"), 10)
    vf = (
        "drawtext="
        f"text='{text}':fontsize={size}:fontcolor=white@{opacity:.3f}:"
        "borderw=2:bordercolor=black@0.520:"
        f"x={x}:y={y}"
    )
    _run_ffmpeg([
        "-y",
        "-i", str(src_path),
        "-vf", vf,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "18",
        "-c:a", "copy",
        "-movflags", "+faststart",
        str(out_path),
    ])


def _apply_assembly_watermark(src_path: Path, out_path: Path, watermark: dict) -> None:
    text = str((watermark or {}).get("text") or "").strip()
    if not text:
        shutil.copy2(src_path, out_path)
        return

    size = _assembly_int((watermark or {}).get("size"), 28)
    opacity = _assembly_float((watermark or {}).get("opacity"), 0.35)
    position = str((watermark or {}).get("position") or "top_right")

    png_path = Path(tempfile.gettempdir()) / f"ava_watermark_{uuid4().hex[:12]}.png"

    try:
        _ava_stage69i_make_watermark_png(text, png_path, size=size, opacity=opacity)
        x, y = _ava_stage69i_watermark_pos(position)
        _run_ffmpeg([
            "-y",
            "-i", str(src_path),
            "-i", str(png_path),
            "-filter_complex", f"[0:v][1:v]overlay={x}:{y}:format=auto[v]",
            "-map", "[v]",
            "-map", "0:a?",
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "18",
            "-c:a", "copy",
            "-movflags", "+faststart",
            str(out_path),
        ])
    except Exception:
        _ava_stage69i_drawtext_fallback(src_path, out_path, watermark)
    finally:
        try:
            png_path.unlink(missing_ok=True)
        except Exception:
            pass


# ---------------------------------------------------------------------
# Stage 6.9M2 — self-contained watermark fallback.
# Appended last on purpose: this _apply_assembly_watermark overrides older
# drawtext/PNG attempts and does not depend on _assembly_escape_drawtext.
# ---------------------------------------------------------------------

def _ava_stage69m2_escape_drawtext(value):
    text = str(value or "").replace("\\", "\\\\")
    text = text.replace("\n", " ").replace("\r", " ")
    text = text.replace(":", "\\:")
    text = text.replace("'", "\\'")
    text = text.replace("%", "\\%")
    text = text.replace("[", "\\[").replace("]", "\\]")
    return text


def _ava_stage69m2_pos_expr(position):
    pos = str(position or "top_right").lower()
    if pos == "bottom_left":
        return "10", "h-th-18"
    if pos == "top_right":
        return "w-tw-10", "8"
    if pos == "top_left":
        return "10", "8"
    if pos == "bottom_center":
        return "(w-tw)/2", "h-th-18"
    if pos == "top_center":
        return "(w-tw)/2", "8"
    if pos == "bottom_right":
        return "w-tw-10", "h-th-18"
    return "w-tw-10", "8"


def _ava_stage69m2_png_pos_expr(position):
    pos = str(position or "top_right").lower()
    if pos == "bottom_left":
        return "10", "main_h-overlay_h-18"
    if pos == "top_right":
        return "main_w-overlay_w-10", "8"
    if pos == "top_left":
        return "10", "8"
    if pos == "bottom_center":
        return "(main_w-overlay_w)/2", "main_h-overlay_h-18"
    if pos == "top_center":
        return "(main_w-overlay_w)/2", "8"
    if pos == "bottom_right":
        return "main_w-overlay_w-10", "main_h-overlay_h-18"
    return "main_w-overlay_w-10", "8"


def _ava_stage69m2_drawtext(src_path, out_path, watermark):
    from pathlib import Path as _Path

    text = _ava_stage69m2_escape_drawtext(str((watermark or {}).get("text") or "").strip())
    if not text:
        shutil.copy2(src_path, out_path)
        return

    size = _assembly_int((watermark or {}).get("size"), 28)
    opacity = max(0.05, min(1.0, _assembly_float((watermark or {}).get("opacity"), 0.35)))
    position = str((watermark or {}).get("position") or "top_right")
    x, y = _ava_stage69m2_pos_expr(position)

    font_arg = ""
    for candidate in [
        _Path("C:/Windows/Fonts/arialbd.ttf"),
        _Path("C:/Windows/Fonts/arial.ttf"),
        _Path("C:/Windows/Fonts/segoeuib.ttf"),
        _Path("C:/Windows/Fonts/segoeui.ttf"),
    ]:
        if candidate.exists():
            font_value = str(candidate).replace("\\", "/").replace(":", "\\:")
            font_arg = f"fontfile='{font_value}':"
            break

    vf = (
        "drawtext="
        f"{font_arg}"
        f"text='{text}':"
        f"fontsize={size}:"
        f"fontcolor=white@{opacity:.3f}:"
        "borderw=2:"
        "bordercolor=black@0.520:"
        f"x={x}:y={y}"
    )

    _run_ffmpeg([
        "-y",
        "-i", str(src_path),
        "-vf", vf,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "18",
        "-c:a", "copy",
        "-movflags", "+faststart",
        str(out_path),
    ])


def _ava_stage69m2_make_png(text, target_path, size=28, opacity=0.35):
    try:
        from pathlib import Path as _Path
        from PIL import Image, ImageDraw, ImageFont
    except Exception:
        return False

    safe_text = str(text or "").strip()
    if not safe_text:
        return False

    size = max(10, min(120, int(size or 28)))
    alpha = max(12, min(255, int(max(0.05, min(1.0, float(opacity or 0.35))) * 255)))

    font = None
    for candidate in [
        _Path("C:/Windows/Fonts/arialbd.ttf"),
        _Path("C:/Windows/Fonts/arial.ttf"),
        _Path("C:/Windows/Fonts/segoeuib.ttf"),
        _Path("C:/Windows/Fonts/segoeui.ttf"),
    ]:
        try:
            if candidate.exists():
                font = ImageFont.truetype(str(candidate), size=size)
                break
        except Exception:
            pass

    if font is None:
        try:
            font = ImageFont.truetype("arial.ttf", size=size)
        except Exception:
            font = ImageFont.load_default()

    stroke_width = max(1, int(size / 14))
    pad_x = max(2, int(size * 0.08))
    pad_y = max(2, int(size * 0.04))

    probe = Image.new("RGBA", (4, 4), (0, 0, 0, 0))
    draw = ImageDraw.Draw(probe)
    bbox = draw.textbbox((0, 0), safe_text, font=font, stroke_width=stroke_width)

    width = max(1, bbox[2] - bbox[0] + pad_x * 2)
    height = max(1, bbox[3] - bbox[1] + pad_y * 2)

    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.text(
        (pad_x - bbox[0], pad_y - bbox[1]),
        safe_text,
        font=font,
        fill=(255, 255, 255, alpha),
        stroke_width=stroke_width,
        stroke_fill=(0, 0, 0, min(220, max(110, alpha))),
    )

    target_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(target_path)
    return True


def _apply_assembly_watermark(src_path, out_path, watermark):
    from pathlib import Path as _Path

    text = str((watermark or {}).get("text") or "").strip()
    if not text:
        shutil.copy2(src_path, out_path)
        return

    size = _assembly_int((watermark or {}).get("size"), 28)
    opacity = _assembly_float((watermark or {}).get("opacity"), 0.35)
    position = str((watermark or {}).get("position") or "top_right")
    png_path = _Path(tempfile.gettempdir()) / f"ava_watermark_{uuid4().hex[:12]}.png"

    last_error = ""
    try:
        if _ava_stage69m2_make_png(text, png_path, size=size, opacity=opacity):
            x, y = _ava_stage69m2_png_pos_expr(position)
            try:
                _run_ffmpeg([
                    "-y",
                    "-i", str(src_path),
                    "-i", str(png_path),
                    "-filter_complex", f"[0:v][1:v]overlay={x}:{y}:format=auto[v]",
                    "-map", "[v]",
                    "-map", "0:a?",
                    "-c:v", "libx264",
                    "-preset", "veryfast",
                    "-crf", "18",
                    "-c:a", "copy",
                    "-movflags", "+faststart",
                    str(out_path),
                ])
                return
            except Exception as exc:
                last_error = f"png_overlay_failed: {exc}"

        try:
            _ava_stage69m2_drawtext(src_path, out_path, watermark)
            return
        except Exception as exc:
            if last_error:
                raise RuntimeError(f"{last_error}; drawtext_failed: {exc}")
            raise
    finally:
        try:
            png_path.unlink(missing_ok=True)
        except Exception:
            pass


# ---------------------------------------------------------------------
# Stage 6.9N — watermark opacity + safe margin polish.
# Goal:
# 1) respect low-opacity settings visually;
# 2) move watermark a bit away from the top edge / corner;
# 3) keep result stable for both PNG overlay and drawtext fallback.
# ---------------------------------------------------------------------

def _ava_stage69n_pos_expr(position):
    pos = str(position or "top_right").lower()
    margin_x = 18
    margin_y = 18
    if pos == "bottom_left":
        return str(margin_x), f"h-th-{margin_y}"
    if pos == "top_right":
        return f"w-tw-{margin_x}", str(margin_y)
    if pos == "top_left":
        return str(margin_x), str(margin_y)
    if pos == "bottom_center":
        return "(w-tw)/2", f"h-th-{margin_y}"
    if pos == "top_center":
        return "(w-tw)/2", str(margin_y)
    if pos == "bottom_right":
        return f"w-tw-{margin_x}", f"h-th-{margin_y}"
    return f"w-tw-{margin_x}", str(margin_y)


def _ava_stage69n_png_pos_expr(position):
    pos = str(position or "top_right").lower()
    margin_x = 18
    margin_y = 18
    if pos == "bottom_left":
        return str(margin_x), f"main_h-overlay_h-{margin_y}"
    if pos == "top_right":
        return f"main_w-overlay_w-{margin_x}", str(margin_y)
    if pos == "top_left":
        return str(margin_x), str(margin_y)
    if pos == "bottom_center":
        return "(main_w-overlay_w)/2", f"main_h-overlay_h-{margin_y}"
    if pos == "top_center":
        return "(main_w-overlay_w)/2", str(margin_y)
    if pos == "bottom_right":
        return f"main_w-overlay_w-{margin_x}", f"main_h-overlay_h-{margin_y}"
    return f"main_w-overlay_w-{margin_x}", str(margin_y)


def _ava_stage69n_escape_drawtext(value):
    text = str(value or "").replace("\\", "\\\\")
    text = text.replace("\n", " ").replace("\r", " ")
    text = text.replace(":", "\\:")
    text = text.replace("'", "\\'")
    text = text.replace("%", "\\%")
    text = text.replace("[", "\\[").replace("]", "\\]")
    return text


def _ava_stage69n_drawtext(src_path, out_path, watermark):
    from pathlib import Path as _Path

    text = _ava_stage69n_escape_drawtext(str((watermark or {}).get("text") or "").strip())
    if not text:
        shutil.copy2(src_path, out_path)
        return

    size = _assembly_int((watermark or {}).get("size"), 28)
    opacity = max(0.03, min(1.0, _assembly_float((watermark or {}).get("opacity"), 0.35)))
    position = str((watermark or {}).get("position") or "top_right")
    x, y = _ava_stage69n_pos_expr(position)

    font_arg = ""
    for candidate in [
        _Path("C:/Windows/Fonts/arialbd.ttf"),
        _Path("C:/Windows/Fonts/arial.ttf"),
        _Path("C:/Windows/Fonts/segoeuib.ttf"),
        _Path("C:/Windows/Fonts/segoeui.ttf"),
    ]:
        if candidate.exists():
            font_value = str(candidate).replace("\\", "/").replace(":", "\\:")
            font_arg = f"fontfile='{font_value}':"
            break

    border_opacity = max(0.02, min(0.45, opacity * 0.65))

    vf = (
        "drawtext="
        f"{font_arg}"
        f"text='{text}':"
        f"fontsize={size}:"
        f"fontcolor=white@{opacity:.3f}:"
        "borderw=2:"
        f"bordercolor=black@{border_opacity:.3f}:"
        f"x={x}:y={y}"
    )

    _run_ffmpeg([
        "-y",
        "-i", str(src_path),
        "-vf", vf,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "18",
        "-c:a", "copy",
        "-movflags", "+faststart",
        str(out_path),
    ])


def _ava_stage69n_make_png(text, target_path, size=28, opacity=0.35):
    try:
        from pathlib import Path as _Path
        from PIL import Image, ImageDraw, ImageFont
    except Exception:
        return False

    safe_text = str(text or "").strip()
    if not safe_text:
        return False

    size = max(10, min(120, int(size or 28)))
    opacity = max(0.03, min(1.0, float(opacity or 0.35)))
    alpha = max(8, min(255, int(opacity * 255)))

    font = None
    for candidate in [
        _Path("C:/Windows/Fonts/arialbd.ttf"),
        _Path("C:/Windows/Fonts/arial.ttf"),
        _Path("C:/Windows/Fonts/segoeuib.ttf"),
        _Path("C:/Windows/Fonts/segoeui.ttf"),
    ]:
        try:
            if candidate.exists():
                font = ImageFont.truetype(str(candidate), size=size)
                break
        except Exception:
            pass

    if font is None:
        try:
            font = ImageFont.truetype("arial.ttf", size=size)
        except Exception:
            font = ImageFont.load_default()

    stroke_width = max(1, int(size / 16))
    pad_x = max(2, int(size * 0.06))
    pad_y = max(2, int(size * 0.04))

    probe = Image.new("RGBA", (4, 4), (0, 0, 0, 0))
    draw = ImageDraw.Draw(probe)
    bbox = draw.textbbox((0, 0), safe_text, font=font, stroke_width=stroke_width)

    width = max(1, bbox[2] - bbox[0] + pad_x * 2)
    height = max(1, bbox[3] - bbox[1] + pad_y * 2)

    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    stroke_alpha = max(6, min(180, int(alpha * 0.55)))

    draw.text(
        (pad_x - bbox[0], pad_y - bbox[1]),
        safe_text,
        font=font,
        fill=(255, 255, 255, alpha),
        stroke_width=stroke_width,
        stroke_fill=(0, 0, 0, stroke_alpha),
    )

    target_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(target_path)
    return True


def _apply_assembly_watermark(src_path, out_path, watermark):
    from pathlib import Path as _Path

    text = str((watermark or {}).get("text") or "").strip()
    if not text:
        shutil.copy2(src_path, out_path)
        return

    size = _assembly_int((watermark or {}).get("size"), 28)
    opacity = _assembly_float((watermark or {}).get("opacity"), 0.35)
    position = str((watermark or {}).get("position") or "top_right")
    png_path = _Path(tempfile.gettempdir()) / f"ava_watermark_{uuid4().hex[:12]}.png"

    last_error = ""
    try:
        if _ava_stage69n_make_png(text, png_path, size=size, opacity=opacity):
            x, y = _ava_stage69n_png_pos_expr(position)
            try:
                _run_ffmpeg([
                    "-y",
                    "-i", str(src_path),
                    "-i", str(png_path),
                    "-filter_complex", f"[0:v][1:v]overlay={x}:{y}:format=auto[v]",
                    "-map", "[v]",
                    "-map", "0:a?",
                    "-c:v", "libx264",
                    "-preset", "veryfast",
                    "-crf", "18",
                    "-c:a", "copy",
                    "-movflags", "+faststart",
                    str(out_path),
                ])
                return
            except Exception as exc:
                last_error = f"png_overlay_failed: {exc}"

        try:
            _ava_stage69n_drawtext(src_path, out_path, watermark)
            return
        except Exception as exc:
            if last_error:
                raise RuntimeError(f"{last_error}; drawtext_failed: {exc}")
            raise
    finally:
        try:
            png_path.unlink(missing_ok=True)
        except Exception:
            pass


# ---------------------------------------------------------------------
# Stage 6.10 — persistent watermark overlay.
# Fixes single-frame PNG overlay behavior by looping the watermark image and
# using eof_action=repeat so the watermark stays until the end of the video.
# ---------------------------------------------------------------------

def _ava_stage610_png_pos_expr(position):
    pos = str(position or "top_right").lower()
    margin_x = 18
    margin_y = 18
    if pos == "bottom_left":
        return str(margin_x), f"main_h-overlay_h-{margin_y}"
    if pos == "top_right":
        return f"main_w-overlay_w-{margin_x}", str(margin_y)
    if pos == "top_left":
        return str(margin_x), str(margin_y)
    if pos == "bottom_center":
        return "(main_w-overlay_w)/2", f"main_h-overlay_h-{margin_y}"
    if pos == "top_center":
        return "(main_w-overlay_w)/2", str(margin_y)
    if pos == "bottom_right":
        return f"main_w-overlay_w-{margin_x}", f"main_h-overlay_h-{margin_y}"
    return f"main_w-overlay_w-{margin_x}", str(margin_y)


def _ava_stage610_drawtext_fallback(src_path, out_path, watermark):
    text = str((watermark or {}).get("text") or "").strip()
    if not text:
        shutil.copy2(src_path, out_path)
        return
    escape = globals().get("_ava_stage69n_escape_drawtext") or globals().get("_ava_stage69m2_escape_drawtext")
    escaped = escape(text) if callable(escape) else text.replace(":", "\\:").replace("'", "\\'")
    size = _assembly_int((watermark or {}).get("size"), 28)
    opacity = max(0.03, min(1.0, _assembly_float((watermark or {}).get("opacity"), 0.35)))
    px, py = _ava_stage610_png_pos_expr(str((watermark or {}).get("position") or "top_right"))
    x = px.replace("main_w-overlay_w", "w-tw")
    y = py.replace("main_h-overlay_h", "h-th")
    border_opacity = max(0.02, min(0.45, opacity * 0.65))
    vf = f"drawtext=text='{escaped}':fontsize={size}:fontcolor=white@{opacity:.3f}:borderw=2:bordercolor=black@{border_opacity:.3f}:x={x}:y={y}"
    _run_ffmpeg(["-y", "-i", str(src_path), "-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-c:a", "copy", "-movflags", "+faststart", str(out_path)])


def _apply_assembly_watermark(src_path, out_path, watermark):
    from pathlib import Path as _Path
    text = str((watermark or {}).get("text") or "").strip()
    if not text:
        shutil.copy2(src_path, out_path)
        return

    size = _assembly_int((watermark or {}).get("size"), 28)
    opacity = _assembly_float((watermark or {}).get("opacity"), 0.35)
    position = str((watermark or {}).get("position") or "top_right")
    png_path = _Path(tempfile.gettempdir()) / f"ava_watermark_{uuid4().hex[:12]}.png"

    try:
        make_png = globals().get("_ava_stage69n_make_png") or globals().get("_ava_stage69m2_make_png")
        if callable(make_png) and make_png(text, png_path, size=size, opacity=opacity):
            x, y = _ava_stage610_png_pos_expr(position)
            _run_ffmpeg([
                "-y",
                "-i", str(src_path),
                "-loop", "1",
                "-i", str(png_path),
                "-filter_complex", f"[1:v]format=rgba[wm];[0:v][wm]overlay={x}:{y}:format=auto:eof_action=repeat:shortest=1[v]",
                "-map", "[v]",
                "-map", "0:a?",
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-crf", "18",
                "-c:a", "copy",
                "-movflags", "+faststart",
                str(out_path),
            ])
            return

        _ava_stage610_drawtext_fallback(src_path, out_path, watermark)
    finally:
        try:
            png_path.unlink(missing_ok=True)
        except Exception:
            pass


# ---------------------------------------------------------------------
# Stage 6.10B — safe persistent watermark overlay.
# Fix: -loop 1 PNG watermark must not make output infinite.
# We loop the PNG, repeat it over video, and stop at main video duration.
# ---------------------------------------------------------------------

def _apply_assembly_watermark(src_path, out_path, watermark):
    from pathlib import Path as _Path

    text = str((watermark or {}).get("text") or "").strip()
    if not text:
        shutil.copy2(src_path, out_path)
        return

    size = _assembly_int((watermark or {}).get("size"), 28)
    opacity = _assembly_float((watermark or {}).get("opacity"), 0.35)
    position = str((watermark or {}).get("position") or "top_right")
    png_path = _Path(tempfile.gettempdir()) / f"ava_watermark_{uuid4().hex[:12]}.png"

    try:
        make_png = globals().get("_ava_stage69n_make_png") or globals().get("_ava_stage69m2_make_png")
        if callable(make_png) and make_png(text, png_path, size=size, opacity=opacity):
            pos_fn = globals().get("_ava_stage610_png_pos_expr") or globals().get("_ava_stage69n_png_pos_expr") or globals().get("_ava_stage69m2_png_pos_expr")
            if callable(pos_fn):
                x, y = pos_fn(position)
            else:
                x, y = "main_w-overlay_w-18", "18"

            duration = _ffprobe_duration(src_path) or 0.0
            duration_args = ["-t", f"{duration:.3f}"] if duration > 0 else []

            _run_ffmpeg([
                "-y",
                "-i", str(src_path),
                "-loop", "1",
                "-i", str(png_path),
                *duration_args,
                "-filter_complex", f"[1:v]format=rgba[wm];[0:v][wm]overlay={x}:{y}:format=auto:eof_action=repeat:shortest=1[v]",
                "-map", "[v]",
                "-map", "0:a?",
                "-shortest",
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-crf", "18",
                "-c:a", "copy",
                "-movflags", "+faststart",
                str(out_path),
            ])
            return

        fallback = globals().get("_ava_stage610_drawtext_fallback") or globals().get("_ava_stage69n_drawtext") or globals().get("_ava_stage69m2_drawtext")
        if callable(fallback):
            fallback(src_path, out_path, watermark)
            return

        shutil.copy2(src_path, out_path)
    finally:
        try:
            png_path.unlink(missing_ok=True)
        except Exception:
            pass


# ---------------------------------------------------------------------
# Stage 6.10D — dynamic wandering watermark mode.
# motion="corners" moves the watermark between four corners every 4 seconds.
# ---------------------------------------------------------------------

def _ava_stage610d_png_pos_expr(position):
    pos = str(position or "top_right").lower()
    margin_x = 18
    margin_y = 18
    if pos == "bottom_left":
        return str(margin_x), f"main_h-overlay_h-{margin_y}"
    if pos == "top_right":
        return f"main_w-overlay_w-{margin_x}", str(margin_y)
    if pos == "top_left":
        return str(margin_x), str(margin_y)
    if pos == "bottom_center":
        return "(main_w-overlay_w)/2", f"main_h-overlay_h-{margin_y}"
    if pos == "top_center":
        return "(main_w-overlay_w)/2", str(margin_y)
    if pos == "bottom_right":
        return f"main_w-overlay_w-{margin_x}", f"main_h-overlay_h-{margin_y}"
    return f"main_w-overlay_w-{margin_x}", str(margin_y)


def _ava_stage610d_dynamic_corner_filter():
    return (
        "[1:v]format=rgba,split=4[wm0][wm1][wm2][wm3];"
        "[0:v][wm0]overlay=main_w-overlay_w-18:18:"
        "format=auto:eof_action=repeat:enable='between(mod(t\\,8)\\,0\\,2)'[v1];"
        "[v1][wm1]overlay=18:18:"
        "format=auto:eof_action=repeat:enable='between(mod(t\\,8)\\,2\\,4)'[v2];"
        "[v2][wm2]overlay=18:main_h-overlay_h-18:"
        "format=auto:eof_action=repeat:enable='between(mod(t\\,8)\\,4\\,6)'[v3];"
        "[v3][wm3]overlay=main_w-overlay_w-18:main_h-overlay_h-18:"
        "format=auto:eof_action=repeat:enable='between(mod(t\\,8)\\,6\\,8)'[v]"
    )


def _apply_assembly_watermark(src_path, out_path, watermark):
    from pathlib import Path as _Path

    text = str((watermark or {}).get("text") or "").strip()
    if not text:
        shutil.copy2(src_path, out_path)
        return

    size = _assembly_int((watermark or {}).get("size"), 28)
    opacity = _assembly_float((watermark or {}).get("opacity"), 0.35)
    position = str((watermark or {}).get("position") or "top_right")
    motion = str((watermark or {}).get("motion") or "static").lower()
    png_path = _Path(tempfile.gettempdir()) / f"ava_watermark_{uuid4().hex[:12]}.png"

    try:
        make_png = globals().get("_ava_stage69n_make_png") or globals().get("_ava_stage69m2_make_png")
        if callable(make_png) and make_png(text, png_path, size=size, opacity=opacity):
            duration = _ffprobe_duration(src_path) or 0.0
            duration_args = ["-t", f"{duration:.3f}"] if duration > 0 else []

            if motion == "corners":
                filter_complex = _ava_stage610d_dynamic_corner_filter()
            else:
                x, y = _ava_stage610d_png_pos_expr(position)
                filter_complex = f"[1:v]format=rgba[wm];[0:v][wm]overlay={x}:{y}:format=auto:eof_action=repeat:shortest=1[v]"

            _run_ffmpeg([
                "-y",
                "-i", str(src_path),
                "-loop", "1",
                "-i", str(png_path),
                *duration_args,
                "-filter_complex", filter_complex,
                "-map", "[v]",
                "-map", "0:a?",
                "-shortest",
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-crf", "18",
                "-c:a", "copy",
                "-movflags", "+faststart",
                str(out_path),
            ])
            return

        fallback = globals().get("_ava_stage610_drawtext_fallback") or globals().get("_ava_stage69n_drawtext") or globals().get("_ava_stage69m2_drawtext")
        if callable(fallback):
            fallback(src_path, out_path, watermark)
            return

        shutil.copy2(src_path, out_path)
    finally:
        try:
            png_path.unlink(missing_ok=True)
        except Exception:
            pass


# ---------------------------------------------------------------------
# Stage 6.10E — final dynamic watermark overlay.
# Reads watermark.motion:
#   static  -> selected position
#   corners -> 0-4 top-right, 4-8 top-left, 8-12 bottom-left, 12-16 bottom-right, loop
# ---------------------------------------------------------------------

def _ava_stage610e_png_pos_expr(position):
    pos = str(position or "top_right").lower()
    mx = 18
    my = 18
    if pos == "bottom_left":
        return str(mx), f"main_h-overlay_h-{my}"
    if pos == "top_right":
        return f"main_w-overlay_w-{mx}", str(my)
    if pos == "top_left":
        return str(mx), str(my)
    if pos == "bottom_center":
        return "(main_w-overlay_w)/2", f"main_h-overlay_h-{my}"
    if pos == "top_center":
        return "(main_w-overlay_w)/2", str(my)
    if pos == "bottom_right":
        return f"main_w-overlay_w-{mx}", f"main_h-overlay_h-{my}"
    return f"main_w-overlay_w-{mx}", str(my)


def _ava_stage610e_corners_filter():
    return (
        "[1:v]format=rgba,split=4[wm0][wm1][wm2][wm3];"
        "[0:v][wm0]overlay=main_w-overlay_w-18:18:format=auto:eof_action=repeat:enable='between(mod(t\\,8)\\,0\\,2)'[v1];"
        "[v1][wm1]overlay=18:18:format=auto:eof_action=repeat:enable='between(mod(t\\,8)\\,2\\,4)'[v2];"
        "[v2][wm2]overlay=18:main_h-overlay_h-18:format=auto:eof_action=repeat:enable='between(mod(t\\,8)\\,4\\,6)'[v3];"
        "[v3][wm3]overlay=main_w-overlay_w-18:main_h-overlay_h-18:format=auto:eof_action=repeat:enable='between(mod(t\\,8)\\,6\\,8)'[v]"
    )


def _apply_assembly_watermark(src_path, out_path, watermark):
    from pathlib import Path as _Path

    text = str((watermark or {}).get("text") or "").strip()
    if not text:
        shutil.copy2(src_path, out_path)
        return

    size = _assembly_int((watermark or {}).get("size"), 28)
    opacity = _assembly_float((watermark or {}).get("opacity"), 0.35)
    position = str((watermark or {}).get("position") or "top_right")
    motion = str((watermark or {}).get("motion") or "static").lower()
    png_path = _Path(tempfile.gettempdir()) / f"ava_watermark_{uuid4().hex[:12]}.png"

    try:
        make_png = globals().get("_ava_stage69n_make_png") or globals().get("_ava_stage69m2_make_png")
        if callable(make_png) and make_png(text, png_path, size=size, opacity=opacity):
            duration = _ffprobe_duration(src_path) or 0.0
            duration_args = ["-t", f"{duration:.3f}"] if duration > 0 else []

            if motion == "corners":
                filter_complex = _ava_stage610e_corners_filter()
            else:
                x, y = _ava_stage610e_png_pos_expr(position)
                filter_complex = f"[1:v]format=rgba[wm];[0:v][wm]overlay={x}:{y}:format=auto:eof_action=repeat:shortest=1[v]"

            _run_ffmpeg([
                "-y",
                "-i", str(src_path),
                "-loop", "1",
                "-i", str(png_path),
                *duration_args,
                "-filter_complex", filter_complex,
                "-map", "[v]",
                "-map", "0:a?",
                "-shortest",
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-crf", "18",
                "-c:a", "copy",
                "-movflags", "+faststart",
                str(out_path),
            ])
            return

        fallback = globals().get("_ava_stage610_drawtext_fallback") or globals().get("_ava_stage69n_drawtext") or globals().get("_ava_stage69m2_drawtext")
        if callable(fallback):
            fallback(src_path, out_path, watermark)
            return

        shutil.copy2(src_path, out_path)
    finally:
        try:
            png_path.unlink(missing_ok=True)
        except Exception:
            pass


# ---------------------------------------------------------------------
# Stage 6.11 — Board Assembly high quality default.
# AVA_ASSEMBLY_AUDIO_WATERMARK_FAST_EXPORT_V4: use fast-enough preset for 5-10 scene montage tests.
# Assembly now uses CRF 15 + preset fast for normalization and watermark burn-in.
# This is cleaner than CRF 18/veryfast, without going into huge lossless files.
# ---------------------------------------------------------------------

AVA_BOARD_ASSEMBLY_CRF = "18"
AVA_BOARD_ASSEMBLY_PRESET = "veryfast"


def _normalize_assembly_clip(
    source_path: Path,
    out_path: Path,
    *,
    width: int,
    height: int,
    fps: int,
    fallback_duration: float,
    audio_volume: float = 1.0,
) -> dict[str, Any]:
    source_duration = _ffprobe_duration(source_path)
    duration = source_duration or fallback_duration or 0.1
    has_audio = _ffprobe_has_audio(source_path)

    vf = (
        f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
        f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,"
        f"setsar=1,fps={fps},format=yuv420p"
    )

    if has_audio:
        _run_ffmpeg([
            "-y",
            "-i", str(source_path),
            "-vf", vf,
            "-c:v", "libx264",
            "-preset", AVA_BOARD_ASSEMBLY_PRESET,
            "-crf", AVA_BOARD_ASSEMBLY_CRF,
            "-c:a", "aac",
            "-b:a", "192k",
            "-ar", "48000",
            "-ac", "2",
            "-af", f"volume={max(0.0, float(audio_volume)):.4f}",
            "-shortest",
            str(out_path),
        ])
    else:
        _run_ffmpeg([
            "-y",
            "-i", str(source_path),
            "-f", "lavfi",
            "-t", f"{max(duration, 0.1):.3f}",
            "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-vf", vf,
            "-c:v", "libx264",
            "-preset", AVA_BOARD_ASSEMBLY_PRESET,
            "-crf", AVA_BOARD_ASSEMBLY_CRF,
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            str(out_path),
        ])

    return {
        "sourcePath": str(source_path),
        "normalizedPath": str(out_path),
        "sourceDurationSec": source_duration,
        "durationSec": _ffprobe_duration(out_path) or duration,
        "hadAudio": has_audio,
        "qualityCrf": AVA_BOARD_ASSEMBLY_CRF,
        "qualityPreset": AVA_BOARD_ASSEMBLY_PRESET,
    }


def _apply_assembly_watermark(src_path, out_path, watermark):
    from pathlib import Path as _Path

    text = str((watermark or {}).get("text") or "").strip()
    if not text:
        shutil.copy2(src_path, out_path)
        return

    size = _assembly_int((watermark or {}).get("size"), 28)
    opacity = _assembly_float((watermark or {}).get("opacity"), 0.35)
    position = str((watermark or {}).get("position") or "top_right")
    motion = str((watermark or {}).get("motion") or "static").lower()
    png_path = _Path(tempfile.gettempdir()) / f"ava_watermark_{uuid4().hex[:12]}.png"

    try:
        make_png = globals().get("_ava_stage69n_make_png") or globals().get("_ava_stage69m2_make_png")
        if callable(make_png) and make_png(text, png_path, size=size, opacity=opacity):
            duration = _ffprobe_duration(src_path) or 0.0
            duration_args = ["-t", f"{duration:.3f}"] if duration > 0 else []

            if motion == "corners" and callable(globals().get("_ava_stage610e_corners_filter")):
                filter_complex = globals()["_ava_stage610e_corners_filter"]()
            elif motion == "corners" and callable(globals().get("_ava_stage610d_dynamic_corner_filter")):
                filter_complex = globals()["_ava_stage610d_dynamic_corner_filter"]()
            else:
                pos_fn = (
                    globals().get("_ava_stage610e_png_pos_expr")
                    or globals().get("_ava_stage610d_png_pos_expr")
                    or globals().get("_ava_stage610_png_pos_expr")
                    or globals().get("_ava_stage69n_png_pos_expr")
                    or globals().get("_ava_stage69m2_png_pos_expr")
                )
                if callable(pos_fn):
                    x, y = pos_fn(position)
                else:
                    x, y = "main_w-overlay_w-18", "18"
                filter_complex = f"[1:v]format=rgba[wm];[0:v][wm]overlay={x}:{y}:format=auto:eof_action=repeat:shortest=1[v]"

            _run_ffmpeg([
                "-y",
                "-i", str(src_path),
                "-loop", "1",
                "-i", str(png_path),
                *duration_args,
                "-filter_complex", filter_complex,
                "-map", "[v]",
                "-map", "0:a?",
                "-shortest",
                "-c:v", "libx264",
                "-preset", AVA_BOARD_ASSEMBLY_PRESET,
                "-crf", AVA_BOARD_ASSEMBLY_CRF,
                "-c:a", "copy",
                "-movflags", "+faststart",
                str(out_path),
            ])
            return

        fallback = (
            globals().get("_ava_stage610_drawtext_fallback")
            or globals().get("_ava_stage69n_drawtext")
            or globals().get("_ava_stage69m2_drawtext")
        )
        if callable(fallback):
            fallback(src_path, out_path, watermark)
            return

        shutil.copy2(src_path, out_path)
    finally:
        try:
            png_path.unlink(missing_ok=True)
        except Exception:
            pass


# ---------------------------------------------------------------------
# Stage 6.12B — browser/player compatible MP4 output.
# Fix: PNG/RGBA watermark overlay can make libx264 output yuv444p
# / High 4:4:4 Predictive, which many players/browsers refuse to play.
# This final override forces yuv420p + standard H.264 high profile.
# ---------------------------------------------------------------------

def _ava_stage612b_png_pos_expr(position):
    pos = str(position or "top_right").lower()
    mx = 18
    my = 18
    if pos == "bottom_left":
        return str(mx), f"main_h-overlay_h-{my}"
    if pos == "top_right":
        return f"main_w-overlay_w-{mx}", str(my)
    if pos == "top_left":
        return str(mx), str(my)
    if pos == "bottom_center":
        return "(main_w-overlay_w)/2", f"main_h-overlay_h-{my}"
    if pos == "top_center":
        return "(main_w-overlay_w)/2", str(my)
    if pos == "bottom_right":
        return f"main_w-overlay_w-{mx}", f"main_h-overlay_h-{my}"
    return f"main_w-overlay_w-{mx}", str(my)


def _ava_stage612b_corners_filter():
    # AVA_ASSEMBLY_DYNAMIC_WATERMARK_BURNIN_V4: move watermark every 2 sec across corners.
    # Final label [v] is always yuv420p to keep MP4 playable everywhere.
    return (
        "[1:v]format=rgba,split=4[wm0][wm1][wm2][wm3];"
        "[0:v][wm0]overlay=main_w-overlay_w-18:18:"
        "format=auto:eof_action=repeat:enable='between(mod(t\,8)\,0\,2)'[v1];"
        "[v1][wm1]overlay=18:18:"
        "format=auto:eof_action=repeat:enable='between(mod(t\,8)\,2\,4)'[v2];"
        "[v2][wm2]overlay=18:main_h-overlay_h-18:"
        "format=auto:eof_action=repeat:enable='between(mod(t\,8)\,4\,6)'[v3];"
        "[v3][wm3]overlay=main_w-overlay_w-18:main_h-overlay_h-18:"
        "format=auto:eof_action=repeat:enable='between(mod(t\,8)\,6\,8)'[ov];"
        "[ov]format=yuv420p[v]"
    )


def _apply_assembly_watermark(src_path, out_path, watermark):
    from pathlib import Path as _Path

    text = str((watermark or {}).get("text") or "").strip()

    preset = globals().get("AVA_BOARD_ASSEMBLY_PRESET", "fast")
    crf = globals().get("AVA_BOARD_ASSEMBLY_CRF", "15")

    if not text:
        _run_ffmpeg([
            "-y",
            "-i", str(src_path),
            "-map", "0:v:0",
            "-map", "0:a?",
            "-c:v", "libx264",
            "-preset", preset,
            "-crf", crf,
            "-profile:v", "high",
            "-pix_fmt", "yuv420p",
            "-c:a", "copy",
            "-movflags", "+faststart",
            str(out_path),
        ])
        return

    size = _assembly_int((watermark or {}).get("size"), 28)
    opacity = _assembly_float((watermark or {}).get("opacity"), 0.35)
    position = str((watermark or {}).get("position") or "top_right")
    motion = str((watermark or {}).get("motion") or "static").lower()
    png_path = _Path(tempfile.gettempdir()) / f"ava_watermark_{uuid4().hex[:12]}.png"

    try:
        make_png = globals().get("_ava_stage69n_make_png") or globals().get("_ava_stage69m2_make_png")
        if callable(make_png) and make_png(text, png_path, size=size, opacity=opacity):
            duration = _ffprobe_duration(src_path) or 0.0
            duration_args = ["-t", f"{duration:.3f}"] if duration > 0 else []

            if motion == "corners":
                filter_complex = _ava_stage612b_corners_filter()
            else:
                pos_fn = (
                    globals().get("_ava_stage610e_png_pos_expr")
                    or globals().get("_ava_stage610d_png_pos_expr")
                    or globals().get("_ava_stage610_png_pos_expr")
                    or globals().get("_ava_stage69n_png_pos_expr")
                    or globals().get("_ava_stage69m2_png_pos_expr")
                    or _ava_stage612b_png_pos_expr
                )
                x, y = pos_fn(position)
                filter_complex = (
                    f"[1:v]format=rgba[wm];"
                    f"[0:v][wm]overlay={x}:{y}:format=auto:eof_action=repeat:shortest=1[ov];"
                    "[ov]format=yuv420p[v]"
                )

            _run_ffmpeg([
                "-y",
                "-i", str(src_path),
                "-loop", "1",
                "-i", str(png_path),
                *duration_args,
                "-filter_complex", filter_complex,
                "-map", "[v]",
                "-map", "0:a?",
                "-shortest",
                "-c:v", "libx264",
                "-preset", preset,
                "-crf", crf,
                "-profile:v", "high",
                "-pix_fmt", "yuv420p",
                "-c:a", "copy",
                "-movflags", "+faststart",
                str(out_path),
            ])
            return

        # Fallback: drawtext path, then force it back to yuv420p.
        fallback = (
            globals().get("_ava_stage610_drawtext_fallback")
            or globals().get("_ava_stage69n_drawtext")
            or globals().get("_ava_stage69m2_drawtext")
        )
        if callable(fallback):
            temp_path = out_path.with_name(out_path.stem + "_drawtext_tmp.mp4")
            fallback(src_path, temp_path, watermark)
            _run_ffmpeg([
                "-y",
                "-i", str(temp_path),
                "-map", "0:v:0",
                "-map", "0:a?",
                "-c:v", "libx264",
                "-preset", preset,
                "-crf", crf,
                "-profile:v", "high",
                "-pix_fmt", "yuv420p",
                "-c:a", "copy",
                "-movflags", "+faststart",
                str(out_path),
            ])
            try:
                temp_path.unlink(missing_ok=True)
            except Exception:
                pass
            return

        shutil.copy2(src_path, out_path)
    finally:
        try:
            png_path.unlink(missing_ok=True)
        except Exception:
            pass


# ---------------------------------------------------------------------
# Stage 6.12C — compatible MP4 with better color/quality.
# AVA_ASSEMBLY_AUDIO_WATERMARK_FAST_EXPORT_V4: final override keeps audio/watermark burn-in faster for 5-10 scene edits.
# Fixes the playable-yuv420p output while reducing color/quality loss:
# - keep yuv420p for browser/player compatibility;
# - use much cleaner CRF 12 for assembly/watermark re-encodes;
# - use Lanczos scaling;
# - write BT.709 color metadata explicitly for HD video;
# - keep dynamic watermark mode.
# ---------------------------------------------------------------------

AVA_BOARD_ASSEMBLY_CRF = "18"
AVA_BOARD_ASSEMBLY_PRESET = "veryfast"


def _ava_stage612c_color_args():
    return [
        "-color_primaries", "bt709",
        "-color_trc", "bt709",
        "-colorspace", "bt709",
        "-color_range", "tv",
    ]


def _ava_stage612c_video_args():
    return [
        "-c:v", "libx264",
        "-preset", globals().get("AVA_BOARD_ASSEMBLY_PRESET", "fast"),
        "-crf", globals().get("AVA_BOARD_ASSEMBLY_CRF", "18"),
        "-profile:v", "high",
        "-pix_fmt", "yuv420p",
        *_ava_stage612c_color_args(),
    ]


def _normalize_assembly_clip(
    source_path,
    out_path,
    *,
    width,
    height,
    fps,
    fallback_duration,
    audio_volume=1.0,
    fit_mode="contain",
):
    source_duration = _ffprobe_duration(source_path)
    target_duration = _assembly_float(fallback_duration, 0.0)
    if target_duration <= 0:
        target_duration = source_duration or 0.1
    target_duration = max(float(target_duration), 0.1)

    has_audio = _ffprobe_has_audio(source_path)

    # Final montage must follow Manual Timing / Board timeline, not the real
    # duration returned by each generated MP4. If a generated clip is shorter,
    # freeze its last frame; if longer, trim it. This prevents cumulative drift.

    # AVA_ASSEMBLY_OUTPUT_SPEC_V195F normalize

    fit_mode_safe = str(fit_mode or "contain").strip().lower()

    if fit_mode_safe == "cover":

        vf = (f"scale={width}:{height}:flags=fast_bilinear:force_original_aspect_ratio=increase," f"crop={width}:{height}," f"setsar=1," f"tpad=stop_mode=clone:stop_duration={target_duration:.6f}," f"trim=duration={target_duration:.6f},setpts=PTS-STARTPTS," f"fps={fps},format=yuv420p")

    else:

        vf = (f"scale={width}:{height}:flags=fast_bilinear:force_original_aspect_ratio=decrease," f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2," f"setsar=1," f"tpad=stop_mode=clone:stop_duration={target_duration:.6f}," f"trim=duration={target_duration:.6f},setpts=PTS-STARTPTS," f"fps={fps},format=yuv420p")

    if has_audio:
        _run_ffmpeg([
            "-y",
            "-i", str(source_path),
            "-map", "0:v:0",
            "-map", "0:a:0",
            "-vf", vf,
            *_ava_stage612c_video_args(),
            "-af", f"volume={max(0.0, float(audio_volume)):.4f},apad=pad_dur={target_duration:.6f},atrim=duration={target_duration:.6f},asetpts=PTS-STARTPTS",
            "-c:a", "aac",
            "-b:a", "192k",
            "-ar", "48000",
            "-ac", "2",
            "-t", f"{target_duration:.6f}",
            "-movflags", "+faststart",
            str(out_path),
        ])
    else:
        _run_ffmpeg([
            "-y",
            "-i", str(source_path),
            "-f", "lavfi",
            "-t", f"{target_duration:.6f}",
            "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-vf", vf,
            *_ava_stage612c_video_args(),
            "-c:a", "aac",
            "-b:a", "192k",
            "-ar", "48000",
            "-ac", "2",
            "-t", f"{target_duration:.6f}",
            "-movflags", "+faststart",
            str(out_path),
        ])

    normalized_duration = _ffprobe_duration(out_path) or target_duration
    return {
        "sourcePath": str(source_path),
        "normalizedPath": str(out_path),
        "sourceDurationSec": source_duration,
        "targetDurationSec": target_duration,
        "durationSec": normalized_duration,
        "timelineLockApplied": True,
        "sceneAudioVolumeApplied": max(0.0, float(audio_volume)),
        "hadAudio": has_audio,
        "qualityCrf": globals().get("AVA_BOARD_ASSEMBLY_CRF", "18"),
        "qualityPreset": globals().get("AVA_BOARD_ASSEMBLY_PRESET", "fast"),
        "qualityColor": "bt709_yuv420p_fast_bilinear",
    }


def _ava_stage612c_png_pos_expr(position):
    pos = str(position or "top_right").lower()
    mx = 18
    my = 18
    if pos == "bottom_left":
        return str(mx), f"main_h-overlay_h-{my}"
    if pos == "top_right":
        return f"main_w-overlay_w-{mx}", str(my)
    if pos == "top_left":
        return str(mx), str(my)
    if pos == "bottom_center":
        return "(main_w-overlay_w)/2", f"main_h-overlay_h-{my}"
    if pos == "top_center":
        return "(main_w-overlay_w)/2", str(my)
    if pos == "bottom_right":
        return f"main_w-overlay_w-{mx}", f"main_h-overlay_h-{my}"
    return f"main_w-overlay_w-{mx}", str(my)


def _ava_stage612c_corners_filter():
    return (
        "[1:v]format=rgba,split=4[wm0][wm1][wm2][wm3];"
        "[0:v][wm0]overlay=main_w-overlay_w-18:18:"
        "format=auto:eof_action=repeat:enable='between(mod(t\\,8)\\,0\\,2)'[v1];"
        "[v1][wm1]overlay=18:18:"
        "format=auto:eof_action=repeat:enable='between(mod(t\\,8)\\,2\\,4)'[v2];"
        "[v2][wm2]overlay=18:main_h-overlay_h-18:"
        "format=auto:eof_action=repeat:enable='between(mod(t\\,8)\\,4\\,6)'[v3];"
        "[v3][wm3]overlay=main_w-overlay_w-18:main_h-overlay_h-18:"
        "format=auto:eof_action=repeat:enable='between(mod(t\\,8)\\,6\\,8)'[ov];"
        "[ov]format=yuv420p[v]"
    )


def _apply_assembly_watermark(src_path, out_path, watermark):
    from pathlib import Path as _Path

    text = str((watermark or {}).get("text") or "").strip()

    if not text:
        _run_ffmpeg([
            "-y",
            "-i", str(src_path),
            "-map", "0:v:0",
            "-map", "0:a?",
            *_ava_stage612c_video_args(),
            "-c:a", "copy",
            "-movflags", "+faststart",
            str(out_path),
        ])
        return

    size = _assembly_int((watermark or {}).get("size"), 28)
    opacity = _assembly_float((watermark or {}).get("opacity"), 0.35)
    position = str((watermark or {}).get("position") or "top_right")
    motion = str((watermark or {}).get("motion") or "static").lower()
    png_path = _Path(tempfile.gettempdir()) / f"ava_watermark_{uuid4().hex[:12]}.png"

    try:
        make_png = globals().get("_ava_stage69n_make_png") or globals().get("_ava_stage69m2_make_png")
        if callable(make_png) and make_png(text, png_path, size=size, opacity=opacity):
            duration = _ffprobe_duration(src_path) or 0.0
            duration_args = ["-t", f"{duration:.3f}"] if duration > 0 else []

            if motion == "corners":
                filter_complex = _ava_stage612c_corners_filter()
            else:
                x, y = _ava_stage612c_png_pos_expr(position)
                filter_complex = (
                    f"[1:v]format=rgba[wm];"
                    f"[0:v][wm]overlay={x}:{y}:format=auto:eof_action=repeat:shortest=1[ov];"
                    "[ov]format=yuv420p[v]"
                )

            _run_ffmpeg([
                "-y",
                "-i", str(src_path),
                "-loop", "1",
                "-i", str(png_path),
                *duration_args,
                "-filter_complex", filter_complex,
                "-map", "[v]",
                "-map", "0:a?",
                "-shortest",
                *_ava_stage612c_video_args(),
                "-c:a", "copy",
                "-movflags", "+faststart",
                str(out_path),
            ])
            return

        fallback = (
            globals().get("_ava_stage610_drawtext_fallback")
            or globals().get("_ava_stage69n_drawtext")
            or globals().get("_ava_stage69m2_drawtext")
        )
        if callable(fallback):
            temp_path = out_path.with_name(out_path.stem + "_drawtext_tmp.mp4")
            fallback(src_path, temp_path, watermark)
            _run_ffmpeg([
                "-y",
                "-i", str(temp_path),
                "-map", "0:v:0",
                "-map", "0:a?",
                *_ava_stage612c_video_args(),
                "-c:a", "copy",
                "-movflags", "+faststart",
                str(out_path),
            ])
            try:
                temp_path.unlink(missing_ok=True)
            except Exception:
                pass
            return

        shutil.copy2(src_path, out_path)
    finally:
        try:
            png_path.unlink(missing_ok=True)
        except Exception:
            pass



# ---------------------------------------------------------------------
# Stage 6.13 — Assembly performance + browser preview cleanup.
# AVA_ASSEMBLY_FAST_PREVIEW_POLLER_V5:
# - speed up montage re-encodes for local testing;
# - use one drawtext pass for dynamic watermark instead of 4 PNG overlays;
# - always write +faststart for playable browser preview.
# ---------------------------------------------------------------------

AVA_BOARD_ASSEMBLY_CRF = "22"
AVA_BOARD_ASSEMBLY_PRESET = "superfast"


def _ava_stage613_escape_drawtext(value: Any) -> str:
    text = str(value or "").replace("\\", "\\\\")
    text = text.replace("\n", " ").replace("\r", " ")
    text = text.replace(":", "\\:")
    text = text.replace("'", "\\'")
    text = text.replace("%", "\\%")
    text = text.replace("[", "\\[").replace("]", "\\]")
    return text


def _ava_stage613_font_arg() -> str:
    for candidate in [
        Path("C:/Windows/Fonts/arialbd.ttf"),
        Path("C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/segoeuib.ttf"),
        Path("C:/Windows/Fonts/segoeui.ttf"),
    ]:
        try:
            if candidate.exists():
                value = str(candidate).replace("\\", "/").replace(":", "\\:")
                return f"fontfile='{value}':"
        except Exception:
            pass
    return ""


def _ava_stage613_static_drawtext_position(position: str) -> tuple[str, str]:
    pos = str(position or "top_right").lower()
    mx = 18
    my = 18
    if pos == "bottom_left":
        return str(mx), f"h-th-{my}"
    if pos == "top_left":
        return str(mx), str(my)
    if pos == "bottom_right":
        return f"w-tw-{mx}", f"h-th-{my}"
    if pos == "top_center":
        return "(w-tw)/2", str(my)
    if pos == "bottom_center":
        return "(w-tw)/2", f"h-th-{my}"
    return f"w-tw-{mx}", str(my)


def _ava_stage613_dynamic_drawtext_position() -> tuple[str, str]:
    # 0-2 top-right, 2-4 top-left, 4-6 bottom-left, 6-8 bottom-right, repeat.
    # Commas are escaped because this expression is embedded in one ffmpeg filter.
    x = "if(lt(mod(t\\,8)\\,2)\\,w-tw-18\\,if(lt(mod(t\\,8)\\,4)\\,18\\,if(lt(mod(t\\,8)\\,6)\\,18\\,w-tw-18)))"
    y = "if(lt(mod(t\\,8)\\,4)\\,18\\,h-th-18)"
    return x, y


def _ava_stage613_slow_orbit_drawtext_position() -> tuple[str, str]:
    # One gentle full circle every 28 seconds.
    # Keep the text safely inside frame bounds and much calmer than the corner-jump mode.
    x = "(w-tw)/2 + (w*0.18)*sin(2*PI*t/28)"
    y = "(h-th)/2 + (h*0.12)*cos(2*PI*t/28)"
    return x, y


def _apply_assembly_watermark(src_path, out_path, watermark):
    text_raw = str((watermark or {}).get("text") or "").strip()
    preset = globals().get("AVA_BOARD_ASSEMBLY_PRESET", "superfast")
    crf = globals().get("AVA_BOARD_ASSEMBLY_CRF", "22")

    if not text_raw:
        _run_ffmpeg([
            "-y",
            "-i", str(src_path),
            "-map", "0:v:0",
            "-map", "0:a?",
            "-c:v", "copy",
            "-c:a", "copy",
            "-movflags", "+faststart",
            str(out_path),
        ])
        return

    text = _ava_stage613_escape_drawtext(text_raw)
    size = _assembly_int((watermark or {}).get("size"), 28)
    opacity = max(0.03, min(1.0, _assembly_float((watermark or {}).get("opacity"), 0.35)))
    motion = str((watermark or {}).get("motion") or "static").lower()
    position = str((watermark or {}).get("position") or "top_right")
    if motion in {"slow", "slow_orbit", "orbit"}:
        x, y = _ava_stage613_slow_orbit_drawtext_position()
    elif motion == "corners":
        x, y = _ava_stage613_dynamic_drawtext_position()
    else:
        x, y = _ava_stage613_static_drawtext_position(position)
    border_opacity = max(0.02, min(0.45, opacity * 0.65))
    vf = (
        "drawtext="
        f"{_ava_stage613_font_arg()}"
        f"text='{text}':"
        f"fontsize={size}:"
        f"fontcolor=white@{opacity:.3f}:"
        "borderw=2:"
        f"bordercolor=black@{border_opacity:.3f}:"
        f"x={x}:y={y},"
        "format=yuv420p"
    )
    _run_ffmpeg([
        "-y",
        "-i", str(src_path),
        "-vf", vf,
        "-map", "0:v:0",
        "-map", "0:a?",
        "-c:v", "libx264",
        "-preset", preset,
        "-crf", crf,
        "-profile:v", "high",
        "-pix_fmt", "yuv420p",
        "-c:a", "copy",
        "-movflags", "+faststart",
        str(out_path),
    ])
