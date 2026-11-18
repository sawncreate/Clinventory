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
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../services/supabaseInventoryRepository.js'

function getErrorMessage(error) {
  return typeof error?.message === 'string' && error.message
    ? error.message
    : 'Terjadi kesalahan saat memproses kategori. Silakan coba lagi.'
}

export default function CategoriesPage() {
  const { profile, user } = useAuth()
  const { notify } = useInventory()
  const canManage = Boolean(
    user
    && profile?.id === user.id
    && profile.is_active
    && profile.role === 'admin',
  )
  const [categories, setCategories] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [editing, setEditing] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [isMutating, setIsMutating] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const requestId = useRef(0)

  const loadCategoryList = useCallback(async () => {
    const request = ++requestId.current
    setIsLoading(true)
    setLoadError('')

    try {
      const rows = await listCategories()
      if (!Array.isArray(rows)) {
        throw new Error('Supabase returned an invalid category result.')
      }
      if (request !== requestId.current) return { ok: false, error: '' }
      setCategories(rows)
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
    void loadCategoryList()
    return () => {
      requestId.current += 1
    }
  }, [loadCategoryList])

  function openForm(category = null) {
    if (!canManage || isMutating) return
    setEditing(category)
    setIsFormOpen(true)
    setForm(category
      ? { name: category.name, description: category.description || '' }
      : { name: '', description: '' })
  }

  async function save(event) {
    event.preventDefault()
    if (!canManage || isMutating) return

    const values = Object.fromEntries(new FormData(event.currentTarget).entries())
    const wasEditing = Boolean(editing)
    setIsMutating(true)

    try {
      if (editing) {
        await updateCategory({ ...values, id: editing.id })
      } else {
        await createCategory(values)
      }

      setIsFormOpen(false)
      setEditing(null)
      const refresh = await loadCategoryList()
      const successMessage = wasEditing
        ? 'Kategori berhasil diperbarui.'
        : 'Kategori berhasil ditambahkan.'
      notify(
        refresh.ok ? successMessage : `${successMessage} Namun, daftar kategori gagal diperbarui: ${refresh.error}`,
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

    const category = deleting
    setIsMutating(true)
    try {
      await deleteCategory(category.id)
      setDeleting(null)
      const refresh = await loadCategoryList()
      notify(
        refresh.ok
          ? 'Kategori berhasil dihapus.'
          : `Kategori berhasil dihapus. Namun, daftar kategori gagal diperbarui: ${refresh.error}`,
        refresh.ok ? 'success' : 'warning',
      )
    } catch (error) {
      notify(getErrorMessage(error), 'error')
    } finally {
      setIsMutating(false)
    }
  }

  const columns = [
    { key: 'name', label: 'Category name' },
    {
      key: 'description',
      label: 'Description',
      render: (category) => category.description || '—',
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (category) => <StatusBadge>{category.isActive ? 'Active' : 'Inactive'}</StatusBadge>,
    },
    ...(canManage ? [{
      key: 'actions',
      label: 'Actions',
      render: (category) => (
        <div className="table-actions">
          <button
            className="mini-action"
            type="button"
            title={`Edit ${category.name}`}
            aria-label={`Edit ${category.name}`}
            disabled={isMutating}
            onClick={() => openForm(category)}
          >✎</button>
          <button
            className="mini-action"
            type="button"
            title={`Hapus ${category.name}`}
            aria-label={`Hapus ${category.name}`}
            disabled={isMutating}
            onClick={() => setDeleting(category)}
          >×</button>
        </div>
      ),
    }] : []),
  ]

  return (
    <>
      <PageHeader
        title="Categories"
        description="Kelompokkan perlengkapan agar mudah ditemukan."
        action={canManage && (
          <button className="btn btn-primary" type="button" onClick={() => openForm()}>
            ＋ Add category
          </button>
        )}
      />
      <article className="card list-card">
        {isLoading ? (
          <p className="supabase-readonly-state" role="status">Memuat kategori...</p>
        ) : loadError ? (
          <div className="supabase-readonly-error" role="alert">
            <p>{loadError}</p>
            <button className="btn" type="button" onClick={() => { void loadCategoryList() }}>
              Coba lagi
            </button>
          </div>
        ) : categories.length ? (
          <DataTable columns={columns} rows={categories} rowKey="id" />
        ) : (
          <EmptyState
            title="Belum ada kategori"
            description={canManage
              ? 'Tambahkan kategori untuk mulai mengelompokkan barang.'
              : 'Kategori yang tersedia akan muncul di sini.'}
          />
        )}
        {!isLoading && !loadError && (
          <div className="table-footer">{categories.length} kategori</div>
        )}
      </article>

      {isFormOpen && (
        <Modal
          title={editing ? 'Edit category' : 'Add category'}
          onClose={() => {
            if (!isMutating) setIsFormOpen(false)
          }}
        >
          <form onSubmit={save}>
            <div className="field-grid">
              <FormField label="Nama kategori" htmlFor="category-name" required>
                <input
                  id="category-name"
                  name="name"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  disabled={isMutating}
                  required
                />
              </FormField>
              <div className="field full">
                <label htmlFor="category-description">Deskripsi</label>
                <textarea
                  id="category-description"
                  name="description"
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
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
                {isMutating ? 'Menyimpan...' : editing ? 'Simpan perubahan' : 'Tambah kategori'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal
          title="Hapus kategori?"
          onClose={() => {
            if (!isMutating) setDeleting(null)
          }}
        >
          <p className="confirm-message">
            Kategori "{deleting.name}" hanya dapat dihapus jika tidak digunakan oleh barang.
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
