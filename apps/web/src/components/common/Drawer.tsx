import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { DialogFrame, type ModalProps } from '@/components/common/Modal.js';
import { cn } from '@/lib/utils.js';

export interface DrawerProps extends ModalProps {
  /** Tailwind max-width class for the panel. */
  widthClassName?: string;
}

/** Right-hand side panel on the same frame as Modal. */
export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  widthClassName = 'max-w-[30rem]',
  ...props
}) => (
  <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
    <DialogFrame
      onClose={onClose}
      {...props}
      className={cn(
        'inset-y-0 right-0 h-full w-full border-y-0 border-r-0 data-[state=open]:animate-in data-[state=open]:slide-in-from-right',
        widthClassName,
      )}
    />
  </DialogPrimitive.Root>
);
