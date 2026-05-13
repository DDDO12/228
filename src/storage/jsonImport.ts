import type { AppBackup } from './storageAdapter'

export function parseBackup(raw: string): AppBackup {
  const parsed = JSON.parse(raw) as AppBackup
  if (
    parsed.version !== 1 ||
    (parsed.divisions !== undefined && !Array.isArray(parsed.divisions)) ||
    (parsed.inventoryItems !== undefined && !Array.isArray(parsed.inventoryItems)) ||
    (parsed.memos !== undefined && !Array.isArray(parsed.memos)) ||
    !Array.isArray(parsed.soldiers) ||
    !Array.isArray(parsed.attendanceRecords)
  ) {
    throw new Error('지원하지 않는 백업 파일입니다.')
  }
  return parsed
}
