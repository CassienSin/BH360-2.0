import * as React from "react"

import { cn } from "@/lib/utils"

/** Section label above a card on the page: 12px/700, 0.06em, uppercase, muted. */
function SectionLabel({ className, as: Comp = "h2", ...props }: React.ComponentProps<"h2"> & { as?: React.ElementType }) {
  return (
    <Comp
      data-slot="section-label"
      className={cn("mb-2 text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase", className)}
      {...props}
    />
  )
}

/** Eyebrow on the band: 12px/700, 0.1em, uppercase, white at 75%. */
function Eyebrow({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="eyebrow"
      className={cn("m-0 text-xs font-bold tracking-[0.1em] text-white/75 uppercase", className)}
      {...props}
    />
  )
}

/** Empty or help text: 12–13px muted. No illustrations. */
function Muted({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="muted" className={cn("text-[13px] leading-[1.55] text-muted-foreground", className)} {...props} />
}

export { SectionLabel, Eyebrow, Muted }
