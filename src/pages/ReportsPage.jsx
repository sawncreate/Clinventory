import { useEffect, useMemo, useState } from 'react'
import DataTable from '../components/DataTable.jsx'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { listItems, listStockMovements } from '../services/supabaseInventoryRepository.js'

const MOVEMENT_PAGE_SIZE = 500

async function listAllStockMovements(filters) {
  const rows = []
  const movementIds = new Set()
  let offset = 0

  while (true) {
    const page = await listStockMovements({
      ...filters,
      offset,
      limit: MOVEMENT_PAGE_SIZE,
    })

    if (!Array.isArray(page?.rows)) {
      throw new Error('Supabase returned an invalid stock movement result.')
    }

    page.rows.forEach((movement) => {
      if (!movement || typeof movement.id !== 'string') {
        throw new Error('Supabase returned a stock movement without a valid ID.')
      }
      if (movementIds.has(movement.id)) return
      movementIds.add(movement.id)
      rows.push(movement)
    })

    if (page.nextOffset === null) return rows
    if (
      !Number.isSafeInteger(page.nextOffset)
      || page.nextOffset <= offset
      || page.nextOffset !== offset + page.rows.length
    ) {
      throw new Error('Supabase returned an invalid stock movement page offset.')
    }
    offset = page.nextOffset
  }
}

function getErrorMessage(error, fallback) {
  return typeof error?.message === 'string' && error.message.trim()
    ? error.message
    : fallback
}

