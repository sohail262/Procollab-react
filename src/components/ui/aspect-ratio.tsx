import * as React from "react"
import { cn } from "@/lib/utils"

// Simple AspectRatio component – maintains a given ratio for its children.
// Mirrors shadcn/ui implementation for compatibility.

export const AspectRatio = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { ratio?: number }
>(function AspectRatio({ ratio = 1, className, children, ...props }, ref) {
    const padding = `${(1 / ratio) * 100}%`
    return (
        <div
            ref={ref}
            className={cn("relative w-full", className)}
            style={{ paddingBottom: padding }}
            {...props}
        >
            <div className="absolute inset-0 flex items-center justify-center">
                {children}
            </div>
        </div>
    )
})

AspectRatio.displayName = "AspectRatio"
