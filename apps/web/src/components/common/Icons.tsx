import React from 'react';
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  Clock,
  Ban,
  ShieldAlert,
  TriangleAlert,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  X,
  Trash2,
  Check,
  Search,
  ListFilter,
  Info,
  Copy,
  ExternalLink,
  Loader2,
  Menu,
  FileSearch,
  PlusCircle,
  Building2,
  User,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideProps,
} from 'lucide-react';

export interface IconProps extends Omit<LucideProps, 'size'> {
  size?: number | string;
  color?: string;
  className?: string;
}

// -------------------------------------------------------------
// Semantic Status Icons (Lucide-based)
// -------------------------------------------------------------

/** PASS: Lucide CheckCircle2 */
export const PassIcon: React.FC<IconProps> = ({ size = 16, color, className, ...props }) => (
  <CheckCircle2 size={size} color={color} className={className} aria-hidden="true" {...props} />
);

/** FAIL: Lucide XCircle */
export const FailIcon: React.FC<IconProps> = ({ size = 16, color, className, ...props }) => (
  <XCircle size={size} color={color} className={className} aria-hidden="true" {...props} />
);

/** MISSING: Lucide MinusCircle */
export const MissingIcon: React.FC<IconProps> = ({ size = 16, color, className, ...props }) => (
  <MinusCircle size={size} color={color} className={className} aria-hidden="true" {...props} />
);

/** REVIEW_REQUIRED: Lucide Clock */
export const ReviewRequiredIcon: React.FC<IconProps> = ({
  size = 16,
  color,
  className,
  ...props
}) => <Clock size={size} color={color} className={className} aria-hidden="true" {...props} />;

/** NOT_APPLICABLE: Lucide Ban */
export const NotApplicableIcon: React.FC<IconProps> = ({
  size = 16,
  color,
  className,
  ...props
}) => <Ban size={size} color={color} className={className} aria-hidden="true" {...props} />;

// -------------------------------------------------------------
// Semantic Risk Level Icons (Lucide-based)
// -------------------------------------------------------------

/** CRITICAL RISK: Lucide ShieldAlert */
export const CriticalRiskIcon: React.FC<IconProps> = ({
  size = 16,
  color,
  className,
  ...props
}) => <ShieldAlert size={size} color={color} className={className} aria-hidden="true" {...props} />;

/** HIGH RISK: Lucide TriangleAlert */
export const HighRiskIcon: React.FC<IconProps> = ({ size = 16, color, className, ...props }) => (
  <TriangleAlert size={size} color={color} className={className} aria-hidden="true" {...props} />
);

/** MEDIUM RISK: Lucide AlertCircle */
export const MediumRiskIcon: React.FC<IconProps> = ({ size = 16, color, className, ...props }) => (
  <AlertCircle size={size} color={color} className={className} aria-hidden="true" {...props} />
);

/** LOW RISK: Lucide ShieldCheck */
export const LowRiskIcon: React.FC<IconProps> = ({ size = 16, color, className, ...props }) => (
  <ShieldCheck size={size} color={color} className={className} aria-hidden="true" {...props} />
);

// -------------------------------------------------------------
// Common Navigation & UI Control Icons (Lucide-based)
// -------------------------------------------------------------

export const ChevronRightIcon: React.FC<IconProps> = ({
  size = 16,
  color,
  className,
  ...props
}) => (
  <ChevronRight size={size} color={color} className={className} aria-hidden="true" {...props} />
);

export const ChevronDownIcon: React.FC<IconProps> = ({ size = 16, color, className, ...props }) => (
  <ChevronDown size={size} color={color} className={className} aria-hidden="true" {...props} />
);

export const ChevronLeftIcon: React.FC<IconProps> = ({ size = 16, color, className, ...props }) => (
  <ChevronLeft size={size} color={color} className={className} aria-hidden="true" {...props} />
);

export const ChevronUpIcon: React.FC<IconProps> = ({ size = 16, color, className, ...props }) => (
  <ChevronUp size={size} color={color} className={className} aria-hidden="true" {...props} />
);

