import React, { useEffect } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  type?: 'sheet' | 'box'
}

export function Modal({ open, onClose, title, children, type = 'sheet' }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className={`modal-backdrop ${type === 'box' ? 'center' : ''}`}
      onClick={handleBackdropClick}
    >
      <div className={type === 'sheet' ? 'modal-sheet' : 'modal-box'}>
        {type === 'sheet' && <div className="modal-drag-handle" />}

        {title && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>{title}</h2>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                borderRadius: 8,
                width: 36,
                height: 36,
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                fontSize: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>
        )}

        {children}
      </div>
    </div>
  )
}
