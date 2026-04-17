import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Auth from './pages/Auth';
import Survey from './pages/Survey';
import SurveyEntry from './pages/SurveyEntry';
import RoseTypes from './pages/RoseTypes';
import Match from './pages/Match';
import Admin from './pages/Admin';
import Navbar from './components/Navbar';
import { getAccessToken, getIsAdmin, migrateLegacyStorageKeys } from './lib/storage';
import { useEffect } from 'react';
import EmailExceptionApply from './pages/EmailExceptionApply';
import XinghuaTi from './pages/XinghuaTi';
import XinghuaTiResult from './pages/XinghuaTiResult';
import XinghuaFestival from './pages/XinghuaFestival';

function ProtectedRoute({ children }) {
  const token = getAccessToken();
  if (!token) {
    return <Navigate to="/auth" replace />;
  }
  return children;
}

function AdminRoute({ children }) {
  const token = getAccessToken();
  const isAdmin = getIsAdmin();
  if (!token) {
    return <Navigate to="/auth" replace />;
  }
  if (!isAdmin) {
    return <Navigate to="/survey" replace />;
  }
  return children;
}

function AppLayout() {
  const location = useLocation();
  const isNoPadding = location.pathname === '/' || location.pathname === '/auth';

  return (
    <div className={`min-h-screen bg-gray-50 text-gray-800 flex flex-col ${isNoPadding ? '' : 'pt-[72px] sm:pt-[88px]'}`}>
      <Navbar />
      <main className="flex-1 w-full relative">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/email-exception" element={<EmailExceptionApply />} />
          <Route path="/xinghua-ti" element={<XinghuaTi />} />
          <Route path="/xinghua-ti/result" element={<XinghuaTiResult />} />
          <Route path="/xinghua-festival" element={
            <ProtectedRoute>
              <XinghuaFestival />
            </ProtectedRoute>
          } />
          <Route path="/survey" element={<SurveyEntry />} />
          <Route path="/survey/questionnaire" element={<Survey />} />
          <Route path="/rose" element={<RoseTypes />} />
          <Route path="/match" element={
            <ProtectedRoute>
              <Match />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          } />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  useEffect(() => {
    migrateLegacyStorageKeys();
  }, []);

  return (
    <Router>
      <AppLayout />
    </Router>
  );
}

export default App;
