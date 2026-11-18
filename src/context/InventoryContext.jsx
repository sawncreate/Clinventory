import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import * as inventoryService from '../services/inventoryService.js'
import {
  createFallbackInventory,
  INVENTORY_STORAGE_KEY,
  loadInventoryData,
  parseInventoryData,
  saveInventoryData,
} from '../services/localStorageRepository.js'
import Toast from '../components/Toast.jsx'

const InventoryContext = createContext(null)

function initializeInventory() {
  try {
    const result = loadInventoryData()
    return { data: result.data, error: null, notice: result.recoveryMessage || null }
  } catch (error) {
    return { data: createFallbackInventory(), error: error.message, notice: null }
  }
}

export function InventoryProvider({ children }) {
  const [initial] = useState(initializeInventory)
  const [data, setData] = useState(initial.data)
  const dataRef = useRef(initial.data)
  const [toast, setToast] = useState(null)

  const notify = useCallback((message, tone = 'success') => {
    setToast({ id: Date.now(), message, tone })
  }, [])
  const dismissToast = useCallback(() => setToast(null), [])

  useEffect(() => {
    if (initial.error) {
      notify(`Penyimpanan lokal tidak tersedia: ${initial.error}`, 'error')
    } else if (initial.notice) {
      notify(initial.notice, 'warning')
    }

    const handleStorage = (event) => {
      if (event.key !== INVENTORY_STORAGE_KEY || event.newValue === null) return
      try {
        const next = parseInventoryData(event.newValue)
        dataRef.current = next
        setData(next)
      } catch (error) {
        notify(`Perubahan dari tab lain tidak dapat dimuat: ${error.message}`, 'error')
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [initial.error, initial.notice, notify])

  const commit = useCallback((operation) => {
    const next = operation(dataRef.current)
    saveInventoryData(next)
    dataRef.current = next
    setData(next)
    return next
  }, [])

  const actions = useMemo(() => ({
    addItem: (input) => commit((current) => inventoryService.addItem(current, input)),
    updateItem: (input) => commit((current) => inventoryService.updateItem(current, input)),
    deleteItem: (id) => commit((current) => inventoryService.deleteItem(current, id)),
    addCategory: (input) => commit((current) => inventoryService.addCategory(current, input)),
    updateCategory: (input) => commit((current) => inventoryService.updateCategory(current, input)),
    deleteCategory: (id) => commit((current) => inventoryService.deleteCategory(current, id)),
    addSupplier: (input) => commit((current) => inventoryService.addSupplier(current, input)),
    updateSupplier: (input) => commit((current) => inventoryService.updateSupplier(current, input)),
    deleteSupplier: (id) => commit((current) => inventoryService.deleteSupplier(current, id)),
    recordStockMovement: (input) => commit((current) => inventoryService.recordStockMovement(current, input)),
  }), [commit])

  const value = useMemo(() => ({
    data,
    actions,
    notify,
    dismissToast,
    dashboard: inventoryService.getDashboardSummary(data),
  }), [actions, data, dismissToast, notify])

  return (
    <InventoryContext.Provider value={value}>
      {children}
      <Toast toast={toast} onDismiss={dismissToast} />
    </InventoryContext.Provider>
  )
}

export function useInventory() {
  const context = useContext(InventoryContext)
  if (!context) throw new Error('useInventory must be used within InventoryProvider.')
  return context
}
