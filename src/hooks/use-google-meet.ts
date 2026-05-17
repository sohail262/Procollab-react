// src/hooks/use-google-meet.ts
import { useState, useCallback, useEffect } from 'react'

declare global {
    interface Window {
        google?: {
            accounts: {
                oauth2: {
                    initTokenClient: (config: any) => any
                    revoke: (token: string, callback: () => void) => void
                }
            }
        }
    }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string
const SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar',
].join(' ')

// ─── localStorage keys ────────────────────────────────────────────────────────
const TOKEN_KEY = 'procollab_google_access_token'
const TOKEN_EXPIRY_KEY = 'procollab_google_token_expiry'

// ─── Token helpers ────────────────────────────────────────────────────────────
function saveToken(accessToken: string, expiresIn: number) {
    // expiresIn is in seconds; subtract 60s buffer
    const expiresAt = Date.now() + (expiresIn - 60) * 1000
    localStorage.setItem(TOKEN_KEY, accessToken)
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiresAt))
}

function loadSavedToken(): string | null {
    try {
        const token = localStorage.getItem(TOKEN_KEY)
        const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY)
        if (!token || !expiry) return null
        // Expired?
        if (Date.now() > Number(expiry)) {
            clearSavedToken()
            return null
        }
        return token
    } catch {
        return null
    }
}

function clearSavedToken() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_EXPIRY_KEY)
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface GoogleMeetEvent {
    title: string
    description?: string
    startTime: Date
    endTime: Date
    attendeeEmails?: string[]
}

interface CreatedMeeting {
    meetLink: string
    calendarEventId: string
    htmlLink: string
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useGoogleMeet() {
    const [isAuthorized, setIsAuthorized] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [tokenClient, setTokenClient] = useState<any>(null)
    const [accessToken, setAccessToken] = useState<string | null>(null)

    // ── On mount: restore persisted token ────────────────────────────────────
    useEffect(() => {
        const saved = loadSavedToken()
        if (saved) {
            setAccessToken(saved)
            setIsAuthorized(true)
        }
    }, [])

    // ── Load GIS script ───────────────────────────────────────────────────────
    useEffect(() => {
        const scriptId = 'google-identity-services'

        const init = () => initTokenClient()

        if (document.getElementById(scriptId)) {
            // Script already loaded
            init()
            return
        }

        const script = document.createElement('script')
        script.id = scriptId
        script.src = 'https://accounts.google.com/gsi/client'
        script.async = true
        script.defer = true
        script.onload = init
        document.body.appendChild(script)
    }, [])

    const initTokenClient = () => {
        if (!window.google?.accounts?.oauth2) return

        const client = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: SCOPES,
            callback: (response: any) => {
                if (response.error) {
                    console.error('OAuth error:', response)
                    setIsAuthorized(false)
                    clearSavedToken()
                    return
                }
                // Persist token so refresh doesn't ask again
                saveToken(
                    response.access_token,
                    response.expires_in ?? 3600
                )
                setAccessToken(response.access_token)
                setIsAuthorized(true)
            },
        })

        setTokenClient(client)

        // If we already have a saved token from localStorage,
        // mark as authorized without prompting
        const saved = loadSavedToken()
        if (saved) {
            setAccessToken(saved)
            setIsAuthorized(true)
        }
    }

    // ── Authorize (only prompts if no valid saved token) ──────────────────────
    const authorize = useCallback(() => {
        if (!tokenClient) return
        const saved = loadSavedToken()
        tokenClient.requestAccessToken({
            // Empty string = no prompt if session still valid
            // 'consent' = always show account picker
            prompt: saved ? '' : 'consent',
        })
    }, [tokenClient])

    // ── Disconnect ────────────────────────────────────────────────────────────
    const disconnect = useCallback(() => {
        if (accessToken && window.google?.accounts?.oauth2) {
            window.google.accounts.oauth2.revoke(accessToken, () => {
                console.log('Google token revoked')
            })
        }
        clearSavedToken()
        setAccessToken(null)
        setIsAuthorized(false)
    }, [accessToken])

    // ── Create Google Meet event ──────────────────────────────────────────────
    const createMeetingEvent = useCallback(async (
        eventDetails: GoogleMeetEvent
    ): Promise<CreatedMeeting> => {
        if (!accessToken) throw new Error('Not authorized with Google')

        setIsLoading(true)
        try {
            const event = {
                summary: eventDetails.title,
                description: eventDetails.description ?? '',
                start: {
                    dateTime: eventDetails.startTime.toISOString(),
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                },
                end: {
                    dateTime: eventDetails.endTime.toISOString(),
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                },
                conferenceData: {
                    createRequest: {
                        requestId: `procollab-${Date.now()}-${Math.random()
                            .toString(36)
                            .slice(2)}`,
                        conferenceSolutionKey: { type: 'hangoutsMeet' },
                    },
                },
                attendees: (eventDetails.attendeeEmails ?? []).map(email => ({
                    email,
                })),
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: 'email', minutes: 30 },
                        { method: 'popup', minutes: 10 },
                    ],
                },
            }

            const response = await fetch(
                'https://www.googleapis.com/calendar/v3/calendars/primary/events' +
                '?conferenceDataVersion=1&sendUpdates=all',
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(event),
                }
            )

            if (!response.ok) {
                const err = await response.json()
                // 401 = token expired — clear it so user re-auths next time
                if (response.status === 401) {
                    clearSavedToken()
                    setAccessToken(null)
                    setIsAuthorized(false)
                }
                throw new Error(err.error?.message ?? 'Failed to create meeting')
            }

            const data = await response.json()

            const meetLink =
                data.conferenceData?.entryPoints?.find(
                    (ep: any) => ep.entryPointType === 'video'
                )?.uri ?? ''

            return {
                meetLink,
                calendarEventId: data.id,
                htmlLink: data.htmlLink,
            }
        } finally {
            setIsLoading(false)
        }
    }, [accessToken])

    // ── Delete Google Calendar event ──────────────────────────────────────────
    const deleteMeetingEvent = useCallback(async (calendarEventId: string) => {
        if (!accessToken || !calendarEventId) return
        try {
            await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/primary/events/${calendarEventId}`,
                {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${accessToken}` },
                }
            )
        } catch (err) {
            console.error('Failed to delete calendar event:', err)
        }
    }, [accessToken])

    return {
        isAuthorized,
        isLoading,
        authorize,
        disconnect,
        createMeetingEvent,
        deleteMeetingEvent,
    }
}