import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { Dashboard } from './pages/Dashboard'
import { LiveData } from './pages/LiveData'
import { DtcManager } from './pages/DtcManager'
import { SessionHistory } from './pages/SessionHistory'
import { VehicleInfo } from './pages/VehicleInfo'
import { ITVReadiness } from './pages/ITVReadiness'
import { DiagnosticReport } from './pages/DiagnosticReport'
import { Performance } from './pages/Performance'
import { QuickScan } from './pages/QuickScan'
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
        <Route path="/itv" element={<ITVReadiness />} />
        <Route path="/report" element={<DiagnosticReport />} />
        <Route path="/performance" element={<Performance />} />
        <Route path="/quickscan" element={<QuickScan />} />
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
