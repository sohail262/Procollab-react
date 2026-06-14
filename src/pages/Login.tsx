import { useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate, useSearchParams, Navigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { auth } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, Loader2, Github } from "lucide-react"
import { WelcomeScreen } from "@/components/WelcomeScreen"
import { trackLogin } from "@/services/analyticsService"

export function Login() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const [showWelcome, setShowWelcome] = useState(false)
    const [welcomeName, setWelcomeName] = useState("")

    const { login, loginWithGoogle, loginWithGithub, user, loading: authLoading } = useAuth()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()

    const getRedirectPath = () => searchParams.get('redirect') || '/dashboard'

    // Helper: extract first name from Firebase currentUser after auth completes
    const getFirstName = () => {
        const displayName = auth.currentUser?.displayName || ''
        return displayName.split(' ')[0] || ''
    }

    // Already logged in — send to dashboard (only if not showing welcome)
    if (!authLoading && user && !showWelcome) {
        return <Navigate to={getRedirectPath()} replace />
    }

    // ── Email/password login ──────────────────────────────────────────────────
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError("")
        setLoading(true)
        try {
            await login(email, password)
            if (auth.currentUser) trackLogin(auth.currentUser.uid, 'email')
            setWelcomeName(getFirstName())
            setShowWelcome(true)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // ── Google login ──────────────────────────────────────────────────────────
    const handleGoogleLogin = async () => {
        setError("")
        setLoading(true)
        try {
            await loginWithGoogle()
            if (auth.currentUser) trackLogin(auth.currentUser.uid, 'google')
            setWelcomeName(getFirstName())
            setShowWelcome(true)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // ── GitHub login ──────────────────────────────────────────────────────────
    const handleGithubLogin = async () => {
        setError("")
        setLoading(true)
        try {
            await loginWithGithub()
            if (auth.currentUser) trackLogin(auth.currentUser.uid, 'github')
            setWelcomeName(getFirstName())
            setShowWelcome(true)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // Show welcome interlude
    if (showWelcome) {
        return (
            <WelcomeScreen
                firstName={welcomeName || undefined}
                redirectTo={getRedirectPath()}
                isReturning={true}
            />
        )
    }

    return (
        <>
            <style>{`
                .auth-bg {
                    position: fixed;
                    inset: 0;
                    background: #080a0e;
                    z-index: 0;
                }
                .auth-bg-mesh {
                    position: absolute; inset: 0; pointer-events: none;
                    background:
                        radial-gradient(ellipse 70% 55% at 10% 70%, rgba(59,130,246,0.09) 0%, transparent 65%),
                        radial-gradient(ellipse 50% 60% at 90% 20%, rgba(99,102,241,0.07) 0%, transparent 65%),
                        radial-gradient(ellipse 80% 40% at 50% 110%, rgba(16,185,129,0.04) 0%, transparent 65%);
                }
                .auth-bg-grid {
                    position: absolute; inset: 0; pointer-events: none;
                    background-image:
                        linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
                    background-size: 52px 52px;
                }
                .auth-page {
                    position: relative;
                    z-index: 1;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 24px 16px;
                    font-family: 'DM Sans', system-ui, sans-serif;
                }
                .auth-card {
                    width: 100%;
                    max-width: 440px;
                    background: rgba(12, 14, 20, 0.92);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 16px;
                    overflow: hidden;
                    backdrop-filter: blur(24px);
                    box-shadow:
                        0 0 0 1px rgba(99,102,241,0.08),
                        0 24px 64px rgba(0,0,0,0.55),
                        0 0 80px rgba(59,130,246,0.05);
                }
                .auth-card-header {
                    padding: 32px 32px 24px;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                    text-align: center;
                    position: relative;
                    overflow: hidden;
                }
                .auth-card-header::before {
                    content: '';
                    position: absolute; top: 0; left: 0; right: 0; height: 1px;
                    background: linear-gradient(90deg, transparent, rgba(99,102,241,0.6), rgba(59,130,246,0.4), transparent);
                }
                .auth-brand {
                    display: inline-flex;
                    align-items: center;
                    gap: 9px;
                    margin-bottom: 20px;
                }
                .auth-brand-mark {
                    width: 28px; height: 28px; border-radius: 7px;
                    background: linear-gradient(135deg, #3b82f6, #6366f1);
                    display: flex; align-items: center; justify-content: center;
                }
                .auth-brand-mark span {
                    font-size: 13px; font-weight: 700; color: white; line-height: 1;
                }
                .auth-brand-name {
                    font-size: 13px; letter-spacing: 0.16em;
                    text-transform: uppercase; color: rgba(255,255,255,0.45);
                }
                .auth-title {
                    font-size: clamp(20px, 4vw, 26px);
                    font-weight: 600; color: #fff; letter-spacing: -0.02em;
                    margin: 0 0 6px;
                }
                .auth-subtitle {
                    font-size: 13px; color: rgba(255,255,255,0.35);
                    margin: 0; font-weight: 300;
                }
                .auth-card-body {
                    padding: 28px 32px 32px;
                }
                .auth-label {
                    display: block;
                    font-size: 12px; font-weight: 500;
                    letter-spacing: 0.04em;
                    color: rgba(255,255,255,0.5);
                    margin-bottom: 7px;
                    text-transform: uppercase;
                }
                .auth-input {
                    width: 100%;
                    height: 44px;
                    padding: 0 14px;
                    background: rgba(255,255,255,0.04) !important;
                    border: 1px solid rgba(255,255,255,0.09) !important;
                    border-radius: 9px !important;
                    color: #fff !important;
                    font-size: 14px;
                    transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
                    box-sizing: border-box;
                }
                .auth-input:focus {
                    background: rgba(255,255,255,0.06) !important;
                    border-color: rgba(99,102,241,0.45) !important;
                    outline: none;
                    box-shadow: 0 0 0 3px rgba(99,102,241,0.1) !important;
                }
                .auth-input::placeholder { color: rgba(255,255,255,0.22) !important; }
                .auth-field { margin-bottom: 18px; }
                .auth-divider {
                    position: relative; margin: 20px 0;
                    display: flex; align-items: center;
                }
                .auth-divider::before, .auth-divider::after {
                    content: ''; flex: 1;
                    height: 1px; background: rgba(255,255,255,0.07);
                }
                .auth-divider span {
                    padding: 0 14px;
                    font-size: 11px; color: rgba(255,255,255,0.25);
                    letter-spacing: 0.08em; white-space: nowrap;
                }
                .auth-oauth-btn {
                    flex: 1;
                    height: 42px;
                    background: rgba(255,255,255,0.04) !important;
                    border: 1px solid rgba(255,255,255,0.09) !important;
                    color: rgba(255,255,255,0.7) !important;
                    font-size: 13px !important;
                    border-radius: 9px !important;
                    transition: background 0.2s ease, border-color 0.2s ease;
                    display: flex; align-items: center; justify-content: center; gap: 8px;
                }
                .auth-oauth-btn:hover {
                    background: rgba(255,255,255,0.08) !important;
                    border-color: rgba(255,255,255,0.15) !important;
                }
                .auth-submit-btn {
                    width: 100%; height: 44px;
                    background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%) !important;
                    border: none !important;
                    border-radius: 9px !important;
                    color: white !important;
                    font-size: 14px !important;
                    font-weight: 500 !important;
                    letter-spacing: 0.01em;
                    cursor: pointer;
                    transition: opacity 0.2s ease, transform 0.15s ease;
                    margin-top: 4px;
                }
                .auth-submit-btn:hover { opacity: 0.92; transform: translateY(-1px); }
                .auth-submit-btn:active { transform: translateY(0); }
                .auth-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
                .auth-footer-link {
                    font-size: 13px; color: rgba(255,255,255,0.35);
                    text-align: center; margin-top: 22px;
                }
                .auth-footer-link a {
                    color: rgba(99,102,241,0.9);
                    font-weight: 500; text-decoration: none;
                    transition: color 0.2s;
                }
                .auth-footer-link a:hover { color: #818cf8; }
                .auth-back-link {
                    font-size: 12px; color: rgba(255,255,255,0.22);
                    text-align: center; margin-top: 14px; text-decoration: none;
                    display: block; transition: color 0.2s;
                }
                .auth-back-link:hover { color: rgba(255,255,255,0.45); }
                .auth-pw-wrap { position: relative; }
                .auth-pw-toggle {
                    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
                    background: none; border: none; cursor: pointer;
                    color: rgba(255,255,255,0.3); padding: 0;
                    transition: color 0.2s; line-height: 1;
                }
                .auth-pw-toggle:hover { color: rgba(255,255,255,0.55); }
                .auth-forgot {
                    font-size: 12px; color: rgba(99,102,241,0.7);
                    text-decoration: none; float: right; margin-top: 6px;
                    transition: color 0.2s;
                }
                .auth-forgot:hover { color: #818cf8; }
                @media (max-width: 480px) {
                    .auth-card-header { padding: 24px 20px 20px; }
                    .auth-card-body  { padding: 22px 20px 28px; }
                }
            `}</style>

            {/* Premium dark background */}
            <div className="auth-bg" aria-hidden="true">
                <div className="auth-bg-mesh" />
                <div className="auth-bg-grid" />
            </div>

            <div className="auth-page">
                <div className="auth-card">

                    {/* Header */}
                    <div className="auth-card-header">
                        <div className="auth-brand">
                            <div className="auth-brand-mark"><span>P</span></div>
                            <span className="auth-brand-name">ProCollab</span>
                        </div>
                        <h1 className="auth-title">Welcome back</h1>
                        <p className="auth-subtitle">Sign in to continue to your workspace</p>
                    </div>

                    {/* Body */}
                    <div className="auth-card-body">
                        {error && (
                            <Alert variant="destructive" className="mb-5" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {/* OAuth */}
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                            <button id="login-google-btn" className="auth-oauth-btn" onClick={handleGoogleLogin} disabled={loading} style={{ flex: 1 }}>
                                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" width={17} height={17} />
                                Google
                            </button>
                            <button id="login-github-btn" className="auth-oauth-btn" onClick={handleGithubLogin} disabled={loading} style={{ flex: 1 }}>
                                <Github size={16} />
                                GitHub
                            </button>
                        </div>

                        <div className="auth-divider">
                            <span>or sign in with email</span>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="auth-field">
                                <label htmlFor="login-email" className="auth-label">Email</label>
                                <input
                                    id="login-email"
                                    type="email"
                                    className="auth-input"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                    autoComplete="email"
                                    disabled={loading}
                                />
                            </div>

                            <div className="auth-field">
                                <label htmlFor="login-password" className="auth-label">Password</label>
                                <div className="auth-pw-wrap">
                                    <input
                                        id="login-password"
                                        type={showPassword ? "text" : "password"}
                                        className="auth-input"
                                        style={{ paddingRight: '40px' }}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        required
                                        autoComplete="current-password"
                                        disabled={loading}
                                    />
                                    <button type="button" className="auth-pw-toggle" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <Link to="/forgot-password" className="auth-forgot">Forgot password?</Link>
                                <div style={{ clear: 'both' }} />
                            </div>

                            <button id="login-submit-btn" type="submit" className="auth-submit-btn" disabled={loading}>
                                {loading
                                    ? <><Loader2 className="inline mr-2 h-4 w-4 animate-spin" />Signing in…</>
                                    : 'Sign in'
                                }
                            </button>
                        </form>

                        <p className="auth-footer-link">
                            Don't have an account? <Link to="/register">Create one</Link>
                        </p>
                        <Link to="/" className="auth-back-link">← Back to home</Link>
                    </div>
                </div>
            </div>
        </>
    )
}
