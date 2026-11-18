import { supabase } from '../lib/supabaseClient.js'
import {
  categoryFromRow,
  categoryToRow,
  itemFromRow,
  itemUpdateToRow,
  movementTypeToDatabase,
  newItemToRow,
  stockMovementFromRow,
  stockMovementToRpcArgs,
  supplierFromRow,
  supplierToRow,
  validateTransactionDate,
  validateUuid,
} from './supabaseInventoryMapper.js'

const CATALOG_PAGE_SIZE = 500
const MOVEMENT_PAGE_SIZE_MAX = 500
const CATEGORY_COLUMNS = 'id, name, description, is_active, created_at, updated_at'
const SUPPLIER_COLUMNS = 'id, name, contact_name, phone, email, address, notes, is_active, created_at, updated_at'
const ITEM_COLUMNS = 'id, name, sku, category_id, supplier_id, unit, initial_stock, current_stock, minimum_stock, description, is_active, created_at, updated_at'
const STOCK_MOVEMENT_COLUMNS = `
  id,
  item_id,
  supplier_id,
  movement_type,
  quantity,
  transaction_date,
  notes,
  created_by,
  created_at,
  item:items!stock_movements_item_id_fkey(name, sku, unit),
  supplier:suppliers!stock_movements_supplier_id_fkey(name),
  creator:profiles!stock_movements_created_by_fkey(full_name)
`

function throwItemMutationError(error) {
  if (error?.code === '23505') {
    throw new Error('SKU sudah digunakan barang lain. Gunakan SKU yang berbeda.')
  }
  if (error) throw error
}

async function archiveItem(id) {
  const { data, error } = await supabase
    .from('items')
    .update({ is_active: false })
    .eq('id', id)
    .select(ITEM_COLUMNS)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error(`Item ${id} was not found or is not accessible.`)

  return itemFromRow(data)
}

function sameNullableUuid(left, right) {
  if (left == null || right == null) return left == null && right == null
  return left.toLowerCase() === right.toLowerCase()
}

async function assertActiveRelation(table, id, label, required = false) {
  if (id == null) {
    if (required) throw new Error(`${label} is required. Choose an active ${label.toLowerCase()}.`)
    return
  }

  const { data, error } = await supabase
    .from(table)
    .select('id, is_active')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error(`${label} was not found or is not accessible.`)
  if (data.is_active !== true) throw new Error(`${label} is inactive. Choose an active ${label.toLowerCase()}.`)
}

function errorWithCause(message, cause) {
  const wrappedError = new Error(message)
  wrappedError.cause = cause
  return wrappedError
}

function isStructuredSqlStateError(error) {
  const code = typeof error?.code === 'string' ? error.code.toUpperCase() : ''
  return Boolean(
    error
    && typeof error === 'object'
    && typeof error.message === 'string'
    && /^[0-9A-Z]{5}$/.test(code)
    && code !== '00000'
    && Object.prototype.hasOwnProperty.call(error, 'details')
    && Object.prototype.hasOwnProperty.call(error, 'hint')
    && (error.details === null || typeof error.details === 'string')
    && (error.hint === null || typeof error.hint === 'string'),
  )
}

function isAllowedStockMovementSqlState(error) {
  return isStructuredSqlStateError(error)
    && ['42501', '22023', 'P0002'].includes(error.code.toUpperCase())
}

