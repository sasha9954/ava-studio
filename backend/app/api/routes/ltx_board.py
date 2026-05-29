from __future__ import annotations

import base64
import copy
import json
import mimetypes
import os
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


router = APIRouter(tags=["ltx-board"])

APP_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = APP_DIR.parent
WORKFLOWS_DIR = APP_DIR / "workflows"
BACKEND_ENV_FILE = BACKEND_DIR / ".env"

BOARD_VIDEO_JOBS: dict[str, dict[str, Any]] = {}
BOARD_MMAUDIO_JOBS: dict[str, dict[str, Any]] = {}
BOARD_ASSEMBLY_JOBS: dict[str, dict[str, Any]] = {}

WORKFLOW_ROUTE_MAP: dict[str, str] = {
    "i2v": "image-video.json",
    "i2v_text": "image-video-golos-zvuk.json",
    "i2v_sound": "image-video-golos-zvuk.json",
    "ia2v": "image-lipsink-video-music.json",
    "ia2v_lipsync": "image-lipsink-video-music.json",
    "lip_sync": "image-lipsink-video-music.json",
    "first_last": "last-first cadr-NO sound.json",
    "first_last_sound": "last-first cadr-sound.json",
}

VIDEO_ROUTE_CREDIT_COSTS: dict[str, int] = {
    "ia2v": 2,
    "ia2v_lipsync": 2,
    "lip_sync": 2,
    "first_last": 2,
    "first_last_sound": 2,
    "i2v": 1,
    "i2v_text": 1,
    "i2v_sound": 1,
}

MMAUDIO_CREDIT_COST = 1

BOARD_ASSEMBLY_EXPORT_CREDIT_COST = 1
BOARD_ASSEMBLY_MUSIC_CREDIT_COST = 1
BOARD_ASSEMBLY_WATERMARK_CREDIT_COST = 1


class SliceAudioIn(BaseModel):
    audio_url: str | None = None
    audioUrl: str | None = None
    audio_asset_id: str | None = None
    audioAssetId: str | None = None
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
    duration_sec: float | None = None
    durationSec: float | None = None
    target_duration_sec: float | None = None
    targetDurationSec: float | None = None
    scene_start_sec: float | None = None
    sceneStartSec: float | None = None
    scene_end_sec: float | None = None
    sceneEndSec: float | None = None


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


def _ava_credit_project_from_job(job: dict) -> str | None:
    value = job.get("projectId") or job.get("project_id")
    return str(value).strip() or None


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
    amount = _video_credit_cost(route)
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
    if job.get("videoUrl") or job.get("video_url"):
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
        return str(getattr(settings, "public_base_url", "") or "").rstrip("/")
    except Exception:
        return ""


