import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../utils/permissions.js';

export const Sidebar: React.FC = () => {
  const { hasPermission } = useAuth();

  const navItems = [
    {
      to: '/bids',
      label: 'Tender Bids',
      icon: '📋',
      permission: PERMISSIONS.BIDS_READ,
    },
    {
      to: '/bids/new',
      label: 'New Bid Project',
      icon: '➕',
      permission: PERMISSIONS.BIDS_CREATE,
    },
  ];

  return (
    <aside
      style={{
        width: 'var(--sidebar-width)',
        backgroundColor: 'var(--color-surface-card)',
        borderRight: '1px solid var(--color-surface-border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Brand header */}
      <div
        style={{
          height: 'var(--header-height)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 1.5rem',
          borderBottom: '1px solid var(--color-surface-border)',
          gap: '0.75rem',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-primary-600)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '1rem',
          }}
        >
          TP
        </div>
        <div>
          <h1 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-surface-text)' }}>
            TenderPulse AI
          </h1>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-surface-muted)' }}>
            Enterprise B2B SaaS
          </span>
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ padding: '1.25rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
        <div style={{ padding: '0 0.75rem 0.5rem', fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-surface-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Navigation
        </div>
        {navItems
          .filter((item) => !item.permission || hasPermission(item.permission))
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/bids'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                color: isActive ? 'var(--color-surface-text)' : 'var(--color-surface-muted)',
                backgroundColor: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.9rem',
                transition: 'all var(--transition-fast)',
              })}
            >
              <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
      </nav>

      {/* Footer / version info */}
      <div
        style={{
          padding: '1rem 1.25rem',
          borderTop: '1px solid var(--color-surface-border)',
          fontSize: '0.75rem',
          color: 'var(--color-surface-subtle)',
        }}
      >
        <span>v1.0.0 • Production Ready</span>
      </div>
    </aside>
  );
};
