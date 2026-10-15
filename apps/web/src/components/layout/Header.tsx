import React from 'react';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs.js';
import { UserAccountMenu } from '@/components/layout/UserAccountMenu.js';
import { MenuIcon, SidebarCollapseIcon, SidebarExpandIcon } from '@/components/common/Icons.js';
import { Button } from '@/components/ui/button.js';

import { CompanySelector } from '@/components/layout/CompanySelector.js';
import { NotificationBell } from '@/components/layout/NotificationBell.js';
import { useTheme } from '@/context/ThemeContext.js';
import { Sun, Moon } from 'lucide-react';

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
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 h-16 w-full border-b border-border bg-card/95 backdrop-blur-xs">
      <div className="w-full max-w-7xl mx-auto h-full flex items-center justify-between px-4 sm:px-6 lg:px-8 gap-4">
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

        {/* Right section: Theme Switcher, Company Switcher, Notification Bell & User Account dropdown */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {/* Theme Switcher Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleTheme}
            className="h-8 px-2.5 text-xs font-semibold gap-1.5 border-border hover:bg-accent cursor-pointer transition-colors shadow-2xs"
            aria-label={`Current theme: ${theme === 'dark' ? 'Dark' : 'Light'}. Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Current theme: ${theme === 'dark' ? 'Dark' : 'Light'}. Click to switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? (
              <Moon className="h-3.5 w-3.5 text-orange-400" />
            ) : (
              <Sun className="h-3.5 w-3.5 text-amber-500" />
            )}
            <span className="hidden sm:inline text-xs font-mono font-medium text-foreground">
              {theme === 'dark' ? 'Dark' : 'Light'}
            </span>
          </Button>

          {/* Company Selector (1 Tenant -> N Companies) */}
          <CompanySelector />

          {/* Real-Time Notifications Bell */}
          <NotificationBell />

          {/* User Account Menu */}
          <UserAccountMenu />
        </div>
      </div>
    </header>
  );
};
