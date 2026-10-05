import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../utils/permissions.js';
import {
  TendersIcon,
  PlusCircleIcon,
  BuildingOfficeIcon,
  CloseIcon,
  ShieldLockIcon,
} from '../common/Icons.js';

export interface SidebarProps {
  isCollapsed?: boolean;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed = false,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { hasPermission } = useAuth();

  // Escape key handler for mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen && onCloseMobile) {
        onCloseMobile();
      }
    };
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileOpen, onCloseMobile]);

  // Strictly supported product routes
  const navItems = [
    {
      to: '/bids',
      label: 'Tender Bids',
      icon: TendersIcon,
      permission: PERMISSIONS.BIDS_READ,
    },
    {
      to: '/bids/new',
      label: 'New Bid Project',
      icon: PlusCircleIcon,
      permission: PERMISSIONS.BIDS_CREATE,
    },
    {
      to: '/company-profile',
      label: 'Company Profile',
      icon: BuildingOfficeIcon,
      permission: PERMISSIONS.BIDS_READ,
    },
  ];

  const sidebarContent = (
    <aside
      className={`app-sidebar ${isCollapsed ? 'sidebar-collapsed' : ''}`}
      style={{
        width: isCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
        backgroundColor: 'var(--color-surface-card)',
        borderRight: '1px solid var(--color-surface-border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '100vh',
        transition: 'width var(--transition-base)',
        flexShrink: 0,
        boxSizing: 'border-box',
      }}
    >
      {/* Brand header */}
      <div
        style={{
          height: 'var(--header-height)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          padding: isCollapsed ? '0' : '0 1.25rem',
          borderBottom: '1px solid var(--color-surface-border)',
          gap: '0.75rem',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-primary-600)',
              border: '1px solid var(--color-primary-500)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.9rem',
              letterSpacing: '0.04em',
              flexShrink: 0,
            }}
          >
            TP
          </div>

          {!isCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: 700,
                  color: 'var(--color-surface-text)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  lineHeight: 1.2,
                }}
              >
                TenderPulse
              </span>
              <span
                style={{
                  fontSize: 'var(--text-2xs)',
                  color: 'var(--color-primary-300)',
                  fontWeight: 500,
                  letterSpacing: '0.02em',
                  lineHeight: 1.2,
                }}
              >
                Intelligence & Readiness
              </span>
            </div>
          )}
        </div>

        {/* Mobile close button */}
        {onCloseMobile && (
          <button
            type="button"
            className="mobile-close-btn"
            onClick={onCloseMobile}
            aria-label="Close navigation"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-surface-muted)',
              cursor: 'pointer',
              padding: '0.35rem',
              display: 'none', // Controlled via CSS media query
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CloseIcon size={18} />
          </button>
        )}
      </div>

      {/* Navigation items list */}
      <nav
        aria-label="Main Navigation"
        style={{
          padding: isCollapsed ? '1rem 0.4rem' : '1.25rem 0.65rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
          flex: 1,
        }}
      >
        {!isCollapsed && (
          <div
            style={{
              padding: '0 0.75rem 0.5rem',
              fontSize: 'var(--text-2xs)',
              fontWeight: 600,
              color: 'var(--color-surface-subtle)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Platform
          </div>
        )}

        {navItems
          .filter((item) => !item.permission || hasPermission(item.permission))
          .map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/bids'}
                onClick={onCloseMobile}
                title={isCollapsed ? item.label : undefined}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  gap: '0.75rem',
                  padding: isCollapsed ? '0.65rem 0' : '0.55rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  color: isActive ? 'var(--color-surface-text)' : 'var(--color-surface-muted)',
                  backgroundColor: isActive ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                  borderLeft: isActive
                    ? '3px solid var(--color-primary-500)'
                    : '3px solid transparent',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: 'var(--text-sm)',
                  transition: 'all var(--transition-fast)',
                  textDecoration: 'none',
                })}
              >
                {({ isActive }) => (
                  <>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isActive ? 'var(--color-primary-400)' : 'var(--color-surface-muted)',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={18} />
                    </span>
                    {!isCollapsed && <span>{item.label}</span>}
                  </>
                )}
              </NavLink>
            );
          })}
      </nav>

      {/* Footer / System Status */}
      <div
        style={{
          padding: isCollapsed ? '0.75rem 0.25rem' : '0.85rem 1rem',
          borderTop: '1px solid var(--color-surface-border)',
          backgroundColor: 'var(--color-surface-card-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
        }}
      >
        {!isCollapsed ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-status-pass-text)',
                  display: 'inline-block',
                }}
                aria-hidden="true"
              />
              <span
                style={{
                  fontSize: 'var(--text-2xs)',
                  fontWeight: 600,
                  color: 'var(--color-surface-text)',
                  letterSpacing: '0.02em',
                }}
              >
                Production v2.0
              </span>
            </div>
            <div
              style={{
                fontSize: '0.65rem',
                color: 'var(--color-surface-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <ShieldLockIcon size={11} color="var(--color-surface-subtle)" />
              <span>Multi-Tenant RBAC Active</span>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-status-pass-text)',
              }}
              title="System Online: v2.0"
            />
          </div>
        )}
      </div>
    </aside>
  );

  // If mobile and drawer is open, render with backdrop overlay
  if (isMobileOpen) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation drawer"
        className="mobile-sidebar-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 'var(--z-index-drawer)' as unknown as number,
          display: 'flex',
        }}
        onClick={onCloseMobile}
      >
        <div
          className="slide-in-right"
          style={{ width: '280px', height: '100%', backgroundColor: 'var(--color-surface-card)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {sidebarContent}
        </div>
      </div>
    );
  }

  // Normal desktop sidebar
  return sidebarContent;
};
