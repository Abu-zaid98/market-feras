import { useState, useEffect } from 'react'
import type { InvoiceItem } from '../db/db'

export interface CartItem extends InvoiceItem {
  maxStock: number
}

const STORAGE_KEY = 'pos_active_cart_v1'

export function useCart() {
  const [cart, setCartState] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) return parsed
      }
    } catch (e) {
      console.error('Failed to load cart from storage', e)
    }
    return []
  })

  // Sync to localStorage
  useEffect(() => {
    try {
      if (cart.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cart))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch (e) {
      console.error('Failed to save cart to storage', e)
    }
  }, [cart])

  const addToCart = (product: { id?: number; name: string; salePrice: number; costPrice?: number; quantity: number }) => {
    setCartState((prev) => {
      const existing = prev.find((item) => item.productId === product.id)
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, qty: item.qty + 1 }
            : item
        )
      }
      return [
        ...prev,
        {
          productId: product.id ?? 0,
          name: product.name,
          qty: 1,
          price: product.salePrice,
          costPrice: product.costPrice || 0,
          maxStock: product.quantity,
        },
      ]
    })
  }

  const updateQty = (productId: number, delta: number) => {
    setCartState((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.qty + delta
            return newQty > 0 ? { ...item, qty: newQty } : null
          }
          return item
        })
        .filter((item): item is CartItem => item !== null)
    )
  }

  const setDirectQty = (productId: number, qty: number) => {
    if (qty <= 0) {
      removeFromCart(productId)
      return
    }
    setCartState((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, qty } : item
      )
    )
  }

  const removeFromCart = (productId: number) => {
    setCartState((prev) => prev.filter((item) => item.productId !== productId))
  }

  const clearCart = () => {
    setCartState([])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (e) {
      console.error('Failed to clear cart storage', e)
    }
  }

  return {
    cart,
    addToCart,
    updateQty,
    setDirectQty,
    removeFromCart,
    clearCart,
  }
}
