import { useState } from 'react'
import { Search } from 'lucide-react'
import type { AppState } from '../app/appState'
import { AttendanceList } from '../components/AttendanceList'
import { MealSelector } from '../components/MealSelector'

type DivisionFilter = string | 'all'
type StatusFilter = 'all' | 'ate' | 'missing' | 'work'

export function AttendanceScreen({ app }: { app: AppState }) {
  const [query, setQuery] = useState('')
  const [divisionId, setDivisionId] = useState<DivisionFilter>('all')
  const [section, setSection] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
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
        <div className="status-filter-row" aria-label="취식 상태 필터">
          {[
            ['all', '전체'],
            ['missing', '미취식만'],
            ['work', '근무/기타만'],
            ['ate', '취식자만'],
          ].map(([value, label]) => (
            <button
              className={statusFilter === value ? 'active' : ''}
              key={value}
              onClick={() => setStatusFilter(value as StatusFilter)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </section>
      <AttendanceList
        divisionId={divisionId}
        section={section}
        onClearScheduledException={(id) => void app.clearScheduledException(id)}
        onSetStatus={app.setAttendanceStatus}
        onSetScheduledException={(id, status, start, until) => void app.setScheduledException(id, status, start, until)}
        query={query}
        record={app.currentRecord}
        statusFilter={statusFilter}
      />
    </div>
  )
}
