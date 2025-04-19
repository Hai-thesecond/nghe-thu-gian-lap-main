/**
 * Utility functions for storing data in localStorage with expiration
 */

// Default expiration times in milliseconds
export const CACHE_DURATIONS = {
  SHORT: 5 * 60 * 1000, // 5 minutes
  MEDIUM: 30 * 60 * 1000, // 30 minutes
  LONG: 4 * 60 * 60 * 1000, // 4 hours
  DAY: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * Type for cache items with expiration
 */
type CacheItem<T> = {
  data: T;
  expiration: number;
  version: string;
};

/**
 * Cache options
 */
type CacheOptions = {
  expiration?: number;
  version?: string;
};

/**
 * Application version for cache invalidation when app updates
 */
const APP_VERSION = '1.0.0';

/**
 * Set an item in localStorage with expiration
 */
export function setCache<T>(key: string, data: T, options: CacheOptions = {}): void {
  try {
    const { expiration = CACHE_DURATIONS.MEDIUM, version = APP_VERSION } = options;
    
    const item: CacheItem<T> = {
      data,
      expiration: Date.now() + expiration,
      version,
    };
    
    localStorage.setItem(key, JSON.stringify(item));
  } catch (error) {
    console.warn('Error setting cache:', error);
  }
}

/**
 * Get an item from localStorage with automatic expiration check
 * Returns null if item is expired or not found
 */
export function getCache<T>(key: string, options: { version?: string } = {}): T | null {
  try {
    const { version = APP_VERSION } = options;
    const item = localStorage.getItem(key);
    
    if (!item) return null;
    
    const parsedItem = JSON.parse(item) as CacheItem<T>;
    
    // Check if cache is expired or version mismatch
    if (parsedItem.expiration < Date.now() || parsedItem.version !== version) {
      localStorage.removeItem(key);
      return null;
    }
    
    return parsedItem.data;
  } catch (error) {
    console.warn('Error getting cache:', error);
    return null;
  }
}

/**
 * Set item expiration time
 */
export function extendCache(key: string, newExpiration: number): boolean {
  try {
    const item = localStorage.getItem(key);
    
    if (!item) return false;
    
    const parsedItem = JSON.parse(item);
    parsedItem.expiration = Date.now() + newExpiration;
    
    localStorage.setItem(key, JSON.stringify(parsedItem));
    return true;
  } catch (error) {
    console.warn('Error extending cache:', error);
    return false;
  }
}

/**
 * Remove an item from localStorage
 */
export function removeCache(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('Error removing cache:', error);
  }
}

/**
 * Clear all expired cache items
 */
export function clearExpiredCache(): void {
  try {
    const now = Date.now();
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      
      if (key) {
        try {
          const item = localStorage.getItem(key);
          
          if (item) {
            const parsedItem = JSON.parse(item);
            
            if (parsedItem.expiration && parsedItem.expiration < now) {
              localStorage.removeItem(key);
            }
          }
        } catch {
          // Skip any items that aren't valid cache items
        }
      }
    }
  } catch (error) {
    console.warn('Error clearing expired cache:', error);
  }
}

/**
 * Create a cache key with a prefix to avoid collisions
 */
export function createCacheKey(type: string, id: string): string {
  return `app_cache_${type}_${id}`;
}

/**
 * Get the remaining time until expiration for a cache item
 * Returns milliseconds remaining or -1 if expired/not found
 */
export function getCacheTimeRemaining(key: string): number {
  try {
    const item = localStorage.getItem(key);
    
    if (!item) return -1;
    
    const parsedItem = JSON.parse(item);
    const remaining = parsedItem.expiration - Date.now();
    
    return remaining > 0 ? remaining : -1;
  } catch {
    return -1;
  }
} 