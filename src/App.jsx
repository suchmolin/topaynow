import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { useList } from './hooks/useLists'

function ListIndexRedirect() {
  const { listId } = useParams()
  const { list, loading } = useList(listId)
  if (loading || !list) return <div className="flex justify-center py-12"><p className="text-gray-500">Cargando…</p></div>
  const isPorHacer = list.listType === 'porHacer'
  return <Navigate to={isPorHacer ? 'todos' : 'payables'} replace />
}
import Login from './pages/Login'
import Register from './pages/Register'
import Listas from './pages/Listas'
import ListLayout from './pages/ListLayout'
import Payables from './pages/Payables'
import Receivables from './pages/Receivables'
import FixedExpenses from './pages/FixedExpenses'
import Todos from './pages/Todos'
import RecurrenceTemplates from './pages/RecurrenceTemplates'
import Settings from './pages/Settings'
import InviteLanding from './pages/InviteLanding'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Cargando…</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/invite/:token" element={<InviteLanding />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Listas />
          </ProtectedRoute>
        }
      />
      <Route
        path="/list/:listId"
        element={
          <ProtectedRoute>
            <ListLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ListIndexRedirect />} />
        <Route path="payables" element={<Payables />} />
        <Route path="receivables" element={<Receivables />} />
        <Route path="fixed" element={<FixedExpenses />} />
        <Route path="todos" element={<Todos />} />
        <Route path="recurrence" element={<RecurrenceTemplates />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
