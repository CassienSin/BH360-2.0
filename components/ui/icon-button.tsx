import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * A square icon-only button (kit.py iconbtn()): 40×40, radius 10.
 *   onband  translucent dark with a white icon, for the band
 *   plain   white with a hairline border, for the page
 * `label` is required: it becomes the accessible name.
 */
const iconButtonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center rounded-[10px] transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-55 [&_svg]:shrink-0",
  {
    variants: {
      kind: {
        onband: "bg-[var(--onband)] text-white hover:bg-[var(--onband-hover)] focus-visible:outline-white",
        plain: "border border-line bg-surface text-ink hover:border-line-strong focus-visible:outline-brand-strong",
        ghost: "text-muted-foreground hover:bg-track hover:text-ink focus-visible:outline-brand-strong",
      },
      size: {
        default: "size-10",
        sm: "size-[34px]",
      },
    },
    defaultVariants: { kind: "plain", size: "default" },
  }
)

function IconButton({
  label,
  kind,
  size,
  className,
  children,
  type = "button",
  ...props
}: Omit<React.ComponentProps<"button">, "aria-label"> &
  VariantProps<typeof iconButtonVariants> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      data-slot="icon-button"
      className={cn(iconButtonVariants({ kind, size, className }))}
      {...props}
    >
      {children}
    </button>
  )
}

export { IconButton, iconButtonVariants }
