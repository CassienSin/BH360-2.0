import * as React from "react"

import { cn } from "@/lib/utils"

/*
 * Rows and tables (DESIGN.md §5): rows divided by 1px lines, no zebra.
 * Header 12px/700 muted on --surface-sunk. Cell title 14/700 with a 12px
 * muted subtitle, both truncated. Selected: brand-soft with a 3px inset
 * brand bar on the left. Critical: a faint danger tint.
 */

type RowState = { selected?: boolean; critical?: boolean }

function rowStateClass({ selected, critical }: RowState) {
  return cn(
    selected && "bg-brand-soft shadow-[inset_3px_0_0_var(--brand-strong)]",
    !selected && critical && "bg-[color-mix(in_srgb,var(--danger-soft)_60%,var(--surface))]"
  )
}

/* ---------- Rows: a list inside a card ---------- */

function Rows({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="rows" role="list" className={cn("divide-y divide-line", className)} {...props} />
}

/**
 * One row. Phone padding 12×14, desktop 12×18. Pass `onClick` or `href`
 * (via asChild-like `as`) to make it interactive.
 */
function Row({
  selected,
  critical,
  interactive,
  as: Comp = "div",
  className,
  ...props
}: React.ComponentProps<"div"> & RowState & { interactive?: boolean; as?: React.ElementType }) {
  return (
    <Comp
      data-slot="row"
      role={Comp === "div" ? "listitem" : undefined}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "block w-full px-3.5 py-3 text-left sm:px-[18px]",
        interactive && "cursor-pointer transition-colors hover:bg-surface-sunk focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-strong",
        rowStateClass({ selected, critical }),
        className
      )}
      {...props}
    />
  )
}

/** A row's title (14/700) and subtitle (12px muted), truncated. */
function RowTitle({
  title,
  sub,
  className,
  titleClassName,
}: {
  title: React.ReactNode
  sub?: React.ReactNode
  className?: string
  titleClassName?: string
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className={cn("truncate text-sm font-bold text-ink", titleClassName)}>{title}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

/* ---------- Table ---------- */

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-wrap" className="w-full overflow-x-auto">
      <table data-slot="table" className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  )
}

function THead({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="thead" className={cn("bg-surface-sunk", className)} {...props} />
}

function TBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="tbody" className={className} {...props} />
}

function TR({ selected, critical, className, ...props }: React.ComponentProps<"tr"> & RowState) {
  return (
    <tr
      data-slot="tr"
      aria-selected={selected || undefined}
      className={cn("border-t border-line", rowStateClass({ selected, critical }), className)}
      {...props}
    />
  )
}

function TH({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="th"
      scope="col"
      className={cn("h-9 px-[18px] text-left align-middle text-xs font-bold whitespace-nowrap text-muted-foreground first:pl-[18px]", className)}
      {...props}
    />
  )
}

function TD({ className, ...props }: React.ComponentProps<"td">) {
  return <td data-slot="td" className={cn("h-14 px-[18px] align-middle text-ink", className)} {...props} />
}

export { Rows, Row, RowTitle, Table, THead, TBody, TR, TH, TD }
