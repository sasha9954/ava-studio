# AVA Generator project snapshot / asset persistence fix

Scope: Standalone Generator only.

## What changed

- Re-enabled generator active job registration in `ava:active-jobs:v1` so the shell can poll/show completed notifications again.
- Generator jobs now carry `projectId`, `stage: generator`, and a project-scoped `pagePath`.
- Generator requests now include `project_id/projectId` when opened inside a project.
- Uploaded generator start/end images and audio are registered as project assets via `/api/assets/media`.
- Generator saves project-scoped snapshot stage `generator` via `/api/projects/<projectId>/snapshots/generator`.
- Generator restores project snapshot on another computer.
- Project mode now skips old localStorage/IndexedDB restore so stale local generator data does not override the backend snapshot.
- Generator → Assembly handoff now writes to project Board snapshot when inside a project.

## What it should fix

- Uploaded generator input photo not visible on another computer.
- Completed generator result not appearing in UI after backend finishes.
- No completed notification after generator job.
- Generator state living only in localStorage.
- Old generator jobs being charged with `project_id: None` when opened from a project.

## What was not changed

- Backend generation logic.
- Comfy workflow.
- Board/Pagination/Persistence logic outside generator.
- Credits backend policy.

## Test checklist

1. Open project generator: `/app/projects/<projectId>/generator`.
2. Upload start photo.
3. Verify backend log has `POST /api/assets/media` with project assets.
4. Run a short i2v job.
5. Verify backend generation succeeds.
6. UI should show the result when done.
7. Completed notification should appear and route to `/app/projects/<projectId>/generator`.
8. Run `inspect_generator.py`; stage `generator` should exist.
9. Open same project on another computer; generator photo/gallery/result should restore.
10. Verify credit ledger has the correct project_id, not `None`.
