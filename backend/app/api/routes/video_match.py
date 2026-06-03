from __future__ import annotations

import subprocess
import uuid
import os
import json
import urllib.parse
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.api.deps import get_current_user

router = APIRouter(prefix="/video-match")

VIDEO_MATCH_OUTPUTS_DIR = Path(__file__).resolve().parents[2] / "static" / "assets" / "video_match_outputs"
VIDEO_MATCH_OVERRIDES_DIR = Path(__file__).resolve().parents[2] / "static" / "assets" / "video_match_overrides"
VIDEO_MATCH_SOURCES_DIR = Path(__file__).resolve().parents[2] / "static" / "assets" / "video_match_sources"



VIDEO_MATCH_AUDIO_DIR = Path(__file__).resolve().parents[2] / "static" / "assets" / "video_match_audio"
# AVA_PATCH06_RESOLVE_BOARD_OVERRIDE_URL: allow Video Node assembly to use Board clips by /static URL when localPath is missing.
def _resolve_override_path_from_url(raw_url: str | None) -> Path | None:
    raw = str(raw_url or "").strip()
    if not raw:
        return None
    try:
        parsed = urllib.parse.urlparse(raw)
        url_path = urllib.parse.unquote(parsed.path if parsed.scheme else raw)
    except Exception:
        url_path = raw
    if not url_path:
        return None
    if url_path.startswith("/api/video-match/override/"):
        filename = Path(url_path).name
        candidate = VIDEO_MATCH_OVERRIDES_DIR / filename
        return candidate if candidate.is_file() else candidate
    if url_path.startswith("/static/"):
        static_root = Path(__file__).resolve().parents[2] / "static"
        rel = url_path[len("/static/"):].lstrip("/")
        candidate = static_root / rel
        return candidate if candidate.is_file() else candidate
    return None


class VideoMatchBlock(BaseModel):
    id: str
    audioSceneId: str | None = None
    sourceVideoId: str | None = None
    source_video_id: str | None = None
    sourceVideoPath: str | None = None
    source_video_path: str | None = None
    sourceVideoUrl: str | None = None
    source_video_url: str | None = None
    targetStartSec: float = 0
    targetEndSec: float = 0
    sourceVideoStartSec: float = 0
    sourceVideoEndSec: float = 0
    overrideVideoPath: str | None = None
    overrideVideoUrl: str | None = None
    candidateType: str | None = None
    sourceKind: str | None = None
    requiresOverrideVideo: bool = False
    reservedPlaceholder: bool = False
    reservedGeneratedLipsync: bool = False
    forceMuteVideoAudio: bool = False
    force_mute_video_audio: bool = False
    originalVideoVolume: float | None = None
    original_video_volume: float | None = None


class VideoMatchAudioMix(BaseModel):
    originalVideoVolume: float | None = None
    backgroundAudioPath: str | None = None
    background_audio_path: str | None = None
    backgroundAudioVolume: float | None = None
    background_audio_volume: float | None = None
    backgroundAudioFilename: str | None = None
    background_audio_filename: str | None = None


class VideoMatchSourceVideo(BaseModel):
    id: str | None = None
    sourceVideoId: str | None = None
    source_video_id: str | None = None
    path: str | None = None
    backendPath: str | None = None
    backend_path: str | None = None
    sourceVideoPath: str | None = None
    source_video_path: str | None = None
    sourceVideoPathForAssembly: str | None = None
    source_video_path_for_assembly: str | None = None
    sourceVideoUrl: str | None = None
    source_video_url: str | None = None
    previewUrl: str | None = None
    preview_url: str | None = None
    url: str | None = None
    filename: str | None = None


class AssembleVideoMatchRequest(BaseModel):
    sourceVideoPath: str = ""
    sourceVideos: list[VideoMatchSourceVideo] = Field(default_factory=list)
    source_videos: list[VideoMatchSourceVideo] = Field(default_factory=list)
    includeAudio: bool = False
    includeBackgroundAudio: bool = False
    include_background_audio: bool = False
    audioPath: str | None = None
    audioUrl: str | None = None
    outputFormat: Literal["16:9"] = "16:9"
    previewQuality: Literal["720p"] = "720p"
    audioMix: VideoMatchAudioMix | None = None
    blocks: list[VideoMatchBlock] = Field(default_factory=list)


def _source_video_id_from_model(item: VideoMatchSourceVideo) -> str:
    return str(item.id or item.sourceVideoId or item.source_video_id or "").strip()


def _source_video_path_from_model(item: VideoMatchSourceVideo) -> str:
    return str(
        item.sourceVideoPathForAssembly
        or item.source_video_path_for_assembly
        or item.backendPath
        or item.backend_path
        or item.path
        or item.sourceVideoPath
        or item.source_video_path
        or item.sourceVideoUrl
        or item.source_video_url
        or item.previewUrl
        or item.preview_url
        or item.url
        or ""
    ).strip()


