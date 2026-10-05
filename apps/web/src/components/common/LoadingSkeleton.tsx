import React from 'react';

export interface LoadingSkeletonProps {
  height?: string;
  width?: string;
  borderRadius?: string;
  variant?: 'text' | 'rect' | 'circle';
  count?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  height = '1rem',
  width = '100%',
  borderRadius,
  variant = 'text',
  count = 1,
  className = '',
  style,
}) => {
  const getRadius = () => {
    if (borderRadius) return borderRadius;
    if (variant === 'circle') return 'var(--radius-full)';
    if (variant === 'rect') return 'var(--radius-md)';
    return 'var(--radius-sm)';
  };

  const getDimensions = () => {
    if (variant === 'circle') {
      const size = height || width || '2.5rem';
      return { width: size, height: size };
    }
    return { width, height };
  };

  const dims = getDimensions();

  if (count > 1) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={`skeleton ${className}`}
            style={{
              height: dims.height,
              width: i === count - 1 && variant === 'text' ? '70%' : dims.width,
              borderRadius: getRadius(),
              ...style,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`skeleton ${className}`}
      style={{
        height: dims.height,
        width: dims.width,
        borderRadius: getRadius(),
        ...style,
      }}
    />
  );
};
