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
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { logListActivity } from '../lib/listActivity'
import { toLocalDateString, parseLocalDate } from '../lib/dateUtils'
import { notifyRecurrenceCreated } from '../lib/notifications'

const TODOS = 'todos'
const TEMPLATES = 'todoRecurrenceTemplates'

export const RECURRENCE_FREQUENCY = {
  UNIQUE: 'unique',
  DAILY: 'daily',
  EVERY_OTHER_DAY: 'everyOtherDay',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
}

export const RECURRENCE_LABELS = {
  [RECURRENCE_FREQUENCY.UNIQUE]: 'Única',
  [RECURRENCE_FREQUENCY.DAILY]: 'Diario',
  [RECURRENCE_FREQUENCY.EVERY_OTHER_DAY]: 'Interdiario',
  [RECURRENCE_FREQUENCY.WEEKLY]: 'Cada semana',
  [RECURRENCE_FREQUENCY.MONTHLY]: 'Cada mes',
}

/** Fecha en YYYY-MM-DD en hora local (para recurrencias). */
function toLocalDateOnly(d) {
  return toLocalDateString(d)
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function addWeeks(date, n) {
  return addDays(date, n * 7)
}

function addMonths(date, n) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + n)
  return d
}

/**
 * True si ya pasó la hora de recordatorio de hoy (o no hay hora programada).
 * Si el template tiene dailyTime (ej. "15:00"), solo creamos la tarea de hoy cuando sea >= esa hora.
 */
function isPastReminderTimeToday(template) {
  if (!template.dailyTime || typeof template.dailyTime !== 'string') return true
  const [h, m] = template.dailyTime.trim().split(':').map(Number)
  const reminderToday = new Date()
  reminderToday.setHours(h ?? 0, m ?? 0, 0, 0)
  return new Date() >= reminderToday
}

/** Generate instance dates for a template from startDate up to endDate (inclusive) */
function getInstanceDatesForTemplate(template, endDate) {
  const start = new Date(template.startDate + 'T12:00:00')
  const end = new Date(endDate + 'T23:59:59')
  if (start > end) return []
  const dates = []
  const freq = template.frequency

  if (freq === RECURRENCE_FREQUENCY.DAILY) {
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(toLocalDateOnly(d))
    }
  } else if (freq === RECURRENCE_FREQUENCY.EVERY_OTHER_DAY) {
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 2)) {
      dates.push(toLocalDateOnly(d))
    }
  } else if (freq === RECURRENCE_FREQUENCY.WEEKLY) {
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
      dates.push(toLocalDateOnly(d))
    }
  } else if (freq === RECURRENCE_FREQUENCY.MONTHLY) {
    const dayOfMonth = start.getDate()
    for (let m = 0; m < 120; m++) {
      const d = addMonths(new Date(start), m)
      if (d > end) break
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      d.setDate(Math.min(dayOfMonth, lastDay))
      dates.push(toLocalDateOnly(d))
    }
  }
  return dates
}

/** Evita ejecutar ensure en paralelo para el mismo listId (evita tareas duplicadas). */
const ensureRecurrenceInstancesLast = {}

