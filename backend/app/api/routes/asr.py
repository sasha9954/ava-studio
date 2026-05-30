from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
import json
import logging
import os
import re
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.deps import ensure_project_access, get_current_user
from app.core.config import get_settings
from app.core.security import make_id, now_iso
from app.core.storage import store

router = APIRouter(prefix="/asr", tags=["asr"])

logger = logging.getLogger(__name__)
TIMING_ENGINE = "old_manual_timing_asr_v1"

_WORD_CLEAN_RE = re.compile(r"\s+")
_SENTENCE_PUNCT_RE = re.compile(r"[.!?…:;]+[\"')\]]*$")


class AsrTranscribeRequest(BaseModel):
    asset_id: str
    project_id: str | None = None
    client_request_id: str | None = None
    language: str | None = None
    role_id: str = "narrator"
    role_label: str = "ДИК"
    mode: str = "speech"  # speech | music | vocal
    vad_filter: bool | None = None


class AsrTranslateRequest(BaseModel):
    speech_segments: list[dict[str, Any]] = []
    project_id: str | None = None
    client_request_id: str | None = None
    audio_phrases: list[dict[str, Any]] = []
    source_language: str | None = None
    target_language: str = "ru"
    include_meaning: bool = True



MANUAL_TIMING_AI_CREDIT_COST = 1


def _credit_public_user(user: dict) -> dict:
    return {
        "id": user.get("id"),
        "name": user.get("name"),
        "email": user.get("email"),
        "created_at": user.get("created_at"),
        "credits_balance": user.get("credits_balance", 0),
    }


def _require_manual_timing_credit(user: dict, amount: int = MANUAL_TIMING_AI_CREDIT_COST) -> None:
    db = store.get_db()
    current_user = db.get("users", {}).get(user.get("id"))
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    balance = int(current_user.get("credits_balance", 0) or 0)
    if balance < amount:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Недостаточно кредитов: нужно {amount}, доступно {balance}",
        )


def _manual_timing_job_id(action_type: str, client_request_id: Any = None) -> str:
    raw = str(client_request_id or "").strip()
    if raw:
        safe = re.sub(r"[^A-Za-z0-9_.:-]+", "_", raw)[:80]
        return f"{action_type}:{safe}"
    return f"{action_type}:{make_id('job')}"


def _charge_manual_timing_credit(
    user: dict,
    *,
    action_type: str,
    project_id: str | None = None,
    client_request_id: Any = None,
    meta: dict[str, Any] | None = None,
    amount: int = MANUAL_TIMING_AI_CREDIT_COST,
) -> dict[str, Any]:
    job_id = _manual_timing_job_id(action_type, client_request_id)

    def op(db: dict) -> dict[str, Any]:
        current_user = db.get("users", {}).get(user.get("id"))
        if not current_user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

        existing = next((
            item for item in db.get("credits_ledger", [])
            if item.get("user_id") == user.get("id")
            and item.get("job_id") == job_id
            and item.get("action_type") == action_type
            and int(item.get("amount", 0) or 0) < 0
        ), None)
        if existing:
            return {
                "charged": False,
                "duplicate": True,
                "cost": amount,
                "balance": int(current_user.get("credits_balance", 0) or 0),
                "ledger_item": existing,
                "user": _credit_public_user(current_user),
            }

        before_balance = int(current_user.get("credits_balance", 0) or 0)
        if before_balance < amount:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Недостаточно кредитов: нужно {amount}, доступно {before_balance}",
            )

        after_balance = before_balance - amount
        current_user["credits_balance"] = after_balance
        current_user["updated_at"] = now_iso()
        ledger_item = {
            "id": make_id("cl"),
            "created_at": now_iso(),
            "user_id": user.get("id"),
            "project_id": project_id,
            "job_id": job_id,
            "action_type": action_type,
            "amount": -amount,
            "before_balance": before_balance,
            "after_balance": after_balance,
            "meta": {
                "stage": "manual_timing",
                "cost_policy": "1_credit_per_action",
                **(meta or {}),
            },
        }
        db.setdefault("credits_ledger", []).append(ledger_item)
        return {
            "charged": True,
            "duplicate": False,
            "cost": amount,
            "balance": after_balance,
            "ledger_item": ledger_item,
            "user": _credit_public_user(current_user),
        }

    return store.update(op)


def _translation_action_type(payload: "AsrTranslateRequest") -> str:
    audio_items = list(payload.audio_phrases or [])
    speech_items = list(payload.speech_segments or [])
    item_ids = [str(item.get("phrase_id") or item.get("id") or "") for item in audio_items]
    # Stage 4.3/4.7 sends manual scene windows as audio_phrases with seg_XX ids.
    if audio_items and not speech_items and item_ids and all(value.startswith("seg_") for value in item_ids):
        return "manual_timing_scenario"
    return "manual_timing_translation"


