import { notFound } from 'next/navigation'
import MapPreview from './MapPreview'

/**
 * /dev/map-preview — the incident map console with sample data, for
 * checking the design without signing in or touching real records.
 * Development builds only: production answers 404.
 */
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <MapPreview />
}
