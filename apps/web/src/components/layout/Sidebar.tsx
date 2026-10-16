import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth.js';
import { PERMISSIONS } from '@/utils/permissions.js';
import {
  TendersIcon,
  PlusCircleIcon,
  BuildingOfficeIcon,
  CloseIcon,
  ShieldLockIcon,
} from '@/components/common/Icons.js';
import { cn } from '@/lib/utils.js';
import { Settings as SettingsIcon } from 'lucide-react';

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
    {
      to: '/settings',
      label: 'Settings',
      icon: SettingsIcon,
      permission: PERMISSIONS.BIDS_READ,
    },
  ];

  const sidebarContent = (
    <aside
      className={cn(
        'flex flex-col h-screen max-h-screen bg-card border-r border-border transition-[width] duration-200 shrink-0 box-border select-none overflow-x-hidden',
        isCollapsed ? 'w-[68px]' : 'w-[260px]',
      )}
    >
      {/* Brand header */}
      <div
        className={cn(
          'h-16 flex items-center border-b border-border gap-3 box-border',
          isCollapsed ? 'justify-center px-0' : 'justify-between px-5',
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded bg-foreground text-background font-bold text-xs flex items-center justify-center tracking-wider shrink-0 shadow-2xs">
            TP
          </div>

          {!isCollapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-bold tracking-tight text-foreground leading-tight truncate">
                TenderPulse<span className="text-vermilion">.ai</span>
              </span>
              <span className="mono text-[10px] px-1.5 py-0.5 border border-border text-muted-foreground rounded bg-muted/40 font-semibold">
                v2.4
              </span>
            </div>
          )}
        </div>

        {onCloseMobile && (
          <button
            type="button"
            className="md:hidden text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-accent"
            onClick={onCloseMobile}
            aria-label="Close navigation"
          >
            <CloseIcon size={18} />
          </button>
        )}
      </div>

      {/* Navigation items list */}
      <nav
        aria-label="Main Navigation"
        className="p-3 flex flex-col gap-1 flex-1 overflow-y-auto overflow-x-hidden no-scrollbar"
      >
        {!isCollapsed && (
          <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
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
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-colors',
                    isCollapsed ? 'justify-center px-0' : 'justify-start',
                    isActive
                      ? 'bg-accent text-accent-foreground font-semibold border border-border shadow-xs'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'shrink-0 flex items-center justify-center',
                        isActive ? 'text-vermilion' : 'text-muted-foreground',
                      )}
                    >
                      <Icon size={16} />
                    </span>
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </>
                )}
              </NavLink>
            );
          })}
      </nav>

      {/* Footer / System Status */}
      <div className="p-3 border-t border-border bg-card/50 flex flex-col gap-1.5">
        {!isCollapsed ? (
          <>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span className="text-[11px] font-semibold text-foreground tracking-wide">
                Production v2.0
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
              <ShieldLockIcon size={11} className="text-muted-foreground" />
              <span>Multi-Tenant RBAC Active</span>
            </div>
          </>
        ) : (
          <div className="flex justify-center">
            <span
              className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"
              title="System Online: v2.0"
            />
          </div>
        )}
      </div>
    </aside>
  );

  if (isMobileOpen) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation drawer"
        className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex md:hidden"
        onClick={onCloseMobile}
      >
        <div className="w-[280px] h-full bg-card" onClick={(e) => e.stopPropagation()}>
          {sidebarContent}
        </div>
      </div>
    );
  }

  return sidebarContent;
};
