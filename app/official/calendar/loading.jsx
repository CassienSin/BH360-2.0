// Shown instantly on navigation while this route's code and data load:
// the official's frame (sidebar, band), as the page draws inside it.
import { DashboardShellSkeleton } from '@/components/Skeletons'

export default function Loading() {
  return <DashboardShellSkeleton path="/official" kind="analytics" />
}
