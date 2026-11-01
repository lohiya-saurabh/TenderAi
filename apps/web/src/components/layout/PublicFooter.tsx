import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/layout/Logo.js';

const linkClass = 'transition-colors hover:text-foreground';

export const PublicFooter: React.FC = () => (
  <footer className="w-full border-t border-border bg-card text-muted-foreground">
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
        <div className="space-y-3">
          <Logo />
          <p className="text-sm leading-relaxed">
            Bid assurance for large works tenders: every requirement, its source page and the proof
            behind it, checked before you submit.
          </p>
        </div>

        <nav className="space-y-3" aria-label="Product">
          <h4 className="text-xs font-semibold text-foreground">Product</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <a href="/#features" className={linkClass}>
                Why bids are rejected
              </a>
            </li>
            <li>
              <a href="/#workflow" className={linkClass}>
                How it works
              </a>
            </li>
            <li>
              <a href="/#security" className={linkClass}>
                Trust and security
              </a>
            </li>
          </ul>
        </nav>

        <nav className="space-y-3" aria-label="Account">
          <h4 className="text-xs font-semibold text-foreground">Account</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/pricing" className={linkClass}>
                Pricing
              </Link>
            </li>
            <li>
              <Link to="/signup" className={linkClass}>
                Create a workspace
              </Link>
            </li>
            <li>
              <Link to="/login" className={linkClass}>
                Sign in
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <p className="mt-10 border-t border-border pt-6 text-xs">
        &copy; {new Date().getFullYear()} TenderPulse AI
      </p>
    </div>
  </footer>
);
