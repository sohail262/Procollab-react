import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FolderKanban, Users, Calendar } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface DiscoverProjectCardProps {
    project: {
        id: string
        title: string
        description: string
        primaryDiscipline: string
        status: string
        tags?: string[]
        createdAt: any
        teamSize?: number
        summary?: string
    }
}

// ⚡ OPTIMIZATION: memo prevents re-renders when parent state changes
// (e.g. typing in people search) don't affect project card props.
export const DiscoverProjectCard = memo(function DiscoverProjectCard({ project }: DiscoverProjectCardProps) {
    const navigate = useNavigate()

    const getStatusBadge = (status: string) => {
        const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string }> = {
            active: { variant: 'default', label: 'Active' },
            recruiting: { variant: 'secondary', label: 'Recruiting' },
            completed: { variant: 'outline', label: 'Completed' },
            'on-hold': { variant: 'destructive', label: 'On Hold' }
        }
        const config = variants[status] || variants.active
        return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>
    }

    return (
        <Card
            className="hover:shadow-lg transition-all cursor-pointer hover:border-blue-500"
            onClick={() => navigate(`/project/${project.id}`)}
        >
            <CardHeader>
                <div className="flex justify-between items-start mb-2">
                    <CardTitle className="text-lg line-clamp-2 flex-1">{project.title}</CardTitle>
                    {getStatusBadge(project.status)}
                </div>
                <CardDescription className="flex items-center gap-2">
                    <FolderKanban className="h-4 w-4" />
                    {project.primaryDiscipline}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3 mb-4">
                    {project.summary || project.description}
                </p>

                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-4">
                    {project.teamSize && (
                        <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {project.teamSize} members
                        </span>
                    )}
                    <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                </div>

                <div className="flex flex-wrap gap-2">
                    {(project.tags || []).slice(0, 3).map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                        </Badge>
                    ))}
                    {(project.tags || []).length > 3 && (
                        <Badge variant="outline" className="text-xs">
                            +{(project.tags || []).length - 3}
                        </Badge>
                    )}
                </div>
            </CardContent>
        </Card>
    )
})
