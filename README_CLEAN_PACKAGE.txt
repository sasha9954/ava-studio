AVA Studio clean laptop package

Included:
- backend/app, backend/storage, backend/static/assets, workflows/config/code
- frontend/src, public, package files, config
- docs/scripts/root project notes

Excluded intentionally:
- frontend/node_modules
- frontend/dist
- __pycache__ / .pyc
- logs
- temporary .bak hotfix files

After unpacking on laptop:
1) cd backend && python -m compileall app
2) cd ../frontend && npm install && npm run build
3) Run backend on 0.0.0.0:8010 and frontend preview/dev on 0.0.0.0:8080 for multi-device tests.

Important current diagnosis:
Some project scenes may contain video_asset_id while video_api_path still points to /static/assets/... . Repair should normalize durable refs to /assets/<asset_id>/file and preview via authenticated fetch/blob.
