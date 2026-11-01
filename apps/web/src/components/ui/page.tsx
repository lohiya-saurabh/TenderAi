import React from 'react';
import { cn } from '@/lib/utils.js';

/** One page frame for every app page: consistent width, spacing and header. */
export const Page: React.FC<{
  children: React.ReactNode;
  /** narrow = forms and settings, default = most pages, full = dense workspaces. */
  width?: 'narrow' | 'default' | 'full';
  className?: string;
}> = ({ children, width = 'default', className }) => (
  <div
    className={cn(
      'mx-auto flex w-full flex-col gap-6',
      width === 'narrow' && 'max-w-4xl',
      width === 'default' && 'max-w-7xl',
      className,
    )}
  >
    {children}
  </div>
);

export const PageHeader: React.FC<{
  title: React.ReactNode;
  /** One line under the title saying what the page is for. */
  description?: React.ReactNode;
  /** Small label above the title (e.g. a tender number). */
  eyebrow?: React.ReactNode;
  /** A back link or breadcrumb shown above everything. */
  back?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, description, eyebrow, back, actions }) => (
  <header className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0 space-y-1">
      {back}
      {eyebrow && <div className="text-2xs font-semibold text-muted-foreground">{eyebrow}</div>}
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </header>
);
