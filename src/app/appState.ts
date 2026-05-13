import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createAttendanceRecord,
  normalizeAttendanceStatus,
  syncAttendanceRecord,
  type AttendanceRecord,
  type AttendanceStatus,
} from '../domain/attendance'
import type { InventoryItem } from '../domain/inventory'
import type { DayMemo } from '../domain/memo'
import { suggestMealType, type MealType } from '../domain/meal'
import type { Division, Soldier } from '../domain/soldier'
import { localStore } from '../storage/localStore'
import type { AppBackup } from '../storage/storageAdapter'
import { toDateInputValue } from '../utils/date'
import { createId } from '../utils/id'

const nowIso = () => new Date().toISOString()

function createDivision(name: string): Division {
  const now = nowIso()
  return { id: createId('division'), name, createdAt: now, updatedAt: now }
}

function createInventoryItem(name: string, unit: string, quantity: number, minimumQuantity: number): InventoryItem {
  const now = nowIso()
  return { id: createId('inventory'), name, unit, quantity, minimumQuantity, createdAt: now, updatedAt: now }
}

const seedDivisions: Division[] = ['1분과', '2분과', '본부'].map(createDivision)
const seedInventoryItems: InventoryItem[] = [
  createInventoryItem('김치', 'kg', 20, 5),
  createInventoryItem('계란', '판', 6, 2),
  createInventoryItem('우유', '개', 40, 12),
]

function createSeedSoldiers(divisions: Division[]): Soldier[] {
  return [
    ['김철수', divisions[0]?.id],
    ['박민준', divisions[0]?.id],
    ['이영호', divisions[1]?.id],
    ['최상병', divisions[2]?.id],
  ].map(([name, divisionId], index) => {
    const now = nowIso()
    return {
      id: createId('soldier'),
      name,
      category: index === 3 ? 'HQ' : index === 2 ? 'B' : 'A',
      divisionId,
      active: true,
      createdAt: now,
      updatedAt: now,
    }
  })
}

function migrateSoldiers(soldiers: Soldier[], divisions: Division[]) {
  const fallbackDivision = divisions[0]
  return soldiers.map((soldier) => ({ ...soldier, divisionId: soldier.divisionId ?? fallbackDivision?.id }))
}

