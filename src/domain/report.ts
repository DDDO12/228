import {
  attendanceStatusLabels,
  attendanceStatuses,
  isAteStatus,
  normalizeAttendanceStatus,
  type AttendanceStatus,
} from './attendance'
import type { AttendanceRecord } from './attendance'
import { mealLabels } from './meal'

function orderedDivisionNames(record: AttendanceRecord) {
  return Array.from(new Set(record.records.map((item) => item.divisionName)))
}

function countByStatus(record: AttendanceRecord, status: AttendanceStatus) {
  return record.records.filter((item) => normalizeAttendanceStatus(item.status, item.ate) === status).length
}

export function formatKakaoReport(record: AttendanceRecord, includeMissing = true, includeDivisionDetails = true) {
  const total = record.records.length
  const date = new Date(`${record.date}T00:00:00`)
  const dateLabel = `${date.getMonth() + 1}월 ${date.getDate()}일`

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
      lines.push(`${divisionName}: 취식 ${ate}명, 미취식 ${missing}명, 열외 ${excluded}명`)
    })
    lines.push('')
  }

  lines.push(`총원: ${total}명`)
  attendanceStatuses.forEach((status) => {
    lines.push(`${attendanceStatusLabels[status]}: ${countByStatus(record, status)}명`)
  })

  if (includeMissing) {
    lines.push('', '미취식자/열외자:')
    attendanceStatuses
      .filter((status) => status !== 'ate')
      .forEach((status) => {
        const names = record.records
          .filter((item) => normalizeAttendanceStatus(item.status, item.ate) === status)
          .map((item) => `${item.divisionName} ${item.section ? `${item.section} ` : ''}${item.name}`)
        if (names.length > 0) lines.push(`${attendanceStatusLabels[status]} - ${names.join(', ')}`)
      })
    if (record.records.every((item) => isAteStatus(item.status, item.ate))) lines.push('없음')
  }

  return lines.join('\n')
}
