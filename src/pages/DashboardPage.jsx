import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DataTable from '../components/DataTable.jsx'
import EmptyState from '../components/EmptyState.jsx'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import {
  listCategories,
  listItems,
  listStockMovements,
  listSuppliers,
} from '../services/supabaseInventoryRepository.js'

const MOVEMENT_PAGE_SIZE = 500

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getLastSevenCalendarDays(now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - index))
    return {
      date: localDateKey(date),
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
    }
  })
}

async function loadMovementsForDateRange(startDate, endDate) {
  const movements = []
  let offset = 0

  while (true) {
    const page = await listStockMovements({
      startDate,
      endDate,
      offset,
      limit: MOVEMENT_PAGE_SIZE,
    })
    if (!Array.isArray(page?.rows)) {
      throw new Error('Supabase returned an invalid stock movement result.')
    }

    movements.push(...page.rows)
    if (page.nextOffset === null) return movements
    if (!Number.isSafeInteger(page.nextOffset) || page.nextOffset <= offset) {
      throw new Error('Supabase returned an invalid stock movement page offset.')
    }
    offset = page.nextOffset
  }
}

function getDailyTotals(days, movements) {
  const totalsByDate = new Map(days.map((day) => [
    day.date,
    { ...day, incoming: 0, outgoing: 0 },
  ]))

  movements.forEach((movement) => {
    const day = totalsByDate.get(movement.transactionDate)
    if (!day) return
    if (movement.type === 'IN') day.incoming += movement.quantity
    if (movement.type === 'OUT') day.outgoing += movement.quantity
  })

  return [...totalsByDate.values()]
}

function StockChart({ daily }) {
  const maxValue = Math.max(1, ...daily.flatMap((day) => [day.incoming, day.outgoing]))

  return (
    <div className="chart-wrap">
      <svg viewBox="0 0 660 185" preserveAspectRatio="none" role="img" aria-label="Stock In and Stock Out totals by day">
        {[30, 70, 110, 150].map((y) => (
          <line key={y} x1="25" y1={y} x2="650" y2={y} stroke="#edf1f4" strokeDasharray="3 5" />
        ))}
        {daily.map((day, index) => {
          const x = 43 + index * 89
          const inHeight = day.incoming / maxValue * 120
          const outHeight = day.outgoing / maxValue * 120
          return (
            <g key={`${day.label}-${index}`}>
              <rect x={x} y={155 - inHeight} width="20" height={inHeight} rx="4" fill="#3577b7" />
              <rect x={x + 24} y={155 - outHeight} width="20" height={outHeight} rx="4" fill="#a9c8e3" />
            </g>
          )
        })}
      </svg>
      <div className="chart-labels">{daily.map((day, index) => <span key={`${day.label}-${index}`}>{day.label}</span>)}</div>
    </div>
  )
}

function getErrorMessage(error) {
  return typeof error?.message === 'string' && error.message.trim()
    ? error.message
    : 'Dashboard tidak dapat dimuat dari Supabase. Silakan coba lagi.'
}

function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
}

