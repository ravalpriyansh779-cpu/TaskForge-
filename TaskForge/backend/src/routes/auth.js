const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { authenticate, JWT_SECRET } = require('../middleware/auth');
const { actionsFor } = require('../config/permissions');
const { logAudit } = require('../utils/audit');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];

  const passwordOk = user ? await bcrypt.compare(password, user.password_hash) : false;

  if (!user || !passwordOk) {
    await logAudit({ action: 'login', allowed: false, details: { email } });
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  await logAudit({ actorId: user.id, action: 'login', allowed: true });

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

// Returns the logged-in user plus the exact list of actions their role is
// permitted to perform - the frontend uses this ONLY to decide what to show,
// never as the actual authorization check (that always happens server-side).
router.get('/me', authenticate, (req, res) => {
  res.json({
    user: req.user,
    permissions: actionsFor(req.user.role),
  });
});

module.exports = router;
