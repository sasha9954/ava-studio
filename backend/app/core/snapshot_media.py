from __future__ import annotations

from copy import deepcopy
from typing import Any


MEDIA_KEY_TOKENS = (
    "asset",
    "api_path",
    "apipath",
    "audio",
    "image",
    "video",
    "media",
    "assembly",
    "url",
)


def _is_runtime_url(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    return value.startswith("blob:") or value.startswith("data:")


def _is_empty(value: Any) -> bool:
    return value is None or value == "" or value == [] or value == {}


def _is_media_key(key: str) -> bool:
    lowered = str(key or "").lower()
    return any(token in lowered for token in MEDIA_KEY_TOKENS)


def sanitize_snapshot_runtime_media(value: Any) -> tuple[Any, int]:
    if isinstance(value, list):
        removed = 0
        items = []
        for item in value:
            clean, count = sanitize_snapshot_runtime_media(item)
            removed += count
            items.append(clean)
        return items, removed

    if isinstance(value, dict):
        removed = 0
        clean: dict[str, Any] = {}
        for key, item in value.items():
            if _is_runtime_url(item):
                clean[key] = ""
                removed += 1
                continue
            next_item, count = sanitize_snapshot_runtime_media(item)
            clean[key] = next_item
            removed += count
        return clean, removed

    if _is_runtime_url(value):
        return "", 1
    return value, 0


def preserve_media_refs(current: Any, incoming: Any) -> tuple[Any, int]:
    if isinstance(current, dict) and isinstance(incoming, dict):
        changed = 0
        merged = deepcopy(incoming)
        for key, old_value in current.items():
            if key not in merged:
                continue
            new_value = merged.get(key)
            if isinstance(old_value, (dict, list)) and isinstance(new_value, type(old_value)):
                merged_value, count = preserve_media_refs(old_value, new_value)
                if count:
                    merged[key] = merged_value
                    changed += count
                continue
            if _is_media_key(key) and not _is_empty(old_value) and _is_empty(new_value):
                merged[key] = deepcopy(old_value)
                changed += 1
        return merged, changed

    if isinstance(current, list) and isinstance(incoming, list):
        changed = 0
        merged = deepcopy(incoming)
        current_by_scene = {
            str(item.get("scene_id") or item.get("sceneId") or item.get("id")): item
            for item in current
            if isinstance(item, dict) and (item.get("scene_id") or item.get("sceneId") or item.get("id"))
        }
        for index, new_item in enumerate(incoming):
            old_item = current[index] if index < len(current) else None
            if isinstance(new_item, dict):
                scene_id = str(new_item.get("scene_id") or new_item.get("sceneId") or new_item.get("id") or "")
                old_item = current_by_scene.get(scene_id) or old_item
            if isinstance(old_item, (dict, list)) and isinstance(new_item, type(old_item)):
                merged_item, count = preserve_media_refs(old_item, new_item)
                if count:
                    merged[index] = merged_item
                    changed += count
        return merged, changed

    return deepcopy(incoming), 0


def media_refs_summary(data: dict[str, Any]) -> dict[str, int]:
    if not isinstance(data, dict):
        return {}

    scenes = data.get("scenes")
    board_scenes = scenes if isinstance(scenes, list) else []
    board_video_refs = 0
    board_image_refs = 0
    for scene in board_scenes:
        if not isinstance(scene, dict):
            continue
        if any(scene.get(key) for key in ("video_asset_id", "videoAssetId", "video_api_path", "videoApiPath", "video_url", "videoUrl")):
            board_video_refs += 1
        if any(
            scene.get(key)
            for key in (
                "image_asset_id",
                "imageAssetId",
                "image_api_path",
                "imageApiPath",
                "first_image_asset_id",
                "firstImageAssetId",
                "first_image_api_path",
                "firstImageApiPath",
                "last_image_asset_id",
                "lastImageAssetId",
                "last_image_api_path",
                "lastImageApiPath",
            )
        ):
            board_image_refs += 1

    return {
        "boardScenesWithVideoRefs": board_video_refs,
        "boardScenesWithImageRefs": board_image_refs,
        "podcastAudioRefs": int(
            any(data.get(key) for key in ("podcast_audio_asset_id", "podcastAudioAssetId", "audioAssetId", "audio_asset_id"))
        ),
        "assemblyRefs": int(any(data.get(key) for key in ("assembly_asset_id", "assemblyAssetId", "assembly_api_path", "assemblyApiPath", "assemblyUrl"))),
        "videoNodeRefs": int(any(data.get(key) for key in ("sourceVideos", "source_videos", "assembledPreview", "assembly_asset_id", "assemblyApiPath"))),
    }
