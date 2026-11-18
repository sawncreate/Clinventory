const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MOVEMENT_TYPES = {
  IN: 'in',
  OUT: 'out',
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
}

function requiredText(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`)
  }
  return value.trim()
}

function optionalText(value, label) {
  if (value == null) return ''
  if (typeof value !== 'string') throw new Error(`${label} must be a string or null.`)
  return value
}

function nullableText(value, label) {
  if (value == null || value === '') return null
  if (typeof value !== 'string') throw new Error(`${label} must be a string or null.`)
  return value.trim() || null
}

export function validateUuid(value, label = 'id') {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new Error(`${label} must be a UUID.`)
  }
  return value
}

function nullableUuid(value, label) {
  if (value == null || value === '') return null
  return validateUuid(value, label)
}

function nonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`)
  }
  return value
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`)
  }
  return value
}

function boolean(value, label) {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean.`)
  return value
}

function nullableBoolean(value, label) {
  if (value == null) return undefined
  return boolean(value, label)
}

function timestamp(value, label) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be a valid timestamp.`)
  }
  return value
}

export function validateTransactionDate(value, label = 'transaction_date') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must use YYYY-MM-DD format.`)
  }

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`${label} must be a valid calendar date.`)
  }
  return value
}

export function movementTypeToDatabase(value) {
  if (value !== 'IN' && value !== 'OUT') {
    throw new Error('Movement type must be IN or OUT.')
  }
  return MOVEMENT_TYPES[value]
}

function movementTypeFromDatabase(value) {
  if (value === 'in') return 'IN'
  if (value === 'out') return 'OUT'
  throw new Error('Database movement_type must be in or out.')
}

export function categoryFromRow(row) {
  assertObject(row, 'Category row')
  return {
    id: validateUuid(row.id, 'categories.id'),
    name: requiredText(row.name, 'categories.name'),
    description: optionalText(row.description, 'categories.description'),
    isActive: boolean(row.is_active, 'categories.is_active'),
    createdAt: timestamp(row.created_at, 'categories.created_at'),
    updatedAt: timestamp(row.updated_at, 'categories.updated_at'),
  }
}

export function categoryToRow(category) {
  assertObject(category, 'Category')
  const row = {
    name: requiredText(category.name, 'category.name'),
    description: nullableText(category.description, 'category.description'),
  }
  const isActive = nullableBoolean(category.isActive, 'category.isActive')
  if (isActive !== undefined) row.is_active = isActive
  return row
}

export function supplierFromRow(row) {
  assertObject(row, 'Supplier row')
  return {
    id: validateUuid(row.id, 'suppliers.id'),
    name: requiredText(row.name, 'suppliers.name'),
    contactName: optionalText(row.contact_name, 'suppliers.contact_name'),
    phone: optionalText(row.phone, 'suppliers.phone'),
    email: optionalText(row.email, 'suppliers.email'),
    address: optionalText(row.address, 'suppliers.address'),
    notes: optionalText(row.notes, 'suppliers.notes'),
    isActive: boolean(row.is_active, 'suppliers.is_active'),
    createdAt: timestamp(row.created_at, 'suppliers.created_at'),
    updatedAt: timestamp(row.updated_at, 'suppliers.updated_at'),
  }
}

export function supplierToRow(supplier) {
  assertObject(supplier, 'Supplier')
  if (Object.prototype.hasOwnProperty.call(supplier, 'contact')) {
    throw new Error('Supplier.contact is ambiguous; provide contactName and phone separately.')
  }

  const row = {
    name: requiredText(supplier.name, 'supplier.name'),
    contact_name: nullableText(supplier.contactName, 'supplier.contactName'),
    phone: nullableText(supplier.phone, 'supplier.phone'),
    email: nullableText(supplier.email, 'supplier.email'),
    address: nullableText(supplier.address, 'supplier.address'),
    notes: nullableText(supplier.notes, 'supplier.notes'),
  }
  const isActive = nullableBoolean(supplier.isActive, 'supplier.isActive')
  if (isActive !== undefined) row.is_active = isActive
  return row
}

