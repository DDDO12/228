import { useState } from 'react'
import { Search } from 'lucide-react'
import type { AppState } from '../app/appState'
import { AttendanceList } from '../components/AttendanceList'
import { MealSelector } from '../components/MealSelector'

type DivisionFilter = string | 'all'

export function AttendanceScreen({ app }: { app: AppState }) {
  const [query, setQuery] = useState('')
  const [divisionId, setDivisionId] = useState<DivisionFilter>('all')
  const [section, setSection] = useState<string>('all')
  const [showMissingOnly, setShowMissingOnly] = useState(false)
  const [onlyChecked, setOnlyChecked] = useState(false)
  const sections = Array.from(
    new Set(app.soldiers.map((soldier) => soldier.section?.trim()).filter((item): item is string => Boolean(item))),
  ).sort()

  return (
    <div className="stack">
      <section className="panel control-panel">
        <div className="field-line">
          <MealSelector meal={app.meal} onChange={app.setMeal} />
        </div>
        <label className="search-box">
          <Search size={18} />
          <input onChange={(event) => setQuery(event.target.value)} placeholder="이름, 포대 또는 분과 검색" value={query} />
        </label>
        <div className="filter-select-row">
          <label>
            <span>포대</span>
            <select onChange={(event) => setDivisionId(event.target.value as DivisionFilter)} value={divisionId}>
              <option value="all">전체 포대</option>
              {app.divisions.map((division) => (
                <option key={division.id} value={division.id}>
                  {division.name}
                </option>
              ))}
              <option value="">포대 미지정</option>
            </select>
          </label>
          <label>
            <span>분과</span>
            <select onChange={(event) => setSection(event.target.value)} value={section}>
              <option value="all">전체 분과</option>
              {sections.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
              <option value="">분과 미지정</option>
            </select>
          </label>
        </div>
        <div className="bulk-action-row compact-actions">
          <button className="bulk-action-button bulk-action-ate" onClick={() => void app.bulkSetAttendance('ate')} type="button">
            전체 취식
          </button>
          <button className="bulk-action-button bulk-action-missing" onClick={() => void app.bulkSetAttendance('missing')} type="button">
            전체 미취식
          </button>
        </div>
        <div className="toggle-line">
          <label>
            <input checked={showMissingOnly} onChange={(event) => setShowMissingOnly(event.target.checked)} type="checkbox" /> 미취식/근무만
          </label>
          <label>
            <input checked={onlyChecked} onChange={(event) => setOnlyChecked(event.target.checked)} type="checkbox" /> 취식자만
          </label>
        </div>
      </section>
      <AttendanceList
        divisionId={divisionId}
        section={section}
        onClearScheduledException={(id) => void app.clearScheduledException(id)}
        onSetStatus={(id, status, missingReason) => void app.setAttendanceStatus(id, status, missingReason)}
        onSetScheduledException={(id, status, start, until) => void app.setScheduledException(id, status, start, until)}
        onToggle={(id) => void app.toggleAttendance(id)}
        onlyActive={onlyChecked}
        query={query}
        record={app.currentRecord}
        showMissingOnly={showMissingOnly}
      />
    </div>
  )
}
