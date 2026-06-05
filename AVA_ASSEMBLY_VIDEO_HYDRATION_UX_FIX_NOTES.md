# AVA Assembly video hydration UX fix

## Scope

Small UI-only fix for `frontend/src/pages/BoardAssemblyPage.jsx`.

## Problem

When Board Assembly opened a scene whose video is stored as a protected asset path (`/assets/<asset_id>/file`), the preview panel briefly showed the hard empty-state:

- "Нет видео для этой сцены"
- "Вернись в доску и перегенерируй сцену."

The video was actually present, but the protected asset blob was still being fetched.

## Fix

Added a `selectedVideoLoadError` state and derived `selectedItemVideoHydrating` state.

Now the preview panel shows:

- "Загружаем видео сцены…"
- "Проверяем Board snapshot и подгружаем asset-файл. Это может занять несколько секунд."

while the asset blob is loading.

Only after asset loading fails does it show an unavailable/error state. Only if there is truly no video reference does it show the old "Нет видео" empty state.

## Safety

No snapshot logic changed.
No asset registration changed.
No Board/Generator/Podcast logic changed.
No backend changes.
