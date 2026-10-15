import React, { useState, useRef } from 'react';
import { generateUploadUrl, confirmDocumentUpload } from '@/api/bids.js';
import { resolveUrl } from '@/api/client.js';
import { Button } from '@/components/common/Button.js';
import { ErrorBanner } from '@/components/common/ErrorBanner.js';
import { ProgressBar } from '@/components/progress/ProgressBar.js';
import { Upload, X } from 'lucide-react';

export interface DocumentUploaderProps {
  bidId: string;
  onUploadSuccess: (documentId: string, docName: string) => void;
  onCancel?: () => void;
}

export type TenderDocType = 'NIT' | 'TECHNICAL_SPECS' | 'BOQ' | 'CORRIGENDUM' | 'FINANCIAL_BID';

interface DocTypeOption {
  value: TenderDocType;
  label: string;
  description: string;
}

const DOC_TYPES: readonly DocTypeOption[] = [
  {
    value: 'NIT',
    label: 'Notice Inviting Tender (NIT)',
    description: 'Core tender notice with eligibility & critical dates',
  },
  {
    value: 'TECHNICAL_SPECS',
    label: 'Technical Specs & SOW',
    description: 'Scope of work, engineering requirements & standards',
  },
  {
    value: 'BOQ',
    label: 'Bill of Quantities (BOQ)',
    description: 'Schedule of rates and item breakdown',
  },
  {
    value: 'CORRIGENDUM',
    label: 'Corrigendum / Addendum',
    description: 'Official amendments, date extensions & clause revisions',
  },
  {
    value: 'FINANCIAL_BID',
    label: 'Financial Bid Guidelines',
    description: 'Price evaluation rules & bank guarantee requirements',
  },
];

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  bidId,
  onUploadSuccess,
  onCancel,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<TenderDocType>('NIT');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadMessage, setUploadMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      validateAndSetFile(selected);
    }
  };

  const validateAndSetFile = (selected: File) => {
    setError(null);
    if (!selected.name.toLowerCase().endsWith('.pdf') && selected.type !== 'application/pdf') {
      setError('Only PDF tender documents are supported for automated extraction.');
      return;
    }

    if (selected.size > 50 * 1024 * 1024) {
      setError('File size exceeds the 50MB limit. For larger files, split by volume.');
      return;
    }

    setFile(selected);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      validateAndSetFile(dropped);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(10);
    setUploadMessage('Requesting secure presigned upload token...');
    setError(null);

    try {
      // 1. Get presigned upload URL from backend
      const presignedRes = await generateUploadUrl(bidId, {
        fileName: file.name,
        sizeBytes: file.size,
        mimeType: file.type || 'application/pdf',
        documentType: docType,
      });

      if (!presignedRes.ok) {
        throw new Error(presignedRes.error.message || 'Failed to generate upload URL');
      }

      const { uploadUrl, documentId } = presignedRes.data;
      setUploadProgress(25);
      setUploadMessage(`Streaming ${file.name} to encrypted tenant storage...`);

      // Determine initial upload target (normalize dummy/unresolved mock domains to local endpoint)
      let targetUploadUrl = uploadUrl;
      const localFallbackEndpoint = `/api/v1/mock-upload/${bidId}/${documentId}/${encodeURIComponent(file.name)}`;
      if (
        targetUploadUrl.includes('mock-s3.tenderpulse.local') ||
        targetUploadUrl.includes('.local/')
      ) {
        targetUploadUrl = localFallbackEndpoint;
      }

      // Helper function to stream upload bytes via XMLHttpRequest for real progress tracking
      const executeUpload = (url: string): Promise<void> => {
        return new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', url);
          xhr.setRequestHeader('Content-Type', file.type || 'application/pdf');

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const percentComplete = 25 + Math.round((e.loaded / e.total) * 55);
              setUploadProgress(percentComplete);
              const mbUploaded = (e.loaded / (1024 * 1024)).toFixed(1);
              const mbTotal = (e.total / (1024 * 1024)).toFixed(1);
              setUploadMessage(
                `Uploading to storage: ${mbUploaded} MB / ${mbTotal} MB (${percentComplete}%)`,
              );
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Storage transfer failed with HTTP status ${xhr.status}`));
            }
          };

          xhr.onerror = () =>
            reject(new Error('Network error during file upload to object storage.'));
          xhr.send(file);
        });
      };

      // 2. Direct Storage Upload to Presigned URL
      await executeUpload(resolveUrl(targetUploadUrl));

      setUploadProgress(85);
      setUploadMessage('Confirming storage checksum and registering with extraction worker...');

      // 3. Confirm document upload with backend
      const confirmRes = await confirmDocumentUpload(bidId, { documentId });
      if (!confirmRes.ok) {
        throw new Error(confirmRes.error.message || 'Failed to confirm document upload');
      }

      setUploadProgress(100);
      setUploadMessage('Document uploaded and dispatched to extraction pipeline!');

      setTimeout(() => {
        onUploadSuccess(documentId, file.name);
      }, 500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed due to network error';
      setError(msg);
      setIsUploading(false);
      setUploadProgress(0);
      setUploadMessage('');
    }
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-card)',
        border: '1px solid var(--color-primary-500)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3
            style={{
              fontSize: 'var(--text-base)',
              fontWeight: 700,
              color: 'var(--color-surface-text)',
              margin: '0 0 0.2rem',
            }}
          >
            Upload Tender Package Document
          </h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)', margin: 0 }}>
            Upload PDF tender notices, technical specs, or BOQ files for automated clause
            extraction.
          </p>
        </div>
        {onCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isUploading}
            icon={<X size={14} />}
          >
            Close
          </Button>
        )}
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Document Type Selector */}
      <div>
        <label
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: 'var(--color-surface-text)',
            display: 'block',
            marginBottom: '0.4rem',
          }}
        >
          Document Classification *
        </label>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '0.5rem',
          }}
        >
          {DOC_TYPES.map((dt) => (
            <button
              key={dt.value}
              type="button"
              disabled={isUploading}
              onClick={() => setDocType(dt.value)}
              style={{
                textAlign: 'left',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor:
                  docType === dt.value ? 'rgba(234, 88, 12, 0.08)' : 'var(--color-surface-bg)',
                border: `1px solid ${docType === dt.value ? 'var(--color-primary-500)' : 'var(--color-surface-border)'}`,
                cursor: isUploading ? 'default' : 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                  color:
                    docType === dt.value ? 'var(--color-primary-500)' : 'var(--color-surface-text)',
                }}
              >
                {dt.label}
              </div>
              <div
                style={{
                  fontSize: 'var(--text-2xs)',
                  color: 'var(--color-surface-muted)',
                  marginTop: '0.15rem',
                }}
              >
                {dt.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragOver ? 'var(--color-primary-500)' : 'var(--color-surface-border)'}`,
          backgroundColor: isDragOver ? 'rgba(234, 88, 12, 0.06)' : 'var(--color-surface-bg)',
          borderRadius: 'var(--radius-md)',
          padding: '2rem 1.5rem',
          textAlign: 'center',
          cursor: isUploading ? 'default' : 'pointer',
          transition: 'all var(--transition-fast)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          style={{ display: 'none' }}
          onChange={handleFileChange}
          disabled={isUploading}
        />
        <Upload size={36} className="text-primary/70" />
        {file ? (
          <div>
            <span
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 700,
                color: 'var(--color-surface-text)',
              }}
            >
              {file.name}
            </span>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-surface-muted)',
                display: 'block',
              }}
            >
              {(file.size / (1024 * 1024)).toFixed(2)} MB • PDF Document
            </span>
          </div>
        ) : (
          <div>
            <span
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--color-surface-text)',
              }}
            >
              Drag & Drop tender PDF here, or{' '}
              <span style={{ color: 'var(--color-primary-400)' }}>browse files</span>
            </span>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-surface-muted)',
                display: 'block',
                marginTop: '0.2rem',
              }}
            >
              Supports PDF documents up to 50MB (Multi-page NIT, Specs, BOQ)
            </span>
          </div>
        )}
      </div>

      {/* Progress Feedback during Byte Transfer */}
      {isUploading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)' }}
          >
            <span style={{ color: 'var(--color-surface-text)', fontWeight: 600 }}>
              {uploadMessage}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: 'var(--color-primary-300)',
              }}
            >
              {uploadProgress}%
            </span>
          </div>
          <ProgressBar progress={uploadProgress} height="6px" />
        </div>
      )}

      {/* Action Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem',
          alignItems: 'center',
        }}
      >
        {file && !isUploading && (
          <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
            Clear Selection
          </Button>
        )}
        <Button
          variant="primary"
          onClick={handleUpload}
          disabled={!file || isUploading}
          isLoading={isUploading}
        >
          {isUploading ? 'Transferring File...' : 'Start Document Upload & Analysis'}
        </Button>
      </div>
    </div>
  );
};
