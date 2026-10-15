import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { LandingPage } from '@/pages/LandingPage.js';
import { PricingPage } from '@/pages/PricingPage.js';
import { PublicNav } from '@/components/layout/PublicNav.js';
import { PublicFooter } from '@/components/layout/PublicFooter.js';
import { AuthProvider } from '@/auth/AuthProvider.js';

describe('Public Landing & Pricing Pages Link Verification', () => {
  it('should render all expected navigation and CTA links on the LandingPage', () => {
    const html = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/'] },
        React.createElement(AuthProvider, null, React.createElement(LandingPage)),
      ),
    );

    // 1. Navigation header links
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/#features"');
    expect(html).toContain('href="/#workflow"');
    expect(html).toContain('href="/#security"');
    expect(html).toContain('href="/pricing"');
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/signup"');

    // 2. Hero CTAs
    expect(html).toContain('href="/signup"');
    expect(html).toContain('href="/pricing"');

    // 3. Embedded Plan Cards CTAs
    expect(html).toContain('href="/signup?plan=FREE&amp;interval=MONTHLY"');
    expect(html).toContain('href="/signup?plan=STARTER&amp;interval=MONTHLY"');
    expect(html).toContain('href="/signup?plan=GROWTH&amp;interval=MONTHLY"');
    expect(html).toContain('href="/signup?plan=BUSINESS&amp;interval=MONTHLY"');
    expect(html).toContain('href="/signup?plan=ENTERPRISE"');

    // 4. Section anchors exist on page
    expect(html).toContain('id="features"');
    expect(html).toContain('id="workflow"');
    expect(html).toContain('id="security"');

    // 5. Footer links
    expect(html).toContain('href="/#features"');
    expect(html).toContain('href="/#workflow"');
    expect(html).toContain('href="/pricing"');
    expect(html).toContain('href="/signup"');
    expect(html).toContain('href="/login"');
  });

  it('should render all expected plan selection and toggle links on the PricingPage', () => {
    const html = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/pricing'] },
        React.createElement(AuthProvider, null, React.createElement(PricingPage)),
      ),
    );

    // 1. Header brand & navigation
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/#features"');
    expect(html).toContain('href="/#workflow"');
    expect(html).toContain('href="/#security"');
    expect(html).toContain('href="/pricing"');

    // 2. Tier Selection Links to Signup with specific tier parameters
    expect(html).toContain('href="/signup?plan=FREE&amp;interval=MONTHLY"');
    expect(html).toContain('href="/signup?plan=STARTER&amp;interval=MONTHLY"');
    expect(html).toContain('href="/signup?plan=GROWTH&amp;interval=MONTHLY"');
    expect(html).toContain('href="/signup?plan=BUSINESS&amp;interval=MONTHLY"');
    expect(html).toContain('href="/signup?plan=ENTERPRISE"');

    // 3. Footer navigation
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/signup"');
  });

  it('should render PublicNav links correctly', () => {
    const html = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/'] },
        React.createElement(AuthProvider, null, React.createElement(PublicNav)),
      ),
    );

    expect(html).toContain('href="/"');
    expect(html).toContain('href="/#features"');
    expect(html).toContain('href="/#workflow"');
    expect(html).toContain('href="/#security"');
    expect(html).toContain('href="/pricing"');
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/signup"');
  });

  it('should render PublicFooter links correctly', () => {
    const html = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/'] },
        React.createElement(PublicFooter),
      ),
    );

    expect(html).toContain('href="/#features"');
    expect(html).toContain('href="/#workflow"');
    expect(html).toContain('href="/pricing"');
    expect(html).toContain('href="/signup"');
    expect(html).toContain('href="/login"');
  });
});
