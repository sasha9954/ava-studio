from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from pathlib import Path
import hashlib
import mimetypes
import os
import re
import subprocess
import tempfile
from urllib.parse import unquote, urlparse

from app.core.config import get_settings
from app.core.storage import store

settings = get_settings()
STATIC_DIR = settings.static_path
ASSETS_DIR = STATIC_DIR / "assets"

router = APIRouter()


def ensure_static_dirs():
    STATIC_DIR.mkdir(parents=True, exist_ok=True)
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)


def asset_url(filename: str) -> str:
    base = str(getattr(settings, "public_base_url", "") or "http://127.0.0.1:8000").strip().rstrip("/")
    return f"{base}/static/assets/{filename}"

def _ensure_assets_dir():
    try:
        ensure_static_dirs()
    except Exception:
        ASSETS_DIR.mkdir(parents=True, exist_ok=True)


def _hash_bytes(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()[:16]


def _round_audio_sec(value, fallback=0.0) -> float:
    try:
        number = float(value)
        if number == number and number >= 0:
            return round(number, 6)
    except Exception:
        pass
    return round(float(fallback or 0.0), 6)


def _podcast_audio_error(status: int, code: str, **extra):
    return JSONResponse(status_code=int(status or 500), content={"ok": False, "status": status, "code": code, **extra})


def _probe_audio_file_duration_sec(path: str) -> float | None:
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path],
            capture_output=True,
            text=True,
        )
        if r.returncode == 0:
            return _round_audio_sec(r.stdout.strip(), 0.0)
    except Exception:
        return None
    return None



def _resolve_ava_private_asset_source(raw_url: str) -> str:
    raw = str(raw_url or "").strip()
    if not raw:
        return ""
    try:
        parsed = urlparse(raw)
        path = unquote(parsed.path or raw)
    except Exception:
        path = raw

    parts = [part for part in path.replace("\\", "/").split("/") if part]
    asset_id = ""
    for index, part in enumerate(parts):
        if part == "assets" and index + 1 < len(parts):
            asset_id = parts[index + 1]
            break
    if not asset_id:
        return ""

    try:
        db = store.get_db()
        asset = (db.get("assets") or {}).get(asset_id) or {}
        storage_path = Path(asset.get("storage_path") or "")
        if storage_path.exists() and storage_path.is_file():
            return str(storage_path)
    except Exception as exc:
        print("[PODCAST AUDIO PRIVATE ASSET RESOLVE FAILED]", {"url": raw, "asset_id": asset_id, "error": str(exc)})
    return ""

def _resolve_static_audio_source(url: str) -> str:
    raw = str(url or "").strip()
    if not raw:
        return ""

    try:
        candidate = Path(raw)
        if candidate.exists():
            resolved = candidate.resolve()
            assets_root = ASSETS_DIR.resolve()
            if str(resolved).startswith(str(assets_root)):
                return str(resolved)
    except Exception:
        pass

    private_asset_path = _resolve_ava_private_asset_source(raw)
    if private_asset_path:
        return private_asset_path

    parsed = urlparse(raw)
    path = unquote(parsed.path or raw)

    marker = "/static/assets/"
    if marker in path:
        rel = path.split(marker, 1)[1].split("?", 1)[0].split("#", 1)[0]
        rel = rel.replace("\\", "/").lstrip("/")
        if ".." in Path(rel).parts:
            return ""
        candidate = ASSETS_DIR / rel
        if candidate.exists():
            return str(candidate)

    filename = os.path.basename(path)
    if filename:
        candidate = ASSETS_DIR / filename
        if candidate.exists():
            return str(candidate)

    return ""


_AUDIO_URL_KEYS = ("source_url", "url", "asset_url", "assetUrl", "server_url", "public_url", "publicUrl")


def _first_audio_url(row: dict) -> str:
    if not isinstance(row, dict):
        return ""
    for key in _AUDIO_URL_KEYS:
        value = str(row.get(key) or "").strip()
        if value:
            return value
    return ""


