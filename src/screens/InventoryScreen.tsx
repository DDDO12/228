import type { AppState } from '../app/appState'
import { InventoryManager } from '../components/InventoryManager'

export function InventoryScreen({ app }: { app: AppState }) {
  return (
    <InventoryManager
      items={app.inventoryItems}
      onAdd={app.addInventoryItem}
      onAdjust={(id, delta) => void app.adjustInventoryItem(id, delta)}
      onDelete={(id) => void app.deleteInventoryItem(id)}
      onUpdate={(id, patch) => void app.updateInventoryItem(id, patch)}
    />
  )
}
