import { useState, useEffect, useCallback, useRef } from 'react'
import { DocumentSnapshot, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore'

interface UseInfiniteScrollOptions {
  threshold?: number // How close to bottom before loading (in pixels)
  rootMargin?: string // Intersection observer root margin
  enabled?: boolean // Whether infinite scroll is enabled
}

interface UseInfiniteScrollReturn {
  isLoading: boolean
  hasMore: boolean
  loadMore: () => void
  reset: () => void
  sentinelRef: React.RefObject<HTMLDivElement | null>
}

export function useInfiniteScroll(
  loadMoreCallback: () => Promise<boolean>, // Returns true if more data available
  options: UseInfiniteScrollOptions = {}
): UseInfiniteScrollReturn {
  const {
    threshold = 100,
    rootMargin = '0px',
    enabled = true
  } = options

  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore || !enabled) return

    setIsLoading(true)
    try {
      const moreDataAvailable = await loadMoreCallback()
      setHasMore(moreDataAvailable)
    } catch (error) {
      console.error('Error loading more data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [loadMoreCallback, isLoading, hasMore, enabled])

  const reset = useCallback(() => {
    setHasMore(true)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (!enabled || !sentinelRef.current) return

    const sentinel = sentinelRef.current

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && hasMore && !isLoading) {
          loadMore()
        }
      },
      {
        rootMargin,
        threshold: 0.1
      }
    )

    observerRef.current.observe(sentinel)

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [loadMore, hasMore, isLoading, enabled, rootMargin])

  return {
    isLoading,
    hasMore,
    loadMore,
    reset,
    sentinelRef
  }
}

// Pagination helper for Firestore
export interface PaginationState<T = DocumentData> {
  items: T[]
  lastDoc: QueryDocumentSnapshot<T> | null
  hasMore: boolean
  loading: boolean
}

export function usePagination<T = DocumentData>(
  initialState: Partial<PaginationState<T>> = {}
): [
  PaginationState<T>,
  {
    setItems: (items: T[]) => void
    addItems: (items: T[], lastDoc?: QueryDocumentSnapshot<T> | null) => void
    setLoading: (loading: boolean) => void
    setHasMore: (hasMore: boolean) => void
    reset: () => void
  }
] {
  const [state, setState] = useState<PaginationState<T>>({
    items: [],
    lastDoc: null,
    hasMore: true,
    loading: false,
    ...initialState
  })

  const setItems = useCallback((items: T[]) => {
    setState(prev => ({ ...prev, items }))
  }, [])

  const addItems = useCallback((items: T[], lastDoc?: QueryDocumentSnapshot<T> | null) => {
    setState(prev => {
      const existingIds = new Set(prev.items.map((item: any) => item.id).filter(Boolean))
      const uniqueNewItems = items.filter((item: any) => !item.id || !existingIds.has(item.id))
      return {
        ...prev,
        items: [...prev.items, ...uniqueNewItems],
        lastDoc: lastDoc || prev.lastDoc
      }
    })
  }, [])

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading }))
  }, [])

  const setHasMore = useCallback((hasMore: boolean) => {
    setState(prev => ({ ...prev, hasMore }))
  }, [])

  const reset = useCallback(() => {
    setState({
      items: [],
      lastDoc: null,
      hasMore: true,
      loading: false
    })
  }, [])

  return [
    state,
    { setItems, addItems, setLoading, setHasMore, reset }
  ]
}