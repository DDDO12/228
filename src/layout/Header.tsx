import { Settings } from 'lucide-react'
import { routeLabels, type RouteId } from '../app/routes'
import { formatCompactDate } from '../utils/date'

interface HeaderProps {
  date: string
  onDateChange: (date: string) => void
  route: RouteId
  onSettings: () => void
}

export function Header({ date, onDateChange, route, onSettings }: HeaderProps) {
  return (
    <header className="app-header">
      <div>
        <h1>{routeLabels[route]}</h1>
      </div>
      <div className="header-actions">
        <label className="header-date-picker">
          <span aria-hidden="true">📅</span>
          <strong>{formatCompactDate(date)}</strong>
          <input aria-label="날짜 변경" onChange={(event) => onDateChange(event.target.value)} type="date" value={date} />
        </label>
        <button aria-label="설정" className="icon-button" onClick={onSettings} type="button">
          <Settings size={22} />
        </button>
      </div>
    </header>
  )
}
