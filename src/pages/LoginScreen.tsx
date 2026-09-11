import { useState, useEffect } from 'react'
import { hasPassword, setPassword, verifyPassword, resetToDefaultPassword, DEFAULT_MASTER_PIN } from '../utils/auth'
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

  const handleQuickDefaultLogin = async () => {
    setLoading(true)
    await resetToDefaultPassword()
    setLoading(false)
    onSuccess()
  }

  const handleSubmit = async (pin = password) => {
    if (mode === 'setup') {
      if (pin.length < 4) {
        setError('يجب أن يكون الرمز 4 أرقام على الأقل')
        return
      }
      setLoading(true)
      await setPassword(pin)
      setLoading(false)
      onSuccess()
      return
    }

    if (pin.length < 4) {
      setError('أدخل الرقم السري')
      return
    }
    setLoading(true)
    const valid = await verifyPassword(pin)
    setLoading(false)
    if (valid) {
      onSuccess()
    } else {
      setError('رقم سري غير صحيح')
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
      <div style={{ textAlign: 'center', marginBottom: 24, zIndex: 1 }}>
        <div
          style={{
            width: 76,
            height: 76,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 38,
            margin: '0 auto 14px',
            boxShadow: '0 8px 32px rgba(59,130,246,0.35)',
          }}
        >
          🏪
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px' }}>مول بالطول</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 4 }}>
          {mode === 'setup' ? 'قم بتعيين رمز سري للتطبيق' : 'أدخل الرقم السري للمتابعة'}
        </p>

        {/* Default PIN Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(59,130,246,0.12)',
            border: '1px solid rgba(59,130,246,0.25)',
            borderRadius: 20,
            padding: '4px 12px',
            fontSize: 12,
            color: '#93c5fd',
            marginTop: 10,
          }}
        >
          🔑 الرمز الافتراضي: <strong style={{ letterSpacing: '1px', color: 'white' }}>{DEFAULT_MASTER_PIN}</strong>
        </div>
      </div>

      {/* PIN dots */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 10,
          zIndex: 1,
        }}
      >
        {dots.map((filled, i) => (
          <div
            key={i}
            style={{
              width: 15,
              height: 15,
              borderRadius: '50%',
              background: filled
                ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
                : 'rgba(255,255,255,0.12)',
              border: '2px solid',
              borderColor: filled ? 'transparent' : 'rgba(255,255,255,0.2)',
              transition: 'all 0.15s ease',
              transform: filled ? 'scale(1.15)' : 'scale(1)',
            }}
          />
        ))}
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            marginBottom: 8,
            zIndex: 1,
          }}
        >
          <p
            style={{
              color: 'var(--color-danger-light)',
              fontSize: 13,
              fontWeight: 600,
              margin: 0,
            }}
          >
            ⚠ {error}
          </p>
          <button
            type="button"
            onClick={handleQuickDefaultLogin}
            style={{
              background: 'none',
              border: 'none',
              color: '#60a5fa',
              fontSize: 12,
              cursor: 'pointer',
              textDecoration: 'underline',
              fontFamily: 'var(--font-main)',
            }}
          >
            اضغط هنا للدخول بالرمز الافتراضي (123456)
          </button>
        </div>
      )}

      {/* Numpad */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          width: '100%',
          maxWidth: 280,
          zIndex: 1,
          marginBottom: 16,
          direction: 'ltr',
        }}
      >
        {NUMPAD.flat().map((key, i) => {
          if (key === '') return <div key={i} />
          const isDel = key === '⌫'
          return (
            <button
              key={i}
              onClick={() => (isDel ? handleDelete() : handleNumpad(key))}
              style={{
                height: 60,
                borderRadius: 14,
                border: '1px solid var(--color-border)',
                background: isDel ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
                color: isDel ? 'var(--color-danger-light)' : 'var(--color-text-primary)',
                fontSize: isDel ? 22 : 24,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
                fontFamily: 'var(--font-main)',
              }}
              onTouchStart={(e) => {
                const t = e.currentTarget
                t.style.background = isDel ? 'rgba(239,68,68,0.25)' : 'rgba(59,130,246,0.2)'
                t.style.transform = 'scale(0.93)'
              }}
              onTouchEnd={(e) => {
                const t = e.currentTarget
                t.style.background = isDel ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)'
                t.style.transform = 'scale(1)'
              }}
            >
              {key}
            </button>
          )
        })}
      </div>

      {/* Confirm or Quick Entry */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 280, zIndex: 1 }}>
        {password.length >= 4 && password.length < 6 && (
          <Button
            variant="primary"
            full
            loading={loading}
            onClick={() => handleSubmit()}
          >
            {mode === 'setup' ? 'حفظ الرقم السري' : 'دخول'}
          </Button>
        )}

        <button
          type="button"
          onClick={handleQuickDefaultLogin}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            padding: '8px 12px',
            color: 'var(--color-text-muted)',
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: 'var(--font-main)',
            transition: 'all 0.15s ease',
          }}
        >
          دخول سريع بالرمز الافتراضي (123456) ➔
        </button>
      </div>
    </div>
  )
}

