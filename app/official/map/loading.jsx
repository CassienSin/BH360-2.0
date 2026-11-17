// Shown instantly on navigation while this route's code and data load.
import { PageSkeleton } from '@/components/Skeletons'

export default function Loading() {
  return <PageSkeleton cards={1} maxWidth={1400} />
}
