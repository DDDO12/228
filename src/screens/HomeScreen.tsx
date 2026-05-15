import { AlertTriangle, CheckCircle2, Package } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { AppState } from '../app/appState'
import {
  attendanceStatusLabels,
  isAteStatus,
  normalizeAttendanceStatus,
  syncAttendanceRecord,
  type AttendanceItem,
  type AttendanceRecord,
  type AttendanceStatus,
} from '../domain/attendance'
import { isLowStock } from '../domain/inventory'
import { mealLabels, mealOrder, type MealType } from '../domain/meal'
import { formatCompactDate, formatTime } from '../utils/date'

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
  const recordsByMeal: Array<AttendanceRecord | undefined> = mealOrder.map((meal) => {
    const stored = app.attendanceRecords.find((record) => record.date === app.date && record.meal === meal)
    return stored && stored.records.length > 0 ? syncAttendanceRecord(stored, app.soldiers, app.divisions) : undefined
  })
  const selectedDateRecords = recordsByMeal.filter((record): record is AttendanceRecord => Boolean(record))
  const selectedDateItems = selectedDateRecords.flatMap((record) => record.records)
  const hasDateRecords = selectedDateRecords.length > 0
  const daySummary = summarizeItems(selectedDateItems)
  const progress = daySummary.total > 0 ? Math.round((daySummary.completed / daySummary.total) * 100) : 0
  const lowStockItems = app.inventoryItems.filter(isLowStock)
  const exceptionItems = selectedDateItems.filter((item) => {
    const status = normalizeAttendanceStatus(item.status, item.ate)
    return status !== 'ate' && status !== 'missing'
  })

  const mealRecords = mealOrder.map((meal, index) => ({
    meal,
    record: recordsByMeal[index],
  })) as Array<{ meal: MealType; record?: AttendanceRecord }>
  const mealProgressText = mealRecords
    .map(({ meal, record }) => {
      if (!record) return `${mealLabels[meal]} 기록 없음`
      const summary = summarizeItems(record.records)
      return `${mealLabels[meal]} ${summary.completed}/${summary.total}`
    })
    .join(' · ')

  return (
    <div className="stack">
      <section className="home-hero">
        <div>
          <span>{formatCompactDate(app.date)} 전체 기록</span>
          <h2>{hasDateRecords ? `${progress}% 완료` : '기록 없음'}</h2>
          <p>{mealProgressText}</p>
        </div>
        <div className="home-ring" style={{ '--progress': `${progress}%` } as CSSProperties & Record<'--progress', string>}>
          <strong>{progress}%</strong>
          <span>완료</span>
        </div>
      </section>

      {!hasDateRecords && (
        <section className="panel empty-inline">
          선택한 날짜에 저장된 취식 기록이 없습니다. 취식체크에서 해당 날짜를 체크하면 홈에 반영됩니다.
        </section>
      )}

      <section className="home-status-grid">
        {mealRecords.map(({ meal, record }) => {
          const summary = summarizeItems(record?.records ?? [])
          return (
            <article key={meal}>
              <CheckCircle2 size={20} />
              <strong>{record ? `${summary.completed}/${summary.total}` : '-'}</strong>
              <span>
                {mealLabels[meal]} · 취식 {summary.ate} · 미취식 {summary.missing} · 근무 {summary.excluded}
              </span>
            </article>
          )
        })}
        <article className={lowStockItems.length > 0 ? 'warning' : ''}>
          <Package size={20} />
          <strong>{lowStockItems.length}</strong>
          <span>재고주의</span>
        </article>
      </section>

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
                  취식 {countRecord(record, 'ate')}명 · 미취식 {countRecord(record, 'missing')}명 · 근무{' '}
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
                    <span>근무</span>
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
          <h2>근무자</h2>
          <small>휴가 · 파견 · 예초 · 배식 · 취사</small>
        </div>
        {exceptionItems.length > 0 ? (
          <div className="compact-list">
            {exceptionItems.map((item) => {
              const status = normalizeAttendanceStatus(item.status, item.ate)
              return (
                <div key={`${item.soldierId}-${item.updatedAt}`}>
                  <span>
                    {item.divisionName} · {item.section ? `${item.section} · ` : ''}
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
        ) : (
          <div className="empty-inline">선택 날짜에 등록된 근무자가 없습니다.</div>
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
