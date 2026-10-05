import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRightIcon } from '../common/Icons.js';

interface BreadcrumbSegment {
  label: string;
  to?: string;
}

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const path = location.pathname;

  const getBreadcrumbs = (): BreadcrumbSegment[] => {
    // 1. Dashboard / Bids list
    if (path === '/bids' || path === '/') {
      return [{ label: 'Tender Bids' }];
    }

    // 2. New Bid
    if (path === '/bids/new') {
      return [{ label: 'Tender Bids', to: '/bids' }, { label: 'New Bid Project' }];
    }

    // 3. Company Profile
    if (path === '/company-profile') {
      return [{ label: 'Company Profile' }];
    }

    // 4. Bid detail and sub-routes: /bids/:id/...
    const bidMatch = path.match(/^\/bids\/([^/]+)(.*)$/);
    if (bidMatch && bidMatch[1]) {
      const bidId = bidMatch[1];
      const rest = bidMatch[2] || '';

      const baseSegments: BreadcrumbSegment[] = [
        { label: 'Tender Bids', to: '/bids' },
        {
          label: bidId.length > 12 ? `${bidId.slice(0, 10)}...` : bidId,
          to: rest ? `/bids/${bidId}` : undefined,
        },
      ];

      if (rest.startsWith('/compliance/')) {
        baseSegments.push({ label: 'Compliance Verification' });
      } else if (rest === '/audit') {
        baseSegments.push({ label: 'Audit Trail' });
      }

      return baseSegments;
    }

    return [{ label: 'TenderPulse AI' }];
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <nav aria-label="Breadcrumbs" style={{ display: 'flex', alignItems: 'center' }}>
      <ol
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          listStyle: 'none',
          padding: 0,
          margin: 0,
          fontSize: 'var(--text-xs)',
          lineHeight: 1,
        }}
      >
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;

          return (
            <li
              key={idx}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              {idx > 0 && (
                <span
                  style={{
                    color: 'var(--color-surface-subtle)',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                  aria-hidden="true"
                >
                  <ChevronRightIcon size={12} />
                </span>
              )}
              {isLast || !crumb.to ? (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  style={{
                    color: isLast ? 'var(--color-surface-text)' : 'var(--color-surface-muted)',
                    fontWeight: isLast ? 600 : 500,
                  }}
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.to}
                  style={{
                    color: 'var(--color-surface-muted)',
                    transition: 'color var(--transition-fast)',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary-400)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-surface-muted)')}
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
