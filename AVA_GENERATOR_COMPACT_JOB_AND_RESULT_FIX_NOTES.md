# AVA Generator Compact Job and Result Fix

## Purpose

Fixes the Generator after project snapshot persistence/auth preview patches:

- `QuotaExceededError` when saving `ava:active-jobs:v1`
- heavy Generator job/status payloads being written to `localStorage`
- old standalone generator localStorage keys consuming browser storage quota
- Generator result preview/history using protected `/assets/.../file` URLs directly
- heavy `rawResponse` being written into the project snapshot

## Files changed by patch script

- `frontend/src/pages/standalone_generator/StandaloneGeneratorPage.jsx`

The patch script creates a backup folder:

- `_backup_generator_compact_jobs_YYYYMMDD_HHMMSS/StandaloneGeneratorPage.jsx`

## Run

From project root:

```cmd
cd /d "C:\file\ava studio"
python patch_generator_compact_jobs.py
```

Then rebuild frontend:

```cmd
cd /d "C:\file\ava studio\frontend"
rmdir /s /q dist
npm run build
npm run preview -- --host 0.0.0.0 --port 8080
```

## Browser cleanup after build

In Generator page console:

```js
localStorage.removeItem('ava:active-jobs:v1');
localStorage.removeItem('ava:completed-jobs:v1');
localStorage.removeItem('ava:standalone_generator:gallery:v1');
localStorage.removeItem('ava:standalone_generator:media:v1');
localStorage.removeItem('ava:standalone_generator:settings:v1');
localStorage.removeItem('ava:standalone_generator:v6');
console.log('generator local cleanup done');
```

Then press `Ctrl+F5`.

## Test checklist

1. Open project Generator:
   `/app/projects/p_d9060eb6c417438b/generator`
2. Upload image.
3. Confirm preview is visible.
4. Start short i2v generation.
5. Confirm no `QuotaExceededError`.
6. Confirm result video appears in UI.
7. Confirm completed notification appears and returns to project Generator.
8. Run `inspect_generator.py`.
9. Confirm `STAGE: generator` contains `/assets/.../file`, no `blob:`, no `localhost`.
10. Open same project from another computer and confirm image/result restore.
