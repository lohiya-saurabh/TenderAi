import React from 'react';
import { Button } from '@/components/common/Button.js';
import { Modal } from '@/components/common/Modal.js';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { VerificationResult } from '@/api/companies.js';

export interface VerificationActionModalsProps {
  activeModal: 'GSTIN' | 'MCA' | 'UDYAM' | 'DIGILOCKER' | null;
  onClose: () => void;
  loading: boolean;
  inputVal: string;
  setInputVal: (val: string) => void;
  errorMsg: string | null;
  successResult: VerificationResult | null;
  onExecuteVerification: () => void;
  onSimulateDigiLockerImport: () => void;
}

export const VerificationActionModals: React.FC<VerificationActionModalsProps> = ({
  activeModal,
  onClose,
  loading,
  inputVal,
  setInputVal,
  errorMsg,
  successResult,
  onExecuteVerification,
  onSimulateDigiLockerImport,
}) => {
  if (!activeModal) return null;

  if (activeModal === 'DIGILOCKER') {
    return (
      <Modal
        isOpen={true}
        onClose={onClose}
        title="Connect Official DigiLocker Depository"
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={onSimulateDigiLockerImport} disabled={loading}>
              {loading ? 'Authorizing & Importing...' : 'Authorize & Pull Certificates'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 text-xs">
          <p className="text-foreground m-0">
            Connecting to DigiLocker allows TenderPulse AI to pull digitally signed government
            certificates directly from the Ministry of Corporate Affairs, GSTN, and Ministry of MSME
            without manual document tampering risk.
          </p>
          <div className="p-3 rounded-md bg-muted/40 border border-border">
            <strong className="text-foreground">Certificates automatically pulled into Evidence Vault:</strong>
            <ul className="mt-1.5 ml-5 text-muted-foreground text-[11px] list-disc space-y-0.5">
              <li>MCA Certificate of Incorporation (with CIN verification)</li>
              <li>GST Registration Certificate (Form REG-06)</li>
              <li>MSME Udyam Registration Certificate</li>
            </ul>
          </div>
          {errorMsg && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
              <AlertTriangle size={16} /> {errorMsg}
            </div>
          )}
        </div>
      </Modal>
    );
  }

  const modalTitle =
    activeModal === 'GSTIN'
      ? 'GSTIN with IRIS IRP'
      : activeModal === 'MCA'
        ? 'MCA Corporate Identity (CIN)'
        : 'MSME Udyam Registration';

  const inputLabel =
    activeModal === 'GSTIN'
      ? '15-Character GSTIN Number'
      : activeModal === 'MCA'
        ? '21-Character CIN or LLPIN'
        : 'Udyam Registration Number';

  const placeholder =
    activeModal === 'GSTIN'
      ? 'e.g. 27AAACA1234F1Z9'
      : activeModal === 'MCA'
        ? 'e.g. L45200MH1993PLC071970'
        : 'e.g. UDYAM-MH-01-0012345';

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Verify ${modalTitle}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onExecuteVerification}
            disabled={loading || !inputVal.trim()}
          >
            {loading ? 'Verifying...' : `Verify ${activeModal}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-xs">
        {errorMsg && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
            <AlertTriangle size={16} /> {errorMsg}
          </div>
        )}

        {successResult && (
          <div className="p-3 rounded-md border border-border bg-muted/40 text-xs">
            <div className="flex items-center gap-2 font-bold text-foreground mb-1">
              <CheckCircle2 size={16} className="text-primary shrink-0" />
              {successResult.verificationStatus === 'SOURCE_VERIFIED'
                ? 'Verification Successful & Profile Synced!'
                : 'Discrepancy Detected — Flagged for Review'}
            </div>
            {successResult.discrepancies.map((d, i) => (
              <p key={i} className="text-amber-600 dark:text-amber-400 my-0.5">
                • {d}
              </p>
            ))}
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1.5">
            {inputLabel}
          </label>
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value.toUpperCase())}
            placeholder={placeholder}
            className="w-full p-2.5 rounded-md border border-border bg-background text-foreground text-sm font-mono outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
          <span>Quick fill:</span>
          {activeModal === 'GSTIN' && (
            <button
              type="button"
              onClick={() => setInputVal('27AAACA1234F1Z9')}
              className="text-primary hover:underline cursor-pointer bg-transparent border-0 p-0 text-inherit"
            >
              Ashoka Buildcon (27AAACA1234F1Z9)
            </button>
          )}
          {activeModal === 'MCA' && (
            <button
              type="button"
              onClick={() => setInputVal('L45200MH1993PLC071970')}
              className="text-primary hover:underline cursor-pointer bg-transparent border-0 p-0 text-inherit"
            >
              Ashoka Buildcon (L45200MH1993PLC071970)
            </button>
          )}
          {activeModal === 'UDYAM' && (
            <button
              type="button"
              onClick={() => setInputVal('UDYAM-MH-01-0012345')}
              className="text-primary hover:underline cursor-pointer bg-transparent border-0 p-0 text-inherit"
            >
              MSME (UDYAM-MH-01-0012345)
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
