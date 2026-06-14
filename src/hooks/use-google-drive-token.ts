/**
 * useGoogleDriveToken — shared, persistent Google OAuth token hook
 *
 * Stores the access_token + expiry in localStorage so the user doesn't have to
 * reconnect on every page load / refresh. Tokens from @react-oauth/google last
 * ~1 hour; we cache them and auto-clear once expired.
 *
 * Usage:
 *   const { token, connect, connected, connecting } = useGoogleDriveToken()
 */
import { useState, useEffect, useCallback } from 'react'
import { useGoogleLogin }                   from '@react-oauth/google'

const LS_KEY         = 'procollab_gdrive_token'
const LS_EXPIRY_KEY  = 'procollab_gdrive_token_expiry'
const TOKEN_LIFETIME = 55 * 60 * 1000   // 55 min (Google issues 60 min, we expire 5 min early)

interface StoredToken {
    token:   string
    expiry:  number   // epoch ms
}

function loadFromStorage(): string | null {
    try {
        const stored = localStorage.getItem(LS_KEY)
        const expiry = localStorage.getItem(LS_EXPIRY_KEY)
        if (!stored || !expiry) return null
        if (Date.now() > parseInt(expiry, 10)) {
            // expired — clear
            localStorage.removeItem(LS_KEY)
            localStorage.removeItem(LS_EXPIRY_KEY)
            return null
        }
        return stored
    } catch {
        return null
    }
}

function saveToStorage(token: string) {
    try {
        localStorage.setItem(LS_KEY, token)
        localStorage.setItem(LS_EXPIRY_KEY, String(Date.now() + TOKEN_LIFETIME))
    } catch {}
}

function clearStorage() {
    try {
        localStorage.removeItem(LS_KEY)
        localStorage.removeItem(LS_EXPIRY_KEY)
    } catch {}
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useGoogleDriveToken() {
    const [token,      setToken]      = useState<string | null>(null)
    const [connecting, setConnecting] = useState(false)

    // On mount — restore from localStorage if still valid
    useEffect(() => {
        const cached = loadFromStorage()
        if (cached) setToken(cached)
    }, [])

    const googleLogin = useGoogleLogin({
        scope: 'https://www.googleapis.com/auth/drive.file',
        onSuccess: tokenResponse => {
            const t = tokenResponse.access_token
            setToken(t)
            saveToStorage(t)
            setConnecting(false)
        },
        onError: () => {
            setConnecting(false)
        },
    })

    const connect = useCallback(() => {
        setConnecting(true)
        googleLogin()
    }, [googleLogin])

    const disconnect = useCallback(() => {
        setToken(null)
        clearStorage()
    }, [])

    return {
        token,
        connected:  !!token,
        connecting,
        connect,
        disconnect,
        /** Manually set token (e.g. after template apply) */
        setToken: (t: string | null) => {
            if (t) { setToken(t); saveToStorage(t) }
            else   { setToken(null); clearStorage() }
        },
    }
}
