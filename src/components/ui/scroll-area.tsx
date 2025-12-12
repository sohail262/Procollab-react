import * as React from "react"
import { cn } from "@/lib/utils"

// Simple ScrollArea component – a wrapper with overflow auto and optional styling.
// It mirrors the API of shadcn/ui ScrollArea for compatibility.

export const ScrollArea = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { className?: string }
>(function ScrollArea({ className, children, ...props }, ref) {
    return (
        <div
            ref={ref}
            className={cn("relative w-full overflow-auto rounded-md", className)}
            {...props}
        >
            {children}
        </div>
    )
})

ScrollArea.displayName = "ScrollArea"


