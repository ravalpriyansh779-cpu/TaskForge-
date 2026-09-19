const express = require('express');
const { pool } = require('../db');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

const TASK_SELECT = `
  SELECT t.*, u.name AS assignee_name, c.name AS creator_name
  FROM tasks t
  LEFT JOIN users u ON u.id = t.assigned_to
  LEFT JOIN users c ON c.id = t.created_by
`;

/**
 * Operators can only edit/change-status on tasks they created or are
 * assigned to - admins can touch anything. This is enforced here, on the
 * server, in addition to the role check `requirePermission` already did.
 * A viewer never reaches this far because 'edit_task' isn't in their role.
 */
function canModifyTask(user, task) {
  if (user.role === 'admin') return true;
  return task.assigned_to === user.id || task.created_by === user.id;
}

router.get('/', requirePermission('view_tasks'), async (req, res) => {
  const { rows } = await pool.query(`${TASK_SELECT} ORDER BY t.created_at DESC`);
  res.json(rows);
});

router.get('/:id', requirePermission('view_tasks'), async (req, res) => {
  const { rows } = await pool.query(`${TASK_SELECT} WHERE t.id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Task not found' });
  res.json(rows[0]);
});

router.post('/', requirePermission('create_task'), async (req, res) => {
  const { title, description = '', due_date = null, assigned_to = null, priority = 'medium' } =
    req.body || {};
  if (!title) return res.status(400).json({ error: 'title is required' });

  const { rows } = await pool.query(
    `INSERT INTO tasks (title, description, due_date, assigned_to, created_by, priority)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [title, description, due_date, assigned_to, req.user.id, priority]
  );
  const full = await pool.query(`${TASK_SELECT} WHERE t.id = $1`, [rows[0].id]);
  res.status(201).json(full.rows[0]);
});

router.patch('/:id', requirePermission('edit_task'), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
  const task = rows[0];
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!canModifyTask(req.user, task)) {
    return res
      .status(403)
      .json({ error: 'Operators may only edit tasks they created or are assigned to' });
  }

  const fields = ['title', 'description', 'due_date', 'assigned_to', 'priority'];
  const updates = [];
  const values = [];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) {
      values.push(req.body[f]);
      updates.push(`${f} = $${values.length}`);
    }
  });
  if (req.body.assigned_to !== undefined && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins may reassign tasks' });
  }
  if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });

  values.push(req.params.id);
  await pool.query(
    `UPDATE tasks SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${values.length}`,
    values
  );
  const full = await pool.query(`${TASK_SELECT} WHERE t.id = $1`, [req.params.id]);
  res.json(full.rows[0]);
});

router.patch('/:id/status', requirePermission('change_status'), async (req, res) => {
  const { status } = req.body || {};
  const valid = ['todo', 'in_progress', 'review', 'done'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
  }

  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
  const task = rows[0];
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!canModifyTask(req.user, task)) {
    return res
      .status(403)
      .json({ error: 'Operators may only update status on tasks they created or are assigned to' });
  }

  await pool.query('UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2', [
    status,
    req.params.id,
  ]);
  const full = await pool.query(`${TASK_SELECT} WHERE t.id = $1`, [req.params.id]);
  res.json(full.rows[0]);
});

router.delete('/:id', requirePermission('delete_task'), async (req, res) => {
  await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

// --- Comments -------------------------------------------------------------

router.get('/:id/comments', requirePermission('view_tasks'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT tc.*, u.name AS author_name FROM task_comments tc
     LEFT JOIN users u ON u.id = tc.author_id
     WHERE tc.task_id = $1 ORDER BY tc.created_at ASC`,
    [req.params.id]
  );
  res.json(rows);
});

router.post('/:id/comments', requirePermission('comment_task'), async (req, res) => {
  const { content } = req.body || {};
  if (!content) return res.status(400).json({ error: 'content is required' });

  const { rows } = await pool.query(
    `INSERT INTO task_comments (task_id, author_id, author_type, content)
     VALUES ($1, $2, 'user', $3) RETURNING *`,
    [req.params.id, req.user.id, content]
  );
  res.status(201).json(rows[0]);
});

module.exports = router;
