import { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'

import { initSettings } from './db/db'
import { AppShell } from './components/layout/AppShell'
import { LoginScreen } from './pages/LoginScreen'
import { SalePage } from './pages/SalePage'
import { ProductsPage } from './pages/ProductsPage'
import { CustomersPage } from './pages/CustomersPage'
import { ReportsPage } from './pages/ReportsPage'
import { SettingsPage } from './pages/SettingsPage'

function App() {
  const [authenticated, setAuthenticated] = useState(() => {
    return sessionStorage.getItem('pos_authenticated') === 'true'
  })
  const [dbReady, setDbReady] = useState(false)

  useEffect(() => {
    initSettings().then(() => setDbReady(true))
  }, [])

  const handleLoginSuccess = () => {
    sessionStorage.setItem('pos_authenticated', 'true')
    setAuthenticated(true)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('pos_authenticated')
    setAuthenticated(false)
  }

  if (!dbReady) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100dvh',
        background: 'var(--color-bg-base)',
        gap: 16,
      }}>
        <div style={{
          width: 64,
          height: 64,
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32,
        }}>
          🏪
        </div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>جارٍ التحميل...</p>
      </div>
    )
  }

  if (!authenticated) {
    return <LoginScreen onSuccess={handleLoginSuccess} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell onLogout={handleLogout} />}>
          <Route path="/" element={<SalePage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
