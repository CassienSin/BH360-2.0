"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { lockBodyScroll } from "@/lib/modalScrollLock"

/**
 * Bottom sheet (DESIGN.md §5): on phones it rises from the bottom edge
 * (radius 22 at the top, a 40×4 grab handle, a dimmed scrim, 320ms
 * cubic-bezier(.2,.8,.2,1)); from 640px it is a centred card (the global
 * .sheet-overlay / .sheet-panel rules). Escape and the scrim close it;
 * focus moves in on open and goes back on close; the page behind doesn't
 * scroll.
 */
function BottomSheet({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  className,
  closeLabel = "Close",
}: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  description?: React.ReactNode
  footer?: React.ReactNode
  children?: React.ReactNode
  className?: string
  closeLabel?: string
}) {
  const panelRef = React.useRef<HTMLDivElement>(null)
  const titleId = React.useId()
  const descId = React.useId()

  React.useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const unlock = lockBodyScroll()
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(
      'input, textarea, select, button:not([data-sheet-close]), [href], [tabindex]:not([tabindex="-1"])'
    )
    ;(first || panel)?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
      if (e.key !== "Tab" || !panel) return
      const items = [...panel.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')]
      if (!items.length) return
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault()
        lastItem.focus()
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault()
        firstItem.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      unlock()
      if (previous?.isConnected) previous.focus()
    }
  }, [open, onClose])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="sheet-overlay fixed inset-0 z-50 bg-[var(--scrim)] [animation:sheetFade_.2s_ease_both]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        data-slot="bottom-sheet"
        className={cn(
          "sheet-panel relative flex w-full flex-col overflow-hidden bg-surface text-body shadow-[var(--shadow-float)] outline-none [animation:sheetUp_.32s_var(--ease-sheet)_both] sm:max-w-md sm:border sm:border-line",
          className
        )}
      >
        <span aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" />
        <div className="flex items-start gap-3 px-[18px] pt-3.5 pb-2 sm:pt-[18px]">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[17px] font-extrabold text-ink">{title}</h2>
            {description && <p id={descId} className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
          </div>
          <button
            type="button"
            data-sheet-close
            onClick={onClose}
            aria-label={closeLabel}
            className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-line bg-surface text-ink outline-none hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong"
          >
            <X size={18} strokeWidth={1.9} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-4">{children}</div>
        {footer && <div className="flex gap-2 border-t border-line px-[18px] py-3">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}

export { BottomSheet }
