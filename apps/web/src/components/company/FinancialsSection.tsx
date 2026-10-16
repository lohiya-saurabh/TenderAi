import React from 'react';
import { TrendingUp, Building } from 'lucide-react';
import { CapabilityItemCard } from '@/components/company/CapabilityItemCard.js';
import { CapabilityEmptyState } from '@/components/company/CapabilityEmptyState.js';
import type {
  FinancialTurnoverItem,
  SolvencyItem,
} from '@/components/company/companyProfileData.js';

export interface FinancialsSectionProps {
  turnoverRecords: FinancialTurnoverItem[];
  solvencyRecords: SolvencyItem[];
  onUploadEvidence?: () => void;
  onSelectDocPreview: (docIdOrName: string) => void;
}

export const FinancialsSection: React.FC<FinancialsSectionProps> = ({
  turnoverRecords,
  solvencyRecords,
  onUploadEvidence,
  onSelectDocPreview,
}) => {
  return (
    <div className="flex flex-col gap-6">
      {/* 1. Audited Turnover Statements */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-3">
          Audited Annual Financial Statements (with ICAI UDIN)
        </h3>
        {turnoverRecords.length === 0 ? (
          <CapabilityEmptyState
            icon={TrendingUp}
            title="No Audited Turnover Statements Recorded"
            description="Upload CA-certified balance sheets and ICAI UDIN turnover certificates to establish 3-year average turnover thresholds for tender qualification."
            actionLabel="Upload Turnover Document"
            onAction={onUploadEvidence}
            actionIcon="upload"
          />
        ) : (
          <div className="flex flex-col gap-3">
            {turnoverRecords.map((to) => (
              <CapabilityItemCard
                key={to.id}
                item={to}
                typeBadge={to.financialYear}
                onViewEvidence={(doc) => onSelectDocPreview(doc)}
                fields={[
                  {
                    label: 'Audited Annual Turnover',
                    value: `₹${to.turnoverInrCrores.toFixed(2)} Crores`,
                    highlight: true,
                  },
                  {
                    label: 'Computed Net Worth',
                    value: `₹${to.netWorthInrCrores.toFixed(2)} Crores`,
                  },
                  {
                    label: 'Profit After Tax (PAT)',
                    value: to.profitAfterTaxCrores
                      ? `₹${to.profitAfterTaxCrores.toFixed(2)} Crores`
                      : 'N/A',
                  },
                  {
                    label: 'ICAI CA UDIN',
                    value: `${to.caUdin} ${to.isUdinValidated ? '(Validated)' : ''}`,
                    isMono: true,
                    highlight: true,
                  },
                  {
                    label: 'Chartered Accountant Firm',
                    value: `${to.caFirmName} (Mem #${to.caMembershipNo})`,
                  },
                ]}
              />
            ))}
          </div>
        )}
      </div>

      {/* 2. Bank Solvency Certificates */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-3">
          Bank Working Capital &amp; Solvency Certificates
        </h3>
        {solvencyRecords.length === 0 ? (
          <CapabilityEmptyState
            icon={Building}
            title="No Bank Solvency Certificates Recorded"
            description="Upload bank working capital or solvency certificates to satisfy financial capacity and bank guarantee requirements."
            actionLabel="Upload Solvency Document"
            onAction={onUploadEvidence}
            actionIcon="upload"
          />
        ) : (
          <div className="flex flex-col gap-3">
            {solvencyRecords.map((solv) => (
              <CapabilityItemCard
                key={solv.id}
                item={solv}
                typeBadge="Bank Solvency"
                expiryDate={solv.validUntil}
                onViewEvidence={(doc) => onSelectDocPreview(doc)}
                fields={[
                  {
                    label: 'Solvency Certificate Limit',
                    value: `₹${solv.solvencyLimitInrCrores.toFixed(2)} Crores`,
                    highlight: true,
                  },
                  { label: 'Issuing Bank & Branch', value: solv.bankName },
                  { label: 'Account Reference', value: solv.accountNumberMasked, isMono: true },
                  { label: 'Sanction Date', value: solv.sanctionDate },
                ]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
