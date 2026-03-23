import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { doc, onSnapshot, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'

const USER_LIST_ORDER = 'userListOrder'

function buildOrderedLists(lists, orderIds) {
  if (!lists.length) return []
  const byId = Object.fromEntries(lists.map((l) => [l.id, l]))
  const seen = new Set()
  const out = []
  for (const id of orderIds) {
    if (byId[id]) {
      out.push(byId[id])
      seen.add(id)
    }
  }
  const rest = lists.filter((l) => !seen.has(l.id))
  rest.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
  return [...out, ...rest]
}

export function useUserListOrder(userId, lists) {
  const [order, setOrder] = useState([])
  /** IDs ordenados aplicados al instante al guardar (Firestore puede tardar o fallar por reglas). */
  const [optimisticIds, setOptimisticIds] = useState(null)
  const listsRef = useRef(lists)
  listsRef.current = lists

  useEffect(() => {
    if (!userId) {
      setOrder([])
      return
    }
    const unsub = onSnapshot(doc(db, USER_LIST_ORDER, userId), (snap) => {
      const next = snap.exists() ? snap.data().orderedListIds ?? [] : []
      setOrder(next)
      setOptimisticIds((prev) => {
        if (!prev?.length) return null
        const same = prev.length === next.length && prev.every((id, i) => id === next[i])
        return same ? null : prev
      })
    })
    return () => unsub()
  }, [userId])

  const activeOrderIds = optimisticIds ?? order

  const orderedLists = useMemo(() => {
    return buildOrderedLists(lists, activeOrderIds)
  }, [lists, activeOrderIds])

  const saveOrder = useCallback(
    async (orderedListIds) => {
      if (!userId) {
        console.warn('useUserListOrder: sin usuario')
        return
      }
      const currentIds = new Set(listsRef.current.map((l) => l.id))
      const filtered = orderedListIds.filter((id) => currentIds.has(id))
      const missing = listsRef.current.map((l) => l.id).filter((id) => !filtered.includes(id))
      const finalIds = [...filtered, ...missing]

      setOptimisticIds(finalIds)
      try {
        await setDoc(
          doc(db, USER_LIST_ORDER, userId),
          { orderedListIds: finalIds, updatedAt: serverTimestamp() },
          { merge: true }
        )
      } catch (err) {
        console.error('No se pudo guardar el orden de listas:', err)
        setOptimisticIds(null)
        throw err
      }
    },
    [userId]
  )

  return { orderedLists, saveOrder }
}

export async function appendListToUserOrder(userId, listId) {
  if (!userId || !listId) return
  const ref = doc(db, USER_LIST_ORDER, userId)
  const snap = await getDoc(ref)
  const prev = snap.exists() ? snap.data().orderedListIds ?? [] : []
  if (prev.includes(listId)) return
  await setDoc(
    ref,
    { orderedListIds: [...prev, listId], updatedAt: serverTimestamp() },
    { merge: true }
  )
}
