import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-bold tracking-wide whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 active:translate-y-px dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border border-primary/40 bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 hover:shadow-primary/30",
        destructive:
          "border border-destructive/40 bg-destructive text-white shadow-lg shadow-destructive/20 hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "border border-border/80 bg-card/70 shadow-sm shadow-primary/5 hover:border-primary/45 hover:bg-primary/10 hover:text-foreground dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "border border-secondary/40 bg-secondary text-secondary-foreground shadow-lg shadow-secondary/20 hover:bg-secondary/90",
        ghost:
          "hover:bg-accent/20 hover:text-foreground dark:hover:bg-accent/20",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 px-4 py-2 has-[>svg]:px-3",
        xs: "min-h-11 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "min-h-11 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "min-h-12 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-11",
        "icon-xs": "size-11 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-11",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