export default function ReportsPage() {
  const [items, setItems] = useState(null)
  const [itemsStatus, setItemsStatus] = useState('loading')
  const [itemsError, setItemsError] = useState('')
  const [itemsAttempt, setItemsAttempt] = useState(0)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [itemId, setItemId] = useState('ALL')
  const [type, setType] = useState('ALL')
  const [movements, setMovements] = useState(null)
  const [movementsStatus, setMovementsStatus] = useState('loading')
  const [movementsError, setMovementsError] = useState('')
  const [movementsAttempt, setMovementsAttempt] = useState(0)

  useEffect(() => {
    let isCurrent = true
    setItems(null)
    setItemsError('')
    setItemsStatus('loading')

    async function loadItems() {
      try {
        const result = await listItems()
        if (!Array.isArray(result)) {
          throw new Error('Supabase returned an invalid item result.')
        }
        if (isCurrent) {
          setItems(result)
          setItemsStatus('ready')
        }
      } catch (loadError) {
        if (isCurrent) {
          setItemsError(getErrorMessage(loadError, 'Daftar barang tidak dapat dimuat dari Supabase.'))
          setItemsStatus('error')
        }
      }
    }

    void loadItems()
    return () => {
      isCurrent = false
    }
  }, [itemsAttempt])

  useEffect(() => {
    let isCurrent = true
    setMovements(null)
    setMovementsError('')

    if (startDate && endDate && startDate > endDate) {
      setMovementsError('Tanggal awal tidak boleh lebih akhir daripada tanggal akhir.')
      setMovementsStatus('invalid')
      return () => {
        isCurrent = false
      }
    }

    setMovementsStatus('loading')

    async function loadMovements() {
      try {
        const result = await listAllStockMovements({
          itemId: itemId === 'ALL' ? '' : itemId,
          type,
          startDate,
          endDate,
        })
        if (isCurrent) {
          setMovements(result)
          setMovementsStatus('ready')
        }
      } catch (loadError) {
        if (isCurrent) {
          setMovementsError(getErrorMessage(loadError, 'Laporan transaksi tidak dapat dimuat dari Supabase.'))
          setMovementsStatus('error')
        }
      }
    }

    void loadMovements()
    return () => {
      isCurrent = false
    }
  }, [endDate, itemId, movementsAttempt, startDate, type])

  const activeItems = useMemo(
    () => (items || []).filter((item) => item.isActive),
    [items],
  )
  const filteredLowStock = useMemo(
    () => activeItems.filter((item) => item.currentStock <= item.minimumStock),
    [activeItems],
  )
  const summary = useMemo(() => {
    if (!movements) return null
    return movements.reduce((result, movement) => {
      if (movement.type === 'IN') result.stockIn += movement.quantity
      if (movement.type === 'OUT') result.stockOut += movement.quantity
      result.transactions += 1
      return result
    }, { stockIn: 0, stockOut: 0, transactions: 0 })
  }, [movements])

  const movementColumns = [
    { key: 'itemName', label: 'Item' },
    { key: 'type', label: 'Type', render: (movement) => <StatusBadge>{movement.type === 'IN' ? 'Stock in' : 'Stock out'}</StatusBadge> },
    { key: 'quantity', label: 'Quantity' },
    { key: 'transactionDate', label: 'Date' },
    { key: 'createdBy', label: 'Created by' },
  ]
  const stockColumns = [
    { key: 'name', label: 'Item' },
    { key: 'sku', label: 'Code' },
    {
      key: 'currentStock',
      label: 'Current stock',
      render: (item) => `${item.currentStock} ${item.unit}`,
    },
    {
      key: 'minimumStock',
      label: 'Minimum',
      render: (item) => `${item.minimumStock} ${item.unit}`,
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => <StatusBadge>{item.currentStock <= item.minimumStock ? 'Low stock' : 'In stock'}</StatusBadge>,
    },
  ]

  function resetFilters() {
    setStartDate('')
    setEndDate('')
    setItemId('ALL')
    setType('ALL')
  }

  return (
    <>
      <PageHeader title="Reports" description="Ringkasan stok dan transaksi untuk periode yang dipilih." />
      <div className="toolbar report-filters">
        <div className="filters">
          <label className="filter-field">
            Dari <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label className="filter-field">
            Sampai <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
          <select
            aria-label="Filter barang"
            value={itemId}
            disabled={itemsStatus !== 'ready'}
            onChange={(event) => setItemId(event.target.value)}
          >
            <option value="ALL">All items</option>
            {(items || []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}{item.isActive ? '' : ' — archived'}
              </option>
            ))}
          </select>
          <select aria-label="Filter tipe transaksi" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="ALL">All types</option>
            <option value="IN">Stock In</option>
            <option value="OUT">Stock Out</option>
          </select>
          <button className="btn" type="button" onClick={resetFilters}>Reset</button>
        </div>
      </div>

      {itemsStatus === 'loading' && (
        <p className="supabase-readonly-state" role="status">Memuat item dari Supabase...</p>
      )}
      {itemsStatus === 'error' && (
        <div className="supabase-readonly-error" role="alert">
          <p>{itemsError}</p>
          <button className="btn" type="button" onClick={() => setItemsAttempt((current) => current + 1)}>
            Coba lagi
          </button>
        </div>
      )}
      {movementsStatus === 'loading' && (
        <p className="supabase-readonly-state" role="status">Memuat seluruh transaksi dari Supabase...</p>
      )}
      {(movementsStatus === 'error' || movementsStatus === 'invalid') && (
        <div className="supabase-readonly-error" role="alert">
          <p>{movementsError}</p>
          {movementsStatus === 'error' && (
            <button className="btn" type="button" onClick={() => setMovementsAttempt((current) => current + 1)}>
              Coba lagi
            </button>
          )}
        </div>
      )}

      <section className="metrics report-metrics">
        <StatCard
          title="Current stock"
          value={itemsStatus === 'ready'
            ? activeItems.reduce((total, item) => total + item.currentStock, 0)
            : '—'}
          note={itemsStatus === 'ready'
            ? `${activeItems.length} active items · quantities may use different units`
            : itemsStatus === 'loading' ? 'Loading current stock...' : 'Current stock is unavailable'}
          icon="box"
        />
        <StatCard
          title="Stock in · period"
          value={summary?.stockIn ?? '—'}
          note={summary
            ? `${summary.transactions} matching transactions`
            : movementsStatus === 'loading'
              ? 'Loading matching transactions...'
              : movementsStatus === 'invalid'
                ? 'Correct the date range to view transactions.'
                : 'Transaction summary is unavailable'}
          icon="stockin"
          noteTone="positive"
        />
        <StatCard
          title="Stock out · period"
          value={summary?.stockOut ?? '—'}
          note="Based on transaction filters"
          icon="stockout"
        />
        <StatCard
          title="Low stock items"
          value={itemsStatus === 'ready' ? filteredLowStock.length : '—'}
          note="At or below minimum"
          icon="alert"
          tone="amber"
          noteTone="attention"
        />
      </section>

      <article className="card list-card report-section">
        <div className="table-title"><div><h2>Current stock report</h2><div className="panel-sub">Saldo semua barang aktif saat ini</div></div></div>
        {itemsStatus === 'ready' && (
          <DataTable columns={stockColumns} rows={activeItems} rowKey="id" emptyMessage="Tidak ada item aktif." />
        )}
      </article>
      <article className="card list-card report-section">
        <div className="table-title"><div><h2>Low stock report</h2><div className="panel-sub">Barang pada atau di bawah minimum</div></div></div>
        {itemsStatus === 'ready' && (
          <DataTable columns={stockColumns} rows={filteredLowStock} rowKey="id" emptyMessage="Tidak ada barang dengan stok menipis." />
        )}
      </article>
      <article className="card list-card report-section">
        <div className="table-title"><div><h2>Stock movement report</h2><div className="panel-sub">Barang masuk dan keluar sesuai filter</div></div></div>
        {movementsStatus === 'ready' && (
          movements.length
            ? <DataTable columns={movementColumns} rows={movements} rowKey="id" />
            : <div className="table-footer">Tidak ada transaksi untuk filter ini.</div>
        )}
      </article>
    </>
  )
}
