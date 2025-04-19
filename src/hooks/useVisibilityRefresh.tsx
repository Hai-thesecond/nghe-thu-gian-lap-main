import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to refresh data when a tab becomes visible, with improved behavior
 *
 * @param refreshCallback The function to call when tab visibility changes (can be null to disable refresh)
 * @param minTimeAwayMs Minimum time in milliseconds the tab must be away to trigger refresh (default: 60s)
 * @param dependencies Optional dependencies for the callback
 * @param debug Whether to log debug information (default: false)
 */
function useVisibilityRefresh(
  refreshCallback: (() => void | Promise<void>) | null,
  minTimeAwayMs: number = 60000, // Default to 1 minute
  dependencies: React.DependencyList = [],
  debug: boolean = false
) {
  const lastVisibleTime = useRef<number>(Date.now());
  const isRefreshing = useRef<boolean>(false);
  const componentName = useRef<string>('Component');
  
  // Store the last refresh time in localStorage to coordinate between components
  const getLastRefreshTime = useCallback(() => {
    try {
      const storedTime = localStorage.getItem('global_last_refresh_time');
      return storedTime ? parseInt(storedTime, 10) : 0;
    } catch (e) {
      return 0;
    }
  }, []);
  
  const setLastRefreshTime = useCallback((time: number) => {
    try {
      localStorage.setItem('global_last_refresh_time', String(time));
    } catch (e) {
      // Ignore errors
    }
  }, []);
  
  // Extract component name from call stack if debug is enabled
  useEffect(() => {
    if (debug) {
      try {
        const stack = new Error().stack || '';
        const callerLine = stack.split('\n')[2] || '';
        const match = callerLine.match(/at\s+(.*?)\s+\(/);
        if (match && match[1]) {
          componentName.current = match[1].split('.').pop() || 'Component';
        }
      } catch (e) {
        // Ignore errors in debug code
      }
    }
  }, [debug]);
  
  // Memoize the visibility change handler
  const handleVisibilityChange = useCallback(() => {
    // If no callback provided, do nothing
    if (!refreshCallback) return;
    
    const currentTime = Date.now();
    const timeAway = currentTime - lastVisibleTime.current;
    const lastGlobalRefresh = getLastRefreshTime();
    const timeSinceLastGlobalRefresh = currentTime - lastGlobalRefresh;
    
    if (document.visibilityState === 'visible') {
      if (debug) {
        console.log(`[${componentName.current}] Tab became visible after ${(timeAway / 1000).toFixed(1)}s away (min: ${minTimeAwayMs/1000}s)`);
        console.log(`[${componentName.current}] Last global refresh: ${(timeSinceLastGlobalRefresh / 1000).toFixed(1)}s ago`);
      }
      
      lastVisibleTime.current = currentTime;
      
      // Only refresh if:
      // 1. Away for more than the minimum time
      // 2. Not already refreshing
      // 3. No global refresh happened recently (within half the minTimeAwayMs)
      if (
        timeAway >= minTimeAwayMs && 
        !isRefreshing.current && 
        timeSinceLastGlobalRefresh >= (minTimeAwayMs / 2)
      ) {
        if (debug) {
          console.log(`[${componentName.current}] Triggering refresh callback`);
        }
        
        isRefreshing.current = true;
        setLastRefreshTime(currentTime);
        
        // Execute the refresh callback
        try {
          const result = refreshCallback();
          
          // Handle promise if returned
          if (result instanceof Promise) {
            result
              .then(() => {
                if (debug) console.log(`[${componentName.current}] Refresh completed successfully`);
              })
              .catch((error) => {
                console.error(`[${componentName.current}] Refresh failed:`, error);
              })
              .finally(() => {
                isRefreshing.current = false;
              });
          } else {
            if (debug) console.log(`[${componentName.current}] Refresh completed (sync)`);
            isRefreshing.current = false;
          }
        } catch (error) {
          console.error(`[${componentName.current}] Error in visibility refresh callback:`, error);
          isRefreshing.current = false;
        }
      } else if (debug) {
        if (timeAway < minTimeAwayMs) {
          console.log(`[${componentName.current}] Skipped refresh (away for ${(timeAway/1000).toFixed(1)}s < min ${(minTimeAwayMs/1000).toFixed(1)}s)`);
        } else if (timeSinceLastGlobalRefresh < (minTimeAwayMs / 2)) {
          console.log(`[${componentName.current}] Skipped refresh (global refresh happened ${(timeSinceLastGlobalRefresh/1000).toFixed(1)}s ago)`);
        }
      }
    } else {
      // Tab is hidden now, update the last visible time
      if (debug) {
        console.log(`[${componentName.current}] Tab became hidden, tracking time`);
      }
      lastVisibleTime.current = currentTime;
    }
  }, [refreshCallback, minTimeAwayMs, debug, getLastRefreshTime, setLastRefreshTime]);
  
  // Set up and cleanup the visibility change listener
  useEffect(() => {
    // Initialize the last visible time
    lastVisibleTime.current = Date.now();
    
    if (debug) {
      console.log(`[${componentName.current}] Initialized visibility refresh hook (min away: ${minTimeAwayMs/1000}s)`);
    }
    
    // Only add listener if a callback is provided
    if (refreshCallback) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    
      // Clean up
      return () => {
        if (debug) {
          console.log(`[${componentName.current}] Cleaning up visibility refresh hook`);
        }
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
    
    return undefined;
  }, [handleVisibilityChange, debug, minTimeAwayMs, refreshCallback]);
}

export default useVisibilityRefresh; 
 
 