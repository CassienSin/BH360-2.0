import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Crafted button (DESIGN.md §5, kit.py btn()). Height 40 (sm 34, lg 52),
 * radius 10 (lg 12), 13px/700 text (lg 15px). One primary per screen; no
 * gradients, no glow.
 *
 *   primary    brand fill — the one main action
 *   secondary  white with a hairline border
 *   ghost      brand text only
 *   danger     red fill — emergencies and destructive actions only
 *   onband     translucent dark, white text — secondary actions on the band
 *   white      white fill, brand text — the primary action on the band
 *
 * The shadcn names still work: default → primary, outline → secondary,
 * destructive → danger, link → ghost.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 border font-bold whitespace-nowrap select-none transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong disabled:pointer-events-none disabled:opacity-55 aria-busy:cursor-progress [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "border-[var(--brand-fill)] bg-[var(--brand-fill)] text-white hover:border-brand-deep hover:bg-brand-deep",
        secondary: "border-line bg-surface text-ink hover:border-line-strong",
        ghost: "border-transparent bg-transparent text-brand-strong hover:bg-brand-soft hover:text-brand-deep",
        danger: "border-danger bg-danger text-white hover:brightness-95",
        onband: "border-transparent bg-[var(--onband)] text-white hover:bg-[var(--onband-hover)] focus-visible:outline-white",
        white: "border-white bg-white text-[#4A43D4] hover:bg-[#EFEDFC] focus-visible:outline-white",
        // shadcn aliases
        default: "border-[var(--brand-fill)] bg-[var(--brand-fill)] text-white hover:border-brand-deep hover:bg-brand-deep",
        outline: "border-line bg-surface text-ink hover:border-line-strong",
        destructive: "border-danger bg-danger text-white hover:brightness-95",
        link: "border-transparent bg-transparent px-0 text-brand-strong underline-offset-4 hover:text-brand-deep hover:underline",
      },
      size: {
        default: "h-10 rounded-[10px] px-4 text-[13px]",
        sm: "h-[34px] gap-1.5 rounded-[10px] px-3 text-[13px]",
        lg: "h-[52px] rounded-xl px-5 text-[15px] [&_svg:not([class*='size-'])]:size-[18px]",
        icon: "size-10 rounded-[10px]",
        "icon-sm": "size-[34px] rounded-[10px]",
        // shadcn sizes kept for compatibility
        xs: "h-7 gap-1 rounded-lg px-2 text-xs",
        "icon-xs": "size-7 rounded-lg",
        "icon-lg": "size-[52px] rounded-xl",
      },
      full: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
      full: false,
    },
  }
)

function Button({
  className,
  variant = "primary",
  size = "default",
  full = false,
  asChild = false,
  type,
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
      type={asChild ? undefined : type ?? "button"}
      className={cn(buttonVariants({ variant, size, full, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
