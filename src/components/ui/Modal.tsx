import React, { useEffect } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  type?: 'sheet' | 'box'
  footer?: React.ReactNode
}

export function Modal({ open, onClose, title, children, type = 'sheet', footer }: ModalProps) {
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
      <div
        className={type === 'sheet' ? 'modal-sheet' : 'modal-box'}
        style={footer ? { display: 'flex', flexDirection: 'column', maxHeight: '90dvh', overflow: 'hidden' } : undefined}
      >
        {type === 'sheet' && <div className="modal-drag-handle" style={{ flexShrink: 0 }} />}

        {title && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            flexShrink: 0,
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

        {footer ? (
          <>
            <div style={{
              flex: 1,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              paddingBottom: 10,
              paddingRight: 2,
              paddingLeft: 2,
            }}>
              {children}
            </div>
            <div style={{
              flexShrink: 0,
              paddingTop: 12,
              borderTop: '1px solid var(--color-border)',
              background: 'var(--color-bg-elevated)',
            }}>
              {footer}
            </div>
          </>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
