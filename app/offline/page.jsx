'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Clock, Check, Phone } from 'lucide-react'
import { useOnline } from '@/lib/useOnline'
import { pending, describe } from '@/lib/offline/outbox'
import { HOTLINES, telHref } from '@/lib/hotlines'
import PageShell from '@/components/crafted/PageShell'
import { Card } from '@/components/ui/card'
import { Rows, Row } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { SectionLabel } from '@/components/ui/text'

// The lines shown here: emergency first, then fire and ambulance.
const OFFLINE_LINES = ['emergency', 'bfp', 'redcross', 'pnp'].map(key => HOTLINES.find(h => h.key === key))

/**
 * Where the service worker sends a navigation it cannot serve.
 *
 * It used to fall back to '/', which is the landing page — so losing signal
 * mid-session dropped a tanod onto a marketing screen with no explanation.
 */
function OfflineInner() {
  const online = useOnline()
  // Where they were actually trying to go, so Try again returns them there
  // rather than reloading this page.
  const from = useSearchParams().get('from')
  const [waiting, setWaiting] = useState(null)

  useEffect(() => { pending().then(items => setWaiting(describe(items))) }, [])

  return (
    <PageShell large
      title={online ? 'You’re back online' : 'You’re offline'}
      sub={online ? 'This page wasn’t saved for offline. Try again to carry on.' : 'Some things still work.'}
      footer={
        <Button size="lg" full onClick={() => { window.location.href = from || '/' }}>
          {from ? 'Try that page again' : 'Try again'}
        </Button>
      }
      >
      {waiting && (
        <Card lift className="flex items-start gap-3 px-[18px] py-3.5">
          <Clock size={18} strokeWidth={1.9} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink">{waiting.charAt(0).toUpperCase() + waiting.slice(1)} waiting to send</p>
            <p className="text-xs text-muted-foreground mt-0.5">It goes out the next time you open the app with a connection.</p>
          </div>
        </Card>
      )}

      <Card lift={!waiting}>
        <Rows>
          {[
            'Write a report now. It sends when you are back online.',
            'Pages you opened before are still here.',
            'Call a hotline. Calls do not need data.',
          ].map(line => (
            <Row key={line} className="flex items-start gap-3">
              <Check size={16} strokeWidth={2.2} className="mt-0.5 shrink-0 text-ok" aria-hidden="true" />
              <p className="text-[13px] leading-[1.55] text-body">{line}</p>
            </Row>
          ))}
        </Rows>
      </Card>

      <div>
        <SectionLabel>Hotlines</SectionLabel>
        <Card>
          <Rows>
            {OFFLINE_LINES.map(line => (
              <Row key={line.key} as="a" href={telHref(line.number)} interactive className="flex items-center gap-3">
                <Phone size={18} strokeWidth={1.9} aria-hidden="true" className={`shrink-0 ${line.danger ? 'text-danger' : 'text-brand-strong'}`} />
                <span className="flex-1 min-w-0 truncate text-sm font-bold text-ink">{line.short}</span>
                <span className="text-[13px] font-bold text-muted-foreground tabular-nums">{line.number}</span>
              </Row>
            ))}
          </Rows>
        </Card>
      </div>
    </PageShell>
  )
}

/** useSearchParams needs a Suspense boundary in the App Router. */
export default function Offline() {
  return (
    <Suspense fallback={null}>
      <OfflineInner />
    </Suspense>
  )
}
