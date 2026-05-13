import { mealLabels, mealOrder, type MealType } from '../domain/meal'

interface MealSelectorProps {
  meal: MealType
  onChange: (meal: MealType) => void
}

export function MealSelector({ meal, onChange }: MealSelectorProps) {
  return (
    <div className="segmented" role="tablist" aria-label="식사 선택">
      {mealOrder.map((item) => (
        <button
          className={meal === item ? 'active' : ''}
          key={item}
          onClick={() => onChange(item)}
          type="button"
        >
          {mealLabels[item]}
        </button>
      ))}
    </div>
  )
}
