import type { MealType } from './meal'

export interface Officer {
  id: string
  name: string
  unit?: string
  note?: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface OfficerMealUse {
  id: string
  date: string
  meal: MealType
  officerId: string
  officerName: string
  status: 'ticket' | 'unpaid'
  createdAt: string
  updatedAt: string
}

export interface OfficerTicketPurchase {
  id: string
  date: string
  meal: MealType
  officerId: string
  officerName: string
  quantity: number
  createdAt: string
  updatedAt: string
}

export type OfficerTicketBalance = Record<MealType, number>

export function emptyOfficerTicketBalance(): OfficerTicketBalance {
  return { breakfast: 0, lunch: 0, dinner: 0 }
}

export function createOfficerBalanceMap(purchases: OfficerTicketPurchase[], uses: OfficerMealUse[]) {
  const balances = new Map<string, OfficerTicketBalance>()

  function ensure(officerId: string) {
    const existing = balances.get(officerId)
    if (existing) return existing
    const next = emptyOfficerTicketBalance()
    balances.set(officerId, next)
    return next
  }

  purchases.forEach((purchase) => {
    ensure(purchase.officerId)[purchase.meal] += purchase.quantity
  })

  uses.forEach((use) => {
    if (use.status === 'ticket') ensure(use.officerId)[use.meal] -= 1
  })

  return balances
}
