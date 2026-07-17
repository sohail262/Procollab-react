import { useState } from "react"
import { SEOHead } from "@/components/seo/SEOHead"
import type { FormEvent } from "react"
import { Link } from "react-router-dom"
import { Logo } from "@/components/layout/Logo"
import { useAuth } from "@/contexts/AuthContext"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from "lucide-react"

export function ForgotPassword() {
    const [email, setEmail] = useState("")
    const [error, setError] = useState("")
    const [success, setSuccess] = useState(false)
    const [loading, setLoading] = useState(false)

    const { sendPasswordReset } = useAuth()

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError("")
        setSuccess(false)
        setLoading(true)
        try {
            await sendPasswordReset(email)
            setSuccess(true)
            setEmail("")
        } catch (err: any) {
            setError(err.message || "Failed to send password reset email. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <SEOHead
                title="Reset Password | ProCollab"
                description="Reset your ProCollab password to regain access to your student project collaboration dashboard."
                keywords={['reset password', 'forgot password', 'recover account', 'ProCollab']}
                canonical="https://procollab.in/forgot-password"
            />
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
                    background-size: 32px 32px;
                    mask-image: radial-gradient(circle at 50% 50%, black, transparent 80%);
                }
                .auth-page {
                    min-height: 100vh; display: flex; align-items: center; justify-content: center;
                    position: relative; z-index: 10; padding: 20px; box-sizing: border-box;
                    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                }
                .auth-card {
                    width: 100%; max-width: 440px; background: rgba(13, 17, 24, 0.7);
                    border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px;
                    backdrop-filter: blur(16px); box-shadow: 0 20px 40px rgba(0,0,0,0.4);
                    overflow: hidden;
                }
                .auth-card-header {
                    padding: 40px 40px 20px; text-align: center;
                    border-bottom: 1px solid rgba(255,255,255,0.02);
                }
                .auth-brand {
                    display: inline-flex; align-items: center; justify-content: center;
                    margin-bottom: 24px;
                }
                .auth-title {
                    font-size: 24px; font-weight: 700; color: #f4f4f5; margin: 0 0 8px 0; letter-spacing: -0.02em;
                }
                .auth-subtitle {
                    font-size: 14px; color: rgba(255,255,255,0.45); margin: 0; line-height: 1.5;
                }
                .auth-card-body {
                    padding: 32px 40px 40px;
                }
                .auth-field {
                    margin-bottom: 24px;
                }
                .auth-label {
                    display: block; font-size: 13px; font-weight: 550; color: rgba(255,255,255,0.7); margin-bottom: 8px;
                }
                .auth-input {
                    width: 100%; height: 42px; background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px;
                    color: #fff; padding: 0 14px; font-size: 14px; box-sizing: border-box;
                    transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
                }
                .auth-input:focus {
                    outline: none; background: rgba(255,255,255,0.05);
                    border-color: rgba(99, 102, 241, 0.6);
                    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
                }
                .auth-input::placeholder { color: rgba(255,255,255,0.25); }
                .auth-submit-btn {
                    width: 100%; height: 42px; background: #4f46e5; color: #fff; border: none;
                    border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
                    margin-top: 10px;
                }
                .auth-submit-btn:hover:not(:disabled) { background: #4338ca; }
                .auth-submit-btn:active:not(:disabled) { transform: scale(0.96); }
                .auth-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .auth-back-link {
                    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
                    font-size: 13px; color: rgba(255,255,255,0.45); text-decoration: none;
                    margin-top: 24px; transition: color 0.2s; width: 100%;
                }
                .auth-back-link:hover { color: #f4f4f5; }
                @media (max-width: 480px) {
                    .auth-card-header { padding: 32px 20px 20px; }
                    .auth-card-body  { padding: 24px 20px 32px; }
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
                            <Logo iconSize={32} showText={true} textColor="text-zinc-300" />
                        </div>
                        <h1 className="auth-title">Reset password</h1>
                        <p className="auth-subtitle">
                            Enter the email address associated with your account and we'll send you a link to reset your password.
                        </p>
                    </div>

                    {/* Body */}
                    <div className="auth-card-body">
                        {error && (
                            <Alert variant="destructive" className="mb-5" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {success && (
                            <Alert className="mb-5" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#a7f3d0' }}>
                                <div className="flex gap-2 items-start">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                                    <AlertDescription>
                                        We have sent a password reset link to your email. Please check your inbox (and spam folder).
                                    </AlertDescription>
                                </div>
                            </Alert>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div className="auth-field">
                                <label htmlFor="reset-email" className="auth-label">Email Address</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        id="reset-email"
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
                            </div>

                            <button type="submit" className="auth-submit-btn" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="inline mr-2 h-4 w-4 animate-spin" />
                                        Sending Reset Link…
                                    </>
                                ) : (
                                    <>
                                        <Mail className="inline mr-2 h-4 w-4" />
                                        Send Reset Link
                                    </>
                                )}
                            </button>
                        </form>

                        <Link to="/login" className="auth-back-link">
                            <ArrowLeft size={14} /> Back to sign in
                        </Link>
                    </div>
                </div>
            </div>
        </>
    )
}
