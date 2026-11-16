import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import Brand from './components/Brand.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import HomePage from './pages/HomePage.jsx'

function AppLayout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand />
        <nav className="topbar-nav" aria-label="Navigasi utama">
          <Link className="nav-link" to="/">
            Beranda
          </Link>
          <Link className="nav-link" to="/dashboard">
            Dashboard
          </Link>
        </nav>
      </header>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <footer className="footer">
        <span>ClinicStock</span>
        <span>Fondasi aplikasi · Tahap 1</span>
      </footer>
    </div>
  )
}

function NotFoundPage() {
  return (
    <section className="not-found">
      <p className="eyebrow">HALAMAN TIDAK DITEMUKAN</p>
      <h1>Sepertinya halaman ini belum tersedia.</h1>
      <Link className="button button-primary" to="/">
        Kembali ke beranda
      </Link>
    </section>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}