@dataclass(frozen=True)
class ManualTimingAsrSettings:
    language: str = "auto"
    split_mode: str = "pause_based"
    min_pause_sec: float = 0.45
    max_phrase_sec: float = 8.0
    min_phrase_sec: float = 1.2
    padding_sec: float = 0.0
    model_size: str = "small"
    split_on_punctuation: bool = True
    split_by_long_gap: bool = True
    split_by_max_duration: bool = True


def normalize_asr_language(value: Any) -> str | None:
    lang = str(value or "").strip().lower()
    if lang in {"", "auto", "none", "null", "unknown"}:
        return None
    return lang


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        n = float(value)
    except Exception:
        return float(default)
    if not (n == n) or n in (float("inf"), float("-inf")):
        return float(default)
    return float(n)


def _round_sec(value: Any) -> float:
    return round(max(0.0, _safe_float(value)), 3)


def _clean_text(value: Any) -> str:
    return _WORD_CLEAN_RE.sub(" ", str(value or "")).strip()




def _meaning_word_count(value: Any) -> int:
    return len(re.findall(r"[A-Za-zА-Яа-яЁё0-9]+", str(value or "")))


def _is_weak_meaning_hint(value: Any) -> bool:
    text = _clean_text(value)
    if not text:
        return True
    if _meaning_word_count(text) < 7:
        return True
    # Very short title-like hints usually have no comma/verb/action and are not useful for Board.
    if len(text) < 42 and not re.search(r"[,.!?;:]", text):
        return True
    return False


def _polish_meaning_hint_ru(source_text: Any, translation_ru: Any, meaning_hint_ru: Any) -> str:
    meaning = _clean_text(meaning_hint_ru)
    if meaning and not _is_weak_meaning_hint(meaning):
        return meaning

    translation = _clean_text(translation_ru)
    if not translation:
        return meaning

    core = translation.strip().rstrip(" .,!?:;…")
    if len(core) > 150:
        core = core[:147].rstrip() + "..."

    # Deterministic fallback: keeps the real translated content but turns a dry title
    # like "Лис на тропе" into a usable montage/director hint.
    return _clean_text(
        f"Визуально раскрыть момент: {core}, с понятным движением камеры, атмосферой и акцентом для монтажа."
    )


def _normalize_role_label(value: str | None) -> str:
    label = str(value or "ДИК").strip()
    return (label[:3] or "ДИК").upper()


def _clamp_settings(settings: ManualTimingAsrSettings) -> ManualTimingAsrSettings:
    min_pause = max(0.05, min(3.0, _safe_float(settings.min_pause_sec, 0.45)))
    max_phrase = max(1.0, min(30.0, _safe_float(settings.max_phrase_sec, 8.0)))
    min_phrase = max(0.1, min(max_phrase, _safe_float(settings.min_phrase_sec, 1.2)))
    padding = max(0.0, min(0.15, _safe_float(settings.padding_sec, 0.0)))
    normalized_language = normalize_asr_language(settings.language)
    language = normalized_language or "auto"
    split_mode = (settings.split_mode or "pause_based").strip().lower() or "pause_based"

    # EXACT old project modes from app/engine/manual_timing_asr.py.
    if split_mode in {"song_lines", "short_phrases"}:
        min_pause = 0.26 if split_mode == "song_lines" else 0.22
        max_phrase = 3.6 if split_mode == "song_lines" else 3.0
        min_phrase = 0.6 if split_mode == "song_lines" else 0.5

    model_size = (settings.model_size or os.getenv("MANUAL_TIMING_ASR_MODEL") or "small").strip() or "small"

    return ManualTimingAsrSettings(
        language=language,
        split_mode=split_mode,
        min_pause_sec=min_pause,
        max_phrase_sec=max_phrase,
        min_phrase_sec=min_phrase,
        padding_sec=padding,
        model_size=model_size,
        split_on_punctuation=bool(getattr(settings, "split_on_punctuation", True)),
        split_by_long_gap=bool(getattr(settings, "split_by_long_gap", True)),
        split_by_max_duration=bool(getattr(settings, "split_by_max_duration", True)),
    )


@lru_cache(maxsize=4)
def _get_whisper_model(model_name: str, device: str, compute_type: str):
    from faster_whisper import WhisperModel
    return WhisperModel(model_name, device=device, compute_type=compute_type)


def _cuda_available() -> bool:
    try:
        import ctranslate2
        return int(ctranslate2.get_cuda_device_count()) > 0
    except Exception:
        return False


def _audio_duration_sec(audio_path: Path, fallback: float = 0.0) -> float:
    try:
        from pydub import AudioSegment
        segment = AudioSegment.from_file(str(audio_path))
        return _round_sec(len(segment) / 1000.0)
    except Exception:
        return _round_sec(fallback)