def _find_actor_audio_source_url(identifier: str, actor_audios: list, saved_clips: list) -> str:
    wanted = str(identifier or "").strip()
    if not wanted:
        return ""
    for source in (actor_audios or []) + (saved_clips or []):
        if not isinstance(source, dict):
            continue
        ids = [source.get("id"), source.get("actor_id"), source.get("source_audio_id"), source.get("saved_clip_id"), source.get("inserted_phrase_id"), source.get("phrase_id")]
        if any(str(item or "").strip() == wanted for item in ids):
            value = _first_audio_url(source)
            if value:
                return value
    return ""


def _block_source_url(block: dict, *, original_audio_url: str, actor_audios: list, saved_clips: list) -> str:
    source_id = str((block or {}).get("source_audio_id") or "main").strip() or "main"
    if source_id == "main":
        return str((block or {}).get("source_url") or original_audio_url or "").strip()

    value = _first_audio_url(block)
    if value:
        return value

    for key in ("saved_clip_id", "inserted_phrase_id", "phrase_id"):
        clip_id = str((block or {}).get(key) or "").strip()
        if not clip_id:
            continue
        value = _find_actor_audio_source_url(clip_id, actor_audios, saved_clips)
        if value:
            return value

    return _find_actor_audio_source_url(source_id, actor_audios, saved_clips)


class PodcastAudioRenderIn(BaseModel):
    sourceNodeId: str | None = None
    originalAudioUrl: str | None = None
    blocks: list[dict] = Field(default_factory=list)
    actorAudios: list[dict] = Field(default_factory=list)
    savedClips: list[dict] = Field(default_factory=list)
    deletionMarkers: list[dict] = Field(default_factory=list)
    finalDurationSec: float | None = None
    podcastEditManifest: dict | None = None


