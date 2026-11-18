"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * The bare control: 46px, radius 10, 1px hairline, brand border on focus
 * (DESIGN.md §5 Field). Use <Field> for the label, icon, hint and error.
 */
const inputClass =
  "h-[46px] w-full min-w-0 rounded-[10px] border border-line bg-surface px-3.5 text-sm text-ink outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-brand-strong focus:shadow-[0_0_0_1px_var(--brand-strong)] disabled:cursor-not-allowed disabled:bg-surface-sunk disabled:opacity-70 aria-invalid:border-danger"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(inputClass, className)} {...props} />
}

/**
 * Label (13/700) above a control, with an optional leading icon in muted,
 * a hint below and an error that replaces it. Pass the control as children
 * when it isn't a plain input (a select, a textarea); otherwise the rest
 * of the props go to an <Input>.
 */
function Field({
  label,
  icon,
  hint,
  error,
  optional,
  id,
  className,
  children,
  ...inputProps
}: React.ComponentProps<"input"> & {
  label: React.ReactNode
  icon?: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  optional?: boolean
}) {
  const autoId = React.useId()
  const controlId = id ?? autoId
  const noteId = `${controlId}-note`
  const note = error || hint
  return (
    <div data-slot="field" className={cn("block", className)}>
      <label htmlFor={controlId} className="mb-1.5 block text-[13px] font-bold text-ink">
        {label}
        {optional && <span className="font-normal text-muted-foreground"> · optional</span>}
      </label>
      {children ? (
        // A custom control (textarea, select): give it the label's id and
        // the note, unless it brings its own.
        React.isValidElement<Record<string, unknown>>(children)
          ? React.cloneElement(children, {
              id: (children.props.id as string) ?? controlId,
              "aria-describedby": (children.props["aria-describedby"] as string) ?? (note ? noteId : undefined),
              "aria-invalid": (children.props["aria-invalid"] as boolean) ?? (error ? true : undefined),
            })
          : children
      ) : (
        <div className="relative">
          {icon && (
            <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 flex -translate-y-1/2 text-muted-foreground [&_svg]:size-4">
              {icon}
            </span>
          )}
          <Input
            id={controlId}
            aria-invalid={error ? true : undefined}
            aria-describedby={note ? noteId : undefined}
            className={icon ? "pl-10" : undefined}
            {...inputProps}
          />
        </div>
      )}
      {note && (
        <p id={noteId} className={cn("mt-1.5 text-xs", error ? "font-semibold text-danger" : "text-muted-foreground")}>
          {note}
        </p>
      )}
    </div>
  )
}

export { Input, Field, inputClass }
