import { useState } from 'react'
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

function App() {
  const app = useAppState()
  const [route, setRoute] = useState<RouteId>('attendance')
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

  if (!app.isReady) return <SplashScreen />

  return (
    <div {...swipe}>
      <AppShell app={app} onRouteChange={setRoute} route={route}>
        {route === 'home' && <HomeScreen app={app} />}
        {route === 'attendance' && <AttendanceScreen app={app} />}
        {route === 'inventory' && <InventoryScreen app={app} />}
        {route === 'memo' && <MemoScreen app={app} />}
      </AppShell>
      <Toast message={app.toast} onClose={() => app.setToast('')} />
    </div>
  )
}

export default App