def _audio_rms_for_range(audio_path: Path, start_sec: float, end_sec: float) -> float:
    try:
        from pydub import AudioSegment
        audio = AudioSegment.from_file(str(audio_path))
        start_ms = max(0, int(round(_safe_float(start_sec, 0.0) * 1000.0)))
        end_ms = max(start_ms + 1, int(round(_safe_float(end_sec, start_sec) * 1000.0)))
        chunk = audio[start_ms:end_ms]
        return _safe_float(getattr(chunk, "rms", 0.0), 0.0)
    except Exception:
        return 0.0


def _normalize_word(raw: Any, idx: int) -> dict[str, Any] | None:
    text = _WORD_CLEAN_RE.sub(" ", str(getattr(raw, "word", "") or "")).strip()
    start = _safe_float(getattr(raw, "start", None), -1.0)
    end = _safe_float(getattr(raw, "end", None), -1.0)
    if not text or start < 0 or end <= start:
        return None
    probability = getattr(raw, "probability", None)
    confidence = _safe_float(probability, 0.0)
    return {
        "word": text,
        "start_sec": _round_sec(start),
        "end_sec": _round_sec(end),
        "confidence": round(max(0.0, min(1.0, confidence)), 4),
        "_idx": idx,
    }


def _phrase_text(words: list[dict[str, Any]]) -> str:
    return _WORD_CLEAN_RE.sub(" ", " ".join(str(word.get("word") or "").strip() for word in words)).strip()


def _word_confidence(words: list[dict[str, Any]]) -> float:
    scores = [_safe_float(word.get("confidence"), 0.0) for word in words if word.get("confidence") is not None]
    if not scores:
        return 0.0
    return round(sum(scores) / max(1, len(scores)), 4)


def _is_punctuation_boundary(word: dict[str, Any]) -> bool:
    return bool(_SENTENCE_PUNCT_RE.search(str(word.get("word") or "").strip()))


def transcribe_words_faster_whisper(audio_path: Path, settings: ManualTimingAsrSettings) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    safe = _clamp_settings(settings)
    settings_obj = get_settings()

    requested_device = (os.getenv("MANUAL_TIMING_ASR_DEVICE") or getattr(settings_obj, "asr_device", None) or "cpu").strip().lower() or "cpu"
    device = requested_device
    if requested_device == "cuda" and not _cuda_available():
        if (os.getenv("MANUAL_TIMING_ASR_FALLBACK_CPU") or "").strip().lower() in {"1", "true", "yes", "on"}:
            logger.warning("ASR requested CUDA but CUDA is unavailable; falling back to CPU")
            device = "cpu"
        else:
            raise RuntimeError("MANUAL_TIMING_ASR_DEVICE=cuda, но CUDA недоступна. Проверь GPU/драйверы/CUDA или включи MANUAL_TIMING_ASR_FALLBACK_CPU=true.")

    compute_type = (os.getenv("MANUAL_TIMING_ASR_COMPUTE_TYPE") or getattr(settings_obj, "asr_compute_type", None) or ("int8" if device == "cpu" else "float16")).strip()
    started_at = time.monotonic()

    model = _get_whisper_model(safe.model_size, device, compute_type)
    segments, info = model.transcribe(
        str(audio_path),
        language=normalize_asr_language(safe.language),
        word_timestamps=True,
        vad_filter=True,
        beam_size=int(_safe_float(os.getenv("MANUAL_TIMING_ASR_BEAM_SIZE") or 5, 5)),
    )

    words: list[dict[str, Any]] = []
    for segment in segments:
        for raw_word in list(getattr(segment, "words", None) or []):
            normalized = _normalize_word(raw_word, len(words))
            if normalized:
                words.append(normalized)

    words.sort(key=lambda item: (float(item["start_sec"]), float(item["end_sec"])))
    for item in words:
        item.pop("_idx", None)

    duration_sec = round(time.monotonic() - started_at, 3)
    metadata = {
        "backend": "faster-whisper",
        "model_size": safe.model_size,
        "requested_device": requested_device,
        "device": device,
        "compute_type": compute_type,
        "duration_sec": duration_sec,
        "language": getattr(info, "language", safe.language),
        "language_probability": _safe_float(getattr(info, "language_probability", 0.0), 0.0),
    }
    return words, metadata


