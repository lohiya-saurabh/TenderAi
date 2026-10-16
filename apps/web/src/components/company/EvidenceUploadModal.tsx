import React from 'react';
import { Button } from '@/components/common/Button.js';
import { Modal } from '@/components/common/Modal.js';
import {
  Upload,
  CloudDownload,
  AlertTriangle,
  FileText,
  X,
  ShieldCheck,
} from 'lucide-react';

export interface EvidenceUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  errorMsg: string | null;
  setErrorMsg: (msg: string | null) => void;
  evidenceSource: 'DEVICE' | 'CLOUD';
  setEvidenceSource: (s: 'DEVICE' | 'CLOUD') => void;
  cloudProvider: 'google-drive' | 'onedrive';
  setCloudProvider: (p: 'google-drive' | 'onedrive') => void;
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
  onExecuteCloudImport: () => void;
  renderDynamicFields: () => React.ReactNode;
}

export const EvidenceUploadModal: React.FC<EvidenceUploadModalProps> = ({
  isOpen,
  onClose,
  loading,
  errorMsg,
  setErrorMsg,
  evidenceSource,
  setEvidenceSource,
  cloudProvider,
  setCloudProvider,
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
  onExecuteCloudImport,
  renderDynamicFields,
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={
        evidenceSource === 'DEVICE'
          ? 'Upload Evidence from Local Device'
          : 'Import Evidence from Cloud Storage'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          {evidenceSource === 'DEVICE' ? (
            <Button
              variant="primary"
              onClick={onExecuteDeviceUpload}
              disabled={loading || !deviceFile}
            >
              {loading ? 'Uploading & Processing...' : 'Upload Evidence Document'}
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={onExecuteCloudImport}
              disabled={loading}
            >
              {loading ? 'Importing...' : 'Import Selected File'}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4 text-xs">
        {/* Exactly 2 clean segmented tabs: Device vs Cloud */}
        <div className="flex items-center p-1 bg-muted/60 rounded-lg border border-border gap-1">
          <button
            type="button"
            onClick={() => {
              setEvidenceSource('DEVICE');
              setErrorMsg(null);
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md font-medium text-xs transition-colors cursor-pointer ${
              evidenceSource === 'DEVICE'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Upload size={13} />
            Upload from Device
          </button>
          <button
            type="button"
            onClick={() => {
              setEvidenceSource('CLOUD');
              setErrorMsg(null);
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md font-medium text-xs transition-colors cursor-pointer ${
              evidenceSource === 'CLOUD'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CloudDownload size={13} />
            Cloud Storage
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Cloud Provider Selection (shown only when Cloud Storage tab is selected) */}
        {evidenceSource === 'CLOUD' && (
          <div className="flex flex-col gap-2.5 p-3 rounded-lg border border-border bg-muted/20">
            <label className="font-semibold block text-xs text-foreground">
              Select Connected Cloud Provider
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label
                className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  cloudProvider === 'google-drive'
                    ? 'border-primary bg-primary/5 text-foreground font-medium'
                    : 'border-border bg-background text-muted-foreground hover:border-foreground/30'
                }`}
              >
                <input
                  type="radio"
                  name="cloudProvider"
                  className="accent-primary"
                  checked={cloudProvider === 'google-drive'}
                  onChange={() => setCloudProvider('google-drive')}
                />
                <span>Google Drive Enterprise</span>
              </label>
              <label
                className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  cloudProvider === 'onedrive'
                    ? 'border-primary bg-primary/5 text-foreground font-medium'
                    : 'border-border bg-background text-muted-foreground hover:border-foreground/30'
                }`}
              >
                <input
                  type="radio"
                  name="cloudProvider"
                  className="accent-primary"
                  checked={cloudProvider === 'onedrive'}
                  onChange={() => setCloudProvider('onedrive')}
                />
                <span>OneDrive / SharePoint 365</span>
              </label>
            </div>
          </div>
        )}

        {/* Device PDF Dropzone (shown when Device tab is selected) */}
        {evidenceSource === 'DEVICE' && (
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
                  <div className="font-semibold text-foreground">
                    Click to select PDF or drag and drop here
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Audited Balance Sheets, Completion Certificates, ISO, PAN, GST (Max 50MB PDF)
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
                    <div className="font-semibold text-foreground truncate">
                      {deviceFile.name}
                    </div>
                    <div className="text-[11px] mono text-muted-foreground">
                      {(deviceFile.size / (1024 * 1024)).toFixed(2)} MB · PDF Document
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
        )}

        {/* Evidence Document Classification Dropdown */}
        <div>
          <label className="font-semibold block mb-1 text-foreground">
            Document Classification *
          </label>
          <select
            value={evidenceType}
            onChange={(e) => setEvidenceType(e.target.value)}
            className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="AUDITED_BALANCE_SHEET">Audited Balance Sheet / Financial Statement</option>
            <option value="COMPLETION_CERT">Client Project Completion Certificate / Work Completion</option>
            <option value="WORK_ORDER">Work Order / Letter of Award (LOA) / Contract Agreement</option>
            <option value="ISO_CERT">ISO Quality, Environmental & Safety Certificate</option>
            <option value="GST_REG">GST Registration Certificate (Form REG-06)</option>
            <option value="PAN_CARD">Permanent Account Number (PAN Card)</option>
            <option value="INCORPORATION_CERT">Certificate of Incorporation (MCA / CIN)</option>
            <option value="UDYAM_CERT">MSME Udyam Registration Certificate</option>
            <option value="OEM_MAF">Manufacturer Authorization Form (OEM MAF)</option>
            <option value="OTHER">Other Statutory Credential / Tender Document</option>
          </select>
        </div>

        {/* Dynamic Contextual Fields tailored to Document Classification */}
        <div className="p-3.5 rounded-lg border border-border/80 bg-muted/20 flex flex-col gap-3">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Document Attributes & Metadata
          </div>
          {renderDynamicFields()}
        </div>

        {/* Cryptographic Hash & Zero-Trust Notice */}
        <div className="p-2.5 rounded-md bg-muted/40 border border-border text-[11px] text-muted-foreground flex items-center gap-2">
          <ShieldCheck size={16} className="text-primary shrink-0" />
          <span>
            Document will be cryptographically anchored with SHA-256 and stored in isolated tenant storage. Extracted statutory attributes are automatically indexed for Bid/No-Bid eligibility scoring.
          </span>
        </div>
      </div>
    </Modal>
  );
};
