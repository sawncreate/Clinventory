import { Link } from 'react-router-dom'

export default function Brand() {
  return (
    <Link className="brand" to="/" aria-label="ClinicStock beranda">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2.5"
          />
        </svg>
      </span>
      <span className="brand-copy">
        <span className="brand-name">ClinicStock</span>
        <span className="brand-caption">Inventory management</span>
      </span>
    </Link>
  )
}
