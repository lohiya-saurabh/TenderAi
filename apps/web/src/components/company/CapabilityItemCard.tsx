import React from 'react';
import { Button } from '../common/Button.js';
import { CapabilityStatusBadge } from './CapabilityStatusBadge.js';
import { type BaseCapabilityItem, getDaysUntilExpiry } from './companyProfileData.js';
import { AlertTriangle, FileText } from 'lucide-react';

export interface KeyValueField {
  label: string;
  value: React.ReactNode;
  isMono?: boolean;
  highlight?: boolean;
}

export interface CapabilityItemCardProps {
  item: BaseCapabilityItem;
  typeBadge?: string;
  fields: KeyValueField[];
  expiryDate?: string | null;
  onViewEvidence?: (docName: string) => void;
  onEdit?: () => void;
  children?: React.ReactNode;
}

export const CapabilityItemCard: React.FC<CapabilityItemCardProps> = ({
  item,
  typeBadge,
  fields,
  expiryDate,
  onViewEvidence,
  onEdit,
  children,
}) => {
  const daysRemaining = getDaysUntilExpiry(expiryDate);

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col gap-4 transition-colors">
      {/* Top Header */}
      <div className="flex justify-between items-start flex-wrap gap-2">
        <div className="flex items-center gap-2.5 flex-wrap">
          {typeBadge && (
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
              {typeBadge}
            </span>
          )}
          <h3 className="text-sm font-bold text-foreground m-0">{item.title}</h3>
        </div>

        <div className="flex items-center gap-2">
          <CapabilityStatusBadge status={item.status} size="sm" />
          {onEdit && (
            <Button variant="ghost" size="sm" onClick={onEdit} className="text-xs h-7 px-2">
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Structured Key-Value Fields Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-border/70">
        {fields.map((f, idx) => (
          <div key={idx} className="flex flex-col gap-1 min-w-0">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {f.label}
            </span>
            <span
              className={`text-xs ${
                f.highlight ? 'font-bold text-foreground' : 'font-medium text-foreground'
              } ${f.isMono ? 'font-mono' : ''} truncate break-words`}
            >
              {f.value}
            </span>
          </div>
        ))}

        {expiryDate && (
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Validity / Expiry
            </span>
            <span className="text-xs font-semibold text-foreground">
              {expiryDate}{' '}
              {daysRemaining !== null && (
                <span
                  className={`text-[11px] ${daysRemaining <= 30 ? 'text-orange-600 font-bold' : 'text-muted-foreground'}`}
                >
                  ({daysRemaining > 0 ? `${daysRemaining}d left` : 'Expired'})
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Verification Notes / Alert */}
      {item.verificationNotes && (
        <div className="text-xs text-orange-700 dark:text-orange-400 bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/50 rounded-lg p-2.5 flex items-center gap-2">
          <AlertTriangle size={14} className="shrink-0 text-orange-600 dark:text-orange-400" />
          <span>{item.verificationNotes}</span>
        </div>
      )}

      {/* Linked Evidence Document Footprint */}
      <div className="flex justify-between items-center flex-wrap gap-2 pt-2 border-t border-border/60">
        {item.evidenceDocName ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText size={13} className="shrink-0 text-muted-foreground" />
            <span>
              Linked Evidence:{' '}
              <strong className="text-foreground font-mono font-medium">
                {item.evidenceDocName}
              </strong>
              {item.evidenceDocSize && ` (${item.evidenceDocSize})`}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground italic">No evidence document linked</span>
        )}

        {item.evidenceDocName && onViewEvidence && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewEvidence(item.evidenceDocName!)}
            className="text-xs h-7 px-2"
          >
            Inspect Document ↗
          </Button>
        )}
      </div>

      {children}
    </div>
  );
};