function stockMovementRpcError(error, responseStatus = null) {
  const message = error?.message || 'Supabase gagal mencatat transaksi.'
  const causeMessage = error?.cause?.message
  const diagnosticMessage = causeMessage
    ? `${message} (${error.cause.name || 'cause'}: ${causeMessage})`
    : message
  const code = typeof error?.code === 'string' ? error.code.toUpperCase() : ''
  const status = Number.isInteger(responseStatus)
    ? responseStatus
    : Number.isInteger(error?.status) ? error.status : null
  const hasDefinitiveDatabaseRejection = status !== null
    && status >= 400
    && status < 500
    && status !== 408
    && status !== 429
    && isAllowedStockMovementSqlState(error)
  const normalizedMessage = message.toLowerCase()

  if (!hasDefinitiveDatabaseRejection) {
    const ambiguousError = errorWithCause(
      `Status transaksi belum dapat dipastikan. Periksa Stock History sebelum mencoba lagi: ${diagnosticMessage}`,
      error,
    )
    ambiguousError.code = 'STOCK_MOVEMENT_OUTCOME_UNKNOWN'
    ambiguousError.outcomeUnknown = true
    return ambiguousError
  }
  if (code === '42501') {
    return errorWithCause('Sesi atau izin tidak valid untuk mencatat transaksi. Periksa kembali status login dan role akun.', error)
  }
  if (code === '22023' && normalizedMessage.includes('insufficient stock')) {
    return errorWithCause('Stok tidak mencukupi untuk mencatat Stock Out.', error)
  }
  if (code === 'P0002' && normalizedMessage.includes('supplier')) {
    return errorWithCause('Supplier tidak ditemukan atau tidak aktif.', error)
  }
  if (code === 'P0002' && normalizedMessage.includes('item')) {
    return errorWithCause('Item tidak ditemukan atau tidak aktif.', error)
  }

  return errorWithCause(`Gagal mencatat pergerakan stok: ${diagnosticMessage}`, error)
}

function committedMovementError(message, movementId = null, cause = undefined) {
  const error = errorWithCause(message, cause)
  error.code = 'STOCK_MOVEMENT_COMMITTED_READBACK_FAILED'
  error.committed = true
  error.movementId = movementId
  return error
}

async function fetchAllRows(createQuery) {
  const rows = []

  for (let offset = 0; ; offset += CATALOG_PAGE_SIZE) {
    const { data, error } = await createQuery()
      .range(offset, offset + CATALOG_PAGE_SIZE - 1)

    if (error) throw error
    if (!Array.isArray(data)) throw new Error('Supabase returned an invalid inventory result.')

    rows.push(...data)
    if (data.length < CATALOG_PAGE_SIZE) return rows
  }
}

export async function listCategories({ activeOnly = false } = {}) {
  const rows = await fetchAllRows(() => {
    let query = supabase
      .from('categories')
      .select(CATEGORY_COLUMNS)
      .order('name', { ascending: true })

    if (activeOnly) query = query.eq('is_active', true)
    return query
  })

  return rows.map(categoryFromRow)
}

export async function createCategory(category) {
  const row = categoryToRow(category)
  const { data, error } = await supabase
    .from('categories')
    .insert(row)
    .select(CATEGORY_COLUMNS)
    .single()

  if (error) throw error
  if (!data) throw new Error('Supabase returned an invalid category result.')

  return categoryFromRow(data)
}

export async function updateCategory(category) {
  const id = validateUuid(category?.id, 'category.id')
  const row = categoryToRow(category)
  const { data, error } = await supabase
    .from('categories')
    .update(row)
    .eq('id', id)
    .select(CATEGORY_COLUMNS)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error(`Category ${id} was not found or is not accessible.`)

  return categoryFromRow(data)
}

