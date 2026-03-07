import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { User } from 'firebase/auth'
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    GithubAuthProvider,
    signInWithPopup,
    updateProfile
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { validateFormData, userValidationSchema, validatePassword } from '@/lib/validation'

interface AuthContextType {
    user: User | null
    loading: boolean
    login: (email: string, password: string) => Promise<void>
    register: (email: string, password: string, userData: UserData) => Promise<void>
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

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

interface AuthProviderProps {
    children: ReactNode
}

// Session timeout (12 hours)
const SESSION_TIMEOUT = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
const SESSION_EXTENSION_CHECK = 5 * 60 * 1000; // Check every 5 minutes for activity
let sessionTimer: number | null = null;
let lastActivityTime = Date.now();

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    // Session management with automatic extension
    const extendSession = useCallback(async () => {
        if (user) {
            try {
                // Update last activity in Firestore
                await setDoc(doc(db, 'users', user.uid), {
                    lastActivity: serverTimestamp(),
                    sessionExtended: serverTimestamp()
                }, { merge: true });
                
                console.log('✅ Session extended for 12 more hours');
            } catch (error) {
                console.error('Failed to extend session:', error);
            }
        }
    }, [user]);

    // Check if session should be extended based on user activity
    const checkSessionExtension = useCallback(() => {
        const now = Date.now();
        const timeSinceLastActivity = now - lastActivityTime;
        
        // If user was active in the last 12 hours, extend session
        if (timeSinceLastActivity < SESSION_TIMEOUT && user) {
            extendSession();
            // Reset the session timer for another 12 hours
            if (sessionTimer) {
                clearTimeout(sessionTimer);
            }
            sessionTimer = setTimeout(checkSessionExtension, SESSION_TIMEOUT);
        }
    }, [user, extendSession]);

    // Update last activity time
    const updateActivity = useCallback(() => {
        lastActivityTime = Date.now();
    }, []);

    // Reset session timer (now extends instead of logging out)
    const resetSessionTimer = useCallback(() => {
        if (sessionTimer) {
            clearTimeout(sessionTimer);
        }
        // Set timer to check for session extension after 12 hours
        sessionTimer = setTimeout(checkSessionExtension, SESSION_TIMEOUT);
        updateActivity();
    }, [checkSessionExtension, updateActivity]);

    // Clear session timer
    const clearSessionTimer = useCallback(() => {
        if (sessionTimer) {
            clearTimeout(sessionTimer);
            sessionTimer = null;
        }
    }, []);

    useEffect(() => {
        let mounted = true;
        
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!mounted) return;
            
            try {
                if (user) {
                    // Verify user document exists
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (!userDoc.exists()) {
                        console.warn('User document not found, creating...');
                        // Create minimal user document
                        await setDoc(doc(db, 'users', user.uid), {
                            uid: user.uid,
                            email: user.email,
                            displayName: user.displayName,
                            photoURL: user.photoURL,
                            createdAt: serverTimestamp(),
                            lastLogin: serverTimestamp(),
                            lastActivity: serverTimestamp(),
                            sessionExtended: serverTimestamp(),
                            firstName: '',
                            lastName: '',
                            discipline: '',
                            role: '',
                            skills: [],
                            bio: ''
                        });
                    } else {
                        // Update last login and activity
                        await setDoc(doc(db, 'users', user.uid), {
                            lastLogin: serverTimestamp(),
                            lastActivity: serverTimestamp(),
                            sessionExtended: serverTimestamp()
                        }, { merge: true });
                    }
                    
                    resetSessionTimer();
                } else {
                    clearSessionTimer();
                }
                
                setUser(user);
            } catch (error) {
                console.error('Auth state change error:', error);
                setUser(null);
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        });

        // Activity listeners to track user activity (no auto-logout, just tracking)
        const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        const handleActivity = () => {
            if (user) {
                updateActivity();
            }
        };

        activityEvents.forEach(event => {
            document.addEventListener(event, handleActivity, true);
        });

