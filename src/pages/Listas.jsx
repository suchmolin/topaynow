import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { useLists, createList, LIST_TYPES } from '../hooks/useLists'
import { logListActivity } from '../lib/listActivity'
import Modal from '../components/Modal'
import FAB from '../components/FAB'

export default function Listas() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { lists, loading } = useLists(user?.uid)
  const [modalOpen, setModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [listType, setListType] = useState('gastos')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

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
      const id = await createList(user.uid, title, listType)
      await logListActivity(id, 'list_created', { title }).catch(() => {})
      setModalOpen(false)
      setNewTitle('')
      setListType('gastos')
      const isPorHacer = listType === 'porHacer'
      navigate(isPorHacer ? `/list/${id}/todos` : `/list/${id}/payables`)
    } catch (err) {
      setError(err.message || 'Error al crear la lista.')
    } finally {
      setCreating(false)
    }
  }

  function handleCloseModal() {
    setModalOpen(false)
    setNewTitle('')
    setListType('gastos')
    setError('')
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Mis listas</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Cerrar sesión
        </button>
      </div>
      {lists.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          Aún no tienes listas. Pulsa el botón + para crear una.
        </p>
      ) : (
        <ul className="space-y-2">
          {lists.map((list) => {
            const isPorHacer = list.listType === 'porHacer'
            const defaultPath = isPorHacer ? 'todos' : 'payables'
            return (
              <li key={list.id}>
                <Link
                  to={`/list/${list.id}/${defaultPath}`}
                  className="block p-4 rounded-xl bg-white border border-gray-200 shadow-sm hover:border-primary-200 active:bg-gray-50"
                >
                  <span className="font-medium text-gray-900">{list.title}</span>
                  <span className="ml-2 text-xs text-gray-500">
                    {isPorHacer ? 'Por hacer' : 'Gastos'}
                  </span>
                  {list.ownerId === user?.uid && (
                    <span className="ml-2 text-xs text-gray-400">(creada por ti)</span>
                  )}
                </Link>
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
    </div>
  )
}
