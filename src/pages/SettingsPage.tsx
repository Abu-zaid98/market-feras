import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { exportBackup, importBackup, daysSinceBackup } from '../utils/backup'
import { changePassword, hasPassword, setPassword } from '../utils/auth'
import { getStoredTheme, applyTheme, type Theme } from '../utils/theme'
import { db } from '../db/db'
import { Modal } from '../components/ui/Modal'

export function SettingsPage() {
  const [storeName, setStoreName] = useState('POS System')
  const [ownerName, setOwnerName] = useState('')
  const [currency, setCurrency] = useState('₪')
  const [lowStockDefault, setLowStockDefault] = useState('5')
  const [backupDays, setBackupDays] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [currentTheme, setCurrentTheme] = useState<Theme>(getStoredTheme)

  const handleThemeChange = (t: Theme) => {
    applyTheme(t)
    setCurrentTheme(t)
  }

  // Password modal
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [hasExistingPassword, setHasExistingPassword] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  // Logout confirmation modal
  const [logoutModalOpen, setLogoutModalOpen] = useState(false)

  const outlet = useOutletContext<{ onLogout?: () => void }>()

  const handleLogoutClick = () => {
    setLogoutModalOpen(true)
  }

  const confirmLogout = () => {
    setLogoutModalOpen(false)
    outlet?.onLogout?.()
  }

  useEffect(() => {
    // Load settings
    const loadSettings = async () => {
      const [sName, oName, curr, lStock, days, hasPass] = await Promise.all([
        db.settings.get('storeName'),
        db.settings.get('ownerName'),
        db.settings.get('currency'),
        db.settings.get('lowStockDefault'),
        daysSinceBackup(),
        hasPassword(),
      ])

      if (sName?.value) setStoreName(sName.value as string)
      if (oName?.value) setOwnerName(oName.value as string)
      if (curr?.value) setCurrency(curr.value as string)
      if (lStock?.value) setLowStockDefault(String(lStock.value))
      setBackupDays(days)
      setHasExistingPassword(hasPass)
    }

    loadSettings()
  }, [])

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await db.settings.bulkPut([
        { key: 'storeName', value: storeName.trim() },
        { key: 'ownerName', value: ownerName.trim() },
        { key: 'currency', value: currency.trim() },
        { key: 'lowStockDefault', value: parseInt(lowStockDefault) || 5 },
      ])
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (err) {
      console.error(err)
      alert('حدث خطأ أثناء حفظ الإعدادات')
    } finally {
      setIsSaving(false)
    }
  }

  const handleExport = async () => {
    await exportBackup()
    const days = await daysSinceBackup()
    setBackupDays(days)
    alert('✅ تم تصدير النسخة الاحتياطية بنجاح وحفظها كملف JSON!')
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        if (!confirm('تنبيه: استعادة النسخة الاحتياطية ستستبدل البيانات الحالية بالبيانات الموجودة في الملف. هل تود المتابعة؟')) {
          return
        }
        const result = await importBackup(file)
        if (result.success) {
          alert('✅ تم استعادة البيانات بنجاح!')
          window.location.reload()
        } else {
          alert('❌ فشل الاستيراد: ' + result.error)
        }
      }
    }
    input.click()
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess(false)

    if (newPassword.length < 4) {
      setPasswordError('كلمة المرور يجب أن تكون 4 أرقام/أحرف على الأقل')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('كلمتا المرور غير متطابقتين')
      return
    }

    try {
      if (hasExistingPassword) {
        const ok = await changePassword(oldPassword, newPassword)
        if (!ok) {
          setPasswordError('كلمة المرور الحالية غير صحيحة')
          return
        }
      } else {
        await setPassword(newPassword)
      }

      setPasswordSuccess(true)
      setHasExistingPassword(true)
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => {
        setPasswordModalOpen(false)
        setPasswordSuccess(false)
      }, 1500)
    } catch (err) {
      console.error(err)
      setPasswordError('حدث خطأ أثناء تعيين كلمة المرور')
    }
  }

  return (
    <div style={{ padding: '16px', maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Store Header Card */}
      <div style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 18,
        padding: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{
          width: 60,
          height: 60,
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32,
          boxShadow: '0 4px 16px rgba(59,130,246,0.3)',
          flexShrink: 0,
        }}>
          🏪
        </div>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 4, color: 'var(--color-text-primary)' }}>
            {storeName || 'POS System'}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            نظام نقطة البيع وإدارة الديون (POS & Debt PWA)
          </p>
        </div>
      </div>

      {/* Appearance & Theme Card */}
      <div style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 16,
        padding: 16,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text-primary)' }}>
            🎨 مظهر التطبيق (الثيم)
          </h3>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
            التبديل بين الثيم الداكن والفاتح المريح للعين
          </p>
        </div>

        <div style={{
          display: 'flex',
          background: 'var(--color-input-bg)',
          borderRadius: 12,
          padding: 3,
          border: '1px solid var(--color-border)',
          gap: 4,
        }}>
          <button
            type="button"
            onClick={() => handleThemeChange('dark')}
            style={{
              padding: '6px 14px',
              borderRadius: 9,
              border: 'none',
              background: currentTheme === 'dark' ? 'var(--color-primary)' : 'transparent',
              color: currentTheme === 'dark' ? 'white' : 'var(--color-text-secondary)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'var(--font-main)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            🌙 داكن
          </button>
          <button
            type="button"
            onClick={() => handleThemeChange('light')}
            style={{
              padding: '6px 14px',
              borderRadius: 9,
              border: 'none',
              background: currentTheme === 'light' ? 'var(--color-primary)' : 'transparent',
              color: currentTheme === 'light' ? 'white' : 'var(--color-text-secondary)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'var(--font-main)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            ☀️ فاتح
          </button>
        </div>
      </div>

      {/* Edit Store Profile Form */}
      <div style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 16,
        padding: 18,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800 }}>⚙️ بيانات المتجر والنظام</h3>
          {saveSuccess && (
            <span style={{ fontSize: 13, color: 'var(--color-success-light)', fontWeight: 700 }}>
              تم الحفظ بنجاح ✓
            </span>
          )}
        </div>

        <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>
              اسم المتجر:
            </label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>
              اسم المالك / المسؤول:
            </label>
            <input
              type="text"
              placeholder="مثال: محمد"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>
                رمز العملة:
              </label>
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>
                حد تنبيه نقص المخزون:
              </label>
              <input
                type="number"
                min="1"
                value={lowStockDefault}
                onChange={(e) => setLowStockDefault(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            style={{
              marginTop: 4,
              padding: '11px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              border: 'none',
              color: 'white',
              fontWeight: 800,
              fontSize: 14,
              cursor: isSaving ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-main)',
            }}
          >
            {isSaving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
          </button>
        </form>
      </div>

      {/* Security / Password */}
      <div style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 16,
        padding: 16,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 800 }}>🔒 قفل التطبيق وكلمة المرور</h3>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
            {hasExistingPassword ? 'تم تعيين كلمة مرور مشفرة' : 'لم يتم تعيين كلمة مرور بعد'}
          </p>
        </div>
        <button
          onClick={() => setPasswordModalOpen(true)}
          style={{
            padding: '8px 16px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'var(--font-main)',
          }}
        >
          {hasExistingPassword ? 'تغيير الرمز' : 'تعيين رمز'}
        </button>
      </div>

      {/* Logout Card */}
      <div style={{
        background: 'rgba(239,68,68,0.06)',
        border: '1px solid rgba(239,68,68,0.25)',
        borderRadius: 16,
        padding: 16,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-danger-light)' }}>
            🚪 تسجيل الخروج
          </h3>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
            قفل التطبيق والعودة لشاشة إدخال رمز المرور (PIN)
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogoutClick}
          style={{
            padding: '9px 18px',
            borderRadius: 10,
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            border: 'none',
            color: 'white',
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer',
            fontFamily: 'var(--font-main)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 4px 12px rgba(239,68,68,0.25)',
          }}
        >
          <span>🔒</span>
          <span>تسجيل خروج</span>
        </button>
      </div>

      {/* Backup Section */}
      <div style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 16,
        overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 15, fontWeight: 800 }}>💾 النسخ الاحتياطي والأمان</h3>
            <span style={{
              fontSize: 12,
              padding: '3px 8px',
              borderRadius: 50,
              background: backupDays === null || backupDays > 3 ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
              color: backupDays === null || backupDays > 3 ? 'var(--color-warning-light)' : 'var(--color-success-light)',
              fontWeight: 700,
            }}>
              {backupDays === null ? 'لا توجد نسخة سابقة' : backupDays === 0 ? 'اليوم' : `منذ ${backupDays} أيام`}
            </span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
            يتم تخزين بياناتك محلياً على هذا الجهاز بأمان. احرص على حفظ نسخة أسبوعياً.
          </p>
        </div>

        <button
          onClick={handleExport}
          style={{
            width: '100%',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--color-border)',
            cursor: 'pointer',
            color: 'var(--color-text-primary)',
            textAlign: 'right',
            fontFamily: 'var(--font-main)',
          }}
        >
          <span style={{ fontSize: 22 }}>⬇️</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700 }}>تصدير وحفظ نسخة احتياطية</p>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>تحميل ملف JSON كامل يحتوي المنتجات والديون والفواتير</p>
          </div>
        </button>

        <button
          onClick={handleImport}
          style={{
            width: '100%',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-primary)',
            textAlign: 'right',
            fontFamily: 'var(--font-main)',
          }}
        >
          <span style={{ fontSize: 22 }}>⬆️</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700 }}>استعادة بيانات من ملف نسخة احتياطية</p>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>استيراد ملف JSON واسترجاع كل السجلات السابقة</p>
          </div>
        </button>
      </div>


      {/* MODAL: CHANGE PASSWORD */}
      <Modal
        open={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        title={hasExistingPassword ? 'تغيير رمز المرور' : 'تعيين رمز مرور جديد'}
        type="box"
      >
        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {passwordError && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.15)', color: 'var(--color-danger-light)', fontSize: 13, fontWeight: 600 }}>
              ⚠ {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(16,185,129,0.15)', color: 'var(--color-success-light)', fontSize: 13, fontWeight: 600 }}>
              ✓ تم تعيين كلمة المرور بنجاح!
            </div>
          )}

          {hasExistingPassword && (
            <div>
              <label style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                كلمة المرور الحالية:
              </label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>
          )}

          <div>
            <label style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
              كلمة المرور الجديدة:
            </label>
            <input
              type="password"
              required
              placeholder="4 خانات على الأقل"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
              تأكيد كلمة المرور:
            </label>
            <input
              type="password"
              required
              placeholder="أعد كتابة كلمة المرور"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button
              type="button"
              onClick={() => setPasswordModalOpen(false)}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font-main)',
              }}
            >
              إلغاء
            </button>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 10,
                background: 'var(--color-primary)',
                border: 'none',
                color: 'white',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font-main)',
              }}
            >
              حفظ الرمز
            </button>
          </div>
        </form>
      </Modal>

      {/* Logout Confirmation Modal */}
      <Modal
        open={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        title="🔒 تسجيل الخروج"
        type="box"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🚪</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6 }}>
              هل تريد قفل التطبيق؟
            </p>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              سيتم إغلاق الجلسة الحالية وستحتاج إلى كلمة المرور للدخول مجدداً
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => setLogoutModalOpen(false)}
              style={{
                flex: 1, padding: '12px', borderRadius: 12,
                border: '1px solid var(--color-border)',
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--color-text-secondary)',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'var(--font-main)',
              }}
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={confirmLogout}
              style={{
                flex: 1, padding: '12px', borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: 'white', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'var(--font-main)',
                boxShadow: '0 4px 12px rgba(239,68,68,0.4)',
              }}
            >
              🔒 تأكيد الخروج
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
