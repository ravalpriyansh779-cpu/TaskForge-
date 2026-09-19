const jwt = require('jsonwebtoken');
const { can } = require('../config/permissions');
const { logAudit } = require('../utils/audit');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

/**
 * Verifies the JWT and attaches { id, name, email, role } to req.user.
 * Every route below this point can trust req.user.role - it came from a
 * signed token, not from anything the client sent in the request body.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, name, email, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * requirePermission('edit_task') etc. This is THE gate. It is used on
 * every human route AND is called directly (not just as middleware) by
 * the AI assistant controller before it performs any action, so the AI
 * is held to the exact same rules as the logged-in user driving it.
 */
function requirePermission(action) {
  return async (req, res, next) => {
    const role = req.user?.role;
    const allowed = can(role, action);

    await logAudit({
      actorId: req.user?.id,
      actorType: 'user',
      action,
      allowed,
      details: { path: req.originalUrl, method: req.method },
    });

    if (!allowed) {
      return res.status(403).json({
        error: `Forbidden: role '${role}' is not permitted to perform '${action}'`,
      });
    }
    next();
  };
}

module.exports = { authenticate, requirePermission, JWT_SECRET };
