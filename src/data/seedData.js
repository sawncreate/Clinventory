export function createSeedData() {
  const categories = [
    { id: 'category-ppe', name: 'PPE', description: 'Personal protective equipment.' },
    { id: 'category-consumables', name: 'Consumables', description: 'Single-use clinical supplies.' },
    { id: 'category-equipment', name: 'Equipment', description: 'Reusable clinic equipment.' },
    { id: 'category-hygiene', name: 'Hygiene', description: 'Cleaning and hygiene supplies.' },
    { id: 'category-office', name: 'Office supplies', description: 'General clinic office supplies.' },
  ]

  const suppliers = [
    {
      id: 'supplier-medline',
      name: 'Medline Healthcare',
      contact: '(555) 014-2081',
      address: '1200 Harbor Avenue, Springfield',
      email: 'orders@medline.example',
    },
    {
      id: 'supplier-careplus',
      name: 'CarePlus Medical',
      contact: '(555) 016-3490',
      address: '48 Market Street, Springfield',
      email: 'hello@careplus.example',
    },
    {
      id: 'supplier-clinictech',
      name: 'ClinicTech Supplies',
      contact: '(555) 013-7722',
      address: '275 Innovation Drive, Springfield',
      email: 'support@clinictech.example',
    },
    {
      id: 'supplier-safehands',
      name: 'SafeHands Co.',
      contact: '(555) 010-4418',
      address: '9 Garden Lane, Springfield',
      email: 'sales@safehands.example',
    },
  ]

  const items = [
    ['item-med-001', 'Nitrile Examination Gloves', 'MED-001', 'category-ppe', 'supplier-medline', 'boxes', 30, 24, 30, '🧤'],
    ['item-med-002', 'Surgical Face Masks', 'MED-002', 'category-ppe', 'supplier-careplus', 'boxes', 46, 86, 25, '😷'],
    ['item-med-003', 'Alcohol Swabs 70%', 'MED-003', 'category-consumables', 'supplier-medline', 'packs', 28, 18, 20, '🩹'],
    ['item-med-004', 'Digital Thermometer', 'MED-004', 'category-equipment', 'supplier-clinictech', 'units', 8, 12, 5, '🌡️'],
    ['item-med-005', 'Gauze Pads 4×4', 'MED-005', 'category-consumables', 'supplier-careplus', 'packs', 9, 9, 15, '🩹'],
    ['item-med-006', 'Hand Sanitizer 500ml', 'MED-006', 'category-hygiene', 'supplier-safehands', 'bottles', 42, 42, 12, '🧴'],
    ['item-med-007', 'Disposable Syringes 5ml', 'MED-007', 'category-consumables', 'supplier-medline', 'units', 120, 180, 50, '💉'],
    ['item-med-008', 'Blood Pressure Monitor', 'MED-008', 'category-equipment', 'supplier-clinictech', 'units', 4, 4, 3, '🩺'],
    ['item-med-009', 'Disposable Gowns', 'MED-009', 'category-ppe', 'supplier-careplus', 'packs', 14, 14, 20, '🥼'],
  ].map(([id, name, sku, categoryId, supplierId, unit, initialStock, currentStock, minimumStock, icon]) => ({
    id,
    name,
    sku,
    categoryId,
    supplierId,
    unit,
    initialStock,
    currentStock,
    minimumStock,
    description: '',
    icon,
    isActive: true,
    createdAt: '2026-11-01T08:00:00.000Z',
    updatedAt: '2026-11-01T08:00:00.000Z',
  }))

  const stockMovements = [
    { id: 'movement-001', itemId: 'item-med-002', itemName: 'Surgical Face Masks', itemSku: 'MED-002', type: 'IN', quantity: 40, transactionDate: '2026-11-16', notes: 'Monthly restock', createdAt: '2026-11-16T09:10:00.000Z', createdBy: 'Dira Martin' },
    { id: 'movement-002', itemId: 'item-med-001', itemName: 'Nitrile Examination Gloves', itemSku: 'MED-001', type: 'OUT', quantity: 6, transactionDate: '2026-11-16', notes: 'Examination room restock', createdAt: '2026-11-16T08:45:00.000Z', createdBy: 'Dira Martin' },
    { id: 'movement-003', itemId: 'item-med-004', itemName: 'Digital Thermometer', itemSku: 'MED-004', type: 'IN', quantity: 4, transactionDate: '2026-11-15', notes: 'Supplier delivery', createdAt: '2026-11-15T11:30:00.000Z', createdBy: 'James Wilson' },
    { id: 'movement-004', itemId: 'item-med-003', itemName: 'Alcohol Swabs 70%', itemSku: 'MED-003', type: 'OUT', quantity: 10, transactionDate: '2026-11-15', notes: 'Daily clinic use', createdAt: '2026-11-15T08:20:00.000Z', createdBy: 'Dira Martin' },
    { id: 'movement-005', itemId: 'item-med-007', itemName: 'Disposable Syringes 5ml', itemSku: 'MED-007', type: 'IN', quantity: 60, transactionDate: '2026-11-14', notes: 'Weekly supply', createdAt: '2026-11-14T10:00:00.000Z', createdBy: 'James Wilson' },
  ]

  return { version: 1, items, categories, suppliers, stockMovements }
}
