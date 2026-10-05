import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
  className?: string;
}

// -------------------------------------------------------------
// Semantic Status Icons (Do not rely only on color!)
// -------------------------------------------------------------

/** PASS: Circle with Checkmark */
export const PassIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    {...props}
  >
    <circle cx="10" cy="10" r="8.5" stroke={color} strokeWidth="1.75" />
    <path
      d="M6.5 10.2L8.8 12.5L13.5 7.8"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** FAIL: Circle with X Cross */
export const FailIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    {...props}
  >
    <circle cx="10" cy="10" r="8.5" stroke={color} strokeWidth="1.75" />
    <path
      d="M7.5 7.5L12.5 12.5M12.5 7.5L7.5 12.5"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

/** MISSING: Circle with Alert / Dash */
export const MissingIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    {...props}
  >
    <circle cx="10" cy="10" r="8.5" stroke={color} strokeWidth="1.75" />
    <path d="M7 10H13" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/** REVIEW_REQUIRED: Inspection Eye / Clock */
export const ReviewRequiredIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    {...props}
  >
    <circle cx="10" cy="10" r="8.5" stroke={color} strokeWidth="1.75" />
    <path
      d="M10 6V10.2L12.8 11.6"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** NOT_APPLICABLE: Proscribed Slash Circle */
export const NotApplicableIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    {...props}
  >
    <circle cx="10" cy="10" r="8.5" stroke={color} strokeWidth="1.75" />
    <line x1="4.5" y1="15.5" x2="15.5" y2="4.5" stroke={color} strokeWidth="1.75" />
  </svg>
);

// -------------------------------------------------------------
// Semantic Risk Level Icons
// -------------------------------------------------------------

/** CRITICAL RISK: Shield with Exclamation Mark */
export const CriticalRiskIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    {...props}
  >
    <path
      d="M10 2L3.5 5V9.5C3.5 14 6.5 17.5 10 18.5C13.5 17.5 16.5 14 16.5 9.5V5L10 2Z"
      stroke={color}
      strokeWidth="1.75"
      strokeLinejoin="round"
    />
    <path d="M10 7V10.5M10 13.5H10.01" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/** HIGH RISK: Alert Triangle */
export const HighRiskIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    {...props}
  >
    <path
      d="M10 2.5L2 17H18L10 2.5Z"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M10 7.5V11.5M10 14.5H10.01" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/** MEDIUM RISK: Warning Hexagon / Circle */
export const MediumRiskIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    {...props}
  >
    <circle cx="10" cy="10" r="8" stroke={color} strokeWidth="1.75" />
    <path d="M10 6.5V10.5M10 13.5H10.01" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/** LOW RISK: Shield Check / Info */
export const LowRiskIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    {...props}
  >
    <path
      d="M10 2.5L3.5 5.5V9.8C3.5 13.8 6.5 17 10 18C13.5 17 16.5 13.8 16.5 9.8V5.5L10 2.5Z"
      stroke={color}
      strokeWidth="1.75"
      strokeLinejoin="round"
    />
    <path
      d="M7 10L9 12L13 8"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// -------------------------------------------------------------
// Common Navigation & UI Control Icons
// -------------------------------------------------------------

export const ChevronRightIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
    <path d="M7.5 4.5L13 10L7.5 15.5" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ChevronDownIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
    <path d="M4.5 7.5L10 13L15.5 7.5" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ChevronLeftIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
    <path d="M12.5 15.5L7 10L12.5 4.5" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ChevronUpIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
    <path d="M15.5 12.5L10 7L4.5 12.5" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const CloseIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
    <path d="M5 5L15 15M15 5L5 15" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

export const XIcon = CloseIcon;

