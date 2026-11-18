import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import DataTable from '../components/DataTable.jsx'
import EmptyState from '../components/EmptyState.jsx'
import FormField from '../components/FormField.jsx'
import Modal from '../components/Modal.jsx'
import PageHeader from '../components/PageHeader.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useInventory } from '../context/InventoryContext.jsx'
import {
  createItem,
  deleteItem,
  listCategories,
  listItems,
  listSuppliers,
  updateItem,
} from '../services/supabaseInventoryRepository.js'

const blankItem = {
  name: '',
  sku: '',
  categoryId: '',
  supplierId: '',
  unit: 'units',
  initialStock: '0',
  minimumStock: '0',
  description: '',
}

function getErrorMessage(error) {
  return typeof error?.message === 'string' && error.message.trim()
    ? error.message
    : 'Terjadi kesalahan saat memproses barang. Silakan coba lagi.'
}

export default function ItemsPage() {
  const { profile, user } = useAuth()
  const { notify } = useInventory()
  const canManage = Boolean(
    user
    && profile?.id === user.id
    && profile.is_active
    && profile.role === 'admin',
  )
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [editingItem, setEditingItem] = useState(null)
  const [isItemFormOpen, setIsItemFormOpen] = useState(false)
  const [form, setForm] = useState(blankItem)
  const [deletingItem, setDeletingItem] = useState(null)
  const [isMutating, setIsMutating] = useState(false)
  const requestId = useRef(0)
  const activeCategories = categories.filter((category) => category.isActive)
  const activeSuppliers = suppliers.filter((supplier) => supplier.isActive)
  const inactiveCategory = editingItem
    ? categories.find((category) => category.id === editingItem.categoryId && !category.isActive)
    : null
  const inactiveSupplier = editingItem
    ? suppliers.find((supplier) => supplier.id === editingItem.supplierId && !supplier.isActive)
    : null
  const categoryOptions = inactiveCategory
    ? [...activeCategories, inactiveCategory]
    : activeCategories
  const supplierOptions = inactiveSupplier
    ? [...activeSuppliers, inactiveSupplier]
    : activeSuppliers

  const loadItemData = useCallback(async () => {
    const request = ++requestId.current
    setIsLoading(true)
    setLoadError('')

    try {
      const [itemRows, categoryRows, supplierRows] = await Promise.all([
        listItems({ activeOnly: true }),
        listCategories(),
        listSuppliers(),
      ])
      if (!Array.isArray(itemRows) || !Array.isArray(categoryRows) || !Array.isArray(supplierRows)) {
        throw new Error('Supabase returned an invalid item, category, or supplier result.')
      }
      if (request !== requestId.current) return { ok: false, error: '' }
      setItems(itemRows)
      setCategories(categoryRows)
      setSuppliers(supplierRows)
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
    void loadItemData()
    return () => {
      requestId.current += 1
    }
  }, [loadItemData])

  const visibleItems = useMemo(() => items
    .filter((item) => categoryFilter === 'ALL' || item.categoryId === categoryFilter)
    .filter((item) => {
      const category = categories.find((entry) => entry.id === item.categoryId)?.name || ''
      const supplier = suppliers.find((entry) => entry.id === item.supplierId)?.name || ''
      return `${item.name} ${item.sku} ${category} ${supplier}`.toLowerCase().includes(query.trim().toLowerCase())
    }), [categoryFilter, categories, items, query, suppliers])

  const columns = [
    {
      key: 'name',
      label: 'Item',
      render: (item) => (
        <div className="item-cell">
          <div className="item-thumb">{item.icon}</div>
          <div>
            <div className="item-title">{item.name}</div>
            <div className="item-code">{item.sku}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (item) => categories.find((entry) => entry.id === item.categoryId)?.name || '—',
    },
    {
      key: 'stock',
      label: 'Current stock',
      render: (item) => <><strong>{item.currentStock}</strong> {item.unit}</>,
    },
    {
      key: 'minimum',
      label: 'Minimum',
      render: (item) => `${item.minimumStock} ${item.unit}`,
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => <StatusBadge>{item.currentStock <= item.minimumStock ? 'Low stock' : 'In stock'}</StatusBadge>,
    },
    {
      key: 'supplier',
      label: 'Supplier',
      render: (item) => suppliers.find((entry) => entry.id === item.supplierId)?.name || '—',
    },
    ...(canManage ? [{
      key: 'actions',
      label: 'Actions',
      render: (item) => (
        <div className="table-actions">
          <button className="mini-action" type="button" title={`Edit ${item.name}`} aria-label={`Edit ${item.name}`} disabled={isMutating} onClick={() => openEdit(item)}>✎</button>
          <button className="mini-action" type="button" title={`Hapus ${item.name}`} aria-label={`Hapus ${item.name}`} disabled={isMutating} onClick={() => setDeletingItem(item)}>×</button>
        </div>
      ),
    }] : []),
  ]

  function openCreate() {
    if (!canManage || isMutating || isLoading || !activeCategories.length) return
    setEditingItem(null)
    setIsItemFormOpen(true)
    setForm({ ...blankItem, categoryId: activeCategories[0]?.id || '' })
  }

  function openEdit(item) {
    if (!canManage || isMutating) return
    setEditingItem(item)
    setIsItemFormOpen(true)
    setForm({
      name: item.name,
      sku: item.sku,
      categoryId: item.categoryId || '',
      supplierId: item.supplierId || '',
      unit: item.unit,
      minimumStock: String(item.minimumStock),
      description: item.description || '',
    })
  }

  function changeField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function saveItem(event) {
    event.preventDefault()
    if (!canManage || isMutating) return

    const input = Object.fromEntries(new FormData(event.currentTarget).entries())
    const wasEditing = Boolean(editingItem)
    setIsMutating(true)

    try {
      if (editingItem) {
        await updateItem({ ...input, id: editingItem.id, supplierId: input.supplierId || null })
      } else {
        await createItem({ ...input, supplierId: input.supplierId || null })
      }
      setIsItemFormOpen(false)
      setEditingItem(null)
      const refresh = await loadItemData()
      const successMessage = wasEditing
        ? 'Perubahan barang berhasil disimpan.'
        : 'Barang berhasil ditambahkan.'
      notify(
        refresh.ok ? successMessage : `${successMessage} Namun, daftar barang gagal diperbarui: ${refresh.error}`,
        refresh.ok ? 'success' : 'warning',
      )
    } catch (error) {
      notify(getErrorMessage(error), 'error')
    } finally {
      setIsMutating(false)
    }
  }

  async function confirmDelete() {
    if (!canManage || !deletingItem || isMutating) return
    const item = deletingItem
    setIsMutating(true)

    try {
      const result = await deleteItem(item.id)
      setDeletingItem(null)
      const refresh = await loadItemData()
      const successMessage = result.isActive
        ? 'Barang berhasil dihapus.'
        : 'Barang diarsipkan agar riwayat transaksinya tetap utuh.'
      notify(
        refresh.ok ? successMessage : `${successMessage} Namun, daftar barang gagal diperbarui: ${refresh.error}`,
        refresh.ok ? 'success' : 'warning',
      )
    } catch (error) {
      notify(getErrorMessage(error), 'error')
    } finally {
      setIsMutating(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Items"
        description="Kelola perlengkapan dan peralatan klinik."
        action={canManage && (
          <button
            className="btn btn-primary"
            type="button"
            disabled={isLoading || Boolean(loadError) || !activeCategories.length || isMutating}
            onClick={openCreate}
          >＋ Add item</button>
        )}
      />
      <div className="toolbar">
        <div className="searchbox">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            aria-label="Cari barang"
            placeholder="Search items by name or SKU..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="filters">
          <select aria-label="Filter kategori" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} disabled={isLoading || Boolean(loadError)}>
            <option value="ALL">All categories</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <button className="btn" type="button" disabled={isLoading || Boolean(loadError)} onClick={() => { setQuery(''); setCategoryFilter('ALL') }}>Reset</button>
        </div>
      </div>
      <article className="card list-card">
        {isLoading ? (
          <p className="supabase-readonly-state" role="status">Memuat barang, kategori, dan supplier...</p>
        ) : loadError ? (
          <div className="supabase-readonly-error" role="alert">
            <p>{loadError}</p>
            <button className="btn" type="button" onClick={() => { void loadItemData() }}>Coba lagi</button>
          </div>
        ) : visibleItems.length ? (
          <DataTable columns={columns} rows={visibleItems} rowKey="id" />
        ) : (
          <EmptyState
            title={query || categoryFilter !== 'ALL' ? 'Tidak ada barang yang cocok' : 'Belum ada barang'}
            description={query || categoryFilter !== 'ALL'
              ? 'Coba ubah pencarian atau kategori.'
              : canManage && !categories.length
                ? 'Tambahkan kategori terlebih dahulu sebelum membuat barang.'
                : canManage && !activeCategories.length
                  ? 'Aktifkan kategori terlebih dahulu sebelum membuat barang.'
                : canManage
                  ? 'Tambahkan barang untuk mulai mengelola persediaan.'
                  : 'Barang yang tersedia akan muncul di sini.'}
          />
        )}
        {!isLoading && !loadError && (
          <div className="table-footer">Menampilkan {visibleItems.length} dari {items.length} barang aktif</div>
        )}
      </article>

      {isItemFormOpen && canManage && (
        <Modal
          title={editingItem ? 'Edit item' : 'Add new item'}
          onClose={() => {
            if (!isMutating) setIsItemFormOpen(false)
          }}
          size="wide"
        >
          <form onSubmit={saveItem}>
            <div className="field-grid">
              <FormField label="Nama barang" htmlFor="item-name" required>
                <input id="item-name" name="name" value={form.name} onChange={changeField} required />
              </FormField>
              <FormField label="SKU / kode barang" htmlFor="item-sku" required>
                <input id="item-sku" name="sku" value={form.sku} onChange={changeField} required />
              </FormField>
              <FormField
                label="Kategori"
                htmlFor="item-category"
                required
                hint={inactiveCategory
                  ? 'Kategori terkait saat ini tidak aktif. Relasi ini dipertahankan selama tidak diubah; pilih kategori aktif untuk menggantinya.'
                  : undefined}
              >
                <select id="item-category" name="categoryId" value={form.categoryId || ''} onChange={changeField} required disabled={isMutating}>
                  <option value="">Pilih kategori</option>
                  {categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}{category.isActive ? '' : ' (nonaktif — relasi saat ini)'}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField
                label="Supplier"
                htmlFor="item-supplier"
                hint={inactiveSupplier
                  ? 'Supplier terkait saat ini tidak aktif. Relasi ini dipertahankan selama tidak diubah; pilih supplier aktif atau kosongkan.'
                  : undefined}
              >
                <select id="item-supplier" name="supplierId" value={form.supplierId} onChange={changeField} disabled={isMutating}>
                  <option value="">Tanpa supplier</option>
                  {supplierOptions.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}{supplier.isActive ? '' : ' (nonaktif — relasi saat ini)'}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Satuan" htmlFor="item-unit" required>
                <input id="item-unit" name="unit" value={form.unit} onChange={changeField} required />
              </FormField>
              <FormField label="Minimum stock" htmlFor="item-minimum" required>
                <input id="item-minimum" name="minimumStock" type="number" min="0" step="1" value={form.minimumStock} onChange={changeField} required />
              </FormField>
              {editingItem ? (
                <FormField label="Current stock" htmlFor="item-current-stock" hint="Stok hanya berubah melalui transaksi Stock In / Stock Out.">
                  <input id="item-current-stock" value={`${editingItem.currentStock} ${editingItem.unit}`} disabled />
                </FormField>
              ) : (
                <FormField label="Stok awal" htmlFor="item-initial-stock" required hint="Saldo pembuka; perubahan selanjutnya dicatat sebagai transaksi.">
                  <input id="item-initial-stock" name="initialStock" type="number" min="0" step="1" value={form.initialStock} onChange={changeField} required />
                </FormField>
              )}
              <div className="field full">
                <label htmlFor="item-description">Deskripsi</label>
                <textarea id="item-description" name="description" value={form.description} onChange={changeField} />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn" type="button" disabled={isMutating} onClick={() => setIsItemFormOpen(false)}>Batal</button>
              <button className="btn btn-primary" type="submit" disabled={isMutating}>{isMutating ? 'Menyimpan...' : editingItem ? 'Simpan perubahan' : 'Tambah barang'}</button>
            </div>
          </form>
        </Modal>
      )}

      {deletingItem && canManage && (
        <ConfirmDialog
          title="Hapus barang?"
          message={`${deletingItem.name} akan dihapus permanen jika belum memiliki riwayat transaksi, atau diarsipkan jika memiliki riwayat. Lanjutkan?`}
          onCancel={() => {
            if (!isMutating) setDeletingItem(null)
          }}
          onConfirm={confirmDelete}
        />
      )}
    </>
  )
}
