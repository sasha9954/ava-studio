# AVA Studio — local Board media persistence fix

## Confirmed diagnosis

In `backend/storage/ava_db.json`, project `p_085866cb534a9aaf`, Board scene `seg_01` has a mixed durable reference:

```txt
video_asset_id = asset_0b7f6067db97b9d5
video_api_path = /static/assets/board_videos/boardjob_dd3363d637af41_LTX_2_3_i2v_00246__trim_5.800s.mp4
```

Correct durable form must be:

```txt
video_api_path = /assets/asset_0b7f6067db97b9d5/file
```

The archive also contains only 19 physical asset files under `backend/storage/users/.../workspace/assets`, while the DB references 7837 assets. Most project-level generated assets are missing from this clean package, so old generated media may not be recoverable from this archive. New Board generations should be tested after this patch.

## Files changed

- `backend/app/api/routes/ltx_board.py`
- `backend/app/api/routes/assets.py`
- `frontend/src/pages/BoardPage.jsx`
- `frontend/src/layout/AvaShellLayout.jsx`

## What the patch does

1. Board backend registers generated image/video outputs into the asset registry during job finalization.
2. Board status responses now prefer `/assets/<asset_id>/file` for `videoUrl`, `video_api_path`, `imageUrl`, and `image_api_path` when asset registration succeeds.
3. Board frontend canonicalizes durable media refs before saving to localStorage/backend snapshots: if `*_asset_id` exists, matching `*_api_path` and `*_url` are forced to `/assets/<asset_id>/file`.
4. Completed job restore/global polling also prefers asset paths instead of stale static paths.
5. Asset file reading now tolerates old Windows-style `storage\users\...` paths when running locally.
6. A misplaced React hook inside `pushGlobalToast()` was moved back to component top level to avoid invalid-hook behavior when notifications fire.

## Validation already run in sandbox

```bash
cd backend && python3 -m compileall -q app
cd frontend && npm install --ignore-scripts
cd frontend && npm run build
```

Both backend compile and frontend build completed successfully. Vite only reported the existing large-bundle warning.

## Local test target

After applying this locally, create a new Board video and verify in `backend/storage/ava_db.json` or browser console logs:

```txt
video_asset_id = asset_xxx
video_api_path = /assets/asset_xxx/file
video_url = /assets/asset_xxx/file
```

There should be no new durable Board video refs saved as `/static/assets/board_videos/...`.
