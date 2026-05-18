// ── Banner Presets ─────────────────────────────────────────────────────────────
// 45 elegant, hand-composed SVG banners. Each is unique, layered, aesthetic.
// No repeating patterns, no rgb(), all hex colors. Designed to feel premium.

export interface BannerPreset {
    id: string
    render: () => JSX.Element
}

const SVG = ({ children, bg }: { children: React.ReactNode; bg: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
        viewBox="0 0 800 200"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0, background: bg }}
    >
        {children}
    </svg>
)

export const BANNER_PRESETS: BannerPreset[] = [
    // 1. Aurora glow — soft layered orbs
    {
        id: 'aurora-glow',
        render: () => (
            <SVG bg="#0a0e27">
                <defs>
                    <radialGradient id="ag1"><stop offset="0%" stopColor="#6366f1" stopOpacity="0.6"/><stop offset="100%" stopColor="#6366f1" stopOpacity="0"/></radialGradient>
                    <radialGradient id="ag2"><stop offset="0%" stopColor="#ec4899" stopOpacity="0.5"/><stop offset="100%" stopColor="#ec4899" stopOpacity="0"/></radialGradient>
                    <radialGradient id="ag3"><stop offset="0%" stopColor="#06b6d4" stopOpacity="0.5"/><stop offset="100%" stopColor="#06b6d4" stopOpacity="0"/></radialGradient>
                </defs>
                <circle cx="200" cy="100" r="180" fill="url(#ag1)" />
                <circle cx="600" cy="80" r="160" fill="url(#ag2)" />
                <circle cx="400" cy="180" r="200" fill="url(#ag3)" />
            </SVG>
        ),
    },
    // 2. Liquid mesh — large blurred blobs
    {
        id: 'liquid-mesh',
        render: () => (
            <SVG bg="#1a0b2e">
                <defs>
                    <filter id="lm-blur"><feGaussianBlur stdDeviation="40"/></filter>
                </defs>
                <g filter="url(#lm-blur)">
                    <circle cx="150" cy="60" r="120" fill="#7c3aed" />
                    <circle cx="500" cy="140" r="140" fill="#db2777" />
                    <circle cx="700" cy="40" r="100" fill="#f59e0b" />
                </g>
            </SVG>
        ),
    },
    // 3. Geometric mountains — minimal layered ranges
    {
        id: 'mountain-layers',
        render: () => (
            <SVG bg="#0c1929">
                <polygon points="0,200 0,140 200,80 380,130 550,90 750,150 800,120 800,200" fill="#1e3a5f" opacity="0.9"/>
                <polygon points="0,200 0,170 180,110 350,150 500,120 700,170 800,150 800,200" fill="#2563eb" opacity="0.7"/>
                <polygon points="0,200 0,180 150,150 300,170 480,160 650,180 800,170 800,200" fill="#3b82f6" opacity="0.5"/>
                <circle cx="640" cy="60" r="22" fill="#fbbf24" opacity="0.9"/>
                <circle cx="640" cy="60" r="28" fill="#fbbf24" opacity="0.3"/>
            </SVG>
        ),
    },
    // 4. Constellation — connected stars
    {
        id: 'constellation',
        render: () => (
            <SVG bg="#020617">
                {[[120,60],[200,90],[280,50],[360,110],[450,70],[530,130],[620,80],[710,50]].map((p, i, arr) => (
                    <g key={i}>
                        {i < arr.length - 1 && <line x1={p[0]} y1={p[1]} x2={arr[i+1][0]} y2={arr[i+1][1]} stroke="#60a5fa" strokeWidth="1" opacity="0.4"/>}
                        <circle cx={p[0]} cy={p[1]} r="3" fill="#dbeafe"/>
                        <circle cx={p[0]} cy={p[1]} r="6" fill="#60a5fa" opacity="0.3"/>
                    </g>
                ))}
                {Array.from({length:30}).map((_, i) => (
                    <circle key={`s${i}`} cx={(i*47)%800} cy={(i*73)%200} r={0.8} fill="#fff" opacity={0.3 + (i%3)*0.2}/>
                ))}
            </SVG>
        ),
    },
    // 5. Sunset waves — layered curved gradients
    {
        id: 'sunset-waves',
        render: () => (
            <SVG bg="#1a0b3d">
                <defs>
                    <linearGradient id="sw1" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.7"/>
                        <stop offset="100%" stopColor="#dc2626" stopOpacity="0.4"/>
                    </linearGradient>
                </defs>
                <circle cx="400" cy="160" r="80" fill="#f97316" opacity="0.8"/>
                <circle cx="400" cy="160" r="60" fill="#fbbf24"/>
                <path d="M0 130 Q200 100 400 130 T800 130 L800 200 L0 200 Z" fill="url(#sw1)"/>
                <path d="M0 160 Q200 140 400 160 T800 160 L800 200 L0 200 Z" fill="#7c2d12" opacity="0.6"/>
                <path d="M0 180 Q200 165 400 180 T800 180 L800 200 L0 200 Z" fill="#1e1b4b"/>
            </SVG>
        ),
    },
    // 6. Abstract waves — flowing bezier ribbons
    {
        id: 'flow-ribbons',
        render: () => (
            <SVG bg="#042f2e">
                <path d="M0 100 Q200 30 400 100 T800 100" fill="none" stroke="#14b8a6" strokeWidth="2" opacity="0.6"/>
                <path d="M0 110 Q200 40 400 110 T800 110" fill="none" stroke="#14b8a6" strokeWidth="2" opacity="0.5"/>
                <path d="M0 120 Q200 50 400 120 T800 120" fill="none" stroke="#2dd4bf" strokeWidth="2" opacity="0.4"/>
                <path d="M0 130 Q200 60 400 130 T800 130" fill="none" stroke="#2dd4bf" strokeWidth="2" opacity="0.3"/>
                <path d="M0 140 Q200 70 400 140 T800 140" fill="none" stroke="#5eead4" strokeWidth="2" opacity="0.25"/>
                <path d="M0 150 Q200 80 400 150 T800 150" fill="none" stroke="#5eead4" strokeWidth="2" opacity="0.2"/>
            </SVG>
        ),
    },
    // 7. Neon grid — synthwave horizon
    {
        id: 'neon-horizon',
        render: () => (
            <SVG bg="#1a0b3d">
                <defs>
                    <linearGradient id="nh-sky" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#581c87"/>
                        <stop offset="100%" stopColor="#ec4899"/>
                    </linearGradient>
                </defs>
                <rect x="0" y="0" width="800" height="120" fill="url(#nh-sky)" opacity="0.4"/>
                <circle cx="400" cy="115" r="55" fill="#fbbf24"/>
                <rect x="345" y="90" width="110" height="3" fill="#1a0b3d"/>
                <rect x="345" y="100" width="110" height="3" fill="#1a0b3d"/>
                <rect x="345" y="110" width="110" height="3" fill="#1a0b3d"/>
                {/* horizon grid */}
                {Array.from({length:12}).map((_, i) => {
                    const y = 130 + i * (70 / 12) * (1 + i*0.15)
                    return <line key={i} x1="0" y1={y} x2="800" y2={y} stroke="#ec4899" strokeWidth="1" opacity={0.6 - i*0.04}/>
                })}
                {Array.from({length:13}).map((_, i) => {
                    const startX = 400 + (i - 6) * 30
                    const endX = 400 + (i - 6) * 200
                    return <line key={i} x1={startX} y1="130" x2={endX} y2="200" stroke="#ec4899" strokeWidth="1" opacity="0.4"/>
                })}
            </SVG>
        ),
    },
    // 8. Floating particles — bokeh
    {
        id: 'bokeh-light',
        render: () => (
            <SVG bg="#0c0a09">
                <defs><filter id="bk"><feGaussianBlur stdDeviation="8"/></filter></defs>
                <g filter="url(#bk)">
                    {[[100,60,28],[200,140,18],[300,40,22],[420,120,32],[540,70,16],[640,150,24],[720,90,20],[80,170,14],[380,170,18]].map(([x,y,r], i) => (
                        <circle key={i} cx={x} cy={y} r={r} fill="#fbbf24" opacity={0.4 + (i%3)*0.15}/>
                    ))}
                </g>
                {[[150,80],[280,100],[450,60],[580,140],[680,50]].map(([x,y], i) => (
                    <circle key={`s${i}`} cx={x} cy={y} r="1.5" fill="#fef3c7"/>
                ))}
            </SVG>
        ),
    },
    // 9. Forest mist — silhouette trees with fog
    {
        id: 'forest-mist',
        render: () => (
            <SVG bg="#0f1f1a">
                <defs><filter id="fm"><feGaussianBlur stdDeviation="2"/></filter></defs>
                <rect x="0" y="0" width="800" height="200" fill="#1a3a2e" opacity="0.4"/>
                {/* far trees */}
                {Array.from({length:14}).map((_, i) => {
                    const x = i * 60 + (i%2)*15
                    return <polygon key={`f${i}`} points={`${x},200 ${x-15},120 ${x},80 ${x+15},120`} fill="#0f1f1a" opacity="0.5"/>
                })}
                {/* near trees */}
                {Array.from({length:8}).map((_, i) => {
                    const x = i * 110 + 40
                    return <polygon key={`n${i}`} points={`${x},200 ${x-25},90 ${x},40 ${x+25},90`} fill="#020617" filter="url(#fm)"/>
                })}
                <ellipse cx="400" cy="100" rx="500" ry="40" fill="#94a3b8" opacity="0.15"/>
            </SVG>
        ),
    },
    // 10. Ocean depths — light rays underwater
    {
        id: 'ocean-rays',
        render: () => (
            <SVG bg="#0c4a6e">
                <defs>
                    <linearGradient id="or" x1="0.5" x2="0.5" y1="0" y2="1">
                        <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.4"/>
                        <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0"/>
                    </linearGradient>
                </defs>
                {[100, 250, 380, 520, 670].map((x, i) => (
                    <polygon key={i} points={`${x},0 ${x-30},200 ${x+30},200`} fill="url(#or)"/>
                ))}
                <ellipse cx="400" cy="0" rx="500" ry="50" fill="#bae6fd" opacity="0.3"/>
            </SVG>
        ),
    },
    // 11. Geometric prisms — overlapping translucent shapes
    {
        id: 'prism-stack',
        render: () => (
            <SVG bg="#1e1b4b">
                <polygon points="100,40 250,40 200,160 50,160" fill="#8b5cf6" opacity="0.6"/>
                <polygon points="200,30 380,30 320,170 140,170" fill="#ec4899" opacity="0.5"/>
                <polygon points="350,50 520,50 470,150 300,150" fill="#06b6d4" opacity="0.5"/>
                <polygon points="500,30 680,30 620,170 440,170" fill="#10b981" opacity="0.5"/>
                <polygon points="640,50 800,50 750,150 590,150" fill="#f59e0b" opacity="0.5"/>
            </SVG>
        ),
    },
    // 12. Kintsugi gold cracks — Japanese aesthetic
    {
        id: 'kintsugi',
        render: () => (
            <SVG bg="#0c0a09">
                <path d="M0 120 L150 80 L220 130 L380 60 L450 110 L580 70 L680 130 L800 90" fill="none" stroke="#fbbf24" strokeWidth="2"/>
                <path d="M0 160 L120 130 L200 170 L340 110 L420 150 L560 100 L660 160 L800 130" fill="none" stroke="#fbbf24" strokeWidth="1.5" opacity="0.7"/>
                <path d="M150 80 L180 30 M380 60 L410 20 M580 70 L610 30" stroke="#fbbf24" strokeWidth="1.5" opacity="0.8"/>
                <path d="M220 130 L250 180 M450 110 L480 170 M680 130 L710 180" stroke="#fbbf24" strokeWidth="1.5" opacity="0.8"/>
                <circle cx="150" cy="80" r="2" fill="#fbbf24"/>
                <circle cx="380" cy="60" r="2" fill="#fbbf24"/>
                <circle cx="580" cy="70" r="2" fill="#fbbf24"/>
            </SVG>
        ),
    },
    // 13. Soft mesh gradient — pastel calm
    {
        id: 'pastel-mesh',
        render: () => (
            <SVG bg="#fef3c7">
                <defs><filter id="pm"><feGaussianBlur stdDeviation="50"/></filter></defs>
                <g filter="url(#pm)">
                    <circle cx="100" cy="50" r="120" fill="#fbcfe8"/>
                    <circle cx="450" cy="180" r="160" fill="#bfdbfe"/>
                    <circle cx="700" cy="50" r="140" fill="#bbf7d0"/>
                    <circle cx="300" cy="100" r="80" fill="#fde68a"/>
                </g>
            </SVG>
        ),
    },
    // 14. Tech network — connected nodes
    {
        id: 'tech-network',
        render: () => {
            const nodes = [[100,60],[180,130],[270,50],[360,120],[450,70],[540,140],[630,60],[720,130]]
            return (
                <SVG bg="#0f172a">
                    {nodes.map((a, i) => nodes.slice(i+1).map((b, j) => {
                        const dist = Math.hypot(a[0]-b[0], a[1]-b[1])
                        if (dist > 200) return null
                        return <line key={`${i}-${j}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#3b82f6" strokeWidth="0.8" opacity="0.4"/>
                    }))}
                    {nodes.map(([x,y], i) => (
                        <g key={i}>
                            <circle cx={x} cy={y} r="10" fill="#3b82f6" opacity="0.2"/>
                            <circle cx={x} cy={y} r="4" fill="#60a5fa"/>
                        </g>
                    ))}
                </SVG>
            )
        },
    },
    // 15. Marble swirl — flowing organic
    {
        id: 'marble-swirl',
        render: () => (
            <SVG bg="#1e293b">
                <defs>
                    <filter id="ms"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3"/><feDisplacementMap in="SourceGraphic" scale="40"/></filter>
                </defs>
                <g filter="url(#ms)" opacity="0.6">
                    <path d="M0 100 Q200 50 400 100 T800 100 L800 130 Q600 80 400 130 T0 130 Z" fill="#cbd5e1"/>
                    <path d="M0 140 Q200 90 400 140 T800 140 L800 165 Q600 115 400 165 T0 165 Z" fill="#94a3b8" opacity="0.6"/>
                </g>
                <path d="M0 80 Q300 30 500 90 T800 70" fill="none" stroke="#f1f5f9" strokeWidth="0.5" opacity="0.5"/>
            </SVG>
        ),
    },
    // 16. Geometric sunburst
    {
        id: 'sunburst-geo',
        render: () => (
            <SVG bg="#7c2d12">
                <g transform="translate(400, 200)">
                    {Array.from({length: 24}).map((_, i) => {
                        const angle = (i * 15 - 90) * Math.PI / 180
                        const x = Math.cos(angle) * 600
                        const y = Math.sin(angle) * 600
                        return <line key={i} x1="0" y1="0" x2={x} y2={y} stroke="#fbbf24" strokeWidth={i%2 ? 1 : 2} opacity={i%2 ? 0.2 : 0.4}/>
                    })}
                </g>
                <circle cx="400" cy="200" r="40" fill="#fbbf24"/>
                <circle cx="400" cy="200" r="60" fill="#fbbf24" opacity="0.3"/>
            </SVG>
        ),
    },
    // 17. Cosmic dust — nebula
    {
        id: 'nebula',
        render: () => (
            <SVG bg="#020617">
                <defs>
                    <filter id="nb"><feGaussianBlur stdDeviation="35"/></filter>
                    <radialGradient id="nb-purple"><stop offset="0%" stopColor="#a855f7" stopOpacity="0.7"/><stop offset="100%" stopColor="#a855f7" stopOpacity="0"/></radialGradient>
                    <radialGradient id="nb-pink"><stop offset="0%" stopColor="#ec4899" stopOpacity="0.6"/><stop offset="100%" stopColor="#ec4899" stopOpacity="0"/></radialGradient>
                    <radialGradient id="nb-blue"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5"/><stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/></radialGradient>
                </defs>
                <g filter="url(#nb)">
                    <circle cx="250" cy="80" r="150" fill="url(#nb-purple)"/>
                    <circle cx="500" cy="140" r="180" fill="url(#nb-pink)"/>
                    <circle cx="650" cy="60" r="130" fill="url(#nb-blue)"/>
                </g>
                {Array.from({length:50}).map((_, i) => (
                    <circle key={i} cx={(i*73)%800} cy={(i*53)%200} r={0.6 + (i%3)*0.4} fill="#fff" opacity={0.3 + (i%4)*0.2}/>
                ))}
            </SVG>
        ),
    },
    // 18. Origami folds — paper aesthetic
    {
        id: 'origami',
        render: () => (
            <SVG bg="#1e3a8a">
                <polygon points="0,0 400,0 0,200" fill="#1e40af"/>
                <polygon points="400,0 800,0 800,100 400,200" fill="#2563eb"/>
                <polygon points="0,200 400,200 0,200" fill="#1e3a8a"/>
                <polygon points="400,200 800,100 800,200" fill="#1d4ed8"/>
                <polygon points="200,0 200,100 0,100" fill="#3b82f6" opacity="0.4"/>
                <polygon points="600,100 800,100 800,200 600,200" fill="#60a5fa" opacity="0.3"/>
            </SVG>
        ),
    },
    // 19. Liquid metal — chrome ribbons
    {
        id: 'chrome-flow',
        render: () => (
            <SVG bg="#1e293b">
                <defs>
                    <linearGradient id="ch1" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="#cbd5e1"/>
                        <stop offset="50%" stopColor="#475569"/>
                        <stop offset="100%" stopColor="#cbd5e1"/>
                    </linearGradient>
                </defs>
                <path d="M0 80 Q200 40 400 80 T800 80 L800 110 Q600 70 400 110 T0 110 Z" fill="url(#ch1)" opacity="0.6"/>
                <path d="M0 130 Q200 100 400 130 T800 130 L800 155 Q600 125 400 155 T0 155 Z" fill="url(#ch1)" opacity="0.4"/>
            </SVG>
        ),
    },
    // 20. Botanical — minimal leaves
    {
        id: 'botanical',
        render: () => (
            <SVG bg="#14532d">
                <g stroke="#86efac" strokeWidth="1.2" fill="none" opacity="0.7">
                    {/* branches */}
                    <path d="M50 200 Q60 140 80 100"/>
                    <path d="M80 100 Q70 80 50 70"/>
                    <path d="M80 100 Q90 80 110 75"/>
                    <path d="M65 130 Q55 120 40 120"/>
                    <path d="M75 110 Q85 100 100 100"/>

                    <path d="M250 200 Q260 130 280 80"/>
                    <path d="M280 80 Q270 60 250 50"/>
                    <path d="M280 80 Q290 60 310 55"/>
                    <path d="M270 110 Q260 100 245 100"/>

                    <path d="M520 200 Q530 140 550 90"/>
                    <path d="M550 90 Q540 70 520 60"/>
                    <path d="M550 90 Q560 70 580 65"/>

                    <path d="M720 200 Q730 130 750 80"/>
                    <path d="M750 80 Q740 60 720 50"/>
                    <path d="M750 80 Q760 60 780 55"/>
                </g>
                {/* leaves */}
                {[[50,70],[110,75],[40,120],[100,100],[250,50],[310,55],[245,100],[520,60],[580,65],[720,50],[780,55]].map(([x,y], i) => (
                    <ellipse key={i} cx={x} cy={y} rx="6" ry="3" fill="#4ade80" opacity="0.6" transform={`rotate(${i*30}, ${x}, ${y})`}/>
                ))}
            </SVG>
        ),
    },
    // 21. Cyber rain — vertical light streaks
    {
        id: 'cyber-rain',
        render: () => (
            <SVG bg="#020617">
                <defs>
                    <linearGradient id="cr" x1="0.5" x2="0.5" y1="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity="0"/>
                        <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.8"/>
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity="0"/>
                    </linearGradient>
                </defs>
                {[40,90,160,230,300,370,440,510,580,650,720,770].map((x, i) => (
                    <rect key={i} x={x} y={(i*23)%150} width="1.5" height={60+(i*7)%80} fill="url(#cr)" opacity={0.4 + (i%3)*0.2}/>
                ))}
                {[120,250,400,550,690].map((x, i) => (
                    <rect key={`b${i}`} x={x} y={(i*37)%100} width="1" height="100" fill="#06b6d4" opacity="0.3"/>
                ))}
            </SVG>
        ),
    },
    // 22. Soft sunrise — peachy glow
    {
        id: 'soft-sunrise',
        render: () => (
            <SVG bg="#fef3c7">
                <defs>
                    <radialGradient id="ss" cx="0.5" cy="1">
                        <stop offset="0%" stopColor="#f97316" stopOpacity="0.6"/>
                        <stop offset="100%" stopColor="#f97316" stopOpacity="0"/>
                    </radialGradient>
                </defs>
                <rect width="800" height="200" fill="url(#ss)"/>
                <circle cx="400" cy="180" r="50" fill="#fbbf24"/>
                <circle cx="400" cy="180" r="80" fill="#fbbf24" opacity="0.3"/>
                <circle cx="400" cy="180" r="120" fill="#fbbf24" opacity="0.1"/>
                {/* hills */}
                <path d="M0 200 Q200 160 400 180 T800 170 L800 200 Z" fill="#7c2d12" opacity="0.4"/>
            </SVG>
        ),
    },
    // 23. Diamond mesh — luxury lattice
    {
        id: 'diamond-luxury',
        render: () => (
            <SVG bg="#0c0a09">
                <defs>
                    <linearGradient id="dl1" x1="0" x2="1" y1="0" y2="1">
                        <stop offset="0%" stopColor="#fbbf24"/>
                        <stop offset="100%" stopColor="#92400e"/>
                    </linearGradient>
                </defs>
                <g stroke="url(#dl1)" strokeWidth="1.2" fill="none" opacity="0.6">
                    {Array.from({length: 9}).map((_, i) => (
                        <g key={i} transform={`translate(${i*100 + 50}, 100)`}>
                            <path d="M-30 0 L0 -45 L30 0 L0 45 Z"/>
                            <path d="M-15 0 L0 -22 L15 0 L0 22 Z" opacity="0.5"/>
                        </g>
                    ))}
                </g>
                <g fill="#fbbf24" opacity="0.8">
                    {Array.from({length:9}).map((_, i) => (
                        <circle key={i} cx={i*100+50} cy="100" r="2"/>
                    ))}
                </g>
            </SVG>
        ),
    },
    // 24. Rolling hills — gentle landscape
    {
        id: 'rolling-hills',
        render: () => (
            <SVG bg="#fef9c3">
                <path d="M0 130 Q200 80 400 130 T800 130 L800 200 L0 200 Z" fill="#bef264" opacity="0.7"/>
                <path d="M0 150 Q200 110 400 150 T800 150 L800 200 L0 200 Z" fill="#84cc16" opacity="0.7"/>
                <path d="M0 170 Q200 140 400 170 T800 170 L800 200 L0 200 Z" fill="#65a30d"/>
                <circle cx="650" cy="50" r="28" fill="#fbbf24"/>
                {/* clouds */}
                <ellipse cx="150" cy="50" rx="40" ry="10" fill="#fff" opacity="0.7"/>
                <ellipse cx="450" cy="40" rx="50" ry="12" fill="#fff" opacity="0.7"/>
            </SVG>
        ),
    },
    // 25. Fractal tree — minimal branches
    {
        id: 'fractal-tree',
        render: () => (
            <SVG bg="#1c1917">
                <g stroke="#d4d4d8" strokeWidth="1.5" fill="none" opacity="0.7">
                    <line x1="400" y1="200" x2="400" y2="120"/>
                    <line x1="400" y1="120" x2="340" y2="80"/>
                    <line x1="400" y1="120" x2="460" y2="80"/>
                    <line x1="340" y1="80" x2="310" y2="50"/>
                    <line x1="340" y1="80" x2="370" y2="55"/>
                    <line x1="460" y1="80" x2="430" y2="55"/>
                    <line x1="460" y1="80" x2="490" y2="50"/>
                    <line x1="310" y1="50" x2="295" y2="30"/>
                    <line x1="310" y1="50" x2="325" y2="32"/>
                    <line x1="370" y1="55" x2="385" y2="35"/>
                    <line x1="430" y1="55" x2="415" y2="35"/>
                    <line x1="490" y1="50" x2="475" y2="32"/>
                    <line x1="490" y1="50" x2="505" y2="30"/>
                </g>
                {/* fireflies */}
                {[[200,80],[600,90],[150,140],[700,130],[100,60]].map(([x,y], i) => (
                    <g key={i}>
                        <circle cx={x} cy={y} r="1.5" fill="#fde047"/>
                        <circle cx={x} cy={y} r="6" fill="#fde047" opacity="0.3"/>
                    </g>
                ))}
            </SVG>
        ),
    },
    // 26. Holographic — iridescent waves
    {
        id: 'holographic',
        render: () => (
            <SVG bg="#1e1b4b">
                <defs>
                    <linearGradient id="ho1" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="#06b6d4"/>
                        <stop offset="33%" stopColor="#a855f7"/>
                        <stop offset="66%" stopColor="#ec4899"/>
                        <stop offset="100%" stopColor="#f59e0b"/>
                    </linearGradient>
                </defs>
                <path d="M0 100 Q100 40 200 100 T400 100 T600 100 T800 100" fill="none" stroke="url(#ho1)" strokeWidth="3" opacity="0.7"/>
                <path d="M0 120 Q100 60 200 120 T400 120 T600 120 T800 120" fill="none" stroke="url(#ho1)" strokeWidth="2" opacity="0.5"/>
                <path d="M0 80 Q100 20 200 80 T400 80 T600 80 T800 80" fill="none" stroke="url(#ho1)" strokeWidth="2" opacity="0.5"/>
                <path d="M0 140 Q100 80 200 140 T400 140 T600 140 T800 140" fill="none" stroke="url(#ho1)" strokeWidth="1.5" opacity="0.3"/>
            </SVG>
        ),
    },
    // 27. Stained glass — geometric panels
    {
        id: 'stained-glass',
        render: () => (
            <SVG bg="#1e1b4b">
                <polygon points="0,0 200,0 180,80 0,100" fill="#7c3aed" opacity="0.7"/>
                <polygon points="200,0 400,0 380,90 180,80" fill="#2563eb" opacity="0.7"/>
                <polygon points="400,0 600,0 620,80 380,90" fill="#0891b2" opacity="0.7"/>
                <polygon points="600,0 800,0 800,100 620,80" fill="#059669" opacity="0.7"/>
                <polygon points="0,100 180,80 200,200 0,200" fill="#be185d" opacity="0.7"/>
                <polygon points="180,80 380,90 400,200 200,200" fill="#dc2626" opacity="0.7"/>
                <polygon points="380,90 620,80 600,200 400,200" fill="#ea580c" opacity="0.7"/>
                <polygon points="620,80 800,100 800,200 600,200" fill="#ca8a04" opacity="0.7"/>
                <g stroke="#0c0a09" strokeWidth="1.5" fill="none">
                    <line x1="200" y1="0" x2="180" y2="80" /><line x1="180" y1="80" x2="200" y2="200"/>
                    <line x1="400" y1="0" x2="380" y2="90" /><line x1="380" y1="90" x2="400" y2="200"/>
                    <line x1="600" y1="0" x2="620" y2="80" /><line x1="620" y1="80" x2="600" y2="200"/>
                    <line x1="0" y1="100" x2="180" y2="80"/>
                    <line x1="180" y1="80" x2="380" y2="90"/>
                    <line x1="380" y1="90" x2="620" y2="80"/>
                    <line x1="620" y1="80" x2="800" y2="100"/>
                </g>
            </SVG>
        ),
    },
    // 28. Confetti shower — celebratory
    {
        id: 'confetti',
        render: () => {
            const colors = ['#ec4899','#f59e0b','#10b981','#3b82f6','#a855f7','#ef4444']
            return (
                <SVG bg="#fef3c7">
                    {Array.from({length:60}).map((_, i) => {
                        const x = (i*43)%800
                        const y = (i*67)%200
                        const c = colors[i%colors.length]
                        const r = (i*23)%360
                        return <rect key={i} x={x} y={y} width="8" height="3" fill={c} transform={`rotate(${r}, ${x+4}, ${y+1.5})`} opacity="0.85"/>
                    })}
                </SVG>
            )
        },
    },
    // 29. Minimal arch — Art Deco
    {
        id: 'art-deco',
        render: () => (
            <SVG bg="#1e1b4b">
                <g stroke="#fbbf24" strokeWidth="1.5" fill="none" opacity="0.7">
                    <path d="M400 200 A150 150 0 0 1 250 50"/>
                    <path d="M400 200 A180 180 0 0 1 220 20"/>
                    <path d="M400 200 A210 210 0 0 1 190 -10"/>
                    <path d="M400 200 A150 150 0 0 0 550 50"/>
                    <path d="M400 200 A180 180 0 0 0 580 20"/>
                    <path d="M400 200 A210 210 0 0 0 610 -10"/>
                </g>
                <line x1="0" y1="195" x2="800" y2="195" stroke="#fbbf24" strokeWidth="1"/>
                <circle cx="400" cy="200" r="6" fill="#fbbf24"/>
            </SVG>
        ),
    },
    // 30. Ink splash — abstract brushwork
    {
        id: 'ink-splash',
        render: () => (
            <SVG bg="#fafaf9">
                <path d="M100 80 Q150 40 250 60 Q300 80 280 130 Q260 170 180 160 Q120 140 100 80 Z" fill="#1c1917" opacity="0.85"/>
                <circle cx="320" cy="100" r="4" fill="#1c1917"/>
                <circle cx="340" cy="120" r="2" fill="#1c1917"/>
                <circle cx="280" cy="40" r="3" fill="#1c1917"/>
                <path d="M450 100 Q500 60 580 90 Q620 130 560 160 Q500 170 460 140 Q440 120 450 100 Z" fill="#dc2626" opacity="0.85"/>
                <circle cx="620" cy="80" r="3" fill="#dc2626"/>
                <circle cx="430" cy="60" r="2" fill="#dc2626"/>
                <path d="M680 50 Q720 30 760 60 Q780 100 740 110 Q700 100 680 80 Z" fill="#1c1917" opacity="0.7"/>
            </SVG>
        ),
    },
    // 31. Crystal lattice — geometric
    {
        id: 'crystal-lattice',
        render: () => (
            <SVG bg="#0f172a">
                <g stroke="#22d3ee" strokeWidth="1" fill="none" opacity="0.5">
                    {Array.from({length: 7}).map((_, row) => 
                        Array.from({length: 11}).map((_, col) => {
                            const x = col * 80 + (row%2)*40
                            const y = row * 35
                            return (
                                <g key={`${row}-${col}`}>
                                    <path d={`M${x} ${y} L${x+20} ${y-15} L${x+40} ${y} L${x+20} ${y+15} Z`}/>
                                </g>
                            )
                        })
                    )}
                </g>
                <g fill="#22d3ee" opacity="0.6">
                    {Array.from({length: 7}).map((_, row) => 
                        Array.from({length: 11}).map((_, col) => {
                            const x = col * 80 + (row%2)*40 + 20
                            const y = row * 35
                            return <circle key={`d-${row}-${col}`} cx={x} cy={y} r="1.5"/>
                        })
                    )}
                </g>
            </SVG>
        ),
    },
    // 32. Watercolor wash — soft layered blobs
    {
        id: 'watercolor',
        render: () => (
            <SVG bg="#fff7ed">
                <defs><filter id="wc"><feGaussianBlur stdDeviation="20"/></filter></defs>
                <g filter="url(#wc)" opacity="0.7">
                    <ellipse cx="180" cy="80" rx="130" ry="60" fill="#f97316"/>
                    <ellipse cx="450" cy="120" rx="160" ry="70" fill="#fbbf24"/>
                    <ellipse cx="680" cy="70" rx="140" ry="60" fill="#fb923c"/>
                </g>
                <g opacity="0.4" filter="url(#wc)">
                    <ellipse cx="300" cy="150" rx="100" ry="50" fill="#fef08a"/>
                    <ellipse cx="600" cy="160" rx="120" ry="40" fill="#fef08a"/>
                </g>
            </SVG>
        ),
    },
    // 33. Dunes — desert sand layers
    {
        id: 'dunes',
        render: () => (
            <SVG bg="#fef3c7">
                <defs>
                    <linearGradient id="dn-sky" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#fed7aa"/>
                        <stop offset="100%" stopColor="#fef3c7"/>
                    </linearGradient>
                </defs>
                <rect width="800" height="100" fill="url(#dn-sky)"/>
                <circle cx="600" cy="60" r="35" fill="#fb923c" opacity="0.9"/>
                <path d="M0 130 Q200 90 400 120 Q600 140 800 110 L800 200 L0 200 Z" fill="#fbbf24"/>
                <path d="M0 160 Q150 130 350 150 Q550 175 800 145 L800 200 L0 200 Z" fill="#f59e0b"/>
                <path d="M0 180 Q200 165 400 180 Q600 195 800 175 L800 200 L0 200 Z" fill="#d97706"/>
            </SVG>
        ),
    },
    // 34. Galaxy spiral
    {
        id: 'galaxy',
        render: () => (
            <SVG bg="#020617">
                <defs>
                    <radialGradient id="gx-core"><stop offset="0%" stopColor="#fef3c7"/><stop offset="40%" stopColor="#a855f7" stopOpacity="0.6"/><stop offset="100%" stopColor="#a855f7" stopOpacity="0"/></radialGradient>
                </defs>
                <circle cx="400" cy="100" r="120" fill="url(#gx-core)"/>
                {/* spiral arms */}
                <g opacity="0.5">
                    {Array.from({length:60}).map((_, i) => {
                        const t = i / 60
                        const angle = t * 6 * Math.PI
                        const r = 30 + t * 200
                        const x = 400 + r * Math.cos(angle) * 0.7
                        const y = 100 + r * Math.sin(angle) * 0.4
                        return <circle key={i} cx={x} cy={y} r={1 + t*1.5} fill="#dbeafe" opacity={1 - t*0.5}/>
                    })}
                    {Array.from({length:60}).map((_, i) => {
                        const t = i / 60
                        const angle = t * 6 * Math.PI + Math.PI
                        const r = 30 + t * 200
                        const x = 400 + r * Math.cos(angle) * 0.7
                        const y = 100 + r * Math.sin(angle) * 0.4
                        return <circle key={`b${i}`} cx={x} cy={y} r={1 + t*1.5} fill="#fbcfe8" opacity={1 - t*0.5}/>
                    })}
                </g>
                {/* background stars */}
                {Array.from({length:40}).map((_, i) => (
                    <circle key={`s${i}`} cx={(i*53)%800} cy={(i*43)%200} r={0.6} fill="#fff" opacity={0.4 + (i%3)*0.2}/>
                ))}
            </SVG>
        ),
    },
    // 35. Bauhaus — primary shapes
    {
        id: 'bauhaus',
        render: () => (
            <SVG bg="#f5f5f4">
                <rect x="0" y="0" width="200" height="200" fill="#dc2626"/>
                <circle cx="400" cy="100" r="100" fill="#fbbf24"/>
                <polygon points="600,200 800,200 800,0" fill="#1e40af"/>
                <rect x="200" y="60" width="200" height="80" fill="#0c0a09" opacity="0.85"/>
                <circle cx="100" cy="100" r="30" fill="#0c0a09"/>
            </SVG>
        ),
    },
    // 36. Frosted ice — crystalline
    {
        id: 'frosted-ice',
        render: () => (
            <SVG bg="#0c4a6e">
                <g stroke="#bae6fd" strokeWidth="0.8" fill="none" opacity="0.5">
                    <g transform="translate(150, 100)"><line x1="-30" y1="0" x2="30" y2="0"/><line x1="0" y1="-30" x2="0" y2="30"/><line x1="-21" y1="-21" x2="21" y2="21"/><line x1="-21" y1="21" x2="21" y2="-21"/></g>
                    <g transform="translate(400, 70)"><line x1="-25" y1="0" x2="25" y2="0"/><line x1="0" y1="-25" x2="0" y2="25"/><line x1="-18" y1="-18" x2="18" y2="18"/><line x1="-18" y1="18" x2="18" y2="-18"/></g>
                    <g transform="translate(650, 130)"><line x1="-35" y1="0" x2="35" y2="0"/><line x1="0" y1="-35" x2="0" y2="35"/><line x1="-25" y1="-25" x2="25" y2="25"/><line x1="-25" y1="25" x2="25" y2="-25"/></g>
                    <g transform="translate(280, 160)"><line x1="-20" y1="0" x2="20" y2="0"/><line x1="0" y1="-20" x2="0" y2="20"/><line x1="-14" y1="-14" x2="14" y2="14"/><line x1="-14" y1="14" x2="14" y2="-14"/></g>
                    <g transform="translate(550, 40)"><line x1="-22" y1="0" x2="22" y2="0"/><line x1="0" y1="-22" x2="0" y2="22"/><line x1="-15" y1="-15" x2="15" y2="15"/><line x1="-15" y1="15" x2="15" y2="-15"/></g>
                    <g transform="translate(750, 60)"><line x1="-18" y1="0" x2="18" y2="0"/><line x1="0" y1="-18" x2="0" y2="18"/><line x1="-12" y1="-12" x2="12" y2="12"/><line x1="-12" y1="12" x2="12" y2="-12"/></g>
                    <g transform="translate(60, 50)"><line x1="-20" y1="0" x2="20" y2="0"/><line x1="0" y1="-20" x2="0" y2="20"/><line x1="-14" y1="-14" x2="14" y2="14"/><line x1="-14" y1="14" x2="14" y2="-14"/></g>
                </g>
                {[150,400,650,280,550,750,60].map((x, i) => {
                    const y = [100,70,130,160,40,60,50][i]
                    return <circle key={i} cx={x} cy={y} r="2" fill="#e0f2fe"/>
                })}
            </SVG>
        ),
    },
    // 37. Sound waves — audio bars
    {
        id: 'sound-waves',
        render: () => (
            <SVG bg="#1e1b4b">
                <defs>
                    <linearGradient id="sw" x1="0.5" x2="0.5" y1="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee"/>
                        <stop offset="100%" stopColor="#3b82f6"/>
                    </linearGradient>
                </defs>
                {Array.from({length:80}).map((_, i) => {
                    const h = 20 + Math.abs(Math.sin(i * 0.3) * 80) + (i*7%30)
                    return <rect key={i} x={i*10 + 2} y={(200-h)/2} width="6" height={h} fill="url(#sw)" rx="2" opacity="0.85"/>
                })}
            </SVG>
        ),
    },
    // 38. Mountain reflection — symmetrical
    {
        id: 'mountain-reflection',
        render: () => (
            <SVG bg="#1e3a8a">
                {/* sky */}
                <circle cx="650" cy="40" r="20" fill="#fef3c7"/>
                <circle cx="650" cy="40" r="30" fill="#fef3c7" opacity="0.3"/>
                {/* upper mountains */}
                <polygon points="0,100 150,40 280,80 420,30 580,70 720,40 800,80 800,100" fill="#1e293b"/>
                {/* dividing water line */}
                <line x1="0" y1="100" x2="800" y2="100" stroke="#60a5fa" strokeWidth="1" opacity="0.4"/>
                {/* reflection */}
                <polygon points="0,100 150,160 280,120 420,170 580,130 720,160 800,120 800,100" fill="#1e293b" opacity="0.5"/>
                {/* ripples */}
                <line x1="100" y1="120" x2="200" y2="120" stroke="#60a5fa" strokeWidth="0.8" opacity="0.5"/>
                <line x1="350" y1="140" x2="500" y2="140" stroke="#60a5fa" strokeWidth="0.8" opacity="0.5"/>
                <line x1="600" y1="160" x2="700" y2="160" stroke="#60a5fa" strokeWidth="0.8" opacity="0.5"/>
                <line x1="50" y1="180" x2="180" y2="180" stroke="#60a5fa" strokeWidth="0.8" opacity="0.4"/>
            </SVG>
        ),
    },
    // 39. Geode — crystal cluster
    {
        id: 'geode',
        render: () => (
            <SVG bg="#1e1b4b">
                <defs>
                    <linearGradient id="gd1" x1="0" x2="1" y1="0" y2="1">
                        <stop offset="0%" stopColor="#a855f7"/>
                        <stop offset="100%" stopColor="#581c87"/>
                    </linearGradient>
                </defs>
                <g stroke="#c084fc" strokeWidth="0.8" opacity="0.8">
                    <polygon points="100,60 130,40 170,55 175,90 145,110 110,95" fill="url(#gd1)"/>
                    <polygon points="200,80 230,50 280,65 290,110 250,130 210,115" fill="url(#gd1)" opacity="0.85"/>
                    <polygon points="320,40 360,30 400,55 395,100 355,115 320,90" fill="url(#gd1)" opacity="0.9"/>
                    <polygon points="430,70 470,50 510,65 515,110 480,130 440,115" fill="url(#gd1)" opacity="0.8"/>
                    <polygon points="550,50 590,35 630,55 625,100 590,115 555,95" fill="url(#gd1)" opacity="0.9"/>
                    <polygon points="670,80 710,55 750,75 755,120 715,140 675,115" fill="url(#gd1)" opacity="0.85"/>
                </g>
                {/* sparkles */}
                {[[140,75],[250,95],[360,70],[480,90],[590,75],[710,95]].map(([x,y], i) => (
                    <g key={i}>
                        <circle cx={x} cy={y} r="1.5" fill="#fff"/>
                        <line x1={x-4} y1={y} x2={x+4} y2={y} stroke="#fff" strokeWidth="0.8" opacity="0.6"/>
                        <line x1={x} y1={y-4} x2={x} y2={y+4} stroke="#fff" strokeWidth="0.8" opacity="0.6"/>
                    </g>
                ))}
            </SVG>
        ),
    },
    // 40. Linear sunset — Japanese minimal
    {
        id: 'minimal-sunset',
        render: () => (
            <SVG bg="#fee2e2">
                <defs>
                    <linearGradient id="ms-sky" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#fef3c7"/>
                        <stop offset="100%" stopColor="#fda4af"/>
                    </linearGradient>
                </defs>
                <rect width="800" height="200" fill="url(#ms-sky)"/>
                <circle cx="400" cy="100" r="60" fill="#dc2626" opacity="0.95"/>
                {/* horizontal lines through circle */}
                <line x1="0" y1="80" x2="800" y2="80" stroke="#fee2e2" strokeWidth="3"/>
                <line x1="0" y1="100" x2="800" y2="100" stroke="#fee2e2" strokeWidth="3"/>
                <line x1="0" y1="120" x2="800" y2="120" stroke="#fee2e2" strokeWidth="3"/>
                <line x1="0" y1="140" x2="800" y2="140" stroke="#fee2e2" strokeWidth="3"/>
            </SVG>
        ),
    },
    // 41. Topographic art — refined contours
    {
        id: 'topo-art',
        render: () => (
            <SVG bg="#0c0a09">
                <g fill="none" stroke="#fbbf24" strokeWidth="0.8">
                    <path d="M0 100 Q200 60 400 100 T800 100" opacity="0.7"/>
                    <path d="M0 110 Q200 75 400 110 T800 110" opacity="0.6"/>
                    <path d="M0 120 Q200 90 400 120 T800 120" opacity="0.5"/>
                    <path d="M0 90 Q200 45 400 90 T800 90" opacity="0.5"/>
                    <path d="M0 80 Q200 30 400 80 T800 80" opacity="0.4"/>
                    <path d="M0 130 Q200 105 400 130 T800 130" opacity="0.4"/>
                    <path d="M0 140 Q200 120 400 140 T800 140" opacity="0.3"/>
                    <path d="M0 70 Q200 15 400 70 T800 70" opacity="0.3"/>
                    <path d="M0 60 Q200 0 400 60 T800 60" opacity="0.2"/>
                    <path d="M0 150 Q200 135 400 150 T800 150" opacity="0.2"/>
                </g>
            </SVG>
        ),
    },
    // 42. Bonsai branch — minimal asian art
    {
        id: 'bonsai',
        render: () => (
            <SVG bg="#fef3c7">
                <g stroke="#1c1917" fill="none" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M50 200 Q60 160 90 140 Q140 130 200 145"/>
                    <path d="M200 145 Q240 150 280 130"/>
                    <path d="M280 130 Q320 110 380 120"/>
                    <path d="M380 120 Q440 130 490 100"/>
                    <path d="M150 145 Q160 115 180 100"/>
                    <path d="M280 130 Q300 95 330 80"/>
                </g>
                <g fill="#dc2626" opacity="0.8">
                    {[[180,100,4],[200,90,3],[220,95,5],[330,80,5],[350,70,4],[370,85,4],[490,100,5],[510,90,4],[470,105,3]].map(([x,y,r], i) => (
                        <circle key={i} cx={x} cy={y} r={r}/>
                    ))}
                </g>
                <line x1="0" y1="200" x2="800" y2="200" stroke="#1c1917" strokeWidth="3"/>
                {/* signature stamp */}
                <rect x="730" y="155" width="22" height="22" fill="#dc2626"/>
                <text x="741" y="170" fontSize="10" fill="#fef3c7" textAnchor="middle" fontFamily="serif">壱</text>
            </SVG>
        ),
    },
    // 43. Smoke wisps — flowing dark elegance
    {
        id: 'smoke',
        render: () => (
            <SVG bg="#0c0a09">
                <defs><filter id="sm"><feGaussianBlur stdDeviation="6"/></filter></defs>
                <g filter="url(#sm)" fill="none" strokeWidth="40" opacity="0.4" strokeLinecap="round">
                    <path d="M-50 150 Q150 50 350 130 Q500 200 700 80 Q800 50 900 100" stroke="#475569"/>
                    <path d="M-50 80 Q200 180 400 90 Q550 30 750 130" stroke="#64748b" opacity="0.6"/>
                </g>
                <g filter="url(#sm)" fill="none" strokeWidth="20" opacity="0.5" strokeLinecap="round">
                    <path d="M0 120 Q200 200 400 100 Q600 0 800 120" stroke="#94a3b8"/>
                </g>
            </SVG>
        ),
    },
    // 44. Cosmic dawn — sun rising
    {
        id: 'cosmic-dawn',
        render: () => (
            <SVG bg="#1e1b4b">
                <defs>
                    <radialGradient id="cd1" cx="0.5" cy="1">
                        <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.9"/>
                        <stop offset="40%" stopColor="#f97316" stopOpacity="0.5"/>
                        <stop offset="100%" stopColor="#f97316" stopOpacity="0"/>
                    </radialGradient>
                </defs>
                <rect width="800" height="200" fill="url(#cd1)"/>
                <circle cx="400" cy="220" r="80" fill="#fbbf24"/>
                {/* radiating rays */}
                <g stroke="#fef3c7" strokeWidth="1" opacity="0.4">
                    {Array.from({length:24}).map((_, i) => {
                        const a = (i * 7.5 - 90) * Math.PI / 180
                        return <line key={i} x1="400" y1="220" x2={400 + Math.cos(a)*350} y2={220 + Math.sin(a)*350}/>
                    })}
                </g>
                {/* stars in upper sky */}
                {[[60,30,1.5],[150,50,1],[280,20,1.5],[400,40,1],[520,25,1.5],[650,45,1],[750,30,1.5],[100,80,0.8],[200,90,1],[700,80,1]].map(([x,y,r], i) => (
                    <circle key={i} cx={x} cy={y} r={r} fill="#fef3c7" opacity={0.6 + (i%3)*0.2}/>
                ))}
            </SVG>
        ),
    },
    // 45. Chrome ribbons — fluid metal
    {
        id: 'fluid-chrome',
        render: () => (
            <SVG bg="#0f172a">
                <defs>
                    <linearGradient id="fc1" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#cbd5e1"/>
                        <stop offset="50%" stopColor="#334155"/>
                        <stop offset="100%" stopColor="#94a3b8"/>
                    </linearGradient>
                    <linearGradient id="fc2" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#a5f3fc"/>
                        <stop offset="50%" stopColor="#0e7490"/>
                        <stop offset="100%" stopColor="#67e8f9"/>
                    </linearGradient>
                </defs>
                <path d="M0 40 Q200 100 400 60 T800 80 L800 120 Q600 60 400 100 T0 80 Z" fill="url(#fc1)" opacity="0.85"/>
                <path d="M0 120 Q200 80 400 130 T800 110 L800 160 Q600 110 400 170 T0 150 Z" fill="url(#fc2)" opacity="0.7"/>
            </SVG>
        ),
    },
    // 46. Glassmorphism — frosted layered cards
    {
        id: 'glassmorphism',
        render: () => (
            <SVG bg="#1e1b4b">
                <defs>
                    <radialGradient id="gm-bg" cx="0.3" cy="0.3"><stop offset="0%" stopColor="#a855f7" stopOpacity="0.6"/><stop offset="100%" stopColor="#a855f7" stopOpacity="0"/></radialGradient>
                    <radialGradient id="gm-bg2" cx="0.7" cy="0.7"><stop offset="0%" stopColor="#ec4899" stopOpacity="0.5"/><stop offset="100%" stopColor="#ec4899" stopOpacity="0"/></radialGradient>
                </defs>
                <circle cx="240" cy="60" r="180" fill="url(#gm-bg)"/>
                <circle cx="560" cy="140" r="180" fill="url(#gm-bg2)"/>
                <rect x="60" y="40" width="220" height="120" rx="14" fill="#ffffff" opacity="0.08" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="1"/>
                <rect x="290" y="60" width="220" height="120" rx="14" fill="#ffffff" opacity="0.1" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="1"/>
                <rect x="520" y="40" width="220" height="120" rx="14" fill="#ffffff" opacity="0.08" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="1"/>
            </SVG>
        ),
    },
    // 47. Generative dots — perlin-like density
    {
        id: 'generative-dots',
        render: () => (
            <SVG bg="#0a0a0a">
                {Array.from({length: 600}).map((_, i) => {
                    const x = (i * 37 + (i*13) % 47) % 800
                    const y = (i * 53 + (i*17) % 31) % 200
                    const cx = 400, cy = 100
                    const dist = Math.hypot(x - cx, y - cy)
                    const r = Math.max(0, 3 - dist / 80)
                    return r > 0.3 ? <circle key={i} cx={x} cy={y} r={r} fill="#fbbf24" opacity={r/3}/> : null
                })}
            </SVG>
        ),
    },
    // 48. Voronoi cells — organic mosaic
    {
        id: 'voronoi',
        render: () => {
            const points = [[80,60],[200,40],[320,90],[450,30],[580,80],[700,50],[120,150],[260,160],[400,140],[540,170],[680,140],[760,90]]
            return (
                <SVG bg="#0f172a">
                    <g stroke="#3b82f6" strokeWidth="0.8" fill="none" opacity="0.5">
                        {points.map(([x,y], i) => points.slice(i+1).map(([x2,y2], j) => {
                            const mx = (x + x2) / 2, my = (y + y2) / 2
                            const dx = x2 - x, dy = y2 - y
                            const len = Math.hypot(dx, dy)
                            if (len > 250) return null
                            const px = -dy / len * 80, py = dx / len * 80
                            return <line key={`${i}-${j}`} x1={mx - px} y1={my - py} x2={mx + px} y2={my + py}/>
                        }))}
                    </g>
                    {points.map(([x,y], i) => (
                        <circle key={i} cx={x} cy={y} r="2.5" fill="#60a5fa"/>
                    ))}
                </SVG>
            )
        },
    },
    // 49. Light beams — cinematic
    {
        id: 'light-beams',
        render: () => (
            <SVG bg="#0c0a09">
                <defs>
                    <linearGradient id="lb1" x1="0" x2="1" y1="0" y2="0.6">
                        <stop offset="0%" stopColor="#fbbf24" stopOpacity="0"/>
                        <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.5"/>
                        <stop offset="100%" stopColor="#fbbf24" stopOpacity="0"/>
                    </linearGradient>
                </defs>
                <g>
                    <polygon points="200,0 400,0 700,200 500,200" fill="url(#lb1)" opacity="0.6"/>
                    <polygon points="350,0 500,0 800,200 650,200" fill="url(#lb1)" opacity="0.5"/>
                    <polygon points="500,0 600,0 850,200 750,200" fill="url(#lb1)" opacity="0.4"/>
                </g>
                {Array.from({length: 25}).map((_, i) => (
                    <circle key={i} cx={(i*73)%800} cy={(i*43)%200} r="0.8" fill="#fef3c7" opacity={0.3 + (i%3)*0.2}/>
                ))}
            </SVG>
        ),
    },
    // 50. Cherry blossoms — soft pink
    {
        id: 'cherry-blossom',
        render: () => (
            <SVG bg="#fdf2f8">
                <g stroke="#1c1917" strokeWidth="1.5" fill="none" opacity="0.7">
                    <path d="M-20 200 Q40 140 100 130 Q180 125 250 100"/>
                    <path d="M250 100 Q320 90 380 60"/>
                    <path d="M100 130 Q120 100 140 70"/>
                    <path d="M180 125 Q200 90 220 60"/>
                </g>
                {[[140,70],[155,55],[170,75],[220,60],[235,45],[200,80],[290,80],[330,75],[370,50],[120,110],[90,145],[60,170],[260,90],[310,90],[350,65]].map(([x,y], i) => (
                    <g key={i} transform={`translate(${x}, ${y})`}>
                        {[0,72,144,216,288].map(a => (
                            <ellipse key={a} cx="0" cy="-3" rx="2" ry="3.5" fill="#f9a8d4" transform={`rotate(${a})`}/>
                        ))}
                        <circle cx="0" cy="0" r="0.8" fill="#fbbf24"/>
                    </g>
                ))}
            </SVG>
        ),
    },
    // 51. Rain on window
    {
        id: 'rain-window',
        render: () => (
            <SVG bg="#1e293b">
                <defs><filter id="rw"><feGaussianBlur stdDeviation="3"/></filter></defs>
                <g filter="url(#rw)" opacity="0.5">
                    <circle cx="120" cy="50" r="60" fill="#fbbf24"/>
                    <circle cx="500" cy="120" r="80" fill="#3b82f6"/>
                    <circle cx="700" cy="60" r="50" fill="#a855f7"/>
                </g>
                {Array.from({length: 40}).map((_, i) => {
                    const x = (i * 41) % 800
                    const y = (i * 23) % 200
                    const len = 3 + (i % 4) * 3
                    return (
                        <g key={i}>
                            <circle cx={x} cy={y} r="2" fill="#dbeafe" opacity="0.6"/>
                            <line x1={x} y1={y} x2={x} y2={y + len + 8} stroke="#dbeafe" strokeWidth="0.8" opacity="0.4"/>
                        </g>
                    )
                })}
            </SVG>
        ),
    },
    // 52. Lightning storm
    {
        id: 'lightning',
        render: () => (
            <SVG bg="#020617">
                <defs>
                    <linearGradient id="ls" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#1e1b4b"/>
                        <stop offset="100%" stopColor="#020617"/>
                    </linearGradient>
                    <filter id="lg"><feGaussianBlur stdDeviation="4"/></filter>
                </defs>
                <rect width="800" height="200" fill="url(#ls)"/>
                <g filter="url(#lg)" stroke="#fef3c7" strokeWidth="3" fill="none" opacity="0.6">
                    <path d="M200 0 L180 40 L210 60 L170 100 L200 120 L160 200"/>
                    <path d="M520 0 L500 30 L530 55 L490 90 L520 130"/>
                </g>
                <g stroke="#fef3c7" strokeWidth="1.5" fill="none">
                    <path d="M200 0 L180 40 L210 60 L170 100 L200 120 L160 200"/>
                    <path d="M520 0 L500 30 L530 55 L490 90 L520 130"/>
                </g>
                {/* clouds */}
                <ellipse cx="100" cy="40" rx="80" ry="15" fill="#1e293b" opacity="0.8"/>
                <ellipse cx="400" cy="30" rx="100" ry="20" fill="#1e293b" opacity="0.8"/>
                <ellipse cx="700" cy="40" rx="90" ry="18" fill="#1e293b" opacity="0.8"/>
            </SVG>
        ),
    },
    // 53. Cosmic web — interconnected
    {
        id: 'cosmic-web',
        render: () => {
            const stars = [[80,40],[180,90],[290,30],[380,80],[470,40],[560,90],[640,40],[720,80],[100,160],[220,140],[340,180],[460,140],[580,170],[700,140]]
            return (
                <SVG bg="#020617">
                    <g stroke="#a855f7" strokeWidth="0.5" fill="none" opacity="0.5">
                        {stars.map((a, i) => stars.slice(i+1).map((b, j) => {
                            const d = Math.hypot(a[0]-b[0], a[1]-b[1])
                            if (d > 180) return null
                            return <line key={`${i}-${j}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}/>
                        }))}
                    </g>
                    {stars.map(([x,y], i) => (
                        <g key={i}>
                            <circle cx={x} cy={y} r="8" fill="#a855f7" opacity="0.2"/>
                            <circle cx={x} cy={y} r="3" fill="#c084fc"/>
                            <circle cx={x} cy={y} r="1" fill="#fff"/>
                        </g>
                    ))}
                </SVG>
            )
        },
    },
    // 54. Vintage stripes — retro pattern
    {
        id: 'vintage-stripes',
        render: () => (
            <SVG bg="#fef3c7">
                <rect x="0" y="0" width="800" height="200" fill="#fef3c7"/>
                {[0,100,200,300,400,500,600,700].map((x, i) => (
                    <rect key={i} x={x} y="0" width="50" height="200" fill={i%2 ? "#dc2626" : "#1e3a8a"} opacity="0.85"/>
                ))}
                <circle cx="400" cy="100" r="60" fill="#fef3c7" stroke="#0c0a09" strokeWidth="3"/>
                <text x="400" y="108" fontSize="24" fontFamily="serif" fontWeight="bold" textAnchor="middle" fill="#0c0a09">★</text>
            </SVG>
        ),
    },
    // 55. Plasma field — energy distortion
    {
        id: 'plasma-field',
        render: () => (
            <SVG bg="#0c0a30">
                <defs>
                    <radialGradient id="pf1"><stop offset="0%" stopColor="#22d3ee"/><stop offset="100%" stopColor="#22d3ee" stopOpacity="0"/></radialGradient>
                    <radialGradient id="pf2"><stop offset="0%" stopColor="#a855f7"/><stop offset="100%" stopColor="#a855f7" stopOpacity="0"/></radialGradient>
                    <radialGradient id="pf3"><stop offset="0%" stopColor="#ec4899"/><stop offset="100%" stopColor="#ec4899" stopOpacity="0"/></radialGradient>
                    <filter id="pf-blur"><feGaussianBlur stdDeviation="15"/></filter>
                </defs>
                <g filter="url(#pf-blur)">
                    <circle cx="200" cy="60" r="80" fill="url(#pf1)" opacity="0.7"/>
                    <circle cx="400" cy="140" r="100" fill="url(#pf2)" opacity="0.7"/>
                    <circle cx="600" cy="60" r="80" fill="url(#pf3)" opacity="0.7"/>
                </g>
                <g stroke="#67e8f9" strokeWidth="1" fill="none" opacity="0.4">
                    <path d="M0 100 Q200 50 400 100 T800 100"/>
                    <path d="M0 90 Q200 40 400 90 T800 90"/>
                    <path d="M0 110 Q200 60 400 110 T800 110"/>
                </g>
            </SVG>
        ),
    },
    // 56. Origami crane — minimal
    {
        id: 'origami-crane',
        render: () => (
            <SVG bg="#fef3c7">
                <g transform="translate(400, 100)" stroke="#0c0a09" strokeWidth="1.2" fill="none">
                    <polygon points="-40,0 -10,-20 0,-30 10,-20 40,0 30,15 0,8 -30,15" fill="#0c0a09" opacity="0.05"/>
                    <line x1="-40" y1="0" x2="0" y2="-30"/>
                    <line x1="40" y1="0" x2="0" y2="-30"/>
                    <line x1="-40" y1="0" x2="40" y2="0"/>
                    <line x1="0" y1="-30" x2="0" y2="8"/>
                    <line x1="-30" y1="15" x2="0" y2="-10"/>
                    <line x1="30" y1="15" x2="0" y2="-10"/>
                    <line x1="-40" y1="0" x2="-50" y2="20"/>
                    <line x1="40" y1="0" x2="50" y2="20"/>
                    <path d="M0 -30 L8 -38 L4 -32"/>
                </g>
                {/* tiny silhouettes flying */}
                <g fill="#0c0a09" opacity="0.3">
                    <path d="M100 50 l-4 -2 l4 0 l-4 2 z"/>
                    <path d="M150 70 l-4 -2 l4 0 l-4 2 z"/>
                    <path d="M650 60 l-4 -2 l4 0 l-4 2 z"/>
                    <path d="M700 80 l-4 -2 l4 0 l-4 2 z"/>
                </g>
                <line x1="0" y1="200" x2="800" y2="200" stroke="#dc2626" strokeWidth="2"/>
            </SVG>
        ),
    },
    // 57. Geometric snake — flowing path
    {
        id: 'geometric-snake',
        render: () => (
            <SVG bg="#1e293b">
                <defs>
                    <linearGradient id="gs1" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="#22d3ee"/>
                        <stop offset="50%" stopColor="#a855f7"/>
                        <stop offset="100%" stopColor="#ec4899"/>
                    </linearGradient>
                </defs>
                <path d="M-20 100 Q100 40 200 100 T400 100 T600 100 T800 100" fill="none" stroke="url(#gs1)" strokeWidth="40" opacity="0.4" strokeLinecap="round"/>
                <path d="M-20 100 Q100 40 200 100 T400 100 T600 100 T800 100" fill="none" stroke="url(#gs1)" strokeWidth="20" opacity="0.7" strokeLinecap="round"/>
                <path d="M-20 100 Q100 40 200 100 T400 100 T600 100 T800 100" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            </SVG>
        ),
    },
    // 58. Interlocking circles — Olympic-style
    {
        id: 'interlocking-circles',
        render: () => (
            <SVG bg="#0c0a09">
                <g fill="none" strokeWidth="6" opacity="0.85">
                    <circle cx="180" cy="100" r="55" stroke="#22d3ee"/>
                    <circle cx="280" cy="100" r="55" stroke="#fbbf24"/>
                    <circle cx="380" cy="100" r="55" stroke="#0c0a09"/>
                    <circle cx="480" cy="100" r="55" stroke="#10b981"/>
                    <circle cx="580" cy="100" r="55" stroke="#ec4899"/>
                </g>
                <g fill="none" strokeWidth="6">
                    <path d="M225 75 a55 55 0 0 1 10 22" stroke="#22d3ee"/>
                    <path d="M325 75 a55 55 0 0 1 10 22" stroke="#fbbf24"/>
                    <path d="M425 75 a55 55 0 0 1 10 22" stroke="#0c0a09"/>
                    <path d="M525 75 a55 55 0 0 1 10 22" stroke="#10b981"/>
                </g>
            </SVG>
        ),
    },
    // 59. Pixelated landscape — 8-bit
    {
        id: 'pixel-landscape',
        render: () => (
            <SVG bg="#1e293b" shapeRendering="crispEdges">
                {/* sky pixels */}
                <rect x="0" y="0" width="800" height="100" fill="#1e3a8a"/>
                {/* sun */}
                <rect x="600" y="20" width="40" height="40" fill="#fbbf24"/>
                <rect x="595" y="25" width="50" height="30" fill="#fbbf24"/>
                <rect x="590" y="30" width="60" height="20" fill="#fbbf24"/>
                {/* clouds */}
                <rect x="100" y="40" width="60" height="10" fill="#cbd5e1"/>
                <rect x="110" y="35" width="40" height="20" fill="#cbd5e1"/>
                <rect x="300" y="50" width="80" height="10" fill="#cbd5e1"/>
                <rect x="310" y="45" width="60" height="20" fill="#cbd5e1"/>
                {/* mountain pixels */}
                <polygon points="0,140 80,80 160,140" fill="#475569"/>
                <polygon points="120,140 220,60 320,140" fill="#334155"/>
                <polygon points="280,140 380,90 480,140" fill="#475569"/>
                <polygon points="440,140 560,70 680,140" fill="#334155"/>
                <polygon points="640,140 740,100 800,140" fill="#475569"/>
                {/* ground */}
                <rect x="0" y="140" width="800" height="60" fill="#15803d"/>
                {/* trees */}
                {[150,300,500,650].map((x, i) => (
                    <g key={i}>
                        <rect x={x-3} y="155" width="6" height="20" fill="#7c2d12"/>
                        <rect x={x-12} y="140" width="24" height="20" fill="#166534"/>
                        <rect x={x-8} y="135" width="16" height="10" fill="#166534"/>
                    </g>
                ))}
            </SVG>
        ),
    },
    // 60. Music staff — abstract notes
    {
        id: 'music-staff',
        render: () => (
            <SVG bg="#0c0a09">
                {[80, 100, 120, 140, 160].map((y, i) => (
                    <line key={i} x1="40" y1={y} x2="760" y2={y} stroke="#fbbf24" strokeWidth="1" opacity="0.5"/>
                ))}
                {/* treble clef approximation */}
                <text x="55" y="155" fontSize="80" fill="#fbbf24" fontFamily="serif">𝄞</text>
                {/* notes */}
                {[[180,140],[230,120],[280,100],[330,130],[380,110],[440,140],[490,120],[540,100],[590,130],[650,110],[710,120]].map(([x,y], i) => (
                    <g key={i}>
                        <ellipse cx={x} cy={y} rx="6" ry="5" fill="#fbbf24" transform={`rotate(-15, ${x}, ${y})`}/>
                        <line x1={x+5} y1={y} x2={x+5} y2={y-30} stroke="#fbbf24" strokeWidth="1.5"/>
                        {i % 2 === 0 && <path d={`M${x+5} ${y-30} Q${x+15} ${y-25} ${x+10} ${y-15}`} fill="#fbbf24"/>}
                    </g>
                ))}
            </SVG>
        ),
    },
    // 61. Wave interference — physics
    {
        id: 'wave-interference',
        render: () => (
            <SVG bg="#0c4a6e">
                <g fill="none" stroke="#7dd3fc" strokeWidth="0.8" opacity="0.5">
                    {Array.from({length: 12}).map((_, i) => (
                        <circle key={`a${i}`} cx="200" cy="100" r={20 + i * 18}/>
                    ))}
                </g>
                <g fill="none" stroke="#fbbf24" strokeWidth="0.8" opacity="0.5">
                    {Array.from({length: 12}).map((_, i) => (
                        <circle key={`b${i}`} cx="600" cy="100" r={20 + i * 18}/>
                    ))}
                </g>
                <circle cx="200" cy="100" r="4" fill="#dbeafe"/>
                <circle cx="600" cy="100" r="4" fill="#fef3c7"/>
            </SVG>
        ),
    },
    // 62. Mandala — sacred geometry
    {
        id: 'mandala',
        render: () => (
            <SVG bg="#1c1917">
                <g transform="translate(400, 100)" fill="none" stroke="#fbbf24" strokeWidth="0.8" opacity="0.7">
                    {Array.from({length: 24}).map((_, i) => {
                        const a = i * 15
                        return (
                            <g key={i} transform={`rotate(${a})`}>
                                <line x1="0" y1="0" x2="0" y2="-90"/>
                                <ellipse cx="0" cy="-50" rx="6" ry="20"/>
                                <circle cx="0" cy="-75" r="3"/>
                            </g>
                        )
                    })}
                    <circle r="60"/>
                    <circle r="40"/>
                    <circle r="25"/>
                    <circle r="10"/>
                    {Array.from({length: 12}).map((_, i) => {
                        const a = i * 30
                        return <line key={`s${i}`} transform={`rotate(${a})`} x1="0" y1="0" x2="0" y2="-100" strokeWidth="0.4"/>
                    })}
                </g>
            </SVG>
        ),
    },
    // 63. Vinyl record
    {
        id: 'vinyl-record',
        render: () => (
            <SVG bg="#1c1917">
                <g transform="translate(400, 100)">
                    <circle r="95" fill="#0c0a09"/>
                    {[88, 80, 72, 64, 56, 48, 40, 32].map(r => (
                        <circle key={r} r={r} fill="none" stroke="#404040" strokeWidth="0.4"/>
                    ))}
                    <circle r="22" fill="#dc2626"/>
                    <circle r="22" fill="none" stroke="#fef3c7" strokeWidth="1"/>
                    <text y="3" fontSize="8" fill="#fef3c7" textAnchor="middle" fontFamily="serif">VINYL</text>
                    <circle r="2" fill="#fef3c7"/>
                </g>
                {/* light reflection */}
                <ellipse cx="370" cy="60" rx="50" ry="3" fill="#fff" opacity="0.15" transform="rotate(-30, 370, 60)"/>
            </SVG>
        ),
    },
    // 64. City skyline silhouette
    {
        id: 'city-skyline',
        render: () => (
            <SVG bg="#1e1b4b">
                <defs>
                    <linearGradient id="cs-sky" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#1e1b4b"/>
                        <stop offset="100%" stopColor="#7c3aed"/>
                    </linearGradient>
                </defs>
                <rect width="800" height="200" fill="url(#cs-sky)"/>
                <circle cx="650" cy="60" r="25" fill="#fef3c7"/>
                {/* buildings */}
                <g fill="#0c0a09">
                    <rect x="0" y="120" width="60" height="80"/>
                    <rect x="50" y="100" width="50" height="100"/>
                    <rect x="90" y="80" width="70" height="120"/>
                    <rect x="150" y="110" width="45" height="90"/>
                    <rect x="190" y="60" width="60" height="140"/>
                    <polygon points="220,60 235,40 250,60"/>
                    <rect x="240" y="100" width="50" height="100"/>
                    <rect x="280" y="130" width="40" height="70"/>
                    <rect x="310" y="90" width="80" height="110"/>
                    <rect x="385" y="70" width="50" height="130"/>
                    <polygon points="410,70 410,40 415,40 415,70"/>
                    <rect x="430" y="110" width="60" height="90"/>
                    <rect x="485" y="80" width="55" height="120"/>
                    <rect x="535" y="100" width="45" height="100"/>
                    <rect x="575" y="60" width="65" height="140"/>
                    <rect x="635" y="120" width="50" height="80"/>
                    <rect x="680" y="90" width="60" height="110"/>
                    <rect x="735" y="110" width="65" height="90"/>
                </g>
                {/* lit windows */}
                {Array.from({length: 60}).map((_, i) => {
                    const x = (i * 17) % 800
                    const y = 80 + (i * 7) % 100
                    return <rect key={i} x={x} y={y} width="2" height="3" fill="#fbbf24" opacity={0.5 + (i%3)*0.2}/>
                })}
            </SVG>
        ),
    },
    // 65. Gradient mesh blobs
    {
        id: 'gradient-mesh',
        render: () => (
            <SVG bg="#0f172a">
                <defs>
                    <filter id="gm-blur"><feGaussianBlur stdDeviation="40"/></filter>
                </defs>
                <g filter="url(#gm-blur)">
                    <ellipse cx="100" cy="50" rx="180" ry="80" fill="#06b6d4"/>
                    <ellipse cx="450" cy="180" rx="220" ry="100" fill="#a855f7"/>
                    <ellipse cx="700" cy="40" rx="140" ry="80" fill="#ec4899"/>
                    <ellipse cx="350" cy="60" rx="120" ry="50" fill="#f59e0b" opacity="0.7"/>
                </g>
                <g opacity="0.3" stroke="#fff" strokeWidth="0.4" fill="none">
                    <path d="M0 80 Q200 30 400 80 T800 80"/>
                    <path d="M0 140 Q200 100 400 140 T800 140"/>
                </g>
            </SVG>
        ),
    },
    // 66. Tunnel perspective
    {
        id: 'tunnel',
        render: () => (
            <SVG bg="#020617">
                {Array.from({length: 16}).map((_, i) => {
                    const t = i / 16
                    const w = 800 * (1 - t * 0.95)
                    const h = 200 * (1 - t * 0.95)
                    const x = (800 - w) / 2
                    const y = (200 - h) / 2
                    return <rect key={i} x={x} y={y} width={w} height={h} fill="none" stroke="#22d3ee" strokeWidth="1" opacity={0.7 - t*0.5}/>
                })}
                <circle cx="400" cy="100" r="8" fill="#22d3ee"/>
                <circle cx="400" cy="100" r="14" fill="#22d3ee" opacity="0.4"/>
            </SVG>
        ),
    },
    // 67. Vapor trails — jet streams
    {
        id: 'vapor-trails',
        render: () => (
            <SVG bg="#0c4a6e">
                <defs>
                    <linearGradient id="vt1" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="#fff" stopOpacity="0"/>
                        <stop offset="50%" stopColor="#fff" stopOpacity="0.5"/>
                        <stop offset="100%" stopColor="#fff" stopOpacity="0"/>
                    </linearGradient>
                </defs>
                <circle cx="650" cy="50" r="40" fill="#fef3c7" opacity="0.9"/>
                <circle cx="650" cy="50" r="60" fill="#fef3c7" opacity="0.2"/>
                <path d="M0 40 Q200 70 400 50 T800 70" fill="none" stroke="url(#vt1)" strokeWidth="3"/>
                <path d="M0 100 Q200 130 400 110 T800 130" fill="none" stroke="url(#vt1)" strokeWidth="2.5" opacity="0.7"/>
                <path d="M0 150 Q300 180 600 160 T800 170" fill="none" stroke="url(#vt1)" strokeWidth="2"/>
                <path d="M0 70 Q200 90 400 80 T800 90" fill="none" stroke="url(#vt1)" strokeWidth="1.5" opacity="0.5"/>
                {/* tiny plane silhouettes */}
                <path d="M380 47 l-8 -2 l-2 4 l8 2 l-2 4 l4 -2 l4 2 l-2 -4 l8 -2 l-2 -4 l-8 2 z" fill="#1e3a8a" opacity="0.6"/>
                <path d="M580 158 l-8 -2 l-2 4 l8 2 l-2 4 l4 -2 l4 2 l-2 -4 l8 -2 l-2 -4 l-8 2 z" fill="#1e3a8a" opacity="0.5"/>
            </SVG>
        ),
    },
    // 68. Solar system
    {
        id: 'solar-system',
        render: () => (
            <SVG bg="#020617">
                <circle cx="400" cy="100" r="20" fill="#fbbf24"/>
                <circle cx="400" cy="100" r="30" fill="#fbbf24" opacity="0.4"/>
                <circle cx="400" cy="100" r="45" fill="#fbbf24" opacity="0.15"/>
                {[40, 60, 85, 115, 150, 195].map((r, i) => (
                    <ellipse key={i} cx="400" cy="100" rx={r} ry={r*0.5} fill="none" stroke="#475569" strokeWidth="0.5" opacity="0.6"/>
                ))}
                <circle cx={400 + 40} cy="100" r="2" fill="#cbd5e1"/>
                <circle cx={400 - 60} cy="100" r="3" fill="#fb923c"/>
                <circle cx={400 + 85} cy="100" r="3.5" fill="#3b82f6"/>
                <circle cx={400 - 115} cy="100" r="2.5" fill="#dc2626"/>
                <circle cx={400 + 150} cy="100" r="6" fill="#eab308"/>
                <ellipse cx={400 + 150} cy="100" rx="10" ry="2" fill="none" stroke="#eab308" strokeWidth="1"/>
                <circle cx={400 - 195} cy="100" r="5" fill="#a855f7"/>
                {/* stars */}
                {Array.from({length: 35}).map((_, i) => (
                    <circle key={i} cx={(i*53)%800} cy={(i*43)%200} r="0.6" fill="#fff" opacity={0.4 + (i%3)*0.2}/>
                ))}
            </SVG>
        ),
    },
    // 69. Bookshelf — abstract spines
    {
        id: 'bookshelf',
        render: () => {
            const colors = ['#dc2626','#1e3a8a','#15803d','#7c2d12','#581c87','#0e7490','#a16207','#b91c1c','#1e40af','#166534','#831843','#0c4a6e']
            return (
                <SVG bg="#1c1917">
                    <rect x="0" y="180" width="800" height="20" fill="#7c2d12"/>
                    <rect x="0" y="0" width="800" height="20" fill="#7c2d12"/>
                    {Array.from({length: 32}).map((_, i) => {
                        const x = i * 25
                        const w = 18 + (i*7) % 8
                        const h = 130 + (i*11) % 30
                        const c = colors[i % colors.length]
                        return (
                            <g key={i}>
                                <rect x={x} y={200 - h - 20} width={w} height={h} fill={c}/>
                                <rect x={x} y={200 - h - 20} width="2" height={h} fill={c} opacity="0.6"/>
                                <rect x={x + w - 2} y={200 - h - 20} width="2" height={h} fill={c} opacity="0.6"/>
                                {i % 3 === 0 && <text x={x + w/2} y={200 - h/2 - 20} fontSize="6" fill="#fbbf24" textAnchor="middle" transform={`rotate(-90, ${x + w/2}, ${200 - h/2 - 20})`}>BOOK</text>}
                            </g>
                        )
                    })}
                </SVG>
            )
        },
    },
    // 70. Quantum field — particle physics
    {
        id: 'quantum-field',
        render: () => (
            <SVG bg="#0a0a0a">
                <defs>
                    <radialGradient id="qf1"><stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8"/><stop offset="100%" stopColor="#22d3ee" stopOpacity="0"/></radialGradient>
                </defs>
                {/* probability waves */}
                <g stroke="#22d3ee" strokeWidth="0.6" fill="none" opacity="0.4">
                    {Array.from({length: 8}).map((_, i) => (
                        <path key={i} d={`M0 ${100 + i*5} Q${100 + i*20} ${50 + i*10} ${200 + i*30} ${100 + i*5} T${600 + i*20} ${100 + i*5} T${800 + i*20} ${100 + i*5}`}/>
                    ))}
                </g>
                {/* particles */}
                {[[120,80,3],[250,120,4],[380,70,3],[500,130,5],[620,90,3],[720,110,4],[80,140,3],[180,60,3],[320,150,3],[450,40,4],[580,160,3],[680,50,3]].map(([x,y,r], i) => (
                    <g key={i}>
                        <circle cx={x} cy={y} r={r*4} fill="url(#qf1)"/>
                        <circle cx={x} cy={y} r={r} fill="#67e8f9"/>
                    </g>
                ))}
            </SVG>
        ),
    },
    // 71. Crystal cluster — gemstones
    {
        id: 'crystal-cluster',
        render: () => (
            <SVG bg="#0c0a09">
                <defs>
                    <linearGradient id="cc1" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#a78bfa"/><stop offset="100%" stopColor="#581c87"/></linearGradient>
                    <linearGradient id="cc2" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#67e8f9"/><stop offset="100%" stopColor="#0e7490"/></linearGradient>
                    <linearGradient id="cc3" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#fda4af"/><stop offset="100%" stopColor="#9f1239"/></linearGradient>
                </defs>
                <g stroke="#fff" strokeWidth="0.5" opacity="0.95">
                    <polygon points="100,200 80,140 100,80 130,140" fill="url(#cc1)"/>
                    <polygon points="160,200 140,120 165,60 195,120" fill="url(#cc2)"/>
                    <polygon points="240,200 215,150 240,100 270,150" fill="url(#cc3)"/>
                    <polygon points="320,200 300,130 325,70 360,130" fill="url(#cc1)"/>
                    <polygon points="400,200 375,140 400,90 435,140" fill="url(#cc2)"/>
                    <polygon points="490,200 465,150 490,100 525,150" fill="url(#cc3)"/>
                    <polygon points="570,200 545,130 575,60 610,130" fill="url(#cc1)"/>
                    <polygon points="650,200 625,150 650,100 685,150" fill="url(#cc2)"/>
                    <polygon points="730,200 705,140 730,80 765,140" fill="url(#cc3)"/>
                </g>
                {/* sparkles */}
                {[[100,90],[170,80],[250,110],[330,90],[400,100],[490,110],[580,80],[660,110],[740,90]].map(([x,y], i) => (
                    <g key={i}>
                        <circle cx={x} cy={y} r="1.2" fill="#fff"/>
                        <line x1={x-3} y1={y} x2={x+3} y2={y} stroke="#fff" strokeWidth="0.5" opacity="0.7"/>
                        <line x1={x} y1={y-3} x2={x} y2={y+3} stroke="#fff" strokeWidth="0.5" opacity="0.7"/>
                    </g>
                ))}
            </SVG>
        ),
    },
    // 72. Hand-drawn doodle
    {
        id: 'doodle',
        render: () => (
            <SVG bg="#fef3c7">
                <g stroke="#1c1917" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    {/* squiggle */}
                    <path d="M50 100 Q70 60 90 100 T130 100 T170 100 T210 100"/>
                    {/* heart */}
                    <path d="M260 100 C250 90 240 90 240 110 C240 120 260 130 260 130 C260 130 280 120 280 110 C280 90 270 90 260 100 Z" fill="#dc2626"/>
                    {/* star */}
                    <polygon points="350,80 358,98 378,100 363,114 367,134 350,124 333,134 337,114 322,100 342,98" fill="#fbbf24"/>
                    {/* spiral */}
                    <path d="M450 100 a3 3 0 1 1 5 5 a8 8 0 1 1 -10 -5 a13 13 0 1 1 18 10 a18 18 0 1 1 -25 -15"/>
                    {/* lightning */}
                    <path d="M530 70 L520 100 L540 100 L530 130 L555 95 L540 95 L555 65 Z" fill="#fbbf24"/>
                    {/* cloud */}
                    <path d="M620 110 a15 15 0 0 1 30 0 a15 15 0 0 1 30 0 a15 15 0 0 1 0 25 l-60 0 a15 15 0 0 1 0 -25" fill="#fff"/>
                    {/* dots */}
                    <circle cx="100" cy="50" r="3" fill="#1c1917"/>
                    <circle cx="200" cy="160" r="3" fill="#1c1917"/>
                    <circle cx="300" cy="50" r="3" fill="#1c1917"/>
                    <circle cx="400" cy="160" r="3" fill="#1c1917"/>
                    <circle cx="500" cy="160" r="3" fill="#1c1917"/>
                    <circle cx="700" cy="50" r="3" fill="#1c1917"/>
                </g>
            </SVG>
        ),
    },
    // 73. Sci-fi grid horizon
    {
        id: 'scifi-grid',
        render: () => (
            <SVG bg="#020617">
                <defs>
                    <linearGradient id="sf-sky" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#020617"/>
                        <stop offset="50%" stopColor="#1e1b4b"/>
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.5"/>
                    </linearGradient>
                </defs>
                <rect width="800" height="100" fill="url(#sf-sky)"/>
                {/* horizon line glow */}
                <line x1="0" y1="100" x2="800" y2="100" stroke="#22d3ee" strokeWidth="2"/>
                <line x1="0" y1="100" x2="800" y2="100" stroke="#22d3ee" strokeWidth="6" opacity="0.3"/>
                {/* perspective grid */}
                {Array.from({length: 20}).map((_, i) => {
                    const t = i / 20
                    const y = 100 + Math.pow(t, 1.5) * 100
                    return <line key={`h${i}`} x1="0" y1={y} x2="800" y2={y} stroke="#22d3ee" strokeWidth="0.6" opacity={0.6 - t*0.4}/>
                })}
                {Array.from({length: 21}).map((_, i) => {
                    const startX = i * 40
                    const dx = (startX - 400) * 5
                    const endX = 400 + dx
                    return <line key={`v${i}`} x1={startX} y1="100" x2={endX} y2="200" stroke="#22d3ee" strokeWidth="0.5" opacity="0.4"/>
                })}
                {/* central sun */}
                <circle cx="400" cy="100" r="35" fill="#fbbf24" opacity="0.9"/>
                <rect x="365" y="85" width="70" height="2" fill="#020617"/>
                <rect x="365" y="92" width="70" height="2" fill="#020617"/>
                <rect x="365" y="99" width="70" height="2" fill="#020617"/>
            </SVG>
        ),
    },
    // 74. Newspaper print
    {
        id: 'newspaper',
        render: () => (
            <SVG bg="#fef3c7">
                <text x="400" y="40" fontSize="32" fontWeight="bold" textAnchor="middle" fontFamily="serif" fill="#0c0a09">★ THE TIMES ★</text>
                <line x1="40" y1="55" x2="760" y2="55" stroke="#0c0a09" strokeWidth="1.5"/>
                <line x1="40" y1="60" x2="760" y2="60" stroke="#0c0a09" strokeWidth="0.8"/>
                {/* columns of squiggle text */}
                {[60, 220, 380, 540, 700].map((x, ci) => (
                    <g key={ci} stroke="#0c0a09" strokeWidth="1" fill="none">
                        {Array.from({length: 12}).map((_, i) => (
                            <line key={i} x1={x} y1={75 + i*10} x2={x + 130 - (i%3)*20} y2={75 + i*10}/>
                        ))}
                    </g>
                ))}
                <rect x="60" y="75" width="130" height="20" fill="#0c0a09"/>
                <rect x="540" y="120" width="130" height="20" fill="#0c0a09"/>
            </SVG>
        ),
    },
    // 75. Cosmic egg / mitosis
    {
        id: 'cosmic-egg',
        render: () => (
            <SVG bg="#0a0e27">
                <defs>
                    <radialGradient id="ce1"><stop offset="0%" stopColor="#fef3c7"/><stop offset="40%" stopColor="#a855f7"/><stop offset="100%" stopColor="#a855f7" stopOpacity="0"/></radialGradient>
                    <radialGradient id="ce2"><stop offset="0%" stopColor="#22d3ee"/><stop offset="100%" stopColor="#0c4a6e" stopOpacity="0"/></radialGradient>
                </defs>
                <ellipse cx="280" cy="100" rx="80" ry="90" fill="url(#ce1)"/>
                <ellipse cx="520" cy="100" rx="80" ry="90" fill="url(#ce2)"/>
                <ellipse cx="280" cy="100" rx="80" ry="90" fill="none" stroke="#fff" strokeWidth="0.5" opacity="0.5"/>
                <ellipse cx="520" cy="100" rx="80" ry="90" fill="none" stroke="#fff" strokeWidth="0.5" opacity="0.5"/>
                {/* core */}
                <circle cx="280" cy="100" r="5" fill="#fef3c7"/>
                <circle cx="520" cy="100" r="5" fill="#67e8f9"/>
                {/* connection */}
                <ellipse cx="400" cy="100" rx="60" ry="15" fill="none" stroke="#fff" strokeWidth="0.5" opacity="0.4" strokeDasharray="2 3"/>
                {/* stars */}
                {Array.from({length: 30}).map((_, i) => (
                    <circle key={i} cx={(i*53)%800} cy={(i*43)%200} r="0.6" fill="#fff" opacity={0.3 + (i%3)*0.2}/>
                ))}
            </SVG>
        ),
    },
    // 76. Beach paradise
    {
        id: 'beach',
        render: () => (
            <SVG bg="#7dd3fc">
                <defs>
                    <linearGradient id="bc-sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#bae6fd"/><stop offset="100%" stopColor="#fef3c7"/></linearGradient>
                    <linearGradient id="bc-water" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#0ea5e9"/><stop offset="100%" stopColor="#0c4a6e"/></linearGradient>
                </defs>
                <rect width="800" height="100" fill="url(#bc-sky)"/>
                <circle cx="600" cy="60" r="30" fill="#fde047"/>
                <rect x="0" y="100" width="800" height="60" fill="url(#bc-water)"/>
                {/* waves */}
                <path d="M0 110 Q100 105 200 110 T400 110 T600 110 T800 110" fill="none" stroke="#fff" strokeWidth="1" opacity="0.6"/>
                <path d="M0 130 Q100 125 200 130 T400 130 T600 130 T800 130" fill="none" stroke="#fff" strokeWidth="1" opacity="0.4"/>
                <rect x="0" y="160" width="800" height="40" fill="#fde68a"/>
                {/* palm tree */}
                <path d="M150 200 Q160 130 170 100" stroke="#7c2d12" strokeWidth="6" fill="none" strokeLinecap="round"/>
                <g stroke="#15803d" strokeWidth="3" fill="none" strokeLinecap="round">
                    <path d="M170 100 Q140 80 110 90"/>
                    <path d="M170 100 Q200 80 230 90"/>
                    <path d="M170 100 Q150 75 130 65"/>
                    <path d="M170 100 Q190 75 210 65"/>
                </g>
                {/* shells */}
                <circle cx="350" cy="180" r="3" fill="#fda4af"/>
                <circle cx="450" cy="190" r="3" fill="#fff"/>
                <circle cx="550" cy="180" r="3" fill="#fbbf24"/>
            </SVG>
        ),
    },
    // 77. Northern lights
    {
        id: 'northern-lights',
        render: () => (
            <SVG bg="#020617">
                <defs>
                    <filter id="nl"><feGaussianBlur stdDeviation="15"/></filter>
                </defs>
                <g filter="url(#nl)" opacity="0.7">
                    <path d="M0 80 Q150 20 300 60 Q450 100 600 50 Q750 30 800 60 L800 130 Q650 150 500 110 Q300 80 150 130 Q50 150 0 130 Z" fill="#10b981"/>
                    <path d="M0 100 Q150 50 300 90 Q450 130 600 80 Q750 60 800 90 L800 140 Q650 160 500 130 Q300 100 150 150 Q50 170 0 150 Z" fill="#22d3ee" opacity="0.7"/>
                    <path d="M0 120 Q200 80 400 110 Q600 130 800 100 L800 170 Q600 180 400 160 Q200 140 0 170 Z" fill="#a855f7" opacity="0.5"/>
                </g>
                {/* mountains silhouette */}
                <polygon points="0,200 100,160 220,180 350,150 480,170 620,140 750,180 800,160 800,200" fill="#0c0a09"/>
                {/* stars */}
                {Array.from({length: 30}).map((_, i) => (
                    <circle key={i} cx={(i*53)%800} cy={(i*23)%80} r="0.7" fill="#fff" opacity={0.4 + (i%3)*0.2}/>
                ))}
            </SVG>
        ),
    },
    // 78. Tropical leaves
    {
        id: 'tropical-leaves',
        render: () => (
            <SVG bg="#052e16">
                <g stroke="#86efac" strokeWidth="0.6" fill="#15803d" opacity="0.85">
                    <g transform="translate(100, 100) rotate(20)">
                        <path d="M0 0 Q-15 -40 0 -80 Q15 -40 0 0 Z"/>
                        <line x1="0" y1="0" x2="0" y2="-80"/>
                        {Array.from({length: 8}).map((_, i) => <line key={i} x1="0" y1={-10 - i*10} x2={i%2 ? 8 : -8} y2={-15 - i*10}/>)}
                    </g>
                    <g transform="translate(250, 80) rotate(-30)">
                        <path d="M0 0 Q-15 -40 0 -80 Q15 -40 0 0 Z" fill="#16a34a"/>
                        <line x1="0" y1="0" x2="0" y2="-80"/>
                        {Array.from({length: 8}).map((_, i) => <line key={i} x1="0" y1={-10 - i*10} x2={i%2 ? 8 : -8} y2={-15 - i*10}/>)}
                    </g>
                    <g transform="translate(400, 120) rotate(10)">
                        <path d="M0 0 Q-15 -40 0 -80 Q15 -40 0 0 Z"/>
                        <line x1="0" y1="0" x2="0" y2="-80"/>
                        {Array.from({length: 8}).map((_, i) => <line key={i} x1="0" y1={-10 - i*10} x2={i%2 ? 8 : -8} y2={-15 - i*10}/>)}
                    </g>
                    <g transform="translate(550, 70) rotate(-20)">
                        <path d="M0 0 Q-15 -40 0 -80 Q15 -40 0 0 Z" fill="#16a34a"/>
                        <line x1="0" y1="0" x2="0" y2="-80"/>
                        {Array.from({length: 8}).map((_, i) => <line key={i} x1="0" y1={-10 - i*10} x2={i%2 ? 8 : -8} y2={-15 - i*10}/>)}
                    </g>
                    <g transform="translate(700, 110) rotate(25)">
                        <path d="M0 0 Q-15 -40 0 -80 Q15 -40 0 0 Z"/>
                        <line x1="0" y1="0" x2="0" y2="-80"/>
                        {Array.from({length: 8}).map((_, i) => <line key={i} x1="0" y1={-10 - i*10} x2={i%2 ? 8 : -8} y2={-15 - i*10}/>)}
                    </g>
                </g>
                {/* monstera holes */}
                <g fill="#052e16">
                    <ellipse cx="100" cy="60" rx="2" ry="6"/>
                    <ellipse cx="250" cy="40" rx="2" ry="6"/>
                    <ellipse cx="400" cy="80" rx="2" ry="6"/>
                </g>
            </SVG>
        ),
    },
    // 79. Fishing net
    {
        id: 'fishing-net',
        render: () => (
            <SVG bg="#0c4a6e">
                <g stroke="#7dd3fc" strokeWidth="0.6" fill="none" opacity="0.5">
                    {Array.from({length: 17}).map((_, i) => (
                        <path key={`a${i}`} d={`M${i*50 - 50} 0 Q${i*50} 100 ${i*50 - 50} 200`}/>
                    ))}
                    {Array.from({length: 17}).map((_, i) => (
                        <path key={`b${i}`} d={`M${i*50 - 50} 0 Q${i*50 - 100} 100 ${i*50 - 50} 200`}/>
                    ))}
                </g>
                {/* fish */}
                <g fill="#fbbf24" opacity="0.9">
                    <path d="M200 80 q-5 -8 0 -16 q15 0 25 8 q-10 8 -25 8 z"/>
                    <path d="M195 80 l-8 -3 l-8 3 l8 3 z"/>
                </g>
                <g fill="#fb923c" opacity="0.9">
                    <path d="M500 130 q-5 -8 0 -16 q15 0 25 8 q-10 8 -25 8 z"/>
                    <path d="M495 130 l-8 -3 l-8 3 l8 3 z"/>
                </g>
                {/* bubbles */}
                {[[100,150],[300,170],[600,40],[700,170]].map(([x,y], i) => (
                    <circle key={i} cx={x} cy={y} r="2" fill="#bae6fd" opacity="0.6"/>
                ))}
            </SVG>
        ),
    },
    // 80. Marble paper — ebru
    {
        id: 'marble-paper',
        render: () => (
            <SVG bg="#fef3c7">
                <defs>
                    <filter id="mp"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3"/><feDisplacementMap in="SourceGraphic" scale="50"/></filter>
                </defs>
                <g filter="url(#mp)">
                    <path d="M0 50 Q200 10 400 50 T800 50 L800 90 Q600 50 400 90 T0 90 Z" fill="#dc2626" opacity="0.7"/>
                    <path d="M0 100 Q200 60 400 100 T800 100 L800 140 Q600 100 400 140 T0 140 Z" fill="#1e3a8a" opacity="0.7"/>
                    <path d="M0 150 Q200 110 400 150 T800 150 L800 200 Q600 160 400 200 T0 200 Z" fill="#15803d" opacity="0.7"/>
                </g>
                <g fill="none" stroke="#fbbf24" strokeWidth="0.4" opacity="0.6">
                    <path d="M0 70 Q200 30 400 70 T800 70"/>
                    <path d="M0 120 Q200 80 400 120 T800 120"/>
                    <path d="M0 170 Q200 130 400 170 T800 170"/>
                </g>
            </SVG>
        ),
    },
    // 81. Vintage stamps grid
    {
        id: 'vintage-stamps',
        render: () => (
            <SVG bg="#fef3c7">
                {[[60,40],[230,40],[400,40],[570,40],[60,130],[230,130],[400,130],[570,130]].map(([x,y], i) => {
                    const colors = ['#dc2626','#1e3a8a','#15803d','#7c2d12','#a16207','#581c87','#0c4a6e','#9f1239']
                    return (
                        <g key={i} transform={`translate(${x}, ${y}) rotate(${(i*7) - 14})`}>
                            <rect x="0" y="0" width="170" height="60" fill={colors[i]} stroke="#0c0a09" strokeWidth="1"/>
                            <rect x="5" y="5" width="160" height="50" fill="none" stroke="#fef3c7" strokeWidth="1" strokeDasharray="2 2"/>
                            <text x="85" y="25" fontSize="10" fill="#fef3c7" textAnchor="middle" fontFamily="serif" fontWeight="bold">PRO</text>
                            <text x="85" y="40" fontSize="14" fill="#fef3c7" textAnchor="middle" fontFamily="serif" fontWeight="bold">★ COLLAB ★</text>
                            <text x="85" y="52" fontSize="7" fill="#fef3c7" textAnchor="middle" fontFamily="serif">2026</text>
                        </g>
                    )
                })}
            </SVG>
        ),
    },
    // 82. Bioluminescent
    {
        id: 'bioluminescent',
        render: () => (
            <SVG bg="#020617">
                <defs>
                    <filter id="bl"><feGaussianBlur stdDeviation="3"/></filter>
                </defs>
                {/* jellyfish 1 */}
                <g transform="translate(150, 100)">
                    <ellipse cx="0" cy="0" rx="30" ry="22" fill="#22d3ee" opacity="0.4" filter="url(#bl)"/>
                    <ellipse cx="0" cy="-2" rx="25" ry="18" fill="none" stroke="#67e8f9" strokeWidth="1"/>
                    <g stroke="#67e8f9" strokeWidth="0.8" fill="none" opacity="0.7">
                        <path d="M-15 15 Q-18 30 -12 50"/>
                        <path d="M-5 18 Q-2 35 -8 60"/>
                        <path d="M5 18 Q2 35 8 60"/>
                        <path d="M15 15 Q18 30 12 50"/>
                    </g>
                </g>
                {/* jellyfish 2 */}
                <g transform="translate(450, 60)">
                    <ellipse cx="0" cy="0" rx="36" ry="26" fill="#a855f7" opacity="0.4" filter="url(#bl)"/>
                    <ellipse cx="0" cy="-2" rx="30" ry="22" fill="none" stroke="#c084fc" strokeWidth="1"/>
                    <g stroke="#c084fc" strokeWidth="0.8" fill="none" opacity="0.7">
                        <path d="M-20 18 Q-23 40 -18 70"/>
                        <path d="M-8 22 Q-5 45 -12 80"/>
                        <path d="M8 22 Q5 45 12 80"/>
                        <path d="M20 18 Q23 40 18 70"/>
                    </g>
                </g>
                {/* jellyfish 3 */}
                <g transform="translate(680, 130)">
                    <ellipse cx="0" cy="0" rx="25" ry="18" fill="#ec4899" opacity="0.4" filter="url(#bl)"/>
                    <ellipse cx="0" cy="-2" rx="20" ry="14" fill="none" stroke="#f9a8d4" strokeWidth="1"/>
                    <g stroke="#f9a8d4" strokeWidth="0.8" fill="none" opacity="0.7">
                        <path d="M-12 12 Q-15 25 -10 40"/>
                        <path d="M0 14 Q3 30 -3 50"/>
                        <path d="M12 12 Q15 25 10 40"/>
                    </g>
                </g>
                {/* tiny bubbles */}
                {Array.from({length: 25}).map((_, i) => (
                    <circle key={i} cx={(i*43)%800} cy={(i*17)%200} r="1" fill="#67e8f9" opacity={0.3 + (i%3)*0.2}/>
                ))}
            </SVG>
        ),
    },
    // 83. Nordic runes — viking
    {
        id: 'nordic-runes',
        render: () => (
            <SVG bg="#1c1917">
                <g stroke="#a8a29e" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.9">
                    {/* Various runic-like symbols */}
                    <g transform="translate(80, 100)"><line x1="-15" y1="-25" x2="-15" y2="25"/><line x1="-15" y1="-25" x2="15" y2="0"/><line x1="-15" y1="25" x2="15" y2="0"/></g>
                    <g transform="translate(170, 100)"><line x1="0" y1="-25" x2="0" y2="25"/><line x1="0" y1="-25" x2="20" y2="-15"/><line x1="0" y1="0" x2="20" y2="0"/></g>
                    <g transform="translate(260, 100)"><line x1="-15" y1="-25" x2="-15" y2="25"/><line x1="15" y1="-25" x2="15" y2="25"/><line x1="-15" y1="0" x2="15" y2="0"/></g>
                    <g transform="translate(350, 100)"><line x1="-15" y1="-25" x2="0" y2="0"/><line x1="0" y1="0" x2="-15" y2="25"/><line x1="-15" y1="-25" x2="15" y2="-25"/><line x1="-15" y1="25" x2="15" y2="25"/></g>
                    <g transform="translate(440, 100)"><line x1="0" y1="-25" x2="0" y2="25"/><circle cx="0" cy="0" r="10"/></g>
                    <g transform="translate(530, 100)"><line x1="-15" y1="-25" x2="15" y2="25"/><line x1="15" y1="-25" x2="-15" y2="25"/><line x1="0" y1="-30" x2="0" y2="30"/></g>
                    <g transform="translate(620, 100)"><line x1="-15" y1="0" x2="15" y2="0"/><line x1="0" y1="-25" x2="0" y2="25"/><circle cx="0" cy="0" r="5"/></g>
                    <g transform="translate(710, 100)"><line x1="-15" y1="-25" x2="-15" y2="25"/><line x1="-15" y1="-25" x2="15" y2="-25"/><line x1="-15" y1="0" x2="10" y2="0"/></g>
                </g>
                {/* connecting line */}
                <line x1="40" y1="100" x2="760" y2="100" stroke="#78350f" strokeWidth="1" opacity="0.5"/>
                <line x1="40" y1="40" x2="760" y2="40" stroke="#78350f" strokeWidth="0.5" opacity="0.4"/>
                <line x1="40" y1="160" x2="760" y2="160" stroke="#78350f" strokeWidth="0.5" opacity="0.4"/>
            </SVG>
        ),
    },
    // 84. Coffee stains
    {
        id: 'coffee-stains',
        render: () => (
            <SVG bg="#fef3c7">
                <g fill="#7c2d12" opacity="0.6">
                    <ellipse cx="120" cy="80" rx="50" ry="48"/>
                    <ellipse cx="380" cy="120" rx="60" ry="55"/>
                    <ellipse cx="600" cy="60" rx="45" ry="42"/>
                </g>
                <g fill="none" stroke="#7c2d12" strokeWidth="1.5" opacity="0.5">
                    <ellipse cx="120" cy="80" rx="55" ry="52"/>
                    <ellipse cx="380" cy="120" rx="65" ry="60"/>
                    <ellipse cx="600" cy="60" rx="50" ry="47"/>
                </g>
                <g fill="#7c2d12" opacity="0.4">
                    <circle cx="200" cy="50" r="4"/>
                    <circle cx="290" cy="160" r="3"/>
                    <circle cx="500" cy="170" r="5"/>
                    <circle cx="700" cy="140" r="4"/>
                    <circle cx="50" cy="160" r="3"/>
                </g>
                <g stroke="#7c2d12" strokeWidth="1" fill="none" opacity="0.4">
                    <path d="M180 100 Q210 70 240 100"/>
                    <path d="M450 90 Q470 70 490 100"/>
                </g>
            </SVG>
        ),
    },
    // 85. Heatmap
    {
        id: 'heatmap',
        render: () => {
            const cells = []
            for (let y = 0; y < 8; y++) {
                for (let x = 0; x < 32; x++) {
                    const intensity = Math.sin(x * 0.4 + y * 0.6) * 0.5 + 0.5
                    const colors = ['#0c0a09','#1e1b4b','#581c87','#a855f7','#ec4899','#f97316','#fbbf24','#fef3c7']
                    const c = colors[Math.floor(intensity * (colors.length - 1))]
                    cells.push(<rect key={`${x}-${y}`} x={x*25} y={y*25} width="25" height="25" fill={c}/>)
                }
            }
            return <SVG bg="#0c0a09">{cells}</SVG>
        },
    },
    // 86. Origami crane flock
    {
        id: 'crane-flock',
        render: () => (
            <SVG bg="#fef3c7">
                <g fill="#dc2626">
                    <path d="M100 80 l-12 -8 l4 -4 l8 4 l8 -4 l4 4 z"/>
                    <path d="M180 60 l-10 -7 l4 -3 l6 3 l6 -3 l4 3 z"/>
                    <path d="M270 90 l-12 -8 l4 -4 l8 4 l8 -4 l4 4 z" fill="#1e3a8a"/>
                    <path d="M360 50 l-9 -6 l3 -3 l6 3 l6 -3 l3 3 z" fill="#15803d"/>
                    <path d="M440 100 l-12 -8 l4 -4 l8 4 l8 -4 l4 4 z"/>
                    <path d="M530 70 l-10 -7 l4 -3 l6 3 l6 -3 l4 3 z" fill="#7c3aed"/>
                    <path d="M620 90 l-9 -6 l3 -3 l6 3 l6 -3 l3 3 z" fill="#1e3a8a"/>
                    <path d="M710 60 l-12 -8 l4 -4 l8 4 l8 -4 l4 4 z"/>
                </g>
                <g fill="#0c0a09" opacity="0.3">
                    <path d="M150 130 l-7 -5 l3 -2 l4 2 l4 -2 l3 2 z"/>
                    <path d="M340 150 l-7 -5 l3 -2 l4 2 l4 -2 l3 2 z"/>
                    <path d="M580 140 l-7 -5 l3 -2 l4 2 l4 -2 l3 2 z"/>
                </g>
                {/* sun */}
                <circle cx="650" cy="40" r="20" fill="#fbbf24" opacity="0.7"/>
            </SVG>
        ),
    },
    // 87. Hexagon honeycomb metallic
    {
        id: 'honeycomb-metallic',
        render: () => (
            <SVG bg="#0c0a09">
                <defs>
                    <linearGradient id="hm1" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#fbbf24"/>
                        <stop offset="100%" stopColor="#92400e"/>
                    </linearGradient>
                </defs>
                {Array.from({length: 5}).map((_, row) => 
                    Array.from({length: 12}).map((_, col) => {
                        const x = col * 70 + (row%2)*35 - 30
                        const y = row * 50 - 10
                        return (
                            <polygon key={`${row}-${col}`} 
                                points={`${x+30},${y} ${x+60},${y+20} ${x+60},${y+50} ${x+30},${y+70} ${x},${y+50} ${x},${y+20}`}
                                fill={(row+col)%3 === 0 ? "url(#hm1)" : "none"}
                                stroke="#fbbf24" strokeWidth="0.8" opacity="0.5"/>
                        )
                    })
                )}
            </SVG>
        ),
    },
    // 88. Aurora night sky with mountain
    {
        id: 'aurora-mountain',
        render: () => (
            <SVG bg="#020617">
                <defs>
                    <filter id="am-blur"><feGaussianBlur stdDeviation="20"/></filter>
                </defs>
                <g filter="url(#am-blur)">
                    <ellipse cx="200" cy="50" rx="200" ry="40" fill="#10b981" opacity="0.6"/>
                    <ellipse cx="500" cy="40" rx="220" ry="40" fill="#06b6d4" opacity="0.6"/>
                    <ellipse cx="700" cy="50" rx="180" ry="40" fill="#a855f7" opacity="0.6"/>
                </g>
                {/* stars */}
                {Array.from({length: 50}).map((_, i) => (
                    <circle key={i} cx={(i*53)%800} cy={(i*23)%100} r={0.6 + (i%3)*0.4} fill="#fff" opacity={0.4 + (i%4)*0.15}/>
                ))}
                {/* mountains */}
                <polygon points="0,200 100,140 180,170 260,110 340,150 440,90 540,140 640,100 740,150 800,120 800,200" fill="#0c0a09"/>
                <polygon points="0,200 80,170 160,180 240,160 320,180 400,165 480,180 560,170 640,180 720,165 800,180 800,200" fill="#1e293b" opacity="0.7"/>
                {/* reflection on water */}
                <line x1="0" y1="200" x2="800" y2="200" stroke="#22d3ee" strokeWidth="0.5" opacity="0.5"/>
            </SVG>
        ),
    },
    // 89. Espresso art / latte foam
    {
        id: 'latte-art',
        render: () => (
            <SVG bg="#7c2d12">
                <defs>
                    <radialGradient id="la1" cx="0.5" cy="0.5"><stop offset="0%" stopColor="#fef3c7"/><stop offset="100%" stopColor="#fde68a"/></radialGradient>
                </defs>
                <ellipse cx="400" cy="100" rx="180" ry="80" fill="url(#la1)"/>
                <ellipse cx="400" cy="100" rx="170" ry="73" fill="none" stroke="#92400e" strokeWidth="1" opacity="0.5"/>
                {/* leaf rosetta */}
                <g stroke="#92400e" strokeWidth="2" fill="none">
                    <path d="M400 50 Q380 100 400 150"/>
                    <path d="M380 70 Q360 100 380 130 Q400 110 380 70"/>
                    <path d="M420 70 Q440 100 420 130 Q400 110 420 70"/>
                    <path d="M360 80 Q340 100 360 120 Q380 110 360 80"/>
                    <path d="M440 80 Q460 100 440 120 Q420 110 440 80"/>
                    <path d="M340 90 Q325 100 340 110 Q360 105 340 90"/>
                    <path d="M460 90 Q475 100 460 110 Q440 105 460 90"/>
                </g>
                <path d="M400 150 Q395 165 400 180" stroke="#92400e" strokeWidth="2" fill="none"/>
                {/* tiny coffee beans around */}
                <g fill="#451a03">
                    <ellipse cx="100" cy="50" rx="6" ry="9" transform="rotate(20, 100, 50)"/>
                    <line x1="98" y1="44" x2="98" y2="56" stroke="#1c1917" strokeWidth="0.6"/>
                    <ellipse cx="700" cy="160" rx="6" ry="9" transform="rotate(-30, 700, 160)"/>
                    <line x1="700" y1="153" x2="700" y2="167" stroke="#1c1917" strokeWidth="0.6"/>
                </g>
            </SVG>
        ),
    },
    // 90. Glitch art — RGB shift
    {
        id: 'glitch-rgb',
        render: () => (
            <SVG bg="#0a0a0a">
                <defs>
                    <pattern id="gl-lines" x="0" y="0" width="2" height="3" patternUnits="userSpaceOnUse">
                        <rect width="2" height="1.5" fill="#fff" opacity="0.05"/>
                    </pattern>
                </defs>
                <text x="402" y="125" fontSize="80" fontFamily="monospace" fontWeight="bold" fill="#dc2626" opacity="0.8" textAnchor="middle">CODE</text>
                <text x="398" y="125" fontSize="80" fontFamily="monospace" fontWeight="bold" fill="#22d3ee" opacity="0.8" textAnchor="middle">CODE</text>
                <text x="400" y="125" fontSize="80" fontFamily="monospace" fontWeight="bold" fill="#fff" textAnchor="middle">CODE</text>
                {/* glitch bars */}
                <rect x="0" y="60" width="800" height="3" fill="#22d3ee" opacity="0.6"/>
                <rect x="0" y="100" width="800" height="2" fill="#dc2626" opacity="0.6"/>
                <rect x="0" y="140" width="800" height="3" fill="#fff" opacity="0.4"/>
                <rect x="0" y="160" width="800" height="2" fill="#22d3ee" opacity="0.4"/>
                <rect width="800" height="200" fill="url(#gl-lines)"/>
                {/* corruption blocks */}
                <rect x="50" y="80" width="60" height="20" fill="#dc2626" opacity="0.4"/>
                <rect x="650" y="120" width="80" height="15" fill="#22d3ee" opacity="0.5"/>
                <rect x="200" y="140" width="40" height="10" fill="#fff" opacity="0.3"/>
            </SVG>
        ),
    },
]

export const DEFAULT_BANNER = BANNER_PRESETS[0]
