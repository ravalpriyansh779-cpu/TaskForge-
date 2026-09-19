import { useEffect, useState } from 'react';
import { api } from '../api';

export default function AuditLog() {
  const [entries, setEntries] = useState([]);

  async function load() {
    const data = await api.get('/audit?limit=100');
    setEntries(data);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="card">
      <h3>Audit log</h3>
      <p className="muted small">
        Every permission check in the system - human or AI, allowed or denied - lands here.
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>When</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td>{new Date(e.created_at).toLocaleString()}</td>
              <td>
                {e.actor_type === 'ai' ? 'AI (as ' : ''}
                {e.actor_name || 'unknown'}
                {e.actor_role ? ` / ${e.actor_role}` : ''}
                {e.actor_type === 'ai' ? ')' : ''}
              </td>
              <td>{e.action}</td>
              <td className={e.allowed ? 'ok-text' : 'danger-text'}>
                {e.allowed ? 'allowed' : 'denied'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
