import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createAttendanceRecord,
  fixedExceptionUntil,
  isAteStatus,
  syncAttendanceRecord,
  type AttendanceRecord,
  type AttendanceStatus,
  type MissingReason,
  type ScheduledExceptionStatus,
} from '../domain/attendance'
import type { InventoryItem } from '../domain/inventory'
import type { DayMemo } from '../domain/memo'
import {
  createOfficerBalanceMap,
  type Officer,
  type OfficerMealUse,
  type OfficerTicketPurchase,
} from '../domain/officer'
import { mealLabels, mealOrder, suggestMealType, type MealType } from '../domain/meal'
import type { Division, Section, Soldier } from '../domain/soldier'
import { localStore } from '../storage/localStore'
import type { AppBackup } from '../storage/storageAdapter'
import { toDateInputValue } from '../utils/date'
import { createId } from '../utils/id'

const nowIso = () => new Date().toISOString()

function createDivision(name: string): Division {
  const now = nowIso()
  return { id: createId('division'), name, createdAt: now, updatedAt: now }
}

function createSection(name: string): Section {
  const now = nowIso()
  return { id: createId('section'), name, createdAt: now, updatedAt: now }
}

function createInventoryItem(name: string, unit: string, quantity: number, minimumQuantity: number): InventoryItem {
  const now = nowIso()
  return { id: createId('inventory'), name, unit, quantity, minimumQuantity, createdAt: now, updatedAt: now }
}

function createOfficer(name: string): Officer {
  const now = nowIso()
  return { id: createId('officer'), name, active: true, createdAt: now, updatedAt: now }
}

const seedDivisions: Division[] = ['1포대', '2포대', '본부'].map(createDivision)
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

function migrateDivisions(divisions: Division[]) {
  return divisions.map((division) => ({
    ...division,
    name: division.name.replace(/분과$/u, '포대'),
  }))
}

function migrateSoldiers(soldiers: Soldier[], divisions: Division[]) {
  const fallbackDivision = divisions[0]
  return soldiers.map((soldier) => ({
    ...soldier,
    divisionId: soldier.divisionId ?? fallbackDivision?.id,
    exceptionUntil: soldier.exceptionStatus === 'cooking' || soldier.exceptionStatus === 'room' ? fixedExceptionUntil : soldier.exceptionUntil,
  }))
}

function deriveSections(soldiers: Soldier[]) {
  return Array.from(new Set(soldiers.map((soldier) => soldier.section?.trim()).filter((item): item is string => Boolean(item))))
    .sort()
    .map(createSection)
}

