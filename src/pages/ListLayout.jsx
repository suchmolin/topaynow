import { Outlet, useParams, Navigate, Link } from 'react-router-dom'
import { useList } from '../hooks/useLists'
import BottomNav from '../components/BottomNav'

export default function ListLayout() {
  const { listId } = useParams()
  const { list, loading } = useList(listId)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-gray-500">Cargando…</p>
      </div>
    )
  }
  if (!list) {
    return <Navigate to="/" replace />
  }

  return (
    <>
      <header className="sticky top-0 z-10 bg-surface-50/95 backdrop-blur border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link
          to="/"
          className="shrink-0 p-2 -m-2 rounded-full text-gray-600 hover:bg-gray-100 active:bg-gray-200"
          aria-label="Volver a mis listas"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-lg font-semibold text-gray-900 truncate min-w-0 flex-1">{list.title}</h1>
      </header>
      <Outlet />
      <BottomNav listId={listId} />
    </>
  )
}
