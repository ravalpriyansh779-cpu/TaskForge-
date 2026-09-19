const { pool } = require('../db');

/**
 * Records every permission check that happens in the system, whether it
 * came from a human clicking a button or the AI assistant trying to act.
 * This is what makes the permission system provable rather than just
 * "trust me" - an admin can open /api/audit and see every denied attempt.
 */
async function logAudit({ actorId, actorType = 'user', action, allowed, details = {} }) {
  try {
    await pool.query(
      `INSERT INTO audit_log (actor_id, actor_type, action, allowed, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [actorId || null, actorType, action, allowed, details]
    );
  } catch (err) {
    // Auditing must never crash the request path, but we do want to know.
    console.error('Failed to write audit log entry', err.message);
  }
}

module.exports = { logAudit };
