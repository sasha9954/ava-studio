#!/usr/bin/env python
from __future__ import annotations

import argparse
import json
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any


MEDIA_EXTS = {".mp4", ".webm", ".png", ".jpg", ".jpeg", ".webp"}


def read_db(backend_dir: Path) -> dict[str, Any]:
    return json.loads((backend_dir / "storage" / "ava_db.json").read_text(encoding="utf-8"))


def media_kind(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".mp4", ".webm"}:
        return "video"
    if suffix in {".png", ".jpg", ".jpeg", ".webp"}:
        return "image"
    return "unknown"


def scene_id(scene: dict[str, Any], index: int) -> str:
    return str(scene.get("scene_id") or scene.get("sceneId") or scene.get("id") or f"seg_{index + 1:02d}")


def file_entry(path: Path) -> dict[str, Any]:
    stat = path.stat()
    return {
        "path": str(path),
        "kind": media_kind(path),
        "size": stat.st_size,
        "mtime": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
        "filename": path.name,
    }


def score_video_candidate(scene: dict[str, Any], index: int, path: Path, video_rank: int) -> tuple[float, list[str]]:
    sid = scene_id(scene, index)
    reasons: list[str] = []
    score = 0.0
    name = path.name.lower()

    if sid.lower() in name:
        score += 0.95
        reasons.append("filename_contains_scene_id")
    if "_trim_" in name:
        score += 0.08
        reasons.append("trim_file_preferred")

    # No scene id exists in current board_videos filenames; rank order is useful only as weak hint.
    if video_rank == index:
        score += 0.18
        reasons.append("same_order_as_scene_index_low_confidence")
    elif abs(video_rank - index) <= 1:
        score += 0.08
        reasons.append("near_order_low_confidence")

    route = str(scene.get("route") or "").lower()
    if route and route.replace("_", "") in name.replace("_", ""):
        score += 0.05
        reasons.append("route_hint")

    return min(score, 0.99), reasons


def score_image_candidate(scene: dict[str, Any], index: int, path: Path) -> tuple[float, list[str], str]:
    sid = scene_id(scene, index)
    name = path.name.lower()
    reasons: list[str] = []
    slot = "image"
    score = 0.0

    if sid.lower() in name:
        score += 0.9
        reasons.append("filename_contains_scene_id")
    frame_match = re.search(r"(seg_\d+)_from_(seg_\d+)_(first|last)", name)
    if frame_match:
        target_scene, source_scene, frame_slot = frame_match.groups()
        if target_scene == sid.lower():
            score += 0.98
            slot = "first" if frame_slot == "last" else frame_slot
            reasons.append("board_frame_target_scene")
        elif source_scene == sid.lower():
            score += 0.45
            slot = "last"
            reasons.append("board_frame_source_scene")

    if "board_images" in str(path).replace("\\", "/").lower() and not reasons:
        score += 0.1
        reasons.append("unscoped_board_image_manual_candidate")

    return min(score, 0.99), reasons, slot


def collect_media_files(backend_dir: Path) -> list[Path]:
    folders = [
        backend_dir / "static" / "assets" / "board_videos",
        backend_dir / "static" / "assets" / "board_images",
        backend_dir / "static" / "assets" / "board_frames",
    ]
    files: list[Path] = []
    for folder in folders:
        if not folder.exists():
            continue
        files.extend(path for path in folder.rglob("*") if path.is_file() and path.suffix.lower() in MEDIA_EXTS)
    return sorted(files, key=lambda path: (path.stat().st_mtime, path.name))


def static_url_for(path: Path, backend_dir: Path) -> str:
    static_root = backend_dir / "static"
    try:
        return "/static/" + path.relative_to(static_root).as_posix()
    except ValueError:
        return str(path)


