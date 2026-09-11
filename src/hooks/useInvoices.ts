import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  type Invoice,
  type InvoiceItem,
  type PaymentType,
  type PaymentMethod,
  type DiscountType,
  getPaymentMethodName,
} from '../db/db'

export interface CreateSaleInput {
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
  note?: string
}

export function useInvoices(options?: {
  customerId?: number | null
  dateRange?: 'today' | 'week' | 'month' | 'all'
  limit?: number
}) {
  const invoices = useLiveQuery(async () => {
    let query = db.invoices.orderBy('id').reverse()
    let all = await query.toArray()

    if (options?.customerId !== undefined && options.customerId !== null) {
      all = all.filter((inv) => inv.customerId === options.customerId)
    }

    if (options?.dateRange && options.dateRange !== 'all') {
      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

      if (options.dateRange === 'today') {
        all = all.filter((inv) => new Date(inv.createdAt).getTime() >= startOfDay)
      } else if (options.dateRange === 'week') {
        const startOfWeek = startOfDay - 6 * 24 * 60 * 60 * 1000
        all = all.filter((inv) => new Date(inv.createdAt).getTime() >= startOfWeek)
      } else if (options.dateRange === 'month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
        all = all.filter((inv) => new Date(inv.createdAt).getTime() >= startOfMonth)
      }
    }

    if (options?.limit && options.limit > 0) {
      all = all.slice(0, options.limit)
    }

    return all
  }, [options?.customerId, options?.dateRange, options?.limit])

  return invoices ?? []
}

export async function createSaleInvoice(data: CreateSaleInput): Promise<Invoice> {
  const now = new Date()

  return db.transaction('rw', [db.invoices, db.products, db.customers, db.payments], async () => {
    // 1. Decrement stock for inventory items
    for (const item of data.items) {
      if (item.productId > 0) {
        const product = await db.products.get(item.productId)
        if (product) {
          const newQty = Math.max(0, product.quantity - item.qty)
          await db.products.update(item.productId, {
            quantity: newQty,
            updatedAt: now,
          })
        }
      }
    }

    // 2. Insert Invoice
    const invoiceId = await db.invoices.add({
      customerId: data.customerId,
      customerName: data.customerName || undefined,
      items: data.items,
      subtotal: data.subtotal,
      discountType: data.discountType,
      discountValue: data.discountValue,
      discountAmount: data.discountAmount,
      total: data.total,
      paidAmount: data.paidAmount,
      debtAmount: data.debtAmount,
      paymentType: data.paymentType,
      paymentMethod: data.paymentMethod || 'cash',
      note: data.note?.trim() || '',
      createdAt: now,
    })

    const createdInvoiceId = Number(invoiceId)

    // 3. Update customer debt if sale is on debt or partial
    if (data.customerId && data.debtAmount > 0) {
      const customer = await db.customers.get(data.customerId)
      if (customer) {
        await db.customers.update(data.customerId, {
          totalDebt: (customer.totalDebt || 0) + data.debtAmount,
        })
      }
    }

    // 4. Record payment if money was received (cash/jawwal_pay/palpay/bop)
    if (data.paidAmount > 0) {
      const method = data.paymentMethod || 'cash'
      const methodName = getPaymentMethodName(method)
      await db.payments.add({
        customerId: data.customerId || 0,
        invoiceId: createdInvoiceId,
        amount: data.paidAmount,
        method,
        note: data.customerId
          ? `دفعة عبر ${methodName} لفاتورة #${createdInvoiceId}`
          : `بيع مباشر عبر ${methodName} #${createdInvoiceId}`,
        createdAt: now,
      })
    }

    return {
      ...data,
      id: createdInvoiceId,
      note: data.note?.trim() || '',
      createdAt: now,
    }
  })
}

export interface AccountBalances {
  cash: number
  jawwal_pay: number
  palpay: number
  bop: number
  total: number
}

export function useAccountBalances() {
  const balances = useLiveQuery(async () => {
    const payments = await db.payments.toArray()
    const result: AccountBalances = {
      cash: 0,
      jawwal_pay: 0,
      palpay: 0,
      bop: 0,
      total: 0,
    }

    for (const p of payments) {
      const amt = Number(p.amount) || 0
      const method = p.method || 'cash'
      if (method === 'jawwal_pay') {
        result.jawwal_pay += amt
      } else if (method === 'palpay') {
        result.palpay += amt
      } else if (method === 'bop') {
        result.bop += amt
      } else {
        result.cash += amt
      }
      result.total += amt
    }

    return result
  }, [])

  return balances ?? { cash: 0, jawwal_pay: 0, palpay: 0, bop: 0, total: 0 }
}

export async function deleteInvoice(invoiceId: number) {
  return db.transaction('rw', [db.invoices, db.products, db.customers, db.payments], async () => {
    const inv = await db.invoices.get(invoiceId)
    if (!inv) return

    // Revert product quantities
    for (const item of inv.items) {
      if (item.productId > 0) {
        const product = await db.products.get(item.productId)
        if (product) {
          await db.products.update(item.productId, {
            quantity: product.quantity + item.qty,
            updatedAt: new Date(),
          })
        }
      }
    }

    // Revert customer debt
    if (inv.customerId && inv.debtAmount > 0) {
      const customer = await db.customers.get(inv.customerId)
      if (customer) {
        await db.customers.update(inv.customerId, {
          totalDebt: Math.max(0, (customer.totalDebt || 0) - inv.debtAmount),
        })
      }
    }

    // Delete associated payments
    await db.payments.where('invoiceId').equals(invoiceId).delete()

    // Delete invoice
    await db.invoices.delete(invoiceId)
  })
}
