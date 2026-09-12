import { useState, useEffect } from 'react'
import type React from 'react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { BarcodeScanner } from '../ui/BarcodeScanner'
import { CustomSelect } from '../ui/CustomSelect'
import { addProduct, updateProduct } from '../../hooks/useProducts'
import { useCategories } from '../../hooks/useCategories'
import { db, type Product } from '../../db/db'

interface ProductFormProps {
  open: boolean
  onClose: () => void
  product?: Product | null
  initialBarcode?: string
  initialName?: string
  defaultQuantity?: string
  onSaved?: (product: Product) => void
}

const EMPTY = {
  barcode: '',
  name: '',
  salePrice: '',
  costPrice: '',
  quantity: '',
  lowStockAlert: '5',
  category: 'أخرى',
}

export function ProductForm({
  open,
  onClose,
  product,
  initialBarcode,
  initialName,
  defaultQuantity,
  onSaved,
}: ProductFormProps) {
  const categories = useCategories()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)

  useEffect(() => {
    if (open) {
      if (product) {
        setForm({
          barcode: product.barcode,
          name: product.name,
          salePrice: String(product.salePrice),
          costPrice: String(product.costPrice),
          quantity: String(product.quantity),
          lowStockAlert: String(product.lowStockAlert),
          category: product.category,
        })
      } else {
        setForm({
          ...EMPTY,
          barcode: initialBarcode ?? '',
          name: initialName ?? '',
          quantity: defaultQuantity !== undefined ? defaultQuantity : '',
        })
      }
      setErrors({})
    }
  }, [open, product, initialBarcode, initialName, defaultQuantity])

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((er) => ({ ...er, [key]: '' }))
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'اسم المنتج مطلوب'
    if (!form.salePrice || isNaN(+form.salePrice) || +form.salePrice < 0) errs.salePrice = 'سعر البيع غير صالح'
    if (!form.costPrice || isNaN(+form.costPrice) || +form.costPrice < 0) errs.costPrice = 'سعر التكلفة غير صالح'
    if (!form.quantity || isNaN(+form.quantity) || +form.quantity < 0) errs.quantity = 'الكمية غير صالحة'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    const data = {
      barcode: form.barcode.trim(),
      name: form.name.trim(),
      salePrice: parseFloat(form.salePrice),
      costPrice: parseFloat(form.costPrice),
      quantity: parseInt(form.quantity),
      lowStockAlert: parseInt(form.lowStockAlert) || 5,
      category: form.category,
    }
    let savedProduct: Product | undefined
    if (product?.id) {
      await updateProduct(product.id, data)
      savedProduct = { ...product, ...data, updatedAt: new Date() }
    } else {
      const newId = await addProduct(data)
      const fetched = await db.products.get(Number(newId))
      savedProduct = fetched
    }
    setLoading(false)
    onClose()
    if (savedProduct && onSaved) {
      onSaved(savedProduct)
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={product ? 'تعديل منتج' : 'إضافة منتج جديد'}
        type="sheet"
        footer={
          <div style={{ display: 'flex', gap: 10, flexDirection: 'row-reverse', alignItems: 'center', width: '100%' }}>
            <Button
              variant="primary"
              loading={loading}
              onClick={handleSubmit}
              style={{ flex: 2, minHeight: 46, width: '100%' }}
            >
              {product ? 'حفظ التعديلات' : '✓ إضافة المنتج'}
            </Button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              style={{ flex: 1, minHeight: 46 }}
            >
              إلغاء
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Barcode */}
          <div>
            <label className="input-label">الباركود</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                placeholder="أدخل الباركود يدوياً"
                value={form.barcode}
                onChange={set('barcode')}
                inputMode="numeric"
              />
              <button
                onClick={() => setScannerOpen(true)}
                style={{
                  width: 48,
                  height: 48,
                  background: 'rgba(59,130,246,0.15)',
                  border: '1.5px solid rgba(59,130,246,0.3)',
                  borderRadius: 12,
                  cursor: 'pointer',
                  fontSize: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                📷
              </button>
            </div>
          </div>

          {/* Name */}
          <Input
            label="اسم المنتج *"
            placeholder="مثال: شيبس ليز كبير"
            value={form.name}
            onChange={set('name')}
            error={errors.name}
          />

          {/* Category */}
          <CustomSelect
            label="التصنيف"
            value={form.category}
            onChange={(category) => setForm((current) => ({ ...current, category }))}
            options={categories.map((category) => ({ value: category.name, label: `${category.icon} ${category.name}` }))}
          />

          {/* Prices */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input
              label="سعر البيع ₪ *"
              placeholder="0.00"
              value={form.salePrice}
              onChange={set('salePrice')}
              inputMode="decimal"
              error={errors.salePrice}
            />
            <Input
              label="سعر التكلفة ₪ *"
              placeholder="0.00"
              value={form.costPrice}
              onChange={set('costPrice')}
              inputMode="decimal"
              error={errors.costPrice}
            />
          </div>

          {/* Stock */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input
              label="الكمية الحالية *"
              placeholder="0"
              value={form.quantity}
              onChange={set('quantity')}
              inputMode="numeric"
              error={errors.quantity}
              hint={defaultQuantity === '0' ? 'اتركها 0 إذا كنت تقوم بتوريد الكمية الآن عبر الفاتورة' : undefined}
            />
            <Input
              label="تنبيه مخزون منخفض"
              placeholder="5"
              value={form.lowStockAlert}
              onChange={set('lowStockAlert')}
              inputMode="numeric"
            />
          </div>

          {/* Profit preview */}
          {form.salePrice && form.costPrice && (
            <div style={{
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: 10,
              padding: '10px 14px',
              display: 'flex',
              justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>الربح من كل وحدة</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-success-light)' }}>
                {(parseFloat(form.salePrice || '0') - parseFloat(form.costPrice || '0')).toFixed(2)} ₪
              </span>
            </div>
          )}
        </div>
      </Modal>

      <BarcodeScanner
        open={scannerOpen}
        onDetected={(code) => {
          setForm((f) => ({ ...f, barcode: code }))
          setScannerOpen(false)
        }}
        onClose={() => setScannerOpen(false)}
      />
    </>
  )
}
