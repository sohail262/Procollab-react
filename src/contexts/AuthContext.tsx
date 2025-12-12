import { createContext, useContext, useEffect, useState } from 'react'
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

interface AuthContextType {
    user: User | null
    loading: boolean
    login: (email: string, password: string) => Promise<void>
    register: (email: string, password: string, userData: UserData) => Promise<void>
    logout: () => Promise<void>
    loginWithGoogle: () => Promise<void>
    loginWithGithub: () => Promise<void>
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

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user)
            setLoading(false)
        })

        return unsubscribe
    }, [])

    const register = async (email: string, password: string, userData: UserData) => {
        try {
            // Create user account
            const userCredential = await createUserWithEmailAndPassword(auth, email, password)
            const user = userCredential.user

            // Update display name
            await updateProfile(user, {
                displayName: `${userData.firstName} ${userData.lastName}`
            })

            // Create user profile in Firestore
            await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                email: user.email,
                firstName: userData.firstName,
                lastName: userData.lastName,
                displayName: `${userData.firstName} ${userData.lastName}`,
                discipline: userData.discipline,
                role: userData.role,
                skills: userData.skills ? userData.skills.split(',').map(s => s.trim()) : [],
                bio: userData.bio || '',
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp(),
                photoURL: user.photoURL || null
            })

            console.log('✅ User registered successfully:', user.uid)
        } catch (error: any) {
            console.error('❌ Registration error:', error)
            throw new Error(getAuthErrorMessage(error.code))
        }
    }

    const login = async (email: string, password: string) => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password)
            const user = userCredential.user

            // Update last login timestamp
            await setDoc(doc(db, 'users', user.uid), {
                lastLogin: serverTimestamp()
            }, { merge: true })

            console.log('✅ User logged in successfully:', user.uid)
        } catch (error: any) {
            console.error('❌ Login error:', error)
            throw new Error(getAuthErrorMessage(error.code))
        }
    }

    const loginWithGoogle = async () => {
        try {
            const provider = new GoogleAuthProvider()
            const userCredential = await signInWithPopup(auth, provider)
            const user = userCredential.user

            // Check if user profile exists, if not create one
            const userDoc = await getDoc(doc(db, 'users', user.uid))
            if (!userDoc.exists()) {
                const nameParts = user.displayName?.split(' ') || ['', '']
                await setDoc(doc(db, 'users', user.uid), {
                    uid: user.uid,
                    email: user.email,
                    firstName: nameParts[0],
                    lastName: nameParts.slice(1).join(' '),
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    createdAt: serverTimestamp(),
                    lastLogin: serverTimestamp(),
                    discipline: '',
                    role: '',
                    skills: [],
                    bio: ''
                })
            } else {
                // Update last login
                await setDoc(doc(db, 'users', user.uid), {
                    lastLogin: serverTimestamp()
                }, { merge: true })
            }

            console.log('✅ User logged in with Google:', user.uid)
        } catch (error: any) {
            console.error('❌ Google login error:', error)
            throw new Error(getAuthErrorMessage(error.code))
        }
    }

    const loginWithGithub = async () => {
        try {
            const provider = new GithubAuthProvider()
            const userCredential = await signInWithPopup(auth, provider)
            const user = userCredential.user

            // Check if user profile exists, if not create one
            const userDoc = await getDoc(doc(db, 'users', user.uid))
            if (!userDoc.exists()) {
                const nameParts = user.displayName?.split(' ') || ['', '']
                await setDoc(doc(db, 'users', user.uid), {
                    uid: user.uid,
                    email: user.email,
                    firstName: nameParts[0],
                    lastName: nameParts.slice(1).join(' '),
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    createdAt: serverTimestamp(),
                    lastLogin: serverTimestamp(),
                    discipline: '',
                    role: '',
                    skills: [],
                    bio: ''
                })
            } else {
                // Update last login
                await setDoc(doc(db, 'users', user.uid), {
                    lastLogin: serverTimestamp()
                }, { merge: true })
            }

            console.log('✅ User logged in with GitHub:', user.uid)
        } catch (error: any) {
            console.error('❌ GitHub login error:', error)
            throw new Error(getAuthErrorMessage(error.code))
        }
    }

    const logout = async () => {
        try {
            await signOut(auth)
            console.log('✅ User logged out successfully')
        } catch (error: any) {
            console.error('❌ Logout error:', error)
            throw new Error('Failed to log out. Please try again.')
        }
    }

    const value = {
        user,
        loading,
        login,
        register,
        logout,
        loginWithGoogle,
        loginWithGithub
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
