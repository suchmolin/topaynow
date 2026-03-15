import { useState, useMemo } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useList } from '../hooks/useLists'
import { formatLocalDate, isLocalDateTodayOrInPast } from '../lib/dateUtils'
import {
  useTodos,
  addTodo,
  markTodoDone,
  markTodoUndone,
  deleteTodo,
  RECURRENCE_FREQUENCY,
  RECURRENCE_LABELS,
  ensureRecurrenceInstances,
} from '../hooks/useTodos'
import { addRecurrenceTemplate } from '../hooks/useTodoRecurrence'
import { logListActivity } from '../lib/listActivity'
import Modal from '../components/Modal'
import FAB from '../components/FAB'

export default function Todos() {
  const { listId } = useParams()
  const { list, loading: listLoading } = useList(listId)
  const { items: todoItems, loading } = useTodos(listId)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    dueDate: '',
    frequency: RECURRENCE_FREQUENCY.UNIQUE,
    dailyTime: '09:00',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [confirmDoneId, setConfirmDoneId] = useState(null)
  const [confirmUndoneId, setConfirmUndoneId] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const pending = useMemo(
    () =>
      todoItems.filter(
        (i) => !i.doneAt && (!i.dueDate || isLocalDateTodayOrInPast(i.dueDate))
      ),
    [todoItems]
  )
  const upcoming = useMemo(
    () =>
      todoItems
        .filter((i) => !i.doneAt && i.dueDate && !isLocalDateTodayOrInPast(i.dueDate))
        .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')),
    [todoItems]
  )
  const done = useMemo(
    () => todoItems.filter((i) => i.doneAt).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || '')),
    [todoItems]
  )

  if (!listLoading && list && list.listType !== 'porHacer') {
    return <Navigate to={`/list/${listId}/payables`} replace />
  }

  if (listLoading || !list) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Cargando…</p>
      </div>
    )
  }

  const openModal = () => {
    setForm({ title: '', dueDate: '', frequency: RECURRENCE_FREQUENCY.UNIQUE, dailyTime: '09:00' })
    setError('')
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const title = form.title.trim()
    if (!title) {
      setError('Escribe un título.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const isRecurring = form.frequency && form.frequency !== RECURRENCE_FREQUENCY.UNIQUE
      const startDate = new Date().toISOString().slice(0, 10)
      if (isRecurring) {
        await addRecurrenceTemplate(listId, {
          title,
          frequency: form.frequency,
          dailyTime: form.dailyTime || null,
          startDate,
        })
        await ensureRecurrenceInstances(listId)
      } else {
        await addTodo(listId, {
          title,
          dueDate: form.dueDate || null,
        })
      }
      setModalOpen(false)
    } catch (err) {
      setError(err.message || 'Error al guardar.')
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmMarkDone() {
    if (!confirmDoneId) return
    await markTodoDone(confirmDoneId)
    const item = todoItems.find((i) => i.id === confirmDoneId)
    if (item?.title) await logListActivity(listId, 'todo_done', { title: item.title }).catch(() => {})
    setConfirmDoneId(null)
  }

  async function confirmMarkUndone() {
    if (!confirmUndoneId) return
    await markTodoUndone(confirmUndoneId)
    setConfirmUndoneId(null)
  }

  async function confirmDelete() {
    if (!confirmDeleteId) return
    const item = todoItems.find((i) => i.id === confirmDeleteId)
    setDeleting(true)
    try {
      await deleteTodo(confirmDeleteId, listId, item?.title)
      setConfirmDeleteId(null)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-4 pb-28">
      {pending.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Pendientes</h2>
          <ul className="space-y-2">
            {pending.map((item) => (
              <TodoRow
                key={item.id}
                item={item}
                onMarkDone={() => setConfirmDoneId(item.id)}
                onMarkUndone={null}
                onDelete={() => setConfirmDeleteId(item.id)}
                isDone={false}
              />
            ))}
          </ul>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Próximas</h2>
          <ul className="space-y-2">
            {upcoming.map((item) => (
              <TodoRow
                key={item.id}
                item={item}
                onMarkDone={() => setConfirmDoneId(item.id)}
                onMarkUndone={null}
                onDelete={() => setConfirmDeleteId(item.id)}
                isDone={false}
              />
            ))}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Realizadas</h2>
          <ul className="space-y-2">
            {done.map((item) => (
              <TodoRow
                key={item.id}
                item={item}
                onMarkDone={() => setConfirmDoneId(item.id)}
                onMarkUndone={() => setConfirmUndoneId(item.id)}
                onDelete={() => setConfirmDeleteId(item.id)}
                isDone
              />
            ))}
          </ul>
        </section>
      )}

      {todoItems.length === 0 && (
        <p className="text-gray-500 text-center py-8">No hay cosas por hacer. Añade una con el botón +.</p>
      )}

      <FAB onClick={openModal} label="Nueva cosa por hacer" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva cosa por hacer">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título (obligatorio)</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="Ej. Llamar al médico"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de realización (opcional)</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Frecuencia</label>
            <select
              value={form.frequency}
              onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value={RECURRENCE_FREQUENCY.UNIQUE}>{RECURRENCE_LABELS[RECURRENCE_FREQUENCY.UNIQUE]}</option>
              <option value={RECURRENCE_FREQUENCY.DAILY}>{RECURRENCE_LABELS[RECURRENCE_FREQUENCY.DAILY]}</option>
              <option value={RECURRENCE_FREQUENCY.EVERY_OTHER_DAY}>{RECURRENCE_LABELS[RECURRENCE_FREQUENCY.EVERY_OTHER_DAY]}</option>
              <option value={RECURRENCE_FREQUENCY.WEEKLY}>{RECURRENCE_LABELS[RECURRENCE_FREQUENCY.WEEKLY]}</option>
              <option value={RECURRENCE_FREQUENCY.MONTHLY}>{RECURRENCE_LABELS[RECURRENCE_FREQUENCY.MONTHLY]}</option>
            </select>
            {form.frequency !== RECURRENCE_FREQUENCY.UNIQUE && (
              <div className="mt-2">
                <label className="block text-sm text-gray-600 mb-1">Hora a la que quieres que te recuerde (opcional)</label>
                <input
                  type="time"
                  value={form.dailyTime}
                  onChange={(e) => setForm((f) => ({ ...f, dailyTime: e.target.value }))}
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 disabled:opacity-60"
            >
              {submitting ? 'Guardando…' : 'Añadir'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!confirmDoneId} onClose={() => setConfirmDoneId(null)} title="Marcar como hecha">
        <p className="text-gray-600 mb-4">¿Marcar esta tarea como realizada?</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setConfirmDoneId(null)}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmMarkDone}
            className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600"
          >
            Sí, marcar hecha
          </button>
        </div>
      </Modal>

      <Modal open={!!confirmUndoneId} onClose={() => setConfirmUndoneId(null)} title="Pasar a pendientes">
        <p className="text-gray-600 mb-4">¿Pasar esta tarea de vuelta a pendientes?</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setConfirmUndoneId(null)}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmMarkUndone}
            className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600"
          >
            Sí, pasar a pendientes
          </button>
        </div>
      </Modal>

      <Modal open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} title="Eliminar">
        <p className="text-gray-600 mb-4">¿Eliminar esta tarea? Esta acción no se puede deshacer.</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setConfirmDeleteId(null)}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={deleting}
            className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-60"
          >
            {deleting ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

function TodoRow({ item, onMarkDone, onMarkUndone, onDelete, isDone }) {
  const handleCircleClick = isDone ? onMarkUndone : onMarkDone
  return (
    <li
      className={`flex items-center gap-3 p-4 rounded-xl border bg-white ${
        isDone ? 'border-gray-200 opacity-75 bg-gray-50' : 'border-gray-200'
      }`}
    >
      <button
        type="button"
        onClick={handleCircleClick ?? undefined}
        className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
          isDone ? 'border-green-500 bg-green-500 hover:opacity-90' : 'border-gray-300 bg-transparent hover:border-green-400'
        }`}
        aria-pressed={isDone}
        title={isDone ? 'Pasar a pendientes' : 'Marcar como hecha'}
      >
        {isDone && (
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate ${isDone ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
          {item.title}
        </p>
        <p className="text-sm text-gray-500">
          {item.dueDate
            ? `Realizar: ${formatLocalDate(item.dueDate)}`
            : 'Sin fecha'}
        </p>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 p-2 rounded-lg text-red-600 hover:bg-red-50"
        title="Eliminar"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </li>
  )
}
