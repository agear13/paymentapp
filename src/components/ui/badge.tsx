import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:ring-[3px] focus-visible:ring-primary/20 focus-visible:border-primary aria-invalid:ring-destructive/20 aria-invalid:border-destructive transition-all overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-primary/20 bg-primary text-primary-foreground [a&]:hover:bg-[rgb(61,92,224)]",
        secondary:
          "border-border bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80",
        destructive:
          "border-red-200 bg-red-50 text-red-700 [a&]:hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950 dark:text-red-400",
        success:
          "border-green-200 bg-green-50 text-green-700 [a&]:hover:bg-green-100 dark:border-green-900/50 dark:bg-green-950 dark:text-green-400",
        warning:
          "border-amber-200 bg-amber-50 text-amber-700 [a&]:hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950 dark:text-amber-400",
        info:
          "border-blue-200 bg-blue-50 text-blue-700 [a&]:hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950 dark:text-blue-400",
        outline:
          "text-foreground border-border [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
