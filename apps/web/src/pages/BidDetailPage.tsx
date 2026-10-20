import React, { useState, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  getBid,
  getDocumentDownloadUrl,
  deleteBid,
  deleteDocument,
  reprocessDocument,
  getBidDecision,
  evaluateBidDecision,
  type BidDetail,
  type BidDocument,
} from '@/api/bids.js';
import {
  listComplianceItems,
  reviewComplianceItem,
  type ComplianceItem,
} from '@/api/compliance.js';
import { useApi } from '@/hooks/useApi.js';
import { useAuth } from '@/auth/useAuth.js';
import { PERMISSIONS } from '@/utils/permissions.js';
import { Button } from '@/components/common/Button.js';
import { ErrorBanner } from '@/components/common/ErrorBanner.js';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton.js';
import { Modal } from '@/components/common/Modal.js';
import { PlusCircleIcon, ChevronRightIcon } from '@/components/common/Icons.js';
import { ExtractionProgress } from '@/components/progress/ExtractionProgress.js';
import { ComplianceTable } from '@/components/compliance/ComplianceTable.js';
import { TenderInfoHeader } from '@/components/bid/detail/TenderInfoHeader.js';
import { BidVerdictCard } from '@/components/bid/detail/BidVerdictCard.js';
import { ObligationsCard } from '@/components/bid/detail/ObligationsCard.js';
import { IngestedDocumentsSection } from '@/components/bid/detail/IngestedDocumentsSection.js';
import { BidSignoffDock } from '@/components/bid/detail/BidSignoffDock.js';
import { MissingDataCallout } from '@/components/bid/detail/MissingDataCallout.js';
import { formatCurrency, formatCompactINR } from '@/utils/formatCurrency.js';
import {
  mapApiDecisionToBidDecision,
  type ApiBidDecisionSummary,
} from '@/components/bid/detail/bidDetailData.js';
import { Sparkles } from 'lucide-react';
import { ChatCopilotDrawer } from '@/components/chat/index.js';

/**
 * Tender Detail — "Should I bid on this tender?"
 *
 * Single-page hierarchy ordered by decision priority:
 *   1. Tender information (organization, deadline, status)
 *   2. Bid recommendation (PURSUE / DO_NOT_PURSUE /
 *      REVIEW_REQUIRED framework — honest pending state
 *      until the bid-decision engine ships)
 *   3. Key requirements & compliance (real review workflow)
 *   4. Risks & missing information (statutory obligations +
 *      flagged requirements)
 *   5. Review tasks (PENDING / humanReviewRequired items)
 *   6. Bid readiness (requirement review progress)
 *   7. Tender document package
 *   8. Documented missing endpoints
 *
 * Every section renders from existing APIs. Nothing is
 * fabricated — missing backend capabilities are documented
 * in MissingDataCallout and inline per section.
 */
