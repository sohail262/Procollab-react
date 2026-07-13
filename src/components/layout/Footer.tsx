import { Link } from "react-router-dom"
import { Instagram, Linkedin, Twitter } from "lucide-react"
import { Logo } from "@/components/layout/Logo"

export function Footer() {
    return (
        <footer className="border-t border-white/[0.06] bg-background">
            <div className="container max-w-7xl mx-auto px-4 py-16 md:py-20">
                <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
                    <div className="space-y-4">
                        <Logo iconSize={38} showText={true} />
                        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                            Connecting minds across disciplines for innovative collaboration and groundbreaking discoveries.
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
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold">Resources</h4>
                        <ul className="space-y-3 text-sm">
                            <li>
                                <Link to="#" className="text-muted-foreground hover:text-primary transition-colors">
                                    Help Center
                                </Link>
                            </li>
                            <li>
                                <Link to="#" className="text-muted-foreground hover:text-primary transition-colors">
                                    Guidelines
                                </Link>
                            </li>
                            <li>
                                <Link to="#" className="text-muted-foreground hover:text-primary transition-colors">
                                    FAQ
                                </Link>
                            </li>
                            <li>
                                <Link to="#" className="text-muted-foreground hover:text-primary transition-colors">
                                    Contact Us
                                </Link>
                            </li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold">Connect With Us</h4>
                        <div className="flex space-x-3">
                            <a href="#" className="w-9 h-9 rounded-full border border-white/[0.08] flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-all">
                                <Twitter className="h-4 w-4" />
                                <span className="sr-only">Twitter</span>
                            </a>
                            <a href="#" className="w-9 h-9 rounded-full border border-white/[0.08] flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-all">
                                <Linkedin className="h-4 w-4" />
                                <span className="sr-only">LinkedIn</span>
                            </a>
                            <a href="#" className="w-9 h-9 rounded-full border border-white/[0.08] flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-all">
                                <Instagram className="h-4 w-4" />
                                <span className="sr-only">Instagram</span>
                            </a>
                        </div>
                    </div>
                </div>

                <div className="mt-14 pt-8 border-t border-white/[0.06] text-center">
                    <p className="text-xs text-muted-foreground/60 font-mono tracking-wider">
                        &copy; {new Date().getFullYear()} ProCollab. All rights reserved. Built for innovators, by innovators.
                    </p>
                </div>
            </div>
        </footer>
    )
}
