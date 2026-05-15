'use client'
import { useState, useRef, useEffect } from 'react'
import { MapPin, ChevronDown, Check, Search } from 'lucide-react'

export default function SearchSelect({ value, onChange, options, placeholder, disabled, required, getLabel = (o) => o, getValue = (o) => o }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)
  const inputRef = useRef(null)

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

  const filtered = options.filter(o => getLabel(o).toLowerCase().includes(search.toLowerCase()))
  const selectedLabel = options.find(o => getValue(o) === value)
  const display = selectedLabel ? getLabel(selectedLabel) : ''

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="input-field w-full rounded-2xl pl-9 pr-9 py-3 text-sm text-left flex items-center disabled:opacity-50 disabled:cursor-not-allowed">
        <MapPin size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <span className={display ? 'text-gray-800' : 'text-gray-400'}>
          {display || placeholder}
        </span>
        <ChevronDown size={13} className={`absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-2xl overflow-hidden fade-up"
          style={{boxShadow: '0 16px 48px rgba(91,84,232,0.2)', border: '1px solid #e8e3ff'}}>

          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl outline-none"
                style={{background: '#fafaff', border: '1px solid #f0effe'}}
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-6">No results found</p>
            )}
            {filtered.map((option, i) => {
              const optValue = getValue(option)
              const optLabel = getLabel(option)
              const selected = optValue === value
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    onChange(optValue)
                    setOpen(false)
                    setSearch('')
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-purple-50 flex items-center justify-between gap-2"
                  style={{background: selected ? '#f0effe' : 'transparent', color: selected ? '#5B54E8' : '#374151', fontWeight: selected ? 600 : 400}}>
                  <span className="truncate">{optLabel}</span>
                  {selected && <Check size={14} style={{color: '#5B54E8'}} className="flex-shrink-0" />}
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