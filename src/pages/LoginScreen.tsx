import { useState } from 'react'
import { verifyPassword, changePassword } from '../utils/auth'
import { getStoredTheme, toggleTheme, type Theme } from '../utils/theme'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'

interface LoginScreenProps {
  onSuccess: () => void
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [password, setPasswordInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isShaking, setIsShaking] = useState(false)
  const [theme, setTheme] = useState<Theme>(getStoredTheme)

  // Change PIN modal state
  const [changePinOpen, setChangePinOpen] = useState(false)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [changeError, setChangeError] = useState('')
  const [changeSuccess, setChangeSuccess] = useState(false)
  const [changingLoading, setChangingLoading] = useState(false)

  const handleToggleTheme = () => {
    const next = toggleTheme()
    setTheme(next)
  }

  const handleNumpad = (digit: string) => {
    if (password.length >= 6 || loading) return
    const next = password + digit
    setPasswordInput(next)
    setError('')

    // Play subtle haptic feedback on mobile if supported
    if (navigator.vibrate) {
      try { navigator.vibrate(15) } catch {}
    }

    if (next.length === 6) {
      setTimeout(() => handleSubmit(next), 120)
    }
  }

  const handleDelete = () => {
    if (loading) return
    setPasswordInput((p) => p.slice(0, -1))
    setError('')
  }

  const handleClear = () => {
    if (loading) return
    setPasswordInput('')
    setError('')
  }

