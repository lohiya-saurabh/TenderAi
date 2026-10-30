import React from 'react';

export interface ProgressBarProps {
  progress: number;
  color?: string;
  height?: string;
  showLabel?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color = 'hsl(var(--primary))',
  height = '8px',
  showLabel = false,
}) => {
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div style={{ width: '100%' }}>
      {showLabel && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            fontSize: 'var(--text-xs)',
            color: 'hsl(var(--muted-foreground))',
            marginBottom: '0.25rem',
          }}
        >
          {clamped}%
        </div>
      )}
      <div
        style={{
          height,
          backgroundColor: 'hsl(var(--input))',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
          border: '1px solid hsl(var(--border))',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${clamped}%`,
            backgroundColor: color,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </div>
  );
};
