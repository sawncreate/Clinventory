const variants = {
  'In stock': 'pill-green',
  'Low stock': 'pill-red',
  'Stock in': 'pill-blue',
  'Stock out': 'pill-amber',
}

export default function StatusBadge({ children }) {
  return <span className={`pill ${variants[children] || 'pill-blue'}`}>{children}</span>
}
