import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useInventory } from '../context/InventoryContext.jsx'
import Icon from './Icon.jsx'

const pageNames = {
  '/': 'Home',
  '/dashboard': 'Dashboard',
  '/items': 'Items',
  '/categories': 'Categories',
  '/suppliers': 'Suppliers',
  '/stock-in': 'Stock In',
  '/stock-out': 'Stock Out',
  '/stock-history': 'Stock History',
  '/reports': 'Reports',
}

export default function Topbar() {
  const { pathname } = useLocation()
  const pageName = pageNames[pathname] || 'ClinicStock'
  const { logout, profile, user } = useAuth()
  const { notify } = useInventory()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const displayName = profile.full_name?.trim() || user.email || 'ClinicStock user'
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const roleLabel = profile.role === 'admin' ? 'Admin' : 'Staff'

  async function handleLogout() {
    setIsLoggingOut(true)
    try {
      await logout()
    } catch (error) {
      notify(error.message || 'Tidak dapat logout. Silakan coba lagi.', 'error')
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <header className="topbar">
      <div className="breadcrumb">
        <Link className="breadcrumb-home" to="/">ClinicStock</Link>
        <span aria-hidden="true">/</span> <strong>{pageName}</strong>
      </div>
      <div className="top-actions">
        <span className="icon-btn notification-icon" aria-label="Notifications">
          <Icon name="bell" />
          <i className="notification-dot" />
        </span>
        <div className="top-user">
          <div className="avatar" aria-hidden="true">{initials}</div>
          <div className="top-user-info">
            {displayName}
            <span>{roleLabel}</span>
          </div>
        </div>
        <button className="btn logout-button" type="button" onClick={handleLogout} disabled={isLoggingOut}>
          {isLoggingOut ? 'Keluar...' : 'Keluar'}
        </button>
      </div>
    </header>
  )
}
