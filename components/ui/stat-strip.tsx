import * as React from "react"

import { cn } from "@/lib/utils"

export type Stat = {
  label: React.ReactNode
  value: React.ReactNode
  note?: React.ReactNode
  /** danger: an overdue count (red). ok: a good number (green). */
  tone?: "danger" | "ok" | "default"
  /** The note's own tone, when only the note is overdue (defaults to `tone`). */
  noteTone?: "danger" | "ok" | "default"
  /** Makes the cell a button (e.g. jump to the section). */
  onClick?: () => void
}

const VALUE_COLOR = { danger: "text-danger", ok: "text-ok", default: "text-ink" }
const NOTE_COLOR = { danger: "text-danger", ok: "text-ok", default: "text-muted-foreground" }

/**
 * One white card split by vertical hairlines (DESIGN.md §5). Each cell: a
 * 12px muted label, a 24px/800 tabular number (muted when zero, red only
 * when overdue) and a 12px note. Cells wrap into two columns on phones;
 * pass grid classes in `className` for another wrap.
 */
function StatStrip({ stats, className, lift = true }: { stats: Stat[]; className?: string; lift?: boolean }) {
  return (
    <div
      data-slot="stat-strip"
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-line bg-line sm:grid-flow-col sm:auto-cols-fr sm:grid-cols-none",
        lift && "shadow-[var(--shadow-lift)]",
        className
      )}
    >
      {stats.map((stat, i) => {
        const tone = stat.tone ?? "default"
        const zero = stat.value === 0 || stat.value === "0"
        const body = (
          <>
            <span className="block text-xs text-muted-foreground">{stat.label}</span>
            <span
              className={cn(
                "mt-1 block text-2xl leading-tight font-extrabold tracking-[-0.6px] tabular-nums",
                zero && tone === "default" ? "text-muted-foreground" : VALUE_COLOR[tone]
              )}
            >
              {stat.value}
            </span>
            {stat.note && <span className={cn("mt-0.5 block truncate text-xs", NOTE_COLOR[stat.noteTone ?? tone])}>{stat.note}</span>}
          </>
        )
        // The hairlines are the 1px gap over the line-coloured grid, so
        // they follow however the cells wrap.
        const cell = "min-w-0 bg-surface px-4 py-3.5 text-left sm:px-[18px]"
        return stat.onClick ? (
          <button key={i} type="button" onClick={stat.onClick} className={cn(cell, "transition-colors hover:bg-surface-sunk focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-strong")}>
            {body}
          </button>
        ) : (
          <div key={i} className={cell}>
            {body}
          </div>
        )
      })}
    </div>
  )
}

export { StatStrip }