def build_candidates(project_id: str, backend_dir: Path) -> dict[str, Any]:
    db = read_db(backend_dir)
    board = (((db.get("snapshots") or {}).get(project_id) or {}).get("board") or {}).get("data") or {}
    scenes = board.get("scenes") if isinstance(board.get("scenes"), list) else []
    files = collect_media_files(backend_dir)
    video_files_all = [path for path in files if media_kind(path) == "video"]
    # Prefer trimmed final outputs for automatic candidate ranking.
    video_files = [path for path in video_files_all if "_trim_" in path.name.lower()] or video_files_all
    image_files = [path for path in files if media_kind(path) == "image"]

    candidates: list[dict[str, Any]] = []
    manual_needed: list[dict[str, Any]] = []

    for index, scene in enumerate(scenes):
      if not isinstance(scene, dict):
          continue
      sid = scene_id(scene, index)
      scene_candidates: list[dict[str, Any]] = []
      for rank, path in enumerate(video_files):
          confidence, reasons = score_video_candidate(scene, index, path, rank)
          if confidence <= 0:
              continue
          scene_candidates.append({
              "sceneId": sid,
              "slot": "video",
              "kind": "video",
              "confidence": round(confidence, 3),
              "reasons": reasons,
              "staticUrl": static_url_for(path, backend_dir),
              **file_entry(path),
          })
      for path in image_files:
          confidence, reasons, slot = score_image_candidate(scene, index, path)
          if confidence <= 0:
              continue
          scene_candidates.append({
              "sceneId": sid,
              "slot": slot,
              "kind": "image",
              "confidence": round(confidence, 3),
              "reasons": reasons,
              "staticUrl": static_url_for(path, backend_dir),
              **file_entry(path),
          })
      scene_candidates.sort(key=lambda item: item["confidence"], reverse=True)
      high = [item for item in scene_candidates if item["confidence"] >= 0.85]
      if high:
          candidates.extend(high[:3])
      elif scene_candidates:
          manual_needed.append({
              "sceneId": sid,
              "reason": "manual selection needed",
              "topCandidates": scene_candidates[:5],
          })

    linked_files = {item["path"] for item in candidates}
    unlinked_files = [file_entry(path) for path in files if str(path) not in linked_files]
    return {
        "projectId": project_id,
        "dryRun": True,
        "projectFile": str(backend_dir / "storage" / "ava_db.json"),
        "summary": {
            "scenes": len(scenes),
            "filesScanned": len(files),
            "videoFiles": len(video_files_all),
            "imageFiles": len(image_files),
            "highConfidenceCandidates": len(candidates),
            "manualSelectionNeeded": len(manual_needed),
            "unlinkedFiles": len(unlinked_files),
        },
        "candidates": candidates,
        "manualSelectionNeeded": manual_needed,
        "unlinkedFiles": unlinked_files,
        "warnings": [
            "Dry-run only: ava_db.json was not modified.",
            "Order-based board_videos matches are intentionally low confidence unless filename contains scene id.",
        ],
    }


def apply_repair(report: dict[str, Any], backend_dir: Path) -> None:
    high = [item for item in report.get("candidates", []) if float(item.get("confidence") or 0) >= 0.85]
    if not high:
        raise SystemExit("No high-confidence candidates to apply")
    raise SystemExit("--apply is intentionally not implemented yet; review dry-run candidates first")


def main() -> int:
    parser = argparse.ArgumentParser(description="Dry-run repair candidates for lost Board media links.")
    parser.add_argument("--project-id", required=True)
    parser.add_argument("--dry-run", action="store_true", help="Default mode; write candidates report without mutating ava_db.json.")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    backend_dir = repo_root / "backend"
    report = build_candidates(args.project_id, backend_dir)
    out_path = backend_dir / f"media_repair_candidates_{args.project_id}.json"
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Repair candidates for {args.project_id}")
    print(f"Report saved: {out_path}")
    print("Summary:", json.dumps(report["summary"], ensure_ascii=False))
    for item in report["candidates"][:20]:
        print(f"  CANDIDATE {item['sceneId']} {item['slot']} {item['confidence']} {item['staticUrl']}")
    if report["manualSelectionNeeded"]:
        print(f"Manual selection needed: {len(report['manualSelectionNeeded'])}")
    if args.apply:
        backup = backend_dir / "storage" / f"ava_db.before_media_repair_{args.project_id}.json"
        shutil.copy2(backend_dir / "storage" / "ava_db.json", backup)
        apply_repair(report, backend_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
