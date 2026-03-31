import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('Paweł Jankowicz');
  const [email, setEmail] = useState('pawel@example.com');
  const [password, setPassword] = useState('Password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await register(name, email, password);
      navigate('/account');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Register failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="section container narrow">
      <form className="card auth-card" onSubmit={submit}>
        <h2>Create account</h2>
        <p className="muted">Quick register flow with JWT login right after signup.</p>
        <input className="input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error ? <p className="error-text">{error}</p> : null}
        <button className="button large full" disabled={loading}>{loading ? 'Creating account...' : 'Register'}</button>
      </form>
    </section>
  );
}
