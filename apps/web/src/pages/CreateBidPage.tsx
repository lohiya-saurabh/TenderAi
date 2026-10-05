import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createBid } from '../api/bids.js';
import { useCompany } from '../context/CompanyContext.js';
import { Button } from '../components/common/Button.js';
import { Input } from '../components/common/Input.js';
import { ErrorBanner } from '../components/common/ErrorBanner.js';
import { Building2 } from 'lucide-react';

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
    <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Link to="/bids" style={{ color: 'var(--color-surface-muted)', fontSize: '0.9rem' }}>
          ← Back to Bids
        </Link>
      </div>

      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-surface-text)' }}>
          Create New Bid Project
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-surface-muted)' }}>
          Initialize a tender workspace. You will upload documents and analyze compliance in the next step.
        </p>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <form
        onSubmit={handleSubmit}
        style={{
          backgroundColor: 'var(--color-surface-card)',
          border: '1px solid var(--color-surface-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        {/* Company Entity Scoping */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-surface-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Building2 size={14} className="text-primary" /> Bidding Company Entity *
          </label>
          <select
            value={companyId || (companies[0]?.id ?? '')}
            onChange={(e) => setCompanyId(e.target.value)}
            style={{
              padding: '0.65rem 0.85rem',
              backgroundColor: 'var(--color-surface-bg)',
              border: '1px solid var(--color-surface-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-surface-text)',
              fontSize: 'var(--text-sm)',
              outline: 'none',
            }}
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.legalName} {c.gstin ? `(GST: ${c.gstin})` : ''}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}>
            This tender will be evaluated against this company's pinned capability profile and evidence vault.
          </span>
        </div>

        <Input
          label="Tender Project Title"
          required
          placeholder="e.g. Supply and Commissioning of Solar Microgrids"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Input
            label="Tender / NIT Reference Number"
            required
            placeholder="e.g. NTPC/2026/SOLAR/042"
            value={tenderNumber}
            onChange={(e) => setTenderNumber(e.target.value)}
          />

          <Input
            label="Tendering Authority / PSU"
            required
            placeholder="e.g. NTPC Limited, NHAI, Railways"
            value={tenderingAuthority}
            onChange={(e) => setTenderingAuthority(e.target.value)}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Input
            label="Estimated Value (INR)"
            type="number"
            min="0"
            step="1000"
            placeholder="e.g. 50000000"
            helperText="Estimated project cost in Rupees"
            value={estimatedValueRupees}
            onChange={(e) => setEstimatedValueRupees(e.target.value)}
          />

          <Input
            label="Submission Deadline"
            type="datetime-local"
            value={submissionDeadline}
            onChange={(e) => setSubmissionDeadline(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
          <Link to="/bids">
            <Button variant="secondary" type="button">
              Cancel
            </Button>
          </Link>
          <Button variant="primary" type="submit" isLoading={isSubmitting}>
            Create Bid Project
          </Button>
        </div>
      </form>
    </div>
  );
};
