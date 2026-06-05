# AVA Generator auth preview fix

Scope: frontend-only, Generator UI preview/auth restoration.

Issue:
- Generator project snapshot persistence started working, but uploaded project assets were stored as `/assets/asset_xxx/file`.
- Direct `<img src="/api/assets/...">` / `<video src="/api/assets/...">` requests do not include the bearer token, so protected project assets returned 401 Unauthorized and previews looked broken.

Fix:
- Added authenticated asset preview loading for Generator using fetch + `Authorization` header + object URL.
- Start/end previews, generated result preview, and history thumbnails now use authenticated blob URLs when the source is `/assets/asset_xxx/file` or `/api/assets/asset_xxx/file`.
- Upload still stores canonical project asset paths in snapshots (`/assets/asset_xxx/file`), but the UI preview uses a temporary blob URL.
- Download/frame fetches for protected assets now use auth headers.

No backend, credit, Comfy, Board, Podcast, or Assembly logic changed.