def _split_long_phrases(
    phrases: list[dict[str, Any]],
    ordered_words: list[dict[str, Any]],
    safe: ManualTimingAsrSettings,
    duration_limit: float,
) -> list[dict[str, Any]]:
    refined_word_groups: list[list[dict[str, Any]]] = []
    max_duration = min(4.0, safe.max_phrase_sec)

    for phrase in phrases:
        start = _safe_float(phrase.get("start_sec"), 0.0)
        end = _safe_float(phrase.get("end_sec"), start)
        duration = end - start
        phrase_words = [
            w for w in ordered_words
            if _safe_float(w.get("start_sec"), 0.0) >= start - 0.001
            and _safe_float(w.get("end_sec"), 0.0) <= end + 0.001
        ]

        if duration <= max_duration or len(phrase_words) < 2:
            refined_word_groups.append(phrase_words if phrase_words else [])
            continue

        current: list[dict[str, Any]] = []
        for word in phrase_words:
            if not current:
                current = [word]
                continue

            prev = current[-1]
            gap = _safe_float(word.get("start_sec"), 0.0) - _safe_float(prev.get("end_sec"), 0.0)
            seg_duration_if_added = _safe_float(word.get("end_sec"), 0.0) - _safe_float(current[0].get("start_sec"), 0.0)
            should_split = (gap >= safe.min_pause_sec and seg_duration_if_added >= safe.min_phrase_sec) or seg_duration_if_added > safe.max_phrase_sec

            if should_split:
                refined_word_groups.append(current)
                current = [word]
            else:
                current.append(word)

        if current:
            refined_word_groups.append(current)

    result: list[dict[str, Any]] = []
    for idx, phrase_words in enumerate([g for g in refined_word_groups if g], start=1):
        start = _safe_float(phrase_words[0].get("start_sec"), 0.0) - safe.padding_sec
        end = _safe_float(phrase_words[-1].get("end_sec"), 0.0) + safe.padding_sec

        if duration_limit > 0:
            start = max(0.0, min(duration_limit, start))
            end = max(0.0, min(duration_limit, end))
        if end <= start:
            continue

        result.append({
            "phrase_id": f"phr_{idx:03d}",
            "start_sec": _round_sec(start),
            "end_sec": _round_sec(end),
            "text_original": _phrase_text(phrase_words),
            "original_text": _phrase_text(phrase_words),
            "text_en": "",
            "text_ru": "",
            "translation_ru": "",
            "meaning_ru": "",
            "words": phrase_words,
            "status": "asr_raw",
            "confidence": _word_confidence(phrase_words),
        })

    return result


def split_words_to_phrases(words: list[dict[str, Any]], settings: ManualTimingAsrSettings, *, audio_duration_sec: float = 0.0) -> list[dict[str, Any]]:
    safe = _clamp_settings(settings)
    ordered = sorted(
        [word for word in words if _safe_float(word.get("end_sec"), 0.0) > _safe_float(word.get("start_sec"), 0.0)],
        key=lambda item: (_safe_float(item.get("start_sec"), 0.0), _safe_float(item.get("end_sec"), 0.0)),
    )

    phrases: list[list[dict[str, Any]]] = []
    current: list[dict[str, Any]] = []

    def close_current() -> None:
        nonlocal current
        if current:
            phrases.append(current)
            current = []

    for word in ordered:
        if not current:
            current = [word]
            continue

        prev = current[-1]
        gap = _safe_float(word.get("start_sec"), 0.0) - _safe_float(prev.get("end_sec"), 0.0)
        current_duration_if_added = _safe_float(word.get("end_sec"), 0.0) - _safe_float(current[0].get("start_sec"), 0.0)
        current_duration = _safe_float(prev.get("end_sec"), 0.0) - _safe_float(current[0].get("start_sec"), 0.0)

        pause_boundary = gap >= safe.min_pause_sec and current_duration >= safe.min_phrase_sec
        punctuation_boundary = safe.split_on_punctuation and current_duration >= safe.min_phrase_sec and _is_punctuation_boundary(prev)
        max_boundary = current_duration_if_added > safe.max_phrase_sec and (punctuation_boundary or current_duration >= safe.max_phrase_sec * 0.85)

        if ((safe.split_by_long_gap and pause_boundary) or punctuation_boundary or (safe.split_by_max_duration and max_boundary)):
            close_current()
            current = [word]
        else:
            current.append(word)

    close_current()

    # EXACT old merge: very short phrase fragments merge into previous neighbor only when gap is below min_pause.
    merged: list[list[dict[str, Any]]] = []
    for phrase in phrases:
        duration = _safe_float(phrase[-1].get("end_sec"), 0.0) - _safe_float(phrase[0].get("start_sec"), 0.0)
        if merged and duration < safe.min_phrase_sec:
            gap_to_previous = _safe_float(phrase[0].get("start_sec"), 0.0) - _safe_float(merged[-1][-1].get("end_sec"), 0.0)
            candidate_duration = _safe_float(phrase[-1].get("end_sec"), 0.0) - _safe_float(merged[-1][0].get("start_sec"), 0.0)
            if gap_to_previous < safe.min_pause_sec and candidate_duration <= safe.max_phrase_sec * 1.25:
                merged[-1].extend(phrase)
                continue
        merged.append(phrase)

    duration_limit = max(0.0, _safe_float(audio_duration_sec, 0.0))
    result: list[dict[str, Any]] = []

    for idx, phrase_words in enumerate(merged, start=1):
        start = _safe_float(phrase_words[0].get("start_sec"), 0.0) - safe.padding_sec
        end = _safe_float(phrase_words[-1].get("end_sec"), 0.0) + safe.padding_sec

        if duration_limit > 0:
            start = max(0.0, min(duration_limit, start))
            end = max(0.0, min(duration_limit, end))
        if end <= start:
            continue

        result.append({
            "phrase_id": f"phr_{idx:03d}",
            "start_sec": _round_sec(start),
            "end_sec": _round_sec(end),
            "text_original": _phrase_text(phrase_words),
            "original_text": _phrase_text(phrase_words),
            "text_en": "",
            "text_ru": "",
            "translation_ru": "",
            "meaning_ru": "",
            "words": phrase_words,
            "status": "asr_raw",
            "confidence": _word_confidence(phrase_words),
        })

    if safe.max_phrase_sec > 0:
        result = _split_long_phrases(result, ordered, safe, duration_limit)

    return result


