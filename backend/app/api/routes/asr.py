from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
import logging
import os
import re
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.storage import store

router = APIRouter(prefix="/asr", tags=["asr"])

logger = logging.getLogger(__name__)
TIMING_ENGINE = "old_manual_timing_asr_v1"

_WORD_CLEAN_RE = re.compile(r"\s+")
_SENTENCE_PUNCT_RE = re.compile(r"[.!?…:;]+[\"')\]]*$")


class AsrTranscribeRequest(BaseModel):
    asset_id: str
    language: str | None = None
    role_id: str = "narrator"
    role_label: str = "ДИК"
    mode: str = "speech"  # speech | music | vocal
    vad_filter: bool | None = None


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
        "ruText": "",
        "source": source,
        "asrMode": asr_mode,
        "timingSource": "old_manual_timing_asr",
        "confidence": phrase.get("confidence"),
    }


@router.post("/transcribe")
def transcribe_audio_asset(payload: AsrTranscribeRequest, user: dict = Depends(get_current_user)):
    settings_obj = get_settings()

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
    }
