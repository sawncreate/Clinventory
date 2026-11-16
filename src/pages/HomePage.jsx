import { Link } from 'react-router-dom'

const highlights = [
  { number: '01', title: 'Tampilan yang jelas', detail: 'Dibangun untuk alur kerja klinik.' },
  { number: '02', title: 'Data demo lokal', detail: 'Integrasi backend belum diaktifkan.' },
  { number: '03', title: 'Siap dikembangkan', detail: 'Fondasi React dan navigasi sudah tersedia.' },
]

export default function HomePage() {
  return (
    <div className="home-page">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="status-pill">
            <span className="status-dot" />
            TAHAP 1 · FONDASI PROJECT
          </span>
          <h1>Persediaan klinik, lebih mudah dikelola.</h1>
          <p>
            ClinicStock membantu tim klinik menyiapkan kebutuhan operasional
            dengan tampilan yang sederhana, rapi, dan mudah dipahami.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/dashboard">
              Lihat kerangka dashboard
              <span aria-hidden="true">→</span>
            </Link>
            <span className="local-note">Belum terhubung ke Supabase</span>
          </div>
        </div>

        <div className="hero-illustration" aria-hidden="true">
          <div className="illustration-orbit orbit-outer" />
          <div className="illustration-orbit orbit-inner" />
          <div className="supply-card supply-card-top">
            <span className="supply-icon supply-icon-blue">▦</span>
            <span>
              <strong>Persediaan</strong>
              <small>Lebih terorganisir</small>
            </span>
            <span className="supply-check">✓</span>
          </div>
          <div className="medical-mark">
            <span />
            <span />
          </div>
          <div className="supply-card supply-card-bottom">
            <span className="supply-icon supply-icon-green">↗</span>
            <span>
              <strong>Alur kerja</strong>
              <small>Dirancang untuk klinik</small>
            </span>
          </div>
          <span className="decor-dot dot-one" />
          <span className="decor-dot dot-two" />
        </div>
      </section>

      <section className="highlights" aria-label="Ringkasan fondasi aplikasi">
        {highlights.map((item) => (
          <article className="highlight-card" key={item.number}>
            <span className="highlight-number">{item.number}</span>
            <h2>{item.title}</h2>
            <p>{item.detail}</p>
          </article>
        ))}
      </section>

      <p className="privacy-note">
        ClinicStock hanya untuk perlengkapan dan inventaris operasional—bukan
        untuk data pasien.
      </p>
    </div>
  )
}