export function useAppState() {
  const [divisions, setDivisions] = useState<Division[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [memos, setMemos] = useState<DayMemo[]>([])
  const [officers, setOfficers] = useState<Officer[]>([])
  const [officerMealUses, setOfficerMealUses] = useState<OfficerMealUse[]>([])
  const [officerTicketPurchases, setOfficerTicketPurchases] = useState<OfficerTicketPurchase[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [date, setDate] = useState(toDateInputValue())
  const [meal, setMealState] = useState<MealType>(() => suggestMealType())
  const [isReady, setIsReady] = useState(false)
  const [toast, setToast] = useState('')
  const [lastSavedAt, setLastSavedAt] = useState<string>()
  const [undoRecord, setUndoRecord] = useState<AttendanceRecord>()
  const divisionsRef = useRef(divisions)
  const soldiersRef = useRef(soldiers)
  const attendanceRecordsRef = useRef(attendanceRecords)
  const dateRef = useRef(date)
  const mealRef = useRef(meal)

  useEffect(() => {
    divisionsRef.current = divisions
  }, [divisions])

  useEffect(() => {
    soldiersRef.current = soldiers
  }, [soldiers])

  useEffect(() => {
    attendanceRecordsRef.current = attendanceRecords
  }, [attendanceRecords])

  useEffect(() => {
    dateRef.current = date
  }, [date])

  useEffect(() => {
    mealRef.current = meal
  }, [meal])

  useEffect(() => {
    async function load() {
      const [
        storedDivisions,
        storedSections,
        storedSoldiers,
        storedRecords,
        storedInventory,
        storedMemos,
        storedOfficers,
        storedOfficerUses,
        storedOfficerPurchases,
      ] = await Promise.all([
        localStore.getDivisions(),
        localStore.getSections(),
        localStore.getSoldiers(),
        localStore.getAttendanceRecords(),
        localStore.getInventoryItems(),
        localStore.getMemos(),
        localStore.getOfficers(),
        localStore.getOfficerMealUses(),
        localStore.getOfficerTicketPurchases(),
      ])
      const initialDivisions = storedDivisions.length > 0 ? migrateDivisions(storedDivisions) : seedDivisions
      const initialSoldiers =
        storedSoldiers.length > 0 ? migrateSoldiers(storedSoldiers, initialDivisions) : createSeedSoldiers(initialDivisions)
      const initialSections = storedSections.length > 0 ? storedSections : deriveSections(initialSoldiers)
      const initialInventory = storedInventory.length > 0 ? storedInventory : seedInventoryItems

      setDivisions(initialDivisions)
      setSections(initialSections)
      setSoldiers(initialSoldiers)
      setAttendanceRecords(storedRecords)
      setInventoryItems(initialInventory)
      setMemos(storedMemos)
      setOfficers(storedOfficers)
      setOfficerMealUses(storedOfficerUses)
      setOfficerTicketPurchases(storedOfficerPurchases)
      if (storedDivisions.length === 0 || storedDivisions.some((division) => division.name.endsWith('분과'))) {
        await localStore.saveDivisions(initialDivisions)
      }
      if (storedSections.length === 0 && initialSections.length > 0) await localStore.saveSections(initialSections)
      if (
        storedSoldiers.length === 0 ||
        storedSoldiers.some(
          (soldier) =>
            !soldier.divisionId ||
            ((soldier.exceptionStatus === 'cooking' || soldier.exceptionStatus === 'room') && soldier.exceptionUntil !== fixedExceptionUntil),
        )
      ) {
        await localStore.saveSoldiers(initialSoldiers)
      }
      if (storedInventory.length === 0) await localStore.saveInventoryItems(initialInventory)
      setIsReady(true)
    }
    void load()
  }, [])

  useEffect(() => {
    const syncMeal = () => setMealState(suggestMealType())
    syncMeal()
    const timer = window.setInterval(syncMeal, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const currentRecord = useMemo(() => {
    const existing = attendanceRecords.find((record) => record.date === date && record.meal === meal)
    return existing
      ? syncAttendanceRecord(existing, soldiers, divisions)
      : createAttendanceRecord(date, meal, soldiers, divisions)
  }, [attendanceRecords, date, divisions, meal, soldiers])

  const getLatestCurrentRecord = useCallback(() => {
    const latestDate = dateRef.current
    const latestMeal = mealRef.current
    const latestRecords = attendanceRecordsRef.current
    const latestSoldiers = soldiersRef.current
    const latestDivisions = divisionsRef.current
    const existing = latestRecords.find((record) => record.date === latestDate && record.meal === latestMeal)
    return existing
      ? syncAttendanceRecord(existing, latestSoldiers, latestDivisions)
      : createAttendanceRecord(latestDate, latestMeal, latestSoldiers, latestDivisions)
  }, [])

  const persistDivisions = useCallback(async (next: Division[]) => {
    divisionsRef.current = next
    setDivisions(next)
    await localStore.saveDivisions(next)
    setLastSavedAt(nowIso())
  }, [])

  const persistSections = useCallback(async (next: Section[]) => {
    setSections(next)
    await localStore.saveSections(next)
    setLastSavedAt(nowIso())
  }, [])

  const persistSoldiers = useCallback(async (next: Soldier[]) => {
    soldiersRef.current = next
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

  const persistOfficers = useCallback(async (next: Officer[]) => {
    setOfficers(next)
    await localStore.saveOfficers(next)
    setLastSavedAt(nowIso())
  }, [])

  const persistOfficerMealUses = useCallback(async (next: OfficerMealUse[]) => {
    setOfficerMealUses(next)
    await localStore.saveOfficerMealUses(next)
    setLastSavedAt(nowIso())
  }, [])

  const persistOfficerTicketPurchases = useCallback(async (next: OfficerTicketPurchase[]) => {
    setOfficerTicketPurchases(next)
    await localStore.saveOfficerTicketPurchases(next)
    setLastSavedAt(nowIso())
  }, [])

  const persistRecords = useCallback(async (next: AttendanceRecord[]) => {
    attendanceRecordsRef.current = next
    setAttendanceRecords(next)
    await localStore.saveAttendanceRecords(next)
    setLastSavedAt(nowIso())
  }, [])

  const upsertRecord = useCallback(
    async (record: AttendanceRecord) => {
      const latestRecords = attendanceRecordsRef.current
      const next = [
        ...latestRecords.filter((item) => item.id !== record.id),
        { ...record, updatedAt: nowIso() },
      ].sort((a, b) => a.id.localeCompare(b.id))
      await persistRecords(next)
    },
    [persistRecords],
  )

  const setAttendanceStatus = useCallback(
    async (soldierId: string, status: AttendanceStatus, missingReason?: MissingReason) => {
      const activeRecord = getLatestCurrentRecord()
      const activeRecords = attendanceRecordsRef.current
      const activeSoldiers = soldiersRef.current
      const activeDivisions = divisionsRef.current
      setUndoRecord(activeRecord)
      const now = nowIso()
      if (status === 'serving' || status === 'cooking' || status === 'room') {
        const targetItem = activeRecord.records.find((item) => item.soldierId === soldierId)
        if (status === 'serving') {
          const servingCount = activeRecord.records.filter(
            (item) => item.soldierId !== soldierId && item.divisionId === targetItem?.divisionId && item.status === 'serving',
          ).length
          if (servingCount >= 2) {
            setToast(`${targetItem?.divisionName ?? '해당 포대'} 배식은 최대 2명까지 가능합니다.`)
            return
          }
        }
        const nextSoldiers = activeSoldiers.map((soldier) =>
          soldier.id === soldierId
            ? {
                ...soldier,
                exceptionStatus: status,
                exceptionStart: activeRecord.date,
                exceptionUntil: status === 'cooking' || status === 'room' ? fixedExceptionUntil : activeRecord.date,
                updatedAt: now,
              }
            : soldier,
        )
        await persistSoldiers(nextSoldiers)
        const nextRecords = mealOrder.flatMap((itemMeal) => {
          const existing = activeRecords.find((record) => record.date === activeRecord.date && record.meal === itemMeal)
          if (status !== 'cooking' && status !== 'room' && !existing && itemMeal !== activeRecord.meal) return []
          const base = existing
            ? syncAttendanceRecord(existing, nextSoldiers, activeDivisions)
            : createAttendanceRecord(activeRecord.date, itemMeal, nextSoldiers, activeDivisions)
          return [{
            ...base,
            records: base.records.map((item) =>
              item.soldierId === soldierId
                ? {
                    ...item,
                    status,
                    exceptionStart: status === 'cooking' || status === 'room' ? undefined : activeRecord.date,
                    exceptionUntil: status === 'cooking' || status === 'room' ? undefined : activeRecord.date,
                    missingReason: undefined,
                    ate: true,
                    updatedAt: now,
                  }
                : item,
            ),
            updatedAt: now,
          }]
        })
        const untouchedRecords = activeRecords.filter((record) => record.date !== activeRecord.date)
        await persistRecords([...untouchedRecords, ...nextRecords].sort((a, b) => a.id.localeCompare(b.id)))
        return
      }
      const nextSoldiers = activeSoldiers.map((soldier) =>
        soldier.id === soldierId
          ? { ...soldier, exceptionStatus: undefined, exceptionStart: undefined, exceptionUntil: undefined, updatedAt: now }
          : soldier,
      )
      await persistSoldiers(nextSoldiers)
      await upsertRecord({
        ...activeRecord,
        records: activeRecord.records.map((item) =>
          item.soldierId === soldierId
            ? {
                ...item,
                status,
                exceptionStart: undefined,
                exceptionUntil: undefined,
                missingReason: status === 'missing' ? missingReason : undefined,
                ate: isAteStatus(status),
                updatedAt: now,
              }
            : item,
        ),
        updatedAt: now,
      })
    },
    [getLatestCurrentRecord, persistRecords, persistSoldiers, upsertRecord],
  )

  const setScheduledException = useCallback(
    async (soldierId: string, status: ScheduledExceptionStatus, start: string, until: string) => {
      const activeRecord = getLatestCurrentRecord()
      const activeSoldiers = soldiersRef.current
      setUndoRecord(activeRecord)
      const now = nowIso()
      const nextSoldiers = activeSoldiers.map((soldier) =>
        soldier.id === soldierId
          ? { ...soldier, exceptionStatus: status, exceptionStart: start, exceptionUntil: until, updatedAt: now }
          : soldier,
      )
      await persistSoldiers(nextSoldiers)
      const appliesToCurrentDate = start <= activeRecord.date && until >= activeRecord.date
      const recordStatus = appliesToCurrentDate ? status : 'missing'
      await upsertRecord({
        ...activeRecord,
        records: activeRecord.records.map((item) =>
          item.soldierId === soldierId
            ? {
                ...item,
                status: recordStatus,
                exceptionStart: appliesToCurrentDate ? start : undefined,
                exceptionUntil: appliesToCurrentDate ? until : undefined,
                missingReason: undefined,
                ate: isAteStatus(recordStatus),
                updatedAt: now,
              }
            : item,
        ),
        updatedAt: now,
      })
    },
    [getLatestCurrentRecord, persistSoldiers, upsertRecord],
  )

  const clearScheduledException = useCallback(
    async (soldierId: string) => {
      const activeRecord = getLatestCurrentRecord()
      const activeSoldiers = soldiersRef.current
      setUndoRecord(activeRecord)
      const now = nowIso()
      await persistSoldiers(
        activeSoldiers.map((soldier) =>
          soldier.id === soldierId
            ? { ...soldier, exceptionStatus: undefined, exceptionStart: undefined, exceptionUntil: undefined, updatedAt: now }
            : soldier,
        ),
      )
      await upsertRecord({
        ...activeRecord,
        records: activeRecord.records.map((item) =>
          item.soldierId === soldierId
            ? {
                ...item,
                status: 'missing',
                exceptionStart: undefined,
                exceptionUntil: undefined,
                missingReason: undefined,
                ate: false,
                updatedAt: now,
              }
            : item,
        ),
        updatedAt: now,
      })
    },
    [getLatestCurrentRecord, persistSoldiers, upsertRecord],
  )

  const toggleAttendance = useCallback(
    async (soldierId: string) => {
      const activeRecord = getLatestCurrentRecord()
      const item = activeRecord.records.find((record) => record.soldierId === soldierId)
      if (item?.status === 'leave' && item.exceptionUntil) {
        setToast('휴가 기간 중인 인원은 카드 터치로 변경되지 않습니다.')
        return
      }
      const nextStatus = isAteStatus(item?.status, item?.ate) ? 'missing' : 'ate'
      await setAttendanceStatus(soldierId, nextStatus)
    },
    [getLatestCurrentRecord, setAttendanceStatus],
  )

  const addDivision = useCallback(
    async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return false
      if (divisions.some((division) => division.name === trimmed)) {
        setToast('이미 같은 이름의 포대가 있습니다.')
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
        setToast('이미 같은 이름의 포대가 있습니다.')
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

  const addSection = useCallback(
    async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return false
      if (sections.some((section) => section.name === trimmed)) {
        setToast('이미 같은 이름의 분과가 있습니다.')
        return false
      }
      await persistSections([...sections, createSection(trimmed)])
      return true
    },
    [persistSections, sections],
  )

  const updateSection = useCallback(
    async (id: string, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return false
      if (sections.some((section) => section.id !== id && section.name === trimmed)) {
        setToast('이미 같은 이름의 분과가 있습니다.')
        return false
      }
      const current = sections.find((section) => section.id === id)
      if (!current) return false
      const now = nowIso()
      await persistSections(sections.map((section) => (section.id === id ? { ...section, name: trimmed, updatedAt: now } : section)))
      await persistSoldiers(
        soldiers.map((soldier) => (soldier.section === current.name ? { ...soldier, section: trimmed, updatedAt: now } : soldier)),
      )
      return true
    },
    [persistSections, persistSoldiers, sections, soldiers],
  )

  const deleteSection = useCallback(
    async (id: string) => {
      const current = sections.find((section) => section.id === id)
      if (!current) return
      const now = nowIso()
      await persistSections(sections.filter((section) => section.id !== id))
      await persistSoldiers(
        soldiers.map((soldier) => (soldier.section === current.name ? { ...soldier, section: undefined, updatedAt: now } : soldier)),
      )
    },
    [persistSections, persistSoldiers, sections, soldiers],
  )

  const addSoldier = useCallback(
    async (input: Pick<Soldier, 'name' | 'divisionId' | 'section' | 'note'>) => {
      const trimmed = input.name.trim()
      if (!trimmed) return false
      const duplicate = soldiers.find(
        (soldier) => soldier.name.trim() === trimmed && soldier.divisionId === input.divisionId,
      )
      if (duplicate) {
        setToast('같은 포대에 동일한 이름이 있습니다.')
        return false
      }
      const now = nowIso()
      await persistSoldiers([
        ...soldiers,
        {
          id: createId('soldier'),
          name: trimmed,
          divisionId: input.divisionId,
          section: input.section?.trim(),
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

  const updateSoldiersBulk = useCallback(
    async (ids: string[], patch: Partial<Soldier>) => {
      if (ids.length === 0) return
      const targets = new Set(ids)
      const now = nowIso()
      await persistSoldiers(
        soldiers.map((soldier) => (targets.has(soldier.id) ? { ...soldier, ...patch, updatedAt: now } : soldier)),
      )
    },
    [persistSoldiers, soldiers],
  )

  const deleteSoldier = useCallback(
    async (id: string) => {
      await persistSoldiers(soldiers.filter((soldier) => soldier.id !== id))
      await persistRecords(
        attendanceRecords.map((record) => ({
          ...record,
          records: record.records.filter((item) => item.soldierId !== id),
          updatedAt: nowIso(),
        })),
      )
    },
    [attendanceRecords, persistRecords, persistSoldiers, soldiers],
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

  const addOfficerMealUse = useCallback(
    async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return false
      const now = nowIso()
      const existingOfficer = officers.find((officer) => officer.name.trim() === trimmed)
      const officer = existingOfficer ?? createOfficer(trimmed)
      const nextOfficers = existingOfficer ? officers : [...officers, officer]
      const duplicate = officerMealUses.some(
        (use) => use.date === date && use.meal === meal && use.officerId === officer.id,
      )
      if (duplicate) {
        setToast('이미 해당 식사에 등록된 간부입니다.')
        return false
      }
      const balance = createOfficerBalanceMap(officerTicketPurchases, officerMealUses).get(officer.id)
      const status: OfficerMealUse['status'] = balance && balance[meal] > 0 ? 'ticket' : 'unpaid'
      const nextUses = [
        ...officerMealUses,
        {
          id: createId('officer-use'),
          date,
          meal,
          officerId: officer.id,
          officerName: officer.name,
          status,
          createdAt: now,
          updatedAt: now,
        },
      ]
      if (!existingOfficer) await persistOfficers(nextOfficers)
      await persistOfficerMealUses(nextUses)
      return true
    },
    [date, meal, officerMealUses, officerTicketPurchases, officers, persistOfficerMealUses, persistOfficers],
  )

  const deleteOfficerMealUse = useCallback(
    async (id: string) => {
      await persistOfficerMealUses(officerMealUses.filter((use) => use.id !== id))
    },
    [officerMealUses, persistOfficerMealUses],
  )

  const addOfficerTicketPurchase = useCallback(
    async (name: string, purchaseMeal: MealType, quantity: number) => {
      const trimmed = name.trim()
      const safeQuantity = Math.max(0, Math.floor(quantity))
      if (!trimmed || safeQuantity <= 0) return false
      const now = nowIso()
      const existingOfficer = officers.find((officer) => officer.name.trim() === trimmed)
      const officer = existingOfficer ?? createOfficer(trimmed)
      const nextOfficers = existingOfficer ? officers : [...officers, officer]
      const purchase: OfficerTicketPurchase = {
        id: createId('officer-purchase'),
        date,
        meal: purchaseMeal,
        officerId: officer.id,
        officerName: officer.name,
        quantity: safeQuantity,
        createdAt: now,
        updatedAt: now,
      }
      let remaining = safeQuantity
      const nextUses = officerMealUses
        .slice()
        .sort((a, b) => `${a.date}-${a.createdAt}`.localeCompare(`${b.date}-${b.createdAt}`))
        .map((use) => {
          if (remaining <= 0 || use.officerId !== officer.id || use.meal !== purchaseMeal || use.status !== 'unpaid') return use
          remaining -= 1
          return { ...use, status: 'ticket' as const, updatedAt: now }
        })
      if (!existingOfficer) await persistOfficers(nextOfficers)
      await persistOfficerTicketPurchases([...officerTicketPurchases, purchase])
      await persistOfficerMealUses(nextUses)
      return true
    },
    [
      date,
      officerMealUses,
      officerTicketPurchases,
      officers,
      persistOfficerMealUses,
      persistOfficerTicketPurchases,
      persistOfficers,
    ],
  )

  const setMeal = useCallback((nextMeal: MealType) => {
    const lockedMeal = suggestMealType()
    if (nextMeal !== lockedMeal) {
      setMealState(lockedMeal)
      setToast(`현재 시간대는 ${mealLabels[lockedMeal]}으로 고정됩니다.`)
      return
    }
    setMealState(nextMeal)
  }, [])

  const importBackup = useCallback(async (backup: AppBackup) => {
    const nextDivisions = backup.divisions?.length ? migrateDivisions(backup.divisions) : seedDivisions
    const nextSoldiers = migrateSoldiers(backup.soldiers, nextDivisions)
    const nextSections = backup.sections?.length ? backup.sections : deriveSections(nextSoldiers)
    const nextInventory = backup.inventoryItems ?? []
    const nextMemos = backup.memos ?? []
    const nextOfficers = backup.officers ?? []
    const nextOfficerUses = backup.officerMealUses ?? []
    const nextOfficerPurchases = backup.officerTicketPurchases ?? []
    await localStore.importBackup({
      ...backup,
      divisions: nextDivisions,
      sections: nextSections,
      soldiers: nextSoldiers,
      inventoryItems: nextInventory,
      memos: nextMemos,
      officers: nextOfficers,
      officerMealUses: nextOfficerUses,
      officerTicketPurchases: nextOfficerPurchases,
    })
    setDivisions(nextDivisions)
    setSections(nextSections)
    setSoldiers(nextSoldiers)
    setInventoryItems(nextInventory)
    setMemos(nextMemos)
    setOfficers(nextOfficers)
    setOfficerMealUses(nextOfficerUses)
    setOfficerTicketPurchases(nextOfficerPurchases)
    setAttendanceRecords(backup.attendanceRecords)
    setLastSavedAt(nowIso())
  }, [])

  const resetCurrentRecord = useCallback(async () => {
    await upsertRecord(createAttendanceRecord(date, meal, soldiers, divisions))
  }, [date, divisions, meal, soldiers, upsertRecord])

  const resetAll = useCallback(async () => {
    await persistDivisions([])
    await persistSections([])
    await persistSoldiers([])
    await persistInventoryItems([])
    await persistMemos([])
    await persistOfficers([])
    await persistOfficerMealUses([])
    await persistOfficerTicketPurchases([])
    await persistRecords([])
  }, [
    persistDivisions,
    persistInventoryItems,
    persistMemos,
    persistOfficerMealUses,
    persistOfficerTicketPurchases,
    persistOfficers,
    persistRecords,
    persistSections,
    persistSoldiers,
  ])

  const undo = useCallback(async () => {
    if (!undoRecord) return
    await upsertRecord(undoRecord)
    setUndoRecord(undefined)
  }, [undoRecord, upsertRecord])

  return {
    addDivision,
    addInventoryItem,
    addOfficerMealUse,
    addOfficerTicketPurchase,
    addSection,
    addSoldier,
    adjustInventoryItem,
    attendanceRecords,
    clearScheduledException,
    currentRecord,
    date,
    deleteDivision,
    deleteInventoryItem,
    deleteOfficerMealUse,
    deleteSection,
    deleteSoldier,
    divisions,
    importBackup,
    inventoryItems,
    isReady,
    lastSavedAt,
    meal,
    memos,
    officerMealUses,
    officerTicketPurchases,
    officers,
    resetAll,
    resetCurrentRecord,
    saveMemo,
    setAttendanceStatus,
    setScheduledException,
    setDate,
    setMeal,
    setToast,
    sections,
    soldiers,
    toast,
    toggleAttendance,
    undo,
    undoRecord,
    updateDivision,
    updateInventoryItem,
    updateSection,
    updateSoldier,
    updateSoldiersBulk,
  }
}

export type AppState = ReturnType<typeof useAppState>
