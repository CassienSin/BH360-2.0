'use client'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Download, MoreHorizontal, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

/*
 * The toolbar pieces of an official list card (O02, O04, O05, O09):
 * a search box, native selects for filters and sorting, an Export menu and
 * a row's "more" menu. 36px tall, radius 10, 1px line border (kit.py
 * searchbox() / select()).
 */

const FIELD = 'h-9 rounded-[10px] border border-line bg-surface text-[13px] text-ink outline-none transition-colors hover:border-line-strong focus-visible:border-brand-strong'

/** Search box; Escape clears it. Forwards a ref for the "/" shortcut. */
export function SearchBox({ value, onChange, label, placeholder = label, inputRef, className = '' }) {
  return (
    <label className={`relative flex min-w-0 items-center ${className}`}>
      <Search size={15} strokeWidth={1.9} aria-hidden="true" className="pointer-events-none absolute left-3 text-muted-foreground" />
      <input ref={inputRef} type="search" value={value} aria-label={label} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') onChange('') }}
        className={`${FIELD} w-full pr-8 pl-9 placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden`} />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear search"
          className="absolute right-1.5 flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-ink">
          <X size={14} />
        </button>
      )}
    </label>
  )
}

/** A native select drawn like the design's filter dropdown. */
export function FilterSelect({ value, onChange, label, options, className = '' }) {
  const on = options[0] && value !== options[0].value
  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      <select value={value} onChange={e => onChange(e.target.value)} aria-label={label}
        className={`${FIELD} w-full cursor-pointer appearance-none pr-8 pl-3 font-bold ${on ? 'border-brand-strong text-brand-strong' : ''}`}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={15} aria-hidden="true" className={`pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 ${on ? 'text-brand-strong' : 'text-muted-foreground'}`} />
    </span>
  )
}

/** A small menu anchored to its button; closes on Escape or an outside click. */
function Menu({ trigger, items, align = 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDown = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <span ref={ref} className="relative inline-flex shrink-0">
      {trigger({ open, toggle: () => setOpen(o => !o) })}
      {open && (
        <div role="menu" className={`absolute top-full z-30 mt-1.5 min-w-44 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-[var(--shadow-float)] ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {items.filter(Boolean).map(item => (
            <button key={item.label} type="button" role="menuitem" disabled={item.disabled}
              onClick={() => { setOpen(false); item.onClick() }}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-bold outline-none hover:bg-surface-sunk focus-visible:bg-surface-sunk disabled:opacity-50 ${item.danger ? 'text-danger' : 'text-ink'}`}>
              {item.icon}{item.label}
            </button>
          ))}
        </div>
      )}
    </span>
  )
}

/** "Export" with CSV and PDF under it. */
export function ExportMenu({ count, onExport, noun = 'records' }) {
  return (
    <Menu items={[
      { label: 'CSV spreadsheet', disabled: count === 0, onClick: () => onExport('csv') },
      { label: 'PDF report', disabled: count === 0, onClick: () => onExport('pdf') },
    ]} trigger={({ open, toggle }) => (
      <Button variant="secondary" onClick={toggle} aria-expanded={open} aria-haspopup="menu"
        aria-label={`Export ${count} ${noun}`} disabled={count === 0} className="h-9 px-2.5 sm:px-3.5">
        <Download aria-hidden="true" /><span className="hidden sm:inline">Export</span>
      </Button>
    )} />
  )
}

/** A row's secondary actions behind a "…" button. */
export function RowMenu({ label, items }) {
  if (!items.filter(Boolean).length) return null
  return (
    <Menu items={items} trigger={({ open, toggle }) => (
      <button type="button" onClick={e => { e.stopPropagation(); toggle() }} aria-expanded={open} aria-haspopup="menu" aria-label={label}
        className="flex size-[34px] items-center justify-center rounded-[10px] border border-line bg-surface text-muted-foreground outline-none hover:border-line-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong">
        <MoreHorizontal size={16} />
      </button>
    )} />
  )
}
