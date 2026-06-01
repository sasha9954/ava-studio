# CODEX START HERE — ava-studio

## Project summary

This repository is the new `ava-studio` shell extracted from the larger PhotoStudio workflow idea. It should become a product shell for AI video workflow modules.

## Current stage

Stage 1/2 skeleton:

- frontend shell exists;
- backend auth/projects/credits exists;
- projects and snapshots are local JSON storage for now;
- heavy legacy modules are not integrated yet.

## Critical architecture rule

Board Assembly and Video Node are different workflows.

- Board Assembly assembles generated scene videos from Board.
- Video Node assembles from ready source video/audio cuts and Video Match JSON.

Do not merge them.

## Do not do yet

- Do not refactor all legacy modules at once.
- Do not delete old PhotoStudio modules unless explicitly asked.
- Do not replace backend storage with a large migration in the same PR as UI shell work.
- Do not wire paid generation without ledger safety.

## Preferred next tasks

1. Improve project switching and dirty-state autosave.
2. Add backend assets folder per account/project.
3. Integrate Manual Timing as a project-scoped page.
4. Add snapshot guard: empty snapshots cannot overwrite richer saved states.
5. Add server deployment notes and environment variables.

## Local dev

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
