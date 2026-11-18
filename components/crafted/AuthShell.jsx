import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, Phone } from 'lucide-react'
import Band from './Band'
import styles from './shell.module.css'

/**
 * Sign in, register, request access and reset (DESIGN.md §4 auth shell):
 * the band fills the whole screen (no fade), a white card is centred on it,
 * white links sit under the card, and "Life in danger? Call 911 first."
 * stays at the bottom.
 *
 *   width     the card's max width: 440 (default), 560–600 for long forms
 *   title     on phones, a back button and this title replace the logo
 *   backHref  where back goes (default "/"); `onBack` overrides it
 *   below     white links under the card ("New here? Create an account")
 */
export default function AuthShell({ children, width = 440, title, backHref = '/', onBack, below }) {
  const back = onBack
    ? <button type="button" onClick={onBack} className={styles.authBackButton} aria-label="Back"><ChevronLeft size={18} strokeWidth={1.9} aria-hidden="true" /></button>
    : <Link href={backHref} className={styles.authBackButton} aria-label="Back"><ChevronLeft size={18} strokeWidth={1.9} aria-hidden="true" /></Link>
  return (
    <div className={styles.auth}>
      <Band mode="fill" dots={22} seed={4} />
      <header className={styles.authTop}>
        <Link href="/" className={`${styles.authLogo} ${title ? styles.deskOnlyFlex : ''}`}>
          <Image src="/logo.png" alt="" width={30} height={30} className={styles.logoOnBand} priority />
          <span>BarangayHub 360</span>
        </Link>
        {title && (
          <div className={styles.authPhoneTop}>
            {back}
            <span className={styles.authPhoneTitle}>{title}</span>
          </div>
        )}
        <Link href="/" className={styles.authHome}>
          <ChevronLeft size={16} strokeWidth={1.9} aria-hidden="true" /> Back to home
        </Link>
      </header>

      <main className={styles.authMain}>
        <div className={styles.authCard} style={{ maxWidth: width }}>{children}</div>
        {below && <div className={styles.authBelow}>{below}</div>}
      </main>

      <footer className={styles.authFoot}>
        <a href="tel:911" className={styles.authSos}>
          <Phone size={14} strokeWidth={1.9} aria-hidden="true" /> Life in danger? Call 911 first.
        </a>
      </footer>
    </div>
  )
}

/**
 * The top of an auth card: an optional step eyebrow ("STEP 1 OF 2"), the
 * title and a muted line under it.
 */
export function AuthHeading({ eyebrow, title, sub, as: Title = 'h1' }) {
  return (
    <div className={styles.authHeading}>
      {eyebrow && <p className={styles.authEyebrow}>{eyebrow}</p>}
      <Title className={styles.authTitle}>{title}</Title>
      {sub && <p className={styles.authSub}>{sub}</p>}
    </div>
  )
}
