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
import { enumLabel } from '@/lib/utils.js';

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
 * The linked evidence's document type; never guessed from the clause text.
 */
function deriveEvidenceType(item: ComplianceItem): string {
  const docType = item.companyEvidence?.docType;
  return docType && docType !== 'UNKNOWN' ? enumLabel(docType) : 'Not stated';
}

function deriveAdditionalInfo(item: ComplianceItem): string {
  const parts: string[] = [];
  if (item.executionRules?.udinRequired) {
    parts.push('CA UDIN required');
  }
  if (item.executionRules?.stampPaperRequired) {
    const denom = item.executionRules.stampPaperDenominationInr;
    parts.push(denom ? `Non-judicial stamp paper (₹${denom})` : 'Non-judicial stamp paper');
  }
  if (item.executionRules?.notarizationRequired) {
    parts.push('Notarization required');
  }
  if (item.executionRules?.signingAuthorityRank) {
    parts.push(`Signatory: ${item.executionRules.signingAuthorityRank}`);
  }
  return parts.length > 0 ? parts.join(' • ') : 'None stated';
}

function renderCitationBadges(citationRef: string) {
  // Support multiple citations split by comma, semicolon, bullet, or newline
  const citations = citationRef
    .split(/[,;\n•]+/)
    .map((c) => c.trim())
    .filter(Boolean);

  if (citations.length <= 1) {
    return (
      <span className="font-mono text-2xs bg-muted/40 px-1.5 py-0.5 rounded border border-border/50 break-words leading-relaxed inline-block max-w-full">
        {citationRef}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {citations.map((cite, idx) => (
        <span
          key={idx}
          className="font-mono text-2xs bg-muted/40 px-1.5 py-0.5 rounded border border-border/50 break-words leading-relaxed inline-block"
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
        ? `Page ${item.provenance.pageNumber}`
        : 'No page');

    return {
      id: item.id,
      requirement: item.requirement || item.description || 'Not stated',
      category: item.category || '',
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
            <ShieldAlert size={18} className="text-warning dark:text-warning" />
            <CardTitle className="text-base font-semibold text-foreground">
              Company document checklist
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
            <span>Upload in company profile</span>
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
                  <th className="py-2.5 px-4 min-w-[260px] max-w-[340px]">Tender requirement</th>
                  <th className="py-2.5 px-4 min-w-[200px] max-w-[260px]">
                    Required evidence type
                  </th>
                  <th className="py-2.5 px-4 min-w-[160px] whitespace-nowrap">Evidence status</th>
                  <th className="py-2.5 px-4 min-w-[200px] max-w-[280px]">
                    Execution &amp; validity rules
                  </th>
                  <th className="py-2.5 px-4 min-w-[220px] max-w-[320px]">Source citation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/15 transition-colors">
                    {/* Requirement */}
                    <td className="py-3 px-4 min-w-[260px] max-w-[340px]">
                      {row.category && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <Badge variant="neutral" size="sm">
                            {enumLabel(row.category)}
                          </Badge>
                        </div>
                      )}
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
                        <span className="inline-flex items-center gap-1 text-destructive font-semibold">
                          <AlertTriangle size={14} />
                          Expired certificate
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-warning dark:text-warning font-semibold">
                          <XCircle size={14} />
                          Missing in profile
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