/** Ensure todos exist for each recurrence template for dates up to today. Call when loading list. */
export async function ensureRecurrenceInstances(listId) {
  const run = async () => {
    const templatesSnap = await getDocs(
      query(collection(db, TEMPLATES), where('listId', '==', listId))
    )
    const templates = templatesSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter(
      (t) => t.frequency && t.frequency !== RECURRENCE_FREQUENCY.UNIQUE
    )
    if (templates.length === 0) return

    const today = toLocalDateString(new Date())
    const existingSnap = await getDocs(
      query(collection(db, TODOS), where('listId', '==', listId))
    )
    const existingKeys = new Set(
      existingSnap.docs
        .filter((d) => d.data().recurrenceTemplateId)
        .map((d) => `${d.data().recurrenceTemplateId}:${d.data().instanceDate || ''}`)
    )

    const batch = writeBatch(db)
    const createdTitles = []
    let count = 0
    const MAX_INSERT = 200
    for (const template of templates) {
      if (!template.startDate) continue
      const instanceDates = getInstanceDatesForTemplate(template, today)
      for (const instanceDate of instanceDates) {
        if (instanceDate === today && !isPastReminderTimeToday(template)) continue
        const key = `${template.id}:${instanceDate}`
        if (existingKeys.has(key)) continue
        const ref = doc(collection(db, TODOS))
        batch.set(ref, {
          listId,
          title: template.title,
          dueDate: instanceDate ? parseLocalDate(instanceDate) : null,
          dueDateStr: instanceDate || null,
          doneAt: null,
          recurrenceTemplateId: template.id,
          instanceDate,
          createdAt: serverTimestamp(),
        })
        createdTitles.push(template.title)
        existingKeys.add(key)
        count++
        if (count >= MAX_INSERT) break
      }
      if (count >= MAX_INSERT) break
    }
    if (count > 0) {
      await batch.commit()
      notifyRecurrenceCreated(createdTitles).catch(() => {})
    }
  }
  const prev = ensureRecurrenceInstancesLast[listId]
  ensureRecurrenceInstancesLast[listId] = (prev || Promise.resolve()).then(run, run)
  return ensureRecurrenceInstancesLast[listId]
}

export function useTodos(listId) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!listId) {
      setItems([])
      setLoading(false)
      return
    }
    ensureRecurrenceInstances(listId).catch(() => {})
    const interval = setInterval(() => {
      ensureRecurrenceInstances(listId).catch(() => {})
    }, 60 * 1000)
    return () => clearInterval(interval)
  }, [listId])

  useEffect(() => {
    if (!listId) {
      setItems([])
      setLoading(false)
      return
    }
    const q = query(
      collection(db, TODOS),
      where('listId', '==', listId),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(
          snap.docs.map((d) => {
            const due = d.data().dueDate?.toDate?.()
            return {
              id: d.id,
              ...d.data(),
              dueDate: due ? toLocalDateString(due) : null,
              doneAt: d.data().doneAt?.toDate?.()?.toISOString?.() ?? null,
              createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() ?? null,
              deletedAt: d.data().deletedAt?.toDate?.()?.toISOString?.() ?? null,
            }
          })
        )
        setLoading(false)
      },
      (err) => {
        console.error('useTodos snapshot error', err)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [listId])

  return { items, loading }
}

export async function addTodo(listId, { title, dueDate, recurrenceTemplateId, instanceDate }) {
  await addDoc(collection(db, TODOS), {
    listId,
    title: title.trim(),
    dueDate: dueDate ? parseLocalDate(dueDate) : null,
    dueDateStr: dueDate || instanceDate || null,
    doneAt: null,
    recurrenceTemplateId: recurrenceTemplateId || null,
    instanceDate: instanceDate || null,
    createdAt: serverTimestamp(),
  })
  await logListActivity(listId, 'todo_created', { title: title.trim() }).catch(() => {})
}

export async function markTodoDone(id) {
  await updateDoc(doc(db, TODOS, id), { doneAt: serverTimestamp() })
}

export async function markTodoUndone(id) {
  await updateDoc(doc(db, TODOS, id), { doneAt: null })
}

export async function deleteTodo(id, listId, title) {
  await updateDoc(doc(db, TODOS, id), { deletedAt: serverTimestamp() })
  if (listId && title) await logListActivity(listId, 'todo_deleted', { title }).catch(() => {})
}

export async function updateTodo(id, { title, dueDate }) {
  const updates = {}
  if (title != null) updates.title = title.trim()
  if (dueDate !== undefined) {
    updates.dueDate = dueDate ? parseLocalDate(dueDate) : null
    updates.dueDateStr = dueDate || null
  }
  if (Object.keys(updates).length === 0) return
  await updateDoc(doc(db, TODOS, id), updates)
}
