# TaskForge — Secure Team Dashboard with AI Assistant

A small team task dashboard built to answer one question honestly: **if you add
an AI assistant to an app, does it actually respect the same permissions as
the human using it, or does it quietly become a backdoor?**

TaskForge has three roles — **Admin**, **Operator**, and **Viewer** — that see
and can do different things, and an AI assistant that can summarize tasks and
suggest priorities but is restricted to a fixed list of safe actions, every
one of which is checked against the same permission rules a human's request
would be.

**Stack:** React (Vite) · Node.js/Express · PostgreSQL · Docker

## Why it's built this way

Most "role-based" demos hide buttons in the UI and call it a day. That's
cosmetic — anyone who opens dev tools and calls the API directly can still do
whatever they want. TaskForge enforces permissions in exactly one place on
the server (`backend/src/config/permissions.js`), and both the ordinary REST
routes and the AI assistant call that same function before doing anything.
There is no separate, more-trusted code path for the AI.

Every permission check — human or AI, allowed or denied — is written to an
`audit_log` table that an admin can view in the app. Try logging in as
**Viewer** and asking the assistant to "mark reviewed" — it gets a 403 from
the server, not just a hidden button, and the denied attempt shows up in the
audit log.

## Quick start

```bash
docker compose up --build
```

Then open:

- Frontend: http://localhost:8080
- Backend API: http://localhost:4000/api/health

The backend waits for Postgres, creates its schema, and seeds three demo
accounts automatically. **Password for all of them is `password123`:**

| Role     | Email                   | Can do                                                             |
|----------|-------------------------|---------------------------------------------------------------------|
| Admin    | admin@taskforge.dev     | Everything — manage users, delete tasks, view the audit log        |
| Operator | operator@taskforge.dev  | Create/edit/status-change on tasks they created or are assigned to |
| Viewer   | viewer@taskforge.dev    | Read-only task list + read-only AI summaries                       |

No API keys are required to run it. The AI assistant works out of the box
using a deterministic heuristic (due dates, urgency keywords, task counts).
If you set `ANTHROPIC_API_KEY` (see `backend/.env.example`), the assistant
switches to calling Claude for real summaries and priority suggestions —
everything else about the permission model is unchanged.

## Running without Docker

```bash
# Postgres needs to be running locally and match backend/.env values
cd backend && cp .env.example .env && npm install && npm run dev

cd frontend && npm install && npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:4000`.

## How the permission system works

```
backend/src/config/permissions.js   <- the ONLY source of truth: role -> [allowed actions]
backend/src/middleware/auth.js      <- authenticate() verifies the JWT
                                        requirePermission(action) is the gate every human route uses
backend/src/routes/assistant.js     <- the AI's fixed action list, gated by the SAME can() function
backend/src/utils/audit.js          <- every check (allow or deny) is logged here
```

Beyond role checks, operators are further restricted to tasks they created or
are assigned to (`canModifyTask` in `routes/tasks.js`) — an admin role check
alone isn't enough to model "operators can't touch each other's work."

### The AI assistant's fixed action list

The assistant cannot do anything outside these four actions, and none of them
let it exceed what the logged-in user could already do through the normal UI:

| Action              | Permission required   | What it actually changes                                   |
|---------------------|------------------------|--------------------------------------------------------------|
| Summarize tasks      | `ai_summarize`         | Nothing — read-only                                           |
| Suggest a priority   | `ai_suggest_priority`  | Writes a *suggestion* field only; a human must accept it via the normal edit-task endpoint, which re-checks permissions independently |
| Mark reviewed        | `change_status`        | Reuses the exact same permission a human uses to change status |
| Add a comment        | `ai_add_comment`       | Posts a comment tagged as AI-authored, same table humans use  |

## Project structure

```
TaskForge/
├── docker-compose.yml
├── backend/            Express API, Postgres schema, seed data
│   └── src/
│       ├── config/permissions.js
│       ├── middleware/auth.js
│       ├── routes/     auth, users, tasks, assistant, audit
│       └── utils/      ai.js, audit.js
└── frontend/           React (Vite) SPA
    └── src/
        ├── context/AuthContext.jsx
        ├── pages/      Login, Dashboard
        └── components/ TaskList, TaskForm, AIAssistant, UserManagement, AuditLog
```

## Notes

This is a portfolio/demo project. The JWT secret and demo passwords in
`docker-compose.yml` are placeholders — replace `JWT_SECRET` and rotate the
demo accounts' passwords before deploying this anywhere real.
