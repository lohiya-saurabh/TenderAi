import React from 'react';

export interface EvidenceAttributeFieldsProps {
  evidenceType: string;
  // Financial Audit / Balance Sheet
  finCaFirm: string;
  setFinCaFirm: (val: string) => void;
  finUdin: string;
  setFinUdin: (val: string) => void;
  finFy: string;
  setFinFy: (val: string) => void;
  finAvgTurnover: string;
  setFinAvgTurnover: (val: string) => void;
  finNetWorth: string;
  setFinNetWorth: (val: string) => void;
  // Experience / Work Order / Completion
  expClient: string;
  setExpClient: (val: string) => void;
  expProjectName: string;
  setExpProjectName: (val: string) => void;
  expContractRef: string;
  setExpContractRef: (val: string) => void;
  expContractValue: string;
  setExpContractValue: (val: string) => void;
  expCompletionDate: string;
  setExpCompletionDate: (val: string) => void;
  // ISO / Quality Cert
  isoStandard: string;
  setIsoStandard: (val: string) => void;
  isoCertBody: string;
  setIsoCertBody: (val: string) => void;
  isoCertNumber: string;
  setIsoCertNumber: (val: string) => void;
  isoValidFrom: string;
  setIsoValidFrom: (val: string) => void;
  isoValidTo: string;
  setIsoValidTo: (val: string) => void;
  // GST Registration
  gstNumber: string;
  setGstNumber: (val: string) => void;
  gstTradeName: string;
  setGstTradeName: (val: string) => void;
  // PAN Card
  panNumber: string;
  setPanNumber: (val: string) => void;
  panHolderName: string;
  setPanHolderName: (val: string) => void;
  // Incorporation Certificate
  cinNumber: string;
  setCinNumber: (val: string) => void;
  rocJurisdiction: string;
  setRocJurisdiction: (val: string) => void;
  // MSME Udyam
  udyamNumber: string;
  setUdyamNumber: (val: string) => void;
  udyamCategory: 'MICRO' | 'SMALL' | 'MEDIUM';
  setUdyamCategory: (val: 'MICRO' | 'SMALL' | 'MEDIUM') => void;
  // OEM Authorization
  oemPrincipal: string;
  setOemPrincipal: (val: string) => void;
  oemTenderRef: string;
  setOemTenderRef: (val: string) => void;
  oemValidTo: string;
  setOemValidTo: (val: string) => void;
  // Other Statutory
  genericIssuer: string;
  setGenericIssuer: (val: string) => void;
  genericRefNumber: string;
  setGenericRefNumber: (val: string) => void;
  genericValidFrom: string;
  setGenericValidFrom: (val: string) => void;
  genericValidTo: string;
  setGenericValidTo: (val: string) => void;
}

