import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import FormField from '../components/FormField.jsx'
import PageHeader from '../components/PageHeader.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { useInventory } from '../context/InventoryContext.jsx'
import {
  listItems,
  listSuppliers,
  recordStockMovement,
} from '../services/supabaseInventoryRepository.js'

const PENDING_MOVEMENT_STORAGE_KEY = 'clinicstock:pending-stock-movement:v1'

function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getErrorMessage(error) {
  return typeof error?.message === 'string' && error.message.trim()
    ? error.message
    : 'Terjadi kesalahan saat memproses transaksi. Silakan coba lagi.'
}

function readPendingMovementCheck() {
  try {
    const storedValue = window.sessionStorage.getItem(PENDING_MOVEMENT_STORAGE_KEY)
    if (storedValue === null) return { pending: null, error: '' }

    const parsed = JSON.parse(storedValue)
    if (
      !parsed
      || !['outcomeUnknown', 'committed'].includes(parsed.status)
      || typeof parsed.occurredAt !== 'string'
      || (parsed.movementId !== null && typeof parsed.movementId !== 'string')
    ) {
      throw new Error('Status transaksi tersimpan tidak valid.')
    }

    return {
      pending: {
        status: parsed.status,
        occurredAt: parsed.occurredAt,
        movementId: parsed.movementId,
      },
      error: '',
    }
  } catch (error) {
    return {
      pending: {
        status: 'outcomeUnknown',
        occurredAt: '',
        movementId: null,
      },
      error: `Status transaksi tersimpan tidak dapat dibaca; form tetap terkunci. ${getErrorMessage(error)}`,
    }
  }
}

function savePendingMovementCheck(pending) {
  try {
    window.sessionStorage.setItem(
      PENDING_MOVEMENT_STORAGE_KEY,
      JSON.stringify({
        status: pending.status,
        occurredAt: pending.occurredAt,
        movementId: pending.movementId || null,
      }),
    )
    return { ok: true, error: '' }
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) }
  }
}

function clearPendingMovementCheck() {
  try {
    window.sessionStorage.removeItem(PENDING_MOVEMENT_STORAGE_KEY)
    return { ok: true, error: '' }
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) }
  }
}

