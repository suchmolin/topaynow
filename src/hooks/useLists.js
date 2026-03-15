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
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { logListActivity } from '../lib/listActivity'

const LISTS = 'lists'

export function useLists(userId) {
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userId) {
      setLists([])
      setLoading(false)
      return
    }
    const q = query(
      collection(db, LISTS),
      where('memberIds', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLists(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() ?? null,
            updatedAt: d.data().updatedAt?.toDate?.()?.toISOString?.() ?? null,
          }))
        )
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [userId])

  return { lists, loading, error }
}

export function useList(listId) {
  const [list, setList] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!listId) {
      setList(null)
      setLoading(false)
      return
    }
    const unsub = onSnapshot(doc(db, LISTS, listId), (snap) => {
      if (snap.exists()) {
        setList({ id: snap.id, ...snap.data() })
      } else {
        setList(null)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [listId])
  return { list, loading }
}

/** @type {'gastos'|'porHacer'} */
export const LIST_TYPES = { GASTOS: 'gastos', POR_HACER: 'porHacer' }

export async function createList(ownerId, title, listType = LIST_TYPES.GASTOS) {
  const ref = await addDoc(collection(db, LISTS), {
    title: title.trim(),
    ownerId,
    memberIds: [ownerId],
    inviteToken: null,
    listType: listType === LIST_TYPES.POR_HACER ? 'porHacer' : 'gastos',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateListTitle(listId, title) {
  await updateDoc(doc(db, LISTS, listId), {
    title: title.trim(),
    updatedAt: serverTimestamp(),
  })
  await logListActivity(listId, 'list_title_updated', { newTitle: title.trim() }).catch(() => {})
}

export async function removeMemberFromList(listId, userIdToRemove, currentMemberIds) {
  const newMemberIds = (currentMemberIds || []).filter((id) => id !== userIdToRemove)
  await updateDoc(doc(db, LISTS, listId), {
    memberIds: newMemberIds,
    updatedAt: serverTimestamp(),
  })
  await logListActivity(listId, 'member_removed', { memberId: userIdToRemove }).catch(() => {})
}

export async function getListByInviteToken(token) {
  const snap = await getDoc(doc(db, 'listInvites', token))
  if (!snap.exists()) return null
  const data = snap.data()
  return data.listId
}

export async function generateInviteToken(listId, ownerId) {
  const token = crypto.randomUUID?.() ?? `inv-${Date.now()}-${Math.random().toString(36).slice(2)}`
  await setDoc(doc(db, 'listInvites', token), { listId, ownerId, createdAt: serverTimestamp() })
  await updateDoc(doc(db, LISTS, listId), { inviteToken: token, updatedAt: serverTimestamp() })
  return token
}

export async function getOrCreateInviteToken(listId, ownerId) {
  const listSnap = await getDoc(doc(db, LISTS, listId))
  const inviteToken = listSnap.data()?.inviteToken
  if (inviteToken) {
    const inviteSnap = await getDoc(doc(db, 'listInvites', inviteToken))
    if (inviteSnap.exists()) return inviteToken
  }
  return generateInviteToken(listId, ownerId)
}

export async function joinListByToken(token, userId) {
  try {
    if (!token || typeof token !== 'string') return { ok: false, listId: null }
    const inviteSnap = await getDoc(doc(db, 'listInvites', token))
    if (!inviteSnap.exists()) return { ok: false, listId: null }
    const { listId } = inviteSnap.data()
    if (!listId) return { ok: false, listId: null }
    const listRef = doc(db, LISTS, listId)
    const listSnap = await getDoc(listRef)
    if (!listSnap.exists()) return { ok: false, listId: null }
    const list = listSnap.data()
    const memberIds = list.memberIds || []
    if (memberIds.includes(userId)) return { ok: true, listId, alreadyMember: true }
await updateDoc(listRef, {
    memberIds: [...memberIds, userId],
    updatedAt: serverTimestamp(),
  })
  await logListActivity(listId, 'member_joined', { memberId: userId }).catch(() => {})
  return { ok: true, listId, alreadyMember: false }
  } catch (e) {
    console.error('joinListByToken error', e)
    return { ok: false, listId: null }
  }
}