@router.post("/podcast-audio/render-to-asset")
def render_podcast_audio_to_asset(payload: PodcastAudioRenderIn):
    _ensure_assets_dir()
    blocks = payload.blocks if isinstance(payload.blocks, list) else []
    actor_audios = payload.actorAudios if isinstance(payload.actorAudios, list) else []
    saved_clips = payload.savedClips if isinstance(payload.savedClips, list) else []
    final_duration_sec = _round_audio_sec(payload.finalDurationSec, 0.0)
    original_audio_url = str(payload.originalAudioUrl or "").strip()

    print("[PODCAST AUDIO RENDER START]", {"blockCount": len(blocks), "finalDurationSec": final_duration_sec, "sourceNodeId": str(payload.sourceNodeId or "")})

    if not blocks:
        return _podcast_audio_error(400, "PODCAST_AUDIO_RENDER_FAILED", message="blocks_empty")

    with tempfile.TemporaryDirectory(prefix="ava_podcast_audio_render_") as tmpdir:
        tmp_path = Path(tmpdir)
        segment_paths: list[Path] = []
        concat_lines: list[str] = []

        for index, block in enumerate(blocks):
            block = block or {}
            block_id = str(block.get("id") or block.get("block_id") or f"block_{index}")
            source_id = str(block.get("source_audio_id") or "main").strip() or "main"
            source_kind = str(block.get("source_kind") or block.get("type") or ("silence" if source_id == "silence" else "audio")).strip()
            is_silence = source_id == "silence" or str(block.get("type") or "").strip() == "silence" or source_kind == "silence"
            source_start_sec = _round_audio_sec(block.get("source_start_sec"), 0.0)
            source_end_sec = _round_audio_sec(block.get("source_end_sec"), 0.0)
            duration_sec = _round_audio_sec(block.get("duration_sec") or block.get("durationSec"), 0.0)
            if duration_sec <= 0 and source_end_sec > source_start_sec:
                duration_sec = _round_audio_sec(source_end_sec - source_start_sec, 0.0)
            if duration_sec <= 0:
                timeline_start = _round_audio_sec(block.get("timeline_start_sec"), 0.0)
                timeline_end = _round_audio_sec(block.get("timeline_end_sec"), 0.0)
                if timeline_end > timeline_start:
                    duration_sec = _round_audio_sec(timeline_end - timeline_start, 0.0)
            if duration_sec <= 0:
                continue

            out_segment = tmp_path / f"segment_{index:05d}.wav"
            if is_silence:
                cmd = ["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100", "-t", f"{duration_sec:.6f}", "-ac", "2", "-ar", "44100", "-c:a", "pcm_s16le", str(out_segment)]
            else:
                source_url = _block_source_url(block, original_audio_url=original_audio_url, actor_audios=actor_audios, saved_clips=saved_clips)
                source_path = _resolve_static_audio_source(source_url)
                print("[PODCAST AUDIO RENDER SEGMENT]", {"index": index, "blockId": block_id, "sourceId": source_id, "sourceUrl": source_url, "resolved": bool(source_path), "sourceStartSec": source_start_sec, "durationSec": duration_sec})
                if not source_path:
                    return _podcast_audio_error(400, "PODCAST_AUDIO_SOURCE_NOT_FOUND", blockId=block_id, sourceUrl=source_url)
                cmd = ["ffmpeg", "-y", "-ss", f"{source_start_sec:.6f}", "-t", f"{duration_sec:.6f}", "-i", source_path, "-vn", "-ac", "2", "-ar", "44100", "-c:a", "pcm_s16le", str(out_segment)]

            try:
                r = subprocess.run(cmd, capture_output=True, text=True)
            except FileNotFoundError:
                return _podcast_audio_error(500, "PODCAST_AUDIO_RENDER_FAILED", blockId=block_id, message="ffmpeg_not_found")
            if r.returncode != 0 or not out_segment.exists():
                return _podcast_audio_error(500, "PODCAST_AUDIO_RENDER_FAILED", blockId=block_id, message=(r.stderr or r.stdout or "ffmpeg_failed")[-2000:])

            segment_paths.append(out_segment)
            escaped = str(out_segment).replace("'", "'\\''")
            concat_lines.append(f"file '{escaped}'")

        if not segment_paths:
            return _podcast_audio_error(400, "PODCAST_AUDIO_RENDER_FAILED", message="no_renderable_segments")

        concat_file = tmp_path / "concat.txt"
        concat_file.write_text("\\n".join(concat_lines) + "\\n", encoding="utf-8")
        temp_output = tmp_path / "podcast_composer_final.mp3"
        concat_cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_file), "-c:a", "libmp3lame", "-b:a", "192k", str(temp_output)]

        try:
            r = subprocess.run(concat_cmd, capture_output=True, text=True)
        except FileNotFoundError:
            return _podcast_audio_error(500, "PODCAST_AUDIO_RENDER_FAILED", message="ffmpeg_not_found")
        if r.returncode != 0 or not temp_output.exists():
            return _podcast_audio_error(500, "PODCAST_AUDIO_RENDER_FAILED", message=(r.stderr or r.stdout or "ffmpeg_concat_failed")[-2000:])

        raw = temp_output.read_bytes()
        hid = _hash_bytes(raw)
        filename = f"AVA_podcast_audio_composer_{hid}.mp3"
        output_path = ASSETS_DIR / filename
        if not output_path.exists():
            output_path.write_bytes(raw)

    duration_sec = _probe_audio_file_duration_sec(str(output_path)) or final_duration_sec
    duration_sec = _round_audio_sec(duration_sec, final_duration_sec)
    output_url = asset_url(filename)
    return {"ok": True, "url": output_url, "assetUrl": output_url, "asset_url": output_url, "publicUrl": output_url, "public_url": output_url, "filename": filename, "name": filename, "duration_sec": duration_sec, "durationSec": duration_sec, "duration_ms": int(round(duration_sec * 1000)), "durationMs": int(round(duration_sec * 1000)), "mime_type": mimetypes.guess_type(filename)[0] or "audio/mpeg", "mime": "audio/mpeg", "source": "podcast_audio_composer"}


