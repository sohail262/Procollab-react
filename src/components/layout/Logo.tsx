import React from 'react'

interface LogoProps {
    className?: string
    iconSize?: number
    showText?: boolean
    textColor?: string
}

export function Logo({ className = '', iconSize = 64, showText = true, textColor = 'text-white/90' }: LogoProps) {
    return (
        <div className={`flex items-center gap-2.5 select-none ${className}`}>
            {/* Monogram Icon Container */}
            <div
                className="overflow-hidden relative flex-shrink-0 flex items-center justify-center"
                style={{ width: iconSize, height: iconSize }}
            >
                <picture>
                    <source srcSet="/images/logo_pc.webp" type="image/webp" />
                    <img
                        src="/images/logo_pc.png"
                        alt="ProCollab Logo"
                        width={iconSize}
                        height={iconSize}
                        decoding="async"
                        fetchPriority="high"
                        className="w-full h-full object-contain scale-[1.35] mix-blend-screen"
                    />
                </picture>
            </div>
            {showText && (
                <span className={`font-display font-normal tracking-[0.2em] text-[11px] uppercase ${textColor}`}>
                    ProCollab
                </span>
            )}
        </div>
    )
}
