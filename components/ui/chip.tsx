import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Chip for map layers and filters: 32px tall, radius 9, white with a
 * hairline border; active ones are brand-filled. `dot` draws a small
 * colour key before the label (map legends). A toggle, so it carries
 * aria-pressed when `active` is given.
 */
function Chip({
  active,
  dot,
  icon,
  className,
  children,
  type = "button",
  ...props
}: React.ComponentProps<"button"> & {
  active?: boolean
  dot?: string
  icon?: React.ReactNode
}) {
  return (
    <button
      type={type}
      data-slot="chip"
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[9px] border px-3 text-[13px] font-bold whitespace-nowrap transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong [&_svg]:size-4 [&_svg]:shrink-0",
        active
          ? "border-[var(--brand-fill)] bg-[var(--brand-fill)] text-white"
          : "border-line bg-surface text-ink hover:border-line-strong",
        className
      )}
      {...props}
    >
      {dot && <span aria-hidden="true" className="size-2 rounded-full" style={{ background: dot }} />}
      {icon}
      {children}
    </button>
  )
}

export { Chip }