def _resolve_source_path_from_url(raw_url: str | None) -> Path | None:
    raw = str(raw_url or "").strip()
    if not raw:
        return None
    try:
        parsed = urllib.parse.urlparse(raw)
        url_path = urllib.parse.unquote(parsed.path if parsed.scheme else raw)
    except Exception:
        url_path = raw
    if not url_path:
        return None
    if url_path.startswith("/api/video-match/source/"):
        filename = Path(url_path).name
        candidate = VIDEO_MATCH_SOURCES_DIR / filename
        return candidate if candidate.is_file() else candidate
    if url_path.startswith("/static/"):
        static_root = Path(__file__).resolve().parents[2] / "static"
        rel = url_path[len("/static/"):].lstrip("/")
        candidate = static_root / rel
        return candidate if candidate.is_file() else candidate
    return None


def _video_match_safe_float_18aa(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def _video_match_block_duration_18aa(block) -> float:
    target_start = _video_match_safe_float_18aa(getattr(block, "targetStartSec", 0.0), 0.0)
    target_end = _video_match_safe_float_18aa(getattr(block, "targetEndSec", 0.0), 0.0)
    duration = max(0.0, target_end - target_start)
    if duration > 0.0:
        return duration

    source_start = _video_match_safe_float_18aa(getattr(block, "sourceVideoStartSec", 0.0), 0.0)
    source_end = _video_match_safe_float_18aa(getattr(block, "sourceVideoEndSec", 0.0), 0.0)
    return max(0.0, source_end - source_start)


def _run_ffmpeg(cmd: list[str]) -> None:
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail="ffmpeg_not_found") from exc
    except subprocess.CalledProcessError as exc:
        raise HTTPException(status_code=400, detail={"code": "ffmpeg_failed", "message": exc.stderr[-1200:]}) from exc


def _probe_duration_sec(path: Path) -> float:
    try:
        proc = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        return max(0.0, float((proc.stdout or "0").strip() or 0))
    except Exception:
        return 0.0


def _probe_video_stream_meta(path: Path) -> dict:
    try:
        proc = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=width,height,r_frame_rate,avg_frame_rate",
                "-show_entries",
                "format=duration",
                "-of",
                "json",
                str(path),
            ],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        import json
        payload = json.loads(proc.stdout or "{}")
        stream = (payload.get("streams") or [{}])[0]
        width = int(stream.get("width") or 0)
        height = int(stream.get("height") or 0)
        fps_raw = str(stream.get("avg_frame_rate") or stream.get("r_frame_rate") or "0/1").strip()
        fps_num = 0.0
        if "/" in fps_raw:
            n_str, d_str = fps_raw.split("/", 1)
            n_val = float(n_str or 0)
            d_val = float(d_str or 1)
            if d_val != 0:
                fps_num = n_val / d_val
        else:
            fps_num = float(fps_raw or 0)
        return {
            "width": max(0, width),
            "height": max(0, height),
            "fps": round(max(0.0, fps_num), 3),
            "duration_sec": round(float(_probe_duration_sec(path) or 0), 3),
        }
    except Exception:
        return {"width": 0, "height": 0, "fps": 0, "duration_sec": round(float(_probe_duration_sec(path) or 0), 3)}


def _probe_has_audio_stream(path: Path) -> bool:
    try:
        proc = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", str(path)],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        return bool(str(proc.stdout or "").strip())
    except Exception:
        return False


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _json_safe_float(value: float, digits: int = 6) -> float:
    try:
        if value != value or value in (float("inf"), float("-inf")):
            return 0.0
        return round(float(value), digits)
    except Exception:
        return 0.0


@router.get("/output/{filename}")
async def get_video_match_output(filename: str, download: bool = Query(default=False)):
    safe_name = Path(filename).name
    if safe_name != filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail={"code": "invalid_filename"})
    output_path = VIDEO_MATCH_OUTPUTS_DIR / safe_name
    if not output_path.is_file():
        raise HTTPException(status_code=404, detail={"code": "output_not_found", "message": safe_name})
    media_type = "application/json" if safe_name.lower().endswith(".json") else "video/mp4"
    if download:
        return FileResponse(output_path, media_type=media_type, filename=safe_name)
    # Inline preview: no filename -> no attachment Content-Disposition.
    return FileResponse(output_path, media_type=media_type)


@router.get("/override/{filename}")
async def get_video_match_override(filename: str):
    safe_name = Path(filename).name
    if safe_name != filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail={"code": "invalid_filename"})
    path = VIDEO_MATCH_OVERRIDES_DIR / safe_name
    if not path.is_file():
        raise HTTPException(status_code=404, detail={"code": "override_not_found"})
    return FileResponse(path, media_type="video/mp4", filename=safe_name)


