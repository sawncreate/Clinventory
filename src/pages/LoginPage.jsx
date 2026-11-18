import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Brand from '../components/Brand.jsx'
import FormField from '../components/FormField.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function LoginPage() {
  const { error: authError, hasAccess, isLoading, login, logout, refreshProfile, user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [formError, setFormError] = useState('')
  const [actionError, setActionError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)

  const destination = location.state?.from?.pathname || '/dashboard'

  useEffect(() => {
    if (!isLoading && hasAccess) {
      navigate(destination, { replace: true })
    }
  }, [destination, hasAccess, isLoading, navigate])

  function changeField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function submit(event) {
    event.preventDefault()
    setFormError('')
    setIsSubmitting(true)

    try {
      await login(form.email, form.password)
    } catch (error) {
      setFormError(error.message || 'Login gagal. Periksa email dan password lalu coba lagi.')
    } finally {
      setIsSubmitting(false)
    }
  }

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

  if (isLoading || hasAccess) {
    return (
      <main className="auth-page">
        <p className="auth-loading" role="status">
          {hasAccess ? 'Membuka ClinicStock...' : 'Memeriksa sesi dan profil...'}
        </p>
      </main>
    )
  }

  return (
    <main className="auth-page">
      <section className="card auth-card">
        <Brand />
        <p className="eyebrow">INVENTORY MANAGEMENT</p>
        <h1>Masuk ke ClinicStock</h1>
        <p className="auth-description">Gunakan akun ClinicStock yang telah diberikan kepada Anda.</p>

        {user ? (
          <div className="auth-account-status">
            <p className="auth-error" role="alert">
              {authError
                ? `Profil akun tidak dapat diverifikasi: ${authError}`
                : 'Akun ini tidak memiliki profil aktif dengan role Admin atau Staff.'}
            </p>
            {actionError && <p className="auth-error" role="alert">{actionError}</p>}
            <div className="auth-actions">
              {authError && (
                <button className="btn" type="button" onClick={retryProfile} disabled={isRetrying}>
                  {isRetrying ? 'Memeriksa...' : 'Coba lagi'}
                </button>
              )}
              <button className="btn btn-primary" type="button" onClick={signOut}>
                Keluar
              </button>
            </div>
          </div>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            {authError && <p className="auth-error" role="alert">{authError}</p>}
            {formError && <p className="auth-error" role="alert">{formError}</p>}
            <FormField label="Email" htmlFor="login-email" required>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                value={form.email}
                onChange={changeField}
                required
              />
            </FormField>
            <FormField label="Password" htmlFor="login-password" required>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={changeField}
                required
              />
            </FormField>
            <button className="btn btn-primary auth-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Memeriksa...' : 'Masuk'}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}
