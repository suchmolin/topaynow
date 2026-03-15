/**
 * Utilidades para fechas en hora local y evitar el desfase de un día por UTC.
 * En JS, new Date('2025-03-16') es medianoche UTC → en América puede verse como 15 de marzo.
 * Por eso guardamos/leemos siempre en hora local (mediodía local o formateo local).
 */

/**
 * Dado un Date, devuelve YYYY-MM-DD en hora local (no UTC).
 * @param {Date} date
 * @returns {string} 'YYYY-MM-DD'
 */
export function toLocalDateString(date) {
  if (!date || !(date instanceof Date)) return null
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Parsea una cadena YYYY-MM-DD como fecha en hora local (mediodía local)
 * para que al guardar en Firestore y leer de vuelta no cambie el día.
 * @param {string} dateStr 'YYYY-MM-DD'
 * @returns {Date | null}
 */
export function parseLocalDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

/**
 * Formatea una cadena YYYY-MM-DD para mostrar en locale (ej. español).
 * Usa mediodía local para que el día no cambie por timezone.
 * @param {string} dateStr 'YYYY-MM-DD'
 * @param {string} [locale='es']
 * @returns {string}
 */
export function formatLocalDate(dateStr, locale = 'es') {
  if (!dateStr) return ''
  const date = parseLocalDate(dateStr)
  if (!date) return dateStr
  return date.toLocaleDateString(locale)
}

/**
 * Indica si la fecha (cadena YYYY-MM-DD) ya pasó en hora local (el día terminó).
 * Útil para "está vencida".
 * @param {string} dateStr 'YYYY-MM-DD'
 * @returns {boolean}
 */
export function isLocalDateInPast(dateStr) {
  if (!dateStr) return true
  const date = parseLocalDate(dateStr)
  if (!date) return true
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
  return dayEnd < new Date()
}

/**
 * Indica si la fecha (cadena YYYY-MM-DD) es hoy o anterior en hora local.
 * Útil para "pendientes: sin fecha o fecha <= hoy".
 * @param {string} dateStr 'YYYY-MM-DD'
 * @returns {boolean}
 */
export function isLocalDateTodayOrInPast(dateStr) {
  if (!dateStr) return true
  const date = parseLocalDate(dateStr)
  if (!date) return true
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
  return dayEnd <= todayEnd
}
