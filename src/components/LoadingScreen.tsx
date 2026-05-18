import { useState, useEffect, useMemo } from 'react'

const QUOTES = [
    // Collaboration
    { text: "Alone we can do so little; together we can do so much.", author: "Helen Keller" },
    { text: "If you want to go fast, go alone. If you want to go far, go together.", author: "African Proverb" },
    { text: "None of us is as smart as all of us.", author: "Ken Blanchard" },
    { text: "The whole is greater than the sum of its parts.", author: "Aristotle" },
    { text: "Coming together is a beginning. Keeping together is progress. Working together is success.", author: "Henry Ford" },
    // Projects
    { text: "A goal without a plan is just a wish.", author: "Antoine de Saint-Exupéry" },
    { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
    { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
    { text: "Great things in business are never done by one person; they're done by a team.", author: "Steve Jobs" },
    { text: "Build something people want, with people who care.", author: "ProCollab" },
    // Project management
    { text: "Plans are nothing; planning is everything.", author: "Dwight D. Eisenhower" },
    { text: "Project management is the art of creating the illusion that any outcome was the only possible one.", author: "Anonymous" },
    { text: "A successful project manager turns vision into reality, one milestone at a time.", author: "Anonymous" },
    { text: "Operations keeps the lights on, strategy provides direction, but project management moves the organization forward.", author: "Joy Gumz" },
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    // Jobs in project management
    { text: "Your network is your net worth in the world of project management.", author: "Anonymous" },
    { text: "The best investment you can make is in yourself and the people around you.", author: "Warren Buffett" },
    { text: "Opportunities don't happen. You create them.", author: "Chris Grosser" },
    { text: "Choose a job you love, and you will never have to work a day in your life.", author: "Confucius" },
    { text: "The strength of the team is each individual member. The strength of each member is the team.", author: "Phil Jackson" },
]

export function LoadingScreen({ message }: { message?: string }) {
    const quote = useMemo(() => QUOTES[Math.floor(Math.random() * QUOTES.length)], [])
    const [progress, setProgress] = useState(5)
    const [dots, setDots] = useState(0)

    useEffect(() => {
        const id = setInterval(() => {
            setProgress(p => p >= 88 ? p : p + Math.max(0.4, (88 - p) * 0.05))
        }, 120)
        return () => clearInterval(id)
    }, [])

    useEffect(() => {
        const id = setInterval(() => setDots(d => (d + 1) % 4), 500)
        return () => clearInterval(id)
    }, [])

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6">
            {/* Brand */}
            <div className="mb-10 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                    <span className="font-bold text-white text-sm">P</span>
                </div>
                <span className="text-lg font-semibold tracking-tight text-foreground">ProCollab</span>
            </div>

            {/* Quote */}
            <div className="max-w-md text-center mb-12">
                <p className="text-sm sm:text-base text-foreground/80 leading-relaxed italic mb-2">
                    "{quote.text}"
                </p>
                <p className="text-xs text-muted-foreground">— {quote.author}</p>
            </div>

            {/* Progress bar — thin, clean, blue only */}
            <div className="w-full max-w-[280px]">
                <div className="h-0.5 bg-border rounded-full overflow-hidden">
                    <div
                        className="h-full bg-blue-600 rounded-full transition-[width] duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <p className="mt-4 text-center text-xs text-muted-foreground">
                    {message || `Loading${'.'.repeat(dots)}`}
                </p>
            </div>
        </div>
    )
}

export default LoadingScreen
