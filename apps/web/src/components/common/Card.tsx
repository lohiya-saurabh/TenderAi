import React from 'react';
import { cn } from '@/lib/utils.js';

/** Card with the older props (variant, padding, header action), drawn from the design tokens. */
export type CardVariant = 'default' | 'interactive' | 'bordered' | 'flat' | 'subtle';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const VARIANT: Record<CardVariant, string> = {
  default: 'bg-card shadow-sm',
  interactive: 'bg-card shadow-sm cursor-pointer transition-colors hover:border-primary/40',
  bordered: 'bg-card',
  flat: 'bg-card border-transparent',
  subtle: 'bg-muted/40',
};

const PADDING = { none: '', sm: 'p-3', md: 'p-5', lg: 'p-6 sm:p-8' };

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  className,
  ...props
}) => (
  <div
    className={cn(
      'rounded-xl border border-border text-card-foreground',
      VARIANT[variant],
      PADDING[padding],
      className,
    )}
    {...props}
  />
);

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  action?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  children,
  action,
  className,
  ...props
}) => (
  <div className={cn('mb-3 flex items-start justify-between gap-3', className)} {...props}>
    <div className="flex flex-1 flex-col gap-1">{children}</div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h2' | 'h3' | 'h4' | 'h5';
}

export const CardTitle: React.FC<CardTitleProps> = ({
  as: Component = 'h3',
  className,
  ...props
}) => (
  <Component
    className={cn('text-base font-semibold leading-tight tracking-tight', className)}
    {...props}
  />
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className,
  ...props
}) => <p className={cn('text-sm text-muted-foreground', className)} {...props} />;

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => <div className={className} {...props} />;

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={cn(
      'mt-4 flex items-center justify-end gap-2 border-t border-border pt-4',
      className,
    )}
    {...props}
  />
);
