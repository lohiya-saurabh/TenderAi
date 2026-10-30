import React from 'react';
import { Card } from '@/components/common/Card.js';
import { Button } from '@/components/common/Button.js';
import { CapabilityStatusBadge } from '@/components/company/CapabilityStatusBadge.js';
import { CapabilityEmptyState } from '@/components/company/CapabilityEmptyState.js';
import type { EvidenceVaultItem } from '@/components/company/companyProfileData.js';
import { FileText, Lock, Upload, CloudDownload, Download, Eye } from 'lucide-react';

export interface EvidenceVaultSectionProps {
  evidenceVault: EvidenceVaultItem[];
  onUploadEvidence?: () => void;
  onImportCloud?: () => void;
  onSelectDocPreview: (fileName: string) => void;
  onDownloadEvidence: (doc: EvidenceVaultItem) => Promise<void>;
  downloadingDocId: string | null;
}

export const EvidenceVaultSection: React.FC<EvidenceVaultSectionProps> = ({
  evidenceVault,
  onUploadEvidence,
  onImportCloud,
  onSelectDocPreview,
  onDownloadEvidence,
  downloadingDocId,
}) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-md border border-primary/25 bg-primary/10 px-4 py-3.5 text-xs text-foreground">
          <Lock size={16} className="text-primary shrink-0" />
          <div>
            Each document is stored with its SHA-256 hash, so you can show it has not changed since
            upload.
          </div>
        </div>

        {(onUploadEvidence || onImportCloud) && (
          <div className="flex items-center gap-2 shrink-0">
            {onUploadEvidence && (
              <Button
                variant="primary"
                size="sm"
                onClick={onUploadEvidence}
                icon={<Upload size={13} />}
              >
                Upload Document
              </Button>
            )}
            {onImportCloud && (
              <Button
                variant="outline"
                size="sm"
                onClick={onImportCloud}
                icon={<CloudDownload size={13} />}
              >
                Import Drive
              </Button>
            )}
          </div>
        )}
      </div>

      {evidenceVault.length === 0 ? (
        <CapabilityEmptyState
          icon={FileText}
          title="No Evidence Documents Yet"
          description="Upload your audited financials, completion certificates, work orders, or ISO certifications from your device or cloud storage to qualify for tender eligibility scoring."
          actionLabel="Upload Document from Device"
          onAction={onUploadEvidence}
          actionIcon="upload"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {evidenceVault.map((doc) => (
            <Card key={doc.id} padding="md">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <FileText size={16} className="text-muted-foreground" />
                    <strong className="break-all text-sm text-foreground">{doc.fileName}</strong>
                    <CapabilityStatusBadge status={doc.verificationStatus} size="sm" />
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-2xs text-muted-foreground">
                    <span>
                      Type: <strong>{doc.docType}</strong>
                    </span>
                    <span>
                      Size:{' '}
                      <strong>
                        {doc.fileSizeBytes < 1024 * 1024
                          ? `${(doc.fileSizeBytes / 1024).toFixed(1)} KB`
                          : `${(doc.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`}
                      </strong>
                    </span>
                    <span>
                      Uploaded: <strong>{new Date(doc.uploadedAt).toLocaleDateString()}</strong>
                    </span>
                    <span>
                      Reused across:{' '}
                      <strong className="text-foreground">
                        {doc.linkedCapabilitiesCount} capabilities
                      </strong>
                    </span>
                  </div>
                  <div className="mt-1.5 break-all font-mono text-2xs text-muted-foreground">
                    SHA-256: {doc.sha256Hash}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onDownloadEvidence(doc)}
                    isLoading={downloadingDocId === doc.id}
                    icon={<Download size={13} />}
                    title={`Download ${doc.fileName}`}
                  >
                    Download
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onSelectDocPreview(doc.fileName)}
                    icon={<Eye size={13} />}
                  >
                    Preview
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
