import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all duration-200 ease-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "border border-white/20 bg-transparent text-white hover:border-white/45 hover:bg-white/5 shadow-sm active:scale-[0.97] transition-all duration-300",
        destructive:
          "border border-destructive bg-transparent text-destructive hover:bg-destructive/10 active:scale-[0.97] transition-all duration-300",
        outline:
          "border border-white/10 bg-transparent text-white/90 hover:bg-white/5 hover:border-white/25 active:scale-[0.97] transition-all duration-300",
        secondary:
          "border border-white/5 bg-transparent text-white/80 hover:bg-white/5 hover:border-white/15 active:scale-[0.97] transition-all duration-300",
        ghost: "bg-transparent text-white/80 hover:bg-white/5 hover:text-white active:scale-[0.97] transition-all duration-300",
        link: "bg-transparent text-white underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-md px-3.5",
        lg: "h-11 rounded-lg px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
