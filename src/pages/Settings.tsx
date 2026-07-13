import { useState, useEffect } from 'react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Loader2, RefreshCw, Check, X, Plus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { PREDEFINED_SKILLS } from '@/config/predefinedSkills'
import { trackProfileCompleted } from '@/services/analyticsService'
import { isUsernameTaken } from '@/lib/urlUtils'


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

    // Interactive Skills state
    const [selectedSkills, setSelectedSkills] = useState<string[]>([])
    const [skillInput, setSkillInput] = useState('')
    const [showSuggestions, setShowSuggestions] = useState(false)

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        username: '',
        profileVisibility: 'public',
        role: '',
        discipline: '',
        bio: '',
        location: '',
        github: '',
        linkedin: '',
        twitter: '',
        website: '',
        portfolioURL: '',
        isOpenToWork: false,
        availabilityHours: 10,
        timezone: 'UTC'
    })

    const [preferredRoles, setPreferredRoles] = useState<string[]>([])
    const [roleInput, setRoleInput] = useState('')
    const [pastProjectsShowcase, setPastProjectsShowcase] = useState<any[]>([])

    // New project showcase form state
    const [newProject, setNewProject] = useState({
        title: '',
        description: '',
        outcome: '',
        screenshotURL: ''
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

    const timezones = [
        'UTC',
        'EST (UTC-5)',
        'CST (UTC-6)',
        'MST (UTC-7)',
        'PST (UTC-8)',
        'GMT (UTC+0)',
        'CET (UTC+1)',
        'EET (UTC+2)',
        'MSK (UTC+3)',
        'GST (UTC+4)',
        'IST (UTC+5.30)',
        'SGT (UTC+8)',
        'JST (UTC+9)',
        'AEST (UTC+10)',
        'NZST (UTC+12)'
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
                    username: data.username || '',
                    profileVisibility: ['public', 'connections_only', 'private'].includes(data.profileVisibility) ? data.profileVisibility : 'public',
                    role: data.role || '',
                    discipline: data.discipline || '',
                    bio: data.bio || '',
                    location: data.location || '',
                    github: data.github || '',
                    linkedin: data.linkedin || '',
                    twitter: data.twitter || '',
                    website: data.website || '',
                    portfolioURL: data.portfolioURL || '',
                    isOpenToWork: data.isOpenToWork || false,
                    availabilityHours: data.availabilityHours || 10,
                    timezone: data.timezone || 'UTC'
                })
                setSelectedSkills(data.skills || [])
                setPreferredRoles(data.preferredRoles || [])
                setPastProjectsShowcase(data.pastProjectsShowcase || [])

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

    // Real-time Username checking state
    const [usernameTaken, setUsernameTaken] = useState<boolean | null>(null)
    const [usernameChecking, setUsernameChecking] = useState(false)
    const [usernameError, setUsernameError] = useState<string | null>(null)

    useEffect(() => {
        const queryUsername = formData.username.toLowerCase().trim()
        if (!queryUsername) {
            setUsernameTaken(null)
            setUsernameError(null)
            return
        }

        // Validate format
        const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/
        if (!usernameRegex.test(queryUsername)) {
            setUsernameError('Username must be 3-30 characters (letters, numbers, underscore, hyphen).')
            setUsernameTaken(null)
            return
        }
        
        setUsernameError(null)

        const debounceId = setTimeout(async () => {
            setUsernameChecking(true)
            try {
                const isTaken = await isUsernameTaken(queryUsername, user?.uid)
                setUsernameTaken(isTaken)
            } catch (err) {
                console.error(err)
            } finally {
                setUsernameChecking(false)
            }
        }, 400)

        return () => clearTimeout(debounceId)
    }, [formData.username, user?.uid])

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

    const handleRemoveSkill = (skillToRemove: string) => {
        setSelectedSkills(prev => prev.filter(s => s !== skillToRemove))
    }

    const handleSkillInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSkillInput(e.target.value)
        setShowSuggestions(true)
    }

    const handleSkillInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleAddCustomSkill()
        }
    }

    const handleAddCustomSkill = () => {
        const cleanSkill = skillInput.trim()
        if (cleanSkill && !selectedSkills.map(s => s.toLowerCase()).includes(cleanSkill.toLowerCase())) {
            setSelectedSkills(prev => [...prev, cleanSkill])
        }
        setSkillInput('')
    }

    const handleSelectSuggestion = (suggestion: string) => {
        if (selectedSkills.includes(suggestion)) {
            setSelectedSkills(prev => prev.filter(s => s !== suggestion))
        } else {
            setSelectedSkills(prev => [...prev, suggestion])
        }
        setSkillInput('')
        setShowSuggestions(false)
    }

    // Filter predefined suggestions
    const filteredSuggestions = skillInput.trim() === ''
        ? []
        : PREDEFINED_SKILLS.filter(skill =>
            skill.toLowerCase().includes(skillInput.toLowerCase().trim())
        );

    // Preferred Roles helpers
    const handleAddRole = () => {
        const cleanRole = roleInput.trim()
        if (cleanRole && !preferredRoles.map(r => r.toLowerCase()).includes(cleanRole.toLowerCase())) {
            setPreferredRoles(prev => [...prev, cleanRole])
        }
        setRoleInput('')
    }

    const handleRemoveRole = (roleToRemove: string) => {
        setPreferredRoles(prev => prev.filter(r => r !== roleToRemove))
    }

    // Showcase Project helpers
    const handleAddShowcaseProject = () => {
        if (!newProject.title || !newProject.description) {
            toast({
                title: 'Missing Fields',
                description: 'Title and Description are required for showcase projects.',
                variant: 'destructive'
            })
            return
        }
        setPastProjectsShowcase(prev => [...prev, { ...newProject }])
        setNewProject({
            title: '',
            description: '',
            outcome: '',
            screenshotURL: ''
        })
        toast({
            title: 'Project added to list',
            description: 'Save changes to persist the showcase list.',
            variant: 'success'
        })
    }

    const handleRemoveShowcaseProject = (index: number) => {
        setPastProjectsShowcase(prev => prev.filter((_, i) => i !== index))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return

        const queryUsername = formData.username.toLowerCase().trim()
        if (queryUsername) {
            const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/
            if (!usernameRegex.test(queryUsername)) {
                toast({
                    title: 'Invalid Username',
                    description: 'Username must be 3-30 characters and contain only letters, numbers, underscores, and hyphens.',
                    variant: 'destructive',
                })
                return
            }

            const taken = await isUsernameTaken(queryUsername, user.uid)
            if (taken) {
                toast({
                    title: 'Username Already Taken',
                    description: 'The username you requested is already in use. Please select a different one.',
                    variant: 'destructive',
                })
                return
            }
        }

        setLoading(true)
        try {
            const userRef = doc(db, 'users', user.uid)
            const newAvatarUrl = generateAvatarUrl(selectedStyle, avatarSeed)

            await updateDoc(userRef, {
                ...formData,
                username: queryUsername,
                skills: selectedSkills,
                preferredRoles,
                pastProjectsShowcase,
                avatarStyle: selectedStyle,
                avatarSeed: avatarSeed,
                photoURL: newAvatarUrl,
                updatedAt: new Date()
            })

            // Track profile completed event
            trackProfileCompleted(user.uid, {
                has_bio: !!formData.bio,
                skills_count: selectedSkills.length,
                has_avatar: !!newAvatarUrl
            })

            setCurrentAvatarUrl(newAvatarUrl)

            // Bust profile sessionStorage cache so Profile.tsx shows fresh data immediately
            try { sessionStorage.removeItem(`profile_${user.uid}`) } catch { /* ignore */ }

            toast({
                title: 'Profile Updated',
                description: 'Your profile has been updated successfully!',
                variant: 'success',
            })
            navigate(`/profile/${user.uid}`)
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
                                {/* Username and Privacy Visibility Settings */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-gray-150 dark:border-gray-800">
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Username *</label>
                                        <div className="relative">
                                            <Input
                                                placeholder="e.g. john_doe"
                                                value={formData.username}
                                                onChange={e => setFormData({ ...formData, username: e.target.value.toLowerCase().trim() })}
                                                className={`pr-10 ${usernameError || usernameTaken ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                                                {usernameChecking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                                {!usernameChecking && formData.username && usernameTaken === false && !usernameError && (
                                                    <Check className="h-4 w-4 text-green-500 font-bold" />
                                                )}
                                                {!usernameChecking && formData.username && (usernameTaken === true || usernameError) && (
                                                    <X className="h-4 w-4 text-red-500" />
                                                )}
                                            </div>
                                        </div>
                                        {usernameError && (
                                            <p className="text-xs text-red-500 mt-1">{usernameError}</p>
                                        )}
                                        {usernameTaken && (
                                            <p className="text-xs text-red-500 mt-1">This username is already taken.</p>
                                        )}
                                        <p className="text-[11px] text-muted-foreground mt-1">
                                            Your public URL will be: {window.location.origin}/u/{formData.username || 'username'}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Profile Privacy *</label>
                                        <Select
                                            value={['public', 'connections_only', 'private'].includes(formData.profileVisibility) ? formData.profileVisibility : 'public'}
                                            onValueChange={value => setFormData({ ...formData, profileVisibility: value })}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select Privacy" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="public">Public (Everyone can view)</SelectItem>
                                                <SelectItem value="connections_only">Connections Only (Only friends can view)</SelectItem>
                                                <SelectItem value="private">Private (Only you can view)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[11px] text-muted-foreground mt-1.5">
                                            Control who can access your public profile and portfolio work.
                                        </p>
                                    </div>
                                </div>

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
                                        <Select
                                            value={formData.discipline || undefined}
                                            onValueChange={value => setFormData({ ...formData, discipline: value })}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select Discipline" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {disciplines.map(d => (
                                                    <SelectItem key={d} value={d}>{d}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
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

                                    <div className="relative md:col-span-2">
                                        <label className="block text-sm font-medium mb-2">Skills</label>
                                        
                                        {/* Selected Skills Badges */}
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {selectedSkills.length > 0 ? (
                                                selectedSkills.map((skill, index) => (
                                                    <Badge 
                                                        key={index} 
                                                        variant="secondary" 
                                                        className="flex items-center gap-1.5 py-1.5 px-3 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-100 dark:border-blue-900/50 hover:bg-blue-100 dark:hover:bg-blue-950/60 transition-colors"
                                                    >
                                                        {skill}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveSkill(skill)}
                                                            className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 transition-colors focus:outline-none"
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </Badge>
                                                ))
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic py-1">No skills added yet. Type below to search or add custom skills!</span>
                                            )}
                                        </div>

                                        {/* Autocomplete Input */}
                                        <div className="relative">
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="Type to search skills (e.g. React, Python, Product Management)..."
                                                    value={skillInput}
                                                    onChange={handleSkillInputChange}
                                                    onKeyDown={handleSkillInputKeyDown}
                                                    onFocus={() => setShowSuggestions(true)}
                                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                                    className="flex-1"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={handleAddCustomSkill}
                                                >
                                                    <Plus className="h-4 w-4 mr-1" /> Add
                                                </Button>
                                            </div>

                                            {/* Dropdown Suggestions */}
                                            {showSuggestions && filteredSuggestions.length > 0 && (
                                                <div className="absolute z-50 w-full mt-1.5 max-h-60 overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-md shadow-lg scrollbar-thin">
                                                    <div className="p-1.5">
                                                        {filteredSuggestions.map((suggestion) => (
                                                            <button
                                                                key={suggestion}
                                                                type="button"
                                                                onClick={() => handleSelectSuggestion(suggestion)}
                                                                className="w-full text-left px-3 py-2 text-sm rounded hover:bg-zinc-800 transition-colors focus:outline-none flex justify-between items-center"
                                                            >
                                                                <span className="text-zinc-100">{suggestion}</span>
                                                                {selectedSkills.includes(suggestion) && (
                                                                    <Check className="h-4 w-4 text-green-500" />
                                                                )}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-2">
                                            Type to search the 150+ predefined skills. If your skill isn't in the list, type it and click "Add" or press Enter.
                                        </p>
                                    </div>
                                </div>

                                <div className="border-t border-slate-800 pt-6">
                                    <h3 className="text-lg font-medium mb-4">Social & Portfolio Links</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Portfolio URL</label>
                                            <Input
                                                placeholder="https://myportfolio.com"
                                                value={formData.portfolioURL}
                                                onChange={e => setFormData({ ...formData, portfolioURL: e.target.value })}
                                            />
                                        </div>
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
                                            <label className="block text-sm font-medium mb-2">Personal Website</label>
                                            <Input
                                                placeholder="https://example.com"
                                                value={formData.website}
                                                onChange={e => setFormData({ ...formData, website: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Past Work Showcase Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Portfolio Showcase</CardTitle>
                            <CardDescription>
                                Showcase past projects you have completed, including outcomes and descriptions.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Showcase list */}
                            <div className="space-y-4">
                                {pastProjectsShowcase.length === 0 ? (
                                    <p className="text-sm text-slate-500 italic">No showcase projects added yet.</p>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3">
                                        {pastProjectsShowcase.map((p, index) => (
                                            <div key={index} className="flex justify-between items-start p-4 rounded-xl border border-slate-800 bg-slate-950/20 gap-4">
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="font-bold text-sm text-white">{p.title}</h4>
                                                    <p className="text-xs text-slate-400 mt-1">{p.description}</p>
                                                    {p.outcome && (
                                                        <p className="text-xs text-emerald-400 mt-1.5 font-medium">Outcome: {p.outcome}</p>
                                                    )}
                                                    {p.screenshotURL && (
                                                        <p className="text-[10px] text-indigo-400 mt-1 break-all">Screenshot URL: {p.screenshotURL}</p>
                                                    )}
                                                </div>
                                                <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveShowcaseProject(index)} className="text-red-500 hover:text-red-400 shrink-0">
                                                    Remove
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Add new showcase project form */}
                            <div className="border-t border-slate-800 pt-4 space-y-4">
                                <h3 className="text-sm font-bold text-white">Add Showcase Project</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Project Title *</label>
                                        <Input
                                            placeholder="e.g. E-Commerce Replatform"
                                            value={newProject.title}
                                            onChange={e => setNewProject({ ...newProject, title: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Screenshot / Image URL (optional)</label>
                                        <Input
                                            placeholder="e.g. https://myportfolio.com/images/shot.jpg"
                                            value={newProject.screenshotURL}
                                            onChange={e => setNewProject({ ...newProject, screenshotURL: e.target.value })}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs text-slate-400 mb-1">Description *</label>
                                        <Textarea
                                            placeholder="What was this project about? What did you build?"
                                            rows={3}
                                            value={newProject.description}
                                            onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs text-slate-400 mb-1">Outcome / Result</label>
                                        <Input
                                            placeholder="e.g. Built responsive cart system, improved checkout load time by 40%"
                                            value={newProject.outcome}
                                            onChange={e => setNewProject({ ...newProject, outcome: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <Button type="button" size="sm" onClick={handleAddShowcaseProject} className="bg-slate-800 hover:bg-slate-700 text-white">
                                    Add Project to Showcase
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex justify-end gap-3">
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
                        </CardContent>
                    </Card>
                </form>
            </div>
        </DashboardLayout>
    )
}

