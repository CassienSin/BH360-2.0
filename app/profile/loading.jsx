// Shown instantly on navigation while this route's code and data load.
// Same skeleton the page shows while loading, so nothing changes in between.
import { PageSkeleton } from '@/components/Skeletons'
import { PAGE_HEADERS } from '@/lib/pageHeaders'

export default function Loading() {
  return <PageSkeleton layout="profile" header={PAGE_HEADERS.profile} />
}
