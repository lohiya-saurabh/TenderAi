import React from 'react';
import { Link } from 'react-router-dom';
import type { ComplianceItem } from '@/api/compliance.js';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card.js';
import { Badge } from '@/components/common/Badge.js';
import { Button } from '@/components/common/Button.js';
import {
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';

export interface CompanyDocumentChecklistProps {
  complianceItems: ComplianceItem[];
}

export interface ChecklistRow {
  id: string;
  requirement: string;
  category: string;
  evidenceType: string;
  isUploaded: boolean;
  isValid: boolean;
  statusLabel: 'Uploaded' | 'Missing' | 'Expired';
  additionalRequirements: string;
  citationRef: string;
  citationQuote?: string;
}

/**
 * Dynamically resolves the specific evidence document type from the tender clause
 * without hardcoding static universal requirements.
 */
function deriveEvidenceType(item: ComplianceItem): string {
  if (item.companyEvidence?.docType && item.companyEvidence.docType !== 'UNKNOWN') {
    return item.companyEvidence.docType
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const combinedText = `${item.requirement ?? ''} ${item.description ?? ''}`;
  const reqLower = combinedText.toLowerCase();

  if (
    reqLower.includes('iso') ||
    reqLower.includes('certification') ||
    reqLower.includes('standard')
  ) {
    return 'ISO / Quality Standard Certificate';
  }
  if (
    reqLower.includes('turnover') ||
    reqLower.includes('net worth') ||
    reqLower.includes('financial') ||
    reqLower.includes('balance sheet') ||
    reqLower.includes('solvency')
  ) {
    return 'CA-Audited Balance Sheet & UDIN Certificate';
  }
  if (
    reqLower.includes('similar') ||
    reqLower.includes('experience') ||
    reqLower.includes('completed') ||
    reqLower.includes('past work') ||
    reqLower.includes('track record')
  ) {
    return 'Client Completion Certificate & Work Order';
  }
  if (
    reqLower.includes('personnel') ||
    reqLower.includes('engineer') ||
    reqLower.includes('staff') ||
    reqLower.includes('curriculum vitae') ||
    reqLower.includes('cv')
  ) {
    return 'Key Personnel CV & Statutory EPF Records';
  }
  if (
    reqLower.includes('equipment') ||
    reqLower.includes('machinery') ||
    reqLower.includes('plant') ||
    reqLower.includes('crane') ||
    reqLower.includes('vehicle')
  ) {
    return 'Machinery RC / Ownership Proof & Lease Deeds';
  }
  if (
    reqLower.includes('bid security') ||
    reqLower.includes('earnest money') ||
    reqLower.includes('emd') ||
    reqLower.includes('bank guarantee') ||
    reqLower.includes('pbg')
  ) {
    return 'Bank Guarantee (MT760) / EMD Challan';
  }
  if (
    reqLower.includes('gst') ||
    reqLower.includes('pan') ||
    reqLower.includes('epf') ||
    reqLower.includes('esi') ||
    reqLower.includes('incorporation') ||
    reqLower.includes('statutory')
  ) {
    return 'Statutory Incorporation & Tax Registration';
  }
  if (
    reqLower.includes('affidavit') ||
    reqLower.includes('undertaking') ||
    reqLower.includes('non-blacklisting') ||
    reqLower.includes('litigation')
  ) {
    return 'Notarized Non-Blacklisting Affidavit';
  }

  return 'Authorized Verification Document';
}

function deriveAdditionalInfo(item: ComplianceItem): string {
  const parts: string[] = [];
  if (item.executionRules?.udinRequired) {
    parts.push('CA UDIN required');
  }
  if (item.executionRules?.stampPaperRequired) {
    const denom = item.executionRules.stampPaperDenominationInr
      ? `₹${item.executionRules.stampPaperDenominationInr}`
      : '₹100';
    parts.push(`Non-judicial stamp paper (${denom})`);
  }
  if (item.executionRules?.notarizationRequired) {
    parts.push('Notarization required');
  }
  if (item.executionRules?.signingAuthorityRank) {
    parts.push(`Signatory: ${item.executionRules.signingAuthorityRank}`);
  }
  return parts.length > 0 ? parts.join(' • ') : 'Standard verification';
}

function renderCitationBadges(citationRef: string) {
  // Support multiple citations split by comma, semicolon, bullet, or newline
  const citations = citationRef
    .split(/[,;\n•]+/)
    .map((c) => c.trim())
    .filter(Boolean);

  if (citations.length <= 1) {
    return (
      <span className="font-mono text-[11px] bg-muted/40 px-1.5 py-0.5 rounded border border-border/50 break-words leading-relaxed inline-block max-w-full">
        {citationRef}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {citations.map((cite, idx) => (
        <span
          key={idx}
          className="font-mono text-[11px] bg-muted/40 px-1.5 py-0.5 rounded border border-border/50 break-words leading-relaxed inline-block"
        >
          {cite}
        </span>
      ))}
    </div>
  );
}

export const CompanyDocumentChecklist: React.FC<CompanyDocumentChecklistProps> = ({
  complianceItems,
}) => {
  // Derive rows strictly from the extracted tender requirements
  const rows: ChecklistRow[] = complianceItems.map((item) => {
    const isUploaded =
      Boolean(item.companyEvidence) &&
      item.companyEvidence?.status !== 'MISSING' &&
      item.companyEvidence?.status !== 'PENDING_UPLOAD';

    const isExpired = item.companyEvidence?.status === 'EXPIRED';
    const isValid = Boolean(item.companyEvidence && item.companyEvidence.status === 'VERIFIED');

    let statusLabel: 'Uploaded' | 'Missing' | 'Expired' = 'Missing';
    if (isExpired) {
      statusLabel = 'Expired';
    } else if (isUploaded) {
      statusLabel = 'Uploaded';
    }

    const citationRef =
      item.provenance?.sectionOrClause ||
      (item.provenance?.pageNumber
        ? `Clause on Page ${item.provenance.pageNumber}`
        : 'Tender Document');

    return {
      id: item.id,
      requirement: item.requirement || item.description || 'Tender Compliance Criterion',
      category: item.category || 'TECHNICAL',
      evidenceType: deriveEvidenceType(item),
      isUploaded,
      isValid,
      statusLabel,
      additionalRequirements: deriveAdditionalInfo(item),
      citationRef,
      citationQuote: item.provenance?.verbatimQuote,
    };
  });

  const missingCount = rows.filter((r) => r.statusLabel === 'Missing').length;
  const uploadedCount = rows.filter((r) => r.statusLabel === 'Uploaded').length;

  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardHeader className="px-5 py-4 border-b border-border bg-muted/20 flex flex-row items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-[#8A4200] dark:text-orange-300" />
            <CardTitle className="text-base font-bold text-foreground">
              Company Document Checklist
            </CardTitle>
            <Badge variant="warning" className="text-xs">
              {missingCount} missing for this tender
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Required evidence derived directly from this tender's extracted clauses. Upload missing
            records to enable automated bid qualification evaluation.
          </p>
        </div>

        <Link to="/company-profile">
          <Button variant="primary" size="sm" className="gap-1.5">
            <ExternalLink size={13} />
            <span>Upload in Company Profile</span>
          </Button>
        </Link>
      </CardHeader>

      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No extracted compliance requirements available for this tender yet.
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs border-collapse min-w-[1050px]">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                  <th className="py-2.5 px-4 min-w-[260px] max-w-[340px]">Tender Requirement</th>
                  <th className="py-2.5 px-4 min-w-[200px] max-w-[260px]">
                    Required Evidence Type
                  </th>
                  <th className="py-2.5 px-4 min-w-[160px] whitespace-nowrap">Evidence Status</th>
                  <th className="py-2.5 px-4 min-w-[200px] max-w-[280px]">
                    Execution &amp; Validity Rules
                  </th>
                  <th className="py-2.5 px-4 min-w-[220px] max-w-[320px]">Source Citation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/15 transition-colors">
                    {/* Requirement */}
                    <td className="py-3 px-4 min-w-[260px] max-w-[340px]">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Badge variant="neutral" className="text-[10px] px-1 py-0 uppercase">
                          {row.category}
                        </Badge>
                      </div>
                      <p
                        className="font-medium text-foreground line-clamp-2 leading-relaxed break-words"
                        title={row.requirement}
                      >
                        {row.requirement}
                      </p>
                    </td>

                    {/* Required Evidence Type */}
                    <td className="py-3 px-4 font-medium text-foreground min-w-[200px] max-w-[260px]">
                      <div className="flex items-center gap-1.5">
                        <FileText size={14} className="text-primary shrink-0" />
                        <span className="break-words leading-relaxed">{row.evidenceType}</span>
                      </div>
                    </td>

                    {/* Evidence Status */}
                    <td className="py-3 px-4 whitespace-nowrap min-w-[160px]">
                      {row.statusLabel === 'Uploaded' ? (
                        <span className="inline-flex items-center gap-1 text-foreground font-semibold">
                          <CheckCircle2 size={14} />
                          {row.isValid ? 'Uploaded & Valid' : 'Uploaded (Self-Attested)'}
                        </span>
                      ) : row.statusLabel === 'Expired' ? (
                        <span className="inline-flex items-center gap-1 text-red-500 font-semibold">
                          <AlertTriangle size={14} />
                          Expired Certificate
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[#8A4200] dark:text-orange-300 font-semibold">
                          <XCircle size={14} />
                          Missing in Profile
                        </span>
                      )}
                    </td>

                    {/* Additional Requirements */}
                    <td className="py-3 px-4 text-muted-foreground min-w-[200px] max-w-[280px]">
                      <span className="leading-relaxed break-words">
                        {row.additionalRequirements}
                      </span>
                    </td>

                    {/* Source Citation */}
                    <td className="py-3 px-4 text-muted-foreground min-w-[220px] max-w-[320px]">
                      {renderCitationBadges(row.citationRef)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 py-3 border-t border-border bg-muted/10 flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
          <span>
            Completion: <strong>{uploadedCount}</strong> of <strong>{rows.length}</strong> required
            evidence items uploaded
          </span>
          <Link
            to="/company-profile"
            className="text-primary font-medium hover:underline inline-flex items-center gap-1"
          >
            Manage company evidence library <ArrowRight size={12} />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};
