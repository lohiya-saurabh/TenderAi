import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from '@/components/layout/Header.js';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs.js';
import { BreadcrumbTitleProvider } from '@/components/layout/BreadcrumbTitle.js';

export const AppShell: React.FC = () => {
  // The clause workspace uses the full width (list, source and panel side by side).
  const fullWidth = /^\/bids\/[^/]+\/clauses/.test(useLocation().pathname);

  return (
    <BreadcrumbTitleProvider>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <Header />
        <main
          className={
            fullWidth
              ? 'flex-1 w-full px-4 py-3'
              : 'flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5'
          }
        >
          {!fullWidth && <Breadcrumbs />}
          <Outlet />
        </main>
      </div>
    </BreadcrumbTitleProvider>
  );
};
