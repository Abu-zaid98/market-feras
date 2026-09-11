import Dexie, { type EntityTable } from 'dexie'

// ===========================
// Types
// ===========================

export interface Product {
  id?: number
  barcode: string
  name: string
  salePrice: number
  costPrice: number
  quantity: number
  lowStockAlert: number
  category: string
  createdAt: Date
  updatedAt: Date
}

export interface Customer {
  id?: number
  name: string
  phone: string
  totalDebt: number
  createdAt: Date
}

export interface InvoiceItem {
  productId: number
  name: string
  qty: number
  price: number
  costPrice: number
}

export type PaymentType = 'cash' | 'debt' | 'partial'
export type PaymentMethod = 'cash' | 'jawwal_pay' | 'palpay' | 'bop'
export type DiscountType = 'percent' | 'fixed'

export const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: string }[] = [
  { id: 'cash', label: 'نقداً (كاش)', icon: '💵' },
  { id: 'jawwal_pay', label: 'جوال باي', icon: '📱' },
  { id: 'palpay', label: 'بال باي', icon: '💳' },
  { id: 'bop', label: 'بنك فلسطين', icon: '🏦' },
]

export function getPaymentMethodName(method?: PaymentMethod): string {
  switch (method) {
    case 'jawwal_pay': return 'جوال باي 📱'
    case 'palpay': return 'بال باي 💳'
    case 'bop': return 'بنك فلسطين 🏦'
    case 'cash':
    default:
      return 'نقداً (كاش) 💵'
  }
}

export interface Invoice {
  id?: number
  customerId: number | null
  customerName?: string
  items: InvoiceItem[]
  subtotal: number
  discountType: DiscountType | null
  discountValue: number
  discountAmount: number
  total: number
  paidAmount: number
  debtAmount: number
  paymentType: PaymentType
  paymentMethod?: PaymentMethod
  note: string
  createdAt: Date
}

export interface Payment {
  id?: number
  customerId: number
  invoiceId: number | null
  amount: number
  method?: PaymentMethod
  note: string
  createdAt: Date
}

export interface Setting {
  key: string
  value: unknown
}

// ===========================
// Database
// ===========================

export class PosDatabase extends Dexie {
  products!: EntityTable<Product, 'id'>
  customers!: EntityTable<Customer, 'id'>
  invoices!: EntityTable<Invoice, 'id'>
  payments!: EntityTable<Payment, 'id'>
  settings!: EntityTable<Setting, 'key'>

  constructor() {
    super('MallBilToulPOS')

    this.version(1).stores({
      products:  '++id, barcode, name, category',
      customers: '++id, name, phone',
      invoices:  '++id, customerId, createdAt, paymentType',
      payments:  '++id, customerId, invoiceId, createdAt',
      settings:  'key',
    })

    this.version(2).stores({
      payments:  '++id, customerId, invoiceId, createdAt, method',
      invoices:  '++id, customerId, createdAt, paymentType, paymentMethod',
    })

    // Version 3: explicitly declare all stores together to avoid missing-table errors
    this.version(3).stores({
      products:  '++id, barcode, name, category',
      customers: '++id, name, phone',
      invoices:  '++id, customerId, createdAt, paymentType, paymentMethod',
      payments:  '++id, customerId, invoiceId, createdAt, method',
      settings:  'key',
    })
  }
}

export const db = new PosDatabase()

// ===========================
// Seed: Default Settings
// ===========================

export async function initSettings() {
  const storeName = await db.settings.get('storeName')
  if (!storeName) {
    await db.settings.bulkPut([
      { key: 'storeName', value: 'مول بالطول' },
      { key: 'ownerName', value: '' },
      { key: 'currency', value: '₪' },
      { key: 'passwordHash', value: null },
      { key: 'lastBackupAt', value: null },
      { key: 'categories', value: ['مشروبات', 'وجبات خفيفة', 'مواد تنظيف', 'ألبان وأجبان', 'خبز ومعجنات', 'أخرى'] },
      { key: 'lowStockDefault', value: 5 },
    ])
  }

  // Ensure categories_list always exists (for CategoryManagerModal)
  const catList = await db.settings.get('categories_list')
  if (!catList) {
    const defaultCats = [
      { id: 'beverages', name: 'مشروبات', icon: '🥤' },
      { id: 'snacks', name: 'وجبات خفيفة', icon: '🍿' },
      { id: 'cleaning', name: 'مواد تنظيف', icon: '🧹' },
      { id: 'dairy', name: 'ألبان وأجبان', icon: '🧀' },
      { id: 'bakery', name: 'خبز ومعجنات', icon: '🍞' },
      { id: 'other', name: 'أخرى', icon: '📦' },
    ]
    await db.settings.put({ key: 'categories_list', value: defaultCats })
  }
}
