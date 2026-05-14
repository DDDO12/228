import type { AppBackup } from './storageAdapter'

type LooseBackup = Partial<AppBackup> & {
  attendance?: unknown
  records?: unknown
}

export function parseBackup(raw: string): AppBackup {
  const parsed = JSON.parse(raw.replace(/^\uFEFF/u, '').trim()) as LooseBackup
  const attendanceRecords = parsed.attendanceRecords ?? parsed.records ?? parsed.attendance
  const version = typeof parsed.version === 'string' ? Number(parsed.version) : parsed.version

  if (
    (version !== undefined && version !== 1) ||
    (parsed.divisions !== undefined && !Array.isArray(parsed.divisions)) ||
    (parsed.sections !== undefined && !Array.isArray(parsed.sections)) ||
    (parsed.inventoryItems !== undefined && !Array.isArray(parsed.inventoryItems)) ||
    (parsed.memos !== undefined && !Array.isArray(parsed.memos)) ||
    !Array.isArray(parsed.soldiers) ||
    !Array.isArray(attendanceRecords)
  ) {
    throw new Error('지원하지 않는 백업 파일입니다.')
  }

  return {
    version: 1,
    exportedAt: parsed.exportedAt ?? new Date().toISOString(),
    divisions: parsed.divisions ?? [],
    sections: parsed.sections ?? [],
    inventoryItems: parsed.inventoryItems ?? [],
    memos: parsed.memos ?? [],
    soldiers: parsed.soldiers,
    attendanceRecords,
  }
}
