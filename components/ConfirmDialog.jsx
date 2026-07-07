'use client'
import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, X, Trash2, CheckCircle, LogOut, Info } from 'lucide-react'

const variants = {
  danger: {
    icon: Trash2,
    iconBg: '#fef2f2',
    iconColor: '#ef4444',
    confirmBg: 'linear-gradient(135deg, #ef4444, #dc2626)',
    confirmShadow: '0 8px 32px rgba(239,68,68,0.4)',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: '#fff7ed',
    iconColor: '#f97316',
    confirmBg: 'linear-gradient(135deg, #f97316, #ea580c)',
    confirmShadow: '0 8px 32px rgba(249,115,22,0.4)',
  },
  success: {
    icon: CheckCircle,
    iconBg: '#f0fdf4',
    iconColor: '#22c55e',
    confirmBg: 'linear-gradient(135deg, #22c55e, #16a34a)',
    confirmShadow: '0 8px 32px rgba(34,197,94,0.4)',
  },
  info: {
    icon: Info,
    iconBg: '#f0effe',
    iconColor: '#5B54E8',
    confirmBg: 'linear-gradient(135deg, #5B54E8, #7C75F0)',
    confirmShadow: '0 8px 32px rgba(91,84,232,0.4)',
  },
  logout: {
    icon: LogOut,
    iconBg: '#fef2f2',
    iconColor: '#ef4444',
    confirmBg: 'linear-gradient(135deg, #ef4444, #dc2626)',
    confirmShadow: '0 8px 32px rgba(239,68,68,0.4)',
  },
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
}) {
  const v = variants[variant] || variants.danger
  const Icon = v.icon
  const cancelRef = useRef(null)

  // If onConfirm returns a promise, the dialog manages its own loading
  // state — callers no longer need to wire up a `loading` prop for every
  // async confirmation (though the prop still works and takes priority).
  const [internalLoading, setInternalLoading] = useState(false)
  const isLoading = loading || internalLoading

  useEffect(() => {
    if (!open) {
      setInternalLoading(false)
      return
    }
    const handleEsc = (e) => {
      // Don't allow closing while the confirmed action is in flight
      if (e.key === 'Escape' && !isLoading) onClose()
    }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [open, onClose, isLoading])

  // Focus the CANCEL button on open — the safe default for a destructive
  // dialog. A stray Enter press cancels instead of deleting/signing out,
  // and keyboard focus lands inside the dialog rather than behind it.
  useEffect(() => {
    if (open) setTimeout(() => cancelRef.current?.focus(), 50)
  }, [open])

  async function handleConfirm() {
    if (isLoading) return
    try {
      const result = onConfirm?.()
      if (result && typeof result.then === 'function') {
        setInternalLoading(true)
        await result
      }
    } catch (err) {
      // Surface in console; the caller's own error handling (toasts etc.)
      // still runs — this just guarantees the dialog never gets stuck.
      console.error('ConfirmDialog onConfirm failed:', err)
    } finally {
      setInternalLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', animation: 'fadeUp 0.2s ease' }}
      onClick={() => { if (!isLoading) onClose() }}>

      <div className="w-full max-w-md rounded-3xl overflow-hidden fade-up-1 relative"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        style={{ background: 'white', boxShadow: '0 32px 80px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}>

        {/* Close button */}
        <button onClick={onClose} disabled={isLoading} aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors z-10 disabled:opacity-50">
          <X size={16} />
        </button>

        <div className="p-6 sm:p-8 text-center">
          {/* Icon */}
          <div className="relative w-16 h-16 mx-auto mb-5" aria-hidden="true">
            <div className="absolute inset-0 rounded-3xl animate-pulse"
              style={{ background: v.iconBg, opacity: 0.5 }} />
            <div className="relative w-full h-full rounded-3xl flex items-center justify-center"
              style={{ background: v.iconBg }}>
              <Icon size={28} style={{ color: v.iconColor }} />
            </div>
          </div>

          {/* Title & Message */}
          <h2 id="confirm-dialog-title" className="text-xl font-black text-gray-900 mb-2" style={{ letterSpacing: '-0.5px' }}>{title}</h2>
          <p id="confirm-dialog-message" className="text-sm text-gray-500 leading-relaxed">{message}</p>
        </div>

        {/* Buttons */}
        <div className="px-6 sm:px-8 pb-6 sm:pb-8 flex gap-3">
          <button
            ref={cancelRef}
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-3 rounded-2xl text-sm font-bold transition-all hover:bg-gray-50 disabled:opacity-50"
            style={{ background: '#fafaff', color: '#6b7280', border: '1px solid #f0effe' }}>
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-all hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
            style={{ background: v.confirmBg, boxShadow: v.confirmShadow }}>
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processing...
              </span>
            ) : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}