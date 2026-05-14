import { AlertTriangle, CheckCircle2, Package, ShieldAlert, Users } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { AppState } from '../app/appState'
import {
  attendanceStatusLabels,
  attendanceStatuses,
  normalizeAttendanceStatus,
  type AttendanceStatus,
} from '../domain/attendance'
import { isLowStock } from '../domain/inventory'
import { mealLabels } from '../domain/meal'
import { formatTime } from '../utils/date'

function statusCount(app: AppState, status: AttendanceStatus) {
  return app.currentRecord.records.filter((item) => normalizeAttendanceStatus(item.status, item.ate) === status).length
}

export function HomeScreen({ app }: { app: AppState }) {
  const total = app.currentRecord.records.length
  const ate = statusCount(app, 'ate')
  const missing = statusCount(app, 'missing')
  const excluded = total - ate - missing
  const progress = total > 0 ? Math.round((ate / total) * 100) : 0
  const lowStockItems = app.inventoryItems.filter(isLowStock)
  const exceptionItems = app.currentRecord.records.filter((item) => {
    const status = normalizeAttendanceStatus(item.status, item.ate)
    return status !== 'ate' && status !== 'missing'
  })

  return (
    <div className="stack">
      <section className="home-hero">
        <div>
          <span>오늘 {mealLabels[app.meal]}</span>
          <h2>{progress}% 완료</h2>
          <p>
            취식 {ate}명 · 미취식 {missing}명 · 열외 {excluded}명
          </p>
        </div>
        <div className="home-ring" style={{ '--progress': `${progress}%` } as CSSProperties & Record<'--progress', string>}>
          <strong>{ate}</strong>
          <span>/{total}</span>
        </div>
      </section>

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
          <h2>상태별 현황</h2>
          <small>마지막 저장 {formatTime(app.lastSavedAt)}</small>
        </div>
        <div className="status-overview">
          {attendanceStatuses.map((status) => (
            <div key={status}>
              <span>{attendanceStatusLabels[status]}</span>
              <strong>{statusCount(app, status)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2>분과 진행률</h2>
          <small>취식 기준</small>
        </div>
        <div className="division-progress-list">
          {app.divisions.map((division) => {
            const items = app.currentRecord.records.filter((item) => item.divisionId === division.id)
            const divisionAte = items.filter((item) => normalizeAttendanceStatus(item.status, item.ate) === 'ate').length
            const percent = items.length > 0 ? Math.round((divisionAte / items.length) * 100) : 0
            return (
              <article key={division.id}>
                <div>
                  <strong>{division.name}</strong>
                  <span>{divisionAte}/{items.length}명</span>
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
          <small>휴가 · 파견 · 근무 · 기타</small>
        </div>
        {exceptionItems.length > 0 ? (
          <div className="compact-list">
            {exceptionItems.map((item) => {
              const status = normalizeAttendanceStatus(item.status, item.ate)
              return (
                <div key={item.soldierId}>
                  <span>{item.divisionName} · {item.name}</span>
                  <strong>
                    {attendanceStatusLabels[status]}
                    {item.exceptionUntil ? ` ~${item.exceptionUntil}` : ''}
                  </strong>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="empty-inline">등록된 열외자가 없습니다.</div>
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
                <strong>{item.quantity}{item.unit}</strong>
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
