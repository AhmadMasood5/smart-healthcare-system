import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ProjectManagement from './pages/ProjectManagement';
import ScopeManagement from './pages/ScopeManagement';
import ScheduleManagement from './pages/ScheduleManagement';
import CostManagement from './pages/CostManagement';
import QualityManagement from './pages/QualityManagement';
import RiskManagement from './pages/RiskManagement';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="project" element={<ProjectManagement />} />
        <Route path="scope" element={<ScopeManagement />} />
        <Route path="schedule" element={<ScheduleManagement />} />
        <Route path="cost" element={<CostManagement />} />
        <Route path="quality" element={<QualityManagement />} />
        <Route path="risk" element={<RiskManagement />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
