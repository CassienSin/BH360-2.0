"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export type SegmentedItem = {
  value: string
  label: React.ReactNode
  /** Shown after the label as " · 4". */
  count?: number
  disabled?: boolean
}

/**
 * Segmented control (kit.py segmented()).
 *   On the page: a track background, radius 12, padding 4; items 32px tall
 *   with radius 9; the active one is white with a 1px shadow.
 *   onBand: a translucent dark track; the active item is white and brand.
 *
 * Buttons with aria-pressed inside a labelled group: it filters or switches
 * a view, it doesn't own tab panels. `full` stretches the items to fill
 * the width (phones).
 */
function Segmented({
  items,
  value,
  onChange,
  label,
  onBand = false,
  full = false,
  size = "default",
  className,
}: {
  items: SegmentedItem[]
  value: string
  onChange: (value: string) => void
  label: string
  onBand?: boolean
  full?: boolean
  size?: "default" | "lg"
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      data-slot="segmented"
      className={cn(
        "gap-1 rounded-xl p-1",
        full ? "flex w-full" : "inline-flex max-w-full overflow-x-auto",
        onBand ? "bg-[var(--onband)]" : "bg-track",
        className
      )}
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            className={cn(
              "shrink-0 rounded-[9px] px-3.5 text-[13px] font-bold whitespace-nowrap transition-colors outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 disabled:opacity-50",
              size === "lg" ? "h-[34px]" : "h-8",
              full && "flex-1",
              onBand
                ? active
                  ? "bg-white text-[#4A43D4] focus-visible:outline-brand-strong"
                  : "text-white/90 hover:bg-white/10 focus-visible:outline-white"
                : active
                  ? "bg-surface text-ink shadow-[0_1px_2px_rgba(26,24,48,0.1)] focus-visible:outline-brand-strong"
                  : "text-muted-foreground hover:text-ink focus-visible:outline-brand-strong"
            )}
          >
            {item.label}
            {item.count != null && <span className="tabular-nums"> · {item.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

export { Segmented }
