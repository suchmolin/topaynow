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
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { logListActivity } from '../lib/listActivity'
import { RECURRENCE_FREQUENCY } from './useTodos'

const TEMPLATES = 'todoRecurrenceTemplates'

export function useTodoRecurrenceTemplates(listId) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!listId) {
      setItems([])
      setLoading(false)
      return
    }
    const q = query(
      collection(db, TEMPLATES),
      where('listId', '==', listId),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            startDate: d.data().startDate ?? null,
            createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() ?? null,
          }))
        )
        setLoading(false)
      },
      (err) => {
        console.error('useTodoRecurrenceTemplates snapshot error', err)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [listId])

  return { items, loading }
}

export async function addRecurrenceTemplate(listId, { title, frequency, dailyTime, startDate }) {
  const ref = await addDoc(collection(db, TEMPLATES), {
    listId,
    title: title.trim(),
    frequency: frequency || RECURRENCE_FREQUENCY.DAILY,
    dailyTime: dailyTime || null,
    startDate: startDate || new Date().toISOString().slice(0, 10),
    createdAt: serverTimestamp(),
  })
  await logListActivity(listId, 'recurrence_template_created', { title: title.trim() }).catch(() => {})
  return ref.id
}

export async function updateRecurrenceTemplate(id, listId, { title, frequency, dailyTime, startDate }) {
  const updates = {}
  if (title !== undefined) updates.title = title.trim()
  if (frequency !== undefined) updates.frequency = frequency
  if (dailyTime !== undefined) updates.dailyTime = dailyTime
  if (startDate !== undefined) updates.startDate = startDate
  if (Object.keys(updates).length === 0) return
  await updateDoc(doc(db, TEMPLATES, id), updates)
  if (listId && title) await logListActivity(listId, 'recurrence_template_updated', { title: title.trim() }).catch(() => {})
}

export async function deleteRecurrenceTemplate(id, listId, title) {
  await deleteDoc(doc(db, TEMPLATES, id))
  if (listId && title) await logListActivity(listId, 'recurrence_template_deleted', { title }).catch(() => {})
}
