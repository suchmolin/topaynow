import { useState, useEffect } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  writeBatch,
  deleteField,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { logListActivity } from '../lib/listActivity'

const SHOPPING_ITEMS = 'shoppingItems'
const BATCH_MAX = 400

export function useShoppingItems(listId) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!listId) {
      setItems([])
      setLoading(false)
      return
    }
    const q = query(
      collection(db, SHOPPING_ITEMS),
      where('listId', '==', listId),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(
          snap.docs.map((d) => {
            const data = d.data()
            return {
              id: d.id,
              ...data,
              purchasedAt: data.purchasedAt?.toDate?.()?.toISOString?.() ?? null,
              createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
            }
          })
        )
        setLoading(false)
      },
      (err) => {
        console.error('useShoppingItems', err)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [listId])

  return { items, loading }
}

export async function addShoppingItem(listId, { title }) {
  await addDoc(collection(db, SHOPPING_ITEMS), {
    listId,
    title: title.trim(),
    purchasedAt: null,
    price: null,
    includeInTotal: true,
    createdAt: serverTimestamp(),
  })
  await logListActivity(listId, 'shopping_item_created', { title: title.trim() }).catch(() => {})
}

export async function updateShoppingItem(id, listId, { title, price, includeInTotal }) {
  const updates = {}
  if (title != null) updates.title = title.trim()
  if (price !== undefined) {
    updates.price = price === null || price === '' ? null : Number(price)
  }
  if (includeInTotal !== undefined) updates.includeInTotal = Boolean(includeInTotal)
  if (Object.keys(updates).length === 0) return
  await updateDoc(doc(db, SHOPPING_ITEMS, id), updates)
  if (title != null) {
    await logListActivity(listId, 'shopping_item_updated', { title: updates.title }).catch(() => {})
  }
}

export async function markShoppingItemPurchased(id, listId, { price }) {
  let priceVal = null
  if (price !== undefined && price !== null && price !== '') {
    const n = Number(price)
    if (Number.isFinite(n) && n >= 0) priceVal = n
  }
  await updateDoc(doc(db, SHOPPING_ITEMS, id), {
    purchasedAt: serverTimestamp(),
    price: priceVal,
    includeInTotal: true,
  })
  await logListActivity(listId, 'shopping_item_purchased', {}).catch(() => {})
}

/** Devuelve un artículo comprado a la lista de pendientes. */
export async function unmarkShoppingItemPurchased(id, listId, title) {
  await updateDoc(doc(db, SHOPPING_ITEMS, id), {
    purchasedAt: deleteField(),
    price: null,
    includeInTotal: true,
  })
  const t = title != null && String(title).trim() ? String(title).trim() : ''
  await logListActivity(listId, 'shopping_item_returned_to_pending', { title: t }).catch(() => {})
}

/** Devuelve todos los artículos comprados de la lista a pendientes. */
export async function unmarkAllShoppingItemsPurchased(listId) {
  const snap = await getDocs(
    query(collection(db, SHOPPING_ITEMS), where('listId', '==', listId))
  )
  const purchasedRefs = snap.docs.filter((d) => d.data().purchasedAt != null).map((d) => d.ref)
  for (let i = 0; i < purchasedRefs.length; i += BATCH_MAX) {
    const batch = writeBatch(db)
    for (const ref of purchasedRefs.slice(i, i + BATCH_MAX)) {
      batch.update(ref, {
        purchasedAt: deleteField(),
        price: null,
        includeInTotal: true,
      })
    }
    await batch.commit()
  }
  if (purchasedRefs.length > 0) {
    await logListActivity(listId, 'shopping_all_returned_to_pending', {
      count: purchasedRefs.length,
    }).catch(() => {})
  }
  return purchasedRefs.length
}

export async function deleteShoppingItem(id, listId, title) {
  await deleteDoc(doc(db, SHOPPING_ITEMS, id))
  if (listId && title) await logListActivity(listId, 'shopping_item_deleted', { title }).catch(() => {})
}