def _detect_unrecognized_vocal_gaps(
    audio_path: Path,
    phrases: list[dict[str, Any]],
    audio_duration_sec: float,
    *,
    min_gap_sec: float = 0.8,
) -> list[dict[str, Any]]:
    ordered = sorted(
        [p for p in phrases if _safe_float(p.get("end_sec"), 0.0) > _safe_float(p.get("start_sec"), 0.0)],
        key=lambda item: (_safe_float(item.get("start_sec"), 0.0), _safe_float(item.get("end_sec"), 0.0)),
    )
    if len(ordered) < 2:
        return []

    try:
        from pydub import AudioSegment
        audio = AudioSegment.from_file(str(audio_path))
        silence_rms_threshold = max(20.0, _safe_float(getattr(audio, "rms", 0.0), 0.0) * 0.18)
    except Exception:
        return []

    gaps: list[dict[str, Any]] = []
    for idx in range(1, len(ordered)):
        prev_end = _safe_float(ordered[idx - 1].get("end_sec"), 0.0)
        next_start = _safe_float(ordered[idx].get("start_sec"), 0.0)
        gap_duration = next_start - prev_end
        if gap_duration <= min_gap_sec:
            continue

        start_sec = max(0.0, min(_safe_float(audio_duration_sec, next_start), prev_end))
        end_sec = max(start_sec, min(_safe_float(audio_duration_sec, next_start), next_start))
        if end_sec - start_sec <= min_gap_sec:
            continue

        start_ms = max(0, int(round(start_sec * 1000.0)))
        end_ms = max(start_ms + 1, int(round(end_sec * 1000.0)))
        gap_rms = _safe_float(getattr(audio[start_ms:end_ms], "rms", 0.0), 0.0)

        if gap_rms <= silence_rms_threshold:
            continue

        gaps.append({
            "gap_id": f"gap_{len(gaps) + 1:03d}",
            "start_sec": _round_sec(start_sec),
            "end_sec": _round_sec(end_sec),
            "duration_sec": _round_sec(end_sec - start_sec),
            "type": "unrecognized_vocal",
            "note": "Vocal audio present but ASR produced no words",
            "rms": round(gap_rms, 3),
        })

    return gaps


def _phrase_to_speech_segment(phrase: dict[str, Any], index: int, role_id: str, role_label: str, source: str, asr_mode: str) -> dict[str, Any]:
    text = _clean_text(phrase.get("text_original") or phrase.get("original_text") or phrase.get("text") or "")
    return {
        "id": f"asr_{index + 1:03d}",
        "phrase_id": phrase.get("phrase_id") or f"phr_{index + 1:03d}",
        "start": _round_sec(phrase.get("start_sec")),
        "end": _round_sec(phrase.get("end_sec")),
        "roleId": role_id,
        "role_id": role_id,
        "label": role_label,
        "text": text,
        "ruText": phrase.get("translation_ru") or phrase.get("text_ru") or "",
        "text_ru": phrase.get("text_ru") or phrase.get("translation_ru") or "",
        "translation_ru": phrase.get("translation_ru") or phrase.get("text_ru") or "",
        "meaningText": phrase.get("meaning_ru") or phrase.get("meaning_hint_ru") or "",
        "meaning_hint_ru": phrase.get("meaning_hint_ru") or phrase.get("meaning_ru") or "",
        "words": phrase.get("words") or [],
        "source": source,
        "asrMode": asr_mode,
        "timingSource": "old_manual_timing_asr",
        "confidence": phrase.get("confidence"),
    }


def _read_env_value(name: str, default: str = "") -> str:
    value = (os.getenv(name) or "").strip()
    if value:
        return value
    env_path = Path.cwd() / ".env"
    try:
        if env_path.exists():
            for raw_line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, raw_value = line.split("=", 1)
                if key.strip() == name:
                    return raw_value.strip().strip('"').strip("'")
    except Exception:
        return default
    return default