export default function DashboardPage() {
  const { profile } = useAuth()
  const displayName = profile?.full_name?.trim() || 'Pengguna'
  const [dashboard, setDashboard] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let isCurrent = true
    setDashboard(null)
    setStatus('loading')
    setError('')

    async function loadDashboard() {
      try {
        const days = getLastSevenCalendarDays()
        const [itemRows, categoryRows, supplierRows, recentResult, chartMovements] = await Promise.all([
          listItems({ activeOnly: true }),
          listCategories(),
          listSuppliers({ activeOnly: true }),
          listStockMovements({ limit: 5 }),
          loadMovementsForDateRange(days[0].date, days[days.length - 1].date),
        ])

        if (
          !Array.isArray(itemRows)
          || !Array.isArray(categoryRows)
          || !Array.isArray(supplierRows)
          || !Array.isArray(recentResult?.rows)
        ) {
          throw new Error('Supabase returned an invalid Dashboard result.')
        }

        const activeItems = itemRows.filter((item) => item.isActive)
        const activeCategories = categoryRows.filter((category) => category.isActive)
        const activeSuppliers = supplierRows.filter((supplier) => supplier.isActive)
        const lowStockItems = activeItems.filter((item) => item.currentStock <= item.minimumStock)

        if (isCurrent) {
          setDashboard({
            totalItems: activeItems.length,
            totalStock: activeItems.reduce((total, item) => total + item.currentStock, 0),
            totalCategories: activeCategories.length,
            totalSuppliers: activeSuppliers.length,
            lowStockItems,
            categories: categoryRows,
            dailyMovements: getDailyTotals(days, chartMovements),
            recentMovements: recentResult.rows.slice(0, 5),
          })
          setStatus('ready')
        }
      } catch (loadError) {
        if (isCurrent) {
          setError(getErrorMessage(loadError))
          setStatus('error')
        }
      }
    }

    void loadDashboard()
    return () => {
      isCurrent = false
    }
  }, [attempt])

  const lowStockItems = dashboard?.lowStockItems.slice(0, 5) || []
  const movementColumns = [
    {
      key: 'name',
      label: 'Item',
      render: (movement) => {
        return (
          <div className="item-cell">
            <div className="item-thumb">📦</div>
            <div>
              <div className="item-title">{movement.itemName}</div>
              <div className="item-code">{movement.itemSku}</div>
            </div>
          </div>
        )
      },
    },
    { key: 'type', label: 'Type', render: (movement) => <StatusBadge>{movement.type === 'IN' ? 'Stock in' : 'Stock out'}</StatusBadge> },
    { key: 'quantity', label: 'Quantity', render: (movement) => `${movement.type === 'IN' ? '+' : '−'}${movement.quantity}${movement.itemUnit ? ` ${movement.itemUnit}` : ''}` },
    { key: 'transactionDate', label: 'Date', render: (movement) => formatDate(movement.transactionDate) },
    { key: 'createdBy', label: 'Created by' },
  ]

  return (
    <>
      <PageHeader
        title={`Good morning, ${displayName} 👋`}
        description="Ringkasan kondisi persediaan klinik dari Supabase."
      />
      {status === 'loading' && (
        <p className="supabase-readonly-state" role="status">Memuat ringkasan Dashboard dari Supabase...</p>
      )}
      {status === 'error' && (
        <div className="supabase-readonly-error" role="alert">
          <p>{error}</p>
          <button className="btn" type="button" onClick={() => setAttempt((current) => current + 1)}>
            Coba lagi
          </button>
        </div>
      )}
      {status === 'ready' && dashboard && (
        <>
          <section className="metrics metrics-five" aria-label="Inventory summary">
            <StatCard title="Total items" value={dashboard.totalItems} note="Active inventory items" icon="box" />
            <StatCard
              title="Total stock quantity"
              value={dashboard.totalStock}
              note="Combined quantities; item units differ"
              icon="items"
            />
            <StatCard title="Categories" value={dashboard.totalCategories} note="Active inventory groups" icon="categories" />
            <StatCard title="Suppliers" value={dashboard.totalSuppliers} note="Active supply partners" icon="users" />
            <StatCard
              title="Low stock items"
              value={dashboard.lowStockItems.length}
              note="Needs your attention"
              icon="alert"
              tone="amber"
              noteTone="attention"
            />
          </section>

          <section className="dashboard-grid">
            <article className="card panel">
              <div className="panel-head">
                <div>
                  <h2>Stock overview</h2>
                  <div className="panel-sub">Recorded stock movements by day · last 7 calendar days</div>
                </div>
                <div className="chart-legend">
                  <span><i className="legend-dot legend-in" />Stock in</span>
                  <span><i className="legend-dot legend-out" />Stock out</span>
                </div>
              </div>
              {!dashboard.dailyMovements.some((day) => day.incoming || day.outgoing) && (
                <p className="panel-sub">No stock movements in the last seven days.</p>
              )}
              <StockChart daily={dashboard.dailyMovements} />
            </article>

            <article className="card panel">
              <div className="panel-head">
                <div>
                  <h2>Low stock alerts</h2>
                  <div className="panel-sub">{dashboard.lowStockItems.length} active items at or below minimum</div>
                </div>
                <Link className="text-link" to="/items">View all</Link>
              </div>
              {lowStockItems.length ? (
                <div className="stock-alert-list">
                  {lowStockItems.map((item) => {
                    const category = dashboard.categories.find((entry) => entry.id === item.categoryId)
                    return (
                      <div className="alert-row" key={item.id}>
                        <div className="item-thumb">{item.icon}</div>
                        <div className="alert-info">
                          <div className="alert-name">{item.name}</div>
                          <div className="alert-cat">{category?.name || 'Uncategorized'}</div>
                        </div>
                        <div className="alert-qty">
                          {item.currentStock} {item.unit}
                          <small>Min. {item.minimumStock}</small>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <EmptyState
                  title={dashboard.totalItems ? 'All stock levels look good' : 'No active items'}
                  description={dashboard.totalItems
                    ? 'No active items are at or below minimum.'
                    : 'Active items from Supabase will appear here.'}
                />
              )}
            </article>
          </section>

          <article className="card table-card">
            <div className="table-title">
              <div>
                <h2>Recent transactions</h2>
                <div className="panel-sub">Latest recorded inventory activity</div>
              </div>
              <Link className="text-link" to="/stock-history">View history →</Link>
            </div>
            {dashboard.recentMovements.length
              ? <DataTable columns={movementColumns} rows={dashboard.recentMovements} rowKey="id" />
              : <EmptyState title="Belum ada transaksi" description="Transaksi Supabase akan muncul di sini." />}
          </article>
        </>
      )}
    </>
  )
}
