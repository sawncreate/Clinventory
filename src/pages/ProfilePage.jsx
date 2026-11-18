import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function ProfilePage() {
  const { profile, user } = useAuth()
  const fullName = profile?.full_name?.trim() || 'Nama belum diatur'
  const email = user?.email || '—'
  const role = profile?.role === 'admin' ? 'Admin' : 'Staff'

  return (
    <>
      <PageHeader
        title="Profile"
        description="Informasi akun ClinicStock yang sedang digunakan."
      />
      <article className="card panel">
        <div className="field-grid">
          <div className="field">
            <strong>Nama lengkap</strong>
            <span>{fullName}</span>
          </div>
          <div className="field">
            <strong>Email</strong>
            <span>{email}</span>
          </div>
          <div className="field">
            <strong>Role</strong>
            <span>{role}</span>
          </div>
        </div>
      </article>
    </>
  )
}