@router.post("/override-upload")
async def upload_video_match_override(
    file: UploadFile = File(...),
    nodeId: str | None = Form(default=None),
    segmentId: str | None = Form(default=None),
    candidateType: str = Form(default="user_override"),
    _user=Depends(get_current_user),
):
    _ = (nodeId, segmentId)
    original_name = str(file.filename or "override.mp4").strip() or "override.mp4"
    suffix = Path(original_name).suffix.lower()
    allowed_ext = {".mp4", ".mov", ".webm", ".mkv"}
    content_type = str(file.content_type or "").lower()
    if not (content_type.startswith("video/") or suffix in allowed_ext):
        raise HTTPException(status_code=400, detail={"code": "invalid_override_type"})
    safe_ext = suffix if suffix in allowed_ext else ".mp4"
    VIDEO_MATCH_OVERRIDES_DIR.mkdir(parents=True, exist_ok=True)
    stored_filename = f"video_match_override_{uuid.uuid4().hex}{safe_ext}"
    stored_path = VIDEO_MATCH_OVERRIDES_DIR / stored_filename
    data = await file.read()
    stored_path.write_bytes(data)
    duration_sec = _probe_duration_sec(stored_path)
    return {
        "ok": True,
        "candidateType": candidateType,
        "overrideVideoPath": str(stored_path),
        "overrideVideoUrl": f"/api/video-match/override/{stored_filename}",
        "filename": original_name,
        "storedFilename": stored_filename,
        "durationSec": round(float(duration_sec or 0), 3),
    }


@router.post("/source-upload")
async def upload_video_match_source(
    file: UploadFile = File(...),
    nodeId: str | None = Form(default=None),
    _user=Depends(get_current_user),
):
    _ = nodeId
    original_name = str(file.filename or "source.mp4").strip() or "source.mp4"
    suffix = Path(original_name).suffix.lower()
    allowed_ext = {".mp4", ".mov", ".webm", ".mkv", ".m4v"}
    content_type = str(file.content_type or "").lower()
    if not (content_type.startswith("video/") or suffix in allowed_ext):
        raise HTTPException(status_code=400, detail={"code": "invalid_source_video_type"})
    safe_ext = suffix if suffix in allowed_ext else ".mp4"
    VIDEO_MATCH_SOURCES_DIR.mkdir(parents=True, exist_ok=True)
    stored_filename = f"video_match_source_{uuid.uuid4().hex}{safe_ext}"
    stored_path = VIDEO_MATCH_SOURCES_DIR / stored_filename
    with stored_path.open("wb") as out:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)
    meta = _probe_video_stream_meta(stored_path)
    return {
        "ok": True,
        "sourceVideoUrl": f"/api/video-match/source/{stored_filename}",
        "sourceVideoPathForAssembly": str(stored_path),
        "filename": original_name,
        "duration_sec": meta.get("duration_sec", 0),
        "width": meta.get("width", 0),
        "height": meta.get("height", 0),
        "fps": meta.get("fps", 0),
        "has_audio_stream": _probe_has_audio_stream(stored_path),
    }


@router.get("/source/{filename}")
async def get_video_match_source(filename: str):
    safe_name = Path(filename).name
    if safe_name != filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail={"code": "invalid_filename"})
    path = VIDEO_MATCH_SOURCES_DIR / safe_name
    if not path.is_file():
        raise HTTPException(status_code=404, detail={"code": "source_not_found"})
    return FileResponse(path, media_type="video/mp4", filename=safe_name)




@router.get("/audio/{filename}")
async def get_video_match_audio(filename: str):
    safe_name = Path(filename).name
    if safe_name != filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail={"code": "invalid_filename"})
    path = VIDEO_MATCH_AUDIO_DIR / safe_name
    if not path.is_file():
        raise HTTPException(status_code=404, detail={"code": "audio_not_found"})
    media_type = "audio/mpeg"
    suffix = path.suffix.lower()
    if suffix == ".wav":
        media_type = "audio/wav"
    elif suffix == ".m4a":
        media_type = "audio/mp4"
    elif suffix == ".aac":
        media_type = "audio/aac"
    elif suffix == ".flac":
        media_type = "audio/flac"
    elif suffix == ".ogg":
        media_type = "audio/ogg"
    return FileResponse(path, media_type=media_type, filename=safe_name)


