const express = require('express');
const { pool } = require('../db');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', requirePermission('view_audit_log'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const { rows } = await pool.query(
    `SELECT a.*, u.name AS actor_name, u.role AS actor_role
     FROM audit_log a
     LEFT JOIN users u ON u.id = a.actor_id
     ORDER BY a.created_at DESC
     LIMIT $1`,
    [limit]
  );
  res.json(rows);
});

module.exports = router;
