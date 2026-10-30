import React, { useState, useRef } from 'react';
import { generateUploadUrl, confirmDocumentUpload } from '@/api/bids.js';
import { resolveUrl } from '@/api/client.js';
import { Button } from '@/components/common/Button.js';
import { ErrorBanner } from '@/components/common/ErrorBanner.js';
import { Progress } from '@/components/ui/progress.js';
import { cn } from '@/lib/utils.js';
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

  const pick = () => !isUploading && fileInputRef.current?.click();

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-primary bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="mb-1 text-base font-semibold text-foreground">Upload a tender document</h3>
          <p className="text-xs text-muted-foreground">
            Upload the tender notice, technical specifications or BOQ as a PDF to extract its
            requirements.
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

      <fieldset>
        <legend className="mb-1.5 text-xs font-semibold text-foreground">Document type</legend>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(13.75rem,1fr))] gap-2">
          {DOC_TYPES.map((dt) => {
            const selected = docType === dt.value;
            return (
              <button
                key={dt.value}
                type="button"
                aria-pressed={selected}
                disabled={isUploading}
                onClick={() => setDocType(dt.value)}
                className={cn(
                  'rounded-md border px-3.5 py-2.5 text-left transition-colors disabled:cursor-default',
                  selected ? 'border-primary bg-primary/10' : 'border-border bg-background',
                )}
              >
                <span
                  className={cn(
                    'block text-xs font-semibold',
                    selected ? 'text-primary' : 'text-foreground',
                  )}
                >
                  {dt.label}
                </span>
                <span className="mt-0.5 block text-2xs text-muted-foreground">
                  {dt.description}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div
        role="button"
        tabIndex={isUploading ? -1 : 0}
        aria-label={
          file ? `Selected file ${file.name}. Choose another PDF` : 'Choose a PDF to upload'
        }
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={pick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            pick();
          }
        }}
        className={cn(
          'flex flex-col items-center gap-2 rounded-md border-2 border-dashed px-6 py-8 text-center transition-colors',
          isDragOver ? 'border-primary bg-primary/5' : 'border-border bg-background',
          isUploading ? 'cursor-default' : 'cursor-pointer',
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={handleFileChange}
          disabled={isUploading}
        />
        <Upload size={36} className="text-primary/70" />
        {file ? (
          <div>
            <span className="break-all text-sm font-semibold text-foreground">{file.name}</span>
            <span className="block text-xs text-muted-foreground">
              {(file.size / (1024 * 1024)).toFixed(2)} MB · PDF
            </span>
          </div>
        ) : (
          <div>
            <span className="text-sm font-medium text-foreground">
              Drop the tender PDF here, or <span className="text-primary">browse files</span>
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">PDF, up to 50 MB</span>
          </div>
        )}
      </div>

      {isUploading && (
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between gap-3 text-xs">
            <span className="font-medium text-foreground">{uploadMessage}</span>
            <span className="font-semibold tabular-nums text-primary">{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} aria-label="Upload progress" className="h-1.5" />
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {file && !isUploading && (
          <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
            Clear
          </Button>
        )}
        <Button
          variant="primary"
          onClick={handleUpload}
          disabled={!file || isUploading}
          isLoading={isUploading}
        >
          {isUploading ? 'Uploading…' : 'Upload and extract'}
        </Button>
      </div>
    </div>
  );
};
