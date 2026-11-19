"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Crafted avatar (kit.py avatar()): a rounded square with initials.
 * Brand-soft and brand by default; `tone="ok"` for a tanod on duty;
 * `tone="solid"` for the signed-in user (white on a role colour, `color`).
 * Sizes 24 / 32 / 40 / 64; the radius grows with the size (8 to 14).
 */
const SIZES = {
  xs: "size-6 rounded-md text-[10px]",
  sm: "size-8 rounded-lg text-[13px]",
  default: "size-10 rounded-[10px] text-sm",
  lg: "size-16 rounded-[14px] text-2xl",
}

const TONES = {
  brand: "bg-brand-soft text-brand-strong",
  ok: "bg-ok-soft text-ok",
  quiet: "bg-track text-muted-foreground",
  solid: "text-white",
}

/** "Juan Dela Cruz" → "JD"; one word → its first letter. */
export function initials(name?: string | null) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "?"
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ""
  return (first + last).toUpperCase()
}

function Avatar({
  name,
  src,
  size = "default",
  tone = "brand",
  color,
  className,
  style,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  name?: string | null
  src?: string | null
  size?: keyof typeof SIZES
  tone?: keyof typeof TONES
  /** Background for tone="solid". */
  color?: string
}) {
  // Remember which url failed, so a new photo gets a fresh try.
  const [failed, setFailed] = React.useState<string | null>(null)
  const showImage = !!src && failed !== src
  // A server-rendered photo can fail before React attaches onError; catch
  // that case once mounted.
  const imgRef = React.useRef<HTMLImageElement>(null)
  React.useEffect(() => {
    const img = imgRef.current
    if (img && src && img.complete && img.naturalWidth === 0) setFailed(src)
  }, [src])
  return (
    <span
      data-slot="avatar"
      className={cn("relative flex shrink-0 items-center justify-center overflow-hidden font-extrabold select-none", SIZES[size], TONES[tone], className)}
      style={tone === "solid" ? { background: color || "var(--brand-strong)", ...style } : style}
      {...props}
    >
      {showImage ? (
        <img ref={imgRef} src={src} alt="" className="size-full object-cover" onError={() => setFailed(src)} />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
    </span>
  )
}

export { Avatar }
