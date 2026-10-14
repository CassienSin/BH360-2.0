'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X, Trash2, CheckCircle, LogOut, Info } from 'lucide-react'
import { AppButton } from './AppUI'
import { lockBodyScroll } from '@/lib/modalScrollLock'
import styles from './confirm-dialog.module.css'

const variants = {
  danger: { icon: Trash2, tint: '#fef2f2', color: '#b91c1c' },
  warning: { icon: AlertTriangle, tint: '#fff7ed', color: '#9a3412' },
  success: { icon: CheckCircle, tint: '#ecfdf5', color: '#047857' },
  info: { icon: Info, tint: '#f0effe', color: '#4a43d4' },
  logout: { icon: LogOut, tint: '#f0effe', color: '#4a43d4' },
}

export default function ConfirmDialog({ open, ...props }) {
  // A new instance resets pending/error state for every opening.
  return open ? <OpenConfirmDialog {...props} /> : null
}

function OpenConfirmDialog({
  onClose, onConfirm, title = 'Are you sure?', message = 'This action cannot be undone.',
  confirmText = 'Confirm', cancelText = 'Cancel', variant = 'danger', loading = false,
  loadingText = 'Processing…',
}) {
  const id = useId()
  const panelRef = useRef(null)
  const cancelRef = useRef(null)
  const inFlight = useRef(false)
  const mounted = useRef(false)
  const [internalLoading, setInternalLoading] = useState(false)
  const [error, setError] = useState('')
  const isLoading = loading || internalLoading
  const v = variants[variant] || variants.danger
  const Icon = v.icon

  useEffect(() => {
    mounted.current = true
    const previousFocus = document.activeElement
    const unlock = lockBodyScroll()
    cancelRef.current?.focus()
    return () => {
      mounted.current = false
      unlock()
      requestAnimationFrame(() => {
        if (!document.querySelector('[data-bh-confirm-dialog]') && previousFocus?.isConnected) previousFocus.focus()
      })
    }
  }, [])

  useEffect(() => {
    if (isLoading) panelRef.current?.focus()
    function onKeyDown(event) {
      const dialogs = document.querySelectorAll('[data-bh-confirm-dialog]')
      if (dialogs[dialogs.length - 1] !== panelRef.current) return
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!isLoading && !inFlight.current) onClose?.()
      }
      if (event.key !== 'Tab') return
      const controls = [...panelRef.current.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]')]
      const first = controls[0], last = controls[controls.length - 1]
      const outside = !panelRef.current.contains(document.activeElement) || document.activeElement === panelRef.current
      if (!controls.length) { event.preventDefault(); panelRef.current.focus() }
      else if (event.shiftKey && (document.activeElement === first || outside)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || outside)) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isLoading, onClose])

  function close() {
    if (!isLoading && !inFlight.current) onClose?.()
  }

  async function handleConfirm() {
    if (isLoading || inFlight.current) return
    inFlight.current = true
    setInternalLoading(true)
    setError('')
    try {
      await onConfirm?.()
    } catch (err) {
      console.error('ConfirmDialog onConfirm failed:', err)
      if (mounted.current) setError('The action could not be completed. Check its status before trying again.')
    } finally {
      inFlight.current = false
      if (mounted.current) setInternalLoading(false)
    }
  }

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className={styles.overlay} onClick={close}>
      <div ref={panelRef} data-bh-confirm-dialog role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`} aria-busy={isLoading || undefined} tabIndex={-1} className={styles.panel} onClick={e => e.stopPropagation()}>
        <button type="button" onClick={close} disabled={isLoading} aria-label="Close confirmation" className={styles.close}><X size={18} aria-hidden="true" /></button>
        <div className={styles.content}>
          <span className={styles.icon} style={{ background: v.tint, color: v.color }} aria-hidden="true"><Icon size={27} /></span>
          <h2 id={`${id}-title`}>{title}</h2>
          <p id={`${id}-message`}>{message}</p>
          {error && <p role="alert" className={styles.error}>{error}</p>}
        </div>
        <div className={styles.actions}>
          <AppButton ref={cancelRef} variant="secondary" disabled={isLoading} onClick={close}>{cancelText}</AppButton>
          <AppButton variant={variant === 'danger' ? 'danger' : 'primary'} busy={isLoading} busyLabel={loadingText} onClick={handleConfirm} style={{ background: v.color }}>{confirmText}</AppButton>
        </div>
        {isLoading && <p className={styles.progress} role="status">Please wait while this action is processed.</p>}
      </div>
    </div>, document.body,
  )
}