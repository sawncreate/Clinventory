import { useEffect, useState } from 'react'
import DataTable from './DataTable.jsx'
import EmptyState from './EmptyState.jsx'

function getErrorMessage(error) {
  return typeof error?.message === 'string' && error.message.trim()
    ? error.message
    : 'Data Supabase tidak dapat dimuat. Silakan coba lagi.'
}

export default function SupabaseReadOnlyPanel({
  title,
  description,
  emptyTitle,
  emptyDescription,
  countLabel,
  loadRows,
  columns,
}) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ status: 'loading', rows: [], error: '' })

  useEffect(() => {
    let isCurrent = true
    setState({ status: 'loading', rows: [], error: '' })

    async function fetchRows() {
      try {
        const rows = await loadRows()
        if (!Array.isArray(rows)) {
          throw new Error('Supabase returned an invalid inventory result.')
        }
        if (isCurrent) setState({ status: 'ready', rows, error: '' })
      } catch (error) {
        if (isCurrent) setState({ status: 'error', rows: [], error: getErrorMessage(error) })
      }
    }

    void fetchRows()
    return () => {
      isCurrent = false
    }
  }, [attempt, loadRows])

  return (
    <article className="card list-card supabase-readonly-card">
      <div className="table-title">
        <div>
          <h2>{title} — Supabase (read-only)</h2>
          <div className="panel-sub">{description}</div>
        </div>
      </div>

      {state.status === 'loading' && (
        <p className="supabase-readonly-state" role="status">Memuat data Supabase...</p>
      )}

      {state.status === 'error' && (
        <div className="supabase-readonly-error" role="alert">
          <p>{state.error}</p>
          <button className="btn" type="button" onClick={() => setAttempt((current) => current + 1)}>
            Coba lagi
          </button>
        </div>
      )}

      {state.status === 'ready' && (
        state.rows.length
          ? <DataTable columns={columns} rows={state.rows} rowKey="id" />
          : <EmptyState title={emptyTitle} description={emptyDescription} />
      )}

      {state.status === 'ready' && (
        <div className="table-footer">{state.rows.length} {countLabel} dari Supabase</div>
      )}
    </article>
  )
}
