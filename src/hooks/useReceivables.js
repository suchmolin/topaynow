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
import { toLocalDateString, parseLocalDate } from '../lib/dateUtils'

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
        snap.docs.map((d) => {
          const exp = d.data().expectedDate?.toDate?.()
          return {
            id: d.id,
            ...d.data(),
            expectedDate: exp ? toLocalDateString(exp) : null,
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

export async function addReceivable(listId, { title, amount, expectedDate }) {
  await addDoc(collection(db, RECEIVABLES), {
    listId,
    title: title.trim(),
    amount: Number(amount),
    expectedDate: expectedDate ? parseLocalDate(expectedDate) : null,
    createdAt: serverTimestamp(),
  })
  await logListActivity(listId, 'receivable_created', { title: title.trim() }).catch(() => {})
}
