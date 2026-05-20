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
import { createOfficerUseHistoryMap, type OfficerMealUse } from './officer'

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
  const histories = createOfficerUseHistoryMap(uses, dateValue)
  const dayUses = uses
    .filter((use) => use.date === dateValue)
    .sort((a, b) => a.officerName.localeCompare(b.officerName, 'ko'))
  const total = dayUses.length
  const ateTotal = dayUses.filter((use) => use.checkStatus === 'ate').length
  const plannedTotal = dayUses.filter((use) => use.checkStatus === 'planned').length
  const missedTotal = dayUses.filter((use) => use.checkStatus === 'missed').length
  const lines = [`[${dateLabel} 간부 식수 현황]`, '']

  mealOrder.forEach((meal) => {
    const mealUses = dayUses.filter((use) => use.meal === meal)
    const ateNames = mealUses.filter((use) => use.checkStatus === 'ate').map((use) => use.officerName)
    const plannedNames = mealUses.filter((use) => use.checkStatus === 'planned').map((use) => use.officerName)
    const missedNames = mealUses.filter((use) => use.checkStatus === 'missed').map((use) => use.officerName)
    lines.push(`${mealLabels[meal]}: 총 ${mealUses.length}명 · 식사함 ${ateNames.length}명 · 확인전 ${plannedNames.length}명 · 미식사 ${missedNames.length}명`)
    if (ateNames.length > 0) lines.push(`- 식사함: ${ateNames.join(', ')}`)
    if (plannedNames.length > 0) lines.push(`- 확인전: ${plannedNames.join(', ')}`)
    if (missedNames.length > 0) lines.push(`- 미식사: ${missedNames.join(', ')}`)
    if (mealUses.length === 0) lines.push('- 없음')
    lines.push('')
  })

  lines.push(`합계: 총 ${total}명 · 식사함 ${ateTotal}명 · 확인전 ${plannedTotal}명 · 미식사 ${missedTotal}명`)
  const cumulativeLines = Array.from(new Map(dayUses.map((use) => [use.officerId, use])).values())
    .sort((a, b) => a.officerName.localeCompare(b.officerName, 'ko'))
    .map((use) => {
      const history = histories.get(use.officerId)
      return `${use.officerName} ${history?.dayCount ?? 0}일/${history?.mealCount ?? 0}식`
    })
  if (cumulativeLines.length > 0) lines.push('', `개인 누적: ${cumulativeLines.join(', ')}`)
  if (total === 0) lines.push('등록된 간부 식수가 없습니다.')

  return lines.join('\n').trim()
}
