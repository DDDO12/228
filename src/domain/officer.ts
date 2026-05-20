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
  purchaseDate: string
  targetDate: string
  meal: MealType
  officerId: string
  officerName: string
  quantity: number
  createdAt: string
  updatedAt: string
}

export type OfficerTicketBalance = Record<MealType, number>

export interface OfficerUseHistory {
  dayCount: number
  mealCount: number
  ticketCount: number
  unpaidCount: number
  firstDate?: string
  lastDate?: string
}

interface OfficerUseHistoryDraft {
  dates: Set<string>
  mealCount: number
  ticketCount: number
  unpaidCount: number
  firstDate?: string
  lastDate?: string
}

export function emptyOfficerTicketBalance(): OfficerTicketBalance {
  return { breakfast: 0, lunch: 0, dinner: 0 }
}

export function normalizeOfficerTicketPurchase(
  purchase: OfficerTicketPurchase & {
    date?: string
    purchaseDate?: string
    targetDate?: string
  },
): OfficerTicketPurchase {
  const fallbackDate = purchase.targetDate ?? purchase.purchaseDate ?? purchase.date ?? ''
  return {
    ...purchase,
    purchaseDate: purchase.purchaseDate ?? purchase.date ?? fallbackDate,
    targetDate: purchase.targetDate ?? purchase.date ?? fallbackDate,
  }
}

export function createOfficerBalanceMap(purchases: OfficerTicketPurchase[], uses: OfficerMealUse[], targetDate?: string) {
  const balances = new Map<string, OfficerTicketBalance>()

  function ensure(officerId: string) {
    const existing = balances.get(officerId)
    if (existing) return existing
    const next = emptyOfficerTicketBalance()
    balances.set(officerId, next)
    return next
  }

  purchases
    .filter((purchase) => !targetDate || purchase.targetDate === targetDate)
    .forEach((purchase) => {
    ensure(purchase.officerId)[purchase.meal] += purchase.quantity
    })

  uses.forEach((use) => {
    if (use.status === 'ticket' && (!targetDate || use.date === targetDate)) ensure(use.officerId)[use.meal] -= 1
  })

  return balances
}

export function createOfficerUseHistoryMap(uses: OfficerMealUse[], untilDate?: string) {
  const draft = new Map<string, OfficerUseHistoryDraft>()

  function ensure(officerId: string) {
    const existing = draft.get(officerId)
    if (existing) return existing
    const next: OfficerUseHistoryDraft = { dates: new Set<string>(), mealCount: 0, ticketCount: 0, unpaidCount: 0 }
    draft.set(officerId, next)
    return next
  }

  uses
    .filter((use) => !untilDate || use.date <= untilDate)
    .forEach((use) => {
      const history = ensure(use.officerId)
      history.dates.add(use.date)
      history.mealCount += 1
      if (use.status === 'ticket') history.ticketCount += 1
      else history.unpaidCount += 1
      if (!history.firstDate || use.date < history.firstDate) history.firstDate = use.date
      if (!history.lastDate || use.date > history.lastDate) history.lastDate = use.date
    })

  return new Map<string, OfficerUseHistory>(
    Array.from(draft.entries()).map(([officerId, history]) => [
      officerId,
      {
        dayCount: history.dates.size,
        mealCount: history.mealCount,
        ticketCount: history.ticketCount,
        unpaidCount: history.unpaidCount,
        firstDate: history.firstDate,
        lastDate: history.lastDate,
      },
    ]),
  )
}
