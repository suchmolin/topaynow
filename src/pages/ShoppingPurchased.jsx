import { useState, useMemo } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useList, getListHomePath } from '../hooks/useLists'
import {
  useShoppingItems,
  updateShoppingItem,
  deleteShoppingItem,
  unmarkShoppingItemPurchased,
  unmarkAllShoppingItemsPurchased,
} from '../hooks/useShoppingItems'
import Modal from '../components/Modal'
import ShoppingToolbar from '../components/ShoppingToolbar'

function formatMoney(n) {
  return new Intl.NumberFormat('es', { style: 'currency', currency: 'USD' }).format(n)
}

function matchesFilter(title, q) {
  if (!q.trim()) return true
  return title.toLowerCase().includes(q.trim().toLowerCase())
}

export default function ShoppingPurchased() {
  const { listId } = useParams()
  const { list, loading: listLoading } = useList(listId)
  const { items, loading } = useShoppingItems(listId)

  const [filterOpen, setFilterOpen] = useState(false)
  const [filterQuery, setFilterQuery] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [returningId, setReturningId] = useState(null)
  const [returnAllOpen, setReturnAllOpen] = useState(false)
  const [returningAll, setReturningAll] = useState(false)

  const purchased = useMemo(() => items.filter((i) => i.purchasedAt), [items])
  const filtered = useMemo(
    () =>
      purchased.filter((i) =>
        matchesFilter(i.title || '', filterOpen ? filterQuery : '')
      ),
    [purchased, filterQuery, filterOpen]
  )

  const totalSelected = useMemo(() => {
    return filtered.reduce((sum, item) => {
      if (item.includeInTotal === false) return sum
      const p = item.price
      if (typeof p === 'number' && Number.isFinite(p)) return sum + p
      return sum
    }, 0)
  }, [filtered])

  const itemsWithoutPriceCount = useMemo(() => {
    return filtered.filter((item) => {
      const hasPrice = typeof item.price === 'number' && Number.isFinite(item.price)
      return !hasPrice
    }).length
  }, [filtered])

  if (!listLoading && list && list.listType !== 'compras') {
    return <Navigate to={`/list/${listId}/${getListHomePath(list.listType)}`} replace />
  }

  if (listLoading || !list) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Cargando…</p>
      </div>
    )
  }

  async function toggleIncludeInTotal(item, checked) {
    try {
      await updateShoppingItem(item.id, listId, { includeInTotal: checked })
    } catch (e) {
      console.error(e)
    }
  }

  function openEdit(item) {
    setEditingId(item.id)
    setEditTitle(item.title || '')
    setEditPrice(item.price != null && item.price !== '' ? String(item.price) : '')
    setEditError('')
  }

  async function saveEdit(e) {
    e.preventDefault()
    const title = editTitle.trim()
    if (!title || !editingId) return
    setEditSaving(true)
    setEditError('')
    try {
      let price = null
      if (editPrice.trim() !== '') {
        const n = Number(editPrice)
        if (!Number.isFinite(n) || n < 0) {
          setEditError('El precio debe ser un número válido.')
          setEditSaving(false)
          return
        }
        price = n
      }
      await updateShoppingItem(editingId, listId, { title, price })
      setEditingId(null)
    } catch (err) {
      setEditError(err.message || 'Error al guardar.')
    } finally {
      setEditSaving(false)
    }
  }

  async function confirmDelete() {
    if (!confirmDeleteId) return
    const item = items.find((i) => i.id === confirmDeleteId)
    setDeleting(true)
    try {
      await deleteShoppingItem(confirmDeleteId, listId, item?.title)
      setConfirmDeleteId(null)
    } finally {
      setDeleting(false)
    }
  }

  async function handleReturnToPending(item) {
    setReturningId(item.id)
    try {
      await unmarkShoppingItemPurchased(item.id, listId, item.title)
    } catch (e) {
      console.error(e)
    } finally {
      setReturningId(null)
    }
  }

  async function handleReturnAllToPending() {
    setReturningAll(true)
    try {
      await unmarkAllShoppingItemsPurchased(listId)
      setReturnAllOpen(false)
    } catch (e) {
      console.error(e)
    } finally {
      setReturningAll(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Cargando…</p>
      </div>
    )
  }

  const showTotalBar = purchased.length > 0

  return (
    <div
      className={`px-4 py-4 ${
        showTotalBar
          ? 'pb-[calc(11rem+env(safe-area-inset-bottom))]'
          : 'pb-28'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Comprados</h2>
        {purchased.length > 0 && (
          <button
            type="button"
            onClick={() => setReturnAllOpen(true)}
            className="text-xs font-medium text-primary-600 hover:text-primary-700 hover:underline shrink-0"
          >
            Devolver todos a pendientes
          </button>
        )}
      </div>
      <ShoppingToolbar
        filterOpen={filterOpen}
        onToggleFilter={() => setFilterOpen((v) => !v)}
        filterQuery={filterQuery}
        onFilterChange={setFilterQuery}
        showPickEditButton={false}
      />

      {filtered.length > 0 ? (
        <ul className="space-y-1.5 mb-3">
          {filtered.map((item) => {
            const selected = item.includeInTotal !== false
            const hasPrice = typeof item.price === 'number' && Number.isFinite(item.price)
            return (
              <li
                key={item.id}
                onClick={(e) => {
                  if (e.target.closest('button, input')) return
                  openEdit(item)
                }}
                className="flex items-center gap-2 py-2 px-3 rounded-xl border border-gray-200 bg-white cursor-pointer hover:bg-gray-50/90 active:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(e) => toggleIncludeInTotal(item, e.target.checked)}
                  className="shrink-0 w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  title="Incluir en el total"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate leading-snug">{item.title}</p>
                  <p className="text-xs text-gray-500 leading-tight mt-0.5">
                    {hasPrice ? formatMoney(item.price) : 'Sin precio'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    void handleReturnToPending(item)
                  }}
                  disabled={returningId === item.id}
                  className="shrink-0 p-1.5 rounded-lg text-primary-600 hover:bg-primary-50 disabled:opacity-50"
                  title="Volver a la lista de pendientes"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setConfirmDeleteId(item.id)
                  }}
                  className="shrink-0 p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                  title="Eliminar"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-gray-500 text-center py-8">
          {purchased.length === 0
            ? 'Aún no hay artículos comprados. Márcalos desde la lista de compras.'
            : 'Ningún artículo coincide con el filtro.'}
        </p>
      )}

      {showTotalBar && (
        <div
          className="fixed left-0 right-0 z-20 px-4 pt-2 pb-2 border-t border-gray-200 bg-white/95 backdrop-blur-sm shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.08)]"
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs text-gray-500">Total (marcados con precio)</p>
            <p className="text-base font-semibold text-gray-900 tabular-nums">{formatMoney(totalSelected)}</p>
          </div>
          {itemsWithoutPriceCount > 0 ? (
            <p className="text-[11px] text-amber-800 mt-0.5 leading-snug">
              {itemsWithoutPriceCount === 1
                ? 'Hay 1 artículo sin precio: no suma al total. Pulsa la fila para añadirlo.'
                : `Hay ${itemsWithoutPriceCount} artículos sin precio: no suman al total. Pulsa una fila para añadirlo.`}
            </p>
          ) : (
            <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
              Desmarca artículos para excluirlos del total.
            </p>
          )}
        </div>
      )}

      <Modal open={!!editingId} onClose={() => setEditingId(null)} title="Editar artículo">
        <form onSubmit={saveEdit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio (opcional)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="Vacío = sin precio"
            />
          </div>
          {editError && <p className="text-sm text-red-600">{editError}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={editSaving}
              className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 disabled:opacity-60"
            >
              {editSaving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={returnAllOpen}
        onClose={() => !returningAll && setReturnAllOpen(false)}
        title="Devolver todos a pendientes"
      >
        <p className="text-gray-600 mb-4">
          Los {purchased.length} artículo{purchased.length === 1 ? '' : 's'} comprado{purchased.length === 1 ? '' : 's'}{' '}
          volverán a la lista principal. Se quitará el precio guardado en cada uno.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={returningAll}
            onClick={() => setReturnAllOpen(false)}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={returningAll}
            onClick={() => void handleReturnAllToPending()}
            className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 disabled:opacity-60"
          >
            {returningAll ? 'Devolviendo…' : 'Devolver todos'}
          </button>
        </div>
      </Modal>

      <Modal open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} title="Eliminar">
        <p className="text-gray-600 mb-4">¿Eliminar este artículo?</p>
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
