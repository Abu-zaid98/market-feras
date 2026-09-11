import { useState, useMemo } from 'react'
import { useProducts, deleteProduct } from '../hooks/useProducts'
import { useCategories } from '../hooks/useCategories'
import { ProductForm } from '../components/products/ProductForm'
import { CategoryManagerModal } from '../components/products/CategoryManagerModal'
import { BarcodeScanner } from '../components/ui/BarcodeScanner'
import { Badge } from '../components/ui/Badge'
import type { Product } from '../db/db'

export function ProductsPage() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannedBarcode, setScannedBarcode] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)

  const categoriesList = useCategories()
  const catIconMap = useMemo(() => {
    const map: Record<string, string> = { 'الكل': '🏷️' }
    categoriesList.forEach((c) => { map[c.name] = c.icon })
    return map
  }, [categoriesList])

  const products = useProducts(search, activeCategory === 'الكل' ? '' : activeCategory)

  const handleEdit = (p: Product) => {
    setEditProduct(p)
    setFormOpen(true)
  }

  const handleDelete = async (p: Product) => {
    if (p.id) await deleteProduct(p.id)
    setDeleteConfirm(null)
  }

  const handleScanResult = (barcode: string) => {
    setScannedBarcode(barcode)
    setSearch(barcode)
    setScannerOpen(false)
    // If product found with this barcode, it'll show in list
    // If not found, open form to add it
    setTimeout(() => {
      const found = products.find((p) => p.barcode === barcode)
      if (!found) {
        setEditProduct(null)
        setFormOpen(true)
      }
    }, 300)
  }

  const totalValue = products.reduce((sum, p) => sum + p.salePrice * p.quantity, 0)
  const lowStockCount = products.filter((p) => p.quantity <= p.lowStockAlert).length

  return (
    <div style={{ padding: '16px' }}>
      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'إجمالي المنتجات', value: products.length, icon: '📦', color: '#3b82f6' },
          { label: 'مخزون منخفض', value: lowStockCount, icon: '⚠️', color: '#f59e0b' },
          { label: 'قيمة المخزون', value: `${totalValue.toFixed(0)} ₪`, icon: '💰', color: '#10b981', small: true },
        ].map((s) => (
          <div key={s.label} style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            padding: '12px 10px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: s.small ? 13 : 18, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search + Scan bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'rgba(255,255,255,0.05)',
          border: '1.5px solid var(--color-border)',
          borderRadius: 50,
          padding: '10px 16px',
        }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <input
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--color-text-primary)', fontFamily: 'var(--font-main)', fontSize: 14,
            }}
            placeholder="ابحث بالاسم أو الباركود..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => { setSearch(''); setScannedBarcode('') }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 18 }}>
              ✕
            </button>
          )}
        </div>
        <button
          onClick={() => setScannerOpen(true)}
          style={{
            width: 48, height: 48,
            background: 'rgba(59,130,246,0.15)',
            border: '1.5px solid rgba(59,130,246,0.35)',
            borderRadius: 14, cursor: 'pointer', fontSize: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >📷</button>
        <button
          onClick={() => { setEditProduct(null); setScannedBarcode(''); setFormOpen(true) }}
          style={{
            width: 48, height: 48,
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            border: 'none', borderRadius: 14, cursor: 'pointer', fontSize: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(59,130,246,0.35)',
          }}
        >+</button>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 14, alignItems: 'center' }}>
        <button
          onClick={() => setActiveCategory('')}
          style={{
            flexShrink: 0,
            padding: '7px 14px',
            borderRadius: 50,
            border: activeCategory === '' ? '1.5px solid rgba(59,130,246,0.6)' : '1.5px solid var(--color-border)',
            background: activeCategory === '' ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
            color: activeCategory === '' ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'var(--font-main)',
            display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <span>🏷️</span>
          <span>الكل</span>
        </button>

        {categoriesList.map((cat) => {
          const isActive = activeCategory === cat.name
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.name)}
              style={{
                flexShrink: 0,
                padding: '7px 14px',
                borderRadius: 50,
                border: isActive ? '1.5px solid rgba(59,130,246,0.6)' : '1.5px solid var(--color-border)',
                background: isActive ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
                color: isActive ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-main)',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          )
        })}

        <button
          type="button"
          onClick={() => setCategoryModalOpen(true)}
          title="إدارة وتعديل وترتيب الأقسام"
          style={{
            flexShrink: 0,
            padding: '7px 14px',
            borderRadius: 50,
            border: '1px dashed rgba(255,255,255,0.25)',
            background: 'rgba(255,255,255,0.03)',
            color: 'var(--color-text-secondary)',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'var(--font-main)',
            display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <span>⚙️</span>
          <span>إدارة الأقسام</span>
        </button>
      </div>

      {/* Product list */}
      {products.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏷️</div>
          <p style={{ fontSize: 16, fontWeight: 700 }}>
            {search ? 'لا توجد نتائج' : 'لا توجد منتجات بعد'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            {search ? 'جرّب كلمة بحث مختلفة' : 'اضغط + لإضافة منتج جديد'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {products.map((p) => {
            const isLow = p.quantity <= p.lowStockAlert
            const isOut = p.quantity === 0
            const profit = p.salePrice - p.costPrice

            return (
              <div
                key={p.id}
                style={{
                  background: 'var(--color-bg-card)',
                  border: `1px solid ${isOut ? 'rgba(239,68,68,0.3)' : isLow ? 'rgba(245,158,11,0.3)' : 'var(--color-border)'}`,
                  borderRadius: 14,
                  padding: '14px',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                {/* Category icon */}
                <div style={{
                  width: 46, height: 46,
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, flexShrink: 0,
                }}>
                  {catIconMap[p.category] ?? '📦'}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </p>
                    {isOut && <Badge variant="danger">نفد</Badge>}
                    {!isOut && isLow && <Badge variant="warning">منخفض</Badge>}
                  </div>

                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text-primary)', direction: 'ltr' }}>
                      {p.salePrice.toFixed(2)} ₪
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--color-success-light)' }}>
                      ربح: {profit.toFixed(2)} ₪
                    </span>
                    <span style={{
                      fontSize: 12,
                      color: isOut ? 'var(--color-danger-light)' : isLow ? 'var(--color-warning-light)' : 'var(--color-text-muted)',
                      fontWeight: 600,
                    }}>
                      متبقي: {p.quantity}
                    </span>
                  </div>

                  {p.barcode && (
                    <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, direction: 'ltr', textAlign: 'right' }}>
                      {p.barcode}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => handleEdit(p)}
                    style={{
                      width: 36, height: 36, borderRadius: 9,
                      background: 'rgba(59,130,246,0.15)',
                      border: '1px solid rgba(59,130,246,0.25)',
                      cursor: 'pointer', fontSize: 16,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >✏️</button>
                  <button
                    onClick={() => setDeleteConfirm(p)}
                    style={{
                      width: 36, height: 36, borderRadius: 9,
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      cursor: 'pointer', fontSize: 16,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >🗑️</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            style={{
              background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
              borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>حذف المنتج؟</h3>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 20 }}>
              سيتم حذف "<strong style={{ color: 'var(--color-text-primary)' }}>{deleteConfirm.name}</strong>" نهائياً
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  padding: '12px', borderRadius: 12, cursor: 'pointer', fontWeight: 700,
                  background: 'rgba(255,255,255,0.08)', border: '1px solid var(--color-border)',
                  color: 'var(--color-text-secondary)', fontFamily: 'var(--font-main)', fontSize: 14,
                }}
              >إلغاء</button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                style={{
                  padding: '12px', borderRadius: 12, cursor: 'pointer', fontWeight: 700,
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  border: 'none', color: 'white', fontFamily: 'var(--font-main)', fontSize: 14,
                }}
              >حذف</button>
            </div>
          </div>
        </div>
      )}

      {/* Product form */}
      <ProductForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditProduct(null); setScannedBarcode('') }}
        product={editProduct}
        initialBarcode={scannedBarcode}
      />

      {/* Barcode scanner */}
      <BarcodeScanner
        open={scannerOpen}
        onDetected={handleScanResult}
        onClose={() => setScannerOpen(false)}
      />

      {/* Category Manager Modal */}
      <CategoryManagerModal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
      />
    </div>
  )
}
