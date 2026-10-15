import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Building2, Check, Plus } from 'lucide-react';
import { useCompany } from '@/context/CompanyContext.js';
import { cn } from '@/lib/utils.js';

export const CompanySelector: React.FC = () => {
  const { companies, selectedCompanyId, selectedCompany, setSelectedCompanyId, createCompany } =
    useCompany();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newGstin, setNewGstin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    setIsSubmitting(true);
    try {
      const created = await createCompany({
        legalName: newCompanyName.trim(),
        gstin: newGstin.trim() || undefined,
      });
      if (created) {
        setNewCompanyName('');
        setNewGstin('');
        setIsCreating(false);
        setIsOpen(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentLabel = selectedCompany?.legalName || 'Select Company';

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all shadow-xs select-none',
          isOpen
            ? 'bg-primary/10 border-primary text-foreground ring-1 ring-primary'
            : 'bg-card hover:bg-accent border-border text-foreground hover:text-foreground',
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Switch Business Entity / Company"
      >
        <div className="flex items-center justify-center w-5 h-5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
          <Building2 size={13} />
        </div>

        <div className="flex flex-col items-start min-w-0">
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold leading-none">
            Active Company
          </span>
          <span className="font-semibold text-xs text-foreground max-w-[150px] sm:max-w-[200px] md:max-w-[240px] truncate leading-tight mt-0.5">
            {currentLabel}
          </span>
        </div>

        <ChevronDown
          size={13}
          className={cn(
            'text-muted-foreground transition-transform duration-200 shrink-0 ml-1',
            isOpen && 'rotate-180 text-foreground',
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-xl bg-card border border-border shadow-2xl p-1.5 z-50 text-xs backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="px-3 py-2 border-b border-border/80 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                Tenant Companies
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Bids, profiles &amp; AI evaluations are scoped per company
              </div>
            </div>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
              {companies.length} {companies.length === 1 ? 'Entity' : 'Entities'}
            </span>
          </div>

          {/* Company List */}
          <div className="py-1.5 max-h-56 overflow-y-auto space-y-1 no-scrollbar">
            {companies.map((company) => {
              const isSelected = company.id === selectedCompanyId;
              return (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => {
                    setSelectedCompanyId(company.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-start justify-between p-2 rounded-lg text-left transition-colors border',
                    isSelected
                      ? 'bg-vermilion-subtle border-vermilion-border text-foreground font-medium'
                      : 'border-transparent hover:bg-accent/80 text-muted-foreground hover:text-foreground',
                  )}
                >
                  <div className="min-w-0 pr-2">
                    <div
                      className={cn(
                        'text-xs font-semibold truncate',
                        isSelected ? 'text-vermilion' : 'text-foreground',
                      )}
                    >
                      {company.legalName}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                      {company.gstin && (
                        <span className="font-mono bg-muted/60 px-1 py-0.2 rounded text-[9px]">
                          GST: {company.gstin}
                        </span>
                      )}
                      {company.constitution && (
                        <span className="capitalize">
                          {company.constitution.replace('_', ' ').toLowerCase()}
                        </span>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-vermilion text-white shrink-0 mt-0.5 shadow-xs">
                      <Check size={11} strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Add Company Section */}
          <div className="border-t border-border/80 pt-1.5 mt-1">
            {isCreating ? (
              <form
                onSubmit={handleCreate}
                className="p-2 bg-muted/40 rounded-lg space-y-2 border border-border"
              >
                <div className="text-[11px] font-semibold text-foreground">
                  Register New Legal Entity
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5 font-medium">
                    Company Legal Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Solar Solutions Pvt Ltd"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-background border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5 font-medium">
                    GSTIN (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 27AAKCA9999F1Z9"
                    value={newGstin}
                    onChange={(e) => setNewGstin(e.target.value)}
                    className="w-full px-2.5 py-1 bg-background border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="flex gap-1.5 justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-2.5 py-1 text-muted-foreground hover:text-foreground text-xs rounded hover:bg-accent"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 bg-primary text-primary-foreground rounded text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-xs"
                    disabled={isSubmitting || !newCompanyName.trim()}
                  >
                    {isSubmitting ? 'Registering...' : 'Add Entity'}
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-primary hover:text-primary/80 font-medium rounded-lg hover:bg-accent text-left transition-colors"
              >
                <Plus size={14} className="text-primary" />
                <span>Add Legal Company Entity</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
