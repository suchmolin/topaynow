/**
 * Cloud Functions para notificaciones push con la app cerrada.
 * - recurrencePush: cada minuto, crea tareas recurrentes que tocan ahora y envía push.
 * - pendingTodayPush: cada día a las 13:00 UTC, notifica tareas pendientes para hoy.
 */
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { onSchedule } from 'firebase-functions/v2/scheduler'

initializeApp()
const db = getFirestore()
const messaging = getMessaging()

function toISODate(d) {
  return d.toISOString().slice(0, 10)
}

function addMonths(date, n) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + n)
  return d
}

/** Fechas de instancia para un template hasta endDate (YYYY-MM-DD). */
function getInstanceDatesForTemplate(template, endDate) {
  const start = new Date(template.startDate + 'T12:00:00')
  const end = new Date(endDate + 'T23:59:59')
  if (start > end) return []
  const dates = []
  const freq = template.frequency
  if (freq === 'daily') {
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) dates.push(toISODate(d))
  } else if (freq === 'everyOtherDay') {
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 2)) dates.push(toISODate(d))
  } else if (freq === 'weekly') {
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) dates.push(toISODate(d))
  } else if (freq === 'monthly') {
    const dayOfMonth = start.getDate()
    for (let m = 0; m < 120; m++) {
      const d = addMonths(new Date(start), m)
      if (d > end) break
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      d.setDate(Math.min(dayOfMonth, lastDay))
      dates.push(toISODate(d))
    }
  }
  return dates
}

/** Hoy en la timezone del template (o UTC). */
function getTodayInTz(timezone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(new Date()) // YYYY-MM-DD
}

/** ¿Ya pasó la hora de recordatorio hoy en esa timezone? */
function isPastReminderTimeToday(template) {
  if (!template.dailyTime || typeof template.dailyTime !== 'string') return true
  const [h, m] = template.dailyTime.trim().split(':').map(Number)
  const tz = template.timezone || 'UTC'
  const now = new Date()
  const localStr = now.toLocaleString('en-CA', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })
  const [nowH, nowM] = localStr.split(':').map(Number)
  if (nowH > (h ?? 0)) return true
  if (nowH === (h ?? 0) && nowM >= (m ?? 0)) return true
  return false
}

/** Obtener todos los FCM tokens de un usuario. */
async function getFCMTokensForUser(userId) {
  const snap = await db.collection('users').doc(userId).collection('fcmTokens').get()
  return snap.docs.map((d) => d.data().token).filter(Boolean)
}

/** Enviar push a una lista de tokens. */
async function sendToTokens(tokens, notification, data = {}) {
  if (tokens.length === 0) return
  const message = {
    notification: { title: notification.title, body: notification.body },
    data: { ...data },
    tokens,
    webpush: { fcmOptions: { link: '/' } },
  }
  await messaging.sendEachForMulticast(message)
}

export const recurrencePush = onSchedule(
  { schedule: 'every 1 minutes', timeZone: 'UTC' },
  async () => {
    const templatesSnap = await db.collection('todoRecurrenceTemplates').get()
    const templates = templatesSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((t) => t.frequency && t.frequency !== 'unique')

    for (const template of templates) {
      if (!template.startDate) continue
      const tz = template.timezone || 'UTC'
      const today = getTodayInTz(tz)
      if (!isPastReminderTimeToday(template)) continue
      const instanceDates = getInstanceDatesForTemplate(template, today)
      if (!instanceDates.includes(today)) continue

      const listId = template.listId
      const key = `${template.id}:${today}`
      const existing = await db.collection('todos').where('listId', '==', listId).where('recurrenceTemplateId', '==', template.id).where('instanceDate', '==', today).limit(1).get()
      if (!existing.empty) continue

      const todoRef = db.collection('todos').doc()
      await todoRef.set({
        listId,
        title: template.title,
        dueDate: new Date(today + 'T12:00:00Z'),
        dueDateStr: today,
        doneAt: null,
        recurrenceTemplateId: template.id,
        instanceDate: today,
        createdAt: FieldValue.serverTimestamp(),
      })

      const listSnap = await db.collection('lists').doc(listId).get()
      const memberIds = listSnap.data()?.memberIds || []
      const allTokens = []
      for (const uid of memberIds) {
        const tokens = await getFCMTokensForUser(uid)
        allTokens.push(...tokens)
      }
      if (allTokens.length) {
        await sendToTokens(
          allTokens,
          { title: 'Nueva tarea recurrente', body: template.title },
          { tag: key, url: '/' }
        )
      }
    }
  }
)

export const pendingTodayPush = onSchedule(
  { schedule: '0 13 * * *', timeZone: 'UTC' },
  async () => {
    const todayStr = toISODate(new Date())
    const todosSnap = await db.collection('todos').where('dueDateStr', '==', todayStr).get()
    const pending = todosSnap.docs.filter((d) => !d.data().doneAt)
    if (pending.length === 0) return

    const listIds = [...new Set(pending.map((d) => d.data().listId))]
    const countByUser = new Map()
    for (const listId of listIds) {
      const listSnap = await db.collection('lists').doc(listId).get()
      const memberIds = listSnap.data()?.memberIds || []
      const count = pending.filter((d) => d.data().listId === listId).length
      for (const uid of memberIds) {
        countByUser.set(uid, (countByUser.get(uid) || 0) + count)
      }
    }

    for (const [userId, count] of countByUser) {
      const tokens = await getFCMTokensForUser(userId)
      if (tokens.length === 0) continue
      const body = count === 1 ? '1 tarea pendiente para hoy' : `${count} tareas pendientes para hoy`
      await sendToTokens(tokens, { title: 'Tareas pendientes para hoy', body }, { url: '/' })
    }
  }
)
