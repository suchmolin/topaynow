import { useState, useMemo, useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useList, getListHomePath } from '../hooks/useLists'
import { formatLocalDate, isLocalDateTodayOrInPast, toLocalDateString } from '../lib/dateUtils'
import { requestNotificationPermission, notifyPendingTodayIfNeeded } from '../lib/notifications'
import { registerFCMToken } from '../lib/fcm'
import {
  useTodos,
  addTodo,
  markTodoDone,
  markTodoUndone,
  deleteTodo,
  updateTodo,
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
  const { user } = useAuth()
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
  const [confirmDeleteDoneAll, setConfirmDeleteDoneAll] = useState(false)
  const [deletingDoneAll, setDeletingDoneAll] = useState(false)
  const [confirmMarkAllDone, setConfirmMarkAllDone] = useState(false)
  const [markingAllDone, setMarkingAllDone] = useState(false)
  const [pickTodoToEdit, setPickTodoToEdit] = useState(false)
  const [editingTodo, setEditingTodo] = useState(null)
  const [editForm, setEditForm] = useState({ title: '', dueDate: '' })
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState('')

  const visibleItems = useMemo(
    () => todoItems.filter((i) => !i.deletedAt),
    [todoItems]
  )

  const pending = useMemo(
    () =>
      visibleItems.filter(
        (i) => !i.doneAt && (!i.dueDate || isLocalDateTodayOrInPast(i.dueDate))
      ),
    [visibleItems]
  )
  const upcoming = useMemo(
    () =>
      visibleItems
        .filter((i) => !i.doneAt && i.dueDate && !isLocalDateTodayOrInPast(i.dueDate))
        .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')),
    [visibleItems]
  )
  const done = useMemo(
    () => visibleItems.filter((i) => i.doneAt).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || '')),
    [visibleItems]
  )

  /** Pendientes + próximas: todas las que aún no están hechas */
  const incomplete = useMemo(() => [...pending, ...upcoming], [pending, upcoming])

  const pendingToday = useMemo(() => {
    const today = toLocalDateString(new Date())
    return pending.filter((i) => i.dueDate === today)
  }, [pending])

  useEffect(() => {
    if (list?.listType !== 'porHacer') return
    requestNotificationPermission()
      .then((p) => {
        if (p === 'granted' && user?.uid) registerFCMToken(user.uid).catch(() => {})
      })
      .catch(() => {})
  }, [list?.listType, user?.uid])

  const pendingTodayIdsKey = pendingToday.map((i) => i.id).sort().join(',')
  useEffect(() => {
    if (!pendingToday.length) return
    notifyPendingTodayIfNeeded(pendingToday).catch(() => {})
  }, [pendingTodayIdsKey])

  if (!listLoading && list && list.listType !== 'porHacer') {
    return <Navigate to={`/list/${listId}/${getListHomePath(list.listType)}`} replace />
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
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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

  function openEditTodo(item) {
    setEditingTodo(item.id)
    setEditForm({ title: item.title || '', dueDate: item.dueDate || '' })
    setEditError('')
    setPickTodoToEdit(false)
  }

  async function handleSaveEditTodo(e) {
    e.preventDefault()
    const title = editForm.title.trim()
    if (!title || !editingTodo) {
      setEditError('Escribe un título.')
      return
    }
    setEditSubmitting(true)
    setEditError('')
    try {
      await updateTodo(editingTodo, { title, dueDate: editForm.dueDate.trim() || null })
      await logListActivity(listId, 'todo_updated', { title }).catch(() => {})
      setEditingTodo(null)
    } catch (err) {
      setEditError(err.message || 'Error al guardar.')
    } finally {
      setEditSubmitting(false)
    }
  }

  async function confirmDeleteAllDone() {
    if (!done.length) {
      setConfirmDeleteDoneAll(false)
      return
    }
    setDeletingDoneAll(true)
    try {
      await Promise.all(
        done.map((item) => deleteTodo(item.id, listId, item.title))
      )
      setConfirmDeleteDoneAll(false)
    } finally {
      setDeletingDoneAll(false)
    }
  }

  async function handleMarkAllIncompleteDone() {
    if (!incomplete.length) {
      setConfirmMarkAllDone(false)
      return
    }
    setMarkingAllDone(true)
    try {
      await Promise.all(incomplete.map((item) => markTodoDone(item.id)))
      setConfirmMarkAllDone(false)
    } finally {
      setMarkingAllDone(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Cargando…</p>
      </div>
    )
  }

  const editingTodoItem = editingTodo ? todoItems.find((i) => i.id === editingTodo) : null

  return (
    <div className="px-4 py-4 pb-28">
      {visibleItems.length > 0 && (
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="min-w-0 flex-1">
            {incomplete.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmMarkAllDone(true)}
                className="text-sm font-medium text-green-700 hover:text-green-800 hover:underline text-left"
              >
                Marcar todas como realizadas ({incomplete.length})
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setPickTodoToEdit((v) => !v)}
            className={`shrink-0 p-2.5 rounded-full border ${
              pickTodoToEdit
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-transparent text-gray-600 hover:bg-gray-100'
            }`}
            aria-label="Editar una tarea"
            title="Editar una tarea"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>
      )}
      {pickTodoToEdit && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2.5 text-sm text-primary-900">
          <p className="pt-0.5">Selecciona la tarea que quieres editar.</p>
          <button
            type="button"
            onClick={() => setPickTodoToEdit(false)}
            className="shrink-0 font-medium text-primary-700 hover:underline"
          >
            Cancelar
          </button>
        </div>
      )}
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
                selectEditMode={pickTodoToEdit}
                onPickEdit={openEditTodo}
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
                selectEditMode={pickTodoToEdit}
                onPickEdit={openEditTodo}
              />
            ))}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-2 gap-2">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Realizadas</h2>
            <button
              type="button"
              onClick={() => setConfirmDeleteDoneAll(true)}
              className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline disabled:opacity-60 text-right shrink-0 max-w-[55%]"
              disabled={deletingDoneAll}
            >
              {deletingDoneAll ? 'Eliminando…' : 'Eliminar todas'}
            </button>
          </div>
          <ul className="space-y-2">
            {done.map((item) => (
              <TodoRow
                key={item.id}
                item={item}
                onMarkDone={() => setConfirmDoneId(item.id)}
                onMarkUndone={() => setConfirmUndoneId(item.id)}
                onDelete={() => setConfirmDeleteId(item.id)}
                isDone
                selectEditMode={pickTodoToEdit}
                onPickEdit={openEditTodo}
              />
            ))}
          </ul>
        </section>
      )}

      {visibleItems.length === 0 && (
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

      <Modal open={!!editingTodo} onClose={() => setEditingTodo(null)} title="Editar tarea">
        <form onSubmit={handleSaveEditTodo} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
            <input
              type="text"
              value={editForm.title}
              onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de realización (opcional)</label>
            <input
              type="date"
              value={editForm.dueDate}
              onChange={(e) => setEditForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
          {editingTodoItem?.recurrenceTemplateId && (
            <p className="text-xs text-gray-500">
              Esta tarea viene de una actividad recurrente; al cambiar nombre o fecha solo se modifica esta ocurrencia.
            </p>
          )}
          {editError && <p className="text-sm text-red-600">{editError}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setEditingTodo(null)}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={editSubmitting}
              className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 disabled:opacity-60"
            >
              {editSubmitting ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={confirmMarkAllDone}
        onClose={() => !markingAllDone && setConfirmMarkAllDone(false)}
        title="Marcar todas como realizadas"
      >
        <p className="text-gray-600 mb-4">
          Se marcarán como realizadas todas las tareas pendientes y próximas ({incomplete.length} en total).
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setConfirmMarkAllDone(false)}
            disabled={markingAllDone}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleMarkAllIncompleteDone}
            disabled={markingAllDone}
            className="flex-1 py-3 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-60"
          >
            {markingAllDone ? 'Marcando…' : 'Sí, marcar todas'}
          </button>
        </div>
      </Modal>

      <Modal
        open={confirmDeleteDoneAll}
        onClose={() => setConfirmDeleteDoneAll(false)}
        title="Eliminar todas"
      >
        <p className="text-gray-600 mb-4">
          Se eliminarán todas las tareas completadas ({done.length} en total). Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setConfirmDeleteDoneAll(false)}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmDeleteAllDone}
            disabled={deletingDoneAll}
            className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-60"
          >
            {deletingDoneAll ? 'Eliminando…' : 'Sí, eliminar todas'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

function TodoRow({ item, onMarkDone, onMarkUndone, onDelete, isDone, selectEditMode, onPickEdit }) {
  const handleCircleClick = isDone ? onMarkUndone : onMarkDone
  return (
    <li
      onClick={(e) => {
        if (!selectEditMode || !onPickEdit) return
        if (e.target.closest('button')) return
        onPickEdit(item)
      }}
      className={`flex items-center gap-3 p-4 rounded-xl border bg-white ${
        selectEditMode
          ? 'border-primary-300 ring-1 ring-primary-200 cursor-pointer'
          : isDone
            ? 'border-gray-200 opacity-75 bg-gray-50'
            : 'border-gray-200'
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
