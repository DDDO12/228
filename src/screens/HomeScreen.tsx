import { AlertTriangle } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import type { AppState } from '../app/appState'
import breakfastHero from '../assets/meal-breakfast-hero.webp'
import dinnerHero from '../assets/meal-dinner-hero.webp'
import lunchHero from '../assets/meal-lunch-hero.webp'
import {
  attendanceStatusLabels,
  exceptionStatuses,
  isAteStatus,
  normalizeAttendanceStatus,
  syncAttendanceRecord,
  type AttendanceItem,
  type AttendanceRecord,
  type AttendanceStatus,
  type ScheduledExceptionStatus,
} from '../domain/attendance'
import { isLowStock } from '../domain/inventory'
import { mealLabels, mealOrder, type MealType } from '../domain/meal'
import { formatCompactDate } from '../utils/date'

const mealHeroImages: Record<MealType, string> = {
  breakfast: breakfastHero,
  dinner: dinnerHero,
  lunch: lunchHero,
}

function countItems(items: AttendanceItem[], status: AttendanceStatus) {
  return items.filter((item) => normalizeAttendanceStatus(item.status, item.ate) === status).length
}

function countExceptions(items: AttendanceItem[]) {
  return items.filter((item) => {
    const status = normalizeAttendanceStatus(item.status, item.ate)
    return status !== 'ate' && status !== 'missing'
  }).length
}

function countCompleted(items: AttendanceItem[]) {
  return items.filter((item) => isAteStatus(item.status, item.ate)).length
}

function summarizeItems(items: AttendanceItem[]) {
  return {
    ate: countItems(items, 'ate'),
    completed: countCompleted(items),
    excluded: countExceptions(items),
    missing: countItems(items, 'missing'),
    total: items.length,
  }
}

function sortWorkItems(app: AppState, first: AttendanceItem, second: AttendanceItem) {
  const firstDivision = app.divisions.find((division) => division.id === first.divisionId)?.name ?? '포대 미지정'
  const secondDivision = app.divisions.find((division) => division.id === second.divisionId)?.name ?? '포대 미지정'

  return (
    firstDivision.localeCompare(secondDivision, 'ko') ||
    (first.section ?? '분과 미지정').localeCompare(second.section ?? '분과 미지정', 'ko') ||
    first.name.localeCompare(second.name, 'ko')
  )
}

function getWorkItemMeta(app: AppState, item: AttendanceItem) {
  return {
    division: app.divisions.find((division) => division.id === item.divisionId)?.name ?? '포대 미지정',
    period: item.exceptionUntil ? `${item.exceptionStart ?? app.date}~${item.exceptionUntil}` : '',
    section: item.section || '분과 미지정',
  }
}