def _item_identity(item: dict[str, Any], index: int) -> str:
    return str(item.get("id") or item.get("phrase_id") or item.get("phraseId") or item.get("segment_id") or f"item_{index + 1:03d}").strip()


def _item_phrase_id(item: dict[str, Any]) -> str:
    return str(item.get("phrase_id") or item.get("phraseId") or item.get("id") or "").strip()


def _item_text(item: dict[str, Any]) -> str:
    return _clean_text(
        item.get("text")
        or item.get("originalText")
        or item.get("original_text")
        or item.get("text_original")
        or item.get("transcript")
        or ""
    )


def _item_ru_text(item: dict[str, Any]) -> str:
    return _clean_text(item.get("ruText") or item.get("text_ru") or item.get("translation_ru") or "")


def _item_meaning_text(item: dict[str, Any]) -> str:
    return _clean_text(item.get("meaningText") or item.get("meaning_hint_ru") or item.get("meaning_ru") or "")


def _is_probably_ru(text: str, language: str | None = None) -> bool:
    lang = normalize_asr_language(language)
    if lang == "ru":
        return True
    if lang and lang != "ru":
        return False
    letters = [ch for ch in text if ch.isalpha()]
    if not letters:
        return False
    cyr = sum(1 for ch in letters if "а" <= ch.lower() <= "я" or ch.lower() == "ё")
    return cyr / max(1, len(letters)) >= 0.55


def _extract_json_object(text: str) -> dict[str, Any]:
    cleaned = str(text or "").strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.I)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except Exception:
        pass
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start >= 0 and end > start:
        return json.loads(cleaned[start:end + 1])
    raise ValueError("translator returned non-json text")


def _gemini_translate_batch(items: list[dict[str, Any]], *, source_language: str, target_language: str, include_meaning: bool) -> dict[str, dict[str, str]]:
    api_key = _read_env_value("GEMINI_API_KEY") or _read_env_value("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY missing. Add GEMINI_API_KEY=... to backend/.env and restart backend.")

    model = _read_env_value("GEMINI_TEXT_MODEL", "gemini-2.5-flash") or "gemini-2.5-flash"
    payload_items = [
        {
            "id": item["id"],
            "text": item["text"],
            "source_language": item.get("language") or source_language or "auto",
        }
        for item in items
        if item.get("text")
    ]
    if not payload_items:
        return {}

    prompt = (
        "You translate ASR phrase fragments for a video timing editor. "
        "Return ONLY valid JSON. Preserve item ids exactly. "        "Translate each text to natural Russian, without adding facts. "
        "Also produce meaning_hint_ru as a vivid Russian director/editor hint. "
        "meaning_hint_ru MUST be one complete Russian sentence, 12-24 words. "
        "Describe what to show on screen: camera, visual action, mood, or montage accent. "
        "Never return a dry title like Тропа в лесу or Лис на тропе. "
        "If the source text is already Russian, copy it to translation_ru and make meaning_hint_ru concise.\n\n"
        "JSON schema:\n"
        "{\"items\":[{\"id\":\"same id\",\"translation_ru\":\"...\",\"meaning_hint_ru\":\"...\"}]}\n\n"
        f"target_language={target_language}\ninclude_meaning={include_meaning}\nitems=\n"
        + json.dumps(payload_items, ensure_ascii=False)
    )

    import requests
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
        },
    }
    response = requests.post(url, json=body, timeout=90)
    if response.status_code >= 400:
        raise RuntimeError(f"Gemini translation failed: HTTP {response.status_code} {response.text[:400]}")
    data = response.json()
    parts = (((data.get("candidates") or [{}])[0].get("content") or {}).get("parts") or [])
    raw_text = "\n".join(str(part.get("text") or "") for part in parts if part.get("text"))
    parsed = _extract_json_object(raw_text)
    result: dict[str, dict[str, str]] = {}
    for item in parsed.get("items") or []:
        item_id = str(item.get("id") or "").strip()
        if not item_id:
            continue
        result[item_id] = {
            "translation_ru": _clean_text(item.get("translation_ru") or item.get("text_ru") or ""),
            "meaning_hint_ru": _clean_text(item.get("meaning_hint_ru") or item.get("meaning_ru") or ""),
        }
    return result


def _apply_translation_fields(item: dict[str, Any], translation_ru: str, meaning_hint_ru: str) -> dict[str, Any]:
    translation_ru = _clean_text(translation_ru)
    meaning_hint_ru = _polish_meaning_hint_ru(_item_text(item), translation_ru, meaning_hint_ru)
    next_item = dict(item)
    next_item["ruText"] = translation_ru
    next_item["text_ru"] = translation_ru
    next_item["translation_ru"] = translation_ru
    next_item["meaningText"] = meaning_hint_ru
    next_item["meaning_hint_ru"] = meaning_hint_ru
    if "meaning_ru" in next_item or meaning_hint_ru:
        next_item["meaning_ru"] = meaning_hint_ru
    return next_item