export async function deleteCategory(categoryId) {
  const id = validateUuid(categoryId, 'categoryId')
  const { data: items, error: itemError } = await supabase
    .from('items')
    .select('id')
    .eq('category_id', id)
    .limit(1)

  if (itemError) throw itemError
  if (!Array.isArray(items)) throw new Error('Supabase returned an invalid item reference result.')
  if (items.length) throw new Error('Kategori masih digunakan oleh barang dan tidak dapat dihapus.')

  const { data, error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .select(CATEGORY_COLUMNS)
    .maybeSingle()

  if (error?.code === '23503') {
    throw new Error('Kategori masih digunakan oleh barang dan tidak dapat dihapus.')
  }
  if (error) throw error
  if (!data) throw new Error(`Category ${id} was not found or is not accessible.`)

  return categoryFromRow(data)
}

export async function listSuppliers({ activeOnly = false } = {}) {
  const rows = await fetchAllRows(() => {
    let query = supabase
      .from('suppliers')
      .select(SUPPLIER_COLUMNS)
      .order('name', { ascending: true })

    if (activeOnly) query = query.eq('is_active', true)
    return query
  })

  return rows.map(supplierFromRow)
}

export async function createSupplier(supplier) {
  const row = supplierToRow(supplier)
  const { data, error } = await supabase
    .from('suppliers')
    .insert(row)
    .select(SUPPLIER_COLUMNS)
    .single()

  if (error) throw error
  if (!data) throw new Error('Supabase returned an invalid supplier result.')

  return supplierFromRow(data)
}

export async function updateSupplier(supplier) {
  const id = validateUuid(supplier?.id, 'supplier.id')
  const row = supplierToRow(supplier)
  const { data, error } = await supabase
    .from('suppliers')
    .update(row)
    .eq('id', id)
    .select(SUPPLIER_COLUMNS)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error(`Supplier ${id} was not found or is not accessible.`)

  return supplierFromRow(data)
}

export async function deleteSupplier(supplierId) {
  const id = validateUuid(supplierId, 'supplierId')
  const [
    { data: items, error: itemError },
    { data: movements, error: movementError },
  ] = await Promise.all([
    supabase
      .from('items')
      .select('id')
      .eq('supplier_id', id)
      .limit(1),
    supabase
      .from('stock_movements')
      .select('id')
      .eq('supplier_id', id)
      .limit(1),
  ])

  if (itemError) throw itemError
  if (movementError) throw movementError
  if (!Array.isArray(items)) throw new Error('Supabase returned an invalid item reference result.')
  if (!Array.isArray(movements)) throw new Error('Supabase returned an invalid stock movement reference result.')
  if (items.length) throw new Error('Supplier masih digunakan oleh item dan tidak dapat dihapus.')
  if (movements.length) throw new Error('Supplier masih digunakan oleh riwayat transaksi dan tidak dapat dihapus.')

  const { data, error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', id)
    .select(SUPPLIER_COLUMNS)
    .maybeSingle()

  if (error?.code === '23503') {
    throw new Error('Supplier masih digunakan oleh item atau riwayat transaksi dan tidak dapat dihapus.')
  }
  if (error) throw error
  if (!data) throw new Error(`Supplier ${id} was not found or is not accessible.`)

  return supplierFromRow(data)
}

export async function listItems({ activeOnly = false } = {}) {
  const rows = await fetchAllRows(() => {
    let query = supabase
      .from('items')
      .select(ITEM_COLUMNS)
      .order('name', { ascending: true })

    if (activeOnly) query = query.eq('is_active', true)
    return query
  })

  return rows.map(itemFromRow)
}

export async function createItem(item) {
  const row = newItemToRow(item)
  await assertActiveRelation('categories', row.category_id, 'Category', true)
  await assertActiveRelation('suppliers', row.supplier_id, 'Supplier')

  const { data, error } = await supabase
    .from('items')
    .insert(row)
    .select(ITEM_COLUMNS)
    .single()

  throwItemMutationError(error)
  if (!data) throw new Error('Supabase returned an invalid item result.')

  return itemFromRow(data)
}

export async function updateItem(item) {
  const id = validateUuid(item?.id, 'item.id')
  const row = itemUpdateToRow(item)
  const { data: currentRelations, error: relationError } = await supabase
    .from('items')
    .select('category_id, supplier_id')
    .eq('id', id)
    .maybeSingle()

  if (relationError) throw relationError
  if (!currentRelations) throw new Error(`Item ${id} was not found or is not accessible.`)

  if (!sameNullableUuid(row.category_id, currentRelations.category_id)) {
    await assertActiveRelation('categories', row.category_id, 'Category', true)
  }
  if (
    !sameNullableUuid(row.supplier_id, currentRelations.supplier_id)
    && row.supplier_id !== null
  ) {
    await assertActiveRelation('suppliers', row.supplier_id, 'Supplier')
  }

  const { data, error } = await supabase
    .from('items')
    .update(row)
    .eq('id', id)
    .select(ITEM_COLUMNS)
    .maybeSingle()

  throwItemMutationError(error)
  if (!data) throw new Error(`Item ${id} was not found or is not accessible.`)

  return itemFromRow(data)
}

export async function deleteItem(itemId) {
  const id = validateUuid(itemId, 'itemId')
  const { data: movements, error: movementError } = await supabase
    .from('stock_movements')
    .select('id')
    .eq('item_id', id)
    .limit(1)

  if (movementError) throw movementError
  if (!Array.isArray(movements)) {
    throw new Error('Supabase returned an invalid stock movement reference result.')
  }
  if (movements.length) return archiveItem(id)

  const { data, error } = await supabase
    .from('items')
    .delete()
    .eq('id', id)
    .select(ITEM_COLUMNS)
    .maybeSingle()

  if (error?.code === '23503') return archiveItem(id)
  if (error) throw error
  if (!data) throw new Error(`Item ${id} was not found or is not accessible.`)

  return itemFromRow(data)
}

export async function recordStockMovement(movement) {
  const args = stockMovementToRpcArgs(movement)
  if (args.p_movement_type === 'out' && args.p_supplier_id !== null) {
    throw new Error('Supplier tidak boleh diisi untuk Stock Out.')
  }

  let rpcResponse
  try {
    rpcResponse = await supabase.rpc('record_stock_movement', args)
  } catch (rpcFailure) {
    throw stockMovementRpcError(rpcFailure, rpcFailure?.status)
  }
  if (!rpcResponse || typeof rpcResponse !== 'object') {
    throw stockMovementRpcError(new Error('Supabase returned an invalid RPC response.'))
  }

  const { data: rpcResult, error: rpcError, status: rpcStatus } = rpcResponse
  if (rpcError) throw stockMovementRpcError(rpcError, rpcStatus)

  let movementId
  try {
    movementId = validateUuid(rpcResult, 'record_stock_movement result')
  } catch (resultError) {
    throw stockMovementRpcError(
      errorWithCause(
        `RPC berhasil direspons, tetapi hasilnya bukan UUID movement yang valid: ${resultError.message}`,
        resultError,
      ),
    )
  }

  let data
  let error
  try {
    const readback = await supabase
      .from('stock_movements')
      .select(STOCK_MOVEMENT_COLUMNS)
      .eq('id', movementId)
      .single()
    if (!readback || typeof readback !== 'object') {
      throw new Error('Supabase returned an invalid stock movement readback response.')
    }
    data = readback.data
    error = readback.error
  } catch (readbackFailure) {
    throw committedMovementError(
      `Transaksi ${movementId} sudah dicatat, tetapi detailnya gagal dimuat: ${readbackFailure?.message || 'readback rejected.'}`,
      movementId,
      readbackFailure,
    )
  }

  if (error) {
    throw committedMovementError(
      `Transaksi ${movementId} sudah dicatat, tetapi detailnya gagal dimuat: ${error.message}`,
      movementId,
      error,
    )
  }
  if (!data) {
    throw committedMovementError(
      `Transaksi ${movementId} sudah dicatat, tetapi detailnya tidak ditemukan.`,
      movementId,
    )
  }

  try {
    return stockMovementFromRow(data)
  } catch (mappingError) {
    throw committedMovementError(
      `Transaksi ${movementId} sudah dicatat, tetapi detailnya tidak dapat dipetakan: ${mappingError.message}`,
      movementId,
      mappingError,
    )
  }
}

export async function listStockMovements({
  itemId = '',
  type = 'ALL',
  startDate = '',
  endDate = '',
  offset = 0,
  limit = 100,
} = {}) {
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error('Stock movement offset must be a non-negative integer.')
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MOVEMENT_PAGE_SIZE_MAX) {
    throw new Error(`Stock movement limit must be between 1 and ${MOVEMENT_PAGE_SIZE_MAX}.`)
  }

  const movementType = type === 'ALL' ? null : movementTypeToDatabase(type)
  if (startDate) validateTransactionDate(startDate, 'startDate')
  if (endDate) validateTransactionDate(endDate, 'endDate')
  if (startDate && endDate && startDate > endDate) {
    throw new Error('startDate must not be later than endDate.')
  }

  let query = supabase
    .from('stock_movements')
    .select(STOCK_MOVEMENT_COLUMNS)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  if (itemId && itemId !== 'ALL') {
    query = query.eq('item_id', validateUuid(itemId, 'itemId'))
  }
  if (movementType) query = query.eq('movement_type', movementType)
  if (startDate) query = query.gte('transaction_date', startDate)
  if (endDate) query = query.lte('transaction_date', endDate)

  const { data, error } = await query.range(offset, offset + limit)
  if (error) throw error
  if (!Array.isArray(data)) throw new Error('Supabase returned an invalid stock movement result.')

  const hasMore = data.length > limit
  const pageRows = hasMore ? data.slice(0, limit) : data
  return {
    rows: pageRows.map(stockMovementFromRow),
    nextOffset: hasMore ? offset + pageRows.length : null,
  }
}
