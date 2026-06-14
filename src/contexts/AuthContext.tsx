import {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useRef,
} from 'react'
import type { ReactNode } from 'react'
import type { User } from 'firebase/auth'
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    GithubAuthProvider,
    signInWithPopup,
    updateProfile,
} from 'firebase/auth'
import {
    doc,
    setDoc,
    getDoc,
    serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import {
    validateFormData,
    userValidationSchema,
    validatePassword,
} from '@/lib/validation'
import { useFCM } from '@/hooks/useFCM'
import {
    unregisterFCMToken,
    cleanupForegroundMessaging,
} from '@/services/fcmService'
import { trackSessionStart } from '@/services/analyticsService'

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface AuthContextType {
    user: User | null
    loading: boolean
    login: (email: string, password: string) => Promise<void>
    register: (
        email: string,
        password: string,
        userData: UserData
    ) => Promise<void>
    logout: () => Promise<void>
    loginWithGoogle: () => Promise<void>
    loginWithGithub: () => Promise<void>
    refreshUser: () => Promise<void>
}

interface UserData {
    firstName: string
    lastName: string
    discipline: string
    role: string
    skills?: string
    bio?: string
}

// ─────────────────────────────────────────────────────────
// Session constants
// ─────────────────────────────────────────────────────────

const SESSION_TIMEOUT = 12 * 60 * 60 * 1000       // 12 hours
const SESSION_EXTENSION_CHECK = 5 * 60 * 1000     // 5 minutes

// ─────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

// ─────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────

interface AuthProviderProps {
    children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    // Session timer refs (not state — avoid re-renders)
    const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lastActivityRef = useRef<number>(Date.now())

    // ─── FCM Integration ──────────────────────────────────
    // ✅ useFCM is called here with the current user's UID.
    // It handles:
    //   - Token registration on login
    //   - Foreground message listener
    //   - Token refresh
    //   - Cleanup on logout
    const { handleLogout: fcmLogout } = useFCM({
        userId: user?.uid ?? null,
    })

    // ─── Session Management ───────────────────────────────

    const extendSession = useCallback(async (uid: string) => {
        try {
            await setDoc(
                doc(db, 'users', uid),
                {
                    lastActivity: serverTimestamp(),
                    sessionExtended: serverTimestamp(),
                },
                { merge: true }
            )
        } catch (error) {
            console.error('Failed to extend session:', error)
        }
    }, [])

    const clearSessionTimer = useCallback(() => {
        if (sessionTimerRef.current) {
            clearTimeout(sessionTimerRef.current)
            sessionTimerRef.current = null
        }
    }, [])

    const resetSessionTimer = useCallback(
        (uid: string) => {
            clearSessionTimer()
            sessionTimerRef.current = setTimeout(() => {
                const timeSinceActivity =
                    Date.now() - lastActivityRef.current
                if (timeSinceActivity < SESSION_TIMEOUT) {
                    extendSession(uid)
                    resetSessionTimer(uid)
                }
            }, SESSION_TIMEOUT)
        },
        [clearSessionTimer, extendSession]
    )

    const updateActivity = useCallback(() => {
        lastActivityRef.current = Date.now()
    }, [])

    // ─── Auth State Observer ──────────────────────────────

    useEffect(() => {
        let mounted = true

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!mounted) return

            try {
                if (firebaseUser) {
                    const userDocRef = doc(db, 'users', firebaseUser.uid)
                    const userDoc = await getDoc(userDocRef)

                    if (!userDoc.exists()) {
                        // Create minimal user document for OAuth users
                        const isSohail = firebaseUser.email?.toLowerCase() === 'mohd26sohail@gmail.com'
                        await setDoc(userDocRef, {
                            uid: firebaseUser.uid,
                            email: firebaseUser.email,
                            displayName: firebaseUser.displayName,
                            photoURL: firebaseUser.photoURL,
                            createdAt: serverTimestamp(),
                            lastLogin: serverTimestamp(),
                            lastActivity: serverTimestamp(),
                            sessionExtended: serverTimestamp(),
                            firstName: '',
                            lastName: '',
                            discipline: '',
                            role: isSohail ? 'admin' : '',
                            skills: [],
                            bio: '',
                            activated: false,
                            lastCollaboratedAt: null,
                        })
                    } else {
                        const isSohail = firebaseUser.email?.toLowerCase() === 'mohd26sohail@gmail.com'
                        await setDoc(
                            userDocRef,
                            {
                                lastLogin: serverTimestamp(),
                                lastActivity: serverTimestamp(),
                                sessionExtended: serverTimestamp(),
                                ...(isSohail && userDoc.data()?.role !== 'admin' ? { role: 'admin' } : {})
                            },
                            { merge: true }
                        )
                    }


                    // Track session start for retention analytics
                    trackSessionStart(firebaseUser.uid)
                    resetSessionTimer(firebaseUser.uid)
                } else {
                    clearSessionTimer()
                }

                setUser(firebaseUser)
            } catch (error) {
                console.error('Auth state change error:', error)
                setUser(null)
            } finally {
                if (mounted) setLoading(false)
            }
        })

        // Activity tracking
        const activityEvents = [
            'mousedown',
            'mousemove',
            'keypress',
            'scroll',
            'touchstart',
            'click',
        ]
        const handleActivity = () => updateActivity()
        activityEvents.forEach(evt =>
            document.addEventListener(evt, handleActivity, true)
        )

        // Periodic activity heartbeat
        const activityInterval = setInterval(() => {
            updateActivity()
        }, SESSION_EXTENSION_CHECK)

        return () => {
            mounted = false
            unsubscribe()
            clearSessionTimer()
            clearInterval(activityInterval)
            activityEvents.forEach(evt =>
                document.removeEventListener(evt, handleActivity, true)
            )
        }
    }, [resetSessionTimer, clearSessionTimer, updateActivity])

    // ─── Auth Methods ─────────────────────────────────────

    const register = async (
        email: string,
        password: string,
        userData: UserData
    ) => {
        try {
            // NOTE: do NOT call setLoading(true) here — it unmounts children
            // and destroys component state (e.g. showWelcome in Register.tsx).
            // Loading state is managed solely by onAuthStateChanged.

            const validation = validateFormData(
                { ...userData, email },
                { ...userValidationSchema, email: userValidationSchema.email }
            )
            if (!validation.isValid) {
                const msgs = Object.values(validation.errors).join(', ')
                throw new Error(`Validation failed: ${msgs}`)
            }

            const passwordValidation = validatePassword(password)
            if (!passwordValidation.isValid) {
                throw new Error(
                    `Password validation failed: ${passwordValidation.errors.join(', ')}`
                )
            }

            const userCredential = await createUserWithEmailAndPassword(
                auth,
                email,
                password
            )
            const newUser = userCredential.user

            await updateProfile(newUser, {
                displayName: `${validation.sanitizedData.firstName} ${validation.sanitizedData.lastName}`,
            })

            await setDoc(doc(db, 'users', newUser.uid), {
                uid: newUser.uid,
                email: newUser.email,
                firstName: validation.sanitizedData.firstName,
                lastName: validation.sanitizedData.lastName,
                displayName: `${validation.sanitizedData.firstName} ${validation.sanitizedData.lastName}`,
                discipline: validation.sanitizedData.discipline,
                role: email?.toLowerCase() === 'mohd26sohail@gmail.com' ? 'admin' : validation.sanitizedData.role,
                skills: validation.sanitizedData.skills

                    ? validation.sanitizedData.skills
                          .split(',')
                          .map((s: string) => s.trim())
                          .filter(Boolean)
                    : [],
                bio: validation.sanitizedData.bio || '',
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp(),
                lastActivity: serverTimestamp(),
                sessionExtended: serverTimestamp(),
                photoURL: newUser.photoURL || null,
                emailVerified: newUser.emailVerified,
                disabled: false,
                loginAttempts: 0,
                lastLoginAttempt: null,
                activated: false,
                lastCollaboratedAt: null,
            })

            console.log('✅ User registered successfully:', newUser.uid)
        } catch (error: any) {
            console.error('❌ Registration error:', error)
            throw new Error(getAuthErrorMessage(error.code || error.message))
        }
    }

    const login = async (email: string, password: string) => {
        try {
            // NOTE: do NOT call setLoading(true) here — it unmounts children.
            // Loading state is managed solely by onAuthStateChanged.

            if (!email || !password) {
                throw new Error('Email and password are required')
            }

            const userCredential = await signInWithEmailAndPassword(
                auth,
                email,
                password
            )
            const loggedInUser = userCredential.user

            const userDoc = await getDoc(doc(db, 'users', loggedInUser.uid))
            if (userDoc.exists() && userDoc.data().disabled) {
                await firebaseSignOut(auth)
                throw new Error(
                    'Account has been disabled. Please contact support.'
                )
            }

            await setDoc(
                doc(db, 'users', loggedInUser.uid),
                {
                    lastLogin: serverTimestamp(),
                    lastActivity: serverTimestamp(),
                    sessionExtended: serverTimestamp(),
                    loginAttempts: 0,
                    lastLoginAttempt: null,
                },
                { merge: true }
            )

            console.log('✅ User logged in successfully:', loggedInUser.uid)
        } catch (error: any) {
            console.error('❌ Login error:', error)
            throw new Error(getAuthErrorMessage(error.code))
        }
    }

    const loginWithGoogle = async () => {
        try {
            // NOTE: do NOT call setLoading(true) here — it unmounts children.
            const provider = new GoogleAuthProvider()
            provider.setCustomParameters({ prompt: 'select_account' })

            const userCredential = await signInWithPopup(auth, provider)
            const oauthUser = userCredential.user

            const userDoc = await getDoc(doc(db, 'users', oauthUser.uid))
            if (!userDoc.exists()) {
                const nameParts = oauthUser.displayName?.split(' ') || ['', '']
                const isSohail = oauthUser.email?.toLowerCase() === 'mohd26sohail@gmail.com'
                await setDoc(doc(db, 'users', oauthUser.uid), {
                    uid: oauthUser.uid,
                    email: oauthUser.email,
                    firstName: nameParts[0],
                    lastName: nameParts.slice(1).join(' '),
                    displayName: oauthUser.displayName,
                    photoURL: oauthUser.photoURL,
                    createdAt: serverTimestamp(),
                    lastLogin: serverTimestamp(),
                    lastActivity: serverTimestamp(),
                    sessionExtended: serverTimestamp(),
                    discipline: '',
                    role: isSohail ? 'admin' : '',
                    skills: [],
                    bio: '',
                    emailVerified: oauthUser.emailVerified,
                    disabled: false,
                    loginAttempts: 0,
                    activated: false,
                    lastCollaboratedAt: null,
                })
            } else {
                if (userDoc.data().disabled) {
                    await firebaseSignOut(auth)
                    throw new Error(
                        'Account has been disabled. Please contact support.'
                    )
                }
                await setDoc(
                    doc(db, 'users', oauthUser.uid),
                    {
                        lastLogin: serverTimestamp(),
                        lastActivity: serverTimestamp(),
                        sessionExtended: serverTimestamp(),
                        loginAttempts: 0,
                    },
                    { merge: true }
                )
            }

            console.log('✅ Google login:', oauthUser.uid)
        } catch (error: any) {
            console.error('❌ Google login error:', error)
            throw new Error(getAuthErrorMessage(error.code))
        }
    }

    const loginWithGithub = async () => {
        try {
            // NOTE: do NOT call setLoading(true) here — it unmounts children.
            const provider = new GithubAuthProvider()
            provider.setCustomParameters({ allow_signup: 'true' })

            const userCredential = await signInWithPopup(auth, provider)
            const oauthUser = userCredential.user

            const userDoc = await getDoc(doc(db, 'users', oauthUser.uid))
            if (!userDoc.exists()) {
                const nameParts = oauthUser.displayName?.split(' ') || ['', '']
                const isSohail = oauthUser.email?.toLowerCase() === 'mohd26sohail@gmail.com'
                await setDoc(doc(db, 'users', oauthUser.uid), {
                    uid: oauthUser.uid,
                    email: oauthUser.email,
                    firstName: nameParts[0],
                    lastName: nameParts.slice(1).join(' '),
                    displayName: oauthUser.displayName,
                    photoURL: oauthUser.photoURL,
                    createdAt: serverTimestamp(),
                    lastLogin: serverTimestamp(),
                    lastActivity: serverTimestamp(),
                    sessionExtended: serverTimestamp(),
                    discipline: '',
                    role: isSohail ? 'admin' : '',
                    skills: [],
                    bio: '',
                    emailVerified: oauthUser.emailVerified,
                    disabled: false,
                    loginAttempts: 0,
                    activated: false,
                    lastCollaboratedAt: null,
                })
            } else {
                if (userDoc.data().disabled) {
                    await firebaseSignOut(auth)
                    throw new Error(
                        'Account has been disabled. Please contact support.'
                    )
                }
                await setDoc(
                    doc(db, 'users', oauthUser.uid),
                    {
                        lastLogin: serverTimestamp(),
                        lastActivity: serverTimestamp(),
                        sessionExtended: serverTimestamp(),
                        loginAttempts: 0,
                    },
                    { merge: true }
                )
            }

            console.log('✅ GitHub login:', oauthUser.uid)
        } catch (error: any) {
            console.error('❌ GitHub login error:', error)
            throw new Error(getAuthErrorMessage(error.code))
        }
    }

    const logout = async () => {
        try {
            clearSessionTimer()

            // ✅ Unregister FCM token BEFORE signing out
            // (we need user.uid — after sign out it's gone)
            if (user?.uid) {
                try {
                    await fcmLogout()
                } catch (fcmError) {
                    // Don't block logout if FCM cleanup fails
                    console.error('FCM cleanup error (non-blocking):', fcmError)
                }
            }

            await firebaseSignOut(auth)
            console.log('✅ User logged out successfully')
        } catch (error: any) {
            console.error('❌ Logout error:', error)
            throw new Error('Failed to log out. Please try again.')
        }
    }

    const refreshUser = async () => {
        if (auth.currentUser) {
            await auth.currentUser.reload()
            setUser({ ...auth.currentUser })
        }
    }

    // ─── Context Value ────────────────────────────────────

    const value: AuthContextType = {
        user,
        loading,
        login,
        register,
        logout,
        loginWithGoogle,
        loginWithGithub,
        refreshUser,
    }

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    )
}

// ─────────────────────────────────────────────────────────
// Error message helper
// ─────────────────────────────────────────────────────────

function getAuthErrorMessage(errorCode: string): string {
    switch (errorCode) {
        case 'auth/email-already-in-use':
            return 'This email address is already registered. Please login instead.'
        case 'auth/invalid-email':
            return 'Invalid email address format.'
        case 'auth/operation-not-allowed':
            return 'This sign-in method is not enabled. Please contact support.'
        case 'auth/weak-password':
            return 'Password is too weak. Please use at least 8 characters with numbers and special characters.'
        case 'auth/user-disabled':
            return 'This account has been disabled. Please contact support.'
        case 'auth/user-not-found':
            return 'No account found with this email address. Please register first.'
        case 'auth/wrong-password':
            return 'Incorrect password. Please try again or reset your password.'
        case 'auth/too-many-requests':
            return 'Too many unsuccessful attempts. Please try again later.'
        case 'auth/network-request-failed':
            return 'Network error. Please check your internet connection.'
        case 'auth/popup-closed-by-user':
            return 'Sign-in popup was closed. Please try again.'
        case 'auth/cancelled-popup-request':
            return 'Only one popup request is allowed at a time.'
        default:
            return 'An error occurred. Please try again.'
    }
}