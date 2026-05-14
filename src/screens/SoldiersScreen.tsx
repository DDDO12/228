import type { AppState } from '../app/appState'
import { SoldierManager } from '../components/SoldierManager'

export function SoldiersScreen({ app }: { app: AppState }) {
  return (
    <SoldierManager
      divisions={app.divisions}
      onAdd={app.addSoldier}
      onAddDivision={app.addDivision}
      onDelete={(id) => void app.deleteSoldier(id)}
      onDeleteDivision={(id) => void app.deleteDivision(id)}
      onUpdate={(id, patch) => void app.updateSoldier(id, patch)}
      onUpdateDivision={app.updateDivision}
      soldiers={app.soldiers}
    />
  )
}
