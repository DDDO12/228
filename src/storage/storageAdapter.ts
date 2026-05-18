import type { AttendanceRecord } from '../domain/attendance'
import type { InventoryItem } from '../domain/inventory'
import type { DayMemo } from '../domain/memo'
import type { Officer, OfficerMealUse, OfficerTicketPurchase } from '../domain/officer'
import type { Division, Section, Soldier } from '../domain/soldier'

export interface AppBackup {
  version: number
  exportedAt: string
  divisions?: Division[]
  sections?: Section[]
  inventoryItems?: InventoryItem[]
  memos?: DayMemo[]
  officers?: Officer[]
  officerMealUses?: OfficerMealUse[]
  officerTicketPurchases?: OfficerTicketPurchase[]
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
  getSections(): Promise<Section[]>
  saveSections(sections: Section[]): Promise<void>
  getSoldiers(): Promise<Soldier[]>
  saveSoldiers(soldiers: Soldier[]): Promise<void>
  getAttendanceRecords(): Promise<AttendanceRecord[]>
  saveAttendanceRecords(records: AttendanceRecord[]): Promise<void>
  getOfficers(): Promise<Officer[]>
  saveOfficers(officers: Officer[]): Promise<void>
  getOfficerMealUses(): Promise<OfficerMealUse[]>
  saveOfficerMealUses(uses: OfficerMealUse[]): Promise<void>
  getOfficerTicketPurchases(): Promise<OfficerTicketPurchase[]>
  saveOfficerTicketPurchases(purchases: OfficerTicketPurchase[]): Promise<void>
  exportBackup(): Promise<AppBackup>
  importBackup(backup: AppBackup): Promise<void>
}
