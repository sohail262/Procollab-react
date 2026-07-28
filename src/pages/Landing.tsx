import { Link, useNavigate } from "react-router-dom"
import { SEOHead, buildWebsiteSchema, buildOrganizationSchema, buildSoftwareAppSchema, buildFAQSchema } from "@/components/seo/SEOHead"
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
    const workflowRef = useRef<HTMLDivElement>(null)
    const ctaRef = useRef<HTMLDivElement>(null)
    const orb1Ref = useRef<HTMLDivElement>(null)
    const orb2Ref = useRef<HTMLDivElement>(null)
    const orb3Ref = useRef<HTMLDivElement>(null)
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
                    buildFAQSchema([
                        {
                            question: "What is ProCollab?",
                            answer: "ProCollab is India's leading unified student project platform where college students showcase final year projects, discover domain-wise ideas, and recruit teammates.",
                        },
                        {
                            question: "How do I find teammates for my college capstone or final year project?",
                            answer: "On ProCollab's Discover page, you can filter by academic discipline and specific skills (e.g., React, Python, Machine Learning, Figma) to invite verified student collaborators.",
                        },
                        {
                            question: "How can I showcase my completed project to tech recruiters?",
                            answer: "ProCollab provides recruiter-ready public showcase pages (/project/public/:id) complete with task analytics, GitHub repository links, live demos, and exportable STAR method resume bullet points.",
                        },
                    ]),
                ]}
            />
            <LandingNavbar />

            <main className="flex-1">

                {/* ── Hero ───────────────────────────────────────────── */}
                <section className="relative overflow-hidden bg-background min-h-screen flex items-center">

                    <div ref={heroRef} className="container relative px-4 pt-28 pb-16 md:pt-36 md:pb-20 max-w-7xl mx-auto w-full z-10">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

                            {/* Left column */}
                            <div className="flex flex-col items-start text-left">
                                <div className="hero-badge mb-6 inline-flex items-center gap-2 border border-primary/40 px-3 py-1.5 text-xs font-mono tracking-widest uppercase text-primary">
                                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                                    STUDENT PROJECT COLLABORATION
                                </div>

                                <h1 className="hero-heading mb-6 text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl text-foreground leading-none">
                                    Build Projects<br className="hidden md:block" /> With Great Teams
                                </h1>

                                <p className="hero-desc mb-10 text-base text-muted-foreground md:text-lg leading-relaxed max-w-lg border-l-2 border-primary/50 pl-4">
                                    Find teammates by skill, showcase your projects, get access to various tools and build a portfolio that recruiters love.
                                </p>

                                <div className="flex flex-row flex-wrap gap-2 md:gap-3 w-full sm:w-auto items-center">
                                    <Button asChild size="lg" className="hero-cta w-[145px] xs:w-44 sm:w-auto text-xs sm:text-sm px-4 sm:px-8 h-10 sm:h-12 rounded-none font-mono tracking-wider uppercase btn-glow-amber">
                                        <Link to="/register" className="justify-center">
                                            Get Started
                                            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                                        </Link>
                                    </Button>
                                    <Button asChild variant="outline" size="lg" className="hero-cta w-[145px] xs:w-44 sm:w-auto text-xs sm:text-sm px-4 sm:px-8 h-10 sm:h-12 rounded-none font-mono tracking-wider uppercase">
                                        <Link to="/discover" className="justify-center">Explore Projects</Link>
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

                {/* ── 1. Features Section (Placed First Above Why ProCollab) ───── */}
                <section ref={featuresRef} className="py-24 border-t border-b border-white/[0.06] relative overflow-hidden">
                    <div className="container px-4 md:px-6 max-w-7xl mx-auto relative z-10">

                        <div className="section-header mb-16 text-center">
                            <div className="inline-flex items-center gap-2 border border-primary/30 px-3 py-1.5 text-xs font-mono tracking-widest uppercase text-primary mb-4 rounded-full">
                                <Zap className="h-3 w-3" />
                                PLATFORM FEATURES
                            </div>
                            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">Everything You Need<br />To Build Great Projects</h2>
                            <p className="mt-4 text-muted-foreground max-w-xl mx-auto text-sm md:text-base leading-relaxed">
                                Simple, easy-to-use tools designed to help students collaborate, track progress, and showcase completed work.
                            </p>
                        </div>

                        {/* Primary feature cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border border border-border">
                            {[
                                { icon: Users, title: "Find Your Dream Team", desc: "Search for project partners by specific skills like React, Python, Machine Learning, or UI Design.", id: "01" },
                                { icon: Lightbulb, title: "Discover Project Ideas", desc: "Browse real student projects, hackathon ideas, and open team positions across different streams.", id: "02" },
                                { icon: ListTodo, title: "Easy Task Tracking", desc: "Keep group work organized with simple Kanban task boards and clear project milestone trackers.", id: "03" },
                            ].map((feature) => (
                                <div key={feature.id} className="feature-primary bg-background p-8 group hover:bg-muted/20 transition-colors border-t-2 border-t-transparent hover:border-t-primary">
                                    <div className="text-xs font-mono text-muted-foreground mb-5 tracking-widest">FEATURE {feature.id}</div>
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
                                { icon: Shield, title: "Safe & Organized", desc: "Keep project files, discussions, and tasks in one place." },
                                { icon: TrendingUp, title: "Public Showcase Link", desc: "Share your finished project link on your resume for recruiters." },
                                { icon: Zap, title: "Fast & Mobile Friendly", desc: "Works smoothly on both your phone and laptop." },
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

                {/* ── 2. Why ProCollab Section (Placed in Active Collaborations Spot) ── */}
                <section ref={whyRef} className="relative py-24 border-b border-white/[0.06] bg-muted/10 overflow-hidden">
                    {/* Parallax orb */}
                    <div ref={orb3Ref} className="parallax-orb parallax-orb-amber w-[500px] h-[500px] -right-40 top-0 opacity-30" />

                    <div className="container px-4 max-w-7xl mx-auto relative z-10">
                        <div className="section-header text-center mb-16">
                            <div className="inline-flex items-center gap-2 border border-primary/30 px-4 py-1.5 text-xs font-mono tracking-widest uppercase text-primary mb-6 rounded-full">
                                WHY PROCOLLAB
                            </div>
                            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl mb-4">
                                Why Students <span className="text-primary">Love ProCollab</span>
                            </h2>
                            <p className="text-muted-foreground max-w-xl mx-auto text-sm md:text-base leading-relaxed">
                                Group projects don't have to be stressful. ProCollab helps you find reliable partners and turn your ideas into reality.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                            {[
                                {
                                    icon: Layers,
                                    title: "Cross-College Teaming",
                                    desc: "Connect with students across different colleges, departments, and skill levels. Combine developers, designers, and domain experts effortlessly.",
                                    accent: "from-primary/20 to-primary/5",
                                    borderAccent: "group-hover:border-primary/30",
                                },
                                {
                                    icon: Zap,
                                    title: "Zero Confusion",
                                    desc: "No complicated enterprise setups or scattered WhatsApp groups. Post your idea, invite teammates, and start building right away.",
                                    accent: "from-primary/15 to-transparent",
                                    borderAccent: "group-hover:border-primary/30",
                                },
                                {
                                    icon: Rocket,
                                    title: "Recruiter-Ready Portfolios",
                                    desc: "Turn your college assignments and capstones into verified public project links complete with live demos and task metrics.",
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

                {/* ── 3. How It Works Section ───────────────────────────── */}
                <section ref={workflowRef} className="py-24 border-b border-white/[0.06] relative overflow-hidden">
                    <div className="container px-4 md:px-6 max-w-7xl mx-auto relative z-10">
                        <div className="section-header text-center mb-20">
                            <div className="inline-flex items-center gap-2 border border-border px-4 py-1.5 text-xs font-mono tracking-widest uppercase text-muted-foreground mb-6 rounded-full">
                                <Terminal className="h-3 w-3" />
                                SIMPLE PROCESS
                            </div>
                            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">How It Works in 3 Easy Steps</h2>
                            <p className="mt-4 text-muted-foreground max-w-lg mx-auto text-sm md:text-base leading-relaxed">
                                Getting started is quick and straightforward.
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
                                        title: "Post Your Project Idea",
                                        desc: "Describe what you want to build and the skills you're looking for. Takes less than 2 minutes.",
                                        detail: "Quick & Simple Setup",
                                    },
                                    {
                                        step: "02",
                                        icon: Users,
                                        title: "Pick Your Teammates",
                                        desc: "Browse student profiles or review requests from interested peers to form your ideal team.",
                                        detail: "Filter by skills & discipline",
                                    },
                                    {
                                        step: "03",
                                        icon: Rocket,
                                        title: "Build & Share Showcase",
                                        desc: "Organize tasks together on simple boards and share your finished project link with recruiters.",
                                        detail: "Get your project link",
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

                {/* ── 4. CTA Section ──────────────────────────────────── */}
                <section ref={ctaRef} className="relative overflow-hidden py-32">
                    {/* Ambient glow behind text */}
                    <div className="cta-glow-orb absolute inset-0 cta-glow pointer-events-none" />

                    <div className="relative container px-4 max-w-7xl mx-auto z-10">
                        <div className="max-w-3xl mx-auto text-center">
                            <h2 className="cta-animate text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl mb-6">
                                Ready to Build Your Next <span className="text-primary">Great Project?</span>
                            </h2>
                            <p className="cta-animate text-muted-foreground mb-10 max-w-lg mx-auto leading-relaxed text-base md:text-lg">
                                Join thousands of students creating, collaborating, and launching awesome projects on ProCollab.
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
