import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error?: Error;
    errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        
        // Log to external service in production
        if (import.meta.env.PROD) {
            // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
            console.error('Production error:', {
                error: error.message,
                stack: error.stack,
                componentStack: errorInfo.componentStack,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href
            });
        }

        this.setState({ error, errorInfo });
        this.props.onError?.(error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    };

    handleGoHome = () => {
        window.location.href = '/dashboard';
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
                    <Card className="w-full max-w-md">
                        <CardHeader className="text-center">
                            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
                            </div>
                            <CardTitle className="text-xl text-gray-900 dark:text-white">
                                Something went wrong
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-gray-600 dark:text-gray-400 text-center">
                                We encountered an unexpected error. This has been logged and we'll look into it.
                            </p>
                            
                            {import.meta.env.DEV && this.state.error && (
                                <details className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg text-xs">
                                    <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Error Details (Development)
                                    </summary>
                                    <div className="space-y-2">
                                        <div>
                                            <strong>Error:</strong> {this.state.error.message}
                                        </div>
                                        {this.state.error.stack && (
                                            <div>
                                                <strong>Stack:</strong>
                                                <pre className="whitespace-pre-wrap text-xs mt-1 text-gray-600 dark:text-gray-400">
                                                    {this.state.error.stack}
                                                </pre>
                                            </div>
                                        )}
                                        {this.state.errorInfo?.componentStack && (
                                            <div>
                                                <strong>Component Stack:</strong>
                                                <pre className="whitespace-pre-wrap text-xs mt-1 text-gray-600 dark:text-gray-400">
                                                    {this.state.errorInfo.componentStack}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                </details>
                            )}

                            <div className="flex gap-2">
                                <Button 
                                    onClick={this.handleRetry} 
                                    className="flex-1"
                                    variant="outline"
                                >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Try Again
                                </Button>
                                <Button 
                                    onClick={this.handleGoHome} 
                                    className="flex-1"
                                >
                                    <Home className="h-4 w-4 mr-2" />
                                    Go Home
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}

// Hook version for functional components
export function useErrorHandler() {
    return (error: Error, errorInfo?: ErrorInfo) => {
        console.error('Unhandled error:', error, errorInfo);
        
        if (import.meta.env.PROD) {
            // TODO: Send to error tracking service
            console.error('Production error:', {
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href
            });
        }
    };
}