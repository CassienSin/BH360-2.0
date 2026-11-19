import { Phone } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Rows, Row } from '@/components/ui/table'
import { HOTLINES, telHref, numberLabel } from '@/lib/hotlines'

/**
 * Hotlines in a card, one row each: a phone glyph (red for emergency
 * lines), the name, and the number. A known number makes the row a tel:
 * link; an unknown one (the barangay hall with no number saved) shows
 * "Tap to call" and isn't a link, so nothing pretends to dial.
 *
 *   lines     defaults to HOTLINES; pass hotlinesFor(phone) to fill the hall
 *   detailed  the long name and a description (help); otherwise short names
 */
export default function HotlineList({ lines = HOTLINES, detailed = false }) {
  return (
    <Card>
      <Rows>
        {lines.map(line => {
          const href = telHref(line.number)
          const body = (
            <>
              <Phone size={18} strokeWidth={1.9} aria-hidden="true" className={`shrink-0 ${line.danger ? 'text-danger' : 'text-brand-strong'}`} />
              <span className="flex-1 min-w-0">
                <span className="block truncate text-sm font-bold text-ink">{detailed ? line.name : line.short}</span>
                {detailed && <span className="block truncate text-xs text-muted-foreground">{line.desc}</span>}
              </span>
              <span className={`text-[13px] font-bold tabular-nums ${line.number ? 'text-ink' : 'text-muted-foreground'}`}>{numberLabel(line.number)}</span>
            </>
          )
          return href ? (
            <Row key={line.key} as="a" href={href} interactive aria-label={`Call ${line.name}, ${line.number}`} className="flex items-center gap-3">{body}</Row>
          ) : (
            <Row key={line.key} className="flex items-center gap-3" title="No number saved yet">{body}</Row>
          )
        })}
      </Rows>
    </Card>
  )
}
