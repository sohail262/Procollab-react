import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, updateDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { Loader2 } from 'lucide-react'

interface WelcomeScreenProps {
    firstName?: string
    redirectTo?: string
    isReturning?: boolean   // true = "Welcome back", false = new registration
}

const PILLARS = [
    { label: 'Connect', desc: 'Find collaborators who match your vision' },
    { label: 'Build',   desc: 'Manage projects with clarity and precision' },
    { label: 'Publish', desc: 'Share your work with the world' },
]

const OBJECTIVES = [
    { id: 'find_projects', title: 'Find projects', desc: 'Join ongoing projects and contribute your skills.' },
    { id: 'find_collaborators', title: 'Find collaborators', desc: 'Find talented partners to work on your ideas.' },
    { id: 'build_startup', title: 'Build a startup', desc: 'Form a co-founding team and launch a product.' },
    { id: 'manage_team', title: 'Manage a team', desc: 'Coordinate project tasks, milestones, and timelines.' },
    { id: 'build_portfolio', title: 'Build a portfolio', desc: 'Showcase your finished work and gain experience.' },
]

export function WelcomeScreen({
    firstName,
    redirectTo = '/dashboard',
    isReturning = false,
    }: WelcomeScreenProps) {
    const navigate = useNavigate()
    const [phase, setPhase] = useState<'enter' | 'hold' | 'questionnaire' | 'exit'>('enter')
    const [pillarIndex, setPillarIndex] = useState(0)
    const [selectedObjective, setSelectedObjective] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

    // Timings computed dynamically:
    // If returning, we adjust timings so they sum to exactly 5000ms:
    // enterMs (1000) + 3 * pillarMs (2700) + holdExtraMs (400) + exitMs (500) + navAfterMs (400) = 5000ms
    const enterMs = isReturning ? 1000 : 1000
    const pillarMs = isReturning ? 900 : 1100
    const holdExtraMs = isReturning ? 400 : 600
    const exitMs = isReturning ? 500 : 600
    const navAfterMs = isReturning ? 400 : 350

    const totalHold = PILLARS.length * pillarMs + holdExtraMs

    const addTimer = (fn: () => void, ms: number) => {
        const id = setTimeout(fn, ms)
        timersRef.current.push(id)
        return id
    }

    // Phase 1 -> Phase 2 (enter -> hold)
    useEffect(() => {
        timersRef.current = []
        addTimer(() => setPhase('hold'), enterMs)
        return () => timersRef.current.forEach(clearTimeout)
    }, [enterMs])

    // Phase 2: cycle pillars, then transition to next step
    useEffect(() => {
        if (phase !== 'hold') return
        timersRef.current = []

        PILLARS.forEach((_, i) => {
            if (i === 0) return
            addTimer(() => setPillarIndex(i), i * pillarMs)
        })

        addTimer(() => {
            if (isReturning) {
                setPhase('exit')
            } else {
                setPhase('questionnaire')
            }
        }, totalHold)

        return () => timersRef.current.forEach(clearTimeout)
    }, [phase, pillarMs, totalHold, isReturning])

    // Phase 3 (exit): navigate to dashboard
    useEffect(() => {
        if (phase !== 'exit') return
        timersRef.current = []
        addTimer(() => navigate(redirectTo, { replace: true }), navAfterMs)
        return () => timersRef.current.forEach(clearTimeout)
    }, [phase, navigate, redirectTo, navAfterMs])

    // Skip helper
    const handleSkip = () => {
        timersRef.current.forEach(clearTimeout)
        if (isReturning) {
            navigate(redirectTo, { replace: true })
        } else {
            setPhase('questionnaire')
        }
    }

    // Submit questionnaire objective
    const handleObjectiveSubmit = async () => {
        if (!selectedObjective) return
        setSubmitting(true)
        try {
            const user = auth.currentUser
            if (user) {
                const userDocRef = doc(db, 'users', user.uid)
                await updateDoc(userDocRef, {
                    onboardingObjective: selectedObjective,
                    onboardingChecklist: {
                        profileComplete: false,
                        photoAdded: false,
                        githubConnected: false,
                        firstConnection: false,
                        projectSaved: false,
                        projectAppliedOrCreate: false,
                        checklistCompleted: false
                    }
                })
            }
            setPhase('exit')
        } catch (err) {
            console.error('Error saving onboarding objective:', err)
            // fallback transition to not block user
            setPhase('exit')
        } finally {
            setSubmitting(false)
        }
    }

    const label  = isReturning ? 'Welcome back' : 'Account created'
    const prefix = isReturning ? 'Good to see you,' : 'Welcome,'

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');

                /* ── Root ─────────────────────────────────────────────────── */
                .wlc-root {
                    position: fixed;
                    inset: 0;
                    z-index: 9999;
                    background: #050a08;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    font-family: 'DM Sans', system-ui, sans-serif;
                    transition: opacity ${exitMs}ms cubic-bezier(0.4, 0, 0.2, 1),
                                transform ${exitMs}ms cubic-bezier(0.4, 0, 0.2, 1);
                    padding: 24px 20px;
                    box-sizing: border-box;
                }
                .wlc-root.wlc-exiting {
                    opacity: 0;
                    transform: scale(1.012);
                    pointer-events: none;
                }

                /* ── Atmosphere ────────────────────────────────────────────── */
                .wlc-bg {
                    position: absolute; inset: 0; pointer-events: none;
                    background:
                        radial-gradient(ellipse 65% 55% at 15% 65%, rgba(16,185,129,0.08) 0%, transparent 70%),
                        radial-gradient(ellipse 45% 65% at 85% 25%, rgba(5,150,105,0.06) 0%, transparent 70%),
                        radial-gradient(ellipse 80% 35% at 50% 105%, rgba(16,185,129,0.04) 0%, transparent 70%);
                }
                .wlc-grid {
                    position: absolute; inset: 0; pointer-events: none;
                    background-image:
                        linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px);
                    background-size: 52px 52px;
                }
                .wlc-rule {
                    position: absolute; top: 0; left: 0; right: 0;
                    height: 1px; pointer-events: none;
                    background: linear-gradient(90deg, transparent 0%, rgba(16,185,129,0.7) 30%, rgba(5,150,105,0.5) 70%, transparent 100%);
                    animation: wlcRuleIn 1.4s cubic-bezier(0.4,0,0.2,1) forwards;
                    transform-origin: left center;
                }
                @keyframes wlcRuleIn { from { transform: scaleX(0); opacity: 0; } to { transform: scaleX(1); opacity: 1; } }

                /* ── Corner brackets ───────────────────────────────────────── */
                .wlc-corner {
                    position: absolute;
                    width: 36px; height: 36px;
                    opacity: 0;
                    animation: wlcRise 0.7s ease 1.1s forwards;
                }
                .wlc-corner.tl { top: 28px; left: 28px; border-top: 1px solid rgba(16,185,129,0.32); border-left: 1px solid rgba(16,185,129,0.32); }
                .wlc-corner.tr { top: 28px; right: 28px; border-top: 1px solid rgba(16,185,129,0.32); border-right: 1px solid rgba(16,185,129,0.32); }
                .wlc-corner.bl { bottom: 28px; left: 28px; border-bottom: 1px solid rgba(16,185,129,0.32); border-left: 1px solid rgba(16,185,129,0.32); }
                .wlc-corner.br { bottom: 28px; right: 28px; border-bottom: 1px solid rgba(16,185,129,0.32); border-right: 1px solid rgba(16,185,129,0.32); }

                /* ── Brand ─────────────────────────────────────────────────── */
                .wlc-brand {
                    display: flex; align-items: center; gap: 10px;
                    margin-bottom: 40px;
                    opacity: 0;
                    animation: wlcRise 0.7s cubic-bezier(0.22,1,0.36,1) 0.3s forwards;
                }
                .wlc-brand-mark {
                    width: 30px; height: 30px; border-radius: 8px;
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    display: flex; align-items: center; justify-content: center;
                    flex-shrink: 0;
                }
                .wlc-brand-mark span {
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    font-size: 15px; color: #fff; line-height: 1; margin-top: 1px;
                    font-weight: 700;
                }
                .wlc-brand-name {
                    font-size: 11px; font-weight: 400;
                    letter-spacing: 0.22em; text-transform: uppercase;
                    color: rgba(255,255,255,0.45);
                }

                /* ── Headline ──────────────────────────────────────────────── */
                .wlc-headline {
                    text-align: center; margin-bottom: 18px;
                    opacity: 0;
                    animation: wlcRise 0.8s cubic-bezier(0.22,1,0.36,1) 0.55s forwards;
                }
                .wlc-event-label {
                    display: block;
                    font-size: 10px; font-weight: 500;
                    letter-spacing: 0.26em; text-transform: uppercase;
                    color: rgba(16,185,129,0.85); margin-bottom: 14px;
                }
                .wlc-name {
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    font-size: clamp(32px, 8vw, 68px);
                    color: #fff; line-height: 1.05;
                    font-weight: 700; letter-spacing: -0.02em;
                }
                .wlc-name em {
                    font-style: italic; color: rgba(255,255,255,0.7);
                }

                /* ── Subtitle ──────────────────────────────────────────────── */
                .wlc-subtitle {
                    font-size: clamp(13px, 2vw, 15px);
                    font-weight: 300; color: rgba(255,255,255,0.38);
                    text-align: center; max-width: 340px; line-height: 1.7;
                    margin: 0 auto 40px;
                    opacity: 0;
                    animation: wlcRise 0.7s cubic-bezier(0.22,1,0.36,1) 0.75s forwards;
                }

                /* ── Pillars ───────────────────────────────────────────────── */
                .wlc-pillars {
                    display: flex; align-items: stretch;
                    margin-bottom: 40px;
                    opacity: 0;
                    animation: wlcRise 0.65s cubic-bezier(0.22,1,0.36,1) 0.95s forwards;
                }
                .wlc-pillar-wrap {
                    display: flex; align-items: center;
                }
                .wlc-pillar-sep {
                    width: 1px; height: 44px;
                    background: rgba(255,255,255,0.07);
                    margin: 0 28px;
                    align-self: center;
                }
                .wlc-pillar {
                    display: flex; flex-direction: column;
                    align-items: center; gap: 7px;
                    padding: 0 8px;
                    transition: opacity 0.5s ease;
                }
                .wlc-pillar.dimmed { opacity: 0.22; }
                .wlc-pillar.active { opacity: 1; }
                .wlc-pillar-dot {
                    width: 4px; height: 4px; border-radius: 50%;
                    background: rgba(16,185,129,0.5); margin-bottom: 2px;
                    transition: background 0.5s ease, transform 0.5s ease;
                }
                .wlc-pillar.active .wlc-pillar-dot {
                    background: #34d399; transform: scale(1.6);
                }
                .wlc-pillar-label {
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    font-size: 18px; color: #fff; font-weight: 600;
                    letter-spacing: -0.01em; white-space: nowrap;
                }
                .wlc-pillar-desc {
                    font-size: 10.5px; font-weight: 400;
                    color: rgba(255,255,255,0.3);
                    letter-spacing: 0.02em; text-align: center;
                    max-width: 120px; line-height: 1.55;
                }

                /* ── Progress ──────────────────────────────────────────────── */
                .wlc-progress-track {
                    width: min(220px, 60vw); height: 1px;
                    background: rgba(255,255,255,0.09);
                    border-radius: 1px; overflow: hidden;
                    opacity: 0;
                    animation: wlcRise 0.6s ease ${enterMs - 100}ms forwards;
                }
                .wlc-progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #10b981, #059669);
                    border-radius: 1px;
                    animation: wlcProgress ${totalHold}ms cubic-bezier(0.4,0,0.2,1) ${enterMs}ms forwards;
                }
                @keyframes wlcProgress { from { width: 0%; } to { width: 100%; } }
                .wlc-progress-label {
                    font-size: 9.5px; font-weight: 400;
                    letter-spacing: 0.2em; text-transform: uppercase;
                    color: rgba(255,255,255,0.18); margin-top: 14px;
                    opacity: 0;
                    animation: wlcRise 0.5s ease ${enterMs + 150}ms forwards;
                }

                /* ── Skip Button ───────────────────────────────────────────── */
                .wlc-skip-btn {
                    position: absolute;
                    top: 24px;
                    right: 24px;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.08);
                    color: rgba(255,255,255,0.6);
                    padding: 8px 16px;
                    font-size: 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    z-index: 10000;
                }
                .wlc-skip-btn:hover {
                    background: rgba(255,255,255,0.08);
                    border-color: rgba(255,255,255,0.15);
                    color: #fff;
                }

                /* ── Questionnaire View ────────────────────────────────────── */
                .wlc-q-container {
                    max-width: 540px;
                    width: 100%;
                    text-align: center;
                    z-index: 10;
                    animation: wlcRise 0.6s cubic-bezier(0.22,1,0.36,1) forwards;
                    padding: 0 16px;
                    box-sizing: border-box;
                }
                .wlc-q-title {
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    font-size: 32px;
                    color: #fff;
                    margin-bottom: 8px;
                    letter-spacing: -0.01em;
                    font-weight: 700;
                }
                .wlc-q-subtitle {
                    font-size: 14px;
                    color: rgba(255,255,255,0.4);
                    margin-bottom: 28px;
                    font-weight: 300;
                }
                .wlc-q-options {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 10px;
                    margin-bottom: 32px;
                    max-height: 48vh;
                    overflow-y: auto;
                    padding-right: 4px;
                }
                .wlc-q-option {
                    background: rgba(255,255,255,0.02);
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 12px;
                    padding: 14px 18px;
                    text-align: left;
                    cursor: pointer;
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                }
                .wlc-q-option:hover {
                    background: rgba(255,255,255,0.05);
                    border-color: rgba(99,102,241,0.3);
                    transform: translateY(-1px);
                }
                .wlc-q-option.selected {
                    background: rgba(99,102,241,0.08);
                    border-color: rgba(99,102,241,0.6);
                    box-shadow: 0 0 20px rgba(99,102,241,0.15);
                }
                .wlc-q-opt-meta {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                }
                .wlc-q-opt-title {
                    color: #fff;
                    font-size: 15px;
                    font-weight: 500;
                }
                .wlc-q-opt-desc {
                    color: rgba(255,255,255,0.35);
                    font-size: 11.5px;
                    font-weight: 300;
                    line-height: 1.4;
                }
                .wlc-q-radio {
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    border: 2px solid rgba(255,255,255,0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                    flex-shrink: 0;
                }
                .wlc-q-option.selected .wlc-q-radio {
                    border-color: #818cf8;
                }
                .wlc-q-radio-inner {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #818cf8;
                    opacity: 0;
                    transform: scale(0.5);
                    transition: all 0.2s ease;
                }
                .wlc-q-option.selected .wlc-q-radio-inner {
                    opacity: 1;
                    transform: scale(1);
                }
                .wlc-q-btn {
                    background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
                    border: none;
                    color: #fff;
                    padding: 12px 36px;
                    font-size: 14px;
                    font-weight: 500;
                    border-radius: 9px;
                    cursor: pointer;
                    transition: opacity 0.2s, transform 0.15s;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                }
                .wlc-q-btn:hover:not(:disabled) {
                    opacity: 0.92;
                    transform: translateY(-1px);
                }
                .wlc-q-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                /* ── Shared keyframes ──────────────────────────────────────── */
                @keyframes wlcRise {
                    from { opacity: 0; transform: translateY(14px); }
                    to   { opacity: 1; transform: translateY(0); }
                }

                /* ── Mobile ────────────────────────────────────────────────── */
                @media (max-width: 600px) {
                    .wlc-corner { display: none; }
                    .wlc-brand  { margin-bottom: 30px; }
                    .wlc-subtitle { margin-bottom: 30px; }
                    .wlc-skip-btn { top: 16px; right: 16px; }
                    .wlc-pillars {
                        flex-direction: column;
                        align-items: center;
                        gap: 16px;
                        margin-bottom: 30px;
                    }
                    .wlc-pillar-wrap { flex-direction: column; }
                    .wlc-pillar-sep {
                        width: 40px; height: 1px;
                        margin: 4px 0;
                    }
                    .wlc-pillar { flex-direction: row; gap: 12px; padding: 0; }
                    .wlc-pillar-dot { margin-bottom: 0; }
                    .wlc-pillar-desc { display: none; }
                    .wlc-pillar-label { font-size: 16px; }
                    .wlc-q-title { font-size: 26px; }
                }
                @media (max-width: 360px) {
                    .wlc-name { font-size: 28px; }
                }
            `}</style>

            <div className={`wlc-root${phase === 'exit' ? ' wlc-exiting' : ''}`} role="status" aria-live="polite">

                {/* Atmosphere */}
                <div className="wlc-bg" aria-hidden="true" />
                <div className="wlc-grid" aria-hidden="true" />
                <div className="wlc-rule" aria-hidden="true" />

                {/* Skip button for intro phase */}
                {(phase === 'enter' || phase === 'hold') && (
                    <button className="wlc-skip-btn" onClick={handleSkip}>
                        Skip Onboarding
                    </button>
                )}

                {phase !== 'questionnaire' ? (
                    <>
                        {/* Corners */}
                        <div className="wlc-corner tl" aria-hidden="true" />
                        <div className="wlc-corner tr" aria-hidden="true" />
                        <div className="wlc-corner bl" aria-hidden="true" />
                        <div className="wlc-corner br" aria-hidden="true" />

                        {/* Brand */}
                        <div className="wlc-brand" aria-label="ProCollab">
                            <div className="wlc-brand-mark"><span>P</span></div>
                            <span className="wlc-brand-name">ProCollab</span>
                        </div>

                        {/* Headline */}
                        <div className="wlc-headline">
                            <span className="wlc-event-label">{label}</span>
                            <div className="wlc-name">
                                {firstName
                                    ? <>{prefix} <em>{firstName}</em></>
                                    : isReturning
                                        ? <>Good to see you again</>
                                        : <>Welcome to <em>ProCollab</em></>
                                }
                            </div>
                        </div>

                        {/* Subtitle */}
                        <p className="wlc-subtitle">
                            {isReturning
                                ? 'Your workspace is ready. Pick up right where you left off.'
                                : 'Your workspace is ready. Start building, collaborating, and connecting with people who care.'
                            }
                        </p>

                        {/* Pillars */}
                        <div className="wlc-pillars" aria-hidden="true">
                            {PILLARS.map((p, i) => (
                                <div key={p.label} className="wlc-pillar-wrap">
                                    {i > 0 && <div className="wlc-pillar-sep" />}
                                    <div className={`wlc-pillar ${pillarIndex === i ? 'active' : 'dimmed'}`}>
                                        <div className="wlc-pillar-dot" />
                                        <span className="wlc-pillar-label">{p.label}</span>
                                        <span className="wlc-pillar-desc">{p.desc}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Progress bar */}
                        <div className="wlc-progress-track">
                            <div className="wlc-progress-fill" />
                        </div>
                        <p className="wlc-progress-label">
                            {isReturning ? 'Loading your dashboard' : 'Preparing your workspace'}
                        </p>
                    </>
                ) : (
                    <div className="wlc-q-container">
                        <h2 className="wlc-q-title">What brings you to ProCollab?</h2>
                        <p className="wlc-q-subtitle">Choose your primary objective to personalize your experience.</p>
                        <div className="wlc-q-options">
                            {OBJECTIVES.map((opt) => (
                                <div
                                    key={opt.id}
                                    className={`wlc-q-option${selectedObjective === opt.id ? ' selected' : ''}`}
                                    onClick={() => setSelectedObjective(opt.id)}
                                >
                                    <div className="wlc-q-opt-meta">
                                        <span className="wlc-q-opt-title">{opt.title}</span>
                                        <span className="wlc-q-opt-desc">{opt.desc}</span>
                                    </div>
                                    <div className="wlc-q-radio">
                                        <div className="wlc-q-radio-inner" />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button
                            className="wlc-q-btn"
                            disabled={!selectedObjective || submitting}
                            onClick={handleObjectiveSubmit}
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="animate-spin h-4 w-4" />
                                    Saving...
                                </>
                            ) : (
                                'Complete Onboarding'
                            )}
                        </button>
                    </div>
                )}

            </div>
        </>
    )
}

export default WelcomeScreen

