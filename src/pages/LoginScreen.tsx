import { useState, useEffect } from 'react'
import { hasPassword, setPassword, verifyPassword } from '../utils/auth'
import { Button } from '../components/ui/Button'

interface LoginScreenProps {
  onSuccess: () => void
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [mode, setMode] = useState<'checking' | 'setup' | 'login'>('checking')
  const [password, setPasswordInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [dots, setDots] = useState<boolean[]>([false, false, false, false, false, false])

  useEffect(() => {
    hasPassword().then((has) => {
      setMode(has ? 'login' : 'setup')
    })
  }, [])

  // PIN dots animation
  useEffect(() => {
    setDots(Array.from({ length: 6 }, (_, i) => i < password.length))
  }, [password])

  const handleNumpad = (digit: string) => {
    if (password.length >= 6) return
    const next = password + digit
    setPasswordInput(next)
    setError('')
    if (next.length === 6) {
      setTimeout(() => handleSubmit(next), 150)
    }
  }

  const handleDelete = () => {
    setPasswordInput((p) => p.slice(0, -1))
    setError('')
  }

  const handleSubmit = async (pin = password) => {
    if (mode === 'setup') {
      if (pin.length < 4) { setError('يجب أن تكون الرقمية 4 أرقام على الأقل'); return }
      // In setup: first 6 digits = the PIN, no confirm needed for simplicity
      setLoading(true)
      await setPassword(pin)
      setLoading(false)
      onSuccess()
      return
    }

    if (pin.length < 4) { setError('أدخل الرقم السري'); return }
    setLoading(true)
    const valid = await verifyPassword(pin)
    setLoading(false)
    if (valid) {
      onSuccess()
    } else {
      setError('رقم سري خاطئ')
      setPasswordInput('')
    }
  }

  if (mode === 'checking') {
    return (
      <div className="login-screen">
        <div style={{ fontSize: 40 }}>🏪</div>
        <p style={{ color: 'var(--color-text-muted)', marginTop: 12 }}>جارٍ التحميل...</p>
      </div>
    )
  }

  const NUMPAD = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', '⌫'],
  ]

  return (
    <div className="login-screen">
      {/* Background glow */}
      <div className="login-bg-glow" />

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 40, zIndex: 1 }}>
        <div style={{
          width: 80,
          height: 80,
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          borderRadius: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 40,
          margin: '0 auto 16px',
          boxShadow: '0 8px 40px rgba(59,130,246,0.4)',
        }}>
          🏪
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.5px' }}>
          مول بالطول
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 4 }}>
          {mode === 'setup' ? 'اختر رقماً سرياً للتطبيق' : 'أدخل الرقم السري'}
        </p>
      </div>

      {/* PIN dots */}
      <div style={{
        display: 'flex',
        gap: 14,
        marginBottom: 12,
        zIndex: 1,
      }}>
        {dots.map((filled, i) => (
          <div
            key={i}
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: filled
                ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
                : 'rgba(255,255,255,0.12)',
              border: '2px solid',
              borderColor: filled ? 'transparent' : 'rgba(255,255,255,0.2)',
              transition: 'all 0.15s ease',
              transform: filled ? 'scale(1.1)' : 'scale(1)',
            }}
          />
        ))}
      </div>

      {/* Error */}
      {error && (
        <p style={{
          color: 'var(--color-danger-light)',
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 8,
          animation: 'slideDown 0.2s ease',
          zIndex: 1,
        }}>
          ⚠ {error}
        </p>
      )}

      {/* Setup hint */}
      {mode === 'setup' && (
        <p style={{
          color: 'var(--color-text-muted)',
          fontSize: 12,
          marginBottom: 16,
          textAlign: 'center',
          zIndex: 1,
        }}>
          أدخل 6 أرقام ← سيُحفظ كرقمك السري
        </p>
      )}

      {/* Numpad */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        width: '100%',
        maxWidth: 280,
        zIndex: 1,
        marginBottom: 24,
        direction: 'ltr',
      }}>
        {NUMPAD.flat().map((key, i) => {
          if (key === '') return <div key={i} />
          const isDel = key === '⌫'
          return (
            <button
              key={i}
              onClick={() => isDel ? handleDelete() : handleNumpad(key)}
              style={{
                height: 64,
                borderRadius: 14,
                border: '1px solid var(--color-border)',
                background: isDel
                  ? 'rgba(239,68,68,0.1)'
                  : 'rgba(255,255,255,0.05)',
                color: isDel ? 'var(--color-danger-light)' : 'var(--color-text-primary)',
                fontSize: isDel ? 22 : 24,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
                fontFamily: 'var(--font-main)',
              }}
              onTouchStart={(e) => {
                const t = e.currentTarget
                t.style.background = isDel
                  ? 'rgba(239,68,68,0.25)'
                  : 'rgba(59,130,246,0.2)'
                t.style.transform = 'scale(0.93)'
              }}
              onTouchEnd={(e) => {
                const t = e.currentTarget
                t.style.background = isDel
                  ? 'rgba(239,68,68,0.1)'
                  : 'rgba(255,255,255,0.05)'
                t.style.transform = 'scale(1)'
              }}
            >
              {key}
            </button>
          )
        })}
      </div>

      {/* Confirm button (for short PINs) */}
      {password.length >= 4 && password.length < 6 && (
        <Button
          variant="primary"
          full
          loading={loading}
          onClick={() => handleSubmit()}
          style={{ maxWidth: 280 }}
        >
          {mode === 'setup' ? 'حفظ الرقم السري' : 'دخول'}
        </Button>
      )}
    </div>
  )
}
