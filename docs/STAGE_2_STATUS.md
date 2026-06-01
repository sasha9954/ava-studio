# ava-studio — Stage 2 Status

## Current goal

Build a clean product shell before integrating the old PhotoStudio modules.
Do not copy old modules blindly. Each module must be integrated stage-by-stage and must use account/project/workspace scoped backend persistence.

## Current architecture

- Frontend: React + Vite
- Backend: FastAPI
- Local dev storage: `backend/storage/ava_db.json`
- Product name: `ava-studio`

## Startup flow

- `/` shows the 3-second splash screen and then the entry card.
- Entry card has only:
  - Login
  - Register
- `/app/*` is protected.
- Guest users must not access project/workspace pages.

## Implemented frontend routes

- `/app/dashboard`
- `/app/projects`
- `/app/projects/new`
- `/app/account`
- `/app/credits`
- `/app/settings`
- `/app/workspace/timing`
- `/app/workspace/podcast`
- `/app/workspace/board`
- `/app/workspace/board-assembly`
- `/app/workspace/video-node`
- `/app/workspace/generator`
- `/app/projects/:projectId/...` module placeholders

## Implemented backend endpoints

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Projects

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/{project_id}`
- `PATCH /api/projects/{project_id}`
- `DELETE /api/projects/{project_id}` soft delete
- `GET /api/projects/{project_id}/summary`
- `GET /api/projects/{project_id}/snapshots/{stage}`
- `POST /api/projects/{project_id}/snapshots/{stage}`

### Workspace

- `GET /api/workspace/current`
- `GET /api/workspace/summary`
- `GET /api/workspace/snapshots/{stage}`
- `POST /api/workspace/snapshots/{stage}`
- `DELETE /api/workspace/current`

Workspace is for quick drafts without an explicit project. It is account-scoped.
Projects must not be auto-deleted. Workspace drafts may later get TTL cleanup.

### Credits

- `GET /api/credits/summary`
- `POST /api/credits/invite`
- `POST /api/credits/topup-demo`
- `POST /api/credits/charge`
- `POST /api/credits/refund`

Current invite code for local/dev testing: `99541984`.
It restores balance up to 1000 credits.

### Jobs

- `GET /api/jobs`
- `GET /api/jobs/{job_id}`
- `POST /api/jobs`
- `POST /api/jobs/{job_id}/complete`
- `POST /api/jobs/{job_id}/fail`

Jobs are tied to user and either project or workspace.
Job failure can refund credits.

### Storage / Settings

- `GET /api/storage/summary`
- `GET /api/storage/backup`

Settings service center displays account, workspace, storage, jobs and backup state.

## Important rules

1. Do not mix Board Assembly and Video Node.
   - Board Assembly: assembles generated scene videos from Board.
   - Video Node: works with existing video/audio cuts and Video Match JSON.

2. Do not move old PhotoStudio code wholesale.
   Integrate one module at a time.

3. Every module must support:
   - account isolation
   - project mode
   - workspace mode
   - backend save/load
   - F5 recovery

4. Credits must be charged once per job.
   Do not charge again during polling or after refresh.

5. If generation fails, refund should be possible through job failure logic.

6. The sidebar starts collapsed by default.

7. Project color is part of the UX and confirms the active project.

## Next stage

`AVA-STUDIO STAGE 3 — MANUAL TIMING INTEGRATION`

Recommended order:

1. Create a Manual Timing wrapper page inside the new shell.
2. Connect only safe UI shell first.
3. Connect backend load/save to project/workspace snapshots.
4. Test F5 recovery.
5. Add audio upload.
6. Add waveform/player pieces.
7. Add ASR.
8. Add export/handoff to Board.

Do not start with a full copy of the old module.
