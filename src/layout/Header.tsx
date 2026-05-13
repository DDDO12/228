import { Settings } from 'lucide-react'
import { routeLabels, type RouteId } from '../app/routes'
import { formatDisplayDate } from '../utils/date'

interface HeaderProps {
  date: string
  route: RouteId
  onSettings: () => void
}

export function Header({ date, route, onSettings }: HeaderProps) {
  return (
    <header className="app-header">
      <div>
        <span>{formatDisplayDate(date)}</span>
        <h1>{routeLabels[route]}</h1>
      </div>
      <button aria-label="설정" className="icon-button" onClick={onSettings} type="button">
        <Settings size={22} />
      </button>
    </header>
  )
}
