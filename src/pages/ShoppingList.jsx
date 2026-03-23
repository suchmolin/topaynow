import { useState, useMemo, useRef, useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useList, getListHomePath } from '../hooks/useLists'
import {
  useShoppingItems,
  addShoppingItem,
  markShoppingItemPurchased,
  deleteShoppingItem,
  updateShoppingItem,
} from '../hooks/useShoppingItems'
import Modal from '../components/Modal'
import FAB from '../components/FAB'
import ShoppingToolbar from '../components/ShoppingToolbar'

function matchesFilter(title, q) {
  if (!q.trim()) return true
  return title.toLowerCase().includes(q.trim().toLowerCase())
}

export default function ShoppingList() {
  const { listId } = useParams()
  const { list, loading: listLoading } = useList(listId)
  const { items, loading } = useShoppingItems(listId)

  const [modalOpen, setModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [filterOpen, setFilterOpen] = useState(false)
  const [filterQuery, setFilterQuery] = useState('')
  const [pickEditMode, setPickEditMode] = useState(false)

  const [markPurchasedId, setMarkPurchasedId] = useState(null)
  const [purchasePrice, setPurchasePrice] = useState('')
  const [markingPurchase, setMarkingPurchase] = useState(false)
  const purchasePriceInputRef = useRef(null)

  useEffect(() => {
    if (!markPurchasedId) return
    const id = requestAnimationFrame(() => {
      purchasePriceInputRef.current?.focus()
    })
    return () => cancelAnimationFrame(id)
  }, [markPurchasedId])

  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const pending = useMemo(() => items.filter((i) => !i.purchasedAt), [items])
  const filtered = useMemo(
    () =>
      pending.filter((i) =>
        matchesFilter(i.title || '', filterOpen ? filterQuery : '')
      ),
    [pending, filterQuery, filterOpen]
  )

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

  async function handleAdd(e) {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) {
      setError('Escribe el nombre del artículo.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await addShoppingItem(listId, { title })
      setModalOpen(false)
      setNewTitle('')
    } catch (err) {
      setError(err.message || 'Error al guardar.')
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmMarkPurchased() {
    if (!markPurchasedId) return
    setMarkingPurchase(true)
    try {
      await markShoppingItemPurchased(markPurchasedId, listId, {
        price: purchasePrice.trim() === '' ? null : purchasePrice,
      })
      setMarkPurchasedId(null)
      setPurchasePrice('')
    } finally {
      setMarkingPurchase(false)
    }
  }

  function openMarkPurchased(item) {
    setMarkPurchasedId(item.id)
    setPurchasePrice('')
  }

  function openEdit(item) {
    setEditingId(item.id)
    setEditTitle(item.title || '')
    setEditError('')
    setPickEditMode(false)
  }

  async function saveEdit(e) {
    e.preventDefault()
    const title = editTitle.trim()
    if (!title || !editingId) return
    setEditSaving(true)
    setEditError('')
    try {
      await updateShoppingItem(editingId, listId, { title })
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-4 pb-28">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Lista de compras</h2>
      </div>
      <ShoppingToolbar
        filterOpen={filterOpen}
        onToggleFilter={() => setFilterOpen((v) => !v)}
        filterQuery={filterQuery}
        onFilterChange={setFilterQuery}
        pickEditMode={pickEditMode}
        onTogglePickEdit={() => setPickEditMode((v) => !v)}
      />
      {pickEditMode && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2.5 text-sm text-primary-900">
          <p className="pt-0.5">Selecciona el artículo que quieres editar.</p>
          <button
            type="button"
            onClick={() => setPickEditMode(false)}
            className="shrink-0 font-medium text-primary-700 hover:underline"
          >
            Cancelar
          </button>
        </div>
      )}

      {filtered.length > 0 ? (
        <ul className="space-y-1.5">
          {filtered.map((item) => (
            <li
              key={item.id}
              onClick={(e) => {
                if (!pickEditMode) return
                if (e.target.closest('button')) return
                openEdit(item)
              }}
              className={`flex items-center gap-2 py-2 px-3 rounded-xl border bg-white ${
                pickEditMode ? 'border-primary-300 ring-1 ring-primary-200 cursor-pointer' : 'border-gray-200'
              }`}
            >
              <button
                type="button"
                onClick={() => openMarkPurchased(item)}
                className="shrink-0 w-5 h-5 rounded-full border-2 border-gray-300 hover:border-green-400 flex items-center justify-center"
                title="Marcar como comprado"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate leading-snug">{item.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(item.id)}
                className="shrink-0 p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                title="Eliminar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500 text-center py-8">
          {pending.length === 0 ? 'No hay artículos en la lista. Añade uno con el botón +.' : 'Ningún artículo coincide con el filtro.'}
        </p>
      )}

      <FAB onClick={() => setModalOpen(true)} label="Añadir artículo" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Añadir artículo">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del artículo</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="Ej. Leche"
              autoFocus
            />
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

      <Modal open={!!markPurchasedId} onClose={() => setMarkPurchasedId(null)} title="Marcar como comprado">
        <p className="text-gray-600 mb-3">Opcional: indica el precio de costo. Si lo dejas vacío, se guardará sin precio.</p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Precio (opcional)</label>
          <input
            ref={purchasePriceInputRef}
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
            placeholder="0.00"
          />
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setMarkPurchasedId(null)}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmMarkPurchased}
            disabled={markingPurchase}
            className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 disabled:opacity-60"
          >
            {markingPurchase ? 'Guardando…' : 'Confirmar'}
          </button>
        </div>
      </Modal>

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

      <Modal open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} title="Eliminar">
        <p className="text-gray-600 mb-4">¿Eliminar este artículo de la lista?</p>
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
