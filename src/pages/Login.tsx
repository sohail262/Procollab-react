import { useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate, useSearchParams, Navigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, Loader2, Github } from "lucide-react"

export function Login() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    const { login, loginWithGoogle, loginWithGithub, user, loading: authLoading } = useAuth()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()

    // Already logged in — send to dashboard
    if (!authLoading && user) {
        const redirect = searchParams.get('redirect') || '/dashboard'
        return <Navigate to={redirect} replace />
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError("")
        setLoading(true)

        try {
            await login(email, password)
            const redirect = searchParams.get('redirect') || '/dashboard'
            navigate(redirect)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleLogin = async () => {
        setError("")
        setLoading(true)
        try {
            await loginWithGoogle()
            const redirect = searchParams.get('redirect') || '/dashboard'
            navigate(redirect)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleGithubLogin = async () => {
        setError("")
        setLoading(true)
        try {
            await loginWithGithub()
            const redirect = searchParams.get('redirect') || '/dashboard'
            navigate(redirect)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-950 dark:to-indigo-950 px-4 py-12">
            <Card className="w-full max-w-md shadow-2xl border-2">
                <CardHeader className="space-y-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
                    <CardTitle className="text-2xl md:text-3xl font-bold text-center">Welcome Back</CardTitle>
                    <CardDescription className="text-blue-100 text-center">
                        Login to your account to continue
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 pb-8 px-6">
                    {error && (
                        <Alert variant="destructive" className="mb-6">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Email Address
                            </label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                                className="h-11"
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Password
                            </label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                    className="h-11 pr-10"
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                            <div className="text-right">
                                <Link to="/forgot-password" className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                                    Forgot Password?
                                </Link>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-11 text-base font-medium"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Logging in...
                                </>
                            ) : (
                                "Login"
                            )}
                        </Button>
                    </form>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-white dark:bg-gray-950 text-gray-500 dark:text-gray-400">
                                Or continue with
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="h-11"
                        >
                            <img
                                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                                alt="Google"
                                className="w-5 h-5 mr-2"
                            />
                            Google
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleGithubLogin}
                            disabled={loading}
                            className="h-11"
                        >
                            <Github className="w-5 h-5 mr-2" />
                            GitHub
                        </Button>
                    </div>

                    <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
                        Don't have an account?{" "}
                        <Link to="/register" className="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                            Register here
                        </Link>
                    </div>

                    <div className="mt-6 text-center">
                        <Link to="/" className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
                            ← Back to Home
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
