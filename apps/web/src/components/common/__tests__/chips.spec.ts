import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StatusBadge } from '@/components/common/StatusBadge.js';
import { RiskBadge } from '@/components/common/RiskBadge.js';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe('status chips', () => {
  it('always carry text, never colour alone', () => {
    expect(html(React.createElement(StatusBadge, { status: 'REVIEW_REQUIRED' }))).toContain(
      'Review required',
    );
    expect(html(React.createElement(StatusBadge, { status: 'PASS', iconOnly: true }))).toContain(
      'Pass',
    );
    expect(html(React.createElement(RiskBadge, { level: 'HIGH', showLabel: false }))).toContain(
      'High',
    );
  });

  it('take their colour from the design tokens', () => {
    expect(html(React.createElement(StatusBadge, { status: 'FAILED' }))).toContain(
      'text-destructive',
    );
    expect(html(React.createElement(StatusBadge, { status: 'something_new' }))).toContain(
      'Something new',
    );
  });
});
