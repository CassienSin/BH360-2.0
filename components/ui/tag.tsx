import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Tones carry meaning (DESIGN.md §1): danger = emergencies, critical and
 * overdue only; ok = done, verified, on duty; warn = waiting, high
 * priority; info = processing, assigned; brand = the app's own labels;
 * quiet = everything else.
 */
export type Tone = "danger" | "ok" | "warn" | "info" | "brand" | "quiet"

export const TONE_FG: Record<Tone, string> = {
  danger: "var(--danger)",
  ok: "var(--ok)",
  warn: "var(--warn)",
  info: "var(--info)",
  brand: "var(--brand-strong)",
  quiet: "var(--text-muted)",
}

export const TONE_BG: Record<Tone, string> = {
  danger: "var(--danger-soft)",
  ok: "var(--ok-soft)",
  warn: "var(--warn-soft)",
  info: "var(--info-soft)",
  brand: "var(--brand-soft)",
  quiet: "var(--quiet-soft)",
}

/** A small label: height 22, radius 6, 12px/700, tone text on its soft background. */
function Tag({
  tone = "quiet",
  className,
  style,
  ...props
}: React.ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      data-slot="tag"
      data-tone={tone}
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center gap-1 rounded-[6px] px-2 text-xs font-bold whitespace-nowrap",
        className
      )}
      style={{ color: TONE_FG[tone], background: TONE_BG[tone], ...style }}
      {...props}
    />
  )
}

/** A row state: a 7px dot and 12px/700 text in the tone colour, no background. */
function Status({
  tone = "quiet",
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      data-slot="status"
      data-tone={tone}
      className={cn("inline-flex min-w-0 items-center gap-1.5 text-xs font-bold whitespace-nowrap", className)}
      style={{ color: TONE_FG[tone], ...style }}
      {...props}
    >
      <span aria-hidden="true" className="size-[7px] shrink-0 rounded-full bg-current" />
      <span className="truncate">{children}</span>
    </span>
  )
}

export { Tag, Status }