class PodcastAudioExtractPhraseIn(BaseModel):
    sourceAudioUrl: str
    sourceStartSec: float = 0.0
    sourceEndSec: float | None = None
    durationSec: float | None = None
    label: str | None = None
    sourceNodeId: str | None = None


@router.post("/podcast-audio/extract-phrase-to-asset")
def extract_podcast_phrase_to_asset(payload: PodcastAudioExtractPhraseIn):
    _ensure_assets_dir()
    source_url = str(payload.sourceAudioUrl or "").strip()
    source_path = _resolve_static_audio_source(source_url)
    if not source_path:
        return _podcast_audio_error(400, "PODCAST_AUDIO_SOURCE_NOT_FOUND", sourceUrl=source_url)

    source_start_sec = _round_audio_sec(payload.sourceStartSec, 0.0)
    source_end_sec = _round_audio_sec(payload.sourceEndSec, 0.0) if payload.sourceEndSec is not None else 0.0
    duration_sec = _round_audio_sec(payload.durationSec, 0.0)
    if duration_sec <= 0 and source_end_sec > source_start_sec:
        duration_sec = _round_audio_sec(source_end_sec - source_start_sec, 0.0)
    if duration_sec <= 0:
        return _podcast_audio_error(400, "PODCAST_AUDIO_EXTRACT_FAILED", message="duration_empty")

    raw_label = str(payload.label or "phrase").strip() or "phrase"
    safe_label = re.sub(r"[^0-9A-Za-zА-Яа-яЁёІіЇїЄєҐґ_-]+", "_", raw_label).strip("_")[:48] or "phrase"
    source_node_id = re.sub(r"[^0-9A-Za-z_-]+", "_", str(payload.sourceNodeId or "podcast").strip())[:48] or "podcast"

    with tempfile.TemporaryDirectory(prefix="ava_podcast_phrase_extract_") as tmpdir:
        temp_output = Path(tmpdir) / "podcast_saved_phrase.mp3"
        cmd = ["ffmpeg", "-y", "-ss", f"{source_start_sec:.6f}", "-t", f"{duration_sec:.6f}", "-i", source_path, "-vn", "-ac", "2", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "192k", str(temp_output)]
        try:
            r = subprocess.run(cmd, capture_output=True, text=True)
        except FileNotFoundError:
            return _podcast_audio_error(500, "PODCAST_AUDIO_EXTRACT_FAILED", message="ffmpeg_not_found")
        if r.returncode != 0 or not temp_output.exists():
            return _podcast_audio_error(500, "PODCAST_AUDIO_EXTRACT_FAILED", message=(r.stderr or r.stdout or "ffmpeg_failed")[-2000:])

        raw = temp_output.read_bytes()
        hid = _hash_bytes(raw)
        filename = f"AVA_podcast_saved_phrase_{source_node_id}_{safe_label}_{hid}.mp3"
        output_path = ASSETS_DIR / filename
        if not output_path.exists():
            output_path.write_bytes(raw)

    probed_duration_sec = _probe_audio_file_duration_sec(str(output_path)) or duration_sec
    probed_duration_sec = _round_audio_sec(probed_duration_sec, duration_sec)
    output_url = asset_url(filename)
    return {"ok": True, "url": output_url, "assetUrl": output_url, "asset_url": output_url, "server_url": output_url, "publicUrl": output_url, "public_url": output_url, "filename": filename, "name": filename, "duration_sec": probed_duration_sec, "durationSec": probed_duration_sec, "duration_ms": int(round(probed_duration_sec * 1000)), "durationMs": int(round(probed_duration_sec * 1000)), "mime_type": "audio/mpeg", "mime": "audio/mpeg", "source": "podcast_saved_phrase"}
