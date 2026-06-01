# Server deployment notes — ava-studio

## Current mode

The current backend uses JSON file storage for development:

```text
backend/storage/ava_db.json
```

This is enough for local Codex work and early UI testing, but for real users use PostgreSQL or SQLite migrations.

## Required production changes before public users

1. Replace `AVA_SECRET_KEY`.
2. Put frontend behind HTTPS.
3. Put backend behind HTTPS/reverse proxy.
4. Replace demo token sessions with signed JWT or secure server sessions.
5. Move local JSON storage to DB.
6. Add asset storage policy:

```text
users/{account_id}/projects/{project_id}/assets/
```

7. Add quotas and file size limits.
8. Add credits ledger for every paid generation.
9. Persist jobs to DB/disk, not memory.
10. Add backups.

## Docker local/server run

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose up -d --build
```

Frontend:

```text
http://server-ip:8080
```

Backend:

```text
http://server-ip:8000/api/health
```

## Reverse proxy idea

Later:

```text
https://ava-domain.com          -> frontend container
https://ava-domain.com/api      -> backend container /api
https://ava-domain.com/static   -> backend static assets or CDN
```