        // Periodic activity check (every 5 minutes)
        const activityCheckInterval = setInterval(() => {
            if (user) {
                updateActivity();
            }
        }, SESSION_EXTENSION_CHECK);

        return () => {
            mounted = false;
            unsubscribe();
            clearSessionTimer();
            clearInterval(activityCheckInterval);
            activityEvents.forEach(event => {
                document.removeEventListener(event, handleActivity, true);
            });
        };
    }, [user, resetSessionTimer, clearSessionTimer, updateActivity]);

    const register = async (email: string, password: string, userData: UserData) => {
        try {
            setLoading(true);
            
            // Validate input data
            const validation = validateFormData(
                { ...userData, email },
                { ...userValidationSchema, email: userValidationSchema.email }
            );
            
            if (!validation.isValid) {
                const errorMessages = Object.values(validation.errors).join(', ');
                throw new Error(`Validation failed: ${errorMessages}`);
            }
            
            // Validate password
            const passwordValidation = validatePassword(password);
            if (!passwordValidation.isValid) {
                throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
            }

            // Create user account
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const newUser = userCredential.user;

            // Update display name
            await updateProfile(newUser, {
                displayName: `${validation.sanitizedData.firstName} ${validation.sanitizedData.lastName}`
            });

            // Create user profile in Firestore
            await setDoc(doc(db, 'users', newUser.uid), {
                uid: newUser.uid,
                email: newUser.email,
                firstName: validation.sanitizedData.firstName,
                lastName: validation.sanitizedData.lastName,
                displayName: `${validation.sanitizedData.firstName} ${validation.sanitizedData.lastName}`,
                discipline: validation.sanitizedData.discipline,
                role: validation.sanitizedData.role,
                skills: validation.sanitizedData.skills ? 
                    validation.sanitizedData.skills.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
                bio: validation.sanitizedData.bio || '',
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp(),
                lastActivity: serverTimestamp(),
                sessionExtended: serverTimestamp(),
                photoURL: newUser.photoURL || null,
                // Security fields
                emailVerified: newUser.emailVerified,
                disabled: false,
                loginAttempts: 0,
                lastLoginAttempt: null
            });

            console.log('✅ User registered successfully:', newUser.uid);
        } catch (error: any) {
            console.error('❌ Registration error:', error);
            throw new Error(getAuthErrorMessage(error.code || error.message));
        } finally {
            setLoading(false);
        }
    }

    const login = async (email: string, password: string) => {
        try {
            setLoading(true);
            
            // Basic validation
            if (!email || !password) {
                throw new Error('Email and password are required');
            }

            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const loggedInUser = userCredential.user;

            // Check if user is disabled
            const userDoc = await getDoc(doc(db, 'users', loggedInUser.uid));
            if (userDoc.exists() && userDoc.data().disabled) {
                await signOut(auth);
                throw new Error('Account has been disabled. Please contact support.');
            }

            // Update last login timestamp and reset login attempts
            await setDoc(doc(db, 'users', loggedInUser.uid), {
                lastLogin: serverTimestamp(),
                lastActivity: serverTimestamp(),
                sessionExtended: serverTimestamp(),
                loginAttempts: 0,
                lastLoginAttempt: null
            }, { merge: true });

            console.log('✅ User logged in successfully:', loggedInUser.uid);
        } catch (error: any) {
            console.error('❌ Login error:', error);
            
            // Track failed login attempts
            if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                try {
                    // This is a simplified approach - in production, use Cloud Functions
                    const userQuery = await getDoc(doc(db, 'users', email.replace('@', '_').replace('.', '_')));
                    if (userQuery.exists()) {
                        const attempts = (userQuery.data().loginAttempts || 0) + 1;
                        await setDoc(doc(db, 'users', userQuery.id), {
                            loginAttempts: attempts,
                            lastLoginAttempt: serverTimestamp()
                        }, { merge: true });
                    }
                } catch (trackingError) {
                    console.error('Failed to track login attempt:', trackingError);
                }
            }
            
            throw new Error(getAuthErrorMessage(error.code));
        } finally {
            setLoading(false);
        }
    }

    const loginWithGoogle = async () => {
        try {
            setLoading(true);
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({
                prompt: 'select_account'
            });
            
            const userCredential = await signInWithPopup(auth, provider);
            const user = userCredential.user;

            // Check if user profile exists, if not create one
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (!userDoc.exists()) {
                const nameParts = user.displayName?.split(' ') || ['', ''];
                await setDoc(doc(db, 'users', user.uid), {
                    uid: user.uid,
                    email: user.email,
                    firstName: nameParts[0],
                    lastName: nameParts.slice(1).join(' '),
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    createdAt: serverTimestamp(),
                    lastLogin: serverTimestamp(),
                    lastActivity: serverTimestamp(),
                    sessionExtended: serverTimestamp(),
                    discipline: '',
                    role: '',
                    skills: [],
                    bio: '',
                    emailVerified: user.emailVerified,
                    disabled: false,
                    loginAttempts: 0
                });
            } else {
                // Check if disabled
                if (userDoc.data().disabled) {
                    await signOut(auth);
                    throw new Error('Account has been disabled. Please contact support.');
                }
                
                // Update last login
                await setDoc(doc(db, 'users', user.uid), {
                    lastLogin: serverTimestamp(),
                    lastActivity: serverTimestamp(),
                    sessionExtended: serverTimestamp(),
                    loginAttempts: 0
                }, { merge: true });
            }

            console.log('✅ User logged in with Google:', user.uid);
        } catch (error: any) {
            console.error('❌ Google login error:', error);
            throw new Error(getAuthErrorMessage(error.code));
        } finally {
            setLoading(false);
        }
    }

    const loginWithGithub = async () => {
        try {
            setLoading(true);
            const provider = new GithubAuthProvider();
            provider.setCustomParameters({
                allow_signup: 'true'
            });
            
            const userCredential = await signInWithPopup(auth, provider);
            const user = userCredential.user;

            // Check if user profile exists, if not create one
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (!userDoc.exists()) {
                const nameParts = user.displayName?.split(' ') || ['', ''];
                await setDoc(doc(db, 'users', user.uid), {
                    uid: user.uid,
                    email: user.email,
                    firstName: nameParts[0],
                    lastName: nameParts.slice(1).join(' '),
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    createdAt: serverTimestamp(),
                    lastLogin: serverTimestamp(),
                    lastActivity: serverTimestamp(),
                    sessionExtended: serverTimestamp(),
                    discipline: '',
                    role: '',
                    skills: [],
                    bio: '',
                    emailVerified: user.emailVerified,
                    disabled: false,
                    loginAttempts: 0
                });
            } else {
                // Check if disabled
                if (userDoc.data().disabled) {
                    await signOut(auth);
                    throw new Error('Account has been disabled. Please contact support.');
                }
                
                // Update last login
                await setDoc(doc(db, 'users', user.uid), {
                    lastLogin: serverTimestamp(),
                    lastActivity: serverTimestamp(),
                    sessionExtended: serverTimestamp(),
                    loginAttempts: 0
                }, { merge: true });
            }

            console.log('✅ User logged in with GitHub:', user.uid);
        } catch (error: any) {
            console.error('❌ GitHub login error:', error);
            throw new Error(getAuthErrorMessage(error.code));
        } finally {
            setLoading(false);
        }
    }

    const logout = async () => {
        try {
            clearSessionTimer();
            await signOut(auth);
            console.log('✅ User logged out successfully');
        } catch (error: any) {
            console.error('❌ Logout error:', error);
            throw new Error('Failed to log out. Please try again.');
        }
    }

    const refreshUser = async () => {
        if (auth.currentUser) {
            await auth.currentUser.reload();
            // Force re-evaluation of auth state
            setUser({ ...auth.currentUser });
        }
    };

    const value = {
        user,
        loading,
        login,
        register,
        logout,
        loginWithGoogle,
        loginWithGithub,
        refreshUser
    }

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    )
}

// Helper function for user-friendly error messages
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
