/**
 * Central permission matrix.
 *
 * This is the ONLY place that decides what a role is allowed to do.
 * Both the human-facing routes (routes/tasks.js, routes/users.js, ...)
 * and the AI assistant (routes/assistant.js) call the same `can()`
 * function defined here. Nothing — human or AI — bypasses this.
 *
 * Roles: admin > operator > viewer
 */

const ROLES = ['admin', 'operator', 'viewer'];

const PERMISSIONS = {
  admin: [
    'view_tasks',
    'create_task',
    'edit_task',
    'delete_task',
    'change_status',
    'assign_task',
    'comment_task',
    'manage_users',
    'view_users',
    'view_audit_log',
    // AI actions
    'ai_summarize',
    'ai_suggest_priority',
    'ai_mark_reviewed',
    'ai_add_comment',
  ],
  operator: [
    'view_tasks',
    'create_task',
    'edit_task',
    'change_status',
    'comment_task',
    // AI actions
    'ai_summarize',
    'ai_suggest_priority',
    'ai_mark_reviewed',
    'ai_add_comment',
  ],
  viewer: [
    'view_tasks',
    // AI actions - read-only assistant use only
    'ai_summarize',
  ],
};

/**
 * @param {string} role
 * @param {string} action
 * @returns {boolean}
 */
function can(role, action) {
  if (!role || !PERMISSIONS[role]) return false;
  return PERMISSIONS[role].includes(action);
}

function actionsFor(role) {
  return PERMISSIONS[role] ? [...PERMISSIONS[role]] : [];
}

module.exports = { ROLES, PERMISSIONS, can, actionsFor };
