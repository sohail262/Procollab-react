import { useState } from "react"
import { Link } from "react-router-dom"
import { Instagram, Linkedin, Twitter, Phone, Mail, FileText, HelpCircle, X } from "lucide-react"
import { Logo } from "@/components/layout/Logo"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

export function Footer() {
    const [openModal, setOpenModal] = useState<'guidelines' | 'faq' | 'contact' | null>(null)

    return (
        <footer className="border-t border-white/[0.06] bg-background">
            <div className="container max-w-7xl mx-auto px-4 py-16 md:py-20">
                <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
                    <div className="space-y-4">
                        <Logo iconSize={38} showText={true} />
                        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                            India's leading platform for students to showcase projects, find teammates, and build real-world portfolios.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold">Quick Links</h4>
                        <ul className="space-y-3 text-sm">
                            <li>
                                <Link to="/" className="text-muted-foreground hover:text-primary transition-colors">
                                    Home
                                </Link>
                            </li>
                            <li>
                                <Link to="/projects" className="text-muted-foreground hover:text-primary transition-colors">
                                    Projects
                                </Link>
                            </li>
                            <li>
                                <Link to="/discover" className="text-muted-foreground hover:text-primary transition-colors">
                                    Discover
                                </Link>
                            </li>
                            <li>
                                <Link to="/trending-topics" className="text-muted-foreground hover:text-primary transition-colors">
                                    Trending Topics
                                </Link>
                            </li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold">Resources</h4>
                        <ul className="space-y-3 text-sm">
                            <li>
                                <button
                                    onClick={() => setOpenModal('guidelines')}
                                    className="text-muted-foreground hover:text-primary transition-colors text-left"
                                >
                                    Guidelines
                                </button>
                            </li>
                            <li>
                                <button
                                    onClick={() => setOpenModal('faq')}
                                    className="text-muted-foreground hover:text-primary transition-colors text-left"
                                >
                                    FAQ
                                </button>
                            </li>
                            <li>
                                <button
                                    onClick={() => setOpenModal('contact')}
                                    className="text-muted-foreground hover:text-primary transition-colors text-left"
                                >
                                    Contact Us
                                </button>
                            </li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold">Connect With Us</h4>
                        <div className="flex space-x-3">
                            <a href="https://twitter.com/ProCollab_in" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full border border-white/[0.08] flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-all">
                                <Twitter className="h-4 w-4" />
                                <span className="sr-only">Twitter</span>
                            </a>
                            <a href="https://www.linkedin.com/company/procollab" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full border border-white/[0.08] flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-all">
                                <Linkedin className="h-4 w-4" />
                                <span className="sr-only">LinkedIn</span>
                            </a>
                            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full border border-white/[0.08] flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-all">
                                <Instagram className="h-4 w-4" />
                                <span className="sr-only">Instagram</span>
                            </a>
                        </div>
                        <div className="pt-2 text-xs text-muted-foreground space-y-1">
                            <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-primary" /> +91 7981813039</p>
                            <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-primary" /> mohd26sohail@gmail.com</p>
                        </div>
                    </div>
                </div>

                <div className="mt-14 pt-8 border-t border-white/[0.06] text-center">
                    <p className="text-xs text-muted-foreground/60 font-mono tracking-wider">
                        &copy; {new Date().getFullYear()} ProCollab. All rights reserved. Built for student innovators.
                    </p>
                </div>
            </div>

            {/* ── Guidelines Modal ────────────────────────────────────────── */}
            <Dialog open={openModal === 'guidelines'} onOpenChange={(open) => !open && setOpenModal(null)}>
                <DialogContent className="max-w-xl bg-background border border-border text-foreground p-6 sm:p-8 shadow-2xl rounded-lg">
                    <DialogHeader className="space-y-2 text-left border-b border-border pb-4">
                        <div className="inline-flex items-center gap-2 border border-border px-2.5 py-1 text-[11px] font-mono tracking-widest uppercase text-muted-foreground w-fit">
                            <FileText className="h-3.5 w-3.5" />
                            COMMUNITY GUIDELINES
                        </div>
                        <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                            Platform Guidelines
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                            Standards designed to keep ProCollab safe, collaborative, and productive.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 mt-4">
                        {[
                            {
                                num: "01",
                                title: "Respectful Collaboration",
                                desc: "Treat fellow student collaborators with professional respect regardless of experience level, background, or academic stream.",
                            },
                            {
                                num: "02",
                                title: "Authentic Work & Fair Credit",
                                desc: "Share genuine project updates and ensure appropriate contribution credit is assigned to all team members.",
                            },
                            {
                                num: "03",
                                title: "Purposeful Content",
                                desc: "Keep discussions, posts, and project invitations focused on real academic, hackathon, or portfolio deliverables.",
                            },
                            {
                                num: "04",
                                title: "Privacy & Data Security",
                                desc: "Do not post confidential academic datasets, passwords, or personal identifying information without team consent.",
                            },
                        ].map((g) => (
                            <div key={g.num} className="p-4 border border-border bg-card/40 flex items-start gap-4">
                                <span className="font-mono text-xs font-bold text-primary px-2 py-0.5 border border-border bg-background">
                                    {g.num}
                                </span>
                                <div className="space-y-1">
                                    <h4 className="font-semibold text-sm text-foreground">{g.title}</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{g.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── FAQ Modal ────────────────────────────────────────────────── */}
            <Dialog open={openModal === 'faq'} onOpenChange={(open) => !open && setOpenModal(null)}>
                <DialogContent className="max-w-xl bg-background border border-border text-foreground p-6 sm:p-8 shadow-2xl rounded-lg">
                    <DialogHeader className="space-y-2 text-left border-b border-border pb-4">
                        <div className="inline-flex items-center gap-2 border border-border px-2.5 py-1 text-[11px] font-mono tracking-widest uppercase text-muted-foreground w-fit">
                            <HelpCircle className="h-3.5 w-3.5" />
                            KNOWLEDGE BASE
                        </div>
                        <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                            Frequently Asked Questions
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                            Answers to common questions about finding teammates and managing projects.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 mt-4">
                        {[
                            {
                                q: "What is ProCollab?",
                                a: "ProCollab is a project platform designed for students to share capstones, assemble cross-disciplinary teams, and build developer portfolios.",
                            },
                            {
                                q: "How do I find teammates for my project?",
                                a: "Create a project listing specifying required skills (React, Python, Machine Learning, UI/UX) or use the Discover page to search student profiles and send invitations.",
                            },
                            {
                                q: "How do recruiters review completed projects?",
                                a: "Every completed project receives a public showcase link featuring live demo URLs, task completion metrics, and GitHub repository links for your resume.",
                            },
                        ].map((faq, i) => (
                            <div key={i} className="p-4 border border-border bg-card/40 space-y-1.5">
                                <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                    {faq.q}
                                </h4>
                                <p className="text-xs text-muted-foreground leading-relaxed pl-3.5">{faq.a}</p>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Contact Modal ───────────────────────────────────────────── */}
            <Dialog open={openModal === 'contact'} onOpenChange={(open) => !open && setOpenModal(null)}>
                <DialogContent className="max-w-md bg-background border border-border text-foreground p-6 sm:p-8 shadow-2xl rounded-lg">
                    <DialogHeader className="space-y-2 text-left border-b border-border pb-4">
                        <div className="inline-flex items-center gap-2 border border-border px-2.5 py-1 text-[11px] font-mono tracking-widest uppercase text-muted-foreground w-fit">
                            <Mail className="h-3.5 w-3.5 text-primary" />
                            CONTACT SUPPORT
                        </div>
                        <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                            Contact Us
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                            Get in touch directly with the ProCollab team.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 mt-5">
                        <a
                            href="tel:7981813039"
                            className="flex items-center justify-between p-4 border border-border bg-card/40 hover:border-primary transition-colors group"
                        >
                            <div className="flex items-center gap-3.5">
                                <div className="p-2.5 border border-border bg-background text-muted-foreground group-hover:text-primary transition-colors">
                                    <Phone className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Phone / WhatsApp</p>
                                    <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">+91 7981813039</p>
                                </div>
                            </div>
                            <span className="text-[10px] font-mono uppercase tracking-widest text-primary border border-primary/30 px-2 py-1">
                                Call
                            </span>
                        </a>

                        <a
                            href="mailto:mohd26sohail@gmail.com"
                            className="flex items-center justify-between p-4 border border-border bg-card/40 hover:border-primary transition-colors group"
                        >
                            <div className="flex items-center gap-3.5">
                                <div className="p-2.5 border border-border bg-background text-muted-foreground group-hover:text-primary transition-colors">
                                    <Mail className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Email Support</p>
                                    <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">mohd26sohail@gmail.com</p>
                                </div>
                            </div>
                            <span className="text-[10px] font-mono uppercase tracking-widest text-primary border border-primary/30 px-2 py-1">
                                Mail
                            </span>
                        </a>
                    </div>
                </DialogContent>
            </Dialog>
        </footer>
    )
}

