import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { Dashboard } from './pages/Dashboard'
import { LiveData } from './pages/LiveData'
import { DtcManager } from './pages/DtcManager'
import { SessionHistory } from './pages/SessionHistory'
import { VehicleInfo } from './pages/VehicleInfo'
import { useOBDConnection } from './hooks/useOBDConnection'

function AppContent() {
  useOBDConnection()

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/live" element={<LiveData />} />
        <Route path="/dtc" element={<DtcManager />} />
        <Route path="/history" element={<SessionHistory />} />
        <Route path="/vehicle" element={<VehicleInfo />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  )
}