export const TrashIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    {...props}
  >
    <path
      d="M3 5.5H17M8 5.5V3.5C8 3.2 8.2 3 8.5 3H11.5C11.8 3 12 3.2 12 3.5V5.5M5.5 5.5L6.3 15.2C6.4 16 7 16.5 7.8 16.5H12.2C13 16.5 13.6 16 13.7 15.2L14.5 5.5"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8.5 8.5V13M11.5 8.5V13"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export const CheckIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
    <path d="M4 10.5L8 14.5L16 6.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const SearchIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
    <circle cx="8.5" cy="8.5" r="5.5" stroke={color} strokeWidth="1.75" />
    <path d="M12.5 12.5L16.5 16.5" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

export const FilterIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
    <path d="M3 4H17L11.5 10.5V15.5L8.5 17V10.5L3 4Z" stroke={color} strokeWidth="1.75" strokeLinejoin="round" />
  </svg>
);

export const InfoIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
    <circle cx="10" cy="10" r="8.5" stroke={color} strokeWidth="1.75" />
    <path d="M10 9V14M10 6.5H10.01" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const WarningIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
    <path d="M10 2.5L2 17H18L10 2.5Z" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 7.5V11.5M10 14.5H10.01" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const AlertCircleIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
    <circle cx="10" cy="10" r="8.5" stroke={color} strokeWidth="1.75" />
    <path d="M10 6.5V10.5M10 13.5H10.01" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const CopyIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
    <rect x="7" y="7" width="9" height="9" rx="1.5" stroke={color} strokeWidth="1.75" />
    <path d="M4 13V4.5C4 3.95 4.45 3.5 5 3.5H13" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

export const ExternalLinkIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
    <path d="M14 10.5V15.5C14 16.05 13.55 16.5 13 16.5H4.5C3.95 16.5 3.5 16.05 3.5 15.5V7C3.5 6.45 3.95 6 4.5 6H9.5" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
    <path d="M11.5 3.5H16.5V8.5M16.2 3.8L9.5 10.5" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const SpinnerIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="spin"
    aria-hidden="true"
    {...props}
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
    <path
      d="M12 2C6.48 2 2 6.48 2 12"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
);

export const MenuIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
    <path d="M4 6H20M4 12H20M4 18H20" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const TendersIcon: React.FC<IconProps> = ({ size = 18, color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
    <path
      d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5M9 12H15M9 16H13"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const PlusCircleIcon: React.FC<IconProps> = ({ size = 18, color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.75" />
    <path d="M12 8V16M8 12H16" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const BuildingOfficeIcon: React.FC<IconProps> = ({ size = 18, color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
    <path
      d="M3 21H21M4 21V5C4 3.89543 4.89543 3 6 3H14C15.1046 3 16 3.89543 16 5V21M16 9H18C19.1046 9 20 9.89543 20 11V21M8 7H12M8 11H12M8 15H12M8 19H12"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const UserIcon: React.FC<IconProps> = ({ size = 18, color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
    <circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.75" />
    <path
      d="M5 20C5 16.6863 8.13401 14 12 14C15.866 14 19 16.6863 19 20"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
);

export const LogoutIcon: React.FC<IconProps> = ({ size = 18, color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
    <path
      d="M16 17L21 12L16 7M21 12H9M9 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H9"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const SidebarCollapseIcon: React.FC<IconProps> = ({ size = 18, color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2" stroke={color} strokeWidth="1.75" />
    <path d="M9 4V20M15 15L12 12L15 9" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const SidebarExpandIcon: React.FC<IconProps> = ({ size = 18, color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2" stroke={color} strokeWidth="1.75" />
    <path d="M9 4V20M13 9L16 12L13 15" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ShieldLockIcon: React.FC<IconProps> = ({ size = 18, color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
    <path
      d="M12 2L4 5V11C4 16.5 7.5 21.5 12 22C16.5 21.5 20 16.5 20 11V5L12 2Z"
      stroke={color}
      strokeWidth="1.75"
      strokeLinejoin="round"
    />
    <rect x="10" y="11" width="4" height="4" rx="0.5" stroke={color} strokeWidth="1.5" />
    <path d="M10.5 11V9.5C10.5 8.67 11.17 8 12 8C12.83 8 13.5 8.67 13.5 9.5V11" stroke={color} strokeWidth="1.5" />
  </svg>
);

