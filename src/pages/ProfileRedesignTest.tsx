import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Mail,
  MapPin,
  Code2,
  Edit,
  Github,
  Linkedin,
  Globe,
  ExternalLink,
  Zap,
  Target,
  TrendingUp,
  Award,
  MessageSquare,
  Users
} from 'lucide-react';

export const ProfileRedesignTest: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  // Mock data
  const profileData = {
    name: user?.displayName || 'Mohammed Sohail',
    email: user?.email || 'mohd26sohail@gmail.com',
    tagline: 'Full-Stack Developer & Problem Solver',
    location: 'City, Country',
    availability: 'Available for Projects',
    stats: {
      projects: 12,
      contributions: 156,
      connections: 45,
      rating: 4.8
    },
    topSkills: ['React', 'Node.js', 'TypeScript', 'Python', 'MongoDB'],
    recentWork: [
      { name: 'E-Commerce Platform', type: 'Full Stack', color: 'from-blue-500 to-cyan-500' },
      { name: 'AI Chatbot', type: 'Backend', color: 'from-purple-500 to-pink-500' },
      { name: 'Mobile App', type: 'Frontend', color: 'from-orange-500 to-red-500' }
    ],
    interests: ['Web Development', 'AI/ML', 'Open Source', 'UI/UX'],
    socialLinks: [
      { platform: 'GitHub', url: 'github.com/username', icon: Github, color: 'hover:bg-gray-900' },
      { platform: 'LinkedIn', url: 'linkedin.com/in/username', icon: Linkedin, color: 'hover:bg-blue-600' },
      { platform: 'Portfolio', url: 'portfolio.com', icon: Globe, color: 'hover:bg-indigo-600' }
    ]
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Floating Navigation */}
      <div className="fixed top-6 left-6 right-6 z-50 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard')}
          className="bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/profile')}
          className="bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20"
        >
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        {/* Bento Grid Layout */}
        <div className="grid grid-cols-12 gap-4 auto-rows-[140px]">
          
          {/* Hero Card - Large */}
          <Card 
            className="col-span-12 md:col-span-8 row-span-3 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 border-0 overflow-hidden relative group"
            onMouseEnter={() => setHoveredCard('hero')}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div className="absolute inset-0 bg-black/20"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            
            {/* Animated background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]"></div>
            </div>

            <CardContent className="relative h-full flex flex-col justify-between p-8">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-md border-2 border-white/30 flex items-center justify-center text-2xl font-bold shadow-2xl">
                    {getInitials(profileData.name)}
                  </div>
                  <div>
                    <h1 className="text-4xl font-bold mb-1">{profileData.name}</h1>
                    <p className="text-xl text-white/90">{profileData.tagline}</p>
                  </div>
                </div>
                <Badge className="bg-green-500/20 text-green-300 border-green-400/30 backdrop-blur-md">
                  {profileData.availability}
                </Badge>
              </div>

              <div className="flex items-center gap-6 text-white/80">
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {profileData.location}
                </span>
                <span className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {profileData.email}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Stats Card */}
          <Card className="col-span-12 md:col-span-4 row-span-3 bg-white/5 backdrop-blur-md border border-white/10 overflow-hidden">
            <CardContent className="h-full p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-400" />
                  Impact
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-xl bg-white/5">
                    <div className="text-3xl font-bold text-blue-400">{profileData.stats.projects}</div>
                    <div className="text-xs text-gray-400 mt-1">Projects</div>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-white/5">
                    <div className="text-3xl font-bold text-purple-400">{profileData.stats.contributions}</div>
                    <div className="text-xs text-gray-400 mt-1">Contributions</div>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-white/5">
                    <div className="text-3xl font-bold text-pink-400">{profileData.stats.connections}</div>
                    <div className="text-xs text-gray-400 mt-1">Connections</div>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-white/5">
                    <div className="text-3xl font-bold text-yellow-400">{profileData.stats.rating}</div>
                    <div className="text-xs text-gray-400 mt-1">Rating</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Skills Card */}
          <Card className="col-span-12 md:col-span-5 row-span-2 bg-white/5 backdrop-blur-md border border-white/10">
            <CardContent className="h-full p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Code2 className="h-5 w-5 text-cyan-400" />
                Top Skills
              </h3>
              <div className="flex flex-wrap gap-2">
                {profileData.topSkills.map((skill) => (
                  <Badge
                    key={skill}
                    className="px-4 py-2 text-sm bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-cyan-400/30 text-cyan-300 hover:from-cyan-500/30 hover:to-blue-500/30 transition-all"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions Card */}
          <Card className="col-span-12 md:col-span-3 row-span-2 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 backdrop-blur-md border border-blue-400/30">
            <CardContent className="h-full p-6 flex flex-col justify-center gap-3">
              <Button className="w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white">
                <MessageSquare className="h-4 w-4 mr-2" />
                Message
              </Button>
              <Button className="w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white">
                <Users className="h-4 w-4 mr-2" />
                Connect
              </Button>
            </CardContent>
          </Card>

          {/* Social Links Card */}
          <Card className="col-span-12 md:col-span-4 row-span-2 bg-white/5 backdrop-blur-md border border-white/10">
            <CardContent className="h-full p-6">
              <h3 className="text-lg font-semibold mb-4">Connect</h3>
              <div className="flex gap-3">
                {profileData.socialLinks.map((link) => (
                  <button
                    key={link.platform}
                    className={`flex-1 aspect-square rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all ${link.color}`}
                  >
                    <link.icon className="h-6 w-6" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Work - Project Cards */}
          {profileData.recentWork.map((project, index) => (
            <Card
              key={project.name}
              className={`col-span-12 md:col-span-4 row-span-2 bg-gradient-to-br ${project.color} border-0 overflow-hidden relative group cursor-pointer`}
              onMouseEnter={() => setHoveredCard(`project-${index}`)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-all"></div>
              <CardContent className="relative h-full p-6 flex flex-col justify-between">
                <div>
                  <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-md mb-3">
                    {project.type}
                  </Badge>
                  <h4 className="text-xl font-bold">{project.name}</h4>
                </div>
                <div className="flex items-center gap-2 text-white/80 group-hover:text-white transition-colors">
                  <span className="text-sm">View Project</span>
                  <ExternalLink className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Interests Card */}
          <Card className="col-span-12 md:col-span-6 row-span-2 bg-white/5 backdrop-blur-md border border-white/10">
            <CardContent className="h-full p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-400" />
                Interests
              </h3>
              <div className="flex flex-wrap gap-2">
                {profileData.interests.map((interest) => (
                  <Badge
                    key={interest}
                    variant="outline"
                    className="px-3 py-1.5 border-white/20 text-gray-300 hover:bg-white/10"
                  >
                    {interest}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Achievement Badge */}
          <Card className="col-span-12 md:col-span-3 row-span-2 bg-gradient-to-br from-yellow-600/20 to-orange-600/20 backdrop-blur-md border border-yellow-400/30">
            <CardContent className="h-full p-6 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mb-3">
                <Award className="h-8 w-8 text-yellow-400" />
              </div>
              <h4 className="font-semibold text-yellow-300">Top Contributor</h4>
              <p className="text-xs text-gray-400 mt-1">This Month</p>
            </CardContent>
          </Card>

          {/* Activity Indicator */}
          <Card className="col-span-12 md:col-span-3 row-span-2 bg-gradient-to-br from-green-600/20 to-emerald-600/20 backdrop-blur-md border border-green-400/30">
            <CardContent className="h-full p-6 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-3">
                <Zap className="h-8 w-8 text-green-400" />
              </div>
              <h4 className="font-semibold text-green-300">Very Active</h4>
              <p className="text-xs text-gray-400 mt-1">Last seen today</p>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
};

export default ProfileRedesignTest;
