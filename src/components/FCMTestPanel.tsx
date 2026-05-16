import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bell, Send, TestTube, CheckCircle, XCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export function FCMTestPanel() {
    const { user } = useAuth()
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    const [testData, setTestData] = useState({
        title: 'Test Notification',
        body: 'This is a test notification from ProCollab!'
    })

    const testFCM = async () => {
        if (!user) {
            toast({
                title: 'Error',
                description: 'You must be logged in to test FCM',
                variant: 'destructive'
            })
            return
        }

        setLoading(true)
        try {
            // Call the Cloud Function test endpoint
            const response = await fetch(`https://us-central1-projectmap-f1155.cloudfunctions.net/testFCM`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user.uid,
                    title: testData.title,
                    body: testData.body
                })
            })

            const result = await response.json()

            if (response.ok) {
                toast({
                    title: 'FCM Test Successful',
                    description: result.message,
                    variant: 'success'
                })
            } else {
                throw new Error(result.error || 'Test failed')
            }
        } catch (error) {
            console.error('FCM test error:', error)
            toast({
                title: 'FCM Test Failed',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'destructive'
            })
        } finally {
            setLoading(false)
        }
    }

    const checkFCMStatus = () => {
        const hasVapidKey = !!import.meta.env.VITE_FIREBASE_VAPID_KEY
        const hasPermission = Notification.permission === 'granted'
        const isSupported = 'serviceWorker' in navigator && 'Notification' in window

        return {
            isSupported,
            hasVapidKey,
            hasPermission,
            isReady: isSupported && hasVapidKey && hasPermission
        }
    }

    const status = checkFCMStatus()

    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TestTube className="h-5 w-5" />
                    FCM Test Panel
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Status Indicators */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm">Browser Support:</span>
                        <Badge variant={status.isSupported ? 'default' : 'destructive'}>
                            {status.isSupported ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                            {status.isSupported ? 'Supported' : 'Not Supported'}
                        </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm">VAPID Key:</span>
                        <Badge variant={status.hasVapidKey ? 'default' : 'destructive'}>
                            {status.hasVapidKey ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                            {status.hasVapidKey ? 'Configured' : 'Missing'}
                        </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm">Permission:</span>
                        <Badge variant={status.hasPermission ? 'default' : 'secondary'}>
                            {status.hasPermission ? <CheckCircle className="h-3 w-3 mr-1" /> : <Bell className="h-3 w-3 mr-1" />}
                            {Notification.permission}
                        </Badge>
                    </div>
                </div>

                {/* Test Form */}
                <div className="space-y-3">
                    <div>
                        <label className="text-sm font-medium">Title</label>
                        <Input
                            value={testData.title}
                            onChange={(e) => setTestData({ ...testData, title: e.target.value })}
                            placeholder="Notification title"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Body</label>
                        <Textarea
                            value={testData.body}
                            onChange={(e) => setTestData({ ...testData, body: e.target.value })}
                            placeholder="Notification body"
                            rows={3}
                        />
                    </div>
                </div>

                {/* Test Button */}
                <Button
                    onClick={testFCM}
                    disabled={loading || !status.isReady || !user}
                    className="w-full"
                >
                    {loading ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                            Testing...
                        </>
                    ) : (
                        <>
                            <Send className="h-4 w-4 mr-2" />
                            Test FCM
                        </>
                    )}
                </Button>

                {/* Status Messages */}
                {!status.isSupported && (
                    <p className="text-xs text-red-600">
                        Your browser doesn't support push notifications
                    </p>
                )}
                {!status.hasVapidKey && (
                    <p className="text-xs text-red-600">
                        VAPID key not configured. Add VITE_FIREBASE_VAPID_KEY to your .env file
                    </p>
                )}
                {!status.hasPermission && status.isSupported && (
                    <p className="text-xs text-yellow-600">
                        Notification permission not granted. Click the notification prompt in the app.
                    </p>
                )}
                {!user && (
                    <p className="text-xs text-gray-600">
                        You must be logged in to test FCM
                    </p>
                )}
            </CardContent>
        </Card>
    )
}