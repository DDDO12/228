import type { AttendanceRecord } from '../domain/attendance'
import type { InventoryItem } from '../domain/inventory'
import type { DayMemo } from '../domain/memo'
import type { Division, Soldier } from '../domain/soldier'

export interface AppBackup {
  version: number
  exportedAt: string
  divisions?: Division[]
  inventoryItems?: InventoryItem[]
  memos?: DayMemo[]
  soldiers: Soldier[]
  attendanceRecords: AttendanceRecord[]
}

export interface StorageAdapter {
  getMemos(): Promise<DayMemo[]>
  saveMemos(memos: DayMemo[]): Promise<void>
  getInventoryItems(): Promise<InventoryItem[]>
  saveInventoryItems(items: InventoryItem[]): Promise<void>
  getDivisions(): Promise<Division[]>
  saveDivisions(divisions: Division[]): Promise<void>
  getSoldiers(): Promise<Soldier[]>
  saveSoldiers(soldiers: Soldier[]): Promise<void>
  getAttendanceRecords(): Promise<AttendanceRecord[]>
  saveAttendanceRecords(records: AttendanceRecord[]): Promise<void>
  exportBackup(): Promise<AppBackup>
  importBackup(backup: AppBackup): Promise<void>
}
