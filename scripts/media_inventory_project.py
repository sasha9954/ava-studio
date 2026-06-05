#!/usr/bin/env python
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse


ASSET_ID_RE = re.compile(r"asset_[A-Za-z0-9]+")
ASSET_FILE_RE = re.compile(r"/(?:api/)?assets/(asset_[A-Za-z0-9]+)/file")
MEDIA_EXTS = {".mp4", ".webm", ".png", ".jpg", ".jpeg", ".webp", ".mp3", ".wav"}
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}
VIDEO_EXTS = {".mp4", ".webm"}
AUDIO_EXTS = {".mp3", ".wav"}

MEDIA_FIELD_TOKENS = (
    "asset",
    "audio",
    "image",
    "img",
    "photo",
    "video",
    "media",
    "thumb",
    "thumbnail",
    "preview",
    "source",
    "result",
    "assembly",
    "file",
    "url",
    "path",
)


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def stat_info(path: Path | None) -> dict[str, Any]:
    if not path:
        return {"resolvedPath": None, "exists": False, "size": None, "mtime": None}
    exists = path.exists()
    if not exists:
        return {"resolvedPath": str(path), "exists": False, "size": None, "mtime": None}
    stat = path.stat()
    return {
        "resolvedPath": str(path),
        "exists": True,
        "size": stat.st_size,
        "mtime": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
    }


def norm_path(path: Path) -> str:
    return str(path.resolve()).lower()


def classify_kind(field: str, value: str) -> str:
    text = f"{field} {value}".lower()
    suffix = Path(urlparse(value).path).suffix.lower()
    if "assembly" in text or "board_assembly" in text:
        return "assembly"
    if any(token in text for token in ("audio", "podcast", "voice", "vocal")) or suffix in AUDIO_EXTS:
        return "audio"
    if any(token in text for token in ("image", "img", "photo", "first", "last", "thumb")) or suffix in IMAGE_EXTS:
        return "image"
    if "video" in text or "board_videos" in text or suffix in VIDEO_EXTS:
        return "video"
    if "asset" in text:
        return "asset"
    return "unknown"


def probable_module(path: Path) -> str:
    text = str(path).replace("\\", "/").lower()
    if "board_videos" in text or "board_images" in text or "board_frames" in text:
        return "board"
    if "board_assembly" in text:
        return "board_assembly"
    if "manual_clip_audio" in text:
        return "manual_timing"
    if "video_match_outputs" in text:
        return "video_match_outputs"
    if "video_match_sources" in text:
        return "video_match_sources"
    if "video_match_audio" in text:
        return "video_match_audio"
    if "podcast" in path.name.lower():
        return "podcast"
    if "workspace/assets" in text:
        return "workspace_assets"
    return "unknown"


def value_is_media_ref(field: str, value: str) -> bool:
    lower_field = field.lower()
    lower_value = value.lower()
    if not value:
        return False
    if ASSET_ID_RE.fullmatch(value):
        return True
    if ASSET_FILE_RE.search(value):
        return True
    if "/static/assets/" in lower_value:
        return True
    if lower_value.startswith(("blob:", "file://", "data:")):
        return True
    if re.match(r"^[a-zA-Z]:\\", value):
        return True
    if Path(urlparse(value).path).suffix.lower() in MEDIA_EXTS:
        return True
    if any(token in lower_field for token in MEDIA_FIELD_TOKENS) and (
        "asset_" in lower_value
        or lower_value.startswith(("/", "http://", "https://"))
        or "\\static\\assets\\" in lower_value
    ):
        return True
    return False


def scene_id_from_obj(obj: dict[str, Any], inherited: str | None) -> str | None:
    for key in ("scene_id", "sceneId", "id", "segment_id", "segmentId"):
        value = obj.get(key)
        if isinstance(value, str) and (value.startswith("seg_") or value.startswith("scene") or value.startswith("scn_")):
            return value
    return inherited


