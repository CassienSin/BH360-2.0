import * as React from "react"

import { Tag, type Tone } from "@/components/ui/tag"

/**
 * Kept for the shadcn name: a Badge is a Crafted Tag. The shadcn variants
 * map onto tones (default → brand, secondary/outline → quiet,
 * destructive → danger).
 */
const VARIANT_TONE: Record<string, Tone> = {
  default: "brand",
  secondary: "quiet",
  outline: "quiet",
  ghost: "quiet",
  destructive: "danger",
  link: "brand",
}

function Badge({
  variant = "default",
  tone,
  ...props
}: React.ComponentProps<"span"> & { variant?: string; tone?: Tone }) {
  return <Tag tone={tone ?? VARIANT_TONE[variant] ?? "quiet"} data-slot="badge" {...props} />
}

export { Badge }
