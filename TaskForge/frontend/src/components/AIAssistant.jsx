import { useEffect, useState } from 'react';
import { api } from '../api';

export default function AIAssistant({ tasks, onChange }) {
  const [summary, setSummary] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState(tasks[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'ok' | 'error', text }
  const [usingRealAI, setUsingRealAI] = useState(null);

  useEffect(() => {
    api.get('/assistant/status').then((s) => setUsingRealAI(s.usingRealAI)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!tasks.find((t) => t.id === selectedTaskId) && tasks.length) {
      setSelectedTaskId(tasks[0].id);
    }
  }, [tasks, selectedTaskId]);

  async function run(actionFn) {
    setBusy(true);
    setMessage(null);
    try {
      await actionFn();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleSummarize() {
    run(async () => {
      const { summary } = await api.post('/assistant/summarize', {});
      setSummary(summary);
    });
  }

  async function handleSuggestPriority() {
    if (!selectedTaskId) return;
    run(async () => {
      const res = await api.post(`/assistant/suggest-priority/${selectedTaskId}`, {});
      setMessage({ type: 'ok', text: `Suggested "${res.suggestedPriority}" priority: ${res.reason}` });
      onChange();
    });
  }

  async function handleMarkReviewed() {
    if (!selectedTaskId) return;
    run(async () => {
      await api.post(`/assistant/mark-reviewed/${selectedTaskId}`, {});
      setMessage({ type: 'ok', text: 'Task marked as reviewed.' });
      onChange();
    });
  }

  async function handleAiComment() {
    if (!selectedTaskId) return;
    run(async () => {
      await api.post(`/assistant/add-comment/${selectedTaskId}`, {
        content: 'Reviewed by AI assistant on behalf of the current user - looks consistent with the task description.',
      });
      setMessage({ type: 'ok', text: 'AI comment added to the task.' });
      onChange();
    });
  }

  return (
    <div className="card ai-panel">
      <h3>AI Assistant</h3>
      <p className="muted">
        {usingRealAI === false && 'Running on the built-in heuristic (no ANTHROPIC_API_KEY set). '}
        Every action below runs as you, checked against your role's permissions — same as the buttons elsewhere on this page.
      </p>

      <button onClick={handleSummarize} disabled={busy}>
        Summarize all tasks
      </button>
      {summary && <div className="ai-summary">{summary}</div>}

      {tasks.length > 0 && (
        <div className="ai-task-actions">
          <label>
            Task
            <select value={selectedTaskId} onChange={(e) => setSelectedTaskId(Number(e.target.value))}>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          <div className="ai-buttons">
            <button onClick={handleSuggestPriority} disabled={busy}>
              Suggest priority
            </button>
            <button onClick={handleMarkReviewed} disabled={busy}>
              Mark reviewed
            </button>
            <button onClick={handleAiComment} disabled={busy}>
              Add AI comment
            </button>
          </div>
          <p className="muted small">
            Signed in as a role without these permissions? Try it anyway — the server will refuse the
            request the same way it would refuse a direct API call, and the attempt shows up in the audit log.
          </p>
        </div>
      )}

      {message && <div className={message.type === 'error' ? 'alert' : 'alert alert-ok'}>{message.text}</div>}
    </div>
  );
}
