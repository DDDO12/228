import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
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
import { matchesSearch } from '../utils/search'

interface AttendanceListProps {
  divisionId: string | 'all'
  statusFilter: 'all' | 'missing' | 'work'
  query: string
  record: AttendanceRecord
  section: string | 'all'
  onSetStatus: (soldierId: string, status: AttendanceStatus, missingReason?: MissingReason) => void | Promise<void>
  onSetScheduledException: (
    soldierId: string,
    status: ScheduledExceptionStatus,
    start: string,
    until: string,
  ) => void
  onClearScheduledException: (soldierId: string) => void
  onResetFilters?: () => void
}

function SwipeStatusAction({
  label,
  onComplete,
  tone = 'primary',
}: {
  label: string
  onComplete: () => void
  tone?: 'danger' | 'primary'
}) {
  const startXRef = useRef<number | null>(null)
  const maxDragRef = useRef(72)
  const currentDragRef = useRef(0)
  const thresholdRef = useRef(64)
  const [dragX, setDragX] = useState(0)
  const [threshold, setThreshold] = useState(64)

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const nextMaxDrag = Math.max(72, rect.width - 48)
    const nextThreshold = Math.max(64, nextMaxDrag * 0.6)
    maxDragRef.current = nextMaxDrag
    thresholdRef.current = nextThreshold
    setThreshold(nextThreshold)
    startXRef.current = event.clientX
    currentDragRef.current = 0
    setDragX(0)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (startXRef.current === null) return
    const nextDrag = Math.max(0, Math.min(maxDragRef.current, event.clientX - startXRef.current))
    currentDragRef.current = nextDrag
    setDragX(nextDrag)
  }

  function handlePointerEnd(event: PointerEvent<HTMLButtonElement>) {
    if (currentDragRef.current >= thresholdRef.current) onComplete()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    startXRef.current = null
    currentDragRef.current = 0
    setDragX(0)
  }

  return (
    <button
      aria-label={`오른쪽으로 밀어서 ${label}`}
      className={`swipe-confirm ${tone === 'danger' ? 'danger' : ''} ${dragX >= threshold ? 'ready' : ''}`}
      onPointerCancel={handlePointerEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      style={{ '--swipe-x': `${dragX}px` } as CSSProperties & Record<'--swipe-x', string>}
      type="button"
    >
      <span className="swipe-confirm-track">{label}</span>
      <span className="swipe-confirm-thumb">
        <ChevronRight size={20} strokeWidth={3} />
      </span>
    </button>
  )
}

