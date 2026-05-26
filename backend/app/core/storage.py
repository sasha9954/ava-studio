import json
import threading
from copy import deepcopy
from typing import Any

from app.core.config import get_settings
from app.core.security import now_iso


class JsonStore:
    """Small local JSON store for v0.1.

    This is useful for development and Codex work. For a real multi-user server,
    migrate the same schema to PostgreSQL or SQLite migrations.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self.storage_dir = settings.storage_path
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = self.storage_dir / 'ava_db.json'
        self.lock = threading.RLock()
        if not self.db_path.exists():
            self._write(self._empty_db())

    def _empty_db(self) -> dict[str, Any]:
        return {
            'users': {},
            'sessions': {},
            'projects': {},
            'snapshots': {},
            'workspaces': {},
            'workspace_snapshots': {},
            'jobs': {},
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

    def _read(self) -> dict[str, Any]:
        with self.db_path.open('r', encoding='utf-8') as f:
            data = json.load(f)
        return self._migrate(data)

    def _write(self, data: dict[str, Any]) -> None:
        data['updated_at'] = now_iso()
        tmp = self.db_path.with_suffix('.json.tmp')
        with tmp.open('w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        tmp.replace(self.db_path)

    def get_db(self) -> dict[str, Any]:
        with self.lock:
            return deepcopy(self._read())

    def update(self, fn):
        with self.lock:
            data = self._read()
            result = fn(data)
            self._write(data)
            return result


store = JsonStore()
