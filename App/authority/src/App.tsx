import { Route, Routes } from 'react-router-dom';
import AuthorityLayout from './AuthorityLayout';
import AuthorityDashboardPage from './pages/AuthorityDashboardPage';
import AuthorityReportsPage from './pages/AuthorityReportsPage';
import AuthorityMapPage from './pages/AuthorityMapPage';
import AuthorityWorkOrdersPage from './pages/AuthorityWorkOrdersPage';
import AuthorityTeamsPage from './pages/AuthorityTeamsPage';
import AuthoritySettingsPage from './pages/AuthoritySettingsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AuthorityLayout />}>
        <Route index element={<AuthorityDashboardPage />} />
        <Route path="reports" element={<AuthorityReportsPage />} />
        <Route path="map" element={<AuthorityMapPage />} />
        <Route path="work-orders" element={<AuthorityWorkOrdersPage />} />
        <Route path="teams" element={<AuthorityTeamsPage />} />
        <Route path="settings" element={<AuthoritySettingsPage />} />
      </Route>
    </Routes>
  );
}
