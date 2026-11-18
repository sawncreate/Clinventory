import Icon from './Icon.jsx'

export default function StatCard({
  title,
  value,
  note,
  icon,
  tone = 'blue',
  noteTone,
}) {
  return (
    <article className="card metric">
      <div className="metric-top">
        {title}
        <span className={`metric-icon metric-icon-${tone}`}>
          <Icon name={icon} />
        </span>
      </div>
      <div className="metric-value">{value}</div>
      <div className={`metric-foot${noteTone ? ` metric-foot-${noteTone}` : ''}`}>
        {note}
      </div>
    </article>
  )
}
