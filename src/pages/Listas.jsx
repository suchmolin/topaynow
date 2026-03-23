import { useState, useCallback, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { useLists, createList, LIST_TYPES, updateList, deleteListCompletely, getListHomePath } from '../hooks/useLists'
import { useUserListOrder } from '../hooks/useUserListOrder'
import { logListActivity } from '../lib/listActivity'
import { formatLocalDate } from '../lib/dateUtils'
import Modal from '../components/Modal'
import FAB from '../components/FAB'

export default function Listas() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { lists, loading } = useLists(user?.uid)
  const { orderedLists, saveOrder } = useUserListOrder(user?.uid, lists)
  const [modalOpen, setModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newListDate, setNewListDate] = useState('')
  const [listType, setListType] = useState('gastos')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [editListId, setEditListId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')
  const [pickListToEdit, setPickListToEdit] = useState(false)
  const [deleteListConfirmOpen, setDeleteListConfirmOpen] = useState(false)
  const [deletingList, setDeletingList] = useState(false)
  /** Lista que acaba de moverse (resalte breve en la UI). */
  const [flashListId, setFlashListId] = useState(null)
  const flashTimeoutRef = useRef(null)

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current)
    }
  }, [])

  const hasOwnedList = lists.some((l) => l.ownerId === user?.uid)

  const moveList = useCallback(
    async (listId, direction) => {
      const ids = orderedLists.map((l) => l.id)
      const i = ids.indexOf(listId)
      if (i < 0) return
      const j = direction === 'up' ? i - 1 : i + 1
      if (j < 0 || j >= ids.length) return
      const next = [...ids]
      ;[next[i], next[j]] = [next[j], next[i]]
      try {
        await saveOrder(next)
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current)
        setFlashListId(listId)
        flashTimeoutRef.current = setTimeout(() => {
          setFlashListId(null)
          flashTimeoutRef.current = null
        }, 900)
      } catch {
        alert(
          'No se pudo guardar el orden. Comprueba las reglas de Firestore para userListOrder (ver FIREBASE.md).'
        )
      }
    },
    [orderedLists, saveOrder]
  )

  async function handleCreateList(e) {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) {
      setError('Escribe un título para la lista.')
      return
    }
    setCreating(true)
    setError('')
    try {
      const id = await createList(user.uid, title, listType, newListDate.trim() || null)
      await logListActivity(id, 'list_created', { title }).catch(() => {})
      setModalOpen(false)
      setNewTitle('')
      setNewListDate('')
      setListType('gastos')
      navigate(`/list/${id}/${getListHomePath(listType)}`)
    } catch (err) {
      setError(err.message || 'Error al crear la lista.')
    } finally {
      setCreating(false)
    }
  }

  function handleCloseModal() {
    setModalOpen(false)
    setNewTitle('')
    setNewListDate('')
    setListType('gastos')
    setError('')
  }

  function openEditList(list) {
    setEditListId(list.id)
    setEditTitle(list.title || '')
    setEditError('')
    setPickListToEdit(false)
  }

  function handleCloseEditModal() {
    setEditListId(null)
    setEditTitle('')
    setEditError('')
    setDeleteListConfirmOpen(false)
  }

  async function handleSaveEditList(e) {
    e.preventDefault()
    const title = editTitle.trim()
    if (!title) {
      setEditError('Escribe un nombre para la lista.')
      return
    }
    if (!editListId) return
    setSavingEdit(true)
    setEditError('')
    try {
      await updateList(editListId, { title })
      handleCloseEditModal()
    } catch (err) {
      setEditError(err.message || 'Error al guardar.')
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleConfirmDeleteList() {
    if (!editListId) return
    setDeletingList(true)
    setEditError('')
    try {
      await deleteListCompletely(editListId)
      setDeleteListConfirmOpen(false)
      handleCloseEditModal()
    } catch (err) {
      setEditError(err.message || 'No se pudo eliminar la lista.')
    } finally {
      setDeletingList(false)
    }
  }

  async function handleLogout() {
    await signOut(auth)
    navigate('/login', { replace: true })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Cargando listas…</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 pb-24">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h1 className="text-xl font-semibold text-gray-900">Mis listas</h1>
        <div className="flex items-center gap-1 shrink-0">
          {hasOwnedList && (
            <button
              type="button"
              onClick={() => setPickListToEdit((v) => !v)}
              className={`p-2.5 rounded-full border ${
                pickListToEdit
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-transparent text-gray-600 hover:bg-gray-100'
              }`}
              aria-label="Editar una lista"
              title="Editar una lista"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
      {pickListToEdit && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2.5 text-sm text-primary-900">
          <p className="pt-0.5">
            Toca una lista para editarla
            {orderedLists.length > 1 ? ', o usa las flechas para subirla o bajarla en la lista.' : '.'}
          </p>
          <button
            type="button"
            onClick={() => setPickListToEdit(false)}
            className="shrink-0 font-medium text-primary-700 hover:underline"
          >
            Cancelar
          </button>
        </div>
      )}
      {lists.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          Aún no tienes listas. Pulsa el botón + para crear una.
        </p>
      ) : (
        <ul className="space-y-2">
          {orderedLists.map((list, index) => {
            const defaultPath = getListHomePath(list.listType)
            const typeLabel =
              list.listType === 'porHacer' ? 'Por hacer' : list.listType === 'compras' ? 'Compras' : 'Gastos'
            const isOwner = list.ownerId === user?.uid
            const canReorder = pickListToEdit && orderedLists.length > 1
            const isFlashing = flashListId === list.id
            return (
              <li key={list.id} className="flex gap-2 items-stretch">
                <Link
                  to={`/list/${list.id}/${defaultPath}`}
                  onClick={(e) => {
                    if (pickListToEdit && isOwner) {
                      e.preventDefault()
                      openEditList(list)
                    }
                  }}
                  className={`flex-1 min-w-0 block p-4 rounded-xl border shadow-sm transition-[background-color,border-color,box-shadow] duration-500 ease-out ${
                    isFlashing
                      ? 'bg-primary-50 border-primary-400 ring-2 ring-primary-200/70 shadow-md'
                      : 'bg-white hover:border-primary-200 active:bg-gray-50'
                  } ${
                    pickListToEdit && isOwner && !isFlashing
                      ? 'border-primary-300 ring-1 ring-primary-200 cursor-pointer'
                      : !isFlashing
                        ? 'border-gray-200'
                        : ''
                  }`}
                >
                  <span className="font-medium text-gray-900">{list.title}</span>
                  <span className="ml-2 text-xs text-gray-500">{typeLabel}</span>
                  {isOwner && (
                    <span className="ml-2 text-xs text-gray-400">(creada por ti)</span>
                  )}
                  {list.listDate && (
                    <span className="block text-xs text-gray-500 mt-1">{formatLocalDate(list.listDate)}</span>
                  )}
                </Link>
                {canReorder && (
                  <div
                    className="flex flex-col justify-center gap-0 shrink-0 py-1 pr-0.5 pl-0"
                    aria-label="Reordenar"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        void moveList(list.id, 'up')
                      }}
                      disabled={index === 0}
                      className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100/80 disabled:opacity-25 disabled:pointer-events-none transition-colors"
                      title="Subir"
                      aria-label="Subir"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        void moveList(list.id, 'down')
                      }}
                      disabled={index === orderedLists.length - 1}
                      className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100/80 disabled:opacity-25 disabled:pointer-events-none transition-colors"
                      title="Bajar"
                      aria-label="Bajar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <FAB onClick={() => setModalOpen(true)} label="Crear lista" />

      <Modal open={modalOpen} onClose={handleCloseModal} title="Nueva lista">
        <form onSubmit={handleCreateList} className="space-y-4">
          <div>
            <label htmlFor="list-title" className="block text-sm font-medium text-gray-700 mb-1">
              Título de la lista
            </label>
            <input
              id="list-title"
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder="Ej. Casa, Negocio…"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="list-new-date" className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de referencia (opcional)
            </label>
            <input
              id="list-new-date"
              type="date"
              value={newListDate}
              onChange={(e) => setNewListDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">Ej. periodo o mes al que aplica la lista.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de lista
            </label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="listType"
                  value="gastos"
                  checked={listType === 'gastos'}
                  onChange={() => setListType('gastos')}
                  className="text-primary-600 border-gray-300"
                />
                <span className="font-medium text-gray-900">Lista de Gastos</span>
                <span className="text-sm text-gray-500">Cuentas por pagar, cobrar y gastos fijos</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="listType"
                  value={LIST_TYPES.POR_HACER}
                  checked={listType === LIST_TYPES.POR_HACER}
                  onChange={() => setListType(LIST_TYPES.POR_HACER)}
                  className="text-primary-600 border-gray-300"
                />
                <span className="font-medium text-gray-900">Lista por Hacer</span>
                <span className="text-sm text-gray-500">Tareas y actividades recurrentes</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="listType"
                  value={LIST_TYPES.COMPRAS}
                  checked={listType === LIST_TYPES.COMPRAS}
                  onChange={() => setListType(LIST_TYPES.COMPRAS)}
                  className="text-primary-600 border-gray-300"
                />
                <span className="font-medium text-gray-900">Lista de compras</span>
                <span className="text-sm text-gray-500">Artículos pendientes y comprados</span>
              </label>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCloseModal}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creating}
              className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 disabled:opacity-60"
            >
              {creating ? 'Creando…' : 'Crear'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editListId} onClose={handleCloseEditModal} title="Editar nombre de la lista">
        <form onSubmit={handleSaveEditList} className="space-y-4">
          <div>
            <label htmlFor="edit-list-title" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la lista
            </label>
            <input
              id="edit-list-title"
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="Título de la lista"
              required
            />
          </div>
          {editError && <p className="text-sm text-red-600">{editError}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCloseEditModal}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingEdit}
              className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 disabled:opacity-60"
            >
              {savingEdit ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
          <div className="pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setDeleteListConfirmOpen(true)}
              className="w-full py-3 rounded-xl border border-red-200 text-red-600 font-medium hover:bg-red-50"
            >
              Eliminar lista…
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={deleteListConfirmOpen}
        onClose={() => !deletingList && setDeleteListConfirmOpen(false)}
        title="Eliminar lista"
      >
        <p className="text-gray-600 mb-4">
          ¿Seguro que quieres eliminar esta lista? Se borrarán todas las tareas, cuentas, gastos fijos y demás datos
          vinculados. Los demás miembros dejarán de verla. Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={deletingList}
            onClick={() => setDeleteListConfirmOpen(false)}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={deletingList}
            onClick={handleConfirmDeleteList}
            className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-60"
          >
            {deletingList ? 'Eliminando…' : 'Sí, eliminar'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
