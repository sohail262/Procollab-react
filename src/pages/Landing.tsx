import { Link, useNavigate } from "react-router-dom"
import { SEOHead, buildWebsiteSchema, buildOrganizationSchema, buildSoftwareAppSchema } from "@/components/seo/SEOHead"
import { Users, Lightbulb, ListTodo, Shield, TrendingUp, Zap, Terminal, Activity, ArrowRight, CheckCircle2, Rocket, Layers, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LandingNavbar } from "@/components/layout/LandingNavbar"
import { Footer } from "@/components/layout/Footer"
import { lazy, Suspense, useEffect, useRef } from "react"
import { useAuth } from "@/contexts/AuthContext"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

// ⚡ OPTIMIZATION: Lazy-load HeroGlobe to defer Three.js (~600KB)
const HeroGlobe = lazy(() =>
    import("@/components/HeroGlobe").then(m => ({ default: m.HeroGlobe }))
)

const GlobePlaceholder = () => (
    <div className="w-full h-full min-h-[400px] lg:min-h-[560px] flex items-center justify-center">
        <div className="font-mono text-xs tracking-widest text-muted-foreground animate-pulse">
            LOADING MAP DATA...
        </div>
    </div>
)

export function Landing() {
    const { user, loading } = useAuth()
    const navigate = useNavigate()

    // ── Redirect logged-in users ──────────────────────────
    useEffect(() => {
        if (!loading && user) {
            navigate("/dashboard", { replace: true })
        }
    }, [user, loading, navigate])

    // ── GSAP refs ─────────────────────────────────────────
    const heroRef = useRef<HTMLDivElement>(null)
    const whyRef = useRef<HTMLDivElement>(null)
    const featuresRef = useRef<HTMLDivElement>(null)
    const projectsRef = useRef<HTMLDivElement>(null)
    const workflowRef = useRef<HTMLDivElement>(null)
    const ctaRef = useRef<HTMLDivElement>(null)
    const orb1Ref = useRef<HTMLDivElement>(null)
    const orb2Ref = useRef<HTMLDivElement>(null)
    const orb3Ref = useRef<HTMLDivElement>(null)
    const orb4Ref = useRef<HTMLDivElement>(null)
    const connectorRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (loading) return

        const ctx = gsap.context(() => {
            // ────────────────────────────────────────────
            // HERO — entrance animations
            // ────────────────────────────────────────────
            if (heroRef.current) {
                const tl = gsap.timeline({ defaults: { ease: "power3.out" } })

                tl.fromTo(heroRef.current.querySelector(".hero-badge"),
                    { opacity: 0, y: 20, scale: 0.9 },
                    { opacity: 1, y: 0, scale: 1, duration: 0.6 },
                    0.4
                )
                tl.fromTo(heroRef.current.querySelector(".hero-heading"),
                    { opacity: 0, y: 40 },
                    { opacity: 1, y: 0, duration: 0.8 },
                    0.55
                )
                tl.fromTo(heroRef.current.querySelector(".hero-desc"),
                    { opacity: 0, y: 30 },
                    { opacity: 1, y: 0, duration: 0.7 },
                    0.75
                )
                tl.fromTo(heroRef.current.querySelectorAll(".hero-cta"),
                    { opacity: 0, y: 20 },
                    { opacity: 1, y: 0, stagger: 0.1, duration: 0.5 },
                    0.9
                )
                tl.fromTo(heroRef.current.querySelector(".hero-trust"),
                    { opacity: 0 },
                    { opacity: 1, duration: 0.5 },
                    1.1
                )
                // Globe container fade
                tl.fromTo(heroRef.current.querySelector(".hero-globe"),
                    { opacity: 0, scale: 0.9 },
                    { opacity: 1, scale: 1, duration: 1.2, ease: "power2.out" },
                    0.6
                )
            }

            // ────────────────────────────────────────────
            // PARALLAX ORBS — scroll-scrubbed movement
            // ────────────────────────────────────────────
            const orbAnimations = [
                { ref: orb1Ref, y: -120, x: 30, scrub: 1.5 },
                { ref: orb2Ref, y: -80, x: -20, scrub: 2 },
                { ref: orb3Ref, y: -100, x: 50, scrub: 1.8 },
                { ref: orb4Ref, y: -60, x: -40, scrub: 2.5 },
            ]

            orbAnimations.forEach(({ ref, y, x, scrub }) => {
                if (ref.current) {
                    gsap.to(ref.current, {
                        y, x,
                        ease: "none",
                        scrollTrigger: {
                            trigger: ref.current,
                            start: "top bottom",
                            end: "bottom top",
                            scrub,
                        },
                    })
                }
            })

            // ────────────────────────────────────────────
            // WHY PROCOLLAB — stagger from bottom
            // ────────────────────────────────────────────
            if (whyRef.current) {
                gsap.fromTo(whyRef.current.querySelector(".section-header"),
                    { opacity: 0, y: 40 },
                    {
                        opacity: 1, y: 0, duration: 0.8, ease: "power3.out",
                        scrollTrigger: { trigger: whyRef.current, start: "top 80%" },
                    }
                )

                gsap.fromTo(whyRef.current.querySelectorAll(".why-card"),
                    { opacity: 0, y: 60 },
                    {
                        opacity: 1, y: 0, stagger: 0.15, duration: 0.8,
                        ease: "power3.out",
                        scrollTrigger: { trigger: whyRef.current, start: "top 70%" },
                    }
                )
            }

            // ────────────────────────────────────────────
            // FEATURES — alternating slide-in
            // ────────────────────────────────────────────
            if (featuresRef.current) {
                gsap.fromTo(featuresRef.current.querySelector(".section-header"),
                    { opacity: 0, y: 40 },
                    {
                        opacity: 1, y: 0, duration: 0.8, ease: "power3.out",
                        scrollTrigger: { trigger: featuresRef.current, start: "top 80%" },
                    }
                )

                const primaryCards = featuresRef.current.querySelectorAll(".feature-primary")
                primaryCards.forEach((card, i) => {
                    gsap.fromTo(card,
                        { opacity: 0, x: i % 2 === 0 ? -50 : 50 },
                        {
                            opacity: 1, x: 0, duration: 0.8,
                            ease: "power3.out",
                            scrollTrigger: { trigger: card, start: "top 85%" },
                        }
                    )
                })

                gsap.fromTo(featuresRef.current.querySelectorAll(".feature-secondary"),
                    { opacity: 0, y: 30 },
                    {
                        opacity: 1, y: 0, stagger: 0.1, duration: 0.6,
                        ease: "power3.out",
                        scrollTrigger: { trigger: featuresRef.current.querySelector(".feature-secondary-grid"), start: "top 85%" },
                    }
                )
            }

            // ────────────────────────────────────────────
            // FEATURED PROJECTS — horizontal stagger
            // ────────────────────────────────────────────
            if (projectsRef.current) {
                gsap.fromTo(projectsRef.current.querySelector(".section-header"),
                    { opacity: 0, y: 40 },
                    {
                        opacity: 1, y: 0, duration: 0.8, ease: "power3.out",
                        scrollTrigger: { trigger: projectsRef.current, start: "top 80%" },
                    }
                )

                gsap.fromTo(projectsRef.current.querySelectorAll(".project-card"),
                    { opacity: 0, y: 50, scale: 0.95 },
                    {
                        opacity: 1, y: 0, scale: 1,
                        stagger: 0.12, duration: 0.7,
                        ease: "back.out(1.2)",
                        scrollTrigger: { trigger: projectsRef.current.querySelector(".projects-grid"), start: "top 80%" },
                    }
                )
            }

            // ────────────────────────────────────────────
            // WORKFLOW — sequential reveal with connector
            // ────────────────────────────────────────────
            if (workflowRef.current) {
                gsap.fromTo(workflowRef.current.querySelector(".section-header"),
                    { opacity: 0, y: 40 },
                    {
                        opacity: 1, y: 0, duration: 0.8, ease: "power3.out",
                        scrollTrigger: { trigger: workflowRef.current, start: "top 80%" },
                    }
                )

                // Connector line fill (horizontal on desktop)
                if (connectorRef.current) {
                    gsap.fromTo(connectorRef.current,
                        { scaleX: 0 },
                        {
                            scaleX: 1, duration: 1.5, ease: "power2.inOut",
                            scrollTrigger: {
                                trigger: workflowRef.current.querySelector(".workflow-steps"),
                                start: "top 75%",
                                end: "bottom 60%",
                                scrub: 1,
                            },
                        }
                    )
                }

                gsap.fromTo(workflowRef.current.querySelectorAll(".step-card"),
                    { opacity: 0, y: 50 },
                    {
                        opacity: 1, y: 0,
                        stagger: 0.2, duration: 0.8,
                        ease: "power3.out",
                        scrollTrigger: { trigger: workflowRef.current.querySelector(".workflow-steps"), start: "top 75%" },
                    }
                )
            }

            // ────────────────────────────────────────────
            // CTA — glow pulse + text reveal
            // ────────────────────────────────────────────
            if (ctaRef.current) {
                gsap.fromTo(ctaRef.current.querySelectorAll(".cta-animate"),
                    { opacity: 0, y: 30 },
                    {
                        opacity: 1, y: 0, stagger: 0.12, duration: 0.7,
                        ease: "power3.out",
                        scrollTrigger: { trigger: ctaRef.current, start: "top 80%" },
                    }
                )

                // Ambient glow animation
                const ctaGlow = ctaRef.current.querySelector(".cta-glow-orb")
                if (ctaGlow) {
                    gsap.to(ctaGlow, {
                        scale: 1.2,
                        opacity: 0.8,
                        duration: 3,
                        ease: "sine.inOut",
                        yoyo: true,
                        repeat: -1,
                    })
                }
            }

        })

        return () => ctx.revert()
    }, [loading])

    // Don't render until auth state is known
    if (loading) return null

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <SEOHead
                title="ProCollab — Student Project Collaboration & Showcase Platform"
                noSuffix
                description="ProCollab is India's #1 platform for students to showcase final year projects, discover domain-wise & skill-wise projects, find teammates, and collaborate in real time. Start your project journey today."
                keywords={[
                    'student project platform India',
                    'final year project showcase',
                    'FYP collaboration tool',
                    'find teammates for project India',
                    'student developer platform',
                    'project ideas for engineering students',
                    'college project sharing platform',
                    'best student project website',
                    'project collaboration for students',
                    'free project management for students',
                    'share project portfolio online',
                    'discover student projects',
                    'domain wise projects',
                    'skill wise projects',
                    'AI ML projects for students',
                    'web dev projects showcase',
                    'IoT projects students',
                    'blockchain student projects',
                    'hackathon team finder',
                    'project partner finder',
                ]}
                canonical="https://procollab.in/"
                structuredData={[
                    buildWebsiteSchema(),
                    buildOrganizationSchema(),
                    buildSoftwareAppSchema(),
                ]}
            />
            <LandingNavbar />

            <main className="flex-1">

                {/* ── Hero ───────────────────────────────────────────── */}
                <section className="relative overflow-hidden bg-background min-h-screen flex items-center">

                    <div ref={heroRef} className="container relative px-4 pt-28 pb-16 md:pt-36 md:pb-20 max-w-7xl mx-auto w-full z-10">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

                            {/* Left column — content unchanged per request */}
                            <div className="flex flex-col items-start text-left">
                                <div className="hero-badge mb-6 inline-flex items-center gap-2 border border-primary/40 px-3 py-1.5 text-xs font-mono tracking-widest uppercase text-primary">
                                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                                    SYS:01 — TRUSTED BY COLLABORATORS
                                </div>

                                <h1 className="hero-heading mb-6 text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl text-foreground leading-none">
                                    Where Ideas<br className="hidden md:block" /> Meet Innovation
                                </h1>

                                <p className="hero-desc mb-10 text-base text-muted-foreground md:text-lg leading-relaxed max-w-lg border-l-2 border-primary/50 pl-4">
                                    Connect with brilliant minds across disciplines. Build groundbreaking projects. Transform your ideas into reality with the perfect team.
                                </p>

                                <div className="flex flex-row flex-wrap gap-2 md:gap-3 w-full sm:w-auto items-center">
                                    <Button asChild size="lg" className="hero-cta w-[145px] xs:w-44 sm:w-auto text-xs sm:text-sm px-4 sm:px-8 h-10 sm:h-12 rounded-none font-mono tracking-wider uppercase btn-glow-amber">
                                        <Link to="/register" className="justify-center">
                                            Get Started
                                            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                                        </Link>
                                    </Button>
                                    <Button asChild variant="outline" size="lg" className="hero-cta w-[145px] xs:w-44 sm:w-auto text-xs sm:text-sm px-4 sm:px-8 h-10 sm:h-12 rounded-none font-mono tracking-wider uppercase">
                                        <Link to="/projects" className="justify-center">Explore Projects</Link>
                                    </Button>
                                </div>
                            </div>

                            {/* Right column: Globe */}
                            <div className="hero-globe relative h-[500px] lg:h-[560px] w-full mt-6 lg:mt-0 flex items-center justify-center">
                                <Suspense fallback={<GlobePlaceholder />}>
                                    <HeroGlobe />
                                </Suspense>
                            </div>

                        </div>
                    </div>
                </section>

                {/* ── Why Procollab ─────────────────────────────────── */}
                <section ref={whyRef} className="relative py-28 border-t border-b border-white/[0.06] overflow-hidden">
                    {/* Parallax orb */}
                    <div ref={orb3Ref} className="parallax-orb parallax-orb-amber w-[500px] h-[500px] -right-40 top-0 opacity-30" />

                    <div className="container px-4 max-w-7xl mx-auto relative z-10">
                        <div className="section-header text-center mb-16">
                            <div className="inline-flex items-center gap-2 border border-primary/30 px-4 py-1.5 text-xs font-mono tracking-widest uppercase text-primary mb-6 rounded-full">

                                WHY PROCOLLAB
                            </div>
                            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl mb-4">
                                Collaboration, <span className="text-primary">Reimagined</span>
                            </h2>
                            <p className="text-muted-foreground max-w-xl mx-auto text-sm md:text-base leading-relaxed">
                                The platform built for people who want to stop talking about ideas and start building them — together.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                            {[
                                {
                                    icon: Layers,
                                    title: "Cross-Disciplinary Teams",
                                    desc: "AI engineers, designers, researchers, and domain experts — all in one space. The best ideas come from the intersection of disciplines.",
                                    accent: "from-primary/20 to-primary/5",
                                    borderAccent: "group-hover:border-primary/30",
                                },
                                {
                                    icon: Zap,
                                    title: "Zero Overhead",
                                    desc: "No bloated project management. Post your idea, find collaborators, start building. We handle the friction so you can focus on the work.",
                                    accent: "from-primary/15 to-transparent",
                                    borderAccent: "group-hover:border-primary/30",
                                },
                                {
                                    icon: Rocket,
                                    title: "Built for Students & Builders",
                                    desc: "Not another enterprise tool. Procollab is built for grassroots innovation — students, indie hackers, researchers, and makers.",
                                    accent: "from-primary/15 to-transparent",
                                    borderAccent: "group-hover:border-primary/30",
                                },
                            ].map((item, i) => (
                                <div key={i} className="why-card group relative">
                                    <div className={`glass-card p-8 h-full transition-all duration-500 ${item.borderAccent}`}>
                                        <span className="glass-sheen" />

                                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.accent} flex items-center justify-center mb-6 border border-white/[0.06] group-hover:border-primary/20 transition-colors`}>
                                            <item.icon className="h-5 w-5 text-primary" />
                                        </div>

                                        <h3 className="text-lg font-semibold mb-3 group-hover:text-primary transition-colors">{item.title}</h3>
                                        <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Features ───────────────────────────────────────── */}
                <section ref={featuresRef} className="py-28 border-b border-white/[0.06] relative overflow-hidden">
                    <div className="container px-4 md:px-6 max-w-7xl mx-auto relative z-10">

                        <div className="section-header mb-16">
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
                                { icon: Users, title: "Find Your Dream Team", desc: "Connect with talented individuals from diverse backgrounds. Smart matching finds collaborators who complement your skills perfectly.", id: "F.01" },
                                { icon: Lightbulb, title: "Discover Innovation", desc: "Browse cutting-edge projects or launch your own. Get inspired by what others are building and find opportunities to contribute.", id: "F.02" },
                                { icon: ListTodo, title: "Seamless Collaboration", desc: "Integrated tools for task management, real-time messaging, and progress tracking. Everything you need in one place.", id: "F.03" },
                            ].map((feature) => (
                                <div key={feature.id} className="feature-primary bg-background p-8 group hover:bg-muted/20 transition-colors border-t-2 border-t-transparent hover:border-t-primary">
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
                        <div className="feature-secondary-grid grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                            {[
                                { icon: Shield, title: "Secure & Private", desc: "Enterprise-grade security for your data" },
                                { icon: TrendingUp, title: "Track Progress", desc: "Real-time analytics and insights" },
                                { icon: Zap, title: "Lightning Fast", desc: "Optimized for speed and performance" },
                            ].map((feature, i) => (
                                <div key={i} className="feature-secondary flex gap-4 p-5 border border-border hover:border-primary transition-colors group">
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
                <section ref={projectsRef} className="py-28 border-b border-white/[0.06] bg-muted/10 relative overflow-hidden">
                    <div ref={orb4Ref} className="parallax-orb parallax-orb-muted w-[500px] h-[500px] -left-40 bottom-0 opacity-50" />

                    <div className="container px-4 md:px-6 max-w-7xl mx-auto relative z-10">

                        <div className="section-header mb-16">
                            <div className="inline-flex items-center gap-2 border border-border px-3 py-1.5 text-xs font-mono tracking-widest uppercase text-muted-foreground mb-4">
                                <Activity className="h-3 w-3" />
                                SYS:03 — FEATURED PROJECTS
                            </div>
                            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Active Collaborations</h2>
                            <p className="mt-3 text-muted-foreground max-w-lg text-sm leading-relaxed">Explore innovative projects happening right now.</p>
                        </div>

                        <div className="projects-grid grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                { title: "AI-Powered Healthcare Diagnostics", desc: "Combining medical expertise with AI to develop accessible diagnostic tools for underserved communities.", tags: ["Medicine", "AI", "Data Science"], members: "3/5", id: "PRJ.001" },
                                { title: "Sustainable Urban Planning", desc: "Redesigning urban spaces with focus on sustainability, community engagement, and tech integration.", tags: ["Architecture", "Environment", "Sociology"], members: "4/6", id: "PRJ.002" },
                                { title: "Digital Humanities Archive", desc: "Creating an interactive digital archive of historical artifacts using advanced visualization.", tags: ["History", "Computer Science", "Design"], members: "2/4", id: "PRJ.003" },
                            ].map((project) => (
                                <div key={project.id} className="project-card border border-border bg-background hover:border-primary transition-all duration-300 group p-6 flex flex-col hover:shadow-[0_8px_30px_-8px_hsl(38_95%_58%/0.1)]">
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

                {/* ── How It Works ───────────────────────────────────── */}
                <section ref={workflowRef} className="py-28 border-b border-white/[0.06] relative overflow-hidden">
                    <div className="container px-4 md:px-6 max-w-7xl mx-auto relative z-10">
                        <div className="section-header text-center mb-20">
                            <div className="inline-flex items-center gap-2 border border-border px-4 py-1.5 text-xs font-mono tracking-widest uppercase text-muted-foreground mb-6 rounded-full">
                                <Terminal className="h-3 w-3" />
                                HOW IT WORKS
                            </div>
                            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">From Idea to Reality<br />in Three Steps</h2>
                            <p className="mt-4 text-muted-foreground max-w-lg mx-auto text-sm md:text-base leading-relaxed">
                                Our platform removes friction from the collaboration process.
                            </p>
                        </div>

                        <div className="workflow-steps relative max-w-5xl mx-auto">
                            {/* Horizontal connector line (desktop) */}
                            <div className="hidden md:block absolute top-16 left-[16.66%] right-[16.66%] h-px bg-border">
                                <div
                                    ref={connectorRef}
                                    className="h-full bg-primary origin-left"
                                    style={{ transform: "scaleX(0)" }}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-8">
                                {[
                                    {
                                        step: "01",
                                        icon: Lightbulb,
                                        title: "Share Your Vision",
                                        desc: "Post your project idea with the skills you need. Define your goals, timeline, and what kind of collaborators you're looking for.",
                                        detail: "Takes less than 5 minutes",
                                    },
                                    {
                                        step: "02",
                                        icon: Users,
                                        title: "Connect with Talent",
                                        desc: "Browse profiles of driven individuals or get matched automatically. Review applications and build your ideal team.",
                                        detail: "Smart matching algorithm",
                                    },
                                    {
                                        step: "03",
                                        icon: Rocket,
                                        title: "Build & Launch",
                                        desc: "Collaborate using built-in tools — task boards, real-time chat, and milestone tracking. Ship your project together.",
                                        detail: "All tools in one place",
                                    },
                                ].map((item, i) => (
                                    <div key={i} className="step-card group flex flex-col items-center">
                                        {/* Step number node */}
                                        <div className="w-12 h-12 rounded-full border-2 border-border group-hover:border-primary bg-background flex items-center justify-center font-mono text-sm font-bold text-muted-foreground group-hover:text-primary transition-all duration-500 relative z-20">
                                            {item.step}
                                        </div>

                                        <div className="glass-card p-8 w-full mt-6 group-hover:border-primary/20 transition-all duration-500 flex-1">
                                            <span className="glass-sheen" />

                                            <div className="w-10 h-10 border border-border group-hover:border-primary flex items-center justify-center mb-5 transition-colors">
                                                <item.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                            </div>

                                            <h3 className="text-base font-semibold mb-3">{item.title}</h3>
                                            <p className="text-sm text-muted-foreground leading-relaxed mb-5">{item.desc}</p>

                                            <div className="flex items-center gap-2 text-xs font-mono text-primary/50 group-hover:text-primary transition-colors">
                                                <span className="w-1.5 h-1.5 bg-current rounded-full" />
                                                {item.detail}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── CTA ────────────────────────────────────────────── */}
                <section ref={ctaRef} className="relative overflow-hidden py-32">
                    {/* Ambient glow behind text */}
                    <div className="cta-glow-orb absolute inset-0 cta-glow pointer-events-none" />

                    <div className="relative container px-4 max-w-7xl mx-auto z-10">
                        <div className="max-w-3xl mx-auto text-center">
                            <h2 className="cta-animate text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl mb-6">
                                Ready to Build<br />Something <span className="text-primary">Amazing?</span>
                            </h2>
                            <p className="cta-animate text-muted-foreground mb-10 max-w-lg mx-auto leading-relaxed text-base md:text-lg">
                                Join the community of innovators, researchers, and creators shaping the future of collaboration.
                            </p>
                            <div className="cta-animate flex flex-col sm:flex-row gap-3 justify-center">
                                <Button asChild size="lg" className="rounded-none font-mono text-xs tracking-wider uppercase px-10 btn-glow-amber">
                                    <Link to="/register">
                                        Get Started
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                </section>

            </main>

            <Footer />
        </div>
    )
}
