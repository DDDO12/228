import {
  attendanceStatusLabels,
  attendanceStatuses,
  missingReasonLabels,
  isAteStatus,
  normalizeAttendanceStatus,
  type AttendanceStatus,
} from './attendance'
import type { AttendanceRecord } from './attendance'
import { mealLabels, mealOrder } from './meal'
import type { OfficerMealUse } from './officer'

function formatDateLabel(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`)
  return `${date.getMonth() + 1}월 ${date.getDate()}일`
}

function orderedDivisionNames(record: AttendanceRecord) {
  return Array.from(new Set(record.records.map((item) => item.divisionName)))
}

function countByStatus(record: AttendanceRecord, status: AttendanceStatus) {
  return record.records.filter((item) => normalizeAttendanceStatus(item.status, item.ate) === status).length
}

export function formatKakaoReport(record: AttendanceRecord, includeMissing = true, includeDivisionDetails = true) {
  const total = record.records.length
  const dateLabel = formatDateLabel(record.date)

  const lines = [`[${dateLabel} ${mealLabels[record.meal]} 취식 현황]`, '']

  if (includeDivisionDetails) {
    orderedDivisionNames(record).forEach((divisionName) => {
      const items = record.records.filter((item) => item.divisionName === divisionName)
      const ate = items.filter((item) => normalizeAttendanceStatus(item.status, item.ate) === 'ate').length
      const missing = items.filter((item) => normalizeAttendanceStatus(item.status, item.ate) === 'missing').length
      const excluded = items.filter((item) => {
        const status = normalizeAttendanceStatus(item.status, item.ate)
        return status !== 'ate' && status !== 'missing'
      }).length
      lines.push(`${divisionName}: 취식 ${ate}명, 미취식 ${missing}명, 근무/기타 ${excluded}명`)
    })
    lines.push('')
  }

  lines.push(`총원: ${total}명`)
  attendanceStatuses.forEach((status) => {
    lines.push(`${attendanceStatusLabels[status]}: ${countByStatus(record, status)}명`)
  })

  if (includeMissing) {
    lines.push('', '미취식자/근무/기타:')
    attendanceStatuses
      .filter((status) => status !== 'ate')
      .forEach((status) => {
        const names = record.records
          .filter((item) => normalizeAttendanceStatus(item.status, item.ate) === status)
          .map((item) => {
            const reason = status === 'missing' && item.missingReason ? `(${missingReasonLabels[item.missingReason]})` : ''
            return `${item.divisionName} ${item.section ? `${item.section} ` : ''}${item.name}${reason}`
          })
        if (names.length > 0) lines.push(`${attendanceStatusLabels[status]} - ${names.join(', ')}`)
      })
    if (record.records.every((item) => isAteStatus(item.status, item.ate))) lines.push('없음')
  }

  return lines.join('\n')
}

export function formatOfficerMealReport(dateValue: string, uses: OfficerMealUse[]) {
  const dateLabel = formatDateLabel(dateValue)
  const dayUses = uses
    .filter((use) => use.date === dateValue)
    .sort((a, b) => a.officerName.localeCompare(b.officerName, 'ko'))
  const total = dayUses.length
  const ticketTotal = dayUses.filter((use) => use.status === 'ticket').length
  const unpaidTotal = dayUses.filter((use) => use.status === 'unpaid').length
  const lines = [`[${dateLabel} 간부 식수 현황]`, '']

  mealOrder.forEach((meal) => {
    const mealUses = dayUses.filter((use) => use.meal === meal)
    const ticketNames = mealUses.filter((use) => use.status === 'ticket').map((use) => use.officerName)
    const unpaidNames = mealUses.filter((use) => use.status === 'unpaid').map((use) => use.officerName)
    lines.push(`${mealLabels[meal]}: 총 ${mealUses.length}명 · 구매 ${ticketNames.length}명 · 미구매 ${unpaidNames.length}명`)
    if (ticketNames.length > 0) lines.push(`- 구매: ${ticketNames.join(', ')}`)
    if (unpaidNames.length > 0) lines.push(`- 미구매: ${unpaidNames.join(', ')}`)
    if (mealUses.length === 0) lines.push('- 없음')
    lines.push('')
  })

  lines.push(`합계: 총 ${total}명 · 구매 ${ticketTotal}명 · 미구매 ${unpaidTotal}명`)
  if (total === 0) lines.push('등록된 간부 식수가 없습니다.')

  return lines.join('\n').trim()
}
