import { useState } from 'react'
import { RotateCcw, Search } from 'lucide-react'
import type { AppState } from '../app/appState'
import { AttendanceList } from '../components/AttendanceList'
import { MealSelector } from '../components/MealSelector'

type DivisionFilter = string | 'all'

export function AttendanceScreen({ app }: { app: AppState }) {
  const [query, setQuery] = useState('')
  const [divisionId, setDivisionId] = useState<DivisionFilter>('all')
  const [showMissingOnly, setShowMissingOnly] = useState(false)
  const [onlyChecked, setOnlyChecked] = useState(false)

  return (
    <div className="stack">
      <section className="panel control-panel">
        <div className="field-line">
          <input onChange={(event) => app.setDate(event.target.value)} type="date" value={app.date} />
          <MealSelector meal={app.meal} onChange={app.setMeal} />
        </div>
        <label className="search-box">
          <Search size={18} />
          <input onChange={(event) => setQuery(event.target.value)} placeholder="이름 또는 분과 검색" value={query} />
        </label>
        <div className="chip-row division-filter-row">
          <button className={divisionId === 'all' ? 'active' : ''} onClick={() => setDivisionId('all')} type="button">
            전체
          </button>
          {app.divisions.map((division) => (
            <button
              className={divisionId === division.id ? 'active' : ''}
              key={division.id}
              onClick={() => setDivisionId(division.id)}
              type="button"
            >
              {division.name}
            </button>
          ))}
          <button className={divisionId === '' ? 'active' : ''} onClick={() => setDivisionId('')} type="button">
            미지정
          </button>
        </div>
        <div className="field-line">
          <button className="secondary-button" onClick={() => void app.bulkSetAttendance('ate')} type="button">
            전체 취식
          </button>
          <button className="secondary-button" onClick={() => void app.bulkSetAttendance('missing')} type="button">
            전체 미취식
          </button>
        </div>
        <div className="toggle-line">
          <label>
            <input checked={showMissingOnly} onChange={(event) => setShowMissingOnly(event.target.checked)} type="checkbox" /> 미취식/열외만
          </label>
          <label>
            <input checked={onlyChecked} onChange={(event) => setOnlyChecked(event.target.checked)} type="checkbox" /> 취식자만
          </label>
          {app.undoRecord && (
            <button className="link-button" onClick={() => void app.undo()} type="button">
              <RotateCcw size={16} /> 실행 취소
            </button>
          )}
        </div>
      </section>
      <AttendanceList
        divisionId={divisionId}
        onSetStatus={(id, status) => void app.setAttendanceStatus(id, status)}
        onSetScheduledException={(id, status, until) => void app.setScheduledException(id, status, until)}
        onToggle={(id) => void app.toggleAttendance(id)}
        onlyActive={onlyChecked}
        query={query}
        record={app.currentRecord}
        showMissingOnly={showMissingOnly}
      />
    </div>
  )
}
