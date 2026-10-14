import React, { useState } from 'react';
import type { ComplianceItem } from '../../api/compliance.js';
import { StatusBadge } from '../common/StatusBadge.js';
import { RiskBadge } from '../common/RiskBadge.js';
import { Badge, type BadgeVariant } from '../common/Badge.js';
import { Button } from '../common/Button.js';
import { Card } from '../common/Card.js';
import { ChevronRightIcon, ChevronDownIcon } from '../common/Icons.js';
import { FileText } from 'lucide-react';
import { ExecutionRulesCard } from './ExecutionRulesCard.js';
import { ReviewActions } from './ReviewActions.js';
import { EvidenceTraceabilityChain } from './EvidenceTraceabilityChain.js';

export interface ComplianceRowProps {
  item: ComplianceItem;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onReview: (
    itemId: string,
    status: ComplianceItem['status'],
    notes?: string,
    expectedVersion?: number,
  ) => Promise<void>;
  onInspectEvidence?: (item: ComplianceItem) => void;
  onInspectCitation?: (item: ComplianceItem) => void;
  onInspectAssessment?: (item: ComplianceItem) => void;
}

export const ComplianceRow: React.FC<ComplianceRowProps> = ({
  item,
  isExpanded,
  onToggleExpand,
  onReview,
  onInspectEvidence,
  onInspectCitation,
  onInspectAssessment,
}) => {
  const [isReviewing, setIsReviewing] = useState<boolean>(false);

  const handleRowReview = async (status: ComplianceItem['status'], notes?: string) => {
    setIsReviewing(true);
    try {
      await onReview(item.id, status, notes, item.version);
    } finally {
      setIsReviewing(false);
    }
  };

  const riskLevel = item.risk?.level || 'LOW';

  const sourceDocName = item.sourceCitation?.document || item.provenance?.documentName || 'NIT';
  const sourcePage = item.sourceCitation?.page || item.provenance?.pageNumber || 1;

  const categoryVariant = getCategoryBadgeVariant(item.category);

  return (
    <div
      className={`transition-colors ${
        isExpanded ? 'bg-orange-50/40 dark:bg-orange-950/15' : 'hover:bg-muted/30'
      }`}
    >
      {/* Main 7-Column Row */}
      <div
        className="grid grid-cols-[30%_11%_8%_18%_13%_10%_10%] gap-3 px-5 py-3.5 items-center cursor-pointer select-none"
        onClick={() => onToggleExpand(item.id)}
      >
        {/* 1. Requirement */}
        <div className="flex items-start gap-2.5 min-w-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(item.id);
            }}
            className="p-0.5 text-muted-foreground hover:text-foreground shrink-0 mt-0.5 transition-colors"
            aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
          >
            {isExpanded ? (
              <ChevronDownIcon size={15} color="#ea580c" />
            ) : (
              <ChevronRightIcon size={15} />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <div
              className="text-xs font-semibold text-foreground leading-snug line-clamp-2 break-words"
              title={item.requirement}
            >
              {item.requirement}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {item.tenderClauseRef && (
                <span className="text-[10px] font-mono font-medium text-foreground bg-muted px-1.5 py-0.5 rounded">
                  Clause {item.tenderClauseRef}
                </span>
              )}
              {item.subCategory && (
                <span className="text-[11px] text-muted-foreground truncate">
                  {item.subCategory}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 2. Category */}
        <div>
          <Badge variant={categoryVariant} size="sm">
            {item.category}
          </Badge>
        </div>

        {/* 3. Mandatory */}
        <div>
          {item.isMandatory ? (
            <Badge variant="danger" size="sm">
              Mandatory
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground font-medium">Optional</span>
          )}
        </div>

        {/* 4. Company Evidence */}
        <div className="min-w-0">
          {item.companyEvidence ? (
            <div
              className="flex items-center gap-1.5 min-w-0 cursor-pointer group"
              onClick={(e) => {
                e.stopPropagation();
                onInspectEvidence?.(item);
              }}
              title="Click to inspect linked company evidence"
            >
              <StatusBadge status={item.companyEvidence.status} size="sm" showIcon={false} />
              <span className="text-xs text-foreground truncate group-hover:underline underline-offset-2">
                {item.companyEvidence.title}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground italic">No evidence linked</span>
          )}
        </div>

        {/* 5. Status */}
        <div className="flex items-center">
          <StatusBadge status={item.status} size="sm" />
        </div>

        {/* 6. Risk */}
        <div className="flex items-center">
          <RiskBadge level={riskLevel} size="sm" />
        </div>

        {/* 7. Source */}
        <div className="min-w-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInspectCitation?.(item);
            }}
            className="inline-flex items-center gap-1 px-2 py-1 bg-background hover:bg-muted/60 border border-border rounded text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors max-w-full truncate"
            title="Inspect source clause citation"
          >
            <FileText size={12} className="shrink-0 text-muted-foreground" />
            <span className="truncate">p.{sourcePage}</span>
          </button>
        </div>
      </div>

      {/* Expanded Detail Panel — Answers the 4 Core Questions */}
      {isExpanded && (
        <div className="px-5 py-5 border-t border-border/80 bg-background/60 flex flex-col gap-4">
          {/* Dual-Sided Evidence Traceability Chain */}
          <EvidenceTraceabilityChain
            item={item}
            onInspectCitation={() => onInspectCitation?.(item)}
            onInspectEvidence={() => onInspectEvidence?.(item)}
            onInspectAssessment={() => onInspectAssessment?.(item)}
          />

          {/* Question 1: What does the tender require? */}
          <Card padding="md">
            <div className="flex justify-between items-start gap-3 mb-2">
              <h5 className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                1. What does the tender require?
              </h5>
              {item.isMandatory && (
                <Badge variant="danger" size="sm">
                  Mandatory Qualification Criterion
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-foreground leading-relaxed mb-3">
              {item.requirement}
            </p>

            {/* Execution / Statutory Rules Card */}
            {item.executionRules && <ExecutionRulesCard executionRules={item.executionRules} />}
          </Card>

          {/* Grid for Questions 2, 3, and 4 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-stretch">
            {/* Question 2: Do we have evidence? */}
            <Card padding="md" className="flex flex-col justify-between h-full">
              <div className="flex flex-col flex-1">
                <div className="flex justify-between items-center mb-2.5 min-h-[24px]">
                  <h5 className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                    2. Do we have evidence?
                  </h5>
                  {item.companyEvidence && (
                    <StatusBadge status={item.companyEvidence.status} size="sm" />
                  )}
                </div>

                <div className="flex-1 flex flex-col justify-center">
                  {item.companyEvidence ? (
                    <div className="p-2.5 rounded bg-muted/30 border border-border/60 flex flex-col gap-1 text-xs min-h-[72px] justify-center">
                      <div className="font-semibold text-foreground truncate">{item.companyEvidence.title}</div>
                      <div className="text-muted-foreground text-[11px]">
                        Type: <span className="text-foreground">{item.companyEvidence.docType}</span>
                        {item.companyEvidence.udinNumber && (
                          <span>
                            {' '}
                            • UDIN:{' '}
                            <code className="text-foreground font-mono">
                              {item.companyEvidence.udinNumber}
                            </code>
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded bg-muted/15 border border-dashed border-border/70 text-xs text-muted-foreground leading-relaxed min-h-[72px] flex items-center">
                      No company evidence attached to satisfy this clause.
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 mt-auto">
                <Button variant="secondary" size="sm" fullWidth onClick={() => onInspectEvidence?.(item)}>
                  {item.companyEvidence ? 'Inspect Evidence Details' : 'Map / Upload Evidence'}
                </Button>
              </div>
            </Card>

            {/* Question 3: Why did the system reach this result? */}
            <Card padding="md" className="flex flex-col justify-between h-full">
              <div className="flex flex-col flex-1">
                <div className="flex justify-between items-center mb-2.5 min-h-[24px]">
                  <h5 className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                    3. Why did the system reach this result?
                  </h5>
                  <StatusBadge status={item.status} size="sm" />
                </div>

                <div className="flex-1 flex flex-col justify-center">
                  {item.rationale ? (
                    <div className="p-2.5 rounded bg-muted/30 border border-border/60 flex flex-col gap-1 text-xs min-h-[72px] justify-center">
                      <div className="text-foreground leading-relaxed line-clamp-2">
                        <strong>Rule:</strong> {item.rationale.ruleApplied}
                      </div>
                      <div className="text-muted-foreground text-[11px] mt-0.5">
                        Confidence:{' '}
                        <span className="font-semibold text-foreground">
                          {Math.round((item.rationale.confidenceScore || 0) * 100)}%
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded bg-muted/15 border border-dashed border-border/70 text-xs text-muted-foreground leading-relaxed min-h-[72px] flex items-center">
                      Automated rationale not computed yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 mt-auto">
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={() => onInspectAssessment?.(item)}
                >
                  {item.rationale ? 'View Full Rationale Breakdown' : 'Inspect Assessment'}
                </Button>
              </div>
            </Card>

            {/* Question 4: Where did this requirement come from? */}
            <Card padding="md" className="flex flex-col justify-between h-full">
              <div className="flex flex-col flex-1">
                <div className="flex justify-between items-center mb-2.5 min-h-[24px]">
                  <h5 className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                    4. Where did this come from?
                  </h5>
                  <Badge variant="neutral" size="sm">
                    Page {sourcePage}
                  </Badge>
                </div>

                <div className="flex-1 flex flex-col justify-center">
                  <div className="flex flex-col gap-1.5 text-xs min-h-[72px] justify-center">
                    <div className="text-foreground font-medium truncate">
                      {sourceDocName}{' '}
                      {item.sourceCitation?.section ? `• ${item.sourceCitation.section}` : ''}
                    </div>
                    <div className="bg-muted/40 border-l-2 border-orange-500 p-2 rounded-r text-xs italic text-muted-foreground leading-relaxed line-clamp-2">
                      "
                      {item.sourceCitation?.verbatimQuote ||
                        item.provenance?.verbatimQuote ||
                        'Verbatim quote available in citation drawer.'}
                      "
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 mt-auto">
                <Button variant="secondary" size="sm" fullWidth onClick={() => onInspectCitation?.(item)}>
                  View Source Citation & Quote
                </Button>
              </div>
            </Card>
          </div>

          {/* Review Notes Section */}
          {item.reviewNotes && (
            <div className="p-3.5 rounded-lg bg-card border border-border text-xs">
              <div className="text-muted-foreground mb-1 font-semibold">
                Reviewer Justification:
              </div>
              <div className="text-foreground leading-relaxed">{item.reviewNotes}</div>
            </div>
          )}

          {/* Footer with Human Review Actions */}
          <div className="flex justify-between items-center pt-3.5 border-t border-border flex-wrap gap-3">
            <div className="text-xs text-muted-foreground">
              Version {item.version} •{' '}
              {item.reviewedAt ? `Reviewed on ${item.reviewedAt}` : 'Pending Human Review'}
              {item.humanReviewRequired && (
                <span className="ml-2">
                  <Badge variant="warning" size="sm">
                    Human Review Required
                  </Badge>
                </span>
              )}
            </div>

            <ReviewActions
              currentStatus={item.status}
              onReview={handleRowReview}
              isLoading={isReviewing}
            />
          </div>
        </div>
      )}
    </div>
  );
};

function getCategoryBadgeVariant(category: ComplianceItem['category']): BadgeVariant {
  switch (category) {
    case 'LEGAL':
      return 'primary';
    case 'TECHNICAL':
      return 'neutral';
    case 'FINANCIAL':
      return 'success';
    case 'STATUTORY':
      return 'warning';
    case 'EXECUTION':
      return 'danger';
    case 'COMMERCIAL':
      return 'neutral';
    default:
      return 'neutral';
  }
}
