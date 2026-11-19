import * as React from "react"
import { AlertTriangle, Check, Info } from "lucide-react"

import { cn } from "@/lib/utils"
import { TONE_BG, TONE_FG, type Tone } from "@/components/ui/tag"

const ICONS: Partial<Record<Tone, React.ElementType>> = { ok: Check, danger: AlertTriangle, warn: AlertTriangle, info: Info, brand: Info }

/**
 * An inline message in a card: tone text on its soft background, radius
 * 10, a small leading glyph. `title` is bold and runs into the text
 * ("Check your email. If an account uses…", P07). Errors get role="alert".
 */
function Notice({
  tone = "info",
  title,
  icon = true,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & { tone?: Tone; title?: React.ReactNode; icon?: boolean }) {
  const Icon = ICONS[tone]
  return (
    <div
      data-slot="notice"
      role={tone === "danger" ? "alert" : undefined}
      className={cn("flex items-start gap-2.5 rounded-[10px] px-3.5 py-3 text-[13px] leading-[1.5]", className)}
      style={{ background: TONE_BG[tone], color: tone === "quiet" ? "var(--body)" : "var(--ink)" }}
      {...props}
    >
      {icon && Icon && <Icon size={16} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 shrink-0" style={{ color: TONE_FG[tone] }} />}
      <p className="min-w-0">
        {title && <strong className="font-bold">{title} </strong>}
        {children}
      </p>
    </div>
  )
}

export { Notice }
