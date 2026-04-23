import { Route, Routes } from 'react-router-dom';
import './App.css';
import DashboardLayout from './layout/DashboardLayout';
import HomePage from './pages/HomePage';
import MyReportsPage from './pages/MyReportsPage';
import NotificationsPage from './pages/NotificationsPage';
import PrivacyPage from './pages/PrivacyPage';
import ReportPage from './pages/ReportPage';
import SavedPlacesPage from './pages/SavedPlacesPage';
import ScanPage from './pages/ScanPage';
import SettingsPage from './pages/SettingsPage';
import AiComposerPage from './pages/AiComposerPage';

export default function App() {
  return (
    <div className="ai-app ai-app-dash">
      <div className="ai-bg" aria-hidden />
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/ai-composer" element={<AiComposerPage />} />
          <Route path="/reports" element={<MyReportsPage />} />
          <Route path="/places" element={<SavedPlacesPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
        </Route>
      </Routes>
    </div>
  );
}
