import { useEffect } from 'react'

export default function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(onDismiss, 3500)
    return () => window.clearTimeout(timer)
  }, [onDismiss, toast])

  if (!toast) return null

  return (
    <div className={`toast toast-${toast.tone}`} role="status" aria-live="polite">
      <span>{toast.message}</span>
      <button type="button" onClick={onDismiss} aria-label="Tutup notifikasi">×</button>
    </div>
  )
}
