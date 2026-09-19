import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import TaskList from '../components/TaskList';
import TaskForm from '../components/TaskForm';
import AIAssistant from '../components/AIAssistant';
import UserManagement from '../components/UserManagement';
import AuditLog from '../components/AuditLog';

const TABS = [
  { id: 'tasks', label: 'Tasks' },
  { id: 'users', label: 'Users', permission: 'view_users' },
  { id: 'audit', label: 'Audit log', permission: 'view_audit_log' },
];

export default function Dashboard() {
  const { user, can, logout } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [tab, setTab] = useState('tasks');
  const [loading, setLoading] = useState(true);

  async function loadTasks() {
    const data = await api.get('/tasks');
    setTasks(data);
    setLoading(false);
  }

  useEffect(() => {
    loadTasks();
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>TaskForge</h1>
          <span className="muted">
            {user.name} · <span className="role-pill">{user.role}</span>
          </span>
        </div>
        <button className="link-button" onClick={logout}>
          Sign out
        </button>
      </header>

      <nav className="tabs">
        {TABS.filter((t) => !t.permission || can(t.permission)).map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'tab active' : 'tab'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'tasks' && (
        <div className="dashboard-grid">
          <div>
            {can('create_task') && <TaskForm onCreated={loadTasks} />}
            {loading ? <p className="muted">Loading tasks...</p> : <TaskList tasks={tasks} onChange={loadTasks} />}
          </div>
          <div>
            <AIAssistant tasks={tasks} onChange={loadTasks} />
          </div>
        </div>
      )}

      {tab === 'users' && can('view_users') && <UserManagement />}
      {tab === 'audit' && can('view_audit_log') && <AuditLog />}
    </div>
  );
}
