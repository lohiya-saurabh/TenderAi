import React from 'react';
import { Button } from '@/components/common/Button.js';
import { Modal } from '@/components/common/Modal.js';
import { Upload, AlertTriangle, FileText, X, ShieldCheck } from 'lucide-react';

export interface EvidenceUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  errorMsg: string | null;
  deviceFile: File | null;
  setDeviceFile: (f: File | null) => void;
  evidenceType: string;
  setEvidenceType: (t: string) => void;
  isDragOver: boolean;
  setIsDragOver: (d: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleDeviceFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDeviceFileDrop: (e: React.DragEvent) => void;
  onExecuteDeviceUpload: () => void;
  renderDynamicFields: () => React.ReactNode;
}

export const EvidenceUploadModal: React.FC<EvidenceUploadModalProps> = ({
  isOpen,
  onClose,
  loading,
  errorMsg,
  deviceFile,
  setDeviceFile,
  evidenceType,
  setEvidenceType,
  isDragOver,
  setIsDragOver,
  fileInputRef,
  handleDeviceFileChange,
  handleDeviceFileDrop,
  onExecuteDeviceUpload,
  renderDynamicFields,
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Upload evidence"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onExecuteDeviceUpload}
            disabled={loading || !deviceFile}
          >
            {loading ? 'Uploading…' : 'Upload'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-xs">
        {errorMsg && (
          <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* PDF drop zone */}
        <div>
          {!deviceFile ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDeviceFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
                isDragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-foreground/40 bg-muted/10'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleDeviceFileChange}
              />
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="p-2.5 rounded-full bg-primary/10 text-primary">
                  <Upload size={20} />
                </div>
                <div className="font-semibold text-foreground">Choose a PDF or drop it here</div>
                <div className="text-2xs text-muted-foreground">
                  Audited balance sheets, completion certificates, ISO, PAN, GST (max 50MB PDF)
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">
                  <FileText size={20} />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">{deviceFile.name}</div>
                  <div className="text-2xs tabular-nums text-muted-foreground">
                    {(deviceFile.size / (1024 * 1024)).toFixed(2)} MB · PDF
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDeviceFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer"
                title="Remove file"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Evidence Document Classification Dropdown */}
        <div>
          <label className="font-semibold block mb-1 text-foreground">Document type *</label>
          <select
            value={evidenceType}
            onChange={(e) => setEvidenceType(e.target.value)}
            className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="AUDITED_BALANCE_SHEET">
              Audited balance sheet / financial statement
            </option>
            <option value="COMPLETION_CERT">
              Client project completion certificate / work completion
            </option>
            <option value="WORK_ORDER">
              Work order / letter of award (LOA) / contract agreement
            </option>
            <option value="ISO_CERT">ISO quality, environmental & safety certificate</option>
            <option value="GST_REG">GST registration certificate (Form REG-06)</option>
            <option value="PAN_CARD">Permanent account number (PAN card)</option>
            <option value="INCORPORATION_CERT">Certificate of incorporation (MCA / CIN)</option>
            <option value="UDYAM_CERT">MSME Udyam registration certificate</option>
            <option value="OEM_MAF">Manufacturer authorization Form (OEM MAF)</option>
            <option value="OTHER">Other statutory credential / tender document</option>
          </select>
        </div>

        {/* Dynamic Contextual Fields tailored to Document Classification */}
        <div className="p-3.5 rounded-lg border border-border/80 bg-muted/20 flex flex-col gap-3">
          <div className="text-2xs font-semibold text-muted-foreground">Document details</div>
          {renderDynamicFields()}
        </div>

        {/* Cryptographic Hash & Zero-Trust Notice */}
        <div className="p-2.5 rounded-md bg-muted/40 border border-border text-2xs text-muted-foreground flex items-center gap-2">
          <ShieldCheck size={16} className="text-primary shrink-0" />
          <span>
            The document is stored with its SHA-256 hash. Details read from it are used when bids
            are evaluated against your company profile.
          </span>
        </div>
      </div>
    </Modal>
  );
};
