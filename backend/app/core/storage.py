import json
import os
import shutil
import tempfile
import threading
import time
from copy import deepcopy
from datetime import datetime
from typing import Any

from app.core.config import get_settings
from app.core.security import now_iso
from pathlib import Path  # V198B Path import fix


class JsonStore:
    """Small local JSON store for v0.1.

    This is useful for development and Codex work. For a real multi-user server,
    migrate the same schema to PostgreSQL or SQLite migrations.

    V198A safety layer:
    - writes go to a temporary file first;
    - the temporary JSON is parsed back before replacing ava_db.json;
    - the previous valid ava_db.json is copied to storage/backups before replace;
    - backups are throttled so autosave/status polling does not copy the DB on every request;
    - at startup/read time, a corrupted ava_db.json is restored from the latest
      valid backup instead of crashing the whole API.
    """

    BACKUP_KEEP_COUNT = 30
    BACKUP_MIN_INTERVAL_SEC = 30

    def __init__(self) -> None:
        settings = get_settings()
        self.storage_dir = settings.storage_path
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = self.storage_dir / 'ava_db.json'
        self.backup_dir = self.storage_dir / 'backups'
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        self._last_backup_monotonic = 0.0
        if not self.db_path.exists():
            self._write(self._empty_db(), make_backup=False)
        else:
            self._ensure_readable_or_recover(reason='startup')

    def _empty_db(self) -> dict[str, Any]:
        return {
            'users': {},
            'sessions': {},
            'projects': {},
            'snapshots': {},
            'workspaces': {},
            'workspace_snapshots': {},
            'jobs': {},
            'assets': {},
            'credits_ledger': [],
            'created_at': now_iso(),
            'updated_at': now_iso(),
        }

    def _migrate(self, data: dict[str, Any]) -> dict[str, Any]:
        changed = False
        defaults = self._empty_db()
        for key, value in defaults.items():
            if key not in data:
                data[key] = value
                changed = True
        if changed:
            self._write(data)
        return data

    def _load_json_path(self, path) -> dict[str, Any]:
        with path.open('r', encoding='utf-8') as f:
            data = json.load(f)
        if not isinstance(data, dict):
            raise ValueError(f'JSON database root must be an object: {path}')
        return data

    def _valid_backup_paths(self) -> list:
        candidates = sorted(
            self.backup_dir.glob('ava_db_*.json'),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        valid = []
        for path in candidates:
            try:
                self._load_json_path(path)
            except Exception:
                continue
            valid.append(path)
        return valid

    def _copy_current_to_backup(self) -> None:
        if not self.db_path.exists():
            return

        now = time.monotonic()
        has_any_backup = any(self.backup_dir.glob('ava_db_*.json'))
        if has_any_backup and (now - self._last_backup_monotonic) < self.BACKUP_MIN_INTERVAL_SEC:
            return

        try:
            self._load_json_path(self.db_path)
        except Exception as exc:
            print(f'[JSON STORE BACKUP SKIP V198A] current db is not valid: {exc}', flush=True)
            return
        stamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
        backup_path = self.backup_dir / f'ava_db_{stamp}.json'
        shutil.copy2(self.db_path, backup_path)
        self._last_backup_monotonic = now
        print(f'[JSON STORE BACKUP V198A] {backup_path}', flush=True)
        self._prune_backups()

    def _prune_backups(self) -> None:
        backups = sorted(
            self.backup_dir.glob('ava_db_*.json'),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        for old_backup in backups[self.BACKUP_KEEP_COUNT:]:
            try:
                old_backup.unlink()
            except OSError:
                pass

    def _quarantine_corrupt_db(self, reason: str, error: Exception) -> None:
        if not self.db_path.exists():
            return
        stamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
        corrupt_path = self.storage_dir / f'ava_db.corrupt_{reason}_{stamp}.json'
        try:
            shutil.copy2(self.db_path, corrupt_path)
            print(
                f'[JSON STORE CORRUPT COPY V198A] reason={reason} error={error} path={corrupt_path}',
                flush=True,
            )
        except OSError as copy_exc:
            print(
                f'[JSON STORE CORRUPT COPY FAILED V198A] reason={reason} error={error} copy_error={copy_exc}',
                flush=True,
            )

    def _restore_latest_valid_backup(self, reason: str, error: Exception) -> dict[str, Any]:
        self._quarantine_corrupt_db(reason=reason, error=error)
        valid = self._valid_backup_paths()
        if not valid:
            raise RuntimeError(f'ava_db.json is corrupted and no valid backups were found: {error}') from error
        latest = valid[0]
        data = self._load_json_path(latest)
        shutil.copy2(latest, self.db_path)
        print(
            f'[JSON STORE RECOVERED V198A] reason={reason} backup={latest} users={len(data.get("users") or {})} projects={len(data.get("projects") or {})}',
            flush=True,
        )
        return data

    def _ensure_readable_or_recover(self, reason: str) -> dict[str, Any]:
        try:
            return self._load_json_path(self.db_path)
        except Exception as exc:
            return self._restore_latest_valid_backup(reason=reason, error=exc)

    def _read(self) -> dict[str, Any]:
        try:
            data = self._load_json_path(self.db_path)
        except Exception as exc:
            data = self._restore_latest_valid_backup(reason='read', error=exc)
        return self._migrate(data)

    def _write(self, data: dict[str, Any], make_backup: bool = True) -> None:
        if not isinstance(data, dict):
            raise ValueError('JSON database root must be an object before write')
        data['updated_at'] = now_iso()

        raw = json.dumps(data, ensure_ascii=False, indent=2)
        # Validate the exact bytes/string we are about to write before touching ava_db.json.
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            raise ValueError('JSON database root became non-object during serialization')

        if make_backup:
            self._copy_current_to_backup()

        fd, tmp_name = tempfile.mkstemp(
            prefix='ava_db.',
            suffix='.json.tmp',
            dir=str(self.storage_dir),
            text=True,
        )
        tmp_path = self.storage_dir / Path(tmp_name).name
        try:
            with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as f:
                f.write(raw)
                f.flush()
                os.fsync(f.fileno())

            # Validate the actual temporary file from disk before replacing the main DB.
            self._load_json_path(tmp_path)
            os.replace(tmp_path, self.db_path)
            print(f'[JSON STORE ATOMIC WRITE V198A] {self.db_path}', flush=True)
        finally:
            try:
                if tmp_path.exists():
                    tmp_path.unlink()
            except OSError:
                pass

    def get_db(self) -> dict[str, Any]:
        with self.lock:
            return deepcopy(self._read())

    # AVA_PROJECT_SNAPSHOT_SINGLE_DB_READ_V216R2:
    # Snapshot GET previously called get_db three times (auth, project access, handler),
    # causing three full reads + deepcopies of the entire JSON database. Read the DB
    # once under the existing lock and copy only the records required by that request.
    def get_project_snapshot_context(self, token: str, project_id: str, stage: str) -> dict[str, Any]:
        wait_started = time.perf_counter()
        with self.lock:
            lock_acquired = time.perf_counter()
            data = self._read()
            read_finished = time.perf_counter()

            sessions = data.get('sessions') or {}
            session_value = sessions.get(token) if isinstance(sessions, dict) else None
            session = deepcopy(session_value) if isinstance(session_value, dict) else None

            user_id = session.get('user_id') if isinstance(session, dict) else None
            users = data.get('users') or {}
            user_value = users.get(user_id) if user_id and isinstance(users, dict) else None
            user = deepcopy(user_value) if isinstance(user_value, dict) else None

            projects = data.get('projects') or {}
            project_value = projects.get(project_id) if isinstance(projects, dict) else None
            project = deepcopy(project_value) if isinstance(project_value, dict) else None

            snapshots = data.get('snapshots') or {}
            project_snapshots_value = snapshots.get(project_id) if isinstance(snapshots, dict) else None
            project_snapshots = project_snapshots_value if isinstance(project_snapshots_value, dict) else {}
            snapshot_value = project_snapshots.get(stage)
            snapshot = deepcopy(snapshot_value) if isinstance(snapshot_value, dict) else None

            manual_value = project_snapshots.get('manual_timing') if stage == 'board' else None
            manual_timing_snapshot = deepcopy(manual_value) if isinstance(manual_value, dict) else None
            extract_finished = time.perf_counter()

        return {
            'session': session,
            'user': user,
            'project': project,
            'snapshot': snapshot,
            'manual_timing_snapshot': manual_timing_snapshot,
            '_timing_v216r2': {
                'lock_wait_ms': round((lock_acquired - wait_started) * 1000.0, 1),
                'db_read_ms': round((read_finished - lock_acquired) * 1000.0, 1),
                'extract_ms': round((extract_finished - read_finished) * 1000.0, 1),
                'total_ms': round((extract_finished - wait_started) * 1000.0, 1),
            },
        }

    # AVA_AUDIO_STUDIO_QUICK_PREVIEW_AUDIO_CONTEXT_V216R3:
    # Read only the two relevant snapshots and project audio asset records in one
    # locked DB pass. This avoids repeated 80 MB get_db deepcopies while resolving
    # the master song for Quick Preview.
    def get_project_audio_context(self, project_id: str) -> dict[str, Any]:
        wait_started = time.perf_counter()
        with self.lock:
            lock_acquired = time.perf_counter()
            data = self._read()
            read_finished = time.perf_counter()

            snapshots = data.get('snapshots') or {}
            project_snapshots_value = snapshots.get(project_id) if isinstance(snapshots, dict) else None
            project_snapshots = project_snapshots_value if isinstance(project_snapshots_value, dict) else {}
            manual_value = project_snapshots.get('manual_timing')
            board_value = project_snapshots.get('board')
            manual_timing_snapshot = deepcopy(manual_value) if isinstance(manual_value, dict) else None
            board_snapshot = deepcopy(board_value) if isinstance(board_value, dict) else None

            audio_assets = []
            assets = data.get('assets') or {}
            asset_values = assets.values() if isinstance(assets, dict) else []
            for asset in asset_values:
                if not isinstance(asset, dict):
                    continue
                if str(asset.get('project_id') or asset.get('projectId') or '') != str(project_id or ''):
                    continue
                kind = str(asset.get('kind') or '').lower().strip()
                mime = str(asset.get('mime_type') or asset.get('mimeType') or '').lower().strip()
                if kind == 'audio' or mime.startswith('audio/'):
                    audio_assets.append(deepcopy(asset))
            extract_finished = time.perf_counter()

        return {
            'manual_timing_snapshot': manual_timing_snapshot,
            'board_snapshot': board_snapshot,
            'audio_assets': audio_assets,
            '_timing_v216r3': {
                'lock_wait_ms': round((lock_acquired - wait_started) * 1000.0, 1),
                'db_read_ms': round((read_finished - lock_acquired) * 1000.0, 1),
                'extract_ms': round((extract_finished - read_finished) * 1000.0, 1),
                'total_ms': round((extract_finished - wait_started) * 1000.0, 1),
            },
        }

    # AVA_AUDIO_STUDIO_QUICK_PREVIEW_ASSET_PREFETCH_V216R4:
    # Resolve all scene video asset records in one locked DB read. The old quick
    # preview path called store.get_db() once per /assets/... video reference,
    # which reread and deep-copied the entire ~80 MB JSON database 54 times.
    def get_project_asset_records(self, project_id: str, asset_ids: list[str] | tuple[str, ...] | set[str]) -> dict[str, Any]:
        normalized_ids = []
        seen_ids = set()
        for value in asset_ids or []:
            asset_id = str(value or '').strip()
            if not asset_id or asset_id in seen_ids:
                continue
            seen_ids.add(asset_id)
            normalized_ids.append(asset_id)

        wait_started = time.perf_counter()
        with self.lock:
            lock_acquired = time.perf_counter()
            data = self._read()
            read_finished = time.perf_counter()

            assets = data.get('assets') or {}
            records = {}
            missing = []
            foreign = []
            for asset_id in normalized_ids:
                asset = assets.get(asset_id) if isinstance(assets, dict) else None
                if not isinstance(asset, dict):
                    missing.append(asset_id)
                    continue
                record_project_id = str(asset.get('project_id') or asset.get('projectId') or '').strip()
                if record_project_id and project_id and record_project_id != str(project_id):
                    foreign.append(asset_id)
                    continue
                records[asset_id] = deepcopy(asset)
            extract_finished = time.perf_counter()

        return {
            'assets': records,
            'requested_asset_ids': normalized_ids,
            'missing_asset_ids': missing,
            'foreign_asset_ids': foreign,
            '_timing_v216r4': {
                'lock_wait_ms': round((lock_acquired - wait_started) * 1000.0, 1),
                'db_read_ms': round((read_finished - lock_acquired) * 1000.0, 1),
                'extract_ms': round((extract_finished - read_finished) * 1000.0, 1),
                'total_ms': round((extract_finished - wait_started) * 1000.0, 1),
            },
        }

    def update(self, fn):
        with self.lock:
            data = self._read()
            result = fn(data)
            # AVA_JSON_STORE_SKIP_WRITE_V200C / AVA_JSON_STORE_SKIP_WRITE_V200E:
            # Some API handlers can prove that the payload/status poll is a semantic no-op.
            # In that case do not rewrite ava_db.json, do not fsync, and do not copy backups.
            if isinstance(result, dict) and (result.pop('_skip_store_write_v200e', False) or result.pop('_skip_store_write_v200c', False)):
                print('[JSON STORE WRITE SKIPPED V200E]', result.get('reason') or 'noop', flush=True)
                return result
            self._write(data)
            return result


store = JsonStore()
