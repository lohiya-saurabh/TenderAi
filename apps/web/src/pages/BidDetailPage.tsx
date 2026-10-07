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
} from '../api/bids.js';
import { listComplianceItems, reviewComplianceItem, type ComplianceItem } from '../api/compliance.js';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../auth/useAuth.js';
import { PERMISSIONS } from '../utils/permissions.js';
import { formatDate } from '../utils/formatDate.js';
import { formatFileSize } from '../utils/formatFileSize.js';
import { Button } from '../components/common/Button.js';
import { ErrorBanner } from '../components/common/ErrorBanner.js';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton.js';
import { Modal } from '../components/common/Modal.js';
import { PlusCircleIcon, ChevronRightIcon } from '../components/common/Icons.js';
import { DocumentUploader } from '../components/bid/DocumentUploader.js';
import { ExtractionProgress } from '../components/progress/ExtractionProgress.js';
import { ComplianceTable } from '../components/compliance/ComplianceTable.js';
import { TenderInfoHeader } from '../components/bid/detail/TenderInfoHeader.js';
import { BidVerdictCard } from '../components/bid/detail/BidVerdictCard.js';
import { ObligationsCard } from '../components/bid/detail/ObligationsCard.js';
import { ReviewNeededCard } from '../components/bid/detail/ReviewNeededCard.js';
import { ReadinessCard } from '../components/bid/detail/ReadinessCard.js';
import { MissingDataCallout } from '../components/bid/detail/MissingDataCallout.js';
// ProvenanceDrawer removed - new ComplianceTable has built-in SourceCitationDrawer
import { mapApiDecisionToBidDecision, type ApiBidDecisionSummary } from '../components/bid/detail/bidDetailData.js';

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

  // Fetch Bid details
  const fetchBid = useCallback(() => getBid(bidId), [bidId]);
  const { data: bid, isLoading: bidLoading, error: bidError, refetch: refetchBid } = useApi<BidDetail>(fetchBid, [bidId]);

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
      const title = (item as any).title || item.requirement || '';
      const key = `${(item.category || '').toLowerCase()}:${title.trim().toLowerCase().replace(/\s+/g, ' ')}`;
      if (seenKeys.has(key)) continue;
      seenIds.add(item.id);
      seenKeys.add(key);
      result.push(item);
    }
    return result;
  }, [complianceItems]);

  // Fetch Bid Decision
  const [decision, setDecision] = useState<ReturnType<typeof mapApiDecisionToBidDecision> | null>(null);
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

  // Fetch decision when bid loads
  React.useEffect(() => {
    if (bid) {
      fetchDecision();
    }
  }, [bid, fetchDecision]);

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
  const handleInspectEvidence = useCallback((item: ComplianceItem) => {
    // Navigate to the detailed review page for evidence inspection
    window.open(`/bids/${bidId}/compliance/${item.id}`, '_blank');
  }, [bidId]);

  const handleInspectAssessment = useCallback((item: ComplianceItem) => {
    // Navigate to the detailed review page for assessment inspection
    window.open(`/bids/${bidId}/compliance/${item.id}`, '_blank');
  }, [bidId]);

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
  // Loading state
  // -------------------------------------------------------------------------
  if (bidLoading) {
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
        <ErrorBanner
          message={bidError?.message || 'Bid project not found.'}
          onRetry={refetchBid}
        />
      </div>
    );
  }



  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <Link to="/bids" style={{ color: 'var(--color-surface-muted)', fontSize: '0.9rem' }}>
          ← Back to Bids Dashboard
        </Link>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {canViewAudit && (
            <Link to={`/bids/${bidId}/audit`}>
              <Button variant="secondary" size="sm">
                Audit Trail
              </Button>
            </Link>
          )}
          {canUploadDoc && (
            <Button
              variant={showUploader ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => setShowUploader(!showUploader)}
              icon={<PlusCircleIcon size={14} />}
            >
              {showUploader ? 'Close Uploader' : 'Upload Document'}
            </Button>
          )}
          {canUploadDoc && (
            <Button
              variant={decisionLoading ? 'secondary' : 'primary'}
              size="sm"
              onClick={handleReevaluate}
              disabled={decisionLoading}
              icon={<ChevronRightIcon size={14} />}
            >
              {decisionLoading ? 'Evaluating…' : 'Re-evaluate'}
            </Button>
          )}
          {canDeleteBid && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowDeleteModal(true)}
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
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-surface-bg)',
            color: 'var(--color-surface-text)',
          }}
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
          }}
          onRetry={() => {
            setIsProcessing(true);
            refetchBid();
          }}
        />
      )}

      {/* 1. Tender information — organization, deadline, status */}
      <TenderInfoHeader bid={bid} />

      {/* 2. Bid recommendation — "Should I bid on this tender?" */}
      <BidVerdictCard bid={bid} complianceItems={items} decision={decision} />

      {/* 3. Key requirements & compliance */}
      <div>
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-surface-text)', margin: '0 0 0.25rem 0' }}>
            Key Requirements &amp; Compliance
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-surface-muted)', margin: 0 }}>
            Requirements extracted from the tender documents. Review each clause, inspect its
            grounded citation, and track statutory execution rules.
          </p>
        </div>

        {complianceLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <LoadingSkeleton height="80px" />
            <LoadingSkeleton height="80px" />
            <LoadingSkeleton height="80px" />
          </div>
        ) : complianceError ? (
          <ErrorBanner message={complianceError.message} onRetry={refetchCompliance} />
        ) : (
          <ComplianceTable
            items={items}
            onReviewItem={handleReviewItem}
            onInspectEvidence={handleInspectEvidence}
            onInspectAssessment={handleInspectAssessment}
          />
        )}
      </div>

      {/* 4. Risks & missing information */}
      {!complianceLoading && !complianceError && (
        <ObligationsCard items={items} />
      )}

      {/* 5. Review tasks */}
      {!complianceLoading && !complianceError && (
        <ReviewNeededCard items={items} />
      )}

      {/* 6. Bid readiness */}
      {!complianceLoading && !complianceError && (
        <ReadinessCard bid={bid} items={items} />
      )}

      {/* 7. Tender document package */}
      <div
        style={{
          backgroundColor: 'var(--color-surface-card)',
          border: '1px solid var(--color-surface-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--color-surface-text)', margin: 0 }}>
            Tender Document Package ({bid.documents?.length || 0})
          </h3>
          {!showUploader && canUploadDoc && (
            <Button variant="secondary" size="sm" onClick={() => setShowUploader(true)} icon={<PlusCircleIcon size={14} />}>
              Add Document
            </Button>
          )}
        </div>

        {showUploader && (
          <DocumentUploader
            bidId={bidId}
            onCancel={() => setShowUploader(false)}
            onUploadSuccess={(_documentId, docName) => {
              setShowUploader(false);
              setUploadedDocName(docName);
              setIsProcessing(true);
              refetchBid();
            }}
          />
        )}

        {(!bid.documents || bid.documents.length === 0) ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--color-surface-muted)', margin: 0 }}>
            No tender documents uploaded yet. Upload a Notice Inviting Tender (NIT) PDF above to begin extraction.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {bid.documents.map((doc) => (
              <div
                key={doc.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--color-surface-bg)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-surface-border)',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 'var(--text-2xs)',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--color-primary-400)',
                      backgroundColor: 'rgba(99, 102, 241, 0.1)',
                      border: '1px solid rgba(99, 102, 241, 0.25)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.2rem 0.45rem',
                      letterSpacing: '0.04em',
                      flexShrink: 0,
                    }}
                  >
                    {doc.documentType}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-surface-text)', wordBreak: 'break-word' }}>
                      {doc.fileName}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-surface-muted)' }}>
                      {formatFileSize(doc.fileSizeBytes)} • Uploaded {formatDate(doc.uploadedAt)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-surface-muted)' }}>
                    {doc.status.replace(/_/g, ' ')}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => handleDownload(doc.id)}>
                    Download
                  </Button>
                  {canUploadDoc && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleReprocessDocument(doc)}
                      disabled={reprocessingDocId !== null || doc.status === 'PROCESSING' || doc.status === 'QUEUED_FOR_EXTRACTION'}
                    >
                      {reprocessingDocId === doc.id ? 'Queueing…' : 'Reprocess'}
                    </Button>
                  )}
                  {canUploadDoc && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setDocToDelete(doc)}
                      title="Delete document"
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 8. Documented data sources & missing endpoints */}
      <MissingDataCallout />

      {/* Delete Tender Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => !isDeleting && setShowDeleteModal(false)}
        title="Delete Tender Project"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteBid} isLoading={isDeleting}>
              Yes, Delete Permanently
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', color: 'var(--color-surface-text)' }}>
          <p style={{ margin: 0 }}>
            Are you sure you want to delete <strong>{bid.title}</strong> (<em>{bid.tenderNumber}</em>)?
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
            <strong>Warning:</strong> This operation will permanently delete all uploaded documents and extracted compliance requirements.
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
            <Button variant="secondary" onClick={() => setDocToDelete(null)} disabled={isDeletingDoc}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteDocument} isLoading={isDeletingDoc}>
              Yes, Remove Document
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', color: 'var(--color-surface-text)' }}>
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
            <strong>Warning:</strong> Removing this document will delete all associated compliance items derived from it.
          </div>
        </div>
      </Modal>
    </div>
  );
};
