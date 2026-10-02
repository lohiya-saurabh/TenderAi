import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.js';
import { Button } from '../components/common/Button.js';
import { Input } from '../components/common/Input.js';
import { ErrorBanner } from '../components/common/ErrorBanner.js';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState<string>('bidmanager@acme.com');
  const [password, setPassword] = useState<string>('Password123!');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/bids';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const res = await login(email, password);
    setIsSubmitting(false);

    if (res.success) {
      navigate(from, { replace: true });
    } else {
      setError(res.error || 'Invalid credentials');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        backgroundColor: 'var(--color-surface-bg)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'var(--color-surface-card)',
          border: '1px solid var(--color-surface-border)',
          borderRadius: 'var(--radius-xl)',
          padding: '2.5rem',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--color-primary-600)',
              color: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '1.35rem',
              marginBottom: '1rem',
            }}
          >
            TP
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-surface-text)' }}>
            TenderPulse AI
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-surface-muted)', marginTop: '0.25rem' }}>
            Enterprise Tender Intelligence & Compliance
          </p>
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Input
            label="Email Address"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
          />

          <Input
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting} style={{ marginTop: '0.5rem' }}>
            Sign In to Workspace
          </Button>
        </form>

        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-surface-border)', textAlign: 'center' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-surface-subtle)' }}>
            Protected by Tenant Isolation & Multi-Factor Security
          </p>
        </div>
      </div>
    </div>
  );
};
