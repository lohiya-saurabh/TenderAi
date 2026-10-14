import { useEffect, useState } from 'react';
import { getBreakpoint, type Breakpoint } from '../components/dashboard/tenderListData.js';

/**
 * Reactive viewport breakpoint.
 *
 * Defaults to 'xl' (full column set) when no window is available
 * (tests, SSR) so the table renders its complete layout and the
 * pure getBreakpoint/getVisibleColumns functions remain the single
 * source of truth for responsive behavior.
 */
export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() =>
    typeof window === 'undefined' ? 'xl' : getBreakpoint(window.innerWidth),
  );

  useEffect(() => {
    const handleResize = () => setBreakpoint(getBreakpoint(window.innerWidth));

    // Sync in case the initial width changed between render and mount
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return breakpoint;
}
