import { useState } from 'react'
import { useParams, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useList, updateList, getOrCreateInviteToken, removeMemberFromList, deleteListCompletely } from '../hooks/useLists'
import { useUserProfile } from '../hooks/useUserProfile'
import { useListActivity, ACTION_LABELS } from '../lib/listActivity'
import { formatLocalDate } from '../lib/dateUtils'
import Modal from '../components/Modal'

function MemberRow({ memberId, onRemove }) {
  const { profile, loading } = useUserProfile(memberId)
  const display = profile?.displayName || profile?.email || (memberId ? `${memberId.slice(0, 8)}…` : '—')
  return (
    <li className="flex items-center justify-between gap-3 p-4">
      <span className="text-gray-700 truncate text-sm" title={profile?.email || memberId}>
        {loading ? '…' : display}
      </span>
      <button
        type="button"
        onClick={() => onRemove(memberId)}
        className="shrink-0 py-2 px-3 rounded-lg text-red-600 text-sm font-medium hover:bg-red-50"
      >
        Quitar
      </button>
    </li>
  )
}

export default function Settings() {
  const { listId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { list, loading } = useList(listId)
  const [editOpen, setEditOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [linkLoading, setLinkLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [removeMemberId, setRemoveMemberId] = useState(null)
  const [removing, setRemoving] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [deleteListOpen, setDeleteListOpen] = useState(false)
  const [deletingList, setDeletingList] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const isOwner = list?.ownerId === user?.uid
  const { items: activityItems, loading: activityLoading } = useListActivity(historyOpen ? listId : null)
  const invitedMemberIds = (list?.memberIds || []).filter((id) => id !== list?.ownerId)

  async function handleSaveTitle(e) {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) return
    setSaving(true)
    try {
      await updateList(listId, { title })
      setEditOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteList() {
    setDeletingList(true)
    setDeleteError('')
    try {
      await deleteListCompletely(listId)
      setDeleteListOpen(false)
      navigate('/', { replace: true })
    } catch (err) {
      setDeleteError(err.message || 'No se pudo eliminar la lista.')
    } finally {
      setDeletingList(false)
    }
  }

  async function handleGetInviteLink() {
    setLinkLoading(true)
    try {
      const token = await getOrCreateInviteToken(listId, user.uid)
      const url = `${window.location.origin}/invite/${token}`
      setInviteLink(url)
    } finally {
      setLinkLoading(false)
    }
  }

  function copyLink() {
    if (!inviteLink) return
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading || !list) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Cargando…</p>
      </div>
    )
  }

  if (!isOwner) {
    const defaultPath = list.listType === 'porHacer' ? 'todos' : 'payables'
    return <Navigate to={`/list/${listId}/${defaultPath}`} replace />
  }

  async function handleRemoveMember() {
    if (!removeMemberId) return
    setRemoving(true)
    try {
      await removeMemberFromList(listId, removeMemberId, list.memberIds)
      setRemoveMemberId(null)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="px-4 py-4 pb-28">
      <div className="space-y-6">
        <section>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Lista</h2>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="font-medium text-gray-900 mb-1">{list.title}</p>
            {isOwner && (
              <button
                type="button"
                onClick={() => {
                  setEditOpen(true)
                  setNewTitle(list.title)
                }}
                className="text-sm text-primary-600 font-medium hover:underline"
              >
                Editar nombre
              </button>
            )}
            {list.listDate && (
              <p className="text-sm text-gray-500 mt-1">Fecha: {formatLocalDate(list.listDate)}</p>
            )}
          </div>
        </section>
        {isOwner && (
          <section>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Zona de peligro</h2>
            <div className="bg-white rounded-xl border border-red-200 p-4">
              <p className="text-sm text-gray-600 mb-3">
                Eliminar la lista borra todos los datos asociados (tareas, gastos, plantillas, historial, etc.).
                Los invitados dejarán de verla. No se puede deshacer.
              </p>
              <button
                type="button"
                onClick={() => setDeleteListOpen(true)}
                className="w-full py-3 rounded-xl border border-red-300 text-red-600 font-medium hover:bg-red-50"
              >
                Eliminar lista…
              </button>
            </div>
          </section>
        )}
        {isOwner && (
          <section>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Invitar a la lista</h2>
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <p className="text-sm text-gray-600">
                Genera un enlace para invitar a otra persona. Al abrirlo deberá iniciar sesión y quedará añadido a la lista.
              </p>
              {!inviteLink ? (
                <button
                  type="button"
                  onClick={handleGetInviteLink}
                  disabled={linkLoading}
                  className="w-full py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 disabled:opacity-60"
                >
                  {linkLoading ? 'Generando…' : 'Generar enlace de invitación'}
                </button>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    readOnly
                    value={inviteLink}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700"
                  />
                  <button
                    type="button"
                    onClick={copyLink}
                    className="w-full py-2 rounded-xl border border-primary-500 text-primary-600 font-medium hover:bg-primary-50"
                  >
                    {copied ? 'Copiado' : 'Copiar enlace'}
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Historial</h2>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-600 mb-3">Revisa las últimas acciones realizadas en esta lista.</p>
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="w-full py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
            >
              Ver historial de la lista
            </button>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Invitados en la lista</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {invitedMemberIds.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">Aún no hay invitados. Comparte el enlace de invitación para añadir a alguien.</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {invitedMemberIds.map((memberId) => (
                  <MemberRow key={memberId} memberId={memberId} onRemove={setRemoveMemberId} />
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar nombre de la lista">
        <form onSubmit={handleSaveTitle} className="space-y-4">
          <div>
            <label htmlFor="settings-list-title" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la lista
            </label>
            <input
              id="settings-list-title"
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="Título de la lista"
              required
            />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setEditOpen(false)} className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 disabled:opacity-60">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={deleteListOpen} onClose={() => !deletingList && setDeleteListOpen(false)} title="Eliminar lista">
        <p className="text-gray-600 mb-4">
          ¿Seguro que quieres eliminar esta lista? Se borrarán todas las tareas, cuentas, gastos fijos, plantillas y
          historial. Los demás miembros dejarán de verla. Esta acción no se puede deshacer.
        </p>
        {deleteError && <p className="text-sm text-red-600 mb-4">{deleteError}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            disabled={deletingList}
            onClick={() => setDeleteListOpen(false)}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={deletingList}
            onClick={handleDeleteList}
            className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-60"
          >
            {deletingList ? 'Eliminando…' : 'Sí, eliminar'}
          </button>
        </div>
      </Modal>

      <Modal open={!!removeMemberId} onClose={() => setRemoveMemberId(null)} title="Quitar invitado">
        <p className="text-gray-600 mb-4">
          ¿Quitar a este usuario de la lista? Ya no podrá ver ni editar esta lista.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setRemoveMemberId(null)}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleRemoveMember}
            disabled={removing}
            className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-60"
          >
            {removing ? 'Quitando…' : 'Quitar'}
          </button>
        </div>
      </Modal>

      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title="Historial de la lista" className="max-h-[85vh]">
        <div className="max-h-[60vh] overflow-y-auto -m-4 p-4">
          {activityLoading ? (
            <p className="text-gray-500 text-center py-6">Cargando historial…</p>
          ) : activityItems.length === 0 ? (
            <p className="text-gray-500 text-center py-6">Aún no hay actividad en esta lista.</p>
          ) : (
            <ul className="space-y-4">
              {activityItems.map((entry) => {
                const who = entry.userDisplayName || entry.userEmail || entry.userId?.slice(0, 8) + '…' || '—'
                const actionLabel = ACTION_LABELS[entry.action] || entry.action
                const detail =
                  entry.details?.title ||
                  entry.details?.newTitle ||
                  (entry.details?.listDate != null ? formatLocalDate(entry.details.listDate) : null)
                const dateStr = entry.createdAt
                  ? new Date(entry.createdAt).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })
                  : '—'
                return (
                  <li key={entry.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                    <p className="text-gray-900 text-sm font-medium">{who}</p>
                    <p className="text-gray-600 text-sm">
                      {actionLabel}
                      {detail && <span className="text-gray-800"> «{detail}»</span>}
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5">{dateStr}</p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Modal>
    </div>
  )
}
