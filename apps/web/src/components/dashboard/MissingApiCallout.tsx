import React, { useState } from 'react';
import { Card } from '../ui/card.js';
import { Info, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils.js';

interface EndpointStatus {
  method: string;
  path: string;
  purpose: string;
  status: 'LIVE' | 'ROADMAP';
  notes: string;
}

const ENDPOINTS_STATUS: EndpointStatus[] = [
  {
    method: 'GET',
    path: '/api/v1/dashboard/metrics',
    purpose: 'Pre-aggregated tenant KPIs (active volume, total exposure in INR, urgent deadlines, pipeline breakdown).',
    status: 'LIVE',
    notes: 'Backed by PostgreSQL server-side aggregation for high-volume scalability.',
  },
  {
    method: 'GET',
    path: '/api/v1/company-profile',
    purpose: 'Company Capability Profile aggregate — registrations, certifications, audited financials, past work orders.',
    status: 'LIVE',
    notes: 'Pinned, versioned corporate capability snapshots with deterministic eligibility engine mapping.',
  },
  {
    method: 'GET',
    path: '/api/v1/company-profile/expiring-certificates',
    purpose: 'Certificate and OEM authorization expiry watch (renewals within 30/60/90 days).',
    status: 'LIVE',
    notes: 'Real-time countdown and expiry status monitoring against tender submission windows.',
  },
  {
    method: 'GET',
    path: '/api/v1/bids/:id/deadlines',
    purpose: 'Tender lifecycle milestones (pre-bid, clarification, EMD, online bid freeze).',
    status: 'LIVE',
    notes: 'Deterministic milestone countdown and status computed against tender submission deadlines.',
  },
  {
    method: 'GET',
    path: '/api/v1/bids?page=&limit=&sort=',
    purpose: 'Server-side pagination, sorting, and filtering of the tender list with embedded decision projection.',
    status: 'LIVE',
    notes: 'Server-side offset/limit pagination, keyword search, and embedded latest bid decision projection.',
  },
  {
    method: 'GET',
    path: '/api/v1/tenders/amendments',
    purpose: 'Corrigendum / amendment notification and impact stream with scope and date change tracking.',
    status: 'LIVE',
    notes: 'Tenant-wide stream tracking published corrigenda documents and requirement impacts.',
  },
];

export const MissingApiCallout: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="border-border/60 bg-muted/20 p-4">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className="w-full flex items-center justify-between bg-transparent border-0 cursor-pointer p-0 text-muted-foreground text-xs text-left group"
      >
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-primary shrink-0" />
          <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
            Architecture Note: Live Backend Endpoints &amp; Data Transparency
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-border/60 text-xs text-muted-foreground leading-relaxed">
          <p className="mb-2">
            To adhere strictly to <em className="font-medium text-foreground">zero invented backend data</em>, every metric,
            action item, and deadline on this dashboard is grounded in live PostgreSQL data. Multi-tenant RBAC is strictly
            enforced on all calls.
          </p>
          <div className="font-semibold text-foreground mb-1.5 mt-3">
            Endpoint Inventory &amp; Status ({ENDPOINTS_STATUS.length}):
          </div>
          <ul className="pl-4 flex flex-col gap-2 list-disc">
            {ENDPOINTS_STATUS.map((endpoint) => (
              <li key={endpoint.path}>
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-primary font-mono">
                    {endpoint.method} {endpoint.path}
                  </code>
                  <span
                    className={cn(
                      "px-1.5 py-0.5 text-[10px] font-bold rounded tracking-wider",
                      endpoint.status === 'LIVE'
                        ? "bg-muted text-foreground border border-border"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {endpoint.status}
                  </span>
                </div>
                <span className="block mt-0.5">{endpoint.purpose}</span>
                <span className="block text-muted-foreground/80 text-[11px] mt-0.5">
                  {endpoint.notes}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
};
