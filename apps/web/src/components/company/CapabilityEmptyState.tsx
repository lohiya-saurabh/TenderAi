import React from 'react';
import { Card } from '@/components/common/Card.js';
import { Button } from '@/components/common/Button.js';
import { Upload, Plus, LucideIcon } from 'lucide-react';

export interface CapabilityEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: 'upload' | 'plus';
}

export const CapabilityEmptyState: React.FC<CapabilityEmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon = 'upload',
}) => {
  return (
    <Card padding="lg">
      <div className="flex flex-col items-center justify-center text-center p-8 gap-3">
        <Icon size={36} className="text-muted-foreground/60" />
        <div>
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">{description}</p>
        </div>
        {actionLabel && onAction && (
          <Button
            variant="primary"
            size="sm"
            onClick={onAction}
            icon={actionIcon === 'upload' ? <Upload size={13} /> : <Plus size={13} />}
            className="mt-2"
          >
            {actionLabel}
          </Button>
        )}
      </div>
    </Card>
  );
};
