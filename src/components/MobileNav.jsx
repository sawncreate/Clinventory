import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import Icon from './Icon.jsx'

const navigation = [
  { label: 'Dashboard', icon: 'dashboard', to: '/dashboard' },
  { label: 'Items', icon: 'items', to: '/items' },
  { label: 'Stock in', icon: 'stockin', to: '/stock-in' },
  { label: 'Stock out', icon: 'stockout', to: '/stock-out' },
]

const moreNavigation = [
  { label: 'Categories', icon: 'categories', to: '/categories' },
  { label: 'Suppliers', icon: 'suppliers', to: '/suppliers' },
  { label: 'Stock history', icon: 'history', to: '/stock-history' },
  { label: 'Reports', icon: 'reports', to: '/reports' },
]

export default function MobileNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const { pathname } = useLocation()
  const isMoreActive = moreNavigation.some((item) => item.to === pathname)

  return (
    <>
      {moreOpen && (
        <nav id="mobile-more-menu" className="mobile-more-menu" aria-label="Menu lainnya">
          {moreNavigation.map((item) => (
            <NavLink
              className={({ isActive }) => `mobile-more-item${isActive ? ' active' : ''}`}
              key={item.label}
              to={item.to}
              onClick={() => setMoreOpen(false)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
      <nav className="mobile-nav" aria-label="Navigasi mobile">
        {navigation.map((item) => (
          <NavLink
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            key={item.label}
            to={item.to}
            onClick={() => setMoreOpen(false)}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button
          className={`nav-item${isMoreActive || moreOpen ? ' active' : ''}`}
          type="button"
          aria-expanded={moreOpen}
          aria-controls="mobile-more-menu"
          onClick={() => setMoreOpen((open) => !open)}
        >
          <Icon name="more" />
          <span>More</span>
        </button>
      </nav>
    </>
  )
}
