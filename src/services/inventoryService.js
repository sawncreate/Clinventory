export function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return `clinicstock-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function now() {
  return new Date().toISOString()
}

function requiredText(value, label) {
  const result = String(value ?? '').trim()
  if (!result) throw new Error(`${label} wajib diisi.`)
  return result
}

function optionalText(value) {
  return String(value ?? '').trim()
}

function nonNegativeInteger(value, label) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`${label} harus berupa bilangan bulat nol atau lebih.`);
  }
  return number
}

function positiveInteger(value, label = 'Jumlah') {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new Error(`${label} harus berupa bilangan bulat lebih dari nol.`)
  }
  return number
}

function dateOnly(value) {
  const date = String(value ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Tanggal transaksi tidak valid.')
  }
  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error('Tanggal transaksi tidak valid.')
  }
  return date
}

function categoryExists(state, categoryId) {
  return state.categories.some((category) => category.id === categoryId)
}

function supplierExists(state, supplierId) {
  return !supplierId || state.suppliers.some((supplier) => supplier.id === supplierId)
}

function normalizedItem(state, input, existingItem = null) {
  const name = requiredText(input.name, 'Nama barang')
  const sku = requiredText(input.sku, 'SKU / kode barang').toUpperCase()
  const categoryId = requiredText(input.categoryId, 'Kategori')
  const supplierId = optionalText(input.supplierId) || null
  const unit = requiredText(input.unit, 'Satuan')
  const minimumStock = nonNegativeInteger(input.minimumStock, 'Minimum stok')

  if (!categoryExists(state, categoryId)) {
    throw new Error('Kategori yang dipilih tidak tersedia.')
  }
  if (!supplierExists(state, supplierId)) {
    throw new Error('Supplier yang dipilih tidak tersedia.')
  }
  if (state.items.some((item) => item.id !== existingItem?.id && item.sku.toUpperCase() === sku)) {
    throw new Error(`SKU ${sku} sudah digunakan barang lain.`)
  }

  return {
    name,
    sku,
    categoryId,
    supplierId,
    unit,
    minimumStock,
    description: optionalText(input.description),
    icon: optionalText(input.icon) || existingItem?.icon || '📦',
  }
}

function uniqueName(items, name, currentId) {
  if (items.some((item) => item.id !== currentId && item.name.toLowerCase() === name.toLowerCase())) {
    throw new Error(`Nama "${name}" sudah digunakan.`)
  }
}

function replaceItem(state, updatedItem) {
  return {
    ...state,
    items: state.items.map((item) => item.id === updatedItem.id ? updatedItem : item),
  }
}

export function assertValidInventoryState(state) {
  const collections = ['items', 'categories', 'suppliers', 'stockMovements']
  if (!state || state.version !== 1 || collections.some((key) => !Array.isArray(state[key]))) {
    throw new Error('Format data ClinicStock tidak valid.')
  }

  for (const key of collections) {
    const ids = state[key].map((record) => record.id)
    if (ids.some((id) => !id) || new Set(ids).size !== ids.length) {
      throw new Error(`ID pada data ${key} tidak valid atau terduplikasi.`)
    }
  }

  const categoryIds = new Set(state.categories.map((category) => category.id))
  const supplierIds = new Set(state.suppliers.map((supplier) => supplier.id))
  const itemIds = new Set(state.items.map((item) => item.id))
  const skus = state.items.map((item) => String(item.sku ?? '').trim().toUpperCase())
  if (skus.some((sku) => !sku) || new Set(skus).size !== skus.length) {
    throw new Error('Kode barang kosong atau terduplikasi.')
  }

  for (const item of state.items) {
    if (!categoryIds.has(item.categoryId) || (item.supplierId && !supplierIds.has(item.supplierId))) {
      throw new Error(`Relasi kategori atau supplier untuk ${item.name} tidak valid.`)
    }
    if (!Number.isSafeInteger(item.initialStock) || item.initialStock < 0 ||
      !Number.isSafeInteger(item.currentStock) || item.currentStock < 0 ||
      !Number.isSafeInteger(item.minimumStock) || item.minimumStock < 0) {
      throw new Error(`Nilai stok untuk ${item.name} tidak valid.`)
    }

    const movementDelta = state.stockMovements.reduce((total, movement) => {
      if (movement.itemId !== item.id) return total
      return total + (movement.type === 'IN' ? movement.quantity : -movement.quantity)
    }, 0)
    if (item.initialStock + movementDelta !== item.currentStock) {
      throw new Error(`Saldo stok dan riwayat transaksi untuk ${item.name} tidak cocok.`)
    }
  }

  for (const movement of state.stockMovements) {
    if (!itemIds.has(movement.itemId) || !['IN', 'OUT'].includes(movement.type) ||
      !Number.isSafeInteger(movement.quantity) || movement.quantity <= 0) {
      throw new Error('Relasi atau jumlah pada riwayat transaksi tidak valid.')
    }
    dateOnly(movement.transactionDate)
  }

  return true
}

export function addItem(state, input) {
  const fields = normalizedItem(state, input)
  const initialStock = nonNegativeInteger(input.initialStock, 'Stok awal')
  const timestamp = now()
  const item = {
    id: createId(),
    ...fields,
    initialStock,
    currentStock: initialStock,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  return { ...state, items: [item, ...state.items] }
}

export function updateItem(state, input) {
  const existing = state.items.find((item) => item.id === input.id && item.isActive)
  if (!existing) throw new Error('Barang tidak ditemukan atau sudah diarsipkan.')

  const updated = {
    ...existing,
    ...normalizedItem(state, input, existing),
    updatedAt: now(),
  }
  return replaceItem(state, updated)
}

export function deleteItem(state, itemId) {
  const item = state.items.find((record) => record.id === itemId && record.isActive)
  if (!item) throw new Error('Barang tidak ditemukan.')

  const hasHistory = state.stockMovements.some((movement) => movement.itemId === itemId)
  if (hasHistory) {
    return replaceItem(state, { ...item, isActive: false, updatedAt: now() })
  }

  return { ...state, items: state.items.filter((record) => record.id !== itemId) }
}

export function addCategory(state, input) {
  const name = requiredText(input.name, 'Nama kategori')
  uniqueName(state.categories, name)
  const category = { id: createId(), name, description: optionalText(input.description) }
  return { ...state, categories: [...state.categories, category] }
}

export function updateCategory(state, input) {
  const existing = state.categories.find((category) => category.id === input.id)
  if (!existing) throw new Error('Kategori tidak ditemukan.')
  const name = requiredText(input.name, 'Nama kategori')
  uniqueName(state.categories, name, existing.id)
  const updated = { ...existing, name, description: optionalText(input.description) }
  return {
    ...state,
    categories: state.categories.map((category) => category.id === existing.id ? updated : category),
  }
}

export function deleteCategory(state, categoryId) {
  if (!state.categories.some((category) => category.id === categoryId)) {
    throw new Error('Kategori tidak ditemukan.')
  }
  if (state.items.some((item) => item.categoryId === categoryId)) {
    throw new Error('Kategori masih digunakan barang. Pindahkan barang ke kategori lain terlebih dahulu.')
  }
  return { ...state, categories: state.categories.filter((category) => category.id !== categoryId) }
}

function normalizeSupplier(input, suppliers, currentId) {
  const name = requiredText(input.name, 'Nama supplier')
  uniqueName(suppliers, name, currentId)
  const email = optionalText(input.email)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Format email supplier tidak valid.')
  }
  return {
    name,
    contact: requiredText(input.contact, 'Kontak'),
    address: requiredText(input.address, 'Alamat'),
    email,
  }
}

export function addSupplier(state, input) {
  const supplier = {
    id: createId(),
    ...normalizeSupplier(input, state.suppliers),
  }
  return { ...state, suppliers: [...state.suppliers, supplier] }
}

export function updateSupplier(state, input) {
  const existing = state.suppliers.find((supplier) => supplier.id === input.id)
  if (!existing) throw new Error('Supplier tidak ditemukan.')
  const updated = {
    ...existing,
    ...normalizeSupplier(input, state.suppliers, existing.id),
  }
  return {
    ...state,
    suppliers: state.suppliers.map((supplier) => supplier.id === existing.id ? updated : supplier),
  }
}

export function deleteSupplier(state, supplierId) {
  if (!state.suppliers.some((supplier) => supplier.id === supplierId)) {
    throw new Error('Supplier tidak ditemukan.')
  }
  if (state.items.some((item) => item.supplierId === supplierId)) {
    throw new Error('Supplier masih digunakan barang. Ubah supplier barang terlebih dahulu.')
  }
  return { ...state, suppliers: state.suppliers.filter((supplier) => supplier.id !== supplierId) }
}

export function recordStockMovement(state, input) {
  const item = state.items.find((record) => record.id === input.itemId && record.isActive)
  if (!item) throw new Error('Pilih barang aktif yang tersedia.')

  const type = String(input.type ?? '').toUpperCase()
  if (!['IN', 'OUT'].includes(type)) throw new Error('Tipe transaksi tidak valid.')
  const quantity = positiveInteger(input.quantity)
  const transactionDate = dateOnly(input.transactionDate)
  const supplierId = optionalText(input.supplierId) || null
  if (type !== 'IN' && supplierId) throw new Error('Supplier hanya dapat dicatat pada Stock In.')
  if (supplierId && !supplierExists(state, supplierId)) {
    throw new Error('Supplier yang dipilih tidak tersedia.')
  }
  if (type === 'OUT' && quantity > item.currentStock) {
    throw new Error(`Stok tersedia hanya ${item.currentStock} ${item.unit}.`)
  }

  const newStock = type === 'IN'
    ? item.currentStock + quantity
    : item.currentStock - quantity
  if (!Number.isSafeInteger(newStock) || newStock < 0) {
    throw new Error('Transaksi akan menghasilkan stok yang tidak valid.')
  }

  const createdAt = now()
  const movement = {
    id: createId(),
    itemId: item.id,
    itemName: item.name,
    itemSku: item.sku,
    type,
    quantity,
    transactionDate,
    notes: optionalText(input.notes),
    supplierId: type === 'IN' ? supplierId : null,
    createdAt,
    createdBy: 'Dira Martin',
  }

  return {
    ...replaceItem(state, { ...item, currentStock: newStock, updatedAt: createdAt }),
    stockMovements: [movement, ...state.stockMovements],
  }
}

export function getDashboardSummary(state) {
  const activeItems = state.items.filter((item) => item.isActive)
  return {
    totalItems: activeItems.length,
    totalStock: activeItems.reduce((total, item) => total + item.currentStock, 0),
    totalCategories: state.categories.length,
    totalSuppliers: state.suppliers.length,
    lowStockItems: activeItems.filter((item) => item.currentStock <= item.minimumStock),
  }
}

export function getSortedMovements(state, filters = {}) {
  const { type = 'ALL', itemId = 'ALL', startDate = '', endDate = '' } = filters
  return state.stockMovements
    .filter((movement) => type === 'ALL' || movement.type === type)
    .filter((movement) => itemId === 'ALL' || movement.itemId === itemId)
    .filter((movement) => !startDate || movement.transactionDate >= startDate)
    .filter((movement) => !endDate || movement.transactionDate <= endDate)
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate) || b.createdAt.localeCompare(a.createdAt))
}

export function getReportSummary(state, filters = {}) {
  const movements = getSortedMovements(state, filters)
  return {
    stockIn: movements.filter((movement) => movement.type === 'IN').reduce((total, movement) => total + movement.quantity, 0),
    stockOut: movements.filter((movement) => movement.type === 'OUT').reduce((total, movement) => total + movement.quantity, 0),
    transactions: movements.length,
  }
}
