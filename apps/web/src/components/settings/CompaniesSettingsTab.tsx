import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Building2, Plus, ExternalLink } from 'lucide-react';
import type { CompanyItem } from '@/api/companies.js';

interface CompaniesSettingsTabProps {
  companies: CompanyItem[];
  selectedCompanyId: string | null;
  onSelectCompanyId: (id: string) => void;
  isAddingCompany: boolean;
  newCompanyName: string;
  newGstin: string;
  isSubmittingCompany: boolean;
  onSetIsAddingCompany: (val: boolean) => void;
  onSetNewCompanyName: (val: string) => void;
  onSetNewGstin: (val: string) => void;
  onSubmitCompany: (e: React.FormEvent) => void;
}

export const CompaniesSettingsTab: React.FC<CompaniesSettingsTabProps> = ({
  companies,
  selectedCompanyId,
  onSelectCompanyId,
  isAddingCompany,
  newCompanyName,
  newGstin,
  isSubmittingCompany,
  onSetIsAddingCompany,
  onSetNewCompanyName,
  onSetNewGstin,
  onSubmitCompany,
}) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-base font-semibold">
              Registered Company Legal Entities
            </CardTitle>
            <CardDescription className="text-xs">
              Legal business entities evaluated under this tenant workspace ({companies.length}{' '}
              Registered)
            </CardDescription>
          </div>
          {!isAddingCompany && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onSetIsAddingCompany(true)}
              className="gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Legal Entity
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add Company Inline Form */}
          {isAddingCompany && (
            <form
              onSubmit={onSubmitCompany}
              className="p-4 rounded-lg bg-muted/40 border border-border space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-foreground">
                  Register New Legal Business Entity
                </h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onSetIsAddingCompany(false)}
                  className="text-xs h-7"
                >
                  Cancel
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="newLegalName">Legal Company Name *</Label>
                  <Input
                    id="newLegalName"
                    value={newCompanyName}
                    onChange={(e) => onSetNewCompanyName(e.target.value)}
                    placeholder="e.g. Acme Solar Solutions Pvt Ltd"
                    disabled={isSubmittingCompany}
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="newGstinVal">GSTIN (Optional)</Label>
                  <Input
                    id="newGstinVal"
                    value={newGstin}
                    onChange={(e) => onSetNewGstin(e.target.value)}
                    placeholder="e.g. 27AAKCA9999F1Z9"
                    disabled={isSubmittingCompany}
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="submit"
                  variant="default"
                  size="sm"
                  disabled={isSubmittingCompany || !newCompanyName.trim()}
                >
                  {isSubmittingCompany ? 'Registering...' : 'Add Business Entity'}
                </Button>
              </div>
            </form>
          )}

          {/* Companies List */}
          <div className="space-y-3">
            {companies.map((company) => {
              const isSelected = company.id === selectedCompanyId;
              return (
                <div
                  key={company.id}
                  className={`p-4 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-primary/5 border-primary/40 shadow-xs'
                      : 'bg-card border-border'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Building2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-semibold text-foreground text-sm truncate">
                        {company.legalName}
                      </span>
                      {isSelected && (
                        <Badge variant="default" className="text-[10px]">
                          Active Context
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {company.gstin && (
                        <span className="font-mono bg-muted/60 px-1.5 py-0.5 rounded text-[11px]">
                          GST: {company.gstin}
                        </span>
                      )}
                      {company.constitution && (
                        <span className="capitalize">
                          {company.constitution.replace(/_/g, ' ').toLowerCase()}
                        </span>
                      )}
                      <span className="font-mono text-[10px]">ID: {company.id}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!isSelected && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectCompanyId(company.id)}
                        className="text-xs"
                      >
                        Set as Active
                      </Button>
                    )}
                    <Link to="/company-profile">
                      <Button variant="secondary" size="sm" className="gap-1 text-xs">
                        <span>Capability Dossier</span>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
