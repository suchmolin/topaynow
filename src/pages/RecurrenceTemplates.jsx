import { useState, useMemo } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useList, getListHomePath } from '../hooks/useLists'
import { useTodoRecurrenceTemplates, updateRecurrenceTemplate, deleteRecurrenceTemplate } from '../hooks/useTodoRecurrence'
import { RECURRENCE_LABELS } from '../hooks/useTodos'
import { formatLocalDate } from '../lib/dateUtils'
import Modal from '../components/Modal'

export default function RecurrenceTemplates() {
  const { listId } = useParams()
  const { list, loading: listLoading } = useList(listId)
  const { items, loading } = useTodoRecurrenceTemplates(listId)
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({ title: '', frequency: '', dailyTime: '09:00', startDate: '' })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const recurring = useMemo(
    () => items.filter((t) => t.frequency && t.frequency !== 'unique'),
    [items]
  )

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

  function openEdit(template) {
    setEditId(template.id)
    setEditForm({
      title: template.title || '',
      frequency: template.frequency || 'daily',
      dailyTime: template.dailyTime || '09:00',
      startDate: template.startDate || '',
    })
    setError('')
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    const title = editForm.title.trim()
    if (!title) {
      setError('El título es obligatorio.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await updateRecurrenceTemplate(editId, listId, {
        title: editForm.title,
        frequency: editForm.frequency,
        dailyTime: editForm.dailyTime || null,
        startDate: editForm.startDate || undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      setEditId(null)
    } catch (err) {
      setError(err.message || 'Error al guardar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmDelete() {
    if (!deleteId) return
    const template = items.find((t) => t.id === deleteId)
    setDeleting(true)
    try {
      await deleteRecurrenceTemplate(deleteId, listId, template?.title)
      setDeleteId(null)
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
      <p className="text-sm text-gray-600 mb-4">
        Aquí se listan las actividades que creaste con frecuencia (diario, interdiario, cada semana, cada mes). Puedes editarlas o eliminarlas.
      </p>
      {recurring.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          Aún no hay actividades recurrentes. Crea una desde “Por hacer” eligiendo una frecuencia distinta de “Única”.
        </p>
      ) : (
        <ul className="space-y-2">
          {recurring.map((template) => (
            <li
              key={template.id}
              className="flex items-center justify-between gap-3 p-4 rounded-xl border border-gray-200 bg-white"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 truncate">{template.title}</p>
                <p className="text-sm text-gray-500">
                  {RECURRENCE_LABELS[template.frequency] || template.frequency}
                  {template.dailyTime && ` · ${template.dailyTime}`}
                  {template.startDate && ` · Desde ${formatLocalDate(template.startDate)}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(template)}
                  className="p-2 rounded-lg text-primary-600 hover:bg-primary-50"
                  title="Editar"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(template.id)}
                  className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                  title="Eliminar"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!editId} onClose={() => setEditId(null)} title="Editar actividad recurrente">
        <form onSubmit={handleSaveEdit} className="space-y-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Frecuencia</label>
            <select
              value={editForm.frequency}
              onChange={(e) => setEditForm((f) => ({ ...f, frequency: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="daily">{RECURRENCE_LABELS.daily}</option>
              <option value="everyOtherDay">{RECURRENCE_LABELS.everyOtherDay}</option>
              <option value="weekly">{RECURRENCE_LABELS.weekly}</option>
              <option value="monthly">{RECURRENCE_LABELS.monthly}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hora de recordatorio (opcional)</label>
            <input
              type="time"
              value={editForm.dailyTime}
              onChange={(e) => setEditForm((f) => ({ ...f, dailyTime: e.target.value }))}
              className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de inicio</label>
            <input
              type="date"
              value={editForm.startDate}
              onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setEditId(null)}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 disabled:opacity-60"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar actividad recurrente">
        <p className="text-gray-600 mb-4">
          ¿Eliminar esta actividad recurrente? Las tareas ya generadas en “Por hacer” no se borrarán, pero dejarán de crearse nuevas.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setDeleteId(null)}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmDelete}
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
