# AVA_TELEGRAM_LIGHT_REVIEW_NO_BLOCK_V149A: light Telegram review; no sequential blocking; bad is instant; batch sending is async.
# AVA_TELEGRAM_REVIEW_CLEANUP_FINISH_NOTICE_V137K: start hook kwargs, delete comment dialog messages, finish notice with stats button.
# AVA_TELEGRAM_BOARD_REVIEW_SESSION_V137A
# AVA_TELEGRAM_REVIEW_ON_DEMAND_SUMMARY_V137H: quiet ordered review; summary only by command.
# AVA_TELEGRAM_REVIEW_MANUAL_ONLY_V137F
# AVA_TELEGRAM_SEQUENTIAL_REVIEW_QUIET_SUMMARY_V137G2: one active Telegram review at a time; quiet final summary only.: manual Board prompt edits replace Telegram auto-regeneration.
# AVA_TELEGRAM_CHAT_ONLY_REVIEW_V137B: Telegram review stays inside bot, no Board URL buttons, better OK/bad comment prompts.
# AVA_TELEGRAM_REVIEW_NOTE_MEMORY_V137C: keep Telegram comments in server note memory so Board autosave cannot erase them.
# AVA_TELEGRAM_REVIEW_STATS_CURRENT_BATCH_V137L: review summary uses only the current batch/session; old scene reviews are not counted.
from __future__ import annotations

import hashlib
import json
import subprocess
import shutil
import mimetypes
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.security import now_iso
from app.core.storage import store

router = APIRouter(prefix="/telegram", tags=["telegram"])

TG_REVIEW_MARKER = "AVA_TELEGRAM_BOARD_REVIEW_SESSION_V137A+AVA_TELEGRAM_CHAT_ONLY_REVIEW_V137B+AVA_TELEGRAM_REVIEW_CLEANUP_FINISH_NOTICE_V137K"
TELEGRAM_POLL_THREAD: threading.Thread | None = None
TELEGRAM_POLL_STOP = threading.Event()



class TelegramTestIn(BaseModel):
    text: str | None = None


class TelegramNotifySceneIn(BaseModel):
    project_id: str | None = None
    projectId: str | None = None
    scene_id: str | None = None
    sceneId: str | None = None
    job_id: str | None = None
    jobId: str | None = None
    asset_id: str | None = None
    assetId: str | None = None
    batch_id: str | None = None
    batchId: str | None = None


def _telegram_token() -> str:
    settings = get_settings()
    return str(
        getattr(settings, "telegram_bot_token", "")
        or getattr(settings, "TELEGRAM_BOT_TOKEN", "")
        or ""
    ).strip()


def _telegram_chat_id() -> str:
    settings = get_settings()
    return str(
        getattr(settings, "telegram_chat_id", "")
        or getattr(settings, "TELEGRAM_CHAT_ID", "")
        or ""
    ).strip()


def _telegram_enabled() -> bool:
    settings = get_settings()
    raw_enabled = getattr(settings, "telegram_enabled", None)
    if raw_enabled is None:
        raw_enabled = getattr(settings, "TELEGRAM_ENABLED", None)
    if isinstance(raw_enabled, str):
        enabled = raw_enabled.strip().lower() not in {"", "0", "false", "no", "off"}
    elif raw_enabled is None:
        enabled = True
    else:
        enabled = bool(raw_enabled)
    return bool(enabled and _telegram_token() and _telegram_chat_id())


def _telegram_frontend_url(project_id: str) -> str:
    settings = get_settings()
    base = str(
        getattr(settings, "telegram_frontend_base_url", "")
        or getattr(settings, "frontend_base_url", "")
        or getattr(settings, "public_frontend_base_url", "")
        or ""
    ).strip().rstrip("/")
    if not base:
        return ""
    return f"{base}/app/projects/{project_id}/board"


def _api_url(method: str) -> str:
    token = _telegram_token()
    return f"https://api.telegram.org/bot{token}/{method}"


def _telegram_post_json(method: str, payload: dict[str, Any], timeout: int = 12) -> dict[str, Any]:
    if not _telegram_token():
        return {"ok": False, "error": "telegram_token_missing"}
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        _api_url(method),
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return json.loads(raw or "{}")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        print("[TELEGRAM JSON ERROR V137A]", {"method": method, "status": exc.code, "body": body[-1000:]}, flush=True)
        return {"ok": False, "error": body or str(exc), "status": exc.code}
    except Exception as exc:
        print("[TELEGRAM JSON ERROR V137A]", {"method": method, "error": str(exc)}, flush=True)
        return {"ok": False, "error": str(exc)}


