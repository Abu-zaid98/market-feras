import { useState, useMemo } from 'react'
import { useProducts, getProductByBarcode } from '../hooks/useProducts'
import { useCustomers, addCustomer } from '../hooks/useCustomers'
import { createSaleInvoice, type CreateSaleInput } from '../hooks/useInvoices'
import { useCategories } from '../hooks/useCategories'
import { useCart } from '../hooks/useCart'
import { BarcodeScanner } from '../components/ui/BarcodeScanner'
import { CategoryManagerModal } from '../components/products/CategoryManagerModal'
import { Modal } from '../components/ui/Modal'
import { CustomSelect } from '../components/ui/CustomSelect'
import { formatCurrency } from '../utils/currency'
import {
  type Invoice,
  type PaymentType,
  type PaymentMethod,
  type DiscountType,
  getPaymentMethodName,
} from '../db/db'

export function SalePage() {
  const [activeTab, setActiveTab] = useState<'catalog' | 'cart'>('catalog')
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('')

  // Persistent cart hook
  const { cart, addToCart, updateQty, setDirectQty, removeFromCart, clearCart } = useCart()

  // Dynamic categories
  const categoriesList = useCategories()
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)

  // Map category icons
  const catIconMap = useMemo(() => {
    const map: Record<string, string> = { 'الكل': '🏷️' }
    categoriesList.forEach((c) => {
      map[c.name] = c.icon
    })
    return map
  }, [categoriesList])

  // Discounts
  const [discountType, setDiscountType] = useState<DiscountType>('fixed')
  const [discountValue, setDiscountValue] = useState<number>(0)
  const [showDiscountModal, setShowDiscountModal] = useState(false)

  // Checkout modal
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [paymentType, setPaymentType] = useState<PaymentType>('cash')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [partialPaidAmount, setPartialPaidAmount] = useState<string>('')
  const [saleNote, setSaleNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Quick customer modal
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false)
  const [newCustName, setNewCustName] = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')

  // Scanner & alerts
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanMessage, setScanMessage] = useState<string | null>(null)
  const [scannerFeedback, setScannerFeedback] = useState<{ text: string; success: boolean } | null>(null)

  // Success Receipt modal
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null)

  const products = useProducts(search, activeCategory === 'الكل' ? '' : activeCategory)
  const customers = useCustomers('', 'all')

  const resetSaleState = () => {
    clearCart()
    setDiscountValue(0)
    setSaleNote('')
    setSelectedCustomerId(null)
    setPartialPaidAmount('')
    setPaymentType('cash')
    setPaymentMethod('cash')
  }

  // Continuous Scanner handling (looks up product across entire DB)
  const handleBarcodeScan = async (barcode: string) => {
    const trimmed = barcode.trim()
    if (!trimmed) return

    let found = await getProductByBarcode(trimmed)
    if (!found) {
      found = products.find((p) => p.barcode === trimmed)
    }

    if (found) {
      addToCart(found)
      const msg = `✅ تمت إضافة: ${found.name}`
      setScanMessage(msg)
      setScannerFeedback({ text: msg, success: true })
      setTimeout(() => setScanMessage(null), 2500)
    } else {
      const msg = `⚠️ غير مسجل: ${trimmed}`
      setScanMessage(msg)
      setScannerFeedback({ text: msg, success: false })
      setTimeout(() => setScanMessage(null), 3500)
    }
  }

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.qty, 0)
  }, [cart])

  const totalCartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.qty, 0)
  }, [cart])

  const discountAmount = useMemo(() => {
    if (!discountValue || discountValue <= 0) return 0
    if (discountType === 'percent') {
      return (subtotal * Math.min(100, discountValue)) / 100
    }
    return Math.min(subtotal, discountValue)
  }, [subtotal, discountType, discountValue])

  const finalTotal = useMemo(() => {
    return Math.max(0, subtotal - discountAmount)
  }, [subtotal, discountAmount])

  // Checkout handling
  const handleOpenCheckout = () => {
    if (cart.length === 0) return
    setPaymentType('cash')
    setPaymentMethod('cash')
    setPartialPaidAmount('')
    setCheckoutOpen(true)
  }

  const handleCreateQuickCustomer = async () => {
    if (!newCustName.trim()) return
    const id = await addCustomer({
      name: newCustName.trim(),
      phone: newCustPhone.trim(),
    })
    setSelectedCustomerId(id)
    setNewCustName('')
    setNewCustPhone('')
    setQuickCustomerOpen(false)
  }

  const handleCompleteSale = async () => {
    if (cart.length === 0) return

    // Validation
    if ((paymentType === 'debt' || paymentType === 'partial') && !selectedCustomerId) {
      alert('يرجى اختيار العميل لتسجيل البيع بالدين')
      return
    }

    let paid = finalTotal
    let debt = 0

    if (paymentType === 'debt') {
      paid = 0
      debt = finalTotal
    } else if (paymentType === 'partial') {
      const parsedPaid = parseFloat(partialPaidAmount) || 0
      if (parsedPaid >= finalTotal) {
        paid = finalTotal
        debt = 0
      } else {
        paid = Math.max(0, parsedPaid)
        debt = finalTotal - paid
      }
    }

    setIsSubmitting(true)

    try {
      const selectedCustomer = customers.find((c) => c.id === selectedCustomerId)

      const saleData: CreateSaleInput = {
        customerId: (paymentType === 'cash' && !selectedCustomerId) ? null : selectedCustomerId,
        customerName: selectedCustomer?.name,
        items: cart.map(({ productId, name, qty, price, costPrice }) => ({
          productId,
          name,
          qty,
          price,
          costPrice,
        })),
        subtotal,
        discountType: discountValue > 0 ? discountType : null,
        discountValue,
        discountAmount,
        total: finalTotal,
        paidAmount: paid,
        debtAmount: debt,
        paymentType,
        paymentMethod: paymentType === 'debt' ? undefined : paymentMethod,
        note: saleNote,
      }

      const inv = await createSaleInvoice(saleData)
      setCompletedInvoice(inv)
      setCheckoutOpen(false)
      resetSaleState()
    } catch (err) {
      console.error(err)
      alert('حدث خطأ أثناء حفظ الفاتورة')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Format WhatsApp invoice message
  const shareWhatsApp = (inv: Invoice) => {
    const customer = customers.find((c) => c.id === inv.customerId)
    const phone = customer?.phone?.replace(/\D/g, '') || ''

    const dateStr = new Date(inv.createdAt).toLocaleString('ar-EG', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })

    const itemsText = inv.items
      .map((i) => `• ${i.name} (${i.qty} × ${formatCurrency(i.price)}) = ${formatCurrency(i.qty * i.price)}`)
      .join('\n')

    const methodName = inv.paymentType === 'debt'
      ? 'دين كامل (آجل) 📝'
      : `${getPaymentMethodName(inv.paymentMethod)} ${inv.paymentType === 'partial' ? '(دفع جزئي)' : ''}`

    let msg = `🧾 *فاتورة مبيعات — مول بالطول*\n`
    msg += `رقم الفاتورة: #${inv.id}\n`
    msg += `التاريخ: ${dateStr}\n`
    if (inv.customerName) {
      msg += `العميل: ${inv.customerName}\n`
    }
    msg += `طريقة الدفع: ${methodName}\n`
    msg += `--------------------------------\n`
    msg += `${itemsText}\n`
    msg += `--------------------------------\n`
    msg += `المجموع الفرعي: ${formatCurrency(inv.subtotal)}\n`
    if (inv.discountAmount > 0) {
      msg += `الخصم: -${formatCurrency(inv.discountAmount)}\n`
    }
    msg += `*الإجمالي النهائي: ${formatCurrency(inv.total)}*\n`
    msg += `المبلغ المدفوع: ${formatCurrency(inv.paidAmount)}\n`
    if (inv.debtAmount > 0) {
      msg += `*المتبقي كدين: ${formatCurrency(inv.debtAmount)}*\n`
    }
    msg += `\nشكراً لزيارتكم ونتشرف بخدمتكم دائماً! 🌟`

    const encoded = encodeURIComponent(msg)

    if (phone) {
      const cleanPhone = phone.startsWith('0') ? '970' + phone.slice(1) : phone
      window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank')
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank')
    }
  }

  return (
    <div
      style={{
        padding: '12px 14px',
        paddingBottom: cart.length > 0 ? 'calc(var(--bottom-bar-total-height, 72px) + 150px)' : 'var(--page-bottom-padding, 110px)',
        maxWidth: 640,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Toast scan message */}
      {scanMessage && (
        <div style={{
          background: 'linear-gradient(135deg, #1e293b, #0f172a)',
          border: '1px solid var(--color-primary)',
          color: 'var(--color-text-primary)',
          padding: '10px 16px',
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 600,
          textAlign: 'center',
          boxShadow: 'var(--shadow-md)',
        }}>
          {scanMessage}
        </div>
      )}

      {/* Top Search + Barcode & Switch Tabs */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(255,255,255,0.05)',
          border: '1.5px solid var(--color-border)',
          borderRadius: 50,
          padding: '6px 12px',
        }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <input
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-main)',
              fontSize: 14,
            }}
            placeholder="ابحث عن منتج أو باركود..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 16 }}
            >
              ✕
            </button>
          )}
        </div>

        <button
          onClick={() => setScannerOpen(true)}
          title="مسح باركود بالكاميرا"
          style={{
            width: 38,
            height: 38,
            background: 'rgba(59,130,246,0.15)',
            border: '1.5px solid rgba(59,130,246,0.35)',
            borderRadius: 12,
            cursor: 'pointer',
            fontSize: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          📷
        </button>

        {/* Tab switch between Catalog and Cart */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 12,
          padding: 3,
          border: '1px solid var(--color-border)',
        }}>
          <button
            onClick={() => setActiveTab('catalog')}
            style={{
              padding: '6px 10px',
              borderRadius: 9,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 12,
              fontFamily: 'var(--font-main)',
              background: activeTab === 'catalog' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'catalog' ? 'white' : 'var(--color-text-muted)',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            📦 الأصناف
          </button>
          <button
            onClick={() => setActiveTab('cart')}
            style={{
              padding: '6px 10px',
              borderRadius: 9,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 12,
              fontFamily: 'var(--font-main)',
              background: activeTab === 'cart' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'cart' ? 'white' : 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            🛒 السلة
            {totalCartCount > 0 && (
              <span style={{
                background: activeTab === 'cart' ? 'white' : 'var(--color-primary)',
                color: activeTab === 'cart' ? 'var(--color-primary)' : 'white',
                fontSize: 11,
                fontWeight: 800,
                borderRadius: 50,
                padding: '1px 6px',
              }}>
                {totalCartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* VIEW 1: CATALOG TAB */}
      {activeTab === 'catalog' && (
        <div>
          {/* Dynamic Categories bar with manage button */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', overflowX: 'auto', paddingBottom: 6, marginBottom: 10 }}>
            {/* All option */}
            <button
              onClick={() => setActiveCategory('')}
              style={{
                flexShrink: 0,
                padding: '6px 12px',
                borderRadius: 50,
                border: activeCategory === '' ? '1.5px solid rgba(59,130,246,0.6)' : '1.5px solid var(--color-border)',
                background: activeCategory === '' ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
                color: activeCategory === '' ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-main)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
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
                    padding: '6px 12px',
                    borderRadius: 50,
                    border: isActive ? '1.5px solid rgba(59,130,246,0.6)' : '1.5px solid var(--color-border)',
                    background: isActive ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
                    color: isActive ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-main)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                </button>
              )
            })}

            {/* Quick manage categories button */}
            <button
              type="button"
              onClick={() => setCategoryModalOpen(true)}
              title="إدارة وتعديل الأقسام"
              style={{
                flexShrink: 0,
                padding: '6px 10px',
                borderRadius: 50,
                border: '1px dashed rgba(255,255,255,0.2)',
                background: 'transparent',
                color: 'var(--color-text-muted)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font-main)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>⚙️</span>
              <span>الأقسام</span>
            </button>
          </div>

          {/* Product Cards Grid */}
          {products.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 10px' }}>
              <div className="empty-icon">📦</div>
              <p style={{ fontSize: 15, fontWeight: 700 }}>لا توجد منتجات مطابقة</p>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>أضف منتجات من تبويب "منتجات" بالأسفل</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))',
              gap: 10,
            }}>
              {products.map((p) => {
                const inCart = cart.find((item) => item.productId === p.id)
                const isOut = p.quantity <= 0
                return (
                  <div
                    key={p.id}
                    onClick={() => addToCart(p)}
                    style={{
                      background: inCart ? 'rgba(59,130,246,0.1)' : 'var(--color-bg-card)',
                      border: inCart ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                      borderRadius: 14,
                      padding: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      position: 'relative',
                      userSelect: 'none',
                      transition: 'transform 0.1s ease, border-color 0.15s ease',
                    }}
                  >
                    {inCart && (
                      <div style={{
                        position: 'absolute',
                        top: 6,
                        left: 6,
                        background: 'var(--color-primary)',
                        color: 'white',
                        borderRadius: 50,
                        width: 22,
                        height: 22,
                        fontSize: 12,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {inCart.qty}
                      </div>
                    )}

                    <div style={{ fontSize: 24, marginBottom: 6 }}>
                      {catIconMap[p.category] ?? '📦'}
                    </div>

                    <div>
                      <p style={{
                        fontSize: 13,
                        fontWeight: 700,
                        lineHeight: 1.3,
                        marginBottom: 4,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}>
                        {p.name}
                      </p>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text-primary)', direction: 'ltr' }}>
                          {formatCurrency(p.salePrice)}
                        </span>
                        <span style={{
                          fontSize: 10,
                          color: isOut ? 'var(--color-danger-light)' : 'var(--color-text-muted)',
                        }}>
                          {isOut ? 'نفد' : `${p.quantity}`}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: CART TAB */}
      {activeTab === 'cart' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cart.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 10px' }}>
              <div className="empty-icon">🛍️</div>
              <p style={{ fontSize: 16, fontWeight: 700 }}>السلة فارغة</p>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
                اختر أصنافاً من الكتالوج أو امسح الباركود لإضافتها
              </p>
              <button
                onClick={() => setActiveTab('catalog')}
                style={{
                  marginTop: 14,
                  padding: '10px 20px',
                  borderRadius: 12,
                  background: 'var(--color-primary)',
                  color: 'white',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-main)',
                }}
              >
                تصفح الأصناف
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  الأصناف المضافة ({cart.length}) — محفوظة دائماً ✓
                </span>
                <button
                  onClick={resetSaleState}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-danger-light)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-main)',
                  }}
                >
                  إفراغ السلة 🗑️
                </button>
              </div>

              {cart.map((item) => {
                const lineTotal = item.price * item.qty
                const exceedsStock = item.qty > item.maxStock
                return (
                  <div
                    key={item.productId}
                    style={{
                      background: 'var(--color-bg-card)',
                      border: `1px solid ${exceedsStock ? 'rgba(239,68,68,0.4)' : 'var(--color-border)'}`,
                      borderRadius: 14,
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3 }}>
                        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', direction: 'ltr' }}>
                          {formatCurrency(item.price)}
                        </span>
                        {exceedsStock && (
                          <span style={{ fontSize: 11, color: 'var(--color-danger-light)', fontWeight: 700 }}>
                            المخزون المتوفر: {item.maxStock}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stepper */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: 'rgba(255,255,255,0.06)',
                      borderRadius: 10,
                      border: '1px solid var(--color-border)',
                      padding: 2,
                    }}>
                      <button
                        onClick={() => updateQty(item.productId, -1)}
                        style={{
                          width: 30, height: 30,
                          border: 'none', background: 'transparent',
                          color: 'var(--color-text-primary)',
                          fontSize: 18, fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >-</button>
                      <input
                        type="number"
                        value={item.qty}
                        onChange={(e) => setDirectQty(item.productId, parseInt(e.target.value) || 0)}
                        style={{
                          width: 36,
                          textAlign: 'center',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--color-text-primary)',
                          fontSize: 14,
                          fontWeight: 800,
                          outline: 'none',
                        }}
                      />
                      <button
                        onClick={() => updateQty(item.productId, 1)}
                        style={{
                          width: 30, height: 30,
                          border: 'none', background: 'transparent',
                          color: 'var(--color-text-primary)',
                          fontSize: 18, fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >+</button>
                    </div>

                    {/* Line total */}
                    <div style={{ minWidth: 65, textAlign: 'left' }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text-primary)', direction: 'ltr' }}>
                        {formatCurrency(lineTotal)}
                      </span>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => removeFromCart(item.productId)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-text-muted)',
                        fontSize: 16,
                        cursor: 'pointer',
                        padding: 4,
                      }}
                    >✕</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Docked Bottom Bar / Summary & Checkout (Always visible above BottomNav) */}
      {cart.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 'var(--bottom-bar-total-height, 72px)',
            left: 0,
            right: 0,
            zIndex: 45,
            background: 'var(--color-bg-elevated)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderTop: '1.5px solid var(--color-border-active)',
            boxShadow: 'var(--shadow-lg)',
            padding: '10px 16px',
          }}
        >
          <div
            style={{
              maxWidth: 640,
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {/* Discount row (shown in Cart Tab) */}
            {activeTab === 'cart' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>
                  المجموع الفرعي ({totalCartCount} قطعة):{' '}
                  <strong style={{ color: 'var(--color-text-primary)' }}>{formatCurrency(subtotal)}</strong>
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={() => setShowDiscountModal(true)}
                    style={{
                      background: discountValue > 0 ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.06)',
                      border: discountValue > 0 ? '1px solid var(--color-warning)' : '1px solid var(--color-border)',
                      borderRadius: 6,
                      padding: '2px 8px',
                      fontSize: 11,
                      fontWeight: 700,
                      color: discountValue > 0 ? 'var(--color-warning-light)' : 'var(--color-text-secondary)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-main)',
                    }}
                  >
                    {discountValue > 0 ? `🏷️ خصم: ${discountValue}${discountType === 'percent' ? '%' : ' ₪'}` : '+ إضافة خصم'}
                  </button>
                  {discountAmount > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-warning-light)', direction: 'ltr' }}>
                      -{formatCurrency(discountAmount)}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Main Action Row: Final Total & Complete Sale Button */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0 }}>
                  {activeTab === 'catalog' ? `السلة (${totalCartCount} قطعة)` : 'المبلغ النهائي المطلوب'}
                </p>
                <p style={{ fontSize: 21, fontWeight: 900, color: '#34d399', direction: 'ltr', margin: 0, lineHeight: 1.2 }}>
                  {formatCurrency(finalTotal)}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {activeTab === 'catalog' && (
                  <button
                    onClick={() => setActiveTab('cart')}
                    style={{
                      background: 'rgba(59,130,246,0.15)',
                      border: '1.5px solid rgba(59,130,246,0.4)',
                      borderRadius: 12,
                      padding: '10px 14px',
                      color: 'var(--color-primary-light)',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-main)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <span>السلة</span>
                    <span
                      style={{
                        background: 'var(--color-primary)',
                        color: 'white',
                        borderRadius: 50,
                        padding: '1px 6px',
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      {totalCartCount}
                    </span>
                  </button>
                )}

                <button
                  onClick={handleOpenCheckout}
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    border: 'none',
                    borderRadius: 12,
                    padding: '12px 22px',
                    color: 'white',
                    fontSize: 15,
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-main)',
                    boxShadow: '0 4px 16px rgba(16,185,129,0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>إتمام البيع</span>
                  <span>⬅️</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* MODAL: DISCOUNT */}
      <Modal
        open={showDiscountModal}
        onClose={() => setShowDiscountModal(false)}
        title="تطبيق خصم على الفاتورة"
        type="box"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              type="button"
              onClick={() => setDiscountType('fixed')}
              style={{
                padding: '10px',
                borderRadius: 10,
                border: discountType === 'fixed' ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                background: discountType === 'fixed' ? 'rgba(59,130,246,0.2)' : 'transparent',
                color: discountType === 'fixed' ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'var(--font-main)',
              }}
            >
              مبلغ ثابت (₪)
            </button>
            <button
              type="button"
              onClick={() => setDiscountType('percent')}
              style={{
                padding: '10px',
                borderRadius: 10,
                border: discountType === 'percent' ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                background: discountType === 'percent' ? 'rgba(59,130,246,0.2)' : 'transparent',
                color: discountType === 'percent' ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'var(--font-main)',
              }}
            >
              نسبة مئوية (%)
            </button>
          </div>

          <div>
            <label style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>
              قيمة الخصم ({discountType === 'percent' ? '%' : '₪'}):
            </label>
            <input
              type="number"
              min="0"
              value={discountValue || ''}
              onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
              placeholder="0"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                fontSize: 16,
                fontWeight: 700,
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button
              onClick={() => { setDiscountValue(0); setShowDiscountModal(false) }}
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
              إلغاء الخصم
            </button>
            <button
              onClick={() => setShowDiscountModal(false)}
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
              تأكيد الخصم
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: CHECKOUT / PAYMENT */}
      <Modal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        title="إتمام عملية البيع واختيار طريقة الدفع"
        type="sheet"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '80vh', overflowY: 'auto' }}>
          {/* Total display box */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(16,185,129,0.15))',
            border: '1px solid rgba(59,130,246,0.3)',
            borderRadius: 14,
            padding: '14px 16px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>المبلغ الإجمالي للفاتورة</p>
            <p style={{ fontSize: 28, fontWeight: 900, color: 'var(--color-text-primary)', direction: 'ltr' }}>
              {formatCurrency(finalTotal)}
            </p>
          </div>

          {/* Payment Method / Type Grid */}
          <div>
            <label style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8, fontWeight: 700 }}>
              اختر طريقة القبض / الدفع:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {/* Direct cash */}
              <button
                type="button"
                onClick={() => { setPaymentType('cash'); setPaymentMethod('cash') }}
                style={{
                  padding: '12px 10px',
                  borderRadius: 12,
                  border: (paymentType === 'cash' && paymentMethod === 'cash') ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                  background: (paymentType === 'cash' && paymentMethod === 'cash') ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
                  color: (paymentType === 'cash' && paymentMethod === 'cash') ? 'var(--color-primary-light)' : 'var(--color-text-secondary)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-main)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 20 }}>💵</span>
                <span>نقداً (كاش)</span>
              </button>

              {/* Jawwal Pay */}
              <button
                type="button"
                onClick={() => { setPaymentType('cash'); setPaymentMethod('jawwal_pay') }}
                style={{
                  padding: '12px 10px',
                  borderRadius: 12,
                  border: (paymentType === 'cash' && paymentMethod === 'jawwal_pay') ? '2px solid #10b981' : '1px solid var(--color-border)',
                  background: (paymentType === 'cash' && paymentMethod === 'jawwal_pay') ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.04)',
                  color: (paymentType === 'cash' && paymentMethod === 'jawwal_pay') ? 'var(--color-success-light)' : 'var(--color-text-secondary)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-main)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 20 }}>📱</span>
                <span>جوال باي</span>
              </button>

              {/* PalPay */}
              <button
                type="button"
                onClick={() => { setPaymentType('cash'); setPaymentMethod('palpay') }}
                style={{
                  padding: '12px 10px',
                  borderRadius: 12,
                  border: (paymentType === 'cash' && paymentMethod === 'palpay') ? '2px solid #8b5cf6' : '1px solid var(--color-border)',
                  background: (paymentType === 'cash' && paymentMethod === 'palpay') ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
                  color: (paymentType === 'cash' && paymentMethod === 'palpay') ? 'var(--color-purple-light)' : 'var(--color-text-secondary)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-main)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 20 }}>💳</span>
                <span>بال باي (PalPay)</span>
              </button>

              {/* Bank of Palestine */}
              <button
                type="button"
                onClick={() => { setPaymentType('cash'); setPaymentMethod('bop') }}
                style={{
                  padding: '12px 10px',
                  borderRadius: 12,
                  border: (paymentType === 'cash' && paymentMethod === 'bop') ? '2px solid #3b82f6' : '1px solid var(--color-border)',
                  background: (paymentType === 'cash' && paymentMethod === 'bop') ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.04)',
                  color: (paymentType === 'cash' && paymentMethod === 'bop') ? 'var(--color-primary-light)' : 'var(--color-text-secondary)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-main)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 20 }}>🏦</span>
                <span>بنك فلسطين</span>
              </button>

              {/* Debt */}
              <button
                type="button"
                onClick={() => setPaymentType('debt')}
                style={{
                  padding: '12px 10px',
                  borderRadius: 12,
                  border: paymentType === 'debt' ? '2px solid var(--color-danger)' : '1px solid var(--color-border)',
                  background: paymentType === 'debt' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)',
                  color: paymentType === 'debt' ? 'var(--color-danger-light)' : 'var(--color-text-secondary)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-main)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 20 }}>📝</span>
                <span>دين كامل (آجل)</span>
              </button>

              {/* Partial */}
              <button
                type="button"
                onClick={() => setPaymentType('partial')}
                style={{
                  padding: '12px 10px',
                  borderRadius: 12,
                  border: paymentType === 'partial' ? '2px solid var(--color-warning)' : '1px solid var(--color-border)',
                  background: paymentType === 'partial' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.04)',
                  color: paymentType === 'partial' ? 'var(--color-warning-light)' : 'var(--color-text-secondary)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-main)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 20 }}>⚖️</span>
                <span>دفع جزئي + دين</span>
              </button>
            </div>
          </div>

          {/* Customer Selection (Required for Debt and Partial) */}
          {(paymentType === 'debt' || paymentType === 'partial' || selectedCustomerId) && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 700 }}>
                  العميل {paymentType !== 'cash' && <span style={{ color: 'var(--color-danger)' }}>*</span>}:
                </label>
                <button
                  type="button"
                  onClick={() => setQuickCustomerOpen(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-primary-light)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-main)',
                  }}
                >
                  + عميل جديد
                </button>
              </div>

              <CustomSelect
                value={selectedCustomerId}
                placeholder="-- اختر العميل --"
                onChange={setSelectedCustomerId}
                options={customers.filter((customer) => customer.id !== undefined).map((customer) => ({
                  value: customer.id!,
                  label: customer.name,
                  description: customer.totalDebt > 0 ? `رصيده الحالي: ${formatCurrency(customer.totalDebt)}` : 'لا يوجد دين حالي',
                }))}
              />
            </div>
          )}

          {/* Partial Payment Configuration */}
          {paymentType === 'partial' && (
            <div style={{
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 12,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}>
              <div>
                <label style={{ fontSize: 13, color: 'var(--color-warning-light)', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                  المبلغ المقبوض حالياً:
                </label>
                <input
                  type="number"
                  min="0"
                  max={finalTotal}
                  placeholder="أدخل المبلغ المقبوض..."
                  value={partialPaidAmount}
                  onChange={(e) => setPartialPaidAmount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                    fontSize: 16,
                    fontWeight: 800,
                    outline: 'none',
                    direction: 'ltr',
                    textAlign: 'right',
                  }}
                />
              </div>

              {/* Method used for the partial payment */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>
                  طريقة تحصيل هذا المبلغ:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[
                    { id: 'cash' as PaymentMethod, label: 'كاش 💵' },
                    { id: 'jawwal_pay' as PaymentMethod, label: 'جوال باي 📱' },
                    { id: 'palpay' as PaymentMethod, label: 'بال باي 💳' },
                    { id: 'bop' as PaymentMethod, label: 'بنك فلسطين 🏦' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      style={{
                        padding: '8px',
                        borderRadius: 8,
                        border: paymentMethod === m.id ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                        background: paymentMethod === m.id ? 'rgba(59,130,246,0.2)' : 'transparent',
                        color: paymentMethod === m.id ? 'var(--color-primary-light)' : 'var(--color-text-secondary)',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-main)',
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 14, fontWeight: 700 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>المتبقي كدين على العميل:</span>
                <span style={{ color: 'var(--color-danger-light)', direction: 'ltr' }}>
                  {formatCurrency(Math.max(0, finalTotal - (parseFloat(partialPaidAmount) || 0)))}
                </span>
              </div>
            </div>
          )}

          {/* Optional Note */}
          <div>
            <label style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>
              ملاحظة على الفاتورة (اختياري):
            </label>
            <input
              type="text"
              placeholder="مثال: رقم الحوالة، طلب خاص..."
              value={saleNote}
              onChange={(e) => setSaleNote(e.target.value)}
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

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => setCheckoutOpen(false)}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font-main)',
              }}
            >
              تراجع
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleCompleteSale}
              style={{
                flex: 2,
                padding: '12px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none',
                color: 'white',
                fontWeight: 800,
                fontSize: 15,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-main)',
                boxShadow: '0 4px 16px rgba(16,185,129,0.3)',
              }}
            >
              {isSubmitting ? 'جارٍ الحفظ...' : 'تأكيد وحفظ الفاتورة ✓'}
            </button>
          </div>
        </div>
      </Modal>

      {/* QUICK ADD CUSTOMER MODAL */}
      <Modal
        open={quickCustomerOpen}
        onClose={() => setQuickCustomerOpen(false)}
        title="إضافة عميل جديد سريعاً"
        type="box"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
              اسم العميل <span style={{ color: 'var(--color-danger)' }}>*</span>:
            </label>
            <input
              type="text"
              placeholder="مثال: أحمد أبو علي"
              value={newCustName}
              onChange={(e) => setNewCustName(e.target.value)}
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
              رقم الهاتف (للواتساب):
            </label>
            <input
              type="tel"
              placeholder="مثال: 0599123456"
              value={newCustPhone}
              onChange={(e) => setNewCustPhone(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                fontSize: 14,
                outline: 'none',
                direction: 'ltr',
                textAlign: 'right',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button
              type="button"
              onClick={() => setQuickCustomerOpen(false)}
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
              type="button"
              onClick={handleCreateQuickCustomer}
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
              إضافة
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: COMPLETED INVOICE RECEIPT */}
      {completedInvoice && (
        <Modal
          open={Boolean(completedInvoice)}
          onClose={() => setCompletedInvoice(null)}
          title="تم البيع بنجاح 🎉"
          type="box"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center' }}>
            <div style={{
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: 14,
              padding: '14px',
            }}>
              <div style={{ fontSize: 32, marginBottom: 4 }}>🧾</div>
              <h3 style={{ fontSize: 17, fontWeight: 800 }}>فاتورة رقم #{completedInvoice.id}</h3>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                {new Date(completedInvoice.createdAt).toLocaleString('ar-EG')}
              </p>
              {completedInvoice.customerName && (
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary-light)', marginTop: 4 }}>
                  العميل: {completedInvoice.customerName}
                </p>
              )}
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                طريقة الدفع: {completedInvoice.paymentType === 'debt' ? 'دين كامل (آجل) 📝' : getPaymentMethodName(completedInvoice.paymentMethod)}
              </p>
            </div>

            {/* Items table */}
            <div style={{
              maxHeight: 180,
              overflowY: 'auto',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 12,
              padding: 10,
              textAlign: 'right',
            }}>
              {completedInvoice.items.map((i, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '5px 0',
                  borderBottom: idx < completedInvoice.items.length - 1 ? '1px solid var(--color-border)' : 'none',
                  fontSize: 13,
                }}>
                  <span>{i.name} × {i.qty}</span>
                  <span style={{ direction: 'ltr', fontWeight: 600 }}>{formatCurrency(i.qty * i.price)}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div style={{
              background: 'var(--color-bg-card)',
              borderRadius: 12,
              padding: '10px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              textAlign: 'right',
              fontSize: 13,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>المجموع الفرعي:</span>
                <span style={{ direction: 'ltr' }}>{formatCurrency(completedInvoice.subtotal)}</span>
              </div>
              {completedInvoice.discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-warning-light)' }}>
                  <span>الخصم:</span>
                  <span style={{ direction: 'ltr' }}>-{formatCurrency(completedInvoice.discountAmount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15, paddingTop: 4, borderTop: '1px solid var(--color-border)' }}>
                <span>الإجمالي:</span>
                <span style={{ direction: 'ltr', color: 'var(--color-primary-light)' }}>{formatCurrency(completedInvoice.total)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-success-light)' }}>
                <span>المدفوع:</span>
                <span style={{ direction: 'ltr' }}>{formatCurrency(completedInvoice.paidAmount)}</span>
              </div>
              {completedInvoice.debtAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-danger-light)', fontWeight: 700 }}>
                  <span>المتبقي كدين:</span>
                  <span style={{ direction: 'ltr' }}>{formatCurrency(completedInvoice.debtAmount)}</span>
                </div>
              )}
            </div>

            {/* Share & Print Buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => shareWhatsApp(completedInvoice)}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: 12,
                  background: '#25D366',
                  border: 'none',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-main)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <span>مشاركة واتساب</span>
                <span>💬</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  padding: '11px 16px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-main)',
                }}
              >
                🖨️ طباعة
              </button>
            </div>

            <button
              type="button"
              onClick={() => setCompletedInvoice(null)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 12,
                background: 'var(--color-primary)',
                border: 'none',
                color: 'white',
                fontWeight: 800,
                fontSize: 15,
                cursor: 'pointer',
                fontFamily: 'var(--font-main)',
              }}
            >
              فاتورة جديدة 🔄
            </button>
          </div>
        </Modal>
      )}

      {/* Barcode Scanner */}
      <BarcodeScanner
        open={scannerOpen}
        onDetected={handleBarcodeScan}
        onClose={() => {
          setScannerOpen(false)
          setScannerFeedback(null)
        }}
        continuous={true}
        cartCount={totalCartCount}
        cartTotal={finalTotal}
        onFinishInvoice={handleOpenCheckout}
        lastScannedMessage={scannerFeedback}
      />

      {/* Category Manager Modal */}
      <CategoryManagerModal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
      />
    </div>
  )
}
