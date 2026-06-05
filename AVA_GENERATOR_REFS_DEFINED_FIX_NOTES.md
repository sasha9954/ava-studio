# AVA Generator refs defined fix

Small follow-up fix after the compact generator job patch.

## Problem

Generator could start a backend job successfully but immediately throw a runtime error in the browser:

`ReferenceError: refs is not defined`

This happened because the compact job payload referenced `refs` while the job was still `queued/running` and no result video URL existed yet.

## Fix

`StandaloneGeneratorPage.jsx` now defines a safe empty refs object in the outer scope of both:

- polling/status result handling
- initial submit/start response handling

So queued/running responses can still save compact job metadata without crashing.

## Scope

Frontend only.
No backend, credits, snapshots, Board, Podcast, or Assembly changes.
