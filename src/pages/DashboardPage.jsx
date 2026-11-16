import { Link } from 'react-router-dom'

const previewMetrics = ['Total barang', 'Total stok', 'Stok menipis']

export default function DashboardPage() {
  return (
    <section className="dashboard-page">
      <Link className="back-link" to="/">
        <span aria-hidden="true">←</span> Beranda
      </Link>
      <div className="page-heading">
        <p className="eyebrow">KERANGKA HALAMAN</p>
        <h1>Dashboard ClinicStock</h1>
        <p>
          Halaman ini adalah kerangka awal. Data inventaris dan transaksi akan
          ditambahkan pada tahap berikutnya.
        </p>
      </div>

      <div className="preview-metrics">
        {previewMetrics.map((label) => (
          <article className="preview-card" key={label}>
            <span>{label}</span>
            <strong>—</strong>
            <small>Belum ada data</small>
          </article>
        ))}
      </div>

      <div className="coming-soon-card">
        <span className="coming-soon-icon" aria-hidden="true">✦</span>
        <div>
          <h2>Fondasi sudah siap</h2>
          <p>
            React Router mengatur perpindahan halaman. Belum ada fitur stok,
            penyimpanan demo, atau koneksi Supabase pada tahap ini.
          </p>
        </div>
      </div>
    </section>
  )
}
