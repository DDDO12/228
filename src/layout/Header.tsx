import { useRef } from 'react'
import { CalendarDays, Settings } from 'lucide-react'
import { routeLabels, type RouteId } from '../app/routes'
import { formatCompactDate } from '../utils/date'

interface HeaderProps {
  date: string
  onDateChange: (date: string) => void
  route: RouteId
  onSettings: () => void
}

export function Header({ date, onDateChange, route, onSettings }: HeaderProps) {
  const dateInputRef = useRef<HTMLInputElement>(null)

  function openDatePicker() {
    const input = dateInputRef.current
    if (!input) return
    if (typeof input.showPicker === 'function') input.showPicker()
    else input.click()
  }

  return (
    <header className="app-header">
      <div>
        <h1>{routeLabels[route]}</h1>
      </div>
      <div className="header-actions">
        <button className="header-date-picker" onClick={openDatePicker} type="button">
          <CalendarDays aria-hidden="true" size={18} />
          <strong>{formatCompactDate(date)}</strong>
        </button>
        <input
          ref={dateInputRef}
          aria-label="날짜 변경"
          className="header-date-native-input"
          onChange={(event) => onDateChange(event.target.value)}
          type="date"
          value={date}
        />
        <button aria-label="설정" className="icon-button" onClick={onSettings} type="button">
          <Settings size={22} />
        </button>
      </div>
    </header>
  )
}
