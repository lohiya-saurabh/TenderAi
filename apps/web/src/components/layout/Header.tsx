import React from 'react';
import { NavLink } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import { useAuth } from '@/auth/useAuth.js';
import { PERMISSIONS } from '@/utils/permissions.js';
import { cn } from '@/lib/utils.js';
import { UserAccountMenu } from '@/components/layout/UserAccountMenu.js';
import { CompanySelector } from '@/components/layout/CompanySelector.js';
import { NotificationBell } from '@/components/layout/NotificationBell.js';
import { useTheme } from '@/context/useTheme.js';

const NAV_ITEMS = [
  { to: '/bids', label: 'Bids', permission: PERMISSIONS.BIDS_READ, end: false },
  {
    to: '/company-profile',
    label: 'Company profile',
    permission: PERMISSIONS.BIDS_READ,
    end: true,
  },
  { to: '/settings', label: 'Settings', permission: PERMISSIONS.BIDS_READ, end: true },
];

/**
 * Top application bar: brand, primary navigation and account controls on one
 * dark 52px strip. The `dark` class scopes the theme tokens, so the company
 * selector, notifications and account menu render as dark-on-dark controls
 * whichever theme the page itself uses.
 */
export const Header: React.FC = () => {
  const { hasPermission } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <header className="dark sticky top-0 z-40 w-full bg-[#16191F] text-white">
      <div className="min-h-[52px] px-4 sm:px-6 flex flex-wrap items-center gap-x-5 gap-y-1 py-1.5">
        <NavLink
          to="/bids"
          className="font-bold text-[15px] tracking-[-0.01em] text-white no-underline"
        >
          TenderPulse
        </NavLink>

        <nav aria-label="Main" className="flex items-center gap-4 text-[13px]">
          {NAV_ITEMS.filter((item) => hasPermission(item.permission)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'no-underline py-1 transition-colors',
                  isActive ? 'text-white font-semibold' : 'text-[#C9D0DA] hover:text-white',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#C9D0DA] hover:text-white hover:bg-white/10"
            aria-label={`Switch to ${nextTheme} theme`}
            title={`Switch to ${nextTheme} theme`}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <CompanySelector />
          <NotificationBell />
          <UserAccountMenu />
        </div>
      </div>
    </header>
  );
};
