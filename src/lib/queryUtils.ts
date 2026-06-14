import { 
    Query, 
    DocumentData, 
    QuerySnapshot, 
    getDocs, 
    getDoc, 
    DocumentReference,
    writeBatch,
    queryEqual,
    refEqual
} from 'firebase/firestore';
import { db } from './firebase';

// ─── Cache structure ──────────────────────────────────────────────────────────
interface CacheEntry {
    query: any;
    data: any;
    timestamp: number;
    ttl: number;
    customKey?: string;
    /** LRU tracking — updated on every cache hit */
    lastAccessed: number;
}

// ✅ P2 FIX: Replaced CacheEntry[] array with Map<string, CacheEntry>.
//
// Before: O(N) linear scan for every cache lookup (findIndex / find over array).
// After:  O(1) hash-map lookup by customKey, O(N) only for query-equality checks
//         which are rare (most callers use explicit cacheKey strings).
//
// Secondary improvement: LRU eviction is now tracked via `lastAccessed` and
// enforced when the cache exceeds MAX_CACHE_SIZE entries.

const cacheByKey = new Map<string, CacheEntry>();   // Fast path: cacheKey → entry
const cacheByQuery: CacheEntry[] = [];              // Slow path: query-equality entries (no cacheKey)

const CACHE_TTL     = 5 * 60 * 1000;   // 5 minutes default
const MAX_CACHE_SIZE = 200;             // Maximum total entries before LRU eviction

// ─── Request deduplication ────────────────────────────────────────────────────
interface PendingRequest {
    query: any;
    promise: Promise<any>;
    customKey?: string;
}

const pendingRequestsList: PendingRequest[] = [];

// ─── Rate limiting ────────────────────────────────────────────────────────────
const rateLimiter = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW       = 60 * 1000;  // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;        // per minute per user

/**
 * Check if two queries/refs are equal using modular SDK comparison
 */
function areEqual(a: any, b: any): boolean {
    if (!a || !b) return false;
    if (a === b) return true;
    try {
        const typeA = a.type;
        const typeB = b.type;
        if (typeA !== typeB) return false;
        
        if (typeA === 'document') {
            return refEqual(a, b);
        } else if (typeA === 'query' || typeA === 'collection') {
            return queryEqual(a, b);
        }
    } catch {
        // Fallback to strict check
    }
    return false;
}

/**
 * Helper cache lookup — O(1) for customKey, O(N) for query equality
 */
function findCachedEntry(query: any, customKey?: string): CacheEntry | undefined {
    const now = Date.now();
    if (customKey) {
        const entry = cacheByKey.get(customKey);
        if (entry && now - entry.timestamp < entry.ttl) {
            entry.lastAccessed = now; // LRU touch
            return entry;
        }
        if (entry) cacheByKey.delete(customKey); // Expired — evict eagerly
        return undefined;
    }
    // No custom key — fall back to linear scan over query-equality entries
    const idx = cacheByQuery.findIndex(e =>
        !e.customKey && areEqual(e.query, query) && now - e.timestamp < e.ttl
    );
    if (idx === -1) return undefined;
    cacheByQuery[idx].lastAccessed = now; // LRU touch
    return cacheByQuery[idx];
}

/**
 * Helper cache store — maintains LRU eviction when over capacity
 */
function setCachedEntry(query: any, data: any, ttl: number, customKey?: string) {
    const now = Date.now();
    const entry: CacheEntry = { query, data, timestamp: now, ttl, customKey, lastAccessed: now };

    if (customKey) {
        cacheByKey.set(customKey, entry);
    } else {
        const idx = cacheByQuery.findIndex(e => !e.customKey && areEqual(e.query, query));
        if (idx !== -1) {
            cacheByQuery[idx] = entry;
        } else {
            cacheByQuery.push(entry);
        }
    }

    // LRU eviction — keep total size bounded
    const totalSize = cacheByKey.size + cacheByQuery.length;
    if (totalSize > MAX_CACHE_SIZE) {
        evictLRU();
    }
}

/**
 * LRU eviction: remove the least-recently-accessed entry across both stores.
 */
function evictLRU() {
    let lruTime = Infinity;
    let lruKey: string | undefined;
    let lruQIdx = -1;

    cacheByKey.forEach((entry, key) => {
        if (entry.lastAccessed < lruTime) {
            lruTime = entry.lastAccessed;
            lruKey = key;
            lruQIdx = -1;
        }
    });
    cacheByQuery.forEach((entry, idx) => {
        if (entry.lastAccessed < lruTime) {
            lruTime = entry.lastAccessed;
            lruKey = undefined;
            lruQIdx = idx;
        }
    });

    if (lruKey !== undefined) {
        cacheByKey.delete(lruKey);
    } else if (lruQIdx !== -1) {
        cacheByQuery.splice(lruQIdx, 1);
    }
}

