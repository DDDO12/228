import type { Category, Division, Soldier } from './soldier'
import type { MealType } from './meal'

export type AttendanceStatus =
  | 'ate'
  | 'missing'
  | 'leave'
  | 'dispatch'
  | 'duty'
  | 'mowing'
  | 'serving'
  | 'cooking'
  | 'etc'

export type ScheduledExceptionStatus = Exclude<AttendanceStatus, 'ate' | 'missing' | 'etc'>

export const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  ate: '취식',
  missing: '미취식',
  leave: '휴가',
  dispatch: '파견',
  duty: '근무',
  mowing: '예초',
  serving: '배식',
  cooking: '취사',
  etc: '기타',
}

export const attendanceStatuses: AttendanceStatus[] = [
  'ate',
  'missing',
  'leave',
  'dispatch',
  'duty',
  'mowing',
  'serving',
  'cooking',
  'etc',
]

export const exceptionStatuses: ScheduledExceptionStatus[] = ['leave', 'dispatch', 'mowing', 'serving', 'cooking']

export function isAteStatus(status?: AttendanceStatus, ate?: boolean) {
  return status ? status !== 'missing' : Boolean(ate)
}

export function normalizeAttendanceStatus(status?: AttendanceStatus, ate?: boolean): AttendanceStatus {
  if (status) return status
  return ate ? 'ate' : 'missing'
}

export interface AttendanceItem {
  soldierId: string
  name: string
  category?: Category
  divisionId?: string
  divisionName: string
  section?: string
  status: AttendanceStatus
  exceptionStart?: string
  exceptionUntil?: string
  ate?: boolean
  updatedAt: string
}

export interface AttendanceRecord {
  id: string
  date: string
  meal: MealType
  records: AttendanceItem[]
  createdAt: string
  updatedAt: string
}

function resolveDivision(soldier: Soldier, divisions: Division[]) {
  return divisions.find((division) => division.id === soldier.divisionId)
}

function resolveScheduledException(soldier: Soldier, date: string) {
  if (!soldier.exceptionStatus || !soldier.exceptionUntil) return undefined
  const start = soldier.exceptionStart ?? date
  return start <= date && soldier.exceptionUntil >= date ? soldier.exceptionStatus : undefined
}

export function createAttendanceRecord(
  date: string,
  meal: MealType,
  soldiers: Soldier[],
  divisions: Division[],
): AttendanceRecord {
  const now = new Date().toISOString()
  return {
    id: `${date}-${meal}`,
    date,
    meal,
    records: soldiers
      .filter((soldier) => soldier.active)
      .map((soldier) => {
        const division = resolveDivision(soldier, divisions)
        const scheduledStatus = resolveScheduledException(soldier, date)
        const status: AttendanceStatus = scheduledStatus ?? 'missing'
        return {
          soldierId: soldier.id,
          name: soldier.name,
          category: soldier.category,
          divisionId: soldier.divisionId,
          divisionName: division?.name ?? '미지정',
          section: soldier.section,
          status,
          exceptionStart: scheduledStatus ? soldier.exceptionStart : undefined,
          exceptionUntil: scheduledStatus ? soldier.exceptionUntil : undefined,
          ate: isAteStatus(status),
          updatedAt: now,
        }
      }),
    createdAt: now,
    updatedAt: now,
  }
}

export function syncAttendanceRecord(record: AttendanceRecord, soldiers: Soldier[], divisions: Division[]) {
  const now = new Date().toISOString()
  const activeSoldiers = soldiers.filter((soldier) => soldier.active)
  const existing = new Map(record.records.map((item) => [item.soldierId, item]))

  return {
    ...record,
    records: activeSoldiers.map((soldier) => {
      const previous = existing.get(soldier.id)
      const division = resolveDivision(soldier, divisions)
      const scheduledStatus = resolveScheduledException(soldier, record.date)
      const scheduledExceptionExpired = Boolean(soldier.exceptionStatus && soldier.exceptionUntil && soldier.exceptionUntil < record.date)
      const status: AttendanceStatus = scheduledStatus ?? (scheduledExceptionExpired ? 'missing' : normalizeAttendanceStatus(previous?.status, previous?.ate))
      return {
        soldierId: soldier.id,
        name: soldier.name,
        category: soldier.category,
        divisionId: soldier.divisionId,
        divisionName: division?.name ?? previous?.divisionName ?? '미지정',
        section: soldier.section,
        status,
        exceptionStart: scheduledStatus ? soldier.exceptionStart : undefined,
        exceptionUntil: scheduledStatus ? soldier.exceptionUntil : undefined,
        ate: isAteStatus(status, previous?.ate),
        updatedAt: previous?.updatedAt ?? now,
      }
    }),
    updatedAt: now,
  }
}