def collect_refs(
    obj: Any,
    *,
    module: str,
    field_path: str,
    scene_id: str | None,
    out: list[dict[str, Any]],
) -> None:
    if isinstance(obj, dict):
        current_scene = scene_id_from_obj(obj, scene_id)
        for key, value in obj.items():
            next_path = f"{field_path}.{key}" if field_path else key
            collect_refs(value, module=module, field_path=next_path, scene_id=current_scene, out=out)
        return

    if isinstance(obj, list):
        for index, value in enumerate(obj):
            collect_refs(value, module=module, field_path=f"{field_path}[{index}]", scene_id=scene_id, out=out)
        return

    if isinstance(obj, str) and value_is_media_ref(field_path, obj):
        out.append(
            {
                "module": module,
                "sceneId": scene_id,
                "field": field_path,
                "value": obj,
                "kind": classify_kind(field_path, obj),
            }
        )


def resolve_asset_id(asset_id: str, assets: dict[str, Any], backend_dir: Path) -> tuple[Path | None, list[str]]:
    warnings: list[str] = []
    meta = assets.get(asset_id)
    if not isinstance(meta, dict):
        return None, [f"asset metadata missing: {asset_id}"]
    storage_path = meta.get("storage_path") or meta.get("storagePath") or meta.get("path")
    if not storage_path:
        return None, [f"asset storage path missing: {asset_id}"]
    path = Path(str(storage_path))
    if not path.is_absolute():
        path = backend_dir / path
    return path, warnings


def static_candidates(value: str, backend_dir: Path) -> list[Path]:
    parsed = urlparse(value)
    raw_path = parsed.path or value
    raw_path = raw_path.replace("\\", "/")
    raw_path = unquote(raw_path)
    marker = "/static/assets/"
    lower = raw_path.lower()
    if marker not in lower:
        return []
    idx = lower.index(marker) + len(marker)
    tail = raw_path[idx:].lstrip("/")
    return [backend_dir / "static" / "assets" / tail, backend_dir / "app" / "static" / "assets" / tail]


def resolve_ref(ref: dict[str, Any], assets: dict[str, Any], backend_dir: Path) -> tuple[Path | None, list[str], str | None]:
    value = str(ref["value"])
    warnings: list[str] = []
    asset_id: str | None = None

    asset_file_match = ASSET_FILE_RE.search(value)
    if asset_file_match:
        asset_id = asset_file_match.group(1)
    elif ASSET_ID_RE.fullmatch(value):
        asset_id = value

    if asset_id:
        path, asset_warnings = resolve_asset_id(asset_id, assets, backend_dir)
        return path, asset_warnings, asset_id

    if "/static/assets/" in value.lower() or "\\static\\assets\\" in value.lower():
        candidates = static_candidates(value, backend_dir)
        for candidate in candidates:
            if candidate.exists():
                return candidate, warnings, None
        return (candidates[0] if candidates else None), warnings, None

    if re.match(r"^[a-zA-Z]:\\", value):
        return Path(value), warnings, None

    return None, warnings, None


def scan_media_files(backend_dir: Path, project_id: str) -> list[Path]:
    patterns = [
        backend_dir / "static" / "assets" / "board_videos",
        backend_dir / "static" / "assets" / "board_assembly",
        backend_dir / "static" / "assets" / "manual_clip_audio",
        backend_dir / "static" / "assets",
        backend_dir / "app" / "static" / "assets" / "video_match_outputs",
        backend_dir / "app" / "static" / "assets" / "video_match_sources",
        backend_dir / "app" / "static" / "assets" / "video_match_audio",
        backend_dir / "app" / "static" / "assets",
    ]
    patterns.extend((backend_dir / "storage" / "users").glob(f"*/projects/{project_id}/assets"))
    patterns.extend((backend_dir / "storage" / "users").glob("*/workspace/assets"))

    files: dict[str, Path] = {}
    for folder in patterns:
        if not folder.exists():
            continue
        for path in folder.rglob("*"):
            if path.is_file() and path.suffix.lower() in MEDIA_EXTS:
                files[norm_path(path)] = path
    return sorted(files.values(), key=lambda p: (str(p.parent), p.name.lower()))


