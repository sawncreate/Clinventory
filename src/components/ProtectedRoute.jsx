import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function ProtectedRoute() {
  const { error, hasAccess, isLoading, logout, refreshProfile, user } = useAuth()
  const location = useLocation()
  const [isRetrying, setIsRetrying] = useState(false)
  const [actionError, setActionError] = useState('')

  async function retryProfile() {
    setIsRetrying(true)
    setActionError('')
    await refreshProfile()
    setIsRetrying(false)
  }

  async function signOut() {
    setActionError('')
    try {
      await logout()
    } catch (error) {
      setActionError(error.message || 'Tidak dapat logout. Silakan coba lagi.')
    }
  }

  if (isLoading) {
    return (
      <main className="auth-page">
        <p className="auth-loading" role="status">Memeriksa sesi dan profil...</p>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!hasAccess) {
    return (
      <main className="auth-page">
        <section className="card auth-card access-card">
          <p className="eyebrow">AKSES DIBATASI</p>
          <h1>Profil tidak dapat mengakses ClinicStock.</h1>
          <p className="auth-description">
            {error
              ? `Profil akun tidak dapat diverifikasi: ${error}`
              : 'Akun ini tidak memiliki profil aktif dengan role Admin atau Staff.'}
          </p>
          {actionError && <p className="auth-error" role="alert">{actionError}</p>}
          <div className="auth-actions">
            {error && (
              <button className="btn" type="button" onClick={retryProfile} disabled={isRetrying}>
                {isRetrying ? 'Memeriksa...' : 'Coba lagi'}
              </button>
            )}
            <button className="btn btn-primary" type="button" onClick={signOut}>
              Keluar
            </button>
          </div>
        </section>
      </main>
    )
  }

  return <Outlet />
}
