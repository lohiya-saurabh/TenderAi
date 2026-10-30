import React, { useState, useEffect } from 'react';
import { Page, PageHeader } from '@/components/ui/page.js';
import { useNavigate, Link } from 'react-router-dom';
import { createBid } from '@/api/bids.js';
import { useCompany } from '@/context/useCompany.js';
import { Button } from '@/components/common/Button.js';
import { ErrorBanner } from '@/components/common/ErrorBanner.js';
import { Building2, Calendar, Hash } from 'lucide-react';

export const CreateBidPage: React.FC = () => {
  const { companies, selectedCompanyId } = useCompany();
  const [companyId, setCompanyId] = useState<string>(selectedCompanyId || '');
  const [title, setTitle] = useState<string>('');
  const [tenderNumber, setTenderNumber] = useState<string>('');
  const [tenderingAuthority, setTenderingAuthority] = useState<string>('');
  const [estimatedValueRupees, setEstimatedValueRupees] = useState<string>('');
  const [submissionDeadline, setSubmissionDeadline] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (selectedCompanyId && !companyId) {
      setCompanyId(selectedCompanyId);
    }
  }, [selectedCompanyId, companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !tenderNumber.trim() || !tenderingAuthority.trim()) {
      setError('Title, Tender Number, and Tendering Authority are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const numericValue = estimatedValueRupees ? parseFloat(estimatedValueRupees) : undefined;

    const result = await createBid({
      companyId: companyId || selectedCompanyId || undefined,
      title: title.trim(),
      tenderNumber: tenderNumber.trim(),
      tenderingAuthority: tenderingAuthority.trim(),
      estimatedValueRupees: numericValue,
      submissionDeadline: submissionDeadline || undefined,
    });

    setIsSubmitting(false);

    if (result.ok) {
      navigate(`/bids/${result.data.bidId}`);
    } else {
      setError(result.error.message || 'Failed to create bid project');
    }
  };

  return (
    <Page width="narrow">
      <PageHeader
        title="New bid"
        description="Enter the tender details, then upload its documents to extract every requirement."
      />
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* 3. Executive Form Card */}
      <form
        onSubmit={handleSubmit}
        className="bg-card border border-border rounded-xl p-6 sm:p-8 shadow-sm flex flex-col gap-6"
      >
        {/* Company Entity Scoping */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-primary" />
            Bidding Entity <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <select
              value={companyId || (companies[0]?.id ?? '')}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.legalName} {c.gstin ? `(GSTIN: ${c.gstin})` : ''}
                </option>
              ))}
            </select>
          </div>
          <span className="text-2xs text-muted-foreground">
            This tender will be evaluated strictly against this company's pinned capability profile
            and evidence vault.
          </span>
        </div>

        {/* Project Title */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            Tender Project Title <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Six-Laning of NH-48 Section (Km 120 to 185) Hybrid Annuity Model"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground font-medium placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Two-Column Grid: Tender Number & Authority */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-muted-foreground" />
              NIT / Tender Ref Number <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. NHAI/Tech/2026/BOT-HAM/88421"
              value={tenderNumber}
              onChange={(e) => setTenderNumber(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg font-mono text-sm text-foreground font-medium placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              Tendering Authority / PSU <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. National Highways Authority of India (NHAI)"
              value={tenderingAuthority}
              onChange={(e) => setTenderingAuthority(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground font-medium placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Two-Column Grid: Estimated Value & Submission Deadline */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              Estimated Contract Value (INR)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 tabular-nums text-sm text-muted-foreground font-semibold">
                ₹
              </span>
              <input
                type="number"
                min="0"
                step="1000"
                placeholder="450000000"
                value={estimatedValueRupees}
                onChange={(e) => setEstimatedValueRupees(e.target.value)}
                className="w-full pl-8 pr-3.5 py-2.5 bg-background border border-border rounded-lg font-mono text-sm text-foreground font-semibold placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            <span className="text-2xs text-muted-foreground">
              Total estimated tender value in Indian Rupees. Used for turnover & EMD gates.
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              Submission Deadline
            </label>
            <input
              type="datetime-local"
              value={submissionDeadline}
              onChange={(e) => setSubmissionDeadline(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg font-mono text-sm text-foreground font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <span className="text-2xs text-muted-foreground">
              Official bid submission cutoff time for countdown & urgency tracking.
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-2">
          <Link to="/bids" className="no-underline">
            <Button variant="secondary" type="button" size="md">
              Cancel
            </Button>
          </Link>
          <Button
            variant="primary"
            type="submit"
            size="md"
            isLoading={isSubmitting}
            className="shadow-sm"
          >
            Create bid
          </Button>
        </div>
      </form>
    </Page>
  );
};
