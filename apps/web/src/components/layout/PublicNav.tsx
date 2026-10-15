import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth.js';
import { Button } from '@/components/ui/button.js';
import { ShieldCheck, ArrowRight, Layers, FileCheck2, Cpu, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext.js';

export const PublicNav: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm tracking-wider shadow-xs group-hover:scale-105 transition-transform">
            TP
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-foreground transition-colors">
              TenderPulse<span className="text-vermilion">.ai</span>
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">
              Bid Readiness SaaS
            </span>
          </div>
        </Link>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <a
            href="/#features"
            className="hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Platform</span>
          </a>
          <a
            href="/#workflow"
            className="hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <Cpu className="h-3.5 w-3.5" />
            <span>Workflow</span>
          </a>
          <a
            href="/#security"
            className="hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Enterprise Security</span>
          </a>
          <Link
            to="/pricing"
            className="hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <FileCheck2 className="h-3.5 w-3.5" />
            <span>Pricing</span>
          </Link>
        </nav>

        {/* Right CTA / Auth Status & Theme Switcher */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleTheme}
            className="h-8 px-2.5 text-xs font-semibold gap-1.5 border-border hover:bg-accent cursor-pointer transition-colors shadow-2xs"
            aria-label={`Current theme: ${theme === 'dark' ? 'Dark' : 'Light'}. Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Current theme: ${theme === 'dark' ? 'Dark' : 'Light'}. Click to toggle`}
          >
            {theme === 'dark' ? (
              <Moon className="h-3.5 w-3.5 text-orange-400" />
            ) : (
              <Sun className="h-3.5 w-3.5 text-amber-500" />
            )}
            <span className="hidden sm:inline text-xs font-mono font-medium text-foreground">
              {theme === 'dark' ? 'Dark' : 'Light'}
            </span>
          </Button>
          {isAuthenticated ? (
            <Link to="/bids">
              <Button size="sm" className="gap-2 text-xs font-semibold shadow-xs">
                <span>Enter Workspace</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm" className="text-xs font-medium">
                  Sign In
                </Button>
              </Link>
              <Link to="/signup">
                <Button size="sm" className="gap-1.5 text-xs font-semibold shadow-xs">
                  <span>Start Free</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
