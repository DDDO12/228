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
import { formatCompactDate, formatTime } from '../utils/date'

const mealHeroImages: Record<MealType, string> = {
  breakfast: breakfastHero,
  dinner: dinnerHero,
  lunch: lunchHero,
}

function countItems(items: AttendanceItem[], status: AttendanceStatus) {
  return items.filter((item) => normalizeAttendanceStatus(item.status, item.ate) === status).length
}

function countRecord(record: AttendanceRecord, status: AttendanceStatus) {
  return countItems(record.records, status)
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

export function HomeScreen({ app }: { app: AppState }) {
  const [workStatusFilter, setWorkStatusFilter] = useState<ScheduledExceptionStatus | 'all'>('all')
  const recordsByMeal: Array<AttendanceRecord | undefined> = mealOrder.map((meal) => {
    const stored = app.attendanceRecords.find((record) => record.date === app.date && record.meal === meal)
    return stored && stored.records.length > 0 ? syncAttendanceRecord(stored, app.soldiers, app.divisions) : undefined
  })
  const selectedDateRecords = recordsByMeal.filter((record): record is AttendanceRecord => Boolean(record))
  const selectedDateItems = selectedDateRecords.flatMap((record) => record.records)
  const hasDateRecords = selectedDateRecords.length > 0
  const lowStockItems = app.inventoryItems.filter(isLowStock)

  const mealRecords = mealOrder.map((meal, index) => ({
    meal,
    record: recordsByMeal[index],
  })) as Array<{ meal: MealType; record?: AttendanceRecord }>
  const currentMealRecord = mealRecords.find(({ meal }) => meal === app.meal)?.record
  const currentMealItems = currentMealRecord?.records ?? []
  const currentMealSummary = summarizeItems(currentMealRecord?.records ?? [])
  const currentMealProgress =
    currentMealSummary.total > 0 ? Math.round((currentMealSummary.completed / currentMealSummary.total) * 100) : 0
  const workItems = currentMealItems.filter((item) => {
    const status = normalizeAttendanceStatus(item.status, item.ate)
    return status !== 'ate' && status !== 'missing'
  })
  const filteredWorkItems =
    workStatusFilter === 'all'
      ? workItems
      : workItems.filter((item) => normalizeAttendanceStatus(item.status, item.ate) === workStatusFilter)
  const workItemsByDivision = app.divisions
    .map((division) => ({
      divisionName: division.name,
      items: filteredWorkItems.filter((item) => item.divisionId === division.id),
    }))
    .filter((group) => group.items.length > 0)
  const unassignedWorkItems = filteredWorkItems.filter((item) => !item.divisionId)
  if (unassignedWorkItems.length > 0) {
    workItemsByDivision.push({ divisionName: '포대 미지정', items: unassignedWorkItems })
  }

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
            총계 {currentMealSummary.total}명 · 취식 {currentMealSummary.ate}명 · 미취식 {currentMealSummary.missing}명 · 근무/기타{' '}
            {currentMealSummary.excluded}명
          </p>
        </div>
        <div className="home-ring">
          <strong>{currentMealRecord ? currentMealSummary.completed : 0}</strong>
          <span>/{currentMealSummary.total}</span>
        </div>
      </section>

      {!hasDateRecords && (
        <section className="panel empty-inline">
          선택한 날짜에 저장된 취식 기록이 없습니다. 취식체크에서 해당 날짜를 체크하면 홈에 반영됩니다.
        </section>
      )}

      <section className="panel">
        <div className="panel-title-row">
          <h2>식사별 기록</h2>
          <small>선택 날짜 기준</small>
        </div>
        <div className="meal-record-list">
          {mealRecords.map(({ meal, record }) => (
            <article key={meal}>
              <strong>{mealLabels[meal]}</strong>
              {record ? (
                <span>
                  취식 {countRecord(record, 'ate')}명 · 미취식 {countRecord(record, 'missing')}명 · 근무/기타{' '}
                  {record.records.filter((item) => {
                    const status = normalizeAttendanceStatus(item.status, item.ate)
                    return status !== 'ate' && status !== 'missing'
                  }).length}명
                </span>
              ) : (
                <span>기록 없음</span>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2>식사별 상태 현황</h2>
          <small>마지막 저장 {formatTime(app.lastSavedAt)}</small>
        </div>
        <div className="meal-status-breakdown">
          {mealRecords.map(({ meal, record }) => {
            const summary = summarizeItems(record?.records ?? [])
            return (
              <article key={meal}>
                <h3>{mealLabels[meal]}</h3>
                <div className="status-overview">
                  <div>
                    <span>총계</span>
                    <strong>{summary.total}</strong>
                  </div>
                  <div>
                    <span>취식</span>
                    <strong>{summary.ate}</strong>
                  </div>
                  <div>
                    <span>미취식</span>
                    <strong>{summary.missing}</strong>
                  </div>
                  <div>
                    <span>근무/기타</span>
                    <strong>{summary.excluded}</strong>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2>포대 진행률</h2>
          <small>선택 날짜 누적</small>
        </div>
        <div className="division-progress-list">
          {app.divisions.map((division) => {
            const items = selectedDateItems.filter((item) => item.divisionId === division.id)
            const divisionCompleted = countCompleted(items)
            const percent = items.length > 0 ? Math.round((divisionCompleted / items.length) * 100) : 0
            return (
              <article key={division.id}>
                <div>
                  <strong>{division.name}</strong>
                  <span>
                    {divisionCompleted}/{items.length}명
                  </span>
                </div>
                <div className="progress-track">
                  <span style={{ width: `${percent}%` }} />
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2>근무/기타</h2>
          <small>{mealLabels[app.meal]} 기준</small>
        </div>
        <div className="work-filter-row">
          <button className={workStatusFilter === 'all' ? 'active' : ''} onClick={() => setWorkStatusFilter('all')} type="button">
            전체 {workItems.length}
          </button>
          {exceptionStatuses.map((status) => (
            <button
              className={workStatusFilter === status ? 'active' : ''}
              key={status}
              onClick={() => setWorkStatusFilter(status)}
              type="button"
            >
              {attendanceStatusLabels[status]} {workItems.filter((item) => normalizeAttendanceStatus(item.status, item.ate) === status).length}
            </button>
          ))}
        </div>
        {filteredWorkItems.length > 0 ? (
          <div className="work-group-list">
            {workItemsByDivision.map((group) => (
              <article key={group.divisionName}>
                <header>
                  <strong>{group.divisionName}</strong>
                  <span>{group.items.length}명</span>
                </header>
                <div className="compact-list">
                  {group.items.map((item) => {
                    const status = normalizeAttendanceStatus(item.status, item.ate)
                    return (
                      <div key={`${item.soldierId}-${status}-${item.updatedAt}`}>
                        <span>
                          {item.section ? `${item.section} · ` : ''}
                          {item.name}
                        </span>
                        <strong>
                          {attendanceStatusLabels[status]}
                          {item.exceptionUntil ? ` ${item.exceptionStart ?? app.date}~${item.exceptionUntil}` : ''}
                        </strong>
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
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2>부식재고 주의</h2>
          <small>{app.inventoryItems.length}개 품목</small>
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
          <div className="empty-inline">안전재고 이하 품목이 없습니다.</div>
        )}
      </section>
    </div>
  )
}
