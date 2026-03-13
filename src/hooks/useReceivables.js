import { useState, useEffect } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { logListActivity } from '../lib/listActivity'

const RECEIVABLES = 'receivables'

export function useReceivables(listId) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!listId) {
      setItems([])
      setLoading(false)
      return
    }
    const q = query(
      collection(db, RECEIVABLES),
      where('listId', '==', listId),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setItems(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          expectedDate: d.data().expectedDate?.toDate?.()?.toISOString?.()?.slice(0, 10) ?? null,
          createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() ?? null,
        }))
      )
      setLoading(false)
    })
    return () => unsub()
  }, [listId])

  return { items, loading }
}

export async function addReceivable(listId, { title, amount, expectedDate }) {
  await addDoc(collection(db, RECEIVABLES), {
    listId,
    title: title.trim(),
    amount: Number(amount),
    expectedDate: expectedDate ? new Date(expectedDate) : null,
    createdAt: serverTimestamp(),
  })
  await logListActivity(listId, 'receivable_created', { title: title.trim() }).catch(() => {})
}