export const EvidenceAttributeFields: React.FC<EvidenceAttributeFieldsProps> = ({
  evidenceType,
  finCaFirm,
  setFinCaFirm,
  finUdin,
  setFinUdin,
  finFy,
  setFinFy,
  finAvgTurnover,
  setFinAvgTurnover,
  finNetWorth,
  setFinNetWorth,
  expClient,
  setExpClient,
  expProjectName,
  setExpProjectName,
  expContractRef,
  setExpContractRef,
  expContractValue,
  setExpContractValue,
  expCompletionDate,
  setExpCompletionDate,
  isoStandard,
  setIsoStandard,
  isoCertBody,
  setIsoCertBody,
  isoCertNumber,
  setIsoCertNumber,
  isoValidFrom,
  setIsoValidFrom,
  isoValidTo,
  setIsoValidTo,
  gstNumber,
  setGstNumber,
  gstTradeName,
  setGstTradeName,
  panNumber,
  setPanNumber,
  panHolderName,
  setPanHolderName,
  cinNumber,
  setCinNumber,
  rocJurisdiction,
  setRocJurisdiction,
  udyamNumber,
  setUdyamNumber,
  udyamCategory,
  setUdyamCategory,
  oemPrincipal,
  setOemPrincipal,
  oemTenderRef,
  setOemTenderRef,
  oemValidTo,
  setOemValidTo,
  genericIssuer,
  setGenericIssuer,
  genericRefNumber,
  setGenericRefNumber,
  genericValidFrom,
  setGenericValidFrom,
  genericValidTo,
  setGenericValidTo,
}) => {
  switch (evidenceType) {
    case 'AUDITED_BALANCE_SHEET':
      return (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1 text-foreground">
                CA Firm / Statutory Auditor Name
              </label>
              <input
                type="text"
                placeholder="e.g. V. K. Surana & Co., Chartered Accountants"
                value={finCaFirm}
                onChange={(e) => setFinCaFirm(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1 text-foreground">
                Statutory CA UDIN (18 Digits)
              </label>
              <input
                type="text"
                placeholder="e.g. 25089745AAAAAA1234"
                value={finUdin}
                onChange={(e) => setFinUdin(e.target.value.toUpperCase())}
                maxLength={18}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs mono outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold block mb-1 text-foreground">Financial Year (FY)</label>
              <select
                value={finFy}
                onChange={(e) => setFinFy(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="FY 2024-25">FY 2024-25</option>
                <option value="FY 2023-24">FY 2023-24</option>
                <option value="FY 2022-23">FY 2022-23</option>
                <option value="FY 2021-22">FY 2021-22</option>
              </select>
            </div>
            <div>
              <label className="font-semibold block mb-1 text-foreground">
                3-Year Avg. Turnover (₹ Cr)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 281.90"
                value={finAvgTurnover}
                onChange={(e) => setFinAvgTurnover(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1 text-foreground">
                Net Worth (₹ Cr, Optional)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 145.20"
                value={finNetWorth}
                onChange={(e) => setFinNetWorth(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      );

    case 'COMPLETION_CERT':
    case 'WORK_ORDER':
      return (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1 text-foreground">
                Client Authority / Employer *
              </label>
              <input
                type="text"
                placeholder="e.g. NHAI, Central PWD, Indian Railways, State PWD"
                value={expClient}
                onChange={(e) => setExpClient(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1 text-foreground">
                Contract / Agreement / Work Order No.
              </label>
              <input
                type="text"
                placeholder="e.g. NHAI/TECH/2023/102 or WO-2023-89"
                value={expContractRef}
                onChange={(e) => setExpContractRef(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs mono outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1 text-foreground">
                Completed Contract Value (₹ Crores)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 215.00"
                value={expContractValue}
                onChange={(e) => setExpContractValue(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1 text-foreground">
                {evidenceType === 'COMPLETION_CERT' ? 'Date of Completion' : 'Work Order Date'}
              </label>
              <input
                type="date"
                value={expCompletionDate}
                onChange={(e) => setExpCompletionDate(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold block mb-1 text-foreground">
              Project Name / Scope of Work
            </label>
            <input
              type="text"
              placeholder="e.g. Construction of 4-Lane Greenfield Highway Bangalore Satellite Town Ring Road"
              value={expProjectName}
              onChange={(e) => setExpProjectName(e.target.value)}
              className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      );

    case 'ISO_CERT':
      return (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1 text-foreground">Standard Specification *</label>
              <select
                value={isoStandard}
                onChange={(e) => setIsoStandard(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ISO 9001:2015">ISO 9001:2015 (Quality Management)</option>
                <option value="ISO 14001:2015">ISO 14001:2015 (Environmental Management)</option>
                <option value="ISO 45001:2018">ISO 45001:2018 (Occupational Health & Safety)</option>
                <option value="ISO 27001:2022">ISO 27001:2022 (Information Security)</option>
                <option value="ISO 50001:2018">ISO 50001:2018 (Energy Management)</option>
                <option value="OTHER_ISO">Other Quality / Safety Standard</option>
              </select>
            </div>
            <div>
              <label className="font-semibold block mb-1 text-foreground">
                Certifying Authority / Registrar *
              </label>
              <input
                type="text"
                placeholder="e.g. Bureau Veritas, TUV Rheinland, DNV, BSI"
                value={isoCertBody}
                onChange={(e) => setIsoCertBody(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold block mb-1 text-foreground">
              Certificate Registration Number
            </label>
            <input
              type="text"
              placeholder="e.g. BVC-IND-2023-0941"
              value={isoCertNumber}
              onChange={(e) => setIsoCertNumber(e.target.value)}
              className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs mono outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1 text-foreground">Valid From (Issue Date)</label>
              <input
                type="date"
                value={isoValidFrom}
                onChange={(e) => setIsoValidFrom(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1 text-foreground">Valid To (Expiry Date) *</label>
              <input
                type="date"
                value={isoValidTo}
                onChange={(e) => setIsoValidTo(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      );

    case 'GST_REG':
      return (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1 text-foreground">15-Digit GSTIN *</label>
              <input
                type="text"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                maxLength={15}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs mono outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1 text-foreground">Legal / Trade Name *</label>
              <input
                type="text"
                value={gstTradeName}
                onChange={(e) => setGstTradeName(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      );

    case 'PAN_CARD':
      return (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1 text-foreground">10-Digit PAN *</label>
              <input
                type="text"
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                maxLength={10}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs mono outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1 text-foreground">Name on PAN Card *</label>
              <input
                type="text"
                value={panHolderName}
                onChange={(e) => setPanHolderName(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      );

    case 'INCORPORATION_CERT':
      return (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1 text-foreground">21-Digit MCA CIN *</label>
              <input
                type="text"
                value={cinNumber}
                onChange={(e) => setCinNumber(e.target.value.toUpperCase())}
                maxLength={21}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs mono outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1 text-foreground">ROC Jurisdiction</label>
              <input
                type="text"
                placeholder="e.g. RoC Mumbai, RoC Delhi"
                value={rocJurisdiction}
                onChange={(e) => setRocJurisdiction(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      );

    case 'UDYAM_CERT':
      return (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1 text-foreground">Udyam Registration Number *</label>
              <input
                type="text"
                placeholder="e.g. UDYAM-MH-01-0012345"
                value={udyamNumber}
                onChange={(e) => setUdyamNumber(e.target.value.toUpperCase())}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs mono outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1 text-foreground">Enterprise Classification</label>
              <select
                value={udyamCategory}
                onChange={(e) => setUdyamCategory(e.target.value as 'MICRO' | 'SMALL' | 'MEDIUM')}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="MICRO">Micro Enterprise (Turnover &lt; ₹5 Cr)</option>
                <option value="SMALL">Small Enterprise (Turnover &lt; ₹50 Cr)</option>
                <option value="MEDIUM">Medium Enterprise (Turnover &lt; ₹250 Cr)</option>
              </select>
            </div>
          </div>
        </div>
      );

    case 'OEM_MAF':
      return (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1 text-foreground">OEM Principal Manufacturer *</label>
              <input
                type="text"
                placeholder="e.g. Cisco Systems, Cummins, Schneider Electric"
                value={oemPrincipal}
                onChange={(e) => setOemPrincipal(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1 text-foreground">Tender Reference № (If Specific)</label>
              <input
                type="text"
                placeholder="e.g. NIT-NHAI-2026-991"
                value={oemTenderRef}
                onChange={(e) => setOemTenderRef(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs mono outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold block mb-1 text-foreground">Authorization Validity Expiry</label>
            <input
              type="date"
              value={oemValidTo}
              onChange={(e) => setOemValidTo(e.target.value)}
              className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      );

    default:
      return (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1 text-foreground">Issuing Authority / Body</label>
              <input
                type="text"
                placeholder="e.g. Government of India, State PWD, CPWD"
                value={genericIssuer}
                onChange={(e) => setGenericIssuer(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1 text-foreground">Document / Reference №</label>
              <input
                type="text"
                placeholder="e.g. REG-2026-9901"
                value={genericRefNumber}
                onChange={(e) => setGenericRefNumber(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs mono outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1 text-foreground">Valid From</label>
              <input
                type="date"
                value={genericValidFrom}
                onChange={(e) => setGenericValidFrom(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1 text-foreground">Valid To (If Applicable)</label>
              <input
                type="date"
                value={genericValidTo}
                onChange={(e) => setGenericValidTo(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      );
  }
};
