import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { joinListByToken } from '../hooks/useLists'

export default function InviteLanding() {
  const { token } = useParams()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // loading | need-auth | joining | welcome | error

  useEffect(() => {
    if (!token) {
      setStatus('error')
      return
    }
    if (authLoading) return
    if (!user) {
      setStatus('need-auth')
      return
    }
    let cancelled = false
    setStatus('joining')
    joinListByToken(token, user.uid)
      .then(({ ok, listId, alreadyMember }) => {
        if (cancelled) return
        if (!ok) {
          setStatus('error')
          return
        }
        setStatus('welcome')
        const target = `/list/${listId}`
        if (alreadyMember) {
          setTimeout(() => navigate(target, { replace: true }), 1500)
        } else {
          setTimeout(() => navigate(target, { replace: true }), 2500)
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => { cancelled = true }
  }, [token, user, authLoading, navigate])

  if (authLoading || status === 'loading' || status === 'joining') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <p className="text-gray-500">Procesando invitación…</p>
      </div>
    )
  }

  if (status === 'need-auth') {
    navigate(`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`, { replace: true })
    return null
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <p className="text-gray-700 text-center">Enlace inválido o expirado.</p>
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="mt-4 text-primary-600 font-medium"
        >
          Ir a mis listas
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm text-center">
        <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">¡Bienvenido a la lista!</h1>
        <p className="text-gray-600">
          Has sido añadido a la lista. Redirigiendo…
        </p>
      </div>
    </div>
  )
}
