'use client'

import { ArrowLeft, AlertCircle, Inbox, Loader2 } from 'lucide-react'
import styles from './app-ui.module.css'

export function AppButton({ children, variant = 'primary', busy = false, busyLabel = 'Saving…', disabled, className = '', type = 'button', ...props }) {
  return <button {...props} type={type} className={`${styles.button} ${styles[variant] || styles.primary} ${className}`} disabled={disabled || busy} aria-busy={busy || undefined}>
    {busy ? <><Loader2 size={17} className={styles.spin} aria-hidden="true" />{busyLabel}</> : children}
  </button>
}

export function PageHeader({ title, description, onBack, backLabel = 'Go back', icon: Icon, actions }) {
  return <header className={styles.header}><div className={styles.headerInner}>
    {onBack && <button type="button" onClick={onBack} className={styles.back} aria-label={backLabel}><ArrowLeft size={19} aria-hidden="true" /></button>}
    {Icon && <span className={styles.headerIcon}><Icon size={21} aria-hidden="true" /></span>}
    <div className={styles.heading}><h1>{title}</h1>{description && <p>{description}</p>}</div>
    {actions && <div className={styles.headerActions}>{actions}</div>}
  </div></header>
}

export function StatusBadge({ children, tone = 'neutral', bg, color, dot = false }) {
  return <span className={`${styles.badge} ${styles[`tone_${tone}`] || styles.tone_neutral}`} style={{ background: bg, color }}>
    {dot && <span className={styles.dot} aria-hidden="true" />}{children}
  </span>
}

export function PageState({ kind = 'empty', title, description, icon: Icon = Inbox, actionLabel, onAction, fullPage = false }) {
  const StateIcon = kind === 'loading' ? Loader2 : kind === 'error' ? AlertCircle : Icon
  const content = <div className={`${styles.state} ${kind === 'error' ? styles.stateError : ''}`} role={kind === 'error' ? 'alert' : kind === 'loading' ? 'status' : undefined}>
    <span className={styles.stateIcon}><StateIcon size={27} className={kind === 'loading' ? styles.spin : ''} aria-hidden="true" /></span>
    <h2>{title || (kind === 'loading' ? 'Loading…' : kind === 'error' ? 'Unable to load this page' : 'Nothing here yet')}</h2>
    {description && <p>{description}</p>}
    {actionLabel && onAction && <AppButton variant="secondary" onClick={onAction}>{actionLabel}</AppButton>}
  </div>
  return fullPage ? <div className={styles.fullPage}>{content}</div> : content
}
