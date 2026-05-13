import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { AppState } from '../app/appState'
import type { RouteId } from '../app/routes'
import { BottomNav } from './BottomNav'
import { Header } from './Header'
import { SettingsSheet } from './SettingsSheet'

interface AppShellProps {
  app: AppState
  route: RouteId
  children: React.ReactNode
  onRouteChange: (route: RouteId) => void
}

export function AppShell({ app, route, children, onRouteChange }: AppShellProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="app-shell">
      <Header date={app.date} onSettings={() => setSettingsOpen(true)} route={route} />
      <main>
        <AnimatePresence mode="wait">
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            className="screen-motion"
            exit={{ opacity: 0, x: -16 }}
            initial={{ opacity: 0, x: 16 }}
            key={route}
            transition={{ duration: 0.18 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav onChange={onRouteChange} route={route} />
      <SettingsSheet app={app} onClose={() => setSettingsOpen(false)} open={settingsOpen} />
    </div>
  )
}
