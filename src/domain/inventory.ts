export interface InventoryItem {
  id: string
  name: string
  unit: string
  quantity: number
  minimumQuantity: number
  note?: string
  createdAt: string
  updatedAt: string
}

export function isLowStock(item: InventoryItem) {
  return item.quantity <= item.minimumQuantity
}