// ─── Pending request helpers ──────────────────────────────────────────────────
function findPendingRequest(query: any, customKey?: string): Promise<any> | undefined {
    if (customKey) {
        return pendingRequestsList.find(r => r.customKey === customKey)?.promise;
    }
    return pendingRequestsList.find(r => {
        if (r.customKey) return false;
        return areEqual(r.query, query);
    })?.promise;
}

function addPendingRequest(query: any, promise: Promise<any>, customKey?: string) {
    pendingRequestsList.push({ query, promise, customKey });
}

function removePendingRequest(query: any, customKey?: string) {
    const index = pendingRequestsList.findIndex(r => {
        if (customKey) return r.customKey === customKey;
        return areEqual(r.query, query);
    });
    if (index !== -1) {
        pendingRequestsList.splice(index, 1);
    }
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────
function checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userLimit = rateLimiter.get(userId);
    
    if (!userLimit || now > userLimit.resetTime) {
        rateLimiter.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return true;
    }
    
    if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
        console.warn(`Rate limit exceeded for user ${userId}`);
        return false;
    }
    
    userLimit.count++;
    return true;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Cached query execution with deduplication and LRU-bounded in-memory storage.
 */
export async function cachedQuery(
    query: Query<DocumentData>,
    options: {
        cacheKey?: string;
        ttl?: number;
        userId?: string;
        skipCache?: boolean;
    } = {}
): Promise<QuerySnapshot<DocumentData>> {
    const { cacheKey, ttl = CACHE_TTL, userId, skipCache = false } = options;
    
    // Rate limiting
    if (userId && !checkRateLimit(userId)) {
        throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    // Check cache first
    if (!skipCache) {
        const cached = findCachedEntry(query, cacheKey);
        if (cached) {
            return cached.data;
        }
    }
    
    // Check for pending request (deduplication)
    const pendingPromise = findPendingRequest(query, cacheKey);
    if (pendingPromise) {
        return pendingPromise;
    }
    
    // Execute query
    const promise = getDocs(query);
    addPendingRequest(query, promise, cacheKey);
    
    try {
        const result = await promise;
        
        // Cache result
        if (!skipCache) {
            setCachedEntry(query, result, ttl, cacheKey);
        }
        
        return result;
    } catch (error) {
        console.error('Query failed:', error);
        throw error;
    } finally {
        removePendingRequest(query, cacheKey);
    }
}

/**
 * Cached document get with deduplication and LRU-bounded storage.
 */
export async function cachedGetDoc(
    docRef: DocumentReference<DocumentData>,
    options: {
        cacheKey?: string;
        ttl?: number;
        userId?: string;
        skipCache?: boolean;
    } = {}
) {
    const { cacheKey, ttl = CACHE_TTL, userId, skipCache = false } = options;
    
    // Rate limiting
    if (userId && !checkRateLimit(userId)) {
        throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    // Check cache first
    if (!skipCache) {
        const cached = findCachedEntry(docRef, cacheKey);
        if (cached) {
            return cached.data;
        }
    }
    
    // Check for pending request (deduplication)
    const pendingPromise = findPendingRequest(docRef, cacheKey);
    if (pendingPromise) {
        return pendingPromise;
    }
    
    // Execute query
    const promise = getDoc(docRef);
    addPendingRequest(docRef, promise, cacheKey);
    
    try {
        const result = await promise;
        
        // Cache result
        if (!skipCache) {
            setCachedEntry(docRef, result, ttl, cacheKey);
        }
        
        return result;
    } catch (error) {
        console.error('Document get failed:', error);
        throw error;
    } finally {
        removePendingRequest(docRef, cacheKey);
    }
}

/**
 * Batch document fetching to reduce N+1 queries.
 * Each doc is individually cached so repeated calls (e.g. after navigation) are free.
 */
export async function batchGetDocs(
    docRefs: DocumentReference<DocumentData>[],
    options: {
        batchSize?: number;
        userId?: string;
    } = {}
): Promise<Array<{ id: string; data: DocumentData | undefined; exists: boolean }>> {
    const { batchSize = 10, userId } = options;
    
    if (docRefs.length === 0) return [];
    
    // Rate limiting
    if (userId && !checkRateLimit(userId)) {
        throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    const results: Array<{ id: string; data: DocumentData | undefined; exists: boolean }> = [];
    
    // Process in parallel batches to avoid overwhelming Firestore
    for (let i = 0; i < docRefs.length; i += batchSize) {
        const batch = docRefs.slice(i, i + batchSize);
        
        try {
            const promises = batch.map(async (docRef) => {
                const d = await cachedGetDoc(docRef, { userId });
                return {
                    id: docRef.id,
                    data: d.exists() ? d.data() : undefined,
                    exists: d.exists()
                };
            });
            
            const batchResults = await Promise.all(promises);
            results.push(...batchResults);
        } catch (error) {
            console.error(`Batch ${i / batchSize + 1} failed:`, error);
            // Add failed results as non-existent to preserve array length
            batch.forEach(docRef => {
                results.push({
                    id: docRef.id,
                    data: undefined,
                    exists: false
                });
            });
        }
    }
    
    return results;
}

/**
 * Optimized batch write with retry logic and exponential backoff.
 */
export async function optimizedBatchWrite(
    operations: Array<{
        type: 'set' | 'update' | 'delete';
        ref: DocumentReference;
        data?: any;
    }>,
    options: {
        maxRetries?: number;
        retryDelay?: number;
    } = {}
): Promise<void> {
    const { maxRetries = 3, retryDelay = 1000 } = options;
    
    if (operations.length === 0) return;
    
    // Firestore batch limit is 500 operations
    const BATCH_LIMIT = 500;
    
    for (let i = 0; i < operations.length; i += BATCH_LIMIT) {
        const batchOps = operations.slice(i, i + BATCH_LIMIT);
        let retries = 0;
        
        while (retries <= maxRetries) {
            try {
                const batch = writeBatch(db);
                
                batchOps.forEach(op => {
                    switch (op.type) {
                        case 'set':
                            batch.set(op.ref, op.data);
                            break;
                        case 'update':
                            batch.update(op.ref, op.data);
                            break;
                        case 'delete':
                            batch.delete(op.ref);
                            break;
                    }
                });
                
                await batch.commit();
                break; // Success, exit retry loop
            } catch (error) {
                retries++;
                if (retries > maxRetries) {
                    console.error(`Batch write failed after ${maxRetries} retries:`, error);
                    throw error;
                }
                
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, retries - 1)));
            }
        }
    }
}

