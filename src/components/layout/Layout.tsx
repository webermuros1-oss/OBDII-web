import { NavLink } from 'react-router-dom'
import { useOBDStore } from '../../store/obdStore'
import { ConnectionPanel } from '../connection/ConnectionPanel'
import { StatusBar } from './StatusBar'

// SVG icons — 20x20px, inline, no external dependency

const DashboardIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
    <path d="M10 10 L14.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="10" cy="10" r="1.5" fill="currentColor" />
    <path d="M10 4 L10 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M16 10 L14.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M4 10 L5.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M13.5 6.5 L12.4 7.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M6.5 6.5 L7.6 7.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const LiveIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 14 L6 8 L9 11 L13 5 L18 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="18" cy="10" r="1.5" fill="currentColor" className="animate-pulse" />
  </svg>
)

const DTCIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 2 L18 17 H2 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M10 8 L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="10" cy="14.5" r="0.75" fill="currentColor" />
  </svg>
)

const HistoryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
    <path d="M10 6 L10 10 L13 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const VehicleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 12 L5 7 Q6 5 8 5 H12 Q14 5 15 7 L17 12 V15 H3 V12 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <circle cx="6" cy="15" r="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="14" cy="15" r="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M3 12 H17" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', Icon: DashboardIcon },
  { to: '/live', label: 'Datos en vivo', Icon: LiveIcon },
  { to: '/dtc', label: 'Códigos DTC', Icon: DTCIcon },
  { to: '/history', label: 'Historial', Icon: HistoryIcon },
  { to: '/vehicle', label: 'Vehículo', Icon: VehicleIcon },
]

export function Layout({ children }: { children: React.ReactNode }) {
  useOBDStore()

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-gray-800 gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
            <span className="text-green-400 text-sm font-bold">OBD</span>
          </div>
          <span className="text-green-400 text-lg font-bold tracking-tight">OBDII Diag</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-green-500/10 text-green-400'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                }`
              }
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Connection panel at bottom of sidebar */}
        <div className="p-4 border-t border-gray-800">
          <ConnectionPanel />
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-6 scrollbar-thin">
          {children}
        </div>
        <StatusBar />
      </main>
    </div>
  )
}
