# AVA LOCAL CREDIT SUMMARY LOOP FIX

## Problem
The frontend opened, but pages loaded very slowly or stayed on loading screens. In DevTools Network there were many repeated `summary` requests pending.

## Cause
`AvaShellLayout.jsx` refreshed credits by calling `/credits/summary`. After receiving a balance, it dispatched `ava:user-updated`. The same component listened to `ava:user-updated` and immediately called `refreshShellCredits()` again.

That created a request feedback loop:

`/credits/summary` -> `ava:user-updated` -> `/credits/summary` -> ...

This made project creation/deletion, Timing, Board, Assembly and Podcast look frozen.

## Fix
- Added `creditsRefreshInFlightRef` to prevent overlapping `/credits/summary` requests.
- Removed the self-triggering refresh from the `ava:user-updated` listener.
- The listener now only updates the visible balance if the event already contains a balance.

## Changed file
- `frontend/src/layout/AvaShellLayout.jsx`

## Expected result
Network should no longer fill with repeated pending `summary` requests. Pages should open normally after rebuild and preview restart.
