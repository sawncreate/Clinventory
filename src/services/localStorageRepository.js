import { createSeedData } from '../data/seedData.js'
import { assertValidInventoryState } from './inventoryService.js'

export const INVENTORY_STORAGE_KEY = 'clinicstock_inventory_v1'
const BACKUP_PREFIX = 'clinicstock_inventory_corrupt_'
const RECOVERY_NOTICE_KEY = 'clinicstock_inventory_recovery_notice'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

export function parseInventoryData(raw) {
  const data = JSON.parse(raw)
  assertValidInventoryState(data)
  return data
}

function renameLegacyDemoCreator(data) {
  let changed = false
  const stockMovements = data.stockMovements.map((movement) => {
    if (movement.createdBy !== 'Olivia Martin') return movement
    changed = true
    return { ...movement, createdBy: 'Dira Martin' }
  })

  return changed ? { ...data, stockMovements } : data
}

export function saveInventoryData(data) {
  assertValidInventoryState(data)
  window.localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(data))
}

export function loadInventoryData() {
  const raw = window.localStorage.getItem(INVENTORY_STORAGE_KEY)
  if (raw === null) {
    const seed = createSeedData()
    saveInventoryData(seed)
    return { data: seed, recovered: false }
  }

  try {
    const parsedData = parseInventoryData(raw)
    const data = renameLegacyDemoCreator(parsedData)
    if (data !== parsedData) saveInventoryData(data)
    const recoveryMessage = window.localStorage.getItem(RECOVERY_NOTICE_KEY)
    if (recoveryMessage) window.localStorage.removeItem(RECOVERY_NOTICE_KEY)
    return { data, recovered: false, recoveryMessage }
  } catch (error) {
    const backupKey = `${BACKUP_PREFIX}${Date.now()}`
    window.localStorage.setItem(backupKey, raw)
    const seed = createSeedData()
    saveInventoryData(seed)
    const recoveryMessage = `Data lokal tidak valid dan dicadangkan sebagai ${backupKey}. Data demo baru dimuat.`
    window.localStorage.setItem(RECOVERY_NOTICE_KEY, recoveryMessage)
    return {
      data: seed,
      recovered: true,
      recoveryMessage,
      cause: error,
    }
  }
}

export function createFallbackInventory() {
  return clone(createSeedData())
}
