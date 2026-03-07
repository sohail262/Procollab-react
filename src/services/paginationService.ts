import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  startAfter, 
  getDocs, 
  where,
  QueryDocumentSnapshot,
  DocumentData,
  Query
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { cachedQuery } from '@/lib/queryUtils'

export interface PaginatedResult<T> {
  items: T[]
  lastDoc: QueryDocumentSnapshot<DocumentData> | null
  hasMore: boolean
}

const PAGE_SIZE = 10 // Default page size

// Paginated users (collaborators)
export async function loadPaginatedUsers(
  lastDoc?: QueryDocumentSnapshot<DocumentData> | null,
  pageSize: number = PAGE_SIZE
): Promise<PaginatedResult<any>> {
  try {
    let q = query(
      collection(db, 'users'),
      orderBy('createdAt', 'desc'),
      limit(pageSize + 1) // Get one extra to check if more exists
    )

    if (lastDoc) {
      q = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(pageSize + 1)
      )
    }

    const snapshot = await cachedQuery(q, { 
      ttl: 300000, // 5 minutes cache
      cacheKey: `users-page-${lastDoc?.id || 'first'}-${pageSize}`
    })

    const docs = snapshot.docs
    const hasMore = docs.length > pageSize
    const items = docs.slice(0, pageSize).map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    return {
      items,
      lastDoc: docs.length > 0 ? docs[Math.min(docs.length - 1, pageSize - 1)] : null,
      hasMore
    }
  } catch (error) {
    console.error('Error loading paginated users:', error)
    return { items: [], lastDoc: null, hasMore: false }
  }
}

// Paginated projects
export async function loadPaginatedProjects(
  lastDoc?: QueryDocumentSnapshot<DocumentData> | null,
  pageSize: number = PAGE_SIZE,
  filters?: {
    category?: string
    status?: string
    searchTerm?: string
  }
): Promise<PaginatedResult<any>> {
  try {
    let q: Query<DocumentData> = query(
      collection(db, 'projects'),
      orderBy('createdAt', 'desc')
    )

    // Apply filters
    if (filters?.status) {
      q = query(q, where('status', '==', filters.status))
    }
    
    if (filters?.category) {
      q = query(q, where('primaryDiscipline', '==', filters.category))
    }

    // Add pagination
    if (lastDoc) {
      q = query(q, startAfter(lastDoc))
    }
    
    q = query(q, limit(pageSize + 1))

    const snapshot = await cachedQuery(q, { 
      ttl: 180000, // 3 minutes cache for projects
      cacheKey: `projects-page-${lastDoc?.id || 'first'}-${pageSize}-${JSON.stringify(filters || {})}`
    })

    const docs = snapshot.docs
    const hasMore = docs.length > pageSize
    let items = docs.slice(0, pageSize).map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date()
    }))

    // Apply client-side search filter if needed (for better UX)
    if (filters?.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase()
      items = items.filter(project => 
        (project as any).title?.toLowerCase().includes(searchLower) ||
        (project as any).description?.toLowerCase().includes(searchLower) ||
        (project as any).tags?.some((tag: string) => tag.toLowerCase().includes(searchLower))
      )
    }

    return {
      items,
      lastDoc: docs.length > 0 ? docs[Math.min(docs.length - 1, pageSize - 1)] : null,
      hasMore
    }
  } catch (error) {
    console.error('Error loading paginated projects:', error)
    return { items: [], lastDoc: null, hasMore: false }
  }
}

// Paginated search results
export async function searchPaginatedContent(
  searchTerm: string,
  type: 'users' | 'projects' | 'all' = 'all',
  lastDoc?: QueryDocumentSnapshot<DocumentData> | null,
  pageSize: number = PAGE_SIZE
): Promise<PaginatedResult<any>> {
  try {
    if (type === 'users' || type === 'all') {
      return await loadPaginatedUsers(lastDoc, pageSize)
    } else {
      return await loadPaginatedProjects(lastDoc, pageSize, { searchTerm })
    }
  } catch (error) {
    console.error('Error searching paginated content:', error)
    return { items: [], lastDoc: null, hasMore: false }
  }
}