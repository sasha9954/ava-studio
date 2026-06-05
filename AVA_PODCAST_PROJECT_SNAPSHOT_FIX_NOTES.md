# AVA Podcast project snapshot fix

Scope: `frontend/src/pages/podcast_audio/PodcastAudioComposerPage.jsx` only.

Goal: make Podcast persist through backend project/workspace snapshots, not only localStorage/IndexedDB.

What changed:
- Loads `podcast` stage on page open via `loadStage(projectId, 'podcast')` or `loadWorkspaceStage('podcast')`.
- Restores main podcast audio and blocks/savedClips/actorAudios from backend snapshot when available.
- Autosaves Podcast state to backend after hydration and edits via `saveStage(projectId, 'podcast', snapshot, 'safe_merge')` or `saveWorkspaceStage('podcast', snapshot)`.
- Snapshot stores durable asset paths (`/assets/<asset_id>/file`) and strips runtime blob/local playback URLs.
- Existing localStorage/IndexedDB persist remains as local cache for F5 and actor blob fallback.

Test checklist:
1. Open one Ava tab only.
2. Open project `p_d9060eb6c417438b` or a new test project.
3. Open Podcast.
4. Upload audio, cut/edit a few blocks.
5. Confirm backend log includes `POST /api/projects/<project_id>/snapshots/podcast`.
6. Run `python inspect_podcast.py` or inspect `ava_db.json`: project snapshot stages should now include `podcast`.
7. F5 on work PC: Podcast restores.
8. Open same project from another computer: Podcast should restore the same audio/blocks.
9. Confirm snapshot audio fields use `/assets/<asset_id>/file`, not `blob:`, `localhost`, or `/static/assets/...`.
