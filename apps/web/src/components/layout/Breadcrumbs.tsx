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
    // 1. Dashboard / Bids list
    if (path === '/bids' || path === '/') {
      return [{ label: 'Bids' }];
    }

    // 2. New Bid
    if (path === '/bids/new') {
      return [{ label: 'Bids', to: '/bids' }, { label: 'New bid' }];
    }

    // 3. Company Profile
    if (path === '/company-profile') {
      return [{ label: 'Company profile' }];
    }

    // 4. User Profile
    if (path === '/profile') {
      return [{ label: 'Your profile' }];
    }

    // 5. Settings
    if (path === '/settings') {
      return [{ label: 'Settings' }];
    }

    // 6. Bid detail and sub-routes: /bids/:id/...
    const bidMatch = path.match(/^\/bids\/([^/]+)(.*)$/);
    if (bidMatch && bidMatch[1]) {
      const bidId = bidMatch[1];
      const rest = bidMatch[2] || '';

      const formatBidBreadcrumb = (id: string): string => {
        if (id.includes('nhai_ham')) return 'NHAI HAM 4-Lane';
        if (id.includes('nhai_greenfield')) return 'NHAI Greenfield Exp';
        if (id.includes('ncrtc_metro')) return 'NCRTC Metro Viaduct';
        if (id.includes('rvnl_rail')) return 'RVNL Rail Bridge';
        if (id.includes('msrdc_cable')) return 'MSRDC Cable Bridge';
        if (id.includes('morth_mountain')) return 'MoRTH Mountain Hwy';
        if (id.includes('cpwd_logistics')) return 'CPWD Logistics Hub';
        if (id.includes('nhai_atms')) return 'NHAI ATMS Tolling';
        if (id.includes('state_highway')) return 'State Hwy Rehab';
        if (id.includes('nhai_outer_ring')) return 'NHAI Outer Ring Exp';

        const clean = id.replace(/^bid_/, '').replace(/[_-]/g, ' ');
        return clean.length > 22 ? `${clean.slice(0, 20)}...` : clean;
      };

      const baseSegments: BreadcrumbSegment[] = [
        { label: 'Bids', to: '/bids' },
        {
          label: bidTitle ?? formatBidBreadcrumb(bidId),
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

    return [{ label: 'TenderPulse AI' }];
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <nav aria-label="Breadcrumbs" className="flex items-center">
      <ol className="flex flex-wrap items-center gap-1.5 list-none p-0 m-0 text-[13px] text-muted-foreground">
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
