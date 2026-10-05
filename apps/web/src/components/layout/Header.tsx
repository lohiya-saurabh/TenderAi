import React from 'react';
import { Breadcrumbs } from './Breadcrumbs.js';
import { UserAccountMenu } from './UserAccountMenu.js';
import {
  MenuIcon,
  SidebarCollapseIcon,
  SidebarExpandIcon,
} from '../common/Icons.js';
import { Button } from '../ui/button.js';

import { CompanySelector } from './CompanySelector.js';
import { NotificationBell } from './NotificationBell.js';

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
  return (
    <header className="sticky top-0 z-40 h-16 w-full border-b border-border bg-card/95 backdrop-blur-xs flex items-center justify-between px-4 md:px-6 gap-4">
      {/* Left section: Navigation toggles & Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile Hamburger toggle button */}
        {onToggleMobileSidebar && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="md:hidden h-8 w-8 text-foreground"
            onClick={onToggleMobileSidebar}
            aria-label="Open navigation menu"
          >
            <MenuIcon size={16} />
          </Button>
        )}

        {/* Desktop Sidebar Collapse toggle */}
        {onToggleSidebarCollapse && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={onToggleSidebarCollapse}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? (
              <SidebarExpandIcon size={16} />
            ) : (
              <SidebarCollapseIcon size={16} />
            )}
          </Button>
        )}

        {/* Dynamic Breadcrumbs */}
        <Breadcrumbs />
      </div>

      {/* Right section: Company Switcher, Notification Bell & User Account dropdown */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {/* Company Selector (1 Tenant -> N Companies) */}
        <CompanySelector />

        {/* Real-Time Notifications Bell */}
        <NotificationBell />

        {/* User Account Menu */}
        <UserAccountMenu />
      </div>
    </header>
  );
};
