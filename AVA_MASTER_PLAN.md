# AVA-STUDIO MASTER PLAN

## Текущий статус

- Продукт: `ava-studio`.
- Текущий этап: Stage 1/2 skeleton.
- Цель текущего пакета: новая красивая оболочка + auth + projects + autosave snapshots.
- Старый PhotoStudio не ломаем.

## Главная идея

`ava-studio` — отдельный AI video workflow product:

```text
аккаунт → проект → этапы → автосохранение → финальное видео
```

## Главные модули

1. Manual Timing — разбивка аудио на сцены/фразы.
2. Podcast — сборка подкастного аудио.
3. Board / Доска — сцены, кадры, промты, генерация видео по частям.
4. Board Assembly — сборка полного видео из сгенерированных сцен Доски.
5. Video Node — отдельная ветка для готовой нарезки видео+аудио/Video Match JSON.
6. Standalone Generator — быстрые тесты i2v/ia2v/first-last/image+audio.
7. Account/Credits/Projects.

## Нельзя путать

Board Assembly и Video Node — разные вещи.

- Доска генерирует видео по частям.
- Board Assembly склеивает эти сгенерированные сцены в полный ролик.
- Video Node работает с уже готовой нарезкой видео+аудио и собирает по готовым отрезкам.

## Этапы разработки

### Stage 1 — Shell

- Splash.
- Login/Register.
- Dashboard.
- Sidebar.
- Topbar.
- Module cards.
- Красивый CSS.

### Stage 2 — Projects + Autosave

- My Projects.
- Create Project.
- Active Project.
- ProjectContext.
- Backend save/load.
- Stage snapshots.

### Stage 3 — Account-scoped storage

- account_id + project_id + stage.
- backend durable save.
- assets folders.
- защита от затирания богатого состояния пустым snapshot.

### Stage 4 — Manual Timing integration

- открыть Timing внутри `/app/projects/:projectId/timing`.
- сохранять timing state в project snapshot.
- передавать scenes/audio в Board и Video Node.

### Stage 5 — Podcast integration

- открыть Podcast внутри projectId.
- сохранять podcast manifest.
- передавать assembled audio в Timing.

### Stage 6 — Board integration

- открыть Board внутри projectId.
- принять scenes из Timing.
- сохранить prompts/images/videos/jobs.
- восстановление после F5.

### Stage 7 — Board Assembly

- отдельная страница `/board-assembly`.
- собрать полный ролик из сцен Доски.
- не смешивать с Video Node.

### Stage 8 — Video Node

- отдельная страница `/video-node`.
- source video + audio + Video Match JSON.
- candidate selection.
- preview/assembly.

### Stage 9 — Standalone Generator

- i2v.
- ia2v.
- first-last.
- image+audio.
- fast test jobs.

### Stage 10 — Credits / Billing

- ledger.
- списание за job.
- история операций.

### Stage 11 — Multi-user server hardening

- доступ только к своим проектам.
- лимиты.
- storage quotas.
- HTTPS.
- production DB.

## Активаторы для новых чатов

```text
AVA-STUDIO STAGE 1 SHELL CONTINUE
AVA-STUDIO STAGE 2 PROJECTS AUTOSAVE CONTINUE
AVA-STUDIO STAGE 4 MANUAL TIMING INTEGRATION START
AVA-STUDIO BOARD ASSEMBLY != VIDEO NODE REMINDER
```
