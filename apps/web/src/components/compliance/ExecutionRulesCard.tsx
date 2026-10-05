import React from 'react';
import type { ExecutionRules } from '../../api/compliance.js';
import { formatCurrency } from '../../utils/formatCurrency.js';
import {
  FileText,
  Scale,
  Search,
  FileSignature,
  Landmark,
  type LucideIcon,
} from 'lucide-react';

export interface ExecutionRulesCardProps {
  executionRules: ExecutionRules;
}

interface ExecutionRuleItem {
  label: string;
  active: boolean;
  detail: string;
  icon: LucideIcon;
}

export const ExecutionRulesCard: React.FC<ExecutionRulesCardProps> = ({ executionRules }) => {
  const items: ExecutionRuleItem[] = [
    {
      label: 'Non-Judicial Stamp Paper',
      active: executionRules.stampPaperRequired,
      detail: executionRules.stampPaperDenominationInr
        ? `Denomination: ${formatCurrency(executionRules.stampPaperDenominationInr)}`
        : 'Required (Denomination as per state act)',
      icon: FileText,
    },
    {
      label: 'Notarization / Attestation',
      active: executionRules.notarizationRequired,
      detail: executionRules.notarizationRequired ? 'Public Notary / Oath Commissioner' : 'Not mandatory',
      icon: Scale,
    },
    {
      label: 'CA Certificate & UDIN',
      active: executionRules.udinRequired,
      detail: executionRules.udinRequired ? '18-digit UDIN mandatory for CA certs' : 'Not mandatory',
      icon: Search,
    },
    {
      label: 'Authorized Signatory',
      active: Boolean(executionRules.signingAuthorityRank),
      detail: executionRules.signingAuthorityRank || 'Authorized Representative',
      icon: FileSignature,
    },
  ];

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-card)',
        border: '1px solid var(--color-surface-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem',
      }}
    >
      <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-surface-text)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <Landmark size={16} className="text-primary" /> Indian Tender Execution & Statutory Rules
      </h4>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.75rem',
        }}
      >
        {items.map((item, idx) => {
          const IconComponent = item.icon;
          return (
            <div
              key={idx}
              style={{
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: item.active ? 'rgba(99, 102, 241, 0.08)' : 'var(--color-surface-bg)',
                border: `1px solid ${item.active ? 'rgba(99, 102, 241, 0.25)' : 'var(--color-surface-border)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                <IconComponent size={14} className={item.active ? 'text-primary' : 'text-muted-foreground'} />
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: item.active ? 'var(--color-primary-100)' : 'var(--color-surface-muted)',
                  }}
                >
                  {item.label}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-surface-muted)' }}>
                {item.detail}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
