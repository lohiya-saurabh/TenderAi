import React from 'react';
import { Card } from '../common/Card.js';
import { Button } from '../common/Button.js';
import { CapabilityStatusBadge } from './CapabilityStatusBadge.js';
import {
  type BaseCapabilityItem,
  getDaysUntilExpiry,
} from './companyProfileData.js';

export interface KeyValueField {
  label: string;
  value: React.ReactNode;
  isMono?: boolean;
  highlight?: boolean;
}

export interface CapabilityItemCardProps {
  item: BaseCapabilityItem;
  typeBadge?: string;
  fields: KeyValueField[];
  expiryDate?: string | null;
  onViewEvidence?: (docName: string) => void;
  onEdit?: () => void;
  children?: React.ReactNode;
}

export const CapabilityItemCard: React.FC<CapabilityItemCardProps> = ({
  item,
  typeBadge,
  fields,
  expiryDate,
  onViewEvidence,
  onEdit,
  children,
}) => {
  const daysRemaining = getDaysUntilExpiry(expiryDate);

  return (
    <Card padding="md" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
            {typeBadge && (
              <span
                style={{
                  fontSize: 'var(--text-2xs)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '0.15rem 0.45rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-surface-bg)',
                  border: '1px solid var(--color-surface-border)',
                  color: 'var(--color-surface-muted)',
                }}
              >
                {typeBadge}
              </span>
            )}
            <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-surface-text)', margin: 0 }}>
              {item.title}
            </h3>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CapabilityStatusBadge status={item.status} size="sm" />
          {onEdit && (
            <Button variant="ghost" size="sm" onClick={onEdit} style={{ fontSize: 'var(--text-2xs)', padding: '0.2rem 0.4rem' }}>
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Structured Key-Value Fields Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.65rem 1rem',
          backgroundColor: 'var(--color-surface-bg)',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-surface-border)',
        }}
      >
        {fields.map((f, idx) => (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)', fontWeight: 500 }}>
              {f.label}
            </span>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: f.highlight ? 700 : 500,
                color: f.highlight ? 'var(--color-primary-300)' : 'var(--color-surface-text)',
                fontFamily: f.isMono ? 'var(--font-mono)' : 'inherit',
                wordBreak: 'break-word',
              }}
            >
              {f.value}
            </span>
          </div>
        ))}

        {expiryDate && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)', fontWeight: 500 }}>
              Validity / Expiry
            </span>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color: daysRemaining !== null && daysRemaining <= 60 ? 'var(--color-warning)' : 'var(--color-surface-text)',
              }}
            >
              {expiryDate}{' '}
              {daysRemaining !== null && (
                <span style={{ fontSize: 'var(--text-2xs)', color: daysRemaining <= 30 ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                  ({daysRemaining > 0 ? `${daysRemaining} days left` : 'Expired'})
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Verification Notes / Alert */}
      {item.verificationNotes && (
        <div
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-warning)',
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.4rem 0.65rem',
          }}
        >
          ⚠️ {item.verificationNotes}
        </div>
      )}

      {/* Linked Evidence Document Footprint */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
          paddingTop: '0.35rem',
        }}
      >
        {item.evidenceDocName ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: 'var(--text-xs)' }}>📄</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}>
              Linked Evidence:{' '}
              <strong style={{ color: 'var(--color-surface-text)', fontFamily: 'var(--font-mono)' }}>
                {item.evidenceDocName}
              </strong>
              {item.evidenceDocSize && ` (${item.evidenceDocSize})`}
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)', fontStyle: 'italic' }}>
            No evidence document linked
          </span>
        )}

        {item.evidenceDocName && onViewEvidence && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewEvidence(item.evidenceDocName!)}
            style={{ fontSize: 'var(--text-xs)' }}
          >
            Inspect Document ↗
          </Button>
        )}
      </div>

      {children}
    </Card>
  );
};
