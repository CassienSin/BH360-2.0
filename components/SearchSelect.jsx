'use client'
import { useState, useRef, useEffect, useMemo } from 'react'
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

  // Reset highlight when the result set changes so it never points
  // past the end of a shorter list.
  useEffect(() => { setHighlighted(0) }, [search, open])

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
        onClick={() => !disabled && setOpen(!open)}
        onKeyDown={e => {
          // Open with keyboard the same way a native select does
          if (!disabled && !open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            setOpen(true)
          }
        }}
        disabled={disabled}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-required={required || undefined}
        className="input-field w-full rounded-2xl pl-9 pr-9 py-3 text-sm text-left flex items-center disabled:opacity-50 disabled:cursor-not-allowed">
        <MapPin size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <span className={`truncate ${display ? 'text-gray-800' : 'text-gray-400'}`}>
          {display || placeholder}
        </span>
        <ChevronDown size={13} className={`absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
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
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-2xl overflow-hidden fade-up"
          style={{ boxShadow: '0 16px 48px rgba(91,84,232,0.2)', border: '1px solid #e8e3ff' }}>

          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search..."
                aria-label="Search options"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl outline-none"
                style={{ background: '#fafaff', border: '1px solid #f0effe' }}
              />
            </div>
          </div>

          {/* Options list */}
          <div ref={listRef} role="listbox" className="max-h-64 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-6">
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
                  className="w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between gap-2"
                  style={{
                    background: selected ? '#f0effe' : isHighlighted ? '#faf5ff' : 'transparent',
                    color: selected ? '#5B54E8' : '#374151',
                    fontWeight: selected ? 600 : 400,
                  }}>
                  <span className="truncate">{optLabel || '—'}</span>
                  {selected && <Check size={14} style={{ color: '#5B54E8' }} className="flex-shrink-0" />}
                </button>
              )
            })}
          </div>

          {/* Count footer */}
          {filtered.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-100 text-xs text-gray-400 text-center">
              {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}