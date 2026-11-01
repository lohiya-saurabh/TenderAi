import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button as UiButton } from '@/components/ui/button.js';
import { cn } from '@/lib/utils.js';

/**
 * Compatibility wrapper: keeps the older props (variant names, isLoading, icon) but renders the
 * one shared Button from components/ui, so every button in the app looks the same.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost' | 'success' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const VARIANT = {
  primary: { variant: 'default' as const, extra: '' },
  secondary: { variant: 'secondary' as const, extra: '' },
  danger: { variant: 'destructive' as const, extra: '' },
  outline: { variant: 'outline' as const, extra: '' },
  ghost: { variant: 'ghost' as const, extra: '' },
  warning: {
    variant: 'outline' as const,
    extra: 'border-warning/40 text-warning hover:bg-warning/10',
  },
  success: {
    variant: 'outline' as const,
    extra: 'border-success/40 text-success hover:bg-success/10',
  },
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      icon,
      fullWidth,
      className,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const v = VARIANT[variant];
    return (
      <UiButton
        ref={ref}
        variant={v.variant}
        size={size === 'md' ? 'default' : size}
        disabled={disabled || isLoading}
        className={cn('gap-1.5', v.extra, fullWidth && 'w-full', className)}
        {...props}
      >
        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
        {children}
      </UiButton>
    );
  },
);
Button.displayName = 'Button';
