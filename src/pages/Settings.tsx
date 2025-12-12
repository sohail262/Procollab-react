import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Loader2, RefreshCw, Check } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// DiceBear avatar styles
const AVATAR_STYLES = [
    { id: 'avataaars', name: 'Avataaars' },
    { id: 'bottts', name: 'Robots' },
    { id: 'pixel-art', name: 'Pixel Art' },
    { id: 'lorelei', name: 'Lorelei' },
    { id: 'notionists', name: 'Notionists' },
    { id: 'adventurer', name: 'Adventurer' },
    { id: 'big-ears', name: 'Big Ears' },
    { id: 'micah', name: 'Micah' },
    { id: 'personas', name: 'Personas' },
    { id: 'fun-emoji', name: 'Fun Emoji' },
]

export function Settings() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    const [initialLoading, setInitialLoading] = useState(true)

    // Avatar state
    const [selectedStyle, setSelectedStyle] = useState('avataaars')
    const [avatarSeed, setAvatarSeed] = useState('')
    const [currentAvatarUrl, setCurrentAvatarUrl] = useState('')

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        role: '',
        discipline: '',
        bio: '',
        location: '',
        skills: '',
        github: '',
        linkedin: '',
        twitter: '',
        website: ''
    })

    const disciplines = [
        'Computer Science',
        'Engineering',
        'Medicine & Health Sciences',
        'Business & Economics',
        'Arts & Humanities',
        'Social Sciences',
        'Natural Sciences',
        'Education',
        'Law',
        'Other'
    ]

    useEffect(() => {
        if (user) {
            loadUserData()
        }
    }, [user])

    const loadUserData = async () => {
        if (!user) return
        try {
            const docRef = doc(db, 'users', user.uid)
            const docSnap = await getDoc(docRef)
            if (docSnap.exists()) {
                const data = docSnap.data()
                setFormData({
                    firstName: data.firstName || '',
                    lastName: data.lastName || '',
                    role: data.role || '',
                    discipline: data.discipline || '',
                    bio: data.bio || '',
                    location: data.location || '',
                    skills: data.skills ? data.skills.join(', ') : '',
                    github: data.github || '',
                    linkedin: data.linkedin || '',
                    twitter: data.twitter || '',
                    website: data.website || ''
                })

                // Load avatar settings
                if (data.avatarStyle) {
                    setSelectedStyle(data.avatarStyle)
                }
                if (data.avatarSeed) {
                    setAvatarSeed(data.avatarSeed)
                } else {
                    setAvatarSeed(user.email || user.uid)
                }
                if (data.photoURL) {
                    setCurrentAvatarUrl(data.photoURL)
                }
            } else {
                // Set default seed for new users
                setAvatarSeed(user.email || user.uid)
            }
        } catch (error) {
            console.error('Error loading user data:', error)
        } finally {
            setInitialLoading(false)
        }
    }

    // Generate avatar URL
    const generateAvatarUrl = (style: string, seed: string) => {
        return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`
    }

    // Randomize seed
    const randomizeSeed = () => {
        const newSeed = Math.random().toString(36).substring(2, 10)
        setAvatarSeed(newSeed)
    }

    // Get preview avatar URL
    const previewAvatarUrl = generateAvatarUrl(selectedStyle, avatarSeed)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return

        setLoading(true)
        try {
            const userRef = doc(db, 'users', user.uid)
            const newAvatarUrl = generateAvatarUrl(selectedStyle, avatarSeed)

            await updateDoc(userRef, {
                ...formData,
                skills: formData.skills.split(',').map(s => s.trim()).filter(s => s),
                avatarStyle: selectedStyle,
                avatarSeed: avatarSeed,
                photoURL: newAvatarUrl,
                updatedAt: new Date()
            })

            setCurrentAvatarUrl(newAvatarUrl)
            toast({
                title: 'Profile Updated',
                description: 'Your profile has been updated successfully!',
                variant: 'success',
            })
        } catch (error) {
            console.error('Error updating profile:', error)
            toast({
                title: 'Update Failed',
                description: 'Failed to update profile. Please try again.',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    if (initialLoading) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="max-w-3xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        Settings
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Manage your profile and account settings
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Avatar Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Profile Avatar</CardTitle>
                            <CardDescription>
                                Choose your avatar style and customize it
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Current Avatar Preview */}
                            <div className="flex items-center gap-6">
                                <div className="relative">
                                    <img
                                        src={previewAvatarUrl}
                                        alt="Avatar Preview"
                                        className="w-24 h-24 rounded-full border-4 border-blue-500 bg-gray-100"
                                    />
                                    <div className="absolute -bottom-2 -right-2 bg-green-500 text-white rounded-full p-1">
                                        <Check className="h-4 w-4" />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-medium mb-1">Preview</h3>
                                    <p className="text-sm text-muted-foreground mb-3">
                                        This is how your avatar will look
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={randomizeSeed}
                                        >
                                            <RefreshCw className="h-4 w-4 mr-2" />
                                            Randomize
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Avatar Style Selection */}
                            <div>
                                <label className="block text-sm font-medium mb-3">Avatar Style</label>
                                <div className="grid grid-cols-5 gap-3">
                                    {AVATAR_STYLES.map((style) => (
                                        <button
                                            key={style.id}
                                            type="button"
                                            onClick={() => setSelectedStyle(style.id)}
                                            className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all hover:border-blue-300 ${selectedStyle === style.id
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                                                : 'border-gray-200 dark:border-gray-700'
                                                }`}
                                        >
                                            <img
                                                src={generateAvatarUrl(style.id, avatarSeed)}
                                                alt={style.name}
                                                className="w-12 h-12 rounded-full mb-2"
                                            />
                                            <span className="text-xs font-medium truncate w-full text-center">
                                                {style.name}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Custom Seed Input */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Custom Seed</label>
                                <div className="flex gap-2">
                                    <Input
                                        value={avatarSeed}
                                        onChange={(e) => setAvatarSeed(e.target.value)}
                                        placeholder="Enter a custom seed..."
                                        className="flex-1"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setAvatarSeed(user?.email || '')}
                                    >
                                        Use Email
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    The seed determines the unique look of your avatar. Same seed = same avatar.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Profile Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Profile Information</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium mb-2">First Name</label>
                                        <Input
                                            value={formData.firstName}
                                            onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Last Name</label>
                                        <Input
                                            value={formData.lastName}
                                            onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Role / Headline</label>
                                        <Input
                                            placeholder="e.g. Frontend Developer"
                                            value={formData.role}
                                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Discipline</label>
                                        <select
                                            className="w-full px-3 py-2 border rounded-md bg-background"
                                            value={formData.discipline}
                                            onChange={e => setFormData({ ...formData, discipline: e.target.value })}
                                        >
                                            <option value="">Select Discipline</option>
                                            {disciplines.map(d => (
                                                <option key={d} value={d}>{d}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium mb-2">Bio</label>
                                        <Textarea
                                            rows={4}
                                            placeholder="Tell us about yourself..."
                                            value={formData.bio}
                                            onChange={e => setFormData({ ...formData, bio: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Location</label>
                                        <Input
                                            placeholder="e.g. New York, USA"
                                            value={formData.location}
                                            onChange={e => setFormData({ ...formData, location: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Skills (comma separated)</label>
                                        <Input
                                            placeholder="e.g. React, Node.js, Design"
                                            value={formData.skills}
                                            onChange={e => setFormData({ ...formData, skills: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="border-t pt-6">
                                    <h3 className="text-lg font-medium mb-4">Social Links</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium mb-2">GitHub URL</label>
                                            <Input
                                                placeholder="https://github.com/username"
                                                value={formData.github}
                                                onChange={e => setFormData({ ...formData, github: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2">LinkedIn URL</label>
                                            <Input
                                                placeholder="https://linkedin.com/in/username"
                                                value={formData.linkedin}
                                                onChange={e => setFormData({ ...formData, linkedin: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Twitter URL</label>
                                            <Input
                                                placeholder="https://twitter.com/username"
                                                value={formData.twitter}
                                                onChange={e => setFormData({ ...formData, twitter: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Personal Website</label>
                                            <Input
                                                placeholder="https://example.com"
                                                value={formData.website}
                                                onChange={e => setFormData({ ...formData, website: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-4">
                                    <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={loading}>
                                        {loading ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            'Save Changes'
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </form>
            </div>
        </DashboardLayout>
    )
}
