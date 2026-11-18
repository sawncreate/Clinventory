export default function FormField({ label, htmlFor, required = false, hint, children }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>
        {label}{required && ' *'}
      </label>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  )
}
