/**
 * CompanyVerificationBar — Verification & Third-Party Ingestion Toolbar
 *
 * Integrates:
 * 1. IRIS IRP GSTIN verification
 * 2. MCA CIN master data verification
 * 3. MSME Udyam registration check
 * 4. DigiLocker document depository connection
 * 5. Google Drive / OneDrive evidence import
 * 6. Local PDF device uploads
 */
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/common/Button.js';
import { Badge } from '@/components/common/Badge.js';
import { ShieldCheck, Upload } from 'lucide-react';
import {
  verifyGstin,
  verifyMca,
  verifyUdyam,
  getDigiLockerAuthUrl,
  submitDigiLockerCallback,
  importCloudEvidence,
  uploadCompanyEvidence,
  type CompanyItem,
  type VerificationResult,
} from '@/api/companies.js';
import { EvidenceAttributeFields } from '@/components/company/EvidenceAttributeFields.js';
import { VerificationActionModals } from '@/components/company/VerificationActionModals.js';
import { EvidenceUploadModal } from '@/components/company/EvidenceUploadModal.js';

export interface CompanyVerificationBarProps {
  company: CompanyItem;
  onRefresh: () => void;
  openEvidenceModalTrigger?: number;
  defaultEvidenceSource?: 'DEVICE' | 'CLOUD' | 'GOOGLE_DRIVE' | 'ONEDRIVE';
}

