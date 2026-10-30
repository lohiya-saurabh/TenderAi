import React from 'react';
import { cn } from '@/lib/utils.js';

/** The one status chip in the app. Tones come from the design tokens; a chip always carries text. */
export type BadgeVariant =
  'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  dot?: boolean;
}

export const BADGE_TONE: Record<BadgeVariant, string> = {
  primary: 'bg-primary/10 text-primary border-primary/20',
  secondary: 'bg-secondary text-secondary-foreground border-border',
  success: 'bg-success/10 text-success border-success/25',
  warning: 'bg-warning/10 text-warning border-warning/25',
  danger: 'bg-destructive/10 text-destructive border-destructive/25',
  info: 'bg-primary/5 text-foreground border-border',
  neutral: 'bg-muted text-muted-foreground border-border',
};

const SIZE = {
  sm: 'px-1.5 py-0.5 text-2xs gap-1',
  md: 'px-2 py-0.5 text-xs gap-1.5',
  lg: 'px-3 py-1 text-sm gap-1.5',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  icon,
  dot = false,
  className,
  ...props
}) => (
  <span
    className={cn(
      'inline-flex select-none items-center whitespace-nowrap rounded-full border font-semibold leading-tight',
      BADGE_TONE[variant],
      SIZE[size],
      className,
    )}
    {...props}
  >
    {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />}
    {icon}
    <span>{children}</span>
  </span>
);
