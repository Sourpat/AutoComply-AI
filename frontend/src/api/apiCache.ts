/**
 * API Cache and Request Deduplication
 * 
 * Provides in-memory caching and deduplication for API calls:
 * - Caches GET responses with configurable TTL (default 10s)
 * - Deduplicates in-flight requests (same key returns same promise)
 * - Zero overhead for mutations (POST/PUT/PATCH/DELETE)
 * 
 * Cache key: method + url + bodyHash
 */

// ============================================================================
// Types
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface InFlightRequest<T> {
  promise: Promise<T>;
}

// ============================================================================
// Cache Storage
// ============================================================================

const cache = new Map<string, CacheEntry<any>>();
const inFlight = new Map<string, InFlightRequest<any>>();

// ============================================================================
// Cache Helpers
// ============================================================================

/**
 * Generate cache key from request parameters
 * 
 * @param method - HTTP method
 * @param url - Request URL
 * @param body - Optional request body (for POST/PUT/PATCH)
 * @returns Cache key string
 */
function getCacheKey(method: string, url: string, body?: string): string {
  if (!body) {
    return `${method}:${url}`;
  }
  
  // Simple hash for body (not cryptographic, just for keying)
  const bodyHash = simpleHash(body);
  return `${method}:${url}:${bodyHash}`;
}

/**
 * Simple string hash function
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Get cached data if valid
 */
function getFromCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }
  
  const now = Date.now();
  const age = now - entry.timestamp;
  
  if (age > entry.ttl) {
    // Expired
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

/**
 * Store data in cache
 */
function setInCache<T>(key: string, data: T, ttl: number): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
  });
}

/**
 * Clear all cache entries
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Clear cache entries matching a pattern
 * 
 * @param urlPattern - Regex or string to match against URLs
 */
export function clearCachePattern(urlPattern: string | RegExp): void {
  const pattern = typeof urlPattern === 'string' ? new RegExp(urlPattern) : urlPattern;
  
  for (const [key] of cache) {
    if (pattern.test(key)) {
      cache.delete(key);
    }
  }
}

// ============================================================================
// Cached Fetch
// ============================================================================

export interface CachedFetchOptions {
  method?: string;
  headers?: HeadersInit;
  body?: string;
  ttl?: number; // Cache TTL in milliseconds (default: 10000 for GET, 0 for mutations)
}

/**
 * Cached fetch with automatic deduplication
 * 
 * Features:
 * - GET requests cached for 10s by default
 * - POST/PUT/PATCH/DELETE not cached (ttl=0)
 * - In-flight requests deduplicated (same key returns same promise)
 * - Automatic JSON parsing
 * 
 * @param url - Request URL
 * @param options - Fetch options with optional ttl
 * @returns Promise resolving to parsed JSON response
 * 
 * @example
 * // Cached GET (10s TTL)
 * const cases = await cachedFetchJson<CaseRecord[]>('/workflow/cases');
 * 
 * // No cache for mutations
 * const created = await cachedFetchJson<CaseRecord>('/workflow/cases', {
 *   method: 'POST',
 *   headers: getJsonHeaders(),
 *   body: JSON.stringify(data),
 * });
 */
export async function cachedFetchJson<T>(
  url: string,
  options: CachedFetchOptions = {}
): Promise<T> {
  const method = options.method?.toUpperCase() || 'GET';
  const body = options.body;
  
  // Determine TTL
  let ttl: number;
  if (options.ttl !== undefined) {
    ttl = options.ttl;
  } else if (method === 'GET') {
    ttl = 10000; // 10 seconds for GET
  } else {
    ttl = 0; // No cache for mutations
  }
  
  // Generate cache key
  const cacheKey = getCacheKey(method, url, body);
  
  // Check cache (only for non-zero TTL)
  if (ttl > 0) {
    const cached = getFromCache<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }
  }
  
  // Check for in-flight request
  const inFlightEntry = inFlight.get(cacheKey);
  if (inFlightEntry) {
    return inFlightEntry.promise;
  }
  
  // Create new request
  const promise = (async () => {
    try {
      const response = await fetch(url, {
        method,
        headers: options.headers,
        body,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Store in cache (only for non-zero TTL)
      if (ttl > 0) {
        setInCache(cacheKey, data, ttl);
      }
      
      return data;
    } finally {
      // Remove from in-flight
      inFlight.delete(cacheKey);
    }
  })();
  
  // Store in-flight promise
  inFlight.set(cacheKey, { promise });
  
  return promise;
}
