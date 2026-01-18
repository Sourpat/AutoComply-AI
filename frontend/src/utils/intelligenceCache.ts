/**
 * Intelligence Cache Utility
 * 
 * Simple in-memory cache with TTL for intelligence data.
 * Also persists to sessionStorage for fast page refresh.
 */

import type { DecisionIntelligenceResponse } from '../api/intelligenceApi';

interface CacheEntry {
  data: DecisionIntelligenceResponse;
  timestamp: number;
  expiresAt: number;
}

const CACHE_TTL_MS = 60 * 1000; // 60 seconds
const SESSION_STORAGE_KEY_PREFIX = 'acai.intelligence.';

/**
 * In-memory cache
 */
const memoryCache = new Map<string, CacheEntry>();

/**
 * Build cache key
 */
function getCacheKey(caseId: string, decisionType: string): string {
  return `${caseId}:${decisionType}`;
}

/**
 * Get from cache (memory first, then sessionStorage)
 */
export function getCachedIntelligence(
  caseId: string,
  decisionType: string
): DecisionIntelligenceResponse | null {
  const key = getCacheKey(caseId, decisionType);
  const now = Date.now();

  // Check memory cache first
  const memEntry = memoryCache.get(key);
  if (memEntry && memEntry.expiresAt > now) {
    console.log('[IntelligenceCache] Memory cache HIT:', key);
    return memEntry.data;
  }

  // Try sessionStorage
  try {
    const sessionKey = SESSION_STORAGE_KEY_PREFIX + key;
    const stored = sessionStorage.getItem(sessionKey);
    if (stored) {
      const entry: CacheEntry = JSON.parse(stored);
      if (entry.expiresAt > now) {
        console.log('[IntelligenceCache] Session storage HIT:', key);
        // Restore to memory cache
        memoryCache.set(key, entry);
        return entry.data;
      } else {
        // Expired, remove from sessionStorage
        sessionStorage.removeItem(sessionKey);
      }
    }
  } catch (error) {
    console.warn('[IntelligenceCache] Failed to read from sessionStorage:', error);
  }

  console.log('[IntelligenceCache] MISS:', key);
  return null;
}

/**
 * Set in cache (both memory and sessionStorage)
 */
export function setCachedIntelligence(
  caseId: string,
  decisionType: string,
  data: DecisionIntelligenceResponse
): void {
  const key = getCacheKey(caseId, decisionType);
  const now = Date.now();
  const entry: CacheEntry = {
    data,
    timestamp: now,
    expiresAt: now + CACHE_TTL_MS,
  };

  // Memory cache
  memoryCache.set(key, entry);

  // sessionStorage
  try {
    const sessionKey = SESSION_STORAGE_KEY_PREFIX + key;
    sessionStorage.setItem(sessionKey, JSON.stringify(entry));
    console.log('[IntelligenceCache] Cached:', key, 'expires in', CACHE_TTL_MS / 1000, 'seconds');
  } catch (error) {
    console.warn('[IntelligenceCache] Failed to write to sessionStorage:', error);
  }
}

/**
 * Invalidate cache for a specific case+decisionType
 */
export function invalidateCachedIntelligence(caseId: string, decisionType: string): void {
  const key = getCacheKey(caseId, decisionType);

  // Memory cache
  memoryCache.delete(key);

  // sessionStorage
  try {
    const sessionKey = SESSION_STORAGE_KEY_PREFIX + key;
    sessionStorage.removeItem(sessionKey);
    console.log('[IntelligenceCache] Invalidated:', key);
  } catch (error) {
    console.warn('[IntelligenceCache] Failed to invalidate sessionStorage:', error);
  }
}

/**
 * Invalidate all cache entries for a case (all decision types)
 */
export function invalidateCaseIntelligence(caseId: string): void {
  // Memory cache
  const keysToDelete: string[] = [];
  memoryCache.forEach((_, key) => {
    if (key.startsWith(caseId + ':')) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => memoryCache.delete(key));

  // sessionStorage
  try {
    const prefix = SESSION_STORAGE_KEY_PREFIX + caseId + ':';
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(prefix)) {
        sessionStorage.removeItem(key);
      }
    }
    console.log('[IntelligenceCache] Invalidated all for case:', caseId);
  } catch (error) {
    console.warn('[IntelligenceCache] Failed to invalidate sessionStorage for case:', error);
  }
}

/**
 * Clear all cache
 */
export function clearIntelligenceCache(): void {
  memoryCache.clear();

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(SESSION_STORAGE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
    console.log('[IntelligenceCache] Cleared all cache');
  } catch (error) {
    console.warn('[IntelligenceCache] Failed to clear sessionStorage:', error);
  }
}
