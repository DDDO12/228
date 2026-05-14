import { AlertTriangle, CheckCircle2, Package, ShieldAlert, Users } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { AppState } from '../app/appState'
import {
  attendanceStatusLabels,
  attendanceStatuses,
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

export function HomeScreen({ app }: { app: AppState }) {
  const recordsByMeal: Array<AttendanceRecord | undefined> = mealOrder.map((meal) => {
    const stored = app.attendanceRecords.find((record) => record.date === app.date && record.meal === meal)
    return stored && stored.records.length > 0 ? syncAttendanceRecord(stored, app.soldiers, app.divisions) : undefined
  })
  const selectedDateRecords = recordsByMeal.filter((record): record is AttendanceRecord => Boolean(record))
  const selectedDateItems = selectedDateRecords.flatMap((record) => record.records)
  const hasDateRecords = selectedDateRecords.length > 0
  const total = selectedDateItems.length
  const ate = countItems(selectedDateItems, 'ate')
  const missing = countItems(selectedDateItems, 'missing')
  const excluded = total - ate - missing
  const progress = total > 0 ? Math.round((ate / total) * 100) : 0
  const lowStockItems = app.inventoryItems.filter(isLowStock)
  const exceptionItems = selectedDateItems.filter((item) => {
    const status = normalizeAttendanceStatus(item.status, item.ate)
    return status !== 'ate' && status !== 'missing'
  })

  const mealRecords = mealOrder.map((meal, index) => ({
    meal,
    record: recordsByMeal[index],
  })) as Array<{ meal: MealType; record?: AttendanceRecord }>

  return (
    <div className="stack">
      <section className="home-hero">
        <div>
          <span>{formatCompactDate(app.date)} 전체 기록</span>
          <h2>{hasDateRecords ? `${progress}% 완료` : '기록 없음'}</h2>
          <p>
            취식 {ate}명 · 미취식 {missing}명 · 열외 {excluded}명
          </p>
        </div>
        <div className="home-ring" style={{ '--progress': `${progress}%` } as CSSProperties & Record<'--progress', string>}>
          <strong>{ate}</strong>
          <span>/{total}</span>
        </div>
      </section>

      {!hasDateRecords && (
        <section className="panel empty-inline">
          선택한 날짜에 저장된 취식 기록이 없습니다. 취식체크에서 해당 날짜를 체크하면 홈에 반영됩니다.
        </section>
      )}

      <section className="home-status-grid">
        <article>
          <CheckCircle2 size={20} />
          <strong>{ate}</strong>
          <span>취식</span>
        </article>
        <article>
          <Users size={20} />
          <strong>{missing}</strong>
          <span>미취식</span>
        </article>
        <article>
          <ShieldAlert size={20} />
          <strong>{excluded}</strong>
          <span>열외</span>
        </article>
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
                  취식 {countRecord(record, 'ate')}명 · 미취식 {countRecord(record, 'missing')}명 · 열외{' '}
                  {record.records.length - countRecord(record, 'ate') - countRecord(record, 'missing')}명
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
          <h2>상태별 현황</h2>
          <small>마지막 저장 {formatTime(app.lastSavedAt)}</small>
        </div>
        <div className="status-overview">
          {attendanceStatuses.map((status) => (
            <div key={status}>
              <span>{attendanceStatusLabels[status]}</span>
              <strong>{countItems(selectedDateItems, status)}</strong>
            </div>
          ))}
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
            const divisionAte = countItems(items, 'ate')
            const percent = items.length > 0 ? Math.round((divisionAte / items.length) * 100) : 0
            return (
              <article key={division.id}>
                <div>
                  <strong>{division.name}</strong>
                  <span>
                    {divisionAte}/{items.length}명
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
          <h2>열외자</h2>
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
          <div className="empty-inline">선택 날짜에 등록된 열외자가 없습니다.</div>
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
