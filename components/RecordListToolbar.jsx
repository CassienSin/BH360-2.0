'use client'
import { useId, useRef } from 'react'
import { Search, X, RotateCcw } from 'lucide-react'
import { AppButton, PageState } from './AppUI'
import styles from './record-list-toolbar.module.css'

export default function RecordListToolbar({
  search, onSearchChange, searchLabel, placeholder, filters, value, onFilterChange,
  shown, total, noun, sortHint, onReset, actions,
}) {
  const id = useId()
  const inputRef = useRef(null)
  const filtered = Boolean(search.trim()) || value !== 'all'
  function clearSearch() {
    onSearchChange('')
    inputRef.current?.focus()
  }
  return <section className={`white-card ${styles.toolbar}`} aria-label={`${noun} search and filters`}>
    <div className={styles.topRow}>
      <div className={styles.search}>
        <Search size={17} aria-hidden="true" />
        <input ref={inputRef} type="search" value={search} onChange={e => onSearchChange(e.target.value)}
          aria-label={searchLabel} aria-describedby={`${id}-hint`} placeholder={placeholder}
          onKeyDown={e => { if (e.key === 'Escape' && search) { e.preventDefault(); e.stopPropagation(); clearSearch() } }} />
        {search && <button type="button" onClick={clearSearch} aria-label={`Clear ${searchLabel.toLowerCase()}`}><X size={17} aria-hidden="true" /></button>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
    <div className={styles.filters} role="group" aria-label={`Filter ${noun.toLowerCase()} by status`}>
      {filters.map(filter => <button type="button" key={filter.value} onClick={() => onFilterChange(filter.value)}
        aria-pressed={value === filter.value} aria-label={`${filter.label}: ${filter.count}`}>
        {filter.label}<span aria-hidden="true">{filter.count}</span>
      </button>)}
    </div>
    <div className={styles.bottomRow}>
      <div id={`${id}-hint`}>
        <p role="status" aria-live="polite" aria-atomic="true">Showing <strong>{shown}</strong> of <strong>{total}</strong> {noun.toLowerCase()}{search.trim() ? ` matching “${search.trim()}”` : ''}.</p>
        <p className={styles.hint}>{sortHint}</p>
      </div>
      {filtered && <AppButton variant="ghost" onClick={onReset}><RotateCcw size={14} aria-hidden="true" />Clear filters</AppButton>}
    </div>
  </section>
}

export function RecordListEmpty({ total, search, noun, filterLabel, icon, onReset, description }) {
  const hasSearch = Boolean(search.trim())
  const title = !total ? `No ${noun} yet` : hasSearch ? `No matching ${noun}` : `No ${noun} in this view`
  const detail = !total ? description : hasSearch
    ? `No ${noun} match your search in the ${filterLabel} view. Try another search or clear the filters to see all records.`
    : `There are no ${noun} in this view. Choose another status or view all records.`
  return <PageState icon={icon} title={title} description={detail} actionLabel={total ? `View all ${noun}` : undefined} onAction={total ? onReset : undefined} />
}
