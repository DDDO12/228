import type { AttendanceRecord } from '../domain/attendance'
import type { InventoryItem } from '../domain/inventory'
import type { DayMemo } from '../domain/memo'
import type { Division, Soldier } from '../domain/soldier'
import type { AppBackup, StorageAdapter } from './storageAdapter'

const MEMOS_KEY = 'meal-check:memos'
const INVENTORY_KEY = 'meal-check:inventory-items'
const DIVISIONS_KEY = 'meal-check:divisions'
const SOLDIERS_KEY = 'meal-check:soldiers'
const RECORDS_KEY = 'meal-check:attendance-records'

function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

export const localStore: StorageAdapter = {
  async getMemos() {
    return readJson<DayMemo[]>(MEMOS_KEY, [])
  },
  async saveMemos(memos) {
    writeJson(MEMOS_KEY, memos)
  },
  async getInventoryItems() {
    return readJson<InventoryItem[]>(INVENTORY_KEY, [])
  },
  async saveInventoryItems(items) {
    writeJson(INVENTORY_KEY, items)
  },
  async getDivisions() {
    return readJson<Division[]>(DIVISIONS_KEY, [])
  },
  async saveDivisions(divisions) {
    writeJson(DIVISIONS_KEY, divisions)
  },
  async getSoldiers() {
    return readJson<Soldier[]>(SOLDIERS_KEY, [])
  },
  async saveSoldiers(soldiers) {
    writeJson(SOLDIERS_KEY, soldiers)
  },
  async getAttendanceRecords() {
    return readJson<AttendanceRecord[]>(RECORDS_KEY, [])
  },
  async saveAttendanceRecords(records) {
    writeJson(RECORDS_KEY, records)
  },
  async exportBackup() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      divisions: await this.getDivisions(),
      inventoryItems: await this.getInventoryItems(),
      memos: await this.getMemos(),
      soldiers: await this.getSoldiers(),
      attendanceRecords: await this.getAttendanceRecords(),
    }
  },
  async importBackup(backup: AppBackup) {
    if (backup.memos) writeJson(MEMOS_KEY, backup.memos)
    if (backup.inventoryItems) writeJson(INVENTORY_KEY, backup.inventoryItems)
    if (backup.divisions) writeJson(DIVISIONS_KEY, backup.divisions)
    writeJson(SOLDIERS_KEY, backup.soldiers)
    writeJson(RECORDS_KEY, backup.attendanceRecords)
  },
}
