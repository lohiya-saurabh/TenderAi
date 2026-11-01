import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils.js';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const overlayClass =
  'fixed inset-0 z-50 bg-black/70 data-[state=open]:animate-in data-[state=open]:fade-in-0';

/** Shared dialog frame: header, scrolling body, optional footer. Focus trap, Escape and scroll lock come from Radix. */
export const DialogFrame: React.FC<
  Omit<ModalProps, 'isOpen'> & { className: string; bodyClassName?: string }
> = ({ onClose, title, description, children, footer, className, bodyClassName }) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className={overlayClass} />
    <DialogPrimitive.Content
      className={cn(
        'fixed z-50 flex flex-col overflow-hidden border border-border bg-card text-card-foreground shadow-xl',
        className,
      )}
      {...(description ? {} : { 'aria-describedby': undefined })}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
        <div className="min-w-0">
          <DialogPrimitive.Title className="text-base font-semibold leading-tight text-foreground">
            {title}
          </DialogPrimitive.Title>
          {description && (
            <DialogPrimitive.Description className="mt-1 break-words text-xs text-muted-foreground">
              {description}
            </DialogPrimitive.Description>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="inline-flex shrink-0 items-center justify-center rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className={cn('flex-1 overflow-y-auto p-6 text-sm text-foreground', bodyClassName)}>
        {children}
      </div>
      {footer && (
        <div className="flex items-center justify-end gap-3 border-t border-border bg-muted px-6 py-4">
          {footer}
        </div>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
);

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, ...props }) => (
  <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
    <DialogFrame
      onClose={onClose}
      {...props}
      className="left-1/2 top-1/2 max-h-[90vh] w-[calc(100%-2rem)] max-w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
    />
  </DialogPrimitive.Root>
);
