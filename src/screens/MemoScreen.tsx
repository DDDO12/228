import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Save } from 'lucide-react'
import type { AppState } from '../app/appState'
import { toDateInputValue } from '../utils/date'

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

export function MemoScreen({ app }: { app: AppState }) {
  const today = new Date()
  const [visibleMonth, setVisibleMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(toDateInputValue())
  const selectedMemo = app.memos.find((memo) => memo.date === selectedDate)?.content ?? ''
  const [draft, setDraft] = useState(selectedMemo)
  const memoDates = useMemo(() => new Set(app.memos.map((memo) => memo.date)), [app.memos])
  const days = buildCalendarDays(visibleMonth)

  function shiftMonth(delta: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }

  function selectDate(value: string) {
    setSelectedDate(value)
    setDraft(app.memos.find((memo) => memo.date === value)?.content ?? '')
  }

  async function save() {
    await app.saveMemo(selectedDate, draft)
    app.setToast('메모를 저장했습니다.')
  }

  return (
    <div className="stack">
      <section className="panel memo-calendar-panel">
        <div className="calendar-header">
          <button aria-label="이전 달" onClick={() => shiftMonth(-1)} type="button">
            <ChevronLeft size={20} />
          </button>
          <h2>
            {visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월
          </h2>
          <button aria-label="다음 달" onClick={() => shiftMonth(1)} type="button">
            <ChevronRight size={20} />
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
            return (
              <button
                className={`${inMonth ? '' : 'muted'} ${value === selectedDate ? 'selected' : ''}`}
                key={value}
                onClick={() => selectDate(value)}
                type="button"
              >
                <span>{day.getDate()}</span>
                {memoDates.has(value) && <i />}
              </button>
            )
          })}
        </div>
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
    </div>
  )
}
