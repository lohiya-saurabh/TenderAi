import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../common/Card.js';
import { BuildingOfficeIcon, InfoIcon } from '../common/Icons.js';

/**
 * Company Readiness — honest "data not yet available" state.
 *
 * The Company Capability Profile (registrations, certifications,
 * financials, expiring certificates) has NO backend endpoint yet.
 * This card deliberately renders no numbers rather than fabricating
 * them from a hardcoded static profile. The missing APIs are
 * documented here and in MissingApiCallout.
 */
export const CompanyReadinessCard: React.FC = () => {
  return (
    <Card variant="default" padding="md">
      <CardHeader>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BuildingOfficeIcon size={16} color="var(--color-primary-400)" />
          <CardTitle as="h3">Company Readiness</CardTitle>
        </div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}>
          Persistent Company Capability Profile evaluated against incoming tender requirements
        </p>
      </CardHeader>

      <CardContent>
        <div
          style={{
            padding: '1.25rem',
            backgroundColor: 'var(--color-surface-card-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--color-surface-border)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
          }}
        >
          <span
            style={{
              color: 'var(--color-primary-400)',
              display: 'inline-flex',
              flexShrink: 0,
              marginTop: '0.1rem',
            }}
          >
            <InfoIcon size={18} />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-surface-text)' }}>
              Capability data not yet available
            </span>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)', lineHeight: 1.5, margin: 0 }}>
              The Company Capability Profile has no backend API yet, so registrations,
              certifications, financials, and certificate expiry cannot be shown without
              fabricating data. This section activates automatically once the profile
              endpoints ship.
            </p>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem',
                marginTop: '0.25rem',
              }}
            >
              <code style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-primary-300)' }}>
                GET /api/v1/company-profile — profile aggregate (registrations, financials, experience)
              </code>
              <code style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-primary-300)' }}>
                GET /api/v1/company-profile/expiring-certificates — 30-day certificate expiry watch
              </code>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
