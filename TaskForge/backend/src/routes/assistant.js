const express = require('express');
const { pool } = require('../db');
const { authenticate } = require('../middleware/auth');
const { can } = require('../config/permissions');
const { logAudit } = require('../utils/audit');
const { summarizeTasks, suggestPriority, usingRealAI } = require('../utils/ai');

const router = express.Router();
router.use(authenticate);

/**
 * IMPORTANT: The AI assistant is not a separate identity with its own
 * privileges. Every action below runs *as the logged-in user* and is
 * checked with the exact same `can(role, action)` function that
 * middleware/auth.js's requirePermission() uses for ordinary requests.
 * There is no code path where the assistant can do something its user
 * could not also do by calling the normal REST endpoints directly.
 *
 * The fixed, whitelisted actions are:
 *   - summarize          (read-only)
 *   - suggest-priority   (writes only a *suggestion* field, not real priority)
 *   - mark-reviewed      (same permission as the human "change status" action)
 *   - add-comment        (same permission as a human comment)
 * Nothing else is exposed. The AI cannot delete tasks, manage users, or
 * do anything outside this list, no matter what it is asked.
 */
async function checkAiAction(req, res, action) {
  const allowed = can(req.user.role, action);
  await logAudit({
    actorId: req.user.id,
    actorType: 'ai',
    action,
    allowed,
    details: { requestedBy: req.user.email },
  });
  if (!allowed) {
    res.status(403).json({
      error: `Forbidden: the assistant cannot perform '${action}' for role '${req.user.role}'`,
    });
    return false;
  }
  return true;
}

router.get('/status', (req, res) => {
  res.json({ usingRealAI });
});

router.post('/summarize', async (req, res) => {
  if (!(await checkAiAction(req, res, 'ai_summarize'))) return;

  const { rows } = await pool.query(`
    SELECT t.*, u.name AS assignee_name FROM tasks t
    LEFT JOIN users u ON u.id = t.assigned_to
  `);
  const summary = await summarizeTasks(rows);
  res.json({ summary });
});

router.post('/suggest-priority/:taskId', async (req, res) => {
  if (!(await checkAiAction(req, res, 'ai_suggest_priority'))) return;

  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.taskId]);
  const task = rows[0];
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const { priority, reason } = await suggestPriority(task);

  // NOTE: this only fills in a suggestion field. It never touches the
  // real `priority` column - accepting the suggestion still has to go
  // through PATCH /api/tasks/:id, which re-checks 'edit_task' and
  // ownership independently, same as any other edit.
  await pool.query(
    'UPDATE tasks SET ai_suggested_priority = $1, ai_suggestion_reason = $2 WHERE id = $3',
    [priority, reason, req.params.taskId]
  );

  res.json({ taskId: Number(req.params.taskId), suggestedPriority: priority, reason });
});

router.post('/mark-reviewed/:taskId', async (req, res) => {
  // Deliberately reuses 'change_status' - marking something reviewed is
  // treated as exactly the same category of action as a human changing
  // task status, so it cannot be granted separately by mistake.
  if (!(await checkAiAction(req, res, 'change_status'))) return;

  const { rows } = await pool.query(
    'UPDATE tasks SET reviewed = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *',
    [req.params.taskId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Task not found' });
  res.json(rows[0]);
});

router.post('/add-comment/:taskId', async (req, res) => {
  if (!(await checkAiAction(req, res, 'ai_add_comment'))) return;

  const { content } = req.body || {};
  if (!content) return res.status(400).json({ error: 'content is required' });

  const { rows } = await pool.query(
    `INSERT INTO task_comments (task_id, author_id, author_type, content)
     VALUES ($1, $2, 'ai', $3) RETURNING *`,
    [req.params.taskId, req.user.id, content]
  );
  res.status(201).json(rows[0]);
});

module.exports = router;
