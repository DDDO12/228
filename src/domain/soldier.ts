export type Category = 'A' | 'B' | 'C' | 'HQ'

export interface Division {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface Section {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface Soldier {
  id: string
  name: string
  category?: Category
  divisionId?: string
  section?: string
  exceptionStatus?:
    | 'leave'
    | 'dispatch'
    | 'duty'
    | 'mowing'
    | 'medical'
    | 'dutySleep'
    | 'corporalCheckup'
    | 'serving'
    | 'cooking'
    | 'etc'
  exceptionStart?: string
  exceptionUntil?: string
  active: boolean
  note?: string
  createdAt: string
  updatedAt: string
}

export const categories: Category[] = ['A', 'B', 'C', 'HQ']

export function categoryLabel(category: Category) {
  return category === 'HQ' ? '본부' : category
}

export function getDivisionName(divisions: Division[], divisionId?: string) {
  return divisions.find((division) => division.id === divisionId)?.name ?? '미지정'
}
