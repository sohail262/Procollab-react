import { useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, Loader2, Github, CheckCircle2 } from "lucide-react"

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

    const { register, loginWithGoogle, loginWithGithub } = useAuth()
    const navigate = useNavigate()

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target
        const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined

        setFormData(prev => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value
        }))

        // Check password strength
        if (name === "password") {
            checkPasswordStrength(value)
        }
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
            setError("Please enter your full name")
            return false
        }

        if (!formData.email) {
            setError("Please enter your email address")
            return false
        }

        if (formData.password.length < 8) {
            setError("Password must be at least 8 characters long")
            return false
        }

        if (!/[0-9]/.test(formData.password) || !/[!@#$%^&*]/.test(formData.password)) {
            setError("Password must contain at least one number and one special character")
            return false
        }

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match")
            return false
        }

        if (!formData.discipline) {
            setError("Please select your primary discipline")
            return false
        }

        if (!formData.role) {
            setError("Please select your role")
            return false
        }

        if (!formData.terms) {
            setError("Please accept the Terms of Service and Privacy Policy")
            return false
        }

        return true
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError("")

        if (!validateForm()) {
            return
        }

        setLoading(true)

        try {
            await register(formData.email, formData.password, {
                firstName: formData.firstName,
                lastName: formData.lastName,
                discipline: formData.discipline,
                role: formData.role,
                skills: formData.skills,
                bio: formData.bio
            })
            navigate('/dashboard')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleRegister = async () => {
        setError("")
        setLoading(true)
        try {
            await loginWithGoogle()
            navigate('/dashboard')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleGithubRegister = async () => {
        setError("")
        setLoading(true)
        try {
            await loginWithGithub()
            navigate('/dashboard')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-950 dark:to-indigo-950 px-4 py-12">
            <Card className="w-full max-w-3xl shadow-2xl border-2">
                <CardHeader className="space-y-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
                    <CardTitle className="text-2xl md:text-3xl font-bold text-center">Create Your Account</CardTitle>
                    <CardDescription className="text-blue-100 text-center">
                        Join our community of innovators and collaborators
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 pb-8 px-6">
                    {error && (
                        <Alert variant="destructive" className="mb-6">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label htmlFor="firstName" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    First Name *
                                </label>
                                <Input
                                    id="firstName"
                                    name="firstName"
                                    type="text"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    required
                                    disabled={loading}
                                    className="h-11"
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="lastName" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Last Name *
                                </label>
                                <Input
                                    id="lastName"
                                    name="lastName"
                                    type="text"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    required
                                    disabled={loading}
                                    className="h-11"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Email Address *
                            </label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="you@example.com"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                autoComplete="email"
                                disabled={loading}
                                className="h-11"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Password *
                                </label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                        autoComplete="new-password"
                                        disabled={loading}
                                        className="h-11 pr-10"
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
                                {passwordStrength && (
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className={`h-1 flex-1 rounded ${passwordStrength === "weak" ? "bg-red-500" : passwordStrength === "medium" ? "bg-yellow-500" : "bg-green-500"}`}></div>
                                        <span className={`text-xs ${passwordStrength === "weak" ? "text-red-500" : passwordStrength === "medium" ? "text-yellow-500" : "text-green-500"}`}>
                                            {passwordStrength === "weak" ? "Weak" : passwordStrength === "medium" ? "Medium" : "Strong"}
                                        </span>
                                    </div>
                                )}
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Must be at least 8 characters with a number and special character
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Confirm Password *
                                </label>
                                <div className="relative">
                                    <Input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type={showConfirmPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        required
                                        autoComplete="new-password"
                                        disabled={loading}
                                        className="h-11 pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                        tabIndex={-1}
                                    >
                                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label htmlFor="discipline" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Primary Discipline *
                                </label>
                                <select
                                    id="discipline"
                                    name="discipline"
                                    value={formData.discipline}
                                    onChange={handleChange}
                                    required
                                    disabled={loading}
                                    className="w-full h-11 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                <label htmlFor="role" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Role *
                                </label>
                                <select
                                    id="role"
                                    name="role"
                                    value={formData.role}
                                    onChange={handleChange}
                                    required
                                    disabled={loading}
                                    className="w-full h-11 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                            <label htmlFor="skills" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Skills (comma separated)
                            </label>
                            <Input
                                id="skills"
                                name="skills"
                                type="text"
                                placeholder="e.g., Python, Data Analysis, Project Management"
                                value={formData.skills}
                                onChange={handleChange}
                                disabled={loading}
                                className="h-11"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="bio" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Short Bio
                            </label>
                            <Textarea
                                id="bio"
                                name="bio"
                                rows={3}
                                placeholder="Tell us a bit about yourself..."
                                value={formData.bio}
                                onChange={handleChange}
                                disabled={loading}
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
                                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label htmlFor="terms" className="text-sm text-gray-700 dark:text-gray-300">
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

                        <Button
                            type="submit"
                            className="w-full h-11 text-base font-medium"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Creating Account...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="mr-2 h-5 w-5" />
                                    Create Account
                                </>
                            )}
                        </Button>
                    </form>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-white dark:bg-gray-950 text-gray-500 dark:text-gray-400">
                                Or register with
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleGoogleRegister}
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
                            onClick={handleGithubRegister}
                            disabled={loading}
                            className="h-11"
                        >
                            <Github className="w-5 h-5 mr-2" />
                            GitHub
                        </Button>
                    </div>

                    <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
                        Already have an account?{" "}
                        <Link to="/login" className="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                            Login here
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
