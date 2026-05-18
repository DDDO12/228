import { useEffect, useState } from 'react'
import { useSwipeable } from 'react-swipeable'
import { useAppState } from './app/appState'
import { routes, type RouteId } from './app/routes'
import { SplashScreen } from './components/SplashScreen'
import { Toast } from './components/Toast'
import { AppShell } from './layout/AppShell'
import { AttendanceScreen } from './screens/AttendanceScreen'
import { HomeScreen } from './screens/HomeScreen'
import { InventoryScreen } from './screens/InventoryScreen'
import { MemoScreen } from './screens/MemoScreen'
import { OfficerTicketScreen } from './screens/OfficerTicketScreen'

const routeStorageKey = 'meal-check:last-route'

function isRoute(value: string | null): value is RouteId {
  return Boolean(value && routes.includes(value as RouteId))
}

function getInitialRoute(): RouteId {
  const hashRoute = window.location.hash.replace('#', '')
  if (isRoute(hashRoute)) return hashRoute
  const storedRoute = window.localStorage.getItem(routeStorageKey)
  return isRoute(storedRoute) ? storedRoute : 'attendance'
}

function App() {
  const app = useAppState()
  const [route, setRoute] = useState<RouteId>(() => getInitialRoute())
  const routeIndex = routes.indexOf(route)
  const swipe = useSwipeable({
    onSwipedLeft: () => {
      if (route !== 'attendance') setRoute(routes[Math.min(routes.length - 1, routeIndex + 1)])
    },
    onSwipedRight: () => {
      if (route !== 'attendance') setRoute(routes[Math.max(0, routeIndex - 1)])
    },
    trackMouse: true,
  })

  useEffect(() => {
    window.localStorage.setItem(routeStorageKey, route)
    window.history.replaceState({ route }, '', `${window.location.pathname}${window.location.search}#${route}`)
  }, [route])

  if (!app.isReady) return <SplashScreen />

  return (
    <div {...swipe}>
      <AppShell app={app} onRouteChange={setRoute} route={route}>
        {route === 'home' && <HomeScreen app={app} />}
        {route === 'attendance' && <AttendanceScreen app={app} />}
        {route === 'officer' && <OfficerTicketScreen app={app} />}
        {route === 'inventory' && <InventoryScreen app={app} />}
        {route === 'memo' && <MemoScreen app={app} />}
      </AppShell>
      <Toast message={app.toast} onClose={() => app.setToast('')} />
    </div>
  )
}

export default App
