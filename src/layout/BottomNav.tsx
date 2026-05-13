import { CalendarDays, Home, ListChecks, Package } from 'lucide-react'
import { routes, routeLabels, type RouteId } from '../app/routes'

const icons = {
  home: Home,
  attendance: ListChecks,
  inventory: Package,
  memo: CalendarDays,
}

interface BottomNavProps {
  route: RouteId
  onChange: (route: RouteId) => void
}

export function BottomNav({ route, onChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav">
      {routes.map((item) => {
        const Icon = icons[item]
        return (
          <button className={route === item ? 'active' : ''} key={item} onClick={() => onChange(item)} type="button">
            <Icon size={20} />
            <span>{routeLabels[item]}</span>
          </button>
        )
      })}
    </nav>
  )
}
