/**
 * Thin wrapper around the AI provider used by the assistant.
 *
 * If ANTHROPIC_API_KEY is set, real calls are made to Claude.
 * If it is not set, deterministic heuristics stand in so the whole
 * app runs and demos correctly with zero external setup (useful for
 * `docker compose up` on a machine with no API key).
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

async function callClaude(prompt, maxTokens = 500) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const textBlock = (data.content || []).find((b) => b.type === 'text');
  return textBlock ? textBlock.text : '';
}

/** Summarize the given tasks into a short status report. */
async function summarizeTasks(tasks) {
  if (!tasks.length) return 'There are no tasks to summarize yet.';

  if (ANTHROPIC_API_KEY) {
    const prompt =
      'Summarize this team task list in 4-6 short sentences for a manager. ' +
      'Call out anything overdue or high priority. Be concise, plain text, no markdown headers.\n\n' +
      JSON.stringify(
        tasks.map((t) => ({
          title: t.title,
          status: t.status,
          priority: t.priority,
          due_date: t.due_date,
          assigned_to: t.assignee_name,
        }))
      );
    return callClaude(prompt);
  }

  // Heuristic fallback (no API key configured)
  const byStatus = tasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});
  const overdue = tasks.filter(
    (t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done'
  );
  const highPriority = tasks.filter((t) => t.priority === 'high' && t.status !== 'done');

  const parts = [];
  parts.push(`There are ${tasks.length} tasks total.`);
  parts.push(
    Object.entries(byStatus)
      .map(([status, count]) => `${count} ${status.replace('_', ' ')}`)
      .join(', ') + '.'
  );
  if (highPriority.length) {
    parts.push(
      `${highPriority.length} high-priority task(s) still open: ${highPriority
        .map((t) => t.title)
        .slice(0, 5)
        .join(', ')}.`
    );
  }
  if (overdue.length) {
    parts.push(
      `${overdue.length} task(s) are past their due date: ${overdue
        .map((t) => t.title)
        .slice(0, 5)
        .join(', ')}.`
    );
  } else {
    parts.push('Nothing is overdue right now.');
  }
  return parts.join(' ');
}

/**
 * Suggest a priority for a single task. Returns one of 'low' | 'medium' | 'high'
 * plus a short reason. This never writes the real `priority` column itself -
 * it only produces a suggestion; a human with edit_task permission has to
 * accept it for it to take effect.
 */
async function suggestPriority(task) {
  if (ANTHROPIC_API_KEY) {
    const prompt =
      'Given this task, reply with strict JSON only: {"priority": "low"|"medium"|"high", "reason": "<one short sentence>"}.\n\n' +
      JSON.stringify({
        title: task.title,
        description: task.description,
        due_date: task.due_date,
        status: task.status,
      });
    const raw = await callClaude(prompt, 200);
    try {
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (['low', 'medium', 'high'].includes(parsed.priority)) return parsed;
    } catch (e) {
      // fall through to heuristic if the model didn't return clean JSON
    }
  }

  // Heuristic fallback
  const daysUntilDue = task.due_date
    ? (new Date(task.due_date) - new Date()) / (1000 * 60 * 60 * 24)
    : null;
  const urgentWords = /urgent|asap|blocker|critical|outage/i;
  const text = `${task.title} ${task.description || ''}`;

  if ((daysUntilDue !== null && daysUntilDue < 2) || urgentWords.test(text)) {
    return { priority: 'high', reason: 'Due very soon or flagged as urgent in its text.' };
  }
  if (daysUntilDue !== null && daysUntilDue < 7) {
    return { priority: 'medium', reason: 'Due within the week.' };
  }
  return { priority: 'low', reason: 'No due date pressure or urgency keywords found.' };
}

module.exports = { summarizeTasks, suggestPriority, usingRealAI: Boolean(ANTHROPIC_API_KEY) };