def _translate_items(items: list[dict[str, Any]], *, source_language: str, target_language: str, include_meaning: bool) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    prepared: list[dict[str, Any]] = []
    output = [dict(item) for item in items]
    direct_count = 0
    skipped_count = 0

    for index, item in enumerate(output):
        text = _item_text(item)
        if not text:
            skipped_count += 1
            continue
        existing_ru = _item_ru_text(item)
        existing_meaning = _item_meaning_text(item)
        lang = str(item.get("language") or item.get("source_language") or source_language or "").strip()
        if existing_ru and existing_meaning:
            skipped_count += 1
            continue
        if _is_probably_ru(text, lang):
            output[index] = _apply_translation_fields(item, existing_ru or text, existing_meaning or text)
            direct_count += 1
            continue
        prepared.append({
            "id": _item_identity(item, index),
            "index": index,
            "text": text,
            "language": lang or source_language or "auto",
        })

    translated_count = 0
    provider = "copy_ru_only"
    if prepared:
        provider = "gemini"
        for chunk_start in range(0, len(prepared), 24):
            chunk = prepared[chunk_start:chunk_start + 24]
            translated = _gemini_translate_batch(
                chunk,
                source_language=source_language,
                target_language=target_language,
                include_meaning=include_meaning,
            )
            for entry in chunk:
                item_result = translated.get(entry["id"]) or {}
                translation = item_result.get("translation_ru") or ""
                meaning = item_result.get("meaning_hint_ru") or translation
                if translation:
                    output[entry["index"]] = _apply_translation_fields(output[entry["index"]], translation, meaning)
                    translated_count += 1

    return output, {
        "provider": provider,
        "translated_count": translated_count,
        "direct_ru_count": direct_count,
        "skipped_count": skipped_count,
        "target_language": target_language,
    }


@router.post("/translate")
def translate_asr_phrases(payload: AsrTranslateRequest, user: dict = Depends(get_current_user)):
    # user dependency intentionally keeps the endpoint private/account-protected.
    source_language = normalize_asr_language(payload.source_language) or "auto"
    target_language = (payload.target_language or "ru").strip().lower() or "ru"
    if target_language != "ru":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only Russian target translation is supported now")
    if payload.project_id:
        ensure_project_access(payload.project_id, user)

    action_type = _translation_action_type(payload)
    _require_manual_timing_credit(user, MANUAL_TIMING_AI_CREDIT_COST)

    try:
        speech_segments, speech_meta = _translate_items(
            payload.speech_segments or [],
            source_language=source_language,
            target_language=target_language,
            include_meaning=payload.include_meaning,
        )
        audio_phrases, phrase_meta = _translate_items(
            payload.audio_phrases or [],
            source_language=source_language,
            target_language=target_language,
            include_meaning=payload.include_meaning,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"ASR translation failed: {exc}") from exc

    credits_meta = _charge_manual_timing_credit(
        user,
        action_type=action_type,
        project_id=payload.project_id,
        client_request_id=payload.client_request_id,
        meta={
            "source_language": source_language,
            "target_language": target_language,
            "speech_items": len(payload.speech_segments or []),
            "audio_phrase_items": len(payload.audio_phrases or []),
        },
    )

    return {
        "ok": True,
        "speechSegments": speech_segments,
        "speech_segments": speech_segments,
        "audio_phrases": audio_phrases,
        "translation_meta": {
            "speech": speech_meta,
            "audio_phrases": phrase_meta,
            "target_language": target_language,
            "charged_action_type": action_type,
        },
        "credits": credits_meta,
        "user": credits_meta.get("user"),
    }