export function useAppState() {
  const [divisions, setDivisions] = useState<Division[]>([])
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [memos, setMemos] = useState<DayMemo[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [date, setDate] = useState(toDateInputValue())
  const [meal, setMeal] = useState<MealType>(() => suggestMealType())
  const [isReady, setIsReady] = useState(false)
  const [toast, setToast] = useState('')
  const [lastSavedAt, setLastSavedAt] = useState<string>()
  const [undoRecord, setUndoRecord] = useState<AttendanceRecord>()

  useEffect(() => {
    async function load() {
      const [storedDivisions, storedSoldiers, storedRecords, storedInventory, storedMemos] = await Promise.all([
        localStore.getDivisions(),
        localStore.getSoldiers(),
        localStore.getAttendanceRecords(),
        localStore.getInventoryItems(),
        localStore.getMemos(),
      ])
      const initialDivisions = storedDivisions.length > 0 ? storedDivisions : seedDivisions
      const initialSoldiers =
        storedSoldiers.length > 0 ? migrateSoldiers(storedSoldiers, initialDivisions) : createSeedSoldiers(initialDivisions)
      const initialInventory = storedInventory.length > 0 ? storedInventory : seedInventoryItems

      setDivisions(initialDivisions)
      setSoldiers(initialSoldiers)
      setAttendanceRecords(storedRecords)
      setInventoryItems(initialInventory)
      setMemos(storedMemos)
      if (storedDivisions.length === 0) await localStore.saveDivisions(initialDivisions)
      if (storedSoldiers.length === 0 || storedSoldiers.some((soldier) => !soldier.divisionId)) {
        await localStore.saveSoldiers(initialSoldiers)
      }
      if (storedInventory.length === 0) await localStore.saveInventoryItems(initialInventory)
      setIsReady(true)
    }
    void load()
  }, [])

  const currentRecord = useMemo(() => {
    const existing = attendanceRecords.find((record) => record.date === date && record.meal === meal)
    return existing
      ? syncAttendanceRecord(existing, soldiers, divisions)
      : createAttendanceRecord(date, meal, soldiers, divisions)
  }, [attendanceRecords, date, divisions, meal, soldiers])

  const persistDivisions = useCallback(async (next: Division[]) => {
    setDivisions(next)
    await localStore.saveDivisions(next)
    setLastSavedAt(nowIso())
  }, [])

  const persistSoldiers = useCallback(async (next: Soldier[]) => {
    setSoldiers(next)
    await localStore.saveSoldiers(next)
    setLastSavedAt(nowIso())
  }, [])

  const persistInventoryItems = useCallback(async (next: InventoryItem[]) => {
    setInventoryItems(next)
    await localStore.saveInventoryItems(next)
    setLastSavedAt(nowIso())
  }, [])

  const persistMemos = useCallback(async (next: DayMemo[]) => {
    setMemos(next)
    await localStore.saveMemos(next)
    setLastSavedAt(nowIso())
  }, [])

  const persistRecords = useCallback(async (next: AttendanceRecord[]) => {
    setAttendanceRecords(next)
    await localStore.saveAttendanceRecords(next)
    setLastSavedAt(nowIso())
  }, [])

  const upsertRecord = useCallback(
    async (record: AttendanceRecord) => {
      const next = [
        ...attendanceRecords.filter((item) => item.id !== record.id),
        { ...record, updatedAt: nowIso() },
      ].sort((a, b) => a.id.localeCompare(b.id))
      await persistRecords(next)
    },
    [attendanceRecords, persistRecords],
  )

  const setAttendanceStatus = useCallback(
    async (soldierId: string, status: AttendanceStatus) => {
      setUndoRecord(currentRecord)
      const now = nowIso()
      await upsertRecord({
        ...currentRecord,
        records: currentRecord.records.map((item) =>
          item.soldierId === soldierId ? { ...item, status, ate: status === 'ate', updatedAt: now } : item,
        ),
        updatedAt: now,
      })
    },
    [currentRecord, upsertRecord],
  )

  const toggleAttendance = useCallback(
    async (soldierId: string) => {
      const item = currentRecord.records.find((record) => record.soldierId === soldierId)
      const nextStatus = normalizeAttendanceStatus(item?.status, item?.ate) === 'ate' ? 'missing' : 'ate'
      await setAttendanceStatus(soldierId, nextStatus)
    },
    [currentRecord.records, setAttendanceStatus],
  )

  const bulkSetAttendance = useCallback(
    async (status: AttendanceStatus) => {
      setUndoRecord(currentRecord)
      const now = nowIso()
      await upsertRecord({
        ...currentRecord,
        records: currentRecord.records.map((item) => ({ ...item, status, ate: status === 'ate', updatedAt: now })),
        updatedAt: now,
      })
    },
    [currentRecord, upsertRecord],
  )

  const addDivision = useCallback(
    async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return false
      if (divisions.some((division) => division.name === trimmed)) {
        setToast('이미 같은 이름의 분과가 있습니다.')
        return false
      }
      await persistDivisions([...divisions, createDivision(trimmed)])
      return true
    },
    [divisions, persistDivisions],
  )

  const updateDivision = useCallback(
    async (id: string, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return false
      if (divisions.some((division) => division.id !== id && division.name === trimmed)) {
        setToast('이미 같은 이름의 분과가 있습니다.')
        return false
      }
      const now = nowIso()
      await persistDivisions(
        divisions.map((division) => (division.id === id ? { ...division, name: trimmed, updatedAt: now } : division)),
      )
      return true
    },
    [divisions, persistDivisions],
  )

  const deleteDivision = useCallback(
    async (id: string) => {
      const fallback = divisions.find((division) => division.id !== id)
      await persistDivisions(divisions.filter((division) => division.id !== id))
      await persistSoldiers(
        soldiers.map((soldier) =>
          soldier.divisionId === id ? { ...soldier, divisionId: fallback?.id, updatedAt: nowIso() } : soldier,
        ),
      )
    },
    [divisions, persistDivisions, persistSoldiers, soldiers],
  )

  const addSoldier = useCallback(
    async (input: Pick<Soldier, 'name' | 'divisionId' | 'note'>) => {
      const trimmed = input.name.trim()
      if (!trimmed) return false
      const duplicate = soldiers.find(
        (soldier) => soldier.name.trim() === trimmed && soldier.divisionId === input.divisionId,
      )
      if (duplicate) {
        setToast('같은 분과에 동일한 이름이 있습니다.')
        return false
      }
      const now = nowIso()
      await persistSoldiers([
        ...soldiers,
        {
          id: createId('soldier'),
          name: trimmed,
          divisionId: input.divisionId,
          active: true,
          note: input.note?.trim(),
          createdAt: now,
          updatedAt: now,
        },
      ])
      return true
    },
    [persistSoldiers, soldiers],
  )

  const updateSoldier = useCallback(
    async (id: string, patch: Partial<Soldier>) => {
      const now = nowIso()
      await persistSoldiers(
        soldiers.map((soldier) => (soldier.id === id ? { ...soldier, ...patch, updatedAt: now } : soldier)),
      )
    },
    [persistSoldiers, soldiers],
  )

  const addInventoryItem = useCallback(
    async (input: Pick<InventoryItem, 'name' | 'unit' | 'quantity' | 'minimumQuantity' | 'note'>) => {
      const trimmed = input.name.trim()
      if (!trimmed) return false
      if (inventoryItems.some((item) => item.name === trimmed)) {
        setToast('이미 같은 이름의 재고 품목이 있습니다.')
        return false
      }
      const now = nowIso()
      await persistInventoryItems([
        ...inventoryItems,
        {
          id: createId('inventory'),
          name: trimmed,
          unit: input.unit.trim() || '개',
          quantity: Math.max(0, input.quantity),
          minimumQuantity: Math.max(0, input.minimumQuantity),
          note: input.note?.trim(),
          createdAt: now,
          updatedAt: now,
        },
      ])
      return true
    },
    [inventoryItems, persistInventoryItems],
  )

  const updateInventoryItem = useCallback(
    async (id: string, patch: Partial<InventoryItem>) => {
      const now = nowIso()
      await persistInventoryItems(
        inventoryItems.map((item) =>
          item.id === id
            ? {
                ...item,
                ...patch,
                quantity: patch.quantity === undefined ? item.quantity : Math.max(0, patch.quantity),
                minimumQuantity:
                  patch.minimumQuantity === undefined ? item.minimumQuantity : Math.max(0, patch.minimumQuantity),
                updatedAt: now,
              }
            : item,
        ),
      )
    },
    [inventoryItems, persistInventoryItems],
  )

  const adjustInventoryItem = useCallback(
    async (id: string, delta: number) => {
      const item = inventoryItems.find((entry) => entry.id === id)
      if (!item) return
      await updateInventoryItem(id, { quantity: item.quantity + delta })
    },
    [inventoryItems, updateInventoryItem],
  )

  const deleteInventoryItem = useCallback(
    async (id: string) => {
      await persistInventoryItems(inventoryItems.filter((item) => item.id !== id))
    },
    [inventoryItems, persistInventoryItems],
  )

  const saveMemo = useCallback(
    async (memoDate: string, content: string) => {
      const trimmed = content.trim()
      const next = trimmed
        ? [
            ...memos.filter((memo) => memo.date !== memoDate),
            { date: memoDate, content, updatedAt: nowIso() },
          ].sort((a, b) => a.date.localeCompare(b.date))
        : memos.filter((memo) => memo.date !== memoDate)
      await persistMemos(next)
    },
    [memos, persistMemos],
  )

  const importBackup = useCallback(async (backup: AppBackup) => {
    const nextDivisions = backup.divisions?.length ? backup.divisions : seedDivisions
    const nextSoldiers = migrateSoldiers(backup.soldiers, nextDivisions)
    const nextInventory = backup.inventoryItems ?? []
    const nextMemos = backup.memos ?? []
    await localStore.importBackup({
      ...backup,
      divisions: nextDivisions,
      soldiers: nextSoldiers,
      inventoryItems: nextInventory,
      memos: nextMemos,
    })
    setDivisions(nextDivisions)
    setSoldiers(nextSoldiers)
    setInventoryItems(nextInventory)
    setMemos(nextMemos)
    setAttendanceRecords(backup.attendanceRecords)
    setLastSavedAt(nowIso())
  }, [])

  const resetCurrentRecord = useCallback(async () => {
    await upsertRecord(createAttendanceRecord(date, meal, soldiers, divisions))
  }, [date, divisions, meal, soldiers, upsertRecord])

  const resetAll = useCallback(async () => {
    await persistDivisions([])
    await persistSoldiers([])
    await persistInventoryItems([])
    await persistMemos([])
    await persistRecords([])
  }, [persistDivisions, persistInventoryItems, persistMemos, persistRecords, persistSoldiers])

  const undo = useCallback(async () => {
    if (!undoRecord) return
    await upsertRecord(undoRecord)
    setUndoRecord(undefined)
  }, [undoRecord, upsertRecord])

  return {
    addDivision,
    addInventoryItem,
    addSoldier,
    adjustInventoryItem,
    attendanceRecords,
    bulkSetAttendance,
    currentRecord,
    date,
    deleteDivision,
    deleteInventoryItem,
    divisions,
    importBackup,
    inventoryItems,
    isReady,
    lastSavedAt,
    meal,
    memos,
    resetAll,
    resetCurrentRecord,
    saveMemo,
    setAttendanceStatus,
    setDate,
    setMeal,
    setToast,
    soldiers,
    toast,
    toggleAttendance,
    undo,
    undoRecord,
    updateDivision,
    updateInventoryItem,
    updateSoldier,
  }
}

export type AppState = ReturnType<typeof useAppState>
