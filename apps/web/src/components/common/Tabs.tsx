import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  badge?: string | number;
  badgeVariant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'line' | 'pills';
  size?: 'sm' | 'md';
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = 'line',
  size = 'md',
  ariaLabel = 'Navigation Tabs',
  className = '',
  style,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    const enabledTabs = tabs.filter((t) => !t.disabled);
    const currentTab = tabs[index];
    if (!currentTab) return;
    const currentIndex = enabledTabs.findIndex((t) => t.id === currentTab.id);

    let nextIndex = -1;
    if (e.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % enabledTabs.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + enabledTabs.length) % enabledTabs.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = enabledTabs.length - 1;
    }

    const targetTab = enabledTabs[nextIndex];
    if (targetTab) {
      e.preventDefault();
      onChange(targetTab.id);
    }
  };

  const isLine = variant === 'line';

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`tabs-nav tabs-${variant} ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: isLine ? 'var(--space-2)' : 'var(--space-1-5)',
        borderBottom: isLine ? '1px solid var(--color-surface-border)' : 'none',
        padding: isLine ? '0' : '0.25rem',
        backgroundColor: isLine ? 'transparent' : 'var(--color-surface-card-subtle)',
        borderRadius: isLine ? '0' : 'var(--radius-md)',
        overflowX: 'auto',
        ...style,
      }}
    >
      {tabs.map((tab, idx) => {
        const isActive = tab.id === activeTab;
        const isDisabled = tab.disabled;

        const getTabStyles = (): React.CSSProperties => {
          if (isLine) {
            return {
              backgroundColor: 'transparent',
              color: isActive ? 'var(--color-primary-400)' : 'var(--color-surface-muted)',
              borderBottom: isActive ? '2px solid var(--color-primary-500)' : '2px solid transparent',
              marginBottom: '-1px',
              borderRadius: '0',
              padding: size === 'sm' ? '0.4rem 0.75rem' : '0.65rem 1rem',
              fontWeight: isActive ? 600 : 500,
            };
          } else {
            return {
              backgroundColor: isActive ? 'var(--color-surface-card)' : 'transparent',
              color: isActive ? 'var(--color-surface-text)' : 'var(--color-surface-muted)',
              borderRadius: 'var(--radius-sm)',
              padding: size === 'sm' ? '0.3rem 0.65rem' : '0.45rem 0.85rem',
              fontWeight: isActive ? 600 : 500,
              boxShadow: isActive ? 'var(--shadow-xs)' : 'none',
              border: isActive ? '1px solid var(--color-surface-border)' : '1px solid transparent',
            };
          }
        };

        return (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-controls={`tabpanel-${tab.id}`}
            aria-selected={isActive}
            disabled={isDisabled}
            tabIndex={isActive ? 0 : -1}
            onClick={() => !isDisabled && onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: size === 'sm' ? 'var(--text-xs)' : 'var(--text-sm)',
              fontFamily: 'inherit',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              opacity: isDisabled ? 0.4 : 1,
              outline: 'none',
              transition: 'all var(--transition-fast)',
              whiteSpace: 'nowrap',
              ...getTabStyles(),
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                style={{
                  fontSize: 'var(--text-2xs)',
                  fontWeight: 600,
                  padding: '0.1rem 0.4rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor:
                    tab.badgeVariant === 'danger'
                      ? 'var(--color-danger-bg)'
                      : tab.badgeVariant === 'warning'
                        ? 'var(--color-warning-bg)'
                        : tab.badgeVariant === 'success'
                          ? 'var(--color-success-bg)'
                          : 'rgba(255, 255, 255, 0.1)',
                  color:
                    tab.badgeVariant === 'danger'
                      ? 'var(--color-danger)'
                      : tab.badgeVariant === 'warning'
                        ? 'var(--color-warning)'
                        : tab.badgeVariant === 'success'
                          ? 'var(--color-success)'
                          : 'inherit',
                  border:
                    tab.badgeVariant === 'danger'
                      ? '1px solid var(--color-danger-border)'
                      : tab.badgeVariant === 'warning'
                        ? '1px solid var(--color-warning-border)'
                        : '1px solid rgba(255, 255, 255, 0.15)',
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  tabId: string;
  activeTab: string;
}

export const TabPanel: React.FC<TabPanelProps> = ({
  tabId,
  activeTab,
  children,
  className = '',
  style,
  ...props
}) => {
  if (tabId !== activeTab) return null;

  return (
    <div
      role="tabpanel"
      id={`tabpanel-${tabId}`}
      aria-labelledby={`tab-${tabId}`}
      className={`tab-panel fade-in ${className}`}
      style={{
        paddingTop: 'var(--space-4)',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
