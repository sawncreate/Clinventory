import { useCallback, useEffect, useRef, useState } from 'react'
import DataTable from '../components/DataTable.jsx'
import EmptyState from '../components/EmptyState.jsx'
import FormField from '../components/FormField.jsx'
import Modal from '../components/Modal.jsx'
import PageHeader from '../components/PageHeader.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useInventory } from '../context/InventoryContext.jsx'
import {
  createSupplier,
  deleteSupplier,
  listSuppliers,
  updateSupplier,
} from '../services/supabaseInventoryRepository.js'

const emptySupplier = {
  name: '',
  contactName: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  isActive: true,
}

function getErrorMessage(error) {
  return typeof error?.message === 'string' && error.message.trim()
    ? error.message
    : 'Terjadi kesalahan saat memproses supplier. Silakan coba lagi.'
}

export default function SuppliersPage() {
  const { profile, user } = useAuth()
  const { notify } = useInventory()
  const canManage = Boolean(
    user
    && profile?.id === user.id
    && profile.is_active
    && profile.role === 'admin',
  )
  const [suppliers, setSuppliers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [editing, setEditing] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [isMutating, setIsMutating] = useState(false)
  const [form, setForm] = useState(emptySupplier)
  const requestId = useRef(0)

  const loadSupplierList = useCallback(async () => {
    const request = ++requestId.current
    setIsLoading(true)
    setLoadError('')

    try {
      const rows = await listSuppliers()
      if (!Array.isArray(rows)) {
        throw new Error('Supabase returned an invalid supplier result.')
      }
      if (request !== requestId.current) return { ok: false, error: '' }
      setSuppliers(rows)
      return { ok: true, error: '' }
    } catch (error) {
      const message = getErrorMessage(error)
      if (request === requestId.current) setLoadError(message)
      return { ok: false, error: message }
    } finally {
      if (request === requestId.current) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSupplierList()
    return () => {
      requestId.current += 1
    }
  }, [loadSupplierList])

  function openForm(supplier = null) {
    if (!canManage || isMutating) return
    setEditing(supplier)
    setIsFormOpen(true)
    setForm(supplier
      ? {
          name: supplier.name,
          contactName: supplier.contactName || '',
          phone: supplier.phone || '',
          email: supplier.email || '',
          address: supplier.address || '',
          notes: supplier.notes || '',
          isActive: supplier.isActive,
        }
      : emptySupplier)
  }

  async function save(event) {
    event.preventDefault()
    if (!canManage || isMutating) return

    const values = Object.fromEntries(new FormData(event.currentTarget).entries())
    const supplier = {
      ...values,
      isActive: values.isActive === 'true',
    }
    const wasEditing = Boolean(editing)
    setIsMutating(true)

    try {
      if (editing) {
        await updateSupplier({ ...supplier, id: editing.id })
      } else {
        await createSupplier(supplier)
      }

      setIsFormOpen(false)
      setEditing(null)
      const refresh = await loadSupplierList()
      const successMessage = wasEditing
        ? 'Supplier berhasil diperbarui.'
        : 'Supplier berhasil ditambahkan.'
      notify(
        refresh.ok ? successMessage : `${successMessage} Namun, daftar supplier gagal diperbarui: ${refresh.error}`,
        refresh.ok ? 'success' : 'warning',
      )
    } catch (error) {
      notify(getErrorMessage(error), 'error')
    } finally {
      setIsMutating(false)
    }
  }

  async function confirmDelete() {
    if (!canManage || !deleting || isMutating) return

    const supplier = deleting
    setIsMutating(true)
    try {
      await deleteSupplier(supplier.id)
      setDeleting(null)
      const refresh = await loadSupplierList()
      notify(
        refresh.ok
          ? 'Supplier berhasil dihapus.'
          : `Supplier berhasil dihapus. Namun, daftar supplier gagal diperbarui: ${refresh.error}`,
        refresh.ok ? 'success' : 'warning',
      )
    } catch (error) {
      notify(getErrorMessage(error), 'error')
    } finally {
      setIsMutating(false)
    }
  }

  const columns = [
    { key: 'name', label: 'Supplier name' },
    { key: 'contactName', label: 'Contact name', render: (supplier) => supplier.contactName || '—' },
    { key: 'phone', label: 'Phone', render: (supplier) => supplier.phone || '—' },
    { key: 'email', label: 'Email', render: (supplier) => supplier.email || '—' },
    { key: 'address', label: 'Address', render: (supplier) => supplier.address || '—' },
    { key: 'notes', label: 'Notes', render: (supplier) => supplier.notes || '—' },
    {
      key: 'isActive',
      label: 'Status',
      render: (supplier) => <StatusBadge>{supplier.isActive ? 'Active' : 'Inactive'}</StatusBadge>,
    },
    ...(canManage ? [{
      key: 'actions',
      label: 'Actions',
      render: (supplier) => (
        <div className="table-actions">
          <button
            className="mini-action"
            type="button"
            title={`Edit ${supplier.name}`}
            aria-label={`Edit ${supplier.name}`}
            disabled={isMutating}
            onClick={() => openForm(supplier)}
          >✎</button>
          <button
            className="mini-action"
            type="button"
            title={`Hapus ${supplier.name}`}
            aria-label={`Hapus ${supplier.name}`}
            disabled={isMutating}
            onClick={() => setDeleting(supplier)}
          >×</button>
        </div>
      ),
    }] : []),
  ]

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Kelola mitra pemasok perlengkapan klinik."
        action={canManage && (
          <button className="btn btn-primary" type="button" onClick={() => openForm()}>
            ＋ Add supplier
          </button>
        )}
      />
      <article className="card list-card">
        {isLoading ? (
          <p className="supabase-readonly-state" role="status">Memuat supplier...</p>
        ) : loadError ? (
          <div className="supabase-readonly-error" role="alert">
            <p>{loadError}</p>
            <button className="btn" type="button" onClick={() => { void loadSupplierList() }}>
              Coba lagi
            </button>
          </div>
        ) : suppliers.length ? (
          <DataTable columns={columns} rows={suppliers} rowKey="id" />
        ) : (
          <EmptyState
            title="Belum ada supplier"
            description={canManage
              ? 'Tambahkan supplier untuk menghubungkannya dengan barang.'
              : 'Supplier yang tersedia akan muncul di sini.'}
          />
        )}
        {!isLoading && !loadError && (
          <div className="table-footer">{suppliers.length} supplier</div>
        )}
      </article>

      {isFormOpen && (
        <Modal
          title={editing ? 'Edit supplier' : 'Add supplier'}
          onClose={() => {
            if (!isMutating) setIsFormOpen(false)
          }}
        >
          <form onSubmit={save}>
            <div className="field-grid">
              <FormField label="Nama supplier" htmlFor="supplier-name" required>
                <input
                  id="supplier-name"
                  name="name"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  disabled={isMutating}
                  required
                />
              </FormField>
              <FormField label="Nama kontak" htmlFor="supplier-contact-name">
                <input
                  id="supplier-contact-name"
                  name="contactName"
                  value={form.contactName}
                  onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))}
                  disabled={isMutating}
                />
              </FormField>
              <FormField label="Telepon" htmlFor="supplier-phone">
                <input
                  id="supplier-phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  disabled={isMutating}
                />
              </FormField>
              <FormField label="Email" htmlFor="supplier-email">
                <input
                  id="supplier-email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  disabled={isMutating}
                />
              </FormField>
              <FormField label="Alamat" htmlFor="supplier-address">
                <input
                  id="supplier-address"
                  name="address"
                  value={form.address}
                  onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                  disabled={isMutating}
                />
              </FormField>
              <FormField label="Status" htmlFor="supplier-is-active">
                <select
                  id="supplier-is-active"
                  name="isActive"
                  value={String(form.isActive)}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    isActive: event.target.value === 'true',
                  }))}
                  disabled={isMutating}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </FormField>
              <div className="field full">
                <label htmlFor="supplier-notes">Notes</label>
                <textarea
                  id="supplier-notes"
                  name="notes"
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  disabled={isMutating}
                />
              </div>
            </div>
            <div className="form-actions">
              <button
                className="btn"
                type="button"
                onClick={() => setIsFormOpen(false)}
                disabled={isMutating}
              >Batal</button>
              <button className="btn btn-primary" type="submit" disabled={isMutating}>
                {isMutating ? 'Menyimpan...' : editing ? 'Simpan perubahan' : 'Tambah supplier'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal
          title="Hapus supplier?"
          onClose={() => {
            if (!isMutating) setDeleting(null)
          }}
        >
          <p className="confirm-message">
            Supplier "{deleting.name}" hanya dapat dihapus jika tidak digunakan oleh item atau riwayat transaksi.
          </p>
          <div className="form-actions">
            <button
              className="btn"
              type="button"
              onClick={() => setDeleting(null)}
              disabled={isMutating}
            >Batal</button>
            <button
              className="btn btn-danger"
              type="button"
              onClick={confirmDelete}
              disabled={isMutating}
            >{isMutating ? 'Menghapus...' : 'Hapus'}</button>
          </div>
        </Modal>
      )}
    </>
  )
}
