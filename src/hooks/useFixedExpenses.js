import { useState, useEffect } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { logListActivity } from '../lib/listActivity'

const FIXED = 'fixedExpenses'

export function useFixedExpenses(listId) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!listId) {
      setItems([])
      setLoading(false)
      return
    }
    const q = query(
      collection(db, FIXED),
      where('listId', '==', listId),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setItems(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() ?? null,
        }))
      )
      setLoading(false)
    })
    return () => unsub()
  }, [listId])

  return { items, loading }
}

export async function addFixedExpense(listId, { title, amount }) {
  await addDoc(collection(db, FIXED), {
    listId,
    title: title.trim(),
    amount: Number(amount),
    createdAt: serverTimestamp(),
  })
  await logListActivity(listId, 'fixed_expense_created', { title: title.trim() }).catch(() => {})
}

export async function deleteFixedExpense(id, listId, title) {
  await deleteDoc(doc(db, FIXED, id))
  if (listId && title) await logListActivity(listId, 'fixed_expense_deleted', { title }).catch(() => {})
}