def _settings_static_path() -> Path:
    try:
        settings = get_settings()
        return Path(getattr(settings, "static_path"))
    except Exception:
        return BACKEND_DIR / "static"


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
        path = Path(asset.get("storage_path") or "")
        if path.exists() and path.is_file():
            return path

    if not value:
        raise HTTPException(status_code=400, detail="Missing file URL/path")

    raw = str(value).strip()

    if raw.startswith("/static/"):
        path = _settings_static_path() / raw[len("/static/") :]
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
            path = Path(asset.get("storage_path") or "")
            if path.exists() and path.is_file():
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
    if route_key in {"i2v", "i2v_text", "i2v_sound", "ia2v", "ia2v_lipsync", "lip_sync"}:
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
    return {"ok": True, "videoRouteCreditCosts": VIDEO_ROUTE_CREDIT_COSTS, "mmaudioCreditCost": MMAUDIO_CREDIT_COST, "boardAssemblyCreditCosts": {"export": BOARD_ASSEMBLY_EXPORT_CREDIT_COST, "music": BOARD_ASSEMBLY_MUSIC_CREDIT_COST, "watermark": BOARD_ASSEMBLY_WATERMARK_CREDIT_COST}, "chargeMode": "preflight_balance_check_then_charge_after_success"}


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
    source_value = payload.audio_url or payload.audioUrl or payload.audio_asset_api_path or payload.audioAssetApiPath
    source_asset_id = payload.audio_asset_id or payload.audioAssetId or payload.asset_id or payload.assetId
    source_path = _resolve_local_file(source_value, asset_id=source_asset_id)
    static_root = _settings_static_path()
    target_dir = static_root / "assets" / "manual_clip_audio"
    target_dir.mkdir(parents=True, exist_ok=True)
    scene_id = _safe_name(payload.scene_id or payload.sceneId or "scene")
    file_id = uuid4().hex[:12]
    out_name = f"{scene_id}_{start_f:.3f}_{end_f:.3f}_{file_id}.mp3".replace(".", "_", 2)
    out_path = target_dir / out_name
    _run_ffmpeg(["-y", "-ss", f"{start_f:.3f}", "-t", f"{duration_f:.3f}", "-i", str(source_path), "-vn", "-acodec", "libmp3lame", "-ar", "44100", "-ac", "2", "-b:a", "192k", str(out_path)])
    urls = _public_static_url(f"assets/manual_clip_audio/{out_name}")
    return {"ok": True, "audioSliceUrl": urls["url"], "audio_slice_url": urls["url"], "audioSliceApiPath": urls["apiPath"], "audio_slice_api_path": urls["apiPath"], "audioSliceName": out_name, "audio_slice_name": out_name, "mimeType": "audio/mpeg", "startSec": start_f, "endSec": end_f, "durationSec": duration_f, "sourcePath": str(source_path), "source": "manual_scene_range_server_mp3"}


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
    urls = _public_static_url(f"assets/board_frames/{out_name}")
    return {"ok": True, "imageUrl": urls["url"], "image_url": urls["url"], "imageApiPath": urls["apiPath"], "image_api_path": urls["apiPath"], "imageName": out_name, "image_name": out_name, "sourcePath": str(source_path), "sourceSceneId": payload.source_scene_id or payload.sourceSceneId or ""}


