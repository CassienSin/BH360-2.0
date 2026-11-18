import * as React from "react"

import { cn } from "@/lib/utils"

/** Multi-line field: 12×14 padding, radius 10, 14px at line-height 1.55. */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[88px] w-full rounded-[10px] border border-line bg-surface px-3.5 py-3 text-sm leading-[1.55] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-brand-strong focus:shadow-[0_0_0_1px_var(--brand-strong)] disabled:cursor-not-allowed disabled:bg-surface-sunk disabled:opacity-70 aria-invalid:border-danger",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
