import { useEffect, useState } from 'react'
import { useCamera } from '../../hooks/useCamera'
import { Modal } from './Modal'

interface BarcodeScannerProps {
  open: boolean
  onDetected: (barcode: string) => void
  onClose: () => void
}

export function BarcodeScanner({ open, onDetected, onClose }: BarcodeScannerProps) {
  const { videoRef, scanning, error, hasTorch, torchOn, toggleTorch, startScanning, stopScanning } =
    useCamera()
  const [manualCode, setManualCode] = useState('')

  useEffect(() => {
    if (open) {
      setManualCode('')
      startScanning((code) => {
        onDetected(code)
        onClose()
      })
    } else {
      stopScanning()
    }
    return () => stopScanning()
  }, [open])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = manualCode.trim()
    if (trimmed) {
      stopScanning()
      onDetected(trimmed)
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        stopScanning()
        onClose()
      }}
      title="مسح الباركود بالكاميرا"
      type="sheet"
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        {/* Camera viewfinder */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 320,
            aspectRatio: '1',
            borderRadius: 16,
            overflow: 'hidden',
            background: '#000',
            border: '2px solid var(--color-border)',
          }}
        >
          <video
            ref={videoRef}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            playsInline
            muted
          />

          {/* Scan frame overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Corner brackets */}
            {[
              {
                top: '25%',
                right: '15%',
                borderTop: '3px solid #3b82f6',
                borderRight: '3px solid #3b82f6',
                borderRadius: '0 8px 0 0',
              },
              {
                top: '25%',
                left: '15%',
                borderTop: '3px solid #3b82f6',
                borderLeft: '3px solid #3b82f6',
                borderRadius: '8px 0 0 0',
              },
              {
                bottom: '25%',
                right: '15%',
                borderBottom: '3px solid #3b82f6',
                borderRight: '3px solid #3b82f6',
                borderRadius: '0 0 8px 0',
              },
              {
                bottom: '25%',
                left: '15%',
                borderBottom: '3px solid #3b82f6',
                borderLeft: '3px solid #3b82f6',
                borderRadius: '0 0 0 8px',
              },
            ].map((style, i) => (
              <div key={i} style={{ position: 'absolute', width: 36, height: 36, ...style }} />
            ))}

            {/* Scan line animation */}
            {scanning && (
              <div
                style={{
                  position: 'absolute',
                  left: '15%',
                  right: '15%',
                  height: 3,
                  background: 'linear-gradient(90deg, transparent, #60a5fa, #3b82f6, transparent)',
                  boxShadow: '0 0 10px #3b82f6',
                  animation: 'scanLine 2s ease-in-out infinite',
                }}
              />
            )}
          </div>

          {/* Torch toggle button */}
          {hasTorch && (
            <button
              onClick={toggleTorch}
              style={{
                position: 'absolute',
                top: 12,
                left: 12,
                background: torchOn ? '#3b82f6' : 'rgba(0,0,0,0.6)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '50%',
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                color: 'white',
                cursor: 'pointer',
                zIndex: 10,
              }}
              title="تشغيل الكشاف"
            >
              {torchOn ? '🔦' : '💡'}
            </button>
          )}

          {/* Not scanning yet overlay */}
          {!scanning && !error && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.7)',
              }}
            >
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>جارٍ تشغيل الكاميرا...</p>
            </div>
          )}
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 12,
              padding: '10px 14px',
              width: '100%',
              textAlign: 'center',
            }}
          >
            <p style={{ color: 'var(--color-danger-light)', fontSize: 13, fontWeight: 600 }}>
              ⚠ {error}
            </p>
          </div>
        )}

        {scanning && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, textAlign: 'center', margin: 0 }}>
            📷 وجّه الكاميرا نحو خطوط الباركود داخل الإطار
          </p>
        )}

        {/* Manual Barcode input */}
        <form
          onSubmit={handleManualSubmit}
          style={{
            width: '100%',
            display: 'flex',
            gap: 8,
            marginTop: 4,
          }}
        >
          <input
            type="text"
            inputMode="numeric"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="أو اكتب رقم الباركود هنا..."
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              fontSize: 14,
              outline: 'none',
              fontFamily: 'var(--font-main)',
              direction: 'ltr',
              textAlign: 'center',
            }}
          />
          <button
            type="submit"
            disabled={!manualCode.trim()}
            style={{
              padding: '0 16px',
              borderRadius: 10,
              background: manualCode.trim() ? '#3b82f6' : 'rgba(255,255,255,0.1)',
              border: 'none',
              color: 'white',
              fontWeight: 700,
              fontSize: 13,
              cursor: manualCode.trim() ? 'pointer' : 'default',
              fontFamily: 'var(--font-main)',
            }}
          >
            إدخال
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            stopScanning()
            onClose()
          }}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            padding: '10px 24px',
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
          0% { top: 25%; }
          50% { top: 70%; }
          100% { top: 25%; }
        }
      `}</style>
    </Modal>
  )
}