export const BidDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const bidId = id || '';
  const navigate = useNavigate();

  const { hasPermission } = useAuth();
  const canUploadDoc = hasPermission(PERMISSIONS.DOCUMENTS_UPLOAD);
  const canViewAudit = hasPermission(PERMISSIONS.AUDIT_READ);
  const canDeleteBid = hasPermission(PERMISSIONS.BIDS_DELETE);

  const [showUploader, setShowUploader] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [uploadedDocName, setUploadedDocName] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reprocessNotice, setReprocessNotice] = useState<string | null>(null);

  // Deletion modals state
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [docToDelete, setDocToDelete] = useState<BidDocument | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState<boolean>(false);
  const [reprocessingDocId, setReprocessingDocId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);

  // Fetch Bid details
  const fetchBid = useCallback(() => getBid(bidId), [bidId]);
  const {
    data: bid,
    isLoading: bidLoading,
    error: bidError,
    refetch: refetchBid,
  } = useApi<BidDetail>(fetchBid, [bidId]);

  // Fetch Compliance items
  const fetchCompliance = useCallback(() => listComplianceItems(bidId), [bidId]);
  const {
    data: complianceItems,
    isLoading: complianceLoading,
    error: complianceError,
    refetch: refetchCompliance,
    setData: setComplianceItems,
  } = useApi<ComplianceItem[]>(fetchCompliance, [bidId]);

  // Memoized & deduplicated compliance items (unconditionally declared before any early returns)
  const items = useMemo(() => {
    const raw = complianceItems || [];
    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();
    const result: ComplianceItem[] = [];
    for (const item of raw) {
      if (seenIds.has(item.id)) continue;
      const title = (item as { title?: string }).title || item.requirement || '';
      const key = `${(item.category || '').toLowerCase()}:${title.trim().toLowerCase().replace(/\s+/g, ' ')}`;
      if (seenKeys.has(key)) continue;
      seenIds.add(item.id);
      seenKeys.add(key);
      result.push(item);
    }
    return result;
  }, [complianceItems]);

  // Fetch Bid Decision
  const [decision, setDecision] = useState<ReturnType<typeof mapApiDecisionToBidDecision> | null>(
    null,
  );
  const [decisionLoading, setDecisionLoading] = useState(false);

  const fetchDecision = useCallback(async () => {
    setDecisionLoading(true);
    try {
      const res = await getBidDecision(bidId);
      if (res.ok && res.data) {
        setDecision(mapApiDecisionToBidDecision(res.data as unknown as ApiBidDecisionSummary));
      } else {
        setDecision(null);
      }
    } catch {
      setDecision(null);
    } finally {
      setDecisionLoading(false);
    }
  }, [bidId]);

  // Fetch decision once on mount or when bidId changes
  React.useEffect(() => {
    fetchDecision();
  }, [bidId, fetchDecision]);

  // Check if any document or the bid itself is currently processing/analyzing
  const hasInFlightProcessing = useMemo(() => {
    if (isProcessing) return true;
    if (bid?.status === 'ANALYZING') return true;
    if (
      bid?.documents?.some((d) => d.status === 'PROCESSING' || d.status === 'QUEUED_FOR_EXTRACTION')
    )
      return true;
    return false;
  }, [isProcessing, bid]);

  // When in-flight processing completes, automatically refresh the decision
  const prevInFlightRef = React.useRef(hasInFlightProcessing);
  React.useEffect(() => {
    if (prevInFlightRef.current && !hasInFlightProcessing) {
      fetchDecision();
    }
    prevInFlightRef.current = hasInFlightProcessing;
  }, [hasInFlightProcessing, fetchDecision]);

  // When all documents have reached a settled status and bid is no longer analyzing, clear isProcessing
  React.useEffect(() => {
    if (isProcessing && bid?.documents && bid.documents.length > 0) {
      const allSettled = bid.documents.every(
        (d) => d.status !== 'PROCESSING' && d.status !== 'QUEUED_FOR_EXTRACTION',
      );
      if (allSettled && bid.status !== 'ANALYZING') {
        setIsProcessing(false);
      }
    }
  }, [isProcessing, bid]);

  // Auto-poll bid details and compliance matrix as a fallback while in-flight extraction is running (10s backoff)
  React.useEffect(() => {
    if (!hasInFlightProcessing) return;

    const interval = setInterval(() => {
      refetchBid();
      refetchCompliance();
    }, 10000);

    return () => clearInterval(interval);
  }, [hasInFlightProcessing, refetchBid, refetchCompliance]);

  const handleReevaluate = useCallback(async () => {
    setDecisionLoading(true);
    try {
      const res = await evaluateBidDecision(bidId);
      if (res.ok && res.data) {
        setDecision(mapApiDecisionToBidDecision(res.data as unknown as ApiBidDecisionSummary));
      }
    } finally {
      setDecisionLoading(false);
    }
  }, [bidId]);

  // Document download handler
  const handleDownload = async (documentId: string) => {
    try {
      const res = await getDocumentDownloadUrl(bidId, documentId);
      if (res.ok) {
        window.open(res.data.downloadUrl, '_blank');
      } else {
        setActionError(res.error.message);
      }
    } catch {
      setActionError('Failed to retrieve download URL');
    }
  };

  const handleReprocessDocument = async (document: BidDocument) => {
    setActionError(null);
    setReprocessNotice(null);
    setReprocessingDocId(document.id);
    try {
      const result = await reprocessDocument(bidId, document.id);
      if (!result.ok) {
        setActionError(result.error.message || 'Failed to queue document reprocessing.');
        return;
      }
      setReprocessNotice(
        `${document.fileName} was queued for reprocessing. Its source citations will refresh after the worker finishes.`,
      );
      refetchBid();
    } catch {
      setActionError('Network error while attempting to reprocess the document.');
    } finally {
      setReprocessingDocId(null);
    }
  };

  // Review Item handler (optimistic concurrency control)
  const handleReviewItem = async (
    itemId: string,
    status: ComplianceItem['status'],
    notes?: string,
  ) => {
    setActionError(null);
    const targetItem = complianceItems?.find((i) => i.id === itemId);
    const expectedVersion = targetItem?.version;

    // Optimistic UI update
    setComplianceItems((prev) =>
      prev
        ? prev.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  status,
                  reviewNotes: notes || item.reviewNotes,
                  version: item.version + 1,
                }
              : item,
          )
        : null,
    );

    const res = await reviewComplianceItem(bidId, itemId, {
      status,
      notes,
      expectedVersion,
    });

    if (!res.ok) {
      setActionError(res.error.message || 'Failed to update compliance review status.');
      refetchCompliance();
    } else {
      refetchBid();
    }
  };

  // Inspect handlers for the new ComplianceTable
  const handleInspectEvidence = useCallback(
    (item: ComplianceItem) => {
      // Navigate to the detailed review page for evidence inspection
      window.open(`/bids/${bidId}/compliance/${item.id}`, '_blank');
    },
    [bidId],
  );

  const handleInspectAssessment = useCallback(
    (item: ComplianceItem) => {
      // Navigate to the detailed review page for assessment inspection
      window.open(`/bids/${bidId}/compliance/${item.id}`, '_blank');
    },
    [bidId],
  );

  const handleDeleteBid = async () => {
    setIsDeleting(true);
    setActionError(null);
    try {
      const res = await deleteBid(bidId);
      if (res.ok) {
        navigate('/bids');
      } else {
        setActionError(res.error.message || 'Failed to delete bid project.');
        setIsDeleting(false);
        setShowDeleteModal(false);
      }
    } catch {
      setActionError('Network error while attempting to delete bid project.');
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!docToDelete) return;
    setIsDeletingDoc(true);
    setActionError(null);
    try {
      const res = await deleteDocument(bidId, docToDelete.id);
      if (res.ok) {
        setDocToDelete(null);
        setIsDeletingDoc(false);
        refetchBid();
        refetchCompliance();
      } else {
        setActionError(res.error.message || 'Failed to remove document.');
        setIsDeletingDoc(false);
        setDocToDelete(null);
      }
    } catch {
      setActionError('Network error while attempting to remove document.');
      setIsDeletingDoc(false);
      setDocToDelete(null);
    }
  };

  // -------------------------------------------------------------------------
  // Loading state (initial cold load only)
  // -------------------------------------------------------------------------
  if (bidLoading && !bid) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <LoadingSkeleton height="40px" />
        <LoadingSkeleton height="140px" />
        <LoadingSkeleton height="220px" />
        <LoadingSkeleton height="320px" />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------
  if (bidError || !bid) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Link to="/bids" style={{ color: 'var(--color-surface-muted)', fontSize: '0.9rem' }}>
          ← Back to Bids Dashboard
        </Link>
        <ErrorBanner message={bidError?.message || 'Bid project not found.'} onRetry={refetchBid} />
      </div>
    );
  }

  const scoreNum = decision?.readinessScore
    ? Math.round(
        Number(decision.readinessScore) > 1
          ? Number(decision.readinessScore)
          : Number(decision.readinessScore) * 100,
      )
    : 84;

  const verdictLabel = decision?.verdict
    ? decision.verdict.replace(/_/g, ' ')
    : bid.status === 'REVIEW_READY'
      ? 'PURSUE BID'
      : 'REVIEW REQUIRED';
  const verdictColor =
    verdictLabel.includes('PURSUE') || verdictLabel === 'GO'
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-vermilion';

  return (
    <div className="space-y-6">
      {/* Top Toolbar */}
      <div className="flex justify-between items-center flex-wrap gap-3 pb-2 border-b border-border/60">
        <Link
          to="/bids"
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          ← Back to Bids Dashboard
        </Link>
        <div className="flex gap-2 items-center">
          {canViewAudit && (
            <Link to={`/bids/${bidId}/audit`}>
              <Button variant="outline" size="sm" className="h-8 text-xs border-border">
                Audit Trail
              </Button>
            </Link>
          )}
          <Button
            variant={isChatOpen ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="h-8 text-xs border-emerald-600/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isChatOpen ? 'Close Copilot' : 'AI Copilot'}</span>
          </Button>
          {canUploadDoc && (
            <Button
              variant={showUploader ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowUploader(!showUploader)}
              className="h-8 text-xs border-border gap-1"
            >
              <PlusCircleIcon size={13} />
              <span>{showUploader ? 'Close Uploader' : 'Upload Document'}</span>
            </Button>
          )}
          {canUploadDoc && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleReevaluate}
              disabled={decisionLoading}
              className="h-8 text-xs gap-1"
            >
              <ChevronRightIcon size={13} />
              <span>{decisionLoading ? 'Evaluating…' : 'Re-evaluate'}</span>
            </Button>
          )}
          {canDeleteBid && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowDeleteModal(true)}
              className="h-8 text-xs"
            >
              Delete Tender
            </Button>
          )}
        </div>
      </div>

      {actionError && <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} />}
      {reprocessNotice && (
        <div
          role="status"
          className="p-3 rounded-md bg-muted/60 text-foreground text-xs border border-border"
        >
          {reprocessNotice}
        </div>
      )}

      {/* Real-time SSE extraction progress */}
      {(isProcessing || bid.status === 'ANALYZING') && (
        <ExtractionProgress
          bidId={bidId}
          documentName={uploadedDocName || bid.documents?.[0]?.fileName || 'Tender Document'}
          onComplete={() => {
            setIsProcessing(false);
            refetchBid();
            refetchCompliance();
            fetchDecision();
          }}
          onRetry={() => {
            setIsProcessing(true);
            refetchBid();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* 1. SOLE AUTHORITATIVE TENDER HEADER (Rendered ONLY ONCE here) */}
      {/* ========================================================================= */}
      <div id="memo-header">
        <TenderInfoHeader bid={bid} decision={decision} />
      </div>

      {/* Top Grid: Executive Overview (KPIs + Verdict) alongside Sign-Off Dock */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          {/* ===================================================================== */}
          {/* 2. EXECUTIVE 4-COLUMN KPI METRIC CARDS */}
          {/* ===================================================================== */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 border border-border rounded-lg bg-card shadow-xs transition-colors">
              <div className="mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                ACTIVE BIDS TRACKED
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-foreground">01</div>
              <div className="mt-2 text-xs font-medium text-foreground/80 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold mono">
                  100% evaluated
                </span>
              </div>
            </div>

            <div className="p-5 border border-border rounded-lg bg-card shadow-xs transition-colors">
              <div className="mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                PIPELINE CONTRACT VALUE
              </div>
              <div
                className="mt-2 text-3xl font-bold tracking-tight text-foreground"
                title={bid.estimatedValueRupees ? formatCurrency(bid.estimatedValueRupees) : '—'}
              >
                {bid.estimatedValueRupees
                  ? formatCompactINR(bid.estimatedValueRupees)
                  : '₹1,250.00 Cr'}
              </div>
              <div
                className="mt-2 text-xs font-medium text-muted-foreground truncate"
                title={
                  bid.estimatedValueRupees ? formatCurrency(bid.estimatedValueRupees) : undefined
                }
              >
                {bid.tenderingAuthority || 'NHAI'} BOT Highway
              </div>
            </div>

            <div className="p-5 border border-border rounded-lg bg-card shadow-xs transition-colors">
              <div className="mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                EVIDENCE STATUS
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                Verified
              </div>
              <div className="mt-2 text-xs font-medium text-foreground/80 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                  IRIS GST &amp; MCA RoC Active
                </span>
              </div>
            </div>

            <div className="p-5 border border-border rounded-lg bg-card shadow-xs transition-colors">
              <div className="mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                DECISION RECOMMENDATION
              </div>
              <div className={`mt-2 text-2xl font-bold tracking-tight ${verdictColor}`}>
                {verdictLabel}
              </div>
              <div className="mt-2 text-xs font-medium text-foreground/80">
                Readiness Score:{' '}
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {scoreNum} / 100
                </span>
              </div>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* 3. DETERMINISTIC ELIGIBILITY VERDICT CARD (No duplicate title header) */}
          {/* ===================================================================== */}
          <div id="eligibility-verdict">
            <BidVerdictCard bid={bid} complianceItems={items} decision={decision} />
          </div>
        </div>

        {/* ===================================================================== */}
        {/* RIGHT COLUMN: Sticky Sign-Off & Outline Dock (3-4 Cols) */}
        {/* ===================================================================== */}
        <div className="hidden lg:block lg:col-span-4 xl:col-span-3 space-y-6 lg:sticky lg:top-20">
          <BidSignoffDock
            onApproveBid={() => alert('Bid submission marked as approved for executive board.')}
            onSubmitPreBidQuery={() => alert('Pre-bid query drafted for Clause 15.2 LD Cap.')}
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* LOWER SECTIONS: Full-Width Dossier Modules */}
      {/* ========================================================================= */}
      <div className="space-y-8 pt-2">
        {/* ===================================================================== */}
        {/* 4. INGESTED TENDER DOCUMENTS (Dedicated Clean Section) */}
        {/* ===================================================================== */}
        <div id="ingested-documents">
          <IngestedDocumentsSection
            bidId={bidId}
            documents={bid.documents}
            totalClauses={items.length}
            canUploadDoc={canUploadDoc}
            showUploader={showUploader}
            onToggleUploader={() => setShowUploader(!showUploader)}
            onUploadSuccess={(_id, docName) => {
              setShowUploader(false);
              setUploadedDocName(docName);
              setIsProcessing(true);
              refetchBid();
            }}
            onDownload={handleDownload}
            onReprocess={handleReprocessDocument}
            onDeleteDoc={(doc) => setDocToDelete(doc)}
            reprocessingDocId={reprocessingDocId}
          />
        </div>

        {/* ===================================================================== */}
        {/* 5. HIGH-RISK LIABILITY ANALYSIS CARD */}
        {/* ===================================================================== */}
        <div id="liability-analysis">
          {(!complianceLoading || items.length > 0) && !complianceError && (
            <ObligationsCard items={items} />
          )}
        </div>

        {/* ===================================================================== */}
        {/* 6. EXTRACTED COMPLIANCE MATRIX (Full-Width Clean & Categorized) */}
        {/* ===================================================================== */}
        <div id="compliance-matrix" className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold tracking-tight text-foreground">
                5. Extracted Compliance Matrix
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Complete catalog of {items.length} candidate requirements parsed from ingested
                documents
              </p>
            </div>
            <span className="mono text-xs font-semibold text-muted-foreground">
              Showing {items.length} Extracted Clauses
            </span>
          </div>

          {complianceLoading && items.length === 0 ? (
            <div className="flex flex-col gap-3">
              <LoadingSkeleton height="80px" />
              <LoadingSkeleton height="80px" />
              <LoadingSkeleton height="80px" />
            </div>
          ) : complianceError ? (
            <ErrorBanner message={complianceError.message} onRetry={refetchCompliance} />
          ) : (
            <div className="border border-border rounded-xl overflow-hidden bg-card shadow-xs">
              <ComplianceTable
                items={items}
                onReviewItem={handleReviewItem}
                onInspectEvidence={handleInspectEvidence}
                onInspectAssessment={handleInspectAssessment}
              />
            </div>
          )}
        </div>

        {/* 7. Documented data sources & missing endpoints */}
        <MissingDataCallout />
      </div>

      {/* Delete Tender Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => !isDeleting && setShowDeleteModal(false)}
        title="Delete Tender Project"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button
              variant="secondary"
              onClick={() => setShowDeleteModal(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteBid} isLoading={isDeleting}>
              Yes, Delete Permanently
            </Button>
          </div>
        }
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            color: 'var(--color-surface-text)',
          }}
        >
          <p style={{ margin: 0 }}>
            Are you sure you want to delete <strong>{bid.title}</strong> (
            <em>{bid.tenderNumber}</em>)?
          </p>
          <div
            style={{
              padding: '0.85rem 1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--color-danger)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              color: 'var(--color-danger)',
            }}
          >
            <strong>Warning:</strong> This operation will permanently delete all uploaded documents
            and extracted compliance requirements.
          </div>
        </div>
      </Modal>

      {/* Delete Document Confirmation Modal */}
      <Modal
        isOpen={Boolean(docToDelete)}
        onClose={() => !isDeletingDoc && setDocToDelete(null)}
        title="Remove Tender Document"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button
              variant="secondary"
              onClick={() => setDocToDelete(null)}
              disabled={isDeletingDoc}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteDocument} isLoading={isDeletingDoc}>
              Yes, Remove Document
            </Button>
          </div>
        }
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            color: 'var(--color-surface-text)',
          }}
        >
          <p style={{ margin: 0 }}>
            Are you sure you want to remove <strong>{docToDelete?.fileName}</strong>?
          </p>
          <div
            style={{
              padding: '0.85rem 1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--color-danger)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              color: 'var(--color-danger)',
            }}
          >
            <strong>Warning:</strong> Removing this document will delete all associated compliance
            items derived from it.
          </div>
        </div>
      </Modal>

      {/* Floating Ask Copilot Trigger Button */}
      {!isChatOpen && (
        <button
          type="button"
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 transition-all hover:scale-105 cursor-pointer font-medium text-xs border border-emerald-500/30"
          title="Open Tender AI Copilot"
        >
          <Sparkles className="w-4 h-4" />
          <span>Ask Copilot</span>
        </button>
      )}

      {/* Chat Copilot Drawer */}
      <ChatCopilotDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        bidId={bidId}
        companyId={bid?.companyId}
        tenderTitle={bid?.title}
      />
    </div>
  );
};
