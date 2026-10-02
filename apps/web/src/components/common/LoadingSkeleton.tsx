import React from 'react';

export interface LoadingSkeletonProps {
  height?: string;
  width?: string;
  borderRadius?: string;
  style?: React.CSSProperties;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  height = '1rem',
  width = '100%',
  borderRadius = 'var(--radius-sm)',
  style,
}) => {
  return (
    <div
      className="skeleton"
      style={{
        height,
        width,
        borderRadius,
        ...style,
      }}
    />
  );
};