@router.post("/clip/video/start")
def start_video(payload: VideoStartIn, user: dict = Depends(get_current_user)) -> dict[str, Any]:
    route = (payload.route or "i2v").strip() or "i2v"
    # AVA_ROUTE_WORKFLOW_LOCK: route is the source of truth for sound/no-sound workflows.
    # Old Board scenes may keep stale workflow_key values after route changes.
    if route in ("i2v_text", "i2v_sound", "first_last", "first_last_sound"):
        workflow_key = WORKFLOW_ROUTE_MAP.get(route) or WORKFLOW_ROUTE_MAP["i2v"]
    else:
        workflow_key = payload.workflow_key or payload.workflowKey or WORKFLOW_ROUTE_MAP.get(route) or WORKFLOW_ROUTE_MAP["i2v"]
    workflow_path = WORKFLOWS_DIR / workflow_key
    target_duration = _target_duration(payload)
    generation_duration = _generation_duration(route, target_duration)
    credit_cost = _video_credit_cost(route)
    project_id_for_credit = payload.project_id or payload.projectId
    if project_id_for_credit:
        ensure_project_access(project_id_for_credit, user)
    _ava_credit_require_balance(user, credit_cost)
    job_id = f"boardjob_{uuid4().hex[:14]}"
    now = datetime.utcnow().isoformat() + "Z"
    main_url = _main_comfy_url()
    if not main_url:
        status = "blocked_missing_comfy_base_url"
        job = {"jobId": job_id, "status": status, "createdAt": now, "updatedAt": now, "sceneId": payload.scene_id or payload.sceneId, "route": route, "workflowKey": workflow_key, "workflowExists": workflow_path.exists(), "targetComfy": "main_ltx", "targetDurationSec": target_duration, "generationDurationSec": generation_duration, "trimToDurationSec": target_duration, "plusOneSecondApplied": generation_duration > target_duration, "creditCost": credit_cost, "creditCharged": False, "payload": payload.model_dump()}
        _ava_credit_attach_job_user(job, user)
        BOARD_VIDEO_JOBS[job_id] = job
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

    if route.startswith("first_last"):
        missing_media = []
        if not (start_url or image_url or start_data_url or image_data_url):
            missing_media.append("start_image")
        if not (end_url or end_data_url):
            missing_media.append("end_image")
        if missing_media:
            status = "blocked_missing_first_last_media"
            job = {
                "jobId": job_id,
                "status": status,
                "createdAt": now,
                "updatedAt": now,
                "sceneId": payload.scene_id or payload.sceneId,
                "projectId": payload.project_id or payload.projectId,
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
            BOARD_VIDEO_JOBS[job_id] = job
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
    job = {"jobId": job_id, "status": status, "createdAt": now, "updatedAt": now, "sceneId": payload.scene_id or payload.sceneId, "projectId": payload.project_id or payload.projectId, "route": route, "workflowKey": workflow_key, "workflowExists": workflow_path.exists(), "targetComfy": "main_ltx", "targetComfyBaseUrl": main_url, "promptId": prompt_id, "promptSubmit": submit_data, "workflowPatches": patches, "uploadedMedia": {"image": uploaded_image, "start": uploaded_start, "end": uploaded_end, "audio": uploaded_audio}, "targetDurationSec": target_duration, "generationDurationSec": generation_duration, "trimToDurationSec": target_duration, "plusOneSecondApplied": generation_duration > target_duration, "comfyBaseUrlConfigured": True, "creditCost": credit_cost, "creditCharged": False, "creditChargeMode": "not_charged_until_result_success", "payload": payload.model_dump()}
    _ava_credit_attach_job_user(job, user)
    BOARD_VIDEO_JOBS[job_id] = job
    return {"ok": True, "jobId": job_id, "job_id": job_id, "status": status, "statusEndpoint": f"/api/clip/video/status/{job_id}", "promptId": prompt_id, "workflowKey": workflow_key, "workflowExists": workflow_path.exists(), "targetComfy": "main_ltx", "targetComfyBaseUrl": main_url, "targetDurationSec": target_duration, "generationDurationSec": generation_duration, "trimToDurationSec": target_duration, "plusOneSecondApplied": generation_duration > target_duration, "creditCost": credit_cost, "creditCharged": False, "creditChargeMode": "preflight_ok_charge_after_success", "workflowPatchCount": len(patches), "uploadedMedia": job["uploadedMedia"], "jobStored": True}



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

    target_dir = _settings_static_path() / "assets" / "board_videos"
    target_dir.mkdir(parents=True, exist_ok=True)

    raw_name = f"{job_id}_{_safe_name(filename, 'video.mp4')}"
    if not raw_name.lower().endswith(suffix.lower()):
        raw_name += suffix
    out_path = target_dir / raw_name

    query = urllib.parse.urlencode({"filename": filename, "subfolder": subfolder, "type": ftype})
    url = f"{base_url.rstrip()}/view?{query}"

    try:
        with urllib.request.urlopen(url, timeout=180) as response:
            out_path.write_bytes(response.read())
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Cannot download Comfy output video: {exc}") from exc

    urls = _public_static_url(f"assets/board_videos/{out_path.name}")
    return {
        "videoUrl": urls["url"],
        "video_url": urls["url"],
        "videoApiPath": urls["apiPath"],
        "video_api_path": urls["apiPath"],
        "videoName": out_path.name,
        "video_name": out_path.name,
        "localPath": str(out_path),
        "sourceComfyUrl": url,
    }


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

    video_outputs = [item for item in outputs if _is_video_output(item)] or outputs

    preferred_node_ids = [str(item) for item in (
        job.get("preferredOutputNodeIds")
        or job.get("preferred_output_node_ids")
        or []
    )]

    chosen = None
    if preferred_node_ids:
        for item in video_outputs:
            if str(item.get("nodeId")) in preferred_node_ids:
                chosen = item
                break

    if chosen is None:
        chosen = video_outputs[0]

    downloaded = _download_comfy_output_to_static(base_url, chosen, job_id=job.get("jobId", "job"))
    final = downloaded

    try:
        trim_duration = float(job.get("trimToDurationSec") or job.get("targetDurationSec") or 0)
    except Exception:
        trim_duration = 0.0

    if trim_duration > 0.1:
        trimmed = _trim_video_to_duration(Path(downloaded["localPath"]), duration_sec=trim_duration, job_id=job.get("jobId", "job"))
        if trimmed:
            final = {**downloaded, **trimmed, "originalVideoUrl": downloaded["videoUrl"]}

    final["selectedOutput"] = chosen
    final["preferredOutputNodeIds"] = preferred_node_ids
    return final


@router.get("/clip/video/status/{job_id}")
def video_status(job_id: str, user: dict = Depends(get_current_user)) -> dict[str, Any]:
    job = BOARD_VIDEO_JOBS.get(job_id)
    if not job:
        return {"ok": False, "status": "not_found", "code": "BOARD_VIDEO_JOB_NOT_FOUND", "jobId": job_id}

    _ava_credit_ensure_job_owner(job, user)

    if job.get("videoUrl") or job.get("video_url"):
        _ava_credit_charge_video_job_if_ready(job)

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
                    job["status"] = "completed"
                    job["video_status"] = "ready"
                    _ava_credit_charge_video_job_if_ready(job)
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

    _ava_credit_charge_video_job_if_ready(job)


    return {"ok": True, **job}




def _inject_mmaudio_workflow(
    workflow: dict[str, Any],
    *,
    uploaded_video: dict[str, Any] | None,
    prompt: str,
    negative_prompt: str,
    job_id: str,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    # Exact-only MMAudio workflow patch.
    # mmaudio-sound-design.json:
    #   91.video           = uploaded video
    #   92.prompt          = positive sound prompt
    #   92.negative_prompt = negative sound prompt
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

        prompt = str(_payload_get(payload_data, "prompt", default="") or "")
        negative_prompt = str(_payload_get(payload_data, "negative_prompt", "negativePrompt", default="") or "")

        if not prompt.strip():
            prompt = "Realistic natural sound design matching the visible action. Clean synchronized environmental audio, no music, no narration, no human voice unless explicitly visible and requested."

        if not negative_prompt.strip():
            negative_prompt = "music, soundtrack, score, narration, speech, human voice, singing, distorted audio, clipping, harsh noise, unrelated sounds, repeated loop, robotic audio"

        prompt_graph, patches = _inject_mmaudio_workflow(
            workflow,
            uploaded_video=uploaded_video,
            prompt=prompt,
            negative_prompt=negative_prompt,
            job_id=job_id,
        )

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

    project_id_for_credit = str(_payload_get(payload_data, "project_id", "projectId", default="") or "")
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
        "projectId": _payload_get(payload_data, "project_id", "projectId", default=""),
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


def _assembly_item_video_value(item: dict[str, Any]) -> str:
    return str(
        item.get("video_api_path")
        or item.get("videoApiPath")
        or item.get("video_url")
        or item.get("videoUrl")
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
            "-preset", "veryfast",
            "-crf", "18",
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
            "-preset", "veryfast",
            "-crf", "18",
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
    }



def _assembly_scene_audio_volume_for_item(item: dict[str, Any], audio_mode: str, scene_volume: float) -> float:
    mode = str(audio_mode or "").lower()
    route = str((item or {}).get("route") or "").lower()

    if mode == "original_only":
        return 0.0

    uses_original = mode in {"original_plus_scene", "original_plus_music_scene"}
    is_lipsync = route in {"ia2v", "ia2v_lipsync", "lip_sync", "lipsync"}

    # Lip-sync / ia2v audio is only a driver for mouth movement.
    # If master/original audio is present, mute generated scene audio to avoid echo/lead/lag.
    if uses_original and is_lipsync:
        return 0.0

    return max(0.0, float(scene_volume))

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
        music_audio_path = _assembly_music_audio_path(payload)
        music_payload = payload.get("music") if isinstance(payload.get("music"), dict) else {}
        music_loop = bool(music_payload.get("loop", True))
        music_fade_out = bool(music_payload.get("fade_out", True))
        wants_original_audio = audio_mode in {"original_only", "original_plus_scene", "original_plus_music_scene"}
        wants_music_audio = audio_mode in {"music_plus_scene", "original_plus_music_scene"}
        width = _assembly_int(payload.get("width"), 1280)
        height = _assembly_int(payload.get("height"), 720)
        fps = _assembly_int(payload.get("fps"), 30)

        work_dir = Path(tempfile.gettempdir()) / f"ava_board_assembly_{job_id}"
        work_dir.mkdir(parents=True, exist_ok=True)

        normalized_paths: list[Path] = []
        prepared_items: list[dict[str, Any]] = []
        missing_items: list[dict[str, Any]] = []

        for index, item in enumerate(raw_items):
            if not isinstance(item, dict):
                continue

            scene_id = str(item.get("scene_id") or item.get("sceneId") or item.get("id") or f"scene_{index + 1}")
            video_value = _assembly_item_video_value(item)
            if not video_value:
                missing_items.append({"sceneId": scene_id, "reason": "missing_video_url"})
                if skip_missing:
                    continue
                raise HTTPException(status_code=400, detail={"code": "scene_missing_video", "sceneId": scene_id})

            try:
                source_path = _resolve_local_file(video_value)
            except HTTPException:
                if skip_missing:
                    missing_items.append({"sceneId": scene_id, "reason": "file_not_found", "video": video_value})
                    continue
                raise

            duration = _assembly_float(item.get("duration_sec") or item.get("durationSec"), 0.0)
            normalized_path = work_dir / f"{index + 1:04d}_{_safe_name(scene_id, 'scene')}.mp4"
            prepared = _normalize_assembly_clip(
                source_path,
                normalized_path,
                width=width,
                height=height,
                fps=fps,
                fallback_duration=duration,
                audio_volume=_assembly_scene_audio_volume_for_item(item, audio_mode, scene_volume),
            )
            prepared.update({
                "sceneId": scene_id,
                "index": index,
                "title": item.get("title") or scene_id,
                "route": item.get("route") or "",
            })
            normalized_paths.append(normalized_path)
            prepared_items.append(prepared)

        if not normalized_paths:
            raise HTTPException(status_code=400, detail={"code": "no_ready_videos_for_assembly", "missing": missing_items})

        concat_file = work_dir / "concat.txt"
        _write_concat_file(normalized_paths, concat_file)

        target_dir = _settings_static_path() / "assets" / "board_assembly"
        target_dir.mkdir(parents=True, exist_ok=True)
        scene_concat_path = work_dir / f"{job_id}_scene_concat.mp4"
        if wants_original_audio and original_audio_path and wants_music_audio and music_audio_path:
            suffix = "original_music_scene"
        elif wants_music_audio and music_audio_path:
            suffix = "music_scene"
        elif wants_original_audio and original_audio_path:
            suffix = "original_audio"
        else:
            suffix = "scene_audio_draft"
        out_path = target_dir / f"{job_id}_{suffix}.mp4"

        _run_ffmpeg([
            "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", str(concat_file),
            "-c", "copy",
            str(scene_concat_path),
        ])

        scene_concat_duration = _ffprobe_duration(scene_concat_path) or 0.0

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

        urls = _public_static_url(f"assets/board_assembly/{out_path.name}")
        final_duration = _ffprobe_duration(out_path)

        job.update({
            "status": "completed",
            "assembly_status": "ready",
            "audioMode": audio_mode,
            "supportedAudioMode": "music_original_scene_mix" if ((wants_original_audio and original_audio_path) or (wants_music_audio and music_audio_path)) else "scene_audio_concat_draft",
            "draftNote": "Music/original/scene audio mixed in." if ((wants_original_audio and original_audio_path) or (wants_music_audio and music_audio_path)) else "No original/music audio found; using scene audio from generated videos.",
            "originalAudioFound": bool(original_audio_path),
            "musicAudioFound": bool(music_audio_path),
            "sceneVolume": scene_volume,
            "originalVolume": original_volume,
            "musicVolume": music_volume,
            "watermarkRequested": watermark_requested,
            "watermarkApplied": watermark_applied,
            "watermarkError": watermark_error,
            "watermarkText": watermark_text if watermark_requested else "",
            "watermark": watermark_payload if watermark_requested else {},
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

    raw_items = payload_data.get("items") or payload_data.get("sceneItems") or []
    ready_count = 0
    if isinstance(raw_items, list):
        ready_count = sum(1 for item in raw_items if isinstance(item, dict) and _assembly_item_video_value(item))

    project_id_for_credit = str(payload_data.get("project_id") or payload_data.get("projectId") or "").strip()
    if project_id_for_credit:
        ensure_project_access(project_id_for_credit, user)

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
        "projectId": payload_data.get("project_id") or payload_data.get("projectId") or "",
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
        "format=auto:eof_action=repeat:enable='between(mod(t\\,16)\\,0\\,4)'[v1];"
        "[v1][wm1]overlay=18:18:"
        "format=auto:eof_action=repeat:enable='between(mod(t\\,16)\\,4\\,8)'[v2];"
        "[v2][wm2]overlay=18:main_h-overlay_h-18:"
        "format=auto:eof_action=repeat:enable='between(mod(t\\,16)\\,8\\,12)'[v3];"
        "[v3][wm3]overlay=main_w-overlay_w-18:main_h-overlay_h-18:"
        "format=auto:eof_action=repeat:enable='between(mod(t\\,16)\\,12\\,16)'[v]"
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
        "[0:v][wm0]overlay=main_w-overlay_w-18:18:format=auto:eof_action=repeat:enable='between(mod(t\\,16)\\,0\\,4)'[v1];"
        "[v1][wm1]overlay=18:18:format=auto:eof_action=repeat:enable='between(mod(t\\,16)\\,4\\,8)'[v2];"
        "[v2][wm2]overlay=18:main_h-overlay_h-18:format=auto:eof_action=repeat:enable='between(mod(t\\,16)\\,8\\,12)'[v3];"
        "[v3][wm3]overlay=main_w-overlay_w-18:main_h-overlay_h-18:format=auto:eof_action=repeat:enable='between(mod(t\\,16)\\,12\\,16)'[v]"
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
# Assembly now uses CRF 15 + preset fast for normalization and watermark burn-in.
# This is cleaner than CRF 18/veryfast, without going into huge lossless files.
# ---------------------------------------------------------------------

AVA_BOARD_ASSEMBLY_CRF = "15"
AVA_BOARD_ASSEMBLY_PRESET = "fast"


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
    # Final label [v] is always yuv420p to keep MP4 playable everywhere.
    return (
        "[1:v]format=rgba,split=4[wm0][wm1][wm2][wm3];"
        "[0:v][wm0]overlay=main_w-overlay_w-18:18:"
        "format=auto:eof_action=repeat:enable='between(mod(t\,16)\,0\,4)'[v1];"
        "[v1][wm1]overlay=18:18:"
        "format=auto:eof_action=repeat:enable='between(mod(t\,16)\,4\,8)'[v2];"
        "[v2][wm2]overlay=18:main_h-overlay_h-18:"
        "format=auto:eof_action=repeat:enable='between(mod(t\,16)\,8\,12)'[v3];"
        "[v3][wm3]overlay=main_w-overlay_w-18:main_h-overlay_h-18:"
        "format=auto:eof_action=repeat:enable='between(mod(t\,16)\,12\,16)'[ov];"
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
# Fixes the playable-yuv420p output while reducing color/quality loss:
# - keep yuv420p for browser/player compatibility;
# - use much cleaner CRF 12 for assembly/watermark re-encodes;
# - use Lanczos scaling;
# - write BT.709 color metadata explicitly for HD video;
# - keep dynamic watermark mode.
# ---------------------------------------------------------------------

AVA_BOARD_ASSEMBLY_CRF = "12"
AVA_BOARD_ASSEMBLY_PRESET = "fast"


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
        "-crf", globals().get("AVA_BOARD_ASSEMBLY_CRF", "12"),
        "-profile:v", "high",
        "-pix_fmt", "yuv420p",
        "-tune", "film",
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
    vf = (
        f"scale={width}:{height}:flags=lanczos:force_original_aspect_ratio=decrease,"
        f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,"
        f"setsar=1,"
        f"tpad=stop_mode=clone:stop_duration={target_duration:.6f},"
        f"trim=duration={target_duration:.6f},setpts=PTS-STARTPTS,"
        f"fps={fps},format=yuv420p"
    )

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
        "qualityCrf": globals().get("AVA_BOARD_ASSEMBLY_CRF", "12"),
        "qualityPreset": globals().get("AVA_BOARD_ASSEMBLY_PRESET", "fast"),
        "qualityColor": "bt709_yuv420p_lanczos",
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
        "format=auto:eof_action=repeat:enable='between(mod(t\\,16)\\,0\\,4)'[v1];"
        "[v1][wm1]overlay=18:18:"
        "format=auto:eof_action=repeat:enable='between(mod(t\\,16)\\,4\\,8)'[v2];"
        "[v2][wm2]overlay=18:main_h-overlay_h-18:"
        "format=auto:eof_action=repeat:enable='between(mod(t\\,16)\\,8\\,12)'[v3];"
        "[v3][wm3]overlay=main_w-overlay_w-18:main_h-overlay_h-18:"
        "format=auto:eof_action=repeat:enable='between(mod(t\\,16)\\,12\\,16)'[ov];"
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