@router.post("/audio-upload")
async def upload_video_match_audio(
    file: UploadFile = File(...),
    nodeId: str | None = Form(default=None),
    _user=Depends(get_current_user),
):
    _ = nodeId
    original_name = str(file.filename or "audio.mp3").strip() or "audio.mp3"
    suffix = Path(original_name).suffix.lower()
    allowed_ext = {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"}
    content_type = str(file.content_type or "").lower()
    if not (content_type.startswith("audio/") or suffix in allowed_ext):
        raise HTTPException(status_code=400, detail={"code": "invalid_audio_type"})
    safe_ext = suffix if suffix in allowed_ext else ".mp3"
    VIDEO_MATCH_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    stored_filename = f"video_match_audio_{uuid.uuid4().hex}{safe_ext}"
    stored_path = VIDEO_MATCH_AUDIO_DIR / stored_filename
    with stored_path.open("wb") as out:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)
    duration_sec = _probe_duration_sec(stored_path)
    return {
        "ok": True,
        "audioPathForAssembly": str(stored_path),
        "audioPath": str(stored_path),
        "audioUrl": f"/api/video-match/audio/{stored_filename}",
        "filename": original_name,
        "storedFilename": stored_filename,
        "durationSec": round(float(duration_sec or 0), 3),
        "duration_sec": round(float(duration_sec or 0), 3),
    }


