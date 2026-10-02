import React from 'react';
import { colors } from '@tenderpulse/ui';

export const App: React.FC = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: colors.surface.bg,
        color: colors.surface.text,
        padding: '2rem',
        boxSizing: 'border-box',
      }}
    >
      <header
        style={{
          borderBottom: `1px solid ${colors.surface.border}`,
          paddingBottom: '1.5rem',
          marginBottom: '2rem',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>TenderPulse AI</h1>
        <p style={{ margin: '0.5rem 0 0 0', color: colors.surface.muted }}>
          Indian Government Tender Bid Compliance & Disqualification Prevention
        </p>
      </header>

      <main>
        <div
          style={{
            backgroundColor: colors.surface.card,
            border: `1px solid ${colors.surface.border}`,
            borderRadius: '0.75rem',
            padding: '1.5rem',
            maxWidth: '600px',
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: '1.25rem' }}>
            System Status: Foundations Operational
          </h2>
          <p style={{ color: colors.surface.muted, lineHeight: 1.6 }}>
            Monorepo architecture initialized with decoupled API, AI Worker, and shared design
            tokens.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <span
              style={{
                backgroundColor: colors.status.ready,
                color: '#ffffff',
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              API: Ready
            </span>
            <span
              style={{
                backgroundColor: colors.status.pending,
                color: '#ffffff',
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              AI Engine: Ready
            </span>
          </div>
        </div>
      </main>
    </div>
  );
};
