import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const STATUSES = ['todo', 'in_progress', 'review', 'done'];

function StatusBadge({ status }) {
  return <span className={`badge status-${status}`}>{status.replace('_', ' ')}</span>;
}

function PriorityBadge({ priority }) {
  return <span className={`badge priority-${priority}`}>{priority}</span>;
}

function TaskComments({ taskId, canComment }) {
  const [comments, setComments] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await api.get(`/tasks/${taskId}/comments`);
    setComments(data);
  }

  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await api.post(`/tasks/${taskId}/comments`, { content: text });
      setText('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (comments === null) {
    load();
    return <p className="muted">Loading comments...</p>;
  }

  return (
    <div className="comments">
      {comments.length === 0 && <p className="muted">No comments yet.</p>}
      {comments.map((c) => (
        <div key={c.id} className={`comment ${c.author_type === 'ai' ? 'comment-ai' : ''}`}>
          <strong>{c.author_type === 'ai' ? 'AI Assistant' : c.author_name || 'Unknown'}</strong>
          <p>{c.content}</p>
        </div>
      ))}
      {canComment && (
        <form className="comment-form" onSubmit={submit}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment..."
          />
          <button type="submit" disabled={busy}>
            Post
          </button>
        </form>
      )}
    </div>
  );
}

export default function TaskList({ tasks, onChange }) {
  const { can, user } = useAuth();
  const [expanded, setExpanded] = useState(null);
  const [errorFor, setErrorFor] = useState({});

  async function updateStatus(task, status) {
    try {
      await api.patch(`/tasks/${task.id}/status`, { status });
      onChange();
    } catch (err) {
      setErrorFor((e) => ({ ...e, [task.id]: err.message }));
    }
  }

  async function acceptSuggestion(task) {
    try {
      await api.patch(`/tasks/${task.id}`, { priority: task.ai_suggested_priority });
      onChange();
    } catch (err) {
      setErrorFor((e) => ({ ...e, [task.id]: err.message }));
    }
  }

  async function deleteTask(task) {
    if (!confirm(`Delete "${task.title}"?`)) return;
    await api.delete(`/tasks/${task.id}`);
    onChange();
  }

  if (!tasks.length) {
    return <p className="muted">No tasks yet.</p>;
  }

  return (
    <div className="task-list">
      {tasks.map((task) => {
        const canModify = user.role === 'admin' || task.assigned_to === user.id || task.created_by === user.id;
        const canChangeStatus = can('change_status') && canModify;
        return (
          <div className="card task-card" key={task.id}>
            <div className="task-header">
              <div>
                <h3>{task.title}</h3>
                <p className="muted">{task.description}</p>
              </div>
              <div className="task-badges">
                <PriorityBadge priority={task.priority} />
                <StatusBadge status={task.status} />
                {task.reviewed && <span className="badge reviewed">reviewed</span>}
              </div>
            </div>

            {task.ai_suggested_priority && task.ai_suggested_priority !== task.priority && (
              <div className="ai-suggestion">
                AI suggests <strong>{task.ai_suggested_priority}</strong> priority — {task.ai_suggestion_reason}
                {can('edit_task') && canModify && (
                  <button className="link-button" onClick={() => acceptSuggestion(task)}>
                    Accept
                  </button>
                )}
              </div>
            )}

            <div className="task-meta">
              <span>Assigned to: {task.assignee_name || 'Unassigned'}</span>
              {task.due_date && <span>Due: {task.due_date.slice(0, 10)}</span>}
            </div>

            <div className="task-actions">
              {canChangeStatus && (
                <select value={task.status} onChange={(e) => updateStatus(task, e.target.value)}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              )}
              {can('delete_task') && (
                <button className="danger" onClick={() => deleteTask(task)}>
                  Delete
                </button>
              )}
              <button className="link-button" onClick={() => setExpanded(expanded === task.id ? null : task.id)}>
                {expanded === task.id ? 'Hide comments' : 'Comments'}
              </button>
            </div>

            {errorFor[task.id] && <div className="alert">{errorFor[task.id]}</div>}

            {expanded === task.id && (
              <TaskComments taskId={task.id} canComment={can('comment_task')} />
            )}
          </div>
        );
      })}
    </div>
  );
}
