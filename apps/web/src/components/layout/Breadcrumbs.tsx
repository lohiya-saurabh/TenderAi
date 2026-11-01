import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useBidBreadcrumbTitle } from '@/components/layout/BreadcrumbTitle.js';

interface BreadcrumbSegment {
  label: string;
  to?: string;
}

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const path = location.pathname;
  const bidTitle = useBidBreadcrumbTitle(path.match(/^\/bids\/([^/]+)/)?.[1] ?? '');

  const getBreadcrumbs = (): BreadcrumbSegment[] => {
    if (path === '/bids/new') {
      return [{ label: 'Bids', to: '/bids' }, { label: 'New bid' }];
    }

    // Bid detail and sub-routes and sub-routes: /bids/:id/...
    const bidMatch = path.match(/^\/bids\/([^/]+)(.*)$/);
    if (bidMatch && bidMatch[1]) {
      const bidId = bidMatch[1];
      const rest = bidMatch[2] || '';

      const baseSegments: BreadcrumbSegment[] = [
        { label: 'Bids', to: '/bids' },
        {
          label: bidTitle ?? 'Bid',
          to: rest ? `/bids/${bidId}` : undefined,
        },
      ];

      if (rest.startsWith('/clauses')) {
        baseSegments.push({ label: 'Clause workspace' });
      } else if (rest === '/conflicts') {
        baseSegments.push({ label: 'Clause workspace', to: `/bids/${bidId}/clauses` });
        baseSegments.push({ label: 'Conflicts' });
      } else if (rest === '/checklist') {
        baseSegments.push({ label: 'Documents checklist' });
      } else if (rest === '/audit') {
        baseSegments.push({ label: 'Audit trail' });
      }

      return baseSegments;
    }

    return [];
  };

  const breadcrumbs = getBreadcrumbs();
  // A single crumb only repeats the page title.
  if (breadcrumbs.length < 2) return null;

  return (
    <nav aria-label="Breadcrumbs" className="flex items-center">
      <ol className="flex flex-wrap items-center gap-1.5 list-none p-0 m-0 text-sm text-muted-foreground">
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;

          return (
            <li key={idx} className="inline-flex items-center gap-1.5">
              {idx > 0 && <span aria-hidden="true">/</span>}
              {isLast || !crumb.to ? (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={isLast ? 'text-foreground' : 'text-muted-foreground'}
                >
                  {crumb.label}
                </span>
              ) : (
                <Link to={crumb.to} className="text-primary hover:underline">
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
