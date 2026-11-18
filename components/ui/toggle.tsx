"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * On/off switch: 44×26, green (--ok) when on (DESIGN.md §5). A real
 * button with role="switch", so Space and Enter work and screen readers
 * hear the state. Give it a `label` (or aria-labelledby).
 */
function Toggle({
  checked,
  onCheckedChange,
  label,
  disabled,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "onChange"> & {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      data-slot="toggle"
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-[26px] w-11 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong disabled:opacity-50",
        checked ? "bg-ok" : "bg-[color-mix(in_srgb,var(--text-muted)_35%,var(--surface))]",
        className
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-[3px] left-[3px] size-5 rounded-full bg-white shadow-[0_1px_2px_rgba(26,24,48,0.25)] transition-transform duration-150",
          checked && "translate-x-[18px]"
        )}
      />
    </button>
  )
}

export { Toggle }