export function AttendanceList({
  divisionId,
  statusFilter,
  query,
  record,
  section,
  onSetStatus,
  onSetScheduledException,
  onClearScheduledException,
  onResetFilters,
}: AttendanceListProps) {
  const [selectedItem, setSelectedItem] = useState<AttendanceItem>()
  const [pickerMode, setPickerMode] = useState<'choices' | 'leave' | 'leaveActive' | 'fixedActive' | 'missing'>('choices')
  const [leaveStart, setLeaveStart] = useState(record.date || toDateInputValue())
  const [leaveUntil, setLeaveUntil] = useState(record.date || toDateInputValue())
  const [missingReason, setMissingReason] = useState<MissingReason>('work')
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([])
  const scopedItems = record.records
    .filter((item) => {
      if (divisionId !== 'all' && (item.divisionId ?? '') !== divisionId) return false
      if (section !== 'all' && (item.section ?? '') !== section) return false
      return matchesSearch(query, [item.name, item.divisionName, item.section])
    })
    .sort((a, b) => {
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
  const ateCount = scopedItems.filter((item) => normalizeAttendanceStatus(item.status, item.ate) === 'ate').length
  const missingCount = scopedItems.filter((item) => normalizeAttendanceStatus(item.status, item.ate) === 'missing').length
  const exceptionCount = scopedItems.filter((item) => {
    const status = normalizeAttendanceStatus(item.status, item.ate)
    return status !== 'ate' && status !== 'missing'
  }).length
  const sectionGroups = scopedItems.reduce<Array<{ sectionName: string; items: AttendanceItem[] }>>((groups, item) => {
    const sectionName = item.section?.trim() || '분과 미지정'
    const existing = groups.find((group) => group.sectionName === sectionName)
    if (existing) existing.items.push(item)
    else groups.push({ sectionName, items: [item] })
    return groups
  }, [])

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

  function markSelectedMissing() {
    if (!selectedItem) return
    onSetStatus(selectedItem.soldierId, 'missing', missingReason)
    closePicker()
  }

  function openPicker(item: AttendanceItem) {
    const start = item.exceptionStart ?? record.date ?? toDateInputValue()
    setLeaveStart(start)
    setLeaveUntil(item.exceptionUntil ?? start)
    setPickerMode(
      item.status === 'leave' && item.exceptionUntil
        ? 'leaveActive'
        : item.status === 'cooking' || item.status === 'room'
          ? 'fixedActive'
          : 'choices',
    )
    setSelectedItem(item)
  }

  function closePicker() {
    setSelectedItem(undefined)
    setPickerMode('choices')
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (selectedItem) { closePicker(); return }
      if (bulkSelectedIds.length > 0) setBulkSelectedIds([])
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [selectedItem, bulkSelectedIds.length])

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

  function toggleBulkSelection(item: AttendanceItem) {
    const status = normalizeAttendanceStatus(item.status, item.ate)
    if (status !== 'ate' && status !== 'missing') return
    setBulkSelectedIds((selectedIds) =>
      selectedIds.includes(item.soldierId)
        ? selectedIds.filter((id) => id !== item.soldierId)
        : [...selectedIds, item.soldierId],
    )
  }

  async function applyBulkAte() {
    for (const soldierId of bulkSelectedIds) {
      await onSetStatus(soldierId, 'ate')
    }
    setBulkSelectedIds([])
  }

  if (scopedItems.length === 0) {
    const activeFilters = [
      query && `"${query}"`,
      divisionId !== 'all' && '포대 필터',
      section !== 'all' && '분과 필터',
      statusFilter !== 'all' && '상태 필터',
    ].filter(Boolean)
    return (
      <div className="empty-state-detailed">
        <p>조건에 맞는 인원이 없습니다.</p>
        {activeFilters.length > 0 && <small>{activeFilters.join(' · ')} 적용 중</small>}
        {onResetFilters && activeFilters.length > 0 && (
          <button onClick={onResetFilters} type="button">필터 초기화</button>
        )}
      </div>
    )
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
          <strong>{scopedItems.length}명</strong>
        </div>
      </section>
      <div className={`attendance-section-list${bulkSelectedIds.length > 0 ? ' has-bulk-bar' : ''}`}>
        {sectionGroups.map((group) => {
          const groupAteCount = group.items.filter((item) => normalizeAttendanceStatus(item.status, item.ate) === 'ate').length
          const groupMissingCount = group.items.filter((item) => normalizeAttendanceStatus(item.status, item.ate) === 'missing').length
          const groupWorkCount = group.items.length - groupAteCount - groupMissingCount
          const groupComplete = groupMissingCount === 0 && groupWorkCount === 0
          const visibleItems = groupComplete && statusFilter === 'all' ? [] : group.items.filter((item) => {
            const status = normalizeAttendanceStatus(item.status, item.ate)
            if (statusFilter === 'missing') return status === 'missing'
            if (statusFilter === 'work') return status !== 'ate' && status !== 'missing'
            return true
          })
          const completeLabel =
            groupComplete
              ? '식사완료'
              : statusFilter === 'work' && groupWorkCount === 0
                ? '근무/기타 없음'
                : undefined
          return (
          <section className={`attendance-section-group ${completeLabel ? 'section-complete' : ''}`} key={group.sectionName}>
            <header className="attendance-section-header">
              <div>
                <strong>{group.sectionName}</strong>
                <span>
                  총원 {group.items.length} · 취식 {groupAteCount} · 미취식 {groupMissingCount}
                  {groupWorkCount > 0 ? ` · 근무/기타 ${groupWorkCount}` : ''}
                </span>
              </div>
              {completeLabel && <em>{completeLabel}</em>}
            </header>
            <div className="attendance-grid">
              {visibleItems.map((item) => {
                const status = normalizeAttendanceStatus(item.status, item.ate)
                const isCompleted = isAteStatus(item.status, item.ate)
                const isLeaveActive = status === 'leave' && Boolean(item.exceptionUntil)
                const isBulkSelected = bulkSelectedIds.includes(item.soldierId)
                const exceptionLabel = isLeaveActive
                  ? '휴가 중'
                  : status === 'ate' || status === 'missing'
                    ? '근무/기타'
                    : attendanceStatusLabels[status]
                return (
                  <article
                    className={`attendance-tile status-${status} ${isBulkSelected ? 'bulk-selected' : ''}`}
                    key={item.soldierId}
                  >
                    <button className="attendance-main-button" onClick={() => toggleBulkSelection(item)} type="button">
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
                      <button
                        className={`status-action status-action-${status}`}
                        onClick={() => status === 'missing' ? void onSetStatus(item.soldierId, 'ate') : status === 'ate' ? openMissingReason(item) : openPicker(item)}
                        type="button"
                      >
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
          </section>
        )})}
      </div>

      {bulkSelectedIds.length > 0 && (
        <section aria-live="polite" className="bulk-selection-panel" role="status">
          <div className="bulk-selection-title">
            <strong>{bulkSelectedIds.length}명 선택</strong>
            <span>취식 처리할 인원</span>
          </div>
          <div className="modal-actions">
            <button className="ghost-button" onClick={() => setBulkSelectedIds([])} type="button">
              선택 해제
            </button>
            <button className="primary-button" onClick={() => void applyBulkAte()} type="button">
              취식 적용
            </button>
          </div>
        </section>
      )}

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
                    : pickerMode === 'fixedActive'
                      ? `${attendanceStatusLabels[selectedItem.status]} 고정`
                      : pickerMode === 'missing'
                        ? '미취식 전환'
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
                <div className="modal-actions single-action">
                  <SwipeStatusAction
                    label="밀어서 미취식 변경"
                    onComplete={markSelectedMissing}
                    tone="danger"
                  />
                </div>
              </div>
            ) : pickerMode === 'fixedActive' ? (
              <div className="leave-date-form">
                <div className="leave-summary">
                  <strong>{attendanceStatusLabels[selectedItem.status]} 고정 중</strong>
                  <span>해제 전까지 매일 취식 완료로 포함됩니다.</span>
                </div>
                <button className="danger-button" onClick={clearLeave} type="button">
                  {attendanceStatusLabels[selectedItem.status]} 해제
                </button>
              </div>
            ) : pickerMode === 'leaveActive' ? (
              <div className="leave-date-form">
                <div className="leave-summary">
                  <strong>현재 휴가 중</strong>
                  <span>
                    {leaveStart} ~ {leaveUntil}
                  </span>
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
