import { 
    Query, 
    DocumentData, 
    QuerySnapshot, 
    getDocs, 
    getDoc, 
    DocumentReference,
    writeBatch
} from 'firebase/firestore';
import { db } from './firebase';

// Cache for query results
const queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes default

// Request deduplication
const pendingRequests = new Map<string, Promise<any>>();

// Rate limiting
const rateLimiter = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // per minute per user

/**
 * Generate cache key for queries
 */
function getCacheKey(query: Query | DocumentReference, params?: any): string {
    const path = 'path' in query ? query.path : query.toString();
    return `${path}:${JSON.stringify(params || {})}`;
}

/**
 * Check rate limit for user
 */
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

/**
 * Cached query execution with deduplication
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
    
    const key = cacheKey || getCacheKey(query);
    
    // Check cache first
    if (!skipCache) {
        const cached = queryCache.get(key);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            return cached.data;
        }
    }
    
    // Check for pending request (deduplication)
    if (pendingRequests.has(key)) {
        return pendingRequests.get(key);
    }
    
    // Execute query
    const promise = getDocs(query);
    pendingRequests.set(key, promise);
    
    try {
        const result = await promise;
        
        // Cache result
        if (!skipCache) {
            queryCache.set(key, {
                data: result,
                timestamp: Date.now(),
                ttl
            });
        }
        
        return result;
    } catch (error) {
        console.error('Query failed:', error);
        throw error;
    } finally {
        pendingRequests.delete(key);
    }
}

/**
 * Cached document get with deduplication
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
    
    const key = cacheKey || getCacheKey(docRef);
    
    // Check cache first
    if (!skipCache) {
        const cached = queryCache.get(key);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            return cached.data;
        }
    }
    
    // Check for pending request (deduplication)
    if (pendingRequests.has(key)) {
        return pendingRequests.get(key);
    }
    
    // Execute query
    const promise = getDoc(docRef);
    pendingRequests.set(key, promise);
    
    try {
        const result = await promise;
        
        // Cache result
        if (!skipCache) {
            queryCache.set(key, {
                data: result,
                timestamp: Date.now(),
                ttl
            });
        }
        
        return result;
    } catch (error) {
        console.error('Document get failed:', error);
        throw error;
    } finally {
        pendingRequests.delete(key);
    }
}

/**
 * Batch document fetching to reduce N+1 queries
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
    
    // Process in batches to avoid overwhelming Firestore
    for (let i = 0; i < docRefs.length; i += batchSize) {
        const batch = docRefs.slice(i, i + batchSize);
        
        try {
            const promises = batch.map(async (docRef) => {
                const doc = await cachedGetDoc(docRef, { userId });
                return {
                    id: docRef.id,
                    data: doc.exists() ? doc.data() : undefined,
                    exists: doc.exists()
                };
            });
            
            const batchResults = await Promise.all(promises);
            results.push(...batchResults);
        } catch (error) {
            console.error(`Batch ${i / batchSize + 1} failed:`, error);
            // Add failed results as non-existent
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
 * Optimized batch write with retry logic
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
 * Clear cache for specific keys or all
 */
export function clearCache(pattern?: string) {
    if (!pattern) {
        queryCache.clear();
        return;
    }
    
    const keysToDelete = Array.from(queryCache.keys()).filter(key => 
        key.includes(pattern)
    );
    
    keysToDelete.forEach(key => queryCache.delete(key));
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;
    
    queryCache.forEach(entry => {
        if (now - entry.timestamp < entry.ttl) {
            validEntries++;
        } else {
            expiredEntries++;
        }
    });
    
    return {
        totalEntries: queryCache.size,
        validEntries,
        expiredEntries,
        hitRate: validEntries / (validEntries + expiredEntries) || 0
    };
}

/**
 * Cleanup expired cache entries
 */
export function cleanupCache() {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    queryCache.forEach((entry, key) => {
        if (now - entry.timestamp >= entry.ttl) {
            keysToDelete.push(key);
        }
    });
    
    keysToDelete.forEach(key => queryCache.delete(key));
    
    return keysToDelete.length;
}

// Auto cleanup every 10 minutes
setInterval(cleanupCache, 10 * 60 * 1000);