export const CompanyVerificationBar: React.FC<CompanyVerificationBarProps> = ({
  company,
  onRefresh,
  openEvidenceModalTrigger,
  defaultEvidenceSource,
}) => {
  const [activeModal, setActiveModal] = useState<
    'GSTIN' | 'MCA' | 'UDYAM' | 'DIGILOCKER' | 'CLOUD_IMPORT' | null
  >(null);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<VerificationResult | null>(null);

  // Evidence Source & Modal State (Device vs Cloud)
  const [evidenceSource, setEvidenceSource] = useState<'DEVICE' | 'CLOUD'>('DEVICE');
  const [deviceFile, setDeviceFile] = useState<File | null>(null);
  const [evidenceType, setEvidenceType] = useState('AUDITED_BALANCE_SHEET');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic Metadata Fields per Document Type
  const [finCaFirm, setFinCaFirm] = useState('');
  const [finUdin, setFinUdin] = useState('');
  const [finFy, setFinFy] = useState('FY 2024-25');
  const [finAvgTurnover, setFinAvgTurnover] = useState('');
  const [finNetWorth, setFinNetWorth] = useState('');

  const [expClient, setExpClient] = useState('');
  const [expProjectName, setExpProjectName] = useState('');
  const [expContractRef, setExpContractRef] = useState('');
  const [expContractValue, setExpContractValue] = useState('');
  const [expCompletionDate, setExpCompletionDate] = useState('');

  const [isoStandard, setIsoStandard] = useState('ISO 9001:2015');
  const [isoCertBody, setIsoCertBody] = useState('');
  const [isoCertNumber, setIsoCertNumber] = useState('');
  const [isoValidFrom, setIsoValidFrom] = useState('');
  const [isoValidTo, setIsoValidTo] = useState('');

  const [gstNumber, setGstNumber] = useState(company.gstin || '');
  const [gstTradeName, setGstTradeName] = useState(company.legalName || '');

  const [panNumber, setPanNumber] = useState(company.pan || '');
  const [panHolderName, setPanHolderName] = useState(company.legalName || '');

  const [cinNumber, setCinNumber] = useState(company.cin || '');
  const [rocJurisdiction, setRocJurisdiction] = useState('');

  const [udyamNumber, setUdyamNumber] = useState(company.udyamId || '');
  const [udyamCategory, setUdyamCategory] = useState<'MICRO' | 'SMALL' | 'MEDIUM'>('SMALL');

  const [oemPrincipal, setOemPrincipal] = useState('');
  const [oemTenderRef, setOemTenderRef] = useState('');
  const [oemValidTo, setOemValidTo] = useState('');

  const [genericIssuer, setGenericIssuer] = useState('');
  const [genericRefNumber, setGenericRefNumber] = useState('');
  const [genericValidFrom, setGenericValidFrom] = useState('');
  const [genericValidTo, setGenericValidTo] = useState('');

  const [cloudProvider, setCloudProvider] = useState<'google-drive' | 'onedrive'>('google-drive');

  useEffect(() => {
    if (openEvidenceModalTrigger && openEvidenceModalTrigger > 0) {
      const src =
        defaultEvidenceSource === 'CLOUD' ||
        defaultEvidenceSource === 'GOOGLE_DRIVE' ||
        defaultEvidenceSource === 'ONEDRIVE'
          ? 'CLOUD'
          : 'DEVICE';
      setEvidenceSource(src);
      if (defaultEvidenceSource === 'ONEDRIVE') {
        setCloudProvider('onedrive');
      } else if (defaultEvidenceSource === 'GOOGLE_DRIVE') {
        setCloudProvider('google-drive');
      }
      setErrorMsg(null);
      resetDeviceForm();
      setActiveModal('CLOUD_IMPORT');
    }
  }, [openEvidenceModalTrigger, defaultEvidenceSource]);

  const resetDeviceForm = () => {
    setDeviceFile(null);
    setIsDragOver(false);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setFinCaFirm('');
    setFinUdin('');
    setFinFy('FY 2024-25');
    setFinAvgTurnover('');
    setFinNetWorth('');
    setExpClient('');
    setExpProjectName('');
    setExpContractRef('');
    setExpContractValue('');
    setExpCompletionDate('');
    setIsoStandard('ISO 9001:2015');
    setIsoCertBody('');
    setIsoCertNumber('');
    setIsoValidFrom('');
    setIsoValidTo('');
    setGstNumber(company.gstin || '');
    setGstTradeName(company.legalName || '');
    setPanNumber(company.pan || '');
    setPanHolderName(company.legalName || '');
    setCinNumber(company.cin || '');
    setRocJurisdiction('');
    setUdyamNumber(company.udyamId || '');
    setUdyamCategory('SMALL');
    setOemPrincipal('');
    setOemTenderRef('');
    setOemValidTo('');
    setGenericIssuer('');
    setGenericRefNumber('');
    setGenericValidFrom('');
    setGenericValidTo('');
  };

  const handleOpenGstin = () => {
    setInputVal(company.gstin || '27AAACA1234F1Z9');
    setErrorMsg(null);
    setSuccessResult(null);
    setActiveModal('GSTIN');
  };

  const handleOpenMca = () => {
    setInputVal(company.cin || 'L45200MH1993PLC071970');
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

  const handleOpenEvidenceModal = (source: 'DEVICE' | 'CLOUD' = 'DEVICE') => {
    setEvidenceSource(source);
    setErrorMsg(null);
    resetDeviceForm();
    setActiveModal('CLOUD_IMPORT');
  };

  const validateAndSetDeviceFile = (file: File) => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setErrorMsg('Only PDF documents are supported for company evidence.');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setErrorMsg('File size exceeds the 50MB limit.');
      return;
    }
    setErrorMsg(null);
    setDeviceFile(file);
  };

  const handleDeviceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetDeviceFile(file);
    }
  };

  const handleDeviceFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetDeviceFile(file);
    }
  };

  const getContextualMetadata = () => {
    let issuer = '';
    let referenceNumber = '';
    let validFrom = '';
    let validTo = '';
    const extractedAttributes: Record<string, unknown> = {
      evidence_category: evidenceType,
    };

    if (evidenceType === 'AUDITED_BALANCE_SHEET') {
      issuer = finCaFirm.trim();
      referenceNumber = finUdin.trim();
      extractedAttributes.ca_firm = finCaFirm.trim() || undefined;
      extractedAttributes.udin = finUdin.trim() || undefined;
      extractedAttributes.financial_year = finFy || undefined;
      if (finAvgTurnover) {
        extractedAttributes.average_turnover_inr_cr = parseFloat(finAvgTurnover);
      }
      if (finNetWorth) {
        extractedAttributes.net_worth_inr_cr = parseFloat(finNetWorth);
      }
    } else if (evidenceType === 'COMPLETION_CERT' || evidenceType === 'WORK_ORDER') {
      issuer = expClient.trim();
      referenceNumber = expContractRef.trim();
      validTo = expCompletionDate;
      extractedAttributes.client_name = expClient.trim() || undefined;
      extractedAttributes.issuer = expClient.trim() || undefined;
      extractedAttributes.reference_number = expContractRef.trim() || undefined;
      extractedAttributes.work_order_no = expContractRef.trim() || undefined;
      extractedAttributes.project_name = expProjectName.trim() || undefined;
      extractedAttributes.completion_date = expCompletionDate || undefined;
      if (expContractValue) {
        extractedAttributes.contract_value_inr_cr = parseFloat(expContractValue);
      }
    } else if (evidenceType === 'ISO_CERT') {
      issuer = isoCertBody.trim();
      referenceNumber = isoCertNumber.trim();
      validFrom = isoValidFrom;
      validTo = isoValidTo;
      extractedAttributes.standard_name = isoStandard;
      extractedAttributes.issuing_body = isoCertBody.trim() || undefined;
      extractedAttributes.certificate_number = isoCertNumber.trim() || undefined;
      extractedAttributes.valid_from = isoValidFrom || undefined;
      extractedAttributes.valid_to = isoValidTo || undefined;
    } else if (evidenceType === 'GST_REG') {
      issuer = 'Goods & Services Tax Network (GSTN)';
      referenceNumber = gstNumber.trim();
      extractedAttributes.gstin = gstNumber.trim() || undefined;
      extractedAttributes.trade_name = gstTradeName.trim() || undefined;
    } else if (evidenceType === 'PAN_CARD') {
      issuer = 'Income Tax Department of India';
      referenceNumber = panNumber.trim();
      extractedAttributes.pan = panNumber.trim() || undefined;
      extractedAttributes.holder_name = panHolderName.trim() || undefined;
    } else if (evidenceType === 'INCORPORATION_CERT') {
      issuer = rocJurisdiction.trim() || 'Ministry of Corporate Affairs (MCA)';
      referenceNumber = cinNumber.trim();
      extractedAttributes.cin = cinNumber.trim() || undefined;
      extractedAttributes.roc_jurisdiction = rocJurisdiction.trim() || undefined;
    } else if (evidenceType === 'UDYAM_CERT') {
      issuer = 'Ministry of MSME';
      referenceNumber = udyamNumber.trim();
      extractedAttributes.udyam_id = udyamNumber.trim() || undefined;
      extractedAttributes.enterprise_category = udyamCategory;
    } else if (evidenceType === 'OEM_MAF') {
      issuer = oemPrincipal.trim();
      referenceNumber = oemTenderRef.trim();
      validTo = oemValidTo;
      extractedAttributes.oem_principal = oemPrincipal.trim() || undefined;
      extractedAttributes.tender_reference = oemTenderRef.trim() || undefined;
      extractedAttributes.valid_until = oemValidTo || undefined;
    } else {
      issuer = genericIssuer.trim();
      referenceNumber = genericRefNumber.trim();
      validFrom = genericValidFrom;
      validTo = genericValidTo;
    }

    return { issuer, referenceNumber, validFrom, validTo, extractedAttributes };
  };

  const handleExecuteDeviceUpload = async () => {
    if (!deviceFile) {
      setErrorMsg('Please select a PDF document to upload.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const base64String = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.includes(',') ? result.split(',')[1]! : result;
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('Failed to read file from disk.'));
        reader.readAsDataURL(deviceFile);
      });

      const { issuer, referenceNumber, validFrom, validTo, extractedAttributes } =
        getContextualMetadata();

      const res = await uploadCompanyEvidence(company.id, {
        fileName: deviceFile.name,
        fileBase64: base64String,
        mimeType: deviceFile.type || 'application/pdf',
        evidenceType,
        issuer: issuer || undefined,
        referenceNumber: referenceNumber || undefined,
        validFrom: validFrom || undefined,
        validTo: validTo || undefined,
        extractedAttributes,
      });

      if (res.ok) {
        onRefresh();
        setActiveModal(null);
        resetDeviceForm();
      } else {
        setErrorMsg(res.error.message);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setLoading(false);
    }
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
      const { issuer, referenceNumber, validFrom, validTo } = getContextualMetadata();

      const defaultName =
        evidenceType === 'AUDITED_BALANCE_SHEET'
          ? 'Audited_Balance_Sheet_FY24.pdf'
          : evidenceType === 'COMPLETION_CERT'
            ? 'NHAI_STRR_Completion_Certificate.pdf'
            : evidenceType === 'ISO_CERT'
              ? 'ISO_9001_Quality_Management_Certificate.pdf'
              : 'Company_Evidence_Document.pdf';

      const fileId =
        cloudProvider === 'google-drive' ? 'gdrive_file_evidence_01' : 'onedrive_file_evidence_01';
      const fileName = defaultName;

      const res = await importCloudEvidence(company.id, {
        provider: cloudProvider,
        fileId,
        fileName,
        evidenceType,
        issuer:
          issuer ||
          (cloudProvider === 'google-drive' ? 'Google Cloud Drive Import' : 'Microsoft 365 Import'),
        referenceNumber: referenceNumber || undefined,
        validFrom: validFrom || undefined,
        validTo: validTo || undefined,
      });

      if (res.ok) {
        onRefresh();
        setActiveModal(null);
        resetDeviceForm();
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
      <div className="border border-border rounded-xl p-5 sm:p-6 bg-card shadow-xs flex flex-col gap-4 transition-colors">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-foreground" />
            <span className="font-bold text-sm text-foreground">
              Third-Party Registry &amp; Evidence Integration Hub
            </span>
          </div>
          <span className="mono text-xs text-muted-foreground">
            Authoritative Cross-Verification: IRIS IRP · MCA · Udyam · DigiLocker · Cloud Drive
          </span>
        </div>

        {/* Integration Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* 1. IRIS IRP GSTIN */}
          <div className="p-4 rounded-lg border border-border bg-card shadow-2xs flex flex-col justify-between gap-3 hover:border-border-strong transition-colors">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-foreground">GSTIN (IRIS IRP)</span>
              <Badge variant={isGstVerified ? 'success' : 'neutral'} size="sm">
                {isGstVerified ? 'Verified' : 'Unverified'}
              </Badge>
            </div>
            <p className="text-[11px] mono text-muted-foreground m-0 truncate">
              {company.gstin
                ? `ID: ${company.gstin}`
                : 'Validate legal business name & tax standing'}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenGstin}
              className="self-start mt-auto text-xs h-7 border-border"
            >
              {isGstVerified ? 'Re-verify GST' : 'Verify via IRIS IRP'}
            </Button>
          </div>

          {/* 2. MCA CIN */}
          <div className="p-4 rounded-lg border border-border bg-card shadow-2xs flex flex-col justify-between gap-3 hover:border-border-strong transition-colors">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-foreground">MCA Master Data</span>
              <Badge variant={isMcaVerified ? 'success' : 'neutral'} size="sm">
                {isMcaVerified ? 'Verified' : 'Unverified'}
              </Badge>
            </div>
            <p className="text-[11px] mono text-muted-foreground m-0 truncate">
              {company.cin ? `CIN: ${company.cin}` : 'Cross-check RoC jurisdiction & incorporation'}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenMca}
              className="self-start mt-auto text-xs h-7 border-border"
            >
              {isMcaVerified ? 'Re-check MCA' : 'Verify MCA CIN'}
            </Button>
          </div>

          {/* 3. MSME Udyam */}
          <div className="p-4 rounded-lg border border-border bg-card shadow-2xs flex flex-col justify-between gap-3 hover:border-border-strong transition-colors">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-foreground">MSME Udyam</span>
              <Badge variant={isUdyamVerified ? 'success' : 'neutral'} size="sm">
                {isUdyamVerified ? 'Verified' : 'Unverified'}
              </Badge>
            </div>
            <p className="text-[11px] mono text-muted-foreground m-0 truncate">
              {company.udyamId
                ? `Udyam: ${company.udyamId}`
                : 'Unlock statutory EMD exemption & fee waiver'}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenUdyam}
              className="self-start mt-auto text-xs h-7 border-border"
            >
              {isUdyamVerified ? 'Re-check Udyam' : 'Verify MSME Udyam'}
            </Button>
          </div>

          {/* 4. DigiLocker */}
          <div className="p-4 rounded-lg border border-border bg-card shadow-2xs flex flex-col justify-between gap-3 hover:border-border-strong transition-colors">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-foreground">DigiLocker Depository</span>
              <Badge variant={isDigiLockerLinked ? 'success' : 'neutral'} size="sm">
                {isDigiLockerLinked ? 'Connected' : 'Not Linked'}
              </Badge>
            </div>
            <p className="text-[11px] mono text-muted-foreground m-0 truncate">
              {isDigiLockerLinked
                ? 'Pulling official signed certificates'
                : 'Import digitally signed government docs'}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenDigiLocker}
              className="self-start mt-auto text-xs h-7 border-border"
            >
              {isDigiLockerLinked ? 'Sync DigiLocker' : 'Connect DigiLocker'}
            </Button>
          </div>

          {/* 5. Company Evidence Documents */}
          <div className="p-4 rounded-lg border border-border bg-card shadow-2xs flex flex-col justify-between gap-3 hover:border-border-strong transition-colors">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-foreground">Evidence Documents</span>
              <Badge variant="primary" size="sm">
                Vault
              </Badge>
            </div>
            <p className="text-[11px] mono text-muted-foreground m-0 truncate">
              Upload local PDFs or sync from Google Drive / 365
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenEvidenceModal('DEVICE')}
              className="self-start mt-auto text-xs h-7 border-border hover:border-foreground/30"
              icon={<Upload size={13} />}
            >
              Upload Evidence
            </Button>
          </div>
        </div>
      </div>

      {/* Verification Modal for GSTIN / MCA / UDYAM / DIGILOCKER */}
      <VerificationActionModals
        activeModal={
          activeModal === 'GSTIN' ||
          activeModal === 'MCA' ||
          activeModal === 'UDYAM' ||
          activeModal === 'DIGILOCKER'
            ? activeModal
            : null
        }
        onClose={() => setActiveModal(null)}
        loading={loading}
        inputVal={inputVal}
        setInputVal={setInputVal}
        errorMsg={errorMsg}
        successResult={successResult}
        onExecuteVerification={handleExecuteVerification}
        onSimulateDigiLockerImport={handleSimulateDigiLockerImport}
      />

      {/* Evidence Ingestion Modal (Device Upload & Cloud Drive Import) */}
      <EvidenceUploadModal
        isOpen={activeModal === 'CLOUD_IMPORT'}
        onClose={() => {
          setActiveModal(null);
          resetDeviceForm();
        }}
        loading={loading}
        errorMsg={errorMsg}
        setErrorMsg={setErrorMsg}
        evidenceSource={evidenceSource}
        setEvidenceSource={setEvidenceSource}
        cloudProvider={cloudProvider}
        setCloudProvider={setCloudProvider}
        deviceFile={deviceFile}
        setDeviceFile={setDeviceFile}
        evidenceType={evidenceType}
        setEvidenceType={setEvidenceType}
        isDragOver={isDragOver}
        setIsDragOver={setIsDragOver}
        fileInputRef={fileInputRef}
        handleDeviceFileChange={handleDeviceFileChange}
        handleDeviceFileDrop={handleDeviceFileDrop}
        onExecuteDeviceUpload={handleExecuteDeviceUpload}
        onExecuteCloudImport={handleExecuteCloudImport}
        renderDynamicFields={() => (
          <EvidenceAttributeFields
            evidenceType={evidenceType}
            finCaFirm={finCaFirm}
            setFinCaFirm={setFinCaFirm}
            finUdin={finUdin}
            setFinUdin={setFinUdin}
            finFy={finFy}
            setFinFy={setFinFy}
            finAvgTurnover={finAvgTurnover}
            setFinAvgTurnover={setFinAvgTurnover}
            finNetWorth={finNetWorth}
            setFinNetWorth={setFinNetWorth}
            expClient={expClient}
            setExpClient={setExpClient}
            expProjectName={expProjectName}
            setExpProjectName={setExpProjectName}
            expContractRef={expContractRef}
            setExpContractRef={setExpContractRef}
            expContractValue={expContractValue}
            setExpContractValue={setExpContractValue}
            expCompletionDate={expCompletionDate}
            setExpCompletionDate={setExpCompletionDate}
            isoStandard={isoStandard}
            setIsoStandard={setIsoStandard}
            isoCertBody={isoCertBody}
            setIsoCertBody={setIsoCertBody}
            isoCertNumber={isoCertNumber}
            setIsoCertNumber={setIsoCertNumber}
            isoValidFrom={isoValidFrom}
            setIsoValidFrom={setIsoValidFrom}
            isoValidTo={isoValidTo}
            setIsoValidTo={setIsoValidTo}
            gstNumber={gstNumber}
            setGstNumber={setGstNumber}
            gstTradeName={gstTradeName}
            setGstTradeName={setGstTradeName}
            panNumber={panNumber}
            setPanNumber={setPanNumber}
            panHolderName={panHolderName}
            setPanHolderName={setPanHolderName}
            cinNumber={cinNumber}
            setCinNumber={setCinNumber}
            rocJurisdiction={rocJurisdiction}
            setRocJurisdiction={setRocJurisdiction}
            udyamNumber={udyamNumber}
            setUdyamNumber={setUdyamNumber}
            udyamCategory={udyamCategory}
            setUdyamCategory={setUdyamCategory}
            oemPrincipal={oemPrincipal}
            setOemPrincipal={setOemPrincipal}
            oemTenderRef={oemTenderRef}
            setOemTenderRef={setOemTenderRef}
            oemValidTo={oemValidTo}
            setOemValidTo={setOemValidTo}
            genericIssuer={genericIssuer}
            setGenericIssuer={setGenericIssuer}
            genericRefNumber={genericRefNumber}
            setGenericRefNumber={setGenericRefNumber}
            genericValidFrom={genericValidFrom}
            setGenericValidFrom={setGenericValidFrom}
            genericValidTo={genericValidTo}
            setGenericValidTo={setGenericValidTo}
          />
        )}
      />
    </>
  );
};
