import { Link } from "react-router-dom"
import { Users, Lightbulb, ListTodo, Star, ArrowRight, CheckCircle2, Sparkles, Zap, Shield, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"
// IMPORT THE GLOBE
import { HeroGlobe } from "@/components/HeroGlobe"

export function Landing() {
    return (
        <div className="flex min-h-screen flex-col">
            <Navbar />

            <main className="flex-1">
                {/* Hero Section */}
                <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-950 dark:via-blue-950 dark:to-indigo-950">

                    {/* Background Blobs (Kept subtle behind everything) */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 dark:bg-purple-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-30 animate-blob"></div>
                        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300 dark:bg-blue-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
                    </div>

                    <div className="container relative px-4 py-12 md:py-24 lg:py-32 max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

                            {/* LEFT COLUMN: Text Content */}
                            <div className="flex flex-col items-center lg:items-start text-center lg:text-left z-10">
                                <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-blue-100 dark:bg-blue-900/30 px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 backdrop-blur-sm">
                                    <Sparkles className="h-4 w-4" />
                                    <span>Trusted by 10,000+ collaborators worldwide</span>
                                </div>

                                <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-900 dark:from-white dark:via-blue-200 dark:to-indigo-200 bg-clip-text text-transparent">
                                    Where Ideas Meet <br className="hidden lg:block" /> Innovation
                                </h1>

                                <p className="mb-10 text-lg text-gray-600 dark:text-gray-300 md:text-xl leading-relaxed max-w-2xl">
                                    Connect with brilliant minds across disciplines. Build groundbreaking projects. Transform your ideas into reality with the perfect team.
                                </p>

                                <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                                    <Button asChild size="lg" className="text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group">
                                        <Link to="/register">
                                            Get Started Free
                                            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                        </Link>
                                    </Button>
                                    <Button asChild variant="outline" size="lg" className="text-lg px-8 py-6 border-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300">
                                        <Link to="/projects">Explore Projects</Link>
                                    </Button>
                                </div>

                                <div className="mt-8 flex flex-col sm:flex-row gap-4 text-sm text-gray-600 dark:text-gray-400">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                        <span>No credit card required</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                        <span>Free forever plan</span>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT COLUMN: The 3D Globe */}
                            <div className="relative h-[400px] lg:h-[600px] w-full flex items-center justify-center">
                                <HeroGlobe />
                            </div>

                        </div>
                    </div>
                </section>

                {/* Stats Section */}
                <section className="border-y bg-white dark:bg-gray-950">
                    <div className="container px-4 py-16 max-w-7xl mx-auto">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                            <div className="space-y-2">
                                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">10K+</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">Active Users</div>
                            </div>
                            <div className="space-y-2">
                                <div className="text-4xl font-bold text-purple-600 dark:text-purple-400">5K+</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">Projects Completed</div>
                            </div>
                            <div className="space-y-2">
                                <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">50+</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">Countries</div>
                            </div>
                            <div className="space-y-2">
                                <div className="text-4xl font-bold text-green-600 dark:text-green-400">98%</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">Satisfaction Rate</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Features Section */}
                <section className="py-24 bg-gradient-to-b from-white to-gray-50 dark:from-gray-950 dark:to-gray-900">
                    <div className="container px-4 md:px-6 max-w-7xl mx-auto">
                        <div className="text-center mb-16 space-y-4">
                            <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 dark:bg-blue-900/30 px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300">
                                <Zap className="h-4 w-4" />
                                <span>Powerful Features</span>
                            </div>
                            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">Everything You Need to Succeed</h2>
                            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                                Built for modern teams who want to collaborate without boundaries
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <Card className="group relative overflow-hidden border-2 hover:border-blue-500 dark:hover:border-blue-400 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <CardHeader>
                                    <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <Users className="text-blue-600 dark:text-blue-400 h-7 w-7" />
                                    </div>
                                    <CardTitle className="text-2xl">Find Your Dream Team</CardTitle>
                                    <CardDescription className="text-base leading-relaxed">
                                        Connect with talented individuals from diverse backgrounds. Our smart matching algorithm finds collaborators who complement your skills perfectly.
                                    </CardDescription>
                                </CardHeader>
                            </Card>

                            <Card className="group relative overflow-hidden border-2 hover:border-purple-500 dark:hover:border-purple-400 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2">
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <CardHeader>
                                    <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <Lightbulb className="text-purple-600 dark:text-purple-400 h-7 w-7" />
                                    </div>
                                    <CardTitle className="text-2xl">Discover Innovation</CardTitle>
                                    <CardDescription className="text-base leading-relaxed">
                                        Browse cutting-edge projects or launch your own. Get inspired by what others are building and find opportunities to contribute.
                                    </CardDescription>
                                </CardHeader>
                            </Card>

                            <Card className="group relative overflow-hidden border-2 hover:border-indigo-500 dark:hover:border-indigo-400 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2">
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <CardHeader>
                                    <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <ListTodo className="text-indigo-600 dark:text-indigo-400 h-7 w-7" />
                                    </div>
                                    <CardTitle className="text-2xl">Seamless Collaboration</CardTitle>
                                    <CardDescription className="text-base leading-relaxed">
                                        Integrated tools for task management, real-time messaging, and progress tracking. Everything you need in one place.
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
                            {[
                                { icon: Shield, title: "Secure & Private", desc: "Enterprise-grade security for your data" },
                                { icon: TrendingUp, title: "Track Progress", desc: "Real-time analytics and insights" },
                                { icon: Zap, title: "Lightning Fast", desc: "Optimized for speed and performance" },
                            ].map((feature, i) => (
                                <div key={i} className="flex gap-4 p-6 rounded-xl bg-white dark:bg-gray-900 border hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                                    <div className="flex-shrink-0">
                                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                                            <feature.icon className="h-5 w-5 text-white" />
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold mb-1">{feature.title}</h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">{feature.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Featured Projects Section */}
                <section className="py-24 bg-white dark:bg-gray-950">
                    <div className="container px-4 md:px-6 max-w-7xl mx-auto">
                        <div className="text-center mb-16 space-y-4">
                            <div className="inline-flex items-center gap-2 rounded-full bg-purple-100 dark:bg-purple-900/30 px-4 py-2 text-sm font-medium text-purple-700 dark:text-purple-300">
                                <Star className="h-4 w-4" />
                                <span>Trending Now</span>
                            </div>
                            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">Featured Projects</h2>
                            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                                Explore innovative collaborations happening right now
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {[
                                {
                                    title: "AI-Powered Healthcare Diagnostics",
                                    desc: "Combining medical expertise with AI to develop accessible diagnostic tools for underserved communities.",
                                    tags: ["Medicine", "AI", "Data Science"],
                                    members: "3/5",
                                    gradient: "from-blue-500 to-cyan-500"
                                },
                                {
                                    title: "Sustainable Urban Planning",
                                    desc: "Redesigning urban spaces with focus on sustainability, community engagement, and tech integration.",
                                    tags: ["Architecture", "Environment", "Sociology"],
                                    members: "4/6",
                                    gradient: "from-green-500 to-emerald-500"
                                },
                                {
                                    title: "Digital Humanities Archive",
                                    desc: "Creating an interactive digital archive of historical artifacts using advanced visualization.",
                                    tags: ["History", "Computer Science", "Design"],
                                    members: "2/4",
                                    gradient: "from-purple-500 to-pink-500"
                                },
                            ].map((project, i) => (
                                <Card key={i} className="group overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-2 hover:border-blue-500 dark:hover:border-blue-400">
                                    <div className={`h-2 bg-gradient-to-r ${project.gradient}`}></div>
                                    <CardContent className="p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="inline-flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 px-3 py-1 rounded-full text-sm font-medium">
                                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                                Active
                                            </span>
                                        </div>
                                        <h3 className="text-xl font-bold mb-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{project.title}</h3>
                                        <p className="text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">{project.desc}</p>
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {project.tags.map((tag, j) => (
                                                <span key={j} className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                        <div className="flex justify-between items-center pt-4 border-t">
                                            <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">{project.members} members</span>
                                            <Link to="#" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                                                View Details
                                                <ArrowRight className="h-4 w-4" />
                                            </Link>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <div className="text-center mt-12">
                            <Button asChild size="lg" variant="outline" className="text-lg px-8 py-6 border-2 hover:bg-blue-50 dark:hover:bg-blue-950 hover:border-blue-500 transition-all duration-300">
                                <Link to="/projects">
                                    View All Projects
                                    <ArrowRight className="ml-2 h-5 w-5" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                </section>

                {/* Testimonials Section */}
                <section className="py-24 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
                    <div className="container px-4 md:px-6 max-w-7xl mx-auto">
                        <div className="text-center mb-16 space-y-4">
                            <div className="inline-flex items-center gap-2 rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-4 py-2 text-sm font-medium text-yellow-700 dark:text-yellow-300">
                                <Star className="h-4 w-4 fill-current" />
                                <span>Loved by Thousands</span>
                            </div>
                            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">What Our Users Say</h2>
                            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                                Join thousands of satisfied collaborators building the future
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {[
                                { name: "Jane Smith", role: "Computer Science Student", initial: "JS", quote: "I found the perfect team for my senior project. The interdisciplinary approach brought fresh perspectives I wouldn't have considered otherwise." },
                                { name: "Michael Rodriguez", role: "Biomedical Researcher", initial: "MR", quote: "Finding collaborators from other fields used to be challenging. This platform streamlined the process and helped me form a diverse team for my grant proposal." },
                                { name: "Aisha Patel", role: "Environmental Engineer", initial: "AP", quote: "The project management tools made collaboration seamless despite our different backgrounds. We successfully completed our sustainability project with team members from three countries." },
                            ].map((testimonial, i) => (
                                <Card key={i} className="group hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-2 hover:border-purple-500 dark:hover:border-purple-400">
                                    <CardContent className="p-8">
                                        <div className="flex items-center mb-6">
                                            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg border-4 border-white dark:border-gray-900 shadow-lg">
                                                {testimonial.initial}
                                            </div>
                                            <div className="ml-4">
                                                <h4 className="font-semibold text-lg">{testimonial.name}</h4>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">{testimonial.role}</p>
                                            </div>
                                        </div>
                                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed italic mb-4">"{testimonial.quote}"</p>
                                        <div className="flex text-yellow-400">
                                            {[...Array(5)].map((_, j) => (
                                                <Star key={j} className="h-5 w-5 fill-current" />
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </section>

                {/* CTA Section */}
                <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white py-24">
                    <div className="absolute inset-0 bg-grid-white/10"></div>
                    <div className="absolute inset-0">
                        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
                        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
                    </div>

                    <div className="relative container px-4 text-center max-w-7xl mx-auto">
                        <div className="max-w-4xl mx-auto space-y-8">
                            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">Ready to Build Something Amazing?</h2>
                            <p className="text-xl md:text-2xl text-blue-100 max-w-2xl mx-auto leading-relaxed">
                                Join thousands of innovators, researchers, and creators collaborating on groundbreaking projects
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
                                <Button asChild size="lg" variant="secondary" className="text-lg px-10 py-6 shadow-2xl hover:shadow-3xl hover:scale-105 transition-all duration-300 group">
                                    <Link to="/register">
                                        Start For Free
                                        <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                    </Link>
                                </Button>
                                <Button asChild size="lg" variant="outline" className="text-lg px-10 py-6 border-2 border-white text-white hover:bg-white hover:text-blue-600 transition-all duration-300">
                                    <Link to="/about">Learn More</Link>
                                </Button>
                            </div>
                            <p className="text-sm text-blue-200 pt-4">No credit card required • Free forever plan • Cancel anytime</p>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    )
}