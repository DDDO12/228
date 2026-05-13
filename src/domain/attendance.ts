import type { Category, Division, Soldier } from './soldier'
import type { MealType } from './meal'

export type AttendanceStatus = 'ate' | 'missing' | 'leave' | 'dispatch' | 'duty' | 'etc'

export const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  ate: '취식',
  missing: '미취식',
  leave: '휴가',
  dispatch: '파견',
  duty: '근무',
  etc: '기타',
}

export const attendanceStatuses: AttendanceStatus[] = ['ate', 'missing', 'leave', 'dispatch', 'duty', 'etc']

export const exceptionStatuses: AttendanceStatus[] = ['leave', 'dispatch', 'duty', 'etc']

export function isAteStatus(status?: AttendanceStatus, ate?: boolean) {
  return status ? status === 'ate' : Boolean(ate)
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
  status: AttendanceStatus
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
        return {
          soldierId: soldier.id,
          name: soldier.name,
          category: soldier.category,
          divisionId: soldier.divisionId,
          divisionName: division?.name ?? '미지정',
          status: 'missing',
          ate: false,
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
      const status = normalizeAttendanceStatus(previous?.status, previous?.ate)
      return {
        soldierId: soldier.id,
        name: soldier.name,
        category: soldier.category,
        divisionId: soldier.divisionId,
        divisionName: division?.name ?? previous?.divisionName ?? '미지정',
        status,
        ate: status === 'ate',
        updatedAt: previous?.updatedAt ?? now,
      }
    }),
    updatedAt: now,
  }
}
