import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StreakMetrics, ActivityDay } from '@/services/activityService'
import { Download, Copy, Check, Instagram, Sparkles, Edit3, Linkedin, ExternalLink, Link2, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { storage } from '@/lib/firebase'
import { ref, uploadBytes, deleteObject } from 'firebase/storage'

interface ShareFlexModalProps {
    isOpen: boolean
    onClose: () => void
    metrics: StreakMetrics
    activityData: Record<string, ActivityDay>
    userName?: string
    userHandle?: string
    userPhoto?: string
}

type CardFormat = 'story' | 'linkedin'

export const ShareFlexModal: React.FC<ShareFlexModalProps> = ({
    isOpen,
    onClose,
    metrics,
    activityData,
    userName = 'Student Builder',
    userHandle = '@procollab_builder',
    userPhoto,
}) => {
    const { toast } = useToast()
    const [cardFormat, setCardFormat] = useState<CardFormat>('story')
    const [customCaption, setCustomCaption] = useState<string>('')
    const [selectedCaption, setSelectedCaption] = useState<number>(0)
    const [copiedCaption, setCopiedCaption] = useState(false)
    const [copiedLink, setCopiedLink] = useState(false)
    const [isDownloading, setIsDownloading] = useState(false)

    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const avatarImgRef = useRef<HTMLImageElement | null>(null)
    const [avatarReady, setAvatarReady] = useState(false)

    const cleanHandle = (userHandle || '').replace(/^@/, '').trim() || (userName || '').toLowerCase().replace(/\s+/g, '')
    const profileUrl = `https://procollab.in/u/${cleanHandle}`
    const firstName = userName.split(' ')[0] || userName

    const linkedInCaptions = [
        `🚀 Building in public on Procollab!\n\nI'm tracking every project contribution, team collaboration, and milestone on Procollab.\n\n🔥 ${metrics.currentStreak}-day active streak | 📈 ${metrics.consistencyRate}% consistency | ⚡ ${metrics.totalContributions} total actions logged.\n\nCheck out my profile and proof of work 👇\n${profileUrl}\n\n#ProofOfWork #Procollab #StudentBuilder #BuildInPublic #OpenToWork`,
        `🧠 Consistency > Motivation.\n\nNo shortcuts — just showing up every day and building real projects with real teams on Procollab.\n\n🔥 ${metrics.currentStreak} Days Streak | ⚡ ${metrics.longestStreak} Days Best Streak | 🎯 ${metrics.consistencyRate}% Consistency Rate\n\nFind me on Procollab 👇\n${profileUrl}\n\n#Procollab #StudentDeveloper #SoftwareEngineering #BuildInPublic`,
        `📊 Proof of Work > Traditional Resume.\n\nTracked my daily contributions and collaborative project work on Procollab.\n\n• 🔥 Current streak: ${metrics.currentStreak} days\n• 📅 Consistency rate: ${metrics.consistencyRate}%\n• 🏗️ Total contributions: ${metrics.totalContributions}\n\nView my live profile 👇\n${profileUrl}\n\n#BuiltInPublic #ProcollabBuilder #ProofOfWork #StudentDeveloper`,
    ]

    const activeCaption = customCaption.trim() || linkedInCaptions[selectedCaption]

    // Preload user avatar photo as a SAME-ORIGIN Blob Object URL to PREVENT CANVAS TAINTING 100%
    useEffect(() => {
        if (!isOpen) return
        let mounted = true
        let activeBlobUrl: string | null = null

        async function loadSameOriginAvatar() {
            const rawSrc = userPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userName)}`

            // Try 1: Direct CORS fetch -> Blob -> createObjectURL
            try {
                const res = await fetch(rawSrc, { mode: 'cors' })
                if (res.ok) {
                    const blob = await res.blob()
                    activeBlobUrl = URL.createObjectURL(blob)
                    const img = new Image()
                    img.src = activeBlobUrl
                    img.onload = () => {
                        if (mounted) {
                            avatarImgRef.current = img
                            setAvatarReady(true)
                        }
                    }
                    return
                }
            } catch {
                /* CORS blocked */
            }

            // Try 2: Fetch via CORS Proxy (images.weserv.nl) -> Blob -> createObjectURL
            if (userPhoto) {
                try {
                    const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(userPhoto)}&output=png`
                    const res = await fetch(proxyUrl)
                    if (res.ok) {
                        const blob = await res.blob()
                        activeBlobUrl = URL.createObjectURL(blob)
                        const img = new Image()
                        img.src = activeBlobUrl
                        img.onload = () => {
                            if (mounted) {
                                avatarImgRef.current = img
                                setAvatarReady(true)
                            }
                        }
                        return
                    }
                } catch {
                    /* Proxy failed */
                }
            }

            // Try 3: Direct image fallback
            const img = new Image()
            img.src = rawSrc
            img.onload = () => {
                if (mounted) {
                    avatarImgRef.current = img
                    setAvatarReady(true)
                }
            }
        }

        loadSameOriginAvatar()
        return () => {
            mounted = false
            if (activeBlobUrl) URL.revokeObjectURL(activeBlobUrl)
        }
    }, [isOpen, userPhoto, userName])

    // Draw Minimal Professional Dark Theme Canvas Graphic
    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const isStory = cardFormat === 'story'
        canvas.width = isStory ? 720 : 1080
        canvas.height = isStory ? 1280 : 600
        const W = canvas.width, H = canvas.height

        const activeQ = customCaption.trim()
            ? `"${customCaption.trim()}"`
            : `"${firstName} was consistent. He's the one who showed up 💪"`

        // ── 1. Minimal Professional Dark Slate Background ───────────────
        const bg = ctx.createLinearGradient(0, 0, W, H)
        bg.addColorStop(0, '#090c15')
        bg.addColorStop(0.5, '#0f172a')
        bg.addColorStop(1, '#080b12')
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

        // Fine grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)'; ctx.lineWidth = 1
        for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }

        // Clean subtle border
        ctx.strokeStyle = 'rgba(51, 65, 85, 0.7)'; ctx.lineWidth = isStory ? 4 : 3
        ctx.beginPath(); ctx.roundRect(12, 12, W - 24, H - 24, 22); ctx.stroke()

        // ── Helper Drawing Functions ────────────────────────────────────
        const drawAvatar = (cx: number, cy: number, r: number) => {
            ctx.save()
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip()
            if (avatarImgRef.current) {
                ctx.drawImage(avatarImgRef.current, cx - r, cy - r, r * 2, r * 2)
            } else {
                ctx.fillStyle = '#1e293b'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
                ctx.fillStyle = '#ffffff'; ctx.font = `bold ${Math.round(r * 0.9)}px system-ui`
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
                ctx.fillText(firstName[0] || 'S', cx, cy)
                ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
            }
            ctx.restore()

            // Clean Slate Neutral Border
            ctx.strokeStyle = '#475569'; ctx.lineWidth = 2.5
            ctx.beginPath(); ctx.arc(cx, cy, r + 2, 0, Math.PI * 2); ctx.stroke()
        }

        const drawFlameStreak = (x: number, y: number, streakNum: number, size: number, fontPx: number) => {
            const r = size / 2
            const cx = x + r, cy = y + r
            const bgG = ctx.createLinearGradient(x, y, x + size, y + size)
            bgG.addColorStop(0, '#ea580c'); bgG.addColorStop(1, '#c2410c')
            ctx.fillStyle = bgG; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()

            ctx.fillStyle = '#ffffff'
            ctx.font = `${Math.round(size * 0.55)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
            ctx.fillText('🔥', cx, cy + 2)

            ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
            ctx.fillStyle = '#ffffff'
            ctx.font = `900 ${fontPx}px system-ui, -apple-system, sans-serif`
            const numX = x + size + 16
            const numY = y + size - 4
            ctx.fillText(`${streakNum}`, numX, numY)
            return numX + ctx.measureText(`${streakNum}`).width
        }

        const wrapText = (txt: string, x: number, y: number, maxW: number, lh: number) => {
            const words = txt.replace(/^["""]+|["""]+$/g, '').split(' ')
            let line = '', ly = y
            for (const w of words) {
                const t = line + w + ' '
                if (ctx.measureText(t).width > maxW && line) {
                    ctx.fillText(line.trimEnd(), x, ly)
                    line = w + ' '
                    ly += lh
                } else line = t
            }
            ctx.fillText(line.trimEnd(), x, ly)
        }

        const lvlColors = ['#1e293b', '#064e3b', '#0d9488', '#14b8a6', '#2dd4bf']

        if (isStory) {
            // ════════════════════════════════════════════════════════════
            //  9:16 INSTAGRAM STORY (720 × 1280) — Minimal Professional Dark
            // ════════════════════════════════════════════════════════════
            const p = 48

            // Top Header
            ctx.fillStyle = '#ffffff'; ctx.font = '900 26px system-ui'
            ctx.fillText('PROCOLLAB', p, 76)
            ctx.fillStyle = '#94a3b8'; ctx.font = '600 12px system-ui'
            ctx.fillText('PROOF OF WORK & STREAK', p, 96)

            ctx.fillStyle = 'rgba(16,185,129,0.15)'; ctx.strokeStyle = 'rgba(16,185,129,0.4)'; ctx.lineWidth = 1.5
            ctx.beginPath(); ctx.roundRect(W - 200, 60, 152, 34, 17); ctx.fill(); ctx.stroke()
            ctx.fillStyle = '#34d399'; ctx.font = 'bold 12px system-ui'
            ctx.fillText('✓ Verified Builder', W - 182, 82)

            // User Profile Header
            const avR = 48, avCX = p + 16 + avR, avCY = 168
            drawAvatar(avCX, avCY, avR)

            const nX = avCX + avR + 20
            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 30px system-ui'
            ctx.fillText(userName, nX, avCY - 6)
            ctx.fillStyle = '#9ca3af'; ctx.font = '15px system-ui'
            ctx.fillText(`${userHandle} • Procollab Builder`, nX, avCY + 20)

            // Hero Streak Card
            const hY = 245, hW = W - p * 2, hH = 175
            ctx.fillStyle = '#0f172a'; ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)'; ctx.lineWidth = 1.5
            ctx.beginPath(); ctx.roundRect(p, hY, hW, hH, 20); ctx.fill(); ctx.stroke()

            const nextX = drawFlameStreak(p + 30, hY + 30, metrics.currentStreak, 64, 84)
            ctx.fillStyle = '#cbd5e1'; ctx.font = 'bold 20px system-ui'
            ctx.fillText('DAYS STREAK', nextX + 16, hY + 68)
            ctx.fillStyle = '#94a3b8'; ctx.font = '13px system-ui'
            ctx.fillText('Active Consistency on Procollab', nextX + 16, hY + 92)

            ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)'; ctx.lineWidth = 1
            ctx.beginPath(); ctx.moveTo(p + 30, hY + 122); ctx.lineTo(p + hW - 30, hY + 122); ctx.stroke()

            ctx.fillStyle = '#34d399'; ctx.font = '600 13px system-ui'
            ctx.fillText('⚡ Top 5% Most Consistent Student Builders', p + 30, hY + 150)

            // 3 Bento Stat Cards
            const sY = hY + hH + 20, sW = (hW - 20) / 3, sH = 105
            const sV = [`${metrics.longestStreak}d`, `${metrics.consistencyRate}%`, `${metrics.totalContributions}`]
            const sL = ['Best Streak', 'Consistency', 'Total Actions']

            sV.forEach((v, i) => {
                const sx = p + i * (sW + 10)
                ctx.fillStyle = '#0f172a'; ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)'; ctx.lineWidth = 1.5
                ctx.beginPath(); ctx.roundRect(sx, sY, sW, sH, 16); ctx.fill(); ctx.stroke()
                ctx.fillStyle = '#ffffff'; ctx.font = 'bold 30px system-ui'
                ctx.fillText(v, sx + 16, sY + 62)
                ctx.font = '12px system-ui'; ctx.fillStyle = '#94a3b8'
                ctx.fillText(sL[i], sx + 16, sY + 84)
            })

            // Activity Heatmap Section Card (Expanded 350px height)
            const gY = sY + sH + 20, cardHeatH = 350
            ctx.fillStyle = '#0f172a'; ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)'; ctx.lineWidth = 1.5
            ctx.beginPath(); ctx.roundRect(p, gY, hW, cardHeatH, 20); ctx.fill(); ctx.stroke()

            ctx.font = 'bold 18px system-ui'; ctx.fillStyle = '#ffffff'
            ctx.fillText('Activity Calendar', p + 24, gY + 38)
            ctx.font = '12px system-ui'; ctx.fillStyle = '#94a3b8'
            ctx.fillText('365 Days of Project Activity', p + 24, gY + 58)

            const cS = 17, cG = 5, cSt = cS + cG
            const gCols = Math.floor((hW - 48) / cSt)
            const gridStartY = gY + 76
            const srt = Object.keys(activityData).sort().slice(-gCols * 7)
            let gc = 0, gr = 0
            srt.forEach(k => {
                ctx.fillStyle = lvlColors[Math.min(activityData[k].level, 4)]
                ctx.beginPath(); ctx.roundRect(p + 24 + gc * cSt, gridStartY + gr * cSt, cS, cS, 4); ctx.fill()
                gr++; if (gr === 7) { gr = 0; gc++ }
            })

            const legY = gridStartY + 7 * cSt + 22
            ctx.font = '11px system-ui'; ctx.fillStyle = '#94a3b8'
            ctx.fillText('Less', p + 24, legY + 10)
            lvlColors.forEach((c, i) => {
                ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(p + 60 + i * 20, legY, 13, 13, 3); ctx.fill()
            })
            ctx.fillStyle = '#94a3b8'
            ctx.fillText('More', p + 66 + lvlColors.length * 20, legY + 10)
            ctx.textAlign = 'right'
            ctx.fillText(`Total Actions: ${metrics.totalContributions}`, p + hW - 24, legY + 10)
            ctx.textAlign = 'left'

            // Quote Card (Compact 180px Height - No Empty Void!)
            const qY = gY + cardHeatH + 20, qH = 180
            ctx.fillStyle = '#0f172a'; ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)'; ctx.lineWidth = 1.5
            ctx.beginPath(); ctx.roundRect(p, qY, hW, qH, 20); ctx.fill(); ctx.stroke()

            ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'; ctx.beginPath(); ctx.roundRect(p + 24, qY + 18, 110, 24, 12); ctx.fill()
            ctx.fillStyle = '#cbd5e1'; ctx.font = 'bold 11px system-ui'
            ctx.fillText('“ FLEX QUOTE', p + 36, qY + 34)

            ctx.fillStyle = '#f8fafc'; ctx.font = 'italic 600 20px system-ui'
            wrapText(activeQ, p + 24, qY + 74, hW - 48, 30)

            ctx.fillStyle = '#94a3b8'; ctx.font = '12px system-ui'
            ctx.fillText('✓ Verified Proof of Work on Procollab Platform', p + 24, qY + qH - 20)

            // Footer Bar
            ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)'; ctx.lineWidth = 1
            ctx.beginPath(); ctx.moveTo(p, H - 56); ctx.lineTo(W - p, H - 56); ctx.stroke()
            ctx.font = 'bold 15px system-ui'; ctx.fillStyle = '#94a3b8'
            ctx.fillText(`procollab.in/u/${cleanHandle}`, p, H - 28)
            ctx.font = '13px system-ui'; ctx.fillStyle = '#64748b'
            ctx.textAlign = 'right'; ctx.fillText('BUILD & COLLABORATE 🔥', W - p, H - 28); ctx.textAlign = 'left'

        } else {
            // ════════════════════════════════════════════════════════════
            //  16:9 LINKEDIN POST (1080 × 600) — Minimal Professional Dark
            // ════════════════════════════════════════════════════════════
            const p = 36
            const lW = 430   // Left panel width

            // Left Panel Container
            ctx.fillStyle = '#0f172a'; ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)'; ctx.lineWidth = 1.5
            ctx.beginPath(); ctx.roundRect(p, 30, lW, H - 60, 20); ctx.fill(); ctx.stroke()

            // Left Header
            ctx.fillStyle = '#ffffff'; ctx.font = '900 20px system-ui'
            ctx.fillText('PROCOLLAB', p + 24, 72)
            ctx.fillStyle = '#94a3b8'; ctx.font = '600 11px system-ui'
            ctx.fillText('STREAK & CONTRIBUTIONS', p + 24, 90)

            ctx.fillStyle = 'rgba(16,185,129,0.15)'; ctx.strokeStyle = 'rgba(16,185,129,0.4)'; ctx.lineWidth = 1.5
            ctx.beginPath(); ctx.roundRect(p + lW - 142, 56, 118, 26, 13); ctx.fill(); ctx.stroke()
            ctx.fillStyle = '#34d399'; ctx.font = 'bold 11px system-ui'
            ctx.fillText('✓ Verified Builder', p + lW - 130, 73)

            ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)'; ctx.lineWidth = 1
            ctx.beginPath(); ctx.moveTo(p + 24, 104); ctx.lineTo(p + lW - 24, 104); ctx.stroke()

            // Avatar & Name
            const avR = 36, avCX = p + 24 + avR, avCY = 154
            drawAvatar(avCX, avCY, avR)
            const bnX = avCX + avR + 16
            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 22px system-ui'
            ctx.fillText(userName, bnX, avCY - 4)
            ctx.fillStyle = '#94a3b8'; ctx.font = '13px system-ui'
            ctx.fillText(userHandle, bnX, avCY + 16)

            // Hero Streak Card
            const shY = 206, shW = lW - 48, shH = 146
            ctx.fillStyle = '#1e293b'; ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)'; ctx.lineWidth = 1.5
            ctx.beginPath(); ctx.roundRect(p + 24, shY, shW, shH, 16); ctx.fill(); ctx.stroke()

            const nextX = drawFlameStreak(p + 40, shY + 20, metrics.currentStreak, 54, 72)
            ctx.fillStyle = '#cbd5e1'; ctx.font = 'bold 16px system-ui'
            ctx.fillText('DAYS STREAK', nextX + 14, shY + 52)
            ctx.fillStyle = '#94a3b8'; ctx.font = '12px system-ui'
            ctx.fillText('Active Builder Consistency', nextX + 14, shY + 72)

            ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)'; ctx.lineWidth = 1
            ctx.beginPath(); ctx.moveTo(p + 40, shY + 96); ctx.lineTo(p + 24 + shW - 16, shY + 96); ctx.stroke()
            ctx.fillStyle = '#34d399'; ctx.font = '600 12px system-ui'
            ctx.fillText('⚡ Verified Proof of Work on Procollab', p + 40, shY + 122)

            // Stat pills row
            const spY = 368, spW = (shW - 14) / 3, spH = 68
            const spV = [`${metrics.longestStreak}d`, `${metrics.consistencyRate}%`, `${metrics.totalContributions}`]
            const spL = ['Best Streak', 'Consistency', 'Actions Logged']

            spV.forEach((v, i) => {
                const sx = p + 24 + i * (spW + 7)
                ctx.fillStyle = '#1e293b'; ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)'; ctx.lineWidth = 1.5
                ctx.beginPath(); ctx.roundRect(sx, spY, spW, spH, 12); ctx.fill(); ctx.stroke()
                ctx.fillStyle = '#ffffff'; ctx.font = 'bold 22px system-ui'
                ctx.fillText(v, sx + 10, spY + 36)
                ctx.fillStyle = '#94a3b8'; ctx.font = '10px system-ui'
                ctx.fillText(spL[i], sx + 10, spY + 54)
            })

            // Left panel footer URL
            ctx.font = '600 13px system-ui'; ctx.fillStyle = '#94a3b8'
            ctx.fillText(`procollab.in/u/${cleanHandle}`, p + 24, 512)

            // Right Panel Container
            const rX = p + lW + 24, rW = W - rX - p

            // Top Card: Activity Heatmap (Expanded 370px Height)
            const cardHeatH2 = 370
            ctx.fillStyle = '#0f172a'; ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)'; ctx.lineWidth = 1.5
            ctx.beginPath(); ctx.roundRect(rX, 30, rW, cardHeatH2, 20); ctx.fill(); ctx.stroke()

            ctx.font = 'bold 17px system-ui'; ctx.fillStyle = '#ffffff'
            ctx.fillText('Activity Calendar', rX + 24, 64)
            ctx.font = '12px system-ui'; ctx.fillStyle = '#94a3b8'
            ctx.fillText('Full Year Contribution Graph (52 Weeks)', rX + 24, 84)

            const cS2 = 13, cG2 = 4, cSt2 = cS2 + cG2
            const gCols2 = Math.floor((rW - 48) / cSt2)
            const srt2 = Object.keys(activityData).sort().slice(-gCols2 * 7)
            const gridStartY2 = 104
            let gc2 = 0, gr2 = 0
            srt2.forEach(k => {
                ctx.fillStyle = lvlColors[Math.min(activityData[k].level, 4)]
                ctx.beginPath(); ctx.roundRect(rX + 24 + gc2 * cSt2, gridStartY2 + gr2 * cSt2, cS2, cS2, 3); ctx.fill()
                gr2++; if (gr2 === 7) { gr2 = 0; gc2++ }
            })

            const legY2 = gridStartY2 + 7 * cSt2 + 20
            ctx.font = '11px system-ui'; ctx.fillStyle = '#94a3b8'
            ctx.fillText('Less', rX + 24, legY2 + 10)
            lvlColors.forEach((c, i) => {
                ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(rX + 60 + i * 20, legY2, 13, 13, 3); ctx.fill()
            })
            ctx.fillStyle = '#94a3b8'
            ctx.fillText('More', rX + 66 + lvlColors.length * 20, legY2 + 10)
            ctx.textAlign = 'right'
            ctx.fillText(`Total Actions: ${metrics.totalContributions}`, rX + rW - 24, legY2 + 10)
            ctx.textAlign = 'left'

            // Bottom Card: Compact Proof Statement Card (Compact 140px Height - No Empty Void!)
            const qY2 = 415, qH2 = 145
            ctx.fillStyle = '#0f172a'; ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)'; ctx.lineWidth = 1.5
            ctx.beginPath(); ctx.roundRect(rX, qY2, rW, qH2, 20); ctx.fill(); ctx.stroke()

            ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'; ctx.beginPath(); ctx.roundRect(rX + 24, qY2 + 14, 140, 22, 11); ctx.fill()
            ctx.fillStyle = '#cbd5e1'; ctx.font = 'bold 10px system-ui'
            ctx.fillText('“ PROOF OF WORK', rX + 36, qY2 + 29)

            ctx.fillStyle = '#f8fafc'; ctx.font = 'italic 600 17px system-ui'
            wrapText(activeQ, rX + 24, qY2 + 62, rW - 48, 24)

            ctx.font = '600 11px system-ui'; ctx.fillStyle = '#64748b'
            ctx.textAlign = 'right'
            ctx.fillText(`procollab.in/u/${cleanHandle}`, rX + rW - 24, qY2 + qH2 - 14)
            ctx.textAlign = 'left'
        }
    }, [cardFormat, customCaption, selectedCaption, metrics, activityData, userName, userHandle, avatarReady, cleanHandle, firstName])

    useEffect(() => {
        if (isOpen) drawCanvas()
    }, [isOpen, drawCanvas, cardFormat, avatarReady])

    useEffect(() => {
        if (isOpen) drawCanvas()
    }, [customCaption, selectedCaption])

    // DIRECT SCRIPT-SAFE HD PNG DOWNLOAD FUNCTION (Uploads to Firebase Storage & Deletes after download as requested)
    const handleDownloadImage = useCallback(async () => {
        const canvas = canvasRef.current
        if (!canvas) return

        setIsDownloading(true)
        try {
            // Get Blob from canvas
            const blob = await new Promise<Blob | null>((resolve) => {
                try {
                    canvas.toBlob(resolve, 'image/png')
                } catch {
                    resolve(null)
                }
            })

            if (!blob) {
                toast({ title: 'Export Notice', description: 'Right-click card preview and select "Save Image As".' })
                setIsDownloading(false)
                return
            }

            // 1. Direct browser download trigger
            const blobUrl = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = blobUrl
            a.download = `procollab-streak-${cleanHandle}.png`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(blobUrl)

            // 2. Upload temporary image to Firebase Storage & Delete immediately after download (as requested by user)
            try {
                const tempRef = ref(storage, `temp_exports/${cleanHandle}_${Date.now()}.png`)
                await uploadBytes(tempRef, blob)
                await deleteObject(tempRef)
            } catch {
                /* optional storage cleanup fallback */
            }

            toast({
                title: '✅ HD Card Downloaded!',
                description: 'Saved PNG image to your downloads folder.',
            })
        } catch (err) {
            console.error('Download error:', err)
            toast({ title: 'Download Notice', description: 'Right-click card preview and select "Save Image As".' })
        } finally {
            setIsDownloading(false)
        }
    }, [cleanHandle, toast])

    // Guided LinkedIn Share Action
    const handleLinkedInShare = useCallback(() => {
        navigator.clipboard.writeText(activeCaption)
        setCopiedCaption(true)
        setTimeout(() => setCopiedCaption(false), 2500)

        handleDownloadImage()

        setTimeout(() => {
            window.open(`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(activeCaption)}`, '_blank')
            toast({
                title: '📋 Text Copied & HD Card Downloaded!',
                description: 'LinkedIn opened! Paste text (Ctrl+V) and attach your downloaded card!',
            })
        }, 400)
    }, [activeCaption, handleDownloadImage, toast])

    const handleCopyCaption = () => {
        navigator.clipboard.writeText(activeCaption)
        setCopiedCaption(true)
        setTimeout(() => setCopiedCaption(false), 2000)
        toast({ title: 'Caption copied!', description: 'Paste it into your social media post.' })
    }

    const handleCopyProfileLink = () => {
        navigator.clipboard.writeText(profileUrl)
        setCopiedLink(true)
        setTimeout(() => setCopiedLink(false), 2000)
        toast({ title: 'Profile Link Copied!', description: profileUrl })
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-xl bg-zinc-950 border-zinc-800 text-white p-0 overflow-hidden shadow-2xl rounded-2xl max-h-[92vh] flex flex-col">
                <DialogHeader className="p-5 border-b border-zinc-800 bg-zinc-900/60">
                    <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30">
                            <Sparkles className="h-4 w-4" />
                        </span>
                        <div>
                            <DialogTitle className="text-lg font-extrabold text-white">Flex Your Grind 💪</DialogTitle>
                            <DialogDescription className="text-xs text-zinc-400">
                                Export high-resolution proof-of-work cards for LinkedIn & Instagram.
                            </DialogDescription>
                        </div>
                    </div>

                    {/* Format Tabs */}
                    <div className="flex items-center gap-2 mt-4 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                        <button
                            onClick={() => setCardFormat('story')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${cardFormat === 'story'
                                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-zinc-950 shadow-md'
                                : 'text-zinc-400 hover:text-white'}`}
                        >
                            <Instagram className="h-3.5 w-3.5" /> Insta Story (9:16)
                        </button>
                        <button
                            onClick={() => setCardFormat('linkedin')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${cardFormat === 'linkedin'
                                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-zinc-950 shadow-md'
                                : 'text-zinc-400 hover:text-white'}`}
                        >
                            <Linkedin className="h-3.5 w-3.5" /> LinkedIn Post (16:9)
                        </button>
                    </div>
                </DialogHeader>

                <div className="p-5 overflow-y-auto flex flex-col items-center space-y-4 flex-1 scrollbar-thin scrollbar-thumb-zinc-800">

                    {/* STORY TAB */}
                    {cardFormat === 'story' && (
                        <>
                            <div className="w-full space-y-1.5">
                                <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <Edit3 className="h-3.5 w-3.5 text-amber-400" /> Story Quote / Caption:
                                </label>
                                <Input
                                    value={customCaption}
                                    onChange={(e) => setCustomCaption(e.target.value)}
                                    placeholder={`e.g. "${firstName} is unstoppable 🔥"`}
                                    className="bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500 text-xs h-9 focus-visible:ring-amber-500"
                                />
                            </div>

                            {/* Canvas Preview */}
                            <div className="w-full flex justify-center bg-zinc-900/90 p-3 rounded-2xl border border-zinc-800 shadow-inner">
                                <canvas ref={canvasRef} className="rounded-xl shadow-2xl border border-zinc-700 max-h-[420px] object-contain aspect-[9/16]" />
                            </div>
                        </>
                    )}

                    {/* LINKEDIN TAB */}
                    {cardFormat === 'linkedin' && (
                        <>
                            {/* Canvas Banner Preview */}
                            <div className="w-full flex justify-center bg-zinc-900/90 p-3 rounded-2xl border border-zinc-800 shadow-inner">
                                <canvas ref={canvasRef} className="rounded-xl shadow-2xl border border-zinc-700 w-full object-contain aspect-video" />
                            </div>

                            {/* Preset Marketing Captions */}
                            <div className="w-full space-y-2">
                                <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
                                    Select Post Caption Template:
                                </label>
                                <div className="space-y-2">
                                    {linkedInCaptions.map((cap, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => { setSelectedCaption(idx); setCustomCaption('') }}
                                            className={`w-full text-left p-3 rounded-xl border text-xs transition-all leading-relaxed ${selectedCaption === idx && !customCaption
                                                ? 'bg-amber-950/50 border-amber-500 text-amber-100 font-medium'
                                                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}
                                        >
                                            {cap.split('\n')[0]}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Custom Caption TextArea */}
                            <div className="w-full space-y-1.5">
                                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Edit3 className="h-3.5 w-3.5 text-amber-400" /> Or write custom caption:
                                </label>
                                <textarea
                                    value={customCaption}
                                    onChange={(e) => setCustomCaption(e.target.value)}
                                    placeholder="Write custom caption..."
                                    rows={3}
                                    className="w-full bg-zinc-900 border border-zinc-800 text-white text-xs rounded-xl p-3 resize-none placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                            </div>

                            {/* Caption Preview Box */}
                            <div className="w-full p-3 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wide">Caption Preview:</p>
                                    <button
                                        onClick={handleCopyCaption}
                                        className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                                    >
                                        {copiedCaption ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                                        {copiedCaption ? 'Copied!' : 'Copy Text'}
                                    </button>
                                </div>
                                <p className="text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed">
                                    {activeCaption}
                                </p>
                            </div>
                        </>
                    )}
                </div>

                {/* Modal Action Bar */}
                <div className="p-4 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between gap-2 flex-wrap">
                    <Button variant="outline" onClick={onClose} className="bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-white text-xs h-9">
                        Close
                    </Button>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Copy Link */}
                        <Button
                            onClick={handleCopyProfileLink}
                            variant="outline"
                            className="bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-white text-xs h-9"
                        >
                            {copiedLink ? <Check className="h-3.5 w-3.5 mr-1 text-green-400" /> : <Link2 className="h-3.5 w-3.5 mr-1 text-amber-400" />}
                            {copiedLink ? 'Link Copied' : 'Copy Profile Link'}
                        </Button>

                        {/* Download HD Card */}
                        <Button
                            onClick={handleDownloadImage}
                            disabled={isDownloading}
                            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-zinc-950 font-bold text-xs h-9 shadow-md"
                        >
                            {isDownloading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                            {isDownloading ? 'Exporting...' : 'Download HD Card'}
                        </Button>

                        {cardFormat === 'linkedin' && (
                            <Button
                                onClick={handleLinkedInShare}
                                disabled={isDownloading}
                                className="bg-[#0077b5] hover:bg-[#005f91] text-white font-bold text-xs h-9 shadow-md"
                            >
                                <Linkedin className="h-3.5 w-3.5 mr-1.5" /> Post to LinkedIn
                                <ExternalLink className="h-3.5 w-3.5 ml-1 opacity-80" />
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
