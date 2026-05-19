export interface InventoryItem {
  id: string
  name: string
  manufacturer?: string
  unit: string
  quantity: number
  minimumQuantity: number
  unitAmount?: string
  purpose?: string
  note?: string
  dailyConsumptionEnabled?: boolean
  dailyConsumptionAmount?: number
  lastDailyConsumptionDate?: string
  createdAt: string
  updatedAt: string
}

export const militaryRiceName = '군량곡'
export const militaryRiceUnit = '가마'
export const militaryRiceDailyConsumption = 1.5

export function isLowStock(item: InventoryItem) {
  return item.quantity <= item.minimumQuantity
}

export function isMilitaryRice(item: Pick<InventoryItem, 'name'>) {
  return item.name.trim() === militaryRiceName
}

export function resolveDailyConsumption(item: InventoryItem) {
  const isRice = isMilitaryRice(item)
  const amount = isRice ? militaryRiceDailyConsumption : Math.max(0, item.dailyConsumptionAmount ?? 0)

  return {
    enabled: (isRice || item.dailyConsumptionEnabled === true) && amount > 0,
    amount,
  }
}

function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00`).getTime()
}

function elapsedDays(from: string, to: string) {
  if (from >= to) return 0
  const diff = parseDateOnly(to) - parseDateOnly(from)
  return Math.max(0, Math.floor(diff / 86_400_000))
}

export function applyDailyInventoryConsumption(items: InventoryItem[], today: string) {
  let changed = false
  const nextItems = items.map((item) => {
    const daily = resolveDailyConsumption(item)
    const normalized: InventoryItem = isMilitaryRice(item)
      ? {
          ...item,
          unit: militaryRiceUnit,
          dailyConsumptionEnabled: true,
          dailyConsumptionAmount: militaryRiceDailyConsumption,
        }
      : {
          ...item,
          dailyConsumptionEnabled: item.dailyConsumptionEnabled === true,
          dailyConsumptionAmount: Math.max(0, item.dailyConsumptionAmount ?? 0),
        }

    if (!daily.enabled) {
      if (
        normalized.dailyConsumptionEnabled !== item.dailyConsumptionEnabled ||
        normalized.dailyConsumptionAmount !== item.dailyConsumptionAmount
      ) {
        changed = true
      }
      return normalized
    }

    if (!item.lastDailyConsumptionDate) {
      changed = true
      return { ...normalized, lastDailyConsumptionDate: today }
    }

    const days = elapsedDays(item.lastDailyConsumptionDate, today)
    if (days <= 0) {
      if (
        normalized.dailyConsumptionEnabled !== item.dailyConsumptionEnabled ||
        normalized.dailyConsumptionAmount !== item.dailyConsumptionAmount ||
        normalized.unit !== item.unit
      ) {
        changed = true
      }
      return normalized
    }

    changed = true
    return {
      ...normalized,
      quantity: Math.max(0, Number((item.quantity - daily.amount * days).toFixed(2))),
      lastDailyConsumptionDate: today,
      updatedAt: new Date().toISOString(),
    }
  })

  return { items: nextItems, changed }
}