  const handleSubmit = async (pin = password) => {
    if (loading) return
    if (pin.length < 4) {
      setError('يرجى إدخال رمز الدخول كاملاً')
      return
    }

    setLoading(true)
    setError('')

    try {
      const valid = await verifyPassword(pin)
      if (valid) {
        onSuccess()
      } else {
        setIsShaking(true)
        setError('رمز الدخول غير صحيح')
        setPasswordInput('')
        if (navigator.vibrate) {
          try { navigator.vibrate([40, 60, 40]) } catch {}
        }
        setTimeout(() => setIsShaking(false), 500)
      }
    } catch (err) {
      console.error(err)
      setError('حدث خطأ أثناء التحقق')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveNewPin = async (e: React.FormEvent) => {
    e.preventDefault()
    setChangeError('')
    setChangeSuccess(false)

    if (newPin.length < 4) {
      setChangeError('يجب أن يتكون الرمز الجديد من 4 إلى 6 أرقام')
      return
    }

    if (newPin !== confirmPin) {
      setChangeError('الرمز الجديد وتأكيده غير متطابقين')
      return
    }

    setChangingLoading(true)
    try {
      const ok = await changePassword(currentPin, newPin)
      if (!ok) {
        setChangeError('الرمز الحالي غير صحيح')
        return
      }

      setChangeSuccess(true)
      setCurrentPin('')
      setNewPin('')
      setConfirmPin('')
      setTimeout(() => {
        setChangePinOpen(false)
        setChangeSuccess(false)
      }, 1500)
    } catch (err) {
      console.error(err)
      setChangeError('حدث خطأ أثناء حفظ الرمز الجديد')
    } finally {
      setChangingLoading(false)
    }
  }

  const NUMPAD_LAYOUT = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['C', '0', '⌫'],
  ]

  return (
    <div
      className="login-screen"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg-base)',
        padding: '24px 20px',
        overflow: 'hidden',
      }}
    >
      {/* Top action bar: Theme Switcher */}
      <div
        style={{
          position: 'absolute',
          top: 'calc(16px + env(safe-area-inset-top, 0px))',
          left: 20,
          right: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)' }}>
          نظام نقاط البيع v1.0
        </span>

        <button
          type="button"
          onClick={handleToggleTheme}
          title={theme === 'dark' ? 'التبديل إلى الثيم الفاتح' : 'التبديل إلى الثيم الداكن'}
          style={{
            background: 'var(--color-input-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            padding: '6px 12px',
            color: 'var(--color-text-primary)',
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontWeight: 700,
            fontFamily: 'var(--font-main)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span style={{ fontSize: 12 }}>{theme === 'dark' ? 'فاتح' : 'داكن'}</span>
        </button>
      </div>

      {/* Background glow accent */}
      <div
        style={{
          position: 'absolute',
          width: 360,
          height: 360,
          background: 'radial-gradient(circle, var(--color-primary-glow) 0%, transparent 70%)',
          borderRadius: '50%',
          top: '-60px',
          left: '50%',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
        }}
      />

      {/* Header & App Brand */}
      <div style={{ textAlign: 'center', marginBottom: 20, zIndex: 1 }}>
        <div
          style={{
            width: 72,
            height: 72,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            borderRadius: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 36,
            margin: '0 auto 12px',
            boxShadow: '0 8px 30px rgba(59,130,246,0.35)',
          }}
        >
          🏪
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px', color: 'var(--color-text-primary)' }}>
          مول بالطول
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginTop: 4, fontWeight: 600 }}>
          أدخل رمز الدخول للمتابعة
        </p>
      </div>

      {/* PIN Dots Display */}
      <div
        className={isShaking ? 'shake-animation' : ''}
        style={{
          display: 'flex',
          gap: 14,
          marginBottom: 16,
          zIndex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          height: 28,
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => {
          const filled = i < password.length
          return (
            <div
              key={i}
              style={{
                width: 15,
                height: 15,
                borderRadius: '50%',
                background: filled
                  ? 'linear-gradient(135deg, var(--color-primary), var(--color-purple))'
                  : 'transparent',
                border: `2px solid ${filled ? 'var(--color-primary)' : 'var(--color-text-muted)'}`,
                transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: filled ? 'scale(1.15)' : 'scale(1)',
                boxShadow: filled ? '0 0 10px var(--color-primary-glow)' : 'none',
              }}
            />
          )
        })}
      </div>

      {/* Error Message */}
      <div style={{ height: 26, marginBottom: 8, zIndex: 1 }}>
        {error && (
          <p
            style={{
              color: 'var(--color-danger-light)',
              fontSize: 13,
              fontWeight: 700,
              margin: 0,
              textAlign: 'center',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            ⚠ {error}
          </p>
        )}
      </div>

      {/* Professional Keypad */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          width: '100%',
          maxWidth: 290,
          zIndex: 1,
          marginBottom: 16,
          direction: 'ltr',
        }}
      >
        {NUMPAD_LAYOUT.flat().map((key, i) => {
          const isDel = key === '⌫'
          const isClear = key === 'C'
          const isSpecial = isDel || isClear

          return (
            <button
              key={i}
              type="button"
              onClick={() => {
                if (isDel) handleDelete()
                else if (isClear) handleClear()
                else handleNumpad(key)
              }}
              style={{
                height: 58,
                borderRadius: 16,
                border: '1px solid var(--color-border)',
                background: isDel
                  ? 'rgba(239,68,68,0.1)'
                  : isClear
                  ? 'var(--color-input-bg)'
                  : 'var(--color-bg-card)',
                color: isDel
                  ? 'var(--color-danger-light)'
                  : isClear
                  ? 'var(--color-text-muted)'
                  : 'var(--color-text-primary)',
                fontSize: isSpecial ? 18 : 23,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'transform 0.1s ease, background-color 0.15s ease',
                fontFamily: 'var(--font-main)',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
              }}
              onTouchStart={(e) => {
                const t = e.currentTarget
                t.style.transform = 'scale(0.92)'
                t.style.background = 'var(--color-primary-glow)'
              }}
              onTouchEnd={(e) => {
                const t = e.currentTarget
                t.style.transform = 'scale(1)'
                t.style.background = isDel ? 'rgba(239,68,68,0.1)' : 'var(--color-bg-card)'
              }}
            >
              {key}
            </button>
          )
        })}
      </div>

      {/* Submit Button (if 4 to 5 digits entered) */}
      <div style={{ width: '100%', maxWidth: 290, zIndex: 1, minHeight: 46 }}>
        {password.length >= 4 && password.length < 6 ? (
          <Button
            variant="primary"
            full
            loading={loading}
            onClick={() => handleSubmit()}
            style={{ height: 46, borderRadius: 14, fontSize: 15 }}
          >
            دخول ➔
          </Button>
        ) : (
          <div style={{ height: 46 }} />
        )}
      </div>

      {/* Footer Option: Change PIN */}
      <div style={{ marginTop: 8, zIndex: 1 }}>
        <button
          type="button"
          onClick={() => {
            setChangeError('')
            setChangeSuccess(false)
            setCurrentPin('')
            setNewPin('')
            setConfirmPin('')
            setChangePinOpen(true)
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-text-muted)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font-main)',
            textDecoration: 'none',
            padding: '6px 12px',
            borderRadius: 8,
            transition: 'color 0.15s ease',
          }}
        >
          🔒 تغيير رمز الدخول
        </button>
      </div>

      {/* Change PIN Modal */}
      <Modal
        open={changePinOpen}
        onClose={() => setChangePinOpen(false)}
        title="🔒 تغيير رمز الدخول"
        type="box"
      >
        <form onSubmit={handleSaveNewPin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
            أدخل الرمز الحالي لتعيين رمز جديد وحفظه في المتصفح.
          </p>

          {changeError && (
            <div style={{
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 10,
              padding: '8px 12px',
              color: 'var(--color-danger-light)',
              fontSize: 13,
              fontWeight: 700,
            }}>
              ⚠ {changeError}
            </div>
          )}

          {changeSuccess && (
            <div style={{
              background: 'rgba(16,185,129,0.12)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 10,
              padding: '8px 12px',
              color: 'var(--color-success-light)',
              fontSize: 13,
              fontWeight: 700,
              textAlign: 'center',
            }}>
              ✓ تم تحديث رمز الدخول وحفظه بنجاح!
            </div>
          )}

          <div className="input-wrap">
            <label className="input-label">الرمز الحالي</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value)}
              placeholder="أدخل الرمز الحالي..."
              className="input"
              autoFocus
              required
            />
          </div>

          <div className="input-wrap">
            <label className="input-label">الرمز الجديد (4 - 6 أرقام)</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="أدخل الرمز الجديد..."
              className="input"
              required
            />
          </div>

          <div className="input-wrap">
            <label className="input-label">تأكيد الرمز الجديد</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              placeholder="أعد إدخال الرمز الجديد..."
              className="input"
              required
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button
              type="button"
              onClick={() => setChangePinOpen(false)}
              className="btn btn-ghost"
              style={{ flex: 1 }}
            >
              إلغاء
            </button>
            <Button
              type="submit"
              variant="primary"
              loading={changingLoading}
              style={{ flex: 1 }}
            >
              حفظ الرمز
            </Button>
          </div>
        </form>
      </Modal>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
        .shake-animation {
          animation: shake 0.4s ease;
        }
      `}</style>
    </div>
  )
}
