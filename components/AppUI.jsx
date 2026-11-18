'use client'

import { ArrowLeft, AlertCircle, Inbox, Loader2 } from 'lucide-react'
import Band from '@/components/crafted/Band'
import styles from './app-ui.module.css'

export function AppButton({ children, variant = 'primary', busy = false, busyLabel = 'Saving…', disabled, className = '', type = 'button', ...props }) {
  return <button {...props} type={type} className={`${styles.button} ${styles[variant] || styles.primary} ${className}`} disabled={disabled || busy} aria-busy={busy || undefined}>
    {busy ? <><Loader2 size={17} className={styles.spin} aria-hidden="true" />{busyLabel}</> : children}
  </button>
}

// The standalone pages' header: a purple band bar with back, title and
// actions. icon / iconElement / iconStyle are still accepted but not drawn
// (Crafted keeps icons out of tinted tiles). actionsDesktopOnly: hide the
// actions below 640px when the page repeats them in its body on phones.
export function PageHeader({ title, description, onBack, backLabel = 'Go back', icon: Icon, iconElement, iconStyle, actions, actionsDesktopOnly = false, maxWidth }) {
  const iconContent = iconElement || (Icon && <Icon size={21} aria-hidden="true" />)
  return <header className={styles.header}><Band mode="fill" dots={8} seed={3} /><div className={styles.headerInner} style={maxWidth ? { maxWidth } : undefined}>
    {onBack && <button type="button" onClick={onBack} className={styles.back} aria-label={backLabel}><ArrowLeft size={18} strokeWidth={1.9} aria-hidden="true" /></button>}
    {iconContent && <span className={styles.headerIcon} style={iconStyle} aria-hidden="true">{iconContent}</span>}
    <div className={styles.heading}><h1>{title}</h1>{description && <p>{description}</p>}</div>
    {actions && <div className={`${styles.headerActions} ${actionsDesktopOnly ? styles.desktopOnly : ''}`}>{actions}</div>}
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
    <span className={styles.stateIcon}><StateIcon size={24} strokeWidth={1.75} className={kind === 'loading' ? styles.spin : ''} aria-hidden="true" /></span>
    <h2>{title || (kind === 'loading' ? 'Loading…' : kind === 'error' ? 'Unable to load this page' : 'Nothing here yet')}</h2>
    {description && <p>{description}</p>}
    {actionLabel && onAction && <AppButton variant="secondary" onClick={onAction}>{actionLabel}</AppButton>}
  </div>
  return fullPage ? <div className={styles.fullPage}>{content}</div> : content
}
