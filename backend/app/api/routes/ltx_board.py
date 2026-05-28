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

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.storage import store


router = APIRouter(tags=["ltx-board"])

APP_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = APP_DIR.parent
WORKFLOWS_DIR = APP_DIR / "workflows"
BACKEND_ENV_FILE = BACKEND_DIR / ".env"

BOARD_VIDEO_JOBS: dict[str, dict[str, Any]] = {}
BOARD_MMAUDIO_JOBS: dict[str, dict[str, Any]] = {}

WORKFLOW_ROUTE_MAP: dict[str, str] = {
    "i2v": "image-video.json",
    "i2v_text": "image-video.json",
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
    return {"ok": True, "videoRouteCreditCosts": VIDEO_ROUTE_CREDIT_COSTS, "mmaudioCreditCost": MMAUDIO_CREDIT_COST, "chargeMode": "not_charged_until_result_success"}


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
    source_value = payload.video_url or payload.videoUrl or payload.video_api_path or payload.videoApiPath or payload.video_path or payload.videoPath
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
def start_video(payload: VideoStartIn) -> dict[str, Any]:
    route = (payload.route or "i2v").strip() or "i2v"
    workflow_key = payload.workflow_key or payload.workflowKey or WORKFLOW_ROUTE_MAP.get(route) or WORKFLOW_ROUTE_MAP["i2v"]
    workflow_path = WORKFLOWS_DIR / workflow_key
    target_duration = _target_duration(payload)
    generation_duration = _generation_duration(route, target_duration)
    credit_cost = _video_credit_cost(route)
    job_id = f"boardjob_{uuid4().hex[:14]}"
    now = datetime.utcnow().isoformat() + "Z"
    main_url = _main_comfy_url()
    if not main_url:
        status = "blocked_missing_comfy_base_url"
        job = {"jobId": job_id, "status": status, "createdAt": now, "updatedAt": now, "sceneId": payload.scene_id or payload.sceneId, "route": route, "workflowKey": workflow_key, "workflowExists": workflow_path.exists(), "targetComfy": "main_ltx", "targetDurationSec": target_duration, "generationDurationSec": generation_duration, "trimToDurationSec": target_duration, "plusOneSecondApplied": generation_duration > target_duration, "creditCost": credit_cost, "creditCharged": False, "payload": payload.model_dump()}
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
    positive_prompt = payload.positive_prompt or payload.positivePrompt or payload.video_prompt or payload.videoPrompt or ""
    negative_prompt = payload.negative_prompt or payload.negativePrompt or ""
    width = int(payload.width or 1280)
    height = int(payload.height or 720)
    prompt, patches = _inject_workflow(workflow, positive_prompt=positive_prompt, negative_prompt=negative_prompt, width=width, height=height, target_duration=target_duration, generation_duration=generation_duration, uploaded_image=uploaded_image, uploaded_start=uploaded_start, uploaded_end=uploaded_end, uploaded_audio=uploaded_audio)
    submit_data = _submit_prompt(main_url, prompt)
    prompt_id = submit_data.get("prompt_id") or submit_data.get("promptId")
    status = "queued" if prompt_id else "queued_no_prompt_id"
    job = {"jobId": job_id, "status": status, "createdAt": now, "updatedAt": now, "sceneId": payload.scene_id or payload.sceneId, "projectId": payload.project_id or payload.projectId, "route": route, "workflowKey": workflow_key, "workflowExists": workflow_path.exists(), "targetComfy": "main_ltx", "targetComfyBaseUrl": main_url, "promptId": prompt_id, "promptSubmit": submit_data, "workflowPatches": patches, "uploadedMedia": {"image": uploaded_image, "start": uploaded_start, "end": uploaded_end, "audio": uploaded_audio}, "targetDurationSec": target_duration, "generationDurationSec": generation_duration, "trimToDurationSec": target_duration, "plusOneSecondApplied": generation_duration > target_duration, "comfyBaseUrlConfigured": True, "creditCost": credit_cost, "creditCharged": False, "creditChargeMode": "not_charged_until_result_success", "payload": payload.model_dump()}
    BOARD_VIDEO_JOBS[job_id] = job
    return {"ok": True, "jobId": job_id, "job_id": job_id, "status": status, "statusEndpoint": f"/api/clip/video/status/{job_id}", "promptId": prompt_id, "workflowKey": workflow_key, "workflowExists": workflow_path.exists(), "targetComfy": "main_ltx", "targetComfyBaseUrl": main_url, "targetDurationSec": target_duration, "generationDurationSec": generation_duration, "trimToDurationSec": target_duration, "plusOneSecondApplied": generation_duration > target_duration, "creditCost": credit_cost, "creditCharged": False, "workflowPatchCount": len(patches), "uploadedMedia": job["uploadedMedia"], "jobStored": True}



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

    return final


@router.get("/clip/video/status/{job_id}")
def video_status(job_id: str) -> dict[str, Any]:
    job = BOARD_VIDEO_JOBS.get(job_id)
    if not job:
        return {"ok": False, "status": "not_found", "code": "BOARD_VIDEO_JOB_NOT_FOUND", "jobId": job_id}

    if job.get("videoUrl") or job.get("video_url"):
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
                    job["creditCharged"] = False
                    job["creditChargeMode"] = "TODO_charge_after_completed_confirmed"
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

    return {"ok": True, **job}


@router.post("/clip/mmaudio/start")
def start_mmaudio(payload: MmaudioStartIn) -> dict[str, Any]:
    lab_url = _mmaudio_comfy_url()
    workflow_key = payload.workflow_key or payload.workflowKey or "mmaudio-sound-design.json"
    workflow_path = WORKFLOWS_DIR / workflow_key
    target_duration = _target_duration(payload)
    job_id = f"mmaudio_{uuid4().hex[:14]}"
    now = datetime.utcnow().isoformat() + "Z"
    status = "blocked_missing_comfy_mmaudio_url" if not lab_url else "queued_not_implemented"
    job = {"jobId": job_id, "status": status, "createdAt": now, "updatedAt": now, "sceneId": payload.scene_id or payload.sceneId, "projectId": payload.project_id or payload.projectId, "workflowKey": workflow_key, "workflowExists": workflow_path.exists(), "workflowPath": str(workflow_path), "targetComfy": "mmaudio_lab", "targetComfyBaseUrl": lab_url, "targetDurationSec": target_duration, "creditCost": MMAUDIO_CREDIT_COST, "creditCharged": False, "payload": payload.model_dump()}
    BOARD_MMAUDIO_JOBS[job_id] = job
    return {"ok": True, "jobId": job_id, "job_id": job_id, "status": status, "statusEndpoint": f"/api/clip/mmaudio/status/{job_id}", "workflowKey": workflow_key, "workflowExists": workflow_path.exists(), "targetComfy": "mmaudio_lab", "targetComfyBaseUrl": lab_url, "targetDurationSec": target_duration, "creditCost": MMAUDIO_CREDIT_COST, "creditCharged": False, "jobStored": True}


@router.get("/clip/mmaudio/status/{job_id}")
def mmaudio_status(job_id: str) -> dict[str, Any]:
    job = BOARD_MMAUDIO_JOBS.get(job_id)
    if not job:
        return {"ok": False, "status": "not_found", "code": "MMAUDIO_JOB_NOT_FOUND", "jobId": job_id}
    return {"ok": True, **job}
