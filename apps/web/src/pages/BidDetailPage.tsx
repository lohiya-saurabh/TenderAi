import React, { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getBid, getDocumentDownloadUrl, type BidDetail } from '../api/bids.js';
import { listComplianceItems, reviewComplianceItem, type ComplianceItem } from '../api/compliance.js';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../auth/useAuth.js';
import { PERMISSIONS } from '../utils/permissions.js';
import { formatCurrency } from '../utils/formatCurrency.js';
import { formatDate } from '../utils/formatDate.js';
import { BidStatusBadge } from '../components/bid/BidStatusBadge.js';
import { DocumentUploader } from '../components/bid/DocumentUploader.js';
import { ComplianceTable } from '../components/compliance/ComplianceTable.js';
import { ExtractionProgress } from '../components/progress/ExtractionProgress.js';
import { StatusBadge } from '../components/common/StatusBadge.js';
import { Button } from '../components/common/Button.js';
import { ErrorBanner } from '../components/common/ErrorBanner.js';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton.js';

export const BidDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const bidId = id || '';

  const { hasPermission } = useAuth();
  const canUploadDoc = hasPermission(PERMISSIONS.DOCUMENTS_UPLOAD);
  const canViewAudit = hasPermission(PERMISSIONS.AUDIT_READ);

  const [showUploader, setShowUploader] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

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

  // Review Item handler
  const handleReviewItem = async (
    itemId: string,
    status: 'READY' | 'FLAGGED' | 'WAIVED',
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
      // Revert on failure
      refetchCompliance();
    } else {
      refetchBid();
    }
  };

  if (bidLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <LoadingSkeleton height="60px" />
        <LoadingSkeleton height="200px" />
        <LoadingSkeleton height="350px" />
      </div>
    );
  }

  if (bidError || !bid) {
    return (
      <ErrorBanner
        message={bidError?.message || 'Bid project not found.'}
        onRetry={refetchBid}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Back and Header info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/bids" style={{ color: 'var(--color-surface-muted)', fontSize: '0.9rem' }}>
            ← Back to Bids Dashboard
          </Link>
          {canViewAudit && (
            <Link to={`/bids/${bidId}/audit`}>
              <Button variant="secondary" size="sm" icon={<span>📜</span>}>
                View Audit Trail
              </Button>
            </Link>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-surface-text)' }}>
                {bid.title}
              </h2>
              <BidStatusBadge status={bid.status} />
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: 'var(--color-surface-muted)', flexWrap: 'wrap' }}>
              <div>
                <strong>Tender Ref:</strong> {bid.tenderNumber}
              </div>
              <div>
                <strong>Authority:</strong> {bid.tenderingAuthority}
              </div>
              <div>
                <strong>Est. Value:</strong>{' '}
                {bid.estimatedValueRupees != null ? formatCurrency(bid.estimatedValueRupees) : '—'}
              </div>
              <div>
                <strong>Deadline:</strong>{' '}
                {bid.submissionDeadline ? formatDate(bid.submissionDeadline) : '—'}
              </div>
            </div>
          </div>

          {canUploadDoc && (
            <Button
              variant={showUploader ? 'secondary' : 'primary'}
              onClick={() => setShowUploader(!showUploader)}
              icon={<span>📄</span>}
            >
              {showUploader ? 'Close Uploader' : 'Upload Tender Document'}
            </Button>
          )}
        </div>
      </div>

      {actionError && <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} />}

      {/* Uploader Section */}
      {showUploader && (
        <DocumentUploader
          bidId={bidId}
          onUploadSuccess={() => {
            setShowUploader(false);
            setIsProcessing(true);
            refetchBid();
          }}
        />
      )}

      {/* Real-time SSE Extraction Progress */}
      {(isProcessing || bid.status === 'ANALYZING') && (
        <ExtractionProgress
          bidId={bidId}
          onComplete={() => {
            setIsProcessing(false);
            refetchBid();
            refetchCompliance();
          }}
        />
      )}

      {/* Uploaded Documents List */}
      <div
        style={{
          backgroundColor: 'var(--color-surface-card)',
          border: '1px solid var(--color-surface-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
        }}
      >
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-surface-text)', marginBottom: '1rem' }}>
          Tender Documents ({bid.documents?.length || 0})
        </h3>

        {(!bid.documents || bid.documents.length === 0) ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--color-surface-muted)' }}>
            No documents uploaded yet. Upload a Notice Inviting Tender (NIT) PDF to initiate analysis.
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
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>📄</span>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-surface-text)' }}>
                      {doc.fileName}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-surface-muted)' }}>
                      {doc.documentType} • {(doc.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB •{' '}
                      Uploaded {formatDate(doc.uploadedAt)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <StatusBadge status={doc.status} size="sm" />
                  <Button variant="ghost" size="sm" onClick={() => handleDownload(doc.id)}>
                    Download ⬇
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compliance Matrix Table */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-surface-text)' }}>
              Compliance Requirements & Grounded Citations
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-surface-muted)' }}>
              Deterministic statutory verification with verbatim source references.
            </p>
          </div>
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
            items={complianceItems || []}
            onReviewItem={handleReviewItem}
          />
        )}
      </div>
    </div>
  );
};
