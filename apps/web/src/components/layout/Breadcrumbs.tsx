import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

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
    <nav aria-label="Breadcrumbs" className="flex items-center">
      <ol className="flex items-center gap-1.5 list-none p-0 m-0 text-xs leading-none text-muted-foreground">
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;

          return (
            <li key={idx} className="inline-flex items-center gap-1.5">
              {idx > 0 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0" aria-hidden="true" />
              )}
              {isLast || !crumb.to ? (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={isLast ? 'font-semibold text-foreground' : 'text-muted-foreground'}
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.to}
                  className="hover:text-foreground transition-colors font-medium"
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
