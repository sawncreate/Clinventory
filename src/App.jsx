import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { InventoryProvider } from './context/InventoryContext.jsx'
import CategoriesPage from './pages/CategoriesPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import HomePage from './pages/HomePage.jsx'
import ItemsPage from './pages/ItemsPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import ReportsPage from './pages/ReportsPage.jsx'
import StockHistoryPage from './pages/StockHistoryPage.jsx'
import StockMovementPage from './pages/StockMovementPage.jsx'
import SuppliersPage from './pages/SuppliersPage.jsx'

function NotFoundPage() {
  return (
    <section className="card not-found">
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
    <AuthProvider>
      <InventoryProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<HomePage />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="items" element={<ItemsPage />} />
                <Route path="categories" element={<CategoriesPage />} />
                <Route path="suppliers" element={<SuppliersPage />} />
                <Route path="stock-in" element={<StockMovementPage type="IN" />} />
                <Route path="stock-out" element={<StockMovementPage type="OUT" />} />
                <Route path="stock-history" element={<StockHistoryPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </InventoryProvider>
    </AuthProvider>
  )
}
