/**
 * CompanyVerificationBar — Verification & Third-Party Ingestion Toolbar
 *
 * Integrates:
 * 1. IRIS IRP GSTIN verification
 * 2. MCA CIN master data verification
 * 3. MSME Udyam registration check
 * 4. DigiLocker document depository connection
 * 5. Google Drive / OneDrive evidence import
 */
import React, { useState } from 'react';
import { Button } from '../common/Button.js';
import { Badge } from '../common/Badge.js';
import { Modal } from '../common/Modal.js';
import {
  ShieldCheck,
  CloudDownload,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import {
  verifyGstin,
  verifyMca,
  verifyUdyam,
  getDigiLockerAuthUrl,
  submitDigiLockerCallback,
  importCloudEvidence,
  type CompanyItem,
  type VerificationResult,
} from '../../api/companies.js';

export interface CompanyVerificationBarProps {
  company: CompanyItem;
  onRefresh: () => void;
}

export const CompanyVerificationBar: React.FC<CompanyVerificationBarProps> = ({
  company,
  onRefresh,
}) => {
  const [activeModal, setActiveModal] = useState<'GSTIN' | 'MCA' | 'UDYAM' | 'DIGILOCKER' | 'CLOUD_IMPORT' | null>(null);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<VerificationResult | null>(null);

  // Cloud Import State
  const [cloudProvider, setCloudProvider] = useState<'google-drive' | 'onedrive'>('google-drive');
  const [cloudDocType, setCloudDocType] = useState('AUDITED_BALANCE_SHEET');

  const handleOpenGstin = () => {
    setInputVal(company.gstin || '27AABCU9603R1ZM');
    setErrorMsg(null);
    setSuccessResult(null);
    setActiveModal('GSTIN');
  };

  const handleOpenMca = () => {
    setInputVal(company.cin || 'U72900MH2018PTC123456');
    setErrorMsg(null);
    setSuccessResult(null);
    setActiveModal('MCA');
  };

  const handleOpenUdyam = () => {
    setInputVal(company.udyamId || 'UDYAM-MH-01-0012345');
    setErrorMsg(null);
    setSuccessResult(null);
    setActiveModal('UDYAM');
  };

  const handleOpenDigiLocker = () => {
    setErrorMsg(null);
    setSuccessResult(null);
    setActiveModal('DIGILOCKER');
  };

  const handleOpenCloudImport = () => {
    setErrorMsg(null);
    setActiveModal('CLOUD_IMPORT');
  };

  const handleExecuteVerification = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      if (activeModal === 'GSTIN') {
        const res = await verifyGstin(company.id, inputVal);
        if (res.ok) {
          setSuccessResult(res.data);
          onRefresh();
        } else {
          setErrorMsg(res.error.message);
        }
      } else if (activeModal === 'MCA') {
        const res = await verifyMca(company.id, inputVal);
        if (res.ok) {
          setSuccessResult(res.data);
          onRefresh();
        } else {
          setErrorMsg(res.error.message);
        }
      } else if (activeModal === 'UDYAM') {
        const res = await verifyUdyam(company.id, inputVal);
        if (res.ok) {
          setSuccessResult(res.data);
          onRefresh();
        } else {
          setErrorMsg(res.error.message);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateDigiLockerImport = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const authRes = await getDigiLockerAuthUrl(company.id);
      if (!authRes.ok) {
        setErrorMsg(authRes.error.message);
        return;
      }

      // Simulate consent code callback
      const callbackRes = await submitDigiLockerCallback(
        company.id,
        'mock_consent_code_123',
        authRes.data.state,
      );

      if (callbackRes.ok) {
        onRefresh();
        setActiveModal(null);
      } else {
        setErrorMsg(callbackRes.error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteCloudImport = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const fileId = cloudProvider === 'google-drive' ? 'gdrive_file_audited_fy24' : 'onedrive_file_ca_networth';
      const fileName = cloudProvider === 'google-drive' ? 'Audited_Balance_Sheet_FY24.pdf' : 'Networth_Certificate_UDIN.pdf';

      const res = await importCloudEvidence(company.id, {
        provider: cloudProvider,
        fileId,
        fileName,
        evidenceType: cloudDocType,
        issuer: cloudProvider === 'google-drive' ? 'Statutory Auditor' : 'Chartered Accountant',
      });

      if (res.ok) {
        onRefresh();
        setActiveModal(null);
      } else {
        setErrorMsg(res.error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const isGstVerified = Boolean(company.gstinVerifiedAt);
  const isMcaVerified = Boolean(company.mcaVerifiedAt);
  const isUdyamVerified = Boolean(company.udyamVerifiedAt);
  const isDigiLockerLinked = Boolean(company.digilockerLinkedAt);

  return (
    <>
      <div
        style={{
          backgroundColor: 'var(--color-surface-bg)',
          border: '1px solid var(--color-surface-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={18} className="text-primary" />
            <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--color-surface-text)' }}>
              Third-Party Registry &amp; Evidence Integration Hub
            </span>
          </div>
          <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)' }}>
            Authoritative Cross-Verification: IRIS IRP · MCA · Udyam · DigiLocker · Cloud Drive
          </span>
        </div>

        {/* Integration Status Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
          {/* 1. IRIS IRP GSTIN */}
          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-surface-border)', backgroundColor: 'var(--color-surface-card)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-surface-text)' }}>GSTIN (IRIS IRP)</span>
              <Badge variant={isGstVerified ? 'success' : 'neutral'} size="sm">
                {isGstVerified ? 'Verified' : 'Unverified'}
              </Badge>
            </div>
            <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)', margin: 0 }}>
              {company.gstin ? `ID: ${company.gstin}` : 'Validate legal business name & tax standing'}
            </p>
            <Button variant="outline" size="sm" onClick={handleOpenGstin} style={{ alignSelf: 'flex-start', marginTop: 'auto' }}>
              {isGstVerified ? 'Re-verify GST' : 'Verify via IRIS IRP'}
            </Button>
          </div>

          {/* 2. MCA CIN */}
          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-surface-border)', backgroundColor: 'var(--color-surface-card)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-surface-text)' }}>MCA Master Data</span>
              <Badge variant={isMcaVerified ? 'success' : 'neutral'} size="sm">
                {isMcaVerified ? 'Verified' : 'Unverified'}
              </Badge>
            </div>
            <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)', margin: 0 }}>
              {company.cin ? `CIN: ${company.cin}` : 'Cross-check RoC jurisdiction & incorporation'}
            </p>
            <Button variant="outline" size="sm" onClick={handleOpenMca} style={{ alignSelf: 'flex-start', marginTop: 'auto' }}>
              {isMcaVerified ? 'Re-check MCA' : 'Verify MCA CIN'}
            </Button>
          </div>

          {/* 3. MSME Udyam */}
          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-surface-border)', backgroundColor: 'var(--color-surface-card)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-surface-text)' }}>MSME Udyam</span>
              <Badge variant={isUdyamVerified ? 'success' : 'neutral'} size="sm">
                {isUdyamVerified ? 'Verified' : 'Unverified'}
              </Badge>
            </div>
            <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)', margin: 0 }}>
              {company.udyamId ? `Udyam: ${company.udyamId}` : 'Unlock statutory EMD exemption & fee waiver'}
            </p>
            <Button variant="outline" size="sm" onClick={handleOpenUdyam} style={{ alignSelf: 'flex-start', marginTop: 'auto' }}>
              {isUdyamVerified ? 'Re-check Udyam' : 'Verify MSME Udyam'}
            </Button>
          </div>

          {/* 4. DigiLocker */}
          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-surface-border)', backgroundColor: 'var(--color-surface-card)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-surface-text)' }}>DigiLocker Depository</span>
              <Badge variant={isDigiLockerLinked ? 'success' : 'neutral'} size="sm">
                {isDigiLockerLinked ? 'Connected' : 'Not Linked'}
              </Badge>
            </div>
            <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)', margin: 0 }}>
              {isDigiLockerLinked ? 'Pulling official signed certificates' : 'Import digitally signed government docs'}
            </p>
            <Button variant="outline" size="sm" onClick={handleOpenDigiLocker} style={{ alignSelf: 'flex-start', marginTop: 'auto' }}>
              {isDigiLockerLinked ? 'Sync DigiLocker' : 'Connect DigiLocker'}
            </Button>
          </div>

          {/* 5. Cloud Drive Import */}
          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-surface-border)', backgroundColor: 'var(--color-surface-card)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-surface-text)' }}>Cloud Storage Import</span>
              <Badge variant="primary" size="sm">Drive / 365</Badge>
            </div>
            <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)', margin: 0 }}>
              Import folders from Google Drive or Microsoft OneDrive
            </p>
            <Button variant="secondary" size="sm" onClick={handleOpenCloudImport} style={{ alignSelf: 'flex-start', marginTop: 'auto' }} icon={<CloudDownload size={14} />}>
              Import Evidence
            </Button>
          </div>
        </div>
      </div>

      {/* Verification Modal for GSTIN / MCA / UDYAM */}
      {activeModal && activeModal !== 'DIGILOCKER' && activeModal !== 'CLOUD_IMPORT' && (
        <Modal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          title={`Verify ${activeModal === 'GSTIN' ? 'GSTIN with IRIS IRP' : activeModal === 'MCA' ? 'MCA Corporate Identity (CIN)' : 'MSME Udyam Registration'}`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setActiveModal(null)} disabled={loading}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleExecuteVerification} disabled={loading || !inputVal.trim()}>
                {loading ? 'Verifying...' : `Verify ${activeModal}`}
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {errorMsg && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.75rem', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={16} /> {errorMsg}
              </div>
            )}

            {successResult && (
              <div style={{ backgroundColor: successResult.discrepancies.length > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)', border: '1px solid', borderColor: successResult.discrepancies.length > 0 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: successResult.discrepancies.length > 0 ? 'var(--color-warning)' : 'var(--color-success)', marginBottom: '0.35rem' }}>
                  <CheckCircle2 size={16} /> {successResult.verificationStatus === 'SOURCE_VERIFIED' ? 'Verification Successful & Profile Synced!' : 'Discrepancy Detected — Flagged for Review'}
                </div>
                {successResult.discrepancies.map((d, i) => (
                  <p key={i} style={{ color: 'var(--color-warning)', margin: '0.2rem 0' }}>• {d}</p>
                ))}
              </div>
            )}

            <div>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-surface-text)', display: 'block', marginBottom: '0.35rem' }}>
                {activeModal === 'GSTIN' ? '15-Character GSTIN Number' : activeModal === 'MCA' ? '21-Character CIN or LLPIN' : 'Udyam Registration Number'}
              </label>
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value.toUpperCase())}
                placeholder={activeModal === 'GSTIN' ? 'e.g. 27AABCU9603R1ZM' : activeModal === 'MCA' ? 'e.g. U72900MH2018PTC123456' : 'e.g. UDYAM-MH-01-0012345'}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-surface-border)',
                  backgroundColor: 'var(--color-surface-input)',
                  color: 'var(--color-surface-text)',
                  fontSize: 'var(--text-sm)',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span>Quick auto-fill samples:</span>
              {activeModal === 'GSTIN' && (
                <button type="button" onClick={() => setInputVal('27AABCU9603R1ZM')} style={{ background: 'none', border: 'none', color: 'var(--color-primary-300)', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit' }}>
                  ACME Infra (27AABCU9603R1ZM)
                </button>
              )}
              {activeModal === 'MCA' && (
                <button type="button" onClick={() => setInputVal('U72900MH2018PTC123456')} style={{ background: 'none', border: 'none', color: 'var(--color-primary-300)', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit' }}>
                  RoC-Mumbai (U72900MH2018PTC123456)
                </button>
              )}
              {activeModal === 'UDYAM' && (
                <button type="button" onClick={() => setInputVal('UDYAM-MH-01-0012345')} style={{ background: 'none', border: 'none', color: 'var(--color-primary-300)', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit' }}>
                  MSME Small (UDYAM-MH-01-0012345)
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* DigiLocker Consent Modal */}
      {activeModal === 'DIGILOCKER' && (
        <Modal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          title="Connect Official DigiLocker Depository"
          footer={
            <>
              <Button variant="ghost" onClick={() => setActiveModal(null)} disabled={loading}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSimulateDigiLockerImport} disabled={loading}>
                {loading ? 'Authorizing & Importing...' : 'Authorize & Pull Certificates'}
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: 'var(--text-xs)' }}>
            <p style={{ color: 'var(--color-surface-text)', margin: 0 }}>
              Connecting to DigiLocker allows TenderPulse AI to pull digitally signed government certificates
              directly from the Ministry of Corporate Affairs, GSTN, and Ministry of MSME without manual document tampering risk.
            </p>
            <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-surface-card-subtle)', border: '1px solid var(--color-surface-border)' }}>
              <strong>Certificates automatically pulled into Evidence Vault:</strong>
              <ul style={{ margin: '0.4rem 0 0 1.25rem', color: 'var(--color-surface-muted)', fontSize: 'var(--text-2xs)' }}>
                <li>MCA Certificate of Incorporation (with CIN verification)</li>
                <li>GST Registration Certificate (Form REG-06)</li>
                <li>MSME Udyam Registration Certificate</li>
              </ul>
            </div>
            {errorMsg && (
              <div style={{ color: 'var(--color-danger)' }}>{errorMsg}</div>
            )}
          </div>
        </Modal>
      )}

      {/* Cloud Drive Import Modal */}
      {activeModal === 'CLOUD_IMPORT' && (
        <Modal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          title="Import Evidence from Cloud Storage"
          footer={
            <>
              <Button variant="ghost" onClick={() => setActiveModal(null)} disabled={loading}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleExecuteCloudImport} disabled={loading}>
                {loading ? 'Importing...' : 'Import Selected File'}
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: 'var(--text-xs)' }}>
            <div>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Cloud Provider</label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="provider"
                    checked={cloudProvider === 'google-drive'}
                    onChange={() => setCloudProvider('google-drive')}
                  />
                  Google Drive
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="provider"
                    checked={cloudProvider === 'onedrive'}
                    onChange={() => setCloudProvider('onedrive')}
                  />
                  Microsoft OneDrive / SharePoint
                </label>
              </div>
            </div>

            <div>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Evidence Classification</label>
              <select
                value={cloudDocType}
                onChange={(e) => setCloudDocType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-surface-border)',
                  backgroundColor: 'var(--color-surface-input)',
                  color: 'var(--color-surface-text)',
                  outline: 'none',
                }}
              >
                <option value="AUDITED_BALANCE_SHEET">Audited Balance Sheet / Financials</option>
                <option value="WORK_ORDER">Work Order / Contract Agreement</option>
                <option value="COMPLETION_CERT">Client Completion Certificate</option>
                <option value="ISO_CERT">ISO Quality / Safety Certificate</option>
                <option value="OEM_MAF">Manufacturer Authorization Form (MAF)</option>
              </select>
            </div>

            <p style={{ color: 'var(--color-surface-muted)', fontSize: 'var(--text-2xs)' }}>
              Selected file will be transferred into isolated tenant object storage and cataloged with a cryptographic SHA-256 hash.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
};
