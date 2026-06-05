# AVA Board null-scene guard fix

Purpose: keep Board open when the saved project/timing/board data contains null or non-object scene entries, and avoid noisy MEDIA NULL FALLBACK loops when no scene is selected.

Changed:
- Added `isPlainObject` and `asSceneArray` helpers.
- Board scene arrays are compacted before normalization/rendering.
- `sceneMediaFieldValue()` now returns empty string for null/non-object scenes instead of logging repeatedly.
- Readiness counters and scene strip use compacted `boardScenes`.

Validation:
- `npm run build` passed in the patched frontend.