@router.post("/transcribe")
def transcribe_audio_asset(payload: AsrTranscribeRequest, user: dict = Depends(get_current_user)):
    settings_obj = get_settings()
    if payload.project_id:
        ensure_project_access(payload.project_id, user)
    _require_manual_timing_credit(user, MANUAL_TIMING_AI_CREDIT_COST)

    db = store.get_db()
    asset = db.get("assets", {}).get(payload.asset_id)
    if not asset or asset.get("user_id") != user["id"] or asset.get("kind") != "audio":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audio asset not found")

    audio_path = Path(asset.get("storage_path") or "")
    if not audio_path.exists() or not audio_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audio file missing")

    role_id = payload.role_id or "narrator"
    role_label = _normalize_role_label(payload.role_label)
    asr_mode_raw = (payload.mode or "speech").strip().lower()
    if asr_mode_raw not in {"speech", "music", "vocal"}:
        asr_mode_raw = "speech"

    is_vocal_source = role_id == "vocal" or role_label == "ВОК" or asr_mode_raw == "vocal"
    effective_mode = "vocal" if is_vocal_source else asr_mode_raw
    source = "asr_vocal_stem" if is_vocal_source else "asr_main_audio"
    action_type = "manual_timing_asr_vocal" if is_vocal_source else "manual_timing_asr_main"

    model_size = (
        os.getenv("MANUAL_TIMING_ASR_MODEL")
        or getattr(settings_obj, "asr_model", None)
        or "small"
    )

    mt_settings = ManualTimingAsrSettings(
        language=payload.language or "auto",
        split_mode="pause_based",
        min_pause_sec=0.45,
        max_phrase_sec=8.0,
        min_phrase_sec=1.2,
        padding_sec=0.0,
        model_size=model_size,
        split_on_punctuation=True,
        split_by_long_gap=True,
        split_by_max_duration=True,
    )
    safe = _clamp_settings(mt_settings)

    fallback_duration = _safe_float(asset.get("duration_sec") or asset.get("durationSec"), 0.0)
    duration = _audio_duration_sec(audio_path, fallback_duration)

    try:
        words, metadata = transcribe_words_faster_whisper(audio_path, safe)
    except Exception as exc:
        logger.exception(
            "MANUAL_TIMING_STAGE117_LOCAL_ASR_FAILED asset_id=%s path=%s model=%s device=%s compute=%s",
            payload.asset_id,
            audio_path,
            safe.model_size,
            os.getenv("MANUAL_TIMING_ASR_DEVICE") or getattr(settings_obj, "asr_device", None) or "cpu",
            os.getenv("MANUAL_TIMING_ASR_COMPUTE_TYPE") or getattr(settings_obj, "asr_compute_type", None) or "",
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Local ASR failed: {exc}",
        ) from exc

    phrases = split_words_to_phrases(words, safe, audio_duration_sec=duration)
    detected_language = normalize_asr_language(metadata.get("language")) or payload.language or ""

    for phrase in phrases:
        text = _clean_text(phrase.get("text_original") or phrase.get("original_text") or "")
        phrase["text_original"] = text
        phrase["original_text"] = text
        phrase["text"] = text
        phrase["source"] = "asr"
        phrase["source_language"] = detected_language
        phrase["language"] = detected_language

        if detected_language == "ru":
            phrase["text_ru"] = text
            phrase["translation_ru"] = text
            phrase["text_en"] = ""
        else:
            phrase["text_ru"] = ""
            phrase["translation_ru"] = ""
            phrase["text_en"] = text if detected_language == "en" else ""

    asr_gaps = _detect_unrecognized_vocal_gaps(audio_path, phrases, duration)
    speech_segments = [
        _phrase_to_speech_segment(phrase, index, role_id, role_label, source, effective_mode)
        for index, phrase in enumerate(phrases)
    ]

    missing_hints = [
        {
            "id": gap.get("gap_id") or f"gap_{idx + 1:03d}",
            "start": _round_sec(gap.get("start_sec")),
            "end": _round_sec(gap.get("end_sec")),
            "type": "audio_activity_without_asr",
            "label": "проверь звук",
            "reason": gap.get("note") or "unrecognized_vocal",
            "status": "needs_review",
            "rms": gap.get("rms"),
        }
        for idx, gap in enumerate(asr_gaps)
    ]

    full_text = " ".join(segment.get("text", "") for segment in speech_segments).strip()

    credits_meta = _charge_manual_timing_credit(
        user,
        action_type=action_type,
        project_id=payload.project_id,
        client_request_id=payload.client_request_id,
        meta={
            "asset_id": payload.asset_id,
            "role_id": role_id,
            "role_label": role_label,
            "mode": effective_mode,
            "timing_engine": TIMING_ENGINE,
        },
    )

    return {
        "ok": True,
        "provider": "local",
        "model": safe.model_size,
        "mode": asr_mode_raw,
        "effective_mode": effective_mode,
        "timing_engine": TIMING_ENGINE,
        "vad_filter": True,
        "word_timestamps": True,
        "word_count": len(words),
        "phrase_count": len(phrases),
        "gap_count": len(asr_gaps),
        "language": detected_language,
        "text": full_text,
        "roles": [{
            "roleId": role_id,
            "id": role_id,
            "name": "Вокал" if is_vocal_source else "Диктор",
            "label": role_label,
            "color": 42 if is_vocal_source else 220,
        }],
        "audio_phrases": phrases,
        "asr_gaps": asr_gaps,
        "missingSpeechHints": missing_hints,
        "missing_speech_hints": missing_hints,
        "split_settings": {
            "split_mode": safe.split_mode,
            "min_pause_sec": safe.min_pause_sec,
            "max_phrase_sec": safe.max_phrase_sec,
            "min_phrase_sec": safe.min_phrase_sec,
            "padding_sec": safe.padding_sec,
            "split_on_punctuation": safe.split_on_punctuation,
        },
        "speechSegments": speech_segments,
        "speech_segments": speech_segments,
        "credits": credits_meta,
        "user": credits_meta.get("user"),
    }
