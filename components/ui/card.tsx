import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Crafted card (DESIGN.md §5): white, 1px hairline, radius 14, overflow
 * hidden, no shadow. `lift` adds the soft shadow the stat strip and the
 * phone's first card use; `interactive` darkens the border on hover (no
 * lift). `as` picks the element (section by default).
 */
function Card({
  className,
  lift = false,
  interactive = false,
  as: Comp = "section",
  ...props
}: React.ComponentProps<"section"> & {
  lift?: boolean
  interactive?: boolean
  as?: React.ElementType
}) {
  return (
    <Comp
      data-slot="card"
      className={cn(
        "overflow-hidden rounded-[14px] border border-line bg-surface text-ink",
        lift && "shadow-[var(--shadow-lift)]",
        interactive && "transition-colors hover:border-line-strong",
        className
      )}
      {...props}
    />
  )
}

/**
 * The card's head row: a 15px/800 title, an optional 12px muted subtitle,
 * and an action on the right (kit.py card_head()). `titleAs` sets the
 * heading level (h2 by default).
 */
function CardHead({
  title,
  sub,
  action,
  titleAs: Title = "h2",
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  title: React.ReactNode
  sub?: React.ReactNode
  action?: React.ReactNode
  titleAs?: React.ElementType
}) {
  return (
    <div data-slot="card-head" className={cn("flex items-center gap-2.5 px-[18px] py-3.5", className)} {...props}>
      <div className="min-w-0 flex-1">
        <Title className="m-0 text-[15px] font-extrabold text-ink">{title}</Title>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        {children}
      </div>
      {action}
    </div>
  )
}

/* shadcn-compatible pieces, restyled. */
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("flex flex-col gap-0.5 px-[18px] py-3.5", className)} {...props} />
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-title" className={cn("text-[15px] font-extrabold text-ink", className)} {...props} />
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-description" className={cn("text-xs text-muted-foreground", className)} {...props} />
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-action" className={cn("ml-auto", className)} {...props} />
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-[18px] pb-4", className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-2 border-t border-line px-[18px] py-3", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHead,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
