/**
 * Lets a bid page give the breadcrumb its real tender title instead of the id slug.
 * Keyed by bid id, so a title from a previous bid never shows on another one.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

interface BidTitle {
  bidId: string;
  title: string;
}

interface BreadcrumbTitleValue {
  bidTitle: BidTitle | null;
  setBidTitle: (value: BidTitle | null) => void;
}

const BreadcrumbTitleContext = createContext<BreadcrumbTitleValue>({
  bidTitle: null,
  setBidTitle: () => {},
});

export const BreadcrumbTitleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bidTitle, setBidTitle] = useState<BidTitle | null>(null);
  const value = useMemo(() => ({ bidTitle, setBidTitle }), [bidTitle]);
  return (
    <BreadcrumbTitleContext.Provider value={value}>{children}</BreadcrumbTitleContext.Provider>
  );
};

/** Title for the given bid id, if a page has supplied one. */
export function useBidBreadcrumbTitle(bidId: string): string | null {
  const { bidTitle } = useContext(BreadcrumbTitleContext);
  return bidTitle && bidTitle.bidId === bidId ? bidTitle.title : null;
}

/** Call from a bid page once its title is known. */
export function useSetBidBreadcrumbTitle(bidId: string, title: string | null | undefined): void {
  const { setBidTitle } = useContext(BreadcrumbTitleContext);
  useEffect(() => {
    if (title) setBidTitle({ bidId, title });
  }, [bidId, title, setBidTitle]);
}
