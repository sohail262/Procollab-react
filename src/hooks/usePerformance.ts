import { useEffect } from 'react'

interface PerformanceMetrics {
  loadTime: number
  renderTime: number
  memoryUsage?: number
}

export function usePerformanceMonitor(componentName: string) {
  useEffect(() => {
    const startTime = performance.now()
    
    // Monitor component mount time
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry) => {
        if (entry.entryType === 'measure') {
          console.log(`${componentName} ${entry.name}: ${entry.duration}ms`)
        }
      })
    })
    
    observer.observe({ entryTypes: ['measure'] })
    
    // Measure render time
    const measureRender = () => {
      const endTime = performance.now()
      const renderTime = endTime - startTime
      
      if (renderTime > 100) { // Log slow renders
        console.warn(`Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`)
      }
      
      // Mark performance milestone
      performance.mark(`${componentName}-render-complete`)
    }
    
    // Use requestIdleCallback for non-critical performance logging
    if ('requestIdleCallback' in window) {
      requestIdleCallback(measureRender)
    } else {
      setTimeout(measureRender, 0)
    }
    
    return () => {
      observer.disconnect()
    }
  }, [componentName])
}

export function measureAsync<T>(
  name: string, 
  asyncFn: () => Promise<T>
): Promise<T> {
  const startMark = `${name}-start`
  const endMark = `${name}-end`
  const measureName = `${name}-duration`
  
  performance.mark(startMark)
  
  return asyncFn().then((result) => {
    performance.mark(endMark)
    performance.measure(measureName, startMark, endMark)
    return result
  }).catch((error) => {
    performance.mark(endMark)
    performance.measure(`${measureName}-error`, startMark, endMark)
    throw error
  })
}

export function getPerformanceMetrics(): PerformanceMetrics {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
  
  return {
    loadTime: navigation.loadEventEnd - navigation.fetchStart,
    renderTime: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
    memoryUsage: (performance as any).memory?.usedJSHeapSize
  }
}