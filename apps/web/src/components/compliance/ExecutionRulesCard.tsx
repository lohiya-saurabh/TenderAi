import React from 'react';
import type { ExecutionRules } from '../../api/compliance.js';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { FileText, Scale, Search, FileSignature, Landmark, type LucideIcon } from 'lucide-react';

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
      detail: executionRules.notarizationRequired
        ? 'Public Notary / Oath Commissioner'
        : 'Not mandatory',
      icon: Scale,
    },
    {
      label: 'CA Certificate & UDIN',
      active: executionRules.udinRequired,
      detail: executionRules.udinRequired
        ? '18-digit UDIN mandatory for CA certs'
        : 'Not mandatory',
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
    <div className="border border-border/80 rounded-lg p-4 bg-muted/20">
      <h4 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5 uppercase tracking-wider">
        <Landmark size={14} className="text-orange-600 dark:text-orange-400" /> Indian Tender
        Execution &amp; Statutory Rules
      </h4>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 items-stretch">
        {items.map((item, idx) => {
          const IconComponent = item.icon;
          return (
            <div
              key={idx}
              className={`p-3 rounded-md border flex flex-col justify-between h-full gap-1.5 transition-colors ${
                item.active ? 'bg-card border-border shadow-2xs' : 'bg-muted/40 border-border/60'
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <IconComponent
                    size={14}
                    className={
                      item.active ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'
                    }
                  />
                  <span
                    className={`text-xs font-semibold ${
                      item.active ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground leading-relaxed">{item.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
