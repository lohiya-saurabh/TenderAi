import React from 'react';
import { useAuth } from '../../auth/useAuth.js';
import { Button } from '../common/Button.js';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header
      style={{
        height: 'var(--header-height)',
        backgroundColor: 'var(--color-surface-card)',
        borderBottom: '1px solid var(--color-surface-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2rem',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Organization / Tenant info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.25rem 0.65rem',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            fontSize: '0.8rem',
            color: 'var(--color-primary-100)',
          }}
        >
          <span>🏢</span>
          <strong style={{ fontWeight: 600 }}>{user?.organizationName || 'Organization'}</strong>
        </div>
      </div>

      {/* User profile & Logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-surface-text)' }}>
            {user?.name || user?.email}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-surface-muted)', textTransform: 'capitalize' }}>
            {user?.role?.toLowerCase() || 'User'}
          </div>
        </div>

        <Button variant="secondary" size="sm" onClick={logout}>
          Sign Out
        </Button>
      </div>
    </header>
  );
};
