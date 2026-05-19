import { useMemo, useState } from 'react'
import { Filter, Search, X } from 'lucide-react'
import type { AppState } from '../app/appState'
import { AttendanceList } from '../components/AttendanceList'
import { MealSelector } from '../components/MealSelector'

type DivisionFilter = string | 'all'
type StatusFilter = 'all' | 'missing' | 'work'

export function AttendanceScreen({ app }: { app: AppState }) {
  const [query, setQuery] = useState('')
  const [divisionId, setDivisionId] = useState<DivisionFilter>('all')
  const [section, setSection] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const sections = useMemo(() => {
    const names = new Set<string>()
    app.sections.forEach((item) => {
      if (divisionId === 'all' || item.divisionId === divisionId) names.add(item.name)
    })
    app.soldiers.forEach((soldier) => {
      const name = soldier.section?.trim()
      if (!name) return
      if (divisionId === 'all' || soldier.divisionId === divisionId) names.add(name)
    })
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'ko'))
  }, [app.sections, app.soldiers, divisionId])

  function changeDivision(nextDivisionId: DivisionFilter) {
    setDivisionId(nextDivisionId)
    if (nextDivisionId !== 'all') {
      const allowedSections = new Set(
        app.soldiers
          .filter((soldier) => soldier.divisionId === nextDivisionId)
          .map((soldier) => soldier.section?.trim())
          .filter((item): item is string => Boolean(item)),
      )
      app.sections.filter((item) => item.divisionId === nextDivisionId).forEach((item) => allowedSections.add(item.name))
      if (section !== 'all' && !allowedSections.has(section)) setSection('all')
    }
  }

  return (
    <div className="stack">
      <section className="panel control-panel attendance-sticky-controls">
        <div className="field-line">
          <MealSelector meal={app.meal} onChange={app.setMeal} />
        </div>
        <label className="search-box">
          <Search size={18} />
          <input onChange={(event) => setQuery(event.target.value)} placeholder="이름, 포대 또는 분과 검색" value={query} />
        </label>
        <button className="filter-dialog-button" onClick={() => setFilterOpen(true)} type="button">
          <Filter size={17} />
          {app.meal === 'breakfast' ? '조식' : app.meal === 'lunch' ? '중식' : '석식'} ·{' '}
          {divisionId === 'all' ? '전체 포대' : app.divisions.find((division) => division.id === divisionId)?.name || '포대 미지정'} /{' '}
          {section === 'all' ? '전체 분과' : section || '분과 미지정'}
        </button>
        <div className="status-filter-row" aria-label="취식 상태 필터">
          {[
            ['all', '전체'],
            ['missing', '미취식만'],
            ['work', '근무/기타만'],
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
        onResetFilters={() => { setQuery(''); setDivisionId('all'); setSection('all'); setStatusFilter('all') }}
        onSetStatus={app.setAttendanceStatus}
        onSetScheduledException={(id, status, start, until) => void app.setScheduledException(id, status, start, until)}
        query={query}
        record={app.currentRecord}
        statusFilter={statusFilter}
      />
      {filterOpen && (
        <div className="modal-backdrop" onClick={() => setFilterOpen(false)}>
          <section className="modal attendance-filter-modal" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <div>
                <span>취식체크 필터</span>
                <h2>포대/분과 선택</h2>
              </div>
              <button aria-label="닫기" className="icon-button" onClick={() => setFilterOpen(false)} type="button">
                <X size={20} />
              </button>
            </header>
            <div className="filter-chip-section">
              <span>포대</span>
              <div className="chip-row">
                <button className={divisionId === 'all' ? 'active' : ''} onClick={() => changeDivision('all')} type="button">
                  전체
                </button>
                {app.divisions.map((division) => (
                  <button className={divisionId === division.id ? 'active' : ''} key={division.id} onClick={() => changeDivision(division.id)} type="button">
                    {division.name}
                  </button>
                ))}
                <button className={divisionId === '' ? 'active' : ''} onClick={() => changeDivision('')} type="button">
                  미지정
                </button>
              </div>
            </div>
            <div className="filter-chip-section">
              <span>분과</span>
              <div className="chip-row">
                <button className={section === 'all' ? 'active' : ''} onClick={() => setSection('all')} type="button">
                  전체
                </button>
                {sections.map((item) => (
                  <button className={section === item ? 'active' : ''} key={item} onClick={() => setSection(item)} type="button">
                    {item}
                  </button>
                ))}
                <button className={section === '' ? 'active' : ''} onClick={() => setSection('')} type="button">
                  미지정
                </button>
              </div>
            </div>
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => { setDivisionId('all'); setSection('all') }} type="button">
                초기화
              </button>
              <button className="primary-button" onClick={() => setFilterOpen(false)} type="button">
                적용
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
