import React from 'react';
import type { BidDocument } from '@/api/bids.js';
import { formatFileSize } from '@/utils/formatFileSize.js';
import { DocumentUploader } from '@/components/bid/DocumentUploader.js';
import { Plus, RefreshCw, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button.js';

export interface IngestedDocumentsSectionProps {
  bidId: string;
  documents?: BidDocument[];
  canUploadDoc: boolean;
  showUploader: boolean;
  onToggleUploader: () => void;
  onUploadSuccess: (documentId: string, docName: string) => void;
  onDownload: (documentId: string) => void;
  onReprocess: (doc: BidDocument) => void;
  onDeleteDoc: (doc: BidDocument) => void;
  reprocessingDocId: string | null;
}

export const IngestedDocumentsSection: React.FC<IngestedDocumentsSectionProps> = ({
  bidId,
  documents = [],
  canUploadDoc,
  showUploader,
  onToggleUploader,
  onUploadSuccess,
  onDownload,
  onReprocess,
  onDeleteDoc,
  reprocessingDocId,
}) => {
  return (
    <section className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight text-foreground">
            2. Ingested Tender Documents
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Extracted via Docling Document Intelligence Pipeline with cryptographic SHA-256
            integrity
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-muted-foreground">
            {documents.length} Document{documents.length === 1 ? '' : 's'} Processed
          </span>

          {canUploadDoc && (
            <Button
              type="button"
              variant={showUploader ? 'secondary' : 'outline'}
              size="sm"
              onClick={onToggleUploader}
              className="gap-1.5 text-xs font-medium h-8 border-border"
            >
              <Plus className="h-3.5 w-3.5" />
              {showUploader ? 'Close Uploader' : 'Add Document'}
            </Button>
          )}
        </div>
      </div>

      {/* Uploader Box if toggled */}
      {showUploader && (
        <div className="border border-border rounded-lg p-5 bg-card shadow-xs">
          <DocumentUploader
            bidId={bidId}
            onCancel={onToggleUploader}
            onUploadSuccess={onUploadSuccess}
          />
        </div>
      )}

      {/* Empty State */}
      {documents.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-8 bg-card text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            No tender documents uploaded yet. Upload a Notice Inviting Tender (NIT) or RFP PDF to
            start extraction.
          </p>
          {canUploadDoc && !showUploader && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onToggleUploader}
              className="gap-1.5 text-xs font-medium border-border"
            >
              <Plus className="h-3.5 w-3.5" />
              Upload Initial Tender Document
            </Button>
          )}
        </div>
      ) : (
        /* Ingested Document Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {documents.map((doc) => {
            const isCompleted = doc.status === 'COMPLETED';
            const isProcessing =
              doc.status === 'PROCESSING' || doc.status === 'QUEUED_FOR_EXTRACTION';

            return (
              <div
                key={doc.id}
                className="border border-border rounded-lg p-4 bg-card shadow-xs flex flex-col justify-between gap-3 hover:border-border-strong transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded border border-border bg-muted/40 text-foreground flex items-center justify-center font-bold text-xs shrink-0">
                      PDF
                    </div>
                    <div className="min-w-0">
                      <div
                        className="font-bold text-xs text-foreground truncate"
                        title={doc.fileName}
                      >
                        {doc.fileName}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {doc.documentType === 'NIT'
                          ? 'Notice Inviting Tender'
                          : doc.documentType === 'TECHNICAL_SPECS'
                            ? 'Technical Specifications'
                            : doc.documentType === 'BOQ'
                              ? 'Bill of Quantities'
                              : doc.documentType === 'CORRIGENDUM'
                                ? 'Tender Corrigendum'
                                : 'Financial Bid'}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded border shrink-0 ${
                      isCompleted
                        ? 'bg-primary/10 text-[#1C3DA8] dark:text-blue-300 border-transparent'
                        : isProcessing
                          ? 'bg-[#FFF1E0] text-[#8A4200] dark:bg-orange-500/10 dark:text-orange-300 border-[#F3C48B] animate-pulse'
                          : 'bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {doc.status}
                  </span>
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between text-[11px] ">
                  <span className="text-muted-foreground">{formatFileSize(doc.fileSizeBytes)}</span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onDownload(doc.id)}
                      className="text-foreground font-semibold underline hover:text-vermilion transition-colors flex items-center gap-1 cursor-pointer"
                      title="Download PDF"
                    >
                      <Download className="h-3 w-3" />
                      <span>Download</span>
                    </button>

                    {canUploadDoc && (
                      <button
                        type="button"
                        onClick={() => onReprocess(doc)}
                        disabled={reprocessingDocId === doc.id || isProcessing}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-accent cursor-pointer disabled:opacity-50"
                        title="Reprocess with Docling"
                      >
                        <RefreshCw
                          className={`h-3 w-3 ${reprocessingDocId === doc.id ? 'animate-spin' : ''}`}
                        />
                      </button>
                    )}

                    {canUploadDoc && (
                      <button
                        type="button"
                        onClick={() => onDeleteDoc(doc)}
                        className="text-destructive/80 hover:text-destructive transition-colors p-1 rounded hover:bg-destructive/10 cursor-pointer"
                        title="Delete document"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
