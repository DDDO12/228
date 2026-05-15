import { useState } from 'react'
import { Check, ChevronRight, X } from 'lucide-react'
import {
  attendanceStatusLabels,
  exceptionStatuses,
  isAteStatus,
  missingReasonLabels,
  missingReasons,
  normalizeAttendanceStatus,
  type AttendanceStatus,
  type MissingReason,
  type ScheduledExceptionStatus,
} from '../domain/attendance'
import type { AttendanceItem, AttendanceRecord } from '../domain/attendance'
import { toDateInputValue } from '../utils/date'

interface AttendanceListProps {
  divisionId: string | 'all'
  onlyActive: boolean
  query: string
  record: AttendanceRecord
  section: string | 'all'
  showMissingOnly: boolean
  onSetStatus: (soldierId: string, status: AttendanceStatus, missingReason?: MissingReason) => void
  onSetScheduledException: (
    soldierId: string,
    status: ScheduledExceptionStatus,
    start: string,
    until: string,
  ) => void
  onClearScheduledException: (soldierId: string) => void
  onToggle: (soldierId: string) => void
}

export function AttendanceList({
  divisionId,
  onlyActive,
  query,
  record,
  section,
  showMissingOnly,
  onSetStatus,
  onSetScheduledException,
  onClearScheduledException,
  onToggle,
}: AttendanceListProps) {
  const [selectedItem, setSelectedItem] = useState<AttendanceItem>()
  const [pickerMode, setPickerMode] = useState<'choices' | 'leave' | 'leaveActive' | 'missing'>('choices')
  const [leaveStart, setLeaveStart] = useState(record.date || toDateInputValue())
  const [leaveUntil, setLeaveUntil] = useState(record.date || toDateInputValue())
  const [missingReason, setMissingReason] = useState<MissingReason>('work')
  const normalizedQuery = query.trim().toLowerCase()
  const items = record.records.filter((item) => {
    const status = normalizeAttendanceStatus(item.status, item.ate)
    if (divisionId !== 'all' && (item.divisionId ?? '') !== divisionId) return false
    if (section !== 'all' && (item.section ?? '') !== section) return false
    if (showMissingOnly && status === 'ate') return false
    if (onlyActive && !isAteStatus(item.status, item.ate)) return false
    if (
      normalizedQuery &&
      !item.name.toLowerCase().includes(normalizedQuery) &&
      !item.divisionName.toLowerCase().includes(normalizedQuery) &&
      !item.section?.toLowerCase().includes(normalizedQuery)
    ) {
      return false
    }
    return true
  }).sort((a, b) => {
    const statusA = normalizeAttendanceStatus(a.status, a.ate)
    const statusB = normalizeAttendanceStatus(b.status, b.ate)
    const rank = (status: AttendanceStatus) => (status !== 'ate' && status !== 'missing' ? 2 : status === 'ate' ? 1 : 0)
    const sectionA = a.section?.trim() ?? ''
    const sectionB = b.section?.trim() ?? ''
    const sectionRank = Number(!sectionA) - Number(!sectionB)
    return (
      rank(statusA) - rank(statusB) ||
      sectionRank ||
      sectionA.localeCompare(sectionB, 'ko') ||
      a.name.localeCompare(b.name, 'ko')
    )
  })
  const ateCount = items.filter((item) => normalizeAttendanceStatus(item.status, item.ate) === 'ate').length
  const missingCount = items.filter((item) => normalizeAttendanceStatus(item.status, item.ate) === 'missing').length
  const exceptionCount = items.filter((item) => {
    const status = normalizeAttendanceStatus(item.status, item.ate)
    return status !== 'ate' && status !== 'missing'
  }).length

  function applyStatus(status: AttendanceStatus) {
    if (!selectedItem) return
    if (status === 'leave') {
      setPickerMode('leave')
      return
    }
    onSetStatus(selectedItem.soldierId, status)
    setSelectedItem(undefined)
  }

  function openMissingReason(item: AttendanceItem) {
    setSelectedItem(item)
    setMissingReason(item.missingReason ?? 'work')
    setPickerMode('missing')
  }

  function toggleItem(item: AttendanceItem) {
    if (isAteStatus(item.status, item.ate)) {
      openMissingReason(item)
      return
    }
    onToggle(item.soldierId)
  }

  function saveMissingReason() {
    if (!selectedItem) return
    onSetStatus(selectedItem.soldierId, 'missing', missingReason)
    closePicker()
  }

  function openPicker(item: AttendanceItem) {
    const start = item.exceptionStart ?? record.date ?? toDateInputValue()
    setLeaveStart(start)
    setLeaveUntil(item.exceptionUntil ?? start)
    setPickerMode(item.status === 'leave' && item.exceptionUntil ? 'leaveActive' : 'choices')
    setSelectedItem(item)
  }

  function closePicker() {
    setSelectedItem(undefined)
    setPickerMode('choices')
  }

  function updateLeaveStart(value: string) {
    setLeaveStart(value)
    if (leaveUntil < value) setLeaveUntil(value)
  }

  function saveLeave() {
    if (!selectedItem) return
    onSetScheduledException(selectedItem.soldierId, 'leave', leaveStart, leaveUntil < leaveStart ? leaveStart : leaveUntil)
    closePicker()
  }

  function clearLeave() {
    if (!selectedItem) return
    onClearScheduledException(selectedItem.soldierId)
    closePicker()
  }

  if (items.length === 0) {
    return <div className="empty-state">조건에 맞는 인원이 없습니다.</div>
  }

  return (
    <>
      <section className="attendance-summary-strip" aria-label="체크 현황">
        <div>
          <span>취식</span>
          <strong>{ateCount}명</strong>
        </div>
        <div>
          <span>미취식</span>
          <strong>{missingCount}명</strong>
        </div>
        <div>
          <span>근무/기타</span>
          <strong>{exceptionCount}명</strong>
        </div>
        <div>
          <span>현재원</span>
          <strong>{items.length}명</strong>
        </div>
      </section>
      <div className="attendance-grid">
        {items.map((item) => {
          const status = normalizeAttendanceStatus(item.status, item.ate)
          const isCompleted = isAteStatus(item.status, item.ate)
          const isLeaveActive = status === 'leave' && Boolean(item.exceptionUntil)
          const exceptionLabel = isLeaveActive ? '휴가 중' : status === 'ate' || status === 'missing' ? '근무/기타' : attendanceStatusLabels[status]
          return (
            <article className={`attendance-tile status-${status}`} key={item.soldierId}>
              <button className="attendance-main-button" onClick={() => toggleItem(item)} type="button">
                <span className="checkmark">{isCompleted && <Check size={18} />}</span>
                <span className="attendance-person">
                  <span className="attendance-name-line">
                    <strong>{item.name}</strong>
                    <em>{item.divisionName}</em>
                  </span>
                  <small>
                    {item.section || '분과 미지정'}
                    {item.exceptionUntil ? ` · ${item.exceptionStart ?? record.date}~${item.exceptionUntil}` : ''}
                    {status === 'missing' && item.missingReason ? ` · ${missingReasonLabels[item.missingReason]}` : ''}
                  </small>
                </span>
              </button>
              <div className="attendance-tile-footer">
                <button className={`status-action status-action-${status}`} onClick={() => toggleItem(item)} type="button">
                  {isCompleted ? '취식' : '미취식'}
                </button>
                <button
                  className={`exception-open-button ${isLeaveActive ? 'leave-active-button' : ''}`}
                  onClick={() => openPicker(item)}
                  type="button"
                >
                  {exceptionLabel} <ChevronRight size={15} />
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {selectedItem && (
        <div className="exception-picker-backdrop" onClick={closePicker}>
          <section className="exception-picker" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>
                  {pickerMode === 'leave'
                    ? '휴가 기간 설정'
                    : pickerMode === 'leaveActive'
                      ? '휴가 일정 조정'
                      : pickerMode === 'missing'
                        ? '미취식 사유'
                        : '근무/기타 설정'}
                </span>
                <h2>{selectedItem.name}</h2>
              </div>
              <button aria-label="닫기" className="icon-button" onClick={closePicker} type="button">
                <X size={20} />
              </button>
            </header>
            {pickerMode === 'choices' ? (
              <div className="exception-grid">
                {exceptionStatuses.map((status) => (
                  <button
                    className={status === 'leave' ? 'status-choice-leave' : ''}
                    key={status}
                    onClick={() => applyStatus(status)}
                    type="button"
                  >
                    <strong>{attendanceStatusLabels[status]}</strong>
                    <span>{status === 'leave' ? '기간 입력' : '근무/기타 처리'}</span>
                  </button>
                ))}
              </div>
            ) : pickerMode === 'missing' ? (
              <div className="leave-date-form">
                <div className="missing-reason-grid">
                  {missingReasons.map((reason) => (
                    <button
                      className={missingReason === reason ? 'active' : ''}
                      key={reason}
                      onClick={() => setMissingReason(reason)}
                      type="button"
                    >
                      {missingReasonLabels[reason]}
                    </button>
                  ))}
                </div>
                <div className="modal-actions">
                  <button className="ghost-button" onClick={closePicker} type="button">
                    취소
                  </button>
                  <button className="primary-button" onClick={saveMissingReason} type="button">
                    미취식 처리
                  </button>
                </div>
              </div>
            ) : pickerMode === 'leaveActive' ? (
              <div className="leave-date-form">
                <div className="leave-summary">
                  <strong>현재 휴가 중</strong>
                  <span>{leaveStart} ~ {leaveUntil}</span>
                </div>
                <button className="primary-button" onClick={() => setPickerMode('leave')} type="button">
                  휴가 일정 조정
                </button>
                <button className="danger-button" onClick={clearLeave} type="button">
                  휴가 일정 삭제
                </button>
              </div>
            ) : (
              <div className="leave-date-form">
                <label className="leave-date-control">
                  <span>휴가 시작</span>
                  <input onChange={(event) => updateLeaveStart(event.target.value)} type="date" value={leaveStart} />
                </label>
                <label className="leave-date-control">
                  <span>휴가 종료</span>
                  <input min={leaveStart} onChange={(event) => setLeaveUntil(event.target.value)} type="date" value={leaveUntil} />
                </label>
                <div className="modal-actions">
                  <button className="ghost-button" onClick={() => setPickerMode('choices')} type="button">
                    이전
                  </button>
                  <button className="primary-button" onClick={saveLeave} type="button">
                    적용
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  )
}
