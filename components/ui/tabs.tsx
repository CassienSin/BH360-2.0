"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/*
 * Real tabs (each trigger owns a panel) drawn as the Crafted segmented
 * control. For a filter or a view switch without panels, use
 * <Segmented> instead.
 */

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-3.5", className)} {...props} />
}

function TabsList({
  className,
  onBand = false,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & { onBand?: boolean }) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-onband={onBand || undefined}
      className={cn(
        "group/tabs-list inline-flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-xl p-1",
        onBand ? "bg-[var(--onband)]" : "bg-track",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[9px] px-3.5 text-[13px] font-bold whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-strong disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-[0_1px_2px_rgba(26,24,48,0.1)]",
        "group-data-[onband=true]/tabs-list:text-white/90 group-data-[onband=true]/tabs-list:data-[state=active]:bg-white group-data-[onband=true]/tabs-list:data-[state=active]:text-[#4A43D4]",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("flex-1 outline-none", className)} {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
