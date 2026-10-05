import React from 'react';
import { useAuth } from '../../auth/useAuth.js';
import { Breadcrumbs } from './Breadcrumbs.js';
import { UserAccountMenu } from './UserAccountMenu.js';
import {
  MenuIcon,
  SidebarCollapseIcon,
  SidebarExpandIcon,
  BuildingOfficeIcon,
} from '../common/Icons.js';

export interface HeaderProps {
  onToggleMobileSidebar?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebarCollapse?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileSidebar,
  isSidebarCollapsed = false,
  onToggleSidebarCollapse,
}) => {
  const { user } = useAuth();

  return (
    <header
      className="app-header"
      style={{
        height: 'var(--header-height)',
        backgroundColor: 'var(--color-surface-card)',
        borderBottom: '1px solid var(--color-surface-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        position: 'sticky',
        top: 0,
        zIndex: 'var(--z-index-sticky)' as unknown as number,
        gap: '1rem',
      }}
    >
      {/* Left section: Navigation toggles & Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
        {/* Mobile Hamburger toggle button */}
        {onToggleMobileSidebar && (
          <button
            type="button"
            className="mobile-nav-toggle"
            onClick={onToggleMobileSidebar}
            aria-label="Open navigation menu"
            style={{
              background: 'transparent',
              border: '1px solid var(--color-surface-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.35rem',
              color: 'var(--color-surface-text)',
              cursor: 'pointer',
              display: 'none', // Controlled via CSS media query
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MenuIcon size={18} />
          </button>
        )}

        {/* Desktop Sidebar Collapse toggle */}
        {onToggleSidebarCollapse && (
          <button
            type="button"
            className="desktop-sidebar-toggle"
            onClick={onToggleSidebarCollapse}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              background: 'transparent',
              border: '1px solid var(--color-surface-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.35rem',
              color: 'var(--color-surface-muted)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-surface-text)';
              e.currentTarget.style.borderColor = 'var(--color-surface-border-light)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-surface-muted)';
              e.currentTarget.style.borderColor = 'var(--color-surface-border)';
            }}
          >
            {isSidebarCollapsed ? (
              <SidebarExpandIcon size={16} />
            ) : (
              <SidebarCollapseIcon size={16} />
            )}
          </button>
        )}

        {/* Dynamic Breadcrumbs */}
        <Breadcrumbs />
      </div>

      {/* Right section: Tenant badge & User Account dropdown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
        {/* Tenant Organization Indicator */}
        <div
          className="tenant-indicator"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.3rem 0.65rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-surface-bg)',
            border: '1px solid var(--color-surface-border)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-surface-muted)',
          }}
        >
          <BuildingOfficeIcon size={14} color="var(--color-primary-400)" />
          <span
            style={{
              color: 'var(--color-surface-text)',
              fontWeight: 500,
              maxWidth: '180px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user?.organizationName || 'Default Organization'}
          </span>
        </div>

        {/* User Account Menu */}
        <UserAccountMenu />
      </div>
    </header>
  );
};
