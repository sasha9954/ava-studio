# AVA Notification Routing Fix Notes

Scope: notification routing only. Board/Podcast/Assembly persistence is not changed.

Problem observed:
- A completed-video notification was clicked.
- It opened a wrong/empty Board-like state with 1 scene instead of the project Board with 4 scenes and media.
- Board and Assembly persistence themselves worked; the issue is routing/payload of completed notifications.

Root causes addressed:
1. `AvaShellLayout.pushGlobalToast()` dropped `projectId` and `stage` from event details.
2. `globalToastDestination()` allowed `/app/workspace/board` fallback even when a project context was available.
3. `BoardPage.pushBoardToast()` used `window.location.pathname` and did not include explicit project metadata.
4. `BoardPage.registerAvaGlobalJob()` stored the current path instead of a canonical project Board path.
5. `GlobalJobNotifier` and generator job payloads defaulted to workspace generator paths.

Patch behavior:
- Toasts now preserve `projectId`, `stage`, and canonical `to/pagePath`.
- If a toast/job has or can infer a `projectId`, destination becomes `/app/projects/<projectId>/<stage>`.
- Workspace fallback is used only when no project context exists.
- Board video/MMAudio notifications point to `/app/projects/<projectId>/board`.
- Generator notifications can point to `/app/projects/<projectId>/generator` when opened inside a project.

Files changed:
- frontend/src/layout/AvaShellLayout.jsx
- frontend/src/pages/BoardPage.jsx
- frontend/src/components/GlobalJobNotifier.jsx
- frontend/src/pages/standalone_generator/StandaloneGeneratorPage.jsx

Test checklist:
1. Build frontend.
2. Start backend/frontend.
3. Open one Ava tab in project `p_d9060eb6c417438b`.
4. Generate Board video or MMAudio.
5. Move to another page inside the same project while job runs.
6. Click completed toast.
7. Expected: `/app/projects/p_d9060eb6c417438b/board`, same project Board, same scenes/media.
8. Repeat for Generator later: completed toast should open `/app/projects/<projectId>/generator` when generated inside a project.