export default function StockMovementPage({ type }) {
  const isStockIn = type === 'IN'
  const { notify } = useInventory()
  const [items, setItems] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [initialPendingCheck] = useState(readPendingMovementCheck)
  const [submissionUncertain, setSubmissionUncertain] = useState(initialPendingCheck.pending)
  const [storageError, setStorageError] = useState(initialPendingCheck.error)
  const submitLock = useRef(false)
  const requestId = useRef(0)
  const previousType = useRef(type)
  const [form, setForm] = useState({
    itemId: '',
    quantity: '',
    supplierId: '',
    transactionDate: today(),
    notes: '',
  })

  const loadMovementOptions = useCallback(async () => {
    const request = ++requestId.current
    setIsLoading(true)
    setLoadError('')

    try {
      const [itemRows, supplierRows] = await Promise.all([
        listItems({ activeOnly: true }),
        isStockIn ? listSuppliers({ activeOnly: true }) : Promise.resolve([]),
      ])
      if (!Array.isArray(itemRows) || !Array.isArray(supplierRows)) {
        throw new Error('Supabase returned an invalid item or supplier result.')
      }
      if (request !== requestId.current) return { ok: false, error: '' }

      setItems(itemRows)
      setSuppliers(supplierRows)
      return { ok: true, error: '' }
    } catch (error) {
      const message = getErrorMessage(error)
      if (request === requestId.current) setLoadError(message)
      return { ok: false, error: message }
    } finally {
      if (request === requestId.current) setIsLoading(false)
    }
  }, [isStockIn])

  useEffect(() => {
    void loadMovementOptions()
    return () => {
      requestId.current += 1
    }
  }, [loadMovementOptions])

  useEffect(() => {
    if (previousType.current === type) return
    previousType.current = type
    setForm((current) => ({ ...current, supplierId: '' }))
  }, [type])

  const selectedItem = useMemo(
    () => items.find((item) => item.id === form.itemId && item.isActive),
    [form.itemId, items],
  )
  const isFormDisabled = isLoading
    || Boolean(loadError)
    || Boolean(storageError)
    || !items.length
    || isSubmitting
    || Boolean(submissionUncertain)

  function changeField(event) {
    if (isSubmitting || submissionUncertain) return
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function submit(event) {
    event.preventDefault()
    if (submitLock.current || isFormDisabled) return
    submitLock.current = true
    setIsSubmitting(true)
    let keepLocked = false
    const pendingCheck = {
      status: 'outcomeUnknown',
      occurredAt: new Date().toISOString(),
      movementId: null,
    }

    try {
      const savedBeforeRpc = savePendingMovementCheck(pendingCheck)
      if (!savedBeforeRpc.ok) {
        setStorageError(`Transaksi tidak dikirim karena lock status tidak dapat disimpan. Aktifkan penyimpanan sesi browser lalu muat ulang halaman. ${savedBeforeRpc.error}`)
        notify('Transaksi tidak dikirim karena status lock tidak dapat disimpan.', 'error')
        return
      }

      const movement = await recordStockMovement({
        itemId: form.itemId,
        type,
        quantity: form.quantity,
        transactionDate: form.transactionDate,
        notes: form.notes,
        supplierId: isStockIn ? form.supplierId || null : null,
      })

      const committedCheck = {
        status: 'committed',
        occurredAt: pendingCheck.occurredAt,
        movementId: movement.id || null,
      }
      const savedCommitted = savePendingMovementCheck(committedCheck)
      const clearedAfterSuccess = clearPendingMovementCheck()
      if (!clearedAfterSuccess.ok) {
        keepLocked = true
        setSubmissionUncertain(committedCheck)
        setStorageError(
          `Transaksi sudah dicatat, tetapi lock lokal tidak dapat dibersihkan. Periksa Stock History; form tetap terkunci. ${
            savedCommitted.ok ? '' : `${savedCommitted.error} `
          }${clearedAfterSuccess.error}`,
        )
        const refresh = await loadMovementOptions()
        notify(
          refresh.ok
            ? 'Transaksi berhasil dicatat, tetapi lock lokal tidak dapat dibersihkan.'
            : `Transaksi berhasil dicatat; lock lokal tidak dapat dibersihkan dan saldo gagal dimuat ulang: ${refresh.error}`,
          'warning',
        )
        return
      }

      setStorageError('')
      setSubmissionUncertain(null)
      setForm((current) => ({ ...current, quantity: '', notes: '' }))
      const refresh = await loadMovementOptions()
      notify(
        refresh.ok
          ? isStockIn ? 'Stock In berhasil dicatat dan saldo diperbarui.' : 'Stock Out berhasil dicatat dan saldo diperbarui.'
          : `Transaksi berhasil dicatat, tetapi saldo item gagal dimuat ulang: ${refresh.error}`,
        refresh.ok ? 'success' : 'warning',
      )
    } catch (error) {
      const message = getErrorMessage(error)
      if (error?.committed === true || error?.outcomeUnknown === true) {
        keepLocked = true
        const pending = {
          status: error.committed === true ? 'committed' : 'outcomeUnknown',
          occurredAt: pendingCheck.occurredAt,
          movementId: error.movementId || '',
        }
        setSubmissionUncertain({ ...pending, message })
        const persistedPending = savePendingMovementCheck(pending)
        setStorageError(
          persistedPending.ok
            ? ''
            : `Lock tetap aktif pada halaman ini, tetapi penyimpanan status transaksi gagal. Jangan kirim ulang sebelum memeriksa Stock History. ${persistedPending.error}`,
        )
        const refresh = await loadMovementOptions()
        notify(
          refresh.ok ? message : `${message} Saldo item juga gagal diperbarui: ${refresh.error}`,
          'warning',
        )
      } else {
        const clearedAfterFailure = clearPendingMovementCheck()
        if (!clearedAfterFailure.ok) {
          keepLocked = true
          setSubmissionUncertain({ ...pendingCheck, message })
          setStorageError(`Lock tidak dapat dibersihkan; periksa Stock History sebelum mencoba lagi. ${clearedAfterFailure.error}`)
          notify(`${message} Form tetap terkunci sampai lock lokal dapat dibersihkan.`, 'warning')
        } else {
          setSubmissionUncertain(null)
          setStorageError('')
          notify(message, 'error')
        }
      }
    } finally {
      setIsSubmitting(false)
      if (!keepLocked) submitLock.current = false
    }
  }

  function acknowledgeCheckedHistory() {
    const cleared = clearPendingMovementCheck()
    if (!cleared.ok) {
      setStorageError(`Lock lokal tidak dapat dibersihkan; form tetap terkunci. ${cleared.error}`)
      return
    }
    setSubmissionUncertain(null)
    setStorageError('')
    submitLock.current = false
  }

  return (
    <>
      <PageHeader
        title={isStockIn ? 'Stock In' : 'Stock Out'}
        description={isStockIn
          ? 'Catat barang yang diterima; stok dan riwayat diperbarui bersama.'
          : 'Catat pemakaian barang; transaksi melebihi stok tersedia akan ditolak.'}
      />
      {isLoading && <p className="supabase-readonly-state" role="status">Memuat item{isStockIn ? ' dan supplier' : ''} dari Supabase...</p>}
      {loadError && (
        <div className="supabase-readonly-error" role="alert">
          <p>{loadError}</p>
          <button className="btn" type="button" onClick={() => { void loadMovementOptions() }}>Coba lagi</button>
        </div>
      )}
      {storageError && (
        <p className="supabase-readonly-error" role="alert">{storageError}</p>
      )}
      {!isLoading && !loadError && !items.length && (
        <p className="movement-empty" role="status">Belum ada item aktif di Supabase. Item aktif harus tersedia sebelum transaksi dapat dicatat.</p>
      )}
      {submissionUncertain && (
        <div className="supabase-readonly-error" role="alert">
          <p>{submissionUncertain.message || (submissionUncertain.status === 'committed'
            ? 'Transaksi sudah dicatat, tetapi detailnya gagal dimuat.'
            : 'Status transaksi belum dapat dipastikan.')}</p>
          <p>
            {submissionUncertain.status === 'committed'
              ? 'RPC berhasil dan transaksi sudah dicatat, tetapi detailnya gagal dimuat.'
              : 'Hasil RPC belum dapat dipastikan; transaksi mungkin sudah tercatat.'}
            {submissionUncertain.movementId ? ` (ID ${submissionUncertain.movementId})` : ''}.
            {submissionUncertain.status === 'committed'
              ? ' Periksa Stock History untuk memastikan detail transaksi yang sudah tercatat.'
              : ' Periksa Stock History dan pastikan transaksi tidak ada sebelum mencoba lagi.'}
          </p>
          <button
            className="btn"
            type="button"
            disabled={isSubmitting || isLoading}
            onClick={acknowledgeCheckedHistory}
          >{submissionUncertain.status === 'committed'
            ? 'Saya sudah memeriksa detail transaksi'
            : 'Saya sudah memastikan transaksi belum ada'}</button>
        </div>
      )}
      <div className="movement-layout">
        <article className="card movement-card">
          <form onSubmit={submit}>
            <div className="field-grid">
              <FormField label="Barang" htmlFor="movement-item" required>
                <select
                  id="movement-item"
                  name="itemId"
                  value={form.itemId}
                  onChange={changeField}
                  required
                  disabled={isFormDisabled}
                >
                  <option value="">{items.length ? 'Pilih barang' : 'Tidak ada item aktif'}</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>{item.name} · {item.sku}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Jumlah" htmlFor="movement-quantity" required>
                <input
                  id="movement-quantity"
                  name="quantity"
                  type="number"
                  min="1"
                  step="1"
                  value={form.quantity}
                  onChange={changeField}
                  required
                  disabled={isFormDisabled}
                />
              </FormField>
              {isStockIn && (
                <FormField
                  label="Supplier"
                  htmlFor="movement-supplier"
                  hint={!isLoading && !loadError && !suppliers.length
                    ? 'Supplier opsional; tidak ada supplier aktif yang tersedia.'
                    : undefined}
                >
                  <select
                    id="movement-supplier"
                    name="supplierId"
                    value={form.supplierId}
                    onChange={changeField}
                    disabled={isFormDisabled}
                  >
                    <option value="">Tidak dipilih</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                    ))}
                  </select>
                </FormField>
              )}
              <FormField label="Tanggal transaksi" htmlFor="movement-date" required>
                <input
                  id="movement-date"
                  name="transactionDate"
                  type="date"
                  value={form.transactionDate}
                  onChange={changeField}
                  required
                  disabled={isFormDisabled}
                />
              </FormField>
              <div className="field full">
                <label htmlFor="movement-notes">Catatan</label>
                <textarea
                  id="movement-notes"
                  name="notes"
                  value={form.notes}
                  onChange={changeField}
                  placeholder={isStockIn ? 'Contoh: pengiriman bulanan' : 'Contoh: pemakaian ruang pemeriksaan'}
                  disabled={isFormDisabled}
                />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={isFormDisabled}>
                {isSubmitting ? 'Menyimpan...' : isStockIn ? '＋ Catat Stock In' : '− Catat Stock Out'}
              </button>
            </div>
          </form>
        </article>

        <aside className="card movement-stock-card">
          <div className="panel-head">
            <div>
              <h2>Ringkasan barang</h2>
              <div className="panel-sub">Saldo selalu diperbarui dari transaksi.</div>
            </div>
          </div>
          {isLoading ? (
            <p className="movement-empty" role="status">Memuat saldo...</p>
          ) : loadError ? (
            <p className="movement-empty" role="alert">Saldo item tidak tersedia sampai pemuatan ulang berhasil.</p>
          ) : selectedItem ? (
            <div className="movement-item-summary">
              <div className="item-cell">
                <div className="item-thumb">{selectedItem.icon}</div>
                <div>
                  <div className="item-title">{selectedItem.name}</div>
                  <div className="item-code">{selectedItem.sku}</div>
                </div>
              </div>
              <div className="movement-stock-value">
                <span>Stok tersedia</span>
                <strong>{selectedItem.currentStock} <small>{selectedItem.unit}</small></strong>
              </div>
              <div className="movement-minimum">
                <span>Minimum stock</span>
                <span>{selectedItem.minimumStock} {selectedItem.unit}</span>
              </div>
              <StatusBadge>{selectedItem.currentStock <= selectedItem.minimumStock ? 'Low stock' : 'In stock'}</StatusBadge>
            </div>
          ) : (
            <p className="movement-empty">
              {items.length ? 'Pilih barang untuk melihat saldo Supabase.' : 'Saldo akan tampil setelah item aktif tersedia.'}
            </p>
          )}
        </aside>
      </div>
    </>
  )
}
