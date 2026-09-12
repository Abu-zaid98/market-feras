import { useLiveQuery } from 'dexie-react-hooks'
import { db, type PurchaseItem, type PaymentMethod } from '../db/db'

export function usePurchases() {
  const purchases = useLiveQuery(async () => {
    return db.purchases.orderBy('date').reverse().toArray()
  }, [])

  return purchases ?? []
}

export async function addQuickRestock(params: {
  productId: number
  addedQuantity: number
  newCostPrice?: number
  supplierName?: string
  notes?: string
  date?: Date
  paymentMethod?: PaymentMethod
}) {
  const product = await db.products.get(params.productId)
  if (!product) throw new Error('المنتج غير موجود')

  const oldQuantity = product.quantity
  const newQuantity = oldQuantity + params.addedQuantity
  const costPrice = params.newCostPrice !== undefined && params.newCostPrice > 0
    ? params.newCostPrice
    : product.costPrice

  const totalCost = params.addedQuantity * costPrice

  // 1. Update product quantity and costPrice
  await db.products.update(params.productId, {
    quantity: newQuantity,
    costPrice,
    updatedAt: new Date(),
  })

  // 2. Create purchase log item
  const item: PurchaseItem = {
    productId: product.id!,
    productName: product.name,
    barcode: product.barcode,
    quantity: params.addedQuantity,
    oldQuantity,
    newQuantity,
    costPrice,
    totalCost,
  }

  // 3. Record purchase invoice
  return db.purchases.add({
    supplierName: params.supplierName?.trim() || 'توريد سريع',
    items: [item],
    totalAmount: totalCost,
    paymentMethod: params.paymentMethod || 'cash',
    date: params.date || new Date(),
    notes: params.notes?.trim() || '',
    createdAt: new Date(),
  })
}

export async function addPurchaseInvoice(params: {
  supplierName?: string
  invoiceNumber?: string
  items: Array<{
    productId: number
    quantity: number
    costPrice: number
  }>
  paymentMethod?: PaymentMethod
  date?: Date
  notes?: string
}) {
  if (!params.items.length) throw new Error('لا توجد أصناف في فاتورة المشتريات')

  const purchaseItems: PurchaseItem[] = []
  let totalAmount = 0

  for (const it of params.items) {
    const product = await db.products.get(it.productId)
    if (!product) continue

    const oldQuantity = product.quantity
    const newQuantity = oldQuantity + it.quantity
    const itemTotal = it.quantity * it.costPrice

    // Update product stock and cost price
    await db.products.update(it.productId, {
      quantity: newQuantity,
      costPrice: it.costPrice,
      updatedAt: new Date(),
    })

    purchaseItems.push({
      productId: product.id!,
      productName: product.name,
      barcode: product.barcode,
      quantity: it.quantity,
      oldQuantity,
      newQuantity,
      costPrice: it.costPrice,
      totalCost: itemTotal,
    })

    totalAmount += itemTotal
  }

  return db.purchases.add({
    supplierName: params.supplierName?.trim() || '',
    invoiceNumber: params.invoiceNumber?.trim() || '',
    items: purchaseItems,
    totalAmount,
    paymentMethod: params.paymentMethod || 'cash',
    date: params.date || new Date(),
    notes: params.notes?.trim() || '',
    createdAt: new Date(),
  })
}

export async function deletePurchase(id: number) {
  return db.purchases.delete(id)
}
