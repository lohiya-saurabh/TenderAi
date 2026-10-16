import React from 'react';
import { Card } from '@/components/common/Card.js';
import { Button } from '@/components/common/Button.js';
import { CapabilityStatusBadge } from '@/components/company/CapabilityStatusBadge.js';
import { CapabilityEmptyState } from '@/components/company/CapabilityEmptyState.js';
import type { EvidenceVaultItem } from '@/components/company/companyProfileData.js';
import {
  FileText,
  Lock,
  Upload,
  CloudDownload,
  Download,
  Eye,
} from 'lucide-react';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          style={{
            backgroundColor: 'rgba(234, 88, 12, 0.08)',
            border: '1px solid rgba(234, 88, 12, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem 1rem',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-surface-text)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flex: 1,
          }}
        >
          <Lock size={16} className="text-primary shrink-0" />
          <div>
            <strong>Tamper-Proof Evidence Vault</strong>: All source documents are verified with
            SHA-256 cryptographic hashes and automatically attached to qualifying tender bids.
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {evidenceVault.map((doc) => (
            <Card key={doc.id} padding="md">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.25rem',
                    }}
                  >
                    <FileText size={16} className="text-muted-foreground" />
                    <strong
                      style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--color-surface-text)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {doc.fileName}
                    </strong>
                    <CapabilityStatusBadge status={doc.verificationStatus} size="sm" />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '1.25rem',
                      fontSize: 'var(--text-2xs)',
                      color: 'var(--color-surface-muted)',
                      flexWrap: 'wrap',
                    }}
                  >
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
                      <strong style={{ color: 'var(--color-surface-text)' }}>
                        {doc.linkedCapabilitiesCount} Capabilities
                      </strong>
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--text-2xs)',
                      color: 'var(--color-surface-muted)',
                      fontFamily: 'var(--font-mono)',
                      marginTop: '0.35rem',
                    }}
                  >
                    SHA-256: {doc.sha256Hash}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                    Inspect Document ↗
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
