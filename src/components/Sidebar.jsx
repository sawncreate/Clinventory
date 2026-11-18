import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { listItems } from '../services/supabaseInventoryRepository.js'
import Brand from './Brand.jsx'
import Icon from './Icon.jsx'

const navigation = [
  { label: 'Dashboard', icon: 'dashboard', to: '/dashboard' },
  { label: 'Items', icon: 'items', to: '/items', showLowStock: true },
  { label: 'Categories', icon: 'categories', to: '/categories' },
  { label: 'Suppliers', icon: 'suppliers', to: '/suppliers' },
  { label: 'Stock in', icon: 'stockin', to: '/stock-in' },
  { label: 'Stock out', icon: 'stockout', to: '/stock-out' },
  { label: 'Stock history', icon: 'history', to: '/stock-history' },
  { label: 'Reports', icon: 'reports', to: '/reports' },
  { label: 'Profile', icon: 'profile' },
]

function getLowStockCount(items) {
  if (!Array.isArray(items)) {
    throw new Error('Supabase returned an invalid item result for the low-stock badge.')
  }
  return items.filter((item) => item.isActive && item.currentStock <= item.minimumStock).length
}

function getErrorMessage(error) {
  return typeof error?.message === 'string' && error.message.trim()
    ? error.message
    : 'Low-stock count is unavailable from Supabase.'
}

function NavigationItem({ item, lowStock, onRetry }) {
  const contents = (
    <>
      <Icon name={item.icon} />
      <span>{item.label}</span>
      {item.showLowStock && lowStock.status === 'loading' && (
        <span className="nav-badge" role="status" aria-label="Memuat jumlah low-stock">...</span>
      )}
      {item.showLowStock && lowStock.status === 'ready' && lowStock.count > 0 && (
        <span className="nav-badge">{lowStock.count}</span>
      )}
      {item.showLowStock && lowStock.status === 'error' && (
        <span
          className="nav-badge"
          role="status"
          aria-label={`Low-stock count unavailable. Select Items to retry. ${lowStock.error}`}
          title="Low-stock count unavailable. Select Items to retry."
        >!</span>
      )}
    </>
  )

  if (item.to) {
    return (
      <NavLink
        className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        to={item.to}
        onClick={item.showLowStock && lowStock.status === 'error' ? onRetry : undefined}
      >
        {contents}
      </NavLink>
    )
  }

  return (
    <span className="nav-item nav-item-disabled" aria-disabled="true">
      {contents}
    </span>
  )
}

export default function Sidebar() {
  const { profile, user } = useAuth()
  const [lowStock, setLowStock] = useState({ status: 'loading', count: null, error: '' })
  const [retryCount, setRetryCount] = useState(0)
  const lowStockRequest = useRef({ retryCount: -1, promise: null })
  const displayName = profile.full_name?.trim() || user.email || 'ClinicStock user'
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const roleLabel = profile.role === 'admin' ? 'Admin' : 'Staff'

  useEffect(() => {
    let isCurrent = true
    setLowStock({ status: 'loading', count: null, error: '' })

    async function loadLowStock() {
      try {
        if (lowStockRequest.current.retryCount !== retryCount) {
          lowStockRequest.current = {
            retryCount,
            promise: listItems({ activeOnly: true }),
          }
        }
        const items = await lowStockRequest.current.promise
        const count = getLowStockCount(items)
        if (isCurrent) setLowStock({ status: 'ready', count, error: '' })
      } catch (error) {
        if (isCurrent) {
          setLowStock({ status: 'error', count: null, error: getErrorMessage(error) })
        }
      }
    }

    void loadLowStock()
    return () => {
      isCurrent = false
    }
  }, [retryCount])

  function retryLowStock() {
    setLowStock({ status: 'loading', count: null, error: '' })
    setRetryCount((current) => current + 1)
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Brand />
      </div>
      <div className="nav-label">WORKSPACE</div>
      <nav className="nav-list" aria-label="Navigasi inventaris">
        {navigation.map((item) => (
          <NavigationItem item={item} key={item.label} lowStock={lowStock} onRetry={retryLowStock} />
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="help-card">
          <strong>Need a hand?</strong>
          <p>Keep clinic supplies organized and ready when needed.</p>
          <span>ClinicStock inventory</span>
        </div>
        <div className="user-mini">
          <div className="avatar" aria-hidden="true">{initials}</div>
          <div>
            <div className="user-name">{displayName}</div>
            <div className="user-role">{roleLabel}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
