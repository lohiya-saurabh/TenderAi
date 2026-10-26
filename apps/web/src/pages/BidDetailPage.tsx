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
import { listComplianceItems, type ComplianceItem } from '@/api/compliance.js';
import { useApi } from '@/hooks/useApi.js';
import { useAuth } from '@/auth/useAuth.js';
import { PERMISSIONS } from '@/utils/permissions.js';
import { Button } from '@/components/common/Button.js';
import { ErrorBanner } from '@/components/common/ErrorBanner.js';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton.js';
import { Modal } from '@/components/common/Modal.js';
import { PlusCircleIcon } from '@/components/common/Icons.js';
import { ExtractionProgress } from '@/components/progress/ExtractionProgress.js';
import { BidVerdictCard } from '@/components/bid/detail/BidVerdictCard.js';
import { ObligationsCard } from '@/components/bid/detail/ObligationsCard.js';
import { IngestedDocumentsSection } from '@/components/bid/detail/IngestedDocumentsSection.js';
import {
  mapApiDecisionToBidDecision,
  type ApiBidDecisionSummary,
} from '@/components/bid/detail/bidDetailData.js';
import { Sparkles } from 'lucide-react';
import { ChatCopilotDrawer } from '@/components/chat/index.js';
import type { BidClauseSummary } from '@tenderpulse/shared-types';
import { getClauseSummary } from '@/api/clauses.js';
import {
  AttentionTiles,
  BidOverviewHeader,
  DeadlineTimeline,
  KeyFacts,
  MoneyAtStake,
} from '@/components/bid/overview/BidOverview.js';
import { useSetBidBreadcrumbTitle } from '@/components/layout/BreadcrumbTitle.js';

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
 * inline per section.
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
    error: complianceError,
    refetch: refetchCompliance,
  } = useApi<ComplianceItem[]>(fetchCompliance, [bidId]);

  useSetBidBreadcrumbTitle(bidId, bid?.title);

  // Clause summary: review progress, attention counts, amounts and deadlines
  const fetchSummary = useCallback(() => getClauseSummary(bidId), [bidId]);
  const {
    data: summary,
    error: summaryError,
    refetch: refetchSummary,
  } = useApi<BidClauseSummary>(fetchSummary, [bidId]);

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
      refetchSummary();
    }, 10000);

    return () => clearInterval(interval);
  }, [hasInFlightProcessing, refetchBid, refetchCompliance, refetchSummary]);

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
        <ErrorBanner message={bidError?.message || 'Bid project not found.'} onRetry={refetchBid} />
      </div>
    );
  }

  const actionButton =
    'inline-flex items-center gap-1.5 min-h-10 rounded-lg border border-[#C9D0DA] bg-card px-3.5 text-[13px] font-semibold text-foreground no-underline hover:border-primary dark:border-white/20';

  const headerActions = (
    <>
      {canViewAudit && (
        <Link to={`/bids/${bidId}/audit`} className={actionButton}>
          Audit trail
        </Link>
      )}
      <button
        type="button"
        onClick={() => setIsChatOpen(!isChatOpen)}
        className={actionButton}
        aria-pressed={isChatOpen}
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        {isChatOpen ? 'Close copilot' : 'Ask copilot'}
      </button>
      {canUploadDoc && (
        <button
          type="button"
          onClick={() => setShowUploader(!showUploader)}
          className={actionButton}
          aria-expanded={showUploader}
        >
          <PlusCircleIcon size={13} />
          {showUploader ? 'Close uploader' : 'Upload document'}
        </button>
      )}
      {canUploadDoc && (
        <button
          type="button"
          onClick={handleReevaluate}
          disabled={decisionLoading}
          className={actionButton}
        >
          {decisionLoading ? 'Evaluating…' : 'Re-evaluate'}
        </button>
      )}
      <Link to={`/bids/${bidId}/checklist`} className={actionButton}>
        Documents checklist
      </Link>
      <Link
        to={`/bids/${bidId}/clauses`}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-primary bg-primary px-3.5 text-[13px] font-semibold text-white no-underline hover:bg-[#1A3698]"
      >
        Open clause workspace{summary ? ` (${summary.clauses})` : ''}
      </Link>
    </>
  );

  return (
    <div className="flex w-full min-w-0 flex-col gap-5">
      {actionError && <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} />}
      {reprocessNotice && (
        <div
          role="status"
          className="rounded-md border border-border bg-muted/60 p-3 text-xs text-foreground"
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
            refetchSummary();
            fetchDecision();
          }}
          onRetry={() => {
            setIsProcessing(true);
            refetchBid();
          }}
        />
      )}

      <BidOverviewHeader bid={bid} summary={summary} actions={headerActions} />

      <div className="flex flex-wrap items-stretch gap-5">
        <KeyFacts bid={bid} verdict={decision?.verdict ?? null} />
        {summary && (
          <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-3">
            <AttentionTiles bidId={bidId} summary={summary} />
            <MoneyAtStake bidId={bidId} summary={summary} />
          </div>
        )}
      </div>

      {summary && <DeadlineTimeline bidId={bidId} summary={summary} />}
      {summaryError && !summary && (
        <ErrorBanner message={`Clause summary unavailable: ${summaryError.message}`} />
      )}
      {complianceError && (
        <ErrorBanner
          message={`Compliance items unavailable: ${complianceError.message}`}
          onRetry={refetchCompliance}
        />
      )}

      <div id="eligibility-verdict">
        <BidVerdictCard bid={bid} complianceItems={items} decision={decision} />
      </div>

      <div id="ingested-documents">
        <IngestedDocumentsSection
          bidId={bidId}
          documents={bid.documents}
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

      <div id="high-risk-liability">
        <ObligationsCard items={items} />
      </div>

      {canDeleteBid && (
        <div className="flex justify-end">
          <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>
            Delete tender
          </Button>
        </div>
      )}

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
