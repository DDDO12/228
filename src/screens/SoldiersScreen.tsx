import type { AppState } from '../app/appState'
import { SoldierManager } from '../components/SoldierManager'

export function SoldiersScreen({ app }: { app: AppState }) {
  return (
    <SoldierManager
      divisions={app.divisions}
      sections={app.sections}
      onAdd={app.addSoldier}
      onAddDivision={app.addDivision}
      onAddSection={app.addSection}
      onDelete={(id) => void app.deleteSoldier(id)}
      onDeleteDivision={(id) => void app.deleteDivision(id)}
      onDeleteSection={(id) => void app.deleteSection(id)}
      onUpdate={(id, patch) => void app.updateSoldier(id, patch)}
      onUpdateDivision={app.updateDivision}
      onUpdateSection={app.updateSection}
      soldiers={app.soldiers}
    />
  )
}
