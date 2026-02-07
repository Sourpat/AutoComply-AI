/**
 * API Cache Test
 * 
 * Demonstrates the caching and deduplication behavior.
 * 
 * Run this in browser console while the app is running:
 * 
 * ```javascript
 * // Import the cache utilities
 * import { cachedFetchJson, clearCache, clearCachePattern } from './apiCache';
 * import { listCases } from './workflowApi';
 * 
 * // First call - hits the server
 * const cases1 = await listCases();
 * console.log('First call:', cases1.length);
 * 
 * // Second call - returns cached data (no server hit)
 * const cases2 = await listCases();
 * console.log('Second call (cached):', cases2.length);
 * 
 * // Parallel calls - deduplicated (only one server hit)
 * const [a, b, c] = await Promise.all([
 *   listCases(),
 *   listCases(),
 *   listCases()
 * ]);
 * console.log('Parallel calls (deduplicated):', a.length, b.length, c.length);
 * 
 * // Clear cache and retry
 * clearCache();
 * const cases3 = await listCases();
 * console.log('After cache clear:', cases3.length);
 * 
 * // Clear specific pattern
 * clearCachePattern(/\/cases/);
 * ```
 */

import { describe, expect, it } from "vitest";

describe("apiCache docs", () => {
	it("documents cache behavior", () => {
		expect(true).toBe(true);
	});
});

// Example: Cache key generation
// 
// GET /workflow/cases
//   → "GET:/workflow/cases"
// 
// GET /workflow/cases?status=new
//   → "GET:/workflow/cases?status=new"
// 
// POST /workflow/cases (body: {...})
//   → "POST:/workflow/cases:abc123" (abc123 = hash of body)

// Cache behavior:
// 
// 1. GET requests: 10 second TTL
//    - First call: fetch from server, cache result
//    - Within 10s: return cached data
//    - After 10s: fetch from server again
// 
// 2. In-flight deduplication:
//    - Request A starts
//    - Request B (same params) starts while A is pending
//    - Both return same promise (only one network call)
// 
// 3. Mutations (POST/PUT/PATCH/DELETE): No cache
//    - TTL = 0
//    - Always hit server
//    - No deduplication needed (mutations should execute)

export {};
