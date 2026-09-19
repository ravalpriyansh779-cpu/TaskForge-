TaskForge — Secure Team Dashboard with AI Assistant
A small team task dashboard built to answer one question honestly: if you add an AI assistant to an app, does it actually respect the same permissions as the human using it, or does it quietly become a backdoor?

TaskForge has three roles — Admin, Operator, and Viewer — that see and can do different things, and an AI assistant that can summarize tasks and suggest priorities but is restricted to a fixed list of safe actions, every one of which is checked against the same permission rules a human's request would be.

Stack: React (Vite) · Node.js/Express · PostgreSQL · Docker

Why it's built this way
Most "role-based" demos hide buttons in the UI and call it a day. That's cosmetic — anyone who opens dev tools and calls the API directly can still do whatever they want. TaskForge enforces permissions in exactly one place on the server (backend/src/config/permissions.js), and both the ordinary REST routes and the AI assistant call that same function before doing anything. There is no separate, more-trusted code path for the AI.

Every permission check — human or AI, allowed or denied — is written to an audit_log table that an admin can view in the app. Try logging in as Viewer and asking the assistant to "mark reviewed" — it gets a 403 from the server, not just a hidden button, and the denied attempt shows up in the audit log.
