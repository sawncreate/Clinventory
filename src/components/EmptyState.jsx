export default function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state">
      <span className="empty-state-mark" aria-hidden="true">⌕</span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action}
    </div>
  )
}
