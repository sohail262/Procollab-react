import { Link } from "react-router-dom"
import { Users, Lightbulb, ListTodo, Star, ArrowRight, CheckCircle2, Shield, TrendingUp, Zap, Terminal, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"
import { lazy, Suspense } from "react"

// ⚡ OPTIMIZATION: Lazy-load HeroGlobe to defer Three.js (~600KB) from the
// initial bundle. Three.js was blocking the main thread for ~6s before any
// text rendered (LCP = 6070ms). Now the hero text paints immediately and
// the globe loads in the background after the LCP element is visible.
const HeroGlobe = lazy(() =>
    import("@/components/HeroGlobe").then(m => ({ default: m.HeroGlobe }))
)

// Placeholder shown while Three.js loads — matches the globe container size
// so layout doesn't shift when the globe appears
const GlobePlaceholder = () => (
    <div className="w-full h-full min-h-[400px] lg:min-h-[560px] flex items-center justify-center">
        <div className="font-mono text-xs tracking-widest text-muted-foreground animate-pulse">
            LOADING MAP DATA...
        </div>
    </div>
)

export function Landing() {
    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />

            <main className="flex-1">

                {/* ── Hero ───────────────────────────────────────────── */}
                <section className="relative overflow-hidden border-b bg-background">
                    <div className="landing-grid-bg absolute inset-0 pointer-events-none" />

                    <div className="container relative px-4 py-16 md:py-28 lg:py-36 max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

                            {/* Left column */}
                            <div className="flex flex-col items-start text-left z-10">
                                <div className="mb-6 inline-flex items-center gap-2 border border-primary/40 px-3 py-1.5 text-xs font-mono tracking-widest uppercase text-primary">
                                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                                    SYS:01 — TRUSTED BY 10,000+ COLLABORATORS
                                </div>

                                <h1 className="mb-6 text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl text-foreground leading-none">
                                    Where Ideas<br className="hidden md:block" /> Meet Innovation
                                </h1>

                                <p className="mb-10 text-base text-muted-foreground md:text-lg leading-relaxed max-w-lg border-l-2 border-primary/50 pl-4">
                                    Connect with brilliant minds across disciplines. Build groundbreaking projects. Transform your ideas into reality with the perfect team.
                                </p>

                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Button asChild size="lg" className="text-sm px-8 rounded-none font-mono tracking-wider uppercase">
                                        <Link to="/register">
                                            Get Started Free
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </Link>
                                    </Button>
                                    <Button asChild variant="outline" size="lg" className="text-sm px-8 rounded-none font-mono tracking-wider uppercase">
                                        <Link to="/projects">Explore Projects</Link>
                                    </Button>
                                </div>

                                <div className="mt-8 flex flex-col sm:flex-row gap-4 text-xs font-mono text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-primary" />
                                        <span>NO CREDIT CARD REQUIRED</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-primary" />
                                        <span>FREE FOREVER PLAN</span>
                                    </div>
                                </div>
                            </div>

                            {/* Right column: Globe */}
                            <div className="relative h-[400px] lg:h-[560px] w-full flex items-center justify-center">
                                <Suspense fallback={<GlobePlaceholder />}>
                                    <HeroGlobe />
                                </Suspense>
                            </div>

                        </div>
                    </div>
                </section>

                {/* ── Stats ──────────────────────────────────────────── */}
                <section className="border-b">
                    <div className="container px-4 max-w-7xl mx-auto">
                        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
                            {[
                                { value: "10K+", label: "Active Users", id: "01" },
                                { value: "5K+",  label: "Projects Completed", id: "02" },
                                { value: "50+",  label: "Countries", id: "03" },
                                { value: "98%",  label: "Satisfaction Rate", id: "04" },
                            ].map((stat) => (
                                <div key={stat.id} className="flex flex-col items-center justify-center py-10 px-4 text-center">
                                    <span className="text-xs font-mono text-muted-foreground tracking-widest mb-2">[{stat.id}]</span>
                                    <span className="text-4xl font-bold text-primary tabular-nums">{stat.value}</span>
                                    <span className="text-xs font-mono tracking-widest text-muted-foreground uppercase mt-1">{stat.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Features ───────────────────────────────────────── */}
                <section className="py-24 border-b">
                    <div className="container px-4 md:px-6 max-w-7xl mx-auto">

                        <div className="mb-16">
                            <div className="inline-flex items-center gap-2 border border-border px-3 py-1.5 text-xs font-mono tracking-widest uppercase text-muted-foreground mb-4">
                                <Zap className="h-3 w-3" />
                                SYS:02 — PLATFORM CAPABILITIES
                            </div>
                            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Everything You Need<br />to Succeed</h2>
                            <p className="mt-3 text-muted-foreground max-w-lg text-sm leading-relaxed">Built for modern teams who want to collaborate without boundaries.</p>
                        </div>

                        {/* Primary feature cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border border border-border">
                            {[
                                { icon: Users,    title: "Find Your Dream Team",   desc: "Connect with talented individuals from diverse backgrounds. Smart matching finds collaborators who complement your skills perfectly.", id: "F.01" },
                                { icon: Lightbulb, title: "Discover Innovation",   desc: "Browse cutting-edge projects or launch your own. Get inspired by what others are building and find opportunities to contribute.", id: "F.02" },
                                { icon: ListTodo, title: "Seamless Collaboration", desc: "Integrated tools for task management, real-time messaging, and progress tracking. Everything you need in one place.",              id: "F.03" },
                            ].map((feature) => (
                                <div key={feature.id} className="bg-background p-8 group hover:bg-muted/20 transition-colors border-t-2 border-t-transparent hover:border-t-primary">
                                    <div className="text-xs font-mono text-muted-foreground mb-5 tracking-widest">{feature.id}</div>
                                    <div className="w-10 h-10 border border-border flex items-center justify-center mb-6 group-hover:border-primary transition-colors">
                                        <feature.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                    <h3 className="text-base font-semibold mb-3">{feature.title}</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                                </div>
                            ))}
                        </div>

                        {/* Secondary feature row */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                            {[
                                { icon: Shield,    title: "Secure & Private",  desc: "Enterprise-grade security for your data" },
                                { icon: TrendingUp, title: "Track Progress",   desc: "Real-time analytics and insights" },
                                { icon: Zap,       title: "Lightning Fast",    desc: "Optimized for speed and performance" },
                            ].map((feature, i) => (
                                <div key={i} className="flex gap-4 p-5 border border-border hover:border-primary transition-colors group">
                                    <div className="flex-shrink-0 w-9 h-9 border border-border group-hover:border-primary flex items-center justify-center transition-colors">
                                        <feature.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm mb-1">{feature.title}</h3>
                                        <p className="text-xs text-muted-foreground">{feature.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                    </div>
                </section>

                {/* ── Featured Projects ──────────────────────────────── */}
                <section className="py-24 border-b bg-muted/10">
                    <div className="container px-4 md:px-6 max-w-7xl mx-auto">

                        <div className="mb-16">
                            <div className="inline-flex items-center gap-2 border border-border px-3 py-1.5 text-xs font-mono tracking-widest uppercase text-muted-foreground mb-4">
                                <Activity className="h-3 w-3" />
                                SYS:03 — FEATURED PROJECTS
                            </div>
                            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Active Collaborations</h2>
                            <p className="mt-3 text-muted-foreground max-w-lg text-sm leading-relaxed">Explore innovative projects happening right now.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                { title: "AI-Powered Healthcare Diagnostics",  desc: "Combining medical expertise with AI to develop accessible diagnostic tools for underserved communities.", tags: ["Medicine", "AI", "Data Science"],          members: "3/5", id: "PRJ.001" },
                                { title: "Sustainable Urban Planning",          desc: "Redesigning urban spaces with focus on sustainability, community engagement, and tech integration.",         tags: ["Architecture", "Environment", "Sociology"], members: "4/6", id: "PRJ.002" },
                                { title: "Digital Humanities Archive",          desc: "Creating an interactive digital archive of historical artifacts using advanced visualization.",              tags: ["History", "Computer Science", "Design"],    members: "2/4", id: "PRJ.003" },
                            ].map((project) => (
                                <div key={project.id} className="border border-border bg-background hover:border-primary transition-colors group p-6 flex flex-col">
                                    <div className="flex items-center justify-between mb-5">
                                        <span className="text-xs font-mono text-muted-foreground tracking-widest">{project.id}</span>
                                        <span className="inline-flex items-center gap-1.5 text-xs font-mono border border-primary/30 text-primary px-2 py-0.5">
                                            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                                            ACTIVE
                                        </span>
                                    </div>
                                    <h3 className="text-sm font-semibold mb-3 group-hover:text-primary transition-colors leading-snug">{project.title}</h3>
                                    <p className="text-xs text-muted-foreground mb-4 leading-relaxed flex-1">{project.desc}</p>
                                    <div className="flex flex-wrap gap-2 mb-5">
                                        {project.tags.map((tag, j) => (
                                            <span key={j} className="text-xs font-mono border border-border px-2 py-0.5 text-muted-foreground">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex justify-between items-center pt-4 border-t border-border">
                                        <span className="text-xs font-mono text-muted-foreground">{project.members} MEMBERS</span>
                                        <Link to="#" className="text-xs font-mono text-primary flex items-center gap-1 hover:gap-2 transition-all">
                                            VIEW DETAILS
                                            <ArrowRight className="h-3 w-3" />
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-10">
                            <Button asChild variant="outline" className="rounded-none font-mono text-xs tracking-wider uppercase">
                                <Link to="/projects">
                                    View All Projects
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        </div>

                    </div>
                </section>

                {/* ── Testimonials ───────────────────────────────────── */}
                <section className="py-24 border-b">
                    <div className="container px-4 md:px-6 max-w-7xl mx-auto">

                        <div className="mb-16">
                            <div className="inline-flex items-center gap-2 border border-border px-3 py-1.5 text-xs font-mono tracking-widest uppercase text-muted-foreground mb-4">
                                <Star className="h-3 w-3" />
                                SYS:04 — USER REPORTS
                            </div>
                            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">What Our Users Say</h2>
                            <p className="mt-3 text-muted-foreground max-w-lg text-sm">Join thousands of satisfied collaborators building the future.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                { name: "Jane Smith",          role: "Computer Science Student", initial: "JS", quote: "I found the perfect team for my senior project. The interdisciplinary approach brought fresh perspectives I wouldn't have considered otherwise." },
                                { name: "Michael Rodriguez",   role: "Biomedical Researcher",    initial: "MR", quote: "Finding collaborators from other fields used to be challenging. This platform streamlined the process and helped me form a diverse team for my grant proposal." },
                                { name: "Aisha Patel",         role: "Environmental Engineer",   initial: "AP", quote: "The project management tools made collaboration seamless. We completed our sustainability project with team members from three countries." },
                            ].map((t, i) => (
                                <div key={i} className="border border-border bg-background hover:border-primary transition-colors p-6 flex flex-col">
                                    <div className="flex items-center gap-3 mb-5">
                                        <div className="w-10 h-10 bg-primary flex items-center justify-center text-primary-foreground font-mono font-bold text-sm flex-shrink-0">
                                            {t.initial}
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-sm">{t.name}</h4>
                                            <p className="text-xs font-mono text-muted-foreground tracking-wide">{t.role}</p>
                                        </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-primary/40 pl-3 flex-1">"{t.quote}"</p>
                                    <div className="mt-4 flex gap-1">
                                        {[...Array(5)].map((_, j) => (
                                            <Star key={j} className="h-3 w-3 fill-primary text-primary" />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                    </div>
                </section>

                {/* ── CTA ────────────────────────────────────────────── */}
                <section className="relative overflow-hidden bg-primary text-primary-foreground py-24">
                    <div className="landing-grid-bg-inverted absolute inset-0 pointer-events-none opacity-10" />

                    <div className="relative container px-4 max-w-7xl mx-auto">
                        <div className="max-w-2xl">
                            <div className="inline-flex items-center gap-2 border border-primary-foreground/30 px-3 py-1.5 text-xs font-mono tracking-widest uppercase text-primary-foreground/60 mb-6">
                                <Terminal className="h-3 w-3" />
                                SYS:05 — INITIATE
                            </div>
                            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl mb-4">
                                Ready to Build<br />Something Amazing?
                            </h2>
                            <p className="text-primary-foreground/70 mb-8 max-w-lg leading-relaxed text-base">
                                Join thousands of innovators, researchers, and creators collaborating on groundbreaking projects.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button asChild size="lg" variant="secondary" className="rounded-none font-mono text-xs tracking-wider uppercase px-8">
                                    <Link to="/register">
                                        Start For Free
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Link>
                                </Button>
                                <Button
                                    asChild size="lg" variant="outline"
                                    className="rounded-none font-mono text-xs tracking-wider uppercase px-8 border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground hover:text-primary"
                                >
                                    <Link to="/about">Learn More</Link>
                                </Button>
                            </div>
                            <p className="text-xs font-mono text-primary-foreground/40 mt-6 tracking-widest">
                                NO CREDIT CARD REQUIRED • FREE FOREVER PLAN • CANCEL ANYTIME
                            </p>
                        </div>
                    </div>
                </section>

            </main>

            <Footer />
        </div>
    )
}
