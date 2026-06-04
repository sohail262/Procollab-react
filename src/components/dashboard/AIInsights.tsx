import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, AlertTriangle, TrendingUp, CheckCircle2, Loader2 } from 'lucide-react'
import { aiService } from '@/services/aiService'
import type { AIRecommendation } from '@/services/aiService'
import type { Task } from '@/types/project'

interface AIInsightsProps {
    tasks: Task[]
}

export function AIInsights({ tasks }: AIInsightsProps) {
    const [loading, setLoading] = useState(true)
    const [recommendations, setRecommendations] = useState<AIRecommendation[]>([])
    const [report, setReport] = useState('')

    useEffect(() => {
        const analyze = async () => {
            setLoading(true)
            try {
                const risks = await aiService.analyzeProjectRisks(tasks)
                const optimizations = await aiService.getOptimizationSuggestions(tasks, 'agile')
                const progressReport = await aiService.generateProgressReport(tasks)

                setRecommendations([...risks, ...optimizations])
                setReport(progressReport)
            } catch (error) {
                console.error('AI Analysis failed:', error)
            } finally {
                setLoading(false)
            }
        }

        if (tasks.length > 0) {
            analyze()
        }
    }, [tasks])

    if (loading) {
        return (
            <Card className="border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-900/10">
                <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-violet-600 mr-2" />
                    <span className="text-violet-600 font-medium">AI is analyzing your project...</span>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-4">
            <Card className="border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50 to-white dark:from-violet-900/20 dark:to-background">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-violet-700 dark:text-violet-300">
                        <Sparkles className="h-5 w-5" />
                        AI Project Insights
                    </CardTitle>
                    <CardDescription>
                        Smart analysis based on your project data and methodology
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-4 bg-white/80 dark:bg-black/20 rounded-lg backdrop-blur-sm border border-violet-100 dark:border-violet-800/50">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-green-600" />
                            Progress Summary
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {report}
                        </p>
                    </div>

                    <div className="space-y-3">
                        {recommendations.map(rec => (
                            <div
                                key={rec.id}
                                className={`p-3 rounded-lg border flex items-start gap-3 ${rec.type === 'risk'
                                        ? 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-900/50'
                                        : 'bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-900/50'
                                    }`}
                            >
                                {rec.type === 'risk' ? (
                                    <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                                ) : (
                                    <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <h5 className={`font-medium text-sm ${rec.type === 'risk' ? 'text-red-900 dark:text-red-200' : 'text-blue-900 dark:text-blue-200'
                                            }`}>
                                            {rec.title}
                                        </h5>
                                        <Badge variant="outline" className="bg-white/50">
                                            {Math.round(rec.confidence * 100)}% confidence
                                        </Badge>
                                    </div>
                                    <p className={`text-xs ${rec.type === 'risk' ? 'text-red-700 dark:text-red-300' : 'text-blue-700 dark:text-blue-300'
                                        }`}>
                                        {rec.description}
                                    </p>
                                    {rec.action && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className={`mt-2 h-7 text-xs ${rec.type === 'risk'
                                                    ? 'hover:bg-red-100 text-red-700'
                                                    : 'hover:bg-blue-100 text-blue-700'
                                                }`}
                                        >
                                            {rec.action}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
