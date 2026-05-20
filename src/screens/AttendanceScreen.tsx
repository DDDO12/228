import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Filter, Search, X } from 'lucide-react'
import type { AppState } from '../app/appState'
import { AttendanceList } from '../components/AttendanceList'
import { normalizeAttendanceStatus, type AttendanceItem } from '../domain/attendance'
import { MealSelector } from '../components/MealSelector'
import { getHangulInitials, matchesSearch } from '../utils/search'

type DivisionFilter = string | 'all'
type StatusFilter = 'all' | 'missing' | 'work'

function normalizeQuickEntry(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

function sortAttendanceItems(a: AttendanceItem, b: AttendanceItem) {
  const statusA = normalizeAttendanceStatus(a.status, a.ate)
  const statusB = normalizeAttendanceStatus(b.status, b.ate)
  const rank = (status: typeof statusA) => (status !== 'ate' && status !== 'missing' ? 2 : status === 'ate' ? 1 : 0)
  const sectionA = a.section?.trim() ?? ''
  const sectionB = b.section?.trim() ?? ''
  const sectionRank = Number(!sectionA) - Number(!sectionB)
  return (
    rank(statusA) - rank(statusB) ||
    sectionRank ||
    sectionA.localeCompare(sectionB, 'ko') ||
    a.name.localeCompare(b.name, 'ko')
  )
}

export function AttendanceScreen({ app }: { app: AppState }) {
  const [query, setQuery] = useState('')
  const [divisionId, setDivisionId] = useState<DivisionFilter>('all')
  const [section, setSection] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const queryInputRef = useRef<HTMLInputElement>(null)
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

  const scopedItems = useMemo(() => {
    return app.currentRecord.records
      .filter((item) => {
        if (divisionId !== 'all' && (item.divisionId ?? '') !== divisionId) return false
        if (section !== 'all' && (item.section ?? '') !== section) return false
        if (statusFilter === 'missing') return normalizeAttendanceStatus(item.status, item.ate) === 'missing'
        if (statusFilter === 'work') {
          const status = normalizeAttendanceStatus(item.status, item.ate)
          return status !== 'ate' && status !== 'missing'
        }
        return true
      })
      .sort(sortAttendanceItems)
  }, [app.currentRecord.records, divisionId, section, statusFilter])

  async function submitQuickAttendance() {
    const term = query.trim()
    if (!term) return

    const visibleMatches = scopedItems.filter((item) => matchesSearch(term, [item.name, item.divisionName, item.section]))
    const normalizedTerm = normalizeQuickEntry(term)
    const exactNameMatches = visibleMatches.filter((item) => normalizeQuickEntry(item.name) === normalizedTerm)
    const exactInitialMatches = visibleMatches.filter(
      (item) => normalizeQuickEntry(getHangulInitials(item.name)) === normalizedTerm,
    )
    const target =
      exactNameMatches.length === 1
        ? exactNameMatches[0]
        : exactInitialMatches.length === 1
          ? exactInitialMatches[0]
          : visibleMatches.length === 1
            ? visibleMatches[0]
            : undefined

    if (!target) {
      if (visibleMatches.length === 0) app.setToast('일치하는 인원을 찾지 못했습니다.')
      else app.setToast('같은 조건의 인원이 여러 명입니다. 이름을 조금 더 정확히 입력해 주세요.')
      return
    }

    const status = normalizeAttendanceStatus(target.status, target.ate)
    if (status === 'ate') app.setToast(`${target.name}은 이미 취식 처리되어 있습니다.`)
    else await app.setAttendanceStatus(target.soldierId, 'ate')

    setQuery('')
    requestAnimationFrame(() => queryInputRef.current?.focus())
  }

  async function handleQueryKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    await submitQuickAttendance()
  }

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
          <input
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => void handleQueryKeyDown(event)}
            placeholder="이름, 포대 또는 분과 검색"
            ref={queryInputRef}
            value={query}
          />
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