export function HomeScreen({ app }: { app: AppState }) {
  const [workStatusFilter, setWorkStatusFilter] = useState<ScheduledExceptionStatus | 'all'>('all')
  const recordsByMeal: Array<AttendanceRecord | undefined> = mealOrder.map((meal) => {
    const stored = app.attendanceRecords.find((record) => record.date === app.date && record.meal === meal)
    return stored && stored.records.length > 0 ? syncAttendanceRecord(stored, app.soldiers, app.divisions) : undefined
  })
  const selectedDateRecords = recordsByMeal.filter((record): record is AttendanceRecord => Boolean(record))
  const hasDateRecords = selectedDateRecords.length > 0
  const lowStockItems = app.inventoryItems.filter(isLowStock)

  const mealRecords = mealOrder.map((meal, index) => ({
    meal,
    record: recordsByMeal[index],
  })) as Array<{ meal: MealType; record?: AttendanceRecord }>
  const currentMealRecord = mealRecords.find(({ meal }) => meal === app.meal)?.record
  const currentMealItems = currentMealRecord?.records ?? []
  const currentMealSummary = summarizeItems(currentMealItems)
  const currentOfficerUses = app.officerMealUses.filter((use) => use.date === app.date && use.meal === app.meal)
  const officerTicketCount = currentOfficerUses.filter((use) => use.status === 'ticket').length
  const officerUnpaidCount = currentOfficerUses.filter((use) => use.status === 'unpaid').length
  const combinedCompleted = currentMealSummary.completed + currentOfficerUses.length
  const combinedTotal = currentMealSummary.total + currentOfficerUses.length
  const currentMealProgress =
    combinedTotal > 0 ? Math.round((combinedCompleted / combinedTotal) * 100) : 0
  const workItems = currentMealItems.filter((item) => {
    const status = normalizeAttendanceStatus(item.status, item.ate)
    return status !== 'ate' && status !== 'missing'
  })
  const workStatusCounts = exceptionStatuses.map((status) => ({
    count: workItems.filter((item) => normalizeAttendanceStatus(item.status, item.ate) === status).length,
    status,
  }))
  const selectedWorkCount =
    workStatusFilter === 'all'
      ? workItems.length
      : workStatusCounts.find((item) => item.status === workStatusFilter)?.count ?? 0
  const workDivisionCount = new Set(workItems.map((item) => item.divisionId || 'unassigned')).size
  const visibleWorkStatuses =
    workStatusFilter === 'all'
      ? workStatusCounts.filter((item) => item.count > 0).map((item) => item.status)
      : [workStatusFilter]
  const workStatusGroups = visibleWorkStatuses
    .map((status) => ({
      items: workItems
        .filter((item) => normalizeAttendanceStatus(item.status, item.ate) === status)
        .sort((first, second) => sortWorkItems(app, first, second)),
      status,
    }))
    .filter((group) => group.items.length > 0)

  return (
    <div className="stack">
      <section
        className="home-hero"
        style={
          {
            '--hero-image': `url(${mealHeroImages[app.meal]})`,
            '--progress': `${currentMealProgress}%`,
          } as CSSProperties & Record<'--hero-image' | '--progress', string>
        }
      >
        <div>
          <span>
            {formatCompactDate(app.date)} {mealLabels[app.meal]} 기록
          </span>
          <h2>{currentMealRecord ? `${currentMealProgress}% 완료` : '기록 없음'}</h2>
          <p>
            용사 {currentMealSummary.total}명 · 식권구매자 {currentOfficerUses.length}명 · 합계 {combinedTotal}명
          </p>
        </div>
        <div className="home-ring">
          <strong>{currentMealRecord ? combinedCompleted : currentOfficerUses.length}</strong>
          <span>/{combinedTotal}</span>
        </div>
      </section>

      <section className="home-total-compare" aria-label="용사 식권구매자 합계">
        <article>
          <span>용사</span>
          <strong>{currentMealSummary.completed}/{currentMealSummary.total}</strong>
          <small>미취식 {currentMealSummary.missing} · 근무/기타 {currentMealSummary.excluded}</small>
        </article>
        <article>
          <span>식권구매자</span>
          <strong>{currentOfficerUses.length}</strong>
          <small>식권 {officerTicketCount} · 미구매 {officerUnpaidCount}</small>
        </article>
        <article>
          <span>합계</span>
          <strong>{combinedCompleted}/{combinedTotal}</strong>
          <small>현재 식사 기준</small>
        </article>
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2>식권구매자 취식 명단</h2>
          <small>{mealLabels[app.meal]} 기준</small>
        </div>
        {currentOfficerUses.length > 0 ? (
          <div className="compact-list">
            {currentOfficerUses
              .slice()
              .sort((a, b) => a.officerName.localeCompare(b.officerName, 'ko'))
              .map((use) => (
                <div key={use.id}>
                  <span>{use.officerName}</span>
                  <strong>{use.status === 'ticket' ? '식권' : '미구매'}</strong>
                </div>
              ))}
          </div>
        ) : (
          <div className="empty-inline">현재 식사에 등록된 식권구매자가 없습니다.</div>
        )}
      </section>

      {!hasDateRecords && (
        <section className="panel empty-inline">
          선택한 날짜에 저장된 취식 기록이 없습니다. 취식체크에서 해당 날짜를 체크하면 홈에 반영됩니다.
        </section>
      )}

      <section className="panel work-panel">
        <div className="panel-title-row">
          <h2>근무/기타</h2>
          <small>{mealLabels[app.meal]} 기준</small>
        </div>
        <div className="work-dashboard">
          <div className="work-toolbar">
            <div className="work-summary-cards">
              <article>
                <span>전체</span>
                <strong>{workItems.length}</strong>
              </article>
              <article>
                <span>선택</span>
                <strong>{selectedWorkCount}</strong>
              </article>
              <article>
                <span>포대</span>
                <strong>{workItems.length > 0 ? workDivisionCount : 0}</strong>
              </article>
            </div>
            <label className="work-select-control">
              <span>분류</span>
              <select
                onChange={(event) => setWorkStatusFilter(event.target.value as ScheduledExceptionStatus | 'all')}
                value={workStatusFilter}
              >
                <option value="all">전체 {workItems.length}명</option>
                {workStatusCounts.map(({ count, status }) => (
                  <option key={status} value={status}>
                    {attendanceStatusLabels[status]} {count}명
                  </option>
                ))}
              </select>
            </label>
          </div>

          {workStatusGroups.length > 0 ? (
            <div className="work-status-list">
              {workStatusGroups.map((group) => (
                <article className={`work-status-card status-${group.status}`} key={group.status}>
                  <header>
                    <strong>{attendanceStatusLabels[group.status]}</strong>
                    <span>{group.items.length}명</span>
                  </header>
                  <div className="work-person-list">
                    {group.items.map((item) => {
                      const meta = getWorkItemMeta(app, item)
                      return (
                        <div className="work-person-row" key={`${item.soldierId}-${group.status}-${item.updatedAt}`}>
                          <span>
                            {meta.division} · {meta.section} · {item.name}
                          </span>
                          {meta.period && <strong>{meta.period}</strong>}
                        </div>
                      )
                    })}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-inline">선택 조건에 맞는 근무/기타 인원이 없습니다.</div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2>부식재고 주의</h2>
          <small>{app.inventoryItems.length}개 항목</small>
        </div>
        {lowStockItems.length > 0 ? (
          <div className="compact-list">
            {lowStockItems.map((item) => (
              <div key={item.id}>
                <span>
                  <AlertTriangle size={15} /> {item.name}
                </span>
                <strong>
                  {item.quantity}
                  {item.unit}
                </strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-inline">안전재고 이하 항목이 없습니다.</div>
        )}
      </section>
    </div>
  )
}
