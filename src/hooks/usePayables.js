import { useState, useEffect } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { logListActivity } from '../lib/listActivity'
import { toLocalDateString, parseLocalDate, isLocalDateInPast } from '../lib/dateUtils'

const PAYABLES = 'payables'

export function usePayables(listId) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!listId) {
      setItems([])
      setLoading(false)
      return
    }
    const q = query(
      collection(db, PAYABLES),
      where('listId', '==', listId),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setItems(
        snap.docs.map((d) => {
          const due = d.data().dueDate?.toDate?.()
          return {
            id: d.id,
            ...d.data(),
            dueDate: due ? toLocalDateString(due) : null,
            paidAt: d.data().paidAt?.toDate?.()?.toISOString?.() ?? null,
            createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() ?? null,
          }
        })
      )
      setLoading(false)
    })
    return () => unsub()
  }, [listId])

  return { items, loading }
}

export async function addPayable(listId, { title, amount, dueDate, fixedExpenseId }) {
  await addDoc(collection(db, PAYABLES), {
    listId,
    title: title.trim(),
    amount: Number(amount),
    dueDate: dueDate ? parseLocalDate(dueDate) : null,
    paidAt: null,
    fixedExpenseId: fixedExpenseId || null,
    createdAt: serverTimestamp(),
  })
  await logListActivity(listId, 'payable_created', { title: title.trim() }).catch(() => {})
}

export async function markPayablePaid(id) {
  await updateDoc(doc(db, PAYABLES, id), { paidAt: serverTimestamp() })
}

export function isOverdueOrNoDate(dueDate) {
  if (!dueDate) return true
  return isLocalDateInPast(dueDate)
}
