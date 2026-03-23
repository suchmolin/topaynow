/**
 * Notificaciones locales para la PWA.
 * - Al crear tareas recurrentes
 * - Al pasar tareas de próximas a pendientes (vencen hoy)
 */

const STORAGE_KEY_PREFIX = 'cuentas-pwa_notifiedPending_'

function isSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

/** Solicita permiso de notificaciones si aún no se ha preguntado o denegado. */
export async function requestNotificationPermission() {
  if (!isSupported()) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  const permission = await Notification.requestPermission()
  return permission
}

/** Muestra una notificación local (pide permiso si hace falta). */
export async function showNotification(title, options = {}) {
  if (!isSupported()) return
  let permission = Notification.permission
  if (permission === 'default') {
    permission = await requestNotificationPermission()
  }
  if (permission !== 'granted') return
  const n = new Notification(title, {
    icon: '/favicon.svg',
    tag: options.tag || title + (options.body || ''),
    ...options,
  })
  n.onclick = () => {
    window.focus()
    n.close()
  }
  return n
}

/** Clave para hoy en localStorage (tareas pendientes para hoy ya notificadas). */
function getPendingTodayStorageKey() {
  const today = new Date()
  const y = today.getFullYear()
  const m = today.getMonth() + 1
  const d = today.getDate()
  const todayStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return `${STORAGE_KEY_PREFIX}${todayStr}`
}

/** IDs de tareas pendientes para hoy de las que ya se notificó. */
export function getNotifiedPendingTodayIds() {
  try {
    const key = getPendingTodayStorageKey()
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const ids = JSON.parse(raw)
    return Array.isArray(ids) ? ids : []
  } catch {
    return []
  }
}

/** Marca estos IDs como notificados para hoy. */
export function markPendingTodayAsNotified(ids) {
  if (!ids.length) return
  try {
    const key = getPendingTodayStorageKey()
    const existing = getNotifiedPendingTodayIds()
    const next = [...new Set([...existing, ...ids])]
    localStorage.setItem(key, JSON.stringify(next))
  } catch {}
}

/**
 * Notifica por tareas que vencen hoy y aún no se ha notificado.
 * @param {{ id: string, title: string, dueDate: string | null }[]} pendingToday - Pendientes con dueDate === hoy
 * @returns {Promise<void>}
 */
export async function notifyPendingTodayIfNeeded(pendingToday) {
  if (!pendingToday.length) return
  const notified = getNotifiedPendingTodayIds()
  const toNotify = pendingToday.filter((item) => !notified.includes(item.id))
  if (!toNotify.length) return
  for (const item of toNotify) {
    await showNotification('Tarea pendiente para hoy', {
      body: item.title,
      tag: `pending-today-${item.id}`,
    })
  }
  markPendingTodayAsNotified(toNotify.map((i) => i.id))
}

/**
 * Notifica que se crearon tareas recurrentes.
 * @param {string[]} titles - Títulos de las tareas creadas
 */
export async function notifyRecurrenceCreated(titles) {
  if (!titles.length) return
  if (titles.length === 1) {
    await showNotification('Nueva tarea recurrente', {
      body: titles[0],
      tag: `recurrence-${Date.now()}`,
    })
  } else {
    await showNotification(`${titles.length} tareas recurrentes creadas`, {
      body: titles.slice(0, 3).join(' · ') + (titles.length > 3 ? '…' : ''),
      tag: `recurrence-${Date.now()}`,
    })
  }
}
