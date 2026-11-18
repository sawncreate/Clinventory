export default function PageHeader({ title, description, action }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="page-head-action">{action}</div>}
    </div>
  )
}
