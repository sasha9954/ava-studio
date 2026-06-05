# AVA global loading wave polish

UI-only polish for Ava Studio loading/transition screens.

Changed files:
- `frontend/src/pages/BoardPage.jsx`
- `frontend/src/pages/BoardAssemblyPage.jsx`
- `frontend/src/pages/ManualTimingPage.jsx`
- `frontend/src/styles/ava-board.css`
- `frontend/src/styles/ava-timing.css`

What changed:
- Board loading screen no longer shows the old Timing → Storyboard → Media → Queue step strip.
- Manual Timing loading screen no longer shows the old Prompt → Audio → Blocks → Ready step strip or side skeleton cards.
- Assembly loading keeps the same Ava audio-wave style.
- Loading cards are centered on the page instead of sitting near the upper-left/top area.
- The loader uses a small waveform, moving note, and progress line so transitions feel closer to the media/audio workflow.
- No backend, asset, snapshot, credit, notification, or persistence logic was changed.

Test checklist:
1. Run `npm run build`.
2. Open Manual Timing and check loading screen position/style.
3. Open Board and check loading screen position/style.
4. Open Assembly and check loading screen position/style.
5. Confirm Board/Podcast/Assembly persistence still restores normally after F5.
