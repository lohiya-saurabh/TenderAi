import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import { LogoutIcon, ChevronDownIcon, ShieldLockIcon } from '../common/Icons.js';
import { Badge } from '../common/Badge.js';

export const UserAccountMenu: React.FC = () => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const getInitials = (name?: string, email?: string): string => {
    if (name) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2 && parts[0] && parts[1]) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'TP';
  };

  const initials = getInitials(user?.name, user?.email);

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="User account menu"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          background: isOpen ? 'var(--color-surface-card-hover)' : 'transparent',
          border: '1px solid var(--color-surface-border)',
          borderRadius: 'var(--radius-md)',
          padding: '0.35rem 0.65rem',
          cursor: 'pointer',
          transition: 'all var(--transition-fast)',
          color: 'var(--color-surface-text)',
        }}
      >
        {/* User avatar circle */}
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-primary-700)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'var(--text-xs)',
            fontWeight: 700,
            letterSpacing: '0.02em',
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          {initials}
        </div>

        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--color-surface-text)',
              lineHeight: 1.2,
            }}
          >
            {user?.name || user?.email || 'Authenticated User'}
          </span>
          <span
            style={{
              fontSize: 'var(--text-2xs)',
              color: 'var(--color-surface-muted)',
              lineHeight: 1.2,
            }}
          >
            {user?.role?.replace(/_/g, ' ') || 'User'}
          </span>
        </div>

        <ChevronDownIcon
          size={14}
          color="var(--color-surface-muted)"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform var(--transition-fast)',
          }}
        />
      </button>

      {/* Account Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="scale-in"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: '260px',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-surface-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 'var(--z-index-dropdown)' as unknown as number,
            padding: '0.5rem 0',
            overflow: 'hidden',
          }}
        >
          {/* User profile header */}
          <div
            style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid var(--color-surface-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-surface-text)' }}>
                {user?.name || 'Account'}
              </span>
              <Badge variant="primary" size="sm">
                {user?.role?.replace(/_/g, ' ') || 'User'}
              </Badge>
            </div>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)', wordBreak: 'break-all' }}>
              {user?.email}
            </span>
          </div>

          {/* Tenant / Organization Info */}
          <div
            style={{
              padding: '0.65rem 1rem',
              borderBottom: '1px solid var(--color-surface-border)',
              backgroundColor: 'var(--color-surface-card-subtle)',
              fontSize: 'var(--text-xs)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.2rem',
            }}
          >
            <span style={{ color: 'var(--color-surface-muted)', fontSize: 'var(--text-2xs)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Organization Tenant
            </span>
            <span style={{ fontWeight: 500, color: 'var(--color-surface-text)' }}>
              {user?.organizationName || 'Default Organization'}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)', color: 'var(--color-surface-subtle)' }}>
              ID: {user?.organizationId || 'org_acme_infra_001'}
            </span>
          </div>

          {/* Security status */}
          <div
            style={{
              padding: '0.6rem 1rem',
              borderBottom: '1px solid var(--color-surface-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-surface-muted)',
            }}
          >
            <ShieldLockIcon size={14} color="var(--color-status-pass-text)" />
            <span>HMAC-SHA256 Token Session</span>
          </div>

          {/* Sign Out Action */}
          <div style={{ padding: '0.35rem 0.5rem 0.15rem' }}>
            <button
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.55rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'transparent',
                border: 'none',
                color: 'var(--color-danger)',
                fontSize: 'var(--text-xs)',
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color var(--transition-fast)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-danger-bg)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <LogoutIcon size={15} color="var(--color-danger)" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
