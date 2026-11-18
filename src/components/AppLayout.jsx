import { Outlet } from 'react-router-dom'
import MobileNav from './MobileNav.jsx'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'

export default function AppLayout() {
  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <Topbar />
        <section className="content">
          <Outlet />
        </section>
      </main>
      <MobileNav />
    </div>
  )
}
