import React, { useEffect, useRef, useState, useCallback } from 'react'

interface StreakFireOverlayProps {
    streakCount: number
    onDone: () => void
}

// ── Particle fire simulation ──────────────────────────────────────────────────
interface Particle {
    x: number
    y: number
    vx: number
    vy: number
    life: number       // 0 → 1 (dead → alive)
    decay: number
    size: number
    heat: number       // 0→1 (cool → hot)
    turbulence: number
}

function spawnParticle(cx: number, base: number, canvasW: number): Particle {
    const spread = Math.min(canvasW * 0.38, 220)
    return {
        x: cx + (Math.random() - 0.5) * spread * 1.6,
        y: base,
        vx: (Math.random() - 0.5) * 1.8,
        vy: -(Math.random() * 4.5 + 2.5),
        life: 1,
        decay: Math.random() * 0.012 + 0.007,
        size: Math.random() * 28 + 10,
        heat: Math.random() * 0.5 + 0.5,
        turbulence: (Math.random() - 0.5) * 0.25,
    }
}

function drawFireParticle(
    ctx: CanvasRenderingContext2D,
    p: Particle,
    globalAlpha: number
) {
    const alpha = p.life * globalAlpha
    const r = p.size * p.life

    // Temperature-based color: white-hot core → yellow → orange → red → transparent
    const heat = p.heat * p.life
    let r1: number, g1: number, b1: number
    if (heat > 0.75) {
        // White / pale-yellow core
        r1 = 255; g1 = 230 + ((heat - 0.75) / 0.25) * 25; b1 = 180 * (1 - (heat - 0.75) / 0.25)
    } else if (heat > 0.5) {
        // Yellow-orange
        r1 = 255; g1 = 160 + ((heat - 0.5) / 0.25) * 70; b1 = 0
    } else if (heat > 0.25) {
        // Orange-red
        r1 = 255; g1 = 80 * ((heat - 0.25) / 0.25); b1 = 0
    } else {
        // Deep red
        r1 = 200 * (heat / 0.25); g1 = 0; b1 = 0
    }

    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
    grad.addColorStop(0, `rgba(${r1},${g1},${b1},${alpha})`)
    grad.addColorStop(0.4, `rgba(${r1},${Math.max(g1 - 60, 0)},0,${alpha * 0.7})`)
    grad.addColorStop(0.8, `rgba(180,30,0,${alpha * 0.3})`)
    grad.addColorStop(1, `rgba(80,0,0,0)`)

    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()
}

// ─────────────────────────────────────────────────────────────────────────────

const TOTAL_DURATION = 3000   // ms total overlay lifetime
const FADE_IN_DURATION = 400  // ms
const SUSTAIN_DURATION = 1800 // ms  (fire burns fully)
const FADE_OUT_DURATION = 800 // ms (TOTAL_DURATION - SUSTAIN - FADE_IN)

