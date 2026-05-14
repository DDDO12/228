export type MealType = 'breakfast' | 'lunch' | 'dinner'

export const mealLabels: Record<MealType, string> = {
  breakfast: '조식',
  lunch: '중식',
  dinner: '석식',
}

export const mealOrder: MealType[] = ['breakfast', 'lunch', 'dinner']

export function suggestMealType(now = new Date()): MealType {
  const hour = now.getHours()
  if (hour < 10) return 'breakfast'
  if (hour < 14) return 'lunch'
  return 'dinner'
}