def scan_evening_files(backend_dir: Path) -> list[Path]:
    files: list[Path] = []
    for path in backend_dir.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in MEDIA_EXTS:
            continue
        mtime = datetime.fromtimestamp(path.stat().st_mtime)
        if mtime.date().isoformat() == "2026-06-03" and mtime.hour >= 15:
            files.append(path)
    return sorted(files, key=lambda p: p.stat().st_mtime)


def file_entry(path: Path, kind: str | None = None) -> dict[str, Any]:
    info = stat_info(path)
    entry = {
        "kind": kind or classify_kind(str(path), str(path)),
        "path": str(path),
        "size": info["size"],
        "mtime": info["mtime"],
        "probableModule": probable_module(path),
    }
    scene_match = re.search(r"(seg_\d+)", path.name, flags=re.IGNORECASE)
    if scene_match:
        entry["sceneId"] = scene_match.group(1)
    boardjob_match = re.search(r"(boardjob_[A-Za-z0-9]+)", path.name)
    if boardjob_match:
        entry["jobId"] = boardjob_match.group(1)
    return entry


def collect_media_field_presence(project_snapshots: Any) -> dict[str, Any]:
    board_data = None
    if isinstance(project_snapshots, dict):
        board_snapshot = project_snapshots.get("board")
        if isinstance(board_snapshot, dict):
            board_data = board_snapshot.get("data")
    if not isinstance(board_data, dict):
        return {}
    scenes = board_data.get("scenes")
    if not isinstance(scenes, list):
        return {}

    fields = [
        "videoUrl",
        "video_url",
        "resultUrl",
        "result_url",
        "mediaUrl",
        "media_url",
        "imageUrl",
        "image_url",
        "firstImageUrl",
        "first_image_url",
        "lastImageUrl",
        "last_image_url",
        "videoAssetId",
        "video_asset_id",
        "videoApiPath",
        "video_api_path",
        "imageAssetId",
        "image_asset_id",
        "imageApiPath",
        "image_api_path",
        "firstImageAssetId",
        "first_image_asset_id",
        "firstImageApiPath",
        "first_image_api_path",
        "lastImageAssetId",
        "last_image_asset_id",
        "lastImageApiPath",
        "last_image_api_path",
    ]
    result: dict[str, Any] = {"sceneCount": len(scenes), "fields": {}}
    for field in fields:
        present = 0
        non_empty: list[dict[str, Any]] = []
        for scene in scenes:
            if not isinstance(scene, dict) or field not in scene:
                continue
            present += 1
            value = scene.get(field)
            if value not in (None, "", [], {}):
                non_empty.append(
                    {
                        "sceneId": scene.get("scene_id") or scene.get("sceneId") or scene.get("id"),
                        "value": value,
                    }
                )
        if present:
            result["fields"][field] = {
                "present": present,
                "nonEmpty": len(non_empty),
                "examples": non_empty[:10],
            }
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Diagnose saved project media references and physical files.")
    parser.add_argument("--project-id", required=True)
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    backend_dir = repo_root / "backend"
    db_path = backend_dir / "storage" / "ava_db.json"
    report_path = backend_dir / f"media_inventory_{args.project_id}.json"

    db = read_json(db_path)
    projects = db.get("projects", {})
    snapshots = db.get("snapshots", {})
    workspaces = db.get("workspaces", {})
    workspace_snapshots = db.get("workspace_snapshots", {})
    assets = db.get("assets", {})

    project = projects.get(args.project_id)
    warnings: list[str] = []
    if not project:
        warnings.append(f"project not found in {db_path}: {args.project_id}")

    payloads: dict[str, Any] = {"project": project}
    project_snapshots = snapshots.get(args.project_id)
    if isinstance(project_snapshots, dict):
        for key, value in project_snapshots.items():
            payloads[f"snapshot.{key}"] = value
    else:
        warnings.append(f"project snapshots missing: {args.project_id}")

    project_workspace_ids = [
        workspace_id
        for workspace_id, workspace in workspaces.items()
        if isinstance(workspace, dict) and workspace.get("project_id") == args.project_id
    ]
    for workspace_id in project_workspace_ids:
        payloads[f"workspace.{workspace_id}"] = workspaces.get(workspace_id)
        if workspace_id in workspace_snapshots:
            payloads[f"workspace_snapshot.{workspace_id}"] = workspace_snapshots.get(workspace_id)

    refs: list[dict[str, Any]] = []
    for module, payload in payloads.items():
        collect_refs(payload, module=module, field_path="", scene_id=None, out=refs)

    resolved_existing_paths: set[str] = set()
    for ref in refs:
        resolved_path, ref_warnings, asset_id = resolve_ref(ref, assets, backend_dir)
        ref.update(stat_info(resolved_path))
        if asset_id:
            ref["assetId"] = asset_id
        if ref_warnings:
            ref["warnings"] = ref_warnings
            warnings.extend(f"{ref['field']}: {warning}" for warning in ref_warnings)
        if ref["exists"] and ref["resolvedPath"]:
            resolved_existing_paths.add(norm_path(Path(ref["resolvedPath"])))

    all_media_files = scan_media_files(backend_dir, args.project_id)
    unlinked_files = [path for path in all_media_files if norm_path(path) not in resolved_existing_paths]
    evening_files = scan_evening_files(backend_dir)

    summary = {
        "audioRefs": sum(1 for ref in refs if ref["kind"] == "audio"),
        "imageRefs": sum(1 for ref in refs if ref["kind"] == "image"),
        "videoRefs": sum(1 for ref in refs if ref["kind"] == "video"),
        "assemblyRefs": sum(1 for ref in refs if ref["kind"] == "assembly"),
        "existingFiles": sum(1 for ref in refs if ref["exists"]),
        "missingFiles": sum(1 for ref in refs if not ref["exists"]),
        "unlinkedProjectFiles": len(unlinked_files),
    }

    scene_summary: dict[str, dict[str, int]] = {}
    for ref in refs:
        scene_id = ref.get("sceneId")
        if not scene_id:
            continue
        item = scene_summary.setdefault(scene_id, {"audio": 0, "image": 0, "video": 0, "assembly": 0, "existing": 0, "missing": 0})
        if ref["kind"] in item:
            item[ref["kind"]] += 1
        item["existing" if ref["exists"] else "missing"] += 1

    report = {
        "projectId": args.project_id,
        "projectFile": str(db_path),
        "summary": summary,
        "refs": refs,
        "unlinkedFiles": [file_entry(path) for path in unlinked_files],
        "scannedEveningFiles": [file_entry(path) for path in evening_files],
        "sceneSummary": scene_summary,
        "mediaFieldPresence": collect_media_field_presence(project_snapshots),
        "warnings": sorted(set(warnings)),
    }

    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    missing_refs = [ref for ref in refs if not ref["exists"]]
    existing_images = [ref for ref in refs if ref["kind"] == "image" and ref["exists"]]
    existing_videos = [ref for ref in refs if ref["kind"] == "video" and ref["exists"]]
    existing_audio = [ref for ref in refs if ref["kind"] == "audio" and ref["exists"]]

    print(f"Media inventory for {args.project_id}")
    print(f"Project file: {db_path}")
    print(f"Report saved: {report_path}")
    print("Summary:", json.dumps(summary, ensure_ascii=False))
    print(f"Physical images via refs: {len(existing_images)}")
    print(f"Physical videos via refs: {len(existing_videos)}")
    print(f"Physical audio via refs: {len(existing_audio)}")
    print(f"Missing/broken refs: {len(missing_refs)}")
    for ref in missing_refs[:30]:
        print(f"  MISSING {ref['kind']} {ref.get('sceneId') or '-'} {ref['field']} -> {ref['value']}")
    if len(missing_refs) > 30:
        print(f"  ... {len(missing_refs) - 30} more")
    print(f"Unlinked media files: {len(unlinked_files)}")
    for path in unlinked_files[:30]:
        print(f"  UNLINKED {probable_module(path)} {path}")
    if len(unlinked_files) > 30:
        print(f"  ... {len(unlinked_files) - 30} more")
    print(f"Evening 2026-06-03 media files inside backend: {len(evening_files)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
