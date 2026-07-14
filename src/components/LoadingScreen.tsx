import { useEffect, useRef, useState } from 'react'
import Loader from './Loader'

interface LoadingScreenProps {
  message?: string
  /** When true the screen fades out and unmounts. */
  done?: boolean
  onExited?: () => void
}

export function LoadingScreen({ done = false, onExited }: LoadingScreenProps) {
  const [visible, setVisible] = useState(true)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!done) return
    const el = overlayRef.current
    if (!el) return

    // Trigger fade-out
    el.style.opacity = '0'
    el.style.pointerEvents = 'none'

    const timer = setTimeout(() => {
      setVisible(false)
      onExited?.()
    }, 500) // matches transition duration

    return () => clearTimeout(timer)
  }, [done, onExited])

  if (!visible) return null

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'hsl(var(--background))',
        transition: 'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: 1,
      }}
    >
      {/* Brand mark — matches WelcomeScreen typography */}
      <div style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
        <img
          src="/images/logo_pc.png"
          alt="ProCollab Logo"
          style={{
            width: 30,
            height: 30,
            objectFit: 'contain',
          }}
        />
        <span style={{
          fontSize: 11,
          fontWeight: 400,
          letterSpacing: '0.22em',
          textTransform: 'uppercase' as const,
          color: 'hsl(var(--muted-foreground))',
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}>
          ProCollab
        </span>
      </div>

      {/* Speeder animation */}
      <div style={{ position: 'relative', width: 300, height: 120 }}>
        <Loader />
      </div>
    </div>
  )
}

export default LoadingScreen