export function itemFromRow(row) {
  assertObject(row, 'Item row')
  return {
    id: validateUuid(row.id, 'items.id'),
    name: requiredText(row.name, 'items.name'),
    sku: requiredText(row.sku, 'items.sku'),
    categoryId: nullableUuid(row.category_id, 'items.category_id'),
    supplierId: nullableUuid(row.supplier_id, 'items.supplier_id'),
    unit: requiredText(row.unit, 'items.unit'),
    initialStock: nonNegativeInteger(row.initial_stock, 'items.initial_stock'),
    currentStock: nonNegativeInteger(row.current_stock, 'items.current_stock'),
    minimumStock: nonNegativeInteger(row.minimum_stock, 'items.minimum_stock'),
    description: optionalText(row.description, 'items.description'),
    isActive: boolean(row.is_active, 'items.is_active'),
    createdAt: timestamp(row.created_at, 'items.created_at'),
    updatedAt: timestamp(row.updated_at, 'items.updated_at'),
    icon: '📦',
  }
}

export function newItemToRow(item) {
  assertObject(item, 'New item')
  const row = {
    name: requiredText(item.name, 'item.name'),
    sku: requiredText(item.sku, 'item.sku').toUpperCase(),
    category_id: nullableUuid(item.categoryId, 'item.categoryId'),
    supplier_id: nullableUuid(item.supplierId, 'item.supplierId'),
    unit: requiredText(item.unit, 'item.unit'),
    initial_stock: nonNegativeInteger(Number(item.initialStock), 'item.initialStock'),
    minimum_stock: nonNegativeInteger(Number(item.minimumStock), 'item.minimumStock'),
    description: nullableText(item.description, 'item.description'),
  }
  const isActive = nullableBoolean(item.isActive, 'item.isActive')
  if (isActive !== undefined) row.is_active = isActive
  return row
}

export function itemUpdateToRow(item) {
  assertObject(item, 'Item update')
  const row = {
    name: requiredText(item.name, 'item.name'),
    sku: requiredText(item.sku, 'item.sku').toUpperCase(),
    category_id: nullableUuid(item.categoryId, 'item.categoryId'),
    supplier_id: nullableUuid(item.supplierId, 'item.supplierId'),
    unit: requiredText(item.unit, 'item.unit'),
    minimum_stock: nonNegativeInteger(Number(item.minimumStock), 'item.minimumStock'),
    description: nullableText(item.description, 'item.description'),
  }
  const isActive = nullableBoolean(item.isActive, 'item.isActive')
  if (isActive !== undefined) row.is_active = isActive
  return row
}

export function stockMovementFromRow(row) {
  assertObject(row, 'Stock movement row')
  const item = Array.isArray(row.item) ? row.item[0] : row.item
  if (!item) throw new Error('Stock movement row is missing its related item.')
  assertObject(item, 'Stock movement item relation')

  const supplier = Array.isArray(row.supplier) ? row.supplier[0] : row.supplier
  const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator
  return {
    id: validateUuid(row.id, 'stock_movements.id'),
    itemId: validateUuid(row.item_id, 'stock_movements.item_id'),
    itemName: requiredText(item.name, 'stock_movements.item.name'),
    itemSku: requiredText(item.sku, 'stock_movements.item.sku'),
    itemUnit: requiredText(item.unit, 'stock_movements.item.unit'),
    supplierId: nullableUuid(row.supplier_id, 'stock_movements.supplier_id'),
    supplierName: supplier?.name ?? null,
    type: movementTypeFromDatabase(row.movement_type),
    quantity: positiveInteger(row.quantity, 'stock_movements.quantity'),
    transactionDate: validateTransactionDate(row.transaction_date),
    notes: optionalText(row.notes, 'stock_movements.notes'),
    createdById: validateUuid(row.created_by, 'stock_movements.created_by'),
    createdBy: creator?.full_name ?? 'Nama tidak tersedia',
    createdAt: timestamp(row.created_at, 'stock_movements.created_at'),
  }
}

export function stockMovementToRpcArgs(movement) {
  assertObject(movement, 'Stock movement')
  return {
    p_item_id: validateUuid(movement.itemId, 'movement.itemId'),
    p_movement_type: movementTypeToDatabase(movement.type),
    p_quantity: positiveInteger(Number(movement.quantity), 'movement.quantity'),
    p_transaction_date: validateTransactionDate(movement.transactionDate),
    p_notes: nullableText(movement.notes, 'movement.notes'),
    p_supplier_id: nullableUuid(movement.supplierId, 'movement.supplierId'),
  }
}
