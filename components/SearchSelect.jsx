'use client'
import { useState, useRef, useEffect, useMemo, useId } from 'react'
import { MapPin, ChevronDown, Check, Search } from 'lucide-react'

// Coerce any label to a safe string. A single option with a null/undefined
// label (e.g. a database row with a missing name) previously crashed the
// whole component at .toLowerCase().
const toLabel = (v) => (v == null ? '' : String(v))

export default function SearchSelect({
  value,
  onChange,
  options = [],
  placeholder,
  disabled,
  required,
  getLabel = (o) => o,
  getValue = (o) => o,
}) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const [search, setSearch] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const ref = useRef(null)
  const inputRef = useRef(null)
  const buttonRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter(o => toLabel(getLabel(o)).toLowerCase().includes(q))
  }, [options, search, getLabel])

  // Keep the highlighted option visible while navigating with arrow keys.
  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.children[highlighted]
    el?.scrollIntoView?.({ block: 'nearest' })
  }, [highlighted, open])

  const selectedOption = options.find(o => getValue(o) === value)
  const display = selectedOption ? toLabel(getLabel(selectedOption)) : ''

  function selectOption(option) {
    onChange(getValue(option))
    setOpen(false)
    setSearch('')
    buttonRef.current?.focus()
  }

  function close() {
    setOpen(false)
    setSearch('')
    buttonRef.current?.focus()
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[highlighted]) selectOption(filtered[highlighted])
    } else if (e.key === 'Tab') {
      // Tabbing away shouldn't leave an orphaned dropdown behind
      setOpen(false)
      setSearch('')
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => { if (disabled) return; setOpen(!open); setHighlighted(0) }}
        onKeyDown={e => {
          // Open with keyboard the same way a native select does
          if (!disabled && !open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            setOpen(true)
            setHighlighted(0)
          }
        }}
        disabled={disabled}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-required={required || undefined}
        className="input-field w-full rounded-[10px] h-[46px] pl-10 pr-10 text-sm text-left flex items-center disabled:opacity-60 disabled:bg-surface-sunk disabled:cursor-not-allowed">
        <MapPin size={16} strokeWidth={1.9} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <span className={`truncate ${display ? 'text-ink' : 'text-muted-foreground'}`}>
          {display || placeholder}
        </span>
        <ChevronDown size={16} strokeWidth={1.9} aria-hidden="true" className={`absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Invisible input so the `required` prop participates in native form validation */}
      {required && !disabled && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value={display}
          onChange={() => {}}
          onFocus={() => buttonRef.current?.focus()}
          style={{ position: 'absolute', opacity: 0, height: 0, width: '100%', bottom: 0, left: 0, pointerEvents: 'none' }}
        />
      )}

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-surface rounded-[14px] overflow-hidden border border-line shadow-[var(--shadow-float)]">

          {/* Search */}
          <div className="p-2 border-b border-line">
            <div className="relative">
              <Search size={16} strokeWidth={1.9} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                ref={inputRef}
                value={search}
                onChange={e => { setSearch(e.target.value); setHighlighted(0) }}
                onKeyDown={handleKeyDown}
                placeholder="Search..."
                aria-label="Search options"
                className="w-full h-10 pl-9 pr-3 text-sm rounded-[10px] outline-none border border-line bg-surface text-ink focus:border-brand-strong"
              />
            </div>
          </div>

          {/* Options list */}
          <div ref={listRef} id={listId} role="listbox" className="max-h-64 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground text-[13px] py-6">
                {search ? `No results for "${search}"` : 'No options available'}
              </p>
            )}
            {filtered.map((option, i) => {
              const optValue = getValue(option)
              const optLabel = toLabel(getLabel(option))
              const selected = optValue === value
              const isHighlighted = i === highlighted
              return (
                <button
                  key={optValue ?? `opt-${i}`}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => selectOption(option)}
                  onMouseEnter={() => setHighlighted(i)}
                  className="w-full px-3.5 py-2.5 text-left text-sm transition-colors flex items-center justify-between gap-2"
                  style={{
                    background: selected ? 'var(--brand-soft)' : isHighlighted ? 'var(--surface-sunk)' : 'transparent',
                    color: selected ? 'var(--brand-strong)' : 'var(--ink)',
                    fontWeight: selected ? 700 : 400,
                  }}>
                  <span className="truncate">{optLabel || '—'}</span>
                  {selected && <Check size={16} strokeWidth={2.2} style={{ color: 'var(--brand-strong)' }} className="flex-shrink-0" aria-hidden="true" />}
                </button>
              )
            })}
          </div>

          {/* Count footer */}
          {filtered.length > 0 && (
            <div className="px-3 py-2 border-t border-line bg-surface-sunk text-xs text-muted-foreground text-center">
              {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}