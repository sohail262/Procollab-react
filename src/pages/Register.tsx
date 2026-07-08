import { useState, useEffect } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Logo } from "@/components/layout/Logo"
import { useAuth } from "@/contexts/AuthContext"
import { auth } from "@/lib/firebase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, Loader2, Github, CheckCircle2 } from "lucide-react"
import { WelcomeScreen } from "@/components/WelcomeScreen"
import { trackSignupStarted, trackSignupCompleted } from "@/services/analyticsService"

export function Register() {
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
        discipline: "",
        role: "",
        skills: "",
        bio: "",
        terms: false
    })
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const [passwordStrength, setPasswordStrength] = useState<"weak" | "medium" | "strong" | null>(null)
    const [showWelcome, setShowWelcome] = useState(false)
    const [welcomeName, setWelcomeName] = useState("")

    const { register, loginWithGoogle, loginWithGithub } = useAuth()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()   // ← ADD THIS

    // Track signup funnel entry
    useEffect(() => { trackSignupStarted('email') }, [])

    // ── helper: where to go after successful auth ─────────────────────────
    const getRedirectPath = () => {
        const redirect = searchParams.get('redirect')
        return redirect ? decodeURIComponent(redirect) : '/dashboard'
    }

    // ── Save redirect to sessionStorage before OAuth wipes the URL ────────
    // Google/GitHub OAuth causes a full page redirect which loses ?redirect=
    const saveRedirectBeforeOAuth = () => {
        const redirect = searchParams.get('redirect')
        if (redirect) {
            sessionStorage.setItem('authRedirect', decodeURIComponent(redirect))
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target
        const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined
        setFormData(prev => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value
        }))
        if (name === "password") checkPasswordStrength(value)
    }

    const checkPasswordStrength = (password: string) => {
        if (password.length < 8) {
            setPasswordStrength("weak")
        } else if (password.length >= 8 && /[0-9]/.test(password) && /[!@#$%^&*]/.test(password)) {
            setPasswordStrength("strong")
        } else {
            setPasswordStrength("medium")
        }
    }

    const validateForm = (): boolean => {
        if (!formData.firstName || !formData.lastName) {
            setError("Please enter your full name"); return false
        }
        if (!formData.email) {
            setError("Please enter your email address"); return false
        }
        if (formData.password.length < 8) {
            setError("Password must be at least 8 characters long"); return false
        }
        if (!/[0-9]/.test(formData.password) || !/[!@#$%^&*]/.test(formData.password)) {
            setError("Password must contain at least one number and one special character"); return false
        }
        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match"); return false
        }
        if (!formData.discipline) {
            setError("Please select your primary discipline"); return false
        }
        if (!formData.role) {
            setError("Please select your role"); return false
        }
        if (!formData.terms) {
            setError("Please accept the Terms of Service and Privacy Policy"); return false
        }
        return true
    }

    // ── Email/password register ───────────────────────────────────────────
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError("")
        if (!validateForm()) return
        setLoading(true)
        try {
            await register(formData.email, formData.password, {
                firstName:  formData.firstName,
                lastName:   formData.lastName,
                discipline: formData.discipline,
                role:       formData.role,
                skills:     formData.skills,
                bio:        formData.bio
            })
            if (auth.currentUser) {
                trackSignupCompleted(auth.currentUser.uid, 'email', {
                    discipline: formData.discipline,
                    role: formData.role,
                })
            }
            // Show welcome screen instead of immediately redirecting
            setWelcomeName(formData.firstName)
            setShowWelcome(true)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // Helper: extract first name from Firebase currentUser after OAuth
    const getOAuthFirstName = () => {
        const displayName = auth.currentUser?.displayName || ''
        return displayName.split(' ')[0] || ''
    }

    // ── Google register ───────────────────────────────────────────────────
    const handleGoogleRegister = async () => {
        setError("")
        setLoading(true)
        saveRedirectBeforeOAuth()
        try {
            await loginWithGoogle()
            sessionStorage.removeItem('authRedirect')
            if (auth.currentUser) trackSignupCompleted(auth.currentUser.uid, 'google')
            setWelcomeName(getOAuthFirstName())
            setShowWelcome(true)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // ── GitHub register ───────────────────────────────────────────────────
    const handleGithubRegister = async () => {
        setError("")
        setLoading(true)
        saveRedirectBeforeOAuth()
        try {
            await loginWithGithub()
            sessionStorage.removeItem('authRedirect')
            if (auth.currentUser) trackSignupCompleted(auth.currentUser.uid, 'github')
            setWelcomeName(getOAuthFirstName())
            setShowWelcome(true)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // Show welcome interlude after successful registration
    if (showWelcome) {
        return (
            <WelcomeScreen
                firstName={welcomeName || undefined}
                redirectTo={getRedirectPath()}
            />
        )
    }

    return (
        <div style={{ position: 'relative', minHeight: '100vh', background: '#080a0e' }}>
            <style>{`
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
                    outline: none;
                }
                .auth-input:focus {
                    background: rgba(255,255,255,0.06) !important;
                    border-color: rgba(99,102,241,0.45) !important;
                    outline: none;
                    box-shadow: 0 0 0 3px rgba(99,102,241,0.1) !important;
                }
                .auth-input::placeholder { color: rgba(255,255,255,0.22) !important; }

                .auth-textarea {
                    width: 100%;
                    padding: 12px 14px;
                    background: rgba(255,255,255,0.04) !important;
                    border: 1px solid rgba(255,255,255,0.09) !important;
                    border-radius: 9px !important;
                    color: #fff !important;
                    font-size: 14px;
                    transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
                    box-sizing: border-box;
                    outline: none;
                    resize: vertical;
                }
                .auth-textarea:focus {
                    background: rgba(255,255,255,0.06) !important;
                    border-color: rgba(99,102,241,0.45) !important;
                    outline: none;
                    box-shadow: 0 0 0 3px rgba(99,102,241,0.1) !important;
                }
                .auth-textarea::placeholder { color: rgba(255,255,255,0.22) !important; }

                .auth-select {
                    width: 100%;
                    height: 44px;
                    padding: 0 12px;
                    background: rgba(255,255,255,0.04) !important;
                    border: 1px solid rgba(255,255,255,0.09) !important;
                    border-radius: 9px !important;
                    color: rgba(255,255,255,0.8) !important;
                    font-size: 14px;
                    transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
                    box-sizing: border-box;
                    outline: none;
                    appearance: none;
                    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba%28255%2C255%2C255%2C0.4%29' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e") !important;
                    background-repeat: no-repeat !important;
                    background-position: right 12px center !important;
                    background-size: 16px !important;
                }
                .auth-select:focus {
                    background: rgba(255,255,255,0.06) !important;
                    border-color: rgba(99,102,241,0.45) !important;
                    outline: none;
                    box-shadow: 0 0 0 3px rgba(99,102,241,0.1) !important;
                }
                .auth-select option {
                    background: #0f1117;
                    color: #fff;
                }

                .auth-checkbox {
                    accent-color: #6366f1;
                    width: 15px;
                    height: 15px;
                    cursor: pointer;
                    margin-top: 3px;
                }

                .auth-oauth-btn {
                    flex: 1;
                    height: 44px;
                    background: rgba(255,255,255,0.04) !important;
                    border: 1px solid rgba(255,255,255,0.09) !important;
                    color: rgba(255,255,255,0.7) !important;
                    font-size: 13px !important;
                    border-radius: 9px !important;
                    transition: background 0.2s ease, border-color 0.2s ease, transform 0.1s ease;
                    display: flex; align-items: center; justify-content: center; gap: 8px;
                    cursor: pointer;
                }
                .auth-oauth-btn:hover {
                    background: rgba(255,255,255,0.08) !important;
                    border-color: rgba(255,255,255,0.15) !important;
                }
                .auth-oauth-btn:active {
                    transform: scale(0.98);
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
                    display: flex; align-items: center; justify-content: center;
                }
                .auth-submit-btn:hover { opacity: 0.92; transform: translateY(-1px); }
                .auth-submit-btn:active { transform: translateY(0); }
                .auth-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

                .auth-pw-wrap { position: relative; }
                .auth-pw-toggle {
                    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
                    background: none; border: none; cursor: pointer;
                    color: rgba(255,255,255,0.3); padding: 0;
                    transition: color 0.2s; line-height: 1;
                    display: flex; align-items: center; justify-content: center;
                }
                .auth-pw-toggle:hover { color: rgba(255,255,255,0.55); }

                .auth-label {
                    display: block;
                    font-size: 11px; font-weight: 500;
                    letter-spacing: 0.05em;
                    color: rgba(255,255,255,0.5);
                    margin-bottom: 7px;
                    text-transform: uppercase;
                }
            `}</style>

            {/* Premium dark background — same atmosphere as WelcomeScreen */}
            <div aria-hidden="true" style={{
                position: 'fixed', inset: 0, pointerEvents: 'none',
                background: 'radial-gradient(ellipse 70% 55% at 10% 70%, rgba(59,130,246,0.09) 0%, transparent 65%), radial-gradient(ellipse 50% 60% at 90% 20%, rgba(99,102,241,0.07) 0%, transparent 65%), radial-gradient(ellipse 80% 40% at 50% 110%, rgba(16,185,129,0.04) 0%, transparent 65%)'
            }} />
            <div aria-hidden="true" style={{
                position: 'fixed', inset: 0, pointerEvents: 'none',
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
                backgroundSize: '52px 52px'
            }} />
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', minHeight: '100vh', padding: '40px 16px' }}>
                <Card className="w-full max-w-3xl" style={{
                    background: 'rgba(12, 14, 20, 0.94)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    boxShadow: '0 0 0 1px rgba(99,102,241,0.08), 0 24px 64px rgba(0,0,0,0.55), 0 0 80px rgba(59,130,246,0.05)',
                    backdropFilter: 'blur(24px)',
                }}>
                    <CardHeader className="space-y-1 rounded-t-2xl" style={{
                        position: 'relative', overflow: 'hidden',
                        background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(99,102,241,0.12) 100%)',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        padding: '28px 28px 22px',
                    }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.7), rgba(59,130,246,0.5), transparent)' }} />
                        <CardTitle className="text-2xl md:text-3xl font-bold text-center" style={{ color: '#fff', letterSpacing: '-0.02em' }}>Create Your Account</CardTitle>
                        <CardDescription className="text-center" style={{ color: 'rgba(255,255,255,0.45)' }}>
                            Join our community of innovators and collaborators
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 pb-8 px-6" style={{ color: 'rgba(255,255,255,0.85)' }}>
                        {error && (
                            <Alert variant="destructive" className="mb-6" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label htmlFor="firstName" className="auth-label">
                                        First Name *
                                    </label>
                                    <input
                                        id="firstName"
                                        name="firstName"
                                        type="text"
                                        value={formData.firstName}
                                        onChange={handleChange}
                                        required
                                        disabled={loading}
                                        className="auth-input"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="lastName" className="auth-label">
                                        Last Name *
                                    </label>
                                    <input
                                        id="lastName"
                                        name="lastName"
                                        type="text"
                                        value={formData.lastName}
                                        onChange={handleChange}
                                        required
                                        disabled={loading}
                                        className="auth-input"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="email" className="auth-label">
                                    Email Address *
                                </label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    autoComplete="email"
                                    disabled={loading}
                                    className="auth-input"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label htmlFor="password" className="auth-label">
                                        Password *
                                    </label>
                                    <div className="auth-pw-wrap">
                                        <input
                                            id="password"
                                            name="password"
                                            type={showPassword ? "text" : "password"}
                                            placeholder="••••••••"
                                            value={formData.password}
                                            onChange={handleChange}
                                            required
                                            autoComplete="new-password"
                                            disabled={loading}
                                            className="auth-input"
                                            style={{ paddingRight: '40px' }}
                                        />
                                        <button type="button" className="auth-pw-toggle" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    {passwordStrength && (
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className={`h-1 flex-1 rounded ${passwordStrength === "weak" ? "bg-red-500" : passwordStrength === "medium" ? "bg-yellow-500" : "bg-green-500"}`}></div>
                                            <span className={`text-xs ${passwordStrength === "weak" ? "text-red-500" : passwordStrength === "medium" ? "text-yellow-500" : "text-green-500"}`}>
                                                {passwordStrength === "weak" ? "Weak" : passwordStrength === "medium" ? "Medium" : "Strong"}
                                            </span>
                                        </div>
                                    )}
                                    <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                                        Must be at least 8 characters with a number and special character
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="confirmPassword" className="auth-label">
                                        Confirm Password *
                                    </label>
                                    <div className="auth-pw-wrap">
                                        <input
                                            id="confirmPassword"
                                            name="confirmPassword"
                                            type={showConfirmPassword ? "text" : "password"}
                                            placeholder="••••••••"
                                            value={formData.confirmPassword}
                                            onChange={handleChange}
                                            required
                                            autoComplete="new-password"
                                            disabled={loading}
                                            className="auth-input"
                                            style={{ paddingRight: '40px' }}
                                        />
                                        <button type="button" className="auth-pw-toggle" onClick={() => setShowConfirmPassword(v => !v)} tabIndex={-1}>
                                            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label htmlFor="discipline" className="auth-label">
                                        Primary Discipline *
                                    </label>
                                    <select
                                        id="discipline"
                                        name="discipline"
                                        value={formData.discipline}
                                        onChange={handleChange}
                                        required
                                        disabled={loading}
                                        className="auth-select"
                                    >
                                        <option value="">Select your discipline</option>
                                        <option value="computer-science">Computer Science</option>
                                        <option value="engineering">Engineering</option>
                                        <option value="medicine">Medicine & Health Sciences</option>
                                        <option value="business">Business & Economics</option>
                                        <option value="arts">Arts & Humanities</option>
                                        <option value="social-sciences">Social Sciences</option>
                                        <option value="natural-sciences">Natural Sciences</option>
                                        <option value="education">Education</option>
                                        <option value="law">Law</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="role" className="auth-label">
                                        Role *
                                    </label>
                                    <select
                                        id="role"
                                        name="role"
                                        value={formData.role}
                                        onChange={handleChange}
                                        required
                                        disabled={loading}
                                        className="auth-select"
                                    >
                                        <option value="">Select your role</option>
                                        <option value="student">Student</option>
                                        <option value="researcher">Researcher</option>
                                        <option value="professional">Professional</option>
                                        <option value="educator">Educator</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="skills" className="auth-label">
                                    Skills (comma separated)
                                </label>
                                <input
                                    id="skills"
                                    name="skills"
                                    type="text"
                                    placeholder="e.g., Python, Data Analysis, Project Management"
                                    value={formData.skills}
                                    onChange={handleChange}
                                    disabled={loading}
                                    className="auth-input"
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="bio" className="auth-label">
                                    Short Bio
                                </label>
                                <textarea
                                    id="bio"
                                    name="bio"
                                    rows={3}
                                    placeholder="Tell us a bit about yourself..."
                                    value={formData.bio}
                                    onChange={handleChange}
                                    disabled={loading}
                                    className="auth-textarea"
                                />
                            </div>

                            <div className="flex items-start space-x-2">
                                <input
                                    type="checkbox"
                                    id="terms"
                                    name="terms"
                                    checked={formData.terms}
                                    onChange={handleChange}
                                    required
                                    disabled={loading}
                                    className="auth-checkbox"
                                />
                                <label htmlFor="terms" className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                                    I agree to the{" "}
                                    <Link to="/terms" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                                        Terms of Service
                                    </Link>{" "}
                                    and{" "}
                                    <Link to="/privacy" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                                        Privacy Policy
                                    </Link>
                                </label>
                            </div>

                            <button id="register-submit-btn" type="submit" className="auth-submit-btn" disabled={loading}>
                                {loading ? (
                                    <><Loader2 className="inline mr-2 h-4 w-4 animate-spin" />Creating Account…</>
                                ) : (
                                    <><CheckCircle2 className="inline mr-2 h-4 w-4" />Create Account</>
                                )}
                            </button>
                        </form>

                        <div className="relative my-6" style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
                            <span style={{ padding: '0 14px', fontSize: '11px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                                Or register with
                            </span>
                            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={handleGoogleRegister}
                                disabled={loading}
                                className="auth-oauth-btn"
                            >
                                <img
                                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                                    alt="Google"
                                    style={{ width: '17px', height: '17px' }}
                                />
                                Google
                            </button>
                            <button
                                type="button"
                                onClick={handleGithubRegister}
                                disabled={loading}
                                className="auth-oauth-btn"
                            >
                                <Github size={16} />
                                GitHub
                            </button>
                        </div>

                        <div className="mt-6 text-center text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            Already have an account?{" "}
                            <Link to="/login" style={{ color: 'rgba(99,102,241,0.9)', fontWeight: 500 }}>
                                Sign in
                            </Link>
                        </div>

                        <div className="mt-3 text-center">
                            <Link to="/" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.22)' }}>
                                ← Back to Home
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}