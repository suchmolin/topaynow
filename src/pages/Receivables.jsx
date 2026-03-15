import { useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useList } from '../hooks/useLists'
import { useReceivables, addReceivable } from '../hooks/useReceivables'
import { formatLocalDate } from '../lib/dateUtils'
import Modal from '../components/Modal'
import FAB from '../components/FAB'

function formatMoney(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export default function Receivables() {
  const { listId } = useParams()
  const { list } = useList(listId)
  const { items, loading } = useReceivables(listId)
  if (list?.listType === 'porHacer') return <Navigate to={`/list/${listId}/todos`} replace />
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ title: '', amount: '', expectedDate: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const totalSelected = items.filter((i) => selectedIds.has(i.id)).reduce((s, i) => s + i.amount, 0)
  const allSelected = items.length > 0 && selectedIds.size === items.length

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const selectAll = () => setSelectedIds(new Set(items.map((i) => i.id)))
  const deselectAll = () => setSelectedIds(new Set())

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
      await addReceivable(listId, {
        title,
        amount,
        expectedDate: form.expectedDate || null,
      })
      setModalOpen(false)
      setForm({ title: '', amount: '', expectedDate: '' })
    } catch (err) {
      setError(err.message || 'Error al guardar.')
    } finally {
      setSubmitting(false)
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
      {items.length > 0 && (
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={allSelected ? deselectAll : selectAll}
            className="text-sm text-primary-600 font-medium"
          >
            {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
          </button>
        </div>
      )}
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={`flex items-center gap-3 p-4 rounded-xl border bg-white ${
              selectedIds.has(item.id) ? 'border-primary-400 ring-1 ring-primary-200' : 'border-gray-200'
            }`}
          >
            <button
              type="button"
              onClick={() => toggleSelect(item.id)}
              className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                selectedIds.has(item.id) ? 'border-primary-500 bg-primary-500' : 'border-gray-300 bg-transparent'
              }`}
              aria-pressed={selectedIds.has(item.id)}
            >
              {selectedIds.has(item.id) && (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{item.title}</p>
              {item.expectedDate && (
                <p className="text-sm text-gray-500">
                  Fecha probable: {formatLocalDate(item.expectedDate)}
                </p>
              )}
            </div>
            <span className="font-semibold text-gray-900 shrink-0">{formatMoney(item.amount)}</span>
          </li>
        ))}
      </ul>
      {items.length === 0 && (
        <p className="text-gray-500 text-center py-8">No hay cuentas por cobrar. Añade una con el botón +.</p>
      )}
      {totalSelected > 0 && (
        <div className="fixed left-0 right-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 px-4 py-3 bg-white border-t border-gray-200 safe-bottom">
          <p className="text-center font-semibold text-gray-900">Total seleccionado: {formatMoney(totalSelected)}</p>
        </div>
      )}
      <FAB onClick={() => { setModalOpen(true); setForm({ title: '', amount: '', expectedDate: '' }); setError(''); }} label="Nueva cuenta por cobrar" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva cuenta por cobrar">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="Ej. Cobro cliente X"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha probable de cobro (opcional)</label>
            <input
              type="date"
              value={form.expectedDate}
              onChange={(e) => setForm((f) => ({ ...f, expectedDate: e.target.value }))}
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
    </div>
  )
}
