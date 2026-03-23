import { useState, useMemo } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useList } from '../hooks/useLists'
import { usePayables, addPayable, markPayablePaid, updatePayable, isOverdueOrNoDate } from '../hooks/usePayables'
import { formatLocalDate } from '../lib/dateUtils'
import { useFixedExpenses } from '../hooks/useFixedExpenses'
import { logListActivity } from '../lib/listActivity'
import Modal from '../components/Modal'
import FAB from '../components/FAB'

function formatMoney(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export default function Payables() {
  const { listId } = useParams()
  const { list } = useList(listId)
  const { items, loading } = usePayables(listId)
  if (list?.listType === 'porHacer') return <Navigate to={`/list/${listId}/todos`} replace />
  const { items: fixedExpenses } = useFixedExpenses(listId)
  const [selectedIds, setSelectedIds] = useState(null) // null = use initial (overdue/no date), Set = user choice
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmPayId, setConfirmPayId] = useState(null)
  const [form, setForm] = useState({ title: '', amount: '', dueDate: '' })
  const [fixedPickOpen, setFixedPickOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [pickPayableToEdit, setPickPayableToEdit] = useState(false)
  const [editingPayableId, setEditingPayableId] = useState(null)
  const [editPayForm, setEditPayForm] = useState({ title: '', amount: '', dueDate: '' })
  const [editPaySubmitting, setEditPaySubmitting] = useState(false)
  const [editPayError, setEditPayError] = useState('')

  const unpaid = useMemo(() => items.filter((i) => !i.paidAt), [items])
  const initialSelected = useMemo(() => {
    const set = new Set()
    unpaid.forEach((i) => {
      if (isOverdueOrNoDate(i.dueDate)) set.add(i.id)
    })
    return set
  }, [unpaid])
  const selectedSet = selectedIds === null ? initialSelected : selectedIds
  const totalSelected = useMemo(() => {
    return unpaid.filter((i) => selectedSet.has(i.id)).reduce((s, i) => s + i.amount, 0)
  }, [unpaid, selectedSet])
  const isAllSelected = unpaid.length > 0 && selectedSet.size === unpaid.length

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const base = prev === null ? initialSelected : prev
      const next = new Set(base)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const selectAll = () => setSelectedIds(new Set(unpaid.map((i) => i.id)))
  const deselectAll = () => setSelectedIds(new Set())

  const openModal = () => {
    setForm({ title: '', amount: '', dueDate: '' })
    setFixedPickOpen(false)
    setError('')
    setModalOpen(true)
  }
  const pickFixed = (fix) => {
    setForm((f) => ({ ...f, title: fix.title, amount: String(fix.amount) }))
    setFixedPickOpen(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const title = form.title.trim()
    const amount = Number(form.amount)
    if (!title || !Number.isFinite(amount) || amount <= 0) {
      setError('Título y monto son obligatorios y el monto debe ser mayor que 0.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await addPayable(listId, {
        title,
        amount,
        dueDate: form.dueDate || null,
      })
      setModalOpen(false)
    } catch (err) {
      setError(err.message || 'Error al guardar.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMarkPaid(id) {
    setConfirmPayId(id)
  }
  function openEditPayable(item) {
    setEditingPayableId(item.id)
    setEditPayForm({
      title: item.title || '',
      amount: String(item.amount ?? ''),
      dueDate: item.dueDate || '',
    })
    setEditPayError('')
    setPickPayableToEdit(false)
  }

  async function handleSaveEditPayable(e) {
    e.preventDefault()
    const title = editPayForm.title.trim()
    const amount = Number(editPayForm.amount)
    if (!title || !Number.isFinite(amount) || amount <= 0) {
      setEditPayError('Título y monto son obligatorios y el monto debe ser mayor que 0.')
      return
    }
    if (!editingPayableId) return
    setEditPaySubmitting(true)
    setEditPayError('')
    try {
      await updatePayable(editingPayableId, listId, {
        title,
        amount,
        dueDate: editPayForm.dueDate.trim() || null,
      })
      setEditingPayableId(null)
    } catch (err) {
      setEditPayError(err.message || 'Error al guardar.')
    } finally {
      setEditPaySubmitting(false)
    }
  }

  async function confirmMarkPaid() {
    if (!confirmPayId) return
    const item = items.find((i) => i.id === confirmPayId)
    await markPayablePaid(confirmPayId)
    if (item?.title) await logListActivity(listId, 'payable_marked_paid', { title: item.title }).catch(() => {})
    setConfirmPayId(null)
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
      {unpaid.length > 0 && (
        <div className="flex items-center justify-between mb-3 gap-2">
          <button
            type="button"
            onClick={isAllSelected ? deselectAll : selectAll}
            className="text-sm text-primary-600 font-medium"
          >
            {isAllSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
          </button>
          <button
            type="button"
            onClick={() => setPickPayableToEdit((v) => !v)}
            className={`p-2.5 rounded-full border shrink-0 ${
              pickPayableToEdit
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-transparent text-gray-600 hover:bg-gray-100'
            }`}
            aria-label="Editar un gasto"
            title="Editar un gasto"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>
      )}
      {pickPayableToEdit && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2.5 text-sm text-primary-900">
          <p className="pt-0.5">Selecciona el gasto que quieres editar.</p>
          <button
            type="button"
            onClick={() => setPickPayableToEdit(false)}
            className="shrink-0 font-medium text-primary-700 hover:underline"
          >
            Cancelar
          </button>
        </div>
      )}
      <ul className="space-y-2">
        {unpaid.map((item) => (
          <li
            key={item.id}
            onClick={(e) => {
              if (!pickPayableToEdit) return
              if (e.target.closest('button')) return
              openEditPayable(item)
            }}
            className={`flex items-center gap-3 p-4 rounded-xl border bg-white ${
              pickPayableToEdit
                ? 'border-primary-300 ring-1 ring-primary-200 cursor-pointer'
                : selectedSet.has(item.id)
                  ? 'border-primary-400 ring-1 ring-primary-200'
                  : 'border-gray-200'
            }`}
          >
            <button
              type="button"
              onClick={() => toggleSelect(item.id)}
              className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                selectedSet.has(item.id) ? 'border-primary-500 bg-primary-500' : 'border-gray-300 bg-transparent'
              }`}
              aria-pressed={selectedSet.has(item.id)}
            >
              {selectedSet.has(item.id) && (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{item.title}</p>
              <p className="text-sm text-gray-500">
                {item.dueDate ? `Vence: ${formatLocalDate(item.dueDate)}` : 'Sin fecha'}
                {isOverdueOrNoDate(item.dueDate) && !item.dueDate && ' • Pendiente'}
                {item.dueDate && isOverdueOrNoDate(item.dueDate) && ' • Vencida'}
              </p>
            </div>
            <span className="font-semibold text-gray-900 shrink-0">{formatMoney(item.amount)}</span>
            <button
              type="button"
              onClick={() => handleMarkPaid(item.id)}
              className="shrink-0 p-2 rounded-lg text-green-600 hover:bg-green-50"
              title="Marcar como pagado"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      {unpaid.length === 0 && (
        <p className="text-gray-500 text-center py-8">No hay cuentas por pagar. Añade una con el botón +.</p>
      )}
      {totalSelected > 0 && (
        <div className="fixed left-0 right-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 px-4 py-3 bg-white border-t border-gray-200 safe-bottom">
          <p className="text-center font-semibold text-gray-900">Total seleccionado: {formatMoney(totalSelected)}</p>
        </div>
      )}
      <FAB onClick={openModal} label="Nueva cuenta por pagar" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva cuenta por pagar">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título (obligatorio)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
                placeholder="Ej. Renta marzo"
              />
              <button
                type="button"
                onClick={() => setFixedPickOpen(true)}
                className="shrink-0 px-3 py-2 rounded-xl border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
              >
                Usar gasto fijo
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monto (obligatorio)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha estimada de pago (opcional)</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={submitting} className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 disabled:opacity-60">
              {submitting ? 'Guardando…' : 'Añadir'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={fixedPickOpen} onClose={() => setFixedPickOpen(false)} title="Elegir gasto fijo">
        {fixedExpenses.length === 0 ? (
          <p className="text-gray-500">No hay gastos fijos en esta lista.</p>
        ) : (
          <ul className="space-y-2">
            {fixedExpenses.map((fix) => (
              <li key={fix.id}>
                <button
                  type="button"
                  onClick={() => pickFixed(fix)}
                  className="w-full text-left p-3 rounded-xl border border-gray-200 hover:bg-gray-50 flex justify-between items-center"
                >
                  <span className="font-medium text-gray-900">{fix.title}</span>
                  <span className="text-gray-600">{formatMoney(fix.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal open={!!editingPayableId} onClose={() => setEditingPayableId(null)} title="Editar cuenta por pagar">
        <form onSubmit={handleSaveEditPayable} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
            <input
              type="text"
              value={editPayForm.title}
              onChange={(e) => setEditPayForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={editPayForm.amount}
              onChange={(e) => setEditPayForm((f) => ({ ...f, amount: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha estimada de pago (opcional)</label>
            <input
              type="date"
              value={editPayForm.dueDate}
              onChange={(e) => setEditPayForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
          {editPayError && <p className="text-sm text-red-600">{editPayError}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setEditingPayableId(null)}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={editPaySubmitting}
              className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 disabled:opacity-60"
            >
              {editPaySubmitting ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!confirmPayId} onClose={() => setConfirmPayId(null)} title="Marcar como pagado">
        <p className="text-gray-600 mb-4">¿Marcar esta cuenta como pagada?</p>
        <div className="flex gap-3">
          <button type="button" onClick={() => setConfirmPayId(null)} className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">
            Cancelar
          </button>
          <button type="button" onClick={confirmMarkPaid} className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600">
            Sí, marcar pagada
          </button>
        </div>
      </Modal>
    </div>
  )
}
