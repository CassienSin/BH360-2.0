/**
 * Loading placeholders shared by the dashboards. They live at module level
 * on purpose: declared inside a page component they become a new component
 * type on every render, and React remounts them each time.
 */
export function Skeleton({ className = '', style }) {
  return <div className={`skeleton-shimmer ${className}`} style={style} />
}

/** One list card: icon tile and two text lines. */
export function CardSkeleton() {
  return (
    <div className="white-card p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-2xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  )
}
