import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Step progress (kit.py progress()): equal segments, 4px tall with a 4px
 * gap, green for the steps reached. `labels` adds a caption under each
 * segment; the current step's caption is bold and green.
 */
function Progress({
  value,
  total = 4,
  labels,
  label,
  tone = "ok",
  className,
}: {
  value: number
  total?: number
  labels?: React.ReactNode[]
  /** Accessible name, e.g. "Report progress". */
  label?: string
  tone?: "ok" | "brand"
  className?: string
}) {
  const fill = tone === "brand" ? "bg-brand-strong" : "bg-ok"
  const text = tone === "brand" ? "text-brand-strong" : "text-ok"
  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={value}
      aria-valuetext={labels?.[value - 1] && typeof labels[value - 1] === "string" ? (labels[value - 1] as string) : undefined}
      className={className}
    >
      <div className="flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-sm", i < value ? fill : "bg-line")} />
        ))}
      </div>
      {labels && (
        <div className="mt-1.5 flex gap-1" aria-hidden="true">
          {labels.map((l, i) => (
            <span
              key={i}
              className={cn(
                "flex-1 truncate text-xs",
                i === value - 1 ? cn("font-bold", text) : "text-muted-foreground"
              )}
            >
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export { Progress }
