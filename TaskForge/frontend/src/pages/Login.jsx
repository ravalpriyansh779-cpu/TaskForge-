import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@taskforge.dev' },
  { role: 'Operator', email: 'operator@taskforge.dev' },
  { role: 'Viewer', email: 'viewer@taskforge.dev' },
];

export default function Login() {
  const [email, setEmail] = useState('admin@taskforge.dev');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h1>TaskForge</h1>
        <p className="muted">Secure team dashboard with an AI assistant</p>

        {error && <div className="alert">{error}</div>}

        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label>
          Password
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </label>

        <button type="submit" disabled={busy}>
          {busy ? 'Signing in...' : 'Sign in'}
        </button>

        <div className="demo-accounts">
          <p className="muted">Demo accounts (password: password123)</p>
          <ul>
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.email}>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setEmail(a.email);
                    setPassword('password123');
                  }}
                >
                  {a.role} — {a.email}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </form>
    </div>
  );
}
