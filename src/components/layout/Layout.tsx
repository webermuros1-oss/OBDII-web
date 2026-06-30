import { NavLink, useLocation } from 'react-router-dom'
import { useOBDStore } from '../../store/obdStore'
import { ConnectionPanel } from '../connection/ConnectionPanel'

const PerformanceIcon = () => (
  <svg width="22" height="22" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 15 L6 9 L9 12 L12 6 L15 10 L17 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="17" cy="7" r="1.5" fill="currentColor"/>
  </svg>
)

const ScanIcon = () => (
  <svg width="22" height="22" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="12" y="3" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="3" y="12" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M13 13 L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="14" cy="14" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
)

// SVG icons — 22x22px, inline, no external dependency

const DashboardIcon = () => (
  <svg width="22" height="22" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
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

const DTCIcon = () => (
  <svg width="22" height="22" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 2 L18 17 H2 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M10 8 L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="10" cy="14.5" r="0.75" fill="currentColor" />
  </svg>
)

const VehicleIcon = () => (
  <svg width="22" height="22" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 12 L5 7 Q6 5 8 5 H12 Q14 5 15 7 L17 12 V15 H3 V12 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <circle cx="6" cy="15" r="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="14" cy="15" r="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M3 12 H17" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)

const ITVIcon = () => (
  <svg width="22" height="22" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6 10 L8.5 12.5 L14 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)


const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', shortLabel: 'Dash', Icon: DashboardIcon },
  { to: '/dtc', label: 'Códigos DTC', shortLabel: 'DTC', Icon: DTCIcon },
  { to: '/itv', label: 'ITV', shortLabel: 'ITV', Icon: ITVIcon },
  { to: '/performance', label: 'Rendimiento', shortLabel: 'Perf', Icon: PerformanceIcon },
  { to: '/quickscan', label: 'Análisis', shortLabel: 'Scan', Icon: ScanIcon },
  { to: '/vehicle', label: 'Vehículo', shortLabel: 'Vehículo', Icon: VehicleIcon },
]

function usePageTitle(): string {
  const location = useLocation()
  const match = NAV_ITEMS.find((item) => location.pathname === item.to)
  return match ? match.label : 'OBD-II'
}

export function Layout({ children }: { children: React.ReactNode }) {
  useOBDStore()
  const pageTitle = usePageTitle()

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 overflow-hidden">
      {/* Fixed header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-3">
        {/* Logo */}
        <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
          <span className="text-green-400 text-xs font-bold">OBD</span>
        </div>

        {/* Page title */}
        <span className="flex-1 text-gray-100 text-base font-semibold truncate">{pageTitle}</span>

        {/* Connection button/indicator in header */}
        <ConnectionPanel />
      </header>

      {/* Scrollable content — top padding for header, bottom padding for bottom nav */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-14 pb-20 px-4 py-4">
        {children}
      </main>

      {/* Fixed bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-gray-900 border-t border-gray-800 flex items-stretch">
        {NAV_ITEMS.map(({ to, shortLabel, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-1 min-h-[44px] transition-colors ${
                isActive ? 'text-green-400' : 'text-gray-500'
              }`
            }
          >
            <Icon />
            <span className="text-[10px] font-medium leading-none">{shortLabel}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