/**
 * Clear cache entries matching a pattern string.
 * Checks both the Map (cacheByKey) and the query-equality array (cacheByQuery).
 *
 * @param pattern - If omitted, clears ALL cache entries.
 *                  If a string, clears entries whose customKey includes it,
 *                  or whose Firestore path string contains it.
 */
export function clearCache(pattern?: string) {
    if (!pattern) {
        cacheByKey.clear();
        cacheByQuery.length = 0;
        return;
    }
    
    // Clear matching entries from the Map (O(N) over map size)
    cacheByKey.forEach((_, key) => {
        if (key.includes(pattern)) cacheByKey.delete(key);
    });

    // Clear matching entries from the query-equality array
    for (let i = cacheByQuery.length - 1; i >= 0; i--) {
        const entry = cacheByQuery[i];
        let matches = false;
        if (entry.customKey && entry.customKey.includes(pattern)) {
            matches = true;
        } else if (
            entry.query &&
            typeof entry.query.path === 'string' &&
            entry.query.path.includes(pattern)
        ) {
            matches = true;
        } else if (
            entry.query &&
            entry.query._query &&
            typeof entry.query._query.path?.toString === 'function' &&
            entry.query._query.path.toString().includes(pattern)
        ) {
            matches = true;
        }
        if (matches) {
            cacheByQuery.splice(i, 1);
        }
    }
}

/**
 * Get cache statistics for debugging and monitoring.
 */
export function getCacheStats() {
    const now = Date.now();
    let validEntries   = 0;
    let expiredEntries = 0;
    
    cacheByKey.forEach(entry => {
        if (now - entry.timestamp < entry.ttl) validEntries++;
        else expiredEntries++;
    });
    cacheByQuery.forEach(entry => {
        if (now - entry.timestamp < entry.ttl) validEntries++;
        else expiredEntries++;
    });
    
    return {
        totalEntries:   cacheByKey.size + cacheByQuery.length,
        mapEntries:     cacheByKey.size,
        arrayEntries:   cacheByQuery.length,
        validEntries,
        expiredEntries,
        maxCacheSize:   MAX_CACHE_SIZE,
        hitRate: validEntries / (validEntries + expiredEntries) || 0
    };
}

/**
 * Cleanup expired cache entries (runs on a 10-minute interval).
 */
export function cleanupCache() {
    const now = Date.now();
    let deletedCount = 0;

    // Clean the Map
    cacheByKey.forEach((entry, key) => {
        if (now - entry.timestamp >= entry.ttl) {
            cacheByKey.delete(key);
            deletedCount++;
        }
    });

    // Clean the query-equality array
    for (let i = cacheByQuery.length - 1; i >= 0; i--) {
        const entry = cacheByQuery[i];
        if (now - entry.timestamp >= entry.ttl) {
            cacheByQuery.splice(i, 1);
            deletedCount++;
        }
    }

    return deletedCount;
}

// Auto cleanup every 10 minutes to prevent stale entries accumulating
setInterval(cleanupCache, 10 * 60 * 1000);