def _telegram_post_multipart(method: str, fields: dict[str, Any], files: dict[str, Path], timeout: int = 90) -> dict[str, Any]:
    if not _telegram_token():
        return {"ok": False, "error": "telegram_token_missing"}
    boundary = f"----AvaTelegramBoundary{uuid4().hex}"
    chunks: list[bytes] = []
    for key, value in fields.items():
        if value is None:
            continue
        chunks.append(f"--{boundary}\r\n".encode("utf-8"))
        chunks.append(f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode("utf-8"))
        chunks.append(str(value).encode("utf-8"))
        chunks.append(b"\r\n")
    for key, path in files.items():
        safe_path = Path(path)
        filename = safe_path.name or "video.mp4"
        mime = mimetypes.guess_type(str(safe_path))[0] or "application/octet-stream"
        chunks.append(f"--{boundary}\r\n".encode("utf-8"))
        chunks.append(
            f'Content-Disposition: form-data; name="{key}"; filename="{filename}"\r\n'.encode("utf-8")
        )
        chunks.append(f"Content-Type: {mime}\r\n\r\n".encode("utf-8"))
        chunks.append(safe_path.read_bytes())
        chunks.append(b"\r\n")
    chunks.append(f"--{boundary}--\r\n".encode("utf-8"))
    body = b"".join(chunks)
    req = urllib.request.Request(
        _api_url(method),
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return json.loads(raw or "{}")
    except urllib.error.HTTPError as exc:
        body_text = exc.read().decode("utf-8", errors="replace")
        print("[TELEGRAM MULTIPART ERROR V137A]", {"method": method, "status": exc.code, "body": body_text[-1000:]}, flush=True)
        return {"ok": False, "error": body_text or str(exc), "status": exc.code}
    except Exception as exc:
        print("[TELEGRAM MULTIPART ERROR V137A]", {"method": method, "error": str(exc)}, flush=True)
        return {"ok": False, "error": str(exc)}


def _send_message(text: str, reply_markup: dict[str, Any] | None = None, chat_id: str | None = None) -> dict[str, Any]:
    if not _telegram_enabled():
        return {"ok": False, "error": "telegram_disabled"}
    payload: dict[str, Any] = {
        "chat_id": chat_id or _telegram_chat_id(),
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup
    return _telegram_post_json("sendMessage", payload)


def _answer_callback(callback_id: str, text: str = "", show_alert: bool = False) -> None:
    if not callback_id:
        return
    _telegram_post_json("answerCallbackQuery", {
        "callback_query_id": callback_id,
        "text": text[:190],
        "show_alert": bool(show_alert),
    })


def _edit_reply_markup(chat_id: str, message_id: int | str, reply_markup: dict[str, Any] | None = None) -> None:
    if not chat_id or not message_id:
        return
    payload: dict[str, Any] = {"chat_id": chat_id, "message_id": message_id, "reply_markup": reply_markup or {"inline_keyboard": []}}
    _telegram_post_json("editMessageReplyMarkup", payload)


def _delete_message_v137k(chat_id: str | int | None, message_id: int | str | None) -> dict[str, Any]:
    """Delete a Telegram message and never fail the review flow on delete errors."""
    if not chat_id or not message_id:
        return {"ok": False, "status": "missing_chat_or_message"}
    try:
        result = _telegram_post_json("deleteMessage", {"chat_id": str(chat_id), "message_id": int(message_id)})
        if not result.get("ok"):
            print("[TELEGRAM DELETE MESSAGE SKIP V137K]", {"chat_id": str(chat_id), "message_id": message_id, "result": result}, flush=True)
        return result
    except Exception as exc:
        print("[TELEGRAM DELETE MESSAGE ERROR V137K]", {"chat_id": str(chat_id), "message_id": message_id, "error": str(exc)}, flush=True)
        return {"ok": False, "error": str(exc)}


def _html(value: Any) -> str:
    text = str(value or "")
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _scene_id(scene: dict[str, Any] | None, index: int = 0) -> str:
    if not isinstance(scene, dict):
        return f"scene_{index + 1}"
    return str(scene.get("scene_id") or scene.get("sceneId") or scene.get("id") or f"scene_{index + 1}").strip()


def _project_name(project_id: str) -> str:
    try:
        project = (store.get_db().get("projects") or {}).get(project_id) or {}
        return str(project.get("name") or project_id)
    except Exception:
        return project_id


def _project_user_id(project_id: str) -> str:
    try:
        project = (store.get_db().get("projects") or {}).get(project_id) or {}
        return str(project.get("user_id") or "")
    except Exception:
        return ""


def _board_data_from_db(db: dict[str, Any], project_id: str) -> dict[str, Any]:
    snap = ((db.get("snapshots") or {}).get(project_id) or {}).get("board") or {}
    data = snap.get("data") if isinstance(snap, dict) else {}
    return data if isinstance(data, dict) else {}


def _latest_scene_video(scene: dict[str, Any] | None) -> dict[str, str]:
    scene = scene if isinstance(scene, dict) else {}
    asset_id = str(scene.get("video_asset_id") or scene.get("videoAssetId") or "").strip()
    api_path = str(scene.get("video_api_path") or scene.get("videoApiPath") or "").strip()
    url = str(scene.get("video_url") or scene.get("videoUrl") or api_path or "").strip()
    job_id = str(scene.get("video_job_id") or scene.get("videoJobId") or "").strip()
    return {"asset_id": asset_id, "api_path": api_path, "url": url, "job_id": job_id}


def _asset_path(asset_id: str) -> Path | None:
    asset_id = str(asset_id or "").strip()
    if not asset_id:
        return None
    try:
        asset = (store.get_db().get("assets") or {}).get(asset_id) or {}
    except Exception:
        return None
    raw = str(asset.get("storage_path") or asset.get("storagePath") or "").strip()
    if not raw:
        return None
    settings = get_settings()
    backend_dir = Path(__file__).resolve().parents[3]
    candidates: list[Path] = []
    for text in {raw, raw.replace("\\", "/")}:
        path = Path(text)
        candidates.append(path)
        if not path.is_absolute():
            candidates.extend([settings.storage_path.parent / path, backend_dir / path, Path.cwd() / path])
    for candidate in candidates:
        try:
            if candidate.exists() and candidate.is_file():
                return candidate
        except Exception:
            continue
    return None


def _review_callback_keyboard(review_id: str, project_id: str) -> dict[str, Any]:
    # AVA_TELEGRAM_CHAT_ONLY_REVIEW_V137B: keep scene review inside Telegram.
    # The phone Board URL was confusing and often unavailable on mobile/Tailscale.
    return {"inline_keyboard": [[
        {"text": "✅ OK", "callback_data": f"ava:ok:{review_id}"},
        {"text": "🔁 не OK", "callback_data": f"ava:bad:{review_id}"},
    ]]}


def _regen_bad_keyboard(project_id: str, bad_count: int) -> dict[str, Any] | None:
    # AVA_TELEGRAM_REVIEW_MANUAL_ONLY_V137F:
    # Do not offer automatic Telegram regeneration anymore. A bad result usually needs
    # prompt/negative/route edits in Board first; regenerating the same prompt is noise.
    return None

def _ensure_session_in_db(db: dict[str, Any], project_id: str, scene_ids: list[str] | None = None, batch_id: str = "") -> dict[str, Any]:
    sessions = db.setdefault("telegram_review_sessions", {})
    session = sessions.get(project_id)
    if not isinstance(session, dict) or str(session.get("status") or "") in {"done", "closed"}:
        session = {
            "project_id": project_id,
            "projectId": project_id,
            "batch_id": batch_id,
            "batchId": batch_id,
            "status": "reviewing",
            "scene_ids": [],
            "sceneIds": [],
            "latest_review_ids_by_scene": {},
            "latestReviewIdsByScene": {},
            "created_at": now_iso(),
            "createdAt": now_iso(),
            "updated_at": now_iso(),
            "updatedAt": now_iso(),
        }
    if batch_id:
        session["batch_id"] = batch_id
        session["batchId"] = batch_id
    existing = [str(item) for item in (session.get("scene_ids") or session.get("sceneIds") or []) if str(item).strip()]
    for scene_id in scene_ids or []:
        safe_id = str(scene_id or "").strip()
        if safe_id and safe_id not in existing:
            existing.append(safe_id)
    session["scene_ids"] = existing
    session["sceneIds"] = existing
    session["updated_at"] = now_iso()
    session["updatedAt"] = session["updated_at"]
    sessions[project_id] = session
    return session


def _review_item_latest_for_scene(db: dict[str, Any], project_id: str, scene_id: str) -> str:
    latest = db.setdefault("telegram_review_latest_by_scene", {})
    return str(latest.get(f"{project_id}:{scene_id}") or "").strip()


def _set_review_item_latest_for_scene(db: dict[str, Any], project_id: str, scene_id: str, review_id: str) -> None:
    latest = db.setdefault("telegram_review_latest_by_scene", {})
    latest[f"{project_id}:{scene_id}"] = review_id


def _upsert_review_event_memory(board: dict[str, Any], scene_id: str, kind: str, status: str, reason: str, at: str) -> None:
    memory = board.get("board_review_event_memory_v136e") or board.get("boardReviewEventMemoryV136E") or {}
    if not isinstance(memory, dict):
        memory = {}
    event = {"kind": kind, "status": status, "reason": reason, "at": at}
    memory[scene_id] = event
    board["board_review_event_memory_v136e"] = memory
    board["boardReviewEventMemoryV136E"] = memory


def _apply_review_to_scene(scene: dict[str, Any], status: str, reason: str, at: str) -> None:
    status = str(status or "").strip().lower()
    if status == "bad":
        scene["video_review_status"] = "bad"
        scene["videoReviewStatus"] = "bad"
        scene["review_status"] = "bad"
        scene["reviewStatus"] = "bad"
        scene["video_review_reason"] = reason
        scene["videoReviewReason"] = reason
        scene["video_review_updated_at"] = at
        scene["videoReviewUpdatedAt"] = at
        scene["video_review_clear_reason"] = ""
        scene["videoReviewClearReason"] = ""
        scene["video_review_cleared_at"] = ""
        scene["videoReviewClearedAt"] = ""
        scene["video_review_regenerate_from_bad"] = True
        scene["videoReviewRegenerateFromBad"] = True
        scene["video_review_regenerate_reason"] = "telegram_bad_review_v137a"
        scene["videoReviewRegenerateReason"] = "telegram_bad_review_v137a"
        scene["bad_video_review"] = True
        scene["badVideoReview"] = True
        scene["video_review_bad"] = True
        scene["videoReviewBad"] = True
        # AVA_TELEGRAM_REVIEW_BAD_ALIASES_SET_V203C
        scene["bad_video"] = True
        scene["badVideo"] = True
        scene["video_bad"] = True
        scene["videoBad"] = True
        scene["is_bad_video"] = True
        scene["isBadVideo"] = True
        scene["needs_review"] = False
        scene["needsReview"] = False
        return
    # OK / clear
    for key in (
        "video_review_status", "videoReviewStatus", "review_status", "reviewStatus",
        "video_review_reason", "videoReviewReason",
        "video_review_regenerate_reason", "videoReviewRegenerateReason",
    ):
        scene[key] = ""
    scene["video_review_regenerate_from_bad"] = False
    scene["videoReviewRegenerateFromBad"] = False
    scene["needs_review"] = False
    scene["needsReview"] = False
    scene["bad_video_review"] = False
    scene["badVideoReview"] = False
    scene["video_review_bad"] = False
    scene["videoReviewBad"] = False
    # AVA_TELEGRAM_REVIEW_BAD_ALIASES_CLEAR_V203C
    scene["bad_video"] = False
    scene["badVideo"] = False
    scene["video_bad"] = False
    scene["videoBad"] = False
    scene["is_bad_video"] = False
    scene["isBadVideo"] = False
    scene["video_review_clear_reason"] = reason
    scene["videoReviewClearReason"] = reason
    scene["video_review_cleared_at"] = at
    scene["videoReviewClearedAt"] = at
    scene["video_review_clear_token_v132y"] = scene.get("video_review_clear_token_v132y") or f"telegram_review_clear_v137a_{uuid4().hex[:8]}"
    scene["videoReviewClearTokenV132Y"] = scene["video_review_clear_token_v132y"]


def _append_review_note(scene: dict[str, Any], item: dict[str, Any], comment: str) -> None:
    at = now_iso()
    scene_id = str(item.get("scene_id") or item.get("sceneId") or "")
    asset_id = str(item.get("asset_id") or item.get("assetId") or "")
    job_id = str(item.get("job_id") or item.get("jobId") or "")
    block = (
        "\n\n--- Telegram review ---\n"
        f"❌ Не OK · {at}\n"
        f"Сцена: {scene_id}\n"
        f"Видео: {asset_id or '-'}\n"
        f"Job: {job_id or '-'}\n"
        f"Комментарий: {comment.strip()}"
    )
    current = str(scene.get("note") or "")
    scene["note"] = (current.rstrip() + block).strip()
    scene["telegram_review_comment"] = comment.strip()
    scene["telegramReviewComment"] = comment.strip()
    scene["telegram_review_updated_at"] = at
    scene["telegramReviewUpdatedAt"] = at


# AVA_TELEGRAM_REVIEW_NOTE_MEMORY_V137C
# Store Telegram review comments in a root-level Board memory map too.
# A stale open Board tab can POST an old snapshot after the bot saves the comment;
# projects.py V137C re-applies this memory on every Board save/load merge.
def _telegram_review_note_block_v137c(scene_id: str, item: dict[str, Any], comment: str, at: str = "") -> str:
    at = str(at or item.get("updated_at") or item.get("updatedAt") or now_iso()).strip() or now_iso()
    asset_id = str(item.get("asset_id") or item.get("assetId") or "").strip()
    job_id = str(item.get("job_id") or item.get("jobId") or "").strip()
    return (
        "--- Telegram review ---\n"
        f"❌ Не OK · {at}\n"
        f"Сцена: {scene_id}\n"
        f"Видео: {asset_id or '-'}\n"
        f"Job: {job_id or '-'}\n"
        f"Комментарий: {str(comment or '').strip()}"
    )


def _upsert_telegram_review_note_memory_v137c(board: dict[str, Any], scene_id: str, status: str, reason: str, item: dict[str, Any], comment: str = "") -> None:
    if not isinstance(board, dict):
        return
    scene_id = str(scene_id or item.get("scene_id") or item.get("sceneId") or "").strip()
    if not scene_id:
        return
    raw = board.get("board_telegram_review_note_memory_v137c") or board.get("boardTelegramReviewNoteMemoryV137C") or {}
    memory = dict(raw) if isinstance(raw, dict) else {}
    status_norm = str(status or "").strip().lower()
    # Board review clear is represented by empty status; keep an explicit OK/clear entry
    # so older bad-comment memory cannot be replayed for the same scene.
    if not status_norm and str(reason or "").startswith("telegram_review_ok"):
        status_norm = "ok"
    elif not status_norm:
        status_norm = "clear"
    at = str(item.get("updated_at") or item.get("updatedAt") or now_iso()).strip() or now_iso()
    comment_text = str(comment or item.get("comment") or "").strip()
    entry = {
        "scene_id": scene_id,
        "sceneId": scene_id,
        "review_id": str(item.get("review_id") or item.get("reviewId") or ""),
        "reviewId": str(item.get("review_id") or item.get("reviewId") or ""),
        "project_id": str(item.get("project_id") or item.get("projectId") or ""),
        "projectId": str(item.get("project_id") or item.get("projectId") or ""),
        "job_id": str(item.get("job_id") or item.get("jobId") or ""),
        "jobId": str(item.get("job_id") or item.get("jobId") or ""),
        "asset_id": str(item.get("asset_id") or item.get("assetId") or ""),
        "assetId": str(item.get("asset_id") or item.get("assetId") or ""),
        "status": status_norm,
        "reason": str(reason or ""),
        "comment": comment_text if status_norm == "bad" else "",
        "at": at,
        "updated_at": at,
        "updatedAt": at,
    }
    if status_norm == "bad" and comment_text:
        block = _telegram_review_note_block_v137c(scene_id, item, comment_text, at=at)
        entry["note_block"] = block
        entry["noteBlock"] = block
    memory[scene_id] = entry
    board["board_telegram_review_note_memory_v137c"] = memory
    board["boardTelegramReviewNoteMemoryV137C"] = memory


def _save_project_board_review(project_id: str, scene_id: str, status: str, reason: str, item: dict[str, Any], comment: str = "") -> dict[str, Any]:
    at = now_iso()

    def op(db: dict[str, Any]) -> dict[str, Any]:
        board = _board_data_from_db(db, project_id)
        scenes = board.get("scenes") if isinstance(board.get("scenes"), list) else []
        changed = False
        for index, scene in enumerate(scenes):
            if _scene_id(scene, index) != scene_id:
                continue
            _apply_review_to_scene(scene, status, reason, at)
            if comment.strip():
                _append_review_note(scene, item, comment)
            scene["telegram_review_id"] = item.get("review_id") or item.get("reviewId") or ""
            scene["telegramReviewId"] = scene["telegram_review_id"]
            changed = True
            break
        if not changed:
            return {"ok": False, "error": "scene_not_found", "sceneId": scene_id}
        board["scenes"] = scenes
        _upsert_telegram_review_note_memory_v137c(board, scene_id, status, reason, item, comment)
        _upsert_review_event_memory(board, scene_id, "mark" if status == "bad" else "clear", "bad" if status == "bad" else "", reason, at)
        db.setdefault("snapshots", {}).setdefault(project_id, {})["board"] = {
            "stage": "board",
            "data": board,
            "client_version": "telegram-board-review-v137a",
            "updated_at": now_iso(),
        }
        if project_id in db.get("projects", {}):
            db["projects"][project_id]["updated_at"] = now_iso()
        return {"ok": True, "sceneId": scene_id, "status": status}

    return store.update(op)


def _review_stats(project_id: str) -> dict[str, Any]:
    db = store.get_db()
    session = (db.get("telegram_review_sessions") or {}).get(project_id) or {}
    items = db.get("telegram_review_items") or {}

    # AVA_TELEGRAM_REVIEW_STATS_CURRENT_BATCH_V137L:
    # Statistics must describe the active/current batch only. Older review items
    # stay in storage for history/notes, but must not leak into the current
    # finish notice or manual "статистика" report.
    scene_ids = [str(item) for item in (session.get("scene_ids") or session.get("sceneIds") or []) if str(item).strip()]
    latest_by_scene = session.get("latest_review_ids_by_scene") or session.get("latestReviewIdsByScene") or {}
    if not isinstance(latest_by_scene, dict):
        latest_by_scene = {}

    ok: list[str] = []
    bad: list[str] = []
    waiting_comment: list[str] = []
    pending_review: list[str] = []
    not_ready: list[str] = []
    comments: dict[str, str] = {}

    for scene_id in scene_ids:
        # Important: do NOT fall back to global telegram_review_latest_by_scene here.
        # That global map may contain an old result from a previous batch, which is
        # exactly what caused old seg_03/comments to appear in a 2-scene test.
        rid = str(latest_by_scene.get(scene_id) or "").strip()
        if not rid:
            not_ready.append(scene_id)
            continue
        item = items.get(rid) if isinstance(items, dict) else None
        if not isinstance(item, dict):
            not_ready.append(scene_id)
            continue
        status = str(item.get("status") or "").strip()
        if status == "ok":
            ok.append(scene_id)
        elif status == "bad":
            bad.append(scene_id)
            comments[scene_id] = str(item.get("comment") or "").strip()
        elif status == "bad_waiting_comment":
            waiting_comment.append(scene_id)
        else:
            pending_review.append(scene_id)

    done = bool(scene_ids) and not waiting_comment and not pending_review and not not_ready
    return {
        "project_id": project_id,
        "scene_ids": scene_ids,
        "ok": ok,
        "bad": bad,
        "waiting_comment": waiting_comment,
        "pending_review": pending_review,
        "not_ready": not_ready,
        "comments": comments,
        "done": done,
        "batch_id": str(session.get("batch_id") or session.get("batchId") or ""),
    }

def _format_review_summary(project_id: str) -> tuple[str, dict[str, Any]]:
    stats = _review_stats(project_id)
    project_name = _project_name(project_id)
    lines = [
        "━━━━━━━━━━━━━━━━━━━━",
        "📊 <b>ПРОВЕРКА СЦЕН</b>",
        "",
        f"Проект: <b>{_html(project_name)}</b>",
        f"✅ OK: <b>{len(stats['ok'])}</b>",
        f"🔁 Не OK: <b>{len(stats['bad'])}</b>",
    ]
    comments = stats.get("comments") if isinstance(stats.get("comments"), dict) else {}
    if stats["bad"]:
        lines.extend(["", "🔁 <b>Плохие сцены:</b>"])
        for scene_id in stats["bad"]:
            comment = str(comments.get(scene_id) or "").strip()
            if comment:
                lines.append(f"• <b>{_html(scene_id)}</b> — {_html(comment)}")
            else:
                lines.append(f"• <b>{_html(scene_id)}</b>")
    if stats["waiting_comment"]:
        lines.append("📝 Ждут комментарий: " + _html(", ".join(stats["waiting_comment"])))
    if stats["pending_review"]:
        lines.append("⏳ Без отзыва: " + _html(", ".join(stats["pending_review"])))
    if stats["not_ready"]:
        lines.append("🎬 Ещё не пришли: " + _html(", ".join(stats["not_ready"])))
    if stats["done"]:
        lines.extend(["", "🏁 <b>Проверка завершена.</b>"])
        if stats["bad"]:
            lines.extend([
                "",
                "🛠 <b>Дальше:</b>",
                "Открой Board, поправь positive/negative prompt или настройки плохих сцен по комментариям и запусти регенерацию вручную.",
            ])
        else:
            lines.append("🎉 Все сцены приняты.")
    return "\n".join(lines), stats

def _send_review_summary(project_id: str, chat_id: str | None = None) -> dict[str, Any]:
    text, stats = _format_review_summary(project_id)
    # AVA_TELEGRAM_REVIEW_ON_DEMAND_SUMMARY_V137H: summary is only sent on explicit request.
    return _send_message(text, chat_id=chat_id)


def _summary_button_keyboard_v137k(project_id: str) -> dict[str, Any]:
    return {"inline_keyboard": [[{"text": "📊 Получить статистику", "callback_data": f"ava:summary:{project_id}"}]]}


def _format_generation_finish_notice_v137k(project_id: str, status: str = "", completed: list[str] | None = None, failed: list[str] | None = None) -> tuple[str, dict[str, Any]]:
    stats = _review_stats(project_id)
    project_name = _project_name(project_id)
    waiting_comment = [str(x) for x in (stats.get("waiting_comment") or []) if str(x).strip()]
    pending_review = [str(x) for x in (stats.get("pending_review") or []) if str(x).strip()]
    not_ready = [str(x) for x in (stats.get("not_ready") or []) if str(x).strip()]
    failed_ids = [str(x) for x in (failed or []) if str(x).strip()]
    not_voted = []
    for scene_id in [*waiting_comment, *pending_review, *not_ready]:
        if scene_id not in not_voted:
            not_voted.append(scene_id)
    lines = [
        "🏁 <b>Генерация закончена</b>",
        "",
        f"Проект: <b>{_html(project_name)}</b>",
        f"✅ OK: <b>{len(stats.get('ok') or [])}</b>",
        f"🔁 Не OK: <b>{len(stats.get('bad') or [])}</b>",
        f"⏳ Не голосовали: <b>{len(not_voted)}</b>",
    ]
    if not_voted:
        lines.append("Какие: " + _html(", ".join(not_voted)))
    if failed_ids:
        lines.append("⚠️ Ошибки генерации: " + _html(", ".join(failed_ids)))
    lines.extend([
        "",
        "Можно отметить видео кнопками под сценами или нажать кнопку ниже.",
        "Также работает команда: <b>статистика</b>",
    ])
    return "\n".join(lines), stats


def _send_generation_finish_notice_v137k(project_id: str, batch_id: str = "", status: str = "", completed: list[str] | None = None, failed: list[str] | None = None) -> dict[str, Any]:
    signature = f"{batch_id}|{status}|{','.join([str(x) for x in (completed or [])])}|{','.join([str(x) for x in (failed or [])])}"

    def remember(db: dict[str, Any]) -> dict[str, Any]:
        session = _ensure_session_in_db(db, project_id, completed or [], batch_id=batch_id)
        old_signature = str(session.get("finish_notice_signature_v137k") or session.get("finishNoticeSignatureV137K") or "")
        if old_signature == signature:
            return {"send": False, "signature": signature}
        session["finish_notice_signature_v137k"] = signature
        session["finishNoticeSignatureV137K"] = signature
        session["finish_notice_sent_at_v137k"] = now_iso()
        session["finishNoticeSentAtV137K"] = session["finish_notice_sent_at_v137k"]
        return {"send": True, "signature": signature}

    try:
        decision = store.update(remember)
    except Exception as exc:
        print("[TELEGRAM FINISH NOTICE MEMORY ERROR V137K]", {"project_id": project_id, "error": str(exc)}, flush=True)
        decision = {"send": True, "signature": signature}
    if not decision.get("send"):
        return {"ok": True, "status": "finish_notice_already_sent_v137k"}
    text, stats = _format_generation_finish_notice_v137k(project_id, status=status, completed=completed, failed=failed)
    result = _send_message(text, reply_markup=_summary_button_keyboard_v137k(project_id))
    print("[TELEGRAM FINISH NOTICE SENT V137K]", {"project_id": project_id, "batch_id": batch_id, "ok": result.get("ok"), "stats": {"ok": len(stats.get("ok") or []), "bad": len(stats.get("bad") or []), "waiting_comment": len(stats.get("waiting_comment") or []), "pending_review": len(stats.get("pending_review") or []), "not_ready": len(stats.get("not_ready") or [])}}, flush=True)
    return result

def _queued_review_count_v137g2(project_id: str) -> int:
    try:
        db = store.get_db()
        queues = db.get("telegram_review_ready_queue_v137g2") or {}
        queue = queues.get(project_id) if isinstance(queues, dict) else []
        return len(queue) if isinstance(queue, list) else 0
    except Exception:
        return 0


def _active_review_blocker_v137g2(project_id: str) -> dict[str, Any] | None:
    """V149A: do not hold later scene videos behind an unanswered Telegram review.

    Old behavior sent only one scene video at a time and queued every later scene
    until OK / comment was received. That made Telegram delays block the review
    stream and made messages arrive late/out of order. Board remains the source
    of truth; Telegram is now a lightweight notification/review helper.
    """
    return None

def _queue_scene_ready_v137g2(project_id: str, scene_id: str, scene: dict[str, Any], job_id: str = "", batch_id: str = "") -> dict[str, Any]:
    """Queue a ready scene until the current Telegram review is answered."""
    video = _latest_scene_video(scene if isinstance(scene, dict) else {})
    asset_id = str(video.get("asset_id") or "").strip()
    api_path = str(video.get("api_path") or "").strip()
    job_id = str(job_id or video.get("job_id") or "").strip()
    scene_payload = scene if isinstance(scene, dict) else {}

    def op(db: dict[str, Any]) -> dict[str, Any]:
        session = _ensure_session_in_db(db, project_id, [scene_id], batch_id=batch_id)
        session["status"] = "reviewing"
        queues = db.setdefault("telegram_review_ready_queue_v137g2", {})
        queue = queues.setdefault(project_id, [])
        if not isinstance(queue, list):
            queue = []
        exists = False
        for item in queue:
            if not isinstance(item, dict):
                continue
            if str(item.get("scene_id") or item.get("sceneId") or "") == scene_id and str(item.get("asset_id") or item.get("assetId") or "") == asset_id:
                exists = True
                break
        if not exists:
            queue.append({
                "project_id": project_id,
                "projectId": project_id,
                "scene_id": scene_id,
                "sceneId": scene_id,
                "scene": scene_payload,
                "job_id": job_id,
                "jobId": job_id,
                "batch_id": batch_id,
                "batchId": batch_id,
                "asset_id": asset_id,
                "assetId": asset_id,
                "api_path": api_path,
                "apiPath": api_path,
                "queued_at": now_iso(),
                "queuedAt": now_iso(),
            })
        queues[project_id] = queue
        db["telegram_review_ready_queue_v137g2"] = queues
        return {"queued": len(queue), "deduped": exists}

    result = store.update(op)
    print("[TELEGRAM SCENE READY QUEUED V137G2]", {"project_id": project_id, "scene_id": scene_id, "queue": result}, flush=True)
    return {"ok": True, "status": "queued_for_sequential_review", "scene_id": scene_id, "queue": result}


def _pop_next_queued_scene_v137g2(project_id: str) -> dict[str, Any] | None:
    def op(db: dict[str, Any]) -> dict[str, Any] | None:
        queues = db.setdefault("telegram_review_ready_queue_v137g2", {})
        queue = queues.get(project_id) if isinstance(queues, dict) else []
        if not isinstance(queue, list) or not queue:
            return None
        item = queue.pop(0)
        queues[project_id] = queue
        db["telegram_review_ready_queue_v137g2"] = queues
        return item if isinstance(item, dict) else None
    try:
        return store.update(op)
    except Exception as exc:
        print("[TELEGRAM QUEUE POP ERROR V137G2]", {"project_id": project_id, "error": str(exc)}, flush=True)
        return None


def _flush_next_review_queue_v137g2(project_id: str) -> dict[str, Any]:
    if _active_review_blocker_v137g2(project_id):
        return {"ok": True, "status": "blocked_by_active_review"}
    item = _pop_next_queued_scene_v137g2(project_id)
    if not item:
        return {"ok": True, "status": "queue_empty"}
    scene_id = str(item.get("scene_id") or item.get("sceneId") or "").strip()
    scene = item.get("scene") if isinstance(item.get("scene"), dict) else {}
    job_id = str(item.get("job_id") or item.get("jobId") or "").strip()
    batch_id = str(item.get("batch_id") or item.get("batchId") or "").strip()
    print("[TELEGRAM QUEUE FLUSH NEXT V137G2]", {"project_id": project_id, "scene_id": scene_id}, flush=True)
    if not scene_id:
        return {"ok": False, "error": "queued_scene_missing_scene_id"}
    return telegram_board_scene_ready(project_id, scene_id, scene=scene, job_id=job_id, batch_id=batch_id)


def _maybe_send_final_review_summary_v137g2(project_id: str) -> dict[str, Any]:
    """Do not auto-send final statistics.

    AVA_TELEGRAM_REVIEW_ON_DEMAND_SUMMARY_V137H:
    Final/review statistics are intentionally manual-only to keep Telegram
    ordered and quiet. The user can request them with "статистика", "/summary",
    "/stats", "итог" or "проверка".
    """
    stats = _review_stats(project_id)
    return {"ok": True, "sent": False, "reason": "manual_summary_only_v137h", "stats": stats}


# AVA_ASSEMBLY_TELEGRAM_COMPLETE_NOTICE_V140B:
# Backend-only, text-only Telegram notification for final Assembly montage render.
# No MP4 file, no links, no buttons. Duplicate-safe per unique assembly result.
def _telegram_assembly_project_title_v140b(project_id: str) -> str:
    clean_project_id = str(project_id or "").strip()
    if not clean_project_id:
        return ""
    try:
        project = (store.get_db().get("projects") or {}).get(clean_project_id) or {}
        if not isinstance(project, dict):
            return ""
        return str(
            project.get("title")
            or project.get("name")
            or project.get("project_title")
            or project.get("projectTitle")
            or ""
        ).strip()
    except Exception:
        return ""


def _telegram_assembly_format_duration_v140b(duration_sec: Any) -> str:
    try:
        seconds = int(round(float(duration_sec or 0)))
    except Exception:
        seconds = 0
    if seconds <= 0:
        return ""
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    if hours:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def _telegram_assembly_notification_key_v140b(
    project_id: str = "",
    assembly_job_id: str = "",
    output_asset_id: str = "",
    output_api_path: str = "",
    output_name: str = "",
    output_path: str = "",
) -> str:
    clean_project_id = str(project_id or "").strip() or "no_project"
    clean_job_id = str(assembly_job_id or "").strip()
    clean_asset_id = str(output_asset_id or "").strip()
    output_ref = str(output_api_path or output_name or output_path or "").strip()
    if clean_job_id and clean_asset_id:
        return f"assembly:{clean_project_id}:{clean_job_id}:{clean_asset_id}"
    if clean_job_id and output_ref:
        digest = hashlib.sha1(output_ref.encode("utf-8", errors="ignore")).hexdigest()[:16]
        return f"assembly:{clean_project_id}:{clean_job_id}:{digest}"
    if clean_asset_id:
        return f"assembly:{clean_project_id}:{clean_asset_id}"
    if output_ref:
        digest = hashlib.sha1(output_ref.encode("utf-8", errors="ignore")).hexdigest()[:16]
        return f"assembly:{clean_project_id}:{digest}"
    digest = hashlib.sha1(f"{clean_project_id}:{assembly_job_id}:{now_iso()}".encode("utf-8", errors="ignore")).hexdigest()[:16]
    return f"assembly:{clean_project_id}:{digest}"



# AVA_ASSEMBLY_TELEGRAM_DOWNLOAD_BUTTON_V213Q:
# Add a safe callback button to completed Assembly notifications. The callback does
# not expose local paths; it resolves the saved output record and uploads the MP4
# to Telegram as a document in a background thread.
def _telegram_assembly_download_token_v213q(notification_key: str) -> str:
    raw = str(notification_key or "").strip()
    if not raw:
        raw = f"assembly-download:{now_iso()}:{uuid4().hex}"
    return hashlib.sha1(raw.encode("utf-8", errors="ignore")).hexdigest()[:24]


def _telegram_assembly_download_markup_v213q(download_token: str) -> dict[str, Any] | None:
    token = str(download_token or "").strip()
    if not token:
        return None
    return {"inline_keyboard": [[{"text": "⬇️ Скачать MP4", "callback_data": f"ava:asm_dl:{token}"}]]}


def _telegram_assembly_download_candidate_paths_v213q(record: dict[str, Any]) -> list[Path]:
    candidates: list[Path] = []
    raw_values = [
        record.get("output_path"), record.get("outputPath"),
        record.get("local_path"), record.get("localPath"),
        record.get("path"), record.get("file_path"), record.get("filePath"),
    ]
    for raw in raw_values:
        if not raw:
            continue
        try:
            p = Path(str(raw))
            candidates.append(p)
            if not p.is_absolute():
                candidates.append(Path.cwd() / p)
        except Exception:
            pass

    api_path = str(record.get("output_api_path") or record.get("outputApiPath") or record.get("video_api_path") or record.get("videoApiPath") or "").strip()
    if api_path:
        rel = api_path.lstrip("/")
        if rel.startswith("static/"):
            candidates.append(Path(rel))
            candidates.append(Path.cwd() / rel)
        elif rel.startswith("assets/"):
            candidates.append(Path("static") / rel)
            candidates.append(Path.cwd() / "static" / rel)

    output_name = str(record.get("output_name") or record.get("outputName") or record.get("video_name") or record.get("videoName") or "").strip()
    if output_name:
        candidates.append(Path("static") / "assets" / "board_assembly" / output_name)
        candidates.append(Path.cwd() / "static" / "assets" / "board_assembly" / output_name)

    # Keep order but remove duplicates.
    seen: set[str] = set()
    result: list[Path] = []
    for p in candidates:
        key = str(p)
        if key in seen:
            continue
        seen.add(key)
        result.append(p)
    return result


def _telegram_assembly_resolve_download_path_v213q(record: dict[str, Any]) -> Path | None:
    for path in _telegram_assembly_download_candidate_paths_v213q(record):
        try:
            if path.exists() and path.is_file() and path.stat().st_size > 0:
                return path
        except Exception:
            continue
    return None


def _telegram_assembly_load_download_record_v213q(download_token: str) -> dict[str, Any] | None:
    token = str(download_token or "").strip()
    if not token:
        return None
    try:
        db = store.get_db()
        downloads = db.get("telegram_assembly_downloads_v213q") or {}
        if isinstance(downloads, dict):
            record = downloads.get(token)
            if isinstance(record, dict):
                return record
        records = db.get("telegram_assembly_notifications_v140b") or {}
        if isinstance(records, dict):
            for record in records.values():
                if isinstance(record, dict) and str(record.get("download_token_v213q") or record.get("downloadTokenV213Q") or "").strip() == token:
                    return record
    except Exception as exc:
        print("[ASSEMBLY TELEGRAM DOWNLOAD LOAD ERROR V213Q]", {"token": token, "error": str(exc)}, flush=True)
    return None


def _telegram_assembly_download_caption_v213q(record: dict[str, Any], path: Path) -> str:
    project_id = str(record.get("project_id") or record.get("projectId") or "").strip()
    project_title = _telegram_assembly_project_title_v140b(project_id)
    name = str(record.get("output_name") or record.get("outputName") or path.name or "montage.mp4").strip()
    lines = ["⬇️ <b>Готовый монтаж MP4</b>"]
    if project_title:
        lines.append(f"Проект: <b>{_html(project_title)}</b>")
    if name:
        lines.append(f"Файл: <code>{_html(name)}</code>")
    return "\n".join(lines)



# AVA_ASSEMBLY_TELEGRAM_LARGE_MP4_COMPRESS_AND_URL_FALLBACK_V213S:
# Telegram Bot API rejected a 74MB assembly with HTTP 413. Keep the full-quality
# MP4 on the server, but make a Telegram-safe compressed copy for bot upload.
# If compression/upload fails, send a clickable server URL instead of a local path.
AVA_TELEGRAM_UPLOAD_SAFE_LIMIT_BYTES_V213S = 49 * 1024 * 1024
AVA_TELEGRAM_COMPRESS_TARGET_BYTES_V213S = 47 * 1024 * 1024


def _telegram_assembly_size_text_v213s(size: int | float | None) -> str:
    try:
        value = float(size or 0)
    except Exception:
        value = 0.0
    if value <= 0:
        return "0 B"
    if value >= 1024 * 1024 * 1024:
        return f"{value / (1024 * 1024 * 1024):.2f} GB"
    if value >= 1024 * 1024:
        return f"{value / (1024 * 1024):.1f} MB"
    if value >= 1024:
        return f"{value / 1024:.1f} KB"
    return f"{int(value)} B"


def _telegram_assembly_public_download_url_v213s(record: dict[str, Any], path: Path | None = None) -> str:
    for key in ("output_url", "outputUrl", "final_video_url", "finalVideoUrl", "video_url", "videoUrl"):
        raw = str(record.get(key) or "").strip()
        if raw.startswith("http://") or raw.startswith("https://"):
            return raw

    api_path = str(
        record.get("output_api_path")
        or record.get("outputApiPath")
        or record.get("video_api_path")
        or record.get("videoApiPath")
        or ""
    ).strip()
    if not api_path and path:
        try:
            p = Path(path)
            parts = [part.replace("\\", "/") for part in p.parts]
            joined = "/".join(parts)
            marker = "static/assets/"
            if marker in joined:
                api_path = "/" + joined[joined.index(marker):]
        except Exception:
            pass

    if not api_path:
        return ""
    if api_path.startswith("http://") or api_path.startswith("https://"):
        return api_path

    settings = get_settings()
    base = str(
        getattr(settings, "telegram_backend_base_url", "")
        or getattr(settings, "backend_base_url", "")
        or getattr(settings, "public_backend_base_url", "")
        or getattr(settings, "api_base_url", "")
        or ""
    ).strip().rstrip("/")

    # Existing local dev default used by Ava Studio in the user's logs.
    if not base:
        base = "http://100.80.135.114:8010"
    return base + "/" + api_path.lstrip("/")


def _telegram_assembly_url_markup_v213s(url: str) -> dict[str, Any] | None:
    clean = str(url or "").strip()
    if not clean:
        return None
    return {"inline_keyboard": [[{"text": "🌐 Открыть / скачать MP4", "url": clean}]]}


def _telegram_assembly_ffprobe_duration_v213s(path: Path, record: dict[str, Any]) -> float:
    for raw in (record.get("duration_sec"), record.get("durationSec"), record.get("duration")):
        try:
            value = float(raw or 0)
            if value > 0:
                return value
        except Exception:
            pass
    ffprobe = shutil.which("ffprobe") or "ffprobe"
    try:
        proc = subprocess.run(
            [ffprobe, "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if proc.returncode == 0:
            value = float(str(proc.stdout or "").strip() or 0)
            if value > 0:
                return value
    except Exception as exc:
        print("[ASSEMBLY TELEGRAM FFPROBE SKIP V213S]", {"path": str(path), "error": str(exc)}, flush=True)
    return 0.0


def _telegram_assembly_compressed_path_v213s(path: Path) -> Path:
    return path.with_name(path.stem + "_telegram_safe.mp4")



# AVA_TELEGRAM_SAFE_MP4_FULL_VIDEO_REENCODE_V213T:
# Telegram's player can show audio over black if the compressed copy has broken
# video timestamps/stream duration. V213T makes the safe copy a clean CFR 30fps
# H.264 MP4, validates video duration, and does not reuse old pre-V213T safe files.
def _telegram_assembly_safe_meta_path_v213t(path: Path) -> Path:
    return path.with_name(path.name + ".v213t.ok.json")


def _telegram_assembly_probe_json_v213t(path: Path, args: list[str]) -> dict[str, Any]:
    ffprobe = shutil.which("ffprobe") or "ffprobe"
    try:
        proc = subprocess.run(
            [ffprobe, "-v", "error", *args, "-of", "json", str(path)],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if proc.returncode == 0:
            return json.loads(str(proc.stdout or "{}") or "{}")
    except Exception as exc:
        print("[ASSEMBLY TELEGRAM FFPROBE JSON ERROR V213T]", {"path": str(path), "error": str(exc)}, flush=True)
    return {}


def _telegram_assembly_video_stream_duration_v213t(path: Path) -> float:
    data = _telegram_assembly_probe_json_v213t(path, ["-select_streams", "v:0", "-show_entries", "stream=duration,nb_frames"])
    streams = data.get("streams") if isinstance(data, dict) else None
    if isinstance(streams, list) and streams:
        stream = streams[0] if isinstance(streams[0], dict) else {}
        for key in ("duration",):
            try:
                value = float(stream.get(key) or 0)
                if value > 0:
                    return value
            except Exception:
                pass
    return 0.0


def _telegram_assembly_format_duration_v213t(path: Path) -> float:
    data = _telegram_assembly_probe_json_v213t(path, ["-show_entries", "format=duration"])
    fmt = data.get("format") if isinstance(data, dict) else None
    if isinstance(fmt, dict):
        try:
            value = float(fmt.get("duration") or 0)
            if value > 0:
                return value
        except Exception:
            pass
    return 0.0


def _telegram_assembly_validate_video_duration_v213t(path: Path, expected_duration: float) -> bool:
    try:
        if not path.exists() or path.stat().st_size <= 0:
            return False
    except Exception:
        return False
    try:
        expected = float(expected_duration or 0)
    except Exception:
        expected = 0.0
    if expected <= 0:
        return True
    video_duration = _telegram_assembly_video_stream_duration_v213t(path)
    format_duration = _telegram_assembly_format_duration_v213t(path)
    ok = bool(video_duration >= max(1.0, expected * 0.96))
    print("[ASSEMBLY TELEGRAM SAFE VALIDATE V213T]", {
        "path": str(path),
        "ok": ok,
        "expectedDurationSec": round(expected, 3),
        "videoDurationSec": round(video_duration, 3),
        "formatDurationSec": round(format_duration, 3),
        "size": path.stat().st_size if path.exists() else 0,
    }, flush=True)
    return ok


def _telegram_assembly_mark_safe_copy_v213t(original_path: Path, safe_path: Path, expected_duration: float) -> None:
    meta = _telegram_assembly_safe_meta_path_v213t(safe_path)
    try:
        payload = {
            "marker": "AVA_TELEGRAM_SAFE_MP4_FULL_VIDEO_REENCODE_V213T",
            "original": str(original_path),
            "safe": str(safe_path),
            "expected_duration_sec": float(expected_duration or 0),
            "safe_size": safe_path.stat().st_size if safe_path.exists() else 0,
            "created_at": now_iso(),
        }
        meta.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as exc:
        print("[ASSEMBLY TELEGRAM SAFE META WRITE ERROR V213T]", {"path": str(meta), "error": str(exc)}, flush=True)


def _telegram_assembly_remove_old_safe_copy_v213t(safe_path: Path) -> None:
    # Old V213S safe files may already be under Telegram's size limit but still broken.
    # Remove them unless a V213T metadata marker says they were generated by the fixed encoder.
    meta = _telegram_assembly_safe_meta_path_v213t(safe_path)
    try:
        if safe_path.exists() and safe_path.is_file() and not meta.exists():
            print("[ASSEMBLY TELEGRAM SAFE CACHE INVALIDATE V213T]", {"path": str(safe_path), "reason": "missing_v213t_meta"}, flush=True)
            safe_path.unlink()
    except Exception as exc:
        print("[ASSEMBLY TELEGRAM SAFE CACHE INVALIDATE ERROR V213T]", {"path": str(safe_path), "error": str(exc)}, flush=True)
    try:
        for tmp in safe_path.parent.glob(safe_path.stem + ".tmp*" + safe_path.suffix):
            tmp.unlink()
    except Exception:
        pass

def _telegram_assembly_compress_for_telegram_v213s(path: Path, record: dict[str, Any], target_bytes: int = AVA_TELEGRAM_COMPRESS_TARGET_BYTES_V213S) -> Path | None:
    try:
        original_size = path.stat().st_size
    except Exception:
        original_size = 0
    if original_size > 0 and original_size <= AVA_TELEGRAM_UPLOAD_SAFE_LIMIT_BYTES_V213S:
        return path

    dst = _telegram_assembly_compressed_path_v213s(path)
    duration = _telegram_assembly_ffprobe_duration_v213s(path, record)
    if duration <= 0:
        duration = 180.0
    _telegram_assembly_remove_old_safe_copy_v213t(dst)
    try:
        if (
            dst.exists()
            and dst.is_file()
            and 0 < dst.stat().st_size <= AVA_TELEGRAM_UPLOAD_SAFE_LIMIT_BYTES_V213S
            and _telegram_assembly_safe_meta_path_v213t(dst).exists()
            and _telegram_assembly_validate_video_duration_v213t(dst, duration)
        ):
            return dst
    except Exception:
        pass

    ffmpeg = shutil.which("ffmpeg") or "ffmpeg"

    # Keep a safety margin for container overhead; Telegram rejects close-to-limit uploads.
    total_bps = max(700_000, int((float(target_bytes) * 8.0 * 0.90) / max(duration, 1.0)))
    audio_bps = 96_000 if duration > 120 else 128_000
    video_bps = max(450_000, total_bps - audio_bps)
    video_k = max(450, int(video_bps / 1000))
    audio_k = max(64, int(audio_bps / 1000))

    attempts = [
        {"video_k": video_k, "audio_k": audio_k, "scale": "scale='min(1280,iw)':-2"},
        {"video_k": max(380, int(video_k * 0.78)), "audio_k": 80, "scale": "scale='min(960,iw)':-2"},
    ]
    for index, params in enumerate(attempts, start=1):
        tmp = dst.with_name(dst.stem + f".tmp{index}" + dst.suffix)
        try:
            if tmp.exists():
                tmp.unlink()
        except Exception:
            pass
        vf_v213t = f"fps=30,{params['scale']},setsar=1,setpts=PTS-STARTPTS"
        cmd = [
            ffmpeg, "-y", "-hide_banner",
            "-fflags", "+genpts",
            "-i", str(path),
            "-map", "0:v:0", "-map", "0:a:0?",
            "-t", f"{float(duration):.3f}",
            "-vf", vf_v213t,
            "-af", "aresample=async=1:first_pts=0",
            "-r", "30", "-vsync", "cfr",
            "-c:v", "libx264", "-preset", "veryfast",
            "-profile:v", "high", "-level", "4.1",
            "-b:v", f"{int(params['video_k'])}k",
            "-maxrate", f"{int(params['video_k'] * 1.25)}k",
            "-bufsize", f"{int(params['video_k'] * 2)}k",
            "-x264-params", "keyint=60:min-keyint=30:scenecut=40",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", f"{int(params['audio_k'])}k", "-ar", "48000", "-ac", "2",
            "-movflags", "+faststart",
            "-avoid_negative_ts", "make_zero",
            str(tmp),
        ]
        print("[ASSEMBLY TELEGRAM COMPRESS START V213S]", {
            "path": str(path), "tmp": str(tmp), "attempt": index,
            "originalSize": original_size, "durationSec": round(duration, 3),
            "videoK": int(params["video_k"]), "audioK": int(params["audio_k"]),
        }, flush=True)
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
            if proc.returncode != 0:
                print("[ASSEMBLY TELEGRAM COMPRESS ERROR V213S]", {
                    "attempt": index, "returncode": proc.returncode,
                    "stderr": str(proc.stderr or "")[-1200:],
                }, flush=True)
                continue
            size = tmp.stat().st_size if tmp.exists() else 0
            print("[ASSEMBLY TELEGRAM COMPRESS DONE V213S]", {
                "attempt": index, "tmp": str(tmp), "size": size,
                "safeLimit": AVA_TELEGRAM_UPLOAD_SAFE_LIMIT_BYTES_V213S,
            }, flush=True)
            if size > 0:
                if not _telegram_assembly_validate_video_duration_v213t(tmp, duration):
                    print("[ASSEMBLY TELEGRAM COMPRESS BAD VIDEO DURATION V213T]", {
                        "attempt": index,
                        "tmp": str(tmp),
                        "expectedDurationSec": round(float(duration or 0), 3),
                    }, flush=True)
                    try:
                        tmp.unlink()
                    except Exception:
                        pass
                    continue
                try:
                    if dst.exists():
                        dst.unlink()
                    tmp.replace(dst)
                except Exception:
                    shutil.copy2(tmp, dst)
                    try:
                        tmp.unlink()
                    except Exception:
                        pass
                if dst.stat().st_size <= AVA_TELEGRAM_UPLOAD_SAFE_LIMIT_BYTES_V213S:
                    _telegram_assembly_mark_safe_copy_v213t(path, dst, duration)
                    return dst
        except Exception as exc:
            print("[ASSEMBLY TELEGRAM COMPRESS EXCEPTION V213S]", {"attempt": index, "error": str(exc)}, flush=True)

    try:
        if dst.exists() and dst.is_file() and dst.stat().st_size > 0:
            return dst
    except Exception:
        pass
    return None


def _telegram_assembly_caption_for_path_v213s(record: dict[str, Any], original_path: Path, send_path: Path) -> str:
    caption = _telegram_assembly_download_caption_v213q(record, send_path)
    try:
        if send_path.resolve() != original_path.resolve():
            caption += (
                "\n\nℹ️ Отправлена сжатая Telegram-версия. "
                f"Оригинал на сервере: {_telegram_assembly_size_text_v213s(original_path.stat().st_size)}."
            )
    except Exception:
        pass
    return caption


def _telegram_assembly_large_file_fallback_v213s(record: dict[str, Any], path: Path, result: dict[str, Any], chat_id: str = "") -> None:
    url = _telegram_assembly_public_download_url_v213s(record, path)
    try:
        size_text = _telegram_assembly_size_text_v213s(path.stat().st_size)
    except Exception:
        size_text = "unknown"
    error_text = str(result.get("error") or result.get("body") or "")[:300]
    lines = [
        "⚠️ Telegram не принял MP4 как файл.",
        f"Размер: <b>{_html(size_text)}</b>",
    ]
    if "413" in str(result.get("status") or "") or "Request Entity Too Large" in error_text:
        lines.append("Причина: лимит размера загрузки Bot API.")
    if url:
        lines.extend(["", "Можно скачать по кнопке ниже:", f"<code>{_html(url)}</code>"])
    else:
        lines.extend(["", f"Файл есть на сервере: <code>{_html(str(path))}</code>"])
    _send_message("\n".join(lines), reply_markup=_telegram_assembly_url_markup_v213s(url), chat_id=chat_id)

def _telegram_assembly_send_document_worker_v213q(download_token: str, chat_id: str = "") -> None:
    token = str(download_token or "").strip()
    allowed_chat_id = str(chat_id or _telegram_chat_id() or "").strip()
    record = _telegram_assembly_load_download_record_v213q(token)
    if not isinstance(record, dict):
        _send_message("⚠️ Не нашёл запись готового монтажа для скачивания. Открой Assembly и проверь результат вручную.", chat_id=allowed_chat_id)
        return
    path = _telegram_assembly_resolve_download_path_v213q(record)
    if not path:
        known_ref = str(record.get("output_api_path") or record.get("outputApiPath") or record.get("output_path") or record.get("outputPath") or "").strip()
        _send_message(
            "⚠️ Не нашёл MP4-файл на диске для отправки в Telegram.\n"
            + (f"Ссылка/путь в записи: <code>{_html(known_ref)}</code>" if known_ref else "Открой Assembly и пересохрани результат."),
            chat_id=allowed_chat_id,
        )
        return

    send_path = path
    try:
        if path.stat().st_size > AVA_TELEGRAM_UPLOAD_SAFE_LIMIT_BYTES_V213S:
            compressed_path_v213s = _telegram_assembly_compress_for_telegram_v213s(path, record)
            if compressed_path_v213s and compressed_path_v213s.exists():
                send_path = compressed_path_v213s
    except Exception as exc:
        print("[ASSEMBLY TELEGRAM PREPARE SEND ERROR V213S]", {"path": str(path), "error": str(exc)}, flush=True)

    caption = _telegram_assembly_caption_for_path_v213s(record, path, send_path)
    result = _telegram_post_multipart(
        "sendDocument",
        {"chat_id": allowed_chat_id, "caption": caption, "parse_mode": "HTML"},
        {"document": send_path},
        timeout=300,
    )

    # If the first attempt still hit Telegram 413, retry once with a stronger compressed copy.
    if not bool(result.get("ok")) and str(result.get("status") or "").strip() == "413":
        compressed_path_v213s = _telegram_assembly_compress_for_telegram_v213s(path, record, target_bytes=44 * 1024 * 1024)
        if compressed_path_v213s and compressed_path_v213s.exists() and str(compressed_path_v213s) != str(send_path):
            send_path = compressed_path_v213s
            caption = _telegram_assembly_caption_for_path_v213s(record, path, send_path)
            result = _telegram_post_multipart(
                "sendDocument",
                {"chat_id": allowed_chat_id, "caption": caption, "parse_mode": "HTML"},
                {"document": send_path},
                timeout=300,
            )

    sent_ok = bool(result.get("ok"))
    at = now_iso()

    def save_result(db: dict[str, Any]) -> dict[str, Any]:
        downloads = db.setdefault("telegram_assembly_downloads_v213q", {})
        if not isinstance(downloads, dict):
            downloads = {}
            db["telegram_assembly_downloads_v213q"] = downloads
        saved = downloads.get(token) if isinstance(downloads.get(token), dict) else dict(record)
        saved.update({
            "download_token_v213q": token,
            "downloadTokenV213Q": token,
            "last_download_at_v213q": at,
            "lastDownloadAtV213Q": at,
            "last_download_ok_v213q": sent_ok,
            "lastDownloadOkV213Q": sent_ok,
            "last_download_result_v213q": result,
            "lastDownloadResultV213Q": result,
        })
        downloads[token] = saved
        return saved

    try:
        store.update(save_result)
    except Exception as exc:
        print("[ASSEMBLY TELEGRAM DOWNLOAD SAVE ERROR V213Q]", {"token": token, "error": str(exc)}, flush=True)

    print("[ASSEMBLY TELEGRAM DOWNLOAD SEND V213Q]", {
        "token": token,
        "ok": sent_ok,
        "path": str(path),
        "sendPath": str(send_path),
        "size": path.stat().st_size if path.exists() else 0,
        "sendSize": send_path.stat().st_size if send_path.exists() else 0,
        "compressedV213S": str(send_path) != str(path),
        "status": result.get("status"),
        "error": str(result.get("error") or "")[:300],
    }, flush=True)
    if not sent_ok:
        _telegram_assembly_large_file_fallback_v213s(record, path, result, chat_id=allowed_chat_id)


def _handle_assembly_download_v213q(download_token: str, callback_id: str, chat_id: str, message_id: int | str = "") -> dict[str, Any]:
    token = str(download_token or "").strip()
    if not token:
        _answer_callback(callback_id, "Нет токена скачивания", True)
        return {"ok": False, "error": "missing_download_token"}
    record = _telegram_assembly_load_download_record_v213q(token)
    if not isinstance(record, dict):
        _answer_callback(callback_id, "Файл не найден", True)
        return {"ok": False, "error": "download_record_not_found"}
    _answer_callback(callback_id, "Отправляю MP4 в Telegram…")
    thread = threading.Thread(
        target=_telegram_assembly_send_document_worker_v213q,
        args=(token, str(chat_id or _telegram_chat_id() or "")),
        daemon=True,
        name=f"ava_assembly_download_{token[:8]}",
    )
    thread.start()
    return {"ok": True, "status": "assembly_download_started_v213q", "download_token": token}

def telegram_assembly_render_completed(
    project_id: str = "",
    assembly_job_id: str = "",
    output_asset_id: str = "",
    output_api_path: str = "",
    output_name: str = "",
    output_path: str = "",
    duration_sec: Any = None,
    scene_count: Any = None,
    **kwargs: Any,
) -> dict[str, Any]:
    """Send exactly one text notification when Assembly final MP4 is ready."""
    if not _telegram_enabled():
        return {"ok": False, "status": "telegram_disabled"}

    clean_project_id = str(project_id or "").strip()
    clean_job_id = str(assembly_job_id or "").strip()
    clean_asset_id = str(output_asset_id or "").strip()
    clean_api_path = str(output_api_path or "").strip()
    clean_output_name = str(output_name or "").strip()
    clean_output_path = str(output_path or "").strip()
    notification_key = _telegram_assembly_notification_key_v140b(
        project_id=clean_project_id,
        assembly_job_id=clean_job_id,
        output_asset_id=clean_asset_id,
        output_api_path=clean_api_path,
        output_name=clean_output_name,
        output_path=clean_output_path,
    )
    download_token_v213q = _telegram_assembly_download_token_v213q(notification_key)

    now = now_iso()

    def reserve_once(db: dict[str, Any]) -> dict[str, Any]:
        records = db.setdefault("telegram_assembly_notifications_v140b", {})
        if not isinstance(records, dict):
            records = {}
            db["telegram_assembly_notifications_v140b"] = records
        existing = records.get(notification_key)
        if isinstance(existing, dict) and (existing.get("reserved") or existing.get("sent") or existing.get("ok")):
            existing.setdefault("download_token_v213q", download_token_v213q)
            existing.setdefault("downloadTokenV213Q", download_token_v213q)
            downloads = db.setdefault("telegram_assembly_downloads_v213q", {})
            if not isinstance(downloads, dict):
                downloads = {}
                db["telegram_assembly_downloads_v213q"] = downloads
            downloads[download_token_v213q] = existing
            return {
                "ok": True,
                "already_notified": True,
                "sent": False,
                "notification_key": notification_key,
                "record": existing,
            }
        record = {
            "notification_key": notification_key,
            "notificationKey": notification_key,
            "project_id": clean_project_id,
            "projectId": clean_project_id,
            "assembly_job_id": clean_job_id,
            "assemblyJobId": clean_job_id,
            "output_asset_id": clean_asset_id,
            "outputAssetId": clean_asset_id,
            "output_api_path": clean_api_path,
            "outputApiPath": clean_api_path,
            "output_name": clean_output_name,
            "outputName": clean_output_name,
            "output_path": clean_output_path,
            "outputPath": clean_output_path,
            "download_token_v213q": download_token_v213q,
            "downloadTokenV213Q": download_token_v213q,
            "reserved": True,
            "sent": False,
            "created_at": now,
            "createdAt": now,
            "updated_at": now,
            "updatedAt": now,
        }
        records[notification_key] = record
        downloads = db.setdefault("telegram_assembly_downloads_v213q", {})
        if not isinstance(downloads, dict):
            downloads = {}
            db["telegram_assembly_downloads_v213q"] = downloads
        downloads[download_token_v213q] = record
        return {"ok": True, "already_notified": False, "notification_key": notification_key, "record": record}

    reserved = store.update(reserve_once)
    if reserved.get("already_notified"):
        print("[ASSEMBLY TELEGRAM NOTICE SKIP V140B]", {
            "project_id": clean_project_id,
            "job_id": clean_job_id,
            "notification_key": notification_key,
            "reason": "duplicate",
        }, flush=True)
        return {
            "ok": True,
            "sent": False,
            "duplicate": True,
            "telegram_notified": True,
            "telegram_notification_key": notification_key,
            "telegramNotificationKey": notification_key,
        }

    project_title = _telegram_assembly_project_title_v140b(clean_project_id)
    duration_text = _telegram_assembly_format_duration_v140b(duration_sec)
    try:
        scene_count_int = int(scene_count or 0)
    except Exception:
        scene_count_int = 0

    lines = [
        "🎬 <b>Монтаж готов!</b>",
        "",
        "✅ Итоговое видео успешно собрано.",
    ]
    detail_lines: list[str] = []
    if project_title:
        detail_lines.append(f"Проект: <b>{_html(project_title)}</b>")
    if duration_text:
        detail_lines.append(f"Длительность: <b>{_html(duration_text)}</b>")
    if scene_count_int > 0:
        detail_lines.append(f"Сцен: <b>{scene_count_int}</b>")
    if detail_lines:
        lines.append("")
        lines.extend(detail_lines)
    lines.extend(["", "Можно открывать Ava Studio → Assembly и проверять результат."])
    text = "\n".join(lines)

    result = _send_message(text, reply_markup=_telegram_assembly_download_markup_v213q(download_token_v213q))
    sent_at = now_iso()
    sent_ok = bool(result.get("ok"))

    def finalize_notice(db: dict[str, Any]) -> dict[str, Any]:
        records = db.setdefault("telegram_assembly_notifications_v140b", {})
        if not isinstance(records, dict):
            records = {}
            db["telegram_assembly_notifications_v140b"] = records
        record = records.get(notification_key)
        if not isinstance(record, dict):
            record = {"notification_key": notification_key, "notificationKey": notification_key}
        record.update({
            "reserved": True,
            "sent": sent_ok,
            "ok": sent_ok,
            "sent_at": sent_at if sent_ok else "",
            "sentAt": sent_at if sent_ok else "",
            "updated_at": sent_at,
            "updatedAt": sent_at,
            "telegram_result": result,
            "telegramResult": result,
            "message": text,
            "download_token_v213q": download_token_v213q,
            "downloadTokenV213Q": download_token_v213q,
        })
        records[notification_key] = record
        downloads = db.setdefault("telegram_assembly_downloads_v213q", {})
        if not isinstance(downloads, dict):
            downloads = {}
            db["telegram_assembly_downloads_v213q"] = downloads
        downloads[download_token_v213q] = record
        return record

    record = store.update(finalize_notice)
    print("[ASSEMBLY TELEGRAM NOTICE V140B]", {
        "project_id": clean_project_id,
        "job_id": clean_job_id,
        "notification_key": notification_key,
        "sent": sent_ok,
        "status": result.get("status"),
    }, flush=True)
    return {
        "ok": sent_ok,
        "sent": sent_ok,
        "telegram_notified": sent_ok,
        "telegramNotified": sent_ok,
        "telegram_notified_at": sent_at if sent_ok else "",
        "telegramNotifiedAt": sent_at if sent_ok else "",
        "telegram_notification_key": notification_key,
        "telegramNotificationKey": notification_key,
        "result": result,
        "record": record,
    }

def telegram_board_batch_started(project_id: str, queued_scene_ids: list[str] | None = None, skipped_ready: int = 0, invalid: int = 0, batch_id: str = "", user: dict[str, Any] | None = None, **kwargs: Any) -> dict[str, Any]:
    if not _telegram_enabled():
        return {"ok": False, "status": "telegram_disabled"}
    scene_ids = [str(item) for item in (queued_scene_ids or []) if str(item).strip()]
    project_name = _project_name(project_id)

    def op(db: dict[str, Any]) -> dict[str, Any]:
        # AVA_TELEGRAM_REVIEW_STATS_CURRENT_BATCH_V137L:
        # A new Board batch must start a clean review session. Do not merge old
        # scene ids/review ids, otherwise statistics can show old seg_03 etc.
        sessions = db.setdefault("telegram_review_sessions", {})
        now = now_iso()
        session = {
            "project_id": project_id,
            "projectId": project_id,
            "batch_id": batch_id,
            "batchId": batch_id,
            "status": "generating",
            "scene_ids": scene_ids,
            "sceneIds": scene_ids,
            "current_batch_scene_ids_v137l": scene_ids,
            "currentBatchSceneIdsV137L": scene_ids,
            "latest_review_ids_by_scene": {},
            "latestReviewIdsByScene": {},
            "created_at": now,
            "createdAt": now,
            "updated_at": now,
            "updatedAt": now,
        }
        sessions[project_id] = session

        # Clear queued ready-scenes from previous runs for this project.
        queues = db.setdefault("telegram_review_ready_queue_v137g2", {})
        queues[project_id] = []

        # Clear global latest ids for the scenes of this new batch, so until a new
        # video arrives they are counted as not_ready, not as old OK/bad.
        latest_global = db.setdefault("telegram_review_latest_by_scene", {})
        if isinstance(latest_global, dict):
            for scene_id in scene_ids:
                latest_global.pop(f"{project_id}:{scene_id}", None)

        # Drop pending comment pointer only if it belongs to this project.
        pending = db.setdefault("telegram_pending_comments", {})
        items = db.get("telegram_review_items") or {}
        if isinstance(pending, dict) and isinstance(items, dict):
            for chat_key, review_id in list(pending.items()):
                item = items.get(str(review_id))
                if isinstance(item, dict) and str(item.get("project_id") or item.get("projectId") or "") == project_id:
                    pending.pop(chat_key, None)
        return session

    store.update(op)
    text = (
        "━━━━━━━━━━━━━━━━━━━━\n"
        "🚀 <b>СТАРТ ГЕНЕРАЦИИ</b>\n\n"
        f"Проект: <b>{_html(project_name)}</b>\n"
        f"Сцен в очередь: <b>{len(scene_ids)}</b>\n"
        f"Готовые пропущены: <b>{int(skipped_ready or 0)}</b>\n"
        f"Не хватает данных: <b>{int(invalid or 0)}</b>"
    )
    result = _send_message(text)
    print("[TELEGRAM BOARD BATCH START V137A]", {"project_id": project_id, "queued": len(scene_ids), "ok": result.get("ok")}, flush=True)
    return result


def telegram_board_batch_finished(project_id: str, batch_id: str = "", status: str = "", completed: list[str] | None = None, failed: list[str] | None = None, user: dict[str, Any] | None = None, **kwargs: Any) -> dict[str, Any]:
    """Keep Telegram quiet when backend generation finishes.

    AVA_TELEGRAM_REVIEW_ON_DEMAND_SUMMARY_V137H:
    The review flow is scene-by-scene. A generation-finished event should not
    interrupt the current scene review or send final stats before the user has
    answered the last video. Full statistics are sent only when the user asks
    in Telegram, for example: "статистика", "/summary", "/stats".
    """
    if not _telegram_enabled():
        return {"ok": False, "status": "telegram_disabled"}

    def op(db: dict[str, Any]) -> dict[str, Any]:
        session = _ensure_session_in_db(db, project_id, completed or [], batch_id=batch_id)
        session["status"] = "reviewing"
        session["generation_finished_at_v137h"] = now_iso()
        session["generationFinishedAtV137H"] = session["generation_finished_at_v137h"]
        session["last_generation_status_v137h"] = str(status or "")
        session["lastGenerationStatusV137H"] = session["last_generation_status_v137h"]
        session["last_generation_completed_v137h"] = [str(x) for x in (completed or [])]
        session["lastGenerationCompletedV137H"] = session["last_generation_completed_v137h"]
        session["last_generation_failed_v137h"] = [str(x) for x in (failed or [])]
        session["lastGenerationFailedV137H"] = session["last_generation_failed_v137h"]
        return session

    store.update(op)
    print("[TELEGRAM BOARD BATCH FINISH QUIET V137H]", {
        "project_id": project_id,
        "status": status,
        "completed": len(completed or []),
        "failed": len(failed or []),
    }, flush=True)
    notice_result = _send_generation_finish_notice_v137k(project_id, batch_id=batch_id, status=status, completed=completed or [], failed=failed or [])
    return {"ok": True, "status": "batch_finished_notice_sent_v137k", "project_id": project_id, "notice": notice_result}

def telegram_board_scene_ready(project_id: str, scene_id: str, scene: dict[str, Any] | None = None, job_id: str = "", batch_id: str = "", user: dict[str, Any] | None = None, **kwargs: Any) -> dict[str, Any]:
    if not _telegram_enabled():
        return {"ok": False, "status": "telegram_disabled"}
    scene = scene if isinstance(scene, dict) else {}
    blocker = _active_review_blocker_v137g2(project_id)
    if blocker:
        # AVA_TELEGRAM_SEQUENTIAL_REVIEW_QUIET_SUMMARY_V137G2: send only one scene video at a time.
        return _queue_scene_ready_v137g2(project_id, scene_id, scene, job_id=job_id, batch_id=batch_id)
    video = _latest_scene_video(scene)
    asset_id = str(video.get("asset_id") or "").strip()
    api_path = str(video.get("api_path") or "").strip()
    job_id = str(job_id or video.get("job_id") or "").strip()
    review_id = f"tgr_{uuid4().hex[:10]}"
    project_name = _project_name(project_id)
    created_at = now_iso()
    item = {
        "review_id": review_id,
        "reviewId": review_id,
        "project_id": project_id,
        "projectId": project_id,
        "scene_id": scene_id,
        "sceneId": scene_id,
        "job_id": job_id,
        "jobId": job_id,
        "batch_id": batch_id,
        "batchId": batch_id,
        "asset_id": asset_id,
        "assetId": asset_id,
        "api_path": api_path,
        "apiPath": api_path,
        "status": "pending",
        "comment": "",
        "created_at": created_at,
        "createdAt": created_at,
        "updated_at": created_at,
        "updatedAt": created_at,
    }

    def op(db: dict[str, Any]) -> dict[str, Any]:
        items = db.setdefault("telegram_review_items", {})
        items[review_id] = item
        session = _ensure_session_in_db(db, project_id, [scene_id], batch_id=batch_id)
        latest = session.setdefault("latest_review_ids_by_scene", {})
        if not isinstance(latest, dict):
            latest = {}
        latest[scene_id] = review_id
        session["latest_review_ids_by_scene"] = latest
        session["latestReviewIdsByScene"] = latest
        session["status"] = "reviewing"
        _set_review_item_latest_for_scene(db, project_id, scene_id, review_id)
        return item

    store.update(op)
    caption = (
        f"✅ <b>{_html(project_name)}</b>\n"
        f"🎬 Сцена <b>{_html(scene_id)}</b> готова\n\n"
        "Проверь видео и отметь результат:"
    )
    keyboard = _review_callback_keyboard(review_id, project_id)
    path = _asset_path(asset_id)
    if path and path.exists():
        result = _telegram_post_multipart("sendVideo", {
            "chat_id": _telegram_chat_id(),
            "caption": caption,
            "parse_mode": "HTML",
            "reply_markup": json.dumps(keyboard, ensure_ascii=False),
            "supports_streaming": "true",
        }, {"video": path})
    else:
        result = _send_message(caption + (f"\n\nВидео: <code>{_html(api_path or asset_id)}</code>" if (api_path or asset_id) else ""), reply_markup=keyboard)

    message_id = (((result.get("result") or {}) if isinstance(result, dict) else {}).get("message_id"))
    if message_id:
        def msg_op(db: dict[str, Any]) -> dict[str, Any]:
            item_saved = db.setdefault("telegram_review_items", {}).get(review_id) or {}
            item_saved["telegram_message_id"] = message_id
            item_saved["telegramMessageId"] = message_id
            item_saved["telegram_chat_id"] = _telegram_chat_id()
            item_saved["telegramChatId"] = _telegram_chat_id()
            db["telegram_review_items"][review_id] = item_saved
            return item_saved
        store.update(msg_op)
    print("[TELEGRAM BOARD SCENE READY V137A]", {"project_id": project_id, "scene_id": scene_id, "review_id": review_id, "asset_id": asset_id, "ok": result.get("ok")}, flush=True)
    return result


def _load_review_item(review_id: str) -> dict[str, Any] | None:
    try:
        item = (store.get_db().get("telegram_review_items") or {}).get(review_id)
        return item if isinstance(item, dict) else None
    except Exception:
        return None


def _handle_ok(review_id: str, callback_id: str, chat_id: str, message_id: int | str) -> dict[str, Any]:
    item = _load_review_item(review_id)
    if not item:
        _answer_callback(callback_id, "Review item не найден", True)
        return {"ok": False, "error": "review_not_found"}
    project_id = str(item.get("project_id") or item.get("projectId") or "")
    scene_id = str(item.get("scene_id") or item.get("sceneId") or "")
    latest = _review_item_latest_for_scene(store.get_db(), project_id, scene_id)
    if latest and latest != review_id:
        _answer_callback(callback_id, "Это старое видео. Уже есть более новый результат.", True)
        return {"ok": False, "error": "stale_review"}
    at = now_iso()

    def op(db: dict[str, Any]) -> dict[str, Any]:
        saved = db.setdefault("telegram_review_items", {}).get(review_id) or item
        saved["status"] = "ok"
        saved["comment"] = ""
        saved["updated_at"] = at
        saved["updatedAt"] = at
        db["telegram_review_items"][review_id] = saved
        return saved

    saved_item = store.update(op)
    _save_project_board_review(project_id, scene_id, "", "telegram_review_ok_v137a", saved_item)
    _edit_reply_markup(chat_id, message_id, {"inline_keyboard": [[{"text": "✅ OK отмечено", "callback_data": "ava:noop"}]]})
    _answer_callback(callback_id, f"{scene_id}: OK")
    _send_message(
        f"🎉 <b>Отлично!</b>\n\n"
        f"✅ Сцена <b>{_html(scene_id)}</b> отмечена OK.\n"
        "🥳 Видео принято."
    )
    _flush_next_review_queue_v137g2(project_id)
    _maybe_send_final_review_summary_v137g2(project_id)
    return {"ok": True}


def _handle_bad(review_id: str, callback_id: str, chat_id: str, message_id: int | str) -> dict[str, Any]:
    """V149A: mark "не OK" immediately, without force-reply comment flow.

    This keeps Telegram light: no pending-comment state, no waiting blocker, and
    no extra requirement before later scene videos can arrive.
    """
    item = _load_review_item(review_id)
    if not item:
        _answer_callback(callback_id, "Review item не найден", True)
        return {"ok": False, "error": "review_not_found"}
    project_id = str(item.get("project_id") or item.get("projectId") or "")
    scene_id = str(item.get("scene_id") or item.get("sceneId") or "")
    latest = _review_item_latest_for_scene(store.get_db(), project_id, scene_id)
    if latest and latest != review_id:
        _answer_callback(callback_id, "Это старое видео. Уже есть более новый результат.", True)
        return {"ok": False, "error": "stale_review"}

    current_status = str(item.get("status") or "").strip()
    if current_status == "bad":
        _answer_callback(callback_id, f"{scene_id}: не OK уже отмечено")
        return {"ok": True, "status": "already_bad"}
    if current_status == "ok":
        _answer_callback(callback_id, f"{scene_id}: уже отмечена OK", True)
        return {"ok": False, "status": "already_ok"}

    # Answer callback before store/message work, otherwise Telegram may reject it
    # as too old when local storage or network is slow.
    _answer_callback(callback_id, f"{scene_id}: не OK")
    at = now_iso()

    def op(db: dict[str, Any]) -> dict[str, Any]:
        saved = db.setdefault("telegram_review_items", {}).get(review_id) or item
        saved["status"] = "bad"
        saved["comment"] = ""
        saved["updated_at"] = at
        saved["updatedAt"] = at
        db["telegram_review_items"][review_id] = saved
        # Do not leave a pending-comment pointer behind for this chat.
        pending = db.setdefault("telegram_pending_comments", {})
        pending.pop(str(chat_id), None)
        return saved

    saved_item = store.update(op)
    _save_project_board_review(project_id, scene_id, "bad", "telegram_review_bad_quick_v149a", saved_item, comment="")
    _edit_reply_markup(chat_id, message_id, {"inline_keyboard": [[{"text": "🔁 не OK отмечено", "callback_data": "ava:noop"}]]})
    _send_message(
        f"🔁 <b>{_html(scene_id)}</b> отмечена как <b>не OK</b>.\n"
        "Статус сохранён в Board. Комментарий можно добавить позже в заметке сцены."
    )
    # Queue blocker is disabled in V149A, but this keeps old queued items moving
    # if they existed before the patch.
    _flush_next_review_queue_v137g2(project_id)
    _maybe_send_final_review_summary_v137g2(project_id)
    return {"ok": True, "status": "bad_quick_v149a"}

def _handle_comment(chat_id: str, text: str, message_id: int | str = "") -> dict[str, Any]:
    review_id = ""

    def get_pending(db: dict[str, Any]) -> str:
        return str((db.get("telegram_pending_comments") or {}).get(str(chat_id)) or "")

    review_id = store.update(lambda db: get_pending(db))
    if not review_id:
        return {"ok": False, "status": "no_pending_comment"}
    item = _load_review_item(review_id)
    if not item:
        return {"ok": False, "error": "review_not_found"}
    comment = str(text or "").strip()
    if not comment:
        return {"ok": False, "error": "empty_comment"}
    if len(comment) > 1200:
        comment = comment[:1200].rstrip()
    project_id = str(item.get("project_id") or item.get("projectId") or "")
    scene_id = str(item.get("scene_id") or item.get("sceneId") or "")
    at = now_iso()

    def op(db: dict[str, Any]) -> dict[str, Any]:
        saved = db.setdefault("telegram_review_items", {}).get(review_id) or item
        saved["status"] = "bad"
        saved["comment"] = comment
        saved["updated_at"] = at
        saved["updatedAt"] = at
        db["telegram_review_items"][review_id] = saved
        db.setdefault("telegram_pending_comments", {}).pop(str(chat_id), None)
        return saved

    saved_item = store.update(op)
    _save_project_board_review(project_id, scene_id, "bad", "telegram_review_bad_with_comment_v137a", saved_item, comment=comment)
    _send_message(
        f"📝 <b>Комментарий сохранён</b> для <b>{_html(scene_id)}</b>\n"
        "Статус: <b>не OK</b>\n"
        "Заметка добавлена в Board UI."
    )
    prompt_chat_id = str(saved_item.get("comment_prompt_chat_id_v137k") or saved_item.get("commentPromptChatIdV137K") or chat_id or "")
    prompt_message_id = saved_item.get("comment_prompt_message_id_v137k") or saved_item.get("commentPromptMessageIdV137K")
    _delete_message_v137k(prompt_chat_id, prompt_message_id)
    _delete_message_v137k(chat_id, message_id)
    _flush_next_review_queue_v137g2(project_id)
    _maybe_send_final_review_summary_v137g2(project_id)
    return {"ok": True}


def _bad_scene_ids_from_board(project_id: str) -> list[str]:
    db = store.get_db()
    board = _board_data_from_db(db, project_id)
    scenes = board.get("scenes") if isinstance(board.get("scenes"), list) else []
    result: list[str] = []
    for index, scene in enumerate(scenes):
        if not isinstance(scene, dict):
            continue
        raw = str(scene.get("video_review_status") or scene.get("videoReviewStatus") or scene.get("review_status") or scene.get("reviewStatus") or "").strip().lower()
        bad_flags = bool(scene.get("bad_video_review") or scene.get("badVideoReview") or scene.get("video_review_bad") or scene.get("videoReviewBad"))
        if raw in {"bad", "poor", "reject", "rejected", "плохое", "плохая"} or bad_flags:
            result.append(_scene_id(scene, index))
    return result


def _handle_regen_bad(project_id: str, callback_id: str) -> dict[str, Any]:
    # AVA_TELEGRAM_REVIEW_MANUAL_ONLY_V137F:
    # Old messages may still contain a "Regenerate bad" button. Keep the callback safe,
    # but do not start backend generation from Telegram.
    _answer_callback(callback_id, "Авто-регенерация из Telegram отключена", True)
    project_name = _project_name(project_id)
    _send_message(
        "🛠 <b>Авто-регенерация отключена</b>\n\n"
        f"Проект: <b>{_html(project_name)}</b>\n"
        "Плохие сцены уже отмечены и комментарии сохранены в Board.\n"
        "Открой Board, поправь positive/negative prompt или настройки сцены и запусти регенерацию вручную."
    )
    return {"ok": False, "status": "telegram_regen_disabled_v137f", "project_id": project_id}
@router.get("/status")
def telegram_status() -> dict[str, Any]:
    settings = get_settings()
    token = _telegram_token()
    chat_id = _telegram_chat_id()
    return {
        "ok": True,
        "marker": TG_REVIEW_MARKER,
        "telegram_enabled": _telegram_enabled(),
        "bot_configured": bool(token),
        "chat_configured": bool(chat_id),
        "chat_id": chat_id,
        "token_preview": (token[:6] + "..." + token[-4:]) if len(token) > 12 else ("set" if token else ""),
        "frontend_base_url": str(getattr(settings, "telegram_frontend_base_url", "") or ""),
    }


@router.post("/test")
def telegram_test(payload: TelegramTestIn | None = None) -> dict[str, Any]:
    text = (payload.text if payload else None) or "✅ Ava Studio Telegram test"
    return _send_message(_html(text))




def _latest_review_project_id_v137h() -> str:
    """Pick the most recently updated Telegram review session for text commands."""
    try:
        db = store.get_db()
        sessions = db.get("telegram_review_sessions") or {}
        if not isinstance(sessions, dict) or not sessions:
            return ""
        best_project = ""
        best_at = ""
        for project_id, session in sessions.items():
            if not isinstance(session, dict):
                continue
            updated = str(session.get("updated_at") or session.get("updatedAt") or session.get("created_at") or session.get("createdAt") or "")
            if not best_project or updated >= best_at:
                best_project = str(project_id)
                best_at = updated
        return best_project
    except Exception as exc:
        print("[TELEGRAM LATEST PROJECT ERROR V137H]", {"error": str(exc)}, flush=True)
        return ""


def _is_summary_request_v137h(text: str) -> bool:
    raw = str(text or "").strip().lower()
    raw = re.sub(r"\s+", " ", raw)
    return raw in {
        "/summary", "/stats", "/status", "/review", "/итог", "/статистика", "/проверка",
        "summary", "stats", "status", "review",
        "статистика", "итог", "проверка", "отчет", "отчёт", "покажи статистику", "дай статистику",
    }


def _handle_summary_request_v137h(chat_id: str) -> dict[str, Any]:
    project_id = _latest_review_project_id_v137h()
    if not project_id:
        result = _send_message("📊 Пока нет активной проверки сцен.", chat_id=chat_id)
        return {"ok": bool(result.get("ok")), "status": "no_active_review_session_v137h"}
    result = _send_review_summary(project_id, chat_id=chat_id)
    return {"ok": bool(result.get("ok")), "status": "summary_sent_v137h", "project_id": project_id}

def _process_update(update: dict[str, Any]) -> dict[str, Any]:
    try:
        callback = update.get("callback_query") if isinstance(update, dict) else None
        if isinstance(callback, dict):
            callback_id = str(callback.get("id") or "")
            data = str(callback.get("data") or "")
            message = callback.get("message") if isinstance(callback.get("message"), dict) else {}
            chat = message.get("chat") if isinstance(message.get("chat"), dict) else {}
            chat_id = str(chat.get("id") or "")
            message_id = message.get("message_id") or ""
            if _telegram_chat_id() and chat_id != _telegram_chat_id():
                _answer_callback(callback_id, "Этот chat_id не разрешён", True)
                return {"ok": False, "error": "chat_not_allowed"}
            if data == "ava:noop":
                _answer_callback(callback_id, "Уже принято")
                return {"ok": True}
            parts = data.split(":")
            if len(parts) >= 3 and parts[0] == "ava":
                action = parts[1]
                ident = parts[2]
                if action == "ok":
                    return _handle_ok(ident, callback_id, chat_id, message_id)
                if action == "bad":
                    return _handle_bad(ident, callback_id, chat_id, message_id)
                if action == "summary":
                    _answer_callback(callback_id, "Показываю статистику")
                    return _handle_summary_request_v137h(chat_id)
                if action == "asm_dl":
                    return _handle_assembly_download_v213q(ident, callback_id, chat_id, message_id)
                if action == "regen":
                    return _handle_regen_bad(ident, callback_id)
            _answer_callback(callback_id, "Неизвестная кнопка", True)
            return {"ok": False, "error": "unknown_callback"}

        message = update.get("message") if isinstance(update, dict) else None
        if isinstance(message, dict):
            chat = message.get("chat") if isinstance(message.get("chat"), dict) else {}
            chat_id = str(chat.get("id") or "")
            if _telegram_chat_id() and chat_id != _telegram_chat_id():
                return {"ok": False, "error": "chat_not_allowed"}
            text = str(message.get("text") or message.get("caption") or "").strip()
            if text:
                # First priority: if we are waiting for a bad-scene comment, save this text as the comment.
                comment_result = _handle_comment(chat_id, text, message.get("message_id") or "")
                if comment_result.get("ok") or comment_result.get("status") != "no_pending_comment":
                    return comment_result
                # If no comment is pending, allow the user to request summary explicitly.
                if _is_summary_request_v137h(text):
                    return _handle_summary_request_v137h(chat_id)
            return {"ok": True, "status": "ignored"}
    except Exception as exc:
        print("[TELEGRAM WEBHOOK ERROR V137A]", {"error": str(exc), "update": update}, flush=True)
        return {"ok": False, "error": str(exc)}
    return {"ok": True, "status": "ignored"}

@router.post("/webhook")
async def telegram_webhook(request: Request) -> dict[str, Any]:
    update = await request.json()
    return _process_update(update if isinstance(update, dict) else {})


def _telegram_get_updates_once(timeout_sec: int = 2) -> dict[str, Any]:
    if not _telegram_token():
        return {"ok": False, "error": "telegram_token_missing"}
    # AVA_TELEGRAM_POLL_NO_WRITE_ON_IDLE_V200F:
    # Reading the Telegram offset is a GET-like operation. The old code used
    # store.update() just to read offset, which rewrote ava_db.json on every
    # background poll and locked the JSON store while the UI was loading Board.
    try:
        db_for_offset_v200f = store.get_db()
        state_v200f = db_for_offset_v200f.get("telegram_poll_state_v137a") or {}
        offset = int(state_v200f.get("offset") or 0)
    except Exception as exc:
        print("[TELEGRAM POLL OFFSET READ FALLBACK V200F]", {"error": str(exc)}, flush=True)
        offset = 0
    params = {"timeout": str(max(0, int(timeout_sec))), "allowed_updates": json.dumps(["message", "callback_query"])}
    if offset:
        params["offset"] = str(offset)
    url = _api_url("getUpdates") + "?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=max(5, timeout_sec + 5)) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            data = json.loads(raw or "{}")
    except Exception as exc:
        print("[TELEGRAM POLL ERROR V137A]", {"error": str(exc)}, flush=True)
        return {"ok": False, "error": str(exc)}
    results = data.get("result") if isinstance(data, dict) else []
    processed = []
    max_update_id = offset - 1 if offset else -1
    for update in results or []:
        if not isinstance(update, dict):
            continue
        update_id = int(update.get("update_id") or 0)
        max_update_id = max(max_update_id, update_id)
        processed.append(_process_update(update))
    next_offset_v200f = max_update_id + 1 if max_update_id >= 0 else offset
    if max_update_id >= 0 and next_offset_v200f != offset:
        def save_offset(db: dict[str, Any]) -> dict[str, Any]:
            state = db.setdefault("telegram_poll_state_v137a", {})
            state["offset"] = next_offset_v200f
            state["updated_at"] = now_iso()
            return state
        store.update(save_offset)
    elif max_update_id >= 0:
        print("[TELEGRAM POLL OFFSET WRITE SKIPPED V200F]", {"offset": offset, "count": len(results or [])}, flush=True)
    return {"ok": bool(data.get("ok")) if isinstance(data, dict) else False, "count": len(results or []), "processed": processed}


def _telegram_poll_loop() -> None:
    print("[TELEGRAM POLL START V137A]", {}, flush=True)
    while not TELEGRAM_POLL_STOP.is_set():
        try:
            _telegram_get_updates_once(timeout_sec=20)
        except Exception as exc:
            print("[TELEGRAM POLL LOOP ERROR V137A]", {"error": str(exc)}, flush=True)
            time.sleep(3)
    print("[TELEGRAM POLL STOP V137A]", {}, flush=True)


@router.post("/poll")
def telegram_poll_once() -> dict[str, Any]:
    return _telegram_get_updates_once(timeout_sec=1)


@router.post("/poll/start")
def telegram_poll_start() -> dict[str, Any]:
    global TELEGRAM_POLL_THREAD
    if TELEGRAM_POLL_THREAD is not None and TELEGRAM_POLL_THREAD.is_alive():
        return {"ok": True, "status": "already_running"}
    TELEGRAM_POLL_STOP.clear()
    TELEGRAM_POLL_THREAD = threading.Thread(target=_telegram_poll_loop, daemon=True)
    TELEGRAM_POLL_THREAD.start()
    return {"ok": True, "status": "started"}


@router.on_event("startup")
def telegram_poll_autostart_v137f() -> None:
    # AVA_TELEGRAM_REVIEW_MANUAL_ONLY_V137F: local backend should process buttons after restart
    # without manually calling /api/telegram/poll/start every time.
    try:
        if not _telegram_enabled():
            print("[TELEGRAM POLL AUTOSTART V137F]", {"status": "disabled_or_not_configured"}, flush=True)
            return
        result = telegram_poll_start()
        print("[TELEGRAM POLL AUTOSTART V137F]", result, flush=True)
    except Exception as exc:
        print("[TELEGRAM POLL AUTOSTART ERROR V137F]", {"error": str(exc)}, flush=True)


@router.post("/poll/stop")
def telegram_poll_stop() -> dict[str, Any]:
    TELEGRAM_POLL_STOP.set()
    return {"ok": True, "status": "stop_requested"}


@router.get("/projects/{project_id}/review-summary")
def telegram_project_review_summary(project_id: str) -> dict[str, Any]:
    return {"ok": True, "stats": _review_stats(project_id)}


@router.post("/projects/{project_id}/notify-scene-ready")
def telegram_notify_scene_ready(project_id: str, payload: TelegramNotifySceneIn) -> dict[str, Any]:
    scene_id = str(payload.scene_id or payload.sceneId or "").strip()
    if not scene_id:
        raise HTTPException(status_code=400, detail="Missing scene_id")
    db = store.get_db()
    board = _board_data_from_db(db, project_id)
    scene = None
    for index, item in enumerate(board.get("scenes") if isinstance(board.get("scenes"), list) else []):
        if _scene_id(item, index) == scene_id:
            scene = item
            break
    return telegram_board_scene_ready(
        project_id,
        scene_id,
        scene=scene or {},
        job_id=str(payload.job_id or payload.jobId or ""),
        batch_id=str(payload.batch_id or payload.batchId or ""),
    )