export const StreakFireOverlay: React.FC<StreakFireOverlayProps> = ({ streakCount, onDone }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const particlesRef = useRef<Particle[]>([])
    const rafRef = useRef<number>(0)
    const startTimeRef = useRef<number>(0)

    // Overlay fade (controls backdrop + text alpha)
    const [overlayAlpha, setOverlayAlpha] = useState(0)
    const [textPhase, setTextPhase] = useState<'enter' | 'sustain' | 'exit'>('enter')

    const animate = useCallback((timestamp: number) => {
        if (!startTimeRef.current) startTimeRef.current = timestamp
        const elapsed = timestamp - startTimeRef.current
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')!
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Global fire intensity & overlay alpha based on phase
        let fireAlpha = 1
        let overlay = 0
        if (elapsed < FADE_IN_DURATION) {
            const t = elapsed / FADE_IN_DURATION
            overlay = t
            fireAlpha = t
            setOverlayAlpha(t)
            setTextPhase('enter')
        } else if (elapsed < FADE_IN_DURATION + SUSTAIN_DURATION) {
            overlay = 1
            fireAlpha = 1
            setOverlayAlpha(1)
            setTextPhase('sustain')
        } else {
            const t = (elapsed - FADE_IN_DURATION - SUSTAIN_DURATION) / FADE_OUT_DURATION
            overlay = 1 - t
            fireAlpha = 1 - t
            setOverlayAlpha(1 - t)
            setTextPhase('exit')
        }

        const cx = canvas.width / 2
        // Spawn new particles from the bottom-center during active phase
        if (elapsed < FADE_IN_DURATION + SUSTAIN_DURATION + 200) {
            const spawnCount = Math.floor(fireAlpha * 12) + 2
            for (let i = 0; i < spawnCount; i++) {
                particlesRef.current.push(spawnParticle(cx, canvas.height, canvas.width))
            }
        }

        // Update & draw particles
        particlesRef.current = particlesRef.current.filter(p => p.life > 0)
        for (const p of particlesRef.current) {
            p.life -= p.decay
            p.x += p.vx + Math.sin(p.y * 0.04 + timestamp * 0.003) * p.turbulence
            p.y += p.vy
            p.vx *= 0.98
            drawFireParticle(ctx, p, fireAlpha)
        }

        if (elapsed < TOTAL_DURATION) {
            rafRef.current = requestAnimationFrame(animate)
        } else {
            onDone()
        }
    }, [onDone])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const resize = () => {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
        }
        resize()
        window.addEventListener('resize', resize)

        rafRef.current = requestAnimationFrame(animate)

        return () => {
            cancelAnimationFrame(rafRef.current)
            window.removeEventListener('resize', resize)
        }
    }, [animate])

    // Text animation classes based on phase
    const textStyle: React.CSSProperties = {
        opacity: textPhase === 'enter' ? 0 : textPhase === 'sustain' ? 1 : 0,
        transform: textPhase === 'enter'
            ? 'scale(0.6) translateY(60px)'
            : textPhase === 'sustain'
                ? 'scale(1) translateY(0px)'
                : 'scale(1.15) translateY(-30px)',
        transition: textPhase === 'enter'
            ? 'opacity 0.5s ease-out, transform 0.55s cubic-bezier(0.34,1.56,0.64,1)'
            : 'opacity 0.6s ease-in, transform 0.6s ease-in',
    }

    return (
        <div
            onClick={onDone}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                pointerEvents: 'all',
                cursor: 'pointer',
                background: `rgba(0,0,0,${overlayAlpha * 0.72})`,
                transition: 'background 0.1s linear',
            }}
        >
            {/* Canvas — full-screen fire particles */}
            <canvas
                ref={canvasRef}
                style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                }}
            />

            {/* Streak number — centered, cinematic */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0px',
                    pointerEvents: 'none',
                    ...textStyle,
                }}
            >
                {/* Label */}
                <span
                    style={{
                        fontFamily: '"Inter", "SF Pro Display", system-ui, sans-serif',
                        fontSize: 'clamp(14px, 2.5vw, 22px)',
                        fontWeight: 500,
                        letterSpacing: '0.35em',
                        textTransform: 'uppercase',
                        color: 'rgba(255,200,100,0.85)',
                        marginBottom: '6px',
                        textShadow: '0 0 30px rgba(255,140,0,0.9), 0 2px 8px rgba(0,0,0,0.8)',
                    }}
                >
                    Day Streak
                </span>

                {/* The number */}
                <span
                    style={{
                        fontFamily: '"Inter", "SF Pro Display", system-ui, sans-serif',
                        fontSize: 'clamp(100px, 22vw, 220px)',
                        fontWeight: 900,
                        lineHeight: 1,
                        background: 'linear-gradient(to bottom, #fff8e7 0%, #ffe066 20%, #ffaa00 50%, #ff5c00 80%, #c41800 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        textShadow: 'none',
                        filter: 'drop-shadow(0 0 40px rgba(255,120,0,0.8)) drop-shadow(0 0 80px rgba(255,60,0,0.5))',
                        position: 'relative',
                    }}
                >
                    {streakCount}
                </span>

                {/* Sub-label */}
                <span
                    style={{
                        fontFamily: '"Inter", "SF Pro Display", system-ui, sans-serif',
                        fontSize: 'clamp(13px, 2vw, 18px)',
                        fontWeight: 400,
                        letterSpacing: '0.2em',
                        color: 'rgba(255,180,80,0.7)',
                        marginTop: '10px',
                        textShadow: '0 0 20px rgba(255,120,0,0.6)',
                    }}
                >
                    consecutive days
                </span>
            </div>

            {/* Ambient heat glow at base of screen */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '45vh',
                    background: `radial-gradient(ellipse 80% 60% at 50% 100%, rgba(255,80,0,${overlayAlpha * 0.25}) 0%, rgba(200,30,0,${overlayAlpha * 0.12}) 50%, transparent 100%)`,
                    pointerEvents: 'none',
                }}
            />

            {/* Tap to dismiss hint */}
            <div
                style={{
                    position: 'absolute',
                    bottom: '32px',
                    left: 0,
                    right: 0,
                    textAlign: 'center',
                    fontFamily: '"Inter", system-ui, sans-serif',
                    fontSize: '12px',
                    fontWeight: 400,
                    letterSpacing: '0.15em',
                    color: `rgba(255,180,80,${overlayAlpha * 0.45})`,
                    pointerEvents: 'none',
                    userSelect: 'none',
                }}
            >
                tap anywhere to continue
            </div>
        </div>
    )
}
