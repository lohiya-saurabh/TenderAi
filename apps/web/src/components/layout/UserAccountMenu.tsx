import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth.js';
import { LogOut, User, Settings } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu.js';
import { Avatar, AvatarFallback } from '../ui/avatar.js';
import { Badge } from '../ui/badge.js';
import { Button } from '../ui/button.js';

export const UserAccountMenu: React.FC = () => {
  const { user, logout } = useAuth();

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2 px-2 border-border/60 hover:bg-accent hover:text-accent-foreground transition-colors"
          aria-label="User account menu"
        >
          <Avatar className="h-5 w-5 rounded-full border border-border/50">
            <AvatarFallback className="text-[10px] font-bold bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:flex flex-col text-left text-xs leading-none">
            <span className="font-medium text-foreground truncate max-w-[120px]">
              {user?.name || user?.email || 'Authenticated User'}
            </span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end" forceMount>
        <DropdownMenuLabel className="font-normal p-3">
          <div className="flex flex-col space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground leading-none">
                {user?.name || 'Account'}
              </p>
              <Badge
                variant="secondary"
                className="text-[10px] font-medium uppercase px-1.5 py-0.5"
              >
                {user?.role?.replace(/_/g, ' ') || 'User'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-3 py-2 bg-muted/40 text-xs">
          <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-0.5">
            Organization Tenant
          </p>
          <p className="font-medium text-foreground truncate">
            {user?.organizationName || 'Default Organization'}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
            ID: {user?.organizationId || '—'}
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/profile" className="flex items-center w-full">
            <User className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>User Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/settings" className="flex items-center w-full">
            <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Workspace Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => logout()}
          className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
