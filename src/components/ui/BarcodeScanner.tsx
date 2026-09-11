import { useEffect } from 'react'
import { useCamera } from '../../hooks/useCamera'
import { Modal } from './Modal'

interface BarcodeScannerProps {
  open: boolean
  onDetected: (barcode: string) => void
  onClose: () => void
}

export function BarcodeScanner({ open, onDetected, onClose }: BarcodeScannerProps) {
  const { videoRef, scanning, error, startScanning, stopScanning } = useCamera()

  useEffect(() => {
    if (open) {
      startScanning((code) => {
        onDetected(code)
        onClose()
      })
    } else {
      stopScanning()
    }
    return () => stopScanning()
  }, [open])

  return (
    <Modal open={open} onClose={() => { stopScanning(); onClose() }} title="مسح الباركود" type="sheet">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        {/* Camera viewfinder */}
        <div style={{
          position: 'relative',
          width: '100%',
          maxWidth: 320,
          aspectRatio: '1',
          borderRadius: 16,
          overflow: 'hidden',
          background: '#000',
          border: '2px solid var(--color-border)',
        }}>
          <video
            ref={videoRef}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            playsInline
            muted
          />

          {/* Scan frame overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {/* Corner brackets */}
            {[
              { top: '20%', right: '20%', borderTop: '3px solid #3b82f6', borderRight: '3px solid #3b82f6', borderRadius: '0 8px 0 0' },
              { top: '20%', left: '20%', borderTop: '3px solid #3b82f6', borderLeft: '3px solid #3b82f6', borderRadius: '8px 0 0 0' },
              { bottom: '20%', right: '20%', borderBottom: '3px solid #3b82f6', borderRight: '3px solid #3b82f6', borderRadius: '0 0 8px 0' },
              { bottom: '20%', left: '20%', borderBottom: '3px solid #3b82f6', borderLeft: '3px solid #3b82f6', borderRadius: '0 0 0 8px' },
            ].map((style, i) => (
              <div key={i} style={{ position: 'absolute', width: 40, height: 40, ...style }} />
            ))}

            {/* Scan line animation */}
            {scanning && (
              <div style={{
                position: 'absolute',
                left: '20%',
                right: '20%',
                height: 2,
                background: 'linear-gradient(90deg, transparent, #3b82f6, transparent)',
                animation: 'scanLine 2s ease-in-out infinite',
              }} />
            )}
          </div>

          {/* Not scanning yet overlay */}
          {!scanning && !error && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.6)',
            }}>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>جارٍ تشغيل الكاميرا...</p>
            </div>
          )}
        </div>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 12,
            padding: '12px 16px',
            width: '100%',
            textAlign: 'center',
          }}>
            <p style={{ color: 'var(--color-danger-light)', fontSize: 14, fontWeight: 600 }}>
              ⚠ {error}
            </p>
          </div>
        )}

        {scanning && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, textAlign: 'center' }}>
            📷 وجّه الكاميرا نحو الباركود
          </p>
        )}

        <button
          onClick={() => { stopScanning(); onClose() }}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            padding: '12px 24px',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            fontFamily: 'var(--font-main)',
            fontWeight: 600,
            fontSize: 14,
            width: '100%',
          }}
        >
          إلغاء
        </button>
      </div>

      <style>{`
        @keyframes scanLine {
          0% { top: 20%; }
          50% { top: 75%; }
          100% { top: 20%; }
        }
      `}</style>
    </Modal>
  )
}
