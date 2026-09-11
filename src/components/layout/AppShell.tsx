import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { Modal } from '../ui/Modal'

const PAGE_TITLES: Record<string, string> = {
  '/': 'مول بالطول — بيع',
  '/products': 'المنتجات',
  '/customers': 'العملاء',
  '/reports': 'التقارير',
  '/settings': 'الإعدادات',
}

interface AppShellProps {
  onLogout?: () => void
}

export function AppShell({ onLogout }: AppShellProps) {
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] ?? 'مول بالطول'
  const [logoutModalOpen, setLogoutModalOpen] = useState(false)

  const handleQuickLogout = () => {
    setLogoutModalOpen(true)
  }

  const confirmLogout = () => {
    setLogoutModalOpen(false)
    onLogout?.()
  }

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="page-header">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
        }}>
          <h1 style={{
            fontSize: 17,
            fontWeight: 800,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.3px',
          }}>
            {title}
          </h1>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            {/* Store badge */}
            <div style={{
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 700,
              color: 'white',
              letterSpacing: '-0.2px',
            }}>
              🏪 مول بالطول
            </div>

            {/* Quick Logout / Lock Button */}
            {onLogout && (
              <button
                type="button"
                onClick={handleQuickLogout}
                title="تسجيل خروج وقفل التطبيق"
                style={{
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 8,
                  padding: '4px 8px',
                  color: 'var(--color-danger-light)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontFamily: 'var(--font-main)',
                }}
              >
                <span>🔒</span>
                <span>خروج</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="page-content">
        <Outlet context={{ onLogout }} />
      </main>

      {/* Bottom navigation */}
      <BottomNav />

      {/* Logout Confirmation Modal */}
      <Modal
        open={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        title="🔒 تسجيل الخروج"
        type="box"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{
            textAlign: 'center',
            padding: '16px 0 8px',
          }}>
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
                flex: 1,
                padding: '12px',
                borderRadius: 12,
                border: '1px solid var(--color-border)',
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--color-text-secondary)',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font-main)',
              }}
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={confirmLogout}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: 'white',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font-main)',
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
