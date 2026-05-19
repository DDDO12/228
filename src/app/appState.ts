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
import {
  applyDailyInventoryConsumption,
  isMilitaryRice,
  militaryRiceDailyConsumption,
  militaryRiceUnit,
  type InventoryItem,
} from '../domain/inventory'
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

function createSection(name: string, divisionId?: string): Section {
  const now = nowIso()
  return { id: createId('section'), name, divisionId, createdAt: now, updatedAt: now }
}

function createInventoryItem(name: string, unit: string, quantity: number, minimumQuantity: number): InventoryItem {
  const now = nowIso()
  const item: InventoryItem = { id: createId('inventory'), name, unit, quantity, minimumQuantity, createdAt: now, updatedAt: now }
  return isMilitaryRice(item)
    ? {
        ...item,
        unit: militaryRiceUnit,
        dailyConsumptionEnabled: true,
        dailyConsumptionAmount: militaryRiceDailyConsumption,
        lastDailyConsumptionDate: toDateInputValue(),
      }
    : item
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

function dedupeSections(sections: Section[]) {
  const seen = new Set<string>()
  return sections.filter((section) => {
    const key = `${section.divisionId ?? ''}:${section.name.trim()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function deriveSections(soldiers: Soldier[]) {
  const seen = new Set<string>()
  return soldiers
    .flatMap((soldier) => {
      const name = soldier.section?.trim()
      if (!name) return []
      const key = `${soldier.divisionId ?? ''}:${name}`
      if (seen.has(key)) return []
      seen.add(key)
      return [createSection(name, soldier.divisionId)]
    })
    .sort((a, b) => (a.divisionId ?? '').localeCompare(b.divisionId ?? '') || a.name.localeCompare(b.name, 'ko'))
}

function migrateSections(sections: Section[], soldiers: Soldier[]) {
  if (sections.length === 0) return deriveSections(soldiers)
  const migrated = sections.flatMap((section) => {
    if (section.divisionId) return [section]
    const divisionIds = Array.from(
      new Set(
        soldiers
          .filter((soldier) => soldier.section?.trim() === section.name.trim())
          .map((soldier) => soldier.divisionId)
          .filter((divisionId): divisionId is string => Boolean(divisionId)),
      ),
    )
    if (divisionIds.length === 0) return [{ ...section, divisionId: undefined }]
    return divisionIds.map((divisionId, index) => ({
      ...section,
      id: index === 0 ? section.id : createId('section'),
      divisionId,
      updatedAt: nowIso(),
    }))
  })
  return dedupeSections(migrated)
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
      const initialSections = migrateSections(storedSections, initialSoldiers)
      const initialInventory = storedInventory.length > 0 ? storedInventory : seedInventoryItems
      const dailyInventory = applyDailyInventoryConsumption(initialInventory, toDateInputValue())

      setDivisions(initialDivisions)
      setSections(initialSections)
      setSoldiers(initialSoldiers)
      setAttendanceRecords(storedRecords)
      setInventoryItems(dailyInventory.items)
      setMemos(storedMemos)
      setOfficers(storedOfficers)
      setOfficerMealUses(storedOfficerUses)
      setOfficerTicketPurchases(storedOfficerPurchases)
      if (storedDivisions.length === 0 || storedDivisions.some((division) => division.name.endsWith('분과'))) {
        await localStore.saveDivisions(initialDivisions)
      }
      if (initialSections.length > 0) await localStore.saveSections(initialSections)
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
      if (storedInventory.length === 0 || dailyInventory.changed) await localStore.saveInventoryItems(dailyInventory.items)
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
          if (servingCount >= 4) {
            setToast(`${targetItem?.divisionName ?? '해당 포대'} 배식은 최대 4명까지 가능합니다.`)
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

  const scheduleSoldierLeave = useCallback(
    async (soldierId: string, start: string, until: string) => {
      const normalizedUntil = until < start ? start : until
      const activeSoldiers = soldiersRef.current
      const activeRecords = attendanceRecordsRef.current
      const activeDivisions = divisionsRef.current
      const target = activeSoldiers.find((soldier) => soldier.id === soldierId)
      if (!target) {
        setToast('휴가를 등록할 인원을 찾지 못했습니다.')
        return false
      }
      const now = nowIso()
      const nextSoldiers = activeSoldiers.map((soldier) =>
        soldier.id === soldierId
          ? { ...soldier, exceptionStatus: 'leave' as const, exceptionStart: start, exceptionUntil: normalizedUntil, updatedAt: now }
          : soldier,
      )
      await persistSoldiers(nextSoldiers)
      const nextRecords = activeRecords.map((record) => {
        const appliesToRecord = start <= record.date && normalizedUntil >= record.date
        const synced = syncAttendanceRecord(record, nextSoldiers, activeDivisions)
        return {
          ...synced,
          records: synced.records.map((item) => {
            if (item.soldierId !== soldierId) return item
            if (appliesToRecord) {
              return {
                ...item,
                status: 'leave' as const,
                exceptionStart: start,
                exceptionUntil: normalizedUntil,
                missingReason: undefined,
                ate: true,
                updatedAt: now,
              }
            }
            if (item.status !== 'leave') return item
            return {
              ...item,
              status: 'missing' as const,
              exceptionStart: undefined,
              exceptionUntil: undefined,
              missingReason: undefined,
              ate: false,
              updatedAt: now,
            }
          }),
          updatedAt: now,
        }
      })
      await persistRecords(nextRecords)
      setToast(`${target.name} 휴가 일정을 등록했습니다.`)
      return true
    },
    [persistRecords, persistSoldiers],
  )

  const clearSoldierLeave = useCallback(
    async (soldierId: string) => {
      const activeSoldiers = soldiersRef.current
      const activeRecords = attendanceRecordsRef.current
      const target = activeSoldiers.find((soldier) => soldier.id === soldierId)
      if (!target) return false
      const now = nowIso()
      const nextSoldiers = activeSoldiers.map((soldier) =>
        soldier.id === soldierId
          ? { ...soldier, exceptionStatus: undefined, exceptionStart: undefined, exceptionUntil: undefined, updatedAt: now }
          : soldier,
      )
      await persistSoldiers(nextSoldiers)
      await persistRecords(
        activeRecords.map((record) => ({
          ...record,
          records: record.records.map((item) =>
            item.soldierId === soldierId && item.status === 'leave'
              ? {
                  ...item,
                  status: 'missing' as const,
                  exceptionStart: undefined,
                  exceptionUntil: undefined,
                  missingReason: undefined,
                  ate: false,
                  updatedAt: now,
                }
              : item,
          ),
          updatedAt: now,
        })),
      )
      setToast(`${target.name} 휴가 일정을 삭제했습니다.`)
      return true
    },
    [persistRecords, persistSoldiers],
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
      const now = nowIso()
      await persistDivisions(divisions.filter((division) => division.id !== id))
      await persistSections(
        dedupeSections(
          sections.map((section) =>
            section.divisionId === id ? { ...section, divisionId: fallback?.id, updatedAt: now } : section,
          ),
        ),
      )
      await persistSoldiers(
        soldiers.map((soldier) =>
          soldier.divisionId === id ? { ...soldier, divisionId: fallback?.id, updatedAt: now } : soldier,
        ),
      )
    },
    [divisions, persistDivisions, persistSections, persistSoldiers, sections, soldiers],
  )

  const addSection = useCallback(
    async (name: string, divisionId?: string) => {
      const trimmed = name.trim()
      if (!trimmed) return false
      if (sections.some((section) => section.name === trimmed && (section.divisionId ?? '') === (divisionId ?? ''))) {
        setToast('이미 같은 이름의 분과가 있습니다.')
        return false
      }
      await persistSections([...sections, createSection(trimmed, divisionId)])
      return true
    },
    [persistSections, sections],
  )

  const updateSection = useCallback(
    async (id: string, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return false
      const current = sections.find((section) => section.id === id)
      if (!current) return false
      if (
        sections.some(
          (section) =>
            section.id !== id && section.name === trimmed && (section.divisionId ?? '') === (current.divisionId ?? ''),
        )
      ) {
        setToast('이미 같은 이름의 분과가 있습니다.')
        return false
      }
      const now = nowIso()
      await persistSections(sections.map((section) => (section.id === id ? { ...section, name: trimmed, updatedAt: now } : section)))
      await persistSoldiers(
        soldiers.map((soldier) =>
          soldier.section === current.name && (!current.divisionId || soldier.divisionId === current.divisionId)
            ? { ...soldier, section: trimmed, updatedAt: now }
            : soldier,
        ),
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
        soldiers.map((soldier) =>
          soldier.section === current.name && (!current.divisionId || soldier.divisionId === current.divisionId)
            ? { ...soldier, section: undefined, updatedAt: now }
            : soldier,
        ),
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
    async (
      input: Pick<
        InventoryItem,
        | 'name'
        | 'manufacturer'
        | 'unit'
        | 'quantity'
        | 'minimumQuantity'
        | 'unitAmount'
        | 'expirationDate'
        | 'purpose'
        | 'note'
        | 'dailyConsumptionEnabled'
        | 'dailyConsumptionAmount'
      >,
    ) => {
      const trimmed = input.name.trim()
      const manufacturer = input.manufacturer?.trim()
      if (!trimmed) return false
      if (inventoryItems.some((item) => item.name === trimmed && (item.manufacturer?.trim() ?? '') === (manufacturer ?? ''))) {
        setToast('이미 같은 이름의 재고 품목이 있습니다.')
        return false
      }
      const now = nowIso()
      const isRice = isMilitaryRice({ name: trimmed })
      const dailyEnabled = isRice || input.dailyConsumptionEnabled === true
      const dailyAmount = isRice ? militaryRiceDailyConsumption : Math.max(0, input.dailyConsumptionAmount ?? 0)
      await persistInventoryItems([
        ...inventoryItems,
        {
          id: createId('inventory'),
          name: trimmed,
          manufacturer,
          unit: isRice ? militaryRiceUnit : input.unit.trim() || '개',
          quantity: Math.max(0, input.quantity),
          minimumQuantity: Math.max(0, input.minimumQuantity),
          unitAmount: input.unitAmount?.trim(),
          expirationDate: input.expirationDate || undefined,
          purpose: input.purpose?.trim(),
          note: input.note?.trim(),
          dailyConsumptionEnabled: dailyEnabled,
          dailyConsumptionAmount: dailyAmount,
          lastDailyConsumptionDate: dailyEnabled && dailyAmount > 0 ? toDateInputValue() : undefined,
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
        inventoryItems.map((item) => {
          if (item.id !== id) return item
          const nextName = patch.name?.trim() || item.name
          const isRice = isMilitaryRice({ name: nextName })
          const dailyEnabled = isRice || (patch.dailyConsumptionEnabled ?? item.dailyConsumptionEnabled) === true
          const dailyAmount = isRice
            ? militaryRiceDailyConsumption
            : Math.max(0, patch.dailyConsumptionAmount ?? item.dailyConsumptionAmount ?? 0)
          return {
            ...item,
            ...patch,
            name: nextName,
            manufacturer: patch.manufacturer === undefined ? item.manufacturer : patch.manufacturer.trim(),
            unit: isRice ? militaryRiceUnit : patch.unit === undefined ? item.unit : patch.unit.trim() || item.unit,
            quantity: patch.quantity === undefined ? item.quantity : Math.max(0, patch.quantity),
            minimumQuantity: patch.minimumQuantity === undefined ? item.minimumQuantity : Math.max(0, patch.minimumQuantity),
            unitAmount: patch.unitAmount === undefined ? item.unitAmount : patch.unitAmount.trim(),
            expirationDate: patch.expirationDate === undefined ? item.expirationDate : patch.expirationDate || undefined,
            purpose: patch.purpose === undefined ? item.purpose : patch.purpose.trim(),
            note: patch.note === undefined ? item.note : patch.note.trim(),
            dailyConsumptionEnabled: dailyEnabled,
            dailyConsumptionAmount: dailyAmount,
            lastDailyConsumptionDate:
              dailyEnabled && dailyAmount > 0 ? item.lastDailyConsumptionDate ?? toDateInputValue() : undefined,
            updatedAt: now,
          }
        }),
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
    async (name: string, targetMeals: MealType[] = [meal]) => {
      const trimmed = name.trim()
      if (!trimmed) return false
      const selectedMeals = Array.from(new Set(targetMeals))
      if (selectedMeals.length === 0) return false
      const now = nowIso()
      const existingOfficer = officers.find((officer) => officer.name.trim() === trimmed)
      const officer = existingOfficer ?? createOfficer(trimmed)
      const nextOfficers = existingOfficer ? officers : [...officers, officer]
      const nextUses = [...officerMealUses]
      let added = 0

      for (const targetMeal of selectedMeals) {
        const duplicate = nextUses.some((use) => use.date === date && use.meal === targetMeal && use.officerId === officer.id)
        if (duplicate) continue
        const balance = createOfficerBalanceMap(officerTicketPurchases, nextUses).get(officer.id)
        const status: OfficerMealUse['status'] = balance && balance[targetMeal] > 0 ? 'ticket' : 'unpaid'
        nextUses.push({
          id: createId('officer-use'),
          date,
          meal: targetMeal,
          officerId: officer.id,
          officerName: officer.name,
          status,
          createdAt: now,
          updatedAt: now,
        })
        added += 1
      }

      if (added === 0) {
        setToast('이미 선택한 식사에 등록된 식권구매자입니다.')
        return false
      }
      if (!existingOfficer) await persistOfficers(nextOfficers)
      await persistOfficerMealUses(nextUses)
      return true
    },
    [date, meal, officerMealUses, officerTicketPurchases, officers, persistOfficerMealUses, persistOfficers],
  )

  const addOfficerBuyer = useCallback(
    async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return false
      if (officers.some((officer) => officer.name.trim() === trimmed)) {
        setToast('이미 등록된 식권구매자입니다.')
        return false
      }
      await persistOfficers([...officers, createOfficer(trimmed)])
      return true
    },
    [officers, persistOfficers],
  )

  const updateOfficerBuyer = useCallback(
    async (officerId: string, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return false
      const officer = officers.find((item) => item.id === officerId)
      if (!officer) return false
      if (officers.some((item) => item.id !== officerId && item.name.trim() === trimmed)) {
        setToast('이미 등록된 식권구매자입니다.')
        return false
      }

      const now = nowIso()
      await persistOfficers(
        officers.map((item) => (item.id === officerId ? { ...item, name: trimmed, updatedAt: now } : item)),
      )
      await persistOfficerMealUses(
        officerMealUses.map((use) =>
          use.officerId === officerId ? { ...use, officerName: trimmed, updatedAt: now } : use,
        ),
      )
      await persistOfficerTicketPurchases(
        officerTicketPurchases.map((purchase) =>
          purchase.officerId === officerId ? { ...purchase, officerName: trimmed, updatedAt: now } : purchase,
        ),
      )
      return true
    },
    [
      officerMealUses,
      officerTicketPurchases,
      officers,
      persistOfficerMealUses,
      persistOfficerTicketPurchases,
      persistOfficers,
    ],
  )

  const deleteOfficerBuyer = useCallback(
    async (officerId: string) => {
      if (!officers.some((item) => item.id === officerId)) return false
      await persistOfficers(officers.filter((item) => item.id !== officerId))
      await persistOfficerMealUses(officerMealUses.filter((use) => use.officerId !== officerId))
      await persistOfficerTicketPurchases(officerTicketPurchases.filter((purchase) => purchase.officerId !== officerId))
      return true
    },
    [officerMealUses, officerTicketPurchases, officers, persistOfficerMealUses, persistOfficerTicketPurchases, persistOfficers],
  )

  const deleteOfficerMealUse = useCallback(
    async (id: string) => {
      await persistOfficerMealUses(officerMealUses.filter((use) => use.id !== id))
    },
    [officerMealUses, persistOfficerMealUses],
  )

  const addOfficerTicketPurchase = useCallback(
    async (name: string, purchaseMeals: MealType[] | MealType, quantity: number) => {
      const trimmed = name.trim()
      const safeQuantity = Math.max(0, Math.floor(quantity))
      if (!trimmed || safeQuantity <= 0) return false
      const selectedMeals = Array.from(new Set(Array.isArray(purchaseMeals) ? purchaseMeals : [purchaseMeals]))
      if (selectedMeals.length === 0) return false
      const now = nowIso()
      const existingOfficer = officers.find((officer) => officer.name.trim() === trimmed)
      const officer = existingOfficer ?? createOfficer(trimmed)
      const nextOfficers = existingOfficer ? officers : [...officers, officer]
      const purchases = selectedMeals.map<OfficerTicketPurchase>((purchaseMeal) => ({
        id: createId('officer-purchase'),
        date,
        meal: purchaseMeal,
        officerId: officer.id,
        officerName: officer.name,
        quantity: safeQuantity,
        createdAt: now,
        updatedAt: now,
      }))
      const remainingByMeal = new Map<MealType, number>(selectedMeals.map((purchaseMeal) => [purchaseMeal, safeQuantity]))
      const nextUses = officerMealUses
        .slice()
        .sort((a, b) => `${a.date}-${a.createdAt}`.localeCompare(`${b.date}-${b.createdAt}`))
        .map((use) => {
          const remaining = remainingByMeal.get(use.meal) ?? 0
          if (remaining <= 0 || use.officerId !== officer.id || use.status !== 'unpaid') return use
          remainingByMeal.set(use.meal, remaining - 1)
          return { ...use, status: 'ticket' as const, updatedAt: now }
        })
      if (!existingOfficer) await persistOfficers(nextOfficers)
      await persistOfficerTicketPurchases([...officerTicketPurchases, ...purchases])
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

  const cancelOfficerTicket = useCallback(
    async (officerId: string, cancelMeal: MealType, quantity = 1) => {
      const officer = officers.find((item) => item.id === officerId)
      if (!officer) return false
      const safeQuantity = Math.max(0, Math.floor(quantity))
      const balance = createOfficerBalanceMap(officerTicketPurchases, officerMealUses).get(officerId)
      const cancellable = Math.min(safeQuantity, Math.max(0, balance?.[cancelMeal] ?? 0))
      if (cancellable <= 0) {
        setToast('취소할 잔여 식권이 없습니다.')
        return false
      }
      const now = nowIso()
      await persistOfficerTicketPurchases([
        ...officerTicketPurchases,
        {
          id: createId('officer-cancel'),
          date,
          meal: cancelMeal,
          officerId,
          officerName: officer.name,
          quantity: -cancellable,
          createdAt: now,
          updatedAt: now,
        },
      ])
      return true
    },
    [date, officerMealUses, officerTicketPurchases, officers, persistOfficerTicketPurchases],
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
    const nextSections = migrateSections(backup.sections ?? [], nextSoldiers)
    const nextInventory = applyDailyInventoryConsumption(backup.inventoryItems ?? [], toDateInputValue()).items
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
    addOfficerBuyer,
    addOfficerTicketPurchase,
    addSection,
    addSoldier,
    adjustInventoryItem,
    attendanceRecords,
    clearSoldierLeave,
    clearScheduledException,
    cancelOfficerTicket,
    currentRecord,
    date,
    deleteDivision,
    deleteInventoryItem,
    deleteOfficerBuyer,
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
    scheduleSoldierLeave,
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
    updateOfficerBuyer,
    updateSection,
    updateSoldier,
    updateSoldiersBulk,
  }
}

export type AppState = ReturnType<typeof useAppState>
