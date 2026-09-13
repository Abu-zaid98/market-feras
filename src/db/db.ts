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
  creditBalance?: number
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

export interface Expense {
  id?: number
  title: string
  category: string
  amount: number
  date: Date
  paymentMethod?: PaymentMethod
  notes?: string
  createdAt: Date
}

export const EXPENSE_CATEGORIES = [
  { id: 'electricity', name: 'كهرباء', icon: '⚡' },
  { id: 'water', name: 'مياه', icon: '💧' },
  { id: 'cleaning', name: 'نظافة ومستلزمات', icon: '🧹' },
  { id: 'rent', name: 'إيجار المحل', icon: '🏪' },
  { id: 'salaries', name: 'رواتب ومكافآت', icon: '👥' },
  { id: 'maintenance', name: 'صيانة وتصليحات', icon: '🔧' },
  { id: 'transport', name: 'نقل وتوصيل', icon: '🚚' },
  { id: 'hospitality', name: 'ضيافة وبوفيه', icon: '☕' },
  { id: 'other', name: 'أخرى', icon: '📦' },
]

export interface PurchaseItem {
  productId: number
  productName: string
  barcode: string
  quantity: number
  oldQuantity: number
  newQuantity: number
  costPrice: number
  totalCost: number
}

export interface Purchase {
  id?: number
  invoiceNumber?: string
  supplierName?: string
  items: PurchaseItem[]
  totalAmount: number
  paymentMethod?: PaymentMethod
  date: Date
  notes?: string
  createdAt: Date
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
  expenses!: EntityTable<Expense, 'id'>
  purchases!: EntityTable<Purchase, 'id'>

  constructor() {
    super('MallBilToulPOS')

    this.version(1).stores({
      products: '++id, barcode, name, category',
      customers: '++id, name, phone',
      invoices: '++id, customerId, createdAt, paymentType',
      payments: '++id, customerId, invoiceId, createdAt',
      settings: 'key',
    })

    this.version(2).stores({
      payments: '++id, customerId, invoiceId, createdAt, method',
      invoices: '++id, customerId, createdAt, paymentType, paymentMethod',
    })

    // Version 3: explicitly declare all stores together to avoid missing-table errors
    this.version(3).stores({
      products: '++id, barcode, name, category',
      customers: '++id, name, phone',
      invoices: '++id, customerId, createdAt, paymentType, paymentMethod',
      payments: '++id, customerId, invoiceId, createdAt, method',
      settings: 'key',
    })

    // Version 4: add expenses and purchases stores
    this.version(4).stores({
      products: '++id, barcode, name, category',
      customers: '++id, name, phone',
      invoices: '++id, customerId, createdAt, paymentType, paymentMethod',
      payments: '++id, customerId, invoiceId, createdAt, method',
      settings: 'key',
      expenses: '++id, category, date, paymentMethod, createdAt',
      purchases: '++id, supplierName, date, createdAt',
    })

    // Version 5: add optional customer credit balance while keeping debt logic intact.
    this.version(5).stores({
      products: '++id, barcode, name, category',
      customers: '++id, name, phone',
      invoices: '++id, customerId, createdAt, paymentType, paymentMethod',
      payments: '++id, customerId, invoiceId, createdAt, method',
      settings: 'key',
      expenses: '++id, category, date, paymentMethod, createdAt',
      purchases: '++id, supplierName, date, createdAt',
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
      { key: 'storeName', value: 'POS System' },
      { key: 'ownerName', value: '' },
      { key: 'currency', value: '₪' },
      { key: 'passwordHash', value: null },
      { key: 'lastBackupAt', value: null },
      { key: 'categories', value: ['مشروبات', 'حاجات أطفال', 'مواد تنظيف', 'ألبان وأجبان', 'خبز ومعجنات', 'أخرى'] },
      { key: 'lowStockDefault', value: 5 },
    ])
  }

  // Ensure categories_list always exists (for CategoryManagerModal)
  const catList = await db.settings.get('categories_list')
  if (!catList) {
    const defaultCats = [
      { id: 'beverages', name: 'مشروبات', icon: '🥤' },
      { id: 'snacks', name: 'حاجات أطفال ', icon: '🍿' },
      { id: 'cleaning', name: 'مواد تنظيف', icon: '🧹' },
      { id: 'dairy', name: 'ألبان وأجبان', icon: '🧀' },
      { id: 'bakery', name: 'خبز ومعجنات', icon: '🍞' },
      { id: 'other', name: 'أخرى', icon: '📦' },
    ]
    await db.settings.put({ key: 'categories_list', value: defaultCats })
  }
}
