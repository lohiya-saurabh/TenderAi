import React from 'react';
import { Drawer } from '@/components/common/Drawer.js';
import { Button } from '@/components/common/Button.js';
import { CapabilityStatusBadge } from '@/components/company/CapabilityStatusBadge.js';
import type { EvidenceVaultItem } from '@/components/company/companyProfileData.js';
import {
  FileText,
  Download,
  ExternalLink,
  Lock,
  Loader2,
} from 'lucide-react';

export interface EvidencePreviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeDocTitle: string | null;
  matchedDoc?: EvidenceVaultItem;
  previewUrl: string | null;
  isPreviewLoading: boolean;
  downloadingDocId: string | null;
  onDownloadEvidence: (docOrId: EvidenceVaultItem | string) => Promise<void>;
}

export const EvidencePreviewDrawer: React.FC<EvidencePreviewDrawerProps> = ({
  isOpen,
  onClose,
  activeDocTitle,
  matchedDoc,
  previewUrl,
  isPreviewLoading,
  downloadingDocId,
  onDownloadEvidence,
}) => {
  if (!isOpen) return null;

  return (
    <Drawer
      isOpen={true}
      onClose={onClose}
      title="Evidence Document Verification"
      description={activeDocTitle || undefined}
      width="780px"
      footer={
        <div className="flex items-center justify-between w-full gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close Viewer
          </Button>
          <div className="flex items-center gap-2">
            {previewUrl && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.open(previewUrl, '_blank')}
                icon={<ExternalLink size={13} />}
              >
                Open in New Tab
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={() => onDownloadEvidence(matchedDoc || activeDocTitle || '')}
              isLoading={downloadingDocId === (matchedDoc?.id || activeDocTitle)}
              icon={<Download size={13} />}
            >
              Download Original PDF
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Metadata Summary Card */}
        <div className="bg-background border border-border rounded-lg p-3.5 flex flex-col gap-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-muted-foreground shrink-0" />
              <span className="font-mono font-semibold text-foreground break-all">
                {activeDocTitle}
              </span>
            </div>
            <CapabilityStatusBadge
              status={matchedDoc?.verificationStatus || 'VERIFIED'}
              size="sm"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px] text-muted-foreground">
            <div>
              <span className="block text-[10px] uppercase font-mono tracking-wider text-muted-foreground/80">
                Document Type
              </span>
              <span className="font-medium text-foreground">
                {matchedDoc?.docType || 'Statutory Evidence'}
              </span>
            </div>
            {matchedDoc?.issuer && (
              <div>
                <span className="block text-[10px] uppercase font-mono tracking-wider text-muted-foreground/80">
                  Issuing Authority
                </span>
                <span className="font-medium text-foreground truncate block">
                  {matchedDoc.issuer}
                </span>
              </div>
            )}
            {matchedDoc?.referenceNumber && (
              <div>
                <span className="block text-[10px] uppercase font-mono tracking-wider text-muted-foreground/80">
                  Reference / Reg №
                </span>
                <span className="font-mono font-medium text-foreground">
                  {matchedDoc.referenceNumber}
                </span>
              </div>
            )}
            {(matchedDoc?.validFrom || matchedDoc?.validTo) && (
              <div>
                <span className="block text-[10px] uppercase font-mono tracking-wider text-muted-foreground/80">
                  Validity Period
                </span>
                <span className="font-medium text-foreground">
                  {matchedDoc.validFrom ? `${matchedDoc.validFrom} to ` : ''}
                  {matchedDoc.validTo || 'Permanent / Ongoing'}
                </span>
              </div>
            )}
            {matchedDoc?.fileSizeBytes && (
              <div>
                <span className="block text-[10px] uppercase font-mono tracking-wider text-muted-foreground/80">
                  File Size
                </span>
                <span className="font-medium text-foreground">
                  {matchedDoc.fileSizeBytes < 1024 * 1024
                    ? `${(matchedDoc.fileSizeBytes / 1024).toFixed(1)} KB`
                    : `${(matchedDoc.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`}
                </span>
              </div>
            )}
            {matchedDoc?.uploadedAt && (
              <div>
                <span className="block text-[10px] uppercase font-mono tracking-wider text-muted-foreground/80">
                  Ingestion Timestamp
                </span>
                <span className="font-medium text-foreground">
                  {new Date(matchedDoc.uploadedAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {matchedDoc?.sha256Hash && (
            <div className="pt-2 border-t border-border/50 text-[10px] font-mono text-muted-foreground flex items-center gap-1.5 overflow-hidden">
              <Lock size={11} className="shrink-0 text-muted-foreground/80" />
              <span className="shrink-0">SHA-256:</span>
              <span className="truncate">{matchedDoc.sha256Hash}</span>
            </div>
          )}

          {/* Extracted Statutory Attributes */}
          {matchedDoc?.extractedAttributes &&
            Object.keys(matchedDoc.extractedAttributes).length > 0 && (
              <div className="pt-2 border-t border-border/50 flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] uppercase font-mono text-muted-foreground shrink-0 mr-1">
                  Extracted:
                </span>
                {Object.entries(matchedDoc.extractedAttributes)
                  .filter(([, v]) => v !== null && v !== undefined && v !== '')
                  .slice(0, 6)
                  .map(([k, v]) => (
                    <span
                      key={k}
                      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-muted/60 text-foreground font-mono"
                    >
                      {k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                    </span>
                  ))}
              </div>
            )}
        </div>

        {/* Document Viewer Canvas / Iframe */}
        <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col min-h-[500px]">
          {isPreviewLoading ? (
            <div className="flex flex-col items-center justify-center p-16 gap-3 text-muted-foreground flex-1">
              <Loader2 size={32} className="animate-spin text-foreground" />
              <span className="text-xs font-medium">Loading authentic document stream...</span>
              <span className="text-[11px] text-muted-foreground/80">
                Resolving cryptographic checksum and digital scan
              </span>
            </div>
          ) : previewUrl ? (
            <iframe
              src={previewUrl}
              title={`Preview of ${activeDocTitle}`}
              className="w-full h-[520px] border-none bg-background"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-12 gap-3 text-muted-foreground flex-1">
              <FileText size={40} className="text-muted-foreground/60" />
              <span className="text-xs font-semibold text-foreground">
                Direct in-browser preview unavailable
              </span>
              <p className="text-[11px] text-muted-foreground text-center max-w-sm">
                You can still download or open the original verified statutory document securely.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => onDownloadEvidence(matchedDoc || activeDocTitle || '')}
                icon={<Download size={13} />}
              >
                Download Document
              </Button>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
};
