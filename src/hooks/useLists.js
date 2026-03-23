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
  getDocs,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { db } from '../lib/firebase'
import { logListActivity } from '../lib/listActivity'
import { appendListToUserOrder } from './useUserListOrder'

const LISTS = 'lists'
const TODOS = 'todos'
const PAYABLES = 'payables'
const RECEIVABLES = 'receivables'
const FIXED_EXPENSES = 'fixedExpenses'
const TODO_TEMPLATES = 'todoRecurrenceTemplates'
const SHOPPING_ITEMS = 'shoppingItems'
const LIST_ACTIVITY = 'listActivity'
const BATCH_MAX = 400

/** Borra todos los documentos de una colección con listId == listId */
async function deleteAllDocsForListId(collectionName, listId) {
  const q = query(collection(db, collectionName), where('listId', '==', listId))
  const snap = await getDocs(q)
  const docs = snap.docs
  for (let i = 0; i < docs.length; i += BATCH_MAX) {
    const batch = writeBatch(db)
    docs.slice(i, i + BATCH_MAX).forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
}

/**
 * Elimina la lista y todos los datos asociados (tareas, gastos, plantillas, historial, etc.).
 * Solo el dueño puede ejecutarlo.
 */
export async function deleteListCompletely(listId) {
  const uid = getAuth().currentUser?.uid
  if (!uid) throw new Error('Debes iniciar sesión.')

  const listRef = doc(db, LISTS, listId)
  const listSnap = await getDoc(listRef)
  if (!listSnap.exists()) throw new Error('La lista no existe.')
  const list = listSnap.data()
  if (list.ownerId !== uid) throw new Error('Solo el dueño de la lista puede eliminarla.')

  await deleteAllDocsForListId(TODOS, listId)
  await deleteAllDocsForListId(PAYABLES, listId)
  await deleteAllDocsForListId(RECEIVABLES, listId)
  await deleteAllDocsForListId(FIXED_EXPENSES, listId)
  await deleteAllDocsForListId(TODO_TEMPLATES, listId)
  await deleteAllDocsForListId(SHOPPING_ITEMS, listId)
  await deleteAllDocsForListId(LIST_ACTIVITY, listId)

  const token = list.inviteToken
  if (token) {
    try {
      await deleteDoc(doc(db, 'listInvites', token))
    } catch {
      /* ya borrado o sin permiso */
    }
  }

  await deleteDoc(listRef)
}

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

/** @type {'gastos'|'porHacer'|'compras'} */
export const LIST_TYPES = { GASTOS: 'gastos', POR_HACER: 'porHacer', COMPRAS: 'compras' }

/** Ruta inicial por defecto según el tipo de lista (sin slash inicial). */
export function getListHomePath(listType) {
  if (listType === 'porHacer') return 'todos'
  if (listType === 'compras') return 'shopping'
  return 'payables'
}

function normalizeListTypeForStorage(listType) {
  if (listType === LIST_TYPES.POR_HACER || listType === 'porHacer') return 'porHacer'
  if (listType === LIST_TYPES.COMPRAS || listType === 'compras') return 'compras'
  return 'gastos'
}

export async function createList(ownerId, title, listType = LIST_TYPES.GASTOS, listDate = null) {
  const ref = await addDoc(collection(db, LISTS), {
    title: title.trim(),
    /** Fecha de referencia opcional (YYYY-MM-DD), ej. periodo o recordatorio de la lista */
    listDate: listDate && String(listDate).trim() ? String(listDate).trim() : null,
    ownerId,
    memberIds: [ownerId],
    inviteToken: null,
    listType: normalizeListTypeForStorage(listType),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  await appendListToUserOrder(ownerId, ref.id).catch(() => {})
  return ref.id
}

/**
 * Actualiza nombre y/o fecha de referencia de la lista (la UI de edición solo cambia el nombre).
 * @param {string} listId
 * @param {{ title?: string, listDate?: string | null }} fields
 */
export async function updateList(listId, { title, listDate } = {}) {
  const updates = { updatedAt: serverTimestamp() }
  if (title !== undefined) updates.title = title.trim()
  if (listDate !== undefined) {
    updates.listDate = listDate && String(listDate).trim() ? String(listDate).trim() : null
  }
  const hasField = title !== undefined || listDate !== undefined
  if (!hasField) return
  await updateDoc(doc(db, LISTS, listId), updates)
  if (title !== undefined) {
    await logListActivity(listId, 'list_title_updated', { newTitle: updates.title }).catch(() => {})
  }
  if (listDate !== undefined) {
    await logListActivity(listId, 'list_date_updated', { listDate: updates.listDate }).catch(() => {})
  }
}

export async function updateListTitle(listId, title) {
  await updateList(listId, { title })
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
  await appendListToUserOrder(userId, listId).catch(() => {})
  return { ok: true, listId, alreadyMember: false }
  } catch (e) {
    console.error('joinListByToken error', e)
    return { ok: false, listId: null }
  }
}
