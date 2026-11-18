import { useEffect, useState } from 'react'
import DataTable from '../components/DataTable.jsx'
import EmptyState from '../components/EmptyState.jsx'
import PageHeader from '../components/PageHeader.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { listItems, listStockMovements } from '../services/supabaseInventoryRepository.js'

const PAGE_SIZE = 50

function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(value) {
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const columns = [
  {
    key: 'itemName',
    label: 'Item',
    render: (movement) => (
      <div>
        <div className="item-title">{movement.itemName}</div>
        <div className="item-code">{movement.itemSku}</div>
      </div>
    ),
  },
  {
    key: 'type',
    label: 'Type',
    render: (movement) => <StatusBadge>{movement.type === 'IN' ? 'Stock in' : 'Stock out'}</StatusBadge>,
  },
  {
    key: 'quantity',
    label: 'Quantity',
    render: (movement) => (
      <strong className={movement.type === 'IN' ? 'quantity-in' : 'quantity-out'}>
        {movement.type === 'IN' ? '+' : '−'}{movement.quantity} {movement.itemUnit}
      </strong>
    ),
  },
  {
    key: 'transactionDate',
    label: 'Date',
    render: (movement) => (
      <div>
        <time dateTime={movement.transactionDate}>{formatDate(movement.transactionDate)}</time>
        <div className="item-code">Dicatat {formatDateTime(movement.createdAt)}</div>
      </div>
    ),
  },
  {
    key: 'supplierName',
    label: 'Supplier',
    render: (movement) => movement.supplierName || '—',
  },
  { key: 'notes', label: 'Notes', render: (movement) => movement.notes || '—' },
  { key: 'createdBy', label: 'Created by', render: (movement) => movement.createdBy || 'Nama tidak tersedia' },
]

export default function StockHistoryPage() {
  const [filters, setFilters] = useState({
    type: 'ALL',
    itemId: 'ALL',
    startDate: '',
    endDate: '',
  })
  const [items, setItems] = useState([])
  const [itemsStatus, setItemsStatus] = useState('loading')
  const [itemsError, setItemsError] = useState('')
  const [itemsAttempt, setItemsAttempt] = useState(0)
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [nextOffset, setNextOffset] = useState(null)
  const [pageOffsets, setPageOffsets] = useState([0])
  const offset = pageOffsets[pageOffsets.length - 1]

  useEffect(() => {
    let isCurrent = true
    setItemsStatus('loading')
    setItemsError('')

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
          setItemsError(loadError?.message || 'Daftar barang tidak dapat dimuat dari Supabase.')
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
    setStatus('loading')
    setError('')
    setRows([])
    setNextOffset(null)

    async function loadMovements() {
      try {
        const result = await listStockMovements({
          ...filters,
          offset,
          limit: PAGE_SIZE,
        })
        if (!Array.isArray(result?.rows)) {
          throw new Error('Supabase returned an invalid stock movement result.')
        }
        if (isCurrent) {
          setRows(result.rows)
          setNextOffset(result.nextOffset)
          setStatus('ready')
        }
      } catch (loadError) {
        if (isCurrent) {
          setError(loadError?.message || 'Riwayat transaksi tidak dapat dimuat dari Supabase.')
          setStatus('error')
        }
      }
    }

    void loadMovements()
    return () => {
      isCurrent = false
    }
  }, [attempt, filters, offset])

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }))
    setPageOffsets([0])
  }

  function goToNextPage() {
    if (nextOffset === null) return
    setPageOffsets((current) => [...current, nextOffset])
  }

  function goToPreviousPage() {
    setPageOffsets((current) => current.length > 1 ? current.slice(0, -1) : current)
  }

  return (
    <>
      <PageHeader title="Stock history" description="Riwayat transaksi persediaan yang tercatat." />
      {itemsStatus === 'error' && (
        <div className="supabase-readonly-error" role="alert">
          <p>{itemsError}</p>
          <button className="btn" type="button" onClick={() => setItemsAttempt((current) => current + 1)}>
            Coba muat ulang barang
          </button>
        </div>
      )}
      <div className="toolbar">
        <div className="filters">
          <select
            aria-label="Filter tipe transaksi"
            value={filters.type}
            onChange={(event) => updateFilter('type', event.target.value)}
          >
            <option value="ALL">All transaction types</option>
            <option value="IN">Stock In</option>
            <option value="OUT">Stock Out</option>
          </select>
          <select
            aria-label="Filter barang"
            value={filters.itemId}
            onChange={(event) => updateFilter('itemId', event.target.value)}
            disabled={itemsStatus !== 'ready'}
          >
            <option value="ALL">All items</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.sku}){item.isActive ? '' : ' — arsip'}
              </option>
            ))}
          </select>
          <label>
            Dari tanggal
            <input
              aria-label="Tanggal mulai"
              type="date"
              value={filters.startDate}
              onChange={(event) => updateFilter('startDate', event.target.value)}
            />
          </label>
          <label>
            Sampai tanggal
            <input
              aria-label="Tanggal akhir"
              type="date"
              value={filters.endDate}
              onChange={(event) => updateFilter('endDate', event.target.value)}
            />
          </label>
        </div>
      </div>
      <article className="card list-card">
        {status === 'loading' && (
          <p className="supabase-readonly-state" role="status">Memuat riwayat transaksi dari Supabase...</p>
        )}
        {status === 'error' && (
          <div className="supabase-readonly-error" role="alert">
            <p>{error}</p>
            <button className="btn" type="button" onClick={() => setAttempt((current) => current + 1)}>
              Coba lagi
            </button>
          </div>
        )}
        {status === 'ready' && rows.length > 0 && (
          <DataTable columns={columns} rows={rows} rowKey="id" />
        )}
        {status === 'ready' && rows.length === 0 && (
          <EmptyState
            title="Belum ada transaksi"
            description="Tidak ada transaksi Supabase yang sesuai dengan filter ini."
          />
        )}
        {status === 'ready' && (
          <div className="table-footer">{rows.length} transaksi pada halaman ini</div>
        )}
      </article>
      {status === 'ready' && (
        <div className="form-actions" aria-label="Pagination riwayat">
          <button
            className="btn"
            type="button"
            onClick={goToPreviousPage}
            disabled={pageOffsets.length <= 1}
          >
            Sebelumnya
          </button>
          <span>Halaman {pageOffsets.length}</span>
          <button
            className="btn"
            type="button"
            onClick={goToNextPage}
            disabled={nextOffset === null}
          >
            Berikutnya
          </button>
        </div>
      )}
    </>
  )
}
