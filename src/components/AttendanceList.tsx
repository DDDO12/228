import { useState } from 'react'
import { Check, ChevronRight, X } from 'lucide-react'
import {
  attendanceStatusLabels,
  exceptionStatuses,
  isAteStatus,
  normalizeAttendanceStatus,
  type AttendanceStatus,
} from '../domain/attendance'
import type { AttendanceItem, AttendanceRecord } from '../domain/attendance'
import { formatTime } from '../utils/date'

interface AttendanceListProps {
  divisionId: string | 'all'
  onlyActive: boolean
  query: string
  record: AttendanceRecord
  showMissingOnly: boolean
  onSetStatus: (soldierId: string, status: AttendanceStatus) => void
  onToggle: (soldierId: string) => void
}

export function AttendanceList({
  divisionId,
  onlyActive,
  query,
  record,
  showMissingOnly,
  onSetStatus,
  onToggle,
}: AttendanceListProps) {
  const [selectedItem, setSelectedItem] = useState<AttendanceItem>()
  const normalizedQuery = query.trim().toLowerCase()
  const items = record.records.filter((item) => {
    const status = normalizeAttendanceStatus(item.status, item.ate)
    if (divisionId !== 'all' && (item.divisionId ?? '') !== divisionId) return false
    if (showMissingOnly && isAteStatus(status)) return false
    if (onlyActive && !isAteStatus(status)) return false
    if (
      normalizedQuery &&
      !item.name.toLowerCase().includes(normalizedQuery) &&
      !item.divisionName.toLowerCase().includes(normalizedQuery)
    ) {
      return false
    }
    return true
  })

  function applyStatus(status: AttendanceStatus) {
    if (!selectedItem) return
    onSetStatus(selectedItem.soldierId, status)
    setSelectedItem(undefined)
  }

  if (items.length === 0) {
    return <div className="empty-state">조건에 맞는 인원이 없습니다.</div>
  }

  return (
    <>
      <div className="attendance-grid">
        {items.map((item) => {
          const status = normalizeAttendanceStatus(item.status, item.ate)
          return (
            <article className={`attendance-tile status-${status}`} key={item.soldierId}>
              <button className="attendance-main-button" onClick={() => onToggle(item.soldierId)} type="button">
                <span className="checkmark">{status === 'ate' && <Check size={18} />}</span>
                <span className="attendance-person">
                  <strong>{item.name}</strong>
                  <small>{item.divisionName} · {formatTime(item.updatedAt)}</small>
                </span>
              </button>
              <div className="attendance-tile-footer">
                <span className={`status-pill status-pill-${status}`}>{attendanceStatusLabels[status]}</span>
                <button className="exception-open-button" onClick={() => setSelectedItem(item)} type="button">
                  열외 <ChevronRight size={15} />
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {selectedItem && (
        <div className="exception-picker-backdrop" onClick={() => setSelectedItem(undefined)}>
          <section className="exception-picker" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>열외 설정</span>
                <h2>{selectedItem.name}</h2>
              </div>
              <button aria-label="닫기" className="icon-button" onClick={() => setSelectedItem(undefined)} type="button">
                <X size={20} />
              </button>
            </header>
            <div className="exception-wheel">
              <button onClick={() => applyStatus('ate')} type="button">
                <strong>취식</strong>
                <span>식사 완료</span>
              </button>
              <button onClick={() => applyStatus('missing')} type="button">
                <strong>미취식</strong>
                <span>단순 미취식</span>
              </button>
              {exceptionStatuses.map((status) => (
                <button key={status} onClick={() => applyStatus(status)} type="button">
                  <strong>{attendanceStatusLabels[status]}</strong>
                  <span>열외 처리</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  )
}
