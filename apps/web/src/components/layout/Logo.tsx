import React from 'react';

/** The TenderPulse mark and name, used by the app header, public nav and footer. */
export const Logo: React.FC<{ tagline?: string }> = ({ tagline }) => (
  <span className="flex items-center gap-2.5">
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground"
    >
      TP
    </span>
    <span className="flex flex-col leading-tight">
      <span className="text-base font-bold tracking-tight text-foreground">TenderPulse</span>
      {tagline && <span className="text-2xs text-muted-foreground">{tagline}</span>}
    </span>
  </span>
);