@router.post("/assemble")
async def assemble_video_match_preview(payload: AssembleVideoMatchRequest = Body(...), _user=Depends(get_current_user)):
    raw_source_path = str(payload.sourceVideoPath or "").strip()
    source_path = Path(raw_source_path).expanduser() if raw_source_path else None

    source_path_by_id: dict[str, Path] = {}
    for item in list(payload.sourceVideos or []) + list(payload.source_videos or []):
        source_id = _source_video_id_from_model(item)
        source_path_raw = _source_video_path_from_model(item)
        if source_id and source_path_raw:
            candidate = Path(source_path_raw).expanduser()
            if not candidate.is_file():
                resolved_candidate = _resolve_source_path_from_url(source_path_raw)
                if resolved_candidate:
                    candidate = resolved_candidate
            if candidate.is_file():
                source_path_by_id[source_id] = candidate

    if (not source_path or not source_path.is_file()) and source_path_by_id:
        source_path = next(iter(source_path_by_id.values()))

    if not source_path or not source_path.is_file():
        raise HTTPException(status_code=400, detail={
            "code": "source_video_not_found",
            "message": raw_source_path or "no sourceVideoPath/sourceVideos[].path",
            "sourceVideoIds": sorted(source_path_by_id.keys()),
        })

    blocks = sorted(payload.blocks, key=lambda item: float(item.targetStartSec or 0))
    # PATCH18AB_BACKGROUND_ENABLED_DEFAULTS: background music for final MP4.
    background_audio_path_raw = str(
        (payload.audioMix.backgroundAudioPath if payload.audioMix else "")
        or (payload.audioMix.background_audio_path if payload.audioMix else "")
        or ""
    ).strip()
    background_audio_input = Path(background_audio_path_raw).expanduser() if background_audio_path_raw else None
    background_audio_volume_raw = (
        payload.audioMix.backgroundAudioVolume if payload.audioMix and payload.audioMix.backgroundAudioVolume is not None
        else (payload.audioMix.background_audio_volume if payload.audioMix and payload.audioMix.background_audio_volume is not None else 0.6)
    )
    background_audio_volume = max(0.0, min(1.0, float(background_audio_volume_raw or 0.0)))
    include_background_audio_requested = bool(
        getattr(payload, "includeBackgroundAudio", False)
        or getattr(payload, "include_background_audio", False)
    )
    has_background_audio = False
    if include_background_audio_requested:
        if not background_audio_path_raw:
            has_background_audio = False
        elif not (background_audio_input and background_audio_input.is_file()):
            print(f"[video_match] background audio skipped: not found: {background_audio_path_raw}")
            has_background_audio = False
        else:
            has_background_audio = background_audio_volume > 0.0

    # PATCH18Y_BACKGROUND_DEFAULTS: safe background-audio defaults for MP4 assembly.
    background_audio_path_raw = str(
        (payload.audioMix.backgroundAudioPath if payload.audioMix else "")
        or (payload.audioMix.background_audio_path if payload.audioMix else "")
        or ""
    ).strip()
    background_audio_input = Path(background_audio_path_raw).expanduser() if background_audio_path_raw else None
    background_audio_volume_raw = (
        payload.audioMix.backgroundAudioVolume if payload.audioMix and payload.audioMix.backgroundAudioVolume is not None
        else (payload.audioMix.background_audio_volume if payload.audioMix and payload.audioMix.background_audio_volume is not None else 0.0)
    )
    background_audio_volume = max(0.0, min(1.0, float(background_audio_volume_raw or 0.0)))
    include_background_audio_requested = bool(
        getattr(payload, "includeBackgroundAudio", False)
        or getattr(payload, "include_background_audio", False)
    )
    has_background_audio = False
    if background_audio_path_raw:
        if not (background_audio_input and background_audio_input.is_file()):
            raise HTTPException(status_code=400, detail={
                "code": "BACKGROUND_AUDIO_NOT_FOUND",
                "message": "Фоновый аудиофайл не найден. Загрузите фон заново.",
                "path": background_audio_path_raw,
            })
        has_background_audio = False

    if not blocks:
        raise HTTPException(status_code=400, detail={"code": "blocks_empty", "message": "No video blocks provided"})

    VIDEO_MATCH_OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    job_id = uuid.uuid4().hex[:12]
    work_dir = VIDEO_MATCH_OUTPUTS_DIR / f"tmp_{job_id}"
    work_dir.mkdir(parents=True, exist_ok=True)

    OUTPUT_FPS = 30.0
    FRAME_EPS = 1.0 / OUTPUT_FPS

    try:
        clip_paths: list[Path] = []
        warnings: list[str] = []
        assembly_manifest: list[dict] = []
        override_used_count = 0
        global_video_volume_raw = payload.audioMix.originalVideoVolume if payload.audioMix else None
        global_video_volume = max(0.0, min(1.0, float(global_video_volume_raw if global_video_volume_raw is not None else 0.10)))
        expected_timeline_end = max(float(block.targetEndSec or 0) for block in blocks)
        cumulative_frames = 0

        for idx, block in enumerate(blocks):
            block_id = str(block.id or block.audioSceneId or f"block_{idx:04d}")
            scene_id = str(block.audioSceneId or block.id or f"seg_{idx + 1:02d}")
            target_start = max(0.0, float(block.targetStartSec or 0))
            target_end = max(target_start + 0.01, float(block.targetEndSec or 0))
            target_duration = max(0.01, target_end - target_start)

            # Lock scene boundaries to the global output frame grid. This avoids per-clip frame rounding drift.
            target_frame_start = int(round(target_start * OUTPUT_FPS))
            target_frame_end = int(round(target_end * OUTPUT_FPS))
            if target_frame_end <= target_frame_start:
                target_frame_end = target_frame_start + 1
            target_frame_count = max(1, target_frame_end - target_frame_start)
            render_duration = target_frame_count / OUTPUT_FPS

            override_path = Path(str(block.overrideVideoPath or "")).expanduser() if block.overrideVideoPath else _resolve_override_path_from_url(block.overrideVideoUrl)
            block_source_id = str(block.sourceVideoId or block.source_video_id or "").strip()
            block_source_path_raw = str(block.sourceVideoPath or block.source_video_path or "").strip()
            source_for_clip = source_path_by_id.get(block_source_id) or source_path
            block_source_url_raw = str(getattr(block, "sourceVideoUrl", None) or getattr(block, "source_video_url", None) or "").strip()
            if block_source_path_raw:
                candidate_source_for_clip = Path(block_source_path_raw).expanduser()
                if not candidate_source_for_clip.is_file():
                    resolved_candidate = _resolve_source_path_from_url(block_source_path_raw)
                    if resolved_candidate:
                        candidate_source_for_clip = resolved_candidate
                if candidate_source_for_clip.is_file():
                    source_for_clip = candidate_source_for_clip
            if (not source_for_clip or not source_for_clip.is_file()) and block_source_url_raw:
                resolved_candidate = _resolve_source_path_from_url(block_source_url_raw)
                if resolved_candidate and resolved_candidate.is_file():
                    source_for_clip = resolved_candidate
            if not source_for_clip or not source_for_clip.is_file():
                raise HTTPException(status_code=400, detail={
                    "code": "source_video_not_found_for_block",
                    "message": f"Missing source video for block {block.id}",
                    "blockSourceVideoId": block_source_id,
                    "blockSourceVideoPath": block_source_path_raw,
                })
            start = max(0.0, float(block.sourceVideoStartSec or 0))
            end = max(start, float(block.sourceVideoEndSec or start))
            source_kind = str(block.sourceKind or "").lower()
            candidate_type = str(block.candidateType or "").lower()
            is_reserved_placeholder = (
                block.requiresOverrideVideo
                or block.reservedPlaceholder
                or source_kind in {"reserved_intro", "reserved_generated_lipsync"}
                or candidate_type == "generated_lipsync_insert"
            )
            has_override = bool(override_path)
            if is_reserved_placeholder and not has_override:
                raise HTTPException(status_code=400, detail={"code": "MISSING_RESERVED_OVERRIDE_VIDEO", "message": f"Reserved scene requires uploaded video: {block.id or block.audioSceneId}"})
            if (not has_override) and float(block.sourceVideoEndSec or 0) <= float(block.sourceVideoStartSec or 0) + 0.05:
                raise HTTPException(status_code=400, detail={"code": "INVALID_SOURCE_RANGE", "message": f"Invalid source range for block {block.id}: {block.sourceVideoStartSec}-{block.sourceVideoEndSec}"})

            override_duration = 0.0
            input_duration = 0.0
            input_available_duration = max(0.01, end - start)
            if override_path:
                if override_path.is_file():
                    override_used_count += 1
                    source_for_clip = override_path
                    start = 0.0
                    override_duration = _probe_duration_sec(override_path)
                    input_available_duration = max(0.01, override_duration if override_duration > 0 else render_duration)
                    if override_duration > 0 and override_duration + FRAME_EPS < target_duration:
                        warnings.append(f"override_shorter_than_target:{block_id}:input={override_duration:.3f}:target={target_duration:.3f}")
                    if override_duration > 0 and override_duration > target_duration + FRAME_EPS:
                        warnings.append(f"override_trimmed_to_target:{block_id}:input={override_duration:.3f}:target={target_duration:.3f}")
                else:
                    warnings.append(f"override_video_missing:{block_id}")
            else:
                source_meta_duration = _probe_duration_sec(source_for_clip)
                if source_meta_duration > 0:
                    input_available_duration = max(0.01, min(max(0.0, source_meta_duration - start), max(0.01, end - start)))

            input_duration = input_available_duration
            pad_duration = max(0.0, render_duration - input_available_duration)
            read_duration = max(0.01, min(render_duration, input_available_duration if input_available_duration > 0 else render_duration))

            clip_path = work_dir / f"clip_{idx:04d}.mp4"
            block_volume = block.originalVideoVolume if block.originalVideoVolume is not None else block.original_video_volume
            force_mute_video_audio = bool(block.forceMuteVideoAudio or block.force_mute_video_audio)
            if force_mute_video_audio:
                block_volume = 0.0
            block_volume = max(0.0, min(1.0, float(block_volume if block_volume is not None else global_video_volume)))

            source_has_audio = _probe_has_audio_stream(source_for_clip)
            video_filter = (
                f"scale=1280:720:force_original_aspect_ratio=decrease,"
                f"pad=1280:720:(ow-iw)/2:(oh-ih)/2,"
                f"fps={OUTPUT_FPS:.0f},"
                f"tpad=stop_mode=clone:stop_duration={pad_duration:.6f},"
                f"trim=duration={render_duration:.6f},setpts=PTS-STARTPTS"
            )
            if source_has_audio:
                _run_ffmpeg([
                    "ffmpeg", "-y", "-ss", f"{start:.6f}", "-i", str(source_for_clip), "-t", f"{read_duration:.6f}",
                    "-filter_complex",
                    f"[0:v]{video_filter}[v];[0:a]volume={block_volume:.4f},apad,atrim=duration={render_duration:.6f},asetpts=PTS-STARTPTS[a]",
                    "-map", "[v]", "-map", "[a]",
                    "-pix_fmt", "yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                    "-r", f"{OUTPUT_FPS:.0f}", "-fps_mode", "cfr", "-video_track_timescale", "30000",
                    "-c:a", "aac", "-ar", "48000", "-ac", "2", str(clip_path),
                ])
            else:
                _run_ffmpeg([
                    "ffmpeg", "-y", "-ss", f"{start:.6f}", "-i", str(source_for_clip), "-t", f"{read_duration:.6f}",
                    "-f", "lavfi", "-t", f"{render_duration:.6f}", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
                    "-filter_complex", f"[0:v]{video_filter}[v];[1:a]atrim=duration={render_duration:.6f},asetpts=PTS-STARTPTS[a]",
                    "-map", "[v]", "-map", "[a]",
                    "-pix_fmt", "yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                    "-r", f"{OUTPUT_FPS:.0f}", "-fps_mode", "cfr", "-video_track_timescale", "30000",
                    "-c:a", "aac", "-ar", "48000", "-ac", "2", str(clip_path),
                ])

            actual_clip_duration = _probe_duration_sec(clip_path)
            if abs(actual_clip_duration - render_duration) > 0.045:
                warnings.append(f"duration_mismatch:{block_id}:target_frame={render_duration:.3f}:actual={actual_clip_duration:.3f}")
            output_start_frame_sec = cumulative_frames / OUTPUT_FPS
            cumulative_frames += target_frame_count
            output_end_frame_sec = cumulative_frames / OUTPUT_FPS
            assembly_manifest.append({
                "index": idx,
                "id": block_id,
                "sceneId": scene_id,
                "targetStartSec": _json_safe_float(target_start, 3),
                "targetEndSec": _json_safe_float(target_end, 3),
                "targetDurationSec": _json_safe_float(target_duration, 3),
                "targetFrameStart": target_frame_start,
                "targetFrameEnd": target_frame_end,
                "targetFrameCount": target_frame_count,
                "targetFrameDurationSec": _json_safe_float(render_duration, 6),
                "outputStartSec": _json_safe_float(output_start_frame_sec, 6),
                "outputEndSec": _json_safe_float(output_end_frame_sec, 6),
                "sourceVideoId": str(block.sourceVideoId or block.source_video_id or ""),
                "sourcePath": str(source_for_clip),
                "sourceKind": block.sourceKind or "",
                "candidateType": block.candidateType or "",
                "overrideUsed": bool(override_path and override_path.is_file()),
                "overrideDurationSec": _json_safe_float(override_duration, 6),
                "inputDurationSec": _json_safe_float(input_duration, 6),
                "sourceStartSec": _json_safe_float(start, 6),
                "sourceReadDurationSec": _json_safe_float(read_duration, 6),
                "padDurationSec": _json_safe_float(pad_duration, 6),
                "actualClipDurationSec": _json_safe_float(actual_clip_duration, 6),
                "forceMuteVideoAudio": force_mute_video_audio,
                "originalVideoVolume": _json_safe_float(block_volume, 4),
            })
            clip_paths.append(clip_path)

        concat_list = work_dir / "concat.txt"
        concat_list.write_text("\n".join(f"file '{p.as_posix()}'" for p in clip_paths), encoding="utf-8")
        merged_video = work_dir / "merged_video.mp4"
        _run_ffmpeg([
            "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_list),
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-r", f"{OUTPUT_FPS:.0f}", "-fps_mode", "cfr",
            "-video_track_timescale", "30000", "-c:a", "aac", "-ar", "48000", "-ac", "2", str(merged_video)
        ])

        output_name = f"video_match_preview_{job_id}.mp4"
        output_path = VIDEO_MATCH_OUTPUTS_DIR / output_name
        audio_path_raw = str(payload.audioPath or "").strip()
        audio_input = Path(audio_path_raw).expanduser() if audio_path_raw else None
        audio_ext_allowed = {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"}
        has_audio = False
        if payload.includeAudio:
            if not audio_path_raw:
                raise HTTPException(status_code=400, detail={"code": "AUDIO_PATH_REQUIRED", "message": "Для сборки с аудио укажите путь к файлу"})
            audio_suffix = str(audio_input.suffix or "").lower() if audio_input else ""
            if audio_suffix not in audio_ext_allowed:
                raise HTTPException(status_code=400, detail={"code": "AUDIO_PATH_INVALID_EXT", "message": "Неподдерживаемый формат аудио"})
            if not (audio_input and audio_input.is_file()):
                raise HTTPException(status_code=400, detail={"code": "AUDIO_PATH_NOT_FOUND", "message": "Аудиофайл не найден по указанному пути"})
            if not os.access(audio_input, os.R_OK):
                raise HTTPException(status_code=400, detail={"code": "AUDIO_PATH_NOT_FOUND", "message": "Аудиофайл не найден по указанному пути"})
            has_audio = True
        else:
            # Строго игнорируем audioPath, если includeAudio=false.
            audio_input = None

        background_audio_path_raw = str(
            (payload.audioMix.backgroundAudioPath if payload.audioMix else "")
            or (payload.audioMix.background_audio_path if payload.audioMix else "")
            or ""
        ).strip()
        background_audio_input = Path(background_audio_path_raw).expanduser() if background_audio_path_raw else None
        background_audio_volume_raw = (
            payload.audioMix.backgroundAudioVolume if payload.audioMix and payload.audioMix.backgroundAudioVolume is not None
            else (payload.audioMix.background_audio_volume if payload.audioMix and payload.audioMix.background_audio_volume is not None else 0.0)
        )
        background_audio_volume = max(0.0, min(1.0, float(background_audio_volume_raw or 0.0)))
        # has_background_audio preserved from PATCH18AB defaults
        if background_audio_path_raw:
            bg_suffix = str(background_audio_input.suffix or "").lower() if background_audio_input else ""
            if bg_suffix not in audio_ext_allowed:
                raise HTTPException(status_code=400, detail={"code": "BACKGROUND_AUDIO_INVALID_EXT", "message": "Неподдерживаемый формат фонового аудио"})
            if not (background_audio_input and background_audio_input.is_file()):
                print(f"[video_match] background audio skipped: not found: {background_audio_path_raw}")
            has_background_audio = False
            if not os.access(background_audio_input, os.R_OK):
                print(f"[video_match] background audio skipped: not found: {background_audio_path_raw}")
            has_background_audio = False
            has_background_audio = False

        # PATCH18AA_DURATION_EXPECTED_READY: required by audio/background mux filters.
        duration_expected_frame_sec = sum(_video_match_block_duration_18aa(block) for block in blocks)
        if duration_expected_frame_sec <= 0.0:
            duration_expected_frame_sec = max(0.1, _video_match_safe_float_18aa(_probe_duration_sec(merged_video), 0.1))


        if has_audio or has_background_audio:
            merged_has_audio = _probe_has_audio_stream(merged_video)
            audio_inputs = ["-i", str(merged_video)]
            filter_parts: list[str] = []
            mix_labels: list[str] = []

            if merged_has_audio:
                filter_parts.append("[0:a]volume=1.0[a0]")
                mix_labels.append("[a0]")

            next_input_index = 1
            if has_audio:
                audio_inputs += ["-i", str(audio_input)]
                filter_parts.append(f"[{next_input_index}:a]volume=1.0,atrim=duration={duration_expected_frame_sec:.6f},asetpts=PTS-STARTPTS[a{next_input_index}]")
                mix_labels.append(f"[a{next_input_index}]")
                next_input_index += 1

            if has_background_audio:
                audio_inputs += ["-stream_loop", "-1", "-i", str(background_audio_input)]
                filter_parts.append(f"[{next_input_index}:a]volume={background_audio_volume:.4f},atrim=duration={duration_expected_frame_sec:.6f},asetpts=PTS-STARTPTS[a{next_input_index}]")
                mix_labels.append(f"[a{next_input_index}]")
                next_input_index += 1

            if not mix_labels:
                _run_ffmpeg(["ffmpeg", "-y", "-i", str(merged_video), "-c", "copy", str(output_path)])
            else:
                filter_complex = ";".join(filter_parts) + ";" + "".join(mix_labels) + f"amix=inputs={len(mix_labels)}:duration=first:dropout_transition=0:normalize=0[aout]"
                _run_ffmpeg([
                    "ffmpeg", "-y", *audio_inputs,
                    "-filter_complex", filter_complex,
                    "-map", "0:v:0", "-map", "[aout]",
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                    "-r", f"{OUTPUT_FPS:.0f}", "-fps_mode", "cfr", "-video_track_timescale", "30000",
                    "-c:a", "aac", "-ar", "48000", "-ac", "2", "-shortest", str(output_path),
                ])
        else:
            _run_ffmpeg(["ffmpeg", "-y", "-i", str(merged_video), "-c", "copy", str(output_path)])

        duration_sec = _probe_duration_sec(output_path)
        duration_expected_frame_sec = cumulative_frames / OUTPUT_FPS
        duration_drift_sec = duration_sec - duration_expected_frame_sec
        manifest_name = f"video_match_manifest_{job_id}.json"
        manifest_path = VIDEO_MATCH_OUTPUTS_DIR / manifest_name
        manifest_payload = {
            "ok": True,
            "output": output_name,
            "fps": OUTPUT_FPS,
            "durationExpectedSec": _json_safe_float(expected_timeline_end, 6),
            "durationExpectedFrameSec": _json_safe_float(duration_expected_frame_sec, 6),
            "durationActualSec": _json_safe_float(duration_sec, 6),
            "durationDriftSec": _json_safe_float(duration_drift_sec, 6),
            "audioUsed": has_audio,
            "backgroundAudioUsed": has_background_audio,
            "backgroundAudioVolume": _json_safe_float(background_audio_volume, 4),
            "overrideUsedCount": override_used_count,
            "blocks": assembly_manifest,
            "warnings": warnings,
        }
        manifest_path.write_text(json.dumps(manifest_payload, ensure_ascii=False, indent=2), encoding="utf-8")
        if abs(duration_drift_sec) > 0.10:
            warnings.append(f"final_duration_drift:expected_frame={duration_expected_frame_sec:.3f}:actual={duration_sec:.3f}")

        result = {
            "ok": True,
            "outputUrl": f"/api/video-match/output/{output_name}",
            "outputPath": str(output_path),
            "durationSec": round(duration_sec, 3),
            "durationExpectedSec": round(expected_timeline_end, 3),
            "durationExpectedFrameSec": round(duration_expected_frame_sec, 3),
            "durationActualSec": round(duration_sec, 3),
            "durationDriftSec": round(duration_drift_sec, 3),
            "audioUsed": has_audio,
            "overrideUsedCount": override_used_count,
            "assemblyManifest": assembly_manifest,
            "assemblyManifestPath": str(manifest_path),
            "assemblyManifestUrl": f"/api/video-match/output/{manifest_name}",
            "warnings": warnings + [f"override_used_count:{override_used_count}"],
        }
        return result
    finally:
        for path in sorted(work_dir.glob("**/*"), reverse=True):
            if path.is_file():
                path.unlink(missing_ok=True)
            elif path.is_dir():
                path.rmdir()
        work_dir.rmdir()
