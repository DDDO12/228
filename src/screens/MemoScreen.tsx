import { useMemo, useRef, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarPlus, ChevronLeft, ChevronRight, Save, Search, Trash2, X } from 'lucide-react'
import type { AppState } from '../app/appState'
import { getDivisionName, type Soldier } from '../domain/soldier'
import { toDateInputValue } from '../utils/date'
import { matchesSearch } from '../utils/search'

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function dateKey(date: Date) {
  return toDateInputValue(date)
}

function buildCalendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return day
  })
}

function isLeaveOnDate(soldier: Soldier, date: string) {
  if (soldier.exceptionStatus !== 'leave' || !soldier.exceptionUntil) return false
  const start = soldier.exceptionStart ?? date
  return start <= date && soldier.exceptionUntil >= date
}

const koreanNameCollator = new Intl.Collator('ko-KR', { numeric: true, sensitivity: 'base' })

export function MemoScreen({ app }: { app: AppState }) {
  const today = new Date()
  const [visibleMonth, setVisibleMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(toDateInputValue())
  const selectedMemo = app.memos.find((memo) => memo.date === selectedDate)?.content ?? ''
  const [draft, setDraft] = useState(selectedMemo)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leaveQuery, setLeaveQuery] = useState('')
  const [leaveSoldierId, setLeaveSoldierId] = useState('')
  const [leaveStart, setLeaveStart] = useState(selectedDate)
  const [leaveUntil, setLeaveUntil] = useState(selectedDate)
  const leavePressTimer = useRef<number | undefined>(undefined)
  const suppressLeaveClick = useRef(false)
  const memoDates = useMemo(() => new Set(app.memos.map((memo) => memo.date)), [app.memos])
  const days = buildCalendarDays(visibleMonth)
  const activeSoldiers = useMemo(
    () => app.soldiers.filter((soldier) => soldier.active).sort((a, b) => koreanNameCollator.compare(a.name, b.name)),
    [app.soldiers],
  )
  const leaveSchedules = useMemo(
    () =>
      app.soldiers
        .filter((soldier) => soldier.active && soldier.exceptionStatus === 'leave' && soldier.exceptionUntil)
        .sort((a, b) => {
          const startCompare = (a.exceptionStart ?? '').localeCompare(b.exceptionStart ?? '')
          return startCompare || koreanNameCollator.compare(a.name, b.name)
        }),
    [app.soldiers],
  )
  const selectedLeaveSchedules = leaveSchedules.filter((soldier) => isLeaveOnDate(soldier, selectedDate))
  const leaveCandidates = activeSoldiers.filter((soldier) =>
    matchesSearch(leaveQuery, [soldier.name, soldier.section, getDivisionName(app.divisions, soldier.divisionId)]),
  )
  const selectedLeaveSoldier = activeSoldiers.find((soldier) => soldier.id === leaveSoldierId)

  function shiftMonth(delta: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }

  function selectDate(value: string) {
    setSelectedDate(value)
    setLeaveStart(value)
    setLeaveUntil(value)
    setDraft(app.memos.find((memo) => memo.date === value)?.content ?? '')
  }

  async function save() {
    await app.saveMemo(selectedDate, draft)
    app.setToast('메모를 저장했습니다.')
  }

  function openLeaveModal() {
    setLeaveStart(selectedDate)
    setLeaveUntil(selectedDate)
    setLeaveQuery('')
    setLeaveOpen(true)
  }

  function startLeavePress() {
    window.clearTimeout(leavePressTimer.current)
    suppressLeaveClick.current = false
    leavePressTimer.current = window.setTimeout(() => {
      suppressLeaveClick.current = true
      openLeaveModal()
    }, 420)
  }

  function stopLeavePress() {
    window.clearTimeout(leavePressTimer.current)
  }

  function handleLeaveFabClick() {
    if (suppressLeaveClick.current) {
      suppressLeaveClick.current = false
      return
    }
    openLeaveModal()
  }

  function updateLeaveStart(value: string) {
    setLeaveStart(value)
    if (leaveUntil < value) setLeaveUntil(value)
  }

  async function submitLeave(event: FormEvent) {
    event.preventDefault()
    if (!leaveSoldierId) {
      app.setToast('휴가 등록할 인원을 선택하세요.')
      return
    }
    const ok = await app.scheduleSoldierLeave(leaveSoldierId, leaveStart, leaveUntil)
    if (ok) {
      setLeaveOpen(false)
      setLeaveSoldierId('')
      setLeaveQuery('')
    }
  }

  function deleteLeave(soldier: Soldier) {
    const ok = window.confirm(`${soldier.name} 휴가 일정을 삭제할까요?`)
    if (ok) void app.clearSoldierLeave(soldier.id)
  }

  return (
    <div className="stack memo-screen">
      <section className="panel memo-calendar-panel">
        <div className="calendar-header">
          <button aria-label="이전 달" onClick={() => shiftMonth(-1)} type="button">
            <ChevronLeft size={18} />
          </button>
          <h2>
            {visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월
          </h2>
          <button aria-label="다음 달" onClick={() => shiftMonth(1)} type="button">
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="calendar-weekdays">
          {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="memo-calendar-grid">
          {days.map((day) => {
            const value = dateKey(day)
            const inMonth = monthKey(day) === monthKey(visibleMonth)
            const hasMemo = memoDates.has(value)
            const hasLeave = leaveSchedules.some((soldier) => isLeaveOnDate(soldier, value))
            return (
              <button
                className={`${inMonth ? '' : 'muted'} ${value === selectedDate ? 'selected' : ''} ${hasLeave ? 'has-leave' : ''}`}
                key={value}
                onClick={() => selectDate(value)}
                type="button"
              >
                <span>{day.getDate()}</span>
                {(hasMemo || hasLeave) && (
                  <span className="memo-calendar-markers">
                    {hasMemo && <i className="memo-dot" />}
                    {hasLeave && <i className="leave-dot" />}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      <section className="panel memo-leave-panel">
        <div className="panel-title-row">
          <h2>휴가 일정</h2>
          <small>{selectedDate.slice(2)} 기준</small>
        </div>
        {selectedLeaveSchedules.length > 0 ? (
          <div className="memo-leave-list">
            {selectedLeaveSchedules.map((soldier) => (
              <article key={soldier.id}>
                <div>
                  <strong>{soldier.name}</strong>
                  <span>
                    {getDivisionName(app.divisions, soldier.divisionId)}
                    {soldier.section ? ` · ${soldier.section}` : ''} · {soldier.exceptionStart ?? selectedDate}~{soldier.exceptionUntil}
                  </span>
                </div>
                <button aria-label={`${soldier.name} 휴가 삭제`} onClick={() => deleteLeave(soldier)} type="button">
                  <Trash2 size={16} />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-inline">선택한 날짜에 등록된 휴가가 없습니다.</div>
        )}
      </section>

      <section className="panel memo-editor-panel">
        <div className="panel-title-row">
          <h2>{selectedDate} 메모</h2>
          <small>{draft.trim().length}자</small>
        </div>
        <textarea
          onChange={(event) => setDraft(event.target.value)}
          placeholder="오늘 전달사항, 특이사항, 부식 요청, 근무 관련 메모를 적어두세요."
          value={draft}
        />
        <button className="primary-button" onClick={() => void save()} type="button">
          <Save size={18} /> 메모 저장
        </button>
      </section>

      <motion.button
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="memo-leave-add-fab"
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        onClick={handleLeaveFabClick}
        onPointerCancel={stopLeavePress}
        onPointerDown={startLeavePress}
        onPointerLeave={stopLeavePress}
        onPointerUp={stopLeavePress}
        transition={{ delay: 0.12, duration: 0.2 }}
        type="button"
        whileTap={{ scale: 0.94 }}
      >
        <CalendarPlus size={18} />
        휴가 등록
      </motion.button>

      <AnimatePresence>
        {leaveOpen && (
          <motion.div
            animate={{ opacity: 1 }}
            className="modal-backdrop"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={() => setLeaveOpen(false)}
          >
            <motion.form
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="modal memo-leave-modal"
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              onClick={(event) => event.stopPropagation()}
              onSubmit={submitLeave}
              transition={{ duration: 0.16 }}
            >
              <header className="modal-header">
                <div>
                  <span>메모 일정</span>
                  <h2>휴가 등록</h2>
                </div>
                <button aria-label="닫기" className="icon-button" onClick={() => setLeaveOpen(false)} type="button">
                  <X size={20} />
                </button>
              </header>
              <label className="search-box">
                <Search size={18} />
                <input autoFocus onChange={(event) => setLeaveQuery(event.target.value)} placeholder="이름, 포대 또는 분과 검색" value={leaveQuery} />
              </label>
              <div className="vacation-candidate-grid">
                {leaveCandidates.map((soldier) => (
                  <button
                    className={soldier.id === leaveSoldierId ? 'selected' : ''}
                    key={soldier.id}
                    onClick={() => setLeaveSoldierId(soldier.id)}
                    type="button"
                  >
                    <strong>{soldier.name}</strong>
                    <span>
                      {getDivisionName(app.divisions, soldier.divisionId)}
                      {soldier.section ? ` · ${soldier.section}` : ''}
                    </span>
                  </button>
                ))}
              </div>
              <div className="leave-date-form">
                <label className="leave-date-control">
                  <span>휴가 시작</span>
                  <input onChange={(event) => updateLeaveStart(event.target.value)} type="date" value={leaveStart} />
                </label>
                <label className="leave-date-control">
                  <span>휴가 종료</span>
                  <input min={leaveStart} onChange={(event) => setLeaveUntil(event.target.value)} type="date" value={leaveUntil} />
                </label>
              </div>
              <div className="leave-summary">
                <strong>{selectedLeaveSoldier?.name ?? '인원 선택 필요'}</strong>
                <span>
                  {leaveStart} ~ {leaveUntil < leaveStart ? leaveStart : leaveUntil}
                </span>
              </div>
              <button className="primary-button" disabled={!leaveSoldierId} type="submit">
                <CalendarPlus size={18} /> 휴가 등록
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
