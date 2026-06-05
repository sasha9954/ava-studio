# Ava Studio — Assembly loading + selected scene polish

Scope: frontend-only UI polish for Board Assembly.

Changed files:
- `frontend/src/pages/BoardAssemblyPage.jsx`
- `frontend/src/styles/ava-board.css`

What changed:
- Reduced the selected scene visual treatment in Assembly scene strip:
  - thinner border/ring,
  - smaller check icon,
  - smaller `выбрано` badge,
  - softer shadow.
- Replaced the Assembly loading step/status cards with a compact montage-themed loader:
  - audio/waveform style block,
  - moving music note,
  - animated progress line.

Not changed:
- no backend changes,
- no asset path changes,
- no persistence/snapshot changes,
- no Board/Generator logic changes.

Test checklist:
1. `npm run build` passes.
2. Open `/app/projects/<projectId>/board-assembly`.
3. During loading, old step cards should be gone.
4. Loading screen should show the new audio/wave animation.
5. Scene strip selected card should remain visible but less aggressive.
6. F5 should still restore Assembly state and videos.