export const CloseIcon: React.FC<IconProps> = ({ size = 16, color, className, ...props }) => (
  <X size={size} color={color} className={className} aria-hidden="true" {...props} />
);

export const XIcon = CloseIcon;

export const TrashIcon: React.FC<IconProps> = ({ size = 16, color, className, ...props }) => (
  <Trash2 size={size} color={color} className={className} aria-hidden="true" {...props} />
);

export const CheckIcon: React.FC<IconProps> = ({ size = 16, color, className, ...props }) => (
  <Check size={size} color={color} className={className} aria-hidden="true" {...props} />
);

export const SearchIcon: React.FC<IconProps> = ({ size = 16, color, className, ...props }) => (
  <Search size={size} color={color} className={className} aria-hidden="true" {...props} />
);

export const FilterIcon: React.FC<IconProps> = ({ size = 16, color, className, ...props }) => (
  <ListFilter size={size} color={color} className={className} aria-hidden="true" {...props} />
);

export const InfoIcon: React.FC<IconProps> = ({ size = 16, color, className, ...props }) => (
  <Info size={size} color={color} className={className} aria-hidden="true" {...props} />
);

export const WarningIcon: React.FC<IconProps> = ({ size = 16, color, className, ...props }) => (
  <TriangleAlert size={size} color={color} className={className} aria-hidden="true" {...props} />
);

export const AlertCircleIcon: React.FC<IconProps> = ({ size = 16, color, className, ...props }) => (
  <AlertCircle size={size} color={color} className={className} aria-hidden="true" {...props} />
);

export const CopyIcon: React.FC<IconProps> = ({ size = 16, color, className, ...props }) => (
  <Copy size={size} color={color} className={className} aria-hidden="true" {...props} />
);

export const ExternalLinkIcon: React.FC<IconProps> = ({
  size = 16,
  color,
  className,
  ...props
}) => (
  <ExternalLink size={size} color={color} className={className} aria-hidden="true" {...props} />
);

export const SpinnerIcon: React.FC<IconProps> = ({
  size = 16,
  color,
  className = '',
  ...props
}) => (
  <Loader2
    size={size}
    color={color}
    className={`animate-spin ${className}`}
    aria-hidden="true"
    {...props}
  />
);

export const MenuIcon: React.FC<IconProps> = ({ size = 20, color, className, ...props }) => (
  <Menu size={size} color={color} className={className} aria-hidden="true" {...props} />
);

export const TendersIcon: React.FC<IconProps> = ({ size = 18, color, className, ...props }) => (
  <FileSearch size={size} color={color} className={className} aria-hidden="true" {...props} />
);

export const PlusCircleIcon: React.FC<IconProps> = ({ size = 18, color, className, ...props }) => (
  <PlusCircle size={size} color={color} className={className} aria-hidden="true" {...props} />
);

export const BuildingOfficeIcon: React.FC<IconProps> = ({
  size = 18,
  color,
  className,
  ...props
}) => <Building2 size={size} color={color} className={className} aria-hidden="true" {...props} />;

export const UserIcon: React.FC<IconProps> = ({ size = 18, color, className, ...props }) => (
  <User size={size} color={color} className={className} aria-hidden="true" {...props} />
);

export const LogoutIcon: React.FC<IconProps> = ({ size = 18, color, className, ...props }) => (
  <LogOut size={size} color={color} className={className} aria-hidden="true" {...props} />
);

export const SidebarCollapseIcon: React.FC<IconProps> = ({
  size = 18,
  color,
  className,
  ...props
}) => (
  <PanelLeftClose size={size} color={color} className={className} aria-hidden="true" {...props} />
);

export const SidebarExpandIcon: React.FC<IconProps> = ({
  size = 18,
  color,
  className,
  ...props
}) => (
  <PanelLeftOpen size={size} color={color} className={className} aria-hidden="true" {...props} />
);

export const ShieldLockIcon: React.FC<IconProps> = ({ size = 18, color, className, ...props }) => (
  <ShieldCheck size={size} color={color} className={className} aria-hidden="true" {...props} />
);
