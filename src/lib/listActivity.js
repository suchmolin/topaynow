import { useState, useEffect } from 'react'
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { db } from './firebase'

const COLLECTION = 'listActivity'

export async function logListActivity(listId, action, details = {}) {
  const auth = getAuth()
  const user = auth.currentUser
  if (!user) return
  const userDisplayName = user.displayName || null
  const userEmail = user.email || null
  await addDoc(collection(db, COLLECTION), {
    listId,
    action,
    userId: user.uid,
    userDisplayName,
    userEmail,
    details,
    createdAt: serverTimestamp(),
  })
}

export const ACTION_LABELS = {
  list_created: 'Creó la lista',
  list_cloned: 'Creó una copia de otra lista de compras',
  list_title_updated: 'Cambió el título de la lista',
  list_date_updated: 'Cambió la fecha de la lista',
  member_joined: 'Se unió a la lista',
  member_removed: 'Quitó a un invitado de la lista',
  payable_created: 'Añadió cuenta por pagar',
  payable_updated: 'Editó una cuenta por pagar',
  payable_marked_paid: 'Marcó cuenta por pagar como pagada',
  receivable_created: 'Añadió cuenta por cobrar',
  fixed_expense_created: 'Añadió gasto fijo',
  fixed_expense_deleted: 'Eliminó gasto fijo',
  todo_updated: 'Editó una tarea',
  shopping_item_created: 'Añadió un artículo a la lista de compras',
  shopping_item_updated: 'Editó un artículo',
  shopping_item_purchased: 'Marcó un artículo como comprado',
  shopping_item_returned_to_pending: 'Devolvió un artículo a la lista de pendientes',
  shopping_all_returned_to_pending: 'Devolvió todos los artículos comprados a pendientes',
  shopping_item_deleted: 'Eliminó un artículo',
}

export function useListActivity(listId) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!listId) {
      setItems([])
      setLoading(false)
      return
    }
    const q = query(
      collection(db, COLLECTION),
      where('listId', '==', listId),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setItems(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate?.() ?? null,
        }))
      )
      setLoading(false)
    })
    return () => unsub()
  }, [listId])
  return { items, loading }
}
