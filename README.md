# ava-studio v0.1 Shell

`ava-studio` — отдельный продуктовый shell для AI video workflow: проекты, тайминг, подкаст, доска, сборка из доски, Video Node и быстрый генератор.

Текущая версия — **Stage 1 + Stage 2 skeleton**:

- красивый frontend shell;
- Splash → Login/Register → Dashboard;
- Sidebar + Topbar;
- карточки модулей;
- Мои проекты / Создать проект;
- backend auth/projects/credits;
- account/project-scoped snapshots;
- базовая готовность под сервер и GitHub/Codex.

> Важно: тяжёлые старые модули PhotoStudio пока не перенесены внутрь. Их нужно подключать по этапам, чтобы не сломать рабочую базу.

---

## 1. Куда положить на Windows

Распакуй папку в:

```bat
C:\file\ava studio
```

Итоговая структура должна быть такой:

```text
C:\file\ava studio
  backend\
  frontend\
  scripts\
  README.md
  AVA_MASTER_PLAN.md
  CODEX_START_HERE.md
```

---

## 2. Запуск backend

Открой PowerShell или CMD:

```bat
cd "C:\file\ava studio\backend"
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Проверка:

```text
http://localhost:8000/api/health
```

---

## 3. Запуск frontend

Во втором окне PowerShell или CMD:

```bat
cd "C:\file\ava studio\frontend"
npm install
copy .env.example .env
npm run dev
```

Открыть:

```text
http://localhost:5173
```

---

## 4. Быстрый запуск через scripts

После установки зависимостей можно запускать:

```bat
C:\file\ava studio\scripts\start_backend.bat
C:\file\ava studio\scripts\start_frontend.bat
```

---

## 5. Первый пользователь

Зайди в frontend, нажми **Создать аккаунт**, введи любой email/password. Backend хранит демо-данные локально в:

```text
backend/storage/ava_db.json
```

Для чистого старта можно удалить этот файл.

---

## 6. Что уже работает

- регистрация;
- вход;
- сохранение token в браузере;
- получение профиля;
- создание проекта;
- список проектов;
- открытие проекта;
- dashboard cards;
- project-scoped snapshot API;
- credits summary;
- визуальная оболочка ava-studio.

---

## 7. Что дальше подключать

По мастер-плану:

1. Manual Timing внутри projectId.
2. Podcast Composer внутри projectId.
3. Board / Доска.
4. Board Assembly — сборка полного видео из сгенерированных сцен Доски.
5. Video Node — отдельная ветка для готовой нарезки видео+аудио.
6. Standalone Generator.
7. Credits ledger + реальные списания.
8. Multi-user hardening + server deployment.

---

## 8. Важное правило архитектуры

**Board Assembly и Video Node — разные модули.**

- Board Assembly собирает полное видео из сцен, которые были сгенерированы в Доске.
- Video Node работает с готовым видео/аудио/Video Match JSON и собирает ролик из готовых отрезков.

---

## 9. GitHub

Если репозиторий ещё не создан, создай на GitHub пустой репозиторий:

```text
sasha9954/ava-studio
```

Потом локально:

```bat
cd "C:\file\ava studio"
git init
git add .
git commit -m "Initial ava-studio shell"
git branch -M main
git remote add origin https://github.com/sasha9954/ava-studio.git
git push -u origin main
```

После этого Codex сможет работать с репозиторием.

---

## 10. Серверная подготовка

Для сервера уже добавлены:

- `docker-compose.yml`;
- backend Dockerfile;
- frontend Dockerfile;
- nginx config для frontend;
- `.env.example`.

На сервере позже можно запускать через Docker Compose:

```bash
docker compose up -d --build
```

Для production нужно будет заменить demo JSON storage на PostgreSQL/SQLite migrations, добавить настоящий JWT secret, HTTPS и нормальную оплату.
