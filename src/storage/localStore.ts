import type { AttendanceRecord } from '../domain/attendance'
import type { InventoryItem } from '../domain/inventory'
import type { DayMemo } from '../domain/memo'
import type { Officer, OfficerMealUse, OfficerTicketPurchase } from '../domain/officer'
import type { Division, Section, Soldier } from '../domain/soldier'
import type { AppBackup, StorageAdapter } from './storageAdapter'

const MEMOS_KEY = 'meal-check:memos'
const INVENTORY_KEY = 'meal-check:inventory-items'
const DIVISIONS_KEY = 'meal-check:divisions'
const SECTIONS_KEY = 'meal-check:sections'
const SOLDIERS_KEY = 'meal-check:soldiers'
const RECORDS_KEY = 'meal-check:attendance-records'
const OFFICERS_KEY = 'meal-check:officers'
const OFFICER_USES_KEY = 'meal-check:officer-meal-uses'
const OFFICER_PURCHASES_KEY = 'meal-check:officer-ticket-purchases'

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
  async getSections() {
    return readJson<Section[]>(SECTIONS_KEY, [])
  },
  async saveSections(sections) {
    writeJson(SECTIONS_KEY, sections)
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
  async getOfficers() {
    return readJson<Officer[]>(OFFICERS_KEY, [])
  },
  async saveOfficers(officers) {
    writeJson(OFFICERS_KEY, officers)
  },
  async getOfficerMealUses() {
    return readJson<OfficerMealUse[]>(OFFICER_USES_KEY, [])
  },
  async saveOfficerMealUses(uses) {
    writeJson(OFFICER_USES_KEY, uses)
  },
  async getOfficerTicketPurchases() {
    return readJson<OfficerTicketPurchase[]>(OFFICER_PURCHASES_KEY, [])
  },
  async saveOfficerTicketPurchases(purchases) {
    writeJson(OFFICER_PURCHASES_KEY, purchases)
  },
  async exportBackup() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      divisions: await this.getDivisions(),
      sections: await this.getSections(),
      inventoryItems: await this.getInventoryItems(),
      memos: await this.getMemos(),
      officers: await this.getOfficers(),
      officerMealUses: await this.getOfficerMealUses(),
      officerTicketPurchases: await this.getOfficerTicketPurchases(),
      soldiers: await this.getSoldiers(),
      attendanceRecords: await this.getAttendanceRecords(),
    }
  },
  async importBackup(backup: AppBackup) {
    if (backup.memos) writeJson(MEMOS_KEY, backup.memos)
    if (backup.inventoryItems) writeJson(INVENTORY_KEY, backup.inventoryItems)
    if (backup.officers) writeJson(OFFICERS_KEY, backup.officers)
    if (backup.officerMealUses) writeJson(OFFICER_USES_KEY, backup.officerMealUses)
    if (backup.officerTicketPurchases) writeJson(OFFICER_PURCHASES_KEY, backup.officerTicketPurchases)
    if (backup.divisions) writeJson(DIVISIONS_KEY, backup.divisions)
    if (backup.sections) writeJson(SECTIONS_KEY, backup.sections)
    writeJson(SOLDIERS_KEY, backup.soldiers)
    writeJson(RECORDS_KEY, backup.attendanceRecords)
  },
}
