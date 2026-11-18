import { notFound } from 'next/navigation'
import StyleGuide from './StyleGuide'

export const metadata = { title: 'Crafted style guide · BH360' }

/**
 * /dev/crafted — every Crafted component, the band at phone and desktop
 * widths, light and dark. Sample data only; nothing is read or written.
 * Development builds only: production answers 404.
 *
 * Shells with sample data: /dev/crafted/frame?role=official|resident|tanod,
 * /dev/crafted/auth and /dev/crafted/screen.
 */
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <StyleGuide />
}
