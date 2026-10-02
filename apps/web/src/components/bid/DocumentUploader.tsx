import React, { useState, useRef } from 'react';
import { generateUploadUrl, confirmDocumentUpload } from '../../api/bids.js';
import { Button } from '../common/Button.js';
import { ErrorBanner } from '../common/ErrorBanner.js';

export interface DocumentUploaderProps {
  bidId: string;
  onUploadSuccess: (documentId: string) => void;
}

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  bidId,
  onUploadSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<'NIT' | 'BOQ' | 'CORRIGENDUM' | 'TECHNICAL_SPECS' | 'FINANCIAL_BID'>('NIT');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
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
      setError('Only PDF tender documents are supported.');
      return;
    }

    if (selected.size > 50 * 1024 * 1024) {
      setError('File size exceeds the 50MB limit.');
      return;
    }

    setFile(selected);
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(10);
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
      setUploadProgress(30);

      // 2. Direct S3 Upload via XMLHttpRequest for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'application/pdf');

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percentComplete = 30 + Math.round((e.loaded / e.total) * 50);
            setUploadProgress(percentComplete);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`S3 upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error during file upload to storage.'));
        xhr.send(file);
      });

      setUploadProgress(85);

      // 3. Confirm document upload with backend
      const confirmRes = await confirmDocumentUpload(bidId, { documentId });
      if (!confirmRes.ok) {
        throw new Error(confirmRes.error.message || 'Failed to confirm document upload');
      }

      setUploadProgress(100);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      onUploadSuccess(documentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed unexpectedly');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-card)',
        border: '1px solid var(--color-surface-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
      }}
    >
      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--color-surface-text)' }}>
        Upload Tender Document
      </h3>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          const droppedFile = e.dataTransfer.files?.[0];
          if (droppedFile) validateAndSetFile(droppedFile);
        }}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragOver ? 'var(--color-primary-500)' : 'var(--color-surface-border)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: isDragOver ? 'rgba(99, 102, 241, 0.05)' : 'var(--color-surface-bg)',
          cursor: 'pointer',
          transition: 'all var(--transition-fast)',
          marginBottom: '1rem',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
        <p style={{ fontWeight: 500, color: 'var(--color-surface-text)', marginBottom: '0.25rem' }}>
          {file ? file.name : 'Click to browse or drag and drop tender PDF here'}
        </p>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-surface-muted)' }}>
          {file
            ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
            : 'PDF format only, maximum 50MB per file'}
        </p>
      </div>

      {file && (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label
              htmlFor="doc-type-select"
              style={{
                display: 'block',
                fontSize: '0.8rem',
                color: 'var(--color-surface-muted)',
                marginBottom: '0.35rem',
              }}
            >
              Document Classification:
            </label>
            <select
              id="doc-type-select"
              value={docType}
              onChange={(e) => setDocType(e.target.value as typeof docType)}
              style={{
                width: '100%',
                backgroundColor: 'var(--color-surface-input)',
                color: 'var(--color-surface-text)',
                border: '1px solid var(--color-surface-border)',
                borderRadius: 'var(--radius-md)',
                padding: '0.5rem',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            >
              <option value="NIT">Notice Inviting Tender (NIT)</option>
              <option value="TECHNICAL_SPECS">Technical Specifications</option>
              <option value="BOQ">Bill of Quantities (BOQ)</option>
              <option value="CORRIGENDUM">Corrigendum / Addendum</option>
              <option value="FINANCIAL_BID">Financial Bid Guidelines</option>
            </select>
          </div>

          <div style={{ alignSelf: 'flex-end' }}>
            <Button
              variant="primary"
              onClick={handleUpload}
              isLoading={isUploading}
              disabled={isUploading}
            >
              Upload & Extract Compliance
            </Button>
          </div>
        </div>
      )}

      {isUploading && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-surface-muted)', marginBottom: '0.25rem' }}>
            <span>Uploading document to storage...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div
            style={{
              height: '6px',
              backgroundColor: 'var(--color-surface-bg)',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${uploadProgress}%`,
                backgroundColor: 'var(--color-primary-500)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
