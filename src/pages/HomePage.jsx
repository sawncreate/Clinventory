import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'

const highlights = [
  { number: '01', title: 'Inventory at a glance', detail: 'Keep essential clinic supplies organized.' },
  { number: '02', title: 'Clear stock activity', detail: 'Make day-to-day inventory easier to follow.' },
  { number: '03', title: 'Designed for your team', detail: 'A simple workspace for clinic staff.' },
]

export default function HomePage() {
  return (
    <>
      <PageHeader
        title="Welcome to ClinicStock 👋"
        description="A clear, simple workspace for managing your clinic's operational inventory."
      />
      <section className="card home-card">
        <div className="home-card-mark" aria-hidden="true">+</div>
        <div className="home-card-copy">
          <span className="eyebrow">INVENTORY MANAGEMENT</span>
          <h2>Everything your clinic needs, in stock.</h2>
          <p>
            ClinicStock brings supplies, equipment, and everyday essentials
            together in one approachable workspace.
          </p>
          <Link className="btn btn-primary" to="/dashboard">
            Open dashboard <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
      <section className="home-highlights" aria-label="ClinicStock overview">
        {highlights.map((item) => (
          <article className="card highlight-card" key={item.number}>
            <span className="highlight-number">{item.number}</span>
            <h2>{item.title}</h2>
            <p>{item.detail}</p>
          </article>
        ))}
      </section>
      <p className="home-footnote">
        Built for operational supplies and equipment—not patient or medical records.
      </p>
    </>
  )
}
