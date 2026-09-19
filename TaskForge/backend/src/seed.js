const bcrypt = require('bcryptjs');
const { pool } = require('./db');

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'password123';

async function seed() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  if (rows[0].count > 0) {
    console.log('Seed skipped: users already exist.');
    return;
  }

  console.log('Seeding demo users and tasks...');
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const demoUsers = [
    { name: 'Amrita (Admin)', email: 'admin@taskforge.dev', role: 'admin' },
    { name: 'Omkar (Operator)', email: 'operator@taskforge.dev', role: 'operator' },
    { name: 'Vivan (Viewer)', email: 'viewer@taskforge.dev', role: 'viewer' },
  ];

  const ids = {};
  for (const u of demoUsers) {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id`,
      [u.name, u.email, hash, u.role]
    );
    ids[u.role] = rows[0].id;
  }

  const demoTasks = [
    {
      title: 'Fix login rate limiting',
      description: 'Users are getting locked out too aggressively after failed attempts.',
      status: 'in_progress',
      priority: 'high',
      due_date: daysFromNow(1),
      assigned_to: ids.operator,
    },
    {
      title: 'Write onboarding docs',
      description: 'New hires have no written setup guide for the dev environment.',
      status: 'todo',
      priority: 'low',
      due_date: daysFromNow(20),
      assigned_to: ids.operator,
    },
    {
      title: 'Quarterly access review',
      description: 'Confirm every account still has the correct role before the audit.',
      status: 'todo',
      priority: 'medium',
      due_date: daysFromNow(5),
      assigned_to: ids.admin,
    },
    {
      title: 'Postgres backup verification',
      description: 'Restore last night\'s backup to staging and confirm row counts match.',
      status: 'review',
      priority: 'high',
      due_date: daysFromNow(-1),
      assigned_to: ids.admin,
    },
  ];

  for (const t of demoTasks) {
    await pool.query(
      `INSERT INTO tasks (title, description, status, priority, due_date, assigned_to, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [t.title, t.description, t.status, t.priority, t.due_date, t.assigned_to, ids.admin]
    );
  }

  console.log('Seed complete. Demo accounts (password: %s):', DEMO_PASSWORD);
  demoUsers.forEach((u) => console.log(`  - ${u.role}: ${u.email}`));
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

module.exports = { seed };
